# KANVIX V2.12.0 — CONDITIONS DE DÉMARRAGE

**Source** `public/poc/kanvix-next-gen-v2.11.0.3.html`
**Livrable** `public/poc/kanvix-next-gen-v2.12.0.html` — 31 365 lignes, 1 396 575 octets
**Recette dédiée** `recette-conditions-demarrage-v2.12.0.mjs` — **101 / 101**
**Captures** `recette-v2.12.0/` — 12 PNG + `resultats.json`
**Sweep historique** 58 recettes — **RESTE : 0**
**SCHEMA_VERSION** 14 → **15** · **STORE** `kanvix-product-8-3` (inchangé)
**Erreurs JavaScript applicatives** **0**, recette dédiée et sweep complet

---

## La question à laquelle ce round répond

Une intervention peut être parfaitement planifiée et pourtant impossible à
démarrer : la livraison n'est pas arrivée, l'accès n'est pas dégagé, le client
n'a pas validé. V2.12.0 introduit `app.prerequisites` pour répondre à **une**
question : « est-ce que tout sera prêt quand cette intervention devra
commencer ? »

La règle fondamentale que tout le round protège :

> **Kanvix détecte, explique et demande une décision humaine.
> Il ne déplace jamais automatiquement le planning.**

---

## 1 · Architecture AVANT — cartographie de V2.11.0.3

L'audit a porté sur les trois questions du cadrage (§2).

### A · Toutes les voies vers « En cours »

Le fichier ne contient **qu'une seule écriture** du statut d'une tâche :
`t.status = status` dans `setTaskStatus()`. Mesuré, pas supposé : aucune autre
affectation `*.status = "doing"` n'existe dans les 31 365 lignes.

Les points d'entrée qui y mènent sont au nombre de cinq, plus la ré-entrée de
la garde « démarrage réel » :

| Voie | Site | Appel |
|---|---|---|
| Fiche tâche — bouton « Démarrer » | `openTask()` | `setTaskStatus(id, 'doing')` |
| Kanban — glisser-déposer de colonne | `setTaskStatusFromKanban()` | `setTaskStatus(id, status, 'kanban')` |
| Éditeur universel — champ Statut | `submitTaskEdit()` | `setTaskStatus(…, 'manual-edit', …)` |
| Artisan — « Je commence » | `renderArtisan()` | `setTaskStatus(id, 'doing')` |
| Mode Chantier | passe par l'éditeur universel (`openTaskEdit(id,'field-planning')`) | idem |
| Ré-entrée après confirmation calendrier | `realStartPlan()` / `askRealStartConfirm()` | `setTaskStatus(id,'doing',origin,{…,realign:plan})` |

**Conséquence de conception :** il n'y avait pas besoin de câbler cinq gardes.
Une seule, posée dans `setTaskStatus()`, couvre les cinq voies par construction.

### B · Les voies de mutation à étendre

| Besoin | Fonction existante étendue | Aucun moteur créé |
|---|---|---|
| Suppression d'une tâche | `confirmDeleteTask()` | cascade ajoutée au filtre existant |
| Duplication de Structure | `cloneStructureTree()` (primitive V2.11) | via `mapTaches`, la table **déjà** présente |
| Capture d'un modèle | `buildProjectTemplateRecord()` | même périmètre `templateCaptureScope()` |
| Pose d'un modèle | `applyTemplateToProject()` | même primitive de clonage |
| Sauvegarde | `buildKanvixBackup()` / `confirmKanvixRestore()` | format inchangé, clé additive |
| Export portable | `exportKanvixData()` | une clé de plus |
| Import | `applyImportPlan()` | **la passe 2 existante et son `taskIdMap`** |
| Undo / Redo | `snapshot()` | aucune pile parallèle |

### C · Les moteurs lus, jamais dupliqués

