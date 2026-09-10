// ============================================================
// KANVIX — Recette badges Kanban contextuels selon le statut (V2.4.11.3)
//   Usage : node recette-kanban-badges-v2.4.11.3.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.11.3.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-kanban-badges-v2.4.11.3/';
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


// Drag Kanban RÉEL : on dispatche de vrais DragEvent porteurs d'un DataTransfer
// sur les handlers de l'application (ondragstart / ondragover / ondrop), sans
// jamais appeler setTaskStatus() directement (§30).
const realDrag = (p, taskName, targetStatus) => ev(p, ({ n, st }) => {
  const card = [...document.querySelectorAll('.kanban-card')].find((c) => c.querySelector('b').textContent.trim() === n);
  const col = document.querySelector(`.kanban-col[data-status="${st}"]`);
  if (!card || !col) return { ok: false, why: !card ? 'carte introuvable' : 'colonne introuvable' };
  if (card.getAttribute('draggable') !== 'true') return { ok: false, why: 'carte non draggable' };
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  return { ok: true, transferred: dt.getData('text/plain') };
}, { n: taskName, st: targetStatus });

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
        follow: !!c.querySelector('.kanban-badge.follow'),
        openPoint: !!c.querySelector('.kanban-badge.open-point'),
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

// ---- BADGE-01 : incident direct sur une tâche todo → À TRAITER ----
console.log('\n[BADGE-01] Incident direct (todo) → À TRAITER');
{
  const { ctx, p } = await newPage(1440, 1000, 'B01');
  await setupScenario(p);
  const c = await readCards(p);
  note('BADGE-01', c);
  ok(c['Tache A source'] && c['Tache A source'].attention, 'BADGE-01 : A (todo + incident direct) affiche À TRAITER', 'BADGE-01');
  ok(c['Tache A source'] && !c['Tache A source'].impacted, 'BADGE-01 : A n’affiche PAS SOUS IMPACT en plus', 'BADGE-01');
  ok(c['Tache A source'] && c['Tache A source'].labels.includes('À TRAITER'), 'BADGE-01 : libellé rendu « À TRAITER »', 'BADGE-01');
  await ctx.close();
}

