import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectAtaTaskIds, artisanTaskFilter } from './artisanTaskScope.ts'
import { isTaskAssignedToArtisan } from './taskPermissions.ts'

const ARTISAN = '35f8686d-2b74-49d2-ac83-6865a70f13f7'
const OTHER_ARTISAN = '11111111-1111-4111-8111-111111111111'

type Row = { id: string; assigned_to: string | null }

const T_DIRECT: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000001', assigned_to: ARTISAN }
const T_ATA_ONLY: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000002', assigned_to: null }
const T_BOTH: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000003', assigned_to: ARTISAN }
const T_SITE_ONLY: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000004', assigned_to: null }
const T_OTHER: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000005', assigned_to: OTHER_ARTISAN }
const T_ATA_INACTIVE: Row = { id: 'aaaaaaaa-0000-4000-8000-000000000006', assigned_to: null }

// La requête ATA de app/mobile/page.tsx filtre `is_active = true` : une ATA
// inactive n'arrive donc jamais jusqu'au helper. On modélise ce contrat.
const ATA_ROWS = [{ task_id: T_ATA_ONLY.id }, { task_id: T_BOTH.id }]

/** Modélise le `or=(assigned_to.eq.X,id.in.(...))` évalué par PostgREST. */
function applyFilter(rows: readonly Row[], artisanId: string | null, ataIds: readonly string[]): Row[] {
  return rows.filter(t => isTaskAssignedToArtisan(t, artisanId, ataIds))
}

const ALL = [T_DIRECT, T_ATA_ONLY, T_BOTH, T_SITE_ONLY, T_OTHER, T_ATA_INACTIVE]

// ── Collecte des ids ATA ─────────────────────────────────────────────────────

test('collectAtaTaskIds keeps the task ids of the active assignments', () => {
  assert.deepEqual(collectAtaTaskIds(ATA_ROWS), [T_ATA_ONLY.id, T_BOTH.id])
})

test('collectAtaTaskIds deduplicates and drops unusable rows', () => {
  const rows = [
    { task_id: T_ATA_ONLY.id },
    { task_id: T_ATA_ONLY.id },
    { task_id: null },
    { task_id: 'not-a-uuid' },
    {},
  ]
  assert.deepEqual(collectAtaTaskIds(rows), [T_ATA_ONLY.id])
})

test('collectAtaTaskIds tolerates a null or missing result', () => {
  assert.deepEqual(collectAtaTaskIds(null), [])
  assert.deepEqual(collectAtaTaskIds(undefined), [])
  assert.deepEqual(collectAtaTaskIds([]), [])
})

// ── Construction du filtre ───────────────────────────────────────────────────

test('the filter carries both the direct assignment and the ATA ids', () => {
  const filter = artisanTaskFilter(ARTISAN, collectAtaTaskIds(ATA_ROWS))
  assert.equal(filter, `assigned_to.eq.${ARTISAN},id.in.(${T_ATA_ONLY.id},${T_BOTH.id})`)
})

test('the filter really includes an ATA-only task id', () => {
  const filter = artisanTaskFilter(ARTISAN, collectAtaTaskIds(ATA_ROWS))
  assert.ok(filter?.includes(T_ATA_ONLY.id), 'the ATA-only id must reach the query')
  assert.ok(!ATA_ROWS.some(r => r.task_id === T_SITE_ONLY.id))
})

test('no ATA means no filter, so the caller keeps its equality on assigned_to', () => {
  assert.equal(artisanTaskFilter(ARTISAN, []), null)
  assert.equal(artisanTaskFilter(ARTISAN, collectAtaTaskIds([])), null)
  assert.equal(artisanTaskFilter(ARTISAN, collectAtaTaskIds([{ task_id: null }])), null)
})

test('an empty in() list is never produced', () => {
  for (const rows of [[], [{ task_id: null }], [{ task_id: 'bogus' }]]) {
    const filter = artisanTaskFilter(ARTISAN, collectAtaTaskIds(rows))
    assert.equal(filter, null)
  }
  const filter = artisanTaskFilter(ARTISAN, collectAtaTaskIds(ATA_ROWS))
  assert.ok(!filter?.includes('in.()'))
})

test('an unusable artisan id yields no filter', () => {
  for (const id of [null, undefined, '', 'not-a-uuid']) {
    assert.equal(artisanTaskFilter(id, collectAtaTaskIds(ATA_ROWS)), null)
  }
})

// ── Sémantique des lignes retournées ─────────────────────────────────────────

test('a task assigned only through assigned_to is included', () => {
  const ids = collectAtaTaskIds(ATA_ROWS)
  assert.ok(applyFilter(ALL, ARTISAN, ids).includes(T_DIRECT))
})

test('a task assigned only through an active ATA is included', () => {
  const ids = collectAtaTaskIds(ATA_ROWS)
  assert.ok(applyFilter(ALL, ARTISAN, ids).includes(T_ATA_ONLY))
})

test('a task assigned both ways is returned exactly once', () => {
  const ids = collectAtaTaskIds([...ATA_ROWS, { task_id: T_BOTH.id }])
  const result = applyFilter(ALL, ARTISAN, ids)
  assert.equal(result.filter(t => t.id === T_BOTH.id).length, 1)
  assert.equal(new Set(result.map(t => t.id)).size, result.length)
})

test('a task only visible through the site is excluded', () => {
  const ids = collectAtaTaskIds(ATA_ROWS)
  assert.ok(!applyFilter(ALL, ARTISAN, ids).includes(T_SITE_ONLY))
})

test('a task assigned to another artisan is excluded', () => {
  const ids = collectAtaTaskIds(ATA_ROWS)
  assert.ok(!applyFilter(ALL, ARTISAN, ids).includes(T_OTHER))
})

test('an inactive ATA never reaches the filter, so its task stays excluded', () => {
  // La requête ne remonte que les ATA actives : T_ATA_INACTIVE est absent.
  const ids = collectAtaTaskIds(ATA_ROWS)
  assert.ok(!ids.includes(T_ATA_INACTIVE.id))
  assert.ok(!artisanTaskFilter(ARTISAN, ids)?.includes(T_ATA_INACTIVE.id))
  assert.ok(!applyFilter(ALL, ARTISAN, ids).includes(T_ATA_INACTIVE))
})

test('the perimeter is exactly ATA union assigned_to', () => {
  const result = applyFilter(ALL, ARTISAN, collectAtaTaskIds(ATA_ROWS))
  assert.deepEqual(result.map(t => t.id).sort(), [T_DIRECT.id, T_ATA_ONLY.id, T_BOTH.id].sort())
})

test('falling back to assigned_to alone loses the ATA-only task', () => {
  // Justifie le lot : sans le filtre ATA, la tâche ATA-only est invisible.
  const before = ALL.filter(t => t.assigned_to === ARTISAN)
  const after = applyFilter(ALL, ARTISAN, collectAtaTaskIds(ATA_ROWS))
  assert.ok(!before.includes(T_ATA_ONLY))
  assert.ok(after.includes(T_ATA_ONLY))
  assert.equal(after.length, before.length + 1)
})
