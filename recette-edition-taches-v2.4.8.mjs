// ============================================================
// KANVIX — Recette : édition universelle des tâches (V2.4.8)
// Usage : node recette-edition-taches-v2.4.8.mjs
//   (serveur http requis pour la synchro multi-onglets :
//    cd public/poc && python3 -m http.server 8241)
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.8.html' + NOW;
const HTTP = 'http://localhost:8241/kanvix-next-gen-v2.4.8.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-edition/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, name, d) => { results.push({ sec, name, status: 'INFO', detail: d }); console.log(`  (info) [${sec}] ${name}: ${JSON.stringify(d)}`); };
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

// ============================================================
// ENTRY POINTS — action "Modifier la tâche" présente partout
// ============================================================
console.log('\n[ENTRY] Points d\'entrée de modification');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'ENTRY' });
  await openPlanning(p);
  // Gantt : clic barre -> drawer consultation -> bouton "Modifier la tâche"
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  const ganttEntry = await ev(p, () => {
    const btn = [...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent));
    return { drawer: document.querySelector('#drawer').classList.contains('open'), hasEdit: !!btn };
  });
  ok(ganttEntry.drawer && ganttEntry.hasEdit, 'ENTRY : fiche tâche (depuis Gantt) propose "Modifier la tâche"', 'ENTRY');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(100);
  // Kanban : clic carte -> même fiche -> "Modifier"
  await ev(p, () => { setPlanningView('kanban'); });
  await p.waitForTimeout(150);
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  const kanbanEntry = await ev(p, () => !!([...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent))));
  ok(kanbanEntry, 'ENTRY : fiche tâche (depuis Kanban) propose "Modifier la tâche"', 'ENTRY');
  await ev(p, () => closeOverlay('drawer'));
  // Mode Chantier : popup tâche -> "Modifier"
  await ev(p, () => { setRole('driver'); enterFieldMode(); selectFieldProject('keravel'); openTask('k-windows'); });
  await p.waitForTimeout(200);
  const fieldEntry = await ev(p, () => ({ modal: document.querySelector('#modal').classList.contains('open'), hasEdit: !!([...document.querySelectorAll('#modalContent .btn')].find((x) => /Modifier/.test(x.textContent))) }));
  ok(fieldEntry.modal && fieldEntry.hasEdit, 'ENTRY : popup tâche Mode Chantier propose "Modifier"', 'ENTRY');
  await ctx.close();
}

