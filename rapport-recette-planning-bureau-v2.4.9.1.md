# Recette Planning Bureau Kanvix V2.4.9.1

Audit **en lecture seule** de `public/poc/kanvix-next-gen-v2.4.9.1.html`. **Aucune ligne du POC n'a été modifiée.** Les problèmes sont observés, reproduits, classés et documentés ; les corrections feront l'objet d'une version distincte.

## Verdict

**PASS AVEC RÉSERVES.**

Le Planning Bureau est **fonctionnellement solide** sur la navigation, les filtres, la parité Gantt/Kanban, l'éditeur universel, la lecture seule, l'analyse (baseline/dépendances/chaîne d'impact/conflits), la synchronisation multi-onglets, le responsive desktop/tablette et le thème sombre — **0 erreur console applicative**, toutes les zones gelées restent PASS.

**MAIS il n'est pas encore prêt à être gelé.** Le **glisser-déposer du Gantt** emprunte un **second moteur de propagation** (`dropTask` → `dependencyPrompt` → `propagateNow` → `propagateDependencies`) **distinct** du moteur sûr de l'éditeur universel (`planReflow` / `applyReflowPlan`). Ce chemin **contourne** les garanties métier : pas d'aperçu avant application, tâches **terminées déplaçables**, tâches **en cours déplacées silencieusement**. Le scénario **PLAN-F4 échoue** (2 BLOCKER, 2 MAJOR).

### Réponse à la question centrale (§2 / §79)

> « Un conducteur peut-il modifier, arbitrer et comprendre son planning depuis Kanvix sans risquer de créer silencieusement une incohérence qu'il ne voit pas ? »

- **Via l'éditeur universel (« Modifier la tâche ») : OUI.** Aperçu d'impact, tâche terminée protégée, arbitrage explicite des tâches en cours, un seul Undo — parfaitement sûr.
- **Via le glisser-déposer du Gantt : NON.** Le déplacement s'applique sans aperçu, une tâche terminée peut être déplacée, une tâche en cours peut être décalée en silence. **C'est le point qui bloque le gel du Planning.**

## Scénarios maîtres

| Scénario | Intitulé | Priorité | Verdict |
|---|---|---|---|
| PLAN-F1 | Navigation temporelle | P0 | **PASS** |
| PLAN-F2 | Multi-chantiers / filtres + parité Gantt/Kanban | P0 | **PASS** |
| PLAN-F3 | Édition universelle depuis le planning | P0 | **PASS** |
| PLAN-F4 | Drag Gantt + dépendances | P0 | **FAIL** (P-01a, P-01c, P-01d, P-02) |
| PLAN-F5 | Kanban (statut uniquement) | P0 | **PASS** |
| PLAN-F6 | Analyse (baseline / deps / impact / conflit / Résoudre) | P1 | **PASS** |
| PLAN-F7 | Historique / lecture seule (chantier clôturé) | P0 | **PASS** |
| PLAN-F8 | Conditions dégradées (1280 / dark / densité) | P1 | **PASS** |
| PLAN-F9 | Multi-onglets | P1 | **PASS** |
| PLAN-F10 | Export PDF | P2 | **PASS** (câblage vérifié) |

**Critère de validation §79 :** PLAN-F1→F5 et F7 doivent être PASS **et 0 BLOCKER**. F1→F3, F5, F7 sont PASS, mais **PLAN-F4 est FAIL avec 2 BLOCKER** → le Planning **ne satisfait pas** le critère de gel en l'état.

## Résultats par zone

| Zone | État |
|---|---|
| **Gantt** | Rend correctement Jour/Semaine/Mois/Année ; barres, aujourd'hui, weekends, projets repliables OK. |
| **Kanban** | 3 colonnes, cartes, dépendances lisibles ; **parité exacte** avec le Gantt (même source). |
| **Périodes** | Jour/Semaine/Mois/Année + ← / Aujourd'hui / → ; ancre conservée, filtres stables. |
| **Filtres** | Chantier + ressource ; parité Gantt/Kanban ; état vide propre + « Réinitialiser les filtres ». |
| **Édition** | Éditeur universel depuis Gantt **et** Kanban ; contexte (filtre/période/vue) conservé ; 1 Undo. |
| **Drag Gantt** | ⚠ **Contourne le moteur sûr** — voir findings P-01a/c/d et P-02. |
| **Dépendances** | Flèches SVG attachées aux bonnes barres ; relations parallèles lisibles ; stables après collapse (20 cycles). |
| **Analyse** | Baseline (avec/sans reste), chaîne d'impact, comptage de conflits fidèle (0 inventé, conflit réel détecté). |
| **Résoudre** | Nudge « Examiner » présent quand conflit ; transition/retour Planning sans mutation avant application. |
| **Lecture seule** | Chantier clôturé : bandeau, pas de « + Tâche », **aucune barre draggable**, éditeur refusé, drag bloqué par `guardEditable`, navigation OK. |
| **Export** | `exportPlanningPDF()` : classe `planning-print`, `window.print()`, nettoyage sur `afterprint` ; retour UI normal. |
| **Responsive** | 1920→900 : **aucun scroll horizontal de page** (le Gantt scrolle en interne, conforme). |
| **Dark** | Gantt/Kanban/baseline/deps/impact/éditeur/lecture seule lisibles. |
| **Synchronisation** | Édition onglet A (Gantt) reflétée onglet B (Kanban) sans F5. |
| **Undo** | Édition, drag Gantt, drag Kanban, propagation : Undo restaure l'état métier. |
| **Historique** | Éditeur (« modifiée ») et moveTask (« déplacée au… ») journalisent ; **le drag Gantt ne journalise rien** (P-03). |

## Findings

### P-01 — Le glisser-déposer du Gantt contourne le moteur d'édition universelle

| Champ | Détail |
|---|---|
| **ID** | P-01 (a / c / d) |
| **Sévérité** | **P-01c = BLOCKER** · P-01a = MAJOR · P-01d = MAJOR |
| **Scénario** | PLAN-F4 (§20, §21) |
| **Étapes** | Pilotage → Planning → glisser une tâche possédant des successeurs (ou provoquer un conflit de dépendance) → « Propager le décalage ». |
| **Observé** | `dropTask()` **applique le déplacement immédiatement** (`save()`+`render()`) puis, s'il y a conflit, propose `dependencyPrompt` (**après coup**). « Propager le décalage » appelle `propagateDependencies()`, un moteur qui **déplace tout successeur** dont `start < prédécesseur.end` **sans vérifier le statut** : une tâche **terminée** en aval est déplacée (k-lining : 17/08 → 19/08), une tâche **en cours** en aval est déplacée **en silence**. |
| **Attendu** | Le même comportement que l'éditeur universel (`planReflow`/`applyReflowPlan`) : **aperçu AVANT application**, tâche terminée **jamais déplacée** (coupe la cascade), tâche en cours **jamais déplacée en silence** (arbitrage explicite). |
| **Preuve** | `planReflow('k-windows',{end:…})` renvoie `done:['k-lining']` sans shift (moteur sûr) ; `propagateDependencies('k-windows')` renvoie un changement de dates pour k-lining terminée **et** en cours. |
| **Capture** | `O-drag-conflit-prompt.png`, `J-conflit.png` |

### P-02 — Une tâche terminée reste déplaçable au glisser sur le Gantt

| Champ | Détail |
|---|---|
| **ID** | P-02 |
| **Sévérité** | **BLOCKER** (§73 : « tâche terminée déplacée ») |
| **Scénario** | §36 / §21 |
| **Étapes** | Pilotage → passer une tâche à « Terminée » → glisser sa barre sur le Gantt. |
| **Observé** | `canDrag = advanced && !readOnly` **ignore le statut** : la barre d'une tâche terminée porte `draggable="true"` et `dropTask()` la déplace (13/08 → 10/08). L'éditeur universel, lui, **refuse** correctement d'éditer une tâche terminée. |
| **Attendu** | Une tâche terminée ne doit **jamais** être déplaçable depuis le planning : `canDrag` (ou `dropTask`) devrait exclure `status === "done"`, comme l'éditeur, et renvoyer vers « Signaler une reprise ». |
| **Preuve** | `#bar-k-windows[draggable="true"]` avec `task('k-windows').status === "done"` ; `dropTask` modifie `start`/`end`. |
| **Capture** | `A-gantt-semaine.png` (contexte), reproduction automatisée dans la suite (`[DONE]`). |

### P-03 — Le glisser-déposer ne journalise aucune entrée d'historique

| Champ | Détail |
|---|---|
| **ID** | P-03 |
| **Sévérité** | MINOR |
| **Scénario** | §58 (historique) |
| **Étapes** | Glisser une tâche indépendante → consulter l'historique. |
| **Observé** | `dropTask()` ne fait **aucun** `app.history.unshift(...)`. Le déplacement par glisser n'apparaît pas dans la timeline (alors que `moveTask` écrit « déplacée au… » et l'éditeur « modifiée »). Undo reste possible (snapshot). |
| **Attendu** | Une entrée d'historique cohérente avec les autres actions de replanification. |
| **Capture** | — (comportement non visuel ; reproduit dans `[DRAG-INDEP]`). |

