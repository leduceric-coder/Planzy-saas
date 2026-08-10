import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, isValidEmail, canCreateResourceInvitation, type InviteGuardInput } from './invitations.ts'

// Base d'entrée « tout permis » (owner, email neuf, rôle viewer sans périmètre).
function base(overrides: Partial<InviteGuardInput> = {}): InviteGuardInput {
  return {
    callerRole: 'owner',
    email: 'new@example.com',
    role: 'viewer',
    artisanId: 'art-1',
    artisanHasAccount: false,
    emailIsMember: false,
    pendingArtisanIds: [],
    pendingEmails: [],
    acceptedEmails: [],
    projectId: null,
    taskIds: null,
    taskProjectValid: true,
    ...overrides,
  }
}

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('Test@Domaine.com'), 'test@domaine.com')
  assert.equal(normalizeEmail(' test@domaine.com '), 'test@domaine.com')
  assert.equal(normalizeEmail('TEST@DOMAINE.COM '), 'test@domaine.com')
  assert.equal(normalizeEmail(null), '')
  assert.equal(normalizeEmail(undefined), '')
})

test('isValidEmail accepts normal emails and rejects malformed', () => {
  assert.equal(isValidEmail('a@b.co'), true)
  assert.equal(isValidEmail('  A@B.CO '), true)
  assert.equal(isValidEmail('nope'), false)
  assert.equal(isValidEmail('a@b'), false)
  assert.equal(isValidEmail(''), false)
})

test('only owner/admin may create an invitation', () => {
  for (const r of ['manager', 'site_supervisor', 'artisan', 'viewer', null, undefined, 'unknown']) {
    const res = canCreateResourceInvitation(base({ callerRole: r as string | null }))
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.code, 403)
  }
  assert.equal(canCreateResourceInvitation(base({ callerRole: 'owner' })).ok, true)
  assert.equal(canCreateResourceInvitation(base({ callerRole: 'admin' })).ok, true)
})

test('invalid email is rejected server-side', () => {
  const res = canCreateResourceInvitation(base({ email: 'not-an-email' }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 400); assert.equal(res.error, 'invalid_email') }
})

test('invalid role is rejected', () => {
  const res = canCreateResourceInvitation(base({ role: 'superadmin' }))
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.error, 'invalid_role')
})

test('resource with an existing account is blocked (409)', () => {
  const res = canCreateResourceInvitation(base({ artisanHasAccount: true }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 409); assert.equal(res.error, 'resource_has_account') }
})

test('email already a member is blocked (409)', () => {
  const res = canCreateResourceInvitation(base({ emailIsMember: true }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 409); assert.equal(res.error, 'email_is_member') }
})

test('pending invitation for the same resource is blocked (409)', () => {
  const res = canCreateResourceInvitation(base({ pendingArtisanIds: ['art-1'] }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 409); assert.equal(res.error, 'pending_resource') }
})

test('pending invitation for the same email is blocked, case/space-insensitive', () => {
  const res = canCreateResourceInvitation(base({ email: 'New@Example.com', pendingEmails: [' new@example.com '] }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 409); assert.equal(res.error, 'pending_email') }
})

test('accepted invitation for the same email is blocked (409)', () => {
  const res = canCreateResourceInvitation(base({ acceptedEmails: ['NEW@EXAMPLE.COM'] }))
  assert.equal(res.ok, false)
  if (!res.ok) { assert.equal(res.code, 409); assert.equal(res.error, 'accepted_email') }
})

test('revoked/other invitations do not block (not in pending/accepted lists)', () => {
  // Une invitation révoquée n'apparaît ni dans pendingEmails ni dans acceptedEmails.
  const res = canCreateResourceInvitation(base({ pendingEmails: [], acceptedEmails: [] }))
  assert.equal(res.ok, true)
})

test('artisan role requires a project and at least one task', () => {
  const noProject = canCreateResourceInvitation(base({ role: 'artisan', projectId: null, taskIds: ['t1'] }))
  assert.equal(noProject.ok, false)
  if (!noProject.ok) assert.equal(noProject.error, 'missing_scope')

  const noTasks = canCreateResourceInvitation(base({ role: 'artisan', projectId: 'p1', taskIds: [] }))
  assert.equal(noTasks.ok, false)
  if (!noTasks.ok) assert.equal(noTasks.error, 'missing_scope')
})

