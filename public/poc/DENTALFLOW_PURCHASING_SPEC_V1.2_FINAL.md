# DentalFlow — Stocks intelligents, Achats assistés, Import/Export, Journal
## Spécification fonctionnelle — **V1.2 FINAL**

Base de code : `dentalflow-next-poc-v3.3.2.html` (schemaVersion 5)
Remplace : `DENTALFLOW_PURCHASING_SPEC_V1.1.md`
Statut : **spécification** — aucun fichier applicatif modifié.

Les 16 tests de ce document ont été **exécutés** ; tous les résultats affichés sont
des sorties réelles, reproductibles à la main.

---

## 0. Ce qui change par rapport à la V1.1

| # | Correction | §  |
|---|---|---|
| 1 | **Calendrier ouvré** lundi-vendredi pour délais, marge et demande statistique | §2 |
| 2 | **Une PO ouverte ne bloque plus le réappro** — bug de la V1.1 | §6.1 |
| 3 | **Une proposition ouverte est mise à jour, pas bloquante** — bug de la V1.1 | §7 |
| 4 | Invariant « un article une seule fois par proposition » = clé de réconciliation, **jamais** un verrou | §7.2 |
| 5 | `minimumQty` appliqué **avant** l'arrondi au conditionnement | §6.2 |
| 6 | Règle complète de `Supplier.minimumOrder` | §8 |
| 7 | `freeShippingThreshold == null` traité explicitement (piège de coercition JS) | §9.1 |
| 8 | `coverageDays` protégé contre la division par zéro | §9.2 |
| 9 | CAS 1 rendu mathématiquement cohérent (`knownDemand = 0`) | §5 |
| 10 | Migration `incoming` → **PO synthétique**, aucune quantité perdue | §10 |
| 11 | 5 tests nouveaux : PO insuffisante, recalcul, pack+min, minimumOrder, week-end | §5 |
| 12 | Tableau des invariants finaux | §14 |

Arbitrages antérieurs validés et intégrés : Données dans le menu utilisateur · Journal
unifié `activityEvents` · CSV P1 / XLSX P2 · réservations dérivées · solde dérivé des
mouvements · consommation au scan · express P2 · `SEMI_AUTO` seul · BOM non éditable
en P1 · 2 alertes Achats maximum sur l'Accueil.

---

## 1. Architecture

> Le moteur calcule. L'interface explique. Le responsable décide.

```
UI        Stocks · Achats · Journal · Données
          (liste → popup information → side-window action)
              ▲ lit des vues, ne calcule rien
MOTEURS   StockEngine · DemandEngine · ReplenishmentEngine
          SupplierEngine · ProposalEngine
          purs, déterministes, sans IA, testables
              ▲ lit un état normalisé
DONNÉES   articles · suppliers · articleSuppliers
          stockMovements (append-only) · purchaseOrders
          purchaseProposals · activityEvents
```

Aucun moteur n'écrit dans l'état. Seules des commandes explicites (valider,
réceptionner, ajuster, scanner) mutent, et chacune émet un `activityEvent`.

**Séparation des responsabilités (corrigée en V1.2)**

- `ReplenishmentEngine` calcule le **besoin réel**, indépendamment de toute
  proposition existante.
- `ProposalEngine` **réconcilie** ce besoin avec les propositions ouvertes :
  il crée, met à jour ou rejette.

Cette séparation est ce qui empêche une proposition existante de figer un besoin
périmé (§7).

### Navigation

| Emplacement | Contenu |
|---|---|
| Outils | **Achats**, **Journal d'activité** |
| Stocks | onglets **Articles** · **Fournisseurs** |
| Menu utilisateur | **Données** → Import / Export |

`PRIMARY_NAV` (Accueil, Commandes, Production, Messages) inchangé.

---

## 2. Calendrier métier — décision §15 tranchée

**Calendrier du laboratoire : lundi → vendredi, fixe en P1.** Configurable en P2.

| Grandeur | Calendrier |
|---|---|
| Délais fournisseurs (`leadTimeDays`) | **jours ouvrés** |
| `securityMarginDays` | **jours ouvrés** |
| `reviewPeriodDays` | **jours ouvrés** (10 jo ≈ 2 semaines) |
| `baselineDemand` | **jours ouvrés** — aucune consommation statistique le week-end |
| `knownDemand` | **dates réelles** des besoins des commandes |

### Primitives

```js
isLabWorkingDay(date)        // lun–ven en P1
addLabWorkingDays(date, n)   // avance de n jours ouvrés
subLabWorkingDays(date, n)   // recule de n jours ouvrés
businessDaysBetween(a, b)    // nombre de jours ouvrés de a (exclu) à b (inclus)
```

**Tous les horizons `h` de ce document sont exprimés en jours ouvrés.** La conversion
en date calendaire passe par `addLabWorkingDays(today, h)`.

`averageConsumption = { qty, periodWorkingDays }` — la consommation est mesurée sur
des **jours de production**, pas des jours calendaires :
`dailyWorkingDemand = qty / periodWorkingDays`.

### TEST 16 — week-end *(exécuté)*

Aujourd'hui = **vendredi 21/08/2026**.

```
addLabWorkingDays(vendredi, 3)          = mercredi 26/08     ✔ attendu mercredi
isLabWorkingDay(samedi)  = false
isLabWorkingDay(dimanche)= false                             ✔ aucune conso week-end
businessDaysBetween(ven 21/08, mer 26/08) = 3                ✔
```

`lastSafeOrderDate` utilise le même calendrier : `subLabWorkingDays(stockoutDate,
leadTime + securityMargin)`.

---

## 3. Modèle de données

### 3.1 Article

```js
{ id, reference, label, category, unit,
  capacity,            // capacité physique de stockage — AFFICHAGE uniquement
  safetyStock,         // tampon incompressible — utilisé par le moteur
  averageConsumption,  // { qty, periodWorkingDays }
  active }
```

Supprimés : `targetStock`, `preferredSupplierId`, `reorderPoint` (§6.1).
Dérivés, jamais stockés : `physicalStock`, `reservedStock`, `availableStock`,
`incomingStock`, `projectedStock(h)`, `coverageDays`.

