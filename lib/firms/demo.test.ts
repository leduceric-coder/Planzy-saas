import { describe, it, expect } from 'vitest'
import { demoDetections, demoDetectionsForPeriod } from './demo'

describe('mode démonstration', () => {
  const now = Date.parse('2026-07-24T14:00:00.000Z')

  it('génère des détections fictives ancrées sur now', () => {
    const dets = demoDetections(now)
    expect(dets.length).toBeGreaterThan(0)
    // Toutes en France métropolitaine / Corse (bornes larges).
    for (const d of dets) {
      expect(d.latitude).toBeGreaterThan(41)
      expect(d.latitude).toBeLessThan(52)
      expect(d.longitude).toBeGreaterThan(-6)
      expect(d.longitude).toBeLessThan(10)
      expect(d.confidenceLevel).toMatch(/low|nominal|high/)
    }
  })

  it('trie par ancienneté croissante', () => {
    const dets = demoDetections(now)
    for (let i = 1; i < dets.length; i++) {
      expect(dets[i].ageMinutes).toBeGreaterThanOrEqual(dets[i - 1].ageMinutes)
    }
  })

  it('filtre par période', () => {
    const short = demoDetectionsForPeriod(3, now)
    const long = demoDetectionsForPeriod(48, now)
    expect(short.length).toBeLessThanOrEqual(long.length)
    for (const d of short) expect(d.ageMinutes).toBeLessThanOrEqual(180)
  })
})
