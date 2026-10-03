# DentalFlow V3.10.3 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.10.3.html`
**Base de comparaison :** `dentalflow-next-poc-v3.10.2.html`
**Tous les résultats ci-dessous sont issus d'exécutions réelles**
(Chromium via Playwright, jamais une simulation ou une extrapolation) —
et pour les données, des **quatre fichiers réels du laboratoire**
fournis (convertis en CSV pour l'import, jamais modifiés eux-mêmes).

## Synthèse

| Suite | Résultat |
|---|---|
| Tests hérités persistés (405 + 20 REL + ROUTE01/ROUTE_CAM/ROUTE_RUNTIME) | **427 / 428 PASS** (1 flake préexistant, non lié — voir §2) |
| REAL01–REAL25 (et sous-vérifications, données réelles) | **33 / 33 PASS** (≥ 25 exigées) |
| Assistant d'import — parcours réel (clics réels, fichier réel) | **12 / 12 PASS** |
| Navigation in-document V3.10.2 (mode-host/runtimeAppMode) | **5 / 5 PASS** |
| NAVDOM hérité | **31 / 31 PASS** |
| Responsive (430/390/375px) — LAB/STAFF/CABINET | **9 / 9 PASS** |
| Isolation métier (24 tableaux, avant/après 428 tests) | **0 différence** |
| Moteur achats — fournisseur minimal (données incomplètes réelles) | **PASS** (BLOCKED honnête, 0 valeur inventée) |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| CSS vs V3.10.2 | **byte-à-byte identique** |
| Erreurs console (tous scénarios) | **0** |

## 1. Tests hérités persistés — 427/428

```
node run_v3103_baseline.js
TOTAL 428 PASSED 427 FAILED 1
CONSOLE ERRORS: 0
```

Le seul échec (« V3.7.1 C01-C04 : Plan de charge ») est un **flake
préexistant lié à la date du jour**, sans rapport avec ce lot — reproduit
**à l'identique** en relançant la même suite contre
`dentalflow-next-poc-v3.10.2.html` byte-pour-byte non modifié :

```
node run_v3102_check.js   (copie de la suite pointée sur v3.10.2)
TOTAL 428 PASSED 427 FAILED 1
 - V3.7.1 C01-C04 ... => même échec, même valeurs
```

Un bug de portée de script a été détecté puis corrigé **pendant le
développement** (voir Changelog §6) : avant correction, 118 tests
échouaient (`activeServicePriceOverride is not defined`, seed lui-même
cassé). Après correction : 427/428 (régression nulle), 0 erreur console.

## 2. REAL01–REAL25 — données réelles du laboratoire — 33/33

Script Playwright dédié (`real_data_tests.js`), exécutant le **moteur
réel** (`window.DentalFlowV34.parseCSV/validateImportRows/applyImportRows`,
exactement les fonctions qu'utilise l'assistant) sur des fixtures CSV
construites à partir des quatre fichiers réels fournis.

```
REAL DATA TESTS TOTAL 33 PASSED 33 FAILED 0
```

### Cabinets / Dentistes (`fichier_client.xlsx`)

- **REAL01** : 314 lignes réelles (`Feuil1`) → 312 créées, **2 rejetées
  honnêtement** (`DUPLICATE_IN_FILE` — deux lignes du fichier réel
  normalisent vers le même nom de cabinet, détecté correctement).
- **REAL02** : réimport identique → tout **Ignoré**, 0 nouveau créé.
- **REAL03** : modification manuelle d'un champ (C.H.U.) puis réimport
  → ce cabinet repasse en **Modifié**, jamais dupliqué.
- **REAL04** : 4 dentistes réels (Boulanger Emma, Possemato Laurène,
  Rousselet Bertrand, Sarkysian Janet — retrouvés dans `Pratriciens
  2026`, même adresse « 18 rue du Pr Luc Montagnier » à variantes
  orthographiques près, même téléphone) résolvent tous vers le **même**
  Cabinet (« Cabinet Dentaire IES »).
- **REAL05** : ces 4 dentistes réels partagent la **même** adresse
  email réelle (`nassima@cabinetdentaire-ies.fr`) — acceptée sans
  unicité forcée. (Le fichier réel contient au total 12 groupes de
  praticiens partageant une adresse email, vérifiés par inspection
  directe de la colonne `MAIL` de `Pratriciens 2026`.)
- **REAL06** : un dentiste avec un cabinet volontairement introuvable
  est **rejeté** (`UNKNOWN_CABINET`), jamais un cabinet inventé ; les 7
  autres lignes réelles valides sont créées ; aucun dentiste orphelin
  (`cabinetId` toujours résolu).

### Personnel (`Personnel_2026.xls`)

- **REAL07** : 13 membres réels, 9 pôles réels distincts (CAO/CFAO,
  CERAMIQUE, USINAGE, ADMINISTRATIF, SECRETARIAT, PROTHESES, APPRENTIE,
  APPRENTI, PLATRE). 8 pôles mappés explicitement par l'utilisateur →
  12 utilisateurs créés ; le 9e pôle (PLATRE) volontairement **non**
  mappé → sa ligne est **rejetée** (`UNMAPPED_POLE`), jamais un rôle
  inventé.
- **REAL08** : `assignedStageId` résolu depuis le mapping POLE validé
  (CERAMIQUE → poste Céramique réel, `STG-004`) est correct.

### Articles / Stock / Fournisseurs / Lots / CUMP (`stock_2026.xls`)

- **REAL09** : 515 articles réels importés (référentiel complet), 0
  erreur.
- **REAL10** : `safetyStock` dérivé de « Mini » réel (0 explicite
  préservé, distinct d'une valeur absente).
- **REAL11** : stock physique réel — 2e import du même fichier stock =
  **0 nouveau mouvement** (idempotent par delta).
- **REAL12** : fournisseur minimal réel (« HENRY SCHEIN FRANCE ») créé
  sans **aucune** valeur commerciale inventée (`leadTimeDays`,
  `freeShippingThreshold`, `shippingCost`, `minimumOrder` tous `null`).
- **REAL13** : C.U.M.P réel (81) jamais transformé en tarif fournisseur
  — `Article.averageUnitCost=81`, `ArticleSupplier.unitPrice` reste
  `null`.
- **REAL14** : lot réel (`2600211268`) créé (`StockLot`), aucun
  `StockMovement` supplémentaire associé.
- **REAL15** : réimport du fichier articles réel — toutes les 515
  références déjà connues sont rejetées (`DUPLICATE_REFERENCE`), aucun
  doublon d'article ni de lot, **0 nouveau mouvement de stock**.
- **REAL16** : la colonne « Date » du fichier réel n'est jamais
  interprétée automatiquement en `expiryAt` (tous les lots créés par
  cet import ont `expiryAt=null`).

### Prestations (`Tarif_2026xls.xls`)

- **REAL17** : catalogue réel de 333 prestations standard créé
  (familles/sous-familles réelles conservées : « 1 - PROTHESES
  PROVISOIRES », « 6 - PROTHESE FULL ZIRCONE », etc.).
- **REAL18** : prix standard réel correctement importé (« Impression
  Arcade », catégorie NUMERISATION, 18 €).
- **REAL19** : tarif spécifique réel Cabinet C.H.U. créé
  (`servicePriceOverrides`, 35 € pour la même prestation) —
  `Service.basePrice` (18 €) **jamais modifié**.
- La **2e** ligne CHU du fichier réel (« Couronne Full Zircone dégradée
  transvisée sur T-ba ») référence une prestation dont le libellé exact
  **n'existe pas** dans le catalogue standard du même fichier (donnée
  réellement incohérente à la source) — **honnêtement rejetée**
  (`UNKNOWN_SERVICE`), jamais une prestation fantôme ni un override
  orphelin créé pour la forcer.
- **REAL20** : `priceSnapshot` d'une commande réelle utilise l'override
  actif pour le Cabinet concerné (35 €) ; une commande pour un autre
  Cabinet (sans override) utilise le prix standard (18 €).
- **REAL21** : `priceSnapshot` déjà créé reste **immuable** même après
  modification de l'override — vérifié en changeant l'override après
  coup et en confirmant que la commande existante garde son prix
  d'origine.
- **REAL22** : catalogue réel réimporté — **0 doublon** (0 création à
  la 2e exécution, effectif stable).

### Transverse

- **REAL23** : preview et application utilisent la **même** donnée
  normalisée — `validateImportRows()` rejoué deux fois sur les mêmes
  lignes produit un résultat strictement identique (déterministe).
- **REAL24** : bilan Créé + Modifié + Ignoré + Rejeté = total des
  lignes valides, exact sur l'ensemble des imports réels exécutés
  (cabinets, articles, prestations).
- **REAL25** : **0 relation orpheline** sur l'ensemble des données
  réelles importées (dentistes → cabinets, articleSuppliers →
  articles/fournisseurs, lots → articles, overrides → services/cabinets).
- **CHAÎNE COMPLÈTE** (§52) : Cabinet réel (C.H.U.) → Dentiste réel →
  Prestation réelle → Article/Fournisseur/Stock réels → Commande —
  `priceSnapshot` présent, `cabinetId` résolu, stock non affecté par la
  seule création de la commande. Aucune contradiction métier.

## 3. Assistant d'import — parcours réel (UI, clics réels) — 12/12

Script Playwright dédié (`wizard_ui_test.js`), clics réels (menu
utilisateur → Données → Importer), **vrai chargement de fichier**
(`input[type=file]`, pas le textarea « mode debug »).

```
WIZARD UI TEST TOTAL 12 PASSED 12 FAILED 0
```

- Ouverture réelle de l'assistant, ordre conseillé affiché.
- Les 3 nouveaux types (Cabinets/Dentistes/Prestations) sélectionnables
  par clic réel, ainsi que les types enrichis (Utilisateurs/Articles).
- Chargement réel d'un extrait du fichier Cabinets réel → lignes
  détectées et comptées, colonnes reconnues automatiquement (aucune
  correspondance manuelle requise — les en-têtes réels correspondent
  aux synonymes déjà prévus).
- 0 erreur console sur l'ensemble du parcours.

*Note méthodologique* : le textarea « coller le CSV manuellement (mode
debug) » ne déclenche pas de re-rendu du bouton « Continuer » après
saisie — limitation préexistante de l'assistant (`input` listener ne
réactive pas render), non liée à ce lot, contournée dans le test en
utilisant le chemin réellement emprunté par un utilisateur
(`input[type=file]`, qui appelle bien `renderDataWizard()`).

