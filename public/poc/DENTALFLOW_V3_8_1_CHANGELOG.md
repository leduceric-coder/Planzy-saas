# DentalFlow Next V3.8.1 — Changelog

Base : `dentalflow-next-poc-v3.8.html` (174/174 PASS). Livrable : `dentalflow-next-poc-v3.8.1.html`. V3.8 n'a jamais été modifié.

Schéma : **V9 inchangé** (aucun nouveau concept d'état). V3.8.1 est une correction de logique métier et de réparation de données — pas une migration de schéma. Les réparations (`repairLegacyTraceabilityV9`, `repairLegacyLifecycleDates`) s'exécutent à **chaque démarrage**, jamais seulement lors d'un changement de `schemaVersion`.

## Partie A/B/D/E/F/G — `orderTimeline()` réécrite en histoire métier

- Premier événement dépendant de la source : **« Commande reçue »** (source `CABINET`, saisie cabinet) vs **« Commande saisie au laboratoire »** (source `LAB_MANUAL`) — jamais un seul libellé générique pour les deux origines.
- Bon de suivi imprimé + première localisation Réception (LocationEvent SYSTEM) **fusionnés en une seule ligne** : **« Suivi démarré — Réception »**, détail « Bon de suivi imprimé » — fini les deux lignes redondantes du même instant.
- Chaque changement de poste réel : **« Entrée en {poste} »** + détail **« Scan · {Nom} »** ou **« Localisation manuelle · {Nom} »** — le acteur et la méthode (scan vs manuel) sont maintenant lisibles dans le détail, jamais dans le libellé principal.
- **« Prête à livrer » ne s'affiche plus jamais en doublon** de l'arrivée à la dernière étape : quand `productionCompletedAt` coïncide avec le LocationEvent d'arrivée à la dernière étape, une seule ligne fusionnée « Prête à livrer » (avec le détail scan/manuel de cette arrivée) remplace les deux lignes distinctes de V3.8.
- **Cycles de reprise identifiables** : tout LocationEvent portant un `reworkId` est préfixé **« Reprise N — »** (ex. « Reprise 1 — Entrée en Céramique ») — jamais confondu avec le cycle initial de production.
- **Filtre défensif anti-Scan-Réception** dans `orderTimeline()` elle-même (en plus du refus moteur et de `repairLegacyTraceabilityV9`) : un Scan Réception ne peut plus jamais apparaître, sur aucune donnée, même non réparée.
- Les anciens `StockMovement` RETURN (`sourceType:'cancelledOrder'`) **ne sont plus jamais affichés dans la timeline d'une commande** — ils restent, intacts et jamais supprimés, dans `state.stockMovements` (visibles dans Journal/Stock/Audit).

## Partie C — `repairLegacyTraceabilityV9(state)` (nouvelle fonction)

- Neutralise (retire de `state.locationEvents`) tout LocationEvent hérité `source:'SCAN'` sur le poste non-scannable (Réception) — ces entrées étaient un artefact du backfill `migrateV8toV9()` de V3.8 (reconstruites depuis d'anciens `scanEvents` de Réception, jamais possibles depuis que `moveOrderToStage` refuse tout scan à Réception).
- **Ne touche jamais `state.scanEvents`** (l'historique brut réel) — seul le LocationEvent dérivé/synthétique est neutralisé.
- Backfille un LocationEvent SYSTEM Réception manquant quand `trackingSheetFirstPrintedAt` existe mais qu'aucune trace de suivi démarré n'a survécu.
- **Idempotente**, appelée à **chaque démarrage** (`ensureV34Model()`), y compris sur un état déjà en schéma V9 persisté par V3.8 (`persistedV7` vrai — le correctif ne pouvait donc pas passer par une migration de schéma classique, d'où cet appel inconditionnel hors des deux branches `if(!persistedV7)`).
- Sans effet sur un seed frais (`seedV9Orders()` ne construit que via le moteur réel, zéro artefact hérité par construction).

## Partie H — `repairLegacyLifecycleDates(order, state)` (nouvelle fonction)

- Ramène `order.createdAt` au minimum des horodatages réels déjà connus (`physicalImpressionReceivedAt`, `trackingSheetFirstPrintedAt`, `locationEvents[].at`, `productionCompletedAt`, `deliveredAt`, `cancelledAt`, `reworks[].createdAt`) quand ce `createdAt` est postérieur à l'un d'eux.
- **N'invente jamais de date** : si aucun horodatage réel n'est connu, `createdAt` reste inchangé.
- Appelée pour **chaque commande, à chaque démarrage**, juste après `repairLegacyTraceabilityV9()` (pour que le LocationEvent SYSTEM Réception backfillé participe au calcul du minimum).

## Partie I/J/K — Fonction de localisation manuelle rendue PROMINENTE + règles moteur

- **Bug de fond corrigé** : le mécanisme « Changer la localisation » de V3.8 (`renderOrderPanel`) n'était en réalité **atteignable par aucun bouton visible** de l'interface (le seul déclencheur, `#more-options`, n'était jamais rendu) — exactement le symptôme « fonction cachée » remonté du terrain.
- Nouveau bloc **« Localisation »** prominent dans la fiche commande (`_renderQuickView`) : étape actuelle + ligne « Dernière mise à jour » (source réelle : Scan/Localisation manuelle/Système + acteur + horodatage) + bouton **« Modifier »** gardé par `production.manage` (masqué si commande annulée ou déjà livrée).
- Nouvelle side-window dédiée `renderChangeLocationPanel()` (sidePanel `changeLocation`) : localisation actuelle (lecture seule) / nouvelle localisation (select) / motif optionnel (textarea) / Annuler / Confirmer.
- Confirmer appelle **STRICTEMENT** `moveOrderToStage(source:'MANUAL', note)` — **aucune logique parallèle** : toutes les règles ci-dessous vivent dans le moteur unique, jamais dans la couche UI.
- Nouvelles règles moteur dans `moveOrderToStage()` :
  - **Commande livrée** → refus `ORDER_DELIVERED` (« enregistrez une reprise pour modifier sa localisation ») — la modification directe n'a plus de sens une fois le cycle clos.
  - **Même poste** (déplacement MANUAL) → refus `SAME_STAGE`, aucun LocationEvent créé (« déjà localisée à ce poste »).
  - **Recul vers une étape antérieure** (déplacement MANUAL) sans motif → refus `MOTIF_REQUIRED` ; avec motif (`note`), accepté.
  - **Commande « prête » corrigée** vers une autre étape → **perd le statut « prête »** jusqu'à revenir réellement à la dernière étape (`markOrderReadyIfLastStage` la restaure alors normalement).
  - `reworkId` **auto-dérivé** de `activeReworkForOrder(order)` quand non fourni explicitement — tout déplacement pendant un cycle de reprise ouvert est automatiquement rattaché à ce cycle (alimente directement le préfixage « Reprise N — » de la timeline).
- Consommation matière et idempotence **inchangées** (toujours `consumeForScan`/clé `consumptionKey`, jamais dupliquées, identiques scan/manuel).
- **Colonne « Localisation »** du tableau Commandes desktop et **ligne « Localisation »** de la carte mobile Labo : bouton **« Modifier »** identique (même garde `production.manage`/annulée/livrée, même side-window) — visible immédiatement.
- Toutes les vues (fiche, Commandes, Production) se **re-rendent immédiatement** après confirmation, sans rechargement de page.

## Partie L — Seed V9 rebuild (11 scénarios A-K)

`seedV9Orders()` remplace les 12 scénarios A-L de V3.8 par les **11 scénarios A-K** explicitement redemandés (le scénario « empreinte physique en attente » de V3.8 n'a pas été reconduit tel quel — chaque lettre couvre désormais un cas mot pour mot de la mission V3.8.1) :

| # | Scénario |
|---|---|
| A | Commande reçue uniquement (rien d'autre : ni bon, ni localisation) |
| B | Suivi démarré — Réception (bon imprimé, aucun scan) |
| C | Design CAD via scan |
| D | Usinage via scan |
| E | Céramique déplacée manuellement |
| F | Contrôle qualité (scan) |
| G | Prête à livrer (dernière étape atteinte) |
| H | Livrée |
| I | Reprise avec nouveau cycle clair (livrée → `createRework` → nouveau déplacement rattaché au cycle) |
| J | Annulée AVANT toute consommation |
| K | Annulée APRÈS consommation (Usinage) — jamais de retour stock |

Construits **uniquement** via le moteur réel (`buildOrderFromInput`, `moveOrderToStage`, `createRework`, `createConversation`) — zéro artefact hérité sur un démarrage frais : aucun Scan Réception, aucun Retour matière, aucune commande créée après sa propre production, aucune commande prête avant sa propre création, aucune double Réception.

## Partie M — Tests et non-régression

- **11 nouveaux tests** ajoutés à la suite persistée (`?runTests=1`), couvrant chaque règle métier de la mission (détail dans `DENTALFLOW_V3_8_1_TEST_REPORT.md`).
- **2 tests V3.8 réécrits** (comportement volontairement changé par le mandat, jamais une régression silencieuse) : le test de `orderTimeline()` (nouveaux libellés) et le test de cohérence globale du seed (12→11 scénarios).
- Test **le plus important** : un état réel migré/hérité (Scan Réception + `createdAt` incohérent + Retour historique) chargé à travers le **même chemin de démarrage réel** (`ensureV34Model()` via `migrateFixture`) que l'application — précisément le cas terrain qui avait échappé aux tests V3.8.

## Non-régression

Toutes les fonctionnalités V3.8 sont conservées inchangées. 174 tests V3.8 strictement conservés (2 réécrits, documentés comme tel, jamais affaiblis) + 11 nouveaux = **185/185 PASS**.
