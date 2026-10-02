# DentalFlow V3.12.1 — Changelog

**Base :** `dentalflow-next-poc-v3.12.0.html` (frozen, inchangé).
**Nouveau fichier produit :** `dentalflow-next-poc-v3.12.1.html` — correctifs UX Espace Cabinet uniquement.
**Nouveau kit de test :** `dentalflow-test-labo-v3.12.1.html` — copie fonctionnelle autonome, données réellement importées uniquement.

Aucune logique métier Cabinet n'a été modifiée au-delà de ce qui est explicitement demandé ci-dessous.

## A. Correctifs UX Espace Cabinet (`dentalflow-next-poc-v3.12.1.html`)

### A1. Barre d'onglets

- Rangée d'onglets (`Mes commandes` / `Nouvelle commande` / `Messages` / `Factures`) : padding/taille de police légèrement réduits sous 600px, et un **fondu en dégradé** apparaît désormais sur le bord droit de la rangée dès qu'elle devient défilable (`.portal-tabs::after`), signalant explicitement qu'il reste des onglets à droite — plus de coupure nette ressemblant à un bug. Le corps de la page ne scrolle jamais horizontalement (comportement déjà correct, vérifié explicitement à 1180/1024/900/768/650/430/390 px).

### A2. Header Espace cabinet

- `min-width:0` ajouté sur le header et ses enfants flexibles (logo, sélecteur Cabinet, bouton Retour laboratoire) pour un rétrécissement propre à toute largeur ; aucun élément ne sort jamais de l'écran, le logo reste toujours visible.

### A3. Bug racine identifié — bouton « Nouveau message » invisible sous 860px

**Cause racine reproduite par interaction navigateur réelle** : le bouton « ＋ Nouveau message » réutilisait la classe partagée `.primary`, dont la variante mobile (`@media(max-width:860px)`, pensée exclusivement pour le bouton FAB de la topbar Labo) impose `font-size:0;width:46px;padding:0` — rendant ce bouton Cabinet totalement invisible (pastille bleue vide) dès que la fenêtre descendait sous 860px.

- Nouvelle classe dédiée `.cab-primary-btn`, indépendante de `.primary`, jamais affectée par la variante mobile de la topbar Labo.

### A3/A4. Grille de messagerie Cabinet

- Nouvelle classe `.cab-message-layout` (colonne Conversations élargie à 260–320px, jamais 190px) remplace `.side-message-layout` (qui reste intacte pour le volet Labo à 560px — aucune régression sur cet usage existant).
- En-tête de la colonne Conversations (`.cab-thread-head`) : titre et bouton empilés verticalement, bouton pleine largeur — ne chevauche jamais le titre, à aucune largeur.
- Sous ~900px, la grille bascule en une seule colonne (Conversations puis Conversation sélectionnée, l'une sous l'autre) au lieu de forcer deux colonnes étroites.

### A5/A6. Formulaire « Nouveau message »

- Nouvelle classe dédiée `.dentist-message-form` (ne détourne plus `.dnew-form`, pensée pour la grille 2 colonnes du formulaire de commande). Espacement vertical de 22px entre groupes fonctionnels (Sujet / Associer à des commandes / Message / Pièces jointes / Envoyer), 6–8px entre label et contrôle.
- « Associer à une ou plusieurs commandes » devient un bloc visuellement distinct (`.msg-order-list` : fond, bordure, radius, padding, défilement interne à partir de 220px de hauteur) — ne pousse jamais le reste du formulaire hors écran.
- Tous les champs (input/textarea) : `width:100%`, `min-width:0`, `box-sizing:border-box` — ne dépassent jamais leur conteneur, à aucune largeur testée.

### A7. Écran « Nouveau message » — carte unique

- En mode composition, l'ancienne carte « Messages » redondante (avec son propre bouton « ＋ Nouveau message ») n'est plus affichée au-dessus du formulaire. Une seule carte principale (« Nouveau message » / « Annuler »), jamais deux boutons liés au même geste.

### A8. Tests ciblés CABUX01-10

10/10 PASS (voir `DENTALFLOW_V3_12_1_TEST_REPORT.md`) — aucun chevauchement Conversations/Nouveau message à 1180/768/650px, aucun débordement horizontal du document à 430/390px, les 4 onglets Cabinet restent accessibles, le formulaire Nouveau message tient intégralement dans le viewport, espacements verticaux distincts confirmés, textarea/inputs ne dépassent jamais leur conteneur, bouton toujours visible et jamais superposé.

## B. Kit de test laboratoire (`dentalflow-test-labo-v3.12.1.html`)

### B1-B3. Corpus réellement importé uniquement

