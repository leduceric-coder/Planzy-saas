// ============================================================
// KANVIX — Recette historique contextualisé par chantier (V2.4.12 / SITE-01)
//   Usage : node recette-historique-chantiers-v2.4.12.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.12.html' + NOW;
const BASELINE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.11.3.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-historique-v2.4.12/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
const allErrs = [];
async function newPage(w = 1440, h = 950, tag = 'x', url = FILE) {
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
const run = async (p, src) => { await ev(p, (s) => (0, eval)(s), src); await p.waitForTimeout(200); };

// Jeu de données déterministe : 4 chantiers de démo + une entrée par chantier,
// une entrée globale, et des entrées volontairement piégeuses.
const DATASET = `
  resetApp();
  setDepth('pilot');
  const T = fmtTime(getDemoNow());
  const kTask = app.tasks.find((t) => t.projectId === 'keravel');
  const vTask = app.tasks.find((t) => t.projectId === 'villa');
  const hTask = app.tasks.find((t) => t.projectId === 'horizon');
  const tTask = app.tasks.find((t) => t.projectId === 'terrasses');
  app.history = [
    // 1. taskId seul → chantier dérivé
    { date: T, text: 'EVT-KERAVEL-TASKID', author: 'Eric', taskId: kTask.id },
    // 2. projectId seul → chantier explicite
    { date: T, text: 'EVT-VILLA-PROJECTID', author: 'Eric', projectId: 'villa' },
    // 3. aucun rattachement → globale
    { date: T, text: 'EVT-GLOBAL-SANS-RATTACHEMENT', author: 'Eric' },
    // 4. taskId invalide → non attribuable
    { date: T, text: 'EVT-TASKID-INVALIDE', author: 'Eric', taskId: 'tache-inexistante-xyz' },
    // 5. sourceTaskId seul (replanification en cascade)
    { date: T, text: 'EVT-HORIZON-SOURCETASKID', author: 'Eric', sourceTaskId: hTask.id },
    // 6. projectId + taskId (le plus robuste)
    { date: T, text: 'EVT-TERRASSES-COMPLET', author: 'Eric', projectId: 'terrasses', taskId: tTask.id },
    // 7. projectId inexistant → non attribuable
    { date: T, text: 'EVT-PROJECTID-INVALIDE', author: 'Eric', projectId: 'chantier-fantome' },
    // 8/9. MÊME TEXTE sur deux chantiers différents (§46)
    { date: T, text: 'EVT-TEXTE-IDENTIQUE', author: 'Eric', projectId: 'keravel' },
    { date: T, text: 'EVT-TEXTE-IDENTIQUE', author: 'Eric', projectId: 'villa' },
    // 10. entrée globale nommée « Modèle d'entreprise créé » (§18)
    { date: T, text: 'Modèle d’entreprise créé — Test', author: 'Eric' },
  ];
  save();
`;
const histOf = (p, pid) => ev(p, (id) => projectTabContent('Historique', id), pid);

// ---- SITE-01 : preuve avant / après ----
console.log('\n[SITE-01] Reproduction du défaut sur la baseline, puis correction');
{
  const before = await newPage(1440, 950, 'S01-before', BASELINE);
  await run(before.p, DATASET);
  const bRes = await ev(before.p, () => {
    const k = projectTabContent('Historique', 'keravel'), v = projectTabContent('Historique', 'villa');
    return { keravelLeaksVilla: /EVT-VILLA-PROJECTID/.test(k), identical: k === v, keravelShowsGlobal: /EVT-GLOBAL-SANS-RATTACHEMENT/.test(k) };
  });
  note('SITE-01', { baseline: 'v2.4.11.3', ...bRes });
  ok(bRes.keravelLeaksVilla && bRes.identical, 'SITE-01 : le défaut est bien REPRODUIT sur la baseline V2.4.11.3 (fuite + historiques identiques)', 'SITE-01');
  await before.ctx.close();

  const after = await newPage(1440, 950, 'S01-after');
  await run(after.p, DATASET);
  const aRes = await ev(after.p, () => {
    const k = projectTabContent('Historique', 'keravel'), v = projectTabContent('Historique', 'villa');
    return {
      keravelLeaksVilla: /EVT-VILLA-PROJECTID/.test(k),
      villaLeaksKeravel: /EVT-KERAVEL-TASKID/.test(v),
      identical: k === v,
      keravelShowsGlobal: /EVT-GLOBAL-SANS-RATTACHEMENT/.test(k),
      keravelShowsOwn: /EVT-KERAVEL-TASKID/.test(k),
    };
  });
  note('SITE-01', { cible: 'v2.4.12', ...aRes });
  ok(!aRes.keravelLeaksVilla, 'SITE-01 : plus aucune fuite Villa → Keravel', 'SITE-01');
  ok(!aRes.villaLeaksKeravel, 'SITE-01 : plus aucune fuite Keravel → Villa', 'SITE-01');
  ok(!aRes.identical, 'SITE-01 : les historiques de deux chantiers ne sont plus identiques', 'SITE-01');
  ok(!aRes.keravelShowsGlobal, 'SITE-01 : l’entrée globale n’apparaît pas dans la fiche chantier', 'SITE-01');
  ok(aRes.keravelShowsOwn, 'SITE-01 : le chantier montre bien ses propres événements', 'SITE-01');
  await after.ctx.close();
}

// ---- SITE-HIST-01/02/03 : isolation croisée ----
console.log('\n[SITE-HIST-01..03] Isolation croisée entre chantiers');
{
  const { ctx, p } = await newPage(1440, 950, 'H123');
  await run(p, DATASET);
  const k = await histOf(p, 'keravel'), v = await histOf(p, 'villa'), h = await histOf(p, 'horizon'), t = await histOf(p, 'terrasses');
  ok(/EVT-KERAVEL-TASKID/.test(k), 'SITE-HIST-01 : Keravel montre son événement', 'SITE-HIST-01');
  ok(!/EVT-VILLA-PROJECTID/.test(k), 'SITE-HIST-01 : Keravel ne montre PAS l’événement Villa', 'SITE-HIST-01');
  ok(/EVT-VILLA-PROJECTID/.test(v), 'SITE-HIST-02 : Villa montre son événement', 'SITE-HIST-02');
  ok(!/EVT-KERAVEL-TASKID/.test(v), 'SITE-HIST-02 : Villa ne montre PAS l’événement Keravel', 'SITE-HIST-02');
  ok(/EVT-TERRASSES-COMPLET/.test(t), 'SITE-HIST-03 : Les Terrasses montre son événement', 'SITE-HIST-03');
  ok(!/EVT-TERRASSES-COMPLET/.test(h), 'SITE-HIST-03 : Horizon ne montre PAS l’événement Les Terrasses', 'SITE-HIST-03');
  ok(/EVT-HORIZON-SOURCETASKID/.test(h), 'SITE-HIST-03 : Horizon montre l’événement dérivé de sourceTaskId', 'SITE-HIST-03');
  ok(!/EVT-HORIZON-SOURCETASKID/.test(t), 'SITE-HIST-03 : aucune fuite Horizon → Les Terrasses', 'SITE-HIST-03');
  await ctx.close();
}

// ---- SITE-HIST-04 : entrées globales absentes partout ----
console.log('\n[SITE-HIST-04] Entrées globales absentes de toutes les fiches');
{
  const { ctx, p } = await newPage(1440, 950, 'H04');
  await run(p, DATASET);
  const globals = ['EVT-GLOBAL-SANS-RATTACHEMENT', 'EVT-TASKID-INVALIDE', 'EVT-PROJECTID-INVALIDE', 'Modèle d’entreprise créé'];
  for (const pid of ['keravel', 'villa', 'horizon', 'terrasses']) {
    const html = await histOf(p, pid);
    ok(globals.every((g) => !html.includes(g)), `SITE-HIST-04 : aucune entrée globale dans « ${pid} »`, 'SITE-HIST-04');
  }
  const kept = await ev(p, () => app.history.length);
  ok(kept === 10, 'SITE-HIST-04 : les entrées globales sont CONSERVÉES dans app.history (aucune suppression, §5)', 'SITE-HIST-04');
  await ctx.close();
}

// ---- SITE-HIST-05 : dérivation via taskId seul ----
console.log('\n[SITE-HIST-05] Dérivation depuis taskId seul');
{
  const { ctx, p } = await newPage(1440, 950, 'H05');
  await run(p, DATASET);
  const r = await ev(p, () => {
    const kTask = app.tasks.find((t) => t.projectId === 'keravel');
    const entry = app.history.find((h) => h.text === 'EVT-KERAVEL-TASKID');
    return { hasProjectId: 'projectId' in entry, derived: historyProjectId(entry), taskProject: kTask.projectId };
  });
  note('SITE-HIST-05', r);
  ok(!r.hasProjectId, 'SITE-HIST-05 : l’entrée ne porte AUCUN projectId explicite', 'SITE-HIST-05');
  ok(r.derived === 'keravel', 'SITE-HIST-05 : historyProjectId() dérive « keravel » depuis la tâche', 'SITE-HIST-05');
  ok(!/EVT-KERAVEL-TASKID/.test(await histOf(p, 'villa')), 'SITE-HIST-05 : visible uniquement dans Keravel', 'SITE-HIST-05');
  await ctx.close();
}

// ---- SITE-HIST-06 : incident résolu via le vrai workflow ----
console.log('\n[SITE-HIST-06] setIssueStatus — vrai workflow');
{
  const { ctx, p } = await newPage(1440, 950, 'H06');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.history = []; save(); });
  await p.waitForTimeout(180);
  const meta = await ev(p, () => {
    const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved');
    setIssueStatus(i.id, 'resolved');
    const entry = app.history[0];
    return { title: i.title, issueProject: i.projectId, entryText: entry.text, entryProject: entry.projectId, entryTask: entry.taskId, derived: historyProjectId(entry) };
  });
  note('SITE-HIST-06', meta);
  ok(meta.entryProject === 'keravel', 'SITE-HIST-06 : l’entrée porte projectId=keravel (§14)', 'SITE-HIST-06');
  ok(meta.derived === 'keravel', 'SITE-HIST-06 : historyProjectId() la rattache à Keravel', 'SITE-HIST-06');
  const k = await histOf(p, 'keravel');
  ok(k.includes('résolu'), 'SITE-HIST-06 : l’événement apparaît dans l’historique Keravel', 'SITE-HIST-06');
  for (const pid of ['villa', 'horizon', 'terrasses']) {
    const html = await histOf(p, pid);
    ok(!html.includes(meta.title), `SITE-HIST-06 : absent de « ${pid} »`, 'SITE-HIST-06');
  }
  await ctx.close();
}

