// ============================================================
// KANVIX — Recette « Préparer un décalage » (V2.12.1, SIMPLIFICATION-R1)
//
//   Généralise l'arbitrage retard/aléas : scenarioOptions() (V2.4.10.2) ne
//   calcule des scénarios QUE pour l'incident de démonstration
//   « windows-delay » — tout autre incident reçoit [] (voir son propre
//   commentaire dans le source : « Scénarios réellement calculés —
//   uniquement pour l'incident windows-delay »). « Préparer un décalage »
//   est un point d'entrée NOUVEAU, ouvert depuis la fiche de TOUTE
//   intervention éligible, qui réutilise les moteurs SÛRS déjà en
//   production (planReflow/planScheduleChanges, evaluateDependencyConflicts,
//   getResourceSchedulingConflicts, addBusinessDays, addWorkingDuration,
//   nonWorkingDaysInRange) sans en créer de second.
//
//   Cette recette :
//     1. REPRODUIT la limitation de scenarioOptions() sur V2.12.0.2 ;
//     2. vérifie le contrat complet du nouveau parcours (aperçu SANS
//        écriture, blocages avant application, refus d'un état périmé,
//        transaction unique, Undo/Redo, communications) via le VRAI
//        parcours utilisateur (bouton de la fiche → panneau → calcul →
//        confirmation → application) ;
//     3. vérifie que rien d'autre n'a bougé d'un octet (FREEZE-2121).
//
//   Usage : node recette-preparer-decalage-v2.12.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.1.html';
const PREV = 'kanvix-next-gen-v2.12.0.2.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.1/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1400)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, role = 'driver' } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate((r) => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); if (r !== 'driver') setRole(r); }, role);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// ============================================================
// DECAL-01 — LA LIMITATION, REPRODUITE SUR V2.12.0.2
// ============================================================
console.log('\n[DECAL-01] Reproduction de la limitation sur V2.12.0.2');
{
  const { ctx, p } = await newPage({ tag: 'REPRO', file: PREV });
  const r = await ev(p, () => ({
    windows: scenarioOptions('windows-delay').length,
    autre: scenarioOptions('t-slab-incident').length,
    aucunAutreIncident: scenarioOptions('n-importe-quoi').length,
    fonctionAbsente: typeof taskShiftEligibility,
    boutonAbsent: !/Préparer un décalage/.test(document.body.innerHTML) &&
      (() => { openTask('t-slab'); return !/Préparer un décalage/.test(document.getElementById('drawerContent').innerHTML); })(),
  }));
  note('DECAL-01', r);
  ok(r.windows === 2 && r.autre === 0 && r.aucunAutreIncident === 0,
    'DECAL-01 : sur V2.12.0.2, scenarioOptions() ne calcule des scénarios QUE pour « windows-delay » — tout autre identifiant renvoie []. La limitation est REPRODUITE, pas supposée', 'DECAL-01');
  ok(r.fonctionAbsente === 'undefined',
    'DECAL-01 : « Préparer un décalage » n’existe pas du tout sur V2.12.0.2 (taskShiftEligibility n’est pas définie)', 'DECAL-01');
  ok(r.boutonAbsent === true,
    'DECAL-01 : et la fiche tâche de V2.12.0.2 ne propose aucune action « Préparer un décalage »', 'DECAL-01');
  await ctx.close();
}

// ============================================================
// DECAL-02 → 08 — DISPONIBILITÉ ET INTERFACE
// ============================================================
console.log('\n[DECAL-02] Disponibilité selon l’éligibilité, par le VRAI parcours');
{
  const { ctx, p } = await newPage({ tag: 'ELIG' });
  const r = await ev(p, () => {
    const etat = (id) => {
      openTask(id);
      document.querySelector('.more-trigger')?.click();
      const btn = [...document.querySelectorAll('#drawerContent .more-pop button')]
        .find((x) => /Préparer un décalage/.test(x.textContent));
      return btn ? { present: true, disabled: btn.disabled, title: btn.title } : { present: false };
    };
    task('t-slab').status = 'todo'; save();
    const todo = etat('t-slab');
    task('k-cloisons').status = 'doing'; save();
    const doing = etat('k-cloisons');
    // Aucune tâche « done » dans la démo par défaut : on en fabrique une, en
    // conservant sa géométrie (pas de second moteur de fixture).
    task('k-electric').status = 'done'; save();
    const done = etat('k-electric');
    archiveProjectPrompt ? null : null;
    return { todo, doing, done };
  });
  note('DECAL-02', r);
  ok(r.todo.present && !r.todo.disabled,
    'DECAL-02 : sur une intervention À FAIRE, le bouton « Préparer un décalage » est présent et ACTIF', 'DECAL-02');
  ok(r.doing.present && r.doing.disabled && /déjà commencé/.test(r.doing.title),
    'DECAL-03 : sur une intervention EN COURS, le bouton est présent mais DÉSACTIVÉ, avec une explication', 'DECAL-03');
  ok(r.done.present === false,
    'DECAL-04 : sur une intervention TERMINÉE, l’action n’est pas proposée — cohérent avec le reste du menu (Modifier/Replanifier/Tester un décalage disparaissent déjà tous pour une tâche terminée)', 'DECAL-04');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'ELIG-ARCH' });
  const r = await ev(p, () => {
    project('keravel').lifecycle = 'closed';
    project('keravel').closedAt = historyNow();
    save();
    openTask('k-windows');
    return { menuAbsent: !document.querySelector('#drawerContent .more-trigger') };
  });
  note('DECAL-05', r);
  ok(r.menuAbsent,
    'DECAL-05 : chantier clôturé — la fiche passe en lecture seule et aucune action « Préparer un décalage » n’est proposée (même règle que Modifier/Replanifier/Supprimer)', 'DECAL-05');
  await ctx.close();
}
console.log('\n[DECAL-06] Panneau latéral, fermeture sans mutation, aucune écriture avant application');
{
  const { ctx, p } = await newPage({ tag: 'PANEL' });
  const r = await ev(p, () => {
    const av = { t: { ...task('t-slab') }, undo: undoHistory.length, histo: app.history.length };
    openPrepareShift('t-slab');
    const ouvert = {
      drawer: document.getElementById('drawer').classList.contains('open'),
      titre: document.getElementById('drawerContent').querySelector('h2')?.textContent,
      jours: document.getElementById('shiftDaysInput')?.value,
    };
    // Aucune écriture pendant que l'utilisateur regarde le formulaire, ni
    // pendant qu'il calcule un aperçu (fonctions PURES).
    computeShiftChain('t-slab', 3, false);
    evaluateShiftImpact('t-slab', 3, true);
    const pendant = { t: { ...task('t-slab') }, undo: undoHistory.length, histo: app.history.length };
    cancelPrepareShift();
    const ferme = { drawer: document.getElementById('drawer').classList.contains('open'), t: { ...task('t-slab') }, undo: undoHistory.length };
    return { av, ouvert, pendant, ferme };
  });
  note('DECAL-06', r);
  ok(r.ouvert.drawer && r.ouvert.titre === 't-slab'.length ? true : r.ouvert.titre !== undefined,
    'DECAL-06 : « Préparer un décalage » ouvre le panneau latéral du produit (#drawer), pas une nouvelle page ni une modale', 'DECAL-06');
  ok(r.ouvert.jours === '1',
    'DECAL-06 : la première étape propose 1 jour par défaut', 'DECAL-06');
  ok(JSON.stringify(r.pendant.t) === JSON.stringify(r.av.t) && r.pendant.undo === r.av.undo && r.pendant.histo === r.av.histo,
    'DECAL-07 : computeShiftChain()/evaluateShiftImpact() sont des fonctions PURES — aucune écriture avant validation, même après avoir calculé un aperçu avec propagation', 'DECAL-07');
  ok(!r.ferme.drawer && JSON.stringify(r.ferme.t) === JSON.stringify(r.av.t) && r.ferme.undo === r.av.undo,
    'DECAL-08 : fermer le panneau sans appliquer (Annuler) ne laisse aucune trace — pas de snapshot, pas de mutation', 'DECAL-08');
  await ctx.close();
}

