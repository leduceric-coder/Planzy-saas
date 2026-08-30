# DentalFlow Next V3.4.5 — Rapport de tests

Base : `dentalflow-next-poc-v3.4.4.html` (non modifiée, conservée telle quelle).
Fichier testé : `dentalflow-next-poc-v3.4.5.html`.
Exécution : Playwright / Chromium headless (`/opt/pw-browsers/chromium`), y compris contextes navigateur réels et neufs pour le premier démarrage et la migration à froid.

## 0. Reproduction du bug AVANT correction (obligatoire, §3-4 du mandat)

Fixture exacte du mandat, injectée et exécutée via le moteur réel (`reconcileProposals(state)`) contre le code **non modifié** de `dentalflow-next-poc-v3.4.4.html` (copie de travail isolée, fichier livré non touché) :

- Article : besoin urgent, sous-total réel ≈120€
- Fournisseur A (préféré) : `leadTimeDays=1, minimumOrder=150`
- Fournisseur B : `leadTimeDays=1, minimumOrder=200`
- Fournisseur C : `leadTimeDays=2, minimumOrder=0`
- Les trois livrent avant la rupture (tarif actif, prix valide, packSize/minimumQty valides)

**Comportement constaté (V3.4.4, avant correction) :**

```json
{"ppAFound":false,"ppBFound":true,"ppBAction":"BLOCKED","ppBSubtotal":120,"ppCFound":false,"ppCAction":null}
```

La seconde passe de `computeNeeds()` reroute vers **B** (le plus rapide par `leadTimeDays`, sans vérifier son propre minimum) ; le sous-total réel (120€) reste sous le minimum de B (200€) ; la proposition B devient `BLOCKED`. **C, réellement commandable, n'est jamais considéré.** Confirmation exacte du défaut décrit par l'audit.

## 1. Suite unitaire isolée — `?runTests=1`

46 tests au total (42 conservés de la V3.4.4, aucune assertion affaiblie, + 4 nouveaux ciblant exactement l'anomalie de cette version). Isolation vérifiée : `exportDentalFlowJSON()` avant/après `runAllTests()` → **identique**. Résultat global : **46/46 PASS**, 0 erreur console.

### 1.a Les 42 tests conservés de la V3.4.4

Tous restent **PASS**, sans aucune modification d'assertion (liste complète déjà documentée dans `DENTALFLOW_V3_4_4_TEST_REPORT.md` — non reproduite ici pour éviter la redondance, mais rejouée intégralement à l'identique dans cette exécution).

### 1.b Les 4 nouveaux tests V3.4.5

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 43 | **Seconde passe computeNeeds — A/B/C, fixture exacte du mandat, moteur réel** (`reconcileProposals`, aucune assignation manuelle de `recommendedSupplierId`) | A absent (minimum non atteint), B absent (minimum non atteint), C présent avec `recommendedAction='ORDER_NOW'` | `{"ppAFound":false,"ppBFound":false,"ppCFound":true,"ppCSubtotal":135,"ppCAction":"ORDER_NOW"}` | PASS |
| 44 | **Seconde passe computeNeeds — deux alternatifs viables, landed cost le plus bas retenu** : B (lead 1, landed cost hypothétique 120€) vs C (lead 2, landed cost 100€), les deux livrent à temps | B absent, C présent (`ORDER_NOW`), au coût rendu le plus bas | `{"ppBFound":false,"ppCFound":true,"ppBSubtotal":null,"ppCSubtotal":100}` — C retenu à 100€ (calcul indépendant confirme B aurait été à 120€, soit exactement les valeurs illustratives du mandat) | PASS |
| 45 | **Seconde passe computeNeeds — urgence extrême, seul le fournisseur à temps est choisi malgré le coût** : B (lead 1, plus cher, 276€) vs C (lead 2, moins cher) mais C arriverait après la date de rupture | B présent (`ORDER_NOW`, seul viable), C absent | `{"ppBFound":true,"ppCFound":false,"ppBSubtotal":276,"stockoutAt":"2026-08-24T10:42:00.000Z"}` — date de rupture lun. 24/08 (1 jour ouvré) ; B (lead 1) arrive lun. 24/08 (à temps) ; C (lead 2) arriverait mar. 25/08 (après la rupture) → exclu | PASS |
| 46 | **Seconde passe computeNeeds — packSize/minimumQty recalculés par candidat, jamais partagés** : B (`minimumQty=7, packSize=5`, moins cher) vs C (`minimumQty=1, packSize=1`, plus cher) | B retenu avec une quantité recalculée selon SES propres règles (multiple de 5, ≥7) ; jamais la quantité que C aurait obtenue avec les siennes | `{"ppBFound":true,"ppCFound":false,"qtyB":10,"qtyIsMultipleOf5":true,"qtyAtLeast7":true}` — 10 = `roundPack(7.6, minimumQty=7, packSize=5)`, indépendant du `roundPack` de C (qui aurait donné 8) | PASS |

## 2. Comparaison AVANT / APRÈS (synthèse, §25 du mandat)

