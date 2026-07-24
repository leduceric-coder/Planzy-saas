import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { clearCache } from '@/lib/firms/fetch'

// ── Intégration : route /api/firms avec FIRMS simulé ─────────────────────────

const VIIRS_HEADER =
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight'

/** Construit une réponse CSV VIIRS avec des détections récentes (fenêtre OK). */
function recentCsv(): string {
  const d = new Date()
  const date = d.toISOString().slice(0, 10)
  const time = `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
  return [
    VIIRS_HEADER,
    `43.281,6.641,348.1,0.39,0.36,${date},${time},N,VIIRS,h,2.0NRT,297.2,32.4,D`,
    `42.198,9.121,331.5,0.41,0.38,${date},${time},N,VIIRS,n,2.0NRT,291.0,14.7,D`,
    '',
  ].join('\n')
}

const req = (qs: string) =>
  new NextRequest(new URL(`http://localhost/api/firms${qs}`))

const originalFetch = global.fetch
const originalKey = process.env.FIRMS_MAP_KEY

beforeEach(() => {
  clearCache()
  process.env.FIRMS_MAP_KEY = 'test-key-123'
})

afterEach(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.FIRMS_MAP_KEY
  else process.env.FIRMS_MAP_KEY = originalKey
  vi.restoreAllMocks()
})

describe('GET /api/firms', () => {
  it('renvoie des détections normalisées en cas de succès', async () => {
    global.fetch = vi.fn(async () => new Response(recentCsv(), { status: 200 })) as typeof fetch
    const res = await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.demo).toBe(false)
    expect(body.count).toBe(2)
    expect(body.detections[0]).toHaveProperty('confidenceLevel')
    expect(body.latestDetectionAt).not.toBeNull()
    // La clé ne doit jamais apparaître dans la réponse.
    expect(JSON.stringify(body)).not.toContain('test-key-123')
  })

  it('gère une réponse vide (en-tête seul)', async () => {
    global.fetch = vi.fn(async () => new Response(VIIRS_HEADER + '\n', { status: 200 })) as typeof fetch
    const res = await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    const body = await res.json()
    expect(body.count).toBe(0)
    expect(body.detections).toEqual([])
  })

  it('bascule en mode démonstration sans clé', async () => {
    delete process.env.FIRMS_MAP_KEY
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    const res = await GET(req('?period=24'))
    const body = await res.json()
    expect(body.demo).toBe(true)
    expect(body.notice).toContain('démonstration')
    expect(body.detections.length).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled() // pas d'appel FIRMS
  })

  it('renvoie 400 pour des paramètres invalides', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch
    const res = await GET(req('?period=99'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('sert le cache au second appel (pas de nouvel appel FIRMS)', async () => {
    const fetchSpy = vi.fn(async () => new Response(recentCsv(), { status: 200 }))
    global.fetch = fetchSpy as unknown as typeof fetch
    await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    const callsAfterFirst = fetchSpy.mock.calls.length
    await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst) // cache utilisé
  })

  it('en cas d’échec API sans cache : réponse vide + bandeau, pas de crash', async () => {
    global.fetch = vi.fn(async () => new Response('error', { status: 500 })) as typeof fetch
    const res = await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.detections).toEqual([])
    expect(body.stale).toBe(true)
    expect(body.notice).toContain('indisponibles')
  })

  it('en cas d’échec API avec cache : conserve les dernières données', async () => {
    // 1er appel OK → cache
    global.fetch = vi.fn(async () => new Response(recentCsv(), { status: 200 })) as typeof fetch
    await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    // Périmer le cache pour forcer un nouvel appel qui échoue.
    vi.useFakeTimers()
    vi.advanceTimersByTime(9 * 60 * 1000)
    global.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as typeof fetch
    const res = await GET(req('?period=24&sources=VIIRS_SNPP_NRT'))
    vi.useRealTimers()
    const body = await res.json()
    expect(body.stale).toBe(true)
    expect(body.count).toBe(2) // dernières données conservées
    expect(body.notice).toContain('temporairement indisponibles')
  })
})