### 3.2 StockMovement — append-only, jamais purgé

```js
{ id, at, articleId,
  type,            // OPENING | RECEIPT | CONSUMPTION | ADJUSTMENT | RETURN
  qty,             // signé
  reason, sourceType, sourceId,
  consumptionKey,  // CONSUMPTION uniquement
  userId }
```

Immuable. Une correction n'édite jamais un mouvement : elle en ajoute un
`ADJUSTMENT`. **Aucune purge** — tant que `physicalStock = Σ mouvements`, supprimer
un mouvement falsifierait le solde.

> **P2 / SaaS — `BALANCE_CARRY_FORWARD`.** Mouvement de clôture portant le solde
> reporté ; les mouvements antérieurs deviennent archivables sans altérer le solde.

### 3.3 Nomenclature (BOM) — non éditable en P1

```js
'Bridge 3 éléments': [{ articleId:'ART-ZIR-HT-001', qty:2, consumeAtStageId:'STG-003' }],
'Couronne céramo-métallique': [
   { articleId:'ART-CER-EMX-003', qty:1, consumeAtStageId:'STG-004' },
   { articleId:'ART-ADH-CER-008', qty:1, consumeAtStageId:'STG-005' }],
```

`consumeAtStageId` est porté par la **ligne**, pas par l'article : le même adhésif
peut être consommé au Contrôle qualité sur un travail et à la Céramique sur un autre.
La phase appartient au couple *(type de travail, article)*.

### 3.4 Consommation au scan — idempotente

```js
consumptionKey = `${orderId}::${articleId}::${consumeAtStageId}`
```

Au scan d'un poste, pour chaque ligne de BOM dont `consumeAtStageId` = poste scanné :

```
si un CONSUMPTION portant cette clé existe déjà → ne rien créer
sinon                                          → créer le mouvement
```

**Un rescannage ne consomme jamais deux fois.** Correction exclusivement par
`ADJUSTMENT`. En SaaS, la clé doit porter une **contrainte d'unicité en base** —
l'idempotence applicative ne suffit pas sous concurrence.

### 3.5 Supplier

```js
{ id, name, active, leadTimeDays,      // jours ouvrés
  freeShippingThreshold,               // null admis (§9.1)
  shippingCost, minimumOrder, notes }
```

Supprimés : `orderDays` (P2), `expressShippingCost` (P2).

### 3.6 ArticleSupplier

```js
{ articleId, supplierId, supplierReference,
  unitPrice, packSize, minimumQty, leadTimeDays, preferred }
```

**Invariant** : au plus **un** `ArticleSupplier` actif avec `preferred = true` par
article. Violation → `ERROR` + repli sur le landed cost le plus bas.

### 3.7 PurchaseProposal / Line

```js
PurchaseProposal {
  id, supplierId, createdAt, updatedAt, waitingSince,
  status,                 // draft|waiting|ready|approved|dismissed|converted
  lines, subtotal, shippingCost, total,
  freeShippingThreshold, missingForFreeShipping,
  minimumOrder, missingForMinimumOrder,
  recommendedAction,      // ORDER_NOW | WAIT | NO_ACTION | BLOCKED
  riskLevel, earliestStockoutDate, lastSafeOrderDate, projectedFrancoDate,
  explanationReasons: [], blocking: [] }

PurchaseProposalLine {
  articleId, suggestedQty, packSize, minimumQty, unitPrice, lineTotal,
  projectedStock, stockoutDate, coverageAfterDays, overCoverageWarning }
```

### 3.8 PurchaseOrder / Line

```js
PurchaseOrder {
  id, supplierId, proposalId, createdAt, expectedAt,
  status,                 // draft|ordered|confirmed|shipped|partially_received|received|cancelled
  lines, subtotal, shipping, total, userId,
  migrationSource }       // 'legacyIncoming' pour les PO de migration (§10)
PurchaseOrderLine { articleId, orderedQty, receivedQty, unitPrice, lineTotal }
```

`incomingStock(article)` = Σ `(orderedQty − receivedQty)` sur les PO de statut
`ordered | confirmed | shipped | partially_received`. **Seule source du « en commande ».**

### 3.9 ActivityEvent

```js
{ id, timestamp, type, severity, source, entityType, entityId,
  title, message, metadata, userId }
```

`severity` : `INFO | WARNING | ERROR | CRITICAL` — `source` : `AUTOMATION |
USER_ACTION | IMPORT | SYSTEM` — `type` : `IMPORT | STOCK | PURCHASE | SUPPLIER |
ORDER | SCAN | USER`. Deux axes orthogonaux. Jamais de donnée patient dans `metadata`.

### 3.10 ImportJob / ImportError

```js
ImportJob   { id, at, dataType, fileName, rowCount, importedCount,
              rejectedCount, mapping, status, userId }
ImportError { jobId, rowNumber, column, rawValue, code, message }
```

---

## 4. Formules canoniques

```
physicalStock      = Σ stockMovements.qty                      (dont OPENING)

knownDemand(h)     = Σ besoins BOM des commandes actives non consommées
                     dont la date prévue ≤ addLabWorkingDays(today, h)
baselineDemand(h)  = dailyWorkingDemand × h                    (h en jours ouvrés)
expectedDemand(h)  = max( knownDemand(h), baselineDemand(h) )

reservedStock      = knownDemand(∞)                            ← indicateur d'état
availableStock     = physicalStock − reservedStock             ← AFFICHAGE uniquement

incomingArrivingWithin(h) = Σ (orderedQty − receivedQty) des PO ouvertes
                            dont expectedAt ≤ addLabWorkingDays(today, h)

projectedStock(h)  = physicalStock + incomingArrivingWithin(h) − expectedDemand(h)

stockoutDate       = plus petit h ≥ 0 tel que projectedStock(h) < 0
lastSafeOrderDate  = subLabWorkingDays(stockoutDate, leadTime + securityMargin)
coverageDays       = availableStock / dailyWorkingDemand       (voir §9.2)
```

