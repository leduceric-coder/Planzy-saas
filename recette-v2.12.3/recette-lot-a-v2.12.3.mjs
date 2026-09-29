// ============================================================
// KANVIX V2.12.3 — RECETTE LOT A « Entreprises multi-activités »
//   Usage : KVX_PW=<chemin playwright-core> KVX_ACORN=<chemin acorn> \
//           node recette-lot-a.mjs
//   Chaque assertion est comptée individuellement (aucune agrégation).
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
const NEW = process.env.KVX_NEWFILE || 'kanvix-next-gen-v2.12.3.html'
const full = (f) => (f.startsWith('/') ? f : BASE + f)
const OLD = 'kanvix-next-gen-v2.12.2.1.html'
const NOW = '2026-08-17T08:00:00'
const OUT = process.env.KVX_OUT || path.join(ROOT, 'recette-v2.12.3/lot-a/')
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
  const status = cond ? 'PASS' : 'FAIL'
  if (cond) passed++
  else failed.push(`[${currentTest}] ${name}`)
  results.push({ test: currentTest, name, status })
  console.log(`    ${cond ? '✓' : '✗'} ${name}`)
}
async function test(id, title, fn) {
  currentTest = id
  console.log(`\n[${id}] ${title}`)
  try {
    await fn()
  } catch (e) {
    ok(false, `exception : ${String(e.message).split('\n')[0]}`)
  }
}

async function open(opts = {}) {
  const { w = 1440, h = 900, dark = false, file = NEW, tag = 'x' } = opts
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', hasTouch: w < 500, acceptDownloads: true })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errs.push({ tag, msg: e.message }))
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push({ tag, msg: m.text() })
  })
  await p.route('https://**', (r) => r.abort('failed'))
  await p.goto('file://' + full(file) + '?now=' + NOW, { waitUntil: 'load' })
  await p.evaluate((d) => { resetApp(); dismissKanvixContinuityNotice(); document.body.classList.toggle('dark', d) }, dark)
  await p.waitForTimeout(150)
  return { ctx, p }
}
const ev = (p, f, ...a) => p.evaluate(f, ...a)
const company = (p, name) => ev(p, (n) => { const r = app.resources.find((x) => x.name === n); return r ? { id: r.id, type: r.type, activityLotIds: r.activityLotIds, jobTitle: r.jobTitle } : null }, name)
const lotNames = (p, ids) => ev(p, (i) => i.map((id) => lot(id)?.name), ids)

// ── interactions UI réelles ────────────────────────────────────────────────
async function openCompanyForm(p) {
  await ev(p, () => openResourceForm())
  await p.selectOption('#drawerFormEl select[name=type]', 'company')
}
async function fillName(p, name) { await p.fill('#drawerFormEl input[name=name]', name) }
async function pickByTyping(p, text) {
  await p.locator('#actInput').fill(text)
  await p.keyboard.press('Enter')
}
async function submit(p) { await p.locator('#drawerFormEl [type=submit]').click(); await p.waitForTimeout(150) }
const chipLabels = (p) => p.locator('#actChips .act-chip-label').allTextContents()