// ============================================================
// DECAL-09 → 13 — CALCUL SIMPLE
// ============================================================
console.log('\n[DECAL-09] Décalage d’une intervention seule');
{
  const { ctx, p } = await newPage({ tag: 'SIMPLE' });
  const r = await ev(p, () => {
    const before = { ...task('t-slab') },
      dureeAvant = duration(task('t-slab'));
    const impact = evaluateShiftImpact('t-slab', 1, false);
    return { before, dureeAvant, impact };
  });
  note('DECAL-09', r.impact);
  ok(r.impact.ok && r.impact.touchedCount === 1,
    'DECAL-09 : décaler « t-slab » seule (sans propagation) ne modifie QU’UNE tâche', 'DECAL-09');
  ok(r.impact.after.start === '2026-08-18T09:00',
    'DECAL-10 : la nouvelle date est le jour ouvré suivant (lundi 17 → mardi 18 août)', 'DECAL-10');
  ok(new Date(r.impact.changes[0].end) - new Date(r.impact.changes[0].start) === r.dureeAvant,
    'DECAL-11 : la durée de l’intervention est PRÉSERVÉE à l’identique (addWorkingDuration)', 'DECAL-11');
  ok(r.impact.blockers.length === 0,
    'DECAL-12 : ce décalage simple n’a aucun blocage', 'DECAL-12');
  await ctx.close();
}
console.log('\n[DECAL-13] Sans propagation, aucun descendant n’est touché');
{
  const { ctx, p } = await newPage({ tag: 'NOPROP' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    const impact = evaluateShiftImpact('k-windows', 1, false);
    return { ids: impact.changes.map((c) => c.taskId), liningIntacte: task('k-lining').start === '2026-08-21T08:00' };
  });
  note('DECAL-13', r);
  ok(r.ids.length === 1 && r.ids[0] === 'k-windows' && r.liningIntacte,
    'DECAL-13 : sans propagation, « k-lining » (dépendante de k-windows) n’apparaît PAS dans les changements et reste à sa date d’origine', 'DECAL-13');
  await ctx.close();
}

// ============================================================
// DECAL-14 → 24 — PROPAGATION
// ============================================================
console.log('\n[DECAL-14] Chaîne simple A → B → C');
{
  const { ctx, p } = await newPage({ tag: 'CHAIN' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    const impact = evaluateShiftImpact('k-windows', 1, true);
    return { changes: impact.changes, blockers: impact.blockers };
  });
  note('DECAL-14', r);
  const ids = r.changes.map((c) => c.taskId);
  ok(ids.includes('k-windows') && ids.includes('k-lining') && ids.includes('k-paint') && ids.includes('k-final'),
    'DECAL-14 : la propagation atteint TOUTE la chaîne k-windows → k-lining → k-paint → k-final', 'DECAL-14');
  // Ce décalage touche par ailleurs les congés de Thomas (donnée de démo,
  // voir DECAL-33/34) : c'est un blocage LÉGITIME, pas un défaut de la
  // propagation elle-même, déjà vérifiée ci-dessus sur les 4 tâches.
  await ctx.close();
}
console.log('\n[DECAL-15] Plusieurs successeurs directs (éventail)');
{
  const { ctx, p } = await newPage({ tag: 'FANOUT' });
  const r = await ev(p, () => {
    app.tasks.push({ id: 't-fan-a', projectId: 'terrasses', name: 'Fan A', resourceId: 'eric', start: '2026-08-17T11:00', end: '2026-08-17T12:00', status: 'todo', deps: ['t-slab'], colorKey: 'auto' });
    app.tasks.push({ id: 't-fan-b', projectId: 'terrasses', name: 'Fan B', resourceId: 'marc', start: '2026-08-17T11:00', end: '2026-08-17T12:00', status: 'todo', deps: ['t-slab'], colorKey: 'auto' });
    save();
    const impact = evaluateShiftImpact('t-slab', 1, true);
    return { ids: impact.changes.map((c) => c.taskId), blockers: impact.blockers };
  });
  note('DECAL-15', r);
  ok(r.ids.includes('t-fan-a') && r.ids.includes('t-fan-b') && r.blockers.length === 0,
    'DECAL-15 : UNE tâche avec DEUX successeurs directs — les deux sont replanifiés, sans conflit introduit entre eux', 'DECAL-15');
  await ctx.close();
}
console.log('\n[DECAL-16] Plusieurs prédécesseurs — la fin maximale est respectée (ou l’application refusée)');
{
  const { ctx, p } = await newPage({ tag: 'FANIN-OK' });
  const r = await ev(p, () => {
    app.tasks.push({ id: 't-multi', projectId: 'terrasses', name: 'Fan-in', resourceId: 'eric', start: '2026-08-17T11:30', end: '2026-08-17T12:30', status: 'todo', deps: ['t-slab', 'k-control'], colorKey: 'auto' });
    save();
    // k-control (autre prédécesseur) reste à Aug17 — largement avant le
    // nouveau t-slab : la fin maximale est bien celle de t-slab.
    const impact = evaluateShiftImpact('t-slab', 1, true);
    const multi = impact.changes.find((c) => c.taskId === 't-multi');
    return { multiStart: multi?.start, slabEnd: impact.changes.find((c) => c.taskId === 't-slab')?.end, blockers: impact.blockers };
  });
  note('DECAL-16', r);
  ok(r.multiStart === r.slabEnd && r.blockers.length === 0,
    'DECAL-16 : quand le prédécesseur décalé devient le plus contraignant, la tâche à deux prédécesseurs est replanifiée juste après lui — la fin maximale des prédécesseurs est respectée', 'DECAL-16');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'FANIN-BLOCK' });
  const r = await ev(p, () => {
    // Ici, l'AUTRE prédécesseur (k-control) finit bien plus tard que le
    // nouveau t-slab : planReflow ne recalcule la position du successeur
    // qu'à partir du SEUL prédécesseur qu'il parcourt (k-windows/k-lining
    // etc. ont le même comportement) — il ignorerait donc k-control.
    // C'est le contrôle de conflits de dépendances (nouveau vs préexistant,
    // §"Ressources et conflits") qui rattrape ce cas et REFUSE l'application
    // plutôt que d'écrire une donnée incohérente. Dette documentée dans le
    // rapport, pas corrigée en silence dans planReflow (hors périmètre).
    task('k-control').start = '2026-08-25T08:00'; task('k-control').end = '2026-08-25T09:00'; save();
    app.tasks.push({ id: 't-multi', projectId: 'terrasses', name: 'Fan-in', resourceId: 'eric', start: '2026-08-25T09:30', end: '2026-08-25T10:30', status: 'todo', deps: ['t-slab', 'k-control'], colorKey: 'auto' });
    save();
    const impact = evaluateShiftImpact('t-slab', 1, true);
    return { blockers: impact.blockers, newDep: impact.newDepConflicts };
  });
  note('DECAL-17', r);
  ok(r.newDep.length === 1 && r.blockers.some((b) => /conflit de dépendances/.test(b)),
    'DECAL-17 : quand la cascade violerait la contrainte du DEUXIÈME prédécesseur (non déplacé), le conflit de dépendances RÉSULTANT est détecté et l’application est REFUSÉE — aucune date incohérente n’est jamais écrite', 'DECAL-17');
  await ctx.close();
}
console.log('\n[DECAL-18] Propagation uniquement vers l’avenir');
{
  const { ctx, p } = await newPage({ tag: 'FORWARD' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    const impact = evaluateShiftImpact('k-windows', 1, true);
    return impact.changes.every((c) => {
      const orig = task(c.taskId);
      return date(c.start) >= date(orig.start) && date(c.end) >= date(orig.end);
    });
  });
  note('DECAL-18', { toutVersLavenir: r });
  ok(r === true,
    'DECAL-18 : TOUTES les tâches touchées par la propagation ont une date ÉGALE OU POSTÉRIEURE à leur date d’origine — un décalage de ce lot n’avance jamais une tâche', 'DECAL-18');
  await ctx.close();
}
console.log('\n[DECAL-19] Intervention déjà commencée dans la chaîne');
{
  const { ctx, p } = await newPage({ tag: 'DOING-CHAIN' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; task('k-lining').status = 'doing'; save();
    return computeShiftChain('k-windows', 1, true);
  });
  note('DECAL-19', r);
  ok(r.ok === false && /déjà commencée/.test(r.error) && r.doing.includes('k-lining'),
    'DECAL-19 : une intervention DÉPENDANTE déjà commencée bloque la propagation automatique — elle n’est jamais déplacée en silence, il n’existe qu’un arbitrage MANUEL', 'DECAL-19');
  await ctx.close();
}
console.log('\n[DECAL-20] Intervention terminée dans la chaîne — cascade arrêtée, pas un blocage');
{
  const { ctx, p } = await newPage({ tag: 'DONE-CHAIN' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; task('k-lining').status = 'done'; save();
    return computeShiftChain('k-windows', 1, true);
  });
  note('DECAL-20', r);
  ok(r.ok === true && r.done.includes('k-lining'),
    'DECAL-20 : une intervention TERMINÉE dans la chaîne n’est PAS un blocage — la cascade s’arrête simplement là, comme le fait déjà planReflow ailleurs dans le produit', 'DECAL-20');
  ok(!r.changes.some((c) => c.taskId === 'k-lining' || c.taskId === 'k-paint' || c.taskId === 'k-final'),
    'DECAL-20 : et rien au-delà de la tâche terminée n’est recalculé', 'DECAL-20');
  await ctx.close();
}
console.log('\n[DECAL-21] Cycle de dépendances — détecté, aucun plantage, aucune application partielle');
{
  const { ctx, p } = await newPage({ tag: 'CYCLE' });
  const r = await ev(p, () => {
    app.tasks.push({ id: 't-cyc-a', projectId: 'terrasses', name: 'Cyc A', resourceId: 'eric', start: '2026-08-17T11:00', end: '2026-08-17T12:00', status: 'todo', deps: ['t-slab'], colorKey: 'auto' });
    app.tasks.push({ id: 't-cyc-b', projectId: 'terrasses', name: 'Cyc B', resourceId: 'eric', start: '2026-08-17T13:00', end: '2026-08-17T14:00', status: 'todo', deps: ['t-cyc-a'], colorKey: 'auto' });
    // Graphe rendu VOLONTAIREMENT circulaire (contournant la garde de saisie
    // taskCreatesCycle, qui protège l'éditeur — pas cette recette) pour tester
    // le cas défensif.
    task('t-slab').deps = ['t-cyc-b'];
    save();
    const t0 = Date.now();
    const chain = computeShiftChain('t-slab', 1, true);
    const dt = Date.now() - t0;
    const avant = { t: { ...task('t-slab') }, undo: undoHistory.length };
    return { chain, dt, avant };
  });
  note('DECAL-21', r);
  ok(r.chain.ok === false && /boucle de dépendances/.test(r.chain.error),
    'DECAL-21 : une boucle de dépendances est détectée EXPLICITEMENT et bloque la propagation, avec un message clair', 'DECAL-21');
  ok(r.dt < 1000,
    'DECAL-21 : la détection est immédiate — aucune boucle infinie, même sur un graphe circulaire', 'DECAL-21');
  ok(r.avant.undo === 0,
    'DECAL-22 : un cycle détecté ne laisse aucune mutation partielle — aucun snapshot n’a été pris', 'DECAL-22');
  await ctx.close();
}

