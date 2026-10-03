# DentalFlow Next V3.6.2 — Rapport de tests

Base : `dentalflow-next-poc-v3.6.1.html` (134/134 PASS). Livrable : `dentalflow-next-poc-v3.6.2.html`.

## Suite unitaire intégrée (`?runTests=1`)

**143/143 PASS**, 0 erreur console.

- **134 tests V3.6.1 strictement conservés, inchangés, aucune assertion affaiblie.**
- **9 nouveaux tests** (T135-T146) couvrant les 3 correctifs du mandat, avec des scénarios séquentiels réels (jamais des appels isolés en état neuf pour les deux scénarios obligatoires).

## Détail des nouveaux tests (valeurs réelles observées)

### Partie A — Retour par lot (T135-T138, un seul test combiné rejouant la séquence complète)

Séquence : RECEIPT lot A (3) + lot B (2) → CONSUMPTION −5 (allocations A3+B2) → RETURN 2 → RETURN 3 → tentative RETURN 1.

| Étape | Attendu | Observé | PASS/FAIL |
|---|---|---|---|
| Après consommation A3+B2 | `lotAvailableQty(A)=0, lotAvailableQty(B)=0` | `a:0, b:0` | PASS |
| Retour n°1 : demande 2 | allocation exacte `A2` (`lotAllocations:[{A,2}]`) | `r1AllocOk:true` | PASS |
| État après retour n°1 | `lotAvailableQty(A)=2, lotAvailableQty(B)=0` | `a:2, b:0` | PASS |
| Retour n°2 : demande 3 | allocation exacte `A1+B2` (`lotAllocations:[{A,1},{B,2}]`) | `r2AllocOk:true` | PASS |
| État après retour n°2 | `lotAvailableQty(A)=3, lotAvailableQty(B)=2` (restauration complète) | `a:3, b:2`, `finalRestored:true` | PASS |
| Retour n°3 : tentative 1 | REFUSÉ, `reason:'RETURN_EXCEEDS_CONSUMED'`, aucun nouveau mouvement | `r3refused:true, noNewMovementOnR3:true` | PASS |
| Invariant par lot | `totalReturnedOnLot ≤ totalConsumedOnLot` pour A ET B | `invariantPerLot:true` | PASS |

**Total consommé : A=3, B=2. Total retourné (avant refus) : A=3, B=2.** Conforme exactement à l'exemple chiffré du mandat.

### Partie B — `knownDemand()` respecte `restartStageId` (T139-T143)

BOM synthétique de test : A@Usinage qty2, B@Céramique qty1, C@Contrôle qualité qty1 (mêmes articles réels que la démo, `ART-ZIR-HT-001`/`ART-CER-EMX-003`/`ART-ADH-CER-008`, BOM temporaire injecté puis retiré après chaque test — jamais de pollution durable de `BILL_OF_MATERIALS`).

| Test | Scénario | Attendu (Δ demande) | Observé | PASS/FAIL |
|---|---|---|---|---|
| T139 | reprise redémarrant à Contrôle qualité | A=0, B=0, C=1 | `deltaA:0, deltaB:0, deltaC:1` | PASS |
| T140 | reprise redémarrant à Céramique | A=0, B=1, C=1 | `deltaA:0, deltaB:1, deltaC:1` | PASS |
| T141 | reprise redémarrant à Usinage | A=2, B=1, C=1 | `deltaA:2, deltaB:1, deltaC:1` | PASS |
| T142 | reprise à Céramique, puis scan réel Céramique, puis scan réel Contrôle | après reprise B=1,C=1 ; après scan Céramique B=0,C=1 ; après scan Contrôle C=0 | `afterReworkDeltaB:1, afterReworkDeltaC:1, afterScanCeramiqueDeltaB:0, afterScanCeramiqueDeltaC:1, afterScanControleDeltaC:0` | PASS |
| T143 | reprise tardive (Contrôle) — matière Usinage (A) : aucun faux réapprovisionnement | `knownDemand(A)` ET `projectedStock(A)` inchangés PAR la reprise (mesurés après la consommation initiale légitime, avant/après la reprise elle-même) | `demandUnchanged:true, projectedStockUnchanged:true` | PASS |

