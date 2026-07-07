import Link from 'next/link'
import { Flag, AlertOctagon, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChantierAlertItem = {
  key: string
  kind: 'critical' | 'blocked' | 'late'
  title: string
  projectName?: string
  href: string
}

const CFG = {
  critical: { Icon: Flag, dot: 'bg-red-500', label: 'Réserve critique', cta: 'Voir la réserve' },
  blocked: { Icon: AlertOctagon, dot: 'bg-orange-500', label: 'Tâche bloquée', cta: 'Ouvrir la tâche' },
  late: { Icon: Clock, dot: 'bg-amber-500', label: 'Retard détecté', cta: 'Ouvrir la tâche' },
} as const

export function ChantiersAlertBanner({ items }: { items: ChantierAlertItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="mb-6 bg-surface rounded-2xl border border-border/30 dark:border-white/[0.06] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border/30 dark:border-white/[0.05] flex items-center gap-2.5">
        <h2 className="text-sm font-700 text-foreground">À traiter sur vos chantiers</h2>
        <span className="min-w-[20px] h-5 rounded-full bg-destructive text-white text-[10px] font-700 flex items-center justify-center px-1.5 leading-none">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-border/20 dark:divide-white/[0.04]">
        {items.map(item => {
          const c = CFG[item.kind]
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex items-center gap-3.5 px-5 py-3 hover:bg-elevated/40 transition-colors"
            >
              <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-700 text-muted-foreground uppercase tracking-wide shrink-0">
                    <c.Icon className="h-2.5 w-2.5" />
                    {c.label}
                  </span>
                  {item.projectName && (
                    <span className="text-[11px] text-muted-foreground/60 truncate">{item.projectName}</span>
                  )}
                </div>
                <p className="text-[13px] font-500 text-foreground truncate leading-snug">{item.title}</p>
              </div>
              <span className="shrink-0 flex items-center gap-1 text-[11px] font-600 text-primary group-hover:text-primary/80 transition-colors">
                {c.cta} <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
