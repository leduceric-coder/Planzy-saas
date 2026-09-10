# Kanvix V2.4.12 — Historique contextualisé par chantier (correction SITE-01)

Source : `public/poc/kanvix-next-gen-v2.4.11.3.html` → cible `public/poc/kanvix-next-gen-v2.4.12.html`.
Version **périmètre des données**. Aucun moteur métier modifié, aucun changement de design.

## Verdict

**PASS. SITE-01 est fermé.** Ouvrir l'Historique d'un chantier montre exclusivement les événements attribuables à ce chantier, et une fiche tâche n'affiche plus l'historique global en plus de son propre suivi.

| Résultat | |
|---|---|
| Recette historique (`recette-historique-chantiers-v2.4.12.mjs`) | **106 / 106** |
| Recette Chantiers (SITE-F1→F10) — **FINDINGS : 0** | **48 / 48** |
| Badges Kanban V2.4.11.3 | **165 / 165** |
| Autres non-régressions (9 suites gelées) | **594 / 594** |
| **Total** | **913 / 913** |
| Erreurs console applicatives | **0** |

Le diff complet fait **74 lignes**, concentrées sur `historyHTML`, `projectTabContent`, `openTask`, `setIssueStatus`, `applySimulation` et l'entrée photo.

## 1. Cause de SITE-01

Deux appels, tous deux non filtrés :

```js
// projectTabContent() — fiche chantier
if (name === "Historique") return historyHTML();

// openTask() — fiche tâche
taskActivity(id) + (expert ? historyHTML() : "")
```

et `historyHTML()` parcourait directement `app.history` sans aucun filtre. Résultat : l'onglet Historique de Keravel rendait **exactement le même HTML** que celui de Villa du Port, et la fiche d'une tâche réinjectait tous les événements de l'application juste après son propre suivi.

**Preuve avant / après**, exécutée par la recette sur les deux fichiers avec le même jeu de données :

| | Baseline V2.4.11.3 | V2.4.12 |
|---|---|---|
| Keravel contient l'événement Villa | **oui** | **non** |
| Villa contient l'événement Keravel | oui | **non** |
| Historiques Keravel / Villa identiques | **oui** | **non** |
| Entrée globale visible dans une fiche chantier | oui | **non** |

## 2. Nouvelle API `historyHTML`

```js
function historyHTML(options = {}) {
  let entries = options.projectId ? projectHistory(options.projectId) : app.history;
  …
}
```

- `historyHTML({ projectId })` → historique du seul chantier.
- `historyHTML()` sans options → historique complet, **comportement d'origine conservé** (vérifié : le rendu global contient toujours les 10 entrées du jeu de test).

Aucune page ni entrée de menu « Historique » n'a été ajoutée (§54, vérifié sur la navigation rendue).

## 3. Helper `historyProjectId(entry)`

Helper **pur** qui répond à une seule question : à quel chantier appartient cette entrée ?

```js
function historyProjectId(entry) {
  if (!entry) return null;
  if (entry.projectId && project(entry.projectId)) return entry.projectId;
  let t = entry.taskId ? task(entry.taskId) : null;
  if (t && project(t.projectId)) return t.projectId;
  let src = entry.sourceTaskId ? task(entry.sourceTaskId) : null;
  if (src && project(src.projectId)) return src.projectId;
  return null;
}
```

Et le filtre, lui aussi pur, qui **préserve l'ordre de `app.history`** :

```js
function projectHistory(projectId) {
  return app.history.filter((h) => historyProjectId(h) === projectId);
}
```

**`app.history` reste la source unique** (§1) : aucune collection `app.projectHistory` / `taskHistory` / `globalHistory`, aucune copie persistante — vérifié explicitement (HIST-SCOPE).

## 4. Priorité d'identification

| Ordre | Référence | Pourquoi |
|---|---|---|
| 1 | `entry.projectId` (si le chantier existe) | rattachement explicite, **survit à la suppression de la tâche** |
| 2 | `task(entry.taskId).projectId` | compatibilité : la quasi-totalité des entrées existantes ne portent que `taskId` |
| 3 | `task(entry.sourceTaskId).projectId` | replanifications en cascade |
| 4 | `null` | non attribuable → reste globale |

