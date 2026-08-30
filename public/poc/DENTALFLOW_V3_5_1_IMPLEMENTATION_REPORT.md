# DentalFlow Next V3.5.1 — Rapport d'implémentation

## Cadrage

V3.5.1 est un hotfix UX ciblé sur 6 problèmes identifiés par un audit indépendant de la V3.5, plus un lot de corrections de finition (stabilité visuelle, espacement, filtres, libellés). Aucun moteur (`StockEngine`, `DemandEngine`, `SupplierEngine`, `ProposalEngine`, `approveProposal()`, `landedCost()`, `reconcileProposals()`, `receivePurchaseOrder()`) n'a été modifié. La gestion fournisseurs, l'accordéon Outils et la nouvelle architecture Import/Export V3.5 sont restées intactes, conformément au périmètre imposé.

---

## 1. Une carte « À traiter » = une PurchaseProposal

### Le problème

`renderSupplyTodoTab()` construisait une carte **par ligne de proposition** (`todoCardHTML(p, l)`), alors que le bouton « Commander » appelle `approveProposal(p.id)` qui valide la **proposition entière** — toutes ses lignes, pour son montant total. Une carte affichant un article à 60 € pouvait ainsi, au clic, créer une commande de 680 €.

### La correction

`todoCardHTML(p)` prend désormais **uniquement la proposition** en paramètre. Une seule carte est générée par `PurchaseProposal` ouverte :

```js
const cards = todoOpenProposals().map(todoCardHTML); // une carte par proposition, plus jamais par ligne
```

Le montant affiché et celui du bouton (`Commander ${money(p.total||0)}`) sont **exactement** `p.total` — le champ que `approveProposal()` copie tel quel dans `po.total` lors de la création de la commande (`total:p.total` dans `approveProposal()`, code moteur inchangé). Il n'existe donc structurellement aucune possibilité que le montant affiché diverge du montant réellement engagé : les deux lisent le même champ.

Les articles sont listés de façon compacte à l'intérieur de la carte (5 lignes maximum, `+ N autres articles` au-delà), sans jamais devenir un tableau — la complexité détaillée reste réservée au panneau « Pourquoi ? ».

## 2. Article réellement déclencheur de l'urgence

Avant ce hotfix, l'ancienne carte par ligne affichait implicitement le statut de la proposition (`ORDER_NOW`) comme si chaque article était individuellement urgent. Ce n'est plus le cas : dans la nouvelle carte, seule la ou les lignes dont la **propre** `lastSafeOrderAt` (champ déjà calculé par `reconcileProposals()`, jamais recalculé ici) est dépassée reçoivent le tag « Urgent » :

```js
const isUrgentLine = l => p.recommendedAction==='ORDER_NOW' && l.lastSafeOrderAt && today() >= new Date(l.lastSafeOrderAt);
```

Le garde `p.recommendedAction==='ORDER_NOW'` garantit qu'une proposition WAIT ou BLOCKED n'affiche jamais de tag Urgent, même si une ligne interne a une échéance proche — évitant toute fausse alerte article-par-article sur une proposition qui n'en nécessite pas.

## 3. `renderStockSupply()` — pur render, aucune mutation métier

### Le problème

`renderStockSupply()` appelait `reconcileProposals(state)` en tout début de fonction. Chaque simple affichage de la page « Stocks & achats » recalculait donc les propositions et pouvait journaliser un `ActivityEvent` « Recommandations recalculées » — une page qui se contente d'être affichée modifiait l'état métier.

### La correction

L'appel a été retiré :

```js
function renderStockSupply(){
  rebuildLegacyStockView(); // lecture — reconstruit la vue stock legacy, ne mute pas les propositions
  setPageMeta(...);
  ...
}
```

