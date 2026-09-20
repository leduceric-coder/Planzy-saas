// ============================================================
// KANVIX — Recette « Intégrité des reprises à la duplication » (V2.10.0.1)
//
//   V2.10.0 clonait correctement les niveaux, les parentId, les
//   structureNodeId et les dépendances internes. Une relation métier
//   manquait : task.reworkOfTaskId.
//
//   Un clone pouvait donc se déclarer « reprise de » une tâche de l'arbre
//   SOURCE. Deux conséquences, mesurées avant d'écrire la moindre ligne :
//     · le clone devenait incohérent avec lui-même — il dépendait de A2 mais
//       se déclarait reprise de A ;
//     · hasReworkSignaled() répondait « oui » sur la tâche SOURCE à cause
//       d'une tâche du clone : dupliquer une branche modifiait le sens du
//       graphe d'origine.
//
//   Cette recette vérifie la propriété qui compte : le graphe cloné ne
//   conserve AUCUN pointeur relationnel vers le graphe source.
//
//   Usage : node recette-structure-rework-v2.10.0.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.10.0.1.html';
const PREV = 'kanvix-next-gen-v2.10.0.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.10.0.1/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 900)}`);
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

/* Le décor, posé PAR LE TEST — jamais par INITIAL_STATE (§12) :
     hors périmètre : X
     dans « Zone test » : A, sa reprise B (deps + rework, comme le produit les
     crée réellement), C, sa reprise D, et E dont la reprise vise X. */
const decor = async (p) => {
  await ev(p, () => {
    app.structureNodes.push({
      id: 'sn-z', projectId: 'keravel', parentId: null, name: 'Zone test', type: 'zone',
      description: '', responsibleResourceId: null, archived: false, createdAt: '', updatedAt: '',
    });
    app.structureNodes.push({
      id: 'sn-z-sous', projectId: 'keravel', parentId: 'sn-z', name: 'Sous-zone', type: 'zone',
      description: '', responsibleResourceId: null, archived: false, createdAt: '', updatedAt: '',
    });
    const mk = (id, nom, sn, deps, rework) => ({
      id, structureNodeId: sn, projectId: 'keravel', name: nom,
      lotId: 'lot-menuiseries-ext', resourceId: 'thomas',
      additionalResourceIds: ['crane-g01'], phase: 'Second œuvre',
      start: '2026-08-20T08:00', end: '2026-08-20T12:00', status: 'todo',
      deps, reworkOfTaskId: rework, colorKey: 'auto',
      baselineStart: '2026-08-20T08:00', baselineEnd: '2026-08-20T12:00',
    });
    // Hors du périmètre à cloner
    app.tasks.push(mk('t-X', 'Intervention extérieure', 'sn-keravel-rdc', [], null));
    // Dans le périmètre
    app.tasks.push(mk('t-A', 'Pose fenêtres', 'sn-z', [], null));
    app.tasks.push(mk('t-B', 'Reprise — Pose fenêtres', 'sn-z', ['t-A'], 't-A'));
    app.tasks.push(mk('t-C', 'Cloisons', 'sn-z-sous', [], null));
    app.tasks.push(mk('t-D', 'Reprise — Cloisons', 'sn-z-sous', [], 't-C'));
    app.tasks.push(mk('t-E', 'Reprise vers l’extérieur', 'sn-z', [], 't-X'));
    save();
  });
  await p.waitForTimeout(150);
};
const SOURCES = ['t-X', 't-A', 't-B', 't-C', 't-D', 't-E'];
/* Les tâches créées par la duplication, sans rien supposer du format des ID :
   on photographie les identifiants AVANT, et le clone est la différence. Les
   onze tâches de démonstration ne sont donc jamais prises pour des clones. */
const avantDuplication = (p) => ev(p, () => app.tasks.map((t) => t.id));
const lireClones = (p, avant) => ev(p, (ids0) => {
  const avantSet = new Set(ids0);
  const clones = app.tasks.filter((t) => !avantSet.has(t.id));
  const ids = new Set(clones.map((t) => t.id));
  const parNom = {};
  clones.forEach((t) => { parNom[t.name] = t; });
  return {
    clones: clones.map((t) => ({
      nom: t.name, id: t.id, sn: t.structureNodeId,
      deps: t.deps, rework: t.reworkOfTaskId,
      resourceId: t.resourceId, add: t.additionalResourceIds, lotId: t.lotId,
      start: t.start, end: t.end, status: t.status, colorKey: t.colorKey,
    })),
    idsClones: [...ids],
    parNom: Object.fromEntries(Object.entries(parNom).map(([k, v]) => [k, v.id])),
  };
}, avant);

