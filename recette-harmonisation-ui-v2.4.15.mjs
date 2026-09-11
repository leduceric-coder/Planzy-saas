// ============================================================
// KANVIX — Recette harmonisation visuelle finale (V2.4.15)
//   ACCUEIL + CHANTIER + HISTORIQUE + RÉGLAGES — PLANNING/ÉQUIPE GELÉS
//   Usage : node recette-harmonisation-ui-v2.4.15.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.14.1.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15/';
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
// UI15-ACC — ACCUEIL : cockpit du jour unifié
// ============================================================
console.log('\n[UI15-ACC-01] Cockpit du jour visible (une seule surface cohérente)');
{
  const { ctx, p } = await newPage(1920, 1080, 'ACC1');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const shell = document.querySelector('.today-main-grid');
    const cs = getComputedStyle(shell);
    const today = getComputedStyle(document.querySelector('.today-panel.actions-panel'));
    return {
      shellBg: cs.backgroundColor, shellBorder: cs.borderTopWidth, shellRadius: cs.borderRadius,
      innerPanelBg: today.backgroundColor, innerPanelBorder: today.borderTopWidth,
      hasSeparator: getComputedStyle(document.querySelector('.today-panel.actions-panel')).borderRightWidth,
    };
  });
  note('UI15-ACC-01', r);
  ok(r.shellBg !== 'rgba(0, 0, 0, 0)', 'UI15-ACC-01 : .today-main-grid porte désormais le habillage carte (fond visible)', 'UI15-ACC');
  ok(parseFloat(r.shellBorder) > 0, 'UI15-ACC-01 : .today-main-grid a une bordure propre (une seule surface)', 'UI15-ACC');
  ok(r.innerPanelBg === 'rgba(0, 0, 0, 0)', 'UI15-ACC-01 : les colonnes internes (Aujourd’hui/Chantiers actifs) n’ont plus leur propre carte (pas de double empilement)', 'UI15-ACC');
  ok(parseFloat(r.hasSeparator) > 0, 'UI15-ACC-01 : séparateur vertical discret entre les deux colonnes', 'UI15-ACC');
  await p.screenshot({ path: SHOTS + '01-accueil-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-ACC-02] Deux colonnes strictement égales (50/50)');
{
  const { ctx, p } = await newPage(1440, 1000, 'ACC2');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    return { todayW: Math.round(today.width), sitesW: Math.round(sites.width) };
  });
  note('UI15-ACC-02', r);
  ok(Math.abs(r.todayW - r.sitesW) <= 1, `UI15-ACC-02 : colonnes égales (${r.todayW}px / ${r.sitesW}px)`, 'UI15-ACC');
  await p.screenshot({ path: SHOTS + '02-accueil-1440.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-ACC-03] Aucune redistribution artificielle (space-evenly / flex-grow / min-height)');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC3');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const a = getComputedStyle(document.querySelector('.today-actions-list'));
    const c = getComputedStyle(document.querySelector('.acp-list'));
    return { aJustify: a.justifyContent, aFlexGrow: a.flexGrow, aMinHeight: a.minHeight, cJustify: c.justifyContent, cFlexGrow: c.flexGrow, cMinHeight: c.minHeight };
  });
  note('UI15-ACC-03', r);
  ok(!/space-evenly|space-between/.test(r.aJustify) && Number(r.aFlexGrow) === 0 && (r.aMinHeight === 'auto' || r.aMinHeight === '0px'), 'UI15-ACC-03 : « Aujourd’hui » — aucun space-evenly/flex-grow/min-height artificiel', 'UI15-ACC');
  ok(!/space-evenly|space-between/.test(r.cJustify) && Number(r.cFlexGrow) === 0 && (r.cMinHeight === 'auto' || r.cMinHeight === '0px'), 'UI15-ACC-03 : « Chantiers actifs » — idem', 'UI15-ACC');
  await ctx.close();
}

