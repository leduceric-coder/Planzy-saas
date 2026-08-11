// ── Rôles — matrice d'attribution (LOT 42D) ──────────────────────────────────
// ⚠️ Défense en profondeur UNIQUEMENT. L'autorité finale est la RPC
// public.update_member_profile (SECURITY DEFINER), qui rejoue ces règles côté
// base. Ce module sert à filtrer les choix proposés et à masquer les actions
// impossibles — il ne protège rien à lui seul.

import { asRole, type Role } from './permissions'

export const ASSIGNABLE_ROLES: Role[] = ['admin', 'manager', 'site_supervisor', 'artisan', 'viewer']

// Codes d'erreur stables, partagés RPC → route → UI.
export type RoleErrorCode =
  | 'non_authentifie' | 'non_autorise' | 'member_not_found' | 'resource_not_linked'
  | 'cannot_change_own_role' | 'cannot_assign_owner' | 'cannot_modify_owner'
  | 'cannot_modify_admin' | 'only_owner_can_manage_admin' | 'dernier_owner'
  | 'artisan_scope_required' | 'artisan_autre_org' | 'artisan_deja_lie' | 'invalid_role'

export const ROLE_ERROR_MESSAGES: Record<RoleErrorCode, string> = {
  non_authentifie: 'Session expirée. Reconnectez-vous.',
  non_autorise: "Vous n'êtes pas autorisé à modifier ce rôle.",
  member_not_found: 'Ce membre est introuvable.',
  resource_not_linked: "Cette ressource n'a pas de compte Kanvix lié.",
  cannot_change_own_role: 'Vous ne pouvez pas modifier votre propre rôle.',
  cannot_assign_owner: "Le rôle Propriétaire ne s'attribue pas depuis cette fiche.",
  cannot_modify_owner: 'Seul un propriétaire peut modifier un propriétaire.',
  cannot_modify_admin: 'Seul un propriétaire peut modifier un administrateur.',
  only_owner_can_manage_admin: 'Seul un propriétaire peut attribuer le rôle Administrateur.',
  dernier_owner: "Impossible : c'est le dernier propriétaire de l'organisation.",
  artisan_scope_required: 'Définissez un périmètre opérationnel (au moins un chantier) avant de passer cette personne en Artisan.',
  artisan_autre_org: "Cet artisan n'appartient pas à votre organisation.",
  artisan_deja_lie: 'Cet artisan est déjà rattaché à un autre compte.',
  invalid_role: 'Rôle invalide.',
}

// Statut HTTP associé à chaque code (contrat de la route).
export const ROLE_ERROR_STATUS: Record<RoleErrorCode, number> = {
  non_authentifie: 401,
  invalid_role: 400,
  artisan_scope_required: 400,
  non_autorise: 403,
  cannot_change_own_role: 403,
  cannot_assign_owner: 403,
  cannot_modify_owner: 403,
  cannot_modify_admin: 403,
  only_owner_can_manage_admin: 403,
  member_not_found: 404,
  resource_not_linked: 404,
  dernier_owner: 409,
  artisan_deja_lie: 409,
  artisan_autre_org: 409,
}

export type AssignCheck = {
  callerRole: string | null | undefined
  targetRole: string | null | undefined
  newRole: string
  isSelf: boolean
}

export type AssignVerdict = { ok: true } | { ok: false; error: RoleErrorCode }

// Miroir exact de la matrice appliquée par la RPC.
export function canAssignRole(i: AssignCheck): AssignVerdict {
  const caller = asRole(i.callerRole)
  const target = asRole(i.targetRole)

  if (i.isSelf) return { ok: false, error: 'cannot_change_own_role' }
  if (caller !== 'owner' && caller !== 'admin') return { ok: false, error: 'non_autorise' }
  if (!ASSIGNABLE_ROLES.includes(i.newRole as Role)) {
    return { ok: false, error: i.newRole === 'owner' ? 'cannot_assign_owner' : 'invalid_role' }
  }
  if (target === 'owner' && caller !== 'owner') return { ok: false, error: 'cannot_modify_owner' }
  if (caller === 'admin' && target === 'admin') return { ok: false, error: 'cannot_modify_admin' }
  if (caller === 'admin' && i.newRole === 'admin') return { ok: false, error: 'only_owner_can_manage_admin' }
  return { ok: true }
}

// Rôles réellement proposables dans le sélecteur, pour un couple caller/cible.
export function assignableRolesFor(callerRole: string | null | undefined, targetRole: string | null | undefined, isSelf: boolean): Role[] {
  return ASSIGNABLE_ROLES.filter(r => canAssignRole({ callerRole, targetRole, newRole: r, isSelf }).ok)
}

// Le bouton « Modifier le rôle » doit-il apparaître ?
export function canOpenRoleEditor(callerRole: string | null | undefined, targetRole: string | null | undefined, isSelf: boolean): boolean {
  return assignableRolesFor(callerRole, targetRole, isSelf).length > 0
}

// Conséquence affichée avant confirmation. Volontairement sobre : tant que la
// restriction par périmètre n'est pas appliquée en base, on ne promet rien.
export function roleChangeConsequence(newRole: Role): string {
  switch (newRole) {
    case 'viewer':          return 'Cette personne passera en lecture seule. Ses rattachements chantier et tâche seront conservés.'
    case 'artisan':         return 'Cette personne accédera aux fonctions terrain. Un périmètre opérationnel doit déjà être défini.'
    case 'manager':         return 'Cette personne disposera de droits de pilotage plus étendus. Ses rattachements existants seront conservés.'
    case 'site_supervisor': return 'Cette personne pourra suivre le terrain et valider les photos. Ses rattachements existants seront conservés.'
    case 'admin':           return "Ce rôle donne accès à l'administration de l'organisation."
    default:                return 'Ses rattachements existants seront conservés.'
  }
}

export function isElevation(newRole: Role): boolean {
  return newRole === 'admin'
}

// Droits principaux affichés dans la fiche (3-4 lignes, pas de matrice éditable).
export const ROLE_HIGHLIGHTS: Record<Role, string[]> = {
  owner:           ['Administration complète', 'Gestion des membres et des rôles', 'Tous les chantiers'],
  admin:           ["Administration de l'organisation", 'Gestion des membres', 'Tous les chantiers'],
  manager:         ['Pilotage des chantiers et tâches', 'Planning et ressources', "Pas d'administration"],
  site_supervisor: ['Suivi terrain', 'Validation des photos', "Pas d'administration"],
  artisan:         ['Accès terrain', 'Photos et messages', 'Planning associé', "Pas d'administration"],
  viewer:          ['Lecture seule', 'Aucune modification', "Pas d'administration"],
}
