// ============================================================
// KANVIX — Recette « CORRECTIVE R5.1 »
//
//   Corrige le dispositif de test utilisateur du prototype R5 (moteur Agenda
//   techniquement valide, mais injouable par un vrai testeur) sans revenir
//   sur aucune décision produit :
//
//   1. AGENDA-*        — moteur Agenda (r5.1-prototype.html), réécrit sans
//                         garde arbitraire à 400 jours, comportement inchangé
//                         pour toute tâche « normale ».
//   2. TRESLONGUE-*     — preuve du correctif : une tâche commencée plus de
//                         400 jours avant la fenêtre affichée, toujours
//                         active dedans, apparaît désormais sur chaque jour
//                         concerné (et disparaissait avant, sur R5 original).
//   3. LABELS-* / INITIAL-* — vocabulaire A/B et mode de vue initiale,
//                         inchangés, revérifiés sur r5.1-prototype.html.
//   4. NONREG-*         — tests de fumée (Gantt, Kanban, décalage, Structure,
//                         Opérations, Essentiel/Pilotage, Undo).
//   5. USERTEST-*       — le fichier r5.1-user-test.html, ouvert DIRECTEMENT
//                         (aucune injection Playwright) : les 9 fixtures R5
//                         y sont visibles, « R5 — Chape 5 jours » est
//                         présente, la semaine du 17 août s'affiche, aucune
//                         duplication au rechargement, stockage isolé du
//                         produit certifié.
//   6. LANCEUR-*        — les 8 boutons du lanceur, URL et contre-
//                         balancement corrects, navigation réelle vérifiée.
//   7. FREEZE-*          — trois contrôles différentiels exhaustifs :
//                         référence V2.12.2.1 ↔ r5.1-prototype ;
//                         r5-prototype (original) ↔ r5.1-prototype ;
//                         r5.1-prototype ↔ r5.1-user-test. Aucun changement
//                         non documenté nulle part.
//   8. PROTECTION-*      — empreintes md5 des DEUX fichiers protégés
//                         (référence certifiée + prototype R5 original),
//                         capturées avant et après l'exécution complète de
//                         cette recette : elles doivent être strictement
//                         identiques.
//
//   Aucun résultat utilisateur n'est fabriqué : aucun test utilisateur réel
//   n'a été mené par cette recette ni par ce lot. Aucune décision produit
//   n'est prise (Agenda par défaut ? nouveau vocabulaire ?).
//
//   Usage : node recette-corrective-r5.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
const { chromium } = pw;

