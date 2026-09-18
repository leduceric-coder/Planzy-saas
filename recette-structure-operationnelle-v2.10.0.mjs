// ============================================================
// KANVIX — Recette « Structure opérationnelle » (V2.10.0)
//
//   Deux gestes seulement, mais qui touchent au cœur des données :
//     · DÉPLACER un niveau — sa descendance suit, ses interventions restent.
//     · DUPLIQUER un niveau — tout est recréé, et RIEN ne doit pointer vers
//       l'arbre source : ni un parentId, ni un structureNodeId, ni une
//       dépendance entre interventions.
//
//   C'est ce dernier point qui fait la valeur de cette recette : un clone qui
//   garde un seul pointeur vers l'original corrompt silencieusement le
//   chantier. On le vérifie donc pointeur par pointeur.
//
//   Usage : node recette-structure-operationnelle-v2.10.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.10.0.html';
const PREV = 'kanvix-next-gen-v2.9.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.10.0/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, level = 'pilot', dark = false } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate(([lvl, dk]) => {
    resetApp();
    if (lvl === 'pilot') setDepth('pilot');
    if (dk) setAppearance('dark');
    dismissKanvixContinuityNotice();
  }, [level, dark]);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, opts = {}) => { await p.waitForTimeout(280); await p.screenshot({ path: SHOTS + name, ...opts }); };
const ouvrirStructure = async (p, pid = 'keravel') => {
  await ev(p, (id) => { app.ui.projectId = id; save(); go('project'); openProjectTab(id, 'Structure'); }, pid);
  await p.waitForTimeout(320);
};

/* §37 — l'arbre de robustesse, créé PAR LE TEST et jamais par INITIAL_STATE :
   Bâtiment Alpha › Niveau 1 › Niveau 2 › Niveau 3 › Niveau 4, avec une chaîne
   de dépendances A → B → C interne au périmètre et une dépendance EXTERNE. */
const arbreProfond = async (p) => {
  await ev(p, () => {
    let parent = null;
    ['Bâtiment Alpha', 'Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4'].forEach((nom, i) => {
      app.structureNodes.push({
        id: 'sn-a' + i, projectId: 'keravel', parentId: parent, name: nom,
        type: i === 0 ? 'building' : i === 4 ? 'phase' : 'zone', description: '',
        responsibleResourceId: i === 1 ? 'mathieu' : null, archived: false,
        createdAt: '2026-08-01T08:00', updatedAt: '2026-08-01T08:00',
      });
      parent = 'sn-a' + i;
    });
    const mk = (id, nom, sn, deps, res) => ({
      id, structureNodeId: sn, lotId: 'lot-platrerie', phase: 'Second œuvre',
      projectId: 'keravel', name: nom, resourceId: res,
      additionalResourceIds: ['grue-01'], start: '2026-08-20T08:00',
      end: '2026-08-20T12:00', status: 'todo', deps, colorKey: 'violet',
      baselineStart: '2026-08-20T08:00', baselineEnd: '2026-08-20T12:00',
    });
    app.tasks.push(mk('t-ext', 'Externe', 'sn-keravel-rdc', [], 'eric'));
    app.tasks.push(mk('t-A', 'A', 'sn-a1', ['t-ext'], 'mathieu'));
    app.tasks.push(mk('t-B', 'B', 'sn-a2', ['t-A'], 'legall'));
    app.tasks.push(mk('t-C', 'C', 'sn-a3', ['t-B'], 'mathieu'));
    save();
    openProjectTab('keravel', 'Structure');
  });
  await p.waitForTimeout(300);
};
/* 18 zones sœurs — §37 : les menus et les side-windows doivent rester
   utilisables quand la liste des destinations devient longue. */
const beaucoupDeFreres = async (p, n = 18) => {
  await ev(p, (k) => {
    for (let i = 0; i < k; i++)
      app.structureNodes.push({
        id: 'sn-f' + i, projectId: 'keravel', parentId: null, name: 'Zone frère ' + (i + 1),
        type: 'zone', description: '', responsibleResourceId: null, archived: false,
        createdAt: '', updatedAt: '',
      });
    save(); openProjectTab('keravel', 'Structure');
  }, n);
  await p.waitForTimeout(300);
};
const etat = (p) => ev(p, () => ({
  page: app.ui.page,
  onglet: document.querySelector('.tab.active')?.textContent.trim(),
  projet: app.ui.projectId,
}));

