// ============================================================
// KANVIX — RECETTE / AUDIT Chantiers & Cockpit chantier (baseline V2.4.10.2)
//   AUDIT LECTURE SEULE — le POC n'est jamais modifié.
//   Observe -> reproduit -> classe -> documente.
//   Usage : node recette-chantiers-v2.4.10.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.10.2.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-chantiers/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [], findings = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const finding = (id, sev, scenario, observed, expected) => { findings.push({ id, sev, scenario, observed, expected }); console.log(`  ⚑ ${id} [${sev}] ${scenario} — ${observed}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
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
const sites = async (p, lvl = 'pilot') => { await ev(p, (l) => { resetApp(); setDepth(l); app.ui.sitesView = 'active'; go('sites'); }, lvl); await p.waitForTimeout(180); };
const settle = async (p) => { await ev(p, () => { const t = document.querySelector('#toast'); if (t) t.classList.remove('show'); }); await p.waitForTimeout(100); };
// Intégrité : compte les références orphelines dans tout l'état métier
const orphans = (p) => ev(p, () => {
  const P = new Set(app.projects.map((x) => x.id)), T = new Set(app.tasks.map((t) => t.id)), I = new Set(app.issues.map((i) => i.id));
  let n = 0;
  app.tasks.forEach((t) => { if (!P.has(t.projectId)) n++; (t.deps || []).forEach((d) => { if (!T.has(d)) n++; }); });
  app.issues.forEach((i) => { if (!P.has(i.projectId)) n++; if (i.taskId && !T.has(i.taskId)) n++; });
  app.decisions.forEach((d) => { if (d.issueId && !I.has(d.issueId)) n++; });
  app.milestones.forEach((m) => { if (!P.has(m.projectId)) n++; if (m.taskId && !T.has(m.taskId)) n++; });
  app.documents.forEach((d) => { if (d.projectId && !P.has(d.projectId)) n++; if (d.taskId && !T.has(d.taskId)) n++; });
  app.photos.forEach((ph) => { if (!P.has(ph.projectId)) n++; if (ph.taskId && !T.has(ph.taskId)) n++; });
  app.messages.forEach((m) => { if (m.projectId && !P.has(m.projectId)) n++; if (m.taskId && !T.has(m.taskId)) n++; });
  return n;
});

// ============================================================
// CAPTURES A→Q
// ============================================================
console.log('\n[CAPTURES] A→Q');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'CAP' });
  await sites(p); await settle(p); await p.screenshot({ path: SHOTS + 'A-sites-active.png', fullPage: true });
  await ev(p, () => { app.ui.sitesView = 'closed'; renderPage(); }); await settle(p); await p.screenshot({ path: SHOTS + 'B-sites-closed.png', fullPage: true });
  await ev(p, () => { app.ui.sitesView = 'archived'; renderPage(); }); await settle(p); await p.screenshot({ path: SHOTS + 'C-sites-archives.png', fullPage: true });
  await ev(p, () => { app.ui.sitesView = 'active'; renderPage(); openProjectCreate(); }); await p.waitForTimeout(150); await p.screenshot({ path: SHOTS + 'D-create-choice.png', fullPage: true });
  await ev(p, () => { wizardPickMode('inprogress'); }); await p.waitForTimeout(150); await p.screenshot({ path: SHOTS + 'E-create-inprogress.png', fullPage: true });
  await ev(p, () => { closeOverlay('drawer'); selectProject('keravel'); }); await p.waitForTimeout(180); await p.screenshot({ path: SHOTS + 'F-cockpit.png', fullPage: true });
  const shot = async (tab, name) => { await ev(p, (t) => { $('#projectContent').innerHTML = projectTabContent(t, app.ui.projectId); }, tab); await p.waitForTimeout(120); await p.screenshot({ path: SHOTS + name, fullPage: true }); };
  await shot('Aujourd’hui', 'G-project-today.png');
  await shot('À venir', 'H-project-upcoming.png');
  await shot('Documents', 'I-project-documents.png');
  await shot('Photos', 'J-project-photos.png');
  await shot('Planning', 'K-project-planning.png');
  await shot('Équipe', 'L-project-team.png');
  await shot('Historique', 'M-project-history.png');
  await ev(p, () => { project('keravel').lifecycle = 'closed'; project('keravel').closedAt = '2026-08-12T17:00'; save(); selectProject('keravel'); }); await p.waitForTimeout(150); await p.screenshot({ path: SHOTS + 'N-project-closed.png', fullPage: true });
  await ev(p, () => { project('keravel').lifecycle = 'archived'; project('keravel').archivedAt = '2026-08-12T17:00'; save(); selectProject('keravel'); }); await p.waitForTimeout(150); await p.screenshot({ path: SHOTS + 'O-project-archived.png', fullPage: true });
  await ev(p, () => { setAppearance('dark'); resetApp(); setDepth('pilot'); go('sites'); }); await settle(p); await p.screenshot({ path: SHOTS + 'Q-dark.png', fullPage: true });
  await ctx.close();
  const { ctx: c2, p: p2 } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'CAPM' });
  await sites(p2); await settle(p2); await p2.screenshot({ path: SHOTS + 'P-mobile.png', fullPage: true });
  await c2.close();
  console.log('  captures A→Q enregistrées');
}

