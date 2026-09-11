// ============================================================
// KANVIX — Recette correctifs UX ciblés (V2.4.15.2)
//   Suppression du menu ••• du cockpit + suppression totale de la
//   saccade au changement d'onglet (retour utilisateur sur V2.4.15.1)
//   Usage : node recette-correctifs-v2.4.15.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.1.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.2.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.2/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 600)}`);
const allErrs = [];
async function newPage(w = 1440, h = 1000, tag = 'x', url = FILE) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(url, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const reset = (p, extra = '') => ev(p, (s) => (0, eval)('resetApp();setDepth("pilot");' + s), extra);

// ============================================================
// MENU-1512 — Menu ••• du cockpit retiré
// ============================================================
console.log('\n[MENU-1512-01] Le cockpit chantier n’a plus de menu •••');
{
  const { ctx, p } = await newPage(1440, 1000, 'MENU1');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({
    hasMenu: !!document.querySelector('.cockpit-head-row .more-menu'),
    badgeStillThere: !!document.querySelector('.cockpit-head-row .status-badge'),
  }));
  note('MENU-1512-01', r);
  ok(!r.hasMenu, 'MENU-1512-01 : plus de bouton ••• dans l’en-tête du cockpit', 'MENU-1512');
  ok(r.badgeStillThere, 'MENU-1512-01 : le badge de statut reste affiché', 'MENU-1512');
  await p.screenshot({ path: SHOTS + '01-chantier-sans-menu.png', fullPage: true });
  await ctx.close();
}

console.log('\n[MENU-1512-02] Les actions du chantier restent accessibles depuis la liste Chantiers');
{
  const { ctx, p } = await newPage(1440, 1000, 'MENU2');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const before = await ev(p, () => app.ui.page);
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    page: app.ui.page,
    items: [...document.querySelectorAll('.site-card .more-pop button')].map((b) => b.textContent.trim()),
  }));
  note('MENU-1512-02', r);
  ok(r.page === before, 'MENU-1512-02 : le clic sur ••• (liste Chantiers) ne navigue toujours pas', 'MENU-1512');
  ok(r.items.includes('Modifier') && r.items.includes('Clôturer'), 'MENU-1512-02 : Modifier/Clôturer toujours disponibles depuis la liste Chantiers', 'MENU-1512');
  await ctx.close();
}

console.log('\n[MENU-1512-03] projectCardMenu() toujours fonctionnel (aucune régression du moteur de menu)');
{
  const { ctx, p } = await newPage(1440, 1000, 'MENU3');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  await p.locator('.site-card .more-pop.open button', { hasText: 'Modifier' }).first().click();
  await p.waitForTimeout(200);
  const r = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
  note('MENU-1512-03', { drawerOpen: r });
  ok(r, 'MENU-1512-03 : « Modifier » depuis la liste Chantiers ouvre bien l’édition', 'MENU-1512');
  await ctx.close();
}

// ============================================================
// JANK-1512 — Suppression totale de la saccade au changement d'onglet
// ============================================================
console.log('\n[JANK-1512-01] Scénario réel signalé : Aujourd’hui (scrollé à son max) → Équipe, aucun mouvement');
{
  const { ctx, p } = await newPage(1440, 700, 'JANK1');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  const maxScroll = await ev(p, () => document.documentElement.scrollHeight - window.innerHeight);
  await ev(p, (m) => window.scrollTo(0, m), maxScroll);
  await p.waitForTimeout(100);
  const before = await ev(p, () => window.scrollY);
  await p.locator('.tab', { hasText: 'Équipe' }).click();
  await p.waitForTimeout(150);
  const after = await ev(p, () => window.scrollY);
  note('JANK-1512-01', { maxScroll, before, after });
  ok(before === after, `JANK-1512-01 : scrollY inchangé (${before} → ${after}), plus de retour en haut de page`, 'JANK-1512');
  await ctx.close();
}

console.log('\n[JANK-1512-02] Le plancher ne bloque jamais un onglet plus long (Équipe court → Planning long)');
{
  const { ctx, p } = await newPage(1440, 700, 'JANK2');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  await p.locator('.tab', { hasText: 'Équipe' }).click();
  await p.waitForTimeout(100);
  const heightBefore = await ev(p, () => document.documentElement.scrollHeight);
  await p.locator('.tab', { hasText: 'Planning' }).click();
  await p.waitForTimeout(150);
  const heightAfter = await ev(p, () => document.documentElement.scrollHeight);
  note('JANK-1512-02', { heightBefore, heightAfter });
  ok(heightAfter >= heightBefore, 'JANK-1512-02 : un onglet plus long peut toujours grandir au-delà du plancher', 'JANK-1512');
  await ctx.close();
}

