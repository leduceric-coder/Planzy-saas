// ============================================================
// KANVIX — Recette : import intelligent / gestion des doublons (V2.4.9)
//   Usage : node recette-import-intelligent-v2.4.9.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.9.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-import-v2491/';
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
  await p.evaluate(() => { resetApp(); setDepth('pilot'); });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
// Ouvre l'assistant à partir d'un objet data JS (via un vrai File -> importKanvixFile)
async function openWizard(p, data) {
  await ev(p, (j) => { const f = new File([j], 'export.json', { type: 'application/json' }); importKanvixFile(f); }, JSON.stringify(data));
  await p.waitForTimeout(180);
}
// Applique l'assistant (après réglage éventuel des choix) et ferme le rapport.
async function applyWizard(p, mutate) {
  if (mutate) await ev(p, mutate);
  await ev(p, () => applyImportNow());
  await p.waitForTimeout(150);
}
async function closeReport(p) { await ev(p, () => closeOverlay('modal')); await p.waitForTimeout(50); }
const orphanCount = (p) => ev(p, () => {
  const T = new Set(app.tasks.map((t) => t.id)), P = new Set(app.projects.map((x) => x.id)), I = new Set(app.issues.map((i) => i.id));
  let n = 0;
  app.tasks.forEach((t) => { if (!P.has(t.projectId)) n++; (t.deps || []).forEach((d) => { if (!T.has(d)) n++; }); });
  app.milestones.forEach((m) => { if (!P.has(m.projectId)) n++; if (m.taskId && !T.has(m.taskId)) n++; });
  app.issues.forEach((i) => { if (i.taskId && !T.has(i.taskId)) n++; });
  app.photos.forEach((ph) => { if (ph.taskId && !T.has(ph.taskId)) n++; });
  app.messages.forEach((mg) => { if (mg.taskId && !T.has(mg.taskId)) n++; });
  app.decisions.forEach((d) => { if (d.issueId && !I.has(d.issueId)) n++; });
  return n;
});
// Fabrique un export du state courant (= "même fichier")
const selfExport = (p) => ev(p, () => JSON.stringify({ format: 'kanvix-portable', version: 1, exportedAt: new Date().toISOString(), projects: app.projects, tasks: app.tasks, milestones: app.milestones, companyTemplates: app.companyTemplates || [] }));

// ============================================================
// IMP-01 — fichier sans doublon (que des nouveaux)
// ============================================================
console.log('\n[IMP-01] Fichier sans doublon');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-01' });
  const before = await ev(p, () => app.projects.length);
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'sud', name: 'Les Terrasses Sud', location: 'Quimper', phase: 'GO' }],
    tasks: [{ id: 'sud-t1', projectId: 'sud', name: 'Fondations', start: '2026-08-20T08:00', end: '2026-08-20T12:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  const analyzed = await ev(p, () => ({ drawer: document.querySelector('#drawer').classList.contains('open'), newCount: importWizard.analysis.groups.new.length, txt: document.querySelector('#drawerContent').textContent }));
  ok(analyzed.drawer && analyzed.newCount === 1 && /Nouveaux chantiers/.test(analyzed.txt), 'IMP-01 : assistant ouvert, 1 nouveau chantier détecté', 'IMP-01');
  await applyWizard(p);
  const after = await ev(p, () => ({ projects: app.projects.length, has: app.projects.some((x) => x.id === 'sud'), report: document.querySelector('#modalContent')?.textContent || '' }));
  ok(after.projects === before + 1 && after.has, 'IMP-01 : nouveau chantier importé', 'IMP-01');
  ok(/Import terminé/.test(after.report), 'IMP-01 : rapport d\'import affiché', 'IMP-01');
  ok((await orphanCount(p)) === 0, 'IMP-01 : 0 référence orpheline', 'IMP-01');
  await ctx.close();
}

// ============================================================
// IMP-02 — même fichier deux fois (CRITIQUE) : aucun doublon
// ============================================================
console.log('\n[IMP-02] Même fichier deux fois');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-02' });
  const data = JSON.parse(await selfExport(p));
  const before = await ev(p, () => ({ projects: app.projects.length, tasks: app.tasks.length, templates: app.companyTemplates.length }));
  await openWizard(p, data); await applyWizard(p); await closeReport(p);
  await openWizard(p, data); await applyWizard(p); await closeReport(p);
  const after = await ev(p, () => ({
    projects: app.projects.length, tasks: app.tasks.length, templates: app.companyTemplates.length,
    hasImporte: app.projects.some((x) => /\(import|copie/i.test(x.name)),
    hasImportIds: app.projects.some((x) => /^import-/.test(x.id)) || app.tasks.some((t) => /^import-/.test(t.id)),
    valid: validateImportState(app).ok,
  }));
  ok(after.projects === before.projects, 'IMP-02 : nombre de chantiers inchangé après 2 imports', 'IMP-02');
  ok(after.tasks === before.tasks, 'IMP-02 : nombre de tâches inchangé', 'IMP-02');
  ok(!after.hasImporte, 'IMP-02 : AUCUN « (importé) » / « copie »', 'IMP-02');
  ok(!after.hasImportIds, 'IMP-02 : AUCUN id import-*', 'IMP-02');
  ok(after.templates === before.templates, 'IMP-02 : aucune duplication de modèle d\'entreprise', 'IMP-02');
  ok(after.valid, 'IMP-02 : état valide (0 référence orpheline)', 'IMP-02');
  await ctx.close();
}

// ============================================================
// IMP-03 — importer uniquement les nouveaux (A B C + A B D E)
// ============================================================
console.log('\n[IMP-03] Importer uniquement les nouveaux');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-03' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [
      { id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'X' }, // doublon
      { id: 'newd', name: 'Chantier D', location: 'Brest', phase: 'GO' },
      { id: 'newe', name: 'Chantier E', location: 'Quimper', phase: 'GO' },
    ],
    tasks: [
      { id: 'kv-x', projectId: 'keravel', name: 'X', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'd-1', projectId: 'newd', name: 'D1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'e-1', projectId: 'newe', name: 'E1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
    ], milestones: [], companyTemplates: [] };
  const beforeKeravelTasks = await ev(p, () => app.tasks.filter((t) => t.projectId === 'keravel').length);
  await openWizard(p, data);
  await applyWizard(p, () => setImportStrategy('new'));
  const r = await ev(p, () => ({
    ids: app.projects.map((x) => x.id).sort(),
    keravelTasks: app.tasks.filter((t) => t.projectId === 'keravel').length,
    hasX: app.tasks.some((t) => t.id === 'kv-x'),
  }));
  ok(r.ids.includes('newd') && r.ids.includes('newe'), 'IMP-03 : nouveaux (D, E) importés', 'IMP-03');
  ok(r.keravelTasks === beforeKeravelTasks && !r.hasX, 'IMP-03 : doublon (Keravel) ignoré, inchangé', 'IMP-03');
  ok((await orphanCount(p)) === 0, 'IMP-03 : 0 orpheline', 'IMP-03');
  await ctx.close();
}

