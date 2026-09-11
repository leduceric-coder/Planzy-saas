// ============================================================
// KANVIX — Recette correctifs UX ciblés (V2.4.15.3)
//   Bug réel : le menu ••• de la carte chantier (page Chantiers) rendait
//   son popover détaché du bouton (position:static cassait l'ancrage),
//   et pouvait être rogné par overflow:hidden sur la carte — donnant
//   l'impression que le menu "ne fonctionne pas".
//   Usage : node recette-correctifs-v2.4.15.3.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.2.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.3.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.3/';
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

async function checkMenu(p, cardIndex, expectedItems) {
  await p.locator('.site-card .more-trigger').nth(cardIndex).click();
  await p.waitForTimeout(150);
  const r = await ev(p, (idx) => {
    const card = document.querySelectorAll('.site-card')[idx].getBoundingClientRect();
    const trigger = document.querySelectorAll('.site-card .more-trigger')[idx].getBoundingClientRect();
    const menu = document.querySelectorAll('.site-card .more-menu')[idx];
    const pop = document.querySelectorAll('.site-card .more-pop')[idx];
    const popRect = pop.getBoundingClientRect();
    const items = [...pop.querySelectorAll('button')].map((b) => b.textContent.trim());
    // proximité réelle : le popover doit démarrer juste sous le bouton et
    // partager son bord droit — pas flotter ailleurs sur la page.
    const nearTrigger = Math.abs(popRect.top - trigger.bottom) <= 12 && Math.abs(popRect.right - trigger.right) <= 4;
    // chaque bouton du popover doit réellement recevoir le clic à son
    // propre point central (pas de recadrage/overlap qui l'empêcherait).
    const allButtonsReachable = [...pop.querySelectorAll('button')].every((btn) => {
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return pop.contains(el);
    });
    return { items, nearTrigger, allButtonsReachable, menuPosition: getComputedStyle(menu).position };
  }, cardIndex);
  return r;
}

console.log('\n[POPUP-1513-01] Chantier actif — popover ancré au bouton, tous les items cliquables');
{
  const { ctx, p } = await newPage(1440, 1000, 'P1');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const r = await checkMenu(p, 0, ['Modifier', 'Clôturer']);
  note('POPUP-1513-01', r);
  ok(r.menuPosition === 'relative', 'POPUP-1513-01 : .more-menu garde position:relative (ancre du popover)', 'POPUP-1513');
  ok(r.nearTrigger, 'POPUP-1513-01 : le popover apparaît juste sous le bouton ••• (pas détaché ailleurs sur la page)', 'POPUP-1513');
  ok(r.allButtonsReachable, 'POPUP-1513-01 : chaque item du menu reçoit réellement le clic à son emplacement visible', 'POPUP-1513');
  ok(r.items.includes('Modifier') && r.items.includes('Clôturer'), 'POPUP-1513-01 : Modifier + Clôturer proposés pour un chantier actif', 'POPUP-1513');
  await p.screenshot({ path: SHOTS + '01-menu-actif.png', fullPage: true });
  await ctx.close();
}

console.log('\n[POPUP-1513-02] Chantier actif SANS tâche — 3 actions (Modifier/Clôturer/Supprimer), aucun recadrage');
{
  const { ctx, p } = await newPage(1440, 1000, 'P2');
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects.push({ id: 'p-empty-1513', name: 'Chantier vide', location: 'Test', lifecycle: 'active', visualIndex: 1 });
    save(); go('sites'); renderPage();
  });
  await p.waitForTimeout(150);
  const idx = await ev(p, () => [...document.querySelectorAll('.site-id h2')].findIndex((h) => h.textContent.includes('Chantier vide')));
  const r = await checkMenu(p, idx, ['Modifier', 'Clôturer', 'Supprimer']);
  note('POPUP-1513-02', r);
  ok(r.nearTrigger, 'POPUP-1513-02 : popover toujours ancré même avec 3 actions', 'POPUP-1513');
  ok(r.allButtonsReachable, 'POPUP-1513-02 : les 3 actions sont toutes cliquables (y compris « Supprimer » en bas), aucun recadrage par la carte', 'POPUP-1513');
  ok(r.items.join(',') === 'Modifier,Clôturer,Supprimer', 'POPUP-1513-02 : Modifier/Clôturer/Supprimer proposés (chantier vide)', 'POPUP-1513');
  await p.screenshot({ path: SHOTS + '02-menu-3-actions.png', fullPage: true });
  await ctx.close();
}

console.log('\n[POPUP-1513-03] Chantier clôturé — Réouvrir + Archiver');
{
  const { ctx, p } = await newPage(1440, 1000, 'P3');
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects[0].lifecycle = 'closed'; app.projects[0].closedAt = getDemoNow().toISOString();
    save(); go('sites'); app.ui.sitesView = 'closed'; save(); renderPage();
  });
  await p.waitForTimeout(150);
  const r = await checkMenu(p, 0, ['Réouvrir', 'Archiver']);
  note('POPUP-1513-03', r);
  ok(r.nearTrigger && r.allButtonsReachable, 'POPUP-1513-03 : popover ancré et cliquable pour un chantier clôturé', 'POPUP-1513');
  ok(r.items.join(',') === 'Réouvrir,Archiver', 'POPUP-1513-03 : Réouvrir/Archiver proposés (chantier clôturé)', 'POPUP-1513');
  await ctx.close();
}

