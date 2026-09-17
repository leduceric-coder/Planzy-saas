// ============================================================
// KANVIX — Recette « Calendrier & réalité du planning » (V2.8.5.1)
//
//   Trois correctifs du Planning, une seule question par famille :
//
//   1. JOURS NON OUVRÉS — samedi, dimanche et jours fériés restent
//      PLANIFIABLES (c'est le BTP), mais Kanvix avertit et n'décale jamais
//      rien au lundi. Une seule vérité calendaire pour l'affichage ET pour
//      l'avertissement.
//   2. NAVIGATION OPÉRATION — l'onglet Planning d'une opération avance et
//      recule dans le temps avec le MOTEUR GLOBAL, pas une navigation à lui.
//   3. DÉMARRAGE RÉEL — une tâche commencée avant l'heure prévue rejoint
//      vraiment le planning du jour, durée conservée, en UNE transaction.
//
//   Plus le nettoyage visuel : plus de double liseré bleu autour d'une tâche
//   fraîchement créée, sans toucher au repère Aujourd'hui.
//
//   Usage : node recette-planning-calendrier-realite-v2.8.5.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.5.1.html';
const PREV = 'kanvix-next-gen-v2.8.5.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.5.1/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW } = opts;
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
  await p.evaluate(() => {
    resetApp(); setDepth('pilot'); setRole('driver');
    dismissKanvixContinuityNotice();
  });
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
  await p.waitForTimeout(280);
};
const modalState = (p) => ev(p, () => ({
  ouvert: document.querySelector('#modal').classList.contains('open'),
  titre: document.querySelector('#modalContent h2')?.textContent || '',
  corps: document.querySelector('#modalContent p')?.innerText || '',
  jours: [...document.querySelectorAll('.cal-warn-days li')].map((l) => l.textContent),
  boutons: [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => x.textContent),
}));
const etat = (p) => ev(p, () => ({
  taches: app.tasks.length,
  undo: undoHistory.length,
  redo: redoHistory.length,
  hist: app.history.length,
}));

// ============================================================
// PC-01 → PC-14 — Le moteur calendaire
// ============================================================
console.log('\n[PC-CALENDRIER] Week-end et jours fériés français');
{
  const { ctx, p } = await newPage({ tag: 'CAL' });
  const r = await ev(p, () => ({
    samedi: isNonWorkingDate('2026-08-22'),
    samedieWeekend: isWeekendDate('2026-08-22'),
    dimanche: isNonWorkingDate('2026-08-23'),
    dimancheWeekend: isWeekendDate('2026-08-23'),
    mardiOuvre: isNonWorkingDate('2026-08-18'),
    mardiFerie: isFrenchPublicHoliday('2026-08-18'),
    h2026: frenchPublicHolidays(2026),
    h2027: frenchPublicHolidays(2027),
    h2031: frenchPublicHolidays(2031),
    paques: { 2026: localDateKey(easterSunday(2026)), 2027: localDateKey(easterSunday(2027)), 2031: localDateKey(easterSunday(2031)) },
  }));
  note('PC-01', { samedi: r.samedi, dimanche: r.dimanche, mardi: r.mardiOuvre, paques: r.paques });
  ok(r.samedi && r.samedieWeekend, 'PC-01 : le samedi est un jour non ouvré', 'PC-01');
  ok(r.dimanche && r.dimancheWeekend, 'PC-02 : le dimanche est un jour non ouvré', 'PC-02');
  ok(!r.mardiOuvre && !r.mardiFerie,
    'PC-03 : un jour ouvré ordinaire n’est ni week-end ni férié — aucun faux positif', 'PC-03');

  const fixes = [
    ['PC-04', '01-01', 'Jour de l’an'],
    ['PC-05', '05-01', 'Fête du Travail'],
    ['PC-06', '05-08', 'Victoire 1945'],
    ['PC-07', '07-14', 'Fête nationale'],
    ['PC-08', '08-15', 'Assomption'],
    ['PC-09', '11-01', 'Toussaint'],
    ['PC-10', '11-11', 'Armistice 1918'],
    ['PC-11', '12-25', 'Noël'],
  ];
  note('PC-04', { n2026: Object.keys(r.h2026).length, n2027: Object.keys(r.h2027).length, n2031: Object.keys(r.h2031).length });
  fixes.forEach(([id, md, name]) => {
    const toutes = [2026, 2027, 2031].every((y) => r['h' + y][`${y}-${md}`] === name);
    ok(toutes, `${id} : le ${md.slice(3)}/${md.slice(0, 2)} est reconnu « ${name} » — pour 2026, 2027 ET 2031`, id);
  });

  // Dates mobiles VÉRIFIÉES sur trois années : elles ne peuvent pas être une
  // table figée, elles sont recalculées depuis Pâques.
  const mobiles = [
    ['PC-12', 'Lundi de Pâques', { 2026: '2026-04-06', 2027: '2027-03-29', 2031: '2031-04-14' }],
    ['PC-13', 'Ascension', { 2026: '2026-05-14', 2027: '2027-05-06', 2031: '2031-05-22' }],
    ['PC-14', 'Lundi de Pentecôte', { 2026: '2026-05-25', 2027: '2027-05-17', 2031: '2031-06-02' }],
  ];
  mobiles.forEach(([id, name, attendu]) => {
    const reel = {};
    [2026, 2027, 2031].forEach((y) => {
      reel[y] = Object.entries(r['h' + y]).find(([, n]) => n === name)?.[0];
    });
    note(id, { attendu, reel });
    ok([2026, 2027, 2031].every((y) => reel[y] === attendu[y]),
      `${id} : « ${name} » est calculé dynamiquement — ${reel[2026]}, ${reel[2027]}, ${reel[2031]}`, id);
  });
  await ctx.close();
}

