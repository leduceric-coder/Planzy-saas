// ============================================================
// KANVIX — Recette « Structure & pilotage multi-niveaux » (V2.9.0)
//
//   Opération → Chantier → STRUCTURE → Tâches.
//
//   La question à laquelle cette recette répond :
//     « Un conducteur peut-il déclarer comment son chantier est organisé —
//       bâtiment, zone, phase, sous-projet — et Kanvix exploite-t-il ensuite
//       cette structure automatiquement, SANS qu'un second moteur de planning,
//       de ressources ou de risque n'ait été créé, et SANS qu'un chantier non
//       structuré ne perde quoi que ce soit ? »
//
//   Deux dimensions restent indépendantes : la STRUCTURE (où, sur le chantier)
//   et le LOT (quel corps d'état). Une tâche peut être « Bâtiment A › Étage 1 »
//   ET « Plâtrerie ».
//
//   Usage : node recette-structure-projet-v2.9.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.9.0.html';
const PREV = 'kanvix-next-gen-v2.8.5.2.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.9.0/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, level = 'essential', dark = false } = opts;
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
const shot = async (p, name) => { await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + name, fullPage: true }); };
const ouvrirStructure = async (p, pid = 'keravel') => {
  await ev(p, (id) => { app.ui.projectId = id; save(); go('project'); openProjectTab(id, 'Structure'); }, pid);
  await p.waitForTimeout(280);
};

// ============================================================
// ST-01 → ST-02 — Migration
// ============================================================
console.log('\n[ST-MIGRATION] V12 → V13');
{
  const { ctx, p } = await newPage({ tag: 'MIG' });
  const r = await ev(p, () => {
    const v12 = structuredClone(app);
    delete v12.structureNodes;
    v12.schemaVersion = 12;
    v12.tasks.forEach((t) => { delete t.structureNodeId; });
    const m1 = migrateState(structuredClone(v12));
    const m2 = migrateState(structuredClone(m1));
    return {
      schema: SCHEMA_VERSION, store: STORE,
      collection: Array.isArray(m1.structureNodes), noeuds: m1.structureNodes.length,
      tachesNull: m1.tasks.every((t) => t.structureNodeId === null),
      taches: m1.tasks.length,
      idempotent:
        JSON.stringify(m1.structureNodes) === JSON.stringify(m2.structureNodes) &&
        JSON.stringify(m1.tasks.map((t) => t.structureNodeId)) ===
          JSON.stringify(m2.tasks.map((t) => t.structureNodeId)),
    };
  });
  note('ST-01', r);
  ok(r.collection && r.noeuds === 0 && r.idempotent,
    'ST-01 : une sauvegarde V12 migre vers V13 avec structureNodes = [] — et la migration est IDEMPOTENTE', 'ST-01');
  ok(r.tachesNull,
    `ST-02 : les ${r.taches} anciennes tâches reçoivent structureNodeId = null — aucune référence inventée`, 'ST-02');
  /* V2.11.0 — RE-POINTAGE : le schéma a avancé à 14 avec les modèles de
     chantier. La clé de stockage, elle, n'a jamais bougé — c'est ce que cette
     assertion protège réellement. */
  ok(r.schema === 14 && r.store === 'kanvix-product-8-3',
    `ST-70 / ST-69 : SCHEMA_VERSION = ${r.schema} et STORE inchangé (« ${r.store} »)`, 'ST-70');
  await ctx.close();
}

// ============================================================
// ST-03 → ST-11 — Hiérarchie, gardes, cycles
// ============================================================
console.log('\n[ST-HIERARCHIE] Créer, imbriquer, refuser les cycles');
{
  const { ctx, p } = await newPage({ tag: 'HIER' });
  const creer = (pid, nom, parent = '') => ev(p, ([projet, n, par]) => {
    openStructureForm(projet, '', par || null);
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=name]').value = n;
    if (par) f.querySelector('[name=parentId]').value = par;
    f.requestSubmit();
    const node = app.structureNodes.find((x) => x.name === n && x.projectId === projet);
    return { id: node?.id, parent: node?.parentId, projet: node?.projectId, type: node?.type };
  }, [pid, nom, parent]);

  const racine = await creer('terrasses', 'Villa 1');
  note('ST-03', racine);
  ok(!!racine.id && racine.parent === null && racine.projet === 'terrasses',
    'ST-03 : un niveau RACINE se crée sur un chantier qui n’en avait aucun', 'ST-03');

  const enfant = await creer('terrasses', 'Niveau 0', racine.id);
  note('ST-04', enfant);
  ok(enfant.parent === racine.id,
    'ST-04 : un sous-niveau se rattache à son parent', 'ST-04');

  const petit = await creer('terrasses', 'Salle de bain', enfant.id);
  note('ST-05', petit);
  ok(petit.parent === enfant.id,
    'ST-05 : un petit-enfant fonctionne — le moteur est générique (parentId), sans niveau1/niveau2/niveau3 codés en dur', 'ST-05');

  const gardes = await ev(p, ([r, e]) => ({
    autreChantier: structureParentError('terrasses', '', 'sn-keravel-bat-a'),
    soiMeme: structureParentError('terrasses', r, r),
    descendant: structureParentError('terrasses', r, e),
    valide: structureParentError('terrasses', e, null),
    optionsDepuisRacine: structureParentOptions('terrasses', r).map((o) => o.path),
  }), [racine.id, enfant.id]);
  note('ST-06', gardes);
  ok(/autre chantier/i.test(gardes.autreChantier || ''),
    'ST-06 : impossible de choisir un parent appartenant à un AUTRE chantier', 'ST-06');
  ok(/son propre parent/i.test(gardes.soiMeme || ''),
    'ST-07 : impossible de se choisir soi-même comme parent', 'ST-07');
  ok(/sous-niveaux/i.test(gardes.descendant || ''),
    'ST-08 : impossible de choisir un de ses propres descendants — donc aucun cycle possible', 'ST-08');
  ok(gardes.optionsDepuisRacine.length === 0,
    'ST-09 : la liste des parents proposés exclut déjà tout ce qui créerait un cycle — l’interface ne propose jamais l’interdit', 'ST-09');

  const chemins = await ev(p, ([r, e, g]) => ({
    racine: structurePath(r), enfant: structurePath(e), petit: structurePath(g),
    avecChantier: structurePath(g, { withProject: true }),
    ancetres: getStructureAncestors(g).map((n) => n.name),
    descendants: getStructureDescendantIds(r).length,
    descendantsEnfant: getStructureDescendantIds(e),
  }), [racine.id, enfant.id, petit.id]);
  note('ST-10', chemins);
  ok(chemins.petit === 'Villa 1 › Niveau 0 › Salle de bain' &&
    chemins.avecChantier.startsWith('Les Terrasses ›') &&
    JSON.stringify(chemins.ancetres) === JSON.stringify(['Niveau 0', 'Villa 1']),
    `ST-10 : le fil d’Ariane est correct sur trois niveaux — « ${chemins.petit} »`, 'ST-10');
  ok(chemins.descendants === 3 && chemins.descendantsEnfant.length === 2,
    `ST-11 : getStructureDescendantIds renvoie le nœud ET sa descendance (${chemins.descendants} depuis la racine, ${chemins.descendantsEnfant.length} depuis l’enfant)`, 'ST-11');
  await ctx.close();
}