`getTodayDecisions()` / `getTodayWarnings()` (les **deux** listes existantes de
l'onglet Aujourd'hui), `gantt()` + les deux autres rendus de planning,
`guardEditable()` / `canEditProject()` (la règle unique de lecture seule),
`app.history` (l'unique journal), `pill()` (le jeton de statut du produit),
`drawerForm()` (la side-window), `snapshot()` (la transaction).

### D · Les règles à ne pas contredire

- une tâche **terminée** est historique : elle n'émet plus de signal ;
- un chantier **clôturé / archivé** est en lecture seule, sans exception locale ;
- les **dépendances** et les **contrôles qualité** ont chacun leur moteur : il est
  interdit d'en recopier l'état dans une condition (§4 du cadrage).

---

## 2 · Modèle de données

`app.prerequisites = []`, collection de premier niveau. Treize champs, **et
treize seulement** — vérifié caractère par caractère par PRQ-01 :

```
id, projectId, taskId,
type, label, blocking, status,
expectedDate, confirmedDate,
supplier, comment,
createdAt, updatedAt
```

Ni quantité, ni prix, ni stock, ni bon de livraison, ni référence fournisseur
catalogue (§43 : ce n'est pas un ERP achats).

**Pas de `structureNodeId` (§22).** `taskId` permet déjà de retrouver le niveau :
une seconde vérité relationnelle pourrait diverger. PRQ-59 l'assure sur le
source du fichier.

**`projectId` n'est pas une seconde vérité non plus** : la migration le
**réaligne** systématiquement depuis la tâche. La tâche fait foi.

### Les huit types

`delivery` Livraison · `supply` Approvisionnement · `client_approval` Validation
client · `document` Document · `access` Accès · `authorization` Autorisation ·
`decision` Décision · `other` Autre.

Conformément au §4 du cadrage, **aucun type « tâche précédente » ni « contrôle
qualité »** n'a été créé : Kanvix possède déjà ces deux moteurs, et PRQ-56 /
PRQ-57 vérifient qu'ajouter une condition n'en crée, n'en modifie et n'en
convertit aucun.

---

## 3 · La vérité des statuts

Quatre statuts **persistés** : `pending` (À confirmer), `confirmed` (Confirmé),
`blocked` (Bloqué), `na` (Non applicable).

« En retard » n'est **jamais persisté**. Une seule fonction du fichier a le droit
de prononcer le mot :

```js
function prerequisiteEffectiveStatus(p, now) {
  if (!p) return "pending";
  let st = PREREQ_STATUS[p.status] ? p.status : "pending";
  if (st !== "pending" || !p.expectedDate) return st;
  let t = date(p.expectedDate);
  if (isNaN(+t)) return st;
  return t < (now || getDemoNow()) ? "late" : st;
}
```

Une condition confirmée, bloquée ou non applicable n'est jamais « en retard » :
son sort est déjà tranché. PRQ-11 vérifie que le passage du temps change
l'affichage **sans écrire un octet** en base.

Priorité d'affichage, déclarée une fois dans `PREREQ_PRIORITY` :
`blocked > late > pending > confirmed > na`.

`prerequisiteIsSatisfied()` retient `confirmed` **et** `na` : déclarer qu'une
condition ne s'applique pas est une décision, pas un oubli.

### Blocage

`blocking` vaut `true` par défaut à la création (§6). Une condition non
bloquante reste visible, peut produire une surveillance, et n'empêche rien —
PRQ-13.

---

## 4 · Couche métier pure — une seule vérité

Neuf helpers, aucun effet de bord : ils ne mutent rien, n'écrivent pas
d'historique, ne touchent pas à l'écran. **Les écrans les lisent ; ils ne
réimplémentent jamais la règle.**

| Helper | Réponse |
|---|---|
| `taskPrerequisites(taskId)` | les conditions, dans l'ordre où elles comptent (bloquantes d'abord, puis priorité d'état, puis date) |
| `projectPrerequisites(projectId)` | le périmètre d'un chantier |
| `prerequisiteEffectiveStatus(p, now)` | **la seule** source de « late » |
| `prerequisiteIsSatisfied(p)` | ce qui ne retient plus rien |
| `taskBlockingPrerequisites` / `taskUnresolvedPrerequisites` | les deux sous-ensembles |
| `taskStartReadiness(taskId)` | `{ ready, blocking[], warnings[], all[] }` |
| `prerequisiteIsLateForTask(p)` | §11 — la livraison attendue **après** le démarrage |
| `taskPrerequisiteSummary(taskId)` | « 2 / 3 confirmées » |
| `taskTopPrerequisite(taskId)` | la condition à montrer quand il n'y a de place que pour une |
| `taskNeedsPrerequisiteAttention(taskId)` | §13 + §16 : `false` sur une tâche terminée, `false` quand tout est satisfait |

L'ordre de tri est **dans** `taskPrerequisites()` : ni le résumé, ni la fiche, ni
le Mode Chantier, ni la confirmation de démarrage ne retrient quoi que ce soit.

Coût (§41) : chaque helper est un `filter` sur une collection qui compte quatre
entrées en démonstration. Aucune boucle imbriquée, aucun rescan de l'historique
ou des ressources, aucun cache persisté.

---

## 5 · La logique de démarrage — une garde, cinq portes

La garde est posée **dans `setTaskStatus()`**, avant `realStartPlan()` :

```js
if (status === "doing" && !silent && !opts.forcePrerequisites
    && !taskStartReadiness(id).ready) {
  askPrerequisiteStartConfirm(id, origin, opts);
  return;
}
```

Trois propriétés qui comptent :

1. **rien n'est écrit tant que la décision n'est pas prise.** Le `return` précède
   toute mutation ; PRQ-18 mesure le statut *pendant* que la modale est ouverte.
2. **la décision revient par le moteur central.** `confirmPrerequisiteStart()`
   ré-appelle `setTaskStatus()` avec `forcePrerequisites: true` : la suite du
   parcours — démarrage réel, contrôles qualité, historique, propagation — est
   rigoureusement celle d'un démarrage ordinaire.
3. **la garde est un passage, pas un mur.** `confirmPrerequisiteStart()`
   **retourne** l'`outcome` du moteur : l'appelant garde l'information
   exploitable que V2.7.1 avait introduite.

La modale réutilise la modale du produit — aucun composant nouveau :

```
Conditions non confirmées
Cette intervention comporte 1 condition bloquante non confirmée.
  • Livraison des fenêtres — À confirmer · prévue mar. 18 août
Démarrer n'a aucun effet sur ces conditions : elles resteront à confirmer.
                                        [Annuler]  [Démarrer quand même]
```

Après « Démarrer quand même » :

- la tâche passe en cours ;
- **aucune condition n'est confirmée automatiquement** (PRQ-20) ;
- l'historique porte `« Intervention démarrée malgré 1 condition non confirmée. »` ;
- **aucun incident n'est fabriqué** — mesuré en **delta** avant/après, pas en
  valeur absolue (PRQ-21).

---

## 6 · Cohérence date / planning (§11)

`prerequisiteIsLateForTask()` détecte une livraison attendue **après** le début
de l'intervention. Ce n'est pas une erreur de saisie : c'est une situation
réelle, et l'enregistrement n'est **pas** refusé. La side-window l'explique :

> ⚠ Une condition est attendue après le démarrage de l'intervention (ven. 21
> août). **Le planning n'a pas été modifié — à vous de décider.**

PRQ-15 vérifie qu'après cet enregistrement la tâche a **exactement** la même
date de début, la même fin, les mêmes dépendances et la même baseline, et que la
date de la condition n'a pas été « corrigée » non plus.

---

## 7 · Les écrans

### Fiche tâche (§8)

Un bloc compact : le résumé, la condition prioritaire, `+ N autres`, et
« Gérer les conditions ». Jamais la liste entière — c'est le rôle de la
side-window. Pas de page, pas d'entrée de sidebar (§42, vérifié par FREEZE-2120).

### Side-window (§9, §10)

Tout s'y fait : voir, ajouter, modifier, confirmer, signaler bloqué, repasser à
confirmer, déclarer non applicable, supprimer. Le formulaire porte les six
champs demandés — type, libellé, bloquant (deux radios), date prévue,
fournisseur, commentaire — chacun avec son label.

`prerequisiteChip()` **réutilise `pill()`**, le jeton de statut du produit. Un
`.prq-pill` maison n'aurait pas hérité de la règle `body.dark .pill.danger,
.pill.warning, .pill.success { color: #fff }` — les jetons `--*-ink` ne sont
définis qu'en clair. Le mode sombre aurait été illisible.

### Aujourd'hui (§14, §15)

**Aucun second système d'alertes.** Les conditions entrent dans les **deux**
fonctions existantes :

```js
getTodayDecisions(...).concat(prerequisiteDecisionItems())
getTodayWarnings(...).concat(prerequisiteWarningItems())
```

Horizon opérationnel : `PREREQ_SOON_DAYS = 7`. Une condition située à plusieurs
mois ne remonte pas (PRQ-24). Chaque alerte propose « Gérer les conditions » et
« Voir la tâche », et conduit **directement** à la side-window de la bonne
intervention — aucune page intermédiaire (PRQ-25).

PRQ-53 vérifie que les six incidents de démonstration restent six : les
conditions n'en créent aucun.

### Planning (§16)

`planningPrerequisiteMeta(t)` ajoute une **métadonnée dans le libellé existant** —
pas une ligne de plus — aux **trois** rendus de planning
(`gantt`, `projectToday`, `projectUpcomingTimeline`) : une seule vérité, appliquée
partout, et la recette assert que le site d'insertion apparaît exactement trois
fois.

**Silence quand tout va bien** : une intervention prête, sans condition, ou
porteuse d'une seule condition non bloquante dans les temps n'affiche rien
(PRQ-26, mesuré sur les quatre cas).

### Kanban (§17)

**Non touché.** PRQ-27 mesure qu'aucun badge historique (À TRAITER, À SUIVRE,
SOUS IMPACT, POINT OUVERT) n'est détourné, et qu'aucun moteur de badge ne
mentionne les conditions.

### Mode Chantier et Artisan (§18)

Le **conducteur** voit le compteur, la condition prioritaire, et trois actions
rapides — Confirmer, Bloqué, Gérer — qui agissent **sans sortir du Mode
Chantier**. Quand tout est prêt : « ✓ Conditions prêtes », et rien de plus.

L'**artisan** n'est pas le Mode Chantier : `isFieldMode()` l'exclut
explicitement. Son écran est la **conversation**. C'est donc là que le bloc a été
posé — dans la carte mission — en **réutilisant tel quel**
`fieldTaskPrerequisitesSummary()`, qui porte déjà la règle « le conducteur agit,
l'artisan lit ». Il n'y a pas deux endroits où cette règle peut diverger.

Le bloc n'apparaît **que** s'il y a quelque chose à dire, et disparaît dès que
tout est confirmé : la conversation reste une conversation (PRQ-29, les deux
versants mesurés).

Et « Je commence » — la cinquième porte — passe par la **même** garde : PRQ-29
clique réellement le bouton et vérifie que la modale s'ouvre et que le statut
n'a pas bougé.

### Chantier clôturé (§19)

Les quatre mutations sont refusées par `guardEditable()`. **Aucune exception
locale.** Les conditions restent consultables, la side-window affiche le bandeau
lecture seule et ne propose aucune action (PRQ-30).

---

## 8 · Suppression, Structure, modèles

### Cascade (§20)

`confirmDeleteTask()` filtre `app.prerequisites` **dans la transaction
existante**. Un geste = un `snapshot()` = un Undo. PRQ-31 / PRQ-32 : 11 tâches /
4 conditions → 10 / 2 (0 orphelin) → Undo restitue 11 / 4 **avec les mêmes
identifiants** → Redo resupprime.

### Duplication de Structure (§23, §26)

Les conditions sont reconstruites **dans** `cloneStructureTree()`, avec la table
`mapTaches` **déjà existante** :

```js
clonesParOrigine = new Map(tasksIn.map((t, i) => [t.id, taches[i]]))
```

- « Structure seule » → 0 tâche, donc 0 condition, mécaniquement ;
- « Structure + interventions » → les 3 conditions du périmètre, **toutes**
  remappées vers les nouvelles tâches, **aucune** vers la source.

FREEZE-2120 mesure que la primitive reste **unique**, appelée **exactement
deux fois**, par `duplicateStructureNode()` et `applyTemplateToProject()` — et par
personne d'autre ; que `mapNoeuds` et `mapTaches` n'apparaissent qu'**une** fois
chacune ; que les appelants n'en construisent aucune et se contentent de
**pousser** ce que la primitive a produit ; et que la primitive reste **pure**
(ni `app`, ni `save`, ni `snapshot`, ni `render`).

### Modèles (§24, §25)

`templatePrerequisiteRecord()` produit **exactement huit champs** :

```
id, taskId, type, label, blocking,
expectedOffsetDaysFromTaskStart, supplier, comment
```

**Aucun statut opérationnel, aucune `confirmedDate`, aucune date absolue.** Une
condition de modèle naît toujours comme une condition à préparer. L'offset est
relatif au début de l'intervention et accepte les valeurs **négatives** (« deux
jours avant ») comme positives.

