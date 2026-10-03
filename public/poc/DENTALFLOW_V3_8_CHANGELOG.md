# DentalFlow Next V3.8 — Changelog

Base : `dentalflow-next-poc-v3.7.1.html` (166/166 PASS). Livrable : `dentalflow-next-poc-v3.8.html`. V3.7.1 n'a jamais été modifié.

Schéma : V8 → **V9** (migration déterministe et idempotente `migrateV8toV9()`, jamais destructive sur un état déjà persisté).

## Nouveaux concepts d'état (V9)

- `state.locationEvents` — `{id, orderId, stageId, source: SYSTEM|SCAN|MANUAL, actorId, actorName, at, note, reworkId}` : source canonique unique de la localisation d'une commande (remplace l'ancien "dernier scan" comme seule vérité).
- `state.notifications` — `{id, target: LAB|CABINET, type: NEW_ORDER|NEW_MESSAGE, entityType, entityId, createdAt, readAt, title, message}`.
- `state.conversations` — `{id, cabinetId, subject, orderIds: [], createdAt, createdBy, closedAt, migratedFromOrderId}`.
- `state.conversationMessages` — `{id, conversationId, authorType, authorId, authorName, text, files, at, labReadAt, cabinetReadAt}`.
- `order.createdAt`, `order.deliveredAt`, `order.cancelledAt` — champs réels désormais posés par le moteur (créaient auparavant une dépendance implicite à `historyEvents`).

## Partie A — Schéma V9 + migration

- `V34_SCHEMA_VERSION` 8 → 9.
- `migrateV8toV9(s)` : backfill `scannable` sur les postes déjà persistés, backfill `locationEvents` depuis les `scanEvents`/`trackingSheetFirstPrintedAt` existants, migration `state.messages[orderId]` → conversations (idempotente via `migratedFromOrderId`), backfill `createdAt/deliveredAt/cancelledAt`.
- **Correctif critique découvert et corrigé pendant cette partie** : `load()` figeait `schemaVersion` à `6` en dur (au lieu de la valeur réellement persistée) et ne restaurait pas `dentists/services/stockLots/invoices/manufacturers/serviceMaterials/invoicePayments/currentUserId/locationEvents/notifications/conversations/conversationMessages` depuis le JSON persisté — un état réellement sauvegardé perdait silencieusement invoices/lots/notifications/conversations à **chaque** rechargement de page, et les migrations se rejouaient inutilement à chaque démarrage. Corrigé : `load()` restaure désormais exactement le même jeu de champs que `serializableState()` écrit, avec le vrai `schemaVersion` persisté.
- `serializableState()` complétée (elle omettait déjà `locationEvents/notifications/conversations/conversationMessages`, cassant l'isolation des tests dès qu'un test touchait ces stores).

## Partie B/C — Localisation canonique + moteur unique

- `getLastLocationEvent(orderId)` / `getCurrentOrderStage(orderId)` : dérivent la localisation confirmée depuis `locationEvents`, avec repli sur l'ancienne dérivation par `scanEvents` pour toute commande n'ayant encore aucun `LocationEvent` (fixtures/tests V3.7 inchangés, données pré-V9).
- `moveOrderToStage(orderId, stageId, {source, actorId, actorName, at, note})` : **moteur unique** pour tout changement de localisation (scan réel, déplacement manuel, système au 1er impression). Vérifie commande/étape/annulation, vérifie les droits (`production.scan` / `production.manage`), refuse tout scan à Réception (`STAGE_NOT_SCANNABLE`), crée le `LocationEvent`, délègue au `recordScan()` existant pour la branche SCAN (jamais dupliqué), réplique la même séquence consommation/save pour MANUAL/SYSTEM.
- `stageDefinitions[].scannable` (Réception = `false`) — un scan à Réception est refusé avec le message exact attendu : « Aucun scan n'est nécessaire à la réception. Le suivi démarre lors de l'impression du bon. »
- `printTrackingSheet()` : au premier impression, appelle désormais `moveOrderToStage(id,'STG-001',{source:'SYSTEM'})` — le bon imprimé démarre réellement le suivi et localise Réception.
- Scan réel (staff + « DentalFlow Scan ») et déplacement manuel (drag & drop + « Changer la localisation ») routés à travers ce même moteur.

