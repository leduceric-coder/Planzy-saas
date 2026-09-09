# DentalFlow V3.8.6 — Rapport de tests

## Synthèse

| Suite | Résultat |
|---|---|
| `node --check` (5 blocs `<script>`) | 5/5 PASS |
| Suite persistée (`runAllTests()`) | **317/317 PASS** (297 hérités de V3.8.5 + 20 nouveaux V3.8.6) |
| Responsive (7 largeurs × 3 modes) | 21/21 PASS |
| Thèmes (light/dark/system × 6 vues) | 18/18 PASS |
| Isolation (export JSON avant/après suite) | Identique octet pour octet |
| Console (erreurs JS) | 0 sur l'ensemble des scénarios testés |

## Tests requis par le mandat — détail

### Partie A — KPI

- **K01** — créer 10 commandes actives, en annuler 1 → « En production » passe de 10 à 9
  immédiatement (sans rechargement). **PASS** (test persisté + vérification Playwright par
  mutation d'état réelle).
- **K02** — commande avec `late=true`, `blocked=true`, échéance aujourd'hui, puis annulée → compte
  0 dans les 4 KPI opérationnels (`getDistributionBucket` retourne `null`, `isOrderLate`/
  `isOrderBlocked` retournent `false`, exclue de `operationalOrders().filter(isDueToday)`). **PASS**.

### Partie B — Notification

- **N01** — notification catégorie `messages` → `notifIcon()` retourne `'message'` (jamais `'info'`),
  `icon('message')` retourne un SVG valide (bulle de dialogue). **PASS**.

### Partie C — DFSelect

- **S01** — sur la vue Commandes, `#order-status-filter` est enveloppé dans `.dfselect`, bouton
  custom visible. **PASS** (persisté + Playwright multi-pages : stock/users/cabinets).
- **S02** — sélectionner « Prêtes à livrer » via l'UI custom : `select.value` mis à jour, événement
  `change` déclenché et propagé au handler métier réel (`state.orderStatusFilter` + reset de
  `state.ordersPage`). **PASS**.
- **S03** — clavier : `Enter` ouvre, `ArrowDown`×2 déplace l'option active, `Enter` sélectionne,
  ré-ouverture puis `Escape` referme. `role="combobox"` + `aria-expanded` confirmés. **PASS**.
- Vérifié en complément (Playwright) : dark mode (contraste bouton/popover correct),
  `prefers-reduced-motion: reduce` → `transition-duration` du popover = `0s`.

### Partie D — Blocage de commande

- **B01** — `blockOrder(id, '   ')` (motif vide) → refusé, `reason:'COMMENT_REQUIRED'`. **PASS**.
- **B02** — `blockOrder(id, 'Validation de la teinte en attente')` → `flags.blocked=true`,
  `historyEvent` `'Blocage'` avec acteur + commentaire présents, KPI Bloquées +1. **PASS**
  (persisté + parcours UI réel via clics DOM, qui a révélé et permis de corriger le bug de
  frontière IIFE `currentBlockEvent`).
- **B03** — `unblockOrder(id)` → `flags.blocked=false`, `historyEvent` `'Blocage levé'`, KPI -1.
  **PASS** (parcours UI réel qui a révélé et permis de corriger le bug de frontière IIFE
  `unblockOrder`).
- **B04** — commande annulée → `blockOrder()` refusé, `reason:'ORDER_CANCELLED'`, aucun bouton
  « Bloquer la commande » dans la fiche. **PASS**.

### Partie E — Cohérence Simulation

- **SIM01** — charge d'une semaine dans `scenarioWeekMetrics()` = exactement `weekChargeToDeliver()`
  (source réelle des commandes dues), jamais une valeur synthétique différente. **PASS**.
- **SIM02** — `weekLoadStatus(10, 8)` → 80 % → `'ok'` (À l'aise). Une hypothèse retirant 2 de
  capacité → `weekLoadStatus(8, 8)` → 100 % → `'tight'` (Tendu) — même moteur, même valeur en
  Projection et en Simulation. **PASS**.
- **SIM03** — `weekLoadStatus(7, 8)` → 114 % → `'over'` (Surcharge), cohérent partout. **PASS**.
- **SIM04** — vérifié par introspection du code source (`whatIfImpact.toString()` +
  `scenarioWeekMetrics.toString()`) qu'aucune des deux fonctions ne référence plus
  `weekForecast`/`ORDER_BOOK`, et que ces identifiants sont `undefined` dans le moteur — suppression
  complète confirmée. **PASS**.
- **SIM05** — une commande annulée dans la semaine simulée fait baisser `scenarioWeekMetrics(i,[])
  .load` de exactement 1 (n'est plus comptée). **PASS**.
- Test de cohérence croisée additionnel (Playwright) : le point de tension affiché dans le
  calendrier inline pour une semaine donnée correspond EXACTEMENT au `status` retourné par
  `scenarioWeekMetrics()` pour cette même semaine, avant et après ajout d'une hypothèse — même
  moteur, même valeur, aucune divergence observée.

### Parties F/G/H/I — Calendrier du scénario

- **CAL01/CAL02** — `whatIfSectionHTML()` ne contient plus `id="whatif-cal"` ni le texte
  « Voir le calendrier du scénario » ; le bloc `.chg-cal-block` est présent (calendrier ou état vide)
  sans aucune interaction requise. **PASS**.
- **CAL03/CAL04** — hypothèse simulée sur un collaborateur → les jours ouvrés concernés portent la
  classe `sim-hyp` (bordure violette + fond teinté), l'avatar/les initiales du collaborateur
  apparaissent dans la cellule, le titre du mois est affiché en majuscules (ex. « SEPTEMBRE 2026 »),
  la légende à 3 puces (Absence planifiée / Demande testée / Hypothèse) est présente. **PASS**.
- **CAL05** — retirer l'hypothèse du scénario fait disparaître `sim-hyp` immédiatement du HTML
  régénéré, et l'état vide « Aucune absence simulée » réapparaît. **PASS**.
- Vérifié en complément (Playwright) : une demande réelle testée (ex. Julie Moreau) produit bien la
  classe `sim-real` (orange) et non `sim-hyp`.

### Partie J — Animations

- **A01** — après `openQuickView()`, `#quick-layer` porte la classe `open`,
  `transition-duration` > 0 sur l'overlay ET sur `.quick-card`, état final visible
  (`opacity:1`, `transform: matrix identité`). **PASS**.
- **A02** — `closeModalAnimated()` retire `open` **immédiatement** (dans le même tick) mais le
  contenu de `#quick-body` n'est PAS effacé dans ce même tick (le nettoyage est reporté dans
  `afterClose`, exécuté après le délai d'animation) — confirmé par test persisté synchrone et par
  Playwright (opacité encore à 1 juste après l'appel, puis 0 + `pointer-events:none` +
  contenu vidé après ~250ms). **PASS**.
- **A03** — Le handler global `keydown` sur `Escape` appelle `closeQuickView()`, exactement le même
  chemin que le bouton de fermeture — vérifié par inspection du code source ET par simulation
  réelle de la touche Echap (comportement identique à un clic sur `#quick-close`). **PASS**.
- **A04** — Avec `prefers-reduced-motion: reduce` simulé (`matchMedia` mocké côté test persisté,
  contexte Playwright `reducedMotion:'reduce'` côté test navigateur réel), `closeModalAnimated()`
  détecte le mode réduit et exécute `afterClose()` sans attendre le délai de 200ms — la fermeture
  n'est jamais bloquée. **PASS** dans les deux méthodes de vérification.
- Sanity check complémentaire : ouverture/fermeture du sélecteur de dents (`tooth-picker-layer`)
  toujours fonctionnelle après le passage au modèle d'animation centralisé.

## Méthodologie

- Tests persistés exécutés dans un contexte navigateur réel (Chromium/Playwright,
  `window.DentalFlowTest.runAll()`), permettant l'usage direct du DOM dans les assertions.
- Chaque test métier avec effet de bord sur `state` sauvegarde l'état via
  `cloneDeep(serializableState())` puis le restaure après assertion — aucun test ne pollue les
  suivants (confirmé par l'isolation JSON avant/après identique).
- Les bugs de frontière IIFE (Partie D) ont été découverts en testant via de **vrais clics DOM**
  plutôt qu'en appelant les fonctions moteur directement — méthodologie volontairement plus stricte
  que les appels directs, qui auraient masqué le `ReferenceError` réel rencontré par un utilisateur.