// ============================================================
// IMP-04 — fusion d'un doublon (A: T1 T2 T3 ; import A: T1 T2 T4)
// ============================================================
console.log('\n[IMP-04] Fusion doublon');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-04' });
  // Prépare keravel avec 3 tâches connues (et nettoie les données liées aux
  // anciennes tâches pour partir d'un état valide).
  await ev(p, () => {
    app.tasks = app.tasks.filter((t) => t.projectId !== 'keravel');
    app.tasks.push(
      { id: 't1', projectId: 'keravel', name: 'T1', start: '2026-08-17T08:00', end: '2026-08-17T10:00', deps: [], status: 'todo' },
      { id: 't2', projectId: 'keravel', name: 'T2', start: '2026-08-18T08:00', end: '2026-08-18T10:00', deps: ['t1'], status: 'doing' },
      { id: 't3', projectId: 'keravel', name: 'T3', start: '2026-08-19T08:00', end: '2026-08-19T10:00', deps: ['t2'], status: 'todo' },
    );
    const kept = new Set(app.tasks.map((t) => t.id));
    app.issues = app.issues.filter((i) => !i.taskId || kept.has(i.taskId));
    app.photos = app.photos.filter((ph) => !ph.taskId || kept.has(ph.taskId));
    app.messages = app.messages.filter((m) => !m.taskId || kept.has(m.taskId));
    app.documents.forEach((d) => { if (d.taskId && !kept.has(d.taskId)) d.taskId = null; });
    app.history = app.history.filter((h) => !h.taskId || kept.has(h.taskId));
    app.milestones = app.milestones.filter((m) => !m.taskId || kept.has(m.taskId));
    const iset = new Set(app.issues.map((i) => i.id));
    app.decisions = app.decisions.filter((d) => !d.issueId || iset.has(d.issueId));
    save();
  });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'Finitions' }],
    tasks: [
      { id: 't1', projectId: 'keravel', name: 'T1 revu', start: '2026-08-17T08:00', end: '2026-08-17T11:00', deps: [] },
      { id: 't2', projectId: 'keravel', name: 'T2', start: '2026-08-18T08:00', end: '2026-08-18T10:00', deps: ['t1'] },
      { id: 't4', projectId: 'keravel', name: 'T4', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: ['t2'] },
    ], milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => setImportStrategy('merge'));
  const r = await ev(p, () => {
    const kt = app.tasks.filter((t) => t.projectId === 'keravel');
    return {
      ids: kt.map((t) => t.id).sort(),
      t1name: task('t1')?.name, t1end: task('t1')?.end,
      t3kept: !!task('t3'), t2statusKept: task('t2')?.status,
      t4deps: task('t4')?.deps,
      projectsCount: app.projects.filter((x) => x.id === 'keravel').length,
    };
  });
  ok(r.ids.join(',') === 't1,t2,t3,t4', 'IMP-04 : T1/T2 mises à jour, T3 conservée, T4 ajoutée', 'IMP-04');
  ok(r.t1name === 'T1 revu' && r.t1end === '2026-08-17T11:00', 'IMP-04 : T1 mise à jour depuis le fichier', 'IMP-04');
  ok(r.t3kept, 'IMP-04 : T3 (absente du fichier) conservée', 'IMP-04');
  ok(r.t2statusKept === 'doing', 'IMP-04 : statut terrain local de T2 préservé', 'IMP-04');
  ok(Array.isArray(r.t4deps) && r.t4deps.includes('t2'), 'IMP-04 : deps de T4 remappées (→ t2 canonique)', 'IMP-04');
  ok(r.projectsCount === 1, 'IMP-04 : aucun doublon de chantier', 'IMP-04');
  ok((await orphanCount(p)) === 0, 'IMP-04 : 0 orpheline', 'IMP-04');
  await ctx.close();
}

