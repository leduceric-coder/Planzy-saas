// ============================================================
// KANVIX — Recette « Édition du Planning » (V2.8.5.2)
//
//   Deux questions, posées avec de VRAIS gestes utilisateur :
//
//   1. ÉDITION EN MODE ESSENTIEL — Kanvix démarre en « essential ». Le drag
//      des tâches et la création à la souris y étaient invisibles, car gardés
//      par `app.settings.level !== "essential"`. Un planning SIMPLE doit rester
//      un planning MANIPULABLE : la différence entre les niveaux porte sur
//      l'ANALYSE, pas sur l'édition.
//   2. DÉMARRAGE RÉEL DEPUIS L'ÉDITEUR UNIVERSEL — l'éditeur appelle
//      setTaskStatus en mode `transactional`, donc `silent` : la garde de
//      démarrage réel de V2.8.5.1 n'y était jamais atteinte.
//
//   Les gestes sont RÉELS : `locator.dragTo()` déclenche le drag HTML5 du
//   produit, `mouse.down/move/up` déclenche les Pointer Events du draw-to-create.
//   Aucun appel direct au moteur ne remplace le geste.
//
//   Usage : node recette-planning-edition-v2.8.5.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.5.2.html';
const PREV = 'kanvix-next-gen-v2.8.5.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.5.2/';
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

/* `level` est EXPLICITE. Par défaut : 'essential', c'est-à-dire l'état réel
   d'un Kanvix fraîchement réinitialisé — c'est précisément ce que la recette
   V2.8.5.1 ne testait jamais, puisque son newPage() forçait setDepth('pilot'). */
async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, level = 'essential', dark = false } = opts;
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
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate(([lvl, dk]) => {
    resetApp();
    // 'essential' = on ne touche à RIEN : c'est l'état par défaut du produit.
    if (lvl === 'pilot') setDepth('pilot');
    if (dk) setAppearance('dark');
    dismissKanvixContinuityNotice();
  }, [level, dark]);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + name, fullPage: true }); };
const planning = async (p, period = 'week', anchor = null) => {
  await ev(p, ([per, a]) => {
    app.settings.period = per;
    if (a) app.ui.periodAnchor = a;
    save(); go('planning');
  }, [period, anchor]);
  await p.waitForTimeout(300);
};
const modalState = (p) => ev(p, () => ({
  ouvert: document.querySelector('#modal').classList.contains('open'),
  titre: document.querySelector('#modalContent h2')?.textContent || '',
  corps: document.querySelector('#modalContent p')?.innerText || '',
  jours: [...document.querySelectorAll('.cal-warn-days li')].map((l) => l.textContent),
  boutons: [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => x.textContent),
  modalesOuvertes: document.querySelectorAll('.modal.open').length,
}));
const etatTache = (p, id) => ev(p, (i) => {
  const t = task(i);
  return { start: t?.start, end: t?.end, statut: t?.status, nom: t?.name,
    baseline: [t?.baselineStart, t?.baselineEnd],
    undo: undoHistory.length, redo: redoHistory.length, hist: app.history.length,
    taches: app.tasks.length };
}, id);
/* VRAI drag HTML5 : `dragTo` déclenche dragstart / dragover / drop du produit,
   exactement comme la souris d'un conducteur. Les repères sont re-résolus à
   chaque fois, car chaque rendu remplace le DOM. */
