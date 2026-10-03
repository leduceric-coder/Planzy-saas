# DentalFlow V3.10.3 — Changelog — REAL LAB DATA IMPORT

**Base :** `dentalflow-next-poc-v3.10.2.html` (conservée intacte, jamais
modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.html`
**Fichiers réels du laboratoire utilisés pour ce lot** (jamais modifiés,
lus uniquement) : `fichier_client.xlsx`, `Personnel_2026.xls`,
`stock_2026.xls`, `Tarif_2026xls.xls`, `DENTALFLOW_MAPPING_IMPORTS_LABO.xlsx`.
`schemaVersion` : **10, inchangé** — toutes les additions sont
purement additives (nouveaux champs optionnels, nouveaux tableaux vides
par défaut), aucune migration de schéma n'a été nécessaire.

## 1. Objectif et principe directeur

Étendre le moteur d'import générique DentalFlow (R04, V3.10.0) pour
qu'il comprenne correctement les données RÉELLES du laboratoire —
Cabinets, Dentistes, Personnel, Articles/Stock enrichis, Prestations —
**sans jamais coder spécifiquement pour ces quatre fichiers** et
**sans jamais inventer une information que le fichier ne donne pas**.
Chaque champ absent ou ambigu reste `null`/vide et se traduit dans
l'interface par « — » ou une ligne rejetée avec une raison explicite —
jamais une valeur par défaut cachée (délai fournisseur, franco, rôle,
statut de compte, date de péremption).

## 2. Format d'entrée — décision assumée

Comme l'import R04 existant, le moteur continue d'accepter du **CSV**
(texte), jamais un parseur binaire XLS/XLSX embarqué dans le navigateur
— aucune nouvelle dépendance de parsing binaire n'a été ajoutée,
cohérent avec l'architecture minimaliste de ce POC monolithique (§48-58
du mandat : « pas de nouvelle dépendance », « pas de grand nouvel
écran »). Les quatre fichiers réels du laboratoire (deux `.xlsx`, deux
`.xls` — en réalité des exports texte tabulé/CSV mal étiquetés `.xls`,
vérifié à l'ouverture) ont été **convertis en CSV** pour construire les
scénarios de test d'acceptation (voir §11) — cette conversion n'est PAS
un composant applicatif livré, uniquement une préparation de fixtures de
test ; le laboratoire peut produire des CSV équivalents directement
depuis Excel (Fichier → Enregistrer sous → CSV `;`).

## 3. Nouveaux types d'import — PARTIE A/D/E

Ajoutés à `IMPORT_FIELD_SCHEMAS`, au sélecteur de l'assistant, et aux
modèles téléchargeables : **`cabinets`**, **`dentistes`**,
**`prestations`**. Le sélecteur de type affiche désormais l'ordre
conseillé (§35-36 du mandat) en une seule ligne de texte, sans nouvel
écran :

```
Ordre conseillé : Cabinets → Dentistes → Utilisateurs → Prestations →
Fournisseurs → Articles → Stocks → Tarifs fournisseurs → Commandes.
```

Rien n'est bloqué si un type n'est pas nécessaire (recommandation, pas
un verrou).

### Cabinets (§5-7)

Champs : `name` (requis), `legalname`, `address`, `postalcode`, `city`,
`country`, `phone`, `email`, `billingemail`, `siret`, `legacycode`
(tous optionnels). Résolution par **nom normalisé** contre les
Cabinets déjà persistés (jamais une similarité floue — §6) : cabinet
existant + données différentes → **Modifié** ; identique → **Ignoré** ;
absent → **Créé**. Une cellule vide ne remplace jamais une valeur déjà
connue (`r.champ||(existing?existing.champ:'')`).

### Dentistes (§8-11)

Champs : `firstname`/`lastname`/`cabinet` (requis), `legacyclientcode`,
`email`, `phone` (optionnels). Le `cabinet` doit résoudre vers **UN
SEUL** Cabinet déjà importé — 0 candidat → `UNKNOWN_CABINET` ; 2+
candidats → `AMBIGUOUS_CABINET` (nomme chaque candidat) ; **jamais** de
création implicite de Cabinet depuis ce point (contrairement à
`ensureCabinetForName()`, réservé à la création manuelle volontaire
d'une commande). `Dentist.email` n'est **jamais** vérifié unique — un
email partagé (adresse générique de cabinet) est accepté sans
avertissement bloquant. `accountStatus='NO_ACCOUNT'`/
`inviteStatus='NOT_SENT'` **uniquement à la création** — jamais réécrit
sur un dentiste déjà existant lors d'une mise à jour.

### Prestations (§28-34)

Champs : `label`/`baseprice` (requis), `category`, `subcategory`,
`pricingmode`, `externalref`, `cabinet` (optionnels). **Strictement
distinct** du type `tarifs` existant (achat fournisseur) — celui-ci
alimente `Service` (vente laboratoire), jamais `ArticleSupplier`. Une
ligne **sans** `cabinet` alimente le catalogue standard (`Service`,
upsert par `category+label`). Une ligne **avec** `cabinet` crée/actualise
un **`servicePriceOverride`** (nouveau store minimal, §31) pour ce
couple Service+Cabinet — `Service.basePrice` n'est **jamais** réécrit
par une ligne à cabinet renseigné. `pricingMode` n'est **jamais** deviné
depuis le seul libellé : colonne absente/vide → `null`, jamais `FIXED`
par défaut (§30).

## 4. Enrichissement des imports existants — PARTIE C

### Articles (référentiel, inchangé dans son rôle : jamais lié à une
quantité physique — §16)

5 colonnes optionnelles ajoutées : `supplier`, `cump`, `manufacturer`,
`lotnumber`, `lotdate`. Une ligne PEUT désormais, en plus de créer
l'Article :
- **résoudre ou créer un Supplier minimal** (`resolveOrCreateMinimalSupplier()`)
  si `supplier` est renseigné — recherche par nom normalisé contre
  **tous** les fournisseurs déjà connus (démo, création manuelle, import
  fournisseurs antérieur), jamais seulement par id déterministe (qui
  n'aurait pas retrouvé un fournisseur de démo comme `SUP-HENRY` pour
  « Henry Schein », provoquant un doublon) ; le fournisseur créé n'a
  **aucune** valeur commerciale inventée — `leadTimeDays`,
  `freeShippingThreshold`, `shippingCost`, `minimumOrder` restent tous
  `null` (§20) ;
- **créer la relation `ArticleSupplier`** — `unitPrice` reste `null`
  (aucun tarif fournisseur n'est connu depuis ce fichier), `preferred`
  vaut `true` (structurellement le seul fournisseur connu pour cette
  référence tout juste créée — §21) ;
- **renseigner `Article.averageUnitCost`** depuis `C.U.M.P` — un
  **nouveau champ métier séparé**, jamais `ArticleSupplier.unitPrice`
  (§22 : « C.U.M.P n'est PAS un tarif fournisseur ») ;
- **créer/mettre à jour un `StockLot`** depuis `lotnumber`
  (`upsertStockLotFromImport()`) — recherche par `(articleId,lotNumber)`,
  **jamais** de `StockMovement` associé (contrairement à
  `receiveStockManual()`, qui en crée toujours un — inadapté ici) ;
- **conserver `lotdate` en métadonnée brute (`StockLot.sourceDate`),
  jamais convertie en `expiryAt`** — la colonne "Date" du fichier réel
  est ambiguë (péremption ? réception ? autre ?) et n'est **jamais**
  interprétée automatiquement (§26). `expiryAt` reste `null` pour tout
  lot importé.
- `Article.manufacturerId` : résolu **uniquement** si le fabricant
  existe déjà dans `state.manufacturers` — jamais créé à la volée
  (contrairement au fournisseur), et **jamais** un Supplier réutilisé
  comme Manufacturer (§27, distinction déjà établie V3.7 préservée).

Comme la référence est déjà garantie nouvelle par `validateImportRows`
(`DUPLICATE_REFERENCE` rejette tout réimport de la même référence),
chaque ligne valide ne peut créer qu'un seul `ArticleSupplier`/`StockLot`
pour cette référence — aucun risque de doublon sur ce chemin.

### Stocks — inchangé

Le type `stocks` (référence + quantité physique cible, idempotent par
delta d'ajustement) reste **strictement identique** à V3.10.0 — c'est
lui, et lui seul, qui déclenche un `StockMovement`. Le fichier réel de
stock s'importe donc en **deux passages** (comme `articles`/`tarifs`
existants) : une fois mappé en `articles` (référentiel + enrichissements
ci-dessus), une fois mappé en `stocks` (quantité physique) — deux
usages différents de la même colonne source `Code`/`En stock`.

### Utilisateurs (§12-14)

3 colonnes optionnelles ajoutées : `firstname`, `lastname`, `pole`.
`name` devient dérivable : `effectiveImportUserName(r)` = `r.name` si
renseigné, sinon `firstname + ' ' + lastname`. **POLE ≠ rôle ≠ poste** —
trois notions gardées strictement distinctes (§13) :
- `POLE` : organisation métier source (ex. "CERAMIQUE"), jamais stocké
  tel quel dans le modèle DentalFlow ;
- `role` (`User.role`) : libellé de fonction DentalFlow ;
- `assignedStageId` : poste de production DentalFlow (production réelle,
  écran Scan Collaborateur).

**Aucune déduction automatique.** Une nouvelle étape de mapping DES
VALEURS (pas des colonnes) apparaît dans l'assistant, à l'étape
Correspondances, uniquement quand `type==='utilisateurs'` et qu'une
colonne `pole` est mappée : un tableau liste chaque valeur de pôle
RÉELLEMENT présente dans le fichier chargé (jamais une liste
codée en dur pour ce laboratoire) avec deux menus déroulants (Rôle
DentalFlow / Poste de production), stockés dans
`state.importPoleMapping` — jamais appliqués tant que l'utilisateur ne
les a pas explicitement choisis. Une ligne dont le pôle n'est **pas**
mappé est **rejetée** (`UNMAPPED_POLE`, message nommant le pôle en
cause) — jamais un rôle inventé.

## 5. Nouveau modèle minimal — `servicePriceOverrides`

```js
{ id, serviceId, cabinetId, unitPrice, pricingMode, active, source }
```

Store vide par défaut (`state.servicePriceOverrides=[]`), additif pur —
inclus dans `serializableState()`, `ensureV34Model()` (`ensureArray`),
`seedV8()` (vide), export/import JSON. **Aucune migration nécessaire**,
`schemaVersion` reste 10.

### Règle tarifaire appliquée à la commande (§32)

`buildOrderFromInput()` — le point de construction UNIQUE d'une
commande, partagé Lab et Cabinet — résout désormais :

```
1. override actif (Cabinet + Service) — activeServicePriceOverride()
2. sinon Service.basePrice
```

`priceSnapshot` reste **strictement immuable** une fois la commande
créée (inchangé) : un changement ultérieur du tarif standard OU d'un
override ne modifie **jamais** une commande déjà créée — vérifié
explicitement (REAL21, voir Test Report).

## 6. Bug de portée de script trouvé et corrigé pendant le développement

**Découverte** : `activeServicePriceOverride()` (bloc "implementation",
IIFE) est appelée depuis `buildOrderFromInput()` (bloc de base, portée
globale). Lors du **boot prématuré** du bloc de base (avant que le bloc
"implementation" n'ait exécuté `installOverrides()`), `seedV8()` →
`seedV9Orders()` → `buildOrderFromInput()` s'exécute déjà — exactement
la même classe de bug déjà documentée en V3.10.0 R02
(`checkCameraCapability`) et V3.10.2 (`stopCameraScan`). Résultat
observé avant correction : `PAGEERROR: activeServicePriceOverride is
not defined` sur **la quasi-totalité** de la suite de tests (118
échecs en cascade, le seed lui-même échouant).

**Fix** (même pattern que les bugs précédents) :

```js
const override=service&&cab&&typeof activeServicePriceOverride==='function'
  ?activeServicePriceOverride(service.id,cab.id):null;
```

Plus l'export explicite dans `installOverrides()` :
`window.activeServicePriceOverride=activeServicePriceOverride;` (même
convention que les exports caméra/cabinet déjà présents). Vérifié :
428/428 tests hérités après correction (contre 310/428 avant), 0 erreur
console.

## 7. Vérification du moteur d'achats avec des données réelles incomplètes — §46-47

Auditée explicitement la ligne `leadTimeDays=tariff.leadTimeDays??supplier.leadTimeDays??0`
(`evaluateSupplierCandidate`) : avec un fournisseur minimal importé
(`leadTimeDays:null`), ce filet de calcul interne retombe sur `0`
— MAIS n'affecte jamais une recommandation utilisateur, car
`priceOk=tariff.unitPrice!=null` est déjà `false` (unitPrice reste
`null` pour un tarif jamais connu) et rend la candidature **non
viable** indépendamment de tout délai — la proposition finit
`BLOCKED` (`missing_price`, libellé « Tarif fournisseur manquant »)
AVANT que ce délai par défaut n'influence quoi que ce soit de visible.
**Non modifié** — documenté et vérifié plutôt que réécrit, pour rester
strictement minimal.

Vérification live (voir Test Report) : un article réel importé (fichier
stock), poussé sous son seuil de sécurité, avec un fournisseur minimal
(toutes conditions commerciales `null`) produit bien une
`PurchaseProposal` avec `blocking:['missing_price']`, `total` fini ou
`null` (jamais `NaN`), **aucune** recommandation commerciale inventée —
exactement le comportement attendu (§47 : « article sous seuil +
fournisseur connu + prix inconnu → proposition éventuellement BLOCKED
"Tarif fournisseur manquant" — c'est correct »).

## 8. Non modifié (vérifié explicitement)

- **CSS byte-à-byte identique** à V3.10.2 — aucune ligne CSS touchée,
  aucun redesign (§56).
- Navigation V3.10.2 (`#mode-host`, `runtimeAppMode`, zéro reload/zéro
  navigation) — **re-testée intégralement**, intacte.
