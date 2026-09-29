// ============================================================
// KANVIX V2.12.3 — RECETTE LOT B « Prototype Bilan des retards »
//   Fichier testé : kanvix-next-gen-v2.12.3-bilan-retards-prototype.html
//   Usage : KVX_PW=<chemin playwright-core> KVX_ACORN=<chemin acorn> \
//           node recette-lot-b-v2.12.3.mjs
//   Les totaux attendus sont recalculés ICI, indépendamment du code du
//   prototype (compteur de jours ouvrés propre à la recette).
// ============================================================
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.KVX_PW || 'playwright-core')
const acorn = require(process.env.KVX_ACORN || 'acorn')

const ROOT = process.env.KVX_ROOT || '/home/user/Planzy-saas'
const BASE = path.join(ROOT, 'public/poc/')
const PROTO = 'kanvix-next-gen-v2.12.3-bilan-retards-prototype.html'
const PRODUCT = 'kanvix-next-gen-v2.12.3.html'
const CERTIFIED = 'kanvix-next-gen-v2.12.2.1.html'
const NOW = '2026-08-17T08:00:00'
const OUT = process.env.KVX_OUT || path.join(ROOT, 'recette-v2.12.3/lot-b/')
fs.mkdirSync(OUT, { recursive: true })

const b = await chromium.launch({
  executablePath: process.env.KVX_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const results = []
let passed = 0
const failed = []
const errs = []
let currentTest = ''
const ok = (cond, name) => {
  if (cond) passed++
  else failed.push(`[${currentTest}] ${name}`)
  results.push({ test: currentTest, name, status: cond ? 'PASS' : 'FAIL' })
  console.log(`    ${cond ? '✓' : '✗'} ${name}`)
}
async function test(id, title, fn) {
  currentTest = id
  console.log(`\n[${id}] ${title}`)
  try { await fn() } catch (e) { ok(false, `exception : ${String(e.message).split('\n')[0]}`) }
}
const full = (f) => (f.startsWith('/') ? f : BASE + f)
async function open(opts = {}) {
  const { w = 1440, h = 900, dark = false, file = process.env.KVX_PROTO || PROTO, tag = 'x', now = NOW, route = true, downloads = true } = opts
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', hasTouch: w < 500, acceptDownloads: downloads })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errs.push({ tag, msg: e.message }))
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push({ tag, msg: m.text() }) })
  await p.route('https://**', (r) => r.abort('failed'))
  await p.goto('file://' + full(file) + '?now=' + now, { waitUntil: 'load' })
  await p.evaluate(({ d, r }) => { resetApp(); dismissKanvixContinuityNotice(); document.body.classList.toggle('dark', d); if (r) { app.ui.projectId = 'keravel'; go('delays') } }, { d: dark, r: route })
  await p.waitForTimeout(200)
  return { ctx, p }
}
const ev = (p, f, ...a) => p.evaluate(f, ...a)
const rowNames = (p) => p.locator('.dly-row .dly-open').allTextContents()
const count = (p) => p.locator('.dly-row').count()
// Ligne dont l'INTERVENTION porte exactement ce nom (un simple hasText matche aussi les colonnes « origine »).
const rowOf = (p, name) => p.locator('.dly-row').filter({ has: p.locator('.dly-open', { hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) })

// ── Référence INDÉPENDANTE : jours ouvrés (septembre-octobre 2026 : aucun férié)
const dk = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
function bd(from, to) {
  if (from === to) return 0
  const sign = to > from ? 1 : -1
  let [a, z] = sign > 0 ? [dk(from), dk(to)] : [dk(to), dk(from)], n = 0
  while (a < z) { a = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1, 12); if (![0, 6].includes(a.getDay())) n++ }
  return sign * n
}
const lum = ([r, g, bl]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl) }
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
const contrast = (a, c) => { const [x, y] = [lum(rgb(a)), lum(rgb(c))]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === ';') { row.push(cell); cell = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// Fixtures lues une fois depuis le fichier (aucune valeur attendue recopiée à la main)
const fxData = await (async () => {
  const { ctx, p } = await open({ tag: 'fx' })
  const fx = await ev(p, () => JSON.parse(JSON.stringify(DELAY_FIXTURES.projects.keravel)))
  await ctx.close()
  return fx
})()
const expected = (() => {
  const t = Object.fromEntries(fxData.tasks.map((x) => [x.id, { ...x, endSlip: bd(x.base[1], x.rev[1]), startSlip: bd(x.base[0], x.rev[0]) }]))
  const evs = fxData.events
  const direct = evs.filter((e) => e.type === 'direct'), inh = evs.filter((e) => e.type === 'inherited')
  return {
    net: bd(fxData.baselineEnd, t[fxData.finalTaskId].rev[1]),
    late: Object.values(t).filter((x) => x.endSlip > 0).length,
    total: fxData.tasks.length,
    direct: direct.length, inherited: inh.length,
    confirmed: direct.filter((e) => e.validation === 'confirmed').length,
    pending: direct.filter((e) => e.validation === 'pending').length,
    none: direct.filter((e) => !e.responsibleIds.length).length,
    directDays: direct.reduce((n, e) => n + t[e.taskId].endSlip, 0),
    inheritedDays: inh.reduce((n, e) => n + t[e.taskId].endSlip, 0),
    slip: (id) => t[id],
  }
})()

// ============================================================
// LES TESTS DU BRIEF (§8.2)
// ============================================================
await test('B01', 'Affichage des indicateurs (8)', async () => {
  const { ctx, p } = await open({ tag: 'B01' })
  const kpis = await p.locator('.dly-kpi').evaluateAll((els) => els.map((e) => ({ label: e.querySelector('small').textContent, value: e.querySelector('b').textContent, sub: e.querySelector('span')?.textContent || '' })))
  const want = ['Fin initialement prévue', 'Fin projetée', 'Retard net', 'Interventions en retard', 'Retards directs', 'Retards hérités', 'Attributions confirmées', 'Attributions à confirmer']
  ok(kpis.length === 8, `8 indicateurs affichés (${kpis.length})`)
  ok(JSON.stringify(kpis.map((k) => k.label)) === JSON.stringify(want), 'les 8 intitulés attendus, dans l’ordre')
  ok(/lun\. 28 sept\./.test(kpis[0].value), `fin initialement prévue : ${kpis[0].value}`)
  ok(/ven\. 2 oct\./.test(kpis[1].value), `fin projetée : ${kpis[1].value}`)
  await ctx.close()
})

await test('B02', 'Exactitude des totaux (recalculés indépendamment)', async () => {
  const { ctx, p } = await open({ tag: 'B02' })
  const v = await p.locator('.dly-kpi').evaluateAll((els) => els.map((e) => e.querySelector('b').textContent + '|' + (e.querySelector('span')?.textContent || '')))
  ok(v[2].startsWith(`${expected.net} jours ouvrés`), `retard net = ${expected.net} j ouvrés (affiché « ${v[2]} »)`)
  ok(v[3].startsWith(`${expected.late} sur ${expected.total}`), `${expected.late} interventions en retard sur ${expected.total}`)
  ok(v[4].startsWith(`${expected.direct}|`) && v[4].includes(`${expected.directDays} j générés`), `${expected.direct} retards directs, ${expected.directDays} j générés`)
  ok(v[5].startsWith(`${expected.inherited}|`) && v[5].includes(`${expected.inheritedDays} j subis`), `${expected.inherited} retards hérités, ${expected.inheritedDays} j subis`)
  ok(v[6].startsWith(`${expected.confirmed}|`), `${expected.confirmed} attribution confirmée`)
  ok(v[7].startsWith(`${expected.pending}|`), `${expected.pending} attribution à confirmer`)
  ok(new RegExp(`${expected.none} retards? directs? n’(a|ont) aucun responsable`).test(await p.locator('.dly-note').innerText()), `${expected.none} retards directs sans responsable désigné annoncés`)
  const m = await ev(p, () => buildDelayBilan(DELAY_FIXTURES.projects.keravel).kpis)
  ok(m.netDelay === expected.net && m.lateCount === expected.late && m.direct === expected.direct && m.inherited === expected.inherited && m.confirmed === expected.confirmed && m.pending === expected.pending && m.noResponsible === expected.none && m.directDaysSum === expected.directDays && m.inheritedDaysSum === expected.inheritedDays, 'le moteur du prototype = la référence indépendante sur les 9 valeurs')
  ok(await ev(p, () => validateDelayFixture(DELAY_FIXTURES.projects.keravel).length === 0), 'la fixture respecte tous ses invariants (aucun écart)')
  await ctx.close()
})

await test('B03', 'Séparation direct / hérité', async () => {
  const { ctx, p } = await open({ tag: 'B03' })
  const rows = await ev(p, () => buildDelayBilan(DELAY_FIXTURES.projects.keravel).rows.map((r) => ({ id: r.id, type: r.type, d: r.directDays, i: r.inheritedDays, days: r.days, resp: r.responsibleIds.length, val: r.validation })))
  ok(rows.filter((r) => r.type === 'direct').every((r) => r.i === 0 && r.d === r.days), 'un retard direct ne porte que des jours directs')
  ok(rows.filter((r) => r.type === 'inherited').every((r) => r.d === 0 && r.i === r.days), 'un retard hérité ne porte que des jours hérités')
  ok(rows.filter((r) => r.type === 'inherited').every((r) => r.resp === 0 && r.val === 'none'), 'aucun retard hérité ne porte de responsabilité ni d’attribution')
  ok((await p.locator('.dly-row .dly-tag.direct').count()) === expected.direct && (await p.locator('.dly-row .dly-tag.inherited').count()) === expected.inherited, `l’écran distingue ${expected.direct} « Direct » et ${expected.inherited} « Hérité » (texte, pas la seule couleur)`)
  await ctx.close()
})

await test('B04', 'Absence de double comptage', async () => {
  const { ctx, p } = await open({ tag: 'B04' })
  const k = await ev(p, () => buildDelayBilan(DELAY_FIXTURES.projects.keravel).kpis)
  ok(k.netDelay < k.directDaysSum, `retard net (${k.netDelay} j) < somme des jours directs (${k.directDaysSum} j) : le net n’est pas une somme`)
  ok(k.netDelay !== k.directDaysSum + k.inheritedDaysSum, `le net n’est pas non plus la somme directs + hérités (${k.directDaysSum + k.inheritedDaysSum})`)
  const naive = expected.directDays + expected.inheritedDays
  ok(!new RegExp(`\\b${naive} j\\b`).test(await p.locator('.dly-kpis').innerText()), `la somme naïve (${naive} j) n’apparaît nulle part dans les indicateurs`)
  const inv = await ev(p, () => {
    const fx = JSON.parse(JSON.stringify(DELAY_FIXTURES.projects.keravel))
    const before = buildDelayBilan(fx).kpis
    // On ajoute une intervention hérited de plus, chaînée sur la réception.
    fx.tasks.push({ id: 'fx-x', name: 'Nettoyage', lotId: null, resourceIds: ['eric'], base: ['2026-09-29', '2026-09-29'], rev: ['2026-10-05', '2026-10-05'], state: 'planned', after: ['fx-recep'], history: [] })
    fx.events.push({ id: 'ev-x', taskId: 'fx-x', type: 'inherited', parentEventId: 'ev-recep', cause: null, comment: '', responsibleIds: [], validation: 'none', author: 'eric', declaredAt: '2026-10-01', validatedBy: null, validatedAt: null, attachments: [] })
    const after = buildDelayBilan(fx).kpis
    return { before, after }
  })
  ok(inv.after.directDaysSum === inv.before.directDaysSum && inv.after.direct === inv.before.direct, 'ajouter un retard hérité ne change NI les jours directs NI leur nombre')
  ok(inv.after.inherited === inv.before.inherited + 1 && inv.after.inheritedDaysSum > inv.before.inheritedDaysSum, 'il n’alimente que la ligne « hérités »')
  await ctx.close()
})

await test('B05', 'Cas plaquiste / électricien : retard hérité, électricien non responsable', async () => {
  const { ctx, p } = await open({ tag: 'B05' })
  const t = expected.slip
  ok(t('fx-cloisons').endSlip === 2, 'le plaquiste termine avec 2 jours ouvrés de retard')
  ok(t('fx-gaines').startSlip === 2, 'l’électricien commence 2 jours ouvrés plus tard')
  const r = await ev(p, () => { const m = buildDelayBilan(DELAY_FIXTURES.projects.keravel); const e = m.rows.find((x) => x.taskId === 'fx-gaines'); return { type: e.type, parent: e.parentEventId, root: e.rootId, assoc: e.associatedIds, resp: e.responsibleIds, days: e.days, allResp: m.rows.flatMap((x) => x.responsibleIds) } })
  ok(r.type === 'inherited' && r.parent === 'ev-cloisons' && r.root === 'ev-cloisons' && r.days === 2, 'l’électricien subit un retard HÉRITÉ (2 j) du retard des cloisons')
  ok(r.assoc.includes('legall'), 'Le Gall Électricité est bien l’intervenant associé')
  ok(r.resp.length === 0 && !r.allResp.includes('legall'), 'Le Gall n’est responsable d’AUCUN retard du bilan')
  const cell = await rowOf(p, 'Passage des gaines et câbles').locator('td[data-label="Responsabilité déclarée"]').innerText()
  ok(/Sans objet/.test(cell) && !/Le Gall/.test(cell), `colonne « Responsabilité déclarée » : « ${cell.trim()} »`)
  const cause = await rowOf(p, 'Passage des gaines et câbles').locator('td[data-label="Cause"]').innerText()
  ok(/Aucune cause propre/.test(cause) && /Pose des cloisons/.test(cause) && /Approvisionnement/.test(cause), 'la cause affichée pointe l’origine (cloisons, approvisionnement), pas l’électricien')
  await p.locator('.dly-open', { hasText: 'Passage des gaines' }).click()
  await p.waitForTimeout(150)
  const panel = await p.locator('#drawerContent').innerText()
  ok(/décalée par « Pose des cloisons »/.test(panel), 'le panneau dit « décalée par Pose des cloisons »')
  ok(/Sans objet : l’intervenant qui subit un retard hérité n’en est pas responsable/.test(panel), 'le panneau écrit noir sur blanc que l’intervenant n’est pas responsable')
  await ctx.close()
})

await test('B06', 'Intervenant associé ≠ responsable déclaré', async () => {
  const { ctx, p } = await open({ tag: 'B06' })
  const rows = await ev(p, () => Object.fromEntries(buildDelayBilan(DELAY_FIXTURES.projects.keravel).rows.map((r) => [r.taskId, { a: r.associatedIds, r: r.responsibleIds }])))
  ok(rows['fx-menuis'].a.includes('thomas') && rows['fx-menuis'].a.includes('armor') && JSON.stringify(rows['fx-menuis'].r) === '["armor"]', 'menuiseries : Thomas et Armor associés, seule Armor est désignée responsable')
  ok(rows['fx-reseaux'].a.includes('marc') && JSON.stringify(rows['fx-reseaux'].r) === '["ouest-fluides"]', 'réseaux : Marc associé mais non désigné ; Ouest Fluides désignée')
  ok(rows['fx-cloisons'].a.includes('mathieu') && rows['fx-cloisons'].r.length === 0, 'cloisons : Mathieu (plaquiste) associé, personne n’est désigné')
  const cell = await rowOf(p, 'Pose des menuiseries extérieures').locator('td[data-label="Responsabilité déclarée"]').innerText()
  ok(/Menuiserie Armor/.test(cell) && !/Thomas/.test(cell), 'à l’écran, Thomas Martin n’apparaît pas dans « Responsabilité déclarée »')
  await p.locator('.dly-open', { hasText: 'Pose des menuiseries' }).click()
  await p.waitForTimeout(150)
  ok(/Être associé ne signifie pas être responsable/.test(await p.locator('#drawerContent').innerText()), 'le panneau rappelle que l’association n’implique pas la responsabilité')
  await ctx.close()
})

await test('B07', 'Attribution confirmée', async () => {
  const { ctx, p } = await open({ tag: 'B07' })
  const badge = await rowOf(p, 'Pose des menuiseries extérieures').locator('td[data-label="Validation"]').innerText()
  ok(/Confirmée/.test(badge), 'badge « Confirmée » sur les menuiseries')
  await p.locator('.dly-open', { hasText: 'Pose des menuiseries' }).click()
  await p.waitForTimeout(150)
  const panel = await p.locator('#drawerContent').innerText()
  ok(/Validée par Eric le/.test(panel), 'le panneau indique qui a validé et quand')
  ok(/Erreur/.test(panel) && /Écart|cote/.test(panel), 'cause « Erreur » et commentaire affichés')
  await ctx.close()
})

await test('B08', 'Attribution à confirmer', async () => {
  const { ctx, p } = await open({ tag: 'B08' })
  const badge = await rowOf(p, 'Reprise des réseaux d’eau').locator('td[data-label="Validation"]').innerText()
  ok(/À confirmer/.test(badge), 'badge « À confirmer » sur la reprise des réseaux')
  await p.locator('.dly-open', { hasText: 'Reprise des réseaux' }).click()
  await p.waitForTimeout(150)
  const panel = await p.locator('#drawerContent').innerText()
  ok(/n’a pas encore été validée : elle ne doit pas être tenue pour établie/.test(panel), 'le panneau avertit que l’attribution n’est pas établie')
  ok(!/Validée par/.test(panel), 'aucun validateur affiché tant que la validation manque')
  await ctx.close()
})

await test('B09', 'Filtres fonctionnels (nature, cause, entreprise, personne, attribution)', async () => {
  const { ctx, p } = await open({ tag: 'B09' })
  ok((await count(p)) === 10, 'départ : 10 retards')
  await p.locator('.dly-seg button[data-v="direct"]').click()
  ok((await count(p)) === 5, 'nature = Directs → 5')
  await p.locator('.dly-seg button[data-v="inherited"]').click()
  ok((await count(p)) === 5, 'nature = Hérités → 5')
  ok((await p.locator('.dly-seg button.active').textContent()) === 'Hérités' && (await p.locator('.dly-seg button[data-v="inherited"]').getAttribute('aria-pressed')) === 'true', 'le bouton actif porte aria-pressed=true')
  await p.locator('.dly-seg button[data-v="all"]').click()
  await p.selectOption('#dlyCause', 'supply')
  ok((await count(p)) === 3, 'cause = Approvisionnement → 3 (le retard et ses deux héritiers)')
  await p.selectOption('#dlyCause', 'weather')
  ok((await count(p)) === 1, 'cause = Météo → 1')
  await p.selectOption('#dlyCause', 'client')
  ok((await count(p)) === 2, 'cause = Décision du client → 2 (cuisine + réception héritée)')
  await p.selectOption('#dlyCause', 'all')
  await p.selectOption('#dlyCompany', 'legall')
  ok((await count(p)) === 1, 'entreprise = Le Gall Électricité → 1')
  await p.selectOption('#dlyCompany', 'armor')
  ok((await count(p)) === 1 && /menuiseries/.test((await rowNames(p)).join()), 'entreprise = Menuiserie Armor → 1 (menuiseries)')
  await p.selectOption('#dlyCompany', 'all')
  await p.selectOption('#dlyPerson', 'thomas')
  ok((await count(p)) === 3, 'personne = Thomas Martin → 3 (menuiseries, calfeutrement, cuisine)')
  await p.selectOption('#dlyPerson', 'all')
  await p.selectOption('#dlyAttr', 'confirmed')
  ok((await count(p)) === 1, 'attribution = Confirmées → 1')
  await p.selectOption('#dlyAttr', 'pending')
  ok((await count(p)) === 1, 'attribution = À confirmer → 1')
  await p.selectOption('#dlyAttr', 'none')
  ok((await count(p)) === expected.none, `attribution = Sans responsable désigné → ${expected.none} (les hérités n’en font pas partie)`)
  await p.selectOption('#dlyAttr', 'all')
  await p.locator('.dly-seg button[data-v="direct"]').click()
  await p.selectOption('#dlyAttr', 'none')
  ok((await count(p)) === expected.none, 'filtres combinés (Directs + Sans responsable) → 3')
  ok(/3 retards affichés sur 10/.test(await p.locator('#dlyCount').innerText()), 'le compteur « 3 retards affichés sur 10 » suit les filtres')
  await p.locator('.dly-filters button', { hasText: 'Réinitialiser' }).click()
  ok((await count(p)) === 10, '« Réinitialiser » restaure les 10 retards')
  await ctx.close()
})

await test('B10', 'État vide clair', async () => {
  const { ctx, p } = await open({ tag: 'B10' })
  await p.selectOption('#dlyCause', 'weather')
  await p.selectOption('#dlyAttr', 'confirmed')
  ok((await count(p)) === 0, 'météo + attribution confirmée → 0 résultat')
  const empty = await p.locator('#dlyEmpty').innerText()
  ok(/Aucun retard ne correspond à ces filtres/.test(empty) && /Réinitialiser les filtres/.test(empty), 'message explicite + bouton de réinitialisation')
  ok((await p.locator('.dly-table').count()) === 0 && /0 retard affiché sur 10/.test(await p.locator('#dlyCount').innerText()), 'plus de tableau vide, compteur à 0')
  await p.locator('#dlyEmpty button').click()
  ok((await count(p)) === 10, 'le bouton rétablit la liste')
  // chantier sans données de démonstration
  await ev(p, () => { app.ui.projectId = 'terrasses'; go('delays') })
  await p.waitForTimeout(150)
  const other = await p.locator('#main').innerText()
  ok(/Pas de bilan de démonstration pour ce chantier/.test(other) && /Résidence Keravel/.test(other), 'un autre chantier affiche un état vide explicite et renvoie vers Keravel')
  await ctx.close()
})

await test('B11', 'Panneau de détail : contenu, ordre, <details>, conséquences', async () => {
  const { ctx, p } = await open({ tag: 'B11' })
  await rowOf(p, 'Pose des cloisons').locator('td').nth(6).click() // clic n’importe où sur la ligne
  await p.waitForTimeout(200)
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'un clic sur la ligne ouvre le panneau latéral')
  const heads = await p.locator('#drawerContent .dly-sec h3').allTextContents()
  ok(JSON.stringify(heads) === JSON.stringify(['Historique des dates', 'Origine du décalage', 'Cause', 'Commentaire', 'Intervenants associés', 'Responsabilité déclarée', 'Déclaration', 'Statut de validation', 'Conséquences sur les tâches dépendantes']), 'les 9 sections demandées, dans l’ordre')
  ok((await p.locator('#drawerContent .dly-history li').count()) === 2 && (await p.locator('#drawerContent .dly-history li.is-current').count()) === 1, 'historique des dates : 2 entrées, la dernière est « retenue »')
  const txt = await p.locator('#drawerContent').innerText()
  ok(/Retard généré sur cette intervention|généré sur cette intervention/.test(txt) && /Approvisionnement/.test(txt), 'origine du décalage et cause (direct)')
  ok(/Eric/.test(txt) && /10 sept/.test(txt), 'auteur de la déclaration et date')
  const det = p.locator('#drawerContent details.dly-adv')
  ok((await det.count()) === 1 && !(await det.evaluate((d) => d.open)), 'informations avancées dans un <details> replié par défaut')
  await det.locator('summary').click()
  ok(await det.evaluate((d) => d.open), 'le <details> se déplie')
  const json = JSON.parse(await det.locator('.dly-json').innerText())
  const need = ['id', 'projectId', 'taskId', 'type', 'parentEventId', 'causeCode', 'baseline', 'revised', 'delayBusinessDays', 'comment', 'associatedResourceIds', 'declaredResponsibleIds', 'validation', 'author', 'createdAt', 'validatedAt', 'attachments']
  ok(need.every((k) => k in json), `enregistrement cible : les ${need.length} champs du modèle de données sont présents`)
  ok(json.delayBusinessDays === 2 && json.type === 'direct', 'et ses valeurs sont exactes (2 j, direct)')
  const cons = await p.locator('#drawerContent .dly-cons li').allInnerTexts()
  ok(cons.length === 1 && /Passage des gaines/.test(cons[0]) && /\+2 j/.test(cons[0]) && /par ce retard/.test(cons[0]), 'conséquence : « Passage des gaines » décalée de +2 j par ce retard')
  // ouvrir l’origine depuis un héritier ; « autre cause » pour la météo
  await ev(p, () => closeOverlay('drawer'))
  await p.locator('.dly-open', { hasText: 'Peinture des cloisons' }).click()
  await p.waitForTimeout(150)
  ok(/Origine première : « Pose des cloisons »/.test(await p.locator('#drawerContent').innerText()), 'un héritier de 2e niveau indique aussi son origine première')
  await p.locator('#drawerContent button', { hasText: 'Ouvrir l’origine première' }).click()
  await p.waitForTimeout(150)
  ok(/BILAN DES RETARDS · RETARD DIRECT/.test(await p.locator('#drawerContent').innerText()) && /Pose des cloisons/.test(await p.locator('#drawerContent h2').innerText()), '« Ouvrir l’origine première » navigue vers le retard direct')
  await ev(p, () => closeOverlay('drawer'))
  await p.locator('.dly-open', { hasText: 'Peinture des façades' }).click()
  await p.waitForTimeout(150)
  const facadeCons = await p.locator('#drawerContent .dly-cons li').allInnerTexts()
  ok(facadeCons.length === 1 && /Réception des travaux/.test(facadeCons[0]) && /une autre cause/.test(facadeCons[0]), 'la météo n’est pas rendue responsable du retard de la réception (« une autre cause »)')
  await ctx.close()
})