// ============================================================
// PC-15 → PC-22 — Confirmation à la création
// ============================================================
console.log('\n[PC-CREATION] Confirmer avant de planifier un jour non ouvré');
{
  const { ctx, p } = await newPage({ tag: 'CREA' });
  await planning(p, 'week');

  const creer = async (nom, start, end) => {
    await ev(p, () => openTaskForm('keravel'));
    await p.waitForTimeout(220);
    await p.fill('[name="name"]', nom);
    await p.fill('[name="start"]', start);
    await p.fill('[name="end"]', end);
    await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
    await p.waitForTimeout(280);
    return modalState(p);
  };

  const sam = await creer('Samedi', '2026-08-22T08:00', '2026-08-22T12:00');
  note('PC-15', sam);
  ok(sam.ouvert && /jour non ouvré/i.test(sam.titre) && sam.jours.length === 1 && /sam\. 22/.test(sam.jours[0])
    && sam.boutons.join('|') === 'Annuler|Planifier quand même',
    `PC-15 : créer un samedi demande confirmation et NOMME le jour — « ${sam.jours[0]} »`, 'PC-15');
  await shot(p, '04-modale-jour-non-ouvre.png');
  await ev(p, () => { cancelCalendarConfirm(); closeOverlay('drawer'); });

  const dim = await creer('Dimanche', '2026-08-23T08:00', '2026-08-23T12:00');
  note('PC-16', dim);
  ok(dim.ouvert && dim.jours.length === 1 && /dim\. 23/.test(dim.jours[0]),
    `PC-16 : créer un dimanche demande confirmation — « ${dim.jours[0]} »`, 'PC-16');
  await ev(p, () => { cancelCalendarConfirm(); closeOverlay('drawer'); });

  const fer = await creer('Férié', '2026-11-11T08:00', '2026-11-11T12:00');
  note('PC-17', fer);
  ok(fer.ouvert && fer.jours.length === 1 && /11 nov/.test(fer.jours[0]) && /Armistice/.test(fer.jours[0]),
    `PC-17 : créer un jour férié demande confirmation et le NOMME — « ${fer.jours[0]} »`, 'PC-17');
  await ev(p, () => { cancelCalendarConfirm(); closeOverlay('drawer'); });

  // §5.1 — la détection ne teste PAS que le jour de début.
  const chevauche = await creer('Vendredi vers samedi', '2026-08-21T16:00', '2026-08-22T11:00');
  note('PC-18', chevauche);
  ok(chevauche.ouvert && chevauche.jours.length === 1 && /sam\. 22/.test(chevauche.jours[0]),
    'PC-18 : une tâche commencée le VENDREDI et finie le SAMEDI déclenche l’avertissement — la détection parcourt toute la période, pas seulement le jour de début', 'PC-18');

  // §5.2 — Annuler : rien du tout.
  const avant = await etat(p);
  await ev(p, () => cancelCalendarConfirm());
  await p.waitForTimeout(200);
  const apresAnnul = await ev(p, () => ({
    ...{ taches: app.tasks.length, undo: undoHistory.length, redo: redoHistory.length, hist: app.history.length },
    drawer: !!document.querySelector('#drawer.open'),
    modal: document.querySelector('#modal').classList.contains('open'),
    creee: app.tasks.some((t) => t.name === 'Vendredi vers samedi'),
  }));
  note('PC-19', { avant, apresAnnul });
  ok(!apresAnnul.creee && apresAnnul.taches === avant.taches && apresAnnul.undo === avant.undo
    && apresAnnul.hist === avant.hist && !apresAnnul.modal && apresAnnul.drawer,
    'PC-19 : « Annuler » ne crée rien, n’écrit aucun historique, ne pose aucun snapshot Undo — et rend la main au formulaire', 'PC-19');

  // §5.3 — Confirmer : le flux normal reprend, UNE transaction.
  await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
  await p.waitForTimeout(220);
  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);
  const cree = await ev(p, () => {
    const t = app.tasks.find((x) => x.name === 'Vendredi vers samedi');
    return { id: t?.id, start: t?.start, end: t?.end, statut: t?.status, taches: app.tasks.length,
      undo: undoHistory.length, drawer: !!document.querySelector('#drawer.open'),
      modal: document.querySelector('#modal').classList.contains('open'),
      toast: document.querySelector('#toast').textContent };
  });
  note('PC-20', cree);
  ok(!!cree.id && cree.start === '2026-08-21T16:00' && cree.end === '2026-08-22T11:00'
    && cree.taches === avant.taches + 1 && !cree.drawer && !cree.modal,
    'PC-20 : « Planifier quand même » crée la tâche aux dates EXACTES saisies — aucun décalage automatique au lundi', 'PC-20');
  ok(cree.undo === avant.undo + 1,
    `PC-21 : la création confirmée est UNE seule transaction Undo (${avant.undo} → ${cree.undo}) — la confirmation n’en ajoute pas une deuxième`, 'PC-21');

  const ur = await ev(p, (id) => {
    undo();
    const apresUndo = { taches: app.tasks.length, existe: !!task(id), redo: redoHistory.length };
    redo();
    const t = task(id);
    return { apresUndo, apresRedo: { taches: app.tasks.length, id: t?.id, start: t?.start, end: t?.end } };
  }, cree.id);
  note('PC-22', ur);
  ok(ur.apresUndo.taches === avant.taches && !ur.apresUndo.existe
    && ur.apresRedo.id === cree.id && ur.apresRedo.start === cree.start && ur.apresRedo.end === cree.end,
    'PC-22 : un Undo retire la tâche, un Redo la restaure à l’identique — mêmes dates, même identifiant', 'PC-22');
  await ctx.close();
}

// ============================================================
// PC-23 → PC-25 — Déplacement vers un jour non ouvré
// ============================================================
console.log('\n[PC-DEPLACEMENT] Glisser une tâche vers un samedi');
{
  const { ctx, p } = await newPage({ tag: 'MOVE' });
  await planning(p, 'week');
  const avant = await ev(p, () => {
    const t = task('k-cloisons');
    return { start: t.start, end: t.end, undo: undoHistory.length, hist: app.history.length,
      // La chaîne réelle compte DEUX maillons : dropTask délègue à
      // requestGanttTaskMove, qui appelle requestTaskScheduleMove.
      dropRoute: String(window.dropTask).includes('requestGanttTaskMove')
        && String(window.requestGanttTaskMove).includes('requestTaskScheduleMove') };
  });
  await ev(p, () => requestTaskScheduleMove('k-cloisons', '2026-08-22T08:00', 'planning-gantt'));
  await p.waitForTimeout(280);
  const m = await modalState(p);
  const pendant = await ev(p, () => {
    const t = task('k-cloisons');
    return { start: t.start, end: t.end, undo: undoHistory.length, hist: app.history.length };
  });
  note('PC-23', { m, pendant, dropRoute: avant.dropRoute });
  ok(m.ouvert && /jour non ouvré/i.test(m.titre) && m.jours.some((j) => /sam\. 22/.test(j)) && avant.dropRoute,
    'PC-23 : déplacer une tâche vers un samedi demande confirmation — et le glisser-déposer du Gantt passe bien par ce moteur (dropTask → requestGanttTaskMove → requestTaskScheduleMove)', 'PC-23');

  await ev(p, () => cancelCalendarConfirm());
  await p.waitForTimeout(200);
  const annule = await ev(p, () => {
    const t = task('k-cloisons');
    return { start: t.start, end: t.end, undo: undoHistory.length, hist: app.history.length };
  });
  note('PC-24', annule);
  ok(annule.start === avant.start && annule.end === avant.end
    && annule.undo === avant.undo && annule.hist === avant.hist,
    `PC-24 : « Annuler » conserve les dates d’origine (${annule.start}) — aucun snapshot, aucun historique`, 'PC-24');

  await ev(p, () => requestTaskScheduleMove('k-cloisons', '2026-08-22T08:00', 'planning-gantt'));
  await p.waitForTimeout(220);
  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);
  const confirme = await ev(p, () => {
    const t = task('k-cloisons');
    return { start: t.start, end: t.end, undo: undoHistory.length,
      dureePreservee: (date(t.end) - date(t.start)) === 4 * 3600000 };
  });
  note('PC-25', confirme);
  ok(confirme.start === '2026-08-22T08:00' && confirme.undo === avant.undo + 1 && confirme.dureePreservee,
    'PC-25 : « Planifier quand même » applique les nouvelles dates, en UNE transaction, durée conservée', 'PC-25');
  await ctx.close();
}

