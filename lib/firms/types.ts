// ── Feux France — types internes normalisés ──────────────────────────────────
// Type commun à toutes les sources FIRMS (VIIRS SNPP/NOAA-20/NOAA-21, MODIS).
// Aucune donnée brute FIRMS ne doit fuir vers le frontend : tout passe par
// `FireDetection`.

/** Niveau de confiance normalisé, indépendant du format source. */
export type ConfidenceLevel = 'low' | 'nominal' | 'high' | 'unknown'

/** Moment de la détection (jour / nuit). */
export type DayNight = 'day' | 'night' | 'unknown'

/**
 * Détection satellite normalisée.
 *
 * ⚠️ Une détection satellite n'est PAS une confirmation officielle d'incendie.
 * Elle peut correspondre à un feu actif, une anomalie thermique, ou une source
 * de chaleur industrielle / naturelle.
 */
export type FireDetection = {
  /** Identifiant stable dérivé de lat/lon/date/heure/satellite. */
  id: string
  latitude: number
  longitude: number
  /** Date/heure de détection, ISO 8601 UTC (ex. « 2026-07-24T13:42:00.000Z »). */
  detectedAt: string
  /** Ancienneté en minutes au moment de la normalisation. */
  ageMinutes: number
  /** Libellé satellite lisible (ex. « Suomi NPP », « NOAA-20 »). */
  satellite: string
  /** Capteur / instrument (ex. « VIIRS », « MODIS »). */
  instrument: string
  /** Valeur de confiance brute (catégorielle VIIRS, numérique 0-100 MODIS). */
  confidence: string | number | null
  /** Confiance normalisée. */
  confidenceLevel: ConfidenceLevel
  /** Température de brillance principale en Kelvin (bright_ti4 / brightness). */
  brightness: number | null
  /** Température de brillance secondaire en Kelvin (bright_ti5 / bright_t31). */
  brightT31: number | null
  /** Puissance radiative du feu (Fire Radiative Power) en MW. */
  frp: number | null
  /** Dimension de balayage du pixel (km). */
  scan: number | null
  /** Dimension de piste du pixel (km). */
  track: number | null
  dayNight: DayNight
  /** Source FIRMS interrogée (ex. « VIIRS_SNPP_NRT »). */
  source: string
}

/** Tranche d'ancienneté pour la coloration des marqueurs. */
export type AgeBucket = 'lt3h' | '3to12h' | '12to24h' | 'gt24h'

/** Réponse normalisée renvoyée par /api/firms au frontend. */
export type FirmsResponse = {
  detections: FireDetection[]
  /** Nombre total de détections après dédup. */
  count: number
  /** Heure de la dernière interrogation FIRMS réussie (ISO UTC). */
  fetchedAt: string
  /** Détection la plus récente reçue (ISO UTC) ou null si aucune. */
  latestDetectionAt: string | null
  /** true si les données proviennent du mode démonstration. */
  demo: boolean
  /** true si les données servies proviennent du cache (échec API récent). */
  stale: boolean
  /** Sources FIRMS effectivement interrogées. */
  sources: string[]
  /** Message d'avertissement éventuel (ex. échec partiel API). */
  notice: string | null
}
