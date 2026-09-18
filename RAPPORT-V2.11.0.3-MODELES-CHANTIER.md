# Kanvix V2.11.0.3 — Responsables de structure et modèles de chantier

## 1 · Source — 2 · Livrable — 3 · Commit

| | |
|---|---|
| **Source** | `public/poc/kanvix-next-gen-v2.11.0.2.html` |
| **Livrable** | `public/poc/kanvix-next-gen-v2.11.0.3.html` — 30 184 lignes |
| **Recette dédiée** | `recette-modeles-chantier-v2.11.0.3.mjs` — **170 / 170**, **0 erreur console** |
| **Non-régression** | 57 recettes rejouées — **RESTE : 0** |
| **Branche** | `claude/kanvix-next-gen-poc-im084x` |
| **Commit** | voir fin de rapport |

Correctif ultra-ciblé : un angle mort, rien d'autre. Aucune fonctionnalité
ajoutée, aucun écran, aucun wording, aucun style, aucune donnée de
démonstration, aucune dette historique.

---

## 4 · Fonctions réellement modifiées — deux

| Fonction | Justification |
|---|---|
| `openStructureForm` | **une ligne** : la règle « responsable = personne active » n'y est plus écrite, elle est LUE. La fonction RETIRE du code plutôt qu'elle n'en ajoute. |
| `cloneStructureTree` | **une garde** : `resource(n.responsibleResourceId)` → `canAssignStructureResponsible(n.responsibleResourceId)`, uniquement dans la branche `"suggest"`. |

## 5 · Fonctions ajoutées — deux

| Fonction | Rôle | Taille |
|---|---|---|
| `structureResponsibleResources()` | **LA** définition : `app.resources.filter(r => r.type === "person" && resourceActive(r))` | 5 lignes |
| `canAssignStructureResponsible(id)` | la même vérité pour UN identifiant — elle LIT la liste, ne teste ni le type ni le statut | 4 lignes |

## 6 · Preuve du périmètre

Balayage de **tout** le fichier contre V2.11.0.2 (`FREEZE-21103`) :

```
modifiées   : ["openStructureForm", "cloneStructureTree"]
ajoutées    : ["structureResponsibleResources", "canAssignStructureResponsible"]
horsPérimètre : []          ← aucune autre fonction n'a changé
indentation   : []          ← renderAIPanel byte-identique (mesurée par indentation)
nonModifiées  : []          ← les deux annoncées ont réellement changé
ajoutsRéels   : 2           ← les deux ajouts existent bien, et n'existaient pas avant
```

Mesurés **byte-identiques** en plus : `duplicateStructureNode`,
`applyTemplateToProject`, `canAssignResource`, `assignableResources`,
`mainAssignableResources`, `resourceActive`, `normalizeTaskResources`,
`migrateState`, `buildKanvixBackup`, `validateKanvixBackup`,
`confirmKanvixRestore`, `buildProjectTemplateRecord`, `templateCaptureScope`,
`KANVIX_BACKUP_REQUIRED`, **`INITIAL_STATE` en entier**, **la feuille de style
en entier**.

---

## 7 · L'anomalie, reproduite AVANT correction

Décor : un modèle dont cinq niveaux portent chacun un type de responsable
différent, `marc` (personne) archivé, puis pose en `resourceStrategy: "suggest"`.

**Mesuré sur `kanvix-next-gen-v2.11.0.2.html` :**

| Responsable du modèle | Type / état | V2.11.0.2 | Verdict |
|---|---|---|---|
| `mathieu` | personne active | `mathieu` | ✔ correct |
| `marc` | personne **archivée** | **`marc`** | ✘ **réaffectée** |
| `legall` | **entreprise** active | **`legall`** | ✘ **interdit par l'UI** |
| `crane-g01` | **équipement** actif | **`crane-g01`** | ✘ **interdit par l'UI** |
| `fantome-xyz` | inconnue | `null` | ✔ (seul cas couvert par `resource()`) |

**Trois cas sur cinq étaient fautifs.** Le moteur vérifiait seulement
l'EXISTENCE de la ressource, là où le formulaire de niveau exige depuis V2.9.0
une personne active.

**Mesuré sur `kanvix-next-gen-v2.11.0.3.html`, même décor :**

| `mathieu` | `marc` | `legall` | `crane-g01` | `fantome-xyz` |
|---|---|---|---|---|
| `mathieu` | `null` | `null` | `null` | `null` |

---

## 8 · La règle métier retenue

