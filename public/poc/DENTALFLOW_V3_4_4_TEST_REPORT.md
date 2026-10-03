# DentalFlow Next V3.4.4 — Rapport de tests

Base : `dentalflow-next-poc-v3.4.3.html` (non modifiée, conservée telle quelle).
Fichier testé : `dentalflow-next-poc-v3.4.4.html`.
Exécution : Playwright / Chromium headless (`/opt/pw-browsers/chromium`), plus contextes navigateur réels et neufs (`browser.newContext()`) pour les scénarios de premier démarrage et de migration à froid.

## 1. Suite unitaire isolée — `?runTests=1`

42 tests au total (35 conservés de la V3.4.3 sans modification d'assertion + 7 nouveaux ciblant les 4 anomalies de cette version). Isolation vérifiée : chaque test restaure l'état exact (`serializableState()`) avant/après, y compris en cas d'échec. Résultat global : **42/42 PASS**, 0 erreur console, `pass:true` / `total:42` / `passed:42` / `failed:0`.

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 1 | Calendrier vendredi + 3 jo = mercredi | PASS | pass:true | PASS |
| 2 | Pack/min raw 3 minimum 7 pack 5 = 10 | PASS | pass:true | PASS |
| 3 | Franco null subtotal 92 shipping 12 = 104 | PASS | pass:true | PASS |
| 4 | Migration V5 qty 10 incoming 5 idempotente | PASS | pass:true | PASS |
| 5 | **[NOUVEAU]** Migration legacyIncoming : fournisseur connu par catalogue mais inconnu dans le legacy → supplierId null | supplierId=null, unitPrice=null, lineTotal=null, flags=[missing_supplier,missing_price], idempotent | `supplierId:null, unitPrice:null, lineTotal:null`, les deux flags présents, phys=10, inc=5, posCount=1, `JSON.stringify(r1)===JSON.stringify(r2)` → pass:true | PASS |
| 6 | Migration fournisseur inconnu conserve incoming avec flags | PASS | pass:true | PASS |
| 7 | Migration sentinelle 45/12 préserve les valeurs utilisateur réelles (aucun écrasement démo) | PASS | pass:true | PASS |
| 8 | Consommation au double scan idempotente | PASS | pass:true | PASS |
| 9 | Demande réelle incrémentale (aucune constante codée) : +1 Couronne puis +1 Bridge (BOM×2) = +3 | PASS | pass:true | PASS |
| 10 | PO partielle 9 réception 8 | PASS | pass:true | PASS |
| 11 | **[NOUVEAU]** PO cancelled : réception refusée au niveau moteur, aucune mutation | `result.success=false, result.reason='PO_NOT_RECEIVABLE'`, receivedQty inchangé (0), status toujours `cancelled`, aucun StockMovement créé | before=after physicalStock, receivedQty=0, status='cancelled', movementCount avant=après, pass:true | PASS |
| 12 | **[NOUVEAU]** PO received : réception refusée au niveau moteur, aucune mutation | idem #11 avec status initial `received` | receivedQty inchangé, status toujours 'received', aucune mutation, pass:true | PASS |
| 13 | **[NOUVEAU]** PO partially_received : reliquat 1 accepté, passe à received | `result.success=true`, receivedQty final = commandé, status → 'received' | po2.lines[0].receivedQty=9 (commandé), status='received', pass:true | PASS |
| 14 | Annulation PO retire reliquat et conserve RECEIPT | PASS | pass:true | PASS |
| 15 | Scénario métier complet V1.2.1 | PASS | pass:true | PASS |
| 16 | Retour fournisseur préféré avant validation | PASS | pass:true | PASS |
| 17 | Import stock crée ADJUSTMENT | PASS | pass:true | PASS |
| 18 | Import errors détaillées | PASS | pass:true | PASS |
| 19 | Export JSON complet ré-importable | PASS | pass:true | PASS |
| 20 | Export CSV métiers | PASS | pass:true | PASS |
| 21 | Privacy source/runtime sans patient name fields | PASS | pass:true | PASS |
| 22 | Journal unifié activityEvents | PASS | pass:true | PASS |
| 23 | Import commandes crée une commande avec patientRef opaque | PASS | pass:true | PASS |
| 24 | Import utilisateurs crée un utilisateur | PASS | pass:true | PASS |
| 25 | Mapping bloque les champs requis non associés | PASS | pass:true | PASS |
| 26 | Colonnes de données personnelles jamais mappables | PASS | pass:true | PASS |
| 27 | Minimum de commande + urgence + alternatif viable : bascule réelle vers l'alternatif | PASS | pass:true | PASS |
| 28 | Minimum de commande + urgence SANS alternatif viable : BLOCKED | PASS | pass:true | PASS |
| 29 | slowMovingStock utilise Clock.now(), pas Date.now() | PASS | pass:true | PASS |
| 30 | Import tarifs : un seul fournisseur préféré actif par article | PASS | pass:true | PASS |
| 31 | Import : rejectedCount compte les lignes rejetées, pas les erreurs cumulées | PASS | pass:true | PASS |
| 32 | Historique ImportErrors conservé par job (append-only) | PASS | pass:true | PASS |
| 33 | Franco null jamais interprété comme atteint (proposition réelle) | PASS | pass:true | PASS |
| 34 | BLOCKED sans fournisseur/tarif : besoin visible, approveProposal refuse | PASS | pass:true | PASS |
| 35 | BLOCKED sans prix (tarif présent, unitPrice null) : approveProposal refuse | PASS | pass:true | PASS |
| 36 | **[NOUVEAU]** Alternatifs A/B/C : B rapide mais minimum non atteint, C viable → C choisi | `recommendedSupplierId='SUP-TST-ABC-C'`, proposition B absente, C en ORDER_NOW | `recommendedSupplierId:"SUP-TST-ABC-C", ppCFound:true, ppCAction:"ORDER_NOW", ppCSubtotal:150, ppBFound:false`, pass:true | PASS |
| 37 | **[NOUVEAU]** Deux alternatifs viables : landed cost le plus bas choisi (délai respecté par les deux) | Le fournisseur au landed cost le plus bas est retenu, même si son unitPrice n'est pas le plus bas | `recommendedSupplierId:"SUP-TST-L2-C", ppCSubtotal:90, ppBFound:false`, pass:true | PASS |
| 38 | **[NOUVEAU]** Urgence extrême : le fournisseur plus rapide choisi même plus cher, si l'autre arriverait trop tard | Le seul fournisseur livrant à temps est choisi malgré un coût supérieur | `recommendedSupplierId:"SUP-TST-UE-B", ppBFound:true, ppCFound:false`, pass:true | PASS |
| 39 | Surcoût fournisseur basé sur landed cost réel (pas *9) | PASS | landedA:110, landedB:99, mentionsFixedNine:false, pass:true | PASS |
| 40 | slowMovingStock canonique : couverture OU absence de consommation | PASS | pass:true | PASS |
| 41 | Capture globale des erreurs techniques dans le Journal | PASS | pass:true | PASS |
| 42 | Reset natif V6 supprime toute donnée custom | PASS | phys:5, pass:true | PASS |

Isolation de l'exécution : `exportDentalFlowJSON()` avant et après `runAllTests()` → **identiques (identical:true)**, confirmant qu'aucun test ne laisse l'état modifié.

## 2. Premier démarrage réel — contexte navigateur neuf (`browser.newContext()`, localStorage vide)

Script : `first_start_real.js`. Objectif : vérifier que le tout premier lancement (aucune donnée en localStorage) utilise `seedV6()` nativement et non une migration d'un V5 fictif.

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| Premier démarrage, contexte réel, localStorage vide | `schemaVersion=6`, Zircone `physicalStock=5` (valeur native du seed V6, jamais 45), `migrationV5MovementsCount=0` (aucun mouvement de migration créé) | `{"schemaVersion":6,"zirconePhys":5,"zirconeSafety":4,"migrationV5MovementsCount":0,"totalMovements":9,"articlesCount":9,"suppliersCount":3,"purchaseOrdersCount":1}` | PASS |

0 erreur console/page pendant l'exécution.

## 3. Premier démarrage = Reset démo (équivalence stricte)

Script : `first_start_vs_reset.js`. Contexte réel neuf → export JSON (FIRST_START) → altération du state (StockMovement custom, note fournisseur, PurchaseOrder, ActivityEvent) directement en mémoire → clic réel sur les boutons UI `#user-menu-trigger` puis `#reset-demo` → export JSON (RESET_STATE) → comparaison métier (IDs/timestamps exclus).

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| articles (business fields) | EQUAL | EQUAL | PASS |
| suppliers (business fields) | EQUAL | EQUAL | PASS |
| articleSuppliers (business fields) | EQUAL | EQUAL | PASS |
| stockMovements (business fields) | EQUAL | EQUAL | PASS |
| purchaseOrders (business fields) | EQUAL | EQUAL | PASS |
| users (business fields) | EQUAL | EQUAL | PASS |
| orders (business fields) | EQUAL | EQUAL | PASS |
| schemaVersion | EQUAL | EQUAL (6=6) | PASS |
| Données injectées avant reset ont disparu | dirtyGone=true | dirtyGone:true | PASS |

Résultat global : **ALL EQUAL: true**. Le premier démarrage et « Réinitialiser la démo » produisent désormais un seul et même état canonique métier.

## 4. Migration V5→V6 — contexte réel, rechargement à froid

### 4.a Cas legacyIncoming (fournisseur inconnu du legacy)

Script : `legacy_incoming_cold.js`. Fixture V5 injectée en localStorage (`ZIR-HT-001 qty=10 min=4 incoming=5`), navigation réelle deux fois de suite (rechargement à froid, pas un simple appel en mémoire).

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| 1er chargement à froid | `supplierId=null`, `unitPrice=null`, flags=[missing_supplier,missing_price], posCount=1 | `{"supplierId":null,"unitPrice":null,"flags":["missing_supplier","missing_price"],"posCount":1}` | PASS |
| 2e rechargement à froid (idempotence) | Identique au premier chargement, aucune duplication de PO | identique, `identical:true` | PASS |

### 4.b Cas sentinelle historique (qty=45/min=12 — ex-piège V3.4.2/3.4.3)

Script : `sentinel_cold.js`. Vérifie que la présence de valeurs qui ressemblent au seed de démo (ZIR 45/12) n'entraîne plus jamais un écrasement — et que désormais le fournisseur legacy reste `null` (au lieu d'être déduit du catalogue courant comme avant V3.4.4).

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| 1er chargement à froid — ZIR (45/12/4) | Valeurs réelles préservées : phys=45, safety=12, inc=4 | `{"phys":45,"safety":12,"inc":4}` | PASS |
| 1er chargement à froid — CER (17/6/2) | phys=17, safety=6, inc=2 | `{"phys":17,"safety":6,"inc":2}` | PASS |
| 1er chargement à froid — PMM (9/3/0) | phys=9, safety=3, inc=0 (aucun PO créé si incoming=0) | `{"phys":9,"safety":3,"inc":0}` | PASS |
| 2e rechargement à froid (idempotence) | Identique, posCount cohérent (1 PO pour ZIR et CER, 0 pour PMM) | `{"zir":{...,"opens":1,"posCount":1},"cer":{...,"opens":1,"posCount":1},"pmm":{...,"opens":1,"posCount":0}}`, `identical:true` | PASS |