function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
const contrast = (a, c) => { const [x, y] = [lum(rgb(a)), lum(rgb(c))]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

// ============================================================
// 8.1 — LES 20 TESTS DU BRIEF
// ============================================================
await test('A01', 'Création d’une entreprise avec UNE activité', async () => {
  const { ctx, p } = await open({ tag: 'A01' })
  await openCompanyForm(p)
  await fillName(p, 'Élec Trégor')
  await pickByTyping(p, 'électr')
  ok((await chipLabels(p)).join('|') === 'Électricité', 'la puce « Électricité » est posée')
  await submit(p)
  const c = await company(p, 'Élec Trégor')
  ok(c && c.type === 'company', 'l’entreprise est créée')
  ok(JSON.stringify(c.activityLotIds) === '["lot-electricite"]', 'activityLotIds = ["lot-electricite"] (id stable, pas une chaîne)')
  ok(await ev(p, () => !document.querySelector('#drawer.open')), 'le tiroir se ferme après enregistrement')
  await ctx.close()
})

await test('A02', 'Création avec TROIS activités (saisie clavier)', async () => {
  const { ctx, p } = await open({ tag: 'A02' })
  await openCompanyForm(p)
  await fillName(p, 'Triple Service')
  await pickByTyping(p, 'plomb')
  await pickByTyping(p, 'sanit')
  await pickByTyping(p, 'électr')
  ok((await chipLabels(p)).join('|') === 'Plomberie|Sanitaire|Électricité', 'trois puces, dans l’ordre de saisie')
  await submit(p)
  const c = await company(p, 'Triple Service')
  ok(JSON.stringify(c.activityLotIds) === '["lot-plomberie","lot-sanitaire","lot-electricite"]', 'ids enregistrés dans l’ordre choisi')
  await ctx.close()
})

await test('A03', 'Création SANS activité', async () => {
  const { ctx, p } = await open({ tag: 'A03' })
  await openCompanyForm(p)
  await fillName(p, 'Sans Activité SARL')
  await submit(p)
  const c = await company(p, 'Sans Activité SARL')
  ok(Array.isArray(c.activityLotIds) && c.activityLotIds.length === 0, 'activityLotIds = [] (tableau vide, jamais undefined)')
  await ev(p, (id) => openResource(id), c.id)
  ok((await p.locator('#drawerContent').innerText()).includes('Aucune activité renseignée'), 'la fiche l’indique explicitement')
  await ev(p, () => { closeOverlay('drawer'); app.ui.teamKindFilter = 'company'; go('team') })
  const card = p.locator('.team-card', { hasText: 'Sans Activité SARL' })
  ok((await card.locator('.act-tag').count()) === 0, 'la carte n’affiche aucune étiquette d’activité')
  await ctx.close()
})

await test('A04', 'Modification des activités d’une entreprise existante', async () => {
  const { ctx, p } = await open({ tag: 'A04' })
  await ev(p, () => openResourceForm('armor'))
  ok((await chipLabels(p)).length === 0, 'Menuiserie Armor n’a aucune activité au départ')
  await pickByTyping(p, 'menuiseries')
  await submit(p)
  const c = await ev(p, () => resource('armor').activityLotIds)
  ok(JSON.stringify(c) === '["lot-menuiseries-ext"]', 'l’activité choisie est enregistrée')
  await ctx.close()
})

await test('A05', 'Ajout d’une activité à une entreprise qui en a déjà', async () => {
  const { ctx, p } = await open({ tag: 'A05' })
  await ev(p, () => openResourceForm('legall'))
  ok((await chipLabels(p)).join('|') === 'Électricité', 'Le Gall part de « Électricité »')
  await pickByTyping(p, 'plomb')
  await submit(p)
  ok(JSON.stringify(await ev(p, () => resource('legall').activityLotIds)) === '["lot-electricite","lot-plomberie"]', 'Le Gall exerce maintenant deux activités')
  await ctx.close()
})

await test('A06', 'Suppression d’une activité (bouton ×, puis Retour arrière)', async () => {
  const { ctx, p } = await open({ tag: 'A06' })
  await ev(p, () => openResourceForm('ouest-fluides'))
  await p.locator('#actChips .act-chip', { hasText: 'Plomberie' }).locator('.act-x').click()
  ok((await chipLabels(p)).join('|') === 'Électricité|Sanitaire', '× retire uniquement la puce visée')
  await p.locator('#actInput').focus()
  await p.keyboard.press('Backspace')
  ok((await chipLabels(p)).join('|') === 'Électricité', 'Retour arrière sur champ vide retire la dernière puce')
  await submit(p)
  ok(JSON.stringify(await ev(p, () => resource('ouest-fluides').activityLotIds)) === '["lot-electricite"]', 'la suppression est enregistrée')
  ok((await ev(p, () => lot('lot-plomberie') && lot('lot-sanitaire') ? true : false)), 'les lots du référentiel ne sont PAS supprimés (seule la référence l’est)')
  await ctx.close()
})

await test('A07', 'Prévention des doublons', async () => {
  const { ctx, p } = await open({ tag: 'A07' })
  await ev(p, () => openResourceForm('legall'))
  await p.locator('#actInput').fill('electricite') // sans accent, casse différente
  const list = await p.locator('#actList').innerText()
  ok(/Déjà sélectionnée/.test(list), 'saisir une activité déjà choisie affiche « Déjà sélectionnée »')
  await p.keyboard.press('Enter')
  ok((await chipLabels(p)).length === 1, 'Entrée ne crée pas de doublon')
  // Un nom saisi qui existe déjà dans le référentiel ne doit jamais créer un second lot.
  const before = await ev(p, () => app.lots.length)
  await p.locator('#actInput').fill('  SANITAIRE ')
  await p.keyboard.press('Enter')
  await p.locator('#actInput').fill('sanitaire')
  const opts = await p.locator('#actList .act-opt').allTextContents()
  ok(!opts.some((t) => /Ajouter/.test(t)), 'aucune proposition « Ajouter » quand le nom existe déjà (accents/casse ignorés)')
  await submit(p)
  ok((await ev(p, () => app.lots.length)) === before, 'aucun lot créé : pas de doublon dans le référentiel')
  ok(await ev(p, () => new Set(resource('legall').activityLotIds).size === resource('legall').activityLotIds.length), 'aucun id en double sur l’entreprise')
  // Même doublon injecté directement (données forgées) : dédoublonné à l’enregistrement.
  const dedup = await ev(p, () => {
    const f = new FormData()
    ;['id:lot-peinture', 'id:lot-peinture', 'new:Peinture', 'id:lot-inconnu'].forEach((v) => f.append('activityItems', v))
    const r = { type: 'company' }
    applyCompanyActivities(r, f)
    return r.activityLotIds
  })
  ok(JSON.stringify(dedup) === '["lot-peinture"]', 'applyCompanyActivities dédoublonne et ignore un id inconnu')
  await ctx.close()
})

await test('A08', 'Persistance après RECHARGEMENT', async () => {
  const { ctx, p } = await open({ tag: 'A08' })
  await openCompanyForm(p)
  await fillName(p, 'Persistante & Fils')
  await pickByTyping(p, 'plomb')
  await pickByTyping(p, 'Domotique') // nouveau nom → nouveau lot
  await submit(p)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(250)
  const c = await company(p, 'Persistante & Fils')
  ok(c && c.activityLotIds.length === 2, 'l’entreprise et ses 2 activités survivent au rechargement')
  ok(JSON.stringify(await lotNames(p, c.activityLotIds)) === '["Plomberie","Domotique"]', 'les noms résolus sont corrects (dont le lot créé à la volée)')
  ok(await ev(p, () => app.schemaVersion === 16), 'schemaVersion = 16 après rechargement')
  await ctx.close()
})

// Sauvegarde produite dans A, restaurée dans B (deux vrais contextes)
let backupJson = null
await test('A09', 'Sauvegarde complète puis RESTAURATION (parcours réel)', async () => {
  const A = await open({ tag: 'A09a' })
  await openCompanyForm(A.p)
  await fillName(A.p, 'Sauvegardée SAS')
  await pickByTyping(A.p, 'électr')
  await pickByTyping(A.p, 'Chauffage solaire')
  await submit(A.p)
  backupJson = await ev(A.p, () => JSON.stringify(buildKanvixBackup()))
  const parsed = JSON.parse(backupJson)
  ok(parsed.schemaVersion === 16, 'la sauvegarde porte schemaVersion 16')
  const saved = parsed.state.resources.find((r) => r.name === 'Sauvegardée SAS')
  ok(saved && saved.activityLotIds.length === 2, 'les activités sont DANS la sauvegarde')
  ok(parsed.state.lots.some((l) => l.name === 'Chauffage solaire'), 'le lot créé à la volée est DANS la sauvegarde')
  await A.ctx.close()

  const B = await open({ tag: 'A09b' })
  ok(!(await company(B.p, 'Sauvegardée SAS')), 'le contexte B (état neuf) ne connaît pas cette entreprise')
  await ev(B.p, (j) => readKanvixBackupFile(new File([j], 'backup.json', { type: 'application/json' })), backupJson)
  await B.p.waitForTimeout(250)
  await ev(B.p, () => confirmKanvixRestore())
  await B.p.waitForTimeout(250)
  const c = await company(B.p, 'Sauvegardée SAS')
  ok(c && c.activityLotIds.length === 2, 'après restauration, les 2 activités sont présentes')
  ok(JSON.stringify(await lotNames(B.p, c.activityLotIds)) === '["Électricité","Chauffage solaire"]', 'les noms sont identiques à la source')
  await B.p.reload({ waitUntil: 'load' })
  await B.p.waitForTimeout(200)
  ok((await company(B.p, 'Sauvegardée SAS'))?.activityLotIds.length === 2, 'et elles survivent à un rechargement après restauration')
  await B.ctx.close()
})

await test('A10', 'Export métier puis réimport ; sauvegarde d’une ANCIENNE version', async () => {
  // (a) Export métier « kanvix-portable » : contrat V2.12.2.1 conservé (pas de ressources).
  const A = await open({ tag: 'A10a' })
  await openCompanyForm(A.p)
  await fillName(A.p, 'Exportée SARL')
  await pickByTyping(A.p, 'Fibre optique')
  await submit(A.p)
  await ev(A.p, () => exportKanvixData())
  const exp = JSON.parse(await A.p.locator('#kanvixExportText').inputValue())
  ok(exp.format === 'kanvix-portable' && exp.resources === undefined, 'l’export métier ne transporte pas les ressources (contrat V2.12.2.1 inchangé, documenté)')
  ok(exp.lots.some((l) => l.name === 'Fibre optique'), 'mais il transporte le référentiel de lots, donc le nouveau lot')
  const before = await ev(A.p, () => JSON.stringify(resource('ouest-fluides').activityLotIds))
  await A.ctx.close()
  const B = await open({ tag: 'A10b' })
  const lotsBefore = await ev(B.p, () => app.lots.length)
  await ev(B.p, (j) => importKanvixFile(new File([j], 'exp.json', { type: 'application/json' })), JSON.stringify(exp))
  await B.p.waitForTimeout(300)
  await ev(B.p, () => applyImportNow())
  await B.p.waitForTimeout(300)
  ok((await ev(B.p, () => app.lots.some((l) => l.name === 'Fibre optique'))), 'l’import fusionne le nouveau lot dans le référentiel')
  ok((await ev(B.p, () => app.lots.length)) === lotsBefore + 1, 'un seul lot ajouté, aucun doublon')
  ok((await ev(B.p, () => JSON.stringify(resource('ouest-fluides').activityLotIds))) === before, 'les activités des entreprises existantes sont intactes après import')
  ok((await ev(B.p, () => app.resources.filter((r) => r.type === 'company').every((r) => Array.isArray(r.activityLotIds)))), 'toutes les entreprises gardent un tableau valide')
  await B.ctx.close()
  // (b) Sauvegarde produite par la VRAIE V2.12.2.1 restaurée dans V2.12.3.
  const O = await open({ file: OLD, tag: 'A10c' })
  const oldBackup = await ev(O.p, () => JSON.stringify(buildKanvixBackup()))
  ok(JSON.parse(oldBackup).schemaVersion === 15, 'la sauvegarde source est bien de schéma 15 (V2.12.2.1)')
  await O.ctx.close()
  const N = await open({ tag: 'A10d' })
  await ev(N.p, (j) => readKanvixBackupFile(new File([j], 'old.json', { type: 'application/json' })), oldBackup)
  await N.p.waitForTimeout(250)
  await ev(N.p, () => confirmKanvixRestore())
  await N.p.waitForTimeout(250)
  const st = await ev(N.p, () => ({
    v: app.schemaVersion,
    companies: app.resources.filter((r) => r.type === 'company').map((r) => [r.id, r.activityLotIds]),
    lots: app.lots.length,
  }))
  ok(st.v === 16, 'la sauvegarde V15 est migrée en schéma 16')
  ok(st.companies.every(([, a]) => Array.isArray(a) && a.length === 0), 'toutes les entreprises anciennes arrivent avec [] : aucune activité inventée')
  ok(st.lots === 9, 'le référentiel de la sauvegarde ancienne est respecté (9 lots, « Sanitaire » non injecté)')
  await N.ctx.close()
})

await test('A11', 'Recherche par CHACUNE des activités (page Équipe et palette)', async () => {
  const { ctx, p } = await open({ tag: 'A11' })
  await ev(p, () => go('team'))
  const search = async (q) => {
    await p.locator('#teamSearch').fill(q)
    await p.waitForTimeout(120)
    return (await p.locator('.team-card h3').allTextContents()).map((t) => t.replace(/●.*/, '').trim())
  }
  for (const [q, must] of [['Électricité', ['Ouest Fluides & Énergie', 'Le Gall Électricité']], ['plomberie', ['Ouest Fluides & Énergie']], ['SANITAIRE', ['Ouest Fluides & Énergie']], ['electricite', ['Le Gall Électricité', 'Ouest Fluides & Énergie']]]) {
    const names = await search(q)
    ok(must.every((m) => names.includes(m)), `« ${q} » trouve ${must.join(' + ')} (trouvé : ${names.join(', ')})`)
  }
  ok((await search('Sanitaire')).length === 1, '« Sanitaire » ne retourne QUE l’entreprise qui l’exerce')
  const none = await search('zzzz-introuvable')
  ok(none.length === 0 && /Aucun résultat/.test(await p.locator('.team-list, main, body').first().innerText()), 'une recherche sans résultat affiche un état vide clair')
  await p.locator('text=Effacer la recherche').click()
  ok((await p.locator('.team-card').count()) > 5, '« Effacer la recherche » rétablit la liste complète')
  const pal = await ev(p, () => ['Électricité', 'Plomberie', 'Sanitaire'].map((q) => commands(q).filter((c) => c.label === 'Ouest Fluides & Énergie').length))
  ok(pal.every((n) => n === 1), 'la palette de commandes (Ctrl+K) retrouve l’entreprise par chacune de ses 3 activités')
  await ctx.close()
})

await test('A12', 'Filtre par activité', async () => {
  const { ctx, p } = await open({ tag: 'A12' })
  await ev(p, () => go('team'))
  const names = async () => (await p.locator('.team-card h3').allTextContents()).map((t) => t.replace(/●.*/, '').trim())
  const optionTexts = await p.locator('#teamActivity option').allTextContents()
  ok(optionTexts[0] === 'Toutes les activités' && optionTexts.includes('Sanitaire · 1') && optionTexts.includes('Électricité · 2'), 'le filtre liste les activités utilisées avec leur effectif')
  await p.selectOption('#teamActivity', 'lot-plomberie')
  await p.waitForTimeout(150)
  ok(JSON.stringify(await names()) === '["Ouest Fluides & Énergie"]', 'filtre « Plomberie » : l’entreprise à 3 activités est retournée')
  await p.selectOption('#teamActivity', 'lot-electricite')
  await p.waitForTimeout(150)
  const elec = await names()
  ok(elec.length === 2 && elec.includes('Le Gall Électricité') && elec.includes('Ouest Fluides & Énergie'), 'filtre « Électricité » : les DEUX entreprises qui la possèdent')
  ok(!elec.some((n) => /Thomas|Grue|Camion/.test(n)), 'aucune personne ni matériel dans un filtre d’activité')
  await p.selectOption('#teamActivity', 'all')
  await p.waitForTimeout(150)
  ok((await names()).length > 5, '« Toutes les activités » rétablit la liste')
  // Un filtre persistant pointant sur une activité que plus personne n’exerce est ignoré (jamais invisible).
  const eff = await ev(p, () => { app.ui.teamActivityFilter = 'lot-terrassement'; return teamEffectiveActivityFilter() })
  ok(eff === 'all', 'un filtre devenu sans objet est ignoré au lieu de vider la liste sans explication')
  await ctx.close()
})

await test('A13', 'Affichage compact « +N »', async () => {
  const { ctx, p } = await open({ tag: 'A13' })
  await ev(p, () => go('team'))
  const card = p.locator('.team-card', { hasText: 'Ouest Fluides' })
  const visible = () => card.locator('.act-tag:visible').count()
  ok((await visible()) === 2, 'surface compacte : deux activités visibles')
  const more = card.locator('.act-more')
  ok((await more.textContent()).trim() === '+1', 'puis un bouton « +1 »')
  ok(/Sanitaire/.test(await more.getAttribute('aria-label')), 'le nom masqué est accessible (aria-label) sans surcharger l’écran')
  ok((await more.getAttribute('aria-expanded')) === 'false', 'aria-expanded = false au repos')
  await more.click()
  ok((await visible()) === 3 && (await more.getAttribute('aria-expanded')) === 'true', 'le clic révèle la troisième activité')
  ok(await ev(p, () => !document.querySelector('#drawer.open')), 'et n’ouvre PAS la fiche (clic isolé de la carte)')
  await more.focus()
  await p.keyboard.press('Enter')
  ok((await visible()) === 2 && await ev(p, () => !document.querySelector('#drawer.open')), 'au clavier : Entrée replie, sans ouvrir la fiche')
  ok((await p.locator('.team-card', { hasText: 'Le Gall' }).locator('.act-more').count()) === 0, 'une entreprise à une seule activité n’a pas de « +N »')
  await ev(p, () => openResource('ouest-fluides'))
  ok((await p.locator('#drawerContent .act-tag').count()) === 3 && (await p.locator('#drawerContent .act-more').count()) === 0, 'la fiche affiche les 3 activités, sans « +N »')
  await ctx.close()
})

const themeCheck = async (dark) => {
  const { ctx, p } = await open({ dark, tag: dark ? 'A15' : 'A14' })
  await ev(p, () => { app.ui.teamKindFilter = 'company'; go('team') })
  await p.waitForTimeout(150)
  const tag = await ev(p, () => { const e = document.querySelector('.team-card .act-tag'); const s = getComputedStyle(e); return { c: s.color, bg: s.backgroundColor } })
  ok(contrast(tag.c, tag.bg) >= 4.5, `contraste étiquette ≥ 4,5 (${contrast(tag.c, tag.bg).toFixed(2)})`)
  await ev(p, () => openResourceForm('ouest-fluides'))
  await p.waitForTimeout(150)
  const chip = await ev(p, () => { const e = document.querySelector('.act-chip'); const s = getComputedStyle(e); return { c: s.color, bg: s.backgroundColor } })
  ok(contrast(chip.c, chip.bg) >= 4.5, `contraste puce du formulaire ≥ 4,5 (${contrast(chip.c, chip.bg).toFixed(2)})`)
  await p.locator('#actInput').click()
  const opt = await ev(p, () => { const e = document.querySelector('.act-opt'); const s = getComputedStyle(e); const l = getComputedStyle(document.querySelector('.act-list')); return { c: s.color, bg: l.backgroundColor } })
  ok(contrast(opt.c, opt.bg) >= 4.5, `contraste option de liste ≥ 4,5 (${contrast(opt.c, opt.bg).toFixed(2)})`)
  await p.locator('#actInput').fill('electricite') // déjà choisie : la liste n'offre rien d'autre → message vide
  const emp = await ev(p, () => { const e = document.querySelector('.act-empty'); const l = getComputedStyle(document.querySelector('.act-list')); return { c: getComputedStyle(e).color, bg: l.backgroundColor } })
  ok(contrast(emp.c, emp.bg) >= 4.5, `contraste du message « Déjà sélectionnée » ≥ 4,5 (${contrast(emp.c, emp.bg).toFixed(2)})`)
  const lab = await ev(p, () => { const e = document.querySelector('.act-label'); let n = e, bg = getComputedStyle(n).backgroundColor; while (/rgba\(.*, ?0\)|transparent/.test(bg) && n.parentElement) { n = n.parentElement; bg = getComputedStyle(n).backgroundColor } return { c: getComputedStyle(e).color, bg } })
  ok(contrast(lab.c, lab.bg) >= 4.5, `contraste du libellé « Activités / corps d’état » ≥ 4,5 (${contrast(lab.c, lab.bg).toFixed(2)})`)
  ok((await ev(p, () => document.body.classList.contains('dark'))) === dark, `thème ${dark ? 'sombre' : 'clair'} bien actif`)
  await p.screenshot({ path: OUT + `A${dark ? 15 : 14}-formulaire-${dark ? 'sombre' : 'clair'}.png` })
  await ctx.close()
}
await test('A14', 'Thème CLAIR', () => themeCheck(false))
await test('A15', 'Thème SOMBRE', () => themeCheck(true))

await test('A16', 'Smartphone 390 px', async () => {
  const { ctx, p } = await open({ w: 390, h: 844, tag: 'A16' })
  await ev(p, () => { app.ui.teamKindFilter = 'company'; go('team') })
  await p.waitForTimeout(200)
  ok(await ev(p, () => document.documentElement.scrollWidth <= innerWidth), 'page Équipe : aucun défilement horizontal')
  ok((await p.locator('#teamSearch').boundingBox()).width > 300, 'la recherche occupe la largeur (utilisable au pouce)')
  await p.screenshot({ path: OUT + 'A16-equipe-390.png' })
  await ev(p, () => openResourceForm('ouest-fluides'))
  await p.waitForTimeout(250)
  await p.locator('#actInput').tap()
  await p.waitForTimeout(150)
  ok(await ev(p, () => { const d = document.querySelector('#drawerContent'); return d.scrollWidth <= d.clientWidth + 1 }), 'formulaire : aucun débordement horizontal')
  const h = await p.locator('.act-opt').first().boundingBox()
  ok(h.height >= 44, `option de liste ≥ 44 px de haut (${h.height}px) : cible tactile suffisante`)
  const x = await p.locator('.act-x').first().boundingBox()
  ok(x.width >= 24 && x.height >= 24, `bouton × ≥ 24 px (${x.width}×${x.height}) — seuil WCAG 2.2`)
  await p.locator('.act-opt', { hasText: 'Peinture' }).tap()
  ok((await chipLabels(p)).includes('Peinture'), 'une activité se choisit au toucher')
  await p.locator('.act-chip', { hasText: 'Peinture' }).locator('.act-x').tap()
  ok(!(await chipLabels(p)).includes('Peinture'), 'et se retire au toucher')
  await p.screenshot({ path: OUT + 'A16-formulaire-390.png' })
  await ctx.close()
})

await test('A17', 'Le métier unique des PERSONNES est conservé', async () => {
  const { ctx, p } = await open({ tag: 'A17' })
  const before = await ev(p, () => ({ ...resource('thomas') }))
  await ev(p, () => openResourceForm('thomas'))
  const html = await p.locator('#drawerFormEl').innerText()
  ok(/Poste \/ métier/.test(html), 'le formulaire d’une personne affiche toujours « Poste / métier »')
  ok((await p.locator('#personFields input[name=jobTitle]').inputValue()) === 'Menuisier', 'valeur « Menuisier » conservée')
  ok(await ev(p, () => getComputedStyle(document.querySelector('#companyFields')).display === 'none'), 'les champs entreprise (dont Activités) sont masqués pour une personne')
  await submit(p)
  const after = await ev(p, () => ({ ...resource('thomas') }))
  ok(after.jobTitle === 'Menuisier' && after.activityLotIds === undefined, 'jobTitle intact, aucun activityLotIds ajouté à une personne')
  ok(JSON.stringify({ ...after, activityLotIds: undefined }) === JSON.stringify({ ...before, activityLotIds: undefined }), 'la fiche personne est strictement identique après enregistrement')
  await ev(p, () => openResourceForm('legall'))
  const co = await p.locator('#drawerFormEl').innerText()
  ok(!/Poste \/ métier/.test(await p.locator('#companyFields').innerText()) && /Activités \/ corps d’état/.test(co), 'le formulaire d’une entreprise dit « Activités / corps d’état », pas « Métier »')
  await ev(p, () => openResource('legall'))
  ok(!/Métier/i.test(await p.locator('#drawerContent').innerText()), 'la fiche entreprise ne contient pas le mot « Métier »')
  await ctx.close()
})

// Fabrique un état V2.12.2.1 AUTHENTIQUE en jouant réellement l'ancien fichier.
await test('A18', 'Migration d’un état ANCIEN authentique (jeu réel de V2.12.2.1)', async () => {
  const O = await open({ file: OLD, tag: 'A18a' })
  await ev(O.p, () => openResourceForm())
  await O.p.selectOption('#drawerFormEl select[name=type]', 'company')
  await O.p.fill('#drawerFormEl input[name=name]', 'Ancienne Entreprise')
  await O.p.locator('#drawerFormEl [type=submit]').click()
  await O.p.waitForTimeout(200)
  const persisted = await ev(O.p, () => localStorage.getItem(STORE))
  const oldFacts = await ev(O.p, () => ({ p: app.projects.length, t: app.tasks.length, r: app.resources.length, page: app.ui.page, lots: app.lots.length }))
  ok(JSON.parse(persisted).resources.some((r) => r.name === 'Ancienne Entreprise'), 'l’ancien fichier a bien persisté sa propre entreprise')
  ok(JSON.parse(persisted).schemaVersion === 15, 'état persistant de schéma 15')
  await O.ctx.close()

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((s) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('kanvix-product-8-3', s); localStorage.setItem('__seeded', '1') } }, persisted)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errs.push({ tag: 'A18b', msg: e.message }))
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push({ tag: 'A18b', msg: m.text() }) })
  await p.route('https://**', (r) => r.abort('failed'))
  await p.goto('file://' + full(NEW) + '?now=' + NOW, { waitUntil: 'load' })
  await p.waitForTimeout(300)
  const s = await ev(p, () => ({
    v: app.schemaVersion, p: app.projects.length, t: app.tasks.length, r: app.resources.length, page: app.ui.page, lots: app.lots.length,
    companies: app.resources.filter((r) => r.type === 'company').map((r) => [r.name, r.activityLotIds]),
    filter: app.ui.teamActivityFilter,
  }))
  ok(s.v === 16, 'l’état est migré en schéma 16 à l’ouverture')
  ok(s.p === oldFacts.p && s.t === oldFacts.t && s.r === oldFacts.r, 'chantiers, tâches, ressources : effectifs strictement identiques')
  ok(s.page === oldFacts.page, 'la page courante est conservée')
  ok(s.companies.length === 4 && s.companies.every(([, a]) => Array.isArray(a) && a.length === 0), 'les 4 entreprises (dont celle créée par l’ancienne version) arrivent avec [] — AUCUNE activité de démo injectée')
  ok(s.lots === oldFacts.lots, `le référentiel n’est pas modifié par la migration (${s.lots} lots)`)
  ok(s.filter === 'all', 'le nouveau filtre d’interface est initialisé à « Toutes »')
  await ev(p, () => go('team'))
  ok((await p.locator('.team-card .act-tag').count()) === 0, 'aucune étiquette fantôme affichée')
  await ctx.close()
})

