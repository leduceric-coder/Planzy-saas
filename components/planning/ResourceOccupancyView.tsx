'use client'

// ─── LOT 26B — Vue ressources / occupation des artisans ─────────────────────────
// Adaptée à l'architecture du ZIP : aucune server-action, aucune TaskFormModal.
// L'édition réutilise le TaskSidePanel existant du planning (parcours identique
// au Gantt), conformément à la décision §3 du LOT 27B.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addWeeks, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronRight as ChevronRightSmall, AlertTriangle } from 'lucide-react'
import { cn, formatDate, occupancyLevelColor } from '@/lib/utils'
import {
  computeWeekOccupancy,
  findOverlappingPairs,
  getWeekStarts,
  occupancyLevelLabel,
  toISODate,
  type OccupancyTask,
  type WeekOccupancy,
} from '@/lib/occupancy'
import { TaskSidePanel, type TaskUpdatePatch } from '@/components/planning/TaskSidePanel'
import type { Task } from '@/lib/types'

const WEEKS_VISIBLE = 6
const WEEK_COL_WIDTH = 130
const ROW_H = 64

// Types alignés sur le fetch du planning riche du ZIP.
export type PlanningTask = Task & {
  assignee?: { id: string; full_name: string; color: string } | null
  assigned_team?: string | null
  team?: { id: string; name: string; color: string } | null
  project?: { id: string; name: string; color: string } | null
}

export interface OccProjectOption { id: string; name: string; color: string }
export interface OccArtisanOption { id: string; full_name: string; trade: string; color: string }
export interface OccTeamOption { id: string; name: string; color: string | null; type: string | null; memberCount: number }

interface Props {
  tasks: PlanningTask[]
  projects: OccProjectOption[]
  artisans: OccArtisanOption[]
  teams: OccTeamOption[]
}

interface SelectedCell {
  kind: 'artisan' | 'team'
  id: string
  name: string
  color: string
  weekOcc: WeekOccupancy
}

function toOccupancyTask(t: PlanningTask): OccupancyTask {
  return { id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date, project: t.project ?? null }
}

