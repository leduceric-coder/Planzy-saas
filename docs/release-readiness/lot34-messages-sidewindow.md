# LOT 34 — Le vrai composant de messagerie : `MessagesSideWindow`

## Pourquoi le LOT 33 n'a pas corrigé la recette

Le bouton **« Message » de la barre latérale** appelle `onOpenMessages`
(`Sidebar` → `DashboardShell.setMessagesOpen(true)`) qui ouvre le composant
**`MessagesSideWindow`** (panneau latéral), **et non** la page `/messages`
(`MessagesView`) corrigée au LOT 33. Le LOT 33 a donc corrigé la « Vue complète »
mais pas la surface réellement utilisée.

`MessagesSideWindow` présentait **le même défaut** : liste construite depuis
`threads` (chantiers ayant déjà une conversation), et le composant ne recevait
même pas la liste des chantiers (`projects`).

## Évidence (read-only, `qmuo`)

| Statut | Chantiers | Avec thread | Avec messages |
|---|---|---|---|
| active | 14 | **4** | 4 |
| paused | 1 | 0 | 0 |
| archived | 2 | 0 | 0 |

→ La side window n'affichait que ~4 chantiers (ceux ayant un thread) sur 14 actifs.

## Correctif (`components/messages/MessagesSideWindow.tsx`)

- Le panneau **charge lui-même** la liste des chantiers accessibles à l'ouverture :
  `projects` (`org_id` + `status != 'archived'`, tri par nom) — en plus des
  `threads` et `messages`. RLS filtre déjà par organisation.
- **Conversations** = tous les chantiers (`projects`) ∪ threads sans chantier
  actif correspondant (directs / projets non actifs). Clé stable `project:<id>`
  / `thread:<id>`. Sélection par **`projectId`**, jamais par `thread.id`.
- Un chantier **sans message** est visible (« Aucun message ») et **sélectionnable** ;
  l'envoi réutilise le chemin existant (`project_id` + `thread_id` optionnel) →
  un chantier sans thread reçoit son 1er message (comme la messagerie de la fiche).
- Tri par activité récente puis alphabétique. Lien « Vue complète » →
  `/messages?project=<id>` (cohérent avec le deep-link corrigé au LOT 33).

## Chantiers exclus (documenté)

- **Archivés** : exclus (`status != 'archived'`), cohérent avec la logique métier.
- **Actifs / en pause / terminés (non archivés)** : visibles.
- **Autre organisation** : jamais visibles (RLS + `org_id`).

## « Non-lus »

Inchangé : aucun libellé « non lu » (pas de modèle `read_at` en base). La side
window n'affiche pas de compteur de non-lus ; le badge de navigation reste
« messages récents » (`getAlertsSummary`). Vrai suivi lu/non-lu = lot schéma dédié.

## Fonctions pures testables (rappel)

`resolveStorageUrl` (LOT 33) reste la fonction pure de référence. La construction
des conversations est déterministe (projects ∪ threads, clé par projectId, tri par
dernière activité) — cas couverts : 14 projets / 4 threads → 14 conversations ;
projet sans message → visible ; projet archivé → exclu ; autre org → absent (RLS) ;
`project.id` ≠ `thread.id` → sélection par `projectId` uniquement.
