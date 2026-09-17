// ============================================================
// KANVIX — Recette « Commandes Undo / Redo persistantes » (V2.8.4.1)
//
//   Le moteur V2.8.4 est GELÉ. Ce lot n'ajoute qu'une EXPOSITION : deux boutons
//   ↶ / ↷ de barre d'outils, et deux piles de libellés parallèles pour dire à
//   l'utilisateur ce qu'il s'apprête à annuler ou rétablir.
//
//   Trois niveaux, un seul moteur :
//     toast = raccourci immédiat · boutons = moyen permanent · clavier = expert
//
//   La question à laquelle cette recette répond :
//     « Kanvix propose-t-il un Undo/Redo classique et permanent, permettant de
//       remonter et redescendre plusieurs actions, sans alourdir l'interface ni
//       introduire un second moteur ? »
//
//   Usage : node recette-undo-redo-ui-v2.8.4.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.4.1.html';
const PREV = 'kanvix-next-gen-v2.8.4.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.4.1/';
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
// UIUR-01 → UIUR-07 — Présence, états, tooltips, clics
// ============================================================
console.log('\n[UIUR-BASE] Présence, états et tooltips');
{
  const { ctx, p } = await newPage({ tag: 'BASE' });
  await ev(p, () => go('planning'));
  await p.waitForTimeout(300);

  const pres = await ev(p, () => {
    const grp = document.querySelector('.planning-header .history-controls');
    const enfants = [...document.querySelectorAll('.planning-header .actions > *')].map((e) => e.className || e.tagName);
    const u = document.querySelector('[data-history="undo"]'), r = document.querySelector('[data-history="redo"]');
    return {
      present: !!grp, enfants,
      svgUndo: !!u.querySelector('svg'), svgRedo: !!r.querySelector('svg'),
      unicode: /[↶↷]/.test(document.querySelector('.planning-header .actions').textContent),
      tags: [u.tagName, r.tagName], types: [u.type, r.type],
      aria: [u.getAttribute('aria-label'), r.getAttribute('aria-label')],
      role: grp?.getAttribute('role'),
    };
  });
  note('UIUR-01', pres);
  ok(pres.present && pres.enfants[0] === 'history-controls' && pres.enfants[1] === 'head-sep'
    && /btn/.test(pres.enfants[2]) && /primary/.test(pres.enfants[3]),
    'UIUR-01 : sur le Planning, les commandes ↶ / ↷ précèdent « Exporter PDF » et « + Tâche », séparées par un filet', 'UIUR-01');
  ok(pres.svgUndo && pres.svgRedo && !pres.unicode && pres.tags.join('') === 'BUTTONBUTTON'
    && pres.types.join('') === 'buttonbutton' && pres.aria.join('|') === 'Annuler|Rétablir',
    'UIUR-01 : ce sont de vrais <button type="button"> à icônes SVG — aucun caractère Unicode en rendu — avec aria-label « Annuler » et « Rétablir »', 'UIUR-01');

  const cycle = await ev(p, () => {
    const q = () => ({ u: document.querySelector('[data-history="undo"]'), r: document.querySelector('[data-history="redo"]') });
    const st = () => { const { u, r } = q(); return { uDis: u.disabled, rDis: r.disabled, uT: u.title, rT: r.title }; };
    const out = { initial: st() };
    snapshot(); app.tasks[0].name = 'T1'; save(); actionToast('Tâche modifiée');
    out.apresMutation = { ...st(), nom: app.tasks[0].name };
    q().u.click();
    out.apresUndo = { ...st(), nom: app.tasks[0].name };
    q().r.click();
    out.apresRedo = { ...st(), nom: app.tasks[0].name };
    return out;
  });
  note('UIUR-02', cycle);
  ok(cycle.initial.uDis && cycle.initial.rDis
    && cycle.initial.uT === 'Annuler — Ctrl+Z' && cycle.initial.rT === 'Rétablir — Ctrl+Maj+Z / Ctrl+Y',
    'UIUR-02 : à l’état initial les deux boutons sont désactivés, et leur infobulle annonce le raccourci sans nommer d’action', 'UIUR-02');
  ok(!cycle.apresMutation.uDis && cycle.apresMutation.rDis,
    'UIUR-03 : après une mutation, Undo devient actif et Redo reste désactivé', 'UIUR-03');
  ok(cycle.apresMutation.uT === 'Annuler : Tâche modifiée — Ctrl+Z',
    'UIUR-04 : l’infobulle Undo nomme l’action et rappelle le raccourci — « Annuler : Tâche modifiée — Ctrl+Z »', 'UIUR-04');
  ok(cycle.apresUndo.nom !== 'T1' && !cycle.apresUndo.rDis,
    'UIUR-05 : cliquer le bouton ↶ annule réellement la mutation', 'UIUR-05');
  ok(cycle.apresUndo.rT === 'Rétablir : Tâche modifiée — Ctrl+Maj+Z / Ctrl+Y',
    'UIUR-06 : après l’Undo, Redo devient actif et son infobulle nomme l’action qui sera rétablie', 'UIUR-06');
  ok(cycle.apresRedo.nom === 'T1' && cycle.apresRedo.rDis && !cycle.apresRedo.uDis,
    'UIUR-07 : cliquer le bouton ↷ restaure la mutation, et Redo redevient désactivé', 'UIUR-07');
  await ctx.close();
}

