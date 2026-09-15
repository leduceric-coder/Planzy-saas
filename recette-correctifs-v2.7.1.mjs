// ============================================================
// KANVIX — Recette « Correctifs UX » (V2.7.1)
//
//   DEUX défauts d'usage, et rien d'autre :
//
//     1. Mode Chantier — le bouton « Chantier » de la barre basse semblait
//        inactif : déjà sur un chantier, cliquer dessus réaffichait le MÊME
//        écran. Il remonte désormais d'un niveau, de façon contextuelle.
//
//     2. Contrôles qualité — terminer une intervention créait bien le
//        contrôle, mais Kanvix répondait « Tâche mise à jour » : personne ne
//        pouvait deviner qu'un contrôle venait d'apparaître.
//
//   La question à laquelle cette recette répond :
//     « V2.7.1 rend-elle le processus qualité visible au moment exact où il
//       devient pertinent, et la navigation du Mode Chantier prévisible,
//       SANS toucher à une seule règle métier de V2.7.0 ? »
//
//   Usage : node recette-correctifs-v2.7.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.7.1.html';
const PREV = 'kanvix-next-gen-v2.7.0.html';
const NOW = '2026-09-14T10:15:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.7.1/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 800)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1440, h = 900, tag = 'x', file = CUR, role = 'driver', field = false } = opts;
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
  await p.evaluate(
    ({ role, field }) => {
      resetApp();
      setDepth('pilot');
      setRole(role);
      dismissKanvixContinuityNotice();
      if (field) {
        app.settings.driverMode = 'field';
        app.ui.fieldTab = 'site';
        save();
        renderPage();
      }
    },
    { role, field },
  );
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, opts = {}) => {
  await p.waitForTimeout(320);
  await p.screenshot({ path: SHOTS + name, ...opts });
};
// Clic RÉEL sur le bouton « Chantier » de la barre basse — jamais un appel
// direct à la fonction : c'est le bouton que l'utilisateur trouvait KO.
const clickSiteTab = async (p) => {
  await ev(p, () =>
    [...document.querySelectorAll('.field-bottom button')]
      .find((x) => /Chantier/.test(x.textContent))
      .click(),
  );
  await p.waitForTimeout(220);
};
const onPicker = (p) => ev(p, () => /Choisir un chantier/.test(document.body.textContent));

