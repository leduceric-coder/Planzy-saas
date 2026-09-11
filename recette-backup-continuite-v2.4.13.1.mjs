// ============================================================
// KANVIX — Recette sauvegarde / restauration / continuité (V2.4.13.1)
//   Usage : node recette-backup-continuite-v2.4.13.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
const { chromium } = pw;
const NOW = '?now=2026-09-11T08:43:00';
const POC = '/home/user/Planzy-saas/public/poc/';
const FILE = 'file://' + POC + 'kanvix-next-gen-v2.4.13.1.html' + NOW;
const LEGACY = 'file://' + POC + 'kanvix-next-gen-v2.4.12.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-backup-v2.4.13.1/';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kanvix-backup-'));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 400)}`);
const allErrs = [];
async function newPage(w = 1440, h = 1000, tag = 'x', url = FILE) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(260);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const run = async (p, src) => { await ev(p, (s) => (0, eval)(s), src); await p.waitForTimeout(240); };
// Ferme le message de continuité file:// s'il est présent.
const dismissNotice = async (p) => { await ev(p, () => dismissKanvixContinuityNotice()); await p.waitForTimeout(120); };
// Télécharge la sauvegarde via le VRAI bouton de Réglages et renvoie le JSON.
async function downloadBackup(p, label) {
  const [dl] = await Promise.all([
    p.waitForEvent('download'),
    ev(p, () => downloadKanvixBackup()),
  ]);
  const file = path.join(TMP, label + '.json');
  await dl.saveAs(file);
  return { file, payload: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
// Restaure via le VRAI parcours : input file → prévisualisation → Restaurer.
async function restoreBackup(p, file) {
  await ev(p, () => openKanvixBackupRestore());
  await p.waitForTimeout(150);
  const chooser = await p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null);
  if (chooser) await chooser.setFiles(file);
  else {
    // Fallback : injection directe dans le lecteur (même chemin de code).
    const content = fs.readFileSync(file, 'utf8');
    await ev(p, (c) => readKanvixBackupFile(new File([c], 'b.json', { type: 'application/json' })), content);
  }
  await p.waitForTimeout(400);
  return ev(p, () => ({
    modalOpen: document.querySelector('#modal').classList.contains('open'),
    html: document.querySelector('#modalContent').innerText,
  }));
}
const clickRestore = async (p) => { await ev(p, () => confirmKanvixRestore()); await p.waitForTimeout(400); };
// Empreinte métier comparable avant / après.
const fingerprint = (p) => ev(p, () => ({
  projects: app.projects.map((x) => x.id + '|' + x.name + '|' + (x.lifecycle || 'active')).sort(),
  tasks: app.tasks.map((t) => [t.id, t.name, t.projectId, t.resourceId, t.status, t.start, t.end].join('|')).sort(),
  resources: app.resources.map((r) => r.id + '|' + r.name).sort(),
  issues: app.issues.map((i) => i.id + '|' + i.status + '|' + i.taskId).sort(),
  decisions: app.decisions.map((d) => d.id + '|' + d.status).sort(),
  milestones: app.milestones.map((m) => m.id + '|' + m.date).sort(),
  documents: app.documents.map((d) => d.id + '|' + (d.taskId || '')).sort(),
  photos: app.photos.map((x) => x.id + '|' + (x.dataUrl || '').length).sort(),
  messages: app.messages.map((m) => [m.id, m.text, m.read, m.photoId || ''].join('|')).sort(),
  history: app.history.map((h) => [h.date, h.text, h.eventType || '', h.fromStatus || '', h.toStatus || '', h.taskId || '', h.projectId || '', h.taskName || ''].join('|')),
  companyTemplates: app.companyTemplates.map((c) => c.id || c.name).sort(),
  settings: app.settings,
  seededFor: app.seededFor,
}));

// Jeu de données riche : historique mixte, photo réelle, message, Pilotage.
const RICH = `
  resetApp();
  setDepth('pilot');
  app.settings.appearance = 'dark';
  task('k-electric').status = 'todo'; save();
  setTaskStatus('k-electric', 'doing', 'task');
  setTaskStatus('k-electric', 'todo', 'task');
  setTaskStatus('k-electric', 'doing', 'kanban');
  const i = app.issues.find((x) => x.projectId === 'keravel' && x.status !== 'resolved');
  setIssueStatus(i.id, 'resolved');
  app.history.push(
    { date: '21:18', text: 'Ancienne entrée legacy', author: 'Eric', taskId: 'k-windows' },
    { date: 'hier', text: 'Entrée à date illisible', author: 'Eric', projectId: 'keravel' },
  );
  app.photos.push({ id: 'ph-backup', projectId: 'keravel', taskId: 'k-electric', date: historyNow(), author: 'Eric', comment: 'Photo test', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' });
  app.messages.push({ id: 'msg-backup', projectId: 'keravel', taskId: 'k-electric', resourceId: 'thomas', from: 'artisan', text: 'Message de test', time: '09:10', read: false, photoId: 'ph-backup' });
  app.companyTemplates.push({ id: 'tpl-1', name: 'Modèle test', tasks: [] });
  save();
`;

// ---- BACKUP-F1 : round-trip maître ----
console.log('\n[BACKUP-F1] Sauvegarder → resetApp → Restaurer');
{
  const { ctx, p } = await newPage(1440, 1000, 'F1');
  await dismissNotice(p);
  await run(p, RICH);
  const before = await fingerprint(p);
  const { file, payload } = await downloadBackup(p, 'f1');
  note('BACKUP-F1', { format: payload.format, backupVersion: payload.backupVersion, appVersion: payload.appVersion, schemaVersion: payload.schemaVersion, seededFor: payload.seededFor });
  ok(payload.format === 'kanvix-backup' && payload.backupVersion === 1, 'BACKUP-F1 : format « kanvix-backup » v1', 'BACKUP-F1');
  ok(payload.appVersion === '2.4.13.1' && payload.schemaVersion === 8, 'BACKUP-F1 : appVersion et schemaVersion présents', 'BACKUP-F1');
  ok(typeof payload.seededFor === 'string' && payload.seededFor.length === 10, 'BACKUP-F1 : seededFor conservé (§18)', 'BACKUP-F1');
  ok(payload.state.undoStack.length === 0 && payload.state.simulation === null, 'BACKUP-F1 : undoStack vidé, simulation neutralisée (§8)', 'BACKUP-F1');

  await ev(p, () => resetApp());
  await p.waitForTimeout(320);
  const wiped = await fingerprint(p);
  ok(JSON.stringify(wiped.history) !== JSON.stringify(before.history), 'BACKUP-F1 : resetApp a bien remis un état de démonstration', 'BACKUP-F1');

  const prev = await restoreBackup(p, file);
  ok(prev.modalOpen && /Restaurer cette sauvegarde/.test(prev.html), 'BACKUP-F1 : la prévisualisation s’affiche avant toute mutation (§14)', 'BACKUP-F1');
  ok(/chantiers/.test(prev.html) && /événements d’historique/.test(prev.html), 'BACKUP-F1 : le résumé détaille le contenu', 'BACKUP-F1');
  await clickRestore(p);
  const after = await fingerprint(p);

  const keys = ['projects', 'tasks', 'resources', 'issues', 'decisions', 'milestones', 'documents', 'photos', 'messages', 'history', 'companyTemplates', 'seededFor'];
  for (const k of keys)
    ok(JSON.stringify(after[k]) === JSON.stringify(before[k]), `BACKUP-F1 : ${k} restauré à l’identique`, 'BACKUP-F1');
  ok(JSON.stringify(after.settings) === JSON.stringify(before.settings), 'BACKUP-F1 : settings restaurés à l’identique', 'BACKUP-F1');
  await ctx.close();
}

// ---- BACKUP-F2 : historique complet ----
console.log('\n[BACKUP-F2] Historique — legacy + structuré + incident');
{
  const { ctx, p } = await newPage(1440, 1000, 'F2');
  await dismissNotice(p);
  await run(p, RICH);
  const before = await ev(p, () => app.history.map((h) => ({ date: h.date, text: h.text, eventType: h.eventType || null, from: h.fromStatus || null, to: h.toStatus || null, taskId: h.taskId || null, projectId: h.projectId || null, taskName: h.taskName || null })));
  note('BACKUP-F2', { count: before.length, kinds: [...new Set(before.map((h) => h.eventType || 'legacy'))] });
  const { file } = await downloadBackup(p, 'f2');
  await ev(p, () => resetApp());
  await p.waitForTimeout(320);
  await restoreBackup(p, file);
  await clickRestore(p);
  const after = await ev(p, () => app.history.map((h) => ({ date: h.date, text: h.text, eventType: h.eventType || null, from: h.fromStatus || null, to: h.toStatus || null, taskId: h.taskId || null, projectId: h.projectId || null, taskName: h.taskName || null })));
  ok(after.length === before.length && before.length >= 5, `BACKUP-F2 : ${before.length} événements restaurés, aucun perdu`, 'BACKUP-F2');
  ok(JSON.stringify(after) === JSON.stringify(before), 'BACKUP-F2 : même ordre, mêmes dates, mêmes fromStatus/toStatus, mêmes rattachements', 'BACKUP-F2');
  ok(after.some((h) => h.eventType === 'task-status' && h.from && h.to), 'BACKUP-F2 : les transitions structurées survivent', 'BACKUP-F2');
  ok(after.some((h) => !h.eventType && h.date === '21:18'), 'BACKUP-F2 : les entrées legacy heure-seule survivent', 'BACKUP-F2');
  await ctx.close();
}

// ---- BACKUP-F3/F4/F5 : Pilotage, photos, messages ----
console.log('\n[BACKUP-F3/F4/F5] Pilotage, photos, messages');
{
  const { ctx, p } = await newPage(1440, 1000, 'F345');
  await dismissNotice(p);
  await run(p, RICH);
  const before = await ev(p, () => ({
    level: app.settings.level, appearance: app.settings.appearance,
    photo: app.photos.find((x) => x.id === 'ph-backup'),
    msg: app.messages.find((m) => m.id === 'msg-backup'),
  }));
  const { file } = await downloadBackup(p, 'f345');
  await ev(p, () => resetApp());
  await p.waitForTimeout(320);
  await restoreBackup(p, file);
  await clickRestore(p);
  const after = await ev(p, () => ({
    level: app.settings.level, appearance: app.settings.appearance,
    photo: app.photos.find((x) => x.id === 'ph-backup'),
    msg: app.messages.find((m) => m.id === 'msg-backup'),
    tabs: (() => { app.ui.projectId = 'keravel'; go('project'); return document.querySelector('.main').innerText; })(),
  }));
  await p.waitForTimeout(200);
  note('BACKUP-F3/F4/F5', { level: after.level, photoLen: after.photo?.dataUrl?.length, msgRead: after.msg?.read });
  ok(after.level === 'pilot' && before.level === 'pilot', 'BACKUP-F3 : niveau Pilotage restauré', 'BACKUP-F3');
  ok(/Historique/.test(after.tabs), 'BACKUP-F3 : l’onglet Historique est visible après restauration', 'BACKUP-F3');
  ok(after.appearance === before.appearance, 'BACKUP-F3 : préférence d’apparence restaurée', 'BACKUP-F3');
  ok(after.photo && after.photo.dataUrl === before.photo.dataUrl, 'BACKUP-F4 : dataUrl de la photo identique (§5)', 'BACKUP-F4');
  ok(after.msg && after.msg.read === before.msg.read && after.msg.photoId === before.msg.photoId, 'BACKUP-F5 : message restauré avec read/unread et photoId (§7)', 'BACKUP-F5');
  ok(after.msg.text === before.msg.text, 'BACKUP-F5 : contenu du message identique', 'BACKUP-F5');
  await ctx.close();
}

// ---- BACKUP-F6/F7/F8 : fichiers refusés ----
console.log('\n[BACKUP-F6/F7/F8] Fichiers invalides — état intact');
{
  const { ctx, p } = await newPage(1440, 1000, 'F678');
  await dismissNotice(p);
  await run(p, RICH);
  const before = await fingerprint(p);
  const cases = [
    ['F6', 'ceci nest pas du json {{{', /illisible/i, 'Sauvegarde illisible'],
    ['F7', JSON.stringify({ format: 'kanvix-portable', projects: [], tasks: [] }), /export de données/i, 'export métier refusé'],
    ['F8', JSON.stringify({ format: 'kanvix-backup', backupVersion: 1, state: { settings: {}, projects: [], resources: [], issues: [], decisions: [], milestones: [], documents: [], photos: [], messages: [], history: [] } }), /incomplète/i, 'backup sans tasks'],
    ['F8', JSON.stringify({ format: 'kanvix-backup', backupVersion: 1, state: { projects: [], tasks: [], resources: [], issues: [], decisions: [], milestones: [], documents: [], photos: [], messages: [], history: [] } }), /incomplète/i, 'backup sans settings'],
    ['F8', JSON.stringify({ format: 'kanvix-backup', backupVersion: 1, state: { settings: {}, projects: [{ id: 'a' }, { id: 'a' }], tasks: [], resources: [], issues: [], decisions: [], milestones: [], documents: [], photos: [], messages: [], history: [] } }), /double/i, 'chantiers en double'],
    ['F8', JSON.stringify({ format: 'kanvix-backup', backupVersion: 1, state: { settings: {}, projects: [{ id: 'a' }], tasks: [{ id: 't1', projectId: 'zzz' }], resources: [], issues: [], decisions: [], milestones: [], documents: [], photos: [], messages: [], history: [] } }), /chantier absent/i, 'tâche orpheline'],
  ];
  for (const [sec, content, re, label] of cases) {
    const f = path.join(TMP, 'bad-' + label.replace(/\W+/g, '-') + '.json');
    fs.writeFileSync(f, content);
    const r = await restoreBackup(p, f);
    const matched = re.test(r.html);
    note('BACKUP-' + sec, { label, message: r.html.split('\n').filter(Boolean)[1] });
    ok(r.modalOpen && matched, `BACKUP-${sec} : ${label} → message clair, aucune erreur technique brute`, 'BACKUP-' + sec);
    await ev(p, () => closeOverlay('modal'));
    await p.waitForTimeout(150);
    const now = await fingerprint(p);
    ok(JSON.stringify(now) === JSON.stringify(before), `BACKUP-${sec} : ${label} → état courant STRICTEMENT inchangé`, 'BACKUP-' + sec);
  }
  await ctx.close();
}

// ---- BACKUP-F9 : ancien schéma ----
console.log('\n[BACKUP-F9] Sauvegarde d’un schéma antérieur');
{
  const { ctx, p } = await newPage(1440, 1000, 'F9');
  await dismissNotice(p);
  await run(p, RICH);
  const { payload } = await downloadBackup(p, 'f9-src');
  // On rétrograde volontairement le schéma et on retire des champs récents.
  payload.schemaVersion = 7;
  payload.state.schemaVersion = 7;
  delete payload.state.companyTemplates;
  payload.state.issues.forEach((i) => { delete i.resolutionPolicy; });
  const f = path.join(TMP, 'f9.json');
  fs.writeFileSync(f, JSON.stringify(payload));
  const expected = { projects: payload.state.projects.length, tasks: payload.state.tasks.length, history: payload.state.history.length };
  await ev(p, () => resetApp());
  await p.waitForTimeout(320);
  const r = await restoreBackup(p, f);
  ok(r.modalOpen && /Restaurer cette sauvegarde/.test(r.html), 'BACKUP-F9 : une sauvegarde de schéma 7 est acceptée', 'BACKUP-F9');
  await clickRestore(p);
  const after = await ev(p, () => ({ schema: app.schemaVersion, projects: app.projects.length, tasks: app.tasks.length, history: app.history.length, templates: Array.isArray(app.companyTemplates) }));
  note('BACKUP-F9', { expected, after });
  ok(after.schema === 8, 'BACKUP-F9 : migrateState() répare vers le schéma courant (§17)', 'BACKUP-F9');
  ok(after.projects === expected.projects && after.tasks === expected.tasks && after.history === expected.history, 'BACKUP-F9 : aucune perte de données', 'BACKUP-F9');
  ok(after.templates, 'BACKUP-F9 : les champs manquants sont recréés par les migrations existantes', 'BACKUP-F9');
  await ctx.close();
}

// ---- BACKUP-F10 : non-dérive des dates ----
console.log('\n[BACKUP-F10] Dates — même jour puis jour suivant');
{
  const { ctx, p } = await newPage(1440, 1000, 'F10');
  await dismissNotice(p);
  await run(p, RICH);
  const dates = (pg) => ev(pg, () => ({
    tasks: app.tasks.map((t) => t.id + '|' + t.start + '|' + t.end).sort(),
    milestones: app.milestones.map((m) => m.id + '|' + m.date).sort(),
    issues: app.issues.map((i) => i.id + '|' + (i.createdAt || '')).sort(),
    documents: app.documents.map((d) => d.id + '|' + (d.date || '')).sort(),
    photos: app.photos.map((x) => x.id + '|' + (x.date || '')).sort(),
    history: app.history.map((h) => h.date),
    seededFor: app.seededFor,
  }));
  const before = await dates(p);
  const { file } = await downloadBackup(p, 'f10');
  await ev(p, () => resetApp());
  await p.waitForTimeout(320);
  await restoreBackup(p, file);
  await clickRestore(p);
  const sameDay = await dates(p);
  note('BACKUP-F10', { seededForAvant: before.seededFor, seededForApres: sameDay.seededFor });
  ok(JSON.stringify(sameDay.tasks) === JSON.stringify(before.tasks), 'BACKUP-F10 : dates des tâches STRICTEMENT identiques — aucune dérive (§19)', 'BACKUP-F10');
  ok(JSON.stringify(sameDay.milestones) === JSON.stringify(before.milestones), 'BACKUP-F10 : jalons identiques', 'BACKUP-F10');
  ok(JSON.stringify(sameDay.documents) === JSON.stringify(before.documents) && JSON.stringify(sameDay.photos) === JSON.stringify(before.photos), 'BACKUP-F10 : documents et photos identiques', 'BACKUP-F10');
  ok(JSON.stringify(sameDay.history) === JSON.stringify(before.history), 'BACKUP-F10 : horodatages d’historique identiques', 'BACKUP-F10');
  ok(sameDay.seededFor === before.seededFor, 'BACKUP-F10 : seededFor inchangé le même jour', 'BACKUP-F10');
  await ctx.close();

  // Jour suivant : un SEUL réalignement (§20)
  const nx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p2 = await nx.newPage();
  p2.on('pageerror', (e) => allErrs.push({ where: 'F10-next', msg: e.message }));
  p2.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: 'F10-next', msg: m.text() }); });
  await p2.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p2.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p2.goto('file://' + POC + 'kanvix-next-gen-v2.4.13.1.html?now=2026-09-12T09:00:00', { waitUntil: 'load' });
  await p2.waitForTimeout(280);
  await ev(p2, () => { if (document.querySelector('#modal').classList.contains('open')) closeOverlay('modal'); });
  await restoreBackup(p2, file);
  await clickRestore(p2);
  const nextDay = await dates(p2);
  // Un décalage d'exactement 1 jour sur la première tâche, pas deux.
  const shift = await ev(p2, (prev) => {
    const first = prev.tasks[0].split('|');
    const t = app.tasks.find((x) => x.id === first[0]);
    const d1 = new Date(first[1]), d2 = new Date(t.start);
    return Math.round((d2 - d1) / 86400000);
  }, before);
  note('BACKUP-F10', { seededForJ1: nextDay.seededFor, decalageJours: shift });
  ok(nextDay.seededFor === '2026-09-12', 'BACKUP-F10 : seededFor recalé sur le jour d’ouverture', 'BACKUP-F10');
  ok(shift === 1, `BACKUP-F10 : réalignement appliqué UNE seule fois (+${shift} jour, §20)`, 'BACKUP-F10');
  ok(JSON.stringify(nextDay.history) === JSON.stringify(before.history), 'BACKUP-F10 : l’historique n’est jamais réaligné', 'BACKUP-F10');
  await nx.close();
}

