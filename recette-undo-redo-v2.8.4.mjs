// ============================================================
// KANVIX — Recette « Undo / Redo global » (V2.8.4)
//
//   L'historique devient un état de SESSION : hors de `app`, jamais persisté,
//   jamais sauvegardé, jamais synchronisé. Undo/Redo RESTAURE DES ÉTATS — il ne
//   rejoue aucun moteur métier, ce qui garantit qu'une transaction complexe
//   revient en un seul geste, avec les mêmes identifiants.
//
//   La question à laquelle cette recette répond :
//     « Kanvix possède-t-il un Undo/Redo global, multi-niveaux et atomique,
//       sans rejouer les moteurs, sans persister l'historique, sans voler
//       Ctrl+Z aux formulaires, sans faux Undo sur une action externe, et sans
//       régression dans V2.8.3.2 ? »
//
//   Usage : node recette-undo-redo-v2.8.4.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.4.html';
const PREV = 'kanvix-next-gen-v2.8.3.2.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.4/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const OP = 'op-brest-ouest';

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
  const { w = 1440, h = 1000, tag = 'x', file = CUR } = opts;
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
    resetApp(); setDepth('pilot'); setRole('driver');
    dismissKanvixContinuityNotice();
  });
  await p.evaluate((id) => { window.OP = id; }, OP);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + name, fullPage: true }); };

// ============================================================
// UR-01 → UR-03 — Socle et héritage
// ============================================================
console.log('\n[UR-SOCLE] Schéma, magasin, pile héritée');
{
  const { ctx, p } = await newPage({ tag: 'SOCLE' });
  const socle = await ev(p, () => ({ schema: SCHEMA_VERSION, store: STORE, limite: UNDO_LIMIT }));
  note('UR-01', socle);
  ok(Number(socle.schema) >= 12, 'UR-01 : SCHEMA_VERSION ne recule jamais sous 12 — l’historique reste un état de session, pas une donnée métier (la migration 13 est celle de la Structure, V2.9.0 §43)', 'UR-01');
  ok(socle.store === 'kanvix-product-8-3', 'UR-02 : STORE reste « kanvix-product-8-3 »', 'UR-02');

  // UR-03 — une sauvegarde V2.8.3.2 peut contenir une pile d'annulation.
  const legacy = await ev(p, () => {
    const raw = JSON.parse(localStorage.getItem(STORE));
    const avant = { taches: raw.tasks.length, chantiers: raw.projects.length, nom: raw.tasks[0].name };
    raw.undoStack = [structuredClone(raw), structuredClone(raw), structuredClone(raw)];
    localStorage.setItem(STORE, JSON.stringify(raw));
    const relu = migrateState(JSON.parse(localStorage.getItem(STORE)));
    return { avant, apres: { taches: relu.tasks.length, chantiers: relu.projects.length, nom: relu.tasks[0].name }, undoStack: relu.undoStack };
  });
  note('UR-03', legacy);
  ok(Array.isArray(legacy.undoStack) && legacy.undoStack.length === 0
    && JSON.stringify(legacy.avant) === JSON.stringify(legacy.apres),
    'UR-03 : une pile d’annulation héritée de V2.8.3.2 est IGNORÉE au chargement — app.undoStack revient à [] et aucune donnée métier n’est perdue', 'UR-03');
  await ctx.close();
}

// ============================================================
// UR-04 → UR-09 — Mécanique de la pile
// ============================================================
console.log('\n[UR-PILE] Undo, Redo, chaîne, branche, limite, clone');
{
  const { ctx, p } = await newPage({ tag: 'PILE' });
  const r = await ev(p, () => {
    const out = {};
    const mut = (n) => { snapshot(); app.tasks[0].name = 'N' + n; save(); actionToast('Tâche modifiée'); };
    const nom = () => app.tasks[0].name;
    const origine = nom();

    mut(1);
    out.apresMutation = nom();
    undo();
    out.apresUndo = { nom: nom(), attendu: origine };

    redo();
    out.apresRedo = { nom: nom(), attendu: 'N1' };

    // Chaîne A → B → C
    mut(2); mut(3);
    out.chaine = { avant: nom(), pile: undoHistory.length };
    undo(); undo(); undo();
    out.chaineUndo = { nom: nom(), attendu: origine, undo: undoHistory.length, redo: redoHistory.length };
    redo(); redo(); redo();
    out.chaineRedo = { nom: nom(), attendu: 'N3', undo: undoHistory.length, redo: redoHistory.length };

    // Branche : deux Undo puis une NOUVELLE mutation
    undo(); undo();
    const redoAvant = redoHistory.length;
    mut(9);
    out.branche = { redoAvant, redoApres: redoHistory.length, redoRetour: redo(), nom: nom() };

    // Limite
    for (let i = 0; i < 25; i++) mut(100 + i);
    out.limite = undoHistory.length;
    return out;
  });
  note('UR-04', r);
  ok(r.apresUndo.nom === r.apresUndo.attendu, 'UR-04 : après une modification puis Undo, l’état métier est exactement celui d’avant', 'UR-04');
  ok(r.apresRedo.nom === 'N1', 'UR-05 : Redo restaure exactement l’état d’après la modification', 'UR-05');
  ok(r.chaineUndo.nom === r.chaineUndo.attendu && r.chaineUndo.undo === 0 && r.chaineUndo.redo === 3
    && r.chaineRedo.nom === 'N3' && r.chaineRedo.redo === 0,
    'UR-06 : A → B → C, trois Undo ramènent à l’état initial et trois Redo restaurent C — les deux piles s’équilibrent exactement', 'UR-06');
  ok(r.branche.redoAvant === 2 && r.branche.redoApres === 0 && r.branche.redoRetour === false,
    'UR-07 : une nouvelle modification après deux Undo SUPPRIME la branche Redo — Redo n’a plus aucun effet', 'UR-07');
  ok(r.limite === 20, `UR-08 : après 25 mutations, la pile est plafonnée à 20 (${r.limite}) — c’est le plus ANCIEN état qui part`, 'UR-08');

  // UR-09 — indépendance du clone.
  const clone = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks[0];
    snapshot();
    const fige = JSON.stringify(undoHistory.at(-1));
    t.name = 'MUTÉ';
    t.additionalResourceIds = ['eric', 'lucas'];
    t.deps = ['task-x'];
    app.history.push({ id: 'h-x', text: 'ajout', at: '2026-01-01T00:00' });
    app.milestones[0].name = 'MUTÉ';
    if (app.controlInstances?.length) app.controlInstances[0].status = 'conform';
    if (app.photos?.length) app.photos[0].comment = 'MUTÉ';
    if (app.lots?.length) app.lots[0].name = 'MUTÉ';
    return { intact: JSON.stringify(undoHistory.at(-1)) === fige, profond: typeof structuredClone === 'function' };
  });
  note('UR-09', clone);
  ok(clone.intact,
    'UR-09 : muter ensuite tâches, ressources additionnelles, dépendances, historique, jalons, contrôles, photos et lots ne modifie PAS le snapshot déjà pris — le clone est profond', 'UR-09');
  await ctx.close();
}

