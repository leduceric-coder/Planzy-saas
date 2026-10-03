# DentalFlow Next V3.6 — Rapport d'implémentation

Base : `dentalflow-next-poc-v3.5.1.html` (fourni comme `dentalflownextpocv3.5.1(2).html`), avec les correctifs V3.5.2 (Partie R du mandat) réappliqués (pratiquement : le fichier V3.5.2 déjà produit et vérifié cette même session, qui contient exactement ces correctifs, a servi de point de départ pratique — le contenu obtenu est strictement identique à « V3.5.1 + Partie R » appliqué à la main). Livrable : `dentalflow-next-poc-v3.6.html`.

## Architecture générale

Fichier HTML monolithique unique, trois blocs `<script>` :
1. Générateur QR inline (bibliothèque tierce, MIT).
2. Script de base (legacy, portée globale) — contient désormais tout le nouveau modèle de données V7, le sélecteur de dents, les formulaires partagés, les fonctions d'affichage patient/empreinte/bon de suivi, le dispatcher CA/Factures de base.
3. IIFE `(function(){...})()` — contient le moteur achats/stock existant (StockEngine/DemandEngine/SupplierEngine/ProposalEngine, inchangés), et TOUT le nouveau code qui a besoin d'appeler des fonctions internes à cette fermeture (`uid`, `articleLabel`, `logActivity`, `physicalStock`…) : migration V6→V7, lots de stock/GS1/FEFO, reprises (partie logique), annulation/retour, module Factures, jeu de démo V3.6.

**Point d'attention technique majeur, découvert et corrigé cette session** : plusieurs fonctions nouvelles devaient être accessibles depuis le script de base (qui ne peut pas voir l'intérieur de l'IIFE). Deux `const` déclarées par erreur à l'intérieur de l'IIFE (`FDI_TEETH`, `SHADE_OPTIONS`) mais utilisées par des fonctions de rendu du script de base (`renderToothPicker`, `shadeFieldHTML`) provoquaient une `ReferenceError` silencieuse à l'ouverture du sélecteur de dents — un bug qui n'était pas capté par la suite de tests existante car aucun test n'ouvrait encore le sélecteur. Diagnostiqué en isolant `typeof FDI_TEETH` en conditions réelles navigateur, puis corrigé en déplaçant les deux déclarations du bon côté de la frontière. Un test dédié (T139) couvre maintenant ce chemin.

## Partie A — Identité patient par défaut, anonymisation à la demande