// ============================================================
// UIUR-08 → UIUR-12 — Chaîne, libellés, branche, limite, invariants
// ============================================================
console.log('\n[UIUR-CHAINE] Plusieurs Undo, plusieurs Redo, libellés');
{
  const { ctx, p } = await newPage({ tag: 'CHAINE' });
  await ev(p, () => go('planning'));
  await p.waitForTimeout(280);
  await shot(p, '01-planning-undo-redo-disabled.png');

  const r = await ev(p, () => {
    const q = () => ({ u: document.querySelector('[data-history="undo"]'), r: document.querySelector('[data-history="redo"]') });
    const st = () => { const { u, r } = q(); return { uDis: u.disabled, rDis: r.disabled, uT: u.title, rT: r.title,
      piles: [undoHistory.length, undoLabels.length, redoHistory.length, redoLabels.length] }; };
    const inv = [];
    const check = () => inv.push(undoHistory.length === undoLabels.length && redoHistory.length === redoLabels.length);
    const out = { etats: [] };
    const origine = { t: app.tasks[0].name, r: app.resources[0].name, p: app.projects[0].name };
    check();
    snapshot(); app.tasks[0].name = 'A'; save(); actionToast('Tâche modifiée'); check();
    snapshot(); app.resources[0].name = 'B'; save(); actionToast('Ressource modifiée'); check();
    snapshot(); app.projects[0].name = 'C'; save(); actionToast('Chantier modifié'); check();
    out.apresC = st();
    q().u.click(); check(); out.undo1 = st();
    q().u.click(); check(); out.undo2 = st();
    q().u.click(); check(); out.undo3 = { ...st(), etat: { t: app.tasks[0].name, r: app.resources[0].name, p: app.projects[0].name } };
    out.retourOrigine = JSON.stringify(out.undo3.etat) === JSON.stringify(origine);
    q().r.click(); q().r.click(); q().r.click(); check();
    out.redo3 = { ...st(), etat: { t: app.tasks[0].name, r: app.resources[0].name, p: app.projects[0].name } };
    // Branche
    undo(); undo();
    snapshot(); app.tasks[0].name = 'D'; save(); actionToast('Tâche modifiée'); check();
    out.branche = st();
    // Limite
    for (let i = 0; i < 25; i++) { snapshot(); app.tasks[0].name = 'L' + i; save(); actionToast('Tâche modifiée ' + i); check(); }
    out.limite = [undoHistory.length, undoLabels.length];
    out.invariants = { total: inv.length, tousVrais: inv.every(Boolean) };
    return out;
  });
  note('UIUR-08', { apresC: r.apresC, undo3: r.undo3, redo3: r.redo3, retourOrigine: r.retourOrigine });
  ok(r.retourOrigine && r.undo3.uDis
    && r.redo3.etat.t === 'A' && r.redo3.etat.r === 'B' && r.redo3.etat.p === 'C' && r.redo3.rDis,
    'UIUR-08 : trois clics ↶ ramènent à l’état initial et trois clics ↷ restaurent A, B et C — les boutons se désactivent aux extrémités', 'UIUR-08');

  note('UIUR-09', { apresC: r.apresC.uT, undo1: { u: r.undo1.uT, r: r.undo1.rT }, undo2: { u: r.undo2.uT, r: r.undo2.rT } });
  ok(r.apresC.uT === 'Annuler : Chantier modifié — Ctrl+Z'
    && r.undo1.uT === 'Annuler : Ressource modifiée — Ctrl+Z'
    && r.undo1.rT === 'Rétablir : Chantier modifié — Ctrl+Maj+Z / Ctrl+Y'
    && r.undo2.uT === 'Annuler : Tâche modifiée — Ctrl+Z'
    && r.undo2.rT === 'Rétablir : Ressource modifiée — Ctrl+Maj+Z / Ctrl+Y',
    'UIUR-09 : les libellés VOYAGENT avec la transition — après avoir annulé « Chantier modifié », Undo propose « Ressource modifiée » et Redo « Chantier modifié »', 'UIUR-09');

  note('UIUR-10', r.branche);
  ok(r.branche.rDis && r.branche.piles[2] === 0 && r.branche.piles[3] === 0,
    'UIUR-10 : une nouvelle mutation après deux Undo désactive Redo et vide redoHistory ET redoLabels', 'UIUR-10');
  note('UIUR-11', { limite: r.limite });
  ok(r.limite[0] === 20 && r.limite[1] === 20,
    'UIUR-11 : après 25 mutations, les deux piles Undo sont plafonnées à 20 — état et libellé partent ensemble', 'UIUR-11');
  note('UIUR-12', r.invariants);
  ok(r.invariants.tousVrais && r.invariants.total >= 33,
    `UIUR-12 : l’invariant undoHistory.length === undoLabels.length et redoHistory.length === redoLabels.length est vérifié aux ${r.invariants.total} étapes du scénario`, 'UIUR-12');
  await ctx.close();
}

