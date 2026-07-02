// ─── Vue ressources — calcul d'occupation des artisans ───────────────────────
// Approximation documentée : en l'absence d'heures ou de capacité journalière
// dans la base, la charge est déduite du chevauchement des jours ouvrés
// affectés (1 jour ouvré occupé par 1 tâche = 1 unité de charge). Capacité de
// référence = 5 jours ouvrés par semaine (lun-ven), par artisan ou équipe.

import { isBusinessDay } from './business-days'

export type OccupancyLevel = 'disponible' | 'partiel' | 'occupe' | 'surcharge'

export interface OccupancyTask {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  project?: { id: string; name: string; color: string } | null
}

export interface WeekOccupancy {
  weekStart: string
  weekEnd: string
  businessDays: string[]
  dayLoads: Record<string, OccupancyTask[]>
  totalLoad: number
  capacity: number
  rate: number
  level: OccupancyLevel
  hasConflict: boolean
  tasks: OccupancyTask[]
}

export interface OverlapPair {
  taskA: OccupancyTask
  taskB: OccupancyTask
  overlapStart: string
  overlapEnd: string
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Lundi de la semaine contenant `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Génère `count` semaines consécutives (lundi de départ) à partir de `from`. */
export function getWeekStarts(from: Date, count: number): Date[] {
  const start = mondayOf(from)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i * 7)
    return d
  })
}

function businessDaysOfWeek(monday: Date): string[] {
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    if (isBusinessDay(d)) days.push(toISODate(d))
  }
  return days
}

function taskActiveOnDay(task: OccupancyTask, isoDay: string): boolean {
  if (!task.start_date || !task.end_date) return false
  return task.start_date <= isoDay && task.end_date >= isoDay
}

/**
 * Occupation hebdomadaire pour un artisan (ou une équipe) donné, à partir des
 * tâches qui lui sont affectées et qui recoupent la semaine commençant `monday`.
 */
export function computeWeekOccupancy(monday: Date, tasks: OccupancyTask[]): WeekOccupancy {
  const businessDays = businessDaysOfWeek(monday)
  const dayLoads: Record<string, OccupancyTask[]> = {}
  for (const day of businessDays) {
    dayLoads[day] = tasks.filter(t => taskActiveOnDay(t, day))
  }
  const totalLoad = businessDays.reduce((sum, day) => sum + dayLoads[day].length, 0)
  const capacity = businessDays.length
  const rate = capacity > 0 ? Math.round((totalLoad / capacity) * 100) : 0
  const hasConflict = businessDays.some(day => dayLoads[day].length >= 2)

  const involvedIds = new Set<string>()
  const involvedTasks: OccupancyTask[] = []
  for (const day of businessDays) {
    for (const t of dayLoads[day]) {
      if (!involvedIds.has(t.id)) {
        involvedIds.add(t.id)
        involvedTasks.push(t)
      }
    }
  }

  return {
    weekStart: businessDays[0] ?? toISODate(monday),
    weekEnd: businessDays[businessDays.length - 1] ?? toISODate(monday),
    businessDays,
    dayLoads,
    totalLoad,
    capacity,
    rate,
    level: classifyOccupancy(rate),
    hasConflict,
    tasks: involvedTasks,
  }
}

export function classifyOccupancy(rate: number): OccupancyLevel {
  if (rate <= 0) return 'disponible'
  if (rate < 80) return 'partiel'
  if (rate <= 100) return 'occupe'
  return 'surcharge'
}

export function occupancyLevelLabel(level: OccupancyLevel): string {
  const labels: Record<OccupancyLevel, string> = {
    disponible: 'Disponible',
    partiel: 'Partiellement occupé',
    occupe: 'Occupé',
    surcharge: 'Surcharge',
  }
  return labels[level]
}

/** Paires de tâches dont les périodes se chevauchent (double affectation). */
export function findOverlappingPairs(tasks: OccupancyTask[]): OverlapPair[] {
  const pairs: OverlapPair[] = []
  const dated = tasks.filter(t => t.start_date && t.end_date)
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i]
      const b = dated[j]
      const overlapStart = a.start_date! > b.start_date! ? a.start_date! : b.start_date!
      const overlapEnd = a.end_date! < b.end_date! ? a.end_date! : b.end_date!
      if (overlapStart <= overlapEnd) {
        pairs.push({ taskA: a, taskB: b, overlapStart, overlapEnd })
      }
    }
  }
  return pairs
}