// ---- BACKUP-F11 / RECOVERY : continuité RÉELLE entre deux fichiers ----
console.log('\n[BACKUP-F11] Continuité cross-file V2.4.12.1 → V2.4.13.1');
{
  // Contexte A — l'ANCIENNE version, avec son bouton de récupération.
  const A = await newPage(1440, 1000, 'F11-A', LEGACY);
  const legacyState = await ev(A.p, () => {
    resetApp(); setDepth('pilot');
    app.settings.appearance = 'dark';
    task('k-electric').status = 'doing';
    task('k-windows').name = 'MARQUEUR-LEGACY';
    app.history = [
      { date: '21:18', text: 'Historique V2.4.12.1 · événement A', author: 'Eric', taskId: 'k-electric' },
      { date: '20:40', text: 'Historique V2.4.12.1 · événement B', author: 'Kanvix', projectId: 'keravel' },
    ];
    app.messages.push({ id: 'msg-legacy', projectId: 'keravel', taskId: 'k-electric', resourceId: 'thomas', from: 'artisan', text: 'Message V2.4.12.1', time: '09:10', read: false });
    app.photos.push({ id: 'ph-legacy', projectId: 'keravel', taskId: 'k-electric', date: '2026-09-11T08:00', author: 'Eric', comment: 'Photo legacy', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' });
    save();
    return { projects: app.projects.length, tasks: app.tasks.length, history: app.history.length, level: app.settings.level, marker: task('k-windows').name };
  });
  await A.p.waitForTimeout(240);
  note('BACKUP-F11', { A: legacyState });
  // Le bouton de récupération existe bien dans l'ancienne version
  const hasBtn = await ev(A.p, () => { go('more'); return document.querySelector('.main').innerText.includes('Exporter une sauvegarde complète'); });
  await A.p.waitForTimeout(200);
  ok(hasBtn, 'BACKUP-F11 : V2.4.12.1 expose « Exporter une sauvegarde complète » dans Réglages', 'BACKUP-F11');
  // READ-ONLY : l'export ne doit rien modifier
  const stateBeforeExport = await ev(A.p, () => localStorage.getItem('kanvix-product-8-3'));
  const { file: legacyFile, payload: legacyPayload } = await downloadBackup(A.p, 'legacy');
  const stateAfterExport = await ev(A.p, () => localStorage.getItem('kanvix-product-8-3'));
  ok(stateAfterExport === stateBeforeExport, 'BACKUP-F11 : l’export legacy est READ-ONLY — localStorage inchangé (§32)', 'BACKUP-F11');
  ok(legacyPayload.format === 'kanvix-backup' && legacyPayload.appVersion === '2.4.12.1', 'BACKUP-F11 : la sauvegarde legacy est au format kanvix-backup v1 (§31)', 'BACKUP-F11');
  await A.p.screenshot({ path: SHOTS + '01-legacy-export.png', fullPage: true });
  await A.ctx.close();

  // Contexte B — la NOUVELLE version, dans un navigateur neuf (storage vierge).
  const B = await newPage(1440, 1000, 'F11-B');
  const initial = await ev(B.p, () => ({
    noticeOpen: !!document.querySelector('#kanvixContinuity'),
    noticeText: document.querySelector('#kanvixContinuity')?.innerText || '',
    blocksApp: !!document.querySelector('#modal.open'),
    hadPersisted: KANVIX_HAD_PERSISTED_STATE,
    marker: app.tasks.some((t) => t.name === 'MARQUEUR-LEGACY'),
    history: app.history.length,
  }));
  note('BACKUP-F11', { B_initial: { noticeOpen: initial.noticeOpen, hadPersisted: initial.hadPersisted, marker: initial.marker } });
  ok(!initial.hadPersisted, 'BACKUP-F11 : B démarre sans état enregistré (§24)', 'BACKUP-F11');
  ok(initial.noticeOpen && /ne contient pas encore de données/.test(initial.noticeText), 'BACKUP-F11 : message de continuité affiché en file:// (§25)', 'BACKUP-F11');
  ok(!initial.blocksApp, 'BACKUP-F11 : le message est NON BLOQUANT — aucune modal ne s’interpose (§25)', 'BACKUP-F11');
  ok(!initial.marker, 'BACKUP-F11 : B ne voit PAS les données de A — les deux fichiers ne partagent pas le stockage', 'BACKUP-F11');
  await B.p.screenshot({ path: SHOTS + '02-nouvelle-version-vierge.png', fullPage: true });
  await ev(B.p, () => dismissKanvixContinuityNotice());
  await B.p.waitForTimeout(150);

  const prev = await restoreBackup(B.p, legacyFile);
  ok(prev.modalOpen && /Restaurer cette sauvegarde/.test(prev.html), 'BACKUP-F11 : la sauvegarde legacy est reconnue par V2.4.13.1', 'BACKUP-F11');
  await B.p.screenshot({ path: SHOTS + '03-previsualisation.png', fullPage: true });
  await clickRestore(B.p);
  const restored = await ev(B.p, () => ({
    projects: app.projects.length, tasks: app.tasks.length,
    history: app.history.map((h) => h.text), level: app.settings.level,
    appearance: app.settings.appearance,
    marker: app.tasks.some((t) => t.name === 'MARQUEUR-LEGACY'),
    msg: app.messages.some((m) => m.id === 'msg-legacy'),
    photo: app.photos.find((x) => x.id === 'ph-legacy')?.dataUrl?.length,
    electric: task('k-electric').status,
  }));
  note('BACKUP-F11', { B_restored: restored });
  ok(restored.marker, 'BACKUP-F11 : la tâche marqueur de A est présente dans B', 'BACKUP-F11');
  ok(restored.history.length === legacyState.history && restored.history.every((t) => /V2\.4\.12\.1/.test(t)), 'BACKUP-F11 : l’historique de A est intégralement récupéré', 'BACKUP-F11');
  ok(restored.level === 'pilot' && restored.appearance === 'dark', 'BACKUP-F11 : niveau Pilotage et apparence conservés', 'BACKUP-F11');
  ok(restored.msg && restored.photo > 0, 'BACKUP-F11 : message et photo (dataUrl) récupérés', 'BACKUP-F11');
  ok(restored.electric === 'doing', 'BACKUP-F11 : statut métier conservé', 'BACKUP-F11');
  ok(restored.projects === legacyState.projects && restored.tasks === legacyState.tasks, 'BACKUP-F11 : mêmes chantiers et mêmes tâches', 'BACKUP-F11');
  await B.p.screenshot({ path: SHOTS + '04-apres-restauration.png', fullPage: true });
  await B.ctx.close();
}

// ---- BACKUP-F12 : import intelligent + export métier intacts ----
console.log('\n[BACKUP-F12] Import intelligent et export métier inchangés');
{
  const { ctx, p } = await newPage(1440, 1000, 'F12');
  await dismissNotice(p);
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // L'export métier garde son format d'origine.
    exportKanvixData();
    const json = document.querySelector('#kanvixExportText').value;
    const portable = JSON.parse(json);
    closeOverlay('drawer');
    return {
      portableFormat: portable.format,
      portableKeys: Object.keys(portable).sort(),
      hasHistory: 'history' in portable,
      enginesPresent: ['analyzeKanvixImport', 'buildImportPlan', 'applyImportPlan', 'findProjectImportMatch', 'validateImportState'].every((f) => typeof window[f] === 'function'),
      backupFormat: buildKanvixBackup().format,
    };
  });
  note('BACKUP-F12', r);
  ok(r.portableFormat === 'kanvix-portable', 'BACKUP-F12 : exportKanvixData() produit toujours « kanvix-portable » (§73)', 'BACKUP-F12');
  ok(!r.hasHistory, 'BACKUP-F12 : l’export métier ne devient PAS une sauvegarde complète', 'BACKUP-F12');
  ok(r.backupFormat === 'kanvix-backup' && r.backupFormat !== r.portableFormat, 'BACKUP-F12 : les deux formats sont immédiatement distinguables (§74)', 'BACKUP-F12');
  ok(r.enginesPresent, 'BACKUP-F12 : les moteurs d’import intelligent sont intacts', 'BACKUP-F12');
  await ctx.close();
}