Pour un `responsibleResourceId` provenant d'un modèle, en `resourceStrategy
=== "suggest"`, le responsable est repris **si et seulement si** :

1. la ressource **existe** ;
2. elle est **active** (`resourceActive`) ;
3. son type est **`person`**.

Sinon : `responsibleResourceId = null`, **sans remplacement inventé**.

**Cette règle est volontairement PLUS ÉTROITE** que celle de l'intervenant
principal d'une tâche, qui accepte une entreprise. Les deux notions ne sont
jamais confondues : le §4 de la commande est vérifié par `FIXTPL3-11`, qui pose
**la même entreprise** `legall` comme suggestion de responsable **et** comme
intervenant principal d'une tâche du même modèle — elle est **refusée** comme
responsable (`null`) et **acceptée** comme intervenant principal (`legall`,
type `company`).

Ce que la règle ne change pas :

- **`"keep"`** — inchangé. Dupliquer une branche la copie telle quelle.
- **`"none"`** — inchangé. Aucun responsable reposé.

---

## 9 · UNE seule vérité — preuve

### Dans le code

```
structureResponsibleResources()     ← LA définition (1 fois dans le fichier)
   ├── openStructureForm()          ← lit la liste pour son <select>
   └── canAssignStructureResponsible(id)
          └── cloneStructureTree()  ← branche "suggest" uniquement
