# DentalFlow — Achats & Stocks — **CORRIGENDUM V1.2.1 FINAL**

Amende : `DENTALFLOW_PURCHASING_SPEC_V1.2_FINAL.md`
Base de code : `dentalflow-next-poc-v3.3.2.html` (schemaVersion 5) — **non modifié**

> **Portée.** Ce document corrige des incohérences de modèle de la V1.2.
> **Tout ce qui n'y figure pas reste valable et inchangé** : architecture, formules
> de demande et de projection, calendrier ouvré, protections de calcul, 16 tests,
> plan P0/P1/P2, hors-scope. Aucune fonctionnalité ajoutée.

Les 5 tests de ce corrigendum ont été **exécutés** ; les sorties affichées sont réelles.

---

## 0. Ce qui est corrigé

| # | Incohérence V1.2 | Correction |
|---|---|---|
| 1 | La démo affirmait « PP-001 mise à jour, aucune PP-002 » **tout en** désignant Henry Schein — impossible avec `supplierId` sur la proposition | §1–§2, §7 |
| 2 | `ALTERNATIF` utilisé comme `recommendedAction` alors qu'il ne figure pas dans l'énumération | §3 |
| 3 | `stockoutDate` / `lastSafeOrderDate` employés tantôt en nombre de jours, tantôt en date | §5 |
| 4 | `blocking:['missing_price']` posé sur une `PurchaseOrder`, qui n'a pas ce champ | §6 |
| 5 | `SUP-UNKNOWN` exposé comme un fournisseur métier | §6.2 |
| 6 | Contrôles UI P2 (Dormants, onglet Fournisseurs) montrés dans les maquettes P0/P1 | §8 |
| 7 | *(découvert en vérifiant le Test B)* l'arbre pouvait conclure `ORDER_NOW` 27 jours ouvrés avant l'échéance | §4.2 |

---

## 1. Invariant : une proposition = un fournisseur

`PurchaseProposal.supplierId` existe → **une proposition est toujours un panier
destiné à UN fournisseur**. Elle peut contenir plusieurs articles, mais tous doivent
être commandables chez ce fournisseur.

> **Interdit** : changer le `supplierId` d'une proposition existante. Basculer PP-001
> d'Ivoclar vers Henry Schein emporterait silencieusement l'Adhésif, le Colorant et
> les Disques — qui ne sont pas commandables chez Henry Schein.

Deux situations, deux comportements :

| Situation | Comportement |
|---|---|
| Le fournisseur recommandé **ne change pas** | mise à jour de la ligne dans la **même** proposition (V1.2 §7, inchangé) |
| Le fournisseur recommandé **change pour un article** | la ligne **migre** vers la proposition de ce fournisseur ; l'ancienne proposition est recalculée sans elle |

---

## 2. Réconciliation par `(supplierId, articleId)`

La clé de réconciliation est le **couple**, jamais `articleId` seul.

```
1. ReplenishmentEngine  → besoin par article          (indépendant du fournisseur)
2. SupplierEngine       → recommendedSupplierId       (qui peut livrer, à quel coût)
3. Dimensionnement      → quantité calculée AVEC le leadTime DU FOURNISSEUR RETENU
4. ProposalEngine       → réconciliation :

   pour chaque besoin { articleId, recommendedSupplierId, requiredQty } :
       P ← proposition OUVERTE dont supplierId === recommendedSupplierId
       si P existe : mettre à jour la ligne articleId, ou l'ajouter
       sinon       : créer une proposition pour ce fournisseur

       si articleId figurait dans une proposition ouverte d'un AUTRE fournisseur :
           retirer cette ancienne ligne

   pour chaque proposition ouverte :
       recalculer subtotal, shippingCost, total, missingForFreeShipping,
                  missingForMinimumOrder, riskLevel, earliestStockoutAt,
                  lastSafeOrderAt, projectedFrancoAt, recommendedAction,
                  explanationReasons, updatedAt
       si elle est devenue vide → status = 'dismissed' + ActivityEvent
```

**Ordre des opérations (précision issue de la correction).** Le dimensionnement vient
**après** le choix du fournisseur, parce que `orderHorizon = leadTime +
reviewPeriodDays` dépend du délai retenu. `stockoutWorkingDays`, lui, ne dépend
d'aucun fournisseur — il ne dépend que du stock, de la demande et des entrants.

