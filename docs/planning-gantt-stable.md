# Gantt Planning — État stable (LOT 5.R-quater)

État validé utilisateur. Commit de référence : `eed2d72`.

---

## Architecture générale

**Fichiers principaux**

| Fichier | Rôle |
|---|---|
| `components/planning/GanttView.tsx` | Composant principal — toolbar, filtres, vue Global (par projet) et vue Par artisan |
| `components/planning/GanttArtisanView.tsx` | Vue Par artisan — reçoit `rangeStart/rangeEnd/totalDays` via props depuis GanttView |
| `components/planning/useGanttDrag.ts` | Hook drag/resize — **gelé, non appelé**. Seul `parseDBDate` en est importé |
| `components/planning/TaskSidePanel.tsx` | Panneau latéral d'édition inline (title, dates, artisan, priorité, description) |

---

## Scroll unique

Le Gantt utilise **un seul container `overflow: auto`** qui scroll les deux axes.

```
<div class="flex-1 overflow-auto min-h-0">   ← scroll unique
  <div style={{ width: totalWidth }}>         ← largeur totale (LEFT_COL_WIDTH + totalDays * dayW)
    <div class="sticky top-0 z-30">           ← header sticky
    <div class="flex" per row>
      <div class="sticky left-0 z-20">        ← colonne gauche sticky per-row
      <div class="relative">                  ← zone barres
```

**Ne pas revenir à deux scrolls synchronisés.** La synchronisation par `scrollTop` (LOT 5.2) provoquait un décalage progressif au-delà de la hauteur du header. Le scroll unique élimine ce bug structurellement.

---

## Hiérarchie de z-index

| Valeur | Élément |
|---|---|
| `z-40` | Coin header (sticky top + left) |
| `z-30` | Header row (sticky top) |
| `z-20` | Colonne gauche par ligne (sticky left) |
| `z-[5]` | Ligne Aujourd'hui |
| défaut | Barres de tâches, fonds de mois |

---

## Structure de l'en-tête (HEADER_HEIGHT = 56px)

```
HEADER_HEIGHT = MONTH_ROW_HEIGHT (20px) + DAY_ROW_HEIGHT (36px)
```

**Row 1 — Mois (20px)**
- Un bloc `absolute` par mois (`monthSegments`)
- Séparateur `w-0.5 bg-border` à gauche de chaque bloc (sauf le premier)
- Le séparateur **ne traverse pas** le label — il est cantonné dans Row 1
- Alternance fond pair/impair `bg-foreground/[0.03]`

**Row 2 — Jours/semaines (36px)**
- `zoom=day` : lettre du jour + numéro
- `zoom=week` : numéro de semaine ISO (`S23`, `S24`…) sur les lundis uniquement
- `zoom=month` : cellules vides (Row 1 suffit)
- Repères lundi `bg-border/30` discrets (hors 1er du mois, déjà marqué par le séparateur de mois)

---

## Calcul rangeStart / rangeEnd

La plage de la grille s'adapte dynamiquement pour couvrir toutes les tâches filtrées datées.

```ts
// Borne de base — 14 jours avant aujourd'hui, 90 jours après
const baseStart = addDays(today, -14 + viewOffset)
const baseEnd   = addDays(today,  90 + viewOffset)

// Extension si des tâches dépassent la base
// taskBounds = { minT, maxT } — min/max des start_date/end_date des tâches filtrées
const rangeStart = taskBounds.minT < baseStart ? addDays(taskBounds.minT, -14) : baseStart
const rangeEnd   = taskBounds.maxT > baseEnd   ? addDays(taskBounds.maxT,  30) : baseEnd
```

**Invariant garanti :** toute barre rendue dans le Gantt est toujours couverte par `monthSegments`, `weekStarts`, et la grille journalière — aucune barre ne peut flotter dans une zone blanche.

`GanttArtisanView` reçoit `rangeStart`/`rangeEnd`/`totalDays` via props et hérite automatiquement de cette logique.

---

## monthSegments

```ts
type MonthSegment = { label: string; left: number; width: number; isOdd: boolean }
```