test('artisan role rejects tasks that are not in the project', () => {
  const res = canCreateResourceInvitation(base({ role: 'artisan', projectId: 'p1', taskIds: ['t1'], taskProjectValid: false }))
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.error, 'task_not_in_project')
})

test('happy path: viewer invitation with a fresh email', () => {
  const res = canCreateResourceInvitation(base({ role: 'viewer' }))
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.email, 'new@example.com')
})

test('happy path: artisan invitation with valid scope, email normalized', () => {
  const res = canCreateResourceInvitation(base({ role: 'artisan', email: '  Fresh@Ex.COM ', projectId: 'p1', taskIds: ['t1', 't2'], taskProjectValid: true }))
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.email, 'fresh@ex.com')
})

// ── Orchestration serveur (resolveResourceInvitation) ────────────────────────
// Prouve : collecte des faits, fail-closed sur toute lecture en échec, et
// qu'aucune charge d'INSERT n'est produite lorsqu'un contrôle bloque.

import { resolveResourceInvitation, type InviteReader } from './invitations.ts'

const ORG = 'org-1'
function reader(over: Partial<InviteReader> = {}): InviteReader {
  return {
    async getCaller() { return { ok: true, data: { orgId: ORG, role: 'owner' } } },
    async getArtisan(id) { return { ok: true, data: { id, org_id: ORG, user_id: null } } },
    async getProfiles() { return { ok: true, data: [] } },
    async getInvitations() { return { ok: true, data: [] } },
    async validateScope() { return { ok: true, data: true } },
    ...over,
  }
}
const ARTISAN_INPUT = { artisanId: 'art-1', email: 'new@example.com', role: 'artisan', projectId: 'p1', taskIds: ['t1'] }

test('resolve: happy path returns an insert payload carrying artisan_id/project_id/task_ids', async () => {
  const r = await resolveResourceInvitation(reader(), ARTISAN_INPUT)
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.artisanId, 'art-1')
    assert.equal(r.projectId, 'p1')
    assert.deepEqual(r.taskIds, ['t1'])
    assert.equal(r.email, 'new@example.com')
    assert.equal(r.orgId, ORG)
  }
})

test('resolve: non-artisan role carries a null scope', async () => {
  const r = await resolveResourceInvitation(reader(), { ...ARTISAN_INPUT, role: 'viewer' })
  assert.equal(r.ok, true)
  if (r.ok) { assert.equal(r.projectId, null); assert.equal(r.taskIds, null) }
})

test('resolve is FAIL-CLOSED: any failing control read yields 500, never a payload', async () => {
  const failing: (keyof InviteReader)[] = ['getCaller', 'getArtisan', 'getProfiles', 'getInvitations', 'validateScope']
  for (const key of failing) {
    const r = await resolveResourceInvitation(
      reader({ [key]: async () => ({ ok: false }) } as Partial<InviteReader>),
      ARTISAN_INPUT,
    )
    assert.equal(r.ok, false, `${key} failure must not produce a payload`)
    if (!r.ok) assert.equal(r.code, 500, `${key} failure must be 500`)
  }
})

test('resolve: artisan from another org is rejected (403)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getArtisan(id) { return { ok: true, data: { id, org_id: 'other-org', user_id: null } } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 403); assert.equal(r.error, 'resource_not_found') }
})

test('resolve: resource already linked to a profile is blocked (409)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getProfiles() { return { ok: true, data: [{ email: 'x@y.z', artisan_id: 'art-1' }] } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 409); assert.equal(r.error, 'resource_has_account') }
})

test('resolve: artisans.user_id set is blocked (409)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getArtisan(id) { return { ok: true, data: { id, org_id: ORG, user_id: 'u-1' } } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.error, 'resource_has_account')
})

test('resolve: email already a member is blocked, case/space-insensitive', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getProfiles() { return { ok: true, data: [{ email: '  NEW@Example.COM ', artisan_id: null }] } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 409); assert.equal(r.error, 'email_is_member') }
})

test('resolve: pending invitation for the same resource is blocked (409)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getInvitations() { return { ok: true, data: [{ email: 'other@x.com', artisan_id: 'art-1', status: 'pending' }] } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 409); assert.equal(r.error, 'pending_resource') }
})

