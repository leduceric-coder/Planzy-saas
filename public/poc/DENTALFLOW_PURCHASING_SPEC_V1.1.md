# DentalFlow — Stocks intelligents, Achats assistés, Import/Export, Journal
## Spécification fonctionnelle — **Révision 1.1**

Base de code : `dentalflow-next-poc-v3.3.2.html` (schemaVersion 5)
Remplace : `DENTALFLOW_PURCHASING_SPEC.md` (V1.0)
Statut : **spécification** — aucun fichier applicatif modifié.
Implémentation ensuite : Claude Sonnet 5, effort élevé, après validation.

Toutes les formules de ce document ont été **vérifiées numériquement** (§4).

---

## 0. Ce qui change par rapport à la V1.0

| # | Correction | Impact |
|---|---|---|
| 1 | **Double comptage de la demande éliminé** — `projectedStock` part de `physicalStock`, plus de `availableStock` | Formules §3 |
| 2 | `expectedDemand = max(knownDemand, baselineDemand)` | Formules §3 |
| 3 | `shouldReplenish` compare le stock projeté **à la livraison** au stock de sécurité ; `reorderPoint` **supprimé** | §5.1 |
| 4 | Quantité suggérée reformulée en politique de recouvrement (R,S) | §5.2 |
| 5 | 5 tests numériques complets, vérifiables à la main | §4 |
| 6 | **Purge des mouvements de stock supprimée** ; `BALANCE_CARRY_FORWARD` documenté P2 | §2.2 |
| 7 | Consommation **idempotente** via `consumptionKey` | §2.4 |
| 8 | `consumeAtStageId` porté par la **ligne de nomenclature** | §2.3 |
| 9 | `Article.preferredSupplierId` **supprimé** | §2.1 / §2.6 |
| 10 | `targetStock` **supprimé** ; `targetCoverageDays` → P2 | §2.1 |
| 11 | Onglet « Réapprovisionnement » **supprimé** des Stocks | §11 |
| 12 | `Supplier.orderDays` **supprimé** → P2 | §2.5 |
| 13 | `wizardLayer` distinct de `quick-layer` | §11.4 |
| 14 | 7 cas de démo **recalculés** avec les formules corrigées | §12 |
| 15 | P2 : fiabilité fournisseur, historique des prix | §14 |

Arbitrages V1.0 **validés** et intégrés : Données dans le menu utilisateur · Journal unifié
`activityEvents` · CSV P1 / XLSX P2 · réservations dérivées · solde dérivé des mouvements ·
consommation au scan · express P2 · `SEMI_AUTO` seul · BOM non éditable en P1 ·
2 alertes Achats maximum sur l'Accueil.

---

## 1. Architecture fonctionnelle

> Le moteur calcule. L'interface explique. Le responsable décide.

```
┌─────────────────────────────────────────────────────────┐
│ UI  Stocks · Achats · Journal · Données                  │
│     progressive disclosure : liste → popup → side-window │
└────────────────────────┬────────────────────────────────┘
                         │  lit des vues, ne calcule rien
┌────────────────────────▼────────────────────────────────┐
│ MOTEURS (purs, déterministes, sans IA, testables)        │
│  StockEngine          soldes et projections              │
│  DemandEngine         knownDemand / baselineDemand       │
│  ReplenishmentEngine  déclenchement et quantité          │
│  SupplierEngine       landed cost, franco, comparaison   │
│  ProposalEngine       regroupement et recommandation     │
└────────────────────────┬────────────────────────────────┘
                         │  lit un état normalisé
┌────────────────────────▼────────────────────────────────┐
│ DONNÉES  articles · suppliers · articleSuppliers         │
│          stockMovements (append-only) · purchaseOrders   │
│          purchaseProposals · activityEvents              │
└─────────────────────────────────────────────────────────┘
```

**Règle d'or** : aucun moteur n'écrit dans l'état. Seules des commandes explicites
(valider, réceptionner, ajuster, scanner) produisent des mutations, et chacune émet
un `activityEvent`.

### Navigation cible

| Emplacement | Contenu |
|---|---|
| Outils | **Achats**, **Journal d'activité** |
| Stocks | onglets **Articles** · **Fournisseurs** (§11.1) |
| Menu utilisateur | **Données** → Import / Export |

`PRIMARY_NAV` (Accueil, Commandes, Production, Messages) **inchangé**.

---

## 2. Modèle de données

### 2.1 Article

```js
{
  id,                 // 'ART-ZIR-HT-001'
  reference,          // référence interne
  label,              // 'Zircone HT'
  category,           // 'Matériau' | 'Consommable' | 'Outillage'
  unit,               // 'disques'
  capacity,           // capacité physique de stockage — affichage uniquement
  safetyStock,        // tampon incompressible — utilisé par le moteur
  averageConsumption, // { qty, periodDays }
  active
}
```

**Supprimés en V1.1** : `targetStock` (jamais utilisé dans un calcul),
`preferredSupplierId` (redondant avec `ArticleSupplier.preferred`).
`reorderPoint` n'existe plus, même comme valeur dérivée (§5.1).

**Dérivés, jamais stockés** : `physicalStock`, `reservedStock`, `availableStock`,
`incomingStock`, `projectedStock(h)`, `coverageDays`.

### 2.2 StockMovement — journal append-only, jamais purgé

```js
{
  id, at,                    // Clock.iso()
  articleId,
  type,                      // OPENING | RECEIPT | CONSUMPTION | ADJUSTMENT | RETURN
  qty,                       // signé
  reason,
  sourceType, sourceId,      // 'purchaseOrder' | 'order' | 'import' | 'manual'
  consumptionKey,            // uniquement pour CONSUMPTION — voir §2.4
  userId
}
```

Immuable, comme les `scanEvents`. Une correction n'édite jamais un mouvement :
elle en ajoute un de type `ADJUSTMENT`.

**Aucune purge.** Tant que `physicalStock = Σ mouvements`, supprimer un mouvement
falsifierait le solde. La règle « purge > 12 mois » de la V1.0 est **retirée**.

