// ============================================================
// KANVIX — Recette « Conditions de démarrage : le contournement de
//          l'éditeur universel » (V2.12.0.1)
//
//   V2.12.0 a posé la garde des conditions de démarrage dans setTaskStatus(),
//   sous `!silent`. L'éditeur universel appelle ce moteur en mode
//   `transactional` — donc `silent` — pour ne faire qu'UNE transaction et qu'UN
//   Undo. La garde n'était donc jamais atteinte par ce chemin : une
//   intervention porteuse d'une condition bloquante non confirmée passait
//   SILENCIEUSEMENT « À faire » → « En cours ».
//
//   Cette recette :
//     1. REPRODUIT le contournement sur V2.12.0, par le vrai formulaire ;
//     2. prouve qu'il est impossible sur V2.12.0.1 ;
//     3. vérifie qu'aucune donnée n'est écrite avant la décision ;
//     4. vérifie qu'il n'y a toujours qu'UNE transaction et qu'UN Undo ;
//     5. vérifie que les cinq autres chemins n'ont pas bougé d'un octet.
//
//   Le test principal passe par openTaskEdit() puis par les VRAIS champs du
//   formulaire #taskEditForm et son VRAI submit. Un test qui appellerait
//   seulement setTaskStatus() ne validerait rien : c'est exactement ainsi que
//   l'anomalie est passée en V2.12.0.
//
//   Usage : node recette-conditions-demarrage-v2.12.0.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.0.1.html';
const PREV = 'kanvix-next-gen-v2.12.0.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.0.1/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1100)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, role = 'driver' } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate((r) => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); if (r !== 'driver') setRole(r); }, role);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

/* Le geste RÉEL de l'utilisateur : ouvrir l'éditeur, toucher les vrais champs,
   cliquer le vrai segment de statut, soumettre le vrai formulaire. Aucune de
   ces étapes n'appelle setTaskStatus() directement — c'est tout l'intérêt. */
async function editerEtSoumettre(p, taskId, { nom, statut, ressourceAutre } = {}) {
  await ev(p, (id) => openTaskEdit(id, 'planning-gantt'), taskId);
  await p.waitForTimeout(200);
  if (nom !== undefined) await p.fill('#taskEditForm [name=name]', nom);
  if (ressourceAutre) {
    await ev(p, (id) => {
      const sel = document.querySelector('#taskEditForm [name=resourceId]');
      const autre = [...sel.options].map((o) => o.value).find((v) => v && v !== task(id).resourceId);
      if (autre) { sel.value = autre; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, taskId);
  }
  if (statut) await p.click(`#taskEditForm .te-status-seg .seg-opt[data-status="${statut}"]`);
  await ev(p, () => document.querySelector('#taskEditForm').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })));
  await p.waitForTimeout(280);
}
const etatModale = (p) => ev(p, () => ({
  ouverte: $('#modal').classList.contains('open'),
  titre: $('#modalContent h2')?.textContent.trim() || '',
  texte: ($('#modalContent')?.textContent || '').slice(0, 220),
  items: [...document.querySelectorAll('#modalContent .prq-confirm-list li')].map((x) => x.textContent.trim()),
  boutons: [...document.querySelectorAll('#modalContent .pop-actions .btn')].map((x) => x.textContent.trim()),
}));

// ============================================================
// FIXPRQ-01 — LE BUG, REPRODUIT SUR V2.12.0
// ============================================================
console.log('\n[FIXPRQ-01] Reproduction du contournement sur V2.12.0');
{
  const { ctx, p } = await newPage({ tag: 'BUG-2120', file: PREV });
  const av = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    return {
      statut: task('k-windows').status,
      pret: taskStartReadiness('k-windows').ready,
      bloquantes: taskStartReadiness('k-windows').blocking.map((x) => x.label),
      histo: app.history.length,
    };
  });
  await editerEtSoumettre(p, 'k-windows', { statut: 'doing' });
  const ap = await ev(p, () => ({
    modale: $('#modal').classList.contains('open'),
    titre: $('#modalContent h2')?.textContent.trim() || '',
    statut: task('k-windows').status,
    conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status]),
    traces: app.history.slice(0, 3).map((h) => h.text),
    forcee: app.history.some((h) => /démarrée malgré/.test(h.text || '')),
  }));
  note('FIXPRQ-01', { av, ap });
  ok(av.pret === false && av.bloquantes.length === 1,
    'FIXPRQ-01 : le cas de test est bien celui du bug — « Pose des 6 fenêtres » porte UNE condition bloquante non confirmée et n’est donc pas prête à démarrer', 'FIXPRQ-01');
  ok(ap.modale === false && ap.statut === 'doing' && ap.forcee === false,
    'FIXPRQ-01 : sur V2.12.0, l’éditeur universel CONTOURNE la garde — aucune modale ne s’interpose, l’intervention passe silencieusement « En cours », et aucun démarrage forcé n’est historisé. Le bug est REPRODUIT, pas supposé', 'FIXPRQ-01');
  await ctx.close();
}

