import Link from 'next/link'
import { Users, AlertTriangle, ArrowRight } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

export type AssignmentArtisan = {
  id: string
  full_name: string
  trade: string
  color: string
}

export type AssignmentTask = {
  id: string
  title: string
  end_date?: string | null
  project_id?: string
  project?: { name: string; color: string } | null
  assigned_to?: string | null
  assigned_team?: string | null
}

export type TeamMemberRef = {
  team_id: string
  artisan_id: string
}

interface Props {
  artisans: AssignmentArtisan[]
  tasks: AssignmentTask[]
  teamMembers: TeamMemberRef[]
  today: string
}

type ArtisanStatus = 'conflict' | 'assigned' | 'free'

function getStatus(taskCount: number): ArtisanStatus {
  if (taskCount > 1) return 'conflict'
  if (taskCount === 1) return 'assigned'
  return 'free'
}

const STATUS_BADGE: Record<ArtisanStatus, { label: string; cls: string }> = {
  conflict: { label: 'Conflit',  cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' },
  assigned: { label: 'Affecté', cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' },
  free:     { label: 'Libre',   cls: 'bg-muted/40 text-muted-foreground/60 border border-border/30' },
}

export function TeamAssignments({ artisans, tasks, teamMembers, today }: Props) {
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Build team_id → artisan_ids lookup
  const artisansByTeam = new Map<string, string[]>()
  for (const tm of teamMembers) {
    if (!artisansByTeam.has(tm.team_id)) artisansByTeam.set(tm.team_id, [])
    artisansByTeam.get(tm.team_id)!.push(tm.artisan_id)
  }

  const tasksByArtisan = new Map<string, AssignmentTask[]>()
  for (const a of artisans) tasksByArtisan.set(a.id, [])
  for (const t of tasks) {
    if (!t.end_date || t.end_date < today || t.end_date > weekEndStr) continue

    // Direct artisan assignment
    if (t.assigned_to && tasksByArtisan.has(t.assigned_to)) {
      tasksByArtisan.get(t.assigned_to)!.push(t)
    }

    // Team assignment: fan out to all artisans in the team
    if (t.assigned_team) {
      const memberIds = artisansByTeam.get(t.assigned_team) ?? []
      for (const artisanId of memberIds) {
        if (tasksByArtisan.has(artisanId)) {
          tasksByArtisan.get(artisanId)!.push(t)
        }
      }
    }
  }

  const assigned  = artisans.filter(a => (tasksByArtisan.get(a.id)?.length ?? 0) === 1).length
  const conflicts = artisans.filter(a => (tasksByArtisan.get(a.id)?.length ?? 0) > 1).length
  const free      = artisans.filter(a => (tasksByArtisan.get(a.id)?.length ?? 0) === 0).length

  return (
    <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[340px]">
      {/* Header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
          <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
            Équipes & affectations
          </h2>
        </div>
        <span className="text-[10.5px] text-muted-foreground/55">
          {assigned + conflicts} affecté{assigned + conflicts > 1 ? 's' : ''} · {conflicts > 0 ? `${conflicts} conflit${conflicts > 1 ? 's' : ''} · ` : ''}{free} libre{free > 1 ? 's' : ''}
        </span>
      </div>

      {/* Conflict alert */}
      {conflicts > 0 && (
        <div className="shrink-0 mx-4 mt-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <p className="text-[11.5px] font-600 text-orange-600 dark:text-orange-400 flex-1">
            {conflicts} conflit{conflicts > 1 ? 's' : ''} d'affectation à vérifier
          </p>
          <Link href="/equipes" className="text-[11px] text-primary font-600 hover:underline shrink-0 flex items-center gap-0.5">
            Voir <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}

      {artisans.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
          <Users className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground text-center">Aucun artisan enregistré.</p>
          <Link href="/equipes" className="text-xs text-primary hover:underline">Ajouter →</Link>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="shrink-0 grid grid-cols-[2fr_1fr_2fr_auto] items-center gap-3 px-5 py-2.5 border-b border-border/40 bg-foreground/[0.02]">
            <span className="text-[9.5px] font-800 uppercase tracking-wider text-muted-foreground/70">Artisan</span>
            <span className="text-[9.5px] font-800 uppercase tracking-wider text-muted-foreground/70">Rôle</span>
            <span className="text-[9.5px] font-800 uppercase tracking-wider text-muted-foreground/70">Chantier actuel</span>
            <span className="text-[9.5px] font-800 uppercase tracking-wider text-muted-foreground/70">Statut</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {artisans.map(artisan => {
              const artisanTasks = tasksByArtisan.get(artisan.id) ?? []
              const status = getStatus(artisanTasks.length)
              const badge = STATUS_BADGE[status]
              const initials = getInitials(artisan.full_name)
              const mainTask = artisanTasks[0]

              return (
                <div
                  key={artisan.id}
                  className="grid grid-cols-[2fr_1fr_2fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-foreground/[0.02] transition-colors"
                >
                  {/* Artisan */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full text-white text-[10px] font-700 flex items-center justify-center shrink-0"
                      style={{ background: artisan.color || '#6366f1' }}
                    >
                      {initials}
                    </div>
                    <span className="text-[12.5px] font-600 text-foreground truncate">{artisan.full_name}</span>
                  </div>

                  {/* Role */}
                  <span className="text-[11.5px] text-slate-600 dark:text-slate-400 truncate font-500">{artisan.trade}</span>

                  {/* Chantier */}
                  <div className="min-w-0">
                    {mainTask ? (
                      <Link
                        href={mainTask.project_id ? `/chantiers/${mainTask.project_id}` : '/equipes'}
                        className="flex items-center gap-1.5 text-[11.5px] text-foreground/80 hover:text-primary transition-colors truncate group"
                      >
                        {mainTask.project?.color && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mainTask.project.color }} />
                        )}
                        <span className="truncate font-500">
                          {mainTask.project?.name ?? mainTask.title}
                          {artisanTasks.length > 1 && (
                            <span className="text-orange-500 ml-1">({artisanTasks.length} chantiers)</span>
                          )}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/55">Disponible</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={cn('text-[9px] font-700 px-2 py-0.5 rounded-full whitespace-nowrap', badge.cls)}>
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-border/15 dark:border-white/[0.04]">
            <Link
              href="/equipes"
              className="text-[11px] text-primary/70 hover:text-primary font-600 flex items-center gap-1 transition-colors"
            >
              Voir toutes les équipes <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
