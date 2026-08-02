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