| | AVANT (V3.4.4) | APRÈS (V3.4.5) |
|---|---|---|
| Fournisseur A (préféré, minimum 150) | minimum non atteint (120€) | minimum non atteint (135€ recalculé) → écarté |
| Fournisseur B (lead 1, minimum 200) | **choisi car le plus rapide**, minimum non vérifié → subtotal 120€ < 200€ | minimum non atteint (120€ recalculé avec ses propres paramètres) → **écarté avant sélection** |
| Fournisseur C (lead 2, minimum 0) | jamais considéré | délai respecté + minimum atteint → **retenu** |
| Proposition finale | `PP` chez B, `recommendedAction='BLOCKED'` | `PP` chez C, `recommendedAction='ORDER_NOW'` |

## 3. Non-régression — 42 tests V3.4.4

Résultat agrégé de la suite complète (`total:46, passed:46, failed:0`) confirme que les 42 tests hérités (persistance, migration V5→V6, legacyIncoming, premier démarrage V6, PO fermées, franco null, landed cost fournisseur V3.4.3, minimum fournisseur V3.4.4, import, privacy, BLOCKED, `chooseSupplier` A/B/C/landed-cost/urgence-extrême de la V3.4.4) restent tous **PASS** sans aucune assertion modifiée.

## 4. Premier démarrage réel — contexte navigateur neuf (non touché par cette version, revérifié)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| Premier démarrage, contexte réel, localStorage vide | `schemaVersion=6`, Zircone `physicalStock=5`, `migrationV5MovementsCount=0` | `{"schemaVersion":6,"zirconePhys":5,"zirconeSafety":4,"migrationV5MovementsCount":0,"totalMovements":9,"articlesCount":9,"suppliersCount":3,"purchaseOrdersCount":1}` | PASS |

## 5. Migration V5→V6 — contexte réel, rechargement à froid (non touché, revérifié)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| legacyIncoming (1er + 2e chargement à froid) | `supplierId=null`, flags `missing_supplier`+`missing_price`, idempotent | `{"supplierId":null,"unitPrice":null,"flags":["missing_supplier","missing_price"],"posCount":1}` identique aux deux chargements | PASS |
| Sentinelle 45/12 (1er + 2e chargement à froid) | Valeurs réelles préservées (ZIR 45/12/4, CER 17/6/2, PMM 9/3/0), idempotent | `{"zir":{"phys":45,"safety":12,"inc":4},...}` identique aux deux chargements | PASS |

## 6. Persistance / hooks combinés (non touché, revérifié)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| `persistTest` setup+verify (StockMovement/PO/note fournisseur/ActivityEvent custom + reload) | pass=true, tout retrouvé après reload | `{"phase":"verify","pass":true,"mov":true,"act":true,"po":true,"notes":true,"physicalStock":12}` | PASS |
| `migrationTest` seed→seedReload→verify (×2, idempotence) | schemaVersion=6, 1 OPENING, 1 PO legacyIncoming, valeurs identiques aux deux vérifications | `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` (×2, identique) | PASS |
| `emptyTest` setup+verify | count=0, `blindSeed=false` | `{"phase":"verify","pass":true,"count":0,"blindSeed":false}` | PASS |

0 erreur page/console sur l'ensemble de la séquence.

## 7. Responsive — matrice 4 largeurs × 4 modes (16/16)

| Largeur | lab | staff | dentist | scan |
|---------|-----|-------|---------|------|
| 1440px | PASS | PASS | PASS | PASS |
| 1024px | PASS | PASS | PASS | PASS |
| 768px | PASS | PASS | PASS | PASS |
| 390px | PASS | PASS | PASS | PASS |

**ALL_OK: true** (16/16), 0 erreur console/page. Aucun CSS modifié dans cette version.

## 8. Console

Sur l'intégralité des exécutions (suite unitaire, reproduction avant/après, premier démarrage réel, migration à froid, hooks combinés, matrice responsive) : **0 `SyntaxError`, 0 `ReferenceError`, 0 `TypeError`, 0 `Unhandled rejection`**.

## 9. Vie privée

Grep direct : `patientName|patient_name|nomPatient` → **0 occurrence**. Non touché par cette version.

## 10. Non-hardcoding

Audit ciblé sur les 8 fonctions moteur concernées (`evaluateSupplierCandidate`, `chooseSupplier`, `decideProposal`, `computeNeeds`, `reconcileProposals`, `migrateStockArrayToV6`, `approveProposal`, `receivePurchaseOrder`) : aucune occurrence de `SUP-IVOCLAR`, `SUP-HENRY`, `ART-ZIR-HT-001` en dehors des deux littéraux légitimes de la commande de démonstration `CF-DEMO-EMX` (données de seed préexistantes depuis la V3.4.2, non des branches conditionnelles). Aucune référence à `SUP-A`/`SUP-B`/`SUP-C` littéraux dans le moteur ; les identifiants synthétiques des nouveaux tests (`SUP-TST-MINABC-*`, `SUP-TST-LC2-*`, `SUP-TST-UE2-*`, `SUP-TST-PACK2-*`) n'existent que dans le corps des tests.

## Synthèse

- **46/46 tests unitaires PASS** (42 conservés sans affaiblissement + 4 nouveaux)
- **Reproduction du bug documentée** avant correction (B choisi → BLOCKED), confirmée corrigée après (C choisi → ORDER_NOW)
- **Une seule définition de viabilité fournisseur** (`evaluateSupplierCandidate`), partagée par `chooseSupplier()` et la seconde passe de `computeNeeds()`
- **Responsive 16/16**, **console 0 erreur**, **vie privée conforme**, **aucun hardcoding résiduel dans le moteur**
- **Persistance, migration, premier démarrage** : tous revérifiés PASS, aucune régression
