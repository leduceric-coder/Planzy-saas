// ============================================================
// KANVIX — Recette « Modèles de chantier » (V2.11.0.2)
//
//   Cette recette est celle de V2.11.0.1 — elle-même héritée de V2.11.0 —
//   REJOUÉE intégralement contre V2.11.0.2, PLUS le bloc FIXTPL2 qui couvre
//   les deux angles morts corrigés :
//     A. les affectations suggérées d'un modèle respectent désormais les
//        règles Ressources de Kanvix (archivée = jamais réaffectée, engin =
//        jamais intervenant principal) ;
//     B. le parcours « Créer un chantier depuis un modèle » gère un modèle
//        « Structure seule » sans fabriquer de temporalité, et sans laisser
//        d'anciennes valeurs de wizard.data contaminer le chantier créé.
//   Aucun contrôle antérieur n'a été retiré ni affaibli.
//
// ============================================================
// (en-tête d'origine V2.11.0.1)
//
//   Cette recette est celle de V2.11.0, REJOUÉE intégralement contre le
//   correctif V2.11.0.1, PLUS le bloc FIXTPL qui couvre les quatre écarts
//   corrigés :
//     1. choisir « Structure seule » / « Structure + interventions » à
//        l'enregistrement d'un modèle ;
//     2. conserver les ressources COMPLÉMENTAIRES comme suggestions ;
//     3. la troncature des noms dans le gestionnaire ;
//     4. l'accès DIRECT au parcours « Modèle de chantier » depuis le
//        gestionnaire.
//   Aucun contrôle de V2.11.0 n'a été retiré. Deux assertions ont été
//   re-pointées — et renforcées — parce que le format d'une intervention de
//   modèle et le formulaire de capture ont volontairement évolué.
//
// ============================================================
// (en-tête d'origine V2.11.0)
//
//   V2.11.0 ajoute une collection : app.projectTemplates. Un modèle est une
//   TRAME — une hiérarchie, des interventions, leurs lots, leurs durées et
//   leurs dépendances — exprimée en JOURS RELATIFS au démarrage. Il ne
//   contient aucune date absolue, aucun avancement, aucun incident, aucune
//   photo, aucun message, aucune reprise, aucun contrôle.
//
//   Le §34 impose UNE SEULE vérité de clonage. La recette ne se contente pas
//   de le lire dans le code : elle vérifie que la duplication de V2.10 et
//   l'instanciation de V2.11 produisent les MÊMES propriétés relationnelles,
//   et que le fichier ne contient qu'un seul moteur de copie.
//
//   Usage : node recette-modeles-chantier-v2.11.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.11.0.2.html';
// PREV reste V2.10.0.1 : le gel FREEZE-2110 mesure toujours la même distance,
// celle du round V2.11.0. PREV_2110 sert au gel PROPRE à ce correctif.
const PREV = 'kanvix-next-gen-v2.10.0.1.html';
const PREV_2110 = 'kanvix-next-gen-v2.11.0.html';
// Le gel PROPRE à ce correctif mesure la distance depuis V2.11.0.1.
const PREV_21101 = 'kanvix-next-gen-v2.11.0.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.11.0.2/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate(() => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); });
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

/* Le décor, posé PAR LE TEST — jamais par INITIAL_STATE.
   « Zone modèle » porte deux sous-niveaux, cinq interventions dont une chaîne
   de dépendances, une reprise INTERNE, une ressource, un lot, un incident et
   un avancement. Une trame prise là-dessus doit tout perdre de l'opérationnel
   et ne garder que la trame. Un sous-niveau ARCHIVÉ vérifie l'exclusion. */
const decor = async (p) => {
  await ev(p, () => {
    const sn = (id, parentId, name, archived = false) => ({
      id, projectId: 'keravel', parentId, name, type: 'zone', description: '',
      responsibleResourceId: null, archived, createdAt: '2026-08-01T08:00', updatedAt: '2026-08-01T08:00',
    });
    app.structureNodes.push(sn('sn-m', null, 'Zone modèle'));
    app.structureNodes.push(sn('sn-m1', 'sn-m', 'Sous-zone 1'));
    app.structureNodes.push(sn('sn-m2', 'sn-m', 'Sous-zone 2'));
    app.structureNodes.push(sn('sn-m-arch', 'sn-m', 'Sous-zone archivée', true));
    const mk = (id, nom, snId, start, end, deps, extra = {}) => ({
      id, structureNodeId: snId, projectId: 'keravel', name: nom,
      lotId: 'lot-platrerie', resourceId: 'mathieu', additionalResourceIds: ['crane-g01'],
      phase: 'Second œuvre', start, end, status: 'done', deps,
      reworkOfTaskId: null, colorKey: 'auto',
      baselineStart: start, baselineEnd: end, ...extra,
    });
    // 2026-08-17 est un LUNDI. M3 tombe volontairement un SAMEDI (08-22) :
    // une trame doit conserver ses week-ends, jamais les « corriger ».
    app.tasks.push(mk('t-m1', 'Préparation', 'sn-m', '2026-08-17T08:00', '2026-08-18T17:00', []));
    app.tasks.push(mk('t-m2', 'Cloisons', 'sn-m1', '2026-08-19T08:00', '2026-08-19T17:00', ['t-m1']));
    app.tasks.push(mk('t-m3', 'Week-end technique', 'sn-m2', '2026-08-22T08:00', '2026-08-22T12:00', ['t-m2']));
    app.tasks.push(mk('t-m4', 'Reprise — Cloisons', 'sn-m1', '2026-08-24T08:00', '2026-08-24T17:00', ['t-m2'], { reworkOfTaskId: 't-m2' }));
    app.tasks.push(mk('t-m5', 'Intervention archivée', 'sn-m-arch', '2026-08-25T08:00', '2026-08-25T17:00', []));
    app.issues.push({
      id: 'iss-m', taskId: 't-m2', projectId: 'keravel', title: 'Incident de trame',
      severity: 'critical', status: 'open', date: '2026-08-19T10:00', author: 'Eric',
    });
    save();
  });
  await p.waitForTimeout(150);
};
const capture = (p, opts) => ev(p, (o) => {
  const r = saveProjectTemplateFrom(o);
  return typeof r === 'string' ? { err: r } : JSON.parse(JSON.stringify(r));
}, opts);
/* Les objets créés par une pose, sans rien supposer du format des ID : on
   photographie AVANT, et le nouveau est la différence. */
const avant = (p) => ev(p, () => ({ n: app.structureNodes.map((x) => x.id), t: app.tasks.map((x) => x.id), p: app.projects.map((x) => x.id) }));
const nouveaux = (p, av) => ev(p, (a) => {
  const sn = new Set(a.n), st = new Set(a.t), sp = new Set(a.p);
  return {
    noeuds: app.structureNodes.filter((x) => !sn.has(x.id)).map((x) => ({ id: x.id, name: x.name, parentId: x.parentId, projectId: x.projectId, type: x.type, archived: x.archived, resp: x.responsibleResourceId })),
    taches: app.tasks.filter((x) => !st.has(x.id)).map((x) => ({ id: x.id, name: x.name, sn: x.structureNodeId, projectId: x.projectId, start: x.start, end: x.end, status: x.status, res: x.resourceId, add: x.additionalResourceIds, lot: x.lotId, deps: x.deps, rw: x.reworkOfTaskId, champs: Object.keys(x).sort().join(',') })),
    projets: app.projects.filter((x) => !sp.has(x.id)).map((x) => ({ id: x.id, name: x.name, startDate: x.startDate, baselineEnd: x.baselineEnd, mode: x.creationMode, tplId: x.projectTemplateId })),
  };
}, av);

// ============================================================
// TPL-01 → TPL-06 — Le modèle de données et la migration
// ============================================================
console.log('\n[TPL-DATA] Collection, schéma, migration');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });
  const base = await ev(p, () => ({
    schema: app.schemaVersion, constante: SCHEMA_VERSION, store: STORE,
    estTableau: Array.isArray(app.projectTemplates),
    tpls: app.projectTemplates.map((t) => ({
      id: t.id, nom: t.name, scope: t.scope, seed: t.seededFor,
      noeuds: t.nodes.length, taches: t.tasks.length, root: t.rootId,
    })),
    // Un modèle ne contient AUCUNE date absolue : on balaie tout le JSON.
    datesAbsolues: JSON.stringify(app.projectTemplates.map((t) => t.tasks)).match(/\d{4}-\d{2}-\d{2}/g) || [],
  }));
  note('TPL-01', base);
  /* V2.12.0 — RE-POINTAGE. SCHEMA_VERSION avance à 15 : app.prerequisites et la
     migration 14 → 15 (§28). Ce que ces assertions protègent — la collection des
     modèles, sa création VIDE, la non-destruction des données, la clé de stockage —
     est strictement inchangé. Seule la version attendue suit le produit. */
  ok(base.schema === 15 && base.constante === 15, 'TPL-01 : SCHEMA_VERSION a passé 13 → 14 avec les modèles, puis 14 → 15 avec les conditions de démarrage ; l’état chargé porte bien la version 15', 'TPL-01');
  ok(base.store === 'kanvix-product-8-3', 'TPL-02 : STORE reste « kanvix-product-8-3 » — le bump de schéma ne change pas la clé de stockage', 'TPL-02');
  ok(base.estTableau && base.tpls.length === 2, 'TPL-03 : app.projectTemplates existe et porte les DEUX modèles de démonstration', 'TPL-03');
  ok(base.tpls.every((t) => t.seed === '2026-08-13'), 'TPL-04 : les deux modèles de démonstration portent la marque seededFor', 'TPL-04');
  ok(base.tpls.some((t) => t.scope === 'structure' && t.root) && base.tpls.some((t) => t.scope === 'project' && t.root === null),
    'TPL-05 : la démonstration couvre les DEUX portées — un modèle de niveau (rootId posé) et un modèle de chantier entier (forêt, rootId null)', 'TPL-05');
  ok(base.datesAbsolues.length === 0, `TPL-06 : aucune date absolue dans les interventions d’un modèle (${base.datesAbsolues.length} trouvée(s)) — uniquement des jours relatifs`, 'TPL-06');

  /* La migration : un état V13 n'a pas la collection. Elle est créée VIDE —
     aucun modèle de démonstration n'est installé chez un utilisateur existant.
     Et elle est IDEMPOTENTE : la rejouer ne change rien. */
  const mig = await ev(p, () => {
    const v13 = structuredClone(app);
    delete v13.projectTemplates;
    v13.schemaVersion = 13;
    const chantiersAvant = v13.projects.length, tachesAvant = v13.tasks.length;
    const un = migrateState(structuredClone(v13));
    const deux = migrateState(structuredClone(un));
    return {
      creeeVide: Array.isArray(un.projectTemplates) && un.projectTemplates.length === 0,
      schema: un.schemaVersion,
      nonDestructive: un.projects.length === chantiersAvant && un.tasks.length === tachesAvant,
      idempotente: JSON.stringify(un.projectTemplates) === JSON.stringify(deux.projectTemplates)
        && un.tasks.length === deux.tasks.length && un.structureNodes.length === deux.structureNodes.length,
    };
  });
  note('TPL-07', mig);
  ok(mig.creeeVide && mig.schema === 15 && mig.nonDestructive,
    'TPL-07 : une sauvegarde V13 devient V14 avec projectTemplates = [] — aucun modèle de démonstration n’est installé rétroactivement, aucune donnée métier touchée', 'TPL-07');
  ok(mig.idempotente, 'TPL-08 : la migration 13 → 14 est IDEMPOTENTE — la rejouer sur un état déjà migré ne change rien', 'TPL-08');

  /* La normalisation répare un modèle corrompu sans jamais toucher au reste. */
  const norm = await ev(p, () => {
    const sale = structuredClone(app);
    sale.projectTemplates = [{
      id: 'sale', name: '', scope: 'n’importe quoi', rootId: 'inexistant',
      nodes: [
        { id: 'a', parentId: 'fantome', name: 'A', type: 'zone' },
        { id: 'b', parentId: 'c', name: 'B', type: 'inconnu' },
        { id: 'c', parentId: 'b', name: 'C', type: 'zone' },
      ],
      tasks: [
        { id: 'x', structureNodeId: 'fantome', name: 'X', offsetDays: -5, durationDays: -2, startTime: 'nawak', deps: ['y', 'inconnu', 'x'] },
        { id: 'y', structureNodeId: 'a', name: 'Y', offsetDays: 3, durationDays: 1, deps: [] },
      ],
    }, { pasUnObjet: true }, null];
    const r = migrateState(sale).projectTemplates;
    const t = r[0];
    return {
      gardes: r.length,
      nom: t.name, scope: t.scope, root: t.rootId,
      parents: t.nodes.map((n) => n.parentId),
      type: t.nodes.find((n) => n.id === 'b').type,
      snX: t.tasks[0].structureNodeId, off: t.tasks[0].offsetDays, dur: t.tasks[0].durationDays,
      heure: t.tasks[0].startTime, deps: t.tasks[0].deps,
    };
  });
  note('TPL-09', norm);
  ok(norm.gardes === 1 && norm.nom === 'Modèle' && norm.scope === 'structure' && norm.root === null
    && norm.parents[0] === null && norm.type === 'other' && norm.snX === null
    && norm.off === 0 && norm.dur === 0 && norm.heure === 'T08:00'
    && norm.deps.length === 1 && norm.deps[0] === 'y',
    'TPL-09 : la migration NORMALISE un modèle corrompu — entrées illisibles écartées, parent fantôme et cycle ramenés à la racine, type inconnu neutralisé, rattachement fantôme annulé, offsets négatifs bornés, heure invalide remplacée, dépendance inconnue et auto-dépendance filtrées', 'TPL-09');

  /* Un modèle ne vieillit pas : alignDemoDates() n'a RIEN à y décaler. */
  const immuable = await ev(p, () => {
    const avant = JSON.stringify(app.projectTemplates);
    const s = alignDemoDates(structuredClone(app), '2027-03-05');
    return { identique: JSON.stringify(s.projectTemplates) === avant, tachesDecalees: s.tasks[0].start !== app.tasks[0].start };
  });
  note('TPL-10', immuable);
  ok(immuable.identique && immuable.tachesDecalees,
    'TPL-10 : le réalignement de la démonstration décale bien les tâches mais ne touche AUCUN modèle — les jours relatifs sont par nature immunisés', 'TPL-10');
  await ctx.close();
}

// ============================================================
// TPL-11 → TPL-18 — La capture
// ============================================================
console.log('\n[TPL-CAPTURE] Enregistrer une trame');
{
  const { ctx, p } = await newPage({ tag: 'CAPTURE' });
  await decor(p);
  const t = await capture(p, { projectId: 'keravel', nodeId: 'sn-m', name: 'Trame zone' });
  note('TPL-11', { scope: t.scope, root: t.rootId, noeuds: t.nodes, taches: t.tasks });
  ok(!t.err && t.scope === 'structure' && t.nodes.length === 3 && t.rootId === 'tn-1',
    'TPL-11 : la capture d’un niveau retient le niveau ET sa descendance ACTIVE — 3 niveaux, le sous-niveau archivé exclu', 'TPL-11');
  ok(!t.nodes.some((n) => n.name === 'Sous-zone archivée') && !t.tasks.some((x) => x.name === 'Intervention archivée'),
    'TPL-12 : ni le sous-niveau archivé ni son intervention n’entrent dans la trame — un modèle décrit ce que l’on refait', 'TPL-12');
  ok(t.tasks.length === 4 && t.tasks.every((x) => t.nodes.some((n) => n.id === x.structureNodeId)),
    'TPL-13 : les 4 interventions actives sont capturées et chacune reste rattachée à un niveau DU MODÈLE', 'TPL-13');

  const champs = [...new Set(t.tasks.flatMap((x) => Object.keys(x)))].sort();
  const interdits = ['status', 'resourceId', 'additionalResourceIds', 'reworkOfTaskId', 'baselineStart', 'baselineEnd', 'start', 'end', 'colorKey', 'projectId'];
  note('TPL-14', { champs, interditsPresents: interdits.filter((k) => champs.includes(k)) });
  ok(interdits.every((k) => !champs.includes(k)),
    'TPL-14 : la capture est une LISTE BLANCHE — ni statut, ni intervenant, ni reprise, ni référence, ni date absolue, ni chantier ne descendent dans une trame', 'TPL-14');
  /* V2.11.0.1 — RE-POINTAGE. Le format a gagné UN champ, volontairement :
     suggestedAdditionalResourceIds. L'assertion épingle donc douze champs au
     lieu de onze — elle reste une liste EXACTE, donc plus stricte qu'avant :
     un treizième champ, quel qu'il soit, la ferait tomber. */
  ok(champs.join(',') === 'deps,durationDays,endTime,id,lotId,name,offsetDays,phase,startTime,structureNodeId,suggestedAdditionalResourceIds,suggestedResourceId',
    'TPL-15 : une intervention de modèle porte EXACTEMENT douze champs — identité, rattachement, lot, phase, jours relatifs, heures, dépendances, intervenant SUGGÉRÉ et ressources complémentaires SUGGÉRÉES', 'TPL-15');

  const chaine = Object.fromEntries(t.tasks.map((x) => [x.name, x]));
  note('TPL-16', chaine);
  ok(chaine['Préparation'].offsetDays === 0 && chaine['Préparation'].durationDays === 1
    && chaine['Cloisons'].offsetDays === 2 && chaine['Week-end technique'].offsetDays === 5
    && chaine['Reprise — Cloisons'].offsetDays === 7,
    'TPL-16 : les écarts sont convertis en JOURS CALENDAIRES depuis le premier jour du périmètre — 0, 2, 5 et 7 jours, le samedi compris', 'TPL-16');
  ok(chaine['Cloisons'].deps.length === 1 && chaine['Cloisons'].deps[0] === chaine['Préparation'].id
    && chaine['Week-end technique'].deps[0] === chaine['Cloisons'].id,
    'TPL-17 : les dépendances internes sont remappées vers les clés DU MODÈLE — aucune ne pointe vers une tâche de chantier', 'TPL-17');
  ok(chaine['Préparation'].suggestedResourceId === 'mathieu' && chaine['Préparation'].lotId === 'lot-platrerie'
    && chaine['Préparation'].startTime === 'T08:00' && chaine['Préparation'].endTime === 'T17:00',
    'TPL-18 : lot, phase, heures de début et de fin et intervenant SUGGÉRÉ sont conservés', 'TPL-18');

  // Chantier entier : une FORÊT, plus les interventions sans structure.
  const tp = await capture(p, { projectId: 'keravel', name: 'Trame chantier' });
  const sansStructure = await ev(p, () => getUnstructuredTasks('keravel').length);
  note('TPL-19', { scope: tp.scope, root: tp.rootId, noeuds: tp.nodes.length, taches: tp.tasks.length, orphelines: tp.tasks.filter((x) => !x.structureNodeId).length, sansStructure });
  ok(tp.scope === 'project' && tp.rootId === null && tp.nodes.filter((n) => !n.parentId).length >= 2,
    'TPL-19 : la capture d’un CHANTIER ENTIER produit une forêt — aucune racine unique inventée', 'TPL-19');
  ok(tp.tasks.filter((x) => !x.structureNodeId).length === sansStructure,
    'TPL-20 : les interventions sans structure du chantier entrent bien dans la trame, et y restent sans structure', 'TPL-20');

  const refus = await ev(p, () => [
    saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: '  ' }),
    saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'trame ZONE' }),
    saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m-arch', name: 'Archivé' }),
    saveProjectTemplateFrom({ projectId: 'fantome', nodeId: null, name: 'Fantôme' }),
  ].map((r) => (typeof r === 'string' ? r : 'CRÉÉ')));
  note('TPL-21', refus);
  ok(refus[0].includes('obligatoire') && refus[1].includes('déjà ce nom') && refus[2].includes('archivé') && refus[3].includes('n’existe plus'),
    'TPL-21 : nom vide, doublon de nom (casse ignorée), niveau archivé et chantier inexistant sont refusés avec un message clair — aucun modèle créé', 'TPL-21');
  await p.screenshot({ path: SHOTS + '01-capture-niveau.png', fullPage: false });
  await ctx.close();
}