// ---- HÉBERGÉ : pas de message file:// ----
console.log('\n[HTTP] Démo hébergée');
{
  const { ctx, p } = await newPage(1440, 1000, 'HTTP', 'http://localhost:8241/kanvix-next-gen-v2.4.13.1.html' + NOW);
  const r = await ev(p, () => ({
    protocol: location.protocol,
    notice: !!document.querySelector('#kanvixContinuity'),
    modalOpen: document.querySelector('#modal').classList.contains('open'),
  }));
  note('HTTP', r);
  ok(r.protocol === 'http:', 'HTTP : la page est bien servie', 'HTTP');
  ok(!r.notice && !r.modalOpen, 'HTTP : aucun message de continuité sur une démo hébergée (§26/§62)', 'HTTP');
  // Même origine : le stockage persiste d'un rechargement à l'autre.
  await ev(p, () => { resetApp(); task('k-electric').name = 'MARQUEUR-HTTP'; save(); });
  await p.waitForTimeout(250);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(300);
  const persisted = await ev(p, () => ({ marker: app.tasks.some((t) => t.name === 'MARQUEUR-HTTP'), hadPersisted: KANVIX_HAD_PERSISTED_STATE, modalOpen: !!document.querySelector('#kanvixContinuity') }));
  note('HTTP', persisted);
  ok(persisted.marker && persisted.hadPersisted, 'HTTP : le stockage même-origine fonctionne comme avant', 'HTTP');
  ok(!persisted.modalOpen, 'HTTP : toujours aucun message invasif', 'HTTP');
  await ctx.close();
}