// ============================================================
// STR-OP-01 → STR-OP-07 — Déplacer
// ============================================================
console.log('\n[STR-OP] Déplacer un niveau');
{
  const { ctx, p } = await newPage({ tag: 'MOVE' });
  await ouvrirStructure(p);
  await arbreProfond(p);

  // Le menu porte bien les deux nouvelles entrées, dans l'ordre demandé.
  const menu = await ev(p, () => {
    const c = document.querySelector('[data-structure-node="sn-keravel-bat-a"]');
    c.querySelector('.more-trigger').click();
    const items = [...c.querySelectorAll('.more-pop button')].map((x) => x.textContent.trim());
    closeDrawerMenu();
    return items;
  });
  note('STR-OP-01-menu', menu);
  ok(menu.join('|') === 'Modifier|Ajouter un sous-niveau|Déplacer|Dupliquer|Archiver|Supprimer',
    'STR-OP-01 : le menu « … » porte Déplacer et Dupliquer, dans l’ordre demandé, sans rien retirer', 'STR-OP-01');

  // STR-OP-01 — un niveau RACINE vers un parent
  const r1 = await ev(p, () => {
    const avant = structureNode('sn-keravel-ext').parentId;
    const r = moveStructureNode('sn-keravel-ext', 'sn-keravel-bat-a');
    return { avant, r, apres: structureNode('sn-keravel-ext').parentId,
      racines: getStructureRoots('keravel').map((n) => n.name) };
  });
  note('STR-OP-01', r1);
  ok(r1.avant === null && r1.r === true && r1.apres === 'sn-keravel-bat-a' && !r1.racines.includes('Extérieurs'),
    'STR-OP-01 : un niveau racine devient bien l’enfant du parent choisi', 'STR-OP-01');

  // STR-OP-02 — un SOUS-niveau vers un autre parent, avec sa descendance
  const r2 = await ev(p, () => {
    const descAvant = getStructureDescendantIds('sn-a2');
    const tachesAvant = getStructureTasks('sn-a2').map((t) => t.id).sort();
    const r = moveStructureNode('sn-a2', 'sn-keravel-bat-a');
    return {
      r, parent: structureNode('sn-a2').parentId,
      descAvant, descApres: getStructureDescendantIds('sn-a2'),
      n3parent: structureNode('sn-a3').parentId,
      n4parent: structureNode('sn-a4').parentId,
      tachesAvant, tachesApres: getStructureTasks('sn-a2').map((t) => t.id).sort(),
      resApres: getStructureResources('sn-a2'),
      idInchange: !!structureNode('sn-a2'),
      nom: structureNode('sn-a2').name, type: structureNode('sn-a2').type,
    };
  });
  note('STR-OP-02', r2);
  ok(r2.r === true && r2.parent === 'sn-keravel-bat-a' && r2.idInchange && r2.nom === 'Niveau 2' && r2.type === 'zone',
    'STR-OP-02 : un sous-niveau se déplace sous un autre parent en conservant son ID, son nom et son type', 'STR-OP-02');
  ok(JSON.stringify(r2.descAvant) === JSON.stringify(r2.descApres) &&
     r2.n3parent === 'sn-a2' && r2.n4parent === 'sn-a3',
    'STR-OP-04 : toute la descendance suit — Niveau 3 reste enfant de Niveau 2, Niveau 4 de Niveau 3', 'STR-OP-04');
  ok(JSON.stringify(r2.tachesAvant) === JSON.stringify(r2.tachesApres),
    'STR-OP-05 : les interventions du périmètre sont exactement les mêmes avant et après', 'STR-OP-05');
  ok(r2.resApres.length > 0,
    `STR-OP-06 : les ressources restent agrégées sur le niveau déplacé (${r2.resApres.length})`, 'STR-OP-06');

  // STR-OP-03 — vers la RACINE
  const r3 = await ev(p, () => {
    const r = moveStructureNode('sn-a2', null);
    return { r, parent: structureNode('sn-a2').parentId,
      racines: getStructureRoots('keravel').map((n) => n.name),
      fauxParent: app.structureNodes.filter((n) => /racine|root|technique/i.test(n.name)).length };
  });
  note('STR-OP-03', r3);
  ok(r3.r === true && r3.parent === null && r3.racines.includes('Niveau 2') && r3.fauxParent === 0,
    'STR-OP-03 : un sous-niveau devient un niveau racine — aucun faux parent technique n’est créé', 'STR-OP-03');

  // STR-OP-07 — agrégats recalculés sans rechargement
  const r7 = await ev(p, () => {
    const avant = {
      batA: getStructureProgress('sn-keravel-bat-a')?.total || 0,
      alpha: getStructureProgress('sn-a0')?.total || 0,
    };
    moveStructureNode('sn-a1', 'sn-keravel-bat-a');
    openProjectTab('keravel', 'Structure');
    const ligne = document.querySelector('[data-structure-node="sn-keravel-bat-a"]');
    const cells = ligne.querySelectorAll(':scope > .snc-cell');
    const prog = getStructureProgress('sn-keravel-bat-a');
    return {
      avant,
      apresMoteur: prog ? `${prog.total} intervention${prog.total > 1 ? 's' : ''}` : '—',
      apresVue: cells[0]?.textContent.trim(),
      alphaApres: getStructureProgress('sn-a0')?.total || 0,
    };
  });
  note('STR-OP-07', r7);
  ok(r7.apresVue === r7.apresMoteur && r7.avant.batA !== (getStructureProgressTotal => 0)(),
    `STR-OP-07 : les agrégats sont recalculés immédiatement et la vue affiche exactement la valeur du moteur (${r7.apresVue})`, 'STR-OP-07');
  ok(r7.alphaApres < r7.avant.alpha,
    `STR-OP-07 : le niveau d’origine perd bien les interventions parties avec la branche (${r7.avant.alpha} → ${r7.alphaApres})`, 'STR-OP-07');
  await ctx.close();
}

// ============================================================
// STR-OP-08 → STR-OP-10 — Les interdits
// ============================================================
console.log('\n[STR-OP] Cycles et destinations interdites');
{
  const { ctx, p } = await newPage({ tag: 'CYCLE' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const avant = structureNode('sn-a1').parentId;
    return {
      soiMeme: structureMoveBlocker('sn-a1', 'sn-a1'),
      soiMemeMutation: moveStructureNode('sn-a1', 'sn-a1'),
      descendantProche: structureMoveBlocker('sn-a1', 'sn-a2'),
      descendantLointain: structureMoveBlocker('sn-a1', 'sn-a4'),
      descendantMutation: moveStructureNode('sn-a1', 'sn-a4'),
      parentInchange: structureNode('sn-a1').parentId === avant,
      // et les destinations interdites n'apparaissent même pas dans la liste
      destinations: structureParentOptions('keravel', 'sn-a1').map((o) => o.path),
    };
  });
  note('STR-OP-08', r);
  ok(typeof r.soiMeme === 'string' && typeof r.soiMemeMutation === 'string' && r.parentInchange,
    'STR-OP-08 : un niveau ne peut pas être déplacé dans lui-même — la garde est MÉTIER : l’appel direct à moveStructureNode() est refusé sans rien muter', 'STR-OP-08');
  ok(typeof r.descendantProche === 'string' && typeof r.descendantLointain === 'string' &&
     typeof r.descendantMutation === 'string',
    'STR-OP-09 : ni dans un enfant, ni dans un descendant lointain (Niveau 4, trois crans plus bas)', 'STR-OP-09');
  ok(!r.destinations.some((d) => /Niveau [1234]/.test(d)),
    'STR-OP-09 : ces destinations sont en outre ABSENTES de la liste proposée', 'STR-OP-09');

  const arch = await ev(p, () => {
    structureNode('sn-a4').archived = true;
    save();
    return {
      dansListe: structureParentOptions('keravel', 'sn-keravel-rdc').filter((o) => /Niveau 4/.test(o.path)).length,
      dupVersArchive: duplicateStructureNode('sn-keravel-rdc', { parentId: 'sn-a4' }),
      resteArchive: structureNode('sn-a4').archived,
    };
  });
  note('STR-OP-10', arch);
  ok(arch.dansListe === 0 && typeof arch.dupVersArchive === 'string' && arch.resteArchive === true,
    'STR-OP-10 : un niveau archivé n’est proposé comme destination ni au déplacement ni à la duplication, et n’est jamais réactivé en silence', 'STR-OP-10');
  await ctx.close();
}