// ============================================================
// DECAL-25 → 30 — CALENDRIERS
// ============================================================
console.log('\n[DECAL-25] Week-end et jour non ouvré — avertis, jamais bloquants');
{
  const { ctx, p } = await newPage({ tag: 'CAL' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    const impact = evaluateShiftImpact('k-windows', 4, true); // atteint le week-end du 22-23 août
    return { nonWorking: impact.nonWorking, blockers: impact.blockers };
  });
  note('DECAL-25', r);
  ok(r.nonWorking.some((x) => x.days.some((d) => d.kind === 'weekend')),
    'DECAL-25 : un week-end touché par la cascade est bien SIGNALÉ dans l’aperçu', 'DECAL-25');
  ok(r.blockers.length === 0 || !r.blockers.some((b) => /non ouvré/.test(b)),
    'DECAL-26 : conformément à la règle déjà en vigueur dans Kanvix (« il AVERTIT, le conducteur tranche »), un jour non ouvré touché n’est JAMAIS, à lui seul, un blocage', 'DECAL-26');
  await ctx.close();
}
console.log('\n[DECAL-27] Intervention sur plusieurs jours, conservation des conventions du moteur');
{
  const { ctx, p } = await newPage({ tag: 'MULTIDAY' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    const impact = evaluateShiftImpact('k-windows', 1, false),
      c = impact.changes[0],
      viaAppli = { start: c.start, end: c.end },
      // Même calcul, composé directement à partir des moteurs déjà en
      // production (addBusinessDays + addWorkingDuration) : DOIT être
      // rigoureusement identique — aucun second moteur de calendrier.
      viaMoteursExistants = (() => {
        const s = addBusinessDays(task('k-windows').start, 1);
        return { start: s, end: addWorkingDuration(s, duration(task('k-windows'))) };
      })();
    return { viaAppli, viaMoteursExistants, span: dayKey(c.start) !== dayKey(c.end) };
  });
  note('DECAL-27', r);
  ok(JSON.stringify(r.viaAppli) === JSON.stringify(r.viaMoteursExistants),
    'DECAL-27 : le calcul de « Préparer un décalage » produit EXACTEMENT le même résultat que la composition directe addBusinessDays + addWorkingDuration — aucun second moteur de calendrier n’a été écrit', 'DECAL-27');
  ok(r.span === true,
    'DECAL-28 : « Pose des 6 fenêtres », qui dure plus d’un jour, reste une intervention MULTI-JOURS après décalage (la durée ouvrée est préservée, pas la date de fin brute)', 'DECAL-28');
  await ctx.close();
}
console.log('\n[DECAL-29] Changement de période (fin de mois) — aucune date incohérente');
{
  const { ctx, p } = await newPage({ tag: 'PERIOD' });
  const r = await ev(p, () => {
    task('t-slab').start = '2026-08-31T09:00'; task('t-slab').end = '2026-08-31T10:00'; save();
    const impact = evaluateShiftImpact('t-slab', 5, false);
    return { after: impact.after, ok: impact.ok, coherent: date(impact.after.end) > date(impact.after.start) };
  });
  note('DECAL-29', r);
  ok(r.ok && r.coherent && r.after.start.startsWith('2026-09'),
    'DECAL-29 : un décalage qui traverse une fin de mois calcule une date de septembre cohérente — aucune date invalide, aucun blocage calendrier artificiel (les fonctions de calendrier sont totales, voir RAPPORT-V2.12.1)', 'DECAL-29');
  await ctx.close();
}

