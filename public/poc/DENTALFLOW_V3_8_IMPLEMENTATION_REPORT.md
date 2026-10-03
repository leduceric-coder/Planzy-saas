# DentalFlow Next V3.8 — Rapport d'implémentation

**PRE-SAAS FUNCTIONAL FREEZE** — dernière version POC locale avant migration Supabase/Vercel.

Base : `dentalflow-next-poc-v3.7.1.html`. Livrable : `dentalflow-next-poc-v3.8.html`. V3.7.1 n'a jamais été écrasé.

## Philosophie appliquée

> La commande est l'objet central. La localisation est un événement. Le scan est une manière de changer la localisation, pas la seule. L'impression du bon démarre le suivi. La réception ne nécessite pas de scan. Une matière travaillée ne retourne pas en stock. La traçabilité doit raconter une histoire chronologique compréhensible.

Ces six principes ont guidé chaque décision d'architecture ci-dessous — en particulier l'introduction de `locationEvents` comme source canonique unique (Partie B/C) et la suppression complète de la restitution automatique de matière consommée (Partie F).

## Architecture générale (inchangée depuis V3.4)

Fichier HTML monolithique unique, 4 blocs `<script>` :
1. Générateur QR inline.
2. ZXing-js 0.23.0 embarqué (`window.ZXing`).
3. Script de base — portée globale non stricte, `function` déclarées deviennent des propriétés `window`.
4. `<script id="dentalflow-v34-implementation">` — IIFE `'use strict'` privée ; toute fonction qu'elle expose au script de base doit être assignée explicitement sur `window` dans `installOverrides()`.

Ce piège de frontière (une fonction IIFE-privée appelée par erreur par identifiant nu depuis le script de base lève une `ReferenceError`) s'est reproduit plusieurs fois pendant cette mission (`uid`, `runMultiPassDecode`, `markOrderDelivered`) et a chaque fois été corrigé par exposition explicite — jamais par un contournement structurel.

## Partie A — Schéma V9

`ensureV34Model()` reste le point d'entrée unique de migration : `if(!persistedV7){ if(fresh) seedV8()+seedV9Orders() ; else migrateV6toV7()+migrateV8toV9() }`. Le principe déjà établi en V3.6/V3.7 (additif, jamais destructif, jamais rejoué sur un état déjà à jour) est conservé et **renforcé** par le correctif `load()` décrit ci-dessous.

### Bug pré-existant découvert et corrigé : perte de données au rechargement

En vérifiant la persistance des nouvelles notifications à travers un rechargement de page réel (navigateur, pas seulement en mémoire), il est apparu que `load()` :
1. Figeait `state.schemaVersion` à `6` en dur après tout chargement d'un état ≥ schéma 6, **quel que soit le schéma réellement persisté**.
2. Ne restaurait dans `state` qu'un sous-ensemble des champs réellement écrits par `serializableState()`/`v34Save()` — `dentists`, `services`, `stockLots`, `invoices`, `manufacturers`, `serviceMaterials`, `invoicePayments`, `currentUserId` en étaient absents depuis leur introduction en V3.6, et `locationEvents`/`notifications`/`conversations`/`conversationMessages` (V3.8) auraient hérité du même défaut.

Conséquence : `ensureV34Model().persistedV7` était **systématiquement faux** après un `load()` (schéma toujours vu comme `6`), donc `migrateV6toV7()` se rejouait à chaque démarrage. Cette fonction contient un repli « si vide, réensemencer depuis DEMO_DENTISTS/DEMO_SERVICES » qui masquait complètement le problème pour `dentists`/`services` (ils semblaient "survivre" au rechargement, alors qu'ils étaient en réalité réinitialisés à l'identique à chaque fois — toute modification utilisateur aurait été perdue). Pour `invoices`/`stockLots`, qui n'ont pas de repli de réensemencement, la perte était visible et mesurée : `{invoices:3, stockLots:1}` → `{invoices:0, stockLots:0}` après un simple rechargement.

Correctif : `load()` restaure désormais exactement le même jeu de champs que `serializableState()` écrit, avec `schemaVersion: Number(s.schemaVersion)||6` (la vraie valeur persistée). Ce correctif était un prérequis silencieux mais bloquant pour que les Parties H/I/J/K (notifications, conversations) aient un sens en usage réel — sans lui, toute notification ou conversation créée aurait disparu au rechargement suivant.

## Partie B/C — Localisation canonique, moteur unique

