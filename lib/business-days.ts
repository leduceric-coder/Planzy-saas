// ─── Jours ouvrés (lun-ven) — utilitaires de durée pour le planning ──────────
// Règle produit : 1 semaine = 5 jours ouvrés. Les dates (start_date / end_date)
// restent la vérité métier ; ces fonctions ne servent qu'à piloter le formulaire.

export const BUSINESS_DAYS_PER_WEEK = 5

function toDate(d: string | Date): Date {
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

export function isBusinessDay(d: string | Date): boolean {
  const day = toDate(d).getDay()
  return day !== 0 && day !== 6
}

/** Nombre de jours ouvrés entre deux dates, bornes incluses. */
export function countBusinessDays(start: string | Date, end: string | Date): number {
  const startDate = toDate(start)
  const endDate = toDate(end)
  if (endDate < startDate) return 0
  let count = 0
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    if (isBusinessDay(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/**
 * Date de fin pour une tâche démarrant à `start` et durant `businessDays`
 * jours ouvrés (le jour de début compte comme le 1er jour).
 */
export function addBusinessDays(start: string | Date, businessDays: number): Date {
  const startDate = toDate(start)
  if (businessDays <= 0) return startDate
  let remaining = businessDays - (isBusinessDay(startDate) ? 1 : 0)
  const cursor = new Date(startDate)
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1)
    if (isBusinessDay(cursor)) remaining--
  }
  // si la date de début tombe un week-end, on avance jusqu'au prochain jour ouvré
  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1)
  }
  return cursor
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface DurationInput {
  value: number
  unit: 'jours' | 'semaines'
}

export function durationToBusinessDays({ value, unit }: DurationInput): number {
  return unit === 'semaines' ? value * BUSINESS_DAYS_PER_WEEK : value
}

/**
 * Représentation la plus lisible d'une durée en jours ouvrés : si le compte
 * est un multiple exact de 5, on propose les semaines, sinon on reste en jours
 * pour éviter les arrondis incorrects.
 */
export function businessDaysToDuration(days: number): DurationInput {
  if (days > 0 && days % BUSINESS_DAYS_PER_WEEK === 0) {
    return { value: days / BUSINESS_DAYS_PER_WEEK, unit: 'semaines' }
  }
  return { value: days, unit: 'jours' }
}