// ============================================================
// ST-12 → ST-19 — Agrégation
// ============================================================
console.log('\n[ST-AGREGATION] Le parent voit ses descendants');
{
  const { ctx, p } = await newPage({ tag: 'AGG' });
  const r = await ev(p, () => ({
    directesBatA: getStructureTasks('sn-keravel-bat-a', { includeDescendants: false }).map((t) => t.id),
    toutesBatA: getStructureTasks('sn-keravel-bat-a').map((t) => t.id),
    rdc: getStructureTasks('sn-keravel-rdc').map((t) => t.id),
    etage: getStructureTasks('sn-keravel-etage-1').map((t) => t.id),
    datesRdc: getStructureDates('sn-keravel-rdc'),
    datesEtage: getStructureDates('sn-keravel-etage-1'),
    datesBatA: getStructureDates('sn-keravel-bat-a'),
    progBatA: getStructureProgress('sn-keravel-bat-a'),
    ressourcesBatA: getStructureResources('sn-keravel-bat-a'),
    lots: getStructureTasks('sn-keravel-bat-a').map((t) => ({ id: t.id, lot: t.lotId })),
  }));
  note('ST-12', r);
  ok(r.directesBatA.length === 1 && r.directesBatA[0] === 'k-windows',
    `ST-12 : les tâches DIRECTES d’un niveau sont correctes (${r.directesBatA.join(', ')})`, 'ST-12');
  ok(r.toutesBatA.length === 4 && r.rdc.length === 1 && r.etage.length === 2,
    `ST-13 : Bâtiment A agrège ses descendants — ${r.toutesBatA.length} tâches (1 directe + ${r.rdc.length} RDC + ${r.etage.length} Étage 1), sans qu’aucune donnée ne soit dupliquée`, 'ST-13');

  const minEnfants = [r.datesRdc.start, r.datesEtage.start].sort()[0];
  const maxEnfants = [r.datesRdc.end, r.datesEtage.end].sort().pop();
  ok(r.datesBatA.start <= minEnfants && r.datesBatA.end >= maxEnfants,
    `ST-14 : les dates du parent encadrent celles de ses descendants — ${r.datesBatA.start} → ${r.datesBatA.end}`, 'ST-14');
  ok(r.progBatA && r.progBatA.total === 4 && r.progBatA.pct === Math.round((r.progBatA.done / 4) * 100),
    `ST-15 : l’avancement est terminées / total, sans pondération — ${r.progBatA.done}/${r.progBatA.total} = ${r.progBatA.pct} %`, 'ST-15');

  const sansDirectes = await ev(p, () => {
    // Un parent purement organisationnel : on retire sa tâche directe.
    task('k-windows').structureNodeId = 'sn-keravel-rdc';
    save();
    const out = {
      directes: getStructureTasks('sn-keravel-bat-a', { includeDescendants: false }).length,
      agregees: getStructureTasks('sn-keravel-bat-a').length,
      prog: getStructureProgress('sn-keravel-bat-a'),
      dates: getStructureDates('sn-keravel-bat-a'),
    };
    task('k-windows').structureNodeId = 'sn-keravel-bat-a';
    save();
    return out;
  });
  note('ST-16', sansDirectes);
  ok(sansDirectes.directes === 0 && sansDirectes.agregees === 4 && !!sansDirectes.dates,
    'ST-16 : un parent SANS tâche directe agrège quand même celles de ses enfants — il n’affiche jamais « aucune intervention » à tort', 'ST-16');

  const res = await ev(p, () => {
    const ts = getStructureTasks('sn-keravel-bat-a');
    const attendu = [...new Set(ts.flatMap((t) => taskResourceIds(t)))];
    const obtenu = getStructureResources('sn-keravel-bat-a');
    return {
      attendu, obtenu,
      identiques: JSON.stringify(attendu.slice().sort()) === JSON.stringify(obtenu.slice().sort()),
      familles: obtenu.map((id) => resource(id)?.type),
      materiel: obtenu.filter((id) => resource(id)?.type === 'equipment'),
      entreprises: obtenu.filter((id) => resource(id)?.type === 'company'),
    };
  });
  note('ST-17', res);
  ok(res.identiques,
    `ST-17 : les ressources d’un niveau sont EXACTEMENT l’agrégation de taskResourceIds() de ses tâches (${res.obtenu.length}) — aucune affectation parallèle`, 'ST-17');
  ok(res.materiel.length > 0 || res.entreprises.length > 0,
    `ST-18 : matériel et entreprises remontent comme les personnes (${res.materiel.length} matériel, ${res.entreprises.length} entreprise(s))`, 'ST-18');

  const resp = await ev(p, () => {
    openStructureForm('keravel', 'sn-keravel-bat-a');
    const opts = [...document.querySelectorAll('[name=responsibleResourceId] option')]
      .map((o) => o.value).filter(Boolean);
    closeOverlay('drawer');
    return {
      proposes: opts.map((id) => ({ id, type: resource(id)?.type })),
      quePersonnes: opts.every((id) => resource(id)?.type === 'person'),
      actuel: structureNode('sn-keravel-bat-a').responsibleResourceId,
    };
  });
  note('ST-19', resp);
  ok(resp.quePersonnes && resp.proposes.length > 0,
    `ST-19 : seules les ressources de type « person » peuvent être responsables d’un niveau (${resp.proposes.length} proposées) — ni entreprise, ni matériel`, 'ST-19');
  await ctx.close();
}