*Dans le jeu de démonstration, Ivoclar (3 jo → h = 13) et Henry Schein (1 jo → h = 11)
donnent tous deux 9 unités, parce que `knownDemand` domine et est plat sur cet
intervalle. La règle reste néanmoins de recalculer.*

Aucune suppression silencieuse : vider une proposition la met en `dismissed` **avec
un événement**, jamais un effacement.

---

## 3. « Quoi faire » ≠ « chez qui commander »

`recommendedAction` conserve **exactement** quatre valeurs :

```
ORDER_NOW | WAIT | NO_ACTION | BLOCKED
```

**`ALTERNATIF` n'est pas une action** et disparaît de l'arbre de décision. Le choix du
fournisseur est porté par des champs distincts, produits par `SupplierEngine` :

```js
{
  recommendedSupplierId,        // fournisseur retenu
  preferredSupplierId,          // fournisseur préféré de l'article
  supplierChanged,              // true si recommandé ≠ préféré
  supplierExplanationReasons: []
}
```

Exemple :

```js
recommendedAction:    'ORDER_NOW'
recommendedSupplierId:'SUP-HENRY'
supplierChanged:      true
supplierExplanationReasons: [
  "Rupture prévue mardi 25/08",
  "Ivoclar livre mercredi 26/08 — trop tard",
  "Henry Schein livre lundi 24/08",
  "Surcoût estimé : 18 €"
]
```

Rendu :

```
COMMANDER MAINTENANT
Henry Schein recommandé · surcoût 18 €
```

### Minimum de commande — arbre corrigé

L'ancienne branche `→ ALTERNATIF` devient une action **plus** un fournisseur :

