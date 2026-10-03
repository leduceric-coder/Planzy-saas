# DentalFlow Next V3.8.3 — Changelog

Base : `dentalflow-next-poc-v3.8.2.html` (238/238 PASS). Livrable : `dentalflow-next-poc-v3.8.3.html`. V3.8.2 n'a jamais été modifié.

Schéma : **V10 inchangé**. V3.8.3 est une mission de polish UX et de complétude fonctionnelle — **aucun nouveau module majeur**, aucune migration de schéma. Toutes les fonctionnalités V10 (Cabinets, traçabilité, LocationEvents, notifications, facturation, PDF, permissions, responsive, mode Collaborateur PWA, portail Cabinet) sont conservées intactes.

## Partie A — Header Accueil : alignement recherche/cloche

- `.topbar` passe en `align-items:center` (était `align-items:start` avec un `align-self:center` isolé sur `.icon-btn` seulement) — recherche et cloche partagent désormais un seul niveau vertical, dans le même conteneur flex/grid.
- `.search` et `.icon-btn` passent à une hauteur commune de **50px** (était 46px), même `border-radius:12px`.
- `.icon-btn` : SVG interne forcé à **22×22px** via `.icon-btn svg`. Badge `.dot` repositionné (`right:6px;top:6px`, `position:absolute`, `pointer-events:none`) — ne déplace jamais le bouton.
- `.hkpi-ico` (icônes KPI Accueil) : conteneur porté à **46×46px**, SVG interne à **23×23px** via `.hkpi-ico svg` — esthétique sobre conservée, lisibilité améliorée.

## Partie B — Centre de notifications : alignement des icônes

- Nouvelle classe dédiée `.notification-icon` (40×40 fixe, `flex:0 0 40px`, `display:flex` centré, `border-radius:12px`, SVG 20px) — **jamais** la classe partagée `.alert-ico` (utilisée par ailleurs sur Accueil « À surveiller »/« Watch list », hors périmètre de cette mission).
- Nouvelle structure de ligne `.notif-row` : `[icon][content flex:1;min-width:0][chevron]` — le texte de catégorie ne déforme plus jamais la boîte icône ; le titre peut passer sur 1-2 lignes sans écraser l'icône.
- Nouvelles fonctions `notifIcon(n)`/`notifColor(n)` : mapping catégorie → icône/couleur — Commandes=bleu, Messages=violet, Production=orange, Stock=orange, Achats=bleu, RH=violet, alerte critique (severity=red)=rouge prioritaire.
- Nouvelle variable `--violet` (`#8b5cf6` clair / `#a78bfa` sombre) — première utilisation d'un accent violet dans l'application.
- `@media(max-width:430px)` : `.notification-icon` réduit à 36×36 (SVG 18px) — aucun débordement horizontal, aucun texte sous l'icône à 390px.

## Partie C — États visuels des commandes : coloration renforcée

- Bordure gauche des 7 états (`ovs-late/blocked/new/ready/production/delivered/cancelled`) portée de 3px à **5px**, fond pastel perceptible en 1 seconde (alpha augmenté, palette exacte du mandat respectée) — sans jamais saturer.
- **Correction d'un défaut UX préexistant** : Production/Livrée/Annulée n'avaient auparavant **aucune** règle de survol dédiée (repli sur le survol générique blanc `#fbfcff`), en contradiction directe avec l'exigence « le survol doit conserver la couleur d'état ». Les 7 états ont désormais leur propre règle `:hover` (fond légèrement plus soutenu, jamais blanc uniforme).
- Nouvelles variantes sombres explicites : un bloc `html[data-theme="dark"] .orders-table tr.ovs-*` (couleurs iOS-dark plus lumineuses) **et** un bloc distinct `@media(prefers-color-scheme:dark){html[data-theme="system"] .orders-table tr.ovs-*}` — jamais combinés en un seul sélecteur (le thème « system » ne doit s'assombrir que si l'OS est effectivement en sombre, jamais inconditionnellement).
- Badge NOUVEAU conservé comme complément à la couleur d'état primaire (jamais un remplacement) ; priorité stricte retard>bloquée>nouvelle>prête>production>livrée>annulée inchangée.

## Partie D — Plan de charge : simplification de « Demandes & simulation »