// ============================================================
// ST-20 → ST-28 — Tâches, formulaire, historique, Undo
// ============================================================
console.log('\n[ST-TACHES] Le formulaire, l’historique et l’Undo');
{
  const { ctx, p } = await newPage({ tag: 'TASK' });
  const libres = await ev(p, () => ({
    sansStructure: getUnstructuredTasks('keravel').map((t) => t.id),
    terrassesSansStructure: projectHasStructure('terrasses'),
    terrassesTaches: app.tasks.filter((t) => t.projectId === 'terrasses').length,
  }));
  note('ST-20', libres);
  ok(libres.sansStructure.length > 0,
    `ST-20 : une tâche peut rester SANS structure (${libres.sansStructure.length} sur Keravel) — ce n’est jamais obligatoire`, 'ST-20');
  ok(!libres.terrassesSansStructure && libres.terrassesTaches > 0,
    'ST-21 : un chantier entier sans structure fonctionne exactement comme avant', 'ST-21');

  const form = await ev(p, () => {
    openTaskForm('keravel');
    const sel = document.querySelector('[name="structureNodeId"]');
    const ordre = [...document.querySelectorAll('#drawerFormEl label')].map((l) => l.textContent.split(/[A-ZÀ-Ý]/)[0] || l.textContent.slice(0, 20));
    const labels = [...document.querySelectorAll('#drawerFormEl label')].map((l) => l.firstChild?.textContent || '');
    const out = {
      present: !!sel,
      options: [...(sel?.options || [])].map((o) => o.textContent),
      position: labels.findIndex((x) => /Structure/.test(x)),
      chantier: labels.findIndex((x) => /Chantier/.test(x)),
      lot: labels.findIndex((x) => /Lot/.test(x)),
    };
    closeOverlay('drawer');
    return out;
  });
  note('ST-22', form);
  ok(form.present && form.chantier < form.position && form.position < form.lot,
    `ST-22 : le formulaire propose « Structure / zone », APRÈS le chantier et AVANT le lot (positions ${form.chantier} < ${form.position} < ${form.lot})`, 'ST-22');
  ok(form.options.some((o) => /Bâtiment A › Étage 1/.test(o)) && form.options[0] === 'Sans structure',
    `ST-21bis : les niveaux sont présentés par leur chemin complet — ${form.options.join(' | ')}`, 'ST-23');

  const filtre = await ev(p, () => {
    openTaskForm('terrasses');
    const sel = document.querySelector('[name="structureNodeId"]');
    const out = { options: [...sel.options].map((o) => o.textContent), keravel: [...sel.options].some((o) => /Bâtiment A/.test(o.textContent)) };
    closeOverlay('drawer');
    return out;
  });
  note('ST-23', filtre);
  ok(!filtre.keravel && filtre.options[0] === 'Aucune structure',
    'ST-23 : la liste est filtrée par CHANTIER — un chantier sans structure affiche « Aucune structure », jamais celle d’un autre', 'ST-23');

  const changement = await ev(p, () => {
    openTaskForm('keravel');
    const sel = document.querySelector('[name="structureNodeId"]');
    sel.value = 'sn-keravel-rdc';
    const projet = document.querySelector('[name="projectId"]');
    projet.value = 'terrasses';
    syncTaskProject(projet, '');
    const apres = document.querySelector('[name="structureNodeId"]');
    const out = { valeur: apres.value, options: [...apres.options].map((o) => o.textContent) };
    closeOverlay('drawer');
    return out;
  });
  note('ST-24', changement);
  ok(changement.valeur === '' && !changement.options.some((o) => /Bâtiment A/.test(o)),
    'ST-24 : changer de chantier invalide une structure devenue incompatible — jamais de référence croisée', 'ST-24');

  const edition = await ev(p, () => {
    const avant = { sn: task('k-cloisons').structureNodeId, undo: undoHistory.length, hist: app.history.length };
    openTaskEdit('k-cloisons', 'planning');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=structureNodeId]').value = 'sn-keravel-rdc';
    submitTaskEdit();
    if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    const t = task('k-cloisons');
    return {
      avant, apres: t.structureNodeId, lot: t.lotId,
      undo: undoHistory.length, hist: app.history.length,
      entree: app.history[0] && { text: app.history[0].text, changes: app.history[0].changes },
    };
  });
  note('ST-25', edition);
  ok(edition.apres === 'sn-keravel-rdc' && edition.lot === 'lot-platrerie',
    'ST-25 : l’éditeur change la structure d’une tâche — et son LOT reste intact : les deux dimensions sont indépendantes', 'ST-25');
  const chg = (edition.entree?.changes || []).find((c) => c.field === 'Structure');
  note('ST-26', chg);
  ok(chg && /Étage 1/.test(chg.from) && /RDC/.test(chg.to),
    `ST-26 : l’historique trace le changement avec les chemins complets — « ${chg?.from} → ${chg?.to} »`, 'ST-26');
  ok(edition.undo === edition.avant.undo + 1,
    `ST-27 : le changement de structure est UNE transaction Undo (${edition.avant.undo} → ${edition.undo})`, 'ST-27');

  const ur = await ev(p, () => {
    undo();
    const a = task('k-cloisons').structureNodeId;
    redo();
    return { apresUndo: a, apresRedo: task('k-cloisons').structureNodeId };
  });
  note('ST-27', ur);
  ok(ur.apresUndo === 'sn-keravel-etage-1',
    'ST-27 : Undo restaure la structure précédente', 'ST-27');
  ok(ur.apresRedo === 'sn-keravel-rdc',
    'ST-28 : Redo la rejoue', 'ST-28');
  await ctx.close();
}