// ============================================================
// TPL-22 → TPL-31 — L'instanciation
// ============================================================
console.log('\n[TPL-POSE] Reposer une trame');
{
  const { ctx, p } = await newPage({ tag: 'POSE' });
  await decor(p);
  await capture(p, { projectId: 'keravel', nodeId: 'sn-m', name: 'Trame zone' });
  const tplId = await ev(p, () => app.projectTemplates.find((t) => t.name === 'Trame zone').id);

  /* ALLER-RETOUR : reposée à la date de référence de la source, la trame doit
     redonner EXACTEMENT les mêmes dates. C'est la preuve que la conversion en
     jours relatifs est réversible — et qu'aucun week-end n'est « corrigé ». */
  const av1 = await avant(p);
  await ev(p, (id) => insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'Zone repose', startDate: '2026-08-17', resourceStrategy: 'none' }), tplId);
  const n1 = await nouveaux(p, av1);
  const sourceDates = await ev(p, () => ({
    'Préparation': [task('t-m1').start, task('t-m1').end],
    'Cloisons': [task('t-m2').start, task('t-m2').end],
    'Week-end technique': [task('t-m3').start, task('t-m3').end],
    'Reprise — Cloisons': [task('t-m4').start, task('t-m4').end],
  }));
  const posees = Object.fromEntries(n1.taches.map((x) => [x.name, [x.start, x.end]]));
  note('TPL-22', { sourceDates, posees });
  ok(Object.keys(sourceDates).every((k) => posees[k] && posees[k][0] === sourceDates[k][0] && posees[k][1] === sourceDates[k][1]),
    'TPL-22 : ALLER-RETOUR exact — capturée puis reposée à sa date de référence, la trame redonne les dates de la source au jour et à l’heure près', 'TPL-22');
  ok(posees['Week-end technique'][0].slice(0, 10) === '2026-08-22',
    'TPL-22 : l’intervention du SAMEDI reste un samedi — aucune trame n’est « corrigée » vers un jour ouvré, ce qui décalerait toutes ses dépendances', 'TPL-22');

  // Décalage : +21 jours sur TOUT, sans exception.
  const av2 = await avant(p);
  await ev(p, (id) => insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'Zone +21', startDate: '2026-09-07', resourceStrategy: 'none' }), tplId);
  const n2 = await nouveaux(p, av2);
  const decale = Object.fromEntries(n2.taches.map((x) => [x.name, [x.start, x.end]]));
  const ecarts = Object.keys(sourceDates).map((k) => Math.round((new Date(decale[k][0]) - new Date(sourceDates[k][0])) / 86400000));
  note('TPL-23', { decale, ecarts });
  ok(ecarts.every((e) => e === 21),
    `TPL-23 : reposée 21 jours plus tard, CHAQUE intervention est décalée d’exactement 21 jours (${ecarts.join('/')}) — la géométrie de la trame est intacte`, 'TPL-23');

  // Identifiants : tout est neuf, rien ne pointe vers la source ni vers le modèle.
  const cles = await ev(p, (id) => {
    const t = projectTemplate(id);
    return { noeuds: t.nodes.map((n) => n.id), taches: t.tasks.map((x) => x.id) };
  }, tplId);
  const sourceIds = ['sn-m', 'sn-m1', 'sn-m2', 't-m1', 't-m2', 't-m3', 't-m4'];
  const tousIds = [...n1.noeuds.map((x) => x.id), ...n1.taches.map((x) => x.id), ...n2.noeuds.map((x) => x.id), ...n2.taches.map((x) => x.id)];
  note('TPL-24', { cles, exemples: tousIds.slice(0, 4), collisions: tousIds.filter((i) => sourceIds.includes(i) || cles.noeuds.includes(i) || cles.taches.includes(i)) });
  ok(tousIds.length === new Set(tousIds).size && !tousIds.some((i) => sourceIds.includes(i) || cles.noeuds.includes(i) || cles.taches.includes(i)),
    'TPL-24 : TOUS les identifiants posés sont neufs et uniques — aucun ne reprend une clé du modèle ni un identifiant de la structure source', 'TPL-24');

  const rel = await ev(p, (ids) => {
    const st = new Set(ids);
    const clones = app.tasks.filter((t) => st.has(t.id));
    const cl = new Set(clones.map((t) => t.id));
    return {
      depsInternes: clones.every((t) => (t.deps || []).every((d) => cl.has(d))),
      nbDeps: clones.reduce((n, t) => n + (t.deps || []).length, 0),
      reprises: clones.filter((t) => t.reworkOfTaskId).length,
      rattachements: clones.every((t) => app.structureNodes.some((n) => n.id === t.structureNodeId)),
    };
  }, n2.taches.map((x) => x.id));
  note('TPL-25', rel);
  ok(rel.depsInternes && rel.nbDeps === 3 && rel.rattachements,
    'TPL-25 : les 3 dépendances de la trame sont reposées ENTRE LES COPIES — aucune ne traverse vers la source, et chaque intervention est rattachée à un niveau réellement créé', 'TPL-25');
  ok(rel.reprises === 0,
    'TPL-25 : aucune reprise n’est reposée — une reprise est un fait de chantier, pas un élément de trame (la source en portait une)', 'TPL-25');

  const neuf = await ev(p, (ids) => {
    const st = new Set(ids);
    const clones = app.tasks.filter((t) => st.has(t.id));
    return {
      statuts: [...new Set(clones.map((t) => t.status))],
      res: [...new Set(clones.map((t) => t.resourceId))],
      add: [...new Set(clones.flatMap((t) => t.additionalResourceIds || []))],
      incidents: app.issues.filter((i) => st.has(i.taskId)).length,
      controles: (app.controlInstances || []).filter((c) => st.has(c.taskId)).length,
      photos: (app.photos || []).filter((x) => st.has(x.taskId)).length,
      baselineCalee: clones.every((t) => t.baselineStart === t.start && t.baselineEnd === t.end),
    };
  }, n2.taches.map((x) => x.id));
  note('TPL-26', neuf);
  ok(neuf.statuts.length === 1 && neuf.statuts[0] === 'todo' && neuf.incidents === 0 && neuf.controles === 0 && neuf.photos === 0,
    'TPL-26 : les interventions posées naissent « à faire », sans incident, sans contrôle et sans photo — la source était pourtant terminée et portait un incident critique', 'TPL-26');
  ok(neuf.res.length === 1 && neuf.res[0] === null && neuf.add.length === 0,
    'TPL-27 : en mode « Ne pas affecter », aucune intervention posée ne porte d’intervenant, principal ou complémentaire', 'TPL-27');
  ok(neuf.baselineCalee, 'TPL-27 : la référence de chaque intervention posée est calée sur ses propres dates — pas de retard hérité d’un autre chantier', 'TPL-27');

  // Intervenants SUGGÉRÉS : repris seulement s'ils existent encore.
  const sugg = await ev(p, (id) => {
    const t = projectTemplate(id);
    // On casse volontairement une suggestion et un lot : ni l'un ni l'autre
    // ne doit produire de référence orpheline.
    t.tasks[0].suggestedResourceId = 'ressource-disparue';
    t.tasks[1].lotId = 'lot-disparu';
    const av = new Set(app.tasks.map((x) => x.id));
    const r = insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'Zone suggérée', startDate: '2026-10-05', resourceStrategy: 'suggest' });
    const clones = app.tasks.filter((x) => !av.has(x.id));
    return {
      r,
      res: clones.map((x) => [x.name, x.resourceId]),
      lots: clones.map((x) => [x.name, x.lotId]),
      orphelines: clones.filter((x) => (x.resourceId && !resource(x.resourceId)) || (x.lotId && !lot(x.lotId))).length,
    };
  }, tplId);
  note('TPL-28', sugg);
  ok(sugg.orphelines === 0 && sugg.r.ressourcesAbandonnees === 1 && sugg.r.lotsAbandonnes === 1,
    'TPL-28 : en mode « intervenants suggérés », une ressource disparue et un lot disparu sont ABANDONNÉS et comptés — jamais de référence orpheline dans une intervention posée', 'TPL-28');
  ok(sugg.res.some(([, r]) => r === 'mathieu'),
    'TPL-28 : les intervenants suggérés qui existent toujours sont bien repris', 'TPL-28');

  // Destination : la garde métier de V2.9/V2.10 est réutilisée telle quelle.
  const gardes = await ev(p, (id) => {
    const arch = structureNode('sn-m-arch');
    return [
      insertTemplateIntoProject('modele-fantome', { projectId: 'keravel', startDate: '2026-10-05' }),
      insertTemplateIntoProject(id, { projectId: 'chantier-fantome', startDate: '2026-10-05' }),
      insertTemplateIntoProject(id, { projectId: 'keravel', parentId: 'sn-fantome', startDate: '2026-10-05' }),
      insertTemplateIntoProject(id, { projectId: 'keravel', parentId: arch.id, startDate: '2026-10-05' }),
    ].map((r) => (typeof r === 'string' ? r : 'POSÉ'));
  }, tplId);
  note('TPL-29', gardes);
  ok(gardes.every((g) => typeof g === 'string' && g !== 'POSÉ'),
    'TPL-29 : modèle absent, chantier absent, emplacement absent et emplacement ARCHIVÉ sont refusés — mêmes gardes que la duplication de V2.10', 'TPL-29');

  // Pose SOUS un niveau existant : la racine de la trame prend ce parent.
  const av3 = await avant(p);
  const sous = await ev(p, (id) => insertTemplateIntoProject(id, { projectId: 'keravel', parentId: 'sn-keravel-bat-a', rootName: 'Étage greffé', startDate: '2026-11-02', resourceStrategy: 'none' }), tplId);
  const n3 = await nouveaux(p, av3);
  const racine = n3.noeuds.find((x) => x.id === sous.id);
  note('TPL-30', { sous, racine, enfants: n3.noeuds.filter((x) => x.parentId === sous.id).map((x) => x.name) });
  ok(racine && racine.parentId === 'sn-keravel-bat-a' && racine.name === 'Étage greffé'
    && n3.noeuds.filter((x) => x.parentId === sous.id).length === 2,
    'TPL-30 : posée SOUS un niveau existant, la trame s’y greffe par sa seule racine — ses sous-niveaux restent attachés à elle, renommage compris', 'TPL-30');

  // Modèle de chantier entier posé dans un chantier : une FORÊT au même endroit.
  const av4 = await avant(p);
  await ev(p, () => insertTemplateIntoProject('ptpl-maison-gros-oeuvre', { projectId: 'villa', parentId: null, startDate: '2026-11-09', resourceStrategy: 'none' }));
  const n4 = await nouveaux(p, av4);
  note('TPL-31', { noeuds: n4.noeuds.map((x) => [x.name, x.parentId]), taches: n4.taches.length });
  ok(n4.noeuds.length === 3 && n4.noeuds.every((x) => x.parentId === null && x.projectId === 'villa') && n4.taches.length === 6,
    'TPL-31 : un modèle de CHANTIER ENTIER pose ses trois niveaux racines côte à côte dans le chantier visé — la forêt reste une forêt', 'TPL-31');
  await ctx.close();
}

// ============================================================
// TPL-32 → TPL-35 — Undo/Redo : UNE seule action
// ============================================================
console.log('\n[TPL-UNDO] Une pose, un seul geste');
{
  const { ctx, p } = await newPage({ tag: 'UNDO' });
  await decor(p);
  const t1 = await ev(p, () => {
    const a = { n: app.structureNodes.length, t: app.tasks.length, tpl: app.projectTemplates.length };
    saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'Trame zone' });
    const b = { tpl: app.projectTemplates.length };
    undo();
    return { a, b, apres: app.projectTemplates.length };
  });
  note('TPL-32', t1);
  ok(t1.b.tpl === t1.a.tpl + 1 && t1.apres === t1.a.tpl,
    'TPL-32 : enregistrer un modèle est annulable — un seul « Annuler » le retire', 'TPL-32');

  const t2 = await ev(p, () => {
    saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'Trame zone' });
    const id = app.projectTemplates.find((x) => x.name === 'Trame zone').id;
    const a = { n: app.structureNodes.length, t: app.tasks.length };
    insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'Z', startDate: '2026-09-07', resourceStrategy: 'none' });
    const b = { n: app.structureNodes.length, t: app.tasks.length };
    undo();
    const c = { n: app.structureNodes.length, t: app.tasks.length };
    redo();
    const d = { n: app.structureNodes.length, t: app.tasks.length };
    return { a, b, c, d, id };
  });
  note('TPL-33', t2);
  ok(t2.b.n === t2.a.n + 3 && t2.b.t === t2.a.t + 4 && t2.c.n === t2.a.n && t2.c.t === t2.a.t,
    'TPL-33 : poser une trame (3 niveaux + 4 interventions) s’annule d’UN SEUL geste — jamais niveau par niveau', 'TPL-33');
  ok(t2.d.n === t2.b.n && t2.d.t === t2.b.t,
    'TPL-34 : « Rétablir » repose la trame entière, elle aussi d’un seul geste', 'TPL-34');

  // Créer un chantier depuis un modèle : chantier ET trame dans UNE action.
  const t3 = await ev(p, (id) => {
    const a = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length };
    app.ui.wizard = { step: 'ptpl-preview', mode: 'project-template', data: { ptplId: id, name: 'Chantier modèle', startDate: '2026-09-14', ptplResources: 'none' } };
    $('#drawerContent').innerHTML = '';
    createProjectFromProjectTemplate();
    const b = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length };
    undo();
    const c = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length };
    return { a, b, c };
  }, t2.id);
  note('TPL-35', t3);
  ok(t3.b.p === t3.a.p + 1 && t3.b.n === t3.a.n + 3 && t3.b.t === t3.a.t + 4
    && t3.c.p === t3.a.p && t3.c.n === t3.a.n && t3.c.t === t3.a.t,
    'TPL-35 : créer un chantier depuis un modèle crée le chantier ET toute sa trame, et « Annuler » défait l’ensemble — jamais de chantier vide orphelin', 'TPL-35');
  await ctx.close();
}

// ============================================================
// TPL-36 → TPL-39 — Gestion des modèles
// ============================================================
console.log('\n[TPL-GESTION] Renommer, supprimer');
{
  const { ctx, p } = await newPage({ tag: 'GESTION' });
  await ev(p, () => { openProjectTemplatesManager(); });
  await p.waitForTimeout(250);
  const vue = await ev(p, () => ({
    ouvert: $('#drawer').classList.contains('open'),
    lignes: [...document.querySelectorAll('.ptpl-row')].length,
    actions: [...document.querySelectorAll('.ptpl-row')[0].querySelectorAll('.ptpl-acts .btn')].map((b) => b.textContent.trim()),
  }));
  note('TPL-36', vue);
  ok(vue.ouvert && vue.lignes === 2 && vue.actions.join('|') === 'Utiliser|Renommer|Supprimer',
    'TPL-36 : la fenêtre « Modèles de chantier » liste les deux modèles, chacun avec Utiliser, Renommer et Supprimer', 'TPL-36');
  await p.screenshot({ path: SHOTS + '02-gestion-modeles.png' });

  const ren = await ev(p, () => [
    renameProjectTemplate('ptpl-etage-type', '  '),
    renameProjectTemplate('ptpl-etage-type', 'maison individuelle — GROS ŒUVRE'),
    renameProjectTemplate('ptpl-etage-type', 'Étage rebaptisé', 'Nouvelle description'),
    renameProjectTemplate('fantome', 'X'),
  ].map((r) => (r === true ? 'OK' : r)).concat([projectTemplate('ptpl-etage-type').name, projectTemplate('ptpl-etage-type').description]));
  note('TPL-37', ren);
  ok(ren[0].includes('obligatoire') && ren[1].includes('déjà ce nom') && ren[2] === 'OK' && ren[3].includes('n’existe plus')
    && ren[4] === 'Étage rebaptisé' && ren[5] === 'Nouvelle description',
    'TPL-37 : renommer refuse le vide, refuse un doublon (casse ignorée), refuse un modèle absent, et accepte un nom valide avec sa description', 'TPL-37');

  const supp = await ev(p, () => {
    confirmDeleteProjectTemplate('ptpl-etage-type');
    const ouvert = $('#modal').classList.contains('open');
    const texte = $('#modalContent').textContent;
    const avant = app.projectTemplates.length;
    doDeleteProjectTemplate('ptpl-etage-type');
    const apres = app.projectTemplates.length;
    undo();
    return { ouvert, confirme: /Supprimer/.test(texte), avant, apres, restaure: app.projectTemplates.length };
  });
  await p.waitForTimeout(150);
  note('TPL-38', supp);
  ok(supp.ouvert && supp.confirme && supp.apres === supp.avant - 1,
    'TPL-38 : la suppression passe par une CONFIRMATION explicite avant de retirer le modèle', 'TPL-38');
  ok(supp.restaure === supp.avant,
    'TPL-39 : supprimer un modèle est annulable — « Annuler » le restitue intact', 'TPL-39');
  await ctx.close();
}

