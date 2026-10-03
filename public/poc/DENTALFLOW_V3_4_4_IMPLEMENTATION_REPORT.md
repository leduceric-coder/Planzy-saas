# DentalFlow Next V3.4.4 — Rapport d'implémentation

## Cadrage

Cette version corrige exclusivement les 4 anomalies résiduelles identifiées par un second audit indépendant du code V3.4.3. Aucune fonctionnalité n'est ajoutée, aucune UI n'est refaite, le moteur Stocks/`knownDemand`/import/architecture V6 n'est pas touché en dehors des points listés ci-dessous, et aucune formule déjà validée (physicalStock, expectedDemand, projectedStock, stockoutWorkingDays, lastSafeOrderAt, landedCost, roundPack) n'a été modifiée.

---

## A. Pourquoi `legacyIncoming` ne peut pas hériter d'un `preferredSupplier` courant

### Constat de l'audit
`migrateStockArrayToV6()` créait, pour chaque article legacy V5 ayant un `incoming>0`, une `PurchaseOrder` synthétique (`migrationSource:'legacyIncoming'`) dont le `supplierId` et le `unitPrice` provenaient de `preferredTariff(id, s)` — c'est-à-dire du **catalogue fournisseur actuel**, au moment de la migration.

### Pourquoi c'est faux
Le modèle V5 ne stocke, pour un article, qu'un entier `incoming` (quantité en commande) — il n'existe **aucune trace** du fournisseur réellement sollicité, du prix réellement négocié, ni de la date de commande réelle. Le fournisseur préféré *actuel* peut avoir changé depuis (nouveau contrat, fournisseur désactivé, tarif renégocié) : l'utiliser pour reconstituer une commande passée revient à **fabriquer une donnée historique qui n'a jamais existé**, avec un risque concret (le rapprochement comptable ou la relance fournisseur se ferait auprès du mauvais interlocuteur, au mauvais prix).