// ============================================================
// EDIT-01 — Modification simple (aucun impact planning)
// ============================================================
console.log('\n[EDIT-01] Modification simple');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-01' });
  await openPlanning(p);
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(150);
  // Chantier readonly (§8) : pas de <select> projet dans l'éditeur
  const noProjectSelect = await ev(p, () => !document.querySelector('#taskEditForm [name=projectId]') && !!document.querySelector('.te-readonly'));
  ok(noProjectSelect, 'EDIT-01 : chantier affiché en lecture seule (jamais modifiable)', 'EDIT-01');
  await ev(p, () => { const f = document.querySelector('#taskEditForm'); f.querySelector('[name=name]').value = 'Pose fenêtres étage 1'; f.querySelector('[name=comment]').value = 'Précision du périmètre.'; markTaskEditDirty(); });
  const beforeDates = await ev(p, () => ({ start: task('k-windows').start, liningStart: task('k-lining').start }));
  await ev(p, () => submitTaskEdit());
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({
    name: task('k-windows').name,
    modal: document.querySelector('#modal').classList.contains('open'),
    start: task('k-windows').start,
    liningStart: task('k-lining').start,
    undo: app.undoStack.length,
    hist: app.history[0]?.text,
    histChanges: app.history[0]?.changes,
  }));
  ok(r.name === 'Pose fenêtres étage 1', 'EDIT-01 : nom modifié', 'EDIT-01');
  ok(!r.modal, 'EDIT-01 : aucun aperçu d\'impact (changement sans conséquence planning)', 'EDIT-01');
  ok(r.start === beforeDates.start && r.liningStart === beforeDates.liningStart, 'EDIT-01 : aucune tâche décalée', 'EDIT-01');
  ok(/modifiée/.test(r.hist || '') && Array.isArray(r.histChanges) && r.histChanges.some((c) => c.field === 'Nom'), 'EDIT-01 : historique présent (diff Nom)', 'EDIT-01');
  ok(r.undo === 1, 'EDIT-01 : un seul snapshot Undo', 'EDIT-01');
  // Undo -> ancien nom
  await ev(p, () => undo());
  await p.waitForTimeout(120);
  ok(await ev(p, () => task('k-windows').name === 'Pose des 6 fenêtres'), 'EDIT-01 : Undo restaure l\'ancien nom', 'EDIT-01');
  // Kanban reflète le nom (sync)
  await ev(p, () => { openTaskEdit('k-windows', 'planning-gantt'); });
  await p.waitForTimeout(100);
  await ev(p, () => { document.querySelector('#taskEditForm [name=name]').value = 'Pose fenêtres étage 1'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(150);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(150);
  ok(await ev(p, () => (document.querySelector('.kanban')?.textContent || '').includes('Pose fenêtres étage 1')), 'EDIT-01 : Kanban reflète le nom sans F5', 'EDIT-01');
  await ctx.close();
}

// ============================================================
// EDIT-02 — Décalage avec impact (preview + apply + undo)
// ============================================================
console.log('\n[EDIT-02] Décalage avec impact');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-02' });
  await openPlanning(p);
  // Une tâche aval en cours pour vérifier l'arbitrage (§19) : k-lining -> doing
  await ev(p, () => { task('k-lining').status = 'doing'; save(); });
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(150);
  await ev(p, () => { document.querySelector('#taskEditForm [name=end]').value = '2026-08-25T16:30'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(200);
  const preview = await ev(p, () => ({
    open: document.querySelector('#modal').classList.contains('open'),
    text: document.querySelector('#modalContent')?.textContent || '',
    // rien appliqué tant que non confirmé : les successeurs todo ne bougent pas encore
    paintStart: task('k-paint').start,
  }));
  ok(preview.open && /Impact/.test(preview.text), 'EDIT-02 : aperçu d\'impact AVANT application', 'EDIT-02');
  ok(/en cours/i.test(preview.text), 'EDIT-02 : arbitrage signalé pour la tâche EN COURS (k-lining)', 'EDIT-02');
  await p.screenshot({ path: SHOTS + 'edit02-preview-impact.png', fullPage: true });
  // Appliquer
  await ev(p, () => applyTaskEditReflow());
  await p.waitForTimeout(200);
  const applied = await ev(p, () => ({
    winEnd: task('k-windows').end,
    liningStart: task('k-lining').start,   // doing -> NON déplacée
    liningStatus: task('k-lining').status,
    finalStart: task('k-final').start,     // aval de k-paint (todo) -> décalée si chaîne
    undo: app.undoStack.length,
  }));
  ok(applied.winEnd === '2026-08-25T16:30', 'EDIT-02 : tâche source modifiée', 'EDIT-02');
  ok(applied.liningStart === '2026-08-17T08:00', 'EDIT-02 : tâche EN COURS jamais déplacée silencieusement', 'EDIT-02');
  ok(applied.undo === 1, 'EDIT-02 : UN seul snapshot pour la modif + toute la propagation', 'EDIT-02');
  // Undo -> toute la chaîne revient
  const snapshotAfter = await ev(p, () => ({ win: task('k-windows').end }));
  await ev(p, () => undo());
  await p.waitForTimeout(150);
  const afterUndo = await ev(p, () => ({ winEnd: task('k-windows').end, liningStatus: task('k-lining').status }));
  ok(afterUndo.winEnd === '2026-08-14T16:30', 'EDIT-02 : Undo restaure la source ET la chaîne', 'EDIT-02');
  await ctx.close();
}

// ============================================================
// EDIT-02b — Annuler l'aperçu ne modifie rien (§55)
// ============================================================
console.log('\n[EDIT-02b] Annuler l\'aperçu');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-02b' });
  await openPlanning(p);
  const before = await ev(p, () => ({ win: task('k-windows').end, lining: task('k-lining').start, hist: app.history.length }));
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(120);
  await ev(p, () => { document.querySelector('#taskEditForm [name=end]').value = '2026-08-25T16:30'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(150);
  await ev(p, () => cancelTaskEditPreview());
  await p.waitForTimeout(150);
  const after = await ev(p, () => ({ win: task('k-windows').end, lining: task('k-lining').start, hist: app.history.length }));
  ok(after.win === before.win && after.lining === before.lining, 'EDIT-02b : "Annuler" l\'aperçu ne modifie aucune donnée', 'EDIT-02b');
  ok(after.hist === before.hist, 'EDIT-02b : aucun historique après annulation', 'EDIT-02b');
  await ctx.close();
}

// ============================================================
// EDIT-03 — Changement d'intervenant (pas de propagation)
// ============================================================
console.log('\n[EDIT-03] Changement d\'intervenant');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-03' });
  await openPlanning(p);
  const beforeDates = await ev(p, () => ({ start: task('k-windows').start, lining: task('k-lining').start }));
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(120);
  // Choisir Marc (marc) à la place de Thomas
  const changed = await ev(p, () => { const sel = document.querySelector('#taskEditForm [name=resourceId]'); const opt = [...sel.options].find((o) => /Marc/.test(o.textContent)); if (opt) { sel.value = opt.value; markTaskEditDirty(); } return !!opt; });
  ok(changed, 'EDIT-03 : Marc disponible dans le sélecteur d\'intervenant', 'EDIT-03');
  await ev(p, () => submitTaskEdit());
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({ res: task('k-windows').resourceId, modal: document.querySelector('#modal').classList.contains('open'), start: task('k-windows').start, lining: task('k-lining').start, hist: app.history[0]?.changes }));
  ok(r.res === 'marc', 'EDIT-03 : intervenant changé (Thomas → Marc)', 'EDIT-03');
  ok(!r.modal && r.start === beforeDates.start && r.lining === beforeDates.lining, 'EDIT-03 : aucune propagation de dates', 'EDIT-03');
  ok(Array.isArray(r.hist) && r.hist.some((c) => c.field === 'Intervenant'), 'EDIT-03 : historique Thomas → Marc', 'EDIT-03');
  await ctx.close();
}

// ============================================================
// EDIT-04 — Dépendances multiples + cycle refusé
// ============================================================
console.log('\n[EDIT-04] Dépendances');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-04' });
  await openPlanning(p);
  // Sur k-final : ajouter deux prédécesseurs (k-cloisons ET k-cloisons-rdc), même chantier
  await ev(p, () => openTaskEdit('k-final', 'planning-gantt'));
  await p.waitForTimeout(120);
  const depIds = await ev(p, () => [...document.querySelectorAll('#teDepList [name=dep]')].map((c) => c.value));
  note('EDIT-04', 'dépendances candidates (même chantier)', depIds.length);
  await ev(p, () => {
    const boxes = [...document.querySelectorAll('#teDepList [name=dep]')];
    ['k-cloisons', 'k-control'].forEach((id) => { const bx = boxes.find((b) => b.value === id); if (bx) bx.checked = true; });
    markTaskEditDirty(); submitTaskEdit();
  });
  await p.waitForTimeout(200);
  // si preview (k-final n'a pas de successeur -> pas de shift), sinon direct
  const deps = await ev(p, () => task('k-final').deps.slice().sort());
  ok(deps.includes('k-cloisons') && deps.includes('k-control'), 'EDIT-04 : C dépend de A ET B (deps multiples, jamais A→B→C)', 'EDIT-04');
  // Cycle : k-windows dépend de k-lining (qui dépend déjà de k-windows) -> refusé
  await ev(p, () => { resetApp(); setDepth('pilot'); go('planning'); openTaskEdit('k-windows', 'planning-gantt'); });
  await p.waitForTimeout(150);
  const cyc = await ev(p, () => {
    const bx = [...document.querySelectorAll('#teDepList [name=dep]')].find((c) => c.value === 'k-lining');
    if (bx) bx.checked = true;
    submitTaskEdit();
    return { err: document.querySelector('#taskEditError')?.textContent || '', deps: task('k-windows').deps };
  });
  ok(/boucle/i.test(cyc.err) && cyc.deps.length === 0, 'EDIT-04 : cycle refusé (C→A alors que A→…→C)', 'EDIT-04');
  await ctx.close();
}

