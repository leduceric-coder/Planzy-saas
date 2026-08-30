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

---

## Addendum — Horloge temps réel & confidentialité patient cabinet

Ajouté au micro-hotfix V3.5.1 (avant audit final), sans nouvelle version de fichier. Deux volets indépendants ; architecture générale et moteurs métier validés non retouchés.

### 8. Horloge — `mode:'real'` par défaut

Le POC démontrait un décalage temporel embarrassant : `Clock` était figée sur `demoDate:new Date('2026-08-21T10:42:00')` en permanence (`mode:'demo'`), si bien qu'ouvrir le démonstrateur après cette date affichait des recommandations déjà expirées (« Commander au plus tard lun. 17 août »).

```js
const Clock={
  mode:'real', // était 'demo'
  demoDate:new Date('2026-08-21T10:42:00'), // conservé, mais utilisé uniquement si mode==='demo'
  now(){return this.mode==='real'?new Date():new Date(this.demoDate)},
  iso(){return this.now().toISOString()}
};
```

Aucune autre ligne du moteur n'a changé : toutes les fonctions métier (`addLabWorkingDays`, `subLabWorkingDays`, `businessDaysBetween`, `isLabWorkingDay`, `lastSafeOrderAt`/`stockoutAt` via `reconcileProposals`) routaient déjà exclusivement par `Clock.now()`/`today()`/`Clock.iso()` — un audit complet (grep `Date.now()` dans le moteur, grep `2026-08-`/`17 août`/`21 août`/`25/26/27 août`) n'a trouvé aucun autre point de couplage à corriger dans le moteur lui-même. Le mode `'demo'` reste disponible et est désormais utilisé exclusivement par les tests qui ont besoin d'un « maintenant » déterministe (ils basculent `Clock.mode` explicitement puis le restaurent).

**Données de seed** : `DEMO_ARTICLES`/`DEMO_SUPPLIERS`/`DEMO_ARTICLE_SUPPLIERS`, la `PurchaseOrder` de démo `CF-DEMO-EMX` (`ensureV34Model()`/`seedV6()`) et l'historique `seedAuditLog` (Journal) étaient déjà construits de façon relative (`addLabWorkingDays(today(),N)`, `daysAgo`) — rien à changer. Seul `demoOrders` (tableau legacy alimentant Accueil/Commandes/Production) portait des dates d'affichage absolues codées en dur sur 7 entrées (`due:'26 août 14:00'`, etc.) plus une dans `addUrgentZirconeOrder()` (`'mardi 25 août'`). Vérification faite que `o.due` est un **champ d'affichage pur** (`isDueToday`/`dueRank` ne font que du filtrage texte, aucune fonction moteur ne parse ce champ comme une date) : remplacées par du texte relatif intemporel (« Après-demain 14:00 », « Dans 3 jours 09:00 », « Il y a 2 jours 15:30 », « Hier 10:00 »…), correct quel que soit le jour d'ouverture du POC — semaine, mois ou année suivante.

**Accueil** : sous-titre statique remplacé par une version datée dynamiquement :

```js
function homeDateLabel(){return Clock.now().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
// setPageMeta(..., `Voici la vue d'ensemble de votre laboratoire — ${homeDateLabel()}`)
```

### 9. Confidentialité patient côté cabinet — `state.cabinetPatients`

Le formulaire « Nouvelle commande » du portail cabinet ne demandait aucune identité patient. Le mandat exige que le cabinet puisse saisir Prénom/Nom, **sans jamais** que `state.orders` (modèle partagé labo) ne porte cette identité — invariant `patientRef` opaque en vigueur depuis le tout premier hotfix privacy du projet (P0-A).

Un store logiquement séparé a été ajouté, jamais lu côté labo :

```js
cabinetPatients:{} // sur state, ex: {'CMD-0205':{cabinet:'Cabinet Moderne',patientFirstName:'Marie',patientLastName:'Dupont'}}
```

- **Persistance dédiée**, volontairement hors de `STORAGE_KEY`/`serializableState()` : `CABINET_PATIENTS_KEY='dentalflow-cabinet-patients-v1'`, `saveCabinetPatients()`/`loadCabinetPatients()`. `serializableState()` — qui alimente à la fois `v34Save()` (persistance labo) et `exportDentalFlowJSON()` (export) — n'a **pas** été modifiée : `cabinetPatients` n'y apparaît jamais, donc ne fuit ni dans la persistance labo ni dans un export labo/business.
- **Création de commande** (`createDentistOrder` → extrait en `createDentistOrderCore(data,files)`, testable sans rendu DOM) : génère `patientRef` via `generatePatientRef()` (inchangé, déjà opaque), pousse la commande partagée sans aucun champ d'identité, puis écrit séparément `state.cabinetPatients[id]={cabinet,patientFirstName,patientLastName}`. Le message auto-généré au labo reste `Nouvelle commande {type} — livraison souhaitée {due}` — jamais de nom.
- **Formulaire cabinet** (`dentistNewHTML`) : ajout Prénom/Nom en tête de formulaire (avant Type/Teinte/Fichiers, conformément au mandat), note de réassurance : « Le nom du patient reste privé dans votre espace cabinet. Le laboratoire reçoit uniquement une référence anonyme. »
- **Affichage cabinet** : `patientDisplayName(orderId,cabinet)` renvoie le nom uniquement si `cabinetPatients[orderId].cabinet===cabinet` (garde de défense en profondeur, en plus du filtrage déjà existant des commandes par cabinet). Liste « Mes commandes » (`dentistOrdersHTML`) affiche le nom en avant, `patientRef` relégué en sous-texte. Détail (`dentistDetailHTML`) affiche Patient / Commande / Type / Livraison estimée / État / **Référence DentalFlow** (renommé depuis « Référence patient »).
- **Aucune surface labo modifiée** : par construction (le store n'est référencé que dans les fonctions du portail cabinet), Accueil/Commandes/Production/Messages/Charge/Stocks/Rapports/Recherche/fiches imprimées/`ActivityEvents` ne lisent jamais `cabinetPatients` — zéro risque de fuite structurel plutôt que zéro risque vérifié après coup.
- **Démo existante** : `ensureCabinetPatientsSeed()` ajoute additivement trois noms fictifs (dont « Marie Dupont », l'exemple même du mandat) pour des commandes de démo existantes, sans jamais toucher leur `patientRef` ; purge les entrées orphelines après un `resetDemoV6()` qui régénère `state.orders`.
- **Documentation explicite de la limite** (commentaire en tête du bloc CABINET PRIVACY) : séparation **logique uniquement** — runtime JS monolithique unique, pas d'isolation serveur réelle ; une architecture SaaS de production nécessiterait un stockage tenant-isolé et un contrôle d'accès côté backend.
