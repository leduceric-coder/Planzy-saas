# DentalFlow Next — Changelog V3.4.5

Micro-hotfix suite à un audit indépendant de la V3.4.4. Corrige un seul défaut métier résiduel — aucune nouvelle fonctionnalité, aucun refactor général.

## Corrigé (P1)

- **Sélection d'un fournisseur alternatif non réellement viable dans la seconde passe de `computeNeeds()`** : quand le minimum de commande du fournisseur préféré n'était pas atteint pour un besoin urgent, le moteur reroutait vers l'alternatif le plus rapide sans vérifier que CE fournisseur atteignait lui-même son propre minimum de commande pour sa propre quantité recalculée. Un fournisseur rapide mais sous son minimum pouvait ainsi être choisi puis finir `BLOCKED`, alors qu'un autre fournisseur (plus lent mais réellement commandable) existait. Extraction d'un helper canonique unique — `evaluateSupplierCandidate()` — désormais utilisé à la fois par `chooseSupplier()` et par la seconde passe de `computeNeeds()`, éliminant toute divergence entre les deux définitions de « fournisseur viable » qui coexistaient jusqu'ici.

Un fournisseur alternatif n'est retenu que s'il est actif, à tarif actif, à prix connu, avec un `packSize`/`minimumQty` valides, livrant avant la rupture, ET atteignant son propre minimum de commande pour une quantité recalculée avec ses propres `leadTimeDays`/`minimumQty`/`packSize`. Parmi les candidats viables : priorité au respect du délai (filtre), puis au coût rendu (`landedCost`) le plus bas, puis au délai le plus court en cas d'égalité stricte de coût.

## Tests

46 tests unitaires isolés (42 conservés de la V3.4.4, aucune assertion affaiblie + 4 nouveaux ciblant précisément cette anomalie via le moteur réel — `computeNeeds`/`reconcileProposals`, jamais d'assignation manuelle de `recommendedSupplierId`), tous verts, état identique avant/après. Reproduction du bug documentée contre le code non modifié de la V3.4.4 avant correction. Voir `DENTALFLOW_V3_4_5_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

`knownDemand`, `baselineDemand`, `expectedDemand`, `projectedStock`, persistance V6, migration V5→V6, `legacyIncoming`, premier démarrage V6, `resetDemoV6`, `receivePurchaseOrder`, `approveProposal`, import, responsive, privacy — conformément à la consigne de ne corriger que l'anomalie désignée. La dette d'architecture `seed()`/`seedV6()` notée par l'audit reste volontairement non traitée (hors périmètre, non bloquante).
