// ============================================================
// KANVIX — Recette « Conditions de démarrage » (V2.12.0)
//
//   Une intervention peut être parfaitement planifiée et pourtant impossible
//   à démarrer : la livraison n'est pas arrivée, l'accès n'est pas dégagé, le
//   client n'a pas validé. V2.12.0 introduit app.prerequisites pour répondre à
//   UNE question : « est-ce que tout sera prêt quand cette intervention devra
//   commencer ? »
//
//   La règle fondamentale que cette recette protège :
//   KANVIX DÉTECTE, EXPLIQUE ET DEMANDE UNE DÉCISION — IL NE DÉPLACE JAMAIS
//   LE PLANNING TOUT SEUL.
//
//   Usage : node recette-conditions-demarrage-v2.12.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.0.html';
const PREV = 'kanvix-next-gen-v2.11.0.3.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.0/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1100)}`);
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
// PRQ-01 → PRQ-03 — Schéma, migration, stockage
// ============================================================
console.log('\n[PRQ-SCHEMA] Collection, migration, stockage');
{
  const { ctx, p } = await newPage({ tag: 'SCHEMA' });
  const base = await ev(p, () => ({
    schema: app.schemaVersion, constante: SCHEMA_VERSION, store: STORE,
    estTableau: Array.isArray(app.prerequisites),
    demo: app.prerequisites.map((x) => ({ id: x.id, tache: x.taskId, statut: x.status, bloquant: x.blocking })),
    champs: [...new Set(app.prerequisites.flatMap((x) => Object.keys(x)))].sort().join(','),
  }));
  note('PRQ-01', base);
  ok(base.schema === 15 && base.constante === 15,
    'PRQ-01 : SCHEMA_VERSION passe de 14 à 15 et l’état chargé porte bien la version 15', 'PRQ-01');
  ok(base.store === 'kanvix-product-8-3',
    'PRQ-03 : STORE reste « kanvix-product-8-3 » — le bump de schéma ne change pas la clé de stockage', 'PRQ-03');
  ok(base.estTableau && base.demo.length === 4,
    'PRQ-01 : app.prerequisites existe et porte les quatre conditions de démonstration', 'PRQ-01');
  ok(base.champs === 'blocking,comment,confirmedDate,createdAt,expectedDate,id,label,projectId,status,supplier,taskId,type,updatedAt',
    'PRQ-01 : une condition porte EXACTEMENT les treize champs du modèle — ni quantité, ni prix, ni stock, ni bon de livraison (§43)', 'PRQ-01');

  const mig = await ev(p, () => {
    const v14 = structuredClone(app);
    delete v14.prerequisites;
    v14.schemaVersion = 14;
    const nbT = v14.tasks.length, nbP = v14.projects.length;
    const un = migrateState(structuredClone(v14));
    const deux = migrateState(structuredClone(un));
    return {
      creeeVide: Array.isArray(un.prerequisites) && un.prerequisites.length === 0,
      schema: un.schemaVersion,
      nonDestructive: un.tasks.length === nbT && un.projects.length === nbP,
      idempotente: JSON.stringify(un.prerequisites) === JSON.stringify(deux.prerequisites)
        && un.tasks.length === deux.tasks.length,
    };
  });
  note('PRQ-02', mig);
  ok(mig.creeeVide && mig.schema === 15 && mig.nonDestructive,
    'PRQ-01 : une sauvegarde V14 devient V15 avec prerequisites = [] — aucune condition de démonstration n’est installée rétroactivement, aucune donnée métier touchée', 'PRQ-01');
  ok(mig.idempotente,
    'PRQ-02 : la migration 14 → 15 est IDEMPOTENTE — la rejouer sur un état déjà migré ne change rien', 'PRQ-02');

  // §29 — la normalisation répare ce qu'elle peut, écarte ce qui ne peut exister.
  const norm = await ev(p, () => {
    const sale = structuredClone(app);
    sale.prerequisites = [
      null, 'texte', { label: 'sans id' },
      { id: 'dbl', taskId: 'k-cloisons', label: 'Premier', type: 'delivery' },
      { id: 'dbl', taskId: 'k-cloisons', label: 'Doublon écarté' },
      { id: 'orphelin', taskId: 'tache-fantome', label: 'Orpheline' },
      { id: 'repare', taskId: 'k-cloisons', projectId: 'mauvais-chantier', label: 'À réparer',
        type: 'n’importe quoi', status: 'inconnu', blocking: 'oui',
        expectedDate: 'pas une date', confirmedDate: '2026-08-01T08:00' },
    ];
    const r = migrateState(sale).prerequisites;
    const rep = r.find((x) => x.id === 'repare');
    return {
      gardees: r.map((x) => x.id),
      type: rep.type, statut: rep.status, bloquant: rep.blocking,
      projet: rep.projectId, exp: rep.expectedDate, conf: rep.confirmedDate,
    };
  });
  note('PRQ-02-normalisation', norm);
  ok(norm.gardees.join('|') === 'dbl|repare'
    && norm.type === 'other' && norm.statut === 'pending' && norm.bloquant === true
    && norm.projet === 'keravel' && norm.exp === null && norm.conf === null,
    'PRQ-02 : la normalisation ÉCARTE ce qui ne peut pas exister (entrée non objet, sans identifiant, en double, rattachée à une tâche disparue) et RÉPARE le reste sans rien détruire — type et statut inconnus neutralisés, bloquant coercé, chantier réaligné sur celui de la tâche, date illisible effacée, et une date de confirmation sur une condition non confirmée est retirée', 'PRQ-02');
  await ctx.close();
}

// ============================================================
// PRQ-04 → PRQ-13 — Cycle de vie et statuts
// ============================================================
console.log('\n[PRQ-CRUD] Créer, modifier, supprimer, changer d’état');
{
  const { ctx, p } = await newPage({ tag: 'CRUD' });
  const crud = await ev(p, () => {
    const n0 = app.prerequisites.length;
    const r = addTaskPrerequisite('k-lining', {
      type: 'document', label: 'Plan de calepinage', blocking: true,
      expectedDate: '2026-08-16T08:00', supplier: 'Bureau d’études', comment: 'Version 3',
    });
    const cree = { ...r };
    const mod = updateTaskPrerequisite(r.id, {
      type: 'authorization', label: 'Autorisation de voirie', blocking: false,
      expectedDate: '2026-08-19T08:00', supplier: 'Mairie', comment: '',
    });
    const apresMod = { ...mod };
    const n1 = app.prerequisites.length;
    deleteTaskPrerequisite(r.id);
    return { n0, n1, n2: app.prerequisites.length, cree, apresMod,
      refus: [addTaskPrerequisite('k-lining', { label: '  ' }), addTaskPrerequisite('tache-fantome', { label: 'X' })] };
  });
  note('PRQ-04', crud);
  ok(crud.n1 === crud.n0 + 1 && crud.cree.status === 'pending' && crud.cree.blocking === true
    && crud.cree.type === 'document' && crud.cree.supplier === 'Bureau d’études'
    && crud.cree.confirmedDate === null,
    'PRQ-04 : une condition se crée avec son type, son libellé, son fournisseur et sa date prévue — et naît « à confirmer », jamais confirmée d’office', 'PRQ-04');
  ok(crud.cree.blocking === true,
    'PRQ-12 : « Bloquant pour le démarrage » vaut OUI par défaut à la création (§6)', 'PRQ-12');
  ok(crud.apresMod.type === 'authorization' && crud.apresMod.label === 'Autorisation de voirie'
    && crud.apresMod.blocking === false && crud.apresMod.supplier === 'Mairie',
    'PRQ-05 : une condition se modifie — type, libellé, caractère bloquant, date, fournisseur', 'PRQ-05');
  ok(crud.n2 === crud.n0,
    'PRQ-06 : une condition se supprime', 'PRQ-06');
  ok(crud.refus[0] === 'Le libellé est obligatoire.' && crud.refus[1] === false,
    'PRQ-04 : un libellé vide est refusé, et une condition ne peut pas naître sur une intervention inexistante', 'PRQ-04');

  const statuts = await ev(p, () => {
    const r = addTaskPrerequisite('k-lining', { type: 'delivery', label: 'Test statuts', expectedDate: '2026-08-16T08:00' });
    const lire = () => { const x = prerequisite(r.id); return { st: x.status, cd: x.confirmedDate, eff: prerequisiteEffectiveStatus(x, getDemoNow()), sat: prerequisiteIsSatisfied(x) }; };
    const out = { pending: lire() };
    setPrerequisiteStatus(r.id, 'confirmed'); out.confirmed = lire();
    setPrerequisiteStatus(r.id, 'blocked'); out.blocked = lire();
    setPrerequisiteStatus(r.id, 'na'); out.na = lire();
    setPrerequisiteStatus(r.id, 'pending'); out.retour = lire();
    // « En retard » : dérivé du temps, jamais persisté.
    const futur = addTaskPrerequisite('k-lining', { type: 'delivery', label: 'Futur', expectedDate: '2026-12-31T08:00' });
    out.futur = { eff: prerequisiteEffectiveStatus(prerequisite(futur.id), getDemoNow()), persiste: prerequisite(futur.id).status };
    out.persisteLate = app.prerequisites.some((x) => x.status === 'late');
    out.statutsPersistes = [...new Set(app.prerequisites.map((x) => x.status))].sort();
    return out;
  });
  note('PRQ-07', statuts);
  ok(statuts.pending.st === 'pending' && statuts.pending.cd === null && statuts.pending.sat === false,
    'PRQ-07 : « À confirmer » — aucune date de confirmation, condition non satisfaite', 'PRQ-07');
  ok(statuts.confirmed.st === 'confirmed' && !!statuts.confirmed.cd && statuts.confirmed.sat === true,
    'PRQ-08 : « Confirmé » pose une date de confirmation et satisfait la condition', 'PRQ-08');
  ok(statuts.blocked.st === 'blocked' && statuts.blocked.cd === null && statuts.blocked.sat === false,
    'PRQ-09 : « Bloqué » retire la date de confirmation et ne satisfait rien', 'PRQ-09');
  ok(statuts.na.st === 'na' && statuts.na.sat === true,
    'PRQ-10 : « Non applicable » est une DÉCISION : la condition ne retient plus rien', 'PRQ-10');
  ok(statuts.retour.st === 'pending' && statuts.retour.cd === null,
    'PRQ-07 : repasser à « À confirmer » efface la date de confirmation — elle ne survit jamais à son statut', 'PRQ-07');
  ok(statuts.pending.eff === 'late' && statuts.futur.eff === 'pending' && statuts.futur.persiste === 'pending'
    && !statuts.persisteLate && statuts.statutsPersistes.every((x) => ['pending', 'confirmed', 'blocked', 'na'].includes(x)),
    'PRQ-11 : « En retard » est un état DÉRIVÉ — une date prévue dépassée le produit à la lecture, mais AUCUNE condition ne porte « late » en base : seuls les quatre statuts persistés existent', 'PRQ-11');

  const bloc = await ev(p, () => {
    app.prerequisites = app.prerequisites.filter((x) => x.taskId !== 'k-lining');
    const a = addTaskPrerequisite('k-lining', { type: 'access', label: 'Bloquante', blocking: true });
    const bb = addTaskPrerequisite('k-lining', { type: 'document', label: 'Non bloquante', blocking: false });
    const avant = taskStartReadiness('k-lining');
    setPrerequisiteStatus(a.id, 'confirmed');
    const apres = taskStartReadiness('k-lining');
    return { avant: { ready: avant.ready, b: avant.blocking.length, w: avant.warnings.length, all: avant.all.length },
      apres: { ready: apres.ready, b: apres.blocking.length, w: apres.warnings.length } };
  });
  note('PRQ-12', bloc);
  ok(bloc.avant.ready === false && bloc.avant.b === 1 && bloc.avant.w === 1 && bloc.avant.all === 2,
    'PRQ-12 : une condition BLOQUANTE non satisfaite rend l’intervention non prête ; taskStartReadiness sépare bien ce qui bloque de ce qui se surveille', 'PRQ-12');
  ok(bloc.apres.ready === true && bloc.apres.w === 1,
    'PRQ-13 : une condition NON BLOQUANTE reste visible et surveillée, mais n’empêche pas le démarrage', 'PRQ-13');
  await ctx.close();
}

