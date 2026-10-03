# DentalFlow Next V3.7.1 — Rapport d'implémentation

Correctif terrain (« Field Test Correctness & Mobile Scan ») après test réel sur smartphone Huawei P30 Pro. Base : `dentalflow-next-poc-v3.7.html` (inchangée). Livrable : `dentalflow-next-poc-v3.7.1.html`.

## Architecture — un 4ᵉ bloc `<script>`

Le fichier restait à 3 blocs `<script>` depuis V3.4 (générateur QR inline, script de base non strict, IIFE `'use strict'`). V3.7.1 en ajoute un **4ᵉ, inséré entre le générateur QR et le script de base** : la bibliothèque **@zxing/library 0.23.0** (Apache-2.0), build UMD minifié téléchargé depuis le registre npm officiel et embarqué tel quel (362 Ko), exposant `window.ZXing`. Aucun décodeur DataMatrix n'a été écrit pour ce POC — conformément à l'exigence explicite du mandat. Le fichier passe de ~840 Ko à ~1,24 Mo.

Les 4 blocs passent individuellement `node --check` (voir section dédiée).

## Partie A — Scanner DataMatrix robuste (§1-23)

### Diagnostic du problème
Le constat terrain (BarcodeDetector natif absent sur de nombreux navigateurs Android/mobiles réels, dont celui testé) confirmait un défaut architectural : `checkCameraCapability()` en V3.6.1/V3.7 posait `cameraCapability.supported=false` dès que `typeof BarcodeDetector==='undefined'`, sans jamais tenter d'ouvrir la caméra par un autre chemin — la caméra devenait alors totalement inutilisable, malgré `getUserMedia` disponible.

### Solution
`StockCodeScanner` (conceptuel, pas une classe explicite pour rester dans le style du fichier) à 4 stratégies :
- **NATIVE_BARCODE_DETECTOR** : chemin historique, inchangé, préféré s'il gère `data_matrix`.
- **EMBEDDED_DATAMATRIX_DECODER** : nouveau — `decodeImageDataWithZXing(imageData)` construit un `Int32Array` ARGB depuis les pixels d'un canvas, l'enveloppe dans `ZXing.RGBLuminanceSource`/`HybridBinarizer`/`BinaryBitmap`, et décode via `ZXing.MultiFormatReader` avec les hints `POSSIBLE_FORMATS=[DATA_MATRIX,QR_CODE,EAN_13,CODE_128]` + `TRY_HARDER`. Tente aussi l'image inversée (contraste blanc-sur-noir fréquent en impression labo).
- **PHOTO_CAPTURE** : `handleScanPhotoFile(file)` — charge le fichier via `URL.createObjectURL`, le redimensionne sur un canvas (max 1600px de large) et le décode avec le même moteur.
- **HID_OR_MANUAL** : inchangé (textarea + douchette/clavier + `parseGS1Code`).

`checkCameraCapability()` réécrite : si `getUserMedia` absent → `supported=false` (aucun changement). Sinon, si `BarcodeDetector` absent → `supported=hasEmbedded` (**true** désormais, puisque ZXing est toujours embarqué) avec `strategy='EMBEDDED_DATAMATRIX_DECODER'`. Si `BarcodeDetector` présent, teste `getSupportedFormats()` comme avant, avec repli sur le décodeur embarqué si `data_matrix` non listé.

`startCameraScan()` : ouvre la caméra dès que `cameraUnavailableReason()` retourne `null` (c'est-à-dire dès que `getUserMedia` existe), **indépendamment de `BarcodeDetector`**. La boucle de détection bifurque selon `cameraCapability.strategy` : chemin natif inchangé (`BarcodeDetector.detect(video)`), ou extraction de frame (`grabVideoFrameImageData`) + décodage embarqué limité à ~3 tentatives/seconde (`decodeImageDataWithZXing` est coûteux — un throttle par timestamp `requestAnimationFrame` évite de saturer un smartphone d'entrée de gamme).

`getCameraDiagnostic()` — fonction testable exposée sur `window` (voir « Exposition cross-script ») retournant `{secureContext, protocol, mediaDevices, getUserMedia, barcodeDetector, supportedFormats, embeddedDecoder}`. `cameraUnavailableReason()` en dérive un message causal réel (jamais générique) : fichier `file://` non sécurisé, HTTPS requis, ou `mediaDevices` absent. `explainCameraError(err)` traduit le `DOMException` réel d'un `getUserMedia` refusé (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`, `SecurityError`).