**Pourquoi `max` et non une somme.** Dans DentalFlow, *toute* consommation passe par
une commande via la nomenclature. `knownDemand` et `baselineDemand` ne sont donc pas
deux demandes distinctes : ce sont **deux estimateurs de la même grandeur physique**,
l'un tiré du carnet ferme, l'autre de l'historique. `max` retient le plus pessimiste ;
les additionner serait un double comptage.

**`availableStock` n'est jamais le point de départ d'une projection.** Il répond à
« combien puis-je engager aujourd'hui ». `projectedStock` part toujours de
`physicalStock`, la demande étant déjà portée par `expectedDemand`.
`availableStock` peut être **négatif** — signal d'urgence légitime, jamais ramené à 0.

### Paramètres du moteur

| Paramètre | Défaut | Unité |
|---|---|---|
| `reviewPeriodDays` | 10 | jours ouvrés |
| `securityMarginDays` | 1 | jour ouvré |
| `maxWaitDays` | 5 | jours ouvrés |
| `minSavings` | 10 € | — |
| `maxCoverageDays` | 120 | jours ouvrés |
| `dormantCoverageDays` | 180 | jours ouvrés |
| `dormantNoConsumptionDays` | 120 | jours ouvrés |

---

## 5. Vérification numérique — 16 tests exécutés

### Les 5 cas de formule

#### CAS 1 — Aucune commande client *(corrigé : `knownDemand = 0`)*

Cire de modelage · `phys 60` · `sécu 20` · `pack 10` · `conso 1,0/jo` · `lead 5 jo`

| Déclenchement (h = 5 jo) | Valeur |
|---|---|
| knownDemand(5) | **0** ← aucune commande, cohérent avec le titre |
| baselineDemand(5) | 1,0 × 5 = **5,0** |
| expectedDemand(5) | max(0 ; 5,0) = **5,0** |
| projeté à livraison (**ven 28/08**) | 60 + 0 − 5,0 = **55,0** |
| Test | 55,0 < 20 ? **NON → aucune action** |

#### CAS 2 — Commandes connues > historique

Zircone HT · `phys 5` · `sécu 4` · `pack 1` · `conso 0,2/jo` · `lead 3 jo`

| Déclenchement (h = 3 jo) | Valeur |
|---|---|
| knownDemand(3) / baselineDemand(3) | **2** / 0,6 |
| expectedDemand(3) | **2** ← le connu domine |
| projeté à livraison (**mer 26/08**) | 5 − 2 = **3** |
| Test | 3 < 4 ? **OUI → réapprovisionner** |

| Dimensionnement (h = 3 + 10 = 13 jo) | Valeur |
|---|---|
| knownDemand(13) / baselineDemand(13) | **6** / 2,6 |
| projectedStock(13) | 5 − 6 = **−1** |
| rawOrderQty | 4 − (−1) = **5** |
| **suggestedQty** | **5** · couverture 20 jo |

#### CAS 3 — Historique > commandes connues

PMMA temporaire · `phys 16` · `sécu 15` · `pack 10` · `conso 1,5/jo` · `lead 4 jo`

| Déclenchement (h = 4 jo) | Valeur |
|---|---|
| knownDemand(4) / baselineDemand(4) | 2 / **6,0** |
| expectedDemand(4) | **6,0** ← l'historique domine |
| projeté à livraison (**jeu 27/08**) | 16 − 6,0 = **10,0** |
| Test | 10,0 < 15 ? **OUI → réapprovisionner** |

| Dimensionnement (h = 14 jo) | Valeur |
|---|---|
| expectedDemand(14) | max(4 ; 21,0) = **21,0** |
| projectedStock(14) | 16 − 21,0 = **−5,0** |
| rawOrderQty | 15 − (−5,0) = **20,0** |
| **suggestedQty** | ⌈20/10⌉ × 10 = **20** · couverture 10 jo |

#### CAS 4 — PO fournisseur déjà en route

Céramique e.max · `phys 3` · `sécu 6` · `conso 1,0/jo` · `lead 3 jo` · PO 20 u. à J+2 jo

| Déclenchement (h = 3 jo) | Valeur |
|---|---|
| expectedDemand(3) | **3,0** |
| incomingArrivingWithin(3) | **20** |
| projeté à livraison (**mer 26/08**) | 3 + 20 − 3,0 = **20,0** |
| Test | 20,0 < 6 ? **NON → aucune action** |

**Garde-fou vérifié** : sans l'entrant, 3 − 3,0 = 0 < 6 aurait déclenché une commande
**inutile**. C'est l'erreur que la dérivation de `incoming` depuis les PO élimine.

#### CAS 5 — Conditionnement imposant un sur-stock

Adhésif céramique · `phys 4` · `sécu 5` · `pack 50` · `conso 0,1/jo` · `lead 3 jo`

| Étape | Valeur |
|---|---|
| projeté à livraison | 4 − 1 = **3** < 5 → **réapprovisionner** |
| projectedStock(13) | 4 − 2 = **2** |
| rawOrderQty | 5 − 2 = **3** |
| **suggestedQty** | ⌈3/50⌉ × 50 = **50** |
| Couverture après | (2 + 50) / 0,1 = **520 jo** ⚠ **WARNING sur-couverture** |

### TEST 12 — Une PO ouverte ne masque pas le besoin *(nouveau)*

```
physical = 2 · incoming = 5 · expectedDemand = 12 · safety = 3

projectedStockAtDelivery = 2 + 5 − 12 = −5      < 3  →  RÉAPPROVISIONNER
complément proposé : 8 u.
```

Le simple fait qu'une PO existe **ne renvoie jamais `false`**. Les quantités
entrantes réduisent le besoin via `incomingArrivingWithin`, elles ne le suppriment pas.

### TEST 14 — `packSize` + `minimumQty`, ordre des opérations *(nouveau)*

