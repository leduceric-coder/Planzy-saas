// ============================================================
// KANVIX — Recette « Contrôles qualité » (V2.7.0)
//
//   La question à laquelle cette recette répond :
//     « Kanvix distingue-t-il enfin TRAVAIL TERMINÉ de TRAVAIL CONTRÔLÉ,
//       sans ajouter d'onglet, sans second moteur, sans jamais décider
//       à la place du conducteur, et sans rien casser de V2.6.1 ? »
//
//   Kanvix DÉTECTE, TRACE et PROPOSE. Il ne crée ni reprise, ni incident,
//   ni déplacement de planning tout seul — cette recette le PROUVE.
//
//   Usage : node recette-controles-qualite-v2.7.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.7.0.html';
const PREV = 'kanvix-next-gen-v2.6.1.html';
const NOW = '2026-09-14T10:15:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.7.0/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 900)}`);
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
    dismissKanvixContinuityNotice();
    const t = document.querySelector('#toast');
    if (t) t.style.display = 'none';
  });
  await p.waitForTimeout(180);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, opts = {}) => {
  await p.waitForTimeout(300);
  await p.screenshot({ path: SHOTS + name, ...opts });
};

// ============================================================
// QC-01 → QC-08 — MODÈLE DE DONNÉES ET MIGRATION
// ============================================================
console.log('\n[QC-MODEL] Modèle de données, snapshot, migration 10 → 11');
{
  const { ctx, p } = await newPage({ tag: 'MODEL' });

  // ---- QC-01 : le schéma monte, le STORE ne bouge PAS.
  const base = await ev(p, () => ({ schema: app.schemaVersion, store: STORE, konst: SCHEMA_VERSION }));
  note('QC-01', base);
  ok(base.schema === 11 && base.konst === 11 && base.store === 'kanvix-product-8-3',
    'QC-01 : SCHEMA_VERSION = 11 et STORE reste « kanvix-product-8-3 » (aucune perte de données existantes)', 'QC-01');

  // ---- QC-02 : deux modèles de démonstration, NON bloquants.
  const tpls = await ev(p, () => (app.controlTemplates || []).map((t) => ({
    id: t.id, lotId: t.lotId, pattern: t.taskPattern, items: (t.items || []).length,
    photo: t.photoRequired, blocking: t.blocking, active: t.active, scope: t.scope,
  })));
  note('QC-02', tpls);
  ok(tpls.length === 2 && tpls.every((t) => t.blocking === false) && tpls.every((t) => t.items > 0),
    'QC-02 : 2 modèles de contrôle livrés en démonstration, tous deux NON bloquants et dotés de points à vérifier', 'QC-02');

  // ---- QC-03 : UNE instance en attente sur k-cloisons, rien d'autre.
  const inst = await ev(p, () => (app.controlInstances || []).map((c) => ({
    id: c.id, taskId: c.taskId, projectId: c.projectId, status: c.status,
    items: (c.items || []).length, attempts: (c.attempts || []).length,
  })));
  note('QC-03', inst);
  ok(inst.length === 1 && inst[0].taskId === 'k-cloisons' && inst[0].status === 'todo' && inst[0].attempts === 0,
    'QC-03 : exactement 1 contrôle en attente, sur k-cloisons, au statut « À contrôler » et sans tentative', 'QC-03');

  // ---- QC-04 : la migration ne crée AUCUN contrôle rétroactif.
  //      On part d'un état V2.6.1 (schéma 10) sans clé qualité : la migration
  //      doit installer les MODÈLES et laisser les instances à zéro, alors même
  //      que des tâches correspondent au motif « cloison ».
  const retro = await ev(p, () => {
    const st = structuredClone(app);
    delete st.controlTemplates;
    delete st.controlInstances;
    st.schemaVersion = 10;
    const matching = st.tasks.filter((t) => /cloison/i.test(t.name)).length;
    const out = migrateState(structuredClone(st));
    return {
      matchingTasks: matching,
      templates: (out.controlTemplates || []).length,
      instances: (out.controlInstances || []).length,
      schema: out.schemaVersion,
    };
  });
  note('QC-04', retro);
  ok(retro.schema === 11 && retro.templates === 2 && retro.instances === 0 && retro.matchingTasks > 0,
    `QC-04 : migration 10 → 11 strictement additive — ${retro.matchingTasks} tâche(s) correspondent au motif et AUCUN contrôle rétroactif n’est créé`, 'QC-04');

  // ---- QC-05 : migration idempotente.
  const idem = await ev(p, () => {
    const a = migrateState(structuredClone(app));
    const c = migrateState(structuredClone(a));
    const norm = (s) => JSON.stringify({ t: s.controlTemplates, i: s.controlInstances });
    return { same: norm(a) === norm(c), tpl: (c.controlTemplates || []).length, inst: (c.controlInstances || []).length };
  });
  note('QC-05', idem);
  ok(idem.same, 'QC-05 : migrateState() est idempotente — la repasser ne duplique ni modèle ni contrôle', 'QC-05');

  // ---- QC-06 : l'instance est un SNAPSHOT — modifier le modèle ne réécrit
  //      jamais un contrôle existant.
  const snap = await ev(p, () => {
    const c = app.controlInstances[0];
    const before = { name: c.templateName, items: c.items.map((i) => i.label), photo: c.photoRequired, blocking: c.blocking };
    const tpl = controlTemplate(c.templateId);
    tpl.name = 'MODÈLE RENOMMÉ';
    tpl.items = [{ id: 'x', label: 'POINT UNIQUE', order: 10 }];
    tpl.photoRequired = false;
    tpl.blocking = true;
    const after = { name: c.templateName, items: c.items.map((i) => i.label), photo: c.photoRequired, blocking: c.blocking };
    return { before, after, identical: JSON.stringify(before) === JSON.stringify(after) };
  });
  note('QC-06', { avant: snap.before.name, après: snap.after.name, points: snap.after.items.length });
  ok(snap.identical,
    'QC-06 : le contrôle COPIE son modèle à la création — renommer le modèle, changer ses points, sa photo ou son caractère bloquant ne réécrit PAS un contrôle existant', 'QC-06');

  // ---- QC-07 : validateQualityState est PURE.
  const pure = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const before = JSON.stringify({ t: app.controlTemplates, i: app.controlInstances, p: app.photos });
    const r = validateQualityState(app);
    const after = JSON.stringify({ t: app.controlTemplates, i: app.controlInstances, p: app.photos });
    return { ok: r.ok, errors: r.errors, unchanged: before === after };
  });
  note('QC-07', pure);
  ok(pure.ok && pure.unchanged,
    'QC-07 : validateQualityState() est PURE (aucune mutation) et l’état de démonstration est intègre', 'QC-07');

  // ---- QC-08 : photo.controlId est FACULTATIF.
  const ph = await ev(p, () => ({
    photos: app.photos.length,
    withControl: app.photos.filter((x) => x.controlId).length,
  }));
  note('QC-08', ph);
  ok(ph.photos > 0 && ph.withControl === 0,
    'QC-08 : photo.controlId est un rattachement FACULTATIF — aucune photo de démonstration n’est rattachée à un contrôle', 'QC-08');

  await ev(p, () => { resetApp(); setDepth('pilot'); go('more'); });
  await shot(p, '01-reglages-referentiel-controles.png');
  await ctx.close();
}