- Table radicalement simplifiée : **8 colonnes → 5 colonnes maximum** (Collaborateur/Période/Impact/Type/Actions). La cellule Collaborateur affiche nom + sous-texte (type/durée, ex. « Julie Moreau » / « Congés · 1 jour »).
- Actions par ligne via un nouveau composant générique `.row-menu`/`.row-menu-btn`/`.row-menu-pop` (menu « ⋯ ») : ligne Demande → `[Inclure][Approuver][⋯ → Refuser/Voir le détail]` ; ligne Simulation → `[Incluse ✓][⋯ → Modifier/Supprimer]`.
- **Suppression du formulaire permanent** en bas de carte (`#whatif-form` fixe) — remplacé par un bouton `+ Ajouter une simulation` en haut à droite ouvrant une side-window dédiée (`renderWhatifFormPanel()`, champs Collaborateur/Du/Au/Ajouter), qui gère aussi bien l'ajout que la modification (`state.whatIfEditIndex`).
- Résumé compacté en `.chg-impact` : deux KPI lisibles (« −N cmd » / « N semaine(s) en tension ») — jamais un grand bloc orange vide.
- « Voir le calendrier du scénario » reste une action secondaire discrète ; « Réinitialiser la simulation » n'apparaît **que si** une simulation est active (`state.whatIfSims.length>0`).

## Partie E — Stock : création d'article

- Nouveau bouton **« + Nouvel article »** à côté de Entrée manuelle/Scanner une réception/Importer, dans l'onglet Stock de « Stocks & achats ».
- Nouvelle fonction moteur `createArticle(data)` : garde-fou `stock.manage` **au niveau moteur** (jamais seulement un bouton masqué côté UI) ; référence unique refusée avec la raison explicite `DUPLICATE_ARTICLE_REFERENCE` (jamais un doublon silencieux).
- Side-window : Référence(requise, unique)/Nom/Catégorie/Unité/Fabricant (`<select>` sur `state.manufacturers`, avec un mini-flux « + Nouveau fabricant » qui reste dans le panneau)/Stock minimum·sécurité/Capacité(facultatif)/Consommation moyenne(facultatif)/GTIN(facultatif)/Statut ACTIVE.
- À la création : l'article apparaît **immédiatement** dans Stock, stock physique initial = **0**, **aucun** `StockMovement` fictif créé — pour approvisionner, l'utilisateur passe ensuite par Entrée manuelle (comme pour tout autre article).

## Partie F — Aperçu de facture : alignement

- Nouvelle classe `.invoice-doc-table` (additive à `.print-audit`, jamais une modification de cette classe partagée avec le bon de suivi/audit) : colonnes Qté/Prix/Total centrées **horizontalement et verticalement**, Prestation reste alignée à gauche, hauteur de cellule cohérente (38px).
- Pied de page de l'aperçu : nouvelle classe `.btn-fixed` (44px, padding/alignement identiques) appliquée à **tous** les boutons (Émettre=primary, Modifier la sélection=secondary, Fermer=ghost, Imprimer/PDF/Envoyer/Pointer) — même hauteur quelle que soit la variante visuelle.

## Partie G — Factures : recherche par cabinet/commande/prestation

- Nouvelle barre de recherche principale sur la page Factures (placeholder « Rechercher une facture, un cabinet, une commande… »), appliquée aux onglets **À facturer / Factures / Pointage** (pas Prestations, hors périmètre).
- `invoiceMatchesQuery(inv,q)` / `orderMatchesInvoiceQuery(o,q)` : cherche sur `invoice.id`, le nom du cabinet (snapshot ou legacy), `orderIds`, les libellés de prestation. Réflexion partielle sur clavier avec préservation du focus (`refreshInvoicesBody`/`filterInvoices`, même schéma que `filterAudit`).
- Vérifié : rechercher « Cabinet Moderne » fait remonter ses commandes à facturer, ses factures et ses paiements pointés récents.

## Partie H — Prestations : tri, recherche, alignement des boutons

- Table triable par clic d'en-tête (Prestation/Catégorie/Tarification/Prix/Statut) avec indicateur ↑↓, même schéma que `usersSortTh`/`th[data-usort]` (V3.8.2 Partie D).
- Nouvelle barre de recherche (« Rechercher une prestation… ») filtrant libellé/catégorie.
- Nouvelle classe `.svc-row-actions` : Modifier/Matières/Suspendre partagent une hauteur fixe de 32px, parfaitement alignés verticalement.