// ---- SITE-HIST-07 : simulation appliquée ----
console.log('\n[SITE-HIST-07] Simulation appliquée → chantier identifiable');
{
  const { ctx, p } = await newPage(1440, 950, 'H07');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot'); app.history = []; save();
    const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved' && x.taskId);
    const t = task(i.taskId);
    // Scénario minimal, sans toucher les moteurs : on décale la tâche source.
    const shift = (d) => { const x = date(d); x.setDate(x.getDate() + 2); return localDateTime(x); };
    app.simulation = { id: 'sim-test', label: 'Décalage de test', issueId: i.id, changes: [{ taskId: t.id, start: shift(t.start), end: shift(t.end) }] };
    applySimulation();
    const entry = app.history.find((h) => /Simulation/.test(h.text));
    return { entryText: entry?.text, entryProject: entry?.projectId, derived: entry ? historyProjectId(entry) : null, simCleared: app.simulation === null };
  });
  await p.waitForTimeout(220);
  note('SITE-HIST-07', r);
  ok(r.simCleared, 'SITE-HIST-07 : la simulation a bien été appliquée puis vidée', 'SITE-HIST-07');
  ok(r.entryProject === 'keravel', 'SITE-HIST-07 : l’entrée « Simulation … appliquée » porte projectId=keravel (§17)', 'SITE-HIST-07');
  ok(r.derived === 'keravel', 'SITE-HIST-07 : elle est rattachée au bon chantier', 'SITE-HIST-07');
  ok(/Simulation/.test(await histOf(p, 'keravel')), 'SITE-HIST-07 : visible dans l’historique Keravel', 'SITE-HIST-07');
  ok(!/Simulation/.test(await histOf(p, 'villa')), 'SITE-HIST-07 : absente de Villa du Port', 'SITE-HIST-07');
  // Scénario multi-chantiers → l'entrée reste globale (aucune attribution arbitraire)
  const multi = await ev(p, () => {
    app.history = [];
    // Tâches « todo » SANS successeur : un décalage vers l'aval reste valide et
    // ne déclenche ni arbitrage (doing) ni refus (tâche terminée).
    const free = (pid) => {
      const cands = app.tasks.filter((t) => t.projectId === pid && t.status !== 'doing' && t.status !== 'done');
      return cands.find((t) => !getTaskSuccessors(t.id).length) || cands[0];
    };
    const kT = free('keravel');
    const vT = free('villa');
    if (!kT || !vT) return { tasks: [kT?.id, vT?.id], applied: false, derived: 'setup impossible' };
    const shift = (d) => { const x = date(d); x.setDate(x.getDate() + 2); return localDateTime(x); };
    app.simulation = { id: 'sim-multi', label: 'Multi chantiers', changes: [
      { taskId: kT.id, start: shift(kT.start), end: shift(kT.end) },
      { taskId: vT.id, start: shift(vT.start), end: shift(vT.end) },
    ] };
    applySimulation();
    const entry = app.history.find((h) => /Simulation/.test(h.text));
    return {
      tasks: [kT?.id, vT?.id],
      applied: app.simulation === null,
      project: entry?.projectId,
      derived: entry ? historyProjectId(entry) : 'aucune entrée',
    };
  });
  note('SITE-HIST-07', { multi });
  ok(multi.applied, 'SITE-HIST-07 : le scénario multi-chantiers s’applique bien', 'SITE-HIST-07');
  ok(multi.project === undefined && multi.derived === null, 'SITE-HIST-07 : scénario multi-chantiers → entrée GLOBALE, aucune attribution arbitraire', 'SITE-HIST-07');
  await ctx.close();
}

