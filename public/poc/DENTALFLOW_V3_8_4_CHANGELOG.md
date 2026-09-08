# DentalFlow Next V3.8.4 — Changelog

Base : `dentalflow-next-poc-v3.8.3.html` (283/283 PASS). Livrable : `dentalflow-next-poc-v3.8.4.html`. V3.8.3 n'a jamais été modifié.

Schéma : **V10 inchangé**. V3.8.4 est une mission de **simplification UX et de réparation de données** (7 points ciblés) — aucun nouveau module majeur, aucune migration de schéma, aucun ajout de page.

## Partie A — Factures : suppression de l'onglet Pointage

- L'onglet autonome « Pointage » disparaît. La page Factures ne conserve que **3 onglets** : À facturer / Factures / Prestations.
- Le pointage est intégré directement dans l'onglet Factures via une nouvelle barre de filtres compacte : Toutes / Brouillons / Émises / Envoyées / **À pointer** / **Réglées**.
- « À pointer » = facture `SENT` sans paiement enregistré (`invoiceStatusFilterMatch()`) → badge **À POINTER** + action `[Pointer]`. « Réglées » = facture `PAID` → badge **RÉGLÉE** + date de règlement si disponible (`invoicePaymentForInvoice()`).
- La recherche texte se combine avec le filtre de statut (les deux s'appliquent ensemble, jamais l'un sans l'autre).
- **Moteur jamais touché** : `recordInvoicePayment()`, `invoicePayments`, le statut `PAID`, `paidAt`, les références bancaires, les commentaires, le KPI Réglé et l'historique de paiement restent strictement identiques — seule la navigation UI change.
- Migration automatique : un état persisté avec `state.invoicesTab==='pointage'` est converti vers `'invoices'` à chaque démarrage (`ensureV34Model()`), sans erreur.

## Partie B — Prestations : barre de recherche réellement visible

- `renderInvoicesPage()` court-circuite désormais immédiatement vers `renderServicesTab()` quand l'onglet Prestations est actif — plus de KPI de chiffre d'affaires ni de barre de recherche générique Factures affichés au-dessus, qui reléguaient visuellement la vraie recherche Prestations hors de vue.
- Structure exacte : en-tête (« Prestations » + « + Nouvelle prestation ») → immédiatement `#services-search-input` (`servicesSearchBarHTML()`) → tableau. Moteur de recherche/tri inchangé (`filterServices()`/`filteredSortedServices()`, déjà existants — aucun doublon créé).

## Partie C — Accueil : 4 cartes KPI compactes

- Les 4 cartes (En production / À livrer aujourd'hui / En retard / Bloquées) passent de 144px à **~112px** de hauteur, contenu resserré (icône/nombre/libellé/sous-texte rapprochés, sans marge excessive).
- Icône déplacée dans un badge `.hkpi-ico` qui chevauche le haut de la carte (`top:-14px`), chevron `›` ajouté à droite, centré verticalement, signalant la cliquabilité.
- Sélecteur compound `.grid.home-kpis` (spécificité 0,2,0) utilisé pour la grille responsive — corrige un conflit de spécificité avec la règle générique préexistante `@media(max-width:860px){.kpis,.two-col,...}` qui neutralisait silencieusement l'ancien sélecteur `.home-kpis` seul.
- Mobile ≤600px : 2 cartes par ligne (jamais de texte tronqué) ; ≤390px : légère réduction de la taille du libellé/sous-texte.

## Partie D — Commandes : filtres réduits

- Boutons de filtre primaires réduits de 8 à **4** : Toutes / À surveiller / En retard / Bloquées.
- Nouveau contrôle `Statut : [Tous ▾]` (select) à droite : Tous / En production / Prêtes à livrer / Terminées / Annulées — se combine avec le filtre primaire (`filteredOrders()` applique les deux successivement).
- « + Nouvelle commande » reste la seule action primaire de l'en-tête de carte.

## Partie E — Commandes : couleurs d'état plus visibles

- Bordure gauche des 7 états portée de 5px à **6px**, intensité de fond renforcée (En retard ≈.17, Bloquée ≈.16, Nouvelle ≈.14, Prête ≈.14, Production ≈.11) — la pastille de statut (cellule État) partage la même famille de couleur (RETARD=rouge, BLOQUÉE=orange, NOUVELLE=bleu, PRÊTE=vert). Livrée/Terminée/Annulée restent nettement plus neutres.

## Partie F — Charge : Demandes et Simulation côte à côte

- `whatIfSectionHTML()` réécrite : une seule carte « Demandes & simulation », divisée visuellement en **deux colonnes** (`.chg-split`/`.chg-col`, `grid-template-columns:1fr 1fr` dès 1000px) — colonne gauche « Demandes de congés » (sous-titre « À valider », actions `[Inclure][Approuver][⋯]`), colonne droite « Simulation » (sous-titre « Hypothèses du scénario », actions directes `[Modifier][Supprimer]`, bouton `+ Ajouter une hypothèse`).
- Résumé « Impact du scénario » + « Voir le calendrier » reste en pied de carte, pleine largeur, sous les deux colonnes.
- Tablette/mobile (<1000px) : colonnes empilées verticalement (Demandes puis Simulation). Moteur `whatIfInclude`/`approveLeave` inchangé — une demande reste incluable dans la simulation sans être approuvée.

## Partie G — Stock : actions réduites

- Barre d'outils allégée : filtres visibles réduits à Tous / À surveiller / Stock faible + un select « État » (Dormants/Archivés déplacés dedans).
- Actions réduites à 3 : **« + Nouvel article »** (primaire) + **« Réceptionner ▾ »** (fusionne Entrée manuelle/Scanner via le composant générique `.row-menu` déjà établi en V3.8.3) + **« ⋯ »** (Importer des articles). Chaque déclencheur garde son attribut `data-*` d'origine (`data-panel="stockManual"`/`data-open-stock-scan`/`data-open-import="articles"`) — seul l'emplacement visuel change, le moteur est intact.

## Partie H — Cabinets : réparation P0 des états déjà persistés

- **Bug corrigé** : `migrateV9toV10()` ne s'exécutait que lors de la transition de schéma V9→V10 — un état déjà persisté en `schemaVersion=10` avec `state.cabinets=[]` (bug antérieur, restauration partielle, export/import ancien) ne passait plus jamais par cette construction, laissant la page Cabinets vide indéfiniment malgré des commandes/dentistes/factures référençant déjà des cabinets par nom.
- Nouvelle fonction `repairCabinetsV10(state)`, **appelée inconditionnellement à chaque démarrage** (`ensureV34Model()`, même schéma que `repairLegacyTraceabilityV9`) : reconstruit les cabinets manquants depuis les noms réels utilisés (`orders[].cabinet`, `dentists[].cabinet`, `invoices[].cabinet`/`cabinetSnapshot.name`, `conversations[].cabinetId` quand résolvable).
- **Garde-fou §51** : `conversation.cabinetId` peut historiquement contenir un nom de cabinet plutôt qu'un id réel — un `conversation.cabinetId` qui ressemble à un id (`/^CAB-/`) mais ne correspond à aucun cabinet existant est ignoré, jamais utilisé comme nom (aucun cabinet « CAB-XXXX » n'est jamais créé par erreur).
- **Jamais d'écrasement** : id, statut `ARCHIVED`, adresse, email, téléphone, SIRET, email de facturation ou toute donnée déjà saisie manuellement sur un cabinet existant ne sont jamais modifiés — seuls les cabinets manquants sont créés (statut `ACTIVE`), et les `cabinetId` manquants sont rétro-remplis sur orders/dentists/invoices.
- Idempotente : `save()` appelé une seule fois si `repairCabinetsV10()` a réellement changé l'état, aucune écriture inutile sinon.

## Tests et non-régression

- **14 nouveaux tests** ajoutés à la suite persistée (`?runTests=1`) : CAB08-CAB12 (réparation Cabinets P0, scénarios §56-59 et §51), I01-I03 (Factures : plus d'onglet Pointage, pointage fonctionnel de bout en bout, migration `invoicesTab`), J01-J06 (vérifications visuelles réelles à 1440px : KPI Accueil, filtres Commandes, distinction des couleurs d'état, toolbar Stock, colonnes Charge côte à côte, recherche Prestations visible après navigation directe).
- **2 tests V3.8.3 réécrits** (changement de comportement explicite du mandat, jamais un affaiblissement) : C02 (bordure 5px→6px), et les tests de structure de la carte Charge (5 colonnes → `.chg-split`/2×`.chg-col`) — mêmes garde-fous moteur sous-jacents vérifiés à l'identique (`approveLeave`, `chargeRowImpact`, `whatIfLeaves`, `recordInvoicePayment`).
- 283 tests V3.8.3 strictement conservés (2 réécrits, documentés) + 14 nouveaux = **297/297 PASS**, exécutés dans un vrai navigateur (Chromium/Playwright), deux exécutions consécutives sans flakiness introduite.
- Isolation confirmée : `exportDentalFlowJSON()` identique avant/après la suite complète (111 061 caractères, avant = après).
- Responsive : 21/21 (7 viewports × 3 modes LAB/STAFF/DENTIST), 0 débordement horizontal, 0 erreur console. Thèmes : 18/18 (light/dark/system × 6 vues). `node --check` : 5/5 blocs `<script>` OK.

## Non-régression

Toutes les fonctionnalités V3.8.3 sont conservées inchangées : schéma V10, entité Cabinets, `orderTimeline()`, `moveOrderToStage()`, la traçabilité LocationEvents, le centre de notifications, `invoiceDocumentHTML()`/`downloadInvoicePDF()`, les garde-fous de permissions, le portail Cabinet, les 3 modes (Lab responsive/Collaborateur PWA/Dentiste desktop-first) — aucun n'a été affaibli.

## Hors périmètre

Aucun ajout de module majeur, aucune migration de schéma, aucune nouvelle page, aucun ajout de Supabase/backend — conformément au mandat (« Ne rien ajouter d'autre. Cette version simplifie et répare. »).
