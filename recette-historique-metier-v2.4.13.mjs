// ============================================================
// KANVIX — Recette historique métier structuré (V2.4.13)
//   Usage : node recette-historique-metier-v2.4.13.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-11T08:43:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.13.html' + NOW;
const BASELINE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.12.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-historique-metier-v2.4.13/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
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
const openHist = async (p) => { await ev(p, () => { app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique'); }); await p.waitForTimeout(260); };
// Lit la timeline : titre, transition, sous-titre, auteur, bouton.
const readTimeline = (p) => ev(p, () => [...document.querySelectorAll('.history-event')].map((e) => ({
  title: e.querySelector('.history-event-title').textContent.trim(),
  from: e.querySelector('.hs-chip:not(.hs-to)')?.textContent.trim() || null,
  to: e.querySelector('.hs-chip.hs-to')?.textContent.trim() || null,
  sub: e.querySelector('.history-event-sub')?.textContent.trim() || null,
  author: e.querySelector('.history-event-meta').textContent.trim(),
  btn: !!e.querySelector('.history-task-link'),
  time: e.querySelector('.history-time').textContent.trim(),
})));
// Drag Kanban RÉEL (dragstart → dragover → drop sur les handlers de l'app).
const realDrag = (p, taskName, targetStatus) => ev(p, ({ n, st }) => {
  const card = [...document.querySelectorAll('.kanban-card')].find((c) => c.querySelector('b').textContent.trim() === n);
  const col = document.querySelector(`.kanban-col[data-status="${st}"]`);
  if (!card || !col) return { ok: false };
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  return { ok: true, id: dt.getData('text/plain') };
}, { n: taskName, st: targetStatus });

const RESET = `resetApp(); setDepth('pilot'); app.history = []; save();`;

// ---- STATUS-HIST-01 : entrée structurée ----
console.log('\n[STATUS-HIST-01] Entrée task-status structurée');
{
  const { ctx, p } = await newPage(1440, 1000, 'S01');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    return app.history[0];
  }, RESET);
  note('STATUS-HIST-01', r);
  ok(r.eventType === 'task-status', 'STATUS-HIST-01 : eventType = "task-status"', 'STATUS-HIST-01');
  ok(r.taskName === 'Tableau électrique', 'STATUS-HIST-01 : taskName mémorisé', 'STATUS-HIST-01');
  ok(r.fromStatus === 'todo' && r.toStatus === 'doing', 'STATUS-HIST-01 : fromStatus = todo, toStatus = doing', 'STATUS-HIST-01');
  ok(r.projectId === 'keravel' && r.taskId === 'k-electric', 'STATUS-HIST-01 : projectId ET taskId présents (§33)', 'STATUS-HIST-01');
  ok(r.origin === 'task' && typeof r.author === 'string', 'STATUS-HIST-01 : origin et author conservés', 'STATUS-HIST-01');
  ok(Array.isArray(r.changes) && r.changes[0].field === 'Statut' && r.changes[0].from === 'À faire' && r.changes[0].to === 'En cours', 'STATUS-HIST-01 : changes[] « Statut : À faire → En cours » (§2)', 'STATUS-HIST-01');
  ok(typeof r.text === 'string' && r.text.length > 0, 'STATUS-HIST-01 : text legacy conservé pour compatibilité (§3)', 'STATUS-HIST-01');
  await ctx.close();
}

// ---- STATUS-HIST-02/03 : rendu de la transition ----
console.log('\n[STATUS-HIST-02/03] Rendu « À faire → En cours » puis retour');
{
  const { ctx, p } = await newPage(1440, 1000, 'S02');
  await ev(p, (src) => { (0, eval)(src); task('k-electric').status = 'todo'; save(); setTaskStatus('k-electric', 'doing', 'task'); }, RESET);
  await openHist(p);
  let t = await readTimeline(p);
  note('STATUS-HIST-02', t[0]);
  ok(t[0].title === 'Tableau électrique', 'STATUS-HIST-02 : titre = nom de la tâche (pas « · commencée »)', 'STATUS-HIST-02');
  ok(t[0].from === 'À faire' && t[0].to === 'En cours', 'STATUS-HIST-02 : transition « À faire → En cours » affichée', 'STATUS-HIST-02');
  ok(!/commencée/.test(t[0].title), 'STATUS-HIST-02 : le texte legacy n’est plus l’information principale', 'STATUS-HIST-02');

  await ev(p, () => { setTaskStatus('k-electric', 'todo', 'task'); });
  await openHist(p);
  t = await readTimeline(p);
  note('STATUS-HIST-03', t[0]);
  ok(t[0].from === 'En cours' && t[0].to === 'À faire', 'STATUS-HIST-03 : transition « En cours → À faire »', 'STATUS-HIST-03');
  await ctx.close();
}

// ---- STATUS-HIST-04 : 3 transitions, aucune fusion ----
console.log('\n[STATUS-HIST-04] todo→doing→todo→doing : 3 événements distincts');
{
  const { ctx, p } = await newPage(1440, 1000, 'S04');
  await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-electric', 'todo', 'task');
    setTaskStatus('k-electric', 'doing', 'task');
  }, RESET);
  await openHist(p);
  const t = await readTimeline(p);
  const status = t.filter((x) => x.from && x.to);
  note('STATUS-HIST-04', status.map((x) => `${x.from} → ${x.to}`));
  ok(status.length === 3, 'STATUS-HIST-04 : exactement 3 événements de statut — aucune fusion (§21)', 'STATUS-HIST-04');
  ok(JSON.stringify(status.map((x) => x.from + '>' + x.to)) === JSON.stringify(['À faire>En cours', 'En cours>À faire', 'À faire>En cours']), 'STATUS-HIST-04 : plus récent en haut, séquence complète lisible', 'STATUS-HIST-04');
  ok(status.every((x) => x.title === 'Tableau électrique'), 'STATUS-HIST-04 : même titre, transitions différentes — la répétition devient compréhensible', 'STATUS-HIST-04');
  await p.screenshot({ path: SHOTS + '01-trois-transitions.png', fullPage: true });
  await ctx.close();
}

