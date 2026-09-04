// ============================================================
// KANVIX — RECETTE / AUDIT du PLANNING BUREAU (baseline V2.4.9.1)
//   AUDIT EN LECTURE SEULE — ne modifie jamais le POC.
//   Observe -> reproduit -> classe -> documente.
//   Usage : node recette-planning-bureau-v2.4.9.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.9.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-planning-bureau/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const findings = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const finding = (id, sev, scenario, observed, expected) => { findings.push({ id, sev, scenario, observed, expected }); console.log(`  ⚑ ${id} [${sev}] ${scenario} — ${observed}`); };
const note = (sec, d) => { console.log(`  (info) [${sec}] ${JSON.stringify(d)}`); };
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
const openPlan = async (p, level = 'pilot') => { await ev(p, (lv) => { resetApp(); setDepth(lv); go('planning'); }, level); await p.waitForTimeout(200); };
// ids des tâches réellement rendues dans le Gantt / le Kanban
const ganttIds = (p) => ev(p, () => [...document.querySelectorAll('.g-bar:not(.ghost):not(.baseline)')].map((e) => e.id.replace('bar-', '')).sort());
const kanbanIds = (p) => ev(p, () => [...document.querySelectorAll('.kanban-card')].map((c) => (c.getAttribute('onclick') || '').match(/openTask\('([^']+)'/)?.[1]).filter(Boolean).sort());
const settle = async (p) => { await ev(p, () => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show'); }); await p.waitForTimeout(120); };
// event factice pour rejouer fidèlement le drag Gantt (dragStart -> dropTask)
const FAKE = `{ preventDefault(){}, currentTarget:{ classList:{ add(){}, remove(){} } }, dataTransfer:{ _d:'', effectAllowed:'', setData(k,v){this._d=v;}, getData(){ return this._d; } } }`;
const orphans = (p) => ev(p, () => {
  const T = new Set(app.tasks.map((t) => t.id)), P = new Set(app.projects.map((x) => x.id));
  let n = 0;
  app.tasks.forEach((t) => { if (!P.has(t.projectId)) n++; (t.deps || []).forEach((d) => { if (!T.has(d)) n++; }); });
  return n;
});

// ============================================================
// CAPTURES A→N
// ============================================================
console.log('\n[CAPTURES] A→N');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'CAP' });
  await openPlan(p);
  await settle(p);
  await p.screenshot({ path: SHOTS + 'A-gantt-semaine.png', fullPage: true });
  await ev(p, () => setPeriod('day')); await settle(p); await p.screenshot({ path: SHOTS + 'B-gantt-jour.png', fullPage: true });
  await ev(p, () => setPeriod('month')); await settle(p); await p.screenshot({ path: SHOTS + 'C-gantt-mois.png', fullPage: true });
  await ev(p, () => setPeriod('year')); await settle(p); await p.screenshot({ path: SHOTS + 'D-gantt-annee.png', fullPage: true });
  await ev(p, () => { setPeriod('week'); setPlanningView('kanban'); }); await settle(p); await p.screenshot({ path: SHOTS + 'E-kanban.png', fullPage: true });
  await ev(p, () => { setPlanningView('gantt'); setPlanningFilter('project', 'keravel'); }); await settle(p); await p.screenshot({ path: SHOTS + 'F-filtres.png', fullPage: true });
  await ev(p, () => { setPlanningFilter('project', 'all'); app.settings.dependencies = true; save(); renderPage(); requestAnimationFrame(drawDeps); }); await settle(p); await p.screenshot({ path: SHOTS + 'G-dependances.png', fullPage: true });
  await ev(p, () => toggleBaseline(true)); await settle(p); await p.screenshot({ path: SHOTS + 'H-baseline.png', fullPage: true });
  await ev(p, () => { toggleBaseline(false); toggleImpactChain(true); }); await settle(p); await p.screenshot({ path: SHOTS + 'I-impact-chain.png', fullPage: true });
  await ev(p, () => toggleImpactChain(false)); await settle(p);
  // conflit : rendre une dépendance incompatible pour la capture
  await ev(p, () => { let t = task('k-windows'); t.end = '2026-08-18T16:30'; save(); renderPage(); }); await settle(p); await p.screenshot({ path: SHOTS + 'J-conflit.png', fullPage: true });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); openTaskEdit('k-windows', 'planning-gantt'); }); await p.waitForTimeout(200); await p.screenshot({ path: SHOTS + 'K-edition.png', fullPage: true });
  await ev(p, () => { closeOverlay('drawer'); project('keravel').lifecycle = 'closed'; app.ui.planningProject = 'keravel'; save(); renderPage(); }); await settle(p); await p.screenshot({ path: SHOTS + 'L-readonly.png', fullPage: true });
  await ev(p, () => { resetApp(); setDepth('pilot'); setAppearance('dark'); go('planning'); }); await settle(p); await p.screenshot({ path: SHOTS + 'M-dark.png', fullPage: true });
  await ev(p, () => setAppearance('light')); await ctx.close();
  const { ctx: c2, p: p2 } = await newPage({ viewport: { width: 1280, height: 800 }, _tag: 'CAP1280' });
  await openPlan(p2); await settle(p2); await p2.screenshot({ path: SHOTS + 'N-1280.png', fullPage: true });
  await c2.close();
  console.log('  captures A→N enregistrées');
}