// ---- SITE-HIST-08/09/10 : cycle de vie du chantier ----
console.log('\n[SITE-HIST-08..10] active → closed → archived → restore → reopen');
{
  const { ctx, p } = await newPage(1440, 950, 'H8910');
  await run(p, DATASET);
  const baseline = await histOf(p, 'keravel');
  const countRows = (html) => (html.match(/class="row"/g) || []).length;
  const n0 = countRows(baseline);
  ok(n0 > 0, 'SITE-HIST-08 : historique Keravel non vide en état actif (§26)', 'SITE-HIST-08');

  // Clôture
  const closed = await ev(p, () => { const p0 = project('keravel'); p0.lifecycle = 'closed'; save(); return projectLifecycle('keravel'); });
  ok(closed === 'closed', 'SITE-HIST-08 : Keravel est clôturé', 'SITE-HIST-08');
  const hClosed = await histOf(p, 'keravel');
  ok(countRows(hClosed) === n0, 'SITE-HIST-08 : historique conservé et toujours filtré en état clôturé (§27)', 'SITE-HIST-08');
  ok(!/EVT-VILLA-PROJECTID/.test(hClosed), 'SITE-HIST-08 : aucune fuite sur un chantier clôturé', 'SITE-HIST-08');

  // Archivage
  await ev(p, () => { project('keravel').lifecycle = 'archived'; save(); });
  const hArch = await histOf(p, 'keravel');
  ok(countRows(hArch) === n0, 'SITE-HIST-09 : même timeline en état archivé (§28)', 'SITE-HIST-09');
  ok(hArch === hClosed, 'SITE-HIST-09 : rendu strictement identique closed / archived — aucune duplication', 'SITE-HIST-09');

  // Restauration puis réouverture
  await ev(p, () => { project('keravel').lifecycle = 'closed'; save(); });
  const hRestored = await histOf(p, 'keravel');
  await ev(p, () => { project('keravel').lifecycle = 'active'; save(); });
  const hReopened = await histOf(p, 'keravel');
  ok(hRestored === hClosed, 'SITE-HIST-10 : restauration → timeline inchangée (§30)', 'SITE-HIST-10');
  ok(countRows(hReopened) === n0, 'SITE-HIST-10 : réouverture → une seule timeline, aucune duplication (§29)', 'SITE-HIST-10');
  ok(!/EVT-VILLA-PROJECTID/.test(hReopened), 'SITE-HIST-10 : toujours aucune fuite après le cycle complet', 'SITE-HIST-10');
  await ctx.close();
}

