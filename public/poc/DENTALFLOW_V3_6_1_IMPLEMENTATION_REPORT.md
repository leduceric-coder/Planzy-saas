# DentalFlow Next V3.6.1 — Rapport d'implémentation

Base : `dentalflow-next-poc-v3.6.html` (schéma V7, inchangé — ce hotfix ne nécessite pas de V8, tous les nouveaux champs sont optionnels et rétrocompatibles). Livrable : `dentalflow-next-poc-v3.6.1.html`.

Périmètre strictement limité aux 7 problèmes numérotés du mandat (traçabilité matière, retour, reprise, scan, facturation, recherche) — aucune fonctionnalité V3.6 n'a été retouchée en dehors de ce périmètre.

## A — Solde réel des lots (`lotAvailableQty`)

**Diagnostic.** `lotAvailableQty(lotId)` ne filtrait que les mouvements portant `m.lotId===lotId`. Or `consumeForScan()` (introduit en V3.6 pour la consommation FEFO déclenchée par un scan) écrit son allocation dans `m.lotAllocations[]` — jamais sur `m.lotId` du mouvement lui-même (un mouvement de consommation peut toucher plusieurs lots). Conséquence : un lot recevait +10, une consommation en prélevait -2 via FEFO, et `lotAvailableQty` continuait de renvoyer 10.

**Correction.** La fonction parcourt maintenant l'ensemble des `stockMovements` : pour un mouvement portant `lotAllocations`, chaque allocation concernant le lot est prise en compte en priorité (CONSUMPTION → contribution négative, RETURN et tout autre type → positive) ; pour un mouvement sans `lotAllocations`, on retombe sur `lotId` direct. Un mouvement ne peut jamais être compté deux fois (le chemin `lotAllocations` court-circuite explicitement la lecture de `lotId` pour ce même mouvement).