`moveOrderToStage(orderId, stageId, options)` est la seule voie d'écriture de `locationEvents`. Elle délègue à `recordScan()` (inchangée) pour la branche `SCAN`, et réplique manuellement (consommation + `markOrderReadyIfLastStage` + sauvegarde) pour `MANUAL`/`SYSTEM` — choix qui évite une double consommation tout en ne dupliquant aucune logique métier.

`getCurrentOrderStage()`/`getLastLocationEvent()` retombent sur l'ancienne dérivation par `scanEvents` pour toute commande sans `LocationEvent` — mécanisme additif qui a permis de préserver les 166 tests V3.7.1 sans aucune modification, y compris ceux qui construisent des fixtures `scanEvents` directement.

Un piège de timing de démarrage a été rencontré et corrigé : le tout premier rendu (déclenché par la fin du script de base, **avant** que l'IIFE n'ait exécuté `installOverrides()`) appelle `getConfirmedStage()` → `getCurrentOrderStage` par identifiant nu, non encore exposé. Corrigé par une garde défensive (`typeof getCurrentOrderStage!=='function'`) qui retombe sur l'ancienne dérivation — comportement non seulement sûr mais **sémantiquement correct** à cet instant précis (aucun `LocationEvent` ne peut exister avant que le seed n'ait tourné).

## Partie D — Drag & drop + mobile

`setupProductionDnD()` distingue `dragType` (`'column'` pour la réorganisation des postes, inchangé, vs `'order'`, nouveau) — une carte n'est `draggable` que si `can(currentUser(),'production.manage')`. La fiche commande gagne un bouton « Changer la localisation » (desktop et mobile, même garde de droits) qui ouvre un sélecteur inline plutôt qu'un panneau séparé — cohérent avec le style existant de la fiche.

## Partie E — Traçabilité réécrite

`orderTimeline()` a été entièrement réécrite pour ne plus lire `historyEvents` comme source de vérité (source de doublons potentiels avec `locationEvents`/`reworks`/`cancelledAt`/`deliveredAt`). Deux champs de commande auparavant absents ont dû être ajoutés au modèle : `createdAt` (n'existait nulle part avant V3.8 — seul `historyEvents` portait la date de création) et `deliveredAt` (la « livraison » était auparavant confondue avec `productionCompletedAt`, empêchant de distinguer « Prête à livrer » de « Livrée » comme deux faits réels et temporellement distincts, ainsi que l'exige le mandat).

Un repli sur `scanEvents` a été conservé pour les commandes sans `LocationEvent`, avec la même justification qu'en Partie B/C : sans lui, toute commande antérieure à V3.8 afficherait une timeline vide entre sa création et sa livraison.

## Partie F — Annulation / Stock

Le principe « une matière travaillée ne retourne pas en stock » était déjà respecté au niveau moteur depuis V3.6 (`cancelOrder()` ne touche jamais le stock). Le changement V3.8 porte sur le **flux utilisateur** : avant V3.8, une commande avec matière déjà consommée ouvrait un panneau de restitution partielle (`cancelForm`/`confirmCancelWithReturn`). Ce chemin est retiré de `openCancelFlow()`, qui annule désormais directement dans tous les cas. Les fonctions moteur sous-jacentes (`confirmCancelWithReturn`, `openReturnMoreFlow`) restent définies — jamais supprimées — pour ne pas casser les tests moteur V3.6.1/V3.6.2 qui les exercent directement (choix documenté : « supprimer du flux d'annulation » a été interprété comme retirer les points d'entrée UI, pas comme démanteler une capacité moteur testée indépendamment).

## Partie G — Bug portail dentiste (correctif terrain)

Root-cause confirmée par lecture de code puis vérification navigateur réelle (contournement de l'instabilité Playwright locale par manipulation DOM directe plutôt que les actions natives `.click()`/`.fill()`, qui fermaient la page de façon intermittente dans cet environnement) : `.deliv-opt` était partagé entre les options de date de livraison et les options d'empreinte, et le handler de clic générique déclenchait `renderDentistMode()` (destructeur de formulaire) sur un clic d'empreinte. Corrigé par des attributs `data-impression-mode` distincts et un garde explicite dans le handler.

## Partie H/I — Identification automatique + notifications

Le modèle `state.dentists` avait déjà, depuis V3.6, un champ `cabinet` par dentiste — mais aucun scénario de démonstration ne regroupait deux dentistes sous le même cabinet. Un 6ᵉ dentiste (Amélie Rousseau, `Cabinet Moderne`) a été ajouté pour que le cas « compte groupé » soit réellement démontrable, sans toucher aux 5 dentistes existants ni aux commandes qui les référencent.

## Partie J/K — Messagerie

Réécriture complète de la messagerie labo (`renderMessagesPanel`/`renderConversationThread`, remplaçant `renderThread`) et portail (`dentistMessagesHTML`/`dentistConversationThreadHTML`/`dentistNewMessageFormHTML`, remplaçant `dentistThreadHTML`). `createConversation()` impose l'isolation par cabinet au niveau moteur (refuse toute commande n'appartenant pas au `cabinetId` fourni), pas seulement par filtrage d'affichage — cohérent avec l'exigence du mandat que les garde-fous soient au niveau moteur.