await test('A19', 'Migration DÉFENSIVE et IDEMPOTENTE (11 formes de données anciennes)', async () => {
  const { ctx, p } = await open({ tag: 'A19' })
  const out = await ev(p, () => {
    const base = structuredClone(INITIAL_STATE)
    base.resources.forEach((r) => delete r.activityLotIds)
    const mk = (id, extra) => ({ id, name: id, type: 'company', scope: 'Externe', capacity: 1, status: 'active', ...extra })
    base.resources.push(
      mk('c-single', { activity: 'Électricité' }),
      mk('c-trade', { trade: 'Plombier' }),
      mk('c-str', { activities: 'Électricité, plomberie ; SANITAIRE' }),
      mk('c-arr', { activityLotIds: ['Peinture', 'peinture', '  ', 'lot-peinture'] }),
      mk('c-unknown', { activity: 'Domotique' }),
      mk('c-orphan', { activityLotIds: ['lot-zzz', 'lot-plomberie'] }),
      mk('c-blank', { activity: '   ' }),
      mk('c-junk', { activities: [null, 12, {}, { name: 'Peinture' }] }),
      mk('c-job', { jobTitle: 'Menuisier' }),
      mk('c-many', { activities: Array.from({ length: 30 }, (_, i) => 'Activité ' + i).join(',') }),
      mk('c-none', {}),
      { id: 'p-1', name: 'Personne', type: 'person', scope: 'Interne', capacity: 1, status: 'active', jobTitle: 'Plaquiste' },
    )
    const s1 = migrateState(structuredClone(base))
    const s2 = migrateState(structuredClone(s1))
    const s3 = migrateState(structuredClone(s2))
    const get = (s, id) => s.resources.find((r) => r.id === id)
    return {
      r: Object.fromEntries(['c-single', 'c-trade', 'c-str', 'c-arr', 'c-unknown', 'c-orphan', 'c-blank', 'c-junk', 'c-job', 'c-none'].map((id) => [id, get(s1, id).activityLotIds])),
      many: get(s1, 'c-many').activityLotIds.length,
      legacyGone: ['c-single', 'c-trade', 'c-str', 'c-unknown', 'c-job'].every((id) => ['activity', 'trade', 'activities', 'jobTitle'].every((k) => get(s1, id)[k] === undefined)),
      person: get(s1, 'p-1'),
      lotsBase: base.lots.length, lots1: s1.lots.length,
      newLot: s1.lots.find((l) => l.name === 'Domotique'),
      same12: JSON.stringify([s1.resources, s1.lots]) === JSON.stringify([s2.resources, s2.lots]),
      same23: JSON.stringify([s2.resources, s2.lots]) === JSON.stringify([s3.resources, s3.lots]),
      dupNames: (() => { const k = s1.lots.map((l) => activityKey(l.name)); return k.length - new Set(k).size })(),
    }
  })
  ok(JSON.stringify(out.r['c-single']) === '["lot-electricite"]', 'ancien champ unique « activity » → id du lot')
  ok(JSON.stringify(out.r['c-trade']) === '["lot-plomberie"]', '« trade: Plombier » rapproché du métier indicatif du lot Plomberie')
  ok(JSON.stringify(out.r['c-str']) === '["lot-electricite","lot-plomberie","lot-sanitaire"]', 'chaîne « A, b ; C » découpée, casse/accents normalisés')
  ok(JSON.stringify(out.r['c-arr']) === '["lot-peinture"]', 'noms, doublons de casse et vides → un seul id')
  ok(out.r['c-unknown'].length === 1 && out.newLot && out.r['c-unknown'][0] === out.newLot.id && out.newLot.name === 'Domotique', 'valeur inconnue → un lot « Domotique » est CRÉÉ et référencé (rien n’est perdu)')
  ok(out.lots1 === out.lotsBase + 1 + 20, `lots créés = Domotique + 20 (plafond de c-many) = ${out.lots1 - out.lotsBase} : les 10 noms au-delà du plafond ne créent PAS de lot`)
  ok(JSON.stringify(out.r['c-orphan']) === '["lot-plomberie"]', 'id « lot-… » orphelin retiré, id valide conservé')
  ok(JSON.stringify(out.r['c-blank']) === '[]' && JSON.stringify(out.r['c-none']) === '[]', 'valeur vide / absente → []')
  ok(JSON.stringify(out.r['c-junk']) === '["lot-peinture"]', 'null, nombre, objet vide ignorés ; objet {name} reconnu')
  ok(JSON.stringify(out.r['c-job']) === '["lot-menuiseries-ext"]', 'jobTitle porté par une ENTREPRISE traité comme ancienne activité')
  ok(out.many === 20, 'plafond de 20 activités par entreprise')
  ok(out.legacyGone, 'les anciens champs sont consommés (une activité retirée ne peut pas revenir)')
  ok(out.person.jobTitle === 'Plaquiste' && out.person.activityLotIds === undefined, 'une PERSONNE n’est pas touchée')
  ok(out.same12 && out.same23, 'IDEMPOTENCE : 2e et 3e passages strictement identiques (ressources ET lots)')
  ok(out.dupNames === 0, 'aucun lot en double après migration')
  await ctx.close()
})