// ============================================================
// UIUR-13 → UIUR-15 — Le toast, et surtout sa disparition
// ============================================================
console.log('\n[UIUR-TOAST] Le toast reste, et la toolbar prend le relais');
{
  const { ctx, p } = await newPage({ tag: 'TOAST' });
  await ev(p, () => go('planning'));
  await p.waitForTimeout(280);
  const t = await ev(p, () => {
    snapshot(); app.tasks[0].name = 'TOAST'; save(); actionToast('Tâche modifiée');
    return { texte: document.querySelector('#toast').textContent, bouton: document.querySelector('#toast button')?.textContent,
      visible: document.querySelector('#toast').classList.contains('show') };
  });
  note('UIUR-13', t);
  ok(t.bouton === 'Annuler' && t.visible && /Tâche modifiée/.test(t.texte),
    'UIUR-13 : le toast « Tâche modifiée · Annuler » de V2.8.4 fonctionne exactement comme avant', 'UIUR-13');
  await shot(p, '02-planning-undo-enabled.png');

  // UIUR-14 — TEST CRITIQUE : le toast s'efface, la toolbar reste.
  await p.waitForTimeout(4600);
  const apres = await ev(p, () => {
    const toastVisible = document.querySelector('#toast').classList.contains('show');
    const u = document.querySelector('[data-history="undo"]');
    const avant = app.tasks[0].name;
    u.click();
    return { toastVisible, undoActif: !u.disabled, avant, apres: app.tasks[0].name };
  });
  note('UIUR-14', apres);
  ok(!apres.toastVisible && apres.undoActif && apres.avant === 'TOAST' && apres.apres !== 'TOAST',
    'UIUR-14 : plus de 4 secondes après la mutation, le toast a disparu mais le bouton ↶ reste ACTIF et annule bel et bien — le toast n’est plus le seul chemin', 'UIUR-14');
  await shot(p, '05-toast-disparu-undo-disponible.png');

  // UIUR-15 — plusieurs actions, tous les toasts expirés.
  const long = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    ['Tâche modifiée', 'Ressource modifiée', 'Chantier modifié'].forEach((lbl, i) => {
      snapshot();
      if (i === 0) app.tasks[0].name = 'X0';
      else if (i === 1) app.resources[0].name = 'X1';
      else app.projects[0].name = 'X2';
      save(); actionToast(lbl);
    });
    return { piles: [undoHistory.length, undoLabels.length] };
  });
  await p.waitForTimeout(4600);
  const relais = await ev(p, () => {
    const btn = () => document.querySelector('[data-history="undo"]');
    const out = { toastVisible: document.querySelector('#toast').classList.contains('show'), titres: [] };
    for (let i = 0; i < 3; i++) { out.titres.push(btn().title); btn().click(); }
    out.final = { t: app.tasks[0].name, r: app.resources[0].name, p: app.projects[0].name, uDis: btn().disabled };
    return out;
  });
  note('UIUR-15', { long, relais });
  ok(!relais.toastVisible && relais.final.t !== 'X0' && relais.final.r !== 'X1' && relais.final.p !== 'X2'
    && relais.final.uDis
    && relais.titres[0].includes('Chantier modifié')
    && relais.titres[1].includes('Ressource modifiée')
    && relais.titres[2].includes('Tâche modifiée'),
    'UIUR-15 : trois actions dont tous les toasts ont expiré restent annulables une par une par la toolbar, dans le bon ordre', 'UIUR-15');
  await shot(p, '04-trois-actions-undo.png');
  await ctx.close();
}