// ============================================================
// ST-29 → ST-39 — Planning : UN seul moteur
// ============================================================
console.log('\n[ST-PLANNING] Le Gantt existant, filtré');
{
  const { ctx, p } = await newPage({ tag: 'PLAN' });
  await ev(p, () => { app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); });
  const niveau = async (id) => {
    await ev(p, (n) => { openStructureNode(n); setStructureTab('Planning'); }, id);
    await p.waitForTimeout(280);
    return ev(p, () => ({
      barres: [...document.querySelectorAll('.g-bar')].map((x) => x.id.replace('bar-', '')).filter(Boolean),
      gantt: document.querySelectorAll('#gantt').length,
      contexte: document.querySelector('[data-create-structure]')?.dataset.createStructure,
    }));
  };
  const rdc = await niveau('sn-keravel-rdc');
  note('ST-29', rdc);
  ok(rdc.barres.includes('k-control') && rdc.barres.length === 1,
    `ST-29 : le Planning d’un niveau affiche ses tâches directes (${rdc.barres.join(', ')})`, 'ST-29');

  const batA = await niveau('sn-keravel-bat-a');
  note('ST-30', batA);
  ok(batA.barres.length === 4 && ['k-cloisons', 'k-control', 'k-windows', 'k-paint'].every((x) => batA.barres.includes(x)),
    `ST-30 : le Planning d’un parent affiche toute sa descendance (${batA.barres.length} tâches)`, 'ST-30');

  const etage = await niveau('sn-keravel-etage-1');
  note('ST-31', etage);
  ok(!etage.barres.includes('k-control') && etage.barres.length === 2,
    'ST-31 : le Planning d’un enfant n’affiche PAS les tâches de ses frères', 'ST-31');
  await shot(p, '07-structure-node-planning.png');

  const moteur = await ev(p, () => {
    const src = document.documentElement.innerHTML;
    return {
      unSeulGantt: (src.match(/function gantt\(/g) || []).length,
      unSeulPlanningTasks: (src.match(/function planningTasks\(/g) || []).length,
      pasDeMoteurStructure: !/function\s+(structureGantt|renderStructurePlanning|structurePlanningTasks|structureResourcesEngine|structureRiskStatus|structureConflicts)\s*\(/.test(src),
      // La fiche de niveau appelle littéralement gantt().
      ficheAppelleGantt: /structureTabContent[\s\S]{0,900}gantt\(n\.projectId, \{/.test(src),
    };
  });
  note('ST-32', moteur);
  ok(moteur.unSeulGantt === 1 && moteur.unSeulPlanningTasks === 1 && moteur.pasDeMoteurStructure && moteur.ficheAppelleGantt,
    'ST-32 : le Planning d’un niveau EST le gantt() existant, appelé avec un périmètre — un seul gantt(), un seul planningTasks(), aucun moteur Structure parallèle', 'ST-32');

  // Création à la souris DANS un niveau
  await ev(p, () => { openStructureNode('sn-keravel-rdc'); setStructureTab('Planning'); });
  await p.waitForTimeout(300);
  const box = await ev(p, () => {
    const t = document.querySelector('.g-create-track');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  let souris = { ouvert: false };
  if (box) {
    await p.mouse.move(box.x + box.w * 0.1, box.y + box.h / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.w * 0.4, box.y + box.h / 2, { steps: 8 });
    await p.mouse.up();

  }
  await p.waitForTimeout(350);
  souris = await ev(p, () => ({
    ouvert: !!document.querySelector('#drawer.open'),
    projet: document.querySelector('[name="projectId"]')?.value,
    structure: document.querySelector('[name="structureNodeId"]')?.value,
    start: document.querySelector('[name="start"]')?.value,
  }));
  note('ST-33', { box: !!box, souris });
  ok(souris.ouvert && souris.projet === 'keravel' && souris.structure === 'sn-keravel-rdc',
    `ST-33 : dessiner dans le Gantt d’un niveau préremplit le chantier ET le niveau (${souris.structure})`, 'ST-33');
  await ev(p, () => closeOverlay('drawer'));

  /* V2.9.1 — RE-BASELINE DE SÉLECTEUR. La refonte « Structure compacte » a
     remplacé les grandes cartes `.sn-card` par des lignes `.snc-row`, et le
     conteneur `.sn-tree` par `[data-structure-tree]`. Ce qui est TESTÉ ne
     change pas d'un iota — le nombre de niveaux affichés, leur présence, le
     bouton qui préremplit le niveau. Les sélecteurs acceptent donc les DEUX
     écritures : ces assertions valent pour V2.9.0/V2.9.0.1 comme pour V2.9.1,
     et restent exactement aussi sévères. */
  const bouton = await ev(p, () => {
    openStructureNode('sn-keravel-etage-1');
    setStructureTab('Résumé');
    // V2.9.1 — le bouton « + Tâche » d'une fiche de niveau vit désormais dans
    // la barre du haut (.snc-top-actions) et non plus dans le hero. Même
    // bouton, même handler, même préremplissage : on accepte les deux.
    (document.querySelector('.sn-hero-actions .btn.primary') ||
      document.querySelector('.snc-top-actions .btn.primary'))?.click();
    const out = {
      ouvert: !!document.querySelector('#drawer.open'),
      projet: document.querySelector('[name="projectId"]')?.value,
      structure: document.querySelector('[name="structureNodeId"]')?.value,
    };
    closeOverlay('drawer');
    return out;
  });
  note('ST-34', bouton);
  ok(bouton.ouvert && bouton.structure === 'sn-keravel-etage-1',
    'ST-34 : « + Tâche » depuis un niveau préremplit ce niveau — et c’est le MÊME formulaire', 'ST-34');

  const drag = await ev(p, () => {
    app.ui.structureNodeId = null; app.settings.period = 'week'; save(); go('planning');
    const avant = { sn: task('k-cloisons').structureNodeId, start: task('k-cloisons').start };
    requestTaskScheduleMove('k-cloisons', '2026-08-19T08:00', 'planning-gantt');
    if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    const t = task('k-cloisons');
    return { avant, apres: { sn: t.structureNodeId, start: t.start } };
  });
  note('ST-35', drag);
  ok(drag.apres.sn === drag.avant.sn && drag.apres.start !== drag.avant.start,
    'ST-35 : un déplacement TEMPOREL ne change jamais la structure — le drag reste temporel (§23)', 'ST-35');

  const global = await ev(p, () => {
    resetApp(); app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); go('planning');
    const o = app.operations[0];
    return {
      globalToutes: planningTasks('all').length,
      globalStructurees: planningTasks('all').filter((t) => t.structureNodeId).length,
      operation: planningTasks('all', { projectIds: operationActiveProjectIds(o.id), resourceFilter: 'all', lotFilter: 'all' }).length,
      operationStructurees: planningTasks('all', { projectIds: operationActiveProjectIds(o.id), resourceFilter: 'all', lotFilter: 'all' }).filter((t) => t.structureNodeId).length,
      aujourdhui: getTodayActions(50).length,
    };
  });
  note('ST-36', global);
  ok(global.operationStructurees > 0 && global.operation === global.globalToutes,
    `ST-36 : le Planning d’Opération conserve TOUTES les tâches, structurées comprises (${global.operationStructurees} structurées sur ${global.operation})`, 'ST-36');
  ok(global.globalStructurees > 0,
    `ST-37 : le Planning global conserve les tâches structurées (${global.globalStructurees})`, 'ST-37');
  ok(global.aujourdhui > 0,
    `ST-38 : Aujourd’hui continue de fonctionner (${global.aujourdhui} actions)`, 'ST-38');

  const chantier = await ev(p, () => {
    enterFieldMode();
    const out = {
      wrap: !!document.querySelector('.field-wrap'),
      mode: app.settings.driverMode,
      taille: document.querySelector('.field-wrap')?.innerHTML.length || 0,
    };
    exitFieldMode();
    return out;
  });
  note('ST-39', chantier);
  ok(chantier.wrap && chantier.mode === 'field' && chantier.taille > 2000,
    'ST-39 : le Mode Chantier continue de fonctionner, tâches structurées comprises', 'ST-39');
  await ctx.close();
}

// ============================================================
// ST-40 → ST-49 — Qualité, attention, archivage, suppression
// ============================================================
console.log('\n[ST-PILOTAGE] Qualité, attention, archivage, suppression');
{
  const { ctx, p } = await newPage({ tag: 'PILOT' });
  const qualite = await ev(p, () => {
    getStructureTasks('sn-keravel-bat-a').forEach((t) => ensureTaskControlInstances(t.id));
    const rdc = getStructureControls('sn-keravel-rdc').length,
      etage = getStructureControls('sn-keravel-etage-1').length,
      direct = getStructureTasks('sn-keravel-bat-a', { includeDescendants: false })
        .flatMap((t) => pendingControlsForTask(t.id)).length,
      parent = getStructureControls('sn-keravel-bat-a').length;
    return { rdc, etage, direct, parent,
      // Aucun contrôle n'est dupliqué : le parent = somme des périmètres.
      pasDeDoublon: parent === rdc + etage + direct,
      total: (app.controlInstances || []).length };
  });
  note('ST-40', qualite);
  ok(qualite.pasDeDoublon,
    `ST-40 : les contrôles qualité remontent dans le parent sans être dupliqués — ${qualite.parent} = ${qualite.direct} + ${qualite.rdc} + ${qualite.etage}`, 'ST-40');

  const attention = await ev(p, () => {
    /* On mesure un DELTA : la démonstration porte déjà ses propres points
       d'attention, et les compter en absolu ne prouverait rien. */
    const t = getStructureTasks('sn-keravel-rdc')[0];
    const avant = {
      rdc: getStructureIssues('sn-keravel-rdc').length,
      parent: getStructureIssues('sn-keravel-bat-a').length,
      autre: getStructureIssues('sn-keravel-ext').length,
    };
    app.issues.push({ id: 'iss-st-1', taskId: t.id, projectId: t.projectId, title: 'Test', status: 'open', severity: 'critical' });
    app.issues.push({ id: 'iss-st-2', taskId: t.id, projectId: t.projectId, title: 'Test 2', status: 'open', severity: 'info' });
    save();
    const apres = {
      rdc: getStructureIssues('sn-keravel-rdc').length,
      parent: getStructureIssues('sn-keravel-bat-a').length,
      autre: getStructureIssues('sn-keravel-ext').length,
    };
    const st = getStructureStatus('sn-keravel-bat-a');
    // Aucun moteur de risque parallèle : la source est app.issues.
    const src = document.documentElement.innerHTML;
    return { avant, apres, statut: st,
      deltaRdc: apres.rdc - avant.rdc,
      deltaParent: apres.parent - avant.parent,
      deltaAutre: apres.autre - avant.autre,
      pasDeMoteur: !/structureRiskStatus|structureAttentionStore|app\.structureRisks/.test(src) };
  });
  note('ST-41', attention);
  ok(attention.deltaRdc === 2 && attention.deltaParent === 2 && attention.deltaAutre === 0,
    `ST-41 : les points à traiter remontent du descendant au parent — +${attention.deltaRdc} sur le RDC, +${attention.deltaParent} sur Bâtiment A, +${attention.deltaAutre} sur le niveau voisin`, 'ST-41');
  ok(attention.statut.key === 'risk' && attention.pasDeMoteur,
    `ST-42 : le statut synthétique lit les vérités existantes (« ${attention.statut.label} ») — aucun moteur de risque parallèle`, 'ST-42');

  const archivage = await ev(p, () => {
    resetApp();
    const bloqueParent = structureArchiveBlocker('sn-keravel-bat-a'),
      bloqueFeuille = structureArchiveBlocker('sn-keravel-ext'),
      u0 = undoHistory.length;
    toggleStructureArchive('sn-keravel-ext');
    const ext = structureNode('sn-keravel-ext');
    const propose = structureParentOptions('keravel').map((o) => o.path);
    openTaskForm('keravel');
    const options = [...document.querySelectorAll('[name="structureNodeId"] option')].map((o) => o.textContent);
    closeOverlay('drawer');
    const tachesConservees = getStructureTasks('sn-keravel-ext').length;
    return { bloqueParent, bloqueFeuille, archive: ext.archived, undoDelta: undoHistory.length - u0,
      propose, options, tachesConservees };
  });
  note('ST-43', archivage);
  ok(!archivage.bloqueFeuille && archivage.archive && archivage.undoDelta === 1,
    'ST-43 : archiver un niveau SANS enfant actif est autorisé, en une transaction', 'ST-43');
  ok(/sous-niveaux/i.test(archivage.bloqueParent || ''),
    `ST-44 : archiver un niveau AVEC des sous-niveaux actifs est bloqué — « ${archivage.bloqueParent} »`, 'ST-44');
  ok(archivage.tachesConservees > 0,
    `ST-45 : les tâches d’un niveau archivé lui restent attachées (${archivage.tachesConservees})`, 'ST-45');
  ok(!archivage.propose.includes('Extérieurs') && !archivage.options.some((o) => o === 'Extérieurs'),
    'ST-46 : un niveau archivé disparaît des choix d’affectation de NOUVELLES tâches', 'ST-46');

  const suppression = await ev(p, () => {
    undo();
    app.structureNodes.push({ id: 'sn-vide', projectId: 'keravel', parentId: null, name: 'Vide', type: 'other', archived: false, createdAt: historyNow(), updatedAt: historyNow() });
    save();
    const vide = structureDeleteBlocker('sn-vide'),
      avecTaches = structureDeleteBlocker('sn-keravel-rdc'),
      avecEnfants = structureDeleteBlocker('sn-keravel-bat-a'),
      u0 = undoHistory.length;
    deleteStructureNode('sn-vide');
    const supprime = !structureNode('sn-vide');
    deleteStructureNode('sn-keravel-rdc');
    return { vide, avecTaches, avecEnfants, supprime, undoDelta: undoHistory.length - u0,
      rdcToujoursLa: !!structureNode('sn-keravel-rdc') };
  });
  note('ST-47', suppression);
  ok(suppression.vide === null && suppression.supprime && suppression.undoDelta === 1,
    'ST-47 : supprimer un niveau VIDE est autorisé, en une transaction', 'ST-47');
  ok(/intervention/i.test(suppression.avecTaches || '') && suppression.rdcToujoursLa,
    `ST-48 : supprimer un niveau qui porte des interventions est REFUSÉ — « ${suppression.avecTaches} »`, 'ST-48');
  ok(/sous-niveau/i.test(suppression.avecEnfants || ''),
    `ST-49 : supprimer un niveau qui a des sous-niveaux est REFUSÉ — « ${suppression.avecEnfants} »`, 'ST-49');
  await ctx.close();
}

// ============================================================
// ST-50 → ST-55 — Backup, restauration, import
// ============================================================
console.log('\n[ST-DONNEES] Backup, restauration, import');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });
  const bk = await ev(p, () => {
    const b13 = buildKanvixBackup();
    const v12 = structuredClone(b13);
    delete v12.state.structureNodes;
    v12.state.schemaVersion = 12;
    v12.state.tasks.forEach((t) => { delete t.structureNodeId; });
    const okV12 = validateKanvixBackup(v12), okV13 = validateKanvixBackup(b13);
    const r12 = migrateState(structuredClone(v12.state)),
      r13 = migrateState(structuredClone(b13.state));
    return {
      v13Noeuds: b13.state.structureNodes.length,
      v13Valide: okV13.ok, v12Valide: okV12.ok, v12Raison: okV12.reason || null,
      r13Noeuds: r13.structureNodes.length,
      r13Hierarchie: r13.structureNodes.map((n) => `${n.name}<${n.parentId ? structureNode(n.parentId)?.name || n.parentId : 'racine'}`),
      r13Taches: r13.tasks.filter((t) => t.structureNodeId).length,
      r12Noeuds: r12.structureNodes.length,
      r12Taches: r12.tasks.every((t) => t.structureNodeId === null),
      // La collection n'est PAS dans les clés obligatoires : c'est ce qui rend
      // une sauvegarde V12 restaurable.
      pasObligatoire: !KANVIX_BACKUP_REQUIRED.includes('structureNodes'),
    };
  });
  note('ST-50', bk);
  ok(bk.v13Valide && bk.v13Noeuds === 4,
    `ST-50 : une sauvegarde V13 embarque la structure (${bk.v13Noeuds} niveaux)`, 'ST-50');
  ok(bk.r13Noeuds === 4 && bk.r13Taches === 5,
    `ST-51 : la restauration V13 rend la hiérarchie intacte — ${bk.r13Hierarchie.join(', ')} — et les ${bk.r13Taches} rattachements de tâches`, 'ST-51');
  ok(bk.v12Valide && bk.r12Noeuds === 0 && bk.r12Taches && bk.pasObligatoire,
    'ST-52 : une sauvegarde V12 reste VALIDE et restaurable — structureNodes n’a pas été ajouté aux clés obligatoires', 'ST-52');

  const norm = await ev(p, () => {
    const v = structuredClone(app);
    v.tasks[0].structureNodeId = 'sn-nexistepas';
    v.structureNodes.push({ id: 'sn-bad', projectId: 'keravel', parentId: 'sn-fantome', name: 'Parent inconnu', type: 'zone' });
    v.structureNodes.push({ id: 'sn-x', projectId: 'inexistant', parentId: null, name: 'Chantier absent', type: 'zone' });
    const m = migrateState(structuredClone(v));
    const byId = Object.fromEntries(m.structureNodes.map((n) => [n.id, n]));
    return {
      tacheInconnue: m.tasks[0].structureNodeId,
      parentInconnu: byId['sn-bad']?.parentId,
      chantierAbsent: !byId['sn-x'],
      orphelins: m.tasks.filter((t) => t.structureNodeId && !byId[t.structureNodeId]).length,
    };
  });
  note('ST-53', norm);
  ok(norm.tacheInconnue === null && norm.orphelins === 0,
    'ST-53 : une référence de tâche vers un niveau inconnu est ramenée à null — jamais d’orpheline', 'ST-53');
  ok(norm.parentInconnu === null && norm.chantierAbsent,
    'ST-54 : un parent inconnu est normalisé à la racine, et un nœud dont le chantier n’existe pas est rejeté', 'ST-54');

  const remplacer = await ev(p, () => {
    const src = document.documentElement.innerHTML;
    return {
      videeDansReplaceAll: /plan\.replaceAll[\s\S]{0,2200}S\.structureNodes = \[\];/.test(src),
      videeParChantier: /op\.action === "replace"[\s\S]{0,900}S\.structureNodes = \(S\.structureNodes \|\| \[\]\)\.filter/.test(src),
      importSansStructure: /cleanTask[\s\S]{0,700}structureNodeId: null/.test(src),
    };
  });
  note('ST-55', remplacer);
  ok(remplacer.videeDansReplaceAll && remplacer.videeParChantier && remplacer.importSansStructure,
    'ST-55 : « Remplacer tous les chantiers » et « Remplacer un chantier » emportent la structure correspondante, et l’import portable n’installe jamais de référence de structure — aucun nœud orphelin', 'ST-55');
  await ctx.close();
}

// ============================================================
// ST-56 → ST-59 — Undo/Redo des mutations Structure
// ============================================================
console.log('\n[ST-UNDO] Une action = une transaction');
{
  const { ctx, p } = await newPage({ tag: 'UNDO' });
  const creation = await ev(p, () => {
    const u0 = undoHistory.length, n0 = app.structureNodes.length;
    openStructureForm('keravel');
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=name]').value = 'Bâtiment B';
    f.requestSubmit();
    const cree = app.structureNodes.find((x) => x.name === 'Bâtiment B');
    const apres = { n: app.structureNodes.length, undoDelta: undoHistory.length - u0 };
    undo();
    const u = { n: app.structureNodes.length, existe: app.structureNodes.some((x) => x.name === 'Bâtiment B') };
    redo();
    const r = { n: app.structureNodes.length, id: app.structureNodes.find((x) => x.name === 'Bâtiment B')?.id };
    return { n0, cree: cree?.id, apres, u, r };
  });
  note('ST-56', creation);
  ok(creation.apres.undoDelta === 1 && creation.apres.n === creation.n0 + 1,
    `ST-56 : créer un niveau est UNE transaction Undo (${creation.n0} → ${creation.apres.n})`, 'ST-56');
  ok(creation.u.n === creation.n0 && !creation.u.existe,
    'ST-56 : Undo supprime le niveau créé', 'ST-56');
  ok(creation.r.n === creation.n0 + 1 && creation.r.id === creation.cree,
    'ST-57 : Redo le restaure à l’identique', 'ST-57');

  const parent = await ev(p, () => {
    const cible = app.structureNodes.find((x) => x.name === 'Bâtiment B');
    const u0 = undoHistory.length;
    openStructureForm('keravel', 'sn-keravel-rdc');
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=parentId]').value = cible.id;
    f.requestSubmit();
    const apres = { parent: structureNode('sn-keravel-rdc').parentId, undoDelta: undoHistory.length - u0,
      hist: app.history[0]?.changes?.find((c) => c.field === 'Parent') };
    undo();
    const u = structureNode('sn-keravel-rdc').parentId;
    redo();
    return { cible: cible.id, apres, apresUndo: u, apresRedo: structureNode('sn-keravel-rdc').parentId };
  });
  note('ST-58', parent);
  ok(parent.apres.parent === parent.cible && parent.apres.undoDelta === 1,
    `ST-58 : changer de parent est UNE transaction, tracée (« ${parent.apres.hist?.from} → ${parent.apres.hist?.to} »)`, 'ST-58');
  ok(parent.apresUndo === 'sn-keravel-bat-a',
    'ST-58 : Undo restaure l’ancienne hiérarchie', 'ST-58');
  ok(parent.apresRedo === parent.cible,
    'ST-59 : Redo la rejoue', 'ST-59');

  const renom = await ev(p, () => {
    const u0 = undoHistory.length;
    openStructureForm('keravel', 'sn-keravel-rdc');
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=name]').value = 'Rez-de-chaussée';
    f.requestSubmit();
    const apres = structureNode('sn-keravel-rdc').name, d = undoHistory.length - u0;
    undo();
    const u = structureNode('sn-keravel-rdc').name;
    redo();
    return { apres, undoDelta: d, apresUndo: u, apresRedo: structureNode('sn-keravel-rdc').name };
  });
  note('ST-58bis', renom);
  ok(renom.apres === 'Rez-de-chaussée' && renom.undoDelta === 1 && renom.apresUndo === 'RDC' && renom.apresRedo === 'Rez-de-chaussée',
    'ST-58 : renommer est UNE transaction, annulable et rejouable', 'ST-58');

  const arch = await ev(p, () => {
    const u0 = undoHistory.length;
    toggleStructureArchive('sn-keravel-ext');
    const a = { archive: structureNode('sn-keravel-ext').archived, d: undoHistory.length - u0 };
    undo();
    const u = structureNode('sn-keravel-ext').archived;
    redo();
    return { ...a, apresUndo: u, apresRedo: structureNode('sn-keravel-ext').archived };
  });
  note('ST-59bis', arch);
  ok(arch.archive && arch.d === 1 && arch.apresUndo === false && arch.apresRedo === true,
    'ST-59 : archiver est UNE transaction, annulable et rejouable', 'ST-59');
  await ctx.close();
}