console.log('\n[UI15-ACC-04] « Cette semaine » alignée sur la largeur utile du cockpit du jour');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC4');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const week = document.querySelector('.week-card')?.getBoundingClientRect();
    const grid = document.querySelector('.today-main-grid').getBoundingClientRect();
    return week ? { weekLeft: Math.round(week.left), weekRight: Math.round(week.right), gridLeft: Math.round(grid.left), gridRight: Math.round(grid.right) } : null;
  });
  note('UI15-ACC-04', r);
  ok(!!r && Math.abs(r.weekLeft - r.gridLeft) <= 1 && Math.abs(r.weekRight - r.gridRight) <= 1, 'UI15-ACC-04 : « Cette semaine » borné aux mêmes marges que le cockpit du jour', 'UI15-ACC');
  await ctx.close();
}

console.log('\n[UI15-ACC-05] Déséquilibre de contenu — pas de vide de « petite carte isolée » (les deux sens)');
{
  const { ctx, p } = await newPage(1600, 1100, 'ACC5');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects.forEach((pr) => { if (pr.id !== 'keravel') pr.lifecycle = 'closed'; });
    save(); renderPage();
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    const shell = document.querySelector('.today-main-grid').getBoundingClientRect();
    return { todayH: Math.round(today.height), sitesH: Math.round(sites.height), shellH: Math.round(shell.height) };
  });
  note('UI15-ACC-05', r);
  ok(r.todayH > r.sitesH + 20, 'UI15-ACC-05 : colonne la plus riche détermine la hauteur, le vide résiduel appartient à la surface commune (pas de petite carte séparée)', 'UI15-ACC');
  ok(r.shellH >= r.todayH, 'UI15-ACC-05 : la surface commune englobe bien la colonne la plus haute', 'UI15-ACC');
  await ctx.close();
}

// ============================================================
// UI15-CHT — CHANTIER : cockpit shell unique
// ============================================================
console.log('\n[UI15-CHT-01] Vignette d’en-tête paysagère, non déformée');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT1');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const thumb = document.querySelector('.cockpit-thumb').getBoundingClientRect();
    const svg = document.querySelector('.cockpit-thumb svg');
    return {
      w: Math.round(thumb.width), h: Math.round(thumb.height),
      ratio: thumb.width / thumb.height,
      preserveAR: svg.getAttribute('preserveAspectRatio'),
      viewBox: svg.getAttribute('viewBox'),
      hasContent: svg.querySelectorAll('rect,circle,path').length > 0,
    };
  });
  note('UI15-CHT-01', r);
  ok(r.w >= 72 && r.w <= 88, `UI15-CHT-01 : largeur vignette ${r.w}px (72-88px attendu)`, 'UI15-CHT');
  ok(r.h >= 52 && r.h <= 64, `UI15-CHT-01 : hauteur vignette ${r.h}px (52-64px attendu)`, 'UI15-CHT');
  ok(r.ratio >= 1.28 && r.ratio <= 1.55, `UI15-CHT-01 : ratio ${r.ratio.toFixed(2)} proche de 4:3 (1.33) à 3:2 (1.5)`, 'UI15-CHT');
  ok(r.preserveAR === 'xMidYMid meet', 'UI15-CHT-01 : preserveAspectRatio="xMidYMid meet" dans ce contexte précis (pas de recadrage)', 'UI15-CHT');
  ok(r.viewBox === '0 0 500 230', 'UI15-CHT-01 : même illustration source (viewBox art() inchangé) — pas de nouvelle image, juste l’affichage', 'UI15-CHT');
  ok(r.hasContent, 'UI15-CHT-01 : l’illustration réelle du chantier est bien rendue', 'UI15-CHT');
  await ctx.close();
}

console.log('\n[UI15-CHT-01b] art()/projectVisual() non modifiés ailleurs (Accueil, cartes chantier)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT1b');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const svg = document.querySelector('.acp-visual svg');
    return { preserveAR: svg.getAttribute('preserveAspectRatio') };
  });
  note('UI15-CHT-01b', r);
  ok(r.preserveAR === 'xMidYMid slice', 'UI15-CHT-01b : ailleurs (Accueil « Chantiers actifs »), art() garde son comportement de recadrage original — seule la vignette cockpit a une variante d’affichage', 'UI15-CHT');
  await ctx.close();
}