// ============================================================
// FIELD271-01 → 07 — MODE CHANTIER : LE BOUTON « CHANTIER »
// ============================================================
console.log('\n[FIELD271] Mode Chantier — le bouton « Chantier » remonte d’un niveau');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'FIELD', field: true });

  // ---- FIELD271-01 : sélection d'un chantier.
  const sel = await ev(p, () => {
    selectFieldProject('keravel');
    return {
      pid: app.ui.fieldProjectId,
      head: document.querySelector('.field-project-head h1')?.textContent,
      tab: app.ui.fieldTab,
    };
  });
  await p.waitForTimeout(150);
  note('FIELD271-01', sel);
  ok(sel.pid === 'keravel' && sel.head === 'Résidence Keravel',
    'FIELD271-01 : sélectionner un chantier affiche son écran principal (fieldProjectId = keravel)', 'FIELD271-01');
  await shot(p, '01-field-project-selected.png', { fullPage: true });

  // ---- FIELD271-02 : LE BUG UTILISATEUR. Déjà sur le chantier, un clic
  //      RÉEL sur « Chantier » doit produire quelque chose de visible.
  const before = await ev(p, () => document.querySelector('.field-scroll').textContent.trim().slice(0, 120));
  await clickSiteTab(p);
  const after = await ev(p, () => ({
    pid: app.ui.fieldProjectId,
    tab: app.ui.fieldTab,
    body: document.querySelector('.field-scroll').textContent.trim().slice(0, 120),
    picker: /Choisir un chantier/.test(document.body.textContent),
  }));
  note('FIELD271-02', { avant: before.slice(0, 60), après: after.body.slice(0, 60), pid: after.pid });
  ok(after.pid === null && after.picker && after.body !== before,
    'FIELD271-02 : depuis l’écran principal d’un chantier, un clic RÉEL sur « Chantier » remonte à « Choisir un chantier » — l’écran change enfin', 'FIELD271-02');
  ok(after.tab === 'site',
    'FIELD271-02 : l’onglet reste « site » — remonter d’un niveau ne quitte pas l’onglet Chantier', 'FIELD271-02');
  await shot(p, '02-field-project-picker-after-site-click.png', { fullPage: true });

  // ---- FIELD271-05 : déjà sur le sélecteur, un second clic ne fait rien de
  //      parasite (on ne « remonte » pas dans le vide).
  const second = await (async () => {
    const dom = await ev(p, () => document.querySelector('.field-scroll').textContent.trim().slice(0, 120));
    await clickSiteTab(p);
    return {
      pid: await ev(p, () => app.ui.fieldProjectId),
      picker: await onPicker(p),
      same: (await ev(p, () => document.querySelector('.field-scroll').textContent.trim().slice(0, 120))) === dom,
    };
  })();
  note('FIELD271-05', second);
  ok(second.pid === null && second.picker && second.same,
    'FIELD271-05 : sur « Choisir un chantier », un nouveau clic n’a aucun effet parasite — on y est déjà', 'FIELD271-05');

  // ---- FIELD271-03 : Planning mobile → écran principal du chantier.
  await ev(p, () => { selectFieldProject('keravel'); openFieldPlanning('k-windows'); });
  await p.waitForTimeout(220);
  const inPlanning = await ev(p, () => app.ui.fieldView);
  await clickSiteTab(p);
  const fromPlanning = await ev(p, () => ({
    pid: app.ui.fieldProjectId,
    view: app.ui.fieldView,
    head: document.querySelector('.field-project-head h1')?.textContent,
  }));
  note('FIELD271-03', { avant: inPlanning, ...fromPlanning });
  ok(inPlanning === 'planning' && fromPlanning.view === 'site'
    && fromPlanning.pid === 'keravel' && fromPlanning.head === 'Résidence Keravel',
    'FIELD271-03 : depuis le Planning mobile, « Chantier » referme la sous-vue et revient au chantier — SANS le désélectionner', 'FIELD271-03');
  await shot(p, '03-field-planning-back-site.png', { fullPage: true });

  // ---- FIELD271-04 : Messages → écran principal du chantier.
  await ev(p, () => setFieldTab('messages'));
  await p.waitForTimeout(220);
  const inMessages = await ev(p, () => app.ui.fieldTab);
  await clickSiteTab(p);
  const fromMessages = await ev(p, () => ({
    pid: app.ui.fieldProjectId,
    tab: app.ui.fieldTab,
    head: document.querySelector('.field-project-head h1')?.textContent,
  }));
  note('FIELD271-04', { avant: inMessages, ...fromMessages });
  ok(inMessages === 'messages' && fromMessages.tab === 'site'
    && fromMessages.pid === 'keravel' && fromMessages.head === 'Résidence Keravel',
    'FIELD271-04 : depuis Messages, « Chantier » revient au chantier sélectionné — il ne le perd pas', 'FIELD271-04');
  await shot(p, '04-field-messages-back-site.png', { fullPage: true });

  // ---- FIELD271-06 : « Changer » reste le chemin explicite, inchangé.
  const changer = await ev(p, () => {
    const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Changer');
    if (!btn) return { present: false };
    btn.click();
    return { present: true, pid: app.ui.fieldProjectId, picker: /Choisir un chantier/.test(document.body.textContent) };
  });
  note('FIELD271-06', changer);
  ok(changer.present && changer.pid === null && changer.picker,
    'FIELD271-06 : le bouton « Changer » du header reste fonctionnel — clearFieldProject() n’a pas été supprimée', 'FIELD271-06');

  // ---- FIELD271-07 : barre basse stable, aucun débordement.
  const bar = await ev(p, () => {
    const probe = () => {
      const n = document.querySelector('.field-bottom');
      const r = n.getBoundingClientRect();
      return {
        top: Math.round(r.top), h: Math.round(r.height),
        labels: [...n.querySelectorAll('button span:not(.field-badge)')].map((x) => x.textContent.trim()),
        active: [...n.querySelectorAll('button')].map((x) => x.classList.contains('active')),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    };
    const states = [];
    selectFieldProject('keravel'); states.push(probe());
    handleFieldSiteTab(); states.push(probe());
    setFieldTab('messages'); states.push(probe());
    return states;
  });
  note('FIELD271-07', bar);
  ok(bar.every((s) => s.top === bar[0].top && s.h === bar[0].h && s.overflow <= 0)
    && bar.every((s) => s.labels.join('|') === 'Chantier|Messages'),
    'FIELD271-07 : à 390px la barre basse ne bouge pas d’un pixel entre les états, et rien ne déborde', 'FIELD271-07');

  // ---- FIELD271-07bis : le bouton reste ACTIF quand il sert à remonter.
  const activeState = await ev(p, () => {
    selectFieldProject('keravel');
    handleFieldSiteTab();
    const btn = [...document.querySelectorAll('.field-bottom button')].find((x) => /Chantier/.test(x.textContent));
    return { picker: /Choisir un chantier/.test(document.body.textContent), active: btn.classList.contains('active') };
  });
  note('FIELD271-07bis', activeState);
  ok(activeState.picker && activeState.active,
    'FIELD271-07 : sur le sélecteur, le bouton « Chantier » reste visuellement ACTIF — pas de chevron, pas de nouvelle icône', 'FIELD271-07');

  await ctx.close();
}

// ============================================================
// FIELD271-GEL — setFieldTab() n'a pas changé
// ============================================================
console.log('\n[FIELD271-GEL] setFieldTab() reste l’API programmatique de V2.7.0');
{
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
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
  const a = extract(prevSrc, 'setFieldTab'), c = extract(curSrc, 'setFieldTab');
  note('FIELD271-GEL', { v270: a ? md5(a).slice(0, 10) : 'ABSENT', v271: c ? md5(c).slice(0, 10) : 'ABSENT' });
  ok(a && c && md5(a) === md5(c),
    'FIELD271-GEL : setFieldTab() est BYTE-IDENTIQUE à V2.7.0 — les retours programmatiques (fin de conversation, fin de reprise) ne changent pas de comportement', 'FIELD271-GEL');
  const cf = extract(curSrc, 'clearFieldProject'), cfa = extract(prevSrc, 'clearFieldProject');
  ok(cf && cfa && md5(cf) === md5(cfa),
    'FIELD271-GEL : clearFieldProject() est byte-identique — le bouton « Changer » n’a pas été réécrit', 'FIELD271-GEL');
}

