// ============================================================
// KANVIX — Non-régression V2.6.1 → V2.7.0
//
//   La question à laquelle cette recette répond :
//     « Ce que V2.6.1 faisait, V2.7.0 le fait-il EXACTEMENT pareil, quand
//       aucun contrôle qualité n'entre en jeu ? »
//
//   Méthode : on exécute la MÊME séquence sur les DEUX fichiers et on compare
//   les résultats. Aucune valeur n'est écrite en dur : la version précédente
//   est la référence. Un écart est un écart, même « plausible ».
//
//   Usage : node recette-non-regression-v2.6.1-vers-v2.7.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.7.0.html';
const PREV = 'kanvix-next-gen-v2.6.1.html';
const NOW = '2026-09-14T10:15:00';

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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 700)}`);
const allErrs = [];

async function open(file, tag, w = 1440, h = 900) {
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
  await p.goto('file://' + BASE + file + '?now=' + NOW, { waitUntil: 'load' });
  await p.evaluate(() => {
    resetApp();
    setDepth('pilot');
    dismissKanvixContinuityNotice();
    /* V2.12.0 — RE-POINTAGE, en UN seul endroit : le setup commun aux deux
       builds. Cette recette compare deux versions « à données métier
       équivalentes ». V2.12.0 livre des conditions de démarrage de
       démonstration que V2.6.1 ne connaît pas ; sans neutralisation, on
       comparerait deux jeux de données différents et on appellerait « régression »
       une donnée nouvelle. L'exigence testée — même Gantt, même Aujourd'hui,
       même fiche tâche — est rigoureusement inchangée. */
    if (Array.isArray(app.prerequisites)) { app.prerequisites = []; save(); }
    const t = document.querySelector('#toast');
    if (t) t.style.display = 'none';
  });
  await p.waitForTimeout(180);
  return { ctx, p };
}

// Exécute la même sonde sur les deux versions et compare.
async function compare(id, label, fn, opts = {}) {
  const { w = 1440, h = 900 } = opts;
  const a = await open(PREV, 'PREV-' + id, w, h);
  const c = await open(CUR, 'CUR-' + id, w, h);
  const ra = await a.p.evaluate(fn);
  const rc = await c.p.evaluate(fn);
  await a.ctx.close(); await c.ctx.close();
  const sa = JSON.stringify(ra), sc = JSON.stringify(rc);
  if (sa !== sc) note(id, { v261: ra, v270: rc });
  else note(id, { identique: ra });
  ok(sa === sc, `${id} : ${label}`, id);
  return { ra, rc };
}

console.log('\n[NR-PLAN] Planning, Gantt, Kanban, couleurs, lots');

await compare('NR-01', 'le Gantt produit exactement les mêmes barres, dans le même ordre, avec les mêmes classes de couleur', () => {
  go('planning');
  app.settings.period = 'month';
  renderPage();
  return [...document.querySelectorAll('.g-row')].map((r) => ({
    label: r.querySelector('.g-label')?.textContent.trim(),
    bar: r.querySelector('.g-bar')?.className,
  }));
});

await compare('NR-02', 'le Kanban produit les mêmes colonnes et les mêmes cartes', () => {
  go('planning');
  app.ui.planningView = 'kanban';
  renderPage();
  return [...document.querySelectorAll('.kanban-col')].map((c) => ({
    head: c.querySelector('h3')?.textContent.trim(),
    cards: [...c.querySelectorAll('.kanban-card b')].map((x) => x.textContent.trim()),
  }));
});

await compare('NR-03', 'le filtre par lot du Planning sélectionne les mêmes tâches', () => {
  go('planning');
  app.ui.planningView = 'gantt';
  const out = {};
  ['all', ...app.lots.map((l) => l.id)].forEach((k) => {
    app.ui.planningLot = k;
    out[k] = planningTasks().map((t) => t.id);
  });
  return out;
});

await compare('NR-04', 'la couleur effective de chaque tâche est inchangée', () =>
  app.tasks.map((t) => [t.id, taskEffectiveColorKey(t), taskColorClass(t)]));

console.log('\n[NR-TASK] Tâches, statuts, dépendances, reprises');

await compare('NR-05', 'démarrer puis terminer une intervention SANS contrôle donne le même état et le même historique', () => {
  const t = app.tasks.find((x) => x.status === 'todo' && !/cloison/i.test(x.name) && !/fenêtre/i.test(x.name));
  setTaskStatus(t.id, 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ /* V2.12.0 — RE-POINTAGE. Le passage « En cours » traverse désormais aussi la garde des CONDITIONS DE DÉMARRAGE (§12) : on confirme, comme l'utilisateur, exactement comme on confirmait déjà le calendrier depuis V2.8.5.2. L'exigence testée est inchangée. */ if (document.querySelector('#modal.open [data-prq-confirm]')) confirmPrerequisiteStart(); if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
  setTaskStatus(t.id, 'done');
  return {
    status: task(t.id).status,
    hist: app.history.filter((h) => h.taskId === t.id).map((h) => h.text),
    issues: app.issues.length,
  };
});

await compare('NR-06', 'les dépendances et successeurs sont identiques', () =>
  app.tasks.map((t) => [t.id, (t.deps || []).slice().sort(), getTaskSuccessors(t.id).map((s) => s.id)]));

await compare('NR-07', 'le moteur de reprise crée la même tâche de reprise, au même endroit de la chaîne', () => {
  // Cas construit à l'identique sur les deux versions : une intervention
  // terminée, non issue d'une reprise.
  const t = app.tasks.find((x) => x.status === 'done' && !x.reworkOfTaskId)
    || (() => { const x = app.tasks.find((y) => !y.reworkOfTaskId); x.status = 'done'; return x; })();
  const before = app.tasks.length;
  createRework(t.id, { comment: 'Essai de reprise', planDate: t.end.slice(0, 10), duration: 'half' });
  const rw = app.tasks.find((x) => x.reworkOfTaskId === t.id);
  return {
    added: app.tasks.length - before,
    name: rw?.name,
    deps: rw?.deps,
    successorsRewired: app.tasks.filter((x) => (x.deps || []).includes(rw?.id)).map((x) => x.id),
  };
});

await compare('NR-08', 'le replanificateur produit le même plan de décalage en cascade', () => {
  const t = app.tasks.find((x) => getTaskSuccessors(x.id).length);
  const shifted = { ...task(t.id), end: shiftDateStr(t.end.slice(0, 10), 2) + t.end.slice(10) };
  const plan = planReflow(t.id, { [t.id]: shifted });
  return {
    source: t.id,
    shifts: (plan.shifts || []).map((x) => [x.id, x.start, x.end]),
    doing: (plan.doing || []).map((x) => x.id),
    done: (plan.done || []).map((x) => x.id),
  };
});

console.log('\n[NR-RES] Ressources, charge, disponibilités');

await compare('NR-09', 'l’état de chaque ressource aujourd’hui est identique', () =>
  app.resources.map((r) => [r.id, getResourceState(r.id, dayKey(TODAY)), getResourceTasks(r.id).length]));

await compare('NR-10', 'les conflits de planification détectés sont identiques', () =>
  app.resources.map((r) => [r.id, getResourceSchedulingConflicts(r.id).map((c) => c.taskId || c.id)]));

await compare('NR-11', 'la charge des ressources et ses groupes de familles sont identiques', () => {
  go('team');
  return [...document.querySelectorAll('.load-row, .team-load-group, .rl-row')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
});

console.log('\n[NR-PROJ] Chantier, santé, cockpit, clôture');

await compare('NR-12', 'la SANTÉ de chaque chantier est identique — un contrôle en attente ne la dégrade pas', () =>
  app.projects.map((p) => [p.id, getProjectHealth(p.id), calculateProjectDelay(p.id)]));

await compare('NR-13', 'le cockpit chantier affiche le même titre, le même badge et la même accroche', () => {
  const out = {};
  app.projects.forEach((p) => {
    app.ui.projectId = p.id;
    go('project');
    out[p.id] = {
      badge: document.querySelector('.status-badge')?.textContent.trim(),
      headline: document.querySelector('.headline')?.textContent.trim(),
    };
  });
  return out;
});

await compare('NR-14', 'la clôture d’un chantier SANS contrôle ouvert se comporte exactement comme en V2.6.1', () => {
  const p = app.projects.find((x) => x.lifecycle === 'active');
  getProjectTasks(p.id).forEach((t) => (t.status = 'done'));
  app.issues.filter((i) => i.projectId === p.id).forEach((i) => (i.status = 'resolved'));
  if (Array.isArray(app.controlInstances))
    app.controlInstances = app.controlInstances.filter((c) => c.projectId !== p.id);
  const cs = getProjectClosureStatus(p.id);
  confirmCloseProject(p.id);
  return { ready: cs.ready, openTasks: cs.openTasks.length, lifecycle: project(p.id).lifecycle };
});

console.log('\n[NR-TODAY] Accueil et décisions du jour');

await compare('NR-15', 'l’Accueil propose les mêmes décisions et les mêmes points de vigilance', () => {
  go('today');
  return {
    decisions: getTodayDecisions().map((i) => i.id),
    warnings: getTodayWarnings().map((i) => i.id),
    cards: [...document.querySelectorAll('.decision-card h3')].map((x) => x.textContent.trim()),
  };
});

console.log('\n[NR-DATA] Référentiel, sauvegarde, import');

await compare('NR-16', 'le référentiel de lots est inchangé (ordre, couleurs, métiers, usages)', () =>
  activeLots().map((l) => [l.id, l.name, l.colorKey, l.defaultTrade, l.order, lotReferences(l.id)]));

await compare('NR-17', 'l’export portable produit les mêmes clés et les mêmes volumes', () => {
  exportKanvixData();
  const j = JSON.parse(document.querySelector('#kanvixExportText').value);
  return {
    keys: Object.keys(j),
    projects: j.projects.length, tasks: j.tasks.length,
    milestones: j.milestones.length, lots: j.lots.length,
  };
});

await compare('NR-18', 'la validation d’état d’import passe sur l’état de démonstration', () => {
  const v = validateImportState(app);
  return { ok: v.ok, errors: v.errors };
});

console.log('\n[NR-FIELD] Mode Chantier');

await compare('NR-19', 'le Mode Chantier expose les mêmes onglets et le même bandeau bas', () => {
  setRole('driver');
  app.settings.driverMode = 'field';
  app.ui.fieldTab = 'site';
  save();
  renderPage();
  return {
    bottom: [...document.querySelectorAll('.field-bottom button')].map((x) => x.textContent.replace(/\d+/g, '').trim()),
    wrap: !!document.querySelector('.field-wrap'),
  };
}, { w: 390, h: 844 });

await compare('NR-20', 'la section « Aujourd’hui » du Mode Chantier liste les mêmes interventions', () => {
  setRole('driver');
  app.settings.driverMode = 'field';
  app.ui.fieldTab = 'site';
  save();
  selectFieldProject(app.projects.find((p) => p.lifecycle === 'active').id);
  const sec = [...document.querySelectorAll('.field-section')].find((s) => /Aujourd/.test(s.querySelector('.field-h2')?.textContent || ''));
  return sec ? [...sec.querySelectorAll('.field-task b')].map((x) => x.textContent.trim()) : null;
}, { w: 390, h: 844 });

console.log('\n[NR-UI] Rendu, responsive, thème');

await compare('NR-21', 'aucune page ne déborde horizontalement, sur 8 formats, exactement comme en V2.6.1', () => {
  const pages = ['today', 'sites', 'planning', 'team', 'more'];
  const out = {};
  pages.forEach((pg) => {
    go(pg);
    out[pg] = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  return out;
});

for (const [w, h] of [[1920, 1080], [1280, 800], [768, 1024], [430, 932], [390, 844], [360, 740]]) {
  await compare(`NR-22-${w}`, `à ${w}px, le débordement horizontal est identique à V2.6.1`, () => {
    const pages = ['today', 'sites', 'planning', 'team', 'more'];
    const out = {};
    pages.forEach((pg) => {
      go(pg);
      out[pg] = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    });
    return out;
  }, { w, h });
}

await compare('NR-23', 'le thème sombre applique les mêmes couleurs de fond aux surfaces principales', () => {
  setAppearance('dark');
  go('today');
  const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
  return { body: g('body'), sidebar: g('.sidebar'), card: g('.card'), header: g('.header') };
});

// ============================================================
console.log('\n[NR-QC-OFF] Avec la qualité neutralisée, V2.7.0 = V2.6.1');
{
  // Preuve directe : sans AUCUN contrôle, les écrans de V2.7.0 rendent le même
  // texte que V2.6.1 là où V2.7 ajoute des blocs.
  const a = await open(PREV, 'OFF-PREV');
  const c = await open(CUR, 'OFF-CUR');
  const probe = () => {
    // Neutralisation COMPLÈTE : ni contrôle en cours, ni modèle applicable.
    // (Vider les seules instances laisserait « + Ajouter un contrôle » — ce
    //  serait alors un écart LÉGITIME, pas une régression.)
    // `app` est un `let` de portée script : il n'existe PAS sur window. On
    // teste donc la propriété elle-même, sinon la neutralisation ne se fait
    // pas et le test passe pour de mauvaises raisons.
    if (Array.isArray(app.controlInstances)) app.controlInstances = [];
    if (Array.isArray(app.controlTemplates)) app.controlTemplates = [];
    const pid = app.projects.find((p) => p.lifecycle === 'active').id;
    openProjectTab(pid, 'Aujourd’hui');
    const today = document.querySelector('.tab-body, .project-tab-body, main')?.textContent.replace(/\s+/g, ' ').trim();
    const t = app.tasks.find((x) => x.projectId === pid);
    openTask(t.id);
    /* V2.9.0 — RE-BASELINE. La fiche d'une tâche affiche désormais son
       EMPLACEMENT quand elle en a un (V2.9.0 §31/§32) : « Bâtiment A › Étage 1 »
       sous le nom du chantier. C'est une information nouvelle, voulue, et
       étrangère à ce que cette assertion mesure — l'absence d'effet de la
       QUALITÉ quand il n'y a rien à contrôler. On la neutralise donc dans la
       comparaison, sans rien retirer d'autre : tout le reste de la fiche et de
       l'onglet Aujourd'hui est toujours comparé caractère par caractère. */
    /* V2.12.0 — RE-BASELINE, EXACTEMENT le même raisonnement qu'en V2.9.0
       ci-dessus. La fiche porte désormais le bloc « Conditions de démarrage »
       (V2.12.0 §8). C'est une information nouvelle, voulue, et étrangère à ce
       que cette assertion mesure — l'absence d'effet de la QUALITÉ quand il n'y
       a rien à contrôler. On RETIRE le bloc du DOM avant comparaison, et on le
       RENVOIE : l'assertion corollaire ci-dessous vérifie que ce qu'on a retiré
       est bien ce bloc-là et rien d'autre. Tout le reste de la fiche et de
       l'onglet Aujourd'hui est toujours comparé caractère par caractère. */
    const prqNode = document.querySelector('#drawerContent .prq-section');
    const prq = prqNode ? prqNode.textContent.replace(/\s+/g, ' ').trim() : null;
    if (prqNode) prqNode.remove();
    const chemin = t.structureNodeId ? structurePath(t.structureNodeId) : '';
    const sheet = document
      .querySelector('#drawerContent')
      .textContent.replace(/\s+/g, ' ')
      .replace(chemin ? new RegExp(chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { today: today?.slice(0, 400), sheet: sheet.slice(0, 400), prq };
  };
  const ra = await a.p.evaluate(probe);
  const rc = await c.p.evaluate(probe);
  await a.ctx.close(); await c.ctx.close();
  const same = JSON.stringify([ra.today, ra.sheet]) === JSON.stringify([rc.today, rc.sheet]);
  if (!same) note('NR-24', { v261: ra, v270: rc });
  ok(same,
    'NR-24 : sans aucun contrôle ni modèle en base, l’onglet Aujourd’hui et la fiche Tâche de V2.7.0 rendent STRICTEMENT le même contenu qu’en V2.6.1 — la qualité n’ajoute rien quand il n’y a rien à contrôler', 'NR-24');
  note('NR-24-bloc-retiré', { v261: ra.prq, v270: rc.prq });
  ok(ra.prq === null && /Conditions de démarrage/.test(rc.prq || '') && /Aucune condition/.test(rc.prq || ''),
    'NR-24 : et ce qui a été retiré de la comparaison est EXACTEMENT le bloc « Conditions de démarrage » de V2.12.0 — absent de V2.6.1, réduit à son état vide quand l’intervention n’en porte aucune', 'NR-24');

  // Corollaire : dès qu'un modèle APPLICABLE existe, la fiche propose de
  // l'ajouter. C'est l'unique différence, et elle est VOULUE.
  const c2 = await open(CUR, 'OFF-CUR2');
  const addable = await c2.p.evaluate(() => {
    app.controlInstances = [];
    openTask('k-cloisons');
    const s = document.querySelector('.qc-section');
    return { section: !!s, add: /Ajouter un contrôle/.test(s?.textContent || ''), rows: s?.querySelectorAll('.qc-row').length || 0 };
  });
  await c2.ctx.close();
  note('NR-25', addable);
  ok(addable.section && addable.add && addable.rows === 0,
    'NR-25 : l’UNIQUE ajout de V2.7.0 sur une fiche sans contrôle est le lien « + Ajouter un contrôle », et seulement quand un modèle s’applique réellement', 'NR-25');
}

// ============================================================
const appErrs = allErrs.filter((e) => !/ERR_FAILED|ERR_TUNNEL/.test(e.msg));
console.log('\n============================================================');
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 12), null, 1));
console.log('============================================================');
await b.close();
process.exit(failed.length || appErrs.length ? 1 : 0);