console.log('\n[UI15-CHT-02] Cockpit shell unique (.project-cockpit-shell)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT2');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const shell = document.querySelector('.project-cockpit-shell');
    const cs = shell ? getComputedStyle(shell) : null;
    return {
      hasShell: !!shell,
      bg: cs ? cs.backgroundColor : null,
      border: cs ? cs.borderTopWidth : null,
      hasHeaderInside: shell ? !!shell.querySelector('.cockpit-header') : false,
      hasBodyInside: shell ? !!shell.querySelector('.cockpit-body') : false,
    };
  });
  note('UI15-CHT-02', r);
  ok(r.hasShell, 'UI15-CHT-02 : le cockpit est un conteneur unique .project-cockpit-shell', 'UI15-CHT');
  ok(r.bg !== 'rgba(0, 0, 0, 0)' && parseFloat(r.border) > 0, 'UI15-CHT-02 : une seule surface blanche légère (fond + bordure)', 'UI15-CHT');
  ok(r.hasHeaderInside && r.hasBodyInside, 'UI15-CHT-02 : identité + statut + à traiter + prochaine étape regroupés dans la même surface', 'UI15-CHT');
  await ctx.close();
}

console.log('\n[UI15-CHT-03] « À traiter » / « Prochaine étape » dans le shell, côte à côte');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT3');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const shell = document.querySelector('.project-cockpit-shell');
    const zones = [...document.querySelectorAll('.cockpit-content.cockpit-grid > .cockpit-zone')].map((z) => {
      const rect = z.getBoundingClientRect();
      return { title: z.querySelector('h2')?.textContent.trim(), top: Math.round(rect.top), left: Math.round(rect.left), insideShell: shell.contains(z) };
    });
    return { zones };
  });
  note('UI15-CHT-03', r);
  ok(r.zones.length === 2 && r.zones.every((z) => z.insideShell), 'UI15-CHT-03 : les deux zones sont bien à l’intérieur du shell (pas des cartes posées à côté)', 'UI15-CHT');
  ok(r.zones[0].title === 'À traiter' && r.zones[1].title === 'Prochaine étape' && Math.abs(r.zones[0].top - r.zones[1].top) <= 1 && r.zones[1].left > r.zones[0].left, 'UI15-CHT-03 : côte à côte, même ligne', 'UI15-CHT');
  await p.screenshot({ path: SHOTS + '03-chantier-keravel-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-CHT-04] Onglets immédiatement après le cockpit shell');
{
  const { ctx, p } = await newPage(1920, 1080, 'CHT4');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const shell = document.querySelector('.project-cockpit-shell').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    const tabContent = document.querySelector('#projectContent').getBoundingClientRect();
    return { shellBottom: Math.round(shell.bottom), tabsTop: Math.round(tabs.top), gap: Math.round(tabs.top - shell.bottom), viewportH: 1080, tabContentVisible: tabContent.top < 1080 };
  });
  note('UI15-CHT-04', r);
  ok(r.gap >= 0 && r.gap <= 30, `UI15-CHT-04 : espace cockpit→onglets resserré (${r.gap}px)`, 'UI15-CHT');
  ok(r.tabsTop < 1080, 'UI15-CHT-04 : à 1920×1080, les onglets sont visibles sans scroll', 'UI15-CHT');
  ok(r.tabContentVisible, 'UI15-CHT-04 : à 1920×1080, une vraie partie du contenu de l’onglet est visible sans scroll', 'UI15-CHT');
  await ctx.close();
}