> **P2 / SaaS — `BALANCE_CARRY_FORWARD`.** Pour permettre un jour l'archivage,
> introduire un mouvement de clôture d'exercice portant le solde reporté :
> les mouvements antérieurs deviennent archivables sans altérer le solde
> (`physicalStock = report + Σ mouvements postérieurs`). Hors scope P1.

### 2.3 Nomenclature (BOM) — non éditable en P1

```js
const BILL_OF_MATERIALS = {
  'Couronne zircone':  [{ articleId:'ART-ZIR-HT-001', qty:1, consumeAtStageId:'STG-003' }],
  'Bridge 3 éléments': [{ articleId:'ART-ZIR-HT-001', qty:2, consumeAtStageId:'STG-003' }],
  'Facette céramique': [{ articleId:'ART-CER-EMX-003', qty:1, consumeAtStageId:'STG-004' }],
  'Inlay / Onlay':     [{ articleId:'ART-CER-EMX-003', qty:1, consumeAtStageId:'STG-004' }],
  'Couronne provisoire':[{ articleId:'ART-PMM-TMP-004', qty:1, consumeAtStageId:'STG-002' }],
  'Couronne céramo-métallique':[
                        { articleId:'ART-CER-EMX-003', qty:1, consumeAtStageId:'STG-004' },
                        { articleId:'ART-ADH-CER-008', qty:1, consumeAtStageId:'STG-005' }],
  'Denture partielle': [{ articleId:'ART-PMM-TMP-004', qty:2, consumeAtStageId:'STG-002' }]
};
```

`consumeAtStageId` est porté par la **ligne**, pas par l'article : le même adhésif
peut être consommé au Contrôle qualité sur un travail et à la Céramique sur un autre.
La phase appartient au couple *(type de travail, article)*.

### 2.4 Consommation au scan — idempotente

```js
consumptionKey = `${orderId}::${articleId}::${consumeAtStageId}`
```

Au scan d'un poste : pour chaque ligne de BOM du type de la commande dont
`consumeAtStageId` = poste scanné —

```
si un CONSUMPTION portant cette consumptionKey existe déjà → ne rien créer
sinon → créer le mouvement CONSUMPTION
```

**Un rescannage ne consomme jamais deux fois.** Une correction passe exclusivement
par un `ADJUSTMENT`. C'est le pendant stock de l'immutabilité des scans établie en V3.3.

### 2.5 Supplier

```js
{ id, name, active, leadTimeDays,
  freeShippingThreshold, shippingCost, minimumOrder, notes }
```

**Supprimés en V1.1** : `orderDays` (non utilisé par `lastSafeOrderDate`),
`expressShippingCost` (P2). Aucun paramètre métier ignoré par le moteur ne subsiste.

> **P2 — `orderDays`.** Jours de passation fournisseur. Modifierait
> `lastSafeOrderDate` en le ramenant au dernier jour de passation utile.

### 2.6 ArticleSupplier

```js
{ articleId, supplierId, supplierReference,
  unitPrice, packSize, minimumQty, leadTimeDays, preferred }
```

**Invariant** : au plus **un** `ArticleSupplier` actif avec `preferred = true` par
article. Seule source de vérité du fournisseur préféré. Violation → événement `ERROR`
et repli sur le landed cost le plus bas.

`leadTimeDays` surcharge celui du fournisseur quand il est renseigné.

### 2.7 PurchaseProposal / PurchaseProposalLine

```js
PurchaseProposal {
  id, supplierId, createdAt, updatedAt, waitingSince,
  status,                  // draft|waiting|ready|approved|dismissed|converted
  lines, subtotal, shippingCost, total,
  freeShippingThreshold, missingForFreeShipping,
  recommendedAction,       // ORDER_NOW | WAIT | NO_ACTION | BLOCKED
  riskLevel,               // none | low | high | critical
  earliestStockoutDate, lastSafeOrderDate, projectedFrancoDate,
  explanationReasons: [], blocking: []
}
PurchaseProposalLine {
  articleId, suggestedQty, packSize, unitPrice, lineTotal,
  projectedStock, stockoutDate, coverageAfterDays, overCoverageWarning
}
```

### 2.8 PurchaseOrder / PurchaseOrderLine

```js
PurchaseOrder {
  id,                      // 'CF-0042'
  supplierId, proposalId, createdAt, expectedAt,
  status,                  // draft|ordered|confirmed|shipped|partially_received|received|cancelled
  lines, subtotal, shipping, total, userId
}
PurchaseOrderLine { articleId, orderedQty, receivedQty, unitPrice, lineTotal }
```

`incomingStock(article)` = Σ `(orderedQty − receivedQty)` sur les PO de statut
`ordered | confirmed | shipped | partially_received`. **Seule source du « en commande ».**
Le champ `incoming` de `demoStock` est supprimé à la migration.

### 2.9 ActivityEvent

```js
{ id, timestamp, type, severity, source, entityType, entityId,
  title, message, metadata, userId }
```

- `severity` : `INFO | WARNING | ERROR | CRITICAL`
- `source`   : `AUTOMATION | USER_ACTION | IMPORT | SYSTEM`
- `type`     : `IMPORT | STOCK | PURCHASE | SUPPLIER | ORDER | SCAN | USER`

`severity` et `source` sont **deux axes orthogonaux** (le brief les mélangeait).
`metadata` : jamais de donnée patient, jamais de contenu de fichier.

### 2.10 ImportJob / ImportError

```js
ImportJob   { id, at, dataType, fileName, rowCount, importedCount,
              rejectedCount, mapping, status, userId }
ImportError { jobId, rowNumber, column, rawValue, code, message }
```

`ImportError` conservé pour le **dernier** job par type (bornage localStorage).

### 2.11 Relations

```
Article 1─n ArticleSupplier n─1 Supplier      (≤ 1 preferred actif par article)
Article 1─n StockMovement                     (append-only, jamais purgé)
Article 1─n PurchaseProposalLine n─1 PurchaseProposal n─1 Supplier
PurchaseProposal 1─0..1 PurchaseOrder 1─n PurchaseOrderLine n─1 Article
Order (existant) ─BOM→ knownDemand            (réservation dérivée)
ImportJob 1─n ImportError
Tout ─→ ActivityEvent (entityType + entityId)
```