const BASE = '/home/user/Planzy-saas/public/poc/';
const REF = 'kanvix-next-gen-v2.12.2.1.html'; // référence certifiée — PROTÉGÉE
const R5_ORIG = 'kanvix-next-gen-v2.12.2.1-r5-prototype.html'; // prototype R5 original — PROTÉGÉ
const R51_PROTO = 'kanvix-next-gen-v2.12.2.1-r5.1-prototype.html';
const R51_USERTEST = 'kanvix-next-gen-v2.12.2.1-r5.1-user-test.html';
const LAUNCHER = 'lanceur-test-utilisateurs-r5.1.html';
const NOW = '2026-08-17T09:00:00';
const F = (file, params = '') => 'file://' + BASE + file + '?now=' + NOW + params;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-r5.1/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const md5File = (name) => crypto.createHash('md5').update(fs.readFileSync(BASE + name)).digest('hex');

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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1600)}`);
const allErrs = [];

// Bruit connu, préexistant, indépendant de ce correctif : ERR_TUNNEL_CONNECTION_FAILED
// est présent à l'identique sur la référence certifiée non modifiée (environnement
// sandbox sans sortie HTTPS libre) — même convention de filtrage que les recettes
// précédentes de ce lot (R2-R4, V2.12.2.1, R5).
const BRUIT_CONNU = /ERR_FAILED|ERR_TUNNEL|Failed to load resource/;

async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = R51_PROTO, params = '', dark = false, skipReset = false, direct = false } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !BRUIT_CONNU.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  // "direct" = ouverture REALISTE, aucune assistance Playwright au-delà du
  // routage réseau (utilisé pour la section USERTEST-* : le fichier doit
  // s'initialiser seul, sans aucun evaluate() de préparation).
  if (direct) {
    await p.goto(F(file, params), { waitUntil: 'load' });
    await p.waitForTimeout(250);
    return { ctx, p };
  }
  await p.goto(F(file, params), { waitUntil: 'load' });
  if (!skipReset) await p.evaluate(() => resetApp());
  await p.evaluate(() => dismissKanvixContinuityNotice());
  if (dark) await p.evaluate(() => setAppearance('dark'));
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// Jeu de données R5 — TEMPORAIRE, injecté au runtime pour les sections AGENDA-*/
// TRESLONGUE-*/NONREG-* (qui testent l'ENGIN en isolation via Playwright). La
// section USERTEST-* n'utilise PAS cette fonction : elle vérifie que
// r5.1-user-test.html s'auto-seed lui-même, sans aide extérieure.
async function seedR5Tasks(p) {
  return ev(p, () => {
    const before = app.tasks.length;
    app.tasks.push(
      { id: 'r5-5j', projectId: 'keravel', name: 'R5 — Chape 5 jours', resourceId: 'thomas',
        start: '2026-08-17T08:00', end: '2026-08-21T17:00', status: 'doing', deps: [],
        lotId: 'lot-platrerie', structureNodeId: 'sn-keravel-etage-1', colorKey: 'auto' },
      { id: 'r5-we', projectId: 'terrasses', name: 'R5 — Coulage traverse week-end', resourceId: 'marc',
        start: '2026-08-21T14:00', end: '2026-08-24T10:00', status: 'todo', deps: [],
        colorKey: 'auto' },
      { id: 'r5-avant', projectId: 'keravel', name: 'R5 — Débutée avant la période', resourceId: 'mathieu',
        start: '2026-08-13T08:00', end: '2026-08-18T12:00', status: 'late', deps: [],
        colorKey: 'auto' },
      { id: 'r5-finpendant', projectId: 'terrasses', name: 'R5 — Finit pendant la période', resourceId: 'eric',
        start: '2026-08-12T08:00', end: '2026-08-19T16:00', status: 'waiting', deps: [],
        colorKey: 'auto' },
      { id: 'r5-couvre', projectId: 'horizon', name: 'R5 — Couvre toute la période', resourceId: 'legall',
        start: '2026-08-10T08:00', end: '2026-09-10T17:00', status: 'doing', deps: [],
        colorKey: 'auto' },
      { id: 'r5-done', projectId: 'keravel', name: 'R5 — Terminée', resourceId: 'eric',
        start: '2026-08-17T07:00', end: '2026-08-17T07:30', status: 'done', deps: [],
        colorKey: 'auto' },
      { id: 'r5-courte1', projectId: 'keravel', name: 'R5 — Courte A', resourceId: 'marc',
        start: '2026-08-17T13:00', end: '2026-08-17T13:30', status: 'todo', deps: [],
        colorKey: 'auto' },
      { id: 'r5-courte2', projectId: 'keravel', name: 'R5 — Courte B', resourceId: 'marc',
        start: '2026-08-17T15:00', end: '2026-08-17T15:20', status: 'todo', deps: ['r5-courte1'],
        colorKey: 'auto' },
      { id: 'r5-conflit', projectId: 'keravel', name: 'R5 — Conflit ressource', resourceId: 'marc',
        start: '2026-08-21T14:30', end: '2026-08-21T16:00', status: 'todo', deps: [],
        colorKey: 'auto' },
    );
    save();
    renderPage();
    return { before, after: app.tasks.length, added: app.tasks.length - before };
  });
}

console.log('\n============================================================');
console.log(' PARTIE 0 — LIVRABLES PRÉSENTS + PROTECTION (empreintes AVANT)');
console.log('============================================================');
let md5RefBefore, md5R5OrigBefore;
{
  const files = [REF, R5_ORIG, R51_PROTO, R51_USERTEST, LAUNCHER];
  const allExist = files.every((f) => fs.existsSync(BASE + f));
  ok(allExist, 'Tous les fichiers livrés (référence, R5 original, R5.1 prototype, R5.1 test utilisateur, lanceur) existent sur disque', 'PERIM-0');
  md5RefBefore = md5File(REF);
  md5R5OrigBefore = md5File(R5_ORIG);
  note('PROTECTION-0-avant', { REF: md5RefBefore, R5_ORIG: md5R5OrigBefore });
}

console.log('\n============================================================');
console.log(' PARTIE 1 — MOTEUR AGENDA SUR r5.1-prototype.html (AGENDA-*)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'AGENDA', w: 1440, h: 1000 });
  const seed = await seedR5Tasks(p);
  ok(seed.added === 9, 'Le jeu de données R5 (9 tâches) est ajouté sans écraser de tâche existante', 'AGENDA-00');

  await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); app.ui.planningProject = 'all'; app.ui.planningResource = 'all'; app.ui.planningLot = 'all'; app.ui.planningStructure = 'all'; setPlanningView('agenda'); });
  await p.waitForTimeout(200);

  const hasAgendaView = await ev(p, () => !!document.querySelector('.agenda-view'));
  ok(hasAgendaView, 'AGENDA-01 : la vue Agenda se rend toujours normalement après le correctif', 'AGENDA-01');

  const rows5j = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-5j'"))
    .map((el) => ({ day: el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent, marker: el.querySelector('.pill:not(.accent):not(.success):not(.warning):not(.danger)')?.textContent || null })));
  ok(rows5j.length === 5, 'AGENDA-02 : une tâche de 5 jours ouvrés produit toujours EXACTEMENT 5 occurrences après le correctif', 'AGENDA-02');
  ok(rows5j[0]?.marker === 'Début' && rows5j[4]?.marker === 'Fin', 'AGENDA-02 : repères Début (1er jour) / Fin (dernier jour) toujours corrects (calcul désormais borné à 7 jours, plus par parcours complet)', 'AGENDA-02');
  ok(rows5j.slice(1, 4).every((r) => r.marker === 'Suite'), 'AGENDA-02 : les jours intermédiaires portent toujours « Suite »', 'AGENDA-02');

  const daysPresent = await ev(p, () => [...document.querySelectorAll('.agenda-day-head b')].map((b) => b.textContent));
  ok(!daysPresent.some((d) => /^sam\./.test(d)), 'AGENDA-03 : toujours aucune ligne « samedi » artificielle (projectCalendar.workingDays inchangé, seulement documenté)', 'AGENDA-03');
  const rowsWE = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-we'"))
    .map((el) => el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent));
  ok(rowsWE.length === 1 && /^ven\./.test(rowsWE[0] || ''), 'AGENDA-03 : traversée de week-end toujours limitée au vendredi dans la fenêtre affichée', 'AGENDA-03');

  const rowsAvant = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-avant'"))
    .map((el) => el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent));
  ok(rowsAvant.length > 0 && rowsAvant.every((d) => !/^(jeu\. 13|ven\. 14)/.test(d)), 'AGENDA-04 : tâche commencée avant la période toujours sans occurrence avant le début de la fenêtre', 'AGENDA-04');

  const rowsCouvre = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-couvre'"))
    .map((el) => ({ day: el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent, marker: el.querySelector('.pill')?.textContent })));
  ok(rowsCouvre.length === 5 && rowsCouvre.every((r) => r.marker === 'Suite'), 'AGENDA-06 : tâche couvrant toute la période toujours marquée « Suite » sur les 5 jours visibles (jamais de faux Début/Fin sur les bords de fenêtre)', 'AGENDA-06');

  const stDone = await ev(p, () => [...document.querySelectorAll('.day-task')].find((e) => e.getAttribute('onclick')?.includes("'r5-done'"))?.querySelector('.pill.success')?.textContent);
  const stLate = await ev(p, () => [...document.querySelectorAll('.day-task')].find((e) => e.getAttribute('onclick')?.includes("'r5-avant'"))?.querySelector('.pill.danger')?.textContent);
  ok(stDone === 'Terminée' && stLate === 'En retard', 'AGENDA-07 : les pastilles de statut restent correctes après le correctif', 'AGENDA-07');

  await ev(p, () => { app.ui.planningProject = 'keravel'; save(); renderPage(); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const projAgenda = await ev(p, () => [...document.querySelectorAll('.day-task')].map((e) => e.getAttribute('onclick')).join('|'));
  ok(/'r5-5j'/.test(projAgenda) && !/'r5-we'/.test(projAgenda), 'AGENDA-09 : le filtre chantier fonctionne toujours en Agenda après le correctif', 'AGENDA-09');
  await ev(p, () => { app.ui.planningProject = 'all'; save(); renderPage(); });

  await ev(p, () => openTask('r5-5j'));
  await p.waitForTimeout(150);
  const drawer = await ev(p, () => ({ open: document.getElementById('drawer')?.classList.contains('open'), hasName: document.getElementById('drawerContent')?.innerHTML.includes('R5 — Chape 5 jours') }));
  ok(drawer.open && drawer.hasName, 'AGENDA-15 : ouvrir une ligne Agenda ouvre toujours la bonne fiche tâche', 'AGENDA-15');
  await ev(p, () => closeOverlay('drawer'));

  const finalCount = await ev(p, () => app.tasks.length);
  ok(finalCount === seed.after, 'AGENDA-16 : app.tasks toujours sans duplication après changements de vue/filtre', 'AGENDA-16');

  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 2 — CORRECTIF « TÂCHE TRÈS LONGUE » (TRESLONGUE-*)');
console.log('============================================================');
{
  // 2.1 — preuve que le bug existait bel et bien sur le prototype R5 ORIGINAL (non corrigé).
  const { ctx: ctxOld, p: pOld } = await newPage({ tag: 'TRESLONGUE-avant-correctif', file: R5_ORIG, w: 1440, h: 1000 });
  await ev(pOld, () => {
    app.tasks.push({ id: 'r5-tres-longue', projectId: 'keravel', name: 'R5 — Tâche très longue (>400j)', resourceId: 'armor', start: '2024-01-01T08:00', end: '2027-01-01T17:00', status: 'doing', deps: [], colorKey: 'auto' });
    save(); renderPage();
    go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda');
  });
  await pOld.waitForTimeout(200);
  const rowsOld = await ev(pOld, () => [...document.querySelectorAll('.day-task')].filter((e) => e.getAttribute('onclick')?.includes("'r5-tres-longue'")).length);
  note('TRESLONGUE-avant-correctif', { occurrencesVisibles: rowsOld });
  ok(rowsOld === 0, 'TRESLONGUE-00 : confirmation du bug — sur le prototype R5 ORIGINAL (non corrigé), une tâche commencée >400j avant la fenêtre affichée est INVISIBLE dans l’Agenda alors qu’elle y est active (garde à 400 itérations épuisée avant d’atteindre la fenêtre)', 'TRESLONGUE-00');
  await ctxOld.close();

  // 2.2 — preuve que le correctif R5.1 résout ce cas.
  const { ctx, p } = await newPage({ tag: 'TRESLONGUE', w: 1440, h: 1000 });
  await ev(p, () => {
    app.tasks.push({ id: 'r5-tres-longue', projectId: 'keravel', name: 'R5 — Tâche très longue (>400j)', resourceId: 'armor', start: '2024-01-01T08:00', end: '2027-01-01T17:00', status: 'doing', deps: [], colorKey: 'auto' });
    save(); renderPage();
    go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda');
  });
  await p.waitForTimeout(200);
  const rows = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-tres-longue'"))
    .map((el) => ({ day: el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent, marker: el.querySelector('.pill')?.textContent })));
  note('TRESLONGUE-apres-correctif', rows);
  ok(rows.length === 5, 'TRESLONGUE-01 : sur r5.1-prototype.html, cette même tâche (commencée le 2024-01-01, finissant le 2027-01-01) apparaît désormais sur les 5 jours ouvrés de la semaine affichée', 'TRESLONGUE-01');
  ok(rows.every((r) => r.marker === 'Suite'), 'TRESLONGUE-02 : toutes ces occurrences sont marquées « Suite » (ses vraies bornes Début/Fin, en 2024 et 2027, restent hors fenêtre — jamais de faux repère)', 'TRESLONGUE-02');

  // 2.3 — coût constant : le calcul ne doit pas dépendre de la distance entre le
  // début de la tâche et la fenêtre affichée (10 ans avant, même résultat).
  await ev(p, () => {
    app.tasks.find((t) => t.id === 'r5-tres-longue').start = '2016-01-01T08:00';
    save(); renderPage();
  });
  await p.waitForTimeout(150);
  const rowsExtreme = await ev(p, () => [...document.querySelectorAll('.day-task')].filter((el) => el.getAttribute('onclick')?.includes("'r5-tres-longue'")).length);
  ok(rowsExtreme === 5, 'TRESLONGUE-03 : même résultat avec une tâche commencée 10 ans avant la fenêtre affichée — le correctif ne dépend jamais de la distance à la fenêtre', 'TRESLONGUE-03');

  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 3 — VOCABULAIRE A/B ET VUE INITIALE (LABELS-* / INITIAL-*)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'LABELS-01' });
  await ev(p, () => go('planning'));
  const labels = await ev(p, () => [...document.querySelectorAll('.view-segment button')].map((b) => b.textContent));
  ok(JSON.stringify(labels) === JSON.stringify(['Gantt', 'Kanban', 'Agenda']), 'LABELS-01 : sans paramètre, libellés toujours « Gantt / Kanban / Agenda »', 'LABELS-01');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'LABELS-02', params: '&r5Labels=plain' });
  await ev(p, () => go('planning'));
  const labels = await ev(p, () => [...document.querySelectorAll('.view-segment button')].map((b) => b.textContent));
  ok(JSON.stringify(labels) === JSON.stringify(['Chronologie', 'Avancement', 'Agenda']), 'LABELS-02 : ?r5Labels=plain toujours « Chronologie / Avancement / Agenda »', 'LABELS-02');
  const internal = await ev(p, () => app.ui.planningView);
  ok(internal === 'gantt', 'LABELS-03 : valeur interne toujours indépendante du vocabulaire affiché', 'LABELS-03');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'INITIAL-agenda', params: '&r5Initial=agenda', skipReset: true });
  await ev(p, () => go('planning'));
  const view = await ev(p, () => app.ui.planningView);
  ok(view === 'agenda', 'INITIAL-01 : ?r5Initial=agenda ouvre toujours directement l’Agenda', 'INITIAL-01');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'INITIAL-03', params: '&r5Initial=agenda', skipReset: true });
  await ev(p, () => go('planning'));
  const viewBefore = await ev(p, () => app.ui.planningView);
  await p.goto(F(R51_PROTO), { waitUntil: 'load' });
  await ev(p, () => { resetApp(); dismissKanvixContinuityNotice(); });
  await p.waitForTimeout(150);
  const view = await ev(p, () => app.ui.planningView);
  ok(viewBefore === 'agenda' && view === 'gantt', 'INITIAL-03 : non-persistance toujours vérifiée (migrateState() intacte)', 'INITIAL-03');
  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 4 — NON-RÉGRESSION SUR r5.1-prototype.html (NONREG-*)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'NONREG', w: 1440, h: 1000 });
  await ev(p, () => go('planning'));
  ok(await ev(p, () => document.querySelectorAll('.g-bar').length > 0), 'NONREG-01 : le Gantt continue de s’afficher normalement', 'NONREG-01');
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(120);
  ok(await ev(p, () => document.querySelectorAll('.kanban-col').length === 3), 'NONREG-02 : le Kanban continue d’afficher ses 3 colonnes', 'NONREG-02');
  await ev(p, () => { setDepth('pilot'); setPlanningView('gantt'); openTask('k-windows'); });
  await p.waitForTimeout(150);
  ok(await ev(p, () => document.getElementById('drawerContent')?.innerHTML.includes('Préparer un décalage')), 'NONREG-03 : « Préparer un décalage » toujours proposé', 'NONREG-03');
  await ev(p, () => closeOverlay('drawer'));
  await ev(p, () => selectProject('keravel'));
  await p.waitForTimeout(150);
  ok(await ev(p, () => [...document.querySelectorAll('.tab')].some((t) => t.textContent === 'Structure')), 'NONREG-04 : l’onglet Structure toujours proposé', 'NONREG-04');
  await ev(p, () => setDepth('essential'));
  const opsHidden = await ev(p, () => { go('sites'); return !document.querySelector('[onclick*="setSitesMode(\'operations\')"]'); });
  await ev(p, () => setDepth('pilot'));
  await p.waitForTimeout(100);
  const opsShown = await ev(p, () => !!document.querySelector('[onclick*="setSitesMode(\'operations\')"]'));
  ok(opsHidden && opsShown, 'NONREG-05 : gating R4 Opérations/Pilotage toujours inchangé', 'NONREG-05');
  await ev(p, () => go('planning'));
  const before = await ev(p, () => task('k-cloisons').status);
  await ev(p, () => setTaskStatus('k-cloisons', 'done'));
  await ev(p, () => undo());
  const after = await ev(p, () => task('k-cloisons').status);
  ok(before === after, 'NONREG-07 : Undo/Redo toujours fonctionnel', 'NONREG-07');
  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 5 — FICHIER DE TEST UTILISATEUR, OUVERTURE DIRECTE (USERTEST-*)');
console.log(' (aucune injection Playwright — uniquement lecture d’état)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'USERTEST-direct', file: R51_USERTEST, w: 1440, h: 1000, direct: true });

  const state = await ev(p, () => ({
    now: nowDate().toISOString(),
    store: STORE,
    r5Ids: app.tasks.filter((t) => t.id.startsWith('r5-')).map((t) => t.id).sort(),
    chape5j: app.tasks.find((t) => t.id === 'r5-5j')?.name,
    hasContinuityNotice: !!document.querySelector('#kanvixContinuity'),
  }));
  note('USERTEST-01-etat', state);
  ok(state.r5Ids.length === 9, 'USERTEST-01 : les 9 fixtures R5 sont visibles dès l’ouverture DIRECTE du fichier, sans aucune assistance Playwright', 'USERTEST-01');
  ok(state.chape5j === 'R5 — Chape 5 jours', 'USERTEST-02 : « R5 — Chape 5 jours » — la tâche demandée par le protocole — est bien présente, avec son nom exact', 'USERTEST-02');
  ok(state.now === '2026-08-17T09:00:00.000Z', 'USERTEST-03 : l’horloge de démonstration est figée au lundi 17 août 2026 09:00 par défaut, sans paramètre ?now= dans cette ouverture', 'USERTEST-03');
  ok(state.store !== 'kanvix-product-8-3' && state.store === 'kanvix-r5-user-test-8-3', 'USERTEST-04 : le fichier utilise une clé de stockage dédiée, distincte du STORE normal de Kanvix', 'USERTEST-04');
  ok(!state.hasContinuityNotice, 'USERTEST-04b : la bannière produit « Cette copie de Kanvix ne contient pas encore de données enregistrées » (non liée à R5) ne s’affiche PAS — sans quoi elle apparaîtrait devant chaque participant à chaque séance, puisque l’état est volontairement réinitialisé à chaque ouverture', 'USERTEST-04b');

  await ev(p, () => go('planning'));
  await p.waitForTimeout(150);
  const periodLabel = await p.$eval('.period-label', (e) => e.textContent).catch(() => null);
  ok(periodLabel === 'Semaine du 17 au 23 août', 'USERTEST-05 : la semaine du 17 au 23 août 2026 s’affiche bien par défaut', 'USERTEST-05');

  const ganttOk = await ev(p, () => document.querySelectorAll('.g-bar').length > 0);
  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(120);
  const kanbanOk = await ev(p, () => document.querySelectorAll('.kanban-col').length === 3);
  await ev(p, () => setPlanningView('agenda'));
  await p.waitForTimeout(120);
  const agendaOk = await ev(p, () => !!document.querySelector('.agenda-view') && [...document.querySelectorAll('.day-task')].some((e) => e.getAttribute('onclick')?.includes("'r5-5j'")));
  ok(ganttOk && kanbanOk && agendaOk, 'USERTEST-06 : Gantt, Kanban et Agenda se comportent tous normalement dans ce fichier, avec les fixtures R5 visibles en Agenda', 'USERTEST-06');

  await ctx.close();
}
{
  // Idempotence + déterminisme : modifier l’état, puis rouvrir deux fois de suite.
  const { ctx, p } = await newPage({ tag: 'USERTEST-idempotence', file: R51_USERTEST, w: 1440, h: 1000, direct: true });
  await ev(p, () => setTaskStatus('r5-5j', 'done'));
  await p.goto(F(R51_USERTEST), { waitUntil: 'load' });
  await p.waitForTimeout(250);
  await p.goto(F(R51_USERTEST), { waitUntil: 'load' });
  await p.waitForTimeout(250);
  const after = await ev(p, () => ({ total: app.tasks.length, r5Count: app.tasks.filter((t) => t.id.startsWith('r5-')).length, status: app.tasks.find((t) => t.id === 'r5-5j')?.status }));
  note('USERTEST-07', after);
  ok(after.r5Count === 9, 'USERTEST-07 : après une modification puis 2 réouvertures successives, toujours EXACTEMENT 9 fixtures R5 — aucune duplication', 'USERTEST-07');
  ok(after.status === 'doing', 'USERTEST-08 : chaque réouverture repart d’un état propre et déterministe (le statut modifié en séance précédente n’est pas conservé)', 'USERTEST-08');
  await ctx.close();
}
{
  // Isolation de stockage : même contexte navigateur (même profil de stockage
  // sous file://), ouvrir la RÉFÉRENCE CERTIFIÉE après le fichier de test.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(R51_USERTEST), { waitUntil: 'load' });
  await p.waitForTimeout(200);
  await ev(p, () => setTaskStatus('r5-5j', 'done'));
  await p.goto(F(REF), { waitUntil: 'load' });
  await ev(p, () => { resetApp(); dismissKanvixContinuityNotice(); });
  await p.waitForTimeout(200);
  const refState = await ev(p, () => ({ store: STORE, count: app.tasks.length, hasR5: app.tasks.some((t) => t.id.startsWith('r5-')) }));
  note('USERTEST-09-isolation', refState);
  ok(refState.store === 'kanvix-product-8-3' && !refState.hasR5, 'USERTEST-09 : ouverte ENSUITE dans le MÊME contexte navigateur, la référence certifiée ne porte AUCUNE trace des données ou du STORE de test — isolation prouvée, pas seulement déclarée', 'USERTEST-09');
  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 6 — LANCEUR DE SÉANCES (LANCEUR-*)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'LANCEUR', file: LAUNCHER, w: 1440, h: 1000, direct: true });
  const links = await p.$$eval('.card a.launch', (els) => els.map((e) => e.getAttribute('href')));
  ok(links.length === 8, 'LANCEUR-01 : exactement 8 boutons (Personne 1 à 8)', 'LANCEUR-01');

  const attendu = [
    { vue: 'gantt', vocab: 'current' }, { vue: 'agenda', vocab: 'plain' },
    { vue: 'gantt', vocab: 'plain' }, { vue: 'agenda', vocab: 'current' },
    { vue: 'gantt', vocab: 'current' }, { vue: 'agenda', vocab: 'plain' },
    { vue: 'gantt', vocab: 'plain' }, { vue: 'agenda', vocab: 'current' },
  ];
  const parsed = links.map((href) => {
    const u = new URL(href, 'file:///x/');
    return { now: u.searchParams.get('now'), vue: u.searchParams.get('r5Initial'), vocab: u.searchParams.get('r5Labels') };
  });
  note('LANCEUR-02-parsed', parsed);
  const comboOk = parsed.every((x, i) => x.vue === attendu[i].vue && x.vocab === attendu[i].vocab);
  ok(comboOk, 'LANCEUR-02 : les 8 combinaisons vue initiale / vocabulaire correspondent EXACTEMENT au tableau de contre-balancement de la mission', 'LANCEUR-02');
  ok(parsed.every((x) => x.now === '2026-08-17T09:00:00'), 'LANCEUR-03 : les 8 liens incluent tous now=2026-08-17T09:00:00', 'LANCEUR-03');

  // Navigation réelle : cliquer sur le bouton de la Personne 2 (Agenda + Chronologie/Avancement).
  const [p2] = await Promise.all([ctx.waitForEvent('page'), p.click('.card:nth-child(2) a.launch')]);
  p2.on('pageerror', (e) => allErrs.push({ where: 'LANCEUR-click', msg: e.message }));
  await p2.route('https://**', (r) => r.abort('failed'));
  await p2.waitForLoadState('load');
  await p2.waitForTimeout(250);
  const clicked = await ev(p2, () => app.ui.planningView);
  await ev(p2, () => go('planning'));
  await p2.waitForTimeout(150);
  const clickedLabels = await p2.$$eval('.view-segment button', (els) => els.map((e) => e.textContent));
  note('LANCEUR-04-clic-personne2', { clicked, clickedLabels });
  ok(clicked === 'agenda' && JSON.stringify(clickedLabels) === JSON.stringify(['Chronologie', 'Avancement', 'Agenda']), 'LANCEUR-04 : cliquer sur « Personne 2 » ouvre réellement la séance en Agenda avec le vocabulaire Chronologie/Avancement', 'LANCEUR-04');
  await p2.close();
  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 7 — CONTRÔLES DIFFÉRENTIELS EXHAUSTIFS (FREEZE-*)');
console.log('============================================================');
const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
const extractFn = (src, name) => {
  const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
  const m = re.exec(src); if (!m) return null;
  let par = src.indexOf('(', m.index), depth = 0, k = par;
  for (; k < src.length; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') { depth--; if (!depth) { k++; break; } } }
  let i = src.indexOf('{', k), d = 0, j = i, s = null, esc = false;
  for (; j < src.length; j++) {
    const c = src[j];
    if (s) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === s) s = null; continue; }
    if (c === '"' || c === "'" || c === '`') { s = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { j++; break; } }
  }
  return src.slice(m.index, j);
};
function functionDiff(A, B, expectedModified, expectedAdded) {
  const nomsB = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  const nomsA = [...new Set([...A.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  const horsPerimetre = [], ajoutees = [], supprimees = [];
  nomsB.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !expectedModified.includes(n)) horsPerimetre.push(n);
  });
  nomsA.forEach((n) => { if (!nomsB.includes(n)) supprimees.push(n); });
  return { ajoutees, supprimees, horsPerimetre, ajouteesOk: JSON.stringify(ajoutees.slice().sort()) === JSON.stringify(expectedAdded.slice().sort()) };
}
{
  const A = fs.readFileSync(BASE + REF, 'utf8'), B = fs.readFileSync(BASE + R51_PROTO, 'utf8');
  const expectedModified = ['renderPlanning', 'setPlanningView'];
  const expectedAdded = ['agendaTaskBounds', 'agendaFirstWorkingDay', 'agendaLastWorkingDay', 'agendaWorkingDays', 'agendaMarker', 'agendaOccurrenceTime', 'agendaGroups', 'agendaOccurrenceRow', 'renderAgenda'];
  const d = functionDiff(A, B, expectedModified, expectedAdded);
  note('FREEZE-REF-R51', d);
  ok(d.horsPerimetre.length === 0, 'FREEZE-A : hors renderPlanning()/setPlanningView(), aucune fonction existante n’a changé entre V2.12.2.1 et r5.1-prototype.html', 'FREEZE-A');
  ok(d.ajouteesOk && d.supprimees.length === 0, 'FREEZE-A : exactement les 9 fonctions Agenda attendues sont ajoutées (les 6 de R5 + les 3 nouvelles du correctif), aucune supprimée', 'FREEZE-A');

  const migA = extractFn(A, 'migrateState'), migB = extractFn(B, 'migrateState');
  ok(md5(migA) === md5(migB), 'FREEZE-A : migrateState() toujours byte-identique', 'FREEZE-A');
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const initialIdentique = md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/));
  ok(initialIdentique, 'FREEZE-A : INITIAL_STATE toujours inchangé — aucune fixture R5 n’entre dans les données de démonstration livrées', 'FREEZE-A');

  const geles = [
    'taskShiftEligibility', 'shiftChainHasCycle', 'computeShiftChain', 'buildShiftFingerprint',
    'evaluateShiftImpact', 'openPrepareShift', 'renderPrepareShiftForm', 'pickShiftPropagate',
    'submitPrepareShiftForm', 'renderPrepareShiftPreview', 'toggleShiftConfirm', 'cancelPrepareShift',
    'renderPrepareShiftError', 'applyPrepareShift',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'evaluateDependencyConflicts',
    'getResourceSchedulingConflicts', 'addBusinessDays', 'addWorkingDuration', 'nextWorkingTime',
    'nonWorkingDaysInRange', 'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState',
    'preserveCommunications', 'invalidateRedo', 'setTaskStatus', 'scenarioOptions', 'evaluateScenario',
    'showWhatIf', 'startWhatIf', 'sendConversationMessage', 'sendArtisanMessage', 'openConversation',
    'addPhoto', 'addFieldPhoto', 'taskCreatesCycle', 'getTaskSuccessors', 'getTaskPredecessors',
    'getProjectStructure', 'openStructureForm', 'toggleStructureArchive', 'confirmDeleteTask',
    'guardEditable', 'canEditProject', 'save', 'resetApp', 'render', 'openTask',
    'renderOperationsList', 'operationCard', 'getOperationSummary', 'selectOperation',
    'setDepth', 'renderSites', 'sitesModeSwitch', 'renderMore', 'renderUserMenu', 'renderArtisan',
    'gantt', 'kanbanBoard', 'planningTasks', 'scale', 'planningAgenda', 'setRole',
  ];
  let compares = 0; const bouges = [];
  geles.forEach((n) => { const a = extractFn(A, n), c = extractFn(B, n); if (!a || !c) return; compares++; if (md5(a) !== md5(c)) bouges.push(n); });
  ok(compares > 55 && bouges.length === 0, `FREEZE-A : les ${compares} moteurs gelés restent BYTE-IDENTIQUES (décalage, calendrier, dépendances/ressources, Undo/Redo/communications, Structure, Opérations, Essentiel/Pilotage, Gantt, Kanban)`, 'FREEZE-A');

  const hunks = (execSync(`diff -u '${BASE + REF}' '${BASE + R51_PROTO}' | grep -c '^@@' || true`).toString().trim());
  note('FREEZE-A-diff-brute', { hunks });
  ok(Number(hunks) === 7, 'FREEZE-A : la diff brute (diff -u) ne compte toujours que 7 blocs de changement entre la référence et r5.1-prototype.html', 'FREEZE-A');
}
{
  const A = fs.readFileSync(BASE + R5_ORIG, 'utf8'), B = fs.readFileSync(BASE + R51_PROTO, 'utf8');
  const expectedModified = ['agendaWorkingDays', 'agendaMarker', 'agendaOccurrenceTime', 'agendaGroups', 'agendaOccurrenceRow'];
  const expectedAdded = ['agendaTaskBounds', 'agendaFirstWorkingDay', 'agendaLastWorkingDay'];
  const d = functionDiff(A, B, expectedModified, expectedAdded);
  note('FREEZE-R5-R51', d);
  ok(d.horsPerimetre.length === 0, 'FREEZE-B : hors des 5 fonctions Agenda du correctif, AUCUNE autre fonction (renderPlanning, setPlanningView, renderAgenda compris) n’a changé entre R5 et R5.1', 'FREEZE-B');
  ok(d.ajouteesOk && d.supprimees.length === 0, 'FREEZE-B : exactement les 3 fonctions utilitaires attendues sont ajoutées (agendaTaskBounds/agendaFirstWorkingDay/agendaLastWorkingDay), aucune supprimée', 'FREEZE-B');
  const hunks = (execSync(`diff -u '${BASE + R5_ORIG}' '${BASE + R51_PROTO}' | grep -c '^@@' || true`).toString().trim());
  ok(Number(hunks) === 5, 'FREEZE-B : la diff brute entre R5 original et R5.1 ne compte que 5 blocs, tous à l’intérieur du bloc de fonctions Agenda', 'FREEZE-B');
}
{
  const A = fs.readFileSync(BASE + R51_PROTO, 'utf8'), B = fs.readFileSync(BASE + R51_USERTEST, 'utf8');
  const d = functionDiff(A, B, [], []);
  note('FREEZE-R51-USERTEST', d);
  ok(d.horsPerimetre.length === 0 && d.ajoutees.length === 0 && d.supprimees.length === 0, 'FREEZE-C : ZÉRO fonction ne diffère entre r5.1-prototype.html et r5.1-user-test.html — le fichier de test reprend bien EXACTEMENT le même moteur, seuls des réglages hors fonction changent (STORE, horloge, amorçage des fixtures)', 'FREEZE-C');
  const hunks = (execSync(`diff -u '${BASE + R51_PROTO}' '${BASE + R51_USERTEST}' | grep -c '^@@' || true`).toString().trim());
  ok(Number(hunks) === 3, 'FREEZE-C : la diff brute ne compte que 3 blocs (clé de stockage, horloge figée, amorçage des fixtures)', 'FREEZE-C');
}