// ============================================================
// FIXPRQ-02 → FIXPRQ-04 — LA DÉCISION EST DEMANDÉE, RIEN N'EST ÉCRIT
// ============================================================
console.log('\n[FIXPRQ-02] V2.12.0.1 : la décision est demandée avant toute mutation');
{
  const { ctx, p } = await newPage({ tag: 'ASK' });
  const av = await ev(p, () => {
    const t = task('k-windows');
    t.status = 'todo'; save();
    return {
      statut: t.status, nom: t.name, start: t.start, end: t.end, res: t.resourceId,
      deps: JSON.stringify(t.deps), baseline: t.baselineStart,
      undo: undoHistory.length, histo: app.history.length,
      issues: app.issues.length, controles: (app.controlInstances || []).length,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
    };
  });
  await editerEtSoumettre(p, 'k-windows', { nom: 'Pose fenêtres — saisie utilisateur', statut: 'doing' });
  const modale = await etatModale(p);
  note('FIXPRQ-02', modale);
  ok(modale.ouverte && modale.titre === 'Conditions non confirmées'
    && /1 condition bloquante non confirmée/.test(modale.texte)
    && modale.items.length === 1 && /Livraison des fenêtres/.test(modale.items[0])
    && /prévue/.test(modale.items[0])
    && /n’a aucun effet sur ces conditions/.test(modale.texte)
    && modale.boutons.join('|') === 'Annuler|Démarrer quand même',
    'FIXPRQ-02 : sur V2.12.0.1, soumettre le VRAI formulaire de l’éditeur ouvre « Conditions non confirmées » — le nombre, la liste courte avec sa date prévue, le rappel que démarrer ne confirme rien, et les deux actions attendues', 'FIXPRQ-02');

  const pendant = await ev(p, () => {
    const t = task('k-windows');
    return {
      statut: t.status, nom: t.name, start: t.start, end: t.end, res: t.resourceId,
      deps: JSON.stringify(t.deps), baseline: t.baselineStart,
      undo: undoHistory.length, histo: app.history.length,
      issues: app.issues.length, controles: (app.controlInstances || []).length,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
      drawer: $('#drawer').classList.contains('open'),
    };
  });
  note('FIXPRQ-03', pendant);
  ok(pendant.statut === av.statut && pendant.nom === av.nom
    && pendant.start === av.start && pendant.end === av.end && pendant.res === av.res
    && pendant.deps === av.deps && pendant.baseline === av.baseline,
    'FIXPRQ-03 : pendant la modale, la tâche est STRICTEMENT inchangée — statut, nom, dates, intervenant, dépendances et baseline', 'FIXPRQ-03');
  ok(pendant.undo === av.undo && pendant.histo === av.histo
    && pendant.issues === av.issues && pendant.controles === av.controles,
    'FIXPRQ-03 : et rien d’autre n’a été écrit — aucun snapshot, aucun historique, aucun incident, aucun contrôle matérialisé « au passage »', 'FIXPRQ-03');
  ok(JSON.stringify(pendant.conditions) === JSON.stringify(av.conditions),
    'FIXPRQ-04 : pendant la modale, AUCUNE condition n’est modifiée — ni son statut, ni sa date de confirmation', 'FIXPRQ-04');
  await p.screenshot({ path: SHOTS + '01-editeur-conditions-light.png' });
  await ctx.close();
}

// ============================================================
// FIXPRQ-05 → FIXPRQ-06 — ANNULER
// ============================================================
console.log('\n[FIXPRQ-05] « Annuler » ne change rien et ne fait rien perdre');
{
  const { ctx, p } = await newPage({ tag: 'CANCEL' });
  const av = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    return {
      statut: task('k-windows').status, nom: task('k-windows').name,
      undo: undoHistory.length, histo: app.history.length, issues: app.issues.length,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
    };
  });
  await editerEtSoumettre(p, 'k-windows', { nom: 'Saisie à conserver', statut: 'doing' });
  await ev(p, () => cancelPrerequisiteStart());
  await p.waitForTimeout(220);
  const ap = await ev(p, () => ({
    modale: $('#modal').classList.contains('open'),
    drawer: $('#drawer').classList.contains('open'),
    champNom: document.querySelector('#taskEditForm [name=name]')?.value,
    champStatut: document.querySelector('#taskEditForm [name=status]')?.value,
    segmentActif: document.querySelector('#taskEditForm .te-status-seg .seg-opt.active')?.dataset.status,
    statut: task('k-windows').status, nom: task('k-windows').name,
    undo: undoHistory.length, histo: app.history.length, issues: app.issues.length,
    conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
    ack: typeof taskEditPrerequisiteAck !== 'undefined' ? taskEditPrerequisiteAck : 'ABSENT',
  }));
  note('FIXPRQ-05', ap);
  ok(!ap.modale && ap.statut === av.statut && ap.nom === av.nom
    && ap.undo === av.undo && ap.histo === av.histo && ap.issues === av.issues
    && JSON.stringify(ap.conditions) === JSON.stringify(av.conditions),
    'FIXPRQ-05 : « Annuler » laisse TOUT strictement en l’état — aucune mutation métier, aucun snapshot, aucun historique, aucun incident, aucune condition touchée', 'FIXPRQ-05');
  ok(ap.ack === null,
    'FIXPRQ-05 : et aucun accord n’est mémorisé — l’accusé de l’éditeur reste vide après un refus', 'FIXPRQ-05');
  ok(ap.drawer && ap.champNom === 'Saisie à conserver' && ap.champStatut === 'doing'
    && ap.segmentActif === 'doing',
    'FIXPRQ-06 : l’éditeur reste ouvert et l’utilisateur ne perd PAS son formulaire — le nom saisi et le statut choisi sont toujours là', 'FIXPRQ-06');
  await ctx.close();
}

