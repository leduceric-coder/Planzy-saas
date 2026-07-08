// Tests unitaires de la logique de navigation centralisée.
// Exécution : `node --test lib/navigation.test.ts` (Node ≥ 22, type-stripping).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NAV_ITEMS,
  navItemsBySection,
  pathMatches,
  isNavItemActive,
  activeNavId,
  canAccessAdmin,
  navBadgeFor,
  type AlertCounts,
} from './navigation.ts'

const NO_ALERTS: AlertCounts = { issuesCritical: 0, tasksLate: 0, tasksBlocked: 0, messagesRecent: 0 }

test('sections exposent les libellés cibles', () => {
  const labels = NAV_ITEMS.map(i => i.label)
  assert.deepEqual(navItemsBySection('pilotage').map(i => i.label), [
    "Vue d'ensemble", 'Chantiers', 'Planning', 'Rapports',
  ])
  assert.deepEqual(navItemsBySection('collaboration').map(i => i.label), [
    'Équipe', 'Documents', 'Messages',
  ])
  // Anciens libellés supprimés
  for (const gone of ['Tableau de bord', 'Équipes & terrain', 'Documents & photos', 'Rapports & alertes']) {
    assert.ok(!labels.includes(gone), `libellé obsolète encore présent : ${gone}`)
  }
})

test('pathMatches : racine en correspondance exacte uniquement', () => {
  assert.equal(pathMatches('/', '/'), true)
  assert.equal(pathMatches('/chantiers', '/'), false)
  assert.equal(pathMatches('/chantiers', '/chantiers'), true)
  assert.equal(pathMatches('/chantiers/abc', '/chantiers'), true)
  assert.equal(pathMatches('/chantiers-archives', '/chantiers'), false) // pas un préfixe de segment
})

test('état actif : parent actif sur les sous-routes', () => {
  assert.equal(activeNavId('/'), 'overview')
  assert.equal(activeNavId('/chantiers'), 'chantiers')
  assert.equal(activeNavId('/chantiers/123'), 'chantiers')
  assert.equal(activeNavId('/planning'), 'planning')
  assert.equal(activeNavId('/rapports'), 'rapports')
  assert.equal(activeNavId('/rapports/global'), 'rapports')
  assert.equal(activeNavId('/equipes'), 'equipe')
  assert.equal(activeNavId('/equipes/nouveau-artisan'), 'equipe')
  assert.equal(activeNavId('/documents'), 'documents')
  assert.equal(activeNavId('/messages'), 'messages')
  assert.equal(activeNavId('/messages?project=1'.split('?')[0]), 'messages')
  assert.equal(activeNavId('/settings'), null) // admin déplacé hors nav principale
})

test('Messages ouvre la side-window (action non-navigante)', () => {
  const messages = NAV_ITEMS.find(i => i.id === 'messages')
  assert.equal(messages?.action, 'open-messages')
  assert.equal(messages?.href, '/messages') // href conservé pour l'état actif
  // Aucune autre entrée n'est une action.
  assert.deepEqual(NAV_ITEMS.filter(i => i.action).map(i => i.id), ['messages'])
})

test('une seule entrée active à la fois', () => {
  for (const path of ['/', '/chantiers/1', '/planning', '/equipes/nouveau-artisan', '/rapports/global']) {
    const active = NAV_ITEMS.filter(i => isNavItemActive(path, i))
    assert.equal(active.length, 1, `${path} → ${active.map(a => a.id).join(',')}`)
  }
})

test('accès administration réservé owner/admin', () => {
  assert.equal(canAccessAdmin('owner'), true)
  assert.equal(canAccessAdmin('admin'), true)
  assert.equal(canAccessAdmin('manager'), false)
  assert.equal(canAccessAdmin('artisan'), false)
  assert.equal(canAccessAdmin(null), false)
  assert.equal(canAccessAdmin(undefined), false)
})

test('badges : tons sémantiques et libellés accessibles', () => {
  // Aucun badge quand rien à signaler (pas de badge pour un simple total).
  assert.equal(navBadgeFor('chantiers', NO_ALERTS), null)
  assert.equal(navBadgeFor('planning', NO_ALERTS), null)
  assert.equal(navBadgeFor('messages', NO_ALERTS), null)
  assert.equal(navBadgeFor('overview', { ...NO_ALERTS, issuesCritical: 5 }), null)

  const critical = navBadgeFor('chantiers', { ...NO_ALERTS, issuesCritical: 2 })
  assert.equal(critical?.tone, 'critical')
  assert.equal(critical?.count, 2)
  assert.match(critical!.label, /2 réserves critiques/)

  const attention = navBadgeFor('planning', { ...NO_ALERTS, tasksLate: 1, tasksBlocked: 2 })
  assert.equal(attention?.tone, 'attention')
  assert.equal(attention?.count, 3)
  assert.match(attention!.label, /retard/)
  assert.match(attention!.label, /bloquée/)

  const info = navBadgeFor('messages', { ...NO_ALERTS, messagesRecent: 4 })
  assert.equal(info?.tone, 'info')
  assert.match(info!.label, /4 messages reçus récemment/)
})