## Frictions UX

- **Deux façons de replanifier aux garanties différentes.** « Modifier la tâche » (sûr, avec aperçu) et le glisser-déposer (immédiat, non sûr) coexistent sans que l'utilisateur sache que l'un protège et l'autre non. Source de confusion et de risque (lié à P-01/P-02).
- **`dependencyPrompt` réactif.** Le conflit n'est signalé qu'**après** que le déplacement est déjà enregistré ; « Conserver les dates » laisse volontairement un planning incohérent (badge de conflit), ce qui est un choix acceptable mais peu explicite.
- **Vue Année.** Techniquement correcte, mais la densité rend la lecture macro peu actionnable sur un grand nombre de tâches courtes (friction, pas un bug).

## Gaps produit

- **Aperçu d'impact au glisser.** L'aperçu existe pour l'éditeur mais pas pour le glisser-déposer, alors que c'est le geste le plus rapide et le plus risqué.
- **Traçabilité du glisser** dans l'historique (P-03).

## Points forts

- **Éditeur universel exemplaire** : aperçu, protection des tâches terminées, arbitrage des tâches en cours, un seul Undo, contexte conservé.
- **Parité Gantt/Kanban parfaite** : strictement la même source de données, mêmes filtres, même période.
- **Lecture seule inviolable** sur chantier clôturé : aucun point d'entrée de mutation (éditeur, drag, +Tâche) ne passe.
- **Analyse fidèle** : 0 conflit inventé, conflit réel correctement compté ; baseline/impact propres à l'activation/désactivation.
- **Robustesse** : 20 cycles collapse, 0 dérive ; responsive 1920→900 sans scroll de page ; 0 erreur console applicative ; synchro multi-onglets fonctionnelle.