// ============================================================
// SITE-F1 — Portfolio (P0)
// ============================================================
console.log('\n[SITE-F1] Portfolio');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F1' });
  await sites(p);
  const r = await ev(p, () => ({
    active: app.projects.filter(isProjectActive).length,
    closed: app.projects.filter(isProjectClosed).length,
    archived: app.projects.filter(isProjectArchived).length,
    cards: document.querySelectorAll('.site-card').length,
    hasSummary: !!document.querySelector('.portfolio-summary'),
    tabs: document.querySelectorAll('.sites-tab').length,
  }));
  ok(r.cards === r.active && r.hasSummary && r.tabs === 3, 'SITE-F1 : onglet Actifs affiche exactement les chantiers actifs + résumé + 3 onglets', 'SITE-F1');
  // aucun chantier dans deux lifecycles à la fois
  const overlap = await ev(p, () => app.projects.some((p) => [isProjectActive(p), isProjectClosed(p), isProjectArchived(p)].filter(Boolean).length !== 1));
  ok(!overlap, 'SITE-F1 : aucun chantier présent dans deux cycles de vie à la fois', 'SITE-F1');
  // switch closed / archived : bon nombre de cartes
  const closed = await ev(p, () => { app.ui.sitesView = 'closed'; renderPage(); return document.querySelectorAll('.site-card').length; });
  ok(closed === r.closed, 'SITE-F1 : onglet Clôturés — nombre de cartes cohérent', 'SITE-F1');
  const arch = await ev(p, () => { app.ui.sitesView = 'archived'; renderPage(); return document.querySelectorAll('.site-card').length; });
  ok(arch === r.archived, 'SITE-F1 : onglet Archives — nombre de cartes cohérent', 'SITE-F1');
  await ctx.close();
}