await test('A20', 'Undo / Redo (une transaction unique)', async () => {
  const { ctx, p } = await open({ tag: 'A20' })
  const h0 = await ev(p, () => undoHistory.length)
  await openCompanyForm(p)
  await fillName(p, 'Annulable SARL')
  await pickByTyping(p, 'Géothermie')
  await submit(p)
  const has = () => ev(p, () => ({ res: !!app.resources.find((r) => r.name === 'Annulable SARL'), lot: !!app.lots.find((l) => l.name === 'Géothermie'), h: undoHistory.length }))
  let s = await has()
  ok(s.res && s.lot && s.h === h0 + 1, 'création entreprise + nouveau lot = UN seul point d’annulation')
  await ev(p, () => undo())
  s = await has()
  ok(!s.res && !s.lot, 'Annuler retire l’entreprise ET le lot créé avec elle')
  await ev(p, () => redo())
  s = await has()
  ok(s.res && s.lot, 'Rétablir restitue les deux')
  const c = await company(p, 'Annulable SARL')
  ok(JSON.stringify(await lotNames(p, c.activityLotIds)) === '["Géothermie"]', 'l’activité pointe bien sur le lot rétabli')
  // Modification d'activités annulable
  await ev(p, () => openResourceForm('ouest-fluides'))
  await p.locator('#actChips .act-chip', { hasText: 'Sanitaire' }).locator('.act-x').click()
  await submit(p)
  ok(JSON.stringify(await ev(p, () => resource('ouest-fluides').activityLotIds)) === '["lot-electricite","lot-plomberie"]', 'retrait d’une activité enregistré')
  await ev(p, () => undo())
  ok(JSON.stringify(await ev(p, () => resource('ouest-fluides').activityLotIds)) === '["lot-electricite","lot-plomberie","lot-sanitaire"]', 'Annuler restaure les 3 activités')
  await ctx.close()
})

