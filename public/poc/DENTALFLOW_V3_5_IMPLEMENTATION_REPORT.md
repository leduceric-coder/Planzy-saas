# DentalFlow Next V3.5 — Rapport d'implémentation

## Cadrage

V3.5 est une évolution UX/navigation, pas une refonte moteur. Aucune formule métier, règle de viabilité fournisseur, migration V5→V6 ou logique de persistance n'a été modifiée. Le principe directeur : **la complexité reste dans le moteur, l'interface ne montre que ce qui aide à décider.**

---

## A. Nouvelle navigation

Le groupe « Outils » ne contient plus que 4 entrées : **Plan de charge**, **Stocks & achats**, **Rapports**, **Utilisateurs**. Les anciennes entrées autonomes **Achats** et **Journal** ont été supprimées de `installOverrides()` — elles n'ajoutent plus `NAV_ITEMS.purchases`/`NAV_ITEMS.activity` ni ne les épinglent dans `TOOLS_NAV`.

**Compatibilité des anciennes routes** : le `render()` surchargé normalise `state.view` avant tout routage :

```js
render = function(){
  if(state.view==='purchases'){state.view='stock';state.supplyTab='todo'}
  if(state.view==='activity'){state.view='reports';state.reportsTab='journal'}
  if(state.view==='stock')renderStockSupply();
  else if(state.view==='reports')renderReportsV35();
  else oldRender();
  ...
}
```

Un lien externe, un state persisté avant V3.5, ou un paramètre `?view=purchases` sont donc redirigés silencieusement vers l'équivalent V3.5 — jamais d'écran vide ni d'erreur (§83-84 du mandat, tests #50-51).

---

## B. Accordéon « Outils » — cause racine et correction

### Le bug

```js
// AVANT (V3.4.x) :
const open = !!state.toolsOpen || toolsActive();
```

`toolsActive()` (vrai dès que la page courante appartient au groupe) écrasait toute fermeture explicite : sur une page Outils, fermer le groupe mettait `state.toolsOpen=false`, mais au `render()` suivant `open` redevenait `true` car `toolsActive()` restait vrai. Le groupe semblait impossible à replier.

### La correction

`state.toolsOpen` est désormais l'**unique** source de vérité :

```js
// APRÈS (V3.5) :
const open = !!state.toolsOpen;
const childActive = toolsActive(); // sert uniquement à un indicateur discret, jamais à forcer l'ouverture
```

Le clic sur le bouton bascule strictement `state.toolsOpen = !state.toolsOpen` (plus de `||toolsActive()` dans le toggle non plus). Une **ouverture automatique raisonnable** est conservée : toute navigation vers une page Outils déclenchée depuis l'extérieur du groupe (bouton, lien, KPI…) met `state.toolsOpen=true`, mais seulement à cet instant précis — jamais reforcée à chaque `render()` (§10 du mandat). Testé (#47) : ouvrir → fermer alors que la page active appartient à Outils → `renderNav()` supplémentaire → reste fermé.

**Accessibilité** : `aria-expanded` reflète l'état réel, `aria-controls="nav-tools"`, élément `<button>` natif (Enter/Espace fonctionnent nativement). **Visuel** : chevron `›` tournant à 90° à l'ouverture (au lieu du triangle `▾` à 180° précédent, qui ne rendait pas visuellement un vrai chevron droite→bas) ; sous-entrées indentées avec un trait vertical discret et une graisse/taille secondaires ; un indicateur discret (`child-active`, couleur accent) apparaît sur le bouton fermé quand une page enfant est sélectionnée, sans jamais forcer l'ouverture (§13).

---

## C. Fusion Stocks & Achats

Une seule vue `renderStockSupply()` à 4 onglets (`state.supplyTab`, défaut `'todo'`) :

