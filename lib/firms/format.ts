// ── Feux France — helpers d'affichage (fuseau Europe/Paris, libellés) ────────
// Conversion UTC → Europe/Paris via Intl (gère l'heure d'été sans dépendance).

import type { ConfidenceLevel, DayNight, AgeBucket } from './types'
import { ageBucket } from './normalize'

const PARIS_DATE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const PARIS_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
})

const PARIS_DATETIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Date locale française (ex. « 24 juillet 2026 »). */
export function formatParisDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return PARIS_DATE.format(d)
}

/** Heure locale française (ex. « 15:42 »). */
export function formatParisTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return PARIS_TIME.format(d)
}

/** Date + heure locales (ex. « 24/07/2026 15:42 »). */
export function formatParisDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return PARIS_DATETIME.format(d)
}

/** Ancienneté lisible (ex. « il y a 2 h 15 », « il y a 40 min »). */
export function formatAge(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m > 0 ? `il y a ${h} h ${String(m).padStart(2, '0')}` : `il y a ${h} h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `il y a ${d} j ${rh} h` : `il y a ${d} j`
}

/** Libellé de confiance pour l'UI. */
export function confidenceLabel(level: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    low: 'Faible',
    nominal: 'Nominale',
    high: 'Élevée',
    unknown: 'Inconnue',
  }
  return labels[level]
}

/** Libellé jour / nuit. */
export function dayNightLabel(dn: DayNight): string {
  const labels: Record<DayNight, string> = {
    day: 'Jour',
    night: 'Nuit',
    unknown: 'Inconnu',
  }
  return labels[dn]
}

/** Couleur (hex) par tranche d'ancienneté — cohérente carte + légende. */
export const AGE_COLORS: Record<AgeBucket, string> = {
  lt3h: '#ef4444', // rouge vif — < 3 h
  '3to12h': '#f97316', // orange — 3-12 h
  '12to24h': '#f59e0b', // jaune-orangé — 12-24 h
  gt24h: '#9ca3af', // gris atténué — > 24 h
}

/** Libellé de tranche d'ancienneté (légende). */
export const AGE_LABELS: Record<AgeBucket, string> = {
  lt3h: 'Moins de 3 h',
  '3to12h': '3 à 12 h',
  '12to24h': '12 à 24 h',
  gt24h: 'Plus de 24 h',
}

/** Couleur d'un point selon son ancienneté (minutes). */
export function colorForAge(minutes: number): string {
  return AGE_COLORS[ageBucket(minutes)]
}

/** Rayon indicatif (px) selon la FRP, borné (n'exprime PAS la surface réelle). */
export function radiusForFrp(frp: number | null): number {
  if (frp == null || frp <= 0) return 6
  // échelle logarithmique douce, bornée 6-14 px
  const r = 6 + Math.min(8, Math.log10(frp + 1) * 5)
  return Math.round(r)
}