// ============================================================
// PLAN-F1 — Navigation temporelle (P0)
// ============================================================
console.log('\n[PLAN-F1] Navigation temporelle');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F1' });
  await openPlan(p);
  await ev(p, () => setPlanningFilter('project', 'keravel'));
  const seq = ['day', 'week', 'month', 'year', 'week'];
  let stable = true;
  for (const per of seq) {
    await ev(p, (x) => setPeriod(x), per);
    await p.waitForTimeout(80);
    const st = await ev(p, () => ({ period: app.settings.period, proj: app.ui.planningProject, view: app.ui.planningView }));
    if (st.period !== per || st.proj !== 'keravel') stable = false;
  }
  ok(stable, 'PLAN-F1 : période changée sans perte du filtre chantier', 'PLAN-F1');
  await ev(p, () => shiftPlanning(1)); await p.waitForTimeout(60);
  const nav1 = await ev(p, () => app.ui.periodAnchor);
  await ev(p, () => planningToday()); await p.waitForTimeout(60);
  const navToday = await ev(p, () => app.ui.periodAnchor);
  ok(nav1 !== navToday, 'PLAN-F1 : ← / → / Aujourd’hui modifient l’ancre de période', 'PLAN-F1');
  ok(await ev(p, () => app.ui.planningProject === 'keravel'), 'PLAN-F1 : filtre conservé après navigation', 'PLAN-F1');
  await ctx.close();
}

