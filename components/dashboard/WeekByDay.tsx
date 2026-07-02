'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Calendar, Search, ArrowRight, AlertTriangle, X, CheckCircle } from 'lucide-react'
import { cn, taskStatusLabel, taskStatusColor, hexToRgba } from '@/lib/utils'
import type { TaskStatus } from '@/lib/types'

export type WeekDayTask = {
  id: string
  title: string
  status: string
  start_date?: string | null
  end_date?: string | null
  project_id?: string
  project?: { name: string; color: string } | null
  assignee?: { full_name: string | null } | null
  team?: { name: string } | null
}

interface Props {
  tasks: WeekDayTask[]
  today: string
}

type ViewMode = 'gantt' | 'kanban'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDays(today: string): string[] {
  const d = new Date(today + 'T12:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return Array.from({ length: 6 }, (_, i) => {
    const day = new Date(mon)
    day.setDate(mon.getDate() + i)
    return day.toISOString().split('T')[0]
  })
}

function dayColLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase().slice(0, 3)
  return `${wd} ${d.getDate()}`
}

function findLastIdx(arr: string[], pred: (v: string) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i
  return -1
}

function barGeometry(task: WeekDayTask, days: string[]): { left: number; width: number } | null {
  const end = task.end_date
  if (!end) return null
  const start = task.start_date ?? end
  const first = days[0]
  const last = days[days.length - 1]
  if (end < first || start > last) return null

  const cs = start < first ? first : start
  const ce = end > last ? last : end

  const si = days.findIndex(d => d >= cs)
  const ei = findLastIdx(days, d => d <= ce)
  const s = si >= 0 ? si : 0
  const e = ei >= 0 ? ei : days.length - 1

  const N = days.length
  return { left: (s / N) * 100, width: Math.max(((e - s + 1) / N) * 100, 100 / N) }
}

// ─── Status badge mapping ─────────────────────────────────────────────────────

const STATUS_COMPACT: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'À faire',   cls: 'bg-slate-200   dark:bg-slate-700   text-slate-700 dark:text-slate-200' },
  in_progress: { label: 'En cours',  cls: 'bg-blue-100    dark:bg-blue-900/70 text-blue-800  dark:text-blue-200' },
  review:      { label: 'À valider', cls: 'bg-amber-100   dark:bg-amber-900/70 text-amber-800 dark:text-amber-200' },
  done:        { label: 'Terminé',   cls: 'bg-green-100   dark:bg-green-900/70 text-green-800 dark:text-green-200' },
  validated:   { label: 'Validé',    cls: 'bg-green-100   dark:bg-green-900/70 text-green-700 dark:text-green-200' },
  blocked:     { label: 'Bloqué',    cls: 'bg-orange-100  dark:bg-orange-900/70 text-orange-800 dark:text-orange-200' },
}

// ─── Mini Gantt ───────────────────────────────────────────────────────────────

const MIN_LABEL_W = 140
const MAX_LABEL_W = 360