// ============================================================
// GARDE-FOUS COMPLÉMENTAIRES
// ============================================================
await test('B01', 'Combobox : clavier, ARIA, Échap en deux temps, Entrée ne soumet pas', async () => {
  const { ctx, p } = await open({ tag: 'B01' })
  await ev(p, () => openResourceForm('armor'))
  const inp = p.locator('#actInput')
  ok((await inp.getAttribute('role')) === 'combobox' && (await inp.getAttribute('aria-expanded')) === 'false', 'role=combobox, aria-expanded=false au repos')
  ok((await p.locator('#actList').getAttribute('role')) === 'listbox', 'la liste est un listbox')
  await inp.focus()
  ok((await inp.getAttribute('aria-expanded')) === 'true', 'le focus ouvre la liste (aria-expanded=true)')
  await p.keyboard.press('ArrowDown')
  const a1 = await inp.getAttribute('aria-activedescendant')
  await p.keyboard.press('ArrowDown')
  const a2 = await inp.getAttribute('aria-activedescendant')
  ok(a1 && a2 && a1 !== a2, `Flèche bas déplace aria-activedescendant (${a1} → ${a2})`)
  ok((await p.locator('#actList [aria-selected=true]').count()) === 1, 'une seule option est aria-selected')
  await p.keyboard.press('ArrowUp')
  ok((await inp.getAttribute('aria-activedescendant')) === a1, 'Flèche haut revient en arrière')
  await p.keyboard.press('Enter')
  ok((await chipLabels(p)).length === 1, 'Entrée choisit l’option active')
  ok(await ev(p, () => !!document.querySelector('#drawer.open')), 'Entrée ne soumet PAS le formulaire (le tiroir reste ouvert)')
  await inp.fill('xx')
  await p.keyboard.press('Escape')
  ok((await inp.getAttribute('aria-expanded')) === 'false' && await ev(p, () => !!document.querySelector('#drawer.open')), '1er Échap : ferme la liste seulement')
  await p.keyboard.press('Escape')
  ok(await ev(p, () => !document.querySelector('#drawer.open')), '2e Échap : ferme le tiroir')
  await ctx.close()
})