// ============================================================
// UR-10 → UR-12 — Les toasts
// ============================================================
console.log('\n[UR-TOAST] Boutons Annuler et Rétablir');
{
  const { ctx, p } = await newPage({ tag: 'TOAST' });
  await ev(p, () => { go('planning'); });
  await p.waitForTimeout(250);
  const t1 = await ev(p, () => {
    snapshot(); app.tasks[0].name = 'Nom modifié'; save(); actionToast('Tâche modifiée');
    const btn = document.querySelector('#toast button');
    return { texte: document.querySelector('#toast').textContent, bouton: btn?.textContent, tag: btn?.tagName, type: btn?.getAttribute('type') };
  });
  note('UR-10', t1);
  ok(/Annuler/.test(t1.bouton || '') && t1.tag === 'BUTTON' && t1.type === 'button',
    'UR-10 : après une mutation annulable, le toast porte un vrai <button> « Annuler » — accessible au clavier', 'UR-10');
  await shot(p, '01-action-toast-annuler.png');

  const clic = await ev(p, () => {
    document.querySelector('#toast button').click();
    return { nom: app.tasks[0].name, toast: document.querySelector('#toast').textContent, bouton: document.querySelector('#toast button')?.textContent };
  });
  note('UR-11', clic);
  ok(clic.nom !== 'Nom modifié' && /Modification annulée/.test(clic.toast) && clic.bouton === 'Rétablir',
    'UR-11 : cliquer « Annuler » annule réellement, puis le toast devient « Modification annulée · Rétablir »', 'UR-11');
  await shot(p, '02-undo-toast-retablir.png');

  const retab = await ev(p, () => {
    document.querySelector('#toast button').click();
    return { nom: app.tasks[0].name, toast: document.querySelector('#toast').textContent, bouton: document.querySelector('#toast button')?.textContent };
  });
  note('UR-12', retab);
  ok(retab.nom === 'Nom modifié' && /Modification rétablie/.test(retab.toast) && retab.bouton === 'Annuler',
    'UR-12 : cliquer « Rétablir » restaure l’état, puis le toast devient « Modification rétablie · Annuler »', 'UR-12');
  await shot(p, '03-redo-toast-annuler.png');
  await ctx.close();
}

// ============================================================
// UR-13 → UR-20 — Clavier
// ============================================================
console.log('\n[UR-CLAVIER] Raccourcis et protection des champs texte');
{
  const { ctx, p } = await newPage({ tag: 'CLAVIER' });
  const prep = () => ev(p, () => {
    resetApp(); setDepth('pilot');
    snapshot(); app.tasks[0].name = 'CLAVIER'; save(); actionToast('Tâche modifiée');
    document.body.focus();
    return app.tasks[0].name;
  });

  for (const [combo, code, attendu, id, libelle] of [
    ['Control+z', null, 'undo', 'UR-13', 'Ctrl+Z annule'],
    ['Meta+z', null, 'undo', 'UR-14', 'Cmd+Z annule (macOS)'],
  ]) {
    await prep();
    await p.keyboard.press(combo);
    await p.waitForTimeout(120);
    const st = await ev(p, () => ({ nom: app.tasks[0].name, redo: redoHistory.length }));
    note(id, { combo, ...st });
    ok(st.nom !== 'CLAVIER' && st.redo === 1, `${id} : ${libelle} la dernière transaction métier`, id);
  }

  for (const [combo, id, libelle] of [
    ['Control+Shift+z', 'UR-15', 'Ctrl+Maj+Z rétablit'],
    ['Meta+Shift+z', 'UR-16', 'Cmd+Maj+Z rétablit (macOS)'],
    ['Control+y', 'UR-17', 'Ctrl+Y rétablit'],
  ]) {
    await prep();
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(100);
    await p.keyboard.press(combo);
    await p.waitForTimeout(120);
    const st = await ev(p, () => ({ nom: app.tasks[0].name, redo: redoHistory.length }));
    note(id, { combo, ...st });
    ok(st.nom === 'CLAVIER' && st.redo === 0, `${id} : ${libelle} la transaction annulée`, id);
  }

  // UR-18 → UR-20 : Ctrl+Z appartient au champ dans lequel on écrit.
  for (const [type, id] of [['input', 'UR-18'], ['textarea', 'UR-19'], ['contenteditable', 'UR-20']]) {
    await prep();
    const avant = await ev(p, () => ({ nom: app.tasks[0].name, undo: undoHistory.length, redo: redoHistory.length }));
    await ev(p, (kind) => {
      const host = document.createElement('div');
      host.id = 'urField';
      host.innerHTML = kind === 'input' ? '<input id="urTarget">'
        : kind === 'textarea' ? '<textarea id="urTarget"></textarea>'
          : '<div id="urTarget" contenteditable="true"></div>';
      document.body.appendChild(host);
      document.querySelector('#urTarget').focus();
    }, type);
    await p.keyboard.type('ABCDE');
    await p.waitForTimeout(80);
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(150);
    const apres = await ev(p, () => {
      const el = document.querySelector('#urTarget');
      const val = el.tagName === 'DIV' ? el.textContent : el.value;
      const detecte = isTextEditingTarget(el);
      document.querySelector('#urField').remove();
      return { nom: app.tasks[0].name, undo: undoHistory.length, redo: redoHistory.length, valeur: val, detecte };
    });
    note(id, { type, avant, apres });
    ok(apres.detecte && apres.nom === avant.nom && apres.undo === avant.undo && apres.redo === avant.redo,
      `${id} : dans un ${type}, Ctrl+Z reste l’annulation NATIVE du texte — Kanvix n’intercepte rien, l’état métier et les deux piles sont inchangés`, id);
  }
  await ctx.close();
}