// ---- TASK-HIST-01..03 : fiche tâche ----
console.log('\n[TASK-HIST-01..03] Fiche tâche — une seule timeline');
{
  const { ctx, p } = await newPage(1440, 950, 'TH');
  await run(p, DATASET);
  const r = await ev(p, () => {
    const kTasks = app.tasks.filter((t) => t.projectId === 'keravel');
    const t1 = kTasks[0], t2 = kTasks[1];
    const T = fmtTime(getDemoNow());
    app.history.unshift({ date: T, text: 'EVT-AUTRE-TACHE-MEME-CHANTIER', author: 'Eric', taskId: t2.id });
    save();
    openTask(t1.id);
    const html = document.querySelector('#drawerContent').innerHTML;
    return {
      t1: t1.id, t2: t2.id,
      hasSuivi: /Suivi de la tâche/.test(html),
      sectionsHistorique: (html.match(/section-title">Historique</g) || []).length,
      showsOwn: /EVT-KERAVEL-TASKID/.test(html),
      showsOtherTask: /EVT-AUTRE-TACHE-MEME-CHANTIER/.test(html),
      showsVilla: /EVT-VILLA-PROJECTID/.test(html),
      showsGlobal: /EVT-GLOBAL-SANS-RATTACHEMENT/.test(html),
    };
  });
  note('TASK-HIST', r);
  ok(r.hasSuivi, 'TASK-HIST-01 : la fiche tâche conserve « Suivi de la tâche »', 'TASK-HIST-01');
  ok(r.sectionsHistorique === 0, 'TASK-HIST-01 : aucune seconde section « Historique » globale (§10/§11)', 'TASK-HIST-01');
  ok(r.showsOwn, 'TASK-HIST-01 : les événements de CETTE tâche sont présents', 'TASK-HIST-01');
  ok(!r.showsOtherTask, 'TASK-HIST-02 : l’événement d’une autre tâche du même chantier n’apparaît pas', 'TASK-HIST-02');
  ok(!r.showsVilla, 'TASK-HIST-03 : aucune trace d’un autre chantier', 'TASK-HIST-03');
  ok(!r.showsGlobal, 'TASK-HIST-03 : aucune entrée globale dans la fiche tâche', 'TASK-HIST-03');
  await p.screenshot({ path: SHOTS + '03-fiche-tache.png', fullPage: true });
  await ctx.close();
}

// ---- HIST-CROSS : dataset croisé A/B (§45) ----
console.log('\n[HIST-CROSS] Dataset croisé Projet A / Projet B');
{
  const { ctx, p } = await newPage(1440, 950, 'CROSS');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    const a1 = app.tasks.filter((t) => t.projectId === 'keravel')[0];
    const a2 = app.tasks.filter((t) => t.projectId === 'keravel')[1];
    const b1 = app.tasks.filter((t) => t.projectId === 'villa')[0];
    app.history = [
      { date: T, text: 'A1 modifiée', author: 'Eric', taskId: a1.id },
      { date: T, text: 'A2 terminée', author: 'Eric', taskId: a2.id },
      { date: T, text: 'B1 modifiée', author: 'Eric', taskId: b1.id },
      { date: T, text: 'Entrée globale', author: 'Eric' },
    ];
    save();
    const hA = projectTabContent('Historique', 'keravel');
    const hB = projectTabContent('Historique', 'villa');
    openTask(a1.id);
    const fiche = document.querySelector('#drawerContent').innerHTML;
    return {
      A: ['A1 modifiée', 'A2 terminée', 'B1 modifiée', 'Entrée globale'].map((x) => hA.includes(x)),
      B: ['A1 modifiée', 'A2 terminée', 'B1 modifiée', 'Entrée globale'].map((x) => hB.includes(x)),
      fiche: ['A1 modifiée', 'A2 terminée', 'B1 modifiée', 'Entrée globale'].map((x) => fiche.includes(x)),
    };
  });
  note('HIST-CROSS', r);
  ok(JSON.stringify(r.A) === JSON.stringify([true, true, false, false]), 'HIST-CROSS : Historique Projet A = A1 + A2 seulement', 'HIST-CROSS');
  ok(JSON.stringify(r.B) === JSON.stringify([false, false, true, false]), 'HIST-CROSS : Historique Projet B = B1 seulement', 'HIST-CROSS');
  ok(JSON.stringify(r.fiche) === JSON.stringify([true, false, false, false]), 'HIST-CROSS : Fiche tâche A1 = A1 seulement', 'HIST-CROSS');
  await ctx.close();
}