À la pose, `expectedDate` est recalculée depuis la nouvelle date de tâche :
tâche au 5 octobre → livraison au 6 (offset +1), accès au 4 (offset −1). Si
aucune date n'existait, `expectedDate = null`.

`alignDemoDates()` ne touche **pas** aux modèles : leurs positions sont
relatives et ne vieillissent pas (PRQ-39).

---

## 9 · Données, migration, portabilité

### Migration 14 → 15 (§28, §29)

Additive et **idempotente**. Une sauvegarde V14 n'a pas la collection : on la
crée **vide**. **Aucune** donnée de démonstration n'est injectée chez un
utilisateur migré — la démo appartient à `INITIAL_STATE`, pas à la migration.

La normalisation **ne détruit pas une donnée lisible** : elle répare ce qu'elle
peut et n'écarte que ce qui ne peut pas exister.

| Anomalie | Décision | Motif |
|---|---|---|
| tableau absent | `[]` | migration additive |
| entrée non objet, `id` vide | écartée | irréparable |
| `id` en double | première occurrence gagnée | déterministe |
| `taskId` inconnu | **écartée** | une condition sans tâche ne pourrait être ni affichée, ni satisfaite, ni supprimée |
| `projectId` divergent | **réaligné depuis la tâche** | une seule vérité relationnelle |
| `type` invalide | → `other` | réparation, pas destruction |
| `status` invalide | → `pending` | idem |
| `blocking` non booléen | `!== false` | par défaut bloquant (§6) |
| date illisible | → `null` | le reste de la condition survit |
| `confirmedDate` sur une condition non confirmée | → `null` | sinon résidu trompeur |

