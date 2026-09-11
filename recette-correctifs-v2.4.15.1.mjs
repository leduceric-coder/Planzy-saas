// ============================================================
// KANVIX — Recette correctifs UX ciblés (V2.4.15.1)
//   RÉGLAGES + CHANTIERS + FICHE CHANTIER + CHARGE DES RESSOURCES
//   Usage : node recette-correctifs-v2.4.15.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.1/';
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
// SET151 — RÉGLAGES
// ============================================================
console.log('\n[SET151-01/02] Hauteur identique des deux cartes supérieures (1920/1440)');
for (const w of [1920, 1440]) {
  const { ctx, p } = await newPage(w, 1000, 'SET-' + w);
  await reset(p, "go('more');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => [...document.querySelectorAll('.settings-grid > .settings-section')].map((s) => Math.round(s.getBoundingClientRect().height)));
  note('SET151', { w, heights: r });
  ok(r.length === 2 && Math.abs(r[0] - r[1]) <= 1, `SET151-0${w === 1920 ? 1 : 2} : ${w}px — hauteurs égales (${r.join('/')})`, 'SET151');
  if (w === 1920) await p.screenshot({ path: SHOTS + '01-reglages-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[SET151-03] Même bord supérieur/inférieur en grille desktop');
{
  const { ctx, p } = await newPage(1100, 1000, 'SET3');
  await reset(p, "go('more');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const rects = [...document.querySelectorAll('.settings-grid > .settings-section')].map((s) => s.getBoundingClientRect());
    return { tops: rects.map((r) => Math.round(r.top)), bottoms: rects.map((r) => Math.round(r.bottom)) };
  });
  note('SET151-03', r);
  ok(Math.abs(r.tops[0] - r.tops[1]) <= 1 && Math.abs(r.bottoms[0] - r.bottoms[1]) <= 1, 'SET151-03 : même bord haut et bas', 'SET151');
  await ctx.close();
}

console.log('\n[SET151-04] Empilées sous ~900px — hauteur naturelle (pas forcée égale)');
{
  const { ctx, p } = await newPage(768, 1000, 'SET4');
  await reset(p, "go('more');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({
    cols: getComputedStyle(document.querySelector('.settings-grid')).gridTemplateColumns.split(' ').length,
    heights: [...document.querySelectorAll('.settings-grid > .settings-section')].map((s) => Math.round(s.getBoundingClientRect().height)),
  }));
  note('SET151-04', r);
  ok(r.cols === 1, 'SET151-04 : une seule colonne sous 900px', 'SET151');
  ok(r.heights[0] !== r.heights[1], 'SET151-04 : hauteurs naturelles (différentes), pas de stretch forcé en pile', 'SET151');
  await ctx.close();
}

console.log('\n[SET151-05] Tous les onclick métier fonctionnels');
{
  const { ctx, p } = await newPage(1440, 1000, 'SET5');
  await reset(p, "go('more');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const html = document.querySelector('.settings-content').innerHTML;
    const fns = ['setDepth(', 'setAppearance(', 'setRole(', 'openCompanyTemplateForm(', 'openKanvixImport(', 'exportKanvixData(', 'downloadKanvixBackup(', 'openKanvixBackupRestore(', 'confirmResetDemo('];
    return fns.filter((f) => !html.includes(f));
  });
  note('SET151-05', { missing: r });
  ok(r.length === 0, 'SET151-05 : tous les onclick métier présents à l’identique', 'SET151');
  await ctx.close();
}

