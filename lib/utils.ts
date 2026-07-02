import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TaskStatus, IssueStatus, ProjectStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(date))
}

export function formatRelative(date: string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes}min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`
  return formatDateShort(date)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export function taskStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: 'À faire',
    in_progress: 'En cours',
    blocked: 'Bloqué',
    review: 'À valider',
    done: 'Terminé',
    validated: 'Validé',
  }
  return labels[status] ?? status
}

export function taskStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/15 text-primary',
    blocked: 'bg-destructive/15 text-destructive',
    review: 'bg-yellow-500/15 text-yellow-500',
    done: 'bg-green-500/15 text-green-500',
    validated: 'bg-green-500/20 text-green-400',
  }
  return colors[status] ?? 'bg-muted text-muted-foreground'
}

export function issueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    open: 'Ouvert',
    assigned: 'Assigné',
    in_progress: 'En cours',
    fixed: 'Corrigé',
    validated: 'Validé',
    rejected: 'Rejeté',
  }
  return labels[status] ?? status
}

export function projectStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    active: 'En cours',
    paused: 'En pause',
    completed: 'Terminé',
    archived: 'Archivé',
  }
  return labels[status] ?? status
}

export function projectStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    active: 'bg-primary/15 text-primary',
    paused: 'bg-yellow-500/15 text-yellow-500',
    completed: 'bg-green-500/15 text-green-500',
    archived: 'bg-muted text-muted-foreground',
  }
  return colors[status] ?? 'bg-muted text-muted-foreground'
}

export function messageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Message',
    consigne: 'Consigne',
    probleme: 'Blocage',
    question: 'Question',
    photo: 'Photo',
    livraison_absente: 'Livraison absente',
    tache_terminee: 'Tâche terminée',
    validation_demandee: 'Validation',
    decision: 'Décision',
  }
  return labels[type] ?? type
}

export function messageTypeColor(type: string): string {
  const colors: Record<string, string> = {
    consigne: 'text-blue-600 bg-blue-500/10 dark:text-blue-400',
    probleme: 'text-red-600 bg-red-500/10 dark:text-red-400',
    question: 'text-yellow-600 bg-yellow-500/10 dark:text-yellow-400',
    validation_demandee: 'text-orange-600 bg-orange-500/10 dark:text-orange-400',
    tache_terminee: 'text-green-600 bg-green-500/10 dark:text-green-400',
    decision: 'text-green-600 bg-green-500/10 dark:text-green-400',
    livraison_absente: 'text-red-600 bg-red-500/10 dark:text-red-400',
  }
  return colors[type] ?? ''
}

export const TASK_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706',
  '#DC2626', '#0891B2', '#9333EA', '#65A30D',
]

export function getProjectColor(index: number): string {
  return TASK_COLORS[index % TASK_COLORS.length]
}

/** Convert a hex color to rgba with the given alpha (0–1). */
export function hexToRgba(hex: string, alpha: number): string {
  const h = (hex ?? '').replace('#', '')
  if (h.length < 6) return `rgba(99,102,241,${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(99,102,241,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isLate(endDate: string | null | undefined, status: TaskStatus): boolean {
  if (!endDate || status === 'done' || status === 'validated') return false
  return new Date(endDate) < new Date()
}

// ─── LOT 26B — libellés / couleurs planning ────────────────────────────────────

export function priorityLabel(priority: 'low' | 'medium' | 'high' | 'critical'): string {
  const labels: Record<string, string> = {
    low: 'Basse',
    medium: 'Normale',
    high: 'Haute',
    critical: 'Critique',
  }
  return labels[priority] ?? priority
}

export function occupancyLevelColor(level: 'disponible' | 'partiel' | 'occupe' | 'surcharge'): string {
  const colors: Record<string, string> = {
    disponible: 'bg-green-500/15 text-green-500',
    partiel: 'bg-primary/10 text-primary',
    occupe: 'bg-yellow-500/15 text-yellow-500',
    surcharge: 'bg-destructive/15 text-destructive',
  }
  return colors[level] ?? 'bg-muted text-muted-foreground'
}