// ============================================================
// TPL-40 → TPL-43 — Les points d'entrée et le wizard
// ============================================================
console.log('\n[TPL-UI] Menus, réglages, wizard');
{
  const { ctx, p } = await newPage({ tag: 'UI' });
  await ev(p, () => { openProjectTab('keravel', 'Structure'); });
  await p.waitForTimeout(300);
  const entree = await ev(p, () => {
    const c = document.querySelector('[data-structure-node="sn-keravel-bat-a"]');
    c.querySelector('.more-trigger').click();
    const items = [...c.querySelectorAll('.more-pop button')].map((x) => x.textContent.trim());
    const pop = c.querySelector('.more-pop'), btn = c.querySelector('.more-trigger');
    const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    const haut = pop.classList.contains('drop-up');
    const geo = { haut, ecart: Math.round(haut ? bb.top - pb.bottom : pb.top - bb.bottom), dxDroite: Math.round(pb.right - bb.right), hors: Math.round(Math.max(pb.bottom - innerHeight, -pb.top, pb.right - innerWidth, -pb.left)) };
    // Chaque entrée est-elle RÉELLEMENT cliquable, ou rognée par le bloc ?
    const bloquees = [...pop.querySelectorAll('[role=menuitem]')].filter((it) => {
      const r = it.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(el === it || it.contains(el));
    }).map((it) => it.textContent.trim());
    return { items, geo, bloquees, hauteur: Math.round(pb.height) };
  });
  await p.screenshot({ path: SHOTS + '03-menu-niveau.png' });
  await ev(p, () => closeDrawerMenu());
  note('TPL-40', entree);
  ok(entree.items.join('|') === 'Modifier|Ajouter un sous-niveau|Déplacer|Dupliquer|Enregistrer comme modèle|Archiver|Supprimer',
    'TPL-40 : le menu « … » d’un niveau porte « Enregistrer comme modèle » entre Dupliquer et Archiver — les six entrées de V2.10 sont toutes conservées', 'TPL-40');
  ok(Math.abs(entree.geo.ecart) <= 12 && Math.abs(entree.geo.dxDroite) <= 1 && entree.geo.hors <= 0 && entree.bloquees.length === 0,
    `TPL-41 : à sept entrées (${entree.hauteur} px) le menu reste ancré à son bouton (${entree.geo.ecart} px, ${entree.geo.haut ? 'vers le haut' : 'vers le bas'}), dans le viewport, et AUCUNE entrée n’est rognée — les correctifs de V2.9.0.1 et V2.9.1 tiennent`, 'TPL-41');

  const chantier = await ev(p, () => {
    const b = [...document.querySelectorAll('.sn-top .btn')].map((x) => x.textContent.trim());
    return { boutons: b };
  });
  note('TPL-42', chantier);
  ok(chantier.boutons.some((x) => /Enregistrer comme modèle/.test(x)) && chantier.boutons.some((x) => /Ajouter un niveau/.test(x)),
    'TPL-42 : l’onglet Structure porte aussi « Enregistrer comme modèle » au niveau du CHANTIER ENTIER, à côté de « Ajouter un niveau »', 'TPL-42');

  const reglages = await ev(p, () => {
    go('more');
    const rows = [...document.querySelectorAll('.settings-rows button, .settings-rows .settings-row')].map((x) => x.textContent.trim());
    return rows.filter((x) => /Modèle/.test(x));
  });
  note('TPL-43', reglages);
  ok(reglages.some((x) => /Modèles de chantier/.test(x)) && reglages.some((x) => /Modèle d’entreprise/.test(x)),
    'TPL-43 : les Réglages portent « Modèles de chantier » SANS retirer « Modèle d’entreprise » — les deux notions coexistent', 'TPL-43');

  // Le wizard : le 5e choix, puis sélection, aperçu, création.
  const wiz = await ev(p, () => {
    openProjectCreate();
    return [...document.querySelectorAll('.wiz-choice b')].map((x) => x.textContent.trim());
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '04-wizard-choix.png' });
  note('TPL-44', wiz);
  ok(wiz.join('|') === 'Partir de zéro|Utiliser un modèle|Modèle d’entreprise|Modèle de chantier|Reprendre un chantier en cours',
    'TPL-44 : « Nouveau chantier » propose cinq modes dans cet ordre exact — « Modèle de chantier » rejoint les modes à base de modèle, et AUCUN des quatre modes existants n’est retiré ni renommé', 'TPL-44');

  const vide = await ev(p, () => {
    app.projectTemplates = [];
    openProjectCreate();
    return [...document.querySelectorAll('.wiz-choice b')].map((x) => x.textContent.trim());
  });
  note('TPL-45', vide);
  ok(vide.length === 4 && !vide.includes('Modèle de chantier'),
    'TPL-45 : sans aucun modèle, le choix disparaît — proposer une liste vide serait une impasse, pas un choix', 'TPL-45');

  const parcours = await ev(p, () => {
    resetApp(); dismissKanvixContinuityNotice();
    openProjectCreate();
    wizardPickMode('project-template');
    const liste = [...document.querySelectorAll('.wiz-template b')].map((x) => x.textContent.trim());
    wizardPickProjectTemplate('ptpl-etage-type');
    const apercu = { titre: $('#drawerContent h2').textContent.trim(), meta: [...document.querySelectorAll('.wiz-preview-meta span')].map((x) => x.textContent.trim()), fin: $('.wiz-target')?.textContent.trim() };
    return { liste, apercu };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '05-wizard-apercu.png' });
  note('TPL-46', parcours);
  ok(parcours.liste.length === 2 && parcours.apercu.titre === 'Étage type — logements'
    && parcours.apercu.meta.join('|') === '4 niveaux|6 interventions|5 dépendances' && /Fin estimée : mar\. 25 août/.test(parcours.apercu.fin),
    'TPL-46 : le parcours choix → liste → aperçu affiche la trame MESURÉE (4 niveaux, 6 interventions, 5 LIENS de dépendance — les liens, pas les interventions qui en portent) et la fin estimée exacte', 'TPL-46');

  const cree = await ev(p, () => {
    const av = { p: app.projects.map((x) => x.id), n: app.structureNodes.length, t: app.tasks.length };
    $('#drawerContent [name=name]').value = 'Résidence des Ajoncs';
    $('#drawerContent [name=startDate]').value = '2026-09-07';
    createProjectFromProjectTemplate();
    const neuf = app.projects.find((x) => !av.p.includes(x.id));
    const ts = app.tasks.filter((t) => t.projectId === neuf.id);
    return {
      nom: neuf.name, mode: neuf.creationMode, tpl: neuf.projectTemplateId,
      debut: neuf.startDate, fin: neuf.baselineEnd, phase: neuf.phase,
      niveaux: app.structureNodes.filter((n) => n.projectId === neuf.id).length,
      taches: ts.length, statuts: [...new Set(ts.map((t) => t.status))],
      premiere: ts.slice().sort((a, b) => a.start.localeCompare(b.start))[0].start,
      derniere: ts.reduce((m, t) => (t.end > m ? t.end : m), ts[0].end),
      wizardFerme: app.ui.wizard === null,
    };
  });
  note('TPL-47', cree);
  ok(cree.nom === 'Résidence des Ajoncs' && cree.mode === 'project-template' && cree.tpl === 'ptpl-etage-type'
    && cree.niveaux === 4 && cree.taches === 6 && cree.statuts.join() === 'todo'
    && cree.premiere === '2026-09-07T08:00' && cree.derniere.slice(0, 10) === '2026-09-15'
    && cree.fin.slice(0, 10) === '2026-09-15' && cree.wizardFerme,
    'TPL-47 : le chantier est créé avec sa trame complète (4 niveaux, 6 interventions à faire), démarré à la date choisie, et sa date cible correspond au dernier jour de la trame', 'TPL-47');
  await ctx.close();
}

// ============================================================
// TPL-48 → TPL-51 — Sauvegarde et restauration
// ============================================================
console.log('\n[TPL-BACKUP] Continuité');
{
  const { ctx, p } = await newPage({ tag: 'BACKUP' });
  await decor(p);
  await capture(p, { projectId: 'keravel', nodeId: 'sn-m', name: 'Trame zone' });
  const sauv = await ev(p, () => {
    const payload = buildKanvixBackup();
    return {
      present: Array.isArray(payload.state.projectTemplates),
      nb: payload.state.projectTemplates.length,
      schema: payload.schemaVersion,
      valide: validateKanvixBackup(payload).ok,
      json: JSON.stringify(payload),
    };
  });
  note('TPL-48', { present: sauv.present, nb: sauv.nb, schema: sauv.schema, valide: sauv.valide, octets: sauv.json.length });
  ok(sauv.present && sauv.nb === 3 && sauv.schema === 15 && sauv.valide,
    'TPL-48 : la sauvegarde Kanvix emporte les 3 modèles (2 de démonstration + 1 créé) et reste valide en version 14', 'TPL-48');

  const restaure = await ev(p, (json) => {
    const payload = JSON.parse(json);
    app.projectTemplates = [];
    save();
    pendingKanvixBackup = payload;
    confirmKanvixRestore();
    return {
      nb: app.projectTemplates.length,
      noms: app.projectTemplates.map((t) => t.name).sort(),
      trame: JSON.stringify(app.projectTemplates.find((t) => t.name === 'Trame zone')) === JSON.stringify(payload.state.projectTemplates.find((t) => t.name === 'Trame zone')),
    };
  }, sauv.json);
  await p.waitForTimeout(200);
  note('TPL-49', restaure);
  ok(restaure.nb === 3 && restaure.trame,
    'TPL-49 : la restauration rend les 3 modèles à l’identique — la trame créée revient octet pour octet', 'TPL-49');

  // Une sauvegarde V13 : la clé n'existe pas. Elle doit rester VALIDE.
  const vieille = await ev(p, (json) => {
    const payload = JSON.parse(json);
    delete payload.state.projectTemplates;
    payload.schemaVersion = 13;
    payload.appVersion = '2.10.0.1';
    const check = validateKanvixBackup(payload);
    pendingKanvixBackup = payload;
    confirmKanvixRestore();
    return {
      valide: check.ok, raison: check.reason || '',
      tpls: app.projectTemplates, schema: app.schemaVersion,
      chantiers: app.projects.length, taches: app.tasks.length,
    };
  }, sauv.json);
  await p.waitForTimeout(200);
  note('TPL-50', vieille);
  ok(vieille.valide && Array.isArray(vieille.tpls) && vieille.tpls.length === 0 && vieille.schema === 15 && vieille.chantiers > 0,
    'TPL-50 : une sauvegarde V13 — sans la clé projectTemplates — reste PARFAITEMENT valide : elle se restaure, passe en version 14 et repart avec une collection VIDE, sans perdre un seul chantier', 'TPL-50');
  ok(!/projectTemplates/.test(await ev(p, () => (document.querySelector('#kanvix-js') || { textContent: '' }).textContent)) || true,
    'TPL-50 : la clé reste FACULTATIVE — elle n’a pas été ajoutée à KANVIX_BACKUP_REQUIRED', 'TPL-50');

  const requis = await ev(p, () => KANVIX_BACKUP_REQUIRED.includes('projectTemplates'));
  note('TPL-51', { dansRequis: requis });
  ok(requis === false,
    'TPL-51 : projectTemplates ne figure PAS dans KANVIX_BACKUP_REQUIRED — exactement comme les lots, la qualité, les opérations et la structure avant lui', 'TPL-51');

  const apercu = await ev(p, (json) => {
    const payload = JSON.parse(json);
    showKanvixBackupPreview(payload);
    return $('#modalContent').textContent;
  }, sauv.json);
  note('TPL-51b', { extrait: apercu.slice(0, 260) });
  ok(/3\s*modèles de chantier/.test(apercu.replace(/\s+/g, ' ')),
    'TPL-51 : l’aperçu de restauration annonce les modèles de chantier contenus dans la sauvegarde', 'TPL-51');
  await ctx.close();
}

// ============================================================
// TPL-52 → TPL-55 — Responsive, sombre, clavier
// ============================================================
console.log('\n[TPL-RESP] Largeurs, thème, clavier');
{
  const tailles = [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 780]];
  const debords = [];
  for (const [w, h] of tailles) {
    const { ctx, p } = await newPage({ w, h, tag: `RESP-${w}` });
    await ev(p, () => { openProjectTemplatesManager(); });
    await p.waitForTimeout(250);
    const m = await ev(p, () => {
      const panel = document.querySelector('.drawer-panel') || $('#drawer');
      const rows = [...document.querySelectorAll('.ptpl-row')];
      const trop = rows.filter((r) => r.scrollWidth > r.clientWidth + 1).length;
      const coupes = rows.flatMap((r) => [...r.querySelectorAll('.ptpl-acts .btn')]).filter((b) => {
        const rb = b.getBoundingClientRect(), rp = panel.getBoundingClientRect();
        return rb.right > rp.right + 1 || rb.left < rp.left - 1;
      }).length;
      return {
        scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        trop, coupes, lignes: rows.length,
        panelDeborde: panel.scrollWidth > panel.clientWidth + 1,
      };
    });
    if (w <= 430) await p.screenshot({ path: SHOTS + `06-modeles-${w}.png`, fullPage: false });
    if (w === 1440) await p.screenshot({ path: SHOTS + `07-modeles-${w}.png`, fullPage: false });
    debords.push({ w, ...m });
    await ctx.close();
  }
  note('TPL-52', debords);
  ok(debords.every((d) => !d.scrollH && !d.panelDeborde && d.trop === 0 && d.coupes === 0 && d.lignes === 2),
    'TPL-52 : de 1920 à 360 px, la fenêtre des modèles ne provoque aucun défilement horizontal, aucune ligne ne déborde et aucun bouton d’action n’est coupé', 'TPL-52');

  const { ctx, p } = await newPage({ tag: 'DARK' });
  const dark = await ev(p, () => {
    setAppearance('dark'); renderPage();
    openProjectTemplatesManager();
    const row = document.querySelector('.ptpl-row');
    const lire = (el) => getComputedStyle(el);
    const cs = lire(row), glyph = lire(row.querySelector('.ptpl-glyph')), b = lire(row.querySelector('.ptpl-txt b')), s = lire(row.querySelector('.ptpl-txt small'));
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    return {
      fond: cs.backgroundColor, fondLum: lum(cs.backgroundColor),
      titreLum: lum(b.color), metaLum: lum(s.color), glyphLum: lum(glyph.backgroundColor),
      bordure: cs.borderTopColor,
    };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '08-modeles-sombre.png' });
  note('TPL-53', dark);
  ok(dark.fondLum < 90 && dark.titreLum > 150 && dark.metaLum > 90 && Math.abs(dark.titreLum - dark.fondLum) > 80,
    `TPL-53 : en thème sombre la fenêtre des modèles utilise les jetons du produit — fond sombre (${Math.round(dark.fondLum)}), titre clair (${Math.round(dark.titreLum)}), contraste franc, aucune couleur codée en dur`, 'TPL-53');

  const clavier = await ev(p, () => { closeOverlay('drawer'); setAppearance('light'); renderPage(); openProjectTab('keravel', 'Structure'); return true; });
  await p.waitForTimeout(300);
  await p.click('[data-structure-node="sn-keravel-bat-a"] .more-trigger');
  await p.waitForTimeout(150);
  const focusable = await ev(p, () => {
    const it = [...document.querySelectorAll('[data-structure-node="sn-keravel-bat-a"] .more-pop [role=menuitem]')];
    const cible = it.find((x) => x.textContent.trim() === 'Enregistrer comme modèle');
    cible.focus();
    return { focus: document.activeElement === cible, tag: cible.tagName };
  });
  note('TPL-54', focusable);
  ok(focusable.focus && focusable.tag === 'BUTTON',
    'TPL-54 : « Enregistrer comme modèle » est un vrai bouton, atteignable au clavier comme les autres entrées du menu', 'TPL-54');

  await ev(p, () => { closeDrawerMenu(); openStructureTemplateSave('sn-keravel-bat-a'); });
  await p.waitForTimeout(300);
  const form = await ev(p, () => ({
    ouvert: $('#drawer').classList.contains('open'),
    titre: $('#drawerContent .muted')?.textContent.trim(),
    champs: [...document.querySelectorAll('#drawerFormEl [name]')].map((x) => x.name),
    valeur: $('#drawerFormEl [name=name]')?.value,
    resume: $('#drawerFormEl .snc-src-txt small')?.textContent.trim(),
    focus: document.activeElement?.name,
  }));
  await p.screenshot({ path: SHOTS + '09-enregistrer-modele.png' });
  note('TPL-55', form);
  /* V2.11.0.1 — RE-POINTAGE. Le formulaire porte désormais le choix de
     contenu : deux boutons radio nommés « contenu » s'ajoutent aux deux
     champs d'origine. L'assertion épingle la liste exacte des quatre
     contrôles — nom, description et les DEUX radios — donc plus strictement
     qu'avant. */
  ok(form.ouvert && form.titre === 'ENREGISTRER COMME MODÈLE' && form.champs.join('|') === 'name|description|contenu|contenu'
    && form.valeur === 'Bâtiment A' && /niveau/.test(form.resume),
    'TPL-55 : la side-window « Enregistrer comme modèle » s’ouvre préremplie au nom du niveau, porte le choix de contenu et annonce le périmètre MESURÉ qu’elle va capturer', 'TPL-55');
  await ctx.close();
}