// ============================================================
// REW-DUP-01 / 02 / 05 / 06 — Les relations internes
// ============================================================
console.log('\n[REW-DUP] Relations de reprise internes au périmètre');
{
  const { ctx, p } = await newPage({ tag: 'INT' });
  await decor(p);
  const avant = await avantDuplication(p);
  const res = await ev(p, () => duplicateStructureNode('sn-z', { withTasks: true }));
  const c = await lireClones(p, avant);
  note('REW-DUP-01', { res, clones: c.clones.map((x) => ({ nom: x.nom, rework: x.rework, deps: x.deps })) });

  const A2 = c.parNom['Pose fenêtres'], B2 = c.parNom['Reprise — Pose fenêtres'];
  const C2 = c.parNom['Cloisons'], D2 = c.parNom['Reprise — Cloisons'];
  const get = (nom) => c.clones.find((x) => x.nom === nom);

  ok(!!A2 && !!B2 && get('Reprise — Pose fenêtres').rework === A2,
    'REW-DUP-01 : la reprise clonée désigne la tâche CLONÉE — B2.reworkOfTaskId === A2.id', 'REW-DUP-01');
  ok(get('Reprise — Pose fenêtres').rework !== 't-A',
    'REW-DUP-01 : elle ne désigne PAS la tâche source — B2.reworkOfTaskId !== A.id', 'REW-DUP-01');

  /* La propriété qui compte vraiment, vérifiée sur CHAQUE tâche clonée. */
  const idsClones = new Set(c.idsClones);
  const fautifs = c.clones.filter((t) => t.rework && !idsClones.has(t.rework));
  note('REW-DUP-02', { clones: c.clones.length, fautifs: fautifs.map((x) => `${x.nom}→${x.rework}`) });
  ok(fautifs.length === 0,
    `REW-DUP-02 : aucune des ${c.clones.length} tâches clonées ne porte un reworkOfTaskId vers une tâche SOURCE — il est soit null, soit un ID cloné`, 'REW-DUP-02');
  /* Et la propriété d'intégrité complète du §4 : les TROIS relations. */
  const noeudsClones = await ev(p, (ids0) => {
    const avantSet = new Set(ids0);
    const clones = app.tasks.filter((t) => !avantSet.has(t.id));
    const idsT = new Set(clones.map((t) => t.id));
    // Les niveaux clonés = ceux qui n'existaient pas non plus avant.
    const noeudsSource = ['sn-z', 'sn-z-sous'];
    return {
      snVersSource: clones.filter((t) => noeudsSource.includes(t.structureNodeId)).length,
      depsVersSource: clones.filter((t) => (t.deps || []).some((d) => !idsT.has(d))).length,
      reworkVersSource: clones.filter((t) => t.reworkOfTaskId && !idsT.has(t.reworkOfTaskId)).length,
    };
  }, avant);
  note('REW-DUP-02-integrite', noeudsClones);
  ok(noeudsClones.snVersSource === 0 && noeudsClones.depsVersSource === 0 && noeudsClones.reworkVersSource === 0,
    'REW-DUP-02 : le graphe cloné est AUTONOME — aucun structureNodeId, aucune dep, aucun reworkOfTaskId ne pointe vers le graphe source', 'REW-DUP-02');

  ok(get('Reprise — Cloisons').rework === C2 && get('Reprise — Cloisons').rework !== 't-C',
    'REW-DUP-05 : une seconde relation dans le même périmètre est remappée indépendamment — D2 → C2, jamais vers C', 'REW-DUP-05');
  ok(!!D2 && A2 !== C2 && B2 !== D2,
    'REW-DUP-05 : les deux couples sont bien distincts', 'REW-DUP-05');

  ok(JSON.stringify(get('Reprise — Pose fenêtres').deps) === JSON.stringify([A2]) &&
     get('Reprise — Pose fenêtres').rework === A2,
    'REW-DUP-06 : dépendance ET reprise portées par la même tâche sont remappées toutes les deux, indépendamment — B2.deps = [A2] et B2.reworkOfTaskId = A2', 'REW-DUP-06');
  await ctx.close();
}

