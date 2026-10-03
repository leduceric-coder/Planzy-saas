# DentalFlow — Stocks intelligents, Achats assistés, Import/Export, Journal d'activité
## Spécification fonctionnelle — à valider avant tout développement

Base de code : `dentalflow-next-poc-v3.3.2.html` (schemaVersion 5)
Statut : **spécification** — aucun fichier applicatif modifié.
Étape suivante : implémentation (Sonnet 5, effort élevé) après validation.

---

## 0. Trois écarts entre le brief et le code réel — à arbitrer d'abord

Le brief suppose un état de l'application qui ne correspond plus à la V3.3.2.
Ces trois points conditionnent l'architecture, il faut les trancher avant de coder.

### 0.1 — La page « Paramètres » n'existe plus

Le §3 et le §67 placent l'Import/Export dans `Paramètres → Données`. Or la page
Paramètres a été **supprimée en V3.3** et remplacée par un menu pop-up ancré au
pied de la barre latérale (`userMenuInnerHTML()` : Apparence, Voir comme cabinet,
Voir comme collaborateur, Réinitialiser la démo).

**Recommandation** — ne pas ré-ouvrir une page Paramètres (ce serait un retour en
arrière sur le cleanup V3.3). Ajouter dans le menu utilisateur une entrée
**« Données »** qui ouvre l'assistant Import/Export. Cohérent avec la doctrine
« Information → popup, Action → side-window » : l'import est une action longue et
guidée, donc un **wizard centré** (réutilise `quick-layer`, voir §12.4).

### 0.2 — Un journal existe déjà, à moitié

`logAudit()`, `state.historyEvents`, `seedAuditLog` et `auditEvents()` alimentent
déjà une table d'audit — mais elle est enfouie **dans Rapports**, avec ses propres
filtres, tri et pagination. Créer un « Journal d'activité » parallèle
introduirait exactement la double vérité que la V3.3 a éliminée ailleurs.

**Recommandation** — un **store unique** `state.activityEvents`, dont :
- le nouveau **Journal d'activité** (sous Outils) est la vue complète ;
- la table d'audit de **Rapports** devient une **vue filtrée** du même store
  (portée : commandes/production), sans logique de stockage propre.

`logAudit()` devient un adaptateur vers `logActivity()` — pas de réécriture des
appelants existants au premier jet.

### 0.3 — Le modèle Stock actuel est trop pauvre, et `incoming` est un piège

Modèle actuel : `{id, name, unit, qty, capacity, min, incoming}`.

Deux problèmes structurels :

1. **`incoming` est une donnée saisie à la main.** Dès qu'il existera des
   commandes fournisseurs, la même information vivra à deux endroits → double
   comptage garanti (challenge §16.3). `incoming` doit devenir **dérivé** des
   lignes de commandes fournisseurs ouvertes, jamais stocké. C'est exactement la
   doctrine appliquée en V3.3 à `boardStation` vs dernier scan.
2. **`min` sert à la fois de stock de sécurité et de point de commande.** Ce sont
   deux notions différentes (§15.2). Il faut les séparer, et **dériver** le point
   de commande plutôt que le stocker, pour qu'il suive automatiquement un
   changement de délai fournisseur.

`capacity` est conservé mais **redéfini** : capacité physique de stockage (sert
la barre de progression), ≠ `targetStock` (niveau cible de réappro).

---

## 1. Architecture fonctionnelle

### 1.1 Principe directeur

> Le moteur calcule. L'interface explique. Le responsable décide.

Toute la sophistication (stock projeté, franco, arbitrage fournisseur) vit dans
un moteur **déterministe, sans IA**. L'UI n'expose qu'un verdict + une raison.

### 1.2 Couches

```
┌─────────────────────────────────────────────────────────┐
│ UI  Stocks · Achats · Journal · Données (import/export)  │
│     progressive disclosure : liste → popup → side-window │
└────────────────────────┬────────────────────────────────┘
                         │  lit des vues, ne calcule rien
┌────────────────────────▼────────────────────────────────┐
│ MOTEURS (purs, déterministes, testables)                 │
│  StockEngine          stock disponible / projeté         │
│  DemandEngine         besoins issus des commandes        │
│  ReplenishmentEngine  faut-il commander, combien         │
│  SupplierEngine       landed cost, comparaison, franco   │
│  ProposalEngine       regroupement, recommandation       │
└────────────────────────┬────────────────────────────────┘
                         │  lit un état normalisé
┌────────────────────────▼────────────────────────────────┐
│ DONNÉES  articles · suppliers · articleSuppliers         │
│          stockMovements (append-only) · purchaseOrders   │
│          purchaseProposals · activityEvents              │
└─────────────────────────────────────────────────────────┘
```

