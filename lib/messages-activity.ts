// ─── Activité messagerie « entrante récente » — source de vérité unique ──────
// LOT 35. Définition partagée entre le badge Sidebar (via lib/alerts.ts, serveur)
// et MessagesSideWindow (client). Aucun modèle de « lu » en base : on ne parle
// donc jamais de « non lus » mais de messages REÇUS RÉCEMMENT.
//
// Un message est « entrant récent » si :
//   - il a été créé dans la fenêtre RECENT_WINDOW_MS (48 h) ;
//   - il n'a PAS été émis par l'utilisateur courant.
// Traitement de sender_id NULL (message système) : considéré ENTRANT (non émis
// par l'utilisateur) → compté. Le filtrage organisation/RLS est fait en amont.

export const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000

export interface MsgLike {
  sender_id?: string | null
  created_at?: string | null
  project_id?: string | null
}

export function isRecentIncoming(m: MsgLike, currentUserId: string, now: number = Date.now()): boolean {
  if (m.sender_id && m.sender_id === currentUserId) return false // émis par moi
  if (!m.created_at) return false
  return now - new Date(m.created_at).getTime() < RECENT_WINDOW_MS
}

export function countRecentIncoming(msgs: MsgLike[], currentUserId: string, now: number = Date.now()): number {
  let n = 0
  for (const m of msgs) if (isRecentIncoming(m, currentUserId, now)) n++
  return n
}

/** Nombre de messages entrants récents par project_id. */
export function recentIncomingByProject(
  msgs: MsgLike[], currentUserId: string, now: number = Date.now(),
): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of msgs) {
    if (!m.project_id) continue
    if (!isRecentIncoming(m, currentUserId, now)) continue
    map.set(m.project_id, (map.get(m.project_id) ?? 0) + 1)
  }
  return map
}

/** Dernier message entrant récent par project_id (compare les dates). */
export function latestIncomingByProject<T extends MsgLike>(
  msgs: T[], currentUserId: string, now: number = Date.now(),
): Map<string, T> {
  const map = new Map<string, T>()
  for (const m of msgs) {
    if (!m.project_id) continue
    if (!isRecentIncoming(m, currentUserId, now)) continue
    const ex = map.get(m.project_id)
    if (!ex || (m.created_at ?? '') > (ex.created_at ?? '')) map.set(m.project_id, m)
  }
  return map
}