// ============================================================
// STR-OP-11 → STR-OP-14 — Undo/Redo, navigation, fil d'Ariane
// ============================================================
console.log('\n[STR-OP] Undo / Redo, navigation, fil d’Ariane');
{
  const { ctx, p } = await newPage({ tag: 'UNDO' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const empreinte = () => JSON.stringify(app.structureNodes.map((n) => `${n.id}:${n.parentId}`));
    const avant = empreinte(), undoAvant = undoHistory.length, histAvant = app.history.length;
    moveStructureNode('sn-a2', 'sn-keravel-bat-a');
    const apres = empreinte();
    const transactions = undoHistory.length - undoAvant;
    undo();
    const apresUndo = empreinte();
    redo();
    return {
      transactions, entreesHistorique: app.history.length - histAvant,
      undoRestaure: apresUndo === avant,
      redoRestaure: empreinte() === apres,
      n3parent: structureNode('sn-a3').parentId,
      n4parent: structureNode('sn-a4').parentId,
    };
  });
  note('STR-OP-11', r);
  ok(r.transactions === 1 && r.entreesHistorique === 1,
    'STR-OP-11 : un déplacement est UNE opération logique — une transaction d’annulation, une entrée d’historique', 'STR-OP-11');
  ok(r.undoRestaure,
    'STR-OP-11 : Undo replace le niveau exactement où il était, avec toute sa descendance', 'STR-OP-11');
  ok(r.redoRestaure && r.n3parent === 'sn-a2' && r.n4parent === 'sn-a3',
    'STR-OP-12 : Redo le remet à sa nouvelle place, descendance comprise', 'STR-OP-12');

  // STR-OP-13 — aucune navigation parasite, par un VRAI parcours d'interface
  await ouvrirStructure(p);
  await p.click('[data-structure-node="sn-a2"] .more-trigger');
  await p.waitForTimeout(160);
  await p.click('[data-structure-node="sn-a2"] .more-pop button:nth-child(3)');
  await p.waitForTimeout(350);
  const ouverte = await ev(p, () => ({
    titre: document.querySelector('#drawerContent .muted')?.textContent,
    drawer: $('#drawer').classList.contains('open'),
    destinations: document.querySelectorAll('.snc-dest-opt').length,
  }));
  await ev(p, () => {
    [...document.querySelectorAll('[name=destination]')].find((x) => x.value === '').checked = true;
    document.querySelector('#drawerFormEl').requestSubmit();
  });
  await p.waitForTimeout(400);
  const apres13 = await etat(p);
  const toast = await ev(p, () => document.querySelector('#toast')?.textContent);
  note('STR-OP-13', { ouverte, apres13, toast });
  ok(ouverte.drawer && ouverte.titre === 'DÉPLACER LE NIVEAU' && ouverte.destinations > 1,
    'STR-OP-13 : « Déplacer » ouvre une side-window titrée, avec sa liste de destinations', 'STR-OP-13');
  ok(apres13.page === 'project' && apres13.onglet === 'Structure' && apres13.projet === 'keravel',
    'STR-OP-13 : après validation l’utilisateur reste dans l’onglet Structure — aucun retour vers Aujourd’hui', 'STR-OP-13');
  ok(/Niveau déplacé/.test(toast) && /Annuler/.test(toast),
    `STR-OP-13 : le toast annonce « ${toast?.trim()} » et propose l’annulation, via le moteur Undo existant`, 'STR-OP-13');

  // STR-OP-14 — fil d'Ariane depuis la FICHE du niveau déplacé
  await ev(p, () => openStructureNode('sn-a3'));
  await p.waitForTimeout(320);
  const filAvant = await ev(p, () => [...document.querySelectorAll('.sn-breadcrumb button, .sn-breadcrumb b')].map((x) => x.textContent.trim()));
  /* Par le VRAI parcours : le menu « … » de la fiche, puis la side-window.
     C'est ce chemin qui re-rend la fiche — appeler le moteur seul ne met
     évidemment rien à jour, et ne prouverait rien sur l'écran. */
  await ev(p, () => openStructureMove('sn-a3'));
  await p.waitForTimeout(350);
  await ev(p, () => {
    [...document.querySelectorAll('[name=destination]')].find((x) => x.value === 'sn-keravel-bat-a').checked = true;
    document.querySelector('#drawerFormEl').requestSubmit();
  });
  await p.waitForTimeout(400);
  const filApres = await ev(p, () => ({
    fil: [...document.querySelectorAll('.sn-breadcrumb button, .sn-breadcrumb b')].map((x) => x.textContent.trim()),
    page: app.ui.page,
    noeud: app.ui.structureNodeId,
  }));
  note('STR-OP-14', { filAvant, filApres });
  ok(filApres.page === 'structure' && filApres.noeud === 'sn-a3' &&
     filApres.fil.includes('Bâtiment A') && !filApres.fil.includes('Niveau 2'),
    `STR-OP-14 : le fil d’Ariane suit le déplacement du niveau ouvert (${filAvant.join(' › ')} → ${filApres.fil.join(' › ')}), sans quitter la fiche`, 'STR-OP-14');
  await ctx.close();
}

// ============================================================
// DUP-01 → DUP-05 — Duplication « Structure seule »
// ============================================================
console.log('\n[DUP] Structure seule');
{
  const { ctx, p } = await newPage({ tag: 'DUPS' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const tachesAvant = app.tasks.length;
    const res = duplicateStructureNode('sn-a1', {});
    // getStructureDescendantIds() inclut DÉJÀ le nœud de départ.
    const cloneIds = getStructureDescendantIds(res.id);
    const clones = cloneIds.map((id) => structureNode(id));
    const sourceIds = new Set(['sn-a1', 'sn-a2', 'sn-a3', 'sn-a4']);
    return {
      res, tachesAvant, tachesApres: app.tasks.length,
      clones: clones.map((n) => ({ id: n.id, nom: n.name, type: n.type, parent: n.parentId, resp: n.responsibleResourceId })),
      // aucun clone ne doit porter un ID de la source…
      aucunIdSource: clones.every((n) => !sourceIds.has(n.id)),
      // …ni pointer, par son parentId, vers un nœud de la source
      aucunParentSource: clones.every((n) => n.id === res.id || !sourceIds.has(n.parentId)),
      idsUniques: new Set(app.structureNodes.map((n) => n.id)).size === app.structureNodes.length,
      sourceIntacte: getStructureDescendantIds('sn-a1').length === 4,
      tachesDuClone: getStructureTasks(res.id).length,
      agregat: getStructureProgress(res.id),
      libelleVue: (() => {
        openProjectTab('keravel', 'Structure');
        const l = document.querySelector(`[data-structure-node="${res.id}"]`);
        return l ? l.querySelector(':scope > .snc-cell')?.textContent.trim() : null;
      })(),
    };
  });
  note('DUP-01', r);
  ok(r.res.niveaux === 4 && r.clones.length === 4,
    `DUP-01 / DUP-02 : le niveau et ses trois sous-niveaux sont copiés (${r.res.niveaux} niveaux)`, 'DUP-01');
  ok(r.aucunIdSource && r.idsUniques,
    'DUP-03 : chaque élément dupliqué reçoit un nouvel ID, et tous les IDs du chantier restent uniques', 'DUP-03');
  ok(r.aucunParentSource &&
     r.clones[1].parent === r.clones[0].id && r.clones[2].parent === r.clones[1].id && r.clones[3].parent === r.clones[2].id,
    'DUP-04 : la hiérarchie est reconstruite entre CLONES — aucun parentId ne pointe vers l’arbre source', 'DUP-04');
  ok(r.tachesApres === r.tachesAvant && r.res.taches === 0 && r.tachesDuClone === 0,
    'DUP-05 : « Structure seule » ne copie AUCUNE intervention', 'DUP-05');
  ok(r.agregat === null && r.libelleVue === '—',
    'DUP-05 / §21 : les agrégats d’un clone vide sont corrects — la ligne affiche « — », sans erreur', 'DUP-05');
  ok(r.sourceIntacte,
    'DUP-01 : la branche source est intacte après la copie', 'DUP-01');
  await shot(p, '03-duplication-structure-seule.png');
  await ctx.close();
}