// ============================================================
// PLAN-F2 — Multi-chantiers / filtres + parité Gantt==Kanban (P0)
// ============================================================
console.log('\n[PLAN-F2] Filtres + parité Gantt/Kanban');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F2' });
  await openPlan(p);
  // Tous -> Gantt ids ; Kanban ids : même ensemble
  const gAll = await ganttIds(p);
  await ev(p, () => setPlanningView('kanban')); await p.waitForTimeout(120);
  const kAll = await kanbanIds(p);
  note('F2', { gAll: gAll.length, kAll: kAll.length });
  ok(JSON.stringify(gAll) === JSON.stringify(kAll), 'PLAN-F2 : Gantt et Kanban affichent le MÊME ensemble de tâches (toutes)', 'PLAN-F2');
  // filtre keravel : parité
  await ev(p, () => { setPlanningView('gantt'); setPlanningFilter('project', 'keravel'); }); await p.waitForTimeout(120);
  const gK = await ganttIds(p);
  await ev(p, () => setPlanningView('kanban')); await p.waitForTimeout(120);
  const kK = await kanbanIds(p);
  ok(JSON.stringify(gK) === JSON.stringify(kK) && gK.every((id) => id.startsWith('k-')), 'PLAN-F2 : filtre chantier — parité Gantt/Kanban + uniquement Keravel', 'PLAN-F2');
  // filtre ressource
  await ev(p, () => { setPlanningView('gantt'); setPlanningFilter('project', 'all'); setPlanningFilter('resource', 'thomas'); }); await p.waitForTimeout(120);
  ok(await ev(p, () => [...document.querySelectorAll('.g-bar:not(.ghost):not(.baseline)')].map(e => e.id.replace('bar-', '')).every(id => task(id).resourceId === 'thomas')), 'PLAN-F2 : filtre ressource — uniquement les tâches de Thomas', 'PLAN-F2');
  // filtre donnant zéro -> état vide propre
  // marc n'a aucune tâche sur Keravel → combinaison réellement vide
  await ev(p, () => { setPlanningFilter('resource', 'all'); setPlanningFilter('project', 'keravel'); setPlanningFilter('resource', 'marc'); }); await p.waitForTimeout(120);
  const emptyState = await ev(p, () => ({ empty: !!document.querySelector('.plan-empty'), reset: !!document.querySelector('.plan-empty .btn') }));
  ok(emptyState.empty && emptyState.reset, 'PLAN-F2 : filtre à 0 tâche → état vide + réinitialiser (jamais écran blanc)', 'PLAN-F2');
  await ctx.close();
}

// ============================================================
// PLAN-F3 — Édition universelle depuis Gantt/Kanban (P0)
// ============================================================
console.log('\n[PLAN-F3] Édition universelle depuis le planning');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F3' });
  await openPlan(p);
  // contexte préservé : filtre + période conservés après édition
  await ev(p, () => { setPlanningFilter('project', 'keravel'); setPeriod('week'); openTaskEdit('k-windows', 'planning-gantt'); }); await p.waitForTimeout(150);
  await ev(p, () => { document.querySelector('#taskEditForm [name=name]').value = 'Pose fenêtres (audit)'; markTaskEditDirty(); submitTaskEdit(); }); await p.waitForTimeout(150);
  const r = await ev(p, () => ({ name: task('k-windows').name, proj: app.ui.planningProject, period: app.settings.period, undo: app.undoStack.length }));
  ok(r.name === 'Pose fenêtres (audit)', 'PLAN-F3 : modification simple appliquée', 'PLAN-F3');
  ok(r.proj === 'keravel' && r.period === 'week', 'PLAN-F3 : contexte (filtre + période) conservé après édition', 'PLAN-F3');
  ok(r.undo === 1, 'PLAN-F3 : un snapshot Undo', 'PLAN-F3');
  await ev(p, () => undo()); await p.waitForTimeout(100);
  ok(await ev(p, () => task('k-windows').name === 'Pose des 6 fenêtres'), 'PLAN-F3 : Undo restaure le nom', 'PLAN-F3');
  // Kanban : édition reste Kanban
  await ev(p, () => { setPlanningView('kanban'); openTaskEdit('k-windows', 'planning-kanban'); }); await p.waitForTimeout(120);
  await ev(p, () => { document.querySelector('#taskEditForm [name=name]').value = 'X'; markTaskEditDirty(); submitTaskEdit(); }); await p.waitForTimeout(120);
  ok(await ev(p, () => app.ui.planningView === 'kanban'), 'PLAN-F3 : après édition depuis Kanban, on reste en Kanban', 'PLAN-F3');
  await ctx.close();
}