const dragBarreVers = async (p, taskId, colonne) => {
  const src = p.locator('#bar-' + taskId);
  const dst = p.locator(`#row-${taskId} .g-slot`).nth(colonne);
  if (!(await src.count()) || !(await dst.count())) return false;
  await src.dragTo(dst);
  await p.waitForTimeout(450);
  return true;
};
/* VRAI geste de dessin : Pointer Events sur la piste de création. */
const dessiner = async (p, de, a, projet = null) => {
  const box = await ev(p, (pid) => {
    const t = pid ? document.querySelector(`[data-create-track="${pid}"]`) : document.querySelector('.g-create-track');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, projet);
  if (!box) return null;
  await p.mouse.move(box.x + box.w * de, box.y + box.h / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * a, box.y + box.h / 2, { steps: 8 });
  const apercu = await ev(p, () => {
    const q = document.querySelector('.g-create-preview');
    return { visible: !q.hidden, texte: q.textContent, trait: getComputedStyle(q).borderStyle };
  });
  await p.mouse.up();
  await p.waitForTimeout(350);
  return apercu;
};

// ============================================================
// PE-01 → PE-08 — Édition en Mode Essentiel : le drag
// ============================================================
console.log('\n[PE-DRAG] Déplacer une tâche en Mode Essentiel, par un vrai drag');
{
  const { ctx, p } = await newPage({ tag: 'DRAG-E' });
  const niveau = await ev(p, () => ({
    level: app.settings.level,
    // Ce qu'on VOIT après un simple reset, sans rien toucher.
    createRows: document.querySelectorAll('.g-create-row').length,
  }));
  note('PE-01', niveau);
  ok(niveau.level === 'essential',
    `PE-01 : après resetApp(), le niveau est « ${niveau.level} » — c'est bien l'état par défaut du produit qui est testé ici`, 'PE-01');

  await planning(p, 'week');
  const gantt = await ev(p, () => {
    const t = task('k-cloisons'), bar = document.querySelector('#bar-k-cloisons');
    return {
      niveau: app.settings.level,
      barres: document.querySelectorAll('.g-bar[draggable="true"]').length,
      barreCible: bar ? bar.getAttribute('draggable') : null,
      dragstart: bar ? !!bar.getAttribute('ondragstart') : false,
      zonesDepot: document.querySelectorAll('.g-slot[ondrop]').length,
      statut: t.status,
      // La simplicité du niveau Essentiel est PRÉSERVÉE.
      barreAnalyse: document.querySelectorAll('.analysis-bar').length,
      baselines: document.querySelectorAll('.baseline').length,
      legende: document.querySelectorAll('.plan-legend').length,
      chaineImpact: document.querySelectorAll('.impact-band').length,
    };
  });
  note('PE-02', gantt);
  ok(gantt.barreCible === 'true' && gantt.dragstart && gantt.barres > 0 && gantt.zonesDepot > 0,
    `PE-02 : en Essentiel, une tâche active est réellement draggable (${gantt.barres} barres, ${gantt.zonesDepot} zones de dépôt)`, 'PE-02');
  ok(gantt.barreAnalyse === 0 && gantt.baselines === 0 && gantt.legende === 0 && gantt.chaineImpact === 0,
    'PE-02 : et l’interface Essentiel reste SIMPLE — ni barre d’analyse, ni baseline, ni légende, ni chaîne d’impact', 'PE-02');
  await shot(p, '01-essential-planning-week.png');

  const avant = await etatTache(p, 'k-cloisons');
  const fait = await dragBarreVers(p, 'k-cloisons', 2); // mercredi 19
  const apres = await etatTache(p, 'k-cloisons');
  note('PE-03', { avant, apres, gesteRealise: fait });
  ok(fait && apres.start !== avant.start && apres.start.slice(0, 10) === '2026-08-19'
    && (new Date(apres.end) - new Date(apres.start)) === (new Date(avant.end) - new Date(avant.start)),
    `PE-03 : un VRAI drag souris déplace réellement la tâche (${avant.start} → ${apres.start}) et conserve sa durée`, 'PE-03');
  ok(apres.undo === avant.undo + 1,
    `PE-04 : le drag pose exactement UN snapshot Undo (${avant.undo} → ${apres.undo})`, 'PE-04');
  await shot(p, '04-essential-drag.png');

  const u = await ev(p, () => { undo(); const t = task('k-cloisons'); return { start: t.start, end: t.end, redo: redoHistory.length }; });
  note('PE-04', u);
  ok(u.start === avant.start && u.end === avant.end,
    'PE-04 : Undo restaure exactement les dates d’origine', 'PE-04');
  const r = await ev(p, () => { redo(); const t = task('k-cloisons'); return { start: t.start, end: t.end }; });
  note('PE-05', r);
  ok(r.start === apres.start && r.end === apres.end,
    'PE-05 : Redo rejoue le déplacement à l’identique', 'PE-05');
  await ctx.close();
}

{
  const { ctx, p } = await newPage({ tag: 'DRAG-WE' });
  await planning(p, 'week');
  const avant = await etatTache(p, 'k-cloisons');
  // Semaine du 17 au 23 août : colonne 5 = samedi 22.
  await dragBarreVers(p, 'k-cloisons', 5);
  const m = await modalState(p);
  const pendant = await etatTache(p, 'k-cloisons');
  note('PE-06', { m, pendant });
  ok(m.ouvert && /jour non ouvré/i.test(m.titre) && m.jours.some((j) => /sam\. 22/.test(j)),
    `PE-06 : un VRAI drag vers le samedi ouvre la confirmation et nomme le jour — « ${m.jours[0] || ''} »`, 'PE-06');
  await shot(p, '05-essential-drag-weekend-confirm.png');

  await ev(p, () => cancelCalendarConfirm());
  await p.waitForTimeout(250);
  const annule = await etatTache(p, 'k-cloisons');
  note('PE-07', annule);
  ok(annule.start === avant.start && annule.end === avant.end
    && annule.undo === avant.undo && annule.hist === avant.hist,
    'PE-07 : « Annuler » ne modifie rien — ni dates, ni historique, ni snapshot', 'PE-07');

  await dragBarreVers(p, 'k-cloisons', 5);
  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);
  const confirme = await etatTache(p, 'k-cloisons');
  note('PE-08', confirme);
  ok(confirme.start.slice(0, 10) === '2026-08-22' && confirme.undo === avant.undo + 1,
    `PE-08 : « Planifier quand même » applique le déplacement (${confirme.start}) en UNE seule transaction Undo`, 'PE-08');
  await ctx.close();
}

