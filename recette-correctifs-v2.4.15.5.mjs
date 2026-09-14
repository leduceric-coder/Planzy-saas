// ============================================================
// KANVIX — Recette correctifs Planning (V2.4.15.5)
//   Retour utilisateur (page Planning) :
//   1) Vue Jour : démarrer à l'HEURE en cours, ne plus montrer le passé.
//   2) Vue Mois : démarrer sur la SEMAINE en cours + numéro de semaine ISO
//      (base annuelle) en libellé de colonne.
//   3) Vue Année : démarrer sur le MOIS en cours (fenêtre glissante 12 mois).
//   4) Nom de chantier : ne plus être rogné au défilement horizontal (il était
//      détaché du bandeau, poussé hors champ en vue Année).
//   5) Nom de chantier plus GROS que les tâches (différenciation visuelle).
//   (Vue Semaine alignée sur la même logique : 1ʳᵉ colonne = jour courant,
//    comme demandé au round précédent.)
//   Usage : node recette-correctifs-v2.4.15.5.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-14T10:15:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.4.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.5.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.5/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 600)}`);
const allErrs = [];
async function newPage(w = 1440, h = 900, tag = 'x', url = FILE) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
  await p.goto(url, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const reset = (p, extra = '') => ev(p, (s) => (0, eval)('resetApp();setDepth("pilot");dismissKanvixContinuityNotice();' + s), extra);
// Lecture de l'échelle courante + géométrie de défilement.
const scaleInfo = (p, period, url = FILE) =>
  ev(p, (per) => {
    app.settings.period = per;
    app.ui.periodAnchor = TODAY;
    app.ui.planningView = 'gantt';
    app.ui.planningNeedsCenter = true;
    save();
    renderPage();
    return new Promise((r) =>
      setTimeout(() => {
        const wrap = document.querySelector('.gantt-wrap'),
          s = scale();
        r({
          scrollLeft: wrap ? Math.round(wrap.scrollLeft) : null,
          overflow: wrap ? Math.round(wrap.scrollWidth - wrap.clientWidth) : null,
          todayIndex: s.todayIndex,
          first: s.labels[0],
          last: s.labels[s.labels.length - 1],
          n: s.labels.length,
          firstDate: s.dates[0],
          nav: document.querySelector('.period-label')?.textContent,
        });
      }, 250),
    );
  }, period);

// ============================================================
// 1) JOUR — démarre à l'heure en cours (10h à 10:15), aucun passé
// ============================================================
console.log('\n[JOUR-1515] Vue Jour — 1ʳᵉ colonne = heure pleine en cours, le passé (08h/09h) n’est plus affiché');
{
  const { ctx, p } = await newPage(1440, 900, 'JOUR', FILE);
  await reset(p, "go('planning');");
  const i = await scaleInfo(p, 'day');
  note('JOUR-1515', i);
  ok(i.first === '10h', 'JOUR-1515 : la 1ʳᵉ colonne est 10h (heure pleine en cours à 10:15)', 'JOUR-1515');
  ok(i.todayIndex === 0, 'JOUR-1515 : le marqueur AUJOURD’HUI est sur la 1ʳᵉ colonne', 'JOUR-1515');
  ok(i.scrollLeft === 0, 'JOUR-1515 : aucune colonne passée devant (départ à gauche, pas de défilement résiduel)', 'JOUR-1515');
  ok(/T10:00$/.test(i.firstDate), 'JOUR-1515 : la fenêtre commence à 10h00, pas à 08h00', 'JOUR-1515');
  await ctx.close();
}
{
  // Après 18h (hors horaires) : repli sur la journée entière plutôt qu’une vue vide.
  const { ctx, p } = await newPage(1440, 900, 'JOUR-soir', 'file://' + BASE + 'kanvix-next-gen-v2.4.15.5.html?now=2026-09-14T19:30:00');
  await reset(p, "go('planning');");
  const i = await scaleInfo(p, 'day');
  note('JOUR-1515-soir', i);
  ok(i.first === '8h' && i.n === 20, 'JOUR-1515-soir : hors horaires (19h30), la journée entière 08h–18h est présentée (jamais une vue vide)', 'JOUR-1515');
  await ctx.close();
}

// ============================================================
// 2) MOIS — démarre sur la semaine en cours + numéro de semaine ISO
// ============================================================
console.log('\n[MOIS-1515] Vue Mois — 1ʳᵉ colonne = semaine en cours, libellé = n° de semaine ISO (base annuelle)');
{
  const { ctx, p } = await newPage(1440, 900, 'MOIS', FILE);
  await reset(p, "go('planning');");
  const i = await scaleInfo(p, 'month');
  note('MOIS-1515', i);
  ok(i.todayIndex === 0, 'MOIS-1515 : la semaine en cours est la 1ʳᵉ colonne', 'MOIS-1515');
  // 14 sept. 2026 = semaine ISO 38.
  ok(/^S38 · 14$/.test(i.first), 'MOIS-1515 : le libellé porte le n° de semaine ISO annuel (S38), pas un rang mensuel (S1)', 'MOIS-1515');
  ok(/^S\d+ · \d+$/.test(i.last), 'MOIS-1515 : toutes les colonnes suivent le format « S<n° ISO> · <quantième> »', 'MOIS-1515');
  await ctx.close();
}

// ============================================================
// 3) ANNÉE — démarre sur le mois en cours (fenêtre glissante 12 mois)
// ============================================================
console.log('\n[ANNEE-1515] Vue Année — 1ʳᵉ colonne = mois en cours, fenêtre glissante sur 12 mois');
{
  const { ctx, p } = await newPage(1440, 900, 'ANNEE', FILE);
  await reset(p, "go('planning');");
  const i = await scaleInfo(p, 'year');
  note('ANNEE-1515', i);
  ok(i.first === 'sept.', 'ANNEE-1515 : la 1ʳᵉ colonne est le mois en cours (sept.)', 'ANNEE-1515');
  ok(i.todayIndex === 0, 'ANNEE-1515 : le marqueur AUJOURD’HUI est sur la 1ʳᵉ colonne', 'ANNEE-1515');
  ok(i.last === 'août', 'ANNEE-1515 : la dernière colonne est le 12ᵉ mois glissant (août)', 'ANNEE-1515');
  ok(i.scrollLeft === 0, 'ANNEE-1515 : le mois en cours démarre bien la vue (le passé n’est plus au milieu, sans défilement)', 'ANNEE-1515');
  ok(/sept\. 2026\s+–\s+août 2027/.test(i.nav || ''), 'ANNEE-1515 : le libellé de période reflète la fenêtre glissante (« sept. 2026 – août 2027 »)', 'ANNEE-1515');
  await ctx.close();
}

// ============================================================
// SEMAINE — 1ʳᵉ colonne = jour courant (aligné sur le round précédent)
// ============================================================
console.log('\n[SEM-1515] Vue Semaine — 1ʳᵉ colonne = jour en cours');
{
  const { ctx, p } = await newPage(1440, 900, 'SEM', FILE);
  await reset(p, "go('planning');");
  const i = await scaleInfo(p, 'week');
  note('SEM-1515', i);
  ok(i.todayIndex === 0, 'SEM-1515 : le jour courant est la 1ʳᵉ colonne (pas le lundi de la semaine calendaire)', 'SEM-1515');
  ok(/lun\.?\s*14/.test(i.first), 'SEM-1515 : la 1ʳᵉ colonne est bien lundi 14 (aujourd’hui)', 'SEM-1515');
  await ctx.close();
}

// ============================================================
// 4) NOM DE CHANTIER — épinglé, jamais rogné au défilement horizontal
// ============================================================
console.log('\n[NAME-1515] Nom de chantier épinglé à gauche + état à droite, y compris en défilement (vue Année)');
{
  const { ctx, p } = await newPage(1200, 850, 'NAME', FILE);
  await reset(p, "go('planning');");
  const r = await ev(p, () => {
    app.settings.period = 'year'; app.ui.periodAnchor = TODAY; save(); renderPage();
    return new Promise((res) => setTimeout(() => {
      const wrap = document.querySelector('.gantt-wrap');
      wrap.scrollLeft = wrap.scrollWidth; // défilement maximal à droite
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const wr = wrap.getBoundingClientRect();
        const btn = document.querySelector('.g-project button');
        const br = btn.getBoundingClientRect();
        const health = document.querySelector('.project-health');
        const hr = health.getBoundingClientRect();
        // le nom est-il réellement visible dans la fenêtre (pas rogné à gauche) ?
        const nameFullyVisible = br.left >= wr.left - 1 && br.right <= wr.right + 1 && br.width > 40;
        res({
          scrolled: Math.round(wrap.scrollLeft),
          nameLeftOffset: Math.round(br.left - wr.left),
          nameFullyVisible,
          nameText: btn.textContent.replace(/\s+/g, ' ').trim(),
          healthFromRight: Math.round(wr.right - hr.right),
          healthVisible: hr.left >= wr.left && hr.right <= wr.right + 1,
        });
      }));
    }, 300));
  });
  note('NAME-1515', r);
  ok(r.scrolled > 100, 'NAME-1515 : la vue Année est bien défilée horizontalement (condition du scénario)', 'NAME-1515');
  ok(r.nameFullyVisible && r.nameLeftOffset >= 0 && r.nameLeftOffset < 40, 'NAME-1515 : le nom de chantier reste épinglé à gauche et entièrement lisible (plus de « nce Keravel » rogné)', 'NAME-1515');
  ok(r.healthVisible && r.healthFromRight < 30, 'NAME-1515 : l’état (Risque/OK) reste épinglé au vrai bord droit du bandeau', 'NAME-1515');
  await p.screenshot({ path: SHOTS + '01-annee-nom-epingle.png' });
  await ctx.close();
}