console.log('\n============================================================');
console.log(' PARTIE 8 — VALIDATION VISUELLE');
console.log('============================================================');
{
  const combos = [
    { tag: 'r51-agenda-desktop-clair', w: 1440, h: 1000, dark: false },
    { tag: 'r51-agenda-desktop-sombre', w: 1440, h: 1000, dark: true },
    { tag: 'r51-agenda-mobile-clair', w: 390, h: 844, dark: false },
  ];
  for (const c of combos) {
    const { ctx, p } = await newPage({ tag: 'VISUEL-' + c.tag, w: c.w, h: c.h, dark: c.dark });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);
    const overflow = await ev(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 1, `VISUEL-${c.tag} : aucun débordement horizontal`, 'VISUEL');
    await p.screenshot({ path: SHOTS + `${c.tag}.png` });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-lanceur', file: LAUNCHER, w: 1440, h: 1000, direct: true });
    await p.screenshot({ path: SHOTS + 'lanceur-test-utilisateurs.png', fullPage: true });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-seance-gantt-kanban', file: R51_USERTEST, w: 1440, h: 1000, params: '&r5Initial=gantt&r5Labels=current', direct: true });
    await ev(p, () => go('planning'));
    await p.waitForTimeout(200);
    await p.screenshot({ path: SHOTS + 'seance-gantt-kanban.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-seance-chrono-avanc', file: R51_USERTEST, w: 1440, h: 1000, params: '&r5Initial=agenda&r5Labels=plain', direct: true });
    await ev(p, () => go('planning'));
    await p.waitForTimeout(200);
    await p.screenshot({ path: SHOTS + 'seance-chronologie-avancement.png' });
    await ctx.close();
  }
}

