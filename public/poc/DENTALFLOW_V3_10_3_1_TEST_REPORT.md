# DentalFlow V3.10.3.1 — Rapport de test — CORRECTIF (audit indépendant)

**Base :** `dentalflow-next-poc-v3.10.3.html` (intacte)
**Fichier testé :** `dentalflow-next-poc-v3.10.3.1.html`
**Environnement :** Playwright/Chromium (`/opt/pw-browsers/chromium`), Node 22.

Ce rapport sépare explicitement quatre catégories, comme demandé par le
mandat (§11) : **tests hérités**, **tests correctifs (FIX01-FIX30)**,
**tests données réelles**, **tests UI Playwright**.

## 1. Synthèse

| Catégorie | Résultat |
|---|---|
| Tests hérités (428, dont le flake Charge préexistant) | **427/428** (inchangé vs baseline V3.10.3) |
| Tests correctifs FIX01-FIX30 (nouveaux, dédiés) | **30/30** |
| **Total suite embarquée (`runAllTests()`)** | **457/458** |
| Tests données réelles (réconciliation tarifs, comptage source) | voir §9 |
| Tests UI Playwright (clic réel) — assistant existant | 12/12 |
| Tests UI Playwright (clic réel) — nouveautés V3.10.3.1 (Inventaire, Rôle de droits) | 11/11 |
| NAVDOM (navigation figée) | 31/31 |
| `node --check` (4 blocs `<script>`, ×5 exécutions) | OK (20/20) |
| Erreurs console (tous parcours) | 0 |
| Isolation (diff hunks hors zones autorisées) | 0/24 |

## 2. Tests hérités (428) — non-régression

Exécution via `?runTests=1` (`window.DentalFlowTest.runAll` /
`runAllTests()`), 3 exécutions consécutives, résultat stable :

```
TOTAL 428 PASSED 427 FAILED 1
FAIL: V3.7.1 C01-C04 : Plan de charge — 5 commandes réelles ... (flake préexistant)
```

**Comparaison directe avec la base V3.10.3 non modifiée**, même
suite, même méthode, exécutée dans cette session :

```
(v3.10.3.html)   TOTAL 428 PASSED 427 FAILED 1  — FAIL: V3.7.1 C01-C04 Plan de charge
(v3.10.3.1.html) TOTAL 428 PASSED 427 FAILED 1  — FAIL: V3.7.1 C01-C04 Plan de charge (identique)
```

Le flake « Plan de charge » est **strictement le même**, avant et après
ce lot — confirmé par exécution comparative directe, pas une simple
affirmation. Conformément au mandat (§10), il **reste documenté, non
masqué et non "corrigé"** : hors périmètre de cette mission corrective,
explicitement interdit d'y toucher.

**Une seule modification** à un test hérité — `"Import utilisateurs
crée un utilisateur"` — documentée en détail au Changelog §8 : sa
fixture CSV ne fournissait ni `roleid` ni `pole`, exerçant exactement le
défaut corrigé en §4 (utilisateur créé sans droits explicites). Fixture
complétée d'une colonne `roleid`, critères de réussite du test
inchangés.

## 3. Tests correctifs FIX01-FIX30 (nouveaux, dédiés)

Tous nouveaux, jamais une modification d'un test existant pour forcer
un passage. Exécutés dans la même suite embarquée (`runAllTests()`),
3 exécutions consécutives, stable :

```
TOTAL 458 PASSED 457 FAILED 1   (le seul FAIL = le flake Charge préexistant, §2)
```

Détail FIX01-FIX30 — **30/30 PASS** :