```

Mesuré (`FREEZE-21103 / §3`) :

| Propriété | Mesure |
|---|---|
| `structureResponsibleResources()` : définition + lecteurs | **3** (1 + `openStructureForm` + la garde) |
| `canAssignStructureResponsible()` : définition + appels | **2** (1 + `cloneStructureTree`) |
| `openStructureForm` ne recopie plus `type === "person"` | ✔ |
| `canAssignStructureResponsible` ne mentionne ni `person`, ni `resourceActive`, ni `status`, ni `archived` | ✔ |
| `cloneStructureTree` ne recopie pas le critère | ✔ |
| **Aucune** fonction manipulant `responsibleResourceId` ne recopie le critère | ✔ (liste vide) |
| La garde Structure n'appelle **jamais** `canAssignResource` (règle des tâches) | ✔ |

### Par le résultat, pas seulement par le code

`FIXTPL3-10` compare, **pour chaque ressource du référentiel**, le verdict du
`<select>` du formulaire et celui de la règle appliquée à la pose : ils sont
**identiques**. Et la liste du `<select>` est **exactement**
`structureResponsibleResources()`.

### Observation documentée, non corrigée (§9 de la commande)

Le prédicat littéral `r.type === "person" && resourceActive(r)` existe **quatre
fois** dans le fichier. Trois d'entre elles relèvent d'**autres notions
métier**, hors périmètre de ce correctif :

| Fonction | Notion | Statut |
|---|---|---|
| `structureResponsibleResources` | **responsable de niveau** | la définition unique de ce round |
| `renderWizard` × 2 | champs « Ressource » du wizard « Reprendre un chantier en cours » (V2.4) — une **affectation d'intervention** | hors périmètre |
| `newMessageCandidates` | **destinataires d'un message** | hors périmètre |

L'assertion `FREEZE-21103` épingle cette liste exacte de porteurs : si une
quatrième notion se mettait à recopier le critère, elle tomberait. Les
factoriser serait un élargissement de scope explicitement interdit.

---

## 10 · Résultats FIXTPL3 — 15 / 15

| # | Contrôle | |
|---|---|---|
| 01 | personne active → conservée | ✔ |
| 02 | personne **archivée** → `null` | ✔ |
| 03 | **entreprise** active → `null` | ✔ |
| 04 | **équipement** actif → `null` | ✔ |
| 05 | ressource inconnue → `null` ; niveau sans responsable → reste sans | ✔ |
| 06 | responsable refusé **jamais recyclé** (ni principal, ni complémentaire) | ✔ |
| 07 | `"none"` → comportement V2.11.0.2 inchangé | ✔ |
| 08 | `"keep"` → responsable copié à l'identique (archivée, entreprise, engin, référence inconnue comprises) | ✔ |
| 09 | `duplicateStructureNode()` conserve exactement le comportement V2.10 | ✔ |
| 10 | le formulaire ne propose que des personnes actives — **et rend le même verdict que la pose** | ✔ |
| 11 | une entreprise reste intervenant principal d'une tâche | ✔ |
| 12 | un équipement reste ressource complémentaire d'une tâche | ✔ |
| 13 | **scénario complet** : Thomas responsable → enregistré dans un modèle → archivé → reposé. Le modèle GARDE sa suggestion, la pose la REFUSE | ✔ |
| 14 | aucune référence responsable orpheline **ni invalide** dans les niveaux créés | ✔ |
| 15 | Undo / Redo en un geste, et la validation n'est pas contournée par la pile | ✔ |

**FIXTPL3-13** mérite d'être souligné : il vérifie le §5 de la commande — le
modèle **mémorise** toujours `responsibleResourceId` (`thomas` reste dans
`tpl.nodes[0]`), et c'est la **pose** qui tranche. Un modèle reste donc durable
dans le temps ; `buildProjectTemplateRecord()` et `templateCaptureScope()` sont
byte-identiques.

---

## 11 · Résultats de la recette V2.11.0.2

**140 / 140**, 0 erreur console.

## 12 · Résultats des recettes Structure

| Recette | Résultat |
|---|---|
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** |
| `recette-structure-operationnelle-v2.10.0.mjs` | **69 / 69** |
| `recette-structure-rework-v2.10.0.1.mjs` | **29 / 29** |
| `recette-modeles-chantier-v2.11.0.mjs` | **65 / 65** |
| `recette-modeles-chantier-v2.11.0.1.mjs` | **110 / 110** |

---

## 13 · Sweep historique — 14 · Comparaison

**57 recettes** rejouées contre `v2.11.0.3`.

| | |
|---|---|
| `ECHECS_REFERENCE_V21102` | **262** |
| `ECHECS_V21103` | **262** |
| **RESTE** | **0** |

Jeu d'échecs **identique, ligne à ligne**, à celui de V2.11.0.2.
**Aucune dette historique n'a été traitée.**

### Les re-pointages — sept gels, une seule cause

`openStructureForm` figurait dans la liste des moteurs **gelés** de sept
recettes. Le correctif la modifie — d'une ligne, et en lui **retirant** du code.
Le contrat que ces gels mesuraient (« cette fonction ne bouge pas ») est donc
réellement devenu obsolète, et pour une raison unique et nommée.

| Recette | Gel | Re-pointage |
|---|---|---|
| `structure-ux-v2.9.0.1` | `FREEZE-2901` | rejoint `rebaseV291`, la liste des fonctions re-basées **déjà** utilisée pour `migrateState` |
| `structure-compacte-v2.9.1` | `FREEZE-291` / `STC-50` | quitte les gelés, rejoint le périmètre **nommé** |
| `structure-operationnelle-v2.10.0` | `FREEZE-2100` / `DUP-28` | idem |
| `structure-rework-v2.10.0.1` | `FREEZE-21001` | idem |
| `modeles-chantier-v2.11.0` | `FREEZE-2110` | idem |
| `modeles-chantier-v2.11.0.1` | `FREEZE-21101` | idem |
| `modeles-chantier-v2.11.0.2` | `FREEZE-21102` | idem |

**Les nouvelles assertions sont au moins aussi strictes**, et sur un point elles
sont **plus** strictes : le balayage distingue désormais deux listes —
`attendues` (le périmètre **propre** au round de la recette, sur lequel porte le
contrôle « ces fonctions ont réellement changé ») et `attenduesRoundsSuivants`
(tolérée par le seul balayage). Avant ce round, ajouter une fonction à
`attendues` relâchait **les deux** contrôles ; désormais le contrôle
« réellement changé » reste strictement celui du round. La liste reste
**fermée** : une fonction non nommée fait toujours tomber le test.

Le motif est écrit dans le code de chacune des sept recettes.

**Aucune autre recette n'a été modifiée.** Aucune assertion n'a été supprimée ni
affaiblie.

---

## 15 · Erreurs console

**0 erreur applicative** — recette dédiée comme sweep. Les seules lignes
`console.error` restantes, **strictement identiques** à la référence V2.11.0.2 :

```
[A11Y] / [P8] / [IMP-18] / [IMP-22]  Failed to load resource: net::ERR_FAILED
                                     ← blocage réseau volontaire des tests
[IMP-15] Kanvix: import annulé (rollback) Error: erreur simulée
                                     ← erreur SIMULÉE EXPRÈS (test de rollback)