// ============================================================
// ST-60 → ST-63 — Niveaux Essentiel / Pilotage
// ============================================================
console.log('\n[ST-NIVEAUX] Essentiel et Pilotage');
{
  for (const [level, court] of [['essential', 'E'], ['pilot', 'P']]) {
    const { ctx, p } = await newPage({ tag: 'LVL-' + court, level });
    await ouvrirStructure(p);
    const r = await ev(p, () => ({
      niveau: app.settings.level,
      onglets: [...document.querySelectorAll('.tab')].map((t) => t.textContent),
      cartes: document.querySelectorAll('.sn-card, .snc-row[data-structure-node]').length,
      bouton: !!document.querySelector('.sn-top .btn.primary'),
    }));
    note('ST-6' + (court === 'E' ? '0' : '1'), r);
    ok(r.onglets.includes('Structure') && r.cartes === 4 && r.bouton,
      `ST-6${court === 'E' ? '0' : '1'} : en ${level === 'essential' ? 'Essentiel' : 'Pilotage'}, l’onglet Structure est présent et l’arbre complet (${r.cartes} niveaux)`, 'ST-6' + (court === 'E' ? '0' : '1'));
    const planning = await ev(p, () => {
      openStructureNode('sn-keravel-bat-a');
      app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; save();
      setStructureTab('Planning');
      return {
        creation: document.querySelectorAll('.g-create-row').length,
        draggables: document.querySelectorAll('.g-bar[draggable="true"]').length,
        analyse: document.querySelectorAll('.analysis-bar').length,
        legende: document.querySelectorAll('.plan-legend').length,
      };
    });
    note('ST-6' + (court === 'E' ? '2' : '3'), planning);
    if (level === 'essential') {
      ok(planning.creation > 0 && planning.draggables > 0,
        `ST-62 : en Essentiel, le Planning d’un niveau reste ÉDITABLE (${planning.creation} ligne de création, ${planning.draggables} barres draggables)`, 'ST-62');
      ok(planning.legende === 0,
        'ST-62 : et l’interface y reste simple — aucune légende d’analyse', 'ST-62');
      await shot(p, '12-essential-structure.png');
    } else {
      ok(planning.creation > 0 && planning.draggables > 0 && planning.legende === 1,
        `ST-63 : en Pilotage, le Planning d’un niveau conserve l’édition ET les outils d’analyse (légende : ${planning.legende})`, 'ST-63');
      await shot(p, '13-pilot-structure.png');
    }
    await ctx.close();
  }
}