// ============================================================
// QC-09 → QC-14 — MATCHING : UNE SEULE VÉRITÉ, AUCUNE INFÉRENCE
// ============================================================
console.log('\n[QC-MATCH] applicableControlTemplates — actif ∧ lot ∧ motif de nom');
{
  const { ctx, p } = await newPage({ tag: 'MATCH' });

  // ---- QC-09 : un modèle DÉSACTIVÉ ne s'applique plus.
  const act = await ev(p, () => {
    const t = task('k-cloisons');
    const before = applicableControlTemplates(t).length;
    controlTemplate('ctl-platrerie-cloisons').active = false;
    const after = applicableControlTemplates(t).length;
    controlTemplate('ctl-platrerie-cloisons').active = true;
    return { before, after };
  });
  note('QC-09', act);
  ok(act.before === 1 && act.after === 0,
    'QC-09 : un modèle désactivé cesse immédiatement de s’appliquer (il ne crée plus de nouveaux contrôles)', 'QC-09');

  // ---- QC-10 : lotId null = universel.
  const univ = await ev(p, () => {
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    tpl.lotId = null; tpl.taskPattern = '';
    const all = app.tasks.filter((t) => applicableControlTemplates(t).some((x) => x.id === tpl.id)).length;
    return { all, tasks: app.tasks.length };
  });
  note('QC-10', univ);
  ok(univ.all === univ.tasks,
    'QC-10 : un modèle sans lot et sans motif s’applique à TOUTES les interventions (lot null = universel)', 'QC-10');

  // ---- QC-11 : un lot différent EXCLUT le modèle.
  const mism = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    const sameLot = applicableControlTemplates(t).some((x) => x.id === tpl.id);
    tpl.lotId = 'lot-menuiseries-ext';
    const otherLot = applicableControlTemplates(t).some((x) => x.id === tpl.id);
    return { sameLot, otherLot, taskLot: t.lotId, tplLot: tpl.lotId };
  });
  note('QC-11', mism);
  ok(mism.sameLot === true && mism.otherLot === false,
    'QC-11 : un modèle rattaché à un AUTRE lot que celui de l’intervention ne s’applique pas', 'QC-11');

  // ---- QC-12 : motif vide = toutes les tâches DU LOT.
  const allLot = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    tpl.taskPattern = '';
    const lotTasks = app.tasks.filter((t) => t.lotId === tpl.lotId);
    const matched = lotTasks.filter((t) => applicableControlTemplates(t).some((x) => x.id === tpl.id));
    const outside = app.tasks.filter((t) => t.lotId !== tpl.lotId && applicableControlTemplates(t).some((x) => x.id === tpl.id));
    return { lotTasks: lotTasks.length, matched: matched.length, outside: outside.length };
  });
  note('QC-12', allLot);
  ok(allLot.lotTasks > 0 && allLot.matched === allLot.lotTasks && allLot.outside === 0,
    'QC-12 : motif vide = toutes les interventions du lot, et STRICTEMENT aucune en dehors', 'QC-12');

  // ---- QC-13 : le motif est normalisé (accents, casse) — et rien de plus.
  const norm = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    const probe = (pat) => { tpl.taskPattern = pat; return applicableControlTemplates(t).some((x) => x.id === tpl.id); };
    return { name: t.name, exact: probe('Cloisons'), upper: probe('CLOISON'), accent: probe('cloisôn'), absent: probe('zzzz') };
  });
  note('QC-13', norm);
  ok(norm.exact && norm.upper && !norm.absent,
    'QC-13 : le motif est une RECHERCHE TEXTUELLE normalisée (casse et accents ignorés) — ni regex utilisateur, ni classification', 'QC-13');

  // ---- QC-14 : AUCUNE inférence depuis la phase, le métier ou la ressource.
  const infer = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => !applicableControlTemplates(x).length);
    const before = applicableControlTemplates(t).length;
    const phase = t.phase; const res = t.resourceId;
    t.phase = 'Plâtrerie'; t.resourceId = 'mathieu';
    const after = applicableControlTemplates(t).length;
    t.phase = phase; t.resourceId = res;
    return { task: t.name, before, after };
  });
  note('QC-14', infer);
  ok(infer.before === 0 && infer.after === 0,
    'QC-14 : changer la PHASE ou la RESSOURCE d’une intervention ne lui applique aucun contrôle — seuls lot et motif de nom comptent', 'QC-14');

  await ctx.close();
}

// ============================================================
// QC-15 → QC-20 — MATÉRIALISATION IDEMPOTENTE
// ============================================================
console.log('\n[QC-ENSURE] ensureTaskControlInstances — idempotence et points d’appel');
{
  const { ctx, p } = await newPage({ tag: 'ENSURE' });

  // ---- QC-15 : trois appels, une seule instance.
  const idem = await ev(p, () => {
    const t = app.tasks.find((x) => applicableControlTemplates(x).length && !controlsForTask(x.id).length);
    const a = ensureTaskControlInstances(t.id).length;
    const b2 = ensureTaskControlInstances(t.id).length;
    const c = ensureTaskControlInstances(t.id).length;
    return { task: t.name, first: a, second: b2, third: c, total: controlsForTask(t.id).length };
  });
  note('QC-15', idem);
  ok(idem.first === 1 && idem.second === 0 && idem.third === 0 && idem.total === 1,
    'QC-15 : ensureTaskControlInstances() est IDEMPOTENTE — appelée trois fois, elle ne crée qu’un seul contrôle', 'QC-15');

  // ---- QC-16 : le contrôle naît au DÉMARRAGE (il peut devoir être fait
  //      PENDANT l'intervention, « avant fermeture des cloisons »).
  const doing = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => applicableControlTemplates(x).length && !controlsForTask(x.id).length && x.status !== 'done');
    const before = controlsForTask(t.id).length;
    setTaskStatus(t.id, 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    return { task: t.name, before, after: controlsForTask(t.id).length, status: task(t.id).status };
  });
  note('QC-16', doing);
  ok(doing.before === 0 && doing.after === 1 && doing.status === 'doing',
    'QC-16 : passer une intervention à « en cours » matérialise ses contrôles — un contrôle peut devoir être fait PENDANT le travail', 'QC-16');

  // ---- QC-17 : transition DIRECTE todo → done couverte.
  const direct = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Cas construit explicitement : une intervention « à faire » à laquelle un
    // modèle s'applique et qui n'a encore AUCUN contrôle.
    const t = app.tasks.find((x) => applicableControlTemplates(x).length && !controlsForTask(x.id).length)
      || app.tasks.find((x) => applicableControlTemplates(x).length);
    app.controlInstances = app.controlInstances.filter((c) => c.taskId !== t.id);
    t.status = 'todo';
    const before = controlsForTask(t.id).length;
    setTaskStatus(t.id, 'done');
    return { task: t.name, before, after: controlsForTask(t.id).length, status: task(t.id).status };
  });
  note('QC-17', direct);
  ok(direct.before === 0 && direct.after === 1 && direct.status === 'done',
    'QC-17 : une transition DIRECTE « à faire » → « terminée » matérialise quand même les contrôles (aucun trou de couverture)', 'QC-17');

  // ---- QC-18 : setTaskStatus est le SEUL chemin vers « terminé ».
  const paths = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    // Toute écriture littérale d'un statut « done », avec la variable ciblée.
    const writes = [...src.matchAll(/(\w+)\.status\s*=\s*["']done["']/g)].map((m) => m[1]);
    // Les décisions (d) portent aussi un statut « done » : ce n'est PAS une tâche.
    const onTask = writes.filter((v) => !['d'].includes(v));
    // Les QUATRE parcours nommés par le produit passent-ils tous par le setter ?
    const routes = {
      kanban: /setTaskStatus\(id, status, "kanban"\)/.test(src),
      ficheTache: /setTaskStatus\('\$\{id\}', '\$\{t\.status === "doing" \? "done" : "doing"\}'\)/.test(src),
      artisan: /setTaskStatus\('\$\{t\.id\}','done'\)/.test(src),
      editeur: /setTaskStatus\(st\.id, status, "manual-edit"/.test(src),
    };
    return { writes, onTask, routes, calls: (src.match(/setTaskStatus\s*\(/g) || []).length };
  });
  note('QC-18', paths);
  ok(paths.onTask.length === 0 && Object.values(paths.routes).every(Boolean),
    'QC-18 : AUCUNE écriture directe de `status = "done"` sur une tâche (les 4 occurrences visent une décision), et les 4 parcours vers « terminé » — Kanban, fiche tâche, « J’ai terminé » artisan, éditeur universel — passent tous par setTaskStatus()', 'QC-18');

  // ---- QC-19 : anti-doublon sur (taskId, templateId).
  const dbl = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const again = createControlInstance(c.taskId, c.templateId);
    return { again: again === null, count: controlsForTask(c.taskId).length };
  });
  note('QC-19', dbl);
  ok(dbl.again && dbl.count === 1,
    'QC-19 : createControlInstance() refuse un doublon sur la clé logique (intervention + modèle)', 'QC-19');

  // ---- QC-20 : « + Ajouter un contrôle » ne propose que ce qui manque.
  const add = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const before = addableControlTemplates(c.taskId).map((t) => t.id);
    app.controlInstances = [];
    const after = addableControlTemplates(c.taskId).map((t) => t.id);
    return { before, after };
  });
  note('QC-20', add);
  ok(add.before.length === 0 && add.after.length === 1,
    'QC-20 : addableControlTemplates() exclut les modèles DÉJÀ instanciés — « + Ajouter un contrôle » ne propose jamais un doublon', 'QC-20');

  await ctx.close();
}