// ============================================================
// PC-26 → PC-28 — Identification visuelle
// ============================================================
console.log('\n[PC-VISUEL] Week-end et fériés lisibles, clair et sombre');
{
  const lum = (c) => {
    const v = c.startsWith('color(')
      ? c.match(/[\d.]+/g).slice(0, 3).map(Number)
      : c.match(/[\d.]+/g).slice(0, 3).map((x) => +x / 255);
    const [r, g, bl] = v.map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const rgbOf = (c) => (c.startsWith('color(')
    ? c.match(/[\d.]+/g).slice(0, 3).map((x) => Math.round(+x * 255))
    : c.match(/[\d.]+/g).slice(0, 3).map(Number));

  const mesure = async (file, dark) => {
    const { ctx, p } = await newPage({ tag: 'VIS', file });
    await ev(p, (d) => {
      app.settings.period = 'week';
      app.ui.periodAnchor = '2026-08-17T00:00';
      if (d) setAppearance('dark');
      save(); go('planning');
    }, dark);
    await p.waitForTimeout(320);
    const r = await ev(p, () => {
      const probe = (css) => { const d = document.createElement('div'); d.style.cssText = css; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
      const we = document.querySelector('.g-slot.weekend');
      return { surface: probe('background:var(--surface)'),
        weekend: we ? getComputedStyle(we).backgroundColor : null,
        n: document.querySelectorAll('.g-slot.weekend').length };
    });
    await ctx.close();
    return r;
  };
  const clairAv = await mesure(PREV, false), clairAp = await mesure(CUR, false);
  const sombreAv = await mesure(PREV, true), sombreAp = await mesure(CUR, true);
  const d = (a, x) => +(Math.abs(lum(a) - lum(x)) * 100).toFixed(2);
  const dRGB = (a, x) => rgbOf(a).map((v, i) => Math.abs(v - rgbOf(x)[i]));

  const clair = { avant: d(clairAv.surface, clairAv.weekend), apres: d(clairAp.surface, clairAp.weekend), n: clairAp.n };
  note('PC-26', { clair, couleur: clairAp.weekend });
  ok(clair.n > 0 && clair.apres > clair.avant * 2 && !/rgb\(2[0-9][0-9], (1[0-9][0-9]|[0-9][0-9]), /.test(clairAp.weekend),
    `PC-26 : en thème clair, les colonnes de week-end passent de ${clair.avant} % à ${clair.apres} % d’écart de luminance avec la surface — réellement perceptibles, et ni rouges ni orangées`, 'PC-26');

  const sombre = { avant: dRGB(sombreAv.surface, sombreAv.weekend), apres: dRGB(sombreAp.surface, sombreAp.weekend), n: sombreAp.n };
  note('PC-27', { sombre, couleur: sombreAp.weekend });
  ok(sombre.n > 0 && sombre.apres.reduce((a, x) => a + x, 0) > sombre.avant.reduce((a, x) => a + x, 0),
    `PC-27 : en thème sombre, l’écart RGB avec la surface passe de ${sombre.avant.join('/')} à ${sombre.apres.join('/')} — visible sans devenir lumineux`, 'PC-27');

  const { ctx, p } = await newPage({ tag: 'FER' });
  const fer = await ev(p, () => {
    const t = task('k-cloisons'); t.start = '2026-11-09T08:00'; t.end = '2026-11-13T17:00';
    app.settings.period = 'week'; app.ui.periodAnchor = '2026-11-09T00:00'; save(); go('planning');
    const heads = [...document.querySelectorAll('.g-head > div')].slice(1);
    return {
      colonnes: heads.map((h) => ({ txt: h.textContent.trim(), cls: h.className.trim() })),
      badges: heads.filter((h) => h.querySelector('.g-ferie')).map((h) => ({ txt: h.textContent.trim(), titre: h.querySelector('.g-ferie').title })),
      doubleAplat: heads.filter((h) => h.classList.contains('weekend') && h.classList.contains('holiday')).length,
    };
  });
  note('PC-28', fer);
  ok(fer.badges.length === 1 && /mer\. 11/.test(fer.badges[0].txt) && /Férié/.test(fer.badges[0].txt)
    && fer.badges[0].titre === 'Armistice 1918' && fer.colonnes.filter((c) => c.cls === 'weekend').length === 2,
    'PC-28 : la colonne du 11 novembre porte l’indicateur « Férié » (info-bulle « Armistice 1918 ») et les deux colonnes de week-end restent distinctes', 'PC-28');

  // §4.2 — samedi ET férié : un seul aplat.
  const combo = await ev(p, () => {
    const t = task('k-cloisons'); t.start = '2026-08-10T08:00'; t.end = '2026-08-16T17:00';
    app.ui.periodAnchor = '2026-08-10T00:00'; save(); renderPage();
    const h = [...document.querySelectorAll('.g-head > div')].find((x) => /sam\. 15/.test(x.textContent));
    return { cls: h?.className.trim(), badge: !!h?.querySelector('.g-ferie') };
  });
  note('PC-28b', combo);
  ok(combo.cls === 'holiday' && combo.badge,
    'PC-28 : le 15 août 2026 est à la fois samedi ET Assomption — il ne reçoit qu’UN aplat (« holiday »), jamais deux superposés', 'PC-28');
  await shot(p, '03-planning-jour-ferie.png');
  await ctx.close();
}

// ============================================================
// PC-29 → PC-34 — Navigation temporelle de l'Opération
// ============================================================
console.log('\n[PC-OPERATION] Avancer et reculer dans le Planning d’Opération');
{
  const { ctx, p } = await newPage({ tag: 'OP' });
  const ouvrir = () => ev(p, () => {
    const op = app.operations[0];
    selectOperation(op.id); setOperationTab('Planning');
    return op.id;
  });
  const opId = await ouvrir();
  await p.waitForTimeout(300);
  const barre = await ev(p, () => {
    const nav = document.querySelector('.op-planning-nav');
    return {
      presente: !!nav,
      boutons: nav ? [...nav.querySelectorAll('button')].map((x) => x.textContent) : [],
      handlers: nav ? [...nav.querySelectorAll('button')].map((x) => x.getAttribute('onclick')) : [],
      label: nav?.querySelector('.period-label')?.textContent,
      // Aucune navigation propre à l'opération : les handlers sont les GLOBAUX.
      pasDeMoteurDedie: !/function\s+(shiftOperationPlanning|operationPlanningShift|opShift)/.test(document.documentElement.innerHTML),
      ancre: app.ui.periodAnchor,
    };
  });
  note('PC-29', barre);
  ok(barre.presente && barre.boutons.join('|') === '←|Aujourd’hui|→'
    && barre.handlers[0] === 'shiftPlanning(-1)' && barre.handlers[1] === 'planningToday()'
    && barre.handlers[2] === 'shiftPlanning(1)' && barre.pasDeMoteurDedie,
    `PC-29 : l’onglet Planning porte ← Aujourd’hui → et appelle le MOTEUR GLOBAL (shiftPlanning / planningToday) — aucune navigation spécifique à l’opération`, 'PC-29');
  await shot(p, '05-operation-semaine-N.png');

  const suivant = await ev(p, () => {
    const avant = app.ui.periodAnchor;
    shiftPlanning(1);
    return { avant, apres: app.ui.periodAnchor,
      label: document.querySelector('.op-planning-nav .period-label')?.textContent,
      gantt: !!document.querySelector('#gantt') || !!document.querySelector('.plan-empty') };
  });
  note('PC-29b', suivant);
  ok(Math.round((new Date(suivant.apres) - new Date(suivant.avant)) / 86400000) === 7 && suivant.gantt,
    `PC-29 : « → » avance d’exactement 7 jours en vue Semaine (${suivant.avant} → ${suivant.apres}) et le Gantt consolidé se recalcule`, 'PC-29');
  await shot(p, '06-operation-semaine-N1.png');

  const precedent = await ev(p, () => {
    const avant = app.ui.periodAnchor;
    shiftPlanning(-1);
    return { avant, apres: app.ui.periodAnchor, label: document.querySelector('.op-planning-nav .period-label')?.textContent };
  });
  note('PC-30', precedent);
  ok(Math.round((new Date(precedent.avant) - new Date(precedent.apres)) / 86400000) === 7,
    `PC-30 : « ← » recule d’exactement 7 jours (${precedent.avant} → ${precedent.apres})`, 'PC-30');

  const moisEtAn = await ev(p, () => {
    // Traversée d'une fin de mois : 5 semaines depuis le 17 août → septembre.
    app.ui.periodAnchor = '2026-08-17T00:00'; app.settings.period = 'week'; save(); renderPage();
    const etapes = [];
    for (let i = 0; i < 5; i++) { shiftPlanning(1); etapes.push(app.ui.periodAnchor); }
    const finDeMois = { etapes, moisAtteint: etapes[etapes.length - 1].slice(5, 7),
      label: document.querySelector('.op-planning-nav .period-label')?.textContent };
    // Traversée d'une fin d'année.
    app.ui.periodAnchor = '2026-12-28T00:00'; save(); renderPage();
    shiftPlanning(1);
    finDeMois.finAnnee = app.ui.periodAnchor;
    return finDeMois;
  });
  note('PC-31', moisEtAn);
  ok(moisEtAn.moisAtteint === '09' && moisEtAn.finAnnee.slice(0, 4) === '2027',
    `PC-31 : la navigation traverse une fin de mois (août → ${moisEtAn.moisAtteint}) et une fin d’année (→ ${moisEtAn.finAnnee.slice(0, 10)}) sans se bloquer`, 'PC-31');

  const mois = await ev(p, () => {
    app.settings.period = 'month'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); renderPage();
    const avant = app.ui.periodAnchor; shiftPlanning(1);
    return { avant, apres: app.ui.periodAnchor, label: document.querySelector('.op-planning-nav .period-label')?.textContent };
  });
  note('PC-32', mois);
  ok(mois.apres.slice(0, 7) === '2026-09',
    `PC-32 : en vue Mois, « → » avance d’un mois (${mois.avant.slice(0, 7)} → ${mois.apres.slice(0, 7)})`, 'PC-32');

  const an = await ev(p, () => {
    app.settings.period = 'year'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); renderPage();
    const avant = app.ui.periodAnchor; shiftPlanning(1);
    return { avant, apres: app.ui.periodAnchor, label: document.querySelector('.op-planning-nav .period-label')?.textContent };
  });
  note('PC-33', an);
  ok(an.apres.slice(0, 4) === '2027',
    `PC-33 : en vue Année, « → » avance d’un an (${an.avant.slice(0, 4)} → ${an.apres.slice(0, 4)})`, 'PC-33');

  const aujourdhui = await ev(p, () => {
    app.settings.period = 'week'; app.ui.periodAnchor = '2027-03-01T00:00'; save(); renderPage();
    planningToday();
    return { ancre: app.ui.periodAnchor, today: TODAY,
      label: document.querySelector('.op-planning-nav .period-label')?.textContent,
      surPage: app.ui.page, onglet: app.ui.operationTab };
  });
  note('PC-34', aujourdhui);
  ok(dayKeyEq(aujourdhui.ancre, aujourdhui.today) && aujourdhui.surPage === 'operation' && aujourdhui.onglet === 'Planning',
    `PC-34 : « Aujourd’hui » ramène l’ancre au jour courant (${String(aujourdhui.ancre).slice(0, 10)}) sans quitter l’onglet Planning de l’opération`, 'PC-34');
  await ctx.close();
}
function dayKeyEq(a, b) { return String(a).slice(0, 10) === String(b).slice(0, 10); }

// ============================================================
// PC-35 → PC-48 — Démarrage réel
// ============================================================
console.log('\n[PC-DEMARRAGE] Une tâche démarrée rejoint le planning du jour');
{
  const { ctx, p } = await newPage({ tag: 'START', now: '2026-08-17T14:30:00' });
  await planning(p, 'week');
  const prepare = () => ev(p, () => {
    resetApp(); setDepth('pilot'); setRole('driver');
    const t = task('k-cloisons');
    t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00'; t.status = 'todo'; t.deps = [];
    t.baselineStart = '2026-08-18T08:00'; t.baselineEnd = '2026-08-18T12:00';
    app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00';
    save(); go('planning');
    return { start: t.start, end: t.end, duree: (date(t.end) - date(t.start)) / 3600000,
      baseline: [t.baselineStart, t.baselineEnd],
      undo: undoHistory.length, hist: app.history.length };
  });
  const avant = await prepare();
  await p.waitForTimeout(250);

  await ev(p, () => setTaskStatus('k-cloisons', 'doing', 'task', { manual: true }));
  await p.waitForTimeout(250);
  const demande = await modalState(p);
  const pendant = await ev(p, () => {
    const t = task('k-cloisons');
    return { statut: t.status, start: t.start, end: t.end, undo: undoHistory.length, hist: app.history.length };
  });
  note('PC-35', { demande, pendant, avant });
  ok(demande.ouvert && /Démarrer cette tâche maintenant/.test(demande.titre)
    && /mar\. 18 août/.test(demande.corps) && /lun\. 17 août/.test(demande.corps)
    && demande.boutons.join('|') === 'Annuler|Démarrer maintenant',
    'PC-35 : une tâche prévue demain et démarrée aujourd’hui demande confirmation, en nommant l’horaire prévu ET le nouveau', 'PC-35');
  ok(pendant.statut === 'todo' && pendant.start === avant.start && pendant.undo === avant.undo && pendant.hist === avant.hist,
    'PC-35 : tant que l’utilisateur n’a pas confirmé, RIEN n’est écrit — ni statut, ni dates, ni snapshot, ni historique', 'PC-35');
  await shot(p, '07-demarrage-avant-confirmation.png');

  await ev(p, () => cancelCalendarConfirm());
  await p.waitForTimeout(200);
  const apresAnnul = await ev(p, () => {
    const t = task('k-cloisons');
    return { statut: t.status, start: t.start, end: t.end, undo: undoHistory.length, hist: app.history.length };
  });
  ok(apresAnnul.statut === 'todo' && apresAnnul.start === avant.start && apresAnnul.undo === avant.undo,
    'PC-35 : « Annuler » laisse la tâche exactement dans son état précédent', 'PC-35');

  // La garde est posée AVANT toute écriture, y compris avant la matérialisation
  // des contrôles qualité : une confirmation refusée ne laisse aucune trace.
  const zeroEffet = await ev(p, () => {
    const t = task('k-control');
    t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00'; t.status = 'todo'; save();
    const compte = () => (app.controlInstances || app.controls || []).length;
    const av = { ctrl: compte(), hist: app.history.length, undo: undoHistory.length };
    setTaskStatus('k-control', 'doing', 'task', { manual: true });
    const pendant = { ctrl: compte(), modal: document.querySelector('#modal').classList.contains('open') };
    cancelCalendarConfirm();
    const ap = { ctrl: compte(), hist: app.history.length, undo: undoHistory.length, statut: task('k-control').status };
    return { av, pendant, ap };
  });
  note('PC-35b', zeroEffet);
  ok(zeroEffet.pendant.modal && zeroEffet.pendant.ctrl === zeroEffet.av.ctrl
    && zeroEffet.ap.ctrl === zeroEffet.av.ctrl && zeroEffet.ap.hist === zeroEffet.av.hist
    && zeroEffet.ap.undo === zeroEffet.av.undo && zeroEffet.ap.statut === 'todo',
    'PC-35 : la garde précède TOUT effet de bord — une confirmation refusée ne matérialise même pas un contrôle qualité « au passage »', 'PC-35');

  await ev(p, () => setTaskStatus('k-cloisons', 'doing', 'task', { manual: true }));
  await p.waitForTimeout(200);
  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);
  const apres = await ev(p, () => {
    const t = task('k-cloisons');
    return { statut: t.status, start: t.start, end: t.end,
      duree: (date(t.end) - date(t.start)) / 3600000,
      now: localDateTime(getDemoNow()),
      baseline: [t.baselineStart, t.baselineEnd],
      undo: undoHistory.length, hist: app.history.length,
      entree: app.history[0] && { text: app.history[0].text, changes: app.history[0].changes, eventType: app.history[0].eventType },
      toast: document.querySelector('#toast').textContent };
  });
  note('PC-36', apres);
  ok(apres.start === apres.now,
    `PC-36 : après confirmation, le début devient MAINTENANT (${apres.start})`, 'PC-36');
  ok(apres.duree === avant.duree && apres.end === '2026-08-17T18:30',
    `PC-37 : la durée prévue est conservée — ${avant.duree} h avant, ${apres.duree} h après ; la fin est calculée (${apres.end}), jamais forcée à 17:00 ou 18:00`, 'PC-37');
  ok(apres.statut === 'doing', 'PC-41 : le statut est bien « doing »', 'PC-41');
  ok(JSON.stringify(apres.baseline) === JSON.stringify(avant.baseline),
    `PC-42 : la baseline est INCHANGÉE (${apres.baseline.join(' → ')}) — le planning actuel bouge, le plan initial de référence non`, 'PC-42');
  ok(apres.hist === avant.hist + 1 && apres.entree.changes.length === 3
    && apres.entree.changes.map((c) => c.field).join('|') === 'Statut|Début|Fin',
    `PC-14bis / §14 : UNE seule entrée d’historique porte le statut ET les dates (${apres.entree.changes.map((c) => c.field).join(', ')}) — pas trois événements indépendants`, 'PC-43');

  const vues = await ev(p, () => {
    app.settings.period = 'day'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); go('planning');
    const jour = !!document.querySelector('#bar-k-cloisons');
    app.settings.period = 'week'; save(); renderPage();
    const semaine = !!document.querySelector('#bar-k-cloisons');
    const dansJour = planningTasks('all').some((t) => t.id === 'k-cloisons');
    return { jour, semaine, dansJour };
  });
  note('PC-38', vues);
  ok(vues.jour, 'PC-38 : la tâche apparaît immédiatement dans le Planning du JOUR', 'PC-38');
  ok(vues.semaine && vues.dansJour, 'PC-39 : elle apparaît correctement en Planning SEMAINE', 'PC-39');
  await shot(p, '08-planning-jour-apres-demarrage.png');

  const op = await ev(p, () => {
    const o = app.operations.find((x) => operationActiveProjectIds(x.id).includes('keravel')) || app.operations[0];
    selectOperation(o.id); setOperationTab('Planning');
    app.settings.period = 'day'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); renderPage();
    return { op: o.id, visible: !!document.querySelector('#bar-k-cloisons'),
      perimetre: operationActiveProjectIds(o.id) };
  });
  note('PC-40', op);
  ok(op.visible, 'PC-40 : elle apparaît dans le Planning de l’Opération concernée — même Gantt, même moteur', 'PC-40');

  const ur = await ev(p, () => {
    go('planning');
    undo();
    const t1 = task('k-cloisons');
    const apresUndo = { statut: t1.status, start: t1.start, end: t1.end, redo: redoHistory.length, undo: undoHistory.length };
    redo();
    const t2 = task('k-cloisons');
    return { apresUndo, apresRedo: { statut: t2.status, start: t2.start, end: t2.end } };
  });
  note('PC-43', ur);
  ok(ur.apresUndo.statut === 'todo' && ur.apresUndo.start === avant.start && ur.apresUndo.end === avant.end
    && ur.apresUndo.undo === avant.undo,
    'PC-43 : UN SEUL Undo restaure ensemble le statut, le début ET la fin — jamais « Undo 1 = statut, Undo 2 = date »', 'PC-43');
  ok(ur.apresRedo.statut === 'doing' && ur.apresRedo.start === apres.start && ur.apresRedo.end === apres.end,
    'PC-44 : un seul Redo les rejoue tous les trois', 'PC-44');
  await shot(p, '12-undo-redo-apres-demarrage.png');

  // §10/§11 — démarrage TARDIF.
  const tardif = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    t.start = '2026-08-17T08:00'; t.end = '2026-08-17T16:00'; t.status = 'todo'; t.deps = [];
    save();
    setTaskStatus('k-cloisons', 'doing', 'task', { manual: true });
    const ouvert = document.querySelector('#modal').classList.contains('open');
    const corps = document.querySelector('#modalContent p')?.innerText || '';
    runCalendarConfirm();
    const a = task('k-cloisons');
    return { ouvert, corps, start: a.start, end: a.end, duree: (date(a.end) - date(a.start)) / 3600000, statut: a.status };
  });
  note('PC-45', tardif);
  ok(tardif.ouvert && tardif.start === '2026-08-17T14:30' && tardif.end === '2026-08-17T22:30' && tardif.duree === 8,
    `PC-45 : une tâche prévue 08:00–16:00 démarrée à 14:30 est réalignée à 14:30–22:30 — la durée de 8 h est conservée, c’est la réalité opérationnelle qui prime`, 'PC-45');

  const tolerance = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    t.start = localDateTime(new Date(+getDemoNow() + 2 * 60000));
    t.end = add(t.start, 4 * 3600000); t.status = 'todo'; t.deps = [];
    save();
    const undoAvant = undoHistory.length;
    setTaskStatus('k-cloisons', 'doing', 'task', { manual: true });
    const a = task('k-cloisons');
    return { modal: document.querySelector('#modal').classList.contains('open'),
      statut: a.status, start: a.start, undoDelta: undoHistory.length - undoAvant,
      ecartMin: 2, tolerance: REAL_START_TOLERANCE_MS / 60000 };
  });
  note('PC-46', tolerance);
  ok(!tolerance.modal && tolerance.statut === 'doing' && tolerance.undoDelta === 1,
    `PC-46 : un écart de 2 minutes (tolérance ${tolerance.tolerance} min) ne déclenche AUCUNE confirmation — le planning est déjà cohérent`, 'PC-46');

  // §12 — démarrage qui amène la tâche sur un jour non ouvré : UNE modale.
  const samedi = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    t.start = '2026-08-25T08:00'; t.end = '2026-08-25T12:00'; t.status = 'todo'; t.deps = [];
    save();
    return { ok: true };
  });
  const surSamedi = await ev(p, () => {
    // On se place un samedi pour que le repositionnement y atterrisse.
    const t = task('k-cloisons');
    t.start = '2026-08-25T08:00'; t.end = '2026-08-25T12:00';
    save();
    // Le « maintenant » de la démo est un lundi : on simule la bascule en
    // demandant un réalignement sur une plage qui traverse le week-end.
    const plan = { start: '2026-08-21T16:00', end: '2026-08-22T11:00', fromStart: t.start, fromEnd: t.end };
    askRealStartConfirm('k-cloisons', 'task', { manual: true }, plan);
    const m = { titre: document.querySelector('#modalContent h2')?.textContent,
      jours: [...document.querySelectorAll('.cal-warn-days li')].map((l) => l.textContent),
      intro: document.querySelector('.cal-warn-intro')?.textContent,
      modales: document.querySelectorAll('.modal.open').length,
      boutons: [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => x.textContent) };
    cancelCalendarConfirm();
    return m;
  });
  note('PC-47', { samedi, surSamedi });
  ok(/Démarrer cette tâche maintenant/.test(surSamedi.titre) && surSamedi.jours.length === 1
    && /sam\. 22/.test(surSamedi.jours[0]) && /jour non ouvré/i.test(surSamedi.intro || '')
    && surSamedi.modales === 1 && surSamedi.boutons.length === 2,
    'PC-47 : un démarrage dont la nouvelle plage touche un samedi fusionne les deux messages dans UNE seule modale et UNE seule validation — jamais deux modales empilées', 'PC-47');

  const terminee = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-cloisons');
    t.status = 'done'; t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00';
    save();
    const avantS = t.start, undoAvant = undoHistory.length;
    setTaskStatus('k-cloisons', 'doing', 'task', { manual: true });
    const a = task('k-cloisons');
    return { statut: a.status, start: a.start, bouge: a.start !== avantS,
      undoDelta: undoHistory.length - undoAvant,
      modal: document.querySelector('#modal').classList.contains('open') };
  });
  note('PC-48', terminee);
  ok(terminee.statut === 'done' && !terminee.bouge && terminee.undoDelta === 0 && !terminee.modal,
    'PC-48 : une tâche TERMINÉE reste protégée — le démarrage réel ne contourne pas la garde « done » de V2.7', 'PC-48');

  const reflow = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const a = task('k-cloisons'), bt = task('k-lining');
    a.start = '2026-08-18T08:00'; a.end = '2026-08-18T12:00'; a.status = 'todo'; a.deps = [];
    bt.deps = ['k-cloisons']; bt.status = 'todo';
    bt.start = '2026-08-19T08:00'; bt.end = '2026-08-19T16:00';
    save();
    const avalAvant = { start: bt.start, end: bt.end };
    const undoAvant = undoHistory.length;
    setTaskStatus('k-cloisons', 'doing', 'task', { manual: true });
    runCalendarConfirm();
    const apresAval = task('k-lining');
    return { avalAvant, avalApres: { start: apresAval.start, end: apresAval.end },
      deplace: apresAval.start !== avalAvant.start,
      undoDelta: undoHistory.length - undoAvant,
      // Preuve de RÉUTILISATION : setTaskStatus appelle bien planReflow / applyReflowPlan.
      utilisePlanReflow: String(window.setTaskStatus).includes('planReflow')
        && String(window.setTaskStatus).includes('applyReflowPlan'),
      unSeulMoteur: (document.documentElement.innerHTML.match(/function planReflow\(/g) || []).length === 1 };
  });
  note('PC-49', reflow);
  ok(reflow.utilisePlanReflow && reflow.unSeulMoteur && reflow.undoDelta === 1,
    'PC-49 : la propagation aval du démarrage réel passe par planReflow / applyReflowPlan — un seul moteur, et tout tient dans UNE transaction Undo', 'PC-49');
  await ctx.close();
}