### 4.c Hooks combinés — persistance / migration / vide (`?persistTest`, `?migrationTest`, `?emptyTest`)

Script : `full_hooks.js`, contexte réel unique, séquence complète.

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|------|----------|--------|-----------|
| `persistTest=setup` (custom StockMovement/PO/Supplier note/ActivityEvent + reload) | pass=true, physicalStock passe de 5 à 12 | `{"phase":"setup","pass":true,"before":5,"after":12}` | PASS |
| `persistTest=verify` (après reload) | Mouvement, ActivityEvent, PO, note fournisseur tous retrouvés | `{"phase":"verify","pass":true,"mov":true,"act":true,"po":true,"notes":true,"physicalStock":12}` | PASS |
| `migrationTest=seed` (fixture V5 qty=10/incoming=5 en localStorage) | storedSchema=5, storedQty=10, storedIncoming=5 | `{"phase":"seed","pass":true,"storedSchema":5,"storedQty":10,"storedIncoming":5}` | PASS |
| `migrationTest=seedReload` → `verify` (migration réelle) | schemaVersion=6, 1 OPENING, 1 PO legacyIncoming, physicalStock=10, incomingStock=5 | `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` | PASS |
| `migrationTest=verify` (2e rechargement, idempotence) | Identique au précédent, aucune duplication | identique | PASS |
| `emptyTest=setup` (localStorage réellement vide) | count=0 | `{"phase":"setup","pass":true,"count":0}` | PASS |
| `emptyTest=verify` | count=0, `blindSeed=false` (pas de seed V5 fictif utilisé) | `{"phase":"verify","pass":true,"count":0,"blindSeed":false}` | PASS |