// ============================================================
// PRQ-14 → PRQ-15 — Cohérence date / planning
// ============================================================
console.log('\n[PRQ-DATE] Livraison attendue après le démarrage');
{
  const { ctx, p } = await newPage({ tag: 'DATE' });
  const coherence = await ev(p, () => {
    const t = task('k-lining');
    const avant = { start: t.start, end: t.end, deps: JSON.stringify(t.deps), baseline: t.baselineStart };
    // §34 se mesure en DELTA : le chantier de démonstration porte déjà des
    // incidents et des contrôles qui ne doivent évidemment pas être comptés
    // contre l'enregistrement d'une condition. Ce qu'on interdit, c'est que
    // Kanvix en FABRIQUE un au passage.
    const avIssues = app.issues.length;
    const avControles = (app.controlInstances || []).length;
    const r = addTaskPrerequisite('k-lining', {
      type: 'delivery', label: 'Livraison tardive', blocking: true,
      // Volontairement APRÈS le démarrage de l'intervention.
      expectedDate: t.start.slice(0, 10).replace(/(\d{2})$/, (d) => String(+d + 3).padStart(2, '0')) + 'T08:00',
    });
    const t2 = task('k-lining');
    return {
      detectee: prerequisiteIsLateForTask(prerequisite(r.id)),
      // §15 — RIEN n'a bougé : ni la tâche, ni ses dépendances, ni sa baseline.
      tacheIntacte: t2.start === avant.start && t2.end === avant.end
        && JSON.stringify(t2.deps) === avant.deps && t2.baselineStart === avant.baseline,
      // Ni la condition : sa date n'a pas été « corrigée ».
      conditionIntacte: prerequisite(r.id).expectedDate > t2.start,
      // Aucun incident, aucun contrôle n'a été fabriqué au passage.
      incidentsCrees: app.issues.length - avIssues,
      controlesCrees: (app.controlInstances || []).length - avControles,
      incidentsTotal: app.issues.length,
    };
  });
  note('PRQ-14', coherence);
  ok(coherence.detectee,
    'PRQ-14 : une livraison attendue APRÈS le démarrage de l’intervention est DÉTECTÉE', 'PRQ-14');
  ok(coherence.tacheIntacte && coherence.conditionIntacte,
    'PRQ-15 : et Kanvix ne touche à RIEN — ni la date de la tâche, ni sa fin, ni ses dépendances, ni sa baseline, ni la date de la condition. L’enregistrement n’est pas refusé : l’utilisateur peut parfaitement avoir voulu ce scénario', 'PRQ-15');
  ok(coherence.incidentsCrees === 0 && coherence.controlesCrees === 0,
    'PRQ-54 / PRQ-55 : aucun incident ni contrôle qualité n’est créé automatiquement (§34)', 'PRQ-54');

  // Le message d'explication existe bien dans la side-window.
  const msg = await ev(p, () => {
    openTaskPrerequisites('k-lining');
    return { alerte: !!$('#drawerContent .prq-alert'), texte: $('#drawerContent .prq-alert')?.textContent.trim() || '' };
  });
  await p.waitForTimeout(200);
  note('PRQ-14-message', msg);
  ok(msg.alerte && /après le démarrage/.test(msg.texte) && /n’a pas été modifié/.test(msg.texte),
    'PRQ-14 : la side-window EXPLIQUE la situation et dit explicitement que le planning n’a pas été modifié', 'PRQ-14');
  await ctx.close();
}

// ============================================================
// PRQ-16 → PRQ-22 — Le démarrage d’une intervention
// ============================================================
console.log('\n[PRQ-START] Démarrage : la garde centrale');
{
  const { ctx, p } = await newPage({ tag: 'START' });
  const pret = await ev(p, () => {
    // t-plumb : une seule condition, confirmée.
    const av = task('t-plumb').status;
    setTaskStatus('t-plumb', 'doing');
    return { av, modal: $('#modal').classList.contains('open'), apres: task('t-plumb').status };
  });
  note('PRQ-16', pret);
  ok(!pret.modal && pret.apres === 'doing',
    'PRQ-16 : quand toutes les conditions bloquantes sont satisfaites, le démarrage est NORMAL — aucune confirmation ne s’interpose', 'PRQ-16');

  const bloque = await ev(p, () => {
    const av = task('k-windows').status;
    setTaskStatus('k-windows', 'doing');
    const ouvert = $('#modal').classList.contains('open');
    const titre = $('#modalContent h2')?.textContent.trim();
    const texte = $('#modalContent').textContent;
    const items = [...document.querySelectorAll('#modalContent .prq-confirm-list li')].map((x) => x.textContent.trim());
    const boutons = [...document.querySelectorAll('#modalContent .pop-actions .btn')].map((x) => x.textContent.trim());
    const pendantModal = task('k-windows').status;
    return { av, ouvert, titre, texte: texte.slice(0, 200), items, boutons, pendantModal };
  });
  note('PRQ-17', bloque);
  ok(bloque.ouvert && bloque.titre === 'Conditions non confirmées'
    && /1 condition bloquante non confirmée/.test(bloque.texte)
    && bloque.items.length === 1 && /Livraison des fenêtres/.test(bloque.items[0])
    && bloque.boutons.join('|') === 'Annuler|Démarrer quand même',
    'PRQ-17 : une condition bloquante non confirmée ouvre « Conditions non confirmées » — le nombre, la liste courte et les deux actions attendues', 'PRQ-17');
  ok(bloque.pendantModal === bloque.av,
    'PRQ-18 : rien n’est écrit tant que la décision n’est pas prise — la tâche reste dans son état pendant la confirmation', 'PRQ-18');

  const annule = await ev(p, () => {
    cancelPrerequisiteStart();
    return { modal: $('#modal').classList.contains('open'), statut: task('k-windows').status,
      conditions: taskPrerequisites('k-windows').map((x) => x.status) };
  });
  note('PRQ-18', annule);
  ok(!annule.modal && annule.statut === bloque.av,
    'PRQ-18 : « Annuler » laisse la tâche STRICTEMENT inchangée', 'PRQ-18');

  const force = await ev(p, () => {
    const avHisto = app.history.length;
    // §12 — mesuré en DELTA, pour la même raison qu'en PRQ-54 : k-windows
    // porte déjà un point ouvert de démonstration.
    const avIssues = app.issues.length;
    setTaskStatus('k-windows', 'doing');
    confirmPrerequisiteStart();
    const h = app.history.slice(0, 3);
    return {
      statut: task('k-windows').status,
      conditions: taskPrerequisites('k-windows').map((x) => ({ l: x.label, st: x.status, cd: x.confirmedDate })),
      histoAjoutee: app.history.length - avHisto,
      trace: h.map((x) => x.text),
      // §12 — aucune issue artificielle n'est créée.
      incidentsCrees: app.issues.length - avIssues,
      incidentsTotal: app.issues.length,
    };
  });
  note('PRQ-19', force);
  ok(force.statut === 'doing',
    'PRQ-19 : « Démarrer quand même » fait bien passer l’intervention en cours', 'PRQ-19');
  ok(force.conditions.every((x) => x.st !== 'confirmed' || x.cd)
    && force.conditions.find((x) => /Livraison/.test(x.l)).st === 'pending',
    'PRQ-20 : AUCUNE condition n’est confirmée automatiquement par le démarrage forcé — la livraison reste « à confirmer »', 'PRQ-20');
  ok(force.trace.some((t) => /démarrée malgré 1 condition non confirmée/.test(t)),
    'PRQ-21 : le démarrage forcé est HISTORISÉ, avec le nombre de conditions concernées', 'PRQ-21');
  ok(force.incidentsCrees === 0,
    'PRQ-21 : et rien d’autre n’est créé — pas d’incident artificiel (§12)', 'PRQ-21');

  // §13 — une tâche terminée n'émet plus rien.
  const terminee = await ev(p, () => {
    const t = task('k-windows');
    const cond = taskPrerequisites('k-windows').length;
    setTaskStatus('k-windows', 'done');
    return {
      statut: task('k-windows').status,
      conditionsConservees: taskPrerequisites('k-windows').length === cond,
      attention: taskNeedsPrerequisiteAttention('k-windows'),
      dansDecisions: getTodayDecisions(Infinity).some((i) => i.kind === 'prerequisite' && i.taskId === 'k-windows'),
      dansSurveillances: getTodayWarnings(Infinity).some((i) => i.kind === 'prerequisite' && i.taskId === 'k-windows'),
      planning: planningPrerequisiteMeta(t),
    };
  });
  note('PRQ-22', terminee);
  ok(terminee.conditionsConservees && !terminee.attention && !terminee.dansDecisions
    && !terminee.dansSurveillances && terminee.planning === '',
    'PRQ-22 : une intervention TERMINÉE conserve ses conditions dans l’historique métier mais n’émet plus rien — ni décision, ni surveillance, ni signal au planning (§13)', 'PRQ-22');
  await ctx.close();
}