// ============================================================
// DUP-06 → DUP-13 — Duplication avec interventions
// ============================================================
console.log('\n[DUP] Structure + interventions');
{
  const { ctx, p } = await newPage({ tag: 'DUPT' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const idsAvant = new Set(app.tasks.map((t) => t.id));
    const res = duplicateStructureNode('sn-a1', { withTasks: true });
    const cloneNoeuds = new Set(getStructureDescendantIds(res.id));
    const clones = app.tasks.filter((t) => !idsAvant.has(t.id));
    const cloneIds = new Set(clones.map((t) => t.id));
    const srcTasks = ['t-A', 't-B', 't-C', 't-ext'];
    const src = (nom) => app.tasks.find((t) => t.id === 't-' + nom);
    const cl = (nom) => clones.find((t) => t.name === nom);
    return {
      res,
      clones: clones.map((t) => ({
        nom: t.name, sn: t.structureNodeId, deps: t.deps,
        res: t.resourceId, add: t.additionalResourceIds,
        start: t.start, end: t.end, lot: t.lotId, color: t.colorKey,
        phase: t.phase, statut: t.status, baseline: [t.baselineStart, t.baselineEnd],
      })),
      // §12 — aucun clone ne pointe vers un niveau de la source
      snTousClones: clones.every((t) => cloneNoeuds.has(t.structureNodeId)),
      // §13 — les dépendances internes sont remappées ENTRE clones
      depsInternes: { B: cl('B')?.deps.map((d) => clones.find((c) => c.id === d)?.name),
                      C: cl('C')?.deps.map((d) => clones.find((c) => c.id === d)?.name) },
      aucuneDepVersSource: clones.every((t) => (t.deps || []).every((d) => cloneIds.has(d))),
      depExterneAbandonnee: (cl('A')?.deps || []).length === 0 && (src('A').deps || []).length === 1,
      // identité métier conservée
      memeIntervenant: cl('B')?.resourceId === src('B').resourceId,
      memesRessources: JSON.stringify(cl('B')?.additionalResourceIds) === JSON.stringify(src('B').additionalResourceIds),
      memesDates: cl('B')?.start === src('B').start && cl('B')?.end === src('B').end,
      memeLot: cl('B')?.lotId === src('B').lotId && cl('B')?.colorKey === src('B').colorKey,
      idsUniques: new Set(app.tasks.map((t) => t.id)).size === app.tasks.length,
      sourceIntacte: srcTasks.every((id) => !!app.tasks.find((t) => t.id === id)),
      // agrégats du clone
      progClone: getStructureProgress(res.id),
      resClone: getStructureResources(res.id),
    };
  });
  note('DUP-06', r);
  ok(r.res.taches === 3 && r.clones.length === 3,
    `DUP-06 : les trois interventions du périmètre sont copiées (${r.res.taches})`, 'DUP-06');
  ok(r.snTousClones,
    'DUP-07 : chaque intervention clonée est rattachée au CLONE de son niveau — jamais à l’ancien', 'DUP-07');
  ok(r.memeIntervenant, 'DUP-08 : l’intervenant principal est conservé', 'DUP-08');
  ok(r.memesRessources, 'DUP-09 : les ressources complémentaires sont conservées à l’identique (la Grue reste la Grue)', 'DUP-09');
  ok(r.memesDates, 'DUP-10 : les dates et horaires sont conservés — aucun décalage automatique en V2.10.0', 'DUP-10');
  ok(r.memeLot, 'DUP-11 : lot et couleur sont conservés', 'DUP-11');
  ok(JSON.stringify(r.depsInternes.B) === '["A"]' && JSON.stringify(r.depsInternes.C) === '["B"]',
    'DUP-12 : la chaîne A → B → C est recréée ENTRE LES CLONES : A2 → B2 → C2', 'DUP-12');
  ok(r.aucuneDepVersSource,
    'DUP-13 : aucune dépendance d’un clone ne pointe vers une intervention de la source', 'DUP-13');
  ok(r.depExterneAbandonnee && r.res.depsAbandonnees === 1,
    'DUP-13 : la dépendance vers une intervention HORS périmètre n’est pas recopiée — choix documenté au rapport', 'DUP-13');
  ok(r.idsUniques && r.sourceIntacte,
    'DUP-03 : les identifiants restent uniques et les interventions source sont intactes', 'DUP-03');
  ok(r.progClone?.total === 3 && r.resClone.length > 0,
    `DUP-18 : les agrégats du clone sont immédiatement corrects (${r.progClone?.total} interventions, ${r.resClone.length} ressources)`, 'DUP-18');
  await shot(p, '04-duplication-structure-interventions.png');
  await ctx.close();
}

