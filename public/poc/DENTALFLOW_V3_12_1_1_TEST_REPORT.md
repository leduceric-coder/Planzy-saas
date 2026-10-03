# DentalFlow V3.12.1.1 — Rapport de tests (hotfix kit de test laboratoire)

Tous les tests ci-dessous ont été exécutés **sur le kit hotfixé** (`dentalflow-test-labo-v3.12.1.1.html`), par
automatisation Playwright avec de **véritables interactions navigateur** (`.click()`, `.fill()`,
`.selectOption()`) — jamais une assignation `.value=` suivie d'un événement synthétique pour tout ce que
l'interface médie. Les appels directs au moteur (`moveOrderToStage`, `createOrder`, etc.) ne sont utilisés que
pour la vérification de logique interne, en complément des interactions réelles, jamais en remplacement.

## Vérification MD5 produit (AVANT / APRÈS)

```
AVANT : 32ce4e69419d6bfae7d191c001d56b37  dentalflow-next-poc-v3.12.1.html
APRÈS : 32ce4e69419d6bfae7d191c001d56b37  dentalflow-next-poc-v3.12.1.html
git diff -- dentalflow-next-poc-v3.12.1.html   →  (vide)
```

**PRODUCT_V3_12_1_UNCHANGED : PASS**

## Correction de documentation — identité patient fictive dans state.orders

Le `DENTALFLOW_V3_12_1_TEST_REPORT.md` (lot précédent) indique que les identités fictives vivent « dans
`cabinetPatients`, jamais dans `state.orders` ». Cette formulation est **techniquement incomplète** : la
baseline V3.12.1 (reprise à l'identique dans ce kit V3.12.1.1) contient en réalité, pour chacune des 10
commandes fictives, les champs `patientFirstName:"Fictif"` et `patientLastName:"Démo NN"` **directement sur
l'objet commande** dans `state.orders` (utilisés uniquement pour amorcer `cabinetPatients` à la création).
Ceci n'a jamais été corrigé à tort dans le `DENTALFLOW_V3_12_1_TEST_REPORT.md` existant (non réécrit ici, par
choix — voir mandat) ; la réalité technique exacte est la suivante, vérifiée par le test
`TEST_FIXTURE_PATIENT_RAW_STATE` ci-dessous :

- Les identités « Fictif Démo NN » **peuvent** être présentes dans l'état embarqué/persisté
  (`state.orders[].patientFirstName/patientLastName`).
- **Aucune surface d'affichage côté Laboratoire** (tableau Commandes, fiche, traçabilité, bon de suivi, export
  CSV, recherche globale, portails Collaborateur/Scan) ne les expose jamais — vérifié sur 16 surfaces, 0 fuite.
- Le Cabinet propriétaire de la commande **peut** afficher ce nom (comportement normal et voulu, c'est son
  rôle).
- Ce mécanisme est un garde-fou applicatif côté affichage (le Labo ne lit jamais ces champs), **pas** une
  garantie d'isolation de données côté serveur de niveau production — ce n'est pas présenté comme tel.

**PATIENT_FIXTURE_DOCUMENTATION_CORRECTED : PASS**

```
TEST_FIXTURE_PATIENT_RAW_STATE : PASS
  rawCheck.hasRaw: true (CMD-0205 porte bien patientFirstName:"Fictif"/patientLastName:"Démo 01" dans state.orders)
  leaks (surfaces Labo: home/orders/production/stock/reports/globalSearch): 0
  searchFoundRaw (recherche globale "Démo 01"): false
  cabSeesIt (Cabinet ANDRE-GUILLOU Fabienne voit "Fictif Démo 01"): true
```

## Tests ciblés — Problème 1 (session Scan)

Exécutés sur `?mode=scan`, fraîchement démarré, puis via changements réels de poste/technicien (sélecteurs
cliqués, jamais `.value=`) :

