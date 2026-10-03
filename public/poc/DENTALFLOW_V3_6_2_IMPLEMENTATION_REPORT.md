# DentalFlow Next V3.6.2 — Rapport d'implémentation

Base : `dentalflow-next-poc-v3.6.1.html`. Livrable : `dentalflow-next-poc-v3.6.2.html`. Hotfix strict — 3 correctifs, rien d'autre.

## Partie A — Retour de stock correct PAR LOT

### A. Comment le solde retournable par lot est calculé

Trois helpers canoniques, ajoutés à côté des fonctions existantes de V3.6.1 (`returnableQtyForOrderArticle`, plafond global, inchangé) :

- `consumedLotAllocationsForOrderArticle(orderId, articleId)` : parcourt tous les mouvements `CONSUMPTION` de la commande/article, lit `lotAllocations[]` en priorité (rétrocompatibilité `lotId` direct sinon), et retourne `{order, map}` — `order` préserve l'ORDRE d'apparition des lots (= ordre de consommation d'origine, respecté pour les nouveaux retours), `map` cumule la quantité consommée par lot.
- `returnedLotAllocationsForOrderArticle(orderId, articleId)` : même lecture, mais sur les mouvements `RETURN` déjà enregistrés pour cette commande — cumule la quantité DÉJÀ retournée par lot.
- `returnableLotAllocationsForOrderArticle(orderId, articleId)` : combine les deux — pour chaque lot dans l'ordre de consommation, `returnable = max(0, consommé_sur_ce_lot − retourné_sur_ce_lot)`.

Chacun de ces trois helpers relit l'intégralité de `state.stockMovements` à chaque appel — aucun état intermédiaire n'est mémorisé, `StockLot` ne porte jamais de champ `returnedQty` (le solde reste dérivé, conformément à l'invariant du mandat).

### B. Comment les retours précédents sont soustraits (pourquoi ça règle le bug)

`confirmCancelWithReturn()` construisait auparavant sa liste d'allocations en ré-agrégeant les `lotAllocations` des mouvements de CONSOMMATION d'origine à chaque appel — sans jamais soustraire ce qui avait déjà été retourné. Un lot déjà soldé par un retour précédent restait donc éligible à un second retour, ce qui pouvait produire `retourné > consommé` sur CE lot précis (même si le plafond global article restait juste, car un autre lot compensait).

Le correctif remplace cette boucle par un appel à `returnableLotAllocationsForOrderArticle()` : le solde retourné par les retours PRÉCÉDENTS est désormais soustrait du consommé AVANT toute nouvelle allocation, à chaque appel. La boucle d'allocation elle-même reste simple (FEFO implicite via l'ordre de consommation d'origine) :

```js
const balances = returnableLotAllocationsForOrderArticle(orderId, articleId);
let remaining = qty; const allocations = [];
balances.perLot.forEach(({lotId, returnable}) => {
  if (remaining <= 0) return;
  const take = Math.min(returnable, remaining);
  if (take > 0) { allocations.push({lotId, qty: take}); remaining -= take; }
});
```

Parce que le calcul est intégralement redérivé de l'historique à chaque appel (jamais d'accumulateur en mémoire), il est structurellement impossible d'appeler cette fonction plusieurs fois et de faire dériver un lot vers un solde négatif — `Math.max(0, …)` dans `returnableLotAllocationsForOrderArticle` garantit `returnable ≥ 0` pour chaque lot, et le plafond global (`returnableQtyForOrderArticle`, V3.6.1, inchangé) continue de refuser intégralement toute demande qui dépasserait le total consommé net.

## Partie B — `knownDemand()` respecte `restartStageId` pendant une reprise

### C. Comment `consumeAtStageId` est comparé à `restartStageId`

Dans `knownDemand()`, pour chaque commande active on détermine désormais la reprise active (`activeReworkForOrder(o)`, mécanisme V3.6.1 inchangé) puis, pour chaque ligne BOM candidate :

```js
if (activeRework && activeRework.restartStageId && !isStageAtOrAfter(b.consumeAtStageId, activeRework.restartStageId)) return;
```

Une ligne BOM dont l'étape de consommation est STRICTEMENT AVANT le `restartStageId` de la reprise active est exclue de la demande — exactement la règle du mandat : « une reprise ne refait pas les étapes qu'elle ne rejoue pas ». Le cycle `INITIAL` (pas de reprise active) n'est jamais concerné par ce filtre : le comportement V3.6.1 sur une commande sans reprise est strictement inchangé.

### D. Comment l'ordre des étapes est déterminé

Nouveau helper pur, ajouté dans le script de base à côté de `stageDefById` (jamais de comparaison lexicographique d'identifiants, qui serait fausse dès qu'un poste est ajouté/réordonné) :

```js
function isStageAtOrAfter(stageId, referenceStageId) {
  const s = stageDefById(stageId), r = stageDefById(referenceStageId);
  if (!s || !r) return true; // jamais d'exclusion par prudence si une étape est introuvable
  return (s.order || 0) >= (r.order || 0);
}
```

L'ordre canonique est `state.stageDefinitions[].order` — la même source de vérité déjà utilisée par `stageDefs()`/`allStageDefs()` pour trier les postes de production. Si l'une des deux étapes n'est pas résolue (donnée corrompue ou étape supprimée), la fonction ne bloque jamais un besoin par excès de prudence : elle retourne `true` (le besoin reste inclus), ce qui préserve le principe « le stock global doit rester juste » plutôt que de risquer une rupture masquée.

## Partie C — `createInvoice()` refuse les `orderId` dupliqués

### E. Comment la détection se fait avant toute mutation

Immédiatement après le contrôle de sélection vide, avant toute lecture de `state.orders` ou création d'objet `Invoice` :

```js
const seen = new Set();
for (const id of orderIds) {
  if (seen.has(id)) {
    showToast(`${id} est sélectionnée plusieurs fois dans cette facture`);
    return {success: false, reason: 'DUPLICATE_ORDER_ID', orderId: id};
  }
  seen.add(id);
}
```

La boucle s'arrête au premier doublon rencontré (adjacent ou non) et retourne immédiatement — aucune ligne du corps existant de `createInvoice()` (validation existence/statut/cabinet, construction de `Invoice`, `push` dans `state.invoices`, `logActivity`) n'est jamais atteinte dans ce cas. Le refus est donc structurellement transactionnel : soit la fonction s'arrête au tout début sans aucun effet de bord, soit (sélection sans doublon) elle poursuit exactement le comportement V3.6.1 inchangé.

## Emplacement des correctifs dans le fichier

- `isStageAtOrAfter` : script de base, juste après `stageDefById` (fonction pure, appelable depuis l'IIFE).
- `consumedLotAllocationsForOrderArticle`, `returnedLotAllocationsForOrderArticle`, `returnableLotAllocationsForOrderArticle` : IIFE, juste après `returnableQtyForOrderArticle` (inchangée, reste le plafond global).
- Boucle d'allocation de `confirmCancelWithReturn` : IIFE, remplace uniquement la construction des `allocations` — le reste de la fonction (plafond global, `cancelOrder()` idempotent, `save()/render()`) est strictement inchangé.
- `knownDemand()` : base script, réécrite avec le filtre `isStageAtOrAfter` — signature et tous les autres comportements (fenêtre `h`, échéance canonique) inchangés.
- Garde doublon de `createInvoice()` : IIFE, juste après le contrôle de sélection vide, avant la boucle de validation par commande.

## Non touché (conforme au mandat §4/§42/§61)

StockEngine, FEFO, `lotAvailableQty()` (V3.6.1, déjà corrects), scanner caméra DataMatrix (détection/`getUserMedia`/`BarcodeDetector`/`track.stop()`/repli HID-manuel), interface Factures, écrans de reprise, `schemaVersion` (reste V7), navigation/thèmes/responsive.
