# DentalFlow Next — Changelog V3.6.2

Hotfix ciblé sur la base V3.6.1 (`dentalflow-next-poc-v3.6.1.html`), déjà globalement validée. Corrige **uniquement** les 3 anomalies résiduelles identifiées par un audit indépendant — aucune autre fonctionnalité n'est touchée. Livrable : `dentalflow-next-poc-v3.6.2.html`.

## Corrigé

- **Retour de stock faux par lot sur plusieurs retours partiels successifs** : le plafond global (article) restait juste, mais l'allocation PAR LOT était recalculée à chaque retour en ré-agrégeant les `lotAllocations` de la consommation d'ORIGINE — un lot déjà entièrement soldé par un retour précédent pouvait être re-proposé, faisant excéder localement `retourné > consommé` sur ce lot alors que le total article restait correct. Nouveau helper canonique `returnableLotAllocationsForOrderArticle()` : solde retournable par lot = consommé sur ce lot − déjà retourné sur ce lot, dérivé à chaque appel de l'historique complet des mouvements CONSUMPTION/RETURN. Un lot épuisé n'est plus jamais re-proposé ; l'ordre de consommation d'origine est respecté pour les nouveaux retours.
- **`knownDemand()` recréait une fausse demande sur des étapes antérieures à une reprise** : pendant une reprise redémarrant tardivement (ex. Contrôle qualité), les lignes BOM des étapes AMONT (Usinage, Céramique) déclenchaient à tort un nouveau besoin, alors qu'une reprise ne rejoue jamais les étapes qu'elle ne redémarre pas. Nouvelle règle canonique : une ligne BOM appartient à la demande d'une reprise seulement si son `consumeAtStageId` est égal ou postérieur au `restartStageId`, comparé par l'ordre canonique des étapes (`stageDefinitions[].order`, jamais par comparaison d'identifiants). Nouveau helper `isStageAtOrAfter()`.
- **`createInvoice()` ne détectait pas un `orderId` dupliqué dans la même sélection** : une même commande apparaissant deux fois dans l'appel (adjacente ou non) passait les contrôles individuels et était doublement ajoutée à la facture. Détection explicite de tout doublon avant toute mutation — refus complet (`DUPLICATE_ORDER_ID`), aucune facture créée.

## Tests

134 tests V3.6.1 strictement conservés, inchangés, tous PASS. 9 nouveaux tests (T135-T146) couvrant les 3 correctifs avec scénarios séquentiels réels (jamais des appels isolés en état neuf). Voir `DENTALFLOW_V3_6_2_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

StockEngine/FEFO/`lotAvailableQty` (déjà corrects en V3.6.1), scanner caméra DataMatrix, interface Factures, écrans de reprise, modèle V7 (`schemaVersion` inchangé), navigation/thèmes/responsive.