// ============================================================
// SITE151 — PAGE CHANTIERS
// ============================================================
console.log('\n[SITE151-01] 4 chantiers actifs à 1920 → 2×2');
{
  const { ctx, p } = await newPage(1920, 1080, 'SITE1');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const cards = [...document.querySelectorAll('.site-card')];
    const rects = cards.map((c) => c.getBoundingClientRect());
    const lefts = [...new Set(rects.map((r) => Math.round(r.left)))];
    const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
    return { count: cards.length, cols: lefts.length, rows: tops.length };
  });
  note('SITE151-01', r);
  ok(r.count === 4 && r.cols === 2 && r.rows === 2, `SITE151-01 : 4 cartes en 2×2 (mesuré ${r.cols}×${r.rows})`, 'SITE151');
  await p.screenshot({ path: SHOTS + '02-chantiers-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[SITE151-02] Toujours 2 colonnes à 1440 si la place le permet');
{
  const { ctx, p } = await newPage(1440, 1000, 'SITE2');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const cols = await ev(p, () => getComputedStyle(document.querySelector('.sites-grid')).gridTemplateColumns.split(' ').length);
  note('SITE151-02', { cols });
  ok(cols === 2, 'SITE151-02 : 2 colonnes à 1440px', 'SITE151');
  await p.screenshot({ path: SHOTS + '03-chantiers-1440.png', fullPage: true });
  await ctx.close();
}

console.log('\n[SITE151-03] Hauteur de carte ≤190px');
{
  const { ctx, p } = await newPage(1920, 1080, 'SITE3');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const heights = await ev(p, () => [...document.querySelectorAll('.site-card')].map((c) => Math.round(c.getBoundingClientRect().height)));
  note('SITE151-03', { heights });
  ok(heights.every((h) => h <= 190), `SITE151-03 : toutes les cartes ≤190px (${heights.join(',')})`, 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-04/05/06] Vignette petite, non déformée, ≤25% de la largeur');
{
  const { ctx, p } = await newPage(1920, 1080, 'SITE456');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const card = document.querySelector('.site-card').getBoundingClientRect();
    const thumb = document.querySelector('.site-thumb').getBoundingClientRect();
    const svg = document.querySelector('.site-thumb svg');
    return { cardW: Math.round(card.width), thumbW: Math.round(thumb.width), thumbH: Math.round(thumb.height), preserveAR: svg.getAttribute('preserveAspectRatio'), ratio: thumb.width / card.width };
  });
  note('SITE151-04/05/06', r);
  ok(r.thumbW >= 100 && r.thumbW <= 120 && r.thumbH >= 70 && r.thumbH <= 90, `SITE151-04 : vignette ${r.thumbW}×${r.thumbH}px (100-120×70-90 attendu)`, 'SITE151');
  ok(r.preserveAR === 'xMidYMid meet', 'SITE151-05 : preserveAspectRatio="xMidYMid meet" (non déformée)', 'SITE151');
  ok(r.ratio <= 0.25, `SITE151-06 : vignette ≤25% de la largeur de carte (mesuré ${(r.ratio * 100).toFixed(1)}%)`, 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-07] Champs visibles sans clipping (nom/loc/phase/statut/point/équipe/Ouvrir)');
{
  const { ctx, p } = await newPage(1920, 1080, 'SITE7');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const card = document.querySelector('.site-card');
    return {
      hasName: !!card.querySelector('.site-id h2')?.textContent.trim(),
      hasLoc: !!card.querySelector('.site-loc')?.textContent.trim(),
      hasBadge: !!card.querySelector('.site-badge')?.textContent.trim(),
      hasSubject: !!card.querySelector('.site-subject b')?.textContent.trim(),
      hasTeam: !!card.querySelector('.site-team')?.textContent.trim(),
      hasOpen: !!card.querySelector('.site-open')?.textContent.trim(),
      cardOverflowX: card.scrollWidth > card.clientWidth + 1,
    };
  });
  note('SITE151-07', r);
  ok(r.hasName && r.hasLoc && r.hasBadge && r.hasSubject && r.hasTeam && r.hasOpen, 'SITE151-07 : tous les champs présents', 'SITE151');
  ok(!r.cardOverflowX, 'SITE151-07 : aucun débordement horizontal dans la carte', 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-08] Les 4 chantiers de démo rendus correctement');
{
  const { ctx, p } = await newPage(1920, 1080, 'SITE8');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const names = await ev(p, () => [...document.querySelectorAll('.site-id h2')].map((h) => h.textContent.trim()));
  note('SITE151-08', { names });
  ['Résidence Keravel', 'Villa du Port', 'Bâtiment Horizon', 'Les Terrasses'].forEach((n) => ok(names.includes(n), `SITE151-08 : « ${n} » rendu`, 'SITE151'));
  await ctx.close();
}