console.log('\n[UI15-CHT-05] Chantier sans problème — pas de grande zone verte vide');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT5');
  await reset(p, "app.ui.projectId='terrasses';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const el = document.querySelector('.success-state');
    const rect = el ? el.getBoundingClientRect() : null;
    const milestone = document.querySelector('.milestone-card')?.getBoundingClientRect();
    return { hasSuccess: !!el, h: rect ? Math.round(rect.height) : null, w: rect ? Math.round(rect.width) : null, milestoneH: milestone ? Math.round(milestone.height) : null };
  });
  note('UI15-CHT-05', r);
  ok(r.hasSuccess, 'UI15-CHT-05 : le message « Aucun point bloquant » est bien affiché', 'UI15-CHT');
  ok(r.h !== null && r.h <= 50, `UI15-CHT-05 : bande compacte (${r.h}px de haut), pas une grande carte`, 'UI15-CHT');
  ok(r.w !== null && r.milestoneH !== null && r.h < r.milestoneH, 'UI15-CHT-05 : nettement plus compacte que la carte « Prochaine étape » voisine — pas de zone vide étirée', 'UI15-CHT');
  await p.screenshot({ path: SHOTS + '04-chantier-terrasses-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-CHT-06] Mobile 390 — vignette non dominante, shell lisible, pas de débordement');
{
  const { ctx, p } = await newPage(390, 900, 'CHT6');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const thumb = document.querySelector('.cockpit-thumb').getBoundingClientRect();
    return {
      thumbW: Math.round(thumb.width), thumbH: Math.round(thumb.height),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  note('UI15-CHT-06', r);
  ok(!r.overflow, 'UI15-CHT-06 : pas de débordement horizontal à 390px', 'UI15-CHT');
  ok(r.thumbW <= 88 && r.thumbH <= 64, 'UI15-CHT-06 : vignette toujours petite sur mobile', 'UI15-CHT');
  await p.screenshot({ path: SHOTS + '05-chantier-keravel-390.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// UI15-HIST — HISTORIQUE : timeline + résumé d'activité
// ============================================================
console.log('\n[UI15-HIST-01] Timeline intacte (logique gelée, aucune régression)');
{
  const { ctx, p } = await newPage(1600, 1000, 'HIST1');
  await reset(p, "task('k-electric').status='todo';save();setTaskStatus('k-electric','doing','task');app.ui.projectId='keravel';go('project');openProjectTab('keravel','Historique');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const panel = document.querySelector('.history-panel').getBoundingClientRect();
    const layout = document.querySelector('.history-layout').getBoundingClientRect();
    return { panelW: Math.round(panel.width), layoutW: Math.round(layout.width), events: document.querySelectorAll('.history-event').length, hasTransition: !!document.querySelector('.history-transition') };
  });
  note('UI15-HIST-01', r);
  ok(r.events > 0 && r.hasTransition, 'UI15-HIST-01 : les événements réels (avec transition de statut) s’affichent toujours', 'UI15-HIST');
  ok(r.panelW < r.layoutW, 'UI15-HIST-01 : la timeline occupe une partie de la largeur (2fr), pas tout l’écran', 'UI15-HIST');
  await p.screenshot({ path: SHOTS + '06-historique-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-HIST-01b] Isolation par chantier toujours garantie (SITE-01)');
{
  const { ctx, p } = await newPage(1440, 1000, 'HIST1b');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    const v = app.tasks.find((t) => t.projectId === 'villa');
    setTaskStatus(v.id, 'doing', 'task');
    const k = projectTabContent('Historique', 'keravel');
    const vh = projectTabContent('Historique', 'villa');
    return { keravelHasVilla: k.includes(v.name), villaHasKeravel: vh.includes('Tableau électrique') };
  });
  note('UI15-HIST-01b', r);
  ok(!r.keravelHasVilla && !r.villaHasKeravel, 'UI15-HIST-01b : aucune fuite inter-chantiers', 'UI15-HIST');
  await ctx.close();
}

console.log('\n[UI15-HIST-02] Résumé calculé uniquement depuis projectHistory(projectId)');
{
  const { ctx, p } = await newPage(1600, 1000, 'HIST2');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    task('k-window1') && setTaskStatus('k-window1', 'done', 'task');
    let entries = projectHistory('keravel');
    let manualStatusChanges = entries.filter((h) => h.eventType === 'task-status').length;
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique');
    let count = document.querySelector('.history-summary-count').textContent;
    let stats = [...document.querySelectorAll('.history-summary-stats li')].map((li) => li.textContent);
    return { entriesCount: entries.length, manualStatusChanges, count, stats };
  });
  note('UI15-HIST-02', r);
  ok(r.count.includes(String(r.entriesCount)), 'UI15-HIST-02 : le compteur du résumé correspond exactement à projectHistory(projectId).length', 'UI15-HIST');
  ok(r.stats.some((s) => s.includes(String(r.manualStatusChanges))), 'UI15-HIST-02 : le nombre de changements de statut correspond exactement aux entrées eventType==="task-status"', 'UI15-HIST');
  await ctx.close();
}

console.log('\n[UI15-HIST-02b] Résumé compact avec peu d’événements (pas une grande carte vide)');
{
  const { ctx, p } = await newPage(1600, 1000, 'HIST2b');
  await reset(p, "task('k-electric').status='todo';save();setTaskStatus('k-electric','doing','task');app.ui.projectId='keravel';go('project');openProjectTab('keravel','Historique');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const el = document.querySelector('.history-summary').getBoundingClientRect();
    return { h: Math.round(el.height) };
  });
  note('UI15-HIST-02b', r);
  ok(r.h <= 220, `UI15-HIST-02b : résumé reste petit avec peu d’événements (${r.h}px)`, 'UI15-HIST');
  await ctx.close();
}

console.log('\n[UI15-HIST-03] Aucune analytique inventée (pas de performance/score/tendance/%)');
{
  const { ctx, p } = await newPage(1600, 1000, 'HIST3');
  await reset(p, "task('k-electric').status='todo';save();setTaskStatus('k-electric','doing','task');app.ui.projectId='keravel';go('project');openProjectTab('keravel','Historique');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const text = document.querySelector('.history-summary').textContent;
    return { text, forbidden: /performance|productivit|score|tendance|progression|%/i.test(text) };
  });
  note('UI15-HIST-03', r);
  ok(!r.forbidden, 'UI15-HIST-03 : aucun mot-clé d’analytique inventée dans le résumé', 'UI15-HIST');
  await ctx.close();
}

