// ============================================================
// KANVIX — Recette correctif ciblé UI (V2.4.14.1)
//   ACCUEIL + COCKPIT CHANTIER + HISTORIQUE — ÉQUIPE GELÉE
//   Usage : node recette-correctif-ui-v2.4.14.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.14.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.14.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.14.1/';
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
// ACC-141 — ACCUEIL : colonnes strictement égales + hauteur naturelle
// ============================================================
console.log('\n[ACC-141-01] Colonnes Aujourd’hui / Chantiers actifs strictement égales');
{
  const { ctx, p } = await newPage(1920, 1000, 'ACC1');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    const grid = getComputedStyle(document.querySelector('.today-main-grid')).gridTemplateColumns;
    return { todayW: Math.round(today.width), sitesW: Math.round(sites.width), todayLeft: Math.round(today.left), sitesLeft: Math.round(sites.left), grid };
  });
  note('ACC-141-01', r);
  ok(Math.abs(r.todayW - r.sitesW) <= 1, `ACC-141-01 : « Aujourd’hui » (${r.todayW}px) et « Chantiers actifs » (${r.sitesW}px) ont EXACTEMENT la même largeur (plus de 1.4fr/1fr)`, 'ACC-141');
  await p.screenshot({ path: SHOTS + '01-accueil-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[ACC-141-02] Colonnes égales à 1440px + capture de référence');
{
  const { ctx, p } = await newPage(1440, 1000, 'ACC2');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    return { todayW: Math.round(today.width), sitesW: Math.round(sites.width) };
  });
  note('ACC-141-02', r);
  ok(Math.abs(r.todayW - r.sitesW) <= 1, 'ACC-141-02 : colonnes égales également à 1440px (régression viewport)', 'ACC-141');
  await p.screenshot({ path: SHOTS + '02-accueil-1440.png', fullPage: true });
  await ctx.close();
}

console.log('\n[ACC-141-03] Hauteur naturelle — 5 actions du jour / 1 seul chantier actif (déséquilibre A)');
{
  const { ctx, p } = await newPage(1600, 1100, 'ACC3');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // 1 seul chantier actif → liste "Chantiers actifs" courte
    app.projects.forEach((pr) => { if (pr.id !== 'keravel') pr.lifecycle = 'closed'; });
    save(); renderPage();
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    const acpRows = document.querySelectorAll('.acp-row').length;
    const tpRows = document.querySelectorAll('.tp-row').length;
    return { todayH: Math.round(today.height), sitesH: Math.round(sites.height), acpRows, tpRows, diff: Math.round(today.height - sites.height) };
  });
  note('ACC-141-03', r);
  ok(r.acpRows === 1, 'ACC-141-03 : un seul chantier actif restant (mise en scène du déséquilibre)', 'ACC-141');
  ok(r.diff > 20, `ACC-141-03 : « Aujourd’hui » (${r.todayH}px, plus de contenu) est PLUS HAUT que « Chantiers actifs » (${r.sitesH}px) — hauteur naturelle, aucune égalisation forcée`, 'ACC-141');
  await ctx.close();
}

console.log('\n[ACC-141-04] Hauteur naturelle — 1 action du jour / 4 chantiers actifs (déséquilibre B, sens inverse)');
{
  const { ctx, p } = await newPage(1600, 1100, 'ACC4');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Ne garder qu'une seule action du jour
    const todayTasks = app.tasks.filter((t) => dayKey(t.start) === dayKey(TODAY));
    const future = new Date(new Date(TODAY).getTime() + 8 * 86400000);
    todayTasks.slice(1).forEach((t) => { t.start = future.toISOString(); t.end = new Date(future.getTime() + 3600000).toISOString(); });
    save(); renderPage();
    const today = document.querySelector('.today-panel.actions-panel').getBoundingClientRect();
    const sites = document.querySelector('.today-panel.projects-panel').getBoundingClientRect();
    const tpRows = document.querySelectorAll('.tp-row').length;
    const acpRows = document.querySelectorAll('.acp-row').length;
    return { todayH: Math.round(today.height), sitesH: Math.round(sites.height), tpRows, acpRows, diff: Math.round(sites.height - today.height) };
  });
  note('ACC-141-04', r);
  ok(r.tpRows <= 1, 'ACC-141-04 : une seule action du jour restante (mise en scène du déséquilibre inverse)', 'ACC-141');
  ok(r.diff > 20, `ACC-141-04 : « Chantiers actifs » (${r.sitesH}px, plus de contenu) est PLUS HAUT que « Aujourd’hui » (${r.todayH}px) — même logique dans l’autre sens`, 'ACC-141');
  await p.screenshot({ path: SHOTS + '03-accueil-contenu-desequilibre.png', fullPage: true });
  await ctx.close();
}

