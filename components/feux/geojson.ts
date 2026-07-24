// ── Feux France — conversion détections → GeoJSON pour MapLibre ──────────────

import type { FireDetection } from '@/lib/firms/types'
import { colorForAge, radiusForFrp } from '@/lib/firms/format'
import { ageBucket } from '@/lib/firms/normalize'

export type FireFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: {
      id: string
      color: string
      radius: number
      ageMinutes: number
      recent: number // 1 si < 3 h (pour la pulsation) sinon 0
      weight: number // pour la carte de chaleur
    }
  }>
}

/** Construit la FeatureCollection à partir des détections filtrées. */
export function toFeatureCollection(detections: FireDetection[]): FireFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: detections.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] },
      properties: {
        id: d.id,
        color: colorForAge(d.ageMinutes),
        radius: radiusForFrp(d.frp),
        ageMinutes: d.ageMinutes,
        recent: ageBucket(d.ageMinutes) === 'lt3h' ? 1 : 0,
        weight: d.frp != null && d.frp > 0 ? Math.min(1, 0.3 + Math.log10(d.frp + 1) / 3) : 0.3,
      },
    })),
  }
}
