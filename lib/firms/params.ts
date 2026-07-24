// ── Feux France — validation des paramètres de la route /api/firms ───────────

import { z } from 'zod'
import {
  ALLOWED_PERIODS_HOURS,
  BBOX_LIMITS,
  FIRMS_SOURCES,
  FRANCE_BBOX,
  type FirmsSource,
} from './constants'

const periodSchema = z.coerce
  .number()
  .refine((n) => (ALLOWED_PERIODS_HOURS as readonly number[]).includes(n), {
    message: 'période non autorisée',
  })
  .default(24)

const sourcesSchema = z
  .string()
  .optional()
  .transform((raw): FirmsSource[] => {
    if (!raw) return [...FIRMS_SOURCES]
    const wanted = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const valid = wanted.filter((s): s is FirmsSource =>
      (FIRMS_SOURCES as readonly string[]).includes(s)
    )
    return valid.length ? valid : [...FIRMS_SOURCES]
  })

const coord = (min: number, max: number) =>
  z.coerce.number().refine((n) => Number.isFinite(n) && n >= min && n <= max, {
    message: `coordonnée hors bornes [${min}, ${max}]`,
  })

/**
 * Schéma des query params. bbox optionnelle : par défaut la France entière.
 * Bornes de sécurité + étendue max pour éviter les requêtes abusives.
 */
export const firmsQuerySchema = z
  .object({
    period: periodSchema,
    sources: sourcesSchema,
    west: coord(BBOX_LIMITS.minLon, BBOX_LIMITS.maxLon).optional(),
    south: coord(BBOX_LIMITS.minLat, BBOX_LIMITS.maxLat).optional(),
    east: coord(BBOX_LIMITS.minLon, BBOX_LIMITS.maxLon).optional(),
    north: coord(BBOX_LIMITS.minLat, BBOX_LIMITS.maxLat).optional(),
  })
  .transform((v, ctx) => {
    const hasAny =
      v.west != null || v.south != null || v.east != null || v.north != null
    const bbox = hasAny
      ? {
          west: v.west ?? FRANCE_BBOX.west,
          south: v.south ?? FRANCE_BBOX.south,
          east: v.east ?? FRANCE_BBOX.east,
          north: v.north ?? FRANCE_BBOX.north,
        }
      : { ...FRANCE_BBOX }

    if (bbox.west >= bbox.east || bbox.south >= bbox.north) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bbox invalide (ordre)' })
      return z.NEVER
    }
    if (
      bbox.east - bbox.west > BBOX_LIMITS.maxSpanDeg ||
      bbox.north - bbox.south > BBOX_LIMITS.maxSpanDeg
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'zone trop large' })
      return z.NEVER
    }

    return { period: v.period, sources: v.sources, bbox }
  })

export type FirmsQuery = z.infer<typeof firmsQuerySchema>

/** Convertit une période (heures) en dayRange FIRMS (jours, 1-10). */
export function periodToDayRange(hours: number): number {
  return Math.min(10, Math.max(1, Math.ceil(hours / 24)))
}

/** Parse les query params d'une URL. Retourne succès/échec (jamais throw). */
export function parseFirmsQuery(searchParams: URLSearchParams) {
  const raw = {
    period: searchParams.get('period') ?? undefined,
    sources: searchParams.get('sources') ?? undefined,
    west: searchParams.get('west') ?? undefined,
    south: searchParams.get('south') ?? undefined,
    east: searchParams.get('east') ?? undefined,
    north: searchParams.get('north') ?? undefined,
  }
  return firmsQuerySchema.safeParse(raw)
}
