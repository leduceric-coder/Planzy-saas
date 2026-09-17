# Rapport — Kanvix V2.9.0 · Structure de chantier et pilotage multi-niveaux

**Fichier livré** : `public/poc/kanvix-next-gen-v2.9.0.html` (27 878 lignes, monolithe HTML/CSS/JS, aucune dépendance ajoutée)
**Source** : `public/poc/kanvix-next-gen-v2.8.5.2.html` (26 804 lignes)
**Recette dédiée** : `recette-structure-projet-v2.9.0.mjs` — **80 / 80 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.9.0/` — 16 captures nommées + 20 captures largeur × thème + `resultats.json` (37 fichiers, 4,9 Mo)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

**Recettes historiques : 49 rejouées contre V2.9.0 — `RESTE : 0`.**
Aucune nouvelle régression historique inexpliquée. 262 échecs subsistent, tous
déjà présents au référentiel V2.8.5.2 (267) : **5 de moins qu'avant**, aucun de plus.
Les 20 recettes re-basées sont détaillées au § 17, assertion par assertion.

---

## 1. Ce que V2.9.0 ajoute, en une phrase

Un chantier peut désormais être découpé en **niveaux** (bâtiments, zones, phases,
sous-projets), chaque tâche peut être rattachée à un niveau, et chaque niveau se
pilote comme un mini-chantier — **sans qu'aucun moteur métier ne soit dupliqué**.

---

## 2. Le modèle de données — `app.structureNodes`

Une seule collection, plate, avec un `parentId` générique. La hiérarchie n'est
jamais stockée en arbre : elle est **dérivée**, ce qui rend impossible la
désynchronisation entre un parent et ses enfants.

```js
{
  id: "sn-keravel-rdc",
  projectId: "keravel",              // un niveau n'existe QUE dans un chantier
  parentId: "sn-keravel-bat-a",      // null = racine
  name: "RDC",
  type: "zone",                      // building | zone | phase | subproject | other
  description: "",
  responsibleResourceId: "mathieu",  // PERSONNES uniquement (pas un engin, pas une équipe)
  archived: false,
  createdAt, updatedAt,
}
```

Les cinq types sont déclarés une fois pour toutes, juste avant `SCHEMA_VERSION` :

```js
const STRUCTURE_TYPES = [
  ["building", "Bâtiment"], ["zone", "Zone"], ["phase", "Phase"],
  ["subproject", "Sous-projet"], ["other", "Autre"],
];
const structureTypeLabel = (t) => (STRUCTURE_TYPES.find((x) => x[0] === t) || STRUCTURE_TYPES[4])[1];
```

**Côté tâche**, un seul champ : `task.structureNodeId` (`null` par défaut).
Il est **indépendant du lot** : une tâche peut avoir un lot sans niveau, un
niveau sans lot, les deux, ou aucun des deux. Les données de démonstration le
prouvent — les cinq tâches rattachées à un niveau conservent toutes leur lot
d'origine, inchangé.

---

## 3. La migration V12 → V13

`SCHEMA_VERSION` passe de **12 à 13**. **`STORE` reste `"kanvix-product-8-3"`** —
c'est la seule valeur strictement figée, car la changer ferait perdre leurs
données aux utilisateurs existants.

La migration est **additive, non destructive et idempotente**, en quatre temps :

| # | Règle | Effet |
|---|-------|-------|
| 0 | `structureNodes` absent → `[]` | Un état V12 devient un état V13 **sans structure**, donc identique à ce qu'il était |
| 1 | Normalisation champ par champ ; nœud dont le `projectId` n'existe pas → **rejeté** | Aucun nœud fantôme, `type` inconnu ramené à `other` |
| 2 | `parentId` inconnu, ou pointant vers un **autre chantier**, ou vers soi-même → `null` | Une structure ne traverse jamais deux chantiers |
| 3 | **Cycles cassés de façon déterministe** : le premier nœud qui reboucle en remontant est ramené à la racine | Deux exécutions sur la même donnée produisent le **même** arbre |
| 4 | `task.structureNodeId` absent / inconnu / d'un autre chantier → `null` | Jamais de référence orpheline |

Repasser `migrateState()` sur un état déjà migré ne crée, ne supprime et ne
déplace rien : vérifié par **ST-02** (idempotence) et **ST-69 / ST-70**
(réparation d'un état volontairement corrompu : parent croisé, cycle, tâche
rattachée à la structure d'un autre chantier).

Trois clés d'**interface** (et non de métier) sont également posées :
`ui.collapsedStructure`, `ui.structureNodeId`, `ui.structureTab`,
`ui.planningStructure`. Elles ne participent à aucun calcul.

---

## 4. Le moteur — 39 fonctions ajoutées, 0 supprimée, une seule vérité

Tout le calcul de la structure vit dans un bloc unique, inséré avant
`getProjectHealth()`, et **chaque vue y passe** :

```
/* ================= V2.9.0 — MOTEUR STRUCTURE ========================
   UNE seule vérité pour la hiérarchie et ses agrégations. Toutes les
   vues — arbre, fiche de niveau, Planning, Ressources, Qualité — passent
   par ces helpers. Aucun moteur parallèle n'est créé : les ressources
   viennent de taskResourceIds(), la qualité de pendingControlsForTask(),
   les points d'attention de app.issues, les dates des tâches. */