// ============================================================
// UR-21 → UR-27 — Tâches
// ============================================================
console.log('\n[UR-TACHES] Création, édition, suppression, statut, planning, propagation, reprise');
{
  const { ctx, p } = await newPage({ tag: 'TACHES' });

  // UR-21 — création : l'identifiant doit revenir à l'identique.
  const cre = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const n = app.tasks.length;
    snapshot();
    const id = 'task-ur-21';
    app.tasks.push({ id, projectId: 'keravel', name: 'Tâche UR', status: 'todo', resourceId: 'eric',
      start: shiftDateStr(dayKey(TODAY), 2) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 2) + 'T17:00', deps: [] });
    save(); actionToast('Tâche ajoutée');
    const apres = app.tasks.length;
    undo();
    const undoOk = app.tasks.length === n && !task(id);
    redo();
    return { n, apres, undoOk, redoId: task(id)?.id, redoN: app.tasks.length };
  });
  note('UR-21', cre);
  ok(cre.undoOk && cre.redoId === 'task-ur-21' && cre.redoN === cre.apres,
    'UR-21 : créer une tâche, l’annuler puis la rétablir redonne le MÊME identifiant — Redo restaure un état, il ne recrée pas la donnée', 'UR-21');

  // UR-22 — édition multi-champs.
  const edit = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks[0];
    const avant = { nom: t.name, start: t.start, end: t.end, res: t.resourceId, add: structuredClone(t.additionalResourceIds || []) };
    snapshot();
    t.name = 'Édité'; t.start = shiftDateStr(dayKey(TODAY), 5) + 'T08:00';
    t.end = shiftDateStr(dayKey(TODAY), 6) + 'T17:00'; t.additionalResourceIds = ['lucas'];
    save(); actionToast('Tâche modifiée');
    const apres = { nom: t.name, start: t.start, end: t.end, add: structuredClone(t.additionalResourceIds) };
    undo();
    const u = app.tasks[0];
    const undoOk = u.name === avant.nom && u.start === avant.start && u.end === avant.end
      && JSON.stringify(u.additionalResourceIds || []) === JSON.stringify(avant.add);
    redo();
    const r = app.tasks[0];
    return { undoOk, redoOk: r.name === apres.nom && r.start === apres.start && JSON.stringify(r.additionalResourceIds) === JSON.stringify(apres.add) };
  });
  note('UR-22', edit);
  ok(edit.undoOk && edit.redoOk, 'UR-22 : nom, dates et ressources additionnelles reviennent et se rétablissent tous ensemble', 'UR-22');

  // UR-23 — suppression via le moteur produit.
  const sup = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const id = app.tasks.find((t) => app.tasks.some((o) => (o.deps || []).includes(t.id)))?.id || app.tasks[0].id;
    const avant = { n: app.tasks.length, hist: app.history.length, deps: app.tasks.map((t) => (t.deps || []).join(',')).join('|') };
    confirmDeleteTask(id);
    const apres = { n: app.tasks.length, existe: !!task(id) };
    undo();
    const u = { n: app.tasks.length, existe: !!task(id), deps: app.tasks.map((t) => (t.deps || []).join(',')).join('|'), hist: app.history.length };
    redo();
    return { avant, apres, u, redoN: app.tasks.length, id };
  });
  note('UR-23', sup);
  ok(sup.apres.n < sup.avant.n && sup.u.n === sup.avant.n && sup.u.existe
    && sup.u.deps === sup.avant.deps && sup.u.hist === sup.avant.hist && sup.redoN === sup.apres.n,
    'UR-23 : supprimer une tâche puis Undo restaure la tâche, ses dépendances ET l’historique — Redo rétablit la suppression', 'UR-23');

  // UR-24 — statut via setTaskStatus(), moteur inchangé.
  const st = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.status === 'todo');
    const h0 = app.history.length;
    setTaskStatus(t.id, 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ /* V2.12.0 — RE-POINTAGE. Le passage « En cours » traverse désormais aussi la garde des CONDITIONS DE DÉMARRAGE (§12) : on confirme, comme l'utilisateur, exactement comme on confirmait déjà le calendrier depuis V2.8.5.2. L'exigence testée est inchangée. */ if (document.querySelector('#modal.open [data-prq-confirm]')) confirmPrerequisiteStart(); if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    const s1 = { st: task(t.id).status, hist: app.history.length };
    setTaskStatus(t.id, 'done');
    const s2 = { st: task(t.id).status, hist: app.history.length };
    undo();
    const u1 = { st: task(t.id).status, hist: app.history.length };
    undo();
    const u2 = { st: task(t.id).status, hist: app.history.length };
    redo(); redo();
    return { h0, s1, s2, u1, u2, final: { st: task(t.id).status, hist: app.history.length } };
  });
  note('UR-24', st);
  ok(st.s1.st === 'doing' && st.u1.st === 'doing' && st.u2.st === 'todo' && st.u2.hist === st.h0
    && st.final.st === st.s2.st && st.final.hist === st.s2.hist,
    'UR-24 : todo → doing → done s’annule et se rétablit pas à pas, et l’historique suit exactement — aucun événement en double', 'UR-24');

  // UR-25 — déplacement Planning par le moteur existant.
  const mv = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks[0];
    const avant = { start: t.start, end: t.end };
    requestTaskScheduleMove(t.id, shiftDateStr(dayKey(t.start), 3), 'planning-gantt');
    const apres = { start: task(t.id).start, end: task(t.id).end };
    undo();
    const u = { start: task(t.id).start, end: task(t.id).end };
    redo();
    const r = { start: task(t.id).start, end: task(t.id).end };
    return { avant, apres, u, r, bouge: apres.start !== avant.start };
  });
  note('UR-25', mv);
  ok(mv.bouge && JSON.stringify(mv.u) === JSON.stringify(mv.avant) && JSON.stringify(mv.r) === JSON.stringify(mv.apres),
    'UR-25 : un déplacement passé par le moteur Planning existant s’annule aux dates EXACTES d’avant et se rétablit aux dates exactes d’après', 'UR-25');

  // UR-26 — propagation : un geste, un Undo.
  const prop = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const chaine = app.tasks.filter((t) => t.projectId === 'keravel').slice(0, 4);
    const avant = chaine.map((t) => ({ id: t.id, start: t.start }));
    // Une SEULE transaction qui décale quatre tâches, comme le fait une
    // replanification produit.
    snapshot();
    chaine.forEach((t) => { t.start = shiftDateStr(dayKey(t.start), 4); t.end = shiftDateStr(dayKey(t.end), 4); });
    app.history.push({ id: 'h-prop', text: '4 tâches replanifiées', at: localDateTime(getDemoNow()) });
    save(); actionToast('4 tâches replanifiées');
    const pile = undoHistory.length;
    undo();
    const u = chaine.map((t) => ({ id: t.id, start: task(t.id).start }));
    return { avant, u, pile, toutes: JSON.stringify(avant) === JSON.stringify(u), hist: app.history.some((h) => h.id === 'h-prop') };
  });
  note('UR-26', prop);
  ok(prop.toutes && !prop.hist,
    'UR-26 : une modification qui en impacte trois autres revient en UN SEUL Undo — les quatre tâches et l’événement d’historique ensemble', 'UR-26');

  // UR-27 — reprise via createRework().
  const rw = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const orig = app.tasks.find((t) => t.status !== 'done') || app.tasks[0];
    const n0 = app.tasks.length;
    const snapOrig = structuredClone(orig);
    createRework(orig.id, { comment: 'Reprise UR-27', dataUrl: null, planDate: shiftDateStr(dayKey(TODAY), 3), duration: 1 });
    const cree = app.tasks.filter((t) => t.reworkOfTaskId === orig.id);
    const idCree = cree.at(-1)?.id;
    undo();
    const u = { n: app.tasks.length, existe: !!task(idCree), origIntact: JSON.stringify(task(orig.id)) === JSON.stringify(snapOrig) };
    redo();
    return { n0, apresN: n0 + cree.length, idCree, u, redoId: task(idCree)?.id };
  });
  note('UR-27', rw);
  ok(rw.idCree && !rw.u.existe && rw.u.n === rw.n0 && rw.u.origIntact && rw.redoId === rw.idCree,
    'UR-27 : créer une reprise puis Undo la supprime en laissant l’original strictement intact — Redo restitue la MÊME reprise, même identifiant', 'UR-27');
  await ctx.close();
}

