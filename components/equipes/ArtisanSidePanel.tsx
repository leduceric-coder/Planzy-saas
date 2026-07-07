'use client'

import { Phone, Mail, Pencil, Users } from 'lucide-react'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { cn, getInitials } from '@/lib/utils'

// ── Shared types (imported by EquipesClient) ──────────────────────────────────

export type TaskWithProject = {
  id: string
  project_id: string
  title: string
  status: string
  start_date: string | null
  end_date: string | null
  assigned_to: string | null
  assigned_team: string | null
}

export type EnrichedArtisan = {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  color: string | null
  phone: string | null
  email: string | null
  status: 'free' | 'assigned' | 'conflict'
  weekTasks: (TaskWithProject & { projectInfo: { id: string; name: string; color: string } | null })[]
  currentProjects: { id: string; name: string; color: string }[]
  artisanTeams: { id: string; name: string; color: string | null }[]
}

// ── Component ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  free:     { label: 'Disponible',    cls: 'bg-muted/40 text-muted-foreground/70 border-border/30' },
  assigned: { label: 'Affecté',       cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  conflict: { label: 'Multi-affecté', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
}

const TASK_STATUS_LABEL: Record<string, string> = {
  todo:        'À faire',
  in_progress: 'En cours',
  blocked:     'Bloquée',
  review:      'En révision',
}

interface Props {
  artisan: EnrichedArtisan
  onClose: () => void
  onEdit: () => void
}

export function ArtisanSidePanel({ artisan, onClose, onEdit }: Props) {
  const initials = getInitials(artisan.full_name)
  const config = STATUS_CONFIG[artisan.status]

  return (
    <SlidePanel
      onClose={onClose}
      title={artisan.full_name ?? 'Artisan'}
      subtitle={artisan.trade ?? undefined}
    >
      <div className="flex flex-col gap-6">

        {/* ── Avatar + status ── */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-700 shrink-0"
            style={{ background: artisan.color ?? '#6366f1' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-700 text-[16px] text-foreground leading-tight">{artisan.full_name ?? 'Artisan'}</p>
            {artisan.trade && <p className="text-sm text-muted-foreground mt-0.5">{artisan.trade}</p>}
            <span className={cn(
              'inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border mt-1.5',
              config.cls,
            )}>
              {config.label}
            </span>
          </div>
        </div>

        {/* ── Contact ── */}
        {(artisan.phone || artisan.email) && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Contact</h3>
            <div className="flex flex-col gap-1.5">
              {artisan.phone && (
                <a
                  href={`tel:${artisan.phone}`}
                  className="flex items-center gap-2.5 text-sm text-foreground/80 hover:text-primary transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <span className="font-500">{artisan.phone}</span>
                </a>
              )}
              {artisan.email && (
                <a
                  href={`mailto:${artisan.email}`}
                  className="flex items-center gap-2.5 text-sm text-foreground/80 hover:text-primary transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <span className="font-500">{artisan.email}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Tâches cette semaine ── */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">
            Tâches cette semaine
            {artisan.weekTasks.length > 0 && (
              <span className="ml-2 normal-case font-600 text-foreground/60">{artisan.weekTasks.length}</span>
            )}
          </h3>
          {artisan.weekTasks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/50 italic">Aucune tâche planifiée cette semaine</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {artisan.weekTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-elevated/50 border border-border/30"
                >
                  {task.projectInfo?.color && (
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: task.projectInfo.color }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-600 text-foreground truncate">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {task.projectInfo?.name ?? '—'}
                    </p>
                  </div>
                  {task.status !== 'todo' && task.status !== 'in_progress' && (
                    <span className={cn(
                      'text-[9.5px] font-700 px-1.5 py-0.5 rounded-full border shrink-0',
                      task.status === 'blocked'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                        : 'bg-muted/40 text-muted-foreground border-border/30',
                    )}>
                      {TASK_STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Chantiers ── */}
        {artisan.currentProjects.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Chantiers</h3>
            <div className="flex flex-col gap-1.5">
              {artisan.currentProjects.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-foreground/80">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="font-500 truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Équipes ── */}
        {artisan.artisanTeams.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Équipes</h3>
            <div className="flex flex-wrap gap-1.5">
              {artisan.artisanTeams.map(team => (
                <span
                  key={team.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/40 bg-elevated text-[12px] font-500 text-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: team.color ?? '#6366f1' }} />
                  {team.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {artisan.artisanTeams.length === 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Équipes</h3>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/45 italic">
              <Users className="h-3 w-3" />
              Non affecté à une équipe
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="pt-2 border-t border-border/30">
          <button
            onClick={onEdit}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated hover:border-border/70 transition-colors text-sm font-600 text-foreground"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Modifier cet artisan
          </button>
        </div>

      </div>
    </SlidePanel>
  )
}