| Test | Objet | Résultat |
|---|---|---|
| FIX01 | Import prestation sans `pricingmode` ⇒ `pricingMode=null`, `pricingReviewRequired=true`, `active=false` (création) | PASS |
| FIX02 | Prestation non qualifiée absente du sélecteur labo `serviceSelectHTML()` | PASS |
| FIX03 | Sélecteur cabinet `dentistNewHTML()` utilise la même garde `serviceIsOrderable` | PASS |
| FIX04 | Page Prestations affiche « À qualifier », jamais « Forfait » | PASS |
| FIX05 | Qualification manuelle explicite FIXED efface `pricingReviewRequired` | PASS |
| FIX06 | Qualification manuelle explicite PER_TOOTH efface `pricingReviewRequired` | PASS |
| FIX07 | `buildOrderFromInput()` direct (hors UI) ne calcule jamais un pricingMode inventé | PASS |
| FIX08 | Import fournisseurs — nouveau : champs vides ⇒ `null` (jamais 3/0/0) | PASS |
| FIX09 | Import fournisseurs — `"0"` explicite reste `0` | PASS |
| FIX10 | Import fournisseurs — existant : cellule vide préserve la valeur connue | PASS |
| FIX11 | Import fournisseurs — résolution existant par nom normalisé (anti-duplication) | PASS |
| FIX12 | Import utilisateurs — `roleid` direct validé contre `ROLE_DEFS`, permissions par défaut posées | PASS |
| FIX13 | Import utilisateurs — aucun roleid/pole ⇒ `UNMAPPED_ROLE_ID`, ligne rejetée | PASS |
| FIX14 | Import utilisateurs — roleId résolu via mapping POLE explicite | PASS |
| FIX15 | Import utilisateurs — roleid hors `ROLE_DEFS` ⇒ rejeté | PASS |
| FIX16 | Import utilisateurs — création : scope/capacité des colonnes, assignedStageId explicite ou null | PASS |
| FIX17 | Import utilisateurs — réimport : permissions explicites existantes jamais réécrites | PASS |
| FIX18 | Import utilisateurs — réimport : permissions par défaut posées si aucune n'était explicite | PASS |
| FIX19 | PurchaseProposal sous seuil + prix null (aucune rupture calculable) ⇒ BLOCKED, jamais NO_ACTION | PASS |
| FIX20 | Aucune contradiction blocking/recommendedAction sur les propositions ouvertes | PASS |
| FIX21 | Aucun besoin réel ⇒ aucune fausse proposition | PASS |
| FIX22 | Proposition sans fournisseur ⇒ toujours BLOCKED/missing_supplier (non régressé) | PASS |
| FIX23 | Import "inventaire" — référence inconnue ⇒ création (vrai upsert) | PASS |
| FIX24 | Import "inventaire" — réimport : seuls les champs fournis mis à jour, cellule vide n'efface jamais | PASS |
| FIX25 | Import "inventaire" — réimport même quantité ⇒ 0 StockMovement supplémentaire (idempotent) | PASS |
| FIX26 | Import "inventaire" — lot informatif uniquement (Article.sourceLot*), jamais un StockLot opérationnel | PASS |
| FIX27 | Import "articles" (V3.10.3, inchangé) continue de créer un StockLot opérationnel réel (compatibilité) | PASS |
| FIX28 | servicePriceOverride ne modifie jamais Service.basePrice | PASS |
| FIX29 | priceSnapshot reste immuable après modification a posteriori d'un override | PASS |
| FIX30 | Prestation non qualifiée interdit l'usage de son override Cabinet | PASS |

## 4. Tests UI Playwright (clic réel)

### 4.1 Assistant d'import existant (régression, 12/12)

```
WIZARD UI TEST TOTAL 12 PASSED 12 FAILED 0
```

Identique au comportement V3.10.3 (sélection de type, chargement de
fichier réel via `input[type=file]`, reconnaissance automatique des
colonnes) — non régressé.

### 4.2 Nouveautés V3.10.3.1 (11/11)

Script dédié, deux navigations indépendantes :

```
UI CLICK TOTAL 11 PASSED 11 FAILED 0
```

- Bouton **« Inventaire laboratoire »** présent et sélectionnable dans
  le sélecteur de type (clic réel).