// ============================================================
// PE-09 → PE-14 — Création à la souris en Mode Essentiel
// ============================================================
console.log('\n[PE-CREATION] Dessiner une tâche en Mode Essentiel');
{
  const { ctx, p } = await newPage({ tag: 'DRAW-E' });
  await planning(p, 'week');
  const presence = await ev(p, () => ({
    niveau: app.settings.level,
    lignes: document.querySelectorAll('.g-create-row').length,
    groupes: new Set(planningTasks('all').map((t) => t.projectId)).size,
    libelle: document.querySelector('.g-create-btn')?.textContent,
    pistes: document.querySelectorAll('.g-create-track').length,
    curseur: getComputedStyle(document.querySelector('.g-create-track')).cursor,
  }));
  note('PE-09', presence);
  ok(presence.niveau === 'essential' && presence.lignes === presence.groupes && presence.lignes > 0
    && presence.libelle === '+ Ajouter une tâche',
    `PE-09 : en Essentiel, « + Ajouter une tâche » est présent sous chaque chantier actif (${presence.lignes} pour ${presence.groupes})`, 'PE-09');
  ok(presence.pistes === presence.lignes && presence.curseur === 'crosshair',
    `PE-10 : la piste de dessin .g-create-track est présente (${presence.pistes}) avec le curseur crosshair`, 'PE-10');

  const avant = await ev(p, () => ({ taches: app.tasks.length, undo: undoHistory.length, hist: app.history.length }));
  const apercu = await dessiner(p, 0.10, 0.40);
  const drawer = await ev(p, () => ({
    ouvert: !!document.querySelector('#drawer.open'),
    start: document.querySelector('[name="start"]')?.value,
    end: document.querySelector('[name="end"]')?.value,
    projet: document.querySelector('[name="projectId"]')?.value,
    taches: app.tasks.length, undo: undoHistory.length,
  }));
  note('PE-11', { apercu, drawer });
  ok(apercu && apercu.visible && apercu.trait === 'dashed',
    `PE-11 : pendant le geste, l’aperçu en tirets s’affiche — « ${apercu?.texte} »`, 'PE-11');
  ok(drawer.ouvert && drawer.taches === avant.taches && drawer.undo === avant.undo,
    'PE-11 : le relâchement ouvre le formulaire, et AUCUNE tâche n’est encore créée', 'PE-11');
  ok(drawer.start === '2026-08-17T08:00' && drawer.end === '2026-08-19T17:00',
    `PE-12 : les dates dessinées sont correctement préremplies — ${drawer.start} → ${drawer.end}`, 'PE-12');
  await shot(p, '02-essential-draw-preview.png');

  await p.fill('[name="name"]', 'Créée en Essentiel');
  await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
  await p.waitForTimeout(400);
  const cree = await ev(p, () => {
    const t = app.tasks.find((x) => x.name === 'Créée en Essentiel');
    return { id: t?.id, start: t?.start, end: t?.end, projet: t?.projectId, statut: t?.status,
      taches: app.tasks.length, undo: undoHistory.length,
      modal: document.querySelector('#modal').classList.contains('open') };
  });
  note('PE-13', cree);
  ok(!!cree.id && cree.taches === avant.taches + 1 && cree.undo === avant.undo + 1 && cree.statut === 'todo',
    `PE-13 : la validation crée UNE tâche en Essentiel (${avant.taches} → ${cree.taches}), en UNE transaction`, 'PE-13');
  await shot(p, '03-essential-after-draw-create.png');

  const ur = await ev(p, (id) => {
    undo();
    const a = { taches: app.tasks.length, existe: !!task(id) };
    redo();
    const t = task(id);
    return { a, b: { taches: app.tasks.length, id: t?.id, start: t?.start, end: t?.end } };
  }, cree.id);
  note('PE-14', ur);
  ok(ur.a.taches === avant.taches && !ur.a.existe && ur.b.id === cree.id && ur.b.start === cree.start,
    'PE-14 : Undo retire la tâche créée, Redo la restaure à l’identique', 'PE-14');
  await ctx.close();
}

// ============================================================
// PE-15 → PE-18 — Pilotage et Opération
// ============================================================
console.log('\n[PE-PILOTE] Le niveau Pilotage conserve tout, l’Opération hérite du contrat');
{
  const { ctx, p } = await newPage({ tag: 'PILOT', level: 'pilot' });
  await planning(p, 'week');
  const avant = await etatTache(p, 'k-cloisons');
  await dragBarreVers(p, 'k-cloisons', 2);
  const apres = await etatTache(p, 'k-cloisons');
  const pilote = await ev(p, () => ({
    niveau: app.settings.level,
    lignes: document.querySelectorAll('.g-create-row').length,
    barres: document.querySelectorAll('.g-bar[draggable="true"]').length,
    barreAnalyse: document.querySelectorAll('.analysis-bar').length,
    legende: document.querySelectorAll('.plan-legend').length,
  }));
  note('PE-15', { avant, apres, pilote });
  ok(pilote.niveau === 'pilot' && apres.start.slice(0, 10) === '2026-08-19' && apres.undo === avant.undo + 1,
    'PE-15 : en Pilotage, le drag fonctionne exactement comme avant — aucune capacité perdue', 'PE-15');
  ok(pilote.barreAnalyse === 1 && pilote.legende === 1,
    'PE-15 : et les outils d’analyse du Pilotage (barre d’analyse, légende) sont toujours là', 'PE-15');
  await shot(p, '06-pilot-planning-week.png');

  const dessin = await dessiner(p, 0.10, 0.35);
  const d = await ev(p, () => ({ ouvert: !!document.querySelector('#drawer.open'),
    start: document.querySelector('[name="start"]')?.value }));
  note('PE-16', { dessin, d, lignes: pilote.lignes });
  ok(pilote.lignes > 0 && d.ouvert && !!d.start,
    'PE-16 : en Pilotage, la création à la souris fonctionne toujours', 'PE-16');
  await ctx.close();
}