// ============================================================
// QUAL271-01 → 20 — VISIBILITÉ DU CONTRÔLE QUALITÉ
// ============================================================
console.log('\n[QUAL271] Le contrôle devient visible au moment où il devient pertinent');
{
  const { ctx, p } = await newPage({ tag: 'QUAL' });
  const reset = () => ev(p, () => { resetApp(); setDepth('pilot'); setRole('driver'); closeOverlay('modal'); });

  // ---- QUAL271-01 : la démonstration n'est PAS truquée. k-windows n'a
  //      aucune instance au départ — la création sera dynamique.
  const start = await ev(p, () => ({
    windows: controlsForTask('k-windows').length,
    applicable: applicableControlTemplates(task('k-windows')).map((t) => t.id),
    demo: app.controlInstances.map((c) => c.taskId),
  }));
  note('QUAL271-01', start);
  ok(start.windows === 0 && start.applicable.includes('ctl-menuiseries-pose') && start.demo.join() === 'k-cloisons',
    'QUAL271-01 : « Pose des 6 fenêtres » n’a AUCUN contrôle au départ, alors qu’un modèle s’y applique — la seule instance de démonstration reste celle de k-cloisons', 'QUAL271-01');

  // ---- QUAL271-02 : le passage à « en cours » matérialise le contrôle.
  const doing = await ev(p, () => {
    const out = setTaskStatus('k-windows', 'doing');
    return { status: task('k-windows').status, controls: controlsForTask('k-windows').map((c) => ({ tpl: c.templateId, st: c.status })), outcome: out };
  });
  note('QUAL271-02', doing);
  ok(doing.status === 'doing' && doing.controls.length === 1 && doing.controls[0].tpl === 'ctl-menuiseries-pose',
    'QUAL271-02 : passer l’intervention à « en cours » crée son contrôle (moteur V2.7.0 inchangé)', 'QUAL271-02');
  ok(doing.outcome && doing.outcome.completed === false,
    'QUAL271-02 : setTaskStatus() retourne une information exploitable, et « completed » est faux pour une transition qui n’est pas une fin', 'QUAL271-02');

  // ---- QUAL271-03 : doing → done, tâche terminée, contrôle à faire.
  //      Le toast est remis à ZÉRO juste avant la transition observée : celui
  //      qui traîne vient du passage à « en cours » (il vit 4 s). Sans cette
  //      remise à zéro, QUAL271-20 mesurerait le toast de l'étape précédente.
  const done = await ev(p, () => {
    closeOverlay('modal');
    const t = document.querySelector('#toast');
    t.textContent = '';
    t.classList.remove('show');
    const out = setTaskStatus('k-windows', 'done');
    const c = controlsForTask('k-windows')[0];
    return { status: task('k-windows').status, ctrl: c.status, blocking: c.blocking, outcome: out };
  });
  note('QUAL271-03', done);
  ok(done.status === 'done' && done.ctrl === 'todo' && done.blocking === false,
    'QUAL271-03 : l’intervention est TERMINÉE et son contrôle reste À CONTRÔLER — c’est exactement la distinction que Kanvix doit rendre lisible', 'QUAL271-03');
  ok(done.outcome.completed === true && done.outcome.pendingQualityIds.length === 1,
    'QUAL271-03 : setTaskStatus() retourne { completed: true, pendingQualityIds: [1] } — l’information circule sans que le moteur devienne un écran', 'QUAL271-03');

  // ---- QUAL271-04 : le popup dit ce qui s'est passé ET ce qui reste.
  const popup = await ev(p, () => {
    const m = document.querySelector('#modalContent');
    return {
      open: document.querySelector('#modal').classList.contains('open'),
      text: m.textContent,
      eyebrow: m.querySelector('.muted')?.textContent,
      title: m.querySelector('h2')?.textContent,
    };
  });
  note('QUAL271-04', { eyebrow: popup.eyebrow, title: popup.title });
  ok(popup.open
    && /INTERVENTION TERMIN/i.test(popup.text)
    && /Pose des 6 fenêtres/.test(popup.text)
    && /contrôle qualité reste à effectuer/i.test(popup.text)
    && /Contrôle pose menuiseries extérieures/.test(popup.text),
    'QUAL271-04 : le retour nomme l’intervention terminée, le nombre de contrôles restants ET le contrôle concerné', 'QUAL271-04');
  await shot(p, '05-quality-after-done.png');

  // ---- QUAL271-05 : deux issues, pas une.
  const btns = await ev(p, () => [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim()));
  note('QUAL271-05', btns);
  ok(btns.length === 2 && /Plus tard/.test(btns[0]) && /Contrôler maintenant/.test(btns[1]),
    'QUAL271-05 : deux issues seulement — « Plus tard » et « Contrôler maintenant ». Kanvix propose, il n’impose pas', 'QUAL271-05');

  // ---- QUAL271-20 : AUCUN toast générique en doublon.
  const toast = await ev(p, () => {
    const t = document.querySelector('#toast');
    return { text: t.textContent.trim(), shown: t.classList.contains('show') };
  });
  note('QUAL271-20', toast);
  ok(toast.text === '' && !toast.shown,
    'QUAL271-20 : aucun toast « Tâche mise à jour » simultané — le popup EST le retour principal, il ne partage pas l’attention', 'QUAL271-20');

  // ---- QUAL271-06 : « Plus tard » ne mute rien.
  const later = await ev(p, () => {
    const before = {
      issues: app.issues.length, decisions: app.decisions.length, messages: app.messages.length,
      tasks: app.tasks.length, reworks: app.tasks.filter((t) => t.reworkOfTaskId).length,
      qualityEvents: app.history.filter((h) => h.eventType === 'quality-control').length,
    };
    [...document.querySelectorAll('#modalContent button')].find((x) => /Plus tard/.test(x.textContent)).click();
    const c = controlsForTask('k-windows')[0];
    return {
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      taskStatus: task('k-windows').status,
      ctrl: c.status, attempts: c.attempts.length,
      delta: {
        issues: app.issues.length - before.issues,
        decisions: app.decisions.length - before.decisions,
        messages: app.messages.length - before.messages,
        tasks: app.tasks.length - before.tasks,
        reworks: app.tasks.filter((t) => t.reworkOfTaskId).length - before.reworks,
        qualityEvents: app.history.filter((h) => h.eventType === 'quality-control').length - before.qualityEvents,
      },
    };
  });
  note('QUAL271-06', later);
  ok(!later.modalOpen && later.taskStatus === 'done' && later.ctrl === 'todo' && later.attempts === 0
    && Object.values(later.delta).every((v) => v === 0),
    'QUAL271-06 : « Plus tard » ferme et c’est tout — aucune tentative, aucune reprise, aucun incident, aucun événement qualité', 'QUAL271-06');
  await shot(p, '06-quality-do-later.png');

  // ---- QUAL271-07 : le contrôle se retrouve sur la fiche tâche.
  const sheet = await ev(p, () => {
    openTask('k-windows');
    const s = document.querySelector('.qc-section');
    return { present: !!s, h3: s?.querySelector('h3')?.textContent, rows: [...(s?.querySelectorAll('.qc-row b') || [])].map((x) => x.textContent) };
  });
  note('QUAL271-07', sheet);
  ok(sheet.present && /1 à faire/.test(sheet.h3) && sheet.rows.includes('Contrôle pose menuiseries extérieures'),
    'QUAL271-07 : après « Plus tard », le contrôle est visible sur la fiche tâche — il n’a pas disparu avec le popup', 'QUAL271-07');

  // ---- QUAL271-08 : et dans l'onglet Aujourd'hui du chantier.
  const today = await ev(p, () => {
    closeOverlay('drawer');
    openProjectTab('keravel', 'Aujourd’hui');
    const qb = document.querySelector('.qc-block');
    return { present: !!qb, title: qb?.querySelector('.qc-block-title')?.textContent, rows: [...(qb?.querySelectorAll('.qc-row b') || [])].map((x) => x.textContent) };
  });
  note('QUAL271-08', today);
  ok(today.present && today.rows.includes('Contrôle pose menuiseries extérieures'),
    'QUAL271-08 : le contrôle figure aussi dans « Contrôles à faire » de l’onglet Aujourd’hui (niveau Pilotage)', 'QUAL271-08');

  // ---- QUAL271-10 : « Contrôler maintenant » ouvre le formulaire EXISTANT.
  await reset();
  const now = await ev(p, () => {
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    setTaskStatus('k-windows', 'done');
    const cid = controlsForTask('k-windows')[0].id;
    [...document.querySelectorAll('#modalContent button')].find((x) => /Contrôler maintenant/.test(x.textContent)).click();
    const form = document.querySelector('#controlFormEl');
    return {
      form: !!form,
      control: form?.dataset.control,
      expected: cid,
      drawer: document.querySelector('#drawer').classList.contains('open'),
      items: document.querySelectorAll('.qc-item').length,
      actions: [...document.querySelectorAll('.qc-actions .btn')].map((x) => x.textContent.trim()),
    };
  });
  note('QUAL271-10', now);
  ok(now.form && now.control === now.expected && now.drawer && now.items === 4
    && now.actions.join('|') === 'Non conforme|Conforme',
    'QUAL271-10 : « Contrôler maintenant » ouvre le contrôle EXISTANT dans le formulaire existant (sidewindow au bureau)', 'QUAL271-10');
  await shot(p, '08-quality-control-now.png');

  // ---- QUAL271-11 : aucune duplication de moteur en V2.7.1.
  const single = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    const count = (re) => (src.match(re) || []).length;
    return {
      formHTML: count(/function controlFormHTML\s*\(/g),
      submit: count(/function submitControlAttempt\s*\(/g),
      openForm: count(/function openControlForm\s*\(/g),
      prompt: count(/function showPostCompletionQualityPrompt\s*\(/g),
      strays: count(/function (controlFormV271|quickControlForm|postControlForm)\s*\(/g),
    };
  });
  note('QUAL271-11', single);
  ok(single.formHTML === 1 && single.submit === 1 && single.openForm === 1
    && single.prompt === 1 && single.strays === 0,
    'QUAL271-11 : un seul controlFormHTML(), un seul submitControlAttempt(), un seul openControlForm() — V2.7.1 n’a écrit AUCUN second formulaire', 'QUAL271-11');

  // ---- QUAL271-12 : une tâche sans modèle applicable garde le retour historique.
  await reset();
  const noQuality = await ev(p, () => {
    const t = app.tasks.find((x) => !applicableControlTemplates(x).length && x.status !== 'done');
    setTaskStatus(t.id, 'done');
    return {
      task: t.name,
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      toast: document.querySelector('#toast').textContent.trim(),
      status: task(t.id).status,
    };
  });
  note('QUAL271-12', noQuality);
  ok(!noQuality.modalOpen && /Tâche mise à jour/.test(noQuality.toast) && noQuality.status === 'done',
    'QUAL271-12 : sans contrôle applicable, AUCUN popup et le toast historique est conservé — V2.7.1 n’ajoute rien quand il n’y a rien à dire', 'QUAL271-12');

  // ---- QUAL271-13 : un contrôle BLOQUANT garde le comportement V2.7.0.
  await reset();
  const blocking = await ev(p, () => {
    control('ctrl-k-cloisons-001').blocking = true;
    const out = setTaskStatus('k-cloisons', 'done');
    const txt = document.querySelector('#modalContent').textContent;
    return {
      status: task('k-cloisons').status,
      requis: /Contrôle qualité requis/.test(txt),
      termine: /INTERVENTION TERMIN/i.test(txt),
      effectuer: /Effectuer le contrôle/.test(txt),
      outcome: out,
    };
  });
  note('QUAL271-13', blocking);
  ok(blocking.status !== 'done' && blocking.requis && !blocking.termine && blocking.effectuer,
    'QUAL271-13 : contrôle bloquant — refus historique, popup « Contrôle qualité requis », et JAMAIS « Intervention terminée »', 'QUAL271-13');
  ok(blocking.outcome === undefined || blocking.outcome === null,
    'QUAL271-13 : un refus ne retourne aucun succès — l’information de post-completion ne peut pas être déclenchée à tort', 'QUAL271-13');

  // ---- QUAL271-16 : passage par le KANBAN.
  await reset();
  const kanban = await ev(p, () => {
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    const t = document.querySelector('#toast'); t.textContent = ''; t.classList.remove('show');
    setTaskStatus('k-windows', 'done', 'kanban');
    const m = document.querySelector('#modalContent');
    return {
      status: task('k-windows').status,
      open: document.querySelector('#modal').classList.contains('open'),
      quality: /INTERVENTION TERMIN/i.test(m.textContent),
      toast: document.querySelector('#toast').textContent.trim(),
    };
  });
  note('QUAL271-16', kanban);
  ok(kanban.status === 'done' && kanban.open && kanban.quality && !/Tâche déplacée/.test(kanban.toast),
    'QUAL271-16 : le glissé-déposé Kanban reçoit le même retour qualité, et son toast « Tâche déplacée » ne vient pas s’y superposer', 'QUAL271-16');

  // ---- QUAL271-17 : passage par la FICHE TÂCHE (bouton réel).
  await reset();
  const sheetPath = await ev(p, () => {
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    openTask('k-windows');
    const btn = [...document.querySelectorAll('#drawerContent .task-actions .btn')].find((x) => /Terminer/.test(x.textContent));
    if (!btn) return { btn: false };
    btn.click();
    return {
      btn: true,
      status: task('k-windows').status,
      quality: /INTERVENTION TERMIN/i.test(document.querySelector('#modalContent').textContent),
    };
  });
  note('QUAL271-17', sheetPath);
  ok(sheetPath.btn && sheetPath.status === 'done' && sheetPath.quality,
    'QUAL271-17 : le bouton « Terminer » de la fiche tâche déclenche le même retour qualité', 'QUAL271-17');

  // ---- QUAL271-18 : passage par l'ÉDITEUR UNIVERSEL (transactionnel).
  await reset();
  const editor = await ev(p, () => {
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    openTaskEdit('k-windows', 'planning-gantt');
    const f = document.querySelector('#taskEditFormEl') || document.querySelector('#drawerContent form');
    const sel = f.querySelector('[name=status]');
    sel.value = 'done';
    if (typeof markTaskEditDirty === 'function') markTaskEditDirty();
    f.requestSubmit();
    return {
      status: task('k-windows').status,
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      text: document.querySelector('#modalContent').textContent.slice(0, 160),
      pendingEdit: !!app.ui.pendingTaskEdit,
    };
  });
  note('QUAL271-18', editor);
  ok(editor.status === 'done' && editor.modalOpen && /INTERVENTION TERMIN/i.test(editor.text) && !editor.pendingEdit,
    'QUAL271-18 : l’éditeur universel affiche le retour qualité APRÈS finalisation de sa transaction — jamais au milieu', 'QUAL271-18');

  // ---- QUAL271-19 : aucun doublon de contrôle, quel que soit le chemin.
  const dedup = await ev(p, () => {
    setTaskStatus('k-windows', 'doing');
    ensureTaskControlInstances('k-windows');
    ensureTaskControlInstances('k-windows');
    const key = controlsForTask('k-windows').map((c) => c.taskId + '/' + c.templateId);
    return { n: key.length, unique: new Set(key).size };
  });
  note('QUAL271-19', dedup);
  ok(dedup.n === dedup.unique && dedup.n === 1,
    'QUAL271-19 : un seul ControlInstance par (intervention, modèle) — le retour V2.7.1 n’en crée aucun de plus', 'QUAL271-19');

  // ---- CAS 3 : PLUSIEURS contrôles ouverts.
  await reset();
  const many = await ev(p, () => {
    const tpl = controlTemplate('ctl-platrerie-cloisons');
    tpl.lotId = null; tpl.taskPattern = 'fenêtre';
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    setTaskStatus('k-windows', 'done');
    const m = document.querySelector('#modalContent');
    return {
      n: pendingControlsForTask('k-windows').length,
      text: m.textContent,
      btns: [...m.querySelectorAll('button')].map((x) => x.textContent.trim()),
      rows: m.querySelectorAll('.qc-row').length,
    };
  });
  note('QUAL271-CAS3', { n: many.n, btns: many.btns, rows: many.rows });
  ok(many.n === 2 && /2 contrôles qualité restent à effectuer/.test(many.text)
    && many.btns.join('|') === 'Plus tard|Voir les contrôles' && many.rows === 2,
    'QUAL271-CAS3 : avec deux contrôles, le pluriel est juste, les deux sont listés, et l’action devient « Voir les contrôles »', 'QUAL271-CAS3');

  // ---- « Voir les contrôles » reste sur CETTE intervention.
  const scoped = await ev(p, () => {
    [...document.querySelectorAll('#modalContent button')].find((x) => /Voir les contrôles/.test(x.textContent)).click();
    const s = document.querySelector('.qc-section');
    const drawerText = document.querySelector('#drawerContent').textContent;
    return {
      drawer: document.querySelector('#drawer').classList.contains('open'),
      isTaskSheet: /^TÂCHE/.test(drawerText.trim()),
      taskName: document.querySelector('#drawerContent h2')?.textContent,
      rows: s?.querySelectorAll('.qc-row').length,
      otherProjectControl: /Contrôle avant fermeture des cloisons/.test(drawerText) && /Cloisons étage 1/.test(drawerText),
    };
  });
  note('QUAL271-CAS3-scope', scoped);
  ok(scoped.drawer && scoped.isTaskSheet && scoped.taskName === 'Pose des 6 fenêtres' && scoped.rows === 2,
    'QUAL271-CAS3 : « Voir les contrôles » ouvre la fiche de CETTE intervention — jamais tous les contrôles du chantier', 'QUAL271-CAS3');

  await ctx.close();
}

// ============================================================
// QUAL271-14 / 15 — ARTISAN
// ============================================================
console.log('\n[QUAL271-ARTISAN] L’artisan ne contrôle toujours pas');
{
  const { ctx, p } = await newPage({ tag: 'ARTISAN', role: 'artisan' });

  // ---- QUAL271-14 : contrôle NON bloquant — il termine, sans checklist.
  const soft = await ev(p, () => {
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    const t = document.querySelector('#toast'); t.textContent = ''; t.classList.remove('show');
    setTaskStatus('k-windows', 'done');
    const m = document.querySelector('#modalContent');
    return {
      status: task('k-windows').status,
      ctrl: controlsForTask('k-windows')[0]?.status,
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      controlerMaintenant: /Contrôler maintenant/.test(m.textContent),
      checklist: document.querySelectorAll('.qc-item').length,
      toast: document.querySelector('#toast').textContent.trim(),
    };
  });
  note('QUAL271-14', soft);
  ok(soft.status === 'done' && soft.ctrl === 'todo' && !soft.controlerMaintenant && soft.checklist === 0,
    'QUAL271-14 : l’artisan termine son intervention, le contrôle reste à faire — et on ne lui propose NI « Contrôler maintenant » NI la moindre checklist', 'QUAL271-14');
  ok(/Tâche mise à jour/.test(soft.toast),
    'QUAL271-14 : l’artisan garde son retour simple et léger — V2.7.1 n’alourdit pas son écran', 'QUAL271-14');
  await shot(p, '09-quality-artisan-completion.png');

  // ---- QUAL271-15 : contrôle BLOQUANT — comportement V2.7.0 à l'identique.
  const hard = await ev(p, () => {
    resetApp(); setDepth('pilot'); setRole('artisan');
    control('ctrl-k-cloisons-001').blocking = true;
    setTaskStatus('k-cloisons', 'done');
    const m = document.querySelector('#modalContent');
    return {
      status: task('k-cloisons').status,
      requis: /Contrôle qualité requis/.test(m.textContent),
      btns: [...m.querySelectorAll('button')].map((x) => x.textContent.trim()),
    };
  });
  note('QUAL271-15', hard);
  ok(hard.status !== 'done' && hard.requis && hard.btns.join('|') === 'Compris',
    'QUAL271-15 : contrôle bloquant + artisan — refus, explication seule, un seul bouton « Compris ». Strictement V2.7.0', 'QUAL271-15');

  await ctx.close();
}

// ============================================================
// QUAL271-09 — MODE CHANTIER : le contrôle apparaît dans « À contrôler »
// ============================================================
console.log('\n[QUAL271-FIELD] Mode Chantier — le contrôle créé dynamiquement apparaît bien');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'QFIELD', field: true });

  const field = await ev(p, () => {
    // Le contrôle n'existe PAS au départ : on le fait naître par le parcours.
    const before = controlsForTask('k-windows').length;
    setTaskStatus('k-windows', 'doing');
    closeOverlay('modal');
    setTaskStatus('k-windows', 'done');
    closeOverlay('modal');
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    save();
    selectFieldProject('keravel');
    const list = document.querySelector('#fieldControlList');
    return {
      before,
      after: controlsForTask('k-windows').length,
      rows: [...list.querySelectorAll('.qc-row b')].map((x) => x.textContent),
      text: list.textContent.slice(0, 160),
    };
  });
  await p.waitForTimeout(200);
  note('QUAL271-09', field);
  ok(field.before === 0 && field.after === 1
    && field.rows.includes('Contrôle pose menuiseries extérieures'),
    'QUAL271-09 : une intervention SANS contrôle initial, passée à « en cours » puis « terminée », fait apparaître sa ligne dans Mode Chantier › À contrôler', 'QUAL271-09');
  await shot(p, '07-quality-field-pending.png', { fullPage: true });

  await ctx.close();
}

