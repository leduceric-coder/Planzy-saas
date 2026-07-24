// ── Feux France — mode démonstration ─────────────────────────────────────────
// Données FICTIVES clairement identifiées, utilisées quand FIRMS_MAP_KEY est
// absente. Ne JAMAIS présenter ces points comme des détections réelles :
// la réponse API porte `demo: true` et l'UI affiche « Mode démonstration ».

import type { FireDetection } from './types'
import { ageBucket, classifyConfidence, stableId } from './normalize'

/** Emplacements réalistes (régions à risque feu), coordonnées approximatives. */
const DEMO_SPOTS: Array<{
  lat: number
  lon: number
  place: string
  ageMin: number
  source: string
  satellite: string
  instrument: string
  confidence: string | number
  frp: number | null
  bt: number | null
  bt2: number | null
  dayNight: 'day' | 'night'
}> = [
  { lat: 43.281, lon: 6.641, place: 'Var — massif des Maures', ageMin: 45, source: 'VIIRS_SNPP_NRT', satellite: 'Suomi NPP', instrument: 'VIIRS', confidence: 'h', frp: 32.4, bt: 348.1, bt2: 297.2, dayNight: 'day' },
  { lat: 42.198, lon: 9.121, place: 'Haute-Corse — Balagne', ageMin: 95, source: 'VIIRS_NOAA20_NRT', satellite: 'NOAA-20', instrument: 'VIIRS', confidence: 'n', frp: 14.7, bt: 331.5, bt2: 291.0, dayNight: 'day' },
  { lat: 44.014, lon: 4.412, place: 'Gard — garrigue', ageMin: 210, source: 'VIIRS_NOAA21_NRT', satellite: 'NOAA-21', instrument: 'VIIRS', confidence: 'h', frp: 51.9, bt: 355.3, bt2: 300.4, dayNight: 'day' },
  { lat: 43.61, lon: 3.877, place: 'Hérault — Montpellier N', ageMin: 320, source: 'VIIRS_SNPP_NRT', satellite: 'Suomi NPP', instrument: 'VIIRS', confidence: 'n', frp: 9.2, bt: 322.8, bt2: 288.1, dayNight: 'day' },
  { lat: 41.99, lon: 8.74, place: 'Corse-du-Sud — Ajaccio', ageMin: 540, source: 'MODIS_NRT', satellite: 'Aqua', instrument: 'MODIS', confidence: 78, frp: 22.1, bt: 329.0, bt2: 290.6, dayNight: 'night' },
  { lat: 44.837, lon: 5.71, place: 'Drôme — Vercors', ageMin: 700, source: 'VIIRS_NOAA20_NRT', satellite: 'NOAA-20', instrument: 'VIIRS', confidence: 'l', frp: 4.1, bt: 310.4, bt2: 285.9, dayNight: 'night' },
  { lat: 43.95, lon: 6.09, place: 'Alpes-de-Hte-Provence', ageMin: 900, source: 'MODIS_NRT', satellite: 'Terra', instrument: 'MODIS', confidence: 45, frp: 11.3, bt: 318.7, bt2: 287.4, dayNight: 'night' },
  { lat: 42.69, lon: 2.9, place: 'Pyrénées-Orientales', ageMin: 1300, source: 'VIIRS_SNPP_NRT', satellite: 'Suomi NPP', instrument: 'VIIRS', confidence: 'n', frp: 7.8, bt: 316.2, bt2: 286.0, dayNight: 'night' },
  { lat: 44.56, lon: 4.75, place: 'Ardèche — sud', ageMin: 1600, source: 'VIIRS_NOAA20_NRT', satellite: 'NOAA-20', instrument: 'VIIRS', confidence: 'h', frp: 18.9, bt: 338.9, bt2: 293.3, dayNight: 'day' },
  { lat: 43.12, lon: 5.93, place: 'Var — Toulon E', ageMin: 2100, source: 'MODIS_NRT', satellite: 'Aqua', instrument: 'MODIS', confidence: 62, frp: 15.5, bt: 325.1, bt2: 289.9, dayNight: 'day' },
]

/**
 * Génère les détections de démonstration, ancrées sur `now` pour que les
 * anciennetés et couleurs restent cohérentes au fil du temps.
 */
export function demoDetections(now: number = Date.now()): FireDetection[] {
  return DEMO_SPOTS.map((s) => {
    const detectedAt = new Date(now - s.ageMin * 60_000).toISOString()
    return {
      id: stableId(s.lat, s.lon, detectedAt, s.satellite),
      latitude: s.lat,
      longitude: s.lon,
      detectedAt,
      ageMinutes: s.ageMin,
      satellite: s.satellite,
      instrument: s.instrument,
      confidence: s.confidence,
      confidenceLevel: classifyConfidence(s.confidence),
      brightness: s.bt,
      brightT31: s.bt2,
      frp: s.frp,
      scan: 0.39,
      track: 0.36,
      dayNight: s.dayNight,
      source: s.source,
    } satisfies FireDetection
  }).sort((a, b) => a.ageMinutes - b.ageMinutes)
}

/** Filtre les données démo par période (heures) pour respecter le filtre UI. */
export function demoDetectionsForPeriod(hours: number, now: number = Date.now()): FireDetection[] {
  const maxAge = hours * 60
  return demoDetections(now).filter((d) => d.ageMinutes <= maxAge)
}

// Ré-export utilitaire (évite un import direct de normalize côté route).
export { ageBucket }