L'invariant « `stopCameraScan()` toujours sûr, aucun flux ne reste actif » (établi en V3.6.1) est strictement conservé : fermeture panneau, annulation, détection réussie, navigation, erreur — tous les chemins l'appellent.

### UX simplifiée
`renderStockScanPanel()` réécrite pour l'écran initial : un bouton « Scanner avec la caméra » (visible dès que `getUserMedia` existe, quelle que soit la stratégie retenue) + un bouton « Prendre une photo » (toujours visible, `<input type=file accept=image/* capture=environment hidden>`) + une note expliquant la stratégie réellement active ou la cause d'indisponibilité — puis une section « Autres méthodes » avec la douchette/saisie manuelle, toujours présente. Le titre passe de « Scanner une réception » à « Scanner le produit » (mandat §9).

### Exposition cross-script
`getCameraDiagnostic`, `cameraUnavailableReason`, `checkCameraCapability`, `decodeImageDataWithZXing`, `startCameraScan`, `stopCameraScan` et un accesseur `getCameraCapabilitySnapshot()` sont explicitement exposés sur `window` depuis `installOverrides()` — même schéma déjà établi en V3.7 pour `articleLabel` etc. (les fonctions sont déclarées `function` à l'intérieur de l'IIFE et invisibles depuis un contexte externe comme `page.evaluate()`). Sans cette exposition, aucun test navigateur réel (caméra simulée, round-trip DataMatrix) n'aurait pu vérifier le comportement.

### Preuves réelles obtenues (pas seulement « le formulaire s'est ouvert »)
1. **Caméra live réelle** : Chromium lancé avec `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` (périphérique vidéo simulé, contournant l'absence de webcam réelle dans l'environnement CI) — `getUserMedia` retourne un **vrai** `MediaStream` (640×480, `track.readyState==='live'`), la boucle de décodage embarqué tourne réellement sur les frames pendant 700ms sans erreur, et à l'arrêt le `readyState` du track passe bien à `'ended'` (vérifié en interrogeant le MÊME objet `MediaStreamTrack` avant/après, dans un seul `page.evaluate`).
2. **Round-trip DataMatrix GS1 complet, via le vrai chemin utilisateur** : un code `(01)03453120000011(17)261231(10)LOT2601` est encodé avec `ZXing.DataMatrixWriter` (module ENCODEUR de la même bibliothèque, jamais utilisé en production, uniquement pour fabriquer une preuve de test), rendu sur un canvas avec quiet-zone et échelle réalistes, exporté en PNG réel sur disque, puis **uploadé via `page.setInputFiles()` sur le vrai `<input type=file>` caché du panneau** (déclenchant le vrai listener `change` → `handleScanPhotoFile`) : le GTIN et le lot décodés correspondent exactement à l'original, et l'écran passe correctement à « GTIN inconnu — associez ce code ».

## Partie B — Cohérence Accueil / Plan de charge (§13-20)

### Diagnostic
`buildOrderBook()` (V3.6-V3.7, inchangée dans son usage restant) construit `ORDER_BOOK` en mélangeant les échéances réelles des commandes actives ET un remplissage aléatoire (`seed` déterministe, `rnd()*0.3`) visant à simuler une capacité proche du seuil pour la vue en NOMBRE de commandes du Plan de charge. `weekForecast(i)` comptait dans ce carnet mixte — utilisé à la fois par « Charge à livrer » (compte) ET indirectement incohérent avec `weekBillableValue()` (déjà correctement dérivée des seules commandes réelles depuis V3.7), créant l'incohérence exacte décrite par le mandat (charge padded vs valeur réelle).

### Solution
`ordersDueInWeek(i, s=state)` — nouvelle fonction, SOURCE UNIQUE : commandes NON annulées dont `orderDueDateCanonical(o)` tombe dans la semaine `i`. `weekChargeToDeliver(i)=ordersDueInWeek(i).length` et `weekBillableValue(i)` (réécrite pour dériver de `ordersDueInWeek(i).reduce(...)` au lieu de refaire son propre filtre) dérivent désormais strictement de la même liste — invariant du mandat (§16) satisfait par construction, pas par convention.