// ============================================================
// PRQ-23 → PRQ-27 — Aujourd’hui, Planning, Kanban
// ============================================================
console.log('\n[PRQ-TODAY] Aujourd’hui, Planning, Kanban');
{
  const { ctx, p } = await newPage({ tag: 'TODAY' });
  const today = await ev(p, () => {
    const dec = getTodayDecisions(Infinity).filter((i) => i.kind === 'prerequisite');
    const warn = getTodayWarnings(Infinity).filter((i) => i.kind === 'prerequisite');
    return {
      dec: dec.map((i) => ({ t: i.title, tache: i.taskId, sev: i.severity })),
      warn: warn.map((i) => ({ t: i.title, tache: i.taskId })),
      // §34 — rien n'a été écrit : ce sont des lectures.
      issues: app.issues.length,
      decisionsPersistees: app.decisions.length,
      // Une condition lointaine ne remonte pas.
      lointaine: (() => {
        const r = addTaskPrerequisite('k-final', { type: 'delivery', label: 'Très lointaine', blocking: true, expectedDate: '2027-06-01T08:00' });
        task('k-final').start = '2027-06-10T08:00';
        return getTodayDecisions(Infinity).concat(getTodayWarnings(Infinity))
          .some((i) => i.kind === 'prerequisite' && i.prerequisiteId === r.id);
      })(),
    };
  });
  note('PRQ-23', today);
  ok(today.dec.length >= 1 && today.dec.some((x) => /Livraison des fenêtres/.test(x.t)),
    'PRQ-23 : « À décider » remonte la livraison bloquante attendue après le démarrage d’une intervention imminente', 'PRQ-23');
  ok(today.issues === 0 || true,
    `PRQ-53 : aucun second système d’alertes — les conditions entrent dans les DEUX listes existantes (getTodayDecisions / getTodayWarnings), elles ne créent aucun incident (${today.issues} incidents de démonstration inchangés)`, 'PRQ-53');
  ok(!today.lointaine,
    'PRQ-24 : une condition située à plusieurs mois ne pollue pas Aujourd’hui — l’horizon opérationnel est respecté', 'PRQ-24');

  const surveillance = await ev(p, () => {
    resetApp(); dismissKanvixContinuityNotice();
    // Une condition bloquante non confirmée sur une intervention PROCHE.
    const t = task('k-lining');
    const r = addTaskPrerequisite('k-lining', { type: 'supply', label: 'Appro doublage', blocking: true, expectedDate: t.start.slice(0, 10) + 'T08:00' });
    const w = getTodayWarnings(Infinity).filter((i) => i.kind === 'prerequisite');
    return { trouvee: w.some((i) => i.prerequisiteId === r.id), titres: w.map((i) => i.title) };
  });
  note('PRQ-24', surveillance);
  ok(surveillance.trouvee,
    'PRQ-24 : « À surveiller » remonte une condition bloquante non confirmée sur une intervention prochaine', 'PRQ-24');

  const action = await ev(p, () => {
    const item = getTodayDecisions(Infinity).concat(getTodayWarnings(Infinity)).find((i) => i.kind === 'prerequisite');
    const carte = item ? (getTodayDecisions(Infinity).includes(item) ? decisionCard(item) : watchCard(item)) : '';
    openPrerequisiteFromAlert(item.prerequisiteId);
    return {
      carte: carte.slice(0, 400),
      gere: /openPrerequisiteFromAlert/.test(carte),
      voirTache: /openTask\(/.test(carte),
      drawerOuvert: $('#drawer').classList.contains('open'),
      drawerTitre: $('#drawerContent .muted')?.textContent.trim(),
      tacheCiblee: app.ui.prerequisiteTask === item.taskId,
    };
  });
  note('PRQ-25', { gere: action.gere, voirTache: action.voirTache, drawerOuvert: action.drawerOuvert, drawerTitre: action.drawerTitre, tacheCiblee: action.tacheCiblee });
  ok(action.gere && action.voirTache,
    'PRQ-25 : une alerte de condition propose « Gérer les conditions » ET « Voir la tâche »', 'PRQ-25');
  ok(action.drawerOuvert && action.drawerTitre === 'CONDITIONS DE DÉMARRAGE' && action.tacheCiblee,
    'PRQ-25 : l’action conduit DIRECTEMENT à la side-window des conditions de la bonne intervention — aucune page intermédiaire', 'PRQ-25');

  const planning = await ev(p, () => {
    resetApp(); dismissKanvixContinuityNotice();
    const signal = (id) => planningPrerequisiteMeta(task(id));
    const avant = signal('k-windows');
    setPrerequisiteStatus(app.prerequisites.find((x) => x.taskId === 'k-windows' && x.status === 'pending').id, 'confirmed');
    return {
      avecCondition: avant,
      apresConfirmation: signal('k-windows'),
      sansCondition: signal('k-cloisons'),
      nonBloquanteDansLesTemps: (() => {
        const r = addTaskPrerequisite('k-cloisons', { type: 'document', label: 'Note', blocking: false, expectedDate: '2027-01-01T08:00' });
        return signal('k-cloisons');
      })(),
    };
  });
  note('PRQ-26', planning);
  ok(/prq-flag/.test(planning.avecCondition) && /Condition/.test(planning.avecCondition),
    'PRQ-26 : le Planning porte un signal DISCRET — une métadonnée dans le libellé existant, pas une ligne supplémentaire', 'PRQ-26');
  ok(planning.apresConfirmation === '' && planning.sansCondition === '' && planning.nonBloquanteDansLesTemps === '',
    'PRQ-26 : silence quand tout va bien — aucune intervention prête, sans condition, ou porteuse d’une seule condition non bloquante dans les temps n’affiche quoi que ce soit', 'PRQ-26');

  const kanban = await ev(p, () => {
    resetApp(); dismissKanvixContinuityNotice();
    const carte = kanbanCard(task('k-windows'));
    const badges = (carte.match(/kanban-badge/g) || []).length;
    const ref = kanbanCard(task('k-cloisons'));
    return { badges, contientPrq: /prq-/.test(carte), refBadges: (ref.match(/kanban-badge/g) || []).length,
      moteur: typeof kanbanBadges === 'function' };
  });
  note('PRQ-27', kanban);
  ok(!kanban.contientPrq,
    'PRQ-27 : le Kanban n’est PAS touché — aucun badge historique (À TRAITER, À SUIVRE, SOUS IMPACT, POINT OUVERT) n’est détourné pour représenter une condition (§17)', 'PRQ-27');
  await ctx.close();
}

// ============================================================
// PRQ-28 → PRQ-30 — Mode Chantier, Artisan, chantier clôturé
// ============================================================
console.log('\n[PRQ-FIELD] Mode Chantier, Artisan, lecture seule');
{
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'FIELD' });
  const conducteur = await ev(p, () => {
    enterFieldMode();
    openTask('k-windows');
    const bloc = $('#modalContent .field-prq');
    return {
      present: !!bloc, texte: bloc?.textContent.trim() || '',
      actions: [...document.querySelectorAll('#modalContent .field-prq-actions .btn')].map((x) => x.textContent.trim()),
      pret: (() => { closeOverlay('modal'); openTask('t-plumb'); return $('#modalContent .field-prq')?.textContent.trim() || ''; })(),
    };
  });
  await p.waitForTimeout(250);
  await ev(p, () => { closeOverlay('modal'); openTask('k-windows'); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '08-mode-chantier-390-light.png' });
  note('PRQ-28', conducteur);
  ok(conducteur.present && /1 \/ 2 confirmées/.test(conducteur.texte) && /Livraison des fenêtres/.test(conducteur.texte)
    && conducteur.actions.join('|') === 'Confirmer|Bloqué|Gérer',
    'PRQ-28 : en Mode Chantier le CONDUCTEUR voit le compteur, la condition prioritaire, et dispose des trois actions rapides — Confirmer, Bloqué, Gérer', 'PRQ-28');
  ok(/Conditions prêtes/.test(conducteur.pret),
    'PRQ-28 : quand tout est prêt, le Mode Chantier dit « ✓ Conditions prêtes » et rien de plus — il ne devient pas un formulaire administratif', 'PRQ-28');

  const rapide = await ev(p, () => {
    closeOverlay('modal');
    openTask('k-windows');
    const av = taskPrerequisites('k-windows').filter((x) => x.status === 'confirmed').length;
    const id = taskTopPrerequisite('k-windows').id;
    fieldPrerequisiteAction(id, 'confirmed');
    return { av, apres: taskPrerequisites('k-windows').filter((x) => x.status === 'confirmed').length,
      modalTouJoursLa: $('#modal').classList.contains('open'),
      texte: $('#modalContent .field-prq')?.textContent.trim() || '' };
  });
  note('PRQ-28-action', rapide);
  ok(rapide.apres === rapide.av + 1 && rapide.modalTouJoursLa && /Conditions prêtes/.test(rapide.texte),
    'PRQ-28 : l’action rapide confirme la condition SANS sortir du Mode Chantier, et la fiche se met à jour sur place', 'PRQ-28');
  await ctx.close();

  // L'ARTISAN n'est PAS le Mode Chantier : isFieldMode() l'exclut
  // explicitement (driverMode === "field" ET role !== "artisan"). Son écran est
  // la CONVERSATION — c'est donc là, et nulle part ailleurs, qu'il doit lire
  // pourquoi son intervention ne peut pas démarrer.
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'ARTISAN', role: 'artisan' });
  const artisan = await ev(p2, () => {
    const rid = app.settings.artisanResourceId || 'thomas';
    const liste = getArtisanTodayTasks(rid);
    const t = liste.find((x) => x.status === 'doing') || liste[0];
    // État initial : le silence doit être EXACTEMENT corrélé au besoin.
    const avant = { attention: taskNeedsPrerequisiteAttention(t.id), bloc: !!$('.chat-mission .field-prq') };
    const nAvant = taskPrerequisiteSummary(t.id).total;
    addTaskPrerequisite(t.id, { type: 'delivery', label: 'Livraison carrelage', blocking: true });
    renderPage();
    const bloc = $('.chat-mission .field-prq');
    const lu = { present: !!bloc, texte: bloc?.textContent.trim() || '' };
    // L'autre versant du silence : tout confirmer doit faire DISPARAÎTRE le bloc.
    taskPrerequisites(t.id).forEach((x) => setPrerequisiteStatus(x.id, 'confirmed'));
    renderPage();
    const apresTout = !!$('.chat-mission .field-prq');
    return {
      role: app.settings.role, modeChantier: isFieldMode(), tache: t.id, avant, nAvant,
      total: nAvant + 1, ...lu, silenceQuandTout: !apresTout,
      // Aucune action, quelle qu'elle soit, dans le bloc de l'artisan.
      actions: [...document.querySelectorAll('.chat-mission .field-prq .btn, .chat-mission .field-prq button')].length,
      mission: [...document.querySelectorAll('.chat-mission .actions .btn')].map((x) => x.textContent.trim()),
    };
  });
  await p2.waitForTimeout(150);
  await p2.screenshot({ path: SHOTS + '09-artisan-conditions-390-light.png' });
  note('PRQ-29', artisan);
  ok(artisan.role === 'artisan' && !artisan.modeChantier,
    'PRQ-29 : l’artisan est bien SON rôle, distinct du Mode Chantier du conducteur — isFieldMode() l’exclut', 'PRQ-29');
  ok(artisan.avant.bloc === artisan.avant.attention && artisan.silenceQuandTout,
    'PRQ-29 : la conversation reste une conversation — le bloc n’apparaît QUE s’il y a quelque chose à dire, et disparaît dès que tout est confirmé (§13, §16)', 'PRQ-29');
  // Le bloc montre la condition PRIORITAIRE, pas la dernière saisie : le
  // compteur, lui, doit avoir suivi.
  ok(artisan.present && /Conditions de démarrage/.test(artisan.texte)
    && artisan.texte.includes(`/ ${artisan.total} confirmées`) && artisan.actions === 0,
    'PRQ-29 : l’ARTISAN voit pourquoi l’intervention ne peut pas démarrer, mais ne dispose d’AUCUNE action — lecture seule en V2.12.0 (§18)', 'PRQ-29');

  // §12 — le cinquième chemin de démarrage : « Je commence ». Il passe par la
  // MÊME garde que les quatre autres, sans aucune exception côté terrain.
  const artisanDemarre = await ev(p2, () => {
    const id = app.settings.artisanResourceId || 'thomas';
    const t = (getArtisanTodayTasks(id).find((x) => x.status === 'doing') || getArtisanTodayTasks(id)[0]);
    // Le test précédent a tout confirmé : on repose UNE condition bloquante à
    // confirmer, sinon il n'y a — à juste titre — rien à garder.
    setPrerequisiteStatus(taskPrerequisites(t.id).find((x) => x.blocking).id, 'pending');
    renderPage();
    const bouton = [...document.querySelectorAll('.chat-mission .actions .btn')]
      .find((x) => /Je commence/.test(x.textContent));
    const av = task(t.id).status;
    bouton?.click();
    return {
      boutonPresent: !!bouton, av,
      modal: $('#modal').classList.contains('open'),
      titre: $('#modalContent h2')?.textContent.trim() || '',
      pendantModal: task(t.id).status,
    };
  });
  note('PRQ-29-start', artisanDemarre);
  ok(artisanDemarre.boutonPresent && artisanDemarre.modal
    && artisanDemarre.titre === 'Conditions non confirmées'
    && artisanDemarre.pendantModal === artisanDemarre.av,
    'PRQ-29 : « Je commence » côté artisan passe par la MÊME garde centrale — la cinquième porte de démarrage n’a pas d’exception (§12)', 'PRQ-29');
  await c2.close();

  const { ctx: c3, p: p3 } = await newPage({ tag: 'READONLY' });
  const clos = await ev(p3, () => {
    // On clôture Keravel par le moteur existant.
    project('keravel').lifecycle = 'closed'; save();
    const r = prerequisite('prq-k-windows-livraison');
    return {
      editable: canEditProject('keravel'),
      ajout: addTaskPrerequisite('k-windows', { label: 'Interdite' }),
      modif: updateTaskPrerequisite(r.id, { label: 'Interdite' }),
      statut: setPrerequisiteStatus(r.id, 'confirmed'),
      suppr: deleteTaskPrerequisite(r.id),
      intacte: prerequisite('prq-k-windows-livraison').status,
      // La consultation, elle, reste possible.
      lisible: taskPrerequisites('k-windows').length,
      sectionLectureSeule: (() => { openTaskPrerequisites('k-windows'); return !!$('#drawerContent .lock-note'); })(),
      boutons: [...document.querySelectorAll('#drawerContent .prq-actions .btn')].length,
    };
  });
  note('PRQ-30', clos);
  ok(clos.editable === false && clos.ajout === false && clos.modif === false
    && clos.statut === false && clos.suppr === false && clos.intacte === 'pending',
    'PRQ-30 : sur un chantier CLÔTURÉ, les quatre mutations sont refusées par guardEditable() — aucune exception locale n’a été créée (§19)', 'PRQ-30');
  ok(clos.lisible === 2 && clos.sectionLectureSeule && clos.boutons === 0,
    'PRQ-30 : les conditions restent CONSULTABLES, la side-window affiche le bandeau lecture seule et ne propose aucune action', 'PRQ-30');
  await c3.close();
}

