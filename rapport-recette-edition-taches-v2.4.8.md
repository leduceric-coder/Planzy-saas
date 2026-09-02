# Kanvix V2.4.8 — Édition universelle des tâches

Source de vérité : `public/poc/kanvix-next-gen-v2.4.8.html` (copie intégrale de v2.4.7, aucune régression).
**Un seul moteur** de modification, **un seul moteur** de propagation, **un seul moteur** de statut — réutilisés partout.

## Verdict

**PASS.** L'édition d'une tâche est désormais possible depuis **tous les plannings** (Gantt Jour/Semaine/Mois/Année, Kanban, vues filtrées, Planning Mode Chantier) via **une seule interface** et **un seul moteur**, sans jamais dupliquer la logique existante.

| Suite | Résultat |
|---|---|
| Édition universelle V2.4.8 (`recette-edition-taches-v2.4.8.mjs`) | **58 / 58** |
| Planning non-régression (`recette-planning-v2.4.8.mjs`) | **17 / 17** |
| Accueil — gelé (`recette-accueil-v2.4.5.mjs` rejoué sur v2.4.8) | **149 / 149** |
| Mode Chantier — gelé (`recette-mode-chantier-v2.4.6.mjs` rejoué) | **95 / 95** |
| Réglages — gelé (`recette-reglages-v2.4.7.mjs` rejoué) | **63 / 63** |
| **Total** | **382 / 382** |

**0 erreur JavaScript applicative.** Les seules lignes réseau (`ERR_FAILED` / `ERR_TUNNEL_CONNECTION_FAILED`) proviennent de la coupure météo/géo **volontairement simulée** dans les tests.

## 1. Un point d'entrée unique — `openTaskEdit(taskId, origin)`

Toute modification, quelle que soit la vue, passe par `openTaskEdit`. Le paramètre `origin` (`planning-gantt`, `field-planning`, `planning-kanban`…) ne sert qu'à **revenir au contexte** d'appel — jamais à changer les règles. Une seule fonction construit l'éditeur, une seule (`submitTaskEdit`) applique.

## 2. Consultation d'abord, action ensuite (§32)

Un clic sur une barre Gantt ou une carte Kanban ouvre la **consultation** (drawer / popup), **pas** l'éditeur. La modification est un **second temps** explicite : bouton « ✎ Modifier la tâche » (Bureau) / « ✎ Modifier » (Mode Chantier). Vérifié P8.

## 3. Points d'entrée couverts

- **Gantt** (Jour/Semaine/Mois/Année) : fiche → « Modifier la tâche ».
- **Kanban** : carte → même fiche → « Modifier la tâche » (l'édition **reste** en Kanban — EDIT-05).
- **Mode Chantier** : popup tâche → « Modifier » → éditeur mobile (reste field, jamais Bureau — EDIT-06).
- **Vues filtrées** : l'éditeur ne réinitialise ni la période, ni les filtres, ni la vue.

## 4. Champs éditables (et un seul non éditable)

Nom · Intervenant · Couleur (si couleur réelle) · Début / Fin · Statut · Dépendances (multi-prédécesseurs) · Commentaire de modification.
**Le chantier n'est JAMAIS modifiable** (§8) : affiché en lecture seule (`.te-readonly`, « Le chantier d'une tâche ne se modifie pas ici. »). Aucun `<select name=projectId>` dans l'éditeur (EDIT-01).

## 5. Tâche terminée protégée (§9)

`openTaskEdit` **refuse** une tâche `done` (garde en tête de fonction). La fiche d'une tâche terminée ne propose pas « Modifier la tâche » mais **« Signaler une reprise »** (parcours SAV inchangé). La tâche d'origine reste terminée. Vérifié EDIT-08.

## 6. Lecture seule (§10)

Chantier `archived` / `closed` : `openTaskEdit` refuse (via `canEditProject`) et aucun bouton « Modifier la tâche » n'apparaît. Vérifié EDIT-09.

## 7. Statut manuel ≠ confirmation terrain (§11 / §12 / §48)