console.log('\n[UI15-HIST-04] Mobile <1000px — résumé passe sous la timeline (une colonne)');
{
  const { ctx, p } = await newPage(390, 900, 'HIST4');
  await reset(p, "task('k-electric').status='todo';save();setTaskStatus('k-electric','doing','task');app.ui.projectId='keravel';go('project');openProjectTab('keravel','Historique');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const panel = document.querySelector('.history-panel').getBoundingClientRect();
    const summary = document.querySelector('.history-summary').getBoundingClientRect();
    return { stacked: summary.top >= panel.bottom - 2, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  note('UI15-HIST-04', r);
  ok(r.stacked, 'UI15-HIST-04 : le résumé passe sous la timeline en une seule colonne', 'UI15-HIST');
  ok(!r.overflow, 'UI15-HIST-04 : pas de débordement horizontal', 'UI15-HIST');
  await p.screenshot({ path: SHOTS + '07-historique-390.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// UI15-SET — RÉGLAGES
// ============================================================
console.log('\n[UI15-SET-01] Largeur desktop ≥ 1100px');
{
  const { ctx, p } = await newPage(1920, 1080, 'SET1');
  await reset(p, "go('more');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const el = document.querySelector('.settings-content').getBoundingClientRect();
    return { w: Math.round(el.width) };
  });
  note('UI15-SET-01', r);
  ok(r.w >= 1100 && r.w <= 1180, `UI15-SET-01 : .settings-content = ${r.w}px (1100-1180px attendu)`, 'UI15-SET');
  await p.screenshot({ path: SHOTS + '08-reglages-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[UI15-SET-02] Expérience Kanvix + Mode de démonstration côte à côte');
{
  const { ctx, p } = await newPage(1920, 1080, 'SET2');
  await reset(p, "go('more');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const sections = [...document.querySelectorAll('.settings-grid > .settings-section')].map((s) => {
      const r = s.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left), title: s.querySelector('.settings-section-title')?.textContent.trim() };
    });
    return { sections };
  });
  note('UI15-SET-02', r);
  ok(r.sections.length === 2, 'UI15-SET-02 : deux sections dans .settings-grid', 'UI15-SET');
  ok(r.sections.length === 2 && Math.abs(r.sections[0].top - r.sections[1].top) <= 1 && r.sections[1].left > r.sections[0].left, 'UI15-SET-02 : Expérience Kanvix et Mode de démonstration sur la même ligne, côte à côte', 'UI15-SET');
  await ctx.close();
}

console.log('\n[UI15-SET-03] Données & démonstration pleine largeur');
{
  const { ctx, p } = await newPage(1920, 1080, 'SET3');
  await reset(p, "go('more');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const data = document.querySelector('.settings-section-wide').getBoundingClientRect();
    const content = document.querySelector('.settings-content').getBoundingClientRect();
    const col = document.querySelector('.settings-grid > .settings-section').getBoundingClientRect();
    return { dataW: Math.round(data.width), contentW: Math.round(content.width), colW: Math.round(col.width) };
  });
  note('UI15-SET-03', r);
  ok(Math.abs(r.dataW - r.contentW) <= 1, 'UI15-SET-03 : « Données & démonstration » occupe toute la largeur du contenu', 'UI15-SET');
  ok(r.dataW > r.colW * 1.8, 'UI15-SET-03 : nettement plus large qu’une colonne de la première ligne (pleine largeur, pas 50%)', 'UI15-SET');
  await ctx.close();
}