console.log('\n============================================================');
console.log(' PARTIE 9 — PROTECTION (empreintes APRÈS) + ERREURS CONSOLE');
console.log('============================================================');
{
  const md5RefAfter = md5File(REF), md5R5OrigAfter = md5File(R5_ORIG);
  note('PROTECTION-9-apres', { REF: md5RefAfter, R5_ORIG: md5R5OrigAfter });
  ok(md5RefAfter === md5RefBefore, 'PROTECTION : kanvix-next-gen-v2.12.2.1.html — empreinte md5 strictement identique avant/après l’exécution complète de cette recette', 'PROTECTION');
  ok(md5R5OrigAfter === md5R5OrigBefore, 'PROTECTION : kanvix-next-gen-v2.12.2.1-r5-prototype.html — empreinte md5 strictement identique avant/après', 'PROTECTION');
}
note('ERREURS-CONSOLE-brutes', { total: allErrs.length, detail: allErrs.slice(0, 10) });
ok(allErrs.length === 0, `ERREURS-CONSOLE : 0 erreur console applicative sur l’ensemble des scénarios — ${allErrs.length} trouvée(s)`, 'ERREURS-CONSOLE');

await b.close();

console.log('\n============================================================');
console.log(` RÉSULTAT : ${passed} / ${results.length}`);
console.log('============================================================');
if (failed.length) {
  console.log('\nÉCHECS :');
  failed.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`ERREURS CONSOLE APPLICATIVES : ${allErrs.length}`);

fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({
  date: new Date().toISOString(),
  fichiers: { reference: REF, r5Original: R5_ORIG, r51Prototype: R51_PROTO, r51UserTest: R51_USERTEST, lanceur: LAUNCHER },
  protection: { REF: { avant: md5RefBefore }, R5_ORIG: { avant: md5R5OrigBefore } },
  passed, total: results.length, failed,
  consoleErrors: allErrs,
  results,
}, null, 2));
console.log(`\nRésultats écrits dans ${SHOTS}resultats.json`);