console.log('\n[ACC-141-05] Aucune redistribution artificielle (space-evenly / flex:1 retirés)');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC5');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const a = getComputedStyle(document.querySelector('.today-actions-list'));
    const c = getComputedStyle(document.querySelector('.acp-list'));
    return { aJustify: a.justifyContent, aFlexGrow: a.flexGrow, cJustify: c.justifyContent, cFlexGrow: c.flexGrow };
  });
  note('ACC-141-05', r);
  ok(r.aJustify !== 'space-evenly' && r.aJustify !== 'space-between' && Number(r.aFlexGrow) === 0, 'ACC-141-05 : « Aujourd’hui » — plus de justify-content:space-evenly ni de flex:1 (flux naturel)', 'ACC-141');
  ok(r.cJustify !== 'space-evenly' && r.cJustify !== 'space-between' && Number(r.cFlexGrow) === 0, 'ACC-141-05 : « Chantiers actifs » — même correctif', 'ACC-141');
  await ctx.close();
}

console.log('\n[ACC-141-06] Vignettes de synthèse (À décider / À surveiller) toujours égales (non-régression)');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC6');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const cs = getComputedStyle(document.querySelector('.attention-grid'));
    const cards = [...document.querySelectorAll('.attention-card')];
    return { cols: cs.gridTemplateColumns, widths: cards.map((c) => Math.round(c.getBoundingClientRect().width)) };
  });
  note('ACC-141-06', r);
  ok(r.widths.length === 2 && Math.abs(r.widths[0] - r.widths[1]) <= 1, 'ACC-141-06 : « À décider »/« À surveiller » toujours de largeur strictement égale (zone gelée, non régressée)', 'ACC-141');
  await ctx.close();
}

console.log('\n[ACC-141-07] « Cette semaine » toujours aligné sur la largeur utile de la page');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC7');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const week = document.querySelector('.week-card')?.getBoundingClientRect();
    const grid = document.querySelector('.today-main-grid').getBoundingClientRect();
    return week ? { weekLeft: Math.round(week.left), weekRight: Math.round(week.right), gridLeft: Math.round(grid.left), gridRight: Math.round(grid.right) } : null;
  });
  note('ACC-141-07', r);
  ok(!!r && Math.abs(r.weekLeft - r.gridLeft) <= 1 && Math.abs(r.weekRight - r.gridRight) <= 1, 'ACC-141-07 : « Cette semaine » toujours borné aux mêmes marges que le bloc principal', 'ACC-141');
  await ctx.close();
}

// ============================================================
// CHT-141 — CHANTIER : cockpit recomposé (vignette header + zones côte à côte)
// ============================================================
console.log('\n[CHT-141-01] Vignette dans l’en-tête, petite (64-80px), non dominante');
{
  const { ctx, p } = await newPage(1920, 1000, 'CHT1');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const thumb = document.querySelector('.cockpit-thumb');
    const rect = thumb ? thumb.getBoundingClientRect() : null;
    return {
      hasThumbInHeader: !!document.querySelector('.cockpit-header .cockpit-thumb'),
      hasOldVisualInBody: !!document.querySelector('.cockpit-body .cockpit-visual'),
      thumbW: rect ? Math.round(rect.width) : null, thumbH: rect ? Math.round(rect.height) : null,
      hasSvg: !!document.querySelector('.cockpit-thumb svg'),
      title: document.querySelector('.cockpit-header h1').textContent.trim(),
    };
  });
  note('CHT-141-01', r);
  ok(r.hasThumbInHeader, 'CHT-141-01 : la vignette vit dans l’en-tête (.cockpit-header .cockpit-thumb)', 'CHT-141');
  ok(!r.hasOldVisualInBody, 'CHT-141-01 : plus aucune colonne vignette dans le corps du cockpit (.cockpit-visual)', 'CHT-141');
  ok(r.thumbW >= 64 && r.thumbW <= 80 && r.thumbH >= 64 && r.thumbH <= 80, `CHT-141-01 : vignette petite (${r.thumbW}×${r.thumbH}px, plage 64-80px attendue)`, 'CHT-141');
  ok(r.hasSvg, 'CHT-141-01 : l’illustration du chantier reste rendue (identité visuelle conservée)', 'CHT-141');
  ok(r.title === 'Résidence Keravel', 'CHT-141-01 : nom du chantier toujours prioritaire', 'CHT-141');
  await p.screenshot({ path: SHOTS + '04-chantier-keravel-1920.png', fullPage: true });
  await ctx.close();
}