### Sauvegarde / restauration (§27)

`app.prerequisites` voyage dans la sauvegarde et se restitue **octet pour
octet**. La clé reste **facultative** : elle n'entre pas dans
`KANVIX_BACKUP_REQUIRED`, dont la valeur est **byte-identique** à V2.11.0.3.

Une sauvegarde **V14**, sans la clé, reste parfaitement valide : elle se
restaure, passe en version 15 avec une collection vide, sans perdre un chantier
ni une tâche (PRQ-34, mesuré : 4 chantiers, 11 tâches).

### Import / export portable (§30)

L'export porte `prerequisites`. Un export **ancien**, sans la clé, reste accepté
par l'analyse d'import.

Le remappage se fait dans **la passe 2 existante**, avec le `taskIdMap` **déjà
là**. Sur un import qui crée de nouvelles tâches (chemin « importer en
double »), les 4 conditions pointent toutes vers les **nouvelles** tâches, aucune
vers un identifiant de la base source, aucun identifiant réutilisé, chantier
cohérent avec la tâche.

Une condition dont l'intervention n'a pas été importée est **écartée**, et la
perte est **annoncée** dans le rapport d'import — jamais silencieuse :
`« 1 condition de démarrage »` (PRQ-38).

### Données de démonstration (§31)

**Quatre** conditions, sur deux chantiers — de quoi comprendre la fonction sans
dégrader tous les chantiers de la démo :