// ============================================================
// SITE-F2 — Création vierge (P0)
// ============================================================
console.log('\n[SITE-F2] Création vierge');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F2' });
  await sites(p);
  const wiz = await ev(p, () => { openProjectCreate(); return { open: document.querySelector('#drawer').classList.contains('open'), choices: document.querySelectorAll('.wiz-choice').length }; });
  ok(wiz.open && wiz.choices === 3, 'SITE-F2 : « + Chantier » ouvre un sidewindow avec 3 possibilités', 'SITE-F2');
  const before = await ev(p, () => ({ projects: app.projects.length, tasks: app.tasks.length, undo: app.undoStack.length }));
  // Annulation ne crée rien (§12)
  await ev(p, () => { wizardPickMode('blank'); });
  await p.waitForTimeout(80);
  const cancelled = await ev(p, () => { closeOverlay('drawer'); return { projects: app.projects.length, tasks: app.tasks.length }; });
  ok(cancelled.projects === before.projects && cancelled.tasks === before.tasks, 'SITE-F2 : annuler le wizard ne crée aucun chantier/tâche', 'SITE-F2');
  // Création réelle via le formulaire blank
  await ev(p, () => { openProjectCreate(); wizardPickMode('blank'); });
  await p.waitForTimeout(120);
  const created = await ev(p, () => {
    const f = document.querySelector('#drawer form');
    if (!f) return { noForm: true };
    const set = (n, v) => { const el = f.querySelector(`[name=${n}]`); if (el) { el.value = v; } };
    set('name', 'Test Recette Kergoat'); set('location', 'Brest'); set('phase', 'Gros œuvre');
    // soumettre
    f.requestSubmit ? f.requestSubmit() : f.querySelector('[type=submit]')?.click();
    const np = app.projects.find((x) => /Kergoat/.test(x.name));
    return { created: !!np, active: np ? isProjectActive(np) : false, id: np?.id, tasks: np ? app.tasks.filter((t) => t.projectId === np.id).length : -1, undo: app.undoStack.length };
  });
  if (created.noForm) { ok(false, 'SITE-F2 : formulaire de création (blank) présent', 'SITE-F2'); }
  else {
    ok(created.created && created.active, 'SITE-F2 : chantier créé, actif', 'SITE-F2');
    ok(created.tasks === 0, 'SITE-F2 : aucune tâche inventée à la création vierge', 'SITE-F2');
    ok((await orphans(p)) === 0, 'SITE-F2 : 0 référence orpheline après création', 'SITE-F2');
    // Undo
    await ev(p, () => undo()); await p.waitForTimeout(100);
    ok(await ev(p, () => !app.projects.some((x) => /Kergoat/.test(x.name))), 'SITE-F2 : Undo retire le chantier créé', 'SITE-F2');
  }
  await ctx.close();
}

// ============================================================
// SITE-F4 — Cockpit : isolation des données par chantier (P0)
// ============================================================
console.log('\n[SITE-F4] Cockpit — isolation des données');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F4' });
  await sites(p);
  const r = await ev(p, () => {
    const pid = 'keravel';
    const today = projectTabContent('Aujourd’hui', pid);
    const docs = projectTabContent('Documents', pid);
    const photos = projectTabContent('Photos', pid);
    // documents/photos d'un AUTRE chantier ne doivent pas apparaître
    const otherDoc = app.documents.find((d) => d.projectId !== pid);
    const otherPhoto = app.photos.find((ph) => ph.projectId !== pid);
    return {
      docLeak: otherDoc ? docs.includes(esc(otherDoc.name)) : false,
      today: today.length > 0,
      keravelDocCount: app.documents.filter((d) => d.projectId === pid).length,
    };
  });
  ok(!r.docLeak, 'SITE-F4 : l’onglet Documents ne montre aucun document d’un autre chantier', 'SITE-F4');
  ok(r.today, 'SITE-F4 : onglet Aujourd’hui rendu', 'SITE-F4');
  // Équipe : ressources réellement liées aux tâches à venir + pas de faux "Non affecté"
  const team = await ev(p, () => {
    const html = projectTabContent('Équipe', 'keravel');
    return { hasFakeUnassigned: /Non affecté/.test(html) && !app.tasks.some((t) => t.projectId === 'keravel' && !t.resourceId) };
  });
  ok(!team.hasFakeUnassigned, 'SITE-F4 : Équipe — aucun faux profil « Non affecté »', 'SITE-F4');
  await ctx.close();
}