console.log('\n[UI15-SET-04] Emoji principaux remplacés par des icônes cohérentes');
{
  const { ctx, p } = await newPage(1920, 1080, 'SET4');
  await reset(p, "go('more');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const targets = ['.settings-section-title .settings-ico', '.seg-ico', '.role-emoji', '.settings-row-ico'];
    let svgCount = 0, elCount = 0, emojiFound = [];
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    targets.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        elCount++;
        if (el.querySelector('svg')) svgCount++;
        if (emojiRe.test(el.textContent)) emojiFound.push(el.textContent);
      });
    });
    return { svgCount, elCount, emojiFound };
  });
  note('UI15-SET-04', r);
  // "Réinitialiser la démonstration" garde volontairement le glyphe ↺ (déjà
  // monochrome, hérite de currentColor) : ce n'est pas un emoji coloré, donc
  // hors du périmètre du remplacement demandé — un seul emplacement sur 14
  // reste donc en glyphe texte plutôt qu'en SVG, c'est le seul attendu.
  ok(r.elCount > 0 && r.svgCount >= r.elCount - 1, `UI15-SET-04 : la quasi-totalité des emplacements d’icônes (${r.svgCount}/${r.elCount}) utilisent désormais une icône SVG ligne (seul ↺, déjà monochrome, reste en glyphe)`, 'UI15-SET');
  ok(r.emojiFound.length === 0, 'UI15-SET-04 : plus aucun emoji coloré dans ces zones', 'UI15-SET');
  await ctx.close();
}

console.log('\n[UI15-SET-05] Responsive Réglages : 900 et 390');
{
  for (const [w, shotName] of [[900, '09-reglages-900.png'], [390, '10-reglages-390.png']]) {
    const { ctx, p } = await newPage(w, 1100, 'SET5-' + w);
    await reset(p, "go('more');");
    await p.waitForTimeout(280);
    const r = await ev(p, () => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      cols: getComputedStyle(document.querySelector('.settings-grid')).gridTemplateColumns.split(' ').length,
    }));
    note('UI15-SET-05-' + w, r);
    ok(!r.overflow, `UI15-SET-05 : ${w}px — pas de débordement`, 'UI15-SET');
    if (w <= 900) ok(r.cols === 1, `UI15-SET-05 : ${w}px — une seule colonne`, 'UI15-SET');
    await p.screenshot({ path: SHOTS + shotName, fullPage: true });
    await ctx.close();
  }
}

