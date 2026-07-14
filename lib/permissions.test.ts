import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, canWrite, isReadOnly, isInternal, asRole } from './permissions.ts'

test('viewer is strictly read-only', () => {
  assert.equal(isReadOnly('viewer'), true)
  assert.equal(canWrite('viewer'), false)
  for (const a of ['chantier.create','chantier.update','task.create','task.update','planning.edit','resource.manage','resource.invite','photo.upload','photo.review','document.manage','message.send','report.create','team.manage'] as const) {
    assert.equal(can('viewer', a), false, `viewer must not ${a}`)
  }
})

test('owner can do everything in the matrix', () => {
  assert.equal(canWrite('owner'), true)
  for (const a of ['chantier.create','task.create','resource.manage','resource.invite','photo.review','report.create','team.manage','settings.access'] as const) {
    assert.equal(can('owner', a), true)
  }
})

test('artisan can upload photos and send messages, but not manage', () => {
  assert.equal(canWrite('artisan'), true)
  assert.equal(can('artisan', 'photo.upload'), true)
  assert.equal(can('artisan', 'message.send'), true)
  assert.equal(can('artisan', 'photo.review'), false)
  assert.equal(can('artisan', 'chantier.create'), false)
  assert.equal(can('artisan', 'resource.manage'), false)
})

test('site_supervisor reviews photos but cannot invite', () => {
  assert.equal(can('site_supervisor', 'photo.review'), true)
  assert.equal(can('site_supervisor', 'resource.invite'), false)
})

test('internal roles and unknown role fallback', () => {
  assert.equal(isInternal('manager'), true)
  assert.equal(isInternal('viewer'), false)
  assert.equal(asRole('bogus'), 'viewer') // fail-safe: unknown → least privilege
  assert.equal(canWrite('bogus'), false)
})
