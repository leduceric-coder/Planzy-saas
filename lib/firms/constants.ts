// ── Feux France — constantes FIRMS & géographie ──────────────────────────────

/** Base de l'API FIRMS « area » (interrogation par zone géographique). */
export const FIRMS_AREA_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'

/**
 * Sources FIRMS NRT (Near Real-Time) prioritaires.
 * VIIRS 375 m + MODIS 1 km. Ordre = priorité d'affichage.
 */
export const FIRMS_SOURCES = [
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'MODIS_NRT',
] as const

export type FirmsSource = (typeof FIRMS_SOURCES)[number]

/** Libellés capteur pour l'UI (filtres, fiches). */
export const SOURCE_LABELS: Record<FirmsSource, string> = {
  VIIRS_SNPP_NRT: 'VIIRS Suomi-NPP',
  VIIRS_NOAA20_NRT: 'VIIRS NOAA-20',
  VIIRS_NOAA21_NRT: 'VIIRS NOAA-21',
  MODIS_NRT: 'MODIS',
}

/** Libellé satellite lisible dérivé de la source (fallback si CSV imprécis). */
export const SOURCE_SATELLITE: Record<FirmsSource, string> = {
  VIIRS_SNPP_NRT: 'Suomi NPP',
  VIIRS_NOAA20_NRT: 'NOAA-20',
  VIIRS_NOAA21_NRT: 'NOAA-21',
  MODIS_NRT: 'Terra / Aqua',
}

/**
 * Bounding box France métropolitaine + Corse.
 * Ordre FIRMS attendu : ouest, sud, est, nord (min lon, min lat, max lon, max lat).
 */
export const FRANCE_BBOX = {
  west: -5.5,
  south: 41.0,
  east: 10.0,
  north: 51.5,
} as const

/** Centre approximatif de la France pour le premier affichage. */
export const FRANCE_CENTER = { longitude: 2.4, latitude: 46.6 } as const
export const FRANCE_DEFAULT_ZOOM = 5.2

/** Bornes de sécurité sur la bounding box acceptée par la route serveur. */
export const BBOX_LIMITS = {
  minLon: -10,
  maxLon: 15,
  minLat: 38,
  maxLat: 54,
  /** Étendue max (degrés) pour éviter les requêtes trop larges (France ≈ 15,5°). */
  maxSpanDeg: 20,
} as const

/** Périodes autorisées (heures). 7 jours = 168 h max autorisé par l'API area. */
export const ALLOWED_PERIODS_HOURS = [3, 6, 12, 24, 48, 168] as const
export type PeriodHours = (typeof ALLOWED_PERIODS_HOURS)[number]

/** Durée du cache serveur (ms) — limite les appels au quota NASA FIRMS. */
export const CACHE_TTL_MS = 8 * 60 * 1000 // 8 minutes

/** Timeout réseau des appels FIRMS (ms). */
export const FIRMS_TIMEOUT_MS = 12_000

/** Intervalle d'actualisation automatique côté client (ms). */
export const AUTO_REFRESH_MS = 10 * 60 * 1000 // 10 minutes

/** Base Adresse Nationale — géocodage officiel (Géoplateforme / data.gouv). */
export const BAN_GEOCODE_BASE = 'https://api-adresse.data.gouv.fr/search/'
