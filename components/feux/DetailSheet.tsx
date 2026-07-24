'use client'

// ── Feux France — fiche de détection (bottom sheet / carte flottante) ────────

import { useEffect, useState } from 'react'
import {
  X,
  MapPin,
  Satellite,
  Flame,
  Thermometer,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Sun,
  Moon,
} from 'lucide-react'
import type { FireDetection } from '@/lib/firms/types'
import {
  formatParisDate,
  formatParisTime,
  formatAge,
  confidenceLabel,
  dayNightLabel,
  colorForAge,
} from '@/lib/firms/format'
import { SOURCE_LABELS, type FirmsSource } from '@/lib/firms/constants'

type Props = {
  detection: FireDetection | null
  onClose: () => void
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as FirmsSource] ?? source
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export default function DetailSheet({ detection, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!detection) return null
  const d = detection
  const coords = `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}`
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coords)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Détail de la détection satellite"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 mx-auto w-full animate-slide-in-right rounded-t-2xl border border-border bg-surface p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-2xl pb-safe"
      data-testid="detail-sheet"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: `${colorForAge(d.ageMinutes)}22` }}
          >
            <Flame className="h-5 w-5" style={{ color: colorForAge(d.ageMinutes) }} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Détection satellite</p>
            <p className="text-xs text-muted-foreground">{formatAge(d.ageMinutes)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label="Fermer la fiche"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-border">
        <Row
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Date (heure de Paris)"
          value={`${formatParisDate(d.detectedAt)}`}
        />
        <Row icon={<Clock className="h-3.5 w-3.5" />} label="Heure locale" value={formatParisTime(d.detectedAt)} />
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Latitude" value={d.latitude.toFixed(5)} />
        <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Longitude" value={d.longitude.toFixed(5)} />
        <Row
          icon={<Satellite className="h-3.5 w-3.5" />}
          label="Satellite / capteur"
          value={`${d.satellite} · ${d.instrument}`}
        />
        <Row
          icon={<Satellite className="h-3.5 w-3.5" />}
          label="Source"
          value={sourceLabel(d.source)}
        />
        <Row
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Confiance"
          value={
            <span>
              {confidenceLabel(d.confidenceLevel)}
              {d.confidence != null && (
                <span className="ml-1 text-xs text-muted-foreground">({String(d.confidence)})</span>
              )}
            </span>
          }
        />
        {d.frp != null && (
          <Row
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Puissance radiative (FRP)"
            value={`${d.frp.toFixed(1)} MW`}
          />
        )}
        {d.brightness != null && (
          <Row
            icon={<Thermometer className="h-3.5 w-3.5" />}
            label="Température de brillance"
            value={`${d.brightness.toFixed(1)} K`}
          />
        )}
        <Row
          icon={d.dayNight === 'night' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          label="Détection"
          value={dayNightLabel(d.dayNight)}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={gmaps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated text-sm font-medium text-foreground hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Google Maps
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated text-sm font-medium text-foreground hover:bg-muted"
          aria-label="Copier les coordonnées"
        >
          {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        Une détection satellite n&apos;est pas une confirmation officielle d&apos;incendie.
      </p>
    </div>
  )
}