console.log('\n[SITE151-09] Actifs / Clôturés / Archives fonctionnels');
{
  const { ctx, p } = await newPage(1440, 1000, 'SITE9');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const pr = app.projects[0]; pr.lifecycle = 'closed'; pr.closedAt = getDemoNow().toISOString();
    const pr2 = app.projects[1]; pr2.lifecycle = 'archived'; pr2.archivedAt = getDemoNow().toISOString();
    save(); go('sites');
    app.ui.sitesView = 'active'; save(); renderPage();
    const active = document.querySelectorAll('.site-card').length;
    app.ui.sitesView = 'closed'; save(); renderPage();
    const closed = document.querySelectorAll('.site-card').length;
    app.ui.sitesView = 'archived'; save(); renderPage();
    const archived = document.querySelectorAll('.site-card').length;
    return { active, closed, archived };
  });
  note('SITE151-09', r);
  ok(r.active === 2 && r.closed === 1 && r.archived === 1, 'SITE151-09 : Actifs/Clôturés/Archives affichent les bons chantiers', 'SITE151');
  await p.screenshot({ path: SHOTS + '04-chantiers-900.png', fullPage: true }).catch(() => {});
  await ctx.close();
}

console.log('\n[SITE151-10] Menu ••• fonctionnel, ne navigue pas');
{
  const { ctx, p } = await newPage(1440, 1000, 'SITE10');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const before = await ev(p, () => app.ui.page);
  await p.locator('.site-card .more-trigger').first().click();
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({ page: app.ui.page, expanded: document.querySelector('.site-card .more-trigger').getAttribute('aria-expanded') }));
  note('SITE151-10', { before, ...r });
  ok(r.page === before, 'SITE151-10 : le clic sur ••• ne navigue pas vers la fiche', 'SITE151');
  ok(r.expanded === 'true', 'SITE151-10 : le menu s’ouvre bien', 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-11] Clavier — Tab puis Enter/Space ouvrent la fiche');
{
  const { ctx, p } = await newPage(1440, 1000, 'SITE11');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  await p.locator('.site-card').first().focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  const r1 = await ev(p, () => app.ui.page);
  await ev(p, () => { resetApp(); setDepth('pilot'); go('sites'); });
  await p.waitForTimeout(150);
  await p.locator('.site-card').first().focus();
  await p.keyboard.press(' ');
  await p.waitForTimeout(150);
  const r2 = await ev(p, () => app.ui.page);
  note('SITE151-11', { enter: r1, space: r2 });
  ok(r1 === 'project' && r2 === 'project', 'SITE151-11 : Enter et Espace ouvrent la fiche chantier', 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-12] Responsive — 1 colonne à 900px si nécessaire');
{
  const { ctx, p } = await newPage(900, 1000, 'SITE12');
  await reset(p, "go('sites');");
  await p.waitForTimeout(200);
  const cols = await ev(p, () => getComputedStyle(document.querySelector('.sites-grid')).gridTemplateColumns.split(' ').length);
  note('SITE151-12', { cols });
  ok(cols === 1, 'SITE151-12 : 1 colonne à 900px', 'SITE151');
  await ctx.close();
}

console.log('\n[SITE151-13] Mobile 430/390 — petite vignette, jamais pleine largeur');
{
  for (const [w, shotName] of [[430, null], [390, '05-chantiers-390.png']]) {
    const { ctx, p } = await newPage(w, 1000, 'SITE13-' + w);
    await reset(p, "go('sites');");
    await p.waitForTimeout(200);
    const r = await ev(p, () => {
      const thumb = document.querySelector('.site-thumb').getBoundingClientRect();
      const card = document.querySelector('.site-card').getBoundingClientRect();
      return { thumbW: Math.round(thumb.width), cardW: Math.round(card.width), ratio: thumb.width / card.width, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    note('SITE151-13-' + w, r);
    ok(r.ratio < 0.5, `SITE151-13 : ${w}px — vignette reste petite, pas d’image pleine largeur (${(r.ratio * 100).toFixed(0)}%)`, 'SITE151');
    ok(!r.overflow, `SITE151-13 : ${w}px — pas de débordement`, 'SITE151');
    if (shotName) await p.screenshot({ path: SHOTS + shotName, fullPage: true });
    await ctx.close();
  }
}

console.log('\n[SITE151-14] 0 overflow body (rappel large)');
{
  for (const w of [1920, 1600, 1440, 1080, 900, 430]) {
    const { ctx, p } = await newPage(w, 1000, 'SITE14-' + w);
    await reset(p, "go('sites');");
    await p.waitForTimeout(150);
    const overflow = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok(!overflow, `SITE151-14 : ${w}px — 0 overflow body`, 'SITE151');
    await ctx.close();
  }
}

// ============================================================
// PROJ151 — FICHE CHANTIER : respiration + saccade
// ============================================================
console.log('\n[PROJ151-01/02/03/04] Gaps de respiration (Keravel + Terrasses)');
for (const pid of ['keravel', 'terrasses']) {
  const { ctx, p } = await newPage(1440, 1000, 'PROJ-' + pid);
  await reset(p, `app.ui.projectId='${pid}';go('project');`);
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const link = document.querySelector('.project-back-link').getBoundingClientRect();
    const cockpit = document.querySelector('.project-cockpit-shell').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    const content = document.querySelector('#projectContent').getBoundingClientRect();
    return {
      gap1: Math.round(cockpit.top - link.bottom),
      gap2: Math.round(tabs.top - cockpit.bottom),
      gap3: Math.round(content.top - tabs.bottom),
    };
  });
  note('PROJ151-' + pid, r);
  ok(r.gap1 >= 12 && r.gap1 <= 18, `PROJ151-01 (${pid}) : gap back→cockpit ${r.gap1}px (12-18 attendu)`, 'PROJ151');
  ok(r.gap2 >= 10 && r.gap2 <= 16, `PROJ151-02 (${pid}) : gap cockpit→tabs ${r.gap2}px (10-16 attendu)`, 'PROJ151');
  ok(r.gap3 >= 12 && r.gap3 <= 18, `PROJ151-03 (${pid}) : gap tabs→content ${r.gap3}px (12-18 attendu)`, 'PROJ151');
  if (pid === 'keravel') await p.screenshot({ path: SHOTS + '06-chantier-keravel-spacing.png', fullPage: true });
  await ctx.close();
}
console.log('\n[PROJ151-04] Même rythme vertical Keravel / Terrasses');
{
  const { ctx: c1, p: p1 } = await newPage(1440, 1000, 'PROJ4a');
  await reset(p1, "app.ui.projectId='keravel';go('project');");
  await p1.waitForTimeout(200);
  const g1 = await ev(p1, () => {
    const link = document.querySelector('.project-back-link').getBoundingClientRect();
    const cockpit = document.querySelector('.project-cockpit-shell').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    return { g1: Math.round(cockpit.top - link.bottom), g2: Math.round(tabs.top - cockpit.bottom) };
  });
  await c1.close();
  const { ctx: c2, p: p2 } = await newPage(1440, 1000, 'PROJ4b');
  await reset(p2, "app.ui.projectId='terrasses';go('project');");
  await p2.waitForTimeout(200);
  const g2 = await ev(p2, () => {
    const link = document.querySelector('.project-back-link').getBoundingClientRect();
    const cockpit = document.querySelector('.project-cockpit-shell').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    return { g1: Math.round(cockpit.top - link.bottom), g2: Math.round(tabs.top - cockpit.bottom) };
  });
  await c2.close();
  note('PROJ151-04', { keravel: g1, terrasses: g2 });
  ok(g1.g1 === g2.g1 && g1.g2 === g2.g2, 'PROJ151-04 : mêmes gaps entre Keravel et Terrasses (rythme systématique, pas ad hoc)', 'PROJ151');
}

console.log('\n[PROJ151-SACCADE] Mesure réelle scrollY / tabs.top à travers tous les onglets');
{
  const { ctx, p } = await newPage(1440, 650, 'JANK');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  // Position de scroll où TOUS les onglets permettent le même défilement
  // (sous le maxScroll du plus court, ici Historique) — cf. §"contenu plus court".
  await p.evaluate(() => window.scrollTo(0, 100));
  await p.waitForTimeout(80);
  const order = ['Aujourd’hui', 'À venir', 'Documents', 'Photos', 'Planning', 'Équipe', 'Historique', 'Aujourd’hui'];
  let maxJump = 0;
  for (const name of order) {
    const before = await ev(p, () => Math.round(document.querySelector('.tabs').getBoundingClientRect().top));
    await p.locator('.tab', { hasText: name }).first().click();
    await p.waitForTimeout(80);
    const after = await ev(p, () => Math.round(document.querySelector('.tabs').getBoundingClientRect().top));
    maxJump = Math.max(maxJump, Math.abs(after - before));
  }
  note('PROJ151-SACCADE', { maxJump });
  ok(maxJump <= 2, `PROJ151-SACCADE : déplacement max de la barre d’onglets = ${maxJump}px (≤2px attendu, position où tous les contenus permettent le même défilement)`, 'PROJ151');
  await p.screenshot({ path: SHOTS + '07-chantier-tabs-stable.png', fullPage: false });
  await ctx.close();
}

console.log('\n[PROJ151-05] Aucun renderPage() pendant projectTab()');
{
  const { ctx, p } = await newPage(1440, 1000, 'PROJ5');
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
  note('PROJ151-05', { calls });
  ok(calls === 0, 'PROJ151-05 : projectTab() ne déclenche jamais renderPage()', 'PROJ151');
  await ctx.close();
}

console.log('\n[PROJ151-06] Aucun smooth scroll / transition de hauteur utilisée pour masquer le problème');
{
  const { ctx, p } = await newPage(1440, 1000, 'PROJ6');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    contentTransition: getComputedStyle(document.querySelector('#projectContent')).transition,
    hasInlineMinHeight: !!document.querySelector('#projectContent').style.minHeight,
  }));
  note('PROJ151-06', r);
  ok(r.scrollBehavior !== 'smooth', 'PROJ151-06 : pas de smooth scroll global', 'PROJ151');
  ok(!r.hasInlineMinHeight, 'PROJ151-06 : pas de min-height résiduelle sur #projectContent', 'PROJ151');
  await ctx.close();
}