// ---- STATUS-HIST-05 : no-op strict ----
console.log('\n[STATUS-HIST-05] No-op : doing → doing ne produit rien');
{
  const { ctx, p } = await newPage(1440, 1000, 'S05');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    const before = {
      history: app.history.length, undo: app.undoStack.length,
      issues: app.issues.length, messages: app.messages.length,
      state: JSON.stringify(app.tasks.map((t) => t.id + t.status)),
    };
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-electric', 'doing', 'kanban');
    setTaskStatus('k-electric', 'doing', 'manual-edit', { manual: true });
    const after = {
      history: app.history.length, undo: app.undoStack.length,
      issues: app.issues.length, messages: app.messages.length,
      state: JSON.stringify(app.tasks.map((t) => t.id + t.status)),
    };
    return { before, after };
  }, RESET);
  note('STATUS-HIST-05', r);
  ok(r.after.history === r.before.history, 'STATUS-HIST-05 : 0 nouvelle entrée d’historique', 'STATUS-HIST-05');
  ok(r.after.undo === r.before.undo, 'STATUS-HIST-05 : 0 snapshot Undo supplémentaire', 'STATUS-HIST-05');
  ok(r.after.issues === r.before.issues, 'STATUS-HIST-05 : 0 incident créé', 'STATUS-HIST-05');
  ok(r.after.messages === r.before.messages, 'STATUS-HIST-05 : 0 notification / message', 'STATUS-HIST-05');
  ok(r.after.state === r.before.state, 'STATUS-HIST-05 : aucun statut modifié', 'STATUS-HIST-05');
  await ctx.close();
}

// ---- STATUS-HIST-06 : done terminal ----
console.log('\n[STATUS-HIST-06] done → done et done → todo');
{
  const { ctx, p } = await newPage(1440, 1000, 'S06');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'done', 'task');
    const base = { history: app.history.length, undo: app.undoStack.length, status: task('k-electric').status };
    setTaskStatus('k-electric', 'done', 'task');
    const sameAgain = { history: app.history.length, undo: app.undoStack.length, status: task('k-electric').status };
    setTaskStatus('k-electric', 'todo', 'task');
    const reopen = { history: app.history.length, undo: app.undoStack.length, status: task('k-electric').status };
    return { base, sameAgain, reopen, lastEvent: app.history[0] };
  }, RESET);
  note('STATUS-HIST-06', { base: r.base, sameAgain: r.sameAgain, reopen: r.reopen });
  ok(r.lastEvent.fromStatus === 'todo' && r.lastEvent.toStatus === 'done', 'STATUS-HIST-06 : la transition vers Terminée est enregistrée', 'STATUS-HIST-06');
  ok(r.sameAgain.history === r.base.history && r.sameAgain.undo === r.base.undo, 'STATUS-HIST-06 : done → done ne produit rien', 'STATUS-HIST-06');
  ok(r.reopen.history === r.base.history && r.reopen.status === 'done', 'STATUS-HIST-06 : done → todo refusé, aucune entrée, tâche toujours terminée (§5)', 'STATUS-HIST-06');
  await ctx.close();
}