// ============================================================
// DUP-14 → DUP-17 — Nom, collision, responsable, type
// ============================================================
console.log('\n[DUP] Nom, collision, responsable, type');
{
  const { ctx, p } = await newPage({ tag: 'NOM' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const a = duplicateStructureNode('sn-a1', {});
    const b2 = duplicateStructureNode('sn-a1', {});
    const c = duplicateStructureNode('sn-a1', {});
    const noms = [a, b2, c].map((x) => structureNode(x.id).name);
    const freres = getStructureChildren('sn-a0').map((n) => n.name);
    const src = structureNode('sn-a1');
    const clone = structureNode(a.id);
    const descSrc = getStructureDescendantIds('sn-a1').map((id) => structureNode(id));
    const descCl = getStructureDescendantIds(a.id).map((id) => structureNode(id));
    return {
      noms, freres,
      doublons: freres.length !== new Set(freres).size,
      respConserve: clone.responsibleResourceId === src.responsibleResourceId,
      typeConserve: clone.type === src.type,
      typesDescendants: descSrc.map((n) => n.type).join(',') === descCl.map((n) => n.type).join(','),
      respDescendants: descSrc.map((n) => n.responsibleResourceId).join(',') === descCl.map((n) => n.responsibleResourceId).join(','),
      nomPersonnalise: (() => {
        const d = duplicateStructureNode('sn-a1', { name: 'Étage 7' });
        return structureNode(d.id).name;
      })(),
    };
  });
  note('DUP-14', r);
  ok(r.noms[0] === 'Niveau 1 - copie',
    'DUP-14 : sans saisie, la copie s’appelle « Niveau 1 - copie »', 'DUP-14');
  ok(r.noms[1] === 'Niveau 1 - copie 2' && r.noms[2] === 'Niveau 1 - copie 3' && !r.doublons,
    'DUP-15 : en cas de collision entre frères, le suffixe s’incrémente — « copie 2 », « copie 3 » — sans jamais créer deux frères homonymes', 'DUP-15');
  ok(r.nomPersonnalise === 'Étage 7',
    'DUP-14 : un nom saisi par l’utilisateur est respecté tel quel', 'DUP-14');
  ok(r.respConserve && r.respDescendants,
    'DUP-16 : le responsable du niveau source est conservé sur la copie, et sur chacun de ses descendants', 'DUP-16');
  ok(r.typeConserve && r.typesDescendants,
    'DUP-17 : le type est conservé, du niveau copié jusqu’au dernier descendant', 'DUP-17');
  await ctx.close();
}

// ============================================================
// DUP-19 / DUP-20 / DUP-21 — Undo, Redo, Sans structure
// ============================================================
console.log('\n[DUP] Undo / Redo / Sans structure');
{
  const { ctx, p } = await newPage({ tag: 'DUNDO' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const empreinte = () => JSON.stringify({
      n: app.structureNodes.map((x) => `${x.id}:${x.parentId}:${x.name}`),
      t: app.tasks.map((x) => `${x.id}:${x.structureNodeId}:${(x.deps || []).join('+')}`),
    });
    const sansAvant = getUnstructuredTasks('keravel').map((t) => t.id).sort();
    const depart = empreinte();
    const undoAvant = undoHistory.length, histAvant = app.history.length;
    const res = duplicateStructureNode('sn-a1', { withTasks: true });
    const apres = empreinte();
    const transactions = undoHistory.length - undoAvant;
    const entrees = app.history.length - histAvant;
    undo();
    const apresUndo = { empreinte: empreinte(), noeuds: app.structureNodes.length, taches: app.tasks.length,
      cloneExiste: !!structureNode(res.id) };
    redo();
    return {
      transactions, entrees,
      undoComplet: apresUndo.empreinte === depart && !apresUndo.cloneExiste,
      redoComplet: empreinte() === apres && !!structureNode(res.id),
      sansAvant, sansApres: getUnstructuredTasks('keravel').map((t) => t.id).sort(),
    };
  });
  note('DUP-19', r);
  ok(r.transactions === 1 && r.entrees === 1,
    'DUP-19 : une duplication complète — quatre niveaux, trois interventions, deux dépendances — est UNE seule opération logique', 'DUP-19');
  ok(r.undoComplet,
    'DUP-19 : Undo supprime proprement tout le sous-arbre cloné, toutes les interventions clonées et leurs dépendances — l’état revient au caractère près', 'DUP-19');
  ok(r.redoComplet,
    'DUP-20 : Redo recrée l’ensemble à l’identique', 'DUP-20');
  ok(JSON.stringify(r.sansAvant) === JSON.stringify(r.sansApres),
    'DUP-21 : la section « Sans structure » est intacte — aucune intervention clonée n’y atterrit par erreur', 'DUP-21');
  await ctx.close();
}