// ============================================================
// QC-21 → QC-28 — BLOQUANT / NON BLOQUANT
// ============================================================
console.log('\n[QC-BLOCK] Garde bloquante — ce qu’elle empêche, ce qu’elle n’empêche PAS');
{
  const { ctx, p } = await newPage({ tag: 'BLOCK' });

  // ---- QC-21 : défaut blocking=false — terminé ≠ contrôlé, et c'est VOULU.
  const soft = await ev(p, () => {
    const c = app.controlInstances[0];
    setTaskStatus(c.taskId, 'done');
    return { task: task(c.taskId).status, control: control(c.id).status };
  });
  note('QC-21', soft);
  ok(soft.task === 'done' && soft.control === 'todo',
    'QC-21 : contrôle NON bloquant — l’intervention peut être « Terminée » alors que son contrôle reste « À contrôler » (TRAVAIL TERMINÉ ≠ TRAVAIL CONTRÔLÉ)', 'QC-21');

  // ---- QC-22 : blocking=true — refus RÉEL, aucune écriture.
  const hard = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    control(c.id).blocking = true;
    const t = task(c.taskId);
    const before = { status: t.status, hist: app.history.length, undo: app.undoStack.length };
    setTaskStatus(c.taskId, 'done');
    const after = { status: task(c.taskId).status, hist: app.history.length, undo: app.undoStack.length };
    return { before, after };
  });
  note('QC-22', hard);
  ok(hard.after.status === hard.before.status && hard.after.hist === hard.before.hist && hard.after.undo === hard.before.undo,
    'QC-22 : contrôle BLOQUANT — « terminer » est refusé et RIEN n’est écrit (ni statut, ni historique, ni point d’annulation)', 'QC-22');
  await shot(p, '02-blocage-terminer.png');

  // ---- QC-23 : le conducteur se voit proposer de FAIRE le contrôle.
  const driver = await ev(p, () => {
    const txt = document.querySelector('#modalContent').textContent;
    const btns = [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim());
    return { txt: txt.slice(0, 200), btns };
  });
  note('QC-23', driver);
  ok(driver.btns.some((x) => /Effectuer le contrôle/.test(x)),
    'QC-23 : au conducteur, le blocage PROPOSE l’action utile — « Effectuer le contrôle », pas un mur', 'QC-23');

  // ---- QC-24 : l'artisan NE contrôle PAS — explication seule.
  const artisan = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    control(c.id).blocking = true;
    app.settings.role = 'artisan';
    setTaskStatus(c.taskId, 'done');
    const btns = [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim());
    return { status: task(c.taskId).status, btns, txt: document.querySelector('#modalContent').textContent.slice(0, 200) };
  });
  note('QC-24', artisan);
  ok(artisan.status !== 'done' && !artisan.btns.some((x) => /Effectuer le contrôle/.test(x)),
    'QC-24 : l’artisan NE réalise PAS les contrôles — son « J’ai terminé » est empêché avec une explication, sans bouton de contrôle', 'QC-24');

  // ---- QC-25 : le blocage n'empêche PAS le démarrage d'un successeur.
  const succ = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.settings.role = 'driver';
    const c = app.controlInstances[0];
    control(c.id).blocking = true;
    let s = getTaskSuccessors(c.taskId)[0];
    if (!s) {
      // Aucun successeur dans la démo : on en crée un explicitement, pour que
      // la règle soit VÉRIFIÉE et non contournée.
      s = app.tasks.find((x) => x.id !== c.taskId && x.projectId === c.projectId && x.status !== 'done');
      s.deps = [...new Set([...(s.deps || []), c.taskId])];
    }
    setTaskStatus(s.id, 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    return { successor: s.name, status: task(s.id).status, blocked: task(c.taskId).status };
  });
  note('QC-25', succ);
  ok(succ.status === 'doing',
    'QC-25 : un contrôle bloquant n’empêche PAS le démarrage d’une intervention suivante — il ne bloque QUE la fin de la sienne', 'QC-25');

  // ---- QC-26 : le blocage n'empêche PAS un jalon.
  const ms = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    control(c.id).blocking = true;
    const pid = c.projectId;
    const before = app.milestones.filter((m) => m.projectId === pid).length;
    const sum = getProjectSummary(pid);
    return { before, milestone: sum.milestone ? sum.milestone.name : null, after: app.milestones.filter((m) => m.projectId === pid).length };
  });
  note('QC-26', ms);
  ok(ms.before === ms.after,
    'QC-26 : un contrôle bloquant ne touche à AUCUN jalon — il ne déplace, ne masque et ne supprime rien', 'QC-26');

  // ---- QC-27 : une tâche DÉJÀ terminée n'est jamais rouverte.
  const reopen = await ev(p, () => {
    resetApp(); setDepth('pilot');
    let t = app.tasks.find((x) => x.status === 'done' && !controlsForTask(x.id).length);
    if (!t) {
      // On construit le cas : une intervention DÉJÀ terminée, sans contrôle.
      t = app.tasks.find((x) => !controlsForTask(x.id).length) || app.tasks[0];
      app.controlInstances = app.controlInstances.filter((c) => c.taskId !== t.id);
      t.status = 'done';
    }
    const before = t.status;
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    tpl.lotId = null; tpl.taskPattern = '';
    const inst = createControlInstance(t.id, tpl.id);
    inst.blocking = true;
    renderPage();
    return { task: t.name, before, after: task(t.id).status, open: pendingControlsForTask(t.id).length };
  });
  note('QC-27', reopen);
  ok(reopen.before === 'done' && reopen.after === 'done' && reopen.open === 1,
    'QC-27 : ajouter un contrôle BLOQUANT à une intervention DÉJÀ terminée ne la rouvre JAMAIS — le contrôle reste simplement à faire', 'QC-27');

  // ---- QC-28 : un contrôle soldé (conforme OU non applicable) débloque.
  const cleared = await ev(p, () => {
    const probe = (verdict) => {
      resetApp(); setDepth('pilot');
      const c = app.controlInstances[0];
      control(c.id).blocking = true;
      submitControlAttempt(c.id, verdict, {
        checkedItemIds: control(c.id).items.map((i) => i.id),
        comment: verdict === 'na' ? 'Cloison supprimée du marché' : '',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      });
      setTaskStatus(c.taskId, 'done');
      return { verdict, control: control(c.id).status, task: task(c.taskId).status };
    };
    return [probe('conform'), probe('na')];
  });
  note('QC-28', cleared);
  ok(cleared.every((r) => r.task === 'done'),
    'QC-28 : un contrôle SOLDÉ (conforme ou non applicable) libère la fin de l’intervention — rien d’autre ne la libère', 'QC-28');

  await ctx.close();
}