```

---

## 16 · Schéma et stockage

| | |
|---|---|
| `SCHEMA_VERSION` | **14** — mesuré des deux côtés (V2.11.0.2 et V2.11.0.3) |
| `STORE` | **`kanvix-product-8-3`** |
| `KANVIX_APP_BUILD` | inchangé |

Aucune donnée persistée nouvelle : le correctif ne fait que **filtrer
autrement** une donnée déjà stockée. `migrateState()`, `buildKanvixBackup()`,
`validateKanvixBackup()`, `confirmKanvixRestore()` et `KANVIX_BACKUP_REQUIRED`
sont **byte-identiques**. Les modèles V2.11.0, V2.11.0.1 et V2.11.0.2 restent
intégralement compatibles.

---

## 17 · Aucune modification UI / CSS

- **La feuille de style est BYTE-IDENTIQUE** à V2.11.0.2.
- **`INITIAL_STATE` est BYTE-IDENTIQUE** — aucune donnée de démonstration n'a
  été touchée pour « faciliter » les tests ; les cas tordus (personne archivée,
  entreprise responsable, engin responsable, référence fantôme) sont **créés
  par la recette**.

Smoke visuel (`FIXTPL3-UI`), à **1600 px et 390 px**, en **clair et en sombre**,
sur la **Structure**, le formulaire **« Nouveau niveau »**, le formulaire
**« Modifier le niveau »** et la **pose d'un modèle** :

- aucun défilement horizontal, aucun dépassement de la side-window ;
- le formulaire de niveau a toujours ses **cinq** champs
  (`name`, `type`, `parentId`, `responsibleResourceId`, `description`) ;
- toujours **cinq** options de responsable (« Aucun » + les quatre personnes
  actives de la démonstration) ;
- le responsable existant reste correctement présélectionné (`mathieu`).

Aucune capture nouvelle n'était requise puisqu'aucune évolution visuelle n'a eu
lieu ; le dossier `recette-v2.11.0.3/` n'a donc pas été créé, conformément au
§14 de la commande.

---

## 18 · `cloneStructureTree()` reste l'unique primitive de clonage

| Propriété | Mesure |
|---|---|
| `function cloneStructureTree(` | **1 occurrence** |
| Appels `= cloneStructureTree(` | **2** |
| Appelants, et eux seuls | `applyTemplateToProject` \| `duplicateStructureNode` |
| Ces deux appelants sont **byte-identiques** à V2.11.0.2 | ✔ |
| `renderAIPanel` n'en appelle pas (mesuré par indentation) | ✔ |
| Aucun appelant ne construit de table (`new Map`) | ✔ |
| `mapNoeuds` / `mapTaches` | **1 chacune** |
| Remapping `parentId` / `structureNodeId` / `deps` / `reworkOfTaskId` | **1 chacun** |
| Primitive **PURE** (ni `app.*`, ni `save()`, ni `snapshot()`, ni `render()`) | ✔ |
| `app.structureNodes.push(` dans tout le fichier | **3** — création manuelle d'un niveau + les deux appelants |
| Aucun `TemplateEngine`, `StructureResponsibleEngine`, `cloneTemplateTree`, `applyTemplateTree`, `resourceAssignmentEngine`… | ✔ |
| Aucune pile Undo parallèle | ✔ |
| Un seul `snapshot()`, un seul `gantt()` | ✔ |
| Aucun drag & drop de structure | ✔ |
| Branche `"keep"` : copie brute du responsable, vérifiée par regex | ✔ |

---

## Critères de fin

| Critère | |
|---|---|
| une personne active peut être responsable d'un niveau posé depuis un modèle | ✔ FIXTPL3-01 |
| une personne archivée ne peut pas l'être | ✔ FIXTPL3-02 |
| une entreprise ne peut pas l'être | ✔ FIXTPL3-03 |
| un équipement ne peut pas l'être | ✔ FIXTPL3-04 |
| une ressource inconnue ne peut pas l'être | ✔ FIXTPL3-05 |
| ces suggestions invalides donnent `null`, sans remplacement inventé | ✔ FIXTPL3-06 |
| `openStructureForm` et la pose utilisent la même règle | ✔ FIXTPL3-10 |
| les règles d'affectation des tâches V2.5 restent intactes | ✔ FIXTPL3-11 / 12 |
| `resourceStrategy "keep"` reste strictement inchangé | ✔ FIXTPL3-08 |
| `duplicateStructureNode()` reste inchangé fonctionnellement **et byte-identique** | ✔ FIXTPL3-09 / FREEZE-21103 |
| aucun second moteur de clonage | ✔ FREEZE-21103 |
| Undo / Redo fonctionne | ✔ FIXTPL3-15 |
| `SCHEMA_VERSION` reste 14 | ✔ |
| `STORE` reste `kanvix-product-8-3` | ✔ |
| `INITIAL_STATE` reste byte-identique | ✔ |
| CSS reste byte-identique | ✔ |
| recette V2.11.0.3 = 100 % | ✔ **170 / 170** |
| recette V2.11.0.2 = 140 / 140 | ✔ |
| toutes les recettes Structure = 100 % | ✔ |
| `RESTE = 0` | ✔ |
| 0 erreur JavaScript applicative | ✔ |