### Correction appliquée
`migrateStockArrayToV6()` crée désormais la PO `legacyIncoming` avec :
- `supplierId: null`
- `lines[0].unitPrice: null`, `lines[0].lineTotal: null`
- `subtotal: 0`, `shipping: 0`, `total: 0`
- `dataQualityFlags: ['missing_supplier', 'missing_price']` (toujours les deux, sans condition — l'information est structurellement absente, pas seulement absente « des fois »)
- `lines[0].orderedQty` = la quantité `incoming` exacte du V5, **toujours préservée à l'unité près**
- Un `ActivityEvent` de sévérité `WARNING` est journalisé pour rendre la lacune visible plutôt que silencieuse

Ce qui est garanti : la quantité en commande n'est jamais perdue (elle reste pilotable/réceptionnable manuellement), mais aucune information fournisseur/prix n'est inventée. `preferredTariff()` elle-même n'a pas été modifiée — elle continue de servir, à juste titre, au calcul des besoins *futurs*.

---

## B. Comment le premier démarrage est distingué d'une migration V5

### Constat de l'audit
`ensureV34Model()` traitait tout boot sans schéma V6 persisté (`!persistedV6`) de façon uniforme, en passant systématiquement `state.stock` dans `migrateStockArrayToV6()`. Pour un démarrage à vide (aucune donnée localStorage), `state.stock` provenait alors du `seed()` **legacy V3.3** (`demoStock`, contenant `ZIR-HT-001 qty:45`), migré comme s'il s'agissait de données utilisateur réelles. Résultat : Zircone=45 au tout premier lancement, contre Zircone=5 après un clic sur « Réinitialiser la démo » (qui appelle `seedV6()` nativement) — deux états de démonstration différents pour un même produit.

### Mécanisme retenu
Un drapeau transitoire `state.__noPersistedState` est positionné **uniquement** par `load()`, et uniquement dans sa branche de repli finale — celle qui n'est atteinte que lorsque `localStorage` ne contenait strictement rien d'exploitable :

```js
// load() — dernière branche, atteinte seulement si aucun state valide n'a été lu
}catch(e){console.error('load failed',e)}
state.__noPersistedState = true;
seed();       // seed legacy V3.3 : nécessaire pour peupler les structures non-V6
              // (users, planning...) que seedV6() ne gère pas — mais le stock
              // qui en résulte ne sera jamais migré tel quel (cf. ensureV34Model)
```

`ensureV34Model()` consulte ce drapeau pour trancher entre trois cas, et le supprime systématiquement ensuite (il ne doit jamais survivre à un cycle de boot) :

- **Cas A — V6 déjà persisté** (`persistedV6===true`) : aucune des deux branches ci-dessous ne s'exécute, l'état est chargé tel quel.
- **Cas B — V5 legacy réellement persisté** (`persistedV6===false` et `__noPersistedState` absent, c'est-à-dire qu'un vrai `raw` a été lu depuis localStorage) : `migrateStockArrayToV6()` s'exécute sur les données **réellement sauvegardées** par l'utilisateur — comportement inchangé depuis la correction V3.4.3 (préservation stricte des valeurs).
- **Cas C — rien de persisté du tout** (`persistedV6===false` et `__noPersistedState===true`) : `seedV6()` est appelé **directement**, sans jamais passer par `migrateStockArrayToV6()`. Le stock legacy produit par le `seed()` de repli est ignoré pour la construction du modèle V6 — il n'est qu'un filet de sécurité pour les structures non-stock.

```js
if(!persistedV6){
  if(state.__noPersistedState){
    seedV6();                 // Cas C : seed V6 natif, jamais un V5 fictif migré
  }else{
    // Cas B : migration fidèle d'un V5 réellement sauvegardé (logique V3.4.3 inchangée)
    ...
    migrateStockArrayToV6(state);
    ...
  }
}
delete state.__noPersistedState;
```

### Conséquence vérifiée
Premier démarrage et « Réinitialiser la démo » (`resetDemoV6(){seed();seedV6();save()}`, code inchangé) convergent désormais sur le **même** appel `seedV6()`, donc sur le même état métier. Vérifié empiriquement (§17 du mandat, « FIRST START = RESET DEMO ») via un vrai contexte navigateur neuf : Zircone=5 dans les deux cas, et une comparaison champ-à-champ (articles, suppliers, articleSuppliers, stockMovements, purchaseOrders, users, orders) confirme l'égalité stricte des données métier, IDs et timestamps mis à part.

---

## C. Statuts de PurchaseOrder réceptionnables

### Constat de l'audit
`receivePurchaseOrder(id, receipts)` ne vérifiait que la validité des quantités reçues (garde-fou V3.4.3, conservé intact), mais ne vérifiait **jamais** le statut de la commande elle-même. Une PO `cancelled` ou déjà `received` pouvait être passée à la fonction et produire une mutation réelle (`receivedQty` modifié, `StockMovement RECEIPT` créé, `physicalStock` augmenté, `status` changé).

### Règle retenue
Réutilisation de la constante déjà existante `PURCHASE_STATUSES_OPEN = ['ordered','confirmed','shipped','partially_received']`, qui définissait déjà la notion de commande « ouverte » ailleurs dans le moteur (aucune nouvelle constante introduite) :

```js
function receivePurchaseOrder(id, receipts){
  const po = state.purchaseOrders.find(x => x.id === id);
  if(!po) return null;
  if(!PURCHASE_STATUSES_OPEN.includes(po.status)){
    logActivity({...severity:'WARNING', title:'Réception refusée', ...});
    save();
    return { success:false, reason:'PO_NOT_RECEIVABLE', status: po.status };
  }
  // ↓ garde-fou quantité V3.4.3, entièrement conservé, s'applique ensuite
  ...
}
```

- **Réceptionnable** : `ordered`, `confirmed`, `shipped`, `partially_received`.
- **Non réceptionnable** : `received`, `cancelled`, tout autre statut fermé — retour explicite `{success:false, reason:'PO_NOT_RECEIVABLE', status:<statut réel>}`, aucune mutation de `receivedQty`/`physicalStock`/`stockMovements`.

Les deux gardes (statut, puis quantité) sont indépendantes et s'appliquent l'une après l'autre : un rejet de statut court-circuite avant tout calcul de quantité ; une PO ouverte continue ensuite d'être soumise au garde-fou de surquantité de la V3.4.3, inchangé. Les appelants existants (UI de réception) reçoivent la même forme d'objet qu'avant (`po` mis à jour) dans le cas nominal, et un objet `{success:false,...}` explicite dans le cas refusé — aucune signature de fonction modifiée.

---

## D. Définition de la viabilité commerciale d'un fournisseur alternatif

### Constat de l'audit
Dans `chooseSupplier()`, la bascule d'urgence (quand le fournisseur préféré n'arrive pas à temps) choisissait le fournisseur alternatif le plus rapide capable de livrer avant la date de rupture, **sans jamais vérifier que le minimum de commande de CE fournisseur** était atteint pour la quantité réellement nécessaire chez lui. Un fournisseur rapide mais sous son propre minimum pouvait ainsi être recommandé, pour finir bloqué en pratique (commande non passable).