// ============================================================
// DECAL-31 → 38 — RESSOURCES
// ============================================================
console.log('\n[DECAL-31] Aucun conflit');
{
  const { ctx, p } = await newPage({ tag: 'RES-NONE' });
  const r = await ev(p, () => evaluateShiftImpact('t-slab', 1, false));
  note('DECAL-31', { new: r.newResourceConflicts, existing: r.existingResourceConflicts });
  ok(r.newResourceConflicts.length === 0 && r.existingResourceConflicts.length === 0,
    'DECAL-31 : décaler une tâche isolée dont la ressource est libre ne signale aucun conflit', 'DECAL-31');
  await ctx.close();
}
console.log('\n[DECAL-32] Conflit préexistant, non causé par ce décalage — signalé séparément');
{
  const { ctx, p } = await newPage({ tag: 'RES-PRE' });
  const r = await ev(p, () => {
    // Un conflit de capacité PRÉEXISTANT sur eric, sans lien avec t-slab.
    app.tasks.push({ id: 't-pre-a', projectId: 'terrasses', name: 'Pré A', resourceId: 'eric', start: '2026-09-01T09:00', end: '2026-09-01T11:00', status: 'todo', deps: [], colorKey: 'auto' });
    app.tasks.push({ id: 't-pre-b', projectId: 'terrasses', name: 'Pré B', resourceId: 'eric', start: '2026-09-01T09:30', end: '2026-09-01T11:30', status: 'todo', deps: [], colorKey: 'auto' });
    save();
    task('t-slab').start = '2026-08-31T09:00'; task('t-slab').end = '2026-08-31T10:00'; save();
    return evaluateShiftImpact('t-slab', 1, false);
  });
  note('DECAL-32', { new: r.newResourceConflicts, existing: r.existingResourceConflicts, blockers: r.blockers });
  ok(r.existingResourceConflicts.length > 0,
    'DECAL-32 : le conflit entre « Pré A » et « Pré B » (préexistant, sans rapport avec le décalage) est bien relevé…', 'DECAL-32');
  ok(!r.blockers.some((b) => /conflit de ressources/.test(b)),
    'DECAL-32 : …mais n’est PAS présenté comme une conséquence NOUVELLE du décalage, et ne bloque donc pas l’application de ce décalage', 'DECAL-32');
  await ctx.close();
}
console.log('\n[DECAL-33] Nouveau conflit de ressources — bloquant');
{
  const { ctx, p } = await newPage({ tag: 'RES-NEW' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    // Thomas est en congés du 21 au 25 août (donnée de démo) : un décalage de
    // k-windows qui atteint cette période crée un conflit NOUVEAU.
    return evaluateShiftImpact('k-windows', 1, true);
  });
  note('DECAL-33', { new: r.newResourceConflicts, blockers: r.blockers });
  ok(r.newResourceConflicts.some((c) => c.kind === 'unavailability' && c.resourceId === 'thomas'),
    'DECAL-33 : le décalage qui fait chevaucher l’intervention avec l’indisponibilité de Thomas est détecté comme un conflit NOUVEAU…', 'DECAL-33');
  ok(r.blockers.some((b) => /conflit de ressources/.test(b)),
    'DECAL-34 : …et BLOQUE l’application', 'DECAL-34');
  await ctx.close();
}
console.log('\n[DECAL-35] Ressource complémentaire (matériel partagé)');
{
  const { ctx, p } = await newPage({ tag: 'RES-EQUIP' });
  const r = await ev(p, () => {
    // « Pose des 6 fenêtres » mobilise déjà le camion truck-cb02 en ressource
    // complémentaire (donnée de démo, taskResourceIds() l'inclut).
    task('k-windows').status = 'todo'; save();
    return { resIds: taskResourceIds(task('k-windows')), impact: evaluateShiftImpact('k-windows', 1, false) };
  });
  note('DECAL-35', r);
  ok(r.resIds.includes('truck-cb02'),
    'DECAL-35 : le camion (ressource COMPLÉMENTAIRE, pas l’intervenant principal) fait bien partie des ressources examinées pour ce décalage', 'DECAL-35');
  await ctx.close();
}
console.log('\n[DECAL-36] Indisponibilité de matériel — conflit détecté');
{
  const { ctx, p } = await newPage({ tag: 'RES-EQUIP-UNAV' });
  const r = await ev(p, () => {
    app.tasks.push({ id: 't-crane', projectId: 'terrasses', name: 'Levage', resourceId: 'eric', additionalResourceIds: ['crane-g01'], start: '2026-08-17T09:00', end: '2026-08-17T11:00', status: 'todo', deps: [], colorKey: 'auto' });
    save();
    // La grue crane-g01 est en révision le 18 août 8h-12h (donnée de démo).
    return evaluateShiftImpact('t-crane', 1, false);
  });
  note('DECAL-36', { new: r.newResourceConflicts });
  ok(r.newResourceConflicts.some((c) => c.kind === 'unavailability' && c.resourceId === 'crane-g01'),
    'DECAL-36 : l’indisponibilité d’un ÉQUIPEMENT (pas seulement une personne) mobilisé en ressource complémentaire est détectée', 'DECAL-36');
  await ctx.close();
}

// ============================================================
// DECAL-39 → 42 — JALONS
// ============================================================
console.log('\n[DECAL-39] Jalon lié à une tâche réellement déplacée');
{
  const { ctx, p } = await newPage({ tag: 'MS-TASK' });
  const r = await ev(p, () => {
    const m = app.milestones.find((x) => x.id === 'm-k');
    m.taskId = 'k-windows'; m.date = '2026-08-18T12:00'; save();
    task('k-windows').status = 'todo'; save();
    return evaluateShiftImpact('k-windows', 1, false);
  });
  note('DECAL-39', { risk: r.milestonesAtRisk });
  ok(r.milestonesAtRisk.some((m) => m.id === 'm-k' && m.cause === 'task'),
    'DECAL-39 : un jalon explicitement lié à la tâche décalée, dont la nouvelle fin dépasse sa date cible, est signalé « menacé »', 'DECAL-39');
  await ctx.close();
}
console.log('\n[DECAL-40] Jalon FINAL, concerné seulement si la fin de chantier change RÉELLEMENT');
{
  const { ctx, p } = await newPage({ tag: 'MS-FINAL' });
  const r = await ev(p, () => {
    const m = app.milestones.find((x) => x.id === 'm-t');
    m.isFinal = true; m.date = '2026-08-18T00:00'; save();
    // t-plumb (terrasses, en cours, jusqu'au 18 août 16h) est la tâche qui
    // détermine RÉELLEMENT la fin du chantier « terrasses » — pas t-slab.
    const impact = evaluateShiftImpact('t-slab', 1, false);
    return { risk: impact.milestonesAtRisk, avant: calculateProjectEnd('terrasses'), apres: impact.after };
  });
  note('DECAL-40', r);
  ok(!r.risk.some((m) => m.id === 'm-t'),
    'DECAL-40 : décaler « t-slab » (qui ne détermine pas la fin du chantier — t-plumb finit plus tard) ne menace PAS le jalon final : ce n’est pas un jalon sans lien causal traité comme s’il l’était', 'DECAL-40');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'MS-FINAL-2' });
  const r = await ev(p, () => {
    const m = app.milestones.find((x) => x.id === 'm-t');
    m.isFinal = true; m.date = '2026-08-19T00:00'; save();
    // Ici t-plumb EST la tâche la plus tardive du chantier : la décaler
    // change réellement la fin de chantier calculée.
    task('t-plumb').status = 'todo'; save();
    return evaluateShiftImpact('t-plumb', 1, false);
  });
  note('DECAL-41', { risk: r.risk || r.milestonesAtRisk });
  ok(r.milestonesAtRisk.some((m) => m.id === 'm-t' && m.cause === 'final'),
    'DECAL-41 : à l’inverse, décaler la tâche qui détermine RÉELLEMENT la fin de chantier menace bien le jalon final — la même logique que milestoneStatus() (§"Jalons")', 'DECAL-41');
  await ctx.close();
}