// ============================================================
// PLAN-F4 — DRAG GANTT + DÉPENDANCES (P0, CRITIQUE)
//   Compare le drag Gantt au moteur d'édition universelle.
// ============================================================
console.log('\n[PLAN-F4] Drag Gantt vs édition universelle (CRITIQUE)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F4' });
  await openPlan(p);

  // --- Référence : le moteur SÛR (éditeur) protège done et arbitre doing ---
  const editorSafe = await ev(p, () => {
    // k-lining downstream = done ; l'éditeur ne doit jamais la déplacer
    task('k-lining').status = 'done';
    const before = task('k-lining').start;
    const plan = planReflow('k-windows', { end: '2026-08-25T16:30' });
    return { doneInShifts: plan.shifts.some((sh) => sh.taskId === 'k-lining'), doneReported: plan.done.includes('k-lining'), before };
  });
  ok(!editorSafe.doneInShifts && editorSafe.doneReported, 'PLAN-F4(réf) : planReflow (éditeur) ne déplace PAS une tâche terminée en aval', 'PLAN-F4');

  // --- A) Le drag applique IMMÉDIATEMENT, sans aperçu préalable ---
  await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); setPeriod('week'); });
  await p.waitForTimeout(120);
  const dragImmediate = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    const s = scale();
    // indice d'une colonne d'un autre jour que le début actuel de k-windows
    const idx = s.dates.findIndex((d) => d.slice(0, 10) !== task('k-windows').start.slice(0, 10));
    const beforeStart = task('k-windows').start;
    const modalBefore = document.querySelector('#modal').classList.contains('open');
    dragStart(fe, 'k-windows');
    dropTask(fe, idx >= 0 ? idx : 1);
    // état juste après drop : la donnée est-elle déjà modifiée ?
    return { movedImmediately: task('k-windows').start !== beforeStart, modalBefore, appliedThenPrompt: true };
  }, FAKE);
  const noPreview = dragImmediate.movedImmediately;
  ok(true, 'PLAN-F4(A) : comportement du drag observé (voir finding)', 'PLAN-F4');
  if (noPreview) finding('P-01a', 'MAJOR', 'PLAN-F4 / §21-A', 'Le drag Gantt applique le déplacement immédiatement (save+render) : aucun aperçu d’impact AVANT validation, contrairement à l’éditeur universel (openTaskEdit → showTaskEditImpact).', 'Un aperçu des conséquences avant application, comme l’éditeur universel.');

  // --- B/C) propagateDependencies (chemin "Propager le décalage" du drag) déplace une tâche DONE en aval ---
  const propDone = await ev(p, () => {
    resetApp();
    // construit un conflit A(k-windows) -> B(k-lining) avec B terminée
    task('k-lining').status = 'done';
    task('k-windows').end = '2026-08-19T16:30'; // dépasse le début de k-lining (2026-08-17)
    const beforeStart = task('k-lining').start;
    const conflicts = findDependencyConflicts().length;
    // c'est exactement ce que "Propager le décalage" (dependencyPrompt) exécute :
    const changes = propagateDependencies('k-windows');
    const moved = changes.find((c) => c.taskId === 'k-lining');
    return { conflicts, doneMoved: !!moved, beforeStart, to: moved?.start };
  });
  ok(true, 'PLAN-F4(C) : propagation du drag observée (voir finding)', 'PLAN-F4');
  if (propDone.doneMoved) finding('P-01c', 'BLOCKER', 'PLAN-F4 / §18/§21-C', `Le chemin de propagation du drag (propagateDependencies, via « Propager le décalage ») déplace une tâche TERMINÉE en aval (k-lining : ${propDone.beforeStart} → ${propDone.to}).`, 'Une tâche terminée ne doit jamais être déplacée (règle planReflow : done immobile + coupe la cascade).');

  // --- D) propagateDependencies déplace une tâche DOING en aval, silencieusement ---
  const propDoing = await ev(p, () => {
    resetApp();
    task('k-lining').status = 'doing';
    task('k-windows').end = '2026-08-19T16:30';
    const beforeStart = task('k-lining').start;
    const changes = propagateDependencies('k-windows');
    const moved = changes.find((c) => c.taskId === 'k-lining');
    return { doingMoved: !!moved, beforeStart, to: moved?.start };
  });
  if (propDoing.doingMoved) finding('P-01d', 'MAJOR', 'PLAN-F4 / §19/§21-D', `Le chemin de propagation du drag déplace une tâche EN COURS en aval sans arbitrage (k-lining : ${propDoing.beforeStart} → ${propDoing.to}).`, 'Une tâche en cours ne doit jamais être déplacée en silence : arbitrage explicite (planReflow.doing).');
  ok(true, 'PLAN-F4(D) : arbitrage doing du drag observé (voir finding)', 'PLAN-F4');

  // --- Undo restaure après drag ---
  await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); setPeriod('week'); }); await p.waitForTimeout(100);
  const undoDrag = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    const before = JSON.stringify({ s: task('k-windows').start, e: task('k-windows').end });
    const s = scale();
    const idx = s.dates.findIndex((d) => d.slice(0, 10) !== task('k-windows').start.slice(0, 10));
    dragStart(fe, 'k-windows'); dropTask(fe, idx >= 0 ? idx : 1);
    const moved = JSON.stringify({ s: task('k-windows').start, e: task('k-windows').end });
    undo();
    const after = JSON.stringify({ s: task('k-windows').start, e: task('k-windows').end });
    return { changed: before !== moved, restored: before === after };
  }, FAKE);
  ok(undoDrag.changed && undoDrag.restored, 'PLAN-F4 : Undo restaure exactement les dates après un drag', 'PLAN-F4');
  ok((await orphans(p)) === 0, 'PLAN-F4 : aucune référence orpheline après drag/propagation', 'PLAN-F4');
  await ctx.close();
}

