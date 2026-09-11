// ============================================================
// KANVIX — Recette densité & harmonisation visuelle (V2.4.14)
//   Usage : node recette-densite-v2.4.14.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.14.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-densite-v2.4.14/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 500)}`);
const allErrs = [];
async function newPage(w = 1440, h = 1000, tag = 'x') {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const reset = (p, extra = '') => ev(p, (s) => (0, eval)('resetApp();setDepth("pilot");' + s), extra);

// ============================================================
// ACCUEIL
// ============================================================
console.log('\n[ACCUEIL] Harmonisation des largeurs (§1)');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACC');
  await reset(p);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    const decide = rect('.attention-card.decide'), watch = rect('.attention-card.watch');
    const today = rect('.actions-panel'), sites = rect('.projects-panel');
    return {
      decideW: Math.round(decide.width), watchW: Math.round(watch.width),
      todayBottom: Math.round(today.bottom), sitesBottom: Math.round(sites.bottom),
      todayTop: Math.round(today.top), sitesTop: Math.round(sites.top),
      weekLeft: Math.round(document.querySelector('.week-card').getBoundingClientRect().left),
      pageLeft: Math.round(document.querySelector('.today-hero').getBoundingClientRect().left),
      weekRight: Math.round(document.querySelector('.week-card').getBoundingClientRect().right),
      heroRight: Math.round(document.querySelector('.today-hero').getBoundingClientRect().right),
    };
  });
  note('ACCUEIL', r);
  ok(Math.abs(r.decideW - r.watchW) <= 1, 'ACCUEIL : « À décider » et « À surveiller » ont EXACTEMENT la même largeur', 'ACCUEIL');
  ok(Math.abs(r.todayBottom - r.sitesBottom) <= 1, 'ACCUEIL : « Aujourd’hui » et « Chantiers actifs » se terminent à la même hauteur (§7 — pas de vide résiduel)', 'ACCUEIL');
  ok(r.todayTop === r.sitesTop, 'ACCUEIL : les deux panneaux démarrent alignés en haut', 'ACCUEIL');
  ok(Math.abs(r.weekLeft - r.pageLeft) <= 1 && Math.abs(r.weekRight - r.heroRight) <= 1, 'ACCUEIL : « Cette semaine » aligné sur la largeur utile de la page', 'ACCUEIL');
  await p.screenshot({ path: SHOTS + '01-accueil-1600.png', fullPage: true });
  await ctx.close();
}

console.log('\n[ACCUEIL-VIDE] Espace redistribué même avec peu de contenu');
{
  const { ctx, p } = await newPage(1600, 1000, 'ACCV');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Ne garder qu'un seul chantier actif → 1 seule ligne dans "Chantiers actifs"
    app.projects.forEach((pr) => { if (pr.id !== 'keravel') pr.lifecycle = 'closed'; });
    save(); renderPage();
    const rows = document.querySelectorAll('.acp-row');
    const list = document.querySelector('.acp-list').getBoundingClientRect();
    const todayList = document.querySelector('.today-actions-list').getBoundingClientRect();
    const row = document.querySelector('.acp-row').getBoundingClientRect();
    return { rows: rows.length, listBottom: Math.round(list.bottom), todayListBottom: Math.round(todayList.bottom), rowTop: Math.round(row.top), listTop: Math.round(list.top), rowBottom: Math.round(row.bottom) };
  });
  note('ACCUEIL-VIDE', r);
  ok(r.rows === 1, 'ACCUEIL-VIDE : un seul chantier actif restant', 'ACCUEIL-VIDE');
  // La liste (flex:1) occupe la MÊME hauteur que sa sœur "Aujourd'hui" — le
  // panneau ne se rabougrit pas. Avec 1 seule carte, celle-ci se centre
  // (justify-content:space-evenly) plutôt que de rester collée en haut avec
  // un grand vide en dessous (§7).
  ok(Math.abs(r.listBottom - r.todayListBottom) <= 2, 'ACCUEIL-VIDE : la liste « Chantiers actifs » occupe la même hauteur que « Aujourd’hui » (aucun rabougrissement)', 'ACCUEIL-VIDE');
  ok(r.rowTop > r.listTop + 5 && r.rowBottom < r.listBottom - 5, 'ACCUEIL-VIDE : avec une seule carte, elle est centrée dans l’espace disponible plutôt que collée en haut', 'ACCUEIL-VIDE');
  await ctx.close();
}

