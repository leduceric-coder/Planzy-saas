// ── Feux France — route serveur FIRMS ────────────────────────────────────────
// Interroge NASA FIRMS, normalise, met en cache, et ne renvoie au frontend que
// des `FireDetection`. La clé FIRMS_MAP_KEY ne quitte JAMAIS le serveur.
//
// Comportements :
//  - pas de clé            → mode démonstration (données fictives, demo:true) ;
//  - cache frais           → réponse immédiate depuis le cache ;
//  - appel FIRMS OK        → mise en cache + réponse ;
//  - appel FIRMS en échec  → dernières données valides du cache (stale:true) ;
//  - échec sans cache      → réponse vide + bandeau (jamais de crash).

import { NextRequest, NextResponse } from 'next/server'
import { parseFirmsQuery, periodToDayRange } from '@/lib/firms/params'
import {
  cacheKey,
  fetchDetections,
  getCached,
  isFresh,
  setCached,
  type FetchParams,
} from '@/lib/firms/fetch'
import { demoDetectionsForPeriod } from '@/lib/firms/demo'
import type { FirmsResponse } from '@/lib/firms/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function latest(dets: { detectedAt: string }[]): string | null {
  if (!dets.length) return null
  return dets.reduce((m, d) => (d.detectedAt > m ? d.detectedAt : m), dets[0].detectedAt)
}

export async function GET(req: NextRequest) {
  const parsed = parseFirmsQuery(req.nextUrl.searchParams)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    )
  }
  const { period, sources, bbox } = parsed.data
  const now = Date.now()

  // ── Mode démonstration : aucune clé configurée ─────────────────────────────
  const mapKey = process.env.FIRMS_MAP_KEY?.trim()
  if (!mapKey) {
    const detections = demoDetectionsForPeriod(period, now)
    const body: FirmsResponse = {
      detections,
      count: detections.length,
      fetchedAt: new Date(now).toISOString(),
      latestDetectionAt: latest(detections),
      demo: true,
      stale: false,
      sources,
      notice: 'Mode démonstration — données non réelles.',
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  }

  const params: FetchParams = {
    sources,
    bbox,
    dayRange: periodToDayRange(period),
    windowMinutes: period * 60,
  }
  const key = cacheKey(params)

  // ── Cache frais ────────────────────────────────────────────────────────────
  const cached = getCached(key, now)
  if (isFresh(cached, now) && cached) {
    return NextResponse.json(toResponse(cached.result, sources, false), {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // ── Appel FIRMS ────────────────────────────────────────────────────────────
  try {
    const result = await fetchDetections(mapKey, params, now)
    setCached(key, result, now)
    const notice = result.partial
      ? `Certaines sources sont momentanément indisponibles (${result.failedSources.join(', ')}).`
      : null
    return NextResponse.json({ ...toResponse(result, sources, false), notice }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    // Journalisation minimale, sans secret ni donnée personnelle.
    console.error('[firms] échec API FIRMS:', err instanceof Error ? err.message : 'inconnu')

    // Repli sur le dernier cache valide (même périmé) : on ne vide pas la carte.
    if (cached) {
      return NextResponse.json(
        {
          ...toResponse(cached.result, sources, true),
          notice:
            'Les nouvelles données sont temporairement indisponibles. Les dernières détections récupérées restent affichées.',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Aucun cache : réponse vide, bandeau discret, pas de crash.
    const body: FirmsResponse = {
      detections: [],
      count: 0,
      fetchedAt: new Date(now).toISOString(),
      latestDetectionAt: null,
      demo: false,
      stale: true,
      sources,
      notice:
        'Les données NASA FIRMS sont temporairement indisponibles. Réessayez dans quelques instants.',
    }
    return NextResponse.json(body, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
}

function toResponse(
  result: { detections: FirmsResponse['detections']; fetchedAt: string },
  sources: string[],
  stale: boolean
): FirmsResponse {
  return {
    detections: result.detections,
    count: result.detections.length,
    fetchedAt: result.fetchedAt,
    latestDetectionAt: latest(result.detections),
    demo: false,
    stale,
    sources,
    notice: null,
  }
}