- **À traiter** (`renderSupplyTodoTab`) — filtre `state.purchaseProposals` sur `PROPOSAL_OPEN` et `recommendedAction!=='NO_ACTION'`, trie ORDER_NOW → WAIT → BLOCKED, éclate chaque proposition en cartes **par article** (une carte = une ligne de proposition ; l'action/le prix/l'explication viennent de la proposition parente, jamais recalculés). Le code moteur (`ORDER_NOW`/`WAIT`/`BLOCKED`) n'apparaît jamais à l'écran : `actionLabel()` traduit en « Commander aujourd'hui »/« Attendre »/« Action nécessaire ».
- **Stock** (`renderSupplyStockTab`) — reprise fidèle de l'ancien onglet Articles (mêmes filtres Tous/À surveiller/Stock faible/Dormants, mêmes calculs `physicalStock`/`availableStock`/`incomingStock`).
- **Commandes** (`renderSupplyOrdersTab`) — liste des `PurchaseOrder`, statuts traduits (`poStatusLabel()` : Commandée/Confirmée/Expédiée/Partiellement reçue/Reçue/Annulée), montant ajouté au premier niveau.
- **Fournisseurs** (`renderSupplySuppliersTab`) — nouvelle gestion complète (voir D).

**Panneau « Pourquoi ? »** (`renderProposalDetail`, réécrit) : c'est le SEUL endroit où la complexité est révélée — stock physique/réservé/disponible/entrant/projeté par ligne, franco, minimum fournisseur, fournisseur préféré vs recommandé, explications SupplierEngine. Toutes les valeurs affichées proviennent de champs déjà calculés par `reconcileProposals()`/`decideProposal()`/`proposalTotals()` (`physicalStock()`, `reservedStock()`, `availableStock()`, `incomingStock()` appelés en lecture seule) — **aucun recalcul métier parallèle dans le rendu** (testé #59).

---

## D. Gestion fournisseurs

### Modèle