// ============================================================
// REW-DUP-03 / 04 — Relation externe, et intégrité de la source
// ============================================================
console.log('\n[REW-DUP] Relation externe et source intacte');
{
  const { ctx, p } = await newPage({ tag: 'EXT' });
  await decor(p);
  /* Deux photos distinctes, et deux variables distinctes : l'EMPREINTE des six
     tâches source (pour prouver qu'elles ne bougent pas) et la LISTE des
     identifiants existants (pour reconnaître les clones). Les confondre
     faisait passer toutes les tâches pour des clones. */
  const empreinteAvant = await ev(p, (src) =>
    src.map((id) => { const t = app.tasks.find((x) => x.id === id); return `${t.id}:${t.name}:${t.reworkOfTaskId}:${(t.deps || []).join('+')}:${t.structureNodeId}`; }), SOURCES);
  const avant = await avantDuplication(p);
  const res = await ev(p, () => duplicateStructureNode('sn-z', { withTasks: true }));
  const c = await lireClones(p, avant);
  const empreinteApres = await ev(p, (src) =>
    src.map((id) => { const t = app.tasks.find((x) => x.id === id); return `${t.id}:${t.name}:${t.reworkOfTaskId}:${(t.deps || []).join('+')}:${t.structureNodeId}`; }), SOURCES);
  const ext = c.clones.find((x) => x.nom === 'Reprise vers l’extérieur');
  note('REW-DUP-03', { clone: ext, compteurs: { rc: res.reworkClonees, ra: res.reworkAbandonnees } });
  ok(ext && ext.rework === null,
    'REW-DUP-03 : une reprise visant une tâche HORS périmètre devient null sur le clone — même philosophie que les dépendances externes de V2.10.0', 'REW-DUP-03');
  ok(res.reworkClonees === 2 && res.reworkAbandonnees === 1,
    `REW-DUP-03 : le moteur compte ce qu’il fait — ${res.reworkClonees} reprises remappées, ${res.reworkAbandonnees} abandonnée`, 'REW-DUP-03');
  note('REW-DUP-04', { avant: empreinteAvant, apres: empreinteApres });
  ok(JSON.stringify(empreinteAvant) === JSON.stringify(empreinteApres),
    'REW-DUP-04 : les six tâches SOURCE sont strictement inchangées — nom, reworkOfTaskId, deps et rattachement compris', 'REW-DUP-04');
  const sourceExt = await ev(p, () => app.tasks.find((t) => t.id === 't-E').reworkOfTaskId);
  ok(sourceExt === 't-X',
    'REW-DUP-04 : la tâche source garde SA relation vers l’extérieur — seule la copie l’abandonne', 'REW-DUP-04');
  await ctx.close();
}

// ============================================================
// REW-DUP-07 — Les référentiels partagés ne sont PAS remappés
// ============================================================
console.log('\n[REW-DUP] Ressources, lots : partagés, jamais clonés');
{
  const { ctx, p } = await newPage({ tag: 'RES' });
  await decor(p);
  const avant = await avantDuplication(p);
  await ev(p, () => duplicateStructureNode('sn-z', { withTasks: true }));
  const c = await lireClones(p, avant);
  const identiques = c.clones.every(
    (t) => t.resourceId === 'thomas' && JSON.stringify(t.add) === JSON.stringify(['crane-g01']) && t.lotId === 'lot-menuiseries-ext',
  );
  const refs = await ev(p, () => ({
    ressources: app.resources.length,
    lots: app.lots.length,
    grueUnique: app.resources.filter((r) => r.id === 'crane-g01').length,
  }));
  note('REW-DUP-07', { identiques, refs, exemple: c.clones[0] });
  ok(identiques,
    'REW-DUP-07 : resourceId, additionalResourceIds et lotId sont conservés À L’IDENTIQUE sur chaque clone — ce sont des référentiels partagés, pas des relations internes', 'REW-DUP-07');
  ok(refs.grueUnique === 1,
    'REW-DUP-07 : aucun référentiel n’a été dupliqué — la grue crane-g01 reste un seul et même matériel', 'REW-DUP-07');
  ok(c.clones.every((t) => t.start === '2026-08-20T08:00' && t.status === 'todo' && t.colorKey === 'auto'),
    'REW-DUP-07 : dates, statut et couleur restent ceux de V2.10.0 — le correctif ne touche à rien d’autre', 'REW-DUP-07');
  await ctx.close();
}

