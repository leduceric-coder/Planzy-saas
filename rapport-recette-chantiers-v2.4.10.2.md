# Recette Chantiers Kanvix V2.4.10.2

Audit **en lecture seule** de `public/poc/kanvix-next-gen-v2.4.10.2.html`. **Aucune ligne du POC n'a été modifiée** (vérifié : `git status` propre sur le fichier). Les défauts sont observés, reproduits, classés et documentés ; les corrections feront l'objet d'une version distincte.

## Verdict

**PASS AVEC RÉSERVES.**

La gestion des chantiers est **solide et fiable** : portfolio cohérent, création sans état partiel, **isolation stricte des données** (Aujourd'hui / À venir / Documents / Photos / Équipe / Planning scopés au bon chantier), cycle de vie complet sans perte de données ni référence orpheline, lecture seule inviolable (closed + archived), clôture guidée, suppressions protégées, synchro multi-onglets, responsive sans scroll de page, **0 erreur console**.

**Une seule réserve — et elle bloque le gel de Chantiers :** l'onglet **« Historique »** de la fiche chantier affiche l'historique **global** (`app.history`), donc les événements d'**autres** chantiers apparaissent comme s'ils appartenaient au chantier consulté. Cela viole le critère §94 « Historique correctement contextualisé ».

### Réponse à la question centrale (§2)

> « Un conducteur peut-il créer, suivre, clôturer puis retrouver un chantier sans perdre de données, sans mélanger les informations entre chantiers et sans sortir inutilement de son contexte ? »

**OUI pour les données opérationnelles** (tâches, documents, photos, équipe, planning, cycle de vie) — parfaitement isolées et préservées. **NON pour l'onglet Historique**, qui présente l'activité de tous les chantiers. C'est le seul point de mélange de données, et il doit être corrigé avant gel.

## Scénarios maîtres SITE-F1 → SITE-F10

| Scénario | Intitulé | Priorité | Verdict |
|---|---|---|---|
| SITE-F1 | Portfolio (Actifs / Clôturés / Archives) | P0 | **PASS** |
| SITE-F2 | Création vierge (+ Undo, pas d'état partiel) | P0 | **PASS** |
| SITE-F3 | Reprendre un chantier en cours | P0 | **PASS** (wizard + garde dates) |
| SITE-F4 | Cockpit (onglets scopés) | P0 | **PASS** |
| SITE-F5 | Historique isolé | P0 | **FAIL** (SITE-01 — historique global) |
| SITE-F6 | Lifecycle complet | P0 | **PASS** |
| SITE-F7 | Lecture seule closed/archived | P0 | **PASS** |
| SITE-F8 | Clôture guidée | P1 | **PASS** |
| SITE-F9 | Suppression (vide + définitive) | P0 | **PASS** |
| SITE-F10 | Responsive / Dark | P1 | **PASS** |

## Portfolio

Onglet Actifs : cartes = chantiers actifs, résumé « N chantiers · risques · à surveiller · sous contrôle · à configurer ». Bascule Actifs / Clôturés / Archives instantanée, compteurs cohérents. **Aucun chantier présent dans deux cycles de vie à la fois.** Cartes affichant nom / lieu / phase / état / prochaine intervention / équipe, données issues du bon chantier uniquement.

## Création

`+ Chantier` ouvre un **sidewindow** à 3 choix (Partir de zéro / Utiliser un modèle / Reprendre un chantier en cours). **Annuler ne crée rien** (0 projet/tâche). Création vierge : chantier actif, **aucune tâche inventée**, 0 orpheline, **Undo** retire le chantier. Le mode « Reprendre un chantier en cours » comporte une garde de dates (date de fin d'intervention antérieure à aujourd'hui → refus).

## Cockpit

La synthèse change selon l'état réel (danger / warning / success / à configurer / prêt à clôturer). Zones « À traiter » (incident principal + impact + liens), « Prochaine étape » (jalon), visuel. Aucune donnée hardcodée d'un autre chantier dans le cockpit.

## Aujourd'hui / À venir

Onglets rendus, scopés au chantier via `getUpcomingTasks(id)` / `projectToday(id)` / `projectUpcomingTimeline(id)`. Aucune tâche d'un autre chantier n'apparaît.

## Documents / Photos

`projectDocuments(id)` / `projectPhotos(id)` filtrent par `projectId` : **aucun document ni photo d'un autre chantier**. Sur chantier closed/archived, l'accès en ajout/modification est bloqué (voir Lecture seule).

## Planning / Équipe

Onglet Planning : `app.ui.planningProject` est positionné sur le bon chantier (`keravel`) → l'ouverture du planning complet est **filtrée sur le chantier**. Onglet Équipe : ressources réellement affectées aux tâches à venir, **aucun faux profil « Non affecté »** (bloc dédié uniquement s'il existe une tâche sans ressource).

## Historique — RÉSERVE PRINCIPALE

`projectTabContent("Historique", id)` appelle `historyHTML()` **sans passer d'`id`** ; `historyHTML()` parcourt `app.history` **globalement**. Reproduit : après un événement sur Keravel (« KERAVEL-EVT ») et un événement sur Les Terrasses (« TERRASSES-EVT »), l'onglet Historique de **Keravel** contient **« TERRASSES-EVT »**, et le rendu est **identique** d'un chantier à l'autre. → **SITE-01 (MAJOR, bloquant pour le gel)**.

## Lifecycle

Séquence testée : `active → closed → active → closed → archived → closed → active` = exactement `['closed','active','closed','archived','closed','active']`. **restore ⇒ closed** (jamais active), **reopen ⇒ active**, `closedAt`/`archivedAt` retirés en fin de réactivation. **Aucune donnée perdue** (tâches/documents/photos identiques avant/après), **0 référence orpheline**.

## Readonly

Sur closed **et** archived : `guardEditable = false` ; `openProjectEdit`, `openTaskForm`, `openTaskEdit`, `setTaskStatus`, `requestGanttTaskMove` **refusés** ; nom / tâches / documents / photos / statut / dates **inchangés**. Lecture seule intégrale et inviolable.

## Clôture

`closeProjectPrompt` signale les tâches non terminées et points ouverts, propose « Clôturer quand même » → `closed` **sans supprimer aucune donnée** (tout reste consultable). Jalon final : ne ferme jamais automatiquement le chantier (proposition seulement).

## Suppression

- Chantier **vide** → « Supprimer » proposé ; suppression + **snapshot Undo** ; Undo restaure.
- Chantier **non vide** → pas de suppression simple (menu sans « Supprimer »).
- Archive → **« Supprimer définitivement »** avec **confirmation par saisie du nom** (bouton désactivé tant que le nom n'est pas saisi). `deleteProjectCascade` retire tâches, dépendances, incidents, décisions, jalons, documents, photos, messages, projet → **0 référence orpheline**.

## Responsive

1920 → 390 : liste **et** cockpit sans scroll horizontal de page (le contenu large scrolle en interne). Cartes lisibles à 390/430.

## Dark

Liste, cockpit, onglets, wizard, menus, documents, photos, closure, archives : lisibles (capture Q).

## Accessibilité

Cartes chantier : `role="button"` + `tabindex="0"` + activation Entrée/Espace ; menus `•••` en boutons natifs ; onglets lifecycle et cockpit cliquables. (Audit visuel/clavier ; pas de blocage constaté.)

## Intégrité

Après chaque mutation lifecycle et chaque suppression : **0 référence orpheline** (projets/tâches/deps/incidents/décisions/jalons/documents/photos/messages). IDs projets uniques.

## Undo

Création, suppression chantier vide → Undo restaure. Clôture / réouverture / archivage / restauration posent un snapshot (`actionToast` « Annuler disponible »).

## Sync

Clôturer un chantier dans l'onglet A se reflète dans l'onglet B **sans F5** (localStorage + BroadcastChannel).

## Findings

### SITE-01 — L'onglet « Historique » de la fiche chantier est global

| Champ | Détail |
|---|---|
| **ID** | SITE-01 |
| **Sévérité** | **MAJOR** — bloquant pour le gel de Chantiers (§94 « Historique correctement contextualisé ») |
| **Scénario** | SITE-F5 (§33 / §34) |
| **Étapes** | Pilotage → éditer une tâche de Keravel (« KERAVEL-EVT ») → éditer une tâche des Terrasses (« TERRASSES-EVT ») → ouvrir Keravel → onglet **Historique**. |
| **Observé** | L'historique de Keravel contient **« TERRASSES-EVT »** (événement d'un autre chantier) ; le rendu de l'onglet Historique est **identique** pour Keravel et pour Les Terrasses. `projectTabContent("Historique")` (ligne ~12155) appelle `historyHTML()` (ligne ~13643) qui parcourt `app.history` **sans aucun filtre par chantier**. |
| **Attendu** | L'onglet doit se limiter aux événements du chantier courant (filtrage par `projectId` via les tâches du chantier — l'information existe : chaque entrée porte un `taskId`). |
| **Preuve** | `keravelShowsOther = true`, `identical = true` (suite `recette-chantiers-v2.4.10.2.mjs`, section SITE-F5). |
| **Capture** | `M-project-history.png` |