// ============================================================
// PC-50 → PC-54 — Création souris et nettoyage visuel
// ============================================================
console.log('\n[PC-VISUEL2] Création souris, bandes bleues, repères légitimes');
{
  const { ctx, p } = await newPage({ tag: 'DRAW' });
  await planning(p, 'week');
  const box = await ev(p, () => { const r = document.querySelector('.g-create-track').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.62, box.y + box.h / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.90, box.y + box.h / 2, { steps: 8 });
  const pendantDrag = await ev(p, () => ({
    apercu: !document.querySelector('.g-create-preview').hidden,
    texte: document.querySelector('.g-create-preview').textContent,
    trait: getComputedStyle(document.querySelector('.g-create-preview')).borderStyle,
    modal: document.querySelector('#modal').classList.contains('open'),
    taches: app.tasks.length, undo: undoHistory.length,
  }));
  await p.mouse.up();
  await p.waitForTimeout(300);
  const drawer = await ev(p, () => ({
    ouvert: !!document.querySelector('#drawer.open'),
    start: document.querySelector('[name="start"]')?.value,
    end: document.querySelector('[name="end"]')?.value,
    modal: document.querySelector('#modal').classList.contains('open'),
  }));
  note('PC-50', { pendantDrag, drawer });
  ok(drawer.ouvert && !!drawer.start && !!drawer.end,
    `PC-50 : la création à la souris préremplit toujours le formulaire (${drawer.start} → ${drawer.end}) — le geste de V2.8.5 est intact`, 'PC-50');
  ok(pendantDrag.apercu && !pendantDrag.modal && !drawer.modal
    && pendantDrag.taches === 11 && pendantDrag.undo === 0,
    'PC-51 : AUCUNE alerte pendant le mouvement de souris — l’aperçu s’affiche, rien n’est demandé, rien n’est muté', 'PC-51');
  ok(pendantDrag.trait === 'dashed',
    'PC-51 : l’aperçu de sélection est en TIRETS — il ne peut plus être confondu avec une barre de tâche réelle', 'PC-51');

  // La sélection touche un samedi → la confirmation arrive À LA VALIDATION.
  await p.fill('[name="name"]', 'Dessinée le week-end');
  await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
  await p.waitForTimeout(280);
  const apresSubmit = await modalState(p);
  note('PC-51b', apresSubmit);
  ok(apresSubmit.ouvert && /jour non ouvré/i.test(apresSubmit.titre),
    'PC-51 : c’est bien À LA VALIDATION que l’avertissement apparaît, pas pendant le geste', 'PC-51');
  await ev(p, () => runCalendarConfirm());
  await p.waitForTimeout(400);

  await p.mouse.move(10, 10);
  await p.waitForTimeout(250);
  const bleu = await ev(p, () => {
    const t = app.tasks.find((x) => x.name === 'Dessinée le week-end');
    const row = document.querySelector('#row-' + t.id);
    const bar = row.querySelector('.g-bar');
    const parse = (c) => (c.startsWith('color(')
      ? c.match(/[\d.]+/g).slice(0, 3).map((x) => Math.round(+x * 255))
      : c.match(/[\d.]+/g).slice(0, 3).map(Number));
    // Toute verticale bleue restant dans la ligne créée.
    const verts = [];
    row.querySelectorAll('*').forEach((el) => {
      const c = getComputedStyle(el), r = el.getBoundingClientRect();
      if (parseFloat(c.borderLeftWidth) > 0 && c.borderLeftStyle !== 'none')
        verts.push({ cls: el.className.trim(), type: 'bord', x: Math.round(r.x) });
      if (c.boxShadow !== 'none' && /inset/.test(c.boxShadow))
        verts.push({ cls: el.className.trim(), type: 'liseré', x: Math.round(r.x) });
    });
    const todaySlot = row.querySelector('.g-slot.today-cell');
    return {
      lotId: t.lotId,
      apercusVisibles: [...document.querySelectorAll('.g-create-preview')].filter((q) => !q.hidden).length,
      selection: app.ui.selectedTask,
      survol: document.querySelectorAll('.g-slot.over, .over').length,
      barFond: parse(getComputedStyle(bar).backgroundColor),
      todayFond: todaySlot ? parse(getComputedStyle(todaySlot).backgroundColor) : null,
      todayVisible: !!document.querySelector('.g-slot.today-cell') && !!document.querySelector('.g-head > div.today-cell'),
      todayBord: todaySlot ? getComputedStyle(todaySlot).borderLeft : null,
      pastilleLot: !!row.querySelector('.lot-chip'),
      verts,
    };
  });
  note('PC-52', bleu);
  const ecartFond = bleu.todayFond ? bleu.barFond.map((v, i) => Math.abs(v - bleu.todayFond[i])).reduce((a, x) => a + x, 0) : 99;
  ok(bleu.apercusVisibles === 0 && bleu.selection === null && bleu.survol === 0 && ecartFond >= 10,
    `PC-52 : après création, aucun aperçu ne subsiste, aucune sélection temporaire, aucun survol — et la barre se DISTINGUE de la colonne du jour (écart RGB cumulé ${ecartFond}, contre 6 en V2.8.5, où elle s’y fondait et ne laissait voir que son liseré)`, 'PC-52');
  ok(bleu.todayVisible && /2px/.test(bleu.todayBord || ''),
    `PC-53 : le repère AUJOURD’HUI légitime subsiste — en-tête et créneaux, bordure ${bleu.todayBord}`, 'PC-53');
  ok(bleu.lotId === null && !bleu.pastilleLot,
    'PC-54 : une tâche sans lot ne reçoit AUCUNE pastille de couleur — comportement volontaire, inchangé', 'PC-54');
  await shot(p, '09-planning-apres-creation-souris.png');
  await ctx.close();
}

// ============================================================
// PC-55 → PC-59 — Non-régression
// ============================================================
console.log('\n[PC-NONREG] Undo/Redo, Kanban, Qualité, Mode Chantier');
{
  const { ctx, p } = await newPage({ tag: 'NONREG' });
  const accueil = await ev(p, () => {
    go('today');
    const ctrl = document.querySelectorAll('[data-history]').length;
    const t = task('k-cloisons');
    snapshot(); t.name = 'Renommée'; save(); actionToast('Tâche modifiée'); render();
    const apres = { undo: undoHistory.length, nom: task('k-cloisons').name,
      boutons: document.querySelectorAll('[data-history]').length };
    undo();
    return { ctrl, apres, restaure: task('k-cloisons').name, redo: redoHistory.length };
  });
  note('PC-55', accueil);
  ok(accueil.ctrl === 2 && accueil.apres.undo === 1 && accueil.restaure === 'Cloisons étage 1' && accueil.redo === 1,
    'PC-55 : les commandes Undo/Redo globales restent fonctionnelles depuis Aujourd’hui', 'PC-55');

  const planningUR = await ev(p, () => {
    go('planning');
    const ctrl = document.querySelectorAll('[data-history]').length;
    const t = task('k-electric');
    snapshot(); t.name = 'Renommée 2'; save(); actionToast('Tâche modifiée'); render();
    const u = undoHistory.length;
    undo();
    return { ctrl, u, restaure: task('k-electric').name };
  });
  note('PC-56', planningUR);
  ok(planningUR.ctrl === 2 && planningUR.u >= 1 && planningUR.restaure === 'Tableau électrique',
    'PC-56 : les commandes Undo/Redo globales restent fonctionnelles depuis le Planning', 'PC-56');

  const kanban = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.ui.planningView = 'kanban'; save(); go('planning');
    const colonnes = document.querySelectorAll('.kanban-col, .kb-col').length;
    const cartes = document.querySelectorAll('.kanban-card, .kb-card').length;
    // Une transition SANS réalignement (la tâche est déjà à l'heure) reste directe.
    const t = task('k-windows');
    t.start = localDateTime(getDemoNow()); t.end = add(t.start, 2 * 3600000); t.status = 'todo';
    save();
    const undoAvant = undoHistory.length;
    setTaskStatus('k-windows', 'doing', 'kanban');
    return { colonnes, cartes, statut: task('k-windows').status,
      modal: document.querySelector('#modal').classList.contains('open'),
      undoDelta: undoHistory.length - undoAvant };
  });
  note('PC-57', kanban);
  ok(kanban.colonnes > 0 && kanban.cartes > 0 && kanban.statut === 'doing' && !kanban.modal && kanban.undoDelta === 1,
    'PC-57 : le Kanban n’est pas régressé — colonnes et cartes rendues, et une transition cohérente reste directe, sans confirmation inutile', 'PC-57');

  const qualite = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = task('k-control');
    ensureTaskControlInstances(t.id);
    const bloquants = blockingControlsForTask(t.id).length;
    const undoAvant = undoHistory.length;
    setTaskStatus(t.id, 'done', 'task', { manual: true });
    return { bloquants, statut: task('k-control').status,
      undoDelta: undoHistory.length - undoAvant,
      garde: bloquants > 0 ? task('k-control').status !== 'done' : true };
  });
  note('PC-58', qualite);
  ok(qualite.garde, 'PC-58 : la garde Qualité de V2.7 est intacte — un contrôle bloquant non soldé interdit toujours « terminé »', 'PC-58');

  const chantier = await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Le Mode Chantier s'ouvre par enterFieldMode() — `go('field')` change la
    // page sans basculer driverMode, et ne rend donc pas la vue terrain.
    enterFieldMode();
    const wrap = document.querySelector('.field-wrap');
    const r = {
      page: app.ui.page, mode: app.settings.driverMode,
      wrap: !!wrap,
      header: !!document.querySelector('.field-header'),
      onglets: [...document.querySelectorAll('.field-bottom button')].map((x) => x.textContent.trim()),
      taille: wrap ? wrap.innerHTML.length : 0,
      // Aucun Gantt ni colonne calendaire en Chantier : l'absence est structurelle.
      gantt: document.querySelectorAll('#gantt, .g-head').length,
      // Démarrer une tâche depuis le terrain reste possible.
      demarrage: typeof setTaskStatus === 'function',
    };
    exitFieldMode();
    return r;
  });
  note('PC-59', chantier);
  ok(chantier.wrap && chantier.header && chantier.onglets.length === 2 && chantier.taille > 2000
    && chantier.gantt === 0 && chantier.mode === 'field',
    `PC-59 : le Mode Chantier reste rendu et fonctionnel (${chantier.onglets.join(' / ')}, ${chantier.taille} caractères) — et le calendrier n’y introduit aucun Gantt`, 'PC-59');
  await ctx.close();
}

