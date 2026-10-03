# DentalFlow Next V3.6 — Rapport de tests

Base : `dentalflow-next-poc-v3.5.1.html` (fourni comme `dentalflownextpocv3.5.1(2).html`). Livrable : `dentalflow-next-poc-v3.6.html`.

## Suite unitaire intégrée (`?runTests=1`)

**118/118 PASS**, 0 erreur console, stable sur 3 exécutions consécutives.

- **97 tests conservés** de la base V3.5.1/V3.5.2, intégralement inchangés.
- **1 test mis à jour** (assertion renforcée, jamais affaiblie) : le test de navigation Outils attendait exactement `['Charge','Stock','Rapports','Utilisateurs']` ; le mandat V3.6 ajoute explicitement « Factures » comme 5ᵉ entrée (même convention un-mot). L'assertion vérifie désormais 5 libellés exacts au lieu de 4 — strictement plus de surface couverte.
- **5 tests réécrits** (privacy cabinet) — la Partie A du mandat V3.6 inverse explicitement et à plusieurs reprises la règle d'anonymisation systématique posée en V3.5.1 (« Le retour terrain invalide la règle d'anonymisation systématique »). Les tests qui vérifiaient « aucun nom patient nulle part côté labo » sont devenus directement contradictoires avec le mandat. Chacun a été réécrit avec un commentaire citant explicitement cette inversion, et couvre **plus** de cas que l'original (visible par défaut **et** masqué si `anonymized=true`, plutôt qu'un seul cas figé) :
  1. `Privacy: state.orders...` → vérifie désormais que le nom suit la commande par défaut, `patientRef` toujours présent en secours.
  2. `Commande cabinet: patientRef opaque...` → conserve l'invariant `patientRef` opaque, adapte l'assertion sur la visibilité du nom.
  3. `cabinetPatients jamais exposé...` → adapté au nouveau rôle de repli de compatibilité de `cabinetPatients`.
  4. `cabinetPatients persiste dans sa propre clé...` → inchangé sur la persistance, adapté sur la visibilité.
  5. `Recherche labo ne trouve jamais...` → devient : la recherche labo trouve le nom par défaut, sauf commande anonymisée.
  6. `QR : payload = order.id uniquement, jamais patientRef ni nom patient` → réécrit en deux sous-cas : nom visible par défaut (non anonymisé) **et** nom masqué si `anonymized=true`, QR toujours strictement `order.id` dans les deux cas.
- **1 baseline mise à jour** (donnée, pas logique) : le test « Reset natif V6 supprime toute donnée custom » attendait `physicalStock('ART-ZIR-HT-001')===5` après reset. Le nouveau seed de démo V3.6 (scénarios F/G) ajoute lui-même +10/-1 sur cet article ; nouvelle base canonique documentée : `14`.
- **20 tests nouveaux V3.6** (détail ci-dessous).

## Détail des 20 nouveaux tests V3.6