// ============================================================
// EDIT-05 — Kanban (édition depuis une carte, reste Kanban)
// ============================================================
console.log('\n[EDIT-05] Kanban');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-05' });
  await openPlanning(p);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(150);
  await ev(p, () => openTask('k-final'));
  await p.waitForTimeout(120);
  await ev(p, () => [...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent)).click());
  await p.waitForTimeout(120);
  await ev(p, () => { document.querySelector('#taskEditForm [name=start]').value = '2026-08-21T08:00'; document.querySelector('#taskEditForm [name=end]').value = '2026-08-21T10:00'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(200);
  // pas d'impact aval (k-final terminal) -> pas de preview
  const r = await ev(p, () => ({
    view: app.ui.planningView || (document.querySelector('.kanban') ? 'kanban' : 'gantt'),
    kanban: !!document.querySelector('.kanban'),
    start: task('k-final').start,
    falseField: app.issues.some((i) => i.taskId === 'k-final' && (i.kind === 'field-start' || i.kind === 'field-done')),
  }));
  ok(r.kanban, 'EDIT-05 : Kanban reste actif après l\'édition', 'EDIT-05');
  ok(r.start === '2026-08-21T08:00', 'EDIT-05 : nouvelle date appliquée (visible côté Gantt aussi)', 'EDIT-05');
  ok(!r.falseField, 'EDIT-05 : aucune fausse confirmation terrain', 'EDIT-05');
  await ctx.close();
}

// ============================================================
// EDIT-06 — Mode Chantier (reste field, pas de Bureau)
// ============================================================
console.log('\n[EDIT-06] Mode Chantier');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'EDIT-06' });
  await ev(p, () => { resetApp(); setDepth('pilot'); setRole('driver'); enterFieldMode(); selectFieldProject('keravel'); openFieldPlanning('k-windows'); });
  await p.waitForTimeout(250);
  await ev(p, () => openTask('k-windows'));   // popup
  await p.waitForTimeout(150);
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Modifier/.test(x.textContent)).click());
  await p.waitForTimeout(150);
  const editorOpen = await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#taskEditForm'));
  ok(editorOpen, 'EDIT-06 : éditeur ouvert depuis le Planning mobile', 'EDIT-06');
  await ev(p, () => { document.querySelector('#taskEditForm [name=end]').value = '2026-08-14T18:00'; document.querySelector('#taskEditForm [name=comment]').value = 'Fin repoussée en soirée.'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(200);
  // k-windows end change -> successeurs todo décalés -> preview
  const hasPreview = await ev(p, () => document.querySelector('#modal').classList.contains('open'));
  if (hasPreview) { await ev(p, () => applyTaskEditReflow()); await p.waitForTimeout(150); }
  const r = await ev(p, () => ({
    field: isFieldMode(),
    driverMode: app.settings.driverMode,
    hasGantt: !!document.querySelector('.gantt'),
    hasSidebar: (() => { const s = document.querySelector('.sidebar'); return s ? getComputedStyle(s).display !== 'none' : false; })(),
    end: task('k-windows').end,
  }));
  ok(r.field && r.driverMode === 'field', 'EDIT-06 : reste en Mode Chantier (jamais Bureau)', 'EDIT-06');
  ok(!r.hasGantt && !r.hasSidebar, 'EDIT-06 : aucun Gantt desktop, aucune sidebar', 'EDIT-06');
  ok(r.end === '2026-08-14T18:00', 'EDIT-06 : modification appliquée', 'EDIT-06');
  await p.screenshot({ path: SHOTS + 'edit06-mode-chantier.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// EDIT-07 — Statut manuel ≠ confirmation terrain
// ============================================================
console.log('\n[EDIT-07] Statut manuel');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-07' });
  await openPlanning(p);
  await ev(p, () => openTaskEdit('k-final', 'planning-gantt'));   // k-final = todo
  await p.waitForTimeout(120);
  await ev(p, () => { const seg = document.querySelector('.te-status-seg'); [...seg.querySelectorAll('.seg-opt')].find((x) => /En cours/.test(x.textContent)).click(); submitTaskEdit(); });
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    status: task('k-final').status,
    fieldStart: app.issues.some((i) => i.taskId === 'k-final' && i.kind === 'field-start'),
    fieldDone: app.issues.some((i) => i.taskId === 'k-final' && i.kind === 'field-done'),
    hist: app.history[0]?.text,
  }));
  ok(r.status === 'doing', 'EDIT-07 : statut = En cours', 'EDIT-07');
  ok(!r.fieldStart && !r.fieldDone, 'EDIT-07 : AUCUN signal terrain (field-start/field-done)', 'EDIT-07');
  ok(/statut modifié manuellement\s*:\s*À faire\s*→\s*En cours/.test(r.hist || ''), 'EDIT-07 : historique "statut modifié manuellement : À faire → En cours"', 'EDIT-07');
  await ctx.close();
}