// ============================================================
// ST-64 → ST-68 — Responsive et thème sombre
// ============================================================
console.log('\n[ST-RESPONSIVE] Dix largeurs, deux thèmes');
{
  const LARGEURS = [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390];
  const mesures = [];
  for (const w of LARGEURS) {
    for (const dark of [false, true]) {
      const { ctx, p } = await newPage({ w, h: Math.max(900, Math.round(w * 0.62)), tag: 'R' + w, dark });
      await ouvrirStructure(p);
      const r = await ev(p, () => ({
        cartes: document.querySelectorAll('.sn-card, .snc-row[data-structure-node]').length,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fondCarte: getComputedStyle(document.querySelector('.sn-card, .snc-block')).backgroundColor,
        // V2.9.1 — le nom d'un niveau vit dans `.snc-open b` et non plus dans
        // `.sn-head b`. On mesure la même chose : la couleur du nom affiché.
        lisible: getComputedStyle(document.querySelector('.sn-head b, .snc-open b')).color,
      }));
      mesures.push({ w, theme: dark ? 'sombre' : 'clair', ...r });
      await shot(p, `w${w}-${dark ? 'sombre' : 'clair'}-structure.png`);
      if (w === 1440 && dark) await shot(p, '03-structure-tree-dark.png');
      if (w === 1440 && !dark) await shot(p, '02-structure-tree-desktop.png');
      if (w === 768 && !dark) await shot(p, '16-tablet-structure.png');
      if (w === 390 && !dark) {
        await shot(p, '14-mobile-structure-list.png');
        await ev(p, () => openStructureNode('sn-keravel-bat-a'));
        await shot(p, '15-mobile-structure-node.png');
      }
      await ctx.close();
    }
  }
  note('ST-64', mesures.filter((m) => m.w <= 768));
  ok(mesures.every((m) => m.over <= 0),
    `ST-64 / ST-66 / ST-67 / ST-68 : aucune des dix largeurs × deux thèmes ne produit de défilement horizontal (768, 430 et 390 px compris)`, 'ST-64');
  const clair = mesures.find((m) => m.w === 1440 && m.theme === 'clair'),
    sombre = mesures.find((m) => m.w === 1440 && m.theme === 'sombre');
  note('ST-65', { clair, sombre });
  ok(clair.fondCarte !== sombre.fondCarte && sombre.cartes === clair.cartes,
    `ST-65 : le thème sombre applique bien ses jetons (${clair.fondCarte} → ${sombre.fondCarte}) sans rien perdre`, 'ST-65');
}