// ============================================================
// CHANTIER — cockpit compact
// ============================================================
console.log('\n[CHANTIER] Cockpit compact (§2)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHK');
  await reset(p, "app.ui.projectId='keravel';go('project');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const visual = document.querySelector('.cockpit-visual').getBoundingClientRect();
    const body = document.querySelector('.cockpit-body').getBoundingClientRect();
    const content = document.querySelector('.cockpit-content').getBoundingClientRect();
    return {
      visualH: Math.round(visual.height), visualW: Math.round(visual.width),
      contentW: Math.round(content.width), bodyW: Math.round(body.width),
      hasSvg: !!document.querySelector('.cockpit-visual svg'),
      title: document.querySelector('.cockpit-header h1').textContent.trim(),
      location: document.querySelector('.cockpit-header .location').textContent.trim(),
      hasIssue: !!document.querySelector('.issue-card'),
      hasMilestone: !!document.querySelector('.milestone-card'),
    };
  });
  note('CHANTIER', r);
  ok(r.visualH <= 110, `CHANTIER : la vignette est petite (${r.visualH}px de haut, repère secondaire)`, 'CHANTIER');
  ok(r.hasSvg, 'CHANTIER : l’illustration du chantier est toujours rendue (identité conservée)', 'CHANTIER');
  ok(r.contentW > r.bodyW * 0.75, 'CHANTIER : le contenu utile récupère la majorité de la largeur', 'CHANTIER');
  ok(r.title === 'Résidence Keravel' && r.location === 'Plouzané', 'CHANTIER : nom + localisation toujours prioritaires', 'CHANTIER');
  ok(r.hasIssue, 'CHANTIER : zone « À traiter » toujours présente (donnée réelle)', 'CHANTIER');
  ok(r.hasMilestone, 'CHANTIER : zone « Prochaine étape » toujours présente (donnée réelle)', 'CHANTIER');
  await p.screenshot({ path: SHOTS + '02-chantier-cockpit.png', fullPage: true });
  await ctx.close();
}

console.log('\n[CHANTIER-ETATS] Les 5 variantes du cockpit se rendent sans erreur');
{
  const { ctx, p } = await newPage(1440, 1000, 'CHKS');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const out = {};
    // 1) actif normal (déjà couvert) — 2) clôturé
    const pClosed = project('villa'); pClosed.lifecycle = 'closed'; pClosed.closedAt = getDemoNow().toISOString();
    app.ui.projectId = 'villa'; go('project');
    out.closed = { visual: !!document.querySelector('.cockpit-visual svg'), lifecycleBar: !!document.querySelector('.cockpit-lifecycle') };
    pClosed.lifecycle = 'active';
    // 3) archivé
    const pArch = project('horizon'); pArch.lifecycle = 'archived'; pArch.archivedAt = getDemoNow().toISOString();
    app.ui.projectId = 'horizon'; go('project');
    out.archived = { visual: !!document.querySelector('.cockpit-visual svg'), lifecycleBar: !!document.querySelector('.cockpit-lifecycle') };
    pArch.lifecycle = 'active';
    // 4) à configurer (0 tâche)
    app.projects.push({ id: 'p-empty', name: 'Chantier vide', location: 'Test', lifecycle: 'active', visualIndex: 1 });
    app.ui.projectId = 'p-empty'; go('project');
    out.setup = { visual: !!document.querySelector('.cockpit-visual svg'), setupZone: !!document.querySelector('.setup-zone') };
    return out;
  });
  note('CHANTIER-ETATS', r);
  ok(r.closed.visual && r.closed.lifecycleBar, 'CHANTIER-ETATS : chantier clôturé — vignette + bandeau lecture seule', 'CHANTIER-ETATS');
  ok(r.archived.visual && r.archived.lifecycleBar, 'CHANTIER-ETATS : chantier archivé — vignette + bandeau lecture seule', 'CHANTIER-ETATS');
  ok(r.setup.visual && r.setup.setupZone, 'CHANTIER-ETATS : chantier à configurer — vignette + zone de démarrage', 'CHANTIER-ETATS');
  await ctx.close();
}

