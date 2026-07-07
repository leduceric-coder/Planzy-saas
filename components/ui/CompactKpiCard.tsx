import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// LOT 28 — KPI compact mutualisé. Remplace les 3 copies locales de `KpiTile`.
// LOT 28 CP2.1 — deux densités : `comfortable` (défaut, échelle Dashboard, pour
// les KPI de tête de page) et `compact` (zones secondaires). Hauteur dictée par
// le contenu (aucune hauteur fixe) — aucun transform/scale.

export type KpiTone = 'blue' | 'orange' | 'red' | 'green'
export type KpiDensity = 'comfortable' | 'compact'

const TONE = {
  blue:   { bubble: 'bg-primary/10 text-primary',        num: 'text-primary' },
  orange: { bubble: 'bg-orange-500/12 text-orange-500',  num: 'text-orange-500' },
  red:    { bubble: 'bg-red-500/12 text-red-500',        num: 'text-red-500' },
  green:  { bubble: 'bg-green-500/12 text-green-500',     num: 'text-green-500' },
} satisfies Record<KpiTone, { bubble: string; num: string }>

const DENSITY = {
  comfortable: {
    wrap:   'px-5 py-4 gap-4',
    bubble: 'w-11 h-11 rounded-2xl',
    icon:   'h-5 w-5',
    value:  'text-[26px]',
    label:  'text-[13px] mt-1',
    sub:    'text-[11px] mt-0.5',
  },
  compact: {
    wrap:   'px-4 py-3.5 gap-3.5',
    bubble: 'w-9 h-9 rounded-xl',
    icon:   'h-4 w-4',
    value:  'text-[22px]',
    label:  'text-[11px] mt-0.5',
    sub:    'text-[10px] mt-0.5',
  },
} satisfies Record<KpiDensity, Record<string, string>>

interface Props {
  icon: LucideIcon
  value: React.ReactNode
  label: string
  sub?: string | null
  /** Couleur de la bulle d'icône (défaut : bleu Kanvix). */
  tone?: KpiTone
  /** Si vrai, la valeur adopte la couleur de la tonalité (état d'alerte). */
  accent?: boolean
  /** Densité visuelle (défaut : comfortable, échelle Dashboard). */
  density?: KpiDensity
}

export function CompactKpiCard({
  icon: Icon, value, label, sub, tone = 'blue', accent = false, density = 'comfortable',
}: Props) {
  const t = TONE[tone]
  const d = DENSITY[density]
  return (
    <div className={cn(
      'dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] flex items-center',
      'shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]',
      d.wrap,
    )}>
      <div className={cn('flex items-center justify-center shrink-0', d.bubble, t.bubble)}>
        <Icon className={d.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn(
          'font-800 leading-none tabular-nums tracking-tight',
          d.value,
          accent ? t.num : 'text-foreground',
        )}>
          {value}
        </p>
        <p className={cn('text-muted-foreground leading-snug truncate', d.label)}>{label}</p>
        {sub && (
          <p className={cn(
            'truncate',
            d.sub,
            accent ? cn(t.num, 'opacity-80') : 'text-muted-foreground/60',
          )}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