// ============================================================
// DUP-22 — Sauvegarde / restauration
// ============================================================
console.log('\n[DUP] Sauvegarde et restauration');
{
  const { ctx, p } = await newPage({ tag: 'BACKUP' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  const r = await ev(p, () => {
    const res = duplicateStructureNode('sn-a1', { withTasks: true });
    moveStructureNode(res.id, null);
    const attendu = {
      noeuds: app.structureNodes.map((n) => `${n.id}:${n.parentId}:${n.name}`).sort(),
      taches: app.tasks.map((t) => `${t.id}:${t.structureNodeId}:${(t.deps || []).join('+')}`).sort(),
      schema: SCHEMA_VERSION, store: STORE,
    };
    const backup = buildKanvixBackup();
    // On repart d'un état vierge, puis on restaure.
    resetApp();
    const avantRestore = app.structureNodes.length;
    const state = migrateState(structuredClone(backup.state || backup.app || backup));
    return { attendu, avantRestore,
      clefs: Object.keys(backup),
      restaure: {
        noeuds: (state.structureNodes || []).map((n) => `${n.id}:${n.parentId}:${n.name}`).sort(),
        taches: (state.tasks || []).map((t) => `${t.id}:${t.structureNodeId}:${(t.deps || []).join('+')}`).sort(),
        schema: state.schemaVersion,
      } };
  });
  note('DUP-22', { clefs: r.clefs, noeudsAttendus: r.attendu.noeuds.length, noeudsRestaures: r.restaure.noeuds.length });
  ok(JSON.stringify(r.attendu.noeuds) === JSON.stringify(r.restaure.noeuds),
    `DUP-22 : la sauvegarde restitue exactement la hiérarchie obtenue (${r.restaure.noeuds.length} niveaux, parents compris)`, 'DUP-22');
  ok(JSON.stringify(r.attendu.taches) === JSON.stringify(r.restaure.taches),
    'DUP-22 : les interventions clonées et leurs rattachements à la NOUVELLE structure sont restitués à l’identique, dépendances comprises', 'DUP-22');
  ok(r.attendu.schema === 13 && r.attendu.store === 'kanvix-product-8-3',
    'DUP-22 : SCHEMA_VERSION reste 13 et STORE inchangé — aucun champ persistant nouveau n’était nécessaire', 'DUP-22');
  await ctx.close();
}

// ============================================================
// DUP-23 → DUP-27 — Sombre, mobile, clavier, menu
// ============================================================
console.log('\n[DUP] Thème sombre, mobile, clavier');
{
  const { ctx, p } = await newPage({ tag: 'DARK', dark: true });
  await ouvrirStructure(p);
  await arbreProfond(p);
  await ev(p, () => openStructureDuplicate('sn-a1'));
  await p.waitForTimeout(350);
  const r = await ev(p, () => {
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const dest = document.querySelector('.snc-dest');
    const pick = document.querySelector('.snc-pick');
    const src = document.querySelector('.snc-src');
    const btn = document.querySelector('.drawer-form-actions .btn.primary');
    return {
      sombre: document.body.classList.contains('dark'),
      fondDest: getComputedStyle(dest).backgroundColor, lumDest: lum(getComputedStyle(dest).backgroundColor),
      fondPick: getComputedStyle(pick).backgroundColor,
      texte: getComputedStyle(document.querySelector('.snc-dest-name')).color,
      lumTexte: lum(getComputedStyle(document.querySelector('.snc-dest-name')).color),
      fondSrc: getComputedStyle(src).backgroundColor, lumSrc: lum(getComputedStyle(src).backgroundColor),
      bouton: getComputedStyle(btn).backgroundColor,
      // aucun blanc pur incohérent en sombre
      blancPur: [dest, pick, src].filter((e) => getComputedStyle(e).backgroundColor === 'rgb(255, 255, 255)').length,
      enDur: (document.querySelector('#drawerContent').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || []).length,
    };
  });
  note('DUP-23', r);
  ok(r.sombre && r.lumDest < 0.5 && r.lumSrc < 0.5 && r.lumTexte > 0.5 && r.blancPur === 0,
    `DUP-23 : en sombre, la side-window de duplication hérite des variables de thème — fonds foncés (${r.fondDest}), texte clair, aucun blanc pur`, 'DUP-23');
  ok(r.enDur === 0,
    'DUP-23 : aucune couleur codée en dur dans la side-window', 'DUP-23');
  await shot(p, '07-duplication-dark.png');
  await ctx.close();
}
for (const [w, num, capture] of [[430, 'DUP-25', '05-mobile-430-deplacer.png'], [390, 'DUP-24', '06-mobile-390-dupliquer.png']]) {
  const { ctx, p } = await newPage({ tag: 'M' + w, w, h: 844 });
  await ouvrirStructure(p);
  await arbreProfond(p);
  await beaucoupDeFreres(p, 18);
  await ev(p, (n) => (n === 430 ? openStructureMove('sn-a2') : openStructureDuplicate('sn-a1')), w);
  await p.waitForTimeout(400);
  const r = await ev(p, () => {
    const form = document.querySelector('#drawerFormEl');
    const champs = [...form.querySelectorAll('input,select,textarea,button')];
    const dest = document.querySelector('.snc-dest');
    const actions = document.querySelector('.drawer-form-actions');
    const bas = document.querySelector('.bottom-nav, .mobile-nav');
    const dr = document.querySelector('#drawer').getBoundingClientRect();
    return {
      over: document.documentElement.scrollWidth - innerWidth,
      champsCoupes: champs.filter((c) => {
        const b = c.getBoundingClientRect();
        return b.width > 0 && (b.right > dr.right + 1 || b.left < dr.left - 1);
      }).length,
      destScrollable: dest ? dest.scrollHeight > dest.clientHeight + 1 || dest.clientHeight > 0 : false,
      destDansEcran: dest ? Math.round(dest.getBoundingClientRect().right) <= Math.round(dr.right) + 1 : null,
      /* .drawer-panel porte `overflow: auto` : les boutons d'un formulaire long
         s'atteignent en faisant défiler le panneau, exactement comme dans les
         autres side-windows du produit. On teste donc l'ATTEIGNABILITÉ. */
      actionsAtteignables: (() => {
        const panel = document.querySelector('.drawer-panel');
        if (!actions) return false;
        panel.scrollTop = panel.scrollHeight;
        const r = actions.getBoundingClientRect();
        return [...actions.querySelectorAll('button')].every((x) => {
          const bb = x.getBoundingClientRect();
          return bb.top >= 0 && bb.bottom <= innerHeight + 1;
        }) && r.bottom <= innerHeight + 1;
      })(),
      panneauDefile: (() => {
        const panel = document.querySelector('.drawer-panel');
        return panel.scrollHeight > panel.clientHeight;
      })(),
      destPlafonnee: dest ? Math.round(dest.getBoundingClientRect().height) <= Math.round(innerHeight * 0.4) + 2 : null,
      // §25 — pas un immense tableau : une liste de rangs
      rangs: document.querySelectorAll('.snc-dest-opt').length,
      hauteurRang: document.querySelector('.snc-dest-opt')?.getBoundingClientRect().height,
      tableau: document.querySelectorAll('#drawerContent table').length,
      sousLaBarre: bas ? dr.bottom <= innerHeight + 1 : true,
    };
  });
  note(num, { w, ...r });
  ok(r.over <= 0 && r.champsCoupes === 0 && r.destDansEcran !== false,
    `${num} : mobile ${w} — aucun débordement, aucun champ coupé, la liste des destinations tient dans la side-window`, num);
  ok(r.rangs >= 19 && r.tableau === 0 && r.hauteurRang >= 30,
    `${num} : mobile ${w} — les ${r.rangs} destinations sont une LISTE hiérarchique touchable (${Math.round(r.hauteurRang)} px par rang), jamais un tableau`, num);
  ok(r.actionsAtteignables && r.sousLaBarre,
    `${num} : mobile ${w} — les deux boutons s’atteignent entièrement en faisant défiler le panneau, et rien ne passe sous la barre inférieure`, num);
  ok(r.destPlafonnee !== false,
    `${num} : mobile ${w} — la liste des destinations est plafonnée et défile à l’intérieur (${r.rangs} destinations), au lieu de repousser les boutons indéfiniment`, num);
  await shot(p, capture);
  await ctx.close();
}
{
  // DUP-26 / DUP-27 — clavier et menu
  const { ctx, p } = await newPage({ tag: 'KBD' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  await p.click('[data-structure-node="sn-a1"] .more-trigger');
  await p.waitForTimeout(180);
  const menuGeo = await ev(p, () => {
    const card = document.querySelector('[data-structure-node="sn-a1"]');
    const btn = card.querySelector('.more-trigger'), pop = card.querySelector('.more-pop');
    const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    return {
      ouvert: pop.classList.contains('open'),
      ecart: Math.round(pop.classList.contains('drop-up') ? bb.top - pb.bottom : pb.top - bb.bottom),
      dxDroite: Math.round(pb.right - bb.right),
      hors: Math.round(Math.max(pb.bottom - innerHeight, -pb.top, pb.right - innerWidth, -pb.left)),
      items: pop.querySelectorAll('[role=menuitem]').length,
      aria: btn.getAttribute('aria-expanded'),
    };
  });
  note('DUP-27', menuGeo);
  ok(menuGeo.ouvert && Math.abs(menuGeo.ecart) <= 12 && Math.abs(menuGeo.dxDroite) <= 1 && menuGeo.hors <= 0 && menuGeo.items === 6,
    `DUP-27 : le menu enrichi reste ancré à son bouton (${menuGeo.ecart} px), dans le viewport, avec ses six entrées — le correctif de V2.9.0.1 n’a pas bougé`, 'DUP-27');
  await ev(p, () => closeDrawerMenu());
  await p.waitForTimeout(120);
  /* Le menu à SIX entrées mesure 261 px contre 175 : retourné vers le haut, il
     dépasse désormais du bloc Structure. Tant que ce bloc portait
     `overflow: hidden` (V2.9.1), son sommet était ROGNÉ et donc inatteignable.
     On vérifie ici que chaque entrée est réellement cliquable, sur chaque
     ligne — c'est la seule façon de s'en assurer. */
  const cliquables = await ev(p, async () => {
    const out = [];
    for (const card of [...document.querySelectorAll('[data-structure-node]')]) {
      // On amène la ligne à l'écran AVANT d'ouvrir son menu : c'est ce que fait
      // l'utilisateur, et un bouton hors écran ne prouverait rien.
      card.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 60));
      card.querySelector('.more-trigger').click();
      const pop = card.querySelector('.more-pop');
      const bloquees = [...pop.querySelectorAll('button')].filter((btn) => {
        const bb = btn.getBoundingClientRect();
        const e = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
        return !e || !e.closest('.more-pop');
      }).map((btn) => btn.textContent.trim());
      out.push({ id: card.dataset.structureNode, hauteur: Math.round(pop.getBoundingClientRect().height), bloquees });
      closeDrawerMenu();
    }
    return { lignes: out, overflowBloc: getComputedStyle(document.querySelector('.snc-block')).overflow,
      arrondiEnTete: getComputedStyle(document.querySelector('.snc-head')).borderTopLeftRadius };
  });
  note('DUP-27-clipping', cliquables);
  ok(cliquables.lignes.every((l) => l.bloquees.length === 0),
    `DUP-27 : sur CHAQUE ligne, les six entrées du menu sont réellement cliquables — aucune n’est rognée par le bloc Structure (menu de ${cliquables.lignes[0]?.hauteur} px)`, 'DUP-27');
  ok(cliquables.overflowBloc === 'visible' && cliquables.arrondiEnTete !== '0px',
    'DUP-27 : le bloc ne rogne plus rien, et ses coins restent arrondis — l’en-tête porte son propre rayon', 'DUP-27');

  // Ouverture au CLAVIER, focus initial, Escape, restitution du focus
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  const kb = await ev(p, () => {
    const btn = document.querySelector('[data-structure-node="sn-a1"] .more-trigger');
    btn.focus();
    return { declencheurFocus: document.activeElement === btn };
  });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(180);
  await ev(p, () => {
    const items = [...document.querySelectorAll('[data-structure-node="sn-a1"] .more-pop [role=menuitem]')];
    items.find((x) => x.textContent.trim() === 'Dupliquer').click();
  });
  await p.waitForTimeout(400);
  const focusInitial = await ev(p, () => ({
    ouvert: $('#drawer').classList.contains('open'),
    actif: document.activeElement?.getAttribute('name') || document.activeElement?.tagName,
  }));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const apresEchap = await ev(p, () => ({
    ouvert: $('#drawer').classList.contains('open'),
    focusRendu: document.activeElement?.classList.contains('more-trigger'),
    surLeBon: document.activeElement?.closest('[data-structure-node]')?.dataset.structureNode,
  }));
  note('DUP-26', { ...kb, focusInitial, apresEchap });
  ok(focusInitial.ouvert && focusInitial.actif === 'name',
    'DUP-26 : la side-window s’ouvre au clavier et place le focus sur son premier champ', 'DUP-26');
  ok(!apresEchap.ouvert && apresEchap.focusRendu && apresEchap.surLeBon === 'sn-a1',
    'DUP-26 : Échap ferme la side-window et RESTITUE le focus au bouton « … » qui l’avait ouverte', 'DUP-26');
  await ctx.close();
}

// ============================================================
// Responsive complet et captures
// ============================================================
console.log('\n[RESP] Dix largeurs, deux thèmes');
{
  const mesures = [];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390]) {
    for (const dark of [false, true]) {
      const { ctx, p } = await newPage({ tag: 'R' + w, w, h: 900, dark });
      await ouvrirStructure(p);
      await arbreProfond(p);
      await ev(p, () => openStructureDuplicate('sn-a1'));
      await p.waitForTimeout(320);
      const m = await ev(p, () => {
        const dr = document.querySelector('#drawer').getBoundingClientRect();
        const dest = document.querySelector('.snc-dest');
        return {
          over: document.documentElement.scrollWidth - innerWidth,
          destHors: dest ? Math.round(dest.getBoundingClientRect().right - dr.right) : 0,
          picks: document.querySelectorAll('.snc-pick').length,
        };
      });
      mesures.push({ w, dark, ...m });
      await ctx.close();
    }
  }
  note('RESP', mesures.map((m) => ({ w: m.w, d: m.dark, o: m.over, dh: m.destHors })));
  ok(mesures.every((m) => m.over <= 0),
    'RESP : aucun débordement horizontal sur 10 largeurs × 2 thèmes, side-window ouverte', 'RESP');
  ok(mesures.every((m) => m.destHors <= 1 && m.picks === 2),
    'RESP : la liste des destinations et les deux choix de contenu tiennent dans la side-window à toutes les largeurs', 'RESP');
}
{
  // Captures desktop : déplacement, arborescence après duplication, Undo/Redo
  const { ctx, p } = await newPage({ tag: 'SHOTS' });
  await ouvrirStructure(p);
  await arbreProfond(p);
  await ev(p, () => openStructureMove('sn-a2'));
  await p.waitForTimeout(350);
  await shot(p, '01-deplacement-desktop.png');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(200);
  await ev(p, () => openStructureDuplicate('sn-a1'));
  await p.waitForTimeout(350);
  await shot(p, '02-duplication-desktop.png');
  await ev(p, () => { closeOverlay('drawer'); duplicateStructureNode('sn-a1', { withTasks: true }); openProjectTab('keravel', 'Structure'); });
  await p.waitForTimeout(400);
  await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
  await shot(p, '08-arborescence-apres-duplication.png');
  await ev(p, () => { undo(); openProjectTab('keravel', 'Structure'); });
  await p.waitForTimeout(400);
  await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
  await shot(p, '09-undo.png');
  await ev(p, () => { redo(); openProjectTab('keravel', 'Structure'); });
  await p.waitForTimeout(400);
  await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
  await shot(p, '10-redo.png');
  await ctx.close();
}