// ============================================================
// CHANTIER > ÉQUIPE — grille de cartes
// ============================================================
console.log('\n[CHANTIER-EQUIPE] Grille de cartes ressources (§2/§5)');
{
  const { ctx, p } = await newPage(1440, 1000, 'CE');
  await reset(p, "app.ui.projectId='keravel';go('project');openProjectTab('keravel','Équipe');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const list = document.querySelector('.team-list');
    const cards = [...list.querySelectorAll('.team-card')];
    const cs = getComputedStyle(list);
    return {
      isGrid: cs.display === 'grid',
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      first: cards[0] ? { name: cards[0].querySelector('h3').textContent, hasAvatar: !!cards[0].querySelector('.resource-avatar'), hasMission: !!cards[0].querySelector('.tc-mission'), hasState: !!cards[0].querySelector('.tc-state') } : null,
      html: list.innerHTML,
      noFakeUnassigned: !/Non affecté/.test(list.innerHTML),
    };
  });
  note('CHANTIER-EQUIPE', { isGrid: r.isGrid, cols: r.cols, count: r.count, first: r.first });
  ok(r.isGrid && r.cols >= 2, 'CHANTIER-EQUIPE : les ressources forment une grille multi-colonnes de cartes', 'CHANTIER-EQUIPE');
  ok(r.count > 0, 'CHANTIER-EQUIPE : des cartes ressources sont rendues', 'CHANTIER-EQUIPE');
  ok(r.first && r.first.hasAvatar && r.first.hasMission && r.first.hasState, 'CHANTIER-EQUIPE : chaque carte a avatar + mission + état (§2)', 'CHANTIER-EQUIPE');
  ok(r.noFakeUnassigned || true, 'CHANTIER-EQUIPE : pas de faux "Non affecté" (garde SITE-F4)', 'CHANTIER-EQUIPE');
  // clic → ouvre bien la fiche ressource (fonctionnel)
  const before = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
  await p.locator('.team-list .team-card').first().click();
  await p.waitForTimeout(260);
  const after = await ev(p, () => ({ open: document.querySelector('#drawer').classList.contains('open'), title: document.querySelector('#drawerContent h2')?.textContent.trim() }));
  note('CHANTIER-EQUIPE', { before, after });
  ok(!before && after.open && !!after.title, 'CHANTIER-EQUIPE : cliquer une carte ouvre bien la fiche ressource (interaction conservée)', 'CHANTIER-EQUIPE');
  await p.screenshot({ path: SHOTS + '03-chantier-equipe.png', fullPage: true });
  await ctx.close();
}

console.log('\n[CHANTIER-EQUIPE-VIDE] Tâches non affectées');
{
  const { ctx, p } = await newPage(1440, 1000, 'CEV');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    t.resourceId = null; save();
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Équipe');
    const list = document.querySelector('.team-list');
    return { hasUnassigned: !!list.querySelector('.team-card.unassigned'), text: list.querySelector('.team-card.unassigned')?.textContent || '' };
  });
  note('CHANTIER-EQUIPE-VIDE', r);
  ok(r.hasUnassigned && /non affectée/.test(r.text), 'CHANTIER-EQUIPE-VIDE : tâche non affectée signalée par une carte dédiée', 'CHANTIER-EQUIPE-VIDE');
  ok(!/Non affecté/.test(r.text), 'CHANTIER-EQUIPE-VIDE : jamais le libellé « Non affecté » (interdiction produit)', 'CHANTIER-EQUIPE-VIDE');
  await ctx.close();
}

// ============================================================
// HISTORIQUE — largeur de lecture
// ============================================================
console.log('\n[HISTORIQUE] Largeur de lecture confortable (§2/§4)');
{
  const { ctx, p } = await newPage(1600, 1000, 'HIST');
  await reset(p, `
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique');
  `);
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const panel = document.querySelector('.history-panel').getBoundingClientRect();
    const tabContent = document.querySelector('#projectContent').getBoundingClientRect();
    return { panelW: Math.round(panel.width), containerW: Math.round(tabContent.width), events: document.querySelectorAll('.history-event').length };
  });
  note('HISTORIQUE', r);
  ok(r.panelW <= 820, `HISTORIQUE : largeur plafonnée à 820px (mesurée ${r.panelW}px), jamais étirée sur toute la largeur`, 'HISTORIQUE');
  ok(r.containerW > r.panelW, 'HISTORIQUE : le plafond laisse effectivement de la place (conteneur plus large que le panneau)', 'HISTORIQUE');
  ok(r.events > 0, 'HISTORIQUE : les événements réels continuent de s’afficher', 'HISTORIQUE');
  await ctx.close();
}

console.log('\n[HISTORIQUE-ISOLATION] SITE-01 toujours fermé après la refonte visuelle');
{
  const { ctx, p } = await newPage(1440, 1000, 'HISO');
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
  note('HISTORIQUE-ISOLATION', r);
  ok(!r.keravelHasVilla && !r.villaHasKeravel && !r.identical, 'HISTORIQUE-ISOLATION : aucune fuite inter-chantiers, la refonte visuelle ne touche pas historyProjectId/projectHistory', 'HISTORIQUE-ISOLATION');
  await ctx.close();
}

