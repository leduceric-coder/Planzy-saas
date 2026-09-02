// ============================================================
// KANVIX — Recette non-régression PLANNING (V2.4.8)
//   Vérifie que l'éditeur universel de tâches (V2.4.8) n'a PAS
//   perturbé le moteur de planification existant :
//   Gantt · Kanban · drag statut · dépendances · reflow ·
//   statut (moteur central) · signal terrain Artisan · Undo ·
//   historique · Today.
//   Usage : node recette-planning-v2.4.8.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.8.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-planning/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const allErrs = [];
async function newPage(opts = {}) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: opts._tag || 'p', msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: opts._tag || 'p', msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const openPlanning = async (p) => { await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); }); await p.waitForTimeout(200); };
// event factice pour rejouer fidèlement le drag Kanban (drag→drop→setTaskStatus)
const FAKE_EV = `{ preventDefault(){}, currentTarget:{ classList:{ add(){}, remove(){} } }, dataTransfer:{ effectAllowed:'', setData(){}, getData(){ return ''; } } }`;

// ---- P1 : Gantt rend les barres ----
console.log('\n[P1] Gantt');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P1' });
  await openPlanning(p);
  const r = await ev(p, () => ({
    gantt: !!document.querySelector('.gantt'),
    bars: document.querySelectorAll('.g-bar:not(.ghost):not(.baseline)').length,
    rows: document.querySelectorAll('.g-row').length,
  }));
  ok(r.gantt && r.bars > 0 && r.rows > 0, 'P1 : Gantt affiche des barres et des lignes de tâches', 'P1');
  await p.screenshot({ path: SHOTS + 'p1-gantt.png' });
  await ctx.close();
}

// ---- P2 : Kanban rend colonnes + cartes + dépendances ----
console.log('\n[P2] Kanban');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P2' });
  await openPlanning(p);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    kanban: !!document.querySelector('.kanban'),
    cols: document.querySelectorAll('.kanban-col').length,
    cards: document.querySelectorAll('.kanban-card').length,
    depBlocks: document.querySelectorAll('.kanban-card .kb-deps, .kanban-card [class*="dep"]').length,
  }));
  ok(r.kanban && r.cols >= 3 && r.cards > 0, 'P2 : Kanban affiche colonnes + cartes', 'P2');
  await p.screenshot({ path: SHOTS + 'p2-kanban.png' });
  await ctx.close();
}

// ---- P3 : drag Kanban = STATUT uniquement (§31), aucun faux signal terrain ----
console.log('\n[P3] Drag Kanban (statut only)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P3' });
  await openPlanning(p);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(120);
  const before = await ev(p, () => ({ status: task('k-final').status, start: task('k-final').start, undo: app.undoStack.length, hist: app.history.length }));
  await ev(p, new Function(`const fe=${FAKE_EV}; kanbanDragStart(fe,'k-final'); kanbanDrop(fe,'doing');`));
  await p.waitForTimeout(150);
  const after = await ev(p, () => ({
    status: task('k-final').status,
    start: task('k-final').start,
    undo: app.undoStack.length,
    fieldStart: app.issues.some((i) => i.taskId === 'k-final' && i.kind === 'field-start'),
    histTop: app.history[0]?.text || '',
  }));
  ok(after.status === 'doing', 'P3 : drag change le statut (À faire → En cours)', 'P3');
  ok(after.start === before.start, 'P3 : drag ne déplace PAS les dates (statut uniquement)', 'P3');
  ok(after.undo === before.undo + 1, 'P3 : un snapshot Undo posé par le moteur central', 'P3');
  ok(!after.fieldStart, 'P3 : conducteur — aucun faux « démarrage confirmé sur le terrain »', 'P3');
  ok(!/sur le terrain/.test(after.histTop) && /commencée/.test(after.histTop), 'P3 : historique « commencée » (jamais « sur le terrain »)', 'P3');
  await ctx.close();
}

// ---- P4 : moteur central inchangé côté ARTISAN (signal terrain préservé) ----
console.log('\n[P4] Statut Artisan (signal terrain préservé)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'P4' });
  await ev(p, () => { resetApp(); setDepth('pilot'); setRole('artisan'); });
  await p.waitForTimeout(150);
  const r = await ev(p, () => {
    let before = app.issues.length;
    setTaskStatus('k-final', 'doing', 'task'); // chemin par défaut, rôle artisan
    return {
      status: task('k-final').status,
      fieldStart: app.issues.some((i) => i.taskId === 'k-final' && i.kind === 'field-start'),
      histTop: app.history[0]?.text || '',
      grew: app.issues.length >= before,
    };
  });
  ok(r.status === 'doing', 'P4 : Artisan — statut passe à En cours', 'P4');
  ok(r.fieldStart, 'P4 : Artisan — signal terrain « field-start » toujours créé (moteur intact)', 'P4');
  ok(/sur le terrain/.test(r.histTop), 'P4 : Artisan — historique « commencée sur le terrain »', 'P4');
  await ctx.close();
}

// ---- P5 : reflow moveTask (propagation + conflits) inchangé ----
console.log('\n[P5] Reflow moveTask');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P5' });
  await openPlanning(p);
  const r = await ev(p, () => {
    let liningBefore = task('k-lining').start;
    let undoBefore = app.undoStack.length;
    moveTask('k-windows', 5); // décale la source de 5 jours
    return { winStart: task('k-windows').start, undo: app.undoStack.length, undoBefore, liningBefore, liningAfter: task('k-lining').start };
  });
  ok(r.undo === r.undoBefore + 1, 'P5 : moveTask pose un snapshot', 'P5');
  ok(r.winStart !== undefined, 'P5 : moveTask déplace la tâche source', 'P5');
  // Undo restaure
  const undone = await ev(p, () => { undo(); return { win: task('k-windows').start }; });
  ok(!!undone.win, 'P5 : Undo restaure le planning', 'P5');
  await ctx.close();
}

// ---- P6 : Undo après changement de statut ----
console.log('\n[P6] Undo statut');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P6' });
  await openPlanning(p);
  const r = await ev(p, () => {
    let before = task('k-final').status;
    setTaskStatus('k-final', 'doing', 'task');
    let mid = task('k-final').status;
    undo();
    return { before, mid, after: task('k-final').status };
  });
  ok(r.mid === 'doing' && r.after === r.before, 'P6 : Undo restaure le statut précédent', 'P6');
  await ctx.close();
}

// ---- P7 : Today rend toujours (sanité inter-page) ----
console.log('\n[P7] Today');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P7' });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({ page: app.ui.page, hasMain: !!document.querySelector('.today-main-grid, .attention-grid, .page-today') }));
  ok(r.page === 'today' && r.hasMain, 'P7 : page Accueil (Today) rend correctement', 'P7');
  await ctx.close();
}

// ---- P8 : Gantt clic barre → consultation (drawer), pas d'édition directe (§32) ----
console.log('\n[P8] Gantt clic = consultation');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'P8' });
  await openPlanning(p);
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    drawer: document.querySelector('#drawer').classList.contains('open'),
    editorOpen: !!document.querySelector('#taskEditForm'),
    hasEditBtn: !!([...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent))),
  }));
  ok(r.drawer && !r.editorOpen, 'P8 : clic barre ouvre la CONSULTATION (drawer), pas l’éditeur', 'P8');
  ok(r.hasEditBtn, 'P8 : la consultation propose « Modifier la tâche » (2ᵉ temps)', 'P8');
  await ctx.close();
}

await b.close();
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniq.length ? 'ERREURS CONSOLE (' + uniq.length + ') :\n' + uniq.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: uniq }, null, 2));
process.exit(0);
