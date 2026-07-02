'use client'

import { NotifBell } from './NotifDropdown'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="shrink-0 flex items-end justify-between px-10 pt-8 pb-6">
      <div>
        <h1 className="text-2xl font-700 tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <NotifBell />
      </div>
    </header>
  )
}
