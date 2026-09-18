# Rapport — Kanvix V2.10.0.1 · Intégrité des reprises/SAV à la duplication

**Fichier livré** : `public/poc/kanvix-next-gen-v2.10.0.1.html` (29 028 lignes)
**Source** : `public/poc/kanvix-next-gen-v2.10.0.html` (29 004 lignes)
**Recette dédiée** : `recette-structure-rework-v2.10.0.1.mjs` — **29 / 29 PASS**, **0 erreur console applicative**
**Branche** : `claude/kanvix-next-gen-poc-im084x`

**Une seule fonction modifiée dans tout le fichier : `duplicateStructureNode()`.**
24 lignes ajoutées, dont 14 de commentaire. Feuille de style **byte-identique**
(338 932 octets), `SCHEMA_VERSION` 13, `STORE` inchangé, `INITIAL_STATE`
byte-identique, aucune capture nouvelle nécessaire.

---

## 1. Le défaut

`duplicateStructureNode()` clonait une tâche par `...structuredClone(t)` puis
remappait **trois** champs : `id`, `structureNodeId`, `deps`.

`task.reworkOfTaskId` — la relation « ceci est la reprise de cela » — était
emportée **telle quelle**. Une reprise clonée continuait donc de désigner une
tâche de l'arbre **source**.

### Reproduit avant toute modification

Décor : une tâche `A` et sa reprise `B`, telles que le produit les crée
réellement (`openReworkForm()` pose **à la fois** `deps: [A]` **et**
`reworkOfTaskId: A`). Duplication de la branche avec interventions, sur
V2.10.0 :

```
clone « Reprise — Pose fenêtres » :  deps = [ "task-…-2" ]   ← A2, correct
                                     rework = "t-A"          ← LA SOURCE
```

### Deux conséquences, mesurées

1. **Le clone était incohérent avec lui-même.** Il dépendait de A2 mais se
   déclarait reprise de A. Deux relations décrivant le même lien métier,
   pointant vers deux tâches différentes.

2. **Dupliquer modifiait le sens du graphe SOURCE.** `hasReworkSignaled()` lit
   `app.tasks.some((t) => t.reworkOfTaskId === id)`. Après duplication :

   | | V2.10.0 | V2.10.0.1 |
   |---|---|---|
   | `hasReworkSignaled(A2)` — le clone | **false** — A2 proposait encore « Signaler une reprise » alors que sa reprise existait | **true** |
   | Qui répond « oui » pour la source `t-A` | **t-B *et* le clone** | **t-B seule** |

   Autrement dit, dupliquer une branche faisait apparaître une seconde reprise
   sur une tâche à laquelle personne n'avait touché.

---

## 2. La cause exacte

```js
return {
  ...structuredClone(t),          // ← emporte reworkOfTaskId verbatim
  id: mapTaches.get(t.id),
  structureNodeId: mapNoeuds.get(t.structureNodeId) || null,
  deps: internes.map((d) => mapTaches.get(d)),
  //  reworkOfTaskId : absent de la liste des champs remappés
};
```

Un champ relationnel oublié dans la liste des remappages. Rien d'autre.

---

## 3. Le correctif

Dans `duplicateStructureNode()`, en réutilisant **la table `mapTaches` déjà
construite par V2.10.0** — aucune seconde table n'a été créée :

```js
let reprise = t.reworkOfTaskId || null,
  repriseInterne = reprise && mapTaches.has(reprise) ? mapTaches.get(reprise) : null;
if (reprise) {
  if (repriseInterne) reworkClonees += 1;
  else reworkAbandonnees += 1;
}
return {
  ...structuredClone(t),
  id: mapTaches.get(t.id),
  structureNodeId: mapNoeuds.get(t.structureNodeId) || null,
  deps: internes.map((d) => mapTaches.get(d)),
  reworkOfTaskId: repriseInterne,
};
```

Le traitement de `deps` n'a **pas** été touché : les deux lignes qui le calculent
sont byte-identiques à V2.10.0.

### Les deux règles retenues

| Cas | Règle | Pourquoi |
|---|---|---|
| **Reprise interne** au périmètre cloné | `reworkOfTaskId = mapTaches.get(ancien)` | La relation existe entre deux tâches copiées : elle se reconstruit entre les copies |
| **Reprise externe** au périmètre | `reworkOfTaskId = null` | Même philosophie que les dépendances externes de V2.10.0 : on ne crée jamais de relation entre le clone et l'ancien périmètre |
| **Aucune reprise** | `null` | Inchangé |

**Cette règle n'a pas été inventée pour l'occasion** : c'est exactement celle que
le produit applique déjà à l'import (passe 2 de `applyImportPlan`) —

```js
if (imported.reworkOfTaskId)
  task.reworkOfTaskId = taskIdMap[imported.reworkOfTaskId] || null;
```

— « remappée si la cible est dans le périmètre, sinon null ». Le correctif aligne
la duplication sur un comportement déjà établi et validé ailleurs.

### Ce que le moteur rend désormais