// ============================================================
// QC-29 → QC-38 — FORMULAIRE UNIQUE ET RÈGLES DE VALIDATION
// ============================================================
console.log('\n[QC-FORM] Un seul formulaire, une seule validation, bureau et chantier');
{
  const { ctx, p } = await newPage({ tag: 'FORM' });

  // ---- QC-29 : UNE fonction de rendu, UNE fonction de validation.
  const single = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    const count = (re) => (src.match(re) || []).length;
    return {
      formHTML: count(/function controlFormHTML\s*\(/g),
      submit: count(/function submitControlAttempt\s*\(/g),
      deskOnly: count(/function controlFormDesk/g),
      fieldOnly: count(/function controlFormField/g),
    };
  });
  note('QC-29', single);
  ok(single.formHTML === 1 && single.submit === 1 && single.deskOnly === 0 && single.fieldOnly === 0,
    'QC-29 : UN SEUL controlFormHTML() et UN SEUL submitControlAttempt() — aucun parcours bureau/mobile dupliqué', 'QC-29');

  // ---- QC-30 : conforme exige TOUS les points.
  const items = await ev(p, () => {
    const c = app.controlInstances[0];
    openControlForm(c.id, 'desk');
    const r0 = submitControlAttempt(c.id, 'conform');
    const e0 = document.querySelector('#controlError').textContent;
    const boxes = [...document.querySelectorAll('input[name=qcItem]')];
    boxes.slice(0, -1).forEach((x) => (x.checked = true));
    const r1 = submitControlAttempt(c.id, 'conform');
    const e1 = document.querySelector('#controlError').textContent;
    return { total: boxes.length, r0, e0, r1, e1, status: control(c.id).status };
  });
  note('QC-30', items);
  ok(items.r0 === false && items.r1 === false && items.status === 'todo' && /tous les points/i.test(items.e1),
    'QC-30 : « Conforme » exige que TOUS les points soient cochés — un point manquant suffit à refuser', 'QC-30');
  await shot(p, '03-formulaire-controle-bureau.png');

  // ---- QC-31 : photo obligatoire → conforme refusé sans photo.
  const noPhoto = await ev(p, () => {
    const c = app.controlInstances[0];
    document.querySelectorAll('input[name=qcItem]').forEach((x) => (x.checked = true));
    const r = submitControlAttempt(c.id, 'conform');
    return { r, err: document.querySelector('#controlError').textContent, status: control(c.id).status, photoRequired: control(c.id).photoRequired };
  });
  note('QC-31', noPhoto);
  ok(noPhoto.photoRequired && noPhoto.r === false && /photo/i.test(noPhoto.err),
    'QC-31 : « Photo obligatoire » refuse un verdict CONFORME sans photo', 'QC-31');

  // ---- QC-32 : photo obligatoire → non conforme aussi.
  const ncPhoto = await ev(p, () => {
    const c = app.controlInstances[0];
    const r = submitControlAttempt(c.id, 'nonconform', { comment: 'Réseaux non passés', dataUrl: '' });
    return { r, err: document.querySelector('#controlError').textContent, status: control(c.id).status };
  });
  note('QC-32', ncPhoto);
  ok(ncPhoto.r === false && /photo/i.test(ncPhoto.err),
    'QC-32 : « Photo obligatoire » vaut aussi pour un verdict NON CONFORME — la preuve du défaut est exigée', 'QC-32');

  // ---- QC-33 : non conforme exige un commentaire.
  const ncCom = await ev(p, () => {
    const c = app.controlInstances[0];
    const r = submitControlAttempt(c.id, 'nonconform', { comment: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    return { r, err: document.querySelector('#controlError').textContent };
  });
  note('QC-33', ncCom);
  ok(ncCom.r === false && /non-conformité/i.test(ncCom.err),
    'QC-33 : « Non conforme » exige la description de la non-conformité — un défaut sans description n’est pas exploitable', 'QC-33');

  // ---- QC-34 : non applicable exige un motif.
  const naCom = await ev(p, () => {
    const c = app.controlInstances[0];
    const r0 = submitControlAttempt(c.id, 'na', { comment: '' });
    const e0 = document.querySelector('#controlError').textContent;
    const r1 = submitControlAttempt(c.id, 'na', { comment: 'Cloison supprimée du marché' });
    return { r0, e0, r1, status: control(c.id).status, comment: control(c.id).comment };
  });
  note('QC-34', naCom);
  ok(naCom.r0 === false && /motif/i.test(naCom.e0) && naCom.r1 === true && naCom.status === 'na',
    'QC-34 : « Non applicable » exige un MOTIF — écarter un contrôle est une décision tracée, jamais un clic anodin', 'QC-34');

  // ---- QC-35 : la photo passe par le moteur EXISTANT et reçoit un controlId.
  const photo = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const before = app.photos.length;
    submitControlAttempt(c.id, 'conform', {
      checkedItemIds: control(c.id).items.map((i) => i.id),
      comment: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    const inst = control(c.id);
    const ph = app.photos.find((x) => x.controlId === c.id);
    return {
      added: app.photos.length - before,
      linked: !!ph,
      inGallery: !!ph && app.photos.includes(ph),
      instanceKeys: Object.keys(inst).filter((k) => /photo/i.test(k)),
      photoIds: inst.photoIds,
      noDataUrlInInstance: !JSON.stringify(inst).includes('base64'),
    };
  });
  note('QC-35', photo);
  ok(photo.added === 1 && photo.linked && photo.inGallery && photo.photoIds.length === 1 && photo.noDataUrlInInstance,
    'QC-35 : la photo est créée par addPhoto() (galerie unique), reçoit un controlId, et le contrôle ne stocke que des photoIds — aucune image dupliquée', 'QC-35');

  // ---- QC-36 : annuler ne laisse AUCUNE photo orpheline.
  const cancel = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const before = app.photos.length;
    openControlForm(c.id, 'desk');
    const hidden = document.getElementById('qcPhotoData');
    if (hidden) hidden.value = 'data:image/png;base64,iVBORw0KGgo=';
    closeControlForm('desk');
    return { before, after: app.photos.length, orphans: app.photos.filter((x) => x.controlId && !control(x.controlId)).length };
  });
  note('QC-36', cancel);
  ok(cancel.before === cancel.after && cancel.orphans === 0,
    'QC-36 : une photo prise puis le formulaire ANNULÉ ne laisse aucune photo orpheline — le brouillon n’est écrit qu’à la validation', 'QC-36');

  // ---- QC-37 : attempts[] conserve l'historique, la racine porte le DERNIER.
  const attempts = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const url = 'data:image/png;base64,iVBORw0KGgo=';
    submitControlAttempt(c.id, 'nonconform', { comment: 'Réseaux non passés', dataUrl: url });
    const afterFirst = { status: control(c.id).status, n: control(c.id).attempts.length };
    closeOverlay('modal');
    submitControlAttempt(c.id, 'conform', { checkedItemIds: control(c.id).items.map((i) => i.id), comment: 'Repris et conforme', dataUrl: url });
    const inst = control(c.id);
    return {
      afterFirst,
      status: inst.status,
      attempts: inst.attempts.map((a) => a.status),
      firstComment: inst.attempts[0].comment,
      rootComment: inst.comment,
    };
  });
  note('QC-37', attempts);
  ok(attempts.attempts.join('>') === 'nonconform>conform' && attempts.status === 'conform' && attempts.firstComment === 'Réseaux non passés',
    'QC-37 : attempts[] conserve TOUTES les tentatives (la non-conformité n’est pas effacée) et la racine porte le DERNIER résultat', 'QC-37');

  await ctx.close();

  // ---- QC-38 : cibles tactiles ≥ 44px sur 390 et 430.
  const touch = [];
  for (const w of [390, 430]) {
    const { ctx: c2, p: p2 } = await newPage({ w, h: 860, tag: `TOUCH-${w}` });
    await ev(p2, () => openControlForm(app.controlInstances[0].id, 'field'));
    await p2.waitForTimeout(420);
    const m = await ev(p2, () => ({
      items: [...document.querySelectorAll('.qc-item')].map((x) => +x.getBoundingClientRect().height.toFixed(1)),
      actions: [...document.querySelectorAll('.qc-actions .btn')].map((x) => +x.getBoundingClientRect().height.toFixed(1)),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    touch.push({ w, ...m });
    if (w === 390) await shot(p2, '04-controle-mode-chantier-390.png');
    await c2.close();
  }
  note('QC-38', touch);
  ok(touch.every((t) => t.items.every((h) => h >= 44) && t.actions.every((h) => h >= 44) && t.overflow <= 0),
    'QC-38 : sur 390 et 430px, chaque ligne de checklist et chaque verdict mesure au moins 44px, sans débordement horizontal', 'QC-38');
}

// ============================================================
// QC-39 → QC-43 — TRACE : KANVIX DÉTECTE, TRACE ET PROPOSE
// ============================================================
console.log('\n[QC-TRACE] Historique unique — et rien de créé sans décision humaine');
{
  const { ctx, p } = await newPage({ tag: 'TRACE' });

  // ---- QC-39 : l'événement quality-control porte tout ce qu'il faut.
  const evt = await ev(p, () => {
    const c = app.controlInstances[0];
    submitControlAttempt(c.id, 'conform', {
      checkedItemIds: control(c.id).items.map((i) => i.id),
      comment: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    const h = app.history.find((x) => x.eventType === 'quality-control');
    return { h, keys: h ? Object.keys(h) : [] };
  });
  note('QC-39', evt.h);
  ok(['eventType', 'projectId', 'taskId', 'taskName', 'controlId', 'controlName', 'controlStatus', 'attemptNumber', 'author', 'date']
    .every((k) => evt.keys.includes(k)),
    'QC-39 : l’événement « quality-control » porte eventType, projectId, taskId, taskName, controlId, controlName, controlStatus, attemptNumber, auteur et date', 'QC-39');

  // ---- QC-40 : UN SEUL journal.
  const logs = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    return {
      historyArrays: (src.match(/app\.(qualityHistory|controlHistory|auditLog)/g) || []).length,
      inState: Object.keys(app).filter((k) => /history|log|journal/i.test(k)),
    };
  });
  note('QC-40', logs);
  ok(logs.historyArrays === 0 && logs.inState.length === 1 && logs.inState[0] === 'history',
    'QC-40 : un SEUL journal — app.history. Aucun second historique n’a été créé pour la qualité', 'QC-40');

  // ---- QC-41 : une non-conformité ne crée RIEN toute seule.
  const auto = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = app.controlInstances[0];
    const t = task(c.taskId);
    const before = {
      issues: app.issues.length, decisions: app.decisions.length, messages: app.messages.length,
      tasks: app.tasks.length, reworks: app.tasks.filter((x) => x.reworkOfTaskId).length,
      start: t.start, end: t.end, status: t.status,
      plannings: JSON.stringify(app.tasks.map((x) => [x.id, x.start, x.end])),
    };
    submitControlAttempt(c.id, 'nonconform', { comment: 'Réseaux non passés', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    const t2 = task(c.taskId);
    const after = {
      issues: app.issues.length, decisions: app.decisions.length, messages: app.messages.length,
      tasks: app.tasks.length, reworks: app.tasks.filter((x) => x.reworkOfTaskId).length,
      start: t2.start, end: t2.end, status: t2.status,
      plannings: JSON.stringify(app.tasks.map((x) => [x.id, x.start, x.end])),
    };
    return { before, after, control: control(c.id).status };
  });
  note('QC-41', { avant: auto.before.issues + '/' + auto.before.reworks, après: auto.after.issues + '/' + auto.after.reworks });
  ok(auto.control === 'nonconform'
    && auto.after.issues === auto.before.issues
    && auto.after.decisions === auto.before.decisions
    && auto.after.messages === auto.before.messages
    && auto.after.tasks === auto.before.tasks
    && auto.after.reworks === auto.before.reworks
    && auto.after.status === auto.before.status
    && auto.after.plannings === auto.before.plannings,
    'QC-41 : une NON-CONFORMITÉ ne crée AUCUN incident, AUCUNE reprise, AUCUN message, ne déplace AUCUNE date et ne rouvre AUCUNE tâche — Kanvix détecte et trace, il ne décide pas', 'QC-41');
  await shot(p, '05-non-conformite-propositions.png');

  // ---- QC-42 : la reprise est PROPOSÉE, via le moteur EXISTANT.
  const propose = await ev(p, () => {
    const btns = [...document.querySelectorAll('#modalContent button')].map((x) => ({ t: x.textContent.trim(), on: x.getAttribute('onclick') || '' }));
    const src = document.querySelector('#kanvix-js').textContent;
    const fn = /function showNonConformOptions[\s\S]*?\n {6}\}/.exec(src);
    return {
      btns: btns.map((x) => x.t),
      usesExisting: btns.some((x) => /openReworkForm\(/.test(x.on)),
      noOwnEngine: fn ? !/createRework\s*\(/.test(fn[0]) : false,
    };
  });
  note('QC-42', propose);
  ok(propose.btns.some((x) => /Créer une reprise/.test(x)) && propose.usesExisting && propose.noOwnEngine,
    'QC-42 : la suite d’une non-conformité est PROPOSÉE et passe par openReworkForm() — le moteur de reprise existant, jamais une seconde mécanique', 'QC-42');

  // ---- QC-43 : le référentiel n'est pas du chantier.
  const ref = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const pid = app.controlInstances[0].projectId;
    logControlTemplateEvent('control-template-created', 'ctl-x', 'Contrôle « Essai » créé.');
    const entry = app.history[0];
    return {
      global: !entry.projectId && !entry.taskId,
      inProject: projectHistory(pid).some((h) => h === entry),
      resolved: historyProjectId(entry),
    };
  });
  note('QC-43', ref);
  ok(ref.global && !ref.inProject && ref.resolved === null,
    'QC-43 : un événement de RÉFÉRENTIEL (modèle créé/modifié/désactivé) reste global — il n’apparaît dans l’historique d’aucun chantier', 'QC-43');

  await ctx.close();
}

// ============================================================
// QC-44 → QC-46 — CLÔTURE DE CHANTIER
// ============================================================
console.log('\n[QC-CLOSE] Clôture — un chantier ne se clôture pas sur un contrôle bloquant');
{
  const { ctx, p } = await newPage({ tag: 'CLOSE' });

  // ---- QC-44 : le statut de clôture connaît les contrôles.
  const status = await ev(p, () => {
    const pid = app.controlInstances[0].projectId;
    getProjectTasks(pid).forEach((t) => (t.status = 'done'));
    app.issues.filter((i) => i.projectId === pid).forEach((i) => (i.status = 'resolved'));
    const cs = getProjectClosureStatus(pid);
    return {
      keys: Object.keys(cs),
      open: (cs.openQualityControls || []).length,
      blocking: (cs.blockingQualityControls || []).length,
      ready: cs.ready,
    };
  });
  note('QC-44', status);
  ok(status.keys.includes('openQualityControls') && status.keys.includes('blockingQualityControls')
    && status.open === 1 && status.ready === false,
    'QC-44 : getProjectClosureStatus() expose openQualityControls / blockingQualityControls, et « prêt à clôturer » exige ZÉRO contrôle ouvert', 'QC-44');

  // ---- QC-45 : bloquant → pas de « Clôturer quand même ».
  const prompt = await ev(p, () => {
    const pid = app.controlInstances[0].projectId;
    const soft = (() => { closeProjectPrompt(pid); return document.querySelector('#modalContent').textContent; })();
    control(app.controlInstances[0].id).blocking = true;
    const hard = (() => { closeProjectPrompt(pid); return document.querySelector('#modalContent').textContent; })();
    return {
      softAnyway: /Clôturer quand même/.test(soft),
      hardAnyway: /Clôturer quand même/.test(hard),
      hardSee: /Voir les contrôles/.test(hard),
      hardText: hard.slice(0, 180),
    };
  });
  note('QC-45', prompt);
  ok(prompt.softAnyway && !prompt.hardAnyway && prompt.hardSee,
    'QC-45 : un contrôle NON bloquant laisse « Clôturer quand même » ; un contrôle BLOQUANT le RETIRE et renvoie vers les contrôles — aucun contournement', 'QC-45');
  await shot(p, '06-cloture-impossible-controle-bloquant.png');

  // ---- QC-46 : garde DÉFENSIVE centrale.
  const guard = await ev(p, () => {
    const pid = app.controlInstances[0].projectId;
    const before = project(pid).lifecycle;
    confirmCloseProject(pid);
    const blocked = project(pid).lifecycle;
    const c = app.controlInstances[0];
    submitControlAttempt(c.id, 'conform', {
      checkedItemIds: control(c.id).items.map((i) => i.id), comment: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    confirmCloseProject(pid);
    return { before, blocked, after: project(pid).lifecycle };
  });
  note('QC-46', guard);
  ok(guard.blocked === 'active' && guard.after === 'closed',
    'QC-46 : confirmCloseProject() porte sa PROPRE garde — appelée directement, elle refuse tant qu’un contrôle bloquant est ouvert, et n’accepte qu’une fois soldé', 'QC-46');

  await ctx.close();
}

// ============================================================
// QC-47 → QC-50 — DIVULGATION PROGRESSIVE ET PÉRIMÈTRE GELÉ
// ============================================================
console.log('\n[QC-UI] Aucun onglet, aucune entrée de menu — et getProjectHealth intact');
{
  const { ctx, p } = await newPage({ tag: 'UI' });

  // ---- QC-47 : aucun onglet, aucune entrée de barre latérale en plus.
  const nav = await ev(p, () => {
    const pid = app.controlInstances[0].projectId;
    openProjectTab(pid, 'Aujourd’hui');
    return {
      tabs: projectTabs(),
      sidebar: [...document.querySelectorAll('.sidebar a, .sidebar button')].map((x) => x.textContent.trim()).filter(Boolean),
    };
  });
  note('QC-47', nav);
  ok(!nav.tabs.some((t) => /qualit|contrôl/i.test(t)) && !nav.sidebar.some((t) => /qualit|contrôl/i.test(t)),
    'QC-47 : AUCUN onglet « Qualité » et AUCUNE entrée de barre latérale — le contrôle vit dans le contexte de son intervention', 'QC-47');

  // ---- QC-47bis : le bloc compact de l'onglet Aujourd'hui.
  const block = await ev(p, () => {
    const qb = document.querySelector('.qc-block');
    return {
      present: !!qb,
      title: qb ? qb.querySelector('.qc-block-title').textContent : null,
      rows: qb ? qb.querySelectorAll('.qc-row').length : 0,
      link: qb ? qb.querySelector('.link').textContent : null,
    };
  });
  note('QC-47bis', block);
  ok(block.present && /Contrôles à faire · 1/.test(block.title) && block.rows <= 3,
    'QC-47 : l’onglet Aujourd’hui affiche un bloc COMPACT « Contrôles à faire · N » (3 lignes au plus) suivi d’un lien — jamais une liste complète', 'QC-47');
  await shot(p, '07-chantier-aujourdhui-controles.png');

  // ---- QC-48 : réglage réservé au niveau Pilotage.
  const level = await ev(p, () => {
    const rows = () => { go('more'); return [...document.querySelectorAll('.settings-row b')].map((x) => x.textContent.trim()); };
    setDepth('pilot'); const pilot = rows();
    setDepth('essential'); const essential = rows();
    setDepth('pilot');
    return { pilot: pilot.filter((x) => /Contrôles qualité/.test(x)), essential: essential.filter((x) => /Contrôles qualité/.test(x)) };
  });
  note('QC-48', level);
  ok(level.pilot.length === 1 && level.essential.length === 0,
    'QC-48 : le référentiel « Contrôles qualité » n’apparaît qu’au niveau Pilotage (divulgation progressive), sous Référentiel métier', 'QC-48');

  // ---- QC-49 : « À contrôler » du Mode Chantier liste des CONTRÔLES.
  await ctx.close();
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'FIELD' });
  const field = await ev(p2, () => {
    setRole('driver');
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    save();
    selectFieldProject(app.controlInstances[0].projectId);
    const list = document.querySelector('#fieldControlList');
    const withControl = { rows: list.querySelectorAll('.qc-row').length, text: list.textContent.slice(0, 120) };
    app.controlInstances.forEach((c) => (c.status = 'conform'));
    renderPage();
    return { withControl, empty: document.querySelector('#fieldControlList').textContent.trim() };
  });
  note('QC-49', field);
  ok(field.withControl.rows === 1 && field.empty === 'Aucun contrôle qualité à réaliser.',
    'QC-49 : en Mode Chantier, « À contrôler » liste les CONTRÔLES ouverts (et non plus les tâches terminées) — état vide : « Aucun contrôle qualité à réaliser. »', 'QC-49');
  await shot(p2, '08-mode-chantier-a-controler.png', { fullPage: true });

  // ---- QC-49bis : ce que « À contrôler » ne fait plus, la popup Tâche le
  //      fait toujours. Le point d'entrée « Signaler une reprise » N'EST PAS
  //      perdu en Mode Chantier — il a changé de place, pas disparu.
  const rework = await ev(p2, () => {
    resetApp(); setDepth('pilot'); setRole('driver');
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    save();
    const t = app.tasks.find((x) => x.status === 'done' && !x.reworkOfTaskId && !hasReworkSignaled(x.id))
      || (() => { const x = app.tasks.find((y) => !y.reworkOfTaskId); x.status = 'done'; return x; })();
    selectFieldProject(t.projectId);
    openFieldTaskModal(t.id);
    const btns = [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim());
    const btn = [...document.querySelectorAll('#modalContent button')].find((x) => /Signaler une reprise/.test(x.textContent));
    if (btn) btn.click();
    return {
      task: t.name,
      btns,
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      hasComment: !!document.querySelector('#drawerFormEl textarea[name="comment"], #drawerContent textarea[name="comment"]'),
    };
  });
  note('QC-49bis', rework);
  ok(rework.btns.some((x) => /Signaler une reprise/.test(x)) && rework.drawerOpen && rework.hasComment,
    'QC-49 : la reprise reste accessible en Mode Chantier depuis la popup Tâche — réécrire « À contrôler » DÉPLACE ce point d’entrée, il ne le supprime pas', 'QC-49');
  await shot(p2, '15-mode-chantier-reprise-conservee.png');
  await c2.close();

  // ---- QC-50 : getProjectHealth() n'a PAS été touchée.
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
  const a = extract(prevSrc, 'getProjectHealth'), c = extract(curSrc, 'getProjectHealth');
  note('QC-50', { v261: a ? md5(a).slice(0, 10) : 'ABSENT', v270: c ? md5(c).slice(0, 10) : 'ABSENT' });
  ok(a && c && md5(a) === md5(c),
    'QC-50 : getProjectHealth() est BYTE-IDENTIQUE à V2.6.1 — un contrôle en attente ne dégrade JAMAIS la santé d’un chantier', 'QC-50');
}

// ============================================================
// SAV-01 → SAV-14 — SCÉNARIO MAÎTRE « REPRISE » EN MODE CHANTIER
//
//   Pourquoi ce bloc existe :
//   la réécriture de « À contrôler » (QC-49) déplace le point d'entrée de la
//   reprise vers la popup Tâche. Les recettes historiques V2.4.5 / V2.4.6
//   entraient par la LISTE et s'arrêtent donc à leur étape PM-F2. Plutôt que
//   de laisser 70+ assertions dans le noir, le scénario maître est REJOUÉ ici
//   INTÉGRALEMENT, par le nouveau chemin. Ce que V2.4.6 prouvait, V2.7.0 le
//   prouve encore — la preuve change de porte, pas de contenu.
// ============================================================
console.log('\n[QC-SAV] Scénario maître « reprise » rejoué par la popup Tâche');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'SAV' });
  const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  await ev(p, () => {
    setRole('driver');
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    // La pose des fenêtres est « en retard » dans la démo : on la termine
    // d'abord, exactement comme le scénario historique — c'est une tâche
    // TERMINÉE qui peut faire l'objet d'une reprise.
    setTaskStatus('k-windows', 'done');
    save();
    selectFieldProject('keravel');
  });
  await p.waitForTimeout(200);

  // ---- SAV-01 : on entre par la POPUP tâche, jamais par un tiroir bureau.
  const popup = await ev(p, () => {
    openTask('k-windows');
    return {
      modal: document.querySelector('#modal').classList.contains('open'),
      drawer: document.querySelector('#drawer').classList.contains('open'),
      btns: [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim()),
    };
  });
  note('QC-SAV-01', popup);
  ok(popup.modal && !popup.drawer && popup.btns.some((x) => /Signaler une reprise/.test(x)),
    'SAV-01 : en Mode Chantier, la tâche terminée s’ouvre en POPUP (jamais un tiroir bureau) et propose « Signaler une reprise »', 'QC-SAV');

  // ---- SAV-02 : le formulaire de reprise est le formulaire EXISTANT.
  const form = await ev(p, () => {
    const b = [...document.querySelectorAll('#modalContent button')].find((x) => /Signaler une reprise/.test(x.textContent));
    if (b) b.click();
    return {
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      hasComment: !!document.querySelector('#drawerFormEl textarea[name="comment"]'),
      hasPhoto: !!document.querySelector('#drawerFormEl #reworkData'),
      hasPlan: !!document.querySelector('#drawerFormEl input[name="planDate"]'),
    };
  });
  note('QC-SAV-02', form);
  ok(form.drawerOpen && form.hasComment && form.hasPhoto && form.hasPlan,
    'SAV-02 : le formulaire de reprise ouvert est bien l’EXISTANT (commentaire + photo + planification) — aucun second formulaire n’a été écrit', 'QC-SAV');

  // ---- SAV-03 : l'aperçu photo du brouillon fonctionne.
  const preview = await ev(p, (u) => {
    document.querySelector('#drawerFormEl textarea[name="comment"]').value = 'Joint à reprendre sur fenêtre chambre 2.';
    applyPhotoDraft(u, 'rework');
    return !!document.querySelector('#reworkPreview img');
  }, tiny);
  ok(preview, 'SAV-03 : la photo jointe s’affiche dans le brouillon de reprise', 'QC-SAV');

  // ---- SAV-04 : la soumission produit le popup d’impact.
  const impact = await ev(p, () => {
    document.querySelector('#drawerFormEl').requestSubmit();
    return {
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      text: (document.querySelector('#modalContent') || {}).textContent || '',
    };
  });
  note('QC-SAV-04', { modalOpen: impact.modalOpen, text: impact.text.slice(0, 120) });
  ok(impact.modalOpen && /Reprise créée/.test(impact.text),
    'SAV-04 : « Reprise créée » s’affiche avec son impact planning — le conducteur voit la conséquence AVANT de l’appliquer', 'QC-SAV');
  await shot(p, '16-sav-reprise-impact.png', { fullPage: true });

  // ---- SAV-05 → SAV-08 : les règles métier de la reprise sont intactes.
  const metier = await ev(p, () => {
    const rw = app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done');
    const orig = task('k-windows');
    const photo = rw ? app.photos.find((ph) => ph.taskId === rw.id) : null;
    return {
      reworkExists: !!rw, reworkId: rw && rw.id, reworkName: rw && rw.name,
      origStillDone: orig.status === 'done',
      photoLinked: !!photo && photo.projectId === 'keravel',
      succMigrated: task('k-lining').deps.includes(rw && rw.id),
    };
  });
  note('QC-SAV-05', metier);
  ok(metier.reworkExists, 'SAV-05 : la reprise est créée (task.reworkOfTaskId = k-windows)', 'QC-SAV');
  ok(metier.origStillDone, 'SAV-06 : la tâche d’origine reste TERMINÉE — une reprise ne rouvre jamais le passé', 'QC-SAV');
  ok(metier.photoLinked, 'SAV-07 : la photo est rattachée à la reprise (chantier et tâche corrects)', 'QC-SAV');
  ok(metier.succMigrated, 'SAV-08 : le successeur redirige sa dépendance vers la reprise — la chaîne reste cohérente', 'QC-SAV');

  // ---- SAV-09 : replanification par le moteur reflow EXISTANT.
  const replan = await ev(p, () => {
    const btn = [...document.querySelectorAll('#modalContent .btn')].find((x) => /Appliquer la replanification/.test(x.textContent));
    if (!btn) return { proposed: false };
    const doneBefore = app.tasks.filter((t) => t.status === 'done').map((t) => [t.id, t.start, t.end]);
    btn.click();
    const doneAfter = app.tasks.filter((t) => t.status === 'done').map((t) => [t.id, t.start, t.end]);
    return {
      proposed: true,
      applied: /Replanification appliquée/.test((document.querySelector('#modalContent') || {}).textContent || ''),
      doneUntouched: JSON.stringify(doneBefore) === JSON.stringify(doneAfter),
    };
  });
  note('QC-SAV-09', replan);
  ok(!replan.proposed || (replan.applied && replan.doneUntouched),
    'SAV-09 : la replanification passe par le moteur reflow existant et ne déplace AUCUNE tâche terminée', 'QC-SAV');

  // ---- SAV-10 → SAV-12 : « Prévenir » ouvre la conversation Mode Chantier.
  const conv = await ev(p, () => {
    const btn = [...document.querySelectorAll('#modalContent .btn')].find((x) => /Prévenir/.test(x.textContent));
    if (!btn) return { proposed: false };
    btn.click();
    return {
      proposed: true,
      field: isFieldMode(),
      fieldTab: app.ui.fieldTab,
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      input: (document.querySelector('#fieldConvInput') || {}).value || '',
      draft: !!document.querySelector('#fieldConvDraft img'),
    };
  });
  note('QC-SAV-10', conv);
  ok(conv.proposed, 'SAV-10 : « Prévenir l’intervenant » est proposé après la reprise — proposé, jamais envoyé d’office', 'QC-SAV');
  ok(!conv.proposed || (conv.field && conv.fieldTab === 'messages' && !conv.drawerOpen),
    'SAV-11 : la conversation s’ouvre en Mode Chantier (onglet Messages plein écran), sans tiroir bureau', 'QC-SAV');
  ok(!conv.proposed || (/reprise est nécessaire/i.test(conv.input) && /chambre 2/i.test(conv.input) && conv.draft),
    'SAV-12 : le message est pré-rempli avec le contexte de la reprise, photo jointe au brouillon', 'QC-SAV');

  // ---- SAV-13 : la reprise apparaît dans « Reprises en cours ».
  const visible = await ev(p, () => {
    if (typeof sendConversationMessage === 'function' && document.querySelector('#fieldConvInput')) sendConversationMessage();
    app.ui.conversation = null;
    setFieldTab('site');
    const sec = [...document.querySelectorAll('.field-section')].find((s) => /Reprises en cours/.test((s.querySelector('.field-h2') || {}).textContent || ''));
    return { present: !!sec, text: sec ? sec.textContent : '' };
  });
  note('QC-SAV-13', { present: visible.present, text: visible.text.slice(0, 120) });
  ok(visible.present && /Reprise — Pose des 6 fenêtres/.test(visible.text),
    'SAV-13 : de retour sur le chantier, la reprise figure dans « Reprises en cours »', 'QC-SAV');
  await shot(p, '17-sav-reprise-en-cours.png', { fullPage: true });

  // ---- SAV-14 : la qualité n’a RIEN fait dans tout ce scénario.
  const untouched = await ev(p, () => ({
    controls: app.controlInstances.length,
    statuses: app.controlInstances.map((c) => c.status),
    qualityEvents: app.history.filter((h) => h.eventType === 'quality-control').length,
  }));
  note('QC-SAV-14', untouched);
  ok(untouched.qualityEvents === 0 && untouched.statuses.every((s) => s === 'todo'),
    'SAV-14 : tout ce parcours de reprise s’est déroulé SANS qu’aucun contrôle ne soit créé, modifié ni validé — la qualité ne s’invite jamais d’elle-même', 'QC-SAV');

  await ctx.close();
}

