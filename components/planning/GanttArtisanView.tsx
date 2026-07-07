'use client'

import { useMemo, type RefObject } from 'react'
import { format, differenceInDays, eachDayOfInterval, getISOWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'
import { cn, hexToRgba } from '@/lib/utils'
import type { Task } from '@/lib/types'
import { parseDBDate } from '@/components/planning/useGanttDrag'

const MONTH_ROW_HEIGHT = 20
const DAY_ROW_HEIGHT = 36
const HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT // 56 — unchanged
const ROW_HEIGHT = 44
const LEFT_COL_WIDTH = 280

function getMonthBandIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

type GanttTask = Task & {
  assignee?: { id: string; full_name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

type ConflictEntry = { type: 'late' | 'blocked' | 'overlap' | 'dependency'; taskId: string; message: string }

interface Props {
  filteredTasks: GanttTask[]
  artisans: { id: string; full_name: string; color: string }[]
  taskConflictMap: Map<string, ConflictEntry[]>
  zoom: 'day' | 'week' | 'month'
  rangeStart: Date
  rangeEnd: Date
  dayW: number
  totalDays: number
  todayOffset: number
  today: Date
  selectedTaskId: string | null
  filterArtisan: string
  onTaskClick: (task: GanttTask) => void
  onTooltipChange: (tooltip: { task: GanttTask; x: number; y: number } | null) => void
  /** LOT 27M — conteneur de scroll partagé pour que les flèches de période
   *  défilent aussi ce viewport en vue « Par artisan » (même unique overflow:auto). */
  scrollRef?: RefObject<HTMLDivElement | null>
}

// SCROLL : même conteneur overflow:auto unique que GanttView — ne pas ajouter
// un scroll indépendant ici. rangeStart/rangeEnd/totalDays arrivent via props,
// calculés dynamiquement dans GanttView pour couvrir toutes les tâches visibles.
// DRAG / RESIZE : désactivés. Ne pas recâbler sans recette complète.

export function GanttArtisanView({
  filteredTasks,
  artisans,
  taskConflictMap,
  zoom,
  rangeStart,
  rangeEnd,
  dayW,
  totalDays,
  todayOffset,
  today,
  selectedTaskId,
  filterArtisan,
  onTaskClick,
  onTooltipChange,
  scrollRef,
}: Props) {

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

  const weekStarts = useMemo(() => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    const offsets: number[] = []
    for (let i = 1; i < days.length; i++) {
      if (days[i].getDay() === 1 && days[i].getDate() !== 1) offsets.push(i * dayW)
    }
    return offsets
  }, [rangeStart, rangeEnd, dayW])

  type ArtisanGanttRow =
    | { type: 'artisan'; artisan: { id: string; full_name: string; color: string }; tasks: GanttTask[] }
    | { type: 'unassigned'; tasks: GanttTask[] }

  const ganttRows = useMemo((): ArtisanGanttRow[] => {
    const rows: ArtisanGanttRow[] = []
    const visibleArtisans = filterArtisan === 'all'
      ? artisans
      : artisans.filter(a => a.id === filterArtisan)
    for (const artisan of visibleArtisans) {
      rows.push({ type: 'artisan', artisan, tasks: filteredTasks.filter(t => t.assignee?.id === artisan.id) })
    }
    const unassigned = filteredTasks.filter(t => !t.assignee || !artisans.some(a => a.id === t.assignee?.id))
    if (filterArtisan === 'all' && unassigned.length > 0) {
      rows.push({ type: 'unassigned', tasks: unassigned })
    }
    return rows
  }, [artisans, filteredTasks, filterArtisan])

  const artisanHasOverload = (artisanId: string) =>
    filteredTasks
      .filter(t => t.assignee?.id === artisanId)
      .some(t => (taskConflictMap.get(t.id) ?? []).some(c => c.type === 'overlap'))

  const renderBar = (task: GanttTask) => {
    if (!task.start_date || !task.end_date) return null

    const startOff = differenceInDays(parseDBDate(task.start_date), rangeStart)
    const duration = differenceInDays(parseDBDate(task.end_date), parseDBDate(task.start_date)) + 1
    const barWidth = Math.max(duration * dayW, dayW)

    const isLate = new Date(task.end_date) < today && task.status !== 'done' && task.status !== 'validated'
    const isBlocked = task.status === 'blocked'
    const baseBarColor = task.project?.color ?? '#2563EB'
    const taskConflicts = taskConflictMap.get(task.id) ?? []
    const hasOverlap = taskConflicts.some(c => c.type === 'overlap')
    const alertColor = isLate ? '#EF4444' : isBlocked ? '#F97316' : hasOverlap ? '#EAB308' : null
    const conflictShadow = alertColor
      ? `0 0 0 2px ${alertColor}, 0 0 10px ${hexToRgba(alertColor, 0.45)}`
      : undefined

    // Pastel bar
    const barBg = hexToRgba(baseBarColor, 0.14)
    const barBackground = alertColor
      ? `linear-gradient(90deg, ${alertColor} 4px, ${barBg} 4px)`
      : barBg
    const barTextColor = hexToRgba(baseBarColor, 0.95)

    const barLabel = task.project?.name
      ? `${task.title} · ${task.project.name}`
      : task.title

    return (
      <div
        key={task.id}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center text-xs font-600 overflow-hidden cursor-pointer select-none',
          selectedTaskId === task.id && 'ring-2 ring-offset-1',
        )}
        style={{
          left: Math.max(0, startOff) * dayW,
          width: barWidth,
          background: barBackground,
          border: `1px solid ${hexToRgba(baseBarColor, 0.30)}`,
          borderLeft: `3px solid ${hexToRgba(baseBarColor, 0.65)}`,
          opacity: task.status === 'done' || task.status === 'validated' ? 0.45 : 0.9,
          boxShadow: conflictShadow,
          color: barTextColor,
        }}
        onClick={e => { e.stopPropagation(); onTaskClick(task) }}
        onMouseEnter={e => onTooltipChange({ task, x: e.clientX + 14, y: e.clientY - 48 })}
        onMouseMove={e => onTooltipChange({ task, x: e.clientX + 14, y: e.clientY - 48 })}
        onMouseLeave={() => onTooltipChange(null)}
      >
        {alertColor && <AlertTriangle className="shrink-0 h-3 w-3 ml-1.5" style={{ color: alertColor }} />}
        <span className="truncate px-2">{barLabel}</span>
      </div>
    )
  }

  const totalWidth = LEFT_COL_WIDTH + totalDays * dayW

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="relative" style={{ width: totalWidth }}>

        {/* Header row — sticky top */}
        <div className="flex sticky top-0 z-30" style={{ height: HEADER_HEIGHT }}>
          {/* Corner — sticky both axes */}
          <div
            className="sticky left-0 z-40 shrink-0 bg-surface border-r border-b border-border flex items-center px-4"
            style={{ width: LEFT_COL_WIDTH, height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Artisan</span>
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
                <div key={`wh-${left}`} className="absolute top-0 bottom-0 w-px bg-border/30 pointer-events-none" style={{ left }} />
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
                      'relative border-r border-border flex flex-col items-center justify-center text-xs',
                      isToday ? 'bg-primary/5' : isOdd ? 'bg-foreground/[0.02]' : '',
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
            </div>
          </div>
        </div>

        {/* Today line */}
        {todayOffset >= 0 && todayOffset <= totalDays && (
          <div
            className="absolute w-0.5 bg-yellow-500 z-[5] pointer-events-none"
            style={{
              top: HEADER_HEIGHT,
              bottom: 0,
              left: LEFT_COL_WIDTH + todayOffset * dayW + dayW / 2,
            }}
          >
            <div className="w-2 h-2 rounded-full bg-yellow-500 -translate-x-0.5 -translate-y-1" />
          </div>
        )}

        {/* Data rows */}
        {ganttRows.map(row => {
          const rowKey = row.type === 'artisan' ? row.artisan.id : 'unassigned'
          return (
            <div key={rowKey} className="flex group" style={{ height: ROW_HEIGHT }}>
              {/* Sticky left — artisan label */}
              <div
                className="sticky left-0 z-20 shrink-0 bg-surface border-r border-b border-border flex items-center px-4 gap-3 overflow-hidden group-hover:bg-elevated transition-colors"
                style={{ width: LEFT_COL_WIDTH, height: ROW_HEIGHT }}
              >
                {row.type === 'artisan' ? (
                  <>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-700 text-white shrink-0"
                      style={{ background: row.artisan.color }}
                    >
                      {row.artisan.full_name[0]}
                    </div>
                    <span className="text-sm text-foreground truncate min-w-0 flex-1">{row.artisan.full_name}</span>
                    {artisanHasOverload(row.artisan.id) && (
                      <span title="Chevauchement de tâches détecté">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-700 bg-muted text-muted-foreground shrink-0">
                      ?
                    </div>
                    <span className="text-sm text-muted-foreground truncate min-w-0 flex-1 italic">Non assigné</span>
                  </>
                )}
              </div>
              {/* Right cell — bars */}
              <div
                className="relative border-b border-border group-hover:bg-elevated/20 transition-colors"
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
                {row.tasks.map(task => renderBar(task))}
              </div>
            </div>
          )
        })}

        {ganttRows.length === 0 && (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: 128 }}>
            Aucun artisan
          </div>
        )}
      </div>
    </div>
  )
}