`duplicateStructureNode()` renvoie deux compteurs de plus, `reworkClonees` et
`reworkAbandonnees`, sur le modèle de `depsClonees` / `depsAbandonnees` : le
moteur dit ce qu'il a fait, et la recette le vérifie (2 remappées, 1 abandonnée
sur le scénario de test).

---

## 4. Fonctions modifiées

**Une seule.**

| Fonction | Nature | Raison |
|---|---|---|
| `duplicateStructureNode()` | Moteur de duplication | Le remapping de `reworkOfTaskId` |

Le balayage automatique de **tout le fichier** (`FREEZE-21001`) ne trouve aucune
autre différence : `horsPérimètre: []`.

**Aucun moteur Reprise/SAV n'a été modifié** (§5) : `hasReworkSignaled()`,
`createRework()`, `openTask()`, `setTaskStatus()` sont byte-identiques. Le
défaut était dans la donnée clonée, pas dans le moteur qui la lit — il a été
corrigé à la source.

### Vérification du périmètre (§11)

`FREEZE-21001` compare **70 moteurs nommément protégés** : `bougés: []`.

* **Structure hors duplication** — `moveStructureNode`, `structureMoveBlocker`,
  `openStructureMove`, `openStructureDuplicate`, `structureNodeMenu`,
  `structureCompactRow`, `structureCopyName`, `structureUid`,
  `structureDestinationList`, `structureSourceCard`, `structureRememberTrigger`,
  et tout le moteur de V2.9.0.
* **Reprise / SAV** — les quatre fonctions formellement interdites au § 5.
* **Planning** — `gantt`, `planningTasks`, `dropTask`, `dragStart`, `dragOver`,
  `requestGanttTaskMove`, `requestTaskScheduleMove`, `planningCreatePointer*`,
  `openTaskForm`, `submitTaskEdit`, `planReflow`, `isNonWorkingDate`,
  `frenchPublicHolidays`, `realStartPlan`…
* **Données, ressources, qualité, Undo/Redo, navigation** — `migrateState`,
  `buildKanvixBackup`, `confirmKanvixRestore`, `applyImportPlan`,
  `taskResourceIds`, `snapshot`, `undo`, `redo`, `drawerForm`, `closeOverlay`…

Et une assertion plus forte qu'un simple décompte : **le bloc ajouté retiré,
`duplicateStructureNode()` redevient byte-identique à V2.10.0**. Toute autre
modification glissée dans la fonction ferait tomber ce test.

### Aucun changement d'interface (§13)

La feuille de style — **338 932 octets** — est **byte-identique**. Aucun écran,
aucun composant de vue, aucune capture n'a changé. C'est pourquoi aucune capture
nouvelle n'est livrée.

---

## 5. Résultats REW-DUP-01 → REW-DUP-12

**29 assertions, 29 PASS, 0 erreur console.**

| Test | Vérifie | Résultat |
|---|---|---|
| **REW-DUP-01** | `B2.reworkOfTaskId === A2.id`, et `!== A.id` | ✅ |
| **REW-DUP-02** | Aucune tâche clonée ne porte un `reworkOfTaskId` vers la source ; et le graphe cloné est **autonome** sur les trois relations (`structureNodeId`, `deps`, `reworkOfTaskId`) | ✅ |
| **REW-DUP-03** | Reprise vers l'extérieur → `null` sur le clone ; compteurs 2 remappées / 1 abandonnée | ✅ |
| **REW-DUP-04** | Les six tâches source strictement inchangées (nom, reprise, deps, rattachement) ; `t-E` garde sa relation vers `t-X` | ✅ |
| **REW-DUP-05** | Deux couples dans le même périmètre : `B2→A2` et `D2→C2`, jamais vers C | ✅ |
| **REW-DUP-06** | `deps` **et** reprise sur la même tâche, remappées indépendamment : `B2.deps = [A2]` et `B2.rework = A2` | ✅ |
| **REW-DUP-07** | `resourceId`, `additionalResourceIds`, `lotId` identiques ; la grue `crane-g01` reste un seul matériel ; dates, statut, couleur inchangés | ✅ |
| **REW-DUP-08** | « Structure seule » : aucune tâche créée, compteurs de reprise à zéro, 2 niveaux copiés | ✅ |
| **REW-DUP-09** | Une transaction, une entrée d'historique ; Undo supprime tout, **aucune référence de reprise orpheline**, état au caractère près | ✅ |
| **REW-DUP-10** | Redo recrée tout, la reprise repointe vers la tâche **clonée** | ✅ |
| **REW-DUP-11** | Sauvegarde → restauration : `B2.reworkOfTaskId === A2.id`, jamais `t-A` ; SCHEMA 13, STORE inchangé | ✅ |
| **REW-DUP-12** | `hasReworkSignaled(A2) === true` **et cette réponse vient de B2** ; sur la source, elle ne vient toujours que de `t-B` | ✅ |
| **FREEZE-21001** | Périmètre, 70 moteurs gelés, CSS/SCHEMA/STORE/INITIAL_STATE, une seule `mapTaches`, aucune pile Undo parallèle, diff isolé | ✅ |

### Deux défauts de ma propre recette, corrigés