## 4. Navigation in-document V3.10.2 — 5/5

```
MODE SMOKE TOTAL 5 PASSED 5 FAILED 0
```

Cycle réel LAB↔STAFF↔CABINET (clics réels) — `#mode-host`/
`runtimeAppMode`, zéro navigation du frame principal, 0 erreur console.
Confirme qu'aucune régression n'a été introduite sur le hotfix
V3.10.2.

## 5. NAVDOM hérité — 31/31

```
node navdom_v3103.js
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

## 6. Responsive — 9/9

```
node v3103_responsive.js
RESPONSIVE TOTAL 9 PASSED 9 FAILED 0
```

LAB/STAFF/CABINET × 430/390/375px — aucun débordement horizontal, 0
erreur console.

## 7. Isolation métier — 0 différence

```
node v3103_isolation.js
business data diffs (22 legacy + dentists/servicePriceOverrides): []
```

24 tableaux métier (les 22 historiques + `dentists` +
`servicePriceOverrides`) strictement identiques avant/après l'exécution
complète des 428 tests persistés.

## 8. Moteur d'achats — données réelles incomplètes

```
node verify_purchase_engine.js
{
  "articleId": "ART-3D12A2",
  "proposalFound": true,
  "recommendedAction": "NO_ACTION",
  "blocking": ["missing_price"],
  "totalIsFiniteOrNull": true
}
errors: []
```

Un article réel importé (référence `3D12A2`, fichier stock réel),
associé à un fournisseur minimal réel (toutes conditions commerciales
`null`), poussé artificiellement sous son seuil de sécurité : le moteur
produit une `PurchaseProposal` correctement `blocking:['missing_price']`
— jamais une recommandation commerciale inventée, jamais de `NaN`, 0
erreur console. Confirme §46-47 du mandat.

## 9. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check`
sans erreur de syntaxe.

