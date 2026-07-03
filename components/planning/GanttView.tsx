'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { addDays, format, differenceInDays, startOfDay, eachDayOfInterval, getISOWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Calendar, ChevronDown,
  ChevronRight as ChevronRightSm, AlertTriangle, Check,
  Maximize2, Minimize2, Undo2, Redo2, SlidersHorizontal,
  Plus, RotateCcw, Inbox,
} from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate, hexToRgba } from '@/lib/utils'
import type { Task, TaskStatus } from '@/lib/types'
import { TaskSidePanel, type TaskUpdatePatch } from '@/components/planning/TaskSidePanel'
import { useUndoHistory } from '@/lib/hooks/useUndoHistory'
import { GanttArtisanView } from '@/components/planning/GanttArtisanView'
import { parseDBDate } from '@/components/planning/useGanttDrag'
import { mutationClient } from '@/lib/supabase/mutate'
import { useToast } from '@/components/ui/toast-context'

type DepEdge = { task_id: string; depends_on_task_id: string }

type GanttTask = Task & {
  assignee?: { id: string; full_name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

interface Props {
  tasks: GanttTask[]
  projects: { id: string; name: string; color: string }[]
  artisans?: { id: string; full_name: string; color: string }[]
  teams?: { id: string; name: string; color: string | null; type: string | null; memberCount: number }[]
  undatedTasks?: GanttTask[]
  /** Deep-link: open this task's side-window on mount (from dashboard / week preview). */
  initialFocusTaskId?: string
  /** LOT 27E — ouvre la modale « Nouvelle tâche » (fournie par PlanningTabs) depuis l'état vide. */
  onNewTask?: () => void
}

const DAY_WIDTH = { day: 40, week: 16, month: 6 }
const VIEW_STEP = { day: 7, week: 30, month: 90 }

const MONTH_ROW_HEIGHT = 20
const DAY_ROW_HEIGHT = 36
const HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT // 56 — unchanged
const ROW_HEIGHT = 44
const LEFT_COL_WIDTH = 280

// ─── Month helpers ─────────────────────────────────────────────────────────────

function getMonthBandIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

// ─── Statuts terminés ─────────────────────────────────────────────────────────
// TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done' | 'validated'
// 'done' et 'validated' sont les deux statuts non-opérationnels :
// ils ne génèrent plus d'alertes de chevauchement ou de retard.
function isTaskCompleted(t: { status: string }): boolean {
  return t.status === 'done' || t.status === 'validated'
}

// ─── Conflict detection ────────────────────────────────────────────────────────

type ConflictType = 'late' | 'blocked' | 'overlap' | 'dependency'

interface Conflict {
  type: ConflictType
  taskId: string
  message: string
  /**
   * - 'dependency' conflicts → the predecessor task id.
   * - 'overlap' conflicts (LOT 15.E) → the peer task id the artisan also works on,
   *   so the alert can be opened in analysis mode (needs both task ids).
   */
  parentId?: string
}

function computeConflicts(dated: GanttTask[], undated: GanttTask[], today: Date): Conflict[] {
  const result: Conflict[] = []

  for (const t of dated) {
    if (t.end_date && new Date(t.end_date) < today && t.status !== 'done' && t.status !== 'validated') {
      result.push({ type: 'late', taskId: t.id, message: `"${t.title}" est en retard — échéance dépassée` })
    }
  }

  for (const t of [...dated, ...undated]) {
    if (t.status === 'blocked') {
      result.push({ type: 'blocked', taskId: t.id, message: `"${t.title}" est bloquée${t.project ? ` (${t.project.name})` : ''}` })
    }
  }

  const byArtisan = new Map<string, GanttTask[]>()
  for (const t of dated) {
    // Only operational tasks (not done/validated) can generate overlap alerts
    if (t.assignee && t.start_date && t.end_date && !isTaskCompleted(t)) {
      const list = byArtisan.get(t.assignee.id) ?? []
      list.push(t)
      byArtisan.set(t.assignee.id, list)
    }
  }

  const seenPairs = new Set<string>()
  byArtisan.forEach(artTasks => {
    for (let i = 0; i < artTasks.length; i++) {
      for (let j = i + 1; j < artTasks.length; j++) {
        const a = artTasks[i], b = artTasks[j]
        const aStart = new Date(a.start_date!), aEnd = new Date(a.end_date!)
        const bStart = new Date(b.start_date!), bEnd = new Date(b.end_date!)
        if (aStart <= bEnd && bStart <= aEnd) {
          const pairKey = [a.id, b.id].sort().join(':')
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey)
            const name = a.assignee!.full_name
            const msg = `${name} est assigné(e) à "${a.title}" et "${b.title}" sur la même période`
            result.push({ type: 'overlap', taskId: a.id, parentId: b.id, message: msg })
            result.push({ type: 'overlap', taskId: b.id, parentId: a.id, message: msg })
          }
        }
      }
    }
  })

  return result
}

// ─── LOT 15.E — Planning alert model ─────────────────────────────────────────
//
// Structured, UX-facing view of a Conflict: severity, plain-language explanation
// and a single primary action. Built in-memory from `uniqueConflicts` — no schema
// change, no extra fetch. Drives the "Alertes & résolution" panel.

type PlanningAlertKind = 'late' | 'blocked' | 'overlap' | 'dependency' | 'undated'
type AlertSeverity = 'high' | 'medium' | 'info'
/** How the primary action behaves. */
type AlertMode = 'open' | 'analyze' | 'analyze-dep' | 'plan'

interface PlanningAlert {
  id: string
  conflict: Conflict
  kind: PlanningAlertKind
  severity: AlertSeverity
  taskTitle: string
  projectName?: string
  assigneeName?: string
  startDate?: string | null
  endDate?: string | null
  explain: string
  actionLabel: string
  mode: AlertMode
  /** For 'plan' — the task that lacks dates and must be scheduled. */
  planTaskId?: string
  /** Peer (overlap) or predecessor (dependency) id, for analysis mode. */
  otherId?: string
}