// ============================================================
// REW-DUP-08 — « Structure seule » strictement inchangée
// ============================================================
console.log('\n[REW-DUP] Structure seule');
{
  const { ctx, p } = await newPage({ tag: 'SEULE' });
  await decor(p);
  const r = await ev(p, () => {
    const ids0 = new Set(app.tasks.map((t) => t.id));
    const avant = app.tasks.length;
    const empreinteT = JSON.stringify(app.tasks.map((t) => `${t.id}:${t.reworkOfTaskId}`));
    const res = duplicateStructureNode('sn-z', {});
    return {
      res, avant, apres: app.tasks.length,
      tachesInchangees: empreinteT === JSON.stringify(app.tasks.map((t) => `${t.id}:${t.reworkOfTaskId}`)),
      niveauxClones: getStructureDescendantIds(res.id).length,
      aucuneNouvelle: app.tasks.filter((t) => !ids0.has(t.id)).length,
    };
  });
  note('REW-DUP-08', r);
  ok(r.apres === r.avant && r.aucuneNouvelle === 0 && r.tachesInchangees,
    'REW-DUP-08 : « Structure seule » ne crée aucune tâche, donc aucune relation de reprise — comportement de V2.10.0 strictement inchangé', 'REW-DUP-08');
  ok(r.res.reworkClonees === 0 && r.res.reworkAbandonnees === 0 && r.niveauxClones === 2,
    'REW-DUP-08 : les deux niveaux sont bien copiés, et les compteurs de reprise sont à zéro', 'REW-DUP-08');
  await ctx.close();
}

// ============================================================
// REW-DUP-09 / 10 — Undo et Redo
// ============================================================
console.log('\n[REW-DUP] Undo / Redo');
{
  const { ctx, p } = await newPage({ tag: 'UNDO' });
  await decor(p);
  const r = await ev(p, () => {
    const ids0 = new Set(app.tasks.map((t) => t.id));
    const empreinte = () => JSON.stringify({
      n: app.structureNodes.map((x) => `${x.id}:${x.parentId}:${x.name}`),
      t: app.tasks.map((x) => `${x.id}:${x.structureNodeId}:${(x.deps || []).join('+')}:${x.reworkOfTaskId}`),
    });
    const depart = empreinte();
    const undoAvant = undoHistory.length, histAvant = app.history.length;
    const res = duplicateStructureNode('sn-z', { withTasks: true });
    const apres = empreinte();
    const transactions = undoHistory.length - undoAvant;
    undo();
    const etatUndo = {
      empreinte: empreinte(),
      taches: app.tasks.length,
      noeuds: app.structureNodes.length,
      cloneExiste: !!structureNode(res.id),
      // aucune référence orpheline ne doit subsister
      orphelines: app.tasks.filter((t) => t.reworkOfTaskId && !app.tasks.some((x) => x.id === t.reworkOfTaskId)).length,
    };
    redo();
    const clones = app.tasks.filter((t) => !ids0.has(t.id));
    const ids = new Set(clones.map((t) => t.id));
    const A2 = clones.find((t) => t.name === 'Pose fenêtres');
    const B2 = clones.find((t) => t.name === 'Reprise — Pose fenêtres');
    return {
      transactions, entrees: app.history.length - histAvant,
      undoComplet: etatUndo.empreinte === depart && !etatUndo.cloneExiste && etatUndo.orphelines === 0,
      etatUndo,
      redoComplet: empreinte() === apres && !!structureNode(res.id),
      redoRework: B2 && A2 ? B2.reworkOfTaskId === A2.id : false,
      redoAucunPointeurSource: clones.every((t) => !t.reworkOfTaskId || ids.has(t.reworkOfTaskId)),
    };
  });
  note('REW-DUP-09', r);
  ok(r.transactions === 1 && r.entrees === 1,
    'REW-DUP-09 : la duplication reste UNE seule opération logique, reprises comprises', 'REW-DUP-09');
  ok(r.undoComplet,
    'REW-DUP-09 : Undo supprime tous les niveaux et toutes les tâches clonées, ne laisse AUCUNE référence de reprise orpheline, et l’état revient au caractère près', 'REW-DUP-09');
  ok(r.redoComplet && r.redoRework && r.redoAucunPointeurSource,
    'REW-DUP-10 : Redo recrée l’ensemble — la relation de reprise repointe vers la tâche CLONÉE, jamais vers la source', 'REW-DUP-10');
  await ctx.close();
}

