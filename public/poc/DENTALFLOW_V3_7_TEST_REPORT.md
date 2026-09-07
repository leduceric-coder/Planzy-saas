# DentalFlow Next V3.7 — Rapport de tests

Base : `dentalflow-next-poc-v3.6.2.html` (143/143 PASS). Livrable : `dentalflow-next-poc-v3.7.html`.

## Suite unitaire intégrée (`?runTests=1`)

**154/154 PASS**, 0 erreur console, stable sur plusieurs exécutions consécutives.

- **134 tests V3.6.1/V3.6.2 strictement conservés, inchangés.**
- **9 tests V3.6.2 (T135-T146) strictement conservés, inchangés.**
- **1 test mis à jour** (jamais d'assertion affaiblie) : `ensureCabinetPatientsSeed: additif uniquement, ne touche jamais patientRef` s'appuyait sur l'identifiant `CMD-0197` de l'ancien seed legacy (`demoOrders`), qui n'existe plus dans le seed V8 natif normal. Réécrit avec une fixture `CMD-0197` isolée construite dans le test lui-même — vérifie exactement le même invariant (additif, `patientRef` jamais touché, nom démo correctement semé).
- **11 nouveaux tests V3.7**, un par sous-partie testable au niveau moteur du mandat.

## Détail des nouveaux tests (valeurs réelles observées)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| §73 Annulation UI | commande 185€ : disparaît de "Toutes actives", apparaît dans "Annulées", CA production −185€ | `amount:185, revDelta:185, inAllBefore:true→inAllAfter:false, inCancelledBefore:false→inCancelledAfter:true` | PASS |
| §74 Restitution | consommé A3/B2 → retour A2/B1 → stock +2/+1 → solde restant A1/B1 encore disponible | `stockDelta:{a:2,b:1}, returnableRemaining:{a:1,b:1}, hasReturnable:true` | PASS |
| §75 Comparaison semaine réelle | fixtures Lun=3/Mar=2 (semaine courante), Lun=1/Mar=4 (semaine précédente) → `computeWeeklyCompare()` reflète exactement ces deltas | `current0:3, current1:2, previous0:1, previous1:4` | PASS |
| §76 Traçabilité | Création→Empreinte→Bon imprimé→Scan Usinage→Scan Céramique→Reprise, ordre chronologique réel | `eventCount:6, hasCreation:true, hasUsinageScan:true, hasCeramiqueScan:true, hasReprise:true, chronological:true` | PASS |
| §77 Stock manuel | entrée manuelle 10 × Zircone HT, lot LOT123 → StockLot créé + RECEIPT +10 | `delta:10, lotCreated:true, lotNumberOk:true` | PASS |
| §78 Article/Prestation | nouvelle prestation + matière associée (Zircone qty1 @ Usinage) → knownDemand +1 → scan → stock −1, AUCUN changement de code | `demandDelta:-1, stockDelta:-1` | PASS |
| §79 Cycle de vie article | SUSPENDED exclu du réappro auto, ACTIVE restaure, ARCHIVED masqué de la liste normale, CLOSED définitif (refus `CLOSED_IS_FINAL`) | `afterSuspendExcluded:true, afterReactivate:true, archivedHidden:true, closedIsFinal:true` | PASS |
| §80 Pointage | facture SENT 185€ pointée → invoicePayment créé, montant = total facture, facture PAID | `paymentAdded:true, invoicePaid:true, amountMatches:true` | PASS |
| §81 Plan de charge € | commande A 185€ + commande B 420€ dues la même semaine → Valeur à livrer inclut au moins 605€, jamais de double comptage sur une commande annulée la même semaine | `totalA:185, totalB:420, val:2720 (≥605, ambiant seed inclus)` | PASS |
| §82 Droits moteur | utilisateur PRODUCTION : refusé pour pointer une facture ET pour ajuster le stock ; utilisateur ADMINISTRATIF : autorisé à pointer ; utilisateur STOCK : autorisé à ajuster le stock | `prodCantPoint:true (FORBIDDEN), adminCanPoint:true, prodCantAdjustStock:true (FORBIDDEN), stockCanAdjust:true` | PASS |
| §83 Patients 100% | toutes les commandes du seed V8 natif ont patientFirstName/patientLastName/patientRef/priceSnapshot | `total:23, emptyNameCount:0, emptyRefCount:0, noPriceCount:0` | PASS |

## Scénarios navigateur réels bout-en-bout (clics réels, contexte frais)

- **Navigation mobile complète (§97, P0)** : viewport 390×844, aucun état persisté. Bouton menu (☰) visible et cliqué → drawer ouvert (`drawerOpen:true`). Items Accueil/Commandes/Production/Messages tous visibles dans le drawer. Groupe Outils déplié → Charge/Stock/Rapports/Factures/Utilisateurs tous visibles. Clic réel sur « Stock » → navigation effective (`onStockView:true`) ET drawer refermé automatiquement (`drawerClosedAfterNav:true`). **0 erreur console, aucun débordement horizontal.**
- **Stock accessible + scan DataMatrix accessible depuis mobile (§97, test P0 explicite du mandat)** : Accueil → Menu → Outils → Stock → onglet Stock → bouton « Scanner une réception » visible et cliqué → formulaire de scan GS1/DataMatrix réellement affiché (`scanFormVisible:true`), panneau latéral ouvert. **0 erreur console.**
- **Production mobile utilisable (§101-104)** : viewport 390×844, vue Production. Board desktop à colonnes confirmé masqué (`desktopBoardVisible:false`), accordéon mobile affiché avec les 6 postes (`stageCount:6`). Poste « Usinage » déplié par tap réel → carte commande affichant `CMD-0221 / Océane Simon / Couronne zircone · Dent 16 / [statut] / Échéance Dans 4 jours / Karim · scan 15:17` — patient, prestation, dents, échéance et technicien tous présents, aucune information retirée. **0 erreur console, aucun débordement.**
- **Commandes mobile en cartes (§112-113)** : à 390px, table masquée (`tableVisible:false`), 10 cartes affichées (`cardsVisible:true, cardCount:10`) reprenant CMD/patient/prestation/cabinet/localisation/échéance. À 1440px (non-régression), la table reste affichée (`desktopTableVisible:true`, `desktopCardsVisible:false`).
- **Boot V8 natif propre** : première ouverture sans aucun état persisté → 23 commandes, 0 avec patient ou tarif manquant, 3 annulées / 2 prêtes / 7 livrées / 1 anonymisée, 4 fabricants, 5 relations service↔matière, 3 factures, 1 pointage. Clé `dentalflow-next-poc-state-v8` seule présente dans `localStorage` (avec `dentalflow-cabinet-patients-v1`, store séparé inchangé). **0 erreur console.**

## Isolation (export JSON avant/après)

`exportDentalFlowJSON()` strictement identique avant/après les 154 tests :
```
{"identical":true,"testsPass":true,"total":154,"passed":154}
```

## Responsive & console (16 combos : 4 viewports × 4 modes)

Script `full_regression.js` (`?smokeV34=1`), lab / staff / dentist / scan, 1440/1024/768/390 : **16/16 PASS**, 0 erreur console (y compris staff/dentist/scan, où le boot V8 s'exécute après remplacement complet de `document.body.innerHTML` — voir rapport d'implémentation, piège corrigé via `confirmCancelWithReturn(...,{silentUI:true})`).

## Géométrie réelle des onglets (`getBoundingClientRect`, tolérance 1px)

Script `v352_geometry.js`, Commandes / Stocks & achats / Rapports, 4 largeurs : **PASS partout**, ΔX=0.00 ΔY=0.00.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

Script `v352_theme_quick.js` : **12/12 PASS**, thème appliqué, aucun débordement horizontal, 0 erreur console.

## `node --check`

Les 3 blocs `<script>` extraits passent `node --check` sans erreur.

## Synthèse Definition of Done (mandat §131 — mobile — et §90 — général)

| Exigence | Statut |
|---|---|
| Base V8 native, une seule source de démo | ✅ (seedV8, §A) |
| Toutes les commandes ont un patient | ✅ (§83, 23/23) |
| Toutes les commandes sont valorisées | ✅ (§83, priceSnapshot 23/23) |
| Aucun KPI figé (CA dynamique) | ✅ (computeRevenueKPIs déjà dynamique, Réglé retiré de l'Accueil) |
| Aucun graphique décoratif (comparaison semaine réelle) | ✅ (§75, computeWeeklyCompare) |
| Annulation recalcule immédiatement (filtre + CA) | ✅ (§73) |
| Restitution différée proposée et fonctionnelle | ✅ (§74) |
| Traçabilité = histoire complète, dates réelles | ✅ (§76) |
| Stock manuel fonctionnel | ✅ (§77) |
| Fabricants distincts des fournisseurs | ✅ |
| Cycle de vie article respecté | ✅ (§79) |
| Article ↔ prestation configurable sans code | ✅ (§78) |
| Pointage distinct de l'Accueil, append-only | ✅ (§80) |
| Plan de charge en € correct, pas de double comptage | ✅ (§81) |
| Droits vérifiés au niveau moteur | ✅ (§82) |
| Menu mobile jamais absent (P0) | ✅ (scénario navigateur réel) |
| Stock accessible + scan accessible sur mobile (P0) | ✅ (scénario navigateur réel) |
| Production mobile utilisable, aucune info perdue | ✅ (scénario navigateur réel) |
| Tables critiques adaptées mobile (Commandes) | ✅ ; Stock/Factures/Prestations restent en fallback scroll horizontal (limite documentée) |
| Panels mobile pleine largeur | ✅ (déjà conforme V3.6.2, `width:min(100vw,560px)`) |
| 134+9 tests V3.6.2 toujours PASS | ✅ |
| Nouveaux tests PASS | ✅ (11/11) |
| Responsive PASS | ✅ (16/16) |
| Thèmes PASS | ✅ (12/12) |
| `node --check` PASS | ✅ |
| Zéro erreur console | ✅ |