---

## 3. Formules — correction du double comptage

### 3.1 Le défaut de la V1.0

```
availableStock  = physicalStock − reservedStock
projectedStock  = availableStock + incoming − forecastDemand    ← FAUX
```

`reservedStock` et `forecastDemand` décrivent **la même chose** : les besoins BOM
des commandes en cours. Les soustraire successivement comptait la demande deux fois.

### 3.2 Les deux estimateurs de la demande

```
knownDemand(h)     = Σ besoins BOM des commandes DentalFlow actives, non encore
                     consommées, dont le besoin tombe dans [aujourd'hui, aujourd'hui+h]

baselineDemand(h)  = averageDailyConsumption × h

expectedDemand(h)  = max( knownDemand(h), baselineDemand(h) )
```

**Pourquoi `max` et non une somme.** Dans DentalFlow, *toute* consommation passe par
une commande via la nomenclature. `knownDemand` et `baselineDemand` ne sont donc pas
deux demandes distinctes : ce sont **deux estimateurs de la même grandeur physique**,
l'un tiré des commandes fermes, l'autre de l'historique. `max` retient le plus
pessimiste des deux — jamais leur addition, qui serait un double comptage.

Le comportement est celui recherché : à court terme les commandes fermes dominent
(le carnet est connu) ; à long terme la baseline domine (les commandes futures ne
sont pas encore saisies).

> **Limite assumée.** Si le carnet est partiellement saisi sur un horizon donné,
> `max` peut sous-estimer. Mitigé par `safetyStock` et par le déclenchement à la
> date de livraison. Raffinement possible en P2 : pondérer la baseline par le taux
> de saisie observé.

### 3.3 Formules canoniques

```
physicalStock      = Σ stockMovements.qty                    (dont OPENING)

reservedStock      = knownDemand(∞)                          ← indicateur d'état
availableStock     = physicalStock − reservedStock           ← AFFICHAGE UNIQUEMENT

incomingArrivingWithin(h) = Σ (orderedQty − receivedQty) des PO ouvertes
                             dont expectedAt ≤ aujourd'hui + h

projectedStock(h)  = physicalStock
                   + incomingArrivingWithin(h)
                   − expectedDemand(h)

coverageDays       = availableStock / averageDailyConsumption
stockoutDate       = plus petit d ≥ 0 tel que projectedStock(d) < 0
leadTime           = articleSupplier.leadTimeDays ?? supplier.leadTimeDays
lastSafeOrderDate  = stockoutDate − leadTime − securityMarginDays
```

**`availableStock` n'est jamais le point de départ d'une projection.** Il ne sert
qu'à répondre à « combien puis-je engager aujourd'hui ». `projectedStock` part
toujours de `physicalStock`, la demande étant déjà portée par `expectedDemand`.

`availableStock` peut être **négatif** — c'est un signal d'urgence légitime, jamais
ramené à zéro (§8, challenge 4).

### 3.4 Paramètres du moteur

| Paramètre | Défaut | Rôle |
|---|---|---|
| `reviewPeriodDays` | 14 j | durée qu'une livraison doit couvrir (§5.2) |
| `securityMarginDays` | 1 j | marge sur `lastSafeOrderDate` |
| `maxWaitDays` | 5 j | attente franco maximale |
| `minSavings` | 10 € | économie minimale justifiant une attente ou un changement de fournisseur |
| `maxCoverageDays` | 120 j | seuil d'alerte sur-couverture |
| `dormantCoverageDays` | 180 j | seuil de stock dormant |
| `dormantNoConsumptionDays` | 120 j | absence de consommation → dormant |

Non exposés dans l'UI en P1.

---

## 4. Vérification numérique des formules

Les cinq cas ci-dessous ont été **exécutés** et sont reproductibles à la main.
Notation : `h` = horizon en jours, `J+n` = dans n jours.

### CAS 1 — Aucune commande client → aucune action

Cire de modelage · `physical 60` · `safety 20` · `pack 10` · `daily 1,0` · `lead 5 j`

| Grandeur (h = lead = 5) | Valeur |
|---|---|
| knownDemand(5) | 2 |
| baselineDemand(5) | 1,0 × 5 = **5,0** |
| expectedDemand(5) | max(2 ; 5,0) = **5,0** |
| incomingArrivingWithin(5) | 0 |
| **projectedStockAtDelivery** | 60 + 0 − 5,0 = **55,0** |
| Test | 55,0 < 20 ? **NON** |

→ **Aucune action.** (= cas de démo A)

### CAS 2 — Commandes connues > consommation historique

Zircone HT · `physical 5` · `safety 4` · `pack 1` · `daily 0,2` · `lead 3 j`
Carnet cumulé : 2 u. à J+2, 4 u. à J+4, 6 u. à J+8

| Déclenchement (h = 3) | Valeur |
|---|---|
| knownDemand(3) | **2** |
| baselineDemand(3) | 0,2 × 3 = 0,6 |
| expectedDemand(3) | max(2 ; 0,6) = **2** ← le connu domine |
| **projectedStockAtDelivery** | 5 + 0 − 2 = **3** |
| Test | 3 < 4 ? **OUI → réapprovisionner** |

| Dimensionnement (h = 3 + 14 = 17) | Valeur |
|---|---|
| knownDemand(17) | **6** |
| baselineDemand(17) | 0,2 × 17 = 3,4 |
| expectedDemand(17) | max(6 ; 3,4) = **6** |
| projectedStock(17) | 5 + 0 − 6 = **−1** |
| rawOrderQty | 4 − (−1) = **5** |
| **suggestedQty** | ⌈5 / 1⌉ × 1 = **5** |
| Couverture après | (−1 + 5) / 0,2 = 20 j — OK |

→ **Proposition de 5 unités.** (= cas de démo B)

### CAS 3 — Consommation historique > commandes connues

