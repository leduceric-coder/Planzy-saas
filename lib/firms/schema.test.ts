import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv } from './csv'
import { firmsRowSchema, validateRows } from './schema'

const readFixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('firmsRowSchema', () => {
  it('valide une ligne VIIRS correcte', () => {
    const rows = parseCsv(readFixture('viirs.csv'))
    const parsed = firmsRowSchema.safeParse(rows[0])
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.latitude).toBe(43.281)
      expect(parsed.data.frp).toBe(32.4)
      expect(parsed.data.bright_ti4).toBe(348.1)
    }
  })

  it('transforme les champs numériques vides en null', () => {
    const parsed = firmsRowSchema.safeParse({
      latitude: '43.1',
      longitude: '6.0',
      acq_date: '2026-07-24',
      acq_time: '1000',
      frp: '',
      bright_ti4: 'N/A',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.frp).toBeNull()
      expect(parsed.data.bright_ti4).toBeNull()
    }
  })

  it('rejette une latitude non numérique', () => {
    const parsed = firmsRowSchema.safeParse({
      latitude: 'not-a-number',
      longitude: '6.0',
      acq_date: '2026-07-24',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejette des coordonnées hors bornes', () => {
    const parsed = firmsRowSchema.safeParse({
      latitude: '200',
      longitude: '6.0',
      acq_date: '2026-07-24',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejette une ligne sans date', () => {
    const parsed = firmsRowSchema.safeParse({ latitude: '43.1', longitude: '6.0', acq_date: '' })
    expect(parsed.success).toBe(false)
  })
})

describe('validateRows', () => {
  it('sépare les lignes valides des lignes invalides (edge-cases)', () => {
    const rows = parseCsv(readFixture('edge-cases.csv'))
    const { valid, skipped } = validateRows(rows)
    // 4 lignes : 1 valide (342), 1 invalide (not-a-number),
    // 1 valide géométriquement mais sans date -> invalide (acq_date requis),
    // 1 sans date -> invalide.
    expect(valid.length).toBeGreaterThanOrEqual(1)
    expect(skipped).toBeGreaterThanOrEqual(1)
    expect(valid.length + skipped).toBe(rows.length)
  })

  it('accepte MODIS avec confiance numérique', () => {
    const rows = parseCsv(readFixture('modis.csv'))
    const { valid } = validateRows(rows)
    expect(valid).toHaveLength(3)
    expect(valid[0].confidence).toBe('78')
    expect(valid[0].brightness).toBe(329.0)
  })
})
