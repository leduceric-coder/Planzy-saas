// ── Invitations — logique serveur d'anti-doublon (source unique de vérité) ────
// LOT 42C-FIX2. La création d'invitation depuis la fiche ressource passe par une
// route serveur qui applique CES gardes AVANT l'INSERT (fail-closed). Le client
// n'insère plus directement dans `invitations`.

import { asRole, ADMIN_ROLES, type Role } from './permissions'

// Normalisation email centralisée : trim + lowercase. À utiliser pour toute
// comparaison, lookup, insert et envoi dans le flux d'invitation.
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string | null | undefined): boolean {
  return EMAIL_RE.test(normalizeEmail(email))
}

// Rôles proposés à l'invitation depuis la fiche ressource (owner exclu : non délégable ici).
export const RESOURCE_INVITE_ROLES: Role[] = ['artisan', 'viewer', 'site_supervisor', 'manager', 'admin']

// Messages UX (mappés par code d'erreur, réutilisés par la route et le modal).
export const INVITE_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Session expirée. Reconnectez-vous.',
  forbidden: "Action réservée aux propriétaires et administrateurs.",
  invalid_body: 'Requête invalide.',
  missing_param: 'Paramètres manquants.',
  invalid_email: 'Email invalide.',
  invalid_role: 'Rôle invalide.',
  resource_not_found: 'Ressource introuvable.',
  resource_has_account: "Cette ressource dispose déjà d'un compte Kanvix.",
  email_is_member: "Cet email appartient déjà à un membre de l'organisation.",
  pending_resource: 'Une invitation est déjà en attente pour cette ressource.',
  pending_email: 'Une invitation est déjà en attente pour cet email.',
  accepted_email: 'Cet email a déjà accepté une invitation dans cette organisation.',
  missing_scope: 'Ce rôle nécessite un chantier et au moins une tâche.',
  task_not_in_project: "Une tâche sélectionnée n'appartient pas au chantier.",
  server_error: 'Une erreur est survenue. Réessayez.',
}

// Charge utile POSTée à la route de création. Fonction PURE : garantit que
// l'email envoyé est exactement normalizeEmail(valeur affichée à l'écran), et
// que le périmètre n'accompagne que le rôle artisan. (LOT 42C-FIX3)
export type InvitePayload = {
  artisanId: string
  email: string
  role: string
  projectId: string | null
  taskIds: string[] | null
}

export function buildInvitePayload(input: {
  artisanId: string
  displayedEmail: string
  role: string
  projectId: string
  taskIds: string[]
}): InvitePayload {
  const isArtisan = input.role === 'artisan'
  return {
    artisanId: input.artisanId,
    email: normalizeEmail(input.displayedEmail),
    role: input.role,
    projectId: isArtisan ? (input.projectId || null) : null,
    taskIds: isArtisan ? (input.taskIds.length ? input.taskIds : null) : null,
  }
}

export type InviteGuardInput = {
  callerRole: string | null | undefined
  email: string
  role: string
  artisanId: string
  /** Ressource déjà liée à un compte (artisans.user_id ou profiles.artisan_id). */
  artisanHasAccount: boolean
  /** Email déjà porté par un membre de l'org (profiles.email normalisé). */
  emailIsMember: boolean
  /** artisan_ids ayant une invitation pending dans l'org. */
  pendingArtisanIds: string[]
  /** emails (normalisés côté appelant ou non) ayant une invitation pending dans l'org. */
  pendingEmails: string[]
  /** emails ayant une invitation accepted dans l'org. */
  acceptedEmails: string[]
  projectId?: string | null
  taskIds?: string[] | null
  /** Pour role='artisan' : projet ∈ org ET toutes les tâches ∈ projet. */
  taskProjectValid?: boolean
}

export type InviteGuardResult =
  | { ok: true; email: string }
  | { ok: false; code: number; error: string }