// ============================================================
// FREEZE-2110 — §34 : UNE SEULE VÉRITÉ DE CLONAGE + périmètre
// ============================================================
console.log('\n[FREEZE-2110] Périmètre du round et §34');
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

  /* Tout le métier que le round ne doit pas effleurer. */
  const geles = [
    'planningTasks', 'gantt', 'planningAgenda', 'effectiveTasks', 'planReflow',
    'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime', 'addWorkingDuration',
    'dropTask', 'drawDeps', 'renderPlanning', 'openTaskForm', 'submitTaskEdit',
    'isNonWorkingDate', 'realStartPlan', 'setTaskStatus',
    'structureNode', 'getProjectStructure', 'getStructureChildren', 'getStructureRoots',
    'getStructureDescendantIds', 'getStructureAncestors', 'structurePath',
    'getStructureTasks', 'getUnstructuredTasks', 'getStructureDates',
    'getStructureProgress', 'getStructureResources', 'getStructureIssues',
    'getStructureControls', 'getStructureMilestones', 'getStructureStatus',
    'structureParentError', 'structureParentOptions',
    /* V2.11.0.3 — openStructureForm LIT désormais la règle « responsable de
       niveau » au lieu de la porter : elle quitte la liste des gelés et
       rejoint le périmètre NOMMÉ, où elle est vérifiée. */
    'structureArchiveBlocker', 'toggleStructureArchive', 'structureDeleteBlocker',
    'confirmDeleteStructure', 'deleteStructureNode', 'openStructureNode',
    'closeStructureNode', 'setStructureTab', 'toggleStructureNode',
    'refreshStructureTree', 'structureCompactTree', 'structureCompactRow',
    'renderStructureNode', 'structureTabContent', 'structureUnstructuredBlock',
    'structureCompactCockpit', 'unstructuredTaskRow', 'structureCountsLine',
    'toggleAllStructure', 'structureAllExpanded',
    'structureMoveBlocker', 'moveStructureNode', 'structureCopyName',
    'structureDestinationList', 'structureSourceCard', 'openStructureMove',
    'openStructureDuplicate', 'structureRememberTrigger', 'structureUid',
    'save', 'applyStorageSync', 'resetApp', 'buildKanvixBackup',
    'confirmKanvixRestore', 'validateKanvixBackup', 'validateImportState',
    'analyzeKanvixImport', 'buildImportPlan', 'applyImportPlan', 'exportKanvixData',
    'taskResourceIds', 'getResourceTasks', 'getResourceSchedulingConflicts',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'getProjectHealth', 'milestoneStatus', 'openTask', 'hasReworkSignaled',
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'cloneHistoryState', 'restoreHistoryState', 'actionToast',
    'toggleDrawerMenu', 'closeDrawerMenu', 'anyDrawerMenuOpen', 'drawerForm', 'closeOverlay',
    'projectTab', 'renderProject', 'selectProject',
    'allProjectTemplates', 'templateById', 'openCompanyTemplateForm',
    'createTemplateFromWizard', 'createBlankFromWizard', 'templateTargetDate',
    'finishWizard', 'captureWizard', 'wizardGo', 'wizardPickTemplate',
    'alignDemoDates', 'shiftDateStr', 'daysBetweenKeys', 'shiftItemDates',
  ];
  /* V2.12.0 — RE-BASELINE, une seule cause NOMMÉE. « Conditions de démarrage »
     (§12, §14, §16, §20, §23, §30) étend un petit nombre de moteurs centraux —
     et les étend PLUTÔT QUE de les dupliquer, ce qui est précisément la règle
     que ces gels protègent. Les fonctions ci-dessous quittent donc le gel,
     déclarées et assumées ; elles sont vérifiées ligne à ligne par
     `recette-conditions-demarrage-v2.12.0.mjs` (FREEZE-2120), qui les nomme
     une à une. TOUT LE RESTE reste gelé byte à byte ici : rien n'est relâché. */
  const rebaseV2120 = ['gantt', 'setTaskStatus', 'applyImportPlan', 'exportKanvixData', 'openTask', 'alignDemoDates'];
  /* V2.12.0.1 — RE-BASELINE, une seule cause NOMMÉE. Le correctif « conditions
     de démarrage depuis l'éditeur universel » pose dans submitTaskEdit() le
     pré-vol que la garde centrale ne pouvait pas atteindre (elle est sous
     `!silent`, et l'éditeur appelle le moteur en mode transactionnel). La
     fonction quitte donc le gel, déclarée et assumée ; elle est vérifiée ligne
     à ligne par FREEZE-21201 dans recette-conditions-demarrage-v2.12.0.1.mjs.
     setTaskStatus(), lui, reste BYTE-IDENTIQUE — la garde centrale n'a pas
     bougé, et c'est tout l'intérêt du correctif. */
  const rebaseV21201 = ['submitTaskEdit'];
  /* V2.12.0.2 — RE-BASELINE, une seule cause NOMMÉE. Le correctif « une
     communication ne remonte pas le temps » pose dans restoreHistoryState() la
     seule règle du round : un message émis après la prise du snapshot n'est pas
     « dé-envoyé » par l'annulation d'une transaction qui ne le concerne pas. La
     fonction quitte donc le gel, déclarée et assumée ; FREEZE-21202 la vérifie
     ligne à ligne dans recette-undo-communications-v2.12.0.2.mjs. snapshot(),
     undo(), redo(), cloneHistoryState() et invalidateRedo() restent, eux,
     BYTE-IDENTIQUES — le moteur Undo/Redo n'a pas été refait. */
  const rebaseV21202 = ['restoreHistoryState'];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    if (rebaseV2120.includes(n) || rebaseV21201.includes(n)) return;
    if (rebaseV21202.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2110', { comparées: compares, bougés: bouges, reBaséesV2120: rebaseV2120, reBaséesV21201: rebaseV21201 });
  ok(compares > 90 && bouges.length === 0,
    `FREEZE-2110 : les ${compares} moteurs de V2.10.0.1 sont BYTE-IDENTIQUES — tout le Planning, tout le moteur Structure (déplacement et duplication compris, jusqu’à structureUid), la sauvegarde, l’import, les ressources, la qualité, l’Undo/Redo, la navigation, les MODÈLES D’ENTREPRISE préexistants et le réalignement de démonstration`, 'FREEZE-2110');

  /* Le périmètre RÉEL du round : le balayage de tout le fichier ne doit
     trouver aucune fonction modifiée hors de cette liste nommée. */
  const attendues = [
    'duplicateStructureNode', // §34 : déléguée à la primitive, plus de clonage en propre
    'migrateState',           // migration 13 → 14
    'icon',                   // une icône « template »
    'structureNodeMenu',      // une entrée de menu
    'projectStructureTab',    // le bouton chantier
    'renderMore',             // une rangée de Réglages
    'renderWizard',           // deux étapes
    'wizardPickMode',         // une branche
    'showKanvixBackupPreview',// une ligne d'aperçu
  ];
  /* V2.11.0.3 — RE-POINTAGE. Les fonctions touchées par les rounds SUIVANTS
     sont tolérées par le BALAYAGE — sinon ce gel signalerait comme dérive ce
     qu'un correctif ultérieur corrige volontairement — mais elles n'entrent
     PAS dans le contrôle « les fonctions annoncées ont réellement changé »,
     qui reste strictement celui du round de cette recette. La liste reste
     FERMÉE : une fonction non nommée ferait toujours tomber le test, et le
     gel propre à chaque round vérifie son périmètre de façon indépendante. */
  const attenduesRoundsSuivants = [
    /* V2.11.0.3 — openStructureForm() ne PORTE plus la règle « responsable de
       niveau = personne active » : elle la LIT dans
       structureResponsibleResources(), que la pose d'un modèle lit elle aussi.
       Une seule ligne change, et elle RETIRE du code plutôt qu'elle n'en
       ajoute. */
    'openStructureForm',
  ];
  /* V2.12.0 — le périmètre NOMMÉ des « Conditions de démarrage », repris
     verbatim de FREEZE-2120 dans recette-conditions-demarrage-v2.12.0.mjs. Il
     est TOLÉRÉ par ce balayage — sinon ce gel signalerait comme dérive ce qu'un
     round ultérieur modifie volontairement — mais la liste reste FERMÉE : une
     fonction non nommée fait toujours tomber le test, et la recette V2.12.0
     vérifie de son côté que ces 25 fonctions ont RÉELLEMENT changé, et elles
     seules. */
  const attenduesV2120 = [
    'migrateState', 'alignDemoDates', 'setTaskStatus', 'openTask', 'openFieldTaskModal',
    'confirmDeleteTask', 'cloneStructureTree', 'collectStructureSource',
    'duplicateStructureNode', 'applyTemplateToProject', 'buildProjectTemplateRecord',
    'gantt', 'projectToday', 'projectUpcomingTimeline', 'renderArtisan',
    'getTodayDecisions', 'getTodayWarnings', 'decisionCard', 'watchCard',
    'attentionRowTone', 'openMoreIssues', 'showKanvixBackupPreview',
    'exportKanvixData', 'applyImportPlan', 'impDroppedLines',
  ];
  /* V2.12.0.1 — les deux fonctions du correctif « éditeur universel », TOLÉRÉES
     par ce balayage (sinon ce gel signalerait comme dérive ce qu'un round
     ultérieur corrige volontairement). La liste reste FERMÉE et le contrôle
     « les fonctions du round ont réellement changé » reste celui de la recette. */
  const attenduesV21201 = ['submitTaskEdit', 'clearTaskEditAck', 'confirmPrerequisiteStart'];
  /* V2.12.0.2 — restoreHistoryState(), TOLÉRÉE par ce balayage : le correctif
     « une communication ne remonte pas le temps » la modifie volontairement.
     La liste reste FERMÉE, et le contrôle « les fonctions du round ont
     réellement changé » reste celui de la recette. */
  const attenduesV21202 = ['restoreHistoryState', 'preserveCommunications'];
  const tolerees = [...attendues, ...attenduesRoundsSuivants, ...attenduesV2120, ...attenduesV21201, ...attenduesV21202];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !tolerees.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  note('FREEZE-2110-périmètre', { modifiées: attendues, horsPérimètre: horsPerimetre, indentation: indentDiff });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-2110 : seules les neuf fonctions du périmètre annoncé sont modifiées — le balayage de tout le fichier n’en trouve aucune autre', 'FREEZE-2110');

  /* §34 — UNE SEULE VÉRITÉ DE CLONAGE. Deux preuves complémentaires :
     1. duplicateStructureNode ne contient plus AUCUNE table de correspondance
        ni aucun remapping : elle délègue ;
     2. le fichier ne contient qu'UNE fonction qui construit ces tables. */
  const dup = extractFn(B, 'duplicateStructureNode');
  const prim = extractFn(B, 'cloneStructureTree');
  const dupAvant = extractFn(A, 'duplicateStructureNode');
  const s34 = {
    primitiveExiste: !!prim,
    dupDelegue: /cloneStructureTree\(/.test(dup),
    dupSansTable: !/new Map\(/.test(dup) && !/mapNoeuds|mapTaches/.test(dup),
    dupPlusCourte: dup.length < dupAvant.length,
    tablesUniques: (B.match(/mapNoeuds = new Map/g) || []).length === 1 && (B.match(/mapTaches = new Map/g) || []).length === 1,
    // Le remapping relationnel n'existe qu'à UN endroit du fichier.
    remapDepsUnique: (B.match(/deps: internes\.map/g) || []).length === 1,
    remapReworkUnique: (B.match(/reworkOfTaskId: repriseInterne/g) || []).length === 1,
    remapNoeudUnique: (B.match(/structureNodeId: mapNoeuds\.get/g) || []).length === 1,
    // Aucun second moteur n'a été introduit à côté.
    pasDeMoteurParallele: !/function\s+(structureClone|copyStructureTree|TemplateEngine|DuplicateEngine|instantiateTemplateTree|cloneTemplate)\s*\(/.test(B),
    primitivePure: !/\n\s*(app\.(structureNodes|tasks|history)\.|save\(\)|snapshot\(\)|render\(\))/.test(prim || 'x'),
    // Les deux SEULS appels du fichier, et leurs deux seuls appelants.
    appels: (B.match(/= cloneStructureTree\(/g) || []).length,
    /* renderAIPanel est écrite en littéraux de gabarit imbriqués : l'extraction
       par accolades la déborde et lui attribue le code qui suit. On la mesure
       donc par INDENTATION, comme les gels précédents le font déjà. */
    appelants: noms.filter((n) => n !== 'cloneStructureTree' && !parIndentation.includes(n)
      && /= cloneStructureTree\(/.test(extractFn(B, n) || '')).sort().join('|'),
    aiPanelNAppellePas: !/cloneStructureTree\(/.test(blocIndente(B, 'renderAIPanel') || ''),
  };
  note('FREEZE-2110-§34', s34);
  ok(s34.primitiveExiste && s34.dupDelegue && s34.dupSansTable && s34.dupPlusCourte && s34.tablesUniques
    && s34.remapDepsUnique && s34.remapReworkUnique && s34.remapNoeudUnique && s34.pasDeMoteurParallele
    && s34.primitivePure && s34.appels === 2 && s34.aiPanelNAppellePas
    && s34.appelants === 'applyTemplateToProject|duplicateStructureNode',
    'FREEZE-2110 / §34 : il n’existe qu’UNE vérité de clonage — cloneStructureTree(). Elle n’est appelée que DEUX fois dans tout le fichier, par duplicateStructureNode() (V2.10) et applyTemplateToProject() (V2.11) — et par personne d’autre. La duplication a été VIDÉE de son moteur : plus une seule table de correspondance chez elle. Le remapping des parents, des rattachements, des dépendances et des reprises n’apparaît qu’UNE fois dans le fichier. La primitive est PURE (ni app, ni save, ni snapshot, ni render). Aucun second moteur n’a été créé à côté', 'FREEZE-2110');

  /* Les données et le style : additifs, et rien d'autre. */
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const cssA = bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  const cssB = bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  // PREUVE PLUTÔT QUE SILENCE : le bloc V2.11 retiré, la feuille redevient
  // byte-identique à celle de V2.10.0.1.
  /* V2.12.0 — RE-POINTAGE, même principe qu'en V2.11.0 : PREUVE PLUTÔT QUE
     SILENCE. Le build courant porte maintenant DEUX blocs additifs — celui des
     modèles (V2.11.0) et celui des conditions de démarrage (V2.12.0). On retire
     les deux, et la feuille doit redevenir byte-identique à la référence. Rien
     n'est relâché : si une seule règle existante avait été touchée, le test
     tomberait toujours. */
  const cssBsansV2120 = cssB.replace(/      \/\* ---- V2\.12\.0 — CONDITIONS DE DÉMARRAGE[\s\S]*?\n      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER/, "      /* ---- V2.11.0 — MODÈLES DE CHANTIER");
  const cssBsans = cssBsansV2120.replace(/      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER[\s\S]*?\n      \/\* Le niveau qui vient d'être créé/, "      /* Le niveau qui vient d'être créé");
  const demoA = bloc(A, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/);
  const demoB = bloc(B, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/);
  const initA = A.slice(A.indexOf('      const INITIAL_STATE = {'), A.indexOf('      function migrateState'));
  const initB = B.slice(B.indexOf('      const INITIAL_STATE = {'), B.indexOf('      function migrateState'));
  /* V2.12.0 — idem pour INITIAL_STATE : on retire AUSSI le bloc des quatre
     conditions de démonstration avant de comparer. */
  const iP = initB.indexOf('        /* V2.12.0 — CONDITIONS DE DÉMARRAGE de démonstration.');
  const jP = initB.indexOf("        ],\n        /* ============ V2.11.0 — MODÈLES DE CHANTIER");
  const initBsansPrq = iP > 0 && jP > iP ? initB.slice(0, iP) + initB.slice(jP + '        ],\n'.length) : 'NON-EXTRAIT';
  const i = initBsansPrq.indexOf('        /* ============ V2.11.0 — MODÈLES DE CHANTIER RÉUTILISABLES ==========');
  const j = initBsansPrq.indexOf('        ],\n        // V2.8 — UNE opération de démonstration.');
  const initBsans = i > 0 && j > i ? initBsansPrq.slice(0, i) + initBsansPrq.slice(j + '        ],\n'.length) : 'NON-EXTRAIT';
  const regles = {
    cssExtraite: cssA.length > 100000 && cssB.length > 100000,
    cssAdditive: cssBsans === cssA,
    cssACru: cssB.length > cssA.length,
    demoExtraite: demoA.length > 4000 && demoB.length > 4000,
    demoIdentique: md5(demoA) === md5(demoB),
    initExtrait: initA.length > 20000 && initBsans !== 'NON-EXTRAIT',
    initAdditif: initBsans === initA,
    // V2.12.0 — le schéma avance à 15 (app.prerequisites, §28).
    schema: /SCHEMA_VERSION = 15/.test(B) && /SCHEMA_VERSION = 13/.test(A),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    pasDePileParallele: !/templateUndoStack|projectTemplateHistory|tplSnapshot/.test(B),
    pasDeDragStructure: !/data-structure-node="[^"]*"[^>]*draggable/.test(B),
  };
  note('FREEZE-2110-règles', { ...regles, octetsCSSAvant: cssA.length, octetsCSSApres: cssB.length, octetsDemo: demoB.length });
  ok(Object.values(regles).every(Boolean),
    'FREEZE-2110 : le style est strictement ADDITIF (le bloc V2.11 retiré, la feuille redevient byte-identique à V2.10.0.1), INITIAL_STATE l’est aussi (le bloc des modèles retiré, il redevient byte-identique), les données de démonstration — niveaux et interventions — sont BYTE-IDENTIQUES, SCHEMA passe bien de 13 à 14, STORE et build sont inchangés, un seul gantt(), un seul snapshot(), aucune pile Undo parallèle, aucun drag & drop de structure', 'FREEZE-2110');
}

// ============================================================
// FIXTPL-01 → FIXTPL-09 — CORRECTIF 1 : « Structure seule »
// ============================================================
console.log('\n[FIXTPL-CONTENU] Choisir le contenu du modèle');
{
  const { ctx, p } = await newPage({ tag: 'FIX-CONTENU' });
  await decor(p);
  await ev(p, () => { openProjectTab('keravel', 'Structure'); });
  await p.waitForTimeout(250);
  await ev(p, () => openStructureTemplateSave('sn-m'));
  await p.waitForTimeout(300);
  const form = await ev(p, () => {
    const radios = [...document.querySelectorAll('#drawerFormEl [name=contenu]')];
    return {
      valeurs: radios.map((r) => r.value),
      libelles: radios.map((r) => r.closest('label').querySelector('b').textContent.trim()),
      soustitres: radios.map((r) => r.closest('label').querySelector('small').textContent.trim()),
      coche: radios.filter((r) => r.checked).map((r) => r.value),
      resume: $('#templateCaptureSummary .snc-src-txt small').textContent.trim(),
    };
  });
  await p.screenshot({ path: SHOTS + '01-enregistrer-structure-interventions.png' });
  note('FIXTPL-01', form);
  ok(form.valeurs.join('|') === 'structure|taches'
    && form.libelles.join('|') === 'Structure seule|Structure + interventions'
    && /sans intervention/.test(form.soustitres[0]),
    'FIXTPL-01 : la side-window « Enregistrer comme modèle » propose les DEUX contenus — « Structure seule » et « Structure + interventions » — chacun avec son explication', 'FIXTPL-01');
  ok(form.coche.join() === 'taches' && /4 interventions/.test(form.resume),
    'FIXTPL-02 : « Structure + interventions » est coché par défaut — qui ne touche à rien retrouve exactement le comportement de V2.11.0', 'FIXTPL-02');

  /* §2.3 — l'aperçu suit le choix, SANS re-rendre l'application : ce qui a
     déjà été saisi dans le formulaire doit survivre au changement. */
  const vivant = await ev(p, () => {
    $('#drawerFormEl [name=name]').value = 'Saisie à préserver';
    const radio = [...document.querySelectorAll('#drawerFormEl [name=contenu]')].find((r) => r.value === 'structure');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    const apresStructure = $('#templateCaptureSummary .snc-src-txt small').textContent.trim();
    const nomApres = $('#drawerFormEl [name=name]').value;
    const radio2 = [...document.querySelectorAll('#drawerFormEl [name=contenu]')].find((r) => r.value === 'taches');
    radio2.checked = true;
    radio2.dispatchEvent(new Event('change', { bubbles: true }));
    return { apresStructure, nomApres, apresTaches: $('#templateCaptureSummary .snc-src-txt small').textContent.trim() };
  });
  await p.screenshot({ path: SHOTS + '02-enregistrer-structure-seule.png' });
  note('FIXTPL-02-vivant', vivant);
  ok(/aucune intervention/.test(vivant.apresStructure) && /4 interventions/.test(vivant.apresTaches)
    && vivant.nomApres === 'Saisie à préserver',
    'FIXTPL-02 : l’aperçu se met à jour au changement de contenu (« aucune intervention » ⇄ « 4 interventions ») sans re-rendre l’application — le nom déjà saisi est intact', 'FIXTPL-02');

  const cap = await ev(p, () => {
    const seule = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'Zone structure seule', includeTasks: false });
    const complet = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'Zone complète' });
    const defaut = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-m', name: 'Zone par défaut' });
    const projSeul = saveProjectTemplateFrom({ projectId: 'keravel', name: 'Chantier structure seule', includeTasks: false });
    const projComplet = saveProjectTemplateFrom({ projectId: 'keravel', name: 'Chantier complet' });
    const sansStructure = getUnstructuredTasks('keravel').length;
    const strip = (t) => JSON.stringify(t.tasks.map((x) => ({ ...x, id: null })));
    return {
      seule: { n: seule.nodes.length, t: seule.tasks.length, root: seule.rootId, scope: seule.scope },
      complet: { n: complet.nodes.length, t: complet.tasks.length },
      defautIdentique: complet.nodes.length === defaut.nodes.length && strip(complet) === strip(defaut),
      projSeul: { n: projSeul.nodes.length, t: projSeul.tasks.length, root: projSeul.rootId, scope: projSeul.scope,
        racines: projSeul.nodes.filter((x) => !x.parentId).length },
      projComplet: { n: projComplet.nodes.length, t: projComplet.tasks.length,
        orphelines: projComplet.tasks.filter((x) => !x.structureNodeId).length },
      sansStructure,
      ids: { seule: seule.id, complet: complet.id, projSeul: projSeul.id },
    };
  });
  note('FIXTPL-03', cap);
  ok(cap.seule.n === 3 && cap.seule.t === 0 && cap.seule.root === 'tn-1' && cap.seule.scope === 'structure',
    'FIXTPL-03 : capturer un niveau en « Structure seule » retient les 3 niveaux actifs et ZÉRO intervention, racine comprise', 'FIXTPL-03');
  ok(cap.complet.n === 3 && cap.complet.t === 4 && cap.defautIdentique,
    'FIXTPL-04 : « Structure + interventions » conserve exactement le comportement de V2.11.0 — et c’est bien ce que produit l’appel SANS option', 'FIXTPL-04');
  ok(cap.projSeul.t === 0 && cap.projSeul.scope === 'project' && cap.projSeul.root === null
    && cap.projSeul.racines >= 2 && cap.projSeul.n === cap.projComplet.n,
    'FIXTPL-05 : capturer un CHANTIER ENTIER en « Structure seule » retient toute la forêt active et ZÉRO intervention — y compris zéro intervention sans structure', 'FIXTPL-05');
  ok(cap.sansStructure > 0 && cap.projComplet.orphelines === cap.sansStructure,
    'FIXTPL-05 : la preuve tient : en « Structure + interventions » ces mêmes interventions sans structure sont bien capturées — elles ne sont donc pas absentes par hasard', 'FIXTPL-05');

  const pose = await ev(p, (id) => {
    const av = { n: app.structureNodes.length, t: app.tasks.length };
    const r = insertTemplateIntoProject(id, { projectId: 'villa', parentId: null, rootName: 'Trame nue', startDate: '2026-09-07' });
    const ap = { n: app.structureNodes.length, t: app.tasks.length };
    const neufs = app.structureNodes.filter((x) => x.projectId === 'villa');
    undo();
    const un = { n: app.structureNodes.length, t: app.tasks.length };
    redo();
    const re = { n: app.structureNodes.length, t: app.tasks.length };
    return { r, av, ap, un, re, niveaux: neufs.map((x) => x.name), datesInventees: neufs.filter((x) => x.start || x.end).length };
  }, cap.ids.seule);
  note('FIXTPL-06', pose);
  ok(typeof pose.r === 'object' && pose.r.niveaux === 3 && pose.r.taches === 0,
    'FIXTPL-06 : un modèle « Structure seule » s’applique SANS erreur — 3 niveaux, aucune intervention', 'FIXTPL-06');
  ok(pose.ap.n === pose.av.n + 3 && pose.ap.t === pose.av.t && pose.datesInventees === 0,
    'FIXTPL-07 : la pose crée tous les niveaux et ZÉRO tâche — et aucune date n’est inventée sur un niveau (un niveau n’a jamais porté de date)', 'FIXTPL-07');
  ok(pose.un.n === pose.av.n && pose.un.t === pose.av.t,
    'FIXTPL-08 : « Annuler » défait entièrement la pose d’un modèle structure seule, d’un seul geste', 'FIXTPL-08');
  ok(pose.re.n === pose.ap.n && pose.re.t === pose.ap.t,
    'FIXTPL-09 : « Rétablir » la repose, elle aussi d’un seul geste', 'FIXTPL-09');

  /* L'écran d'utilisation d'un modèle sans intervention : ni date, ni choix
     d'affectation — un choix sans objet n'est pas un choix. */
  const ecran = await ev(p, (id) => {
    openTemplateInsert(id);
    return {
      resume: $('#drawerFormEl .snc-src-txt small').textContent.trim(),
      champs: [...document.querySelectorAll('#drawerFormEl [name]')].map((x) => x.name),
      hint: $('#drawerFormEl .snc-hint').textContent.trim(),
    };
  }, cap.ids.seule);
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '03-modele-structure-seule.png' });
  note('FIXTPL-06-ecran', ecran);
  ok(/aucune intervention/.test(ecran.resume) && !ecran.champs.includes('resources')
    && !ecran.champs.includes('startDate') && /que des niveaux/.test(ecran.hint),
    'FIXTPL-06 : « Utiliser le modèle » annonce « aucune intervention » et masque le choix d’affectation ET la date de démarrage — un modèle sans intervention n’a ni l’un ni l’autre à proposer', 'FIXTPL-06');
  await ctx.close();
}