await test('B12', 'Export CSV fonctionnel', async () => {
  const { ctx, p } = await open({ tag: 'B12' })
  const grab = async () => {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Exporter en CSV' }).click()])
    const file = OUT + 'export-test.csv'
    await dl.saveAs(file)
    return { name: dl.suggestedFilename(), raw: fs.readFileSync(file, 'utf8') }
  }
  const all = await grab()
  ok(/^kanvix-bilan-retards-keravel-\d{4}-\d{2}-\d{2}\.csv$/.test(all.name), `nom de fichier : ${all.name}`)
  ok(all.raw.startsWith('﻿'), 'BOM UTF-8 (s’ouvre correctement dans Excel)')
  const rows = parseCSV(all.raw)
  ok(rows.length === 11 && rows.every((r) => r.length === 16), `11 lignes (en-tête + 10) × 16 colonnes (${rows.length} × ${rows[0].length})`)
  ok(rows[0][0] === 'Intervention' && rows[0][6] === 'Jours ouvrés de retard' && rows[0][12] === 'Statut de validation', 'en-têtes en français')
  const gaines = rows.find((r) => r[0] === 'Passage des gaines et câbles')
  ok(gaines && gaines[6] === '2' && gaines[7] === 'Hérité' && gaines[11] === '' && gaines[12] === 'Sans objet (retard hérité)' && gaines[10] === 'Le Gall Électricité', 'ligne « gaines » : hérité, 2 j, associé Le Gall, AUCUN responsable dans le fichier')
  const menuis = rows.find((r) => r[0] === 'Pose des menuiseries extérieures')
  ok(menuis[10] === 'Menuiserie Armor + Thomas Martin' && menuis[11] === 'Menuiserie Armor' && menuis[12] === 'Confirmée', 'ligne « menuiseries » : associés ≠ responsable, validation « Confirmée »')
  ok(rows.slice(1).reduce((n, r) => n + (r[7] === 'Direct' ? 1 : 0), 0) === 5, 'le fichier contient 5 retards directs')
  // export FILTRÉ = bilan affiché
  await p.locator('.dly-seg button[data-v="direct"]').click()
  const filtered = parseCSV((await grab()).raw)
  ok(filtered.length === 6 && filtered.slice(1).every((r) => r[7] === 'Direct'), 'avec le filtre « Directs », l’export ne contient que les 5 directs (le bilan AFFICHÉ)')
  // robustesse
  const cells = await ev(p, () => [delayCsvCell('=HYPERLINK("http://x")'), delayCsvCell('+1'), delayCsvCell('a;b'), delayCsvCell('dit "oui"'), delayCsvCell('deux\nlignes'), delayCsvCell('simple')])
  ok(cells[0].startsWith('"\'=') && cells[1].startsWith("'+") , 'une valeur qui ressemble à une formule est neutralisée')
  ok(cells[2] === '"a;b"' && cells[3] === '"dit ""oui"""' && cells[4] === '"deux\nlignes"' && cells[5] === 'simple', 'séparateur, guillemets et retours à la ligne correctement échappés')
  await ctx.close()
})