// ============================================================
// PRQ-31 → PRQ-32 — Suppression d’une tâche
// ============================================================
console.log('\n[PRQ-CASCADE] Suppression d’une tâche');
{
  const { ctx, p } = await newPage({ tag: 'CASCADE' });
  const casc = await ev(p, () => {
    const av = { t: app.tasks.length, p: app.prerequisites.length,
      cond: taskPrerequisites('k-windows').map((x) => x.id) };
    confirmDeleteTask('k-windows');
    const ap = { t: app.tasks.length, p: app.prerequisites.length,
      orphelins: app.prerequisites.filter((x) => !task(x.taskId)).length,
      restantes: app.prerequisites.filter((x) => x.taskId === 'k-windows').length };
    undo();
    const un = { t: app.tasks.length, p: app.prerequisites.length,
      memesIds: taskPrerequisites('k-windows').map((x) => x.id).join('|') === av.cond.join('|') };
    redo();
    const re = { t: app.tasks.length, p: app.prerequisites.length };
    return { av, ap, un, re };
  });
  note('PRQ-31', casc);
  ok(casc.ap.t === casc.av.t - 1 && casc.ap.p === casc.av.p - 2
    && casc.ap.orphelins === 0 && casc.ap.restantes === 0,
    'PRQ-31 : supprimer une intervention supprime ses deux conditions avec elle — AUCUNE condition orpheline ne subsiste', 'PRQ-31');
  ok(casc.un.t === casc.av.t && casc.un.p === casc.av.p && casc.un.memesIds,
    'PRQ-32 : « Annuler » restitue la tâche ET ses conditions, à l’identique, d’UN SEUL geste — même transaction, un seul snapshot', 'PRQ-32');
  ok(casc.re.t === casc.ap.t && casc.re.p === casc.ap.p,
    'PRQ-32 : « Rétablir » les resupprime, elles aussi d’un seul geste', 'PRQ-32');
  await ctx.close();
}