// ---- HIST-NAME : noms proches + texte identique (§31/§46) ----
console.log('\n[HIST-NAME] Noms proches et textes identiques');
{
  const { ctx, p } = await newPage(1440, 950, 'NAME');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    const src = project('keravel');
    // Chantier au nom volontairement très proche.
    app.projects.push({ ...structuredClone(src), id: 'keravel-ext', name: 'Résidence Keravel Extension' });
    const kTask = app.tasks.filter((t) => t.projectId === 'keravel')[0];
    app.tasks.push({ ...structuredClone(kTask), id: 'kext-1', projectId: 'keravel-ext', name: 'Tache extension', deps: [] });
    app.history = [
      { date: T, text: 'Intervention sur Résidence Keravel', author: 'Eric', projectId: 'keravel' },
      { date: T, text: 'Intervention sur Résidence Keravel', author: 'Eric', projectId: 'keravel-ext' },
      { date: T, text: 'MEME-TEXTE-EXACT', author: 'Eric', taskId: kTask.id },
      { date: T, text: 'MEME-TEXTE-EXACT', author: 'Eric', taskId: 'kext-1' },
    ];
    save();
    const hK = projectTabContent('Historique', 'keravel');
    const hE = projectTabContent('Historique', 'keravel-ext');
    const rows = (h) => (h.match(/class="row"/g) || []).length;
    // Les deux chantiers portent volontairement des textes IDENTIQUES : le HTML
    // rendu est donc légitimement identique. Ce qui doit différer, ce sont les
    // ENTRÉES rattachées — on les compare par identité d'objet.
    const idx = (pid) => projectHistory(pid).map((h) => app.history.indexOf(h));
    return {
      kRows: rows(hK), eRows: rows(hE),
      kIdx: idx('keravel'), eIdx: idx('keravel-ext'),
      bothHaveText: hK.includes('MEME-TEXTE-EXACT') && hE.includes('MEME-TEXTE-EXACT'),
    };
  });
  note('HIST-NAME', r);
  ok(r.kRows === 2 && r.eRows === 2, 'HIST-NAME : chaque chantier ne voit QUE ses 2 entrées, malgré des noms quasi identiques (§31)', 'HIST-NAME');
  ok(JSON.stringify(r.kIdx) === JSON.stringify([0, 2]) && JSON.stringify(r.eIdx) === JSON.stringify([1, 3]), 'HIST-NAME : chaque chantier récupère SES entrées (indices disjoints), pas celles du voisin', 'HIST-NAME');
  ok(r.bothHaveText, 'HIST-NAME : un texte strictement identique apparaît dans chaque chantier séparément (§46 — pas de filtre textuel)', 'HIST-NAME');
  await ctx.close();
}