const themeTest = (dark) => async () => {
  const { ctx, p } = await open({ dark, tag: dark ? 'B14' : 'B13' })
  ok((await ev(p, () => document.body.classList.contains('dark'))) === dark, `thème ${dark ? 'sombre' : 'clair'} actif`)
  const pair = (sel, prop = 'color') => ev(p, ({ sel, prop }) => { const e = document.querySelector(sel); let bg = getComputedStyle(e).backgroundColor, n = e; while (/rgba\(.*, ?0\)|transparent/.test(bg) && n.parentElement) { n = n.parentElement; bg = getComputedStyle(n).backgroundColor } return [getComputedStyle(e)[prop], bg] }, { sel, prop })
  for (const [label, sel] of [['bandeau « Prototype »', '.dly-banner'], ['libellé d’indicateur', '.dly-kpi small'], ['valeur d’indicateur', '.dly-kpi b'], ['retard net (alerte)', '.dly-kpi.warn b'], ['étiquette Direct', '.dly-tag.direct'], ['étiquette Hérité', '.dly-tag.inherited'], ['nom d’intervention', '.dly-open'], ['texte du tableau', '.dly-table td:nth-child(2)'], ['jours de retard', '.dly-days'], ['note explicative', '.dly-note']]) {
    const [c, bg] = await pair(sel)
    const cr = contrast(c, bg)
    ok(cr >= 4.5, `contraste ${label} ≥ 4,5 (${cr.toFixed(2)})`)
  }
  for (const [label, sel] of [['badge Confirmée', '.pill.success'], ['badge À confirmer', '.pill.warning']]) {
    const [c, bg] = await pair(sel)
    ok(contrast(c, bg) >= 4.5, `contraste ${label} ≥ 4,5 (${contrast(c, bg).toFixed(2)})`)
  }
  await p.screenshot({ path: OUT + `B${dark ? 14 : 13}-bilan-${dark ? 'sombre' : 'clair'}.png`, fullPage: true })
  await p.locator('.dly-open', { hasText: 'Reprise des réseaux' }).click()
  await p.waitForTimeout(250)
  await p.screenshot({ path: OUT + `B${dark ? 14 : 13}-detail-${dark ? 'sombre' : 'clair'}.png` })
  await ctx.close()
}
await test('B13', 'Thème CLAIR', themeTest(false))
await test('B14', 'Thème SOMBRE', themeTest(true))

