import { Building2, Clock, AlertTriangle, Flag, Wrench, CheckCircle2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── KpiTile: 2×2 visual grid for terrain dashboard ─────────────────────────

const kpiIcons = {
  wrench:   Wrench,
  check:    CheckCircle2,
  alert:    AlertTriangle,
  users:    Users,
  clock:    Clock,
  flag:     Flag,
  building: Building2,
}

const kpiPalette = {
  default: { icon: 'bg-primary/10 text-primary',         num: 'text-foreground',                ring: '#6366f1' },
  green:   { icon: 'bg-green-500/10 text-green-500',     num: 'text-green-600 dark:text-green-400', ring: '#22c55e' },
  orange:  { icon: 'bg-orange-500/10 text-orange-500',   num: 'text-orange-500',                ring: '#f97316' },
  red:     { icon: 'bg-red-500/10 text-red-500',         num: 'text-red-500',                   ring: '#ef4444' },
  blue:    { icon: 'bg-blue-500/10 text-blue-500',       num: 'text-blue-600 dark:text-blue-400', ring: '#3b82f6' },
}

export interface KpiTileItem {
  label: string
  value: number | string
  sublabel?: string
  icon?: keyof typeof kpiIcons
  color?: keyof typeof kpiPalette
  max?: number
}

function KpiCell({ item, index }: { item: KpiTileItem; index: number }) {
  const pal = kpiPalette[item.color ?? 'default']
  const Icon = item.icon ? kpiIcons[item.icon] : null
  const numVal = typeof item.value === 'number' ? item.value : Number(item.value) || 0
  const maxVal = item.max ?? Math.max(numVal, 1)
  const pct = Math.min((numVal / maxVal) * 100, 100)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-5 py-5 border-border/20 dark:border-white/[0.05]',
        index % 2 === 0 && 'border-r',
        index < 2 && 'border-b',
      )}
    >
      {/* Icon + value row */}
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', pal.icon)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <p className={cn('text-[2.2rem] font-extrabold tabular-nums leading-none tracking-tight ml-auto', pal.num)}>
          {item.value}
        </p>
      </div>

      {/* Label */}
      <div>
        <p className="text-[12px] text-muted-foreground leading-tight font-500">{item.label}</p>
        {item.sublabel && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{item.sublabel}</p>
        )}
      </div>

      {/* Mini progress bar */}
      <div className="h-1 rounded-full bg-border/30 dark:bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pal.ring }}
        />
      </div>
    </div>
  )
}

export function KpiTile({ items }: { items: KpiTileItem[] }) {
  return (
    <section className="bg-surface rounded-2xl border border-border/30 dark:border-white/[0.06] shadow-sm overflow-hidden min-h-[380px] flex flex-col">
      <div className="px-5 py-3.5 border-b border-border/30 dark:border-white/[0.05] shrink-0">
        <h2 className="text-xs font-700 uppercase tracking-widest text-muted-foreground">KPI utiles</h2>
      </div>
      <div className="flex-1 grid grid-cols-2">
        {items.slice(0, 4).map((item, i) => (
          <KpiCell key={i} item={item} index={i} />
        ))}
      </div>
    </section>
  )
}

const icons = {
  building: Building2,
  clock:    Clock,
  alert:    AlertTriangle,
  flag:     Flag,
}

const palette = {
  blue:   { bubble: 'bg-primary/10 text-primary',         num: 'text-primary'    },
  orange: { bubble: 'bg-orange-500/10 text-orange-500',   num: 'text-orange-500' },
  green:  { bubble: 'bg-green-500/10 text-green-500',     num: 'text-green-500'  },
  red:    { bubble: 'bg-red-500/10 text-red-500',         num: 'text-red-500'    },
}

export interface KpiItem {
  label: string
  value: number | string
  icon: keyof typeof icons
  color: keyof typeof palette
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
}

export function KpiPanel({ items }: { items: KpiItem[] }) {
  return (
    <div className="bg-surface border border-border/30 dark:border-white/[0.07] rounded-2xl shadow-sm dark:shadow-black/20 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((item, i) => (
          <KpiPanelCell key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}

function KpiPanelCell({ item, index }: { item: KpiItem; index: number }) {
  const Icon = icons[item.icon]
  const col = palette[item.color]
  const isAlert = (item.color === 'red' || item.color === 'orange') && Number(item.value) > 0

  return (
    <div className={cn(
      'flex items-center gap-4 px-6 py-5',
      // Shared border color token
      'border-border/20 dark:border-white/[0.05]',
      // Mobile 2-col: right border on left column (0, 2)
      index % 2 === 0 && 'border-r',
      // Mobile 2-col: bottom border on top row (0, 1), removed on sm
      index < 2 && 'border-b sm:border-b-0',
      // Desktop 4-col: right border on all except last
      index < 3 && 'sm:border-r',
    )}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', col.bubble)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-[2.25rem] font-extrabold tabular-nums leading-none tracking-tight',
          isAlert ? col.num : 'text-foreground',
        )}>
          {item.value}
        </p>
        <p className="text-[12px] text-muted-foreground mt-1 leading-tight truncate">{item.label}</p>
        {item.delta && (
          <p className={cn('text-[11px] mt-0.5 leading-none', {
            'text-green-500':            item.deltaType === 'positive',
            'text-red-500':              item.deltaType === 'negative',
            'text-muted-foreground/60':  !item.deltaType || item.deltaType === 'neutral',
          })}>
            {item.delta}
          </p>
        )}
      </div>
    </div>
  )
}