// ---- HIST-DEL : tâche supprimée, projectId conservé (§22/§47) ----
console.log('\n[HIST-DEL] Tâche supprimée — attribution préservée par projectId');
{
  const { ctx, p } = await newPage(1440, 950, 'DEL');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    const t = app.tasks.filter((x) => x.projectId === 'keravel' && x.status !== 'done')[0];
    app.history = [
      { date: T, text: 'EVT-ROBUSTE', author: 'Eric', projectId: 'keravel', taskId: t.id },
      { date: T, text: 'EVT-FRAGILE', author: 'Eric', taskId: t.id },
    ];
    save();
    const avant = { robuste: historyProjectId(app.history[0]), fragile: historyProjectId(app.history[1]) };
    // Suppression de la tâche (hors moteur : simple retrait pour le test)
    app.tasks = app.tasks.filter((x) => x.id !== t.id);
    save();
    const apres = { robuste: historyProjectId(app.history[0]), fragile: historyProjectId(app.history[1]) };
    const h = projectTabContent('Historique', 'keravel');
    return { avant, apres, showsRobuste: h.includes('EVT-ROBUSTE'), showsFragile: h.includes('EVT-FRAGILE') };
  });
  note('HIST-DEL', r);
  ok(r.avant.robuste === 'keravel' && r.avant.fragile === 'keravel', 'HIST-DEL : avant suppression, les deux entrées sont rattachées', 'HIST-DEL');
  ok(r.apres.robuste === 'keravel', 'HIST-DEL : après suppression, projectId préserve la traçabilité (§22)', 'HIST-DEL');
  ok(r.apres.fragile === null, 'HIST-DEL : une entrée taskId seul devient non attribuable — jamais rattachée arbitrairement', 'HIST-DEL');
  ok(r.showsRobuste && !r.showsFragile, 'HIST-DEL : seule l’entrée attribuable reste affichée', 'HIST-DEL');
  await ctx.close();
}

// ---- HIST-PURE : pureté du filtre (§48) ----
console.log('\n[HIST-PURE] Pureté des fonctions de filtre');
{
  const { ctx, p } = await newPage(1440, 950, 'PURE');
  await run(p, DATASET);
  const r = await ev(p, () => {
    const snap = () => JSON.stringify({ history: app.history, tasks: app.tasks.map((t) => t.id + t.status), projects: app.projects.map((x) => x.id + projectLifecycle(x)) });
    const before = snap();
    historyHTML({ projectId: 'keravel' });
    historyHTML({ projectId: 'villa' });
    historyHTML();
    projectHistory('horizon');
    app.history.forEach((h) => historyProjectId(h));
    const after = snap();
    return {
      pure: before === after,
      order: projectHistory('keravel').map((h) => app.history.indexOf(h)),
      globalStillFull: historyHTML().split('class="row"').length - 1,
      total: app.history.length,
    };
  });
  note('HIST-PURE', r);
  ok(r.pure, 'HIST-PURE : historyHTML / projectHistory / historyProjectId ne modifient rien (§48)', 'HIST-PURE');
  ok(JSON.stringify(r.order) === JSON.stringify([...r.order].sort((a, b) => a - b)), 'HIST-PURE : l’ordre de app.history est préservé (plus récent en tête, §24)', 'HIST-PURE');
  ok(r.globalStillFull === r.total, 'HIST-PURE : sans options, historyHTML() rend toujours l’historique complet', 'HIST-PURE');
  await ctx.close();
}

// ---- HIST-EMPTY : état vide (§9) ----
console.log('\n[HIST-EMPTY] État vide');
{
  const { ctx, p } = await newPage(1440, 950, 'EMPTY');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    app.history = [
      { date: T, text: 'EVT-VILLA', author: 'Eric', projectId: 'villa' },
      { date: T, text: 'EVT-GLOBAL', author: 'Eric' },
    ];
    save();
    const h = projectTabContent('Historique', 'keravel');
    return { empty: /Aucune modification récente/.test(h), rows: (h.match(/class="row"/g) || []).length, leak: /EVT-VILLA|EVT-GLOBAL/.test(h) };
  });
  note('HIST-EMPTY', r);
  ok(r.empty, 'HIST-EMPTY : « Aucune modification récente. » quand le chantier n’a aucun événement', 'HIST-EMPTY');
  ok(r.rows === 0 && !r.leak, 'HIST-EMPTY : la zone n’est JAMAIS remplie avec des événements d’autres chantiers (§9)', 'HIST-EMPTY');
  await ctx.close();
}