console.log('\n[CHT-141-02] « À traiter » et « Prochaine étape » sur la même ligne (côte à côte)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT2');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const zones = [...document.querySelectorAll('.cockpit-content.cockpit-grid > .cockpit-zone')].map((z) => {
      const rect = z.getBoundingClientRect();
      return { title: z.querySelector('h2')?.textContent.trim(), top: Math.round(rect.top), left: Math.round(rect.left) };
    });
    return { zones, isGrid: getComputedStyle(document.querySelector('.cockpit-content.cockpit-grid')).display === 'grid' };
  });
  note('CHT-141-02', r);
  ok(r.isGrid, 'CHT-141-02 : le corps du cockpit utilise bien une grille 2 colonnes', 'CHT-141');
  ok(r.zones.length === 2 && r.zones[0].title === 'À traiter' && r.zones[1].title === 'Prochaine étape', 'CHT-141-02 : les deux zones réelles (À traiter / Prochaine étape) sont présentes', 'CHT-141');
  ok(r.zones.length === 2 && Math.abs(r.zones[0].top - r.zones[1].top) <= 1 && r.zones[1].left > r.zones[0].left, 'CHT-141-02 : « À traiter » et « Prochaine étape » démarrent à la même hauteur, l’une à gauche l’autre à droite (côte à côte, plus empilées)', 'CHT-141');
  await ctx.close();
}

console.log('\n[CHT-141-03] Hauteur du cockpit resserrée (≤430px, « ← Chantiers » → onglets) sur Keravel @1440');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT3');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const linkBtn = [...document.querySelectorAll('button.link')].find((b) => b.textContent.includes('Chantiers'));
    const tabs = document.querySelector('.tabs');
    return { linkTop: Math.round(linkBtn.getBoundingClientRect().top), tabsTop: Math.round(tabs.getBoundingClientRect().top) };
  });
  const h = r.tabsTop - r.linkTop;
  note('CHT-141-03', { ...r, height: h });
  ok(h <= 430, `CHT-141-03 : hauteur du cockpit = ${h}px (cible ≤430px)`, 'CHT-141');
  await p.screenshot({ path: SHOTS + '05-chantier-keravel-1440.png', fullPage: true });
  await ctx.close();
}

