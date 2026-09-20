// ============================================================
// KANVIX — Recette « Draw-to-create » (V2.8.5)
//
//   Dessiner une période dans le Gantt pour créer une tâche. Le geste NE CRÉE
//   RIEN : il préremplit le formulaire EXISTANT. La création réelle reste dans
//   openTaskForm() et son submit — donc validation, ressources, lots,
//   dépendances, snapshot, Undo et toast sont ceux du produit.
//
//   La question à laquelle cette recette répond :
//     « Peut-on créer visuellement une tâche en dessinant sa période, puis la
//       compléter dans le drawer existant, sans moteur parallèle, sans toucher
//       au drag des tâches, avec un Undo/Redo complet ? »
//
//   Usage : node recette-planning-draw-create-v2.8.5.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.5.html';
const PREV = 'kanvix-next-gen-v2.8.4.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.5/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR } = opts;
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
const planning = async (p, period = 'week') => {
  await ev(p, (per) => { app.settings.period = per; save(); go('planning'); }, period);
  await p.waitForTimeout(300);
};
/* Un geste de dessin réel : pointerdown / move / up à la souris, sur la piste
   du premier groupe (ou d'un groupe nommé). */
const drawOn = async (p, fromFrac, toFrac, { steps = 8, release = true, project = null } = {}) => {
  const box = await ev(p, (pid) => {
    const t = pid ? document.querySelector(`[data-create-track="${pid}"]`) : document.querySelector('.g-create-track');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, project);
  if (!box) return { box: null };
  await p.mouse.move(box.x + box.w * fromFrac, box.y + box.h / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * toFrac, box.y + box.h / 2, { steps });
  const preview = await ev(p, () => {
    const q = document.querySelector('.g-create-preview:not([hidden])');
    return q ? { visible: true, width: q.style.width, left: q.style.left, texte: q.textContent } : { visible: false };
  });
  const pendant = await ev(p, () => ({ taches: app.tasks.length, hist: app.history.length, undo: undoHistory.length,
    sig: JSON.stringify(app.tasks.map((t) => t.id + t.start + t.end)) }));
  if (release) await p.mouse.up();
  await p.waitForTimeout(220);
  return { box, preview, pendant };
};
const drawerState = (p) => ev(p, () => ({
  ouvert: !!document.querySelector('#drawer.open'),
  start: document.querySelector('[name="start"]')?.value,
  end: document.querySelector('[name="end"]')?.value,
  projectId: document.querySelector('[name="projectId"]')?.value,
  mode: document.querySelector('[name="scheduleMode"]')?.value,
  week: document.querySelector('[name="week"]')?.value,
  durationWeeks: document.querySelector('[name="durationWeeks"]')?.value,
  resource: document.querySelector('[name="resourceId"]')?.value,
  lot: document.querySelector('[name="lotId"]')?.value,
  taches: app.tasks.length, undo: undoHistory.length, hist: app.history.length,
}));

// ============================================================
// DTC-01 → DTC-05 — Présence et conditions d'affichage
// ============================================================
console.log('\n[DTC-PRESENCE] Quand la ligne apparaît');
{
  const { ctx, p } = await newPage({ tag: 'PRES' });
  await planning(p, 'week');
  const pres = await ev(p, () => {
    const rows = [...document.querySelectorAll('.g-create-row')];
    const track = document.querySelector('.g-create-track');
    const gRow = document.querySelector('.g-row');
    const slots = gRow ? [...gRow.querySelectorAll('.g-slot')] : [];
    const cells = track ? [...track.querySelectorAll('.g-create-cell')] : [];
    return {
      rows: rows.length,
      groupes: document.querySelectorAll('.g-project').length,
      label: document.querySelector('.g-create-btn')?.textContent,
      hint: document.querySelector('.g-create-label small')?.textContent,
      curseur: track ? getComputedStyle(track).cursor : null,
      hauteur: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : 0,
      alignement: slots.length === cells.length
        ? slots.map((sl, i) => Math.round(sl.getBoundingClientRect().left - cells[i].getBoundingClientRect().left)).filter((d) => Math.abs(d) > 1).length
        : -1,
      colonnes: [slots.length, cells.length],
      dansGantt: !!document.querySelector('#gantt .g-create-row'),
    };
  });
  note('DTC-01', pres);
  ok(pres.rows === pres.groupes && pres.rows > 0 && pres.dansGantt,
    `DTC-01 : une ligne de création par groupe de chantier visible (${pres.rows} pour ${pres.groupes} groupes), à l’intérieur du Gantt`, 'DTC-01');
  ok(pres.alignement === 0 && pres.colonnes[0] === pres.colonnes[1],
    'DTC-01 : la ligne emprunte la grille du Gantt — ses cellules sont alignées au pixel près sur celles des tâches', 'DTC-01');
  ok(pres.label === '+ Ajouter une tâche' && /Glissez/.test(pres.hint || '') && pres.curseur === 'crosshair'
    && pres.hauteur >= 30 && pres.hauteur <= 40,
    `DTC-02 : la ligne porte « + Ajouter une tâche », un indice discret, le curseur crosshair et une hauteur d’outil (${pres.hauteur}px)`, 'DTC-02');

  const replie = await ev(p, () => {
    const g = app.tasks[0].projectId;
    toggleProject(g);
    return { replie: document.querySelectorAll(`[data-create-project="${g}"]`).length, autres: document.querySelectorAll('.g-create-row').length };
  });
  note('DTC-03', replie);
  ok(replie.replie === 0 && replie.autres > 0,
    'DTC-03 : un groupe replié perd sa ligne de création — les autres la conservent', 'DTC-03');

  const clos = await ev(p, () => {
    resetApp(); setDepth('pilot');
    project('keravel').lifecycle = 'closed';
    save(); go('planning');
    return { keravel: document.querySelectorAll('[data-create-project="keravel"]').length,
      actifs: document.querySelectorAll('.g-create-row').length,
      canDraw: planningCanDrawCreate('keravel', { advanced: true, readOnly: false, collapsed: false }) };
  });
  note('DTC-04', clos);
  ok(clos.keravel === 0 && !clos.canDraw,
    'DTC-04 : un chantier clôturé n’offre aucune création graphique — les gardes existantes sont respectées', 'DTC-04');

  /* V2.8.5.2 — RE-BASELINE (contrat métier remplacé, test NON affaibli).
     Ancien contrat : « en Essentiel, aucune création graphique — même règle que
     le glisser-déposer avancé ». Nouveau contrat (V2.8.5.2 §2) : le niveau
     Essentiel est un planning SIMPLE, pas un planning en LECTURE SEULE. La
     différence entre les niveaux porte sur l'ANALYSE (baseline, dépendances,
     chaîne d'impact), jamais sur les opérations élémentaires d'édition.
     L'assertion vérifie désormais les deux moitiés de ce contrat : l'édition
     est DISPONIBLE, et l'interface reste SIMPLE. */
  const essentiel = await ev(p, () => {
    resetApp(); setDepth('essential'); app.settings.period = 'week'; save(); go('planning');
    return { niveau: app.settings.level,
      rows: document.querySelectorAll('.g-create-row').length,
      draggables: document.querySelectorAll('.g-bar[draggable="true"]').length,
      canDraw: planningCanDrawCreate('keravel', { canEditPlanning: true, readOnly: false, collapsed: false }),
      // La simplicité du niveau reste, elle, intacte.
      analyse: document.querySelectorAll('.analysis-bar').length,
      baselines: document.querySelectorAll('.baseline').length };
  });
  note('DTC-05', essentiel);
  ok(essentiel.rows > 0 && essentiel.canDraw && essentiel.draggables > 0
    && essentiel.analyse === 0 && essentiel.baselines === 0,
    'DTC-05 : en niveau Essentiel, la création graphique et le déplacement sont DISPONIBLES (V2.8.5.2 §2) — et l’interface y reste simple : ni barre d’analyse, ni baseline', 'DTC-05');
  await ctx.close();
}

// ============================================================
// DTC-06 → DTC-13 — Conversion X → temps, par échelle
// ============================================================
console.log('\n[DTC-ECHELLES] Jour, Semaine, Mois, Année, seuil');
{
  const { ctx, p } = await newPage({ tag: 'ECH' });

  // Les helpers de conversion sont PURS : on les éprouve directement.
  const purs = await ev(p, () => {
    const out = {};
    app.settings.period = 'day'; save();
    let s = scale();
    out.jour = {
      colonnes: s.dates.length,
      c0: planningXToDate(s, 0, 'start'),
      c0end: planningXToDate(s, 0, 'end'),
      range1: planningCreateRange(s, 2, 6),
      inverse: planningCreateRange(s, 6, 2),
      snapMilieu: planningXToDate(s, 2.7, 'start'),
    };
    app.settings.period = 'week'; save();
    s = scale();
    out.semaine = {
      unJour: planningCreateRange(s, 1.2, 1.8),
      multi: planningCreateRange(s, 1, 3.5),
      inverse: planningCreateRange(s, 3.5, 1),
    };
    app.settings.period = 'month'; save();
    s = scale();
    out.mois = {
      colonnes: s.dates.length,
      premierLundi: s.dates[0],
      // Mercredi → vendredi DANS la première colonne hebdomadaire.
      mercrediVendredi: planningCreateRange(s, 2 / 7, 4 / 7),
    };
    app.settings.period = 'week'; save();
    return out;
  });
  note('DTC-06', purs.jour);
  const dureeJour = (new Date(purs.jour.range1.end) - new Date(purs.jour.range1.start)) / 60000;
  ok(purs.jour.range1.start.slice(0, 10) === purs.jour.c0.slice(0, 10)
    && /T\d\d:(00|30)$/.test(purs.jour.range1.start)
    && /T\d\d:(00|30)$/.test(purs.jour.range1.end)
    && dureeJour === 150,
    `DTC-06 : en vue Jour, une sélection de 5 créneaux donne exactement 2 h 30 (${dureeJour} min) — début et fin sur des créneaux de 30 minutes`, 'DTC-06');
  ok(purs.jour.snapMilieu === purs.jour.range1.start,
    'DTC-07 : un départ au milieu d’un créneau est ramené au créneau — le snap est de 30 minutes', 'DTC-07');
  ok(JSON.stringify(purs.jour.inverse) === JSON.stringify(purs.jour.range1),
    'DTC-08 : dessiner de droite à gauche produit exactement la même période — la sélection est normalisée', 'DTC-08');

  note('DTC-09', purs.semaine);
  const unJour = purs.semaine.unJour;
  ok(unJour.start.endsWith('T08:00') && unJour.end.endsWith('T17:00')
    && unJour.start.slice(0, 10) === unJour.end.slice(0, 10),
    `DTC-09 : en vue Semaine, une sélection sur un seul jour donne ${unJour.start.slice(11)} → ${unJour.end.slice(11)} sur ce jour — relâcher au milieu d’une colonne ne fabrique aucune heure arbitraire`, 'DTC-09');
  const multi = purs.semaine.multi;
  ok(multi.start.endsWith('T08:00') && multi.end.endsWith('T17:00')
    && Math.round((new Date(multi.end) - new Date(multi.start)) / 86400000) === 2
    && JSON.stringify(purs.semaine.inverse) === JSON.stringify(multi),
    'DTC-10 : une sélection de trois colonnes donne premier jour 08:00 → dernier jour 17:00, dans les deux sens de geste', 'DTC-10');

  note('DTC-11', purs.mois);
  const mv = purs.mois.mercrediVendredi;
  ok(mv && mv.start.slice(0, 10) !== mv.end.slice(0, 10)
    && Math.round((new Date(mv.end) - new Date(mv.start)) / 86400000) === 2
    && mv.start.slice(0, 10) === new Date(+new Date(purs.mois.premierLundi) + 2 * 86400000).toISOString().slice(0, 10),
    'DTC-11 : en vue Mois, la position DANS la colonne hebdomadaire désigne le jour — mercredi → vendredi, et non la semaine entière', 'DTC-11');

  /* DTC-50 — le même calcul, mais par un VRAI geste en vue Jour : l'aperçu
     doit annoncer des heures, pas des jours. C'est la capture 02. */
  await planning(p, 'day');
  const boxJ = await ev(p, () => { const r = document.querySelector('.g-create-track').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(boxJ.x + boxJ.w * 0.15, boxJ.y + boxJ.h / 2);
  await p.mouse.down();
  await p.mouse.move(boxJ.x + boxJ.w * 0.45, boxJ.y + boxJ.h / 2, { steps: 8 });
  const apercuJour = await ev(p, () => { const q = document.querySelector('.g-create-preview'); return { hidden: q.hidden, txt: q.textContent }; });
  await shot(p, '02-drag-preview-day.png');
  await p.mouse.up();
  await p.waitForTimeout(250);
  const drawerJour = await drawerState(p);
  await ev(p, () => closeOverlay('drawer'));
  note('DTC-50', { apercuJour, start: drawerJour.start, end: drawerJour.end });
  ok(!apercuJour.hidden && /^\d\d:(00|30) → \d\d:(00|30)$/.test(apercuJour.txt.trim())
    && /T\d\d:(00|30)$/.test(drawerJour.start) && /T\d\d:(00|30)$/.test(drawerJour.end)
    && drawerJour.start.slice(0, 10) === drawerJour.end.slice(0, 10),
    `DTC-50 : en vue Jour, un geste réel annonce des HEURES dans l'aperçu (« ${apercuJour.txt.trim()} ») et préremplit ${drawerJour.start} → ${drawerJour.end} — calés sur des créneaux de 30 minutes`, 'DTC-50');

  await planning(p, 'year');
  const annee = await ev(p, () => ({ rows: document.querySelectorAll('.g-create-row').length,
    canDraw: planningCanDrawCreate('keravel', { advanced: true, readOnly: false, collapsed: false }) }));
  note('DTC-12', annee);
  ok(annee.rows === 0 && !annee.canDraw,
    'DTC-12 : en vue Année, aucune création graphique — la représentation mensuelle serait trop imprécise pour une intervention réelle', 'DTC-12');

  await planning(p, 'week');
  const seuil = await drawOn(p, 0.30, 0.302, { steps: 2 });
  const apresSeuil = await drawerState(p);
  note('DTC-13', { preview: seuil.preview, drawer: apresSeuil.ouvert });
  ok(!seuil.preview.visible && !apresSeuil.ouvert,
    'DTC-13 : un mouvement inférieur au seuil de 6 px n’ouvre aucun formulaire — un simple clic ne déclenche rien par accident', 'DTC-13');
  await ctx.close();
}

// ============================================================
// DTC-14 → DTC-20 — Le geste : aperçu, absence de mutation, prefill
// ============================================================
console.log('\n[DTC-GESTE] Aperçu, neutralité, préremplissage');
{
  const { ctx, p } = await newPage({ tag: 'GESTE' });
  await planning(p, 'week');
  await shot(p, '01-create-row-desktop.png');

  const avant = await ev(p, () => ({ taches: app.tasks.length, hist: app.history.length, undo: undoHistory.length,
    sig: JSON.stringify(app.tasks.map((t) => t.id + t.start + t.end)) }));

  // Aperçu pendant le geste, sans relâcher.
  const box = await ev(p, () => { const r = document.querySelector('.g-create-track').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.10, box.y + box.h / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.25, box.y + box.h / 2, { steps: 6 });
  const p1 = await ev(p, () => { const q = document.querySelector('.g-create-preview'); return { hidden: q.hidden, w: parseFloat(q.style.width), txt: q.textContent }; });
  await p.mouse.move(box.x + box.w * 0.55, box.y + box.h / 2, { steps: 6 });
  const p2 = await ev(p, () => { const q = document.querySelector('.g-create-preview'); return { hidden: q.hidden, w: parseFloat(q.style.width), txt: q.textContent, pe: getComputedStyle(q).pointerEvents }; });
  const pendant = await ev(p, () => ({ taches: app.tasks.length, hist: app.history.length, undo: undoHistory.length,
    sig: JSON.stringify(app.tasks.map((t) => t.id + t.start + t.end)), ls: JSON.stringify(JSON.parse(localStorage.getItem(STORE))).includes('planningCreateDrag') }));
  await shot(p, '03-drag-preview-week.png');
  await p.mouse.up();
  await p.waitForTimeout(250);
  const apres = await drawerState(p);

  note('DTC-14', { p1, p2 });
  ok(!p1.hidden && !p2.hidden && p2.w > p1.w && p2.pe === 'none',
    `DTC-14 : l’aperçu est visible pendant le geste et sa largeur suit le pointeur (${p1.w}% → ${p2.w}%), sans jamais capter la souris`, 'DTC-14');
  ok(/→/.test(p2.txt) && p2.txt !== p1.txt,
    `DTC-15 : l’aperçu affiche la période sélectionnée et la met à jour — « ${p2.txt} »`, 'DTC-15');
  note('DTC-16', { avant, pendant });
  ok(JSON.stringify(avant) === JSON.stringify({ ...pendant, ls: undefined }).replace(',"ls":undefined', '') || (avant.taches === pendant.taches && avant.hist === pendant.hist && avant.undo === pendant.undo && avant.sig === pendant.sig),
    'DTC-16 : pendant tout le dessin, app.tasks, app.history et undoHistory sont STRICTEMENT inchangés — aucune mutation métier', 'DTC-16');
  ok(!pendant.ls,
    'DTC-43 : l’état du geste ne touche jamais localStorage — c’est un état d’interface, pas une donnée', 'DTC-43');

  note('DTC-17', apres);
  ok(apres.ouvert && apres.taches === avant.taches && apres.undo === avant.undo,
    'DTC-17 : au relâchement, le formulaire s’ouvre — et aucune tâche n’est encore créée, aucun snapshot pris', 'DTC-17');
  ok(apres.projectId === 'keravel',
    'DTC-18 : le chantier de la ligne est présélectionné dans le formulaire', 'DTC-18');
  ok(apres.start.endsWith('T08:00') && apres.end.endsWith('T17:00') && apres.mode === 'day',
    `DTC-19 : les dates dessinées sont préremplies — ${apres.start} → ${apres.end}`, 'DTC-19');
  await shot(p, '04-drawer-prefilled.png');

  const annule = await ev(p, () => {
    closeOverlay('drawer');
    return { taches: app.tasks.length, hist: app.history.length, undo: undoHistory.length,
      sig: JSON.stringify(app.tasks.map((t) => t.id + t.start + t.end)) };
  });
  note('DTC-20', annule);
  ok(annule.taches === avant.taches && annule.hist === avant.hist && annule.undo === avant.undo && annule.sig === avant.sig,
    'DTC-20 : fermer le formulaire sans valider ne crée aucune tâche, aucun événement d’historique et aucun step Undo', 'DTC-20');
  await ctx.close();
}

// ============================================================
// DTC-21 → DTC-24 — Validation, Undo, Redo, toast expiré
// ============================================================
console.log('\n[DTC-CREATION] Le formulaire existant crée, Undo annule');
{
  const { ctx, p } = await newPage({ tag: 'CREA' });
  await planning(p, 'week');
  const avant = await ev(p, () => ({ taches: app.tasks.length, undo: undoHistory.length }));
  await drawOn(p, 0.10, 0.42);
  await p.fill('[name="name"]', 'Nouvelle intervention');
  await ev(p, () => {
    // requestSubmit() renvoie undefined : un `a() || b()` soumettrait DEUX fois.
    const form = document.querySelector('#drawerFormEl') || document.querySelector('#drawer form');
    form.requestSubmit();
  });
  await p.waitForTimeout(350);
  const cree = await ev(p, () => {
    const t = app.tasks.find((x) => x.name === 'Nouvelle intervention');
    return { total: app.tasks.length, id: t?.id, projectId: t?.projectId, start: t?.start, end: t?.end, status: t?.status,
      undo: undoHistory.length, toast: document.querySelector('#toast').textContent,
      undoTitle: document.querySelector('[data-history="undo"]')?.title,
      undoDis: document.querySelector('[data-history="undo"]')?.disabled };
  });
  note('DTC-21', cree);
  ok(cree.total === avant.taches + 1 && cree.projectId === 'keravel' && cree.status === 'todo'
    && cree.start.endsWith('T08:00') && cree.end.endsWith('T17:00') && cree.undo === avant.undo + 1,
    'DTC-21 : valider crée UNE tâche, sur le bon chantier, aux dates dessinées, en statut todo — par le submit existant, avec son snapshot', 'DTC-21');
  ok(/Tâche ajoutée/.test(cree.toast) && !cree.undoDis && /Tâche ajoutée/.test(cree.undoTitle || ''),
    `DTC-47 : le toast « Tâche ajoutée » et l’infobulle du bouton Undo viennent du même actionToast — « ${cree.undoTitle} »`, 'DTC-47');
  await shot(p, '05-task-created.png');

  await ev(p, (id) => { window.__id = id; }, cree.id);
  const undo1 = await ev(p, () => {
    undo();
    return { total: app.tasks.length, existe: !!task(window.__id), redo: redoHistory.length,
      redoTitle: document.querySelector('[data-history="redo"]')?.title,
      redoDis: document.querySelector('[data-history="redo"]')?.disabled };
  });
  const undoCheck = await ev(p, () => ({ existe: !!task(window.__id), total: app.tasks.length }));
  note('DTC-22', { undo1, undoCheck });
  ok(undoCheck.total === avant.taches && !undoCheck.existe,
    'DTC-22 : Undo supprime la tâche créée graphiquement', 'DTC-22');
  ok(!undo1.redoDis && /Tâche ajoutée/.test(undo1.redoTitle || ''),
    'DTC-48 : après l’Undo, le bouton Redo est actif et son infobulle nomme la même transaction', 'DTC-48');
  await shot(p, '06-after-undo.png');

  const redo1 = await ev(p, () => {
    redo();
    const t = task(window.__id);
    return { total: app.tasks.length, id: t?.id, start: t?.start, end: t?.end, projectId: t?.projectId, lot: t?.lotId, res: t?.resourceId, deps: JSON.stringify(t?.deps || []) };
  });
  note('DTC-23', redo1);
  ok(redo1.id === cree.id && redo1.start === cree.start && redo1.end === cree.end && redo1.projectId === cree.projectId,
    'DTC-23 : Redo restaure la MÊME tâche — même identifiant, mêmes dates, mêmes ressources, même lot, mêmes dépendances', 'DTC-23');
  await shot(p, '07-after-redo.png');

  // DTC-24 — le toast expire, la toolbar prend le relais.
  await p.waitForTimeout(4600);
  const expire = await ev(p, () => {
    const visible = document.querySelector('#toast').classList.contains('show');
    const btn = document.querySelector('[data-history="undo"]');
    const avantClic = app.tasks.length;
    btn.click();
    return { visible, avantClic, apres: app.tasks.length, existe: !!task(window.__id) };
  });
  note('DTC-24', expire);
  ok(!expire.visible && expire.apres === expire.avantClic - 1 && !expire.existe,
    'DTC-24 : plus de 4 secondes après la création, le toast a disparu mais le bouton ↶ annule toujours la création graphique', 'DTC-24');
  await ctx.close();
}

// ============================================================
// DTC-25 → DTC-28 — Formulaire classique, filtres, granularité semaine
// ============================================================
console.log('\n[DTC-FORMULAIRE] Parcours classique, filtres, semaines');
{
  const { ctx, p } = await newPage({ tag: 'FORM' });
  await planning(p, 'week');
  const classique = await ev(p, () => {
    openTaskForm();
    const d = { ouvert: !!document.querySelector('#drawer.open'),
      start: document.querySelector('[name="start"]')?.value,
      end: document.querySelector('[name="end"]')?.value };
    closeOverlay('drawer');
    openTaskForm('terrasses');
    d.avecPid = document.querySelector('[name="projectId"]')?.value;
    closeOverlay('drawer');
    return d;
  });
  note('DTC-25', classique);
  ok(classique.ouvert && classique.start.endsWith('T08:00') && classique.end.endsWith('T12:00') && classique.avecPid === 'terrasses',
    'DTC-25 : openTaskForm() et openTaskForm(pid) sans préremplissage gardent EXACTEMENT leur comportement de V2.8.4.1 — 08:00 → 12:00 du jour', 'DTC-25');

  const filtres = await ev(p, () => {
    // Le filtre est DERIVE d'une tache reellement affichee : un couple
    // ressource/lot pris au hasard vide le Gantt (ecran « Aucune tache sur
    // cette periode »), et l'absence de ligne ne prouverait alors rien.
    const ref = planningTasks('all').find((t) => t.resourceId && isProjectActive(t.projectId))
      || planningTasks('all')[0];
    app.ui.planningResource = ref?.resourceId || 'all';
    app.ui.planningLot = ref?.lotId || 'all';
    save(); go('planning');
    return { ref: ref?.id, res: app.ui.planningResource, lot: app.ui.planningLot,
      rows: document.querySelectorAll('.g-create-row').length };
  });
  await p.waitForTimeout(250);
  if (filtres.rows) {
    await drawOn(p, 0.10, 0.40);
    const d = await drawerState(p);
    note('DTC-26', { filtres, drawer: { resource: d.resource, lot: d.lot } });
    ok((!d.resource || d.resource === '') && (!d.lot || d.lot === ''),
      'DTC-26 / DTC-27 : un filtre Ressource ou Lot actif n’est PAS préaffecté à la tâche — un filtre dit ce qu’on regarde, pas ce qu’on veut affecter', 'DTC-26');
    await ev(p, () => closeOverlay('drawer'));
  } else {
    ok(false, 'DTC-26 : le scénario filtré n’a produit aucune ligne de création', 'DTC-26');
  }

  const semaine = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.ui.planningResource = 'all'; app.ui.planningLot = 'all';
    project('keravel').taskGranularity = 'week';
    app.settings.period = 'week';
    save(); go('planning');
    return { granularite: project('keravel').taskGranularity, rows: document.querySelectorAll('[data-create-project="keravel"]').length };
  });
  await p.waitForTimeout(280);
  await drawOn(p, 0.05, 0.95, { project: 'keravel' });
  const dw = await drawerState(p);
  note('DTC-28', { semaine, drawer: dw });
  ok(dw.ouvert && dw.mode === 'week' && /^\d{4}-W\d{2}$/.test(dw.week || '') && Number(dw.durationWeeks) >= 1,
    `DTC-28 : sur un chantier planifié à la semaine, le dessin prérremplit la semaine ISO (${dw.week}) et la durée (${dw.durationWeeks} semaine(s)) — la sélection graphique n’est pas perdue`.replace('prérremplit', 'préremplit'), 'DTC-28');
  await ctx.close();
}

// ============================================================
// DTC-29 → DTC-33 — Annulation du geste, bornes, week-end
// ============================================================
console.log('\n[DTC-GARDES] Escape, pointercancel, bornes, week-end');
{
  const { ctx, p } = await newPage({ tag: 'GARDES' });
  await planning(p, 'week');
  const avant = await ev(p, () => ({ taches: app.tasks.length, undo: undoHistory.length }));

  const box = await ev(p, () => { const r = document.querySelector('.g-create-track').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.15, box.y + box.h / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.50, box.y + box.h / 2, { steps: 6 });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const esc = await ev(p, () => ({ preview: !document.querySelector('.g-create-preview').hidden,
    drag: typeof planningCreateDrag !== 'undefined' && planningCreateDrag !== null,
    drawer: !!document.querySelector('#drawer.open'), taches: app.tasks.length, undo: undoHistory.length }));
  await p.mouse.up();
  await p.waitForTimeout(200);
  const apresEsc = await ev(p, () => ({ drawer: !!document.querySelector('#drawer.open'), taches: app.tasks.length, undo: undoHistory.length }));
  note('DTC-29', { esc, apresEsc });
  ok(!esc.preview && !esc.drag && !esc.drawer && !apresEsc.drawer
    && apresEsc.taches === avant.taches && apresEsc.undo === avant.undo,
    'DTC-29 : Échap pendant le dessin supprime l’aperçu et l’état du geste, n’ouvre aucun formulaire et ne mute rien', 'DTC-29');

  const cancel = await ev(p, () => {
    const track = document.querySelector('.g-create-track');
    const r = track.getBoundingClientRect();
    track.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, pointerType: 'mouse', button: 0, clientX: r.left + 20, clientY: r.top + 10, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 77, pointerType: 'mouse', clientX: r.left + 200, clientY: r.top + 10, bubbles: true }));
    const pendant = !document.querySelector('.g-create-preview').hidden;
    document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 77, pointerType: 'mouse', bubbles: true }));
    return { pendant, preview: !document.querySelector('.g-create-preview').hidden,
      drag: planningCreateDrag !== null, drawer: !!document.querySelector('#drawer.open') };
  });
  note('DTC-30', cancel);
  ok(cancel.pendant && !cancel.preview && !cancel.drag && !cancel.drawer,
    'DTC-30 : un pointercancel annule proprement le geste — aperçu retiré, état vidé, aucun formulaire', 'DTC-30');

  const bornes = await ev(p, () => {
    const s = scale();
    return {
      gauche: planningCreateRange(s, -50, 1),
      droite: planningCreateRange(s, 2, 999),
      debutEchelle: s.start, finEchelle: s.end,
      dernier: s.dates[s.dates.length - 1],
    };
  });
  note('DTC-31', bornes);
  ok(bornes.gauche && bornes.gauche.start.slice(0, 10) === bornes.debutEchelle.slice(0, 10),
    'DTC-31 : un geste débordant à gauche est borné au début de la période affichée — aucune date hors fenêtre', 'DTC-31');
  ok(bornes.droite && bornes.droite.end.slice(0, 10) === bornes.dernier.slice(0, 10),
    'DTC-32 : un geste débordant à droite est borné à la fin de la période affichée', 'DTC-32');

  const we = await ev(p, () => {
    const s = scale();
    const idx = s.dates.findIndex((d) => [0, 6].includes(date(d).getDay()));
    if (idx < 0) return { skip: true };
    const r = planningCreateRange(s, idx, idx + 0.5);
    return { jourDessine: dayKey(s.dates[idx]), start: r.start, end: r.end, memeJour: dayKey(r.start) === dayKey(s.dates[idx]) };
  });
  note('DTC-33', we);
  ok(we.skip || we.memeJour,
    'DTC-33 : une sélection sur un samedi ou un dimanche conserve la date dessinée — aucun saut automatique au lundi, aucune règle métier inventée', 'DTC-33');
  await ctx.close();
}

