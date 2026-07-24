import { describe, it, expect } from 'vitest'
import { parseFirmsQuery, periodToDayRange } from './params'
import { FRANCE_BBOX, FIRMS_SOURCES } from './constants'

const parse = (qs: string) => parseFirmsQuery(new URLSearchParams(qs))

describe('parseFirmsQuery', () => {
  it('applique les valeurs par défaut (France entière, 24 h, toutes sources)', () => {
    const r = parse('')
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.period).toBe(24)
      expect(r.data.bbox).toEqual(FRANCE_BBOX)
      expect(r.data.sources).toEqual([...FIRMS_SOURCES])
    }
  })

  it('accepte une période autorisée', () => {
    const r = parse('period=168')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.period).toBe(168)
  })

  it('rejette une période non autorisée', () => {
    expect(parse('period=99').success).toBe(false)
  })

  it('filtre les sources inconnues et garde les valides', () => {
    const r = parse('sources=VIIRS_SNPP_NRT,FAKE_SOURCE')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.sources).toEqual(['VIIRS_SNPP_NRT'])
  })

  it('accepte une bbox valide', () => {
    const r = parse('west=2&south=43&east=4&north=45')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.bbox).toEqual({ west: 2, south: 43, east: 4, north: 45 })
  })

  it('rejette une bbox trop large', () => {
    expect(parse('west=-10&south=38&east=14&north=54').success).toBe(false)
  })

  it('rejette une bbox à l’ordre incohérent', () => {
    expect(parse('west=5&south=43&east=2&north=45').success).toBe(false)
  })

  it('rejette une coordonnée hors bornes de sécurité', () => {
    expect(parse('west=-50&south=43&east=4&north=45').success).toBe(false)
  })
})

describe('periodToDayRange', () => {
  it('convertit heures → jours FIRMS (1-10)', () => {
    expect(periodToDayRange(3)).toBe(1)
    expect(periodToDayRange(24)).toBe(1)
    expect(periodToDayRange(48)).toBe(2)
    expect(periodToDayRange(168)).toBe(7)
  })
})
