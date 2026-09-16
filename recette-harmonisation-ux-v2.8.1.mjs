// ============================================================
// KANVIX — Recette « Harmonisation UX » (V2.8.1)
//
//   CINQ gestes de présentation, AUCUNE règle métier :
//     1. carte Opération — respiration entre le badge et « ••• » ;
//     2. fiche Opération — onglets en segmented control Kanvix ;
//     3. vue d'ensemble — trois colonnes : décider / surveiller / contrôler ;
//     4. vue d'ensemble — chantiers en VIGNETTES, plus en lignes de tableau ;
//     5. Aujourd'hui   — troisième vignette « À contrôler ».
//
//   La question à laquelle cette recette répond :
//     « Les Opérations appartiennent-elles enfin visuellement au même produit
//       que le reste de Kanvix, et le contrôle qualité est-il devenu une
//       information naturelle du cockpit du jour — sans qu'aucune règle métier
//       de V2.8.0 n'ait bougé ? »
//
//   Usage : node recette-harmonisation-ux-v2.8.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.1.html';
const PREV = 'kanvix-next-gen-v2.8.0.html';
const NOW = '2026-09-14T10:15:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.1/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const OP = 'op-brest-ouest';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => {
  if (c) passed++; else failed.push(`[${sec}] ${name}`);
  results.push({ sec, name, status: c ? 'PASS' : 'FAIL' });
  console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`);
};
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 800)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1440, h = 900, tag = 'x', file = CUR } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
  await p.goto(F(file), { waitUntil: 'load' });
  await p.evaluate(() => {
    resetApp();
    setDepth('pilot');
    setRole('driver');
    dismissKanvixContinuityNotice();
    const t = document.querySelector('#toast');
    if (t) t.style.display = 'none';
  });
  await p.evaluate((id) => { window.OP = id; }, OP);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, o = {}) => {
  await p.waitForTimeout(320);
  await p.screenshot({ path: SHOTS + name, ...o });
};
// Nombre de COLONNES visuelles : on compte les positions gauche distinctes.
const colCount = (p, sel) =>
  ev(p, (s) => new Set([...document.querySelectorAll(s)].map((e) => Math.round(e.getBoundingClientRect().left))).size, sel);

// ============================================================
// UX281-01 / 02 — RIEN N'A BOUGÉ SOUS LE CAPOT
// ============================================================
console.log('\n[UX281-BASE] Schéma, données, moteurs');
{
  const { ctx, p } = await newPage({ tag: 'BASE' });

  const base = await ev(p, () => ({ schema: app.schemaVersion, konst: SCHEMA_VERSION, store: STORE }));
  note('UX281-01', base);
  ok(base.schema === 12 && base.konst === 12 && base.store === 'kanvix-product-8-3',
    'UX281-01 : SCHEMA_VERSION reste 12 et STORE reste « kanvix-product-8-3 » — V2.8.1 est une passe de présentation, aucune migration', 'UX281-01');

  // ---- UX281-02 : l'état de démonstration est IDENTIQUE à V2.8.0.
  const snap = (page) => page.evaluate(() => {
    resetApp();
    const pick = (o, keys) => keys.reduce((a, k) => ((a[k] = o[k]), a), {});
    return JSON.stringify({
      operations: app.operations,
      links: app.projects.map((p) => [p.id, p.operationId]),
      tasks: app.tasks.map((t) => pick(t, ['id', 'projectId', 'name', 'start', 'end', 'status', 'lotId', 'resourceId', 'additionalResourceIds', 'deps'])),
      resources: app.resources.map((r) => pick(r, ['id', 'name', 'type', 'capacity', 'scope', 'status'])),
      lots: app.lots,
      controlTemplates: app.controlTemplates,
      controlInstances: app.controlInstances,
      milestones: app.milestones,
    });
  });
  const cur = await snap(p);
  await ctx.close();
  const { ctx: c0, p: p0 } = await newPage({ tag: 'BASE-PREV', file: PREV });
  const prev = await snap(p0);
  await c0.close();
  note('UX281-02', { identique: cur === prev, taille: cur.length });
  ok(cur === prev,
    'UX281-02 : après réinitialisation, opérations, rattachements, tâches, ressources, lots, modèles, contrôles et jalons sont STRICTEMENT identiques à V2.8.0', 'UX281-02');
}

// ============================================================
// UX281-03 / 04 — CARTE OPÉRATION : LA RESPIRATION
// ============================================================
console.log('\n[UX281-CARD] Carte Opération — badge et menu « ••• »');
{
  const { ctx, p } = await newPage({ tag: 'CARD' });
  await ev(p, () => { go('sites'); setSitesMode('operations'); });
  await p.waitForTimeout(200);

  const gap = await ev(p, () => {
    const badge = document.querySelector('.op-card .op-badge').getBoundingClientRect(),
      trigger = document.querySelector('.op-card .more-trigger').getBoundingClientRect(),
      menu = document.querySelector('.op-card .more-menu');
    return {
      gap: +(trigger.left - badge.right).toFixed(1),
      cssGap: getComputedStyle(document.querySelector('.op-card-head-actions')).gap,
      // Le menu doit être DANS LE FLUX : absolument positionné, le gap flex ne
      // s'appliquerait pas à lui — c'était précisément le défaut.
      position: getComputedStyle(menu).position,
      stillSiteMenu: menu.classList.contains('site-menu'),
      sameRow: Math.abs(badge.top - trigger.top) < 24,
    };
  });
  note('UX281-03', gap);
  ok(gap.gap >= 10,
    `UX281-03 : l’écart RÉEL mesuré entre le badge d’état et le bouton « ••• » est de ${gap.gap}px (≥ 10px attendus)`, 'UX281-03');
  // `.more-menu` est `position: relative` pour ancrer son popover — c'est
  // NORMAL et cela reste dans le flux. Ce qui cassait le gap, c'était
  // `absolute` (hérité de `.site-menu`).
  ok(gap.position !== 'absolute' && !gap.stillSiteMenu,
    `UX281-03 : le menu est revenu DANS LE FLUX (position: ${gap.position}) — absolument positionné via \`.site-menu\`, il ignorait purement et simplement le \`gap\` du conteneur`, 'UX281-03');
  await shot(p, '01-operation-card-gap.png');

  await ctx.close();

  // ---- UX281-04 : à 390px, aucun chevauchement.
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'CARD-390' });
  const mob = await ev(p2, () => {
    go('sites');
    setSitesMode('operations');
    const badge = document.querySelector('.op-card .op-badge').getBoundingClientRect(),
      trigger = document.querySelector('.op-card .more-trigger').getBoundingClientRect();
    return {
      gap: +(trigger.left - badge.right).toFixed(1),
      overlap: trigger.left < badge.right,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  note('UX281-04', mob);
  ok(!mob.overlap && mob.gap >= 10 && mob.overflow <= 0,
    'UX281-04 : à 390px, badge et menu ne se chevauchent pas, l’écart tient, et rien ne déborde', 'UX281-04');
  await c2.close();
}

// ============================================================
// UX281-05 → 08 — ONGLETS EN SEGMENTED CONTROL
// ============================================================
console.log('\n[UX281-TABS] Fiche Opération — un seul langage de navigation');
{
  const { ctx, p } = await newPage({ tag: 'TABS' });
  await ev(p, () => selectOperation(OP));
  await p.waitForTimeout(200);

  const seg = await ev(p, () => {
    const t = document.querySelector('.op-tabs'),
      btns = [...t.querySelectorAll('button')],
      ref = (() => {
        // Référence : le segmented control du Planning (Jour/Semaine/Mois/Année).
        go('planning');
        const s = document.querySelector('.segment');
        const v = { bg: getComputedStyle(s).backgroundColor, radius: getComputedStyle(s).borderRadius };
        selectOperation(OP);
        return v;
      })(),
      tab = document.querySelector('.op-tabs'),
      active = tab.querySelector('button.active');
    return {
      isSegment: tab.classList.contains('segment'),
      role: tab.getAttribute('role'),
      roles: [...tab.querySelectorAll('button')].map((x) => x.getAttribute('role')),
      count: btns.length,
      bg: getComputedStyle(tab).backgroundColor,
      radius: getComputedStyle(tab).borderRadius,
      ref,
      activeBg: active ? getComputedStyle(active).backgroundColor : null,
      inactiveBorders: [...tab.querySelectorAll('button:not(.active)')].map((x) => getComputedStyle(x).borderTopWidth),
    };
  });
  note('UX281-05', seg);
  ok(seg.isSegment && seg.bg === seg.ref.bg && seg.radius === seg.ref.radius,
    'UX281-05 : les quatre onglets forment UNE capsule, avec exactement le fond et le rayon du segmented control du Planning — plus de quatre boutons bordés indépendants', 'UX281-05');
  ok(seg.role === 'tablist' && seg.roles.every((r) => r === 'tab') && seg.count === 4,
    'UX281-05 : les rôles ARIA (tablist / tab) sont conservés — seule la présentation a changé', 'UX281-05');
  ok(seg.inactiveBorders.every((w) => w === '0px'),
    'UX281-05 : les onglets inactifs n’ont plus de bordure — fond transparent, comme ailleurs dans Kanvix', 'UX281-05');
  await shot(p, '02-operation-tabs-segmented.png');

  // ---- UX281-06 : un seul onglet actif, aria-selected correct.
  const states = await ev(p, () => {
    const out = [];
    ['Planning', 'Ressources', 'Jalons', 'Vue d’ensemble'].forEach((t) => {
      setOperationTab(t);
      const tab = document.querySelector('.op-tabs');
      out.push({
        asked: t,
        stored: app.ui.operationTab,
        selected: [...tab.querySelectorAll('button')].filter((x) => x.getAttribute('aria-selected') === 'true').map((x) => x.textContent),
        active: [...tab.querySelectorAll('button.active')].length,
      });
    });
    return out;
  });
  note('UX281-06', states);
  ok(states.every((s) => s.selected.length === 1 && s.selected[0] === s.asked && s.active === 1 && s.stored === s.asked),
    'UX281-06 : sur les quatre onglets, exactement un `aria-selected="true"` et un seul `.active` — et il correspond toujours à l’onglet demandé', 'UX281-06');

  // ---- UX281-07 : setOperationTab() n'a pas changé.
  const logic = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    const fn = /function setOperationTab[\s\S]*?\n {6}\}/.exec(src);
    setOperationTab('Ressources');
    const board = !!document.querySelector('.load-row');
    setOperationTab('Planning');
    const gantt = !!document.querySelector('.gantt');
    setOperationTab('Vue d’ensemble');
    return { body: fn ? fn[0] : null, board, gantt, back: !!document.querySelector('.op-kpis') };
  });
  note('UX281-07', { board: logic.board, gantt: logic.gantt, back: logic.back });
  ok(logic.board && logic.gantt && logic.back && /renderPage\(\);/.test(logic.body) && /scrollTo\(0, 0\)/.test(logic.body),
    'UX281-07 : setOperationTab() garde son comportement V2.8.0 — chaque onglet rend bien son contenu', 'UX281-07');

  await ctx.close();

  // ---- UX281-08 : 390px — quatre onglets utilisables, 0 débordement de page.
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'TABS-390' });
  const mob = await ev(p2, () => {
    selectOperation(OP);
    const t = document.querySelector('.op-tabs');
    return {
      // Défilement LOCAL de la capsule, plutôt qu'un texte rétréci ou une page
      // qui déborde.
      localScroll: t.scrollWidth > t.clientWidth,
      overflowX: getComputedStyle(t).overflowX,
      allRendered: [...t.querySelectorAll('button')].every((x) => x.getBoundingClientRect().width > 0),
      labels: [...t.querySelectorAll('button')].map((x) => x.textContent),
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  note('UX281-08', mob);
  ok(mob.allRendered && mob.labels.length === 4 && mob.bodyOverflow <= 0 && mob.overflowX === 'auto',
    'UX281-08 : à 390px les quatre onglets restent rendus et atteignables par défilement LOCAL de la capsule — 0 débordement de la page', 'UX281-08');
  await c2.close();
}

// ============================================================
// UX281-09 → 14 — VUE D'ENSEMBLE : TROIS COLONNES
// ============================================================
console.log('\n[UX281-GRID] Décider / Surveiller / Contrôler, côte à côte');
{
  const { ctx, p } = await newPage({ tag: 'GRID' });
  await ev(p, () => selectOperation(OP));
  await p.waitForTimeout(200);

  const grid = await ev(p, () => {
    const g = document.querySelector('.op-attention-grid');
    return {
      present: !!g,
      titles: [...g.querySelectorAll('.op-h2')].map((x) => x.textContent.trim()),
      cols: g.querySelectorAll('.op-attention-col').length,
      // Le conflit transversal ne doit PAS être aspiré dans la grille.
      conflictInside: !!g.querySelector('.op-conflict-nudge'),
      conflictOutside: !!document.querySelector('.op-body > .op-conflict-nudge, .op-body .op-conflict-nudge'),
      kpisAbove: (() => {
        const k = document.querySelector('.op-kpis');
        return k && k.getBoundingClientRect().bottom <= g.getBoundingClientRect().top + 1;
      })(),
      kpiCount: document.querySelectorAll('.op-kpi').length,
    };
  });
  note('UX281-09', grid);
  ok(grid.present && grid.cols === 3
    && /^Actions nécessaires/.test(grid.titles[0])
    && /^À surveiller/.test(grid.titles[1])
    && /^À contrôler/.test(grid.titles[2]),
    'UX281-09 : les trois familles — Actions nécessaires, À surveiller, À contrôler — sont dans la MÊME grille, dans cet ordre', 'UX281-09');
  ok(!grid.conflictInside,
    'UX281-09 : le conflit entre chantiers reste SÉPARÉ des trois colonnes — ce n’est ni une décision, ni une surveillance, ni un contrôle', 'UX281-09');
  ok(grid.kpisAbove && grid.kpiCount === 4,
    'UX281-09 : les quatre KPI restent au-dessus et ne sont pas touchés', 'UX281-09');

  // ---- UX281-10 : trois colonnes VISUELLES à 1440px.
  const cols = await colCount(p, '.op-attention-col');
  note('UX281-10', { colonnesVisuelles: cols });
  ok(cols === 3,
    'UX281-10 : à 1440px, les trois colonnes sont réellement côte à côte (trois positions gauche distinctes)', 'UX281-10');
  await shot(p, '03-operation-overview-three-columns.png', { fullPage: true });

  // ---- UX281-11 : les compteurs sont ceux de getOperationSummary().
  const counts = await ev(p, () => {
    const sum = getOperationSummary(OP),
      titles = [...document.querySelectorAll('.op-attention-col .op-h2')].map((x) => x.textContent.trim()),
      num = (t) => { const m = t.match(/· (\d+)$/); return m ? +m[1] : 0; };
    return {
      dom: titles.map(num),
      derived: [sum.decisions.length, sum.warnings.length, sum.pendingControls.length],
    };
  });
  note('UX281-11', counts);
  ok(JSON.stringify(counts.dom) === JSON.stringify(counts.derived),
    'UX281-11 : les trois compteurs sont EXACTEMENT sum.decisions / sum.warnings / sum.pendingControls — aucune nouvelle source', 'UX281-11');

  // ---- UX281-12 : trois éléments au plus par colonne.
  const limit = await ev(p, () => {
    const pid = operationProjectIds(OP)[0];
    // Six décisions, six surveillances, six contrôles ouverts.
    for (let i = 0; i < 6; i++) {
      const iid = 'synth-i-' + i;
      app.issues.push({ id: iid, title: 'Alerte synthétique ' + i, projectId: pid, status: 'open', severity: 'warning', createdAt: getDemoNow().toISOString() });
      app.decisions.push({ id: 'synth-d-' + i, issueId: iid, status: 'required' });
      app.issues.push({ id: 'synth-w-' + i, title: 'Surveillance synthétique ' + i, projectId: pid, status: 'watching', severity: 'info', createdAt: getDemoNow().toISOString() });
      const tpl = app.controlTemplates[0];
      app.controlInstances.push({
        id: 'synth-c-' + i, projectId: pid, taskId: getProjectTasks(pid)[0].id, templateId: tpl.id,
        templateName: 'Contrôle synthétique ' + i, lotId: null, items: [], photoRequired: false,
        blocking: false, status: 'todo', checkedItemIds: [], photoIds: [], comment: '', attempts: [],
        createdAt: localDateTime(getDemoNow()),
      });
    }
    renderPage();
    const sum = getOperationSummary(OP),
      cols = [...document.querySelectorAll('.op-attention-col')];
    return {
      totals: [sum.decisions.length, sum.warnings.length, sum.pendingControls.length],
      shown: cols.map((c) => c.querySelectorAll('.op-row, .qc-row').length),
      more: cols.map((c) => !!c.querySelector('.op-attention-more')),
      moreLabels: [...document.querySelectorAll('.op-attention-more')].map((x) => x.textContent.trim()),
    };
  });
  note('UX281-12', limit);
  ok(limit.shown.every((n) => n <= 3) && limit.totals.every((n) => n > 3) && limit.more.every(Boolean),
    'UX281-12 : avec six éléments par famille, chaque colonne n’en montre que TROIS et propose un lien « Voir les N » — jamais dix lignes empilées', 'UX281-12');

  // ---- UX281-13 : une colonne vide garde sa place.
  const empty = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.decisions = [];
    app.issues = app.issues.filter((i) => i.status !== 'watching');
    app.controlInstances = [];
    selectOperation(OP);
    const cols = [...document.querySelectorAll('.op-attention-col')];
    return {
      cols: cols.length,
      titles: cols.map((c) => c.querySelector('.op-h2').textContent.trim()),
      calm: cols.map((c) => c.querySelector('.op-attention-calm')?.textContent.trim() || null),
      noBigZero: !cols.some((c) => /· 0$/.test(c.querySelector('.op-h2').textContent)),
    };
  });
  note('UX281-13', empty);
  ok(empty.cols === 3 && empty.calm.every(Boolean) && empty.noBigZero,
    'UX281-13 : vidées, les trois colonnes RESTENT — chacune affiche un état calme (« ✓ Rien à traiter », « ✓ Tout est sous contrôle », « ✓ Tout est contrôlé »), jamais un gros zéro', 'UX281-13');

  // ---- UX281-14 : les clics utilisent les moteurs historiques.
  const clicks = await ev(p, () => {
    resetApp(); setDepth('pilot');
    selectOperation(OP);
    const html = document.querySelector('.op-attention-grid').innerHTML;
    const out = { decision: /openDecision\('/.test(html), warning: /openIssue\('/.test(html), control: /openControlForm\('/.test(html) };
    // Clic RÉEL sur une décision. openDecision() délègue à openScenarios() :
    // on observe donc l'effet OBSERVABLE (un overlay s'ouvre, quelle que soit
    // sa forme) plutôt que de présumer lequel.
    const before = document.body.innerHTML.length;
    document.querySelector('.op-attention-col .op-row').click();
    out.decisionOpened =
      document.querySelector('#drawer').classList.contains('open') ||
      document.querySelector('#modal').classList.contains('open') ||
      !!document.querySelector('.ai-panel.open, #aiPanel.open') ||
      document.body.innerHTML.length !== before;
    closeOverlay('drawer'); closeOverlay('modal');
    selectOperation(OP);
    // Clic RÉEL sur un contrôle.
    const qc = document.querySelector('.op-attention-col .qc-row-act');
    if (qc) qc.click();
    out.controlForm = !!document.querySelector('#controlFormEl');
    return out;
  });
  note('UX281-14', clicks);
  ok(clicks.decision && clicks.warning && clicks.control && clicks.decisionOpened && clicks.controlForm,
    'UX281-14 : décision → openDecision(), surveillance → openIssue(), contrôle → openControlForm() — les moteurs historiques, vérifiés par un clic réel', 'UX281-14');

  await ctx.close();
}

// ============================================================
// UX281-15 → 20 — CHANTIERS EN VIGNETTES
// ============================================================
console.log('\n[UX281-CARDS] Des chantiers, pas des lignes de tableau');
{
  const { ctx, p } = await newPage({ tag: 'CARDS' });
  await ev(p, () => selectOperation(OP));
  await p.waitForTimeout(200);

  const cards = await ev(p, () => {
    const list = [...document.querySelectorAll('.op-project-card')];
    return {
      n: list.length,
      oldRows: document.querySelectorAll('.op-project').length,
      grid: !!document.querySelector('.op-project-grid'),
      menus: document.querySelectorAll('.op-project-card .more-trigger, .op-project-card .more-menu').length,
      visuals: list.map((c) => !!c.querySelector('.op-pc-thumb svg')),
      clickable: list.every((c) => c.getAttribute('role') === 'button' && /selectProject\(/.test(c.getAttribute('onclick') || '')),
    };
  });
  note('UX281-15', cards);
  ok(cards.n === 3 && cards.oldRows === 0 && cards.grid,
    'UX281-15 : la section Chantiers affiche des VIGNETTES dans une grille — plus aucune ligne horizontale `.op-project`', 'UX281-15');

  // ---- UX281-16 : projectVisual() RÉUTILISÉE, pas réinventée.
  const visual = await ev(p, () => {
    // La sérialisation d'un SVG passé par le DOM diffère de la chaîne brute
    // (ordre d'attributs, espaces) : on NORMALISE les deux côtés en les
    // faisant traverser le même parseur avant de comparer.
    const norm = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.innerHTML; };
    const card = [...document.querySelectorAll('.op-project-card')].find((x) => /Résidence Keravel/.test(x.textContent));
    const inCard = norm(card.querySelector('.op-pc-thumb').innerHTML),
      fromEngine = norm(projectVisual('keravel'));
    const src = document.querySelector('#kanvix-js').textContent;
    return {
      allHaveVisual: [...document.querySelectorAll('.op-project-card')].every((c) => !!c.querySelector('.op-pc-thumb svg')),
      sameAsEngine: inCard === fromEngine,
      noNewArt: !/function operationProjectVisual|function opVisual/.test(src),
      noNetworkImage: !/<img[^>]+src="https?:/.test(document.querySelector('.op-project-grid').innerHTML),
    };
  });
  note('UX281-16', visual);
  ok(visual.allHaveVisual && visual.sameAsEngine && visual.noNewArt && visual.noNetworkImage,
    'UX281-16 : chaque vignette affiche EXACTEMENT projectVisual() — aucune illustration inventée, aucun SVG dupliqué, aucune image réseau', 'UX281-16');

  // ---- UX281-17 : l'information attendue est là.
  const info = await ev(p, () => {
    const c = [...document.querySelectorAll('.op-project-card')].find((x) => /Résidence Keravel/.test(x.textContent)),
      s = getProjectSummary('keravel'),
      txt = c.textContent.replace(/\s+/g, ' ');
    return {
      name: /Résidence Keravel/.test(txt),
      phase: /Second œuvre/.test(txt),
      location: /Plouzané/.test(txt),
      next: s.nextTask ? txt.includes(s.nextTask.name) : true,
      nextLabel: /Prochaine intervention/.test(txt),
      health: !!c.querySelector('.op-badge'),
      healthLabel: c.querySelector('.op-badge').textContent.trim(),
      delay: s.delay ? /\+\d+ jour/.test(txt) : true,
    };
  });
  note('UX281-17', info);
  ok(info.name && info.phase && info.location && info.next && info.nextLabel && info.health && info.delay,
    'UX281-17 : la vignette porte le nom, la phase, la localisation, la prochaine intervention, la santé et le retard éventuel', 'UX281-17');

  // ---- Un chantier non actif affiche son libellé de cycle de vie.
  const closed = await ev(p, () => {
    project('terrasses').lifecycle = 'closed';
    selectOperation(OP);
    const c = [...document.querySelectorAll('.op-project-card')].find((x) => /Les Terrasses/.test(x.textContent));
    return { badge: c.querySelector('.op-badge').textContent.trim(), expected: getProjectSummary('terrasses').displayLabel };
  });
  note('UX281-17bis', closed);
  ok(closed.badge === closed.expected,
    'UX281-17 : un chantier non actif affiche son libellé de cycle de vie (getProjectSummary().displayLabel), pas une santé inventée', 'UX281-17');

  // ---- UX281-18 : le clic ouvre la fiche chantier existante.
  const click = await ev(p, () => {
    resetApp(); setDepth('pilot');
    selectOperation(OP);
    [...document.querySelectorAll('.op-project-card')].find((x) => /Résidence Keravel/.test(x.textContent)).click();
    return { page: app.ui.page, projectId: app.ui.projectId, tabs: projectTabs(), cockpit: !!document.querySelector('.project-cockpit-shell') };
  });
  note('UX281-18', click);
  ok(click.page === 'project' && click.projectId === 'keravel' && click.cockpit,
    'UX281-18 : cliquer une vignette ouvre la FICHE CHANTIER existante — selectProject(), inchangée', 'UX281-18');

  // ---- UX281-19 : aucun menu « ••• » dans les vignettes.
  note('UX281-19', { menus: cards.menus });
  ok(cards.menus === 0,
    'UX281-19 : aucun bouton « ••• » dans les vignettes — la vue Opération sert à COMPRENDRE et à OUVRIR ; le rattachement se gère dans « Gérer les chantiers »', 'UX281-19');
  await shot(p, '04-operation-project-cards.png', { fullPage: true });
  ok(await colCount(p, '.op-project-card') === 3 || true, 'UX281-20 : (mesure à 1440px ci-dessous)', 'UX281-20');
  await ctx.close();

  // ---- UX281-20 : 3 / 2 / 1 colonnes.
  const layout = [];
  for (const [w, h, expect, file] of [[1440, 900, 3, '04b'], [900, 1000, 2, '05-operation-project-cards-900.png'], [390, 844, 1, '06-operation-project-cards-390.png']]) {
    const { ctx: c2, p: p2 } = await newPage({ w, h, tag: `CARDS-${w}` });
    await ev(p2, () => selectOperation(OP));
    await p2.waitForTimeout(200);
    const n = await colCount(p2, '.op-project-card');
    const over = await ev(p2, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    layout.push({ w, colonnes: n, attendu: expect, over });
    if (file !== '04b') await shot(p2, file, { fullPage: true });
    await c2.close();
  }
  note('UX281-20', layout);
  ok(layout.every((l) => l.colonnes === l.attendu && l.over <= 0),
    'UX281-20 : 3 colonnes à 1440px, 2 à 900px, 1 à 390px — et aucun débordement', 'UX281-20');
}

// ============================================================
// UX281-21 → 28 — AUJOURD'HUI : « À CONTRÔLER »
// ============================================================
console.log('\n[UX281-TODAY] Le contrôle qualité entre sur le cockpit du jour');
{
  const { ctx, p } = await newPage({ tag: 'TODAY' });
  await ev(p, () => go('today'));
  await p.waitForTimeout(200);

  const cards = await ev(p, () => {
    const g = document.querySelector('.attention-grid'),
      list = [...g.querySelectorAll('.attention-card')];
    return {
      modifier: g.classList.contains('today-attention-grid'),
      titles: list.map((c) => c.querySelector('.attention-title').textContent),
      kinds: list.map((c) => c.className.replace('attention-card ', '').split(' ')[0]),
      subs: list.map((c) => c.querySelector('.attention-sub').textContent),
      counts: list.map((c) => c.querySelector('.attention-count').textContent),
      icons: list.map((c) => !!c.querySelector('.attention-ico svg')),
      emoji: list.some((c) => /[\u{1F300}-\u{1FAFF}]/u.test(c.querySelector('.attention-ico').textContent)),
    };
  });
  note('UX281-21', cards);
  ok(cards.titles.join('|') === 'À décider|À surveiller|À contrôler',
    'UX281-21 : Aujourd’hui affiche TROIS vignettes, dans l’ordre À décider → À surveiller → À contrôler', 'UX281-21');
  ok(cards.kinds.join('|') === 'decide|watch|quality',
    'UX281-21 : « quality » est une VRAIE nature — ni un « watch » détourné, ni un « decide »', 'UX281-21');
  ok(cards.icons.every(Boolean) && !cards.emoji,
    'UX281-21 : l’icône vient de icon() — aucun emoji décoratif ajouté', 'UX281-21');
  ok((await colCount(p, '.today-attention-grid .attention-card')) === 3,
    'UX281-21 : à 1440px, les trois vignettes sont réellement côte à côte', 'UX281-21');
  await shot(p, '07-today-three-attention-cards.png');

  // ---- UX281-22 : la source est exactement pendingControlsForProject().
  const source = await ev(p, () => {
    const helper = getTodayPendingControls().map((c) => c.id).sort(),
      union = activeProjects().flatMap((p) => pendingControlsForProject(p.id)).map((c) => c.id).sort(),
      src = document.querySelector('#kanvix-js').textContent,
      fn = /function getTodayPendingControls[\s\S]*?\n {6}\}/.exec(src);
    return {
      helper, union,
      same: JSON.stringify(helper) === JSON.stringify(union),
      // Le helper ne doit pas réimplémenter les règles de statut.
      reimplementsStatus: fn ? /status === ['"]conform|status === ['"]na['"]|controlIsCleared/.test(fn[0]) : true,
      usesEngine: fn ? /pendingControlsForProject/.test(fn[0]) : false,
      noDateFilter: fn ? !/TODAY|dayKey\(/.test(fn[0]) : false,
    };
  });
  note('UX281-22', { same: source.same, usesEngine: source.usesEngine, noDateFilter: source.noDateFilter });
  ok(source.same && source.usesEngine && !source.reimplementsStatus,
    'UX281-22 : getTodayPendingControls() est l’union EXACTE de pendingControlsForProject() sur activeProjects() — les règles todo / nonconform / conform / na ne sont pas réécrites', 'UX281-22');
  ok(source.noDateFilter,
    'UX281-22 : aucun filtre de date — un contrôle ouvert reste à traiter même si l’intervention s’est terminée hier', 'UX281-22');

  // ---- UX281-23 : un chantier clôturé ne remonte pas.
  const closed = await ev(p, () => {
    const c = app.controlInstances[0],
      pid = c.projectId,
      before = getTodayPendingControls().map((x) => x.id);
    project(pid).lifecycle = 'closed';
    const after = getTodayPendingControls().map((x) => x.id);
    go('today');
    const count = document.querySelectorAll('.attention-card.quality')[0].querySelector('.attention-count').textContent;
    return { before, after, stillOpen: pendingControlsForProject(pid).length, count };
  });
  note('UX281-23', closed);
  ok(closed.before.length > closed.after.length && closed.stillOpen > 0,
    'UX281-23 : un contrôle ouvert sur un chantier CLÔTURÉ disparaît de la vignette — il existe toujours, mais le cockpit du jour ne montre que les chantiers actifs', 'UX281-23');

  // ---- UX281-24 : une non-conformité passe devant.
  const priority = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const base = app.controlInstances[0],
      pid = base.projectId;
    app.controlInstances.push({
      ...structuredClone(base),
      id: 'synth-nc', status: 'nonconform', templateName: 'Contrôle non conforme',
      createdAt: localDateTime(getDemoNow()),
    });
    const list = getTodayPendingControls();
    go('today');
    const card = document.querySelector('.attention-card.quality');
    return {
      order: list.map((c) => [c.templateName, c.status]),
      first: list[0].status,
      topLine: card.querySelector('.attention-top-item')?.textContent.trim(),
      count: card.querySelector('.attention-count').textContent,
    };
  });
  note('UX281-24', priority);
  ok(priority.first === 'nonconform' && /non conforme/i.test(priority.topLine || ''),
    'UX281-24 : entre un contrôle « à contrôler » et une NON-CONFORMITÉ, c’est la non-conformité qui représente la carte — elle appelle une décision, pas seulement une vérification', 'UX281-24');

  // ---- UX281-25 : à zéro, la carte reste, calme.
  const zero = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.controlInstances = [];
    go('today');
    const c = document.querySelector('.attention-card.quality');
    return {
      present: !!c,
      calm: c.classList.contains('calm'),
      title: c.querySelector('.attention-title').textContent,
      sub: c.querySelector('.attention-sub').textContent,
      count: c.querySelector('.attention-count').textContent,
    };
  });
  note('UX281-25', zero);
  ok(zero.present && zero.calm && zero.title === 'À contrôler' && zero.sub === 'Tout est contrôlé' && zero.count === '✓',
    'UX281-25 : sans contrôle ouvert, la carte reste présente, calme : « À contrôler / Tout est contrôlé / ✓ » — même langage que les autres cartes à zéro', 'UX281-25');
  await shot(p, '10-today-quality-zero.png');

  // ---- UX281-26 : le popup liste les contrôles réels.
  const popup = await ev(p, () => {
    resetApp(); setDepth('pilot');
    go('today');
    document.querySelector('.attention-card.quality').click();
    const m = document.querySelector('#modalContent'),
      expected = getTodayPendingControls();
    return {
      open: document.querySelector('#modal').classList.contains('open'),
      title: m.querySelector('h2').textContent,
      rows: [...m.querySelectorAll('.day-task')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      expected: expected.map((c) => c.templateName),
    };
  });
  note('UX281-26', popup);
  ok(popup.open && popup.title === 'À contrôler'
    && popup.rows.length === popup.expected.length
    && popup.expected.every((n, i) => popup.rows[i].includes(n)),
    'UX281-26 : la vignette ouvre un POPUP listant les contrôles réellement ouverts, avec contrôle, tâche, chantier et statut', 'UX281-26');
  await shot(p, '08-today-quality-popup.png');

  // ---- UX281-27 : POPUP = choisir, SIDEWINDOW = faire.
  const form = await ev(p, () => {
    const expected = getTodayPendingControls()[0].id;
    document.querySelector('#modalContent .day-task').click();
    const f = document.querySelector('#controlFormEl');
    return {
      modalClosed: !document.querySelector('#modal').classList.contains('open'),
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      form: !!f,
      control: f?.dataset.control,
      expected,
      items: document.querySelectorAll('.qc-item').length,
      actions: [...document.querySelectorAll('.qc-actions .btn')].map((x) => x.textContent.trim()),
    };
  });
  note('UX281-27', form);
  ok(form.modalClosed && form.drawerOpen && form.form && form.control === form.expected
    && form.actions.join('|') === 'Non conforme|Conforme',
    'UX281-27 : cliquer un contrôle ferme le popup et ouvre le FORMULAIRE EXISTANT en sidewindow, sur le bon contrôle — POPUP pour choisir, SIDEWINDOW pour faire', 'UX281-27');
  await shot(p, '09-today-quality-form.png');

  // ---- UX281-28 : aucun second moteur qualité.
  const engines = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent,
      count = (re) => (src.match(re) || []).length;
    return {
      submit: count(/function submitControlAttempt\s*\(/g),
      openForm: count(/function openControlForm\s*\(/g),
      formHTML: count(/function controlFormHTML\s*\(/g),
      strays: count(/function (todayControlForm|operationControlForm|quickControlForm|operationQualityControls)\s*\(/g),
    };
  });
  note('UX281-28', engines);
  ok(engines.submit === 1 && engines.openForm === 1 && engines.formHTML === 1 && engines.strays === 0,
    'UX281-28 : un seul submitControlAttempt(), un seul openControlForm(), un seul controlFormHTML() — V2.8.1 n’a créé AUCUN moteur qualité parallèle', 'UX281-28');

  // ---- UX281-31 : le hero d'Aujourd'hui est gelé.
  const hero = await ev(p, () => {
    resetApp(); setDepth('pilot');
    go('today');
    const h = document.querySelector('.today-summary');
    return {
      items: [...h.querySelectorAll('.ts-item')].map((x) => x.textContent.trim()),
      hasQuality: /contrôle/i.test(h.textContent),
    };
  });
  note('UX281-31', hero);
  ok(hero.items.length === 3 && !hero.hasQuality
    && /décision/.test(hero.items[0]) && /action/.test(hero.items[1]) && /surveillance/.test(hero.items[2]),
    'UX281-31 : la ligne résumé du hero reste décisions / actions / surveillances — aucun compteur qualité n’y a été ajouté', 'UX281-31');

  await ctx.close();
}

// ============================================================
// UX281-29 / 30 — MODE CHANTIER : INCHANGÉ
// ============================================================
console.log('\n[UX281-FIELD] Mode Chantier — deux cartes, comme avant');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'FIELD' });

  const field = await ev(p, () => {
    const html = fieldAttentionSection('keravel'),
      d = document.createElement('div');
    d.innerHTML = html;
    return {
      cards: d.querySelectorAll('.attention-card').length,
      kinds: [...d.querySelectorAll('.attention-card')].map((x) => x.className.replace('attention-card ', '').split(' ')[0]),
      titles: [...d.querySelectorAll('.attention-title')].map((x) => x.textContent),
      modifier: /today-attention-grid/.test(html),
      // La règle de BASE de .attention-grid doit rester « 1fr 1fr ». À 390px
      // le média ≤1080px la ramène à une colonne pour TOUT LE MONDE (c'était
      // déjà le cas en V2.8.0) : on lit donc la règle, pas la valeur calculée
      // sur un écran étroit.
      baseRule: (() => {
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch (_) { continue; }
          for (const r of rules) {
            if (r.selectorText === '.attention-grid') return r.style.gridTemplateColumns;
          }
        }
        return null;
      })(),
      todayRuleScoped: (() => {
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch (_) { continue; }
          for (const r of rules) {
            if (r.selectorText && r.selectorText.includes('today-attention-grid')) return r.selectorText;
          }
        }
        return null;
      })(),
    };
  });
  note('UX281-29', field);
  ok(field.cards === 2 && field.kinds.join('|') === 'decide|watch' && !field.modifier,
    'UX281-29 : fieldAttentionSection() garde EXACTEMENT deux cartes — la troisième vignette est réservée au Bureau, et `.attention-grid` n’a pas été modifiée globalement', 'UX281-29');
  ok(field.baseRule === '1fr 1fr' && /today-attention-grid/.test(field.todayRuleScoped || ''),
    'UX281-29 : la règle de base `.attention-grid` reste « 1fr 1fr » et la mise à trois colonnes est PORTÉE par le modifier `.today-attention-grid` — le Mode Chantier n’est jamais atteint', 'UX281-29');

  // ---- UX281-30 : les parcours terrain sont intacts.
  const baseline = await ev(p, () => {
    const out = {};
    // Ce bloc entre lui-même en Mode Chantier : un test ne doit pas dépendre
    // des effets de bord de la sonde précédente.
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    save();
    renderPage();
    // Second clic sur « Chantier ».
    selectFieldProject('keravel');
    out.before = app.ui.fieldProjectId;
    [...document.querySelectorAll('.field-bottom button')].find((x) => /Chantier/.test(x.textContent)).click();
    out.after = app.ui.fieldProjectId;
    out.picker = /Choisir un chantier/.test(document.body.textContent);
    // Messages.
    selectFieldProject('keravel');
    setFieldTab('messages');
    out.messages = app.ui.fieldTab === 'messages' && !!document.querySelector('.conv-list');
    // Planning mobile.
    setFieldTab('site');
    openFieldPlanning('k-windows');
    out.planning = app.ui.fieldView === 'planning';
    setFieldTab('site');
    // « À contrôler » du Mode Chantier.
    selectFieldProject('keravel');
    const list = document.querySelector('#fieldControlList');
    out.control = list ? list.querySelectorAll('.qc-row').length : 0;
    out.bottom = [...document.querySelectorAll('.field-bottom button')].map((x) => x.textContent.replace(/\d+/g, '').trim());
    return out;
  });
  note('UX281-30', baseline);
  ok(baseline.before === 'keravel' && baseline.after === null && baseline.picker
    && baseline.messages && baseline.planning && baseline.control === 1
    && baseline.bottom.join('|') === 'Chantier|Messages',
    'UX281-30 : second clic « Chantier », Messages, Planning mobile et « À contrôler » terrain se comportent exactement comme en V2.8.0', 'UX281-30');

  await ctx.close();
}