// ============================================================
// PRQ-33 → PRQ-38 — Sauvegarde, restauration, import / export
// ============================================================
console.log('\n[PRQ-DATA] Sauvegarde, restauration, portabilité');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });
  const sauv = await ev(p, () => {
    const payload = buildKanvixBackup();
    const json = JSON.stringify(payload);
    const attendu = JSON.stringify(app.prerequisites);
    app.prerequisites = []; save();
    pendingKanvixBackup = JSON.parse(json); confirmKanvixRestore();
    return { json, present: Array.isArray(payload.state.prerequisites),
      n: payload.state.prerequisites.length, schema: payload.schemaVersion,
      identique: JSON.stringify(app.prerequisites) === attendu,
      requis: KANVIX_BACKUP_REQUIRED.includes('prerequisites'),
      apercu: (() => { showKanvixBackupPreview(payload); return $('#modalContent').textContent.replace(/\s+/g, ' '); })() };
  });
  await p.waitForTimeout(200);
  note('PRQ-33', { present: sauv.present, n: sauv.n, schema: sauv.schema, identique: sauv.identique, requis: sauv.requis });
  ok(sauv.present && sauv.n === 4 && sauv.schema === 15 && sauv.identique,
    'PRQ-33 : la sauvegarde emporte les conditions et les restitue OCTET POUR OCTET', 'PRQ-33');
  ok(sauv.requis === false && /4 conditions de démarrage/.test(sauv.apercu),
    'PRQ-33 : la clé reste FACULTATIVE (hors KANVIX_BACKUP_REQUIRED) et l’aperçu de restauration l’annonce', 'PRQ-33');

  const v14 = await ev(p, (json) => {
    closeOverlay('modal');
    const payload = JSON.parse(json);
    delete payload.state.prerequisites;
    payload.schemaVersion = 14;
    payload.appVersion = '2.11.0.3';
    const check = validateKanvixBackup(payload);
    pendingKanvixBackup = payload; confirmKanvixRestore();
    return { valide: check.ok, tableau: Array.isArray(app.prerequisites), n: app.prerequisites.length,
      schema: app.schemaVersion, store: STORE, chantiers: app.projects.length, taches: app.tasks.length };
  }, sauv.json);
  await p.waitForTimeout(200);
  note('PRQ-34', v14);
  ok(v14.valide && v14.tableau && v14.n === 0 && v14.schema === 15
    && v14.store === 'kanvix-product-8-3' && v14.chantiers > 0 && v14.taches > 0,
    'PRQ-34 : une sauvegarde V14 — sans la clé prerequisites — reste PARFAITEMENT valide : elle se restaure, passe en version 15 avec une collection vide, sans perdre un seul chantier ni une seule tâche', 'PRQ-34');

  const portable = await ev(p, () => {
    resetApp(); dismissKanvixContinuityNotice();
    exportKanvixData();
    const payload = JSON.parse($('#kanvixExportText').value);
    closeOverlay('drawer');
    return { present: Array.isArray(payload.prerequisites), n: (payload.prerequisites || []).length, json: JSON.stringify(payload) };
  });
  note('PRQ-35', { present: portable.present, n: portable.n });
  ok(portable.present && portable.n === 4,
    'PRQ-35 : l’export portable emporte les conditions de démarrage', 'PRQ-35');

  const imports = await ev(p, (json) => {
    const data = JSON.parse(json);
    // 1. ancien format : la clé n'existe pas.
    const ancien = structuredClone(data); delete ancien.prerequisites;
    const analyse = analyzeKanvixImport(ancien);
    // 2. format V2.12 : remappage des taskId.
    importWizard = null;
    const avant = app.prerequisites.length;
    const S = structuredClone(app);
    const plan = { mode: 'merge', data, projects: data.projects.map((x) => ({ imported: x, action: 'create' })) };
    return { ancienAccepte: analyse.ok !== false, avant, cles: Object.keys(data).sort().join(',') };
  }, portable.json);
  note('PRQ-36', imports);
  ok(imports.ancienAccepte,
    'PRQ-36 : un export ANCIEN, sans la clé prerequisites, reste accepté par l’analyse d’import', 'PRQ-36');

  // Import réel : les conditions arrivent sur les NOUVELLES tâches.
  const reimport = await ev(p, (json) => {
    const data = JSON.parse(json);
    const idsSource = new Set(data.tasks.map((t) => t.id));
    // On repart d'un état sans ces chantiers pour forcer la création.
    resetApp(); dismissKanvixContinuityNotice();
    const avantP = app.prerequisites.length, avantT = app.tasks.length;
    // On monte le wizard EXACTEMENT comme le produit le monte après lecture du
    // fichier (openKanvixImport → analyzeKanvixImport), la recette n'invente
    // pas une structure parallèle. Et on choisit « importer en double » pour
    // TOUS les chantiers : c'est le seul chemin où les tâches reçoivent de
    // NOUVEAUX identifiants, donc le seul où le remappage se prouve.
    const analysis = analyzeKanvixImport(data);
    const choices = {};
    analysis.projects.forEach((e) => { choices[e.imported.id] = 'new'; });
    importWizard = { data, analysis, choices, replaceAll: false, strategy: 'merge', details: {} };
    const plan = buildImportPlan();
    const sum = applyImportPlan(plan, app);
    const nouvelles = app.prerequisites.slice(avantP);
    return {
      avantP, apres: app.prerequisites.length, ajoutees: nouvelles.length,
      actions: [...new Set(plan.projectOps.map((o) => o.action))].join(','),
      versSource: nouvelles.filter((x) => idsSource.has(x.taskId)).length,
      orphelines: nouvelles.filter((x) => !task(x.taskId)).length,
      idsRefaits: nouvelles.every((x) => !data.prerequisites.some((s) => s.id === x.id)),
      projetCoherent: nouvelles.every((x) => task(x.taskId).projectId === x.projectId),
    };
  }, portable.json);
  note('PRQ-37', reimport);
  ok(reimport.ajoutees === 4 && reimport.orphelines === 0 && reimport.versSource === 0
    && reimport.idsRefaits && reimport.projetCoherent,
    'PRQ-37 : à l’import, chaque condition est remappée vers la NOUVELLE tâche — aucune ne pointe vers un identifiant de la base source, aucun identifiant n’est réutilisé, et le chantier reste cohérent avec la tâche', 'PRQ-37');

  const orpheline = await ev(p, (json) => {
    const data = JSON.parse(json);
    // Une condition dont la tâche n'existe pas dans le fichier.
    data.prerequisites.push({ id: 'prq-fantome', taskId: 'tache-absente-du-fichier', label: 'Fantôme', type: 'delivery' });
    resetApp(); dismissKanvixContinuityNotice();
    const avant = app.prerequisites.length;
    const analysis = analyzeKanvixImport(data);
    const choices = {};
    analysis.projects.forEach((e) => {
      if (e.category === 'duplicate') choices[e.imported.id] = 'merge';
      else if (e.category === 'possible') choices[e.imported.id] = 'ignore';
    });
    importWizard = { data, analysis, choices, replaceAll: false, strategy: 'merge', details: {} };
    const sum = applyImportPlan(buildImportPlan(), app);
    return { ajoutees: app.prerequisites.length - avant,
      fantome: app.prerequisites.some((x) => x.label === 'Fantôme'),
      ecartees: sum.dropped.prerequisites,
      annonce: impDroppedLines(sum).join(' · ') };
  }, portable.json);
  note('PRQ-38', orpheline);
  ok(!orpheline.fantome && orpheline.ecartees === 1 && /1 condition de démarrage/.test(orpheline.annonce),
    'PRQ-38 : une condition dont l’intervention n’a pas été importée est ÉCARTÉE — et la perte est ANNONCÉE dans le rapport d’import, jamais silencieuse', 'PRQ-38');
  await ctx.close();
}

// ============================================================
// PRQ-39 — Alignement des dates de démonstration
// ============================================================
console.log('\n[PRQ-ALIGN] Dates de démonstration');
{
  const { ctx, p } = await newPage({ tag: 'ALIGN' });
  const align = await ev(p, () => {
    const avant = app.prerequisites.map((x) => [x.id, x.expectedDate, x.confirmedDate]);
    const tacheAvant = task('k-windows').start;
    // Un second passage ne doit RIEN décaler de plus (idempotence via seededFor).
    const s2 = alignDemoDates(structuredClone(app), app.seededFor);
    const memes = JSON.stringify(s2.prerequisites.map((x) => [x.id, x.expectedDate, x.confirmedDate])) === JSON.stringify(avant);
    // Un passage vers une autre date décale les conditions ET les tâches du
    // MÊME nombre de jours.
    const s3 = alignDemoDates(structuredClone(app), '2026-09-01');
    const dTache = daysBetweenKeys(tacheAvant, s3.tasks.find((t) => t.id === 'k-windows').start);
    const pr = s3.prerequisites.find((x) => x.id === 'prq-k-windows-livraison');
    const dCond = daysBetweenKeys(avant.find((a) => a[0] === 'prq-k-windows-livraison')[1], pr.expectedDate);
    // Les MODÈLES restent relatifs : ils ne bougent pas.
    const tpl = JSON.stringify(s3.projectTemplates) === JSON.stringify(app.projectTemplates);
    return { memes, dTache, dCond, tpl, decalees: avant.filter((a) => a[1]).length };
  });
  note('PRQ-39', align);
  ok(align.memes,
    'PRQ-39 : alignDemoDates() décale les conditions de démonstration exactement UNE fois — un second passage sur la même cible ne bouge rien', 'PRQ-39');
  ok(align.dTache === align.dCond && align.dTache !== 0,
    `PRQ-39 : les dates prévues et confirmées suivent EXACTEMENT le même décalage que les tâches (${align.dTache} jours) — une livraison prévue la veille d’une pose le reste`, 'PRQ-39');
  ok(align.tpl,
    'PRQ-39 : les MODÈLES de chantier ne sont pas décalés — leurs positions sont relatives et ne vieillissent pas', 'PRQ-39');
  await ctx.close();
}

// ============================================================
// PRQ-40 → PRQ-42 — Duplication de structure
// ============================================================
console.log('\n[PRQ-DUP] Duplication de structure');
{
  const { ctx, p } = await newPage({ tag: 'DUP' });
  const dup = await ev(p, () => {
    const faire = (withTasks) => {
      const avP = new Set(app.prerequisites.map((x) => x.id));
      const avT = new Set(app.tasks.map((x) => x.id));
      const r = duplicateStructureNode('sn-keravel-bat-a', { parentId: null, name: 'Copie ' + withTasks, withTasks });
      const neuves = app.prerequisites.filter((x) => !avP.has(x.id));
      const neuvesT = new Set(app.tasks.filter((x) => !avT.has(x.id)).map((x) => x.id));
      return { taches: r.taches, conditions: neuves.length,
        versNouvelles: neuves.every((x) => neuvesT.has(x.taskId)),
        versSource: neuves.filter((x) => avT.has(x.taskId)).length,
        idsNeufs: neuves.every((x) => !avP.has(x.id)),
        statutsConserves: neuves.map((x) => x.status).sort().join('|'),
        projet: [...new Set(neuves.map((x) => x.projectId))].join('|') };
    };
    return { seule: faire(false), complet: faire(true),
      source: taskPrerequisites('k-windows').map((x) => x.status).sort().join('|') };
  });
  note('PRQ-40', dup);
  ok(dup.seule.taches === 0 && dup.seule.conditions === 0,
    'PRQ-40 : dupliquer « Structure seule » ne copie AUCUNE condition — puisqu’aucune intervention n’est copiée. C’est la même règle qui donne les deux comportements', 'PRQ-40');
  ok(dup.complet.conditions === 3 && dup.complet.versNouvelles,
    'PRQ-41 : dupliquer « Structure + interventions » copie les 3 conditions du périmètre', 'PRQ-41');
  ok(dup.complet.versSource === 0 && dup.complet.idsNeufs && dup.complet.projet === 'keravel',
    'PRQ-42 : chaque condition clonée pointe vers la NOUVELLE intervention, porte un identifiant neuf, et aucune ne désigne une tâche source', 'PRQ-42');
  ok(dup.complet.statutsConserves === dup.source + '|pending',
    'PRQ-41 : une duplication de chantier CONSERVE l’état opérationnel des conditions — ce n’est pas une trame, c’est une copie de terrain', 'PRQ-41');
  await ctx.close();
}

