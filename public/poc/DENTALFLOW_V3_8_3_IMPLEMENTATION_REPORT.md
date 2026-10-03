# DentalFlow Next V3.8.3 — Implementation Report

## Portée et méthode

Mission de **polish UX et de complétude fonctionnelle** (11 parties, A à K) sur `dentalflow-next-poc-v3.8.2.html` (238/238 PASS), livrée sous `dentalflow-next-poc-v3.8.3.html`. Aucun nouveau module majeur, aucune migration de schéma (V10 conservé). `dentalflow-next-poc-v3.8.2.html` n'a jamais été modifié (vérifié via `git diff` avant livraison — aucune différence).

Fichier livré : **13 215 lignes**, 5 blocs `<script>` inchangés dans leur découpage (base script(s), le bloc jsPDF 2.5.2 embarqué, l'IIFE d'implémentation principale `id="dentalflow-v34-implementation"`).

Chaque partie a été implémentée puis vérifiée immédiatement via `node --check` (les 5 blocs), la suite de tests persistée complète, et un script Playwright dédié interagissant réellement avec le DOM (clics, saisies, mesures `getBoundingClientRect`/`getComputedStyle`) avant de passer à la partie suivante — jamais une implémentation "à l'aveugle" sans vérification immédiate.

## Détail par partie

### A — Header : alignement recherche/cloche
Root cause : `.topbar{align-items:start}` combiné à un `align-self:center` isolé sur `.icon-btn` seulement. Fix au niveau du conteneur (`align-items:center` sur `.topbar`) plutôt qu'un correctif par enfant — solution robuste et symétrique. Hauteurs communes 50px, `border-radius:12px`. `.icon-btn svg{width:22px;height:22px}` et `.hkpi-ico svg{width:23px;height:23px}` — l'override se fait toujours via CSS sur le conteneur, jamais en modifiant `icon()` (helper partagé par de nombreux contextes d'icônes sans rapport).

### B — Notifications : alignement des icônes
Nouvelle classe **dédiée** `.notification-icon`/`.notif-row` plutôt qu'une modification de `.alert-ico`/`.alert-row` (partagées avec Accueil « À surveiller » et « Watch list », hors périmètre — éviter tout effet de bord). `notifIcon()`/`notifColor()` nouvelles fonctions de mapping catégorie→icône/couleur, appelées depuis `renderNotificationsPanel()` réécrite. Nouvelle variable `--violet` déclarée à 3 endroits (root clair, `data-theme="dark"`, et `@media(prefers-color-scheme:dark){html[data-theme="system"]}` — jamais oubliée dans l'un des trois, vérifié par script Python de remplacement ciblé avec comptage des occurrences).

