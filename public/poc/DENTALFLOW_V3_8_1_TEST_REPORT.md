# DentalFlow Next V3.8.1 — Rapport de tests

Base : `dentalflow-next-poc-v3.8.html` (174/174 PASS). Livrable : `dentalflow-next-poc-v3.8.1.html`.

## Suite unitaire intégrée (`?runTests=1`)

**185/185 PASS**, 0 erreur console, stable sur plusieurs exécutions consécutives (persistée, isolation, régression complète).

- **174 tests V3.8 conservés**, dont **2 explicitement réécrits et documentés comme tel** (comportement volontairement changé par le mandat V3.8.1, jamais une régression silencieuse) :
  - `orderTimeline()` : l'ancien test attendait les libellés V3.8 (« Commande créée », « Scan Usinage », « Réception » isolée…) ; réécrit pour vérifier les nouveaux libellés métier (« Commande saisie au laboratoire », « Suivi démarré — Réception », « Entrée en Usinage » + détail « Scan · Marc »…).
  - Cohérence globale du seed V9 : l'ancien test attendait 12 commandes A-L (dont un scénario « empreinte physique en attente ») ; réécrit pour vérifier les 11 nouveaux scénarios A-K, avec vérifications supplémentaires (aucun LocationEvent Scan-Réception, aucun StockMovement RETURN).
- **11 nouveaux tests V3.8.1**, un par exigence testable au niveau moteur de la Partie M.

### Détail des nouveaux tests (valeurs réelles observées)

| TEST | EXPECTED | ACTUAL (extrait) | PASS/FAIL |
|---|---|---|---|
| Partie A/B : premier événement — « Commande reçue » (CABINET) vs « Commande saisie au laboratoire » (LAB_MANUAL) | PASS | `cabinetLabel:"Commande reçue",labLabel:"Commande saisie au laboratoire"` | PASS |
| Partie B : une seule ligne « Suivi démarré — Réception » même après réimpression | startLineCount===1 | `printCount:2,startLineCount:1` | PASS |
| Partie M : `orderTimeline()` trie strictement par date même si les LocationEvents sont insérés dans le désordre | chronological | `eventCount:4,chronological:true` | PASS |
| Partie I/K : `moveOrderToStage(MANUAL)` crée un LocationEvent correct (poste/source/acteur) | PASS | `success:true,eventCreated:true,stageId:"STG-002",source:"MANUAL",actorName:"Eric Leduc"` | PASS |
| Partie I/K : même poste = no-op (SAME_STAGE, aucun LocationEvent créé) | refused, noNewEvent | `refused:true,reason:"SAME_STAGE",noNewEvent:true` | PASS |
| Partie I/K : recul sans motif refusé (MOTIF_REQUIRED), accepté avec motif | refusedReason MOTIF_REQUIRED, acceptedSuccess | `refusedSuccess:false,refusedReason:"MOTIF_REQUIRED",acceptedSuccess:true` | PASS |
| Partie I/K : annulée (ORDER_CANCELLED) / livrée (ORDER_DELIVERED) / droits insuffisants (FORBIDDEN) tous refusés | 3 refus corrects | `cancelledRefused:true,deliveredRefused:true,forbiddenRefused:true` | PASS |
| Partie K : une commande « prête » corrigée perd ce statut jusqu'à revenir à la dernière étape | true/false/true | `readyBefore:true,readyAfterMove:false,readyAfterReturn:true` | PASS |
| Partie F : cycle de reprise distinguable (« Reprise 1 — Entrée en Céramique ») via `LocationEvent.reworkId` | reworkIdTagged, ligne correcte | `reworkIdTagged:true,reworkLineFound:true,reworkLineLabel:"Reprise 1 — Entrée en Céramique"` | PASS |
| Partie G : ancien StockMovement RETURN reste dans `stockMovements` mais disparaît de la timeline | hidden + still present | `hiddenFromTimeline:true,stillInStockMovements:true` | PASS |
| **CRITIQUE** : réparation d'un état réel migré/hérité (Scan Réception + createdAt incohérent + Retour historique), chargé via `ensureV34Model()` (`migrateFixture`, même chemin que le démarrage réel) | tous vrais | `noLegacyScanReception:true,hasSystemReception:true,createdAtRepaired:true,rawScanEventPreserved:true,timelineNoScanReception:true,timelineChronological:true,timelineHasMergedStart:true,returnStillInStockMovements:true,returnHiddenFromTimeline:true,idempotent:true` | PASS |

