# DentalFlow V3.10.3.1 — Changelog — CORRECTIF (audit indépendant de V3.10.3)

**Base :** `dentalflow-next-poc-v3.10.3.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.1.html`
**`schemaVersion` : 10, inchangé** — toutes les additions sont purement
additives (nouveaux champs optionnels sur `Service`/`Article`/`User`,
nouveau type d'import `inventaire`), aucune migration de schéma n'a été
nécessaire.

## 0. Contexte

Ce lot corrige **7 défauts fonctionnels réels** identifiés par un audit
indépendant de la livraison V3.10.3, et corrige l'honnêteté de 3
affirmations du rapport de test V3.10.3 (voir §9). Aucune des
non-régressions figées (navigation, LAB/STAFF/CABINET, caméra,
commandes, production, StockMovement/StockLot opérationnel réel,
PurchaseProposal/PurchaseOrder, `servicePriceOverrides`, `priceSnapshot`
immuable, anonymisation patient, responsive, thèmes) n'a été touchée —
voir l'audit de diff en §13.

## 1. §2 — Prestation sans `pricingMode` qualifié → `pricingReviewRequired`

**Défaut (V3.10.3) :** une prestation standard importée sans colonne
`pricingmode` reconnue héritait silencieusement du mode existant (ou
restait `null`) mais **restait `active:true`** et **apparaissait dans
les deux sélecteurs de nouvelle commande** (labo et cabinet) — un
utilisateur pouvait donc sélectionner une prestation dont le tarif
n'était en réalité jamais vérifié.

**Correctif :**
- Nouveau champ additif `Service.pricingReviewRequired:boolean`.
- Import d'une ligne standard (sans colonne `cabinet`) :
  - `pricingmode` = `FIXED`/`PER_TOOTH` → qualifié : `pricingMode` posé,
    `pricingReviewRequired=false`, `active` **préservé** sur une mise à
    jour, `active=true` sur une création.
  - `pricingmode` vide/inconnu → **jamais un forfait inventé** :
    `pricingMode=null`, `pricingReviewRequired=true`, et pour une
    **nouvelle** ligne `active=false`. Un réimport à cellule vide ne
    **dé-qualifie jamais** une prestation déjà qualifiée (le flag effectif
    de l'existant est préservé).
- Nouvelle fonction partagée `serviceIsOrderable(s)` — seule logique de
  filtrage utilisée par **les deux** sélecteurs de nouvelle commande
  (`serviceSelectHTML()` côté labo, `dentistNewHTML()` côté cabinet) :
  `active!==false && pricingReviewRequired!==true && pricingMode∈{FIXED,PER_TOOTH}`.
- Page Prestations (admin) : une ligne non qualifiée affiche **« À
  qualifier »** (badge orange), jamais « Forfait » par défaut.
- Formulaire manuel de prestation (`submitServiceForm`) : le sélecteur
  Mode de tarification n'offre que des valeurs explicites (Forfait/Par
  dent) — toute sauvegarde manuelle efface donc `pricingReviewRequired`.
- `buildOrderFromInput()` reste protégé même en cas d'appel direct hors
  UI : `priceSnapshot.pricingMode` ne devient jamais une valeur inventée
  pour une prestation non qualifiée.

## 2. §3 — Import fournisseurs (type direct) : « vide ≠ zéro »

**Défaut (V3.10.3) :** `resolveOrCreateMinimalSupplier()` (nouveau
chemin V3.10.3, utilisé par les imports Articles/Inventaire) respectait
déjà correctement « vide ≠ zéro ». Le type d'import **direct**
`fournisseurs` (préexistant, hérité) ne suivait pas la même règle :
un nouveau fournisseur avec des cellules vides héritait de `leadtime:3`,
`shippingcost:0`, `minimumorder:0` — des valeurs commerciales
**inventées**. La résolution de l'existant se faisait aussi uniquement
par id déterministe `SUP-<nom>`, risquant de dupliquer un fournisseur
déjà présent sous un id différent (démo, création manuelle).

**Correctif :**
- Nouveau fournisseur : cellule vide → `null` pour `leadTimeDays`,
  `freeShippingThreshold`, `shippingCost`, `minimumOrder` (jamais 3/0/0).
  Un `"0"` explicite reste `0` (distinct d'une cellule vide).
- Fournisseur existant : cellule vide **préserve** la valeur déjà
  connue.
- Résolution de l'existant par **nom normalisé** sur tous les
  fournisseurs déjà connus (`normId(name)`), plus seulement par id
  déterministe — élimine le risque de doublon.

## 3. §4 — Personnel/droits : `roleId`/`permissions` jamais posés

**Défaut (V3.10.3) :** l'import `utilisateurs` posait `role`
(libellé de fonction) et `assignedStageId`, mais **ne posait jamais**
`roleId` (rôle de droits), `permissions`, `scope` ni `capacity` — un
utilisateur importé avait donc des droits vides/implicites, jamais
vérifiés par un humain.

**Correctif :**
- Schéma `utilisateurs` étendu (champs optionnels additifs) :
  `roleid`, `scope`, `capacity`.
- `roleId` **exclusivement** un id de `ROLE_DEFS`
  (`RESPONSABLE`/`PRODUCTION`/`STOCK`/`ADMINISTRATIF`/`LECTURE`) —
  jamais déduit du libellé `role`/`pole`. Résolution : colonne `roleid`
  directe (validée contre `ROLE_DEFS`) sinon mapping POLE explicite
  (`state.importPoleMapping[...].roleid`, lui-même validé contre
  `ROLE_DEFS`).
- Aucune des deux résolutions n'aboutit → la ligne est **REJETÉE**
  (`UNMAPPED_ROLE_ID`) — jamais un utilisateur créé avec des droits
  implicites.
- Table de correspondance POLE (assistant d'import) : troisième
  colonne explicite **« Rôle de droits »**, alimentée exclusivement par
  `ROLE_DEFS` (jamais une liste parallèle codée en dur — la colonne
  « Rôle DentalFlow » existante, `roleChoices`, reste le libellé de
  *fonction* affiché, une notion distincte).
- Création : `roleId=roleId résolu`, `permissions=defaultPermissionsForRole(roleId)`,
  `scope`/`capacity` pris des colonnes si fournies (sinon non
  inventés — capacité par défaut à 0, cohérent avec le traitement
  `+u.capacity||0` déjà utilisé partout ailleurs dans le moteur de
  charge), `assignedStageId` = choix explicite ou `null`.
- Mise à jour : un `roleId` réimporté **ne réécrit jamais** des
  `permissions` déjà explicites (tableau non vide) — seul un
  utilisateur sans permissions explicites reçoit les permissions par
  défaut du rôle réimporté.

## 4. §5 — Moteur achats : BLOCKED ≠ NO_ACTION (contradiction corrigée)

**Défaut confirmé (V3.10.3) :** `decideProposal()` retournait
`NO_ACTION` **avant** même de tester `p.blocking` dès qu'aucune ligne
n'avait de `stockoutAt` calculable (typiquement : un article
fraîchement importé, sans historique de consommation). Une proposition
avec `blocking:['missing_price']` pouvait ainsi afficher
`recommendedAction:'NO_ACTION'` — exactement la contradiction
qu'un test de vérification V3.10.3 (`verify_purchase_engine.js`) avait
déjà fait apparaître dans sa sortie sans qu'elle soit reconnue comme
telle dans le rapport de test livré (voir §9).

**Correctif :** l'ordre de décision de `decideProposal()` est corrigé :
1. Pas de fournisseur résolu → `BLOCKED` / `missing_supplier`
   (inchangé).
2. `p.blocking` non vide → **`BLOCKED`** (déplacé ici, avant tout calcul
   de rupture).
3. Seulement alors la logique préexistante NO_ACTION/WAIT/ORDER_NOW.

`computeNeeds()`/`reconcileProposals()` n'ont pas été modifiés : ils
respectaient déjà « aucun besoin réel ⇒ aucune fausse proposition »
(vérifié par FIX21, aucune régression, aucun changement de code
nécessaire à cet endroit).

## 5. §6 — Nouveau type d'import « Inventaire laboratoire »

**Contexte :** le type `articles` (V3.10.3) reste **création
uniquement** — un réimport de la même référence est rejeté
(`DUPLICATE_REFERENCE`), comportement historique volontairement
**conservé à l'identique** (jamais modifié dans ce lot).

**Ajout :** nouveau type `inventaire` (« Inventaire laboratoire » dans
l'assistant), qui effectue un **vrai upsert par référence** :
- Référence absente → création. Référence existante → mise à jour des
  **seuls champs réellement fournis sur la ligne** — une cellule vide
  n'efface jamais une valeur déjà connue (label, catégorie, unité,
  seuil de sécurité, CUMP, fabricant, fournisseur, métadonnées de lot).
- Le stock physique est ajusté par **delta** vs `physicalStock()`, via
  un unique `StockMovement` de type `ADJUSTMENT` — un réimport à
  quantité identique ne crée **aucun** mouvement supplémentaire
  (idempotent).
- Fournisseur/`ArticleSupplier` : mêmes règles de sémantique nulle que
  partout ailleurs (`resolveOrCreateMinimalSupplier`, jamais de prix
  inventé).
- CUMP → `Article.averageUnitCost` (jamais un `ArticleSupplier.unitPrice`).
- Schéma : `reference`/`label`/`safetystock`/`stock` requis ; `unit`,
  `category`, `supplier`, `cump`, `manufacturer`, `sourcelotnumber`,
  `sourcelotdateraw` optionnels.

## 6. §7 — Lot legacy : métadonnée informative, jamais opérationnelle

**Défaut (V3.10.3) :** `upsertStockLotFromImport()` (chemin `articles`)
crée un vrai `StockLot` avec un `receivedAt:Clock.iso()` **inventé**
(l'heure de l'import, pas une donnée réelle du fichier).

**Correctif (scope du nouveau type `inventaire` uniquement — le chemin
`articles` V3.10.3 est conservé tel quel, pour compatibilité) :**
- Nouveaux champs additifs **purement informatifs** :
  `Article.sourceLotNumber`, `Article.sourceLotDateRaw`.
- Le type `inventaire` alimente **exclusivement** ces deux champs —
  jamais `upsertStockLotFromImport()`, donc **jamais** de `StockLot`
  opérationnel créé par ce chemin.
- Vérifié : `lotAvailableQty()`, `allocateLotsFEFO()`,
  `consumeForScan()` ne lisent ces deux champs à aucun endroit (noms de
  champs entièrement nouveaux, aucune référence croisée possible).
- **Non implémenté, volontairement** : la réparation optionnelle au
  boot (migrer un `StockLot` `source==='IMPORT'` non référencé par
  aucun mouvement/allocation vers les champs Article puis le supprimer)
  décrite comme *recommandée mais optionnelle* dans le mandat. Ce choix
  est délibéré : altérer au boot des `StockLot` déjà persistés touche à
  une zone (StockLot opérationnel réel, périmètre figé du mandat) dont
  la mission demande explicitement la non-régression ; l'absence de
  garantie supplémentaire testable sur les états `StockLot` existants
  dans le POC (pas de jeu de données `StockLot` `source==='IMPORT'` non
  référencé identifié dans les fixtures actuelles) rendait le
  bénéfice/risque défavorable pour un item explicitement marqué
  optionnel. Aucun `StockLot` réel n'est donc migré ni supprimé par ce
  lot — seul le nouveau chemin `inventaire` évite d'en créer.

## 7. §8 — `servicePriceOverrides` : conservé, sécurisé

`servicePriceOverrides` **n'est ni supprimé ni étendu en portée** (il
répond au besoin réel de tarif C.H.U. spécifique). Renforcements :
- `buildOrderFromInput()` ne consulte un override que si la prestation
  standard sous-jacente est elle-même qualifiée
  (`serviceIsOrderable(service)` — actif ET `pricingMode` qualifié) ;
  sinon l'override est ignoré, jamais utilisé pour construire un
  `priceSnapshot`.
- `Service.basePrice` n'est jamais modifié par un override (inchangé,
  vérifié FIX28).