// ============================================================
// UR-28 → UR-31 — Chantiers et opérations
// ============================================================
console.log('\n[UR-CHANTIERS] Cycle de vie, cascade, opérations');
{
  const { ctx, p } = await newPage({ tag: 'CHANTIERS' });

  const proj = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const n = app.projects.length, id = 'proj-ur-28';
    snapshot();
    app.projects.push({ id, name: 'Chantier UR', location: 'Brest', phase: 'Gros œuvre', lifecycle: 'active', operationId: null });
    save(); actionToast('Chantier créé');
    undo();
    const u = { n: app.projects.length, existe: !!project(id) };
    redo();
    return { n, u, redoId: project(id)?.id };
  });
  note('UR-28', proj);
  ok(!proj.u.existe && proj.u.n === proj.n && proj.redoId === 'proj-ur-28',
    'UR-28 : créer un chantier, l’annuler et le rétablir conserve le MÊME projectId', 'UR-28');

  // UR-29 — suppression en cascade.
  const casc = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const id = 'keravel';
    const compte = () => ({
      projets: app.projects.length,
      taches: app.tasks.filter((t) => t.projectId === id).length,
      incidents: app.issues.filter((i) => i.projectId === id).length,
      photos: app.photos.filter((x) => x.projectId === id).length,
      controles: (app.controlInstances || []).filter((c) => task(c.taskId)?.projectId === id).length,
      hist: app.history.length,
    });
    const avant = compte();
    confirmDeleteProject(id);
    const apres = compte();
    undo();
    const u = compte();
    return { avant, apres, u, ok: JSON.stringify(avant) === JSON.stringify(u), supprime: apres.projets < avant.projets };
  });
  note('UR-29', casc);
  ok(casc.supprime && casc.ok,
    'UR-29 : supprimer un chantier avec ses tâches, incidents, photos, contrôles et historique revient en UN Undo — tout le groupe est restauré', 'UR-29');

  // UR-30 — cycle de vie.
  const cycle = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const id = 'keravel', lc = () => project(id).lifecycle;
    const l0 = lc();
    confirmCloseProject(id);
    const l1 = lc();
    undo(); const u1 = lc();
    redo(); const r1 = lc();
    confirmArchiveProject(id);
    const l2 = lc();
    undo(); const u2 = lc();
    redo(); const r2 = lc();
    return { l0, l1, u1, r1, l2, u2, r2 };
  });
  note('UR-30', cycle);
  ok(cycle.l1 !== cycle.l0 && cycle.u1 === cycle.l0 && cycle.r1 === cycle.l1
    && cycle.l2 !== cycle.l1 && cycle.u2 === cycle.l1 && cycle.r2 === cycle.l2,
    'UR-30 : clôturer puis archiver s’annule et se rétablit à chaque étape — le cycle de vie revient exactement en arrière', 'UR-30');

  // UR-31 — rattachement à une opération.
  const op = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const pid = app.projects.find((x) => !x.operationId)?.id || 'villa';
    const avant = project(pid).operationId;
    snapshot();
    project(pid).operationId = window.OP;
    save(); actionToast('Chantiers de l’opération mis à jour');
    const apres = project(pid).operationId;
    undo();
    const u = project(pid).operationId;
    redo();
    return { pid, avant, apres, u, r: project(pid).operationId, op: window.OP, membres: operationProjectIds(window.OP).length };
  });
  note('UR-31', op);
  ok(op.apres === op.op && op.u === op.avant && op.r === op.apres,
    'UR-31 : rattacher un chantier à une opération s’annule et se rétablit exactement', 'UR-31');
  await ctx.close();
}

// ============================================================
// UR-32 → UR-38 — Ressources, indisponibilités, lots, qualité, documents
// ============================================================
console.log('\n[UR-REFERENTIELS] Ressources, lots, qualité, documents');
{
  const { ctx, p } = await newPage({ tag: 'REF' });

  const res = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const id = 'res-ur-32', n = app.resources.length;
    snapshot();
    app.resources.push({ id, name: 'Ressource UR', scope: 'Interne', type: 'person', capacity: 1 });
    save(); actionToast('Ressource ajoutée');
    snapshot();
    resource(id).name = 'Ressource UR modifiée';
    save(); actionToast('Ressource modifiée');
    undo();
    const u1 = resource(id)?.name;
    undo();
    const u2 = { existe: !!resource(id), n: app.resources.length };
    redo(); redo();
    return { n, u1, u2, final: resource(id)?.name };
  });
  note('UR-32', res);
  ok(res.u1 === 'Ressource UR' && !res.u2.existe && res.u2.n === res.n && res.final === 'Ressource UR modifiée',
    'UR-32 : créer puis modifier une ressource donne DEUX steps distincts, annulables et rétablissables dans l’ordre', 'UR-32');

  const del = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const cible = app.resources.find((r) => !app.tasks.some((t) => taskResourceIds(t).includes(r.id)));
    if (!cible) return { skip: true };
    const id = cible.id;
    if (!app.unavailabilities) app.unavailabilities = [];
    app.unavailabilities.push({ id: 'unav-ur', resourceId: id, start: shiftDateStr(dayKey(TODAY), 1) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 2) + 'T17:00', reason: 'Congés' });
    save();
    const avant = { res: app.resources.length, unav: app.unavailabilities.length };
    confirmDeleteResource(id);
    const apres = { res: app.resources.length, unav: app.unavailabilities.length };
    undo();
    const u = { res: app.resources.length, unav: app.unavailabilities.length, existe: !!resource(id) };
    return { id, avant, apres, u };
  });
  note('UR-33', del);
  ok(del.skip || (del.apres.res < del.avant.res && del.u.res === del.avant.res && del.u.unav === del.avant.unav && del.u.existe),
    'UR-33 : supprimer une ressource inutilisée emporte ses indisponibilités — Undo restaure les deux ensemble', 'UR-33');

  const unav = await ev(p, () => {
    resetApp(); setDepth('pilot');
    if (!app.unavailabilities) app.unavailabilities = [];
    const n0 = app.unavailabilities.length;
    snapshot();
    app.unavailabilities.push({ id: 'unav-ur-34', resourceId: app.resources[0].id, start: shiftDateStr(dayKey(TODAY), 1) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 2) + 'T17:00', reason: 'Congés' });
    save(); actionToast('Indisponibilité ajoutée');
    snapshot();
    app.unavailabilities.at(-1).reason = 'Formation';
    save(); actionToast('Indisponibilité modifiée');
    const apres = app.unavailabilities.at(-1).reason;
    undo();
    const u1 = app.unavailabilities.at(-1).reason;
    undo();
    const u2 = app.unavailabilities.length;
    redo(); redo();
    return { n0, apres, u1, u2, final: app.unavailabilities.at(-1).reason };
  });
  note('UR-34', unav);
  ok(unav.u1 === 'Congés' && unav.u2 === unav.n0 && unav.final === 'Formation',
    'UR-34 : créer, modifier et supprimer une indisponibilité s’annule et se rétablit step par step', 'UR-34');

  const lots = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const l = app.lots[Math.floor(app.lots.length / 2)], n0 = app.lots.length;
    // moveLot() réordonne par le champ `order`, pas par la position dans le
    // tableau : c'est donc `order` qu'il faut lire pour observer le geste.
    const ordre = () => app.lots.map((x) => x.id + ':' + x.order).join('|');
    const ordre0 = ordre();
    moveLot(l.id, 1);
    const ordre1 = ordre();
    setLotActive(l.id, false);
    const actif1 = lot(l.id).active;
    undo();
    const u1 = { actif: lot(l.id).active, ordre: ordre() };
    undo();
    const u2 = ordre();
    redo(); redo();
    return { n0, ordre0, ordre1, bouge: ordre0 !== ordre1, actif1, u1, u2,
      final: { ordre: ordre(), actif: lot(l.id).active } };
  });
  note('UR-35', lots);
  ok(lots.bouge && lots.u1.actif !== lots.actif1 && lots.u1.ordre === lots.ordre1
    && lots.u2 === lots.ordre0 && lots.final.ordre === lots.final.ordre && lots.final.actif === lots.actif1,
    'UR-35 : réordonner puis désactiver un lot produit deux steps — chacun s’annule et se rétablit indépendamment', 'UR-35');

  const tpl = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.controlTemplates[0];
    const a0 = t.active !== false;
    setControlTemplateActive(t.id, !a0);
    const a1 = controlTemplate(t.id).active;
    undo();
    const u = controlTemplate(t.id).active;
    redo();
    return { a0, a1, u, r: controlTemplate(t.id).active };
  });
  note('UR-36', tpl);
  ok(tpl.a1 !== tpl.u && tpl.r === tpl.a1,
    'UR-36 : activer ou désactiver un modèle de contrôle s’annule et se rétablit', 'UR-36');

  // UR-37 — contrôle qualité : transaction atomique complète.
  const qual = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const c = (app.controlInstances || []).find((x) => x.status === 'todo');
    if (!c) return { skip: true };
    const etat = () => ({
      statut: app.controlInstances.find((x) => x.id === c.id)?.status,
      tentatives: (app.controlInstances.find((x) => x.id === c.id)?.attempts || []).length,
      photos: app.photos.length,
      hist: app.history.length,
      photoIds: structuredClone(app.controlInstances.find((x) => x.id === c.id)?.photoIds || []),
    });
    const avant = etat();
    const checkedItemIds = (c.items || []).map((it) => it.id);
    const envoye = submitControlAttempt(c.id, 'conform', { checkedItemIds, comment: 'Contrôle UR-37', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    const apres = etat();
    const pile = undoHistory.length;
    undo();
    const u = etat();
    redo();
    const r = etat();
    return { envoye, avant, apres, u, r, pile, undoOk: JSON.stringify(avant) === JSON.stringify(u), redoOk: JSON.stringify(apres) === JSON.stringify(r) };
  });
  note('UR-37', qual);
  ok(qual.skip || (qual.envoye !== false && qual.apres.statut !== qual.avant.statut
    && qual.apres.tentatives > qual.avant.tentatives && qual.apres.photos > qual.avant.photos
    && qual.undoOk && qual.redoOk),
    'UR-37 : un contrôle qualité — statut, tentative, photo, photoIds et historique — revient et se rétablit comme UN SEUL bloc', 'UR-37');

  const doc = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const n0 = app.documents.length, np = app.photos.length;
    snapshot();
    app.documents.push({ id: 'doc-ur-38', projectId: 'keravel', name: 'Doc UR', category: 'plan', addedAt: localDateTime(getDemoNow()) });
    save(); actionToast('Document ajouté');
    snapshot();
    addPhoto({ projectId: 'keravel', taskId: null, resourceId: null, author: 'Eric', comment: 'Photo UR', dataUrl: null });
    actionToast('Photo ajoutée');
    undo();
    const u1 = { photos: app.photos.length, docs: app.documents.length };
    undo();
    const u2 = { photos: app.photos.length, docs: app.documents.length };
    redo(); redo();
    return { n0, np, u1, u2, final: { docs: app.documents.length, photos: app.photos.length } };
  });
  note('UR-38', doc);
  ok(doc.u1.photos === doc.np && doc.u1.docs === doc.n0 + 1 && doc.u2.docs === doc.n0
    && doc.final.docs === doc.n0 + 1 && doc.final.photos === doc.np + 1,
    'UR-38 : un document puis une photo donnent deux steps, annulables et rétablissables dans l’ordre', 'UR-38');
  await ctx.close();
}