**Effet de bord corrigé** : `allocateLotsFEFO()` appelait déjà `lotAvailableQty()` en interne — le correctif y bénéficie automatiquement, aucune modification de `allocateLotsFEFO()` elle-même n'a été nécessaire. Un test dédié (N02) rejoue le scénario séquentiel exigé par le mandat : lot A (3, périme avant B) / lot B (10), consommation de 2 puis de 3, vérifie l'allocation exacte à chaque étape (A d'abord, puis A épuisé + B).

## B — Plafond de retour (`returnableQtyForOrderArticle`)

**Diagnostic.** `confirmCancelWithReturn()` ne s'appuyait que sur l'attribut `max` du champ HTML — un invariant purement côté vue, jamais vérifié par la fonction métier elle-même.

**Correction.** Trois fonctions canoniques : `totalConsumedForOrderArticle(orderId, articleId)` (somme des CONSUMPTION liées, tous cycles confondus), `totalReturnedForOrderArticle(orderId, articleId)` (somme des RETURN déjà émis pour cette commande/article), et `returnableQtyForOrderArticle = max(0, consommé − déjà retourné)`. `confirmCancelWithReturn()` valide **chaque ligne** contre ce plafond **avant toute mutation** ; au premier dépassement, l'opération entière est refusée (retour structuré `{success:false, reason:'RETURN_EXCEEDS_CONSUMED', articleId, requested, returnable}`), sans qu'aucun `StockMovement` ne soit créé pour aucune ligne (transactionnel — vérifié par un test qui envoie délibérément une quantité de 999 via un événement `submit` synthétique contournant la validation HTML : refus confirmé, stock physique inchangé, commande non annulée).

**Retours cumulés (double retour).** Comme le plafond se recalcule à chaque appel à partir des retours déjà enregistrés, appeler la fonction plusieurs fois sur la même commande reste toujours borné par le total réellement consommé — impossible de fabriquer du stock en rappelant la fonction. `cancelOrder()` reste par ailleurs idempotent (aucun second `ActivityEvent` « Commande annulée » si déjà annulée), sans empêcher un appel ultérieur de traiter un retour complémentaire légitime dans la limite du solde restant.

## C — Cycle de consommation (reprises)

**Diagnostic.** La clé d'idempotence `orderId::articleId::étape` empêchait toute nouvelle sortie de matière dès qu'une reprise repassait par la même étape que le cycle initial — la matière déjà « consommée une fois » bloquait le moteur, alors qu'une reprise consomme réellement à nouveau (nouvelle céramique, nouveau disque usiné…).

**Correction.**
- `activeReworkForOrder(order)` : reprise « active » = la plus récente avec `status==='open'` (aucune reprise ouverte → cycle `INITIAL`). Choix cohérent avec le modèle V3.6 existant, qui ne fournit aucun mécanisme de clôture explicite d'une reprise — une nouvelle reprise devient donc naturellement la reprise active suivante.
- `movementConsumptionCycle(m)` = `m.reworkId || m.consumptionCycleId || 'INITIAL'` — rétrocompatible avec tout mouvement V7 déjà persisté (jamais migré/réécrit en masse).
- Nouvelle clé : `orderId::articleId::étape::cycle`. `consumeForScan()` calcule le cycle actif à chaque appel et pose `consumptionCycleId` (+ `reworkId` si applicable) sur le mouvement créé.
- `knownDemand()`, qui reconstruisait indépendamment une clé de consommation pour savoir si un besoin BOM était déjà couvert, a été mise à jour en conséquence — sans cette correction, elle aurait cessé de retrouver toute consommation réelle (clé toujours désynchronisée) et gonflé le besoin projeté à tort.

**Comportement obtenu** (test séquentiel N06-N09, rejouant exactement le scénario imposé par le mandat : production initiale → livraison → reprise 1 → scan → reprise 2 → scan) : le cycle initial consomme une fois ; un double scan **dans la même reprise** reste strictement idempotent (aucune deuxième sortie) ; chaque **nouvelle** reprise au même stade déclenche une consommation légitime et distincte ; la consommation issue d'une reprise passe par le même chemin FEFO/`lotAllocations` que la consommation initiale (test N10). Vérifié à la fois au niveau moteur (tests internes) et en clics réels navigateur (Quick View → « Enregistrer une reprise » → scan réel).

## D — Scanner caméra DataMatrix

**Diagnostic.** V3.6 se contentait de vérifier `typeof BarcodeDetector!=='undefined'` sans jamais ouvrir de flux vidéo réel ni instancier de détecteur — le bouton, s'il avait existé, n'aurait rien fait.

**Correction — implémentation réelle, pas seulement une détection.**
- `checkCameraCapability()` : vérifie `BarcodeDetector` **et** `navigator.mediaDevices.getUserMedia`, puis interroge `BarcodeDetector.getSupportedFormats()` pour confirmer que `data_matrix` est effectivement supporté — pas seulement que l'API existe.
- Le bouton « Scanner avec la caméra » n'apparaît **que** si cette vérification complète est positive ; sinon un message explicite (« Lecture DataMatrix caméra non disponible sur ce navigateur ») s'affiche, et le repli douchette/saisie manuelle (déjà en place, fonctionne hors-ligne) reste la seule voie proposée — jamais de bouton qui prétendrait fonctionner sans l'être.
- `startCameraScan()` : ouvre la caméra via `getUserMedia({video:{facingMode:{ideal:'environment'}}})`, affiche un `<video>` en aperçu, instancie `BarcodeDetector` avec les formats réellement supportés (`data_matrix`/`qr_code`/`ean_13`/`code_128` filtrés par disponibilité réelle), boucle de détection via `requestAnimationFrame` (pas de sur-fréquence inutile). Un code détecté arrête la boucle, stoppe la caméra, alimente `parseGS1Code()` et rejoint le flux GS1 existant (identification article → quantité → confirmation), sans aucun chemin parallèle.
- **Fermeture garantie** : `stopCameraScan()` (idempotente, sûre à appeler sans capture en cours) coupe la boucle et appelle `track.stop()` sur toutes les pistes. Elle est appelée à chaque détection réussie, sur le bouton « Arrêter la caméra », et — point critique — `closeSidePanel()` elle-même a été enveloppée pour toujours l'appeler en premier, quel que soit le chemin de fermeture du panneau (croix, Annuler, touche Échap, ouverture d'un autre panneau) : aucun voyant caméra ne peut rester actif.
- Erreur de permission (`getUserMedia` refusé) → message compréhensible, le flux manuel/douchette reste immédiatement accessible, jamais de blocage total du workflow.
- Les objets navigateur non sérialisables (`MediaStream`, `BarcodeDetector`, le handle `requestAnimationFrame`) sont volontairement des **variables de module**, jamais posés dans `state` — `state` passe régulièrement par `cloneDeep(serializableState())` dans la suite de tests, qui ne doit jamais tenter de cloner un `MediaStream`. Seul `state.stockScanCameraActive` (booléen) trace l'état caméra dans `state`.