## 10. CSS

```
CSS identical v3.10.2 vs v3.10.3: True
```

Comparaison intégrale du contenu du bloc `<style>` — byte-à-byte
identique. Aucune ligne CSS ajoutée ou modifiée (§56 : lot
techniquement import/modèle, pas de redesign).

## 11. Console

**0 erreur console** relevée sur l'ensemble des scénarios réellement
exécutés : suite persistée (428 tests), 33 vérifications de données
réelles, 12 vérifications d'assistant d'import réel, 5 vérifications de
navigation in-document, 31 vérifications NAVDOM, 9 vérifications
responsive, vérification moteur d'achats.

## 12. Diff V3.10.2 → V3.10.3

Chaque zone de changement est documentée dans le Changelog. Aucune
ligne ne touche le CSS, la navigation V3.10.2 (`#mode-host`/
`runtimeAppMode`), le moteur caméra, les imports R04 de base
(comportement préservé, uniquement enrichi), ou `schemaVersion`.

## 13. Fixtures réelles utilisées (résumé quantitatif)

| Fichier réel | Lignes exploitées | Résultat |
|---|---|---|
| `fichier_client.xlsx` (Cabinets) | 314 | 312 créés, 2 doublons réels détectés |
| `fichier_client.xlsx` (Dentistes, échantillon curé) | 8 | 7 créés, 1 rejeté (cabinet introuvable, volontaire) |
| `Personnel_2026.xls` | 13 | 12 créés (8 pôles mappés), 1 rejeté (pôle non mappé, volontaire) |
| `stock_2026.xls` (Articles) | 515 | 515 créés, 0 erreur |
| `stock_2026.xls` (Stocks) | 515 | idempotent, vérifié sur 2 imports |
| `Tarif_2026xls.xls` (Prestations) | 335 | 333 standards créés + 1 override réel créé + 1 override rejeté (donnée source incohérente) |

## 14. Points explicitement audités et non modifiés

- `evaluateSupplierCandidate()` (`leadTimeDays??0`) — audité, non
  modifié, documenté (Changelog §7) : sans effet visible car
  `priceOk` bloque déjà la viabilité indépendamment.
- Import CSV de base (articles/stocks/fournisseurs/tarifs/commandes) —
  comportement préservé à l'identique, uniquement enrichi de colonnes
  optionnelles.
- `isForbiddenColumn()` — devenu type-scopé (uniquement `commandes`,
  seul type concernant des données patient) pour permettre
  `phone`/`address` sur Cabinets/Dentistes (données professionnelles
  B2B légitimes, jamais des données patient) — même protection exacte
  conservée pour `commandes`.