| Chantier / intervention | Condition | Type | Bloquant | État |
|---|---|---|---|---|
| Keravel / Pose des 6 fenêtres | Livraison des fenêtres (Menuiseries Armor) | `delivery` | oui | **à confirmer**, prévue **après** le démarrage |
| Keravel / Pose des 6 fenêtres | Accès zone façade | `access` | oui | **confirmé** |
| Keravel / Peinture étage 1 | Validation teinte client | `client_approval` | **non** | à confirmer → **surveillance** |
| Les Terrasses / Réseaux plomberie | Approvisionnement tubes cuivre | `supply` | oui | **confirmé** → « tout est prêt » |

FREEZE-2120 mesure que les niveaux de structure et les interventions de
démonstration **existants** sont **byte-identiques** : aucun chantier n'a été
dégradé pour les besoins de la fonction.

### Undo / Redo (§33)

Un geste = un `snapshot()` = un Undo. Aucune pile parallèle (mesuré sur le
source). Les sept scénarios du cadrage sont couverts, dont les trois composés :
suppression tâche + conditions, pose de modèle + conditions, duplication
Structure + conditions — chacun en **un seul** geste annulable.

---

## 10 · Ce que V2.12.0 ne fait pas (§34)

FREEZE-2120 mesure, sur le source et à l'exécution, qu'aucune mutation de
condition ne :

replanifie · déplace une tâche · confirme une condition · crée un incident ·
crée un contrôle qualité · convertit une dépendance · envoie une notification ·
crée un achat · gère du stock · appelle une API fournisseur.

Les vérifications d'incidents et de contrôles sont faites **en delta** : le
chantier de démonstration en porte déjà, et ce qu'on interdit est que Kanvix en
**fabrique** un au passage.

---

## 11 · Accessibilité et responsive (§35, §36)

**Clavier** : la side-window reçoit le focus à l'ouverture, Escape la ferme,
les 12 actions sont de **vrais boutons** atteignables au clavier, **aucune**
action n'est disponible uniquement au survol. Les six champs du formulaire
portent chacun leur label.

**Responsive** : **20 combinaisons** — 1920, 1600, 1440, 1366, 1280, 1080, 900,
768, 430, 390 px × clair / sombre — sur la fiche tâche, la side-window, le
formulaire, Aujourd'hui et le Planning. **Aucun** défilement horizontal, **aucun**
dépassement de la side-window, **aucun** bouton coupé. À 430 et 390 px, les
**dix** actions d'une condition mesurent au moins **44 px** de haut.

**Captures** (`recette-v2.12.0/`) — produites par les tests réels, pas par une
mise en scène :

`01-task-ready` · `02-task-warning` · `03-conditions-drawer` (clair **et**
sombre) · `04-condition-form` · `05-start-warning` · `06-today-prerequisite` ·
`07-planning-prerequisite` · `08-mode-chantier-390` ·
`09-artisan-conditions-390` · `resultats.json`.

---

## 12 · FREEZE-2120 — le périmètre, mesuré

### Les 25 fonctions modifiées, nommées une à une

| Domaine | Fonctions |
|---|---|
| Données | `migrateState`, `alignDemoDates` |
| Démarrage | `setTaskStatus` |
| Écrans tâche | `openTask`, `openFieldTaskModal`, `renderArtisan` |
| Cascade | `confirmDeleteTask` |
| Clonage | `cloneStructureTree`, `collectStructureSource`, `duplicateStructureNode`, `applyTemplateToProject`, `buildProjectTemplateRecord` |
| Planning | `gantt`, `projectToday`, `projectUpcomingTimeline` |
| Aujourd'hui | `getTodayDecisions`, `getTodayWarnings`, `decisionCard`, `watchCard`, `attentionRowTone`, `openMoreIssues` |
| Données portables | `showKanvixBackupPreview`, `exportKanvixData`, `applyImportPlan`, `impDroppedLines` |

Le balayage md5 fonction par fonction de **tout le fichier** ne trouve **aucune
autre** fonction modifiée, et vérifie dans le même mouvement que les 25
annoncées ont **réellement** changé — aucun périmètre annoncé pour rien.
`renderAIPanel`, faux positif récurrent de l'extraction par accolades (elle
contient des littéraux de gabarit), est mesuré par un bloc borné à
l'indentation.

### 40 fonctions ajoutées

