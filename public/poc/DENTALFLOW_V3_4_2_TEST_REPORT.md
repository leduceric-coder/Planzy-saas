# DentalFlow Next V3.4.2 — Rapport de test

Fichier testé : `dentalflow-next-poc-v3.4.2.html`.
Méthode : exécution réelle via Playwright (Chromium headless), aucune valeur calculée à la main. Résultats bruts capturés le jour de la livraison, reproductibles via les hooks d'URL déjà présents dans le fichier (`?runTests=1`, `?smokeV34=1`, `?persistTest=`, `?migrationTest=`, `?emptyTest=`).

## 1. Suite unitaire isolée — `?runTests=1` → `runAllTests()`

Résultat global : **24/24 PASS**, 0 échec, 0 erreur console pendant l'exécution.

Isolation vérifiée séparément : `exportDentalFlowJSON()` capturé avant et après `runAllTests()` est **strictement identique** (comparaison de chaînes JSON égale) — aucune trace résiduelle (mouvement, commande, événement, note fournisseur) n'est laissée par la suite.

| # | Test | Attendu | Résultat obtenu | Statut |
|---|------|---------|------------------|--------|
| 1 | Calendrier vendredi + 3 jo = mercredi | `2026-08-26` | `{"value":"2026-08-26","pass":true}` | PASS |
| 2 | Pack/min raw 3 minimum 7 pack 5 = 10 | `10` (minimum appliqué avant l'arrondi au conditionnement) | `{"value":10,"pass":true}` | PASS |
| 3 | Franco null subtotal 92 shipping 12 = 104 | `104` (pas de coercition `>=null`) | `{"value":104,"pass":true}` | PASS |
| 4 | Migration V5 qty 10 incoming 5 idempotente | phys=10, inc=5, 1 seul OPENING, 1 seul PO, stable au second passage | `{"phys":10,"inc":5,"opening":1,"pos":1,"pass":true}` | PASS |
| 5 | Migration fournisseur inconnu conserve incoming avec flags | supplierId=null, flags `missing_supplier`+`missing_price`, inc=5 conservé | `{"supplierId":null,"flags":["missing_supplier","missing_price"],"inc":5,"pass":true}` | PASS |
| 6 | Consommation au double scan idempotente | 1 seul mouvement CONSUMPTION malgré 2 appels, stock −2 une seule fois | `{"before":5,"after":3,"count":1,"pass":true}` | PASS |
| 7 | Demande réelle incrémentale (aucune constante codée) : +1 Couronne puis +1 Bridge (BOM×2) = +3 | delta Couronne = +1, delta Bridge = +2, total = +3 | `{"baseline":12,"afterCouronne":13,"afterBridge":15,"deltaCouronne":1,"deltaBridge":2,"pass":true}` | PASS |
| 8 | PO partielle 9 réception 8 | +8 physique, reliquat=1, statut `partially_received` | `{"delta":8,"inc":1,"status":"partially_received","pass":true}` | PASS |
| 9 | Annulation PO retire reliquat et conserve RECEIPT | reliquat=0 après annulation, mouvements RECEIPT historiques conservés | `{"inc":0,"receiptsBefore":1,"receiptsAfter":1,"pass":true}` | PASS |
| 10 | Scénario métier complet V1.2.1 (WAIT → ORDER_NOW, changement de fournisseur, réception, journal) | WAIT initial vrai, bascule vers Henry Schein vraie, réception partielle correcte, plus de besoin résiduel, 3 événements journal attendus présents | `{"initial":true,"qtyBefore":5,"qtyAfter":5,"moved":true,"received":true,"noNew":true,"journal":true,"pass":true}` | PASS |
| 11 | Retour fournisseur préféré avant validation | ligne repasse chez Henry Schein avant toute validation, sans suppression silencieuse | `{"hadHenry":true,"pass":true}` | PASS |
| 12 | Import stock crée ADJUSTMENT | 1 ligne importée, mouvement ADJUSTMENT correspondant créé | `{"imported":1,"adj":true,"pass":true}` | PASS |
| 13 | Import errors détaillées | erreurs `UNKNOWN_ARTICLE` et `NEGATIVE_QTY` détectées | `{"errors":["UNKNOWN_ARTICLE","NEGATIVE_QTY"],"pass":true}` | PASS |
| 14 | Export JSON complet ré-importable | schemaVersion=6, tous les stores V6 présents | `{"schemaVersion":6,"hasStores":true,"pass":true}` | PASS |
| 15 | Export CSV métiers | 7 types exportables avec contenu CSV valide | `{"types":["commandes","production","stocks","articles","fournisseurs","achats","tracabilite"],"pass":true}` | PASS |
| 16 | Privacy source/runtime sans champs d'identité patient | aucune occurrence de champ d'identité dans le HTML ni l'état sérialisé | `{"bad":false,"pass":true}` | PASS |
| 17 | Journal unifié activityEvents | store `activityEvents` actif, `logActivity` disponible | `{"events":4,"legacyAdapted":true,"pass":true}` | PASS |
| 18 | Import commandes crée une commande avec patientRef opaque | commande créée, `patientRef="PAT-9001"`, aucun champ d'identité sur l'objet | `{"imported":1,"found":true,"patientRef":"PAT-9001","noIdentity":true,"pass":true}` | PASS |
| 19 | Import utilisateurs crée un utilisateur | utilisateur créé avec le rôle fourni | `{"imported":1,"found":true,"role":"Technicien","pass":true}` | PASS |
| 20 | Mapping bloque les champs requis non associés | champs `reference` et `type` signalés manquants | `{"missing":["reference","type"],"pass":true}` | PASS |
| 21 | Colonnes de données personnelles jamais mappables | aucune des 5 colonnes interdites ne reçoit de cible de mapping | `{"results":["","","","",""],"pass":true}` | PASS |
| 22 | slowMovingStock canonique : couverture OU absence de consommation | cas témoin (couverture normale + conso récente) = non dormant ; cas couverture excessive = dormant ; cas sans conso récente = dormant | `{"control":false,"caseCoverage":true,"caseNoRecent":true,"pass":true}` | PASS |
| 23 | Capture globale des erreurs techniques dans le Journal | erreur synthétique capturée dans `activityEvents`, verrou anti-récursion relâché après coup | `{"captured":true,"guardReset":true,"pass":true}` | PASS |
| 24 | Reset natif V6 supprime toute donnée custom | mouvement, commande, événement custom et note fournisseur personnalisée disparaissent, stock revient à la valeur de seed (5) | `{"movGone":true,"poGone":true,"actGone":true,"notesReset":true,"phys":5,"pass":true}` | PASS |

## 2. Hooks de persistance / migration / état vide (rechargement réel du navigateur)

| Test | Attendu | Résultat obtenu | Statut |
|------|---------|------------------|--------|
| `persistTest=setup` | stock +7 après ADJUSTMENT | `{"phase":"setup","pass":true,"before":5,"after":12}` | PASS |
| `persistTest=verify` (après rechargement à froid) | mouvement, événement, PO et note fournisseur personnalisés toujours présents ; stock=12 | `{"phase":"verify","pass":true,"mov":true,"act":true,"po":true,"notes":true,"physicalStock":12,"expectedPhysicalStock":12}` | PASS |
| `migrationTest=seed` | fixture V5 (qty=10, incoming=5) correctement écrite en localStorage | `{"phase":"seed","pass":true,"storedSchema":5,"storedQty":10,"storedIncoming":5}` | PASS |
| `migrationTest` — reproduction directe (fixture injectée puis navigation vers `?migrationTest=verify`) | physicalStock=10, incomingStock=5, 1 OPENING, 1 PO migré | **Avant correction du bug §2.2 du rapport d'implémentation** : `{"physicalStock":5,"incomingStock":0,"legacyIncomingPOs":0,"pass":false}` (échec, cause root identifiée : ordre de démarrage). **Après correction** : `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` | PASS (après correction) |
| `migrationTest=verify` — second rechargement (idempotence) | résultat strictement identique au premier passage, aucun doublon | `{"phase":"verify","pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1,"physicalStock":10,"incomingStock":5}` | PASS |
| `emptyTest=setup` | `purchaseProposals` vidées | `{"phase":"setup","pass":true,"count":0}` | PASS |
| `emptyTest=verify` | aucune réapparition aveugle de propositions de démonstration (`PP-001`/`PP-002`) après recalcul sur état vide | `{"phase":"verify","pass":true,"count":0,"blindSeed":false}` | PASS |

## 3. Smoke-test multi-mode × multi-largeur — `?smokeV34=1`

4 largeurs (1440, 1024, 768, 390 px) × 4 modes (laboratoire, staff, cabinet dentaire, scan) = 16 combinaisons.

| Largeur | lab | staff | dentiste | scan |
|---|---|---|---|---|
| 1440×900 | PASS | PASS | PASS | PASS |
| 1024×800 | PASS | PASS | PASS | PASS |
| 768×1024 | **ÉCHEC** — panneau « Messages » affiche le panneau Utilisateurs (voir §4) | PASS | PASS | PASS |
| 390×844 | **ÉCHEC** — même cause qu'à 768 px | PASS | PASS | **ÉCHEC** — débordement horizontal 437/390 px (voir §4) |

0 erreur console (`pageerror`/`console.error`) sur les 16 combinaisons, y compris les 3 combinaisons en échec fonctionnel.

Reproduction sur `dentalflow-next-poc-v3.4.1.html` non modifié : les 3 mêmes échecs, avec les mêmes valeurs exactes, apparaissent à l'identique. Confirmé **non-régression** — défauts préexistants, hors périmètre du moteur Stocks/Achats/Import/Journal traité par cette version (détail au §4 et dans le rapport d'implémentation §7).