```

**Hiérarchie** : `structureNode`, `getStructureNode`, `getProjectStructure`,
`projectHasStructure`, `getStructureChildren`, `getStructureRoots`,
`getStructureDescendantIds`, `getStructureAncestors`, `structurePath`.
**Rattachement** : `getStructureTasks`, `getUnstructuredTasks`.
**Agrégation** : `getStructureDates`, `getStructureProgress`,
`getStructureResources`, `getStructureIssues`, `getStructureControls`,
`getStructureMilestones`, `getStructureStatus`.
**Garde-fous** : `structureParentError`, `structureParentOptions`.
**Mutations** : `openStructureForm`, `toggleStructureArchive`,
`confirmDeleteStructure`, `deleteStructureNode`, `openStructureNode`.
**Vues** : `projectStructureTab`, `renderStructureNode`, `structureTabContent`,
`structureSelect`, `planningStructureSelect`.

Vues auxiliaires : `structureSummaryLine`, `structureNodeCard`,
`structureNodeMenu`, `projectStructureNote`, `setStructureTab`,
`toggleStructureNode`, `closeStructureNode`, `structureArchiveBlocker`,
`structureDeleteBlocker`.

Le diff des déclarations entre V2.8.5.2 et V2.9.0 donne exactement
**39 fonctions ajoutées et 0 supprimée** — et les 39 portent « structure » dans
leur nom : aucune fonction généraliste n'a été créée au passage. FREEZE-290
vérifie nommément la présence des 28 qui constituent le cœur du moteur et de ses
vues (`manquantes: []`).

`getStructureDescendantIds()` est un **parcours en largeur** avec garde dure à
5 000 itérations : même sur une donnée importée pathologique, il ne peut pas
boucler.

---

## 5. L'agrégation parent ← enfants

Elle ne stocke **rien**. Un parent lit les tâches de toute sa descendance
(`getStructureTasks` inclut les descendants par défaut) et agrège :

* **Dates** : `min(start)` / `max(end)` des tâches du périmètre — jamais saisies.
* **Avancement** : ratio simple de tâches terminées sur le périmètre.
* **Ressources** : `getStructureResources()` **appelle `taskResourceIds()`**, le
  moteur de V2.5.0. Aucune règle de ressource n'est réécrite.
* **Qualité** : `getStructureControls()` **appelle `pendingControlsForTask()`**,
  le moteur de V2.7.0.
* **Points d'attention** : lus dans `app.issues` par les tâches du périmètre.
* **Jalons** : lus par les tâches du périmètre.

**Conséquence vérifiée (ST-12 → ST-19)** : ajouter deux points d'attention au
RDC en ajoute exactement deux à Bâtiment A (son parent) et **zéro** à la zone
Extérieurs (sa voisine). L'assertion est écrite en **delta mesuré**, pas en
valeur absolue — les données de démonstration portent déjà des points
d'attention, et une valeur absolue aurait été un faux test.

**Le statut de synthèse** est dérivé de vérités qui existaient déjà, dans un
ordre de gravité décroissant, sans aucun nouveau seuil inventé :

```js
if (!ts.length)                                     → « Aucun élément »
if (issue critique)          ou (tâche en retard)   → « À traiter »      (danger)
if (issue)                   ou (tâche en attente)  → « À surveiller »   (warning)
if (contrôle en attente)                            → « Contrôle à faire » (warning)
if (tâche en cours)                                 → « En cours »       (accent)
sinon                                               → « Dans les temps » (success)
```

---

## 6. L'intégration Planning — **le point central du round**

C'est ici que le risque de duplication était maximal. Il a été évité en ajoutant
un **quatrième axe de filtrage** à `planningTasks()`, qui est depuis V2.8.0 le
**point de filtrage unique** du Gantt :

```js
structureIds = Array.isArray(opts.structureNodeIds) ? new Set(opts.structureNodeIds) : null,
…
(!structureIds || structureIds.has(t.structureNodeId))
```

Le Gantt d'un niveau est donc **le `gantt()` existant**, appelé avec un périmètre :

```js
gantt(n.projectId, {
  structureNodeIds: getStructureDescendantIds(nodeId),
  structureNodeId: nodeId,
  resourceFilter: "all", lotFilter: "all",
})
```

Un **filtre de niveau** est ajouté dans la barre d'outils du Planning global, à
côté du filtre de lot (`planningStructureSelect()`), avec la valeur spéciale
« Sans niveau ». Il est neutralisé automatiquement quand le Planning est déjà
contraint par une Opération ou par un périmètre explicite — un filtre d'interface
ne peut jamais élargir un périmètre métier.

**Aucun second moteur n'existe.** FREEZE-290 le vérifie mécaniquement :
`unSeulGantt`, `unSeulPlanningTasks`, `unSeulTaskResourceIds`,
`unSeulSetTaskStatus`, `pasDeMoteurStructure` — une seule définition de chacun
dans tout le fichier.

**Le drag reste temporel.** Déplacer une barre change ses dates, jamais son
niveau ; le rattachement se modifie uniquement dans le formulaire. Vérifié par
ST-36 et par la recette V2.8.5.2 rejouée (déplacement et création à la souris
intacts en Essentiel comme en Pilotage).

**La création à la souris transporte le contexte** : la ligne de création porte
`data-create-structure`, `planningCreatePointerUp()` le lit et le passe en
préremplissage — et ce préremplissage **reste modifiable**.

---

## 7. Le formulaire de tâche

Un champ **« Structure / zone »** s'intercale **entre Chantier et Lot** : la
structure dit **où** sur le chantier, le lot dit **quel corps d'état**, et la
lecture va du lieu au métier. Les options affichent le **chemin complet**
(`Bâtiment A › Étage 1`) ; les niveaux archivés sont exclus, **sauf** celui qui
est déjà affecté à la tâche en cours d'édition — on ne fait jamais disparaître
silencieusement une donnée existante.

À la soumission, la même prudence que pour le lot :

```js
structureNodeId: (() => {
  let v = f.get("structureNodeId"), n = structureNode(v);
  return n && n.projectId === f.get("projectId") ? v : null;
})(),
```

Changer de chantier dans le formulaire ne peut donc pas laisser une tâche
rattachée au niveau d'un autre chantier.

---

## 8. Les vues

* **Onglet « Structure »** sur la fiche chantier, présent **aux deux niveaux**
  (Essentiel et Pilotage) : arbre repliable, statut de synthèse, dates
  agrégées, avancement, nombre de tâches, responsable.
* **Fiche de niveau** avec fil d'Ariane (`Chantier › Bâtiment A › Étage 1`) et
  quatre onglets : **Résumé · Planning · Ressources · Sous-niveaux**.
* **Création / édition** en panneau latéral, avec choix du parent filtré par
  `structureParentOptions()`.
* **État vide** explicite pour un chantier non structuré : le chantier continue
  de fonctionner exactement comme avant, la structure est une **option**.
* **Chantier partiellement structuré** : état normal, `getUnstructuredTasks()`
  expose les tâches sans niveau, elles restent visibles partout.

---

## 9. Où l'emplacement apparaît ailleurs

* **Fiche de tâche** (`openTask`) : le chemin sous le nom du chantier, seulement
  s'il existe.
* **Mode Chantier** : même chemin dans l'en-tête de la tâche, même règle.
* **Aujourd'hui** : l'emplacement suit la tâche, sans réorganiser la vue.
* **Opération** : une **mention discrète** sur la carte chantier
  (`projectStructureNote()`), rien d'autre. L'architecture Opération de V2.8.0
  n'est pas réorganisée.

---

## 10. Historique et Undo/Redo

Chaque action de structure est **une transaction** : `snapshot()` avant
mutation, une entrée d'historique métier, **un seul Undo pour revenir**.

| Action | Entrée d'historique |
|--------|--------------------|
| Création d'un niveau | nom, type, parent |
| Renommage / changement de type / responsable | avant → après |
| **Changement de parent** | `de « racine » → « Bâtiment A »` (chemins lisibles) |
| Archivage / désarchivage | état |
| Suppression | nom du niveau supprimé |
| Rattachement d'une tâche | `aucune → Bâtiment A › Étage 1` |

Vérifié par ST-56 → ST-59 : un `undo()` après un changement de parent **rétablit
l'arbre complet**, et le `redo()` le rejoue.

---

## 11. Les garde-fous

* **Cycle impossible** — `structureParentError()` refuse : un autre chantier, un
  parent inexistant, soi-même, **et tout descendant de soi-même**. Le message est
  affiché, la mutation n'a pas lieu. La migration casse en plus les cycles déjà
  présents dans une donnée importée.
* **Archivage bloqué** tant qu'un sous-niveau actif existe (`structureArchiveBlocker`).
* **Suppression possible uniquement si le niveau est vide** — ni tâche, ni
  sous-niveau (`structureDeleteBlocker`). Le blocage est expliqué, pas subi.
* **Performance** — toutes les agrégations passent par des `Map` / `Set`
  construits une fois par appel ; `getStructureDescendantIds()` est un BFS borné.

---

## 12. Données, sauvegarde, import

* **Sauvegarde Kanvix** : `buildKanvixBackup()` clone l'état complet, donc
  `structureNodes` voyage **sans que le format ait besoin d'être élargi**. Le
  résumé de restauration annonce désormais « N niveaux de structure ».
* **Restauration d'une sauvegarde ANCIENNE** (sans structure) : acceptée,
  migrée vers 13, `structureNodes = []`, toutes les tâches à `structureNodeId: null`.
  **Aucun niveau rétroactif n'est inventé.**
* **« Remplacer tous les chantiers »** : les niveaux sont supprimés **et
  l'annonce le dit** (`dropped.structureNodes`).
* **Import d'un chantier existant** : les niveaux de ce chantier sont remplacés,
  ceux des autres chantiers sont intacts.
* **Export portable** : volontairement **non élargi** — il reste un export de
  planning. `structureNodes` n'est pas dans ses clés obligatoires (vérifié par
  FREEZE-290).

---

## 13. Niveaux Essentiel / Pilotage

L'onglet Structure, l'arbre, la fiche de niveau, le Planning de niveau et
l'édition sont disponibles **aux deux niveaux**. Conformément au contrat
rétabli en V2.8.5.2, c'est **`canEditPlanning = !readOnly`** qui garde l'édition,
jamais le niveau. Le niveau Essentiel garde son interface simple (pas de barre
d'analyse, pas de baseline), pas moins de pouvoir.

---

## 14. Responsive et thème sombre

Vérifié sur **10 largeurs** (1920, 1600, 1440, 1280, 1080, 1024, 900, 768, 600,
360), en clair **et** en sombre : **aucun débordement horizontal**. Sur mobile
l'arbre devient une liste à retrait, la fiche de niveau empile ses onglets, et
le Planning de niveau conserve son défilement horizontal propre. Les couleurs
utilisent exclusivement les variables de thème existantes — **aucune couleur
codée en dur** n'a été introduite.

---

## 15. Erreurs console

**0 erreur JavaScript applicative** sur l'intégralité de la recette dédiée
(ST-75), et sur chacune des 49 recettes historiques rejouées.

> Note d'outillage : deux « erreurs » console apparues pendant la campagne
> (`unsupported MIME type ('application/octet-stream')`) venaient du **serveur
> statique de test** du bac à sable, pas du produit. Le serveur a été corrigé
> pour servir les bons types MIME ; la recette `backup-continuite` est repassée
> de 105/2 à **106/0**. Aucune ligne du produit n'a été touchée pour cela.

---

## 16. La recette dédiée — `recette-structure-projet-v2.9.0.mjs`

**80 assertions, 80 PASS, 0 erreur console.**

| Section | Couverture |
|---------|------------|
| **ST-MIGRATION** (01, 02, 69, 70) | Schéma 13, STORE inchangé, idempotence, réparation d'un état corrompu |
| **ST-HIERARCHIE** (03 → 11) | Création, parent, chemin, racines, descendance, ancêtres, cycles refusés |
| **ST-AGREGATION** (12 → 19) | Dates, avancement, ressources, qualité, points d'attention, jalons, statut — **en delta mesuré** |
| **ST-TACHES** (20 → 28) | Champ du formulaire, ordre, indépendance lot/structure, références orphelines |
| **ST-PLANNING** (29 → 39) | Gantt de niveau, filtre global, « Sans niveau », drag temporel, création à la souris, chantier partiellement structuré |
| **ST-PILOTAGE** (40 → 49) | Fiche de niveau, onglets, fil d'Ariane, archivage, suppression, blocages |
| **ST-DONNEES** (50 → 55) | Sauvegarde, restauration ancienne, remplacement total, import |
| **ST-UNDO** (56 → 59) | Une action = une transaction, Undo/Redo du changement de parent |
| **ST-NIVEAUX** (60 → 63) | Essentiel et Pilotage, édition gardée par `canEditPlanning` |
| **ST-RESPONSIVE** (64 → 68) | 10 largeurs × 2 thèmes, aucun débordement |
| **ST-NONREG** (71 → 74) | Jours non ouvrés, démarrage réel, création à la souris, déplacement : intacts |
| **CAPTURES** | 16 états nommés |
| **FREEZE-290** | **80 moteurs byte-identiques**, 28 fonctions ajoutées, un seul moteur par concern |

Les tests manipulent de **vrais gestes** (`dragTo()`, `mouse.down/move/up`),
jamais des appels directs aux fonctions internes quand un geste est possible.

---

## 17. Les recettes historiques — 49 rejouées, `RESTE : 0`

### Méthode

Chaque recette historique est rejouée **contre V2.9.0** (sa référence de version
maximale est réécrite vers `v2.9.0` dans un bac à sable ; **aucun fichier suivi
n'est modifié par la campagne**), puis comparée **assertion par assertion** au
référentiel de V2.8.5.2. Le verdict n'est pas un total, c'est un **écart** :

```
ECHECS V2.9.0 : 262   |  ECHECS RÉF V2.8.5.2 : 267
RESTE : 0
```

`RESTE` compte les échecs **présents en V2.9.0 et absents du référentiel**.
Il vaut **0** : V2.9.0 n'introduit aucune régression historique, et en corrige 5.

Les 20 recettes re-basées ont ensuite été rejouées **contre leur propre version
d'origine** : 19 passent à **0 échec**. La seule exception,
`recette-planning-draw-create-v2.8.5.mjs`, conserve 2 assertions
(DTC-05, FREEZE-285) re-basées **en V2.8.5.2** vers le contrat actuel — elles
décrivent un produit postérieur à V2.8.5 et ne peuvent donc pas valoir contre
lui. C'est un choix assumé du round précédent, pas un effet de V2.9.0.

### Tableau de justification

| Recette | Assertion | Cause | Catégorie | Action |
|---------|-----------|-------|-----------|--------|
| `controles-qualite-v2.7.0` | FREEZE-270 | `planningTasks` étendue (§18) | **Contrat obsolète** | Retirée de la liste de gel, avec justification en commentaire |
| `correctifs-v2.4.15.4` | FREEZE/ENGINES-1514 | `openTask` affiche l'emplacement (§31) | **Contrat obsolète** | Retirée de la liste de gel ; **maintenue** dans la liste « doit avoir changé » |
| `correctifs-v2.4.15.6` | FREEZE-1516 | `planningTasks` étendue | **Contrat obsolète** | Retirée de la liste de gel |
| `correctifs-v2.7.1` | FREEZE-271 (gel) | `planningTasks`, `migrateState`, `applyImportPlan` | **Contrat obsolète** | Retirées de la liste de gel |
| `correctifs-v2.7.1` | FREEZE-271 (schéma) | Schéma 11 → 13 | **Contrat obsolète** | `schema === 11` → **`schema(cur) ≥ schema(prev) ∧ ≥ 11`** (monotonie, sévérité inchangée) |
| `finitions-ui-v2.6.1` | FREEZE-261 | idem + `applyImportPlan`, `migrateState` | **Contrat obsolète** | Retirées de la liste de gel |
| `frise-jalons-v2.8.3` / `v2.8.3.1` | FREEZE-283 (gel + schéma) | `planningTasks`, `applyImportPlan`, `migrateState`, `operationProjectCard` | **Contrat obsolète** | Listes de gel réduites aux moteurs réellement figés ; schéma en monotonie |
| `harmonisation-ux-v2.8.1` | FREEZE-281 | idem | **Contrat obsolète** | Idem ; `operationProjectCard` **restauré** dans la liste « ajoutées » après une suppression trop large |
| `jalons-statuts-v2.8.3.1` | FREEZE-2831 + STAT-17 | idem | **Contrat obsolète** | Idem ; libellé STAT-17 corrigé pour dire la vérité (« ne recule jamais sous 12 ») |
| `jalons-timeline-v2.8.2` | FREEZE-282 | idem | **Contrat obsolète** | Idem |
| `lots-v2.6.0` | LOT-10 (ordre des champs) | « Structure / zone » s'intercale (§20) | **Contrat obsolète** | Ré-écrite **sur l'ordre réel des champs** : `chantier < lot < intervenant`, **et** structure exactement entre chantier et lot quand elle existe. **Vaut pour V2.6.0 comme pour V2.9.0** |
| `lots-v2.6.0` | FREEZE-260 | `planningTasks` | **Contrat obsolète** | Retirée de la liste de gel ; **maintenue** dans `expectedChanged` |
| `non-regression-v2.6.1→v2.7` | Comparaison de la fiche de tâche | La fiche affiche l'emplacement (§31) | **Contrat obsolète** | Le **chemin seul** est neutralisé dans la comparaison ; tout le reste de la fiche reste comparé caractère par caractère |
| `operations-v2.8.0` | OP-52 (onglets de la fiche) | Onglet « Structure » ajouté (§13) | **Contrat obsolète** | Onglet **exigé** quand le moteur existe, **interdit** quand il n'existe pas. **Vaut pour V2.8.0 comme pour V2.9.0** |
| `operations-v2.8.0` | FREEZE-280 (schéma) | Schéma 12 → 13 | **Contrat obsolète** | `11 → 12` → **progression stricte** `schema(cur) > schema(prev) ∧ prev ≥ 11` |
| `planning-calendrier-realite-v2.8.5.1` | FREEZE-2851 | `planningTasks`, `applyImportPlan`, `migrateState`, `planningCreatePointerUp` | **Contrat obsolète** | Retirées de la liste de gel ; STORE toujours strictement vérifié |
| `planning-draw-create-v2.8.5` | FREEZE-285 / DTC-45 | idem + schéma | **Contrat obsolète** | Idem ; `planningCreatePointerUp` **restauré** dans la liste « ajoutées » après une suppression trop large |
| `planning-edition-v2.8.5.2` | FREEZE-2852 (gel) | `openTaskForm` (§21), `renderPlanning` (§18), `planningCreateRow` (§22) | **Contrat obsolète** | Retirées de la liste de gel **après relecture ligne à ligne des trois diffs** : ils ne contiennent que la structure |
| `planning-edition-v2.8.5.2` | FREEZE-2852 (schéma) | Schéma 12 → 13 | **Contrat obsolète** | STORE **strictement inchangé** ; SCHEMA_VERSION **jamais régressif** |
| `prochain-jalon-v2.8.3.2` | FREEZE-2832 / NEXT-16 | idem | **Contrat obsolète** | Idem |
| `ressources-disponibilites-v2.5.0` | FREEZE-250 | `planningTasks` | **Contrat obsolète** | Retirée de la liste de gel ; **maintenue** dans `expectedChanged` |
| `undo-redo-v2.8.4` / `undo-redo-ui-v2.8.4.1` | FREEZE-284 / UR-01 | `planningTasks`, `migrateState`, `applyImportPlan` | **Contrat obsolète** | Idem ; `migrateState` **maintenue** dans la liste autorisée à évoluer |

**Aucune ligne de la colonne « Catégorie » ne porte « Régression produit ».**
Chaque assertion re-basée a été **re-pointée** vers le nouveau contrat avec la
même sévérité — aucune n'a été supprimée, aucune n'a été affaiblie.

### Six affaiblissements détectés et annulés

Un passage de re-baseline trop large avait retiré des noms de fonctions de
listes qui **ne sont pas** des listes de gel. Chacun a été restauré et la
recette rejouée pour vérifier que la restauration ne coûte rien :

| Recette | Liste | Nom retiré à tort | Restauré |
|---------|-------|-------------------|----------|
| `backup-continuite-v2.4.13.1` | `enginesPresent` (« ces moteurs existent ») | `applyImportPlan` | ✅ 106/0 |
| `correctifs-v2.4.15.4` | `changed` (« ces fonctions ont bien changé ») | `openTask` | ✅ 87/0 |
| `lots-v2.6.0` | `expectedChanged` | `planningTasks` | ✅ 131/0 |
| `ressources-disponibilites-v2.5.0` | `expectedChanged` | `planningTasks`, `applyImportPlan` | ✅ 105/0 |
| `operations-v2.8.0` | `changed` (périmètre examiné) | `planningTasks`, `migrateState`, `applyImportPlan` | ✅ 71/0 |
| `undo-redo-v2.8.4` | `attendu` (autorisées à évoluer) | `migrateState` | ✅ 62/0 |

Quatre libellés d'assertions qui affirmaient encore « SCHEMA_VERSION **reste à
12** » alors que l'assertion vérifiait désormais « ≥ 12 » ont par ailleurs été
réécrits pour **dire ce qu'ils vérifient réellement** (DTC-45, NEXT-16, STAT-17,
UR-01). Un test qui ment sur ce qu'il teste est un test qu'on finit par croire à
tort.

---

## 18. Preuve qu'aucun second moteur Planning n'a été créé

FREEZE-290, dans la recette dédiée, vérifie **mécaniquement** sur le source livré :

```
{"unSeulGantt":true, "unSeulPlanningTasks":true, "unSeulTaskResourceIds":true,
 "unSeulSetTaskStatus":true, "pasDeMoteurStructure":true, "pasDeRisquePersiste":true,
 "schema":true, "store":true, "pasDansObligatoires":true}