**Transparence sur les tests.** Le navigateur Chromium headless utilisé pour la suite de tests **ne supporte pas `BarcodeDetector`** (`typeof BarcodeDetector === 'undefined'`, confirmé explicitement). Conformément au mandat (§79) : **CAMERA DATAMATRIX NOT AVAILABLE IN TEST BROWSER**. Ce qui a été réellement vérifié dans cet environnement : (1) la détection de disponibilité est correcte et se conclut par `supported:false` ; (2) aucun bouton caméra fonctionnel n'apparaît dans l'UI (vérifié par un test qui ouvre réellement le panneau et inspecte le DOM) ; (3) `stopCameraScan()`/`startCameraScan()` restent sûrs à appeler dans cet état (aucune exception, aucun flux ne peut rester actif) ; (4) le flux manuel (douchette/collage + `parseGS1Code()`) fonctionne intégralement de bout en bout, en clics réels. L'ouverture effective d'un flux vidéo et la détection sur un vrai flux caméra n'ont **pas** pu être exercées dans cet environnement — ce n'est jamais présenté comme « scan caméra validé », uniquement comme code écrit et prêt, avec repli vérifié.

## E/F — DRAFT économique vs. éligibilité facture, garde-fous `createInvoice()`

**Deux notions désormais explicitement distinctes.**
- `isOrderAvailableForNewInvoice(orderId)` (éligibilité à une **nouvelle** facture) : `false` dès qu'une commande figure dans **une** facture non annulée, DRAFT compris — empêche toute double-sélection.
- `computeRevenueKPIs()` (statut **économique** pour le CA) : une commande sur une facture encore DRAFT reste comptée dans « À facturer » ; elle ne bascule vers « Facturé » qu'à l'**émission** (`ISSUED`). Une facture `CANCELLED` libère à nouveau la commande pour une nouvelle facture (testé explicitement, N15-N17).

**`createInvoice()`** vérifie désormais elle-même, ligne par ligne : existence de la commande, non-annulation, livraison effective (`isOrderCompleted`), non-double-facturation (`isOrderAvailableForNewInvoice`), puis l'unicité du cabinet sur l'ensemble de la sélection. Tout refus retourne `{success:false, reason}` sans créer d'`Invoice` ; le point d'appel UI (`#create-invoice-btn`) a été adapté à cette nouvelle forme de retour (`{success, invoiceId}` en cas de réussite).

## G — Date de facture figée

`invoiceDisplayDate(inv)` = `inv.issuedAt || inv.createdAt`. `printInvoice()` l'utilise systématiquement à la place de `Clock.now()` — vérifié par un test qui émet une facture à une date figée puis avance l'horloge de 18 jours avant de réimprimer : la date affichée reste strictement celle de l'émission.

## H — Recherche patient harmonisée

`orderSearchText(order)` (script de base, sans dépendance IIFE) agrège `id`, `patientRef`, `displayPatient(order,'lab')` (jamais le nom brut — respecte l'anonymisation), `type`, `cabinet`, `dentistNameById(dentistId)`, `shade`, `teeth`. `matchesOrderSearch(order, query)` l'utilise pour un test d'inclusion insensible à la casse. `filteredOrders()` (tableau Commandes) et `searchResults()` (recherche globale) appellent désormais toutes deux ce même helper — plus aucune divergence possible entre les deux. Testé en clics réels (saisie dans le champ de recherche du tableau **et** dans la barre globale) et au niveau moteur (commande anonymisée introuvable par le nom réel dans les deux, trouvable par `patientRef` dans les deux).

## Points de vigilance documentés

- La caméra DataMatrix est implémentée mais non exercée en conditions réelles faute de support navigateur dans l'environnement de test — voir Partie D.
- `activeReworkForOrder()` retient la reprise « la plus récente encore ouverte » faute de mécanisme de clôture de reprise dans le modèle V3.6 existant ; ce choix n'a pas été étendu (aucune fonctionnalité de clôture n'a été ajoutée, hors périmètre du hotfix).