**Règle d'or** : aucun moteur n'écrit dans l'état. Ils retournent des objets de
calcul. Seules des commandes explicites (valider, réceptionner, ajuster)
produisent des mutations, et chacune émet un `activityEvent`.

### 1.3 Navigation cible

| Emplacement | Ajout |
|---|---|
| Outils | **Achats**, **Journal d'activité** |
| Stocks (existant) | onglets *Articles · Fournisseurs · Réapprovisionnement* |
| Menu utilisateur | **Données** → assistant Import / Export |

`PRIMARY_NAV` (Accueil, Commandes, Production, Messages) **inchangé**.
`TOOLS_NAV` passe de 4 à 6 entrées — c'est la limite acceptable ; au-delà il
faudra sous-grouper.

---

## 2. Modèle de données

### 2.1 Article

```js
{
  id,                 // 'ART-ZIR-HT-001'
  reference,          // référence interne labo
  label,              // 'Zircone HT'
  category,           // 'Matériau' | 'Consommable' | 'Outillage'
  unit,               // 'disques'
  capacity,           // capacité physique de stockage (UI uniquement)
  safetyStock,        // tampon incompressible
  targetStock,        // niveau cible après réappro
  averageConsumption, // { qty, periodDays }  ex. 6 / 30j
  active,             // false = ne plus proposer au réappro
  preferredSupplierId // raccourci, redondant avec articleSuppliers.preferred
}
```

**Non stocké, dérivé** : `physicalStock`, `reservedStock`, `availableStock`,
`incomingStock`, `projectedStock`, `reorderPoint`, `coverageDays`.

### 2.2 StockMovement — journal append-only

```js
{
  id, at,                    // Clock.iso()
  articleId,
  type,                      // OPENING | RECEIPT | CONSUMPTION | ADJUSTMENT | RETURN
  qty,                       // signé : +5 réception, -2 consommation
  reason,                    // texte court
  sourceType, sourceId,      // 'purchaseOrder' | 'order' | 'import' | 'manual'
  userId
}
```

**Immuable**, comme les `scanEvents`. Une correction ne modifie jamais un
mouvement : elle en ajoute un de type `ADJUSTMENT`.

`RESERVATION` / `RELEASE` **ne sont pas des mouvements** — voir §2.3.

### 2.3 Réservation — dérivée, non stockée

Le brief (§56) liste `RESERVATION`/`RELEASE` comme mouvements. **Je recommande
de ne pas les matérialiser.** Une réservation n'est pas un fait physique : c'est
une projection de la demande. La stocker crée un état à réconcilier à chaque
annulation, changement de type ou suppression de commande.

À la place, la réservation est **calculée** à partir des commandes en cours et
d'une nomenclature :

```js
// nomenclature par type de prothèse — s'appuie sur order.type qui existe déjà
const BILL_OF_MATERIALS = {
  'Couronne zircone':          [{articleId:'ART-ZIR-HT-001', qty:1}],
  'Bridge 3 éléments':         [{articleId:'ART-ZIR-HT-001', qty:2}],
  'Facette céramique':         [{articleId:'ART-CER-EMX-003', qty:1}],
  'Inlay / Onlay':             [{articleId:'ART-CER-EMX-003', qty:1}],
  'Couronne provisoire':       [{articleId:'ART-PMM-TMP-004', qty:1}],
  'Couronne céramo-métallique':[{articleId:'ART-CER-EMX-003', qty:1},
                                {articleId:'ART-ADH-CER-008', qty:1}],
  'Denture partielle':         [{articleId:'ART-PMM-TMP-004', qty:2}]
};
```

`reservedStock(article)` = somme des besoins des commandes **non terminées et
non encore consommées**. Zéro donnée à maintenir, zéro dérive possible.

**Consommation** : elle se déclenche au **scan du poste consommateur**
(`consumingStageId` par article, ex. Zircone consommée à Usinage). Le scan
étant déjà l'événement de vérité de la V3.3, on réutilise l'existant au lieu
d'inventer un geste. Au scan : un `CONSUMPTION` est écrit, et la commande sort
du calcul de réservation (sinon double comptage réservé + consommé).

### 2.4 Supplier

```js
{
  id, name, active,
  leadTimeDays,            // délai standard
  freeShippingThreshold,   // franco de port HT
  shippingCost,            // transport si franco non atteint
  minimumOrder,            // montant mini de commande
  orderDays,               // ['mon','thu'] jours de passation (optionnel)
  notes
}
```

`expressShippingCost` : **reporté en P2** (voir §16.1).

### 2.5 ArticleSupplier

```js
{ articleId, supplierId, supplierReference,
  unitPrice, packSize, minimumQty, leadTimeDays, preferred }
```

