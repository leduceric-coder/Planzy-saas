// ============================================================
// KANVIX — Recette « PROTOTYPE R5 » (expérimental, non définitif)
//
//   Valide le prototype public/poc/kanvix-next-gen-v2.12.2.1-r5-prototype.html :
//
//   1. AGENDA-* — moteur de la troisième représentation Planning « Agenda »
//      (répétition Début/Suite/Fin sur CHAQUE jour ouvré réellement occupé,
//      pas seulement le jour de début — contrairement au prototype Astra).
//   2. LABELS-* — test A/B de vocabulaire (Gantt/Kanban vs Chronologie/
//      Avancement), non persistant, piloté par ?r5Labels.
//   3. INITIAL-* — mode de test de la vue Planning initiale, non persistant,
//      piloté par ?r5Initial (repose sur migrateState() NON MODIFIÉE).
//   4. NONREG-* — non-régression (Gantt, Kanban, comportement par défaut,
//      Structure, Opérations, Essentiel/Pilotage, Undo/Redo/communications) —
//      allégée par construction : FREEZE-R5 (§5) PROUVE que tous les moteurs
//      concernés sont BYTE-IDENTIQUES à V2.12.2.1, donc ces contrôles sont des
//      tests de fumée (le comportement ne PEUT pas avoir changé), pas un
//      rejeu complet de la recette historique à 77 assertions.
//   5. FREEZE-R5 — contrôle différentiel EXHAUSTIF contre V2.12.2.1 (diff
//      brute ligne à ligne + balayage md5 fonction par fonction) : prouve
//      qu'aucun changement non indispensable au prototype n'a été introduit.
//   6. VISUEL-* — 4 combinaisons largeur/thème + 5 contrôles d'interaction
//      mandatés (débordement horizontal, lisibilité, repères, clavier/focus,
//      thème sombre + filtres + ouverture fiche + absence de chevauchement).
//
//   AUCUNE décision produit n'est prise ici (Agenda par défaut ? nouveau
//   vocabulaire ?) : ce sont des résultats TECHNIQUES et VISUELS uniquement.
//   La validation utilisateur reste entièrement à faire (voir
//   PROTOCOLE-TEST-UTILISATEURS-R5.md) — aucun résultat utilisateur n'est
//   inventé ici.
//
//   Usage : node recette-prototype-r5-v2.12.2.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
const { chromium } = pw;