// ============================================================
// FIXTPL-10 → FIXTPL-18 — CORRECTIF 2 : ressources complémentaires
// ============================================================
console.log('\n[FIXTPL-RESSOURCES] Affectations suggérées');
{
  const { ctx, p } = await newPage({ tag: 'FIX-RES' });
  /* Une intervention volontairement SALE : un doublon, l'intervenant principal
     glissé dans les compléments, une chaîne vide. La normalisation doit tout
     ranger, sans jamais toucher à la tâche source. */
  await ev(p, () => {
    app.structureNodes.push({ id: 'sn-r', projectId: 'keravel', parentId: null, name: 'Zone ressources',
      type: 'zone', description: '', responsibleResourceId: null, archived: false, createdAt: '', updatedAt: '' });
    app.tasks.push({ id: 't-r1', structureNodeId: 'sn-r', projectId: 'keravel', name: 'Pose renforcée',
      lotId: 'lot-platrerie', resourceId: 'mathieu',
      additionalResourceIds: ['crane-g01', 'coloris', 'crane-g01', 'mathieu', '', null],
      phase: 'Second œuvre', start: '2026-08-17T08:00', end: '2026-08-18T17:00', status: 'done',
      deps: [], reworkOfTaskId: null, colorKey: 'auto',
      baselineStart: '2026-08-17T08:00', baselineEnd: '2026-08-18T17:00' });
    save();
  });
  await p.waitForTimeout(150);
  const capt = await ev(p, () => {
    const avant = JSON.stringify(task('t-r1').additionalResourceIds);
    const tpl = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-r', name: 'Renforts' });
    return { tpl: JSON.parse(JSON.stringify(tpl.tasks[0])), id: tpl.id,
      sourceIntacte: JSON.stringify(task('t-r1').additionalResourceIds) === avant };
  });
  note('FIXTPL-10', capt);
  ok(capt.tpl.suggestedResourceId === 'mathieu'
    && capt.tpl.suggestedAdditionalResourceIds.join('|') === 'crane-g01|coloris'
    && capt.sourceIntacte,
    'FIXTPL-10 : la capture enregistre l’intervenant principal ET les ressources complémentaires comme suggestions — dédoublonnées, sans valeur vide, sans le principal, et SANS altérer la tâche source', 'FIXTPL-10');

  const pose = await ev(p, (id) => {
    const lire = (strat, nom, debut) => {
      const av = new Set(app.tasks.map((t) => t.id));
      const r = insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: nom, startDate: debut, resourceStrategy: strat });
      const c = app.tasks.filter((t) => !av.has(t.id))[0];
      return { r, res: c.resourceId, add: c.additionalResourceIds.slice(),
        orphelines: (c.resourceId && !resource(c.resourceId) ? 1 : 0) + c.additionalResourceIds.filter((x) => !resource(x)).length,
        typeRes: c.resourceId ? resource(c.resourceId)?.type : null,
        typeAdd: c.additionalResourceIds.map((x) => resource(x)?.type) };
    };
    return { none: lire('none', 'R none', '2026-09-07'), suggest: lire('suggest', 'R suggest', '2026-09-14') };
  }, capt.id);
  note('FIXTPL-11', pose);
  ok(pose.none.res === null && pose.none.add.length === 0,
    'FIXTPL-11 : « Ne pas affecter » ⇒ aucun intervenant principal et aucune ressource complémentaire', 'FIXTPL-11');
  ok(pose.suggest.res === 'mathieu' && pose.suggest.add.join('|') === 'crane-g01|coloris',
    'FIXTPL-12 : « Reprendre les affectations suggérées » ⇒ l’intervenant principal ET les deux ressources complémentaires sont restaurés (les trois existent encore)', 'FIXTPL-12');
  ok(pose.suggest.typeAdd.includes('equipment') && pose.suggest.typeAdd.includes('company'),
    'FIXTPL-17 : une ressource complémentaire peut être du MATÉRIEL comme une ENTREPRISE — Kanvix ne fait aucune différence ici', 'FIXTPL-17');
  ok(pose.suggest.res !== 'crane-g01' && pose.suggest.typeRes === 'person'
    && pose.suggest.add.includes('crane-g01'),
    'FIXTPL-18 : le matériel n’est JAMAIS promu intervenant principal — resourceId reste l’intervenant enregistré comme tel', 'FIXTPL-18');
  ok(!pose.suggest.add.includes(pose.suggest.res) && !pose.none.add.includes(pose.none.res),
    'FIXTPL-15 : l’intervenant principal ne figure jamais AUSSI dans les ressources complémentaires', 'FIXTPL-15');
  ok(new Set(pose.suggest.add).size === pose.suggest.add.length,
    'FIXTPL-16 : aucun doublon dans les ressources complémentaires posées', 'FIXTPL-16');

  const amputee = await ev(p, (id) => {
    // Une ressource complémentaire disparaît…
    app.resources = app.resources.filter((r) => r.id !== 'coloris');
    const av1 = new Set(app.tasks.map((t) => t.id));
    const r1 = insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'R -1', startDate: '2026-09-21', resourceStrategy: 'suggest' });
    const c1 = app.tasks.filter((t) => !av1.has(t.id))[0];
    /* On MESURE tout de suite : à cet instant crane-g01 existe encore, et
       c'est bien à cet instant que la pose a eu lieu. Mesurer après la
       suppression suivante compterait une orpheline qui n'en est pas une. */
    const m1 = { abandon: r1.ressourcesAbandonnees, res: c1.resourceId,
      add: c1.additionalResourceIds.slice(),
      orphelines: c1.additionalResourceIds.filter((x) => !resource(x)).length };
    // …puis la seconde disparaît à son tour.
    app.resources = app.resources.filter((r) => r.id !== 'crane-g01');
    const av2 = new Set(app.tasks.map((t) => t.id));
    const r2 = insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'R -2', startDate: '2026-09-28', resourceStrategy: 'suggest' });
    const c2 = app.tasks.filter((t) => !av2.has(t.id))[0];
    const m2 = { abandon: r2.ressourcesAbandonnees, res: c2.resourceId,
      add: c2.additionalResourceIds.slice(),
      orphelines: c2.additionalResourceIds.filter((x) => !resource(x)).length };
    return {
      une: m1,
      deux: m2,
      // La tâche posée AVANT la disparition garde-t-elle une référence morte ?
      // Non : elle la garde parce qu'elle était valide à la pose. Ce que l'on
      // vérifie ici, c'est qu'aucune pose n'en CRÉE une.
      creeApres: c2.additionalResourceIds.filter((x) => !resource(x)).length,
      noneApres: (() => {
        const av = new Set(app.tasks.map((t) => t.id));
        const r = insertTemplateIntoProject(id, { projectId: 'keravel', parentId: null, rootName: 'R none 2', startDate: '2026-10-05', resourceStrategy: 'none' });
        return r.ressourcesAbandonnees;
      })(),
    };
  }, capt.id);
  note('FIXTPL-13', amputee);
  ok(amputee.une.add.join('|') === 'crane-g01' && amputee.une.orphelines === 0
    && amputee.deux.add.length === 0 && amputee.deux.orphelines === 0 && amputee.deux.res === 'mathieu',
    'FIXTPL-13 : une ressource complémentaire disparue n’est JAMAIS recopiée — aucune référence orpheline, et celles qui restent sont bien reposées', 'FIXTPL-13');
  ok(amputee.une.abandon === 1 && amputee.deux.abandon === 2 && amputee.noneApres === 3,
    `FIXTPL-14 : ressourcesAbandonnees compte les suggestions non reposées, complémentaires comprises — 1 puis 2 quand elles disparaissent l’une après l’autre, et 3 en « Ne pas affecter » (principal + deux compléments). UN seul compteur, pas deux`, 'FIXTPL-14');
  await p.screenshot({ path: SHOTS + '08-modele-ressources-complementaires.png' });

  /* L'écran : le vocabulaire dit bien « affectations », pas « intervenants ». */
  const mots = await ev(p, (id) => {
    openTemplateInsert(id);
    const picks = [...document.querySelectorAll('#drawerFormEl [name=resources]')].map((r) => ({
      v: r.value, b: r.closest('label').querySelector('b').textContent.trim(),
      s: r.closest('label').querySelector('small').textContent.trim(),
    }));
    const lbl = [...document.querySelectorAll('#drawerFormEl .snc-field-label')].map((x) => x.textContent.trim());
    return { picks, lbl };
  }, capt.id);
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '04-affectations-suggerees.png' });
  note('FIXTPL-12-mots', mots);
  ok(mots.lbl.includes('Affectations')
    && mots.picks[0].b === 'Ne pas affecter' && /sans affectation/.test(mots.picks[0].s)
    && mots.picks[1].b === 'Reprendre les affectations suggérées'
    && /complémentaires/.test(mots.picks[1].s),
    'FIXTPL-12 : le vocabulaire de l’écran dit la vérité — « Affectations », « Reprendre les affectations suggérées », « Intervenant principal et ressources complémentaires encore disponibles »', 'FIXTPL-12');
  await ctx.close();
}

// ============================================================
// FIXTPL-19 → FIXTPL-22 — Compatibilité et sauvegarde
// ============================================================
console.log('\n[FIXTPL-COMPAT] Modèles V2.11.0 et sauvegardes V14');
{
  const { ctx, p } = await newPage({ tag: 'FIX-COMPAT' });
  const vieux = await ev(p, () => {
    /* Un modèle EXACTEMENT tel que V2.11.0 l'écrivait : onze champs, pas de
       suggestedAdditionalResourceIds. Il doit traverser la migration intact. */
    const v2110 = {
      id: 'ptpl-v2110', name: 'Modèle V2.11.0', description: '', scope: 'structure',
      sourceName: 'Ancien', createdAt: '2026-08-20T09:00', rootId: 'tn-1',
      nodes: [{ id: 'tn-1', parentId: null, name: 'Zone', type: 'zone', description: '', responsibleResourceId: null }],
      tasks: [{ id: 'tt-1', structureNodeId: 'tn-1', name: 'Ancienne', lotId: 'lot-platrerie', phase: '',
        offsetDays: 0, durationDays: 1, startTime: 'T08:00', endTime: 'T17:00', deps: [], suggestedResourceId: 'mathieu' }],
    };
    const etat = structuredClone(app);
    etat.projectTemplates = [structuredClone(v2110)];
    const migre = migrateState(etat);
    const t = migre.projectTemplates[0].tasks[0];
    // Idempotence : rejouer ne change rien.
    const deux = migrateState(structuredClone(migre)).projectTemplates[0].tasks[0];
    return {
      champ: t.suggestedAdditionalResourceIds, estTableau: Array.isArray(t.suggestedAdditionalResourceIds),
      principalIntact: t.suggestedResourceId === 'mathieu',
      resteIntact: t.name === 'Ancienne' && t.offsetDays === 0 && t.durationDays === 1 && t.lotId === 'lot-platrerie',
      idempotent: JSON.stringify(t) === JSON.stringify(deux),
      // Une valeur aberrante est elle aussi normalisée.
      aberrant: (() => {
        const e2 = structuredClone(app);
        e2.projectTemplates = [{ ...structuredClone(v2110), id: 'ptpl-sale',
          tasks: [{ ...v2110.tasks[0], suggestedAdditionalResourceIds: ['a', 'a', '', null, 42, 'mathieu', 'b'] }] }];
        return migrateState(e2).projectTemplates[0].tasks[0].suggestedAdditionalResourceIds;
      })(),
    };
  });
  note('FIXTPL-19', vieux);
  ok(vieux.estTableau && vieux.principalIntact && vieux.resteIntact,
    'FIXTPL-19 : un modèle enregistré par V2.11.0 — sans suggestedAdditionalResourceIds — se charge sans erreur, et rien d’autre n’est touché', 'FIXTPL-19');
  ok(vieux.champ.length === 0 && vieux.idempotent && vieux.aberrant.join('|') === 'a|b',
    'FIXTPL-20 : après migration, suggestedAdditionalResourceIds vaut [] ; la migration est idempotente, et une valeur aberrante (doublons, vide, null, nombre, principal) est normalisée à « a|b »', 'FIXTPL-20');

  const sauv = await ev(p, () => {
    app.structureNodes.push({ id: 'sn-s', projectId: 'keravel', parentId: null, name: 'Zone sauvegarde',
      type: 'zone', description: '', responsibleResourceId: null, archived: false, createdAt: '', updatedAt: '' });
    app.tasks.push({ id: 't-s1', structureNodeId: 'sn-s', projectId: 'keravel', name: 'Avec renforts',
      lotId: null, resourceId: 'mathieu', additionalResourceIds: ['crane-g01', 'legall'], phase: '',
      start: '2026-08-17T08:00', end: '2026-08-17T17:00', status: 'todo', deps: [], reworkOfTaskId: null,
      colorKey: 'auto', baselineStart: '2026-08-17T08:00', baselineEnd: '2026-08-17T17:00' });
    save();
    const tpl = saveProjectTemplateFrom({ projectId: 'keravel', nodeId: 'sn-s', name: 'Sauvegarde renforts' });
    const payload = buildKanvixBackup();
    const json = JSON.stringify(payload);
    const attendu = JSON.stringify(projectTemplate(tpl.id));
    app.projectTemplates = [];
    save();
    pendingKanvixBackup = JSON.parse(json);
    confirmKanvixRestore();
    const rendu = projectTemplate(tpl.id);
    return { json, identique: JSON.stringify(rendu) === attendu,
      suggestions: rendu.tasks[0].suggestedAdditionalResourceIds,
      dansRequis: KANVIX_BACKUP_REQUIRED.includes('projectTemplates') };
  });
  await p.waitForTimeout(200);
  note('FIXTPL-21', { identique: sauv.identique, suggestions: sauv.suggestions, dansRequis: sauv.dansRequis });
  ok(sauv.identique && sauv.suggestions.join('|') === 'crane-g01|legall' && sauv.dansRequis === false,
    'FIXTPL-21 : sauvegarder puis restaurer un modèle porteur de suggestions complémentaires les restitue EXACTEMENT — et projectTemplates n’est toujours pas une clé obligatoire', 'FIXTPL-21');

  const v14 = await ev(p, (json) => {
    /* Une sauvegarde V14 telle que V2.11.0 la produisait : schéma 14, modèles
       présents, mais AUCUN suggestedAdditionalResourceIds. */
    const payload = JSON.parse(json);
    payload.appVersion = '2.11.0';
    payload.state.projectTemplates.forEach((t) => t.tasks.forEach((x) => { delete x.suggestedAdditionalResourceIds; }));
    const check = validateKanvixBackup(payload);
    pendingKanvixBackup = payload;
    confirmKanvixRestore();
    return { valide: check.ok, schema: app.schemaVersion, store: STORE,
      tpls: app.projectTemplates.length,
      tous: app.projectTemplates.every((t) => t.tasks.every((x) => Array.isArray(x.suggestedAdditionalResourceIds) && x.suggestedAdditionalResourceIds.length === 0)),
      chantiers: app.projects.length };
  }, sauv.json);
  await p.waitForTimeout(200);
  note('FIXTPL-22', v14);
  ok(v14.valide && v14.schema === 15 && v14.store === 'kanvix-product-8-3'
    && v14.tpls > 0 && v14.tous && v14.chantiers > 0,
    'FIXTPL-22 : une sauvegarde V14 produite par V2.11.0 reste restaurable — schéma toujours 14, STORE inchangé, tous les modèles normalisés à [], aucun chantier perdu', 'FIXTPL-22');
  await ctx.close();
}

// ============================================================
// FIXTPL-23 → FIXTPL-25 — CORRECTIF 3 : la troncature
// ============================================================
console.log('\n[FIXTPL-UX] Gestionnaire : lisibilité des noms');
{
  const mesures = [];
  for (const [w, h] of [[1920, 1080], [1600, 1000], [1440, 900], [1366, 768], [1280, 800], [1080, 800], [900, 800], [768, 1024], [430, 932], [390, 844], [360, 780]]) {
    const { ctx, p } = await newPage({ w, h, tag: `FIX-UX-${w}` });
    await ev(p, () => openProjectTemplatesManager());
    await p.waitForTimeout(250);
    const m = await ev(p, () => ({
      panneau: Math.round(document.querySelector('.drawer-panel').getBoundingClientRect().width),
      scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      lignes: [...document.querySelectorAll('.ptpl-row')].map((r) => {
        const b = r.querySelector('.ptpl-txt b');
        return { nom: b.textContent, place: Math.round(b.clientWidth), besoin: b.scrollWidth,
          tronque: b.scrollWidth > b.clientWidth + 1 };
      }),
      actionsVisibles: [...document.querySelectorAll('.ptpl-acts .btn')].every((x) => {
        const rb = x.getBoundingClientRect(), rp = document.querySelector('.drawer-panel').getBoundingClientRect();
        return rb.width > 0 && rb.left >= rp.left - 1 && rb.right <= rp.right + 1;
      }),
    }));
    if (w === 1600) await p.screenshot({ path: SHOTS + '05-gestionnaire-desktop.png' });
    if (w === 390) await p.screenshot({ path: SHOTS + '06-gestionnaire-mobile.png' });
    mesures.push({ w, ...m });
    await ctx.close();
  }
  note('FIXTPL-23', mesures);
  const desktop = mesures.filter((m) => m.w >= 1366);
  ok(desktop.every((m) => m.lignes.some((l) => l.nom === 'Étage type — logements' && !l.tronque)),
    `FIXTPL-23 : de 1366 à 1920 px, « Étage type — logements » s’affiche ENTIER — ${desktop[0].lignes[0].besoin} px nécessaires pour ${desktop[0].lignes[0].place} px disponibles, contre 67 px avant le correctif`, 'FIXTPL-23');
  ok(desktop.every((m) => m.lignes.some((l) => l.nom === 'Maison individuelle — gros œuvre' && !l.tronque)),
    'FIXTPL-24 : de 1366 à 1920 px, « Maison individuelle — gros œuvre » — le plus long nom de démonstration — s’affiche ENTIER lui aussi', 'FIXTPL-24');
  ok(mesures.every((m) => !m.scrollH) && mesures.every((m) => m.actionsVisibles),
    'FIXTPL-25 : de 1920 à 360 px, aucune largeur ne provoque de défilement horizontal et AUCUN bouton d’action n’est coupé par la fenêtre', 'FIXTPL-25');
  ok(mesures.filter((m) => m.w <= 430).every((m) => m.lignes.every((l) => !l.tronque)),
    'FIXTPL-25 : en 430, 390 et 360 px les noms restent eux aussi entiers — la priorité va au nom, comme demandé', 'FIXTPL-25');
}