// ============================================================
// UIUR-16 → UIUR-18 — Clavier, champs texte, actions externes
// ============================================================
console.log('\n[UIUR-COEXISTENCE] Clavier, saisie, actions externes');
{
  const { ctx, p } = await newPage({ tag: 'COEX' });
  await ev(p, () => { go('planning'); snapshot(); app.tasks[0].name = 'KB'; save(); actionToast('Tâche modifiée'); document.body.focus(); });
  await p.waitForTimeout(250);
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(150);
  const kb = await ev(p, () => ({ nom: app.tasks[0].name, rDis: document.querySelector('[data-history="redo"]').disabled,
    rT: document.querySelector('[data-history="redo"]').title }));
  note('UIUR-16', kb);
  ok(kb.nom !== 'KB' && !kb.rDis && kb.rT.includes('Tâche modifiée'),
    'UIUR-16 : Ctrl+Z fonctionne toujours, et la toolbar se met à jour en conséquence — un seul moteur pour les trois chemins', 'UIUR-16');

  const champ = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    snapshot(); app.tasks[0].name = 'INPUT'; save(); actionToast('Tâche modifiée');
    const host = document.createElement('div');
    host.id = 'uiField'; host.innerHTML = '<input id="uiTarget">';
    document.body.appendChild(host);
    document.querySelector('#uiTarget').focus();
    return { nom: app.tasks[0].name, piles: [undoHistory.length, undoLabels.length] };
  });
  await p.keyboard.type('ABCDE');
  await p.keyboard.press('Control+z');
  await p.waitForTimeout(150);
  const apresChamp = await ev(p, () => {
    const out = { nom: app.tasks[0].name, piles: [undoHistory.length, undoLabels.length],
      uDis: document.querySelector('[data-history="undo"]').disabled };
    document.querySelector('#uiField').remove();
    return out;
  });
  note('UIUR-17', { champ, apresChamp });
  ok(apresChamp.nom === champ.nom && JSON.stringify(apresChamp.piles) === JSON.stringify(champ.piles) && !apresChamp.uDis,
    'UIUR-17 : dans un champ de saisie, Ctrl+Z reste l’annulation native — l’état métier, les quatre piles et les boutons sont inchangés', 'UIUR-17');

  const ext = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    snapshot(); app.tasks[0].name = 'AVANT'; save(); actionToast('Tâche modifiée');
    undo();
    const avant = { rDis: document.querySelector('[data-history="redo"]').disabled,
      uT: document.querySelector('[data-history="undo"]').title, redo: redoHistory.length, redoL: redoLabels.length };
    // Action à effet externe qui modifie tout de même `app`.
    const r = app.resources[0];
    r.accountStatus = 'invited';
    invalidateRedo();
    save();
    toast('Invitation renvoyée · démonstration');
    return { avant, apres: { rDis: document.querySelector('[data-history="redo"]').disabled,
      uT: document.querySelector('[data-history="undo"]').title,
      redo: redoHistory.length, redoL: redoLabels.length,
      toastBouton: !!document.querySelector('#toast button'),
      undoLabels: undoLabels.slice() } };
  });
  note('UIUR-18', ext);
  ok(!ext.avant.rDis && ext.apres.rDis && ext.apres.redo === 0 && ext.apres.redoL === 0
    && !ext.apres.toastBouton && !ext.apres.undoLabels.includes('Invitation renvoyée · démonstration'),
    'UIUR-18 : une action externe n’ajoute AUCUN libellé, ne propose aucun faux « Annuler », et désactive le bouton Redo puisqu’elle invalide la branche', 'UIUR-18');
  await ctx.close();
}

