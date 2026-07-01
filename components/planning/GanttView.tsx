'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, format, differenceInDays, startOfDay, eachDayOfInterval, eachWeekOfInterval, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Plus, Pencil } from 'lucide-react'
import { cn, taskStatusColor, taskStatusLabel, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TaskFormModal, type ProjectOption, type ArtisanOption, type TeamOption } from '@/components/tasks/TaskFormModal'
import type { TaskWithRelations } from '@/lib/actions/tasks'
import type { Task } from '@/lib/types'

export type GanttTask = Task & {
  assignee?: { id: string; full_name: string; color: string; trade?: string } | null
  team?: { id: string; name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

interface Props {
  tasks: GanttTask[]
  projects: ProjectOption[]
  artisans: ArtisanOption[]
  teams: TeamOption[]
}

const DAY_WIDTH = { day: 40, week: 16, month: 6 }
const ROW_H = 44

export function GanttView({ tasks, projects, artisans, teams }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week')
  const [localTasks, setLocalTasks] = useState<GanttTask[]>(tasks)
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null)
  const [filterProject, setFilterProject] = useState<string>('all')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(() => (searchParams.get('new') === 'task' ? 'create' : null))
  const [modalDefaultProjectId, setModalDefaultProjectId] = useState<string | undefined>(undefined)
  const today = startOfDay(new Date())
  const dayW = DAY_WIDTH[zoom]

  function upsertLocalTask(updated: TaskWithRelations) {
    setLocalTasks(prev => {
      const exists = prev.some(t => t.id === updated.id)
      const merged = { ...updated } as GanttTask
      return exists ? prev.map(t => (t.id === updated.id ? merged : t)) : [...prev, merged]
    })
    setSelectedTask(prev => (prev && prev.id === updated.id ? ({ ...updated } as GanttTask) : prev))
    router.refresh()
  }

  function openCreateModal(defaultProjectId?: string) {
    setModalDefaultProjectId(defaultProjectId)
    setModalMode('create')
  }

  // Ouverture directe depuis le raccourci "Nouveau > Tâche" de la barre latérale
  // (l'ouverture elle-même vient de l'état initial paresseux ci-dessus ; on ne
  // fait ici que nettoyer l'URL, sans déclencher de nouveau rendu)
  useEffect(() => {
    if (searchParams.get('new') === 'task') {
      router.replace('/planning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Date range : 2 weeks before today → 3 months ahead
  const rangeStart = addDays(today, -14)
  const rangeEnd = addDays(today, 90)
  const totalDays = differenceInDays(rangeEnd, rangeStart)

  const filteredTasks = useMemo(() =>
    localTasks.filter(t => filterProject === 'all' || t.project_id === filterProject),
    [localTasks, filterProject]
  )

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { project: GanttTask['project'], tasks: GanttTask[] }>()
    filteredTasks.forEach(task => {
      const pid = task.project_id
      if (!map.has(pid)) {
        map.set(pid, { project: task.project, tasks: [] })
      }
      map.get(pid)!.tasks.push(task)
    })
    return [...map.values()]
  }, [filteredTasks])

  // Column headers
  const weeks = zoom === 'month'
    ? eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { locale: fr })
    : eachDayOfInterval({ start: rangeStart, end: rangeEnd })

  const daysSinceStart = (date: string) => differenceInDays(new Date(date), rangeStart)
  const todayOffset = differenceInDays(today, rangeStart)

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface shrink-0">
        <h2 className="font-700 text-sm text-foreground flex-1">Planning Gantt</h2>

        {/* Filter by project */}
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="text-xs bg-elevated border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:border-primary"
        >
          <option value="all">Tous les chantiers</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-elevated border border-border rounded-lg p-1">
          {(['day', 'week', 'month'] as const).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-600 transition-colors',
                zoom === z ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {z === 'day' ? 'Jour' : z === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => openCreateModal(filterProject !== 'all' ? filterProject : undefined)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Gantt body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — task names */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col bg-surface z-10">
          {/* Header spacer */}
          <div className="h-[56px] border-b border-border flex items-center px-5">
            <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Tâche</span>
          </div>
          {/* Task rows */}
          <div className="flex-1 overflow-y-auto">
            {groupedByProject.map(({ project, tasks: grpTasks }) => (
              <div key={project?.id ?? 'unknown'}>
                {/* Project header row */}
                <div
                  className="h-[44px] flex items-center px-5 gap-2 border-b border-border bg-background/50"
                  style={{ borderLeft: `3px solid ${project?.color ?? '#2563EB'}` }}
                >
                  <span className="text-xs font-700 text-foreground truncate flex-1">{project?.name ?? 'Chantier'}</span>
                  {project?.id && (
                    <button
                      onClick={() => openCreateModal(project.id)}
                      className="p-1 rounded-md text-muted-foreground hover:bg-elevated hover:text-primary transition-colors shrink-0"
                      aria-label={`Nouvelle tâche sur ${project.name}`}
                      title={`Nouvelle tâche sur ${project.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {/* Task rows */}
                {grpTasks.map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      'h-[44px] flex items-center px-4 gap-2 border-b border-border cursor-pointer hover:bg-elevated transition-colors',
                      selectedTask?.id === task.id && 'bg-primary/8'
                    )}
                    onClick={() => setSelectedTask(task === selectedTask ? null : task)}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: project?.color ?? '#2563EB' }}
                    />
                    <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
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
                ))}
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-sm text-muted-foreground px-4 text-center">
                <span>Aucune tâche planifiée</span>
                <Button size="sm" variant="outline" onClick={() => openCreateModal(filterProject !== 'all' ? filterProject : undefined)} className="gap-1.5">
                  <Plus className="h-4 w-4" />Créer une première tâche
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right — chart */}
        <div className="flex-1 overflow-auto relative">
          {/* Width container */}
          <div style={{ width: totalDays * dayW, minWidth: '100%' }}>
            {/* Header — dates */}
            <div className="h-[56px] border-b border-border flex sticky top-0 bg-surface z-10">
              {eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((day, i) => {
                const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                const showLabel = zoom === 'day' || (zoom === 'week' && day.getDay() === 1) || (zoom === 'month' && day.getDate() === 1)
                return (
                  <div
                    key={i}
                    style={{ width: dayW, flexShrink: 0 }}
                    className={cn(
                      'border-r border-border flex flex-col items-center justify-center text-xs',
                      isToday && 'bg-primary/5'
                    )}
                  >
                    {showLabel && (
                      <>
                        <span className={cn('font-600', isToday ? 'text-primary' : 'text-muted-foreground')}>
                          {zoom === 'month'
                            ? format(day, 'MMM', { locale: fr })
                            : zoom === 'week'
                              ? format(day, 'd MMM', { locale: fr })
                              : format(day, 'EEEEE', { locale: fr })}
                        </span>
                        {zoom === 'day' && (
                          <span className={cn('text-[10px]', isToday ? 'text-primary font-700' : 'text-muted-foreground')}>
                            {format(day, 'd')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Today line */}
            <div
              className="absolute top-[56px] bottom-0 w-0.5 bg-yellow-500 z-20 pointer-events-none"
              style={{ left: todayOffset * dayW + dayW / 2 }}
            >
              <div className="w-2 h-2 rounded-full bg-yellow-500 -translate-x-0.5 -translate-y-1" />
            </div>

            {/* Task rows */}
            {groupedByProject.map(({ project, tasks: grpTasks }) => (
              <div key={project?.id ?? 'unknown'}>
                {/* Project header row — empty */}
                <div className="h-[44px] border-b border-border bg-background/30" />
                {/* Task bars */}
                {grpTasks.map(task => {
                  if (!task.start_date || !task.end_date) return (
                    <div key={task.id} className="h-[44px] border-b border-border" />
                  )
                  const startOff = daysSinceStart(task.start_date)
                  const duration = differenceInDays(new Date(task.end_date), new Date(task.start_date)) + 1
                  const barWidth = Math.max(duration * dayW, dayW)
                  const isLate = new Date(task.end_date) < today && task.status !== 'done' && task.status !== 'validated'
                  const barColor = isLate ? '#EF4444' : (project?.color ?? '#2563EB')

                  return (
                    <div
                      key={task.id}
                      className="h-[44px] border-b border-border relative cursor-pointer hover:bg-elevated/30 transition-colors"
                      onClick={() => setSelectedTask(task === selectedTask ? null : task)}
                    >
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center px-2 text-white text-xs font-600 overflow-hidden"
                        style={{
                          left: Math.max(0, startOff) * dayW,
                          width: barWidth,
                          background: barColor,
                          opacity: task.status === 'done' || task.status === 'validated' ? 0.5 : 0.9,
                        }}
                        title={`${task.title} — ${formatDate(task.start_date)} → ${formatDate(task.end_date)}`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task detail panel (simplified sidewindow) */}
      {selectedTask && (
        <div className="border-t border-border bg-surface p-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-600', taskStatusColor(selectedTask.status))}>
                  {taskStatusLabel(selectedTask.status)}
                </span>
                {selectedTask.project && (
                  <span className="text-xs text-muted-foreground">{selectedTask.project.name}</span>
                )}
              </div>
              <h3 className="font-700 text-foreground">{selectedTask.title}</h3>
              {selectedTask.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
              )}
            </div>
            <div className="flex gap-6 text-sm shrink-0">
              {selectedTask.start_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Début</p>
                  <p className="font-500 text-foreground">{formatDate(selectedTask.start_date)}</p>
                </div>
              )}
              {selectedTask.end_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Fin</p>
                  <p className="font-500 text-foreground">{formatDate(selectedTask.end_date)}</p>
                </div>
              )}
              {selectedTask.assignee && (
                <div>
                  <p className="text-xs text-muted-foreground">Assigné à</p>
                  <p className="font-500 text-foreground">{selectedTask.assignee.full_name}</p>
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={() => setModalMode('edit')} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Button>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg font-300"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode && (
        <TaskFormModal
          key={modalMode === 'edit' ? selectedTask?.id : `create-${modalDefaultProjectId ?? 'any'}`}
          mode={modalMode}
          task={modalMode === 'edit' && selectedTask ? (selectedTask as TaskWithRelations) : undefined}
          projects={projects}
          artisans={artisans}
          teams={teams}
          defaultProjectId={modalDefaultProjectId}
          onClose={() => { setModalMode(null); setModalDefaultProjectId(undefined) }}
          onSaved={upsertLocalTask}
        />
      )}
    </div>
  )
}
