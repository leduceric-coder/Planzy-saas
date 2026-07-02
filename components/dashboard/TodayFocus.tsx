'use client'

import Link from 'next/link'
import { AlertOctagon, Clock, Flag, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FocusTask = {
  id: string
  title: string
  status: string
  end_date?: string | null
  project_id?: string
  project?: { name: string } | null
}

export type FocusIssue = {
  id: string
  title: string
  priority: string
  project_id: string
  project?: { name: string } | null
}

type FocusItem = {
  key: string
  kind: 'critical' | 'blocked' | 'late'
  entityId: string
  title: string
  projectName?: string
  projectId?: string
  priority?: string
}

interface Props {
  lateTasks: FocusTask[]
  blockedTasks: FocusTask[]
  criticalIssues: FocusIssue[]
}

const CFG = {
  critical: {
    borderCls: 'border-l-red-500',
    pill:      'bg-red-500/10 text-red-600 dark:text-red-400',
    label:     'Réserve critique',
    cta:       'Voir la réserve',
    ctaCls:    'text-red-600/70 dark:text-red-400/70 group-hover:text-red-600 dark:group-hover:text-red-400',
    focus: 'issue',
    Icon: Flag,
  },
  blocked: {
    borderCls: 'border-l-orange-500',
    pill:      'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    label:     'Tâche bloquée',
    cta:       'Voir →',
    ctaCls:    'text-primary/60 group-hover:text-primary',
    focus: 'task',
    Icon: AlertOctagon,
  },
  late: {
    borderCls: 'border-l-amber-500',
    pill:      'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    label:     'Retard détecté',
    cta:       'Voir →',
    ctaCls:    'text-primary/60 group-hover:text-primary',
    focus: 'task',
    Icon: Clock,
  },
} as const

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Priorité critique',
  high:     'Priorité haute',
  medium:   'Priorité moyenne',
  low:      'Priorité basse',
}

const MAX_ITEMS = 6

export function TodayFocus({ lateTasks, blockedTasks, criticalIssues }: Props) {
  const items: FocusItem[] = [
    ...criticalIssues.map(i => ({
      key: `issue-${i.id}`,
      kind: 'critical' as const,
      entityId: i.id,
      title: i.title,
      projectName: i.project?.name,
      projectId: i.project_id,
      priority: i.priority,
    })),
    ...blockedTasks.map(t => ({
      key: `blocked-${t.id}`,
      kind: 'blocked' as const,
      entityId: t.id,
      title: t.title,
      projectName: t.project?.name,
      projectId: t.project_id,
    })),
    ...lateTasks.map(t => ({
      key: `late-${t.id}`,
      kind: 'late' as const,
      entityId: t.id,
      title: t.title,
      projectName: t.project?.name,
      projectId: t.project_id,
    })),
  ].slice(0, MAX_ITEMS)

  const total = items.length

  return (
    <section data-demo-target="dashboard-today-focus" className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[460px]">
      {/* Header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
            À traiter aujourd'hui
          </h2>
          {total > 0 && (
            <span className="min-w-[20px] h-5 rounded-full bg-destructive text-white text-[10px] font-700 flex items-center justify-center px-1.5 leading-none">
              {total}
            </span>
          )}
        </div>
        <Link
          href="/chantiers"
          className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-1 transition-colors"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500/50" />
            <div>
              <p className="text-sm font-600 text-foreground">Tout est sous contrôle</p>
              <p className="text-xs text-muted-foreground mt-0.5">Aucune tâche urgente ni réserve critique.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/15 dark:divide-white/[0.04]">
            {items.map(item => {
              const c = CFG[item.kind]
              const href = item.projectId
                ? `/chantiers/${item.projectId}?focus=${c.focus}&id=${item.entityId}`
                : undefined

              const content = (
                <div className={cn('flex-1 min-w-0 pl-4 border-l-[3px]', c.borderCls)}>
                  {/* Badge + project */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[9.5px] font-700 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0',
                      c.pill,
                    )}>
                      <c.Icon className="h-2.5 w-2.5" />
                      {c.label}
                    </span>
                    {item.projectName && (
                      <span className="text-[11px] text-muted-foreground/55 font-500 truncate">{item.projectName}</span>
                    )}
                  </div>
                  {/* Title */}
                  <p className="text-[13px] font-600 text-foreground leading-snug truncate">{item.title}</p>
                  {/* Priority */}
                  {item.priority && PRIORITY_LABEL[item.priority] && (
                    <p className="text-[10.5px] text-muted-foreground/50 mt-0.5">{PRIORITY_LABEL[item.priority]}</p>
                  )}
                </div>
              )

              return href ? (
                <Link
                  key={item.key}
                  href={href}
                  className="group flex items-center gap-0 px-5 py-3.5 hover:bg-elevated/35 dark:hover:bg-elevated/50 transition-colors"
                >
                  {content}
                  <span className={cn('ml-4 shrink-0 flex items-center gap-1 text-[11px] font-600 transition-colors', c.ctaCls)}>
                    {c.cta} <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </Link>
              ) : (
                <div key={item.key} className="flex items-center gap-0 px-5 py-3.5">
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer link */}
      {total > 0 && (
        <div className="shrink-0 px-5 py-3 border-t border-border/15 dark:border-white/[0.04]">
          <Link
            href="/chantiers"
            className="text-[11px] text-primary/70 hover:text-primary font-600 flex items-center gap-1 transition-colors"
          >
            Voir toutes les alertes <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}
    </section>
  )
}