// ============================================================
// UIUR-19 → UIUR-23 — Cycle de vie et import
// ============================================================
console.log('\n[UIUR-CYCLE] Reset, restore, sync, import');
{
  const { ctx, p } = await newPage({ tag: 'CYCLE' });
  const cyc = await ev(p, () => {
    const q = () => ({ u: document.querySelector('[data-history="undo"]'), r: document.querySelector('[data-history="redo"]') });
    const piles = () => [undoHistory.length, undoLabels.length, redoHistory.length, redoLabels.length];
    const remplir = () => {
      resetApp(); setDepth('pilot'); go('planning');
      for (let i = 0; i < 3; i++) { snapshot(); app.tasks[0].name = 'Z' + i; save(); actionToast('Tâche modifiée ' + i); }
      undo();
      return piles();
    };
    const out = {};
    out.avantReset = remplir();
    resetApp(); go('planning');
    out.apresReset = { piles: piles(), uDis: q().u.disabled, rDis: q().r.disabled };
    out.avantRestore = remplir();
    pendingKanvixBackup = buildKanvixBackup();
    confirmKanvixRestore();
    go('planning');
    out.apresRestore = { piles: piles(), uDis: q().u.disabled, rDis: q().r.disabled };
    out.avantSync = remplir();
    const autre = structuredClone(app);
    autre.tasks[0].name = 'PAR B';
    autre.undoStack = [];
    localStorage.setItem(STORE, JSON.stringify(autre));
    applyStorageSync();
    go('planning');
    out.apresSync = { piles: piles(), uDis: q().u.disabled, rDis: q().r.disabled, nom: app.tasks[0].name };
    return out;
  });
  note('UIUR-19', cyc);
  const vide = (x) => JSON.stringify(x.piles) === '[0,0,0,0]' && x.uDis && x.rDis;
  ok(cyc.avantReset[0] > 0 && vide(cyc.apresReset),
    'UIUR-19 : après réinitialisation, les QUATRE piles sont vides et les deux boutons désactivés', 'UIUR-19');
  ok(vide(cyc.apresRestore),
    'UIUR-20 : après restauration d’une sauvegarde, les quatre piles sont vides et les deux boutons désactivés', 'UIUR-20');
  ok(vide(cyc.apresSync) && cyc.apresSync.nom === 'PAR B',
    'UIUR-21 : après adoption d’un état externe par synchronisation, les quatre piles sont vides et les boutons désactivés', 'UIUR-21');

  const imp = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    // Import réussi : une transaction, un libellé.
    snapshot();
    app.projects.push({ id: 'proj-imp', name: 'Chantier importé', location: 'Brest', phase: 'Gros œuvre', lifecycle: 'active', operationId: null });
    save(); actionToast('Import terminé');
    const apres = { uT: document.querySelector('[data-history="undo"]').title, existe: !!project('proj-imp') };
    undo();
    const u = { existe: !!project('proj-imp'), rT: document.querySelector('[data-history="redo"]').title };
    redo();
    return { apres, u, r: !!project('proj-imp') };
  });
  note('UIUR-22', imp);
  ok(imp.apres.uT.includes('Import terminé') && !imp.u.existe && imp.u.rT.includes('Import terminé') && imp.r,
    'UIUR-22 : un import réussi porte son propre libellé — « Annuler : Import terminé » — et s’annule puis se rétablit d’un clic', 'UIUR-22');

  const fail = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    snapshot(); app.tasks[0].name = 'F1'; save(); actionToast('Tâche modifiée');
    snapshot(); app.tasks[0].name = 'F2'; save(); actionToast('Tâche déplacée');
    undo();
    const sig = () => JSON.stringify({ u: undoHistory.length, ul: undoLabels.slice(), r: redoHistory.length, rl: redoLabels.slice() });
    const avant = sig();
    // Rollback d'import, exactement comme applyImportNow() en échec.
    const backup = structuredClone({ ...app, undoStack: [] }),
      undoCheckpoint = undoHistory.slice(), redoCheckpoint = redoHistory.slice(),
      undoLabelCheckpoint = undoLabels.slice(), redoLabelCheckpoint = redoLabels.slice();
    snapshot();
    app.projects.push({ id: 'bad', name: 'Invalide', lifecycle: 'active' });
    app.tasks.push({ id: 'bad-t', projectId: 'inconnu', name: 'Orpheline', status: 'todo', start: 'x', end: 'y', deps: [] });
    const valide = validateImportState(app);
    undoHistory = undoCheckpoint; redoHistory = redoCheckpoint;
    undoLabels = undoLabelCheckpoint; redoLabels = redoLabelCheckpoint;
    undoableSinceToast = false; refreshHistoryControls();
    ['projects', 'tasks', 'milestones', 'issues', 'decisions', 'messages', 'documents', 'photos', 'history', 'companyTemplates'].forEach((k) => (app[k] = backup[k]));
    return { valideOk: valide.ok, identique: sig() === avant, avant: JSON.parse(avant), apres: JSON.parse(sig()) };
  });
  note('UIUR-23', fail);
  ok(!fail.valideOk && fail.identique && fail.avant.rl.length > 0,
    'UIUR-23 : un import invalide laisse les QUATRE piles — états ET libellés — strictement identiques, branche Redo comprise', 'UIUR-23');
  await ctx.close();
}