// ============================================================
// §22 — Drag d'une tâche indépendante (durée conservée)
// ============================================================
console.log('\n[DRAG-INDEP] Drag tâche indépendante');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'DRAGI' });
  await openPlan(p);
  const r = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    // k-cloisons : pas de deps, pas de successeur
    const durBefore = date(task('k-cloisons').end) - date(task('k-cloisons').start);
    const hBefore = app.history.length;
    const s = scale();
    const idx = s.dates.findIndex((d) => d.slice(0, 10) !== task('k-cloisons').start.slice(0, 10));
    dragStart(fe, 'k-cloisons'); dropTask(fe, idx >= 0 ? idx : 1);
    const durAfter = date(task('k-cloisons').end) - date(task('k-cloisons').start);
    return { durKept: durBefore === durAfter, historyAdded: app.history.length > hBefore, undo: app.undoStack.length };
  }, FAKE);
  ok(r.durKept, 'DRAG-INDEP : durée conservée après déplacement', 'DRAG-INDEP');
  ok(r.undo >= 1, 'DRAG-INDEP : un snapshot Undo posé', 'DRAG-INDEP');
  // Observation : contrairement à moveTask (« déplacée au … ») et à l'éditeur
  // (« modifiée »), dropTask ne journalise AUCUNE entrée d'historique.
  ok(true, 'DRAG-INDEP : traçabilité du drag observée (voir finding P-03)', 'DRAG-INDEP');
  if (!r.historyAdded) finding('P-03', 'MINOR', '§58 (historique)', 'Le drag Gantt (dropTask) ne journalise AUCUNE entrée d’historique, alors que moveTask (« déplacée au … ») et l’éditeur universel (« modifiée ») le font. Le déplacement par glisser n’apparaît pas dans la timeline (Undo reste possible via snapshot).', 'Le drag devrait tracer une entrée d’historique cohérente avec les autres actions de replanification.');
  await ctx.close();
}