## Partie D — Drag & drop + mobile

- Production desktop : cartes commande draggables (`draggable`, gardé par `production.manage`), drop sur une autre colonne → `moveOrderToStage(...,{source:'MANUAL'})`.
- Fiche commande (desktop + mobile) : bouton « Changer la localisation » → sélecteur de poste + confirmation, même moteur, même garde de droits.

## Partie E — Traçabilité réécrite

- `orderTimeline()` entièrement réécrite : sources canoniques uniquement (`createdAt`, `physicalImpressionReceivedAt`, `trackingSheetFirstPrintedAt`, `locationEvents`, `productionCompletedAt`, `reworks`, `deliveredAt`, `cancelledAt`) — **plus jamais `historyEvents` comme 2e vérité**. Repli sur `scanEvents` pour les commandes sans `LocationEvent` (données pré-V9).
- « Commande prête » → **« Prête à livrer »** partout.
- Nouveau fait distinct : **« Livrée »** (`deliveredAt`), désormais séparé de « Prête à livrer » (`productionCompletedAt`) — deux événements réels, jamais confondus.
- Nouvelle action `markOrderDelivered(orderId)` (+ bouton « Marquer comme livrée », gardé par `production.manage`) — aucune commande ne devient « Livrée » automatiquement.
- Aucun « Scan Réception » ne peut plus apparaître dans une timeline produite par le nouveau moteur.

## Partie F — Annulation / Stock

- **Une matière travaillée ne retourne pas en stock** : `openCancelFlow()` annule directement dans tous les cas (consommé ou non) — le panneau de restitution (« Restituer au stock », `openReturnMoreFlow`) n'est plus jamais atteignable depuis le flux d'annulation.
- `cancelOrder()` reste sans effet sur le stock physique (inchangé depuis V3.6) ; `confirmCancelWithReturn()`/`openReturnMoreFlow()` restent définies (compatibilité des tests moteur existants) mais ne sont plus câblées à aucun bouton.
- Aucune régression sur l'historique : les `StockMovement` RETURN déjà persistés avant V3.8 ne sont jamais supprimés par la migration.

## Partie G — Portail dentiste, bug empreinte physique (correctif terrain)

- Cause : un même sélecteur CSS (`.deliv-opt`) partagé entre les options de livraison et les options d'empreinte, avec un handler qui réinitialisait tout le formulaire (`renderDentistMode()`) au clic sur « Physique ».
- Correctif : attributs distincts `data-impression-mode="DIGITAL"/"PHYSICAL"`, le handler générique ignore désormais ces éléments. Le formulaire ne perd plus aucune valeur saisie en basculant Numérique ↔ Physique.

## Partie H/I — Identification automatique + notifications

- Compte représentant **un seul praticien** (cabinet individuel) : dentistId dérivé automatiquement, aucun sélecteur « Professionnel »/« Praticien concerné » affiché.
- Compte **groupé** (plusieurs praticiens, ex. Cabinet Moderne) : sélecteur « Praticien concerné » affiché.
- Toute commande `source=CABINET` crée une `Notification{target:LAB, type:NEW_ORDER}` ; badge « Commandes » = compte de notifications non lues ; tag « NOUVEAU » sur la ligne tant que la fiche n'a pas été ouverte ; ouverture de la fiche marque lu et décrémente le badge immédiatement.

## Partie J/K — Messagerie (conversations) + portail simplifié

