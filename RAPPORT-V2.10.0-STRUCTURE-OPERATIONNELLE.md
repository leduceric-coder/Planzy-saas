# Rapport — Kanvix V2.10.0 · Structure opérationnelle

**Fichier livré** : `public/poc/kanvix-next-gen-v2.10.0.html` (29 004 lignes)
**Source** : `public/poc/kanvix-next-gen-v2.9.1.html` (28 584 lignes)
**Recette dédiée** : `recette-structure-operationnelle-v2.10.0.mjs` — **69 / 69 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.10.0/` — 10 captures + `resultats.json`
**Branche** : `claude/kanvix-next-gen-poc-im084x`

| Contrôle | Résultat |
|---|---|
| `SCHEMA_VERSION` | **13**, inchangé — aucun champ persistant nouveau n'était nécessaire |
| `STORE` | **`kanvix-product-8-3`**, inchangé |
| `migrateState()` | **byte-identique** |
| `INITIAL_STATE` et tâches de démonstration | **byte-identiques** |
| Moteurs de V2.9.1 gelés | **123 comparés, 0 bougé** |
| Planning (drag & drop, création à la souris, jours non ouvrés, démarrage réel) | **byte-identique** |
| 49 recettes historiques | **`RESTE : 0`** (262 contre 262) |
| 3 recettes Structure | **80/80, 59/59, 74/74** — contre leur version **et** contre V2.10.0 |

---

## 1. Audit préalable (§2)

Avant d'écrire une ligne, j'ai relevé ce qui existait déjà. C'est ce qui a permis
de n'ajouter presque aucune règle.

| Sujet | Constat |
|---|---|
| Modèle d'un niveau | `{id, projectId, parentId, name, type, description, responsibleResourceId, archived, createdAt, updatedAt}` |
| Lien intervention → niveau | un seul champ, `task.structureNodeId` |
| Descendance | `getStructureDescendantIds()` — parcours en largeur borné à 5 000, **inclut déjà le nœud de départ** |
| Interventions d'un périmètre | `getStructureTasks(nodeId)` — le nœud et sa descendance |
| Agrégations | `getStructureProgress / Resources / Dates / Status / Issues / Controls` |
| **Protection des cycles** | **`structureParentError()` existe déjà** : refuse un autre chantier, soi-même, et tout descendant |
| **Destinations valides** | **`structureParentOptions()` existe déjà** : niveaux ACTIFS seulement, cycles exclus |
| Undo/Redo | `snapshot()` clone **tout `app`** — un sous-arbre, ses tâches et leurs dépendances tiennent donc dans UNE transaction |
| Toast annulable | `actionToast(s)` rend déjà `« s · Annuler »` câblé sur `undo()` |
| Side-window | `drawerForm(titre, corps, submit, libellé)` — Annuler + validation, focus sur le premier champ, `render()` après soumission |
| Dépendances | `task.deps` — un tableau d'IDs de tâches |
| Génération d'ID | `"sn-" + Date.now()` — **se répète** quand plusieurs objets naissent dans la même milliseconde |

**Conséquence** : §6 (cycles) et §19 (archivés) étaient **déjà satisfaits** par
`structureParentError()` / `structureParentOptions()`. Je les réutilise tels
quels. Aucun second modèle de Structure n'a été créé.

---

## 2. Déplacer un niveau (§3 → §8)

### Le moteur

```js
function moveStructureNode(nodeId, parentId) {
  let n = structureNode(nodeId);
  if (!n || !guardEditable(n.projectId)) return false;
  let blocage = structureMoveBlocker(nodeId, parentId || null);
  if (blocage) return blocage;            // garde MÉTIER, pas seulement d'écran
  snapshot();
  let avant = n.parentId;
  n.parentId = parentId || null;          // UNE donnée change. C'est tout.
  n.updatedAt = historyNow();
  app.history.unshift({ … changes: [{ field: "Emplacement", from: …, to: … }] });
  save();
  return true;
}
```

**Rien n'est recréé** : ni le niveau, ni sa descendance (qui pointe vers lui par
`parentId`), ni ses interventions (qui pointent vers lui par `structureNodeId`).
`STR-OP-02` et `STR-OP-04` le vérifient : après déplacement de Niveau 2,
`getStructureDescendantIds()` rend exactement la même liste, Niveau 3 reste
enfant de Niveau 2 et Niveau 4 de Niveau 3.

`structureMoveBlocker()` n'ajoute qu'une règle à `structureParentError()` :
déplacer un niveau là où il est déjà n'est pas une erreur, c'est un non-geste.

### La garde est métier, pas cosmétique (§6)

`STR-OP-08` appelle **directement** `moveStructureNode('sn-a1', 'sn-a1')` et
`moveStructureNode('sn-a1', 'sn-a4')` — hors de tout écran. Les deux sont
refusés, et `parentId` n'a pas bougé. Les destinations interdites sont **en
outre** absentes de la liste proposée.

### La side-window (§3, §7)

Titre « Déplacer le niveau », carte de rappel (nom, type, emplacement actuel),
puis la liste hiérarchique des destinations — `Racine du chantier` en tête, puis
chaque niveau valide, indenté selon sa profondeur réelle, avec son pictogramme
et son type. `Annuler` / `Déplacer`, **aucune pop-up de confirmation** : le geste
s'annule d'un clic dans le toast.

Après validation : la side-window se ferme, l'utilisateur **reste dans l'onglet
Structure** (`STR-OP-13` le vérifie par un vrai parcours d'interface), et le
toast affiche **« Niveau déplacé · Annuler »**, câblé sur le moteur Undo existant.

### Racine, Undo/Redo, fil d'Ariane

* §5 — le déplacement vers `Racine du chantier` met simplement `parentId` à
  `null`. `STR-OP-03` vérifie qu'**aucun faux parent technique** n'est créé.
* §8 — `STR-OP-11` / `STR-OP-12` : une transaction d'annulation, une entrée
  d'historique ; Undo replace le niveau **exactement** où il était, descendance
  comprise ; Redo le remet à sa nouvelle place.
* §24 — `STR-OP-14` déplace le niveau **actuellement ouvert** depuis sa fiche,
  par le vrai parcours, et vérifie que le fil d'Ariane suit
  (`Keravel › Niveau 2 › Niveau 3` → `Keravel › Bâtiment A › Niveau 3`) sans
  quitter la fiche.

---

## 3. Dupliquer un niveau (§9 → §21)

### Deux tables de correspondance, et rien d'autre

```js
let ids = getStructureDescendantIds(nodeId),                  // source + descendance
    mapNoeuds = new Map(ids.map((id) => [id, structureUid("sn-")])),
    clones = ids.map((id) => ({ ...structuredClone(structureNode(id)),
      id: mapNoeuds.get(id),
      // la racine prend la destination choisie ; chaque descendant prend le
      // CLONE de son parent, jamais l'original
      parentId: id === nodeId ? parentId : mapNoeuds.get(o.parentId) || null,
      … }));