await test('B02', 'Créer un lot depuis le formulaire est ATOMIQUE (annuler ne crée rien)', async () => {
  const { ctx, p } = await open({ tag: 'B02' })
  const n = await ev(p, () => app.lots.length)
  await openCompanyForm(p)
  await fillName(p, 'Jamais créée')
  await pickByTyping(p, 'Nouveau lot fantôme')
  ok((await chipLabels(p)).join('|') === 'Nouveau lot fantôme', 'la puce « nouvelle » est affichée')
  ok((await ev(p, () => app.lots.length)) === n, 'pendant la saisie, le référentiel n’est PAS modifié')
  await p.locator('#drawerFormEl button', { hasText: 'Annuler' }).click()
  ok((await ev(p, () => app.lots.length)) === n && !(await company(p, 'Jamais créée')), 'annuler le formulaire ne crée ni lot ni entreprise')
  await ctx.close()
})

await test('B03', 'Un texte tapé mais non validé n’est pas perdu à l’envoi', async () => {
  const { ctx, p } = await open({ tag: 'B03' })
  await openCompanyForm(p)
  await fillName(p, 'Étourdi SARL')
  await p.locator('#actInput').fill('plomberie')
  await submit(p)
  ok(JSON.stringify((await company(p, 'Étourdi SARL')).activityLotIds) === '["lot-plomberie"]', 'l’activité saisie sans validation est bien enregistrée')
  await ctx.close()
})

