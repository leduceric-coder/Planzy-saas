'use client'

import { NotifBell } from './NotifDropdown'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="shrink-0 flex items-end justify-between gap-4 px-4 sm:px-6 lg:px-10 pt-6 pb-5 border-b border-border/20 dark:border-white/[0.05]">
      <div className="min-w-0">
        <h1 className="text-2xl font-800 tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}
        <NotifBell />
      </div>
    </header>
  )
}
