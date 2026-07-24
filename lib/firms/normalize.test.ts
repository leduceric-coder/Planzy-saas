import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv } from './csv'
import { validateRows } from './schema'
import {
  parseAcqDateTime,
  classifyConfidence,
  classifyDayNight,
  ageMinutes,
  ageBucket,
  stableId,
  normalizeRow,
  dedupe,
  normalizeAndDedupe,
} from './normalize'
import type { FireDetection } from './types'

const readFixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('parseAcqDateTime', () => {
  it('combine date + heure UTC (HHMM sur 4 chiffres)', () => {
    expect(parseAcqDateTime('2026-07-24', '1342')).toBe('2026-07-24T13:42:00.000Z')
  })
  it('complète les heures courtes (« 342 » → 03:42)', () => {
    expect(parseAcqDateTime('2026-07-24', '342')).toBe('2026-07-24T03:42:00.000Z')
  })
  it('gère « 5 » → 00:05', () => {
    expect(parseAcqDateTime('2026-07-24', '5')).toBe('2026-07-24T00:05:00.000Z')
  })
  it('retourne null pour une date invalide', () => {
    expect(parseAcqDateTime('', '1000')).toBeNull()
    expect(parseAcqDateTime('24/07/2026', '1000')).toBeNull()
  })
  it('retourne null pour une heure hors bornes', () => {
    expect(parseAcqDateTime('2026-07-24', '2599')).toBeNull()
  })
})

describe('classifyConfidence', () => {
  it('classe le format catégoriel VIIRS', () => {
    expect(classifyConfidence('l')).toBe('low')
    expect(classifyConfidence('n')).toBe('nominal')
    expect(classifyConfidence('h')).toBe('high')
  })
  it('classe le format numérique MODIS (0-100)', () => {
    expect(classifyConfidence(10)).toBe('low')
    expect(classifyConfidence(29)).toBe('low')
    expect(classifyConfidence(30)).toBe('nominal')
    expect(classifyConfidence(79)).toBe('nominal')
    expect(classifyConfidence(80)).toBe('high')
    expect(classifyConfidence(100)).toBe('high')
  })
  it('classe les chaînes numériques MODIS', () => {
    expect(classifyConfidence('78')).toBe('nominal')
    expect(classifyConfidence('95')).toBe('high')
  })
  it('renvoie unknown pour valeur absente', () => {
    expect(classifyConfidence(null)).toBe('unknown')
    expect(classifyConfidence('')).toBe('unknown')
    expect(classifyConfidence('???')).toBe('unknown')
  })
})

describe('classifyDayNight', () => {
  it('mappe D/N', () => {
    expect(classifyDayNight('D')).toBe('day')
    expect(classifyDayNight('N')).toBe('night')
    expect(classifyDayNight('')).toBe('unknown')
  })
})

describe('ageMinutes & ageBucket', () => {
  const now = Date.parse('2026-07-24T14:00:00.000Z')
  it('calcule l’ancienneté en minutes', () => {
    expect(ageMinutes('2026-07-24T13:00:00.000Z', now)).toBe(60)
    expect(ageMinutes('2026-07-24T14:00:00.000Z', now)).toBe(0)
  })
  it('classe les tranches d’ancienneté', () => {
    expect(ageBucket(10)).toBe('lt3h')
    expect(ageBucket(179)).toBe('lt3h')
    expect(ageBucket(180)).toBe('3to12h')
    expect(ageBucket(719)).toBe('3to12h')
    expect(ageBucket(720)).toBe('12to24h')
    expect(ageBucket(1439)).toBe('12to24h')
    expect(ageBucket(1440)).toBe('gt24h')
  })
})

describe('stableId', () => {
  it('est déterministe pour la même observation', () => {
    const a = stableId(43.281, 6.641, '2026-07-24T13:42:00.000Z', 'Suomi NPP')
    const b = stableId(43.281, 6.641, '2026-07-24T13:42:00.000Z', 'Suomi NPP')
    expect(a).toBe(b)
  })
  it('diffère si le satellite diffère (pas de fusion abusive)', () => {
    const a = stableId(43.281, 6.641, '2026-07-24T13:42:00.000Z', 'Suomi NPP')
    const b = stableId(43.281, 6.641, '2026-07-24T13:42:00.000Z', 'NOAA-20')
    expect(a).not.toBe(b)
  })
})

describe('normalizeRow', () => {
  const now = Date.parse('2026-07-24T14:00:00.000Z')
  it('normalise une ligne VIIRS', () => {
    const rows = validateRows(parseCsv(readFixture('viirs.csv'))).valid
    const d = normalizeRow(rows[0], 'VIIRS_SNPP_NRT', now)
    expect(d).not.toBeNull()
    expect(d!.latitude).toBe(43.281)
    expect(d!.satellite).toBe('Suomi NPP')
    expect(d!.instrument).toBe('VIIRS')
    expect(d!.confidenceLevel).toBe('high')
    expect(d!.brightness).toBe(348.1)
    expect(d!.brightT31).toBe(297.2)
    expect(d!.frp).toBe(32.4)
    expect(d!.dayNight).toBe('day')
    expect(d!.source).toBe('VIIRS_SNPP_NRT')
  })
  it('normalise une ligne MODIS (confiance numérique)', () => {
    const rows = validateRows(parseCsv(readFixture('modis.csv'))).valid
    const d = normalizeRow(rows[0], 'MODIS_NRT', now)
    expect(d!.instrument).toBe('MODIS')
    expect(d!.confidence).toBe(78)
    expect(d!.confidenceLevel).toBe('nominal')
    expect(d!.brightness).toBe(329.0)
    expect(d!.brightT31).toBe(290.6)
  })
})

describe('dedupe', () => {
  const base: FireDetection = {
    id: '',
    latitude: 43.1,
    longitude: 6.0,
    detectedAt: '2026-07-24T13:00:00.000Z',
    ageMinutes: 60,
    satellite: 'Suomi NPP',
    instrument: 'VIIRS',
    confidence: 'h',
    confidenceLevel: 'high',
    brightness: 340,
    brightT31: 295,
    frp: null,
    scan: 0.39,
    track: 0.36,
    dayNight: 'day',
    source: 'VIIRS_SNPP_NRT',
  }
  it('fusionne les doublons stricts et garde le plus informatif (FRP)', () => {
    const id = stableId(base.latitude, base.longitude, base.detectedAt, base.satellite)
    const a = { ...base, id, frp: null }
    const b = { ...base, id, frp: 12.5 }
    const out = dedupe([a, b])
    expect(out).toHaveLength(1)
    expect(out[0].frp).toBe(12.5)
  })
  it('ne fusionne pas des satellites différents', () => {
    const a = { ...base, id: stableId(43.1, 6.0, base.detectedAt, 'Suomi NPP') }
    const b = { ...base, id: stableId(43.1, 6.0, base.detectedAt, 'NOAA-20'), satellite: 'NOAA-20' }
    expect(dedupe([a, b])).toHaveLength(2)
  })
})

describe('normalizeAndDedupe', () => {
  it('trie du plus récent au plus ancien', () => {
    const now = Date.parse('2026-07-24T14:00:00.000Z')
    const rows = validateRows(parseCsv(readFixture('viirs.csv'))).valid
    const out = normalizeAndDedupe(rows, 'VIIRS_SNPP_NRT', now)
    for (let i = 1; i < out.length; i++) {
      expect(new Date(out[i - 1].detectedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(out[i].detectedAt).getTime()
      )
    }
  })
})