// ============================================================
// RESPONSIVE — 430 / 390 / 360
// ============================================================
console.log('\n[RESP271] Responsive : Mode Chantier, popup de fin, formulaire de contrôle');
{
  const sizes = [[430, 932], [390, 844], [360, 800]];
  const bad = [];
  for (const [w, h] of sizes) {
    const { ctx, p } = await newPage({ w, h, tag: `RESP-${w}`, field: true });
    const m = await ev(p, () => {
      const over = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const out = {};
      selectFieldProject('keravel'); out.site = over();
      handleFieldSiteTab(); out.picker = over();
      setFieldTab('messages'); out.messages = over();
      handleFieldSiteTab();
      app.settings.driverMode = 'office'; save(); renderPage();
      setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
      setTaskStatus('k-windows', 'done'); out.qualityPopup = over();
      const actions = [...document.querySelectorAll('#modalContent .pop-actions .btn')].map((x) => Math.round(x.getBoundingClientRect().height));
      [...document.querySelectorAll('#modalContent button')].find((x) => /Contrôler maintenant/.test(x.textContent)).click();
      out.controlForm = over();
      out.itemH = [...document.querySelectorAll('.qc-item')].map((x) => Math.round(x.getBoundingClientRect().height));
      out.actionH = actions;
      return out;
    });
    await p.waitForTimeout(420);
    const overflows = ['site', 'picker', 'messages', 'qualityPopup', 'controlForm'].filter((k) => m[k] > 0);
    if (overflows.length) bad.push({ w, overflows, m });
    note(`RESP271-${w}`, m);
    if (w === 390) await shot(p, '11-quality-popup-390.png');
    await ctx.close();
  }
  ok(bad.length === 0,
    `RESP271 : à 430, 390 et 360px, aucun débordement horizontal — Mode Chantier, popup de fin d’intervention et formulaire de contrôle inclus`, 'RESP271');
}

