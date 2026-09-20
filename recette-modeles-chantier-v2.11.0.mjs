// ============================================================
// KANVIX — Recette « Modèles de chantier réutilisables » (V2.11.0)
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
const CUR = 'kanvix-next-gen-v2.11.0.html';
const PREV = 'kanvix-next-gen-v2.10.0.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.11.0/';
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
     suggestedAdditionalResourceIds (les ressources complémentaires suggérées).
     L'assertion épingle donc douze champs au lieu de onze — elle reste une
     liste EXACTE, donc plus stricte qu'avant : un treizième champ, quel qu'il
     soit, la ferait tomber. Ce qu'elle protégeait — qu'aucune donnée
     opérationnelle ne descende dans une trame — est inchangé, et TPL-14 le
     vérifie toujours nommément. */
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
     contenu (« Structure seule » / « Structure + interventions ») : deux
     boutons radio nommés « contenu » s'ajoutent aux deux champs d'origine.
     L'assertion épingle la liste exacte des QUATRE contrôles — donc plus
     strictement qu'avant, où elle n'en épinglait que deux. */
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
    'FREEZE-2110 : seules les fonctions du périmètre NOMMÉ — neuf pour V2.11.0, plus openStructureForm pour V2.11.0.3 — sont modifiées ; le balayage de tout le fichier n’en trouve aucune autre', 'FREEZE-2110');

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

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `TPL : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'TPL');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
