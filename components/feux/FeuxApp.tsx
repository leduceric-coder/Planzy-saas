'use client'

// ── Feux France — orchestrateur principal (état, layout, responsive) ─────────

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { X, AlertCircle, RefreshCw } from 'lucide-react'
import type { FireDetection } from '@/lib/firms/types'
import { FIRMS_SOURCES } from '@/lib/firms/constants'
import { useFirmsData, filterByConfidence } from './useFirmsData'
import { useTheme } from './useTheme'
import { useReducedMotion } from './useReducedMotion'
import TopBar from './TopBar'
import FilterPanel, { type UiFilters } from './FilterPanel'
import DetailSheet from './DetailSheet'
import SearchBar, { zoomFor } from './SearchBar'
import Legend from './Legend'
import Disclaimer from './Disclaimer'
import type { FlyTarget } from './MapView'
import type { GeocodeResult } from '@/app/api/geocode/route'

// MapLibre uniquement côté client (chargement différé).
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        Chargement de la carte…
      </div>
    </div>
  ),
})

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Feux France'

export default function FeuxApp() {
  const { theme, toggle } = useTheme()
  const reducedMotion = useReducedMotion()

  const [filters, setFilters] = useState<UiFilters>({
    periodHours: 24,
    confidence: 'all',
    sensors: [...FIRMS_SOURCES],
    display: 'markers',
    baseLayer: 'osm',
    showDepartments: false,
  })
  const [selected, setSelected] = useState<FireDetection | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [locateNonce, setLocateNonce] = useState(0)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const data = useFirmsData({
    periodHours: filters.periodHours,
    confidence: filters.confidence,
    sensors: filters.sensors,
  })

  // Filtre confiance appliqué côté client (période & capteurs côté serveur).
  const visible = useMemo(
    () => filterByConfidence(data.detections, filters.confidence),
    [data.detections, filters.confidence]
  )

  const patch = useCallback((p: Partial<UiFilters>) => setFilters((f) => ({ ...f, ...p })), [])

  const onSearchSelect = useCallback((r: GeocodeResult) => {
    setFlyTo({
      longitude: r.longitude,
      latitude: r.latitude,
      zoom: zoomFor(r.type),
      nonce: Date.now(),
    })
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <TopBar
        appName={APP_NAME}
        count={visible.length}
        fetchedAt={data.fetchedAt}
        loading={data.loading}
        demo={data.demo}
        stale={data.stale}
        theme={theme}
        onRefresh={data.refresh}
        onToggleTheme={toggle}
        onLocate={() => setLocateNonce((n) => n + 1)}
        onToggleFilters={() => setMobileFiltersOpen((o) => !o)}
      />

      <div className="relative flex-1 overflow-hidden">
        <MapView
          detections={visible}
          displayMode={filters.display}
          baseLayer={filters.baseLayer}
          showDepartments={filters.showDepartments}
          reducedMotion={reducedMotion}
          flyTo={flyTo}
          locateNonce={locateNonce}
          onSelect={setSelected}
        />

        {/* Recherche — en haut, au-dessus de la carte et des bandeaux.
            pr-16 sur mobile : laisse le coin haut-droit libre pour les contrôles
            de zoom MapLibre. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 pr-16 sm:pr-3">
          <div className="pointer-events-auto mx-auto max-w-md">
            <SearchBar onSelect={onSearchSelect} />
          </div>
        </div>

        {/* Bandeaux d'état (démo / cache / erreur) */}
        {(data.demo || data.stale || data.error || data.notice) && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex flex-col items-center gap-2 px-3">
            {data.error && (
              <Notice tone="error">
                {data.error}{' '}
                <button onClick={data.refresh} className="underline underline-offset-2">
                  Réessayer
                </button>
              </Notice>
            )}
            {data.notice && !data.error && <Notice tone="warn">{data.notice}</Notice>}
          </div>
        )}

        {/* Panneau de filtres — desktop (colonne gauche flottante) */}
        <div className="pointer-events-none absolute left-3 top-16 z-10 hidden w-72 lg:block">
          <div className="pointer-events-auto max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-border bg-surface/95 p-4 shadow-lg backdrop-blur">
            <FilterPanel value={filters} onChange={patch} />
          </div>
        </div>

        {/* Légende — bas gauche (desktop) */}
        <div className="pointer-events-none absolute bottom-6 left-3 z-10 hidden sm:block">
          <Legend />
        </div>

        {/* Avertissement — bas centre */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3">
          <Disclaimer />
        </div>

        {/* Fiche de détection (key = remonte l'état interne à chaque sélection) */}
        <DetailSheet key={selected?.id ?? 'none'} detection={selected} onClose={() => setSelected(null)} />

        {/* Panneau de filtres — mobile (bottom sheet) */}
        {mobileFiltersOpen && (
          <div className="absolute inset-0 z-40 lg:hidden" role="dialog" aria-label="Filtres">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileFiltersOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-auto rounded-t-2xl border border-border bg-surface p-4 pb-safe shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Filtres</p>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated"
                  aria-label="Fermer les filtres"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FilterPanel value={filters} onChange={patch} />
              <div className="mt-4">
                <Legend />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-destructive/40 text-destructive'
      : 'border-warning/40 text-foreground'
  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border ${cls} bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
