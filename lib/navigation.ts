// ─── Source unique de la navigation latérale (desktop / compact / mobile) ─────
// Refonte sidebar. Centralise ici — et NULLE PART AILLEURS dans le JSX — :
//   - les libellés affichés ;
//   - les routes ;
//   - les sections ;
//   - les motifs de correspondance d'état actif (parent + sous-routes) ;
//   - les règles d'accès (rôle) ;
//   - la logique de badge (ton + libellé accessible).
//
// Module PUR : aucune dépendance React/JSX/icône → testable avec `node --test`.
// Les icônes sont résolues dans le composant via une table `NavId → LucideIcon`.

export type NavSection = 'pilotage' | 'collaboration'

export type NavId =
  | 'overview'
  | 'chantiers'
  | 'planning'
  | 'rapports'
  | 'equipe'
  | 'documents'
  | 'messages'

/** Métrique d'alerte qui alimente le badge d'une entrée, le cas échéant. */
export type BadgeSource = 'issuesCritical' | 'planningAlerts' | 'messagesRecent'

export interface NavItemConfig {
  id: NavId
  label: string
  href: string
  section: NavSection
  /** Préfixes de route additionnels (hors `href`) marquant l'entrée active. */
  activePatterns?: string[]
  badgeSource?: BadgeSource
}

// Libellés courts et immédiatement compréhensibles (cf. cahier des charges).
export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: "Vue d'ensemble", href: '/', section: 'pilotage' },
  { id: 'chantiers', label: 'Chantiers', href: '/chantiers', section: 'pilotage', badgeSource: 'issuesCritical' },
  { id: 'planning', label: 'Planning', href: '/planning', section: 'pilotage', badgeSource: 'planningAlerts' },
  { id: 'rapports', label: 'Rapports', href: '/rapports', section: 'pilotage' },
  { id: 'equipe', label: 'Équipe', href: '/equipes', section: 'collaboration', activePatterns: ['/equipes'] },
  { id: 'documents', label: 'Documents', href: '/documents', section: 'collaboration' },
  { id: 'messages', label: 'Messages', href: '/messages', section: 'collaboration', badgeSource: 'messagesRecent' },
]

export const NAV_SECTIONS: { id: NavSection; label: string }[] = [
  { id: 'pilotage', label: 'Pilotage' },
  { id: 'collaboration', label: 'Collaboration' },
]

export function navItemsBySection(section: NavSection): NavItemConfig[] {
  return NAV_ITEMS.filter(i => i.section === section)
}

// ─── Correspondance d'état actif ─────────────────────────────────────────────
// `/` (Vue d'ensemble) : actif uniquement en correspondance EXACTE, pour ne pas
// s'activer sur toutes les pages. Les autres : actif sur la route ET ses
// sous-routes (`/chantiers` ⇒ `/chantiers/[id]`, `/equipes` ⇒ `/equipes/...`).

export function pathMatches(pathname: string, base: string): boolean {
  if (base === '/') return pathname === '/'
  return pathname === base || pathname.startsWith(base + '/')
}

export function isNavItemActive(pathname: string, item: NavItemConfig): boolean {
  const patterns = [item.href, ...(item.activePatterns ?? [])]
  return patterns.some(p => pathMatches(pathname, p))
}

/**
 * Identifiant de l'entrée active pour un chemin donné (correspondance la plus
 * spécifique = base la plus longue), ou `null`. Une seule entrée est active.
 */
export function activeNavId(pathname: string): NavId | null {
  let best: { id: NavId; len: number } | null = null
  for (const item of NAV_ITEMS) {
    if (!isNavItemActive(pathname, item)) continue
    const len = Math.max(item.href.length, ...(item.activePatterns ?? []).map(p => p.length))
    if (!best || len > best.len) best = { id: item.id, len }
  }
  return best?.id ?? null
}

// ─── Accès administration ────────────────────────────────────────────────────
// Les fonctions d'administration (Membres & accès) sont réservées aux rôles de
// direction. Ne modifie AUCUNE permission métier existante : reproduit la règle
// déjà appliquée dans la sidebar (`owner` / `admin`).
export function canAccessAdmin(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

// ─── Badges ──────────────────────────────────────────────────────────────────
// Trois tons sémantiques (jamais le rouge pour un simple total) :
//   - info      (bleu)   : quantité informative ;
//   - attention (orange) : élément nécessitant une attention ;
//   - critical  (rouge)  : alerte critique / blocage réel.
export type BadgeTone = 'neutral' | 'info' | 'attention' | 'critical'

export interface NavBadge {
  count: number
  tone: BadgeTone
  /** Description accessible (aria-label / title). Ex. « 2 alertes de planning ». */
  label: string
}

export interface AlertCounts {
  issuesCritical: number
  tasksLate: number
  tasksBlocked: number
  messagesRecent: number
}

const plural = (n: number) => (n > 1 ? 's' : '')

/** Badge d'une entrée à partir des compteurs d'alerte, ou `null` si aucun. */
export function navBadgeFor(id: NavId, a: AlertCounts): NavBadge | null {
  switch (id) {
    case 'chantiers': {
      const n = a.issuesCritical
      if (n <= 0) return null
      return { count: n, tone: 'critical', label: `${n} réserve${plural(n)} critique${plural(n)}` }
    }
    case 'planning': {
      const n = a.tasksLate + a.tasksBlocked
      if (n <= 0) return null
      const parts: string[] = []
      if (a.tasksLate) parts.push(`${a.tasksLate} en retard`)
      if (a.tasksBlocked) parts.push(`${a.tasksBlocked} bloquée${plural(a.tasksBlocked)}`)
      return {
        count: n,
        tone: 'attention',
        label: `${n} tâche${plural(n)} à traiter (${parts.join(', ')})`,
      }
    }
    case 'messages': {
      const n = a.messagesRecent
      if (n <= 0) return null
      return { count: n, tone: 'info', label: `${n} message${plural(n)} reçu${plural(n)} récemment` }
    }
    default:
      return null
  }
}