## Frictions UX

- **Historique global** (SITE-01) : au-delà du défaut de contexte, un conducteur multi-chantiers perd la lisibilité (tout l'historique se mélange).
- **Onglet Historique = même contenu partout** : sans indication de provenance, l'utilisateur ne peut pas savoir qu'un événement listé concerne un autre chantier.

## Gaps produit

- **Historique de tâche vs chantier vs global (§35)** : l'activité d'une tâche (`taskActivity`) est bien scopée dans la fiche tâche, mais il n'existe pas de véritable « historique du chantier » — l'onglet réutilise l'historique global. Un historique réellement contextualisé par chantier est le seul manque fonctionnel de la zone.
- **Purge d'historique à la suppression** : `deleteProjectCascade` ne purge pas `app.history` (observation) — non reproduit comme orphelin visible ici (`historyHTML` n'affiche pas `taskId`), mais une entrée pourrait conserver un `taskId` mort après suppression d'un chantier ayant des événements. À surveiller si un futur écran dérive le `taskId` de l'historique.

## Recommandations (max 5 — NON implémentées)

1. **Scoper l'onglet Historique** : `projectTabContent("Historique", id)` → `historyHTML(id)`, et filtrer `app.history` sur les tâches du chantier (`taskId ∈ getProjectTasks(id)`), plus éventuellement les entrées projet-level. Corrige SITE-01.
2. Afficher un **libellé de contexte** dans l'onglet (« Historique — <nom du chantier> ») pour lever toute ambiguïté.
3. **Purger `app.history`** des entrées liées aux tâches supprimées dans `deleteProjectCascade` (hygiène de données).
4. Envisager un **historique tâche** cliquable depuis l'historique chantier (traçabilité fine).
5. Rien d'autre : le reste de la zone Chantiers est prêt.