| Situation | `recommendedAction` | `recommendedSupplierId` |
|---|---|---|
| `subtotal ≥ minimumOrder` | *(suite de l'arbre)* | préféré |
| `< minimumOrder`, **pas** d'urgence | `WAIT` | préféré |
| `< minimumOrder`, urgence, alternatif viable | **`ORDER_NOW`** | **alternatif** |
| `< minimumOrder`, urgence, aucun alternatif | `BLOCKED` | — |

Message inchangé : « Minimum de commande fournisseur non atteint. » · affichage
« 92 € / minimum 150 € » · action manuelle « Compléter la commande ». Jamais d'ajout
automatique de produits inutiles.

---

## 4. Arbre de décision — version corrigée

### 4.1 Arbre

```
BLOCKED     si prix manquant, fournisseur inactif, ou aucun tarif
BLOCKED     si subtotal < minimumOrder ET urgence ET aucun alternatif viable
NO_ACTION   si aucune ligne n'a de stockoutWorkingDays calculable
ORDER_NOW   si today ≥ lastSafeOrderAt                    ← la rupture prime toujours
ORDER_NOW   si missingForFreeShipping ≤ 0                 ← franco déjà atteint
WAIT        si projectedFrancoAt ≤ lastSafeOrderAt
            ET waitWorkingDays ≤ maxWaitDays
            ET shippingCost ≥ minSavings
WAIT        si today < subLabWorkingDays(lastSafeOrderAt, maxWaitDays)   ← §4.2
ORDER_NOW   sinon                        ← échéance proche, franco hors d'atteinte
```

`subtotal < minimumOrder` sans urgence force `WAIT` (§3).

### 4.2 La ligne ajoutée, et pourquoi

En vérifiant le **Test B**, PP-Ivoclar réduite à 3 références donne :
`subtotal 218 €`, `manque franco 282 €`, `lastSafeOrderAt = mardi 29/09`.

Avec l'arbre V1.2, aucune branche `WAIT` ne s'appliquait (le franco n'est pas
atteignable sous `maxWaitDays`) et le `sinon` final concluait **`ORDER_NOW`** — soit
commander **27 jours ouvrés avant l'échéance**, pour 218 € et 18 € de transport.

`maxWaitDays` visait « ne pas attendre indéfiniment un franco » ; il ne doit pas
forcer une commande très en avance. D'où la ligne ajoutée : *tant qu'il reste plus de
`maxWaitDays` avant l'échéance, il n'y a rien à décider aujourd'hui*.

**Vérification de non-régression** *(sortie exécutée)* :

| Proposition | Sous-total | Limite | Verdict | Attendu |
|---|---|---|---|---|
| Ivoclar avant urgence (4 réf.) | 428 € | jeu 27/08 | **WAIT** *(franco atteignable jeu 27/08)* | WAIT ✔ |
| Ivoclar après découpage (3 réf.) | 218 € | mar 29/09 | **WAIT** *(marge confortable)* | WAIT ✔ |
| Henry Schein (Zircone ×9) | 414 € | ven 21/08 | **ORDER_NOW** *(échéance atteinte)* | ORDER_NOW ✔ |

Aucune décision de la V1.2 ne change ; seul le cas nouvellement créé par le
découpage est traité.

---

## 5. Typage : jamais de Date confondue avec un nombre de jours

La V1.2 employait `stockoutDate` à la fois comme entier (§4 : « plus petit h ») et
comme date (§13.3 : « mer 02/09 »). Deux notions, deux noms, deux types.

```js
stockoutWorkingDays = plus petit h ≥ 0 tel que projectedStock(h) < 0     // Number | null
stockoutAt          = addLabWorkingDays(today, stockoutWorkingDays)      // Date | null
lastSafeOrderAt     = subLabWorkingDays(stockoutAt, leadTimeDays + securityMarginDays)  // Date
```

**Règles de nommage**

- Suffixe `…WorkingDays` → **Number** (horizon en jours ouvrés).
- Suffixe `…At` → **Date**.
- Les noms ambigus `stockoutDate` et `lastSafeOrderDate` sont **supprimés** du modèle
  et du vocabulaire.
- Ne jamais passer un nombre de jours à une fonction attendant une `Date`, ni
  l'inverse. `subLabWorkingDays(stockoutAt, n)` prend une **Date** et un **Number**.

Champs renommés : `PurchaseProposal.earliestStockoutAt`, `.lastSafeOrderAt`,
`.projectedFrancoAt` ; `PurchaseProposalLine.stockoutAt`.

**L'UI affiche toujours la date réelle**, jamais un `J+N` quand la date est connue :

```
Rupture prévue mardi 25 août
Commander au plus tard vendredi 21 août
```

### TEST D — typage *(exécuté)*

```
today               = ven 21/08
stockoutWorkingDays = 2          (Number)
stockoutAt          = mar 25/08  (Date)   ✔ attendu mardi 25/08
leadTime 1 jo · marge 1 jo
lastSafeOrderAt     = ven 21/08  (Date)   ✔ attendu vendredi 21/08
```

---

## 6. Qualité de données sur les commandes fournisseurs

### 6.1 `dataQualityFlags` au lieu de `blocking`

`blocking` appartient à `PurchaseProposal` (une proposition non validable).
Une PO synthétique de migration **représente déjà un engagement historique** : elle
n'a pas à être « validable ». Elle est simplement incomplète.

```js
PurchaseOrder {
  …,
  migrationSource,        // 'legacyIncoming'
  dataQualityFlags: []    // ['missing_supplier', 'missing_price', …]
}
```

**Invariant absolu** : une donnée commerciale manquante ne fait **jamais** disparaître
une quantité physique attendue.

```
incomingStock(article) compte la PO même si supplierId ou unitPrice est absent.
```

Un `ActivityEvent` `WARNING` accompagne chaque PO portant des `dataQualityFlags`.

### 6.2 Pas de faux fournisseur

`SUP-UNKNOWN` est **supprimé**. Une PO de migration dont le fournisseur est inconnu
porte `supplierId: null`.

Conséquences :
- elle **compte** dans `incomingStock` — la projection physique reste juste ;
- elle **n'apparaît pas** comme fournisseur sélectionnable pour de nouveaux achats ;
- elle est identifiée dans l'UI comme *donnée migrée incomplète*, pas comme un
  partenaire commercial.

### TEST E — migration fournisseur inconnu *(exécuté)*

```
legacy : qty = 10 · incoming = 5 · fournisseur inconnu

physicalStock = 10                        (mouvement OPENING)
CF-MIG-001    supplierId = null
              migrationSource = 'legacyIncoming'
              dataQualityFlags = ['missing_supplier', 'missing_price']
incomingStock = 5                         ✔ la quantité compte malgré la donnée manquante
```

---

## 7. Démonstration corrigée

La narration V1.2 §13.5 (étapes 6-7) était contradictoire. Version exacte :

1. **PP-001 — Ivoclar** : Zircone HT ×5, Adhésif ×50, Colorant ×4, Disques ×5 =
   **428 €**, manque 72 € → **ATTENDRE ET REGROUPER**
   *(franco atteignable jeudi 27/08, limite de commande jeudi 27/08)*
2. Nouvelle commande client : 2 bridges = 4 disques de Zircone, échéance mardi 25/08.
3. Le besoin Zircone passe de 5 à **9 unités** ; rupture recalculée
   **mercredi 02/09 → mardi 25/08**.
4. Ivoclar livre mercredi 26/08 — **trop tard**. Henry Schein livre lundi 24/08.
5. **La ligne Zircone quitte PP-001** *(le `supplierId` de PP-001 n'est pas modifié)*.
6. **PP-001 — Ivoclar** est recalculée : Adhésif + Colorant + Disques = **218 €**,
   limite mardi 29/09 → **ATTENDRE** *(marge confortable)*.
7. **PP-002 — Henry Schein** est créée : Zircone HT ×9 = **414 €**, franco 200 €
   atteint → transport 0 € → **COMMANDER MAINTENANT**, `supplierChanged: true`,
   surcoût **18 €** expliqué.
8. Validation de **PP-002** → **CF-0042** (Henry Schein).
9. Réception **8/9** → stock +8, reliquat 1 attendu, `partially_received`.
10. Aucune nouvelle proposition : le reliquat est couvert par `incomingStock`.
11. Le Journal contient les 10 étapes, horodatées via `Clock.now()`.

**Point de démonstration** : les étapes 3 à 7 se produisent **sans action de
l'utilisateur**, et le panier Ivoclar **survit** au départ de la ligne urgente — c'est
ce qui rend visible l'invariant « une proposition = un fournisseur ».

### TEST A — même fournisseur *(exécuté)*

```
PP-001 Ivoclar : Zircone ×5, Adhésif ×50, Colorant ×4, Disques ×5 = 428 €  → WAIT
Ivoclar reste recommandé après recalcul
→ PP-001 : Zircone ×9 ... même proposition, nombre de propositions = 1     ✔
```

### TEST B — changement de fournisseur *(exécuté)*

```
PP Henry Schein (1 réf.)  Zircone HT ×9 · 414 € · transport 0 €
                          rupture mar 25/08 · limite ven 21/08
                          → ORDER_NOW   supplierChanged = true

PP Ivoclar     (3 réf.)   Adhésif ×50, Colorant ×4, Disques ×5 · 218 €
                          manque franco 282 € · limite mar 29/09
                          → WAIT (marge confortable)
```
Le panier Ivoclar conserve bien ses trois autres lignes. ✔

### TEST C — retour au fournisseur préféré *(exécuté)*

```
L'urgence disparaît avant validation → recalcul
Ivoclar redevient viable (livre mer 26/08 ≤ rupture mer 02/09)
→ la ligne Zircone revient dans la proposition Ivoclar (4 réf., 428 €)
→ proposition Henry Schein : plus aucune ligne → status 'dismissed'
   ActivityEvent : « Proposition Henry Schein devenue inutile après recalcul. »
```
Aucune suppression silencieuse. ✔

---

## 8. UI : aucun contrôle inactif avant son incrément

**Règle** : une fonction P2 n'est **visible** que lorsqu'elle est implémentée.

| Élément | Incrément | Visible en P0/P1 ? |
|---|---|---|
| Filtres Stocks `Tous · À surveiller · Stock faible` | P0 | **oui** |
| Filtre `Dormants` (dépend de `slowMovingStock()`) | **P2** | **non** |
| Onglet **Fournisseurs** | **P2** | **non** — Stocks n'affiche pas d'onglets tant qu'il n'y a qu'Articles |
| Assistant d'import (`wizardLayer`) | **P2** | **non** — l'entrée « Données » du menu utilisateur n'apparaît qu'en P2 |
| Export CSV | **P2** | **non** |

En P0/P1, l'écran Stocks est donc une **liste unique d'articles** avec trois filtres,
sans barre d'onglets. Les onglets apparaissent en P2 avec Fournisseurs.

Un contrôle grisé « bientôt disponible » est proscrit : il occupe de la place et
n'apporte rien au responsable.

---

## 9. Invariants finaux — mis à jour

| Concept | Nature | Règle |
|---|---|---|
| **StockMovement** | fait physique **immuable** | jamais modifié, jamais purgé ; le solde en découle |
| **ScanEvent** | fait de localisation **immuable** | `stageLabelAtScan` figé (doctrine V3.3) |
| **KnownDemand** | projection dérivée | depuis commandes + BOM, jamais stockée |
| **IncomingStock** | projection dérivée | depuis les PO ouvertes, jamais stockée |
| **PurchaseProposal** | **recommandation fournisseur-spécifique** | *voir ci-dessous* |
| **PurchaseOrder** | **engagement fournisseur réel** | seul objet matérialisant une quantité attendue |
| **ActivityEvent** | journal explicatif | append-only, ne porte aucune vérité métier |

> **Aucune paire de ces concepts ne stocke deux fois la même vérité.**

### Nouvel invariant — `PurchaseProposal`

Une proposition **n'est pas une vérité physique**. C'est une recommandation attachée
à **un** fournisseur, qui peut être **créée**, **mise à jour**, **vidée** ou
**`dismissed`** par simple recalcul.

- **Avant validation** : un changement de fournisseur recommandé **déplace le besoin
  d'une proposition vers une autre**. Le `supplierId` d'une proposition n'est jamais
  réécrit.
- **Après validation** : un changement de fournisseur recommandé **ne modifie jamais**
  une `PurchaseOrder` existante. L'engagement est pris ; seule une action explicite
  (annulation, nouvelle commande) peut le changer.

---

## 10. Récapitulatif des modifications

| Section V1.2 | Modification |
|---|---|
| §3.7 `PurchaseProposal` | `earliestStockoutAt`, `lastSafeOrderAt`, `projectedFrancoAt` (Dates) ; `PurchaseProposalLine.stockoutAt` |
| §3.8 `PurchaseOrder` | ajout de `dataQualityFlags: []` |
| §4 formules | `stockoutWorkingDays` (Number) et `stockoutAt` (Date) séparés ; `lastSafeOrderAt` calculé depuis une Date |
| §7 réconciliation | clé `(supplierId, articleId)` ; migration de ligne entre propositions ; dimensionnement après le choix du fournisseur |
| §8.2 arbre | `ALTERNATIF` retiré ; ajout de la garde « marge confortable » (§4.2) |
| §8.3 minimumOrder | branche alternative exprimée en `ORDER_NOW` + `recommendedSupplierId` |
| §10 migration | `blocking` → `dataQualityFlags` ; `SUP-UNKNOWN` → `supplierId: null` |
| §12.1 UI Stocks | filtre Dormants et onglet Fournisseurs retirés de P0/P1 |
| §13.5 démonstration | narration corrigée : PP-001 conserve Ivoclar, PP-002 créée pour Henry Schein |
| §14 invariants | ajout de l'invariant `PurchaseProposal` (avant / après validation) |

**Inchangé** : `expectedDemand = max(knownDemand, baselineDemand)`, `projectedStock`,
`shouldReplenish`, quantité suggérée `(R,S)` avec `minimumQty` avant l'arrondi,
calendrier ouvré, `franco == null`, `coverageDays`, `consumptionKey`, les 16 tests
de la V1.2, le plan P0/P1/P2, le hors-scope.

---

## 11. Récapitulatif des tests du corrigendum

| # | Test | Résultat |
|---|---|---|
| A | Même fournisseur → mise à jour | 1 seule proposition, Zircone 5 → 9 ✔ |
| B | Changement de fournisseur | PP Henry Schein (Zircone ×9, ORDER_NOW) + PP Ivoclar (3 réf., 218 €, WAIT) ✔ |
| C | Retour au préféré | ligne rendue à Ivoclar, PP Henry Schein `dismissed` + événement ✔ |
| D | Typage stockout | `2` (Number) → mar 25/08 (Date) → limite ven 21/08 (Date) ✔ |
| E | Migration fournisseur inconnu | `supplierId: null`, flags posés, `incomingStock = 5` ✔ |
| — | Non-régression de l'arbre | les 3 décisions V1.2 inchangées ✔ |

Tous cohérents.

---

# SPEC READY FOR IMPLEMENTATION — P0

`dentalflow-next-poc-v3.3.2.html` n'a pas été modifié.

Documents de référence pour l'implémentation, dans cet ordre :
1. `DENTALFLOW_PURCHASING_SPEC_V1.2_FINAL.md` — architecture, formules, tests
2. `DENTALFLOW_PURCHASING_SPEC_V1.2.1_FINAL.md` — **ce corrigendum, prioritaire en
   cas de divergence**

**Modèle recommandé : CLAUDE SONNET 5, effort ÉLEVÉ.**
Démarrer par **P0** (§17 de la V1.2), avec les 16 tests de la V1.2 et les 5 tests
ci-dessus comme suite de non-régression.

L'implémentation n'est pas lancée.