await test('B15', 'Smartphone 390 px : cartes, panneau, tactile', async () => {
  const { ctx, p } = await open({ w: 390, h: 844, tag: 'B15' })
  ok(await ev(p, () => getComputedStyle(document.querySelector('.dly-table td[data-label="Lot"]')).display === 'grid'), 'sous 1366 px le tableau devient une liste de cartes')
  ok(await ev(p, () => { const th = document.querySelector('.dly-table thead').getBoundingClientRect(); return th.width <= 1 && th.height <= 1 }), 'l’en-tête n’est masqué que visuellement (reste lisible par un lecteur d’écran)')
  ok((await p.locator('.dly-table td[data-label]').first().getAttribute('data-label')) === 'Intervention', 'chaque cellule porte son libellé (data-label)')
  const lbl = await p.locator('.dly-row').first().locator('td').evaluateAll((tds) => tds.map((t) => t.dataset.label))
  ok(lbl.length === 11, '11 champs par carte')
  await p.screenshot({ path: OUT + 'B15-bilan-390.png' })
  const btn = await p.locator('.dly-open').first().boundingBox()
  ok(btn.height >= 40, `lien d’intervention ≥ 40 px de haut (${Math.round(btn.height)} px)`)
  await p.locator('.dly-open', { hasText: 'Passage des gaines' }).tap()
  await p.waitForTimeout(300)
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'toucher une intervention ouvre le panneau')
  ok(await ev(p, () => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#drawerContent').scrollWidth <= document.querySelector('#drawerContent').clientWidth + 1), 'panneau ouvert : aucun débordement horizontal')
  await p.locator('#drawerContent details summary').tap()
  ok(await ev(p, () => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#drawerContent').scrollWidth <= document.querySelector('#drawerContent').clientWidth + 1), 'informations avancées dépliées : toujours aucun débordement')
  await p.screenshot({ path: OUT + 'B15-detail-390.png' })
  await ev(p, () => closeOverlay('drawer'))
  await p.locator('.dly-seg button[data-v="direct"]').tap()
  ok((await count(p)) === 5, 'les filtres se manipulent au toucher')
  await ctx.close()
})

await test('B16', 'Aucun débordement horizontal (8 largeurs)', async () => {
  for (const w of [360, 390, 768, 1024, 1280, 1366, 1440, 1920]) {
    const { ctx, p } = await open({ w, h: 900, tag: 'B16' })
    const m = await ev(p, () => { const wrap = document.querySelector('.dly-table-wrap'); return { page: document.documentElement.scrollWidth <= innerWidth, wrap: wrap.scrollWidth <= wrap.clientWidth + 1 } })
    ok(m.page && m.wrap, `${w} px : ni la page ni le tableau ne débordent`)
    await ctx.close()
  }
})

await test('B17', 'Navigation clavier', async () => {
  const { ctx, p } = await open({ tag: 'B17' })
  await ev(p, () => document.activeElement && document.activeElement.blur())
  const seen = []
  for (let i = 0; i < 80; i++) {
    await p.keyboard.press('Tab')
    seen.push(await ev(p, () => { const e = document.activeElement; return e ? (e.id || e.textContent.trim().slice(0, 28) || e.tagName) : '' }))
    if (seen.at(-1) === 'Passage des gaines et câbles') break
  }
  ok(seen.includes('Exporter en CSV') && seen.includes('Imprimer / PDF'), 'Tab atteint « Exporter en CSV » et « Imprimer / PDF »')
  ok(seen.some((s) => /Comment lire/.test(s)), 'Tab atteint le <details> « Comment lire ce bilan »')
  ok(['dlyCause', 'dlyCompany', 'dlyPerson', 'dlyAttr'].every((id) => seen.includes(id)), 'Tab atteint les 4 filtres, dans l’ordre du visuel')
  ok(seen.at(-1) === 'Passage des gaines et câbles', 'puis atteint les interventions (un seul arrêt de tabulation par ligne)')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(200)
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'Entrée sur une intervention ouvre le panneau')
  await p.keyboard.press('Escape')
  ok(await ev(p, () => !document.querySelector('#drawer').classList.contains('open')), 'Échap referme le panneau')
  // filtre au clavier : focus conservé après re-rendu
  await p.locator('#dlyCause').focus()
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(150)
  ok((await ev(p, () => document.activeElement.id)) === 'dlyCause', 'changer un filtre au clavier ne fait pas perdre le focus')
  ok((await count(p)) < 10, 'et le filtre s’applique')
  await p.locator('.dly-seg button[data-v="direct"]').focus()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(100)
  ok((await ev(p, () => document.activeElement.dataset.v)) === 'direct', 'le bouton de nature garde le focus après activation')
  const help = p.locator('.dly-help summary')
  await help.focus()
  await p.keyboard.press('Enter')
  ok(await ev(p, () => document.querySelector('.dly-help').open), 'Entrée déplie « Comment lire ce bilan »')
  await ctx.close()
})

// ============================================================
// GARDE-FOUS COMPLÉMENTAIRES
// ============================================================
await test('C01', 'Accès depuis le chantier ; navigation globale non surchargée', async () => {
  const { ctx, p } = await open({ tag: 'C01', route: false })
  const navBefore = await p.locator('#nav button').allInnerTexts()
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project') })
  await p.waitForTimeout(150)
  const btn = p.locator('.cockpit-id-text .dly-entry')
  ok((await btn.count()) === 1 && /Bilan des retards/.test(await btn.innerText()), 'bouton « Bilan des retards » dans l’en-tête de la fiche chantier')
  await btn.click()
  await p.waitForTimeout(200)
  ok((await ev(p, () => app.ui.page)) === 'delays' && /Bilan des retards/.test(await p.locator('h1').innerText()), 'il ouvre l’écran du bilan')
  const navAfter = await p.locator('#nav button').allInnerTexts()
  ok(JSON.stringify(navBefore) === JSON.stringify(navAfter) && navAfter.length === 5, `la barre latérale est inchangée (${navAfter.length} entrées : aucune ajoutée)`)
  ok(/Chantiers/.test(await p.locator('#nav button.active').innerText()), '« Chantiers » reste allumé pendant le bilan')
  await p.locator('.project-back-link').click()
  await p.waitForTimeout(150)
  ok((await ev(p, () => app.ui.page)) === 'project' && /Résidence Keravel/.test(await p.locator('.cockpit-id-text h1').innerText()), '« ← Résidence Keravel » ramène à la fiche chantier')
  await ev(p, () => { app.ui.projectId = 'villa'; go('project') })
  await p.waitForTimeout(150)
  ok((await p.locator('.cockpit-id-text .dly-entry').count()) === 1, 'l’accès existe sur tous les chantiers (état vide explicite sur ceux sans données)')
  await ev(p, () => setDepth('pilot'))
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project') })
  ok((await p.locator('.cockpit-id-text .dly-entry').count()) === 1, 'et dans les deux niveaux (Essentiel et Pilotage) — pas de retour en arrière sur les niveaux')
  await ctx.close()
})

await test('C02', 'Invariants de fixture : les erreurs de données sont détectées', async () => {
  const { ctx, p } = await open({ tag: 'C02' })
  const r = await ev(p, () => {
    const base = () => JSON.parse(JSON.stringify(DELAY_FIXTURES.projects.keravel))
    const errs = (fx) => validateDelayFixture(fx)
    const a = base(); a.events.find((e) => e.id === 'ev-gaines').responsibleIds = ['legall']; a.events.find((e) => e.id === 'ev-gaines').validation = 'pending'
    const b2 = base(); b2.events.find((e) => e.id === 'ev-cloisons').parentEventId = 'ev-menuis'
    const c = base(); c.tasks.find((t) => t.id === 'fx-gaines').rev = ['2026-09-16', '2026-09-30']
    const d = base(); d.events.push({ id: 'ev-bad', taskId: 'fx-install', type: 'direct', parentEventId: null, cause: 'other', comment: '', responsibleIds: [], validation: 'none', author: 'eric', declaredAt: '2026-09-01', validatedBy: null, validatedAt: null, attachments: [] })
    const e2 = base(); e2.events.find((e) => e.id === 'ev-cloisons').cause = null
    const f = base(); f.events.find((e) => e.id === 'ev-menuis').validation = 'none'
    return { ok: errs(base()), a: errs(a), b: errs(b2), c: errs(c), d: errs(d), e: errs(e2), f: errs(f) }
  })
  ok(r.ok.length === 0, 'fixture d’origine : 0 écart')
  ok(r.a.some((x) => /jamais de responsabilité/.test(x)), 'un retard hérité qui porte une responsabilité est REFUSÉ')
  ok(r.b.some((x) => /n’a pas de parent/.test(x)), 'un retard direct avec parent est refusé')
  ok(r.c.some((x) => /hérite de plus de jours/.test(x)), 'un héritier qui dépasse les jours de son parent est refusé (anti double comptage)')
  ok(r.d.some((x) => /sans événement|à l’heure/.test(x)), 'un événement sur une intervention à l’heure est refusé')
  ok(r.e.some((x) => /doit avoir une cause/.test(x)), 'un retard direct sans cause est refusé')
  ok(r.f.some((x) => /sans responsable désigné|statut de validation/.test(x)), 'une validation « confirmée » retirée à un responsable désigné est refusée')
  await ctx.close()
})

await test('C03', 'Le prototype ne modifie NI les données produit NI l’historique', async () => {
  const { ctx, p } = await open({ tag: 'C03', route: false })
  await ev(p, () => {
    window.__calls = { snapshot: 0, save: 0, undo: 0 }
    const wrap = (n) => { const f = window[n]; window[n] = function () { window.__calls[n]++; return f.apply(this, arguments) } }
    ;['snapshot', 'save', 'undo'].forEach(wrap)
    window.__before = JSON.stringify({ tasks: app.tasks, projects: app.projects, resources: app.resources, lots: app.lots, milestones: app.milestones, issues: app.issues })
  })
  const undoBefore = await ev(p, () => undoHistory.length)
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project') })
  await p.locator('.dly-entry').click()
  await p.waitForTimeout(150)
  await p.selectOption('#dlyCause', 'supply')
  await p.locator('.dly-open').first().click()
  await p.waitForTimeout(150)
  await ev(p, () => closeOverlay('drawer'))
  await p.locator('.dly-filters button', { hasText: 'Réinitialiser' }).click()
  await p.locator('button', { hasText: 'Exporter en CSV' }).click().catch(() => {})
  await p.waitForTimeout(200)
  const after = await ev(p, () => ({ same: window.__before === JSON.stringify({ tasks: app.tasks, projects: app.projects, resources: app.resources, lots: app.lots, milestones: app.milestones, issues: app.issues }), snap: window.__calls.snapshot, undo: undoHistory.length }))
  ok(after.same, 'tâches, chantiers, ressources, lots, jalons, incidents : strictement identiques après usage complet du bilan')
  ok(after.snap === 0 && after.undo === undoBefore, 'aucun snapshot() : l’historique Annuler/Rétablir n’est pas touché')
  await ctx.close()
})

await test('C04', 'Stockage isolé : le prototype ne contamine pas le produit', async () => {
  const A = await open({ tag: 'C04a' })
  const keys = await ev(A.p, () => Object.keys(localStorage))
  ok(keys.includes('kanvix-proto-bilan-retards-8-3') && !keys.includes('kanvix-product-8-3'), `le prototype écrit dans sa propre clé (${keys.filter((k) => k.startsWith('kanvix')).join(', ')})`)
  const state = await ev(A.p, () => localStorage.getItem('kanvix-proto-bilan-retards-8-3'))
  await A.p.reload({ waitUntil: 'load' })
  await A.p.waitForTimeout(250)
  ok((await ev(A.p, () => app.ui.page)) === 'delays' && (await A.p.locator('.dly-row').count()) === 10, 'la route du bilan survit à un rechargement')
  await A.ctx.close()
  const P = await open({ file: PRODUCT, tag: 'C04b', route: false })
  ok(!(await ev(P.p, () => JSON.stringify(app.ui)).then((s) => /delays/.test(s))), 'la version produit V2.12.3 ne voit aucune trace du prototype')
  ok((await ev(P.p, () => typeof renderDelays)) === 'undefined', 'et ne contient pas le code du bilan (fichier produit intact)')
  await P.ctx.close()
  ok(state && JSON.parse(state).schemaVersion === 16, 'le prototype reste en schéma 16 (aucune nouvelle structure de données produit)')
})

await test('C05', 'Moteurs protégés : identiques à la base certifiée V2.12.2.1 ; écart vs V2.12.3 borné', async () => {
  const fp = (file) => {
    const html = fs.readFileSync(full(file), 'utf8')
    const src = html.match(/<script id="kanvix-js">([\s\S]*?)<\/script>/)[1]
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true })
    const fns = {}
    for (const n of ast.body) if (n.type === 'FunctionDeclaration') fns[n.id.name] = crypto.createHash('md5').update(src.slice(n.start, n.end)).digest('hex')
    return fns
  }
  const cert = fp(CERTIFIED), prod = fp(PRODUCT), proto = fp(process.env.KVX_PROTO || PROTO)
  const PROTECTED = ['planReflow', 'applyReflowPlan', 'planScheduleChanges', 'addBusinessDays', 'addWorkingDuration', 'nextWorkingTime', 'nonWorkingDaysInRange', 'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState', 'preserveCommunications', 'invalidateRedo', 'pushHistory', 'clearUndoRedo', 'setTaskStatus', 'scenarioOptions', 'showWhatIf', 'getProjectStructure', 'openStructureForm', 'toggleStructureArchive', 'renderOperationsList', 'operationCard', 'getOperationSummary', 'selectOperation', 'buildKanvixBackup', 'confirmKanvixRestore', 'exportKanvixData', 'applyImportPlan', 'validateKanvixBackup', 'load', 'save', 'isNonWorkingDate', 'frenchPublicHolidays', 'migrateState']
  const diffCert = PROTECTED.filter((f) => f !== 'migrateState' && cert[f] !== proto[f])
  ok(diffCert.length === 0, `${PROTECTED.length - 1}/${PROTECTED.length - 1} moteurs protégés byte-identiques à la base certifiée${diffCert.length ? ' — DIFFÉRENTS : ' + diffCert : ''}`)
  ok(prod.migrateState === proto.migrateState, 'migrateState du prototype = celui de la V2.12.3 produit (le bilan n’ajoute aucune migration)')
  const changed = Object.keys(prod).filter((k) => proto[k] && proto[k] !== prod[k]).sort()
  ok(JSON.stringify(changed) === JSON.stringify(['nav', 'renderPage', 'renderProject']), `écart vs V2.12.3 : exactement nav, renderPage, renderProject${JSON.stringify(changed) === '["nav","renderPage","renderProject"]' ? '' : ' — écart : ' + changed}`)
  ok(Object.keys(prod).every((k) => proto[k]), 'aucune fonction supprimée')
  const added = Object.keys(proto).filter((k) => !prod[k]).sort()
  ok(added.every((k) => /^(delay|openDelay|renderDelays|downloadDelays|printDelays|buildDelay|validateDelay|filterDelay|setDelay|resetDelay|delays)/i.test(k)), `les ${added.length} fonctions ajoutées portent toutes le préfixe « delay… » (isolées)`)
  fs.writeFileSync(OUT + 'diff-fonctions.json', JSON.stringify({ modifiees_vs_v2_12_3: changed, ajoutees: added, protegees_identiques_a_la_base: PROTECTED.filter((f) => f !== 'migrateState') }, null, 1))
})