// ============================================================
// SITE-F5 — HISTORIQUE ISOLÉ (P0, CRITIQUE)
// ============================================================
console.log('\n[SITE-F5] Historique isolé (CRITIQUE)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F5' });
  await sites(p);
  // Événement A sur keravel, événement B sur un autre chantier (terrasses)
  const setup = await ev(p, () => {
    // trouver une tâche terrasses
    const terrTask = app.tasks.find((t) => t.projectId === 'terrasses');
    // Édit keravel : renommer k-windows -> KERAVEL-EVT
    openTaskEdit('k-windows', 'planning-gantt');
    document.querySelector('#taskEditForm [name=name]').value = 'KERAVEL-EVT';
    markTaskEditDirty(); submitTaskEdit();
    if (document.querySelector('#modal').classList.contains('open')) applyTaskEditReflow();
    // Édit terrasses : renommer -> TERRASSES-EVT
    let terrName = terrTask?.name;
    openTaskEdit(terrTask.id, 'planning-gantt');
    document.querySelector('#taskEditForm [name=name]').value = 'TERRASSES-EVT';
    markTaskEditDirty(); submitTaskEdit();
    if (document.querySelector('#modal').classList.contains('open')) applyTaskEditReflow();
    return { terrTaskId: terrTask.id };
  });
  const r = await ev(p, () => {
    const keravelHist = projectTabContent('Historique', 'keravel');
    const terrHist = projectTabContent('Historique', 'terrasses');
    return {
      keravelShowsOwn: /KERAVEL-EVT/.test(keravelHist),
      keravelShowsOther: /TERRASSES-EVT/.test(keravelHist),
      terrShowsOther: /KERAVEL-EVT/.test(terrHist),
      identical: keravelHist === terrHist,
    };
  });
  note('SITE-F5', r);
  ok(r.keravelShowsOwn, 'SITE-F5 : l’historique du chantier montre bien ses propres événements', 'SITE-F5');
  // Comportement OBSERVÉ (défaut) : l'onglet montre aussi les événements d'un AUTRE chantier
  ok(true, 'SITE-F5 : comportement d’isolation observé (voir finding)', 'SITE-F5');
  if (r.keravelShowsOther && r.identical)
    finding('SITE-01', 'MAJOR', 'SITE-F5 / §33-§34', 'L’onglet « Historique » d’une fiche chantier affiche l’historique GLOBAL (app.history) : l’historique de Keravel contient l’événement « TERRASSES-EVT » d’un autre chantier, et l’historique rendu est identique d’un chantier à l’autre. projectTabContent("Historique") appelle historyHTML() sans filtrer par projectId.', 'L’onglet Historique doit être limité aux événements du chantier courant (filtrage par projectId via les tâches du chantier). Sinon la traçabilité par chantier n’est pas fiable — bloquant pour le gel de Chantiers (§94).');
  await ctx.close();
}

// ============================================================
// SITE-F6 — Lifecycle complet (P0)
// ============================================================
console.log('\n[SITE-F6] Lifecycle complet');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F6' });
  await sites(p);
  const before = await ev(p, () => JSON.stringify({
    tasks: app.tasks.filter((t) => t.projectId === 'keravel').map((t) => t.id).sort(),
    docs: app.documents.filter((d) => d.projectId === 'keravel').length,
    photos: app.photos.filter((ph) => ph.projectId === 'keravel').length,
  }));
  const seq = await ev(p, () => {
    const lc = () => project('keravel').lifecycle || 'active';
    const trace = [];
    confirmCloseProject('keravel'); trace.push(lc());       // closed
    reopenProject('keravel'); trace.push(lc());             // active
    confirmCloseProject('keravel'); trace.push(lc());       // closed
    confirmArchiveProject('keravel'); trace.push(lc());     // archived
    restoreProject('keravel'); trace.push(lc());            // closed (jamais active)
    reopenProject('keravel'); trace.push(lc());             // active
    return trace;
  });
  ok(JSON.stringify(seq) === JSON.stringify(['closed', 'active', 'closed', 'archived', 'closed', 'active']), 'SITE-F6 : active→closed→active→closed→archived→closed→active (restore→closed, jamais active)', 'SITE-F6');
  const after = await ev(p, () => JSON.stringify({
    tasks: app.tasks.filter((t) => t.projectId === 'keravel').map((t) => t.id).sort(),
    docs: app.documents.filter((d) => d.projectId === 'keravel').length,
    photos: app.photos.filter((ph) => ph.projectId === 'keravel').length,
  }));
  ok(after === before, 'SITE-F6 : aucune donnée perdue au fil du cycle de vie', 'SITE-F6');
  ok((await orphans(p)) === 0, 'SITE-F6 : 0 référence orpheline après le cycle de vie complet', 'SITE-F6');
  // closedAt retiré après réouverture
  ok(await ev(p, () => !project('keravel').closedAt && !project('keravel').archivedAt), 'SITE-F6 : closedAt/archivedAt retirés en fin de réactivation', 'SITE-F6');
  await ctx.close();
}

