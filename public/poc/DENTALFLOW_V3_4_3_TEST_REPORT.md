# DentalFlow Next V3.4.3 — Rapport de test

Fichier testé : `dentalflow-next-poc-v3.4.3.html`.
Méthode : exécution réelle via Playwright (Chromium headless), aucune valeur calculée à la main sans vérification empirique. Reproductible via `?runTests=1`, `?smokeV34=1`, `?persistTest=`, `?migrationTest=`, `?emptyTest=`.

## 1. Suite unitaire isolée — `?runTests=1` → `runAllTests()`

**35/35 PASS**, 0 échec, 0 erreur console. Isolation vérifiée : `exportDentalFlowJSON()` avant et après `runAllTests()` est strictement identique.

### 1.1 Tests conservés de la V3.4.2 (24, tous encore verts)

| Test | Expected | Actual | Statut |
|---|---|---|---|
| Calendrier vendredi + 3 jo = mercredi | `2026-08-26` | `{"value":"2026-08-26","pass":true}` | PASS |
| Pack/min raw 3 minimum 7 pack 5 = 10 | `10` | `{"value":10,"pass":true}` | PASS |
| Franco null subtotal 92 shipping 12 = 104 | `104` | `{"value":104,"pass":true}` | PASS |
| Migration V5 qty 10 incoming 5 idempotente | phys=10, inc=5, 1 OPENING, 1 PO | `{"phys":10,"inc":5,"opening":1,"pos":1,"pass":true}` | PASS |
| Migration fournisseur inconnu conserve incoming avec flags | supplierId=null, missing_supplier | `{"supplierId":null,"flags":["missing_supplier","missing_price"],"inc":5,"pass":true}` | PASS |
| Consommation au double scan idempotente | 1 seul mouvement, stock −2 une fois | `{"before":45,"after":43,"count":1,"pass":true}` (before=45 reflète la migration désormais fidèle du seed legacy — voir rapport d'implémentation) | PASS |
| Demande réelle incrémentale : +1 Couronne puis +1 Bridge = +3 | +1 puis +2, total +3 | `{"baseline":12,"afterCouronne":13,"afterBridge":15,"deltaCouronne":1,"deltaBridge":2,"pass":true}` | PASS |
| PO partielle 9 réception 8 | +8, reliquat=1, partially_received | `{"delta":8,"inc":1,"status":"partially_received","pass":true}` | PASS |
| Annulation PO retire reliquat et conserve RECEIPT | reliquat=0, RECEIPT conservés | `{"inc":0,"receiptsBefore":1,"receiptsAfter":1,"pass":true}` | PASS |
| **Scénario métier complet V1.2.1** | **qtyBefore=5, qtyAfter=9 (strict)** | `{"initial":true,"qtyBefore":5,"qtyAfter":9,"strictQty":true,"moved":true,"received":true,"noNew":true,"journal":true,"pass":true}` | PASS — corrige le faux positif V3.4.2 (`>=`) |
| Retour fournisseur préféré avant validation | ligne repasse chez Henry Schein | `{"hadHenry":true,"pass":true}` | PASS |
| Import stock crée ADJUSTMENT | 1 importée, ADJUSTMENT créé | `{"imported":1,"adj":true,"pass":true}` | PASS |
| Import errors détaillées | UNKNOWN_ARTICLE + NEGATIVE_QTY | `{"errors":["UNKNOWN_ARTICLE","NEGATIVE_QTY"],"pass":true}` | PASS |
| Export JSON complet ré-importable | schemaVersion=6, stores présents | `{"schemaVersion":6,"hasStores":true,"pass":true}` | PASS |
| Export CSV métiers | 7 types exportables | `{"types":["commandes","production","stocks","articles","fournisseurs","achats","tracabilite"],"pass":true}` | PASS |
| Privacy source/runtime sans champs d'identité | aucune occurrence | `{"bad":false,"pass":true}` | PASS |
| Journal unifié activityEvents | store actif | `{"events":4,"legacyAdapted":true,"pass":true}` | PASS |
| Import commandes crée une commande avec patientRef opaque | patientRef propre, sans identité | `{"imported":1,"found":true,"patientRef":"PAT-9001","noIdentity":true,"pass":true}` | PASS |
| Import utilisateurs crée un utilisateur | rôle correct | `{"imported":1,"found":true,"role":"Technicien","pass":true}` | PASS |
| Mapping bloque les champs requis non associés | reference, type manquants | `{"missing":["reference","type"],"pass":true}` | PASS |
| Colonnes de données personnelles jamais mappables | aucune cible de mapping | `{"results":["","","","",""],"pass":true}` | PASS |
| slowMovingStock canonique : couverture OU absence de consommation | témoin non dormant, 2 cas dormants | `{"control":false,"caseCoverage":true,"caseNoRecent":true,"pass":true}` | PASS |
| Capture globale des erreurs techniques dans le Journal | erreur capturée, verrou relâché | `{"captured":true,"guardReset":true,"pass":true}` | PASS |
| Reset natif V6 supprime toute donnée custom | tout supprimé, stock=5 | `{"movGone":true,"poGone":true,"actGone":true,"notesReset":true,"phys":5,"pass":true}` | PASS |

### 1.2 Nouveaux tests V3.4.3 (11, ciblant chaque anomalie de l'audit)

| # | Test | Expected | Actual | Statut |
|---|---|---|---|---|
| 1 | Migration sentinelle 45/12 préserve les valeurs utilisateur réelles | ZIR phys=45/safety=12/inc=4 ; CER phys=17/safety=6/inc=2 ; PMM phys=9/safety=3/inc=0 ; identique après un second passage | `{"before":{"ZIR-HT-001":{"phys":45,"safety":12,"inc":4,"openings":1,"pos":1},"CER-EMX-003":{"phys":17,"safety":6,"inc":2,"openings":1,"pos":1},"PMM-TMP-004":{"phys":9,"safety":3,"inc":0,"openings":1,"pos":0}},"afterSecondReload":{ …identique… },"pass":true}` | PASS |
| 2 | Minimum de commande + urgence + alternatif viable : bascule réelle | ligne quitte A, apparaît chez B, `ORDER_NOW` | `{"movedToB":true,"leftA":true,"ppBAction":"ORDER_NOW","ppBSubtotal":120,"pass":true}` | PASS |
| 3 | Minimum de commande + urgence SANS alternatif viable : BLOCKED | BLOCKED, approveProposal refuse | `{"blocked":true,"refused":true,"noPoCreated":true,"pass":true}` | PASS |
| 4 | slowMovingStock utilise Clock.now(), pas Date.now() | non dormant sous horloge fictive 1990 | `{"dormant":false,"pass":true}` — **confirmé faux (dormant:true) en réintroduisant `Date.now()` temporairement**, prouvant que le test discrimine réellement le bug | PASS |
| 5 | Import tarifs : un seul fournisseur préféré actif par article | Ivoclar perd `preferred`, Henry Schein le gagne | `{"before":1,"imported":1,"preferredCountAfter":1,"newPreferredSupplier":"SUP-HENRY","ivoclarStillPreferred":false,"pass":true}` | PASS |
| 6 | Import : rejectedCount compte les lignes rejetées, pas les erreurs | rowCount=10, valid=8, rejectedCount=2, errors=3 | `{"rowCount":10,"validCount":8,"rejectedCount":2,"errorCount":3,"pass":true}` | PASS |
| 7 | Historique ImportErrors conservé par job (append-only) | 2 jobs, chacun retrouvable par jobId | `{"job1Preserved":true,"job2Present":true,"pass":true}` | PASS |
| 8 | Franco null jamais interprété comme atteint (proposition réelle) | subtotal=92, shipping=12, total=104, aucune mention "franco atteint" | `{"found":true,"subtotal":92,"shippingCost":12,"total":104,"action":"WAIT","reasons":["Marge confortable avant la limite de commande"],"mentionsForbidden":false,"pass":true}` | PASS |
| 9 | BLOCKED sans fournisseur/tarif : besoin visible, approveProposal refuse | besoin visible + BLOCKED + refus | `{"visible":true,"refused":true,"noPoCreated":true,"pass":true}` | PASS |
| 10 | BLOCKED sans prix (tarif présent, unitPrice null) : approveProposal refuse | BLOCKED + refus | `{"blocked":true,"refused":true,"noPoCreated":true,"pass":true}` | PASS |
| 11 | Surcoût fournisseur basé sur landed cost réel (pas *9) | landed A=110, landed B=99, B recommandé | `{"recommendedSupplierId":"SUP-TST-B","landedA":110,"landedB":99,"mentionsFixedNine":false,"pass":true}`, raison : *"Économie estimée : 11 € malgré un prix unitaire plus élevé"* | PASS |

## 2. Preuve de reproduction avant correction (méthodologie §4 de la mission)

| Anomalie | Comportement avant correction (reproduit) | Comportement après correction |
|---|---|---|
| Migration sentinelle | Reproduction directe (fixture V5 injectée, navigation `?migrationTest=verify`) : `physicalStock=5, incomingStock=0, legacyIncomingPOs=0` (valeurs de démo substituées) | `physicalStock=10, incomingStock=5, legacyIncomingPOs=1` (valeurs réelles préservées) |
| Test WAIT→ORDER_NOW | Avec l'ancienne assertion `qtyAfter>=qtyBefore` : `qtyBefore=5, qtyAfter=5` → **PASS à tort** (faux positif) | Avec l'assertion stricte : `qtyBefore=5, qtyAfter=9` → PASS réel |
| slowMovingStock / Clock | Avec `Date.now()` réintroduit temporairement : `dormant:true` (résultat dépendant de la date machine, incorrect pour le scénario testé) | Avec `Clock.now()` : `dormant:false` (résultat cohérent avec l'horloge métier) |
| Panneau Messages responsive | `document.body.innerText` lu immédiatement après ouverture : ne contient pas "Messages", contenu de la vue Utilisateurs visible à la place | `textContent` de `#side-panel-head` lu directement : contient "Messages" de façon fiable, indépendant du timing d'animation |
| Overflow Scan 390px | `document.body.scrollWidth=437` contre `window.innerWidth=390`, élément responsable : `.scan-submit-btn` (right:437) car `.scan-cmd-input` n'avait pas `min-width:0` | `document.body.scrollWidth=390`, aucun élément en dépassement |

## 3. Hooks de persistance / migration / état vide (rechargement réel du navigateur)

| Test | Expected | Actual | Statut |
|---|---|---|---|
| `persistTest=setup` | stock +7 | `{"phase":"setup","pass":true,"before":45,"after":52}` (before=45 reflète la migration fidèle du seed legacy — cohérent avec §1.1) | PASS |
| `persistTest=verify` (rechargement à froid) | mouvement, événement, PO, note fournisseur tous présents | `{"phase":"verify","pass":true,"mov":true,"act":true,"po":true,"notes":true,"physicalStock":52}` | PASS |
| `migrationTest=seed` | fixture V5 (qty=10, incoming=5) écrite | `{"phase":"seed","pass":true,"storedSchema":5,"storedQty":10,"storedIncoming":5}` | PASS |
| `migrationTest=verify` (après seedReload) | physicalStock=10, incomingStock=5, 1 OPENING, 1 PO | `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` | PASS |
| `migrationTest=verify` (second reload, idempotence) | résultat identique, aucun doublon | `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` | PASS |
| `emptyTest=setup` | propositions vidées | `{"phase":"setup","pass":true,"count":0}` | PASS |
| `emptyTest=verify` | aucune réapparition aveugle de PP-001/PP-002 | `{"phase":"verify","pass":true,"count":0,"blindSeed":false}` | PASS |

## 4. Responsive — `?smokeV34=1`, 4 largeurs × 4 modes

| Largeur | lab | staff | dentiste | scan |
|---|---|---|---|---|
| 1440×900 | PASS | PASS | PASS | PASS |
| 1024×800 | PASS | PASS | PASS | PASS |
| 768×1024 | PASS | PASS | PASS | PASS |
| 390×844 | PASS | PASS | PASS | PASS |

**16/16 PASS** (contre 13/16 en V3.4.2). 0 erreur console sur les 16 combinaisons. Thème dark revérifié explicitement sur la nouvelle UI BLOCKED (bouton désactivé, bannière d'avertissement) : rendu correct, 0 erreur console.

## 5. Scénarios Playwright de bout en bout (interactions réelles)

| Scénario | Expected | Actual | Statut |
|---|---|---|---|
| Proposition BLOCKED (sans fournisseur) — UI réelle | bouton désactivé "Résoudre le blocage", badge BLOQUÉ, raison affichée | `{"ppRecommendedAction":"BLOCKED","ppBlocking":["missing_supplier"],"btnText":"Résoudre le blocage","btnDisabled":true,"badgeText":"BLOQUÉ","subText":"1 référence · Fournisseur manquant"}`, détail : `{"drawerBtnDisabled":true,"warnLineText":"⚠ Blocage : Fournisseur manquant — commande impossible tant que ce n'est pas résolu."}` | PASS |
| Assistant Import (fichier réel, commandes) | privacy structurelle, ImportJob persisté | `{"orderFound":true,"orderHasNoFirstName":true,"patientRef":"PAT-1001","importJob":{"rowCount":1,"importedCount":1,"rejectedCount":0}}` | PASS |
| Réception fournisseur générique (formulaire réel) | reliquat réel par ligne, aucune quantité codée en dur | `{"status":"partially_received","lines":[{"a":"ART-ZIR-LT-002","ordered":30,"received":1}]}` | PASS |
| Reset natif V6 (clic réel + rechargement à froid) | toute donnée custom supprimée, seed identique après reload | `{"hasMov":false,"hasPO":false,"hasAct":false,"ivoNotes":"Fournisseur préféré zircone/céramique","physOpening":5}` avant/après rechargement | PASS |

## 6. Audit de hardcoding résiduel (§61 de la mission)

Recherche exhaustive de `ART-ZIR-HT-001`, `PP-001`/`PP-002`, `CF-0042`, `Ivoclar`, `Henry Schein`, `purchaseScenarioUrgent`, `*9`, `qty===9` :
- `CF-0042` : **0 occurrence** (supprimé).
- Toutes les autres occurrences confinées à `DEMO_ARTICLES`/`DEMO_SUPPLIERS`/`DEMO_ARTICLE_SUPPLIERS`/`BILL_OF_MATERIALS` (seed), aux fixtures de test, aux hooks de vérification, ou à des commentaires documentant la suppression du hardcoding.
- **Aucune** occurrence dans `knownDemand`, `chooseSupplier`, `decideProposal`, `computeNeeds`, `reconcileProposals`, `approveProposal`, `receivePurchaseOrder`.

## 7. Synthèse

- Suite unitaire isolée : **35/35 PASS** (24 conservés + 11 nouveaux), isolation d'état strictement vérifiée.
- Preuve de reproduction avant/après pour chaque anomalie majeure : **5/5 confirmées**.
- Hooks persistance/migration/vide : **7/7 PASS**.
- Responsive : **16/16 PASS** (amélioration depuis 13/16 en V3.4.2).
- Scénarios de bout en bout : **4/4 PASS**.
- Audit de hardcoding résiduel : **0 hardcoding moteur retrouvé**.
- **0 erreur console** (`SyntaxError`/`ReferenceError`/`TypeError`/rejet de promesse non capturé) sur l'ensemble des exécutions ci-dessus.
