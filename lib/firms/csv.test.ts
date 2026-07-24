import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv } from './csv'

const readFixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')

describe('parseCsv', () => {
  it('parse un CSV VIIRS avec en-tête', () => {
    const rows = parseCsv(readFixture('viirs.csv'))
    expect(rows).toHaveLength(5)
    expect(rows[0].latitude).toBe('43.28100')
    expect(rows[0].confidence).toBe('h')
    expect(rows[0].daynight).toBe('D')
  })

  it('gère les valeurs manquantes (cellules vides)', () => {
    const rows = parseCsv(readFixture('viirs.csv'))
    // 4e ligne : frp vide
    expect(rows[3].frp).toBe('')
    // 5e ligne : bright_ti4 vide
    expect(rows[4].bright_ti4).toBe('')
  })

  it('gère les fins de ligne CRLF', () => {
    const csv = 'latitude,longitude,acq_date\r\n43.1,6.0,2026-07-24\r\n42.0,5.0,2026-07-24\r\n'
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1].longitude).toBe('5.0')
  })

  it('respecte les guillemets et virgules internes', () => {
    const csv = 'latitude,longitude,note\n43.1,6.0,"Var, massif"\n'
    const rows = parseCsv(csv)
    expect(rows[0].note).toBe('Var, massif')
  })

  it('retourne [] pour une chaîne vide', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('retourne [] pour une réponse non-CSV (erreur FIRMS)', () => {
    expect(parseCsv('Invalid MAP_KEY. Please check your key.')).toEqual([])
    expect(parseCsv('<html><body>403</body></html>')).toEqual([])
  })

  it('retourne [] si les colonnes latitude/longitude manquent', () => {
    expect(parseCsv('foo,bar\n1,2\n')).toEqual([])
  })

  it('ignore les lignes vides finales', () => {
    const csv = 'latitude,longitude\n43.1,6.0\n\n'
    expect(parseCsv(csv)).toHaveLength(1)
  })
})