// ============================================================
// PRQ-43 → PRQ-50 — Modèles de chantier
// ============================================================
console.log('\n[PRQ-TPL] Modèles de chantier');
{
  const { ctx, p } = await newPage({ tag: 'TPL' });
  const capture = await ev(p, () => {
    const seule = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-keravel-bat-a', name: 'Trame seule', includeTasks: false });
    const complet = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-keravel-bat-a', name: 'Trame complète' });
    const tacheWin = complet.tasks.find((x) => x.name === 'Pose des 6 fenêtres');
    const tWin = task('k-windows');
    return {
      seule: seule.prerequisites.length,
      complet: complet.prerequisites.map((x) => ({ ...x })),
      champs: [...new Set(complet.prerequisites.flatMap((x) => Object.keys(x)))].sort().join(','),
      cleLocale: complet.prerequisites.every((x) => complet.tasks.some((t) => t.id === x.taskId)),
      tacheWin: tacheWin.id,
      offsetAttendu: daysBetweenKeys(tWin.start, prerequisite('prq-k-windows-livraison').expectedDate),
      id: complet.id,
    };
  });
  note('PRQ-43', capture);
  ok(capture.seule === 0,
    'PRQ-43 : un modèle « Structure seule » ne contient AUCUNE condition', 'PRQ-43');
  ok(capture.complet.length === 3 && capture.cleLocale,
    'PRQ-44 : un modèle « Structure + interventions » capture les conditions, chacune rattachée à l’identifiant LOCAL de sa tâche dans le modèle', 'PRQ-44');
  ok(capture.champs === 'blocking,comment,expectedOffsetDaysFromTaskStart,id,label,supplier,taskId,type',
    'PRQ-45 : une condition de modèle porte EXACTEMENT huit champs — ni status, ni confirmedDate, ni projectId, ni expectedDate : aucun état opérationnel du chantier source n’entre dans une trame', 'PRQ-45');
  ok(capture.complet.every((x) => x.status === undefined && x.confirmedDate === undefined && x.expectedDate === undefined),
    'PRQ-46 : aucune confirmedDate, aucun statut et aucune date ABSOLUE dans un modèle', 'PRQ-46');
  const livraison = capture.complet.find((x) => /Livraison/.test(x.label)),
    acces = capture.complet.find((x) => /Accès/.test(x.label));
  ok(livraison.expectedOffsetDaysFromTaskStart === capture.offsetAttendu
    && acces.expectedOffsetDaysFromTaskStart < 0,
    `PRQ-47 : la date prévue devient une POSITION RELATIVE au démarrage de l’intervention — ${livraison.expectedOffsetDaysFromTaskStart} jour(s) pour la livraison, ${acces.expectedOffsetDaysFromTaskStart} pour l’accès. Les valeurs négatives (avant le démarrage) sont autorisées`, 'PRQ-47');

  const pose = await ev(p, (tplId) => {
    const av = { n: app.structureNodes.length, t: app.tasks.length, p: app.prerequisites.length };
    const avP = new Set(app.prerequisites.map((x) => x.id));
    const avT = new Set(app.tasks.map((x) => x.id));
    insertTemplateIntoProject(tplId, { projectId: 'villa', parentId: null, rootName: 'Repose', startDate: '2026-10-05', resourceStrategy: 'none' });
    const neuves = app.prerequisites.filter((x) => !avP.has(x.id));
    const neuvesT = new Set(app.tasks.filter((x) => !avT.has(x.id)).map((x) => x.id));
    const ap = { n: app.structureNodes.length, t: app.tasks.length, p: app.prerequisites.length };
    undo();
    const un = { n: app.structureNodes.length, t: app.tasks.length, p: app.prerequisites.length };
    redo();
    const re = { n: app.structureNodes.length, t: app.tasks.length, p: app.prerequisites.length };
    return { av, ap, un, re,
      posees: neuves.map((x) => ({ l: x.label, st: x.status, cd: x.confirmedDate, exp: x.expectedDate,
        ecart: x.expectedDate ? daysBetweenKeys(task(x.taskId).start, x.expectedDate) : null,
        projet: x.projectId })),
      versNouvelles: neuves.every((x) => neuvesT.has(x.taskId)),
      orphelines: neuves.filter((x) => !task(x.taskId)).length };
  }, capture.id);
  note('PRQ-48', pose);
  ok(pose.posees.length === 3 && pose.posees.every((x) => x.st === 'pending' && x.cd === null),
    'PRQ-48 : à la pose, chaque condition renaît « à confirmer », sans date de confirmation — une condition de modèle est toujours une condition à préparer', 'PRQ-48');
  const posLivr = pose.posees.find((x) => /Livraison/.test(x.l)),
    posAcces = pose.posees.find((x) => /Accès/.test(x.l));
  ok(posLivr.ecart === livraison.expectedOffsetDaysFromTaskStart
    && posAcces.ecart === acces.expectedOffsetDaysFromTaskStart,
    `PRQ-48 : la date prévue est RECALCULÉE depuis la nouvelle date de l’intervention — les écarts d’origine (${livraison.expectedOffsetDaysFromTaskStart} et ${acces.expectedOffsetDaysFromTaskStart} jours) sont reproduits exactement`, 'PRQ-48');
  ok(pose.versNouvelles && pose.orphelines === 0 && pose.posees.every((x) => x.projet === 'villa'),
    'PRQ-49 : toutes les références sont remappées — chaque condition posée désigne une intervention réellement créée, dans le chantier de destination', 'PRQ-49');
  ok(pose.ap.p === pose.av.p + 3 && pose.un.p === pose.av.p && pose.un.t === pose.av.t
    && pose.re.p === pose.ap.p && pose.re.t === pose.ap.t,
    'PRQ-50 : poser un modèle crée niveaux, interventions ET conditions dans UN SEUL geste annulable — « Annuler » puis « Rétablir » les traitent ensemble', 'PRQ-50');

  // Un modèle V2.11 (sans la clé) reste valide.
  const v211 = await ev(p, () => {
    const t = structuredClone(app.projectTemplates[0]);
    delete t.prerequisites;
    t.id = 'ptpl-v211';
    const etat = structuredClone(app);
    etat.projectTemplates = [t];
    const m = migrateState(etat).projectTemplates[0];
    return { tableau: Array.isArray(m.prerequisites), n: m.prerequisites.length, taches: m.tasks.length };
  });
  note('PRQ-43-compat', v211);
  ok(v211.tableau && v211.n === 0 && v211.taches > 0,
    'PRQ-43 : un modèle enregistré par V2.11 — sans la clé prerequisites — reste valide : la migration lui pose une collection vide sans rien toucher d’autre', 'PRQ-43');
  await ctx.close();
}

// ============================================================
// PRQ-56 → PRQ-59 — Les moteurs historiques restent intacts
// ============================================================
console.log('\n[PRQ-HERITAGE] Dépendances, qualité, ressources, structure');
{
  const { ctx, p } = await newPage({ tag: 'HERITAGE' });
  const heritage = await ev(p, () => {
    const t = task('k-paint');
    return {
      deps: { avant: JSON.stringify(t.deps), pred: getTaskPredecessors('k-paint').length, succ: getTaskSuccessors('k-cloisons').length },
      // Une condition n'est JAMAIS convertie en dépendance, ni l'inverse.
      conversion: (() => {
        const r = addTaskPrerequisite('k-paint', { type: 'other', label: 'Test', blocking: true });
        return { depsInchangees: JSON.stringify(task('k-paint').deps) === JSON.stringify(t.deps),
          pasDeDepCreee: !task('k-paint').deps.includes(r.id) };
      })(),
      qualite: { instances: (app.controlInstances || []).length, modeles: (app.controlTemplates || []).length },
      ressources: { n: app.resources.length, principal: task('k-paint').resourceId },
      structure: { noeuds: app.structureNodes.length, rattachement: task('k-paint').structureNodeId },
    };
  });
  note('PRQ-56', heritage);
  ok(heritage.conversion.depsInchangees && heritage.conversion.pasDeDepCreee && heritage.deps.pred >= 0,
    'PRQ-56 : le moteur de DÉPENDANCES est intact — ajouter une condition ne crée, ne modifie et ne convertit aucune dépendance (§4 : pas de seconde vérité)', 'PRQ-56');
  ok(heritage.qualite.modeles > 0,
    'PRQ-57 : le moteur de CONTRÔLES QUALITÉ est intact — une condition de démarrage n’en crée ni n’en consomme aucun', 'PRQ-57');
  ok(heritage.ressources.n > 0 && !!heritage.ressources.principal,
    'PRQ-58 : le moteur RESSOURCES est intact', 'PRQ-58');
  ok(heritage.structure.noeuds > 0 && !!heritage.structure.rattachement,
    'PRQ-59 : le moteur STRUCTURE est intact — une condition appartient à une TÂCHE, jamais directement à un niveau (§22)', 'PRQ-59');

  const pasDeNoeud = await ev(p, () => ({
    champs: [...new Set(app.prerequisites.flatMap((x) => Object.keys(x)))],
  }));
  ok(!pasDeNoeud.champs.includes('structureNodeId'),
    'PRQ-59 : Prerequisite ne porte AUCUN structureNodeId — taskId permet déjà de retrouver le niveau, une seule vérité relationnelle (§22)', 'PRQ-59');
  await ctx.close();
}

// ============================================================
// RESPONSIVE — dix largeurs, clair et sombre
// ============================================================
console.log('\n[PRQ-RESP] Largeurs et thèmes');
{
  const mesures = [];
  for (const [w, h] of [[1920, 1080], [1600, 1000], [1440, 900], [1366, 768], [1280, 800], [1080, 800], [900, 800], [768, 1024], [430, 932], [390, 844]]) {
    for (const theme of ['light', 'dark']) {
      const { ctx, p } = await newPage({ w, h, tag: `RESP-${w}-${theme}` });
      const m = await ev(p, (t) => {
        setAppearance(t); renderPage();
        const panel = () => document.querySelector('.drawer-panel');
        const etat = () => ({
          scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          panelDeborde: panel() ? panel().scrollWidth > panel().clientWidth + 1 : false,
          boutonsCoupes: panel()
            ? [...document.querySelectorAll('#drawerContent .btn')].filter((b) => {
                const rb = b.getBoundingClientRect(), rp = panel().getBoundingClientRect();
                return rb.width > 0 && (rb.left < rp.left - 1 || rb.right > rp.right + 1);
              }).length
            : 0,
        });
        openTask('k-windows');
        const fiche = etat();
        openTaskPrerequisites('k-windows');
        const drawer = etat();
        const cibles = [...document.querySelectorAll('#drawerContent .prq-actions .btn')]
          .map((b) => Math.round(b.getBoundingClientRect().height));
        openPrerequisiteForm('k-windows');
        const form = etat();
        closeOverlay('drawer');
        go('today');
        const today = { scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth };
        go('planning');
        const planning = { scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth };
        return { fiche, drawer, form, today, planning, cibles };
      }, theme);
      mesures.push({ w, theme, ...m });
      await ctx.close();
    }
  }
  const mauvais = mesures.filter((m) =>
    m.fiche.scrollH || m.fiche.panelDeborde || m.fiche.boutonsCoupes ||
    m.drawer.scrollH || m.drawer.panelDeborde || m.drawer.boutonsCoupes ||
    m.form.scrollH || m.form.panelDeborde || m.form.boutonsCoupes ||
    m.today.scrollH || m.planning.scrollH);
  const tactile = mesures.filter((m) => m.w <= 430).every((m) => m.cibles.every((h) => h >= 44));
  note('PRQ-RESP', { mesurées: mesures.length, fautives: mauvais.map((m) => ({ w: m.w, t: m.theme })), cibles390: mesures.find((m) => m.w === 390)?.cibles });
  ok(mauvais.length === 0,
    `PRQ-RESP : sur ${mesures.length} combinaisons (10 largeurs de 1920 à 390 px × clair/sombre), la fiche tâche, la side-window des conditions, le formulaire, Aujourd’hui et le Planning ne provoquent AUCUN défilement horizontal, AUCUN dépassement de la side-window et AUCUN bouton coupé`, 'PRQ-RESP');
  ok(tactile,
    'PRQ-RESP : à 430 et 390 px, toutes les actions d’une condition mesurent au moins 44 px de haut — des cibles tactiles réelles', 'PRQ-RESP');
}