// ---- BADGE-02 : A → B → C, incident sur A seulement ----
console.log('\n[BADGE-02] Chaîne A→B→C, incident sur A');
{
  const { ctx, p } = await newPage(1440, 1000, 'B02');
  await setupScenario(p);
  const c = await readCards(p);
  ok(c['Tache A source'].attention && !c['Tache A source'].impacted, 'BADGE-02 : A (todo) → À TRAITER', 'BADGE-02');
  ok(c['Tache B aval'].impacted && !c['Tache B aval'].attention, 'BADGE-02 : B → SOUS IMPACT (et aucun badge direct)', 'BADGE-02');
  ok(c['Tache C aval'].impacted && !c['Tache C aval'].attention, 'BADGE-02 : C → SOUS IMPACT (et aucun badge direct)', 'BADGE-02');
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
  ok(!after['Tache B aval'].attention && !after['Tache B aval'].follow, 'BADGE-03 : B ne prend AUCUN badge direct (ni À traiter ni À suivre) en démarrant', 'BADGE-03');
  ok(after['Tache A source'].attention, 'BADGE-03 : A (toujours todo) reste À TRAITER', 'BADGE-03');
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
  ok(!c['Tache A source'].attention && !c['Tache A source'].follow, 'BADGE-04 : A ne porte plus aucun badge direct', 'BADGE-04');
  ok(!c['Tache A source'].impacted, 'BADGE-04 : A ne bascule pas en SOUS IMPACT', 'BADGE-04');
  ok(!c['Tache B aval'].impacted, 'BADGE-04 : B ne porte plus SOUS IMPACT', 'BADGE-04');
  ok(!c['Tache C aval'].impacted, 'BADGE-04 : C ne porte plus SOUS IMPACT', 'BADGE-04');
  await p.screenshot({ path: SHOTS + '03-incident-resolu.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-05 : B possède aussi son propre incident ----
console.log('\n[BADGE-05] B a son propre incident → badge direct prioritaire');
{
  const { ctx, p } = await newPage(1440, 1000, 'B05');
  await setupScenario(p, `
    app.issues.push({ id: 'iB', projectId: 'keravel', taskId: 'tB', status: 'open', severity: 'warning', source: 'field', title: 'Incident propre a B', comment: 'Souci local.' });
    save(); renderPage();
  `);
  const c = await readCards(p);
  note('BADGE-05', c);
  ok(c['Tache A source'].attention, 'BADGE-05 : A (todo) → À TRAITER', 'BADGE-05');
  ok(c['Tache B aval'].attention, 'BADGE-05 : B (todo) → À TRAITER (incident propre)', 'BADGE-05');
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
  ok(kWindows && kWindows.attention && !kWindows.impacted, 'BADGE-08 : « Pose des 6 fenêtres » (todo + incident direct) → À TRAITER', 'BADGE-08');
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
  ok(z && !z.attention && !z.follow && !z.openPoint, 'BADGE-09 : aucun badge d’incident direct', 'BADGE-09');
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
  ok(!c['Tache B aval'].attention && !c['Tache B aval'].follow, 'BADGE-10 : B ne prend aucun badge direct à cause de la reprise', 'BADGE-10');
  ok(/REPRISE/i.test(c['Tache A source'].labels[0]), 'BADGE-10 : REPRISE reste affiché en premier', 'BADGE-10');
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
  ok(r.impactedOutlined && !r.attentionOutlined, 'BADGE-14 : différenciation non chromatique (SOUS IMPACT contouré, POINT OUVERT plein)', 'BADGE-14');
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
  ok(src && src.attention && !src.impacted, 'BADGE-18 : « Pose des 6 fenêtres » (incident « Fenêtres décalées ») → POINT OUVERT seul', 'BADGE-18');
  const downstream = Object.entries(c).filter(([, v]) => v.impacted);
  note('BADGE-18', { sousImpact: downstream.map(([n]) => n) });
  ok(downstream.length > 0, 'BADGE-18 : au moins une conséquence aval porte SOUS IMPACT sur la démo', 'BADGE-18');
  ok(downstream.every(([, v]) => !v.attention), 'BADGE-18 : aucune carte ne cumule SOUS IMPACT et POINT OUVERT', 'BADGE-18');
  const bothVisible = await ev(p, () => !!document.querySelector('.kanban-badge.attention') && !!document.querySelector('.kanban-badge.impacted'));
  ok(bothVisible, 'BADGE-18 : les deux niveaux coexistent dans une même vue Kanban', 'BADGE-18');
  await p.screenshot({ path: SHOTS + '10-demo-keravel-deux-niveaux.png', fullPage: true });
  await ev(p, () => { app.settings.theme = 'dark'; document.body.classList.add('dark'); save(); renderPage(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '11-demo-keravel-dark.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-19 : Tableau électrique « À faire → En cours » (§8) ----
console.log('\n[BADGE-19] Tableau électrique démarré → À SUIVRE');
{
  const { ctx, p } = await newPage(1440, 1100, 'B19');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'keravel'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const issue = await ev(p, () => {
    const i = app.issues.find((x) => x.taskId === 'k-electric' && x.status !== 'resolved');
    return i ? { title: i.title, status: i.status } : null;
  });
  note('BADGE-19', issue);
  ok(issue && /électricien/i.test(issue.title), 'BADGE-19 : « Tableau électrique » porte bien son incident de démonstration', 'BADGE-19');
  const before = await readCards(p);
  ok(before['Tableau électrique'].col === 'todo', 'BADGE-19 : départ en « À faire »', 'BADGE-19');
  ok(before['Tableau électrique'].attention && before['Tableau électrique'].labels.includes('À TRAITER'), 'BADGE-19 : À faire → À TRAITER', 'BADGE-19');
  // Passage À faire → En cours via le moteur de statut existant (non modifié).
  await ev(p, () => { setTaskStatus('k-electric', 'doing', 'test'); renderPage(); });
  await p.waitForTimeout(220);
  const after = await readCards(p);
  note('BADGE-19', after['Tableau électrique']);
  ok(after['Tableau électrique'].col === 'doing', 'BADGE-19 : la carte est passée en « En cours »', 'BADGE-19');
  ok(after['Tableau électrique'].follow, 'BADGE-19 : En cours + À SUIVRE', 'BADGE-19');
  ok(after['Tableau électrique'].labels.includes('À SUIVRE'), 'BADGE-19 : libellé rendu « À SUIVRE »', 'BADGE-19');
  ok(!after['Tableau électrique'].attention && !after['Tableau électrique'].openPoint, 'BADGE-19 : INTERDIT — ni « À TRAITER » ni « POINT OUVERT » sur la carte démarrée', 'BADGE-19');
  ok(!after['Tableau électrique'].impacted, 'BADGE-19 : pas de cumul avec SOUS IMPACT', 'BADGE-19');
  await p.screenshot({ path: SHOTS + '12-tableau-electrique-en-cours.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-20 : conséquence pure démarrée (§10/§11) ----
console.log('\n[BADGE-20] Conséquence pure « À faire → En cours »');
{
  const { ctx, p } = await newPage(1440, 1100, 'B20');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'keravel'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const before = await readCards(p);
  ok(before['Peinture étage 1'] && before['Peinture étage 1'].impacted && !before['Peinture étage 1'].attention, 'BADGE-20 : « Peinture étage 1 » (conséquence pure) → SOUS IMPACT', 'BADGE-20');
  await ev(p, () => { setTaskStatus('k-paint', 'doing', 'test'); renderPage(); });
  await p.waitForTimeout(220);
  const after = await readCards(p);
  note('BADGE-20', after['Peinture étage 1']);
  ok(after['Peinture étage 1'].col === 'doing', 'BADGE-20 : la carte est passée en « En cours »', 'BADGE-20');
  ok(after['Peinture étage 1'].impacted, 'BADGE-20 : En cours + SOUS IMPACT', 'BADGE-20');
  ok(!after['Peinture étage 1'].attention && !after['Peinture étage 1'].follow, 'BADGE-20 : elle ne bascule jamais en À SUIVRE', 'BADGE-20');
  await p.screenshot({ path: SHOTS + '13-consequence-en-cours.png', fullPage: true });
  await ctx.close();
}

// ---- BADGE-21 : autres écrans intacts (§15) ----
console.log('\n[BADGE-21] Vocabulaire limité aux cartes Kanban (§15)');
{
  const { ctx, p } = await newPage(1440, 1100, 'B21');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'all'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const kanban = await ev(p, () => {
    const badges = [...document.querySelectorAll('.kanban-badge')].map((e) => e.innerText.trim());
    return {
      badges,
      aTraiter: badges.filter((t) => /À TRAITER/i.test(t)).length,
      pointOuvert: badges.filter((t) => /POINT OUVERT/i.test(t)).length,
      aSuivre: badges.filter((t) => /À SUIVRE/i.test(t)).length,
      cardsHTML: document.querySelector('.kanban').innerHTML,
    };
  });
  note('BADGE-21', { aTraiter: kanban.aTraiter, pointOuvert: kanban.pointOuvert, distinct: [...new Set(kanban.badges)] });
  ok(kanban.aTraiter > 0, 'BADGE-21 : des badges « À TRAITER » sont rendus (tâches non démarrées)', 'BADGE-21');
  ok(kanban.pointOuvert === 0, 'BADGE-21 : aucun « POINT OUVERT » sur des tâches non terminées', 'BADGE-21');
  // §7 — le vocabulaire métier des autres écrans n'est PAS touché.
  await ev(p, () => { app.ui.projectId = 'keravel'; go('project'); });
  await p.waitForTimeout(250);
  const cockpitZone = await ev(p, () => document.querySelector('.main').innerText);
  ok(/À traiter/i.test(cockpitZone), 'BADGE-21 : §7 — le cockpit chantier conserve sa zone « À traiter »', 'BADGE-21');
  const homeKeeps = await ev(p, () => { go('today'); return document.querySelector('.main').innerText; });
  ok(typeof homeKeeps === 'string' && homeKeeps.length > 0, 'BADGE-21 : l’Accueil se rend normalement (aucun remplacement aveugle)', 'BADGE-21');
  await ctx.close();
}

// ---- KAN-CTX-A : drag RÉEL Tableau électrique À faire → En cours (§30) ----
console.log('\n[KAN-CTX-A] Drag réel : À faire → En cours');
{
  const { ctx, p } = await newPage(1440, 1100, 'CTXA');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'keravel'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const before = await readCards(p);
  ok(before['Tableau électrique'].col === 'todo' && before['Tableau électrique'].attention, 'KAN-CTX-A : départ — À faire + À TRAITER', 'KAN-CTX-A');
  const statusBefore = await ev(p, () => task('k-electric').status);
  note('KAN-CTX-A', { statusBefore });
  const drag = await realDrag(p, 'Tableau électrique', 'doing');
  note('KAN-CTX-A', drag);
  ok(drag.ok, 'KAN-CTX-A : le drag réel a bien été dispatché sur les handlers de l’app', 'KAN-CTX-A');
  ok(drag.transferred === 'k-electric', 'KAN-CTX-A : le DataTransfer porte bien l’id de la tâche', 'KAN-CTX-A');
  await p.waitForTimeout(280);
  const after = await readCards(p);
  note('KAN-CTX-A', after['Tableau électrique']);
  ok(await ev(p, () => task('k-electric').status) === 'doing', 'KAN-CTX-A : le drag a réellement changé le statut via kanbanDrop → setTaskStatus', 'KAN-CTX-A');
  ok(after['Tableau électrique'].col === 'doing', 'KAN-CTX-A : la carte est dans la colonne « En cours »', 'KAN-CTX-A');
  ok(after['Tableau électrique'].follow, 'KAN-CTX-A : badge « À SUIVRE » après drag réel', 'KAN-CTX-A');
  ok(after['Tableau électrique'].labels.includes('À SUIVRE'), 'KAN-CTX-A : libellé rendu « À SUIVRE »', 'KAN-CTX-A');
  ok(!after['Tableau électrique'].attention && !after['Tableau électrique'].openPoint && !after['Tableau électrique'].impacted, 'KAN-CTX-A : ni À TRAITER, ni POINT OUVERT, ni SOUS IMPACT', 'KAN-CTX-A');
  await p.screenshot({ path: SHOTS + '14-drag-reel-a-suivre.png', fullPage: true });

  // §31 — retour En cours → À faire par un second drag réel.
  const back = await realDrag(p, 'Tableau électrique', 'todo');
  ok(back.ok, 'KAN-CTX-A : le drag retour a bien été dispatché', 'KAN-CTX-A');
  await p.waitForTimeout(280);
  const rev = await readCards(p);
  note('KAN-CTX-A', { retour: rev['Tableau électrique'] });
  ok(rev['Tableau électrique'].col === 'todo', 'KAN-CTX-A : retour — la carte revient dans « À faire »', 'KAN-CTX-A');
  ok(rev['Tableau électrique'].attention && rev['Tableau électrique'].labels.includes('À TRAITER'), 'KAN-CTX-A : retour — le badge redevient « À TRAITER »', 'KAN-CTX-A');
  ok(!rev['Tableau électrique'].follow, 'KAN-CTX-A : retour — plus de « À SUIVRE »', 'KAN-CTX-A');
  await ctx.close();
}

// ---- KAN-CTX-B : « Pose des 6 fenêtres » todo → doing (§19) ----
console.log('\n[KAN-CTX-B] Pose des 6 fenêtres : À TRAITER → À SUIVRE');
{
  const { ctx, p } = await newPage(1440, 1100, 'CTXB');
  await ev(p, () => { resetApp(); setDepth('pilot'); app.settings.period = 'month'; app.ui.planningProject = 'keravel'; save(); go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(250);
  const before = await readCards(p);
  ok(before['Pose des 6 fenêtres'].attention && before['Pose des 6 fenêtres'].labels.includes('À TRAITER'), 'KAN-CTX-B : À faire → À TRAITER', 'KAN-CTX-B');
  const drag = await realDrag(p, 'Pose des 6 fenêtres', 'doing');
  ok(drag.ok, 'KAN-CTX-B : drag réel dispatché', 'KAN-CTX-B');
  await p.waitForTimeout(280);
  const after = await readCards(p);
  note('KAN-CTX-B', after['Pose des 6 fenêtres']);
  ok(after['Pose des 6 fenêtres'].col === 'doing', 'KAN-CTX-B : colonne « En cours »', 'KAN-CTX-B');
  ok(after['Pose des 6 fenêtres'].follow && after['Pose des 6 fenêtres'].labels.includes('À SUIVRE'), 'KAN-CTX-B : badge « À SUIVRE »', 'KAN-CTX-B');
  ok(!after['Pose des 6 fenêtres'].attention, 'KAN-CTX-B : plus de « À TRAITER » en colonne En cours', 'KAN-CTX-B');
  await ctx.close();
}

// ---- KAN-CTX-C : incident propre sur B doing → À SUIVRE, puis retour SOUS IMPACT (§22/§23) ----
console.log('\n[KAN-CTX-C] Incident propre sur une tâche impactée en cours');
{
  const { ctx, p } = await newPage(1440, 1100, 'CTXC');
  await setupScenario(p);
  await ev(p, () => { setTaskStatus('tB', 'doing', 'test'); renderPage(); });
  await p.waitForTimeout(220);
  const impacted = await readCards(p);
  ok(impacted['Tache B aval'].impacted && !impacted['Tache B aval'].follow, 'KAN-CTX-C : B doing sans incident propre → SOUS IMPACT (jamais À SUIVRE)', 'KAN-CTX-C');
  // B reçoit son propre incident
  await ev(p, () => { app.issues.push({ id: 'iB', projectId: 'keravel', taskId: 'tB', status: 'open', severity: 'warning', source: 'field', title: 'Incident propre a B', comment: 'x' }); save(); renderPage(); });
  await p.waitForTimeout(220);
  const own = await readCards(p);
  note('KAN-CTX-C', own['Tache B aval']);
  ok(own['Tache B aval'].follow && own['Tache B aval'].labels.includes('À SUIVRE'), 'KAN-CTX-C : B doing + incident propre → À SUIVRE', 'KAN-CTX-C');
  ok(!own['Tache B aval'].impacted, 'KAN-CTX-C : SOUS IMPACT disparaît (incident direct prioritaire, §5)', 'KAN-CTX-C');
  ok(own['Tache C aval'].impacted, 'KAN-CTX-C : C reste SOUS IMPACT', 'KAN-CTX-C');
  // Résolution de l'incident propre de B : retour à SOUS IMPACT (A toujours ouvert)
  await ev(p, () => { app.issues.find((i) => i.id === 'iB').status = 'resolved'; save(); renderPage(); });
  await p.waitForTimeout(220);
  const back = await readCards(p);
  note('KAN-CTX-C', back['Tache B aval']);
  ok(!back['Tache B aval'].follow, 'KAN-CTX-C : incident propre résolu → plus de À SUIVRE', 'KAN-CTX-C');
  ok(back['Tache B aval'].impacted, 'KAN-CTX-C : B redevient SOUS IMPACT (incident amont toujours ouvert, §23)', 'KAN-CTX-C');
  // Résolution de l'incident amont : plus aucun badge (§24)
  await ev(p, () => { app.issues.find((i) => i.id === 'iA').status = 'resolved'; save(); renderPage(); });
  await p.waitForTimeout(220);
  const none = await readCards(p);
  ok(['Tache A source', 'Tache B aval', 'Tache C aval'].every((n) => none[n].labels.length === 0), 'KAN-CTX-C : tous incidents résolus → aucun badge sur A, B, C (§24)', 'KAN-CTX-C');
  await ctx.close();
}

// ---- KAN-CTX-D : tâche terminée avec incident direct ouvert → POINT OUVERT (§9/§25) ----
console.log('\n[KAN-CTX-D] Tâche terminée + incident ouvert → POINT OUVERT');
{
  const { ctx, p } = await newPage(1440, 1100, 'CTXD');
  await setupScenario(p, `
    task('tZ').status = 'done';
    app.issues.push({ id: 'iZ', projectId: 'keravel', taskId: 'tZ', status: 'open', severity: 'warning', source: 'field', title: 'Reserve sur Z', comment: 'Sujet historique.' });
    save(); renderPage();
  `);
  const c = await readCards(p);
  note('KAN-CTX-D', c['Tache Z isolee']);
  ok(c['Tache Z isolee'].col === 'done', 'KAN-CTX-D : la tâche est en colonne « Terminée »', 'KAN-CTX-D');
  ok(c['Tache Z isolee'].openPoint && c['Tache Z isolee'].labels.includes('POINT OUVERT'), 'KAN-CTX-D : badge « POINT OUVERT »', 'KAN-CTX-D');
  ok(!c['Tache Z isolee'].attention && !c['Tache Z isolee'].follow, 'KAN-CTX-D : jamais « À TRAITER » ni « À SUIVRE » sur une tâche terminée', 'KAN-CTX-D');
  const protectedDone = await ev(p, () => {
    const cards = [...document.querySelectorAll('.kanban-col[data-status="done"] .kanban-card')];
    return cards.every((x) => x.getAttribute('draggable') !== 'true');
  });
  ok(protectedDone, 'KAN-CTX-D : la tâche terminée reste non draggable (V2.4.10.1, §9)', 'KAN-CTX-D');
  const stillDone = await ev(p, () => task('tZ').status);
  ok(stillDone === 'done', 'KAN-CTX-D : la tâche n’est pas rouverte', 'KAN-CTX-D');
  await p.screenshot({ path: SHOTS + '15-done-point-ouvert.png', fullPage: true });
  await ctx.close();
}

// ---- KAN-CTX-E : les quatre libellés coexistent et sont distincts (§27/§28) ----
console.log('\n[KAN-CTX-E] Quatre libellés simultanés');
{
  const { ctx, p } = await newPage(1440, 1200, 'CTXE');
  await setupScenario(p, `
    // A todo + incident      -> À TRAITER
    // tD doing + incident    -> À SUIVRE
    // B / C conséquence      -> SOUS IMPACT
    // tZ done + incident     -> POINT OUVERT
    const D2 = localDateKey(date(app.ui.periodAnchor || TODAY));
    task('tZ').status = 'done';
    app.tasks.push({ id: 'tD', projectId: 'keravel', name: 'Tache D demarree', resourceId: task('tA').resourceId, start: D2 + 'T09:00', end: D2 + 'T11:00', status: 'doing', deps: [] });
    app.issues.push(
      { id: 'iZ', projectId: 'keravel', taskId: 'tZ', status: 'open', severity: 'warning', source: 'field', title: 'Reserve Z', comment: 'x' },
      { id: 'iD', projectId: 'keravel', taskId: 'tD', status: 'open', severity: 'warning', source: 'field', title: 'Sujet D', comment: 'x' },
    );
    save(); renderPage();
  `);
  const c = await readCards(p);
  note('KAN-CTX-E', { A: c['Tache A source'].labels, D: c['Tache D demarree'].labels, B: c['Tache B aval'].labels, Z: c['Tache Z isolee'].labels });
  ok(c['Tache A source'].labels.includes('À TRAITER'), 'KAN-CTX-E : À TRAITER présent', 'KAN-CTX-E');
  ok(c['Tache D demarree'].labels.includes('À SUIVRE'), 'KAN-CTX-E : À SUIVRE présent', 'KAN-CTX-E');
  ok(c['Tache B aval'].labels.includes('SOUS IMPACT'), 'KAN-CTX-E : SOUS IMPACT présent', 'KAN-CTX-E');
  ok(c['Tache Z isolee'].labels.includes('POINT OUVERT'), 'KAN-CTX-E : POINT OUVERT présent', 'KAN-CTX-E');
  const four = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color, bd: cs.borderTopWidth }; };
    return { attention: g('.kanban-badge.attention'), follow: g('.kanban-badge.follow'), impacted: g('.kanban-badge.impacted'), openPoint: g('.kanban-badge.open-point') };
  });
  note('KAN-CTX-E', four);
  const keys = ['attention', 'follow', 'impacted', 'openPoint'];
  const pairs = keys.flatMap((a, i) => keys.slice(i + 1).map((b) => [a, b]));
  ok(pairs.every(([a, b]) => four[a].bg !== four[b].bg || four[a].fg !== four[b].fg), 'KAN-CTX-E : les 4 badges sont deux à deux distincts (clair)', 'KAN-CTX-E');
  ok(four.attention.bd === '0px' && four.follow.bd !== '0px', 'KAN-CTX-E : À TRAITER plein / À SUIVRE contouré — hiérarchie d’action lisible (§10/§11)', 'KAN-CTX-E');
  await p.screenshot({ path: SHOTS + '16-quatre-libelles-clair.png', fullPage: true });

  // Dark mode sur la même vue (§28)
  await ev(p, () => { app.settings.theme = 'dark'; document.body.classList.add('dark'); save(); renderPage(); });
  await p.waitForTimeout(220);
  const dark = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color }; };
    return { attention: g('.kanban-badge.attention'), follow: g('.kanban-badge.follow'), impacted: g('.kanban-badge.impacted'), openPoint: g('.kanban-badge.open-point'), rework: g('.kanban-badge.rework') };
  });
  note('KAN-CTX-E', dark);
  ok(keys.every((k) => dark[k]), 'KAN-CTX-E : les 4 badges coexistent en mode sombre', 'KAN-CTX-E');
  ok(pairs.every(([a, b]) => dark[a].bg !== dark[b].bg || dark[a].fg !== dark[b].fg), 'KAN-CTX-E : les 4 badges restent deux à deux distincts (sombre)', 'KAN-CTX-E');
  const noRed = await ev(p, () => ['follow', 'open-point', 'impacted'].every((k) => {
    const e = document.querySelector('.kanban-badge.' + k);
    const m = getComputedStyle(e).color.match(/\d+/g).map(Number);
    return !(m[0] > 150 && m[1] < 110 && m[2] < 110);
  }));
  ok(noRed, 'KAN-CTX-E : aucun rouge sur À SUIVRE / POINT OUVERT / SOUS IMPACT', 'KAN-CTX-E');
  await p.screenshot({ path: SHOTS + '17-quatre-libelles-dark.png', fullPage: true });
  await ctx.close();
}

// ---- KAN-CTX-F : responsive avec les quatre badges (§29) ----
console.log('\n[KAN-CTX-F] Responsive — quatre badges');
{
  const SETUP = `
    const D2 = localDateKey(date(app.ui.periodAnchor || TODAY));
    task('tZ').status = 'done';
    task('tA').reworkOfTaskId = 'tZ';
    app.tasks.push({ id: 'tD', projectId: 'keravel', name: 'Tache D demarree', resourceId: task('tA').resourceId, start: D2 + 'T09:00', end: D2 + 'T11:00', status: 'doing', deps: [] });
    app.issues.push(
      { id: 'iZ', projectId: 'keravel', taskId: 'tZ', status: 'open', severity: 'warning', source: 'field', title: 'Reserve Z', comment: 'x' },
      { id: 'iD', projectId: 'keravel', taskId: 'tD', status: 'open', severity: 'warning', source: 'field', title: 'Sujet D', comment: 'x' },
    );
    save(); renderPage();
  `;
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1100, 'CTXF-' + w);
    await setupScenario(p, SETUP);
    const r = await ev(p, () => {
      let overflow = 0;
      document.querySelectorAll('.kanban-card').forEach((c) => {
        const cr = c.getBoundingClientRect();
        c.querySelectorAll('.kanban-badge').forEach((bg) => {
          const br = bg.getBoundingClientRect();
          if (br.right > cr.right + 1 || br.left < cr.left - 1) overflow++;
        });
      });
      return {
        overflow,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        kinds: ['attention', 'follow', 'impacted', 'open-point'].filter((k) => document.querySelector('.kanban-badge.' + k)).length,
      };
    });
    note('KAN-CTX-F', { w, ...r });
    ok(r.kinds === 4, `KAN-CTX-F : ${w}px — les 4 types de badges sont rendus`, 'KAN-CTX-F');
    ok(r.overflow === 0, `KAN-CTX-F : ${w}px — aucun badge ne déborde de sa carte`, 'KAN-CTX-F');
    ok(!r.hscroll, `KAN-CTX-F : ${w}px — aucun scroll horizontal de page`, 'KAN-CTX-F');
    if (w === 390) await p.screenshot({ path: SHOTS + '18-mobile-390-quatre.png', fullPage: true });
    await ctx.close();
  }
}

// ---- KAN-CTX-G : aucune mutation métier, aucune persistance (§32/§33) ----
console.log('\n[KAN-CTX-G] Aucune mutation, aucune persistance');
{
  const { ctx, p } = await newPage(1440, 1100, 'CTXG');
  await setupScenario(p);
  const r = await ev(p, () => {
    const snap = () => JSON.stringify({
      tasks: app.tasks.map((t) => ({ id: t.id, status: t.status, deps: t.deps, start: t.start, end: t.end })),
      issues: app.issues.map((i) => ({ id: i.id, taskId: i.taskId, status: i.status })),
      impacted: [...impactChainSet()].sort(),
      sources: [...impactChainSources()].sort(),
    });
    const before = snap();
    kanbanBoard('all'); kanbanBoard('all'); kanbanBoard('keravel');
    const after = snap();
    return {
      pure: before === after,
      persisted: app.tasks.some((t) => ['attentionState', 'issueBadge', 'followState', 'impactBadge', 'isImpacted', 'impactStatus', 'attentionBadge'].some((k) => k in t)),
      labelPure: (() => {
        const t = task('tA'), s0 = t.status;
        const l1 = kanbanDirectIssueLabel(t).text;
        return s0 === t.status && l1 === 'À traiter';
      })(),
      matrix: ['todo', 'waiting', 'late', 'doing', 'done'].map((st) => kanbanDirectIssueLabel({ status: st }).text),
      schema: SCHEMA_VERSION,
      store: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
    };
  });
  note('KAN-CTX-G', r);
  ok(r.pure, 'KAN-CTX-G : rendre le Kanban ne modifie ni statuts, ni deps, ni incidents, ni chaîne d’impact (§32)', 'KAN-CTX-G');
  ok(!r.persisted, 'KAN-CTX-G : aucun champ de badge persisté sur les tâches (§33)', 'KAN-CTX-G');
  ok(r.labelPure, 'KAN-CTX-G : kanbanDirectIssueLabel() ne mute pas la tâche', 'KAN-CTX-G');
  ok(JSON.stringify(r.matrix) === JSON.stringify(['À traiter', 'À traiter', 'À traiter', 'À suivre', 'Point ouvert']), 'KAN-CTX-G : matrice todo/waiting/late→À traiter, doing→À suivre, done→Point ouvert', 'KAN-CTX-G');
  ok(r.schema === 8, 'KAN-CTX-G : SCHEMA_VERSION inchangé (8)', 'KAN-CTX-G');
  ok(r.store.every((k) => k === 'kanvix-product-8-3'), 'KAN-CTX-G : STORE inchangé', 'KAN-CTX-G');
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