// ============================================================
// FIXPRQ-07 → FIXPRQ-11 — DÉMARRER QUAND MÊME, ET LA CHAÎNE COMPLÈTE
// ============================================================
console.log('\n[FIXPRQ-07] « Démarrer quand même », puis la confirmation calendrier');
{
  const { ctx, p } = await newPage({ tag: 'FORCE' });
  const av = await ev(p, () => {
    const t = task('k-windows');
    t.status = 'todo';
    // Début volontairement décalé de « maintenant » : realStartPlan() aura donc
    // lui aussi une question à poser. Les DEUX décisions sont nécessaires.
    t.start = '2026-08-17T14:00'; t.end = '2026-08-17T18:00';
    save();
    return {
      nom: t.name, res: t.resourceId, start: t.start, end: t.end, statut: t.status,
      undo: undoHistory.length, histo: app.history.length, issues: app.issues.length,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
    };
  });
  await editerEtSoumettre(p, 'k-windows', {
    nom: 'Pose fenêtres — lot 2', statut: 'doing', ressourceAutre: true,
  });
  const m1 = await etatModale(p);
  ok(m1.ouverte && m1.titre === 'Conditions non confirmées',
    'FIXPRQ-07 : la PREMIÈRE décision demandée est celle des conditions — l’ordre est déterministe', 'FIXPRQ-07');

  await ev(p, () => confirmPrerequisiteStart());
  await p.waitForTimeout(280);
  const m2 = await ev(p, () => ({
    ouverte: $('#modal').classList.contains('open'),
    titre: $('#modalContent h2')?.textContent.trim() || '',
    statut: task('k-windows').status, nom: task('k-windows').name,
    res: task('k-windows').resourceId, start: task('k-windows').start,
    undo: undoHistory.length, histo: app.history.length,
  }));
  note('FIXPRQ-08', m2);
  ok(m2.ouverte && m2.titre === 'Démarrer cette tâche maintenant ?',
    'FIXPRQ-08 : « Démarrer quand même » ne démarre pas — il rend la main à l’éditeur, qui pose ALORS la confirmation calendrier de V2.8.5.1 (§7). Le parcours existant continue de fonctionner', 'FIXPRQ-08');
  ok(m2.statut === av.statut && m2.nom === av.nom && m2.res === av.res && m2.start === av.start
    && m2.undo === av.undo && m2.histo === av.histo,
    'FIXPRQ-08 : et ENTRE les deux décisions, toujours rien d’écrit — pas de snapshot intermédiaire, pas de statut, pas de nom, pas de date, pas d’historique', 'FIXPRQ-08');
  await p.screenshot({ path: SHOTS + '02-enchainement-calendrier-light.png' });

  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);
  const fin = await ev(p, () => ({
    statut: task('k-windows').status, nom: task('k-windows').name,
    res: task('k-windows').resourceId, start: task('k-windows').start,
    undoDelta: undoHistory.length, histoDelta: app.history.length,
    traces: app.history.slice(0, 4).map((h) => h.text),
    forcees: app.history.filter((h) => /démarrée malgré/.test(h.text || '')).length,
    conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]),
    issues: app.issues.length,
    ack: typeof taskEditPrerequisiteAck !== 'undefined' ? taskEditPrerequisiteAck : 'ABSENT',
    ackCal: typeof taskEditConfirmAck !== 'undefined' ? taskEditConfirmAck : 'ABSENT',
    drawer: $('#drawer').classList.contains('open'),
  }));
  note('FIXPRQ-09', fin);
  ok(fin.statut === 'doing' && fin.nom === 'Pose fenêtres — lot 2' && fin.res !== av.res
    && fin.start !== av.start,
    'FIXPRQ-09 : après les DEUX confirmations, la tâche passe bien « En cours », et le geste complet est appliqué — nom, intervenant et repositionnement réel compris', 'FIXPRQ-09');
  ok(JSON.stringify(fin.conditions) === JSON.stringify(av.conditions),
    'FIXPRQ-10 : les conditions restent STRICTEMENT dans leur état précédent — la livraison reste « à confirmer », aucune confirmedDate n’est renseignée automatiquement', 'FIXPRQ-10');
  ok(fin.forcees === 1 && /démarrée malgré 1 condition non confirmée/.test(fin.traces.join('|')),
    'FIXPRQ-11 : l’historique contient UNE entrée « Intervention démarrée malgré 1 condition non confirmée. » — écrite par le moteur central, pas par l’éditeur', 'FIXPRQ-11');
  ok(fin.issues === av.issues,
    'FIXPRQ-11 : et aucun incident artificiel n’est créé au passage', 'FIXPRQ-11');
  ok(fin.ack === null && fin.ackCal === null,
    'FIXPRQ-11 : les deux accusés sont CONSOMMÉS — aucun accord ne survit à la validation', 'FIXPRQ-11');
  await ctx.close();
}