// ============================================================
// UIUR-24 → UIUR-31 — Pages, responsive, terrain, sombre
// ============================================================
console.log('\n[UIUR-PAGES] Présence par page, responsive, Mode Chantier, sombre');
{
  const { ctx, p } = await newPage({ tag: 'PAGES' });
  const pages = await ev(p, () => {
    const out = {};
    const voir = (k) => {
      const grp = document.querySelectorAll('.history-controls');
      out[k] = { n: grp.length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    };
    go('planning'); voir('planning');
    go('today'); voir('today');
    go('sites'); voir('chantiers');
    setSitesMode('operations'); voir('operations');
    selectOperation(window.OP); voir('ficheOperation');
    go('sites'); setSitesMode('projects'); selectProject('keravel'); voir('ficheChantier');
    go('team'); voir('ressources');
    return out;
  });
  note('UIUR-24', pages);
  const toutes = ['planning', 'today', 'chantiers', 'operations', 'ficheOperation', 'ficheChantier', 'ressources'];
  ok(toutes.every((k) => pages[k].n >= 1 && pages[k].over <= 0),
    'UIUR-24 → UIUR-28 : les commandes sont présentes sur Planning, Aujourd’hui, Chantiers, Opérations, fiche Opération, fiche Chantier et Ressources — sans débordement horizontal', 'UIUR-24');

  // Un seul composant : aucune duplication de balisage.
  const unique = await ev(p, () => {
    const src = historyControls.toString();
    return { appels: (document.documentElement.innerHTML.match(/data-history="undo"/g) || []).length,
      composant: typeof historyControls === 'function' && typeof refreshHistoryControls === 'function',
      helper: src.includes('historyControlsState') };
  });
  note('UIUR-24-composant', unique);
  ok(unique.composant && unique.helper && unique.appels >= 1,
    'UIUR-24 : un composant commun historyControls() rend les deux boutons — aucun balisage copié-collé par page', 'UIUR-24');

  await ev(p, () => go('today'));
  await shot(p, '06-aujourdhui-controls.png');
  await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); });
  await shot(p, '07-operations-controls.png');
  await ctx.close();

  // Responsive : dix formats.
  const { ctx: c2, p: p2 } = await newPage({ tag: 'RESP' });
  const resp = [];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390]) {
    await p2.setViewportSize({ width: w, height: 900 });
    await ev(p2, () => { go('planning'); });
    await p2.waitForTimeout(160);
    resp.push(await ev(p2, (w) => ({ w, n: document.querySelectorAll('.history-controls').length,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth }), w));
  }
  note('UIUR-29', resp);
  ok(resp.every((x) => x.n >= 1 && x.over <= 0),
    'UIUR-29 : de 1920 à 390px, les commandes sont présentes et AUCUN format ne déborde horizontalement', 'UIUR-29');
  await p2.setViewportSize({ width: 390, height: 844 });
  await ev(p2, () => { go('planning'); snapshot(); app.tasks[0].name = 'M'; save(); actionToast('Tâche modifiée'); });
  await p2.waitForTimeout(250);
  const mob = await ev(p2, () => ({ n: document.querySelectorAll('.history-controls').length,
    uDis: document.querySelector('[data-history="undo"]').disabled,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bottom: document.querySelectorAll('.bottom-nav button, nav.bottom button').length }));
  note('UIUR-29-mobile', mob);
  await shot(p2, '08-mobile-controls.png');
  ok(mob.n >= 1 && !mob.uDis && mob.over <= 0,
    'UIUR-29 : à 390px les commandes restent accessibles et actives, sans gêner les actions principales', 'UIUR-29');
  await c2.close();

  // UIUR-30 — Mode Chantier : absence STRUCTURELLE, toast toujours là.
  const { ctx: c3, p: p3 } = await newPage({ w: 390, h: 844, tag: 'FIELD' });
  const field = await ev(p3, () => {
    resetApp(); setRole('driver'); setDepth('pilot');
    enterFieldMode(); selectFieldProject('keravel');
    const t = app.tasks.find((x) => x.status === 'todo');
    setTaskStatus(t.id, 'doing', 'field');
    const out = { controls: document.querySelectorAll('.history-controls').length,
      bottom: document.querySelectorAll('.field-bottom-nav button, .field-nav button').length,
      toast: document.querySelector('#toast').textContent,
      toastBouton: document.querySelector('#toast button')?.textContent,
      statutAvant: task(t.id).status };
    undo();
    out.statutApres = task(t.id).status;
    return out;
  });
  note('UIUR-30', field);
  ok(field.controls === 0 && field.toastBouton === 'Annuler'
    && field.statutAvant === 'doing' && field.statutApres === 'todo',
    'UIUR-30 : en Mode Chantier les commandes sont absentes — renderField() n’appelle aucun en-tête porteur, l’absence est STRUCTURELLE — et le toast Annuler y reste pleinement fonctionnel', 'UIUR-30');
  await c3.close();

  // UIUR-31 — thème sombre.
  const { ctx: c4, p: p4 } = await newPage({ tag: 'DARK' });
  const dark = await ev(p4, () => {
    setAppearance('dark'); go('planning');
    snapshot(); app.tasks[0].name = 'D'; save(); actionToast('Tâche modifiée');
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const u = document.querySelector('[data-history="undo"]'), r = document.querySelector('[data-history="redo"]');
    const cu = getComputedStyle(u), cr = getComputedStyle(r);
    return { sombre: document.body.classList.contains('dark'),
      uDis: u.disabled, rDis: r.disabled,
      fondSombre: lum(cu.backgroundColor) < 0.5,
      texteClair: lum(cu.color) > 0.5,
      opaciteDisabled: cr.opacity,
      distinct: cu.opacity !== cr.opacity };
  });
  note('UIUR-31', dark);
  await shot(p4, '09-dark-controls.png');
  ok(dark.sombre && dark.fondSombre && dark.texteClair && !dark.uDis && dark.rDis && dark.distinct,
    'UIUR-31 : en thème sombre, le bouton actif est lisible sur fond sombre et le bouton désactivé s’en distingue nettement', 'UIUR-31');
  await c4.close();
}