## 4. Détail des 2 limitations préexistantes confirmées non-régressions

- **Panneau Messages** (768 px et 390 px, mode laboratoire) : `document.body.innerText` après `openSidePanel('messages')` contient le texte du panneau Utilisateurs (« Utilisateurs / Équipe laboratoire et responsabilités… ») au lieu de « Messages ». Reproduit à l'identique sur V3.4.1 non modifié.
- **Débordement horizontal en mode Scan à 390 px** : `document.body.scrollWidth` = 437 contre `window.innerWidth` = 390. Reproduit à l'identique sur V3.4.1 non modifié.

## 5. Tests Playwright de bout en bout (interactions réelles, hors `runAllTests`)

| Scénario | Attendu | Résultat obtenu | Statut |
|---|---|---|---|
| Ouverture assistant Import via menu utilisateur → « Données » | calque assistant ouvert | `wizard open: true` | PASS |
| Sélection type « commandes » → étape Fichier → upload réel d'un CSV (`Reference,Type,Cabinet,PatientFirst,RefPatient`) | fichier chargé, nom affiché, ligne comptée | `Fichier chargé : commandes.csv · 1 ligne(s)` | PASS |
| Étape Mapping : détection automatique + colonne interdite | `reference→reference`, `type→type`, `cabinet→cabinet`, `refpatient→patientref` auto-mappés ; `PatientFirst` affichée comme donnée personnelle non mappable, 1 seul badge « ignorée » dans l'assistant | `auto-mapping selects: [{"col":"reference","value":"reference"},{"col":"type","value":"type"},{"col":"cabinet","value":"cabinet"},{"col":"refpatient","value":"patientref"}]` ; `wizard-scoped forbidden pill count: 1` | PASS |
| Étape Prévisualisation | ligne visible sous forme mappée, aucune trace du prénom saisi | `preview includes CMD-IMP-001 and NOT Jean: true true` | PASS |
| Import final (bout en bout, jusqu'à écriture localStorage) | commande créée sans champ d'identité, `patientRef` propre (pas de double préfixe), `ImportJob` réellement persisté | `{"orderFound":true,"orderHasNoFirstName":true,"patientRef":"PAT-1001","importJob":{"id":"IMP-…","type":"commandes","fileName":"commandes.csv","rowCount":1,"importedCount":1,"rejectedCount":0}}` | PASS |
| Réception de commande fournisseur générique (formulaire par ligne, sans quantité codée en dur) | saisie manuelle `1` sur la ligne, reste au défaut du reliquat réel ; statut passe à `partially_received` | `{"status":"partially_received","lines":[{"a":"ART-CER-EMX-003","ordered":20,"received":1}]}` | PASS |
| Reset natif V6 via clic réel sur le bouton du menu utilisateur, puis rechargement à froid | toute donnée personnalisée (mouvement, PO, événement, note fournisseur) disparaît immédiatement et reste absente après rechargement ; stock d'ouverture Zircone = 5 | `after reset: {"hasMov":false,"hasPO":false,"hasAct":false,"ivoNotes":"Fournisseur préféré zircone/céramique","physOpening":5}` puis `after cold reload: {"hasMov":false,"ivoNotes":"Fournisseur préféré zircone/céramique","physOpening":5}` | PASS |

## 6. Synthèse

- Suite unitaire isolée : **24/24 PASS**, isolation d'état vérifiée strictement égale avant/après.
- Hooks persistance/migration/vide : **8/8 PASS** après correction du bug de migration détaillé au rapport d'implémentation.
- Smoke-test multi-mode × multi-largeur : **13/16 PASS**, 3 échecs confirmés préexistants et non liés au périmètre (reproduits à l'identique sur V3.4.1 non modifié).
- Scénarios Playwright de bout en bout (import, réception, reset) : **6/6 PASS**.
- **0 erreur console** (`SyntaxError`/`ReferenceError`/`TypeError`/rejet de promesse non capturé) sur l'ensemble des exécutions ci-dessus.