// ---- STATUS-HIST-07/08 : drag Kanban réel, aller et retour ----
console.log('\n[STATUS-HIST-07/08] Drag Kanban réel');
{
  const { ctx, p } = await newPage(1440, 1100, 'S078');
  await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo';
    app.settings.period = 'month'; app.ui.planningProject = 'keravel';
    save(); go('planning'); setPlanningView('kanban');
  }, RESET);
  await p.waitForTimeout(280);
  const d1 = await realDrag(p, 'Tableau électrique', 'doing');
  await p.waitForTimeout(280);
  const e1 = await ev(p, () => app.history[0]);
  note('STATUS-HIST-07', { drag: d1, entry: { eventType: e1.eventType, from: e1.fromStatus, to: e1.toStatus, origin: e1.origin } });
  ok(d1.ok && d1.id === 'k-electric', 'STATUS-HIST-07 : drag réel dispatché sur les handlers de l’app', 'STATUS-HIST-07');
  ok(e1.eventType === 'task-status' && e1.fromStatus === 'todo' && e1.toStatus === 'doing', 'STATUS-HIST-07 : 1 entrée structurée « À faire → En cours »', 'STATUS-HIST-07');
  ok(e1.origin === 'kanban', 'STATUS-HIST-07 : origin = kanban conservé (§16)', 'STATUS-HIST-07');

  const before = await ev(p, () => app.history.length);
  const d2 = await realDrag(p, 'Tableau électrique', 'todo');
  await p.waitForTimeout(280);
  const e2 = await ev(p, () => ({ entry: app.history[0], count: app.history.length }));
  note('STATUS-HIST-08', { from: e2.entry.fromStatus, to: e2.entry.toStatus, added: e2.count - before });
  ok(d2.ok && e2.count > before, 'STATUS-HIST-08 : le drag retour crée bien une nouvelle entrée (§20)', 'STATUS-HIST-08');
  ok(e2.entry.fromStatus === 'doing' && e2.entry.toStatus === 'todo', 'STATUS-HIST-08 : « En cours → À faire »', 'STATUS-HIST-08');
  await openHist(p);
  await p.screenshot({ path: SHOTS + '02-drag-kanban.png', fullPage: true });
  await ctx.close();
}

// ---- STATUS-HIST-09 : édition manuelle ----
console.log('\n[STATUS-HIST-09] Édition manuelle (opts.manual)');
{
  const { ctx, p } = await newPage(1440, 1000, 'S09');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'manual-edit', { manual: true });
    return app.history[0];
  }, RESET);
  await openHist(p);
  const t = await readTimeline(p);
  note('STATUS-HIST-09', { entry: { manual: r.manual, fromField: r.fromField, origin: r.origin }, ui: t[0] });
  ok(r.manual === true && r.fromField === false, 'STATUS-HIST-09 : manual = true, fromField = false', 'STATUS-HIST-09');
  ok(t[0].from === 'À faire' && t[0].to === 'En cours', 'STATUS-HIST-09 : transition structurée exacte', 'STATUS-HIST-09');
  ok(t[0].sub === 'Statut modifié manuellement', 'STATUS-HIST-09 : précision secondaire « Statut modifié manuellement » (§18)', 'STATUS-HIST-09');
  ok(!/terrain/i.test(JSON.stringify(t[0])), 'STATUS-HIST-09 : aucun faux « sur le terrain »', 'STATUS-HIST-09');
  await ctx.close();
}

// ---- STATUS-HIST-10 : démarrage terrain réel ----
console.log('\n[STATUS-HIST-10] Démarrage terrain (artisan)');
{
  const { ctx, p } = await newPage(430, 900, 'S10');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    app.settings.role = 'artisan';
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'field');
    return { entry: app.history[0], resource: resourceLabel(task('k-electric').resourceId) };
  }, RESET);
  note('STATUS-HIST-10', { entry: { fromField: r.entry.fromField, author: r.entry.author, from: r.entry.fromStatus, to: r.entry.toStatus }, resource: r.resource });
  ok(r.entry.eventType === 'task-status' && r.entry.fromStatus === 'todo' && r.entry.toStatus === 'doing', 'STATUS-HIST-10 : transition structurée', 'STATUS-HIST-10');
  ok(r.entry.fromField === true, 'STATUS-HIST-10 : contexte terrain conservé', 'STATUS-HIST-10');
  ok(r.entry.author === r.resource && r.entry.author !== 'Eric', 'STATUS-HIST-10 : auteur = ressource terrain, jamais uniformisé (§15)', 'STATUS-HIST-10');
  const sub = await ev(p, () => { app.settings.role = 'driver'; app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique'); return document.querySelector('.history-event-sub')?.textContent.trim(); });
  await p.waitForTimeout(240);
  ok(sub === 'Confirmé sur le terrain', 'STATUS-HIST-10 : « Confirmé sur le terrain » affiché car fromField === true (§17)', 'STATUS-HIST-10');
  await ctx.close();
}

// ---- TIMESTAMP-01 : horodatage complet ----
console.log('\n[TIMESTAMP-01] Horodatage complet');
{
  const { ctx, p } = await newPage(1440, 1000, 'T01');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    return { date: app.history[0].date, stamp: historyStamp(app.history[0]), helper: historyNow() };
  }, RESET);
  note('TIMESTAMP-01', r);
  ok(r.date === '2026-09-11T08:43', 'TIMESTAMP-01 : date stockée = "2026-09-11T08:43" (horodatage complet)', 'TIMESTAMP-01');
  ok(!/^\d{2}:\d{2}$/.test(r.date), 'TIMESTAMP-01 : INTERDIT — plus d’heure seule', 'TIMESTAMP-01');
  ok(r.stamp.key === '2026-09-11' && r.stamp.time === '08:43', 'TIMESTAMP-01 : jour ET heure exploitables par la timeline', 'TIMESTAMP-01');
  // Tous les points d'écriture d'app.history sont migrés
  const others = await ev(p, () => {
    app.history = [];
    const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved');
    setIssueStatus(i.id, 'resolved');
    const dates = app.history.map((h) => h.date);
    return { dates, allFull: dates.every((d) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d)) };
  });
  note('TIMESTAMP-01', others);
  ok(others.allFull, 'TIMESTAMP-01 : les autres points d’écriture (incident) sont eux aussi horodatés complètement (§35)', 'TIMESTAMP-01');
  await ctx.close();
}