- `priceSnapshot` reste strictement immuable après création d'une
  commande (inchangé, vérifié FIX29).
- Un override au `pricingMode` absent ne peut plus jamais retomber
  silencieusement sur un forfait implicite, puisque la garde
  `serviceIsOrderable` empêche déjà son utilisation dès lors que le
  standard sous-jacent n'est pas qualifié (FIX30).

## 8. Un seul test hérité modifié (documenté, jamais un critère affaibli)

Le test `"Import utilisateurs crée un utilisateur"` (suite des 428
tests hérités) exerçait exactement le défaut corrigé en §3 : sa
fixture CSV (`name,role,assignedstageid`) ne fournissait ni `roleid` ni
`pole` — un import qui, après ce correctif, est **à bon droit rejeté**
(`UNMAPPED_ROLE_ID`, aucun utilisateur créé sans droits explicites).
Sa fixture a été complétée d'une colonne `roleid` (`RESPONSABLE`) ;
**les critères de réussite du test (imported/found/role) restent
strictement identiques** — c'est la seule modification apportée à un
test hérité dans ce lot, documentée ici et dans le code (commentaire
au-dessus du test).

## 9. Honnêteté du rapport V3.10.3 — corrections (voir rapport de test §9 pour le détail)

- **Dentistes :** le rapport V3.10.3 ne mentionnait déjà qu'un
  échantillon (8 lignes), sans jamais affirmer « import complet » — la
  formulation est rendue plus explicite dans le nouveau rapport :
  échantillon réel de **8 praticiens sur 102** (`Pratriciens 2026`,
  103 lignes = 1 en-tête + 102 praticiens réels).
