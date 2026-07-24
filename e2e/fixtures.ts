import type { Page, Route } from '@playwright/test'

// ── Fixtures e2e « Feux France » — réponses API simulées, réalistes ──────────

export type MockDetection = {
  id: string
  latitude: number
  longitude: number
  detectedAt: string
  ageMinutes: number
  satellite: string
  instrument: string
  confidence: string | number | null
  confidenceLevel: 'low' | 'nominal' | 'high' | 'unknown'
  brightness: number | null
  brightT31: number | null
  frp: number | null
  scan: number | null
  track: number | null
  dayNight: 'day' | 'night' | 'unknown'
  source: string
}

function iso(minAgo: number): string {
  return new Date(Date.now() - minAgo * 60_000).toISOString()
}

export function sampleDetections(): MockDetection[] {
  return [
    {
      id: 'd-var', latitude: 43.281, longitude: 6.641, detectedAt: iso(30), ageMinutes: 30,
      satellite: 'Suomi NPP', instrument: 'VIIRS', confidence: 'h', confidenceLevel: 'high',
      brightness: 348.1, brightT31: 297.2, frp: 32.4, scan: 0.39, track: 0.36,
      dayNight: 'day', source: 'VIIRS_SNPP_NRT',
    },
    {
      id: 'd-corse', latitude: 42.198, longitude: 9.121, detectedAt: iso(120), ageMinutes: 120,
      satellite: 'NOAA-20', instrument: 'VIIRS', confidence: 'n', confidenceLevel: 'nominal',
      brightness: 331.5, brightT31: 291.0, frp: 14.7, scan: 0.41, track: 0.38,
      dayNight: 'day', source: 'VIIRS_NOAA20_NRT',
    },
    {
      id: 'd-gard', latitude: 44.014, longitude: 4.412, detectedAt: iso(300), ageMinutes: 300,
      satellite: 'NOAA-21', instrument: 'VIIRS', confidence: 'h', confidenceLevel: 'high',
      brightness: 355.3, brightT31: 300.4, frp: 51.9, scan: 0.45, track: 0.40,
      dayNight: 'day', source: 'VIIRS_NOAA21_NRT',
    },
  ]
}

/** Simule /api/firms avec des détections récentes (mode démo). */
export async function mockFirms(page: Page, detections = sampleDetections()) {
  await page.route('**/api/firms**', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        detections,
        count: detections.length,
        fetchedAt: new Date().toISOString(),
        latestDetectionAt: detections[0]?.detectedAt ?? null,
        demo: true,
        stale: false,
        sources: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'],
        notice: 'Mode démonstration — données non réelles.',
      }),
    })
  })
}

/** Simule /api/firms en échec : réponse vide + bandeau, données conservées. */
export async function mockFirmsError(page: Page) {
  await page.route('**/api/firms**', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        detections: [],
        count: 0,
        fetchedAt: new Date().toISOString(),
        latestDetectionAt: null,
        demo: false,
        stale: true,
        sources: ['VIIRS_SNPP_NRT'],
        notice:
          'Les nouvelles données sont temporairement indisponibles. Les dernières détections récupérées restent affichées.',
      }),
    })
  })
}

/** Simule /api/geocode (Base Adresse Nationale). */
export async function mockGeocode(page: Page) {
  await page.route('**/api/geocode**', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 'c-marseille',
            label: 'Marseille',
            context: '13, Bouches-du-Rhône, Provence-Alpes-Côte d’Azur',
            latitude: 43.2965,
            longitude: 5.3698,
            type: 'municipality',
          },
        ],
      }),
    })
  })
}

/** Coupe les ressources externes (tuiles, polices, limites) pour la stabilité. */
export async function blockExternal(page: Page) {
  await page.route(
    /(tile\.openstreetmap\.org|server\.arcgisonline\.com|demotiles\.maplibre\.org|raw\.githubusercontent\.com)/,
    (route: Route) => route.abort()
  )
}

/** Attend que la carte MapLibre soit chargée et que les marqueurs soient rendus. */
export async function waitForMarkers(page: Page) {
  await page.waitForFunction(() => {
    // @ts-expect-error hook de test
    const m = window.__feuxMap
    return m && m.isStyleLoaded() && m.getLayer('markers')
  })
  await page.waitForFunction(() => {
    // @ts-expect-error hook de test
    const m = window.__feuxMap
    return m.queryRenderedFeatures({ layers: ['markers'] }).length > 0
  })
}
