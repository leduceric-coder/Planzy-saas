# DentalFlow Next V3.4.2 — Rapport d'implémentation

Fichier livré : `dentalflow-next-poc-v3.4.2.html` (monolithique, ouvrable directement dans un navigateur).
Base : `dentalflow-next-poc-v3.4.1.html` (non modifié).
Références : `DENTALFLOW_PURCHASING_SPEC_V1.2_FINAL.md`, `DENTALFLOW_PURCHASING_SPEC_V1.2.1_FINAL.md` (priorité à la V1.2.1 en cas de divergence).

## 1. Problème principal traité

La V3.4.1 contenait un cas particulier codé en dur dans `knownDemand()` :

```js
if(articleId==='ART-ZIR-HT-001'){ ... s.purchaseScenarioUrgent ... }
```

`knownDemand` fabriquait un nombre de démonstration au lieu de le dériver des commandes réelles. Deux autres endroits reposaient sur la même béquille : `computeProjectedFrancoAt` (câblé sur le scénario Ivoclar/Zircone) et le bouton « Réceptionner » (quantité fixe `8` sur `ART-ZIR-HT-001`).

### Correction

`knownDemand(articleId, h, s=state)` est maintenant strictement générique : pour chaque commande active (non terminée) dont l'échéance tombe dans l'horizon `h`, on additionne les lignes de nomenclature (`BILL_OF_MATERIALS[o.type]`) correspondant à l'article, **moins** les lignes déjà réellement consommées (un `StockMovement` de type `CONSUMPTION` portant la `consumptionKey` `${orderId}::${articleId}::${consumeAtStageId}`). Aucun `if` sur un ID d'article, aucune dépendance à `purchaseScenarioUrgent`.

`purchaseScenarioUrgent` n'est plus utilisé que pour ajouter/retirer une commande de démonstration réelle (`addUrgentZirconeOrder` / `clearUrgentZirconeOrder`) ; il ne pilote plus aucun calcul.

Preuve de généricité (test « Demande réelle incrémentale ») : sur le jeu de données réel, ajouter une Couronne zircone augmente la demande connue de Zircone HT de **+1** exactement, puis ajouter un Bridge 3 éléments (BOM ×2) l'augmente de **+2** supplémentaires — total **+3**, sans aucune constante codée dans le test ni dans le moteur.

## 2. Corrections détaillées

### 2.1 `computeProjectedFrancoAt` générique

Remplace l'ancien calcul câblé sur le scénario de démo. Pour un fournisseur et un panier donnés, simule jour ouvré par jour ouvré quand chaque **autre** article de ce fournisseur (pas encore dans le panier) franchirait son propre seuil de réapprovisionnement, cumule les montants par ordre d'apparition, et renvoie la première date où le total atteint le seuil de franco. Ne dépend d'aucun article ni scénario particulier.

### 2.2 Bug de migration V5→V6 (perte de données réelles)

**Découverte pendant les tests de non-régression**, pas dans le périmètre initial du bug connu, mais bloquant pour la fiabilité du moteur : à l'ouverture après mise à jour, l'ordre d'exécution du démarrage était :

```
load() → render() [legacy] → installOverrides() [inclut renderNav()] → ensureV34Model() [migration]
```

`installOverrides()` réassigne `stockSummary` vers `stockSummaryV34` puis appelle `renderNav()`, qui appelle `updateNotif()`, qui appelle `stockSummary()` — donc `stockSummaryV34()` — qui commence par `rebuildLegacyStockView()`. Cette dernière réécrit `state.stock` à partir de `state.articles`, **qui est encore vide** puisque la migration n'a pas encore eu lieu. Résultat : `state.stock` (contenant les vraies quantités migrées depuis le V5) est écrasé par `[]` avant que `ensureV34Model()` ne puisse le lire, et la migration retombe sur les valeurs de démonstration au lieu des vraies quantités de l'utilisateur.

Reproduit et confirmé identique sur `dentalflow-next-poc-v3.4.1.html` non modifié — bug préexistant, pas une régression introduite par cette version, mais correction dans le périmètre de la mission (fiabilité du moteur Stocks/Achats).

**Correction** : `renderNav()` est sorti du corps de `installOverrides()` et appelé explicitement juste après `ensureV34Model()` dans la séquence de démarrage :