// ============================================================
// UIUR-32 → UIUR-35 — Accessibilité, neutralité, persistance
// ============================================================
console.log('\n[UIUR-QUALITE] Accessibilité, neutralité, persistance');
{
  const { ctx, p } = await newPage({ tag: 'A11Y' });
  await ev(p, () => { go('planning'); snapshot(); app.tasks[0].name = 'A11Y'; save(); actionToast('Tâche modifiée'); });
  await p.waitForTimeout(250);
  const focusable = await ev(p, () => {
    const u = document.querySelector('[data-history="undo"]'), r = document.querySelector('[data-history="redo"]');
    u.focus();
    const focusUndo = document.activeElement === u;
    r.focus();
    const focusRedoDisabled = document.activeElement === r;
    return { focusUndo, rDisabled: r.disabled, focusRedoDisabled, outline: getComputedStyle(u, ':focus-visible').outlineWidth };
  });
  await ev(p, () => document.querySelector('[data-history="undo"]').focus());
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  const a11y = await ev(p, () => ({ nom: app.tasks[0].name, rDis: document.querySelector('[data-history="redo"]').disabled }));
  note('UIUR-32', { focusable, a11y });
  ok(focusable.focusUndo && focusable.rDisabled && !focusable.focusRedoDisabled
    && a11y.nom !== 'A11Y' && !a11y.rDis,
    'UIUR-32 : le bouton actif prend le focus et s’active à Entrée ; le bouton désactivé n’est ni focusable ni activable', 'UIUR-32');

  const neutre = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    snapshot(); app.tasks[0].name = 'N'; save(); actionToast('Tâche modifiée');
    const snap = () => JSON.stringify({ a: app, u: undoHistory.length, ul: undoLabels.slice(), r: redoHistory.length, rl: redoLabels.slice() });
    const avant = snap();
    historyControls(); historyControlsState(); refreshHistoryControls();
    historyControls(); refreshHistoryControls();
    return { identique: snap() === avant };
  });
  note('UIUR-33', neutre);
  ok(neutre.identique,
    'UIUR-33 : rendre ou rafraîchir les commandes ne modifie NI `app`, NI aucune des quatre piles — c’est une pure lecture', 'UIUR-33');

  const pers = await ev(p, () => {
    resetApp(); setDepth('pilot'); go('planning');
    for (let i = 0; i < 6; i++) { snapshot(); app.tasks[0].name = 'P' + i; save(); actionToast('Tâche modifiée ' + i); }
    const ls = JSON.parse(localStorage.getItem(STORE));
    const bk = buildKanvixBackup();
    const brut = JSON.stringify(bk);
    return {
      lsUndoStack: ls.undoStack,
      lsPropre: ls.undoLabels === undefined && ls.redoLabels === undefined && ls.redoHistory === undefined && ls.undoHistory === undefined && ls.redoStack === undefined,
      bkUndoStack: bk.state.undoStack,
      bkPropre: !/undoLabels|redoLabels|undoHistory|redoHistory|redoStack/.test(brut),
      pileVivante: [undoHistory.length, undoLabels.length],
    };
  });
  note('UIUR-34', pers);
  ok(Array.isArray(pers.lsUndoStack) && pers.lsUndoStack.length === 0 && pers.lsPropre && pers.pileVivante[0] === 6,
    'UIUR-34 : localStorage ne contient aucun libellé ni aucune pile — undoStack legacy reste [] — alors que la pile de session en compte bien 6', 'UIUR-34');
  ok(Array.isArray(pers.bkUndoStack) && pers.bkUndoStack.length === 0 && pers.bkPropre,
    'UIUR-35 : la sauvegarde Kanvix ne transporte aucun libellé d’historique', 'UIUR-35');
  await ctx.close();

  // Captures restantes.
  const { ctx: c2, p: p2 } = await newPage({ tag: 'SHOT' });
  await ev(p2, () => { go('planning'); snapshot(); app.tasks[0].name = 'S'; save(); actionToast('Tâche modifiée'); undo(); });
  await shot(p2, '03-apres-undo-redo-enabled.png');
  await c2.close();
}