- **Cabinets :** nouvelle divulgation factuelle — la colonne source
  `Desactive` de `Feuil1` compte **185 lignes désactivées vs 128
  actives** (sur 313 lignes de données). Le schéma d'import `cabinets`
  ne comporte pas ce champ ; chaque cabinet importé reçoit
  `status:'ACTIVE'` par défaut, sans jugement d'activité — cette
  distinction reste, comme demandé, une décision du normalisateur CSV
  externe, jamais du code DentalFlow.
- **Tarifs :** écart 335 vs 354 entièrement réconcilié — voir rapport
  de test §9(C). Cause : un bug de regex dans le script Python
  *personnel de préparation de fixtures* (`build_tarif_csv.py`, hors
  périmètre applicatif livré) faisait silencieusement disparaître 19
  lignes réelles dont le prix contenait un espace séparateur de
  milliers (ex. `"1 560.00 €"`). Corrigé dans le script de fixture ;
  **aucun changement du moteur DentalFlow lui-même n'était nécessaire**
  (`parseImportNumber()` gère déjà correctement les espaces).

## 10. Diff audit (§12 du mandat)

Zones touchées, exclusivement : schémas/wizard d'import
(`IMPORT_FIELD_SCHEMAS`, `IMPORT_TEMPLATE_EXAMPLES`, liste des types,
table de mapping POLE), sémantique d'import fournisseurs, import
utilisateurs/mapping POLE, qualification des prestations
(`serviceIsOrderable`, `pricingModeLabel`, formulaire manuel de
prestation), import inventaire (nouveau), champs informatifs de lot sur
`Article`, ordre de décision de `decideProposal()`, tests, documentation.
**Zéro** modification de : navigation, caméra, patient/anonymisation,
production, logique Charge, CSS/redesign, ou toute fonction nouvelle
non demandée. Voir rapport de test §12 pour le détail hunk-par-hunk.