{
  const { ctx, p } = await newPage({ tag: 'OP-E' });
  const op = await ev(p, () => {
    const o = app.operations[0];
    selectOperation(o.id); setOperationTab('Planning');
    app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); renderPage();
    return { id: o.id, niveau: app.settings.level, onglet: app.ui.operationTab,
      lignes: document.querySelectorAll('.g-create-row').length,
      barres: document.querySelectorAll('.g-bar[draggable="true"]').length,
      perimetre: operationActiveProjectIds(o.id),
      // Aucune logique spécifique à l'Opération : un seul gantt().
      unSeulGantt: (document.documentElement.innerHTML.match(/function gantt\(/g) || []).length === 1 };
  });
  await p.waitForTimeout(300);
  note('PE-17', op);
  ok(op.niveau === 'essential' && op.barres > 0 && op.unSeulGantt,
    `PE-17 : dans une Opération en Essentiel, les tâches restent draggables (${op.barres}) — aucune logique propre à l’Opération`, 'PE-17');
  await shot(p, '07-operation-essential-planning.png');

  const avant = await ev(p, () => ({ taches: app.tasks.length, undo: undoHistory.length }));
  const apercu = await dessiner(p, 0.10, 0.35);
  const drawer = await ev(p, () => ({
    ouvert: !!document.querySelector('#drawer.open'),
    start: document.querySelector('[name="start"]')?.value,
    end: document.querySelector('[name="end"]')?.value,
    projet: document.querySelector('[name="projectId"]')?.value,
    taches: app.tasks.length, undo: undoHistory.length,
  }));
  note('PE-18', { lignes: op.lignes, apercu, drawer });
  ok(op.lignes > 0 && drawer.ouvert && !!drawer.start && op.perimetre.includes(drawer.projet)
    && drawer.taches === avant.taches && drawer.undo === avant.undo,
    `PE-18 : la création à la souris y fonctionne aussi, sur le bon chantier (${drawer.projet}), sans rien muter avant validation`, 'PE-18');
  await ctx.close();
}

// ============================================================
// PE-19 → PE-22 — Les vraies interdictions restent
// ============================================================
console.log('\n[PE-GARDES] Ce que le niveau ne gardait pas, les gardes métier le gardent');
{
  const { ctx, p } = await newPage({ tag: 'GARDES' });
  const clos = await ev(p, () => {
    // Le verrou lecture seule lit `lifecycle` (projectLifecycle), pas `status`.
    const pr = app.projects.find((x) => isProjectActive(x));
    pr.lifecycle = 'closed';
    app.ui.planningProject = pr.id;
    app.settings.period = 'week'; save(); go('planning');
    return { chantier: pr.id, actif: isProjectActive(pr), readOnly: planningIsReadOnly(pr.id),
      lignes: document.querySelectorAll('.g-create-row').length,
      barres: document.querySelectorAll('.g-bar[draggable="true"]').length,
      canDraw: planningCanDrawCreate(pr.id, { canEditPlanning: true, readOnly: true, collapsed: false }) };
  });
  await p.waitForTimeout(250);
  note('PE-19', clos);
  ok(!clos.actif && clos.readOnly && clos.lignes === 0 && clos.barres === 0 && !clos.canDraw,
    'PE-19 : un chantier clôturé reste en lecture seule — ni drag, ni ligne de création', 'PE-19');

  const done = await ev(p, () => {
    resetApp();
    const t = task('k-cloisons'); t.status = 'done';
    app.settings.period = 'week'; save(); go('planning');
    const bar = document.querySelector('#bar-k-cloisons');
    return { statut: t.status, draggable: bar ? bar.getAttribute('draggable') : null,
      dragstart: bar ? !!bar.getAttribute('ondragstart') : false };
  });
  await p.waitForTimeout(250);
  note('PE-20', done);
  ok(done.statut === 'done' && done.draggable !== 'true' && !done.dragstart,
    'PE-20 : une tâche TERMINÉE n’est jamais draggable, quel que soit le niveau', 'PE-20');

  const annee = await ev(p, () => {
    resetApp();
    app.settings.period = 'year'; save(); go('planning');
    return { lignes: document.querySelectorAll('.g-create-row').length,
      canDraw: planningCanDrawCreate('keravel', { canEditPlanning: true, readOnly: false, collapsed: false }) };
  });
  await p.waitForTimeout(250);
  note('PE-21', annee);
  ok(annee.lignes === 0 && !annee.canDraw,
    'PE-21 : en vue Année, aucune création graphique — la représentation mensuelle reste trop imprécise', 'PE-21');

  const simu = await ev(p, () => {
    resetApp();
    app.settings.period = 'week'; app.simulation = { id: 'test', changes: [] }; save(); go('planning');
    return { simulation: !!app.simulation,
      lignes: document.querySelectorAll('.g-create-row').length,
      canDraw: planningCanDrawCreate('keravel', { canEditPlanning: true, readOnly: false, collapsed: false }) };
  });
  await p.waitForTimeout(250);
  note('PE-22', simu);
  ok(simu.simulation && simu.lignes === 0 && !simu.canDraw,
    'PE-22 : pendant une simulation, la création graphique reste interdite — l’interdiction de V2.8.5 est intacte', 'PE-22');
  await ctx.close();
}