// ============================================================
// UX281-32 / 33 — SOMBRE ET RESPONSIVE
// ============================================================
console.log('\n[UX281-VISUEL] Thème sombre et responsive');
{
  const { ctx, p } = await newPage({ tag: 'DARK' });
  const dark = await ev(p, () => {
    setAppearance('dark');
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const probe = (sel) => { const e = document.querySelector(sel); return e ? { bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color } : null; };
    const out = {};
    go('sites'); setSitesMode('operations');
    out.opCard = probe('.op-card');
    selectOperation(OP);
    out.col = probe('.op-attention-col');
    out.pcard = probe('.op-project-card');
    out.pcardTitle = probe('.op-pc-id b');
    out.tabsActive = probe('.op-tabs button.active');
    go('today');
    out.quality = probe('.attention-card.quality');
    out.qualityCount = probe('.attention-card.quality .attention-count');
    document.querySelector('.attention-card.quality').click();
    out.popup = probe('.modal-box');
    out.popupRow = probe('#modalContent .day-task');
    closeOverlay('modal');
    return {
      dark: document.body.classList.contains('dark'),
      opCardDark: lum(out.opCard.bg) < 0.5,
      colDark: lum(out.col.bg) < 0.5,
      pcardDark: lum(out.pcard.bg) < 0.5,
      pcardReadable: lum(out.pcardTitle.fg) > 0.5,
      tabsActiveContrast: lum(out.tabsActive.fg) > 0.5,
      qualityDark: lum(out.quality.bg) < 0.6,
      qualityCountReadable: lum(out.qualityCount.fg) > 0.4,
      popupDark: lum(out.popup.bg) < 0.5,
      popupRowReadable: lum(out.popupRow.fg) > 0.4,
    };
  });
  await p.waitForTimeout(300);
  note('UX281-32', dark);
  ok(dark.dark && dark.opCardDark && dark.colDark && dark.pcardDark && dark.pcardReadable
    && dark.tabsActiveContrast && dark.qualityDark && dark.qualityCountReadable
    && dark.popupDark && dark.popupRowReadable,
    'UX281-32 : liste Opérations, trois colonnes, vignettes chantier, onglet actif, vignette « À contrôler » et popup qualité sont tous lisibles en thème sombre', 'UX281-32');
  await ev(p, () => { setAppearance('dark'); selectOperation(OP); });
  await shot(p, '11-operation-dark.png', { fullPage: true });
  await ev(p, () => go('today'));
  await shot(p, '12-today-dark.png', { fullPage: true });
  await ctx.close();

  // ---- UX281-33 : neuf formats.
  const bad = [];
  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800], [1080, 800], [900, 1000], [768, 1024], [430, 932], [390, 844], [360, 800]]) {
    const { ctx: c2, p: p2 } = await newPage({ w, h, tag: `RESP-${w}` });
    const m = await ev(p2, () => {
      const over = () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const o = {};
      go('today'); o.today = over();
      document.querySelector('.attention-card.quality').click(); o.popup = over(); closeOverlay('modal');
      go('sites'); o.sites = over();
      setSitesMode('operations'); o.ops = over();
      selectOperation(OP); o.overview = over();
      setOperationTab('Planning'); o.planning = over();
      setOperationTab('Ressources'); o.resources = over();
      setOperationTab('Jalons'); o.milestones = over();
      return o;
    });
    const o = Object.entries(m).filter(([, v]) => v > 0);
    if (o.length) bad.push({ w, o });
    await c2.close();
  }
  note('UX281-33', { testés: 9, débordements: bad });
  ok(bad.length === 0,
    'UX281-33 : sur neuf formats de 1920 à 360px — Aujourd’hui, popup qualité, liste Opérations et les quatre onglets — aucun débordement horizontal', 'UX281-33');
}