console.log('\n[CHT-141-04] Les 5 variantes du cockpit se rendent sans l’ancienne colonne vignette');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT4');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const out = {};
    // 1) actif avec point ouvert (référence déjà testée ci-dessus)
    // 2) clôturé
    const pClosed = project('villa'); pClosed.lifecycle = 'closed'; pClosed.closedAt = getDemoNow().toISOString();
    app.ui.projectId = 'villa'; go('project');
    out.closed = { thumb: !!document.querySelector('.cockpit-header .cockpit-thumb svg'), oldVisual: !!document.querySelector('.cockpit-visual'), lifecycleBar: !!document.querySelector('.cockpit-lifecycle') };
    pClosed.lifecycle = 'active';
    // 3) archivé
    const pArch = project('horizon'); pArch.lifecycle = 'archived'; pArch.archivedAt = getDemoNow().toISOString();
    app.ui.projectId = 'horizon'; go('project');
    out.archived = { thumb: !!document.querySelector('.cockpit-header .cockpit-thumb svg'), oldVisual: !!document.querySelector('.cockpit-visual'), lifecycleBar: !!document.querySelector('.cockpit-lifecycle') };
    pArch.lifecycle = 'active';
    // 4) à configurer (0 tâche / 0 jalon)
    const idEmpty = 'p-empty-141';
    app.projects.push({ id: idEmpty, name: 'Chantier vide', location: 'Test', lifecycle: 'active', visualIndex: 1 });
    app.ui.projectId = idEmpty; go('project');
    out.setup = { thumb: !!document.querySelector('.cockpit-header .cockpit-thumb svg'), oldVisual: !!document.querySelector('.cockpit-visual'), setupZone: !!document.querySelector('.setup-zone') };
    // 5) prêt à clôturer — toutes tâches terminées + jalon final atteint
    const idReady = app.projects.find((pr) => pr.id === 'keravel').id;
    const ktasks = app.tasks.filter((t) => t.projectId === idReady);
    ktasks.forEach((t) => { t.status = 'done'; });
    save();
    app.ui.projectId = idReady; go('project');
    out.readyToClose = { thumb: !!document.querySelector('.cockpit-header .cockpit-thumb svg'), oldVisual: !!document.querySelector('.cockpit-visual') };
    return out;
  });
  note('CHT-141-04', r);
  ok(r.closed.thumb && !r.closed.oldVisual && r.closed.lifecycleBar, 'CHT-141-04 : chantier clôturé — vignette en en-tête, plus d’ancienne colonne', 'CHT-141');
  ok(r.archived.thumb && !r.archived.oldVisual && r.archived.lifecycleBar, 'CHT-141-04 : chantier archivé — idem', 'CHT-141');
  ok(r.setup.thumb && !r.setup.oldVisual && r.setup.setupZone, 'CHT-141-04 : chantier à configurer — idem, zone de démarrage intacte', 'CHT-141');
  ok(r.readyToClose.thumb && !r.readyToClose.oldVisual, 'CHT-141-04 : chantier prêt à clôturer — idem', 'CHT-141');
  await ctx.close();
}

console.log('\n[CHT-141-05] Historique — largeur relevée (950-1150px), toujours alignée à gauche');
{
  const { ctx, p } = await newPage(1600, 1000, 'CHT5');
  await reset(p, "task('k-electric').status='todo';save();setTaskStatus('k-electric','doing','task');app.ui.projectId='keravel';go('project');openProjectTab('keravel','Historique');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const panel = document.querySelector('.history-panel').getBoundingClientRect();
    const container = document.querySelector('#projectContent').getBoundingClientRect();
    return { panelW: Math.round(panel.width), panelLeft: Math.round(panel.left), containerLeft: Math.round(container.left), events: document.querySelectorAll('.history-event').length };
  });
  note('CHT-141-05', r);
  ok(r.panelW >= 950 && r.panelW <= 1150, `CHT-141-05 : largeur de l’historique = ${r.panelW}px (plage attendue 950-1150px, contre 820px avant correctif)`, 'CHT-141');
  ok(Math.abs(r.panelLeft - r.containerLeft) <= 2, 'CHT-141-05 : le panneau reste aligné à gauche (pas de centrage)', 'CHT-141');
  ok(r.events > 0, 'CHT-141-05 : les événements réels de la timeline continuent de s’afficher', 'CHT-141');
  await p.screenshot({ path: SHOTS + '06-chantier-historique.png', fullPage: true });
  await ctx.close();
}

console.log('\n[CHT-141-06] Historique — isolation par chantier toujours garantie (SITE-01, non touchée)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHT6');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    const v = app.tasks.find((t) => t.projectId === 'villa');
    setTaskStatus(v.id, 'doing', 'task');
    const k = projectTabContent('Historique', 'keravel');
    const vh = projectTabContent('Historique', 'villa');
    return { keravelHasVilla: k.includes(v.name), villaHasKeravel: vh.includes('Tableau électrique'), identical: k === vh };
  });
  note('CHT-141-06', r);
  ok(!r.keravelHasVilla && !r.villaHasKeravel && !r.identical, 'CHT-141-06 : aucune fuite inter-chantiers, le correctif visuel ne touche pas la logique historyProjectId/projectHistory', 'CHT-141');
  await ctx.close();
}