export function ResourceOccupancyView({ tasks, projects, artisans, teams }: Props) {
  const router = useRouter()
  const [localTasks, setLocalTasks] = useState<PlanningTask[]>(tasks)
  const [windowIndex, setWindowIndex] = useState(0)
  const [filterProject, setFilterProject] = useState('all')
  const [filterArtisan, setFilterArtisan] = useState('all')
  const [filterTrade, setFilterTrade] = useState('all')
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Resynchronise avec les données serveur après un router.refresh().
  useEffect(() => { setLocalTasks(tasks) }, [tasks])

  // Fusionne un patch de TaskSidePanel dans la liste locale pour recalculer
  // l'occupation sans attendre le refresh serveur.
  function handleTaskUpdated(taskId: string, patch: TaskUpdatePatch) {
    setLocalTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...patch } as PlanningTask : t)))
    router.refresh()
  }

  const weeks = useMemo(() => getWeekStarts(addWeeks(new Date(), windowIndex * WEEKS_VISIBLE), WEEKS_VISIBLE), [windowIndex])

  const trades = useMemo(() => [...new Set(artisans.map(a => a.trade).filter(Boolean))].sort(), [artisans])

  const assignableTasks = useMemo(
    () =>
      localTasks.filter(
        t =>
          t.start_date &&
          t.end_date &&
          (t.assigned_to || t.assigned_team) &&
          (filterProject === 'all' || t.project_id === filterProject)
      ),
    [localTasks, filterProject]
  )

  const visibleArtisans = useMemo(
    () =>
      artisans.filter(
        a => (filterArtisan === 'all' || a.id === filterArtisan) && (filterTrade === 'all' || a.trade === filterTrade)
      ),
    [artisans, filterArtisan, filterTrade]
  )

  const showTeams = filterArtisan === 'all'

  const artisanWeekData = useMemo(() => {
    const map = new Map<string, WeekOccupancy[]>()
    for (const artisan of visibleArtisans) {
      const artisanTasks = assignableTasks.filter(t => t.assigned_to === artisan.id).map(toOccupancyTask)
      map.set(artisan.id, weeks.map(w => computeWeekOccupancy(w, artisanTasks)))
    }
    return map
  }, [visibleArtisans, assignableTasks, weeks])

  const teamWeekData = useMemo(() => {
    const map = new Map<string, WeekOccupancy[]>()
    if (!showTeams) return map
    for (const team of teams) {
      const teamTasks = assignableTasks.filter(t => t.assigned_team === team.id).map(toOccupancyTask)
      map.set(team.id, weeks.map(w => computeWeekOccupancy(w, teamTasks)))
    }
    return map
  }, [teams, assignableTasks, weeks, showTeams])

  const conflictsSummary = useMemo(() => {
    const alerts: { artisanName: string; taskA: OccupancyTask; taskB: OccupancyTask; overlapStart: string; overlapEnd: string }[] = []
    for (const artisan of visibleArtisans) {
      const artisanTasks = assignableTasks.filter(t => t.assigned_to === artisan.id).map(toOccupancyTask)
      for (const pair of findOverlappingPairs(artisanTasks)) {
        alerts.push({ artisanName: artisan.full_name, ...pair })
      }
    }
    return alerts
  }, [visibleArtisans, assignableTasks])

  const selectedTask = selectedTaskId ? localTasks.find(t => t.id === selectedTaskId) ?? null : null

  function openTask(taskId: string) {
    setSelectedTaskId(taskId)
  }

  const todayWeek = weeks[0]
  const todayWeekOcc = new Map<string, WeekOccupancy>()
  visibleArtisans.forEach(a => {
    const first = artisanWeekData.get(a.id)?.[0]
    if (first) todayWeekOcc.set(a.id, first)
  })

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface shrink-0 flex-wrap">
        <h2 className="font-700 text-sm text-foreground flex-1 min-w-[140px]">Occupation des artisans</h2>

        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="text-xs bg-elevated border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:border-primary">
          <option value="all">Tous les chantiers</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select value={filterArtisan} onChange={e => setFilterArtisan(e.target.value)} className="text-xs bg-elevated border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:border-primary">
          <option value="all">Tous les artisans</option>
          {artisans.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>

        <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} className="text-xs bg-elevated border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:border-primary">
          <option value="all">Tous les métiers</option>
          {trades.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-elevated border border-border rounded-lg p-1 shrink-0">
          <button onClick={() => setWindowIndex(i => i - 1)} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" aria-label="Période précédente">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-600 text-foreground px-1 whitespace-nowrap">
            {format(weeks[0], 'd MMM', { locale: fr })} – {format(weeks[weeks.length - 1], 'd MMM yyyy', { locale: fr })}
          </span>
          {windowIndex !== 0 && (
            <button onClick={() => setWindowIndex(0)} className="text-[10px] font-700 text-primary px-1.5 hover:underline">
              Aujourd&apos;hui
            </button>
          )}
          <button onClick={() => setWindowIndex(i => i + 1)} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors" aria-label="Période suivante">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground shrink-0 overflow-x-auto">
        {(['disponible', 'partiel', 'occupe', 'surcharge'] as const).map(level => (
          <span key={level} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', occupancyLevelColor(level).split(' ')[0])} />
            {occupancyLevelLabel(level)}
          </span>
        ))}
      </div>

      {/* Alerts */}
      {conflictsSummary.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-destructive/5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-700 text-destructive mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {conflictsSummary.length} double{conflictsSummary.length > 1 ? 's' : ''} affectation{conflictsSummary.length > 1 ? 's' : ''} détectée{conflictsSummary.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
            {conflictsSummary.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-600 text-foreground">{c.artisanName}</span> est déjà affecté du {formatDate(c.overlapStart)} au {formatDate(c.overlapEnd)} sur {c.taskA.project?.name ?? 'un chantier'} et {c.taskB.project?.name ?? 'un autre chantier'}.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Desktop grid */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 border-r border-border flex flex-col bg-surface z-10 overflow-y-auto">
          <div className="h-[40px] border-b border-border flex items-center px-4 shrink-0">
            <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Artisan</span>
          </div>
          {visibleArtisans.map(a => (
            <div key={a.id} style={{ height: ROW_H }} className="flex items-center gap-2.5 px-4 border-b border-border shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-700 shrink-0" style={{ background: a.color }}>
                {a.full_name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-600 text-foreground truncate">{a.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.trade}</p>
              </div>
            </div>
          ))}
          {visibleArtisans.length === 0 && (
            <div className="px-4 py-6 text-xs text-muted-foreground">Aucun artisan</div>
          )}
          {showTeams && teams.length > 0 && (
            <>
              <div className="h-[32px] border-b border-border flex items-center px-4 bg-background/50 shrink-0">
                <span className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">Équipes</span>
              </div>
              {teams.map(team => (
                <div key={team.id} style={{ height: ROW_H }} className="flex items-center gap-2.5 px-4 border-b border-border shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.color ?? '#94a3b8' }} />
                  <p className="text-sm font-600 text-foreground truncate">{team.name}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <div style={{ width: WEEK_COL_WIDTH * weeks.length, minWidth: '100%' }}>
            <div className="h-[40px] border-b border-border flex sticky top-0 bg-surface z-10">
              {weeks.map(w => (
                <div key={w.toISOString()} style={{ width: WEEK_COL_WIDTH, flexShrink: 0 }} className="border-r border-border flex items-center justify-center text-xs font-600 text-muted-foreground">
                  {format(w, 'd MMM', { locale: fr })}
                </div>
              ))}
            </div>

            {visibleArtisans.map(a => (
              <div key={a.id} style={{ height: ROW_H }} className="flex border-b border-border">
                {(artisanWeekData.get(a.id) ?? []).map(occ => (
                  <button
                    key={occ.weekStart}
                    style={{ width: WEEK_COL_WIDTH, flexShrink: 0 }}
                    onClick={() => setSelectedCell({ kind: 'artisan', id: a.id, name: a.full_name, color: a.color, weekOcc: occ })}
                    className={cn('h-full flex flex-col items-center justify-center gap-0.5 border-r border-border transition-opacity hover:opacity-80', occupancyLevelColor(occ.level))}
                  >
                    <span className="text-sm font-700">{occ.rate}%</span>
                    <span className="text-[10px]">{occ.tasks.length} tâche{occ.tasks.length !== 1 ? 's' : ''}</span>
                    {occ.hasConflict && <span className="text-[9px] font-700">Double affectation</span>}
                  </button>
                ))}
              </div>
            ))}

            {showTeams && teams.length > 0 && (
              <>
                <div className="h-[32px] border-b border-border bg-background/50" style={{ width: WEEK_COL_WIDTH * weeks.length }} />
                {teams.map(team => (
                  <div key={team.id} style={{ height: ROW_H }} className="flex border-b border-border">
                    {(teamWeekData.get(team.id) ?? []).map(occ => (
                      <button
                        key={occ.weekStart}
                        style={{ width: WEEK_COL_WIDTH, flexShrink: 0 }}
                        onClick={() => setSelectedCell({ kind: 'team', id: team.id, name: team.name, color: team.color ?? '#94a3b8', weekOcc: occ })}
                        className={cn('h-full flex flex-col items-center justify-center gap-0.5 border-r border-border transition-opacity hover:opacity-80', occupancyLevelColor(occ.level))}
                      >
                        <span className="text-sm font-700">{occ.rate}%</span>
                        <span className="text-[10px]">{occ.tasks.length} tâche{occ.tasks.length !== 1 ? 's' : ''}</span>
                        {occ.hasConflict && <span className="text-[9px] font-700">Double affectation</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile — cartes, semaine courante uniquement */}
      <div className="md:hidden flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Semaine du {formatDate(toISODate(todayWeek))}
        </p>
        {visibleArtisans.map(a => {
          const occ = todayWeekOcc.get(a.id)
          if (!occ) return null
          return (
            <div key={a.id} className="bg-background border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-700 shrink-0" style={{ background: a.color }}>
                  {a.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-600 text-sm text-foreground truncate">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.trade}</p>
                </div>
                <span className={cn('text-xs px-2 py-1 rounded-full font-700 shrink-0', occupancyLevelColor(occ.level))}>{occ.rate}%</span>
              </div>
              {occ.hasConflict && (
                <div className="flex items-center gap-1.5 text-xs text-destructive font-600 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Double affectation
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {occ.tasks.map(t => (
                  <button key={t.id} onClick={() => openTask(t.id)} className="text-left text-xs text-foreground bg-elevated rounded-lg px-2.5 py-1.5 hover:bg-elevated/70 transition-colors">
                    <span className="font-600">{t.title}</span> · {t.project?.name ?? 'Chantier'}
                  </button>
                ))}
                {occ.tasks.length === 0 && <p className="text-xs text-muted-foreground">Disponible cette semaine.</p>}
              </div>
            </div>
          )
        })}
        {visibleArtisans.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun artisan à afficher</p>}
      </div>

      {/* Detail panel */}
      {selectedCell && (
        <div className="border-t border-border bg-surface p-4 shrink-0 max-h-64 overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Semaine du {formatDate(selectedCell.weekOcc.weekStart)} au {formatDate(selectedCell.weekOcc.weekEnd)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedCell.color }} />
                <h3 className="font-700 text-foreground">{selectedCell.name}</h3>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-600', occupancyLevelColor(selectedCell.weekOcc.level))}>
                  {occupancyLevelLabel(selectedCell.weekOcc.level)} — {selectedCell.weekOcc.rate}%
                </span>
              </div>
            </div>
            <button onClick={() => setSelectedCell(null)} className="text-muted-foreground hover:text-foreground transition-colors text-lg font-300 shrink-0">×</button>
          </div>
          <div className="flex flex-col gap-2">
            {selectedCell.weekOcc.tasks.map(t => (
              <button
                key={t.id}
                onClick={() => openTask(t.id)}
                className="flex items-center justify-between gap-3 bg-background border border-border rounded-lg px-3 py-2 text-left hover:border-primary/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.project?.name ?? 'Chantier'} · {formatDate(t.start_date)} → {formatDate(t.end_date)}</p>
                </div>
                <ChevronRightSmall className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
            {selectedCell.weekOcc.tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune tâche cette semaine — disponible.</p>
            )}
          </div>
        </div>
      )}

      {/* Édition — réutilise le TaskSidePanel existant du planning (décision §3) */}
      <TaskSidePanel
        task={selectedTask}
        artisans={artisans}
        teams={teams}
        availableTasks={localTasks}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={handleTaskUpdated}
        onDependenciesChanged={() => router.refresh()}
      />
    </div>
  )
}