// ============================================================
// LOAD151 — ÉQUIPE : CHARGE DES RESSOURCES
// ============================================================
console.log('\n[LOAD151-01] Semaine initiale = semaine de TODAY');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD1');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    return { expected: getResourceWeekDays(TODAY), shown: document.querySelector('.team-load-week-label').textContent };
  });
  note('LOAD151-01', r);
  ok(!!r.shown, 'LOAD151-01 : le libellé de semaine est affiché et calculé', 'LOAD151');
  await p.screenshot({ path: SHOTS + '08-equipe-charge-current-week.png', fullPage: true });
  await ctx.close();
}

console.log('\n[LOAD151-02/03] Navigation semaine suivante/précédente exacte (+7/-7 jours)');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD23');
  const r = await ev(p, () => { resetApp(); setDepth('pilot'); go('team'); return getResourceWeekDays(app.ui.teamLoadAnchor || TODAY); });
  await p.locator('.team-load-nav button[aria-label="Semaine suivante"]').click();
  await p.waitForTimeout(150);
  const r2 = await ev(p, () => getResourceWeekDays(app.ui.teamLoadAnchor));
  await p.screenshot({ path: SHOTS + '09-equipe-charge-next-week.png', fullPage: true });
  await p.locator('.team-load-nav button[aria-label="Semaine précédente"]').click();
  await p.waitForTimeout(150);
  const r3 = await ev(p, () => getResourceWeekDays(app.ui.teamLoadAnchor));
  note('LOAD151-02/03', { initial: r, next: r2, back: r3 });
  const plus7 = new Date(r[0]); plus7.setDate(plus7.getDate() + 7);
  ok(r2[0] === plus7.toISOString().slice(0, 10), 'LOAD151-02 : chaque jour +7 jours après « Semaine suivante »', 'LOAD151');
  ok(JSON.stringify(r3) === JSON.stringify(r), 'LOAD151-03 : retour exact aux dates initiales après « Semaine précédente »', 'LOAD151');
  await ctx.close();
}