**Aucune analyse textuelle.** `entry.text` n'est jamais lu par le helper — vérifié par inspection du code (aucun `includes` / `match` / `RegExp` / `indexOf` dans son corps) **et** par un test dédié : deux chantiers nommés « Résidence Keravel » et « Résidence Keravel Extension », portant des entrées au **texte strictement identique**, n'échangent aucune entrée (HIST-NAME : indices `[0,2]` contre `[1,3]`, disjoints).

## 5. Entrées globales

Une entrée sans référence structurée fiable — « Modèle d'entreprise créé », par exemple — **reste dans `app.history`** et **n'apparaît dans aucune fiche chantier** (§5/§18).

SITE-HIST-04 le vérifie sur les quatre chantiers de démonstration, pour quatre entrées globales différentes, et confirme que `app.history` conserve bien ses 10 entrées : **rien n'est supprimé**.

## 6. Anciennes entrées

**Aucune migration** (§20/§61). `SCHEMA_VERSION` reste à **8**, `STORE` reste `kanvix-product-8-3`.

HIST-LEGACY écrit quatre entrées de style ancien, **recharge complètement la page** (l'historique repasse par `localStorage` et les migrations existantes), puis vérifie la résolution :

| Entrée | Résolution | Fiche chantier |
|---|---|---|
| `taskId` seul | **keravel** (dérivé) | Keravel uniquement |
| `projectId` seul | **villa** (explicite) | Villa uniquement |
| aucune référence | **globale** | aucune |
| `taskId` invalide | **non attribuable** | aucune |

Les 4 entrées survivent, aucune n'est injectée arbitrairement.

## 7. `setIssueStatus` corrigé — **OUI**

C'était le seul point d'écriture d'historique lié à un chantier qui ne portait **aucune** référence structurée. L'incident, lui, connaît déjà son chantier et sa tâche :

```js
app.history.unshift({
  …,
  projectId: i.projectId,
  taskId: i.taskId || undefined,
});
```

SITE-HIST-06 déclenche le **vrai workflow** `setIssueStatus()` sur un incident Keravel et vérifie que l'entrée porte `projectId: "keravel"`, apparaît dans l'historique Keravel, et est **absente de Villa, Horizon et Les Terrasses**.

`projectId` est posé **en plus** de `taskId` (§22/§23) : l'attribution survit à une éventuelle suppression ultérieure de la tâche.

## 8. « Simulation … appliquée » contextualisée — **OUI**

Le rattachement est calculé **avant** `app.simulation = null`, exclusivement depuis des IDs métier — tâches réellement modifiées par le scénario, plus l'incident ciblé :

```js
let simProjects = new Set(
  app.simulation.changes.map((c) => task(c.taskId)?.projectId).filter((pid) => pid && project(pid)),
);
if (i?.projectId && project(i.projectId)) simProjects.add(i.projectId);
… projectId: simProjects.size === 1 ? [...simProjects][0] : undefined
```

Le libellé du scénario n'est jamais analysé. **Choix explicite** : si un scénario touche plusieurs chantiers, l'entrée **reste globale** plutôt que d'être attribuée arbitrairement à l'un d'eux. SITE-HIST-07 vérifie les deux branches — mono-chantier → `projectId: "keravel"` ; multi-chantiers (`k-control` + `v-facade`) → entrée globale, `historyProjectId()` renvoie `null`.

### Autre correction d'attribution

L'entrée « Photo ajoutée » ne portait `taskId` que lorsqu'une tâche était concernée : une photo rattachée au seul chantier produisait une entrée globale. `projectId` était déjà dans le contexte de la fonction — il est désormais reporté. Aucun moteur photo modifié.

### Points d'écriture audités et laissés intacts (§12/§16)

`applyReflowPlan`, `setTaskStatus`, `reconcileAfterTaskStatusChange`, `relaunchIssue`, l'éditeur universel, `requestTaskScheduleMove`, les trois entrées du parcours Reprise et `applyReworkReflow` portent **déjà** `taskId` (et `sourceTaskId` pour les cascades) : `historyProjectId()` dérive leur chantier sans qu'aucun moteur ait à changer (§13 — pas de duplication inutile).

## 9. Fiche tâche sans historique global

```diff
-          taskActivity(id) +
-          (expert ? historyHTML() : "");
+          taskActivity(id);
```

`taskActivity(id)` filtre déjà sur `h.taskId === id`. La fiche conserve donc **une seule timeline pertinente** (§10/§11).

TASK-HIST-01→03 vérifient sur le DOM du drawer : « Suivi de la tâche » présent, **0 section « Historique »**, les événements de la tâche présents, et **absents** : l'événement d'une autre tâche du même chantier, tout événement d'un autre chantier, toute entrée globale.

## 10-13. Cycle de vie du chantier

| État | Attendu | Résultat |
|---|---|---|
| **active** (§26) | historique filtré, non vide | **PASS** |
| **closed** (§27) | même nombre d'entrées, toujours filtré, lecture seule | **PASS** |
| **archived** (§28) | même timeline — rendu **strictement identique** à l'état clôturé | **PASS** |
| **restore → reopen** (§29/§30) | une seule timeline, **aucune duplication** | **PASS** |

Aucune fuite inter-chantiers à aucune étape du cycle.

## 14. SITE-HIST-01 → 10

| Test | Objet | Résultat |
|---|---|---|
| SITE-HIST-01 | Keravel voit son événement, pas celui de Villa | **PASS** |
| SITE-HIST-02 | Villa voit son événement, pas celui de Keravel | **PASS** |
| SITE-HIST-03 | Aucune fuite Terrasses ↔ Horizon (dont dérivation `sourceTaskId`) | **PASS** |
| SITE-HIST-04 | 4 entrées globales absentes des 4 chantiers, conservées dans `app.history` | **PASS** |
| SITE-HIST-05 | `taskId` seul → dérivation `keravel`, visible nulle part ailleurs | **PASS** |
| SITE-HIST-06 | `setIssueStatus()` réel → bon chantier, absent des trois autres | **PASS** |
| SITE-HIST-07 | Simulation mono-chantier rattachée ; multi-chantiers → globale | **PASS** |
| SITE-HIST-08 | Chantier clôturé : historique conservé et filtré | **PASS** |
| SITE-HIST-09 | Chantier archivé : même timeline, rendu identique | **PASS** |
| SITE-HIST-10 | Restauration + réouverture : une seule timeline, aucune duplication | **PASS** |

## 15. TASK-HIST-01 → 03

| Test | Objet | Résultat |
|---|---|---|
| TASK-HIST-01 | « Suivi de la tâche » seul, 0 section Historique globale | **PASS** |
| TASK-HIST-02 | L'événement d'une autre tâche du même chantier n'apparaît pas | **PASS** |
| TASK-HIST-03 | Aucune trace d'un autre chantier, aucune entrée globale | **PASS** |

### Tests complémentaires

| Test | Objet | Résultat |
|---|---|---|
| HIST-CROSS | Dataset A1/A2/B1/global : A = A1+A2, B = B1, fiche A1 = A1 (§45) | **PASS** |
| HIST-NAME | Noms quasi identiques + textes identiques : aucun mélange (§31/§46) | **PASS** |
| HIST-DEL | Tâche supprimée : `projectId` préserve la traçabilité (§22/§47) | **PASS** |
| HIST-PURE | Filtres purs, ordre préservé, mode global intact (§48/§24) | **PASS** |
| HIST-EMPTY | « Aucune modification récente. », jamais rempli avec d'autres chantiers (§9) | **PASS** |
| HIST-LEVELS | Onglet absent en Essentiel, présent en Pilotage (§52/§53) | **PASS** |
| HIST-PERF | 1000 entrées / 30 chantiers : filtrage exact, rendu en **quelques ms** (§49) | **PASS** |
| HIST-DARK | Mode sombre : rendu et filtrage corrects (§50) | **PASS** |
| HIST-RESP | 1920 → 390 px : aucun débordement, aucune fuite (§51) | **PASS** |
| HIST-LEGACY | 4 profils d'anciennes entrées après rechargement (§62) | **PASS** |
| HIST-SCOPE | Aucune collection ajoutée, aucune page ajoutée, STORE/SCHEMA intacts | **PASS** |

## 16. SITE-01 — **PASS**

Le finding est **fermé**. Preuve donnée à deux niveaux :

- **Données** — `historyProjectId()` renvoie le bon chantier pour chaque profil d'entrée, et `null` pour les entrées non attribuables ; les fuites croisées mesurées sur la baseline disparaissent sur la cible.
- **DOM** — l'onglet Historique de Keravel rendu par `projectTabContent('Historique','keravel')` ne contient plus `EVT-VILLA-PROJECTID`, celui de Villa ne contient plus `EVT-KERAVEL-TASKID`, et les deux rendus ne sont plus identiques.

## 17. Recette Chantiers rejouée

La suite d'audit **`recette-chantiers-v2.4.10.2.mjs` a été rejouée sans être modifiée** — c'est elle qui avait levé SITE-01.

```
==== 48 passed, 0 failed ====
==== FINDINGS (0) ====
SÉVÉRITÉS: {}
```

Détail de SITE-F5 sur la cible : `{"keravelShowsOwn":true,"keravelShowsOther":false,"terrShowsOther":false,"identical":false}`. Le bloc qui déclenchait le finding (`keravelShowsOther && identical`) n'est plus atteint. **Aucun autre scénario SITE-F1→F10 ne régresse.**

## 18. Non-régressions

| Suite | Résultat |
|---|---|
| Badges Kanban V2.4.11.3 | **165 / 165** |
| Accueil | **149 / 149** |
| Mode Chantier | **95 / 95** |
| Planning Bureau (dont PLAN-F1→F10) | **76 / 76** |
| Import intelligent | **75 / 75** |
| Réglages | **63 / 63** |
| Édition universelle des tâches | **58 / 58** |
| Chantiers (audit) | **48 / 48** |
| Recette UI / responsive V2.4.11 | **47 / 47** |
| ancien Planning | **17 / 17** |
| Résoudre — calendrier dynamique | **14 / 14** |

**29 moteurs vérifiés byte-identiques** entre V2.4.11.3 et V2.4.12 : `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `kanbanBucket`, `kanbanCard`, `kanbanBoard`, `kanbanDirectIssueLabel`, `kanbanImpactContext`, `impactChainSources`, `impactChainSet`, `getCriticalImpacts`, `gantt`, `renderTeam`, `renderSites`, `resourceLoadBoard`, `analyzeKanvixImport`, `applyImportPlan`, `alignDemoDates`, `confirmCloseProject`, `restoreProject`, `deleteProjectCascade`, `taskActivity`, `relaunchIssue`, `reconcileAfterTaskStatusChange`.

Le rendu de l'historique (titre, `.row`, diff, commentaire, date, auteur) est **inchangé** : cette version corrige le périmètre des données, pas le design (§25).

## 19. Erreurs console

**0 erreur JavaScript applicative** sur la recette historique et l'ensemble des suites rejouées.

## Question finale

> « En ouvrant l'Historique d'un chantier Kanvix, puis-je être certain que chaque événement affiché appartient réellement à ce chantier ? »

**OUI.** Chaque ligne affichée a été rattachée par un **identifiant métier** — `projectId`, `taskId` ou `sourceTaskId` —, jamais par le texte. Une entrée qui n'est pas rattachable de façon certaine reste globale et n'apparaît dans aucune fiche : le doute ne produit jamais un faux rattachement.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.12.html` — fichier complet.
2. `recette-historique-chantiers-v2.4.12.mjs` — suite (106 vérifications).
3. `rapport-recette-historique-chantiers-v2.4.12.md` — ce rapport.
4. Captures : `recette-historique-v2.4.12/` (01→05).