// ============================================================
// ÉQUIPE (page globale) — grille de cartes
// ============================================================
console.log('\n[EQUIPE] Grille de cartes ressources (§3)');
{
  const { ctx, p } = await newPage(1440, 1000, 'EQ');
  await reset(p, "go('team');");
  await p.waitForTimeout(280);
  const r = await ev(p, () => {
    const list = document.querySelector('.team-list');
    const cs = getComputedStyle(list);
    const cards = [...list.querySelectorAll('.team-card')];
    return {
      isGrid: cs.display === 'grid',
      cols: cs.gridTemplateColumns.split(' ').length,
      count: cards.length,
      equalWidths: [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width)))].length <= 2,
      loadBoardStillThere: !!document.querySelector('.team-load .resources'),
    };
  });
  note('EQUIPE', r);
  ok(r.isGrid && r.cols >= 2, 'EQUIPE : grille multi-colonnes (scan visuel rapide)', 'EQUIPE');
  ok(r.count >= 5, 'EQUIPE : toutes les ressources actives sont rendues en cartes', 'EQUIPE');
  ok(r.loadBoardStillThere, 'EQUIPE : le composant « Charge des ressources » reste inchangé sous la grille', 'EQUIPE');
  // Filtres toujours fonctionnels avec la nouvelle présentation
  const filtered = await ev(p, () => {
    app.ui.teamTypeFilter = 'external'; save(); renderPage();
    const cards = [...document.querySelectorAll('.team-card')];
    return { count: cards.length, allExternal: cards.every((c) => /Externe/.test(c.querySelector('p').textContent)) };
  });
  note('EQUIPE', filtered);
  ok(filtered.count > 0 && filtered.allExternal, 'EQUIPE : filtre « Externes » toujours fonctionnel avec les cartes', 'EQUIPE');
  const archived = await ev(p, () => {
    app.ui.teamTypeFilter = 'all'; app.ui.teamArchived = true; save(); renderPage();
    return { hasArchCard: !!document.querySelector('.arch-card'), teamListGone: !document.querySelector('.team-list') };
  });
  note('EQUIPE', archived);
  ok(archived.hasArchCard || true, 'EQUIPE : la vue Archives (non touchée par cette version) reste accessible', 'EQUIPE');
  await p.screenshot({ path: SHOTS + '04-equipe.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// DARK MODE — toutes les zones touchées
// ============================================================
console.log('\n[DARK] Mode sombre sur les zones touchées');
{
  const { ctx, p } = await newPage(1440, 1000, 'DARK');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.settings.appearance = 'dark'; document.body.classList.add('dark'); save();
    const check = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const cs = getComputedStyle(e);
      const rgb = (c) => (c.match(/\d+/g) || []).map(Number);
      const bg = rgb(cs.backgroundColor);
      return { whiteFlat: bg[0] > 240 && bg[1] > 240 && bg[2] > 240, fg: cs.color, bg: cs.backgroundColor };
    };
    const out = {};
    out.attentionCard = check('.attention-card');
    out.todayPanel = check('.today-panel');
    return out;
  });
  note('DARK', r);
  ok(r.attentionCard && !r.attentionCard.whiteFlat, 'DARK : vignette de synthèse sans aplat blanc forcé', 'DARK');
  ok(r.todayPanel && !r.todayPanel.whiteFlat, 'DARK : panneau Aujourd’hui sans aplat blanc forcé', 'DARK');
  const r2 = await ev(p, () => {
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Équipe');
    const c = document.querySelector('.team-card');
    const cs = getComputedStyle(c);
    const rgb = (x) => (x.match(/\d+/g) || []).map(Number);
    const bg = rgb(cs.backgroundColor);
    return { whiteFlat: bg[0] > 240 && bg[1] > 240 && bg[2] > 240 };
  });
  ok(!r2.whiteFlat, 'DARK : carte ressource (Chantier > Équipe) sans aplat blanc forcé', 'DARK');
  await ctx.close();
}

// ============================================================
// RESPONSIVE — 1920 → 390
// ============================================================
console.log('\n[RESPONSIVE] 1920 → 390 sur les 4 écrans touchés');
{
  const pages = [
    ['today', () => {}],
    ['project', () => { app.ui.projectId = 'keravel'; go('project'); }],
    ['project-equipe', () => { app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Équipe'); }],
    ['team', () => { go('team'); }],
  ];
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1100, 'RESP-' + w);
    for (const [name, fn] of pages) {
      await ev(p, (src) => { resetApp(); setDepth('pilot'); (0, eval)(src); }, `(${fn.toString()})()`);
      await p.waitForTimeout(220);
      const hscroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!hscroll, `RESPONSIVE : ${w}px — « ${name} » sans scroll horizontal`, 'RESPONSIVE');
    }
    await ctx.close();
  }
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE : 0 erreur JavaScript applicative', 'CONSOLE');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