// ============================================================
// FIXPRQ-12 — UNE CONDITION NON BLOQUANTE N'INTERROMPT RIEN
// ============================================================
console.log('\n[FIXPRQ-12] Condition non bloquante');
{
  const { ctx, p } = await newPage({ tag: 'SOFT' });
  const av = await ev(p, () => {
    task('k-paint').status = 'todo'; save();
    return {
      conditions: taskPrerequisites('k-paint').map((x) => [x.label, x.blocking, x.status]),
      pret: taskStartReadiness('k-paint').ready,
      warnings: taskStartReadiness('k-paint').warnings.length,
    };
  });
  await editerEtSoumettre(p, 'k-paint', { statut: 'doing' });
  const ap = await etatModale(p);
  note('FIXPRQ-12', { av, titre: ap.titre });
  ok(av.pret === true && av.warnings === 1 && av.conditions[0][1] === false,
    'FIXPRQ-12 : le cas est bien celui d’une condition NON bloquante non satisfaite — elle se surveille, elle n’empêche rien', 'FIXPRQ-12');
  ok(ap.titre !== 'Conditions non confirmées',
    'FIXPRQ-12 : elle n’ouvre PAS « Conditions non confirmées » depuis l’éditeur — la règle de V2.12.0 est inchangée', 'FIXPRQ-12');
  await ctx.close();
}

// ============================================================
// FIXPRQ-13 — TOUT SATISFAIT : COMPORTEMENT V2.12.0 À L'IDENTIQUE
// ============================================================
console.log('\n[FIXPRQ-13] Conditions satisfaites : rien ne change');
{
  const compare = async (file, tag) => {
    const { ctx, p } = await newPage({ tag, file });
    await ev(p, () => {
      const t = task('k-windows');
      t.status = 'todo'; t.start = '2026-08-17T14:00'; t.end = '2026-08-17T18:00';
      // Toutes les conditions bloquantes sont réglées.
      taskPrerequisites('k-windows').forEach((x) => setPrerequisiteStatus(x.id, 'confirmed'));
      undoHistory.length = 0; redoHistory.length = 0;
      app.history.length = 0;
      save();
    });
    await editerEtSoumettre(p, 'k-windows', { nom: 'Tout est prêt', statut: 'doing' });
    const etat = await ev(p, () => ({
      titre: $('#modal').classList.contains('open') ? $('#modalContent h2')?.textContent.trim() : null,
    }));
    await ev(p, () => { if ($('#modal').classList.contains('open')) runCalendarConfirm(); });
    await p.waitForTimeout(350);
    const fin = await ev(p, () => ({
      statut: task('k-windows').status, nom: task('k-windows').name,
      start: task('k-windows').start,
      undo: undoHistory.length, histo: app.history.length,
      traces: app.history.map((h) => h.text).sort(),
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status]),
    }));
    await ctx.close();
    return { modale: etat.titre, ...fin };
  };
  const a = await compare(PREV, 'OK-2120'), c = await compare(CUR, 'OK-21201');
  note('FIXPRQ-13', { v2120: a, v21201: c });
  ok(JSON.stringify(a) === JSON.stringify(c),
    'FIXPRQ-13 : quand toutes les conditions bloquantes sont satisfaites, V2.12.0.1 se comporte EXACTEMENT comme V2.12.0 — même modale calendrier, même statut, même nom, même repositionnement, même nombre de snapshots, même historique', 'FIXPRQ-13');
  ok(c.modale === 'Démarrer cette tâche maintenant ?' && c.statut === 'doing',
    'FIXPRQ-13 : et le parcours nominal reste celui du produit — la seule question posée est celle du démarrage réel', 'FIXPRQ-13');
}

// ============================================================
// FIXPRQ-14 — UNE SEULE TRANSACTION, UN SEUL UNDO
// ============================================================
console.log('\n[FIXPRQ-14] Un geste, une transaction, un Undo');
{
  const { ctx, p } = await newPage({ tag: 'UNDO' });
  const av = await ev(p, () => {
    const t = task('k-windows');
    t.status = 'todo'; t.start = '2026-08-17T14:00'; t.end = '2026-08-17T18:00';
    undoHistory.length = 0; redoHistory.length = 0;
    save();
    return { nom: t.name, res: t.resourceId, start: t.start, end: t.end, statut: t.status,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]) };
  });
  await editerEtSoumettre(p, 'k-windows', {
    nom: 'Geste complet', statut: 'doing', ressourceAutre: true,
  });
  await ev(p, () => confirmPrerequisiteStart());
  await p.waitForTimeout(250);
  await ev(p, () => { if ($('#modal').classList.contains('open')) runCalendarConfirm(); });
  await p.waitForTimeout(400);
  const apres = await ev(p, () => {
    const t = task('k-windows');
    return { nom: t.name, res: t.resourceId, start: t.start, end: t.end, statut: t.status,
      undo: undoHistory.length, redo: redoHistory.length };
  });
  const un = await ev(p, () => {
    undo();
    const t = task('k-windows');
    return { nom: t.name, res: t.resourceId, start: t.start, end: t.end, statut: t.status,
      undo: undoHistory.length,
      conditions: taskPrerequisites('k-windows').map((x) => [x.label, x.status, x.confirmedDate]) };
  });
  const re = await ev(p, () => {
    redo();
    const t = task('k-windows');
    return { nom: t.name, res: t.resourceId, statut: t.status };
  });
  note('FIXPRQ-14', { av, apres, un, re });
  ok(apres.undo === 1,
    'FIXPRQ-14 : modifier le nom, l’intervenant, les dates ET le statut en démarrant malgré une condition ne crée QU’UNE transaction — un seul snapshot, pas un par décision', 'FIXPRQ-14');
  ok(un.nom === av.nom && un.res === av.res && un.start === av.start && un.end === av.end
    && un.statut === av.statut && un.undo === 0,
    'FIXPRQ-14 : et UN SEUL Undo restitue le geste ENTIER — ancien nom, ancien intervenant, anciennes dates, ancien statut', 'FIXPRQ-14');
  ok(JSON.stringify(un.conditions) === JSON.stringify(av.conditions),
    'FIXPRQ-14 : les conditions sont restées dans leur état initial de bout en bout — il n’existe aucun Undo propre aux conditions de démarrage', 'FIXPRQ-14');
  ok(re.nom === 'Geste complet' && re.res !== av.res && re.statut === 'doing',
    'FIXPRQ-14 : « Rétablir » rejoue le geste entier, lui aussi d’un seul coup', 'FIXPRQ-14');
  await ctx.close();
}

