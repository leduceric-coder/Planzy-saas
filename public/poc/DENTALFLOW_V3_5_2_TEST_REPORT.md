# DentalFlow Next V3.5.2 — Rapport de tests

Base : `dentalflow-next-poc-v3.5.1.html` (fourni comme `dentalflownextpocv3.5.1(2).html`, contenu identique au dernier commit de la branche). Livrable : `dentalflow-next-poc-v3.5.2.html`.

## Suite unitaire intégrée (`?runTests=1`)

**100/100 PASS**, 0 erreur console.

- 98 tests conservés de V3.5.1(2) (77 initiaux + 21 de l'addendum précédent horloge/confidentialité), **4 ajustés** (figent explicitement `Clock.mode='demo'` sur leur date de conception — deux tests « seconde passe » V3.4.5, un test « minimum + urgence + alternatif viable », un test « urgence extrême » — tous quatre dépendaient implicitement du jour de la semaine réel une fois l'horloge réelle par défaut ; aucune assertion affaiblie, seule la déterminisation de l'entrée a changé) + le test « slowMovingStock » déjà ajusté lors de l'addendum précédent.
- **12 tests nouveaux** :
  1. `T01` — PurchaseProposal persistée obsolète recalculée au démarrage, dates rafraîchies, aucune PurchaseOrder déplacée.
  2. `T02` — recalcul silencieux au démarrage : 3 appels consécutifs, 0 nouvel ActivityEvent.
  3. `ensureV34Model` avec `persistedV6=true` : 0 ActivityEvent créé par le recalcul silencieux au chargement.
  4. `T03-T06` — `orderDueDate()` : Aujourd'hui/Demain/Après-demain/Dans N jours/Hier/Il y a N jours, horloge figée 2026-08-31 10:00, correspondance exacte jour+heure sur les 6 cas.
  5. `T07` — `knownDemand()` respecte « Dans 3 jours » (n'est plus comptée comme besoin immédiat à horizon 0, entre normalement à horizon suffisant).
  6. QR — payload = `order.id` uniquement (interception de `qrSvg()`), aucune trace de « Marie »/« Dupont » dans la Quick View labo ni dans la fiche imprimée, `patientRef` et `order.id` bien présents sur la fiche, bouton Imprimer présent.
  7. Scan — `ScanEvent` = orderId + poste/technicien du **contexte** passé à `recordScan()`, jamais dérivés d'un contenu de QR.
  8. QR stable — `recordScan()` ne modifie jamais `o.id` ni le payload encodé.
  9. `T08` — reset le lendemain **sans reload** : horloge figée sur un jour, `resetDemoV6()`, horloge déplacée au jour suivant, `resetDemoV6()` à nouveau → la date de la `PurchaseOrder` de démo change bien et correspond exactement au nouveau jour.
  10. `T18-T20` — tous les boutons `[data-approve-proposal]` (carte « À traiter » et panneau « Pourquoi ? ») contiennent `money(p.total)` ; WAIT affiche « Commander quand même ».
  11. `T21` — libellé du filtre Échéance renommé « Aujourd'hui / en retard », ancien libellé absent.
  12. `T_render` — 20 changements d'onglet Stocks & achats consécutifs : 0 nouvel ActivityEvent.

## Isolation (export JSON avant/après)

Export `exportDentalFlowJSON()` strictement identique avant/après exécution de la suite de 100 tests. Aucune fuite d'état entre tests.

## Géométrie réelle des onglets (`getBoundingClientRect`, X **et** Y, tolérance 1px)

Script dédié (`v352_geometry.js`), mesure réelle en navigateur — `#page-title`, `#page-subtitle`, `#search`, la barre de filtres (`.filters`) et la barre d'onglets (`.stock-tabs`) — avant/après cycle complet des sous-vues, aux 4 largeurs :

| Viewport | Commandes (tous filtres) | Stocks & achats (4 onglets) | Rapports (2 onglets) |
|---|---|---|---|
| 1440×900 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 |
| 1024×800 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 |
| 768×1024 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 |
| 390×844 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 | ΔX=0.00 ΔY=0.00 |

**PASS** partout (`scrollbar-gutter: stable`, déjà en place depuis V3.5.1, confirmé toujours efficace).

## Responsive & console (16 combos : 4 viewports × 4 modes)

Script `full_regression.js` (`?smokeV34=1`), labo / staff / cabinet / scan, 1440/1024/768/390 : **16/16 PASS**, 0 erreur console.

## Thèmes (12 combos : 4 viewports × 3 thèmes, 4 vues)

Script dédié (`v352_theme_quick.js`, navigation directe par URL — le menu Outils reste, comme depuis la V3.3, entièrement masqué en dessous de 860px, hors périmètre de ce hotfix) : thème appliqué correctement (`data-theme`), aucun débordement horizontal, 0 erreur console sur les 12 combinaisons × 4 vues (Accueil/Commandes/Stocks & achats/Rapports) = 48 vérifications.

## Scénario navigateur réel bout-en-bout (`v352_addendum_probe.js`)

Contexte frais (aucun état persisté), exécuté le jour même (lundi 31 août 2026) :

- `Clock.mode === 'real'` dès le premier chargement.
- Sous-titre Accueil = « Voici la vue d'ensemble de votre laboratoire — lundi 31 août 2026 » (correspond exactement à `new Date().toLocaleDateString('fr-FR',...)`).
- Aucune chaîne `due` de commande de démo ne contient de date calendaire absolue codée en dur.
- **Recalcul silencieux confirmé en conditions réelles** : après un `reload()` d'un état déjà persisté, `state.activityEvents.length` est strictement inchangé (le recalcul a bien eu lieu — les propositions restent cohérentes — sans qu'aucun événement ne soit journalisé).
- Quick View labo : QR visible (`<svg>` réel dans le DOM), bouton « Imprimer la fiche » présent.
- Clic réel sur « Imprimer la fiche » (avec `window.print` neutralisé pour l'automatisation) : `#print-area` contient un QR SVG, l'identifiant de commande et la référence patient (`patientRef`).
- Scan : saisie de l'identifiant de commande dans le champ du portail Scan autonome (`?mode=scan`) + touche Entrée (simulant une douchette USB/Bluetooth) → `ScanEvent` créé avec le bon `orderId`.
- Suite interne complète (100 tests) toujours PASS dans cette même session, avec de vraies données en mémoire.
- 0 erreur console sur l'ensemble du scénario.

Rejoué également le scénario complet de confidentialité cabinet de l'addendum précédent (création de commande avec nom patient, isolation inter-cabinets, persistance au reload, recherche labo, export) : **aucune régression**, 100/100 toujours PASS dans cette session.

## Audit hardcoding de dates

Recherche de `2026-08-`, `17/18/19/20/21/25/26/27 août` dans le fichier livré : les seules occurrences restantes sont (a) la valeur par défaut de `Clock.demoDate` (lue uniquement si `Clock.mode==='demo'`, jamais le mode par défaut), (b) un test autonome de calendrier métier (date explicite passée en paramètre, indépendant de Clock), et (c) des littéraux internes à des tests explicitement figés (`Clock.mode='demo'` posé et restauré dans le test lui-même, ou données de fixture volontairement obsolètes pour `T01`). Aucune ne pilote le comportement normal du POC.

## `node --check`

Les 3 blocs `<script>` extraits passent `node --check` sans erreur.

## Synthèse Definition of Done (§73 du mandat)

| Exigence | Statut |
|---|---|
| Clock application = real | ✅ |
| Clock test peut être figé | ✅ |
| PurchaseProposals recalculées au startup réel | ✅ (T01, probe réel) |
| Aucune PO historique déplacée | ✅ (T01) |
| Startup ne pollue pas le Journal | ✅ (T02, probe réel) |
| Après-demain = J+2 | ✅ (T03-T06) |
| Dans N jours / Hier / Il y a N jours | ✅ (T03-T06) |
| knownDemand utilise les bonnes échéances | ✅ (T07) |
| Plus de baseNow fonctionnel figé | ✅ (Journal + Plan de charge corrigés) |
| Reset se cale sur le jour réel (sans reload) | ✅ (T08) |
| Accueil affiche le jour réel | ✅ |
| QR visible fiche commande labo + imprimée | ✅ |
| QR = order.id uniquement, aucune donnée patient | ✅ |
| QR stable toute la vie de la commande | ✅ |
| Scan QR (saisie clavier) identifie la bonne commande | ✅ (probe réel) |
| Poste/technicien du contexte Scan, jamais du QR | ✅ |
| Fiche papier sans nom patient | ✅ |
| Cabinet affiche nom+prénom, Lab uniquement patientRef | ✅ (non régressé) |
| Recherche/exports Lab sans nom patient | ✅ (non régressé) |
| ORDER_NOW / WAIT (« quand même ») avec montant | ✅ (T18-T20) |
| BLOCKED sans bouton Commander | ✅ (non régressé) |
| Filtre « Aujourd'hui / en retard » | ✅ (T21) |
| Géométrie réelle PASS (X et Y, 1px) | ✅ |
| Aucun render ne crée d'ActivityEvent parasite | ✅ (T_render) |
| Responsive / thèmes PASS | ✅ (16/16, 12/12) |
| Tous les anciens tests PASS | ✅ (98/98 conservés) |
| Tous les nouveaux tests PASS | ✅ (12/12) |
| node --check PASS | ✅ |
| Zéro erreur console | ✅ |