```

* une seule définition de `gantt()`, `planningTasks()`, `taskResourceIds()`, `setTaskStatus()` ;
* **aucun** moteur Planning, Ressources ou Risque parallèle ;
* **aucun statut de risque persisté** — tout est dérivé ;
* `SCHEMA_VERSION = 13`, `STORE = "kanvix-product-8-3"` ;
* `structureNodes` **hors** des clés obligatoires du backup portable.

Et **80 moteurs de V2.8.5.2 sont byte-identiques** (`bougés: []`) : Undo/Redo,
propagation, déplacement, création à la souris, jours non ouvrés, démarrage réel,
Qualité, Ressources, Jalons, Opérations, Backup et Mode Chantier n'ont **pas une
ligne de différence**.

---

## 19. Fichiers livrés

| Fichier | État |
|---------|------|
| `public/poc/kanvix-next-gen-v2.9.0.html` | **Nouveau** — le produit complet |
| `recette-structure-projet-v2.9.0.mjs` | **Nouveau** — 80 assertions |
| `recette-v2.9.0/` | **Nouveau** — 37 fichiers (16 captures nommées, 20 largeur × thème, `resultats.json`) |
| `RAPPORT-V2.9.0.md` | **Nouveau** — ce document |
| 20 recettes historiques | **Modifiées** — re-baseline documentée au § 17, fichiers complets |
| `recette-backup-continuite-v2.4.13.1.mjs` | **Inchangée** — son unique modification a été annulée (§ 17) |

---

## 20. Résultat

| Critère | Cible | Mesuré |
|---------|-------|--------|
| Recette dédiée | 100 % | **80 / 80** |
| Erreurs console applicatives | 0 | **0** |
| Nouvelles régressions historiques inexpliquées | 0 | **0** (`RESTE : 0`) |
| Moteurs V2.8.5.2 byte-identiques | tous | **80 / 80** |
| `STORE` | inchangé | **`kanvix-product-8-3`** |
| `SCHEMA_VERSION` | 12 → 13 | **13**, migration additive et idempotente |
| Dépendances ajoutées | 0 | **0** — monolithe HTML/CSS/JS |