// ============================================================
// IMP-05 — remplacer un doublon (A B C ; import A) => A(import) B C
// ============================================================
console.log('\n[IMP-05] Remplacer doublon');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-05' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'Finitions' }],
    tasks: [{ id: 'kv-new', projectId: 'keravel', name: 'Tâche remplacée', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [{ id: 'm-new', projectId: 'keravel', name: 'Nouveau jalon', date: '2026-08-25T17:00', taskId: 'kv-new' }], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => setImportStrategy('replace'));
  const r = await ev(p, () => ({
    keravelTasks: app.tasks.filter((t) => t.projectId === 'keravel').map((t) => t.id),
    others: app.projects.filter((x) => x.id !== 'keravel').map((x) => x.id).sort(),
    keravelMs: app.milestones.filter((m) => m.projectId === 'keravel').map((m) => m.id),
    valid: validateImportState(app).ok,
  }));
  ok(r.keravelTasks.length === 1 && r.keravelTasks[0] === 'kv-new', 'IMP-05 : planning de Keravel remplacé (anciennes tâches supprimées)', 'IMP-05');
  ok(r.others.join(',') === 'horizon,terrasses,villa', 'IMP-05 : autres chantiers conservés (B, C…)', 'IMP-05');
  ok(r.keravelMs.length === 1, 'IMP-05 : jalons du chantier remplacés', 'IMP-05');
  ok(r.valid && (await orphanCount(p)) === 0, 'IMP-05 : 0 référence orpheline', 'IMP-05');
  await ctx.close();
}

// ============================================================
// IMP-06 — remplacer TOUS les chantiers (A B C ; import A D) => A D
// ============================================================
console.log('\n[IMP-06] Remplacer tous les chantiers');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-06' });
  const resBefore = await ev(p, () => app.resources.length);
  const data = { format: 'kanvix-portable', version: 1,
    projects: [
      { id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'Finitions' },
      { id: 'newd', name: 'Chantier D', location: 'Brest', phase: 'GO' },
    ],
    tasks: [
      { id: 'kv-1', projectId: 'keravel', name: 'K1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'd-1', projectId: 'newd', name: 'D1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
    ], milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  // Stratégie D -> confirmation dédiée
  await ev(p, () => setImportStrategy('replace-all'));
  await ev(p, () => previewImport()); // ouvre la confirmation "Remplacer tous les chantiers ?"
  await p.waitForTimeout(120);
  const confirm = await ev(p, () => ({ open: document.querySelector('#modal').classList.contains('open'), txt: document.querySelector('#modalContent').textContent }));
  ok(confirm.open && /Remplacer tous les chantiers/.test(confirm.txt), 'IMP-06 : confirmation destructive explicite', 'IMP-06');
  await p.screenshot({ path: SHOTS + 'imp06-replace-all-confirm.png', fullPage: true });
  await ev(p, () => applyImportNow());
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    ids: app.projects.map((x) => x.id).sort(),
    resources: app.resources.length, hasSettings: !!app.settings,
    valid: validateImportState(app).ok,
  }));
  ok(r.ids.join(',') === 'keravel,newd', 'IMP-06 : seuls A + D subsistent (B, C supprimés)', 'IMP-06');
  ok(r.resources === resBefore && r.hasSettings, 'IMP-06 : réglages / ressources / compte conservés', 'IMP-06');
  ok(r.valid && (await orphanCount(p)) === 0, 'IMP-06 : 0 orpheline après remplacement global', 'IMP-06');
  await ctx.close();
}

// ============================================================
// IMP-07 — importer un doublon COMME NOUVEAU (copie indépendante)
// ============================================================
console.log('\n[IMP-07] Importer comme nouveau');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-07' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'Finitions' }],
    tasks: [
      { id: 'k-a', projectId: 'keravel', name: 'A', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'k-b', projectId: 'keravel', name: 'B', start: '2026-08-21T08:00', end: '2026-08-21T10:00', deps: ['k-a'] },
    ], milestones: [], companyTemplates: [] };
  const before = await ev(p, () => app.projects.length);
  await openWizard(p, data);
  await applyWizard(p, () => { importWizard.analysis.projects.forEach((e) => { if (e.category === 'duplicate') importWizard.choices[e.imported.id] = 'new'; }); });
  const r = await ev(p, () => {
    const copy = app.projects.find((x) => x.id !== 'keravel' && /keravel/i.test(x.name));
    const ct = copy ? app.tasks.filter((t) => t.projectId === copy.id) : [];
    return {
      total: app.projects.length, name: copy?.name, id: copy?.id,
      taskIds: ct.map((t) => t.id), bDeps: ct.find((t) => t.name === 'B')?.deps,
      keravelUntouched: app.projects.some((x) => x.id === 'keravel'),
      valid: validateImportState(app).ok,
    };
  });
  ok(r.total === before + 1 && /copie/i.test(r.name || ''), 'IMP-07 : copie indépendante créée (« — copie »)', 'IMP-07');
  ok(!r.taskIds.includes('k-a') && !r.taskIds.includes('k-b'), 'IMP-07 : nouveaux IDs de tâches (pas de collision)', 'IMP-07');
  ok(Array.isArray(r.bDeps) && r.bDeps.length === 1 && !r.bDeps.includes('k-a'), 'IMP-07 : deps remappées vers les IDs de la copie', 'IMP-07');
  ok(r.keravelUntouched && r.valid, 'IMP-07 : chantier d\'origine intact, 0 orpheline', 'IMP-07');
  ok((await orphanCount(p)) === 0, 'IMP-07 : 0 orpheline', 'IMP-07');
  await ctx.close();
}