| raw | minimumQty | packSize | V1.1 (fausse) | **V1.2 (correcte)** |
|---|---|---|---|---|
| 3 | 7 | 5 | 7 ❌ *quantité impossible* | **10** ✔ |
| 3 | 0 | 5 | 5 | **5** ✔ |
| 12 | 7 | 5 | 15 | **15** ✔ |

```js
requiredQty  = max( max(rawOrderQty, 0), minimumQty )   // minimum D'ABORD
suggestedQty = ceil(requiredQty / packSize) × packSize  // arrondi ENSUITE
```

### TEST 11 — Migration `incoming` *(nouveau)*

```
avant :  qty = 10 · incoming = 5
après :  physicalStock = 10  (mouvement OPENING)
         incomingStock = 5   (PO synthétique CF-MIG-001, confirmed, 5 commandés / 0 reçus)
identiques ✔  — aucune quantité perdue, aucun double comptage
```

### TEST 13 — Recalcul d'une proposition ouverte *(nouveau)*

```
1) PP-001 créée     : Zircone HT ×5   WAIT        (rupture J+8 jo, lastSafe J+4 jo)
2) nouvelle commande client → recalcul
   PP-001           : Zircone HT ×9   ORDER_NOW   (rupture J+2 jo, lastSafe J−2 jo)
   proposition créée ? NON — mise à jour
   propositions ouvertes : 1        (aucune PP-002)  ✔
   ActivityEvent : « La recommandation d'achat a été recalculée. »
```

### TEST 15 — Minimum de commande fournisseur *(nouveau)*

`minimumOrder = 150 €` · panier `92 €`

| Situation | Verdict | Raison |
|---|---|---|
| non urgent | **WAIT** | « Minimum 150 € non atteint (92 €) — regrouper » |
| urgent + alternatif viable | **ALTERNATIF** | urgence + minimum non atteint |
| urgent + aucun alternatif | **BLOCKED** | « Minimum de commande fournisseur non atteint. » |

### TESTS 7 et 8 — protections *(nouveaux)*

| franco | subtotal | transport | landed |
|---|---|---|---|
| 500 € | 428 € | 18 € | 446 € |
| 500 € | 512 € | 0 € | 512 € |
| **null** | 92 € | **12 €** | 104 € ✔ *franco absent → transport toujours dû* |

En JS, `92 >= null` vaut **`true`** (coercition de `null` vers 0) : le transport
serait offert à tort. Le test `franco == null` est donc **explicite et obligatoire**.

| stock | conso/jo | coverageDays | Affichage |
|---|---|---|---|
| 24 | 0,0667 | 360,0 | « 360 j ouvrés » |
| 12 | **0** | **Infinity** | « **Pas de consommation récente** » |
| 0 | 0 | 0 | « 0 j » — jamais `NaN` |

---

## 6. Moteur de réapprovisionnement

### 6.1 Déclenchement — corrigé

```js
deliveryDate = addLabWorkingDays(today, leadTime)

projectedStockAtDelivery = physicalStock
                         + incomingArrivingWithin(leadTime)
                         − expectedDemand(leadTime)

shouldReplenish = article.active && projectedStockAtDelivery < safetyStock
```

**Ce qui a été retiré (bugs V1.1)** :

- ~~« aucune PO ouverte ne couvre déjà le besoin »~~ → `incomingArrivingWithin` prend
  déjà les entrants en compte. Bloquer en plus masquait un manque résiduel (TEST 12).
- ~~« aucune proposition ouverte ne porte déjà cet article »~~ → relève de la
  réconciliation (§7), pas du calcul du besoin.

`reorderPoint` reste supprimé : il valait `safetyStock + conso × leadTime` et
constituait la seconde soustraction de la demande. La question posée est directe :
*« au moment où une commande passée aujourd'hui arriverait, serai-je sous mon stock
de sécurité ? »*

### 6.2 Quantité suggérée — ordre des opérations corrigé

```js
orderHorizon = leadTime + reviewPeriodDays          // jours ouvrés
rawOrderQty  = safetyStock − projectedStock(orderHorizon)
requiredQty  = max( max(rawOrderQty, 0), minimumQty )    // ← minimum AVANT
suggestedQty = ceil(requiredQty / packSize) × packSize   // ← arrondi APRÈS
```

Appliquer `max(qty, minimumQty)` *après* l'arrondi produirait une quantité non
multiple du conditionnement — donc impossible à commander (TEST 14).

**Deux horizons distincts, et c'est voulu** : *déclencher* sur l'urgence
(`h = leadTime`), *dimensionner* sur la couverture (`h = leadTime + reviewPeriod`).
Dimensionner sur le seul délai ferait arriver la livraison pile au niveau de sécurité
et relancerait une proposition dès le lendemain — le système « bat ».

Contrôle de sur-couverture : au-delà de `maxCoverageDays`, WARNING affiché.
Le conditionnement prime, mais l'alerte est visible.

### 6.3 Modes d'automatisation

Énumération `MANUAL | ASSISTED | SEMI_AUTO | AUTO` conservée ; **seul `SEMI_AUTO`
est implémenté**. DentalFlow ne transmet jamais de commande.

---

## 7. Réconciliation des propositions

### 7.1 Principe

Le besoin est calculé **d'abord**, sans regarder les propositions. `ProposalEngine`
réconcilie ensuite :

```
pour chaque besoin (article, fournisseur retenu) :
    si une proposition OUVERTE existe pour ce fournisseur :
        si elle contient déjà l'article  → METTRE À JOUR la ligne
        sinon                            → AJOUTER la ligne
    sinon                                → CRÉER la proposition

puis, sur chaque proposition ouverte :
    recalculer subtotal, shippingCost, total, missingForFreeShipping,
    missingForMinimumOrder, riskLevel, earliestStockoutDate,
    lastSafeOrderDate, projectedFrancoDate, recommendedAction,
    explanationReasons, updatedAt

    toute ligne dont le besoin a disparu  → retirer la ligne
    proposition devenue vide              → status 'dismissed' + événement
```

Chaque recalcul modifiant `recommendedAction` émet un `ActivityEvent` :
> « La recommandation d'achat a été recalculée. »

### 7.2 Invariant

