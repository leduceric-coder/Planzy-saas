# Kanvix V2.4.10 — Sécurisation du drag & drop Gantt (unification avec le moteur d'édition universelle)

Source : `public/poc/kanvix-next-gen-v2.4.9.1.html` → cible `public/poc/kanvix-next-gen-v2.4.10.html`.
Référence de recette : `rapport-recette-planning-bureau-v2.4.9.1.md` (PASS AVEC RÉSERVES, 2 BLOCKER / 2 MAJOR / 1 MINOR sur le drag).

## Verdict

**PASS — Planning Bureau prêt à être gelé.**

Le glisser-déposer du Gantt utilise désormais **le même moteur sûr** que « Modifier la tâche ». **Il n'existe plus deux logiques métier pour décaler une tâche.** Les 5 findings de la recette précédente sont corrigés ; PLAN-F1 → PLAN-F10 sont PASS ; toutes les suites gelées restent PASS ; 0 erreur console.

| Résultat | |
|---|---|
| Suite Planning Bureau V2.4.10 (`recette-planning-bureau-v2.4.10.mjs`) | **57 / 57**, **0 finding** |
| Scénarios maîtres PLAN-F1 → PLAN-F10 | **10 / 10 PASS** (PLAN-F4 devient **PASS**) |
| Accueil · Mode Chantier · Réglages · Édition · Import · ancien Planning | **149 · 95 · 63 · 58 · 75 · 17** |
| Erreurs console applicatives | **0** |

## 1. Nouveau flux `dropTask`

Avant (V2.4.9.1) : `dropTask` mutait `start`/`end` immédiatement → `save`/`render` → *puis* `dependencyPrompt` → `propagateDependencies` (moteur sans gardes).

Désormais : `dropTask` **ne mute plus rien**. Il traduit le geste (colonne cible → nouvelle date de début, heure conservée) et délègue au helper d'entrée **`requestGanttTaskMove(taskId, newStart)`**, qui passe par le chemin sûr :

```
DROP → requestGanttTaskMove → (durée conservée) → snapshot unique
     → planReflow() → si impact : APERÇU (showTaskEditImpact)
     → applyReflowPlan() → historique → save/render → UN seul Undo
```

## 2. Moteur utilisé

**`planReflow` (aperçu, sans mutation) + `applyReflowPlan` (application)** — exactement le chemin de l'éditeur universel, via `showTaskEditImpact` / `applyTaskEditReflow` / `cancelTaskEditPreview` **réutilisés tels quels**. `requestGanttTaskMove` n'est **pas** un nouveau moteur : il ne réimplémente ni cascade, ni détection done, ni arbitrage doing, ni dépendances.

## 3. Aperçu avant mutation

Si le déplacement impacte d'autres tâches, le **même** aperçu que l'éditeur s'ouvre (bloc **Modification** + bloc **Impact** : décalages, tâches terminées non déplacées, arbitrage des tâches en cours) avec **Annuler / Appliquer la modification**. Aucune donnée aval n'est modifiée tant que « Appliquer » n'est pas cliqué (P-01a). Sans impact, pas d'aperçu inutile : application directe via le moteur central (snapshot + historique).

## 4. Protection des tâches terminées

- **Rendu** : `canDragTask` conceptuel = `advanced && !readOnly && t.status !== "done"`. La barre d'une tâche terminée ne porte plus `draggable="true"` ni `ondragstart`.
- **Garde défensive** dans `dropTask` (`t.status === "done" → return`) **et** dans `requestGanttTaskMove` (message calme « Une tâche terminée ne peut pas être déplacée. Signalez une reprise… », aucune mutation).

## 5. Arbitrage des tâches en cours

Une tâche **en cours en aval** n'est **jamais** déplacée en silence : elle est signalée dans l'aperçu (« ⚠ N intervention(s) en cours — conservée(s) en position (arbitrage) ») via `planReflow`, exactement comme l'éditeur. Une tâche **source** en cours reste déplaçable (l'éditeur l'autorise) et passe par le même aperçu — pas de règle spécifique au Gantt.

## 6. Historique du drag

`requestGanttTaskMove` produit une entrée d'historique **au même format que l'éditeur** : `{ text: "<tâche> modifiée.", author:"Eric", taskId, changes:[Début, Fin] }`. Les décalages automatiques réutilisent les traces système de `applyReflowPlan` (« replanifiée automatiquement suite à la modification de « X » »). Aucun second format d'historique (P-03).

## 7. Undo

**Drag utilisateur + toute la propagation = UN SEUL Undo.** `requestGanttTaskMove` pose un unique `snapshot()`, `applyReflowPlan` n'en pose pas. Undo restaure simultanément la source et toute la chaîne (vérifié : source + successeurs reviennent, `undoStack` +1).

## 8. Parité éditeur / drag (§29)

Test fondamental : même état initial, décalage de **+4 jours** (avec propagation).
- TEST A : « Modifier la tâche » → +4 j.
- TEST B : drag Gantt → +4 j.

**État métier final strictement identique** (dates de toutes les tâches, statuts, nombre de snapshots Undo). Le glisser rejoint les garanties de l'éditeur, qui reste la référence (non modifié).

