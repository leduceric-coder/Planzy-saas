import Link from 'next/link'
import { Clock, AlertOctagon, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LateTask {
  id: string
  title: string
  project_id: string
  end_date?: string | null
  project?: { name: string }
}

interface BlockedTask {
  id: string
  title: string
  project_id: string
  project?: { name: string }
}

interface CriticalIssue {
  id: string
  title: string
  priority: string
  project_id: string
  project?: { name: string }
}

interface Props {
  lateTasks: LateTask[]
  blockedTasks: BlockedTask[]
  criticalIssues: CriticalIssue[]
}

export function AlertesPrioritaires({ lateTasks, blockedTasks, criticalIssues }: Props) {
  const allItems = [
    ...lateTasks.slice(0, 3).map(t => ({
      key: `late-${t.id}`,
      Icon: Clock,
      dot: 'bg-red-500',
      badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
      label: 'Retard',
      title: t.title,
      sub: t.project?.name ?? '',
      href: `/chantiers/${t.project_id}`,
    })),
    ...blockedTasks.slice(0, 3).map(t => ({
      key: `blocked-${t.id}`,
      Icon: AlertOctagon,
      dot: 'bg-orange-500',
      badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      label: 'Bloquée',
      title: t.title,
      sub: t.project?.name ?? '',
      href: `/chantiers/${t.project_id}`,
    })),
    ...criticalIssues.slice(0, 3).map(i => ({
      key: `issue-${i.id}`,
      Icon: AlertTriangle,
      dot: 'bg-yellow-500',
      badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500',
      label: i.priority === 'critical' ? 'Critique' : 'Priorité haute',
      title: i.title,
      sub: i.project?.name ?? '',
      href: `/chantiers/${i.project_id}`,
    })),
  ].slice(0, 5)

  if (allItems.length === 0) return null

  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-border/30 dark:border-white/[0.07] shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-border/30 dark:border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <h2 className="font-700 text-sm text-foreground">Priorités du jour</h2>
          <span className="text-[11px] font-700 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
            {allItems.length}
          </span>
        </div>
        <Link
          href="/planning"
          className="text-xs text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 transition-colors"
        >
          Planning <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Items */}
      <div>
        {allItems.map(item => (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center gap-4 px-5 py-4 hover:bg-elevated/50 transition-colors group border-b border-border/20 dark:border-white/[0.04] last:border-0"
          >
            {/* Urgency strip */}
            <div className={cn('w-1 h-8 rounded-full shrink-0', item.dot)} />
            {/* Icon */}
            <item.Icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-foreground truncate leading-snug">{item.title}</p>
              {item.sub && (
                <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{item.sub}</p>
              )}
            </div>
            {/* Badge */}
            <span className={cn('text-[11px] font-700 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap', item.badge)}>
              {item.label}
            </span>
            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