// ============================================================
// ST-71 → ST-74 — Non-régression des acquis récents
// ============================================================
console.log('\n[ST-NONREG] Undo/Redo, jours non ouvrés, démarrage réel, souris');
{
  const { ctx, p } = await newPage({ tag: 'NONREG', now: '2026-08-17T14:30:00' });
  const undoRedo = await ev(p, () => {
    app.settings.period = 'week'; save(); go('planning');
    const ctrl = document.querySelectorAll('[data-history]').length;
    snapshot(); task('k-cloisons').name = 'Renommée'; save(); actionToast('Tâche modifiée'); render();
    const u = undoHistory.length;
    undo();
    return { ctrl, u, restaure: task('k-cloisons').name, redo: redoHistory.length };
  });
  note('ST-71', undoRedo);
  ok(undoRedo.ctrl === 2 && undoRedo.u >= 1 && undoRedo.restaure === 'Cloisons étage 1',
    'ST-71 : l’Undo/Redo global de V2.8.4 est intact', 'ST-71');

  const nonOuvres = await ev(p, () => {
    resetApp(); app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; save(); go('planning');
    const samedi = isNonWorkingDate('2026-08-22'), ferie = publicHolidayName('2026-11-11');
    requestTaskScheduleMove('k-cloisons', '2026-08-22T08:00', 'planning-gantt');
    const m = { ouvert: document.querySelector('#modal').classList.contains('open'),
      jours: [...document.querySelectorAll('.cal-warn-days li')].map((l) => l.textContent) };
    cancelCalendarConfirm();
    return { samedi, ferie, m, colonnes: document.querySelectorAll('.g-slot.weekend').length };
  });
  note('ST-72', nonOuvres);
  ok(nonOuvres.samedi && nonOuvres.ferie === 'Armistice 1918' && nonOuvres.m.ouvert && nonOuvres.colonnes > 0,
    'ST-72 : les jours non ouvrés de V2.8.5.1 sont intacts — détection, confirmation et colonnes', 'ST-72');

  const demarrage = await ev(p, () => {
    resetApp();
    const t = task('k-cloisons');
    t.start = '2026-08-18T08:00'; t.end = '2026-08-18T12:00'; t.status = 'todo'; t.deps = [];
    save();
    setTaskStatus('k-cloisons', 'doing', 'task', { manual: true });
    const ouvert = document.querySelector('#modal').classList.contains('open');
    runCalendarConfirm();
    const a = task('k-cloisons');
    return { ouvert, start: a.start, duree: (date(a.end) - date(a.start)) / 3600000, statut: a.status,
      structure: a.structureNodeId };
  });
  note('ST-73', demarrage);
  ok(demarrage.ouvert && demarrage.start === '2026-08-17T14:30' && demarrage.duree === 4 && demarrage.structure === 'sn-keravel-etage-1',
    'ST-73 : le démarrage réel de V2.8.5.1 est intact — et il ne touche jamais à la structure de la tâche', 'ST-73');

  const souris = await ev(p, () => {
    resetApp(); app.settings.period = 'week'; save(); go('planning');
    return { lignes: document.querySelectorAll('.g-create-row').length,
      pistes: document.querySelectorAll('.g-create-track').length,
      draggables: document.querySelectorAll('.g-bar[draggable="true"]').length };
  });
  note('ST-74', souris);
  ok(souris.lignes > 0 && souris.pistes > 0 && souris.draggables > 0,
    `ST-74 : la création à la souris et le drag de V2.8.5/V2.8.5.2 sont intacts, en Essentiel (${souris.lignes} lignes, ${souris.draggables} barres)`, 'ST-74');
  await ctx.close();
}