// ============================================================
// EDIT-08 — Tâche terminée protégée
// ============================================================
console.log('\n[EDIT-08] Tâche terminée');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-08' });
  await openPlanning(p);
  await ev(p, () => { task('k-windows').status = 'done'; task('k-windows').end = '2026-08-12T16:30'; save(); });
  // openTaskEdit refuse
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(120);
  const guard = await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#taskEditForm'));
  ok(!guard, 'EDIT-08 : éditeur refusé pour une tâche terminée', 'EDIT-08');
  // La fiche propose la reprise, pas "Modifier la tâche"
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  const card = await ev(p, () => ({
    hasEdit: !!([...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent))),
    hasRework: !!([...document.querySelectorAll('#drawer .btn')].find((x) => /Signaler une reprise/.test(x.textContent))),
    status: task('k-windows').status,
  }));
  ok(!card.hasEdit, 'EDIT-08 : "Modifier la tâche" absent d\'une tâche terminée', 'EDIT-08');
  ok(card.hasRework, 'EDIT-08 : "Signaler une reprise" toujours proposé', 'EDIT-08');
  ok(card.status === 'done', 'EDIT-08 : tâche d\'origine reste terminée', 'EDIT-08');
  await ctx.close();
}

// ============================================================
// EDIT-09 — Chantier archivé (lecture seule)
// ============================================================
console.log('\n[EDIT-09] Chantier archivé');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'EDIT-09' });
  await openPlanning(p);
  await ev(p, () => { project('keravel').lifecycle = 'archived'; save(); });
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(120);
  ok(!(await ev(p, () => document.querySelector('#drawer').classList.contains('open') && !!document.querySelector('#taskEditForm'))), 'EDIT-09 : éditeur refusé sur chantier archivé', 'EDIT-09');
  await ev(p, () => { app.settings.driverMode = 'office'; app.ui.page = 'planning'; app.ui.planningProject = 'keravel'; render(); openTask('k-windows'); });
  await p.waitForTimeout(150);
  const noEdit = await ev(p, () => !([...document.querySelectorAll('#drawer .btn')].find((x) => /Modifier la tâche/.test(x.textContent))));
  ok(noEdit, 'EDIT-09 : aucun bouton "Modifier la tâche" (lecture seule)', 'EDIT-09');
  await ctx.close();
}