console.log('\n[JANK-1512-03] Séquence complète — aucun mouvement à travers tous les onglets, à plusieurs profondeurs de défilement');
{
  for (const scrollDepth of [50, 150, 300]) {
    const { ctx, p } = await newPage(1440, 700, 'JANK3-' + scrollDepth);
    await reset(p, "app.ui.projectId='keravel';go('project');");
    await p.waitForTimeout(200);
    await ev(p, (d) => window.scrollTo(0, d), scrollDepth);
    await p.waitForTimeout(80);
    const order = ['Aujourd’hui', 'À venir', 'Documents', 'Photos', 'Planning', 'Équipe', 'Historique', 'Aujourd’hui'];
    let maxJump = 0;
    for (const name of order) {
      const before = await ev(p, () => window.scrollY);
      await p.locator('.tab', { hasText: name }).first().click();
      await p.waitForTimeout(80);
      const after = await ev(p, () => window.scrollY);
      maxJump = Math.max(maxJump, Math.abs(after - before));
    }
    note('JANK-1512-03', { scrollDepth, maxJump });
    ok(maxJump === 0, `JANK-1512-03 : profondeur initiale ${scrollDepth}px — 0 déplacement sur les 8 transitions`, 'JANK-1512');
    await ctx.close();
  }
}

console.log('\n[JANK-1512-04] Le plancher est remis à zéro en changeant de chantier');
{
  const { ctx, p } = await newPage(1440, 700, 'JANK4');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(150);
  await p.locator('.tab', { hasText: 'Planning' }).click();
  await p.waitForTimeout(100);
  const r = await ev(p, () => {
    const before = document.querySelector('#projectContent').style.minHeight;
    app.ui.projectId = 'terrasses'; go('project');
    const after = document.querySelector('#projectContent').style.minHeight;
    return { before, after };
  });
  note('JANK-1512-04', r);
  ok(!!r.before && r.after === '', 'JANK-1512-04 : le plancher (non vide sur Keravel) redevient vide sur un nouveau chantier', 'JANK-1512');
  await ctx.close();
}

console.log('\n[JANK-1512-05] Toujours aucun renderPage(), aucun smooth scroll');
{
  const { ctx, p } = await newPage(1440, 1000, 'JANK5');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  const calls = await ev(p, () => {
    let n = 0;
    const orig = window.renderPage;
    window.renderPage = function (...a) { n++; return orig.apply(this, a); };
    document.querySelector('.tab:nth-child(2)').click();
    window.renderPage = orig;
    return n;
  });
  const scrollBehavior = await ev(p, () => getComputedStyle(document.documentElement).scrollBehavior);
  note('JANK-1512-05', { calls, scrollBehavior });
  ok(calls === 0, 'JANK-1512-05 : projectTab() toujours sans renderPage()', 'JANK-1512');
  ok(scrollBehavior !== 'smooth', 'JANK-1512-05 : toujours pas de smooth scroll', 'JANK-1512');
  await p.screenshot({ path: SHOTS + '02-onglets-stables.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// FREEZE — comparaison structurelle avec V2.4.15.1 (hors les 2 correctifs)
// ============================================================
console.log('\n[FREEZE-1512] Reste de la fiche chantier strictement identique à V2.4.15.1');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); app.ui.projectId = 'keravel'; go('project');
    return {
      hasThumb: !!document.querySelector('.cockpit-thumb svg'),
      zones: [...document.querySelectorAll('.cockpit-content.cockpit-grid > .cockpit-zone')].map((z) => z.querySelector('h2')?.textContent),
      tabs: [...document.querySelectorAll('.tab')].map((t) => t.textContent),
    };
  });
  const prev = await snap(pPrev), cur = await snap(pCur);
  note('FREEZE-1512', { prev, cur });
  ok(JSON.stringify(prev) === JSON.stringify(cur), 'FREEZE-1512 : identité visuelle, zones et onglets strictement identiques (hors menu retiré)', 'FREEZE');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1512]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1512', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1512 : 0 erreur JavaScript applicative', 'CONSOLE-1512');
}

// ============================================================
// ENGINES — byte-identité
// ============================================================
console.log('\n[ENGINES-1512] Byte-identité des moteurs métier (V2.4.15.1 → V2.4.15.2)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.1.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.2.html', 'utf8');
  function extractFn(src, name) {
    const re = new RegExp(`function\\s+${name}\\s*\\(`);
    const m = re.exec(src);
    if (!m) return null;
    let i = src.indexOf('{', m.index);
    if (i < 0) return null;
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
    }
    return null;
  }
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
  const engines = [
    'planReflow', 'applyReflowPlan', 'setTaskStatus', 'kanbanDrop', 'dropTask', 'requestTaskScheduleMove',
    'scenarioOptions', 'evaluateScenario', 'applySimulation', 'historyProjectId', 'projectHistory',
    'historyStamp', 'historyGroups', 'buildKanvixBackup', 'confirmKanvixRestore', 'validateKanvixBackup',
    'reopenProject', 'archiveProjectPrompt', 'restoreProject', 'confirmCloseProject',
    'gantt', 'kanbanCard', 'getProjectSummary', 'art', 'projectVisual',
    'getResourceState', 'getResourcePeriodState', 'getResourceLoad', 'getMaxConcurrentTasks',
    'getResourceWeekDays', 'resourceStateLabel', 'resourceStateTone', 'projectCardMenu',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1512 : tous les moteurs métier listés sont byte-identiques entre V2.4.15.1 et V2.4.15.2', 'ENGINES-1512');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