test('resolve: pending invitation for the same email on ANOTHER resource is blocked (409)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async getInvitations() { return { ok: true, data: [{ email: ' NEW@EXAMPLE.com ', artisan_id: 'art-99', status: 'pending' }] } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 409); assert.equal(r.error, 'pending_email') }
})

test('resolve: a revoked invitation does NOT block a new one', async () => {
  const r = await resolveResourceInvitation(
    // getInvitations ne remonte que pending/accepted ; une révoquée est absente.
    reader({ async getInvitations() { return { ok: true, data: [] } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, true)
})

test('resolve: tasks outside the project are rejected (400)', async () => {
  const r = await resolveResourceInvitation(
    reader({ async validateScope() { return { ok: true, data: false } } }),
    ARTISAN_INPUT,
  )
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.code, 400); assert.equal(r.error, 'task_not_in_project') }
})

test('resolve: manager/viewer/artisan callers are refused (403)', async () => {
  for (const role of ['manager', 'site_supervisor', 'viewer', 'artisan']) {
    const r = await resolveResourceInvitation(
      reader({ async getCaller() { return { ok: true, data: { orgId: ORG, role } } } }),
      ARTISAN_INPUT,
    )
    assert.equal(r.ok, false, `${role} must be refused`)
    if (!r.ok) assert.equal(r.code, 403)
  }
})

// ── Invariant affichage → payload (LOT 42C-FIX3) ─────────────────────────────
// Garantit que l'email POSTé est toujours normalizeEmail(valeur affichée),
// jamais l'email pré-rempli de la fiche.

import { buildInvitePayload } from './invitations.ts'

const FICHE_EMAIL = 'durant@roger.fr' // email pré-rempli depuis la fiche ressource

test('payload: displayedEmail -> normalizeEmail -> payload.email', () => {
  for (const displayed of ['JEAN.DUPONT@Test.FR', '  jean.dupont@test.fr  ', ' LEDUC+test@Cervval.COM ']) {
    const p = buildInvitePayload({ artisanId: 'art-1', displayedEmail: displayed, role: 'viewer', projectId: '', taskIds: [] })
    assert.equal(p.email, normalizeEmail(displayed))
    assert.notEqual(p.email, FICHE_EMAIL, 'le payload ne doit jamais retomber sur l\'email de la fiche')
  }
})

test('payload: an edited email never falls back to the fiche email', () => {
  const p = buildInvitePayload({ artisanId: 'art-1', displayedEmail: 'JEAN.DUPONT@Test.FR', role: 'artisan', projectId: 'p1', taskIds: ['t1'] })
  assert.equal(p.email, 'jean.dupont@test.fr')
})

test('payload: scope is carried only for the artisan role', () => {
  const artisan = buildInvitePayload({ artisanId: 'a', displayedEmail: 'x@y.zz', role: 'artisan', projectId: 'p1', taskIds: ['t1', 't2'] })
  assert.equal(artisan.projectId, 'p1')
  assert.deepEqual(artisan.taskIds, ['t1', 't2'])

  const viewer = buildInvitePayload({ artisanId: 'a', displayedEmail: 'x@y.zz', role: 'viewer', projectId: 'p1', taskIds: ['t1'] })
  assert.equal(viewer.projectId, null, 'un rôle non-artisan ne doit pas emporter de périmètre')
  assert.equal(viewer.taskIds, null)
})

test('payload: empty scope on an artisan role is normalized to null (server then blocks)', () => {
  const p = buildInvitePayload({ artisanId: 'a', displayedEmail: 'x@y.zz', role: 'artisan', projectId: '', taskIds: [] })
  assert.equal(p.projectId, null)
  assert.equal(p.taskIds, null)
  // Le serveur refuse ce cas.
  const v = canCreateResourceInvitation(base({ role: 'artisan', email: p.email, projectId: p.projectId, taskIds: p.taskIds }))
  assert.equal(v.ok, false)
  if (!v.ok) assert.equal(v.error, 'missing_scope')
})

test('payload: the fiche email is only sent when it is what is displayed', () => {
  const untouched = buildInvitePayload({ artisanId: 'a', displayedEmail: FICHE_EMAIL, role: 'viewer', projectId: '', taskIds: [] })
  assert.equal(untouched.email, FICHE_EMAIL, 'champ non modifié -> le pré-rempli part bien')
})