`renderPlanning()` (ligne du tableau « Projection sur 8 semaines ») et `openPlanWeek()` (popup semaine) utilisent désormais `weekChargeToDeliver(i)` au lieu de `weekForecast(i)`. `openMonthCalendar()` bifurque explicitement : en mode réel (`calMode==='charge'`, ouvert depuis le bouton « 📅 Vue calendrier » du même bloc Projection), les compteurs journaliers du calendrier sont recalculés depuis les commandes réelles (`orderDueDateCanonical`) — plus jamais `ORDER_BOOK`. En mode simulateur (`calMode==='whatif'`), `ORDER_BOOK`/`weekForecast()` restent utilisés sans changement, car le mandat autorise explicitement le carnet synthétique dans le module What-If.

### Vérification
Scénario exact du mandat (§19-20) rejoué en test réel (moteur, état isolé puis restauré) : 5 commandes réelles 100/200/300/400/500€ dues la même semaine → `weekChargeToDeliver=5`, `weekBillableValue=1500€` ; annulation de la commande 500€ (`productionState='cancelled'`) → `weekChargeToDeliver=4`, `weekBillableValue=1000€`, immédiatement (aucune fonction supplémentaire à appeler, la dérivation est systématique à chaque lecture).

## Partie C — Page Stock (§21-24)

`renderSupplyStockTab()` : le tableau (`table`, classe renommée `stock-table-wrap` pour un ciblage CSS mobile sans toucher aux autres pages) est désormais encapsulé dans `<section class="card section">` avec un en-tête (`<h2>Articles en stock</h2>` + compteur). Sous 600px, une liste de cartes `.stock-cards`/`.stock-card` (masquée en desktop, visible via media query, symétrique du mécanisme déjà utilisé pour `.orders-cards` en V3.7) reprend Article/Référence/Fabricant/Disponibilité+badge/Utilisé pour/Statut/bouton « Voir » — réutilisant `data-stock-article` pour ouvrir la même fiche article que la ligne de tableau desktop (aucun nouveau handler). Le nom du fabricant (`manufacturerName(a.manufacturerId)`) était déjà correctement affiché dans le tableau desktop en V3.7 — vérifié et étendu identiquement aux nouvelles cartes.

## Partie D — Permissions en français (§25-28)

`PERMISSION_LABELS` (mapping code→libellé français) et `PERMISSION_GROUPS` (5 groupes : Commandes/Production/Stock & achats/Facturation/Administration) ajoutés en base script, juste après `roleLabel()`. `PERMISSIONS_LIST`, `ROLE_DEFS`, `ROLE_PERMISSIONS`, `defaultPermissionsForRole`, `can()`, `userPermissions()` restent **strictement inchangés** — seule la fonction de rendu `renderUserFormPanel()` change : la grille plate de cases à cocher (`${h(p)}` affichant le code brut) devient une liste de groupes, chaque case affichant `permissionLabel(code)` avec le code en `title=""` pour un diagnostic éventuel. La valeur du checkbox (`value="${h(code)}"`) reste le code technique — le formulaire soumet toujours les mêmes valeurs à `submitUserForm()`, inchangée.

## Partie E — Messages de démonstration (§29-31)

4 threads ajoutés dans `seedV8()`, chacun rattaché à une commande réellement créée par le seed (jamais un ancien `CMD-xxxx` legacy) :
- **Empreinte physique** (commande 1, Aline Rousseau, `impressionMode:'PHYSICAL'`, encore en attente) : le message du laboratoire évite délibérément de prétendre que la production a démarré (la commande est réellement encore en attente de réception) — reformulé par rapport à l'exemple littéral du mandat pour rester cohérent avec l'état réel de CETTE commande précise (§31).
- **Teinte** (commande 5, Sarah Ktari) : réutilise le blocage réel déjà présent dans le seed (`flags.blocked=true`, historyEvent « Validation teinte attendue », `shade:'A3.5'`) — le dialogue confirme littéralement la teinte déjà enregistrée, sans contradiction.
- **Suivi production** (commande 4, Damien Foucault, réellement scannée à Usinage) : le message du laboratoire indique « Usinage » (le poste réel du dernier scan), pas « Céramique » comme l'exemple littéral du mandat — adapté à l'état réel.
- **Reprise** (commande 14, Emma Vasseur, `createRework(reason:'Occlusion', restartStageId:'STG-004')` réellement appelé) : le dialogue reprend littéralement le motif « occlusion ».

Nouvelle fonction `msg(orderId, from, text, minsAgo)` dans `seedV8()`, même forme d'objet que `addMessage()`/`addCabinetMessage()` (`from/text/at/readAt/unread/files`), marquée lue (`unread:false`) pour ne pas afficher un badge « non lu » trompeur au premier démarrage.