// ============================================================
// FIXPRQ-15 — LES CINQ AUTRES CHEMINS N'ONT PAS BOUGÉ
// ============================================================
console.log('\n[FIXPRQ-15] Les cinq autres chemins de démarrage');
{
  /* Le même scénario joué sur les DEUX builds : si un seul octet de
     comportement avait changé, la comparaison le dirait. */
  const parcours = async (file, tag) => {
    const out = {};
    // 1 · fiche tâche
    {
      const { ctx, p } = await newPage({ tag: tag + '-fiche', file });
      out.fiche = await ev(p, () => {
        task('k-windows').status = 'todo'; save();
        setTaskStatus('k-windows', 'doing');
        return { modale: $('#modalContent h2')?.textContent.trim() || '', statut: task('k-windows').status };
      });
      await ctx.close();
    }
    // 2 · Kanban
    {
      const { ctx, p } = await newPage({ tag: tag + '-kanban', file });
      out.kanban = await ev(p, () => {
        task('k-windows').status = 'todo'; save();
        setTaskStatus('k-windows', 'doing', 'kanban');
        return { modale: $('#modalContent h2')?.textContent.trim() || '', statut: task('k-windows').status };
      });
      await ctx.close();
    }
    // 3 · Mode Chantier — la fiche mobile du conducteur
    {
      const { ctx, p } = await newPage({ tag: tag + '-chantier', file, w: 390, h: 844 });
      out.chantier = await ev(p, () => {
        task('k-windows').status = 'todo'; save();
        enterFieldMode(); openTask('k-windows');
        const bloc = $('#modalContent .field-prq');
        return { bloc: !!bloc, texte: bloc?.textContent.trim().slice(0, 60) || '',
          actions: [...document.querySelectorAll('#modalContent .field-prq-actions .btn')].map((x) => x.textContent.trim()) };
      });
      await ctx.close();
    }
    // 4 · Artisan « Je commence »
    {
      const { ctx, p } = await newPage({ tag: tag + '-artisan', file, w: 390, h: 844, role: 'artisan' });
      out.artisan = await ev(p, () => {
        task('k-windows').status = 'todo'; save(); renderPage();
        const bouton = [...document.querySelectorAll('.chat-mission .actions .btn')]
          .find((x) => /Je commence/.test(x.textContent));
        bouton?.click();
        return { bouton: !!bouton, modale: $('#modalContent h2')?.textContent.trim() || '',
          statut: task('k-windows').status };
      });
      await ctx.close();
    }
    // 5 · appel ordinaire, tâche prête
    {
      const { ctx, p } = await newPage({ tag: tag + '-pret', file });
      out.pret = await ev(p, () => {
        task('t-plumb').status = 'todo'; save();
        setTaskStatus('t-plumb', 'doing');
        return { modale: $('#modalContent h2')?.textContent.trim() || '', statut: task('t-plumb').status };
      });
      await ctx.close();
    }
    return out;
  };
  const a = await parcours(PREV, 'P-2120'), c = await parcours(CUR, 'P-21201');
  note('FIXPRQ-15', c);
  ok(JSON.stringify(a) === JSON.stringify(c),
    'FIXPRQ-15 : fiche tâche, Kanban, Mode Chantier, Artisan « Je commence » et appel ordinaire se comportent à l’IDENTIQUE sur les deux builds — ce patch ne concerne que l’exception transactionnelle de l’éditeur', 'FIXPRQ-15');
  ok(c.fiche.modale === 'Conditions non confirmées' && c.fiche.statut === 'todo'
    && c.kanban.modale === 'Conditions non confirmées' && c.kanban.statut === 'todo'
    && c.artisan.modale === 'Conditions non confirmées' && c.artisan.statut === 'todo'
    && c.pret.modale === '' && c.pret.statut === 'doing',
    'FIXPRQ-15 : et la garde CENTRALE de V2.12.0 reste bien leur moteur — trois chemins l’ouvrent, une tâche prête ne la voit pas', 'FIXPRQ-15');
}

