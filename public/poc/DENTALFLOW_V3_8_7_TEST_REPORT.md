# DentalFlow V3.8.7 — Rapport de tests

## Synthèse

| Suite | Résultat |
|---|---|
| `node --check` (5 blocs `<script>`) | 5/5 PASS |
| Suite persistée (`runAllTests()`) | **335/335 PASS** (317 hérités de V3.8.6 + 18 nouveaux) |
| Responsive (7 largeurs × 3 modes) | 21/21 PASS |
| Thèmes (light/dark/system × 6 vues) | 18/18 PASS |
| Isolation (export JSON avant/après suite) | Identique octet pour octet |
| Console (erreurs JS) | 0 sur l'ensemble des scénarios testés |

## Tests requis par le mandat — détail

### Partie F — Commentaires

- **COM01** — `addOrderComment(id, 'Le cabinet confirme A2.')` → `historyEvent` type `Commentaire`
  avec `actor`/`actorId`/`detail` corrects. **PASS** (persisté + parcours UI réel via clics DOM :
  bouton présent, soumission désactivée si vide, activée après saisie, `historyEvent` créé,
  contenu visible immédiatement dans la fiche).
- **COM02** — commentaire visible immédiatement dans la fiche (`_renderQuickView`). **PASS**.
- **COM03** — persistance : le commentaire est dans `serializableState().historyEvents` (ce que
  `save()` sérialise dans `localStorage`) — vérifié également par un rechargement réel de page en
  Playwright (`page.goto` puis réouverture de la fiche : commentaire toujours présent). **PASS**.
- **COM04** — commentaire vide refusé, `reason:'COMMENT_REQUIRED'`. **PASS** (persisté + garde-fou
  UI : bouton « Ajouter » reste désactivé tant que le textarea est vide).
- **COM05** — `order.workInstructions` inchangé après ajout d'un commentaire. **PASS**.

### Partie G — Accueil

- **HOME01** — aucune commande à surveiller → « Tout est sous contrôle ! » visible
  (`.watch-empty-badge` présent). **PASS**.
- **HOME02** — une commande en retard → empty-state absent, commande visible dans la liste. **PASS**.
- **HOME03** — retard résolu → empty-state revient. **PASS**.
- Vérifié en complément (Playwright) : géométrie du badge (88×88px cercle, icône 44×44px rendue),
  fond dark mode `rgba(48,209,88,.16)`, header « À surveiller »/« Tout voir (0) » inchangé.

### Partie H — Pulse Simulation

- **PULSE01** — tester l'impact d'une demande de congés réelle (parcours UI, clic sur
  `[data-whatif-req]`) : seuls les jours ouvrés de la plage testée reçoivent `.sim-day-pulse`
  (comparaison exacte des clés `data-day-key` attendues vs observées). **PASS**.
- **PULSE02** — une semaine dont le statut change reçoit `.sim-week-pulse`, jamais les autres
  (testé avec un `before` volontairement différent du statut réel actuel pour garantir un vrai
  écart, la donnée démo par défaut ne produisant naturellement aucun changement de statut de
  semaine). **PASS**.
- **PULSE03** — après l'animation (~1.6s), la classe est retirée (0 élément `.sim-day-pulse`/
  `.sim-week-pulse` restant) — vérifié en conditions réelles (Playwright, attente réelle) et par
  inspection structurelle du code (`pulseScenarioChanges()` planifie systématiquement un
  `setTimeout` de nettoyage, jamais une animation `infinite` en CSS). **PASS**.
- **PULSE04** — une semaine inchangée ne pulse jamais : `pulseScenarioChanges(before)` avec un
  `before` identique à l'état courant n'ajoute aucune classe. **PASS**.
- **PULSE05** — `prefers-reduced-motion: reduce` → aucune animation, même sur un changement réel
  forcé (testé avec `matchMedia` mocké en suite persistée ET avec un contexte navigateur Playwright
  dédié `reducedMotion:'reduce'`). **PASS** dans les deux méthodes.
- Retrait de la dernière simulation active : le calendrier repasse à son état vide, aucune erreur
  JS (le pulse est silencieusement sans effet puisque les cellules n'existent plus — comportement
  explicitement accepté par le mandat).

### Partie I — Absences planifiées

- **ABS01** — une absence approuvée (jeu de démo) est visible dans le calendrier « Absences
  planifiées » (avatar du collaborateur présent). **PASS**.
- **ABS02** — une demande de congés `pending` n'apparaît jamais (aucune trace de « Demande
  réelle »). **PASS**.
- **ABS03** — une hypothèse (`state.whatIfSims`) n'apparaît jamais dans cette section (aucune
  trace de « Hypothèse »/`sim-hyp`). **PASS**.
- **ABS04** — deux collaborateurs absents le même jour → deux avatars distincts affichés. **PASS**.
- **ABS05** — `leaveCalendarHTML()` utilise par défaut exactement `planningWeeks(8)`, le même
  horizon que la Projection et la Simulation. **PASS**.
- **ABS06** — une absence déjà approuvée n'est jamais déduite deux fois : sans scénario actif,
  `netWeekCapacity(week) === netWeekCapacity(week, whatIfLeaves())`. **PASS**.
- **ABS06-dedup** (vérification additionnelle) — le jeu de démo contient `L3` (leaveRequest
  approuvée) et `A1` (absence canonique) avec le même collaborateur et les mêmes dates :
  `approvedAbsences()` ne retourne qu'**une seule** entrée pour ce cas, jamais un doublon visuel.
  **PASS**.

## Non-régression V3.8.6

- Les 317 tests persistés de V3.8.6 (dont les 20 ajoutés lors de cette version : K01/K02, N01,
  B01-B04, S01-S03, SIM01-SIM05, CAL01-CAL05, A01-A04) passent **sans aucune modification** de leur
  code — confirmant qu'aucun comportement V3.8.6 n'a été altéré par ce correctif ciblé.
- `whatIfCalendarHTML(simLeaves)` produit un HTML strictement identique à la version V3.8.6 pour le
  mode simulation (même wrapper, testé implicitement par la totalité des tests CAL01-CAL05/SIM01-
  SIM05 hérités qui continuent de passer sans changement).
- Animations des pop-ups centrales (quick-layer, tooth-picker-layer, form-modal, pdetail-layer) et
  `openModalAnimated`/`closeModalAnimated` : non touchées, tests A01-A04 hérités toujours PASS.
- Responsive 1440/1366/1024/768/430/390/375 × LAB/STAFF/DENTIST : 21/21 PASS.
- Thèmes light/dark/system : 18/18 PASS.
- Isolation (export JSON avant/après la suite complète de 335 tests) : identique octet pour octet.

## Méthodologie

- Tests persistés exécutés en contexte navigateur réel (Chromium/Playwright,
  `window.DentalFlowTest.runAll()`), permettant l'usage direct du DOM et de `matchMedia` mocké dans
  les assertions.
- Chaque test avec effet de bord sur `state` sauvegarde via `cloneDeep(serializableState())` et
  restaure après assertion — confirmé sans pollution inter-tests par l'isolation JSON identique.
- Le parcours Commentaires a été vérifié via de **vrais clics DOM** (ouverture fiche → clic
  « + Ajouter un commentaire » → saisie → soumission → fermeture animée → réaffichage), pas
  uniquement via l'appel direct du moteur — méthodologie qui avait révélé les bugs de frontière
  IIFE en V3.8.6 ; aucun bug de ce type trouvé ici (`addOrderComment` n'a qu'un seul appelant, déjà
  dans l'IIFE ; `orderComments` a été exposée par précaution).