- Fichier CSV réel chargé via `input[type=file]`, colonnes reconnues
  automatiquement, import exécuté par clics réels jusqu'au bout
  (`Vérification → Résultat`) : **1 créée**, article
  `safetyStock=5`/`CUMP=12.5` correctement posés en base.
- Sélecteur **« Rôle de droits »** (`data-pole-field="roleid"`) présent
  dans la table de correspondance POLE, ses options correspondent
  **exactement** à `ROLE_DEFS` (`ADMINISTRATIF, LECTURE, PRODUCTION,
  RESPONSABLE, STOCK`), sélection réelle persistée dans
  `state.importPoleMapping`.
- 0 erreur console sur les deux parcours.

## 5. NAVDOM — navigation figée (31/31, non régressé)

```
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

Desktop (1440/1024) + mobile (430/390/375) + thèmes (light/dark/system)
— IDs uniques, badges non nuls, routage, sidebar réduite, drawer mobile,
0 erreur console. Exécuté sur `dentalflow-next-poc-v3.10.3.1.html`
directement (même script que la campagne V3.10.3, chemin de fichier
substitué).

## 6. `node --check` et console

`node --check` exécuté sur les 4 blocs `<script>` du fichier livré,
**5 exécutions consécutives**, toutes `OK`, aucune erreur de syntaxe.
0 erreur console (`pageerror`/`console.error`) sur l'ensemble des
parcours ci-dessus (démarrage simple, suite de tests, assistant
d'import, NAVDOM).

## 7. Isolation / diff audit (§12 du mandat)

`diff -u dentalflow-next-poc-v3.10.3.html dentalflow-next-poc-v3.10.3.1.html`
→ **24 hunks**, chacun relu individuellement. Répartition :

| Zone | Hunks |
|---|---|
| Qualification des prestations (§2 : `serviceIsOrderable`, sélecteurs, page Prestations, formulaire manuel) | 6 |
| Override Cabinet (§8 : garde de qualification dans `buildOrderFromInput`) | 1 |
| Moteur achats (§5 : `decideProposal`) | 1 |
| Schémas/wizard d'import (types, `IMPORT_FIELD_SCHEMAS`, exemples, mapping POLE) | 5 |
| Import fournisseurs (§3) | 1 |
| Import utilisateurs (§4, validation + application) | 2 |
| Import inventaire (§6-7, nouveau type) | 2 |
| Import articles (dédup key, ajout `inventaire`) | 1 |
| Un test hérité (fixture uniquement, §8 du Changelog) | 1 |
| Nouveaux tests FIX01-FIX30 (ajout en fin de suite) | 1 |
| Divers commentaires adjacents sans changement de code | 3 |

**Zéro** hunk touchant : navigation (`renderNav`/`updateNav`/sidebar),
caméra (`stopStaffCameraScan`/`checkCameraCapability`), patient/
anonymisation, production (stages/scan), `StockMovement`/`StockLot`
opérationnel réel (hors le chemin `inventaire`, nouveau et isolé,
vérifié FIX26/FIX27), `PurchaseOrder`, CSS, ou toute fonction nouvelle
non demandée par le mandat. Détail hunk-par-hunk disponible sur
demande (script de diff conservé).

## 8. Non-régressions explicitement vérifiées

- `servicePriceOverrides` : **conservé**, non supprimé, portée non
  étendue — FIX28/FIX29/FIX30.
- `priceSnapshot` : immuable — FIX29 (nouveau test dédié, en plus de la
  garantie déjà vérifiée en V3.10.3).
- Import `articles` (préexistant) : sémantique `DUPLICATE_REFERENCE`
  **inchangée** — FIX27 confirme que le chemin legacy `upsertStockLotFromImport`
  continue de créer un `StockLot` opérationnel réel comme avant.
- Responsive (430/390/375), thèmes (light/dark/system) : NAVDOM §5.
- 0 régression sur les 427 tests hérités passants (comparaison directe
  base V3.10.3 vs livrable, §2).

## 9. Audit d'honnêteté du rapport V3.10.3 (mandat §9)

### 9.A — Dentistes : portée de l'échantillon

Le fichier réel `Pratriciens 2026` (onglet de `fichier_client.xlsx`)
contient **103 lignes** (1 en-tête + **102 praticiens réels**), vérifié
par lecture directe du classeur (`openpyxl`, `max_row=103`). Les tests
REAL04-REAL06 de la campagne V3.10.3 portaient sur un **échantillon
curé de 8 lignes** (4 dentistes partageant un cabinet + adresse email,
1 ligne à cabinet volontairement introuvable, 7 autres lignes valides).
Le rapport V3.10.3 ne prétendait déjà pas à un « import complet »
(tableau récapitulatif : « échantillon curé »), mais la formulation est
rendue ici **explicite sans ambiguïté possible** :

> **Échantillon réel de 8 praticiens sur 102** (`Pratriciens 2026`,
> `fichier_client.xlsx`) — jamais un import complet des 102 dentistes
> réels, qui n'a pas été exécuté dans cette campagne.

### 9.B — Cabinets : Feuil1 est un export de facturation/comptabilité, pas une liste de cabinets actifs

Lecture directe de l'en-tête de `Feuil1` (`fichier_client.xlsx`) :
130 colonnes dont `solde debut`, `solde actuel`, `code comptable`,
`mode paiement`, `date paiement`, `echeance`, `BLChiffre`,
`NbreFacture`, `Pénalités`, `EnvoiFactMail`, et une colonne
**`Desactive`** (booléenne). C'est un **export de facturation/
comptabilité client**, pas une liste de cabinets actuellement actifs.

Comptage réel de la colonne `Desactive` sur les 313 lignes de données :

| Desactive | Nombre de lignes |
|---|---|
| `False` (actif) | 128 |
| `True` (désactivé) | 185 |

Le schéma d'import `cabinets` de DentalFlow **ne comporte pas** ce
champ — chaque cabinet importé ou mis à jour reçoit `status:'ACTIVE'`
par défaut (`createCabinet`/upsert), **sans aucun jugement d'activité**.
Conséquence honnête : parmi les 312 cabinets créés par REAL01 (V3.10.3),
une proportion significative (potentiellement jusqu'à ~185 selon cette
même colonne source) correspond à des clients marqués désactivés dans
le système source — **DentalFlow ne les a jamais traités comme tels**,
ni comme actifs, faute d'un champ dédié dans le schéma d'import actuel.
Comme demandé par le mandat, **ce n'est pas comblé par ce lot** : la
distinction actif/historique reste une décision du normalisateur CSV
externe, à faire correspondre à une colonne `status`/`legacycode` déjà
existante dans le schéma si le laboratoire le souhaite, jamais une
heuristique codée en dur côté DentalFlow.

### 9.C — Tarifs : réconciliation complète 335 → 354 (0 ligne disparue)

Lecture directe du fichier source `Tarif_2026xls.xls` (texte tabulé),
**518 lignes brutes au total**. Classification exhaustive :

| Catégorie | Nombre | Cumul |
|---|---|---|
| Lignes vides | 45 | 45 |
| Sauts de page / « page N » | 46 | 91 |
| En-têtes de section (« SARL ARTECH… ») | 23 | 114 |
| Libellés de catégorie/sous-catégorie (lignes à une seule cellule) | 50 | 164 |
| **Lignes exploitables (libellé + prix)** | **354** | **518** |

**354 = total exact rapporté par l'audit indépendant.** Décomposition
des 354 lignes exploitables :

| Type | Nombre |
|---|---|
| Tarif standard (catalogue) | 352 |
| Tarif spécifique Cabinet (« C.H.U. ») | 2 |
| **Total** | **354** |

**Cause de l'écart 335 vs 354 du rapport V3.10.3** : le script Python
de préparation de fixtures utilisé pendant la campagne V3.10.3
(`build_tarif_csv.py`, outil de préparation de test, **jamais livré ni
exécuté par DentalFlow lui-même**) utilisait une expression régulière
de reconnaissance de prix qui n'acceptait pas l'espace utilisé comme
séparateur de milliers dans le fichier source (ex. `"1 560.00 €"`,
`"3 212.80 €"`) — ces 19 lignes, pourtant réelles et exploitables
(essentiellement des Bridges/Full Arche Zircone à prix élevé, 1000€ à
5000€), étaient donc **silencieusement absentes** du CSV de test généré,
sans jamais apparaître comme rejetées nulle part. C'est une **anomalie
de l'outil de préparation de fixtures de cette session, pas un défaut
du moteur d'import DentalFlow** : `parseImportNumber()` (le parseur
numérique réellement utilisé par DentalFlow à l'import) gère déjà
correctement les espaces (`replace(/\s/g,'')`) — ces 19 lignes
auraient été importées sans problème si elles avaient simplement figuré
dans le CSV soumis à l'assistant.

**Correction et re-vérification** : le script de fixture a été corrigé
(tolérance de l'espace comme séparateur de milliers) et relance sur le
fichier source réel — **354/354 lignes exploitables extraites, 0
rejetée à cette étape**. Réimport réel via le moteur DentalFlow
(`validateImportRows`/`applyImportRows`, type `prestations`), Cabinet
« C.H.U. » importé au préalable (ordre conseillé réel) :

```
totalRows: 354
validCount: 353
rejectedCount: 1  (UNKNOWN_SERVICE — 1 des 2 lignes "C.H.U." référence un
                    libellé de prestation standard introuvable tel quel
                    dans le catalogue — incohérence réelle du fichier
                    source, pas un défaut du moteur)
