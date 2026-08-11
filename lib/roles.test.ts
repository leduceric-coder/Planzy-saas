import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAssignRole, assignableRolesFor, canOpenRoleEditor,
  ASSIGNABLE_ROLES, ROLE_ERROR_STATUS, ROLE_ERROR_MESSAGES, ROLE_HIGHLIGHTS,
  roleChangeConsequence, isElevation, type RoleErrorCode,
} from './roles.ts'
import type { Role } from './permissions.ts'

const ALL: Role[] = ['owner', 'admin', 'manager', 'site_supervisor', 'artisan', 'viewer']

function v(callerRole: string | null | undefined, targetRole: Role, newRole: string, isSelf = false) {
  return canAssignRole({ callerRole, targetRole, newRole, isSelf })
}
function err(r: ReturnType<typeof canAssignRole>): RoleErrorCode | null {
  return r.ok ? null : r.error
}

// ── Règle transverse : jamais son propre rôle ────────────────────────────────

test('nobody can change their own role, whatever the roles involved', () => {
  for (const caller of ALL) for (const target of ALL) for (const nr of ASSIGNABLE_ROLES) {
    assert.equal(err(v(caller, target, nr, true)), 'cannot_change_own_role')
  }
})

// ── OWNER ────────────────────────────────────────────────────────────────────

test('owner may assign every assignable role to any non-owner target', () => {
  for (const target of ['admin', 'manager', 'site_supervisor', 'artisan', 'viewer'] as Role[]) {
    for (const nr of ASSIGNABLE_ROLES) {
      assert.equal(v('owner', target, nr).ok, true, `owner -> ${target} -> ${nr}`)
    }
  }
})

test('owner may modify another owner (last-owner guard lives in the RPC)', () => {
  assert.equal(v('owner', 'owner', 'viewer').ok, true)
})

test('owner cannot assign the owner role', () => {
  assert.equal(err(v('owner', 'viewer', 'owner')), 'cannot_assign_owner')
})

// ── ADMIN ────────────────────────────────────────────────────────────────────

test('admin may assign manager/site_supervisor/artisan/viewer to ordinary targets', () => {
  for (const target of ['manager', 'site_supervisor', 'artisan', 'viewer'] as Role[]) {
    for (const nr of ['manager', 'site_supervisor', 'artisan', 'viewer']) {
      assert.equal(v('admin', target, nr).ok, true, `admin -> ${target} -> ${nr}`)
    }
  }
})

test('admin cannot assign owner nor admin', () => {
  assert.equal(err(v('admin', 'viewer', 'owner')), 'cannot_assign_owner')
  assert.equal(err(v('admin', 'viewer', 'admin')), 'only_owner_can_manage_admin')
})

test('admin cannot modify an owner nor another admin', () => {
  assert.equal(err(v('admin', 'owner', 'viewer')), 'cannot_modify_owner')
  assert.equal(err(v('admin', 'admin', 'viewer')), 'cannot_modify_admin')
})

// ── AUTRES RÔLES ─────────────────────────────────────────────────────────────

test('manager, site_supervisor, artisan and viewer can never assign a role', () => {
  for (const caller of ['manager', 'site_supervisor', 'artisan', 'viewer'] as Role[]) {
    for (const target of ALL) for (const nr of ASSIGNABLE_ROLES) {
      assert.equal(err(v(caller, target, nr)), 'non_autorise', `${caller} must not assign`)
    }
  }
})

test('unknown or missing caller role is treated as viewer and refused', () => {
  for (const caller of [null, undefined, '', 'superadmin']) {
    assert.equal(err(v(caller, 'viewer', 'manager')), 'non_autorise')
  }
})

test('an unknown requested role is rejected', () => {
  assert.equal(err(v('owner', 'viewer', 'superadmin')), 'invalid_role')
  assert.equal(err(v('owner', 'viewer', '')), 'invalid_role')
})

// ── Dérivés UI ───────────────────────────────────────────────────────────────

