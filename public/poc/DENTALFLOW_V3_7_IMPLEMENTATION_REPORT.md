# DentalFlow Next V3.7 — Rapport d'implémentation

Base : `dentalflow-next-poc-v3.6.2.html`. Livrable : `dentalflow-next-poc-v3.7.html`. Mission de fond (nouvelle base + refontes), pas un hotfix.

## Partie A — Schéma V8 et seed natif

### Clé de stockage et versionnage

`STORAGE_KEY` passe de `'dentalflow-next-mockup-state-v4'` à `'dentalflow-next-poc-state-v8'` ; `V34_SCHEMA_VERSION` passe de 7 à 8. Comme `load()` (script de base) lit directement `STORAGE_KEY`, ce changement de clé physique suffit à garantir qu'un navigateur ayant déjà utilisé V3.6.2 ne voit rien de persisté sous la nouvelle clé — le premier chargement V3.7 déclenche systématiquement `state.__noPersistedState=true`, qui route vers le nouveau seed natif.

### `seedV8()` — un seul seed, directement complet

`ensureV34Model()` (point d'entrée du boot, appelé une fois `installOverrides()` posé) routait auparavant, en l'absence d'état persisté, vers `seedV6()` (reconstruction des stores V6 depuis `DEMO_*`) puis `seedV7Extras()` = `migrateV6toV7(state)` + `seedV7Scenarios()` (10 commandes A-J ajoutées PAR-DESSUS l'état déjà migré). Ce chemin part in fine de `state.orders` déjà rempli par le très ancien tableau `demoOrders` (chargé par `seed()`, script de base, avant même que l'IIFE ne s'exécute).

`seedV8()` remplace ce chemin entier par une reconstruction directe et unique : `state.orders=[]` puis 23 commandes construites via `buildOrderFromInput()` (qui garantit `priceSnapshot` + tous les champs V7 dès que `serviceId` est fourni — jamais de commande de démo avec patient ou tarif vide), post-traitées selon le scénario voulu (scans réels via `consumeForScan`, reprise via `createRework`, annulation via `cancelOrder`/`confirmCancelWithReturn`, facturation via `createInvoice`/`issueInvoice`/`sendInvoiceToCabinet`/`recordInvoicePayment`). Les anciennes fonctions (`seed()`, `seedV6()`, `seedV7Scenarios()`, `resetDemoV6()`) restent intactes dans le fichier : de nombreux tests V3.4-V3.6.2 déjà existants les appellent explicitement comme baseline connue pour leurs propres assertions — les supprimer aurait cassé des dizaines de tests sans rapport avec cette mission. Elles ne sont simplement plus jamais invoquées par le chemin de démarrage normal ni par le bouton « Réinitialiser les données démo » (qui appelle désormais `resetDemoV8()`).

### Piège rencontré : appeler des fonctions UI pendant le seed

`confirmCancelWithReturn()` (réutilisée pour les scénarios 16/17 par souci de réalisme — retour effectué via le VRAI moteur, pas une écriture directe de mouvement) se termine normalement par `closeSidePanel();render();openQuickView(orderId);showToast(...)`. Appelée pendant `seedV8()`, ces effets de bord UI sont non seulement inutiles mais dangereux : en mode `staff`/`scan`/`dentist`, `document.body.innerHTML` a déjà été intégralement remplacé par le rendu du mode AVANT que `ensureV34Model()`/`seedV8()` ne s'exécute — `#quick-layer`/`#side-layer` n'existent alors plus du tout dans le DOM, provoquant un crash (`Cannot read properties of null`). Corrigé par un paramètre `opts.silentUI` sur `confirmCancelWithReturn()` (même convention que `reconcileProposals(state,{silent:true})` déjà existante) : le comportement par défaut (omis) reste strictement identique pour tous les appels existants ; `seedV8()` l'utilise pour n'avoir aucun effet de bord d'interface.

## Partie B — Filtres Commandes

`orderMatchesFilter()` : le cas `'all'` devient `!isOrderCancelled(o)` (au lieu de `true`), et un nouveau cas `'cancelled'` est ajouté. `isOrderLate()`/`isOrderBlocked()` excluent désormais explicitement les commandes annulées ET livrées — un flag resté vrai avant l'annulation ne doit plus jamais gonfler les compteurs « En retard »/« Bloquées » d'une commande sortie du cycle actif. Comme `render()` dérive systématiquement tout depuis `state` à chaque appel (aucun état intermédiaire mis en cache), la disparition immédiate de « Toutes actives » et l'apparition dans « Annulées » sont garanties par construction, sans code de synchronisation supplémentaire.