Un article apparaît **au plus une fois** dans une proposition ouverte pour un
fournisseur donné.

**Cet invariant sert exclusivement à réconcilier — jamais à bloquer le moteur.**
C'est la clé d'identification `(supplierId, articleId)` qui permet de retrouver la
ligne à mettre à jour, pas un verrou qui empêcherait le recalcul.

Attribution déterministe quand plusieurs fournisseurs sont possibles : préféré
d'abord, sinon landed cost le plus bas, sinon plus petit `supplierId`.

---

## 8. Franco de port et minimum de commande

### 8.1 Date limite de commande

```
lastSafeOrderDate = subLabWorkingDays(stockoutDate, leadTime + securityMarginDays)
```

Attendre jusqu'à la veille d'une rupture est déjà trop tard si le fournisseur livre
en trois jours ouvrés.

### 8.2 Arbre de décision

```
BLOCKED     si prix manquant, fournisseur inactif, ou aucun tarif
BLOCKED     si subtotal < minimumOrder ET urgence ET aucun alternatif viable
ALTERNATIF  si subtotal < minimumOrder ET urgence ET alternatif viable
NO_ACTION   si aucune ligne n'a de stockoutDate calculable
ORDER_NOW   si today ≥ lastSafeOrderDate            ← la rupture prime toujours
WAIT        si subtotal < minimumOrder ET pas d'urgence      ← regrouper
ORDER_NOW   si missingForFreeShipping ≤ 0           ← franco déjà atteint
WAIT        si projectedFrancoDate ≤ lastSafeOrderDate
            ET waitDays ≤ maxWaitDays
            ET shippingCost ≥ minSavings
ORDER_NOW   sinon
```

### 8.3 Minimum de commande — règle complète

`Supplier.minimumOrder` est une **condition commerciale**, jamais contournée
silencieusement.

- **Jamais** d'ajout automatique de produits inutiles pour atteindre le minimum.
- Affichage explicite : « **92 € / minimum 150 €** ».
- Action manuelle offerte au responsable : « **Compléter la commande** ».
- Les trois branches sont testées (TEST 15).

### 8.4 Bornes de sécurité

- `maxWaitDays` (5 jo) : au-delà, on commande même sans risque de rupture.
- `waitingSince` : une proposition en `waiting` au-delà de `maxWaitDays` bascule
  automatiquement en `ready` + événement `AUTOMATION`.
- **Priorité absolue** : le risque de rupture prime sur l'économie de transport et
  sur l'atteinte du minimum. Aucune exception.

---

## 9. Protections de calcul

### 9.1 `freeShippingThreshold == null`

```js
function landedCost(subtotal, franco, shippingCost) {
  if (franco === null || franco === undefined)      // test EXPLICITE
    return { total: subtotal + shippingCost, shipping: shippingCost };
  const shipping = subtotal >= franco ? 0 : shippingCost;
  return { total: subtotal + shipping, shipping };
}
```

**Ne jamais s'en remettre à la coercition JavaScript** : `92 >= null` vaut `true`
(`null` → 0), ce qui offrirait le transport à tort. Un fournisseur sans franco ne
déclenche jamais de logique `WAIT` liée au franco.

### 9.2 `coverageDays` — division par zéro

```js
function coverageDays(stock, dailyWorkingDemand) {
  if (dailyWorkingDemand <= 0) return stock > 0 ? Infinity : 0;
  return stock / dailyWorkingDemand;
}
```

Jamais de `NaN`. Affichage : `Infinity` → « **Pas de consommation récente** ».

`slowMovingStock()` traite ce cas explicitement :

```js
dormant = (coverageDays > dormantCoverageDays)          // Infinity satisfait ce test
       || (aucun CONSUMPTION depuis dormantNoConsumptionDays)
```

Un article avec du stock et **aucune** consommation est donc bien classé dormant, et
un article à stock nul ne l'est pas.

---

## 10. Migration schemaVersion 5 → 6

Réutilise le pattern `migrateUsers` validé en V3.3.2 : fusion par présence de clé,
jamais de reset.

| Donnée V5 | Devient en V6 |
|---|---|
| `stock[].qty` | mouvement **`OPENING`** de même quantité |
| `stock[].min` | `article.safetyStock` |
| `stock[].capacity` | `article.capacity` (affichage) |
| `stock[].incoming > 0` | **PurchaseOrder synthétique** (voir ci-dessous) |

### `incoming` → PO synthétique — ne jamais perdre une quantité entrante

```js
{ id: 'CF-MIG-001', supplierId: <préféré ou 'SUP-UNKNOWN'>,
  status: 'confirmed',
  createdAt: <migration>, expectedAt: addLabWorkingDays(today, leadTime),
  migrationSource: 'legacyIncoming',
  lines: [{ articleId, orderedQty: <incoming>, receivedQty: 0, unitPrice: <tarif|null> }] }
```

`incomingStock(article)` reste **identique avant et après migration** (TEST 11).
Supprimer purement le champ `incoming` aurait fait disparaître des quantités
attendues et provoqué des commandes en double.

Si le fournisseur ou le tarif est inconnu : PO créée quand même, marquée
`blocking:['missing_price']`, non validable, + `ActivityEvent` `WARNING`.

---

## 11. Import / Export

### Assistant — 6 étapes
`Type → Fichier → Mapping → Prévisualisation → Validation → Résultat`

Types : articles, stocks, fournisseurs, tarifs fournisseurs, commandes, utilisateurs.

### Mapping
Auto-détection par normalisation + table de synonymes, **toujours corrigeable**.
Une colonne obligatoire non mappée bloque l'étape suivante.

### Validation — aucune erreur silencieuse
```
184 lignes détectées · 176 prêtes à importer · 8 à vérifier
                                    [ Afficher uniquement les erreurs ]
```
Codes : `MISSING_REQUIRED`, `INVALID_NUMBER`, `UNKNOWN_SUPPLIER`,
`DUPLICATE_REFERENCE`, `UNKNOWN_ARTICLE`, `NEGATIVE_QTY`.
Lignes valides importées, lignes en erreur **rejetées et listées**, jamais ignorées.