await test('B04', 'Cycle de vie du lot : protégé tant qu’une entreprise l’utilise', async () => {
  const { ctx, p } = await open({ tag: 'B04' })
  const r = await ev(p, () => ({ refs: lotReferences('lot-sanitaire'), can: canDeleteLot('lot-sanitaire'), canFree: canDeleteLot('lot-terrassement'), txt: lotUsageText(lotReferences('lot-sanitaire')) }))
  ok(r.refs.resources === 1 && r.can === false, 'un lot porté par une entreprise ne peut pas être supprimé')
  ok(r.canFree === true, 'un lot sans usage reste supprimable')
  ok(/1 entreprise/.test(r.txt), `le message le dit (« ${r.txt} »)`)
  await ev(p, () => deleteLotPrompt('lot-sanitaire'))
  ok(/Suppression impossible/.test(await p.locator('#modalContent').innerText()), 'le dialogue de refus s’affiche')
  await ev(p, () => { closeOverlay('modal'); lot('lot-plomberie').name = 'Plomberie-Chauffage'; go('team') })
  ok(/Plomberie-Chauffage/.test(await p.locator('.team-card', { hasText: 'Ouest Fluides' }).innerText()) || /Plomberie-Chauffage/.test(await p.locator('.team-card', { hasText: 'Ouest Fluides' }).locator('.act-more').getAttribute('aria-label')), 'renommer le lot renomme l’activité partout (un seul catalogue)')
  await ctx.close()
})

await test('B05', 'Formulaires d’affectation et archives', async () => {
  const { ctx, p } = await open({ tag: 'B05' })
  const opt = await ev(p, () => mainResourceSelect(null))
  ok(/Ouest Fluides &amp; Énergie — Électricité, Plomberie \+1/.test(opt), 'sélecteur d’intervenant : « Nom — Électricité, Plomberie +1 »')
  ok(/Le Gall Électricité — Électricité</.test(opt), 'Le Gall affiche son activité unique')
  ok(/Thomas Martin<\/option>/.test(opt), 'une personne garde son libellé habituel (pas de suffixe)')
  const picker = await ev(p, () => complementaryResourcePicker(null, []))
  ok(/Électricité, Plomberie \+1/.test(picker), 'sélecteur de renforts : résumé compact sous le nom')
  ok(await ev(p, () => { const a = commands('ouest')[0]; return a && /Sanitaire|Plomberie|Électricité/.test(a.meta) }), 'la palette affiche les activités en méta')
  await ctx.close()
})

