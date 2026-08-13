import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTaskAssignedToArtisan, canEditTaskFields, canUpdateTaskStatus } from './taskPermissions.ts'

const ART = 'artisan-bob'
const OTHER = 'artisan-autre'
// Bob : 1 tâche via ATA, 2 via assigned_to, 11 visibles via chantier seulement.
const T_ATA = { id: 'task-ata' }
const T_DIRECT = { id: 'task-direct', assigned_to: ART }
const T_SITE = { id: 'task-chantier' }
const T_OTHER = { id: 'task-autre', assigned_to: OTHER }
const ATA = ['task-ata']

// ── Affectation réelle ───────────────────────────────────────────────────────

test('a task is the artisan own when linked by ATA or by assigned_to', () => {
  assert.equal(isTaskAssignedToArtisan(T_ATA, ART, ATA), true)
  assert.equal(isTaskAssignedToArtisan(T_DIRECT, ART, ATA), true)
})

test('a task merely visible through the site is not the artisan own', () => {
  assert.equal(isTaskAssignedToArtisan(T_SITE, ART, ATA), false)
})

test('a task assigned to another artisan is never the artisan own', () => {
  assert.equal(isTaskAssignedToArtisan(T_OTHER, ART, ATA), false)
})

test('without an artisan id nothing is owned', () => {
  for (const id of [null, undefined, '']) {
    assert.equal(isTaskAssignedToArtisan(T_DIRECT, id, ATA), false)
    assert.equal(isTaskAssignedToArtisan(T_ATA, id, ATA), false)
  }
})

test('the assigned list is accepted as an array or a Set', () => {
  assert.equal(isTaskAssignedToArtisan(T_ATA, ART, new Set(ATA)), true)
  assert.equal(isTaskAssignedToArtisan(T_SITE, ART, new Set(ATA)), false)
})

// ── Champs administratifs ────────────────────────────────────────────────────

test('only internal roles may edit administrative fields', () => {
  for (const r of ['owner', 'admin', 'manager', 'site_supervisor']) {
    assert.equal(canEditTaskFields(r), true, `${r} must edit fields`)
  }
  for (const r of ['artisan', 'viewer', null, undefined, 'unknown']) {
    assert.equal(canEditTaskFields(r), false, `${r} must not edit fields`)
  }
})

test('an artisan never edits administrative fields, even on his own task', () => {
  assert.equal(canEditTaskFields('artisan'), false)
})

// ── Statut ───────────────────────────────────────────────────────────────────

test('internal roles may update the status of any task', () => {
  for (const r of ['owner', 'admin', 'manager', 'site_supervisor']) {
    for (const t of [T_ATA, T_DIRECT, T_SITE, T_OTHER]) {
      assert.equal(canUpdateTaskStatus(r, t, null, []), true, `${r} on ${t.id}`)
    }
  }
})

test('an artisan updates the status of his own tasks only', () => {
  assert.equal(canUpdateTaskStatus('artisan', T_ATA, ART, ATA), true)
  assert.equal(canUpdateTaskStatus('artisan', T_DIRECT, ART, ATA), true)
  assert.equal(canUpdateTaskStatus('artisan', T_SITE, ART, ATA), false)
  assert.equal(canUpdateTaskStatus('artisan', T_OTHER, ART, ATA), false)
})

test('a viewer never updates a status', () => {
  for (const t of [T_ATA, T_DIRECT, T_SITE]) {
    assert.equal(canUpdateTaskStatus('viewer', t, ART, ATA), false)
  }
})

test('an unknown or missing role falls back to refusing', () => {
  for (const r of [null, undefined, '', 'superadmin']) {
    assert.equal(canUpdateTaskStatus(r, T_DIRECT, ART, ATA), false)
  }
})

test('an artisan with no linked resource updates nothing', () => {
  assert.equal(canUpdateTaskStatus('artisan', T_DIRECT, null, ATA), false)
  assert.equal(canUpdateTaskStatus('artisan', T_ATA, null, ATA), false)
})

test('the UI rule matches the 42E1B figures: 3 of 14 tasks editable', () => {
  const visible = [
    T_ATA, T_DIRECT, { id: 'task-direct-2', assigned_to: ART },
    ...Array.from({ length: 11 }, (_, i) => ({ id: `site-${i}` })),
  ]
  const editable = visible.filter(t => canUpdateTaskStatus('artisan', t, ART, ATA))
  assert.equal(visible.length, 14)
  assert.equal(editable.length, 3)
})