test('assignableRolesFor never offers owner', () => {
  for (const caller of ALL) for (const target of ALL) {
    assert.equal(assignableRolesFor(caller, target, false).includes('owner' as Role), false)
  }
})

test('assignableRolesFor: owner gets the full assignable set, admin gets it minus admin', () => {
  assert.deepEqual(assignableRolesFor('owner', 'viewer', false), ASSIGNABLE_ROLES)
  assert.deepEqual(assignableRolesFor('admin', 'viewer', false), ['manager', 'site_supervisor', 'artisan', 'viewer'])
})

test('canOpenRoleEditor hides the button exactly where the matrix forbids everything', () => {
  assert.equal(canOpenRoleEditor('owner', 'artisan', false), true)
  assert.equal(canOpenRoleEditor('admin', 'artisan', false), true)
  assert.equal(canOpenRoleEditor('admin', 'owner', false), false)
  assert.equal(canOpenRoleEditor('admin', 'admin', false), false)
  assert.equal(canOpenRoleEditor('manager', 'artisan', false), false)
  assert.equal(canOpenRoleEditor('viewer', 'artisan', false), false)
  assert.equal(canOpenRoleEditor('artisan', 'viewer', false), false)
  // cible = soi-même
  assert.equal(canOpenRoleEditor('owner', 'owner', true), false)
})

// ── Contrat d'erreurs ────────────────────────────────────────────────────────

test('every error code has a message and an HTTP status', () => {
  const codes = Object.keys(ROLE_ERROR_MESSAGES) as RoleErrorCode[]
  for (const c of codes) {
    assert.equal(typeof ROLE_ERROR_MESSAGES[c], 'string')
    assert.ok(ROLE_ERROR_MESSAGES[c].length > 0, `${c} needs a message`)
    assert.ok([400, 401, 403, 404, 409].includes(ROLE_ERROR_STATUS[c]), `${c} needs a valid status`)
  }
})

test('status mapping follows the agreed contract', () => {
  assert.equal(ROLE_ERROR_STATUS.non_authentifie, 401)
  assert.equal(ROLE_ERROR_STATUS.invalid_role, 400)
  assert.equal(ROLE_ERROR_STATUS.artisan_scope_required, 400)
  for (const c of ['non_autorise', 'cannot_change_own_role', 'cannot_assign_owner', 'cannot_modify_owner', 'cannot_modify_admin', 'only_owner_can_manage_admin'] as RoleErrorCode[]) {
    assert.equal(ROLE_ERROR_STATUS[c], 403, `${c} must be 403`)
  }
  for (const c of ['member_not_found', 'resource_not_linked'] as RoleErrorCode[]) {
    assert.equal(ROLE_ERROR_STATUS[c], 404, `${c} must be 404`)
  }
  for (const c of ['dernier_owner', 'artisan_deja_lie'] as RoleErrorCode[]) {
    assert.equal(ROLE_ERROR_STATUS[c], 409, `${c} must be 409`)
  }
})

// ── UX ───────────────────────────────────────────────────────────────────────

test('every role has highlights and a consequence sentence', () => {
  for (const r of ALL) {
    assert.ok(ROLE_HIGHLIGHTS[r].length >= 3, `${r} needs highlights`)
    assert.ok(ROLE_HIGHLIGHTS[r].length <= 4, `${r} must stay concise`)
    assert.ok(roleChangeConsequence(r).length > 0)
  }
})

test('only admin is flagged as an elevation', () => {
  assert.equal(isElevation('admin'), true)
  for (const r of ['manager', 'site_supervisor', 'artisan', 'viewer'] as Role[]) {
    assert.equal(isElevation(r), false)
  }
})

test('consequences never promise a scope restriction that is not enforced yet', () => {
  for (const r of ALL) {
    const s = roleChangeConsequence(r).toLowerCase()
    assert.equal(s.includes('limité à son périmètre'), false, `${r} must not promise scope isolation`)
  }
})