## Partie C — Restitution différée

`orderHasReturnableMaterial(orderId)` (nouveau) : vrai si au moins un article consommé par la commande a un solde `returnableQtyForOrderArticle()>0`. Affiché sur la fiche d'une commande annulée avec un bouton « Restituer au stock » → `openReturnMoreFlow()`, qui réutilise **exactement** le même panneau (`renderCancelFormPanel`/`#cancel-order-form`) que le premier retour — `openCancelFlow()` reste volontairement bloqué sur une commande déjà annulée (comportement V3.6.1/V3.6.2 inchangé, l'interface de premier retour n'est pas retouchée), `openReturnMoreFlow()` ouvre directement le side-panel sans repasser par ce garde-fou.

## Partie D — CA Accueil

`computeRevenueKPIs()` était déjà entièrement dynamique en V3.6.1/V3.6.2 (aucune modification nécessaire) — seule la carte « Réglé » a été retirée de `renderHome()`. Le pointage reste consultable dans Factures/Pointage.

## Partie E — Comparaison hebdomadaire réelle

`computeWeeklyCompare()` (nouveau, remplace l'usage de la constante `weeklyCompare`) : pour chaque commande dont `productionCompletedAt` est renseigné, calcule le jour (Lundi=0…Dimanche=6) relatif au lundi de la semaine courante et au lundi de la semaine précédente (`mondayOfWeek()`), et incrémente le bucket correspondant. `productionCompletedAt` est un champ nouveau, jamais réécrit une fois posé : `markOrderReadyIfLastStage()` (appelée depuis le wrapper `recordScan` déjà existant dans `installOverrides()`) le fige au tout premier passage réel à la dernière étape active du flux — avant V3.7, aucune commande n'atteignait jamais réellement ce statut au runtime (seul le seed statique pré-remplissait `status:'ready'` sur quelques commandes de démo). `renderCompareBars()` appelle désormais `computeWeeklyCompare()` au lieu de lire la constante statique.

## Partie F — Traçabilité

`orderTimeline(orderId)` (nouveau, script de base) dérive chronologiquement : `physicalImpressionReceivedAt`/`trackingSheetFirstPrintedAt`/`productionCompletedAt` (champs déjà présents sur `order`), `historyEvents` (déjà alimentés par `logAudit` à chaque action réelle — Création/Reprise/Annulation/Facture/…), `scanEvents` (un événement par poste réellement scanné, acteur réel), et les `StockMovements` RETURN liés à la commande. Chaque événement porte `fmtEventDateShort()` (date+heure réelles) — corrige le bug identifié dans `renderTracePanel()` V3.6.2, qui affichait littéralement `Aujourd'hui ${fmtTime(...)}` pour un scan vieux de plusieurs jours. La fiche commande conserve la mini-carte « Dernier scan » et ajoute une section « Traçabilité » (4-5 derniers événements) avec un lien « Voir toute la traçabilité » ouvrant le panneau complet.

**Piège cross-script rencontré** : `orderTimeline` (script de base) et l'extension de `_renderQuickView` (script de base) appellent `articleLabel()`/`consumedMaterialByArticle()`/`returnableQtyForOrderArticle()`/`orderHasReturnableMaterial()`, qui sont des fonctions **privées à l'IIFE** (`<script id="dentalflow-v34-implementation">`, chargée après le script de base — un identifiant qui n'y est déclaré nulle part ailleurs qu'à l'intérieur de cette closure lève `ReferenceError` pour tout code du script de base). Corrigé en exposant explicitement ces 4 fonctions sur `window` depuis `installOverrides()` (`window.articleLabel=articleLabel;…`) — direction unique et documentée dans le code, jamais l'inverse (le script de base reste toujours librement appelable depuis l'IIFE).

## Partie G/H — Stock manuel, fabricants, cycle de vie article

`receiveStockManual(data, actingUserId)` : construit un `StockLot` (si un numéro de lot est fourni) puis un `StockMovement` RECEIPT — jamais de quantité stockée indépendamment sur l'article ou le lot (même invariant que le scan GS1/DataMatrix). Garde-fou moteur : nécessite `stock.adjust` ou `stock.manage`.

`articleStatus(a)`/`articleIsActive(a)`/`setArticleStatus(articleId, newStatus)` : cycle ACTIVE→SUSPENDED/ARCHIVED/CLOSED, ARCHIVED→ACTIVE (restauration), toute étape→CLOSED (définitif, `CLOSED_IS_FINAL` refusé pour toute transition ultérieure). `computeNeeds()` filtre désormais sur `articleIsActive(a)` (au lieu de `a.active!==false`) : un article SUSPENDED ou ARCHIVED ne génère plus jamais de nouvelle proposition d'achat automatique, sans jamais toucher son historique de mouvements. `state.manufacturers` (nouveau store, distinct de `state.suppliers`) : un article référence `manufacturerId`, affiché partout où l'article est listé.

## Partie I — Article ↔ Prestation

`state.serviceMaterials` (nouveau store) remplace la constante applicative `BILL_OF_MATERIALS` — `{serviceId, articleId, qty, consumeAtStageId}`. `serviceKeyForOrder(o)` résout, dans l'ordre : `o.serviceId` réel si connu, sinon un service dont le **label** correspond à `o.type` (rétrocompatibilité avec les commandes/fixtures qui ne portent que `type`, notamment de nombreux tests V3.4-V3.6.2 déjà existants), sinon `o.type` littéral (repli pour un type synthétique sans prestation cataloguée, ex. fixtures T139-T143 V3.6.2). `knownDemand()`/`consumeForScan()` appellent `serviceMaterialsForOrder(o)` au lieu de lire `BILL_OF_MATERIALS[o.type]` directement. `addServiceMaterial()`/`removeServiceMaterial()` sont la SEULE voie de mutation de cette relation, utilisée à l'identique depuis la fiche article (`renderArticleServicesPanel`) et depuis la fiche prestation (`renderServiceArticlesPanel`) — une seule source de vérité, comme demandé.

**Piège de migration rencontré** : les tests T139-T143 (V3.6.2) injectaient directement `BILL_OF_MATERIALS[type]=[...]` comme fixture — remplacé par des lignes poussées dans `state.serviceMaterials` avec `serviceId:type` (même clé littérale qu'avant, cohérent avec le repli de `serviceKeyForOrder`). Plusieurs tests plus anciens (V3.4/V3.5, ex. « Consommation au double scan idempotente ») construisent des commandes avec `type:'Couronne zircone'`/`'Bridge 3 éléments'` SANS `serviceId` — la première version de `serviceKeyForOrder` (repli direct sur le type littéral) les cassait car `DEMO_SERVICE_MATERIALS` est keyé par `serviceId` réel (`SVC-001`, pas le label). Corrigé par la résolution en 3 étapes décrite plus haut : elle satisfait simultanément les commandes réelles (serviceId), les anciens tests (repli par label), et les fixtures synthétiques (repli par type littéral).

## Partie J — Prestations

Table compacte (Prestation/Catégorie/Tarification/Prix/Matières/Statut/Actions) remplaçant la liste `.lab-user-row`. Bouton principal « + Nouvelle prestation » bien visible. La création (`renderServiceFormPanel`/`submitServiceForm`, V3.6 inchangés) fonctionnait déjà réellement ; seule l'ajout du bouton « Matières » (ouvrant `renderServiceArticlesPanel`, Partie I) est nouveau.

## Partie K — Facturation / Pointage

Nouvel onglet « Pointage » (`renderPointageTab`) listant les factures ENVOYÉES non pointées + les pointages récents. `recordInvoicePayment(invoiceId, data, actingUserId)` : crée une entrée `state.invoicePayments` (append-only, jamais réécrite/supprimée), passe la facture en `PAID`. Pour le POC, un pointage correspond toujours au règlement intégral (montant non éditable dans le formulaire — seules la date et une référence/le commentaire le sont). Garde-fou moteur : nécessite `billing.point`. Le bouton « Marquer réglée » de l'onglet Factures ouvre désormais ce panneau plutôt que d'appeler `markInvoicePaid()` directement.

## Partie L — Plan de charge en €

`weekBillableValue(weekIndex)` (nouveau) : somme `orderBillableTotal(o)` des commandes NON annulées dont `orderDueDateCanonical(o)` tombe dans la semaine — jamais dérivée du carnet synthétique `ORDER_BOOK` (qui mélange charge réelle et remplissage aléatoire pour la vue en nombre de commandes, conservée telle quelle par ailleurs, le mandat demandant explicitement de la garder). Une commande annulée contribue structurellement 0€ (filtrée en amont) ; une reprise tarifée est incluse via `orderBillableTotal()` (qui ajoute déjà les `priceAdjustment` des reprises, V3.6 inchangé). Colonne ajoutée à la table de projection 8 semaines et à la popup de détail semaine.

## Partie M — Droits utilisateurs

`PERMISSIONS_LIST` (19 permissions), `ROLE_DEFS`/`ROLE_PERMISSIONS` (5 rôles canoniques avec permissions par défaut), `can(user, permission)` (garde-fou moteur unique). `userPermissions(user)` : utilise `user.permissions` s'il est explicitement défini (jamais recalculé depuis le rôle après création — un ajustement manuel n'est jamais silencieusement écrasé), sinon retombe sur les défauts du rôle (rétrocompatibilité pour un profil sans ce champ). Chaque utilisateur du seed a un `roleId` distinct de son `role` texte libre existant (poste/périmètre, ex. « Prothésiste CFAO », inchangé). Guards ajoutés sur les 2 fonctions nouvellement introduites (`receiveStockManual` → `stock.adjust`, `recordInvoicePayment` → `billing.point`) — testés au niveau moteur (§82) : un utilisateur PRODUCTION ne peut pas pointer une facture, un utilisateur STOCK peut ajuster le stock, un utilisateur PRODUCTION ne peut pas non plus. Documenté explicitement dans le changelog : simulation fonctionnelle POC, pas une sécurité serveur réelle (même limite déjà documentée pour `state.cabinetPatients` en V3.6).

## UX Mobile — Priorité P0

### Navigation

Header sticky (`#mobile-topbar`, visible ≤860px) + drawer (`#mobile-drawer-overlay`/`#mobile-drawer`). `renderNav()` alimente **la même** structure `PRIMARY_NAV`/`TOOLS_NAV`/`navItemHTML()` à la fois dans `#side-nav` (desktop) et `#mobile-side-nav` (drawer) — jamais une seconde liste hardcodée. Le pied du drawer réutilise `userMenuInnerHTML()` (thème, « voir comme cabinet », réinitialisation démo…), déjà cliquable via la délégation d'événements globale existante quel que soit le conteneur DOM. Fermeture par croix, clic sur l'overlay, Échap, ou navigation réelle (jamais sur le simple bouton Outils qui ne fait que déplier/replier) ; scroll du body verrouillé (`html.mobile-nav-open{overflow:hidden}`) pendant l'ouverture.

**Piège CSS rencontré** : la première version plaçait la règle `.mobile-topbar{display:none}` (par défaut) APRÈS la règle `@media(max-width:860px){...display:flex...}` dans le texte de la feuille de style — à spécificité égale, la cascade CSS départage par ordre d'apparition, donc la règle non conditionnelle, plus tardive dans le fichier, l'emportait TOUJOURS, quel que soit le viewport. Corrigé en plaçant le `display:none` par défaut avant toute media query qui le concerne.

### Production mobile

`renderProduction()` génère désormais AUSSI un accordéon vertical (`.prod-board-mobile`, visible uniquement ≤600px, le board desktop à colonnes restant cependant présent et inchangé ≥601px) — une section par poste, avec compteur, dépliable au tap (`state.prodMobileOpenStage`, une seule étape ouverte à la fois). Les deux mises en page réutilisent **la même** fonction `prodCardHTML(o)`, désormais enrichie pour afficher aussi le patient et les dents concernées (information manquante même sur desktop avant V3.7) — aucune information retirée pour « faire tenir » sur petit écran, seule la mise en page change.

### Commandes mobile

`renderOrderCards(rows)` (nouveau) génère une liste de cartes (`.orders-cards`, visible ≤600px) réutilisant les mêmes données que `renderTable()` — la table (`.orders-table-wrap`, désormais nommée distinctement des autres tables du produit pour ne masquer qu'elle et pas, par exemple, celles de Stock/Factures) reste le rendu ≥601px.

## Tests

154 tests (134 V3.6.2 conservés + 9 V3.6.2 T135-T146 + 11 nouveaux V3.7) — voir `DENTALFLOW_V3_7_TEST_REPORT.md` pour le détail avec valeurs réelles.