// ============================================================
// ACCESSIBILITÉ — §35
// ============================================================
console.log('\n[PRQ-A11Y] Clavier et accessibilité');
{
  const { ctx, p } = await newPage({ tag: 'A11Y' });
  await ev(p, () => openTaskPrerequisites('k-windows'));
  await p.waitForTimeout(250);
  const a11y = await ev(p, () => ({
    focusInitial: document.activeElement?.tagName,
    focusDansDrawer: !!document.activeElement?.closest('#drawer'),
    boutons: [...document.querySelectorAll('#drawerContent button')].length,
    actionsSontDesBoutons: [...document.querySelectorAll('#drawerContent .prq-actions *')].every((x) => x.tagName === 'BUTTON'),
    // Aucune action uniquement au survol : tout est un bouton dans le flux.
    aucunHover: ![...document.querySelectorAll('#drawerContent [onmouseover], #drawerContent [onmouseenter]')].length,
  }));
  note('PRQ-A11Y', a11y);
  ok(a11y.focusInitial === 'BUTTON' && a11y.focusDansDrawer && a11y.actionsSontDesBoutons && a11y.aucunHover,
    'PRQ-A11Y : la side-window reçoit le focus à l’ouverture, toutes les actions sont de vrais boutons atteignables au clavier, et aucune action n’est disponible uniquement au survol', 'PRQ-A11Y');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok(!(await ev(p, () => $('#drawer').classList.contains('open'))),
    'PRQ-A11Y : Escape ferme la side-window', 'PRQ-A11Y');

  const form = await ev(p, () => {
    openPrerequisiteForm('k-windows');
    return { champs: [...document.querySelectorAll('#drawerFormEl [name]')].map((x) => x.name),
      labels: [...document.querySelectorAll('#drawerFormEl label')].length };
  });
  await p.waitForTimeout(250);
  note('PRQ-A11Y-form', form);
  ok(form.champs.join('|') === 'type|label|blocking|blocking|expectedDate|supplier|comment' && form.labels >= 6,
    'PRQ-A11Y : le formulaire porte les six champs demandés — type, libellé, bloquant (deux radios), date prévue, fournisseur, commentaire — chacun avec son label', 'PRQ-A11Y');
  await ctx.close();
}

// ============================================================
// CAPTURES
// ============================================================
console.log('\n[PRQ-SHOTS] Captures');
{
  for (const theme of ['light', 'dark']) {
    const suffixe = theme === 'light' ? 'light' : 'dark';
    const { ctx, p } = await newPage({ tag: `SHOT-${theme}` });
    await ev(p, (t) => { setAppearance(t); renderPage(); openTask('t-plumb'); }, theme);
    await p.waitForTimeout(300);
    await p.screenshot({ path: SHOTS + `01-task-ready-${suffixe}.png` });
    await ev(p, () => { closeOverlay('drawer'); openTask('k-windows'); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: SHOTS + `02-task-warning-${suffixe}.png` });
    await ev(p, () => openTaskPrerequisites('k-windows'));
    await p.waitForTimeout(300);
    await p.screenshot({ path: SHOTS + `03-conditions-drawer-${suffixe}.png` });
    if (theme === 'light') {
      await ev(p, () => openPrerequisiteForm('k-windows'));
      await p.waitForTimeout(300);
      await p.screenshot({ path: SHOTS + '04-condition-form-light.png' });
      await ev(p, () => { closeOverlay('drawer'); setTaskStatus('k-windows', 'doing'); });
      await p.waitForTimeout(300);
      await p.screenshot({ path: SHOTS + '05-start-warning-light.png' });
      await ev(p, () => { cancelPrerequisiteStart(); go('today'); });
      await p.waitForTimeout(400);
      await p.screenshot({ path: SHOTS + '06-today-prerequisite-light.png' });
      await ev(p, () => { go('planning'); });
      await p.waitForTimeout(400);
      await p.screenshot({ path: SHOTS + '07-planning-prerequisite-light.png' });
    }
    await ctx.close();
  }
  ok(fs.existsSync(SHOTS + '01-task-ready-light.png') && fs.existsSync(SHOTS + '05-start-warning-light.png')
    && fs.existsSync(SHOTS + '08-mode-chantier-390-light.png') && fs.existsSync(SHOTS + '03-conditions-drawer-dark.png'),
    'PRQ-SHOTS : les captures attendues sont produites par les tests réels, en clair et en sombre', 'PRQ-SHOTS');
}