### Import de stock → `ADJUSTMENT`
`delta = valeurImportée − soldeActuel` → un `ADJUSTMENT` par article
(`sourceType:'import'`, `jobId`). Delta nul → aucun mouvement.

### Export
- **Métier** CSV (P1) : commandes, production, stocks, articles, fournisseurs, achats, traçabilité.
- **Export complet** JSON : critère de validité — **ré-importable à l'identique**.
- XLSX en P2 sous réserve de CDN autorisée.

---

## 12. UX

### 12.1 Stocks — Articles · Fournisseurs

Filtres : **Tous · À surveiller · Stock faible · Dormants**
(pas d'onglet « Réapprovisionnement » : il doublonnerait avec Achats).

```
Zircone HT
Disponible 3 · En commande 5 · Besoin 7 jo : 6            [Attention]
```

Interdit sur une ligne : physique + réservé + projeté + sécurité + rotation +
consommation + délai + prix + franco simultanément.

Clic article → **popup information**. Édition → **side-window**.

### 12.2 Achats — Propositions · Commandes fournisseurs

```
PROPOSITIONS — À DÉCIDER
┌──────────────────────────────────────────────────┐
│ Ivoclar            4 références        428 € HT  │
│ Franco 500 € · manque 72 €                       │
│ Aucune rupture avant mer 02/09                   │
│ → ATTENDRE ET REGROUPER                          │
│             [ Voir la proposition ] [ Commander ]│
└──────────────────────────────────────────────────┘

COMMANDES FOURNISSEURS
CF-0042 · Henry Schein · attendu lun 24/08 · partiellement reçue (8/9)
```

### 12.3 Journal d'activité
Filtres `Toutes | Erreurs | Alertes | Automatisations | Actions` (croisent `severity`
et `source`). **Lecture seule.** Rétention : 500 en mémoire, 200 persistés, purge
FIFO sauf `CRITICAL`. *La purge porte sur les événements — jamais sur les mouvements.*

### 12.4 Import — `wizardLayer` dédié
Wizard **centré**, dans une couche `wizardLayer` **distincte de `quick-layer`**.
`quick-layer` reste réservé à la consultation d'information ; un assistant à 6 étapes
avec état interne, navigation avant/arrière et confirmation de sortie n'a pas le même
cycle de vie. Les mutualiser mélangerait deux comportements de fermeture.

### 12.5 Accueil
**2 alertes achats maximum** : rupture imminente, PO critique en retard.
Jamais « franco bientôt atteint ».

---

## 13. Démonstration — recalculée en calendrier ouvré

Aujourd'hui : **vendredi 21/08/2026**. Aucun verdict n'est stocké ; tout est recalculé.

### 13.1 Jeu de données

| Article | phys. | sécu. | pack | conso/jo | délai | Fournisseur | PU |
|---|---|---|---|---|---|---|---|
| Zircone HT | 5 | 4 | 1 | 0,20 | 3 jo | Ivoclar *(préféré)* | 42 € |
| Zircone HT *(alt.)* | | | | | 1 jo | Henry Schein | 46 € |
| Adhésif céramique | 4 | 5 | 50 | 0,10 | 3 jo | Ivoclar | 1,20 € |
| Colorant zircone | 2 | 3 | 4 | 0,05 | 3 jo | Ivoclar | 17 € |
| Disques de fraisage | 6 | 6 | 5 | 0,20 | 3 jo | Ivoclar | 18 € |
| Liquide de glaçage | 11 | 8 | 6 | 0,50 | 3 jo | Ivoclar | 14 € |
| Céramique e.max | 3 | 6 | 10 | 1,00 | 3 jo | Ivoclar *(PO 20 à J+2)* | 31 € |
| PMMA temporaire | 16 | 15 | 10 | 1,50 | 4 jo | Dental Direct | 22 € |
| Cire de modelage | 60 | 20 | 10 | 1,00 | 5 jo | Dental Direct | 6 € |
| Zircone C4 | 24 | 2 | 5 | 0,067 | 3 jo | Ivoclar | 42 € |

Ivoclar : franco 500 €, transport 18 €, délai 3 jo.
Henry Schein : franco 200 €, transport 15 €, délai 1 jo.

### 13.2 Les 7 cas — résultats dérivés

| Cas | Situation | Calcul | Verdict |
|---|---|---|---|
| **A** | Cire de modelage | projeté **55** ≥ sécu. 20 | **Aucune action** |
| **B** | Zircone HT | projeté **3** < sécu. 4 → 5 u. | **Proposition** |
| **C** | Panier Ivoclar | **428 €**, manque **72 €** ; franco **jeu 27/08**, lastSafe **jeu 27/08** | **ATTENDRE ET REGROUPER** |
| **D** | +2 bridges (4 u. à J+2 jo) | rupture **mer 02/09 → mar 25/08** ; lastSafe dépassée | **COMMANDER MAINTENANT** |
| **E** | Arbitrage fournisseur | Ivoclar livre **mer 26/08** ✗ / H. Schein **lun 24/08** ✔ ; surcoût **18 €** | **Henry Schein** |
| **F** | Zircone C4 | couverture **360 jo** > 180 ; projeté 23,8 ≥ sécu. 2 | **NE PAS COMMANDER** |
| **G** | CF-0042, 8 reçus / 9 | `incoming` 1 ; projeté **8** ≥ sécu. 4 | **Aucune nouvelle proposition** |

### 13.3 Cas C — panier et attente *(sortie exécutée)*

| Ligne | Qté | PU | Montant |
|---|---|---|---|
| Zircone HT | 5 | 42 € | 210 € |
| Adhésif céramique | 50 | 1,20 € | 60 € |
| Colorant zircone | 4 | 17 € | 68 € |
| Disques de fraisage | 5 | 18 € | 90 € |
| **Sous-total** | | | **428 €** — manque **72 €** |

Ruptures : Zircone HT **J+8 jo = mer 02/09** · Disques J+31 jo · Adhésif et Colorant
J+41 jo → la plus proche est **mer 02/09**.

`lastSafeOrderDate` = 8 − (3 + 1) = **J+4 jo = jeu 27/08**.

Le **Liquide de glaçage** franchit son seuil à **J+4 jo** (6 u. × 14 € = 84 €)
→ panier **554 € ≥ 500 €** → `projectedFrancoDate` = **jeu 27/08**.

Décision : franco J+4 ≤ lastSafe J+4 ✔ · attente 4 jo ≤ 5 jo ✔ · transport 18 € ≥ 10 € ✔
→ **ATTENDRE ET REGROUPER**

> « Le franco de 500 € sera atteint jeudi 27/08 en regroupant le liquide de glaçage.
> Aucune rupture n'est prévue avant mercredi 02/09. Économie de transport : 18 €. »

### 13.4 Cas D et E — la bascule *(sortie exécutée)*

Nouvelle commande client : 2 bridges = 4 disques, échéance J+2 jo.

| | Avant | Après |
|---|---|---|
| knownDemand(2) | 2 | **6** |
| projectedStock(2) | 3 | **−1** |
| `stockoutDate` | mer 02/09 | **mar 25/08** |
| `lastSafeOrderDate` | jeu 27/08 | **dépassée** |
| Décision | WAIT | **ORDER_NOW** |
| Quantité | 5 | **9** |

| Fournisseur | Articles | Transport | Landed | Livre le | À temps ? |
|---|---|---|---|---|---|
| Ivoclar *(préféré)* | 9 × 42 = 378 € | 18 € | **396 €** | mer 26/08 | ✗ après la rupture |
| Henry Schein | 9 × 46 = 414 € | 0 € *(franco 200)* | **414 €** | lun 24/08 | ✔ |

> « Rupture Zircone HT prévue mardi 25/08. Ivoclar livre mercredi 26/08 — trop tard.
> Henry Schein livre lundi 24/08. Surcoût estimé : 18 €. »

**Divergence assumée** : les illustrations du brief initial (72 €/76 €/12 €) ne sont
pas reproduites — les montants ci-dessus sont **calculés** par les règles, conformément
à l'exigence « aucun résultat ne doit dépendre d'une valeur codée pour la démonstration ».

### 13.5 Enchaînement

1. Stocks → Zircone HT en tension.
2. Achats → **PP-001** Ivoclar 428 €, franco 500 €.
3. **ATTENDRE ET REGROUPER**, raison affichée.
4. Création d'une commande client (2 bridges, échéance mar 25/08).
5. Rupture recalculée mer 02/09 → **mar 25/08**, sans intervention.
6. **PP-001 est mise à jour** (5 → 9 u., WAIT → ORDER_NOW). *Aucune PP-002.*
7. Ivoclar trop tard → **Henry Schein** recommandé, surcoût 18 € expliqué.
8. Validation → **CF-0042** créée.
9. Réception **8/9** → stock +8, reliquat 1 attendu, `partially_received`.
10. Aucune nouvelle proposition (reliquat couvert par `incoming`).
11. Journal : les 10 étapes horodatées via `Clock.now()`.

**Point clé** : les étapes 5-6 se produisent **sans action de l'utilisateur**.

---

## 14. Invariants finaux

| Concept | Nature | Règle |
|---|---|---|
| **StockMovement** | fait physique **immuable** | jamais modifié, jamais purgé ; le solde en découle |
| **ScanEvent** | fait de localisation **immuable** | `stageLabelAtScan` figé (doctrine V3.3) |
| **KnownDemand** | **projection dérivée** | calculée depuis commandes + BOM, jamais stockée |
| **IncomingStock** | **projection dérivée** | calculée depuis les PO ouvertes, jamais stockée |
| **PurchaseProposal** | **recommandation recalculable** | jamais figée ; mise à jour à chaque recalcul |
| **PurchaseOrder** | **engagement fournisseur** | seul objet qui matérialise une quantité attendue |
| **ActivityEvent** | **journal explicatif** | append-only, ne porte aucune vérité métier |

> **Aucune paire de ces concepts ne stocke deux fois la même vérité.**

Corollaires appliqués :
- `incoming` n'est pas un champ → `PurchaseOrder` en est la seule source.
- `reservedStock` n'est pas un champ → `knownDemand` en est la seule source.
- `physicalStock` n'est pas un champ → `StockMovement` en est la seule source.
- `reorderPoint`, `targetStock`, `preferredSupplierId`, `orderDays` : supprimés,
  car soit redondants, soit ignorés du moteur.

---

## 15. Cas limites

1. **Article sans fournisseur** → non réapprovisionnable, `ERROR`, exclu.
2. **Fournisseur sans franco** (`null`) → jamais de `WAIT` franco (§9.1).
3. **Consommation nulle** → `coverageDays = Infinity`, pas de `stockoutDate` ;
   déclenche uniquement sous `safetyStock`.
4. **Commande sans nomenclature** → aucune réservation + `WARNING`.
5. **Réception supérieure au commandé** → acceptée, `RECEIPT` du réel + `WARNING`.
6. **PO annulée après réception partielle** → le reçu reste acquis, le reliquat sort
   de `incoming`.
7. **Article désactivé avec stock** → visible, exclu du réappro.
8. **Import créant un doublon de référence** → ligne rejetée, jamais de fusion auto.
9. **Rescannage d'un poste** → aucun effet (`consumptionKey`).
10. **Franco atteint puis besoin annulé** → panier recalculé, recommandation révisée.
11. **Deux `preferred = true`** → `ERROR` + repli sur le landed cost le plus bas.
12. **PO ouverte insuffisante** → complément proposé (TEST 12).
13. **`minimumQty` non multiple du `packSize`** → arrondi au pack supérieur (TEST 14).
14. **Migration sans fournisseur connu pour un `incoming`** → PO `blocking`, `WARNING`.

---

## 16. Risques

### Produit

| Risque | Gravité | Mitigation |
|---|---|---|
| Dérive ERP | **Élevée** | 1 page Achats, 2 sections, 2 actions par carte |
| Recommandation incomprise | Élevée | `explanationReasons` obligatoire, jamais de verdict nu |
| Sur-notification | Moyenne | 2 alertes achats maximum sur l'Accueil |
| Sur/sous-commande | Élevée | Garde-fous §14 + **16 tests rejouables en régression** |

### Technique

| Risque | Mitigation |
|---|---|
| Saturation `localStorage` | Bornage des **événements** (200). Mouvements non purgés mais légers ; réévaluer au-delà de 5 000. |
| Migration 5 → 6 | Pattern `migrateUsers` (V3.3.2) + PO synthétiques (§10) |
| Recalcul à chaque render | Cache mémoire invalidé sur mutation |
| Concurrence en SaaS | ci-dessous |

### Opérations transactionnelles en SaaS

1. **Validation d'une proposition → PO** — verrou optimiste sur `proposal.status`
   + unicité `proposalId` sur PO (sinon double commande).
2. **Réception** — mouvements + statut PO dans **une seule** transaction.
3. **Consommation au scan** — `consumptionKey` avec **contrainte d'unicité en base**.

### Droits

| Rôle | Droits |
|---|---|
| Responsable | Valider une proposition, commander, réceptionner |
| Admin | Fournisseurs, tarifs, paramètres moteur, import/export |
| Technicien | Consommation (scan), réception si autorisé |

POC : modélisés, non appliqués.

### Roadmap P2

`SUPPLIER RELIABILITY` (délai déclaré vs constaté) · `PRICE HISTORY` (variation
tarifaire) · `BALANCE_CARRY_FORWARD` · `orderDays` · `expressShippingCost` ·
approvisionnement fractionné · `targetCoverageDays` · calendrier labo configurable ·
XLSX.

---

## 17. Plan d'implémentation

### P0 — Fondations (aucune UI nouvelle)
1. Calendrier : `isLabWorkingDay`, `addLabWorkingDays`, `subLabWorkingDays`,
   `businessDaysBetween`.
2. Migration `schemaVersion 5 → 6` : `OPENING`, `safetyStock`, **PO synthétiques**
   pour `incoming` (§10).
3. `stockMovements` append-only + `physicalStock()` dérivé.
4. `suppliers`, `articleSuppliers` (invariant `preferred`), `BILL_OF_MATERIALS`.
5. `activityEvents` + `logActivity()` ; `logAudit()` en adaptateur ; l'audit de
   Rapports devient une vue filtrée du store unique.
6. `StockEngine` (avec les protections §9).
7. Écran Stocks mis à jour + filtres.

**Sortie P0** : stock identique à la V3.3.2 mais dérivé des mouvements ;
`incomingStock` identique avant/après migration (TEST 11) ; 0 erreur console.

### P1 — Moteur et Achats
8. `DemandEngine` (`knownDemand` / `baselineDemand` / `expectedDemand`).
9. `ReplenishmentEngine` (§6.1 et §6.2 corrigés).
10. `SupplierEngine` (`landedCost` avec franco null, franco, minimumOrder).
11. `ProposalEngine` **avec réconciliation** (§7).
12. Écran **Achats** + popup détail.
13. `PurchaseOrder`, validation, réception partielle → `RECEIPT`.
14. Consommation au scan avec `consumptionKey`.
15. Écran **Journal d'activité**.
16. Jeu de données §13.1 → les 7 cas tombent juste sans valeur forcée.

**Sortie P1** : l'enchaînement §13.5 se déroule intégralement ; **PP-001 est mise à
jour, aucune PP-002** ; les 16 tests passent.

### P2 — Données et confort
17. Export CSV + export complet JSON ré-importable.
18. Assistant d'import (`wizardLayer`).
19. `slowMovingStock()` + filtre Dormants.
20. Onglet Fournisseurs.
21. 2 alertes achats sur l'Accueil.
22. Roadmap P2 ci-dessus.

---

## 18. Hors scope

Comptabilité, facturation fournisseur, rapprochement bancaire, OCR, EDI, connexion
fournisseur, paiement, fiscalité, marketplace, IA générative d'achat.

**Le moteur d'achat reste déterministe, rule-based, testable et explicable.
Aucune IA dans la boucle de décision.**

---

## Récapitulatif des 16 tests

| # | Test | Résultat |
|---|---|---|
| 1 | Aucune commande client (`known = 0`) | aucune action ✔ |
| 2 | Connu > historique | 5 u. ✔ |
| 3 | Historique > connu | 20 u. ✔ |
| 4 | PO en route couvrant le besoin | aucune action ✔ |
| 5 | Conditionnement → sur-couverture | 50 u. + WARNING 520 jo ✔ |
| 7 | Franco `null` | transport toujours dû ✔ |
| 8 | `coverageDays` conso nulle | `Infinity`, jamais `NaN` ✔ |
| 11 | Migration `incoming` | 10 / 5 identiques ✔ |
| 12 | PO ouverte **insuffisante** | complément 8 u. proposé ✔ |
| 13 | Recalcul de proposition | PP-001 mise à jour, aucune PP-002 ✔ |
| 14 | `pack` + `minimumQty` | 3/7/5 → **10** ✔ |
| 15 | `minimumOrder` 150 € / 92 € | WAIT / ALTERNATIF / BLOCKED ✔ |
| 16 | Week-end | vendredi + 3 jo = mercredi ✔ |
| C | Panier franco | 428 €, manque 72 €, ATTENDRE ✔ |
| D/E | Bascule + arbitrage | ORDER_NOW, Henry Schein, +18 € ✔ |
| F/G | Dormant / réception partielle | ne pas commander / aucune proposition ✔ |

Tous cohérents.

---

# SPEC READY FOR IMPLEMENTATION

Aucun fichier applicatif n'a été modifié — `dentalflow-next-poc-v3.3.2.html` est intact.

**Implémentation recommandée : CLAUDE SONNET 5, effort ÉLEVÉ.**
Suivre le plan P0 → P1 → P2 du §17, avec les 16 tests du §5 comme suite de
non-régression.

L'implémentation n'est pas lancée.