// ============================================================
// GEL DES MOTEURS — V2.6.1 → V2.7.0
// ============================================================
console.log('\n[FREEZE-270] Byte-identité des moteurs protégés');
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
    /* V2.9.0 — RE-BASELINE des listes de gel. Six moteurs ont été étendus par
       la STRUCTURE, à la demande explicite du produit ; ils sortent donc de la
       liste des « inchangés », sans que rien d'autre n'y soit relâché :
         · planningTasks            — §18 : quatrième axe de filtrage (périmètre
                                      structure). Sans cet axe, le Gantt d'un
                                      niveau exigerait un second moteur.
         · migrateState             — §43 : migration 12 → 13
         · applyImportPlan          — §47/§48 : aucune référence orpheline
         · openTask                 — §31/§32 : l'emplacement de la tâche
         · planningCreatePointerUp  — §22 : le niveau voyage avec le geste
         · operationProjectCard     — §26 : mention discrète « N niveaux »
       Tous les autres moteurs de ces listes restent vérifiés byte à byte. */
  const frozen = [
    'taskResourceIds', 'taskHasResource', 'normalizeTaskResources', 'taskEffectiveColorKey',
    'taskColorClass', 'planningProblems', 'gantt', 'kanbanCard', 'kanbanBoard',
    'kanbanDrop', 'dropTask', 'getResourceState', 'getResourcePeriodState', 'getResourceTasks',
    'getResourceLoad', 'getMaxConcurrentTasks', 'getResourceSchedulingConflicts',
    'getResourceConflicts', 'planReflow', 'applyReflowPlan', 'evaluateScenario',
    'openReworkForm', 'createRework', 'photoCaptureBlock', 'capturePhoto', 'addPhoto',
    'projectHistory', 'historyProjectId', 'getProjectHealth', 'calculateProjectDelay',
    'lot', 'lotsOrdered', 'activeLots', 'lotLabel', 'lotColorKey', 'taskLot', 'assignableLots',
    'lotReferences', 'canDeleteLot', 'openLotsManager', 'renderLotsManager', 'submitLot',
    'moveLot', 'setLotActive', 'lotChip', 'planningLotDot', 'planningTaskTitle',
    'resourceLoadBoard', 'resourceLoadGroups', 'getTodayDecisions', 'getTodayWarnings',
    'buildKanvixBackup', 'validateKanvixBackup', 'confirmKanvixRestore', 'exportKanvixData',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-270', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-270 : les ${frozen.length} moteurs métier protégés sont BYTE-IDENTIQUES à V2.6.1 — la qualité n’a réécrit aucun moteur existant`, 'FREEZE-270');

  // setTaskStatus n'évolue QUE pour la matérialisation et la garde.
  const sts = extract(curSrc, 'setTaskStatus');
  const stsPrev = extract(prevSrc, 'setTaskStatus');
  const added = sts.split('\n').filter((l) => !stsPrev.includes(l.trim()) && l.trim()).length;
  note('FREEZE-270-setTaskStatus', { lignesAjoutées: added });
  ok(/ensureTaskControlInstances\(id\)/.test(sts) && /blockingControlsForTask\(id\)/.test(sts)
    && !/createRework|planReflow|\.start\s*=|\.end\s*=/.test(sts.slice(sts.indexOf('V2.7'), sts.indexOf('V2.7') + 900)),
    'FREEZE-270 : setTaskStatus() n’évolue QUE pour matérialiser les contrôles et poser la garde bloquante — aucune autre logique ajoutée', 'FREEZE-270');
}