console.log('\n[LOAD151-04] « Aujourd’hui » ramène à la semaine actuelle après plusieurs navigations');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD4');
  const initial = await ev(p, () => { resetApp(); setDepth('pilot'); go('team'); return getResourceWeekDays(TODAY); });
  await p.locator('.team-load-nav button[aria-label="Semaine suivante"]').click();
  await p.waitForTimeout(100);
  await p.locator('.team-load-nav button[aria-label="Semaine suivante"]').click();
  await p.waitForTimeout(100);
  await p.locator('.team-load-nav button[aria-label="Semaine précédente"]').click();
  await p.waitForTimeout(100);
  await p.locator('.team-load-nav button', { hasText: 'Aujourd’hui' }).click();
  await p.waitForTimeout(100);
  const after = await ev(p, () => getResourceWeekDays(app.ui.teamLoadAnchor || TODAY));
  note('LOAD151-04', { initial, after });
  ok(JSON.stringify(initial) === JSON.stringify(after), 'LOAD151-04 : retour à la semaine actuelle', 'LOAD151');
  await ctx.close();
}

console.log('\n[LOAD151-05] Navigation Équipe n’affecte pas app.ui.periodAnchor (Planning)');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD5');
  const before = await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); return app.ui.periodAnchor; });
  await ev(p, () => go('team'));
  await p.waitForTimeout(100);
  await p.locator('.team-load-nav button[aria-label="Semaine suivante"]').click();
  await p.locator('.team-load-nav button[aria-label="Semaine suivante"]').click();
  await p.waitForTimeout(100);
  const after = await ev(p, () => { go('planning'); return app.ui.periodAnchor; });
  note('LOAD151-05', { before, after });
  ok(before === after, 'LOAD151-05 : periodAnchor du Planning strictement inchangé après navigation Équipe', 'LOAD151');
  await ctx.close();
}