| Test | Résultat | Détail |
|---|---|---|
| SCANSESSION01 | PASS | `state.scanTechnicianId` (`U-CORALIE-BASTIER`) correspond à un utilisateur réellement présent dans `state.users` |
| SCANSESSION02 | PASS | Ce même utilisateur possède `production.scan` |
| SCANSESSION03 | PASS | `state.scanStation` (`Modélisation`, `STG-002`) est actif et scannable |
| SCANSESSION04 | PASS | Le poste par défaut n'est jamais Réception |
| SCANSESSION05 | PASS | Le sélecteur Technicien propose exactement les 9 membres actifs habilités à scanner (`eligibleScanTechnicians()`), aucun de plus, aucun de moins |
| SCANSESSION06 | PASS | Changement de technicien (Florence MIFUNE sélectionnée par clic réel) → `LocationEvent.actorId` du scan suivant = `U-FLORENCE-MIFUNE` (id réel sélectionné) |
| SCANSESSION07 | PASS | Aucune résolution par prénom nécessaire dans ce nouveau parcours (`actorId` vient directement du sélecteur) |
| SCANSESSION08 | PASS | Poste Réception sélectionné → scan bloqué **avant** tout décodage, message exact *« Ce poste ne nécessite pas de scan. Choisissez un poste de production. »*, zone de capture absente du DOM |
| SCANSESSION09 | PASS | Poste Modélisation + technicien compatible → scan réel (saisie manuelle de l'identifiant) → succès, `LocationEvent` créé avec l'acteur réel |
| SCANSESSION10 | PASS | Aucune occurrence fonctionnelle de `scanTechnician:'Marc'` au démarrage du kit |

**Scénario B (smartphone/kiosque, clics réels)** : technicien affiché = personnel réellement importé
(Coralie BASTIER), poste par défaut scannable, scan manuel d'une commande fictive réelle → `LocationEvent`
créé avec `actorId`/`actorName` exacts, aucune occurrence de « Marc » nulle part sur l'écran. **PASS**
(5/5 vérifications).

**Scénario C (Réception, clics réels)** : sélection du poste Réception → message de blocage exact affiché
immédiatement, zone de capture absente, aucun `LocationEvent` de source `SCAN` créé. **PASS** (3/3).

## Tests ciblés — Problème 2 (session de recette)

| Test | Résultat | Détail |
|---|---|---|
| TESTPERM01 | PASS | `state.users.length === 13` |
| TESTPERM02 | PASS | Permissions de tous les utilisateurs réels identiques avant/après (snapshot comparé) |
| TESTPERM03 | PASS | Création d'une commande via le vrai bouton « Nouvelle commande » + moteur réel : `CMD-0215` créée |
| TESTPERM04 | PASS | Déplacement manuel réel vers Modélisation (`success:true`, aucun `FORBIDDEN`) |
| TESTPERM05 | PASS | Déplacement manuel réel vers Usinage (`success:true`) |
| TESTPERM06 | PASS | `currentUser().permissions` strictement inchangé après ces actions |
| TESTPERM07 | PASS | Après F5 (reload réel), `can(currentUser(),'production.manage')` reste vrai, 13 utilisateurs, override toujours actif |
| TESTPERM08 | PASS | Après reset observateur (bouton réel cliqué), retour à 10 commandes, aucune trace de la commande de test, 13 utilisateurs |
| TESTPERM09 | PASS | Sous `?runTests=1`, `window.testSessionOverride` est `undefined` — la suite interne native n'est jamais perturbée |
| TESTPERM10 | PASS | 0 occurrence de `testSessionOverride`/`scanTechnicianId`/`resolveDefaultScanTechnician`/`"Session test laboratoire"` dans `dentalflow-next-poc-v3.12.1.html` |

**Règle d'attribution d'acteur, vérifiée explicitement** : les deux déplacements manuels ci-dessus (Modélisation
puis Usinage), effectués sans sélection explicite d'un acteur métier réel, portent
`actorId:null, actorName:"Session test laboratoire"` dans `state.locationEvents` — jamais le nom de Gaëtane
DUIGOU ou de tout autre employé réel qui n'a pas réalisé l'action. **PASS.**

**Scénario A (Labo, clics réels)** : ouverture du kit, création d'une commande via le vrai formulaire
(cabinet + service + patient saisis par de véritables clics/`.fill()`), ouverture de Production, déplacement
réel Réception → Modélisation → Usinage via le panneau « Changer la localisation » (sélection réelle + clic
Confirmer), **aucun message « Droits insuffisants » à aucun moment**, attribution correcte
(« Session test laboratoire » sur les deux événements), 0 erreur console. **PASS** (6/6 vérifications).

## Confidentialité patient (P1-P6 + anti-fuite automatique)

Rejoué intégralement sur le kit V3.12.1.1 (même méthodologie que V3.12.1, données baked-in CMD-0205/« Fictif
Démo 01 ») :

```
P1 (vue Cabinet voit le nom)                         PASS
P2 (0 écrans Labo : tableau/fiche/traçabilité/impr.)  PASS (0 fuite)
P3 (recherche globale, 0 fuite, trouvable par id)     PASS
P4 (portails Collaborateur/Scan, 0 fuite)             PASS
P5 (CSV/bon de suivi, 0 fuite ; export JSON — voulu)  PASS
P6 (Cabinet conserve l'accès après)                   PASS
ANTI-FUITE AUTOMATIQUE (16 surfaces : home/orders/production/stock/reports/planning/users/
cabinets/invoices/quickView/sidePanel/printFiche/globalSearch/csvCommandes/portalStaff/portalScan)
LAB_PATIENT_NAME_LEAKS = 0
Erreurs console : 0
```

**LAB_PATIENT_NAME_LEAKS : 0 / attendu 0**

## Non-régression complète (kit hotfixé)

| Suite | Résultat |
|---|---|
| Suite interne (`?runTests=1`) ×3 | 468/468, 468/468, 468/468 — 0 erreur console sur chacun des 3 runs |
| NAVDOM (adapté kit — orders/planning à 0 légitimement) | 31/31 |
| UI CLICK | 16/16 |
| REC01-06 / FLOW01-09 / CABFLOW01-06 (21 tests, acteur recette réel résolu dynamiquement) | 21/21 |
| MIGFLOW01-05 | 5/5 |
| SEL01-05 (adapté roster réel importé — mêmes mécanismes exacts : substring, insensibilité casse/accents, filtre cabinet→dentiste, pas de rémanence inter-cabinet) | 5/5 |
| CABSEL01-02 | 2/2 |
| CABTEETH01-02 | 2/2 |
| EDIT01-04 / DATE01-04 | 8/8 |
| QR01, QR02, QR03, QR05 | 4/4 — QR04 : voir ci-dessous |
| CABUX01-10 | 10/10 |
| Confidentialité P1-P6 + anti-fuite | 6/6 + 0 fuite |

Erreurs console relevées sur l'ensemble de ces runs : **0**.

### Note sur l'adaptation de certains scripts de test au roster réel du kit

Les scripts REC/FLOW/CABFLOW/SEL hérités de V3.12.1 référencent, comme toute la suite de non-régression du
produit, le personnel/les prestations/les cabinets du **seed de démonstration natif** (`U1`/`Eric Leduc`,
`SVC-001`, `Cabinet Moderne`, `Dr. Morvan`…) — absents par construction de ce kit, qui exclut délibérément
toute fixture de démonstration (voir V3.12.1, principe B1-B3). Comme pour l'adaptation déjà précédente des
badges NAVDOM (orders/planning légitimement à 0 sur ce kit), ces scripts de test ont été adaptés pour
utiliser les équivalents réels du kit (ex. un acteur réellement habilité `production.manage` résolu
dynamiquement au lieu de l'id `'U1'` codé en dur, une prestation réellement qualifiée résolue au lieu de
`SVC-001`, « Fabienne ANDRE-GUILLOU »/« Agnés CAMMAS »/« ENORA DUPUY » au lieu de noms de démonstration
absents du corpus) — **jamais le kit ni le produit n'ont été modifiés pour ces besoins de test**, seuls les
scripts de test (fichiers de travail, non livrés) ont été adaptés, exactement le même principe que
l'adaptation NAVDOM déjà actée en V3.12.1.

### QR04 — réserve inchangée

```
QR04 : HARDWARE_REAL_SCAN_NOT_VERIFIED
```

Aucun test caméra réelle sur smartphone physique n'a été effectué dans le cadre de ce hotfix (environnement
d'exécution sans accès matériel). Le wiring des fonctions caméra (`startScanModeCameraScan`,
`stopScanModeCameraScan`, décodage multi-passes) est vérifié présent et fonctionnel ; le comportement en
contexte `file://` (refus caméra, repli photo/saisie manuelle explicite) est vérifié conforme. Procédure de
vérification physique documentée dans le README.

## Baseline — comptages exacts (inchangés)

```
cabinets: 126   dentists: 91   users: 13   services: 352   suppliers: 19   articles: 515   orders: 10
Répartition : Réception 2 / Modélisation 2 / Usinage 2 / Finition 1 2 / Finition 2 1 / Expédition 1
Livrées : 0   Annulées : 0
Stock total (qty) : 1926.5 (identique à V3.12.1)   stockMovements : 515
```

DATA01 à DATA15 (comptages + répartition + 0 livrée/annulée) : **15/15 PASS**.

## Clés localStorage dédiées — isolation vérifiée

`dentalflow-test-labo-v31211-state-v1` / `dentalflow-test-labo-v31211-cabinet-patients-v1` — distinctes des
clés V3.12.1 (`dentalflow-test-labo-v3121-*`) et du produit. Vérifié : amorçage depuis sa propre baseline au
premier lancement, persistance F5, reset observateur, et absence totale d'interférence avec un éventuel
localStorage V3.12.1 ou produit déjà présent sur le même navigateur (clés physiquement distinctes).