// ---- TIMESTAMP-02/03 : groupes de journée ----
console.log('\n[TIMESTAMP-02/03] Groupes de journée');
{
  const { ctx, p } = await newPage(1440, 1000, 'T023');
  await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-electric', 'todo', 'task');
    setTaskStatus('k-electric', 'doing', 'task');
  }, RESET);
  await openHist(p);
  const one = await ev(p, () => ({
    days: document.querySelectorAll('.history-day').length,
    labels: [...document.querySelectorAll('.history-day-label')].map((x) => x.textContent.trim()),
    events: document.querySelectorAll('.history-event').length,
    times: [...document.querySelectorAll('.history-time')].map((x) => x.textContent.trim()),
  }));
  note('TIMESTAMP-02', one);
  ok(one.days === 1 && one.labels.length === 1, 'TIMESTAMP-02 : un seul groupe de journée', 'TIMESTAMP-02');
  ok(/11 sept\. 2026/.test(one.labels[0]), `TIMESTAMP-02 : libellé « ${one.labels[0] || ''} » issu de la donnée, pas inventé`, 'TIMESTAMP-02');
  ok(one.events === 3 && one.times.every((t) => /^\d{2}:\d{2}$/.test(t)), 'TIMESTAMP-02 : 3 heures affichées sous la même date', 'TIMESTAMP-02');

  const two = await ev(p, () => {
    app.history.push({ date: '2026-09-10T17:40', eventType: 'task-status', projectId: 'keravel', taskId: 'k-electric', taskName: 'Tableau électrique', fromStatus: 'todo', toStatus: 'doing', author: 'Eric', changes: [{ field: 'Statut', from: 'À faire', to: 'En cours' }] });
    save(); openProjectTab('keravel', 'Historique');
    return { days: document.querySelectorAll('.history-day').length, labels: [...document.querySelectorAll('.history-day-label')].map((x) => x.textContent.trim()) };
  });
  await p.waitForTimeout(240);
  note('TIMESTAMP-03', two);
  ok(two.days === 2 && two.labels.length === 2 && two.labels[0] !== two.labels[1], 'TIMESTAMP-03 : deux journées → deux groupes distincts', 'TIMESTAMP-03');
  await p.screenshot({ path: SHOTS + '03-deux-journees.png', fullPage: true });
  await ctx.close();
}

// ---- TIMESTAMP-04 + LEGACY : anciennes entrées ----
console.log('\n[TIMESTAMP-04/LEGACY] Anciennes entrées intactes');
{
  const { ctx, p } = await newPage(1440, 1000, 'LEG');
  await ev(p, (src) => {
    (0, eval)(src);
    app.history = [
      { date: '21:18', text: 'Tableau électrique · commencée', author: 'Eric', taskId: 'k-electric' },
      { date: 'hier', text: 'Entrée à date illisible', author: 'Eric', projectId: 'keravel' },
      { date: '20:02', text: 'Pose des 6 fenêtres · passée « À faire »', author: 'Eric', taskId: 'k-windows' },
    ];
    save();
  }, RESET);
  await openHist(p);
  const t = await readTimeline(p);
  note('TIMESTAMP-04', t);
  ok(t.length === 3, 'TIMESTAMP-04 : les 3 anciennes entrées restent visibles', 'TIMESTAMP-04');
  ok(t[0].time === '21:18' && t[1].time === 'hier', 'TIMESTAMP-04 : heure seule et date illisible affichées telles quelles', 'TIMESTAMP-04');
  ok(t.every((x) => x.from === null && x.to === null), 'LEGACY : aucune transition RECONSTRUITE sur une entrée sans fromStatus (§28/§29)', 'LEGACY');
  ok(t[0].title === 'Tableau électrique · commencée', 'LEGACY : le texte legacy reste la vérité affichée', 'LEGACY');
  ok(t[2].title === 'Pose des 6 fenêtres · passée « À faire »', 'LEGACY : deuxième entrée legacy intacte', 'LEGACY');
  // Mélange legacy + structuré
  const mix = await ev(p, () => {
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    openProjectTab('keravel', 'Historique');
    const evs = [...document.querySelectorAll('.history-event')];
    return { total: evs.length, withTransition: evs.filter((e) => e.querySelector('.hs-chip')).length, dayLabels: [...document.querySelectorAll('.history-day-label')].map((x) => x.textContent.trim()) };
  });
  await p.waitForTimeout(240);
  note('LEGACY', mix);
  ok(mix.total === 4 && mix.withTransition === 1, 'LEGACY : legacy et structuré cohabitent — seule la nouvelle entrée porte une transition', 'LEGACY');
  ok(mix.dayLabels.includes('Date non précisée'), 'LEGACY : les entrées sans jour sont regroupées sous « Date non précisée », jamais rattachées à une date inventée', 'LEGACY');
  await p.screenshot({ path: SHOTS + '04-legacy-et-structure.png', fullPage: true });
  await ctx.close();
}