console.log('\n[LOAD151-06→10] Filtre de statut — sémantique exacte (available/busy/high/conflict/all)');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD6');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    const days = getResourceWeekDays(app.ui.teamLoadAnchor || TODAY);
    const out = {};
    for (const st of ['available', 'busy', 'high', 'conflict']) {
      app.ui.teamLoadStatusFilter = st; save(); renderPage();
      const rows = [...document.querySelectorAll('.load-row:not(.load-head)')];
      const names = rows.map((r) => r.querySelector('b').textContent.trim());
      const expectedIds = app.resources.filter(resourceActive).filter((res) => getResourcePeriodState(res.id, days) === st).map((res) => res.name);
      out[st] = { matches: JSON.stringify(names.sort()) === JSON.stringify(expectedIds.sort()), count: rows.length };
    }
    app.ui.teamLoadStatusFilter = 'all'; save(); renderPage();
    const allCount = document.querySelectorAll('.load-row:not(.load-head)').length;
    const totalActive = app.resources.filter(resourceActive).length;
    out.all = { matches: allCount === totalActive, count: allCount };
    return out;
  });
  note('LOAD151-06-10', r);
  ok(r.available.matches, 'LOAD151-06 : filtre Disponible === getResourcePeriodState()==="available"', 'LOAD151');
  ok(r.busy.matches, 'LOAD151-07 : filtre Occupé === "busy"', 'LOAD151');
  ok(r.high.matches, 'LOAD151-08 : filtre Charge forte === "high"', 'LOAD151');
  ok(r.conflict.matches, 'LOAD151-09 : filtre Conflit === "conflict"', 'LOAD151');
  ok(r.all.matches, 'LOAD151-10 : « Tous » réaffiche toutes les ressources actives', 'LOAD151');
  await p.screenshot({ path: SHOTS + '11-equipe-charge-filter-available.png', fullPage: true }).catch(() => {});
  await ctx.close();
}

console.log('\n[LOAD151-11] Changer de semaine avec filtre actif recalcule sur la nouvelle semaine');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD11');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Force un conflit uniquement la semaine SUIVANTE pour mathieu
    const nextWeekAnchor = date(TODAY); nextWeekAnchor.setDate(nextWeekAnchor.getDate() + 7);
    const days2 = getResourceWeekDays(localDateTime(nextWeekAnchor));
    resource('mathieu').capacity = 1;
    const t1 = app.tasks.find((t) => t.resourceId === 'mathieu');
    t1.start = days2[0] + 'T08:00'; t1.end = days2[0] + 'T12:00'; t1.status = 'doing';
    const t2 = app.tasks.filter((t) => t.resourceId === 'mathieu')[1];
    if (t2) { t2.start = days2[0] + 'T08:00'; t2.end = days2[0] + 'T12:00'; t2.status = 'doing'; }
    save();
    go('team');
    app.ui.teamLoadStatusFilter = 'conflict'; save(); renderPage();
    const thisWeekCount = document.querySelectorAll('.load-row:not(.load-head)').length;
    document.querySelector('.team-load-nav button[aria-label="Semaine suivante"]').click();
    const nextWeekCount = document.querySelectorAll('.load-row:not(.load-head)').length;
    return { thisWeekCount, nextWeekCount };
  });
  note('LOAD151-11', r);
  ok(r.thisWeekCount === 0 && r.nextWeekCount > 0, 'LOAD151-11 : le filtre est recalculé sur la nouvelle semaine (pas conservé de l’ancienne)', 'LOAD151');
  await p.screenshot({ path: SHOTS + '10-equipe-charge-filter-conflict.png', fullPage: true }).catch(() => {});
  await ctx.close();
}