// ============================================================
// IMP-08 — match exact par ID
// ============================================================
console.log('\n[IMP-08] Match exact par ID');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-08' });
  const r = await ev(p, () => {
    const m = findProjectImportMatch({ id: 'keravel', name: 'Nom totalement différent', location: 'Ailleurs' });
    return { conf: m?.confidence, id: m?.existing.id };
  });
  ok(r.conf === 'exact-id' && r.id === 'keravel', 'IMP-08 : même ID → doublon certain (exact-id)', 'IMP-08');
  await ctx.close();
}

// ============================================================
// IMP-09 — match nom + localisation (ID différent)
// ============================================================
console.log('\n[IMP-09] Match nom+localisation');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-09' });
  const r = await ev(p, () => {
    const m = findProjectImportMatch({ id: 'p-001', name: 'RÉSIDENCE KERAVEL', location: ' plouzané ' });
    return { conf: m?.confidence, id: m?.existing.id, norm: [normalizeImportText('Résidence Kéravel'), normalizeImportText(' RÉSIDENCE  keravel ')] };
  });
  ok(r.conf === 'name-location' && r.id === 'keravel', 'IMP-09 : nom+lieu normalisés identiques → doublon (name-location)', 'IMP-09');
  ok(r.norm[0] === r.norm[1] && r.norm[0] === 'residence keravel', 'IMP-09 : normalisation (accents/casse/espaces) cohérente', 'IMP-09');
  await ctx.close();
}

// ============================================================
// IMP-10 — faux positif : nom identique, lieu différent => possible
// ============================================================
console.log('\n[IMP-10] Faux positif (nom seul)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-10' });
  await ev(p, () => { project('horizon').name = 'Résidence Horizon'; project('horizon').location = 'Brest'; save(); });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'hz2', name: 'Résidence Horizon', location: 'Rennes', phase: 'GO' }],
    tasks: [{ id: 'hz2-t', projectId: 'hz2', name: 'T', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  const r = await ev(p, () => ({ cat: importWizard.analysis.projects[0].category, conf: importWizard.analysis.projects[0].confidence, txt: document.querySelector('#drawerContent').textContent }));
  ok(r.cat === 'possible' && r.conf === 'possible', 'IMP-10 : nom identique + lieu différent → correspondance possible (jamais doublon certain)', 'IMP-10');
  ok(/À vérifier/.test(r.txt), 'IMP-10 : classé « À vérifier », décision utilisateur requise', 'IMP-10');
  // par défaut ignoré tant qu'aucun choix explicite
  await applyWizard(p);
  const after = await ev(p, () => app.projects.some((x) => x.id === 'hz2'));
  ok(!after, 'IMP-10 : non importé automatiquement (défaut ignoré)', 'IMP-10');
  await ctx.close();
}

// ============================================================
// IMP-11 — dépendances remappées (fusion, IDs différents)
// ============================================================
console.log('\n[IMP-11] Dépendances remappées');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-11' });
  // keravel local : A B C avec deps ; import réutilise A/B (mêmes id) + C avec deps
  await ev(p, () => {
    app.tasks = app.tasks.filter((t) => t.projectId !== 'keravel');
    app.tasks.push(
      { id: 'A', projectId: 'keravel', name: 'Alpha', start: '2026-08-17T08:00', end: '2026-08-17T10:00', deps: [] },
      { id: 'B', projectId: 'keravel', name: 'Beta', start: '2026-08-18T08:00', end: '2026-08-18T10:00', deps: ['A'] },
    );
    const kept = new Set(app.tasks.map((t) => t.id));
    app.issues = app.issues.filter((i) => !i.taskId || kept.has(i.taskId));
    app.photos = app.photos.filter((ph) => !ph.taskId || kept.has(ph.taskId));
    app.messages = app.messages.filter((m) => !m.taskId || kept.has(m.taskId));
    app.documents.forEach((d) => { if (d.taskId && !kept.has(d.taskId)) d.taskId = null; });
    app.history = app.history.filter((h) => !h.taskId || kept.has(h.taskId));
    app.milestones = app.milestones.filter((m) => !m.taskId || kept.has(m.taskId));
    const iset = new Set(app.issues.map((i) => i.id));
    app.decisions = app.decisions.filter((d) => !d.issueId || iset.has(d.issueId));
    save();
  });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' }],
    tasks: [
      { id: 'A', projectId: 'keravel', name: 'Alpha', start: '2026-08-17T08:00', end: '2026-08-17T10:00', deps: [] },
      { id: 'B', projectId: 'keravel', name: 'Beta', start: '2026-08-18T08:00', end: '2026-08-18T10:00', deps: ['A'] },
      { id: 'Cimp', projectId: 'keravel', name: 'Gamma', start: '2026-08-19T08:00', end: '2026-08-19T10:00', deps: ['A', 'B'] },
    ], milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => setImportStrategy('merge'));
  const r = await ev(p, () => {
    const c = app.tasks.find((t) => t.projectId === 'keravel' && t.name === 'Gamma');
    const T = new Set(app.tasks.map((t) => t.id));
    return { cdeps: c?.deps, allDepsValid: app.tasks.every((t) => (t.deps || []).every((d) => T.has(d))), noImportIds: app.tasks.every((t) => !/^import-/.test(t.id)) };
  });
  ok(Array.isArray(r.cdeps) && r.cdeps.includes('A') && r.cdeps.includes('B'), 'IMP-11 : C.deps pointent vers les IDs canoniques (A, B)', 'IMP-11');
  ok(r.allDepsValid, 'IMP-11 : toutes les deps valides (0 référence obsolète)', 'IMP-11');
  ok(r.noImportIds, 'IMP-11 : aucun id import-* résiduel', 'IMP-11');
  await ctx.close();
}