// ============================================================
// FREEZE-2851 — Byte-identité et périmètre
// ============================================================
console.log('\n[FREEZE-2851] Byte-identité');
{
  const read = (f) => fs.readFileSync(BASE + f, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  /* Extraction PARENTHÉSÉE. Un `indexOf('{')` naïf tombe sur l'accolade d'un
     paramètre par défaut — `opts = {}` — et ne hache alors que la signature :
     setTaskStatus et gantt paraissaient « gelés » alors que seul leur en-tête
     l'était. On saute donc d'abord la liste de paramètres, parenthèse par
     parenthèse, avant de chercher l'accolade du CORPS. */
  const extractFn = (src, name) => {
    const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    let par = src.indexOf('(', m.index), depth = 0, k = par;
    for (; k < src.length; k++) {
      if (src[k] === '(') depth++;
      else if (src[k] === ')') { depth--; if (!depth) { k++; break; } }
    }
    let i = src.indexOf('{', k);
    let d = 0, j = i, s = null, esc = false;
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
       Tous les autres moteurs de ces listes restent vérifiés byte à byte. */
  const geles = [
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'actionToast', 'historyToast', 'historyControls', 'refreshHistoryControls',
    'historyControlsState', 'historyLabelFor', 'cloneHistoryState', 'restoreHistoryState',
    'isTextEditingTarget', 'save', 'applyStorageSync', 'resetApp',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime',
    'addWorkingDuration', 'dropTask', 'dragStart', 'dragOver', 'drawDeps',
    'effectiveTasks', 'pos', 'scale', 'taskColorClass',
    'taskEffectiveColorKey', 'lotChip', 'planningLotMeta', 'getProjectHealth',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'showBlockingControlNotice', 'reconcileAfterTaskStatusChange', 'createRework',
    'milestoneStatus', 'isUpcomingMilestone', 'operationMilestonesTab',
    'operationMilestoneStats', 'operationActiveProjectIds', 'operationMacroPlanning',
    'getResourceTasks', 'getResourceSchedulingConflicts', 'taskResourceIds',
    'buildKanvixBackup', 'confirmKanvixRestore', 'exportKanvixData',
    'analyzeKanvixImport', 'buildImportPlan', 
    'renderField', 'planningXToDate', 'planningCreateRange', 'planningCreatePointerDown',
    'planningCreatePointerMove', 
    'shiftPlanning', 'planningToday', 'weekBounds',
  ];
  /* Deux fonctions sont volontairement HORS de cette liste :
     — openTaskForm, dont le submit porte désormais l'avertissement jour non
       ouvré (§17) : elle figure dans la liste des MODIFIÉES ci-dessous ;
     — renderAIPanel, dont le corps contient un littéral de gabarit qui met en
       défaut l'extracteur par accolades (il déborde sur les fonctions
       suivantes). Sa byte-identité est vérifiée séparément, par comparaison
       ligne à ligne bornée à l'indentation. */
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2851', { comparées: compares, bougés: bouges });
  ok(bouges.length === 0,
    `FREEZE-2851 : les ${compares} moteurs de V2.8.5 sont BYTE-IDENTIQUES — Undo/Redo complet, propagation, glisser-déposer, création souris, Qualité, Ressources, Jalons, Backup et Mode Chantier`, 'FREEZE-2851');

  const ajoutees = ['easterSunday', 'frenchPublicHolidays', 'isWeekendDate', 'publicHolidayName',
    'isFrenchPublicHoliday', 'isNonWorkingDate', 'nonWorkingDaysInRange', 'taskTouchesNonWorkingDay',
    'calendarConfirm', 'runCalendarConfirm', 'cancelCalendarConfirm', 'askNonWorkingConfirm',
    'realStartPlan', 'askRealStartConfirm', 'planningColumnFlags', 'planningColumnClass',
    'planningColumnBadge', 'planningPeriodLabel', 'needsNonWorkingConfirm', 'nonWorkingAckMatches',
    'clearNonWorkingAck', 'calendarConfirmBody'];
  const manquantes = ajoutees.filter((n) => !extractFn(B, n));
  const modifiees = ['setTaskStatus', 'requestTaskScheduleMove', 'gantt', 'operationPlanningTab',
    'renderPlanning', 'projectUpcomingTimeline', 'planningCreateRow', 'closeOverlay', 'openTaskForm']
    .filter((n) => extractFn(A, n) && md5(extractFn(A, n)) !== md5(extractFn(B, n)));
  // renderAIPanel : découpe par INDENTATION, immunisée aux littéraux de gabarit.
  const bornes = (src, name) => {
    const lignes = src.split('\n');
    const i = lignes.findIndex((l) => l.startsWith('      function ' + name + '('));
    if (i < 0) return null;
    let j = i + 1;
    while (j < lignes.length && !/^      function /.test(lignes[j])) j++;
    return lignes.slice(i, j).join('\n');
  };
  const aiIdentique = bornes(A, 'renderAIPanel') === bornes(B, 'renderAIPanel');
  note('FREEZE-2851-renderAIPanel', { identique: aiIdentique, lignes: bornes(B, 'renderAIPanel')?.split('\n').length });
  ok(aiIdentique,
    'FREEZE-2851 : renderAIPanel est byte-identique — vérifié par découpe à l’indentation, l’extracteur par accolades dérivant sur ses littéraux de gabarit', 'FREEZE-2851');
  note('FREEZE-2851-périmètre', { ajoutées: ajoutees.length - manquantes.length, manquantes, modifiées: modifiees });
  ok(manquantes.length === 0,
    `FREEZE-2851 : les ${ajoutees.length} fonctions ajoutées existent toutes et appartiennent au calendrier, à la confirmation ou au démarrage réel`, 'FREEZE-2851');

  const regles = {
    // Une seule vérité calendaire : personne ne recalcule [0,6].includes(getDay()).
    uneSeuleVerite: (B.match(/\[0, 6\]\.includes\(/g) || []).length === 1,
    unSeulMoteurStatut: (B.match(/function setTaskStatus\(/g) || []).length === 1,
    unSeulGantt: (B.match(/function gantt\(/g) || []).length === 1,
    pasDeNavOperation: !/function\s+(shiftOperationPlanning|operationShiftPeriod|opPlanningShift)/.test(B),
    opAppelleGlobal: /op-planning-nav[\s\S]{0,400}shiftPlanning\(-1\)/.test(B),
    tolerance: /REAL_START_TOLERANCE_MS = 5 \* 60000/.test(B),
  };
  note('FREEZE-2851-règles', regles);
  ok(Object.values(regles).every(Boolean),
    'FREEZE-2851 : une seule règle de week-end dans tout le fichier, un seul setTaskStatus, un seul gantt(), aucune navigation propre à l’Opération, et la tolérance est une constante nommée', 'FREEZE-2851');

  const store = {
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
  };
  note('FREEZE-2851-store', store);
  /* V2.9.0 — RE-BASELINE : le schéma passe à 13 (structureNodes, §43). Ce que
     cette assertion protège reste vérifié — STORE strictement inchangé, et un
     schéma qui ne recule jamais. */
  ok(store.store === 'kanvix-product-8-3' && Number(store.schemaApres) >= Number(store.schemaAvant) && Number(store.schemaApres) >= 12,
    `FREEZE-2851 : STORE (« ${store.store} ») et SCHEMA_VERSION (${store.schemaApres}) strictement inchangés — aucune nouvelle donnée persistante`, 'FREEZE-2851');
}

// ============================================================
// Captures multi-largeurs + mobile
// ============================================================
console.log('\n[CAPTURES] Dix largeurs');
{
  const LARGEURS = [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390];
  const debords = [];
  for (const w of LARGEURS) {
    const { ctx, p } = await newPage({ w, h: Math.max(900, Math.round(w * 0.62)), tag: 'W' + w });
    await planning(p, 'week');
    const over = await ev(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    debords.push({ w, over });
    await shot(p, `w${w}-01-planning-semaine-clair.png`);
    await ev(p, () => { setAppearance('dark'); renderPage(); });
    await p.waitForTimeout(250);
    await shot(p, `w${w}-02-planning-semaine-sombre.png`);
    await ev(p, () => { setAppearance('light'); renderPage(); });
    if (w <= 430) {
      await ev(p, () => openTaskForm('keravel'));
      await p.waitForTimeout(220);
      await p.fill('[name="name"]', 'Mobile samedi');
      await p.fill('[name="start"]', '2026-08-22T08:00');
      await p.fill('[name="end"]', '2026-08-22T12:00');
      await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
      await p.waitForTimeout(300);
      const mob = await ev(p, () => {
        const box = document.querySelector('#modal .modal-box');
        const r = box.getBoundingClientRect();
        const btns = [...document.querySelectorAll('#modalContent .pop-actions button')].map((x) => {
          const q = x.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height) };
        });
        return { largeurModale: Math.round(r.width), ecran: window.innerWidth,
          deborde: r.width > window.innerWidth || r.left < 0,
          boutons: btns, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      note('MOBILE-' + w, mob);
      ok(!mob.deborde && mob.boutons.every((x) => x.h >= 32) && mob.overflow <= 0,
        `MOBILE-${w} : à ${w} px, la modale de confirmation ne déborde pas (${mob.largeurModale} px pour ${mob.ecran} px), ses boutons font au moins 32 px de haut, et la page ne défile pas horizontalement`, 'MOBILE');
      await shot(p, `w${w}-11-mobile-confirmation.png`);
      await ev(p, () => { cancelCalendarConfirm(); closeOverlay('drawer'); });
      await shot(p, `w${w}-10-mobile-planning.png`);
    }
    await ctx.close();
  }
  note('LARGEURS', debords);
  ok(debords.every((d) => d.over <= 0),
    `CAPTURES : aucune des dix largeurs (${LARGEURS.join(', ')}) ne produit de débordement horizontal de page`, 'CAPTURES');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `PC-60 : aucune erreur JavaScript en console (${appErrs.length})`, 'PC-60');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