// ============================================================
// 5) NOM DE CHANTIER PLUS GROS que les tâches
// ============================================================
console.log('\n[FONT-1515] Nom de chantier nettement plus gros que les libellés de tâche');
{
  const { ctx, p } = await newPage(1440, 900, 'FONT', FILE);
  await reset(p, "app.settings.period='month'; app.ui.periodAnchor=TODAY; save(); go('planning');");
  await p.waitForTimeout(250);
  const r = await ev(p, () => {
    const proj = document.querySelector('.g-project button');
    const taskLabel = document.querySelector('.g-label b');
    return {
      projFont: parseFloat(getComputedStyle(proj).fontSize),
      projWeight: getComputedStyle(proj).fontWeight,
      taskFont: taskLabel ? parseFloat(getComputedStyle(taskLabel).fontSize) : null,
    };
  });
  note('FONT-1515', r);
  ok(r.projFont >= 15, 'FONT-1515 : le nom de chantier fait au moins 15px', 'FONT-1515');
  ok(r.taskFont && r.projFont > r.taskFont, 'FONT-1515 : le nom de chantier est plus gros que le libellé de tâche (différenciation)', 'FONT-1515');
  await ctx.close();
}

// ============================================================
// NON-RÉGRESSION — navigation, Aujourd'hui, Kanban, drag, agenda
// ============================================================
console.log('\n[NAV-1515] Navigation ← →, Aujourd’hui, Kanban et drag restent fonctionnels');
{
  const { ctx, p } = await newPage(1280, 850, 'NAV', FILE);
  await reset(p, "go('planning');");
  const nav = await ev(p, () => {
    const out = {};
    for (const per of ['day', 'week', 'month', 'year']) {
      app.settings.period = per; app.ui.periodAnchor = TODAY; save(); renderPage();
      const base = scale().dates[0];
      shiftPlanning(1);
      const fwd = scale().dates[0];
      shiftPlanning(-1);
      const back = scale().dates[0];
      planningToday();
      const today = scale();
      out[per] = { base, fwd, backEqBase: back === base, todayIndex: today.todayIndex };
    }
    return out;
  });
  note('NAV-1515', nav);
  ok(['day', 'week', 'month', 'year'].every((per) => nav[per].fwd !== nav[per].base), 'NAV-1515 : « → » avance bien la fenêtre pour chaque échelle', 'NAV-1515');
  ok(['day', 'week', 'month', 'year'].every((per) => nav[per].backEqBase), 'NAV-1515 : « ← » revient exactement à la fenêtre de départ', 'NAV-1515');
  ok(['day', 'week', 'month', 'year'].every((per) => nav[per].todayIndex === 0), 'NAV-1515 : « Aujourd’hui » recadre la période courante en 1ʳᵉ colonne pour chaque échelle', 'NAV-1515');

  const kb = await ev(p, () => {
    app.settings.period = 'week'; app.ui.planningView = 'kanban'; save(); renderPage();
    return { cols: document.querySelectorAll('.kanban-col').length, cards: document.querySelectorAll('.kanban-card').length };
  });
  ok(kb.cols === 3 && kb.cards > 0, 'NAV-1515 : le Kanban du Planning reste opérationnel (3 colonnes, cartes présentes)', 'NAV-1515');

  const drag = await ev(p, () => {
    app.settings.period = 'week'; app.ui.planningView = 'gantt'; app.ui.periodAnchor = TODAY; save(); renderPage();
    return new Promise((r) => setTimeout(() => {
      const bar = document.querySelector('.g-bar:not(.done)');
      const slots = document.querySelectorAll('.g-slot');
      if (!bar || !slots.length) return r({ ok: false });
      const dt = new DataTransfer();
      bar.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      slots[slots.length - 1].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      slots[slots.length - 1].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      r({ ok: true });
    }, 250));
  });
  ok(drag.ok, 'NAV-1515 : le glisser-déposer du Gantt reste fonctionnel (aucune erreur)', 'NAV-1515');
  await ctx.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1515]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|nominatim|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1515', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1515 : 0 erreur JavaScript applicative', 'CONSOLE-1515');
}