// ============================================================
// IMP-12 — données liées préservées (fusion T1 survit)
// ============================================================
console.log('\n[IMP-12] Données liées préservées (fusion)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-12' });
  const before = await ev(p, () => ({
    issues: app.issues.filter((i) => i.taskId === 'k-windows').length,
    photos: app.photos.filter((ph) => ph.taskId === 'k-windows').length,
    messages: app.messages.filter((m) => m.taskId === 'k-windows').length,
  }));
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' }],
    tasks: [{ id: 'k-windows', projectId: 'keravel', name: 'Pose des 6 fenêtres', start: '2026-08-13T08:00', end: '2026-08-14T16:30', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => setImportStrategy('merge'));
  const after = await ev(p, () => ({
    issues: app.issues.filter((i) => i.taskId === 'k-windows').length,
    photos: app.photos.filter((ph) => ph.taskId === 'k-windows').length,
    messages: app.messages.filter((m) => m.taskId === 'k-windows').length,
    exists: !!task('k-windows'),
  }));
  ok(after.exists, 'IMP-12 : T1 (k-windows) survit à la fusion', 'IMP-12');
  ok(after.issues === before.issues && after.photos === before.photos && after.messages === before.messages, 'IMP-12 : alertes / photos / messages toujours rattachés', 'IMP-12');
  ok((await orphanCount(p)) === 0, 'IMP-12 : 0 orpheline', 'IMP-12');
  await ctx.close();
}

// ============================================================
// IMP-13 — modèles d'entreprise dédupliqués
// ============================================================
console.log('\n[IMP-13] Modèles d\'entreprise dédupliqués');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-13' });
  await ev(p, () => { app.companyTemplates = [{ id: 'tpl-a', name: 'Maison individuelle', companyOwned: true, tasks: [] }]; save(); });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'zz', name: 'Chantier ZZ', location: 'Brest', phase: 'GO' }],
    tasks: [{ id: 'zz-1', projectId: 'zz', name: 'T', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [],
    companyTemplates: [
      { id: 'tpl-a', name: 'Maison individuelle', tasks: [] }, // même id
      { id: 'tpl-b', name: 'MAISON INDIVIDUELLE', tasks: [] }, // même nom normalisé
      { id: 'tpl-c', name: 'Immeuble collectif', tasks: [] }, // nouveau
    ] };
  await openWizard(p, data); await applyWizard(p); await closeReport(p);
  // ré-import du même fichier -> toujours pas de doublon
  await openWizard(p, data); await applyWizard(p);
  const r = await ev(p, () => ({ count: app.companyTemplates.length, names: app.companyTemplates.map((t) => t.name), noImportTpl: app.companyTemplates.every((t) => !/^import-/.test(t.id)) }));
  ok(r.count === 2, 'IMP-13 : une seule occurrence par id/nom (Maison + Immeuble)', 'IMP-13');
  ok(r.noImportTpl, 'IMP-13 : aucun id import-xxxx-tpl généré', 'IMP-13');
  await ctx.close();
}

// ============================================================
// IMP-14 — undo import (fusion + nouveaux + remplacement) = 1 snapshot
// ============================================================
console.log('\n[IMP-14] Undo import');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-14' });
  const beforeJson = await ev(p, () => JSON.stringify({ projects: app.projects, tasks: app.tasks, milestones: app.milestones, issues: app.issues, photos: app.photos, messages: app.messages }));
  const undoBefore = await ev(p, () => app.undoStack.length);
  const data = { format: 'kanvix-portable', version: 1,
    projects: [
      { id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' }, // fusion
      { id: 'terrasses', name: 'Les Terrasses', location: 'Brest', phase: 'X' }, // remplacement
      { id: 'brandnew', name: 'Tout neuf', location: 'Quimper', phase: 'GO' }, // nouveau
    ],
    tasks: [
      { id: 'kv-new', projectId: 'keravel', name: 'Nouvelle K', start: '2026-08-25T08:00', end: '2026-08-25T10:00', deps: [] },
      { id: 'tr-new', projectId: 'terrasses', name: 'Nouvelle T', start: '2026-08-25T08:00', end: '2026-08-25T10:00', deps: [] },
      { id: 'bn-1', projectId: 'brandnew', name: 'BN1', start: '2026-08-25T08:00', end: '2026-08-25T10:00', deps: [] },
    ], milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => { importWizard.choices['keravel'] = 'merge'; importWizard.choices['terrasses'] = 'replace'; });
  const undoAfter = await ev(p, () => app.undoStack.length);
  ok(undoAfter === undoBefore + 1, 'IMP-14 : UN seul snapshot Undo pour tout l\'import', 'IMP-14');
  await closeReport(p);
  await ev(p, () => undo());
  await p.waitForTimeout(120);
  const afterJson = await ev(p, () => JSON.stringify({ projects: app.projects, tasks: app.tasks, milestones: app.milestones, issues: app.issues, photos: app.photos, messages: app.messages }));
  ok(afterJson === beforeJson, 'IMP-14 : Undo restaure exactement l\'état métier précédent', 'IMP-14');
  await ctx.close();
}

