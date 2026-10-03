# DentalFlow Next V3.4.5 — Rapport d'implémentation

## Cadrage

Ce micro-hotfix corrige **un seul** défaut métier résiduel, identifié par un audit indépendant de la V3.4.4 : la seconde passe de `computeNeeds()` (bascule quand le minimum de commande du fournisseur préféré n'est pas atteint et que le besoin est urgent) pouvait rerouter une ligne vers le fournisseur alternatif le plus rapide **sans vérifier que ce fournisseur atteignait lui-même son propre minimum de commande**. Aucune fonctionnalité n'est ajoutée ; le seul refactor autorisé et réalisé est local : extraction d'un helper canonique unique de viabilité, utilisé aux deux endroits qui en avaient besoin.

---

## A. Cause racine

`chooseSupplier()` avait déjà été corrigée en V3.4.4 pour n'accepter un fournisseur alternatif que s'il était réellement commandable (délai + prix + son propre minimum). Mais ce garde-fou vivait **uniquement** dans `chooseSupplier()`, qui n'est appelée que lorsque le fournisseur préféré **arrive trop tard**. La seconde passe de `computeNeeds()` traite un cas différent — le fournisseur préféré **arrive à temps mais son minimum de commande n'est pas atteint** — et contenait sa **propre** logique de sélection, plus ancienne, jamais alignée sur la correction de V3.4.4 :

```js
// AVANT (V3.4.4) — bug :
const alt = tariffsForArticle(n.article.id, s)
  .filter(t => t.supplierId !== sid && n.stAt &&
               addLabWorkingDays(today(), t.leadTimeDays ?? t.supplier.leadTimeDays) <= n.stAt);
if (!alt.length) return;
const chosen = alt.slice().sort((a,b) => (a.leadTimeDays-b.leadTimeDays) || ...)[0];
// ↑ ne vérifie NI le minimum de commande du candidat NI son coût rendu —
//   seul le délai compte. La quantité/le minimum sont recalculés APRÈS coup,
//   avec le fournisseur déjà choisi, jamais comme critère de sélection.
```

Résultat reproductible : avec A (préféré, minimum 150), B (lead identique à A, minimum 200), C (lead plus long, minimum 0), et un besoin réel ≈120€, le tri par délai seul plaçait B avant C (délai égal à A, donc le plus court parmi les alternatives). B était choisi, puis sa propre quantité recalculée donnait un sous-total (120€) toujours sous son minimum (200€) — la proposition finissait `BLOCKED` alors que C, plus lent mais sans minimum, était réellement commandable. Reproduction empirique confirmée contre le code non modifié de la V3.4.4 (voir `DENTALFLOW_V3_4_5_TEST_REPORT.md`, §0).

---

## B. Une seule notion de viabilité fournisseur

### Le helper canonique

`evaluateSupplierCandidate(articleId, tariff, stockoutAt, s)` est la définition **unique** de ce qu'est un fournisseur candidat viable pour un article donné, à une date de rupture donnée. Elle est appelée par les deux seuls endroits du moteur qui avaient besoin de sélectionner un fournisseur alternatif :

- `chooseSupplier()` — bascule quand le fournisseur préféré arrive trop tard (inchangé fonctionnellement depuis la V3.4.4, mais reformulé pour déléguer son calcul de viabilité au helper au lieu de le dupliquer en local)
- la seconde passe de `computeNeeds()` — bascule quand le minimum de commande du fournisseur préféré n'est pas atteint et que le besoin est urgent (le site du bug corrigé ici)

```js
function evaluateSupplierCandidate(articleId, tariff, stockoutAt, s=state) {
  // ... voir le code pour le détail complet des vérifications (§C ci-dessous)
  return { viable, supplierId, tariff, supplier, leadTimeDays, suggestedQty,
           rawOrderQty, projectedStock, subtotal, shippingCost, landedCost,
           expectedAt, arrivesInTime, minimumOrderReached, priceOk, blockingReasons };
}
```

Avant cette version, `chooseSupplier()` et la seconde passe de `computeNeeds()` contenaient deux algorithmes différents pour répondre à la même question (« ce fournisseur est-il commercialement viable pour ce besoin ? ») — l'un correct depuis la V3.4.4, l'autre encore buggé. Il n'existe désormais plus qu'une seule réponse possible à cette question, appliquée identiquement aux deux endroits.

### Ce que `chooseSupplier()` a gardé

Son comportement observable est strictement identique à la V3.4.4 (mêmes 42 tests hérités tous PASS, y compris les 3 tests A/B/C/landed-cost/urgence-extrême de la V3.4.4 qui exercent exactement cette fonction). Seule son implémentation interne délègue désormais au helper au lieu de recalculer `qtyFor`/`landedFor` en local.

---

## C. Critères de viabilité obligatoires (implémentation exacte du helper)

Un candidat n'est `viable:true` que si, indépendamment de tout autre candidat :

1. **Le fournisseur et son tarif existent et sont actifs** (`supplier.active!==false`, `tariff.active!==false`) — sinon rejet immédiat (`blockingReasons:['invalid_candidate']`)
2. **Le prix unitaire est un nombre fini connu** (`tariff.unitPrice!=null && Number.isFinite(+tariff.unitPrice)`) → sinon `missing_price`
3. **`packSize` est une valeur valide** (`null` ou nombre fini strictement positif) → sinon `invalid_pack_size`
4. **`minimumQty` est une valeur valide** (`null` ou nombre fini ≥0) → sinon `invalid_minimum_qty`
5. **Il livre avant la date de rupture** (si fournie) : `expectedAt = addLabWorkingDays(today(), leadTimeDays)`, `arrivesInTime = expectedAt <= stockoutAt` → sinon `too_late`
6. **Sa quantité est recalculée avec SES PROPRES paramètres** — jamais ceux d'un autre fournisseur : `horizon = leadTimeDays + reviewPeriodDays`, `rawOrderQty = max(0, safetyStock - projectedStock(horizon))`, `suggestedQty = roundPack(rawOrderQty, tariff.minimumQty, tariff.packSize)` (fonction `roundPack()` existante, inchangée)
7. **Son sous-total, à cette quantité propre, atteint SON PROPRE minimum de commande** : `subtotal = suggestedQty * unitPrice`, `minimumOrderReached = !(minimumOrder>0) || subtotal>=minimumOrder` → sinon `minimum_order_not_reached`

`viable = arrivesInTime && priceOk && packSizeOk && minimumQtyOk && minimumOrderReached`.

Le coût rendu (`landedCost`, fonction existante et inchangée, incluant le port et la règle de franco réelle du fournisseur) est calculé pour **tout** candidat évalué, viable ou non, afin de permettre un classement ultérieur ou un diagnostic.

**Ce que DentalFlow ne fait jamais** : ajouter un article supplémentaire, augmenter artificiellement une quantité, ou emprunter la quantité d'un autre fournisseur pour atteindre un minimum de commande. La quantité candidate est toujours celle strictement nécessaire au réapprovisionnement, recalculée pour ce fournisseur précis.

---

## D. Classement des candidats viables

Une fois les candidats non viables éliminés (peu importe le point d'entrée — `chooseSupplier()` ou la seconde passe de `computeNeeds()`) :

1. **Priorité 1 — éviter la rupture** : déjà garanti par construction, puisque `arrivesInTime` fait partie des critères de viabilité ; un fournisseur qui arriverait trop tard n'est jamais dans la liste triée.
2. **Priorité 2 — coût rendu (`landedCost`) le plus bas** parmi les candidats restants.
3. **Priorité 3 — délai le plus court**, uniquement comme départage à coût rendu strictement égal.

```js
viable.sort((a,b) => (a.landedCost-b.landedCost) || (a.leadTimeDays-b.leadTimeDays) || a.supplierId.localeCompare(b.supplierId));
```

Un fournisseur plus rapide n'est jamais choisi automatiquement si sa rapidité n'apporte rien (les deux livrent à temps) : c'est le coût rendu qui décide. Inversement, en urgence extrême (un seul candidat arrive réellement à temps), ce candidat est retenu même s'il est plus cher — le risque de rupture prime toujours sur le coût, par construction du filtre de viabilité qui s'applique avant tout tri par coût.

---

## E. Où le changement s'arrête

| Fichier | Fonctions modifiées | Fonctions explicitement NON modifiées |
|---|---|---|
| `dentalflow-next-poc-v3.4.5.html` | `computeNeeds()` (seconde passe uniquement), `chooseSupplier()` (délégation interne au helper, comportement observable inchangé), + ajout de `evaluateSupplierCandidate()` | `knownDemand`, `baselineDemand`, `expectedDemand`, `projectedStock`, `stockoutWorkingDays`, `StockMovement`, migration V5→V6, `legacyIncoming`, premier démarrage V6, `resetDemoV6`, `receivePurchaseOrder`, `approveProposal`, `decideProposal`, `reconcileProposals` (hors appel interne à `computeNeeds`), import, responsive, thèmes, Staff, Cabinet, privacy |

La dette d'architecture notée par l'audit (`load()`/`resetDemoV6()` appellent encore `seed()` avant `seedV6()`) n'a **volontairement pas été traitée** dans cette version, conformément à la consigne explicite du mandat (§21) : elle n'est pas bloquante et sa correction est hors périmètre d'un micro-hotfix.

Aucune signature de fonction publique (`window.DentalFlowV34`, `window.DentalFlowTest`) n'a changé.