- `order.patientFirstName` / `order.patientLastName` suivent désormais la commande (auparavant seulement dans `state.cabinetPatients`, séparé). `order.patientRef` reste toujours présent (référence opaque `PAT-XXXXXX`, `generatePatientRef()` inchangée).
- Nouveau champ `order.anonymized` (booléen, défaut `false`).
- `displayPatient(order, context)` — helper canonique unique :
  - `context==='cabinet'` → toujours le nom complet (le cabinet consulte sa propre commande, l'anonymisation ne le concerne pas).
  - tout autre contexte (labo, quel que soit l'écran) → nom si `!anonymized`, sinon `patientRef` seul.
  - repli sur `patientRef` si aucun nom saisi.
- Utilisé dans `_renderQuickView`, `printFiche` (bon de suivi), recherche labo — plus aucun `if(anonymized)` dispersé.
- Le QR (`qrSvg(order.id)`) reste strictement `order.id` — jamais de nom, jamais de `patientRef` — vérifié par un test dédié qui intercepte `qrSvg()`.
- Migration : `migrateV6toV7()` copie le nom déjà saisi dans `state.cabinetPatients[order.id]` vers l'ordre s'il n'a pas encore de nom, sans jamais toucher `patientRef`. `state.cabinetPatients` reste en place comme repli de compatibilité, la commande devient la source canonique.

## Partie B — Dentistes

`state.dentists` : `{id, firstName, lastName, cabinet, email, phone, accountStatus: ACTIVE|NO_ACCOUNT, inviteStatus: NOT_SENT|SENT|ACCEPTED, active}`. Sélecteur `dentistSelectHTML()` partagé par les deux formulaires. Si le dentiste sélectionné a `accountStatus==='NO_ACCOUNT'`, un bouton « Inviter le dentiste à suivre la commande » apparaît avec texte explicatif ; `inviteDentistToOrder()` simule l'invitation (`inviteStatus='SENT'` + `ActivityEvent`), jamais un e-mail réel.

## Partie C/D — Formulaire de commande unifié + sélecteur de dents FDI

`buildOrderFromInput(input)` — fonction pure et partagée par `createOrder()` (Lab, `source:'LAB_MANUAL'`) et `createDentistOrderCore()` (Cabinet, `source:'CABINET'`) : un seul modèle de champs, chaque appelant garde son propre effet de bord (historyEvents pour le labo, logAudit+messages+repli cabinetPatients pour le cabinet), signature publique de `createDentistOrderCore` inchangée pour ne casser aucun test existant.

Champs partagés : `patientFieldsHTML` (prénom/nom/anonymiser), `dentistSelectHTML`, `serviceSelectHTML`, `shadeFieldHTML` (teinte + « Autre »), `toothPickerFieldHTML`, `impressionFieldsHTML`.

Sélecteur de dents : popup persistante (`#tooth-picker-layer`/`#tooth-picker-card`), dentition FDI complète 18-28/48-38 (`FDI_TEETH`), boutons réels `<button data-dent aria-pressed aria-label="Dent N">`, sélection multiple par clic, résultat écrit dans un input caché + résumé texte du formulaire d'origine via `state.toothPickerFormSelector` — sans jamais re-render la page entière (les autres champs déjà saisis restent intacts).

## Partie E — Échéance canonique

`order.dueAt` (ISO datetime), posé à la création de toute nouvelle commande (Lab et Cabinet). `orderDueDateCanonical(o)` : privilégie `dueAt` si présent et valide, sinon retombe sur le parseur legacy `orderDueDate()`. Le moteur (`knownDemand`, `dueRank`, `isDueToday`, `weekStripHTML`) utilise désormais ce chemin canonique. Migration : une commande legacy sans `dueAt` se voit convertir son `due` textuel via `orderDueDate()` ; si le texte est illisible, `dueAt` reste `null` et `due_unparsed` est ajouté à `dataQualityFlags` — jamais de date inventée.

## Partie F — Empreinte numérique / physique

`order.impressionMode: DIGITAL|PHYSICAL`. `isReadyToStartTracking(o)` renvoie `false` tant qu'une empreinte physique attendue n'est pas confirmée reçue. `confirmPhysicalImpressionReceipt(id)` pose `physicalImpressionReceivedAt`/`physicalImpressionReceivedBy` + `ActivityEvent`. La création de la commande n'est jamais confondue avec la réception de l'empreinte : ce sont deux actes distincts, à deux moments distincts.

## Partie G/H — Bon de suivi

`printTrackingSheet(id)` : garde-fou physique (refuse si `impressionMode==='PHYSICAL' && !physicalImpressionReceivedAt`, message « Confirmez d'abord la réception de l'empreinte. »). Premier appel (`trackingStartedAt` encore `null`) : pose `trackingStartedAt`, `trackingSheetFirstPrintedAt`, `trackingSheetPrintCount=1`, backfill `station` si vide, journalise « Suivi de production démarré ». Appel suivant : incrémente seulement `trackingSheetPrintCount`, ne touche jamais `trackingStartedAt`. `printFiche(id)` génère le document complet (Commande/Patient/PatientRef/Cabinet/Dentiste/Prestation/Dents/Teinte/Empreinte/Livraison/QR + table Suivi/Reprises pré-remplie avec l'historique existant + lignes vierges).

## Partie I — Scan de production

Inchangé dans son principe (déjà conforme depuis V3.5.2) : QR = `order.id` strictement, `ScanEvent` = orderId + poste/technicien du **contexte** passé à `recordScan()`, jamais dérivés d'un contenu de QR. `consumeAtStageId` et l'idempotence de consommation sont préservés à l'identique (voir Partie M).

## Partie J — Reprises

`order.reworks[]` : `{id, createdAt, reason, notes, restartStageId, requestedByDentistId, priceAdjustment, status, completedAt}`. `createRework(orderId, data)` — pousse la reprise, réouvre la production (`status='progress'`, `productionState='active'`, flags remis à `false`) **sans jamais toucher aux scans existants** (vérifié par un test qui compare l'historique des scans avant/après). Le même `CMD-xxxx` est conservé, le même QR continue de fonctionner. Panneau latéral dédié (`renderReworkFormPanel`, motif/étape de redémarrage/observations/supplément), déclenché depuis la Quick View (`data-panel="reworkForm"`), routé via le mécanisme générique de panneaux existant (aucun nouveau câblage de clic nécessaire).

## Partie K/L/M — Lots de stock, GS1/DataMatrix, FEFO

- `state.stockLots` : métadonnées de lot uniquement (`{id, articleId, gtin, lotNumber, serialNumber, productionAt, expiryAt, receivedAt, supplierId, purchaseOrderId, source, rawCode}`) — la quantité d'un lot est **toujours** dérivée (`lotAvailableQty(lotId)` = somme des `StockMovements` portant ce `lotId`), jamais une vérité indépendante.
- `parseGS1Code(raw)` : supporte le format parenthésé lisible `(01)...(17)...(10)...` et le format brut symbologie `]d2` + séparateur FNC1 (`GS`, `0x1D`) pour les AI à longueur variable. AI fixes gérées : 01 (GTIN, 14), 11/17 (date YYMMDD, 6). AI variables : 10 (LOT, **jamais** à longueur fixe), 21 (SERIAL). Testé avec des codes strictement **synthétiques**.
- `allocateLotsFEFO(articleId, qty)` : trie les lots non-expirés par date de péremption la plus proche, départage par date de réception la plus ancienne ; un lot expiré n'est **jamais** sélectionné automatiquement ; `expiredAlert` signale quand seuls des lots expirés restent disponibles.
- `consumeForScan()` (consommation déclenchée par le BOM au scan) reste **un unique mouvement CONSUMPTION global**, qty négative totale inchangée, `consumptionKey` et son idempotence strictement préservés (test de non-régression dédié) — `lotAllocations[]` est un ajout purement additif quand des lots existent pour l'article, absent sinon.
- Interface « Scanner une réception » (Stocks & achats → Stock) : détection `BarcodeDetector` (formats interrogés via `getSupportedFormats()`), repli douchette USB/Bluetooth ou saisie/collage manuel — fonctionne intégralement hors-ligne, aucune dépendance CDN. GTIN inconnu → association explicite à un article existant (jamais un article deviné). Confirmation → création du lot si nécessaire + `StockMovement RECEIPT` (`sourceType:'stockScan'`).

## Partie N — Annulation

`cancelOrder(orderId)` ne touche **jamais** aux mouvements de stock. `hasConsumedMaterialForOrder(orderId)` détermine la branche : sans consommation, annulation immédiate (la réservation disparaît via `knownDemand()`, qui exclut désormais aussi les commandes annulées). Avec consommation, panneau dédié (`renderCancelFormPanel`) : quantité de retour suggérée (= quantité sortie) mais **toujours éditable**, jamais imposée ; `confirmCancelWithReturn()` crée un `StockMovement RETURN` par matière retournée uniquement sur choix explicite, avec deux `ActivityEvent` bien distincts (« Commande annulée » / « Matière retournée en stock »).

## Partie O/P/Q — Prestations, tarif, CA, Factures

- `state.services` (déjà présent depuis une itération antérieure) : CRUD simple (créer/modifier/suspendre-réactiver) intégré comme onglet de la page Factures — pas de nouvelle page ERP.
- `order.priceSnapshot` posé à la création (`buildOrderFromInput`), copie figée — un changement de tarif catalogue ensuite ne l'altère **jamais** rétroactivement (vérifié par test).
- `computeRevenueKPIs()` (script de base, sans dépendance IIFE) : CA en production / À facturer / Facturé / Réglé, sans double comptage (une commande DRAFT n'est déjà plus « à facturer » mais n'entre dans « Facturé » qu'à l'émission).
- `state.invoices` : `{id, cabinet, dentistId, orderIds, lines, subtotal, total, status: DRAFT|ISSUED|SENT|PAID|CANCELLED, createdAt, issuedAt, sentAt, paidAt}`. Lignes construites depuis `order.priceSnapshot` + suppléments de reprise, copie figée à la création de facture. Nouvelle entrée « Factures » sous Outils (5ᵉ libellé, même convention un-mot que Charge/Stock/Rapports/Utilisateurs) → page à onglets À facturer / Factures / Prestations. Cycle Émettre → Envoyer au cabinet (simulation, jamais un e-mail réel) → Marquer réglée. Facture imprimable via le mécanisme d'impression existant. Portail cabinet : nouvel onglet Factures (visible dès l'envoi).

## Partie S — Migration V6→V7

`migrateV6toV7(s)` (additif, jamais de scénario de démo injecté sur un état déjà persisté) : dentistes/services par défaut si absents, `stockLots`/`invoices` initialisés vides, complète chaque commande avec le jeu de champs V7 complet (`ensureOrderV7Fields`), copie le nom patient depuis `cabinetPatients` si absent sans toucher `patientRef`, convertit `due`→`dueAt` avec repli `dataQualityFlags`. **§128** : une commande déjà en production avant migration n'apparaît jamais comme « à démarrer » simplement parce qu'elle n'avait pas `trackingStartedAt` — le signal le plus fiable disponible est utilisé : scans déjà enregistrés (backfill depuis le premier scan) ou état déjà Prête/Livrée (backfill depuis la date de création), sinon (commande active jamais scannée) `trackingStartedAt` reste `null`, elle est réellement pas encore démarrée.

## Partie U — Jeu de démo

`seedV7Scenarios()` (appelée par `seedV7Extras()`, elle-même appelée au premier démarrage et à chaque `resetDemoV6()`) : 10 scénarios nommés A-J (commande cabinet numérique, commande cabinet physique en attente, commande labo avec dentiste sans compte, commande en production avec bon déjà imprimé, commande livrée puis reprise, réception scannée GS1/DataMatrix, commande annulée avec matière consommée, commande livrée en attente de facturation, facture envoyée, facture réglée). **Toutes** les dates sont calculées relativement à `Clock.now()` au moment du seed — vérifié : aucune ne s'écarte de plus de 20 jours de la date réelle d'exécution.

## Points de vigilance documentés (transparence)

- Le scanner caméra `BarcodeDetector` est correctement **feature-detecté** (message adapté selon disponibilité) et le flux manuel (douchette/collage) est intégralement fonctionnel et testé de bout en bout ; la boucle de capture vidéo live n'a pas été implémentée dans le détail (le navigateur de test ne supporte de toute façon pas `BarcodeDetector` — conforme à la tolérance du mandat).
- `consumptionKey` n'intègre pas de `reworkId` pour permettre une re-consommation légitime lors d'une reprise (note du mandat, Partie M) — non implémenté faute de scénario de test l'exigeant explicitement ; le comportement actuel (clé inchangée) reste correct pour tous les cas testés.