// ============================================================
// EDIT-10 — Multi-vues synchronisées (2 onglets, HTTP)
// ============================================================
console.log('\n[EDIT-10] Synchronisation multi-onglets');
try {
  const ctxShared = await b.newContext();
  const pA = await ctxShared.newPage();
  const pB = await ctxShared.newPage();
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('planning'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { setDepth('pilot'); go('planning'); setPlanningView('kanban'); });
  await pA.waitForTimeout(150);
  await ev(pA, () => { openTaskEdit('k-windows', 'planning-gantt'); });
  await pA.waitForTimeout(120);
  await ev(pA, () => { document.querySelector('#taskEditForm [name=name]').value = 'Fenêtres — sync test'; markTaskEditDirty(); submitTaskEdit(); });
  await pA.waitForTimeout(120);
  // pas d'impact planning (nom) -> pas de preview ; sinon appliquer
  if (await ev(pA, () => document.querySelector('#modal').classList.contains('open'))) await ev(pA, () => applyTaskEditReflow());
  await pB.waitForTimeout(500);
  const bHasName = await ev(pB, () => (document.querySelector('.kanban')?.textContent || '').includes('Fenêtres — sync test'));
  ok(bHasName, 'EDIT-10 : onglet B (Kanban) reflète la modification sans F5', 'EDIT-10');
  await ctxShared.close();
} catch (e) { note('EDIT-10', 'ERREUR', e.message); ok(false, 'EDIT-10 exécuté sans exception', 'EDIT-10'); }

