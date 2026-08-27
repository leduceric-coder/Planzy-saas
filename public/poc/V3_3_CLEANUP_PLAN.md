# DentalFlow Next — V3.3 Cleanup Plan

Fichier source : `dentalflow-next-poc-v3.2.html`
Fichier cible : `dentalflow-next-poc-v3.3.html`

Objectif : **product cleanup**. Simplifier, unifier, protéger les invariants
métier. Aucune nouvelle grande fonctionnalité. Aucun backend / IA / facturation.

Approche : 3 phases avec test entre chaque (§68-70 du brief).

---

## Invariants métier à protéger

1. **Vie privée patient** : aucune identité (nom/prénom/cabinet) reconstructible
   depuis une référence patient, un identifiant commande ou un QR.
2. **Immutabilité du scan** : un `scanEvent` historique ne change jamais, même
   après renommage ou désactivation d'un poste.
3. **Source de vérité unique de la localisation** : le dernier scan réel.
   La planification (intention) ne remplace jamais la localisation confirmée.
4. **Horloge unique** : `Clock.now()` partout.

---

## P0 — Bloquants (phase 1)

### A. Privacy patient
- **Supprimer** : `refPart()`, `buildPatientRef()`, `uniqueOrderCode()`,
  `patientDisplay()`, et l'injection `patientFirst/patientLast` dans `seed()`.
- **Ajouter** : `generatePatientRef()` (opaque, ex. `PAT-7K2F9Q`) et
  `generateOrderId()` (séquentiel `CMD-0205`).
- **Modèle `order`** : plus de `patientFirst` / `patientLast`. Seul `patientRef`
  opaque subsiste.
- **Formulaires** (`renderNewOrderPanel`, `dentistNewHTML`) : retirer les champs
  nom/prénom. Référence générée automatiquement, opaque.
- **QR** : `qrSvg(o.id)` — encode déjà uniquement `orderId`. Vérifier qu'aucun QR
  n'encode d'identité.
- **Portail cabinet** : afficher `patientRef` (pas de nom).
- Risque : casse des lecteurs de `patientDisplay`. Mitigation : remplacer par
  `o.patientRef` partout.

### B. Stage IDs + immutabilité scans
- **Ajouter** `state.stageDefinitions = [{id:'STG-001',label,active,order}]` —
  **source unique** des postes.
- Helpers : `stageDefs()` (actifs, triés), `stages()` (labels actifs, compat),
  `labelForStageId()`, `stageIdByLabel()`, `stageColorForId()`.
- **scanEvent enrichi** : `{orderId, stageId, stageLabelAtScan, technicianId,
  technicianNameAtScan, at, event, station, tech}`. `station`/`tech` conservés =
  snapshot immuable (compat lecteurs existants).
- `renameStage()` : modifie **uniquement** `stageDefinitions[].label`. Ne touche
  jamais aux `scanEvents` ni à `o.station`.
- `deleteStage()` : `active:false` (jamais de suppression physique si utilisé en
  historique). N'altère pas les `scanEvents`.
- `addStage()` / `reorderStages()` : opèrent sur `stageDefinitions`.
- **Supprimer** la constante `STAGES` du fonctionnement courant (garder comme
  seed labels par défaut uniquement).

### C. Source de vérité localisation
- Canoniser : `getConfirmedStage(orderId)`, `getConfirmedTechnician(orderId)`,
  `getConfirmedScanTime(orderId)` (label + id + timestamp, `confirmed:bool`).
- `effectiveStation(o)` : **retirer** la préférence `boardStation`. Retourne le
  stage confirmé par scan, sinon `null` (pas de repli sur `o.station`).
- **Supprimer le drag & drop des commandes** (`moveOrderToStage`, câblage DnD des
  cartes). Le scan est le seul mécanisme de progression physique.
- **Production** : cartes réparties selon le dernier scan. Bloc
  « Sans localisation confirmée » pour les commandes sans scan.
- **Quick View** : distinguer « Localisation confirmée » et « Prochaine étape
  prévue » (planifié). Ne jamais fusionner.
- Config des postes (rename/add/reorder/désactiver) conservée = configuration du
  FLUX, pas de l'historique.

### D. Clock
- `const Clock = { mode:'demo', demoDate, now(){...} }`. Modes DEMO / REAL.
- Router `baseNow` et tous les `new Date()` de logique métier (scan, messages,
  audit, congés, création commande) via `Clock.now()`.