console.log('\n[POPUP-1513-04] Chantier archivé — Restaurer + Supprimer définitivement');
{
  const { ctx, p } = await newPage(1440, 1000, 'P4');
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects[0].lifecycle = 'archived'; app.projects[0].archivedAt = getDemoNow().toISOString();
    save(); go('sites'); app.ui.sitesView = 'archived'; save(); renderPage();
  });
  await p.waitForTimeout(150);
  const r = await checkMenu(p, 0, ['Restaurer', 'Supprimer définitivement']);
  note('POPUP-1513-04', r);
  ok(r.nearTrigger && r.allButtonsReachable, 'POPUP-1513-04 : popover ancré et cliquable pour un chantier archivé', 'POPUP-1513');
  ok(r.items.join(',') === 'Restaurer,Supprimer définitivement', 'POPUP-1513-04 : Restaurer/Supprimer définitivement proposés (chantier archivé)', 'POPUP-1513');
  await ctx.close();
}

console.log('\n[POPUP-1513-05] Clics réels — Modifier / Clôturer aboutissent effectivement');
{
  const { ctx, p } = await newPage(1440, 1000, 'P5');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  await p.locator('.site-card .more-pop.open button', { hasText: 'Modifier' }).first().click();
  await p.waitForTimeout(200);
  const r1 = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
  note('POPUP-1513-05-modifier', { drawerOpen: r1 });
  ok(r1, 'POPUP-1513-05 : « Modifier » ouvre réellement l’édition du chantier', 'POPUP-1513');
  await ev(p, () => closeOverlay('drawer'));
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  await p.locator('.site-card .more-pop.open button', { hasText: 'Clôturer' }).first().click();
  await p.waitForTimeout(200);
  const r2 = await ev(p, () => document.querySelector('#modal').classList.contains('open'));
  note('POPUP-1513-05-cloturer', { modalOpen: r2 });
  ok(r2, 'POPUP-1513-05 : « Clôturer » ouvre réellement la confirmation', 'POPUP-1513');
  await ctx.close();
}

console.log('\n[POPUP-1513-06] Dark mode — popover lisible, aucun aplat blanc');
{
  const { ctx, p } = await newPage(1440, 1000, 'P6');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.appearance = 'dark'; document.body.classList.add('dark'); save(); go('sites'); });
  await p.waitForTimeout(150);
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  const r = await ev(p, () => {
    const pop = document.querySelector('.site-card .more-pop');
    const bg = (getComputedStyle(pop).backgroundColor.match(/\d+/g) || []).map(Number);
    return { whiteFlat: bg[0] > 240 && bg[1] > 240 && bg[2] > 240 };
  });
  note('POPUP-1513-06', r);
  ok(r.whiteFlat === false, 'POPUP-1513-06 : popover sans aplat blanc forcé en dark mode', 'POPUP-1513');
  await p.screenshot({ path: SHOTS + '03-menu-dark.png', fullPage: true });
  await ctx.close();
}

console.log('\n[POPUP-1513-07] Mobile 390 — popover toujours ancré et cliquable');
{
  const { ctx, p } = await newPage(390, 900, 'P7');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const r = await checkMenu(p, 0, ['Modifier', 'Clôturer']);
  note('POPUP-1513-07', r);
  ok(r.allButtonsReachable, 'POPUP-1513-07 : menu cliquable à 390px', 'POPUP-1513');
  const overflow = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!overflow, 'POPUP-1513-07 : pas de débordement horizontal avec le menu ouvert', 'POPUP-1513');
  await ctx.close();
}

// ============================================================
// FREEZE — reste de la carte chantier strictement identique à V2.4.15.2
// ============================================================
console.log('\n[FREEZE-1513] Carte chantier (hors menu) strictement identique à V2.4.15.2');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('sites');
    const cards = [...document.querySelectorAll('.site-card')];
    return {
      count: cards.length,
      heights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
      thumbSizes: cards.map((c) => { const t = c.querySelector('.site-thumb').getBoundingClientRect(); return `${Math.round(t.width)}x${Math.round(t.height)}`; }),
    };
  });
  const prev = await snap(pPrev), cur = await snap(pCur);
  note('FREEZE-1513', { prev, cur });
  ok(prev.count === cur.count, 'FREEZE-1513 : même nombre de cartes', 'FREEZE');
  ok(JSON.stringify(prev.heights) === JSON.stringify(cur.heights), 'FREEZE-1513 : mêmes hauteurs de carte (mise en page inchangée)', 'FREEZE');
  ok(JSON.stringify(prev.thumbSizes) === JSON.stringify(cur.thumbSizes), 'FREEZE-1513 : vignettes inchangées', 'FREEZE');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1513]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1513', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1513 : 0 erreur JavaScript applicative', 'CONSOLE-1513');
}

// ============================================================
// ENGINES — byte-identité
// ============================================================
console.log('\n[ENGINES-1513] Byte-identité des moteurs métier (V2.4.15.2 → V2.4.15.3)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.2.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.3.html', 'utf8');
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
    'gantt', 'kanbanCard', 'getProjectSummary', 'art', 'projectVisual', 'projectCardMenu',
    'getResourceState', 'getResourcePeriodState', 'getResourceLoad', 'getMaxConcurrentTasks',
    'getResourceWeekDays', 'siteCard', 'toggleDrawerMenu', 'closeDrawerMenu',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1513 : tous les moteurs / fonctions de rendu listés sont byte-identiques (correctif purement CSS)', 'ENGINES-1513');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