Le test **CRITIQUE** est explicitement celui flagué par le mandat comme « précisément le cas terrain qui a échappé aux tests V3.8 » : une fixture construite en `schemaVersion:9` (donc `persistedV7` vrai, exactement l'état qu'aurait laissé V3.8 en production) porte un LocationEvent `source:'SCAN'` sur Réception, un `createdAt` postérieur à sa propre impression du bon, et un `StockMovement` RETURN historique lié à une autre commande annulée. Chargée via `migrateFixture()` (qui appelle `ensureV34Model()`, le **même** chemin que le démarrage réel de l'application, pas un raccourci de test), elle est vérifiée réparée sur les 10 critères ci-dessus — y compris l'**idempotence** (une deuxième réparation du même état ne crée pas de doublon SYSTEM Réception).

## Isolation (export JSON avant/après, même session)

`window.DentalFlowV34.exportDentalFlowJSON()` capturé avant `DentalFlowTest.runAll()` puis après, **dans la même session** (méthodologie V3.8 reconduite) :

```json
{"identical": true, "testResult": {"pass": true, "total": 185, "passed": 185, "failed": 0}}
```

## Scénarios navigateur réels bout-en-bout (clics/flux réels, contexte frais)

- **Seed frais (11 scénarios A-K)** : démarrage réel → exactement 11 commandes, aucun LocationEvent Scan-Réception, aucun StockMovement RETURN, chronologie strictement croissante sur chacune, 0 erreur console.
- **Fonction de localisation manuelle — flux complet** : clic sur une ligne du tableau Commandes → ouverture de la fiche → bloc « Localisation » visible avec bouton « Modifier » → clic → side-window dédiée (`loc-panel-select`/`loc-panel-note`/`loc-panel-confirm`/`loc-panel-cancel` tous présents) → sélection d'un poste suivant, confirmation → localisation mise à jour (`STG-004`→`STG-005` vérifié), fiche rouverte automatiquement, **tableau Commandes re-rendu immédiatement** avec la nouvelle localisation et le nouveau bouton « Modifier », **carte mobile Labo** (390×844) affiche aussi « Localisation : … [Modifier] ». 0 erreur console.
- **Permission — bouton absent ET moteur refuse** : utilisateur sans `production.manage` (rôle Stock ou Administratif) → 0 bouton « Modifier » dans tout le tableau Commandes, 0 bouton dans la fiche ; garde-fou moteur vérifié séparément (`FORBIDDEN`).
- **Même poste = no-op réel** : sélection du poste déjà actif dans la side-window → toast « Commande déjà localisée à ce poste. », aucun changement de localisation.
- **Recul sans motif refusé, avec motif accepté (flux UI réel)** : sélection d'un poste antérieur sans motif → toast « Un motif est requis pour un déplacement vers une étape antérieure. », panneau reste ouvert ; ressaisie du poste + motif → confirmation acceptée, localisation effectivement reculée.
- **Commande annulée / livrée** : bouton « Modifier » absent de la fiche dans les deux cas (livrée : le bouton « Enregistrer une reprise » reste la seule voie, cohérent avec `ORDER_DELIVERED`).

## Responsive & console (24 combos : 6 viewports × 4 modes)

`full_regression_6vp.js`, viewports 1440×900/1024×800/768×1024/430×900/390×844/375×812, modes lab/staff/dentist/scan : **24/24 PASS**, 0 erreur console, 0 débordement horizontal.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

`v352_theme_quick.js` : **12/12 PASS**, thème appliqué (light/dark/system) sur Accueil/Commandes/Stock/Rapports, aucun débordement horizontal, 0 erreur console.

## `node --check`

Le fichier compte **4 blocs `<script>`** — les 4 passent `node --check` sans erreur, vérifié après chaque modification substantielle tout au long de la mission.

## Synthèse Definition of Done

| Exigence | Statut |
|---|---|
| `orderTimeline()` raconte une histoire métier claire (QUOI/QUAND/OÙ/QUI) | ✅ |
| Premier événement dépendant de la source (« Commande reçue »/« Commande saisie au laboratoire ») | ✅ |
| Bon imprimé + Réception fusionnés en une ligne | ✅ |
| « Entrée en X » + détail Scan/Manuel · Nom | ✅ |
| Aucun doublon « Prête à livrer » | ✅ |
| Cycles de reprise identifiables (« Reprise N — ... » via `reworkId`) | ✅ |
| Anciens Retour matière masqués de la timeline, jamais supprimés de `stockMovements` | ✅ |
| `repairLegacyTraceabilityV9` : neutralise Scan-Réception hérité, backfille SYSTEM Réception manquant, jamais touche `scanEvents`, idempotente | ✅ |
| `repairLegacyLifecycleDates` : clampe `createdAt` sans jamais inventer de date | ✅ |
| Réparations appelées à CHAQUE démarrage (pas seulement migration de schéma) | ✅ |
| Bloc « Localisation » prominent dans la fiche + Modifier gardé | ✅ |
| Side-window dédiée, Confirmer appelle strictement `moveOrderToStage` | ✅ |
| Règles moteur : same-stage no-op / recul motif requis / annulée bloque / livrée bloque (reprise) / prête perd son statut | ✅ |
| Colonne/carte Commandes avec Modifier identique | ✅ |
| Re-rendu immédiat partout, aucun rechargement | ✅ |
| Seed V9 : 11 scénarios A-K, zéro artefact hérité sur démarrage frais | ✅ |
| Toutes les fonctions V3.8 non liées préservées | ✅ |
| Tests existants PASS | ✅ (174/174, 2 réécritures documentées) |
| Nouveaux tests PASS | ✅ (11/11 dont le test critique legacy) |
| Responsive PASS | ✅ (24/24) |
| Thèmes PASS | ✅ (12/12) |
| `node --check` PASS | ✅ (4 blocs) |
| Zéro erreur console | ✅ |
| Isolation des tests (export JSON identique) | ✅ |
| V3.8 jamais modifié | ✅ |
