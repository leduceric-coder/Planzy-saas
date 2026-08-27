# DentalFlow Next — V3.3 Changelog

**Sprint : Product Cleanup.** Objectif : simplifier, unifier, protéger les
invariants métier. Aucune nouvelle grande fonctionnalité.

Base : `dentalflow-next-poc-v3.2.html` → `dentalflow-next-poc-v3.3.html`.

---

## P0 — Bloquants

### Vie privée patient
- Suppression de `patientFirst` / `patientLast` du modèle `order` et de la
  génération de démo.
- Suppression de `refPart()`, `buildPatientRef()`, `uniqueOrderCode()`,
  `patientDisplay()`.
- Ajout de `generatePatientRef()` (opaque `PAT-XXXXXX`) et `generateOrderId()`
  (séquentiel `CMD-####`).
- Formulaires labo et cabinet : plus de champ nom/prénom ; référence opaque
  générée automatiquement.
- QR : encode uniquement l'`orderId` opaque.

### Stage IDs stables + immutabilité des scans
- Nouvelle source **unique** `state.stageDefinitions` = `{id, label, active,
  order}` (`STG-001`, …). Suppression de l'usage courant de la constante `STAGES`.
- Helpers : `stageDefs`, `stages`, `labelForStageId`, `stageIdByLabel`,
  `stageColorForId`.
- Scans enrichis et **immuables** : `stageId`, `stageLabelAtScan`,
  `technicianId`, `technicianNameAtScan`, `timestamp` (snapshots figés).
- `renameStage()` modifie uniquement le label de la définition — ne touche
  jamais l'historique.
- `deleteStage()` = désactivation (`active:false`), jamais de suppression
  physique ; l'historique reste lisible.
- `reorderStages()` réordonne les définitions.

### Source de vérité de la localisation
- `getConfirmedStage` / `getConfirmedTechnician` / `getConfirmedScanTime` :
  seule localisation confirmée = dernier scan réel.
- `effectiveStation()` ne se rabat plus sur `boardStation`/`o.station` : renvoie
  la localisation confirmée ou `null`.
- **Suppression du drag & drop des commandes** (`moveOrderToStage` retiré). La
  progression physique vient exclusivement du scan.
- Production : bloc « Sans localisation confirmée » pour les commandes sans scan.
- Quick View : distinction « Localisation confirmée » vs « Prochaine étape
  prévue ».

### Horloge unique
- `Clock` (modes `demo` / `real`) ; `Clock.now()` / `Clock.iso()` utilisés pour
  scans, messages, audit, création, congés, livraison.

### Persistance
- Nouvelle clé `dentalflow-next-mockup-state-v4` ; reseed propre si état
  incompatible (`migrateStateV3toV4`). Un ancien localStorage ne casse jamais V3.3.

## P1 — Cohérence

### Modèle état + flags
- `order.productionState` ∈ `{active, ready, completed}` +
  `order.flags {late, blocked, scanExpected}` cumulables.
- Helpers : `getOrderProductionState`, `isOrderLate/Blocked/Ready/Completed`,
  `needsAttention`, `orderSignals`, `primaryStatusKey`, `orderStatusInfo`.
- Retard **et** blocage peuvent coexister ; « À surveiller » affiche le motif
  principal + « +N autres signaux ».
- Donut : catégories exclusives (En production / Prêtes / Bloquées / Terminées),
  sans « À scanner ».

### Navigation
- Principale : **Accueil, Commandes, Production, Messages**.
- Groupe **« Outils »** repliable : Plan de charge, Stocks, Rapports,
  Utilisateurs.
- **Suppression du drag & drop du menu** (`setupNavDnD`, `navOrder`,
  poignées `.nav-grip`).

### Mode collaborateur
- Écran par défaut = **DentalFlow Scan** (plus d'onglets au même niveau).
- « Mes congés » déplacé en accès secondaire dans l'en-tête.

## P2 — Portail, livraison, cleanup

- `getDentistFacingStatus()` : Réception→Reçue ; Design/Usinage/Céramique→
  Fabrication en cours ; Contrôle qualité→Contrôle ; Prêtes→Prête ;
  terminée→Livrée. Suivi en 5 macro-étapes.
- Portail cabinet : masque technicien, heure de scan et poste interne.
- `getAvailableDeliveryDates()` : source unique (délai métier + charge engagée +
  jours ouvrés), 3 dates **Au plus tôt / Recommandée / Confort**.
- Pièces jointes : **2 Mo max/fichier**, **5 max/conversation**, message
  d'erreur clair.
- Emails de démo `@planzy.fr` → `@dentalflow-demo.fr` (aucune marque Planzy).
- Nettoyage de code/CSS mort : `patientDisplay`, alias de localisation,
  `performScan`, `.footer-settings`, `.nav-grip`, injection de noms de démo.
- Réorganisation du JS en blocs commentés (CONFIG / CLOCK / STAGES / SCAN /
  MIGRATION / PERSISTENCE / MODÈLE COMMANDE / DENTIST PORTAL …).

## Non retenu (hors scope V3.3)

- IndexedDB pour les blobs (P2 optionnel) — écarté pour ne pas déstabiliser le
  POC.
- Toute nouvelle fonction métier, KPI, module, backend, IA, facturation.

---

## Documents livrés
- `dentalflow-next-poc-v3.3.html`
- `V3_3_CLEANUP_PLAN.md`
- `V3_3_TEST_REPORT.md`
- `V3_3_CHANGELOG.md`