`prerequisite`, `taskPrerequisites`, `projectPrerequisites`,
`prerequisiteEffectiveStatus`, `prerequisiteIsSatisfied`,
`taskBlockingPrerequisites`, `taskUnresolvedPrerequisites`, `taskStartReadiness`,
`prerequisiteIsLateForTask`, `taskPrerequisiteSummary`, `taskTopPrerequisite`,
`taskNeedsPrerequisiteAttention`, `prerequisiteDaysToTaskStart`,
`prerequisiteUid`, `addTaskPrerequisite`, `updateTaskPrerequisite`,
`setPrerequisiteStatus`, `deleteTaskPrerequisite`, `confirmDeletePrerequisite`,
`doDeletePrerequisite`, `prerequisiteAction`, `askPrerequisiteStartConfirm`,
`cancelPrerequisiteStart`, `confirmPrerequisiteStart`, `taskPrerequisitesSection`,
`openTaskPrerequisites`, `renderTaskPrerequisites`, `openPrerequisiteForm`,
`prerequisiteChip`, `prerequisiteMetaLine`, `prerequisiteDecisionItems`,
`prerequisiteWarningItems`, `prerequisiteAlertItem`, `prerequisiteAlertCard`,
`openPrerequisiteFromAlert`, `planningPrerequisiteMeta`,
`fieldTaskPrerequisitesSummary`, `fieldPrerequisiteAction`,
`artisanPrerequisiteNote`, `templatePrerequisiteRecord` — plus les référentiels
`PREREQ_TYPES`, `PREREQ_STATUS`, `PREREQ_EFFECTIVE`, `PREREQ_PRIORITY`,
`PREREQ_SOON_DAYS` et les trois lecteurs d'étiquettes.

### 69 moteurs nommément gelés — byte-identiques

Tout le Planning (positionnement, glisser-déposer, propagation, jours non
ouvrés, démarrage réel), les **dépendances**, la **qualité**, les **ressources**,
la **structure**, le **Kanban**, l'**Undo/Redo**, la **sauvegarde** et les
**modèles**. Mesuré, pas affirmé : md5 par fonction.

### Style et données — additifs, prouvés

Le bloc de style V2.12.0 retiré, la feuille redevient **byte-identique** à
V2.11.0.3 (341 948 → 346 343 octets). `KANVIX_APP_BUILD` inchangé.
`KANVIX_BACKUP_REQUIRED` byte-identique.

---

## 13 · Sweep historique — 58 recettes

| | |
|---|---|
| `ECHECS_REFERENCE_V21103` | **262** |
| `ECHECS_V2120` | **262** |
| **RESTE** | **0** |

Aucune dette historique n'a été « réparée » dans ce round, et aucun nouvel échec
n'a été introduit. La recette V2.11.0.3, rejouée sur le build V2.12.0, revient à
**170 / 170** (§37, PRQ-60).

Erreurs JavaScript applicatives sur l'ensemble du sweep : **0** — 32 des 58
recettes publient explicitement leur compteur d'erreurs console, et les 32 sont
à zéro ; aucune des 26 autres n'en signale.

---

## 14 · Re-pointages — 38 recettes, trois causes nommées

Chaque re-pointage porte son motif **dans le code de la recette**, et la nouvelle
assertion est au moins aussi forte que l'ancienne.

### Cause 1 — la garde de démarrage s'interpose (104 sites, 25 recettes)

Depuis V2.8.5.2, les recettes historiques confirment déjà le calendrier après un
`setTaskStatus(…,'doing')` :

```js
if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
```

V2.12.0 ajoute **exactement la même ligne**, dans le même idiome, pour la garde
des conditions :

```js
if (document.querySelector('#modal.open [data-prq-confirm]')) confirmPrerequisiteStart();
```

Le produit expose `data-prq-confirm` sur « Démarrer quand même », comme il
exposait déjà `data-calendar-confirm`. L'exigence testée est **inchangée** : on
confirme, comme l'utilisateur.

Recettes concernées : `accueil-2.4.4.1`, `accueil-2.4.5`,
`backup-continuite-2.4.13.1`, `controles-qualite-2.7.0`, `correctif-ui-2.4.14.1`,
`correctifs-2.4.15.4`, `correctifs-2.7.1`, `densite-2.4.14`,
`edition-taches-2.4.8`, `harmonisation-ui-2.4.15`, `historique-metier-2.4.13`,
`kanban-badges-2.4.11.1/.2/.3`, `mode-chantier-2.4.5/2.4.6`,
`non-regression-2.6.1-vers-2.7`, `operations-2.8.0`,
`planning-bureau-2.4.9.1/2.4.10/2.4.10.1`, `planning-2.4.8`,
`structure-projet-2.9.0`, `undo-redo-2.8.4`, `undo-redo-ui-2.8.4.1`.

### Cause 2 — la prémisse « tout est vide » doit inclure les conditions