Le changement de statut depuis l'éditeur **réutilise le moteur central `setTaskStatus`** — pas de second moteur — via deux options rétro-compatibles :
`{ transactional: true }` (aucun snapshot propre, l'éditeur gère la transaction) et `{ manual: true }` (**aucun** signal terrain `field-start` / `field-done`, historique explicite « statut modifié manuellement : X → Y »). Le comportement par défaut (Kanban, Artisan, drawer) est **strictement inchangé** (P3, P4). Vérifié EDIT-07.

## 8. Diff réel (§13)

`submitTaskEdit` ne journalise que les champs **réellement** modifiés (comparaison à `state.before`). Aucun changement → **aucun** snapshot, **aucun** historique, **aucun** save (§54).

## 9. Propagation : le bon moteur, au bon moment (§14 / §15)

- Nom / Couleur / Commentaire → **aucune** propagation.
- Début / Fin / Dépendances → propagation via **`planReflow` puis `applyReflowPlan`** (les moteurs existants), jamais une nouvelle logique.

## 10. Aperçu AVANT application (§16 / §17)

`planReflow` est un **planificateur pur** (dry-run, sans mutation) : son plan `{shifts, doing, done}` alimente l'aperçu. **`applyReflowPlan`** applique — mêmes règles, un seul code. L'aperçu (bloc **Modification** + bloc **Impact**) s'affiche **dès qu'il existe une conséquence aval** — décalages **ou** intervention en cours à arbitrer — puis **Annuler / Appliquer**. « Annuler » restaure tout (undo du snapshot) : aucune donnée, aucun historique modifié (EDIT-02b).

## 11. Terminées jamais déplacées (§18)

Une tâche `done` en aval **coupe** la cascade et ne bouge pas (règle `planReflow` existante). Signalée « non déplacée » dans l'aperçu.

## 12. En cours = arbitrage, jamais silencieux (§19)

Une tâche `doing` en aval n'est **jamais** déplacée automatiquement : elle est signalée dans l'aperçu « ⚠ N intervention(s) en cours — conservée(s) en position (arbitrage) » **avant** application. C'est cette exigence qui a motivé l'unique correctif POC de cette recette : l'aperçu se déclenche désormais aussi quand la seule conséquence est un arbitrage (pas seulement des décalages). Vérifié EDIT-02.

## 13. Cycles refusés avant validation (§21)

`taskCreatesCycle` bloque toute dépendance créant une boucle : message inline « Dépendance impossible : « … » créerait une boucle. », aucune mutation. Vérifié EDIT-04.

## 14. Dépendances lisibles (§22 / §23)

Prédécesseurs présentés par **nom + dates + statut** (cases à cocher, recherche si > 6), jamais des identifiants. Multi-prédécesseurs réels (C dépend de A **et** B, jamais A→B→C imposé). Les **successeurs** sont affichés en **lecture seule**. Vérifié EDIT-04.

## 15. Historique groupé (§24 / §25)

**Une** entrée principale « … modifiée. » listant tous les champs changés (+ commentaire), et des entrées système concises « replanifiée automatiquement suite à la modification de « X » » pour chaque décalage auto. Vérifié HIST (Nom + Intervenant + Dates → 1 entrée).

## 16. Undo transactionnel unique (§26 / §27)

**Un seul** `snapshot()` couvre la modification **et** toute la propagation : l'éditeur pose le snapshot, `setTaskStatus` est appelé en `transactional` (pas de snapshot), `applyReflowPlan` n'en pose pas. Un seul « Annuler » (Undo) restaure la source **et** la chaîne. Vérifié EDIT-01, EDIT-02 (`undoStack === 1`).

## 17. Kanban = statut uniquement (§31)

Le glisser-déposer Kanban continue de ne changer **que** le statut (`setTaskStatus(id, status, "kanban")`), sans toucher aux dates ni créer de faux signal terrain. Vérifié P3.

## 18. Mode Chantier préservé (§33 / §34 / §35)

« Modifier » ouvre l'éditeur **mobile** (champs terrain d'abord, dépendances en section repliable « avancé »). Après enregistrement, retour au **Planning Mode Chantier** — jamais au Bureau, jamais de Gantt desktop ni de sidebar. Vérifié EDIT-06.

## 19. Formulaire : validation inline, dirty-guard, barre d'action collante (§37 / §38 / §39)

- Validation **près du champ** (nom obligatoire ; fin > début ; dépendances même chantier / sans boucle) — jamais un simple toast ; le drawer reste ouvert tant que c'est invalide (VALID).
- Abandon avec modifications non enregistrées → confirmation.
- **Barre d'action collante** (Annuler / Enregistrer) avec `safe-area-inset-bottom`.

## 20. Mobile 375 / 390 / 430 (§39)

Éditeur **sans scroll horizontal** aux trois largeurs, barre d'action présente. Vérifié RESP.

## 21. Thème sombre + synchronisation locale (§40 / §41)

- Éditeur et aperçu d'impact **lisibles en sombre** (variables de thème uniquement, aucune couleur codée en dur). Vérifié DARK.
- Modification propagée **sans F5** à un autre onglet (Gantt → Kanban) via la synchro locale existante. Vérifié EDIT-10 (2 onglets, HTTP).

## 22. Accessibilité + périmètre technique

- Labels natifs, boutons `<button>`, statut en `role="radiogroup"` + `aria-checked`, champ Nom focusable clavier. Vérifié A11Y.
- **Aucun** nouveau moteur : réutilisation stricte de `planReflow`, `applyReflowPlan`, `setTaskStatus`, `snapshot`/`undo`, `app.history`, `taskCreatesCycle`.
- `SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé — aucune migration nécessaire (§63).
- **Diff v2.4.7 → v2.4.8 strictement confiné** : CSS de l'éditeur, 3 points d'entrée (2 Bureau + 1 Mode Chantier), signature `setTaskStatus` (options rétro-compatibles) et le bloc moteur de l'éditeur. **Aucune** ligne d'Accueil / Mode Chantier / Réglages / rendu Gantt / rendu Kanban / reflow touchée (INTERDIT §64 respecté).

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.8.html` — fichier complet (source de vérité).
2. `recette-edition-taches-v2.4.8.mjs` — 58 vérifications (EDIT-01 → EDIT-10 + validation, historique, responsive, dark, a11y, synchro).
3. `recette-planning-v2.4.8.mjs` — 17 vérifications de non-régression du moteur de planification.
4. `rapport-recette-edition-taches-v2.4.8.md` — ce rapport.
5. Captures : `recette-edition/` (aperçu d'impact + arbitrage, éditeur sombre, éditeur mobile 390, Mode Chantier) et `recette-planning/` (Gantt, Kanban).