await test('B06', 'Aucun assignation bloquée par une activité « non concordante »', async () => {
  const { ctx, p } = await open({ tag: 'B06' })
  const r = await ev(p, () => ({ can: canAssignResource('coloris', 'main'), canFluides: canAssignResource('ouest-fluides', 'main') }))
  ok(r.can === true && r.canFluides === true, 'affecter une entreprise à une tâche hors de ses activités reste permis (§4.6)')
  await ctx.close()
})

// ============================================================
// MOTEURS PROTÉGÉS — comparaison programmatique base ↔ V2.12.3
// ============================================================
await test('P01', 'Moteurs protégés : empreintes identiques à la base certifiée V2.12.2.1', async () => {
  const fp = (file) => {
    const html = fs.readFileSync(full(file), 'utf8')
    const src = html.match(/<script id="kanvix-js">([\s\S]*?)<\/script>/)[1]
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true })
    const fns = {}
    for (const n of ast.body) if (n.type === 'FunctionDeclaration') fns[n.id.name] = crypto.createHash('md5').update(src.slice(n.start, n.end)).digest('hex')
    return fns
  }
  const a = fp(OLD), n = fp(NEW)
  const PROTECTED = ['planReflow', 'applyReflowPlan', 'planScheduleChanges', 'addBusinessDays', 'addWorkingDuration', 'nextWorkingTime', 'nonWorkingDaysInRange', 'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState', 'preserveCommunications', 'invalidateRedo', 'pushHistory', 'clearUndoRedo', 'setTaskStatus', 'scenarioOptions', 'showWhatIf', 'getProjectStructure', 'openStructureForm', 'toggleStructureArchive', 'renderOperationsList', 'operationCard', 'getOperationSummary', 'selectOperation', 'buildKanvixBackup', 'confirmKanvixRestore', 'exportKanvixData', 'applyImportPlan', 'validateKanvixBackup', 'load', 'save']
  const missing = PROTECTED.filter((f) => !a[f])
  ok(missing.length === 0, `les ${PROTECTED.length} fonctions protégées existent dans la base${missing.length ? ' — absentes : ' + missing : ''}`)
  const diff = PROTECTED.filter((f) => a[f] && a[f] !== n[f])
  ok(diff.length === 0, `${PROTECTED.length - diff.length}/${PROTECTED.length} fonctions protégées byte-identiques${diff.length ? ' — DIFFÉRENTES : ' + diff : ''}`)
  const changed = Object.keys(a).filter((k) => n[k] && n[k] !== a[k]).sort()
  const removed = Object.keys(a).filter((k) => !n[k])
  const EXPECTED = ['migrateState', 'resourceFilterOptions', 'lotReferences', 'canDeleteLot', 'renderTeam', 'teamCard', 'resourceRow', 'projectTeamCard', 'mainResourceSelect', 'complementaryResourcePicker', 'openResource', 'renderLotsManager', 'deleteLotPrompt', 'openResourceForm', 'commands'].sort()
  ok(JSON.stringify(changed) === JSON.stringify(EXPECTED), `exactement ${EXPECTED.length} fonctions modifiées, toutes attendues${JSON.stringify(changed) === JSON.stringify(EXPECTED) ? '' : ' — écart : ' + changed}`)
  ok(removed.length === 0, 'aucune fonction supprimée')
  fs.writeFileSync(OUT + 'diff-fonctions.json', JSON.stringify({ modifiees: changed, ajoutees: Object.keys(n).filter((k) => !a[k]).sort(), supprimees: removed, protegees_identiques: PROTECTED }, null, 1))
})

await test('P02', 'Moteur « Préparer un décalage » : plans identiques base ↔ V2.12.3 sur un cas réel', async () => {
  const probe = async (file) => {
    const { ctx, p } = await open({ file, tag: 'P02' })
    const r = await ev(p, () => {
      const src = app.tasks.find((x) => x.status !== 'done' && getTaskSuccessors(x.id).length > 0)
      const newEnd = localDateTime(new Date(+date(src.end) + 2 * DAY))
      const plan = planReflow(src.id, { [src.id]: { end: newEnd } })
      const changes = planScheduleChanges(src.id, src.start, newEnd)
      return {
        src: src.id,
        plan: JSON.stringify(plan),
        changes: JSON.stringify(changes),
        n: plan.shifts.length + plan.doing.length + plan.done.length,
        dates: JSON.stringify(app.tasks.map((x) => [x.id, x.start, x.end, x.status])),
        cal: JSON.stringify([addBusinessDays('2026-08-14T08:00', 3), nextWorkingTime('2026-08-15T09:00')]),
      }
    })
    await ctx.close()
    return r
  }
  const a = await probe(OLD), n = await probe(NEW)
  ok(a.n > 0, `le cas de décalage est réel : ${a.n} intervention(s) touchée(s) par la cascade`)
  ok(a.plan === n.plan, 'planReflow : plan strictement identique (décalages, en cours, terminées)')
  ok(a.changes === n.changes, 'planScheduleChanges : changements strictement identiques')
  ok(a.dates === n.dates, 'dates de toutes les tâches identiques à l’ouverture')
  ok(a.cal === n.cal, 'fonctions calendaires : résultats identiques')
})

await test('Z01', 'Zéro erreur console / exception page sur toute la recette', async () => {
  ok(errs.length === 0, `erreurs applicatives : ${errs.length}${errs.length ? ' — ' + JSON.stringify(errs.slice(0, 3)) : ''}`)
})

await b.close()
fs.writeFileSync(OUT + 'resultats.json', JSON.stringify({ passed, failed: failed.length, total: results.length, failedList: failed, errs, results }, null, 1))
console.log(`\nRÉSULTAT : ${passed} / ${results.length}  ·  ERREURS CONSOLE : ${errs.length}`)
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)) }
process.exit(failed.length ? 1 : 0)