PMMA temporaire · `physical 16` · `safety 15` · `pack 10` · `daily 1,5` · `lead 4 j`

| Déclenchement (h = 4) | Valeur |
|---|---|
| knownDemand(4) | 2 |
| baselineDemand(4) | 1,5 × 4 = **6,0** |
| expectedDemand(4) | max(2 ; 6,0) = **6,0** ← l'historique domine |
| **projectedStockAtDelivery** | 16 + 0 − 6,0 = **10,0** |
| Test | 10,0 < 15 ? **OUI → réapprovisionner** |

| Dimensionnement (h = 4 + 14 = 18) | Valeur |
|---|---|
| knownDemand(18) | 4 |
| baselineDemand(18) | 1,5 × 18 = **27,0** |
| expectedDemand(18) | **27,0** |
| projectedStock(18) | 16 − 27,0 = **−11,0** |
| rawOrderQty | 15 − (−11,0) = **26,0** |
| **suggestedQty** | ⌈26,0 / 10⌉ × 10 = **30** |
| Couverture après | (−11,0 + 30) / 1,5 = 12,7 j — OK |

### CAS 4 — Commande fournisseur déjà en route

Céramique e.max · `physical 3` · `safety 6` · `daily 1,0` · `lead 3 j`
PO ouverte : 20 u. attendues à J+2

| Déclenchement (h = 3) | Valeur |
|---|---|
| knownDemand(3) | 2 |
| baselineDemand(3) | 3,0 |
| expectedDemand(3) | **3,0** |
| incomingArrivingWithin(3) | **20** |
| **projectedStockAtDelivery** | 3 + 20 − 3,0 = **20,0** |
| Test | 20,0 < 6 ? **NON → aucune action** |

**Contrôle du garde-fou** : sans l'entrant, 3 − 3,0 = 0 < 6 aurait déclenché une
commande **inutile**. C'est précisément l'erreur que la dérivation de `incoming`
depuis les PO ouvertes élimine.

### CAS 5 — Conditionnement imposant un sur-stock

Adhésif céramique · `physical 4` · `safety 5` · `pack 50` · `daily 0,1` · `lead 3 j`

| Déclenchement (h = 3) | Valeur |
|---|---|
| expectedDemand(3) | max(1 ; 0,3) = **1** |
| **projectedStockAtDelivery** | 4 − 1 = **3** |
| Test | 3 < 5 ? **OUI → réapprovisionner** |

| Dimensionnement (h = 17) | Valeur |
|---|---|
| expectedDemand(17) | max(2 ; 1,7) = **2** |
| projectedStock(17) | 4 − 2 = **2** |
| rawOrderQty | 5 − 2 = **3** |
| **suggestedQty** | ⌈3 / 50⌉ × 50 = **50** |
| Couverture après | (2 + 50) / 0,1 = **520 j** |
| | ⚠ **520 j > 120 j → WARNING sur-couverture** |

Le conditionnement s'impose (on ne descend jamais sous le besoin), mais
l'avertissement est affiché et l'article est croisé avec `slowMovingStock()`.

---

## 5. Moteur de réapprovisionnement

### 5.1 Déclenchement — `shouldReplenish(article)`

```js
projectedStockAtDelivery = physicalStock
                         + incomingArrivingWithin(leadTime)
                         − expectedDemand(leadTime)

shouldReplenish = projectedStockAtDelivery < safetyStock
```

et les garde-fous :

```
article.active === true
ET aucune PO ouverte ne couvre déjà le besoin
ET aucune proposition ouverte ne porte déjà cet article
```

**`reorderPoint` est supprimé.** Il valait `safetyStock + daily × leadTime` et
constituait précisément la seconde soustraction de la demande. La question posée est
désormais directe et sans redondance : *« au moment où une commande passée aujourd'hui
arriverait, serai-je sous mon stock de sécurité ? »*

### 5.2 Quantité suggérée — politique de recouvrement (R,S)

```js
orderHorizon         = leadTime + reviewPeriodDays          // 14 j par défaut
desiredStockAtHorizon = safetyStock
rawOrderQty          = desiredStockAtHorizon − projectedStock(orderHorizon)
suggestedQty         = ceil(max(rawOrderQty, 0) / packSize) × packSize
suggestedQty         = max(suggestedQty, articleSupplier.minimumQty)
```

**Variante retenue et sa justification** (le brief laissait le choix ouvert).
Dimensionner sur `orderHorizon = leadTime` seul ferait arriver la livraison
exactement au niveau de sécurité, déclenchant une nouvelle proposition dès le
lendemain : le système « bat » et noie le responsable de propositions.

Ajouter une **période de révision** (`reviewPeriodDays`, 14 j) fait qu'une livraison
couvre le délai *plus* un cycle de commande. C'est la politique (R,S) classique en
gestion de stock : elle supprime le battement, réduit le nombre de commandes et
favorise mécaniquement l'atteinte du franco.

Deux horizons distincts, et c'est voulu :
- **déclencher** sur l'urgence → `h = leadTime` ;
- **dimensionner** sur la couverture → `h = leadTime + reviewPeriodDays`.

`desiredStockAtHorizon = safetyStock` : on commande pour être encore au niveau de
sécurité en fin d'horizon, jamais pour remplir un stock maximum (§23 du brief).

Contrôle de sur-couverture conservé :
`coverageAfterDays = (projectedStock(orderHorizon) + suggestedQty) / dailyDemand`
→ au-delà de `maxCoverageDays`, WARNING (jamais de blocage : le conditionnement prime).

### 5.3 Modes d'automatisation

Énumération `MANUAL | ASSISTED | SEMI_AUTO | AUTO` conservée dans le modèle ;
**seul `SEMI_AUTO` est implémenté**. DentalFlow ne transmet jamais de commande.

---

## 6. Franco de port

### 6.1 Correction conservée depuis la V1.0

L'arbitrage porte sur la **date limite de commande**, pas sur la date de rupture :

```
lastSafeOrderDate = stockoutDate − leadTime − securityMarginDays
```

Attendre jusqu'à la veille d'une rupture est déjà trop tard si le fournisseur livre
en trois jours.