## 9–13. État des findings

| Finding | Sévérité | Statut V2.4.10 | Preuve (test) |
|---|---|---|---|
| **P-01a** — pas d'aperçu avant mutation | MAJOR | **CORRIGÉ** | Aperçu ouvert avant application ; aval intact tant que non confirmé. |
| **P-01c** — successeur terminé déplacé | BLOCKER | **CORRIGÉ** | Tâche terminée en aval jamais déplacée (planReflow) ; 1 snapshot. |
| **P-01d** — successeur en cours déplacé en silence | MAJOR | **CORRIGÉ** | Aperçu mentionne « en cours » ; doing non déplacée. |
| **P-02** — tâche terminée déplaçable | BLOCKER | **CORRIGÉ** | Barre non draggable + gardes `dropTask`/`requestGanttTaskMove` ; message calme. |
| **P-03** — drag non journalisé | MINOR | **CORRIGÉ** | Entrée « … modifiée. » avec Début/Fin. |

## 14. Scénarios maîtres PLAN-F1 → PLAN-F10

| Scénario | V2.4.9.1 | V2.4.10 |
|---|---|---|
| PLAN-F1 Navigation | PASS | PASS |
| PLAN-F2 Filtres / parité Gantt-Kanban | PASS | PASS |
| PLAN-F3 Édition universelle | PASS | PASS |
| **PLAN-F4 Drag + dépendances** | **FAIL** | **PASS** |
| PLAN-F5 Kanban (statut seul) | PASS | PASS |
| PLAN-F6 Analyse | PASS | PASS |
| PLAN-F7 Lecture seule | PASS | PASS |
| PLAN-F8 Conditions dégradées | PASS | PASS |
| PLAN-F9 Multi-onglets | PASS | PASS |
| PLAN-F10 Export PDF | PASS | PASS |

## 15. Tests Planning V2.4.10

**57 / 57 PASS, 0 FAIL, 0 finding.** Couvre : captures A→N, PLAN-F1/F2/F3, **PLAN-F4** (aperçu, P-01a/c/d, parité, Undo, annulation, 0 orpheline), drag indépendant (durée conservée, pas d'aperçu inutile, historique — P-03), PLAN-F5 (Kanban statut seul, pas de faux terrain), statuts internes, PLAN-F7 (lecture seule + gardes drag), **tâche terminée** (barre non draggable + gardes — P-02), analyse (baseline/impact/conflits), création, collapse (20 cycles), synchro multi-onglets, responsive 1920→900 (0 scroll de page), console.

## 16. Suites gelées (rejouées sur v2.4.10)

Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition des tâches **58/58** · Import intelligent **75/75** · ancien Planning **17/17**. **Aucune régression.**

## 17. Erreurs console

**0 erreur JavaScript applicative** pendant toute la recette (seule ligne réseau = coupure météo/géo simulée).

## 18. Usages restants de `propagateDependencies()` (§57)

Le drag Gantt ne l'appelle **plus**. La fonction est conservée (legacy documenté, pas de suppression risquée dans ce patch) et reste employée par :

1. **`moveTask` → `dependencyPrompt` → `propagateNow` → `propagateDependencies`** : action « Replanifier » (+1 jour) du menu contextuel de la fiche tâche.
2. **Scénarios de simulation / Résoudre** : précalcul des changements d'un scénario (`scenarioOptions`).
3. **Affichage en lecture seule** de la chaîne d'impact (projection des décalages, sans mutation).
4. Sa propre récursion interne.

Un commentaire **LEGACY** a été ajouté au-dessus de sa définition : « ne pas utiliser pour de nouvelles modifications de planning ». Sa suppression (et l'alignement de « Replanifier » sur le moteur sûr) pourra faire l'objet d'un nettoyage technique ultérieur.

## Périmètre technique

Aucun framework ajouté ; `STORE` inchangé (`kanvix-product-8-3`) ; `SCHEMA_VERSION` inchangé (**8**) ; aucun nouveau moteur de propagation / Undo / historique ; collections métier et import inchangés. Kanban (statut seul via `setTaskStatus(..., "kanban")`) et éditeur universel **non modifiés**. Diff v2.4.9.1 → v2.4.10 strictement confiné à : `dropTask` (réécrit), `requestGanttTaskMove` (nouveau helper UX), le gating `draggable` des tâches terminées, et le commentaire LEGACY de `propagateDependencies`.

## Question finale

> « Le conducteur peut-il maintenant déplacer une tâche directement dans le Gantt avec exactement le même niveau de sécurité que s'il utilisait Modifier la tâche ? »

**OUI.** Même moteur, même aperçu, mêmes protections (terminée / en cours), même historique, même Undo transactionnel — parité vérifiée par test.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.10.html` — fichier complet.
2. `recette-planning-bureau-v2.4.10.mjs` — suite (57 vérifications, PLAN-F4 en PASS + parité).
3. `rapport-recette-planning-bureau-v2.4.10.md` — ce rapport.
4. Captures : `recette-planning-bureau-v2410/` (A→N + `drag-preview.png` = aperçu d'impact déclenché par un glisser).
