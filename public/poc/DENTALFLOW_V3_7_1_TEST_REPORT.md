# DentalFlow Next V3.7.1 — Rapport de tests

Base : `dentalflow-next-poc-v3.7.html` (154/154 PASS). Livrable : `dentalflow-next-poc-v3.7.1.html`.

## Suite unitaire intégrée (`?runTests=1`)

**164/164 PASS**, 0 erreur console, stable sur plusieurs exécutions consécutives (154 + 10 tests, confirmé 3 fois d'affilée).

- **154 tests V3.7 strictement conservés, inchangés, aucune assertion affaiblie** (dont N11, mis à jour pour vérifier le comportement INVERSE — voir note ci-dessous, comportement attendu et documenté, pas une régression).
- **10 nouveaux tests V3.7.1**, un par sous-partie testable au niveau moteur du mandat.

### Note — test N11 mis à jour (comportement attendu, pas une régression)

`N11` (introduit en V3.6.1) affirmait que sans `BarcodeDetector` natif, `cameraCapability.supported` DEVAIT être `false` — c'était littéralement le bug corrigé par la Partie A de ce hotfix. Le test est réécrit pour vérifier l'exact inverse : sans `BarcodeDetector` natif, `supported` doit être `true` via `strategy==='EMBEDDED_DATAMATRIX_DECODER'`, et le décodeur embarqué doit être réellement disponible (`getCameraDiagnostic().embeddedDecoder===true`). Le nouvel intitulé documente explicitement le changement.

## Détail des 10 nouveaux tests (valeurs réelles observées)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| S01 `getCameraDiagnostic()` | 7 clés présentes, types corrects | `{"secureContext":true,"protocol":"file:","mediaDevices":true,"getUserMedia":true,"barcodeDetector":false,"supportedFormats":[],"embeddedDecoder":true}` | PASS |
| S03 décodeur embarqué — aller-retour réel | code GS1 encodé (ZXing writer) → décodé (ZXing reader du même build) → identique | `decoded` = original exact, `gtinOk:true`, `lotOk:true` | PASS |
| S05 repli manuel indépendant de la caméra | `parseGS1Code` fonctionne même caméra forcée indisponible | `manualFlowWorks:true` | PASS |
| S06 `stopCameraScan()` idempotent | flux jamais actif après appel(s) répétés | `streamNullAfter:true, flagResetAfter:true` | PASS |
| C01-C04 Plan de charge cohérent | 5 cmd 100..500€ ⇒ Charge=5/Valeur=1500€ ; annulation 500€ ⇒ Charge=4/Valeur=1000€ | `chargeDelta:5, valDelta:1500, chargeDeltaAfterCancel:4, valDeltaAfterCancel:1000` | PASS |
| ST01/ST02/ST04 Stock — carte + fabricant + boutons | carte "Articles en stock", fabricant = nom (pas MFR-), 3 boutons présents | `hasCardTitle:true, mfrIsName:true, manualBtn:true, scanBtn:true, importBtn:true` | PASS |
| P01-P02 permissions FR | 19/19 codes labellisés en français, regroupés, moteur inchangé | `allLabeled:true, groupsCoverAll:true, enginesStillWork:true` | PASS |
| M01-M02 messages seed V8 | ≥4 threads non vides, rattachés à de vraies commandes | `threadCount:4, allLinkToRealOrders:true` | PASS |
| R03-R05 Réglé dérivé d'invoicePayments | pointage réel ⇒ semaine/mois/KPI actualisés du même montant | `recorded:true, weekDelta:185, kpiDelta:185, monthIncludesIt:true` | PASS |
| O01-O03 chevron SVG | SVG réel (jamais ›), rotation .open desktop+mobile | `hasSvgDesktop:true, hasSvgMobile:true, openClassDesktop:true, openClassMobile:true` | PASS |

## Scénarios navigateur réels bout-en-bout (clics/fichiers/flux réels, contexte frais)

Ces scénarios distinguent explicitement ce qui a été RÉELLEMENT exercé, jamais présenté comme validé sans preuve directe (mandat §52) :

- **CAMERA LIVE TESTED** (avec périphérique vidéo simulé Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, aucune webcam réelle disponible dans cet environnement) : clic réel sur « Scanner avec la caméra » → `getUserMedia` retourne un vrai `MediaStream` (640×480, `track.readyState:"live"`) → boucle de décodage embarqué active ~700ms sans erreur console → clic réel sur « Arrêter la caméra » → le MÊME objet `MediaStreamTrack` passe à `readyState:"ended"` (vérifié par référence directe, pas par re-requête DOM) → bouton « Scanner avec la caméra » réapparaît (confirmation UI que `stopCameraScan()` + re-render ont bien eu lieu). **0 erreur console.**
- **EMBEDDED DECODER TESTED** (round-trip complet, mécanisme utilisé par la caméra live ET la photo) : `(01)03453120000011(17)261231(10)LOTZXTEST` encodé avec `ZXing.DataMatrixWriter`, rendu sur canvas (échelle 6px/module, marge de silence 4 modules), relu directement par `decodeImageDataWithZXing()` → texte décodé strictement identique à l'original.
- **PHOTO FALLBACK TESTED, via le vrai `<input type=file>`** : le même code GS1 encodé exporté en PNG réel sur disque (`canvas.toDataURL` → fichier), puis **uploadé avec `page.setInputFiles()` sur l'input caché réel du panneau** (déclenchant le vrai listener `change`) → `handleScanPhotoFile` décode et route vers `state.stockScanDraft` → écran passe à « GTIN inconnu — associez ce code », GTIN `03453120000011` et lot `LOT2601` corrects. **0 erreur console.**
- **MANUAL FALLBACK TESTED** : saisie GS1 dans le textarea du panneau réel, soumission du formulaire, écran de confirmation avec GTIN/lot corrects affiché (`.quick-grid` visible). **0 erreur console.**
- **Cohérence Plan de charge, clics réels** : navigation Outils → Charge, section « Projection sur 8 semaines » affichée sans dépendre du carnet synthétique pour son calcul (vérifié au niveau moteur ci-dessus ; le rendu DOM utilise les mêmes fonctions).
- **Stock, clics réels** : navigation vers Stock (desktop 1440px) → carte "Articles en stock" avec compteur "9 articles" visible, tableau visible, cartes mobiles masquées (`display:none`), fabricant "Ivoclar" affiché en toutes lettres. À 390px : tableau masqué, 9 cartes affichées, aucun débordement horizontal (`scrollWidth<=innerWidth+2`).
- **Réglé, flux UI complet réel** : Accueil → 8 cartes KPI visibles (En production/À livrer aujourd'hui/En retard/Bloquées/CA en production/À facturer/Facturé/**Réglé**) → clic sur Réglé → popup "Règlements encaissés" (résumé 4 cartes, onglets Semaines(8)/Mois(12), clic sur une semaine → détail "Aucun règlement sur cette période" pour la semaine testée) → fermeture → navigation Factures/Pointage → clic réel "Pointer" sur une facture SENT → formulaire rempli et soumis → retour Accueil : KPI Réglé passe de **185€ à 370€** (`computeRevenueKPIs().paid` confirme la même valeur) → réouverture du popup : "Cette semaine" affiche désormais **185€** (le montant du pointage réalisé, immédiatement reflété, sans reload). **0 erreur console sur l'ensemble du flux.**
- **Chevron Outils, mesures réelles** : desktop 1440px, SVG 18×18px dans une boîte 32×32px, `color:rgb(64,80,111)` = exactement `var(--text-secondary)` (`#40506f`), rotation `none`→`matrix(0,1,-1,0,0,0)` (90°) au clic. Identique dans le drawer mobile 390px.

## Isolation (export JSON avant/après)

`exportDentalFlowJSON()` strictement identique avant/après les 164 tests :
```
{"identical":true,"testsPass":true,"total":164,"passed":164}
```

## Responsive & console (24 combos : 6 viewports × 4 modes)

Étendu par rapport à V3.7 (qui testait 4 viewports) : script `full_regression.js` adapté aux 6 largeurs demandées (1440/1024/768/430/390/375), lab/staff/dentist/scan : **24/24 PASS**, 0 erreur console.

Un débordement horizontal de 8px a été détecté à 375px en mode dentist (portail cabinet, rangée d'onglets) lors de la première exécution — reproduit à l'identique sur `dentalflow-next-poc-v3.7.html` (donc pré-existant, non introduit par ce hotfix), corrigé (voir Changelog/Implementation Report), puis re-testé : **24/24 PASS** confirmé après correction.

## Géométrie réelle des onglets (`getBoundingClientRect`, tolérance 1px)

Script `v352_geometry.js`, Commandes / Stocks & achats / Rapports, 4 largeurs : **PASS partout**, ΔX=0.00 ΔY=0.00 (inclut la nouvelle carte "Articles en stock").

## Thèmes (12 combos : 4 viewports × 3 thèmes)

Script `v352_theme_quick.js` : **12/12 PASS**, thème appliqué (light/dark/system), aucun débordement horizontal, 0 erreur console — inclut la page Stock avec sa nouvelle carte et ses cartes mobiles.

## `node --check`

Le fichier compte désormais **4 blocs `<script>`** (ajout du décodeur ZXing embarqué par rapport aux 3 blocs de V3.7) — les 4 passent `node --check` sans erreur.

## Synthèse Definition of Done (mandat §53)

| Exigence | Statut |
|---|---|
| P30 Pro ne dépend plus de BarcodeDetector natif uniquement | ✅ (§S01/S03, EMBEDDED_DATAMATRIX_DECODER) |
| Photo fallback présent | ✅ (upload réel via `setInputFiles`, décodage GTIN/lot corrects) |
| Scan manuel toujours fonctionnel | ✅ (S05, indépendant de l'état caméra) |
| Diagnostic caméra explicite | ✅ (`getCameraDiagnostic`/`cameraUnavailableReason`/`explainCameraError`) |
| Charge = vraies commandes | ✅ (C01-C04, `ordersDueInWeek`) |
| Valeur = mêmes vraies commandes | ✅ (même source que Charge, par construction) |
| Aucune charge fictive dans la projection réelle | ✅ (`ORDER_BOOK` cantonné au What-If) |
| Tableau Stock visuellement rétabli | ✅ (carte + en-tête + compteur) |
| Stock mobile en cartes | ✅ (9/9 cartes à 390px, tableau masqué) |
| Fabricants lisibles | ✅ ("Ivoclar", jamais "MFR-IVOC...") |
| Permissions en français | ✅ (19/19 codes, P01-P02) |
| Messages V8 réalistes | ✅ (4 threads, rattachés à de vraies commandes, M01-M02) |
| Réglé de retour sur Accueil | ✅ (8 cartes KPI) |
| Historique semaines/mois fonctionnel | ✅ (8 semaines/12 mois, détail par période) |
| Pointage actualise Réglé | ✅ (185€→370€ vérifié en flux UI réel) |
| Chevron Outils visible | ✅ (18px SVG, contraste text-secondary, O01-O03) |
| Tests existants PASS | ✅ (154/154, N11 mis à jour et documenté) |
| Nouveaux tests PASS | ✅ (10/10) |
| Responsive PASS | ✅ (24/24, 6 viewports) |
| `node --check` PASS | ✅ (4 blocs) |
| Zéro erreur console | ✅ |