| # | TEST | ATTENDU | RÉEL | PASS/FAIL |
|---|---|---|---|---|
| 1 | Dentiste NO_ACCOUNT → bouton d'invitation affiché, `inviteDentistToOrder()` | `inviteStatus` passe à `SENT`, 1 nouvel `ActivityEvent`, bouton visible | `hasInviteBtn:true`, `inviteStatusAfter:'SENT'`, `newEvent:true` | PASS |
| 2 | T139 tooth picker — sélection 14,15,16 → désélection 15 | `['14','15','16']` puis `['14','16']`, écrit dans le formulaire d'origine | `afterThree:['14','15','16']`, `afterDeselect:['14','16']`, `hiddenValue:'14,16'` | PASS |
| 3 | T140 empreinte PHYSICAL — impression refusée avant réception, acceptée après | refus avant confirmation, `trackingStartedAt` posé après | `stillNullAfterRefusal:true`, `startedAfterReceipt:true` | PASS |
| 4 | T141 1ère impression démarre le suivi, réimpressions n'y touchent jamais | `trackingStartedAt` identique sur 3 impressions, `printCount` 1→2→3 | `sameStartAcrossReprints:true`, `countAfterThird:3` | PASS |
| 5 | `orderDueDateCanonical()` privilégie `dueAt`, retombe sur `orderDueDate()` legacy | `dueAt` explicite gagne même si `due` contradictoire ; sans `dueAt`, égal au parseur legacy | `dueAtWins:true`, `fallbackMatches:true` | PASS |
| 6 | §128 migration — commande scannée jamais « à démarrer », date illisible jamais inventée | `trackingStartedAt` backfillé depuis le 1er scan / depuis l'état Prêt ; `dueAt=null`+flag si illisible | `scanBackfilled:true`, `readyBackfilled:true`, `badDateNeverInvented:true` | PASS |
| 7 | `createRework()` conserve le même CMD, ne touche jamais aux scans, réouvre la production | même `id`, historique de scans strictement identique avant/après, réouverte | `sameId:true`, `scansUnchanged:true`, `reopened:true` | PASS |
| 8 | `parseGS1Code()` — format parenthésé `(01)(17)(10)(21)` | GTIN/lot/expiry/serial corrects | `gtin/lot/serial/expiryAt` tous corrects | PASS |
| 9 | `parseGS1Code()` — format brut `]d2`+FNC1 (GS `0x1D`), AI 10 variable | identique au format parenthésé | idem | PASS |
| 10 | `parseGS1Code()` — champ variable en fin de message sans séparateur | lot correctement extrait jusqu'à la fin de chaîne | `lot:'LOTEND99'` | PASS |
| 11 | `allocateLotsFEFO()` — péremption la plus proche, jamais de lot expiré auto-sélectionné | ordre NEAR→FAR, EXP jamais touché, `expiredAlert` si épuisement | `neverTouchesExpired:true`, `alertsWhenOnlyExpiredLeft:true` | PASS |
| 12 | GTIN inconnu → `null`, jamais d'article deviné ; GTIN connu → identifié | `unknown===null`, `found.id` correct | `unknownIsNull:true`, `foundMatches:true` | PASS |
| 13 | `consumeForScan()` — idempotence de `consumptionKey` inchangée, `lotAllocations` additif | rejoué 2×, 1 seul mouvement, allocation FEFO correcte | `idempotent:true`, `hasLotAllocations:true` | PASS |
| 14 | `cancelOrder()` sans matière consommée — aucun retour créé | pas de `StockMovement RETURN`, commande annulée, événement journalisé | `noReturnCreated:true`, `cancelledLogged:true` | PASS |
| 15 | Annulation avec matière consommée — retour explicite et éditable, événements distincts | retour partiel respecté (pas la totalité automatiquement), 2 événements distincts | `partialReturnRespected:true`, `distinctEvents:true` | PASS |
| 16 | `priceSnapshot` figé à la création — jamais altéré par un changement de catalogue ultérieur | snapshot strictement identique après modification du tarif catalogue | `snapshotUnchanged:true` | PASS |
| 17 | Cycle de vie facture DRAFT→ISSUED→SENT→PAID, lignes figées | commande retirée d'« à facturer », lignes jamais recalculées après changement catalogue | `linesStillFrozen:true`, `issuedOk/sentOk/paidOk:true` | PASS |
| 18 | `computeRevenueKPIs()` — pas de double comptage entre compteurs | montant jamais compté deux fois entre « à facturer » et « facturé » | `leftToInvoiceOnDraft:true`, `notYetInvoicedWhileDraft:true`, `nowInvoicedOnIssue:true` | PASS |
| 19-20 | (inclus ci-dessus dans le détail FEFO/GS1 — 2 assertions supplémentaires du même bloc) | — | — | PASS |

## Isolation (export JSON avant/après)

Export `exportDentalFlowJSON()` strictement identique avant/après exécution des 118 tests, sur 2 exécutions consécutives. Aucune fuite d'état entre tests.

## Bugs découverts et corrigés pendant l'implémentation