| Recette | Assertion | Re-pointage |
|---|---|---|
| `accueil-2.4.4.1` / `accueil-2.4.5` | `[density]` « compteur À décider = 10 (total réel) » | le cas neutralisait déjà tout le bruit préexistant (`issues` résolus) ; il neutralise désormais aussi les conditions. **Le seuil reste 10**, pas un nombre relâché |
| `harmonisation-ux-2.8.1` | `[UX281-13]` « vidées, les trois colonnes RESTENT » | `app.prerequisites = []` rejoint `app.decisions = []` et `app.controlInstances = []` : la prémisse est complétée, l'exigence intacte |
| `lots-2.6.0` | `[LOT-32]` « à données métier ÉQUIVALENTES, 10 indicateurs identiques » | neutralisation sur les deux builds — **et une assertion en plus** : sans neutralisation, l'écart doit être **exactement** `decisions, +1`. Le test est désormais **plus strict** : il chiffre la contribution de la nouveauté |
| `non-regression-2.6.1-vers-2.7` | `[NR-01]` Gantt, `[NR-24]` fiche tâche | neutralisation en **un seul endroit**, le setup commun aux deux builds. Pour NR-24, le bloc `.prq-section` est retiré du DOM **et renvoyé** : une assertion corollaire vérifie que ce qui a été retiré est bien ce bloc-là. C'est exactement le procédé que cette recette utilisait déjà pour l'emplacement de Structure en V2.9.0 |
| `planning-calendrier-realite-2.8.5.1` | `[PC-57]` « une transition cohérente reste directe, sans confirmation inutile » | « cohérente » a désormais deux dimensions — à l'heure **et** conditions réglées. La prémisse est complétée ; `!modal` ne bouge pas |
| `correctifs-2.7.1` | `[QUAL271-02]` « `setTaskStatus()` retourne un outcome exploitable » | même raisonnement qu'en V2.8.5.2 : l'appel initial rend la main sans outcome, on capture celui de la transition réellement effectuée. **Exigence renforcée** : la garde doit **rendre** l'outcome du moteur, pas l'avaler — ce qui a motivé le `return` dans `confirmPrerequisiteStart()` |

### Cause 3 — contrats de gel et de schéma devenus obsolètes

**SCHEMA_VERSION 14 → 15** (§28, imposé par le cadrage) : 19 assertions dans 9
recettes épinglaient 14. Ce qu'elles protègent réellement — la **clé de
stockage**, la création **vide** de la collection, la non-destruction des données
— est strictement inchangé ; seule la version attendue suit le produit.

**Byte-identité des moteurs** : 12 recettes nommaient `setTaskStatus`, `gantt`,
`openTask`, `exportKanvixData`, `applyImportPlan`, `alignDemoDates` ou
`confirmDeleteTask` parmi leurs moteurs gelés. V2.12.0 les **étend** — et les
étend **plutôt que de les dupliquer**, ce qui est précisément la règle que ces
gels protègent. Onze reçoivent une liste `rebaseV2120` **nommée et fermée**, avec
son motif ; la douzième (`structure-ux-2.9.0.1`) étend la liste `rebaseV291`
qu'elle possédait déjà. Les 60 à 116 autres moteurs de chaque recette restent
gelés byte à byte.

**Balayages de périmètre** : 7 recettes balaient tout le fichier. Elles reçoivent
`attenduesV2120`, la liste des 25 fonctions reprise **verbatim** de FREEZE-2120.
La liste reste **fermée** : une fonction non nommée fait toujours tomber le test,
et le contrôle « les fonctions du round ont réellement changé » reste
strictement celui de la recette concernée.

**Additivité prouvée plutôt que silence** : là où une recette exigeait « le
style / `INITIAL_STATE` / `migrateState` est byte-identique », le bloc V2.12.0 est
**retiré nommément** et l'identité doit revenir. Un seul octet modifié ailleurs
ferait toujours tomber la mesure. `migrateState()` reçoit trois ajouts — la
migration 14 → 15, la normalisation des conditions d'un modèle, la clé
`prerequisites` de l'objet modèle — et les trois sont retirés un par un.

**Une omission corrigée au passage** : `operations-2.8.0` scannait
`impDroppedLines` mais l'avait oubliée dans sa liste autorisée. V2.12.0 l'étend
(§30) ; elle y entre explicitement.

**Deux appelants de la primitive** (`modeles-chantier-2.11.0.3`) : ils ne peuvent
plus être byte-identiques, ils **poussent** désormais les conditions produites
par la primitive. Ce que l'assertion protège vraiment — « ils délèguent et ne
calculent rien » — est mesuré **plus finement** qu'avant : aucune table chez eux,
et **une seule** ligne de dépôt chacun.

Aucune assertion n'a été supprimée. Aucune n'a été affaiblie.

---

## 15 · Critères de fin (§44)