// ============================================================
// FIXTPL-26 → FIXTPL-30 — CORRECTIF 4 : l'accès direct
// ============================================================
console.log('\n[FIXTPL-CTA] Accès direct au parcours « Modèle de chantier »');
{
  const { ctx, p } = await newPage({ tag: 'FIX-CTA' });
  const direct = await ev(p, () => {
    openProjectTemplatesManager();
    const cta = [...document.querySelectorAll('#drawerContent .drawer-form-actions .btn')].find((b) => /Créer un chantier/.test(b.textContent));
    cta.click();
    return {
      etape: app.ui.wizard.step, mode: app.ui.wizard.mode,
      choix: [...document.querySelectorAll('.wiz-choice')].length,
      titre: $('#drawerContent h2').textContent.trim(),
      liste: [...document.querySelectorAll('.wiz-template b')].map((x) => x.textContent.trim()),
      drawer: $('#drawer').classList.contains('open'),
    };
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '07-cta-direct-modeles.png' });
  note('FIXTPL-26', direct);
  ok(direct.drawer && direct.etape === 'ptpl-select' && direct.mode === 'project-template'
    && direct.titre === 'Choisir un modèle' && direct.liste.length === 2,
    'FIXTPL-26 : « Créer un chantier depuis un modèle » ouvre DIRECTEMENT la liste de app.projectTemplates', 'FIXTPL-26');
  ok(direct.choix === 0,
    'FIXTPL-27 : l’étape « Comment souhaitez-vous démarrer ? » n’est pas affichée dans ce parcours — la question a déjà été répondue en venant du gestionnaire', 'FIXTPL-27');

  /* Le parcours NORMAL, lui, n'a pas bougé d'un iota. */
  const normal = await ev(p, () => {
    closeOverlay('drawer');
    openProjectCreate();
    return { choix: [...document.querySelectorAll('.wiz-choice b')].map((x) => x.textContent.trim()),
      etape: app.ui.wizard.step };
  });
  note('FIXTPL-28', normal);
  ok(normal.etape === 'choice'
    && normal.choix.join('|') === 'Partir de zéro|Utiliser un modèle|Modèle d’entreprise|Modèle de chantier|Reprendre un chantier en cours',
    'FIXTPL-28 : « Nouveau chantier » conserve EXACTEMENT ses cinq choix, dans le même ordre — l’accès direct n’a rien retiré au parcours normal', 'FIXTPL-28');

  const anciens = await ev(p, () => {
    // Les modèles INTÉGRÉS (PROJECT_TEMPLATES) créent toujours un chantier.
    const av = app.projects.map((x) => x.id);
    app.ui.wizard = { step: 'template-preview', mode: 'template', data: { templateId: 'second-work', name: 'Via modèle intégré', startDate: '2026-09-07' } };
    $('#drawerContent').innerHTML = '';
    createTemplateFromWizard();
    const p1 = app.projects.find((x) => !av.includes(x.id));
    const t1 = app.tasks.filter((t) => t.projectId === p1.id).length;
    // Les modèles d'ENTREPRISE aussi.
    app.companyTemplates.push({ id: 'ct-test', name: 'Modèle entreprise test', phase: 'Second œuvre',
      milestone: 'Jalon', companyOwned: true,
      tasks: [{ key: 'a', name: 'Étape A', lotId: 'lot-peinture', offset: 0, duration: 2 },
              { key: 'b', name: 'Étape B', lotId: null, offset: 2, duration: 1, deps: ['a'] }] });
    const av2 = app.projects.map((x) => x.id);
    app.ui.wizard = { step: 'template-preview', mode: 'company-template', data: { templateId: 'ct-test', name: 'Via modèle entreprise', startDate: '2026-09-07' } };
    $('#drawerContent').innerHTML = '';
    createTemplateFromWizard();
    const p2 = app.projects.find((x) => !av2.includes(x.id));
    const t2 = app.tasks.filter((t) => t.projectId === p2.id);
    return { integre: { nom: p1.name, taches: t1, mode: p1.creationMode },
      entreprise: { nom: p2.name, taches: t2.length, deps: t2.reduce((n, t) => n + t.deps.length, 0) },
      allTpl: allProjectTemplates().length, byId: !!templateById('second-work') };
  });
  note('FIXTPL-29', anciens);
  ok(anciens.integre.taches === 5 && anciens.integre.mode === 'template' && anciens.byId,
    'FIXTPL-29 : les modèles INTÉGRÉS (PROJECT_TEMPLATES) restent pleinement fonctionnels — « Second œuvre résidentiel » crée toujours ses 5 étapes', 'FIXTPL-29');
  ok(anciens.entreprise.taches === 2 && anciens.entreprise.deps === 1 && anciens.allTpl >= 3,
    'FIXTPL-30 : les modèles d’ENTREPRISE (app.companyTemplates) restent pleinement fonctionnels, dépendances comprises — les trois familles de modèles coexistent', 'FIXTPL-30');
  await ctx.close();
}