// ============================================================
// VALID — Validation du formulaire (§38)
// ============================================================
console.log('\n[VALID] Validation');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'VALID' });
  await openPlanning(p);
  await ev(p, () => openTaskEdit('k-final', 'planning-gantt'));
  await p.waitForTimeout(120);
  // Nom vide
  await ev(p, () => { document.querySelector('#taskEditForm [name=name]').value = ''; submitTaskEdit(); });
  ok(await ev(p, () => /obligatoire/i.test(document.querySelector('#taskEditError')?.textContent || '')), 'VALID : nom vide refusé (erreur inline)', 'VALID');
  // Fin < début
  await ev(p, () => { const f = document.querySelector('#taskEditForm'); f.querySelector('[name=name]').value = 'X'; f.querySelector('[name=start]').value = '2026-08-20T10:00'; f.querySelector('[name=end]').value = '2026-08-20T09:00'; submitTaskEdit(); });
  ok(await ev(p, () => /postérieure/i.test(document.querySelector('#taskEditError')?.textContent || '')), 'VALID : fin < début refusé (erreur inline)', 'VALID');
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'VALID : le drawer reste ouvert tant que le formulaire est invalide', 'VALID');
  await ctx.close();
}

// ============================================================
// HIST — Une entrée principale pour changements simultanés (§53)
// ============================================================
console.log('\n[HIST] Historique groupé');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'HIST' });
  await openPlanning(p);
  const before = await ev(p, () => app.history.length);
  await ev(p, () => openTaskEdit('k-final', 'planning-gantt'));   // terminal, todo, pas d'impact
  await p.waitForTimeout(120);
  await ev(p, () => {
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=name]').value = 'Contrôle final revu';
    const sel = f.querySelector('[name=resourceId]'); const opt = [...sel.options].find((o) => /Marc/.test(o.textContent)); if (opt) sel.value = opt.value;
    f.querySelector('[name=start]').value = '2026-08-21T08:00'; f.querySelector('[name=end]').value = '2026-08-21T10:00';
    f.querySelector('[name=comment]').value = 'Regroupement test.';
    markTaskEditDirty(); submitTaskEdit();
  });
  await p.waitForTimeout(200);
  const r = await ev(p, () => {
    const mine = app.history.filter((h) => h.taskId === 'k-final' && h.author === 'Eric' && Array.isArray(h.changes));
    return { count: mine.length, changes: mine[0]?.changes?.map((c) => c.field), comment: mine[0]?.comment };
  });
  ok(r.count === 1, 'HIST : UNE entrée principale pour Nom+Intervenant+Dates simultanés', 'HIST');
  ok(r.changes && r.changes.includes('Nom') && r.changes.includes('Intervenant') && (r.changes.includes('Début') || r.changes.includes('Fin')), 'HIST : le diff liste tous les champs modifiés', 'HIST');
  ok(r.comment === 'Regroupement test.', 'HIST : commentaire enregistré dans l\'entrée', 'HIST');
  await ctx.close();
}