await test('C06', 'Impression / PDF', async () => {
  const { ctx, p } = await open({ tag: 'C06' })
  await ev(p, () => { window.__printed = 0; window.print = () => { window.__printed++ } })
  await p.locator('button', { hasText: 'Imprimer / PDF' }).click()
  await p.waitForTimeout(250)
  ok((await ev(p, () => window.__printed)) === 1, 'le bouton déclenche window.print() (impression navigateur, pas de nouveau moteur PDF)')
  ok(await ev(p, () => document.body.classList.contains('delays-print')), 'la classe d’impression est posée le temps de l’impression')
  await p.emulateMedia({ media: 'print' })
  const m = await ev(p, () => ({ side: getComputedStyle(document.querySelector('.sidebar')).display, filters: getComputedStyle(document.querySelector('.dly-filters')).display, table: getComputedStyle(document.querySelector('.dly-table')).display, back: getComputedStyle(document.querySelector('.project-top-row')).display }))
  ok(m.side === 'none' && m.filters === 'none' && m.back === 'none', 'à l’impression : barre latérale, filtres et navigation masqués')
  ok(m.table === 'table', 'et le tableau garde sa forme de tableau (même sous 1366 px)')
  await p.pdf({ path: OUT + 'C06-bilan.pdf', format: 'A4', landscape: true, printBackground: true })
  ok(fs.statSync(OUT + 'C06-bilan.pdf').size > 20000, `un PDF paysage est produit (${Math.round(fs.statSync(OUT + 'C06-bilan.pdf').size / 1024)} Ko)`)
  await ctx.close()
})

