// ── Feux France — normalisation FIRMS → FireDetection ────────────────────────

import type { ConfidenceLevel, DayNight, FireDetection, AgeBucket } from './types'
import type { FirmsRow } from './schema'
import { SOURCE_SATELLITE, type FirmsSource } from './constants'

/**
 * Combine `acq_date` (AAAA-MM-JJ) et `acq_time` (HHMM, UTC) en instant ISO UTC.
 * FIRMS fournit toujours l'heure en UTC. Retourne null si la date est invalide.
 */
export function parseAcqDateTime(acqDate: string, acqTime: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(acqDate.trim())
  if (!m) return null
  // acq_time peut valoir « 5 », « 42 », « 342 », « 1342 » → HHMM sur 4 chiffres.
  const t = acqTime.trim().replace(/\D/g, '').padStart(4, '0').slice(-4)
  const hh = Number(t.slice(0, 2))
  const mm = Number(t.slice(2, 4))
  if (hh > 23 || mm > 59) return null
  const [, y, mo, d] = m
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), hh, mm, 0, 0)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

/**
 * Classe la confiance en tenant compte des formats différents :
 * - VIIRS : catégoriel « l » / « n » / « h ».
 * - MODIS : numérique 0-100 (< 30 low, 30-79 nominal, ≥ 80 high).
 */
export function classifyConfidence(confidence: string | number | null): ConfidenceLevel {
  if (confidence == null || confidence === '') return 'unknown'

  if (typeof confidence === 'number') return classifyNumericConfidence(confidence)

  const s = confidence.trim().toLowerCase()
  if (s === 'l' || s === 'low') return 'low'
  if (s === 'n' || s === 'nominal') return 'nominal'
  if (s === 'h' || s === 'high') return 'high'

  // MODIS peut arriver en chaîne numérique.
  const n = Number(s)
  if (Number.isFinite(n)) return classifyNumericConfidence(n)

  return 'unknown'
}

function classifyNumericConfidence(n: number): ConfidenceLevel {
  if (n < 30) return 'low'
  if (n < 80) return 'nominal'
  return 'high'
}

/** Confiance brute typée : nombre si MODIS numérique, sinon chaîne. */
function rawConfidence(raw: string): string | number | null {
  if (raw == null || raw.trim() === '') return null
  const s = raw.trim()
  const n = Number(s)
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s) ? n : s
}

/** Jour / nuit à partir du champ FIRMS « daynight » (D / N). */
export function classifyDayNight(raw: string): DayNight {
  const s = (raw ?? '').trim().toUpperCase()
  if (s === 'D' || s === 'DAY') return 'day'
  if (s === 'N' || s === 'NIGHT') return 'night'
  return 'unknown'
}

/** Ancienneté en minutes entre `detectedAt` et `now`. */
export function ageMinutes(detectedAtIso: string, now: number = Date.now()): number {
  const t = new Date(detectedAtIso).getTime()
  if (Number.isNaN(t)) return Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.round((now - t) / 60000))
}

/** Tranche d'ancienneté pour la coloration des marqueurs. */
export function ageBucket(minutes: number): AgeBucket {
  if (minutes < 180) return 'lt3h'
  if (minutes < 720) return '3to12h'
  if (minutes < 1440) return '12to24h'
  return 'gt24h'
}

/**
 * Identifiant stable dérivé des coordonnées (4 décimales ≈ 11 m), de la
 * date/heure et du satellite. Deux appels successifs renvoyant la même
 * observation produisent le même id → dédup fiable, sans fusionner des
 * observations satellites différentes (satellite inclus dans la clé).
 */
export function stableId(
  lat: number,
  lon: number,
  detectedAtIso: string,
  satellite: string
): string {
  const la = lat.toFixed(4)
  const lo = lon.toFixed(4)
  const sat = (satellite || 'unknown').replace(/\s+/g, '').toLowerCase()
  return `${la}_${lo}_${detectedAtIso}_${sat}`
}

/**
 * Normalise une ligne FIRMS validée en `FireDetection`.
 * `source` = source FIRMS interrogée (fiabilise le libellé satellite).
 * Retourne null si la date de détection est inexploitable.
 */
export function normalizeRow(
  row: FirmsRow,
  source: FirmsSource,
  now: number = Date.now()
): FireDetection | null {
  const detectedAt = parseAcqDateTime(row.acq_date, row.acq_time ?? '0000')
  if (!detectedAt) return null

  const instrument = (row.instrument || (source.startsWith('MODIS') ? 'MODIS' : 'VIIRS')).trim()
  const satellite = resolveSatellite(row.satellite, source)
  const confidence = rawConfidence(row.confidence ?? '')
  const mins = ageMinutes(detectedAt, now)

  // VIIRS : bright_ti4 / bright_ti5 — MODIS : brightness / bright_t31.
  const brightness = row.bright_ti4 ?? row.brightness ?? null
  const brightT31 = row.bright_ti5 ?? row.bright_t31 ?? null

  return {
    id: stableId(row.latitude, row.longitude, detectedAt, satellite),
    latitude: row.latitude,
    longitude: row.longitude,
    detectedAt,
    ageMinutes: mins,
    satellite,
    instrument,
    confidence,
    confidenceLevel: classifyConfidence(confidence),
    brightness,
    brightT31,
    frp: row.frp ?? null,
    scan: row.scan ?? null,
    track: row.track ?? null,
    dayNight: classifyDayNight(row.daynight ?? ''),
    source,
  }
}

/** Libellé satellite : privilégie la source interrogée, corrige les codes bruts. */
function resolveSatellite(rawSat: string, source: FirmsSource): string {
  const s = (rawSat ?? '').trim()
  if (!s) return SOURCE_SATELLITE[source]
  const up = s.toUpperCase()
  // Codes FIRMS courants → libellés lisibles.
  if (up === 'N' || up === 'NPP' || up.includes('SUOMI')) return 'Suomi NPP'
  if (up === '1' || up === 'N20' || up.includes('NOAA-20') || up.includes('NOAA20')) return 'NOAA-20'
  if (up === '2' || up === 'N21' || up.includes('NOAA-21') || up.includes('NOAA21')) return 'NOAA-21'
  if (up === 'T' || up.includes('TERRA')) return 'Terra'
  if (up === 'A' || up.includes('AQUA')) return 'Aqua'
  return s
}

/**
 * Déduplique des détections issues d'appels successifs / sources multiples.
 * Clé = id stable. En cas de doublon, on garde la détection la plus « riche »
 * (FRP renseigné prioritaire), sans fusionner des satellites différents.
 */
export function dedupe(detections: FireDetection[]): FireDetection[] {
  const byId = new Map<string, FireDetection>()
  for (const d of detections) {
    const existing = byId.get(d.id)
    if (!existing) {
      byId.set(d.id, d)
      continue
    }
    // Garder la plus informative (FRP non nul l'emporte).
    if (existing.frp == null && d.frp != null) byId.set(d.id, d)
  }
  return [...byId.values()]
}

/**
 * Chaîne complète : lignes validées → détections normalisées, triées de la
 * plus récente à la plus ancienne, dédupliquées.
 */
export function normalizeAndDedupe(
  rows: FirmsRow[],
  source: FirmsSource,
  now: number = Date.now()
): FireDetection[] {
  const normalized: FireDetection[] = []
  for (const row of rows) {
    const d = normalizeRow(row, source, now)
    if (d) normalized.push(d)
  }
  return dedupe(normalized).sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  )
}
