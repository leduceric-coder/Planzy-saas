'use client'

// ── Feux France — hook de récupération des détections ────────────────────────
// Interroge /api/firms selon les filtres, actualise automatiquement toutes les
// 10 min, expose l'état (chargement, données périmées, erreur) sans recharger
// la page. Ne vide jamais brutalement la carte en cas d'échec.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FireDetection, FirmsResponse } from '@/lib/firms/types'
import { AUTO_REFRESH_MS, type FirmsSource } from '@/lib/firms/constants'

export type FeuxFilters = {
  periodHours: number
  confidence: 'all' | 'nominal' | 'high'
  sensors: FirmsSource[] // sous-ensemble (vide = toutes)
}

export type FirmsState = {
  detections: FireDetection[]
  fetchedAt: string | null
  latestDetectionAt: string | null
  demo: boolean
  stale: boolean
  notice: string | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function buildUrl(filters: FeuxFilters): string {
  const p = new URLSearchParams()
  p.set('period', String(filters.periodHours))
  if (filters.sensors.length) p.set('sources', filters.sensors.join(','))
  return `/api/firms?${p.toString()}`
}

export function useFirmsData(filters: FeuxFilters): FirmsState {
  const [detections, setDetections] = useState<FireDetection[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [latestDetectionAt, setLatestDetectionAt] = useState<string | null>(null)
  const [demo, setDemo] = useState(false)
  const [stale, setStale] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildUrl(filtersRef.current), {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as FirmsResponse
      setDetections(data.detections)
      setFetchedAt(data.fetchedAt)
      setLatestDetectionAt(data.latestDetectionAt)
      setDemo(data.demo)
      setStale(data.stale)
      setNotice(data.notice)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // On conserve les données déjà affichées (pas de reset).
      setError('Impossible de récupérer les données pour le moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Rechargement au changement de période / capteurs.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.periodHours, filters.sensors.join(',')])

  // Actualisation automatique toutes les 10 minutes.
  useEffect(() => {
    const id = setInterval(() => load(), AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    detections,
    fetchedAt,
    latestDetectionAt,
    demo,
    stale,
    notice,
    loading,
    error,
    refresh: load,
  }
}

/** Filtre client par niveau de confiance (nominal = nominal+high). */
export function filterByConfidence(
  detections: FireDetection[],
  confidence: FeuxFilters['confidence']
): FireDetection[] {
  if (confidence === 'all') return detections
  if (confidence === 'high') return detections.filter((d) => d.confidenceLevel === 'high')
  return detections.filter(
    (d) => d.confidenceLevel === 'high' || d.confidenceLevel === 'nominal'
  )
}