// ---- RÉGLAGES : UI, clavier, dark, responsive ----
console.log('\n[UI] Réglages, clavier, dark, responsive');
{
  const { ctx, p } = await newPage(1440, 1000, 'UI');
  await dismissNotice(p);
  const rows = await ev(p, () => {
    setDepth('pilot'); go('more');
    const all = [...document.querySelectorAll('.settings-row')].map((r) => ({ title: r.querySelector('b').textContent.trim(), sub: r.querySelector('small').textContent.trim(), tag: r.tagName }));
    return { all, sublabels: [...document.querySelectorAll('.settings-sublabel')].map((x) => x.textContent.trim()) };
  });
  await p.waitForTimeout(200);
  note('UI', { titles: rows.all.map((r) => r.title), sublabels: rows.sublabels });
  ok(rows.all.some((r) => r.title === 'Sauvegarder Kanvix'), 'UI : ligne « Sauvegarder Kanvix » présente (§21)', 'UI');
  ok(rows.all.some((r) => r.title === 'Restaurer une sauvegarde'), 'UI : ligne « Restaurer une sauvegarde » présente', 'UI');
  ok(rows.sublabels.includes('Sauvegarde Kanvix'), 'UI : sous-section « Sauvegarde Kanvix » distincte de l’import/export métier', 'UI');
  ok(rows.all.some((r) => r.title === 'Importer des données') && rows.all.some((r) => r.title === 'Exporter les données'), 'UI : import et export métier conservés (§22)', 'UI');
  const subs = rows.all.filter((r) => /Importer des données|Exporter les données/.test(r.title)).map((r) => r.sub);
  ok(subs.every((s) => /chantiers|export métier/i.test(s)), 'UI : les sous-titres métier clarifient la différence (§23)', 'UI');
  ok(rows.all.every((r) => r.tag === 'BUTTON'), 'UI : toutes les lignes sont de vrais boutons — accessibles clavier (§63)', 'UI');

  const kb = await ev(p, () => {
    const row = [...document.querySelectorAll('.settings-row')].find((r) => r.querySelector('b').textContent.trim() === 'Restaurer une sauvegarde');
    row.focus();
    return { focused: document.activeElement === row, tag: document.activeElement.tagName };
  });
  ok(kb.focused && kb.tag === 'BUTTON', 'UI : « Restaurer une sauvegarde » reçoit le focus clavier', 'UI');

  const dark = await ev(p, () => {
    app.settings.appearance = 'dark'; document.body.classList.add('dark'); save();
    readKanvixBackupFile(new File([JSON.stringify(buildKanvixBackup())], 'b.json', { type: 'application/json' }));
    return true;
  });
  await p.waitForTimeout(400);
  const darkStyle = await ev(p, () => {
    const m = document.querySelector('#modalContent'), s = m.querySelector('.backup-summary');
    if (!s) return null;
    const cs = getComputedStyle(s), rgb = (c) => (c.match(/\d+/g) || []).map(Number);
    return { bg: cs.backgroundColor, fg: cs.color, light: rgb(cs.backgroundColor)[0] > 240 };
  });
  note('UI', { darkStyle });
  ok(darkStyle && !darkStyle.light, 'UI : la modal de restauration est compatible dark (§64)', 'UI');
  ok(darkStyle.fg !== darkStyle.bg, 'UI : contraste suffisant', 'UI');
  await p.screenshot({ path: SHOTS + '05-modal-dark.png', fullPage: true });
  await ev(p, () => cancelKanvixRestore());
  await p.waitForTimeout(200);
  await ctx.close();

  for (const w of [1920, 1440, 900, 430, 390]) {
    const { ctx: c2, p: p2 } = await newPage(w, 900, 'UI-' + w);
    await dismissNotice(p2);
    await ev(p2, () => { setDepth('pilot'); go('more'); });
    await p2.waitForTimeout(220);
    const r = await ev(p2, () => {
      readKanvixBackupFile(new File([JSON.stringify(buildKanvixBackup())], 'b.json', { type: 'application/json' }));
      return true;
    });
    await p2.waitForTimeout(400);
    const m = await ev(p2, () => {
      const mc = document.querySelector('#modalContent'), r0 = mc.getBoundingClientRect();
      return {
        visible: document.querySelector('#modal').classList.contains('open'),
        buttons: [...mc.querySelectorAll('.pop-actions button')].map((x) => x.textContent.trim()),
        inView: r0.right <= innerWidth + 1 && r0.left >= -1,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    note('UI', { w, ...m });
    ok(m.visible && m.buttons.includes('Restaurer') && m.buttons.includes('Annuler'), `UI : ${w}px — workflow utilisable`, 'UI');
    ok(m.inView && !m.hscroll, `UI : ${w}px — aucun débordement (§65)`, 'UI');
    if (w === 390) await p2.screenshot({ path: SHOTS + '06-mobile-390.png', fullPage: true });
    await c2.close();
  }
}

// ---- ANNULATION ----
console.log('\n[ANNULATION] Annuler laisse l’état intact');
{
  const { ctx, p } = await newPage(1440, 1000, 'CANCEL');
  await dismissNotice(p);
  await run(p, RICH);
  const before = await fingerprint(p);
  const { file } = await downloadBackup(p, 'cancel');
  await ev(p, () => { task('k-control').name = 'MODIFIÉ APRÈS SAUVEGARDE'; save(); });
  const modified = await fingerprint(p);
  await restoreBackup(p, file);
  await ev(p, () => cancelKanvixRestore());
  await p.waitForTimeout(250);
  const after = await fingerprint(p);
  ok(JSON.stringify(after) === JSON.stringify(modified), 'ANNULATION : « Annuler » laisse l’état courant strictement intact', 'ANNULATION');
  ok(JSON.stringify(after) !== JSON.stringify(before), 'ANNULATION : la restauration n’a bien pas eu lieu', 'ANNULATION');
  const pending = await ev(p, () => pendingKanvixBackup);
  ok(pending === null, 'ANNULATION : le candidat en attente est libéré', 'ANNULATION');
  await ctx.close();
}

// ---- PURETÉ ----
console.log('\n[PURETE] buildKanvixBackup ne mute rien');
{
  const { ctx, p } = await newPage(1440, 1000, 'PURE');
  await dismissNotice(p);
  await run(p, RICH);
  const r = await ev(p, () => {
    const snap = () => JSON.stringify(app);
    const before = snap(), storeBefore = localStorage.getItem(STORE);
    const payload = buildKanvixBackup();
    buildKanvixBackup();
    return {
      pure: before === snap(),
      storeUntouched: storeBefore === localStorage.getItem(STORE),
      undoNotEmptied: app.undoStack.length >= 0,
      payloadIsolated: payload.state !== app && payload.state.tasks !== app.tasks,
      noSecondStore: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
    };
  });
  note('PURETE', r);
  ok(r.pure, 'PURETE : buildKanvixBackup() ne modifie pas app (§9)', 'PURETE');
  ok(r.storeUntouched, 'PURETE : aucune écriture dans localStorage', 'PURETE');
  ok(r.payloadIsolated, 'PURETE : le payload est un clone isolé', 'PURETE');
  ok(r.noSecondStore.every((k) => k === 'kanvix-product-8-3'), 'PURETE : aucune seconde clé de sauvegarde dans localStorage (§48)', 'PURETE');
  await ctx.close();
}

// ---- STORE / SCHEMA ----
console.log('\n[SCHEMA] STORE et SCHEMA_VERSION inchangés');
{
  const { ctx, p } = await newPage(1440, 1000, 'SCH');
  await dismissNotice(p);
  const r = await ev(p, () => ({ schema: SCHEMA_VERSION, store: STORE, backupVersion: KANVIX_BACKUP_VERSION }));
  note('SCHEMA', r);
  ok(r.schema === 8, 'SCHEMA : SCHEMA_VERSION reste 8 (§56)', 'SCHEMA');
  ok(r.store === 'kanvix-product-8-3', 'SCHEMA : STORE inchangé (§55)', 'SCHEMA');
  ok(r.backupVersion === 1, 'SCHEMA : le format de sauvegarde a son propre backupVersion', 'SCHEMA');
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