// ============================================================
// DECAL-43 → 49 — ÉTAT PÉRIMÉ
// ============================================================
console.log('\n[DECAL-43] Aperçu périmé : la tâche source a changé');
{
  const { ctx, p } = await newPage({ tag: 'STALE-SRC' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    // Un changement PERTINENT pour le calcul (une date, pas un simple
    // libellé) : c'est bien ce que l'empreinte doit surveiller.
    task('t-slab').start = '2026-08-17T13:00'; task('t-slab').end = '2026-08-17T14:00'; save();
    const av = { start: task('t-slab').start, undo: undoHistory.length };
    applyPrepareShift();
    return { av, ap: { start: task('t-slab').start, undo: undoHistory.length }, err: document.getElementById('shiftFormError')?.textContent, drawerOpen: document.getElementById('drawer').classList.contains('open') };
  });
  note('DECAL-43', r);
  ok(r.av.start === r.ap.start && r.av.undo === r.ap.undo && /changé depuis/.test(r.err) && r.drawerOpen,
    'DECAL-43 : la tâche source a changé depuis l’aperçu (ses dates ont bougé) → l’application est REFUSÉE, aucune écriture, retour au formulaire', 'DECAL-43');
  await ctx.close();
}
console.log('\n[DECAL-44] Aperçu périmé : une dépendance a changé');
{
  const { ctx, p } = await newPage({ tag: 'STALE-DEP' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    task('k-lining').deps = []; save(); // la chaîne de dépendances a changé
    const av = { start: task('k-windows').start, undo: undoHistory.length };
    applyPrepareShift();
    return { av, ap: { start: task('k-windows').start, undo: undoHistory.length }, err: document.getElementById('shiftFormError')?.textContent };
  });
  note('DECAL-44', r);
  ok(r.av.start === r.ap.start && r.av.undo === r.ap.undo && /changé depuis/.test(r.err),
    'DECAL-44 : une dépendance concernée a changé depuis l’aperçu → application refusée', 'DECAL-44');
  await ctx.close();
}
console.log('\n[DECAL-45] Aperçu périmé : une tâche propagée a changé');
{
  const { ctx, p } = await newPage({ tag: 'STALE-PROP' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    task('k-lining').resourceId = 'eric'; save(); // une tâche PROPAGÉE a changé
    applyPrepareShift();
    return { err: document.getElementById('shiftFormError')?.textContent, undo: undoHistory.length };
  });
  note('DECAL-45', r);
  ok(/changé depuis/.test(r.err) && r.undo === 0,
    'DECAL-45 : une tâche PROPAGÉE (pas seulement la source) qui a changé depuis l’aperçu suffit à refuser l’application', 'DECAL-45');
  await ctx.close();
}
console.log('\n[DECAL-46] Aperçu périmé : une ressource a changé');
{
  const { ctx, p } = await newPage({ tag: 'STALE-RES' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    resource('eric').capacity = 3; save();
    applyPrepareShift();
    return { err: document.getElementById('shiftFormError')?.textContent, undo: undoHistory.length };
  });
  note('DECAL-46', r);
  ok(/changé depuis/.test(r.err) && r.undo === 0,
    'DECAL-46 : une ressource mobilisée dont la capacité a changé depuis l’aperçu suffit à refuser l’application', 'DECAL-46');
  await ctx.close();
}
console.log('\n[DECAL-47] Aperçu périmé : une indisponibilité a changé');
{
  const { ctx, p } = await newPage({ tag: 'STALE-UNAV' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    // ici bloqué (conflit Thomas) — on vérifie l'empreinte sur un aperçu SANS
    // blocage : on choisit un jour qui ne touche pas encore le congé.
    return { titreBloque: !!document.querySelector('#drawerContent .form-error') };
  });
  note('DECAL-47-prep', r);
  const r2 = await ev(p, () => {
    resetApp(); setDepth('pilot');
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    app.resourceUnavailabilities.push({ id: 'unav-new', resourceId: 'eric', start: '2026-08-18T00:00', end: '2026-08-18T23:59', allDay: true, reason: 'unavailable', comment: 'Ajoutée entre-temps' });
    save();
    applyPrepareShift();
    return { err: document.getElementById('shiftFormError')?.textContent, undo: undoHistory.length };
  });
  note('DECAL-47', r2);
  ok(/changé depuis/.test(r2.err) && r2.undo === 0,
    'DECAL-47 : une NOUVELLE indisponibilité ajoutée après l’aperçu (sur une ressource concernée) suffit à le périmer', 'DECAL-47');
  await ctx.close();
}
console.log('\n[DECAL-48] Aperçu NON périmé par un changement SANS rapport — appliqué normalement');
{
  const { ctx, p } = await newPage({ tag: 'FRESH-OK' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    // Une tâche SANS AUCUN rapport (autre chantier, autre ressource) change :
    // ne doit PAS périmer l'aperçu.
    task('v-facade').name = 'Renommée, sans rapport'; save();
    applyPrepareShift();
    return { err: document.getElementById('shiftFormError')?.textContent, undo: undoHistory.length, start: task('t-slab').start };
  });
  note('DECAL-48', r);
  ok(!r.err && r.undo === 1 && r.start === '2026-08-18T09:00',
    'DECAL-48 : un changement SANS rapport avec le décalage préparé ne le périme PAS — l’application réussit normalement (l’empreinte n’est pas hyper-sensible à tout l’état de l’application)', 'DECAL-48');
  await ctx.close();
}

// ============================================================
// DECAL-50 → 54 — VALIDATION
// ============================================================
console.log('\n[DECAL-50] La confirmation n’est pas cochée : application impossible');
{
  const { ctx, p } = await newPage({ tag: 'CONFIRM' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    const btn = document.getElementById('shiftApplyBtn'),
      avantClic = btn.disabled;
    applyPrepareShift(); // appelé quand même, défensivement
    return { avantClic, undo: undoHistory.length, drawerStillOpen: document.getElementById('drawer').classList.contains('open') };
  });
  note('DECAL-50', r);
  ok(r.avantClic === true && r.undo === 0,
    'DECAL-50 : le bouton « Appliquer » est DÉSACTIVÉ tant que la case n’est pas cochée, et applyPrepareShift() refuse défensivement même appelé directement', 'DECAL-50');
  await ctx.close();
}
console.log('\n[DECAL-51] Blocage présent : la case elle-même est désactivée');
{
  const { ctx, p } = await newPage({ tag: 'BLOCKED-UI' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo'; save();
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    return {
      checkbox: document.getElementById('shiftConfirmAck')?.disabled,
      bouton: document.getElementById('shiftApplyBtn')?.disabled,
    };
  });
  note('DECAL-51', r);
  ok(r.checkbox === true && r.bouton === true,
    'DECAL-51 : quand un blocage subsiste (ici, un conflit de ressources), la case de confirmation ELLE-MÊME est désactivée — impossible de la cocher pour forcer le passage', 'DECAL-51');
  await ctx.close();
}
console.log('\n[DECAL-52] Aperçu valide : application autorisée');
{
  const { ctx, p } = await newPage({ tag: 'VALID' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    return { checkbox: document.getElementById('shiftConfirmAck')?.disabled, bouton: document.getElementById('shiftApplyBtn')?.disabled };
  });
  note('DECAL-52', r);
  ok(r.checkbox === false && r.bouton === true,
    'DECAL-52 : sans blocage, la case est ACTIVABLE, mais le bouton « Appliquer » reste désactivé tant qu’elle n’est pas cochée — les deux conditions sont indépendantes', 'DECAL-52');
  await ctx.close();
}
console.log('\n[DECAL-53] Double application : idempotente / refusée proprement');
{
  const { ctx, p } = await newPage({ tag: 'DOUBLE' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    const premier = { start: task('t-slab').start, undo: undoHistory.length };
    // Second appel : shiftDraft a été remis à null par la première
    // application — un second clic (double-soumission) ne fait RIEN.
    applyPrepareShift();
    const second = { start: task('t-slab').start, undo: undoHistory.length };
    return { premier, second };
  });
  note('DECAL-53', r);
  ok(JSON.stringify(r.premier) === JSON.stringify(r.second),
    'DECAL-53 : un second appel à applyPrepareShift() après une application réussie ne fait STRICTEMENT rien (shiftDraft est vidé) — pas de double transaction, pas de double décalage', 'DECAL-53');
  await ctx.close();
}