### Migration localStorage
- Nouvelle clé : `dentalflow-next-mockup-state-v4`.
- `migrateStateV3toV4(oldState)` best-effort ; sinon détection incompatible →
  **reseed propre**. Jamais de crash sur ancien état.

---

## P1 — Cohérence (phase 2)

### E. Modèle état + flags
- `order.productionState ∈ {active, ready, completed}`.
- `order.flags = {late, blocked, scanExpected}` (booléens, cumulables).
- Helpers : `getOrderProductionState`, `isOrderLate/Blocked/Ready/Completed`,
  `needsAttention`, `orderFlags`. Utilisés partout (KPI, donut, alertes, table).
- late + blocked peuvent coexister → une seule carte « À surveiller », motif
  principal + « +1 autre signal ».
- Donut : catégories exclusives (En production / Prêtes / Bloquées / Terminées).
  Pas de « À scanner » dans la répartition.

### F. Navigation simplifiée
- Principale : **Accueil, Commandes, Production, Messages**.
- Groupe « Outils » (repliable) : Plan de charge, Stocks, Rapports, Utilisateurs.
- **Supprimer le drag & drop du menu** (`setupNavDnD`, `draggable`, `navOrder`).
- Conserver la sidebar repliable.

### G. Mode staff
- Écran par défaut = **DentalFlow Scan**. Pas de choix de page.
- « Mes congés » déplacé en secondaire (lien header / menu), pas au même niveau
  que Scan.

---

## P2 — Portail, delivery, cleanup (phase 3)

### H. Portail cabinet simplifié
- `getDentistFacingStatus(order)` : Réception→Reçue ; Design/Usinage/Céramique→
  Fabrication en cours ; Contrôle qualité→Contrôle ; Prêtes→Prête ;
  completed→Livrée.
- Ne pas montrer technicien / heure de scan / poste interne détaillé.

### I. Date de livraison
- `getAvailableDeliveryDates(orderType)` central (délai métier + charge engagée +
  jours ouvrés). `proposedDeliveries()` s'appuie dessus. 3 dates (Au plus tôt /
  Recommandée / Confort).

### J. Cleanup
- Emails `@planzy.fr` → `@dentalflow-demo.fr`. Aucune marque Planzy.
- Pièces jointes : max **2 Mo/fichier**, max **5 par conversation**, message
  d'erreur clair.
- Supprimer code/CSS mort (`.footer-settings`, drawer inutilisé, handlers/vars
  obsolètes) **uniquement si certain**.
- Réorganiser le JS en blocs commentés : CONFIG / CLOCK / STATE / MIGRATION /
  DATA MODEL / ORDERS / STAGES / SCAN / MESSAGING / PLANNING / STOCKS / REPORTS /
  STAFF / DENTIST PORTAL / PERSISTENCE / UI PRIMITIVES / ROUTING / EVENTS / BOOT.

---

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Casse des lecteurs de `o.status` | Conserver `o.status` dérivé en compat + router via helpers |
| Casse des lecteurs de `e.station`/`e.tech` | Conservés comme snapshot immuable dans le scanEvent |
| `effectiveStation` renvoie `null` | Adapter grouping/tri/production pour gérer « non confirmé » |
| Ancien localStorage | Nouvelle clé v4 + reseed si incompatible |
| Régression visuelle dark mode | Tests Playwright light + dark |

---

## Plan de test (Playwright + revue)

- **P0 privacy** : aucun `patientFirst/Last` dans le rendu ni localStorage ; QR = `CMD-*`.
- **P0 historique** : scan → renommer poste → historique inchangé ; désactiver poste → historique inchangé.
- **P0 localisation** : commande sans scan = « non confirmée » ; après scan = poste + tech + heure.
- **P1 statuts** : commande active+late+blocked → KPI retard+1 & bloquées+1 ; 1 carte à surveiller avec 2 signaux.
- **P1 horloge** : scan/messages/audit/planning/livraison via `Clock.now()`.
- **P1 nav** : principale = Accueil/Commandes/Production/Messages ; Outils = reste ; pas de DnD menu.
- **P1 cabinet** : statut simplifié, pas de technicien/scan interne.
- **P1 staff** : ouvre Scan ; congés secondaire.
- **Non-régression** : toutes les vues + QR + impression + dark, zéro erreur console.

---

## Livrables
- `dentalflow-next-poc-v3.3.html`
- `V3_3_CLEANUP_PLAN.md` (ce document)
- `V3_3_TEST_REPORT.md`
- `V3_3_CHANGELOG.md`
