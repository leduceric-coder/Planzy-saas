'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Edit2, ExternalLink, Calendar, AlertTriangle, Save, Link2, Trash2, Plus, Users } from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate } from '@/lib/utils'
import { mutationClient } from '@/lib/supabase/mutate'
import { useToast } from '@/components/ui/toast-context'
import type { Task, TaskStatus } from '@/lib/types'
import { AssignmentPicker } from '@/components/ui/AssignmentPicker'
import { type HistoryAction } from '@/lib/hooks/useUndoHistory'
import { useRole, useArtisanScope } from '@/components/layout/RoleContext'
import { canEditTaskFields, canUpdateTaskStatus } from '@/lib/taskPermissions'

type GanttTask = Task & {
  assignee?: { id: string; full_name: string; color: string } | null
  assigned_team?: string | null
  team?: { id: string; name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

interface GanttConflict {
  type: 'late' | 'blocked' | 'overlap' | 'dependency'
  taskId: string
  message: string
}

/**
 * Compute the warning attached to a "this task depends on parent" relation,
 * from the child's perspective. Returns null when the relation is consistent
 * or when there is nothing actionable to report.
 *
 * Severity order :
 *  1. dates manquantes → "Dépendance non vérifiable…"
 *  2. enfant entièrement avant parent → "sens peut-être inversé"
 *  3. enfant commence avant la fin du parent → "chevauchement"
 */
export function buildPredecessorWarning(
  thisTask: GanttTask,
  parent: GanttTask | undefined,
): string | null {
  if (!parent) return null
  if (!thisTask.start_date || !thisTask.end_date || !parent.start_date || !parent.end_date) {
    return 'Dépendance non vérifiable : dates manquantes.'
  }
  if (thisTask.end_date < parent.start_date) {
    return "Attention : cette tâche est planifiée avant son prédécesseur. Le sens de la dépendance est peut-être inversé."
  }
  if (thisTask.start_date < parent.end_date) {
    return 'Attention : cette tâche commence avant la fin de son prédécesseur.'
  }
  return null
}

/** Mirror of buildPredecessorWarning, from the parent's perspective. */
export function buildSuccessorWarning(
  thisTask: GanttTask,
  child: GanttTask | undefined,
): string | null {
  if (!child) return null
  if (!thisTask.start_date || !thisTask.end_date || !child.start_date || !child.end_date) {
    return 'Dépendance non vérifiable : dates manquantes.'
  }
  if (child.end_date < thisTask.start_date) {
    return 'Attention : ce successeur est planifié avant cette tâche. Le sens de la dépendance est peut-être inversé.'
  }
  if (child.start_date < thisTask.end_date) {
    return 'Attention : ce successeur commence avant la fin de cette tâche.'
  }
  return null
}

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'review', 'done', 'validated']

export interface TaskUpdatePatch {
  title?: string
  start_date?: string | null
  end_date?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical' | null
  description?: string | null
  assigned_to?: string | null
  assigned_team?: string | null
  assignee?: { id: string; full_name: string; color: string } | null
  team?: { id: string; name: string; color: string } | null
  status?: TaskStatus
}

export type { HistoryAction }

interface Props {
  task: GanttTask | null
  conflicts?: GanttConflict[]
  artisans?: { id: string; full_name: string; trade?: string | null; color: string }[]
  teams?: { id: string; name: string; color: string | null; type: string | null; memberCount: number }[]
  autoEdit?: boolean
  /** All tasks visible to the user — used as the candidate list for adding a dependency. */
  availableTasks?: GanttTask[]
  onClose: () => void
  /** Called after a successful Supabase update so the Gantt can merge fields into localTasks. */
  onTaskUpdated?: (taskId: string, patch: TaskUpdatePatch) => void
  /** Called after a successful dependency add or delete — lets the parent refetch the graph. */
  onDependenciesChanged?: () => void
  /** Returns true if the updated task would still match the current Gantt filters. */
  filterMatches?: (task: GanttTask) => boolean
  /** Called after a successful mutation so GanttView can push to the undo/redo stack. */
  onHistoryPush?: (action: HistoryAction) => void
}

interface DependencyRow {
  id: string
  task_id: string
  depends_on_task_id: string
}

type DepEdge = { task_id: string; depends_on_task_id: string }

/**
 * Pure cycle-detection helper.
 *
 * Edge convention in DB: { task_id: X, depends_on_task_id: Y } means X depends on Y
 * (graph edge X → Y in the "depends on" direction).
 *
 * Adding edge `taskId → dependsOnTaskId` creates a cycle iff there is already a
 * path `dependsOnTaskId → ... → taskId` in the current graph.
 *
 * Equivalently: the cycle-forbidden set is { taskId } ∪ all tasks that currently
 * depend on taskId transitively (descendants in the reverse adjacency).
 * We BFS from taskId walking reverse edges; if dependsOnTaskId is reached the
 * insert would close a cycle.
 */
export function wouldCreateCycle(args: {
  taskId: string
  dependsOnTaskId: string
  dependencies: DepEdge[]
}): boolean {
  const { taskId, dependsOnTaskId, dependencies } = args
  return computeCycleForbidden(taskId, dependencies).has(dependsOnTaskId)
}

function computeCycleForbidden(taskId: string, deps: DepEdge[]): Set<string> {
  // Reverse adjacency: dep_on -> [task_ids that depend on it]
  const revAdj = new Map<string, string[]>()
  for (const d of deps) {
    const arr = revAdj.get(d.depends_on_task_id) ?? []
    arr.push(d.task_id)
    revAdj.set(d.depends_on_task_id, arr)
  }
  const forbidden = new Set<string>([taskId])
  const queue: string[] = [taskId]
  while (queue.length > 0) {
    const node = queue.shift()!
    for (const next of revAdj.get(node) ?? []) {
      if (!forbidden.has(next)) {
        forbidden.add(next)
        queue.push(next)
      }
    }
  }
  return forbidden
}

export function TaskSidePanel({
  task,
  conflicts = [],
  artisans = [],
  teams = [],
  autoEdit = false,
  availableTasks = [],
  onClose,
  onTaskUpdated,
  onDependenciesChanged,
  filterMatches,
  onHistoryPush,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [localStatus, setLocalStatus] = useState<TaskStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // LOT 42E1C — alignement de l'affichage sur la sécurité 42E1B. Les champs
  // administratifs sont réservés aux rôles internes ; l'avancement n'est
  // proposé à l'artisan que sur une tâche réellement affectée (ATA ∪
  // assigned_to), jamais sur une tâche seulement visible via son chantier.
  const currentRole = useRole()
  const { artisanId, assignedTaskIds } = useArtisanScope()
  const canEditFields = canEditTaskFields(currentRole)
  const canChangeStatus = task ? canUpdateTaskStatus(currentRole, task, artisanId, assignedTaskIds) : false
  const [editError, setEditError] = useState<string | null>(null)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAssignment, setEditAssignment] = useState<{ assigned_to: string | null; assigned_team: string | null }>({ assigned_to: null, assigned_team: null })
  // Keep editAssigneeId in sync for undo/redo and display compatibility
  const editAssigneeId = editAssignment.assigned_to ?? ''

  // Dependencies state
  const [deps, setDeps] = useState<DependencyRow[]>([])
  const [depsLoading, setDepsLoading] = useState(false)
  const [depAddOpen, setDepAddOpen] = useState(false)
  const [depAddId, setDepAddId] = useState('')
  const [depSaving, setDepSaving] = useState(false)
  // Full dependency graph (org-scoped via RLS) — loaded when the combobox opens
  // so we can detect deep cycles before insert.
  const [allDeps, setAllDeps] = useState<DepEdge[] | null>(null)
  const [allDepsLoading, setAllDepsLoading] = useState(false)

  const enterEdit = (t: GanttTask) => {
    setEditTitle(t.title)
    setEditStartDate(t.start_date ?? '')
    setEditEndDate(t.end_date ?? '')
    setEditPriority(t.priority ?? '')
    setEditDescription(t.description ?? '')
    setEditAssignment({ assigned_to: t.assignee?.id ?? null, assigned_team: t.assigned_team ?? null })
    setEditError(null)
    setIsEditing(true)
  }

  // Reset on task change, optionally auto-enter edit mode (used by "Planifier" on undated tasks)
  useEffect(() => {
    setLocalStatus(null)
    setEditError(null)
    setDepAddOpen(false)
    setDepAddId('')
    setAllDeps(null)
    if (task && autoEdit) {
      enterEdit(task)
    } else {
      setIsEditing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, autoEdit])

  // Lazy-load the full dependency graph when the user opens the combobox
  useEffect(() => {
    if (!depAddOpen || allDeps !== null) return
    let cancelled = false
    setAllDepsLoading(true)
    ;(async () => {
      const { data, error } = await mutationClient()
        .from('task_dependencies')
        .select('task_id, depends_on_task_id')
      if (cancelled) return
      setAllDeps(error ? [] : ((data ?? []) as DepEdge[]))
      setAllDepsLoading(false)
    })()
    return () => { cancelled = true }
  }, [depAddOpen, allDeps])

  // Fetch dependencies (both directions) whenever the selected task changes
  useEffect(() => {
    if (!task) { setDeps([]); return }
    let cancelled = false
    setDepsLoading(true)
    ;(async () => {
      const { data, error } = await mutationClient()
        .from('task_dependencies')
        .select('id, task_id, depends_on_task_id')
        .or(`task_id.eq.${task.id},depends_on_task_id.eq.${task.id}`)
      if (cancelled) return
      if (error) {
        setDeps([])
      } else {
        setDeps((data ?? []) as DependencyRow[])
      }
      setDepsLoading(false)
    })()
    return () => { cancelled = true }
  }, [task?.id])

  // Lookup helper
  const findTask = (id: string): GanttTask | undefined =>
    availableTasks.find(t => t.id === id)

  const upstreamDeps = task ? deps.filter(d => d.task_id === task.id) : []
  const downstreamDeps = task ? deps.filter(d => d.depends_on_task_id === task.id) : []

  const handleAddDependency = async () => {
    if (!task || !depAddId || depSaving) return
    if (depAddId === task.id) {
      toast('Une tâche ne peut pas dépendre d\'elle-même', 'error')
      return
    }
    if (upstreamDeps.some(d => d.depends_on_task_id === depAddId)) {
      toast('Cette dépendance existe déjà', 'error')
      return
    }
    // Deep cycle check on the latest graph snapshot
    const graph = allDeps ?? []
    if (wouldCreateCycle({ taskId: task.id, dependsOnTaskId: depAddId, dependencies: graph })) {
      toast('Impossible d\'ajouter cette dépendance : elle créerait une boucle.', 'error')
      return
    }

    setDepSaving(true)
    const tempId = `tmp-${Date.now()}`
    const optimistic: DependencyRow = { id: tempId, task_id: task.id, depends_on_task_id: depAddId }
    setDeps(prev => [...prev, optimistic])
    setAllDeps(prev => prev ? [...prev, { task_id: task.id, depends_on_task_id: depAddId }] : prev)
    try {
      const { data, error } = await mutationClient()
        .from('task_dependencies')
        .insert({ task_id: task.id, depends_on_task_id: depAddId })
        .select('id, task_id, depends_on_task_id')
        .single()
      if (error) {
        setDeps(prev => prev.filter(d => d.id !== tempId))
        setAllDeps(prev => prev ? prev.filter(d => !(d.task_id === task.id && d.depends_on_task_id === depAddId)) : prev)
        toast(error.message?.includes('unique') ? 'Cette dépendance existe déjà' : 'Erreur : dépendance non enregistrée', 'error')
        return
      }
      const inserted = data as DependencyRow
      setDeps(prev => prev.map(d => d.id === tempId ? inserted : d))
      setDepAddOpen(false)
      setDepAddId('')
      toast('Dépendance ajoutée')
      onDependenciesChanged?.()
      // idHolder tracks the live DB id across undo (delete) + redo (re-insert)
      const idHolder = { current: inserted.id }
      onHistoryPush?.({
        id: `dep-add-${inserted.id}`,
        label: 'Dépendance ajoutée',
        undo: async () => {
          const { error: delErr } = await mutationClient()
            .from('task_dependencies').delete().eq('id', idHolder.current)
          if (delErr) throw delErr
          setDeps(prev => prev.filter(d => d.id !== idHolder.current))
          setAllDeps(prev => prev
            ? prev.filter(d => !(d.task_id === inserted.task_id && d.depends_on_task_id === inserted.depends_on_task_id))
            : prev)
          onDependenciesChanged?.()
        },
        redo: async () => {
          const { data: reins, error: insErr } = await mutationClient()
            .from('task_dependencies')
            .insert({ task_id: inserted.task_id, depends_on_task_id: inserted.depends_on_task_id })
            .select('id, task_id, depends_on_task_id')
            .single()
          if (insErr) throw insErr
          const reinserted = reins as DependencyRow
          idHolder.current = reinserted.id
          setDeps(prev => [...prev, reinserted])
          setAllDeps(prev => prev
            ? [...prev, { task_id: inserted.task_id, depends_on_task_id: inserted.depends_on_task_id }]
            : prev)
          onDependenciesChanged?.()
        },
      })
    } finally {
      setDepSaving(false)
    }
  }

  const handleRemoveDependency = async (depId: string) => {
    if (depSaving) return
    const previousDeps = deps
    const previousAllDeps = allDeps
    const removed = deps.find(d => d.id === depId)
    setDeps(prev => prev.filter(d => d.id !== depId))
    if (removed && allDeps) {
      setAllDeps(allDeps.filter(d => !(d.task_id === removed.task_id && d.depends_on_task_id === removed.depends_on_task_id)))
    }
    setDepSaving(true)
    try {
      const { error } = await mutationClient()
        .from('task_dependencies')
        .delete()
        .eq('id', depId)
      if (error) {
        setDeps(previousDeps)
        setAllDeps(previousAllDeps)
        toast('Erreur : suppression refusée', 'error')
        return
      }
      toast('Dépendance supprimée')
      onDependenciesChanged?.()
      if (removed) {
        const capturedRemoved = removed
        // idHolder tracks the live DB id: starts empty (row deleted), filled by undo (re-insert), used by redo (delete again)
        const idHolder = { current: '' }
        onHistoryPush?.({
          id: `dep-rm-${capturedRemoved.id}`,
          label: 'Dépendance supprimée',
          undo: async () => {
            const { data: reins, error: insErr } = await mutationClient()
              .from('task_dependencies')
              .insert({ task_id: capturedRemoved.task_id, depends_on_task_id: capturedRemoved.depends_on_task_id })
              .select('id, task_id, depends_on_task_id')
              .single()
            if (insErr) throw insErr
            const reinserted = reins as DependencyRow
            idHolder.current = reinserted.id
            setDeps(prev => [...prev, reinserted])
            setAllDeps(prev => prev
              ? [...prev, { task_id: capturedRemoved.task_id, depends_on_task_id: capturedRemoved.depends_on_task_id }]
              : prev)
            onDependenciesChanged?.()
          },
          redo: async () => {
            const { error: delErr } = await mutationClient()
              .from('task_dependencies').delete().eq('id', idHolder.current)
            if (delErr) throw delErr
            const latestId = idHolder.current
            setDeps(prev => prev.filter(d => d.id !== latestId))
            setAllDeps(prev => prev
              ? prev.filter(d => !(d.task_id === capturedRemoved.task_id && d.depends_on_task_id === capturedRemoved.depends_on_task_id))
              : prev)
            onDependenciesChanged?.()
          },
        })
      }
    } finally {
      setDepSaving(false)
    }
  }

  const displayStatus = (localStatus ?? task?.status) as TaskStatus | undefined

  const handleStatusChange = async (s: TaskStatus) => {
    if (!task || saving) return
    const prevStatus = task.status
    setLocalStatus(s)
    setSaving(true)
    try {
      // LOT 27C — on demande les lignes affectées (.select) : un UPDATE filtré par
      // RLS renvoie error=null MAIS 0 ligne. Sans ce contrôle, l'app affichait un
      // faux succès puis la valeur revenait au reload (bug d'édition signalé).
      const { data: updatedRows, error } = await mutationClient()
        .from('tasks')
        .update({ status: s })
        .eq('id', task.id)
        .select('id')
      if (error || !updatedRows || updatedRows.length === 0) {
        setLocalStatus(prevStatus)
        toast(
          error
            ? 'Erreur : statut non sauvegardé'
            : "Statut non enregistré : droits insuffisants ou tâche hors de votre organisation.",
          'error',
        )
        return
      }
      onTaskUpdated?.(task.id, { status: s })
      // Filter check — task may leave view if showCompleted=false and s in (done, validated)
      const updatedTask: GanttTask = { ...task, status: s }
      if (filterMatches && !filterMatches(updatedTask)) {
        toast('Statut enregistré. La tâche n\'est plus visible avec les filtres actuels.', 'error')
      }
      onHistoryPush?.({
        id: `status-${task.id}-${Date.now()}`,
        label: 'Statut modifié',
        undo: async () => {
          const { error: revErr } = await mutationClient()
            .from('tasks').update({ status: prevStatus }).eq('id', task.id)
          if (revErr) throw revErr
          setLocalStatus(null)
          onTaskUpdated?.(task.id, { status: prevStatus })
          router.refresh()
        },
        redo: async () => {
          const { error: redoErr } = await mutationClient()
            .from('tasks').update({ status: s }).eq('id', task.id)
          if (redoErr) throw redoErr
          onTaskUpdated?.(task.id, { status: s })
          router.refresh()
        },
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleEnterEdit = () => {
    if (!task) return
    enterEdit(task)
  }

  const handleSaveEdit = async () => {
    if (!task || saving) return

    const title = editTitle.trim() || task.title
    const startDate = editStartDate || null
    const endDate = editEndDate || null

    // Validate dates
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setEditError('Renseignez les deux dates ou aucune.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setEditError('La date de fin doit être postérieure à la date de début.')
      return
    }

    // Capture old values before any mutation for the undo closure
    const oldPatch: TaskUpdatePatch = {
      title: task.title,
      start_date: task.start_date ?? null,
      end_date: task.end_date ?? null,
      priority: (task.priority ?? null) as TaskUpdatePatch['priority'],
      description: task.description ?? null,
      assigned_to: task.assignee?.id ?? null,
      assigned_team: task.assigned_team ?? null,
      assignee: task.assignee ?? null,
      team: task.team ?? null,
    }
    const datesChanged = startDate !== (task.start_date ?? null) || endDate !== (task.end_date ?? null)
    const assigneeChanged =
      editAssignment.assigned_to !== (task.assignee?.id ?? null) ||
      editAssignment.assigned_team !== (task.assigned_team ?? null)
    const undoLabel = datesChanged && !assigneeChanged
      ? 'Dates modifiées'
      : assigneeChanged && !datesChanged
      ? 'Assigné modifié'
      : 'Modification enregistrée'

    setEditError(null)
    setSaving(true)
    try {
      const priorityValue = (editPriority || null) as TaskUpdatePatch['priority']
      const assignedToValue = editAssignment.assigned_to
      const assignedTeamValue = editAssignment.assigned_team
      const descriptionValue = editDescription || null

      // LOT 27C — .select() pour connaître les lignes réellement modifiées.
      // Un UPDATE bloqué par RLS renvoie error=null avec 0 ligne : on le traite
      // comme un échec (pas de faux succès, pas de merge local, message visible).
      const { data: updatedRows, error } = await mutationClient()
        .from('tasks')
        .update({
          title,
          start_date: startDate,
          end_date: endDate,
          priority: priorityValue,
          description: descriptionValue,
          assigned_to: assignedToValue,
          assigned_team: assignedTeamValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .select('id')

      if (error || !updatedRows || updatedRows.length === 0) {
        setEditError(
          error?.message ||
            "Modification refusée : droits insuffisants ou tâche hors de votre organisation.",
        )
        toast('Modification non sauvegardée', 'error')
        return
      }

      // Resolve new assignee + team objects from lists (preserves the JOIN locally)
      const newAssignee = assignedToValue
        ? artisans.find(a => a.id === assignedToValue) ?? null
        : null
      const newTeam = assignedTeamValue
        ? (teams.find(t => t.id === assignedTeamValue) ? { id: assignedTeamValue, name: teams.find(t => t.id === assignedTeamValue)!.name, color: teams.find(t => t.id === assignedTeamValue)!.color ?? '' } : null)
        : null

      const patch: TaskUpdatePatch = {
        title,
        start_date: startDate,
        end_date: endDate,
        priority: priorityValue,
        description: descriptionValue,
        assigned_to: assignedToValue,
        assigned_team: assignedTeamValue,
        assignee: newAssignee,
        team: newTeam,
      }

      onTaskUpdated?.(task.id, patch)

      const updatedTask = { ...task, ...patch, assignee: newAssignee, team: newTeam } as GanttTask

      // Detect if the task left the visible filtered set
      if (filterMatches && !filterMatches(updatedTask)) {
        toast('Modification enregistrée. La tâche n\'est plus visible avec les filtres actuels.', 'error')
      } else if (!startDate || !endDate) {
        toast('Modification enregistrée. La tâche est désormais sans dates (section "Tâches à planifier").', 'error')
      } else {
        toast('Modification enregistrée')
      }

      // Capture new values here (inside the try block, after patch is built)
      const savedPatch = patch
      onHistoryPush?.({
        id: `edit-${task.id}-${Date.now()}`,
        label: undoLabel,
        undo: async () => {
          const { error: revErr } = await mutationClient()
            .from('tasks')
            .update({
              title: oldPatch.title,
              start_date: oldPatch.start_date,
              end_date: oldPatch.end_date,
              priority: oldPatch.priority,
              description: oldPatch.description,
              assigned_to: oldPatch.assigned_to,
              assigned_team: oldPatch.assigned_team,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          if (revErr) throw revErr
          onTaskUpdated?.(task.id, oldPatch)
          router.refresh()
        },
        redo: async () => {
          const { error: redoErr } = await mutationClient()
            .from('tasks')
            .update({
              title: savedPatch.title,
              start_date: savedPatch.start_date,
              end_date: savedPatch.end_date,
              priority: savedPatch.priority,
              description: savedPatch.description,
              assigned_to: savedPatch.assigned_to,
              assigned_team: savedPatch.assigned_team,
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id)
          if (redoErr) throw redoErr
          onTaskUpdated?.(task.id, savedPatch)
          router.refresh()
        },
      })

      setIsEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // Dep conflicts surface in their own section ("Impacts planning" + per-item warnings),
  // so we keep the top conflicts panel focused on retard/blocage/chevauchement artisan.
  const taskConflicts = task ? conflicts.filter(c => c.taskId === task.id && c.type !== 'dependency') : []

  // Impacts planning — light counters used in the deps section header
  const upstreamAlertCount = task
    ? upstreamDeps.filter(d => buildPredecessorWarning(task, findTask(d.depends_on_task_id))).length
    : 0
  const downstreamAlertCount = task
    ? downstreamDeps.filter(d => buildSuccessorWarning(task, findTask(d.task_id))).length
    : 0
  const totalDepAlerts = upstreamAlertCount + downstreamAlertCount

  const inputCls = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors'
  const labelCls = 'text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5 block'

  return (
    <>
      {/* Overlay — clic extérieur ferme le panneau (desktop + mobile, LOT 38). */}
      {task && (
        <div
          className="fixed inset-0 z-[9000] bg-black/10"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 w-[420px] max-w-full bg-surface border-l border-border shadow-2xl flex flex-col z-[9001] transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
          task ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {task && (
          <>
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="bg-elevated border border-border px-2.5 py-1 rounded-full text-xs font-600 text-muted-foreground shrink-0">
                  {isEditing ? 'Modification' : 'Tâche'}
                </span>
                {task.project && !isEditing && (
                  <span
                    className="text-xs font-600 truncate"
                    style={{ color: task.project.color }}
                  >
                    {task.project.name}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0 ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isEditing ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Titre</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className={inputCls}
                      placeholder="Titre de la tâche"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Début</label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Fin</label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={e => setEditEndDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Priorité</label>
                    <select
                      value={editPriority}
                      onChange={e => setEditPriority(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Aucune</option>
                      <option value="low">Basse</option>
                      <option value="medium">Normale</option>
                      <option value="high">Haute</option>
                      <option value="critical">Critique</option>
                    </select>
                  </div>
                  <AssignmentPicker
                    artisans={artisans.map(a => ({ ...a, trade: a.trade ?? null }))}
                    teams={teams}
                    value={editAssignment}
                    onChange={setEditAssignment}
                  />
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      className={cn(inputCls, 'resize-none h-24')}
                      placeholder="Description de la tâche"
                    />
                  </div>
                  {editError && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      {editError}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-700 text-foreground mb-5 leading-tight">{task.title}</h2>

                  {/* Conflict alerts */}
                  {taskConflicts.length > 0 && (
                    <div className="mb-5 flex flex-col gap-1.5">
                      {taskConflicts.map((c, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-start gap-2 text-xs px-3 py-2 rounded-lg',
                            c.type === 'late'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : c.type === 'blocked'
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                              : c.type === 'dependency'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-500'
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{c.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Status pills — interactives seulement si la base accepterait
                      l'écriture (interne, ou artisan sur sa propre tâche). */}
                  <div className="mb-5">
                    <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Statut</p>
                    {!canChangeStatus ? (
                      displayStatus ? (
                        <span className={cn('inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-600 border border-current', taskStatusColor(displayStatus))}>
                          {taskStatusLabel(displayStatus)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    ) : (
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={saving}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-600 border transition-all',
                            displayStatus === s
                              ? taskStatusColor(s) + ' border-current'
                              : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground bg-transparent',
                            saving && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {taskStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-background border border-border rounded-xl p-3.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-600 mb-1.5">
                        <Calendar className="h-3 w-3" />
                        DÉBUT
                      </div>
                      <p className="text-sm font-600 text-foreground">{formatDate(task.start_date) || '—'}</p>
                    </div>
                    <div className="bg-background border border-border rounded-xl p-3.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-600 mb-1.5">
                        <Calendar className="h-3 w-3" />
                        FIN
                      </div>
                      <p className={cn(
                        'text-sm font-600',
                        task.end_date && new Date(task.end_date) < new Date() && displayStatus !== 'done' && displayStatus !== 'validated'
                          ? 'text-destructive'
                          : 'text-foreground'
                      )}>
                        {formatDate(task.end_date) || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Assignee or Team */}
                  {(task.assignee || task.team) && (
                    <div className="mb-5">
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Assigné à</p>
                      {task.assignee && (
                        <div className="flex items-center gap-3 bg-background border border-border rounded-xl p-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-700 text-white shrink-0"
                            style={{ background: task.assignee.color }}
                          >
                            {(task.assignee.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <p className="text-sm font-600 text-foreground">{task.assignee.full_name}</p>
                        </div>
                      )}
                      {task.team && !task.assignee && (
                        <div className="flex items-center gap-3 bg-background border border-border rounded-xl p-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: (task.team.color ?? '#94a3b8') + '33', border: `2px solid ${task.team.color ?? '#94a3b8'}` }}
                          >
                            <Users className="h-4 w-4" style={{ color: task.team.color ?? '#94a3b8' }} />
                          </div>
                          <div>
                            <p className="text-sm font-600 text-foreground">{task.team.name}</p>
                            <p className="text-xs text-muted-foreground">Équipe</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {task.description && (
                    <div className="mb-5">
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                      <p className="text-sm text-foreground leading-relaxed">{task.description}</p>
                    </div>
                  )}

                  {/* Priority */}
                  {task.priority && (
                    <div className="mb-5">
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-2">Priorité</p>
                      <span className={cn(
                        'inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-600',
                        task.priority === 'low' ? 'bg-muted text-muted-foreground' :
                        task.priority === 'medium' ? 'bg-primary/15 text-primary' :
                        task.priority === 'high' ? 'bg-yellow-500/15 text-yellow-500' :
                        'bg-destructive/15 text-destructive'
                      )}>
                        {task.priority === 'low' ? 'Basse' : task.priority === 'medium' ? 'Normale' : task.priority === 'high' ? 'Haute' : 'Critique'}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Dépendances — visibles en lecture ET en édition (LOT 38).
                  Le bouton « Ajouter un prédécesseur » et la suppression ne
                  s'affichent qu'en mode modification (isEditing). */}
              <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" />
                        Dépendances
                      </p>
                      {isEditing && !depAddOpen && (
                        <button
                          onClick={() => setDepAddOpen(true)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-600"
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter un prédécesseur
                        </button>
                      )}
                    </div>

                    {/* Impacts planning — synthesis based on the live deps + dates.
                        Counts and "Cette tâche bloque" list update automatically when
                        dates change (handleTaskUpdated keeps selectedTask in sync). */}
                    {(upstreamDeps.length > 0 || downstreamDeps.length > 0) && (
                      <div className="bg-elevated/40 border border-border rounded-xl p-3 mb-3">
                        <p className="text-[11px] font-700 uppercase tracking-wider text-muted-foreground mb-2">
                          Impacts planning
                        </p>
                        <ul className="text-xs text-foreground space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="text-muted-foreground">•</span>
                            {upstreamDeps.length} prédécesseur{upstreamDeps.length > 1 ? 's' : ''}
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-muted-foreground">•</span>
                            {downstreamDeps.length} successeur{downstreamDeps.length > 1 ? 's' : ''}
                          </li>
                          {totalDepAlerts > 0 ? (
                            <li className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {totalDepAlerts} alerte{totalDepAlerts > 1 ? 's' : ''} de cohérence
                            </li>
                          ) : (
                            <li className="text-muted-foreground italic">
                              Les dépendances directes semblent cohérentes.
                            </li>
                          )}
                        </ul>
                        {downstreamDeps.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-border/50">
                            <p className="text-[11px] font-600 text-muted-foreground mb-1.5">Cette tâche bloque :</p>
                            <ul className="text-xs text-foreground space-y-0.5">
                              {downstreamDeps.slice(0, 5).map(d => {
                                const t = findTask(d.task_id)
                                if (!t) return null
                                return (
                                  <li key={d.id} className="flex items-start gap-1.5 min-w-0">
                                    <span className="text-muted-foreground shrink-0">→</span>
                                    <span className="truncate">{t.title}</span>
                                  </li>
                                )
                              })}
                              {downstreamDeps.length > 5 && (
                                <li className="text-[11px] text-muted-foreground italic">
                                  + {downstreamDeps.length - 5} autre{downstreamDeps.length - 5 > 1 ? 's' : ''}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {isEditing && depAddOpen && (() => {
                      // Filter out: self, already-upstream, and any task that would create a cycle
                      // (deep DFS via wouldCreateCycle on the full org-scoped graph).
                      // While allDeps is loading, fall back to the local subset to avoid showing
                      // candidates we would later reject — they get re-checked at insert time.
                      const graph = allDeps ?? deps.map(d => ({ task_id: d.task_id, depends_on_task_id: d.depends_on_task_id }))
                      const forbidden = computeCycleForbidden(task.id, graph)
                      const upstreamIds = new Set(upstreamDeps.map(d => d.depends_on_task_id))
                      const candidates = availableTasks.filter(t => !forbidden.has(t.id) && !upstreamIds.has(t.id))

                      // Group by project. Current task's own project first, then others alphabetical.
                      type Group = { id: string; name: string; color: string | null; tasks: GanttTask[] }
                      const map = new Map<string, Group>()
                      for (const t of candidates) {
                        const pid = t.project?.id ?? '__none__'
                        const name = t.project?.name ?? 'Sans chantier'
                        const color = t.project?.color ?? null
                        if (!map.has(pid)) map.set(pid, { id: pid, name, color, tasks: [] })
                        map.get(pid)!.tasks.push(t)
                      }
                      const groups = Array.from(map.values()).sort((a, b) => {
                        if (a.id === task.project_id) return -1
                        if (b.id === task.project_id) return 1
                        return a.name.localeCompare(b.name, 'fr')
                      })

                      return (
                      <div className="bg-background border border-border rounded-xl p-3 mb-3 flex flex-col gap-2">
                        <label className="text-xs font-600 text-muted-foreground">
                          Choisissez une tâche qui doit être terminée avant celle-ci (prédécesseur) :
                        </label>
                        {allDepsLoading && (
                          <p className="text-[11px] text-muted-foreground italic">Analyse du graphe de dépendances…</p>
                        )}
                        {candidates.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">
                            Aucune tâche disponible pour créer une dépendance.
                          </p>
                        ) : (
                          <select
                            value={depAddId}
                            onChange={e => setDepAddId(e.target.value)}
                            className={inputCls}
                          >
                            <option value="">— Choisir une tâche —</option>
                            {groups.map(g => (
                              <optgroup key={g.id} label={`${g.name} (${g.tasks.length})`}>
                                {g.tasks.map(t => {
                                  const parts = [t.title]
                                  if (t.status) parts.push(taskStatusLabel(t.status))
                                  if (t.start_date && t.end_date) {
                                    parts.push(`${formatDate(t.start_date)} → ${formatDate(t.end_date)}`)
                                  }
                                  if (t.assignee?.full_name) parts.push(t.assignee.full_name)
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {parts.join(' · ')}
                                    </option>
                                  )
                                })}
                              </optgroup>
                            ))}
                          </select>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleAddDependency}
                            disabled={!depAddId || depSaving}
                            className={cn(
                              'text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors',
                              (!depAddId || depSaving) && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {depSaving ? 'Ajout…' : 'Ajouter comme prédécesseur'}
                          </button>
                          <button
                            onClick={() => { setDepAddOpen(false); setDepAddId('') }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                      )
                    })()}

                    <div className="mb-3">
                      <p className="text-[11px] font-600 text-muted-foreground mb-1.5">Prédécesseurs — à terminer avant cette tâche</p>
                      {depsLoading ? (
                        <p className="text-xs text-muted-foreground italic">Chargement…</p>
                      ) : upstreamDeps.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun prédécesseur défini.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {upstreamDeps.map(d => {
                            const t = findTask(d.depends_on_task_id)
                            const depWarning = buildPredecessorWarning(task, t)
                            return (
                              <DependencyItem
                                key={d.id}
                                task={t}
                                fallbackId={d.depends_on_task_id}
                                onRemove={() => handleRemoveDependency(d.id)}
                                disabled={depSaving}
                                warningMessage={depWarning}
                                editable={isEditing}
                              />
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-600 text-muted-foreground mb-1.5">Successeurs — tâches qui dépendent de celle-ci</p>
                      {depsLoading ? (
                        <p className="text-xs text-muted-foreground italic">Chargement…</p>
                      ) : downstreamDeps.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun successeur défini.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {downstreamDeps.map(d => {
                            const t = findTask(d.task_id)
                            const depWarning = buildSuccessorWarning(task, t)
                            return (
                              <DependencyItem
                                key={d.id}
                                task={t}
                                fallbackId={d.task_id}
                                onRemove={() => handleRemoveDependency(d.id)}
                                disabled={depSaving}
                                warningMessage={depWarning}
                                editable={isEditing}
                              />
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-2 flex-wrap">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors',
                      saving && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditError(null) }}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  {canEditFields && (
                  <button
                    onClick={handleEnterEdit}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  )}
                  {task.project && (
                    <Link
                      href={`/chantiers/${task.project_id}`}
                      onClick={onClose}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Chantier
                    </Link>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

interface DependencyItemProps {
  task: GanttTask | undefined
  fallbackId: string
  onRemove: () => void
  disabled: boolean
  warningMessage?: string | null
  /** Affiche le bouton de suppression uniquement en mode édition (LOT 38). */
  editable?: boolean
}

function DependencyItem({ task, fallbackId, onRemove, disabled, warningMessage, editable }: DependencyItemProps) {
  return (
    <li className="flex flex-col gap-1 bg-background border border-border rounded-lg px-2.5 py-2 text-xs">
      <div className="flex items-center gap-2">
        {task?.project && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: task.project.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-600 truncate">
            {task?.title ?? `Tâche supprimée (${fallbackId.slice(0, 8)}…)`}
          </p>
          <p className="text-muted-foreground text-[10px] truncate">
            {task?.project?.name && <span>{task.project.name}</span>}
            {task?.status && <span> · {taskStatusLabel(task.status)}</span>}
            {task?.start_date && task?.end_date && (
              <span> · {formatDate(task.start_date)} → {formatDate(task.end_date)}</span>
            )}
          </p>
        </div>
        {editable && (
          <button
            onClick={onRemove}
            disabled={disabled}
            className={cn(
              'p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            title="Supprimer la dépendance"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {warningMessage && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
          <span>{warningMessage}</span>
        </div>
      )}
    </li>
  )
}