// ============================================================
// PE-23 → PE-32 — Démarrage réel depuis l'éditeur universel
// ============================================================
console.log('\n[PE-EDITEUR] L’éditeur universel applique la même vérité métier');
{
  const { ctx, p } = await newPage({ tag: 'EDIT', now: '2026-08-17T14:30:00' });
  const prepare = () => ev(p, () => {
    resetApp();
    const t = task('k-cloisons');
    t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00'; t.status = 'todo'; t.deps = [];
    t.baselineStart = '2026-08-18T08:00'; t.baselineEnd = '2026-08-18T12:00';
    app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00';
    save(); go('planning');
    return { nom: t.name, start: t.start, end: t.end, statut: t.status,
      duree: (date(t.end) - date(t.start)) / 3600000,
      baseline: [t.baselineStart, t.baselineEnd],
      undo: undoHistory.length, hist: app.history.length };
  });
  const avant = await prepare();
  await p.waitForTimeout(250);
  await ev(p, () => openTaskEdit('k-cloisons', 'planning'));
  await p.waitForTimeout(300);

  const demande = await ev(p, () => {
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=name]').value = 'Nom B';
    f.querySelector('[name=status]').value = 'doing';
    submitTaskEdit();
    const t = task('k-cloisons');
    return {
      modal: document.querySelector('#modal').classList.contains('open'),
      titre: document.querySelector('#modalContent h2')?.textContent,
      corps: document.querySelector('#modalContent p')?.innerText,
      boutons: [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => x.textContent),
      drawer: !!document.querySelector('#drawer.open'),
      nom: t.name, statut: t.status, start: t.start, end: t.end,
      undo: undoHistory.length, hist: app.history.length,
    };
  });
  note('PE-23', demande);
  ok(demande.modal && /Démarrer cette tâche maintenant/.test(demande.titre)
    && /mar\. 18 août/.test(demande.corps) && /lun\. 17 août/.test(demande.corps),
    'PE-23 : depuis l’ÉDITEUR UNIVERSEL, passer « À faire → En cours » détecte le démarrage réel — le chemin qui l’ignorait en V2.8.5.1', 'PE-23');
  ok(demande.nom === avant.nom && demande.statut === 'todo' && demande.start === avant.start
    && demande.undo === avant.undo && demande.hist === avant.hist,
    'PE-24 : avant confirmation, AUCUNE mutation — ni nom, ni statut, ni dates, ni snapshot, ni historique', 'PE-24');
  await shot(p, '08-editor-real-start-confirm.png');

  const apres = await ev(p, () => {
    runCalendarConfirm();
    const t = task('k-cloisons');
    return { nom: t.name, statut: t.status, start: t.start, end: t.end,
      duree: (date(t.end) - date(t.start)) / 3600000,
      baseline: [t.baselineStart, t.baselineEnd],
      now: localDateTime(getDemoNow()),
      undo: undoHistory.length, hist: app.history.length,
      entree: app.history[0] && { text: app.history[0].text, champs: (app.history[0].changes || []).map((c) => c.field) } };
  });
  note('PE-25', apres);
  ok(apres.start === apres.now && apres.statut === 'doing',
    `PE-25 : après confirmation, le début devient MAINTENANT (${apres.start}) et le statut « En cours »`, 'PE-25');
  ok(apres.duree === avant.duree && apres.end === '2026-08-17T18:30',
    `PE-26 : la durée planifiée est conservée — ${avant.duree} h avant, ${apres.duree} h après (fin ${apres.end})`, 'PE-26');
  ok(apres.nom === 'Nom B',
    'PE-27 : la modification du nom saisie dans le même formulaire est conservée', 'PE-27');
  ok(apres.undo === avant.undo + 1,
    `PE-27 : nom + statut + dates tiennent dans UNE SEULE transaction Undo (${avant.undo} → ${apres.undo})`, 'PE-27');
  ok(JSON.stringify(apres.baseline) === JSON.stringify(avant.baseline),
    `PE-31 : la baseline est inchangée (${apres.baseline.join(' → ')})`, 'PE-31');
  await shot(p, '09-editor-real-start-after.png');

  const ur = await ev(p, () => {
    undo();
    const t1 = task('k-cloisons');
    const a = { nom: t1.name, statut: t1.status, start: t1.start, end: t1.end, undo: undoHistory.length, redo: redoHistory.length };
    redo();
    const t2 = task('k-cloisons');
    return { a, b: { nom: t2.name, statut: t2.status, start: t2.start, end: t2.end } };
  });
  note('PE-27', ur);
  ok(ur.a.nom === avant.nom && ur.a.statut === avant.statut && ur.a.start === avant.start
    && ur.a.end === avant.end && ur.a.undo === avant.undo,
    'PE-27 : UN SEUL Undo restaure ENSEMBLE le nom, le statut et les dates — jamais trois annulations successives', 'PE-27');
  ok(ur.b.nom === 'Nom B' && ur.b.statut === 'doing' && ur.b.start === apres.start && ur.b.end === apres.end,
    'PE-28 : UN SEUL Redo rejoue toute la transaction', 'PE-28');
  await shot(p, '10-editor-real-start-undo.png');

  // PE-29 — annuler depuis l'éditeur
  await prepare();
  await p.waitForTimeout(200);
  await ev(p, () => openTaskEdit('k-cloisons', 'planning'));
  await p.waitForTimeout(250);
  const annule = await ev(p, () => {
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=name]').value = 'Jamais enregistré';
    f.querySelector('[name=status]').value = 'doing';
    submitTaskEdit();
    cancelCalendarConfirm();
    const t = task('k-cloisons');
    return { nom: t.name, statut: t.status, start: t.start, end: t.end,
      undo: undoHistory.length, hist: app.history.length,
      drawer: !!document.querySelector('#drawer.open'),
      champNom: document.querySelector('#taskEditForm [name=name]')?.value };
  });
  note('PE-29', annule);
  ok(annule.nom === avant.nom && annule.statut === 'todo' && annule.undo === avant.undo
    && annule.hist === avant.hist && annule.drawer && annule.champNom === 'Jamais enregistré',
    'PE-29 : « Annuler » n’a aucun effet, et le formulaire reste ouvert avec la saisie de l’utilisateur — rien n’est perdu', 'PE-29');
  await ev(p, () => closeOverlay('drawer'));

  // PE-30 — tolérance
  const tol = await ev(p, () => {
    resetApp();
    const t = task('k-cloisons');
    t.start = localDateTime(new Date(+getDemoNow() + 2 * 60000));
    t.end = add(t.start, 4 * 3600000); t.status = 'todo'; t.deps = [];
    save(); go('planning');
    const u0 = undoHistory.length;
    openTaskEdit('k-cloisons', 'planning');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=status]').value = 'doing';
    submitTaskEdit();
    const a = task('k-cloisons');
    return { modal: document.querySelector('#modal').classList.contains('open'),
      statut: a.status, start: a.start, undoDelta: undoHistory.length - u0,
      tolerance: REAL_START_TOLERANCE_MS / 60000 };
  });
  note('PE-30', tol);
  ok(!tol.modal && tol.statut === 'doing' && tol.undoDelta === 1,
    `PE-30 : un écart de 2 minutes (tolérance ${tol.tolerance} min) ne déclenche AUCUNE confirmation depuis l’éditeur`, 'PE-30');

  // PE-32 — une seule modale quand les deux sujets se présentent
  const fusion = await ev(p, () => {
    resetApp();
    const t = task('k-cloisons');
    /* La période réalignée part de MAINTENANT (lundi 14:30) : pour qu'elle
       touche aussi un jour non ouvré, c'est la DURÉE qui doit traverser le
       week-end. Prévue du 24 au 29 août (5 j 4 h), elle se repositionne donc
       du lundi 17 à 14:30 au samedi 22 à 18:30. */
    t.start = '2026-08-24T08:00'; t.end = '2026-08-29T12:00'; t.status = 'todo'; t.deps = [];
    save(); go('planning');
    openTaskEdit('k-cloisons', 'planning');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=status]').value = 'doing';
    submitTaskEdit();
    const m = { titre: document.querySelector('#modalContent h2')?.textContent,
      jours: [...document.querySelectorAll('.cal-warn-days li')].map((l) => l.textContent),
      intro: document.querySelector('.cal-warn-intro')?.textContent,
      modales: document.querySelectorAll('.modal.open').length,
      boutons: [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => x.textContent) };
    cancelCalendarConfirm(); closeOverlay('drawer');
    return m;
  });
  note('PE-32', fusion);
  ok(fusion.modales === 1 && fusion.boutons.length === 2 && fusion.jours.some((j) => /sam\. 22/.test(j))
    && /Démarrer cette tâche maintenant/.test(fusion.titre) && /jour non ouvré/i.test(fusion.intro || ''),
    'PE-32 : démarrage réel ET jour non ouvré tiennent dans UNE seule modale et UNE seule validation — jamais deux confirmations empilées', 'PE-32');
  await ctx.close();
}