```
installOverrides() → ensureV34Model() [migration] → renderNav() → bindV34Events() → ...
```

Vérifié par reproduction directe (état V5 injecté dans localStorage, navigation vers `?migrationTest=verify`) : avant correction `physicalStock=5, incomingStock=0` (valeurs de démo) ; après correction `physicalStock=10, incomingStock=5` (valeurs réelles de la fixture), conforme à l'attendu. Idempotence vérifiée sur un second rechargement (aucun `OPENING`/`PurchaseOrder` dupliqué).

### 2.3 Stock affiché : Disponible vs Physique

`renderStockV34` (carte article) affichait `st.phys` (stock physique) sous le libellé « disponible ». Corrigé pour afficher `st.avail` = `availableStock()` = physique − réservé.

`renderArticleInfo` (fenêtre de détail article) n'affichait que 4 valeurs, dont une intitulée « Disponible » qui était en réalité le stock physique. Remplacé par 6 cartes distinctes : **Stock physique**, **Réservé**, **Disponible**, **En commande**, **Projeté (3j)**, **Couverture**. `projectedStock()` continue de partir de `physicalStock + incoming − expectedDemand` (jamais de `availableStock`, pour éviter le double comptage documenté en V1.2.1).

### 2.4 Reset natif V6

`resetDemoV6()` reconstruit directement, sans repasser par le modèle legacy V5 :
`articles`, `suppliers`, `articleSuppliers`, `stockMovements` (mouvements `OPENING` recréés depuis `DEMO_ARTICLES`), `purchaseOrders` (y compris le PO de démonstration `CF-DEMO-EMX`), `purchaseProposals` (vidées puis recalculées via `reconcileProposals`), `activityEvents`, `importJobs`, `importErrors`, `engineSettings`, `purchaseScenarioUrgent`.

Le bouton « Réinitialiser la démo » (`#reset-demo`) est intercepté en phase de capture par le gestionnaire V3.4.2, qui appelle `seed()` (reset legacy : commandes, utilisateurs, congés…) **puis** `seedV6()`, avant de stopper la propagation vers l'ancien gestionnaire (qui n'appelait que `seed()` et ne touchait aucun store V6).

Vérifié par un test unitaire isolé et par un scénario Playwright de bout en bout : ajout de mouvement/commande/événement/note personnalisés → clic réel sur le bouton → tout disparaît → persistance confirmée après rechargement à froid.

### 2.5 `slowMovingStock` canonique

Règle unique : `coverageDays(articleId) > dormantCoverageDays (180)` **OU** aucun `StockMovement` de type `CONSUMPTION` dans les `dormantNoConsumptionDays` (120) derniers jours. Le filtre « Dormants » de `renderStockV34` appelle désormais cette fonction au lieu de réimplémenter une règle simplifiée (couverture seule) directement dans `render()`.

### 2.6 Assistant d'import CSV

- **Fichier réel** : `<input type="file" accept=".csv,text/csv">` avec `FileReader`, en interface principale. Le collage texte reste disponible (élément `<details>` replié, étiqueté mode debug).
- **6 types importables** : articles, stocks, fournisseurs, tarifs fournisseurs, **commandes** (nouveau), **utilisateurs** (nouveau).
- **Mapping éditable** : chaque colonne détectée obtient un `<select>` de champ cible, pré-rempli par une détection automatique tolérante à la casse/accents/ponctuation (`normField` + table de synonymes par type dans `IMPORT_FIELD_SCHEMAS`). L'étape « Suivant » est bloquée tant qu'un champ obligatoire n'est pas associé.
- **Confidentialité structurelle** : aucun champ cible mappable ne correspond à une identité patient (prénom, nom, date de naissance, téléphone, adresse). Ces colonnes, si présentes dans le fichier source, sont explicitement détectées (`IMPORT_FORBIDDEN_COLUMNS`) et affichées comme « Donnée personnelle — ignorée », non sélectionnables. Seule une référence patient opaque (`patientref`) est importable pour les commandes.
- **`ImportJob`/`ImportError` réels** : chaque import termine crée une entité `ImportJob` persistée (`id`, `type`, `fileName`, horodatages, compteurs), et les erreurs de validation portent l'`id` du job qui les a produites.
- **Import partiel** : les lignes valides sont importées même si d'autres lignes du même fichier sont rejetées.