// ============================================================
// RESPONSIVE — la modale, l'éditeur, et leur enchaînement
// ============================================================
console.log('\n[FIXPRQ-RESP] Largeurs et thèmes');
{
  const LARGEURS = [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390];
  const fautives = [], cibles = [];
  for (const w of LARGEURS) {
    for (const sombre of [false, true]) {
      const { ctx, p } = await newPage({ w, h: w <= 430 ? 844 : 1000, tag: `R${w}${sombre ? 'D' : 'L'}` });
      if (sombre) { await ev(p, () => setAppearance('dark')); await p.waitForTimeout(150); }
      await ev(p, () => {
        const t = task('k-windows');
        t.status = 'todo'; t.start = '2026-08-17T14:00'; t.end = '2026-08-17T18:00'; save();
      });
      await editerEtSoumettre(p, 'k-windows', { statut: 'doing' });
      const m = await ev(p, () => {
        const de = document.documentElement;
        const bts = [...document.querySelectorAll('#modalContent .pop-actions .btn')];
        const pop = document.querySelector('#modalContent');
        return {
          scrollH: de.scrollWidth > de.clientWidth + 1,
          debordeModale: !!pop && pop.scrollWidth > pop.clientWidth + 1,
          boutonCoupe: bts.some((x) => x.scrollWidth > x.clientWidth + 1),
          hauteurs: bts.map((x) => Math.round(x.getBoundingClientRect().height)),
          liste: !!document.querySelector('#modalContent .prq-confirm-list'),
        };
      });
      if (m.scrollH || m.debordeModale || m.boutonCoupe || !m.liste)
        fautives.push({ w, sombre, ...m });
      if (w <= 430 && !sombre) cibles.push({ w, hauteurs: m.hauteurs });
      // L'enchaînement complet, à cette largeur et dans ce thème.
      await ev(p, () => confirmPrerequisiteStart());
      await p.waitForTimeout(220);
      const m2 = await ev(p, () => {
        const de = document.documentElement;
        return { ouverte: $('#modal').classList.contains('open'), scrollH: de.scrollWidth > de.clientWidth + 1 };
      });
      if (m2.scrollH) fautives.push({ w, sombre, etape: 'calendrier', ...m2 });
      if (w === 390 && !sombre) await p.screenshot({ path: SHOTS + '03-enchainement-390-light.png' });
      if (w === 1440 && sombre) await p.screenshot({ path: SHOTS + '04-enchainement-1440-dark.png' });
      await ctx.close();
    }
  }
  note('FIXPRQ-RESP', { mesurées: LARGEURS.length * 2, fautives, cibles: cibles });
  ok(fautives.length === 0,
    `FIXPRQ-RESP : sur ${LARGEURS.length * 2} combinaisons (10 largeurs de 1920 à 390 px × clair/sombre), l’éditeur, la modale « Conditions non confirmées » ET son enchaînement vers la confirmation calendrier ne provoquent AUCUN défilement horizontal, AUCUN débordement de la modale et AUCUN bouton coupé`, 'FIXPRQ-RESP');

  /* §19 demande que le minimum tactile soit CONSERVÉ. Ce patch ne touche pas au
     style : la modale est celle du produit, et ses actions mesurent ce qu'elles
     mesuraient. On le PROUVE en rejouant la même mesure sur V2.12.0 — un patch
     n'a pas à hériter d'une caractéristique ancienne, mais il n'a pas le droit
     de la dégrader. */
  const tactile = async (file) => {
    const out = {};
    for (const w of [430, 390]) {
      const { ctx, p } = await newPage({ w, h: 844, tag: 'T' + w, file });
      out[w] = await ev(p, () => {
        task('k-windows').status = 'todo'; save();
        setTaskStatus('k-windows', 'doing');
        return [...document.querySelectorAll('#modalContent .pop-actions .btn')]
          .map((x) => Math.round(x.getBoundingClientRect().height));
      });
      await ctx.close();
    }
    return out;
  };
  const tA = await tactile(PREV), tC = await tactile(CUR);
  note('FIXPRQ-RESP-tactile', { v2120: tA, v21201: tC });
  ok(JSON.stringify(tA) === JSON.stringify(tC) && Object.values(tC).every((l) => l.length === 2),
    'FIXPRQ-RESP : à 430 et 390 px, les actions de la modale mesurent EXACTEMENT ce qu’elles mesuraient en V2.12.0 — le minimum tactile est conservé, aucune règle de style n’a été touchée', 'FIXPRQ-RESP');
}

