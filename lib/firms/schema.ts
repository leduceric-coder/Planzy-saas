// ── Feux France — validation Zod des lignes FIRMS ────────────────────────────
// Le schéma externe peut évoluer : on valide seulement les champs indispensables
// (latitude, longitude, acq_date, acq_time) et on tolère l'absence des autres.
// Les colonnes diffèrent entre VIIRS (bright_ti4 / bright_ti5) et MODIS
// (brightness / bright_t31).

import { z } from 'zod'

/** Une chaîne « vide » FIRMS peut valoir '', 'N/A', 'nan'… → null. */
const emptyish = (v: unknown): boolean =>
  v == null || (typeof v === 'string' && ['', 'na', 'n/a', 'nan', 'null'].includes(v.trim().toLowerCase()))

/** Nombre optionnel : parse tolérant, null si vide/invalide. */
const optionalNumber = z
  .string()
  .optional()
  .transform((v) => {
    if (emptyish(v)) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  })

/** Coordonnée obligatoire et finie. */
const requiredCoord = z
  .string()
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n), { message: 'coordonnée non numérique' })

/**
 * Schéma d'une ligne FIRMS brute (VIIRS ou MODIS).
 * `passthrough` : on conserve les colonnes inconnues sans casser si le schéma
 * externe évolue.
 */
export const firmsRowSchema = z
  .object({
    latitude: requiredCoord,
    longitude: requiredCoord,
    acq_date: z.string().min(1), // AAAA-MM-JJ
    acq_time: z.string().min(1).optional().default('0000'), // HHMM UTC
    satellite: z.string().optional().default(''),
    instrument: z.string().optional().default(''),
    confidence: z.string().optional().default(''),
    daynight: z.string().optional().default(''),
    frp: optionalNumber,
    scan: optionalNumber,
    track: optionalNumber,
    // VIIRS
    bright_ti4: optionalNumber,
    bright_ti5: optionalNumber,
    // MODIS
    brightness: optionalNumber,
    bright_t31: optionalNumber,
    version: z.string().optional().default(''),
  })
  .passthrough()
  .refine(
    (r) => r.latitude >= -90 && r.latitude <= 90 && r.longitude >= -180 && r.longitude <= 180,
    { message: 'coordonnées hors bornes' }
  )

export type FirmsRow = z.infer<typeof firmsRowSchema>

/**
 * Valide un tableau de lignes brutes. Les lignes invalides sont écartées
 * silencieusement (une donnée FIRMS partielle ne doit pas faire échouer tout
 * le lot). Retourne les lignes valides + le nombre d'écarts.
 */
export function validateRows(rows: Record<string, string>[]): {
  valid: FirmsRow[]
  skipped: number
} {
  const valid: FirmsRow[] = []
  let skipped = 0
  for (const row of rows) {
    const parsed = firmsRowSchema.safeParse(row)
    if (parsed.success) valid.push(parsed.data)
    else skipped++
  }
  return { valid, skipped }
}
