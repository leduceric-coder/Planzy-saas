import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// LOT 28 — KPI compact mutualisé. Remplace les 3 copies locales de `KpiTile`
// (RapportsClient, ChantiersClient, ChantierDetail) par un composant unique.
// Hauteur dictée par le contenu (aucune hauteur fixe), padding et tailles alignés
// sur la référence de densité du Dashboard.

export type KpiTone = 'blue' | 'orange' | 'red' | 'green'

const TONE = {
  blue:   { bubble: 'bg-primary/10 text-primary',        num: 'text-primary' },
  orange: { bubble: 'bg-orange-500/12 text-orange-500',  num: 'text-orange-500' },
  red:    { bubble: 'bg-red-500/12 text-red-500',        num: 'text-red-500' },
  green:  { bubble: 'bg-green-500/12 text-green-500',     num: 'text-green-500' },
} satisfies Record<KpiTone, { bubble: string; num: string }>

interface Props {
  icon: LucideIcon
  value: React.ReactNode
  label: string
  sub?: string | null
  /** Couleur de la bulle d'icône (défaut : bleu Kanvix). */
  tone?: KpiTone
  /** Si vrai, la valeur adopte la couleur de la tonalité (état d'alerte). */
  accent?: boolean
}

export function CompactKpiCard({ icon: Icon, value, label, sub, tone = 'blue', accent = false }: Props) {
  const t = TONE[tone]
  return (
    <div className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] px-4 py-3.5 flex items-center gap-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.bubble)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-[22px] font-800 leading-none tabular-nums tracking-tight',
          accent ? t.num : 'text-foreground',
        )}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug truncate">{label}</p>
        {sub && (
          <p className={cn(
            'text-[10px] mt-0.5 truncate',
            accent ? cn(t.num, 'opacity-80') : 'text-muted-foreground/55',
          )}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