* **Identification des clones.** Je définissais « clone » comme « tâche absente
  de mes six tâches fabriquées » — ce qui faisait passer les **onze tâches de
  démonstration** pour des clones. Corrigé : on photographie les identifiants
  **avant** la duplication et le clone est la différence, sans rien supposer du
  format des ID.
* **Assertion CSS vacuue.** Mon extraction utilisait `/<style>/`, or la balise
  porte un id (`<style id="kanvix-css">`) : le motif ne matchait rien et
  l'assertion comparait deux chaînes vides — elle serait passée même si le CSS
  avait changé. Corrigée, et assortie d'une garde de non-vacuité (338 932 octets
  réellement extraits). La même garde a été ajoutée pour `INITIAL_STATE` et les
  tâches de démonstration.

---

## 6. Non-régression

### Recette V2.10.0 (§9)

`recette-structure-operationnelle-v2.10.0.mjs` rejouée **intégralement** sur
`kanvix-next-gen-v2.10.0.1.html` : **69 / 69 PASS**, sans la moindre
modification de la recette.

Elle vérifiait déjà l'unicité des ID, l'absence de `parentId` et de
`structureNodeId` vers la source, le remapping des `deps` internes, l'absence de
`deps` vers la source, la conservation des ressources, dates et lots, et
l'Undo/Redo. **V2.10.0.1 étend cette garantie à `reworkOfTaskId`.**

### Recettes Structure historiques (§10)

| Recette | Contre V2.10.0.1 |
|---|---|
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** |
| `recette-structure-operationnelle-v2.10.0.mjs` | **69 / 69** |

**Aucune assertion n'a été modifiée** dans ces quatre recettes.

### Différentiel historique — 49 recettes

```
ECHECS V2.10.0.1 : 262   |   ECHECS RÉF V2.10.0 : 262
RESTE : 0
```

Aucune nouvelle régression. Les trois recettes Planning sensibles sont
identiques à V2.10.0 :

| Recette | Résultat |
|---|---|
| `recette-planning-calendrier-realite-v2.8.5.1.mjs` | **76 / 0** |
| `recette-planning-draw-create-v2.8.5.mjs` | **54 / 0** |
| `recette-planning-edition-v2.8.5.2.mjs` | **53 / 0** |

---

## 7. Erreurs console

**0 erreur JavaScript applicative**, sur la recette dédiée comme sur les quatre
recettes Structure et les 49 recettes historiques.

---

## 8. Confirmations (§14.11)

| Point | État |
|---|---|
| `SCHEMA_VERSION` | **13** — inchangé |
| `STORE` | **`kanvix-product-8-3`** — inchangé |
| `KANVIX_APP_BUILD` | inchangé |
| `INITIAL_STATE` | **byte-identique** |
| Tâches de démonstration | **byte-identiques** |
| `migrateState()`, `buildKanvixBackup()`, `confirmKanvixRestore()` | **byte-identiques** |
| Feuille de style | **byte-identique** (338 932 octets) |
| Changement d'interface | **aucun** |
| Moteur Reprise/SAV modifié | **aucun** |
| Moteur Planning modifié | **aucun** |
| Refactoring hors périmètre | **aucun** |
| Pile Undo parallèle | **aucune** — `snapshot()` / `undo()` / `redo()` réutilisés |
| Seconde table de correspondance | **aucune** — `mapTaches` réutilisée, une seule occurrence dans le fichier |

---

## 9. Critères d'acceptation (§15)

| Critère | Résultat |
|---|---|
| Une reprise clonée pointe vers la tâche clonée | ✅ REW-DUP-01 |
| Elle ne pointe jamais vers la source | ✅ REW-DUP-02 |
| Une reprise externe devient `null` | ✅ REW-DUP-03 |
| La source reste strictement intacte | ✅ REW-DUP-04 |
| `deps` fonctionne comme en V2.10.0 | ✅ lignes byte-identiques |
| `structureNodeId` fonctionne comme en V2.10.0 | ✅ |
| `resourceId` / `additionalResourceIds` / `lotId` identiques | ✅ REW-DUP-07 |
| Undo complet | ✅ REW-DUP-09 |
| Redo complet | ✅ REW-DUP-10 |
| Backup/Restore conserve le remapping | ✅ REW-DUP-11 |
| `hasReworkSignaled` correct sur le clone | ✅ REW-DUP-12 |
| « Structure seule » inchangée | ✅ REW-DUP-08 |
| Les 69 tests V2.10.0 restent PASS | ✅ |
| Recettes Structure historiques PASS | ✅ 80/80, 59/59, 74/74 |
| Différentiel historique `RESTE : 0` | ✅ |
| 0 erreur JavaScript applicative | ✅ |
| `SCHEMA_VERSION` 13, `STORE`, `INITIAL_STATE` inchangés | ✅ |
| Aucun changement UX/UI | ✅ CSS byte-identique |
| Aucun moteur Planning modifié | ✅ |
| Aucun moteur Reprise/SAV modifié | ✅ |
| Aucun refactoring hors périmètre | ✅ une seule fonction modifiée |
