// ============================================================
// KANVIX — Recette badges Kanban « À TRAITER » vs « SOUS IMPACT » (V2.4.11.1)
//   Usage : node recette-kanban-badges-v2.4.11.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.11.1.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-kanban-badges-v2.4.11.1/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
const allErrs = [];
async function newPage(w = 1440, h = 900, tag = 'x') {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// Ouvre le Kanban du Planning en profondeur « pilot ».
const openKanban = async (p) => {
  await ev(p, () => { setDepth('pilot'); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(200);
};

// Lit, pour chaque carte Kanban : nom de tâche, colonne, badges présents.
const readCards = (p) => ev(p, () => {
  const out = {};
  document.querySelectorAll('.kanban-col').forEach((col) => {
    const st = col.getAttribute('data-status');
    col.querySelectorAll('.kanban-card').forEach((c) => {
      const name = c.querySelector('b').textContent.trim();
      out[name] = {
        col: st,
        attention: !!c.querySelector('.kanban-badge.attention'),
        impacted: !!c.querySelector('.kanban-badge.impacted'),
        rework: !!c.querySelector('.kanban-badge.rework'),
        labels: [...c.querySelectorAll('.kanban-badge')].map((x) => x.innerText.trim()),
      };
    });
  });
  return out;
});

// Construit un jeu de données déterministe : chaîne A → B → C sur Keravel,
// aucun autre incident ouvert, période large pour que tout soit visible.
const SCENARIO = `
  resetApp();
  setDepth('pilot');
  // Scénario déterministe SANS suppression de données (intégrité référentielle
  // préservée) : on neutralise les incidents de démo en les passant à
  // « resolved », puis on ajoute une chaîne A → B → C et une tâche isolée sur
  // Keravel, ancrées sur la journée courante du POC, avec un seul incident
  // ouvert — porté par A.
  const D = localDateKey(date(app.ui.periodAnchor || TODAY));
  const base = app.tasks.filter((t) => t.projectId === 'keravel')[0];
  app.issues.forEach((i) => { i.status = 'resolved'; });
  app.tasks.push(
    { id: 'tA', projectId: 'keravel', name: 'Tache A source', resourceId: base.resourceId, start: D + 'T08:00', end: D + 'T10:00', status: 'todo', deps: [] },
    { id: 'tB', projectId: 'keravel', name: 'Tache B aval', resourceId: base.resourceId, start: D + 'T10:30', end: D + 'T13:00', status: 'todo', deps: [] },
    { id: 'tC', projectId: 'keravel', name: 'Tache C aval', resourceId: base.resourceId, start: D + 'T14:00', end: D + 'T16:00', status: 'todo', deps: [] },
    { id: 'tZ', projectId: 'keravel', name: 'Tache Z isolee', resourceId: base.resourceId, start: D + 'T16:30', end: D + 'T17:30', status: 'todo', deps: [] },
  );
  task('tB').deps = ['tA'];
  task('tC').deps = ['tB'];
  app.issues.push({ id: 'iA', projectId: 'keravel', taskId: 'tA', status: 'open', severity: 'critical', source: 'planning', title: 'Incident sur A', comment: 'Blocage amont.' });
  app.ui.planningProject = 'keravel';
  app.ui.planningResource = 'all';
  app.settings.period = 'week';
  save();
  go('planning');
  setPlanningView('kanban');
`;
const setupScenario = async (p, extra = '') => {
  await ev(p, (src) => { (0, eval)(src); }, SCENARIO + extra);
  await p.waitForTimeout(200);
};

// ---- BADGE-01 : incident direct → À TRAITER ----
console.log('\n[BADGE-01] Incident direct → À TRAITER');
{
  const { ctx, p } = await newPage(1440, 1000, 'B01');
  await setupScenario(p);
  const c = await readCards(p);
  note('BADGE-01', c);
  ok(c['Tache A source'] && c['Tache A source'].attention, 'BADGE-01 : A (incident ouvert direct) affiche À TRAITER', 'BADGE-01');
  ok(c['Tache A source'] && !c['Tache A source'].impacted, 'BADGE-01 : A n’affiche PAS SOUS IMPACT en plus', 'BADGE-01');
  ok(c['Tache A source'] && c['Tache A source'].labels.some((l) => /TRAITER/i.test(l)), 'BADGE-01 : libellé rendu « À TRAITER »', 'BADGE-01');
  await ctx.close();
}

// ---- BADGE-02 : A → B → C, incident sur A seulement ----
console.log('\n[BADGE-02] Chaîne A→B→C, incident sur A');
{
  const { ctx, p } = await newPage(1440, 1000, 'B02');
  await setupScenario(p);
  const c = await readCards(p);
  ok(c['Tache A source'].attention && !c['Tache A source'].impacted, 'BADGE-02 : A → À TRAITER', 'BADGE-02');
  ok(c['Tache B aval'].impacted && !c['Tache B aval'].attention, 'BADGE-02 : B → SOUS IMPACT (et pas À TRAITER)', 'BADGE-02');
  ok(c['Tache C aval'].impacted && !c['Tache C aval'].attention, 'BADGE-02 : C → SOUS IMPACT (et pas À TRAITER)', 'BADGE-02');
  ok(c['Tache B aval'].labels.some((l) => /SOUS IMPACT/i.test(l)), 'BADGE-02 : libellé rendu « SOUS IMPACT »', 'BADGE-02');
  await p.screenshot({ path: SHOTS + '01-chaine-a-b-c.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-03 : B passe En cours → reste SOUS IMPACT ----
console.log('\n[BADGE-03] B → En cours : reste SOUS IMPACT');
{
  const { ctx, p } = await newPage(1440, 1000, 'B03');
  await setupScenario(p);
  const before = await readCards(p);
  ok(before['Tache B aval'].col === 'todo', 'BADGE-03 : B est initialement dans « À faire »', 'BADGE-03');
  await ev(p, () => { setTaskStatus('tB', 'doing', 'test'); renderPage(); });
  await p.waitForTimeout(200);
  const after = await readCards(p);
  note('BADGE-03', after['Tache B aval']);
  ok(after['Tache B aval'].col === 'doing', 'BADGE-03 : B est passée dans « En cours »', 'BADGE-03');
  ok(after['Tache B aval'].impacted, 'BADGE-03 : B conserve SOUS IMPACT une fois démarrée', 'BADGE-03');
  ok(!after['Tache B aval'].attention, 'BADGE-03 : B ne devient PAS À TRAITER en changeant de statut', 'BADGE-03');
  ok(after['Tache A source'].attention, 'BADGE-03 : A reste À TRAITER', 'BADGE-03');
  await p.screenshot({ path: SHOTS + '02-b-en-cours-sous-impact.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-04 : résolution de l'incident de A ----
console.log('\n[BADGE-04] Incident de A résolu → plus aucun badge');
{
  const { ctx, p } = await newPage(1440, 1000, 'B04');
  await setupScenario(p);
  await ev(p, () => { app.issues.find((i) => i.id === 'iA').status = 'resolved'; save(); renderPage(); });
  await p.waitForTimeout(200);
  const c = await readCards(p);
  note('BADGE-04', c);
  ok(!c['Tache A source'].attention, 'BADGE-04 : A ne porte plus À TRAITER', 'BADGE-04');
  ok(!c['Tache A source'].impacted, 'BADGE-04 : A ne bascule pas en SOUS IMPACT', 'BADGE-04');
  ok(!c['Tache B aval'].impacted, 'BADGE-04 : B ne porte plus SOUS IMPACT', 'BADGE-04');
  ok(!c['Tache C aval'].impacted, 'BADGE-04 : C ne porte plus SOUS IMPACT', 'BADGE-04');
  await p.screenshot({ path: SHOTS + '03-incident-resolu.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-05 : B possède aussi son propre incident ----
console.log('\n[BADGE-05] B a son propre incident → À TRAITER prioritaire');
{
  const { ctx, p } = await newPage(1440, 1000, 'B05');
  await setupScenario(p, `
    app.issues.push({ id: 'iB', projectId: 'keravel', taskId: 'tB', status: 'open', severity: 'warning', source: 'field', title: 'Incident propre a B', comment: 'Souci local.' });
    save(); renderPage();
  `);
  const c = await readCards(p);
  note('BADGE-05', c);
  ok(c['Tache A source'].attention, 'BADGE-05 : A → À TRAITER', 'BADGE-05');
  ok(c['Tache B aval'].attention, 'BADGE-05 : B → À TRAITER (incident propre)', 'BADGE-05');
  ok(!c['Tache B aval'].impacted, 'BADGE-05 : B n’affiche PAS SOUS IMPACT en même temps (§19)', 'BADGE-05');
  ok(c['Tache C aval'].impacted && !c['Tache C aval'].attention, 'BADGE-05 : C → SOUS IMPACT', 'BADGE-05');
  await p.screenshot({ path: SHOTS + '04-incident-direct-prioritaire.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-06 : indépendance du toggle « Chaîne d'impact » ----
console.log('\n[BADGE-06] Toggle Chaîne d’impact OFF/ON → badges identiques');
{
  const { ctx, p } = await newPage(1440, 1000, 'B06');
  await setupScenario(p);
  const offState = await ev(p, () => app.ui.impactChain);
  const off = await readCards(p);
  await ev(p, () => { toggleImpactChain(true); });
  await p.waitForTimeout(200);
  const onState = await ev(p, () => app.ui.impactChain);
  const on = await readCards(p);
  note('BADGE-06', { offState, onState });
  ok(offState === false && onState === true, 'BADGE-06 : le toggle a bien changé d’état', 'BADGE-06');
  ok(JSON.stringify(off) === JSON.stringify(on), 'BADGE-06 : badges Kanban strictement identiques toggle OFF et ON', 'BADGE-06');
  ok(on['Tache B aval'].impacted, 'BADGE-06 : SOUS IMPACT présent même avec le toggle actif', 'BADGE-06');
  await ctx.close();
}

// ---- BADGE-07 : Kanban → Gantt → Kanban ----
console.log('\n[BADGE-07] Aller-retour Kanban → Gantt → Kanban');
{
  const { ctx, p } = await newPage(1440, 1000, 'B07');
  await setupScenario(p);
  const first = await readCards(p);
  await ev(p, () => setPlanningView('gantt'));
  await p.waitForTimeout(200);
  const ganttCards = await ev(p, () => document.querySelectorAll('.kanban-card').length);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(200);
  const second = await readCards(p);
  ok(ganttCards === 0, 'BADGE-07 : le Gantt ne rend aucune carte Kanban', 'BADGE-07');
  ok(JSON.stringify(first) === JSON.stringify(second), 'BADGE-07 : badges recalculés à l’identique au retour', 'BADGE-07');
  const persisted = await ev(p, () => app.tasks.some((t) => 'isImpacted' in t || 'impactStatus' in t || 'attentionBadge' in t));
  ok(!persisted, 'BADGE-07 : aucune propriété de badge persistée sur les tâches', 'BADGE-07');
  await ctx.close();
}

// ---- BADGE-08 : filtre chantier ----
console.log('\n[BADGE-08] Filtre « Tous » → « Résidence Keravel »');
{
  const { ctx, p } = await newPage(1440, 1000, 'B08');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(220);
  const all = await readCards(p);
  await ev(p, () => { app.ui.planningProject = 'keravel'; save(); renderPage(); });
  await p.waitForTimeout(220);
  const ker = await readCards(p);
  const names = Object.keys(ker);
  note('BADGE-08', { toutes: Object.keys(all).length, keravel: names.length });
  ok(names.length > 0 && names.length < Object.keys(all).length, 'BADGE-08 : le filtre réduit bien le périmètre', 'BADGE-08');
  const same = names.every((n) => all[n] && all[n].attention === ker[n].attention && all[n].impacted === ker[n].impacted);
  ok(same, 'BADGE-08 : badges identiques avant/après filtrage (logique inchangée)', 'BADGE-08');
  const kWindows = ker['Pose des 6 fenêtres'];
  ok(kWindows && kWindows.attention && !kWindows.impacted, 'BADGE-08 : « Pose des 6 fenêtres » (incident direct) → À TRAITER', 'BADGE-08');
  await p.screenshot({ path: SHOTS + '05-filtre-keravel.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-09 : tâche sans incident et non impactée ----
console.log('\n[BADGE-09] Tâche neutre → aucun badge d’attention');
{
  const { ctx, p } = await newPage(1440, 1000, 'B09');
  await setupScenario(p);
  const c = await readCards(p);
  const z = c['Tache Z isolee'];
  note('BADGE-09', z);
  ok(!!z, 'BADGE-09 : la tâche isolée est bien rendue', 'BADGE-09');
  ok(z && !z.attention, 'BADGE-09 : aucune mention À TRAITER', 'BADGE-09');
  ok(z && !z.impacted, 'BADGE-09 : aucune mention SOUS IMPACT', 'BADGE-09');
  ok(z && z.labels.length === 0, 'BADGE-09 : aucun badge du tout sur la carte neutre', 'BADGE-09');
  await ctx.close();
}

// ---- BADGE-10 : REPRISE + badge d'attention ----
console.log('\n[BADGE-10] REPRISE cumulable avec le badge d’attention');
{
  const { ctx, p } = await newPage(1440, 1000, 'B10');
  await setupScenario(p, `
    task('tB').reworkOfTaskId = 'tA';
    task('tA').reworkOfTaskId = 'tZ';
    save(); renderPage();
  `);
  const c = await readCards(p);
  note('BADGE-10', { A: c['Tache A source'], B: c['Tache B aval'] });
  ok(c['Tache A source'].rework && c['Tache A source'].attention, 'BADGE-10 : A → REPRISE + À TRAITER', 'BADGE-10');
  ok(c['Tache B aval'].rework && c['Tache B aval'].impacted, 'BADGE-10 : B → REPRISE + SOUS IMPACT', 'BADGE-10');
  ok(!c['Tache B aval'].attention, 'BADGE-10 : B ne bascule pas en À TRAITER à cause de la reprise', 'BADGE-10');
  ok(c['Tache A source'].labels[0] === 'REPRISE' || /REPRISE/i.test(c['Tache A source'].labels[0]), 'BADGE-10 : REPRISE reste affiché en premier', 'BADGE-10');
  await p.screenshot({ path: SHOTS + '06-reprise-plus-attention.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-11 : dark mode — les trois badges restent différenciables ----
console.log('\n[BADGE-11] Dark mode');
{
  const { ctx, p } = await newPage(1440, 1000, 'B11');
  await setupScenario(p, `
    task('tB').reworkOfTaskId = 'tA';
    app.settings.theme = 'dark'; document.body.classList.add('dark');
    save(); renderPage();
  `);
  const cols = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color, bd: cs.borderTopColor, w: cs.borderTopWidth }; };
    return { attention: g('.kanban-badge.attention'), impacted: g('.kanban-badge.impacted'), rework: g('.kanban-badge.rework'), site: g('.kb-site') };
  });
  note('BADGE-11', cols);
  ok(cols.attention && cols.impacted && cols.rework, 'BADGE-11 : les trois badges coexistent dans la vue sombre', 'BADGE-11');
  ok(cols.impacted.fg !== cols.attention.fg, 'BADGE-11 : SOUS IMPACT ≠ À TRAITER (couleur de texte)', 'BADGE-11');
  ok(cols.impacted.bg !== cols.attention.bg, 'BADGE-11 : SOUS IMPACT ≠ À TRAITER (fond)', 'BADGE-11');
  ok(cols.impacted.fg !== cols.rework.fg, 'BADGE-11 : SOUS IMPACT ≠ REPRISE', 'BADGE-11');
  ok(cols.impacted.bg !== cols.site.bg, 'BADGE-11 : SOUS IMPACT ≠ badge chantier', 'BADGE-11');
  const notRed = await ev(p, () => {
    const cs = getComputedStyle(document.querySelector('.kanban-badge.impacted'));
    const m = cs.color.match(/\d+/g).map(Number);
    return !(m[0] > 150 && m[1] < 110 && m[2] < 110);
  });
  ok(notRed, 'BADGE-11 : SOUS IMPACT n’utilise pas de rouge', 'BADGE-11');
  await p.screenshot({ path: SHOTS + '07-dark-badges.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-12 : couleurs distinctes en mode clair ----
console.log('\n[BADGE-12] Mode clair — différenciation');
{
  const { ctx, p } = await newPage(1440, 1000, 'B12');
  await setupScenario(p, `task('tB').reworkOfTaskId = 'tA'; save(); renderPage();`);
  const cols = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color, txt: e.innerText.trim() }; };
    return { attention: g('.kanban-badge.attention'), impacted: g('.kanban-badge.impacted'), rework: g('.kanban-badge.rework') };
  });
  note('BADGE-12', cols);
  ok(cols.impacted.txt === 'SOUS IMPACT', 'BADGE-12 : libellé exact « SOUS IMPACT »', 'BADGE-12');
  ok(cols.attention.txt === 'À TRAITER', 'BADGE-12 : libellé exact « À TRAITER » conservé', 'BADGE-12');
  ok(cols.impacted.fg !== cols.attention.fg && cols.impacted.bg !== cols.attention.bg, 'BADGE-12 : les deux badges sont visuellement distincts', 'BADGE-12');
  ok(cols.impacted.fg !== cols.rework.fg, 'BADGE-12 : SOUS IMPACT ≠ REPRISE (bleu accent)', 'BADGE-12');
  const notRed = await ev(p, () => {
    const cs = getComputedStyle(document.querySelector('.kanban-badge.impacted'));
    const m = cs.color.match(/\d+/g).map(Number);
    return !(m[0] > 150 && m[1] < 110 && m[2] < 110);
  });
  ok(notRed, 'BADGE-12 : aucun rouge sur SOUS IMPACT', 'BADGE-12');
  const noSurveiller = await ev(p, () => ![...document.querySelectorAll('.kanban-badge')].some((e) => /surveiller/i.test(e.textContent)));
  ok(noSurveiller, 'BADGE-12 : le terme « À surveiller » n’est pas réutilisé (§13)', 'BADGE-12');
  await p.screenshot({ path: SHOTS + '08-clair-badges.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-13 : responsive — aucun débordement de carte ----
console.log('\n[BADGE-13] Responsive');
{
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'B13-' + w);
    await setupScenario(p, `task('tB').reworkOfTaskId = 'tA'; save(); renderPage();`);
    const r = await ev(p, () => {
      let overflow = 0;
      document.querySelectorAll('.kanban-card').forEach((c) => {
        const cr = c.getBoundingClientRect();
        c.querySelectorAll('.kanban-badge').forEach((bg) => {
          const br = bg.getBoundingClientRect();
          if (br.right > cr.right + 1 || br.left < cr.left - 1) overflow++;
        });
      });
      return { overflow, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, badges: document.querySelectorAll('.kanban-badge').length };
    });
    note('BADGE-13', { w, ...r });
    ok(r.badges > 0, `BADGE-13 : ${w}px — des badges sont rendus`, 'BADGE-13');
    ok(r.overflow === 0, `BADGE-13 : ${w}px — aucun badge ne déborde de sa carte`, 'BADGE-13');
    ok(!r.hscroll, `BADGE-13 : ${w}px — aucun scroll horizontal de page`, 'BADGE-13');
    if (w === 390) await p.screenshot({ path: SHOTS + '09-mobile-390.png', fullPage: true });
    await ctx.close();
  }
}

// ---- BADGE-14 : accessibilité — le sens ne dépend pas que de la couleur ----
console.log('\n[BADGE-14] Accessibilité');
{
  const { ctx, p } = await newPage(1440, 1000, 'B14');
  await setupScenario(p);
  const r = await ev(p, () => {
    const els = [...document.querySelectorAll('.kanban-badge')];
    return {
      allVisible: els.every((e) => e.innerText.trim().length > 0 && getComputedStyle(e).display !== 'none'),
      impactedOutlined: getComputedStyle(document.querySelector('.kanban-badge.impacted')).borderTopWidth !== '0px',
      attentionOutlined: getComputedStyle(document.querySelector('.kanban-badge.attention')).borderTopWidth !== '0px',
    };
  });
  note('BADGE-14', r);
  ok(r.allVisible, 'BADGE-14 : les libellés texte sont toujours visibles', 'BADGE-14');
  ok(r.impactedOutlined && !r.attentionOutlined, 'BADGE-14 : différenciation non chromatique (SOUS IMPACT contouré, À TRAITER plein)', 'BADGE-14');
  await ctx.close();
}

// ---- BADGE-15 : moteurs métier & persistance intacts ----
console.log('\n[BADGE-15] Aucun changement métier');
{
  const { ctx, p } = await newPage(1440, 1000, 'B15');
  await setupScenario(p);
  const r = await ev(p, () => {
    const before = JSON.stringify(app.tasks);
    kanbanBoard('all'); kanbanBoard('all');
    const after = JSON.stringify(app.tasks);
    const ctx1 = kanbanImpactContext();
    return {
      pure: before === after,
      cols: [...document.querySelectorAll('.kanban-col')].map((c) => c.getAttribute('data-status')),
      schema: SCHEMA_VERSION,
      store: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
      hasSets: ctx1.sources instanceof Set && ctx1.impacted instanceof Set,
      issueKeys: Object.keys(app.issues[0]),
    };
  });
  note('BADGE-15', r);
  ok(r.pure, 'BADGE-15 : rendre le Kanban ne mute aucune tâche', 'BADGE-15');
  ok(JSON.stringify(r.cols) === JSON.stringify(['todo', 'doing', 'done']), 'BADGE-15 : exactement 3 colonnes (À faire / En cours / Terminée)', 'BADGE-15');
  ok(r.schema === 8, 'BADGE-15 : SCHEMA_VERSION inchangé (8)', 'BADGE-15');
  ok(r.store.every((k) => k === 'kanvix-product-8-3'), 'BADGE-15 : STORE inchangé (kanvix-product-8-3)', 'BADGE-15');
  ok(r.hasSets, 'BADGE-15 : kanbanImpactContext() renvoie bien deux Set', 'BADGE-15');
  await ctx.close();
}

// ---- BADGE-16 : tâche terminée — cohérence, aucun comportement nouveau ----
console.log('\n[BADGE-16] Tâche terminée');
{
  const { ctx, p } = await newPage(1440, 1000, 'B16');
  await setupScenario(p, `
    task('tC').status = 'done'; save(); renderPage();
  `);
  const c = await readCards(p);
  note('BADGE-16', c['Tache C aval']);
  ok(c['Tache C aval'].col === 'done', 'BADGE-16 : C est bien dans « Terminée »', 'BADGE-16');
  const draggable = await ev(p, () => {
    const cards = [...document.querySelectorAll('.kanban-col[data-status="done"] .kanban-card')];
    return cards.every((x) => x.getAttribute('draggable') !== 'true');
  });
  ok(draggable, 'BADGE-16 : une tâche terminée reste non draggable (V2.4.10.1)', 'BADGE-16');
  await ctx.close();
}

// ---- BADGE-18 : données de démo réelles (§15/§16) ----
console.log('\n[BADGE-18] Données de démo réelles');
{
  const { ctx, p } = await newPage(1440, 1100, 'B18');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'keravel'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const c = await readCards(p);
  note('BADGE-18', c);
  const src = c['Pose des 6 fenêtres'];
  ok(src && src.attention && !src.impacted, 'BADGE-18 : « Pose des 6 fenêtres » (incident « Fenêtres décalées ») → À TRAITER seul', 'BADGE-18');
  const downstream = Object.entries(c).filter(([, v]) => v.impacted);
  note('BADGE-18', { sousImpact: downstream.map(([n]) => n) });
  ok(downstream.length > 0, 'BADGE-18 : au moins une conséquence aval porte SOUS IMPACT sur la démo', 'BADGE-18');
  ok(downstream.every(([, v]) => !v.attention), 'BADGE-18 : aucune carte ne cumule SOUS IMPACT et À TRAITER', 'BADGE-18');
  const bothVisible = await ev(p, () => !!document.querySelector('.kanban-badge.attention') && !!document.querySelector('.kanban-badge.impacted'));
  ok(bothVisible, 'BADGE-18 : les deux niveaux coexistent dans une même vue Kanban', 'BADGE-18');
  await p.screenshot({ path: SHOTS + '10-demo-keravel-deux-niveaux.png', fullPage: true });
  await ev(p, () => { app.settings.theme = 'dark'; document.body.classList.add('dark'); save(); renderPage(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '11-demo-keravel-dark.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-17 : console ----
console.log('\n[BADGE-17] Console');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('BADGE-17', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'BADGE-17 : 0 erreur JavaScript applicative', 'BADGE-17');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