const KIND_META: Record<PlanningAlertKind, {
  icon: string; label: string; chip: string; badge: string
}> = {
  late:       { icon: '⏰', label: 'Retard',        chip: 'bg-red-500/10 text-red-600 dark:text-red-400',        badge: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  blocked:    { icon: '🚫', label: 'Bloquée',       chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  overlap:    { icon: '🔻', label: 'Chevauchement', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',   badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  dependency: { icon: '🔗', label: 'Dépendance',    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  undated:    { icon: '📅', label: 'Sans dates',    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',         badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
}

const SEVERITY_META: Record<AlertSeverity, { label: string; cls: string; dot: string }> = {
  high:   { label: 'Prioritaire', cls: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' },
  medium: { label: 'À vérifier',  cls: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  info:   { label: 'À planifier', cls: 'text-sky-600 dark:text-sky-400',    dot: 'bg-sky-500' },
}

const SUMMARY_ORDER: PlanningAlertKind[] = ['late', 'blocked', 'overlap', 'dependency', 'undated']
const summaryLabel: Record<PlanningAlertKind, (n: number) => string> = {
  late:       n => `retard${n > 1 ? 's' : ''}`,
  blocked:    n => `bloquée${n > 1 ? 's' : ''}`,
  overlap:    n => `chevauchement${n > 1 ? 's' : ''}`,
  dependency: n => `dépendance${n > 1 ? 's' : ''}`,
  undated:    () => `sans dates`,
}

// ─── Component ─────────────────────────────────────────────────────────────────
//
// SCROLL : un seul container overflow:auto (flex-1 overflow-auto min-h-0).
// Ne pas revenir à deux scrolls synchronisés — la sync scrollTop provoque
// un décalage progressif irréductible au-delà de la hauteur du header.
//
// DRAG / RESIZE : volontairement désactivés (LOT 5.S). Le hook useGanttDrag
// est conservé pour parseDBDate uniquement. Ne pas recâbler startMove /
// startResizeLeft / startResizeRight sans branche dédiée + recette complète.
//
// RANGE : rangeStart/rangeEnd doivent toujours couvrir toutes les tâches
// visibles (taskBounds). Ne pas revenir à une fenêtre fixe [today-14, today+90].

export function GanttView({ tasks, projects, artisans = [], teams = [], undatedTasks = [], initialFocusTaskId, onNewTask }: Props) {
  // Local tasks state — optimistic updates from sidewindow edits
  const [localTasks, setLocalTasks] = useState<GanttTask[]>(tasks)
  // Sync with server after refresh
  useEffect(() => { setLocalTasks(tasks) }, [tasks])

  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week')
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)
  const [autoEditTaskId, setAutoEditTaskId] = useState<string | null>(null)

  // Deep-link: open the targeted task's side-window on mount. The existing
  // auto-scroll effects then bring its bar into view.
  useEffect(() => {
    if (!initialFocusTaskId) return
    const t = tasks.find(t => t.id === initialFocusTaskId)
      ?? undatedTasks.find(t => t.id === initialFocusTaskId)
    if (t) setSelectedTask(t)
    // run once on mount for the provided deep-link target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [filterProject, setFilterProject] = useState('all')
  const [filterArtisan, setFilterArtisan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showUndated, setShowUndated] = useState(true)
  const [viewOffset, setViewOffset] = useState(0)
  const [pendingScrollToToday, setPendingScrollToToday] = useState(false)
  const [undatedOpen, setUndatedOpen] = useState(true)
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tooltip, setTooltip] = useState<{ task: GanttTask; x: number; y: number } | null>(null)
  const [ganttMode, setGanttMode] = useState<'project' | 'artisan'>('project')
  const [showDeps, setShowDeps] = useState(true)
  const [dependencies, setDependencies] = useState<DepEdge[]>([])
  // LOT 6.E — Alert analysis mode: entered by clicking a dependency conflict.
  // While active, the Gantt dims non-affected bars, scrolls to both tasks,
  // highlights the arc, and shows a compact panel instead of the sidewindow.
  const [activeAlert, setActiveAlert] = useState<{
    childId: string
    parentId: string
    // 'artisan_overlap' (LOT 15.E): two tasks share an artisan over the same period.
    // The others are dependency sub-types.
    type: 'overlap' | 'inverted' | 'missing' | 'artisan_overlap'
  } | null>(null)
  // After a date edit, the task may have moved outside the current viewport.
  // We auto-scroll horizontally so it stays visible — fixes the
  // "task disappears after date change" report (LOT 6.C.1).
  const [pendingScrollTaskId, setPendingScrollTaskId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeKindFilter, setActiveKindFilter] = useState<PlanningAlertKind | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const analysisPanelRef = useRef<HTMLDivElement | null>(null)
  const { push: historyPush, handleUndo, handleRedo, canUndo, canRedo, undoLabel, redoLabel } = useUndoHistory()
  const { toast } = useToast()

  const fetchDependencies = useCallback(async () => {
    const { data, error } = await mutationClient()
      .from('task_dependencies')
      .select('task_id, depends_on_task_id')
    if (!error) setDependencies((data ?? []) as DepEdge[])
  }, [])

  useEffect(() => { fetchDependencies() }, [fetchDependencies])

  // LOT 6.C.5 — Focus mode for dependency arrows.
  // When a task is selected, only its direct upstream/downstream links are drawn,
  // and connected task bars get a halo. Without selection, only normal FS links
  // are shown (very discrete); warning links are hidden to keep the chart readable.
  const selectedId = selectedTask?.id ?? null
  const connectedTaskIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const ids = new Set<string>()
    for (const d of dependencies) {
      if (d.task_id === selectedId) ids.add(d.depends_on_task_id)
      if (d.depends_on_task_id === selectedId) ids.add(d.task_id)
    }
    return ids
  }, [dependencies, selectedId])

  // LOT 6.E — ids of the two tasks involved in the active alert
  const alertHighlightIds = useMemo(() => {
    if (!activeAlert) return new Set<string>()
    return new Set([activeAlert.childId, activeAlert.parentId])
  }, [activeAlert])

  const today = startOfDay(new Date())
  const dayW = DAY_WIDTH[zoom]

  // Compute task date bounds from visible tasks so the grid always covers them
  const taskBounds = useMemo(() => {
    let minT: Date | null = null
    let maxT: Date | null = null
    for (const t of localTasks) {
      if (filterProject !== 'all' && t.project_id !== filterProject) continue
      if (filterArtisan !== 'all' && t.assignee?.id !== filterArtisan) continue
      if (filterStatus !== 'all' && t.status !== filterStatus) continue
      // LOT 27D — la case additive « terminées » ne s'applique que si AUCUN statut
      // explicite n'est choisi : sélectionner « Terminée » affiche alors UNIQUEMENT
      // les terminées (filtrage strict par statut).
      if (filterStatus === 'all' && !showCompleted && (t.status === 'done' || t.status === 'validated')) continue
      if (!t.start_date || !t.end_date) continue
      const s = parseDBDate(t.start_date)
      const e = parseDBDate(t.end_date)
      if (!minT || s < minT) minT = s
      if (!maxT || e > maxT) maxT = e
    }
    return { minT, maxT }
  }, [localTasks, filterProject, filterArtisan, filterStatus, showCompleted])

  const baseStart = addDays(today, -14 + viewOffset)
  const baseEnd = addDays(today, 90 + viewOffset)
  const rangeStart = taskBounds.minT && taskBounds.minT < baseStart
    ? addDays(taskBounds.minT, -14)
    : baseStart
  const rangeEnd = taskBounds.maxT && taskBounds.maxT > baseEnd
    ? addDays(taskBounds.maxT, 30)
    : baseEnd
  const totalDays = differenceInDays(rangeEnd, rangeStart)
  const todayOffset = differenceInDays(today, rangeStart)

  // Month segments: one entry per calendar month in the visible range
  // Used for the dedicated month header row AND for data-row background bands
  type MonthSegment = { label: string; left: number; width: number; isOdd: boolean }
  const monthSegments = useMemo((): MonthSegment[] => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    const segs: MonthSegment[] = []
    let segStart = 0
    let segIdx = getMonthBandIndex(days[0])
    for (let i = 1; i <= days.length; i++) {
      const nextIdx = i < days.length ? getMonthBandIndex(days[i]) : -1
      if (nextIdx !== segIdx) {
        segs.push({
          label: format(days[segStart], 'MMMM', { locale: fr }),
          left: segStart * dayW,
          width: (i - segStart) * dayW,
          isOdd: segIdx % 2 === 1,
        })
        segStart = i
        segIdx = nextIdx
      }
    }
    return segs
  }, [rangeStart, rangeEnd, dayW])

  // Monday offsets for weekly grid markers (excludes 1st-of-month, covered by month separator)
  const weekStarts = useMemo(() => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    const offsets: number[] = []
    for (let i = 1; i < days.length; i++) {
      if (days[i].getDay() === 1 && days[i].getDate() !== 1) offsets.push(i * dayW)
    }
    return offsets
  }, [rangeStart, rangeEnd, dayW])

  const navigatePrev = () => setViewOffset(v => v - VIEW_STEP[zoom])
  const navigateNext = () => setViewOffset(v => v + VIEW_STEP[zoom])
  const navigateToday = () => { setViewOffset(0); setPendingScrollToToday(true) }

  const hasActiveFilters = filterProject !== 'all' || filterArtisan !== 'all' || filterStatus !== 'all' || showCompleted
  const activeFiltersCount =
    (filterProject !== 'all' ? 1 : 0) +
    (filterArtisan !== 'all' ? 1 : 0) +
    (filterStatus !== 'all' ? 1 : 0) +
    (showCompleted ? 1 : 0)
  const resetFilters = () => {
    setFilterProject('all')
    setFilterArtisan('all')
    setFilterStatus('all')
    setShowCompleted(false)
  }

  const filteredTasks = useMemo(() =>
    localTasks.filter(t => {
      if (filterProject !== 'all' && t.project_id !== filterProject) return false
      if (filterArtisan !== 'all' && t.assignee?.id !== filterArtisan) return false
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterStatus === 'all' && !showCompleted && (t.status === 'done' || t.status === 'validated')) return false
      return true
    }),
    [localTasks, filterProject, filterArtisan, filterStatus, showCompleted]
  )

  const filteredUndated = useMemo(() =>
    undatedTasks.filter(t => {
      if (filterProject !== 'all' && t.project_id !== filterProject) return false
      if (filterArtisan !== 'all' && t.assignee?.id !== filterArtisan) return false
      return true
    }),
    [undatedTasks, filterProject, filterArtisan]
  )

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: GanttTask['project']; tasks: GanttTask[] }>()
    filteredTasks.forEach(t => {
      if (!map.has(t.project_id)) map.set(t.project_id, { project: t.project, tasks: [] })
      map.get(t.project_id)!.tasks.push(t)
    })
    // Stable sort by the canonical projects array (sorted alphabetically by name from the server).
    // Never sort by task dates — editing a date must not shift a project group vertically.
    // Fallback: alphabetical name, then id for complete determinism.
    const projectOrder = new Map(projects.map((p, i) => [p.id, i]))
    return [...map.values()].sort((a, b) => {
      const ai = projectOrder.get(a.project?.id ?? '') ?? 9999
      const bi = projectOrder.get(b.project?.id ?? '') ?? 9999
      if (ai !== bi) return ai - bi
      const na = a.project?.name ?? a.project?.id ?? ''
      const nb = b.project?.name ?? b.project?.id ?? ''
      return na.localeCompare(nb, 'fr', { sensitivity: 'base' })
    })
  }, [filteredTasks, projects])

  const baseConflicts = useMemo(() => computeConflicts(localTasks, undatedTasks, today), [localTasks, undatedTasks, today])

  // LOT 6.D — dependency conflicts derived from the live deps + task dates.
  // Recomputed automatically whenever dependencies or any task's dates change,
  // so warnings disappear/appear without manual refresh.
  const dependencyConflicts = useMemo((): Conflict[] => {
    const result: Conflict[] = []
    // Include undated tasks so deps where one task has no dates are reported, not silently skipped.
    const taskMap = new Map<string, GanttTask>([
      ...localTasks.map(t => [t.id, t] as [string, GanttTask]),
      ...undatedTasks.map(t => [t.id, t] as [string, GanttTask]),
    ])
    for (const d of dependencies) {
      const parent = taskMap.get(d.depends_on_task_id)
      const child = taskMap.get(d.task_id)
      if (!parent || !child) continue
      // If both tasks are completed the dependency order is historical — no operational alert
      if (isTaskCompleted(child) && isTaskCompleted(parent)) continue
      if (!parent.start_date || !parent.end_date || !child.start_date || !child.end_date) {
        const who = !child.start_date || !child.end_date ? child.title : parent.title
        result.push({
          type: 'dependency',
          taskId: child.id,
          parentId: parent.id,
          message: `Dépendance non vérifiable : « ${who} » n'est pas planifiée.`,
        })
        continue
      }
      if (child.end_date < parent.start_date) {
        result.push({
          type: 'dependency',
          taskId: child.id,
          parentId: parent.id,
          message: `« ${child.title} » est planifiée avant son prédécesseur « ${parent.title} » — sens à vérifier.`,
        })
      } else if (child.start_date < parent.end_date) {
        result.push({
          type: 'dependency',
          taskId: child.id,
          parentId: parent.id,
          message: `« ${child.title} » commence avant la fin de son prédécesseur « ${parent.title} ».`,
        })
      }
    }
    return result
  }, [dependencies, localTasks, undatedTasks])

  const conflicts = useMemo(() => [...baseConflicts, ...dependencyConflicts], [baseConflicts, dependencyConflicts])

  const taskConflictMap = useMemo(() => {
    const map = new Map<string, Conflict[]>()
    for (const c of conflicts) {
      const list = map.get(c.taskId) ?? []
      list.push(c)
      map.set(c.taskId, list)
    }
    return map
  }, [conflicts])

  const uniqueConflicts = useMemo(() => {
    // Stable dedup key per conflict type:
    //  - dependency : dep:{childId}:{parentId} — one entry per child+parent pair
    //  - overlap    : message string — two conflicts share the same message (task A ↔ task B),
    //                 keeping message-key here is intentional to collapse the pair into one row
    //  - late/blocked: {type}:{taskId}
    const seen = new Set<string>()
    return conflicts.filter(c => {
      const key = c.type === 'dependency'
        ? `dep:${c.taskId}:${c.parentId ?? ''}`
        : c.type === 'overlap'
        ? c.message
        : `${c.type}:${c.taskId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [conflicts])

  // LOT 15.E — Enrich each unique conflict into a UX-facing PlanningAlert.
  const planningAlerts = useMemo<PlanningAlert[]>(() => {
    const findTask = (id: string) =>
      localTasks.find(t => t.id === id) ?? undatedTasks.find(t => t.id === id) ?? null
    const out: PlanningAlert[] = []

    for (const c of uniqueConflicts) {
      const task = findTask(c.taskId)
      const title = task?.title ?? 'Tâche'
      const projectName = task?.project?.name
      const assigneeName = task?.assignee?.full_name

      if (c.type === 'late') {
        out.push({
          id: `late-${c.taskId}`, conflict: c, kind: 'late', severity: 'high',
          taskTitle: title, projectName, assigneeName,
          startDate: task?.start_date, endDate: task?.end_date,
          explain: "L'échéance est dépassée et la tâche n'est pas terminée.",
          actionLabel: 'Ouvrir la tâche', mode: 'open',
        })
      } else if (c.type === 'blocked') {
        out.push({
          id: `blocked-${c.taskId}`, conflict: c, kind: 'blocked', severity: 'high',
          taskTitle: title, projectName, assigneeName,
          startDate: task?.start_date, endDate: task?.end_date,
          explain: "Cette tâche est marquée bloquée et n'avance plus.",
          actionLabel: 'Ouvrir la tâche', mode: 'open',
        })
      } else if (c.type === 'overlap') {
        out.push({
          id: `overlap-${c.taskId}-${c.parentId ?? ''}`, conflict: c, kind: 'overlap', severity: 'medium',
          taskTitle: title, projectName, assigneeName,
          startDate: task?.start_date, endDate: task?.end_date,
          explain: assigneeName
            ? `Deux tâches se chevauchent sur le même intervenant (${assigneeName}).`
            : 'Deux tâches se chevauchent sur le même intervenant.',
          actionLabel: 'Analyser le conflit', mode: 'analyze', otherId: c.parentId,
        })
      } else {
        // dependency — split into a real incoherence vs a missing-dates case
        const parent = c.parentId ? findTask(c.parentId) : null
        const childMissing = !task?.start_date || !task?.end_date
        const parentMissing = !parent?.start_date || !parent?.end_date
        if (childMissing || parentMissing) {
          const planTask = childMissing ? task : parent
          out.push({
            id: `dep-miss-${c.taskId}-${c.parentId ?? ''}`, conflict: c, kind: 'undated', severity: 'info',
            taskTitle: planTask?.title ?? title,
            projectName: planTask?.project?.name ?? projectName,
            assigneeName: planTask?.assignee?.full_name,
            explain: "Une tâche liée n'a pas de dates et n'apparaît pas dans le planning.",
            actionLabel: 'Planifier la tâche', mode: 'plan',
            planTaskId: planTask?.id, otherId: c.parentId,
          })
        } else {
          const inverted = !!(task && parent && task.end_date! < parent.start_date!)
          out.push({
            id: `dep-${c.taskId}-${c.parentId ?? ''}`, conflict: c, kind: 'dependency', severity: 'medium',
            taskTitle: title, projectName, assigneeName,
            startDate: task?.start_date, endDate: task?.end_date,
            explain: inverted
              ? 'Cette tâche est planifiée avant son prédécesseur.'
              : 'Cette tâche commence avant la fin de son prédécesseur.',
            actionLabel: 'Analyser la dépendance', mode: 'analyze-dep', otherId: c.parentId,
          })
        }
      }
    }

    const rank: Record<AlertSeverity, number> = { high: 0, medium: 1, info: 2 }
    return out.sort((a, b) => rank[a.severity] - rank[b.severity])
  }, [uniqueConflicts, localTasks, undatedTasks])

  const alertSummary = useMemo(() => {
    const s: Record<PlanningAlertKind, number> = { late: 0, blocked: 0, overlap: 0, dependency: 0, undated: 0 }
    for (const a of planningAlerts) s[a.kind]++
    return s
  }, [planningAlerts])

  // ─── Task handlers ───────────────────────────────────────────────────────────

  // LOT 15.E — Single entry point for an alert's primary action.
  // For complex conflicts (overlap, dependency) the primary click enters analysis
  // mode — never opens a task sheet blindly (the sheet stays available as a secondary
  // "Ouvrir la fiche" action inside the analysis panel).
  const handleAlertAction = (alert: PlanningAlert) => {
    setConflictsOpen(true)
    if (alert.mode === 'open') {
      setActiveAlert(null)
      setAutoEditTaskId(null)
      const t = localTasks.find(x => x.id === alert.conflict.taskId)
        ?? undatedTasks.find(x => x.id === alert.conflict.taskId)
      if (t) setSelectedTask(t)
      return
    }
    if (alert.mode === 'plan') {
      if (!alert.planTaskId) return
      const t = localTasks.find(x => x.id === alert.planTaskId)
        ?? undatedTasks.find(x => x.id === alert.planTaskId)
      if (!t) return
      setActiveAlert(null)
      setAutoEditTaskId(t.id)
      setSelectedTask(t)
      setShowUndated(true)
      setUndatedOpen(true)
      return
    }
    // analyze / analyze-dep — visualisation requires the Global (project) view
    if (!alert.otherId) return
    setSelectedTask(null)
    setGanttMode('project')
    if (alert.mode === 'analyze') {
      setActiveAlert({ childId: alert.conflict.taskId, parentId: alert.otherId, type: 'artisan_overlap' })
    } else {
      const childTask = localTasks.find(t => t.id === alert.conflict.taskId)
      const parentTask = localTasks.find(t => t.id === alert.otherId)
      let alertType: 'overlap' | 'inverted' | 'missing' = 'missing'
      if (childTask?.start_date && childTask?.end_date && parentTask?.start_date && parentTask?.end_date) {
        if (childTask.end_date < parentTask.start_date) alertType = 'inverted'
        else if (childTask.start_date < parentTask.end_date) alertType = 'overlap'
      }
      setActiveAlert({ childId: alert.conflict.taskId, parentId: alert.otherId, type: alertType })
    }
  }

  const handleTaskClick = (task: GanttTask) => {
    setAutoEditTaskId(null)
    setSelectedTask(prev => prev?.id === task.id ? null : task)
  }

  const handleSideClose = () => {
    setSelectedTask(null)
    setAutoEditTaskId(null)
    // activeAlert intentionally preserved: user stays in analysis context after
    // closing the side panel. Only "Quitter l'analyse" explicitly exits analysis.
  }

  // Merge a TaskSidePanel save into localTasks so the bar updates without waiting for router.refresh()
  const handleTaskUpdated = useCallback((taskId: string, patch: TaskUpdatePatch) => {
    setLocalTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return {
        ...t,
        ...patch,
        assignee: patch.assignee !== undefined ? patch.assignee ?? undefined : t.assignee,
        project: t.project,
      } as GanttTask
    }))
    // LOT 6.C.5 — also refresh selectedTask so the sidewindow recomputes warnings
    // with the latest dates (no stale "incohérent" message after a corrective edit).
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      return {
        ...prev,
        ...patch,
        assignee: patch.assignee !== undefined ? patch.assignee ?? undefined : prev.assignee,
        project: prev.project,
      } as GanttTask
    })
    // If dates were touched, request a viewport-fit pass on the next render
    if (patch.start_date !== undefined || patch.end_date !== undefined) {
      setPendingScrollTaskId(taskId)
    }
  }, [])

  // Test whether a task would still appear in the current filtered view
  const filterMatches = useCallback((t: GanttTask) => {
    if (filterProject !== 'all' && t.project_id !== filterProject) return false
    if (filterArtisan !== 'all' && t.assignee?.id !== filterArtisan) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (!showCompleted && (t.status === 'done' || t.status === 'validated')) return false
    if (!t.start_date || !t.end_date) return false
    return true
  }, [filterProject, filterArtisan, filterStatus, showCompleted])

  const executeUndo = useCallback(async () => {
    const label = undoLabel
    const ok = await handleUndo(() => toast("Impossible d'annuler cette action", 'error'))
    if (ok) toast(`Annulé : ${label ?? ''}`)
  }, [handleUndo, toast, undoLabel])

  const executeRedo = useCallback(async () => {
    const label = redoLabel
    const ok = await handleRedo(() => toast("Impossible de rétablir cette action", 'error'))
    if (ok) toast(`Rétabli : ${label ?? ''}`)
  }, [handleRedo, toast, redoLabel])

  // Keyboard shortcuts: Ctrl/Cmd+Z → Undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z → Redo
  // Ignored when focus is inside a form field to avoid interfering with text editing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return
      if (!e.shiftKey && e.key === 'z') {
        if (!canUndo) return
        e.preventDefault()
        executeUndo()
      } else if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
        if (!canRedo) return
        e.preventDefault()
        executeRedo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canUndo, canRedo, executeUndo, executeRedo])

  const sidePanelTask = selectedTask

  // ─── Flat rows model ─────────────────────────────────────────────────────────

  type GanttRow =
    | { type: 'group'; project: GanttTask['project']; taskCount: number; doneCount: number; minStart: string | null; maxEnd: string | null }
    | { type: 'task'; task: GanttTask; project: GanttTask['project'] }

  // LOT 27C — regroupements repliables. On filtre à la source unique (ganttRows)
  // pour que taskLayout, le rendu et les flèches de dépendance restent cohérents.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (projectId: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(projectId) ? next.delete(projectId) : next.add(projectId)
      return next
    })

  const ganttRows = useMemo((): GanttRow[] => {
    const rows: GanttRow[] = []
    for (const { project, tasks: grpTasks } of groupedByProject) {
      const doneCount = grpTasks.filter(isTaskCompleted).length
      // LOT 27G — période globale du chantier (min start / max end des tâches datées)
      let minStart: string | null = null
      let maxEnd: string | null = null
      for (const t of grpTasks) {
        if (t.start_date && (!minStart || t.start_date < minStart)) minStart = t.start_date
        if (t.end_date && (!maxEnd || t.end_date > maxEnd)) maxEnd = t.end_date
      }
      rows.push({ type: 'group', project, taskCount: grpTasks.length, doneCount, minStart, maxEnd })
      if (project && collapsedGroups.has(project.id)) continue // replié : tâches masquées
      for (const task of grpTasks) {
        rows.push({ type: 'task', task, project })
      }
    }
    return rows
  }, [groupedByProject, collapsedGroups])

  // ─── Bar render (read-only, click opens sidewindow) ──────────────────────────

  const renderProjectBar = (task: GanttTask, project: GanttTask['project']) => {
    if (!task.start_date || !task.end_date) return null

    const startOff = differenceInDays(parseDBDate(task.start_date), rangeStart)
    const duration = differenceInDays(parseDBDate(task.end_date), parseDBDate(task.start_date)) + 1

    // Clip bar to visible range [0, totalDays * dayW]
    const rawLeft = startOff * dayW
    const rawRight = (startOff + duration) * dayW
    // Skip tasks entirely outside the visible period
    if (rawRight <= 0 || rawLeft >= totalDays * dayW) return null
    const visibleLeft = Math.max(0, rawLeft)
    const visibleRight = Math.min(totalDays * dayW, rawRight)
    const clippedWidth = Math.max(dayW, visibleRight - visibleLeft)
    // Dynamic safety margin: ensures a visible gap between the column border and the bar.
    // Scales with zoom so the gap is proportional (30% of day width, min 6px).
    const SAFE_LEFT_MARGIN = Math.max(6, Math.round(dayW * 0.3))
    const safeLeft = visibleLeft < SAFE_LEFT_MARGIN ? SAFE_LEFT_MARGIN : visibleLeft
    const barWidth = visibleLeft < SAFE_LEFT_MARGIN
      ? Math.max(Math.round(dayW * 0.5), clippedWidth - (SAFE_LEFT_MARGIN - visibleLeft))
      : clippedWidth

    const isLate = new Date(task.end_date) < today && task.status !== 'done' && task.status !== 'validated'
    const baseColor = project?.color ?? '#2563EB'
    const barConflicts = taskConflictMap.get(task.id) ?? []
    const hasOverlap = barConflicts.some(c => c.type === 'overlap')
    const isAlertBar = isLate || task.status === 'blocked' || hasOverlap
    const stripeColor = isLate
      ? 'rgba(239,68,68,1)'
      : task.status === 'blocked'
      ? 'rgba(249,115,22,1)'
      : 'rgba(234,179,8,1)'
    // Pastel: light translucent background + colored accent border-left
    const barBgColor = hexToRgba(baseColor, 0.14)
    const barBackground = isAlertBar
      ? `linear-gradient(90deg, ${stripeColor} 4px, ${barBgColor} 4px)`
      : barBgColor
    const barBorderStyle = `1px solid ${hexToRgba(baseColor, 0.30)}`
    const barBorderLeft = `3px solid ${hexToRgba(baseColor, 0.65)}`
    const barTextColor = hexToRgba(baseColor, 0.95)
    const conflictShadow = isLate
      ? '0 0 0 2px rgba(239,68,68,0.85), 0 0 10px rgba(239,68,68,0.35)'
      : task.status === 'blocked'
      ? '0 0 0 2px rgba(249,115,22,0.85), 0 0 10px rgba(249,115,22,0.35)'
      : hasOverlap
      ? '0 0 0 2px rgba(234,179,8,0.85), 0 0 10px rgba(234,179,8,0.35)'
      : null
    // Only show alert icon when bar is wide enough and not clipped to the safety margin
    const showAlertIcon = isAlertBar && barWidth >= 100
    // LOT 6.C.5 — halo on tasks connected to the currently selected task
    // LOT 15.E.11 — simple solid 2px ring on alert-concerned bars; no glow, no slab
    const isBarSelected = selectedId === task.id
    const isBarConnected = connectedTaskIds.has(task.id)
    const isAlertHighlighted = activeAlert ? alertHighlightIds.has(task.id) : false
    // LOT 21.E — strong red highlight for artisan overlap bars
    const isOverlapHighlighted = isAlertHighlighted && activeAlert?.type === 'artisan_overlap'
    const alertRingColor = isOverlapHighlighted
      ? '239,68,68'    // red
      : '124,58,237'   // violet
    const haloShadow = isOverlapHighlighted
      ? `0 0 0 2px rgba(239,68,68,1), 0 0 12px rgba(239,68,68,0.6)`
      : isAlertHighlighted
      ? `0 0 0 2px rgba(${alertRingColor},1)`
      : isBarSelected
      ? '0 0 0 1.5px rgba(59, 130, 246, 0.55), 0 0 10px rgba(59, 130, 246, 0.25)'
      : isBarConnected
      ? '0 0 0 1px rgba(59, 130, 246, 0.35), 0 0 6px rgba(59, 130, 246, 0.18)'
      : null
    const finalShadow = [conflictShadow, haloShadow].filter(Boolean).join(', ') || undefined
    const barOpacity = task.status === 'done' || task.status === 'validated' ? 0.45 : 0.9
    const effectiveBackground = isOverlapHighlighted ? 'rgba(239,68,68,1)' : barBackground
    const effectiveBorderStyle = isOverlapHighlighted ? '1px solid rgba(239,68,68,0.9)' : barBorderStyle
    const effectiveBorderLeft = isOverlapHighlighted ? '3px solid rgba(200,30,30,1)' : barBorderLeft
    const effectiveTextColor = isOverlapHighlighted ? '#ffffff' : barTextColor

    return (
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center text-xs font-600 overflow-hidden cursor-pointer select-none',
          isOverlapHighlighted && 'gantt-bar-overlap-active',
        )}
        style={{
          left: safeLeft,
          width: barWidth,
          background: effectiveBackground,
          border: effectiveBorderStyle,
          borderLeft: effectiveBorderLeft,
          opacity: barOpacity,
          boxShadow: finalShadow,
          color: effectiveTextColor,
        }}
        onClick={e => { e.stopPropagation(); handleTaskClick(task) }}
        onMouseEnter={e => setTooltip({ task, x: e.clientX + 14, y: e.clientY - 48 })}
        onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX + 14, y: e.clientY - 48 } : prev)}
        onMouseLeave={() => setTooltip(null)}
      >
        {showAlertIcon && (
          <AlertTriangle className="shrink-0 h-3 w-3 ml-1.5" style={{ color: stripeColor }} />
        )}
        {/* LOT 27C — coche « terminé » (statut réel, pas de progression fabriquée) */}
        {(task.status === 'done' || task.status === 'validated') && (
          <Check className="shrink-0 h-3 w-3 ml-1.5" style={{ color: effectiveTextColor }} />
        )}
        <span className="truncate px-1.5 flex-1">{task.title}</span>
      </div>
    )
  }

  const totalWidth = LEFT_COL_WIDTH + totalDays * dayW

  // Layout map for dependency arrows — only project view (vue Global).
  // Row index corresponds to ganttRows[idx]; coords are relative to the
  // right zone (i.e., add LEFT_COL_WIDTH for absolute position in the inner div).
  const taskLayout = useMemo(() => {
    const map = new Map<string, { startX: number; endX: number; centerY: number }>()
    ganttRows.forEach((row, idx) => {
      if (row.type !== 'task') return
      const t = row.task
      if (!t.start_date || !t.end_date) return
      const startOff = differenceInDays(parseDBDate(t.start_date), rangeStart)
      const duration = differenceInDays(parseDBDate(t.end_date), parseDBDate(t.start_date)) + 1
      const startX = Math.max(0, startOff) * dayW
      const endX = startX + Math.max(duration * dayW, dayW)
      const centerY = idx * ROW_HEIGHT + ROW_HEIGHT / 2
      map.set(t.id, { startX, endX, centerY })
    })
    return map
  }, [ganttRows, rangeStart, dayW])

  const visibleDeps = useMemo(() => {
    if (!showDeps) return []
    return dependencies.filter(d => taskLayout.has(d.task_id) && taskLayout.has(d.depends_on_task_id))
  }, [dependencies, taskLayout, showDeps])

  // LOT 6.E — When alert mode is entered, scroll so both task bars are visible.
  // LOT 15.E.1 — also scroll vertically to center both rows in the viewport.
  useEffect(() => {
    if (!activeAlert || ganttMode !== 'project') return
    const childLayout = taskLayout.get(activeAlert.childId)
    const parentLayout = taskLayout.get(activeAlert.parentId)
    const el = scrollContainerRef.current
    if (!el || (!childLayout && !parentLayout)) return
    const layouts = [childLayout, parentLayout].filter((l): l is { startX: number; endX: number; centerY: number } => l !== undefined)
    const minX = Math.min(...layouts.map(l => l.startX))
    const maxX = Math.max(...layouts.map(l => l.endX))
    const midX = (minX + maxX) / 2
    const targetLeft = Math.max(0, LEFT_COL_WIDTH + midX - el.clientWidth / 2)
    const midY = layouts.reduce((sum, l) => sum + l.centerY, 0) / layouts.length
    const targetTop = Math.max(0, HEADER_HEIGHT + midY - el.clientHeight / 2)
    el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' })
  }, [activeAlert, taskLayout, ganttMode])

  // LOT 21.E — Scroll the analysis panel into view when an overlap is selected.
  useEffect(() => {
    if (activeAlert) {
      analysisPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeAlert])

  // LOT 6.E — Derived data for the analysis panel
  // Searches both localTasks and undatedTasks so deps involving an undated task are handled.
  const alertPanelData = useMemo(() => {
    if (!activeAlert) return null
    const findTask = (id: string) =>
      localTasks.find(t => t.id === id) ?? undatedTasks.find(t => t.id === id) ?? null
    const childTask = findTask(activeAlert.childId)
    const parentTask = findTask(activeAlert.parentId)
    let analysisMessage = ''
    let overlapStart: string | null = null
    let overlapEnd: string | null = null
    let undatedTask: GanttTask | null = null // for 'missing': the task that needs scheduling
    const isArtisan = activeAlert.type === 'artisan_overlap'
    // LOT 15.E.3 — daysEarly: how many days before parent.end_date the successor starts
    // (only set for dependency 'overlap' type — not for artisan chevauchement).
    let daysEarly: number | null = null

    if (isArtisan && childTask?.start_date && childTask?.end_date && parentTask?.start_date && parentTask?.end_date) {
      // LOT 15.E — artisan double-booking: same person, two overlapping tasks.
      overlapStart = childTask.start_date > parentTask.start_date ? childTask.start_date : parentTask.start_date
      overlapEnd = childTask.end_date < parentTask.end_date ? childTask.end_date : parentTask.end_date
      const days = differenceInDays(parseDBDate(overlapEnd), parseDBDate(overlapStart)) + 1
      const who = childTask.assignee?.full_name ?? 'le même intervenant'
      analysisMessage = `Chevauchement de ${days} jour${days > 1 ? 's' : ''} : ${who} est assigné(e) à « ${childTask.title} » et « ${parentTask.title} » sur la même période.`
    } else if (activeAlert.type === 'overlap' && childTask?.start_date && childTask?.end_date && parentTask?.start_date && parentTask?.end_date) {
      // Dependency overlap: child starts before parent ends — this is a sequencing error,
      // NOT an artisan conflict. Use "décalage logique" vocabulary, never "chevauchement".
      overlapStart = childTask.start_date > parentTask.start_date ? childTask.start_date : parentTask.start_date
      overlapEnd = childTask.end_date < parentTask.end_date ? childTask.end_date : parentTask.end_date
      daysEarly = differenceInDays(parseDBDate(parentTask.end_date), parseDBDate(childTask.start_date))
      analysisMessage = `Le successeur démarre ${daysEarly} jour${daysEarly > 1 ? 's' : ''} avant la fin du prédécesseur.`
    } else if (activeAlert.type === 'inverted' && childTask?.end_date && parentTask?.start_date) {
      const days = differenceInDays(parseDBDate(parentTask.start_date), parseDBDate(childTask.end_date))
      analysisMessage = `Ordre inversé : le successeur se termine ${days} jour${days > 1 ? 's' : ''} avant le début du prédécesseur — sens de la dépendance à vérifier.`
    } else {
      // 'missing' — identify exactly which task lacks dates and name it explicitly
      const childMissing = !childTask?.start_date || !childTask?.end_date
      const parentMissing = !parentTask?.start_date || !parentTask?.end_date
      if (childMissing && parentMissing) {
        analysisMessage = `Dépendance non vérifiable : les deux tâches ne sont pas planifiées.`
      } else if (childMissing) {
        undatedTask = childTask
        analysisMessage = `Dépendance non vérifiable : « ${childTask?.title ?? '…'} » n'est pas planifiée.`
      } else if (parentMissing) {
        undatedTask = parentTask
        analysisMessage = `Dépendance non vérifiable : le prédécesseur « ${parentTask?.title ?? '…'} » n'est pas planifié.`
      } else {
        analysisMessage = `Dépendance non vérifiable entre « ${childTask?.title ?? '…'} » et « ${parentTask?.title ?? '…'} » — dates manquantes.`
      }
    }
    return { childTask, parentTask, analysisMessage, overlapStart, overlapEnd, undatedTask, isArtisan, daysEarly }
  }, [activeAlert, localTasks, undatedTasks])

  // LOT 15.E.11 — alertOverlapRect and alertDepArrow removed.
  // Analysis context is now conveyed exclusively by the right panel.

  // After a date edit, if the task is in the project view's layout but its bar
  // is outside the current viewport, scroll horizontally to it.
  useEffect(() => {
    if (!pendingScrollTaskId) return
    if (ganttMode !== 'project') { setPendingScrollTaskId(null); return }
    const layout = taskLayout.get(pendingScrollTaskId)
    const el = scrollContainerRef.current
    if (!layout || !el) { setPendingScrollTaskId(null); return }
    // Bar absolute X in the inner div = LEFT_COL_WIDTH + layout.startX
    // Visible area excludes the sticky left column.
    const barAbsLeft = LEFT_COL_WIDTH + layout.startX
    const barAbsRight = LEFT_COL_WIDTH + layout.endX
    const visibleLeft = el.scrollLeft + LEFT_COL_WIDTH
    const visibleRight = el.scrollLeft + el.clientWidth
    if (barAbsRight < visibleLeft + 40 || barAbsLeft > visibleRight - 40) {
      // Center-ish target: keep the bar a bit right of the sticky column
      const target = Math.max(0, barAbsLeft - LEFT_COL_WIDTH - 80)
      el.scrollTo({ left: target, behavior: 'smooth' })
      toast('Vue ajustée pour afficher la tâche modifiée.')
    }
    setPendingScrollTaskId(null)
  }, [pendingScrollTaskId, taskLayout, ganttMode, toast])

  // LOT 15.E.1 — "Aujourd'hui" scroll: center the viewport on the today line after
  // viewOffset resets to 0. Runs after the render so todayOffset is already correct.
  useEffect(() => {
    if (!pendingScrollToToday) return
    setPendingScrollToToday(false)
    const el = scrollContainerRef.current
    if (!el) return
    const todayAbsX = LEFT_COL_WIDTH + todayOffset * dayW
    if (todayAbsX < LEFT_COL_WIDTH || todayOffset < 0 || todayOffset > totalDays) {
      toast("Aujourd'hui est hors de la plage visible", 'error')
      return
    }
    el.scrollTo({ left: Math.max(0, todayAbsX - el.clientWidth / 2), behavior: 'smooth' })
  }, [pendingScrollToToday, todayOffset, dayW, totalDays, toast])

  // ─── Return ───────────────────────────────────────────────────────────────────

  // LOT 15.E.8 — right aside is open when the user toggled the alerts button OR
  // when analysis mode is active. Structurally it is a horizontal sibling of the
  // Gantt viewport so Gantt content cannot bleed into the panel zone.
  const isPanelOpen =
    conflictsOpen
    || (activeAlert !== null && ganttMode === 'project')

  return (
    <>
      {/* ── Planning card — single clip barrier. Toolbar + horizontal body (Gantt
          viewport left, optional right aside). The aside is a flex sibling of the
          viewport: Gantt content cannot physically overlap it. ── */}
      <div
        className={cn(
          'flex flex-col bg-surface border border-border overflow-hidden',
          isFullscreen ? 'fixed inset-0 z-[9000] border-0 rounded-none' : 'h-full rounded-xl'
        )}
      >

        {/* ── Toolbar ── */}
        <div className="shrink-0 border-b border-border bg-surface">
          <div className="flex items-center gap-2 px-4 h-12 min-w-0">

            {/* LEFT — title + mode switch */}
            <h2 className="font-700 text-sm text-foreground shrink-0 hidden lg:block mr-1">Planning</h2>
            <div className="flex items-center gap-0.5 bg-elevated border border-border/60 rounded-lg p-0.5 shrink-0">
              {(['project', 'artisan'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setGanttMode(mode)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-600 transition-colors whitespace-nowrap',
                    ganttMode === mode ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode === 'project' ? 'Global' : 'Par artisan'}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-border/50 shrink-0 mx-0.5" />

            {/* CENTER — period navigation */}
            <div className="flex items-center bg-elevated border border-border/60 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={navigatePrev}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-border/20 transition-colors"
                title="Période précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={navigateToday}
                title="Recentrer sur aujourd'hui"
                className={cn(
                  'px-2.5 py-1 text-xs font-600 transition-colors flex items-center gap-1 border-x border-border/40',
                  viewOffset === 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Calendar className="h-3 w-3" />
                Aujourd'hui
              </button>
              <button
                onClick={navigateNext}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-border/20 transition-colors"
                title="Période suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* SPACER */}
            <div className="flex-1 min-w-0" />

            {/* RIGHT — Undo / Redo */}
            <div className="flex items-center gap-0.5 bg-elevated border border-border/60 rounded-lg p-0.5 shrink-0">
              <button
                onClick={executeUndo}
                disabled={!canUndo}
                title={canUndo ? `Annuler : ${undoLabel}` : 'Rien à annuler'}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  canUndo ? 'text-foreground hover:bg-surface hover:shadow-sm' : 'text-muted-foreground/30 cursor-not-allowed',
                )}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={executeRedo}
                disabled={!canRedo}
                title={canRedo ? `Rétablir : ${redoLabel}` : 'Rien à rétablir'}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  canRedo ? 'text-foreground hover:bg-surface hover:shadow-sm' : 'text-muted-foreground/30 cursor-not-allowed',
                )}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Zoom — Jour / Semaine / Mois */}
            <div className="hidden sm:flex items-center gap-0.5 bg-elevated border border-border/60 rounded-lg p-0.5 shrink-0">
              {(['day', 'week', 'month'] as const).map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-600 transition-colors whitespace-nowrap',
                    zoom === z ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {z === 'day' ? 'Jour' : z === 'week' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>

            {/* Filtres — button + popover */}
            <div className="relative shrink-0">
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 border transition-colors',
                  filtersOpen || activeFiltersCount > 0
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-elevated border-border/60 text-muted-foreground hover:text-foreground',
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filtres</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-primary text-white text-[10px] font-700 px-1.5 py-0.5 rounded-full leading-none tabular-nums">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-elevated border border-border rounded-xl shadow-xl z-50 p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground/40">Filtres</span>
                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="text-xs text-primary hover:text-primary/80 font-600 transition-colors"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-600 text-muted-foreground/50 uppercase tracking-wider">Chantier</label>
                        <select
                          value={filterProject}
                          onChange={e => setFilterProject(e.target.value)}
                          className="text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                        >
                          <option value="all">Tous les chantiers</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>

                      {artisans.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-600 text-muted-foreground/50 uppercase tracking-wider">Artisan</label>
                          <select
                            value={filterArtisan}
                            onChange={e => setFilterArtisan(e.target.value)}
                            className="text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                          >
                            <option value="all">Tous les artisans</option>
                            {artisans.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-600 text-muted-foreground/50 uppercase tracking-wider">Statut</label>
                        <select
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                          className="text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:border-primary"
                        >
                          <option value="all">Tous les statuts</option>
                          <option value="todo">À faire</option>
                          <option value="in_progress">En cours</option>
                          <option value="blocked">Bloquée</option>
                          <option value="done">Terminée</option>
                          <option value="validated">Validée</option>
                        </select>
                        <span className="text-[10px] text-muted-foreground/60 leading-tight">
                          Sélectionner un statut affiche <span className="font-700">uniquement</span> ces tâches (masque les autres).
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-border/20">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={e => setShowCompleted(e.target.checked)}
                            className="rounded accent-primary"
                          />
                          <span className="text-xs text-foreground group-hover:text-foreground transition-colors">Afficher les tâches terminées</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={showUndated}
                            onChange={e => setShowUndated(e.target.checked)}
                            className="rounded accent-primary"
                          />
                          <span className="text-xs text-foreground group-hover:text-foreground transition-colors">Afficher les tâches sans dates</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none group" title="Vue Global uniquement">
                          <input
                            type="checkbox"
                            checked={showDeps}
                            onChange={e => setShowDeps(e.target.checked)}
                            className="rounded accent-primary"
                          />
                          <span className="text-xs text-foreground group-hover:text-foreground transition-colors">
                            Afficher les dépendances
                            <span className="text-muted-foreground/50 ml-1">(Global)</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Alertes planning — ouvre le panneau « Alertes & résolution » */}
            {planningAlerts.length > 0 && (
              <button
                data-demo-target="planning-alerts-button"
                onClick={() => setConflictsOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg text-xs font-600 hover:bg-orange-500/15 transition-colors shrink-0"
                title="Voir les alertes planning"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{planningAlerts.length} alerte{planningAlerts.length > 1 ? 's' : ''} planning</span>
              </button>
            )}

            {/* Plein écran */}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-elevated border border-border/60 rounded-lg transition-colors shrink-0"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ── Horizontal body: Gantt viewport (flex-1) + optional right aside ── */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* Gantt viewport — min-w-0 prevents flex item from overflowing its parent */}
          <div className="flex-1 min-w-0 overflow-hidden relative">
        {ganttMode === 'artisan' ? (
          <GanttArtisanView
            filteredTasks={filteredTasks}
            artisans={artisans}
            taskConflictMap={taskConflictMap}
            zoom={zoom}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            dayW={dayW}
            totalDays={totalDays}
            todayOffset={todayOffset}
            today={today}
            selectedTaskId={selectedTask?.id ?? null}
            filterArtisan={filterArtisan}
            onTaskClick={handleTaskClick}
            onTooltipChange={setTooltip}
          />
        ) : (
          // Unified single-scroll grid: one container scrolls both axes.
          // Sticky left column (per-row) replaces the old two-column flex + scrollTop sync.
          // LOT 15.E.3 — `isolate` creates a new CSS stacking context that CONTAINS
          // the internal z-indices (z-40 header corner, z-30 header, z-25 sticky col,
          // z-3 SVG), preventing them from painting over the sibling panels below.
          <div ref={scrollContainerRef} className="h-full overflow-auto isolate">
            <div className="relative" style={{ width: totalWidth }}>

              {/* Header row — sticky top */}
              <div className="flex sticky top-0 z-30" style={{ height: HEADER_HEIGHT }}>
                {/* Corner — sticky both axes */}
                <div
                  className="sticky left-0 z-40 shrink-0 bg-surface border-r border-b border-border flex items-center px-4"
                  style={{ width: LEFT_COL_WIDTH, height: HEADER_HEIGHT }}
                >
                  <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Tâche</span>
                </div>
                {/* Date columns — two stacked rows */}
                <div className="flex flex-col border-b border-border bg-surface" style={{ width: totalDays * dayW }}>

                  {/* ── Row 1: Month blocks — one span per calendar month ── */}
                  <div className="relative border-b border-border/50 overflow-hidden" style={{ height: MONTH_ROW_HEIGHT }}>
                    {monthSegments.map((seg, idx) => (
                      <div
                        key={idx}
                        className={cn('absolute inset-y-0 flex items-center overflow-hidden', seg.isOdd && 'bg-foreground/[0.03]')}
                        style={{ left: seg.left, width: seg.width }}
                      >
                        {idx > 0 && <div className="absolute left-0 inset-y-0 w-0.5 bg-border shrink-0" />}
                        <span className="truncate text-[11px] font-700 text-foreground capitalize pl-2 relative z-[1]">
                          {seg.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ── Row 2: Day / week grid ── */}
                  <div className="relative flex" style={{ height: DAY_ROW_HEIGHT }}>
                    {weekStarts.map(left => (
                      <div key={`wh-${left}`} className="absolute top-0 bottom-0 w-px dark:bg-border/30 bg-border/60 pointer-events-none" style={{ left }} />
                    ))}
                    {eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((day, i) => {
                      const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                      const isMonday = day.getDay() === 1
                      const isOdd = getMonthBandIndex(day) % 2 === 1
                      const showLabel = zoom === 'day' || (zoom === 'week' && isMonday)
                      return (
                        <div
                          key={i}
                          style={{ width: dayW, flexShrink: 0 }}
                          className={cn(
                            'relative border-r border-border/60 dark:border-border flex flex-col items-center justify-center text-xs',
                            isToday ? 'bg-primary/5' : isOdd ? 'dark:bg-foreground/[0.02] bg-foreground/[0.035]' : '',
                          )}
                        >
                          {showLabel && (
                            <>
                              <span className={cn('leading-none font-600', isToday ? 'text-primary' : 'text-muted-foreground')}>
                                {zoom === 'day'
                                  ? format(day, 'EEEEE', { locale: fr })
                                  : `S${getISOWeek(day)}`}
                              </span>
                              {zoom === 'day' && (
                                <span className={cn('text-[10px] leading-none mt-0.5', isToday ? 'text-primary font-700' : 'text-muted-foreground')}>
                                  {format(day, 'd')}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                    {/* LOT 27F — le badge « Aujourd'hui » n'est plus dans l'en-tête
                        (il débordait sur la colonne Tâche au scroll). Il est rendu par
                        <TodayBadge>, en overlay du viewport, clampé au viewport visible. */}
                  </div>
                </div>
              </div>

              {/* Today line + badge — LOT 27G : à leur VRAIE position temporelle,
                  dans le canvas (z-5). Aucun clamp. La colonne Tâche sticky (cellules
                  z-20/z-25, opaques) passe naturellement au-dessus et masque la ligne
                  et le badge lorsqu'ils défilent derrière elle ; ils réapparaissent
                  quand la timeline revient dans la zone visible. Le badge reste juste
                  sous l'en-tête (top:0 = HEADER_HEIGHT) pour ne pas être coupé par lui. */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute w-0.5 bg-yellow-500 z-[5] pointer-events-none"
                  style={{
                    top: HEADER_HEIGHT,
                    bottom: 0,
                    left: LEFT_COL_WIDTH + todayOffset * dayW + dayW / 2,
                  }}
                >
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px] font-800 leading-none text-white bg-yellow-500 px-1.5 py-0.5 rounded-full shadow-sm ring-1 ring-black/10">
                    Aujourd&apos;hui
                  </span>
                </div>
              )}

              {/* Data rows — each row is a flex with sticky-left cell + relative right cell.
                  Both cells share the SAME parent flex row → identical height guaranteed. */}
              {ganttRows.map(row => {
                if (row.type === 'group') {
                  const groupKey = row.project?.id ?? 'unknown'
                  const isCollapsed = collapsedGroups.has(groupKey)
                  return (
                    <div key={`g-${groupKey}`} className="flex" style={{ height: ROW_HEIGHT }}>
                      <div
                        className="sticky left-0 z-20 shrink-0 bg-background border-r border-b border-border flex items-center gap-2 pl-3 pr-4 overflow-hidden cursor-pointer hover:bg-elevated/50 transition-colors"
                        style={{ width: LEFT_COL_WIDTH, height: ROW_HEIGHT, borderLeft: `6px solid ${row.project?.color ?? '#2563EB'}` }}
                        onClick={() => toggleGroup(groupKey)}
                        title={isCollapsed ? 'Déplier le chantier' : 'Replier le chantier'}
                      >
                        {/* teinte chantier — au-dessus du fond opaque, derrière le contenu */}
                        <div className="absolute inset-0 pointer-events-none z-[-1]" style={{ background: hexToRgba(row.project?.color ?? '#2563EB', 0.06) }} />
                        {isCollapsed
                          ? <ChevronRightSm className="h-4 w-4 shrink-0 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="text-xs font-800 uppercase tracking-wide text-foreground truncate min-w-0 flex-1">{row.project?.name ?? 'Chantier'}</span>
                        <span className="shrink-0 text-[10px] font-600 text-muted-foreground tabular-nums" title="Tâches terminées / total">
                          {row.doneCount}/{row.taskCount}
                        </span>
                      </div>
                      <div className="relative border-b border-border" style={{ width: totalDays * dayW, height: ROW_HEIGHT, background: hexToRgba(row.project?.color ?? '#2563EB', 0.05) }}>
                        {monthSegments.map((seg, idx) => (
                          <div key={idx} className="absolute inset-y-0 pointer-events-none" style={{ left: seg.left, width: seg.width }}>
                            {seg.isOdd && <div className="absolute inset-0 bg-foreground/[0.02]" />}
                            {idx > 0 && <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-border/60" />}
                          </div>
                        ))}
                        {weekStarts.map(left => (
                          <div key={`w-${left}`} className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none" style={{ left }} />
                        ))}
                        {/* LOT 27G — résumé chantier « pleine largeur » (données fiables) */}
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-600 text-muted-foreground pointer-events-none">
                          {row.doneCount}/{row.taskCount} terminée{row.taskCount > 1 ? 's' : ''} · {row.taskCount} tâche{row.taskCount > 1 ? 's' : ''}
                          {row.minStart && row.maxEnd && ` · ${format(parseDBDate(row.minStart), 'd MMM', { locale: fr })} → ${format(parseDBDate(row.maxEnd), 'd MMM', { locale: fr })}`}
                        </span>
                      </div>
                    </div>
                  )
                }
                const { task, project } = row
                const tConflicts = taskConflictMap.get(task.id) ?? []
                const isLate = tConflicts.some(c => c.type === 'late')
                const isBlocked = task.status === 'blocked'
                const hasOverlap = tConflicts.some(c => c.type === 'overlap')
                const isSelected = selectedTask?.id === task.id
                const isRowAlertHighlighted = activeAlert !== null && alertHighlightIds.has(task.id)
                return (
                  <div key={`t-${task.id}`} className="flex group" style={{ height: ROW_HEIGHT }}>
                    {/* Sticky left cell — label
                        z-[25] > right cell clip-path stacking context (z:auto).
                        bg-surface always opaque — acts as a paint mask over scrolled bars.
                        Tint overlay is -z-[1] (behind flex children, above the bg). */}
                    <div
                      className={cn(
                        'sticky left-0 z-[25] shrink-0 border-r border-b border-border flex items-center pl-4 pr-4 gap-2 cursor-pointer overflow-hidden bg-surface transition-colors',
                        !isSelected && !isLate && !isBlocked && !hasOverlap && 'group-hover:bg-elevated',
                      )}
                      style={{ width: LEFT_COL_WIDTH, height: ROW_HEIGHT, borderLeft: `6px solid ${hexToRgba(project?.color ?? '#2563EB', 0.55)}` }}
                      onClick={() => handleTaskClick(task)}
                    >
                      {/* Tint overlay — behind all flex content */}
                      {(isSelected || isLate || isBlocked || hasOverlap) && (
                        <div className={cn(
                          'absolute inset-0 pointer-events-none z-[-1] transition-colors',
                          isSelected
                            ? 'bg-primary/8'
                            : isLate
                            ? 'bg-red-500/[0.04] group-hover:bg-red-500/[0.065]'
                            : isBlocked
                            ? 'bg-orange-500/[0.04] group-hover:bg-orange-500/[0.065]'
                            : 'bg-yellow-500/[0.03] group-hover:bg-yellow-500/[0.05]',
                        )} />
                      )}
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project?.color ?? '#2563EB' }} />
                      <span className={cn('text-sm text-foreground truncate min-w-0 flex-1', (task.status === 'done' || task.status === 'validated') && 'line-through text-muted-foreground')}>
                        {task.title}
                      </span>
                      {/* Alert-mode badge — simple pill, overrides generic warning icon */}
                      {isRowAlertHighlighted ? (
                        <span className={cn(
                          'shrink-0 text-[10px] font-700 px-1.5 py-0.5 rounded-full',
                          activeAlert?.type === 'artisan_overlap'
                            ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                            : 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
                        )}>
                          {activeAlert?.type === 'artisan_overlap' ? 'Conflit' : 'Ordre'}
                        </span>
                      ) : (isLate || isBlocked || hasOverlap) && (
                        <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', isLate ? 'text-red-500' : isBlocked ? 'text-orange-500' : 'text-yellow-500')} />
                      )}
                      {task.assignee && (
                        <span
                          className="w-5 h-5 rounded shrink-0 text-[10px] font-700 text-white flex items-center justify-center"
                          style={{ background: task.assignee.color }}
                          title={task.assignee.full_name}
                        >
                          {task.assignee.full_name[0]}
                        </span>
                      )}
                    </div>
                    {/* Right cell — clip-path: inset(0) clips ALL visual output (content + shadows).
                        Creates a stacking context at z:auto < sticky cell z-[25].
                        More reliable than overflow:clip for shadow clipping across browsers. */}
                    <div
                      className={cn(
                        'relative border-b border-border transition-colors [clip-path:inset(0)]',
                        isLate
                          ? 'bg-red-500/[0.02] group-hover:bg-red-500/[0.04]'
                          : isBlocked
                          ? 'bg-orange-500/[0.02] group-hover:bg-orange-500/[0.04]'
                          : hasOverlap
                          ? 'bg-yellow-500/[0.015] group-hover:bg-yellow-500/[0.03]'
                          : 'group-hover:bg-elevated/30'
                      )}
                      style={{ width: totalDays * dayW, height: ROW_HEIGHT }}
                    >
                      {monthSegments.map((seg, idx) => (
                        <div key={idx} className="absolute inset-y-0 pointer-events-none" style={{ left: seg.left, width: seg.width }}>
                          {seg.isOdd && <div className="absolute inset-0 bg-foreground/[0.02]" />}
                          {idx > 0 && <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-border/60" />}
                        </div>
                      ))}
                      {weekStarts.map(left => (
                        <div key={`w-${left}`} className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none" style={{ left }} />
                      ))}
                      {renderProjectBar(task, project)}
                    </div>
                  </div>
                )
              })}

              {/* Dependency arrows — SVG overlay positioned over the data rows.
                  pointer-events:none on container; overlap/inverted elements override
                  to 'stroke'/'all' so native SVG <title> tooltips work on hover.
                  Drawn in vue Global only; vue Par artisan opts out for MVP.
                  Three visual categories (LOT 6.C.4) :
                    normal   — solid gray Z-shape (proper FS)
                    overlap  — dashed orange above-routing (child starts before parent ends)
                    inverted — discrete red triangle badge (chronological anomaly) */}
              {visibleDeps.length > 0 && ganttRows.length > 0 && (
                <svg
                  className="absolute"
                  style={{
                    left: LEFT_COL_WIDTH,
                    top: HEADER_HEIGHT,
                    width: totalDays * dayW,
                    height: ganttRows.length * ROW_HEIGHT,
                    zIndex: 15,
                    pointerEvents: 'none',
                    overflow: 'visible',
                  }}
                >
                  <defs>
                    <marker id="gantt-arr-normal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                      <path d="M0,2 L10,5 L0,8 z" fill="#94a3b8" />
                    </marker>
                    <marker id="gantt-arr-direct" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                      <path d="M0,2 L10,5 L0,8 z" fill="#3b82f6" />
                    </marker>
                    <marker id="gantt-arr-overlap" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                      <path d="M0,2 L10,5 L0,8 z" fill="#f97316" />
                    </marker>
                  </defs>
                  {/* LOT 15.E.11 — SVG overlays (hatch, violet arrow) removed.
                      Analysis context is conveyed by the right panel only.
                      Normal dep arcs are hidden during analysis mode (clean Gantt). */}
                  {visibleDeps.map(d => {
                    const parent = taskLayout.get(d.depends_on_task_id)!
                    const child = taskLayout.get(d.task_id)!
                    const x1 = parent.endX, y1 = parent.centerY
                    const x2 = child.startX, y2 = child.centerY
                    const BAR_HALF = 14
                    const key = `${d.task_id}-${d.depends_on_task_id}`

                    // x1 = parent.endX (right edge), x2 = child.startX (left edge)
                    let kind: 'normal' | 'overlap' | 'inverted'
                    if (x1 <= x2) kind = 'normal'
                    else if (x2 > parent.startX) kind = 'overlap'
                    else kind = 'inverted'

                    // LOT 15.E.11 — dep arcs hidden entirely during analysis mode.
                    // The right panel explains the conflict; the Gantt stays clean.
                    if (activeAlert !== null) return null

                    // LOT 6.C.5 — focus mode :
                    //   selection active : on n'affiche QUE les liens directs ;
                    //   pas de sélection : on n'affiche QUE les liens normaux FS (discrets).
                    const isDirect = selectedId !== null
                      && (d.task_id === selectedId || d.depends_on_task_id === selectedId)
                    if (selectedId !== null && !isDirect) return null
                    if (selectedId === null && kind !== 'normal') return null

                    if (kind === 'normal') {
                      const dx = Math.max(18, Math.min(80, (x2 - x1) * 0.45))
                      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
                      return (
                        <path
                          key={key}
                          d={path}
                          stroke={isDirect ? '#3b82f6' : '#64748b'}
                          strokeWidth={isDirect ? 2 : 1.5}
                          strokeLinecap="round"
                          fill="none"
                          opacity={isDirect ? 1 : 0.45}
                          markerEnd={isDirect ? 'url(#gantt-arr-direct)' : 'url(#gantt-arr-normal)'}
                        />
                      )
                    }

                    if (kind === 'overlap') {
                      const laneY = Math.min(y1, y2) - BAR_HALF - 14
                      const path = `M ${x1} ${y1} C ${x1 + 24} ${laneY}, ${x2 - 24} ${laneY}, ${x2} ${y2}`
                      return (
                        <g key={key} pointerEvents="stroke">
                          <title>Attention : cette tâche commence avant la fin de son prédécesseur.</title>
                          <path
                            d={path}
                            stroke="#f97316"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeDasharray="5 3"
                            fill="none"
                            opacity={0.9}
                            markerEnd="url(#gantt-arr-overlap)"
                          />
                        </g>
                      )
                    }

                    // inverted — badge with ! indicator
                    const badgeX = Math.min(child.endX + 10, totalDays * dayW - 12)
                    return (
                      <g key={key} pointerEvents="all">
                        <title>{"Attention : cette tâche est planifiée avant son prédécesseur. Le sens de la dépendance est peut-être inversé."}</title>
                        <line
                          x1={child.endX} y1={y2}
                          x2={badgeX - 8} y2={y2}
                          stroke="#dc2626" strokeWidth={1.25} strokeDasharray="3 2" opacity={0.75}
                        />
                        <circle cx={badgeX} cy={y2} r={7} fill="#dc2626" opacity={0.9} />
                        <text x={badgeX} y={y2 + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="white" fontWeight="bold" style={{ pointerEvents: 'none' }}>!</text>
                      </g>
                    )
                  })}
                </svg>
              )}

              {/* LOT 27E — l'état vide est rendu en overlay du viewport (largeur
                  visible), voir plus bas, pour rester centré à l'écran. */}
            </div>
          </div>
        )}

          {/* LOT 27E — état vide (overlay du viewport, largeur visible, centré) */}
          {ganttMode === 'project' && ganttRows.length === 0 && (() => {
            const totalTasks = localTasks.length + undatedTasks.length
            const activeChips: { label: string; value: string }[] = []
            if (filterProject !== 'all') activeChips.push({ label: 'Chantier', value: projects.find(p => p.id === filterProject)?.name ?? '—' })
            if (filterArtisan !== 'all') activeChips.push({ label: 'Artisan', value: artisans.find(a => a.id === filterArtisan)?.full_name ?? '—' })
            if (filterStatus !== 'all') activeChips.push({ label: 'Statut', value: taskStatusLabel(filterStatus as TaskStatus) })
            if (showCompleted) activeChips.push({ label: 'Options', value: 'Terminées incluses' })

            let content
            if (totalTasks === 0) {
              // Cas C — aucune tâche du tout
              content = (
                <>
                  <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Inbox className="h-5 w-5 text-primary" /></span>
                  <h3 className="text-base font-700 text-foreground">Votre planning est vide</h3>
                  <p className="text-sm text-muted-foreground">Créez votre première tâche pour commencer à planifier vos chantiers.</p>
                  {onNewTask && (
                    <button onClick={onNewTask} className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-600 bg-primary text-white hover:bg-primary/90 transition-colors">
                      <Plus className="h-4 w-4" /> Nouvelle tâche
                    </button>
                  )}
                </>
              )
            } else if (hasActiveFilters) {
              // Cas A — aucun résultat à cause des filtres
              content = (
                <>
                  <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><SlidersHorizontal className="h-5 w-5 text-primary" /></span>
                  <h3 className="text-base font-700 text-foreground">Aucune tâche ne correspond à vos filtres</h3>
                  <p className="text-sm text-muted-foreground">Modifiez les filtres ou réinitialisez-les pour afficher davantage de tâches.</p>
                  {activeChips.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-0.5">
                      {activeChips.map((c, i) => (
                        <span key={i} className="text-[11px] font-600 px-2 py-0.5 rounded-full bg-elevated border border-border text-foreground">
                          <span className="text-muted-foreground/70">{c.label} : </span>{c.value}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <button onClick={resetFilters} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-600 bg-primary text-white hover:bg-primary/90 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser les filtres
                    </button>
                    <button onClick={() => { resetFilters(); setShowCompleted(true); setShowUndated(true) }} className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-600 border border-border text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors">
                      Afficher toutes les tâches
                    </button>
                  </div>
                </>
              )
            } else {
              // Cas B — pas de tâche datée sur la période visible
              content = (
                <>
                  <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Calendar className="h-5 w-5 text-primary" /></span>
                  <h3 className="text-base font-700 text-foreground">Aucune tâche sur cette période</h3>
                  <p className="text-sm text-muted-foreground">Naviguez vers une autre période ou créez une nouvelle tâche.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <button onClick={navigateToday} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-600 bg-primary text-white hover:bg-primary/90 transition-colors">
                      <Calendar className="h-3.5 w-3.5" /> Aujourd&apos;hui
                    </button>
                    {onNewTask && (
                      <button onClick={onNewTask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-600 border border-border text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Nouvelle tâche
                      </button>
                    )}
                  </div>
                </>
              )
            }

            return (
              <div className="absolute inset-x-0 z-[10] flex items-start justify-center px-6 pt-12 pointer-events-none" style={{ top: HEADER_HEIGHT, bottom: 0 }}>
                <div className="max-w-sm w-full text-center bg-surface border border-border rounded-2xl shadow-sm px-6 py-8 flex flex-col items-center gap-3 pointer-events-auto">
                  {content}
                </div>
              </div>
            )
          })()}

          </div>{/* end gantt viewport */}

          {/* ── Right aside — Analyse & résolution ────────────────────────────── */}
          {isPanelOpen && (
            <aside className="w-[380px] shrink-0 border-l border-border bg-surface overflow-y-auto flex flex-col">

              {/* ── Alert analysis panel ── */}
              {alertPanelData && ganttMode === 'project' && (
                <div ref={analysisPanelRef} className={cn(
                  'border-b-2 bg-surface',
                  alertPanelData.isArtisan ? 'border-orange-500/50' : 'border-violet-500/50',
                )}>
                  <div className="px-4 py-4 flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span className="text-base">{alertPanelData.isArtisan ? '🔻' : '🔗'}</span>
                      <span className={cn(
                        'text-xs font-700 uppercase tracking-wider',
                        alertPanelData.isArtisan
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-violet-600 dark:text-violet-400',
                      )}>
                        {alertPanelData.isArtisan ? "Chevauchement d'intervenant" : 'Ordre de dépendance incohérent'}
                      </span>
                    </div>

                    {/* Analysis message */}
                    <p className={cn(
                      'text-xs font-600 leading-relaxed',
                      alertPanelData.isArtisan
                        ? 'text-orange-700 dark:text-orange-300'
                        : 'text-violet-700 dark:text-violet-300',
                    )}>
                      {alertPanelData.analysisMessage}
                    </p>

                    {/* Task details */}
                    {alertPanelData.parentTask && alertPanelData.childTask && (
                      alertPanelData.isArtisan ? (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <span className="text-foreground/70">Tâche A : </span>
                          <span className="font-600 text-foreground">{alertPanelData.childTask.title}</span>
                          {alertPanelData.childTask.project?.name && (
                            <span className="text-muted-foreground/60"> ({alertPanelData.childTask.project.name})</span>
                          )}
                          <span className="mx-1.5 text-amber-400">·</span>
                          <span className="text-foreground/70">Tâche B : </span>
                          <span className="font-600 text-foreground">{alertPanelData.parentTask.title}</span>
                          {alertPanelData.parentTask.project?.name && (
                            <span className="text-muted-foreground/60"> ({alertPanelData.parentTask.project.name})</span>
                          )}
                          {alertPanelData.childTask.assignee?.full_name && (
                            <>
                              <span className="mx-1.5 text-amber-400">·</span>
                              <span className="text-foreground/70">Intervenant : </span>
                              <span className="font-600 text-foreground">{alertPanelData.childTask.assignee.full_name}</span>
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <span className="text-foreground/70">Prédécesseur : </span>
                          <span className="font-600 text-foreground">{alertPanelData.parentTask.title}</span>
                          {alertPanelData.parentTask.project?.name && (
                            <span className="text-muted-foreground/60"> ({alertPanelData.parentTask.project.name})</span>
                          )}
                          {alertPanelData.parentTask.end_date && (
                            <span> · fin {formatDate(alertPanelData.parentTask.end_date)}</span>
                          )}
                          <span className="mx-1.5 text-violet-400">→</span>
                          <span className="text-foreground/70">Successeur : </span>
                          <span className="font-600 text-foreground">{alertPanelData.childTask.title}</span>
                          {alertPanelData.childTask.project?.name && (
                            <span className="text-muted-foreground/60"> ({alertPanelData.childTask.project.name})</span>
                          )}
                          {alertPanelData.childTask.start_date && (
                            <span> · début {formatDate(alertPanelData.childTask.start_date)}</span>
                          )}
                        </p>
                      )
                    )}

                    {/* Artisan overlap period */}
                    {alertPanelData.overlapStart && alertPanelData.overlapEnd && alertPanelData.isArtisan && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-600">
                        Période de chevauchement : {formatDate(alertPanelData.overlapStart)} → {formatDate(alertPanelData.overlapEnd)}
                      </p>
                    )}

                    {/* Dependency logical gap */}
                    {alertPanelData.daysEarly !== null && !alertPanelData.isArtisan && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-600">
                        Décalage logique : le successeur démarre {alertPanelData.daysEarly} jour{alertPanelData.daysEarly > 1 ? 's' : ''} trop tôt.
                      </p>
                    )}

                    {/* Action buttons — vertical stack for 380px column */}
                    <div className="flex flex-col gap-2 pt-1">
                      {alertPanelData.undatedTask && (
                        <button
                          onClick={() => {
                            const t = alertPanelData.undatedTask!
                            setActiveAlert(null)
                            setAutoEditTaskId(t.id)
                            setSelectedTask(t)
                            setShowUndated(true)
                            setUndatedOpen(true)
                          }}
                          className="w-full text-xs px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-600 text-center"
                        >
                          Planifier cette tâche
                        </button>
                      )}
                      {!alertPanelData.undatedTask && alertPanelData.isArtisan && alertPanelData.childTask && alertPanelData.parentTask && (
                        <>
                          <button
                            onClick={() => { const t = alertPanelData.childTask!; setAutoEditTaskId(t.id); setSelectedTask(t) }}
                            className="flex flex-col items-start text-left text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-600 w-full"
                            title={`Modifier les dates de « ${alertPanelData.childTask.title} »`}
                          >
                            <span className="truncate w-full">Modifier «&thinsp;{alertPanelData.childTask.title}&thinsp;»</span>
                            {alertPanelData.childTask.project?.name && (
                              <span className="text-[10px] font-400 opacity-70 truncate w-full mt-0.5">{alertPanelData.childTask.project.name}</span>
                            )}
                          </button>
                          <button
                            onClick={() => { const t = alertPanelData.parentTask!; setAutoEditTaskId(t.id); setSelectedTask(t) }}
                            className="flex flex-col items-start text-left text-xs px-3 py-2 rounded-lg border border-primary/60 text-primary hover:bg-primary/10 transition-colors font-600 w-full"
                            title={`Modifier les dates de « ${alertPanelData.parentTask.title} »`}
                          >
                            <span className="truncate w-full">Modifier «&thinsp;{alertPanelData.parentTask.title}&thinsp;»</span>
                            {alertPanelData.parentTask.project?.name && (
                              <span className="text-[10px] font-400 opacity-70 truncate w-full mt-0.5">{alertPanelData.parentTask.project.name}</span>
                            )}
                          </button>
                        </>
                      )}
                      {!alertPanelData.undatedTask && !alertPanelData.isArtisan && alertPanelData.childTask && alertPanelData.parentTask && (
                        <>
                          <button
                            onClick={() => { const t = alertPanelData.parentTask!; setAutoEditTaskId(t.id); setSelectedTask(t) }}
                            className="flex flex-col items-start text-left text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-600 w-full"
                          >
                            <span>Modifier le prédécesseur</span>
                            {alertPanelData.parentTask.project?.name && (
                              <span className="text-[10px] font-400 opacity-70 mt-0.5">{alertPanelData.parentTask.project.name}</span>
                            )}
                          </button>
                          <button
                            onClick={() => { const t = alertPanelData.childTask!; setAutoEditTaskId(t.id); setSelectedTask(t) }}
                            className="flex flex-col items-start text-left text-xs px-3 py-2 rounded-lg border border-violet-500/60 text-violet-700 dark:text-violet-400 hover:bg-violet-500/10 transition-colors font-600 w-full"
                          >
                            <span>Modifier le successeur</span>
                            {alertPanelData.childTask.project?.name && (
                              <span className="text-[10px] font-400 opacity-70 mt-0.5">{alertPanelData.childTask.project.name}</span>
                            )}
                          </button>
                        </>
                      )}
                      {!alertPanelData.undatedTask && alertPanelData.childTask && !alertPanelData.parentTask && (
                        <button
                          onClick={() => { const t = alertPanelData.childTask!; setAutoEditTaskId(t.id); setSelectedTask(t) }}
                          className="w-full text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-600 text-center"
                        >
                          Modifier les dates
                        </button>
                      )}
                      <button
                        onClick={() => setActiveAlert(null)}
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors text-center"
                      >
                        Quitter l'analyse
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Alertes & résolution ── */}
              {planningAlerts.length > 0 && (
                <div className="flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <span className="text-xs font-700 uppercase tracking-wider text-orange-600 dark:text-orange-400 flex-1">
                      Alertes &amp; résolution ({planningAlerts.length})
                    </span>
                  </div>

                  {/* Summary chips */}
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                    {SUMMARY_ORDER.filter(k => alertSummary[k] > 0).map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setActiveKindFilter(f => f === k ? null : k)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-600 transition-colors',
                          KIND_META[k].chip,
                          activeKindFilter === k && 'ring-2 ring-current ring-offset-1 ring-offset-surface',
                        )}
                        title={activeKindFilter === k ? 'Afficher toutes les alertes' : `Filtrer : ${KIND_META[k].label}`}
                      >
                        <span aria-hidden>{KIND_META[k].icon}</span>
                        {alertSummary[k]} {summaryLabel[k](alertSummary[k])}
                      </button>
                    ))}
                    {activeKindFilter && (
                      <button
                        type="button"
                        onClick={() => setActiveKindFilter(null)}
                        className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Tout afficher
                      </button>
                    )}
                  </div>

                  {/* Alert cards */}
                  <div className="px-4 pb-4 flex flex-col gap-2">
                    {(activeKindFilter ? planningAlerts.filter(a => a.kind === activeKindFilter) : planningAlerts).map(alert => {
                      const meta = KIND_META[alert.kind]
                      const sev = SEVERITY_META[alert.severity]
                      const hasDates = alert.startDate && alert.endDate
                      return (
                        <div
                          key={alert.id}
                          className="flex flex-col gap-2 p-3 rounded-xl bg-background border border-border/60"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-700 uppercase tracking-wide', meta.badge)}>
                              <span aria-hidden>{meta.icon}</span> {meta.label}
                            </span>
                            <span className={cn('inline-flex items-center gap-1 text-[10px] font-600', sev.cls)}>
                              <span className={cn('w-1.5 h-1.5 rounded-full', sev.dot)} /> {sev.label}
                            </span>
                            <span className="flex-1" />
                            {alert.projectName && (
                              <span className="text-[11px] text-muted-foreground/60 truncate max-w-[40%]">{alert.projectName}</span>
                            )}
                          </div>
                          <p className="text-[13px] font-600 text-foreground leading-snug">{alert.taskTitle}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{alert.explain}</p>
                          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground/60">
                            {hasDates && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(alert.startDate!)} → {formatDate(alert.endDate!)}
                              </span>
                            )}
                            <span>
                              {alert.assigneeName
                                ? alert.assigneeName
                                : <span className="italic text-muted-foreground/40">Non assigné</span>}
                            </span>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAlertAction(alert)}
                              className={cn(
                                'inline-flex items-center gap-1 text-[11px] font-600 px-3 py-1.5 rounded-lg transition-colors',
                                alert.severity === 'high'
                                  ? 'bg-primary text-white hover:bg-primary/90'
                                  : 'border border-border text-foreground hover:bg-elevated',
                              )}
                            >
                              {alert.actionLabel}
                              <ChevronRightSm className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Tâches à planifier ── */}
              {showUndated && undatedTasks.length > 0 && (
                <div className="border-t border-border">
                  <button
                    onClick={() => setUndatedOpen(o => !o)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground hover:bg-elevated transition-colors"
                  >
                    {undatedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightSm className="h-3.5 w-3.5" />}
                    Tâches à planifier ({filteredUndated.length})
                  </button>
                  {undatedOpen && (
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      {filteredUndated.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Aucune tâche à planifier pour ce filtre.</p>
                      ) : (
                        filteredUndated.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg text-sm"
                          >
                            {task.project && (
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: task.project.color }} />
                            )}
                            <span className="text-foreground flex-1 truncate min-w-0">{task.title}</span>
                            {task.assignee && (
                              <span
                                className="w-5 h-5 rounded text-[10px] font-700 text-white flex items-center justify-center shrink-0"
                                style={{ background: task.assignee.color }}
                                title={task.assignee.full_name}
                              >
                                {task.assignee.full_name[0]}
                              </span>
                            )}
                            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-600 shrink-0', taskStatusColor(task.status))}>
                              {taskStatusLabel(task.status)}
                            </span>
                            <button
                              onClick={() => { setAutoEditTaskId(task.id); setSelectedTask(task) }}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
                            >
                              <Calendar className="h-3 w-3" />
                              Planifier
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

            </aside>
          )}{/* end right aside */}

        </div>{/* end horizontal body */}

      </div>{/* end planning card */}

      {/* ── Task sidewindow — unique editing interface for the Gantt ── */}
      <TaskSidePanel
        task={sidePanelTask}
        conflicts={conflicts}
        artisans={artisans}
        teams={teams}
        autoEdit={!!sidePanelTask && autoEditTaskId === sidePanelTask.id}
        availableTasks={localTasks}
        onClose={handleSideClose}
        onTaskUpdated={handleTaskUpdated}
        onDependenciesChanged={fetchDependencies}
        filterMatches={filterMatches}
        onHistoryPush={historyPush}
      />

      {/* ── Custom tooltip ── */}
      {/* Tooltip — must stay BELOW the TaskSidePanel (z-[9001]) so it can't bleed
          over the sidewindow when hovering a bar near the right edge (LOT 6.C.5). */}
      {tooltip && !selectedTask && (
        <div
          className="fixed z-[8000] bg-surface border border-border rounded-lg shadow-lg px-3 py-2 pointer-events-none max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-xs font-700 text-foreground leading-tight mb-0.5">{tooltip.task.title}</p>
          <p className="text-xs text-muted-foreground">
            {tooltip.task.project?.name && <span>{tooltip.task.project.name} · </span>}
            {formatDate(tooltip.task.start_date)} → {formatDate(tooltip.task.end_date)}
          </p>
          {tooltip.task.assignee && (
            <p className="text-xs text-muted-foreground mt-0.5">{tooltip.task.assignee.full_name}</p>
          )}
        </div>
      )}
    </>
  )
}
