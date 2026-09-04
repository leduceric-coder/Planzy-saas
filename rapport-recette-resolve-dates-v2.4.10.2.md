# Kanvix V2.4.10.2 — Calendrier dynamique des scénarios Résoudre

Source : `public/poc/kanvix-next-gen-v2.4.10.1.html` → cible `public/poc/kanvix-next-gen-v2.4.10.2.html`.
Correctif ciblé : suppression des dernières dates métier absolues codées en dur dans un scénario Résoudre. Aucun autre comportement du Planning n'est modifié.

## Verdict

**PASS.** Ouvrir Kanvix à n'importe quelle date produit des scénarios Résoudre **calculés relativement au planning courant**. Plus aucune date runtime figée en août 2026 ; aucune tâche terminée replanifiable ; toutes les suites précédentes restent PASS.

| Résultat | |
|---|---|
| Recette dates Résoudre (`recette-resolve-dates-v2.4.10.2.mjs`, RES-DATE-01→06) | **14 / 14** |
| Planning Bureau V2.4.10.1 rejoué | **76 / 76**, 0 finding |
| Accueil · Mode Chantier · Réglages · Édition · Import · ancien Planning | **149 · 95 · 63 · 58 · 75 · 17** |
| Erreurs console applicatives | **0** |

## Le défaut corrigé

`scenarioOptions()` — scénario **« Maintenir le jalon »** — contenait des dates absolues (`2026-08-17T17:00`, `2026-08-18T…`) pour k-lining / k-paint / k-final. Kanvix réaligne pourtant les données de démo sur la date réelle via `alignDemoDates()` (depuis `SEED_TODAY = 2026-08-13`) : ces dates devenaient obsolètes dès qu'on ouvrait la démo après août 2026 (ex. proposer « 10 sept. → 18 août »).

## Correction (§1–§4)

Le scénario « Maintenir le jalon » est désormais **entièrement calculé au runtime** :

- **Cible** = date **actuelle** du jalon Keravel (`app.milestones.find(m => m.projectId === "keravel").date`, sinon `project("keravel").baselineEnd`).
- **Source décalée** = `add(task("k-windows").start, 2*DAY)` / `add(task("k-windows").end, DAY)` (relatif à `app.tasks`).
- **Compression** = la chaîne aval (k-lining → k-paint → k-final) est répartie séquentiellement entre la fin décalée des fenêtres et le jalon, la dernière intervention finissant **exactement sur le jalon** (via `localDateTime`, aucune date littérale).

**Aucune date métier absolue ne subsiste dans `scenarioOptions()`.** Le scénario « Décaler la chaîne » (A) utilisait déjà `planScheduleChanges` (relatif) depuis V2.4.10.1.

## Intention préservée (§3 / §8)

« Maintenir le jalon » (B) reste distinct de « Décaler la chaîne » (A) : B **comprime** la chaîne pour tenir la date du jalon, A **accepte le retard** et propage. Mesuré à `?now=2026-09-04` :

| Scénario | Date finale | Retard chantier |
|---|---|---|
| A — Décaler la chaîne | 2026-09-14 | +3 j |
| B — Maintenir le jalon | **2026-09-09 (= jalon)** | **0 j** |

Les métriques (date finale, retard, tâches déplacées, conflits) proviennent des changements réellement proposés, calculés par `evaluateScenario`.

## Moteur sûr respecté (§4)

Les changements calculés restent soumis à `sanitizeScenario()` puis `evaluateScenario()` : aucune tâche terminée n'est déplacée, aucune tâche en cours n'est déplacée silencieusement (`requiresArbitration`). RES-DATE-06 confirme qu'un scénario runtime s'applique proprement (1 Undo, 0 référence orpheline, état valide).

## startWhatIf — garde défensive (§10)

`startWhatIf(id, days)` refuse désormais une tâche terminée (`task(id)?.status === "done" → return`), en plus de `showWhatIf()` qui la protégeait déjà. La sécurité métier ne dépend plus du seul bouton précédent (RES-DATE-05).

## Recherche des dates figées (§11)

| Emplacement | Dates absolues | Statut |
|---|---|---|
| `INITIAL_STATE` (seed de démo, `alignDemoDates`) | oui | **autorisé** |
| `scenarioOptions()` | **aucune** (après correction) | conforme |
| `showWhatIf` / `startWhatIf` | aucune (`addBusinessDays`, relatif) | conforme |
| `autoFixSimulation` | aucune (`planScheduleChanges`) | conforme |
| `applySimulation` | aucune | conforme |

Aucune date métier absolue ne subsiste dans un scénario calculé au runtime.

## Tests (§13)

| Test | Résultat |
|---|---|
| RES-DATE-01 — `now=2026-09-04` : aucune date d'août, tout en septembre, aucun retour dans le passé | **PASS** |
| RES-DATE-02 — `now=2026-11-12` : recalculé autour de novembre, aucune date août/septembre figée | **PASS** |
| RES-DATE-03 — `now=2026-08-13` : fonctionne sur le seed | **PASS** |
| RES-DATE-04 — « Maintenir le jalon » ≠ « Décaler la chaîne » (B tient le jalon, retard 0 ≤ A) | **PASS** |
| RES-DATE-05 — `startWhatIf(done)` / `showWhatIf(done)` : aucune simulation créée | **PASS** |
| RES-DATE-06 — application d'un scénario runtime : 1 Undo, 0 orpheline, état valide | **PASS** |

## Non-régression (§12)

Planning Bureau **76/76** (0 finding) · Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition **58/58** · Import **75/75** · ancien Planning **17/17**. PLAN-F1→F10 restent PASS.

## Console (§14) & périmètre (§15)

**0 erreur JavaScript applicative.** `STORE` inchangé (`kanvix-product-8-3`), `SCHEMA_VERSION` inchangé (**8**), aucune migration. Diff v2.4.10.1 → v2.4.10.2 strictement confiné : suppression des 6 dates absolues du scénario « Maintenir le jalon » + construction runtime, et garde `done` dans `startWhatIf`. Gantt / Kanban / drag / éditeur / Replanifier / planReflow / applyReflowPlan / Accueil / Mode Chantier / Réglages / Import non modifiés.

## Critère final

Ouvrir Kanvix à n'importe quelle date future produit des scénarios Résoudre calculés relativement au planning courant — **aucune date runtime figée en août 2026, aucune tâche terminée replanifiable, toutes les suites précédentes PASS.** ✓

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.10.2.html` — fichier complet.
2. `recette-resolve-dates-v2.4.10.2.mjs` — suite (14 vérifications, RES-DATE-01→06).
3. `rapport-recette-resolve-dates-v2.4.10.2.md` — ce rapport.
