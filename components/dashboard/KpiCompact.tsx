import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface KpiChipData {
  icon: LucideIcon
  value: number
  label: string
  scheme: 'blue' | 'orange' | 'red' | 'green'
}

const SCHEMES = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/60',   iconCls: 'text-blue-600 dark:text-blue-400',   numCls: 'text-blue-700 dark:text-blue-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/60', iconCls: 'text-orange-600 dark:text-orange-400', numCls: 'text-orange-700 dark:text-orange-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-950/60',     iconCls: 'text-red-600 dark:text-red-400',     numCls: 'text-red-700 dark:text-red-300' },
  green:  { bg: 'bg-green-50 dark:bg-green-950/60', iconCls: 'text-green-600 dark:text-green-400', numCls: 'text-green-700 dark:text-green-300' },
}

export function KpiChip({ icon: Icon, value, label, scheme }: KpiChipData) {
  const s = SCHEMES[scheme]
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border border-border/50 dark:border-white/[0.08] rounded-2xl shadow-sm dark:shadow-black/30">
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
        <Icon className={cn('h-4 w-4', s.iconCls)} />
      </div>
      <div>
        <p className={cn('text-[1.25rem] font-extrabold leading-none tabular-nums', s.numCls)}>{value}</p>
        <p className="text-[11px] text-muted-foreground/65 leading-tight mt-0.5 whitespace-nowrap">{label}</p>
      </div>
    </div>
  )
}