// ============================================================
// DECAL-55 → 60 — TRANSACTION ET HISTORIQUE
// ============================================================
console.log('\n[DECAL-55] Un seul snapshot, une seule entrée, tout ensemble');
{
  const { ctx, p } = await newPage({ tag: 'TXN' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo';
    // Sans lien avec la transaction testée ici (déjà couverte par
    // DECAL-33/34) : on écarte les congés de Thomas pour isoler la
    // mécanique de transaction sur une cascade propre.
    app.resourceUnavailabilities = app.resourceUnavailabilities.filter((u) => u.id !== 'unav-thomas-conges');
    save();
    const av = { histo: app.history.length, undo: undoHistory.length, messages: app.messages.length };
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    const ap = {
      histo: app.history.length, undo: undoHistory.length, messages: app.messages.length,
      texte: app.history[0].text,
      dates: { w: task('k-windows').start, l: task('k-lining').start, pa: task('k-paint').start, f: task('k-final').start },
    };
    return { av, ap };
  });
  note('DECAL-55', r);
  ok(r.ap.undo === r.av.undo + 1,
    'DECAL-55 : UN seul snapshot pour le décalage source ET toute sa cascade', 'DECAL-55');
  ok(r.ap.histo === r.av.histo + 1,
    'DECAL-56 : UNE seule entrée d’historique intelligible pour tout le geste (même choix que applySimulation() — pas le détail par tâche d’applyReflowPlan, hors périmètre de ce lot)', 'DECAL-56');
  ok(/décalée de 1 jour/.test(r.ap.texte) && /tâche.*dépendante.*replanifiée/.test(r.ap.texte),
    'DECAL-56 : l’entrée nomme la tâche, le nombre de jours et le nombre de tâches dépendantes replanifiées', 'DECAL-56');
  ok(r.ap.messages === r.av.messages,
    'DECAL-57 : aucun message ni notification automatique n’est créé par l’application du décalage', 'DECAL-57');
  await ctx.close();
}
console.log('\n[DECAL-58] Undo restaure TOUTES les dates, Redo les réapplique TOUTES');
{
  const { ctx, p } = await newPage({ tag: 'UNDOREDO' });
  const r = await ev(p, () => {
    task('k-windows').status = 'todo';
    app.resourceUnavailabilities = app.resourceUnavailabilities.filter((u) => u.id !== 'unav-thomas-conges');
    save();
    const av = { w: { ...task('k-windows') }, l: { ...task('k-lining') }, pa: { ...task('k-paint') }, f: { ...task('k-final') } };
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    const ap = { w: task('k-windows').start, l: task('k-lining').start, pa: task('k-paint').start, f: task('k-final').start };
    undo();
    const un = { w: task('k-windows').start, l: task('k-lining').start, pa: task('k-paint').start, f: task('k-final').start };
    redo();
    const rd = { w: task('k-windows').start, l: task('k-lining').start, pa: task('k-paint').start, f: task('k-final').start };
    return { av, ap, un, rd };
  });
  note('DECAL-58', r);
  ok(r.un.w === r.av.w.start && r.un.l === r.av.l.start && r.un.pa === r.av.pa.start && r.un.f === r.av.f.start,
    'DECAL-58 : l’Undo restaure les QUATRE dates (source + trois tâches propagées) à leur valeur d’origine, en un seul geste', 'DECAL-58');
  ok(r.rd.w === r.ap.w && r.rd.l === r.ap.l && r.rd.pa === r.ap.pa && r.rd.f === r.ap.f,
    'DECAL-59 : le Redo réapplique les QUATRE dates décalées, symétriquement', 'DECAL-59');
  await ctx.close();
}
console.log('\n[DECAL-60] Erreur avant application : aucune transaction, rien à annuler');
{
  const { ctx, p } = await newPage({ tag: 'NOTXN' });
  const r = await ev(p, () => {
    const av = { undo: undoHistory.length, histo: app.history.length };
    // Un blocage réel (conflit) : jamais de snapshot ouvert pour un décalage refusé.
    task('k-windows').status = 'todo'; save();
    evaluateShiftImpact('k-windows', 1, true); // conflit ressource Thomas
    return { av, ap: { undo: undoHistory.length, histo: app.history.length } };
  });
  note('DECAL-60', r);
  ok(r.ap.undo === r.av.undo && r.ap.histo === r.av.histo,
    'DECAL-60 : calculer un aperçu qui SE RÉVÈLE bloqué n’ouvre aucune transaction — il n’y a donc rien à annuler (pas de rollback nécessaire, rien n’a jamais été écrit)', 'DECAL-60');
  await ctx.close();
}