`leadTimeDays` ici **surcharge** celui du fournisseur (un article peut être en
approvisionnement long chez un fournisseur rapide).

### 2.6 PurchaseProposal / PurchaseProposalLine

```js
PurchaseProposal {
  id, supplierId, createdAt, updatedAt,
  status,                  // draft|waiting|ready|approved|dismissed|converted
  lines: [PurchaseProposalLine],
  subtotal, shippingCost, total,
  freeShippingThreshold, missingForFreeShipping,
  recommendedAction,       // ORDER_NOW | WAIT | NO_ACTION | BLOCKED
  riskLevel,               // none | low | high | critical
  recommendedOrderDate,
  earliestStockoutDate,
  explanationReasons: [],  // string[] ordonné par importance
  blocking: []             // ['missing_price', 'supplier_inactive', ...]
}

PurchaseProposalLine {
  articleId, neededQty, suggestedQty, packSize,
  unitPrice, lineTotal,
  projectedStock, stockoutDate, coverageAfterDays
}
```

### 2.7 PurchaseOrder / PurchaseOrderLine

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
`ordered|confirmed|shipped|partially_received`. **Seule source du « en commande ».**

### 2.8 ActivityEvent

```js
{ id, timestamp, type, severity, source, entityType, entityId,
  title, message, metadata, userId }
```

- `severity` : `INFO | WARNING | ERROR | CRITICAL`
- `source`   : `AUTOMATION | USER_ACTION | IMPORT | SYSTEM`
- `type`     : `IMPORT | STOCK | PURCHASE | SUPPLIER | ORDER | SCAN | USER`

Le brief mélange `AUTOMATION`/`USER_ACTION` avec `INFO`/`ERROR` dans la même
énumération (§4). Ce sont **deux axes orthogonaux** — d'où la séparation
`severity` × `source`. Les filtres UI combinent les deux.

`metadata` : jamais de donnée patient (doctrine privacy V3.3), jamais de contenu
de fichier — uniquement nom de fichier, compteurs, identifiants.

### 2.9 ImportJob / ImportError

```js
ImportJob   { id, at, dataType, fileName, rowCount, importedCount,
              rejectedCount, mapping, status, userId }
ImportError { jobId, rowNumber, column, rawValue, code, message }
```

`ImportError` n'est conservé que pour le **dernier** job par type (bornage
localStorage, §14.3).

### 2.10 Relations

```
Article 1─n ArticleSupplier n─1 Supplier
Article 1─n StockMovement
Article 1─n PurchaseProposalLine n─1 PurchaseProposal n─1 Supplier
PurchaseProposal 1─0..1 PurchaseOrder 1─n PurchaseOrderLine n─1 Article
Order (existant) ─BOM→ besoins article  (réservation dérivée)
ImportJob 1─n ImportError
Tout ─→ ActivityEvent (entityType + entityId)
```

---

## 3. Source de vérité du stock (§57) — décision

**Recommandation : dérivation intégrale depuis les mouvements**, avec un
mouvement `OPENING` par article à l'initialisation.

```js
physicalStock(articleId) = Σ movements(articleId).qty
```

Justification :
- **Cohérence doctrinale.** La V3.3 a établi que la localisation d'une commande
  se dérive des scans et n'est jamais stockée en parallèle. Stocker un solde à
  côté du journal recréerait le problème `boardStation` sur les stocks.
- **Zéro dérive.** Pas de réconciliation à écrire, pas de bug de solde possible.
- **Volumétrie POC négligeable** : ~10 articles × quelques centaines de
  mouvements. Un cache mémoire recalculé une fois par render suffit largement.