// ---- TASK-DELETED ----
console.log('\n[TASK-DELETED] Tâche supprimée');
{
  const { ctx, p } = await newPage(1440, 1000, 'DEL');
  await ev(p, (src) => {
    (0, eval)(src);
    app.history = [{ date: '2026-09-11T08:00', eventType: 'task-status', projectId: 'keravel', taskId: 'tache-disparue', taskName: 'Ancienne tâche', fromStatus: 'todo', toStatus: 'doing', author: 'Eric', text: 'Ancienne tâche · commencée', changes: [{ field: 'Statut', from: 'À faire', to: 'En cours' }] }];
    save();
  }, RESET);
  await openHist(p);
  const t = await readTimeline(p);
  note('TASK-DELETED', t[0]);
  ok(t[0].title === 'Ancienne tâche', 'TASK-DELETED : le nom mémorisé reste lisible (§27)', 'TASK-DELETED');
  ok(t[0].from === 'À faire' && t[0].to === 'En cours', 'TASK-DELETED : la transition reste lisible', 'TASK-DELETED');
  ok(!t[0].btn, 'TASK-DELETED : aucun bouton « Voir la tâche » sur une tâche disparue', 'TASK-DELETED');
  await ctx.close();
}

// ---- AUTRES ÉVÉNEMENTS : incident, photo, reprise, simulation, changes ----
console.log('\n[AUTRES] Incident / photo / reprise / simulation / changes');
{
  const { ctx, p } = await newPage(1440, 1000, 'AUT');
  const inc = await ev(p, (src) => {
    (0, eval)(src);
    const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved');
    setIssueStatus(i.id, 'resolved');
    const h = app.history[0];
    return { text: h.text, date: h.date, projectId: h.projectId, eventType: h.eventType, pid: historyProjectId(h) };
  }, RESET);
  note('AUTRES', { incident: inc });
  ok(/résolu/.test(inc.text) && !inc.eventType, 'INCIDENT : conservé tel quel, non transformé en statut (§22)', 'AUTRES');
  ok(/^\d{4}-\d{2}-\d{2}T/.test(inc.date) && inc.pid === 'keravel', 'INCIDENT : date complète + rattachement Keravel', 'AUTRES');

  const photo = await ev(p, () => {
    app.history = [];
    addPhoto({ projectId: 'keravel', taskId: null, resourceId: null, comment: 'Test', dataUrl: null, notify: true, author: 'Eric' });
    const h = app.history[0];
    return h ? { text: h.text, date: h.date, eventType: h.eventType, pid: historyProjectId(h) } : null;
  });
  note('AUTRES', { photo });
  ok(photo && /Photo ajoutée/.test(photo.text) && !photo.eventType, 'PHOTO : entrée conservée, non transformée (§55)', 'AUTRES');
  ok(photo && /^\d{4}-\d{2}-\d{2}T/.test(photo.date) && photo.pid === 'keravel', 'PHOTO : date complète + bon chantier', 'AUTRES');

  const sim = await ev(p, () => {
    // État propre : les sous-tests précédents ont modifié incidents et photos.
    resetApp(); setDepth('pilot'); app.history = []; save();
    const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved' && x.taskId);
    // Tâche « todo » sans successeur : décalage valide, ni arbitrage ni refus.
    const cands = app.tasks.filter((x) => x.projectId === 'keravel' && x.status !== 'doing' && x.status !== 'done');
    const t = cands.find((x) => !getTaskSuccessors(x.id).length) || cands[0];
    const shift = (d) => { const x = date(d); x.setDate(x.getDate() + 2); return localDateTime(x); };
    app.simulation = { id: 'sim-t', label: 'Décalage test', issueId: i && i.taskId === t.id ? i.id : undefined, changes: [{ taskId: t.id, start: shift(t.start), end: shift(t.end) }] };
    applySimulation();
    const h = app.history.find((x) => /Simulation/.test(x.text));
    return h ? { text: h.text, date: h.date, projectId: h.projectId, task: t.id } : { applied: app.simulation === null, task: t.id };
  });
  await p.waitForTimeout(220);
  note('AUTRES', { simulation: sim });
  ok(sim && /^\d{4}-\d{2}-\d{2}T/.test(sim.date) && sim.projectId === 'keravel', 'SIMULATION : entrée conservée, date complète, moteur Résoudre inchangé (§57)', 'AUTRES');

  const edit = await ev(p, () => {
    resetApp(); setDepth('pilot'); app.history = []; save();
    openTaskEdit('k-windows', 'planning-gantt');
    document.querySelector('#taskEditForm [name=name]').value = 'Pose des 6 fenêtres';
    document.querySelector('#taskEditForm [name=resourceId]').value = app.resources.find((r) => r.id !== task('k-windows').resourceId).id;
    markTaskEditDirty(); submitTaskEdit();
    if (document.querySelector('#modal').classList.contains('open')) applyTaskEditReflow();
    const h = app.history.find((x) => Array.isArray(x.changes) && x.changes.some((c) => c.field !== 'Statut'));
    return h ? { date: h.date, taskName: h.taskName, changes: h.changes.map((c) => c.field) } : null;
  });
  await p.waitForTimeout(240);
  note('AUTRES', { edition: edit });
  ok(edit && Array.isArray(edit.changes) && edit.changes.length > 0, 'CHANGES : les entrées d’édition conservent leurs différences (§23/§53)', 'AUTRES');
  ok(edit && /^\d{4}-\d{2}-\d{2}T/.test(edit.date), 'CHANGES : date complète', 'AUTRES');
  ok(edit && edit.taskName === 'Pose des 6 fenêtres', 'CHANGES : taskName renseigné → titre = nom de la tâche (§24)', 'AUTRES');
  await ctx.close();
}