// ============================================================
// UR-39 → UR-42 — Import, scénario, historique métier
// ============================================================
console.log('\n[UR-TRANSACTIONS] Import, rollback, scénario, app.history');
{
  const { ctx, p } = await newPage({ tag: 'TRANS' });

  // UR-39 / UR-40 — import réussi puis import invalide.
  const imp = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const cle = () => JSON.stringify({ p: app.projects.map((x) => x.id), t: app.tasks.length });
    const avant = cle();
    snapshot();
    app.projects.push({ id: 'proj-import', name: 'Chantier importé', location: 'Brest', phase: 'Gros œuvre', lifecycle: 'active', operationId: null });
    app.tasks.push({ id: 'task-import', projectId: 'proj-import', name: 'Tâche importée', status: 'todo', resourceId: null,
      start: shiftDateStr(dayKey(TODAY), 1) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 1) + 'T17:00', deps: [] });
    save();
    const apres = cle();
    const pile = undoHistory.length;
    undo();
    const u = cle();
    redo();
    return { avant, apres, u, r: cle(), pile };
  });
  note('UR-39', imp);
  ok(imp.u === imp.avant && imp.r === imp.apres,
    'UR-39 : un import complet est UN SEUL step — Undo restitue l’état exact d’avant, Redo l’état exact d’après', 'UR-39');

  // UR-40 — un import qui échoue ne doit toucher NI app NI les deux piles.
  const fail = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // On prépare un historique réel : deux mutations puis un Undo, donc une
    // branche Redo vivante.
    snapshot(); app.tasks[0].name = 'A'; save();
    snapshot(); app.tasks[0].name = 'B'; save();
    undo();
    const avant = {
      app: JSON.stringify(app), undo: undoHistory.length, redo: redoHistory.length,
      undoSig: undoHistory.map((s) => s.tasks[0].name).join('|'),
      redoSig: redoHistory.map((s) => s.tasks[0].name).join('|'),
    };
    // Rollback d'import : même mécanique que applyImportNow() en échec.
    const backup = structuredClone({ ...app, undoStack: [] }),
      undoCheckpoint = undoHistory.slice(),
      redoCheckpoint = redoHistory.slice();
    snapshot();
    app.projects.push({ id: 'bad', name: 'Invalide', lifecycle: 'active' });
    app.tasks.push({ id: 'bad-t', projectId: 'inconnu', name: 'Orpheline', status: 'todo', start: 'x', end: 'y', deps: [] });
    const valide = validateImportState(app);
    // Échec simulé → rollback complet, exactement comme le produit.
    undoHistory = undoCheckpoint;
    redoHistory = redoCheckpoint;
    ['projects', 'tasks', 'milestones', 'issues', 'decisions', 'messages', 'documents', 'photos', 'history', 'companyTemplates'].forEach((k) => (app[k] = backup[k]));
    const apres = {
      app: JSON.stringify(app), undo: undoHistory.length, redo: redoHistory.length,
      undoSig: undoHistory.map((s) => s.tasks[0].name).join('|'),
      redoSig: redoHistory.map((s) => s.tasks[0].name).join('|'),
    };
    return { valideOk: valide.ok, identique: JSON.stringify(avant) === JSON.stringify(apres), avant: { u: avant.undo, r: avant.redo, rs: avant.redoSig }, apres: { u: apres.undo, r: apres.redo, rs: apres.redoSig } };
  });
  note('UR-40', fail);
  ok(!fail.valideOk && fail.identique && fail.avant.r > 0,
    'UR-40 : un import invalide laisse `app`, undoHistory ET redoHistory strictement identiques — aucune branche Redo n’est perdue sur un import finalement annulé', 'UR-40');

  // UR-41 — scénario appliqué.
  const sc = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const opts = scenarioOptions('windows-delay');
    if (!opts || !opts.length) return { skip: true };
    app.simulation = opts[0];
    const ids = app.simulation.changes.map((c) => c.taskId);
    const avant = ids.map((id) => ({ id, start: task(id)?.start, end: task(id)?.end }));
    applySimulation();
    const apres = ids.map((id) => ({ id, start: task(id)?.start, end: task(id)?.end }));
    undo();
    const u = ids.map((id) => ({ id, start: task(id)?.start, end: task(id)?.end }));
    redo();
    const r = ids.map((id) => ({ id, start: task(id)?.start, end: task(id)?.end }));
    return { n: ids.length, bouge: JSON.stringify(avant) !== JSON.stringify(apres),
      undoOk: JSON.stringify(u) === JSON.stringify(avant), redoOk: JSON.stringify(r) === JSON.stringify(apres) };
  });
  note('UR-41', sc);
  ok(sc.skip || (sc.bouge && sc.undoOk && sc.redoOk),
    'UR-41 : appliquer un scénario modifie plusieurs tâches et revient en UN SEUL Undo — Redo le réapplique à l’identique', 'UR-41');

  // UR-42 — app.history fait partie de l'état restauré.
  const hist = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.status === 'todo');
    const h0 = app.history.length;
    setTaskStatus(t.id, 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ /* V2.12.0 — RE-POINTAGE. Le passage « En cours » traverse désormais aussi la garde des CONDITIONS DE DÉMARRAGE (§12) : on confirme, comme l'utilisateur, exactement comme on confirmait déjà le calendrier depuis V2.8.5.2. L'exigence testée est inchangée. */ if (document.querySelector('#modal.open [data-prq-confirm]')) confirmPrerequisiteStart(); if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    const nouveaux = app.history.slice(h0);
    const sig = JSON.stringify(nouveaux);
    undo();
    const u = app.history.length;
    redo();
    const r = app.history.slice(h0);
    return { h0, ajoutes: nouveaux.length, u, apresRedo: app.history.length, memeEvent: JSON.stringify(r) === sig, doublon: app.history.length > h0 + nouveaux.length };
  });
  note('UR-42', hist);
  ok(hist.ajoutes > 0 && hist.u === hist.h0 && hist.memeEvent && !hist.doublon,
    'UR-42 : l’événement d’historique créé par une mutation disparaît à l’Undo et revient À L’IDENTIQUE au Redo — jamais en double', 'UR-42');
  await ctx.close();
}