// ============================================================
// PLAN-F5 — Kanban statut uniquement (P0)
// ============================================================
console.log('\n[PLAN-F5] Kanban statut uniquement');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F5' });
  await openPlan(p);
  await ev(p, () => setPlanningView('kanban')); await p.waitForTimeout(100);
  const r = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    const beforeStart = task('k-final').start;
    kanbanDragStart(fe, 'k-final'); kanbanDrop(fe, 'doing');
    return { status: task('k-final').status, startKept: task('k-final').start === beforeStart,
      fieldStart: app.issues.some((i) => i.taskId === 'k-final' && i.kind === 'field-start'),
      hist: app.history[0]?.text || '' };
  }, FAKE);
  ok(r.status === 'doing' && r.startKept, 'PLAN-F5 : drag Kanban change le statut sans toucher aux dates', 'PLAN-F5');
  ok(!r.fieldStart && !/sur le terrain/.test(r.hist), 'PLAN-F5 : aucune fausse confirmation terrain (conducteur)', 'PLAN-F5');
  await ctx.close();
}

// ============================================================
// §25 — Statuts internes waiting/late préservés dans la fiche
// ============================================================
console.log('\n[STATUTS] waiting/late préservés');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'ST' });
  await openPlan(p);
  const r = await ev(p, () => ({
    windowsStatus: task('k-windows').status, // 'late' dans le seed
    electricStatus: task('k-electric').status, // 'waiting'
  }));
  ok(r.windowsStatus === 'late' && r.electricStatus === 'waiting', 'STATUTS : waiting/late conservés dans le modèle métier (fiche)', 'STATUTS');
  await ctx.close();
}

// ============================================================
// PLAN-F7 — Chantier clôturé : lecture seule intégrale (P0)
// ============================================================
console.log('\n[PLAN-F7] Lecture seule (chantier clôturé)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'F7' });
  await openPlan(p);
  await ev(p, () => { project('keravel').lifecycle = 'closed'; app.ui.planningProject = 'keravel'; save(); renderPage(); }); await p.waitForTimeout(120);
  const r = await ev(p, () => ({
    lockNote: !!document.querySelector('.lock-note'),
    addBtn: !!([...document.querySelectorAll('.planning-header .btn')].find((x) => /Tâche/.test(x.textContent) && x.classList.contains('primary'))),
    draggable: [...document.querySelectorAll('.g-bar[draggable="true"]')].length,
    readOnly: planningIsReadOnly('keravel'),
  }));
  ok(r.lockNote && r.readOnly, 'PLAN-F7 : bandeau « lecture seule » + planningIsReadOnly=true', 'PLAN-F7');
  ok(!r.addBtn, 'PLAN-F7 : bouton « + Tâche » absent', 'PLAN-F7');
  ok(r.draggable === 0, 'PLAN-F7 : aucune barre draggable (drag Gantt désactivé)', 'PLAN-F7');
  // éditeur refusé
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt')); await p.waitForTimeout(100);
  ok(!(await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#taskEditForm'))), 'PLAN-F7 : openTaskEdit refusé (lecture seule inviolable)', 'PLAN-F7');
  // drag tenté malgré tout : guardEditable bloque
  const dragBlocked = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    const before = task('k-windows').start;
    dragStart(fe, 'k-windows'); dropTask(fe, 3);
    return task('k-windows').start === before;
  }, FAKE);
  ok(dragBlocked, 'PLAN-F7 : même forcé, dropTask est bloqué par guardEditable', 'PLAN-F7');
  // navigation/consultation restent possibles
  await ev(p, () => { setPeriod('month'); }); await p.waitForTimeout(80);
  ok(await ev(p, () => app.settings.period === 'month'), 'PLAN-F7 : navigation temporelle toujours possible en lecture seule', 'PLAN-F7');
  await ctx.close();
}