- Abandon de `state.messages[orderId]` comme seul modèle. Nouveau modèle `conversations`/`conversationMessages` : 0 commande (« Question générale »), 1 ou plusieurs commandes (association multiple, uniquement des commandes du **même** cabinet — isolation stricte imposée au niveau moteur par `createConversation()`).
- Portail dentiste : onglet **Messages** (badge non lus), bouton « Nouveau message » (Sujet / Associer à commande(s) / Message / Pièces jointes).
- Labo : panneau Messages reconstruit en liste de conversations (Cabinet / Sujet / tags `[CMD-xxxx]` / dernier message / non lus).
- Fiche commande : bouton « Messages » résout désormais la/les conversation(s) liées (« Messages liés »).
- Nouveau message cabinet → notification `NEW_MESSAGE` target LAB ; réponse labo → notification `NEW_MESSAGE` target CABINET.
- Migration idempotente `state.messages[orderId]` → conversations, appliquée aussi bien à un état déjà persisté qu'au premier démarrage.

## Partie L/M — Vocabulaire + Seed V9

- Nouvelle fonction `seedV9Orders()` : conserve intégralement les catalogues `seedV8()` (dentistes, prestations, stock, fournisseurs, factures, droits) mais remplace la liste de commandes de démonstration par **12 scénarios A→L** explicitement demandés, construits uniquement via le moteur réel (`moveOrderToStage`, `createConversation`…), avec une chronologie strictement croissante par commande.
- **Correctif découvert pendant cette partie** : `seedV8()` construisait encore ses propres commandes/scans/consommations avant d'être remplacées — sans nettoyage, les `StockMovement` CONSUMPTION/RETURN de ces commandes discarded restaient orphelins et pouvaient entrer en collision avec les nouveaux identifiants réattribués depuis le même compteur. `seedV9Orders()` filtre désormais ces mouvements orphelins (`sourceType==='scan'|'cancelledOrder'`) tout en préservant OPENING/RECEIPT/ADJUSTMENT.

## Partie N — Scan photo robuste

- Après toute photo prise/sélectionnée : écran **« Cadrez le code »** (image affichée + cadre déplaçable/redimensionnable au doigt ou à la souris, événements `pointer` uniformes) — plus de tentative de décodage sur la photo entière.
- Sur la seule zone recadrée : **décodage multi-passes** — rotations 0°/90°/180°/270°, variantes originale/niveaux de gris/contraste renforcé/inversion N&B, échelles 1x/2x/3x (jusqu'à 48 tentatives, arrêt au premier succès). Toujours le même décodeur ZXing embarqué — **aucun OCR**.
- Échec après recadrage : message dédié « Code non détecté. Rapprochez-vous du DataMatrix, évitez les reflets et recadrez le code. » + « Reprendre une photo » / saisie manuelle toujours disponible.
- **Correctif découvert pendant cette partie** : l'URL blob de la photo était révoquée immédiatement après chargement, cassant l'affichage de l'aperçu dans l'écran de recadrage. Corrigée : révocation différée à la fermeture de l'écran de recadrage.

## PWA/UX — 3 modes distincts (vérifié, non modifié)

- Vérification réelle (navigateur) que la séparation déjà en place depuis V3.3 satisfait les exigences V3.8 : Collaborateur/Staff sans sidebar labo à 390×844 et 360×800 ; Labo desktop avec sidebar complète à 1440×900 ; Portail dentiste sans bouton « Installer DentalFlow » à 1440×900. Aucune régression, aucun changement de code nécessaire — voir `DENTALFLOW_V3_8_SAAS_MAPPING.md` pour la préparation manifeste/service worker future (documentation uniquement, aucune implémentation PWA réelle en V3.8).

## Non-régression

Toutes les fonctionnalités V3.7.1 sont conservées inchangées (Accueil, KPI Réglé, Stock, Achats, lots/FEFO, DataMatrix caméra live, articles/prestations/fabricants, factures, pointage, droits français, navigation mobile, responsive, thèmes, import/export). 166 tests V3.7.1 strictement conservés, jamais affaiblis.