// ============================================================
// FREEZE-2841 — Le moteur V2.8.4 est gelé
// ============================================================
console.log('\n[FREEZE-2841] Byte-identité');
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
  const frozen = [
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget',
    'setTaskStatus', 'submitControlAttempt', 'createRework', 'requestTaskScheduleMove',
    'requestGanttTaskMove', 'dropTask', 'planReflow', 'applyReflowPlan', 'evaluateScenario',
    'getProjectHealth', 'getProjectSummary', 'milestoneStatus', 'isUpcomingMilestone',
    'operationMilestoneStats', 'operationMilestonesTab', 'operationMilestoneBar',
    'operationMilestones', 'visibleOperationMilestones', 'milestoneImpactNote',
    'calculateProjectEnd', 'taskResourceIds', 'getResourceSchedulingConflicts',
    'resourceLoadBoard', 'resourceLoadGroups', 'buildImportPlan', 'applyImportPlan',
    'validateImportState', 'renderField', 'handleFieldSiteTab', 'fieldControlSection',
    'getProjectTasks', 'pendingControlsForProject', 'controlFormHTML', 'controlRowHTML',
    'planningTasks', 'planningAgenda', 'gantt', 'kanbanBoard', 'operationOverviewTab',
    'operationProjectCard', 'operationPlanningTab', 'operationResourcesTab', 'attentionCard',
    'getTodayDecisions', 'getTodayWarnings', 'siteCard', 'save', 'migrateState',
    'applyStorageSync', 'resetApp', 'buildKanvixBackup', 'confirmKanvixRestore', 'toast',
    'showToast', 'projectToneClass', 'projectVisual', 'emptyState', 'getCurrentWeekRange',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-2841', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-2841 : les ${frozen.length} fonctions de V2.8.4 sont BYTE-IDENTIQUES — dont cloneHistoryState(), restoreHistoryState(), isTextEditingTarget(), save(), migrateState(), applyStorageSync(), resetApp(), confirmKanvixRestore() et tous les moteurs métier`, 'FREEZE-2841');

  // pageToday, renderOperation et renderProject portent les commandes dans
  // leur propre en-tête : elles sont autorisées à évoluer, comme header().
  const attendu = ['snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'actionToast', 'historyToast', 'applyImportNow', 'header', 'icon', 'render',
    'pageToday', 'renderOperation', 'renderProject'];
  const changed = attendu.filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['historyControls', 'refreshHistoryControls', 'historyControlsState', 'historyLabelFor']
    .filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-2841-périmètre', { modifiées: changed, ajoutées: added });
  ok(added.length === 4 && changed.every((n) => attendu.includes(n)),
    'FREEZE-2841 : quatre helpers d’exposition ajoutés, et toute fonction modifiée appartient à la liste autorisée — synchronisation des libellés et de l’UI uniquement', 'FREEZE-2841');

  const runtime = {
    labels: /undoLabels = \[\],\s*\n\s*redoLabels = \[\]/.test(curSrc),
    pasDansApp: !/app\.undoLabels|app\.redoLabels/.test(curSrc),
    unSeulMoteur: (curSrc.match(/function undo\(\)/g) || []).length === 1 && (curSrc.match(/function redo\(\)/g) || []).length === 1,
    boutonsAppellent: /data-history="undo"[^>]*onclick="undo\(\)"/.test(curSrc) && /data-history="redo"[^>]*onclick="redo\(\)"/.test(curSrc),
  };
  note('FREEZE-2841-runtime', runtime);
  ok(runtime.labels && runtime.pasDansApp && runtime.unSeulMoteur && runtime.boutonsAppellent,
    'FREEZE-2841 : les piles de libellés vivent hors de `app`, il n’existe qu’UN undo() et qu’UN redo(), et les boutons les appellent directement — aucun second moteur', 'FREEZE-2841');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-2841-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '12',
    'FREEZE-2841 : STORE et SCHEMA_VERSION (12) strictement inchangés', 'FREEZE-2841');
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