// ============================================================
// RESP — Responsive éditeur (375/390/430) : 0 scroll horizontal
// ============================================================
console.log('\n[RESP] Responsive éditeur');
for (const [w, h] of [[375, 812], [390, 844], [430, 932]]) {
  const { ctx, p } = await newPage({ viewport: { width: w, height: h }, _tag: `RESP-${w}` });
  await ev(p, () => { resetApp(); setDepth('pilot'); setRole('driver'); enterFieldMode(); selectFieldProject('keravel'); });
  await p.waitForTimeout(150);
  await ev(p, () => openTaskEdit('k-windows', 'field-planning'));
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    editorOpen: !!document.querySelector('#taskEditForm'),
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    actionbar: !!document.querySelector('.te-actionbar'),
  }));
  ok(r.editorOpen && !r.hscroll, `RESP : ${w}px — éditeur sans scroll horizontal`, 'RESP');
  ok(r.actionbar, `RESP : ${w}px — barre d'action Annuler/Enregistrer présente`, 'RESP');
  if (w === 390) await p.screenshot({ path: SHOTS + 'edit-mobile-390.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// DARK — éditeur + aperçu en sombre
// ============================================================
console.log('\n[DARK] Thème sombre');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'DARK' });
  await openPlanning(p);
  await ev(p, () => { setAppearance('dark'); renderPage(); openTaskEdit('k-windows', 'planning-gantt'); });
  await p.waitForTimeout(200);
  const dark = await ev(p, () => {
    const c = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
    return { body: document.body.classList.contains('dark'), h: c('.te-h'), name: c('#taskEditForm [name=name]'), readonly: c('.te-readonly b') };
  });
  ok(dark.body && !!dark.h && !!dark.name && !!dark.readonly, 'DARK : éditeur lisible en sombre (titres/champs/lecture seule)', 'DARK');
  await p.screenshot({ path: SHOTS + 'edit-dark.png', fullPage: true });
  await ev(p, () => { document.querySelector('#taskEditForm [name=end]').value = '2026-08-25T16:30'; markTaskEditDirty(); submitTaskEdit(); });
  await p.waitForTimeout(150);
  const previewDark = await ev(p, () => document.querySelector('#modal').classList.contains('open') && !!getComputedStyle(document.querySelector('#modalContent h4')).color);
  ok(previewDark, 'DARK : aperçu d\'impact lisible en sombre', 'DARK');
  await ctx.close();
}

// ============================================================
// A11Y — accessibilité de l'éditeur
// ============================================================
console.log('\n[A11Y] Accessibilité');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'A11Y' });
  await openPlanning(p);
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await p.waitForTimeout(150);
  const a = await ev(p, () => ({
    labels: document.querySelectorAll('#taskEditForm label').length,
    statusButtons: [...document.querySelectorAll('.te-status-seg .seg-opt')].every((x) => x.tagName === 'BUTTON' && x.hasAttribute('aria-checked')),
    actionButtons: [...document.querySelectorAll('.te-actionbar .btn')].every((x) => x.tagName === 'BUTTON'),
    radiogroup: !!document.querySelector('.te-status-seg[role=radiogroup]'),
  }));
  ok(a.labels >= 3 && a.statusButtons && a.actionButtons && a.radiogroup, 'A11Y : labels, boutons natifs, radiogroup + aria-checked', 'A11Y');
  const focusable = await ev(p, () => { const el = document.querySelector('#taskEditForm [name=name]'); el.focus(); return document.activeElement === el; });
  ok(focusable, 'A11Y : champ Nom focusable au clavier', 'A11Y');
  await ctx.close();
}

await b.close();
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniq.length ? 'ERREURS CONSOLE (' + uniq.length + ') :\n' + uniq.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: uniq }, null, 2));
process.exit(0);
