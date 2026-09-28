# DentalFlow V3.10.3.3 — Changelog — CORRECTIF BLOQUANT (persistance réelle)

**Base :** `dentalflow-next-poc-v3.10.3.2.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.3.html`
**`schemaVersion` : 10, inchangé.**

## Contexte

Ce correctif est **né pendant la phase "Import test persistant + recette métier"** (V3.10.3.2, base
gelée), qui exigeait explicitement : *"Ne corriger le code que si une anomalie reproductible et
bloquante apparaît pendant l'import test."* C'est exactement ce qui s'est produit.

## Anomalie découverte

**Reproductible :** en rechargeant la page après un import réel persistant (515 articles, 126
cabinets, 91 dentistes, 353 prestations, 17 fournisseurs, 13 utilisateurs), une partie substantielle
des données importées disparaissait silencieusement.

**Cause racine (confirmée par lecture directe du code, pas seulement par le symptôme) :**

- `save()` (bloc de base, l'unique fonction appelée par `createOrder`, `applyImportRows`, tous les
  formulaires manuels, etc.) n'a **jamais** persisté que le sous-ensemble historique de l'état :
  `orders, scanEvents, historyEvents, messages, documents, stock, users, absences, leaveRequests,
  stageDefinitions, sidebarCollapsed, theme, scanStation, scanTechnician`.
- Une fonction correcte et complète, `v34Save()` (bloc implementation), qui sérialise l'état **entier**
  via `serializableState()` (cabinets, dentists, services, suppliers, articles, articleSuppliers,
  stockMovements, stockLots, purchaseProposals, purchaseOrders, servicePriceOverrides, manufacturers,
  invoices, conversations, notifications, etc.), existait déjà dans le code mais **n'était appelée nulle
  part** — code mort depuis son introduction.
- `load()` avait par ailleurs sa propre lacune indépendante : `cabinets` et `servicePriceOverrides`
  (introduits en V3.10.3) étaient absents de sa liste de restauration, même si `save()` les avait
  persistés.

**Conséquence réelle, avant correctif :** Cabinets, Dentistes, Services/Prestations,
servicePriceOverrides, Fournisseurs, Articles, ArticleSuppliers, StockMovements, StockLots,
PurchaseProposals, PurchaseOrders — c'est-à-dire la quasi-totalité des entités introduites depuis les
versions V3.3 à V3.10.3 — **ne survivaient jamais à un rechargement de page**, dans **aucune** version
antérieure de DentalFlow (pas seulement V3.10.3.2). Seuls `orders/users/stock` (schéma historique
V3-V4) étaient réellement persistants.

## Correctif appliqué (minimal, additif)

1. **`window.v34Save=v34Save;`** — exposition de la fonction déjà correcte vers le bloc de base, même
   schéma d'exposition que `activeServicePriceOverride`/les fonctions caméra (V3.10.0-V3.10.3).
2. **`save()`** délègue désormais vers `v34Save()` dès qu'elle est disponible (garde
   `typeof v34Save==='function'`, même motif que partout ailleurs dans ce fichier pour les appels
   base→implementation). Le corps historique reste un repli exact et inchangé pour le seul cas
   d'appel prématuré pendant le boot du bloc de base (avant `installOverrides()`).
3. **`load()`** : ajout de `cabinets` et `servicePriceOverrides` à la liste de restauration
   (schemaVersion≥6), sur le même modèle que tous les autres champs déjà présents.

Aucune autre ligne modifiée. Aucun redesign, aucun nouveau champ, aucune nouvelle fonctionnalité.

## Vérification empirique du correctif

- Import réel persistant (126 cabinets, 91 dentistes, 13 utilisateurs, 353 prestations, 17
  fournisseurs, 515 articles) suivi d'un rechargement de page réel : **tous les compteurs identiques
  avant/après rechargement** (cabinets, dentists, services, servicePriceOverrides, suppliers, articles,
  articleSuppliers, stockMovements, stockLots, purchaseProposals — voir rapport de test).
- Réimport du même corpus (passe 2) après rechargement : **idempotence confirmée** (0 création, tout
  Modifié/Ignoré, snapshots strictement identiques).
- Un `cabinetPatient` réel créé via `createDentistOrderCore()` survit également au rechargement,
  données identiques (mécanisme `saveCabinetPatients()`/`loadCabinetPatients()`, déjà correct,
  non modifié).
- **468/468 tests hérités**, ×3 exécutions consécutives — **0 régression**.
- NAVDOM 31/31, UI Playwright 16/16 — non régressés.
- `node --check` sur les 5 blocs `<script>` réels — tous OK.
- 0 erreur console sur l'ensemble des parcours.

## Diff audit

3 hunks au total : `load()` (ajout cabinets/servicePriceOverrides), `save()` (délégation vers
`v34Save`), exposition `window.v34Save`. Aucune autre zone touchée — navigation, caméra, patient,
production, moteur achats, Charge, CSS : intacts.

## Portée

Ce correctif ne modifie **aucun comportement métier** observable à l'intérieur d'une même session — il
corrige uniquement ce qui survit, ou pas, à un rechargement de page. C'est un correctif d'infrastructure
de persistance, pas une évolution fonctionnelle.