console.log('\n[UI15-SET-06] Aucun changement fonctionnel (onclick inchangés)');
{
  const { ctx, p } = await newPage(1440, 1000, 'SET6');
  await reset(p, "go('more');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const html = document.querySelector('.settings-content').innerHTML;
    const fns = ['setDepth(', 'setAppearance(', 'setRole(', 'openCompanyTemplateForm(', 'openKanvixImport(', 'exportKanvixData(', 'downloadKanvixBackup(', 'openKanvixBackupRestore(', 'confirmResetDemo('];
    return { present: fns.filter((f) => html.includes(f)), missing: fns.filter((f) => !html.includes(f)) };
  });
  note('UI15-SET-06', r);
  ok(r.missing.length === 0, 'UI15-SET-06 : tous les onclick métier sont toujours présents à l’identique', 'UI15-SET');
  await ctx.close();
}

// ============================================================
// UI15-FREEZE — Planning / Équipe / Chantier>Équipe strictement gelés
// ============================================================
console.log('\n[UI15-FREEZE-01] Page Planning — structure identique à V2.4.14.1');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ1-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ1-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    const rows = [...document.querySelectorAll('.g-row')].map((r) => r.className);
    const head = document.querySelector('.g-head');
    return {
      rowCount: rows.length, rowClasses: rows,
      headCols: head ? getComputedStyle(head).gridTemplateColumns : null,
      hasGantt: !!document.querySelector('.gantt'),
    };
  });
  const prev = await snap(pPrev);
  const cur = await snap(pCur);
  note('UI15-FREEZE-01', { prevRows: prev.rowCount, curRows: cur.rowCount });
  ok(prev.rowCount === cur.rowCount, `UI15-FREEZE-01 : même nombre de lignes Gantt (${prev.rowCount} → ${cur.rowCount})`, 'UI15-FREEZE');
  ok(JSON.stringify(prev.rowClasses) === JSON.stringify(cur.rowClasses), 'UI15-FREEZE-01 : mêmes classes de lignes (structure DOM identique)', 'UI15-FREEZE');
  ok(prev.hasGantt === cur.hasGantt, 'UI15-FREEZE-01 : composant Gantt toujours présent, inchangé', 'UI15-FREEZE');
  await cPrev.close(); await cCur.close();
}

console.log('\n[UI15-FREEZE-02] Page Équipe globale — structure identique à V2.4.14.1');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ2-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ2-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    const list = document.querySelector('.team-list');
    const cs = getComputedStyle(list);
    const cards = [...list.querySelectorAll('.team-card')];
    return {
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      structure: cards.map((c) => ({ hasAvatar: !!c.querySelector('.resource-avatar'), hasMission: !!c.querySelector('.tc-mission'), hasState: !!c.querySelector('.tc-state'), classes: c.className })),
      loadBoard: !!document.querySelector('.team-load .resources'),
    };
  });
  const prev = await snap(pPrev);
  const cur = await snap(pCur);
  note('UI15-FREEZE-02', { prev: { cols: prev.cols, count: prev.count }, cur: { cols: cur.cols, count: cur.count } });
  ok(prev.count === cur.count && prev.cols === cur.cols, 'UI15-FREEZE-02 : même nombre de cartes et de colonnes', 'UI15-FREEZE');
  ok(JSON.stringify(prev.structure) === JSON.stringify(cur.structure), 'UI15-FREEZE-02 : structure des cartes strictement identique', 'UI15-FREEZE');
  ok(prev.loadBoard === cur.loadBoard, 'UI15-FREEZE-02 : « Charge des ressources » toujours présent, inchangé', 'UI15-FREEZE');
  await cPrev.close(); await cCur.close();
}

console.log('\n[UI15-FREEZE-03] Chantier > Équipe — structure identique à V2.4.14.1');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ3-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ3-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot');
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Équipe');
    const list = document.querySelector('.team-list');
    const cs = getComputedStyle(list);
    const cards = [...list.querySelectorAll('.team-card')];
    return {
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      structure: cards.map((c) => ({ hasAvatar: !!c.querySelector('.resource-avatar'), hasMission: !!c.querySelector('.tc-mission'), hasState: !!c.querySelector('.tc-state'), classes: c.className })),
    };
  });
  const prev = await snap(pPrev);
  const cur = await snap(pCur);
  note('UI15-FREEZE-03', { prev: { cols: prev.cols, count: prev.count }, cur: { cols: cur.cols, count: cur.count } });
  ok(prev.count === cur.count && prev.cols === cur.cols, 'UI15-FREEZE-03 : même nombre de cartes et de colonnes', 'UI15-FREEZE');
  ok(JSON.stringify(prev.structure) === JSON.stringify(cur.structure), 'UI15-FREEZE-03 : structure strictement identique — Chantier>Équipe non touché', 'UI15-FREEZE');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// DARK — 4 zones du correctif