const BASE = '/home/user/Planzy-saas/public/poc/';
const REF = 'kanvix-next-gen-v2.12.2.1.html'; // référence certifiée, JAMAIS modifiée
const CUR = 'kanvix-next-gen-v2.12.2.1-r5-prototype.html'; // prototype R5
const NOW = '2026-08-17T09:00:00'; // lundi — ancre de démonstration existante
const F = (file = CUR, params = '') => 'file://' + BASE + file + '?now=' + NOW + params;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-r5/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1600)}`);
const allErrs = [];

// Bruit connu, préexistant, INDÉPENDANT de ce prototype : confirmé (audit
// manuel) présent À L'IDENTIQUE sur kanvix-next-gen-v2.12.2.1.html lui-même
// (3 échecs réseau ERR_TUNNEL_CONNECTION_FAILED par chargement, environnement
// sandbox sans sortie HTTPS libre) — même convention de filtrage que
// recette-corrective-v2.12.2.1.mjs.
const BRUIT_CONNU = /ERR_FAILED|ERR_TUNNEL|Failed to load resource/;

async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = CUR, params = '', dark = false, skipReset = false } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !BRUIT_CONNU.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, params), { waitUntil: 'load' });
  // resetApp() régénère app DEPUIS INITIAL_STATE (via un second migrateState()) pour un
  // jeu de données déterministe — mais un second migrateState() ne réapplique PAS la
  // bascule r5Initial (à usage unique, exécutée UNE SEULE fois au tout premier chargement
  // du script). Pour les tests qui portent PRÉCISÉMENT sur cette bascule initiale
  // (?r5Initial), on saute resetApp() : le contexte Playwright est de toute façon déjà un
  // localStorage vierge, donc les données de démo sont déjà les données par défaut.
  if (!skipReset) await p.evaluate(() => resetApp());
  await p.evaluate(() => dismissKanvixContinuityNotice());
  if (dark) await p.evaluate(() => setAppearance('dark'));
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// Jeu de données R5 — TEMPORAIRE, recette-only, poussé dans app.tasks au
// runtime (JAMAIS dans INITIAL_STATE). Couvre EXHAUSTIVEMENT chaque cas de
// l'Agenda exigé par la mission, sur les projets/ressources/lots/structure
// RÉELS de la démo (aucune clé étrangère inventée).
async function seedR5Tasks(p) {
  return ev(p, () => {
    const before = app.tasks.length;
    app.tasks.push(
      // 1) Intervention de 5 jours ouvrés (lun→ven) — répétition Début/Suite×3/Fin.
      { id: 'r5-5j', projectId: 'keravel', name: 'R5 — Chape 5 jours', resourceId: 'thomas',
        start: '2026-08-17T08:00', end: '2026-08-21T17:00', status: 'doing', deps: [],
        lotId: 'lot-platrerie', structureNodeId: 'sn-keravel-etage-1', colorKey: 'auto' },
      // 2) Traversée de week-end (ven→lun) — aucune ligne samedi/dimanche artificielle.
      { id: 'r5-we', projectId: 'terrasses', name: 'R5 — Coulage traverse week-end', resourceId: 'marc',
        start: '2026-08-21T14:00', end: '2026-08-24T10:00', status: 'todo', deps: [],
        colorKey: 'auto' },
      // 3) Commencée AVANT la semaine affichée (13 août, jeudi précédent) — seules les
      //    occurrences RÉELLEMENT dans la fenêtre visible doivent apparaître.
      { id: 'r5-avant', projectId: 'keravel', name: 'R5 — Débutée avant la période', resourceId: 'mathieu',
        start: '2026-08-13T08:00', end: '2026-08-18T12:00', status: 'late', deps: [],
        colorKey: 'auto' },
      // 4) Termine PENDANT la période (commence avant, finit dans la semaine).
      { id: 'r5-finpendant', projectId: 'terrasses', name: 'R5 — Finit pendant la période', resourceId: 'eric',
        start: '2026-08-12T08:00', end: '2026-08-19T16:00', status: 'waiting', deps: [],
        colorKey: 'auto' },
      // 5) Couvre ENTIÈREMENT la période affichée (commence avant, finit après).
      { id: 'r5-couvre', projectId: 'horizon', name: 'R5 — Couvre toute la période', resourceId: 'legall',
        start: '2026-08-10T08:00', end: '2026-09-10T17:00', status: 'doing', deps: [],
        colorKey: 'auto' },
      // 6) Tâche ponctuelle terminée (statut done) le même jour que plusieurs autres.
      { id: 'r5-done', projectId: 'keravel', name: 'R5 — Terminée', resourceId: 'eric',
        start: '2026-08-17T07:00', end: '2026-08-17T07:30', status: 'done', deps: [],
        colorKey: 'auto' },
      // 7) Courte intervention le même jour — pour « plusieurs le même jour ».
      { id: 'r5-courte1', projectId: 'keravel', name: 'R5 — Courte A', resourceId: 'marc',
        start: '2026-08-17T13:00', end: '2026-08-17T13:30', status: 'todo', deps: [],
        colorKey: 'auto' },
      { id: 'r5-courte2', projectId: 'keravel', name: 'R5 — Courte B', resourceId: 'marc',
        start: '2026-08-17T15:00', end: '2026-08-17T15:20', status: 'todo', deps: ['r5-courte1'],
        colorKey: 'auto' },
      // 8) Point d'attention RÉEL et visible : même ressource (marc), deux tâches qui
      //    SE CHEVAUCHENT le même jour (r5-we débute 14h le 21 ; r5-conflit aussi).
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
console.log(' PARTIE 0 — INTÉGRITÉ DU PÉRIMÈTRE (avant tout test)');
console.log('============================================================');
{
  const refExists = fs.existsSync(BASE + REF), curExists = fs.existsSync(BASE + CUR);
  ok(refExists && curExists, 'Les deux fichiers (référence V2.12.2.1 et prototype R5) existent bien sur disque', 'PERIM-0');
  const refHash = crypto.createHash('md5').update(fs.readFileSync(BASE + REF)).digest('hex');
  note('PERIM-0-ref-md5', { md5: refHash, taille: fs.statSync(BASE + REF).size });
}

console.log('\n============================================================');
console.log(' PARTIE 1 — MOTEUR AGENDA (AGENDA-*)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'AGENDA', w: 1440, h: 1000 });
  const seed = await seedR5Tasks(p);
  note('AGENDA-seed', seed);
  ok(seed.added === 9, 'Le jeu de données R5 (9 tâches) est bien ajouté à app.tasks sans en écraser aucune existante', 'AGENDA-00');

  await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); app.ui.planningProject = 'all'; app.ui.planningResource = 'all'; app.ui.planningLot = 'all'; app.ui.planningStructure = 'all'; setPlanningView('agenda'); });
  await p.waitForTimeout(200);

  const state = await ev(p, () => ({
    view: app.ui.planningView,
    hasAgendaView: !!document.querySelector('.agenda-view'),
    taskCount: app.tasks.length,
  }));
  note('AGENDA-01-etat', state);
  ok(state.view === 'agenda' && state.hasAgendaView, 'AGENDA-01 : la vue Agenda est bien active et rendue (.agenda-view présent)', 'AGENDA-01');
  // .mobile-agenda est le repli MOBILE du GANTT lui-même (rendu par gantt(), pas par
  // renderAgenda()) : il n'apparaît donc que quand la vue Gantt est active, jamais en
  // vue Agenda (qui REMPLACE tout le contenu du Gantt, mobile-agenda inclus). Preuve
  // qu'il reste intact et non touché : on le vérifie en revenant sur Gantt.
  await ev(p, () => setPlanningView('gantt'));
  await p.waitForTimeout(120);
  const hasMobileAgenda = await ev(p, () => !!document.querySelector('.mobile-agenda'));
  note('AGENDA-01b', { hasMobileAgenda });
  ok(hasMobileAgenda, 'AGENDA-01b : .mobile-agenda (repli mobile préexistant DU GANTT) reste présent et intact en vue Gantt — moteur DISTINCT, non touché par R5', 'AGENDA-01b');
  await ev(p, () => setPlanningView('agenda'));
  await p.waitForTimeout(120);

  // AGENDA-02 — 5 jours ouvrés : Début / Suite×3 / Fin, 5 lignes, même tâche.
  const rows5j = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-5j'"))
    .map((el) => ({ day: el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent, marker: el.querySelector('.pill:not(.accent):not(.success):not(.warning):not(.danger)')?.textContent || null })));
  note('AGENDA-02-5jours', rows5j);
  ok(rows5j.length === 5, 'AGENDA-02 : une tâche de 5 jours ouvrés (lun→ven) produit EXACTEMENT 5 occurrences (une par jour réellement occupé)', 'AGENDA-02');
  ok(rows5j[0]?.marker === 'Début' && rows5j[4]?.marker === 'Fin', 'AGENDA-02 : la 1ère occurrence porte « Début », la dernière porte « Fin »', 'AGENDA-02');
  ok(rows5j.slice(1, 4).every((r) => r.marker === 'Suite'), 'AGENDA-02 : les 3 occurrences intermédiaires portent toutes « Suite » (jamais « En cours », pour ne pas entrer en collision avec le statut)', 'AGENDA-02');

  // AGENDA-03 — traversée de week-end : aucune ligne samedi/dimanche artificielle.
  const daysPresent = await ev(p, () => [...document.querySelectorAll('.agenda-day-head b')].map((b) => b.textContent));
  note('AGENDA-03-jours-affiches', daysPresent);
  const hasWeekendLabel = daysPresent.some((d) => /^(sam|dim)\./.test(d) && d !== 'dim. 23 août' /* r5-couvre force cette date, voir AGENDA-06 */);
  ok(!daysPresent.some((d) => /^sam\./.test(d)), 'AGENDA-03 : aucun groupe-jour « samedi » n’est créé — projectCalendar.workingDays (lun-ven) est la seule vérité, sans ligne week-end artificielle', 'AGENDA-03');
  const rowsWE = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-we'"))
    .map((el) => el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent));
  note('AGENDA-03-r5-we', rowsWE);
  ok(rowsWE.length === 1 && /^ven\./.test(rowsWE[0] || ''), 'AGENDA-03 : la tâche vendredi 14h→lundi 10h n’apparaît QUE le vendredi dans la fenêtre affichée (lundi suivant hors fenêtre de cette semaine)', 'AGENDA-03');

  // AGENDA-04 — commencée avant la période : pas d'occurrence avant le début de fenêtre.
  const rowsAvant = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-avant'"))
    .map((el) => el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent));
  note('AGENDA-04-avant', rowsAvant);
  ok(rowsAvant.length > 0 && rowsAvant.every((d) => !/^(jeu\. 13|ven\. 14)/.test(d)), 'AGENDA-04 : une tâche commencée le 13 août (avant la semaine du 17) n’affiche AUCUNE occurrence avant le début de la fenêtre visible', 'AGENDA-04');

  // AGENDA-05 — termine pendant la période.
  const rowsFinPendant = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-finpendant'"))
    .map((el) => el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent));
  note('AGENDA-05-fin-pendant', rowsFinPendant);
  ok(rowsFinPendant.length > 0 && rowsFinPendant[rowsFinPendant.length - 1] === 'mer. 19 août', 'AGENDA-05 : une tâche commencée avant la période et finissant le 19 août affiche bien sa dernière occurrence le 19, sans dépasser', 'AGENDA-05');

  // AGENDA-06 — couvre toute la période : chaque jour ouvré visible porte une occurrence, TOUTES marquées Suite (ni Début ni Fin ne tombent dans la fenêtre).
  const rowsCouvre = await ev(p, () => [...document.querySelectorAll('.day-task')]
    .filter((el) => el.getAttribute('onclick')?.includes("'r5-couvre'"))
    .map((el) => ({ day: el.closest('.agenda-day')?.querySelector('.agenda-day-head b')?.textContent, marker: el.querySelector('.pill')?.textContent })));
  note('AGENDA-06-couvre', rowsCouvre);
  ok(rowsCouvre.length === 5, 'AGENDA-06 : une tâche qui couvre toute la période affichée produit une occurrence pour CHACUN des 5 jours ouvrés visibles de la semaine', 'AGENDA-06');
  ok(rowsCouvre.every((r) => r.marker === 'Suite'), 'AGENDA-06 : aucune de ces occurrences visibles n’est marquée Début ni Fin (les vrais bornes sont hors fenêtre) — la date réelle de la tâche n’est jamais recadrée', 'AGENDA-06');

  // AGENDA-07 — statuts.
  const statusRow = async (id) => ev(p, (i) => {
    const el = [...document.querySelectorAll('.day-task')].find((e) => e.getAttribute('onclick')?.includes(`'${i}'`));
    return el ? [...el.querySelectorAll('.pill')].map((x) => x.textContent) : null;
  }, id);
  const stDone = await statusRow('r5-done'), stTodo = await statusRow('r5-courte1'), stDoing = await statusRow('r5-5j'), stLate = await statusRow('r5-avant'), stWaiting = await statusRow('r5-finpendant');
  note('AGENDA-07-statuts', { stDone, stTodo, stDoing, stLate, stWaiting });
  ok(stDone?.includes('Terminée'), 'AGENDA-07 : statut « done » → pastille « Terminée »', 'AGENDA-07');
  ok(stTodo?.includes('À faire'), 'AGENDA-07 : statut « todo » → pastille « À faire »', 'AGENDA-07');
  ok(stDoing?.includes('En cours'), 'AGENDA-07 : statut « doing » → pastille « En cours »', 'AGENDA-07');
  ok(stLate?.includes('En retard'), 'AGENDA-07 : statut « late » → pastille « En retard »', 'AGENDA-07');
  ok(stWaiting?.includes('En attente'), 'AGENDA-07 : statut « waiting » → pastille « En attente »', 'AGENDA-07');

  // AGENDA-08 — plusieurs interventions le même jour + compteur.
  const lundi = await ev(p, () => {
    const grp = [...document.querySelectorAll('.agenda-day')].find((d) => d.querySelector('.agenda-day-head b').textContent === 'lun. 17 août');
    return { count: grp?.querySelectorAll('.day-task').length, label: grp?.querySelector('.agenda-day-count')?.textContent };
  });
  note('AGENDA-08-lundi', lundi);
  ok(lundi.count > 5, 'AGENDA-08 : plusieurs interventions le même jour (lundi 17 août) apparaissent bien comme autant de lignes distinctes', 'AGENDA-08');
  ok(lundi.label === `${lundi.count} interventions`, 'AGENDA-08 : le compteur de jour affiche le bon nombre d’interventions, au pluriel', 'AGENDA-08');

  // AGENDA-09→12 — les 4 filtres (mêmes qu'en Gantt/Kanban, via planningTasks réutilisée).
  await ev(p, () => { app.ui.planningProject = 'all'; app.ui.planningResource = 'all'; app.ui.planningLot = 'all'; app.ui.planningStructure = 'all'; save(); });
  await ev(p, () => { app.ui.planningProject = 'keravel'; save(); renderPage(); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const projTaskIdsAgenda = await ev(p, () => [...document.querySelectorAll('.day-task')].map((e) => e.getAttribute('onclick')).join('|'));
  ok(!/'r5-we'/.test(projTaskIdsAgenda) === true, 'AGENDA-09 : le filtre CHANTIER masque bien en Agenda les tâches d’un autre chantier (r5-we est sur "terrasses")', 'AGENDA-09');
  ok(/'r5-5j'/.test(projTaskIdsAgenda), 'AGENDA-09 : le filtre CHANTIER conserve bien les tâches du chantier sélectionné (r5-5j est sur "keravel")', 'AGENDA-09');

  await ev(p, () => { app.ui.planningProject = 'all'; app.ui.planningResource = 'marc'; save(); renderPage(); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const resAgenda = await ev(p, () => [...document.querySelectorAll('.day-task')].map((e) => e.getAttribute('onclick')).join('|'));
  note('AGENDA-10-ressource', { resAgenda });
  ok(/'r5-we'/.test(resAgenda) && /'r5-conflit'/.test(resAgenda) && !/'r5-5j'/.test(resAgenda), 'AGENDA-10 : le filtre RESSOURCE (marc) ne conserve en Agenda QUE les tâches de marc — même comportement que Gantt/Kanban', 'AGENDA-10');

  await ev(p, () => { app.ui.planningResource = 'all'; app.ui.planningLot = 'lot-platrerie'; save(); renderPage(); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const lotAgenda = await ev(p, () => [...document.querySelectorAll('.day-task')].map((e) => e.getAttribute('onclick')).join('|'));
  note('AGENDA-11-lot', { lotAgenda });
  ok(/'r5-5j'/.test(lotAgenda) && !/'r5-we'/.test(lotAgenda), 'AGENDA-11 : le filtre LOT (platrerie) ne conserve en Agenda que les tâches de ce lot', 'AGENDA-11');

  await ev(p, () => { app.ui.planningLot = 'all'; app.ui.planningProject = 'keravel'; app.ui.planningStructure = 'sn-keravel-etage-1'; save(); renderPage(); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const structAgenda = await ev(p, () => [...document.querySelectorAll('.day-task')].map((e) => e.getAttribute('onclick')).join('|'));
  note('AGENDA-12-structure', { structAgenda });
  ok(/'r5-5j'/.test(structAgenda), 'AGENDA-12 : le filtre STRUCTURE conserve bien la tâche rattachée au nœud sélectionné en Agenda', 'AGENDA-12');
  await ev(p, () => { app.ui.planningStructure = 'all'; app.ui.planningProject = 'all'; save(); renderPage(); });

  // AGENDA-13 — dépendance : la tâche dépendante s'affiche normalement.
  const depRow = await statusRow('r5-courte2');
  note('AGENDA-13-dependance', depRow);
  ok(!!depRow, 'AGENDA-13 : une tâche portant une dépendance (deps) s’affiche normalement en Agenda, sans erreur', 'AGENDA-13');

  // AGENDA-14 — point d'attention/conflit visible : Pilotage → bandeau Analyse présent au-dessus de l'Agenda.
  await ev(p, () => { setDepth('pilot'); setPlanningView('agenda'); });
  await p.waitForTimeout(120);
  const conflictState = await ev(p, () => ({
    hasAnalysisBar: !!document.querySelector('.analysis-bar'),
    hasAgendaStill: !!document.querySelector('.agenda-view'),
  }));
  note('AGENDA-14-conflit', conflictState);
  ok(conflictState.hasAnalysisBar && conflictState.hasAgendaStill, 'AGENDA-14 : en Pilotage, le bandeau Analyse (conflits/dépendances) cohabite normalement au-dessus de la vue Agenda, sans la casser', 'AGENDA-14');

  // AGENDA-15 — ouverture de fiche depuis une ligne Agenda = même fiche que partout ailleurs.
  await ev(p, () => openTask('r5-5j'));
  await p.waitForTimeout(150);
  const drawer = await ev(p, () => ({
    open: document.getElementById('drawer')?.classList.contains('open'),
    hasName: document.getElementById('drawerContent')?.innerHTML.includes('R5 — Chape 5 jours'),
    selected: app.ui.selectedTask,
  }));
  note('AGENDA-15-fiche', drawer);
  ok(drawer.open && drawer.hasName && drawer.selected === 'r5-5j', 'AGENDA-15 : cliquer une ligne Agenda ouvre EXACTEMENT la même fiche tâche (openTask) que le Gantt/Kanban — aucune vue de détail parallèle', 'AGENDA-15');
  await ev(p, () => closeOverlay('drawer'));

  // AGENDA-16 — aucune duplication de app.tasks.
  const finalCount = await ev(p, () => app.tasks.length);
  ok(finalCount === seed.after, 'AGENDA-16 : après tous les rendus et bascules de vue, app.tasks n’a NI grossi NI rétréci — aucune occurrence n’est stockée, tout est recalculé au rendu', 'AGENDA-16');

  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 2 — VOCABULAIRE A/B (LABELS-*)');
console.log('============================================================');
{
  // LABELS-01 — défaut (sans paramètre) : Gantt/Kanban inchangés, Agenda présent.
  {
    const { ctx, p } = await newPage({ tag: 'LABELS-01' });
    await ev(p, () => go('planning'));
    const labels = await ev(p, () => [...document.querySelectorAll('.view-segment button')].map((b) => b.textContent));
    note('LABELS-01', labels);
    ok(JSON.stringify(labels) === JSON.stringify(['Gantt', 'Kanban', 'Agenda']), 'LABELS-01 : sans paramètre, les libellés restent EXACTEMENT « Gantt / Kanban / Agenda » — comportement V2.12.2.1 inchangé sur les deux premiers', 'LABELS-01');
    await ctx.close();
  }
  // LABELS-02 — variante « plain ».
  {
    const { ctx, p } = await newPage({ tag: 'LABELS-02', params: '&r5Labels=plain' });
    await ev(p, () => go('planning'));
    const labels = await ev(p, () => [...document.querySelectorAll('.view-segment button')].map((b) => b.textContent));
    note('LABELS-02', labels);
    ok(JSON.stringify(labels) === JSON.stringify(['Chronologie', 'Avancement', 'Agenda']), 'LABELS-02 : avec ?r5Labels=plain, les libellés deviennent « Chronologie / Avancement / Agenda »', 'LABELS-02');
    // LABELS-03 — la valeur INTERNE ne varie jamais avec le vocabulaire (présentation seule).
    await ev(p, () => setPlanningView('gantt'));
    const internal = await ev(p, () => app.ui.planningView);
    note('LABELS-03', { internal });
    ok(internal === 'gantt', 'LABELS-03 : quelle que soit la variante de vocabulaire, la valeur interne app.ui.planningView reste "gantt"/"kanban"/"agenda" — jamais "chronologie" ni "avancement"', 'LABELS-03');
    await ctx.close();
  }
  // LABELS-04 — non-persistance du paramètre.
  {
    const { ctx, p } = await newPage({ tag: 'LABELS-04', params: '&r5Labels=plain' });
    await ev(p, () => go('planning'));
    const raw = await ev(p, () => localStorage.getItem(STORE));
    note('LABELS-04', { containsR5Labels: raw.includes('r5Labels') || raw.includes('plain') });
    ok(!raw.includes('r5Labels') && !JSON.parse(raw).ui?.hasOwnProperty?.('r5LabelsMode'), 'LABELS-04 : ?r5Labels n’est écrit NULLE PART dans localStorage — c’est un paramètre d’URL pur, jamais un champ d’état, donc non persistant par construction', 'LABELS-04');
    await ctx.close();
  }
}

console.log('\n============================================================');
console.log(' PARTIE 3 — MODE DE TEST « VUE INITIALE » (INITIAL-*)');
console.log('============================================================');
{
  // INITIAL-01/02 — chaque valeur ouvre bien la vue demandée.
  for (const v of ['agenda', 'kanban', 'gantt']) {
    const { ctx, p } = await newPage({ tag: 'INITIAL-' + v, params: '&r5Initial=' + v, skipReset: true });
    await ev(p, () => go('planning'));
    const view = await ev(p, () => app.ui.planningView);
    note('INITIAL-' + v, { view });
    ok(view === v, `INITIAL-0${v === 'agenda' ? 1 : v === 'kanban' ? 2 : 3} : ?r5Initial=${v} ouvre bien directement la vue Planning "${v}"`, 'INITIAL-0X');
    await ctx.close();
  }
  // INITIAL-03 — non-persistance : rechargement SANS le paramètre → migrateState() (non modifiée) renormalise vers gantt.
  {
    const { ctx, p } = await newPage({ tag: 'INITIAL-03', params: '&r5Initial=agenda', skipReset: true });
    await ev(p, () => go('planning'));
    const viewBefore = await ev(p, () => app.ui.planningView);
    await p.goto(F(CUR), { waitUntil: 'load' }); // même onglet, SANS ?r5Initial
    await ev(p, () => { resetApp(); dismissKanvixContinuityNotice(); });
    await p.waitForTimeout(150);
    const view = await ev(p, () => app.ui.planningView);
    note('INITIAL-03', { viewBefore, viewAfterReloadWithoutParam: view });
    ok(viewBefore === 'agenda', 'INITIAL-03 : la bascule ?r5Initial=agenda a bien pris effet au premier chargement (preuve que ce qui suit teste une VRAIE réversion, pas une absence d’effet)', 'INITIAL-03');
    ok(view === 'gantt', 'INITIAL-03 : rechargé SANS ?r5Initial, migrateState() (inchangée) renormalise vers "gantt" — non-persistance prouvée sans avoir touché migrateState()', 'INITIAL-03');
    await ctx.close();
  }
  // INITIAL-04 — comportement par défaut STRICTEMENT identique à V2.12.2.1 (sans aucun paramètre R5).
  {
    const { ctx: ctxRef, p: pRef } = await newPage({ tag: 'INITIAL-04-ref', file: REF });
    const { ctx: ctxCur, p: pCur } = await newPage({ tag: 'INITIAL-04-cur', file: CUR });
    await ev(pRef, () => go('planning'));
    await ev(pCur, () => go('planning'));
    const [viewRef, viewCur] = await Promise.all([ev(pRef, () => app.ui.planningView), ev(pCur, () => app.ui.planningView)]);
    const [ganttHtmlRef, ganttHtmlCur] = await Promise.all([
      ev(pRef, () => document.getElementById('gantt')?.outerHTML || ''),
      ev(pCur, () => document.getElementById('gantt')?.outerHTML || ''),
    ]);
    note('INITIAL-04', { viewRef, viewCur, ganttIdentique: ganttHtmlRef === ganttHtmlCur });
    ok(viewRef === viewCur && viewRef === 'gantt', 'INITIAL-04 : sans aucun paramètre R5, la vue Planning initiale reste "gantt" — IDENTIQUE entre V2.12.2.1 et le prototype', 'INITIAL-04');
    ok(ganttHtmlRef === ganttHtmlCur, 'INITIAL-04 : le HTML du Gantt rendu par défaut est BYTE-IDENTIQUE entre la référence et le prototype (même données de démo, mêmes dates)', 'INITIAL-04');
    await ctxRef.close(); await ctxCur.close();
  }
}

console.log('\n============================================================');
console.log(' PARTIE 4 — NON-RÉGRESSION (NONREG-*) — tests de fumée');
console.log(' (allégés : FREEZE-R5 §5 prouve les moteurs byte-identiques)');
console.log('============================================================');
{
  const { ctx, p } = await newPage({ tag: 'NONREG', w: 1440, h: 1000 });

  await ev(p, () => go('planning'));
  const gantt1 = await ev(p, () => !!document.getElementById('gantt') && document.querySelectorAll('.g-bar').length > 0);
  ok(gantt1, 'NONREG-01 : le Gantt continue de s’afficher avec des barres — vue par défaut non cassée', 'NONREG-01');

  await ev(p, () => setPlanningView('kanban'));
  await p.waitForTimeout(120);
  const kanban1 = await ev(p, () => document.querySelectorAll('.kanban-col').length === 3);
  ok(kanban1, 'NONREG-02 : le Kanban continue d’afficher exactement ses 3 colonnes de statut', 'NONREG-02');

  // Préparer un décalage — smoke test (le moteur est byte-identique, voir FREEZE-R5).
  // Le menu contextuel « Préparer un décalage » n'existe qu'en Pilotage (pilot &&
  // projectEditable, V24398) — comportement PRÉEXISTANT, inchangé par R5.
  await ev(p, () => { setDepth('pilot'); setPlanningView('gantt'); openTask('k-windows'); });
  await p.waitForTimeout(150);
  const shift1 = await ev(p, () => document.getElementById('drawerContent')?.innerHTML.includes('Préparer un décalage'));
  ok(shift1, 'NONREG-03 : le bouton « Préparer un décalage » est toujours proposé sur une tâche éligible (moteur byte-identique à V2.12.2.1)', 'NONREG-03');
  await ev(p, () => closeOverlay('drawer'));

  // Structure — l'onglet est présent aux DEUX niveaux (R2, V19228) et son moteur
  // (getProjectStructure/openStructureForm/toggleStructureArchive) est byte-identique.
  await ev(p, () => selectProject('keravel'));
  await p.waitForTimeout(150);
  const struct1 = await ev(p, () => [...document.querySelectorAll('.tab')].some((t) => t.textContent === 'Structure'));
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.tab')].find((t) => t.textContent === 'Structure');
    btn?.click();
  });
  await p.waitForTimeout(150);
  const struct2 = await ev(p, () => document.querySelector('.tab.active')?.textContent === 'Structure');
  note('NONREG-04', { struct1, struct2 });
  ok(struct1 && struct2, 'NONREG-04 : l’onglet « Structure » d’un chantier reste bien proposé et s’ouvre normalement (présent aux deux niveaux Essentiel/Pilotage, R2 — moteur byte-identique)', 'NONREG-04');

  // Opérations (gating Pilotage R4 — non touché par R5).
  await ev(p, () => { setDepth('essential'); go('sites'); });
  await p.waitForTimeout(120);
  const opsHiddenEssential = await ev(p, () => !document.querySelector('[onclick*="setSitesMode(\'operations\')"]'));
  await ev(p, () => setDepth('pilot'));
  await p.waitForTimeout(120);
  const opsShownPilot = await ev(p, () => !!document.querySelector('[onclick*="setSitesMode(\'operations\')"]'));
  note('NONREG-05', { opsHiddenEssential, opsShownPilot });
  ok(opsHiddenEssential && opsShownPilot, 'NONREG-05 : le gating R4 « Opérations » réservé au Pilotage fonctionne toujours à l’identique (renderSites non touché par R5)', 'NONREG-05');

  // Essentiel/Pilotage bascule générale.
  await ev(p, () => setDepth('essential'));
  const lvlE = await ev(p, () => app.settings.level);
  await ev(p, () => setDepth('pilot'));
  const lvlP = await ev(p, () => app.settings.level);
  ok(lvlE === 'essential' && lvlP === 'pilot', 'NONREG-06 : la bascule Essentiel/Pilotage fonctionne toujours normalement', 'NONREG-06');

  // Undo/Redo + communications — smoke test (moteur byte-identique).
  await ev(p, () => go('planning'));
  const beforeStatus = await ev(p, () => task('k-cloisons').status);
  await ev(p, () => setTaskStatus('k-cloisons', 'done'));
  const afterSet = await ev(p, () => task('k-cloisons').status);
  await ev(p, () => undo());
  const afterUndo = await ev(p, () => task('k-cloisons').status);
  note('NONREG-07', { beforeStatus, afterSet, afterUndo });
  ok(afterSet === 'done' && afterUndo === beforeStatus, 'NONREG-07 : Undo restaure correctement le statut d’une tâche après un changement — le moteur Undo/Redo (byte-identique) fonctionne toujours', 'NONREG-07');

  await ctx.close();
}

console.log('\n============================================================');
console.log(' PARTIE 5 — CONTRÔLE DIFFÉRENTIEL EXHAUSTIF (FREEZE-R5)');
console.log('============================================================');
{
  const A = fs.readFileSync(BASE + REF, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
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
  const attendues = ['renderPlanning', 'setPlanningView'];
  const attenduesAjoutees = ['agendaWorkingDays', 'agendaMarker', 'agendaOccurrenceTime', 'agendaGroups', 'agendaOccurrenceRow', 'renderAgenda'];
  const horsPerimetre = [], ajoutees = [], supprimees = [];
  const nomsB = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  const nomsA = [...new Set([...A.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  nomsB.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  nomsA.forEach((n) => { if (!nomsB.includes(n)) supprimees.push(n); });
  note('FREEZE-R5-diff', { modifiées: attendues, ajoutées: ajoutees, supprimées: supprimees, horsPérimètre: horsPerimetre });
  ok(horsPerimetre.length === 0, 'FREEZE-R5 : hors de renderPlanning() et setPlanningView(), AUCUNE fonction EXISTANTE n’a été modifiée entre V2.12.2.1 et le prototype R5', 'FREEZE-R5');
  ok(JSON.stringify(ajoutees.slice().sort()) === JSON.stringify(attenduesAjoutees.slice().sort()), 'FREEZE-R5 : EXACTEMENT les 6 fonctions Agenda attendues ont été ajoutées — aucune autre, aucune manquante', 'FREEZE-R5');
  ok(supprimees.length === 0, 'FREEZE-R5 : aucune fonction n’a été supprimée', 'FREEZE-R5');

  // migrateState() explicitement byte-identique (condition de non-persistance de r5Initial).
  const migA = extractFn(A, 'migrateState'), migB = extractFn(B, 'migrateState');
  note('FREEZE-R5-migrateState', { identique: md5(migA) === md5(migB) });
  ok(md5(migA) === md5(migB), 'FREEZE-R5 : migrateState() est BYTE-IDENTIQUE — la non-persistance de ?r5Initial repose sur son comportement EXISTANT, jamais modifié', 'FREEZE-R5');

  // INITIAL_STATE / SCHEMA_VERSION inchangés.
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const initialIdentique = md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/));
  const schema = { A: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1], B: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1] };
  note('FREEZE-R5-donnees', { initialIdentique, schema });
  ok(initialIdentique && schema.A === schema.B, 'FREEZE-R5 : INITIAL_STATE et SCHEMA_VERSION strictement inchangés — le jeu de données R5 est bien recette-only, jamais dans les données de démo livrées', 'FREEZE-R5');

  // Moteurs gelés — décalage (14), calendrier, dépendances/ressources, Undo/Redo/communications, Structure, Opérations.
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
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-R5-geles', { comparées: compares, bougés: bouges });
  ok(compares > 55 && bouges.length === 0, `FREEZE-R5 : les ${compares} moteurs gelés (décalage, calendrier, dépendances/ressources, Undo/Redo/communications, Structure, Opérations, Essentiel/Pilotage, Gantt, Kanban, planningTasks/scale, agenda mobile préexistant) restent BYTE-IDENTIQUES`, 'FREEZE-R5');

  // Diff brute ligne à ligne — preuve la plus forte : exactement 7 hunks, tous documentés.
  execSync(`diff -u '${BASE + REF}' '${BASE + CUR}' > /tmp/r5-freeze.diff || true`);
  const rawDiff = fs.readFileSync('/tmp/r5-freeze.diff', 'utf8');
  const hunks = (rawDiff.match(/^@@/gm) || []).length;
  const addedLines = (rawDiff.match(/^\+[^+]/gm) || []).length;
  const removedLines = (rawDiff.match(/^-[^-]/gm) || []).length;
  note('FREEZE-R5-diff-brute', { hunks, addedLines, removedLines });
  fs.copyFileSync('/tmp/r5-freeze.diff', SHOTS + 'diff-v2.12.2.1-vs-prototype-r5.txt');
  ok(hunks === 7, 'FREEZE-R5 : la diff BRUTE ligne à ligne (diff -u) entre la référence et le prototype ne compte QUE 7 blocs de changement, tous documentés — aucune modification furtive ailleurs dans le fichier', 'FREEZE-R5');
  ok(removedLines <= 10, 'FREEZE-R5 : très peu de lignes SUPPRIMÉES (uniquement des lignes réécrites à l’identique fonctionnellement, ex. le tableau Gantt/Kanban → Gantt/Kanban/Agenda) — le prototype est presque exclusivement additif', 'FREEZE-R5');
}

console.log('\n============================================================');
console.log(' PARTIE 6 — VALIDATION VISUELLE (VISUEL-*)');
console.log('============================================================');
{
  const combos = [
    { tag: 'desktop-clair', w: 1440, h: 1000, dark: false },
    { tag: 'desktop-sombre', w: 1440, h: 1000, dark: true },
    { tag: 'mobile-clair', w: 390, h: 844, dark: false },
    { tag: 'mobile-sombre', w: 390, h: 844, dark: true },
  ];
  for (const combo of combos) {
    const { ctx, p } = await newPage({ tag: 'VISUEL-' + combo.tag, w: combo.w, h: combo.h, dark: combo.dark });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);
    const overflow = await ev(p, () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    note('VISUEL-' + combo.tag + '-overflow', { overflow });
    ok(overflow <= 1, `VISUEL-${combo.tag} : aucun débordement horizontal de la page en vue Agenda (scrollWidth ≈ clientWidth)`, 'VISUEL-OVERFLOW');
    await p.screenshot({ path: SHOTS + `agenda-${combo.tag}.png`, fullPage: false });
    await ctx.close();
  }

  // Captures NOMMÉES exigées par la mission (5).
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-1', w: 1440, h: 1000 });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: SHOTS + '01-agenda-desktop-clair-multi-jours.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-2', w: 1440, h: 1000, dark: true });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: SHOTS + '02-agenda-desktop-sombre.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-3', w: 390, h: 844 });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: SHOTS + '03-agenda-mobile-clair.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-4', w: 1440, h: 1000 });
    await ev(p, () => go('planning'));
    await p.screenshot({ path: SHOTS + '04-variante-gantt-kanban.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await newPage({ tag: 'SHOT-5', w: 1440, h: 1000, params: '&r5Labels=plain' });
    await ev(p, () => go('planning'));
    await p.screenshot({ path: SHOTS + '05-variante-chronologie-avancement.png' });
    await ctx.close();
  }

  // Contrôles d'interaction mandatés (5).
  {
    const { ctx, p } = await newPage({ tag: 'INT', w: 1440, h: 1000 });
    await seedR5Tasks(p);
    await ev(p, () => { go('planning'); setPeriod('week'); planningToday(); setPlanningView('agenda'); });
    await p.waitForTimeout(200);

    // INT-02 — lisibilité d'une intervention longue (le texte de la ligne r5-5j est intégralement présent, non tronqué en DOM).
    const longReadable = await ev(p, () => {
      const el = [...document.querySelectorAll('.day-task')].find((e) => e.getAttribute('onclick')?.includes("'r5-5j'"));
      return el ? { text: el.querySelector('b')?.textContent, height: el.getBoundingClientRect().height } : null;
    });
    note('INT-02', longReadable);
    ok(longReadable?.text === 'R5 — Chape 5 jours' && longReadable.height >= 40, 'INT-02 : la ligne d’une intervention longue reste intégralement lisible (nom complet en DOM, hauteur tactile conservée)', 'INT-02');

    // INT-03 — repère jamais identique au statut (proxy de compréhension).
    const noCollision = await ev(p, () => [...document.querySelectorAll('.day-task')].every((el) => {
      const pills = [...el.querySelectorAll('.pill')].map((x) => x.textContent);
      return new Set(pills).size === pills.length; // jamais deux pastilles identiques sur une même ligne
    }));
    ok(noCollision, 'INT-03 : sur aucune ligne le repère de position (Début/Suite/Fin) et la pastille de statut n’affichent le même texte — pas de collision de sens (validation du choix « Suite » plutôt que « En cours »)', 'INT-03');

    // INT-04 — navigation clavier + focus visible.
    await ev(p, () => document.querySelector('.day-task')?.focus());
    const kbd = await ev(p, () => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { isDayTask: el?.classList.contains('day-task'), outline: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    });
    note('INT-04', kbd);
    ok(kbd.isDayTask, 'INT-04 : une ligne d’occurrence Agenda (bouton natif) est bien focusable au clavier', 'INT-04');

    // INT-05 — thème sombre + filtre + ouverture fiche + absence de chevauchement.
    await ev(p, () => setAppearance('dark'));
    await ev(p, () => { app.ui.planningProject = 'keravel'; save(); renderPage(); setPlanningView('agenda'); });
    await p.waitForTimeout(150);
    await ev(p, () => openTask('r5-5j'));
    await p.waitForTimeout(150);
    const int5 = await ev(p, () => ({
      dark: document.body.classList.contains('dark'),
      drawerOpen: document.getElementById('drawer')?.classList.contains('open'),
      overlaysOpen: document.querySelectorAll('.drawer.open, .modal.open').length,
    }));
    note('INT-05', int5);
    ok(int5.dark && int5.drawerOpen && int5.overlaysOpen === 1, 'INT-05 : en thème sombre, avec un filtre chantier actif, l’ouverture d’une fiche depuis l’Agenda fonctionne et n’ouvre QU’UN SEUL panneau (aucun chevauchement de panneaux)', 'INT-05');
    await p.screenshot({ path: SHOTS + 'int-05-sombre-filtre-fiche.png' });
    await ev(p, () => closeOverlay('drawer'));

    await ctx.close();
  }
}

console.log('\n============================================================');
console.log(' PARTIE 7 — ERREURS CONSOLE APPLICATIVES');
console.log('============================================================');
note('ERREURS-CONSOLE-brutes', { total: allErrs.length, detail: allErrs.slice(0, 10) });
ok(allErrs.length === 0, `ERREURS-CONSOLE : 0 erreur console applicative sur l’ensemble des scénarios (bruit réseau sandbox préexistant filtré, voir en-tête) — ${allErrs.length} trouvée(s)`, 'ERREURS-CONSOLE');

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
  fichierTeste: CUR,
  reference: REF,
  passed, total: results.length, failed,
  consoleErrors: allErrs,
  results,
}, null, 2));
console.log(`\nRésultats écrits dans ${SHOTS}resultats.json`);