// ---- HIST-LEVELS : Essentiel vs Pilotage (§52/§53) ----
console.log('\n[HIST-LEVELS] Essentiel / Pilotage');
{
  const { ctx, p } = await newPage(1440, 950, 'LVL');
  await run(p, DATASET);
  const r = await ev(p, () => {
    setDepth('essential');
    app.ui.projectId = 'keravel'; go('project');
    const essential = document.querySelector('.main').innerText;
    setDepth('pilot');
    app.ui.projectId = 'keravel'; go('project');
    const pilot = document.querySelector('.main').innerText;
    return { essentialHasTab: /Historique/.test(essential), pilotHasTab: /Historique/.test(pilot) };
  });
  note('HIST-LEVELS', r);
  ok(!r.essentialHasTab, 'HIST-LEVELS : l’onglet Historique reste absent en Essentiel (§52)', 'HIST-LEVELS');
  ok(r.pilotHasTab, 'HIST-LEVELS : l’onglet Historique est présent en Pilotage (§53)', 'HIST-LEVELS');
  await ctx.close();
}

// ---- HIST-PERF : 1000 entrées, 30 chantiers (§49) ----
console.log('\n[HIST-PERF] 1000 entrées / 30 chantiers');
{
  const { ctx, p } = await newPage(1440, 950, 'PERF');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    const src = project('keravel'), srcTask = app.tasks.filter((t) => t.projectId === 'keravel')[0];
    for (let i = 0; i < 30; i++) {
      const pid = 'perf-' + i;
      app.projects.push({ ...structuredClone(src), id: pid, name: 'Chantier perf ' + i });
      app.tasks.push({ ...structuredClone(srcTask), id: 'perf-t-' + i, projectId: pid, name: 'Tache perf ' + i, deps: [] });
    }
    app.history = [];
    for (let i = 0; i < 1000; i++) {
      const k = i % 30;
      app.history.push(i % 7 === 0
        ? { date: T, text: 'Evenement global ' + i, author: 'Eric' }
        : { date: T, text: 'Evenement ' + i, author: 'Eric', taskId: 'perf-t-' + k });
    }
    save();
    const t0 = performance.now();
    const html = projectTabContent('Historique', 'perf-7');
    const ms = performance.now() - t0;
    const expected = app.history.filter((h) => h.taskId === 'perf-t-7').length;
    return { ms: Math.round(ms), rows: (html.match(/class="row"/g) || []).length, expected, total: app.history.length, projects: app.projects.length };
  });
  note('HIST-PERF', r);
  ok(r.rows === r.expected, 'HIST-PERF : filtrage exact sur 1000 entrées / 30 chantiers', 'HIST-PERF');
  ok(r.ms < 300, `HIST-PERF : rendu fluide (${r.ms} ms, seuil 300 ms)`, 'HIST-PERF');
  await ctx.close();
}

// ---- HIST-DARK : mode sombre (§50) ----
console.log('\n[HIST-DARK] Dark mode');
{
  const { ctx, p } = await newPage(1440, 950, 'DARK');
  await run(p, DATASET);
  const r = await ev(p, () => {
    app.settings.theme = 'dark'; document.body.classList.add('dark');
    app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique');
    const sec = document.querySelector('.main .section');
    const row = document.querySelector('.main .section .row');
    return {
      dark: document.body.classList.contains('dark'),
      hasRows: !!row,
      fg: row ? getComputedStyle(row.querySelector('b')).color : null,
      bg: sec ? getComputedStyle(sec).backgroundColor : null,
      leak: /EVT-VILLA-PROJECTID/.test(document.querySelector('.main').innerText),
    };
  });
  await p.waitForTimeout(200);
  note('HIST-DARK', r);
  ok(r.dark && r.hasRows, 'HIST-DARK : historique chantier rendu en mode sombre', 'HIST-DARK');
  ok(!r.leak, 'HIST-DARK : filtrage toujours effectif en sombre', 'HIST-DARK');
  await p.screenshot({ path: SHOTS + '04-historique-dark.png', fullPage: true });
  await ctx.close();
}

// ---- HIST-RESP : responsive (§51) ----
console.log('\n[HIST-RESP] Responsive');
{
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 950, 'RESP-' + w);
    await run(p, DATASET);
    const r = await ev(p, () => {
      app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique');
      const main = document.querySelector('.main');
      let overflow = 0;
      main.querySelectorAll('.section .row').forEach((row) => {
        if (row.getBoundingClientRect().right > main.getBoundingClientRect().right + 1) overflow++;
      });
      return {
        rows: main.querySelectorAll('.section .row').length,
        overflow,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        leak: /EVT-VILLA-PROJECTID/.test(main.innerText),
      };
    });
    note('HIST-RESP', { w, ...r });
    ok(r.rows > 0, `HIST-RESP : ${w}px — l’historique est rendu`, 'HIST-RESP');
    ok(r.overflow === 0 && !r.hscroll, `HIST-RESP : ${w}px — aucun débordement ni scroll horizontal`, 'HIST-RESP');
    ok(!r.leak, `HIST-RESP : ${w}px — aucune fuite inter-chantiers`, 'HIST-RESP');
    if (w === 390) await p.screenshot({ path: SHOTS + '05-mobile-390.png', fullPage: true });
    await ctx.close();
  }
}