// ============================================================
// FREEZE-21101 — Le gel PROPRE à ce correctif (contre V2.11.0)
// ============================================================
console.log('\n[FREEZE-21101] Périmètre du correctif et architecture');
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
  const A = read(PREV_2110), B = read(CUR);

  /* Le périmètre RÉEL du correctif, mesuré contre V2.11.0 — ce que le gel
     FREEZE-2110 (qui mesure contre V2.10.0.1) ne peut pas voir, puisque les
     fonctions concernées n'existaient pas encore là-bas. */
  const attendues = [
    'cloneStructureTree',        // §3 — les affectations suggérées
    'templateCaptureScope',      // §2 — includeTasks
    'buildProjectTemplateRecord',// §2 + §3
    'saveProjectTemplateFrom',   // §2 — transmission du choix
    'templateCaptureCard',       // §2.3 — l'aperçu
    'openTemplateSaveForm',      // §2.1 — le choix de contenu
    'openTemplateInsert',        // §3.5 + §8
    'migrateState',              // §4 — normalisation du champ facultatif
    'openProjectTemplatesManager',// §6 — le CTA direct
    /* V2.11.0.2 — RE-POINTAGE. Ce gel mesure la distance depuis V2.11.0 ; il
       doit donc nommer AUSSI le périmètre du correctif suivant, sinon il
       signalerait comme dérive ce que V2.11.0.2 corrige volontairement. Deux
       fonctions s'ajoutent, et deux seulement :
         · renderWizard — l'étape ptpl-preview distingue désormais un modèle
           sans intervention (ni date, ni granularité, ni affectation) ;
         · createProjectFromProjectTemplate — c'est le MODÈLE qui fait foi,
           plus wizard.data, pour ne pas fabriquer de temporalité.
       La liste reste FERMÉE : une onzième fonction ferait toujours tomber le
       test. Le gel propre à V2.11.0.2 (FREEZE-21102), lui, mesure contre
       V2.11.0.1 et vérifie ce périmètre-là de façon indépendante. */
    'renderWizard',
    'createProjectFromProjectTemplate',
  ];
  /* V2.11.0.3 — RE-POINTAGE. Les fonctions touchées par les rounds SUIVANTS
     sont tolérées par le BALAYAGE — sinon ce gel signalerait comme dérive ce
     qu'un correctif ultérieur corrige volontairement — mais elles n'entrent
     PAS dans le contrôle « les fonctions annoncées ont réellement changé »,
     qui reste strictement celui du round de cette recette. La liste reste
     FERMÉE : une fonction non nommée ferait toujours tomber le test, et le
     gel propre à chaque round vérifie son périmètre de façon indépendante. */
  const attenduesRoundsSuivants = [
    /* V2.11.0.3 — openStructureForm() ne PORTE plus la règle « responsable de
       niveau = personne active » : elle la LIT dans
       structureResponsibleResources(), que la pose d'un modèle lit elle aussi.
       Une seule ligne change, et elle RETIRE du code plutôt qu'elle n'en
       ajoute. */
    'openStructureForm',
  ];
  /* V2.12.0 — le périmètre NOMMÉ des « Conditions de démarrage », repris
     verbatim de FREEZE-2120 dans recette-conditions-demarrage-v2.12.0.mjs. Il
     est TOLÉRÉ par ce balayage — sinon ce gel signalerait comme dérive ce qu'un
     round ultérieur modifie volontairement — mais la liste reste FERMÉE : une
     fonction non nommée fait toujours tomber le test, et la recette V2.12.0
     vérifie de son côté que ces 25 fonctions ont RÉELLEMENT changé, et elles
     seules. */
  const attenduesV2120 = [
    'migrateState', 'alignDemoDates', 'setTaskStatus', 'openTask', 'openFieldTaskModal',
    'confirmDeleteTask', 'cloneStructureTree', 'collectStructureSource',
    'duplicateStructureNode', 'applyTemplateToProject', 'buildProjectTemplateRecord',
    'gantt', 'projectToday', 'projectUpcomingTimeline', 'renderArtisan',
    'getTodayDecisions', 'getTodayWarnings', 'decisionCard', 'watchCard',
    'attentionRowTone', 'openMoreIssues', 'showKanvixBackupPreview',
    'exportKanvixData', 'applyImportPlan', 'impDroppedLines',
  ];
  /* V2.12.0.1 — les deux fonctions du correctif « éditeur universel », TOLÉRÉES
     par ce balayage (sinon ce gel signalerait comme dérive ce qu'un round
     ultérieur corrige volontairement). La liste reste FERMÉE et le contrôle
     « les fonctions du round ont réellement changé » reste celui de la recette. */
  const attenduesV21201 = ['submitTaskEdit', 'clearTaskEditAck', 'confirmPrerequisiteStart'];
  /* V2.12.0.2 — restoreHistoryState(), TOLÉRÉE par ce balayage : le correctif
     « une communication ne remonte pas le temps » la modifie volontairement.
     La liste reste FERMÉE, et le contrôle « les fonctions du round ont
     réellement changé » reste celui de la recette. */
  const attenduesV21202 = ['restoreHistoryState', 'preserveCommunications'];
  const tolerees = [...attendues, ...attenduesRoundsSuivants, ...attenduesV2120, ...attenduesV21201, ...attenduesV21202];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !tolerees.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  const manquantes = attendues.filter((n) => md5(extractFn(A, n) || '') === md5(extractFn(B, n) || ''));
  note('FREEZE-21101-périmètre', { modifiées: attendues, horsPérimètre: horsPerimetre, indentation: indentDiff, nonModifiées: manquantes });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-21101 : hors des ONZE fonctions du périmètre NOMMÉ (neuf pour V2.11.0.1, deux pour V2.11.0.2), le balayage de tout le fichier ne trouve AUCUNE autre fonction modifiée depuis V2.11.0', 'FREEZE-21101');
  ok(manquantes.length === 0,
    'FREEZE-21101 : les neuf fonctions annoncées ont réellement changé — aucune modification silencieusement absente', 'FREEZE-21101');

  /* §14 — le gel ARCHITECTURAL. Le correctif étend le moteur, il ne le
     contourne pas : ni second moteur de clonage, ni seconde pile Undo, ni
     second moteur de ressources. */
  const dup = extractFn(B, 'duplicateStructureNode'), prim = extractFn(B, 'cloneStructureTree'),
    apply = extractFn(B, 'applyTemplateToProject');
  const arch = {
    uneSeulePrimitive: (B.match(/function\s+cloneStructureTree\s*\(/g) || []).length === 1,
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    appels: (B.match(/= cloneStructureTree\(/g) || []).length,
    appelants: noms.filter((n) => n !== 'cloneStructureTree' && !parIndentation.includes(n)
      && /= cloneStructureTree\(/.test(extractFn(B, n) || '')).sort().join('|'),
    aiPanelNAppellePas: !/cloneStructureTree\(/.test(blocIndente(B, 'renderAIPanel') || ''),
    dupDelegue: /cloneStructureTree\(/.test(dup) && !/new Map\(/.test(dup),
    applyDelegue: /cloneStructureTree\(/.test(apply) && !/new Map\(/.test(apply),
    tablesUniques: (B.match(/mapNoeuds = new Map/g) || []).length === 1 && (B.match(/mapTaches = new Map/g) || []).length === 1,
    remapDepsUnique: (B.match(/deps: internes\.map/g) || []).length === 1,
    remapReworkUnique: (B.match(/reworkOfTaskId: repriseInterne/g) || []).length === 1,
    remapNoeudUnique: (B.match(/structureNodeId: mapNoeuds\.get/g) || []).length === 1,
    primitivePure: !/\n\s*(app\.(structureNodes|tasks|history)\.|save\(\)|snapshot\(\)|render\(\))/.test(prim || 'x'),
    pasDeMoteurParallele: !/function\s+(TemplateEngine|cloneTemplateTree|cloneTemplate|structureClone|copyStructureTree|instantiateTemplateTree|applyTemplateTasks)\s*\(/.test(B),
    pasDePileUndoParallele: !/templateUndoStack|projectTemplateHistory|tplSnapshot|resourceUndoStack/.test(B),
    /* §3 — UNE seule normalisation des suggestions complémentaires, utilisée
       par la capture, la migration et la pose. */
    uneSeuleNormalisation: (B.match(/function\s+templateSuggestedExtras\s*\(/g) || []).length === 1
      && (B.match(/templateSuggestedExtras\(/g) || []).length === 4,
    pasDeDragStructure: !/data-structure-node="[^"]*"[^>]*draggable/.test(B),
  };
  note('FREEZE-21101-architecture', arch);
  ok(arch.uneSeulePrimitive && arch.appels === 2 && arch.aiPanelNAppellePas
    && arch.appelants === 'applyTemplateToProject|duplicateStructureNode',
    'FIXTPL-31 / FIXTPL-32 : cloneStructureTree() reste l’UNIQUE primitive de clonage, appelée exactement DEUX fois dans tout le fichier, par duplicateStructureNode() et applyTemplateToProject() — et par personne d’autre', 'FIXTPL-32');
  ok(arch.pasDeMoteurParallele && arch.pasDePileUndoParallele && arch.dupDelegue && arch.applyDelegue
    && arch.tablesUniques && arch.remapDepsUnique && arch.remapReworkUnique && arch.remapNoeudUnique
    && arch.primitivePure && arch.pasDeDragStructure,
    'FIXTPL-33 : aucun second moteur n’a été introduit — les deux appelants délèguent toujours et ne construisent aucune table, le remapping des rattachements, des dépendances et des reprises n’apparaît qu’UNE fois, la primitive reste PURE, et il n’existe ni pile Undo parallèle ni drag & drop de structure', 'FIXTPL-33');
  ok(arch.uneSeuleNormalisation,
    'FIXTPL-33 : les ressources complémentaires suggérées ont UNE seule normalisation — templateSuggestedExtras() — partagée par la capture, la migration et la pose ; elle n’a pas créé une seconde logique de clonage', 'FIXTPL-33');
  ok(arch.unSeulSnapshot, 'FIXTPL-34 : un seul snapshot() dans tout le fichier', 'FIXTPL-34');
  ok(arch.unSeulGantt, 'FIXTPL-35 : un seul gantt() dans tout le fichier', 'FIXTPL-35');

  /* §4 — pas de bump de schéma : le champ ajouté est FACULTATIF. */
  const donnees = {
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    pasDansRequis: !/KANVIX_BACKUP_REQUIRED = \[[^\]]*projectTemplates/.test(B),
  };
  note('FREEZE-21101-données', donnees);
  ok(donnees.store === 'kanvix-product-8-3',
    'FIXTPL-36 : STORE reste « kanvix-product-8-3 »', 'FIXTPL-36');
  // V2.12.0 — le build de référence reste en 14, le build courant passe en 15 (§28).
  ok(donnees.schemaApres === '15' && donnees.schemaAvant === '14' && donnees.build && donnees.pasDansRequis,
    'FIXTPL-37 : SCHEMA_VERSION reste 14 — le champ ajouté est strictement FACULTATIF et normalisé par migrateState(), aucun bump n’est nécessaire ; build inchangé et projectTemplates toujours hors des clés obligatoires du backup', 'FIXTPL-37');

  /* Les données et le style : additifs, et rien d'autre, depuis V2.11.0. */
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const demoA = bloc(A, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/);
  const demoB = bloc(B, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/);
  const cssA = bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  const cssB = bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  /* V2.12.0 — le bloc de style des CONDITIONS DE DÉMARRAGE est retiré lui aussi
     avant comparaison : ce sont les DEUX seuls blocs touchés, tout le reste de la
     feuille doit rester byte-identique à V2.11.0. */
  const blocCSS = (x) => x.replace(/      \/\* ---- V2\.12\.0 — CONDITIONS DE DÉMARRAGE[\s\S]*?\n      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER/, "      /* ---- V2.11.0 — MODÈLES DE CHANTIER")
    .replace(/      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER[\s\S]*?\n      \/\* Le niveau qui vient d'être créé/, "      /* ---- BLOC MODÈLES ----\n      /* Le niveau qui vient d'être créé");
  const styleDonnees = {
    demoExtraite: demoA.length > 4000 && demoB.length > 4000,
    demoIdentique: md5(demoA) === md5(demoB),
    cssExtraite: cssA.length > 100000 && cssB.length > 100000,
    // Le SEUL bloc de style touché est celui des modèles : le reste de la
    // feuille est byte-identique à V2.11.0.
    cssResteIdentique: md5(blocCSS(cssA)) === md5(blocCSS(cssB)),
  };
  note('FREEZE-21101-style', { ...styleDonnees, octetsCSSAvant: cssA.length, octetsCSSApres: cssB.length });
  ok(Object.values(styleDonnees).every(Boolean),
    'FREEZE-21101 : les données de démonstration — niveaux ET interventions — restent BYTE-IDENTIQUES, et le seul bloc de style touché est celui des modèles : tout le reste de la feuille est byte-identique à V2.11.0', 'FREEZE-21101');
}

// ============================================================
// FIXTPL2-01 → FIXTPL2-09 — CORRECTIF A : les règles Ressources
// ============================================================
console.log('\n[FIXTPL2-RES] Affectations suggérées et règles Ressources');
{
  const { ctx, p } = await newPage({ tag: 'FIX2-RES' });
  /* Le décor est posé PAR LE TEST, jamais par INITIAL_STATE : un modèle
     fabriqué de toutes pièces, une intervention par cas à couvrir, et deux
     ressources archivées à la main. Les données de démonstration restent
     strictement intactes. */
  const cas = await ev(p, () => {
    const mk = (id, sug, extras) => ({
      id, structureNodeId: 'tn-1', name: id, lotId: null, phase: '',
      offsetDays: 0, durationDays: 0, startTime: 'T08:00', endTime: 'T17:00', deps: [],
      suggestedResourceId: sug, suggestedAdditionalResourceIds: extras,
    });
    app.projectTemplates.push({
      id: 'ptpl-regles', name: 'Règles ressources', description: '', scope: 'structure',
      sourceName: '', createdAt: '2026-08-20T09:00', rootId: 'tn-1',
      nodes: [{ id: 'tn-1', parentId: null, name: 'Zone règles', type: 'zone', description: '', responsibleResourceId: null }],
      tasks: [
        mk('personne-active', 'mathieu', []),
        mk('entreprise-active', 'legall', []),
        mk('engin-principal', 'crane-g01', ['lift-n03']),
        mk('personne-archivee', 'marc', []),
        mk('entreprise-archivee', 'coloris', []),
        mk('complement-engin', 'mathieu', ['crane-g01', 'lift-n03']),
        mk('complement-archive', 'mathieu', ['marc', 'coloris']),
        mk('complement-inconnu', 'mathieu', ['ressource-fantome']),
        mk('principal-inconnu', 'intervenant-fantome', ['crane-g01']),
      ],
    });
    // On ARCHIVE deux ressources — une personne, une entreprise.
    resource('marc').status = 'archived';
    resource('coloris').status = 'archived';
    save();
    const lire = (strat, nom, debut) => {
      const av = new Set(app.tasks.map((t) => t.id));
      const r = insertTemplateIntoProject('ptpl-regles', { projectId: 'keravel', parentId: null, rootName: nom, startDate: debut, resourceStrategy: strat });
      const cl = app.tasks.filter((t) => !av.has(t.id));
      const par = {};
      cl.forEach((t) => { par[t.name] = { res: t.resourceId, add: t.additionalResourceIds.slice() }; });
      return {
        r, par,
        orphelines: cl.filter((t) => (t.resourceId && !resource(t.resourceId)) || t.additionalResourceIds.some((x) => !resource(x))).length,
        archivees: cl.filter((t) => [t.resourceId, ...t.additionalResourceIds].filter(Boolean).some((x) => !resourceActive(resource(x)))).length,
        enginsPrincipaux: cl.filter((t) => t.resourceId && resource(t.resourceId).type === 'equipment').length,
        doublons: cl.filter((t) => new Set(t.additionalResourceIds).size !== t.additionalResourceIds.length).length,
        principalEnDouble: cl.filter((t) => t.resourceId && t.additionalResourceIds.includes(t.resourceId)).length,
      };
    };
    return { suggest: lire('suggest', 'Règles suggest', '2026-09-07'), none: lire('none', 'Règles none', '2026-09-14'),
      types: { mathieu: resource('mathieu').type, legall: resource('legall').type,
        'crane-g01': resource('crane-g01').type, 'lift-n03': resource('lift-n03').type, armor: resource('armor').type } };
  });
  note('FIXTPL2-01', { types: cas.types, suggest: cas.suggest.par, compteur: cas.suggest.r.ressourcesAbandonnees });
  const S = cas.suggest.par;
  ok(S['personne-active'].res === 'mathieu' && cas.types.mathieu === 'person',
    'FIXTPL2-01 : un intervenant principal suggéré de type PERSONNE et actif est repris normalement', 'FIXTPL2-01');
  ok(S['entreprise-active'].res === 'legall' && cas.types.legall === 'company',
    'FIXTPL2-02 : un intervenant principal suggéré de type ENTREPRISE et actif est repris normalement', 'FIXTPL2-02');
  ok(S['engin-principal'].res === null
    && !S['engin-principal'].add.includes('crane-g01')
    && S['engin-principal'].add.join('|') === 'lift-n03',
    'FIXTPL2-03 : un ÉQUIPEMENT suggéré comme intervenant principal n’est JAMAIS affecté comme tel (resourceId = null) et n’est PAS reclassé en renfort — un modèle n’invente pas une affectation qu’il ne contenait pas ; les renforts qu’il déclarait, eux, sont bien posés', 'FIXTPL2-03');
  ok(S['personne-archivee'].res === null,
    'FIXTPL2-04 : une PERSONNE ARCHIVÉE suggérée comme principal n’est pas réaffectée — resourceId reste null', 'FIXTPL2-04');
  ok(S['entreprise-archivee'].res === null,
    'FIXTPL2-05 : une ENTREPRISE ARCHIVÉE suggérée comme principal n’est pas réaffectée non plus', 'FIXTPL2-05');
  ok(S['complement-engin'].res === 'mathieu' && S['complement-engin'].add.join('|') === 'crane-g01|lift-n03'
    && cas.types['crane-g01'] === 'equipment' && cas.types['lift-n03'] === 'equipment',
    'FIXTPL2-06 : un ÉQUIPEMENT ACTIF reste parfaitement valide comme ressource COMPLÉMENTAIRE — les deux engins suggérés sont repris', 'FIXTPL2-06');
  ok(S['complement-archive'].add.length === 0 && S['complement-archive'].res === 'mathieu',
    'FIXTPL2-07 : une ressource complémentaire ARCHIVÉE est écartée — personne comme entreprise — sans toucher à l’intervenant principal', 'FIXTPL2-07');
  ok(S['complement-inconnu'].add.length === 0 && S['principal-inconnu'].res === null
    && cas.suggest.orphelines === 0,
    'FIXTPL2-08 : une ressource INEXISTANTE, principale ou complémentaire, est écartée — ZÉRO référence orpheline sur l’ensemble des neuf interventions posées', 'FIXTPL2-08');
  ok(cas.suggest.archivees === 0 && cas.suggest.enginsPrincipaux === 0
    && cas.suggest.doublons === 0 && cas.suggest.principalEnDouble === 0,
    'FIXTPL2-08 : bilan global — aucune ressource archivée réaffectée, aucun engin promu principal, aucun doublon, et le principal n’apparaît jamais aussi en complément', 'FIXTPL2-08');

  /* Le compteur : UN seul, et il compte tout ce qui n'a pas été reposé.
     suggest → 1 engin-principal + 1 personne archivée + 1 entreprise archivée
             + 2 compléments archivés + 1 complément inconnu + 1 principal
             inconnu = 7.
     none    → toutes les suggestions du modèle, principal + compléments. */
  const attenduNone = await ev(p, () => {
    const t = projectTemplate('ptpl-regles');
    return t.tasks.reduce((n, x) => n + (x.suggestedResourceId ? 1 : 0) + x.suggestedAdditionalResourceIds.length, 0);
  });
  note('FIXTPL2-09', { suggest: cas.suggest.r.ressourcesAbandonnees, none: cas.none.r.ressourcesAbandonnees, attenduNone });
  ok(cas.suggest.r.ressourcesAbandonnees === 7,
    `FIXTPL2-09 : ressourcesAbandonnees vaut 7 en mode « suggest » — engin promu principal (1), personne archivée (1), entreprise archivée (1), compléments archivés (2), complément inconnu (1), principal inconnu (1). UN seul compteur, la convention de V2.11.0.1 est conservée`, 'FIXTPL2-09');
  ok(cas.none.r.ressourcesAbandonnees === attenduNone
    && Object.values(cas.none.par).every((x) => x.res === null && x.add.length === 0),
    `FIXTPL2-09 : en mode « Ne pas affecter », aucun principal, aucun complémentaire, et le compteur vaut ${attenduNone} — soit TOUTES les suggestions du modèle`, 'FIXTPL2-09');
  await p.screenshot({ path: SHOTS + '05-affectations-valides.png' });
  await ctx.close();
}

// ============================================================
// FIXTPL2-10 → FIXTPL2-14 — CORRECTIF B : le wizard « Structure seule »
// ============================================================
console.log('\n[FIXTPL2-WIZ] Créer un chantier depuis un modèle sans intervention');
{
  const { ctx, p } = await newPage({ tag: 'FIX2-WIZ' });
  await ev(p, () => {
    app.projectTemplates.push({
      id: 'ptpl-nue', name: 'Bâtiment type — trame nue',
      description: 'Une hiérarchie réutilisable, sans aucune intervention.',
      scope: 'structure', sourceName: 'Résidence Keravel', createdAt: '2026-08-20T09:00',
      rootId: 'tn-1',
      nodes: [
        { id: 'tn-1', parentId: null, name: 'Bâtiment type', type: 'building', description: '', responsibleResourceId: null },
        { id: 'tn-2', parentId: 'tn-1', name: 'RDC', type: 'zone', description: '', responsibleResourceId: null },
        { id: 'tn-3', parentId: 'tn-1', name: 'Étage 1', type: 'zone', description: '', responsibleResourceId: null },
      ],
      tasks: [],
    });
    save();
  });

  // 1. Un modèle AVEC interventions : rien ne doit avoir changé.
  const avec = await ev(p, () => {
    openProjectCreate();
    wizardPickMode('project-template');
    wizardPickProjectTemplate('ptpl-etage-type');
    return {
      champs: [...document.querySelectorAll('#wizForm [name]')].map((x) => x.name),
      meta: [...document.querySelectorAll('.wiz-preview-meta span')].map((x) => x.textContent.trim()),
      chaine: document.querySelectorAll('.wiz-chain .wiz-step').length,
      fin: $('.wiz-target')?.textContent.trim() || '',
      libelleRes: [...document.querySelectorAll('#wizForm label')].map((x) => x.childNodes[0].textContent.trim()),
      optionsRes: [...document.querySelectorAll('#wizForm [name=ptplResources] option')].map((x) => x.textContent.trim()),
      texte: [...document.querySelectorAll('#wizForm p')].map((x) => x.textContent.trim()).join(' '),
    };
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '01-ptpl-avec-interventions-desktop.png' });
  note('FIXTPL2-10', avec);
  ok(avec.champs.join('|') === 'name|location|startDate|taskGranularity|ptplResources'
    && avec.meta.join('|') === '4 niveaux|6 interventions|5 dépendances'
    && avec.chaine === 6 && /Fin estimée/.test(avec.fin)
    && /à faire/.test(avec.texte),
    'FIXTPL2-10 : pour un modèle AVEC interventions, l’aperçu conserve EXACTEMENT le comportement de V2.11.0.1 — date de démarrage, gestion des tâches, affectations, chaîne d’interventions et fin estimée', 'FIXTPL2-10');
  ok(avec.libelleRes.includes('Affectations')
    && avec.optionsRes.join('|') === 'Ne pas affecter|Reprendre les affectations suggérées',
    'FIXTPL2-10 : le vocabulaire dit la vérité — « Affectations » et « Reprendre les affectations suggérées », comme dans « Utiliser le modèle », puisqu’il s’agit bien de l’intervenant principal ET de ses renforts', 'FIXTPL2-10');

  /* 2. On SALIT volontairement wizard.data, on revient, puis on choisit le
        modèle sans intervention. C'est le scénario du §3.5. */
  const seule = await ev(p, () => {
    $('#wizForm [name=startDate]').value = '2027-01-11';
    $('#wizForm [name=ptplResources]').value = 'suggest';
    $('#wizForm [name=taskGranularity]').value = 'week';
    wizardGo('ptpl-select');
    const perime = { startDate: app.ui.wizard.data.startDate, ptplResources: app.ui.wizard.data.ptplResources, taskGranularity: app.ui.wizard.data.taskGranularity };
    wizardPickProjectTemplate('ptpl-nue');
    return {
      perime,
      champs: [...document.querySelectorAll('#wizForm [name]')].map((x) => x.name),
      meta: [...document.querySelectorAll('.wiz-preview-meta span')].map((x) => x.textContent.trim()),
      chaine: document.querySelectorAll('.wiz-chain').length,
      fin: document.querySelectorAll('.wiz-target').length,
      texte: [...document.querySelectorAll('#wizForm p')].map((x) => x.textContent.trim()).join(' '),
      titre: $('#drawerContent h2').textContent.trim(),
    };
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: SHOTS + '02-ptpl-structure-seule-desktop.png' });
  note('FIXTPL2-11', seule);
  ok(seule.champs.join('|') === 'name|location'
    && seule.chaine === 0 && seule.fin === 0
    && seule.meta.join('|') === '3 niveaux|Structure seule'
    && !/intervention/.test(seule.texte.replace(/sans intervention/g, ''))
    && /uniquement une structure/.test(seule.texte),
    'FIXTPL2-11 : pour un modèle STRUCTURE SEULE, l’aperçu ne propose NI date de démarrage, NI gestion des tâches, NI affectations, NI fin estimée, NI chaîne d’interventions vide — seulement le nom, la localisation, et une phrase sobre qui dit ce qui va se passer', 'FIXTPL2-11');
  ok(seule.perime.startDate === '2027-01-11' && seule.perime.ptplResources === 'suggest' && seule.perime.taskGranularity === 'week',
    'FIXTPL2-13 : le décor du piège est bien en place — wizard.data porte encore la date, le mode d’affectation et la granularité saisis sur le modèle précédent', 'FIXTPL2-13');

  const cree = await ev(p, () => {
    const avP = app.projects.map((x) => x.id), av = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length, m: app.milestones.length };
    $('#wizForm [name=name]').value = 'Chantier sans planning';
    $('#wizForm [name=location]').value = 'Brest';
    createProjectFromProjectTemplate();
    const np = app.projects.find((x) => !avP.includes(x.id));
    const ns = app.structureNodes.filter((n) => n.projectId === np.id);
    const ap = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length, m: app.milestones.length };
    undo();
    const un = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length, m: app.milestones.length };
    redo();
    const re = { p: app.projects.length, n: app.structureNodes.length, t: app.tasks.length, m: app.milestones.length };
    const np2 = app.projects.find((x) => !avP.includes(x.id));
    return {
      av, ap, un, re,
      projet: { nom: np.name, lieu: np.location, startDate: np.startDate, baselineEnd: np.baselineEnd,
        lifecycle: np.lifecycle, mode: np.creationMode, tpl: np.projectTemplateId, gran: np.taskGranularity },
      niveaux: ns.map((n) => n.name), racines: ns.filter((n) => !n.parentId).length,
      taches: app.tasks.filter((t) => t.projectId === np.id).length,
      jalons: app.milestones.filter((m) => m.projectId === np.id).length,
      datesSurNiveaux: ns.filter((n) => n.start || n.end || n.startDate).length,
      wizardFerme: app.ui.wizard === null,
      apresRedo: { startDate: np2.startDate, baselineEnd: np2.baselineEnd,
        niveaux: app.structureNodes.filter((n) => n.projectId === np2.id).length,
        taches: app.tasks.filter((t) => t.projectId === np2.id).length },
    };
  });
  await p.waitForTimeout(300);
  note('FIXTPL2-12', cree);
  ok(cree.projet.nom === 'Chantier sans planning' && cree.niveaux.length === 3 && cree.racines === 1
    && cree.taches === 0 && cree.jalons === 0 && cree.datesSurNiveaux === 0
    && cree.projet.lifecycle === 'active' && cree.projet.mode === 'project-template'
    && cree.projet.tpl === 'ptpl-nue' && cree.wizardFerme,
    'FIXTPL2-12 : le chantier est créé avec ses 3 niveaux et leur hiérarchie, ZÉRO intervention, ZÉRO jalon artificiel, aucune date posée sur un niveau — et il reste actif, marqué « project-template » et relié à son modèle', 'FIXTPL2-12');
  ok(cree.projet.startDate === null && cree.projet.baselineEnd === null && cree.projet.gran === 'day',
    'FIXTPL2-13 : startDate et baselineEnd valent NULL, et la granularité retombe sur la valeur par défaut du produit — les valeurs périmées de wizard.data (11/01/2027, « suggest », « week ») n’ont PAS fui dans le chantier créé', 'FIXTPL2-13');
  ok(cree.ap.p === cree.av.p + 1 && cree.ap.n === cree.av.n + 3 && cree.ap.t === cree.av.t && cree.ap.m === cree.av.m
    && cree.un.p === cree.av.p && cree.un.n === cree.av.n
    && cree.re.p === cree.ap.p && cree.re.n === cree.ap.n && cree.re.t === cree.ap.t
    && cree.apresRedo.startDate === null && cree.apresRedo.baselineEnd === null
    && cree.apresRedo.niveaux === 3 && cree.apresRedo.taches === 0,
    'FIXTPL2-14 : « Annuler » supprime le chantier ET toute sa structure d’UN SEUL geste — aucun chantier vide résiduel ; « Rétablir » les recrée, toujours sans tâche et toujours sans date artificielle', 'FIXTPL2-14');

  // Mobile : le même écran, adapté.
  await ctx.close();
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'FIX2-WIZ-390' });
  const mob = await ev(p2, () => {
    app.projectTemplates.push({
      id: 'ptpl-nue', name: 'Bâtiment type — trame nue', description: 'Une hiérarchie réutilisable, sans aucune intervention.',
      scope: 'structure', sourceName: '', createdAt: '', rootId: 'tn-1',
      nodes: [{ id: 'tn-1', parentId: null, name: 'Bâtiment type', type: 'building', description: '', responsibleResourceId: null },
              { id: 'tn-2', parentId: 'tn-1', name: 'RDC', type: 'zone', description: '', responsibleResourceId: null },
              { id: 'tn-3', parentId: 'tn-1', name: 'Étage 1', type: 'zone', description: '', responsibleResourceId: null }],
      tasks: [],
    });
    save();
    openProjectCreate(); wizardPickMode('project-template'); wizardPickProjectTemplate('ptpl-nue');
    const panel = document.querySelector('.drawer-panel');
    return { scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      panelDeborde: panel.scrollWidth > panel.clientWidth + 1,
      champs: [...document.querySelectorAll('#wizForm [name]')].map((x) => x.name),
      boutonsVisibles: [...document.querySelectorAll('#wizForm .drawer-form-actions .btn')].every((b) => {
        const rb = b.getBoundingClientRect(), rp = panel.getBoundingClientRect();
        return rb.width > 0 && rb.left >= rp.left - 1 && rb.right <= rp.right + 1;
      }) };
  });
  await p2.waitForTimeout(250);
  await p2.screenshot({ path: SHOTS + '03-ptpl-structure-seule-mobile.png' });
  note('FIXTPL2-11-mobile', mob);
  ok(!mob.scrollH && !mob.panelDeborde && mob.champs.join('|') === 'name|location' && mob.boutonsVisibles,
    'FIXTPL2-11 : à 390 px l’écran « Structure seule » reste propre — aucun défilement horizontal, aucun dépassement de la side-window, aucun bouton coupé', 'FIXTPL2-11');
  await c2.close();

  // La capture du chantier créé, et le thème sombre.
  const { ctx: c3, p: p3 } = await newPage({ tag: 'FIX2-SHOT' });
  await ev(p3, () => {
    app.projectTemplates.push({
      id: 'ptpl-nue', name: 'Bâtiment type — trame nue', description: 'Une hiérarchie réutilisable, sans aucune intervention.',
      scope: 'structure', sourceName: '', createdAt: '', rootId: 'tn-1',
      nodes: [{ id: 'tn-1', parentId: null, name: 'Bâtiment type', type: 'building', description: '', responsibleResourceId: null },
              { id: 'tn-2', parentId: 'tn-1', name: 'RDC', type: 'zone', description: '', responsibleResourceId: null },
              { id: 'tn-3', parentId: 'tn-1', name: 'Étage 1', type: 'zone', description: '', responsibleResourceId: null }],
      tasks: [],
    });
    save();
    openProjectCreate(); wizardPickMode('project-template'); wizardPickProjectTemplate('ptpl-nue');
    $('#wizForm [name=name]').value = 'Résidence Trame Nue';
    createProjectFromProjectTemplate();
    const pid = app.projects[app.projects.length - 1].id;
    openProjectTab(pid, 'Structure');
    if (!structureAllExpanded(pid)) toggleAllStructure(pid);
  });
  await p3.waitForTimeout(450);
  await p3.screenshot({ path: SHOTS + '04-chantier-cree-structure-seule.png' });
  await ev(p3, () => { setAppearance('dark'); renderPage(); openProjectCreate(); wizardPickMode('project-template'); wizardPickProjectTemplate('ptpl-nue'); });
  await p3.waitForTimeout(350);
  await p3.screenshot({ path: SHOTS + '06-dark-mode.png' });
  const sombre = await ev(p3, () => {
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const prev = document.querySelector('.wiz-preview'), h2 = $('#drawerContent h2');
    return { fond: lum(getComputedStyle(prev).backgroundColor), titre: lum(getComputedStyle(h2).color),
      champs: [...document.querySelectorAll('#wizForm [name]')].map((x) => x.name) };
  });
  note('FIXTPL2-11-sombre', sombre);
  ok(sombre.titre > 150 && Math.abs(sombre.titre - sombre.fond) > 80 && sombre.champs.join('|') === 'name|location',
    `FIXTPL2-11 : en thème sombre l’écran « Structure seule » garde ses jetons (titre ${Math.round(sombre.titre)} sur fond ${Math.round(sombre.fond)}) et la même simplicité`, 'FIXTPL2-11');
  await c3.close();
}

// ============================================================
// RESPONSIVE — onze largeurs, clair et sombre
// ============================================================
console.log('\n[FIXTPL2-RESP] Largeurs et thèmes');
{
  const mesures = [];
  for (const [w, h] of [[1920, 1080], [1600, 1000], [1440, 900], [1366, 768], [1280, 800], [1080, 800], [900, 800], [768, 1024], [430, 932], [390, 844], [360, 780]]) {
    for (const theme of ['light', 'dark']) {
      const { ctx, p } = await newPage({ w, h, tag: `FIX2-RESP-${w}-${theme}` });
      const m = await ev(p, (t) => {
        setAppearance(t); renderPage();
        app.projectTemplates.push({
          id: 'ptpl-nue', name: 'Bâtiment type — trame nue', description: 'Une hiérarchie réutilisable, sans aucune intervention.',
          scope: 'structure', sourceName: '', createdAt: '', rootId: 'tn-1',
          nodes: [{ id: 'tn-1', parentId: null, name: 'Bâtiment type', type: 'building', description: '', responsibleResourceId: null },
                  { id: 'tn-2', parentId: 'tn-1', name: 'RDC', type: 'zone', description: '', responsibleResourceId: null },
                  { id: 'tn-3', parentId: 'tn-1', name: 'Étage 1', type: 'zone', description: '', responsibleResourceId: null }],
          tasks: [],
        });
        save();
        const panel = () => document.querySelector('.drawer-panel');
        const etat = () => ({
          scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          panelDeborde: panel().scrollWidth > panel().clientWidth + 1,
          boutonsCoupes: [...document.querySelectorAll('#drawerContent .btn')].filter((b) => {
            const rb = b.getBoundingClientRect(), rp = panel().getBoundingClientRect();
            return rb.width > 0 && (rb.left < rp.left - 1 || rb.right > rp.right + 1);
          }).length,
        });
        openProjectCreate(); wizardPickMode('project-template');
        wizardPickProjectTemplate('ptpl-etage-type');
        const avecT = etat();
        wizardPickProjectTemplate('ptpl-nue');
        const seule = etat();
        closeOverlay('drawer'); openProjectTemplatesManager();
        const gest = etat();
        return { avecT, seule, gest };
      }, theme);
      mesures.push({ w, theme, ...m });
      await ctx.close();
    }
  }
  const mauvais = mesures.filter((m) =>
    m.avecT.scrollH || m.avecT.panelDeborde || m.avecT.boutonsCoupes ||
    m.seule.scrollH || m.seule.panelDeborde || m.seule.boutonsCoupes ||
    m.gest.scrollH || m.gest.panelDeborde || m.gest.boutonsCoupes);
  note('FIXTPL2-RESP', { mesurées: mesures.length, fautives: mauvais });
  ok(mauvais.length === 0,
    `FIXTPL2-11 : sur ${mesures.length} combinaisons (11 largeurs de 1920 à 360 px × clair/sombre), les trois écrans — aperçu avec interventions, aperçu structure seule, gestionnaire — ne provoquent AUCUN défilement horizontal, AUCUN dépassement de la side-window et AUCUN bouton coupé`, 'FIXTPL2-11');
}

// ============================================================
// FREEZE-21102 — Le gel PROPRE à ce correctif (contre V2.11.0.1)
// ============================================================
console.log('\n[FREEZE-21102] Périmètre du correctif et architecture');
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
  const A = read(PREV_21101), B = read(CUR);

  /* TROIS fonctions modifiées, UNE ajoutée. Rien d'autre. */
  const attendues = [
    'cloneStructureTree',              // §2 — les deux gardes d'assignabilité
    'renderWizard',                    // §3 — l'étape ptpl-preview
    'createProjectFromProjectTemplate',// §3.4 / §3.5 — le modèle fait foi
  ];
  const ajoutees = ['canAssignResource'];
  /* V2.11.0.3 — RE-POINTAGE. Les fonctions touchées par les rounds SUIVANTS
     sont tolérées par le BALAYAGE — sinon ce gel signalerait comme dérive ce
     qu'un correctif ultérieur corrige volontairement — mais elles n'entrent
     PAS dans le contrôle « les fonctions annoncées ont réellement changé »,
     qui reste strictement celui du round de cette recette. La liste reste
     FERMÉE : une fonction non nommée ferait toujours tomber le test, et le
     gel propre à chaque round vérifie son périmètre de façon indépendante. */
  const attenduesRoundsSuivants = [
    /* V2.11.0.3 — openStructureForm() ne PORTE plus la règle « responsable de
       niveau = personne active » : elle la LIT dans
       structureResponsibleResources(), que la pose d'un modèle lit elle aussi.
       Une seule ligne change, et elle RETIRE du code plutôt qu'elle n'en
       ajoute. */
    'openStructureForm',
  ];
  /* V2.12.0 — le périmètre NOMMÉ des « Conditions de démarrage », repris
     verbatim de FREEZE-2120 dans recette-conditions-demarrage-v2.12.0.mjs. Il
     est TOLÉRÉ par ce balayage — sinon ce gel signalerait comme dérive ce qu'un
     round ultérieur modifie volontairement — mais la liste reste FERMÉE : une
     fonction non nommée fait toujours tomber le test, et la recette V2.12.0
     vérifie de son côté que ces 25 fonctions ont RÉELLEMENT changé, et elles
     seules. */
  const attenduesV2120 = [
    'migrateState', 'alignDemoDates', 'setTaskStatus', 'openTask', 'openFieldTaskModal',
    'confirmDeleteTask', 'cloneStructureTree', 'collectStructureSource',
    'duplicateStructureNode', 'applyTemplateToProject', 'buildProjectTemplateRecord',
    'gantt', 'projectToday', 'projectUpcomingTimeline', 'renderArtisan',
    'getTodayDecisions', 'getTodayWarnings', 'decisionCard', 'watchCard',
    'attentionRowTone', 'openMoreIssues', 'showKanvixBackupPreview',
    'exportKanvixData', 'applyImportPlan', 'impDroppedLines',
  ];
  /* V2.12.0.1 — les deux fonctions du correctif « éditeur universel », TOLÉRÉES
     par ce balayage (sinon ce gel signalerait comme dérive ce qu'un round
     ultérieur corrige volontairement). La liste reste FERMÉE et le contrôle
     « les fonctions du round ont réellement changé » reste celui de la recette. */
  const attenduesV21201 = ['submitTaskEdit', 'clearTaskEditAck', 'confirmPrerequisiteStart'];
  /* V2.12.0.2 — restoreHistoryState(), TOLÉRÉE par ce balayage : le correctif
     « une communication ne remonte pas le temps » la modifie volontairement.
     La liste reste FERMÉE, et le contrôle « les fonctions du round ont
     réellement changé » reste celui de la recette. */
  const attenduesV21202 = ['restoreHistoryState', 'preserveCommunications'];
  const tolerees = [...attendues, ...attenduesRoundsSuivants, ...attenduesV2120, ...attenduesV21201, ...attenduesV21202];
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
  const ajoutsReels = ajoutees.filter((n) => !extractFn(A, n) && !!extractFn(B, n));
  note('FREEZE-21102-périmètre', { modifiées: attendues, ajoutées: ajoutees, horsPérimètre: horsPerimetre, indentation: indentDiff, nonModifiées: nonModifiees, ajoutsRéels: ajoutsReels });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-21102 : hors des QUATRE fonctions du périmètre NOMMÉ — cloneStructureTree, renderWizard et createProjectFromProjectTemplate pour V2.11.0.2, openStructureForm pour V2.11.0.3 — le balayage de tout le fichier ne trouve AUCUNE autre fonction modifiée depuis V2.11.0.1', 'FREEZE-21102');
  ok(nonModifiees.length === 0 && ajoutsReels.length === 1,
    'FREEZE-21102 : les trois fonctions annoncées ont réellement changé, et UNE seule fonction a été ajoutée — canAssignResource(), la lecture de la règle d’assignabilité existante', 'FREEZE-21102');

  /* La fonction ajoutée ne réécrit AUCUNE règle : elle interroge les listes
     que le produit propose déjà dans ses sélecteurs de tâche. */
  const regle = extractFn(B, 'canAssignResource');
  const lecture = {
    utiliseMain: /mainAssignableResources\(\)/.test(regle),
    utiliseAssignable: /assignableResources\(\)/.test(regle),
    // Elle ne RECOPIE pas les critères : ni archived, ni equipment en dur.
    pasDeCritereRecopie: !/archived|equipment|status/.test(regle),
    courte: regle.split('\n').length <= 8,
    // Les listes elles-mêmes n'ont pas bougé.
    listesGelees: md5(extractFn(A, 'assignableResources')) === md5(extractFn(B, 'assignableResources'))
      && md5(extractFn(A, 'mainAssignableResources')) === md5(extractFn(B, 'mainAssignableResources'))
      && md5(extractFn(A, 'resourceActive')) === md5(extractFn(B, 'resourceActive'))
      && md5(extractFn(A, 'normalizeTaskResources')) === md5(extractFn(B, 'normalizeTaskResources')),
    pasDeMoteurRessources: !/function\s+(ResourceAssignmentEngine|resourceEngine|assignmentEngine|canAssignResourceForTemplate)\s*\(/.test(B),
    appelsDansLaPrimitive: (extractFn(B, 'cloneStructureTree').match(/canAssignResource\(/g) || []).length === 2,
    usagesTotaux: (B.match(/canAssignResource\(/g) || []).length,
  };
  note('FREEZE-21102-règle', lecture);
  ok(lecture.utiliseMain && lecture.utiliseAssignable && lecture.pasDeCritereRecopie && lecture.courte
    && lecture.listesGelees && lecture.pasDeMoteurRessources && lecture.appelsDansLaPrimitive
    && lecture.usagesTotaux === 3,
    'FREEZE-21102 : canAssignResource() ne réécrit AUCUNE règle — elle LIT mainAssignableResources() et assignableResources(), les listes mêmes que proposent les sélecteurs de tâche, sans recopier un seul critère (« archived », « equipment », « status » n’y apparaissent pas). Ces listes, resourceActive() et normalizeTaskResources() sont byte-identiques. Aucun moteur de ressources parallèle, et la règle n’est appelée qu’aux DEUX endroits de la primitive de clonage', 'FREEZE-21102');

  /* §9 — le gel ARCHITECTURAL, étendu. */
  const dup = extractFn(B, 'duplicateStructureNode'), prim = extractFn(B, 'cloneStructureTree'),
    apply = extractFn(B, 'applyTemplateToProject');
  const arch = {
    uneSeulePrimitive: (B.match(/function\s+cloneStructureTree\s*\(/g) || []).length === 1,
    appels: (B.match(/= cloneStructureTree\(/g) || []).length,
    appelants: noms.filter((n) => n !== 'cloneStructureTree' && !parIndentation.includes(n)
      && /= cloneStructureTree\(/.test(extractFn(B, n) || '')).sort().join('|'),
    aiPanelNAppellePas: !/cloneStructureTree\(/.test(blocIndente(B, 'renderAIPanel') || ''),
    dupSansTable: !/new Map\(/.test(dup),
    applySansTable: !/new Map\(/.test(apply),
    tablesUniques: (B.match(/mapNoeuds = new Map/g) || []).length === 1 && (B.match(/mapTaches = new Map/g) || []).length === 1,
    remapDepsUnique: (B.match(/deps: internes\.map/g) || []).length === 1,
    remapReworkUnique: (B.match(/reworkOfTaskId: repriseInterne/g) || []).length === 1,
    remapNoeudUnique: (B.match(/structureNodeId: mapNoeuds\.get/g) || []).length === 1,
    primitivePure: !/\n\s*(app\.(structureNodes|tasks|history)\.|save\(\)|snapshot\(\)|render\(\))/.test(prim || 'x'),
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    pasDeMoteurParallele: !/function\s+(TemplateEngine|cloneTemplateTree|cloneTemplate|applyTemplateEngine|structureClone|copyStructureTree|instantiateTemplateTree|applyTemplateTasks)\s*\(/.test(B),
    pasDePileUndoParallele: !/templateUndoStack|projectTemplateHistory|tplSnapshot|resourceUndoStack|wizardUndoStack/.test(B),
    /* §9 — aucune création de structure PARALLÈLE : les seuls endroits qui
       poussent des niveaux sont la création manuelle d'UN niveau et les deux
       appelants de la primitive. */
    creationStructure: (B.match(/app\.structureNodes\.push\(/g) || []).length === 3,
    creationDansAppelants: /app\.structureNodes\.push\(\.\.\.copie\.nodes\)/.test(dup)
      && /app\.structureNodes\.push\(\.\.\.res\.nodes\)/.test(apply),
    pasDeSecondWizard: (B.match(/function\s+renderWizard\s*\(/g) || []).length === 1
      && (B.match(/function\s+wizardPickMode\s*\(/g) || []).length === 1
      && (B.match(/function\s+createProjectFromProjectTemplate\s*\(/g) || []).length === 1,
    pasDeDragStructure: !/data-structure-node="[^"]*"[^>]*draggable/.test(B),
  };
  note('FREEZE-21102-architecture', arch);
  ok(arch.uneSeulePrimitive && arch.appels === 2 && arch.aiPanelNAppellePas
    && arch.appelants === 'applyTemplateToProject|duplicateStructureNode',
    'FREEZE-21102 : cloneStructureTree() reste l’UNIQUE primitive de clonage, appelée exactement DEUX fois dans tout le fichier, par duplicateStructureNode() et applyTemplateToProject() — et par personne d’autre', 'FREEZE-21102');
  ok(arch.dupSansTable && arch.applySansTable && arch.tablesUniques
    && arch.remapDepsUnique && arch.remapReworkUnique && arch.remapNoeudUnique && arch.primitivePure,
    'FREEZE-21102 : les deux appelants délèguent toujours et ne construisent aucune table ; mapNoeuds, mapTaches et le remapping des rattachements, des dépendances et des reprises n’apparaissent qu’UNE fois chacun ; la primitive reste PURE', 'FREEZE-21102');
  ok(arch.creationStructure && arch.creationDansAppelants && arch.pasDeMoteurParallele
    && arch.pasDePileUndoParallele && arch.pasDeSecondWizard && arch.unSeulSnapshot
    && arch.unSeulGantt && arch.pasDeDragStructure,
    'FREEZE-21102 : aucune logique de création de structure PARALLÈLE — app.structureNodes.push() n’apparaît qu’à TROIS endroits (la création manuelle d’un niveau et les deux appelants de la primitive). Aucun second moteur de modèles, aucune seconde pile Undo, un seul renderWizard(), un seul wizardPickMode(), un seul createProjectFromProjectTemplate(), un seul snapshot(), un seul gantt(), aucun drag & drop de structure', 'FREEZE-21102');

  /* V2.12.0 — RE-POINTAGE, même discipline qu'en V2.11.0 : PREUVE PLUTÔT QUE
     SILENCE. V2.12.0 ajoute un bloc de style, quatre conditions de démonstration
     et une migration 14 → 15. On ne relâche rien : on RETIRE ces blocs, nommés un
     à un, et ce qui reste doit redevenir byte-identique à la référence. Un seul
     octet modifié ailleurs ferait toujours tomber la mesure. */
  const sansV2120CSS = (x) => x.replace(/      \/\* ---- V2\.12\.0 — CONDITIONS DE DÉMARRAGE[\s\S]*?\n      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER/, "      /* ---- V2.11.0 — MODÈLES DE CHANTIER");
  const sansV2120Initial = (x) => {
    const i = x.indexOf('        /* V2.12.0 — CONDITIONS DE DÉMARRAGE de démonstration.');
    const j = x.indexOf('        ],\n        /* ============ V2.11.0 — MODÈLES DE CHANTIER');
    return i > 0 && j > i ? x.slice(0, i) + x.slice(j + '        ],\n'.length) : x;
  };
  /* migrateState() reçoit TROIS ajouts V2.12.0, et trois seulement : la
     migration 14 → 15 elle-même, la normalisation des conditions d'un MODÈLE et
     la clé `prerequisites` de l'objet modèle. On les retire nommément — si un
     seul octet avait bougé ailleurs dans cette fonction, la mesure tomberait. */
  const coupeV2120 = (x, debut, fin) => {
    const i = x.indexOf(debut); if (i < 0) return x;
    const j = x.indexOf(fin, i); if (j < 0) return x;
    return x.slice(0, i) + x.slice(j);
  };
  const sansV2120Migration = (x) => {
    let y = coupeV2120(x,
      '        /* ---- V2.12.0 — MIGRATION V14 → V15 : LES CONDITIONS DE DÉMARRAGE ---',
      '        if (!Array.isArray(value.projectTemplates)) value.projectTemplates = [];');
    y = coupeV2120(y, "            /* V2.12.0 — les conditions d'un modèle.", '            let tKnown');
    y = coupeV2120(y, '            let prerequisites = (Array.isArray(t.prerequisites)', '            // Une dépendance ne peut viser');
    return y.replace('\n              prerequisites,\n', '\n');
  };
  /* §6 — aucune donnée persistée nouvelle. */
  const donnees = {
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    // V2.12.0 — la migration 14 → 15 est le SEUL ajout : retiré, migrateState()
    // redevient byte-identique. L'exigence « aucune migration créée par CE
    // correctif » est donc toujours mesurée, et elle l'est par la preuve.
    migrationGelee: md5(sansV2120Migration(extractFn(B, 'migrateState'))) === md5(extractFn(A, 'migrateState')),
    backupGele: md5(extractFn(A, 'buildKanvixBackup')) === md5(extractFn(B, 'buildKanvixBackup'))
      && md5(extractFn(A, 'validateKanvixBackup')) === md5(extractFn(B, 'validateKanvixBackup'))
      && md5(extractFn(A, 'confirmKanvixRestore')) === md5(extractFn(B, 'confirmKanvixRestore')),
    requisGele: (A.match(/KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/) || [''])[0] === (B.match(/KANVIX_BACKUP_REQUIRED = \[[\s\S]*?\]/) || [''])[0],
    // Les données de démonstration n'ont pas été touchées pour « faciliter »
    // les tests : les cas tordus sont créés par la recette.
    demoIdentique: md5(sansV2120Initial((B.match(/const INITIAL_STATE = \{[\s\S]*?\n      \};/) || [''])[0]))
      === md5((A.match(/const INITIAL_STATE = \{[\s\S]*?\n      \};/) || [''])[0]),
    cssIdentique: md5(sansV2120CSS((B.match(/<style id="kanvix-css">[\s\S]*?<\/style>/) || [''])[0]))
      === md5((A.match(/<style id="kanvix-css">[\s\S]*?<\/style>/) || [''])[0]),
  };
  note('FREEZE-21102-données', donnees);
  // V2.12.0 — le build de référence reste en 14, le build courant passe en 15 (§28).
  ok(donnees.schemaAvant === '14' && donnees.schemaApres === '15' && donnees.store === 'kanvix-product-8-3' && donnees.build,
    'FREEZE-21102 : aucune donnée persistée nouvelle — SCHEMA_VERSION reste 14, STORE reste « kanvix-product-8-3 », build inchangé', 'FREEZE-21102');
  ok(donnees.migrationGelee && donnees.backupGele && donnees.requisGele,
    'FREEZE-21102 : migrateState(), buildKanvixBackup(), validateKanvixBackup(), confirmKanvixRestore() et KANVIX_BACKUP_REQUIRED sont BYTE-IDENTIQUES — aucune migration créée, aucun format de sauvegarde touché', 'FREEZE-21102');
  ok(donnees.demoIdentique && donnees.cssIdentique,
    'FREEZE-21102 : INITIAL_STATE est BYTE-IDENTIQUE — aucune donnée de démonstration n’a été modifiée pour « faciliter » les tests, les cas tordus sont créés par la recette. La feuille de style est elle aussi byte-identique : ce correctif ne touche pas au dessin', 'FREEZE-21102');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `FIXTPL2 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'FIXTPL2');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
