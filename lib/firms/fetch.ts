// ── Feux France — récupération serveur FIRMS + cache ─────────────────────────
// Appelle NASA FIRMS (area API) pour chaque source, normalise, déduplique.
// Cache mémoire process (5-10 min) pour ménager le quota et rester fluide.
// La clé FIRMS_MAP_KEY reste STRICTEMENT côté serveur.

import {
  FIRMS_AREA_BASE,
  FIRMS_TIMEOUT_MS,
  CACHE_TTL_MS,
  type FirmsSource,
} from './constants'
import { parseCsv } from './csv'
import { validateRows } from './schema'
import { normalizeAndDedupe, dedupe } from './normalize'
import type { FireDetection } from './types'

export type FetchParams = {
  sources: FirmsSource[]
  bbox: { west: number; south: number; east: number; north: number }
  /** Nombre de jours FIRMS (1-10) couvrant la période demandée. */
  dayRange: number
  /** Fenêtre en minutes pour re-filtrer finement après réception. */
  windowMinutes: number
}

export type FetchResult = {
  detections: FireDetection[]
  fetchedAt: string
  /** true si au moins une source a échoué mais qu'on a des données. */
  partial: boolean
  /** Sources ayant échoué. */
  failedSources: string[]
}

/** Construit l'URL FIRMS area/csv pour une source donnée. */
export function buildFirmsUrl(
  mapKey: string,
  source: FirmsSource,
  bbox: FetchParams['bbox'],
  dayRange: number
): string {
  const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
  const day = Math.min(10, Math.max(1, Math.round(dayRange)))
  return `${FIRMS_AREA_BASE}/${mapKey}/${source}/${area}/${day}`
}

/** Fetch d'une source avec timeout. Lève en cas d'échec réseau / HTTP. */
async function fetchSource(
  mapKey: string,
  source: FirmsSource,
  params: FetchParams,
  now: number
): Promise<FireDetection[]> {
  const url = buildFirmsUrl(mapKey, source, params.bbox, params.dayRange)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIRMS_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/csv' },
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`FIRMS ${source} HTTP ${res.status}`)
    }
    const text = await res.text()
    const rows = parseCsv(text)
    const { valid } = validateRows(rows)
    return normalizeAndDedupe(valid, source, now)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Récupère les détections pour toutes les sources demandées.
 * Les sources sont interrogées en parallèle ; un échec partiel n'annule pas le
 * reste. Filtre final sur la fenêtre temporelle (windowMinutes).
 */
export async function fetchDetections(
  mapKey: string,
  params: FetchParams,
  now: number = Date.now()
): Promise<FetchResult> {
  const results = await Promise.allSettled(
    params.sources.map((s) => fetchSource(mapKey, s, params, now))
  )

  const all: FireDetection[] = []
  const failedSources: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') all.push(...r.value)
    else failedSources.push(params.sources[i])
  })

  // Toutes les sources ont échoué → propager l'erreur pour bascule cache.
  if (failedSources.length === params.sources.length) {
    throw new Error(`FIRMS: toutes les sources ont échoué (${failedSources.join(', ')})`)
  }

  const windowMs = params.windowMinutes * 60_000
  const filtered = dedupe(all)
    .filter((d) => now - new Date(d.detectedAt).getTime() <= windowMs)
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())

  return {
    detections: filtered,
    fetchedAt: new Date(now).toISOString(),
    partial: failedSources.length > 0,
    failedSources,
  }
}

// ── Cache mémoire (par clé de requête) ───────────────────────────────────────

type CacheEntry = { at: number; result: FetchResult }
const cache = new Map<string, CacheEntry>()

/** Clé de cache = sources + bbox arrondie + dayRange + fenêtre. */
export function cacheKey(params: FetchParams): string {
  const b = params.bbox
  const round = (n: number) => n.toFixed(2)
  return [
    params.sources.slice().sort().join(','),
    round(b.west),
    round(b.south),
    round(b.east),
    round(b.north),
    params.dayRange,
    params.windowMinutes,
  ].join('|')
}

export function getCached(key: string, now: number = Date.now()): CacheEntry | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (now - entry.at > CACHE_TTL_MS) return { ...entry, at: entry.at } // périmé mais conservé (fallback)
  return entry
}

export function isFresh(entry: CacheEntry | null, now: number = Date.now()): boolean {
  return !!entry && now - entry.at <= CACHE_TTL_MS
}

export function setCached(key: string, result: FetchResult, now: number = Date.now()): void {
  cache.set(key, { at: now, result })
}

/** Vide le cache (tests). */
export function clearCache(): void {
  cache.clear()
}