| # | Critère | État |
|---|---|---|
| 1 | 0..N conditions par intervention | ✅ PRQ-04 → PRQ-06 |
| 2 | 4 statuts + « en retard » dérivé | ✅ PRQ-07 → PRQ-11 |
| 3 | livraison après démarrage détectée | ✅ PRQ-14 |
| 4 | jamais de modification automatique du planning | ✅ PRQ-15, PRQ-54 |
| 5 | confirmation avant démarrage bloqué | ✅ PRQ-17 |
| 6 | « Démarrer quand même » | ✅ PRQ-19 |
| 7 | démarrage forcé historisé | ✅ PRQ-21 |
| 8 | Aujourd'hui seulement quand c'est utile | ✅ PRQ-23, PRQ-24 |
| 9 | Planning lisible | ✅ PRQ-26 |
| 10 | Mode Chantier simple | ✅ PRQ-28 |
| 11 | Artisan en lecture seule | ✅ PRQ-29 |
| 12 | aucun orphelin après suppression | ✅ PRQ-31 |
| 13 | Undo / Redo | ✅ PRQ-32, PRQ-50 |
| 14 | backup / restore | ✅ PRQ-33 |
| 15 | anciens backups compatibles | ✅ PRQ-34 |
| 16 | import / export portable | ✅ PRQ-35 → PRQ-38 |
| 17 | duplication Structure | ✅ PRQ-40 → PRQ-42 |
| 18 | modèles sans date absolue ni état | ✅ PRQ-43 → PRQ-47 |
| 19 | pose modèle remappe tout | ✅ PRQ-48, PRQ-49 |
| 20 | `cloneStructureTree()` unique | ✅ FREEZE-2120 |
| 21 | SCHEMA_VERSION = 15 | ✅ |
| 22 | STORE = `kanvix-product-8-3` | ✅ |
| 23 | recette dédiée 100 % | ✅ **101 / 101** |
| 24 | aucune erreur JavaScript applicative | ✅ **0** |
| 25 | RESTE = 0 | ✅ |
| 26 | clair / sombre / desktop / smartphone | ✅ 20 combinaisons |

---

## 16 · Défauts trouvés et corrigés pendant le round

Cinq écarts ont été trouvés par les tests et corrigés — quatre dans les tests
eux-mêmes, un dans le produit.

1. **Produit — l'artisan ne voyait rien.** PRQ-29 a révélé que
   `fieldTaskPrerequisitesSummary()` fonctionnait parfaitement pour l'artisan…
   mais qu'aucun écran ne l'appelait pour lui : `isFieldMode()` exclut
   explicitement ce rôle, son écran est la conversation. `artisanPrerequisiteNote()`
   a été ajoutée et pose le bloc dans la carte mission, en réutilisant la
   fonction existante.
2. **Produit — la garde avalait l'outcome.** `confirmPrerequisiteStart()` ne
   retournait rien ; QUAL271-02 exigeait, depuis V2.7.1, un `outcome` exploitable.
   Un `return` a été ajouté : la garde est un passage, pas un mur.
3. **Tests — mesures absolues au lieu de deltas.** PRQ-21 et PRQ-54 exigeaient
   « 0 incident » là où la démo en porte déjà. Corrigés en delta avant/après,
   ce qui est la formulation honnête de §34.
4. **Tests — périmètre FREEZE mal nommé.** Le round déclarait `planningAgenda`,
   `renderStructureNode` et `templateCaptureScope` ; les trois rendus réellement
   modifiés sont `gantt`, `projectToday` et `projectUpcomingTimeline`, et
   `renderArtisan` s'y est ajouté. La liste a été corrigée sur la mesure.
5. **Tests — chemin d'import non représentatif.** PRQ-37 montait un wizard
   maison et empruntait le chemin « fusion », où les tâches gardent leur
   identifiant : le remappage n'était donc pas exercé. Le test monte désormais le
   wizard **comme le produit le monte** et force le chemin « importer en
   double », seul chemin où de nouveaux identifiants sont attribués.

Une incohérence observée **hors périmètre** est signalée sans être corrigée,
conformément à la discipline des rounds précédents : `recette-operations-v2.8.0`
scanne `planningAgenda` et `nav` dans sa liste de fonctions autorisées à
évoluer, mais son assertion de byte-identité était **déjà rouge** dans la
référence V2.11.0.3 (`renderProject`, `projectTabs`, `projectTabContent`,
`confirmKanvixRestore`). C'est de la dette antérieure : elle n'a pas été
traitée.

---

## 17 · Livrables

| Fichier | |
|---|---|
| `public/poc/kanvix-next-gen-v2.12.0.html` | le POC complet, 31 365 lignes |
| `recette-conditions-demarrage-v2.12.0.mjs` | PRQ-01 → PRQ-59, PRQ-RESP, PRQ-A11Y, PRQ-SHOTS, FREEZE-2120 — **101 / 101** |
| `RAPPORT-V2.12.0-CONDITIONS-DEMARRAGE.md` | ce document |
| `recette-v2.12.0/` | 12 captures + `resultats.json` |
| 38 recettes historiques | re-pointées, motif dans le code |