// ============================================================
// PE-33 → PE-35 — Les trois autres chemins, même vérité
// ============================================================
console.log('\n[PE-CHEMINS] Kanban, fiche tâche et Mode Chantier');
{
  const { ctx, p } = await newPage({ tag: 'CHEMINS', now: '2026-08-17T14:30:00' });
  const scenario = (origine, extra = {}) => ev(p, ([o, ex]) => {
    resetApp();
    const t = task('k-cloisons');
    t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00'; t.status = 'todo'; t.deps = [];
    save();
    const u0 = undoHistory.length;
    setTaskStatus('k-cloisons', 'doing', o, ex);
    const pendant = { modal: document.querySelector('#modal').classList.contains('open'),
      statut: task('k-cloisons').status, undoDelta: undoHistory.length - u0 };
    runCalendarConfirm();
    const a = task('k-cloisons');
    return { pendant, apres: { statut: a.status, start: a.start, end: a.end,
      duree: (date(a.end) - date(a.start)) / 3600000, undoDelta: undoHistory.length - u0 } };
  }, [origine, extra]);

  const kb = await scenario('kanban');
  note('PE-33', kb);
  ok(kb.pendant.modal && kb.pendant.statut === 'todo' && kb.pendant.undoDelta === 0
    && kb.apres.statut === 'doing' && kb.apres.start === '2026-08-17T14:30' && kb.apres.duree === 4,
    'PE-33 : depuis le Kanban, la même confirmation, le même repositionnement, la même durée conservée', 'PE-33');

  const fiche = await scenario('task', { manual: true });
  note('PE-34', fiche);
  ok(fiche.pendant.modal && fiche.apres.start === '2026-08-17T14:30' && fiche.apres.duree === 4,
    'PE-34 : depuis la fiche tâche, comportement identique', 'PE-34');

  const terrain = await scenario('field');
  note('PE-35', terrain);
  ok(terrain.pendant.modal && terrain.apres.start === '2026-08-17T14:30' && terrain.apres.duree === 4,
    'PE-35 : depuis le Mode Chantier, comportement identique — les QUATRE chemins partagent la même vérité métier', 'PE-35');
  await ctx.close();
}