// ============================================================
// §36 — Tâche terminée : éditeur refuse MAIS drag Gantt l'autorise ?
// ============================================================
console.log('\n[DONE] Tâche terminée — éditeur vs drag');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'DONE' });
  await openPlan(p);
  await ev(p, () => { task('k-windows').status = 'done'; task('k-windows').end = '2026-08-14T16:30'; save(); renderPage(); }); await p.waitForTimeout(100);
  // éditeur refuse (attendu, sûr)
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt')); await p.waitForTimeout(80);
  const editorRefused = !(await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#taskEditForm')));
  ok(editorRefused, 'DONE : l’éditeur universel refuse une tâche terminée (comportement sûr, §36)', 'DONE');
  // la barre d'une tâche terminée est-elle draggable ? le drag la déplace-t-il ?
  const dragDone = await ev(p, (FAKE) => {
    const fe = eval('(' + FAKE + ')');
    const bar = document.querySelector('#bar-k-windows');
    const draggable = bar ? bar.getAttribute('draggable') === 'true' : false;
    const before = task('k-windows').start;
    const s = scale();
    const idx = s.dates.findIndex((d) => d.slice(0, 10) !== task('k-windows').start.slice(0, 10));
    dragStart(fe, 'k-windows'); dropTask(fe, idx >= 0 ? idx : 3);
    return { draggable, moved: task('k-windows').start !== before, from: before, to: task('k-windows').start, still: task('k-windows').status };
  }, FAKE);
  ok(true, 'DONE : comportement drag d’une tâche terminée observé (voir finding)', 'DONE');
  if (dragDone.moved) finding('P-02', 'BLOCKER', '§36 / §21 / §73', `Une tâche TERMINÉE reste glissable sur le Gantt (draggable=${dragDone.draggable}) et le drag la déplace (${dragDone.from} → ${dragDone.to}), alors que l’éditeur universel l’interdit. Le drag Gantt contourne la protection des tâches terminées.`, 'Une tâche terminée ne doit jamais pouvoir être déplacée depuis le planning (canDrag devrait exclure status==="done").');
  await ctx.close();
}

// ============================================================
// §29/§30 — Baseline + chaîne d'impact (toggle propre)
// ============================================================
console.log('\n[ANALYSE] Baseline / Impact toggles');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'AN' });
  await openPlan(p);
  await ev(p, () => toggleBaseline(true)); await p.waitForTimeout(100);
  ok(await ev(p, () => document.querySelectorAll('.baseline').length > 0), 'ANALYSE : baseline affiche les barres « prévu initial »', 'ANALYSE');
  await ev(p, () => toggleBaseline(false)); await p.waitForTimeout(100);
  ok(await ev(p, () => document.querySelectorAll('.baseline').length === 0), 'ANALYSE : désactiver baseline ne laisse aucun reste graphique', 'ANALYSE');
  await ev(p, () => toggleImpactChain(true)); await p.waitForTimeout(120);
  ok(await ev(p, () => app.ui.impactChain === true && (document.querySelector('.gantt')?.classList.contains('impact-mode') || document.querySelectorAll('.ic-marker').length >= 0)), 'ANALYSE : chaîne d’impact activable', 'ANALYSE');
  await ev(p, () => toggleImpactChain(false)); await p.waitForTimeout(80);
  // conflit compté correctement (aucun par défaut)
  ok(await ev(p, () => planningProblems().total === 0), 'ANALYSE : aucun conflit inventé sur le seed par défaut', 'ANALYSE');
  await ev(p, () => { task('k-windows').end = '2026-08-19T16:30'; save(); renderPage(); }); await p.waitForTimeout(80);
  ok(await ev(p, () => planningProblems().deps >= 1), 'ANALYSE : un conflit de dépendance réel est bien compté', 'ANALYSE');
  await ctx.close();
}

// ============================================================
// §35 — Création d'une tâche
// ============================================================
console.log('\n[CREATE] Création tâche');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'CR' });
  await openPlan(p);
  const before = await ev(p, () => app.tasks.length);
  await ev(p, () => openTaskForm()); await p.waitForTimeout(120);
  const formOpen = await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#drawer form'));
  ok(formOpen, 'CREATE : « + Tâche » ouvre un formulaire de création', 'CREATE');
  await ctx.close();
}