## Partie F — KPI Réglé (§32-39)

`computeRevenueKPIs().paid` ne filtre plus `state.invoices` par `status==='PAID'` (un statut instantané, sans historique) mais somme `state.invoicePayments` (`reduce sur .amount`) — le VRAI registre append-only des règlements, déjà alimenté par `recordInvoicePayment()` depuis V3.7 mais jusqu'ici jamais relu pour le calcul du KPI lui-même.

`renderHome()` réintroduit la 4ᵉ carte de la ligne CA (« Réglé ») — la grille `.kpis` était déjà en `grid-template-columns:repeat(4,...)`, aucun ajustement CSS nécessaire. Contrairement aux 3 autres cartes CA (qui naviguent vers Factures via `data-view="invoices"`), celle-ci porte `data-open-paid-history` et ouvre `openPaidHistoryPopup()` — un popup léger (réutilise `#quick-layer`, même mécanisme que `openPlanWeek()`).

Nouvelles fonctions `paidAmountInWeek(offset)`/`paidAmountInMonth(offset)`, dérivées exclusivement de `state.invoicePayments` (`paidAt`) — jamais une 2ᵉ source. `renderPaidHistoryPopup()` affiche le résumé (cette semaine/semaine précédente/ce mois/mois précédent), des onglets Semaines (8 dernières)/Mois (12 derniers) commutables via `state.paidHistoryTab`, et un détail par ligne (`state.paidHistoryDetail`) listant Facture/Cabinet/Date paiement/Montant/Référence.

Comme le popup relit `state.invoicePayments` à chaque rendu (pas de cache), un nouveau pointage (`recordInvoicePayment()`) est immédiatement reflété — vérifié en conditions réelles (flux UI complet : Factures → Pointage → formulaire → soumission), le KPI Home et la ligne « Cette semaine » du popup changent sans reload.

## Partie G — Chevron Outils (§40-43)

`renderNav()` : le caractère `›` (span `.nav-tools-caret`) est remplacé par un SVG chevron 18×18 (`stroke-width:2.3`, arrondi). CSS : la boîte `.nav-tools-caret` passe à 32×32 (zone d'affichage généreuse, bien que le bouton entier `.nav-tools-toggle` soit déjà le vrai élément cliquable), couleur `var(--text-secondary)` au lieu de `var(--text-tertiary)`, et un léger fond au survol. La rotation à l'ouverture (`transform:rotate(90deg)` sur `.open`) est conservée telle quelle — seul le contenu de la balise change, pas le mécanisme. Comme `renderNav()` génère desktop et drawer mobile depuis la même fonction `navHTML(idPrefix)` (établi en V3.7), le changement s'applique identiquement aux deux sans duplication.

## Correctif de non-régression hors-périmètre (portail cabinet, 375px)

En étendant les tests responsive à 375px (nouveau viewport exigé par le mandat, jamais testé en V3.7), un débordement horizontal de 8px est apparu dans le portail cabinet (`.portal-tabs`, 3 boutons de largeur fixe). Vérifié comme **pré-existant en V3.7** (reproduit à l'identique sur `dentalflow-next-poc-v3.7.html`, aucune de mes modifications n'y touche) — corrigé par un `overflow-x:auto` sur la rangée d'onglets sous 600px (jamais un débordement de toute la page), cohérent avec le principe déjà appliqué aux tableaux Stock/Factures/Prestations.

## Fonctions exposées sur `window` (cumulatif V3.7 + V3.7.1)

`installOverrides()` expose désormais, en plus des 4 fonctions V3.7 (`articleLabel`, `consumedMaterialByArticle`, `returnableQtyForOrderArticle`, `orderHasReturnableMaterial`) : `getCameraDiagnostic`, `cameraUnavailableReason`, `checkCameraCapability`, `decodeImageDataWithZXing`, `startCameraScan`, `stopCameraScan`, `getCameraCapabilitySnapshot`. Toutes nécessaires pour que les tests navigateur réels (hors du contexte lexical de l'IIFE) puissent les appeler.

## Aucun changement sur

Le moteur stock/FEFO/retours par lot, le cycle de reprise, le module de facturation (hors source du KPI Réglé), la vue count-based du plan de charge, le simulateur What-If (hors branchement au carnet synthétique, resté intact), la navigation mobile P0, Production mobile, Commandes mobile, les thèmes, le schéma V8 et son seed (hors les 4 threads de messages ajoutés).