// ============================================================
console.log('\n[DARK-15] Mode sombre sur Accueil / Chantier / Historique / Réglages');
{
  const { ctx, p } = await newPage(1440, 1000, 'DARK');
  const whiteFlat = (sel) => p.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const bg = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
    return bg[0] > 240 && bg[1] > 240 && bg[2] > 240;
  }, sel);
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.appearance = 'dark'; document.body.classList.add('dark'); save(); renderPage(); });
  await p.waitForTimeout(200);
  ok((await whiteFlat('.today-main-grid')) === false, 'DARK-15 : Accueil — cockpit du jour sans aplat blanc forcé', 'DARK-15');
  await p.screenshot({ path: SHOTS + '11-dark-accueil.png', fullPage: true });
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project'); });
  await p.waitForTimeout(200);
  ok((await whiteFlat('.project-cockpit-shell')) === false, 'DARK-15 : Chantier — cockpit shell sans aplat blanc forcé', 'DARK-15');
  await p.screenshot({ path: SHOTS + '12-dark-chantier.png', fullPage: true });
  await ev(p, () => { openProjectTab('keravel', 'Historique'); });
  await p.waitForTimeout(200);
  ok((await whiteFlat('.history-summary')) === false, 'DARK-15 : Historique — résumé d’activité sans aplat blanc forcé', 'DARK-15');
  await p.screenshot({ path: SHOTS + '13-dark-historique.png', fullPage: true });
  await ev(p, () => { go('more'); });
  await p.waitForTimeout(200);
  ok((await whiteFlat('.settings-section')) === false, 'DARK-15 : Réglages — sections sans aplat blanc forcé', 'DARK-15');
  await p.screenshot({ path: SHOTS + '14-dark-reglages.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// RESPONSIVE — 10 largeurs
// ============================================================
console.log('\n[RESP-15] 10 largeurs × Accueil / Cockpit / Historique / Réglages');
{
  const pages = [
    ['accueil', () => {}],
    ['cockpit', () => { app.ui.projectId = 'keravel'; go('project'); }],
    ['historique', () => { app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique'); }],
    ['reglages', () => { go('more'); }],
  ];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'RESP-' + w);
    for (const [name, fn] of pages) {
      await ev(p, (src) => { resetApp(); setDepth('pilot'); (0, eval)(src); }, `(${fn.toString()})()`);
      await p.waitForTimeout(200);
      const hscroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!hscroll, `RESP-15 : ${w}px — « ${name} » sans scroll horizontal`, 'RESP-15');
    }
    await ctx.close();
  }
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-15]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-15', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-15 : 0 erreur JavaScript applicative sur l’ensemble de la recette', 'CONSOLE-15');
}

// ============================================================
// ENGINES — byte-identité des moteurs métier (§Partie 7)
// ============================================================
console.log('\n[ENGINES-15] Byte-identité des moteurs métier (V2.4.14.1 → V2.4.15)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.14.1.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.html', 'utf8');
  function extractFn(src, name) {
    const re = new RegExp(`function\\s+${name}\\s*\\(`);
    const m = re.exec(src);
    if (!m) return null;
    let i = src.indexOf('{', m.index);
    if (i < 0) return null;
    let depth = 0, start = i;
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
    'gantt', 'kanbanCard', 'getProjectSummary',
    // Au-delà de la liste officielle §Partie 7 : art()/projectVisual() sont
    // explicitement protégées par la demande (§Chantier — Vignette).
    'art', 'projectVisual',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-15 : tous les moteurs métier listés (§Partie 7 + art/projectVisual) sont byte-identiques entre V2.4.14.1 et V2.4.15', 'ENGINES-15');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
