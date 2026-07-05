import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// LOT 28 — Coquille de section + header mutualisés. Généralise le motif recopié
// (DashTile de ChantierDetail + coquilles inline de RapportsClient/ChantiersClient) :
// carte `rounded-2xl` + header `px-5 py-3 border-b` avec icône, titre uppercase et
// badge compteur optionnel. Hauteur dictée par le contenu.

type BadgeTone = 'blue' | 'red' | 'orange' | 'green' | 'muted'

const BADGE: Record<BadgeTone, string> = {
  blue:   'bg-primary/12 text-primary border-primary/20',
  red:    'bg-red-500/12 text-red-600 dark:text-red-400 border-red-500/20',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/20',
  green:  'bg-green-500/12 text-green-600 dark:text-green-400 border-green-500/20',
  muted:  'bg-foreground/8 text-muted-foreground border-border/40',
}

export function SectionHeader({
  title, icon: Icon, iconClassName, count, countTone = 'blue', action,
}: {
  title: string
  icon?: LucideIcon
  iconClassName?: string
  count?: number
  countTone?: BadgeTone
  action?: React.ReactNode
}) {
  return (
    <div className="shrink-0 px-5 py-3 border-b border-border/25 dark:border-white/[0.06] flex items-center gap-2.5">
      {Icon && <Icon className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', iconClassName)} />}
      <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1 truncate">
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span className={cn(
          'min-w-[20px] h-5 rounded-full text-[10px] font-700 flex items-center justify-center px-1.5 leading-none border tabular-nums',
          BADGE[countTone],
        )}>
          {count}
        </span>
      )}
      {action}
    </div>
  )
}

interface SectionProps {
  title?: string
  icon?: LucideIcon
  iconClassName?: string
  count?: number
  countTone?: BadgeTone
  action?: React.ReactNode
  urgent?: boolean
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

export function PageSection({
  title, icon, iconClassName, count, countTone, action, urgent = false,
  className, bodyClassName, children,
}: SectionProps) {
  return (
    <section className={cn(
      'dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08]',
      'shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden',
      urgent && 'border-orange-500/30 dark:border-orange-500/25',
      className,
    )}>
      {title !== undefined && (
        <SectionHeader
          title={title}
          icon={icon}
          iconClassName={iconClassName}
          count={count}
          countTone={countTone}
          action={action}
        />
      )}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  )
}