// ---- HIST-LEGACY : anciennes entrées localStorage (§62) ----
console.log('\n[HIST-LEGACY] Anciennes entrées localStorage');
{
  const { ctx, p } = await newPage(1440, 950, 'LEG');
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    const T = fmtTime(getDemoNow());
    const kTask = app.tasks.filter((t) => t.projectId === 'keravel')[0];
    app.history = [
      { date: T, text: 'LEGACY-1-TASKID', author: 'Eric', taskId: kTask.id },
      { date: T, text: 'LEGACY-2-PROJECTID', author: 'Eric', projectId: 'villa' },
      { date: T, text: 'LEGACY-3-AUCUN', author: 'Eric' },
      { date: T, text: 'LEGACY-4-TASKID-INVALIDE', author: 'Eric', taskId: 'zzz-inexistant' },
    ];
    save();
  });
  // Rechargement complet : l'historique repasse par localStorage + migrations
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(300);
  const r = await ev(p, () => ({
    schema: SCHEMA_VERSION,
    survived: app.history.length,
    resolved: app.history.map((h) => ({ text: h.text, pid: historyProjectId(h) })),
    keravel: projectTabContent('Historique', 'keravel'),
    villa: projectTabContent('Historique', 'villa'),
  }));
  note('HIST-LEGACY', { schema: r.schema, survived: r.survived, resolved: r.resolved });
  ok(r.survived === 4, 'HIST-LEGACY : les 4 entrées survivent au rechargement (aucune migration destructive, §20)', 'HIST-LEGACY');
  ok(r.resolved[0].pid === 'keravel', 'HIST-LEGACY : 1 — taskId seul → chantier dérivé', 'HIST-LEGACY');
  ok(r.resolved[1].pid === 'villa', 'HIST-LEGACY : 2 — projectId seul → chantier explicite', 'HIST-LEGACY');
  ok(r.resolved[2].pid === null, 'HIST-LEGACY : 3 — sans rattachement → globale', 'HIST-LEGACY');
  ok(r.resolved[3].pid === null, 'HIST-LEGACY : 4 — taskId invalide → non attribuable, jamais injectée arbitrairement', 'HIST-LEGACY');
  ok(/LEGACY-1-TASKID/.test(r.keravel) && !/LEGACY-2|LEGACY-3|LEGACY-4/.test(r.keravel), 'HIST-LEGACY : fiche Keravel = uniquement l’entrée 1', 'HIST-LEGACY');
  ok(/LEGACY-2-PROJECTID/.test(r.villa) && !/LEGACY-1|LEGACY-3|LEGACY-4/.test(r.villa), 'HIST-LEGACY : fiche Villa = uniquement l’entrée 2', 'HIST-LEGACY');
  ok(r.schema === 8, 'HIST-LEGACY : SCHEMA_VERSION inchangé (8), aucune migration ajoutée (§61)', 'HIST-LEGACY');
  await ctx.close();
}

// ---- HIST-SCOPE : périmètre, aucune nouvelle page ni collection (§1/§54) ----
console.log('\n[HIST-SCOPE] Périmètre');
{
  const { ctx, p } = await newPage(1440, 950, 'SCOPE');
  await run(p, DATASET);
  const r = await ev(p, () => ({
    noNewCollections: !('projectHistory' in app) && !('taskHistory' in app) && !('globalHistory' in app),
    singleSource: Array.isArray(app.history),
    navItems: [...document.querySelectorAll('.sidebar nav a, .sidebar nav button')].map((x) => x.innerText.trim()),
    store: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
    schema: SCHEMA_VERSION,
  }));
  note('HIST-SCOPE', r);
  ok(r.noNewCollections, 'HIST-SCOPE : aucune collection app.projectHistory / taskHistory / globalHistory (§1)', 'HIST-SCOPE');
  ok(r.singleSource, 'HIST-SCOPE : app.history reste la source unique', 'HIST-SCOPE');
  ok(!r.navItems.some((x) => /^Historique/i.test(x)), 'HIST-SCOPE : aucune page « Historique » ajoutée au menu (§54)', 'HIST-SCOPE');
  ok(r.store.every((k) => k === 'kanvix-product-8-3') && r.schema === 8, 'HIST-SCOPE : STORE et SCHEMA_VERSION inchangés (§61)', 'HIST-SCOPE');
  await ctx.close();
}

// ---- Captures principales ----
console.log('\n[CAPTURES]');
{
  const { ctx, p } = await newPage(1440, 1000, 'SHOT');
  await run(p, DATASET);
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project'); openProjectTab('keravel', 'Historique'); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '01-keravel-historique.png', fullPage: true });
  await ev(p, () => { app.ui.projectId = 'villa'; go('project'); openProjectTab('villa', 'Historique'); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '02-villa-historique.png', fullPage: true });
  ok(true, 'CAPTURES : Keravel et Villa capturés', 'CAPTURES');
  await ctx.close();
}

// ---- CONSOLE ----
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
