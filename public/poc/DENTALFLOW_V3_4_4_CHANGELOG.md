# DentalFlow Next — Changelog V3.4.4

Hotfix « invariants de données » suite à un second audit indépendant de la V3.4.3. Corrige uniquement 4 anomalies résiduelles — aucune nouvelle fonctionnalité, aucune refonte.

## Corrigé (P0 — bloquant)

- **Migration `legacyIncoming` inventait un fournisseur** : `migrateStockArrayToV6()` déduisait `supplierId`/`unitPrice` du catalogue fournisseur *actuel* pour une commande legacy dont le fournisseur historique réel est inconnaissable. Désormais `supplierId=null`, `unitPrice=null`, `lineTotal=null`, flags `missing_supplier`+`missing_price` systématiques ; la quantité `incoming` reste toujours préservée à l'unité près.
- **Premier lancement (localStorage vide) utilisait un V5 fictif migré** : un boot à vide passait par le `seed()` legacy (`ZIR-HT-001 qty:45`) puis migrait ce state via `migrateStockArrayToV6()`, produisant un état de démo différent de « Réinitialiser la démo » (Zircone=5). Un drapeau `state.__noPersistedState`, posé uniquement par la branche de repli de `load()`, fait désormais appeler `seedV6()` nativement pour un démarrage réellement vide — premier démarrage et reset démo produisent maintenant le même état canonique.
- **PO fermée (`cancelled`/`received`) restait réceptionnable** : `receivePurchaseOrder()` n'avait aucune vérification de statut. Ajout d'une garde utilisant la constante existante `PURCHASE_STATUSES_OPEN` : seules `ordered`/`confirmed`/`shipped`/`partially_received` sont réceptionnables ; refus explicite `{success:false, reason:'PO_NOT_RECEIVABLE', status}` sinon, sans aucune mutation. Le garde-fou de surquantité de la V3.4.3 reste intact et s'applique en complément.

## Corrigé (P1)

- **Fournisseur alternatif « viable » pas réellement commandable** : `chooseSupplier()` choisissait, en urgence, le fournisseur le plus rapide sans vérifier que SON PROPRE minimum de commande était atteint pour une quantité recalculée avec SES PROPRES paramètres (délai, minimum, pack). Un candidat n'est désormais viable que s'il est actif, à prix connu, livre à temps, ET atteint son propre minimum. Parmi les viables : priorité au respect du délai (filtre), puis au coût rendu (`landedCost`) le plus bas, puis au délai le plus court en cas d'égalité stricte de coût.

## Tests

42 tests unitaires isolés (35 conservés de la V3.4.3, aucune assertion affaiblie + 7 nouveaux ciblant chacune des 4 anomalies), tous verts, état identique avant/après. Complétés par des vérifications en contexte navigateur réel et neuf (premier démarrage à vide, migration à froid avec rechargement) et une comparaison stricte premier-démarrage vs reset-démo. Voir `DENTALFLOW_V3_4_4_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

UI, Stocks (formules), `knownDemand`, système d'import, architecture V6, `decideProposal`/`computeNeeds`/`reconcileProposals`/`approveProposal`/`seedV6`/`resetDemoV6` — conformément à la consigne de ne corriger que les 4 anomalies désignées.