// ============================================================
// PE-36 → PE-39 — Aucun moteur parallèle
// ============================================================
console.log('\n[PE-MOTEURS] Un seul moteur par sujet');
{
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  const compte = (re) => (src.match(re) || []).length;
  const moteurs = {
    setTaskStatus: compte(/function setTaskStatus\(/g),
    gantt: compte(/function gantt\(/g),
    deplacement: {
      requestTaskScheduleMove: compte(/function requestTaskScheduleMove\(/g),
      requestGanttTaskMove: compte(/function requestGanttTaskMove\(/g),
      dropTask: compte(/function dropTask\(/g),
      planReflow: compte(/function planReflow\(/g),
      applyReflowPlan: compte(/function applyReflowPlan\(/g),
    },
    creation: {
      openTaskForm: compte(/function openTaskForm\(/g),
      planningCreatePointerDown: compte(/function planningCreatePointerDown\(/g),
      planningXToDate: compte(/function planningXToDate\(/g),
    },
    realStartPlan: compte(/function realStartPlan\(/g),
    calendarConfirm: compte(/function calendarConfirm\(/g),
    // Aucun moteur inventé pour l'occasion.
    inventes: /function\s+(ganttEssential|essentialGantt|simpleDrag|planningDragEngine|createTaskEngine|startTaskEngine|editorStatusEngine)\s*\(/.test(src),
    // Le niveau ne garde plus l'édition.
    niveauHorsEdition: !/canDrag = advanced/.test(src) && !/!ctx\.advanced/.test(src),
    canEditPlanning: /canEditPlanning = !readOnly/.test(src),
  };
  note('PE-36', moteurs);
  ok(moteurs.setTaskStatus === 1 && !moteurs.inventes,
    'PE-36 : il n’existe qu’UN setTaskStatus, et aucun moteur de statut parallèle', 'PE-36');
  ok(moteurs.gantt === 1,
    'PE-37 : il n’existe qu’UN gantt() — l’Opération et le Planning global partagent le même', 'PE-37');
  ok(Object.values(moteurs.deplacement).every((n) => n === 1),
    'PE-38 : un seul moteur de déplacement — dropTask → requestGanttTaskMove → requestTaskScheduleMove → planReflow/applyReflowPlan', 'PE-38');
  ok(Object.values(moteurs.creation).every((n) => n === 1) && moteurs.realStartPlan === 1 && moteurs.calendarConfirm === 1,
    'PE-39 : un seul moteur de création, un seul calcul de démarrage réel, un seul composant de confirmation', 'PE-39');
  ok(moteurs.niveauHorsEdition && moteurs.canEditPlanning,
    'PE-39 : le niveau Essentiel/Pilotage n’apparaît plus comme garde d’édition — c’est canEditPlanning qui décide', 'PE-39');
}

// ============================================================
// FREEZE-2852 — Byte-identité et périmètre
// ============================================================
console.log('\n[FREEZE-2852] Byte-identité');
{
  const read = (f) => fs.readFileSync(BASE + f, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  /* Extraction PARENTHÉSÉE : on saute la liste de paramètres avant de chercher
     l'accolade du corps — sinon `opts = {}` fait couper sur la signature. */
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
  const A = read(PREV), B = read(CUR);
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
         · openTaskForm             — §21 : le champ « Structure / zone » entre
                                      Chantier et Lot, et la lecture prudente du
                                      niveau à la soumission (jamais d'orphelin)
         · renderPlanning           — §18 : le filtre de niveau dans la barre
                                      d'outils, à côté du filtre de lot
         · planningCreateRow        — §22 : la ligne de création porte le niveau
                                      du contexte (data-create-structure)
       Tous les autres moteurs de ces listes restent vérifiés byte à byte, et le
       diff de ces trois fonctions a été relu ligne à ligne : il ne contient QUE
       la structure. */
  const geles = [
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'actionToast', 'historyToast', 'historyControls', 'refreshHistoryControls',
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget', 'save',
    'applyStorageSync', 'resetApp', 'planReflow', 'applyReflowPlan',
    'planScheduleChanges', 'nextWorkingTime', 'addWorkingDuration', 'dropTask',
    'dragStart', 'dragOver', 'requestGanttTaskMove', 'requestTaskScheduleMove',
    'drawDeps', 'effectiveTasks', 'pos', 'scale',
    'taskColorClass', 'taskEffectiveColorKey', 'lotChip', 'getProjectHealth',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'reconcileAfterTaskStatusChange', 'createRework', 'milestoneStatus',
    'isUpcomingMilestone', 'operationMilestonesTab', 'operationActiveProjectIds',
    'operationPlanningTab', 'operationMacroPlanning', 'getResourceTasks',
    'getResourceSchedulingConflicts', 'taskResourceIds', 'buildKanvixBackup',
    'confirmKanvixRestore', 'exportKanvixData', 'analyzeKanvixImport',
    'buildImportPlan', 'renderField', 'setTaskStatus',
    'easterSunday', 'frenchPublicHolidays', 'isWeekendDate', 'publicHolidayName',
    'isNonWorkingDate', 'nonWorkingDaysInRange', 'taskTouchesNonWorkingDay',
    'calendarConfirm', 'runCalendarConfirm', 'cancelCalendarConfirm',
    'askNonWorkingConfirm', 'realStartPlan', 'askRealStartConfirm',
    'planningColumnFlags', 'planningColumnClass', 'planningPeriodLabel',
    'planningXToDate', 'planningCreateRange', 'planningCreatePointerDown',
    'planningCreatePointerMove',
    'shiftPlanning', 'planningToday',
  ];
  /* V2.12.0 — RE-BASELINE, une seule cause NOMMÉE. « Conditions de démarrage »
     (§12, §14, §16, §20, §23, §30) étend un petit nombre de moteurs centraux —
     et les étend PLUTÔT QUE de les dupliquer, ce qui est précisément la règle
     que ces gels protègent. Les fonctions ci-dessous quittent donc le gel,
     déclarées et assumées ; elles sont vérifiées ligne à ligne par
     `recette-conditions-demarrage-v2.12.0.mjs` (FREEZE-2120), qui les nomme
     une à une. TOUT LE RESTE reste gelé byte à byte ici : rien n'est relâché. */
  const rebaseV2120 = ['exportKanvixData', 'setTaskStatus'];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    if (rebaseV2120.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2852', { comparées: compares, bougés: bouges, reBaséesV2120: rebaseV2120 });
  ok(bouges.length === 0,
    `FREEZE-2852 : les ${compares} moteurs de V2.8.5.1 sont BYTE-IDENTIQUES — tout le calendrier des jours non ouvrés, le démarrage réel, la propagation, le déplacement, la création à la souris, la Qualité, les Ressources, les Jalons, le Backup et le Mode Chantier`, 'FREEZE-2852');

  const modifiees = ['gantt', 'planningCanDrawCreate', 'submitTaskEdit', 'closeOverlay']
    .filter((n) => extractFn(A, n) && md5(extractFn(A, n)) !== md5(extractFn(B, n)));
  const ajoutees = ['clearTaskEditAck'].filter((n) => extractFn(B, n));
  note('FREEZE-2852-périmètre', { modifiées: modifiees, ajoutées: ajoutees });
  ok(modifiees.length === 4 && ajoutees.length === 1,
    `FREEZE-2852 : exactement quatre fonctions modifiées (${modifiees.join(', ')}) et une ajoutée (${ajoutees.join(', ')}) — le périmètre annoncé`, 'FREEZE-2852');

  const store = {
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
  };
  note('FREEZE-2852-store', store);
  /* V2.9.0 — RE-BASELINE. La clé de stockage reste la SEULE valeur figée : la
     changer perdrait les données des utilisateurs. SCHEMA_VERSION, lui, a le
     droit d'avancer (12 → 13 pour la structure), jamais de reculer — c'est ce
     que cette assertion vérifie désormais, avec la même sévérité. */
  ok(store.store === 'kanvix-product-8-3' && Number(store.schemaApres) >= Number(store.schemaAvant) && Number(store.schemaAvant) >= 12,
    `FREEZE-2852 : STORE (« ${store.store} ») strictement inchangé et SCHEMA_VERSION jamais régressif (${store.schemaAvant} → ${store.schemaApres})`, 'FREEZE-2852');
}

// ============================================================
// Captures — niveaux, thèmes, largeurs
// ============================================================
console.log('\n[CAPTURES] Essentiel et Pilotage, clair et sombre, dix largeurs');
{
  const LARGEURS = [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390];
  const debords = [];
  for (const w of LARGEURS) {
    for (const [niveau, court] of [['essential', 'E'], ['pilot', 'P']]) {
      for (const [theme, tc] of [[false, 'clair'], [true, 'sombre']]) {
        const { ctx, p } = await newPage({ w, h: Math.max(900, Math.round(w * 0.62)), tag: `W${w}${court}`, level: niveau, dark: theme });
        await planning(p, 'week');
        const mes = await ev(p, () => ({
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          lignes: document.querySelectorAll('.g-create-row').length,
          barres: document.querySelectorAll('.g-bar[draggable="true"]').length,
          gantt: document.querySelectorAll('#gantt').length,
        }));
        debords.push({ w, niveau, theme: tc, ...mes });
        await shot(p, `w${w}-${court}-${tc}.png`);
        await ctx.close();
      }
    }
  }
  // Opération, les deux niveaux.
  for (const niveau of ['essential', 'pilot']) {
    const { ctx, p } = await newPage({ tag: 'OPCAP-' + niveau, level: niveau });
    await ev(p, () => { const o = app.operations[0]; selectOperation(o.id); setOperationTab('Planning'); app.settings.period = 'week'; save(); renderPage(); });
    await p.waitForTimeout(350);
    const mes = await ev(p, () => ({ lignes: document.querySelectorAll('.g-create-row').length,
      barres: document.querySelectorAll('.g-bar[draggable="true"]').length }));
    debords.push({ w: 1600, niveau, theme: 'opération', over: 0, ...mes });
    await shot(p, `operation-${niveau}.png`);
    await ctx.close();
  }
  note('CAPTURES', debords);
  ok(debords.every((d) => d.over <= 0),
    `CAPTURES : aucune des dix largeurs × deux niveaux × deux thèmes ne produit de débordement horizontal`, 'CAPTURES');
  // Le Gantt desktop porte l'édition dans les deux niveaux ; le mobile garde son agenda.
  const desktop = debords.filter((d) => d.w >= 768 && d.theme !== 'opération');
  ok(desktop.every((d) => d.lignes > 0 && d.barres > 0),
    `CAPTURES : de 768 à 1920 px, l’édition est présente dans les DEUX niveaux (${desktop.length} combinaisons vérifiées)`, 'CAPTURES');
  const op = debords.filter((d) => d.theme === 'opération');
  ok(op.every((d) => d.barres > 0),
    'CAPTURES : le Planning d’Opération porte l’édition dans les deux niveaux', 'CAPTURES');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `PE-40 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'PE-40');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