### Règle retenue
Un fournisseur candidat n'est retenu comme **viable** que s'il remplit, indépendamment des autres candidats, les cinq conditions suivantes :

1. **Actif** et son **tarif actif** (filtré en amont par `list`, déjà existant, inchangé)
2. **Prix connu** (`unitPrice != null`)
3. **Délai respecté** : arrivée (`addLabWorkingDays(today(), leadTimeDays)`) ≤ date de rupture
4. **Minimum de commande atteint pour SA PROPRE quantité** : la quantité nécessaire est recalculée avec les paramètres propres à CE fournisseur (`leadTimeDays`, `minimumQty`, `packSize` via `qtyFor()`, fonction déjà existante, inchangée) — jamais en réutilisant la quantité calculée pour le fournisseur préféré
5. Le sous-total obtenu à cette quantité propre atteint bien `supplier.minimumOrder`

```js
const candidates = list.map(t => {
  const lead = t.leadTimeDays ?? t.supplier.leadTimeDays ?? 0;
  const arrival = addLabWorkingDays(today(), lead);
  const qty = qtyFor(t);                                    // quantité PROPRE au candidat
  const subtotal = qty * (t.unitPrice || 0);
  return { t, arrival, onTime: arrival<=urgentStockoutAt,
           priceOk: t.unitPrice!=null,
           minOk: subtotal >= (t.supplier.minimumOrder||0),
           qty, landed: landedFor(t, qty) };                 // landedFor() déjà existante
});
const viable = candidates.filter(c => c.priceOk && c.onTime && c.minOk);
```

Parmi les candidats **réellement** viables, la priorité de sélection est :

1. **Respect du délai** — déjà un filtre d'entrée (`onTime`), donc automatiquement respecté par construction
2. **Coût rendu minimal** (`landedCost`, incluant le port, pas le seul prix unitaire) — critère de tri principal
3. **Délai le plus court** — uniquement comme départage quand deux candidats ont un coût rendu strictement égal

```js
viable.sort((a,b) => (a.landed-b.landed) || (a.arrival-b.arrival) || a.t.supplierId.localeCompare(b.t.supplierId));
const best = viable[0];
```

Aucun identifiant de fournisseur/article n'est codé en dur dans cette logique : `qtyFor`, `landedFor`, `pref`, `list` sont les mêmes fonctions et variables locales déjà utilisées par le reste de `chooseSupplier()` en V3.4.3.

### Comportement observé sur les trois scénarios du mandat
- **A/B/C** : fournisseur B (rapide) exclu car son sous-total (150) n'atteint pas son propre minimum ; fournisseur C (viable) recommandé à la place.
- **Deux viables** : entre deux fournisseurs livrant tous deux à temps, celui au coût rendu le plus bas est choisi, même si son prix unitaire n'est pas le plus bas et son délai pas le plus court.
- **Urgence extrême** : un seul fournisseur peut livrer à temps ; il est choisi malgré un coût supérieur, car le respect du délai prime sur le coût — jamais l'inverse.

`decideProposal()`, `reconcileProposals()` et `computeNeeds()` n'ont pas été modifiées : leur logique de routage vers `chooseSupplier()` était déjà correcte depuis la V3.4.3 et devient, avec cette correction, pleinement fiable de bout en bout.

---

## Portée des changements

| Fichier | Fonctions modifiées | Fonctions explicitement NON modifiées |
|---|---|---|
| `dentalflow-next-poc-v3.4.4.html` | `migrateStockArrayToV6()`, `load()`, `ensureV34Model()`, `receivePurchaseOrder()`, `chooseSupplier()` | `physicalStock`, `expectedDemand`, `projectedStock`, `stockoutWorkingDays`, `lastSafeOrderAt`, `landedCost`, `roundPack`, `qtyFor`, `landedFor`, `preferredTariff`, `decideProposal`, `computeNeeds`, `reconcileProposals`, `approveProposal`, `seedV6`, `resetDemoV6`, toute l'UI/CSS, l'assistant d'import, l'architecture V6 |

Aucune signature de fonction publique (`window.DentalFlowV34`, `window.DentalFlowTest`) n'a changé.