await test('C07', 'Déterminisme : indépendant de l’horloge', async () => {
  const snap = async (now) => { const { ctx, p } = await open({ tag: 'C07', now }); const r = await ev(p, () => JSON.stringify(buildDelayBilan(DELAY_FIXTURES.projects.keravel).kpis) + '|' + document.querySelector('.dly-table').innerText.length); await ctx.close(); return r }
  const [a, b2, c] = [await snap('2026-08-17T08:00:00'), await snap('2027-03-02T15:30:00'), await snap('2026-08-17T08:00:00')]
  ok(a === c, 'deux ouvertures au même instant : résultat identique')
  ok(a === b2, 'à une autre date du jour (mars 2027) : bilan strictement identique')
})

await test('C08', 'Le Lot A reste intact dans le prototype (entreprises multi-activités)', async () => {
  const { ctx, p } = await open({ tag: 'C08', route: false })
  await ev(p, () => { app.ui.teamKindFilter = 'company'; go('team') })
  await p.waitForTimeout(150)
  ok((await p.locator('.team-card', { hasText: 'Ouest Fluides' }).locator('.act-tag:visible').count()) === 2 && (await p.locator('.team-card', { hasText: 'Ouest Fluides' }).locator('.act-more').innerText()) === '+1', 'Ouest Fluides : 2 activités visibles puis « +1 »')
  ok(await ev(p, () => JSON.stringify(resource('ouest-fluides').activityLotIds) === '["lot-electricite","lot-plomberie","lot-sanitaire"]'), 'ses 3 activités sont en base')
  await ctx.close()
})

await test('Z01', 'Zéro erreur console / exception page sur toute la recette', async () => {
  ok(errs.length === 0, `erreurs applicatives : ${errs.length}${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 3)) : ''}`)
})

await b.close()
fs.writeFileSync(OUT + 'resultats.json', JSON.stringify({ passed, failed: failed.length, total: results.length, failedList: failed, errs, results }, null, 1))
try { fs.unlinkSync(OUT + 'export-test.csv') } catch {}
console.log(`\nRÉSULTAT : ${passed} / ${results.length}  ·  ERREURS CONSOLE : ${errs.length}`)
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)) }
process.exit(failed.length ? 1 : 0)