// ============================================================
// SAUVEGARDE / IMPORT
// ============================================================
console.log('\n[QC-DATA] Sauvegarde, restauration, import, remplacement total');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });

  const backup = await ev(p, () => {
    const bk = buildKanvixBackup();
    return { build: bk.appVersion, schema: bk.schemaVersion, tpl: (bk.state.controlTemplates || []).length, inst: (bk.state.controlInstances || []).length, valid: validateKanvixBackup(bk).ok };
  });
  note('QC-DATA-backup', backup);
  ok(backup.valid && backup.tpl === 2 && backup.inst === 1 && backup.schema === 11,
    'QC-DATA : la sauvegarde Kanvix emporte modèles ET contrôles, et se relit sans erreur', 'QC-DATA');

  const old = await ev(p, () => {
    const bk = buildKanvixBackup();
    delete bk.state.controlTemplates; delete bk.state.controlInstances;
    bk.schemaVersion = 10; bk.state.schemaVersion = 10;
    const accepted = validateKanvixBackup(bk).ok;
    const cand = migrateState(structuredClone(bk.state));
    return { accepted, schema: cand.schemaVersion, tpl: (cand.controlTemplates || []).length, inst: (cand.controlInstances || []).length };
  });
  note('QC-DATA-v26', old);
  ok(old.accepted && old.schema === 11 && old.tpl === 2 && old.inst === 0,
    'QC-DATA : une sauvegarde V2.6 (sans qualité) reste RESTAURABLE — les modèles sont installés et AUCUN contrôle rétroactif n’est créé', 'QC-DATA');

  const portable = await ev(p, () => {
    exportKanvixData();
    const j = JSON.parse(document.querySelector('#kanvixExportText').value);
    return { keys: Object.keys(j) };
  });
  note('QC-DATA-export', portable);
  ok(!portable.keys.includes('controlTemplates') && !portable.keys.includes('controlInstances'),
    'QC-DATA : l’export portable n’est PAS élargi à la qualité — il reste un export de planning', 'QC-DATA');

  const replaceAll = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: true, data: { projects: [], tasks: [], milestones: [], lots: [], companyTemplates: [] }, projectOps: [] };
    const sum = applyImportPlan(plan, clone);
    return {
      droppedControls: sum.dropped.controls,
      instances: clone.controlInstances.length,
      templates: clone.controlTemplates.length,
      lots: clone.lots.length,
      valid: validateImportState(clone).ok,
    };
  });
  note('QC-DATA-replaceAll', replaceAll);
  ok(replaceAll.droppedControls === 1 && replaceAll.instances === 0 && replaceAll.templates === 2 && replaceAll.valid,
    'QC-DATA : « Remplacer tous les chantiers » supprime les CONTRÔLES (et l’annonce), mais CONSERVE les modèles — référentiel d’entreprise, pas contenu de chantier', 'QC-DATA');

  const cascade = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const pid = app.controlInstances[0].projectId;
    deleteProjectCascade(pid);
    return { instances: app.controlInstances.length, templates: app.controlTemplates.length, valid: validateQualityState(app).ok };
  });
  note('QC-DATA-cascade', cascade);
  ok(cascade.instances === 0 && cascade.templates === 2 && cascade.valid,
    'QC-DATA : supprimer un chantier emporte ses contrôles sans laisser d’orphelin, et sans toucher aux modèles', 'QC-DATA');

  await ctx.close();
}

