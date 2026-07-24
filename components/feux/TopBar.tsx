'use client'

// ── Feux France — barre supérieure ───────────────────────────────────────────

import { Flame, RefreshCw, Sun, Moon, LocateFixed, SlidersHorizontal } from 'lucide-react'
import { formatParisTime } from '@/lib/firms/format'
import type { Theme } from './useTheme'

type Props = {
  appName: string
  count: number
  fetchedAt: string | null
  loading: boolean
  demo: boolean
  stale: boolean
  theme: Theme
  onRefresh: () => void
  onToggleTheme: () => void
  onLocate: () => void
  onToggleFilters: () => void
}

export default function TopBar({
  appName,
  count,
  fetchedAt,
  loading,
  demo,
  stale,
  theme,
  onRefresh,
  onToggleTheme,
  onLocate,
  onToggleFilters,
}: Props) {
  return (
    <header className="pointer-events-auto flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-2 backdrop-blur pt-safe sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
          <Flame className="h-5 w-5 text-destructive" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight text-foreground sm:text-base">
            {appName}
          </h1>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> Mise à jour en cours…
              </span>
            ) : fetchedAt ? (
              <>
                <span className="font-medium text-foreground">{count}</span> détection
                {count > 1 ? 's' : ''} · maj {formatParisTime(fetchedAt)}
              </>
            ) : (
              'Chargement…'
            )}
          </p>
        </div>
      </div>

      {demo && (
        <span className="ml-1 hidden shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning sm:inline-block">
          Mode démo
        </span>
      )}
      {stale && !demo && (
        <span className="ml-1 hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline-block">
          Cache
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground disabled:opacity-50"
          aria-label="Actualiser les données"
          title="Actualiser"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onLocate}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label="Me localiser"
          title="Me localiser"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
          title="Thème clair / sombre"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onToggleFilters}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-muted-foreground hover:bg-elevated hover:text-foreground lg:hidden"
          aria-label="Ouvrir les filtres"
          title="Filtres"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  )
}