**Incident de développement notable** : une réécriture par script Node basé sur les décalages d'octets a supprimé par erreur 4 fonctions non ciblées (`dentistNewHTML`, `dentistFacturesHTML`, `createDentistOrderCore`, `renderDentistMode`) qui se trouvaient être imbriquées entre les fonctions réellement visées. Détecté immédiatement par l'échec de `node --check`/la suite de tests (`createDentistOrderCore is not defined`), corrigé par réinsertion exacte des 4 fonctions à partir du contenu déjà lu en contexte, puis reconfirmé par une nouvelle exécution complète de la suite (168/168 puis 174/174 après ajout des tests suivants). Aucune régression n'a atteint l'état livré.

## Partie L/M — Vocabulaire + Seed V9

Le remplacement de « Commande prête » par « Prête à livrer » a été traité dans son unique occurrence réelle (l'ancienne `orderTimeline()`) — les libellés de statut compacts (`statusInfo`, badges de tableau) et les libellés du portail dentiste (délibérément simplifiés en `Reçue/Fabrication en cours/Contrôle/Prête/Livrée` par la Partie K elle-même) n'ont pas été touchés, ces derniers étant une exigence **distincte et déjà conforme** du mandat (§75-77 : le portail doit utiliser un vocabulaire simple, pas nécessairement identique au vocabulaire interne labo).

`seedV9Orders()` reconstruit les 12 commandes de démonstration en passant systématiquement par le moteur réel (`buildOrderFromInput` avec `createdAt` explicite, `moveOrderToStage` avec `options.at` explicite, `createConversation`) plutôt que d'assigner des champs à la main — garantissant que la timeline produite par `orderTimeline()` est **réellement** cohérente, pas seulement en apparence. Un bug de pollution croisée entre l'ancien `seedV8()` (qui construit encore ses propres commandes avant d'être remplacées) et le nouveau seed a été détecté (un `StockMovement` orphelin référençant une commande jamais créée dans le nouvel état) et corrigé par un filtrage explicite des mouvements `sourceType==='scan'|'cancelledOrder'` en début de `seedV9Orders()`.

## Partie N — Scan photo robuste

Le problème terrain décrit par le mandat (DataMatrix occupant une petite région d'une photo d'emballage complète) a été reproduit fidèlement en test (code généré par `ZXing.DataMatrixWriter`, placé avec rotation dans le coin d'une image 1400×1400 bruitée) et confirmé : le décodage direct de la photo entière échoue systématiquement, alors que le décodage de la seule zone recadrée réussit. L'écran de cadrage (`renderCropScreen`/`setupCropInteraction`) et le décodage multi-passes (`runMultiPassDecode`/`applyPhotoVariant`) implémentent exactement ce que ce constat impose.

Un bug d'URL blob révoquée trop tôt (cassant l'aperçu image de l'écran de cadrage) a été détecté par l'apparition d'erreurs console (`Not allowed to load local resource: blob:...`) pendant la vérification navigateur, et corrigé par report de la révocation à la fermeture effective de l'écran de cadrage.

## PWA/UX — 3 modes distincts

Vérification réalisée sans modification de code : l'architecture Collaborateur (PWA mobile-first, sans sidebar labo) et Labo (responsive, sidebar complète) existe et fonctionne correctement depuis les missions V3.3 (« Mode staff centré Scan », « Responsive mobile staff ≤520px »). Le Portail dentiste reste desktop-first et n'expose aucun bouton d'installation. Voir `DENTALFLOW_V3_8_SAAS_MAPPING.md` pour la préparation documentée (manifeste, service worker, limites de `file://`) — **aucune infrastructure PWA réelle n'a été implémentée en V3.8**, conformément au mandat (§156-160 : préparer l'architecture, documenter, ne jamais prétendre que `file://` est installable).

## Limites du POC assumées (§142, rappelées)

Aucun paiement en ligne, aucun CRM, aucune comptabilité complète, aucune TVA, aucun backend réel, aucune authentification sécurisée, aucun WebSocket, aucun email/SMS réel. La messagerie/les notifications sont une simulation fonctionnelle locale — jamais présentées comme une synchronisation multi-appareil ou temps réel.