// ============================================================
// FREEZE-21201 — le périmètre du correctif, mesuré
// ============================================================
console.log('\n[FREEZE-21201] Périmètre et architecture');
{
  const read = (f) => fs.readFileSync(BASE + f, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  const extractFn = (src, name) => {
    const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    let par = src.indexOf('(', m.index), depth = 0, k = par;
    for (; k < src.length; k++) {
      if (src[k] === '(') depth++;
      else if (src[k] === ')') { depth--; if (!depth) { k++; break; } }
    }
    let i = src.indexOf('{', k), d = 0, j = i, s = null, esc = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (s) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === s) s = null; continue; }
      if (c === '"' || c === "'" || c === '`') { s = c; continue; }
      if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
      if (c === '{') d++;
      else if (c === '}') { d--; if (!d) { j++; break; } }
    }
    return src.slice(m.index, j);
  };
  const blocIndente = (src, nom) => {
    const lignes = src.split('\n');
    const re = new RegExp('^(\\s*)function\\s+' + nom + '\\s*\\(');
    for (let i = 0; i < lignes.length; i++) {
      const m = re.exec(lignes[i]);
      if (!m) continue;
      const ind = m[1].length, out = [lignes[i]];
      for (let j = i + 1; j < lignes.length; j++) {
        out.push(lignes[j]);
        if (lignes[j].trim() === '}' && lignes[j].length - lignes[j].trimStart().length === ind) return out.join('\n');
      }
    }
    return null;
  };
  const A = read(PREV), B = read(CUR);

  /* TROIS fonctions, et trois seulement. */
  const attendues = ['submitTaskEdit', 'confirmPrerequisiteStart', 'clearTaskEditAck'];
  /* V2.12.0.2 — les fonctions touchées par le ROUND SUIVANT sont tolérées par
     le BALAYAGE, sinon ce gel signalerait comme dérive ce qu'un correctif
     ultérieur modifie volontairement. La liste reste FERMÉE, et les deux
     contrôles propres à V2.12.0.1 — « les trois fonctions annoncées ont
     réellement changé » et « ce round n'a ajouté aucune fonction » — restent
     strictement ceux de ce round.
       · restoreHistoryState   — y pose la préservation des communications ;
       · preserveCommunications — le helper pur qu'elle appelle. */
  const attenduesRoundsSuivants = ['restoreHistoryState', 'preserveCommunications'];
  const tolerees = [...attendues, ...attenduesRoundsSuivants];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [], ajoutees = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { if (!attenduesRoundsSuivants.includes(n)) ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !tolerees.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  const nonModifiees = attendues.filter((n) => md5(extractFn(A, n) || '') === md5(extractFn(B, n) || ''));
  note('FREEZE-21201-périmètre', { modifiées: attendues, horsPérimètre: horsPerimetre, ajoutées: ajoutees, indentation: indentDiff, nonModifiées: nonModifiees });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-21201 : hors des TROIS fonctions du périmètre annoncé — submitTaskEdit(), confirmPrerequisiteStart() et clearTaskEditAck() — le balayage de tout le fichier ne trouve AUCUNE autre fonction modifiée depuis V2.12.0', 'FREEZE-21201');
  ok(nonModifiees.length === 0,
    'FREEZE-21201 : les trois fonctions annoncées ont RÉELLEMENT changé — aucun périmètre annoncé pour rien', 'FREEZE-21201');
  ok(ajoutees.length === 0,
    'FREEZE-21201 : AUCUNE fonction n’a été ajoutée — ce correctif n’introduit aucun moteur, pas même un helper', 'FREEZE-21201');

  /* La garde centrale n'a PAS été déplacée : c'est le cœur du round. */
  const geles = [
    'setTaskStatus', 'askPrerequisiteStartConfirm', 'cancelPrerequisiteStart',
    'realStartPlan', 'askRealStartConfirm', 'calendarConfirm', 'runCalendarConfirm',
    'taskPrerequisites', 'taskStartReadiness', 'prerequisiteEffectiveStatus',
    'prerequisiteIsSatisfied', 'taskBlockingPrerequisites', 'taskUnresolvedPrerequisites',
    'taskTopPrerequisite', 'taskPrerequisiteSummary', 'taskNeedsPrerequisiteAttention',
    'prerequisiteIsLateForTask', 'projectPrerequisites', 'prerequisite',
    'addTaskPrerequisite', 'updateTaskPrerequisite', 'setPrerequisiteStatus',
    'deleteTaskPrerequisite', 'taskPrerequisitesSection', 'openTaskPrerequisites',
    'renderTaskPrerequisites', 'openPrerequisiteForm', 'fieldTaskPrerequisitesSummary',
    'fieldPrerequisiteAction', 'artisanPrerequisiteNote', 'planningPrerequisiteMeta',
    'prerequisiteDecisionItems', 'prerequisiteWarningItems', 'templatePrerequisiteRecord',
    'migrateState', 'alignDemoDates', 'openTask', 'openFieldTaskModal', 'renderArtisan',
    'confirmDeleteTask', 'cloneStructureTree', 'collectStructureSource',
    'duplicateStructureNode', 'applyTemplateToProject', 'buildProjectTemplateRecord',
    'templateCaptureScope', 'gantt', 'projectToday', 'projectUpcomingTimeline',
    'getTodayDecisions', 'getTodayWarnings', 'decisionCard', 'watchCard',
    'attentionRowTone', 'openMoreIssues', 'showKanvixBackupPreview', 'exportKanvixData',
    'applyImportPlan', 'impDroppedLines', 'buildKanvixBackup', 'validateKanvixBackup',
    'confirmKanvixRestore', 'analyzeKanvixImport', 'buildImportPlan', 'validateImportState',
    'planReflow', 'applyReflowPlan', 'ensureTaskControlInstances', 'blockingControlsForTask',
    'pendingControlsForTask', 'controlsForTask', 'reconcileAfterTaskStatusChange',
    'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState',
    'normalizeTaskResources', 'taskResourceIds', 'canAssignResource',
    'kanbanBoard', 'kanbanCard', 'setTaskStatusFromKanban', 'openTaskEdit',
    'guardEditable', 'canEditProject', 'save', 'resetApp',
  ];
  /* V2.12.0.2 — RE-BASELINE, une seule cause NOMMÉE : restoreHistoryState()
     reçoit la préservation des communications. Elle quitte le gel, déclarée et
     assumée, et FREEZE-21202 la vérifie ligne à ligne. setTaskStatus() — le
     vrai sujet de ce gel-ci — reste byte-identique. */
  const rebaseV21202 = ['restoreHistoryState'];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    if (rebaseV21202.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-21201-gelés', { comparées: compares, bougés: bouges, reBaséesV21202: rebaseV21202 });
  ok(compares > 80 && bouges.length === 0,
    `FREEZE-21201 : les ${compares} moteurs nommément protégés sont BYTE-IDENTIQUES — dont setTaskStatus() lui-même. La garde centrale n’a PAS été déplacée : elle protège toujours les cinq autres chemins, et la transaction unique de l’éditeur n’a pas été cassée`, 'FREEZE-21201');

  /* Aucun second moteur de conditions dans l'éditeur (§4). */
  const edit = extractFn(B, 'submitTaskEdit');
  const arch = {
    litLeHelper: /taskStartReadiness\(st\.id\)/.test(edit),
    // Aucune règle métier recopiée : l'éditeur ne parle ni de statut de
    // condition, ni de satisfaction, ni de retard, ni de tri.
    pasDeRegleRecopiee:
      !/prerequisiteIsSatisfied|prerequisiteEffectiveStatus|taskTopPrerequisite|PREREQ_STATUS|PREREQ_PRIORITY|status === "confirmed"|status === "pending"/.test(edit),
    pasDeCollectionBis: !/app\.prerequisites/.test(edit),
    // La modale est celle du produit, pas une copie.
    memeModale: /askPrerequisiteStartConfirm\(/.test(edit),
    uneSeuleModaleConditions: (B.match(/function\s+askPrerequisiteStartConfirm\s*\(/g) || []).length === 1,
    // Le fait métier reste écrit par le moteur central.
    /* Le FAIT MÉTIER n'a qu'un générateur dans tout le fichier, et il est dans
       setTaskStatus(). On mesure le gabarit qui le produit — pas une mention en
       prose, qu'un simple commentaire ferait passer pour du code. */
    pasDHistoriqueRecopie:
      (B.match(/Intervention démarrée malgré \$\{/g) || []).length === 1
      && /Intervention démarrée malgré \$\{/.test(extractFn(B, 'setTaskStatus'))
      && !/Intervention démarrée malgré \$\{/.test(edit),
    transmetLaDecision: /forcePrerequisites: true/.test(edit) && /forcedPrerequisites: prqForcees/.test(edit),
    unSeulSnapshotDansEdit: (edit.match(/\bsnapshot\(\)/g) || []).length === 1,
    unSeulSetTaskStatus: (B.match(/function\s+setTaskStatus\s*\(/g) || []).length === 1,
    // L'accusé est local et éphémère : jamais dans app, jamais sauvegardé.
    ackHorsApp: !/app\.\w*[Pp]rerequisiteAck|app\.ui\.\w*[Pp]rerequisiteAck/.test(B)
      && /^\s*let taskEditPrerequisiteAck = null;$/m.test(B),
    ackNettoye: /taskEditPrerequisiteAck = null;/.test(extractFn(B, 'clearTaskEditAck')),
    pasDePileUndoParallele: !/prerequisiteUndoStack|editUndoStack|prqSnapshot/.test(B),
  };
  note('FREEZE-21201-architecture', arch);
  ok(arch.litLeHelper && arch.pasDeRegleRecopiee && arch.pasDeCollectionBis,
    'FREEZE-21201 / §4 : l’éditeur INTERROGE taskStartReadiness() et ne recopie AUCUNE règle métier — ni satisfaction, ni état effectif, ni tri, ni priorité — et ne touche jamais app.prerequisites directement. Aucun second moteur de conditions', 'FREEZE-21201');
  ok(arch.memeModale && arch.uneSeuleModaleConditions && arch.pasDHistoriqueRecopie && arch.transmetLaDecision,
    'FREEZE-21201 / §9 : la modale est CELLE du produit — une seule définition dans tout le fichier — et l’éditeur ne réécrit pas le fait métier : il TRANSMET la décision au moteur central, qui reste seul à historiser le démarrage forcé', 'FREEZE-21201');
  ok(arch.unSeulSnapshotDansEdit && arch.unSeulSetTaskStatus && arch.pasDePileUndoParallele,
    'FREEZE-21201 / §10 : submitTaskEdit() ne contient toujours QU’UN appel à snapshot(), il n’existe qu’un setTaskStatus() dans tout le fichier, et aucune pile Undo parallèle n’a été créée', 'FREEZE-21201');
  ok(arch.ackHorsApp && arch.ackNettoye,
    'FREEZE-21201 / §8 : l’accusé est une variable LOCALE au module, jamais rangée dans app, donc jamais persistée ni sauvegardée — et elle est nettoyée avec le formulaire', 'FREEZE-21201');

  /* Données, style : rien n'a bougé. */
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const donnees = {
    cssIdentique: md5(bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/))
      === md5(bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/)),
    initialIdentique: md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/))
      === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)),
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    requisGele: bloc(A, /KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/) === bloc(B, /KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/),
    referentiels: bloc(A, /const PREREQ_TYPES = \[[\s\S]*?\];/) === bloc(B, /const PREREQ_TYPES = \[[\s\S]*?\];/),
  };
  note('FREEZE-21201-données', donnees);
  ok(donnees.cssIdentique && donnees.initialIdentique && donnees.referentiels,
    'FREEZE-21201 / §20 : la feuille de style, INITIAL_STATE et les référentiels de conditions sont BYTE-IDENTIQUES — ce correctif ne touche ni au dessin, ni aux données de démonstration', 'FREEZE-21201');
  ok(donnees.schemaAvant === '15' && donnees.schemaApres === '15'
    && donnees.store === 'kanvix-product-8-3' && donnees.build && donnees.requisGele,
    'FREEZE-21201 / §20 : SCHEMA_VERSION reste 15, STORE reste « kanvix-product-8-3 », build inchangé, KANVIX_BACKUP_REQUIRED byte-identique — aucune migration, aucune donnée persistée nouvelle', 'FREEZE-21201');
}

// ============================================================
const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
/* L'assertion « zéro erreur console » est posée AVANT le décompte final : le
   nombre annoncé à l'écran est ainsi EXACTEMENT celui de resultats.json. */
ok(appErrs.length === 0, `FIXPRQ : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'FIXPRQ');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