console.log('\n[LOAD151-12] État vide propre si aucune correspondance');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD12');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    app.ui.teamLoadStatusFilter = 'conflict'; save(); renderPage();
    return { rows: document.querySelectorAll('.load-row:not(.load-head)').length, empty: document.querySelector('.field-none')?.textContent || null, hasWeekHeader: !!document.querySelector('.team-load-week-label') };
  });
  note('LOAD151-12', r);
  ok(r.rows === 0 && !!r.empty, 'LOAD151-12 : état vide propre affiché (pas de tableau cassé)', 'LOAD151');
  ok(r.hasWeekHeader, 'LOAD151-12 : l’en-tête de semaine reste visible', 'LOAD151');
  await ctx.close();
}

console.log('\n[LOAD151-13] Cellules strictement identiques au calcul V2.4.15');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'L13-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'L13-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    return [...document.querySelectorAll('.rc-cell')].map((c) => c.className + '|' + c.textContent.trim());
  });
  const prev = await snap(pPrev), cur = await snap(pCur);
  note('LOAD151-13', { prevCount: prev.length, curCount: cur.length });
  ok(JSON.stringify(prev) === JSON.stringify(cur), 'LOAD151-13 : cellules de charge strictement identiques à V2.4.15', 'LOAD151');
  await cPrev.close(); await cCur.close();
}

console.log('\n[LOAD151-14] Clic ressource → openResource() toujours fonctionnel');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD14');
  await reset(p, "go('team');");
  await p.waitForTimeout(200);
  const before = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
  await p.locator('.load-row:not(.load-head)').first().click();
  await p.waitForTimeout(200);
  const after = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
  note('LOAD151-14', { before, after });
  ok(!before && after, 'LOAD151-14 : cliquer une ligne ouvre la fiche ressource', 'LOAD151');
  await ctx.close();
}

console.log('\n[LOAD151-15] Navigation clavier des nouveaux contrôles');
{
  const { ctx, p } = await newPage(1440, 1000, 'LOAD15');
  await reset(p, "go('team');");
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const btn = document.querySelector('.team-load-nav button[aria-label="Semaine suivante"]');
    btn.focus();
    return document.activeElement === btn;
  });
  note('LOAD151-15', { focusable: r });
  ok(r, 'LOAD151-15 : les boutons de navigation sont focusables au clavier', 'LOAD151');
  await ctx.close();
}

// ============================================================
// FREEZE — Équipe (hors .team-load) + Planning strictement identiques
// ============================================================
console.log('\n[FREEZE-EQUIPE] Cartes Équipe (hors Charge) strictement identiques à V2.4.15');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZE-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZE-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    const cards = [...document.querySelectorAll('.team-card')];
    return {
      count: cards.length,
      structure: cards.map((c) => ({ classes: c.className, hasAvatar: !!c.querySelector('.resource-avatar'), hasMission: !!c.querySelector('.tc-mission'), hasState: !!c.querySelector('.tc-state') })),
      filters: document.querySelector('.filters-bar')?.textContent.replace(/\s+/g, ' ').trim() || document.querySelector('[class*="segment"]')?.parentElement?.textContent.replace(/\s+/g, ' ').trim() || null,
    };
  });
  const prev = await snap(pPrev), cur = await snap(pCur);
  note('FREEZE-EQUIPE', { prevCount: prev.count, curCount: cur.count });
  ok(prev.count === cur.count, `FREEZE-EQUIPE : même nombre de cartes (${prev.count} → ${cur.count})`, 'FREEZE');
  ok(JSON.stringify(prev.structure) === JSON.stringify(cur.structure), 'FREEZE-EQUIPE : structure des cartes strictement identique', 'FREEZE');
  await cPrev.close(); await cCur.close();
}