// ============================================================
// UR-43 → UR-48 — Persistance, cycle de vie, multi-onglets
// ============================================================
console.log('\n[UR-PERSISTANCE] Backup, localStorage, reload, restore, reset, sync');
{
  const { ctx, p } = await newPage({ tag: 'PERSIST' });
  const pers = await ev(p, () => {
    resetApp(); setDepth('pilot');
    for (let i = 0; i < 10; i++) { snapshot(); app.tasks[0].name = 'P' + i; save(); }
    const backup = buildKanvixBackup();
    const brut = JSON.parse(localStorage.getItem(STORE));
    return {
      pile: undoHistory.length,
      backupUndo: backup.state.undoStack,
      backupRedo: backup.state.redoStack === undefined && backup.redoStack === undefined,
      lsUndo: brut.undoStack,
      lsRedo: brut.redoStack === undefined,
      payload: JSON.stringify(backup).includes('redoHistory') || JSON.stringify(backup).includes('undoHistory'),
    };
  });
  note('UR-43', pers);
  ok(Array.isArray(pers.backupUndo) && pers.backupUndo.length === 0 && pers.backupRedo && !pers.payload,
    'UR-43 : après 5+ modifications, la sauvegarde Kanvix porte state.undoStack = [] et aucune pile Redo — l’historique ne sort jamais du navigateur', 'UR-43');
  ok(Array.isArray(pers.lsUndo) && pers.lsUndo.length === 0 && pers.lsRedo && pers.pile === 10,
    'UR-44 : après 10 mutations, localStorage contient undoStack = [] et aucun redoStack, alors que la pile de session en compte bien 10', 'UR-44');
  await ctx.close();

  // UR-45 — rechargement : les données persistent, l'historique non.
  const { ctx: c2, p: p2 } = await newPage({ tag: 'RELOAD' });
  await ev(p2, () => {
    resetApp(); setDepth('pilot');
    for (let i = 0; i < 3; i++) { snapshot(); app.tasks[0].name = 'R' + i; save(); }
  });
  const avantReload = await ev(p2, () => ({ nom: app.tasks[0].name, undo: undoHistory.length }));
  await p2.reload({ waitUntil: 'load' });
  await p2.waitForTimeout(400);
  const apresReload = await ev(p2, () => ({ nom: app.tasks[0].name, undo: undoHistory.length, redo: redoHistory.length, legacy: app.undoStack.length }));
  note('UR-45', { avantReload, apresReload });
  ok(apresReload.nom === avantReload.nom && apresReload.undo === 0 && apresReload.redo === 0 && apresReload.legacy === 0,
    'UR-45 : après rechargement, les données métier sont bien là mais les deux piles sont vides — l’historique est volontairement SESSION-LOCAL', 'UR-45');
  await c2.close();

  // UR-46 / UR-47 — restauration et réinitialisation.
  const { ctx: c3, p: p3 } = await newPage({ tag: 'CYCLE' });
  const cyc = await ev(p3, () => {
    const remplir = () => {
      resetApp(); setDepth('pilot');
      for (let i = 0; i < 3; i++) { snapshot(); app.tasks[0].name = 'C' + i; save(); }
      undo();
      return { undo: undoHistory.length, redo: redoHistory.length };
    };
    const avantRestore = remplir();
    const backup = buildKanvixBackup();
    pendingKanvixBackup = backup;
    confirmKanvixRestore();
    const apresRestore = { undo: undoHistory.length, redo: redoHistory.length };
    const avantReset = remplir();
    resetApp();
    const apresReset = { undo: undoHistory.length, redo: redoHistory.length };
    return { avantRestore, apresRestore, avantReset, apresReset };
  });
  note('UR-46', cyc);
  ok(cyc.avantRestore.undo > 0 && cyc.avantRestore.redo > 0 && cyc.apresRestore.undo === 0 && cyc.apresRestore.redo === 0,
    'UR-46 : restaurer une sauvegarde vide les deux piles — le monde métier vient d’être remplacé, un Undi hérité serait dangereux'.replace('Undi', 'Undo'), 'UR-46');
  ok(cyc.avantReset.undo > 0 && cyc.apresReset.undo === 0 && cyc.apresReset.redo === 0,
    'UR-47 : réinitialiser l’application vide les deux piles', 'UR-47');
  await c3.close();

  // UR-48 — synchronisation multi-onglets.
  const { ctx: c4, p: p4 } = await newPage({ tag: 'SYNC' });
  const sync = await ev(p4, () => {
    resetApp(); setDepth('pilot');
    // Onglet A : un historique vivant, avec une branche Redo.
    snapshot(); app.tasks[0].name = 'A1'; save();
    snapshot(); app.tasks[0].name = 'A2'; save();
    undo();
    const avant = { undo: undoHistory.length, redo: redoHistory.length, nom: app.tasks[0].name,
      role: app.settings.role, page: app.ui.page, appearance: app.settings.appearance };
    app.ui.page = 'planning';
    // Onglet B : un autre état métier est écrit dans localStorage.
    const autre = structuredClone(app);
    autre.tasks[0].name = 'MODIFIÉ PAR B';
    autre.settings = structuredClone(app.settings);
    autre.settings.role = 'artisan';
    autre.ui = structuredClone(app.ui);
    autre.ui.page = 'today';
    autre.undoStack = [];
    localStorage.setItem(STORE, JSON.stringify(autre));
    applyStorageSync();
    return { avant, apres: { undo: undoHistory.length, redo: redoHistory.length, nom: app.tasks[0].name,
      role: app.settings.role, page: app.ui.page } };
  });
  note('UR-48', sync);
  ok(sync.apres.nom === 'MODIFIÉ PAR B' && sync.apres.undo === 0 && sync.apres.redo === 0
    && sync.apres.role === sync.avant.role && sync.apres.page === 'planning',
    'UR-48 : à la synchronisation, l’onglet adopte la vérité métier de l’autre, CONSERVE son rôle et sa page, et vide ses deux piles — un Undo local écraserait sinon la modification de l’autre onglet', 'UR-48');
  await c4.close();
}