`reconcileProposals()` reste appelé **exclusivement** après une vraie mutation métier, aux points qui l'appelaient déjà avant ce hotfix (aucun nouveau point ajouté, aucun retiré) : création/modification/suspension/réactivation fournisseur, ajout/modification de tarif, import de données, ajustement de stock, réception, création/annulation de commande, `approveProposal()`, réinitialisation de la démo, et le démarrage/la migration (`ensureV34Model()`, conditionné à un premier chargement V5). Un état déjà persisté (V6, cas normal d'un utilisateur qui revient) est chargé tel quel — il a été réconcilié et sauvegardé à la fin de la session précédente, donc déjà cohérent, sans qu'un nouveau recalcul soit nécessaire au simple affichage.

Vérifié par test direct : 5 appels consécutifs à `renderStockSupply()` laissent `state.activityEvents.length` strictement inchangé ; après une vraie mutation (tarif modifié), le recalcul fonctionne normalement et 5 renders supplémentaires ne journalisent toujours rien de plus.

## 4. Journal — recherche, période, pagination

Le Journal (onglet de Rapports, inchangé dans sa localisation) gagne trois capacités, toutes lisant exclusivement `state.activityEvents` (§29 — aucun second store) :

- **Recherche** (`state.journalSearch`) : filtre sur type, titre, message, source, `entityId`, `entityType` — couvre notamment les noms de fournisseurs et références puisqu'ils apparaissent dans le titre/message des événements déjà journalisés (création/modification fournisseur, tarif, import…).
- **Période** (`state.journalPeriod`, défaut `'30'`) : 7 / 30 / 90 jours ou Tout, calculée sur `e.timestamp` via `Clock.now()` (jamais `Date.now()`, cohérent avec le reste de l'application).
- **Pagination légère** (`state.journalPage`, 50 lignes/page) au-delà de 50 résultats, réutilisant le même style visuel (`.audit-pager`/`.pg-btn`) déjà utilisé par l'ancien tableau d'audit.

Pour ne jamais faire perdre le focus du champ de recherche pendant la frappe, les résultats vivent dans un conteneur dédié (`#journal-results-wrap`) mis à jour de façon **ciblée** par `refreshJournalResults()` — seul ce fragment est remplacé, jamais tout l'onglet (contrairement à un `render()` complet qui aurait recréé le champ de saisie lui-même à chaque caractère tapé).

## 5. Wizard Données — verrouillage du défilement d'arrière-plan

`renderDataWizard()` ajoute la classe `scroll-locked` sur `<html>` à l'ouverture ; `closeWizard()` la retire. Une règle CSS correspondante :

```css
html.scroll-locked, html.scroll-locked body { overflow: hidden }
html:has(.wizard-layer.open) { overflow: hidden } /* défense en profondeur */
```

Le wizard lui-même (`.wizard-card{max-height:calc(100dvh - 36px);overflow:auto}`, déjà présent depuis la V3.5, inchangé) reste pleinement scrollable ; `overscroll-behavior:contain` a été ajouté pour empêcher un rebond de scroll de « fuiter » vers la page derrière en fin de liste.

Vérifié en contexte navigateur réel à 390×844 : un geste de molette réel sur l'arrière-plan pendant que le wizard est ouvert ne déplace **pas** `window.scrollY` (contrôle préalable : sans le wizard, le même geste déplace bien la page — la page n'est donc pas structurellement non-scrollable, c'est bien le verrou qui agit). À la fermeture, le verrou se relâche.

## 6. Montant engagé — explicite partout

Au-delà de la carte « À traiter » (point 1), le montant réellement engagé est maintenant explicite à chaque endroit où une action de commande est proposée : le bouton principal affiche `Commander ${money(p.total)}` plutôt qu'un simple « Commander », éliminant toute ambiguïté entre ce que l'utilisateur voit et ce qu'il engage.

---

## 7. Corrections de finition (§53-91 du mandat)

### Stabilité visuelle entre onglets

**Cause racine identifiée** : l'apparition/disparition de la scrollbar verticale du navigateur, selon la hauteur de contenu de chaque onglet, décalait horizontalement tout le contenu de la page (comportement standard du navigateur en l'absence de réservation d'espace pour la scrollbar). La correction porte sur la cause, pas le symptôme :

```css
html { scrollbar-gutter: stable }
```

Cette unique règle réserve en permanence l'espace de la scrollbar, qu'elle soit affichée ou non, éliminant tout décalage horizontal quel que soit le contenu de l'onglet actif. Mesuré : **0.00px** de déplacement de `#page-title` et `#search` sur Commandes (changement de filtre), Stocks & achats (4 onglets) et Rapports (2 onglets), aux 4 largeurs testées.

### Espacement des actions et padding des boutons

- `.purchase-actions{gap:8px}` → `gap:12px` (zone d'actions des cartes « À traiter » : `[Commander XXX €]` et `Pourquoi ?` ne semblent plus appartenir au même bouton).
- `.secondary` (bouton « Détail » et autres actions secondaires) n'avait **aucun padding propre** dans le système de design existant — ajout de `padding:0 16px`, cohérent avec `.ghost`/`.filter`/`.stock-edit-btn` qui en avaient déjà un.

### Filtres « À traiter »

Trois filtres purement UI (`state.todoFilterSupplier`, `state.todoFilterDate`, `state.todoFilterAction`), sous forme de `<select>` sobres, agissant immédiatement sans bouton « Appliquer » :

- **Fournisseur** : liste dynamique construite depuis les fournisseurs réellement présents dans les propositions ouvertes (`todoOpenProposals()`), jamais codée en dur.
- **Échéance** : Toutes / Aujourd'hui / 7 prochains jours / 30 prochains jours, calculée sur `p.earliestStockoutAt` (champ canonique déjà produit par `decideProposal()`), jamais un texte affiché reparsé.
- **Action** : Toutes / Commander / Attendre / Action nécessaire (correspondance `ORDER_NOW`/`WAIT`/`BLOCKED` interne à la valeur du `<select>`, jamais affichée à l'utilisateur).

Un bouton « Réinitialiser » discret apparaît uniquement si au moins un filtre est actif ; un compteur « N sur M » remplace le sous-titre habituel dans ce cas. Un état vide filtré affiche un message explicite plutôt qu'une page blanche. Vérifié : changer un filtre n'appelle jamais `reconcileProposals()`/`save()`/`logActivity()` — les `PurchaseProposal` et le nombre d'`ActivityEvent` restent strictement identiques avant/après.

### Libellés du menu Outils

`NAV_ITEMS.planning.label` et `NAV_ITEMS.stock.label` sont raccourcis en **« Charge »** et **« Stock »** (Rapports/Utilisateurs étaient déjà en un mot). Les clés de route (`view:'planning'`, `view:'stock'`) et le **titre de la page** Stocks & achats (`setPageMeta('Stocks & achats', ...)`, non modifié) restent inchangés — seul le libellé affiché dans le sous-menu change, car la page continue de regrouper réellement Stocks et Achats.

---

## Portée des changements

| Fichier | Fonctions modifiées | Fonctions explicitement NON modifiées |
|---|---|---|
| `dentalflow-next-poc-v3.5.1.html` | `renderStockSupply`, `todoCardHTML` (nouvelle signature), `renderSupplyTodoTab` (+ filtres), `renderJournalTab` (+ recherche/période/pagination), `renderDataWizard`/`closeWizard` (scroll-lock), `NAV_ITEMS.planning`/`NAV_ITEMS.stock` (libellés) | `StockEngine`, `DemandEngine`, `SupplierEngine` (`evaluateSupplierCandidate`, `chooseSupplier`), `ProposalEngine` (`computeNeeds`, `decideProposal`, `approveProposal`), `receivePurchaseOrder`, migration V5→V6, persistance, gestion fournisseurs (`submitSupplierForm`, `setSupplierActive`, `submitTariffForm`), accordéon Outils, architecture Import/Export |

Aucune signature de fonction moteur publique n'a changé.