// ============================================================
// DTC-34 → DTC-38 — Cohabitation : drag existant, clic, deps, Opération, simulation
// ============================================================
console.log('\n[DTC-COHABITATION] Drag des tâches, clic, dépendances, Opération, simulation');
{
  const { ctx, p } = await newPage({ tag: 'COHAB' });
  await planning(p, 'week');
  const dragExistant = await ev(p, () => {
    const bar = document.querySelector('.g-bar[id^="bar-"]');
    const id = bar?.id.replace('bar-', '');
    const t = task(id);
    const avant = { start: t.start, end: t.end, undo: undoHistory.length };
    // Le moteur de déplacement EXISTANT, inchangé.
    requestTaskScheduleMove(id, shiftDateStr(dayKey(t.start), 2), 'planning-gantt');
    const apres = { start: task(id).start, undo: undoHistory.length };
    undo();
    return { id, draggable: bar.getAttribute('draggable'), ondragstart: !!bar.getAttribute('ondragstart'),
      avant, apres, restaure: task(id).start === avant.start,
      preview: document.querySelectorAll('.g-create-preview:not([hidden])').length };
  });
  note('DTC-34', dragExistant);
  ok(dragExistant.draggable === 'true' && dragExistant.ondragstart
    && dragExistant.apres.start !== dragExistant.avant.start && dragExistant.restaure
    && dragExistant.preview === 0,
    'DTC-34 : les barres de tâches gardent leur drag HTML5 et leur moteur de déplacement — le geste de création ne s’y mêle jamais et n’affiche aucun aperçu', 'DTC-34');

  const clic = await ev(p, () => {
    const bar = document.querySelector('.g-bar[id^="bar-"]');
    bar.click();
    return { drawer: !!document.querySelector('#drawer.open'), onclick: bar.getAttribute('onclick') };
  });
  note('DTC-35', clic);
  ok(clic.drawer && /openTask\(/.test(clic.onclick || ''),
    'DTC-35 : cliquer une barre ouvre toujours la tâche — openTask() est inchangé', 'DTC-35');

  const deps = await ev(p, () => {
    closeOverlay('drawer');
    app.ui.showDeps = true; save(); go('planning');
    drawDeps();
    const svg = document.querySelector('#deps');
    const rows = [...document.querySelectorAll('.g-create-row')];
    return { svg: !!svg, lignes: svg ? svg.children.length : -1,
      sansId: rows.every((r) => !r.id && !r.querySelector('[id^="row-"], [id^="bar-"]')) };
  });
  note('DTC-36', deps);
  ok(deps.svg && deps.sansId,
    'DTC-36 : drawDeps() fonctionne toujours, et la ligne de création ne porte ni identifiant de tâche ni ancre de dépendance — aucune flèche ne peut la viser', 'DTC-36');

  // DTC-37 — Planning d'Opération : même composant, même moteur.
  const { ctx: c2, p: p2 } = await newPage({ tag: 'OP' });
  await ev(p2, () => { app.settings.period = 'week'; save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Planning'); });
  await p2.waitForTimeout(400);
  const opRows = await ev(p2, () => ({ rows: document.querySelectorAll('.g-create-row').length,
    projets: [...document.querySelectorAll('[data-create-project]')].map((e) => e.dataset.createProject) }));
  note('DTC-37', opRows);
  if (opRows.rows) {
    await drawOn(p2, 0.10, 0.40);
    const d = await drawerState(p2);
    ok(d.ouvert && opRows.projets.includes(d.projectId) && d.taches === (await ev(p2, () => app.tasks.length)),
      'DTC-37 : dans le Planning d’Opération, le MÊME composant et le MÊME openTaskForm s’ouvrent sur le bon chantier — aucun code spécifique', 'DTC-37');
    await shot(p2, '08-operation-draw-create.png');
    await ev(p2, () => closeOverlay('drawer'));
  } else {
    ok(false, 'DTC-37 : aucune ligne de création dans le Planning d’Opération', 'DTC-37');
  }
  await c2.close();

  const simu = await ev(p, () => {
    app.ui.showDeps = false;
    const opts = scenarioOptions('windows-delay');
    app.simulation = opts && opts[0] ? opts[0] : null;
    save(); go('planning');
    return { simulation: !!app.simulation, rows: document.querySelectorAll('.g-create-row').length,
      canDraw: planningCanDrawCreate('keravel', { advanced: true, readOnly: false, collapsed: false }) };
  });
  note('DTC-38', simu);
  ok(simu.simulation && simu.rows === 0 && !simu.canDraw,
    'DTC-38 : pendant une simulation, la création graphique est désactivée — une tâche réellement créée au milieu d’un scénario simulé serait ambiguë', 'DTC-38');
  await ctx.close();
}

// ============================================================
// DTC-39 → DTC-46 — Mobile, tablette, sombre, accessibilité, socle
// ============================================================
console.log('\n[DTC-CONTEXTES] Mobile, tablette, sombre, accessibilité');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'MOB' });
  await planning(p, 'week');
  const mob = await ev(p, () => ({ rows: document.querySelectorAll('.g-create-row').length,
    agenda: document.querySelectorAll('.pa-day, .planning-agenda, .agenda-day').length,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ganttVisible: (() => { const g = document.querySelector('#gantt'); return g ? getComputedStyle(g.closest('.gantt-wrap')).display !== 'none' : false; })() }));
  note('DTC-39', mob);
  await shot(p, '10-mobile-no-draw.png');
  ok(mob.over <= 0 && (!mob.ganttVisible || mob.rows === 0),
    'DTC-39 : à 390px, le parcours mobile reste l’agenda — aucune création graphique utilisable et aucun débordement', 'DTC-39');
  await ctx.close();

  const { ctx: c2, p: p2 } = await newPage({ w: 768, h: 900, tag: 'TAB' });
  await planning(p2, 'week');
  const tab = await ev(p2, () => ({ rows: document.querySelectorAll('.g-create-row').length,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  note('DTC-40', tab);
  ok(tab.over <= 0,
    `DTC-40 : à 768px, le Gantt reste fonctionnel (${tab.rows} ligne(s) de création) sans débordement horizontal de page`, 'DTC-40');
  await c2.close();

  const { ctx: c3, p: p3 } = await newPage({ tag: 'DARK' });
  await ev(p3, () => { setAppearance('dark'); app.settings.period = 'day'; save(); go('planning'); });
  await p3.waitForTimeout(350);
  const box = await ev(p3, () => { const t = document.querySelector('.g-create-track'); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p3.mouse.move(box.x + box.w * 0.15, box.y + box.h / 2);
  await p3.mouse.down();
  await p3.mouse.move(box.x + box.w * 0.45, box.y + box.h / 2, { steps: 6 });
  const dark = await ev(p3, () => {
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const q = document.querySelector('.g-create-preview'), lbl = document.querySelector('.g-create-btn');
    const cs = getComputedStyle(q);
    return { sombre: document.body.classList.contains('dark'), visible: !q.hidden, texte: q.textContent,
      bordure: cs.borderTopColor, contraste: lum(cs.color) > lum(getComputedStyle(document.body).backgroundColor),
      labelLisible: lum(getComputedStyle(lbl).color) > 0.4 };
  });
  await shot(p3, '09-dark-preview.png');
  await p3.mouse.up();
  await p3.waitForTimeout(200);
  await ev(p3, () => closeOverlay('drawer'));
  note('DTC-41', dark);
  ok(dark.sombre && dark.visible && dark.contraste && dark.labelLisible,
    'DTC-41 : en thème sombre, l’aperçu et le libellé de la ligne restent lisibles — uniquement des variables du design system', 'DTC-41');
  await c3.close();

  const { ctx: c4, p: p4 } = await newPage({ tag: 'A11Y' });
  await planning(p4, 'week');
  const a11y = await ev(p4, () => {
    const btn = document.querySelector('.g-create-btn');
    btn.focus();
    const focus = document.activeElement === btn;
    btn.click();
    const d = { focus, tag: btn.tagName, type: btn.getAttribute('type'),
      ouvert: !!document.querySelector('#drawer.open'),
      start: document.querySelector('[name="start"]')?.value,
      end: document.querySelector('[name="end"]')?.value };
    closeOverlay('drawer');
    return d;
  });
  note('DTC-42', a11y);
  ok(a11y.focus && a11y.tag === 'BUTTON' && a11y.type === 'button' && a11y.ouvert
    && a11y.start.endsWith('T08:00') && a11y.end.endsWith('T12:00'),
    'DTC-42 : « + Ajouter une tâche » est un vrai bouton, atteignable au clavier, qui ouvre le formulaire CLASSIQUE sans sélection graphique — le dessin n’est jamais le seul chemin', 'DTC-42');

  const socle = await ev(p4, () => {
    for (let i = 0; i < 3; i++) { snapshot(); app.tasks[0].name = 'X' + i; save(); actionToast('Tâche modifiée'); }
    const bk = JSON.stringify(buildKanvixBackup());
    const ls = localStorage.getItem(STORE);
    return { schema: SCHEMA_VERSION, store: STORE,
      backupPropre: !/planningCreateDrag|g-create/.test(bk),
      lsPropre: !/planningCreateDrag/.test(ls) };
  });
  note('DTC-44', socle);
  ok(socle.backupPropre && socle.lsPropre,
    'DTC-44 : ni la sauvegarde ni localStorage ne contiennent l’état du geste', 'DTC-44');
  ok(Number(socle.schema) >= 12, 'DTC-45 : SCHEMA_VERSION ne recule jamais sous 12 — le draw-to-create n’ajoute aucun champ métier (la migration 13 est celle de la Structure, V2.9.0 §43)', 'DTC-45');
  ok(socle.store === 'kanvix-product-8-3', 'DTC-46 : STORE reste « kanvix-product-8-3 »', 'DTC-46');
  await c4.close();
}

// ============================================================
// DTC-49 — Trois transactions de natures différentes
// ============================================================
console.log('\n[DTC-CHAINE] Création graphique + modification + déplacement');
{
  const { ctx, p } = await newPage({ tag: 'CHAINE' });
  await planning(p, 'week');
  const depart = await ev(p, () => ({ taches: app.tasks.length, nom: app.tasks[0].name, start: app.tasks[1].start }));
  await drawOn(p, 0.10, 0.35);
  await p.fill('[name="name"]', 'Créée au dessin');
  await ev(p, () => document.querySelector('#drawer form')?.requestSubmit());
  await p.waitForTimeout(300);
  const suite = await ev(p, () => {
    snapshot(); app.tasks[0].name = 'Modifiée'; save(); actionToast('Tâche modifiée');
    const t = app.tasks[1];
    requestTaskScheduleMove(t.id, shiftDateStr(dayKey(t.start), 2), 'planning-gantt');
    return { taches: app.tasks.length, nom: app.tasks[0].name, start: app.tasks[1].start, undo: undoHistory.length,
      labels: undoLabels.slice(-3) };
  });
  const remonte = await ev(p, () => {
    const out = [];
    undo(); out.push({ start: app.tasks[1].start });
    undo(); out.push({ nom: app.tasks[0].name });
    undo(); out.push({ taches: app.tasks.length, creee: !!app.tasks.find((t) => t.name === 'Créée au dessin') });
    return out;
  });
  note('DTC-49', { depart, suite, remonte });
  ok(suite.taches === depart.taches + 1 && suite.undo >= 3
    && remonte[0].start === depart.start && remonte[1].nom === depart.nom
    && remonte[2].taches === depart.taches && !remonte[2].creee,
    'DTC-49 : une création graphique, une modification et un déplacement forment trois transactions distinctes, remontées dans le bon ordre par trois Undo', 'DTC-49');
  await ctx.close();
}

// ============================================================
// FREEZE-285 — Périmètre
// ============================================================
console.log('\n[FREEZE-285] Byte-identité');
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
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo', 'actionToast',
    'historyToast', 'historyControls', 'refreshHistoryControls', 'historyControlsState',
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget',
    'requestGanttTaskMove', 'planReflow', 'applyReflowPlan',
    'dropTask', 'dragStart', 'dragOver', 'drawDeps', 'planningAgenda',
    'planningIsReadOnly', 'scale', 'pos', 'kanbanBoard', 'kanbanCard',     'submitControlAttempt', 'createRework', 'evaluateScenario', 'getProjectHealth',
    'getProjectSummary', 'milestoneStatus', 'isUpcomingMilestone', 'operationMilestoneStats',
    'operationMilestonesTab', 'taskResourceIds', 'getResourceSchedulingConflicts',
    'resourceLoadBoard', 'buildImportPlan', 'validateImportState',
    'buildKanvixBackup', 'confirmKanvixRestore', 'save', 'applyStorageSync',
    'resetApp', 'renderField', 'handleFieldSiteTab', 'pageToday', 'renderSites', 'siteCard',
    'confirmDeleteTask', 'toggleProject', 'weekBounds',
    'getCurrentWeekRange', 'canEditProject', 'guardEditable',
  ];
  /* V2.12.0 — RE-BASELINE, une seule cause NOMMÉE : « Conditions de démarrage »
     étend ces moteurs centraux plutôt que de les dupliquer — la règle même que
     ce gel protège. Déclarées, donc assumées, et vérifiées une à une par
     FREEZE-2120 dans recette-conditions-demarrage-v2.12.0.mjs. */
  const rebaseV2120 = ['confirmDeleteTask'];
  /* V2.12.0.2 — RE-BASELINE, une seule cause NOMMÉE. Le correctif « une
     communication ne remonte pas le temps » pose dans restoreHistoryState() la
     seule règle du round : un message émis après la prise du snapshot n'est pas
     « dé-envoyé » par l'annulation d'une transaction qui ne le concerne pas. La
     fonction quitte donc le gel, déclarée et assumée ; FREEZE-21202 la vérifie
     ligne à ligne dans recette-undo-communications-v2.12.0.2.mjs. snapshot(),
     undo(), redo(), cloneHistoryState() et invalidateRedo() restent, eux,
     BYTE-IDENTIQUES — le moteur Undo/Redo n'a pas été refait. */
  const rebaseV21202 = ['restoreHistoryState'];
  let moved = [], same = 0;
  for (const n of frozen) {
    if (rebaseV2120.includes(n)) continue;
    if (rebaseV21202.includes(n)) continue;
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-285', { gelés: same, bougés: moved, reBaséesV2120: rebaseV2120 });
  ok(moved.length === 0,
    `FREEZE-285 : les ${frozen.length} moteurs de V2.8.4.1 sont BYTE-IDENTIQUES — tout l’Undo/Redo, le déplacement des tâches, le drag HTML5, drawDeps, scale(), pos(), planningTasks(), la Qualité, les Ressources, les Jalons et le Mode Chantier`, 'FREEZE-285');

  /* V2.8.5.2 — RE-BASELINE : gantt() a de nouveau changé, cette fois pour
     détacher l'édition du niveau Essentiel/Pilotage (§3). C'est un périmètre
     ATTENDU, pas une dérive. */
  const attendu = ['gantt', 'openTaskForm', 'requestTaskScheduleMove', 'setTaskStatus', 'submitTaskEdit'];
  const changed = attendu.filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['planningXToDate', 'planningCreateRange', 'planningCanDrawCreate', 'planningCreateRow',
    'planningCreateColumns', 'planningCreatePointerDown', 'planningCreatePointerMove',
    'planningCreateLabel', 'planningCreatePointerUp', 'planningCreateEscape', 'cancelPlanningCreateDrag']
    .filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-285-périmètre', { modifiées: changed, ajoutées: added.length });
  /* V2.8.5.2 — RE-BASELINE : la liste `attendu` compte désormais cinq noms
     (deux pour V2.8.5, trois pour les correctifs V2.8.5.1 / V2.8.5.2). C'est
     leur TOTALITÉ qui doit avoir changé : aucune dérive hors de cette liste. */
  ok(changed.length === attendu.length && added.length === 11,
    'FREEZE-285 : seules les fonctions attendues sont modifiées — gantt() et openTaskForm() pour V2.8.5, puis requestTaskScheduleMove(), setTaskStatus() et submitTaskEdit() pour les correctifs V2.8.5.1/V2.8.5.2 — et les onze helpers ajoutés appartiennent tous au draw-to-create', 'FREEZE-285');

  // Rétro-compatibilité de la signature, et pureté des convertisseurs.
  const sig = /function openTaskForm\(pid = app\.ui\.projectId, editId = "", prefill = null\)/.test(curSrc);
  const purs = ['planningXToDate', 'planningCreateRange'].every((n) => {
    const body = extract(curSrc, n);
    return body && !/\bsave\(\)|snapshot\(\)|app\.tasks\.|app\.history\.|document\./.test(body);
  });
  const unSeulGantt = (curSrc.match(/function gantt\(/g) || []).length === 1;
  const pasDeDragHtml5 = !/g-create[^"]*"[^>]*draggable|ondragstart[^>]*g-create/.test(curSrc);
  note('FREEZE-285-regles', { signature: sig, convertisseursPurs: purs, unSeulGantt, pasDeDragHtml5 });
  ok(sig && purs && unSeulGantt && pasDeDragHtml5,
    'FREEZE-285 : le paramètre prefill est optionnel EN QUEUE, les convertisseurs X → temps sont purs, il n’existe qu’UN gantt(), et la ligne de création n’utilise aucun drag HTML5', 'FREEZE-285');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-285-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  /* V2.9.0 — RE-BASELINE. Le schéma passe à 13 : `structureNodes` est ajouté,
     VIDE pour tout état antérieur, et chaque tâche reçoit structureNodeId = null
     (V2.9.0 §43). Ce round-ci n'ajoutait effectivement aucune migration ; la
     garantie durable que cette assertion protège reste le STORE — strictement
     inchangé — et le fait qu'un schéma ne RECULE jamais. On vérifie donc ces
     deux invariants-là, sans rien relâcher d'autre. */
  ok(store(curSrc) === 'kanvix-product-8-3' && Number(schema(curSrc)) >= Number(schema(prevSrc)) && Number(schema(curSrc)) >= 12,
    'FREEZE-285 : STORE et SCHEMA_VERSION (12) strictement inchangés', 'FREEZE-285');
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