### 6.2 Arbre de décision

```
BLOCKED     si prix manquant, fournisseur inactif, ou aucun tarif
NO_ACTION   si aucune ligne n'a de stockoutDate calculable
ORDER_NOW   si today ≥ lastSafeOrderDate                    ← la rupture prime (§34)
ORDER_NOW   si missingForFreeShipping ≤ 0                   ← franco déjà atteint
WAIT        si projectedFrancoDate ≤ lastSafeOrderDate
            ET waitDays ≤ maxWaitDays
            ET shippingCost ≥ minSavings
ORDER_NOW   sinon
```

`projectedFrancoDate` = première date à laquelle le panier fournisseur, **recalculé
jour après jour** à mesure que d'autres articles franchissent leur seuil de
déclenchement, atteint le franco. Non calculable → `ORDER_NOW` : on n'attend jamais
sur une inconnue.

### 6.3 Bornes de sécurité

- `maxWaitDays` : au-delà, on commande même sans risque de rupture.
- `waitingSince` : une proposition en `waiting` depuis plus de `maxWaitDays` bascule
  automatiquement en `ready` + événement `AUTOMATION`.
- **Priorité absolue** : le risque de rupture prime toujours sur l'économie de
  transport. Aucune exception, aucun seuil d'arbitrage.

---

## 7. Comparaison fournisseurs

```js
landedCost(supplier, lines) =
    Σ(unitPrice × qty)
  + (subtotal ≥ freeShippingThreshold ? 0 : shippingCost)
  − remises
```

```
si le fournisseur préféré ne peut pas livrer avant stockoutDate
   ET un alternatif le peut
   → recommander l'alternatif  (même plus cher)

sinon si landedCost(alternatif) < landedCost(préféré) − minSavings
        ET aucun risque de rupture
   → suggérer l'alternatif  (suggestion, pas substitution automatique)

sinon → conserver le préféré
```

`explanationReasons[]` est **obligatoire** : aucune recommandation ne s'affiche sans
au moins une raison. L'UI montre les deux premières, le reste au clic.

