# DentalFlow V3.10.3.4 — Changelog — Qualification par lot des prestations

**Base :** `dentalflow-next-poc-v3.10.3.3.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.4.html`
**`schemaVersion` (bloc de base ≥6) : inchangé. `V34_SCHEMA_VERSION` (IIFE) : inchangé.**

## Contexte

Cette évolution est **explicitement commandée** par le mandat "DENTALFLOW V3.10.3.3 — RECETTE UTILISATEUR
LABORATOIRE" (§3, "Qualification accélérée des prestations") : 352 des 353 prestations réelles importées
restent `À qualifier` (`pricingMode:null`, `pricingReviewRequired:true`) ; les traiter une par une via le
formulaire unitaire existant (`renderServiceFormPanel`/`submitServiceForm`) est jugé irréaliste pour une
utilisation réelle par le laboratoire. Ce n'est donc pas une correction de défaut mais une fonctionnalité
demandée par ce mandat, traitée comme toute autre évolution fonctionnelle du projet (nouvelle version, changelog,
rapport de test).

## Fonctionnalité ajoutée

Un nouvel écran **« Qualification par lot »**, accessible depuis Factures → onglet Prestations via un nouveau
bouton **« N à qualifier · Qualifier en lot »** (visible uniquement s'il reste au moins une prestation à
qualifier) :

- **Filtres** : recherche texte, catégorie (`Service.category`), sous-catégorie (`Service.subcategory`, jusqu'ici
  jamais exposée dans aucune UI bien que présente dans les données d'import).
- **Tableau** : case à cocher, libellé, catégorie, sous-catégorie, prix de base (affiché, jamais modifié par ce
  workflow).
- **Sélection** : case à cocher par ligne + « Tout sélectionner » qui ne sélectionne QUE les lignes actuellement
  visibles selon les filtres (jamais une sélection globale masquée).
- **Mode de tarification** : un unique `<select>` proposant strictement les deux modes réellement supportés par
  le moteur (`FIXED`/« Forfait », `PER_TOOTH`/« Par dent » — confirmés via `serviceIsOrderable()` et
  `pricingModeLabel()`, aucun troisième mode n'existe dans le moteur). **Aucune déduction automatique** depuis le
  prix ou le libellé — le mode est toujours un choix explicite de l'utilisateur pour la sélection courante.
- **Confirmation avant écriture** : cliquer sur « Appliquer à la sélection » ouvre un écran de résumé (nombre de
  prestations, famille(s) concernée(s), mode choisi, mention explicite que les prestations seront réactivées) —
  rien n'est écrit avant le clic sur « Confirmer et appliquer ».
- **Compteur** : nombre de prestations restant à qualifier au total, affiché en permanence dans la barre du bas
  et sur le bouton d'ouverture.
- **Historique et retour en arrière** : chaque application est enregistrée (`state.serviceQualificationBatches`,
  persisté comme le reste de l'état via `v34Save()`) avec un instantané complet de l'état précédent de chaque
  prestation concernée ; un bouton « Annuler » par lot restaure exactement cet état (y compris si la prestation
  avait été suspendue avant la qualification par lot).

## Ce que fait réellement `bulkQualifyServices(ids, mode)`

Exactement la même mutation que `submitServiceForm()` pour chaque prestation sélectionnée
(`pricingMode=mode`, `pricingReviewRequired=false`) **plus** la réactivation explicite (`active=true`) déjà
nécessaire séparément aujourd'hui pour rendre une prestation commandable (`serviceIsOrderable()` exige
`active!==false && pricingReviewRequired!==true && pricingMode∈{FIXED,PER_TOOTH}`) — annoncée explicitement dans
l'écran de confirmation, jamais un effet de bord caché. Le prix de base déjà présent (issu de l'import) n'est
**jamais** modifié par ce workflow.

## Intégration technique (additive, aucune modification du moteur existant)

- Nouvelles fonctions ajoutées dans le bloc IIFE "implementation", au même endroit que
  `submitServiceForm`/`toggleServiceActive` : `bulkQualifyEligibleServices`, `bulkQualifyCategories`,
  `bulkQualifySubcategories`, `bulkQualifyFilteredServices`, `bulkQualifyServices`,
  `revertQualificationBatch`, plus les fonctions d'interaction de l'écran
  (`renderBulkQualifyPanel`, `bulkQualifyToggle*`, `bulkQualify*Change`, `bulkQualifyGoToConfirm`,
  `bulkQualifyCancelConfirm`, `bulkQualifyApplyConfirmed`, `bulkQualifyRevertClick`, `refreshBulkQualifyWrap`).
- Nouveau champ d'état `state.serviceQualificationBatches` (tableau), avec son repli de migration ajouté au même
  endroit que `cabinets`/`servicePriceOverrides` dans `load()`, sa valeur par défaut dans `seedV8()`, et son
  inclusion dans `serializableState()` — même discipline que le correctif V3.10.3.3, pour ne jamais réintroduire
  un champ qui ne survivrait pas à un rechargement.
- `renderSidePanel()` (bloc de base) route `state.sidePanel==='bulkQualify'` vers `renderBulkQualifyPanel()`
  (IIFE) — **exposée via `window.renderBulkQualifyPanel=renderBulkQualifyPanel`**, même mécanisme que
  `window.v34Save`/`window.activeServicePriceOverride` (le bloc de base est exécuté avant l'IIFE et ne voit
  jamais ses déclarations internes sans exposition explicite). Toutes les fonctions référencées par les
  attributs `onclick`/`onchange`/`oninput` du nouveau panneau (exécutés par le navigateur en portée globale) sont
  exposées selon le même principe.
- `renderServicesTab()` (IIFE) affiche le nouveau bouton (visible seulement si `bulkQualifyEligibleServices()`
  est non vide) ; le clic est routé par le gestionnaire délégué existant (même zone que `#new-service-btn`).
- **Aucune ligne du moteur de tarification, de `serviceIsOrderable()`, de `createOrder()`, ni d'aucun formulaire
  existant n'a été modifiée.** Aucune régression attendue, aucun nouveau champ obligatoire, aucun changement de
  schéma d'import.

## Vérification empirique

- Parcours réel (clics Playwright, jamais d'appel direct de fonction) sur le corpus réel complet (353
  prestations, dont 352 à qualifier) : ouverture du panneau, filtre par catégorie (ATTACHEMENTS → 18
  prestations), sélection totale de la vue filtrée (18/18), choix explicite du mode Forfait, écran de
  confirmation avec résumé exact, application → 18 prestations qualifiées et réactivées, `serviceIsOrderable()`
  confirmé `true` sur un échantillon réel.
- Annulation du lot → état exactement restauré (352 à qualifier, comme avant).
- Persistance réelle : nouveau lot appliqué puis `page.reload()` réel → compteurs et historique identiques
  avant/après (`toQualify` et nombre de lots strictement égaux).
- **0 erreur console** sur l'ensemble du parcours.
- **468/468 tests hérités**, ×3 exécutions consécutives — **0 régression**.
- NAVDOM 31/31, UI Playwright 16/16 — non régressés.
- `node --check` sur les 5 blocs `<script>` réels — tous OK.

## Portée

Fonctionnalité additive uniquement. Aucun refactoring, aucun renommage, aucune modification de design en dehors
du nouvel écran. Le formulaire unitaire existant (`renderServiceFormPanel`) reste disponible et inchangé pour
qualifier une prestation individuellement si souhaité.