## Recommandations (max 5 — NON implémentées)

1. **Unifier le glisser-déposer sur le moteur sûr** : faire passer `dropTask` par `planReflow` + aperçu (`showTaskEditImpact`) + `applyReflowPlan`, exactement comme l'éditeur universel. Supprimerait P-01a/c/d.
2. **Exclure les tâches terminées du glisser** : `canDrag` (et garde dans `dropTask`) doit tenir compte de `status === "done"`. Supprimerait P-02.
3. **Retirer/retirer progressivement `propagateDependencies`** au profit de `applyReflowPlan` (un seul moteur de propagation, cohérent avec le principe « un moteur par concept »).
4. **Journaliser le glisser** dans `app.history` avec le même vocabulaire que les autres replanifications. Supprimerait P-03.
5. **Aperçu au drop** : au lieu d'appliquer puis prompt, calculer le plan au `drop` et proposer aperçu/appliquer/annuler avant toute mutation.

## Tableau de synthèse (§75)

| Zone | Fonctionnel | Métier | UX | Responsive | Verdict |
|------|-------------|--------|----|------------|---------|
| Gantt | OK | OK | OK | OK | PASS |
| Kanban | OK | OK | OK | OK | PASS |
| Périodes | OK | OK | OK | OK | PASS |
| Filtres | OK | OK | OK | OK | PASS |
| Édition | OK | OK | OK | OK | PASS |
| Drag Gantt | OK | **KO** | Friction | OK | **FAIL** (2 BLOCKER, 2 MAJOR) |
| Dépendances | OK | OK | OK | OK | PASS |
| Analyse | OK | OK | OK | OK | PASS |
| Lecture seule | OK | OK | OK | OK | PASS |
| Export | OK | OK | OK | OK | PASS |

## Résumé final (§78)

- **Scénarios maîtres :** PLAN-F1 ✅ · F2 ✅ · F3 ✅ · **F4 ❌** · F5 ✅ · F6 ✅ · F7 ✅ · F8 ✅ · F9 ✅ · F10 ✅.
- **Suite d'audit (`recette-planning-bureau-v2.4.9.1.mjs`) :** 50 assertions PASS / 0 FAIL.
- **Findings :** 5 — **BLOCKER : 2** (P-01c, P-02) · **MAJOR : 2** (P-01a, P-01d) · **MINOR : 1** (P-03) · COSMETIC : 0.
- **Frictions UX :** 3 · **Gaps produit :** 2.
- **Erreurs console applicatives :** **0** (seule ligne réseau = coupure météo/géo simulée, hors périmètre).
- **Suites gelées (rejouées sur v2.4.9.1, POC inchangé) :** Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition **58/58** · Import **75/75** · Planning non-régression **17/17** → **457/457**.

**Conclusion :** le Planning Bureau est à un excellent niveau **sauf** sur le glisser-déposer du Gantt, qui doit être réunifié avec le moteur d'édition universelle **avant tout gel**. Une fois P-01 et P-02 corrigés (version distincte), le Planning pourra être déclaré VALIDÉ.

## Livrables

1. `rapport-recette-planning-bureau-v2.4.9.1.md` — ce rapport.
2. `recette-planning-bureau-v2.4.9.1.mjs` — suite d'audit Playwright (50 vérifications + reproduction des findings).
3. Captures : `recette-planning-bureau/` (A→N + O-drag-conflit-prompt).