console.log('\n[CHT-141-07] Chantier @900px et @390px — pas de débordement, vignette non dominante');
{
  for (const [w, shotName] of [[900, '07-chantier-900.png'], [390, '08-chantier-390.png']]) {
    const { ctx, p } = await newPage(w, 900, 'CHT7-' + w);
    await reset(p, "app.ui.projectId='keravel';go('project');");
    await p.waitForTimeout(280);
    const r = await ev(p, () => {
      const thumb = document.querySelector('.cockpit-thumb').getBoundingClientRect();
      const h1 = document.querySelector('.cockpit-header h1');
      const menuBtn = document.querySelector('.cockpit-head-row button, .cockpit-head-row [role="button"], .cockpit-head-row .icon-btn');
      return {
        thumbW: Math.round(thumb.width), thumbH: Math.round(thumb.height),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        h1Visible: !!h1 && h1.getBoundingClientRect().width > 0,
        hasMenu: !!menuBtn,
      };
    });
    note('CHT-141-07-' + w, r);
    ok(!r.overflow, `CHT-141-07 : ${w}px — pas de scroll horizontal sur la fiche chantier`, 'CHT-141');
    ok(r.thumbW <= 80 && r.thumbH <= 80, `CHT-141-07 : ${w}px — vignette reste petite (${r.thumbW}×${r.thumbH}px), non dominante`, 'CHT-141');
    ok(r.h1Visible, `CHT-141-07 : ${w}px — nom du chantier lisible`, 'CHT-141');
    await p.screenshot({ path: SHOTS + shotName, fullPage: true });
    await ctx.close();
  }
}

// ============================================================
// GEL-141 — ÉQUIPE (chantier + page globale) strictement gelée
// ============================================================
console.log('\n[GEL-141-01] Chantier > Équipe — structure identique à V2.4.14 (gel)');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'GEL1-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'GEL1-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot');
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Équipe');
    const list = document.querySelector('.team-list');
    const cs = getComputedStyle(list);
    const cards = [...list.querySelectorAll('.team-card')];
    return {
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      structure: cards.map((c) => ({
        hasAvatar: !!c.querySelector('.resource-avatar'),
        hasMission: !!c.querySelector('.tc-mission'),
        hasState: !!c.querySelector('.tc-state'),
        classes: c.className,
      })),
    };
  });
  const prev = await snap(pPrev);
  const cur = await snap(pCur);
  note('GEL-141-01', { prev: { cols: prev.cols, count: prev.count }, cur: { cols: cur.cols, count: cur.count } });
  ok(prev.count === cur.count, `GEL-141-01 : même nombre de cartes ressources (${prev.count} → ${cur.count})`, 'GEL-141');
  ok(prev.cols === cur.cols, `GEL-141-01 : même nombre de colonnes de grille (${prev.cols} → ${cur.cols})`, 'GEL-141');
  ok(JSON.stringify(prev.structure) === JSON.stringify(cur.structure), 'GEL-141-01 : structure des cartes strictement identique (avatar/mission/état/classes) — Chantier>Équipe non touché', 'GEL-141');
  await cPrev.close(); await cCur.close();
}

console.log('\n[GEL-141-02] Page Équipe globale — structure identique à V2.4.14 (gel)');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'GEL2-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'GEL2-cur', FILE);
  const snap = async (p) => ev(p, () => {
    resetApp(); setDepth('pilot'); go('team');
    const list = document.querySelector('.team-list');
    const cs = getComputedStyle(list);
    const cards = [...list.querySelectorAll('.team-card')];
    return {
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      loadBoard: !!document.querySelector('.team-load .resources'),
      structure: cards.map((c) => ({ hasAvatar: !!c.querySelector('.resource-avatar'), hasMission: !!c.querySelector('.tc-mission'), hasState: !!c.querySelector('.tc-state'), classes: c.className })),
    };
  });
  const prev = await snap(pPrev);
  const cur = await snap(pCur);
  note('GEL-141-02', { prev: { cols: prev.cols, count: prev.count }, cur: { cols: cur.cols, count: cur.count } });
  ok(prev.count === cur.count, `GEL-141-02 : même nombre de cartes (${prev.count} → ${cur.count})`, 'GEL-141');
  ok(prev.cols === cur.cols, `GEL-141-02 : même nombre de colonnes (${prev.cols} → ${cur.cols})`, 'GEL-141');
  ok(prev.loadBoard === cur.loadBoard, 'GEL-141-02 : composant « Charge des ressources » toujours présent, inchangé', 'GEL-141');
  ok(JSON.stringify(prev.structure) === JSON.stringify(cur.structure), 'GEL-141-02 : structure des cartes strictement identique — page Équipe globale non touchée', 'GEL-141');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// DARK — zones touchées uniquement (Accueil / Cockpit / Historique)