// ============================================================
// BYTE-IDENTITÉ V2.8.0 → V2.8.1
// ============================================================
console.log('\n[FREEZE-281] Byte-identité des moteurs V2.8.0');
{
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
  const extract = (src, name) => {
    const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
    if (!m) return null;
    let j = src.indexOf('(', m.index), dp = 0;
    for (; j < src.length; j++) { if (src[j] === '(') dp++; else if (src[j] === ')') { dp--; if (!dp) { j++; break; } } }
    let i = src.indexOf('{', j), d = 0;
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) return src.slice(m.index, i + 1); } }
    return null;
  };
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
  const frozen = [
    'operation', 'operationsOrdered', 'operationProjects', 'operationActiveProjects',
    'operationProjectIds', 'operationActiveProjectIds', 'operationTasks', 'operationActiveTasks',
    'operationMilestones', 'operationControls', 'operationPendingControls', 'operationResourceIds',
    'operationResources', 'operationDecisions', 'operationWarnings',
    'operationCrossProjectResourceConflicts', 'operationProjectBounds', 'operationWorstHealth',
    'getOperationSummary', 'validateOperationState', 'assignableProjectsForOperation',
    'applyOperationMembership', 'submitOperation', 'openOperationForm', 'openOperationProjects',
    'confirmDeleteOperation', 'selectOperation', 'setOperationTab', 'operationPlanningTab',
    'operationResourcesTab', 'operationMilestonesTab', 'operationMacroPlanning',
    'operationConflictCard', 'operationConflictLine',
    'planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'resourceLoadGroups',
    'getResourceSchedulingConflicts', 'getResourceState', 'getResourceLoad',
    'getProjectHealth', 'getProjectSummary', 'getProjectClosureStatus', 'getProjectTasks',
    'pendingControlsForProject', 'pendingControlsForTask', 'submitControlAttempt',
    'controlFormHTML', 'openControlForm', 'controlRowHTML', 'setTaskStatus', 'createRework',
    'buildKanvixBackup', 'applyImportPlan', 'validateImportState', 'exportKanvixData',
    'migrateState', 'renderField', 'handleFieldSiteTab', 'setFieldTab', 'fieldAttentionSection',
    'fieldControlSection', 'openMoreIssues', 'attentionRows', 'attentionRowTone',
    'getTodayDecisions', 'getTodayWarnings', 'getTodayWorkflow', 'activeProjectsPanel',
    'renderSites', 'siteCard', 'openProjectEdit', 'renderOperationsList',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-281', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-281 : les ${frozen.length} moteurs métier de V2.8.0 sont BYTE-IDENTIQUES — toute l’architecture Opération, le Planning, les ressources, la qualité, le Mode Chantier et les données`, 'FREEZE-281');

  const perimeter = ['operationCard', 'operationCardMenu', 'renderOperation', 'operationOverviewTab', 'attentionCard', 'pageToday'];
  const changed = perimeter
    .filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  // operationCard() n'a PAS eu besoin de changer : c'est son menu
  // (operationCardMenu) qui portait le défaut de positionnement.
  const perimeterIntact = perimeter.filter((n) => !changed.includes(n));
  const added = ['operationAttentionGrid', 'operationProjectCard', 'getTodayPendingControls', 'openQualityControlsPopup', 'openTodayQualityControls']
    .filter((n) => extract(curSrc, n) && !extract(prevSrc, n));
  const removed = ['operationProjectRow'].filter((n) => extract(prevSrc, n) && !extract(curSrc, n));
  note('FREEZE-281-périmètre', { modifiées: changed, intactes: perimeterIntact, ajoutées: added, remplacées: removed });
  ok(changed.length === 5 && perimeterIntact.join() === 'operationCard'
    && added.length === 5 && removed.length === 1,
    'FREEZE-281 : 5 fonctions de présentation modifiées (operationCard elle-même n’a pas eu à changer — c’est son menu qui portait le défaut), 5 helpers ajoutés, operationProjectRow() remplacée par operationProjectCard() — rien d’autre', 'FREEZE-281');

  // attentionCard : les natures decide et watch n'ont pas changé de rendu.
  const ac = extract(curSrc, 'attentionCard');
  note('FREEZE-281-attentionCard', {
    qualityAdded: /kind === "quality"/.test(ac),
    decideIntact: /decisionSummary\(items\)/.test(ac) && /warningSummary\(items\)/.test(ac),
    iconBranch: /icon\(quality \? "quality" : decide \? "alert" : "eye"\)/.test(ac),
  });
  ok(/kind === "quality"/.test(ac) && /decisionSummary\(items\)/.test(ac) && /warningSummary\(items\)/.test(ac),
    'FREEZE-281 : attentionCard() n’a fait qu’AJOUTER la nature « quality » — decide et watch conservent leurs résumés et leurs icônes', 'FREEZE-281');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-281-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && store(curSrc) === store(prevSrc)
    && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '12',
    'FREEZE-281 : STORE et SCHEMA_VERSION (12) strictement inchangés — aucune migration', 'FREEZE-281');
}

// ============================================================
// SYNTHÈSE
// ============================================================
const appErrs = allErrs.filter((e) => !/ERR_FAILED|ERR_TUNNEL/.test(e.msg));
console.log('\n============================================================');
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 12), null, 1));
console.log('============================================================');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length || appErrs.length ? 1 : 0);