**Chemin SaaS** : en base, le journal reste la source légale et le solde devient
une **vue matérialisée** (ou une colonne mise à jour dans la même transaction que
l'insertion du mouvement). La formule métier ne change pas ; seule la stratégie
de matérialisation change. C'est une optimisation, pas une refonte.

**Import de stock (§58)** : un import ne réécrit jamais le solde. Il calcule
`delta = valeurImportée − soldeActuel` et écrit un `ADJUSTMENT` par article
concerné, avec `sourceType:'import'` et le `jobId`. Un delta nul n'écrit rien.
L'historique reste donc lisible et l'origine de chaque correction traçable.

---

## 4. Formules de calcul

Toutes centralisées, un seul point de vérité par notion.

```
physicalStock   = Σ stockMovements.qty
reservedStock   = Σ BOM(commandes actives non consommées)
availableStock  = physicalStock − reservedStock          // peut être négatif
incomingStock   = Σ (orderedQty − receivedQty) sur PO ouvertes

dailyDemand     = averageConsumption.qty / averageConsumption.periodDays
forecastDemand(d) = dailyDemand × d
                    + Σ BOM(commandes dont l'échéance ∈ [aujourd'hui, +d])

projectedStock(d) = availableStock
                  + incomingArrivingWithin(d)
                  − forecastDemand(d)

leadTime         = articleSupplier.leadTimeDays ?? supplier.leadTimeDays
reorderPoint     = safetyStock + dailyDemand × leadTime      // DÉRIVÉ
coverageDays     = availableStock / dailyDemand
stockoutDate     = plus petit d tel que projectedStock(d) < 0
```

**Horizon par défaut** : 14 jours (couvre le plus long délai fournisseur de démo
+ marge). Paramétrable, non exposé dans l'UI.

### Exemple de contrôle (§17 du brief)

| Grandeur | Valeur |
|---|---|
| Stock physique | 7 |
| Réservé | 4 |
| **Disponible** | **3** |
| En commande | 5 |
| Besoin prévisionnel | 6 |
| **Stock projeté** | **2** |

Vérifie `3 + 5 − 6 = 2`. ✔

---

## 5. Moteur de réapprovisionnement

### 5.1 Déclenchement

```js
shouldReplenish(article):
  si !article.active                        → false
  si projectedStock(leadTime) >= reorderPoint → false
  si besoin déjà couvert par une PO ouverte  → false   // anti-double commande
  si besoin déjà porté par une proposition   → false   // anti-double proposition
  sinon                                      → true
```

Les deux dernières conditions sont **le garde-fou principal** contre la commande
inutile (challenge §16.1). Chaque besoin d'article est attribué à **exactement
une** proposition ouverte (`coveredByProposalId`).

### 5.2 Quantité suggérée

```js
calculateSuggestedQuantity(article):
  besoin  = forecastDemand(horizon) + safetyStock − projectedStock(horizon)
  besoin  = max(besoin, 0)
  qty     = ceil(besoin / packSize) × packSize
  qty     = max(qty, articleSupplier.minimumQty)
  // garde-fou sur-stock
  si coverageAfter(qty) > maxCoverageDays (défaut 120 j)
     → conserver qty (le conditionnement s'impose)
       + WARNING « cette quantité couvre N mois »
```

**Le brief dit « ne pas commander jusqu'au stock maximum » (§23) — appliqué** :
on commande pour couvrir l'horizon + sécurité, pas pour remplir `targetStock`.
`targetStock` ne sert que d'indicateur d'affichage.

Exemple §24 : besoin 7, conditionnement 5 → `ceil(7/5)×5 = 10`. ✔

### 5.3 Modes d'automatisation (§25)

L'énumération `MANUAL | ASSISTED | SEMI_AUTO | AUTO` est **conservée dans le
modèle**, mais un seul comportement est implémenté : `SEMI_AUTO`. Écrire quatre
branches pour un POC serait du code mort. `AUTO` (envoi réel) est explicitement
hors scope.

---

## 6. Franco de port — la règle exacte

### 6.1 Correction importante apportée au brief

L'exemple §32 conclut « aucune rupture avant jeudi → attendre ». **C'est faux si
le délai fournisseur n'est pas déduit.** Si le fournisseur livre en 3 jours et la
rupture est jeudi, il fallait commander lundi. La comparaison doit se faire sur
la **date limite de commande**, pas la date de rupture :

```
lastSafeOrderDate = stockoutDate − leadTime − securityMargin(1 j)
```

### 6.2 Arbre de décision

```
BLOCKED     si prix manquant, fournisseur inactif ou sans tarif
ORDER_NOW   si aucune ligne n'a de stockoutDate  → NO_ACTION (rien à faire)
ORDER_NOW   si today >= lastSafeOrderDate                    ← la règle de §34
ORDER_NOW   si missingForFreeShipping <= 0                   (franco déjà atteint)
WAIT        si projectedFrancoDate <= lastSafeOrderDate
            ET waitDays <= maxWaitDays (défaut 5 j)
            ET shippingCost >= minSavings (défaut 10 €)
ORDER_NOW   sinon
```

`projectedFrancoDate` = date estimée à laquelle les besoins cumulés atteindront
le franco, extrapolée depuis la consommation moyenne. Si elle n'est pas
calculable → `ORDER_NOW` (on n'attend jamais sur une inconnue).

### 6.3 Bornes de sécurité (challenge §16.2)

- `maxWaitDays` : au-delà, on commande, même sans risque de rupture. Empêche
  l'attente indéfinie d'un franco jamais atteint.
- `waitingSince` sur la proposition : une proposition en `waiting` depuis plus de
  `maxWaitDays` bascule automatiquement en `ready` + événement `AUTOMATION`.
- **Priorité absolue (§34)** : le risque de rupture prime toujours sur
  l'économie de transport. Aucune exception, aucun seuil d'arbitrage.

---

## 7. Comparaison fournisseurs

```js
landedCost(supplier, lines) =
    Σ(unitPrice × qty)
  + (subtotal >= freeShippingThreshold ? 0 : shippingCost)
  + fraisFixes
  − remises
```

### Règle de recommandation

On ne change **jamais** de fournisseur automatiquement sans raison affichée.

```
si le fournisseur préféré ne peut pas livrer avant stockoutDate
   ET un alternatif le peut
   → recommander l'alternatif, raison = « évite une rupture »
      (même s'il est plus cher — §38)

sinon si landedCost(alternatif) < landedCost(préféré) − minSavings (10 €)
        ET aucun risque de rupture
   → suggérer l'alternatif, raison = « économie de N € »
      (suggestion, pas substitution automatique — §37)

sinon → conserver le fournisseur préféré
```

### Explicabilité (§39)

`explanationReasons[]` est produit par le moteur, ordonné, en langage métier :

```
[ "Stock projeté négatif dans 2 jours",
  "Ivoclar livre en 4 jours — trop tard",
  "Henry Schein livre demain",
  "Surcoût estimé : 12 €" ]
```

L'UI affiche les 2 premières lignes, le reste au clic. **Aucune recommandation
ne s'affiche sans au moins une raison.**

---

## 8. Réponses aux challenges obligatoires (§76)

| # | Risque | Réponse |
|---|---|---|
| 1 | **Commande inutile** | `incoming` dérivé des PO ouvertes + un besoin ne peut être porté que par une seule proposition (`coveredByProposalId`) + `shouldReplenish` teste la couverture avant de proposer. |
| 2 | **Attente franco trop longue** | `maxWaitDays` (5 j) + bascule auto `waiting → ready` + rupture prioritaire sur l'économie. |
| 3 | **Double comptage entrant** | `incoming` **n'est plus un champ**. Une seule formule, à partir des lignes de PO ouvertes. Le champ `incoming` de `demoStock` est supprimé à la migration. |
| 4 | **Réserver plus que le stock** | Autorisé : `availableStock` peut être **négatif**. Refuser la réservation masquerait un besoin de production réel. Le négatif est précisément le signal d'urgence. Jamais de clamp silencieux. |
| 5 | **Prix fournisseur manquant** | Proposition créée en `draft` + `blocking:['missing_price']`, **non validable**, événement `ERROR`. Jamais de prix supposé à 0 (fausserait le franco). |
| 6 | **Fournisseur principal indisponible** | Repli sur alternatif **avec raison affichée**. Aucun fournisseur → article marqué non réapprovisionnable + événement `ERROR`. |
| 7 | **Deux propositions, même stock** | Attribution déterministe : préféré d'abord, sinon landed cost le plus bas, sinon id le plus petit. Un article n'apparaît que dans une proposition ouverte. |
| 8 | **Annulation d'une commande client** | Réservation dérivée → disparaît d'elle-même. Les propositions ouvertes sont **recalculées** ; une proposition devenue injustifiée passe en `dismissed` avec événement explicatif — jamais supprimée en silence. |
| 9 | **Réception partielle** | `RECEIPT` de la quantité **réellement reçue** uniquement. PO → `partially_received`, reliquat toujours compté dans `incoming` → aucune nouvelle proposition pour ce reliquat. |
| 10 | **Correction manuelle du stock** | `ADJUSTMENT` (jamais d'écrasement). Recalcul du moteur ; si une proposition devient inutile → recommandation de rejet + événement. |
| 11 | **Conditionnement supérieur au besoin** | Arrondi **toujours vers le haut** (jamais sous le besoin), puis contrôle de couverture : au-delà de `maxCoverageDays`, WARNING affiché. Croisé avec `slowMovingStock()`. |

---

## 9. Stock dormant (§50-52)

```js
slowMovingStock():
  articles où  coverageDays > 180
            OU aucun CONSUMPTION depuis 120 jours
  → { article, coverageDays, lastConsumptionAt, recommendation:'DO_NOT_REORDER' }
```

Ces articles sont **exclus des propositions** (sauf passage sous `safetyStock`)
et listés dans l'onglet Réapprovisionnement sous « Ne pas réapprovisionner ».
Concrétise §52 : le moteur doit aussi savoir **ne pas** commander.

---

## 10. Import / Export

### 10.1 Assistant d'import — 6 étapes (§9)

`Type → Fichier → Mapping → Prévisualisation → Validation → Résultat`

Types : articles, stocks, fournisseurs, tarifs fournisseurs, commandes,
utilisateurs.

### 10.2 Mapping

Auto-détection par normalisation (minuscules, sans accents, sans ponctuation)
puis table de synonymes (`ref produit`, `reference`, `code` → `reference`).
**Toujours corrigeable manuellement.** Une colonne obligatoire non mappée bloque
l'étape suivante.

### 10.3 Validation — aucune erreur silencieuse (§11, §68)

```
184 lignes détectées
176 prêtes à importer
  8 à vérifier          [ Afficher uniquement les erreurs ]
```

Codes d'erreur : `MISSING_REQUIRED`, `INVALID_NUMBER`, `UNKNOWN_SUPPLIER`,
`DUPLICATE_REFERENCE`, `UNKNOWN_ARTICLE`, `NEGATIVE_QTY`.

**Import tout-ou-partie** : les lignes valides sont importées, les lignes en
erreur sont **rejetées et listées**, jamais ignorées. Le job est journalisé.

### 10.4 Export

- **Métier** (CSV/XLSX) : commandes, production, stocks, articles, fournisseurs,
  achats, traçabilité.
- **Export complet** (JSON unique) : sauvegarde/diagnostic du POC.
  Réutilise la sérialisation de `save()` + `schemaVersion`. Un export complet
  doit être ré-importable pour restaurer l'état — c'est le test de validité.

**Contrainte POC** : XLSX nécessiterait une librairie externe. **Recommandation :
CSV en P1** (natif, zéro dépendance) ; XLSX en P2 seulement si une CDN autorisée
est disponible. Le brief demande les deux formats — c'est un arbitrage à valider.

---

## 11. Journal d'activité

Écran sous Outils, filtres : `Toutes | Erreurs | Alertes | Automatisations | Actions`.

Rendu conforme au §7 du brief :

```
29 août · 10:42   ACHATS
Proposition Ivoclar créée
4 références · 428 € HT · Franco : 500 €              [ Voir le détail ]

29 août · 09:18   IMPORT
7 lignes n'ont pas pu être importées
stocks.xlsx                                          [ Voir les erreurs ]
```

`Voir le détail` ouvre la proposition (popup) ; `Voir les erreurs` ouvre le
rapport d'import. Le journal est **en lecture seule**, jamais éditable.

**Rétention** : 500 événements en mémoire, 200 persistés (bornage localStorage).
Purge FIFO, sauf `CRITICAL` conservés plus longtemps.

---

## 12. UX écran par écran

### 12.1 Stocks — liste (progressive disclosure, §62-64)

Une ligne ne montre que l'**essentiel** :

```
Zircone HT
Disponible 3 · En commande 5 · Besoin 7 j : 6        [Attention]
```

Interdit sur la ligne : physique + réservé + projeté + min + max + rotation +
consommation + délai + prix + franco simultanément (§63).

### 12.2 Article — popup (information)

Stock physique / réservé / disponible / en commande / projeté · couverture ·
consommation moyenne · fournisseurs (préféré + alternatifs, prix, délai) ·
derniers mouvements. Actions → side-window.

### 12.3 Achats — une seule page (§40-43)

```
À DÉCIDER
┌────────────────────────────────────────────────┐
│ Ivoclar          4 références        428 € HT  │
│ Franco 500 € · manque 72 €                     │
│ Aucun risque avant jeudi                       │
│ → ATTENDRE ET REGROUPER                        │
│           [ Voir la proposition ] [ Commander ]│
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ Henry Schein     2 références        184 € HT  │
│ ⚠ Risque de rupture demain · Transport 15 €    │
│ → COMMANDER MAINTENANT                         │
│                    [ Valider ] [ Voir détail ] │
└────────────────────────────────────────────────┘

COMMANDES EN COURS
CF-0042 · Ivoclar · attendu 02/09 · partiellement reçue (4/5)
```

Historique replié par défaut.

### 12.4 Import — wizard centré (arbitrage §66)

**Recommandation : wizard centré** (`quick-layer`), pas side-window.
Justification : l'import est une tâche focalisée à 6 étapes avec un tableau de
prévisualisation large — une side-window de 560 px est trop étroite, et la
doctrine « action → side-window » vise les **formulaires courts**, pas les
assistants multi-étapes. Le wizard centré est déjà le pattern des Quick View.

### 12.5 Export — depuis le menu utilisateur → Données

Boutons simples, un clic = un fichier. Pas d'assistant.

---

## 13. Scénarios de démonstration

Le dataset doit produire **naturellement** les 7 cas, sans mise en scène :

| Cas | Article | Situation | Attendu |
|---|---|---|---|
| A | Zircone HT | stock 45, conso faible | aucune action |
| B | Zircone LT | sous point de commande | proposition créée |
| C | Ivoclar (panier) | 428 € / franco 500 €, pas de risque | **ATTENDRE** |
| D | Zircone A2 | rupture J+1 | **COMMANDER MAINTENANT** |
| E | e.max | Henry Schein +12 € mais J+1 | alternatif recommandé, raison affichée |
| F | Zircone C4 | 24 en stock, 2/mois | **NE PAS COMMANDER** (dormant) |
| G | CF-0042 | 4 reçus sur 5 | réception partielle, reliquat attendu |

### Scénario narratif (§74) — enchaînement vérifiable

1. Stocks → Zircone A2 en tension.
2. Proposition Ivoclar générée : 428 € HT, franco 500 €.
3. Recommandation **ATTENDRE** (aucune rupture avant jeudi, marge de délai OK).
4. Création d'une commande client → la demande prévisionnelle augmente.
5. `stockoutDate` recalculée à demain → `lastSafeOrderDate` dépassée.
6. Recommandation bascule automatiquement en **COMMANDER MAINTENANT**.
7. Henry Schein : +12 € mais livre demain → recommandé, raison affichée.
8. Validation → `CF-0042` créée.
9. Réception simulée 4/5 → stock +4, reliquat attendu, PO `partially_received`.
10. Le Journal contient les 9 étapes, horodatées via `Clock.now()`.

**Point clé de la démo** : l'étape 6 doit se produire **sans intervention** —
c'est la preuve que le moteur recalcule et non qu'il affiche un état figé.

---

## 14. Cas limites

1. **Article sans fournisseur** → non réapprovisionnable, `ERROR`, exclu des propositions.
2. **Fournisseur sans franco** (`freeShippingThreshold: null`) → jamais de `WAIT`.
3. **Consommation moyenne nulle** → pas de `stockoutDate` calculable ; ne déclenche que sous `safetyStock`.
4. **Commande client sans nomenclature** (type inconnu) → aucune réservation + `WARNING` (jamais d'échec silencieux).
5. **Réception supérieure au commandé** → autorisée, `RECEIPT` du réel + `WARNING` « surlivraison ».
6. **PO annulée après réception partielle** → le reçu reste acquis, le reliquat sort de `incoming`.
7. **Article désactivé avec stock** → reste visible en stock, exclu du réappro.
8. **Import créant un doublon de référence** → ligne rejetée, jamais de fusion automatique.
9. **Deux validations simultanées** (POC mono-onglet : théorique — voir §15.2).
10. **Franco atteint puis besoin annulé** → panier repasse sous le franco, recommandation recalculée.

---

## 15. Risques

### 15.1 Risques produit

| Risque | Gravité | Mitigation |
|---|---|---|
| Dérive ERP — l'écran Achats devient une usine | **Élevée** | 1 page, 2 sections, 2 actions par carte. Toute colonne supplémentaire doit être justifiée par §77. |
| Le responsable ne comprend pas une recommandation | Élevée | `explanationReasons` obligatoire, jamais de verdict nu. |
| Sur-notification (achats qui polluent l'Accueil) | Moyenne | Max 2 alertes achats, uniquement rupture imminente / PO critique en retard (§61). **Jamais** « franco bientôt atteint ». |
| Le moteur commande trop (coût) ou trop peu (rupture) | Élevée | Garde-fous §8 + dataset de test couvrant les 7 cas. |

### 15.2 Risques techniques

| Risque | Mitigation |
|---|---|
| Saturation `localStorage` (mouvements + événements) | Bornage : 200 événements, mouvements purgés > 12 mois, pas de binaire. |
| Perte de données à la migration schemaVersion 5 → 6 | Réutiliser le pattern `migrateUsers` validé en V3.3.2 : fusion par présence de clé, jamais de reset. |
| Recalcul du moteur à chaque render | Cache mémoire invalidé sur mutation. À ~10 articles, non bloquant. |
| Concurrence (SaaS) | Voir ci-dessous. |

### 15.3 Opérations à rendre transactionnelles en SaaS (§70-71)

Trois opérations doivent être atomiques en production, non traitées dans le POC :

1. **Validation d'une proposition** → création de PO. Deux responsables validant
   simultanément créeraient deux commandes. *Verrou optimiste sur
   `proposal.status` + contrainte d'unicité `proposalId` sur PO.*
2. **Réception** → écriture de mouvements + mise à jour du statut PO.
   *Une seule transaction, sinon stock incrémenté sans PO à jour.*
3. **Réservation** (si un jour matérialisée) → lecture-puis-écriture non atomique
   pourrait sur-réserver. *Notre modèle dérivé évite le problème par construction.*

### 15.4 Droits (§72)

| Rôle | Droits |
|---|---|
| Responsable | Valider une proposition, commander, réceptionner |
| Admin | Fournisseurs, tarifs, paramètres du moteur, import/export |
| Technicien | Consommation (via scan), réception si autorisé |

POC : contrôles **modélisés mais non appliqués** (un seul utilisateur simulé).

---

## 16. Décisions à prendre — j'ai besoin de vos arbitrages

| # | Question | Ma recommandation |
|---|---|---|
| 1 | **Import/Export : où ?** La page Paramètres n'existe plus (§0.1) | Menu utilisateur → « Données » + wizard centré. Ne pas ressusciter Paramètres. |
| 2 | **Journal : nouveau ou unifié ?** Un audit existe déjà dans Rapports (§0.2) | Store unique `activityEvents` ; Rapports devient une vue filtrée. |
| 3 | **XLSX ou CSV seul ?** XLSX = dépendance externe (§10.4) | CSV en P1 ; XLSX en P2 sous réserve de CDN autorisée. |
| 4 | **Réservations dérivées ou stockées ?** (§2.3) | **Dérivées** — pas de dérive possible, pas de release à gérer. |
| 5 | **Solde stock dérivé ou persisté ?** (§3) | **Dérivé** des mouvements, cohérent avec la doctrine scan de V3.3. |
| 6 | **Consommation : au scan ou manuelle ?** | **Au scan du poste consommateur** — réutilise l'événement de vérité existant, zéro geste nouveau. |
| 7 | **`expressShippingCost` maintenant ?** | Non — P2. Double la logique de landed cost pour peu de valeur démo. |
| 8 | **4 modes d'automatisation codés ?** | Non — enum conservée, seul `SEMI_AUTO` implémenté. |
| 9 | **Nomenclature (BOM) éditable dans l'UI ?** | Non en P1 — constante en dur. Éditable = un écran de plus. |
| 10 | **Alertes achats sur l'Accueil ?** | Oui mais **2 maximum**, rupture imminente uniquement (§61). |

---

## 17. Plan d'implémentation

### P0 — Fondations (aucune UI nouvelle)

1. Migration `schemaVersion 5 → 6` (pattern `migrateUsers` réutilisé) :
   `demoStock` → `articles` + mouvements `OPENING` ; suppression du champ
   `incoming` ; split `min` → `safetyStock`.
2. `stockMovements` append-only + `physicalStock()` dérivé.
3. `suppliers`, `articleSuppliers`, nomenclature `BILL_OF_MATERIALS`.
4. `activityEvents` + `logActivity()` ; `logAudit()` devient un adaptateur.
5. `StockEngine` : disponible / entrant / projeté / couverture.
6. Écran Stocks mis à jour (colonnes Disponible / En commande / Besoin / État).

**Critère de sortie** : le stock affiché est identique à la V3.3.2 (aucune
régression visible) mais entièrement dérivé des mouvements. 0 erreur console.

### P1 — Le moteur et les Achats

7. `DemandEngine` (réservations dérivées, besoins prévisionnels).
8. `ReplenishmentEngine` : `shouldReplenish`, `calculateSuggestedQuantity`.
9. `SupplierEngine` : `landedCost`, comparaison, franco.
10. `ProposalEngine` : regroupement fournisseur, `recommendedAction`,
    `explanationReasons`.
11. Écran **Achats** (À décider / En cours) + popup détail proposition.
12. `PurchaseOrder` + réception (dont **partielle**) → mouvements `RECEIPT`.
13. Écran **Journal d'activité** + Rapports rebranché sur le store unique.
14. Consommation au scan du poste consommateur.
15. Dataset de démonstration couvrant les cas A→G.

**Critère de sortie** : le scénario §13 se déroule intégralement, la bascule
ATTENDRE → COMMANDER MAINTENANT se produit sans intervention manuelle.

### P2 — Données et confort

16. Export CSV métier + export complet JSON (ré-importable).
17. Assistant d'import (mapping, validation, rapport d'erreurs).
18. `slowMovingStock()` + section « Ne pas réapprovisionner ».
19. Onglet Fournisseurs (popup info / side-window édition).
20. Alertes achats sur l'Accueil (2 max).
21. XLSX *si* CDN autorisée ; `expressShippingCost` ; réception par scan (modèle).

---

## 18. Ce qui reste hors scope

Comptabilité, facturation fournisseur, rapprochement bancaire, OCR, EDI,
connexion fournisseur, paiement, fiscalité, marketplace, IA générative d'achat.

Et le rappel du §54 : **le moteur d'achat est déterministe, rule-based, testable
et explicable. Aucune IA dans la boucle de décision.**

---

## STOP — validation requise

Aucun fichier applicatif n'a été modifié. Merci d'arbitrer les **10 décisions du
§16** (en particulier les 3 écarts du §0) avant que l'implémentation ne démarre.