// ============================================================
// Captures restantes
// ============================================================
console.log('\n[CAPTURES] États dédiés');
{
  const { ctx, p } = await newPage({ tag: 'SHOTS' });
  await ev(p, () => { app.ui.projectId = 'terrasses'; save(); go('project'); openProjectTab('terrasses', 'Structure'); });
  await shot(p, '01-structure-empty.png');
  await ev(p, () => openStructureForm('terrasses'));
  await shot(p, '04-create-structure-drawer.png');
  await ev(p, () => { closeOverlay('drawer'); openStructureForm('keravel', 'sn-keravel-bat-a'); });
  await shot(p, '05-edit-structure-drawer.png');
  await ev(p, () => { closeOverlay('drawer'); openStructureNode('sn-keravel-bat-a'); setStructureTab('Résumé'); });
  await shot(p, '06-structure-node-detail.png');
  await ev(p, () => setStructureTab('Ressources'));
  await shot(p, '08-structure-node-resources.png');
  await ev(p, () => { openTaskForm('keravel'); });
  await shot(p, '09-task-form-structure.png');
  await ev(p, () => { closeOverlay('drawer'); app.settings.period = 'week'; app.ui.periodAnchor = '2026-08-17T00:00'; app.ui.planningProject = 'keravel'; save(); go('planning'); });
  await shot(p, '10-global-planning-structured-tasks.png');
  await ev(p, () => { const o = app.operations[0]; selectOperation(o.id); setOperationTab('Planning'); });
  await shot(p, '11-operation-planning-structured-tasks.png');
  await ctx.close();
}

// ============================================================
// FREEZE-290 — Byte-identité et périmètre
// ============================================================
console.log('\n[FREEZE-290] Byte-identité');
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
  const A = read(PREV), B = read(CUR);
  const geles = [
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'actionToast', 'historyControls', 'refreshHistoryControls', 'cloneHistoryState',
    'restoreHistoryState', 'isTextEditingTarget', 'save', 'applyStorageSync', 'resetApp',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime',
    'addWorkingDuration', 'dropTask', 'dragStart', 'dragOver', 'requestGanttTaskMove',
    'requestTaskScheduleMove', 'drawDeps', 'effectiveTasks', 'pos', 'scale',
    'taskColorClass', 'taskEffectiveColorKey', 'lotChip', 'lotSelect', 'getProjectHealth',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'pendingControlsForTask',
    'controlsForTask', 'reconcileAfterTaskStatusChange', 'createRework', 'setTaskStatus',
    'milestoneStatus', 'isUpcomingMilestone', 'operationMilestonesTab',
    'operationActiveProjectIds', 'operationPlanningTab', 'operationMacroPlanning',
    'getResourceTasks', 'getResourceSchedulingConflicts', 'taskResourceIds',
    'buildKanvixBackup', 'analyzeKanvixImport', 'buildImportPlan',
    'renderField', 'easterSunday', 'frenchPublicHolidays', 'isWeekendDate',
    'publicHolidayName', 'isNonWorkingDate', 'nonWorkingDaysInRange', 'calendarConfirm',
    'realStartPlan', 'askRealStartConfirm', 'planningColumnFlags', 'planningColumnClass',
    'planningPeriodLabel', 'planningXToDate', 'planningCreateRange',
    'planningCreatePointerDown', 'planningCreatePointerMove', 'shiftPlanning',
    'planningToday', 'planningCanDrawCreate', 'planningIsReadOnly', 'getProjectTasks',
    'getUpcomingTasks', 'projectDocuments', 'projectPhotos', 'kanbanBoard', 'kanbanCard',
  ];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-290', { comparées: compares, bougés: bouges });
  ok(bouges.length === 0,
    `FREEZE-290 : les ${compares} moteurs de V2.8.5.2 sont BYTE-IDENTIQUES — Undo/Redo, propagation, déplacement, création à la souris, jours non ouvrés, démarrage réel, Qualité, Ressources, Jalons, Opérations, Backup et Mode Chantier`, 'FREEZE-290');

  const regles = {
    unSeulGantt: (B.match(/function gantt\(/g) || []).length === 1,
    unSeulPlanningTasks: (B.match(/function planningTasks\(/g) || []).length === 1,
    unSeulTaskResourceIds: (B.match(/function taskResourceIds\(/g) || []).length === 1,
    unSeulSetTaskStatus: (B.match(/function setTaskStatus\(/g) || []).length === 1,
    pasDeMoteurStructure:
      !/function\s+(structureGantt|structurePlanningTasks|structureResourcesEngine|structureRiskStatus|structureConflicts|renderStructurePlanning)\s*\(/.test(B),
    pasDeRisquePersiste: !/app\.structureRisks|structureRiskStore/.test(B),
    schema: /SCHEMA_VERSION = 14/.test(B),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    pasDansObligatoires: !/KANVIX_BACKUP_REQUIRED = \[[^\]]*structureNodes/.test(B),
  };
  note('FREEZE-290-règles', regles);
  ok(Object.values(regles).every(Boolean),
    'FREEZE-290 : un seul gantt(), un seul planningTasks(), un seul taskResourceIds(), un seul setTaskStatus() — aucun moteur Planning, Ressources ou Risque parallèle, SCHEMA passé à 14 (bump V2.11.0), STORE inchangé, structureNodes hors des clés obligatoires du backup', 'FREEZE-290');

  const ajoutees = ['structureNode', 'getProjectStructure', 'getStructureChildren',
    'getStructureRoots', 'getStructureDescendantIds', 'getStructureAncestors', 'structurePath',
    'getStructureTasks', 'getUnstructuredTasks', 'getStructureDates', 'getStructureProgress',
    'getStructureResources', 'getStructureIssues', 'getStructureControls',
    'getStructureMilestones', 'getStructureStatus', 'structureParentError',
    'structureParentOptions', 'openStructureForm', 'toggleStructureArchive',
    'confirmDeleteStructure', 'deleteStructureNode', 'openStructureNode',
    'projectStructureTab', 'renderStructureNode', 'structureTabContent', 'structureSelect',
    'planningStructureSelect'];
  const manquantes = ajoutees.filter((n) => !extractFn(B, n));
  note('FREEZE-290-ajouts', { ajoutées: ajoutees.length - manquantes.length, manquantes });
  ok(manquantes.length === 0,
    `FREEZE-290 : les ${ajoutees.length} fonctions ajoutées existent toutes et appartiennent au moteur ou aux vues Structure`, 'FREEZE-290');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `ST-75 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'ST-75');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