// ============================================================
// DARK — le popup de fin d'intervention en thème sombre
// ============================================================
console.log('\n[DARK271] Thème sombre');
{
  const { ctx, p } = await newPage({ tag: 'DARK' });
  const dark = await ev(p, () => {
    setAppearance('dark');
    setTaskStatus('k-windows', 'doing'); closeOverlay('modal');
    setTaskStatus('k-windows', 'done');
    const box = document.querySelector('.modal-box'),
      lead = document.querySelector('.qc-done-lead'),
      row = document.querySelector('#modalContent .qc-row'),
      title = document.querySelector('#modalContent h2');
    const rgb = (el, prop) => getComputedStyle(el)[prop];
    return {
      dark: document.body.classList.contains('dark'),
      boxBg: rgb(box, 'backgroundColor'),
      titleColor: rgb(title, 'color'),
      leadColor: rgb(lead, 'color'),
      rowBg: rgb(row, 'backgroundColor'),
      inlineStyles: document.querySelector('#modalContent').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || [],
    };
  });
  await p.waitForTimeout(300);
  note('DARK271', dark);
  const parse = (c) => (c.match(/\d+/g) || []).map(Number);
  const lum = (c) => { const [r, g, bl] = parse(c); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
  ok(dark.dark && lum(dark.boxBg) < 0.5 && lum(dark.titleColor) > 0.5 && lum(dark.leadColor) > 0.35,
    'DARK271 : en thème sombre, le popup a un fond sombre et un texte clair — contraste réellement lisible', 'DARK271');
  ok(dark.inlineStyles.length === 0,
    'DARK271 : aucune couleur codée en dur dans le popup — il n’utilise que les variables de thème existantes', 'DARK271');
  await shot(p, '10-dark-quality-completion.png');
  await ctx.close();
}

// ============================================================
// GEL — les moteurs métier de V2.7.0 sont intacts
// ============================================================
console.log('\n[FREEZE-271] Byte-identité des moteurs V2.7.0');
{
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
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
    'applicableControlTemplates', 'createControlInstance', 'ensureTaskControlInstances',
    'controlsForTask', 'pendingControlsForTask', 'pendingControlsForProject',
    'blockingControlsForTask', 'blockingControlsForProject', 'submitControlAttempt',
    'controlIsCleared', 'controlIsOpen', 'validateQualityState', 'controlFormHTML',
    'openControlForm', 'closeControlForm', 'showNonConformOptions', 'showBlockingControlNotice',
    'controlRowHTML', 'taskControlsSection', 'openProjectControlsList', 'projectQualityBlock',
    'fieldTaskQualitySummary', 'fieldControlSection', 'fieldControlItems',
    'openControlTemplatesManager', 'renderControlTemplatesManager', 'renderControlTemplateForm',
    'submitControlTemplate', 'setControlTemplateActive', 'openReworkForm', 'createRework',
    'getProjectClosureStatus', 'confirmCloseProject', 'closeProjectPrompt',
    'taskResourceIds', 'getResourceState', 'planningTasks', 'planReflow', 'applyReflowPlan',
    'evaluateScenario', 'gantt', 'kanbanCard', 'kanbanBoard', 'taskColorClass',
    'taskEffectiveColorKey', 'migrateState', 'buildKanvixBackup', 'validateImportState',
    'applyImportPlan', 'addPhoto', 'capturePhoto', 'photoCaptureBlock', 'projectHistory',
    'getProjectHealth', 'setFieldTab', 'clearFieldProject', 'selectFieldProject',
    'openFieldPlanning', 'openFieldTaskModal', 'fieldProjectView', 'fieldSiteBody',
    'fieldProjectPicker', 'fieldReworkSection', 'fieldMessagesBody',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-271', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-271 : les ${frozen.length} moteurs métier et rendus de V2.7.0 sont BYTE-IDENTIQUES — V2.7.1 n’a touché à aucune règle`, 'FREEZE-271');

  // Le périmètre réellement modifié, nommé et borné.
  const changed = ['setTaskStatus', 'submitTaskEdit', 'finalizeTaskEdit', 'applyTaskEditReflow', 'renderField']
    .filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['handleFieldSiteTab', 'showPostCompletionQualityPrompt', 'openTaskControls']
    .filter((n) => extract(curSrc, n) && !extract(prevSrc, n));
  note('FREEZE-271-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 5 && added.length === 3,
    'FREEZE-271 : exactement 5 fonctions modifiées (setTaskStatus, les 3 finalisations de l’éditeur, et renderField pour brancher le bouton) et 3 ajoutées — rien de plus', 'FREEZE-271');

  // renderField ne change QUE par le gestionnaire du bouton : même balisage,
  // même géométrie, même libellés — une seule chaîne diffère.
  const rf270 = extract(prevSrc, 'renderField'), rf271 = extract(curSrc, 'renderField');
  const normalized = rf271.replace('handleFieldSiteTab()', "setFieldTab('site')");
  note('FREEZE-271-renderField', { identiqueAprèsNormalisation: normalized === rf270 });
  ok(normalized === rf270,
    'FREEZE-271 : renderField() ne diffère que par le gestionnaire du bouton « Chantier » — en le rebranchant sur setFieldTab(\'site\'), la fonction redevient BYTE-IDENTIQUE à V2.7.0. Aucun balisage, aucune icône, aucun libellé n’a changé', 'FREEZE-271');

  // La garde qualité de setTaskStatus n'a pas bougé d'une ligne.
  const sts = extract(curSrc, 'setTaskStatus'), stsPrev = extract(prevSrc, 'setTaskStatus');
  const guard = (src) => {
    const i = src.indexOf('if (status === "doing" || status === "done")');
    const j = src.indexOf('if (!silent) snapshot();', i);
    return i >= 0 && j > i ? src.slice(i, j) : null;
  };
  const g1 = guard(stsPrev), g2 = guard(sts);
  note('FREEZE-271-garde', { v270: g1 ? md5(g1).slice(0, 10) : null, v271: g2 ? md5(g2).slice(0, 10) : null });
  ok(g1 && g2 && md5(g1) === md5(g2),
    'FREEZE-271 : le bloc de garde qualité de setTaskStatus() (matérialisation + refus bloquant) est BYTE-IDENTIQUE à V2.7.0', 'FREEZE-271');

  // STORE et schéma : rien ne bouge.
  // STORE est déclaré dans une liste (`STORE = "...",`) et non par un `const`
  // isolé : viser `const STORE` ne matchait RIEN et l'assertion passait sur
  // `undefined === undefined`. On lit la valeur réelle, et on l'exige.
  const store = (src) => (src.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (src) => (src.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-271-store', { store: store(curSrc), schema: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && store(curSrc) === store(prevSrc)
    && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '11',
    'FREEZE-271 : STORE et SCHEMA_VERSION (11) inchangés — aucune migration en V2.7.1', 'FREEZE-271');
}

// ============================================================
// SYNTHÈSE
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