// ============================================================
// REW-DUP-11 — Sauvegarde / restauration
// ============================================================
console.log('\n[REW-DUP] Sauvegarde et restauration');
{
  const { ctx, p } = await newPage({ tag: 'BACKUP' });
  await decor(p);
  const r = await ev(p, () => {
    const ids0 = new Set(app.tasks.map((t) => t.id));
    duplicateStructureNode('sn-z', { withTasks: true });
    const clones = app.tasks.filter((t) => !ids0.has(t.id));
    const A2 = clones.find((t) => t.name === 'Pose fenêtres').id;
    const B2 = clones.find((t) => t.name === 'Reprise — Pose fenêtres').id;
    const attendu = app.tasks.map((t) => `${t.id}:${t.reworkOfTaskId}:${(t.deps || []).join('+')}`).sort();
    const backup = buildKanvixBackup();
    // On repart d'un état vierge, puis on relit la sauvegarde par le chemin
    // normal : validation + migration, exactement comme une restauration.
    resetApp();
    const brut = backup.state || backup.app || backup;
    const valide = typeof validateKanvixBackup === 'function' ? !!validateKanvixBackup(backup) : null;
    const state = migrateState(structuredClone(brut));
    const rB2 = (state.tasks || []).find((t) => t.id === B2);
    return {
      valide, A2, B2,
      restaure: (state.tasks || []).map((t) => `${t.id}:${t.reworkOfTaskId}:${(t.deps || []).join('+')}`).sort(),
      attendu,
      reworkRestaure: rB2 ? rB2.reworkOfTaskId : null,
      pointeVersClone: rB2 ? rB2.reworkOfTaskId === A2 : false,
      pointeVersSource: rB2 ? rB2.reworkOfTaskId === 't-A' : null,
      schema: SCHEMA_VERSION, store: STORE,
    };
  });
  note('REW-DUP-11', { valide: r.valide, reworkRestaure: r.reworkRestaure, A2: r.A2, schema: r.schema, store: r.store });
  ok(JSON.stringify(r.attendu) === JSON.stringify(r.restaure),
    'REW-DUP-11 : la sauvegarde restitue toutes les relations — reprises et dépendances — à l’identique', 'REW-DUP-11');
  ok(r.pointeVersClone && r.pointeVersSource === false,
    'REW-DUP-11 : après restauration, B2.reworkOfTaskId désigne toujours A2 — jamais la tâche source', 'REW-DUP-11');
  /* V2.11.0 — RE-POINTAGE. Le correctif de V2.10.0.1 n'exigeait aucun champ
     persistant, et c'est toujours vrai : le passage à 14 vient des MODÈLES de
     V2.11.0, pas de la reprise. L'assertion épingle donc la version courante et
     la clé de stockage, inchangée depuis toujours. */
  /* V2.12.0 — RE-POINTAGE. Le schéma avance à 15 : « Conditions de démarrage » introduit app.prerequisites, migration 14 → 15 (§28). Ce que cette assertion protège réellement — la CLÉ DE STOCKAGE, qui n'a jamais bougé — est inchangé. */
  ok(r.schema === 15 && r.store === 'kanvix-product-8-3',
    'REW-DUP-11 : l’intégrité des reprises n’exige toujours aucun champ persistant à elle ; le schéma vaut 15 (bumps des modèles de V2.11.0 puis des conditions de V2.12.0) et STORE reste « kanvix-product-8-3 »', 'REW-DUP-11');
  await ctx.close();
}

// ============================================================
// REW-DUP-12 — hasReworkSignaled() lit correctement le clone
// ============================================================
console.log('\n[REW-DUP] hasReworkSignaled sur le clone et sur la source');
{
  const { ctx, p } = await newPage({ tag: 'SIGNAL' });
  await decor(p);
  const r = await ev(p, () => {
    // Sur V2.10.0, la source répondait « oui » à cause de DEUX tâches après
    // duplication : la vraie reprise et le clone. On mesure donc aussi QUI
    // répond, pas seulement la valeur.
    const ids0 = new Set(app.tasks.map((t) => t.id));
    const avantSource = hasReworkSignaled('t-A');
    duplicateStructureNode('sn-z', { withTasks: true });
    const clones = app.tasks.filter((t) => !ids0.has(t.id));
    const A2 = clones.find((t) => t.name === 'Pose fenêtres').id;
    const B2 = clones.find((t) => t.name === 'Reprise — Pose fenêtres').id;
    const C2 = clones.find((t) => t.name === 'Cloisons').id;
    return {
      avantSource,
      surClone: hasReworkSignaled(A2),
      porteursSurClone: app.tasks.filter((t) => t.reworkOfTaskId === A2).map((t) => t.id),
      surSource: hasReworkSignaled('t-A'),
      porteursSurSource: app.tasks.filter((t) => t.reworkOfTaskId === 't-A').map((t) => t.id),
      surC2: hasReworkSignaled(C2),
      A2, B2,
    };
  });
  note('REW-DUP-12', r);
  ok(r.surClone === true && r.porteursSurClone.length === 1 && r.porteursSurClone[0] === r.B2,
    'REW-DUP-12 : hasReworkSignaled(A2) vaut true, et cette réponse vient de B2 — la reprise CLONÉE, une seule', 'REW-DUP-12');
  ok(r.surSource === true && r.porteursSurSource.length === 1 && r.porteursSurSource[0] === 't-B',
    'REW-DUP-12 : sur la SOURCE, la réponse ne vient toujours que de t-B — le clone ne pollue plus l’état de la tâche d’origine, ce qui était le cas en V2.10.0', 'REW-DUP-12');
  ok(r.surC2 === true,
    'REW-DUP-12 : le second couple se lit lui aussi correctement sur le clone', 'REW-DUP-12');
  await ctx.close();
}