- Caméra, imports R04 existants (articles/stocks/fournisseurs/tarifs/
  commandes de base), moteur achats, `StockMovement`/`StockLot`/
  `PurchaseOrder`/`PurchaseProposal`, permissions, responsive,
  light/dark/system — non touchés au-delà des enrichissements
  explicitement documentés ci-dessus.
- `schemaVersion` : **10**, aucune migration.
- Les 405 tests hérités de V3.9.5, les 20 REL01-20 (V3.10.0), ROUTE01/
  ROUTE_CAM/ROUTE_RUNTIME (V3.10.1/V3.10.2) restent **strictement
  inchangés**.

## 9. Données volontairement non interprétées (§2, rappel explicite)

- **Colonne "Date" du fichier Stock** : jamais mappée à `expiryAt` —
  conservée en métadonnée brute (`StockLot.sourceDate`) uniquement.
- **POLE (Personnel)** : jamais mappé automatiquement vers un rôle ou
  un poste — mapping explicite obligatoire, valeur par valeur, par
  l'utilisateur.
- **`pricingMode` (Prestations)** : jamais deviné depuis le seul
  libellé — reste `null` si la colonne source ne l'indique pas
  explicitement.
- **Conditions commerciales fournisseur** (délai, franco, transport,
  minimum) : jamais inventées lors de la création minimale d'un
  fournisseur depuis l'import Articles — restent `null`.
- **Statut de compte Dentiste** : jamais `ACTIVE`/`ACCEPTED` du seul
  fait qu'un email est présent — toujours `NO_ACCOUNT`/`NOT_SENT` à la
  création.
- **C.U.M.P** : jamais transformé en tarif fournisseur (`unitPrice`
  reste `null`) — conservé séparément (`Article.averageUnitCost`).

## 10. Tests

Voir `DENTALFLOW_V3_10_3_TEST_REPORT.md` pour le détail complet. Les
quatre fichiers réels du laboratoire (convertis en CSV, jamais modifiés
eux-mêmes) ont servi à construire des fixtures de test véritablement
réelles : 314 cabinets, 8 dentistes (incluant un cas réel vérifié de 4
praticiens partageant un même cabinet et un même email, retrouvé dans
`fichier_client.xlsx`), 13 membres du personnel (9 pôles réels
distincts), 515 articles de stock réels (19 fournisseurs réels, 245
lots réels, 474 CUMP réels non nuls), 335 lignes de tarif réel (333
prestations standard + 2 tarifs spécifiques Cabinet C.H.U., dont un
qui référence une prestation absente du catalogue standard — cas réel
honnêtement rejeté, jamais forcé).