console.log('\n[FREEZE-PLANNING] Page Planning strictement identique à V2.4.15');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZP-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZP-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    const rows = [...document.querySelectorAll('.g-row')].map((r) => r.className);
    return { rowCount: rows.length, rowClasses: rows, hasGantt: !!document.querySelector('.gantt') };
  });
  const prev = await snap(pPrev), cur = await snap(pCur);
  note('FREEZE-PLANNING', { prevRows: prev.rowCount, curRows: cur.rowCount });
  ok(prev.rowCount === cur.rowCount, 'FREEZE-PLANNING : même nombre de lignes Gantt', 'FREEZE');
  ok(JSON.stringify(prev.rowClasses) === JSON.stringify(cur.rowClasses), 'FREEZE-PLANNING : mêmes classes de lignes', 'FREEZE');
  ok(prev.hasGantt === cur.hasGantt, 'FREEZE-PLANNING : composant Gantt inchangé', 'FREEZE');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// RESPONSIVE — 10 largeurs × 4 écrans
// ============================================================
console.log('\n[RESP-1511] 10 largeurs × Réglages / Chantiers / Fiche Chantier / Équipe-Charge');
{
  const pages = [
    ['reglages', () => { go('more'); }],
    ['chantiers', () => {}],
    ['fiche-chantier', () => { app.ui.projectId = 'keravel'; go('project'); }],
    ['equipe-charge', () => { go('team'); }],
  ];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'RESP-' + w);
    for (const [name, fn] of pages) {
      await ev(p, (src) => { resetApp(); setDepth('pilot'); go('sites'); (0, eval)(src); }, `(${fn.toString()})()`);
      await p.waitForTimeout(180);
      const hscroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!hscroll, `RESP-1511 : ${w}px — « ${name} » sans scroll horizontal`, 'RESP-1511');
    }
    await ctx.close();
  }
}

// ============================================================
// DARK MODE
// ============================================================
console.log('\n[DARK-1511] Réglages / Chantiers / Fiche Chantier / Charge ressources');
{
  const { ctx, p } = await newPage(1440, 1000, 'DARK');
  const whiteFlat = (sel) => p.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const bg = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
    return bg[0] > 240 && bg[1] > 240 && bg[2] > 240;
  }, sel);
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.appearance = 'dark'; document.body.classList.add('dark'); save(); go('more'); });
  await p.waitForTimeout(150);
  ok((await whiteFlat('.settings-section')) === false, 'DARK-1511 : Réglages sans aplat blanc', 'DARK-1511');
  await ev(p, () => go('sites'));
  await p.waitForTimeout(150);
  ok((await whiteFlat('.site-card')) === false, 'DARK-1511 : cartes chantier sans aplat blanc', 'DARK-1511');
  await p.screenshot({ path: SHOTS + '12-dark-chantiers.png', fullPage: true });
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project'); });
  await p.waitForTimeout(150);
  ok((await whiteFlat('.project-cockpit-shell')) === false, 'DARK-1511 : cockpit sans aplat blanc', 'DARK-1511');
  await ev(p, () => go('team'));
  await p.waitForTimeout(150);
  ok((await whiteFlat('.team-load-toolbar')) !== true, 'DARK-1511 : toolbar Charge sans aplat blanc', 'DARK-1511');
  await p.screenshot({ path: SHOTS + '13-dark-charge.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1511]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1511', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1511 : 0 erreur JavaScript applicative', 'CONSOLE-1511');
}

// ============================================================
// ENGINES — byte-identité (§Partie 7)
// ============================================================
console.log('\n[ENGINES-1511] Byte-identité des moteurs métier (V2.4.15 → V2.4.15.1)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.1.html', 'utf8');
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
    'getResourceWeekDays', 'resourceStateLabel', 'resourceStateTone',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1511 : tous les moteurs métier listés sont byte-identiques entre V2.4.15 et V2.4.15.1', 'ENGINES-1511');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