// ============================================================
// FREEZE-21001 — Périmètre du patch
// ============================================================
console.log('\n[FREEZE-21001] Périmètre : une seule fonction modifiée');
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

  /* §11 — le balayage de TOUT le fichier. Ce gel compare le build courant à
     V2.10.0. V2.10.0.1 n'y touchait qu'à duplicateStructureNode ; V2.11.0 y
     ajoute son propre périmètre, NOMMÉ fonction par fonction — l'assertion
     reste un gel, elle n'est pas devenue une liste ouverte. */
  const attendues = ['duplicateStructureNode',
    // V2.11.0 — modèles de chantier
    'migrateState', 'icon', 'structureNodeMenu', 'projectStructureTab',
    'renderMore', 'renderWizard', 'wizardPickMode', 'showKanvixBackupPreview'];
  const parIndentation = ['renderAIPanel'];
  /* V2.11.0.3 — les fonctions touchées par les rounds SUIVANTS sont tolérées
     par le BALAYAGE (sinon ce gel signalerait comme dérive ce qu'un correctif
     ultérieur corrige volontairement), mais la liste reste FERMÉE : une
     fonction non nommée ferait toujours tomber le test, et le gel propre à
     chaque round vérifie son périmètre de façon indépendante. */
  const attenduesRoundsSuivants = ['openStructureForm'];
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
  const horsPerimetre = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !tolerees.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  note('FREEZE-21001-périmètre', { modifiées: attendues, horsPérimètre: horsPerimetre, indentation: indentDiff });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-21001 : hors du périmètre NOMMÉ de V2.10.0.1 (duplicateStructureNode) et de V2.11.0 (migrateState, icon, structureNodeMenu, projectStructureTab, renderMore, renderWizard, wizardPickMode, showKanvixBackupPreview), le balayage complet du fichier ne trouve AUCUNE autre fonction modifiée depuis V2.10.0', 'FREEZE-21001');

  /* §11 — les moteurs nommément protégés, un par un. */
  const nommes = [
    // Structure — tout sauf la duplication
    'moveStructureNode', 'structureMoveBlocker', 'openStructureMove', 'openStructureDuplicate',
    /* V2.11.0 — structureNodeMenu reçoit l'entrée « Enregistrer comme modèle » :
       elle quitte la liste des gelés et rejoint le périmètre NOMMÉ ci-dessus. */
    'structureCompactRow', 'structureCopyName', 'structureUid',
    'structureDestinationList', 'structureSourceCard', 'structureRememberTrigger',
    'structureNode', 'getStructureDescendantIds', 'getStructureTasks', 'getStructureChildren',
    'structureParentError', 'structureParentOptions',
    /* V2.11.0.3 — openStructureForm() ne PORTE plus la règle « responsable de
       niveau = personne active » : elle la LIT dans
       structureResponsibleResources(), que la pose d'un modèle lit elle aussi.
       Une seule ligne change, et elle RETIRE du code plutôt qu'elle n'en
       ajoute. Elle quitte donc les gelés et rejoint le périmètre NOMMÉ. */
    // Reprise / SAV — §5, formellement interdits
    'hasReworkSignaled', 'createRework', 'openTask', 'setTaskStatus',
    // Planning
    'gantt', 'planningTasks', 'dropTask', 'dragStart', 'dragOver', 'drawDeps',
    'requestGanttTaskMove', 'requestTaskScheduleMove', 'planningCreatePointerDown',
    'planningCreatePointerMove', 'planningCreatePointerUp', 'planningCanDrawCreate',
    'openTaskForm', 'submitTaskEdit', 'planReflow', 'applyReflowPlan', 'renderPlanning',
    'isNonWorkingDate', 'frenchPublicHolidays', 'realStartPlan',
    // Données et transverse
    /* V2.11.0 — migrateState porte la migration 13 → 14 : même traitement. */
    'buildKanvixBackup', 'confirmKanvixRestore', 'applyImportPlan',
    'validateImportState', 'exportKanvixData', 'save', 'resetApp',
    'taskResourceIds', 'getResourceTasks', 'getResourceSchedulingConflicts',
    'ensureTaskControlInstances', 'pendingControlsForTask', 'getProjectHealth',
    'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState',
    'actionToast', 'drawerForm', 'closeOverlay', 'toggleDrawerMenu', 'closeDrawerMenu',
    'projectTab', 'renderProject', 'selectProject', 'renderField',
  ];
  /* V2.12.0 — RE-BASELINE, une seule cause NOMMÉE : « Conditions de démarrage »
     étend ces moteurs centraux plutôt que de les dupliquer — la règle même que
     ce gel protège. Déclarées, donc assumées, et vérifiées une à une par
     FREEZE-2120 dans recette-conditions-demarrage-v2.12.0.mjs. */
  const rebaseV2120 = ['openTask', 'setTaskStatus', 'gantt', 'applyImportPlan', 'exportKanvixData'];
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
  nommes.forEach((n) => {
    if (rebaseV2120.includes(n) || rebaseV21201.includes(n)) return;
    if (rebaseV21202.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(n);
  });
  note('FREEZE-21001-moteurs', { comparées: compares, bougés: bouges, reBaséesV2120: rebaseV2120, reBaséesV21201: rebaseV21201 });
  ok(bouges.length === 0,
    `FREEZE-21001 : les ${compares} moteurs nommément protégés sont BYTE-IDENTIQUES — toute la Structure hors duplication, le moteur Reprise/SAV, le Planning, les données, les ressources, la qualité, l’Undo/Redo et la navigation`, 'FREEZE-21001');

  /* §13 — aucun changement visuel : le CSS et le balisage sont identiques. */
  /* La balise porte un id (`<style id="kanvix-css">`) : un motif `<style>` nu
     ne matche RIEN et comparerait deux chaînes vides — une assertion qui passe
     toujours. On extrait donc réellement la feuille, et on refuse une
     extraction vide. */
  const css = (src) => {
    const m = src.match(/<style[^>]*>[\s\S]*?<\/style>/);
    return m ? m[0] : null;
  };
  const bloc = (src, re) => { const m = src.match(re); return m ? m[0] : null; };
  const cssA = css(A), cssB = css(B);
  /* V2.11.0 — RE-POINTAGE, PREUVE PLUTÔT QUE SILENCE. V2.10.0.1 n'ajoutait
     rien au style ni aux données : « byte-identique » suffisait. V2.11.0 ajoute
     un bloc de style et une collection de démonstration. On ne relâche pas
     l'assertion : on la rend DÉMONSTRATIVE — le bloc ajouté retiré, la feuille
     et INITIAL_STATE redeviennent byte-identiques à V2.10.0. Un seul octet
     modifié ailleurs ferait tomber la mesure. */
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
  const sansBlocCSS = (x) => sansV2120CSS(x).replace(/      \/\* ---- V2\.11\.0 — MODÈLES DE CHANTIER[\s\S]*?\n      \/\* Le niveau qui vient d'être créé/, "      /* Le niveau qui vient d'être créé");
  const sansBlocInitial = (y) => {
    const x = sansV2120Initial(y);
    const i = x.indexOf('        /* ============ V2.11.0 — MODÈLES DE CHANTIER RÉUTILISABLES ==========');
    const j = x.indexOf('        ],\n        // V2.8 — UNE opération de démonstration.');
    return i > 0 && j > i ? x.slice(0, i) + x.slice(j + '        ],\n'.length) : 'NON-EXTRAIT';
  };
  const regles = {
    cssExtraite: !!cssA && !!cssB && cssA.length > 100000,
    cssAdditive: !!cssA && !!cssB && md5(sansBlocCSS(cssB)) === md5(cssA) && cssB.length > cssA.length,
    // V2.12.0 — le schéma avance à 15 (app.prerequisites, §28).
    schema: /SCHEMA_VERSION = 15/.test(B) && /SCHEMA_VERSION = 13/.test(A),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    /* Même précaution que pour le CSS : une extraction qui échoue comparerait
       deux chaînes vides et passerait toujours. On exige donc qu'elle ait
       réellement trouvé quelque chose de substantiel. */
    initialExtrait: (bloc(B, /const INITIAL_STATE[\s\S]*?\n      \};/) || '').length > 10000,
    initialAdditif:
      sansBlocInitial(bloc(B, /const INITIAL_STATE[\s\S]*?\n      \};/) || '') ===
      bloc(A, /const INITIAL_STATE[\s\S]*?\n      \};/),
    /* L'ANCRAGE est corrigé, pas assoupli : « le premier tasks: [ du fichier »
       n'est plus le tableau de démonstration (les modèles de démonstration en
       portent un, plus haut). On ancre sur structureNodes, qui le précède. */
    tachesDemoExtraites: (bloc(B, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/) || '').length > 4000,
    tachesDemoIdentiques:
      md5(bloc(A, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/)) ===
      md5(bloc(B, /\n        structureNodes: \[[\s\S]*?\n        \],\n        tasks: \[[\s\S]*?\n        \],\n/)),
    // V2.11.0 — la table n'a pas été dupliquée : elle a DÉMÉNAGÉ dans la
    // primitive partagée. Il n'en existe toujours qu'une dans tout le fichier.
    uneSeuleMapTaches: (B.match(/mapTaches = new Map/g) || []).length === 1,
    pasDePileUndoParallele: !/reworkUndo|structureUndoStack|cloneHistory2/.test(B),
  };
  note('FREEZE-21001-règles', { ...regles, octetsCSS: cssA ? cssA.length : 0 });
  ok(Object.values(regles).every(Boolean),
    'FREEZE-21001 : la feuille de style est strictement ADDITIVE (le bloc V2.11.0 retiré, elle redevient byte-identique à V2.10.0), INITIAL_STATE l’est aussi, les tâches de démonstration sont BYTE-IDENTIQUES, SCHEMA passe à 14, STORE et build sont inchangés, il n’existe toujours qu’UNE table mapTaches dans tout le fichier, et aucune pile Undo parallèle', 'FREEZE-21001');

  /* V2.11.0 — RE-POINTAGE, et RENFORCEMENT.
     En V2.10.0.1, duplicateStructureNode() PORTAIT le moteur de clonage : on
     prouvait le correctif en lui retirant son seul bloc « reprise », après quoi
     elle redevenait byte-identique à V2.10.0.
     En V2.11.0 le moteur a été SORTI dans la primitive partagée
     cloneStructureTree() (§34) et la fonction délègue. Le correctif n'a pas
     disparu : il a DÉMÉNAGÉ — et il sert désormais aussi aux modèles, ce qui
     rend impossible une divergence entre les deux usages.
     La preuve devient donc plus forte que l'ancienne :
       · duplicateStructureNode() n'en porte plus une ligne et délègue ;
       · le remapping de la reprise n'existe qu'à UN endroit du fichier ;
       · cet endroit est la primitive, et elle seule ;
       · ce bloc retiré de la primitive, il ne subsiste AUCUNE mention de
         reprise dans le reste de son corps (commentaires exclus).
     Les douze scénarios REW-DUP ci-dessus, eux, sont inchangés : ils mesurent
     le COMPORTEMENT, et ils passent tous sur le moteur factorisé. */
  const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const sansRework = (src) => sansCommentaires(src)
    .replace(/\n\s*reworkClonees = 0,/g, '')
    .replace(/\n\s*reworkAbandonnees = 0,/g, '')
    .replace(/let reprise = [\s\S]*?\n          \}\n/g, '')
    .replace(/\n\s*reworkOfTaskId: repriseInterne,/g, '')
    .replace(/\n\s*reworkClonees,/g, '')
    .replace(/\n\s*reworkAbandonnees,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const dup = extractFn(B, 'duplicateStructureNode'), prim = extractFn(B, 'cloneStructureTree');
  const preuve = {
    dupDelegue: /cloneStructureTree\(/.test(dup),
    dupSansReprise: !/reworkOfTaskId|repriseInterne/.test(sansCommentaires(dup)),
    dupSansTable: !/new Map\(/.test(dup),
    remapUniqueDansLeFichier: (B.match(/reworkOfTaskId: repriseInterne/g) || []).length === 1
      && (B.match(/let reprise = /g) || []).length === 1,
    remapDansLaPrimitive: /reworkOfTaskId: repriseInterne/.test(prim || ''),
    residuSansReprise: !/rework|reprise/i.test(sansRework(prim || 'x')),
  };
  note('FREEZE-21001-diff', preuve);
  ok(Object.values(preuve).every(Boolean),
    'FREEZE-21001 : le remapping de la reprise n’existe qu’à UN endroit de tout le fichier — la primitive de clonage partagée cloneStructureTree(). duplicateStructureNode() n’en porte plus une ligne, ne construit plus aucune table de correspondance et délègue ; ce bloc retiré de la primitive, il ne subsiste aucune mention de reprise dans son corps. Une seconde logique de reprise, où que ce soit, ferait tomber cette assertion', 'FREEZE-21001');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `REW-DUP : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'REW-DUP');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