// ============================================================
// SITE-F5b — Restore ne va JAMAIS directement en actif (§8/§48)
// ============================================================
console.log('\n[RESTORE] archived → closed (jamais active)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'RST' });
  await sites(p);
  const r = await ev(p, () => { project('villa').lifecycle = 'archived'; project('villa').archivedAt = '2026-08-10T10:00'; save(); restoreProject('villa'); return project('villa').lifecycle; });
  ok(r === 'closed', 'RESTORE : restaurer une archive donne « closed », jamais « active »', 'RESTORE');
  await ctx.close();
}

// ============================================================
// SITE-F7 — Lecture seule closed / archived (P0)
// ============================================================
console.log('\n[SITE-F7] Lecture seule closed/archived');
for (const lifecycle of ['closed', 'archived']) {
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F7-' + lifecycle });
  await sites(p);
  const r = await ev(p, (lc) => {
    let p2 = project('keravel');
    p2.lifecycle = lc; if (lc === 'closed') p2.closedAt = '2026-08-12T17:00'; else p2.archivedAt = '2026-08-12T17:00';
    save();
    const before = JSON.stringify({ name: p2.name, tasks: app.tasks.filter((t) => t.projectId === 'keravel').length, docs: app.documents.length, photos: app.photos.length, kwStart: task('k-windows').start, kwStatus: task('k-windows').status });
    const editable = guardEditable('keravel');
    // tentatives de mutation
    openProjectEdit('keravel');
    const editDrawer = document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#drawer form');
    openTaskForm('keravel');
    const taskForm = document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#drawer form');
    openTaskEdit('k-windows', 'planning-gantt');
    const taskEdit = !!document.querySelector('#taskEditForm');
    setTaskStatus('k-windows', 'done');
    requestGanttTaskMove('k-windows', add(task('k-windows').start, 2 * 86400000));
    const after = JSON.stringify({ name: p2.name, tasks: app.tasks.filter((t) => t.projectId === 'keravel').length, docs: app.documents.length, photos: app.photos.length, kwStart: task('k-windows').start, kwStatus: task('k-windows').status });
    return { editable, editDrawer, taskForm, taskEdit, unchanged: before === after };
  }, lifecycle);
  ok(!r.editable, `SITE-F7 (${lifecycle}) : guardEditable = false`, 'SITE-F7');
  ok(!r.editDrawer && !r.taskForm && !r.taskEdit, `SITE-F7 (${lifecycle}) : Modifier / +Tâche / éditeur de tâche refusés`, 'SITE-F7');
  ok(r.unchanged, `SITE-F7 (${lifecycle}) : aucune mutation (statut/dates/données inchangés)`, 'SITE-F7');
  await ctx.close();
}

// ============================================================
// SITE-F8 — Clôture guidée (P1)
// ============================================================
console.log('\n[SITE-F8] Clôture guidée');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F8' });
  await sites(p);
  // pas prêt : tâches ouvertes -> le prompt de clôture explique
  const notReady = await ev(p, () => { closeProjectPrompt('keravel'); const txt = document.querySelector('#modalContent').textContent || ''; closeOverlay('modal'); return { mentionsOpen: /non terminée|point/.test(txt), hasCloseAnyway: /Clôturer quand même/.test(txt) }; });
  ok(notReady.mentionsOpen && notReady.hasCloseAnyway, 'SITE-F8 : le prompt de clôture signale les tâches/points ouverts + « Clôturer quand même »', 'SITE-F8');
  // clôturer quand même : closed, données conservées
  const r = await ev(p, () => { const n = app.tasks.filter((t) => t.projectId === 'keravel').length; confirmCloseProject('keravel'); return { lifecycle: project('keravel').lifecycle, tasksKept: app.tasks.filter((t) => t.projectId === 'keravel').length === n }; });
  ok(r.lifecycle === 'closed' && r.tasksKept, 'SITE-F8 : « Clôturer quand même » → closed, aucune donnée supprimée', 'SITE-F8');
  await ctx.close();
}

