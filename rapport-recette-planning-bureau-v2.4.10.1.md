# Kanvix V2.4.10.1 — Fermeture des derniers chemins de mutation non sécurisés du Planning

Source : `public/poc/kanvix-next-gen-v2.4.10.html` → cible `public/poc/kanvix-next-gen-v2.4.10.1.html`.
Le correctif du drag Gantt de V2.4.10 **n'est pas modifié**. Cette version ferme les **autres** chemins utilisateur qui contournaient encore la règle : **une tâche terminée est historique**.

## Verdict

**PASS — Planning Bureau prêt à être gelé.**

Il n'existe plus **aucun** chemin utilisateur (UI, handler, moteur central, simulation, Résoudre) permettant de rouvrir, déplacer ou supprimer une tâche terminée, ni de déplacer silencieusement une tâche en cours. « Modifier la tâche », « Drag Gantt » et « Replanifier » offrent désormais **les mêmes garanties métier**.

| Résultat | |
|---|---|
| Suite Planning Bureau V2.4.10.1 (`recette-planning-bureau-v2.4.10.1.mjs`) | **76 / 76**, **0 finding** |
| dont les 57 tests V2.4.10 rejoués | **PASS** |
| Scénarios maîtres PLAN-F1 → PLAN-F10 | **10 / 10 PASS** |
| Accueil · Mode Chantier · Réglages · Édition · Import · ancien Planning | **149 · 95 · 63 · 58 · 75 · 17** |
| Erreurs console applicatives | **0** |

## Règle métier appliquée

Une tâche `status === "done"` ne peut jamais être : remise À faire / En cours, déplacée, replanifiée, supprimée, ni déplacée par une propagation ou un scénario. Le seul parcours après réalisation est **Signaler une reprise**. La règle est protégée **dans l'UI + dans les handlers + dans les moteurs centraux**.

## Résumé des corrections (checklist §39)

| Point | Corrigé ? | Détail |
|---|---|---|
| Kanban done protégé | **OUI** | `kanbanCard` : plus de `draggable` pour une done ; `kanbanDrop` refuse défensivement (message calme, aucune mutation). |
| `setTaskStatus` done terminal | **OUI** | Garde centrale : `prevStatus === "done" && status !== "done"` → refus, aucun snapshot. N'entrave pas todo→doing→done ni les confirmations terrain. |
| Actions tâche done corrigées | **OUI** | Fiche done : « Signaler une reprise » + « Signaler problème » (consultation) ; **Modifier / Replanifier / Tester un décalage / Supprimer absents**. |
| `moveTask` unifié | **OUI** | « Replanifier » passe par `requestTaskScheduleMove` (planReflow → aperçu → applyReflowPlan). Plus de `dependencyPrompt`/`propagateDependencies`. Garde done. |
| Suppression done protégée | **OUI** | Gardes dans `deleteTask` **et** `confirmDeleteTask`. |
| Simulation done protégée | **OUI** | Scénarios via `planScheduleChanges` (planReflow) + `sanitizeScenario` ; `applySimulation` refuse tout changement ciblant une done. |
| Simulation doing arbitrée | **OUI** | `evaluateScenario.requiresArbitration` ; doing jamais déplacée ; `applySimulation` bloque l'application automatique. |
| Résoudre utilise le moteur sûr | **OUI** | `scenarioOptions` construit et assainit ses scénarios ; aucun scénario proposé ne déplace une done ni ne déplace silencieusement une doing. |

## 1–3. Kanban & moteur central de statut

