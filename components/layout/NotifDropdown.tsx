'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Clock, AlertOctagon, AlertTriangle, MessageSquare, Calendar } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAlerts } from './AlertsContext'
import type { AlertType } from '@/lib/alerts'

const TYPE_ICON: Record<AlertType, React.ElementType> = {
  late: Clock,
  blocked: AlertOctagon,
  issue: AlertTriangle,
  message: MessageSquare,
  deadline: Calendar,
}

const TYPE_COLOR: Record<AlertType, string> = {
  late: 'text-destructive',
  blocked: 'text-orange-500',
  issue: 'text-yellow-500',
  message: 'text-primary',
  deadline: 'text-blue-500',
}

export function NotifBell() {
  const alerts = useAlerts()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors border border-transparent hover:border-border"
        aria-label="Alertes"
      >
        <Bell className="h-4 w-4" />
        {alerts.total > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-700 text-sm text-foreground">Notifications</span>
            {alerts.total > 0 && (
              <span className="text-xs text-muted-foreground">
                {alerts.total} notification{alerts.total > 1 ? 's' : ''} non traitée{alerts.total > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alerts.items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Aucune alerte active</p>
              </div>
            ) : (
              alerts.items.map(item => {
                const Icon = TYPE_ICON[item.type]
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors border-b border-border/50 last:border-0"
                  >
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', TYPE_COLOR[item.type])} />
                    <div className="min-w-0">
                      <p className="text-xs font-600 text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.body}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {alerts.total > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <Link
                href="/planning"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline font-500"
              >
                Voir le planning →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