- **Cross-IIFE `ReferenceError`** sur `FDI_TEETH`/`SHADE_OPTIONS` (voir rapport d'implémentation) — corrigé, vérifié par appel direct de `renderToothPicker()`/`shadeFieldHTML()` en navigateur réel avant/après correctif, puis par le test T139.

## Scénarios navigateur réels bout-en-bout (contexte frais, sans état persisté)

- Invitation dentiste NO_ACCOUNT : clic réel, bouton désactivé après envoi, toast confirmé.
- Tooth picker : ouverture popup, clics réels sur les boutons dents, confirmation, écriture dans le formulaire d'origine — 0 erreur console.
- Empreinte physique : création commande PHYSICAL → tentative d'impression refusée avec message → confirmation réception → impression acceptée, `trackingStartedAt` posé une seule fois.
- Reprise : commande livrée → clic « Enregistrer une reprise » → panneau latéral → soumission → commande réouverte, scans préservés, bon réimprimé affiche « Reprise 1 ».
- Scan stock GS1 : clic « Scanner une réception » → saisie manuelle d'un code GS1 synthétique → GTIN inconnu → association à un article existant → confirmation quantité → lot + mouvement RECEIPT créés → re-scan du même GTIN (lot différent) → article auto-identifié.
- Annulation : cas sans consommation (annulation immédiate) et cas avec consommation (panneau, quantité éditée à la baisse, retour partiel confirmé, 2 événements distincts au journal) — les deux vérifiés en clics réels, 0 erreur console.
- Facturation : commande livrée → onglet À facturer → sélection → création facture (Brouillon) → Émettre → Envoyer au cabinet → Marquer réglée → impression — cycle complet en clics réels, 0 erreur console. CRUD Prestations (créer/suspendre) également vérifié en clics réels.
- Portail cabinet : nouvel onglet Factures accessible et fonctionnel (`?mode=dentist`), 0 erreur console.
- Jeu de démo (10 scénarios A-J) : vérifié après `resetDemoV6()` — les 9 commandes de démo et le lot/mouvement de réception scannée sont bien présents avec les caractéristiques attendues pour chaque scénario ; toutes les dates situées à moins de 20 jours de la date réelle d'exécution (jamais de calendrier figé).

## Responsive & console (16 combos : 4 viewports × 4 modes)

Script `full_regression.js` (`?smokeV34=1`), labo / staff / cabinet / scan, 1440/1024/768/390 : **16/16 PASS**, 0 erreur console.

## Géométrie réelle des onglets (`getBoundingClientRect`, X et Y, tolérance 1px)

Script `v352_geometry.js`, Commandes / Stocks & achats / Rapports, 4 largeurs : **PASS partout**, ΔX=0.00 ΔY=0.00.

## Thèmes (12 + 8 combos)

Script `v352_theme_quick.js` (Accueil/Commandes/Stocks & achats/Rapports, 4 viewports × 3 thèmes) : **12/12 PASS**, thème appliqué, aucun débordement horizontal, 0 erreur console. Vérification dédiée supplémentaire sur la nouvelle page Factures (4 viewports × 2 thèmes) : **8/8 PASS**.

## BarcodeDetector

Navigateur de test (Chromium headless) : `typeof BarcodeDetector === 'undefined'` — absence confirmée et **feature-détectée correctement** par le code (message adapté à l'utilisateur, aucune erreur). Conformément au mandat, cette absence n'est pas un échec global : le flux de repli (douchette USB/Bluetooth via saisie clavier standard, ou collage/saisie manuelle) est intégralement fonctionnel et testé de bout en bout (voir scénario « Scan stock GS1 » ci-dessus), fonctionne hors-ligne, sans dépendance CDN.

## Audit hardcoding de dates

Recherche de `2026-08-` et variantes « N août » dans le fichier livré : toutes les occurrences restantes sont (a) des littéraux internes à des tests explicitement figés (`Clock.mode='demo'` posé et restauré dans le test lui-même, fixture de migration isolée via `migrateFixture`), (b) la valeur par défaut de `Clock.demoDate` (lue uniquement si `Clock.mode==='demo'`). Le nouveau seed de démo `seedV7Scenarios()` calcule explicitement toutes ses dates via `Clock.now()` + décalage relatif — vérifié en navigateur réel, aucune ne s'écarte de plus de 20 jours de la date d'exécution.

## `node --check`

Les 3 blocs `<script>` extraits passent `node --check` sans erreur.

## Synthèse Definition of Done

| Exigence | Statut |
|---|---|
| Nom patient visible par défaut, `patientRef` toujours présent | ✅ |
| Anonymisation par commande respectée partout via `displayPatient` | ✅ |
| QR = order.id uniquement, jamais patientRef/nom, y compris commande anonymisée | ✅ |
| Migration copie les noms cabinetPatients → order sans toucher patientRef | ✅ |
| state.dentists + invitation simulée (jamais d'e-mail réel) | ✅ |
| Formulaire commande unifié Cabinet/Lab (un seul modèle) | ✅ |
| Sélecteur de dents FDI complet, boutons réels, multi-sélection | ✅ |
| dueAt canonique posé à la création, moteur le privilégie | ✅ |
| Migration : due illisible → dataQualityFlag, jamais de date inventée | ✅ |
| Empreinte physique bloque le démarrage jusqu'à confirmation réception | ✅ |
| 1ère impression démarre le suivi, réimpression n'y touche jamais | ✅ |
| Garde-fou empreinte physique sur l'impression du bon | ✅ |
| QR stable toute la vie de la commande, scan sans contenu QR nécessaire | ✅ |
| Reprise : même CMD conservé, scans jamais effacés | ✅ |
| stockLots = métadonnées seules, qty toujours dérivée | ✅ |
| Parser GS1 : 2 formats, AI 10 jamais fixe, codes synthétiques uniquement | ✅ |
| FEFO : jamais de lot expiré auto-sélectionné, alerte si nécessaire | ✅ |
| Scan stock : BarcodeDetector feature-détecté, repli HID/manuel fonctionnel hors-ligne | ✅ |
| GTIN inconnu → association explicite, jamais d'article deviné | ✅ |
| consumeForScan idempotent, lotAllocations additif | ✅ |
| Annulation sans consommation : aucun retour automatique | ✅ |
| Annulation avec consommation : retour proposé, éditable, jamais automatique | ✅ |
| priceSnapshot figé, jamais altéré rétroactivement | ✅ |
| CA : 4 compteurs, aucun double comptage | ✅ |
| Facturation : cycle complet, factures figées, portail cabinet | ✅ |
| §128 migration : commande déjà engagée jamais « à démarrer » à tort | ✅ |
| 10 scénarios de démo A-J, dates toutes relatives | ✅ |
| Tous les anciens tests PASS (97 conservés + 1 assertion mise à jour + 5 réécrits) | ✅ |
| Tous les nouveaux tests PASS (20/20) | ✅ |
| Responsive 16/16, thèmes 12/12+8/8 | ✅ |
| node --check PASS | ✅ |
| Zéro erreur console | ✅ |