function MiniGantt({
  tasks,
  today,
  maxRows = 10,
  compact = true,
  labelWidth,
  onLabelResize,
}: {
  tasks: WeekDayTask[]
  today: string
  maxRows?: number
  compact?: boolean
  labelWidth: number
  onLabelResize?: (w: number) => void
}) {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)
  const ROW_H = compact ? 52 : 62
  const BAR_H = compact ? 34 : 42

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = labelWidth

    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return
      const newW = Math.min(MAX_LABEL_W, Math.max(MIN_LABEL_W, startW.current + me.clientX - startX.current))
      onLabelResize?.(newW)
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const days = getWeekDays(today)

  const visible = tasks
    .filter(t => {
      if (!t.end_date) return false
      const s = t.start_date ?? t.end_date
      return s <= days[5] && t.end_date >= days[0]
    })
    .slice(0, maxRows)

  const seenProjects = new Map<string, { name: string; color: string }>()
  for (const t of visible) {
    if (t.project_id && t.project && !seenProjects.has(t.project_id)) {
      seenProjects.set(t.project_id, t.project)
    }
  }
  const legend = Array.from(seenProjects.entries())

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto flex-1">

        {/* Column headers */}
        <div className="flex border-b border-border/40 bg-foreground/[0.02]">
          <div
            className="shrink-0 relative flex items-center px-3 py-2.5"
            style={{ width: labelWidth, minWidth: labelWidth }}
          >
            <span className="text-[9.5px] font-800 uppercase tracking-wider text-muted-foreground/70">Tâche</span>
            {onLabelResize && (
              <div
                onMouseDown={onHandleMouseDown}
                className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group/resize z-10"
                title="Redimensionner"
              >
                <div className="w-0.5 h-5 bg-border group-hover/resize:bg-primary/60 transition-colors rounded" />
              </div>
            )}
          </div>
          <div className="flex flex-1 min-w-0">
            {days.map(d => (
              <div
                key={d}
                className={cn(
                  'flex-1 text-center py-2.5 text-[10.5px] font-800 uppercase tracking-wide border-l border-border/40',
                  d === today
                    ? 'text-primary bg-primary/[0.10] border-l-primary/50 font-900'
                    : 'text-muted-foreground/70',
                )}
              >
                {dayColLabel(d)}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-muted-foreground">Aucune tâche planifiée cette semaine</p>
          </div>
        ) : (
          <div>
            {visible.map(task => {
              const geo = barGeometry(task, days)
              if (!geo) return null
              const isLate = !!task.end_date && task.end_date < today
              const isBlocked = task.status === 'blocked'
              const isDone = task.status === 'done' || task.status === 'validated'
              const hasAlert = isLate || isBlocked
              const color = task.project?.color ?? '#6366f1'
              const href = task.project_id
                ? `/chantiers/${task.project_id}?focus=task&id=${task.id}`
                : '/planning'

              const barBg = hexToRgba(color, 0.26)
              const barBorderColor = hexToRgba(color, 0.46)
              const barAccent = hexToRgba(color, 0.90)
              const barText = hexToRgba(color, 1.0)

              return (
                <Link
                  key={task.id}
                  href={href}
                  className="flex items-center border-b border-border/25 hover:bg-foreground/[0.02] transition-colors"
                  style={{ height: ROW_H }}
                >
                  {/* Label column */}
                  <div
                    className="shrink-0 flex items-center gap-2.5 px-3 border-r border-border/35 h-full"
                    style={{ width: labelWidth, minWidth: labelWidth }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex flex-col min-w-0">
                      {task.project?.name && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-600 truncate leading-tight">
                          {task.project.name}
                        </span>
                      )}
                      <span className="text-[12.5px] text-slate-800 dark:text-slate-100 truncate leading-snug font-700">
                        {task.title}
                      </span>
                    </div>
                  </div>

                  {/* Bar area */}
                  <div className="flex flex-1 relative h-full overflow-hidden">
                    {days.map(d => (
                      <div
                        key={d}
                        className={cn(
                          'flex-1 border-l border-border/25 h-full',
                          d === today && 'bg-primary/[0.07]',
                        )}
                      />
                    ))}
                    {/* Task bar */}
                    <div
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 rounded-lg flex items-center gap-1.5 px-3 overflow-hidden',
                        isDone && 'opacity-55',
                      )}
                      style={{
                        left: `calc(${geo.left}% + 3px)`,
                        width: `max(32px, calc(${geo.width}% - 20px))`,
                        height: BAR_H,
                        background: barBg,
                        border: `1px solid ${barBorderColor}`,
                        borderLeftWidth: '4px',
                        borderLeftColor: barAccent,
                        boxShadow: `0 1px 4px ${hexToRgba(color, 0.2)}`,
                      }}
                    >
                      {isDone && (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: barAccent }} />
                      )}
                      {hasAlert && !isDone && (
                        <span title={isBlocked ? 'Tâche bloquée' : 'Retard détecté'}>
                          <AlertTriangle
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: isBlocked ? '#f97316' : '#ef4444' }}
                          />
                        </span>
                      )}
                      <span
                        className="flex-1 text-[11.5px] font-700 truncate leading-tight min-w-0"
                        style={{ color: barText }}
                      >
                        {task.project?.name ?? task.title}
                        {!compact && task.project?.name && ` · ${task.title}`}
                      </span>
                      {STATUS_COMPACT[task.status] && (
                        <span className={cn(
                          'text-[10px] font-700 px-2 py-0.5 rounded-md shrink-0 ml-1 leading-none whitespace-nowrap',
                          STATUS_COMPACT[task.status].cls,
                        )}>
                          {STATUS_COMPACT[task.status].label}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="shrink-0 px-4 py-2.5 border-t border-border/20 dark:border-white/[0.05] flex items-center gap-2 flex-wrap bg-elevated/10 dark:bg-elevated/30">
          <span className="text-[9px] font-800 uppercase tracking-widest text-muted-foreground/70 mr-1">
            Chantiers
          </span>
          {legend.slice(0, 5).map(([id, p]) => (
            <span key={id} className="flex items-center gap-1.5 text-[10.5px] font-500 text-muted-foreground/80">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
          {legend.length > 5 && (
            <span className="text-[10px] text-muted-foreground/55">+{legend.length - 5}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

function KanbanGrid({ tasks, today }: { tasks: WeekDayTask[]; today: string }) {
  const sections = [
    {
      key: 'todo',
      label: 'À faire',
      cls: 'text-muted-foreground bg-elevated/70',
      tasks: tasks.filter(t => t.status === 'todo'),
    },
    {
      key: 'inprogress',
      label: 'En cours',
      cls: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
      tasks: tasks.filter(t => t.status === 'in_progress'),
    },
    {
      key: 'alert',
      label: 'En alerte',
      cls: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
      tasks: tasks.filter(t => t.status === 'blocked' || (!!t.end_date && t.end_date < today && t.status !== 'done' && t.status !== 'validated')),
    },
    {
      key: 'done',
      label: 'Terminé',
      cls: 'text-green-600 dark:text-green-400 bg-green-500/10',
      tasks: tasks.filter(t => t.status === 'done' || t.status === 'validated'),
    },
  ] as const

  const hasAny = sections.some(s => s.tasks.length > 0)
  if (!hasAny) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground">Aucune tâche cette semaine</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
      {sections.map(section => {
        if (section.tasks.length === 0) return null
        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className={cn('text-[10px] font-700 px-2 py-0.5 rounded-full', section.cls)}>
                {section.label}
              </span>
              <span className="text-[10px] text-muted-foreground/40">{section.tasks.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {section.tasks.slice(0, 4).map(task => {
                const assignee = task.team?.name ?? task.assignee?.full_name
                const href = task.project_id
                  ? `/chantiers/${task.project_id}?focus=task&id=${task.id}`
                  : '/planning'
                return (
                  <Link
                    key={task.id}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-elevated/50 hover:bg-elevated transition-colors"
                  >
                    {task.project?.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.project.color }} />
                    )}
                    <span className="flex-1 text-[12px] font-500 text-foreground truncate">{task.title}</span>
                    {assignee && (
                      <span className="text-[10px] text-muted-foreground/55 shrink-0 truncate max-w-[72px]">{assignee}</span>
                    )}
                    <span className={cn('text-[9px] font-700 px-1.5 py-px rounded uppercase tracking-wide shrink-0', taskStatusColor(task.status as TaskStatus))}>
                      {taskStatusLabel(task.status as TaskStatus)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Week modal ───────────────────────────────────────────────────────────────

function WeekModal({
  tasks,
  today,
  onClose,
}: {
  tasks: WeekDayTask[]
  today: string
  onClose: () => void
}) {
  const [modalLabelW, setModalLabelW] = useState(260)
  const [mode, setMode] = useState<ViewMode>('gantt')
  const [isClosing, setIsClosing] = useState(false)

  function handleClose() {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => onClose(), 200)
  }

  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center">
      <div
        className={cn('absolute inset-0 bg-black/50 backdrop-blur-sm', isClosing ? 'backdrop-exit' : 'backdrop-enter')}
        onClick={handleClose}
      />
      <div className={cn(
        'relative z-10 bg-surface rounded-2xl border border-border/40 shadow-2xl w-full max-w-5xl mx-4 overflow-hidden flex flex-col max-h-[84vh]',
        isClosing ? 'modal-exit' : 'modal-enter',
      )}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-primary/70" />
            <h2 className="text-[13px] font-800 uppercase tracking-widest text-foreground">
              Planning de la semaine
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Mode toggle */}
            <div className="flex items-center bg-elevated rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setMode('gantt')}
                className={cn(
                  'text-[11px] font-700 px-3 py-1.5 rounded-md transition-colors',
                  mode === 'gantt'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground/55 hover:text-muted-foreground',
                )}
              >
                Gantt
              </button>
              <button
                onClick={() => setMode('kanban')}
                className={cn(
                  'text-[11px] font-700 px-3 py-1.5 rounded-md transition-colors',
                  mode === 'kanban'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground/55 hover:text-muted-foreground',
                )}
              >
                Kanban
              </button>
            </div>
            <Link
              href="/planning"
              className="text-[12px] font-600 text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              Planning <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'gantt' ? (
            <MiniGantt
              tasks={tasks}
              today={today}
              maxRows={20}
              compact={false}
              labelWidth={modalLabelW}
              onLabelResize={setModalLabelW}
            />
          ) : (
            <KanbanGrid tasks={tasks} today={today} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function WeekByDay({ tasks, today }: Props) {
  const [mode, setMode] = useState<ViewMode>('gantt')
  const [modalOpen, setModalOpen] = useState(false)
  const [labelWidth, setLabelWidth] = useState(220)

  return (
    <>
      <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[460px]">
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
            <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
              Planning de la semaine
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mode tabs */}
            <div className="flex items-center bg-elevated rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setMode('gantt')}
                className={cn(
                  'text-[10px] font-700 px-2.5 py-1 rounded-md transition-colors',
                  mode === 'gantt'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground/55 hover:text-muted-foreground',
                )}
              >
                Gantt
              </button>
              <button
                onClick={() => setMode('kanban')}
                className={cn(
                  'text-[10px] font-700 px-2.5 py-1 rounded-md transition-colors',
                  mode === 'kanban'
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground/55 hover:text-muted-foreground',
                )}
              >
                Kanban
              </button>
            </div>
            {/* Loupe */}
            <button
              onClick={() => setModalOpen(true)}
              title="Agrandir le planning"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/55 hover:text-foreground hover:bg-elevated transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <Link
              href="/planning"
              className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 transition-colors"
            >
              Planning <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {mode === 'gantt' ? (
            <MiniGantt
              tasks={tasks}
              today={today}
              maxRows={10}
              compact
              labelWidth={labelWidth}
              onLabelResize={setLabelWidth}
            />
          ) : (
            <KanbanGrid tasks={tasks} today={today} />
          )}
        </div>
      </section>

      {modalOpen && (
        <WeekModal tasks={tasks} today={today} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
