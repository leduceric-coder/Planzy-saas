// ============================================================
// KANVIX — Recette correctifs Planning / UI (V2.4.15.6)
//   Retour utilisateur :
//   1) Vue Jour : ne démarrait pas à l'heure en cours EN DEHORS de 08h–18h
//      (le soir, la journée entière était réaffichée depuis 08h).
//   2) Flèche « ← » : doit permettre de voir les tâches passées (vérification
//      + accès aux heures déjà écoulées de la journée en cours).
//   3) Menu profil (paramètres) : passait SOUS le planning, doit toujours
//      passer au-dessus.
//   4) Vue Année : élargir les colonnes quand il le faut pour afficher les
//      noms de tâches (« Doublage mu… » tronqué).
//   Usage : node recette-correctifs-v2.4.15.6.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const F = (now) => 'file://' + BASE + 'kanvix-next-gen-v2.4.15.6.html?now=' + now;
const MORNING = '2026-09-14T10:15:00';
const EVENING = '2026-09-14T19:30:00';
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.6/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 700)}`);
const allErrs = [];
async function newPage(now = MORNING, w = 1440, h = 900, tag = 'x') {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
  await p.goto(F(now), { waitUntil: 'load' });
  await p.evaluate(() => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); go('planning'); });
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const dayScale = (p) =>
  ev(p, () => {
    app.settings.period = 'day';
    app.ui.periodAnchor = TODAY;
    app.ui.planningDayFull = null;
    save();
    renderPage();
    const s = scale();
    return { first: s.labels[0], firstTime: s.dates[0].slice(11), slots: s.labels.length, todayIndex: s.todayIndex, end: s.end };
  });

// ============================================================
// 1) VUE JOUR — démarre à l'heure en cours, y compris hors 08h–18h
// ============================================================
console.log('\n[JOUR-1516] Vue Jour — la 1ʳᵉ colonne est l’heure en cours, même en dehors de la journée de travail');
{
  const { ctx, p } = await newPage(MORNING, 1440, 900, 'J-matin');
  const i = await dayScale(p);
  note('JOUR-1516-10h15', i);
  ok(i.firstTime === '10:00' && i.first === '10h', 'JOUR-1516 : à 10h15, la vue démarre à 10h', 'JOUR-1516');
  ok(i.todayIndex === 0, 'JOUR-1516 : le marqueur AUJOURD’HUI est sur la 1ʳᵉ colonne', 'JOUR-1516');
  await ctx.close();
}
{
  // LE CAS SIGNALÉ : en soirée, la vue repartait de 08h (toute la journée).
  const { ctx, p } = await newPage(EVENING, 1440, 900, 'J-soir');
  const i = await dayScale(p);
  note('JOUR-1516-19h30', i);
  ok(i.firstTime === '19:00' && i.first === '19h', 'JOUR-1516-soir : à 19h30, la vue démarre à 19h (et non plus à 08h)', 'JOUR-1516');
  ok(i.todayIndex >= 0, 'JOUR-1516-soir : le repère AUJOURD’HUI est présent dans la fenêtre du soir', 'JOUR-1516');
  ok(i.slots >= 4, 'JOUR-1516-soir : la fenêtre du soir reste lisible (plusieurs créneaux)', 'JOUR-1516');
  await p.screenshot({ path: SHOTS + '01-jour-soir.png' });
  await ctx.close();
}
{
  const { ctx, p } = await newPage('2026-09-14T23:20:00', 1440, 900, 'J-nuit');
  const i = await dayScale(p);
  note('JOUR-1516-23h20', i);
  ok(i.firstTime === '23:00', 'JOUR-1516-nuit : à 23h20, la vue démarre à 23h et s’arrête à minuit', 'JOUR-1516');
  await ctx.close();
}
{
  // Avant l'ouverture du chantier : la journée de travail entière, sans « passé ».
  const { ctx, p } = await newPage('2026-09-14T06:10:00', 1440, 900, 'J-aube');
  const i = await dayScale(p);
  note('JOUR-1516-06h10', i);
  ok(i.firstTime === '08:00' && i.slots === 20, 'JOUR-1516-aube : avant 08h, la journée de travail complète est proposée', 'JOUR-1516');
  await ctx.close();
}

// ============================================================
// 2) FLÈCHE ← — accès aux tâches passées
// ============================================================
console.log('\n[RETOUR-1516] La flèche ← donne bien accès aux tâches passées');
{
  const { ctx, p } = await newPage(EVENING, 1440, 900, 'RETOUR');
  const r = await ev(p, () => {
    const out = {};
    app.settings.period = 'day'; app.ui.periodAnchor = TODAY; app.ui.planningDayFull = null; save(); renderPage();
    out.depart = { first: scale().dates[0], rows: document.querySelectorAll('.g-row').length };
    shiftPlanning(-1);
    out.retour1 = { first: scale().dates[0], rows: document.querySelectorAll('.g-row').length, jour: app.ui.periodAnchor.slice(0, 10) };
    shiftPlanning(-1);
    out.retour2 = { first: scale().dates[0], jour: app.ui.periodAnchor.slice(0, 10) };
    planningToday();
    out.aujourdhui = { first: scale().dates[0], jour: app.ui.periodAnchor.slice(0, 10) };
    return out;
  });
  note('RETOUR-1516-jour', r);
  ok(r.retour1.first.slice(11) === '08:00' && r.retour1.jour === r.depart.first.slice(0, 10),
    'RETOUR-1516 : un 1ᵉʳ « ← » rouvre le DÉBUT de la journée en cours (heures déjà écoulées accessibles)', 'RETOUR-1516');
  ok(r.retour1.rows > r.depart.rows, 'RETOUR-1516 : ce retour révèle bien des tâches supplémentaires (déjà passées aujourd’hui)', 'RETOUR-1516');
  ok(r.retour2.jour < r.retour1.jour, 'RETOUR-1516 : un 2ᵉ « ← » passe à la veille', 'RETOUR-1516');
  ok(r.aujourdhui.first.slice(11) === '19:00', 'RETOUR-1516 : « Aujourd’hui » revient à la vue « à partir de maintenant »', 'RETOUR-1516');

  const per = await ev(p, () => {
    const out = {};
    for (const x of ['week', 'month', 'year']) {
      app.settings.period = x; app.ui.periodAnchor = TODAY; save(); renderPage();
      const before = scale().dates[0];
      shiftPlanning(-1);
      out[x] = { before, after: scale().dates[0], recule: date(scale().dates[0]) < date(before) };
    }
    return out;
  });
  note('RETOUR-1516-periodes', per);
  ok(['week', 'month', 'year'].every((x) => per[x].recule), 'RETOUR-1516 : « ← » recule bien la fenêtre en Semaine, Mois et Année (périodes passées consultables)', 'RETOUR-1516');
  await ctx.close();
}

// ============================================================
// 3) MENU PROFIL — toujours au-dessus du planning
// ============================================================
console.log('\n[MENU-1516] Le menu profil (paramètres) passe au-dessus du planning');
{
  const { ctx, p } = await newPage(MORNING, 1440, 900, 'MENU');
  const r = await ev(p, () => {
    app.settings.period = 'week'; save(); renderPage();
    toggleUserMenu();
    const pop = document.querySelector('.user-popover');
    const pr = pop.getBoundingClientRect();
    const mainLeft = document.querySelector('#main').getBoundingClientRect().left;
    // points du popover situés AU-DESSUS de la zone planning
    const pts = [[pr.right - 6, pr.top + 30], [pr.right - 6, pr.bottom - 40], [pr.right - 20, pr.top + pr.height / 2]];
    const hits = pts.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? (pop.contains(el) ? 'popover' : 'AUTRE:' + (el.className || el.tagName)) : 'null';
    });
    return { open: pop.classList.contains('open'), chevauche: pr.right > mainLeft, hits, sidebarZ: getComputedStyle(document.querySelector('.sidebar')).zIndex };
  });
  note('MENU-1516', r);
  ok(r.open && r.chevauche, 'MENU-1516 : le menu est ouvert et déborde bien sur la zone planning (condition du scénario)', 'MENU-1516');
  ok(r.hits.every((h) => h === 'popover'), 'MENU-1516 : sur toute sa surface au-dessus du planning, c’est le menu qui reçoit le clic (il ne passe plus dessous)', 'MENU-1516');
  ok(r.sidebarZ !== 'auto' && Number(r.sidebarZ) > 9, 'MENU-1516 : la barre latérale est empilée au-dessus du Gantt (son contexte n’enferme plus le menu)', 'MENU-1516');
  await p.screenshot({ path: SHOTS + '02-menu-au-dessus.png' });
  await ctx.close();
}
{
  // Le menu reste SOUS les surcouches (modal/drawer) : la hiérarchie est respectée.
  const { ctx, p } = await newPage(MORNING, 1440, 900, 'MENU-Z');
  const z = await ev(p, () => {
    const val = (sel) => getComputedStyle(document.querySelector(sel)).zIndex;
    return { sidebar: Number(val('.sidebar')), modal: Number(val('#modal')), drawer: Number(val('#drawer')), toast: Number(val('#toast')) };
  });
  note('MENU-1516-z', z);
  ok(z.sidebar < z.modal && z.sidebar < z.drawer && z.sidebar < z.toast, 'MENU-1516 : la barre latérale reste sous les modales, tiroirs et toasts (aucune inversion)', 'MENU-1516');
  await ctx.close();
}

// ============================================================
// 4) VUE ANNÉE — colonnes élargies pour afficher les noms de tâches
// ============================================================
console.log('\n[ANNEE-1516] Vue Année — les colonnes s’élargissent pour afficher les noms de tâches');
{
  const { ctx, p } = await newPage(MORNING, 1440, 900, 'ANNEE');
  const r = await ev(p, () => {
    app.settings.period = 'year'; app.ui.periodAnchor = TODAY; save(); renderPage();
    const g = document.querySelector('.gantt');
    const bars = [...document.querySelectorAll('.g-bar:not(.ghost):not(.baseline)')];
    return {
      colMin: getComputedStyle(g).getPropertyValue('--col-min').trim(),
      bars: bars.length,
      tronques: bars.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim()),
      premierMois: scale().labels[0],
      todayIndex: scale().todayIndex,
    };
  });
  note('ANNEE-1516', r);
  ok(parseInt(r.colMin, 10) > 94, 'ANNEE-1516 : les colonnes de la vue Année sont élargies au-delà des 94px par défaut', 'ANNEE-1516');
  ok(r.bars > 0 && r.tronques.length === 0, 'ANNEE-1516 : plus aucun nom de tâche tronqué dans la vue Année', 'ANNEE-1516');
  ok(r.premierMois === 'sept.' && r.todayIndex === 0, 'ANNEE-1516 : l’ancrage sur le mois en cours (V2.4.15.5) reste acquis', 'ANNEE-1516');
  await p.screenshot({ path: SHOTS + '03-annee-noms.png' });
  await ctx.close();
}
{
  // L'élargissement est CONTEXTUEL : les autres échelles gardent 94px.
  const { ctx, p } = await newPage(MORNING, 1440, 900, 'ANNEE-autres');
  const r = await ev(p, () => {
    const out = {};
    for (const x of ['day', 'week', 'month']) {
      app.settings.period = x; app.ui.periodAnchor = TODAY; save(); renderPage();
      out[x] = getComputedStyle(document.querySelector('.gantt')).getPropertyValue('--col-min').trim();
    }
    return out;
  });
  note('ANNEE-1516-autres', r);
  ok(['day', 'week', 'month'].every((x) => parseInt(r[x], 10) === 94), 'ANNEE-1516 : Jour / Semaine / Mois conservent la largeur de colonne d’origine (94px)', 'ANNEE-1516');
  await ctx.close();
}

// ============================================================
// NON-RÉGRESSION — acquis des rounds précédents
// ============================================================
console.log('\n[NONREG-1516] Acquis V2.4.15.5 conservés (ancrage Semaine/Mois, n° ISO, nom de chantier épinglé)');
{
  const { ctx, p } = await newPage(MORNING, 1200, 850, 'NONREG');
  const r = await ev(p, () => {
    const out = {};
    app.settings.period = 'week'; app.ui.periodAnchor = TODAY; save(); renderPage();
    out.week = { first: scale().labels[0], todayIndex: scale().todayIndex };
    app.settings.period = 'month'; save(); renderPage();
    out.month = { first: scale().labels[0], todayIndex: scale().todayIndex };
    app.settings.period = 'year'; save(); renderPage();
    const wrap = document.querySelector('.gantt-wrap');
    wrap.scrollLeft = wrap.scrollWidth;
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const wr = wrap.getBoundingClientRect();
      const btn = document.querySelector('.g-project button');
      const br = btn.getBoundingClientRect();
      out.nom = { offset: Math.round(br.left - wr.left), visible: br.left >= wr.left - 1 && br.right <= wr.right + 1, font: parseFloat(getComputedStyle(btn).fontSize) };
      res(out);
    })));
  });
  note('NONREG-1516', r);
  ok(r.week.todayIndex === 0, 'NONREG-1516 : Semaine démarre toujours sur le jour courant', 'NONREG-1516');
  ok(/^S\d+ · \d+$/.test(r.month.first) && r.month.todayIndex === 0, 'NONREG-1516 : Mois démarre toujours sur la semaine en cours avec le n° ISO', 'NONREG-1516');
  ok(r.nom.visible && r.nom.offset < 40 && r.nom.font >= 15, 'NONREG-1516 : le nom de chantier reste épinglé et agrandi en vue Année défilée', 'NONREG-1516');
  await ctx.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1516]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|nominatim|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1516', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1516 : 0 erreur JavaScript applicative', 'CONSOLE-1516');
}

// ============================================================
// ENGINES — byte-identité des moteurs NON concernés
// ============================================================
console.log('\n[ENGINES-1516] Byte-identité des moteurs métier (V2.4.15.5 → V2.4.15.6)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.5.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.6.html', 'utf8');
  function extractFn(src, name) {
    const re = new RegExp(`function\\s+${name}\\s*\\(`);
    const m = re.exec(src);
    if (!m) return null;
    let j = src.indexOf('(', m.index), depthP = 0;
    for (; j < src.length; j++) {
      if (src[j] === '(') depthP++;
      else if (src[j] === ')') { depthP--; if (depthP === 0) { j++; break; } }
    }
    let i = src.indexOf('{', j);
    if (i < 0) return null;
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
    }
    return null;
  }
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
  const engines = [
    'planReflow', 'applyReflowPlan', 'setTaskStatus', 'kanbanDrop', 'dropTask', 'requestTaskScheduleMove',
    'scenarioOptions', 'evaluateScenario', 'applySimulation', 'historyProjectId', 'projectHistory',
    'historyStamp', 'historyGroups', 'buildKanvixBackup', 'confirmKanvixRestore', 'validateKanvixBackup',
    'reopenProject', 'archiveProjectPrompt', 'restoreProject', 'confirmCloseProject',
    'kanbanCard', 'kanbanBoard', 'getProjectSummary', 'art', 'projectVisual', 'projectCardMenu',
    'getResourceState', 'getResourcePeriodState', 'getResourceLoad', 'getMaxConcurrentTasks',
    'getResourceWeekDays', 'getCurrentWeekRange', 'siteCard', 'pos', 'hasReworkSignaled',
    'planningTasks', 'renderPlanning', 'setPeriod', 'toggleUserMenu', 'renderUserMenu',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1516 : moteurs métier et rendus non concernés byte-identiques', 'ENGINES-1516');

  const changed = ['scale', 'shiftPlanning', 'planningToday', 'gantt'];
  let allChanged = true;
  for (const name of changed) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const same = a && c && md5(a) === md5(c);
    if (same) allChanged = false;
    console.log(`  ${!same ? '✓ (changé)' : '✗ (identique, inattendu)'} ${name}`);
  }
  ok(allChanged, 'ENGINES-1516 : scale/shiftPlanning/planningToday/gantt ont bien changé (fenêtre Jour, retour arrière, largeur Année)', 'ENGINES-1516');
}

// ============================================================
// STORE / SCHÉMA
// ============================================================
{
  const src = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.6.html', 'utf8');
  ok(/STORE = "kanvix-product-8-3"/.test(src), 'STORE-1516 : STORE inchangé', 'STORE-1516');
  ok(/SCHEMA_VERSION = 8\b/.test(src), 'STORE-1516 : SCHEMA_VERSION = 8 inchangé', 'STORE-1516');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
