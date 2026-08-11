// ── Permissions — source unique de la matrice de droits applicative ──────────
// LOT 42 (P0 viewer). Garde-fous UI/applicatifs : reflète la matrice cible.
// ⚠️ La sécurité RÉELLE est la RLS (mutations client-side) — voir le candidat
// supabase/migrations/candidates/20260721_viewer_readonly_rls.candidate.sql.
// Ce module empêche l'affichage/déclenchement des actions d'écriture pour les
// rôles non autorisés (défense en profondeur), pas un contrôle serveur.

export type Role = 'owner' | 'admin' | 'manager' | 'site_supervisor' | 'artisan' | 'viewer'

export const INTERNAL_ROLES: Role[] = ['owner', 'admin', 'manager', 'site_supervisor']
export const ADMIN_ROLES: Role[] = ['owner', 'admin']

export function asRole(role: string | null | undefined): Role {
  const r = (role ?? '') as Role
  return (['owner', 'admin', 'manager', 'site_supervisor', 'artisan', 'viewer'] as Role[]).includes(r) ? r : 'viewer'
}

export function isInternal(role: string | null | undefined): boolean {
  return INTERNAL_ROLES.includes(asRole(role))
}

// Le lecteur (viewer) est strictement en lecture seule : aucune écriture.
export function isReadOnly(role: string | null | undefined): boolean {
  return asRole(role) === 'viewer'
}

// Peut écrire quelque chose dans l'app (tout sauf viewer). Grain fin via can().
export function canWrite(role: string | null | undefined): boolean {
  return !isReadOnly(role)
}

// Actions atomiques (grain de la matrice cible).
export type Action =
  | 'chantier.create' | 'chantier.update' | 'chantier.archive'
  | 'task.create' | 'task.update' | 'task.assign'
  | 'planning.edit'
  | 'resource.manage'        // modifier fiche, suspendre/réactiver/archiver, rattacher
  | 'resource.invite'        // inviter / modifier rôle
  | 'photo.upload' | 'photo.review'
  | 'document.manage'
  | 'message.send'
  | 'report.create'
  | 'team.manage'
  | 'settings.access'

const MATRIX: Record<Action, Role[]> = {
  'chantier.create':  INTERNAL_ROLES,
  'chantier.update':  INTERNAL_ROLES,
  'chantier.archive': ADMIN_ROLES.concat('manager'),
  'task.create':      INTERNAL_ROLES,
  'task.update':      INTERNAL_ROLES,          // (artisan = statut de ses tâches → 42E, via RLS scope)
  'task.assign':      INTERNAL_ROLES,
  'planning.edit':    INTERNAL_ROLES,
  'resource.manage':  INTERNAL_ROLES,
  'resource.invite':  ['owner', 'admin', 'manager'],
  'photo.upload':     ['owner', 'admin', 'manager', 'site_supervisor', 'artisan'],
  'photo.review':     INTERNAL_ROLES,
  'document.manage':  INTERNAL_ROLES,
  'message.send':     ['owner', 'admin', 'manager', 'site_supervisor', 'artisan'],
  'report.create':    INTERNAL_ROLES,
  'team.manage':      INTERNAL_ROLES,
  'settings.access':  ADMIN_ROLES.concat('manager'),
}

export function can(role: string | null | undefined, action: Action): boolean {
  return MATRIX[action].includes(asRole(role))
}

// Libellés/descriptions de rôle (affichage fiche ressource — LOT 42B).
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

// ⚠️ Formulations volontairement factuelles : la restriction d'accès par
// périmètre n'est pas encore appliquée au niveau des données. Ne pas décrire un
// cloisonnement technique qui n'existe pas — voir « Périmètre opérationnel ».
export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: 'Accès complet à l\'organisation.',
  admin: 'Administration de l\'organisation.',
  manager: 'Pilotage opérationnel (chantiers, tâches, ressources).',
  site_supervisor: 'Suivi terrain, planning et validation photos.',
  artisan: 'Accès aux fonctions terrain autorisées.',
  viewer: 'Lecture seule des données accessibles.',
}