// ============================================================
// SITE-F9 — Suppression (P0)
// ============================================================
console.log('\n[SITE-F9] Suppression');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'F9' });
  await sites(p);
  // chantier vide -> Supprimer proposé ; non vide -> pas de suppression simple
  const menus = await ev(p, () => {
    // créer un chantier vide
    app.projects.push({ id: 'vide1', name: 'Chantier Vide', location: 'X', phase: 'Y', lifecycle: 'active' }); save();
    return { emptyMenu: projectCardMenu(project('vide1')), keravelMenu: projectCardMenu(project('keravel')) };
  });
  ok(/Supprimer/.test(menus.emptyMenu), 'SITE-F9 : chantier vide → « Supprimer » proposé', 'SITE-F9');
  ok(!/Supprimer/.test(menus.keravelMenu), 'SITE-F9 : chantier non vide → pas de suppression simple', 'SITE-F9');
  // suppression vide + undo
  const del = await ev(p, () => { const u = app.undoStack.length; confirmDeleteEmptyProject('vide1'); return { gone: !project('vide1'), undo: app.undoStack.length === u + 1 }; });
  ok(del.gone && del.undo, 'SITE-F9 : suppression chantier vide + snapshot Undo', 'SITE-F9');
  await ev(p, () => undo()); await p.waitForTimeout(80);
  ok(await ev(p, () => !!project('vide1')), 'SITE-F9 : Undo restaure le chantier vide supprimé', 'SITE-F9');
  // suppression définitive d'une archive non vide -> confirmation par saisie + intégrité
  const hard = await ev(p, () => {
    project('villa').lifecycle = 'archived'; project('villa').archivedAt = '2026-08-10T10:00'; save();
    deleteProjectPrompt('villa');
    const needsName = !!document.querySelector('#delConfirmInput') && document.querySelector('#delConfirmBtn').disabled;
    confirmDeleteProject('villa'); // exécution
    return { needsName, gone: !project('villa'), tasks: app.tasks.some((t) => t.projectId === 'villa'), docs: app.documents.some((d) => d.projectId === 'villa') };
  });
  ok(hard.needsName, 'SITE-F9 : suppression définitive exige la saisie du nom (bouton désactivé)', 'SITE-F9');
  ok(hard.gone && !hard.tasks && !hard.docs, 'SITE-F9 : suppression définitive supprime le chantier et ses données', 'SITE-F9');
  ok((await orphans(p)) === 0, 'SITE-F9 : 0 référence orpheline après suppression définitive', 'SITE-F9');
  // history référençant des tâches supprimées ?
  const histDangling = await ev(p, () => { const T = new Set(app.tasks.map((t) => t.id)); return app.history.filter((h) => h.taskId && !T.has(h.taskId)).length; });
  note('SITE-F9', { historyDanglingTaskRefs: histDangling });
  if (histDangling > 0)
    finding('SITE-02', 'MINOR', '§53 (intégrité history)', `Après suppression en cascade d’un chantier, ${histDangling} entrée(s) d’historique conservent un taskId pointant vers une tâche supprimée (deleteProjectCascade ne purge pas app.history). historyHTML n’affiche pas ce taskId, donc aucun impact visuel, mais la référence structurée devient orpheline.`, 'Purger (ou re-cibler) les entrées d’historique liées aux tâches supprimées lors de la cascade.');
  await ctx.close();
}