- Les fixtures historiques DentalFlow (`demoUsers`, `DEMO_DENTISTS`, `DEMO_SERVICES`, `DEMO_SUPPLIERS`, `DEMO_ARTICLES`, `demoOrders`) sont identifiées **par identifiant** (jamais par liste fragile de chaînes) : un boot neuf de `dentalflow-next-poc-v3.12.1.html` capture l'ensemble exact des identifiants de fixtures, dans la **même session navigateur** que l'import réel (évite toute dérive liée à des identifiants de cabinet générés aléatoirement d'un boot à l'autre). Tout enregistrement absent de cet ensemble après import est, par construction, réellement importé.
- Compteurs finaux : **126 cabinets, 91 dentistes, 13 utilisateurs, 352 prestations, 19 fournisseurs, 515 articles** — voir `DENTALFLOW_V3_12_1_TEST_REPORT.md` pour le diagnostic exact des deux écarts par rapport aux 353/17 nominaux (doublon réel dans le corpus CSV, jamais une suppression ou une invention silencieuse).
- Relations dépendantes (articleSuppliers, stockLots, stockMovements, servicePriceOverrides, manufacturers réellement référencés) filtrées selon le même principe — jamais une seconde logique de filtrage.
- Les 3 prestations déjà qualifiées par le laboratoire (état exact conservé : `pricingMode`, `pricingReviewRequired:false`, `active`) ; aucune autre prestation n'est qualifiée automatiquement.

### B4. Données transactionnelles nettoyées

Commandes/conversations/messages/notifications/documents/scanEvents/locationEvents/historyEvents/factures/paiements/PurchaseOrders/PurchaseProposals/absences/congés/scénarios d'urgence de démonstration : tous retirés de la baseline livrée. Aucune suppression de stock importé.

### B5. Utilisateur courant

Aucun utilisateur importé ne porte le rôle `RESPONSABLE` (droits complets) — la première utilisatrice importée au rôle `ADMINISTRATIF` (le plus proche d'« Administrateur ») a été retenue comme `currentUserId`, conformément à la priorité du mandat. **Limitation connue** : ce rôle ne couvre pas `production.manage`/`production.scan` — à élever via l'écran Personnel si la séance nécessite de déplacer/scanner directement avec ce compte.

### B6-B11. 10 commandes fictives

- 10 commandes créées via le **moteur réel** (`createOrder`, `ensureReceptionLocation`, `moveOrderToStage`, jamais une seconde logique de fixture) : cabinets/dentistes/prestations réellement importés et déjà qualifiés, patients 100% fictifs (« Fictif Démo 01 » à « Fictif Démo 10 », store Cabinet uniquement).
- Répartition exacte : 2 Réception / 2 Modélisation / 2 Usinage / 2 Finition 1 / 1 Finition 2 / 1 Expédition. Aucune annulée, aucune livrée. La commande en Expédition porte `productionCompletedAt` figé et aucun `deliveredAt` (Expédition ≠ Livrée).
- Chronologie strictement croissante par commande (`Clock.mode='demo'` autour de chaque étape du moteur réel, jamais une horloge globale laissée en mode démo) — chaque LocationEvent, et les effets internes qui en découlent (`productionCompletedAt` notamment), portent un horodatage cohérent avec sa place réelle dans le flux.
- **Stock importé strictement inchangé** par ces 10 commandes : aucune des prestations qualifiées ne porte de recette de consommation matière (`serviceMaterials` vide dans ce kit), donc `consumeForScan()` est un no-op par construction — vérifié empiriquement (total `stockMovements` identique avant/après, DATA11).
- Un Cabinet (« ANDRE-GUILLOU Fabienne ») porte 3 des 10 commandes et une conversation fictive (2 messages, aucun nom de patient dans le texte) pour permettre de tester Mes commandes/Messages/association à plusieurs commandes.

### B12-B15. Bootstrap autonome

- Clés localStorage dédiées : `dentalflow-test-labo-v3121-state-v1` et `dentalflow-test-labo-v3121-cabinet-patients-v1` — jamais la clé produit ni une ancienne clé de kit.
- Amorçage à la toute première ouverture uniquement (clé absente) ; aucune réinjection au rechargement normal.
- Mode observateur (`?observer=1`) : bouton discret « Réinitialiser les données de test », absent en navigation normale.
- `?runTests=1` : la baseline n'est jamais injectée, le moteur utilise son seed natif — 468/468 ×3 confirmés sur le kit lui-même.
- **Correctif additionnel découvert pendant l'intégration** : `migrateUsers()` (script de base, `load()`) réinjecte inconditionnellement tout profil `demoUsers` absent du state persisté, à chaque démarrage — un garde-fou pensé pour l'évolution du roster de démonstration du produit, pas pour ce kit qui exclut délibérément ces 15 profils. Un script additif (`dentalflow-test-labo-v3121-fixup`), placé après le bloc « implementation » (jamais entre le script de base et l'IIFE, où un `save()` prématuré — avant que `window.v34Save` ne soit exposé — écrirait une persistance V5 incomplète), retire ces profils et resauvegarde l'état complet à chaque démarrage normal ; désactivé sous `?runTests=1`.
- `dentalflow-next-poc-v3.12.1.html` n'a jamais été lu en écriture : MD5 identique avant/après l'ensemble de ce travail.

## Hors périmètre

Aucun mécanisme métier de suppression du poste Expédition n'a été construit (hors périmètre, comme en V3.12.0). Le questionnaire `dentalflow-questionnaire-utilisateur-v2.2.html` reste strictement inchangé — aucune formulation ne dépendait d'un écran modifié dans ce lot.