> **P2 — approvisionnement fractionné.** En urgence, le moteur dimensionne toute la
> quantité chez le fournisseur rapide, ce qui coûte plus que nécessaire (voir cas E,
> §12 : 18 € de surcoût sur 9 unités alors que 4 suffisaient à couvrir l'urgence).
> Un fractionnement — quantité d'urgence chez le rapide, solde chez le préféré —
> réduirait le surcoût. Écarté en P1 : une proposition = un fournisseur, plus simple
> à expliquer et à valider.

---

## 8. Réponses aux challenges obligatoires

| # | Risque | Réponse |
|---|---|---|
| 1 | **Commande inutile** | `incoming` dérivé des PO ouvertes (**vérifié cas 4** : évite une commande de 10 u. inutile) + un besoin ne peut être porté que par une seule proposition ouverte. |
| 2 | **Attente franco trop longue** | `maxWaitDays` (5 j) + `waitingSince` + bascule auto `waiting → ready` + rupture prioritaire. |
| 3 | **Double comptage entrant** | `incoming` **n'est plus un champ**. Une seule formule, à partir des PO ouvertes. Champ supprimé à la migration. |
| 4 | **Réserver plus que le stock** | Autorisé : `availableStock` peut être **négatif**. Refuser masquerait un besoin de production réel ; le négatif *est* le signal. Jamais de clamp silencieux. |
| 5 | **Prix fournisseur manquant** | Proposition en `draft` + `blocking:['missing_price']`, **non validable**, événement `ERROR`. Jamais de prix supposé à 0 (fausserait le franco). |
| 6 | **Fournisseur principal indisponible** | Repli sur alternatif **avec raison affichée**. Aucun fournisseur → article non réapprovisionnable + `ERROR`. |
| 7 | **Deux propositions, même stock** | Attribution déterministe : préféré, sinon landed cost le plus bas, sinon plus petit id. Un article n'apparaît que dans une proposition ouverte. |
| 8 | **Annulation d'une commande client** | `knownDemand` étant dérivé, le besoin disparaît de lui-même. Les propositions ouvertes sont recalculées ; une proposition devenue injustifiée passe en `dismissed` **avec événement** — jamais supprimée en silence. |
| 9 | **Réception partielle** | `RECEIPT` de la quantité **réellement reçue**. PO → `partially_received`, reliquat toujours dans `incoming` → **aucune** nouvelle proposition (**vérifié cas G**, §12). |
| 10 | **Correction manuelle du stock** | `ADJUSTMENT` (jamais d'écrasement, jamais de purge). Recalcul du moteur ; proposition devenue inutile → recommandation de rejet + événement. |
| 11 | **Conditionnement supérieur au besoin** | Arrondi **toujours vers le haut**, jamais sous le besoin, puis WARNING au-delà de `maxCoverageDays` (**vérifié cas 5** : 520 j de couverture signalés). |
| 12 | **Double consommation au rescannage** | `consumptionKey` (§2.4) : un `CONSUMPTION` par *(commande, article, poste)*. Idempotent par construction. |

---

## 9. Stock dormant

```js
slowMovingStock():
  articles où  coverageDays > dormantCoverageDays (180)
            OU aucun CONSUMPTION depuis dormantNoConsumptionDays (120)
  → { article, coverageDays, lastConsumptionAt, recommendation:'DO_NOT_REORDER' }
```

Exclus des propositions sauf passage sous `safetyStock`. Affichés dans le filtre
**Dormants** de la liste Articles (§11.1).

---

## 10. Import / Export

### 10.1 Assistant — 6 étapes

`Type → Fichier → Mapping → Prévisualisation → Validation → Résultat`

Types : articles, stocks, fournisseurs, tarifs fournisseurs, commandes, utilisateurs.

### 10.2 Mapping

Auto-détection par normalisation (minuscules, sans accents/ponctuation) puis table de
synonymes. **Toujours corrigeable.** Une colonne obligatoire non mappée bloque l'étape.

### 10.3 Validation — aucune erreur silencieuse

```
184 lignes détectées · 176 prêtes à importer · 8 à vérifier
                                    [ Afficher uniquement les erreurs ]
```

Codes : `MISSING_REQUIRED`, `INVALID_NUMBER`, `UNKNOWN_SUPPLIER`,
`DUPLICATE_REFERENCE`, `UNKNOWN_ARTICLE`, `NEGATIVE_QTY`.

Les lignes valides sont importées, les lignes en erreur **rejetées et listées**,
jamais ignorées. Le job est journalisé.

### 10.4 Import de stock → ADJUSTMENT

Un import ne réécrit jamais le solde : il calcule `delta = valeurImportée −
soldeActuel` et écrit un `ADJUSTMENT` par article concerné (`sourceType:'import'`,
`jobId`). Delta nul → aucun mouvement. L'historique reste intact et traçable.

### 10.5 Export

- **Métier**, CSV (P1) : commandes, production, stocks, articles, fournisseurs,
  achats, traçabilité.
- **Export complet**, JSON unique : sauvegarde / diagnostic.
  Critère de validité : **un export complet doit être ré-importable** et restituer
  l'état à l'identique.
- XLSX en P2, sous réserve d'une CDN autorisée.

---

## 11. UX écran par écran

### 11.1 Stocks — Articles · Fournisseurs

L'onglet « Réapprovisionnement » de la V1.0 est **supprimé** : il aurait doublonné
avec Achats sur le même sujet.

```
STOCKS   [ Articles ] [ Fournisseurs ]

Filtres :  Tous · À surveiller · Stock faible · Dormants

Zircone HT
Disponible 3 · En commande 5 · Besoin 7 j : 6            [Attention]
```

Interdit sur une ligne : physique + réservé + projeté + sécurité + rotation +
consommation + délai + prix + franco simultanément.

- **Clic article** → popup : physique / réservé / disponible / en commande / projeté ·
  couverture · consommation · fournisseurs (préféré + alternatifs) · derniers mouvements.
- **Clic fournisseur** → popup : nom · délai · franco · transport · articles associés ·
  prochaine proposition. Édition → side-window.

### 11.2 Achats — Propositions · Commandes fournisseurs

```
PROPOSITIONS — À DÉCIDER
┌────────────────────────────────────────────────┐
│ Ivoclar          4 références        428 € HT  │
│ Franco 500 € · manque 72 €                     │
│ Aucune rupture avant J+8                       │
│ → ATTENDRE ET REGROUPER                        │
│           [ Voir la proposition ] [ Commander ]│
└────────────────────────────────────────────────┘

COMMANDES FOURNISSEURS
CF-0042 · Henry Schein · attendu J+1 · partiellement reçue (8/9)
```

Historique replié par défaut.

### 11.3 Journal d'activité

Filtres : `Toutes | Erreurs | Alertes | Automatisations | Actions`
(combinent `severity` et `source`). **Lecture seule.**

Rétention : 500 événements en mémoire, 200 persistés, purge FIFO sauf `CRITICAL`.
*(La purge porte sur les événements — jamais sur les mouvements de stock, §2.2.)*

### 11.4 Import — `wizardLayer` dédié

Wizard **centré**, mais dans une couche `wizardLayer` **distincte** de `quick-layer`.
`quick-layer` reste réservé à la consultation d'information ; un assistant à 6 étapes
avec état interne, navigation avant/arrière et confirmation de sortie n'a pas les
mêmes règles de fermeture. Mutualiser les deux mélangerait deux cycles de vie.

### 11.5 Export — menu utilisateur → Données

Boutons simples, un clic = un fichier. Pas d'assistant.

### 11.6 Accueil

Maximum **2 alertes achats**, uniquement : rupture imminente, PO critique en retard.
**Jamais** « franco bientôt atteint ». Clic → détail Achats.

---

## 12. Scénarios de démonstration — recalculés

### 12.1 Jeu de données

Aucun verdict n'est stocké : `recommendedAction` est **toujours recalculé**.

| Article | phys. | sécu. | pack | conso./j | délai | Fournisseur | PU |
|---|---|---|---|---|---|---|---|
| Zircone HT | 5 | 4 | 1 | 0,20 | 3 j | Ivoclar (préf.) | 42 € |
| Zircone HT (alt.) | | | | | 1 j | Henry Schein | 46 € |
| Adhésif céramique | 4 | 5 | 50 | 0,10 | 3 j | Ivoclar | 1,20 € |
| Colorant zircone | 2 | 3 | 4 | 0,05 | 3 j | Ivoclar | 17 € |
| Disques de fraisage | 6 | 6 | 5 | 0,20 | 3 j | Ivoclar | 18 € |
| Liquide de glaçage | 11 | 8 | 6 | 0,50 | 3 j | Ivoclar | 14 € |
| Céramique e.max | 3 | 6 | 10 | 1,00 | 3 j | Ivoclar (PO 20 à J+2) | 31 € |
| PMMA temporaire | 16 | 15 | 10 | 1,50 | 4 j | Dental Direct | 22 € |
| Cire de modelage | 60 | 20 | 10 | 1,00 | 5 j | Dental Direct | 6 € |
| Zircone C4 | 24 | 2 | 5 | 0,067 | 3 j | Ivoclar | 42 € |

Ivoclar : franco 500 €, transport 18 €, délai 3 j.
Henry Schein : franco 200 €, transport 15 €, délai 1 j.

### 12.2 Les 7 cas — résultats dérivés

| Cas | Situation | Calcul | Verdict |
|---|---|---|---|
| **A** | Cire de modelage | projeté à livraison **55** ≥ sécu. 20 | **Aucune action** |
| **B** | Zircone HT | projeté **3** < sécu. 4 → qty **5** | **Proposition** |
| **C** | Panier Ivoclar | **428 €**, manque **72 €**, franco atteint **J+4**, `lastSafeOrderDate` **J+4** | **ATTENDRE ET REGROUPER** |
| **D** | +1 commande urgente (2 bridges, 4 u. à J+2) | rupture **J+8 → J+2**, `lastSafeOrderDate` **J−2** dépassée | **COMMANDER MAINTENANT** |
| **E** | Arbitrage fournisseur | Ivoclar J+3 **trop tard** / Henry Schein J+1 **à temps**, surcoût **18 €** | **Henry Schein** |
| **F** | Zircone C4 | couverture **360 j** > 180 j ; projeté 23,8 ≥ sécu. 2 | **NE PAS COMMANDER** |
| **G** | CF-0042, 8 reçus / 9 | `incoming` 1 ; projeté **8** ≥ sécu. 4 | **Aucune nouvelle proposition** |

### 12.3 Détail du cas C — panier et attente

| Ligne | Qté dérivée | PU | Montant |
|---|---|---|---|
| Zircone HT | 5 | 42 € | 210 € |
| Adhésif céramique | 50 | 1,20 € | 60 € |
| Colorant zircone | 4 | 17 € | 68 € |
| Disques de fraisage | 5 | 18 € | 90 € |
| **Sous-total** | | | **428 €** |

- Franco 500 € → **manque 72 €**
- Ruptures : Zircone HT **J+8** · Disques J+31 · Adhésif J+41 · Colorant J+41
- `lastSafeOrderDate` = J+8 − 3 − 1 = **J+4**
- Le **Liquide de glaçage** franchit son seuil à **J+4** (12 u. × 14 € = 168 €)
  → panier **596 € ≥ 500 €** → `projectedFrancoDate` = **J+4**
- Décision : J+4 ≤ J+4 ✔ · attente 4 j ≤ 5 j ✔ · transport 18 € ≥ 10 € ✔
  → **ATTENDRE ET REGROUPER**

Explication affichée :
> « Le franco de 500 € sera atteint sous 4 jours en regroupant le liquide de glaçage.
> Aucune rupture n'est prévue avant 8 jours. Économie de transport : 18 €. »

### 12.4 Détail des cas D et E — la bascule

Une nouvelle commande client (2 bridges = 4 disques, échéance J+2) arrive.

| | Avant | Après |
|---|---|---|
| knownDemand(2) | 2 | **6** |
| projectedStock(2) | 5 − 2 = 3 | 5 − 6 = **−1** |
| `stockoutDate` | J+8 | **J+2** |
| `lastSafeOrderDate` | J+4 | **J−2** (dépassée) |
| Décision | WAIT | **ORDER_NOW** |
| Quantité (h = 17) | 5 | **9** |

Arbitrage fournisseur sur 9 unités :

| Fournisseur | Articles | Transport | Landed | Délai | À temps ? |
|---|---|---|---|---|---|
| Ivoclar (préféré) | 9 × 42 = 378 € | 18 € | **396 €** | J+3 | ✗ après la rupture |
| Henry Schein | 9 × 46 = 414 € | 0 € (franco 200) | **414 €** | J+1 | ✔ |

> « Rupture Zircone HT prévue dans 2 jours. Ivoclar livre en 3 jours — trop tard.
> Henry Schein livre demain. Surcoût estimé : 18 €. »

**Divergence assumée avec le brief.** Les illustrations du brief (72 €/76 €/12 €)
n'ont pas été reproduites : les montants ci-dessus sont **calculés** par les règles à
partir du jeu de données, conformément à l'exigence « aucun résultat ne doit dépendre
d'une valeur codée juste pour produire la démonstration ». Le surcoût réel est 18 €.

### 12.5 Enchaînement de démonstration

1. Stocks → Zircone HT en tension.
2. Achats → proposition Ivoclar 428 €, franco 500 €.
3. Recommandation **ATTENDRE ET REGROUPER** (raison affichée).
4. Création d'une commande client (2 bridges, échéance J+2).
5. Rupture recalculée J+8 → **J+2**, sans intervention.
6. Recommandation bascule en **COMMANDER MAINTENANT**.
7. Ivoclar trop tard → **Henry Schein** recommandé, surcoût 18 € expliqué.
8. Validation → **CF-0042** créée.
9. Réception **8/9** → stock +8, reliquat 1 attendu, statut `partially_received`.
10. Aucune nouvelle proposition (le reliquat est couvert par `incoming`).
11. Le Journal contient les 10 étapes, horodatées via `Clock.now()`.

**Point clé** : l'étape 5-6 se produit **sans action de l'utilisateur** — c'est la
preuve que le moteur recalcule au lieu d'afficher un état figé.

---

## 13. Cas limites

1. **Article sans fournisseur** → non réapprovisionnable, `ERROR`, exclu des propositions.
2. **Fournisseur sans franco** (`null`) → jamais de `WAIT`.
3. **Consommation moyenne nulle** → pas de `stockoutDate` ; déclenche uniquement sous `safetyStock`.
4. **Commande sans nomenclature** (type inconnu) → aucune réservation + `WARNING`.
5. **Réception supérieure au commandé** → acceptée, `RECEIPT` du réel + `WARNING` surlivraison.
6. **PO annulée après réception partielle** → le reçu reste acquis, le reliquat sort de `incoming`.
7. **Article désactivé avec stock** → visible en stock, exclu du réappro.
8. **Import créant un doublon de référence** → ligne rejetée, jamais de fusion automatique.
9. **Rescannage d'un poste consommateur** → aucun effet (`consumptionKey`).
10. **Franco atteint puis besoin annulé** → panier repasse sous le franco, recommandation recalculée.
11. **Deux `preferred = true` sur un article** → `ERROR` + repli sur le landed cost le plus bas.

---

## 14. Risques

### 14.1 Produit

| Risque | Gravité | Mitigation |
|---|---|---|
| Dérive ERP — Achats devient une usine | **Élevée** | 1 page, 2 sections, 2 actions par carte. Toute colonne doit se justifier. |
| Recommandation incomprise | Élevée | `explanationReasons` obligatoire, jamais de verdict nu. |
| Sur-notification | Moyenne | 2 alertes achats maximum, rupture imminente uniquement. |
| Sur-commande / sous-commande | Élevée | Garde-fous §8 + les 5 tests numériques §4 rejouables en régression. |

### 14.2 Technique

| Risque | Mitigation |
|---|---|
| Saturation `localStorage` | Bornage des **événements** (200) ; les mouvements ne sont pas purgés mais restent légers (~1 ko/mouvement, ordre de grandeur : quelques centaines). Réévaluer si > 5 000. |
| Perte de données à la migration 5 → 6 | Réutiliser le pattern `migrateUsers` validé en V3.3.2 : fusion par présence de clé, jamais de reset. |
| Recalcul à chaque render | Cache mémoire invalidé sur mutation. |
| Concurrence en SaaS | §14.4 |

### 14.3 Opérations à rendre transactionnelles en SaaS

1. **Validation d'une proposition → PO** : deux validations simultanées créeraient
   deux commandes. *Verrou optimiste sur `proposal.status` + unicité `proposalId`.*
2. **Réception** : mouvements + statut PO dans **une seule** transaction.
3. **Consommation au scan** : `consumptionKey` doit porter une **contrainte d'unicité**
   en base — l'idempotence applicative ne suffit pas sous concurrence.

### 14.4 Droits

| Rôle | Droits |
|---|---|
| Responsable | Valider une proposition, commander, réceptionner |
| Admin | Fournisseurs, tarifs, paramètres moteur, import/export |
| Technicien | Consommation (via scan), réception si autorisé |

POC : modélisés, non appliqués.

### 14.5 Ajouts au roadmap P2 (non implémentés)

- **`SUPPLIER RELIABILITY`** — délai théorique vs délai réellement constaté depuis les
  réceptions (`expectedAt` vs date du `RECEIPT`). Alimenterait `lastSafeOrderDate`
  avec un délai observé plutôt que déclaré.
- **`PRICE HISTORY`** — historique des tarifs par `ArticleSupplier` et variation en %.
  Permettrait d'alerter sur une hausse et d'affiner la comparaison fournisseurs.
- **`BALANCE_CARRY_FORWARD`** — clôture/report pour archivage des mouvements (§2.2).
- **`orderDays`**, **`expressShippingCost`**, **approvisionnement fractionné** (§7),
  **`targetCoverageDays`** (remplacerait `desiredStockAtHorizon = safetyStock` par un
  objectif de couverture explicite).

---

## 15. Décision restant à prendre

Une seule question ouverte à ce stade :

| Question | Recommandation |
|---|---|
| **Délais en jours calendaires ou ouvrés ?** Les calculs de `stockoutDate` et `lastSafeOrderDate` de ce document sont en jours **calendaires**. Un délai fournisseur de 3 j exprimé un vendredi tombe en réalité le mercredi suivant. | **Jours ouvrés** pour les délais fournisseurs et `lastSafeOrderDate` (une fonction `addBusinessDays` existe déjà dans le POC), **jours calendaires** pour la consommation. À confirmer : cela décale certaines dates de la démo sans changer aucun verdict. |

Les 10 arbitrages de la V1.0 sont validés et intégrés.

---

## 16. Plan d'implémentation

### P0 — Fondations (aucune UI nouvelle)

1. Migration `schemaVersion 5 → 6` : `demoStock` → `articles` + mouvements `OPENING` ;
   suppression du champ `incoming` ; `min` → `safetyStock` ; suppression de `capacity`
   des calculs (conservé pour l'affichage).
2. `stockMovements` append-only + `physicalStock()` dérivé.
3. `suppliers`, `articleSuppliers` (invariant `preferred` unique), `BILL_OF_MATERIALS`.
4. `activityEvents` + `logActivity()` ; `logAudit()` devient un adaptateur ; la table
   d'audit de Rapports devient une vue filtrée du store unique.
5. `StockEngine` : `physicalStock`, `reservedStock`, `availableStock`,
   `incomingArrivingWithin`, `projectedStock`, `stockoutDate`.
6. Écran Stocks mis à jour (Disponible / En commande / Besoin / État + filtres).

**Sortie P0** : stock affiché identique à la V3.3.2 mais entièrement dérivé des
mouvements. Les 5 tests numériques du §4 passent. 0 erreur console.

### P1 — Moteur et Achats

7. `DemandEngine` : `knownDemand` / `baselineDemand` / `expectedDemand`.
8. `ReplenishmentEngine` : `shouldReplenish`, `calculateSuggestedQuantity`.
9. `SupplierEngine` : `landedCost`, franco, comparaison.
10. `ProposalEngine` : regroupement, `recommendedAction`, `explanationReasons`.
11. Écran **Achats** + popup détail proposition.
12. `PurchaseOrder`, validation, réception (dont partielle) → mouvements `RECEIPT`.
13. Consommation au scan avec `consumptionKey` (idempotente).
14. Écran **Journal d'activité**.
15. Jeu de données §12.1 → les 7 cas doivent tomber juste **sans valeur forcée**.

**Sortie P1** : l'enchaînement §12.5 se déroule intégralement ; la bascule
ATTENDRE → COMMANDER MAINTENANT se produit sans intervention.

### P2 — Données et confort

16. Export CSV métier + export complet JSON ré-importable.
17. Assistant d'import (`wizardLayer`, mapping, validation, rapport d'erreurs).
18. `slowMovingStock()` + filtre Dormants.
19. Onglet Fournisseurs (popup / side-window).
20. 2 alertes achats sur l'Accueil.
21. XLSX si CDN autorisée ; `expressShippingCost` ; `orderDays` ; fiabilité
    fournisseur ; historique des prix ; approvisionnement fractionné.

---

## 17. Hors scope

Comptabilité, facturation fournisseur, rapprochement bancaire, OCR, EDI, connexion
fournisseur, paiement, fiscalité, marketplace, IA générative d'achat.

**Le moteur d'achat reste déterministe, rule-based, testable et explicable.
Aucune IA dans la boucle de décision.**

---

## STOP — validation requise

`dentalflow-next-poc-v3.3.2.html` n'a pas été modifié.
Reste à trancher : la **question des jours ouvrés** (§15).
L'implémentation suivra avec Claude Sonnet 5, effort élevé.