### 2.7 Réception fournisseur générique

`renderPODetail` affiche désormais un champ numérique par ligne de commande ouverte (valeur par défaut = reliquat réel), et le clic sur « Réceptionner » construit l'objet de réception à partir des valeurs saisies — plus aucune quantité ni référence d'article codée en dur.

### 2.8 Journal — capture globale des erreurs techniques

`logTechnicalError()` est câblé sur `window.addEventListener('error', …)` et `unhandledrejection` de façon **inconditionnelle** (plus seulement à l'intérieur du bloc `?smokeV34=1`). Verrou anti-récursion (`__v34ErrorLoggingGuard`) : si `logActivity` ou `save()` lève à leur tour, l'erreur est avalée silencieusement plutôt que de redéclencher un nouvel événement en boucle. Message tronqué à 300 caractères, sans trace complète ni donnée d'identité avant d'atteindre le Journal visible.

## 3. Invariants préservés

- `projectedStock(h) = physicalStock + incomingArrivingWithin(h) − expectedDemand(h)`, jamais recalculé à partir de `availableStock` (double comptage).
- `expectedDemand(h) = max(knownDemand(h), baselineDemand(h))`.
- Une proposition d'achat = un fournisseur (`reconcileProposals` réconcilie par clé `(supplierId, articleId)`).
- Mouvements de stock immuables et append-only ; toute correction se fait par un nouveau mouvement (`ADJUSTMENT`, jamais de purge).
- Idempotence de consommation via `consumptionKey`.
- Aucune identité patient dans le code source ni dans l'état runtime (vérifié par grep sur l'ensemble du fichier et par un test qui scanne `document.documentElement.outerHTML` + l'état sérialisé).

## 4. Migration

Le chemin V5→V6 (`migrateStockArrayToV6`) reste inchangé dans sa logique de conversion (stock legacy → `articles` + `stockMovements` (`OPENING`) + `PurchaseOrder` synthétique si `incoming > 0`, avec `dataQualityFlags` si fournisseur/prix manquant). La correction du §2.2 porte uniquement sur l'**ordre d'appel** au démarrage, pas sur la logique de conversion elle-même.

## 5. Import (résumé fonctionnel)

Voir §2.6. Les quatre types déjà existants (articles, stocks, fournisseurs, tarifs) conservent leurs règles de validation V3.4.1 inchangées ; `commandes` et `utilisateurs` reçoivent leurs propres règles (`req('reference')`, `req('type')` / `req('name')`, `req('role')`, détection de doublon, poste inconnu).

## 6. Tests

24 tests unitaires isolés dans `runAllTests()` (16 en V3.4.1 + 8 nouveaux), tous verts. Chaque test sauvegarde l'état complet (`serializableState()`), l'altère pour son scénario, puis le restaure exactement (`Object.assign(state, {...state, ...bak})`). Vérifié : `exportDentalFlowJSON()` avant/après `runAllTests()` est **strictement identique** (aucune fuite d'état résiduel). Détail complet dans `DENTALFLOW_V3_4_2_TEST_REPORT.md`.

Tests Playwright complémentaires (hors `runAllTests`, décrits dans le rapport de test) : bout-en-bout de l'assistant d'import, réception de commande générique, reset natif via clic réel + rechargement à froid, persistance à froid (`persistTest`), migration à froid (`migrationTest`), état vide (`emptyTest`), smoke-test multi-mode × multi-largeur.

## 7. Limitations réelles hors périmètre

Deux défauts d'interface **préexistants dans `dentalflow-next-poc-v3.4.1.html` non modifié** (reproduits et confirmés identiques sur le fichier de base avant toute modification) :

1. **Panneau « Messages »** : à largeur ≤ 768 px, ouvrir le panneau Messages depuis le contexte du smoke-test affiche par moments le panneau Utilisateurs à la place. Sans rapport avec le moteur Stocks/Achats/Import/Journal ; non corrigé dans cette version pour rester strictement dans le périmètre de la mission.
2. **Débordement horizontal en mode Scan à 390 px** : le contenu mesure 437 px de large contre 390 px de viewport. Préexistant, sans rapport avec le périmètre Stocks/Achats.

Aucune autre limitation connue dans le périmètre traité (moteur de demande, propositions d'achat, stock, import, reset, journal).