created: 353  (352 standards + 1 override C.H.U. résolu)
overridesTotal: 1
```

Ce résultat est **cohérent avec ce que le rapport V3.10.3 avait déjà
correctement diagnostiqué** pour le rejet d'override (« donnée source
incohérente ») — seul le total de lignes exploitables (335 au lieu de
354) était erroné, et il est ici intégralement réconcilié : **518 =
45 + 46 + 23 + 50 + 354, et 354 = 352 + 2, sans aucune ligne disparue
sans explication.**

## 10. Definition of Done (mandat §13) — statut

1. `dentalflow-next-poc-v3.10.3.1.html` créé à partir de la base
   V3.10.3 intacte — **fait**.
2. `schemaVersion` inchangé (10) — **fait**.
3. FIX01-FIX30 = 30/30 nouveaux tests dédiés — **fait**.
4. 428 tests hérités non régressés (427/428, flake Charge identique
   avant/après, comparaison directe) — **fait**.
5. NAVDOM/responsive/thèmes non régressés (31/31, 430/390/375,
   light/dark/system) — **fait**.
6. `node --check` ×5, 0 erreur console — **fait**.
7. Diff audit confiné aux zones autorisées (§12), 0 hunk hors
   périmètre — **fait**.
8. Rapport honnête (§9), écarts reconciliés avec preuves primaires
   (lecture directe des fichiers source) — **fait**.
9. `DENTALFLOW_V3_10_3_1_CHANGELOG.md` et
   `DENTALFLOW_V3_10_3_1_TEST_REPORT.md` livrés séparément — **fait**.

## 11. Limite assumée

Le mécanisme optionnel de réparation au boot des `StockLot` legacy
metadata-only (§7 du mandat, explicitement marqué *recommandé mais
optionnel*) **n'a pas été implémenté** dans ce lot — voir justification
au Changelog §6. Aucun `StockLot` existant n'est donc migré
automatiquement ; seul le nouveau chemin d'import `inventaire` évite
d'en créer de nouveaux à l'avenir.