0 erreur page/console sur l'ensemble de la séquence.

## 5. Responsive — matrice 4 largeurs × 4 modes (16/16)

Script : `full_regression.js`, `?smokeV34=1` avec `page.evaluate` post-transition (pas de dépendance au timing d'animation).

| Largeur | lab | staff | dentist | scan |
|---------|-----|-------|---------|------|
| 1440px | PASS | PASS | PASS | PASS |
| 1024px | PASS | PASS | PASS | PASS |
| 768px | PASS | PASS | PASS | PASS |
| 390px | PASS | PASS | PASS | PASS |

Résultat global : **ALL_OK: true** (16/16), 0 erreur console/page sur l'ensemble de la matrice.

## 6. Console / erreurs techniques

Sur l'intégralité des exécutions ci-dessus (suite unitaire, premier démarrage réel, migration à froid, hooks combinés, matrice responsive) : **0 erreur console, 0 PAGEERROR**.

## 7. Vie privée

Grep direct sur le fichier livré : `patientName|patient_name|nomPatient|patientFirstName|patientLastName` → **0 occurrence**. Le test unitaire #21 (« Privacy source/runtime sans patient name fields ») et #23 (« Import commandes crée une commande avec patientRef opaque ») confirment à l'exécution qu'aucune identité patient n'est stockée, seul un `patientRef` opaque existe.

## 8. Non-hardcoding des identifiants de démonstration

Audit ciblé : les 7 fonctions moteur concernées par cette version (`chooseSupplier`, `decideProposal`, `computeNeeds`, `reconcileProposals`, `migrateStockArrayToV6`, `approveProposal`, `receivePurchaseOrder`) ne contiennent aucune branche logique conditionnée sur `SUP-IVOCLAR`, `SUP-HENRY`, `ART-ZIR-HT-001` ou des lettres littérales `A`/`B`/`C`. Les seules occurrences trouvées dans la plage de ces fonctions sont le littéral de la commande de démonstration `CF-DEMO-EMX` (donnée de seed légitime, préexistante depuis la V3.4.2, présente dans `seedV6()` et dans la branche de complément legacy — non une logique conditionnelle nouvelle). Les identifiants synthétiques des nouveaux tests (`SUP-TST-ABC-*`, `SUP-TST-L2-*`, `SUP-TST-UE-*`, `ART-TST-*`) n'existent que dans le corps des tests, jamais dans le moteur.

## Synthèse

- **42/42 tests unitaires PASS** (35 conservés sans affaiblissement + 7 nouveaux)
- **Premier démarrage réel = Reset démo** (équivalence stricte confirmée sur 7 catégories métier)
- **Migration V5→V6** : fournisseur legacy jamais inventé (`supplierId=null`), quantités toujours préservées, idempotente à froid
- **PO fermé (cancelled/received)** : jamais réceptionnable, refus explicite `{success:false, reason:'PO_NOT_RECEIVABLE'}`
- **Alternatif viable** : filtré sur son propre minimum de commande recalculé, priorité livraison → coût rendu → délai
- **Responsive 16/16**, **console 0 erreur**, **vie privée conforme**, **aucun hardcoding résiduel dans le moteur**