Calculé par `useMemo([rangeStart, rangeEnd, dayW])` — itère `eachDayOfInterval` et regroupe les jours par mois calendaire via `getMonthBandIndex(date) = year * 12 + month`.

Utilisé deux fois :
1. **Header Row 1** — blocs de mois visuels
2. **Data rows** — fond alternant + séparateur vertical `bg-border/60` entre mois

---

## weekStarts

Tableau d'offsets en pixels (px depuis le bord gauche de la zone calendrier) pour chaque lundi **qui n'est pas le 1er du mois** (le 1er est déjà marqué par le séparateur de mois).

Utilisé pour des traits `bg-border/30` (header) et `bg-border/20` (data rows).

---

## Constantes

```ts
const DAY_WIDTH = { day: 40, week: 16, month: 6 }   // px par jour selon le zoom
const VIEW_STEP = { day: 7, week: 30, month: 90 }    // jours de déplacement par clic nav
const MONTH_ROW_HEIGHT = 20   // px — Row 1 header
const DAY_ROW_HEIGHT   = 36   // px — Row 2 header
const HEADER_HEIGHT    = 56   // = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT (ne pas modifier séparément)
const ROW_HEIGHT       = 44   // px — hauteur de chaque ligne de tâche/artisan
const LEFT_COL_WIDTH   = 280  // px — largeur de la colonne gauche sticky
```

---

## Fonctions actives

| Fonction | État |
|---|---|
| Affichage des barres (positionnement par dates) | ✅ Actif |
| Clic barre → TaskSidePanel | ✅ Actif |
| Édition inline dans TaskSidePanel (titre, dates, artisan, priorité, description) | ✅ Actif |
| Sauvegarde Supabase via `mutationClient()` (RLS ON) | ✅ Actif |
| Filtres projet / artisan / statut / terminées / sans dates | ✅ Actif |
| Vue Global (par projet) | ✅ Actif |
| Vue Par artisan | ✅ Actif |
| Plein écran | ✅ Actif |
| Section Tâches à planifier (sans dates) | ✅ Actif |
| Bouton Planifier → ouvre TaskSidePanel en mode édition | ✅ Actif |
| Alertes planning (retard, blocage, chevauchement) | ✅ Actif |
| Navigation temporelle (Précédent / Aujourd'hui / Suivant) | ✅ Actif |
| Zoom (Jour / Semaine / Mois) | ✅ Actif |
| Tooltip survol barre | ✅ Actif |

---

## Fonctions volontairement gelées

| Fonction | Raison |
|---|---|
| **Drag (déplacement de barre)** | Trop de régressions (LOT 5.5/5.6/5.7). Désactivé en LOT 5.S. Les handlers existent dans `useGanttDrag.ts` mais ne sont pas câblés. |
| **Resize (poignées gauche/droite)** | Même raison que drag. |
| **Ghost bar (visualisation pendant drag)** | Supprimé avec drag. |
| **Undo toast lié au drag/resize** | Supprimé avec drag. |

**`useGanttDrag.ts` est conservé en l'état** pour `parseDBDate` qui est importé dans les deux vues. Le reste du hook (états `drag`, `startMove`, `startResizeLeft`, `startResizeRight`) n'est pas utilisé.

---

## Règles à respecter pour les évolutions futures

1. **Ne pas remplacer le scroll unique** par deux scrolls synchronisés — la synchronisation `scrollTop` provoque un décalage irréductible.
2. **rangeStart/rangeEnd doivent toujours couvrir toutes les tâches visibles** — toute extension de la fenêtre doit conserver le `max(baseEnd, maxTaskEnd + marge)`.
3. **HEADER_HEIGHT reste 56px** — la ligne Aujourd'hui et l'alignement vertical dépendent de `top: HEADER_HEIGHT`.
4. **Réactivation drag/resize** — si réactivée, utiliser le hook existant dans `useGanttDrag.ts`, ne pas réécrire depuis zéro. Tester sur une branche dédiée avant merge.
5. **RLS toujours activé** — ne jamais passer `service_role` côté client.
6. **TypeScript 0 erreur obligatoire** avant tout push.