## Partie I — Prestations : plusieurs matières, UX explicite

- `addServiceMaterial()` **fusionne désormais** une association déjà existante (même article + même étape) au lieu de créer un doublon silencieux — la ligne existante voit sa quantité mise à jour, avec un toast distinct (« Association déjà existante — quantité mise à jour »).
- Chaque ligne de matière porte désormais `[Modifier][Retirer]` — Modifier préremplit le formulaire « + Ajouter une matière » **sans fermer le panneau**, permettant plusieurs ajustements à la suite.
- `state.serviceMaterials` reste l'unique source de vérité (aucun nouveau store) — la colonne « Utilisé pour » de Stock reflète immédiatement toute nouvelle association ou tout retrait.

## Partie J — Utilisateurs : avatars et rôles colorés

- Colonne Prénom/Nom fusionnée en une seule colonne « Utilisateur » (avatar rond + initiales + nom complet + email en dessous) — plus lisible que deux colonnes séparées.
- Avatar : couleur existante de l'utilisateur si définie, sinon dérivée de manière déterministe de `user.id` (`userColor`, préexistant, jamais aléatoire — stable entre rendus). Taille desktop 36px, mobile 40-44px (`@media(max-width:600px)`).
- Le tri Nom/Prénom reste pleinement fonctionnel malgré la fusion visuelle : deux petits déclencheurs `data-usort` à l'intérieur du même en-tête (le sélecteur de clic est élargi de `th[data-usort]` à `[data-usort]`).

## Partie K — Rôles : mapping de couleurs unique

- Nouvel objet unique `ROLE_UI` (`RESPONSABLE`=bleu, `PRODUCTION`=vert, `STOCK`=orange, `ADMINISTRATIF`=violet, `LECTURE`=gris — rôles V10 réels) et helper `roleColorClass(roleId)` — plus aucune couleur dispersée dans les fonctions de rendu.
- Nouvelle classe `.pill.violet` (claire + sombre). La couleur n'est **jamais** seule : le libellé texte du rôle (`roleLabel`) reste toujours affiché à côté de la pastille.

## Tests et non-régression

- **45 nouveaux tests** ajoutés à la suite persistée (`?runTests=1`) : H01-H04, N01-N03, C01-C06, CH01-CH06, S01-S05, F01-F04, P01-P05, M01-M06, U01-U06.
- **2 tests V3.8.2 réécrits** (changement de comportement explicite du mandat, jamais un affaiblissement) : C01/C02 de la carte « Demandes & simulation », qui décrivaient l'ancien tableau à 8 colonnes — réécrits pour vérifier le nouveau design à 5 colonnes maximum et l'absence du formulaire permanent, avec les mêmes garde-fous moteur sous-jacents.
- 236 tests V3.8.2 strictement conservés (2 réécrits, documentés) + 45 nouveaux = **283/283 PASS**, exécutés dans un vrai navigateur (Chromium/Playwright).
- Isolation confirmée : `exportDentalFlowJSON()` (état canonique sérialisable) identique avant/après la suite complète.
- Responsive : 21/21 (7 viewports × 3 modes LAB/STAFF/DENTIST), 0 débordement horizontal, 0 erreur console. Thèmes : 18/18 (light/dark/system × 6 vues). `node --check` : 5/5 blocs `<script>` OK.

## Non-régression

Toutes les fonctionnalités V3.8.2 sont conservées inchangées : schéma V10, entité Cabinets, `orderTimeline()`, `moveOrderToStage()`, la traçabilité LocationEvents, le centre de notifications, `invoiceDocumentHTML()`/`downloadInvoicePDF()`, les garde-fous de permissions, le portail Cabinet, les 3 modes (Lab responsive/Collaborateur PWA/Dentiste desktop-first) — aucun n'a été affaibli.

## Hors périmètre

Aucun ajout de module majeur, aucune migration de schéma, aucun ajout de Supabase/Vercel/backend/Stripe/TVA-comptabilité réglementaire/CRM/email-SMS réel — conformément au mandat (« AUCUN AUTRE FEATURE CREEP »).