// ============================================================
console.log('\n[DARK-141] Mode sombre sur les 3 zones du correctif');
{
  const { ctx, p } = await newPage(1440, 1000, 'DARK');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.settings.appearance = 'dark'; document.body.classList.add('dark'); save();
    const whiteFlat = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const bg = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
      return bg[0] > 240 && bg[1] > 240 && bg[2] > 240;
    };
    renderPage();
    return { today: whiteFlat('.today-panel'), attention: whiteFlat('.attention-card') };
  });
  note('DARK-141', r);
  ok(r.today === false, 'DARK-141 : Accueil — panneau « Aujourd’hui » sans aplat blanc forcé', 'DARK-141');
  ok(r.attention === false, 'DARK-141 : Accueil — vignette de synthèse sans aplat blanc forcé', 'DARK-141');
  await p.screenshot({ path: SHOTS + '09-dark-accueil.png', fullPage: true });
  const r2 = await ev(p, () => {
    app.ui.projectId = 'keravel'; go('project');
    const whiteFlat = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const bg = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
      return bg[0] > 240 && bg[1] > 240 && bg[2] > 240;
    };
    return { thumb: whiteFlat('.cockpit-thumb'), issueCard: whiteFlat('.issue-card') };
  });
  note('DARK-141', r2);
  ok(r2.issueCard === false, 'DARK-141 : Cockpit — carte « À traiter » sans aplat blanc forcé', 'DARK-141');
  await p.screenshot({ path: SHOTS + '10-dark-chantier.png', fullPage: true });
  const r3 = await ev(p, () => {
    openProjectTab('keravel', 'Historique');
    const e = document.querySelector('.history-panel');
    const bg = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
    return { whiteFlat: bg[0] > 240 && bg[1] > 240 && bg[2] > 240 };
  });
  note('DARK-141', r3);
  ok(r3.whiteFlat === false, 'DARK-141 : Historique — panneau sans aplat blanc forcé', 'DARK-141');
  await ctx.close();
}

// ============================================================
// RESPONSIVE — 10 largeurs, 3 écrans touchés
// ============================================================
console.log('\n[RESP-141] 10 largeurs × Accueil / Cockpit / Historique');
{
  const pages = [
    ['accueil', () => {}],
    ['cockpit', () => { app.ui.projectId = 'keravel'; go('project'); }],
    ['historique', () => { app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique'); }],
  ];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'RESP-' + w);
    for (const [name, fn] of pages) {
      await ev(p, (src) => { resetApp(); setDepth('pilot'); (0, eval)(src); }, `(${fn.toString()})()`);
      await p.waitForTimeout(200);
      const hscroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!hscroll, `RESP-141 : ${w}px — « ${name} » sans scroll horizontal`, 'RESP-141');
    }
    await ctx.close();
  }
}

// ============================================================
// CONSOLE — 0 erreur applicative
// ============================================================
console.log('\n[CONSOLE-141]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-141', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-141 : 0 erreur JavaScript applicative sur l’ensemble de la recette', 'CONSOLE-141');
}

// ============================================================
// ENGINES — byte-identité des moteurs métier (§39)
// ============================================================
console.log('\n[ENGINES-141] Byte-identité des moteurs métier (V2.4.14 → V2.4.14.1)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.14.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.14.1.html', 'utf8');
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
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-141 : tous les moteurs métier listés (§39) sont byte-identiques entre V2.4.14 et V2.4.14.1', 'ENGINES-141');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
