'use client'

import { Bell, Search } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  notificationCount?: number
}

export function Header({ title, subtitle, actions, notificationCount = 0 }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="shrink-0 flex items-end justify-between px-10 pt-8 pb-6">
      <div>
        <h1 className="text-2xl font-700 tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Search */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors border border-transparent hover:border-border"
          aria-label="Rechercher"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors border border-transparent hover:border-border"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </button>
      </div>
    </header>
  )
}