- **§1** `kanbanCard(t, readOnly)` : `draggable="true"` conditionné à `!readOnly && t.status !== "done"`. Une carte terminée reste consultable et dans la colonne Terminée.
- **§2** `kanbanDrop` : garde défensive `t.status === "done" → return` + message calme (« Une tâche terminée reste dans l'historique. Signalez une reprise… »), aucun snapshot.
- **§3** `setTaskStatus` : garde métier **centrale** — `prevStatus === "done" && status !== "done"` → refus immédiat (avant snapshot). Aucun chemin UI présent ou futur ne peut rouvrir une tâche terminée. Transitions légitimes et confirmations terrain intactes.

## 4–6. Fiche, Replanifier, Suppression

- **§4** Le menu « Plus d'actions » d'une tâche terminée n'expose plus Modifier / Replanifier / Tester un décalage / Supprimer ; il conserve « Signaler problème » et le bouton primaire « Signaler une reprise ».
- **§5/§7/§8/§9** `moveTask` : garde done + délégation à **`requestTaskScheduleMove(id, add(t.start, days*DAY), "task-replan")`** — le même moteur sûr que le drag et l'éditeur. `dependencyPrompt`/`propagateNow` ne sont plus jamais atteints par un workflow de replanification (conservés en LEGACY sans appelant).
- **§6** `deleteTask` **et** `confirmDeleteTask` refusent une tâche terminée (sécurité indépendante du bouton visible).

## 7–8. Helper de déplacement commun

`requestGanttTaskMove` est devenu un wrapper de **`requestTaskScheduleMove(taskId, newStart, origin)`** (drag → `"planning-gantt"`, Replanifier → `"task-replan"`). Ce n'est **pas** un nouveau moteur : snapshot unique → `planReflow` → aperçu si impact → `applyReflowPlan` → historique → un seul Undo. Le comportement V2.4.10 du drag est **strictement identique**.

## 10–18. Simulation / Résoudre

- **§10/§11** Le scénario « Décaler la chaîne » n'utilise plus `propagateDependencies` : il est construit par **`planScheduleChanges` → `planReflow`** (aucun second moteur de propagation). Une tâche terminée en aval coupe la cascade ; une tâche en cours est signalée pour arbitrage.
- **§12** Scénario avec **done en aval** : la tâche terminée est **absente** des changements et **jamais** déplacée (test SIM-DONE).
- **§13** Scénario avec **doing en aval** : la tâche en cours n'est pas déplacée, le scénario est marqué `requiresArbitration`, et l'application automatique est bloquée (test SIM-DOING).
- **§14** `autoFixSimulation` réutilise `planScheduleChanges` (plus de boucle de propagation indépendante).
- **§15** `applySimulation` : garde défensive — refus si un changement cible une **done** ; blocage si `requiresArbitration` ; filtrage final qui ne mute jamais une done même si elle était présente (test APPLY-DEF).
- **§16** `evaluateScenario` renvoie `statusViolations {done, doing}` et `requiresArbitration` ; `valid` est faux si le scénario déplace une done.
- **§17** `scenarioOptions` assainit **tous** les scénarios (`sanitizeScenario`) : aucune recommandation Kanvix ne propose de déplacer une done ni de déplacer silencieusement une doing (test RESOLVE).
- **§18** `showWhatIf` refuse une tâche terminée.

## 19–20. Usages restants de `propagateDependencies` / `reflowSuccessors`

| Fonction | Usage | Classe |
|---|---|---|
| `propagateDependencies` | définition + récursion interne | moteur legacy |
| `propagateDependencies` | affichage **lecture seule** de la chaîne d'impact (`shifts` projetés, jamais appliqués) | **B — calcul lecture seule** (documenté §20) |
| `propagateDependencies` | via `propagateNow` ← `dependencyPrompt` | **C — legacy sans appelant** |
| `reflowSuccessors` | définition + récursion interne uniquement | **C — code mort, aucun appelant** |
| `moveTask` | → `requestTaskScheduleMove` (moteur sûr) | **A sécurisé** |

**AUCUNE mutation métier utilisateur n'utilise `propagateDependencies` ou `reflowSuccessors` sans gardes.** Le seul usage vivant de `propagateDependencies` est un calcul d'affichage en lecture seule. La suppression du code legacy (`dependencyPrompt`, `propagateNow`, `reflowSuccessors`) est laissée à un nettoyage technique ultérieur (préférence : legacy documenté plutôt que risque de régression).

## Scénarios maîtres PLAN-F1 → PLAN-F10

**10 / 10 PASS.** PLAN-F4 (drag + dépendances) reste PASS ; les nouveaux verrous (done terminal, Replanifier sûr, simulation sûre) sont couverts par les sections KAN-TERM, STATUS-TERM, DONE-ACTIONS, DONE-GUARDS, REPLAN, PARITE3, SIM-DONE, SIM-DOING, APPLY-DEF, RESOLVE.

## Tests

**76 / 76 PASS, 0 FAIL, 0 finding.** Comprend les 57 tests V2.4.10 (dont PLAN-F4) + 19 nouvelles vérifications : KAN-TERM-01/02, STATUS-TERM-01 (+ transitions légitimes préservées), DONE-ACTIONS, DONE-MOVE, DONE-DELETE, REPLAN (aperçu + successeur terminé protégé + 1 Undo), PARITE3 (Modifier = Drag = Replanifier), SIM-DONE, SIM-DOING, APPLY-DEF, RESOLVE.

## Régressions

Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition **58/58** · Import **75/75** · ancien Planning **17/17**. **Aucun FAIL.**

## Console

**0 erreur JavaScript applicative** (seule ligne réseau = coupure météo/géo simulée).

## Périmètre technique

Aucun refactoring visuel (seul changement visuel : une carte Kanban terminée n'est plus draggable). `STORE` inchangé (`kanvix-product-8-3`) ; `SCHEMA_VERSION` inchangé (**8**) ; aucune migration ; aucun nouveau moteur de propagation / Undo / historique ; Accueil / Mode Chantier / Réglages / Import / éditeur universel / drag Gantt V2.4.10 non modifiés dans leur comportement.

## Critère final de freeze

- 0 chemin utilisateur ne peut rouvrir une tâche done ✓
- 0 chemin utilisateur ne peut déplacer une tâche done ✓
- 0 chemin utilisateur ne peut supprimer une tâche done ✓
- 0 scénario Kanvix ne peut appliquer un déplacement à une done ✓
- 0 doing déplacée silencieusement ✓
- Modifier = Drag Gantt = Replanifier (garanties métier) ✓
- Kanban respecte le caractère terminal de done ✓
- Simulation / Résoudre respectent les mêmes règles ✓
- 0 moteur de mutation métier non sécurisé subsiste ✓
- PLAN-F1→F10 = PASS ✓ · suites gelées = PASS ✓ · 0 erreur console ✓

## Question finale

> « Existe-t-il encore dans Kanvix un chemin, même secondaire, qui permette de modifier l'histoire d'une intervention terminée sans créer une reprise ? »

**NON.**

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.10.1.html` — fichier complet.
2. `recette-planning-bureau-v2.4.10.1.mjs` — suite (76 vérifications).
3. `rapport-recette-planning-bureau-v2.4.10.1.md` — ce rapport.