// ---- REPRISE (moteur SAV inchangé) ----
console.log('\n[REPRISE] Parcours SAV');
{
  const { ctx, p } = await newPage(1440, 1000, 'REP');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    const t = app.tasks.find((x) => x.projectId === 'keravel' && x.status !== 'done');
    setTaskStatus(t.id, 'done', 'task');
    app.history = [];
    openReworkForm(t.id);
    const f = document.querySelector('#drawerContent form');
    if (f) { const c = f.querySelector('[name=comment]'); if (c) c.value = 'Reprise de test'; f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
    return { entries: app.history.map((h) => ({ text: h.text, date: h.date, taskId: h.taskId })) };
  }, RESET);
  await p.waitForTimeout(250);
  note('REPRISE', r);
  ok(r.entries.length >= 2, 'REPRISE : les entrées du parcours SAV sont conservées (§56)', 'REPRISE');
  ok(r.entries.every((e) => /^\d{4}-\d{2}-\d{2}T/.test(e.date)), 'REPRISE : dates complètes', 'REPRISE');
  ok(r.entries.some((e) => /Reprise/.test(e.text)), 'REPRISE : libellés SAV inchangés', 'REPRISE');
  await ctx.close();
}

// ---- ORDRE (§58) ----
console.log('\n[ORDRE] Chronologie stricte');
{
  const { ctx, p } = await newPage(1440, 1000, 'ORD');
  await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; task('k-windows').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-windows', 'doing', 'task');
    setTaskStatus('k-electric', 'todo', 'task');
  }, RESET);
  await openHist(p);
  const t = await readTimeline(p);
  const order = t.map((x) => x.title + ':' + x.from + '>' + x.to);
  note('ORDRE', order);
  ok(JSON.stringify(order) === JSON.stringify([
    'Tableau électrique:En cours>À faire',
    'Pose des 6 fenêtres:À faire>En cours',
    'Tableau électrique:À faire>En cours',
  ]), 'ORDRE : plus récent en haut, aucun tri par nom / type / statut (§58)', 'ORDRE');
  await ctx.close();
}