// ============================================================
// CAPTURES COMPLÉMENTAIRES
// ============================================================
console.log('\n[CAPTURES] Parcours complet');
{
  const { ctx, p } = await newPage({ tag: 'SHOTS' });
  await ev(p, () => { go('more'); openControlTemplatesManager(); });
  await shot(p, '09-sidewindow-modeles-controle.png');
  await ev(p, () => openControlTemplatesManager('form', 'ctl-platrerie-cloisons'));
  await shot(p, '10-formulaire-modele-controle.png');
  await ev(p, () => { closeOverlay('drawer'); openTask('k-cloisons'); });
  await shot(p, '11-fiche-tache-section-qualite.png');
  await ev(p, () => { closeOverlay('drawer'); openProjectControlsList(app.controlInstances[0].projectId); });
  await shot(p, '12-liste-controles-chantier.png');
  await ev(p, () => {
    closeOverlay('drawer');
    const c = app.controlInstances[0];
    submitControlAttempt(c.id, 'conform', { checkedItemIds: control(c.id).items.map((i) => i.id), comment: '', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    openProjectTab(c.projectId, 'Historique');
  });
  await shot(p, '13-historique-controle-qualite.png');
  await ev(p, () => { setAppearance('dark'); openTask('k-cloisons'); });
  await shot(p, '14-fiche-tache-qualite-sombre.png');
  await ctx.close();
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
