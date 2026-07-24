// ── Feux France — proxy de géocodage (Base Adresse Nationale) ────────────────
// Service officiel data.gouv / Géoplateforme, sans clé : commune, code postal,
// département, adresse. Proxifié côté serveur pour la robustesse (timeout,
// normalisation) — aucune donnée personnelle n'est journalisée.

import { NextRequest, NextResponse } from 'next/server'
import { BAN_GEOCODE_BASE } from '@/lib/firms/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 8_000

export type GeocodeResult = {
  id: string
  label: string
  context: string
  latitude: number
  longitude: number
  type: string
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] as GeocodeResult[] })
  }
  if (q.length > 200) {
    return NextResponse.json({ error: 'Requête trop longue' }, { status: 400 })
  }

  const url = new URL(BAN_GEOCODE_BASE)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '6')
  // Priorité municipalités/adresses françaises.
  url.searchParams.set('autocomplete', '1')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`BAN HTTP ${res.status}`)
    const data = (await res.json()) as {
      features?: Array<{
        properties?: { id?: string; label?: string; context?: string; type?: string }
        geometry?: { coordinates?: [number, number] }
      }>
    }

    const results: GeocodeResult[] = (data.features ?? [])
      .map((f, i) => {
        const coords = f.geometry?.coordinates
        if (!coords || coords.length < 2) return null
        const [lon, lat] = coords
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        return {
          id: f.properties?.id ?? `res-${i}`,
          label: f.properties?.label ?? '—',
          context: f.properties?.context ?? '',
          latitude: lat,
          longitude: lon,
          type: f.properties?.type ?? 'unknown',
        } satisfies GeocodeResult
      })
      .filter((r): r is GeocodeResult => r !== null)

    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[geocode] échec:', err instanceof Error ? err.message : 'inconnu')
    return NextResponse.json(
      { error: 'Service de recherche momentanément indisponible', results: [] as GeocodeResult[] },
      { status: 200 }
    )
  } finally {
    clearTimeout(timer)
  }
}