## Tableau de synthèse (§92)

| Zone | Fonctionnel | Métier | UX | Intégrité | Verdict |
|------|-------------|--------|----|-----------|---------|
| Portfolio | OK | OK | OK | OK | PASS |
| Création | OK | OK | OK | OK | PASS |
| Cockpit | OK | OK | OK | OK | PASS |
| Aujourd'hui | OK | OK | OK | OK | PASS |
| À venir | OK | OK | OK | OK | PASS |
| Documents | OK | OK | OK | OK | PASS |
| Photos | OK | OK | OK | OK | PASS |
| Planning | OK | OK | OK | OK | PASS |
| Équipe | OK | OK | OK | OK | PASS |
| Historique | OK | **KO** | Friction | OK* | **FAIL** (SITE-01) |
| Lifecycle | OK | OK | OK | OK | PASS |
| Readonly | OK | OK | OK | OK | PASS |

\* Intégrité référentielle OK ; le défaut Historique est un défaut de **contexte/scope d'affichage**, pas de corruption de données.

## Résumé final

- **Scénarios maîtres :** SITE-F1 ✅ · F2 ✅ · F3 ✅ · F4 ✅ · **F5 ❌** · F6 ✅ · F7 ✅ · F8 ✅ · F9 ✅ · F10 ✅.
- **Suite d'audit (`recette-chantiers-v2.4.10.2.mjs`) :** 48 assertions PASS / 0 FAIL.
- **Findings :** 1 — **MAJOR : 1** (SITE-01) · BLOCKER : 0 · MINOR : 0 · COSMETIC : 0.
- **Frictions UX :** 2 · **Gaps produit :** 2.
- **Erreurs console applicatives :** **0**.
- **Suites gelées (rejouées sur v2.4.10.2, POC inchangé) :** Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition **58/58** · Import **75/75** · ancien Planning **17/17** · Planning Bureau **76/76** · Résoudre dates **14/14** · PLAN-F1→F10 **10/10**.

**Conclusion :** la zone Chantiers est à un excellent niveau (isolation, cycle de vie, lecture seule, suppression, intégrité) **sauf** l'onglet Historique de la fiche chantier, qui affiche l'historique global. C'est le seul mélange de données entre chantiers et le seul obstacle au gel (§94). Une fois SITE-01 corrigé (version distincte), la zone Chantiers pourra être déclarée VALIDÉE.

## Livrables

1. `rapport-recette-chantiers-v2.4.10.2.md` — ce rapport.
2. `recette-chantiers-v2.4.10.2.mjs` — suite d'audit Playwright (48 vérifications + reproduction du finding).
3. Captures : `recette-chantiers/` (A→Q).

**La source `kanvix-next-gen-v2.4.10.2.html` reste strictement inchangée.**