Champs existants conservés (`id, name, leadTimeDays, freeShippingThreshold, shippingCost, minimumOrder, notes, active`), complétés par `contactName, email, phone, website` — optionnels, stockés directement dans `state.suppliers` (déjà persisté), **aucun second store créé** (§77). Les fournisseurs V3.4.5 existants n'ont simplement pas ces champs tant qu'ils ne sont pas modifiés (`undefined`, traité comme `'—'` à l'affichage) — aucune migration nécessaire (§78).

### Actions

- **Création/modification** (`submitSupplierForm`) — validations : `name` non vide, `leadTimeDays/shippingCost/minimumOrder ≥ 0`, franco vide → `null` explicite (jamais `0`, distinction stricte « aucun franco » vs « franco à 0 € », §40). Génère un ID générique (`nextSupplierId()` → `SUP-001`, `SUP-002`…, jamais un nom de fournisseur codé en dur, §41). Crée un `ActivityEvent` (« Fournisseur créé »/« Fournisseur modifié »), appelle `reconcileProposals(state)` puis `save()`.
- **Suspension/réactivation** (`setSupplierActive(id, active)`) — bascule `supplier.active`, jamais de suppression. `tariffsForArticle()` (moteur, inchangée) filtre déjà `supplier.active!==false` : un fournisseur suspendu cesse immédiatement d'être candidat aux nouvelles recommandations sans qu'aucune ligne d'engine ait été touchée. Ses `PurchaseOrder` passées restent lisibles telles quelles (testé #54-55).
- **Aucun bouton Supprimer** — un fournisseur peut être référencé par des `PurchaseOrder`, des propositions historiques ou des `ActivityEvent` ; le supprimer casserait l'historique (§36). Vérifié structurellement absent du HTML (test #56).

### Tarifs

`submitTariffForm` permet de consulter, modifier et ajouter un `ArticleSupplier`. Réutilise **exactement** la même règle que l'import de tarifs déjà existant (`applyImportRows`) : passer un tarif à `preferred=true` retire automatiquement `preferred` des autres tarifs actifs du même article (`filter(...).forEach(x=>{x.preferred=false})`) — aucune nouvelle règle métier inventée, simple réapplication de l'invariant déjà validé (test #57).

---

## E. Rapports / Journal

`renderReportsV35()` — deux onglets : **Indicateurs** (KPI + graphique de production, code inchangé, extrait de l'ancien `renderReports()`) et **Journal** (`renderJournalTab`, déplacé tel quel depuis l'ancien `renderActivity()` — mêmes filtres Toutes/Erreurs/Alertes/Automatisations/Actions, même lecture directe de `state.activityEvents`). **Un seul journal logique** (§49) : le nouvel onglet Journal ne crée aucun store, ne duplique aucun événement — c'est la même source que l'ancienne page autonome, seulement redéplacée sous Rapports. L'ancien tableau d'audit historique (`auditEvents()`/`renderAuditWrap()`, basé sur `scanEvents`/`historyEvents`/`seedAuditLog`, déjà adapté vers `activityEvents` via l'override `auditEventsV34` depuis la V3.4.2) reste utilisé tel quel dans l'onglet Indicateurs pour les statistiques (scans, blocages, livraisons) — code non dupliqué, non réécrit.

---

## F. Données — Import/Export simplifié

`renderDataWizard()` dispatche désormais sur `state.dataScreen` (`'home'|'import'|'export'`, défaut `'home'`) :

- **Accueil** (`renderDataHomeScreen`) — uniquement « Importer des données » / « Exporter des données », plus un lien discret « Options avancées » révélant (accordéon) l'export/restauration JSON complet avec l'avertissement requis avant restauration (§68-69).
- **Import** (`renderImportScreen`) — même moteur qu'avant (`parseCSV`, `ensureImportMapping`, `validateImportRows`, `applyImportRows`, `ImportJob`/`ImportError` — **rien réécrit**, §64), présentation redécoupée en 6 étapes nommées Type/Fichier/Correspondances/Aperçu/Vérification/Résultat, une seule action primaire par étape. L'étape Correspondances n'affiche plus systématiquement une forêt de selects : si tout est reconnu, un message de confirmation compact suffit (« Vérifier les correspondances » en secondaire) ; si des champs obligatoires manquent, seules les colonnes problématiques s'affichent par défaut (« Afficher toutes les correspondances » en secondaire) — `Continuer` reste bloqué tant qu'elles ne sont pas résolues (testé #64-65).
- **Export** (`renderExportScreen`) — les 7 catégories métier existantes (`commandes/production/stocks/articles/fournisseurs/achats/tracabilite`) présentées en cartes icône+nom+description+bouton, JSON absent de cet écran (testé #66).

À aucun moment l'utilisateur ne voit simultanément les boutons Import + 7 exports CSV + JSON + mapping (§70) : chaque écran masque ce qui n'est pas utile à l'instant présent.

---

## G. Ce qui n'a pas changé

| Composant | État |
|---|---|
| `StockEngine` (`physicalStock`, `availableStock`, `reservedStock`, `projectedStock`, `coverageDays`) | Inchangé |
| `DemandEngine` (`knownDemand`, `baselineDemand`, `expectedDemand`) | Inchangé |
| `SupplierEngine` (`evaluateSupplierCandidate`, `chooseSupplier`, `tariffsForArticle`, `preferredTariff`) | Inchangé |
| `ProposalEngine` (`computeNeeds`, `decideProposal`, `reconcileProposals`, `approveProposal`) | Inchangé |
| Migration V5→V6 (`migrateStockArrayToV6`, `ensureV34Model`) | Inchangé |
| Persistance (`save`/`load`, `serializableState`) | Inchangée |
| `receivePurchaseOrder` (garde-fous statut + quantité) | Inchangé, appelé tel quel depuis `renderPODetail` |
| Confidentialité patient (`patientRef` opaque, `isForbiddenColumn`) | Inchangée |

Aucune signature de fonction moteur publique n'a changé. La dette d'architecture `seed()`/`seedV6()` (notée en V3.4.5) reste hors périmètre.
