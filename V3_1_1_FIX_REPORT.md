# DentalFlow Next — V3.1.1 — Rapport de correctif

**Fichier livré :** `public/poc/dentalflow-next-poc-v3.1.1.html`
**Base de départ :** `dentalflow-next-poc-v3.1.html`
**Nature :** hotfix fonctionnel (cohérence Dashboard / Alertes / Production). Aucune refonte UI, aucune nouvelle fonction métier, DentalFlow Scan / Messagerie / Quick View / Utilisateurs / Paramètres non modifiés.

---

## 1. Contexte

Le fichier de départ (v3.1) intégrait déjà une large partie du correctif demandé :

- donut alimenté par les données réelles via `orderDistribution()` + `buildDonutGradient()` (plus de `185` codé en dur, plus d'angles figés) ;
- répartition mutuellement exclusive (`getDistributionBucket()` : `completed` → `ready` → `blocked` → sinon `active`) ;
- dataset `weeklyProduction { entries, completed }` centralisé et `state.productionChartMode` ('entries' par défaut) ;
- tabs Entrées / Terminées interactifs (`data-chart-tab`, handler dans la délégation globale, `renderBars()` sur une seule série) ;
- source unique `getAttentionOrders()` utilisée par la cloche, le side-window Alertes (`alertItems()`), le compteur « Tout voir » et « À surveiller » ;
- microcopy KPI « Bloquées » (au pluriel).

L'audit a néanmoins révélé **4 incohérences résiduelles** par rapport au cahier des charges. Elles ont été corrigées.

---

## 2. Bugs corrigés

### FIX 1 — Règle d'attention non conforme + bug d'affichage (§16, §17, §22)
**Problème :** `getAttentionOrders()` incluait une 4ᵉ condition `isDueSoon` (« à livrer aujourd'hui ») en plus de `late / blocked / scan`. Conséquences :
- non conforme au §16 (« late OU blocked OU scan… rester simple ») ;
- inflation du compteur cloche / « Tout voir » ;
- **bug visuel** dans `renderWatch()` : une commande « à livrer aujourd'hui » (statut `progress`) retombait dans la branche `else` et s'affichait à tort comme **« Bloquée / Validation requise »**.

**Correctif :** suppression de `isDueSoon`, ajout d'un helper `needsAttention(order) = late || blocked || scan`, tri conservé (retard → blocage → scan). Le dataset démo donne alors exactement **1 retard + 2 bloquées + 1 scan = 4** (cf. scénario §28).

### FIX 2 — « Tout voir » n'envoyait pas vers la bonne vue (§14, §19)
**Problème :** le bouton « Tout voir » de l'Accueil utilisait `data-panel="alerts"` (ouvrait le side-window). Le §19 impose : ouvrir **Commandes** et activer le filtre **À surveiller**.
**Correctif :** `data-view="orders" data-filter="attention"`. Le side-window Alertes reste accessible via la cloche.

### FIX 3 — Filtre « À surveiller » absent de Commandes (§20)
**Problème :** la barre de filtres ne proposait pas « À surveiller ».
**Correctif :** ajout du chip `['attention','À surveiller']` : `Toutes · À surveiller · En retard · Bloquées · Prêtes · En cours · QC`.

### FIX 4 — `filteredOrders()` ne gérait pas le filtre `attention` (§21)
**Problème :** le filtre appliquait uniquement `o.status === state.filter` ; `attention` n'étant pas un statut, la liste ressortait vide.
**Correctif :** cas dédié `state.filter === 'attention'` → intersection avec `Set(getAttentionOrders().map(o => o.id))`, **sans casser la recherche combinée** (le filtre texte reste appliqué en amont).

### FIX 5 — Légende du donut (§5)
**Amélioration :** affichage systématique des **4 catégories** (En production / Prêtes / Bloquées / Terminées), y compris à 0, au lieu de masquer les catégories vides. La somme de la légende reste strictement égale au total central.

---

## 3. Fonctions modifiées

| Fonction | Modification |
|---|---|
| `getAttentionOrders()` | Retrait de `isDueSoon` ; s'appuie sur `needsAttention()`. |
| `needsAttention(order)` | **Nouveau** : `late || blocked || scan` (source de vérité §16). |
| `isDueSoon()` | **Supprimée** (plus référencée). |
| `renderHome()` | Bouton « Tout voir » → `data-view="orders" data-filter="attention"`. |
| `renderOrders()` | Ajout du filtre « À surveiller ». |
| `filteredOrders()` | Cas `attention` via `getAttentionOrders()`, recherche préservée. |
| `renderDonutLegend()` | Affiche les 4 catégories (suppression du `filter(r=>r[1]>0)`). |

Aucun ID de commande n'est codé en dur pour déterminer alertes ou répartition. Le champ résiduel `total:185` du dataset démo n'est lu par aucune fonction de rendu (donut, KPI et légende sont entièrement dérivés des données) ; laissé en place pour respecter le périmètre hotfix.

---

## 4. Scénarios testés & résultats

### Logique (dataset démo, exécution Node)
| Vérification | Attendu | Résultat |
|---|---|---|
| Total donut == nb commandes | 8 | ✅ 8 |
| Somme légende == total central | 8 | ✅ 5+1+2+0 = 8 |
| Catégories exclusives (aucune bloquée en production) | vrai | ✅ |
| Cloche / « Tout voir » | 4 (1 retard, 2 bloquées, 1 scan) | ✅ 4 |
| Tri À surveiller | retard → blocage → scan | ✅ |
| Accueil À surveiller | 3 max | ✅ |
| Passage d'une active en `blocked` | prod 5→4, bloquées 2→3, total inchangé | ✅ |
| Blocage supplémentaire | cloche / « Tout voir » +1 (4→5) | ✅ |

### Rendu navigateur (Playwright, Chromium)
| Vérification | Résultat |
|---|---|
| Centre du donut | ✅ « 8 Total » |
| Légende [En prod, Prêtes, Bloquées, Terminées] | ✅ [5, 1, 2, 0], somme 8 |
| Cloche | ✅ 4 |
| Libellé « Tout voir » | ✅ « Tout voir (4) » |
| Clic Terminées → tab actif + hauteurs de barres modifiées | ✅ |
| Retour Entrées | ✅ |
| Clic « Tout voir » → page Commandes, filtre « À surveiller » actif, 4 lignes | ✅ |
| Dark mode (`body` = #0B0B0C) | ✅ |
| Erreurs console | ✅ Aucune |

---

## 5. Definition of Done

- [x] Total du donut correct
- [x] Somme légende = total
- [x] Catégories exclusives
- [x] Aucun « 185 » codé en dur (donut)
- [x] Terminées fonctionne
- [x] Entrées fonctionne
- [x] Une seule série visible
- [x] « Tout voir » n'envoie plus uniquement vers Retard
- [x] Filtre « À surveiller » existe
- [x] « À surveiller » est dynamique
- [x] Cloche utilise la même source (`getAttentionOrders()`)
- [x] Alertes utilisent la même source
- [x] Aucun ID de commande codé en dur pour déterminer les alertes
- [x] Recherche + filtre fonctionnent ensemble
- [x] Aucune erreur console
- [x] Light mode intact
- [x] Dark mode intact
