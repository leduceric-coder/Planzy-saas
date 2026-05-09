import { Building2, Clock, AlertTriangle, Flag, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const icons = {
  building: Building2,
  clock: Clock,
  alert: AlertTriangle,
  flag: Flag,
}

const colors = {
  blue:   { bg: 'bg-primary', text: 'text-white' },
  orange: { bg: 'bg-yellow-500', text: 'text-white' },
  green:  { bg: 'bg-green-500', text: 'text-white' },
  red:    { bg: 'bg-destructive', text: 'text-white' },
}

interface KpiCardProps {
  label: string
  value: number | string
  icon: keyof typeof icons
  color: keyof typeof colors
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
}

export function KpiCard({ label, value, icon, color, delta, deltaType = 'neutral' }: KpiCardProps) {
  const Icon = icons[icon]
  const col = colors[color]

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center shrink-0', col.bg)}>
          <Icon className={cn('h-5 w-5', col.text)} />
        </div>
        {delta && (
          <div className={cn('flex items-center gap-1 text-xs font-600', {
            'text-green-500': deltaType === 'positive',
            'text-destructive': deltaType === 'negative',
            'text-muted-foreground': deltaType === 'neutral',
          })}>
            {deltaType === 'positive' && <TrendingUp className="h-3 w-3" />}
            {deltaType === 'negative' && <TrendingDown className="h-3 w-3" />}
            {deltaType === 'neutral' && <Minus className="h-3 w-3" />}
            {delta}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-3xl font-700 text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  )
}