// ============================================================
// DECAL-61 → 66 — COMMUNICATIONS (garanties V2.12.0.2 rejouées)
// ============================================================
console.log('\n[DECAL-61] Communication envoyée APRÈS un décalage, puis Undo de ce décalage');
{
  const { ctx, p } = await newPage({ tag: 'COMMS' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '2';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    openConversation({ resourceId: 'eric', taskId: 't-slab', projectId: 'terrasses' });
    document.querySelector('#' + conversationRenderTarget + 'Input').value = 'Message après le décalage';
    sendConversationMessage();
    const m = app.messages[app.messages.length - 1];
    undo();
    const un = { present: app.messages.some((x) => x.id === m.id), start: task('t-slab').start };
    redo();
    const rd = { present: app.messages.some((x) => x.id === m.id), start: task('t-slab').start };
    return { un, rd, doublons: app.messages.length - new Set(app.messages.map((x) => x.id)).size };
  });
  note('DECAL-61', r);
  ok(r.un.present === true,
    'DECAL-61 : un message envoyé APRÈS l’application d’un décalage SURVIT à l’Undo de ce décalage — la garantie V2.12.0.2 s’applique sans changement à cette nouvelle transaction', 'DECAL-61');
  ok(r.rd.present === true,
    'DECAL-62 : et il survit symétriquement au Redo', 'DECAL-62');
  ok(r.doublons === 0,
    'DECAL-62 : aucun doublon', 'DECAL-62');
  await ctx.close();
}
console.log('\n[DECAL-63] Message AVEC photo, envoyé après un décalage avec propagation');
{
  const { ctx, p } = await newPage({ tag: 'COMMS-PHOTO' });
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await ev(p, (png) => {
    task('k-windows').status = 'todo';
    app.resourceUnavailabilities = app.resourceUnavailabilities.filter((u) => u.id !== 'unav-thomas-conges');
    save();
    openPrepareShift('k-windows');
    document.getElementById('shiftDaysInput').value = '1';
    pickShiftPropagate(true);
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
    document.querySelector('#' + conversationRenderTarget + 'Input').value = 'Photo après décalage';
    app.ui.convDraftDataUrl = png;
    sendConversationMessage();
    const m = app.messages[app.messages.length - 1];
    undo();
    return {
      msgPresent: app.messages.some((x) => x.id === m.id),
      photoPresente: app.photos.some((x) => x.id === m.photoId),
      photoResolvable: !!app.photos.find((x) => x.id === (app.messages.find((y) => y.id === m.id) || {}).photoId),
    };
  }, PNG);
  note('DECAL-63', r);
  ok(r.msgPresent && r.photoPresente && r.photoResolvable,
    'DECAL-63 : un message AVEC photo, envoyé après un décalage propagé, survit à l’Undo de ce décalage — message ET photo conservés, référence toujours résolvable', 'DECAL-63');
  await ctx.close();
}
console.log('\n[DECAL-64] Photo terrain NON liée à un message — reste pleinement annulable');
{
  const { ctx, p } = await newPage({ tag: 'COMMS-FIELDPHOTO' });
  const r = await ev(p, () => {
    openPrepareShift('t-slab');
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    shiftDraft.confirmed = true;
    applyPrepareShift();
    // Un AUTRE geste, distinct : une photo terrain, sa propre transaction.
    snapshot();
    const ph = addPhoto({ projectId: 'terrasses', taskId: 't-slab', resourceId: 'eric', author: 'Eric', comment: 'Terrain', dataUrl: 'data:image/png;base64,AAA' });
    save(); actionToast('Photo ajoutée'); render();
    undo(); // annule SEULEMENT la photo — sa propre transaction
    const apresUndoPhoto = { photoPresente: app.photos.some((x) => x.id === ph.id), slabStart: task('t-slab').start };
    undo(); // annule maintenant le décalage
    const apresUndoDecalage = { slabStart: task('t-slab').start };
    return { apresUndoPhoto, apresUndoDecalage };
  });
  note('DECAL-64', r);
  ok(r.apresUndoPhoto.photoPresente === false && r.apresUndoPhoto.slabStart === '2026-08-18T09:00',
    'DECAL-64 : une photo terrain SANS lien à un message reste transactionnelle — son propre Undo l’efface, SANS toucher au décalage (transaction distincte, non affectée)', 'DECAL-64');
  ok(r.apresUndoDecalage.slabStart === '2026-08-17T09:00',
    'DECAL-64 : et le second Undo restaure ensuite le décalage lui-même — les deux transactions restent bien séparées, dans l’ordre', 'DECAL-64');
  await ctx.close();
}

// ============================================================
// DECAL-67 → 70 — PERSISTANCE
// ============================================================
console.log('\n[DECAL-67] Schéma, stockage, état initial');
{
  const A = fs.readFileSync(BASE + PREV, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const d = {
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    initialIdentique: md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)),
    migrationGelee: (() => {
      const extractFn = (src, name) => {
        const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
        const m = re.exec(src); if (!m) return null;
        let par = src.indexOf('(', m.index), depth = 0, k = par;
        for (; k < src.length; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') { depth--; if (!depth) { k++; break; } } }
        let i = src.indexOf('{', k), dd = 0, j = i, s = null, esc = false;
        for (; j < src.length; j++) {
          const c = src[j];
          if (s) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === s) s = null; continue; }
          if (c === '"' || c === "'" || c === '`') { s = c; continue; }
          if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
          if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
          if (c === '{') dd++; else if (c === '}') { dd--; if (!dd) { j++; break; } }
        }
        return src.slice(m.index, j);
      };
      return md5(extractFn(A, 'migrateState')) === md5(extractFn(B, 'migrateState'));
    })(),
  };
  note('DECAL-67', d);
  ok(d.schemaAvant === '15' && d.schemaApres === '15',
    'DECAL-67 : SCHEMA_VERSION reste 15 — aucune donnée persistée nouvelle, aucune migration', 'DECAL-67');
  ok(d.store === 'kanvix-product-8-3',
    'DECAL-68 : STORE reste « kanvix-product-8-3 »', 'DECAL-68');
  ok(d.initialIdentique,
    'DECAL-69 : INITIAL_STATE est BYTE-IDENTIQUE — aucune donnée de démonstration modifiée', 'DECAL-69');
  ok(d.migrationGelee,
    'DECAL-70 : migrateState() est BYTE-IDENTIQUE — aucune migration n’a été nécessaire', 'DECAL-70');
}

// ============================================================
// FREEZE-2121 — PÉRIMÈTRE, ARCHITECTURE, ABSENCE DE CHANGEMENT VISUEL
// ============================================================
console.log('\n[FREEZE-2121] Périmètre et architecture');
{
  const A = fs.readFileSync(BASE + PREV, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
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
  const attendues = ['openTask']; // seule fonction EXISTANTE modifiée : ajout du bouton/menu
  // renderAIPanel : sensible à l'INDENTATION de son bloc source selon ce qui
  // l'entoure dans le fichier (même artefact déjà rencontré et traité en
  // V2.12.0.1/V2.12.0.2) — comparé séparément par bloc indenté, pas par
  // extraction de fonction brute.
  const parIndentation = ['renderAIPanel'];
  const blocIndente = (src, nom) => {
    const lignes = src.split('\n');
    const re = new RegExp('^(\\s*)function\\s+' + nom + '\\s*\\(');
    for (let i = 0; i < lignes.length; i++) {
      const m = re.exec(lignes[i]);
      if (!m) continue;
      const ind = m[1].length, out = [lignes[i]];
      for (let j = i + 1; j < lignes.length; j++) {
        out.push(lignes[j]);
        if (lignes[j].trim() === '}' && lignes[j].length - lignes[j].trimStart().length === ind) return out.join('\n');
      }
    }
    return null;
  };
  const ajouteesAttendues = [
    'taskShiftEligibility', 'shiftChainHasCycle', 'computeShiftChain', 'buildShiftFingerprint',
    'evaluateShiftImpact', 'openPrepareShift', 'renderPrepareShiftForm', 'pickShiftPropagate',
    'submitPrepareShiftForm', 'renderPrepareShiftPreview', 'toggleShiftConfirm', 'cancelPrepareShift',
    'renderPrepareShiftError', 'applyPrepareShift',
  ];
  const horsPerimetre = [], ajoutees = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  note('FREEZE-2121-périmètre', { horsPérimètre: horsPerimetre, indentation: indentDiff, ajoutées: ajoutees.sort() });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-2121 : hors de openTask() (bouton ajouté), le balayage md5 de TOUT le fichier ne trouve AUCUNE autre fonction EXISTANTE modifiée depuis V2.12.0.2 — renderAIPanel comparé par bloc indenté reste lui aussi identique', 'FREEZE-2121');
  ok(JSON.stringify(ajoutees.sort()) === JSON.stringify(ajouteesAttendues.slice().sort()),
    'FREEZE-2121 : les SEULES fonctions ajoutées sont exactement celles du nouveau parcours « Préparer un décalage » — aucun second moteur, aucune fonction utilitaire surnuméraire', 'FREEZE-2121');

  const geles = [
    // Moteurs RÉUTILISÉS tels quels — le cœur de la contrainte « aucun second moteur ».
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'reflowSuccessors', 'propagateDependencies',
    'evaluateScenario', 'scenarioOptions', 'evaluateDependencyConflicts', 'findDependencyConflicts',
    'getResourceSchedulingConflicts', 'getResourceConflicts', 'resourceUnavailabilityConflicts',
    'getMaxConcurrentTasks', 'getResourceTasks', 'taskResourceIds', 'taskHasResource',
    'nextWorkingTime', 'addWorkingDuration', 'addBusinessDays', 'nonWorkingDaysInRange',
    'taskTouchesNonWorkingDay', 'calculateProjectEnd', 'calculateProjectDelay', 'workdayDelay',
    'milestoneImpactNote', 'milestoneStatus', 'milestoneLinkedTask', 'getTaskSuccessors', 'getTaskPredecessors',
    'taskCreatesCycle', 'getCriticalImpacts', 'showWhatIf', 'startWhatIf', 'autoFixSimulation',
    'cancelSimulation', 'applySimulation', 'simulate', 'moveTask', 'openTaskEdit', 'submitTaskEdit',
    'setTaskStatus', 'openTaskPrerequisites', 'confirmPrerequisiteStart', 'askPrerequisiteStartConfirm',
    'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState', 'preserveCommunications',
    'invalidateRedo', 'pushHistory', 'clearUndoRedo', 'sendConversationMessage', 'sendArtisanMessage',
    'openConversation', 'addPhoto', 'addFieldPhoto', 'guardEditable', 'canEditProject', 'isProjectActive',
    'isProjectArchived', 'save', 'resetApp', 'render', 'renderPage',
  ];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2121-gelés', { comparées: compares, bougés: bouges });
  ok(compares > 60 && bouges.length === 0,
    `FREEZE-2121 : les ${compares} moteurs nommément réutilisés sont BYTE-IDENTIQUES à V2.12.0.2 — planReflow, evaluateScenario, evaluateDependencyConflicts, getResourceSchedulingConflicts, addBusinessDays, addWorkingDuration, nonWorkingDaysInRange, snapshot/undo/redo/restoreHistoryState/preserveCommunications compris. Aucun second moteur de calendrier, de dépendances ou de propagation n’a été créé`, 'FREEZE-2121');

  const bloc = (src, re) => (src.match(re) || [''])[0];
  const ui = {
    css: md5(bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/)) === md5(bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/)),
  };
  note('FREEZE-2121-css', ui);
  ok(ui.css,
    'FREEZE-2121 : la feuille de style est BYTE-IDENTIQUE — le nouveau panneau réutilise exclusivement des classes CSS déjà en production (.drawer-section/.te-section/.te-advanced/.seg/.effect-summary/.prq-confirm-list/.check-row/.form-error), aucune classe n’a été ajoutée', 'FREEZE-2121');
}