// ============================================================
// IMP-15 — rollback en cas d'erreur (aucun demi-import)
// ============================================================
console.log('\n[IMP-15] Rollback sur erreur');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-15' });
  const before = await ev(p, () => ({ projects: app.projects.length, tasks: app.tasks.length, undo: app.undoStack.length }));
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'zz', name: 'Chantier ZZ', location: 'Brest', phase: 'GO' }],
    tasks: [{ id: 'zz-1', projectId: 'zz', name: 'T', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  // Force une erreur : validateImportState renvoie invalide -> rollback complet
  const r = await ev(p, () => {
    const orig = window.validateImportState;
    window.validateImportState = () => ({ ok: false, errors: ['erreur simulée'] });
    applyImportNow();
    window.validateImportState = orig;
    return { projects: app.projects.length, tasks: app.tasks.length, undo: app.undoStack.length, hasZZ: app.projects.some((x) => x.id === 'zz'), modal: document.querySelector('#modal').classList.contains('open'), txt: document.querySelector('#modalContent').textContent };
  });
  ok(r.projects === before.projects && r.tasks === before.tasks && !r.hasZZ, 'IMP-15 : rollback complet — aucune donnée importée', 'IMP-15');
  ok(r.undo === before.undo, 'IMP-15 : aucun snapshot résiduel après rollback', 'IMP-15');
  ok(r.modal && /annulé/i.test(r.txt), 'IMP-15 : message d\'erreur clair, jamais de demi-import', 'IMP-15');
  await ctx.close();
}

// ============================================================
// IMP-16 — mobile (390) : assistant utilisable, 0 scroll horizontal
// ============================================================
console.log('\n[IMP-16] Mobile');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'IMP-16' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [
      { id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' },
      { id: 'newx', name: 'Chantier X', location: 'Quimper', phase: 'GO' },
    ],
    tasks: [
      { id: 'kv-1', projectId: 'keravel', name: 'K1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'nx-1', projectId: 'newx', name: 'X1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
    ], milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  const r = await ev(p, () => ({
    open: document.querySelector('#drawer').classList.contains('open'),
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    hasActionbar: !!document.querySelector('.imp-wizard .te-actionbar'),
    hasStrats: document.querySelectorAll('.imp-strat').length === 4,
  }));
  ok(r.open && !r.hscroll, 'IMP-16 : assistant sans scroll horizontal (390 px)', 'IMP-16');
  ok(r.hasActionbar && r.hasStrats, 'IMP-16 : stratégies empilées + barre d\'action accessible', 'IMP-16');
  await p.screenshot({ path: SHOTS + 'imp16-mobile-390.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// IMP-17 — dark mode
// ============================================================
console.log('\n[IMP-17] Dark mode');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-17' });
  await ev(p, () => { setAppearance('dark'); });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' }, { id: 'nn', name: 'Neuf', location: 'Brest', phase: 'GO' }],
    tasks: [{ id: 'kv-1', projectId: 'keravel', name: 'K1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }, { id: 'nn-1', projectId: 'nn', name: 'N1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  const r = await ev(p, () => {
    const c = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : null; };
    return { dark: document.body.classList.contains('dark'), summary: c('.imp-analyzed'), badge: !!document.querySelector('.imp-badge'), strat: c('.imp-strat') };
  });
  ok(r.dark && !!r.summary && r.badge && !!r.strat, 'IMP-17 : assistant lisible en sombre (résumé, badges, stratégies)', 'IMP-17');
  await p.screenshot({ path: SHOTS + 'imp17-dark.png', fullPage: true });
  // aperçu final en sombre
  await ev(p, () => previewImport());
  await p.waitForTimeout(120);
  ok(await ev(p, () => document.querySelector('#modal').classList.contains('open') && !!getComputedStyle(document.querySelector('#modalContent h2')).color), 'IMP-17 : récapitulatif lisible en sombre', 'IMP-17');
  await ctx.close();
}

// ============================================================
// IMP-18 — 0 référence orpheline (scénario mixte complet)
// ============================================================
console.log('\n[IMP-18] 0 référence orpheline (mixte)');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-18' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [
      { id: 'keravel', name: 'Résidence Keravel', location: 'Plouzané', phase: 'F' }, // remplacement
      { id: 'villa', name: 'Villa du Port', location: 'Le Relecq', phase: 'F' }, // fusion
      { id: 'brandnew', name: 'Tout neuf', location: 'Quimper', phase: 'GO' }, // nouveau
    ],
    tasks: [
      { id: 'kv-x', projectId: 'keravel', name: 'X', start: '2026-08-25T08:00', end: '2026-08-25T10:00', deps: [] },
      { id: 'kv-y', projectId: 'keravel', name: 'Y', start: '2026-08-26T08:00', end: '2026-08-26T10:00', deps: ['kv-x'] },
      { id: 'v-facade', projectId: 'villa', name: 'Façade', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'bn-1', projectId: 'brandnew', name: 'BN', start: '2026-08-25T08:00', end: '2026-08-25T10:00', deps: [] },
    ], milestones: [{ id: 'mkx', projectId: 'keravel', name: 'Jalon K', date: '2026-08-27T17:00', taskId: 'kv-y' }], companyTemplates: [] };
  await openWizard(p, data);
  await applyWizard(p, () => { importWizard.choices['keravel'] = 'replace'; importWizard.choices['villa'] = 'merge'; });
  const r = await ev(p, () => validateImportState(app));
  ok(r.ok, 'IMP-18 : validateImportState OK (aucune référence invalide)', 'IMP-18');
  ok((await orphanCount(p)) === 0, 'IMP-18 : 0 orpheline (issues/photos/messages/jalons/deps/décisions)', 'IMP-18');
  const noImport = await ev(p, () => app.projects.every((x) => !/^import-/.test(x.id)) && app.tasks.every((t) => !/^import-/.test(t.id)));
  ok(noImport, 'IMP-18 : aucun id import-* dans l\'état final', 'IMP-18');
  await ctx.close();
}

// ============================================================
// IMP-19 — replace-all : aperçu EXHAUSTIF des suppressions (V2.4.9.1)
// ============================================================
console.log('\n[IMP-19] Replace-all : aperçu exhaustif des suppressions');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1100 }, _tag: 'IMP-19' });
  // Prépare un état contrôlé : 3 projets, tâches, 2 issues, 2 decisions, 3 photos, 4 messages, 5 documents, 6 history
  await ev(p, () => {
    app.projects = [
      { id: 'pA', name: 'Chantier A', location: 'Brest', phase: 'GO' },
      { id: 'pB', name: 'Chantier B', location: 'Quimper', phase: 'GO' },
      { id: 'pC', name: 'Chantier C', location: 'Rennes', phase: 'GO' },
    ];
    app.tasks = [
      { id: 'a1', projectId: 'pA', name: 'A1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'a2', projectId: 'pA', name: 'A2', start: '2026-08-21T08:00', end: '2026-08-21T10:00', deps: ['a1'] },
      { id: 'b1', projectId: 'pB', name: 'B1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'c1', projectId: 'pC', name: 'C1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
    ];
    app.milestones = [{ id: 'mA', projectId: 'pA', name: 'Jalon A', date: '2026-08-25T17:00', taskId: 'a2' }];
    app.issues = [
      { id: 'i1', projectId: 'pA', taskId: 'a1', status: 'open', severity: 'warning', title: 'I1' },
      { id: 'i2', projectId: 'pB', taskId: 'b1', status: 'open', severity: 'warning', title: 'I2' },
    ];
    app.decisions = [{ id: 'de1', issueId: 'i1', status: 'required' }, { id: 'de2', issueId: 'i2', status: 'required' }];
    app.photos = [
      { id: 'ph1', projectId: 'pA', taskId: 'a1', author: 'X', date: '2026-08-20T09:00', comment: '' },
      { id: 'ph2', projectId: 'pA', taskId: 'a2', author: 'X', date: '2026-08-20T09:00', comment: '' },
      { id: 'ph3', projectId: 'pB', taskId: 'b1', author: 'X', date: '2026-08-20T09:00', comment: '' },
    ];
    app.messages = [
      { id: 101, projectId: 'pA', taskId: 'a1', from: 'driver', text: 'm1', time: '08:00', read: true },
      { id: 102, projectId: 'pA', taskId: 'a1', from: 'artisan', text: 'm2', time: '08:01', read: true },
      { id: 103, projectId: 'pB', taskId: 'b1', from: 'driver', text: 'm3', time: '08:02', read: true },
      { id: 104, projectId: 'pC', taskId: 'c1', from: 'driver', text: 'm4', time: '08:03', read: true },
    ];
    app.documents = [
      { id: 'd1', projectId: 'pA', taskId: 'a1', category: 'plans', name: 'D1', type: 'PDF', date: '2026-08-01T10:00' },
      { id: 'd2', projectId: 'pA', taskId: null, category: 'plans', name: 'D2', type: 'PDF', date: '2026-08-01T10:00' },
      { id: 'd3', projectId: 'pB', taskId: 'b1', category: 'devis', name: 'D3', type: 'PDF', date: '2026-08-01T10:00' },
      { id: 'd4', projectId: 'pC', taskId: 'c1', category: 'cr', name: 'D4', type: 'PDF', date: '2026-08-01T10:00' },
      { id: 'd5', projectId: 'pC', taskId: null, category: 'admin', name: 'D5', type: 'PDF', date: '2026-08-01T10:00' },
    ];
    app.history = Array.from({ length: 6 }, (_, i) => ({ date: '08:0' + i, text: 'h' + i, author: 'Eric', taskId: i < 3 ? 'a1' : 'b1' }));
    save();
  });
  const before = await ev(p, () => JSON.stringify({ projects: app.projects.length, tasks: app.tasks.length, issues: app.issues.length, decisions: app.decisions.length, photos: app.photos.length, messages: app.messages.length, documents: app.documents.length, history: app.history.length }));
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'newp', name: 'Nouveau', location: 'Lorient', phase: 'GO' }],
    tasks: [{ id: 'np-1', projectId: 'newp', name: 'N1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await ev(p, () => setImportStrategy('replace-all'));
  await ev(p, () => previewImport());
  await p.waitForTimeout(150);
  const modal = await ev(p, () => document.querySelector('#modalContent').textContent.replace(/\s+/g, ' '));
  const unchanged = await ev(p, () => JSON.stringify({ projects: app.projects.length, tasks: app.tasks.length, issues: app.issues.length, decisions: app.decisions.length, photos: app.photos.length, messages: app.messages.length, documents: app.documents.length, history: app.history.length }));
  ok(/Données locales supprimées/.test(modal), 'IMP-19 : bloc « Données locales supprimées » affiché', 'IMP-19');
  ok(/2 alertes/.test(modal), 'IMP-19 : 2 alertes annoncées', 'IMP-19');
  ok(/2 décisions/.test(modal), 'IMP-19 : 2 décisions annoncées', 'IMP-19');
  ok(/3 photos/.test(modal), 'IMP-19 : 3 photos annoncées', 'IMP-19');
  ok(/4 messages/.test(modal), 'IMP-19 : 4 messages annoncés', 'IMP-19');
  ok(/5 documents/.test(modal), 'IMP-19 : 5 documents annoncés', 'IMP-19');
  ok(/6 entrées d’historique/.test(modal), 'IMP-19 : 6 entrées d’historique annoncées', 'IMP-19');
  ok(unchanged === before, 'IMP-19 : aucune donnée modifiée avant confirmation', 'IMP-19');
  await p.screenshot({ path: SHOTS + 'imp19-replace-all-detail.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// IMP-20 — replace-all : clone invalide => bouton destructif absent
// ============================================================
console.log('\n[IMP-20] Replace-all : clone invalide bloqué');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-20' });
  const before = await ev(p, () => JSON.stringify({ projects: app.projects.length, tasks: app.tasks.length }));
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'newp', name: 'Nouveau', location: 'Lorient', phase: 'GO' }],
    tasks: [{ id: 'np-1', projectId: 'newp', name: 'N1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await ev(p, () => setImportStrategy('replace-all'));
  // Force un clone invalide : validateImportState renvoie KO
  const r = await ev(p, () => {
    const orig = window.validateImportState;
    window.validateImportState = () => ({ ok: false, errors: ['Dépendance invalide np-1→zzz', 'Jalon x → tâche inconnue'] });
    confirmReplaceAll();
    window.validateImportState = orig;
    return {
      hasDanger: !!document.querySelector('#modalContent .btn.danger'),
      txt: document.querySelector('#modalContent').textContent.replace(/\s+/g, ' '),
      btns: [...document.querySelectorAll('#modalContent .pop-actions .btn')].map((x) => x.textContent),
    };
  });
  ok(!r.hasDanger, 'IMP-20 : bouton « Remplacer tous les chantiers » absent si clone invalide', 'IMP-20');
  ok(/état Kanvix invalide/.test(r.txt), 'IMP-20 : message d\'invalidité affiché', 'IMP-20');
  ok(r.btns.length === 1 && /Retour/.test(r.btns[0]), 'IMP-20 : seul « Retour » proposé', 'IMP-20');
  const after = await ev(p, () => JSON.stringify({ projects: app.projects.length, tasks: app.tasks.length }));
  ok(after === before, 'IMP-20 : app strictement inchangé', 'IMP-20');
  await ctx.close();
}

// ============================================================
// IMP-21 — aperçu == application (replace-all avec données terrain)
// ============================================================
console.log('\n[IMP-21] Replace-all : aperçu == application');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-21' });
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'newp', name: 'Nouveau', location: 'Lorient', phase: 'GO' }, { id: 'newq', name: 'Autre', location: 'Vannes', phase: 'GO' }],
    tasks: [
      { id: 'np-1', projectId: 'newp', name: 'N1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
      { id: 'nq-1', projectId: 'newq', name: 'Q1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] },
    ], milestones: [{ id: 'mnp', projectId: 'newp', name: 'J', date: '2026-08-25T17:00', taskId: 'np-1' }], companyTemplates: [] };
  await openWizard(p, data);
  await ev(p, () => setImportStrategy('replace-all'));
  await ev(p, () => previewImport());
  await p.waitForTimeout(120);
  const previewSum = await ev(p, () => JSON.stringify(importWizard.previewSum));
  await ev(p, () => applyImportNow());
  await p.waitForTimeout(150);
  const appliedSum = await ev(p, () => JSON.stringify(lastImportSum));
  ok(previewSum === appliedSum, 'IMP-21 : résumé aperçu === résumé application (mêmes chiffres)', 'IMP-21');
  ok((await orphanCount(p)) === 0, 'IMP-21 : 0 référence orpheline après application', 'IMP-21');
  const finalIds = await ev(p, () => app.projects.map((x) => x.id).sort().join(','));
  ok(finalIds === 'newp,newq', 'IMP-21 : état final = chantiers du fichier', 'IMP-21');
  await ctx.close();
}

// ============================================================
// IMP-22 — Undo après replace-all : restauration exacte
// ============================================================
console.log('\n[IMP-22] Undo après replace-all');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 1000 }, _tag: 'IMP-22' });
  const before = await ev(p, () => JSON.stringify({ projects: app.projects, tasks: app.tasks, milestones: app.milestones, issues: app.issues, decisions: app.decisions, photos: app.photos, messages: app.messages, documents: app.documents, history: app.history }));
  const data = { format: 'kanvix-portable', version: 1,
    projects: [{ id: 'newp', name: 'Nouveau', location: 'Lorient', phase: 'GO' }],
    tasks: [{ id: 'np-1', projectId: 'newp', name: 'N1', start: '2026-08-20T08:00', end: '2026-08-20T10:00', deps: [] }],
    milestones: [], companyTemplates: [] };
  await openWizard(p, data);
  await ev(p, () => setImportStrategy('replace-all'));
  await ev(p, () => previewImport());
  await p.waitForTimeout(100);
  await ev(p, () => applyImportNow());
  await p.waitForTimeout(120);
  await closeReport(p);
  await ev(p, () => undo());
  await p.waitForTimeout(120);
  const after = await ev(p, () => JSON.stringify({ projects: app.projects, tasks: app.tasks, milestones: app.milestones, issues: app.issues, decisions: app.decisions, photos: app.photos, messages: app.messages, documents: app.documents, history: app.history }));
  ok(after === before, 'IMP-22 : Undo restaure exactement projets/tâches/jalons/alertes/décisions/photos/messages/documents/historique', 'IMP-22');
  await ctx.close();
}

await b.close();
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniq.length ? 'ERREURS CONSOLE (' + uniq.length + ') :\n' + uniq.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: uniq }, null, 2));
process.exit(0);