// ============================================================
// FREEZE-2100 — Périmètre
// ============================================================
console.log('\n[FREEZE-2100] Périmètre du round');
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

  /* Tout le métier, et en particulier TOUT le Planning que le §32 demande de
     ne pas effleurer. */
  const geles = [
    // Planning — création, déplacement, propagation, jours non ouvrés
    'planningTasks', 'gantt', 'planningAgenda', 'effectiveTasks', 'pos', 'scale',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime',
    'addWorkingDuration', 'dropTask', 'dragStart', 'dragOver', 'drawDeps',
    'requestGanttTaskMove', 'requestTaskScheduleMove', 'renderPlanning',
    'planningCreateRow', 'planningCreatePointerDown', 'planningCreatePointerMove',
    'planningCreatePointerUp', 'planningCanDrawCreate', 'openTaskForm', 'submitTaskEdit',
    'shiftPlanning', 'planningToday', 'planningXToDate', 'planningCreateRange',
    'easterSunday', 'frenchPublicHolidays', 'isWeekendDate', 'publicHolidayName',
    'isNonWorkingDate', 'nonWorkingDaysInRange', 'taskTouchesNonWorkingDay',
    'calendarConfirm', 'runCalendarConfirm', 'askNonWorkingConfirm',
    'realStartPlan', 'askRealStartConfirm', 'setTaskStatus',
    // Structure — le moteur de V2.9.0 et les vues de V2.9.1
    'structureNode', 'getProjectStructure', 'getStructureChildren', 'getStructureRoots',
    'getStructureDescendantIds', 'getStructureAncestors', 'structurePath',
    'getStructureTasks', 'getUnstructuredTasks', 'getStructureDates',
    'getStructureProgress', 'getStructureResources', 'getStructureIssues',
    'getStructureControls', 'getStructureMilestones', 'getStructureStatus',
    'structureParentError', 'structureParentOptions', 'openStructureForm',
    'structureArchiveBlocker', 'toggleStructureArchive', 'structureDeleteBlocker',
    'confirmDeleteStructure', 'deleteStructureNode', 'openStructureNode',
    'closeStructureNode', 'setStructureTab', 'toggleStructureNode',
    'refreshStructureTree', 'structureCompactTree',
    'projectStructureTab', 'renderStructureNode', 'structureTabContent',
    'structureUnstructuredBlock', 'structureCompactCockpit', 'unstructuredTaskRow',
    'structureCountsLine', 'toggleAllStructure', 'structureAllExpanded',
    // Données, ressources, qualité, jalons, opérations
    'migrateState', 'save', 'applyStorageSync', 'resetApp', 'buildKanvixBackup',
    'confirmKanvixRestore', 'validateImportState', 'analyzeKanvixImport',
    'buildImportPlan', 'applyImportPlan', 'exportKanvixData',
    'taskResourceIds', 'getResourceTasks', 'getResourceSchedulingConflicts',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'getProjectHealth', 'milestoneStatus', 'operationMilestonesTab',
    'operationPlanningTab', 'operationProjectCard', 'openTask', 'projectTeamCard',
    // Undo / Redo et menus
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget', 'actionToast',
    'toggleDrawerMenu', 'closeDrawerMenu', 'anyDrawerMenuOpen', 'drawerForm', 'closeOverlay',
    // Navigation de la fiche chantier (le correctif de V2.9.1)
    'projectTab', 'renderProject', 'selectProject',
  ];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2100', { comparées: compares, bougés: bouges });
  ok(bouges.length === 0,
    `FREEZE-2100 : les ${compares} moteurs de V2.9.1 sont BYTE-IDENTIQUES — tout le Planning (drag & drop, création à la souris, jours non ouvrés, démarrage réel), tout le moteur Structure, les données, les ressources, la qualité, les jalons, l’Opération, l’Undo/Redo et les menus`, 'FREEZE-2100');

  const attendues = ['structureNodeMenu', 'structureCompactRow'];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  note('FREEZE-2100-périmètre', { modifiées: attendues, horsPérimètre: horsPerimetre, indentation: indentDiff });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'DUP-28 : seules structureNodeMenu() (deux entrées) et structureCompactRow() (le signalement du niveau créé) sont modifiées — le balayage de tout le fichier n’en trouve aucune autre', 'DUP-28');

  const ajoutees = ['structureUid', 'structureMoveBlocker', 'moveStructureNode',
    'structureCopyName', 'duplicateStructureNode', 'structureDestinationList',
    'structureSourceCard', 'openStructureMove', 'openStructureDuplicate',
    'structureRememberTrigger'];
  const manquantes = ajoutees.filter((n) => !extractFn(B, n));
  const regles = {
    schema: /SCHEMA_VERSION = 13/.test(B) && /SCHEMA_VERSION = 13/.test(A),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    initialIdentique:
      md5((A.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]) ===
      md5((B.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]),
    tachesDemoIdentiques:
      md5((A.match(/\n\s*tasks: \[[\s\S]*?\n        \],/) || [''])[0]) ===
      md5((B.match(/\n\s*tasks: \[[\s\S]*?\n        \],/) || [''])[0]),
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    pasDeMoteurParallele: !/function\s+(cloneStructure|structureClone|copyStructureTree|moveNode|structureHistory)\s*\(/.test(B),
    pasDeDragStructure: !/data-structure-node="[^"]*"[^>]*draggable/.test(B),
  };
  note('FREEZE-2100-règles', { manquantes, ...regles });
  ok(manquantes.length === 0 && Object.values(regles).every(Boolean),
    'DUP-28 : les 10 fonctions ajoutées existent, SCHEMA 13 / STORE / build inchangés, données de démonstration byte-identiques, un seul gantt(), un seul snapshot(), aucun moteur parallèle, et AUCUN drag & drop de structure (§38)', 'DUP-28');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `DUP-28 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'DUP-28');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