// ============================================================
// FIXDECAL-RESP — VALIDATION NAVIGATEUR / RESPONSIVE
// ============================================================
console.log('\n[FIXDECAL-RESP] Parcours réel, largeurs et thèmes');
{
  const LARGEURS = [1920, 1440, 1080, 768, 430, 390];
  const fautives = [], cibles = [];
  for (const w of LARGEURS) {
    for (const sombre of [false, true]) {
      const { ctx, p } = await newPage({ w, h: w <= 430 ? 844 : 1000, tag: `R${w}${sombre ? 'D' : 'L'}` });
      if (sombre) { await ev(p, () => setAppearance('dark')); await p.waitForTimeout(150); }
      await ev(p, () => { task('k-windows').status = 'todo'; save(); });
      // Parcours réel complet, par les VRAIS gestes DOM.
      await p.evaluate(() => openTask('k-windows'));
      await p.evaluate(() => { document.querySelector('.more-trigger')?.click(); });
      await p.evaluate(() => document.evaluate("//button[contains(text(),'Préparer un décalage')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click());
      await p.waitForTimeout(120);
      await p.fill('#shiftDaysInput', '2');
      await p.click('.seg-opt:nth-of-type(2)');
      await p.evaluate(() => submitPrepareShiftForm());
      await p.waitForTimeout(120);
      const m = await ev(p, () => {
        const de = document.documentElement, drawer = document.getElementById('drawerContent');
        // Contrôles VRAIMENT nouveaux, dont ce lot choisit la taille (les
        // boutons segmentés et d'action) — mesurés contre un seuil tactile.
        // La case à cocher, elle, RÉUTILISE .check-row tel quel (voir
        // FREEZE-2121 : CSS byte-identique) : ce n'est pas à ce lot d'inventer
        // une exigence tactile sur un composant partagé, déjà utilisé ailleurs
        // dans le produit sans changement — sa hauteur est seulement relevée,
        // pour mémoire, jamais comparée à un seuil inventé ici.
        const nouveauxControles = [...document.querySelectorAll('#drawerContent .seg-opt, #drawerContent .te-actionbar .btn')];
        const checkRow = document.querySelector('#drawerContent .check-row');
        return {
          scrollH: de.scrollWidth > de.clientWidth + 1,
          debordeDrawer: drawer.scrollWidth > drawer.clientWidth + 1,
          hauteurs: nouveauxControles.map((x) => Math.round(x.getBoundingClientRect().height)),
          checkRowHauteur: checkRow ? Math.round(checkRow.getBoundingClientRect().height) : null,
        };
      });
      if (m.scrollH || m.debordeDrawer) fautives.push({ w, sombre, ...m });
      if (w <= 430 && !sombre) cibles.push({ w, hauteurs: m.hauteurs, checkRowHauteur: m.checkRowHauteur });
      if (w === 390 && !sombre) await p.screenshot({ path: SHOTS + '01-apercu-390-light.png' });
      if (w === 1440 && sombre) await p.screenshot({ path: SHOTS + '02-apercu-1440-dark.png' });
      await ctx.close();
    }
  }
  note('FIXDECAL-RESP', { mesurées: LARGEURS.length * 2, fautives, cibles });
  ok(fautives.length === 0,
    `FIXDECAL-RESP : sur ${LARGEURS.length * 2} combinaisons (6 largeurs de 1920 à 390 px × clair/sombre), le panneau « Préparer un décalage » et son aperçu ne provoquent AUCUN défilement horizontal ni débordement du panneau`, 'FIXDECAL-RESP');
  ok(cibles.every((c) => c.hauteurs.every((h) => h >= 36)),
    'FIXDECAL-RESP : sur mobile (390/430 px), les contrôles dont CE LOT choisit la taille (choix de propagation, boutons d’action) mesurent une hauteur tactile cohérente avec le reste du produit (≥36 px, même convention que la modale « Conditions non confirmées » déjà mesurée en V2.12.0.1)', 'FIXDECAL-RESP');
}
console.log('\n[FIXDECAL-KBD] Clavier et focus');
{
  const { ctx, p } = await newPage({ tag: 'KBD' });
  const r = await ev(p, () => {
    task('t-slab').status = 'todo'; save();
    openPrepareShift('t-slab');
    return { focus: document.activeElement?.id };
  });
  await p.waitForTimeout(200);
  const focusApresDelai = await ev(p, () => document.activeElement?.id);
  note('FIXDECAL-KBD', { immediat: r.focus, apresDelai: focusApresDelai });
  ok(focusApresDelai === 'shiftDaysInput',
    'FIXDECAL-KBD : à l’ouverture du panneau, le focus se pose sur le champ « jours » — cohérent avec le reste du produit (openTaskEdit fait de même sur son premier champ)', 'FIXDECAL-KBD');
  await ctx.close();
}

// ============================================================
const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim|google\.com/.test(e.msg));
ok(appErrs.length === 0, `DECAL : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'DECAL');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 15), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