// ---- DESIGN : dark mode + couleurs de statut ----
console.log('\n[DESIGN] Dark mode et couleurs');
{
  const { ctx, p } = await newPage(1440, 1100, 'DARK');
  await ev(p, (src) => {
    (0, eval)(src);
    ['k-electric', 'k-windows', 'k-control'].forEach((id) => { if (task(id)) task(id).status = 'todo'; });
    save();
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-windows', 'doing', 'task');
    setTaskStatus('k-windows', 'done', 'task');
    setTaskStatus('k-electric', 'todo', 'task');
    app.settings.theme = 'dark'; document.body.classList.add('dark'); save();
  }, RESET);
  await openHist(p);
  const r = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color }; };
    return {
      dark: document.body.classList.contains('dark'),
      from: g('.hs-chip:not(.hs-to)'), arrow: g('.hs-arrow'),
      todo: g('.hs-chip.hs-to.hs-todo'), doing: g('.hs-chip.hs-to.hs-doing'), done: g('.hs-chip.hs-to.hs-done'),
      counts: { doing: document.querySelectorAll('.hs-to.hs-doing').length, done: document.querySelectorAll('.hs-to.hs-done').length, todo: document.querySelectorAll('.hs-to.hs-todo').length },
    };
  });
  note('DESIGN', r);
  ok(r.dark && r.from && r.arrow, 'DESIGN : transition rendue en mode sombre', 'DESIGN');
  ok(r.counts.doing >= 1 && r.counts.done >= 1 && r.counts.todo >= 1, 'DESIGN : les trois statuts d’arrivée sont représentés', 'DESIGN');
  const distinct = [r.doing, r.done, r.todo].filter(Boolean);
  ok(new Set(distinct.map((x) => x.fg)).size === distinct.length, 'DESIGN : À faire / En cours / Terminée visuellement distincts (§13)', 'DESIGN');
  ok(distinct.every((x) => x.fg !== x.bg), 'DESIGN : contraste suffisant (texte ≠ fond)', 'DESIGN');
  ok(r.from.fg !== r.doing.fg, 'DESIGN : l’état de départ reste neutre, seul l’état d’arrivée est affirmé (§12)', 'DESIGN');
  await p.screenshot({ path: SHOTS + '05-dark-transitions.png', fullPage: true });
  await ctx.close();
}

// ---- RESPONSIVE + densité ----
console.log('\n[RESPONSIVE] 1920 → 390');
{
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'RESP-' + w);
    await ev(p, (src) => {
      (0, eval)(src);
      task('k-electric').status = 'todo'; save();
      setTaskStatus('k-electric', 'doing', 'task');
      setTaskStatus('k-electric', 'todo', 'task');
      setTaskStatus('k-electric', 'doing', 'task');
    }, RESET);
    await openHist(p);
    const r = await ev(p, () => {
      const main = document.querySelector('.main'), mr = main.getBoundingClientRect();
      let over = 0;
      main.querySelectorAll('.history-event, .hs-chip').forEach((e) => {
        const b = e.getBoundingClientRect();
        if (b.right > mr.right + 1 || b.left < mr.left - 1) over++;
      });
      const hs = [...main.querySelectorAll('.history-event')].map((e) => e.getBoundingClientRect().height);
      return {
        events: hs.length, avg: Math.round(hs.reduce((a, x) => a + x, 0) / hs.length),
        chips: main.querySelectorAll('.hs-chip').length, over,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    note('RESPONSIVE', { w, ...r });
    ok(r.events === 3 && r.chips === 6, `RESPONSIVE : ${w}px — 3 transitions rendues`, 'RESPONSIVE');
    ok(r.over === 0 && !r.hscroll, `RESPONSIVE : ${w}px — aucun débordement, 0 scroll horizontal`, 'RESPONSIVE');
    ok(r.avg <= 110, `RESPONSIVE : ${w}px — timeline toujours compacte (${r.avg}px/événement)`, 'RESPONSIVE');
    if (w === 390) await p.screenshot({ path: SHOTS + '06-mobile-390.png', fullPage: true });
    if (w === 1440) await p.screenshot({ path: SHOTS + '07-desktop-1440.png', fullPage: true });
    await ctx.close();
  }
}

// ---- NAVIGATION + cursor (acquis V2.4.12.1) ----
console.log('\n[NAVIGATION] Voir la tâche et absence de fausse affordance');
{
  const { ctx, p } = await newPage(1440, 1000, 'NAV');
  await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
  }, RESET);
  await openHist(p);
  const cursors = await ev(p, () => ({
    event: getComputedStyle(document.querySelector('.history-event')).cursor,
    chip: getComputedStyle(document.querySelector('.hs-chip')).cursor,
    btn: getComputedStyle(document.querySelector('.history-task-link')).cursor,
  }));
  note('NAVIGATION', cursors);
  ok(cursors.event === 'default' && cursors.chip === 'default', 'NAVIGATION : aucune fausse affordance sur l’événement ni sur les pastilles de statut', 'NAVIGATION');
  ok(cursors.btn === 'pointer', 'NAVIGATION : seul « Voir la tâche » est cliquable', 'NAVIGATION');
  await p.locator('.history-task-link').first().click();
  await p.waitForTimeout(280);
  const opened = await ev(p, () => ({ open: document.querySelector('#drawer').classList.contains('open'), title: document.querySelector('#drawerContent h2')?.textContent.trim(), page: app.ui.page }));
  note('NAVIGATION', opened);
  ok(opened.open && opened.title === 'Tableau électrique', 'NAVIGATION : ouvre bien la bonne tâche', 'NAVIGATION');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(220);
  const back = await ev(p, () => ({ page: app.ui.page, tab: document.querySelector('.tab.active')?.textContent.trim(), events: document.querySelectorAll('.history-event').length }));
  ok(back.page === 'project' && back.tab === 'Historique' && back.events === 1, 'NAVIGATION : retour sur l’onglet Historique intact', 'NAVIGATION');
  await ctx.close();
}