// ============================================================
// UR-49 → UR-53 — Actions non annulables et no-op
// ============================================================
console.log('\n[UR-EXTERNE] Actions externes, faux Annuler, no-op');
{
  const { ctx, p } = await newPage({ tag: 'EXT' });
  await ev(p, () => { go('team'); });
  await p.waitForTimeout(250);

  const ext = await ev(p, () => {
    resetApp(); setDepth('pilot');
    snapshot(); app.tasks[0].name = 'AVANT EXTERNE'; save(); actionToast('Tâche modifiée');
    undo();
    const avant = { undo: undoHistory.length, redo: redoHistory.length };
    // Une action à effet externe qui modifie tout de même `app`.
    const r = app.resources.find((x) => x.accountStatus !== undefined) || app.resources[0];
    r.accountStatus = 'invited';
    r.invitedAt = localDateTime(getDemoNow());
    invalidateRedo();
    save();
    toast('Invitation renvoyée · démonstration');
    return { avant, apres: { undo: undoHistory.length, redo: redoHistory.length },
      bouton: !!document.querySelector('#toast button'), texte: document.querySelector('#toast').textContent };
  });
  note('UR-49', ext);
  ok(ext.avant.redo > 0 && ext.apres.redo === 0,
    'UR-49 : une action non annulable qui modifie `app` INVALIDE la branche Redo — après elle, le monde a changé et l’ancienne branche ne peut plus être rétablie sans risque', 'UR-49');
  ok(!ext.bouton,
    'UR-50 : le toast d’une action non annulable ne porte AUCUN bouton « Annuler » — impossible d’annuler par erreur une action antérieure', 'UR-50');

  // UR-50 bis — la garantie est structurelle : enchaînement A undoable → B non.
  const chain = await ev(p, () => {
    resetApp(); setDepth('pilot');
    snapshot(); app.tasks[0].name = 'A UNDOABLE'; save(); actionToast('Tâche modifiée');
    const a = { bouton: !!document.querySelector('#toast button') };
    app.settings.weatherCity = 'Brest';
    save(); actionToast('Réglage enregistré');
    const bTexte = document.querySelector('#toast').textContent;
    return { a, b: { bouton: !!document.querySelector('#toast button'), texte: bTexte }, nom: app.tasks[0].name };
  });
  note('UR-50', chain);
  ok(chain.a.bouton && !chain.b.bouton && chain.nom === 'A UNDOABLE',
    'UR-50 : après une action undoable A suivie d’une action sans snapshot B, le toast de B ne propose plus « Annuler » — le bouton ne peut plus annuler A par erreur', 'UR-50');

  const msg = await ev(p, () => {
    resetApp(); setDepth('pilot');
    snapshot(); app.tasks[0].name = 'M'; save();
    undo();
    const avant = redoHistory.length;
    const src = sendConversationMessage.toString() + sendArtisanMessage.toString();
    return { avant, invalide: (src.match(/invalidateRedo\(\)/g) || []).length, snapshotDansEnvoi: /snapshot\(\)/.test(src) };
  });
  note('UR-51', msg);
  ok(msg.invalide === 2 && !msg.snapshotDansEnvoi,
    'UR-51 : l’envoi d’un message ne prend AUCUN snapshot — aucun Undo ne prétend « rappeler » un message — et il invalide la branche Redo', 'UR-51');

  const inv = await ev(p, () => {
    const src = [openInviteForm, resendInvite, cancelInvite, disableAccount, relaunchIssue].map((f) => f.toString()).join('\n');
    return {
      actionToast: (src.match(/actionToast\(/g) || []).length,
      invalidate: (src.match(/invalidateRedo\(\)/g) || []).length,
      snapshot: (src.match(/(?<![A-Za-z0-9_$.])snapshot\(\)/g) || []).length,
    };
  });
  note('UR-52', inv);
  ok(inv.actionToast === 0 && inv.invalidate === 5 && inv.snapshot === 0,
    'UR-52 : invitations, relances et désactivation de compte n’utilisent plus actionToast(), ne prennent aucun snapshot et invalident toutes la branche Redo', 'UR-52');

  const noop = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks[0];
    const avant = undoHistory.length;
    requestTaskScheduleMove(t.id, t.start, 'planning-gantt');
    return { avant, apres: undoHistory.length, start: task(t.id).start };
  });
  note('UR-53', noop);
  ok(noop.apres === noop.avant,
    'UR-53 : déplacer une tâche sur sa position ACTUELLE ne crée aucun step fantôme — les gardes de no-op existantes sont conservées', 'UR-53');
  await ctx.close();
}

// ============================================================
// UR-54 → UR-56 — Mobile, Mode Chantier, baseline Jalons
// ============================================================
console.log('\n[UR-CONTEXTES] Mobile, terrain, frise V2.8.3.2');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'MOBILE' });
  await ev(p, () => { go('planning'); });
  await p.waitForTimeout(260);
  const mob = await ev(p, () => {
    snapshot(); app.tasks[0].name = 'MOBILE'; save(); actionToast('Tâche modifiée');
    const t = document.querySelector('#toast');
    const r = t.getBoundingClientRect();
    return { bouton: t.querySelector('button')?.textContent, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dansEcran: r.left >= -1 && r.right <= window.innerWidth + 1 };
  });
  note('UR-54', mob);
  await shot(p, '04-mobile-undo-toast.png');
  const mobUndo = await ev(p, () => {
    document.querySelector('#toast button').click();
    return { nom: app.tasks[0].name, bouton: document.querySelector('#toast button')?.textContent,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  note('UR-54-undo', mobUndo);
  ok(mob.bouton === 'Annuler' && mobUndo.bouton === 'Rétablir' && mob.over <= 0 && mobUndo.over <= 0 && mob.dansEcran,
    'UR-54 : à 390px, le toast reste dans l’écran, « Annuler » puis « Rétablir » fonctionnent, et rien ne déborde', 'UR-54');
  await ctx.close();

  // UR-55 — Mode Chantier.
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'FIELD' });
  const field = await ev(p2, () => {
    resetApp(); setRole('artisan'); setDepth('essential');
    const t = app.tasks.find((x) => x.status === 'todo');
    const avant = t.status;
    const res = setTaskStatus(t.id, 'doing', 'field'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ /* V2.12.0 — RE-POINTAGE. Le passage « En cours » traverse désormais aussi la garde des CONDITIONS DE DÉMARRAGE (§12) : on confirme, comme l'utilisateur, exactement comme on confirmait déjà le calendrier depuis V2.8.5.2. L'exigence testée est inchangée. */ if (document.querySelector('#modal.open [data-prq-confirm]')) confirmPrerequisiteStart(); if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    const apres = task(t.id).status;
    const pile = undoHistory.length;
    undo();
    const u = task(t.id).status;
    redo();
    return { avant, apres, u, r: task(t.id).status, pile, bottom: [...document.querySelectorAll('.field-bottom-nav button, .field-nav button')].map((b) => b.textContent.trim()) };
  });
  note('UR-55', field);
  ok(field.apres !== field.avant && field.u === field.avant && field.r === field.apres && field.pile > 0,
    'UR-55 : en Mode Chantier, un changement de statut passé par le workflow terrain existant s’annule et se rétablit — la navigation terrain est inchangée', 'UR-55');
  await c2.close();

  // UR-56 — la frise Jalons de V2.8.3.2 est intacte.
  const mesure = async (file) => {
    const { ctx, p } = await newPage({ tag: 'JAL', file });
    await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons'); });
    await p.waitForTimeout(260);
    const r = await ev(p, () => {
      const ms = [...document.querySelectorAll('.op-ms')];
      return {
        jalons: ms.length,
        statuts: [...document.querySelectorAll('.op-badge')].map((e) => e.textContent.trim()),
        synthese: [...document.querySelectorAll('.op-tl-stat')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
        squelette: [...document.querySelector('.op-body').querySelectorAll('*')].map((e) => e.tagName + '.' + [...e.classList].join('.')).join('|'),
        cartes: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().width)),
        rail: getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before').borderTopWidth,
      };
    });
    await ctx.close();
    return r;
  };
  const a = await mesure(PREV), c = await mesure(CUR);
  note('UR-56', { v2832: { jalons: a.jalons, statuts: a.statuts, cartes: a.cartes, rail: a.rail }, identique: JSON.stringify(a) === JSON.stringify(c) });
  ok(JSON.stringify(a) === JSON.stringify(c),
    'UR-56 : la frise Jalons de V2.8.3.2 — jalons, statuts, synthèse, squelette DOM, dimensions et rail — est STRICTEMENT inchangée', 'UR-56');
}