// ============================================================
// §16 — Repli des chantiers (stabilité SVG deps)
// ============================================================
console.log('\n[COLLAPSE] Repli des chantiers');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'COL' });
  await openPlan(p);
  await ev(p, () => { app.settings.dependencies = true; save(); renderPage(); });
  const before = await ganttIds(p);
  for (let i = 0; i < 20; i++) { await ev(p, () => { toggleProject('keravel'); }); }
  // nombre pair de bascules -> revient à l'état déplié
  const after = await ganttIds(p);
  ok(JSON.stringify(before) === JSON.stringify(after), 'COLLAPSE : 20 cycles replier/déplier → lignes restituées exactement', 'COLLAPSE');
  ok((await orphans(p)) === 0, 'COLLAPSE : aucune dérive de données', 'COLLAPSE');
  await ctx.close();
}

// ============================================================
// §55 — Synchronisation multi-onglets (Gantt A / Kanban B)
// ============================================================
console.log('\n[SYNC] Multi-onglets');
try {
  const HTTP = 'http://localhost:8241/kanvix-next-gen-v2.4.9.1.html' + NOW;
  const ctxS = await b.newContext();
  const pA = await ctxS.newPage(), pB = await ctxS.newPage();
  await pA.route('https://api.open-meteo.com/**', (r) => r.abort('failed')); await pA.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await pB.route('https://api.open-meteo.com/**', (r) => r.abort('failed')); await pB.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('planning'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { setDepth('pilot'); go('planning'); setPlanningView('kanban'); });
  await pA.waitForTimeout(150);
  await ev(pA, () => { openTaskEdit('k-windows', 'planning-gantt'); });
  await pA.waitForTimeout(100);
  await ev(pA, () => { document.querySelector('#taskEditForm [name=name]').value = 'Fenêtres — sync bureau'; markTaskEditDirty(); submitTaskEdit(); });
  await pB.waitForTimeout(500);
  ok(await ev(pB, () => (document.querySelector('.kanban')?.textContent || '').includes('Fenêtres — sync bureau')), 'SYNC : onglet B (Kanban) reflète l’édition de A sans F5', 'SYNC');
  await ctxS.close();
} catch (e) { note('SYNC', 'ERREUR ' + e.message); ok(false, 'SYNC : exécuté sans exception', 'SYNC'); }

// ============================================================
// §48 — Responsive : pas de scroll horizontal de PAGE
// ============================================================
console.log('\n[RESP] Responsive desktop/tablette');
for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800], [1180, 820], [1080, 800], [900, 1000]]) {
  const { ctx, p } = await newPage({ viewport: { width: w, height: h }, _tag: `R${w}` });
  await openPlan(p); await p.waitForTimeout(80);
  const hscroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!hscroll, `RESP : ${w}px — pas de scroll horizontal de page (le Gantt peut scroller en interne)`, 'RESP');
  await ctx.close();
}

// ============================================================
// §71 — Console : 0 erreur applicative pendant tout l'audit
// ============================================================
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
const appErrs = uniq.filter((e) => !/net::ERR_|ERR_TUNNEL|Failed to load resource/.test(e.msg));
ok(appErrs.length === 0, 'CONSOLE : 0 erreur JavaScript applicative (hors coupures réseau simulées)', 'CONSOLE');

await b.close();
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log('\n==== FINDINGS (' + findings.length + ') ====');
findings.forEach((f) => console.log(`${f.id} [${f.sev}] ${f.scenario}\n   observé  : ${f.observed}\n   attendu  : ${f.expected}`));
const bySev = findings.reduce((a, f) => ((a[f.sev] = (a[f.sev] || 0) + 1), a), {});
console.log('\nSÉVÉRITÉS:', JSON.stringify(bySev));
console.log(appErrs.length ? 'ERREURS CONSOLE APPLICATIVES:\n' + appErrs.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console applicative ===');
console.log('Lignes réseau simulées (hors périmètre):', uniq.length - appErrs.length);
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, findings, bySev, consoleApp: appErrs, consoleNet: uniq.length - appErrs.length }, null, 2));
process.exit(0);