**Test faux réapprovisionnement (T143) : reprise créée à l'étape Contrôle qualité — `knownDemand('ART-ZIR-HT-001')` et `projectedStock('ART-ZIR-HT-001')` strictement identiques avant/après la création de la reprise (aucune `PurchaseProposal` fantôme possible).**

### Partie C — `createInvoice()` refuse les doublons (T144-T146)

| Test | Scénario | Attendu | Observé | PASS/FAIL |
|---|---|---|---|---|
| T144 | `createInvoice(['CMD-A','CMD-A'])` | refus `DUPLICATE_ORDER_ID`, aucune facture créée | `refused:true, noInvoiceCreated:true` | PASS |
| T145 | `createInvoice(['CMD-A','CMD-B','CMD-A'])` (doublon non adjacent) | refus, `orderId` identifié = CMD-A | `refused:true, noInvoiceCreated:true` | PASS |
| T146 | `createInvoice(['CMD-A','CMD-B'])` (sélection normale) | facture créée, 2 lignes correctes | `created:true, orderIdsCorrect:true` | PASS |

**Test facture doublon : `createInvoice(['CMD-A','CMD-A'])` → `{success:false, reason:'DUPLICATE_ORDER_ID', orderId:'CMD-A'}`, `state.invoices` inchangé.**

## Scénarios séquentiels obligatoires (§46-54 du mandat)

Ces deux scénarios ne sont volontairement PAS testés uniquement sur fonctions isolées en état neuf :

1. **RECEIPT→CONSUME A3/B2→RETURN2→RETURN3→ATTEMPT RETURN1** : test unique T135-T138 rejouant exactement cette séquence sur le MÊME état, chaque étape vérifiée avant de passer à la suivante — voir tableau ci-dessus. Confirmé également en clics réels navigateur (voir plus bas).
2. **INITIAL→consume→delivery→rework tardif→knownDemand→scan→knownDemand** : couvert par T139-T143 (reprise créée sur une commande déjà livrée avec un cycle INITIAL entièrement consommé) et T142 (scan réel post-reprise réduisant progressivement `knownDemand` du bon cycle).

## Isolation (export JSON avant/après)

`exportDentalFlowJSON()` strictement identique avant/après les 143 tests (`probe_isolation2.js`) :
```
{"identical":true,"testsPass":true,"total":143,"passed":143}
```

## Scénarios navigateur réels bout-en-bout (clics réels, contexte frais)