// Verdict pur (testable sans DB) : autorise ou refuse la création d'invitation.
export function canCreateResourceInvitation(i: InviteGuardInput): InviteGuardResult {
  // Autorisation : owner/admin uniquement (aligné RLS invitations + API /send).
  if (!ADMIN_ROLES.includes(asRole(i.callerRole))) return { ok: false, code: 403, error: 'forbidden' }

  const email = normalizeEmail(i.email)
  if (!EMAIL_RE.test(email)) return { ok: false, code: 400, error: 'invalid_email' }
  if (!RESOURCE_INVITE_ROLES.includes(i.role as Role)) return { ok: false, code: 400, error: 'invalid_role' }

  // Compte déjà existant pour la ressource / l'email.
  if (i.artisanHasAccount) return { ok: false, code: 409, error: 'resource_has_account' }
  if (i.emailIsMember) return { ok: false, code: 409, error: 'email_is_member' }

  // Doublons d'invitation (pending par ressource, pending par email, accepted par email).
  if (i.pendingArtisanIds.includes(i.artisanId)) return { ok: false, code: 409, error: 'pending_resource' }
  if (i.pendingEmails.map(normalizeEmail).includes(email)) return { ok: false, code: 409, error: 'pending_email' }
  if (i.acceptedEmails.map(normalizeEmail).includes(email)) return { ok: false, code: 409, error: 'accepted_email' }

  // Périmètre obligatoire pour un artisan.
  if (i.role === 'artisan') {
    if (!i.projectId || !i.taskIds || i.taskIds.length === 0) return { ok: false, code: 400, error: 'missing_scope' }
    if (i.taskProjectValid === false) return { ok: false, code: 400, error: 'task_not_in_project' }
  }

  return { ok: true, email }
}

// ── Orchestration (testable sans HTTP ni base) ───────────────────────────────
// Collecte les faits via un lecteur injectable puis applique le verdict.
// FAIL-CLOSED : toute lecture en échec ⇒ 500 sans insertion possible.

type Read<T> = Promise<{ ok: true; data: T } | { ok: false }>

export type InviteReader = {
  getCaller(): Read<{ orgId: string | null; role: string | null } | null>
  getArtisan(artisanId: string): Read<{ id: string; org_id: string; user_id: string | null } | null>
  getProfiles(orgId: string): Read<{ email: string | null; artisan_id: string | null }[]>
  getInvitations(orgId: string): Read<{ email: string | null; artisan_id: string | null; status: string }[]>
  validateScope(orgId: string, projectId: string, taskIds: string[]): Read<boolean>
}

export type ResolvedInvite =
  | { ok: true; orgId: string; email: string; role: string; artisanId: string; projectId: string | null; taskIds: string[] | null }
  | { ok: false; code: number; error: string }

export type ResolveInput = {
  artisanId: string
  email: string
  role: string
  projectId?: string | null
  taskIds?: string[] | null
}

export async function resolveResourceInvitation(reader: InviteReader, input: ResolveInput): Promise<ResolvedInvite> {
  const fail500 = { ok: false as const, code: 500, error: 'server_error' }

  const caller = await reader.getCaller()
  if (!caller.ok) return fail500
  const orgId = caller.data?.orgId
  if (!orgId) return { ok: false, code: 403, error: 'forbidden' }

  const art = await reader.getArtisan(input.artisanId)
  if (!art.ok) return fail500
  if (!art.data || art.data.org_id !== orgId) return { ok: false, code: 403, error: 'resource_not_found' }

  const profs = await reader.getProfiles(orgId)
  if (!profs.ok) return fail500
  const email = normalizeEmail(input.email)
  const artisanHasAccount = !!art.data.user_id || profs.data.some(p => p.artisan_id === input.artisanId)
  const emailIsMember = email !== '' && profs.data.some(p => normalizeEmail(p.email) === email)

  const invs = await reader.getInvitations(orgId)
  if (!invs.ok) return fail500
  const pendingArtisanIds = invs.data.filter(r => r.status === 'pending' && r.artisan_id).map(r => r.artisan_id as string)
  const pendingEmails = invs.data.filter(r => r.status === 'pending').map(r => r.email ?? '')
  const acceptedEmails = invs.data.filter(r => r.status === 'accepted').map(r => r.email ?? '')

  const projectId = input.projectId ?? null
  const taskIds = input.taskIds ?? null
  let taskProjectValid = true
  if (input.role === 'artisan' && projectId && taskIds && taskIds.length > 0) {
    const scope = await reader.validateScope(orgId, projectId, taskIds)
    if (!scope.ok) return fail500
    taskProjectValid = scope.data
  }

  const verdict = canCreateResourceInvitation({
    callerRole: caller.data?.role, email, role: input.role, artisanId: input.artisanId,
    artisanHasAccount, emailIsMember, pendingArtisanIds, pendingEmails, acceptedEmails,
    projectId, taskIds, taskProjectValid,
  })
  if (!verdict.ok) return { ok: false, code: verdict.code, error: verdict.error }

  const isArtisan = input.role === 'artisan'
  return {
    ok: true, orgId, email: verdict.email, role: input.role, artisanId: input.artisanId,
    projectId: isArtisan ? projectId : null,
    taskIds: isArtisan ? taskIds : null,
  }
}