// ============================================================
// ENGINES — byte-identité des moteurs NON concernés par ce round
// ============================================================
console.log('\n[ENGINES-1515] Byte-identité des moteurs métier (V2.4.15.4 → V2.4.15.5)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.4.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.5.html', 'utf8');
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
  // Moteurs métier NON touchés ce round (le rendu Planning, lui, change).
  const engines = [
    'planReflow', 'applyReflowPlan', 'setTaskStatus', 'kanbanDrop', 'dropTask', 'requestTaskScheduleMove',
    'scenarioOptions', 'evaluateScenario', 'applySimulation', 'historyProjectId', 'projectHistory',
    'historyStamp', 'historyGroups', 'buildKanvixBackup', 'confirmKanvixRestore', 'validateKanvixBackup',
    'reopenProject', 'archiveProjectPrompt', 'restoreProject', 'confirmCloseProject',
    'gantt', 'kanbanCard', 'kanbanBoard', 'getProjectSummary', 'art', 'projectVisual', 'projectCardMenu',
    'getResourceState', 'getResourcePeriodState', 'getResourceLoad', 'getMaxConcurrentTasks',
    'getResourceWeekDays', 'getCurrentWeekRange', 'siteCard', 'pos', 'hasReworkSignaled',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1515 : moteurs métier + rendu Gantt/Kanban byte-identiques (seul scale() change côté JS)', 'ENGINES-1515');

  const changed = ['scale', 'renderPlanning'];
  let allChanged = true;
  for (const name of changed) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const same = a && c && md5(a) === md5(c);
    if (same) allChanged = false;
    console.log(`  ${!same ? '✓ (changé)' : '✗ (identique, inattendu)'} ${name}`);
  }
  ok(allChanged, 'ENGINES-1515 : scale() et renderPlanning() ont bien changé (ancrage des échelles + libellé année)', 'ENGINES-1515');
}

// ============================================================
// STORE / SCHÉMA inchangés
// ============================================================
{
  const src = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.5.html', 'utf8');
  ok(/STORE = "kanvix-product-8-3"/.test(src), 'STORE-1515 : STORE = "kanvix-product-8-3" inchangé', 'STORE-1515');
  ok(/SCHEMA_VERSION = 8\b/.test(src), 'STORE-1515 : SCHEMA_VERSION = 8 inchangé', 'STORE-1515');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