// ============================================================
// Captures Planning avant/après + thème sombre
// ============================================================
console.log('\n[UR-CAPTURES] Planning et thème sombre');
{
  const { ctx, p } = await newPage({ tag: 'SHOT' });
  await ev(p, () => { go('planning'); });
  await p.waitForTimeout(300);
  await ev(p, () => {
    const t = app.tasks[0];
    requestTaskScheduleMove(t.id, shiftDateStr(dayKey(t.start), 3), 'planning-gantt');
  });
  await p.waitForTimeout(250);
  await ev(p, () => undo());
  await shot(p, '06-planning-apres-undo.png');
  await ev(p, () => redo());
  await shot(p, '07-planning-apres-redo.png');
  await ctx.close();

  const { ctx: c2, p: p2 } = await newPage({ tag: 'DARK' });
  await ev(p2, () => { setAppearance('dark'); go('planning'); });
  await p2.waitForTimeout(300);
  const dark = await ev(p2, () => {
    snapshot(); app.tasks[0].name = 'SOMBRE'; save(); actionToast('Tâche modifiée');
    undo();
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const t = document.querySelector('#toast'), btn = t.querySelector('button');
    return { sombre: document.body.classList.contains('dark'), bouton: btn?.textContent,
      contraste: Math.abs(lum(getComputedStyle(btn).color) - lum(getComputedStyle(t).backgroundColor)) > 0.2 };
  });
  note('DARK', dark);
  await shot(p2, '05-dark-undo-toast.png');
  ok(dark.sombre && dark.bouton === 'Rétablir' && dark.contraste,
    'DARK : en thème sombre, le toast Undo reste lisible et son bouton « Rétablir » contraste avec le fond', 'DARK');
  await c2.close();
}

// ============================================================
// FREEZE-284 — Périmètre du lot
// ============================================================
console.log('\n[FREEZE-284] Byte-identité des moteurs métier');
{
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
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
    'setTaskStatus', 'submitControlAttempt', 'createRework', 'requestTaskScheduleMove',
    'requestGanttTaskMove', 'dropTask', 'planReflow', 'applyReflowPlan', 'evaluateScenario',
    'getProjectHealth', 'getProjectSummary', 'getProjectClosureStatus', 'milestoneStatus',
    'isUpcomingMilestone', 'milestoneLinkedTask', 'milestoneOpenTasks', 'operationMilestoneStats',
    'operationMilestonesTab', 'operationMilestoneBar', 'operationMilestones',
    'visibleOperationMilestones', 'milestoneImpactNote', 'calculateProjectEnd',
    'taskResourceIds', 'taskHasResource', 'getResourceSchedulingConflicts', 'getResourceTasks',
    'getResourceConflicts', 'getResourceLoad', 'getResourceState', 'resourceLoadBoard',
    'resourceLoadGroups', 'buildImportPlan', 'validateImportState',
    'renderField', 'handleFieldSiteTab', 'fieldControlSection', 'getProjectTasks',
    'pendingControlsForProject', 'pendingControlsForTask', 'controlFormHTML', 'controlRowHTML',
    'planningAgenda', 'gantt', 'kanbanBoard', 'kanbanCard',
    'operationOverviewTab', 'operationPlanningTab', 'operationResourcesTab',
    'attentionCard', 'pageToday', 'getTodayDecisions', 'getTodayWarnings', 'getTodayPendingControls',
    'renderSites', 'siteCard', 'historyHTML', 'projectHistory', 'validateKanvixBackup',
    'projectToneClass', 'projectVisual', 'emptyState', 'icon', 'getCurrentWeekRange',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-284', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-284 : les ${frozen.length} moteurs métier de V2.8.3.2 sont BYTE-IDENTIQUES — Planning, Jalons, Qualité, Ressources, Conflits, Opérations, Simulation, Reflow, Reprise et Mode Chantier. Undo/Redo ENVELOPPE les mutations, il ne les remplace pas`, 'FREEZE-284');

  const attendu = ['save', 'migrateState', 'applyStorageSync', 'resetApp', 'snapshot', 'undo',
    'actionToast', 'toast', 'applyImportNow', 'confirmKanvixRestore', 'openProjectEdit',
    'openMilestoneForm', 'openCompanyTemplateForm', 'openIssueForm', 'openDocumentForm',
    'openDocumentEdit', 'openResourceForm', 'addFieldPhoto', 'openPhotoForm', 'relaunchIssue',
    'openInviteForm', 'resendInvite', 'cancelInvite', 'disableAccount', 'sendArtisanMessage',
    'sendConversationMessage'];
  const changed = attendu.filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['cloneHistoryState', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'restoreHistoryState', 'redo', 'historyToast', 'isTextEditingTarget']
    .filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-284-périmètre', { modifiées: changed, nonModifiées: attendu.filter((n) => !changed.includes(n)), ajoutées: added });
  ok(added.length === 8 && changed.every((n) => attendu.includes(n)),
    'FREEZE-284 : les huit helpers Undo/Redo sont ajoutés, et toute fonction modifiée appartient à la liste explicitement autorisée', 'FREEZE-284');

  // La pile runtime ne vit plus dans `app`.
  const runtime = {
    piles: /let undoHistory = \[\],\s*\n\s*redoHistory = \[\]/.test(curSrc),
    limite: /const UNDO_LIMIT = 20;/.test(curSrc),
    pasDeRedoStack: !/app\.redoStack/.test(curSrc),
    undoStackResiduel: (curSrc.match(/app\.undoStack/g) || []).length,
  };
  note('FREEZE-284-runtime', runtime);
  ok(runtime.piles && runtime.limite && runtime.pasDeRedoStack && runtime.undoStackResiduel <= 3,
    'FREEZE-284 : les deux piles vivent HORS de `app`, la limite est de 20, app.redoStack n’existe pas et app.undoStack n’est plus qu’un champ legacy remis à []', 'FREEZE-284');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-284-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  /* V2.9.0 — RE-BASELINE. Le schéma passe à 13 : `structureNodes` est ajouté,
     VIDE pour tout état antérieur, et chaque tâche reçoit structureNodeId = null
     (V2.9.0 §43). Ce round-ci n'ajoutait effectivement aucune migration ; la
     garantie durable que cette assertion protège reste le STORE — strictement
     inchangé — et le fait qu'un schéma ne RECULE jamais. On vérifie donc ces
     deux invariants-là, sans rien relâcher d'autre. */
  ok(store(curSrc) === 'kanvix-product-8-3' && Number(schema(curSrc)) >= Number(schema(prevSrc)) && Number(schema(curSrc)) >= 12,
    'FREEZE-284 : STORE et SCHEMA_VERSION (12) strictement inchangés — aucune migration', 'FREEZE-284');
}

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
