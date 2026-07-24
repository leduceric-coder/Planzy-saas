import { describe, it, expect } from 'vitest'
import {
  formatParisDate,
  formatParisTime,
  formatAge,
  confidenceLabel,
  dayNightLabel,
  colorForAge,
  radiusForFrp,
  AGE_COLORS,
} from './format'

describe('conversion fuseau Europe/Paris', () => {
  it('convertit UTC → heure d’été (CEST, +2h)', () => {
    // 24 juillet : Paris = UTC+2
    expect(formatParisTime('2026-07-24T13:42:00.000Z')).toBe('15:42')
  })
  it('convertit UTC → heure d’hiver (CET, +1h)', () => {
    // 15 janvier : Paris = UTC+1
    expect(formatParisTime('2026-01-15T13:42:00.000Z')).toBe('14:42')
  })
  it('formate la date en français', () => {
    expect(formatParisDate('2026-07-24T13:42:00.000Z')).toContain('juillet')
    expect(formatParisDate('2026-07-24T13:42:00.000Z')).toContain('2026')
  })
  it('gère une date invalide', () => {
    expect(formatParisTime('pas-une-date')).toBe('—')
  })
})

describe('formatAge', () => {
  it('formate les minutes', () => {
    expect(formatAge(0)).toBe("à l'instant")
    expect(formatAge(40)).toBe('il y a 40 min')
  })
  it('formate les heures', () => {
    expect(formatAge(60)).toBe('il y a 1 h')
    expect(formatAge(135)).toBe('il y a 2 h 15')
  })
  it('formate les jours', () => {
    expect(formatAge(1440)).toBe('il y a 1 j')
    expect(formatAge(1500)).toBe('il y a 1 j 1 h')
  })
})

describe('libellés & couleurs', () => {
  it('libellés de confiance', () => {
    expect(confidenceLabel('high')).toBe('Élevée')
    expect(confidenceLabel('unknown')).toBe('Inconnue')
  })
  it('libellés jour/nuit', () => {
    expect(dayNightLabel('night')).toBe('Nuit')
  })
  it('couleur selon l’ancienneté', () => {
    expect(colorForAge(10)).toBe(AGE_COLORS.lt3h)
    expect(colorForAge(2000)).toBe(AGE_COLORS.gt24h)
  })
  it('rayon borné selon la FRP', () => {
    expect(radiusForFrp(null)).toBe(6)
    expect(radiusForFrp(0)).toBe(6)
    expect(radiusForFrp(100000)).toBeLessThanOrEqual(14)
    expect(radiusForFrp(50)).toBeGreaterThan(6)
  })
})