- **Retour multi-lot / retour partiel / second retour, avec vérification du stock dans l'onglet Stock** : réception réelle de 2 lots via le scanner GS1/DataMatrix (panneau « Scanner une réception », code `(01)03453120000011(17)261231(10)UILOTA` qty 3 puis `…UILOTB` qty 2 — association réelle du GTIN à Zircone HT via le formulaire d'association) → stock physique `14 → 19` (+5, conforme). Consommation réelle via **DentalFlow Scan** (poste Usinage, technicien Marc, commande CMD-0192 « Bridge 3 éléments », 2 unités) → stock physique `19 → 17` (−2, FEFO sur les 2 lots reçus). Panneau d'annulation ouvert par clic réel sur la commande : champ de retour affichant `max=2` (plafond canonique = consommé net, conforme au correctif). Premier retour partiel de 1 soumis (clic réel « Confirmer l'annulation ») → stock physique `17 → 18`. Second retour (même chemin de rendu/soumission réel — le bouton « Annuler » ne réoffre pas ce panneau sur une commande déjà annulée, comportement V3.6.1 intentionnel et non modifié par ce hotfix) : champ affichant désormais `max=1` (et non 2 : preuve directe que le plafond par lot est recalculé en tenant compte du retour déjà effectué, cœur du correctif Partie A) → retour de 1 soumis → stock physique `18 → 19`, restauration complète exacte (= stock après réception). L'onglet Stock (clic réel, navigation Outils → Stock) affiche après le premier retour la carte article mise à jour ; le libellé de la commande affiche in fine « Zircone HT — 2 sorti(s) · 2 déjà retourné(s) », cohérent avec l'invariant `retourné = consommé` après restauration complète. 0 erreur console sur l'ensemble du scénario.
- **Reprise tardive sans faux réapprovisionnement** : couvert au niveau moteur par T143 (acceptable sans UI dédiée, cette vérification porte sur `knownDemand`/`projectedStock`, valeurs internes non affichées telles quelles dans l'interface existante — mandat §42-43).
- **Facture doublon** : couvert au niveau moteur par T144-T145 (acceptable sans fabrication d'interface, mandat §41 — l'UI actuelle de sélection par cases à cocher ne permet normalement pas de produire ce cas, l'invariant est strictement moteur).

## Test-browser camera transparency

Navigateur de test toujours sans `BarcodeDetector` (comme en V3.6.1) — **CAMERA DATAMATRIX NOT AVAILABLE IN TEST BROWSER**. Code caméra non modifié par ce hotfix (conforme §42, "NE PAS le refaire"). Test réel via smartphone physique déféré, comme en V3.6.1.

## Responsive & console (16 combos : 4 viewports × 4 modes)

Script `full_regression.js` (`?smokeV34=1`), lab / staff / dentist / scan, 1440/1024/768/390 : **16/16 PASS**, 0 erreur console.

## Géométrie réelle des onglets (`getBoundingClientRect`, tolérance 1px)

Script `v352_geometry.js`, Commandes / Stocks & achats / Rapports, 4 largeurs : **PASS partout**, ΔX=0.00 ΔY=0.00.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

Script `v352_theme_quick.js` : **12/12 PASS**, thème appliqué, aucun débordement horizontal, 0 erreur console.

## `node --check`

Les 3 blocs `<script>` extraits passent `node --check` sans erreur.

## Synthèse Definition of Done (§60 du mandat)

| Exigence | Statut |
|---|---|
| Retour global toujours plafonné | ✅ (V3.6.1 préservé, `returnableQtyForOrderArticle` inchangé) |
| Retour AUSSI plafonné par lot | ✅ (T135-T138) |
| Plusieurs retours partiels successifs soldent correctement chaque lot | ✅ (T135-T138, clics réels) |
| Aucun lot ne reçoit jamais plus qu'il n'a fourni | ✅ (invariant `invariantPerLot`, T135-T138) |
| `lotAvailableQty` finale cohérente | ✅ (restauration exacte A=3,B=2, clics réels stock 14→19→17→18→19) |
| FEFO non régressé | ✅ (consommation réelle via scan respecte l'ordre des lots) |
| Reprise respecte `restartStageId` | ✅ (T139-T141) |
| Étapes amont exclues de la nouvelle `knownDemand` | ✅ (T139, T140) |
| Étape de la reprise et étapes aval incluses | ✅ (T141) |
| Scan de la reprise réduit `knownDemand` du bon cycle | ✅ (T142) |
| Reprise tardive sans faux réapprovisionnement amont | ✅ (T143) |
| `consumptionKey` de reprise toujours fonctionnel | ✅ (134 tests V3.6.1 conservés, dont le cycle INITIAL/RWK1/RWK2) |
| INITIAL/RWK1/RWK2 toujours idempotents par cycle | ✅ (tests V3.6.1 conservés N06-N09 équivalents) |
| `createInvoice` refuse tout `orderId` dupliqué | ✅ (T144, T145) |
| Aucune facture partielle créée en cas de refus | ✅ (`noInvoiceCreated`, T144-T145) |
| Facturation normale toujours fonctionnelle | ✅ (T146) |
| Scan caméra V3.6.1 non régressé | ✅ (code non modifié, tests N11-N14 conservés) |
| 134 tests V3.6.1 toujours PASS | ✅ |
| Nouveaux tests PASS | ✅ (9/9) |
| Responsive PASS | ✅ (16/16) |
| Thèmes PASS | ✅ (12/12) |
| `node --check` PASS | ✅ |
| Zéro erreur console | ✅ |