### C — États commandes : coloration + hover + dark mode
**Défaut UX préexistant corrigé au passage** (au-delà du strict mandat, mais découlant directement de son exigence « le survol doit conserver la couleur d'état ») : Production/Livrée/Annulée n'avaient aucune règle `:hover` dédiée en V3.8.2, retombant sur le survol générique blanc. Les 7 états ont désormais leur propre `:hover`.

**Auto-correction notable** : une première version combinait `html[data-theme="dark"] X,html[data-theme="system"] X{...}` en un seul sélecteur groupé pour les 28 règles (base + hover × 7 états). Ceci aurait rendu le thème « system » **toujours sombre**, quel que soit le réglage OS réel — violation du pattern établi ailleurs dans le fichier (`@media(prefers-color-scheme:dark){html[data-theme="system"] ...}`). Détecté en relisant le bloc inséré avant de passer à la suite, corrigé en scindant en deux blocs correctement conditionnés, puis vérifié via Playwright avec `?theme=light` et `?theme=dark` montrant des valeurs `rgba` distinctes. Ce bug précis est désormais couvert par le test persisté **C06**, qui vérifie explicitement l'absence de règle "system" hors media query.

### D — Charge : simplification de la carte
Réécriture complète de `whatIfSectionHTML()` (8→5 colonnes) et extraction de `whatIfImpact()`. Nouveau composant générique `.row-menu`/`.row-menu-btn`/`.row-menu-pop` (popover "⋯", fermeture au clic extérieur, un seul menu ouvert à la fois via un cache des `data-row-menu-pop` visibles). Nouvelle side-window `renderWhatifFormPanel()`/`submitWhatifForm()`, avec `state.whatIfEditIndex` distinguant ajout (`null`) et modification (index) — remplace intégralement l'ancien `#whatif-form` fixe et son handler `submit` dédié (désormais un simple relais vers `submitWhatifForm(data)`).

### E — Stock : création d'article
Nouvelle fonction moteur `createArticle(data,s,actingUserId)` : garde-fou `stock.manage` **au niveau moteur** (comme `setArticleStatus`/`receiveStockManual` déjà existants), référence unique refusée avec `DUPLICATE_ARTICLE_REFERENCE`. Stock physique initial toujours 0 — aucun `StockMovement` créé à la création (cohérent avec l'invariant déjà établi ailleurs : seul `receiveStockManual` crée des mouvements RECEIPT). Mini-flux « + Nouveau fabricant » implémenté en JS pur (ajout à `state.manufacturers`, mise à jour du `<select>` existant) sans navigation ni fermeture du panneau.

**Bug pré-existant découvert et corrigé au passage** : `renderSidePanel()` (dispatcher de base) ne listait pas certains panels Achats/Stock (`stockManual`, `proposalDetail`, `pointPayment`, etc.) — ceux-ci sont en réalité gérés par un **second dispatcher**, `const oldRenderSidePanel=renderSidePanel;renderSidePanel=function(){...}` (pattern d'override IIFE déjà établi ailleurs dans le fichier). Le nouveau panel `stockNewArticle` a été enregistré dans ce second dispatcher, au bon endroit.

**Point d'attention technique (limite IIFE)** : `submitStockArticleForm`/`createArticle`/`renderStockArticleFormPanel` sont définis à l'intérieur de l'IIFE d'implémentation (bloc 5), mais appelés depuis le document `submit` listener du script de base (bloc 4, hors IIFE). Exposition ciblée via `window.createArticle=...` dans `installOverrides()`, suivant exactement le même schéma que les expositions déjà en place pour `cabinetById`, `renderInvoicePreviewPanel`, etc. — documenté par un commentaire dédié dans le code.

### F — Aperçu facture : alignement
Nouvelle classe additive `.invoice-doc-table` (jamais une modification de `.print-audit`, partagée avec le bon de suivi et l'audit imprimés). Colonnes numériques `class="num"` (centrées horizontalement ET verticalement via `vertical-align:middle` + `height:38px` fixe sur toutes les cellules), `class="label"` pour Prestation (alignée à gauche). Nouvelle classe `.btn-fixed` (44px) appliquée à tous les boutons du pied de l'aperçu, quelle que soit leur variante (`big-primary`/`secondary`/`ghost`) — vérifié pour les deux jeux de boutons possibles (DRAFT : Fermer/Modifier/Émettre ; ISSUED/SENT : Fermer/Imprimer/PDF/Envoyer/Pointer).

### G — Factures : recherche unifiée
`invoicesSearchQuery()`/`invoiceMatchesQuery()`/`orderMatchesInvoiceQuery()` nouvelles fonctions, appliquées aux 3 onglets pertinents (À facturer/Factures/Pointage) — jamais à Prestations (hors périmètre du mandat). Réflexion partielle du DOM (`#invoices-body-wrap`) sur `oninput`, avec préservation du focus clavier — même schéma que `filterAudit()` déjà en place pour le Journal d'audit. `filterInvoices` exposée via `window.filterInvoices` car appelée par un attribut HTML `oninput` inline (portée globale, IIFE-privée sinon).

### H — Prestations : tri/recherche/alignement
`filteredSortedServices()`/`servicesSortTh()` — même schéma que `filteredSortedUsers()`/`usersSortTh()` (V3.8.2 Partie D). Le clic d'en-tête (`th[data-svc-sort]`) déclenche un `render()` complet (pas de saisie en cours à préserver, contrairement à la recherche) ; géré dans le handler générique de clic du script de base, sans besoin d'exposition croisée puisqu'il ne fait que muter `state` et appeler `render()` (déjà global). Nouvelle classe `.svc-row-actions` (32px, `display:flex;align-items:center`) pour l'alignement des 3 boutons d'action.

### I — Matières multiples : UX explicite
`addServiceMaterial()` modifiée pour **fusionner** une association déjà existante (même `serviceId`+`articleId`+`consumeAtStageId`) plutôt que de pousser un doublon — la ligne existante voit sa quantité remplacée, avec un résultat `{success:true,merged:true}` distinct permettant un toast explicite côté UI (« Association déjà existante — quantité mise à jour »). Nouveau bouton `[Modifier]` par ligne (dans les deux panneaux, article↔prestation) préremplissant le formulaire d'ajout via manipulation DOM directe (`form.querySelector(...)`.value=...), sans fermer le panneau ni recharger — permettant plusieurs ajouts/ajustements à la suite. `state.serviceMaterials` reste l'unique source de vérité ; `knownDemand()`/`consumeForScan()` (préexistants) géraient déjà nativement plusieurs matières par prestation via `.filter()` sur toutes les entrées correspondantes — vérifié, pas modifié.

### J — Utilisateurs : avatars
`userColor()`/`userInitials()` (préexistants, déjà utilisés ailleurs — Planning/Absences/Effectif) réutilisés tels quels dans une nouvelle colonne fusionnée « Utilisateur » (`renderUsersTableHTML`/`renderUsersCardsHTML` réécrites). Le tri Nom/Prénom, auparavant porté par deux `<th data-usort>` distincts, est désormais porté par deux `<span data-usort>` **à l'intérieur** du même `<th>` fusionné (un seul `<th>` ne peut pas porter deux clés de tri) — le sélecteur de clic générique a été élargi de `th[data-usort]` à `[data-usort]` (aucune autre utilisation de cet attribut dans le fichier, vérifié par recherche exhaustive avant modification). Classe `.lab-user-avatar.users-avatar` (double sélecteur pour une spécificité fiable, indépendante de l'ordre du CSS) : 36px desktop, 42px sous 600px.

### K — Rôles colorés
`ROLE_UI` (objet unique `{RESPONSABLE:'blue',PRODUCTION:'green',STOCK:'orange',ADMINISTRATIF:'violet',LECTURE:'gray'}`) et `roleColorClass(roleId)`, définis juste après `ROLE_DEFS`/`roleLabel` dans le script de base — accessible sans exposition croisée depuis toutes les fonctions de rendu qui en ont besoin. Nouvelle classe `.pill.violet` (claire + sombre `html[data-theme="dark"]`).

## Points d'architecture respectés

- **Frontière IIFE** : chaque nouvelle fonction appelée depuis l'autre côté de la frontière (script de base ↔ IIFE d'implémentation) a été explicitement exposée via `window.X=X` dans `installOverrides()`, jamais laissée en échec silencieux — 3 nouvelles expositions ciblées ajoutées (`createArticle`/`submitStockArticleForm`/`renderStockArticleFormPanel`, `filterInvoices`, `filterServices`), chacune documentée par un commentaire expliquant pourquoi.
- **Thèmes** : toute nouvelle règle CSS réactive au thème « system » a été systématiquement enveloppée dans `@media(prefers-color-scheme:dark){html[data-theme="system"] ...}`, jamais appliquée à `html[data-theme="system"]` hors media query — erreur commise puis corrigée une fois (Partie C, voir ci-dessus), et désormais gardée par un test dédié (C06).
- **Classes dédiées plutôt que classes partagées modifiées** : `.notification-icon` (vs `.alert-ico`), `.invoice-doc-table` (vs `.print-audit`) — évite tout effet de bord sur des composants hors périmètre.
- **Garde-fous moteur, jamais uniquement côté UI** : `createArticle()` vérifie `stock.manage` au niveau moteur, refuse les références dupliquées avec une raison typée — comme tous les garde-fous préexistants (`setArticleStatus`, `receiveStockManual`, `moveOrderToStage`, etc.).

## Non-régression

`dentalflow-next-poc-v3.8.2.html` : **jamais modifié** (confirmé par `git diff` avant livraison). 236 tests V3.8.2 strictement conservés (2 réécrits, documentés comme extension stricte du mandat — jamais un affaiblissement, voir TEST_REPORT). Toutes les fonctionnalités V3.8.2 (schéma V10, Cabinets, traçabilité, LocationEvents, notifications, facturation, PDF réel, permissions, responsive, 3 modes) restent intactes.
