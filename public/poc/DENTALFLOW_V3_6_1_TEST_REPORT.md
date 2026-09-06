# DentalFlow Next V3.6.1 — Rapport de tests

Base : `dentalflow-next-poc-v3.6.html`. Livrable : `dentalflow-next-poc-v3.6.1.html`.

## Suite unitaire intégrée (`?runTests=1`)

**134/134 PASS**, 0 erreur console, stable sur 3 exécutions consécutives.

- **115 tests strictement conservés** de V3.6, inchangés.
- **3 tests mis à jour** (jamais d'assertion affaiblie) :
  1. `Consommation au double scan idempotente` — la clé de consommation intègre désormais le cycle (`::INITIAL` pour une fixture sans reprise, voir Partie C du hotfix) ; assertion de clé mise à jour, l'assertion d'idempotence elle-même (2 scans → 1 seul mouvement) reste strictement identique.
  2. `V3.6/V3.6.1 Partie M/C` (ex-« V3.6 Partie M ») — même correction de clé (`::INITIAL`).
  3. `V3.6.1 Partie E/P` (ex-« V3.6 Partie P ») — **réécrit** : le hotfix inverse explicitement la V3.6 sur ce point précis (une commande en facture DRAFT reste « à facturer » au lieu d'en sortir immédiatement). L'assertion d'origine est directement contredite par le mandat hotfix ; la version réécrite couvre strictement plus de cas (les 2 notions — éligibilité à une nouvelle facture / statut économique — sont vérifiées séparément, plus la libération par annulation de facture).
- **16 nouveaux tests** couvrant les 22 points numérotés du mandat (certains points combinés dans un même test lorsqu'ils forment un seul scénario cohérent — détail ci-dessous).

## Détail des nouveaux tests (valeurs réelles observées)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| N01 — lotAvailableQty() intègre lotAllocations | 10 reçus → 8 après consommation de 2 | `after10:10, after8:8` | PASS |
| N02 — FEFO séquentiel A(3)/B(10), consume 2 puis 3 | A→1,B→10 puis A→0,B→8 ; allocations exactes | `aAfter1:1,bAfter1:10,aAfter2:0,bAfter2:8,alloc1Correct:true,alloc2Correct:true` | PASS |
| N03 — sur-retour (100 sur consommation de 1) refusé | aucun mouvement créé, stock inchangé | `refused:true,noMovementCreated:true,stockUnchanged:true` | PASS |
| N04 — retours cumulés jamais > consommation (5 : 2 ok, 4 refusé, 3 ok) | returnable 5→3→3, total retourné 5 | `returnable0:5,r1ok:true,returnable1:3,r2refused:true,returnable2:3,r3ok:true,totalReturned:5` | PASS |
| N05 — commande totalement retournée ne peut refaire un retour | returnable=0, refus | `r1ok:true,r2refused:true` | PASS |
| N06-N09 — cycle initial consomme, reprise 1 reconsomme, double scan reprise 1 idempotent, reprise 2 reconsomme | 3 mouvements CONSUMPTION distincts (1 par cycle), total consommé = 3 | `initialConsumed:true,initialCycleOk:true,rwk1FirstConsumed:true,rwk1DoubleScanIdempotent:true,activeAfterRwk1IsRwk1:true,activeAfterRwk2IsRwk2:true,rwk2Consumed:true,rwk2MovsCount:1,totalConsumptionMovements:3,totalConsumedQty:3` | PASS |
| N10 — consommation de reprise utilise FEFO/lotAllocations | allocation présente, cycle ≠ INITIAL | `hasAllocations:true,cycleIsRework:true` | PASS |
| N11 — détection caméra DataMatrix, jamais de faux bouton | navigateur de test sans BarcodeDetector → supported=false, documenté | `hasBarcodeDetectorApi:false,checkedNow:true,supportedNow:false` — **CAMERA DATAMATRIX NOT AVAILABLE IN TEST BROWSER** | PASS |
| N12-N13 — caméra ouverte/fermée réellement si supportée, sinon jamais de flux actif | stopCameraScan() sûr et idempotent, aucun stream ne peut rester actif | `noStreamBefore:true,streamAlwaysNullAfterStop:true,flagResetByStop:true` — **CAMERA NOT AVAILABLE IN TEST BROWSER**, ouverture réelle non exerçable ici | PASS |
| N14 — repli manuel/douchette fonctionne intégralement | parseGS1Code() correct sur code manuel | `manualFlowWorks:true` | PASS |
| N15-N17 — DRAFT bloque une 2e facture, ISSUED reste bloqué, CANCELLED libère | true→false→false→true | `availableInitially:true,availableAfterDraft:false,availableAfterIssued:false,availableAfterCancelledInvoice:true` | PASS |
| N18 — createInvoice() refuse une commande non livrée | refus, aucune facture créée | `refused:true,noInvoiceCreated:true` | PASS |
| N19 — createInvoice() refuse une sélection multi-cabinets | refus, aucune facture créée | `refused:true,noInvoiceCreated:true` | PASS |
| N20 — date de facture imprimée = issuedAt, jamais Clock.now() à la réimpression | date affichée = date d'émission même 18 jours après | `issuedDateIso:'2026-09-02T09:00:00.000Z', displayDate: identique` | PASS |
| N21 — recherche « Marie » : tableau Commandes et recherche globale trouvent la même commande | les deux trouvent | `inTable:true,inGlobal:true` | PASS |
| N22 — commande anonymisée introuvable par le nom réel (tableau + global), trouvable par patientRef | nom→false partout, ref→true partout | `foundByNameTable:false,foundByNameGlobal:false,foundByRefTable:true,foundByRefGlobal:true` | PASS |

## Scénarios séquentiels obligatoires (§67 du mandat)

Ces deux scénarios ne sont volontairement PAS testés uniquement sur fonctions isolées en état neuf :

1. **RECEIVE → CONSUME → CONSUME → CANCEL → RETURN** : couvert par N01/N02 (réception + consommations successives avec allocation FEFO correcte à chaque étape) puis N03/N04/N05 (annulation avec plafond de retour recalculé après chaque retour déjà effectué).
2. **INITIAL PRODUCTION → DELIVERY → REWORK1 → CONSUME → REWORK2 → CONSUME** : couvert intégralement par N06-N09 (test unique rejouant exactement cette séquence, avec vérification à chaque étape intermédiaire) + confirmé en clics réels navigateur (voir ci-dessous).

## Isolation (export JSON avant/après)

`exportDentalFlowJSON()` strictement identique avant/après les 134 tests, sur 2 exécutions consécutives.

## Scénarios navigateur réels bout-en-bout (clics réels, contexte frais)

- **Retour sur-plafonné via l'UI réelle** : commande avec 1 unité consommée, panneau d'annulation ouvert par clic réel, `max` du champ = 1 (reflète le plafond canonique, pas la quantité brute sortie), valeur forcée à 999 et formulaire soumis directement (contournant la validation native du navigateur) → refus confirmé au niveau moteur, stock physique inchangé, commande **non** annulée (statut resté `progress`) : preuve que le refus est bien transactionnel (aucun effet de bord partiel).
- **Reprise consommant réellement à nouveau** : commande créée → bon de suivi imprimé (clic réel) → scan Usinage réel (consomme 1) → livrée → panneau Reprise ouvert par clic réel → étape Usinage sélectionnée → formulaire soumis → nouveau scan Usinage réel → stock physique diminue à nouveau de 1 (total −2 sur les deux cycles). 0 erreur console sur l'ensemble du scénario.
- **Scan stock — repli manuel confirmé, aucun faux bouton caméra** : panneau « Scanner une réception » ouvert par clic réel ; formulaire de saisie manuelle présent ; aucun bouton `#stock-scan-camera-start` dans le DOM (cohérent avec `BarcodeDetector` absent de ce navigateur) ; message de repli affiché.
- **Facture DRAFT → Émise, via clics réels** : commande livrée → onglet À facturer → sélection → « Créer la facture » (clic réel) → facture en statut `DRAFT` → KPI « À facturer » **inchangé** (vérifié par comparaison stricte avant/après création de la facture) → clic réel sur « Émettre » → KPI « Facturé » augmente en conséquence.
- **Recherche harmonisée, via clics réels** : commande cabinet créée avec patiente « Chantal Girard » → recherche « Chantal » dans le champ du tableau Commandes → ligne trouvée ; même recherche dans la barre globale (`#search`) → résultat trouvé dans la pop-up.

Ensemble de ces scénarios : **0 erreur console** (`PAGEERROR`/`CONSOLE error`), vérifié à chaque exécution.

## Responsive & console (16 combos : 4 viewports × 4 modes)

Script `full_regression.js` (`?smokeV34=1`), labo / staff / cabinet / scan, 1440/1024/768/390 : **16/16 PASS**, 0 erreur console.

## Géométrie réelle des onglets (`getBoundingClientRect`, tolérance 1px)

Script `v352_geometry.js`, Commandes / Stocks & achats / Rapports, 4 largeurs : **PASS partout**, ΔX=0.00 ΔY=0.00.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

Script `v352_theme_quick.js` : **12/12 PASS**, thème appliqué, aucun débordement horizontal, 0 erreur console.

## `node --check`

Les 3 blocs `<script>` extraits passent `node --check` sans erreur.

## Synthèse Definition of Done (§81 du mandat)

| Exigence | Statut |
|---|---|
| lotAvailableQty diminue après consommation | ✅ (N01) |
| lotAllocations participent au solde du lot | ✅ (N01) |
| Aucun double comptage lot | ✅ (convention lotAllocations prioritaire, vérifiée par construction) |
| FEFO fonctionne sur plusieurs consommations successives | ✅ (N02) |
| Lot expiré jamais auto-consommé | ✅ (invariant V3.6 préservé, revérifié après correctif) |
| RETURN ≤ consommation nette | ✅ (N03, N04) |
| Impossible de fabriquer du stock via annulation | ✅ (N03-N05, plafond recalculé à chaque appel) |
| Double retour impossible | ✅ (N04) |
| Commande déjà annulée protégée | ✅ (N05 — plus rien à retourner une fois le solde épuisé) |
| Cycle INITIAL distinct des reprises | ✅ (N06-N09) |
| Reprise peut consommer à nouveau | ✅ (N06-N09, confirmé clics réels) |
| Double scan de même reprise reste idempotent | ✅ (N06-N09) |
| Reprise suivante peut à nouveau consommer | ✅ (N06-N09) |
| Lots FEFO fonctionnent pendant reprise | ✅ (N10) |
| Vrai mode caméra implémenté si navigateur compatible | ✅ implémenté (code réel — voir rapport d'implémentation) ; non exerçable en conditions réelles dans CE navigateur de test (documenté, N11-N13) |
| Caméra stoppée à la fermeture | ✅ (stopCameraScan() enveloppe closeSidePanel(), N12-N13) |
| Fallback HID/manuel toujours fonctionnel | ✅ (N14, clics réels) |
| DRAFT reste économiquement « À facturer » | ✅ (N15-N17, Partie E/P) |
| DRAFT empêche facture dupliquée | ✅ (N15-N17) |
| ISSUED entre dans Facturé | ✅ (N15-N17, Partie E/P) |
| PAID entre dans Réglé | ✅ (invariant V3.6 préservé) |
| createInvoice protège les invariants métier | ✅ (N18, N19) |
| Facture multi-cabinets impossible | ✅ (N19) |
| Commande non livrée impossible à facturer | ✅ (N18) |
| Date facture imprimée = issuedAt | ✅ (N20) |
| Recherche nom patient cohérente | ✅ (N21) |
| Anonymisation protège aussi la recherche | ✅ (N22) |
| Tous les tests V3.6 restent PASS | ✅ (115 conservés + 3 mis à jour) |
| Nouveaux tests PASS | ✅ (16/16) |
| Responsive PASS | ✅ (16/16) |
| Thèmes PASS | ✅ (12/12) |
| node --check PASS | ✅ |
| Zéro erreur console | ✅ |
