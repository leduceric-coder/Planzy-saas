'use client'

// ── Feux France — panneau de filtres repliable ───────────────────────────────

import { Layers, Map as MapIcon, Radar, Flame } from 'lucide-react'
import { FIRMS_SOURCES, SOURCE_LABELS, type FirmsSource } from '@/lib/firms/constants'
import type { DisplayMode } from './MapView'
import type { BaseLayer } from './mapStyle'

export type UiFilters = {
  periodHours: number
  confidence: 'all' | 'nominal' | 'high'
  sensors: FirmsSource[]
  display: DisplayMode
  baseLayer: BaseLayer
  showDepartments: boolean
}

type Props = {
  value: UiFilters
  onChange: (patch: Partial<UiFilters>) => void
}

const PERIODS: { h: number; label: string }[] = [
  { h: 3, label: '3 h' },
  { h: 6, label: '6 h' },
  { h: 12, label: '12 h' },
  { h: 24, label: '24 h' },
  { h: 48, label: '48 h' },
  { h: 168, label: '7 j' },
]

const CONFIDENCES: { v: UiFilters['confidence']; label: string }[] = [
  { v: 'all', label: 'Toutes' },
  { v: 'nominal', label: 'Nominale +' },
  { v: 'high', label: 'Élevée' },
]

const DISPLAYS: { v: DisplayMode; label: string; icon: React.ReactNode }[] = [
  { v: 'markers', label: 'Marqueurs', icon: <Flame className="h-3.5 w-3.5" /> },
  { v: 'clusters', label: 'Clusters', icon: <Layers className="h-3.5 w-3.5" /> },
  { v: 'heatmap', label: 'Chaleur', icon: <Radar className="h-3.5 w-3.5" /> },
]

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { v: T; label: string; icon?: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-border bg-background p-1"
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === o.v
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

export default function FilterPanel({ value, onChange }: Props) {
  const toggleSensor = (s: FirmsSource) => {
    const has = value.sensors.includes(s)
    let next = has ? value.sensors.filter((x) => x !== s) : [...value.sensors, s]
    if (next.length === 0) next = [...FIRMS_SOURCES] // jamais vide
    onChange({ sensors: next })
  }

  return (
    <div className="space-y-4" data-testid="filter-panel">
      <Field label="Période">
        <Segmented
          ariaLabel="Période de détection"
          options={PERIODS.map((p) => ({ v: p.h, label: p.label }))}
          value={value.periodHours}
          onChange={(h) => onChange({ periodHours: h })}
        />
      </Field>

      <Field label="Confiance">
        <Segmented
          ariaLabel="Niveau de confiance"
          options={CONFIDENCES}
          value={value.confidence}
          onChange={(v) => onChange({ confidence: v })}
        />
      </Field>

      <Field label="Capteur">
        <div className="space-y-1">
          {FIRMS_SOURCES.map((s) => {
            const checked = value.sensors.includes(s)
            return (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-elevated"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSensor(s)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-foreground">{SOURCE_LABELS[s]}</span>
              </label>
            )
          })}
        </div>
      </Field>

      <Field label="Affichage">
        <Segmented
          ariaLabel="Mode d'affichage"
          options={DISPLAYS}
          value={value.display}
          onChange={(v) => onChange({ display: v })}
        />
      </Field>

      <Field label="Fond de carte">
        <Segmented
          ariaLabel="Fond de carte"
          options={[
            { v: 'osm' as BaseLayer, label: 'Plan', icon: <MapIcon className="h-3.5 w-3.5" /> },
            { v: 'satellite' as BaseLayer, label: 'Satellite', icon: <Layers className="h-3.5 w-3.5" /> },
          ]}
          value={value.baseLayer}
          onChange={(v) => onChange({ baseLayer: v })}
        />
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-sm">
        <span className="text-foreground">Limites départementales</span>
        <input
          type="checkbox"
          checked={value.showDepartments}
          onChange={(e) => onChange({ showDepartments: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
      </label>
    </div>
  )
}
