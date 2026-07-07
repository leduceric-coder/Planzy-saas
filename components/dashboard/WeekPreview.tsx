import Link from 'next/link'
import { Calendar, ArrowRight, User, Users } from 'lucide-react'
import { cn, taskStatusLabel, taskStatusColor } from '@/lib/utils'
import type { TaskStatus } from '@/lib/types'

export type WeekTask = {
  id: string
  title: string
  status: string
  end_date?: string | null
  project_id?: string
  project?: { name: string; color: string } | null
  assignee?: { full_name: string | null; color: string | null } | null
  team?: { name: string; color: string | null } | null
}

interface Props {
  tasks: WeekTask[]
  today: string
}

function diffDays(dateStr: string, today: string): number {
  const d = new Date(dateStr)
  const t = new Date(today)
  return Math.ceil((d.getTime() - t.getTime()) / 86_400_000)
}

function urgencyPill(diff: number) {
  if (diff === 0) return { label: "Aujourd'hui", cls: 'bg-red-500/10 text-red-600 dark:text-red-400' }
  if (diff === 1) return { label: 'Demain', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' }
  if (diff <= 3) return { label: `J+${diff}`, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' }
  return { label: `J+${diff}`, cls: 'bg-elevated text-muted-foreground' }
}

const MAX = 3

export function WeekPreview({ tasks, today }: Props) {
  const allItems = [...tasks]
    .filter(t => t.end_date)
    .sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''))
  const items = allItems.slice(0, MAX)
  const overflow = allItems.length - MAX

  return (
    <section className="bg-surface rounded-2xl border border-border/30 dark:border-white/[0.06] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/30 dark:border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
          <h2 className="text-xs font-700 uppercase tracking-widest text-muted-foreground">Cette semaine</h2>
        </div>
        <Link
          href="/planning"
          className="text-xs text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors"
        >
          Planning <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-muted-foreground">Aucune échéance cette semaine.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
          {items.map(task => {
            const diff = task.end_date ? diffDays(task.end_date, today) : null
            const pill = diff !== null ? urgencyPill(diff) : null
            const statusCls = taskStatusColor(task.status as TaskStatus)
            const assigneeName = task.assignee?.full_name
            const teamName = task.team?.name
            const personLabel = teamName ?? assigneeName ?? null
            const href = task.project_id
              ? `/chantiers/${task.project_id}?focus=task&id=${task.id}`
              : '/planning'

            return (
              <Link
                key={task.id}
                href={href}
                className="group flex flex-col gap-1.5 px-5 py-4 hover:bg-elevated/40 transition-colors"
              >
                {/* Row 1: pill + title */}
                <div className="flex items-start gap-2.5">
                  {pill && (
                    <span className={cn('text-[10px] font-700 px-2 py-0.5 rounded-md shrink-0 tabular-nums whitespace-nowrap', pill.cls)}>
                      {pill.label}
                    </span>
                  )}
                  <p className="text-[12.5px] font-500 text-foreground leading-snug line-clamp-2 flex-1">
                    {task.title}
                  </p>
                </div>

                {/* Row 2: project · status · assignee */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-0.5">
                  {task.project?.name && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                      {task.project.color && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: task.project.color }} />
                      )}
                      <span>{task.project.name}</span>
                    </span>
                  )}
                  {task.project?.name && (
                    <span className="text-muted-foreground/25 text-[10px]">·</span>
                  )}
                  <span className={cn('text-[9px] font-700 px-1.5 py-px rounded uppercase tracking-wide', statusCls)}>
                    {taskStatusLabel(task.status as TaskStatus)}
                  </span>
                  <span className="text-muted-foreground/25 text-[10px]">·</span>
                  <span className="inline-flex items-center gap-1 text-[10px]">
                    {personLabel ? (
                      <>
                        {teamName
                          ? <Users className="h-2.5 w-2.5 text-muted-foreground/55 shrink-0" />
                          : <User className="h-2.5 w-2.5 text-muted-foreground/55 shrink-0" />
                        }
                        <span className="text-muted-foreground/60">{personLabel}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/35 italic">Non assigné</span>
                    )}
                  </span>
                </div>
              </Link>
            )
          })}

          {overflow > 0 && (
            <Link
              href="/planning"
              className="flex items-center justify-between px-5 py-2.5 hover:bg-elevated/40 transition-colors"
            >
              <span className="text-[11px] text-muted-foreground/60">
                + {overflow} autre{overflow > 1 ? 's' : ''} cette semaine
              </span>
              <span className="text-[11px] font-600 text-primary flex items-center gap-1">
                Voir le planning <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