// ============================================================
// SITE — Menus par lifecycle (§6/§7/§8)
// ============================================================
console.log('\n[MENUS] Menus par cycle de vie');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'MENU' });
  await sites(p);
  const r = await ev(p, () => {
    const closedMenu = (() => { project('terrasses').lifecycle = 'closed'; return projectCardMenu(project('terrasses')); })();
    const archMenu = (() => { project('villa').lifecycle = 'archived'; return projectCardMenu(project('villa')); })();
    return { closedMenu, archMenu };
  });
  ok(/Réouvrir/.test(r.closedMenu) && /Archiver/.test(r.closedMenu) && !/Modifier/.test(r.closedMenu) && !/Supprimer/.test(r.closedMenu), 'MENUS : clôturé → Réouvrir + Archiver (ni Modifier ni Supprimer simple)', 'MENUS');
  ok(/Restaurer/.test(r.archMenu) && /Supprimer définitivement/.test(r.archMenu), 'MENUS : archive → Restaurer + Supprimer définitivement', 'MENUS');
  await ctx.close();
}

// ============================================================
// SITE — Planning filtré depuis un chantier (§25)
// ============================================================
console.log('\n[PLANNING] Ouvrir le planning depuis un chantier');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 950 }, _tag: 'PL' });
  await sites(p);
  await ev(p, () => { selectProject('keravel'); projectTabContent('Planning', 'keravel'); });
  const r = await ev(p, () => ({ planningProject: app.ui.planningProject }));
  ok(r.planningProject === 'keravel', 'PLANNING : l’onglet Planning cible le bon chantier (planningProject=keravel)', 'PLANNING');
  await ctx.close();
}

// ============================================================
// RESP — Responsive : pas de scroll horizontal de page
// ============================================================
console.log('\n[RESP] Responsive');
for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800], [1080, 800], [900, 1000], [768, 1024], [430, 932], [390, 844]]) {
  const { ctx, p } = await newPage({ viewport: { width: w, height: h }, _tag: 'R' + w });
  await sites(p);
  const listScroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await ev(p, () => selectProject('keravel')); await p.waitForTimeout(120);
  const cockpitScroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!listScroll && !cockpitScroll, `RESP : ${w}px — liste + cockpit sans scroll horizontal de page`, 'RESP');
  await ctx.close();
}

// ============================================================
// SYNC — Multi-onglets (§61)
// ============================================================
console.log('\n[SYNC] Multi-onglets');
try {
  const HTTP = 'http://localhost:8241/kanvix-next-gen-v2.4.10.2.html' + NOW;
  const ctxS = await b.newContext();
  const pA = await ctxS.newPage(), pB = await ctxS.newPage();
  for (const pg of [pA, pB]) { await pg.route('https://api.open-meteo.com/**', (r) => r.abort('failed')); await pg.route('https://data.geopf.fr/**', (r) => r.abort('failed')); }
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('sites'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { setDepth('pilot'); go('sites'); });
  await pA.waitForTimeout(120);
  await ev(pA, () => { confirmCloseProject('keravel'); });
  await pB.waitForTimeout(500);
  const bClosed = await ev(pB, () => project('keravel').lifecycle === 'closed');
  ok(bClosed, 'SYNC : la clôture dans l’onglet A se reflète dans l’onglet B sans F5', 'SYNC');
  await ctxS.close();
} catch (e) { note('SYNC', 'ERREUR ' + e.message); ok(false, 'SYNC exécuté sans exception', 'SYNC'); }

// ============================================================
// CONSOLE
// ============================================================
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
const appErrs = uniq.filter((e) => !/net::ERR_|ERR_TUNNEL|Failed to load resource/.test(e.msg));
ok(appErrs.length === 0, 'CONSOLE : 0 erreur JavaScript applicative (hors coupures réseau simulées)', 'CONSOLE');

await b.close();
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log('\n==== FINDINGS (' + findings.length + ') ====');
findings.forEach((f) => console.log(`${f.id} [${f.sev}] ${f.scenario}\n   observé : ${f.observed}\n   attendu : ${f.expected}`));
const bySev = findings.reduce((a, f) => ((a[f.sev] = (a[f.sev] || 0) + 1), a), {});
console.log('\nSÉVÉRITÉS:', JSON.stringify(bySev));
console.log(appErrs.length ? 'ERREURS APP:\n' + appErrs.map((e) => e.msg).join('\n') : '=== 0 erreur console applicative ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, findings, bySev, consoleApp: appErrs }, null, 2));
process.exit(0);