// ---- ISOLATION : SITE-01 non régressé ----
console.log('\n[ISOLATION] SITE-01 toujours fermé');
{
  const { ctx, p } = await newPage(1440, 1000, 'ISO');
  const r = await ev(p, (src) => {
    (0, eval)(src);
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    const v = app.tasks.find((t) => t.projectId === 'villa' && t.status !== 'done');
    setTaskStatus(v.id, 'doing', 'task');
    app.history.push({ date: historyNow(), text: 'GLOBAL-TEST', author: 'Eric' });
    save();
    const k = projectTabContent('Historique', 'keravel');
    const vh = projectTabContent('Historique', 'villa');
    return {
      keravelHasOwn: /Tableau électrique/.test(k),
      keravelHasVilla: k.includes(v.name),
      villaHasKeravel: /Tableau électrique/.test(vh),
      globalLeak: /GLOBAL-TEST/.test(k) || /GLOBAL-TEST/.test(vh),
      identical: k === vh,
    };
  }, RESET);
  note('ISOLATION', r);
  ok(r.keravelHasOwn && !r.keravelHasVilla && !r.villaHasKeravel, 'ISOLATION : aucune fuite inter-chantiers sur les événements structurés', 'ISOLATION');
  ok(!r.globalLeak && !r.identical, 'ISOLATION : entrée globale absente, historiques distincts — SITE-01 fermé', 'ISOLATION');
  await ctx.close();
}

// ---- SCHÉMA / STORE ----
console.log('\n[SCHEMA] Aucun bump');
{
  const { ctx, p } = await newPage(1440, 1000, 'SCH');
  await ev(p, (src) => { (0, eval)(src); task('k-electric').status = 'todo'; save(); setTaskStatus('k-electric', 'doing', 'task'); }, RESET);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(320);
  const r = await ev(p, () => ({
    schema: SCHEMA_VERSION,
    store: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
    survived: app.history.length,
    entry: app.history[0],
    noNewCollections: !('taskHistory' in app) && !('auditLog' in app) && !Array.isArray(app.projectHistory),
  }));
  note('SCHEMA', { schema: r.schema, store: r.store, survived: r.survived, noNewCollections: r.noNewCollections });
  ok(r.schema === 8, 'SCHEMA : SCHEMA_VERSION inchangé (8)', 'SCHEMA');
  ok(r.store.every((k) => k === 'kanvix-product-8-3'), 'SCHEMA : STORE inchangé', 'SCHEMA');
  ok(r.survived >= 1 && r.entry.eventType === 'task-status' && r.entry.fromStatus === 'todo', 'SCHEMA : les champs structurés survivent au rechargement, sans migration', 'SCHEMA');
  ok(r.noNewCollections, 'SCHEMA : app.history reste la collection unique (§73)', 'SCHEMA');
  await ctx.close();
}

// ---- COMPARATIF V2.4.12.1 → V2.4.13 (§65) ----
console.log('\n[COMPARATIF] Avant / après');
{
  const seq = `
    resetApp(); setDepth('pilot'); app.history = [];
    task('k-electric').status = 'todo'; save();
    setTaskStatus('k-electric', 'doing', 'task');
    setTaskStatus('k-electric', 'todo', 'task');
    setTaskStatus('k-electric', 'doing', 'task');
    app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique');
  `;
  const read = async (url, tag) => {
    const { ctx, p } = await newPage(1440, 1000, tag, url);
    await ev(p, (s) => (0, eval)(s), seq);
    await p.waitForTimeout(280);
    const r = await ev(p, () => [...document.querySelectorAll('.history-event')].map((e) => ({
      title: e.querySelector('.history-event-title').textContent.trim(),
      transition: e.querySelector('.hs-chip:not(.hs-to)') ? e.querySelector('.hs-chip:not(.hs-to)').textContent.trim() + ' → ' + e.querySelector('.hs-chip.hs-to').textContent.trim() : null,
    })));
    await ctx.close();
    return r;
  };
  const before = await read(BASELINE, 'CMP-before');
  const after = await read(FILE, 'CMP-after');
  note('COMPARATIF', { v24121: before.map((x) => x.title), v2413: after.map((x) => x.title + ' | ' + x.transition) });
  ok(before.length === 3 && after.length === 3, 'COMPARATIF : 3 événements des deux côtés — rien n’a été supprimé', 'COMPARATIF');
  ok(before.every((x) => !x.transition), 'COMPARATIF : V2.4.12.1 n’affichait aucune transition', 'COMPARATIF');
  ok(after.every((x) => x.transition && x.title === 'Tableau électrique'), 'COMPARATIF : V2.4.13 affiche le nom + la transition sur les 3 (§65)', 'COMPARATIF');
  ok(JSON.stringify(after.map((x) => x.transition)) === JSON.stringify(['À faire → En cours', 'En cours → À faire', 'À faire → En cours']), 'COMPARATIF : séquence exacte attendue', 'COMPARATIF');
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