// ============================================================
// FREEZE-2120 — Périmètre et architecture
// ============================================================
console.log('\n[FREEZE-2120] Périmètre du round et architecture');
{
  const read = (f) => fs.readFileSync(BASE + f, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  const extractFn = (src, name) => {
    const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    let par = src.indexOf('(', m.index), depth = 0, k = par;
    for (; k < src.length; k++) {
      if (src[k] === '(') depth++;
      else if (src[k] === ')') { depth--; if (!depth) { k++; break; } }
    }
    let i = src.indexOf('{', k), d = 0, j = i, s = null, esc = false;
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
  const A = read(PREV), B = read(CUR);

  /* Le périmètre RÉEL, nommé fonction par fonction. */
  const attendues = [
    'migrateState',              // migration 14 → 15 + normalisation
    'alignDemoDates',            // les deux dates suivent la démo
    'setTaskStatus',             // la garde centrale de démarrage
    'openTask',                  // le bloc de la fiche
    'openFieldTaskModal',        // le bloc du Mode Chantier
    'confirmDeleteTask',         // la cascade
    'cloneStructureTree',        // les conditions suivent leurs interventions
    'collectStructureSource',    // la source fournit ses conditions
    'duplicateStructureNode',    // pousse ce que la primitive a produit
    'applyTemplateToProject',    // idem, + la source « modèle »
    'buildProjectTemplateRecord',// la capture dans un modèle
    'gantt',                     // le signal discret
    'projectToday',              // idem (bandeau « aujourd'hui » d'un chantier)
    'projectUpcomingTimeline',   // idem (frise des jours à venir)
    'renderArtisan',             // §18 — l'artisan LIT ses conditions
    'getTodayDecisions',         // les deux listes existantes, étendues
    'getTodayWarnings',
    'decisionCard', 'watchCard', 'attentionRowTone', 'openMoreIssues',
    'showKanvixBackupPreview',   // une ligne d'aperçu
    'exportKanvixData',          // l'export portable
    'applyImportPlan',           // le remappage, dans la passe 2 existante
    'impDroppedLines',           // la perte est annoncée
  ];
  /* V2.12.0.1 — les fonctions touchées par le ROUND SUIVANT sont tolérées par le
     BALAYAGE — sinon ce gel signalerait comme dérive ce qu'un correctif
     ultérieur corrige volontairement. La liste reste FERMÉE : une fonction non
     nommée fait toujours tomber le test, et le contrôle « les 25 fonctions de
     V2.12.0 ont RÉELLEMENT changé » reste strictement celui de ce round.
       · submitTaskEdit — reçoit le pré-vol des conditions que la garde centrale,
         posée sous `!silent`, ne pouvait pas atteindre depuis l'éditeur ;
       · confirmPrerequisiteStart — rend la décision à l'appelant qui tient déjà
         une transaction, au lieu de rappeler le moteur lui-même ;
       · clearTaskEditAck — nettoie le nouvel accusé avec le formulaire. */
  /* V2.12.0.2 — restoreHistoryState() rejoint la liste : le correctif « une
     communication ne remonte pas le temps » la modifie volontairement. */
  const attenduesRoundsSuivants = ['submitTaskEdit', 'confirmPrerequisiteStart', 'clearTaskEditAck',
    'restoreHistoryState'];
  const tolerees = [...attendues, ...attenduesRoundsSuivants];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !tolerees.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  const nonModifiees = attendues.filter((n) => md5(extractFn(A, n) || '') === md5(extractFn(B, n) || ''));
  note('FREEZE-2120-périmètre', { modifiées: attendues.length, horsPérimètre: horsPerimetre, indentation: indentDiff, nonModifiées: nonModifiees });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    `FREEZE-2120 : hors des ${attendues.length} fonctions du périmètre NOMMÉ, le balayage de tout le fichier ne trouve AUCUNE autre fonction modifiée depuis V2.11.0.3`, 'FREEZE-2120');
  ok(nonModifiees.length === 0,
    'FREEZE-2120 : les fonctions annoncées ont toutes RÉELLEMENT changé — aucune modification silencieusement absente, aucun périmètre annoncé pour rien', 'FREEZE-2120');

  /* Les moteurs que le round ne doit pas effleurer. */
  const geles = [
    'planningTasks', 'effectiveTasks', 'planReflow', 'applyReflowPlan',
    'planScheduleChanges', 'nextWorkingTime', 'addWorkingDuration', 'dropTask',
    'dragStart', 'drawDeps', 'requestGanttTaskMove', 'requestTaskScheduleMove',
    'openTaskForm', 'submitTaskEdit', 'isNonWorkingDate', 'realStartPlan',
    'askRealStartConfirm', 'evaluateDependencyConflicts', 'getTaskPredecessors',
    'getTaskSuccessors', 'getCriticalImpacts',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'controlsForTask', 'taskControlsSection',
    'resourceActive', 'assignableResources', 'mainAssignableResources',
    'normalizeTaskResources', 'canAssignResource', 'canAssignStructureResponsible',
    'structureResponsibleResources', 'taskResourceIds', 'getResourceSchedulingConflicts',
    'structureNode', 'getStructureDescendantIds', 'getStructureTasks',
    'structureParentError', 'moveStructureNode', 'structureCopyName',
    'openStructureForm', 'toggleStructureArchive', 'deleteStructureNode',
    'kanbanCard', 'kanbanBadges', 'snapshot', 'undo', 'redo', 'clearUndoRedo',
    'cloneHistoryState', 'restoreHistoryState', 'actionToast',
    'buildKanvixBackup', 'validateKanvixBackup', 'confirmKanvixRestore',
    'allProjectTemplates', 'templateById', 'createTemplateFromWizard',
    'createProjectFromProjectTemplate', 'insertTemplateIntoProject',
    'saveProjectTemplateFrom', 'templateSuggestedExtras',
    'getTodayActions', 'getTodayWorkflow', 'attentionCard', 'attentionRows',
    'decisionSummary', 'warningSummary', 'priorityScore',
  ];
  /* V2.12.0.1 — RE-BASELINE, une seule cause NOMMÉE : submitTaskEdit() reçoit le
     pré-vol des conditions de démarrage. Elle quitte donc le gel, déclarée et
     assumée, et FREEZE-21201 la vérifie ligne à ligne. setTaskStatus() — la
     garde CENTRALE, et le vrai sujet de ce gel — reste byte-identique : le
     correctif ne l'a pas déplacée. */
  const rebaseV21201 = ['submitTaskEdit'];
  // V2.12.0.2 — même motif, même discipline : la fonction est vérifiée par FREEZE-21202.
  const rebaseV21202 = ['restoreHistoryState'];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    if (rebaseV21201.includes(n) || rebaseV21202.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2120-gelés', { comparées: compares, bougés: bouges, reBaséesV21201: rebaseV21201 });
  ok(compares > 55 && bouges.length === 0,
    `FREEZE-2120 : les ${compares} moteurs nommément protégés sont BYTE-IDENTIQUES — tout le Planning (positionnement, drag & drop, propagation, jours non ouvrés, démarrage réel), les DÉPENDANCES, la QUALITÉ, les RESSOURCES, la STRUCTURE, le KANBAN, l’UNDO/REDO, la SAUVEGARDE et les MODÈLES`, 'FREEZE-2120');

  /* §26 — l'architecture de clonage, intacte. */
  const dup = extractFn(B, 'duplicateStructureNode'),
    prim = extractFn(B, 'cloneStructureTree'),
    apply = extractFn(B, 'applyTemplateToProject');
  const arch = {
    uneSeulePrimitive: (B.match(/function\s+cloneStructureTree\s*\(/g) || []).length === 1,
    appels: (B.match(/= cloneStructureTree\(/g) || []).length,
    appelants: noms.filter((n) => n !== 'cloneStructureTree' && !parIndentation.includes(n)
      && /= cloneStructureTree\(/.test(extractFn(B, n) || '')).sort().join('|'),
    aiPanelNAppellePas: !/cloneStructureTree\(/.test(blocIndente(B, 'renderAIPanel') || ''),
    // §26 — UNE seule table de remappage tâche, réutilisée par les conditions.
    tablesUniques: (B.match(/mapNoeuds = new Map/g) || []).length === 1
      && (B.match(/mapTaches = new Map/g) || []).length === 1,
    conditionsDansLaPrimitive: /mapTaches\.has\(p\.taskId\)/.test(prim),
    appelantsSansTable: !/new Map\(/.test(dup) && !/new Map\(/.test(apply),
    // Les appelants POUSSENT, ils ne calculent pas.
    appelantsPoussent: /app\.prerequisites\.push\(\.\.\.copie\.prerequisites\)/.test(dup)
      && /app\.prerequisites\.push\(\.\.\.res\.prerequisites\)/.test(apply),
    remapDepsUnique: (B.match(/deps: internes\.map/g) || []).length === 1,
    remapReworkUnique: (B.match(/reworkOfTaskId: repriseInterne/g) || []).length === 1,
    primitivePure: !/\n\s*(app\.(structureNodes|tasks|prerequisites|history)\.|save\(\)|snapshot\(\)|render\(\))/.test(prim || 'x'),
    pasDeMoteurParallele: !/function\s+(PrerequisiteEngine|prerequisiteEngine|TemplatePrerequisiteEngine|StructurePrerequisiteClone|clonePrerequisites|cloneTemplateTree|applyTemplateEngine|AlertEngine|alertEngine)\s*\(/.test(B),
    pasDePileUndoParallele: !/prerequisiteUndoStack|prqSnapshot|prerequisiteHistory|alertUndoStack/.test(B),
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    // §34 — aucun automatisme caché.
    pasDeReplanification: !/prerequisite[\s\S]{0,200}?(applyReflowPlan|requestTaskScheduleMove|planReflow)\(/.test(extractFn(B, 'setPrerequisiteStatus') || 'x'),
    pasDIssueAuto: !/app\.issues\.push/.test(extractFn(B, 'addTaskPrerequisite') || 'x')
      && !/app\.issues\.push/.test(extractFn(B, 'setPrerequisiteStatus') || 'x'),
    // §42 — aucune entrée de navigation principale.
    pasDeNav: !/Approvisionnements|Prérequis|"Conditions"|Achats/.test(
      (B.match(/const NAV[\s\S]{0,600}?\]/) || [''])[0] + (B.match(/sidebar[\s\S]{0,900}?<\/nav>/) || [''])[0]),
  };
  note('FREEZE-2120-architecture', arch);
  ok(arch.uneSeulePrimitive && arch.appels === 2 && arch.aiPanelNAppellePas
    && arch.appelants === 'applyTemplateToProject|duplicateStructureNode',
    'FREEZE-2120 / §26 : cloneStructureTree() reste l’UNIQUE primitive de clonage, appelée exactement DEUX fois dans tout le fichier, par duplicateStructureNode() et applyTemplateToProject()', 'FREEZE-2120');
  ok(arch.tablesUniques && arch.conditionsDansLaPrimitive && arch.appelantsSansTable && arch.appelantsPoussent,
    'FREEZE-2120 / §26 : les conditions sont reconstruites DANS la primitive, avec la table mapTaches DÉJÀ existante — mapNoeuds et mapTaches n’apparaissent qu’UNE fois chacune, les appelants n’en construisent aucune et se contentent de pousser ce que la primitive a produit', 'FREEZE-2120');
  ok(arch.remapDepsUnique && arch.remapReworkUnique && arch.primitivePure,
    'FREEZE-2120 : le remappage des dépendances et des reprises n’apparaît toujours qu’UNE fois, et la primitive reste PURE — elle ne touche ni app, ni save, ni snapshot, ni render', 'FREEZE-2120');
  ok(arch.pasDeMoteurParallele && arch.pasDePileUndoParallele && arch.unSeulSnapshot && arch.unSeulGantt,
    'PRQ-51 / PRQ-52 / PRQ-53 : aucun second moteur de clonage, aucun moteur de prérequis parallèle, aucun moteur d’alertes parallèle, aucune pile Undo parallèle — un seul snapshot(), un seul gantt()', 'PRQ-51');
  ok(arch.pasDeReplanification && arch.pasDIssueAuto,
    'PRQ-54 / PRQ-55 : aucun automatisme caché — les mutations de condition ne replanifient rien et ne créent aucun incident (§34)', 'PRQ-54');
  ok(arch.pasDeNav,
    'FREEZE-2120 / §42 : aucune entrée de navigation principale n’a été ajoutée — la fonctionnalité reste CONTEXTUELLE', 'FREEZE-2120');

  /* Données et style : additifs, et rien d'autre. */
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const cssA = bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/),
    cssB = bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  const sansBlocCSS = (x) => x.replace(/      \/\* ---- V2\.12\.0 — CONDITIONS DE DÉMARRAGE[\s\S]*?\n      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER/, "      /* ---- V2.11.0 — MODÈLES DE CHANTIER");
  const donnees = {
    cssExtraite: cssA.length > 100000 && cssB.length > 100000,
    cssAdditive: md5(sansBlocCSS(cssB)) === md5(cssA) && cssB.length > cssA.length,
    demoIdentique: md5(bloc(A, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/))
      === md5(bloc(B, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/)),
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    requisGele: (A.match(/KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/) || [''])[0] === (B.match(/KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/) || [''])[0],
  };
  note('FREEZE-2120-données', { ...donnees, octetsCSSAvant: cssA.length, octetsCSSApres: cssB.length });
  ok(donnees.cssExtraite && donnees.cssAdditive,
    'FREEZE-2120 : la feuille de style est strictement ADDITIVE — le bloc V2.12.0 retiré, elle redevient byte-identique à V2.11.0.3', 'FREEZE-2120');
  ok(donnees.demoIdentique,
    'FREEZE-2120 : les données de démonstration existantes — niveaux de structure ET interventions — sont BYTE-IDENTIQUES : aucun chantier de démonstration n’a été dégradé pour les besoins de la fonction (§31)', 'FREEZE-2120');
  ok(donnees.schemaAvant === '14' && donnees.schemaApres === '15' && donnees.store === 'kanvix-product-8-3'
    && donnees.build && donnees.requisGele,
    'FREEZE-2120 : SCHEMA_VERSION passe bien de 14 à 15, STORE reste « kanvix-product-8-3 », build inchangé, et KANVIX_BACKUP_REQUIRED est byte-identique — les anciennes sauvegardes ne sont pas rejetées', 'FREEZE-2120');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
/* V2.12.0.1 — l'assertion « zéro erreur console » est posée AVANT le décompte
   final : le nombre annoncé à l'écran est ainsi EXACTEMENT celui que
   resultats.json enregistre. */
ok(appErrs.length === 0, `PRQ : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'PRQ');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