```

et, si l'utilisateur a choisi d'emporter les interventions :

```js
let ts = getStructureTasks(nodeId),
    mapTaches = new Map(ts.map((t) => [t.id, structureUid("task-")]));
… {
  id: mapTaches.get(t.id),
  structureNodeId: mapNoeuds.get(t.structureNodeId),          // le CLONE du niveau
  deps: t.deps.filter((d) => mapTaches.has(d)).map((d) => mapTaches.get(d)),
}
```

**C'est le point critique de ce round** : un seul pointeur oublié vers l'arbre
source corromprait silencieusement le chantier. La recette le vérifie donc
pointeur par pointeur — `DUP-04` (aucun `parentId` vers la source), `DUP-07`
(aucun `structureNodeId` vers la source), `DUP-13` (aucune dépendance vers la
source).

### Les identifiants (§11)

`"sn-" + Date.now()` se répète quand plusieurs objets naissent dans la même
milliseconde — exactement le cas d'une duplication. `structureUid()` ajoute un
compteur de session. `DUP-03` vérifie que **tous** les IDs du chantier restent
uniques après duplication.

### Ce qui est conservé (§12, §15, §17, §18)

| Propriété | Conservée | Test |
|---|---|---|
| Intervenant principal (`resourceId`) | ✅ | DUP-08 |
| Ressources complémentaires (`additionalResourceIds`) | ✅ la Grue reste la Grue | DUP-09 |
| Dates et horaires | ✅ à l'identique, aucun décalage (§14) | DUP-10 |
| Lot et couleur | ✅ | DUP-11 |
| Statut, phase, baseline | ✅ (clone intégral, sauf id / structureNodeId / deps) | DUP-06 |
| Type du niveau et de chaque descendant | ✅ | DUP-17 |
| Responsable du niveau et de chaque descendant | ✅ | DUP-16 |

### Les dépendances (§13) — le choix, et pourquoi

| Cas | Traitement |
|---|---|
| Dépendance **interne** au périmètre (A → B, tous deux copiés) | **Remappée** : A2 → B2. `DUP-12` vérifie que la chaîne A → B → C devient A2 → B2 → C2 |
| Dépendance **externe** (A dépend d'une tâche restée dehors) | **Non recopiée** |

**Justification du choix externe.** Une dépendance dit « ceci ne peut pas
commencer avant cela ». Recopier un lien vers une tâche extérieure ferait
dépendre une intervention neuve d'un jalonnement qui n'est pas le sien : dupliquer
un étage attacherait sa première tâche à l'avancement de l'étage d'origine, ce
que personne n'a demandé. Le lien n'est pas *perdu* pour autant — la tâche source
le conserve intégralement. C'est le choix recommandé par le §13, et il est
mesuré : `duplicateStructureNode()` renvoie `depsClonees` et `depsAbandonnees`,
et `DUP-13` vérifie que l'unique dépendance externe du scénario est bien comptée
comme abandonnée.

### La side-window (§10)

Nom prérempli (`Étage 1 - copie`, modifiable), destination — **« même
emplacement » par défaut** —, puis deux cartes contrastées :

* **Structure seule** — « N niveaux, aucune intervention » · **sélectionné par
  défaut**, parce que c'est le geste le plus sûr ;
* **Structure + interventions** — « N niveaux et N interventions, aux mêmes dates ».

Les libellés portent les **vrais** comptes du niveau visé, calculés par les
moteurs existants.

### Nommage (§16)

`Étage 1 - copie`, puis `- copie 2`, `- copie 3`… en ne regardant que les
**frères de la destination** : deux copies sous deux parents différents peuvent
légitimement porter le même nom. `DUP-15` enchaîne trois duplications et vérifie
qu'aucun doublon n'apparaît entre frères.

### Après duplication (§20, §21)

Side-window fermée, utilisateur dans Structure, agrégats recalculés, niveau créé
**signalé brièvement** par un fond qui s'estompe en 2,4 s, toast
« Niveau dupliqué · N niveaux, N interventions · Annuler ».

`DUP-19` : la duplication de quatre niveaux, trois interventions et deux
dépendances est **UNE** transaction. Undo supprime l'ensemble et l'empreinte de
l'état revient **au caractère près** ; Redo le recrée à l'identique.

`DUP-05` / §21 : en « Structure seule », les agrégats d'un clone vide sont
corrects — la ligne affiche « — », sans erreur.

---

## 4. Un défaut trouvé en cours de route, et corrigé (§41)

Le menu à **six** entrées mesure 261 px, contre 175 avec quatre. Retourné vers
le haut, il dépasse désormais du bloc Structure — et ce bloc portait
`overflow: hidden` depuis V2.9.1, ajouté pour arrondir les coins de l'en-tête.

**Résultat : le sommet du menu était rogné, donc inatteignable.** Mesuré :

```
V2.9.1  (4 entrées) : menu 175 px, ne dépasse pas → cliquable
V2.10.0 (6 entrées) : menu 261 px, dépasse de 68 px → « Modifier » injoignable
```

Le défaut était **latent dans V2.9.1** : il n'apparaissait pas parce que le menu
tenait. C'est exactement le cas prévu par le § 41 — préexistant, et bloquant pour
V2.10.0.

**Correctif minimal** : `overflow: hidden` retiré du bloc ; l'en-tête et la
dernière ligne portent désormais leur propre rayon, ce qui produit le même rendu
sans rien rogner. `DUP-27` vérifie, **sur chaque ligne de l'arbre**, que les six
entrées sont réellement cliquables (`document.elementFromPoint` au centre de
chaque bouton).

---

## 5. Accessibilité et mobile (§25, §28)

| Point | Résultat |
|---|---|
| Ouverture au clavier | ✅ `Entrée` sur le « … », puis `Entrée` sur l'entrée de menu |
| Focus initial | ✅ sur le premier champ de la side-window |
| `Escape` ferme | ✅ |
| **Focus restitué au bouton déclencheur** | ✅ `DUP-26` vérifie qu'après `Escape` le focus revient sur le « … » **du bon niveau** |
| Mobile 430 / 390 | ✅ aucun débordement, aucun champ coupé |
| Liste des destinations | ✅ une **liste hiérarchique** de rangs de 40 px — jamais un tableau (`table` = 0) |
| Boutons accessibles | ✅ atteignables en faisant défiler le panneau (`overflow: auto`, comme les autres side-windows) |
| Liste plafonnée | ✅ 38 vh avec défilement interne : 28 destinations ne repoussent pas les boutons indéfiniment |
| Rien sous la barre inférieure | ✅ |

Le focus restitué a demandé un ajout : un `MutationObserver` sur la classe du
tiroir, posé uniquement par les deux nouvelles side-windows. `closeOverlay()`,
partagé par tout le produit, n'a pas été touché.

**Un défaut mobile corrigé** : mes rangs de destination s'empilaient
verticalement (83 px chacun). Cause — `.drawer-form label { display: grid }` est
plus spécifique que `.snc-dest-opt`. Le produit résout déjà ce point ailleurs
avec `.drawer-form label.op-pick` ; j'ai suivi exactement cette convention.
Résultat : **83 px → 40 px** par rang.

---

## 6. Ce qui n'a pas bougé (§29 → §34)

`FREEZE-2100` compare **123 fonctions** entre V2.9.1 et V2.10.0 : `bougés: []`.

* **Tout le Planning** (§32) — `gantt`, `planningTasks`, `dropTask`, `dragStart`,
  `dragOver`, `requestGanttTaskMove`, `requestTaskScheduleMove`,
  `planningCreatePointerDown/Move/Up`, `planningCanDrawCreate`, `openTaskForm`,
  `submitTaskEdit`, `planReflow`, `applyReflowPlan`, `nextWorkingTime`,
  `easterSunday`, `frenchPublicHolidays`, `isNonWorkingDate`, `realStartPlan`,
  `setTaskStatus`, `shiftPlanning`, `planningToday`…
* **Ressources** (§33) — `taskResourceIds`, `getResourceTasks`,
  `getResourceSchedulingConflicts`, `projectTeamCard`.
* **Qualité, jalons, Opérations, Mode Chantier** (§34).
* **Données** (§29, §30) — `migrateState`, `buildKanvixBackup`,
  `confirmKanvixRestore`, `applyImportPlan`, `exportKanvixData` : **le format
  portable n'a pas été touché**, aucun champ persistant nouveau n'étant requis.
* **Undo/Redo** (§31) — les neuf helpers, `actionToast`, `drawerForm`,
  `closeOverlay`, et les trois fonctions de navigation de V2.9.1.
* **Aucun drag & drop de structure** (§38) — vérifié : aucune ligne de structure
  ne porte `draggable`.

### Sauvegarde et restauration (§29)

`DUP-22` duplique avec interventions, déplace le clone, construit une sauvegarde,
repart d'un état vierge puis restaure. La hiérarchie obtenue (**parents compris**)
et les interventions clonées (**rattachements à la nouvelle structure et
dépendances comprises**) sont restituées à l'identique.

---

## 7. Fonctions modifiées et ajoutées

**Deux fonctions modifiées, aucune autre.** Le balayage de tout le fichier ne
trouve aucune différence hors périmètre.

| Fonction | Nature | Raison |
|---|---|---|
| `structureNodeMenu()` | Vue | Les deux entrées « Déplacer » et « Dupliquer » (§1) |
| `structureCompactRow()` | Vue | Le signalement bref du niveau créé (§20) |

**Aucun moteur métier n'a été modifié.**

### Dix fonctions ajoutées

`structureUid`, `structureMoveBlocker`, `moveStructureNode`, `structureCopyName`,
`duplicateStructureNode` — le métier ; `structureDestinationList`,
`structureSourceCard`, `openStructureMove`, `openStructureDuplicate`,
`structureRememberTrigger` — les vues.

### CSS

**14 classes nouvelles**, toutes préfixées `.snc-`, plus le retrait de
l'`overflow: hidden` expliqué au § 4. Aucune couleur codée en dur : `DUP-23`
relève **0 occurrence** dans la side-window, et vérifie qu'aucun fond n'est un
blanc pur en thème sombre.

---

## 8. Tests

### Recette dédiée — 69 / 69

| Bloc | Couverture |
|---|---|
| STR-OP-01 → 07 | Déplacement racine, sous-niveau, racine ; descendance, interventions, ressources, agrégats |
| STR-OP-08 → 10 | Cycle direct, cycle lointain (3 crans), destination archivée |
| STR-OP-11 → 14 | Undo, Redo, absence de navigation parasite, fil d'Ariane |
| DUP-01 → 05 | Structure seule : sous-niveaux, IDs neufs, parentIds du clone, zéro intervention, agrégats vides corrects |
| DUP-06 → 13 | Interventions : rattachement, intervenant, ressources, dates, lot, couleur, dépendances internes remappées, aucune vers la source |
| DUP-14 → 18 | Nom, collisions, responsable, type, agrégats |
| DUP-19 → 22 | Undo/Redo complets, « Sans structure » intact, sauvegarde/restauration |
| DUP-23 → 28 | Sombre, mobile 430/390, clavier, menu, périmètre, 0 erreur console |
| §37 | Arbre à 5 niveaux ; 18 zones sœurs ; 23 destinations dans la side-window |

### Non-régression

| Suite | Contre sa version | Contre V2.10.0 |
|---|---|---|
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** | **74 / 74** |
| 49 recettes historiques | — | **`RESTE : 0`** |

```
ECHECS V2.10.0 : 262   |   ECHECS RÉF V2.9.1 : 262
RESTE : 0
```

**Aucune régression historique.** En particulier, les trois recettes Planning les
plus sensibles sont intactes : `planning-calendrier-realite` **76/0**,
`planning-draw-create` **54/0**, `planning-edition` **53/0**.

### Assertions adaptées — et pourquoi

Aucune assertion **métier** n'a été modifiée. Quatre assertions de présentation
sont devenues obsolètes du fait du §1 (le menu passe de quatre à six entrées) :

| Recette | Assertion | Traitement |
|---|---|---|
| `structure-ux-v2.9.0.1` | UXS-02 — « exactement 4 role=menuitem » et « ces quatre actions dans cet ordre » | **Renforcée** : les quatre actions historiques doivent toutes être présentes, **dans leur ordre relatif d'origine**, et toute entrée supplémentaire doit figurer dans une liste blanche explicite. Un ajout non déclaré ferait tomber le test. Vaut pour l'ancien build comme pour le nouveau |
| `structure-compacte-v2.9.1` | STC-16 — idem | Idem |
| `structure-ux-v2.9.0.1` | FREEZE-2901 — `structureNodeMenu()` byte-identique | **Remplacée par une exigence plus forte** : les deux entrées ajoutées retirées, la fonction redevient **byte-identique** à V2.9.0.1. `toggleDrawerMenu()` et `closeDrawerMenu()` restent gelés tels quels |
| `structure-compacte-v2.9.1` | FREEZE-291 / STC-50 | `structureNodeMenu` et `structureCompactRow` passent dans la liste **déclarée** des fonctions modifiées : elles restent contrôlées, et toute fonction non déclarée qui bougerait ferait encore tomber le test |

Deux **défauts de mes propres tests** ont aussi été corrigés : un index de ligne
codé en dur, devenu faux parce que le menu plus haut recouvre davantage de lignes
(désormais calculé), et une vérification de cliquabilité qui n'amenait pas la
ligne à l'écran avant d'ouvrir son menu.

---

## 9. Captures — `recette-v2.10.0/`

| Fichier | Contenu |
|---|---|
| `01-deplacement-desktop.png` | Side-window Déplacer, destinations hiérarchiques, descendants du niveau absents |
| `02-duplication-desktop.png` | Side-window Dupliquer, nom prérempli, deux choix de contenu |
| `03-duplication-structure-seule.png` | Résultat « Structure seule » |
| `04-duplication-structure-interventions.png` | Résultat « Structure + interventions » |
| `05-mobile-430-deplacer.png` | Déplacer en 430 px |
| `06-mobile-390-dupliquer.png` | Dupliquer en 390 px |
| `07-duplication-dark.png` | Thème sombre |
| `08-arborescence-apres-duplication.png` | L'arbre après duplication |
| `09-undo.png` / `10-redo.png` | Annulation et rétablissement |

---

## 10. Critères de validation (§39)

| # | Critère | Résultat |
|---|---|---|
| 1 | Un niveau peut être déplacé | ✅ |
| 2 | Sa descendance suit | ✅ STR-OP-04 |
| 3 | Ses interventions restent intactes | ✅ STR-OP-05 |
| 4 | Aucun cycle possible | ✅ garde métier, STR-OP-08/09 |
| 5 | Undo/Redo fonctionne | ✅ STR-OP-11/12 |
| 6 | Un niveau peut être dupliqué | ✅ |
| 7 | Toute sa sous-structure est copiée | ✅ DUP-02 |
| 8 | Les interventions sont optionnelles | ✅ DUP-05/06 |
| 9 | Les IDs sont nouveaux | ✅ DUP-03 |
| 10 | Les relations internes sont remappées | ✅ DUP-04/07/12 |
| 11 | Aucun ancien ID utilisé par erreur | ✅ DUP-13 |
| 12 | Les agrégats sont corrects | ✅ STR-OP-07, DUP-18 |
| 13 | « Sans structure » reste intact | ✅ DUP-21 |
| 14 | Aucun retour vers Aujourd'hui | ✅ STR-OP-13 |
| 15 | Mobile fonctionne | ✅ DUP-24/25 |
| 16 | Dark mode fonctionne | ✅ DUP-23 |
| 17 | Backup/restore fonctionne | ✅ DUP-22 |
| 18 | Planning sans régression | ✅ 123 moteurs byte-identiques |
| 19 | Drag & drop Planning fonctionne | ✅ `planning-draw-create` 54/0 |
| 20 | Création sur la frise fonctionne | ✅ idem |
| 21 | Console sans erreur | ✅ 0 |
