import Link from 'next/link'
import { AlertOctagon, Clock, Flag, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RiskProject = {
  id: string
  name: string
  color: string
  risks: { late: number; blocked: number; critical: number }
}

export function RiskProjectCard({ project }: { project: RiskProject }) {
  const { late, blocked, critical } = project.risks

  const topBorderColor = critical > 0
    ? 'border-t-red-500/60'
    : blocked > 0
      ? 'border-t-orange-500/60'
      : 'border-t-amber-500/50'

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border/30 dark:border-white/[0.06] border-t-2 p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow',
      topBorderColor,
    )}>
      {/* Project name */}
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: project.color }} />
        <p className="text-[13px] font-600 text-foreground truncate flex-1">{project.name}</p>
      </div>

      {/* Risk signals */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {critical > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-700 text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/12 px-1.5 py-0.5 rounded-md">
            <Flag className="h-2.5 w-2.5" />
            {critical} critique{critical > 1 ? 's' : ''}
          </span>
        )}
        {blocked > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-700 text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/12 px-1.5 py-0.5 rounded-md">
            <AlertOctagon className="h-2.5 w-2.5" />
            {blocked} bloquée{blocked > 1 ? 's' : ''}
          </span>
        )}
        {late > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-700 text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
            <Clock className="h-2.5 w-2.5" />
            {late} en retard
          </span>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/chantiers/${project.id}`}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg border border-border/50 dark:border-white/[0.08] text-[11px] font-600 text-muted-foreground hover:bg-elevated hover:text-foreground hover:border-border transition-all"
      >
        Voir le chantier <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
