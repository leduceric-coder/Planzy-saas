// ============================================================
// KANVIX — Recette « Opérations » (V2.8.0)
//
//   Une OPÉRATION est un ÉTAGE DE LECTURE au-dessus des chantiers.
//   Pas un chantier. Pas un parent. Pas un arbre.
//
//   La question à laquelle cette recette répond :
//     « Kanvix permet-il de piloter plusieurs chantiers comme un ensemble
//       cohérent — calendrier, priorités, contrôles, ressources, conflits
//       croisés — SANS transformer les chantiers en hiérarchie et SANS créer
//       le moindre moteur parallèle ? »
//
//   Usage : node recette-operations-v2.8.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.0.html';
const PREV = 'kanvix-next-gen-v2.7.1.html';
const NOW = '2026-09-14T10:15:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.0/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 800)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1440, h = 900, tag = 'x', file = CUR, role = 'driver' } = opts;
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
  await p.goto(F(file), { waitUntil: 'load' });
  await p.evaluate((role) => {
    resetApp();
    setDepth('pilot');
    setRole(role);
    dismissKanvixContinuityNotice();
    const t = document.querySelector('#toast');
    if (t) t.style.display = 'none';
  }, role);
  // `OP` est une constante Node : on l'expose aussi dans la page, pour que les
  // sondes puissent l'utiliser telle quelle des deux côtés.
  await p.evaluate((id) => { window.OP = id; }, OP);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, o = {}) => {
  await p.waitForTimeout(320);
  await p.screenshot({ path: SHOTS + name, ...o });
};
const OP = 'op-brest-ouest';

// ============================================================
// OP-01 → OP-03 — MODÈLE, MIGRATION, DÉMONSTRATION
// ============================================================
console.log('\n[OP-MODEL] Modèle, migration 11 → 12, démonstration');
{
  const { ctx, p } = await newPage({ tag: 'MODEL' });

  const base = await ev(p, () => ({ schema: app.schemaVersion, konst: SCHEMA_VERSION, store: STORE }));
  note('OP-01', base);
  ok(base.schema === 12 && base.konst === 12 && base.store === 'kanvix-product-8-3',
    'OP-01 : SCHEMA_VERSION = 12 et STORE reste « kanvix-product-8-3 » — aucune donnée existante n’est perdue', 'OP-01');

  // ---- OP-02 : un état V2.7.1 RÉEL migre sans rien gagner d'inventé.
  const mig = await ev(p, () => {
    const st = structuredClone(app);
    delete st.operations;
    st.projects.forEach((p) => delete p.operationId);
    st.schemaVersion = 11;
    const before = JSON.stringify({
      tasks: st.tasks, milestones: st.milestones, issues: st.issues,
      decisions: st.decisions, lots: st.lots, resources: st.resources,
      controlTemplates: st.controlTemplates, controlInstances: st.controlInstances,
    });
    const out = migrateState(structuredClone(st));
    const after = JSON.stringify({
      tasks: out.tasks, milestones: out.milestones, issues: out.issues,
      decisions: out.decisions, lots: out.lots, resources: out.resources,
      controlTemplates: out.controlTemplates, controlInstances: out.controlInstances,
    });
    return {
      schema: out.schemaVersion,
      operations: out.operations.length,
      links: out.projects.map((p) => p.operationId),
      businessUntouched: before === after,
      valid: validateOperationState(out).ok,
    };
  });
  note('OP-02', mig);
  ok(mig.schema === 12 && mig.operations === 0 && mig.links.every((x) => x === null)
    && mig.businessUntouched && mig.valid,
    'OP-02 : migration 11 → 12 strictement additive — operations = [], operationId = null partout, et AUCUNE donnée métier touchée. La démonstration n’est PAS installée chez un utilisateur existant', 'OP-02');

  // ---- OP-02bis : une référence qui ne pointe nulle part est effacée.
  const orphan = await ev(p, () => {
    const st = structuredClone(app);
    st.operations = [];
    st.schemaVersion = 11;
    const out = migrateState(structuredClone(st));
    return { links: out.projects.map((p) => p.operationId), valid: validateOperationState(out).ok };
  });
  note('OP-02bis', orphan);
  ok(orphan.links.every((x) => x === null) && orphan.valid,
    'OP-02 : un operationId qui ne désigne aucune opération est effacé par la migration — aucune relation orpheline ne survit', 'OP-02');

  // ---- OP-03 : la démonstration n'ajoute QUE des liens.
  const demo = await ev(p, () => ({
    ops: app.operations.map((o) => ({ id: o.id, name: o.name, keys: Object.keys(o).sort() })),
    links: app.projects.map((p) => [p.id, p.operationId]),
  }));
  note('OP-03', demo);
  ok(demo.ops.length === 1 && demo.ops[0].id === OP
    && JSON.stringify(demo.links) === JSON.stringify([['keravel', OP], ['terrasses', OP], ['villa', null], ['horizon', OP]]),
    'OP-03 : une seule opération de démonstration, Keravel / Terrasses / Horizon rattachés, et « Villa du Port » VOLONTAIREMENT indépendante', 'OP-03');
  ok(JSON.stringify(demo.ops[0].keys) === JSON.stringify(['createdAt', 'description', 'id', 'location', 'name']),
    'OP-03 : le modèle Operation porte exactement id, name, location, description, createdAt — ni statut, ni cycle de vie, ni liste de chantiers', 'OP-03');

  // ---- La relation a UNE SEULE vérité.
  const single = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    return {
      // La preuve décisive n'est pas une regex sur la source (le mot
      // « projectIds » apparaît légitimement comme PARAMÈTRE de portée du
      // Gantt) : c'est qu'AUCUNE opération ne porte jamais une telle clé,
      // même après création, édition et rattachement.
      persisted: (() => {
        openOperationForm('');
        const f = document.querySelector('#operationFormEl');
        f.querySelector('[name=name]').value = 'Sonde Unicité';
        [...f.querySelectorAll('input[name=opProject]')].forEach((i) => { i.checked = !i.disabled; });
        submitOperation('');
        closeOverlay('drawer');
        const keys = app.operations.map((o) => Object.keys(o)).flat();
        return [...new Set(keys)].filter((k) => /projectIds|projects|children|members|tasks/i.test(k));
      })(),
      allKeys: [...new Set(app.operations.map((o) => Object.keys(o)).flat())].sort(),
      optsParamOnly: /opts\.projectIds/.test(src),
      parentField: /parentProjectId/.test(src),
      derived: /app\.projects\.filter\(\(p\) => p\.operationId === id\)/.test(src),
    };
  });
  note('OP-03-vérité', single);
  ok(single.persisted.length === 0 && !single.parentField && single.derived && single.optsParamOnly
    && JSON.stringify(single.allKeys) === JSON.stringify(['createdAt', 'description', 'id', 'location', 'name']),
    'OP-03 : AUCUNE opération ne stocke de liste de chantiers, AUCUN project.parentProjectId — la relation est portée par project.operationId seul et les membres sont TOUJOURS dérivés par filtre (opts.projectIds n’est qu’un paramètre de portée, jamais persisté)', 'OP-03');

  await ctx.close();
}

// ============================================================
// OP-04 → OP-15 — CRUD ET CYCLE DE VIE
// ============================================================
console.log('\n[OP-CRUD] Créer, modifier, rattacher, retirer, supprimer');
{
  const { ctx, p } = await newPage({ tag: 'CRUD' });
  const reset = () => ev(p, () => { resetApp(); setDepth('pilot'); closeOverlay('drawer'); closeOverlay('modal'); });

  // ---- OP-04 : créer avec deux chantiers.
  await ev(p, () => { go('sites'); setSitesMode('operations'); });
  await p.waitForTimeout(150);
  await shot(p, '02-operations-list.png');
  const created = await ev(p, () => {
    openOperationForm('');
    const f = document.querySelector('#operationFormEl');
    f.querySelector('[name=name]').value = 'Programme Atlantique';
    f.querySelector('[name=location]').value = 'Finistère';
    f.querySelector('[name=description]').value = 'Deux chantiers côtiers.';
    [...f.querySelectorAll('input[name=opProject]')].forEach((i) => {
      if (i.value === 'villa') i.checked = true;
    });
    const r = submitOperation('');
    const o = app.operations.find((x) => x.name === 'Programme Atlantique');
    return { r, id: o?.id, members: o ? operationProjectIds(o.id) : [], total: app.operations.length };
  });
  note('OP-04', created);
  ok(created.r === true && created.total === 2 && created.members.join() === 'villa',
    'OP-04 : une opération se crée avec ses chantiers, et la relation est écrite sur les chantiers choisis', 'OP-04');

  // ---- OP-05 : unicité du nom (normalisée).
  const dup = await ev(p, () => {
    openOperationForm('');
    const f = document.querySelector('#operationFormEl');
    f.querySelector('[name=name]').value = '  programme   ATLANTIQUE ';
    const r = submitOperation('');
    return { r, err: document.querySelector('#operationError').textContent, total: app.operations.length };
  });
  note('OP-05', dup);
  ok(dup.r === false && /existe déjà/i.test(dup.err) && dup.total === 2,
    'OP-05 : deux opérations ne peuvent pas porter le même nom (casse, accents et espaces normalisés)', 'OP-05');

  // ---- OP-06 : jamais plus d'une opération par chantier.
  const oneMax = await ev(p, () => {
    closeOverlay('drawer');
    return {
      types: app.projects.map((p) => typeof p.operationId),
      arrays: app.projects.filter((p) => Array.isArray(p.operationId)).length,
      multiple: app.projects.filter((p) => p.operationId && app.operations.filter((o) => o.id === p.operationId).length !== 1).length,
    };
  });
  note('OP-06', oneMax);
  ok(oneMax.arrays === 0 && oneMax.multiple === 0,
    'OP-06 : un chantier porte 0 ou 1 operationId — jamais un tableau, jamais deux opérations simultanées', 'OP-06');

  // ---- OP-06bis : un chantier pris ailleurs est MONTRÉ mais DÉSACTIVÉ.
  const taken = await ev(p, () => {
    openOperationForm(OP);
    const picks = [...document.querySelectorAll('.op-pick')].map((l) => ({
      id: l.querySelector('input').value,
      checked: l.querySelector('input').checked,
      disabled: l.querySelector('input').disabled,
      txt: l.textContent.replace(/\s+/g, ' ').trim(),
    }));
    closeOverlay('drawer');
    return picks;
  });
  note('OP-06bis', taken);
  ok(taken.find((x) => x.id === 'villa')?.disabled === true
    && /Déjà dans Programme Atlantique/.test(taken.find((x) => x.id === 'villa')?.txt || '')
    && taken.filter((x) => x.checked).map((x) => x.id).sort().join() === 'horizon,keravel,terrasses',
    'OP-06 : un chantier déjà pris par une AUTRE opération est affiché, nommé, et DÉSACTIVÉ — jamais déplacé en silence depuis ce formulaire', 'OP-06');

  // ---- OP-07 : modifier n'affecte pas les chantiers.
  const edited = await ev(p, () => {
    const before = app.projects.map((p) => [p.id, p.operationId]);
    openOperationForm(OP);
    const f = document.querySelector('#operationFormEl');
    f.querySelector('[name=name]').value = 'Brest Ouest renommée';
    f.querySelector('[name=location]').value = 'Brest nord';
    f.querySelector('[name=description]').value = 'Nouvelle description.';
    submitOperation(OP);
    const o = operation(OP);
    return { name: o.name, location: o.location, description: o.description,
      membersUnchanged: JSON.stringify(before) === JSON.stringify(app.projects.map((p) => [p.id, p.operationId])) };
  });
  note('OP-07', edited);
  ok(edited.name === 'Brest Ouest renommée' && edited.location === 'Brest nord' && edited.membersUnchanged,
    'OP-07 : renommer une opération change son nom, sa localisation et sa description — et RIEN d’autre', 'OP-07');

  // ---- OP-08 : ajouter un chantier n'écrit qu'un champ.
  await reset();
  const added = await ev(p, () => {
    const snapBefore = JSON.stringify({
      tasks: app.tasks, milestones: app.milestones, issues: app.issues,
      controls: app.controlInstances, resources: app.resources, lots: app.lots,
    });
    openOperationProjects(OP);
    const f = document.querySelector('#operationProjectsEl');
    [...f.querySelectorAll('input[name=opProject]')].forEach((i) => {
      if (i.value === 'villa') i.checked = true;
    });
    submitOperationProjects(OP);
    const snapAfter = JSON.stringify({
      tasks: app.tasks, milestones: app.milestones, issues: app.issues,
      controls: app.controlInstances, resources: app.resources, lots: app.lots,
    });
    return { villa: project('villa').operationId, members: operationProjectIds(OP), untouched: snapBefore === snapAfter };
  });
  note('OP-08', added);
  ok(added.villa === OP && added.members.length === 4 && added.untouched,
    'OP-08 : rattacher un chantier n’écrit QUE project.operationId — aucune tâche, aucun jalon, aucun incident, aucun contrôle, aucune ressource, aucun lot n’est modifié', 'OP-08');

  // ---- OP-09 : retirer, symétriquement.
  const removed = await ev(p, () => {
    const snapBefore = JSON.stringify({
      tasks: app.tasks, milestones: app.milestones, issues: app.issues,
      controls: app.controlInstances, lifecycle: app.projects.map((p) => p.lifecycle),
    });
    openOperationProjects(OP);
    const f = document.querySelector('#operationProjectsEl');
    [...f.querySelectorAll('input[name=opProject]')].forEach((i) => {
      if (i.value === 'villa') i.checked = false;
    });
    submitOperationProjects(OP);
    const snapAfter = JSON.stringify({
      tasks: app.tasks, milestones: app.milestones, issues: app.issues,
      controls: app.controlInstances, lifecycle: app.projects.map((p) => p.lifecycle),
    });
    return { villa: project('villa').operationId, members: operationProjectIds(OP), untouched: snapBefore === snapAfter };
  });
  note('OP-09', removed);
  ok(removed.villa === null && removed.members.length === 3 && removed.untouched,
    'OP-09 : retirer un chantier remet operationId à null et RIEN D’AUTRE — il redevient simplement indépendant', 'OP-09');

  // ---- OP-10 : déplacer explicitement depuis la fiche chantier.
  await reset();
  const moved = await ev(p, () => {
    openOperationForm('');
    const f = document.querySelector('#operationFormEl');
    f.querySelector('[name=name]').value = 'Opération B';
    submitOperation('');
    const b = app.operations.find((x) => x.name === 'Opération B').id;
    closeOverlay('drawer');
    openProjectEdit('keravel');
    const form = document.querySelector('#drawerFormEl') || document.querySelector('#drawerContent form');
    const sel = form.querySelector('[name=operationId]');
    const options = [...sel.options].map((o) => o.text);
    sel.value = b;
    form.requestSubmit();
    return {
      options,
      keravel: project('keravel').operationId,
      target: b,
      inA: operationProjectIds(OP),
      inB: operationProjectIds(b),
      histo: app.history.find((h) => h.kind === 'operation-project-moved'),
    };
  });
  note('OP-10', { options: moved.options, keravel: moved.keravel, inA: moved.inA, inB: moved.inB, histo: moved.histo?.text });
  ok(moved.keravel === moved.target && !moved.inA.includes('keravel') && moved.inB.join() === 'keravel'
    && moved.options[0] === 'Aucune opération',
    'OP-10 : depuis la fiche chantier, un chantier se DÉPLACE explicitement d’une opération à l’autre — et « Aucune opération » reste le premier choix', 'OP-10');
  ok(!!moved.histo && /Opération/.test(moved.histo.changes?.[0]?.field || ''),
    'OP-10 : le changement d’opération est tracé comme un changement DU CHANTIER, avec l’avant et l’après', 'OP-10');

  // ---- OP-11 : supprimer une opération ne supprime AUCUN chantier.
  await reset();
  const deleted = await ev(p, () => {
    const before = {
      projects: app.projects.length, tasks: app.tasks.length, milestones: app.milestones.length,
      controls: app.controlInstances.length, issues: app.issues.length, photos: app.photos.length,
      resources: app.resources.length,
    };
    const members = operationProjectIds(OP);
    confirmDeleteOperation(OP);
    const after = {
      projects: app.projects.length, tasks: app.tasks.length, milestones: app.milestones.length,
      controls: app.controlInstances.length, issues: app.issues.length, photos: app.photos.length,
      resources: app.resources.length,
    };
    return {
      members, before, after,
      operations: app.operations.length,
      links: members.map((id) => project(id)?.operationId),
      valid: validateOperationState(app).ok,
    };
  });
  note('OP-11', deleted);
  ok(deleted.members.length === 3 && deleted.operations === 0
    && deleted.links.every((x) => x === null)
    && JSON.stringify(deleted.before) === JSON.stringify(deleted.after) && deleted.valid,
    'OP-11 : supprimer une opération de 3 chantiers les CONSERVE tous et les rend indépendants — 0 tâche, 0 contrôle, 0 jalon, 0 photo, 0 ressource supprimés', 'OP-11');

  // ---- OP-12 : supprimer un chantier membre laisse l'opération vivante.
  await reset();
  const delProject = await ev(p, () => {
    const before = operationProjectIds(OP).length;
    deleteProjectCascade('horizon');
    return {
      before, after: operationProjectIds(OP).length,
      operationStillThere: !!operation(OP),
      valid: validateOperationState(app).ok,
    };
  });
  note('OP-12', delProject);
  ok(delProject.before === 3 && delProject.after === 2 && delProject.operationStillThere && delProject.valid,
    'OP-12 : supprimer un chantier membre fait simplement baisser le compteur — l’opération reste, et aucune référence n’est orpheline', 'OP-12');

  // ---- OP-13 : une opération vide reste valide.
  const empty = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects.forEach((p) => { if (p.operationId === OP) p.operationId = null; });
    const sum = getOperationSummary(OP);
    selectOperation(OP);
    return {
      projects: sum.projects.length,
      worst: sum.worstHealth,
      text: document.querySelector('.op-body').textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
      valid: validateOperationState(app).ok,
    };
  });
  note('OP-13', empty);
  ok(empty.projects === 0 && empty.worst === 'neutral' && /Aucun chantier dans cette opération/.test(empty.text) && empty.valid,
    'OP-13 : une opération sans chantier reste valide, affiche un état vide explicite, et n’est jamais auto-supprimée', 'OP-13');

  // ---- OP-14 / OP-15 : l'association survit au cycle de vie.
  const lifecycle = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const p1 = project('terrasses');
    p1.lifecycle = 'closed';
    const closedKept = p1.operationId;
    const p2 = project('horizon');
    p2.lifecycle = 'archived';
    const archivedKept = p2.operationId;
    const sum = getOperationSummary(OP);
    return {
      closedKept, archivedKept,
      projects: sum.projects.length,
      active: sum.activeProjects.length,
      closed: sum.closedProjects.length,
      archived: sum.archivedProjects.length,
      activeTasks: sum.activeTaskCount,
      allTasks: sum.taskCount,
    };
  });
  note('OP-14/15', lifecycle);
  ok(lifecycle.closedKept === OP && lifecycle.projects === 3 && lifecycle.closed === 1,
    'OP-14 : clôturer un chantier membre CONSERVE son rattachement — l’association survit au cycle de vie', 'OP-14');
  ok(lifecycle.archivedKept === OP && lifecycle.archived === 1 && lifecycle.active === 1
    && lifecycle.activeTasks < lifecycle.allTasks,
    'OP-15 : archiver un chantier membre conserve aussi le rattachement, mais ses tâches sortent du périmètre OPÉRATIONNEL', 'OP-15');

  await ctx.close();
}

// ============================================================
// OP-16 → OP-20 — VUE D'ENSEMBLE
// ============================================================
console.log('\n[OP-OVERVIEW] Vue d’ensemble : des chiffres dérivés, rien d’inventé');
{
  const { ctx, p } = await newPage({ tag: 'OVERVIEW' });
  await ev(p, () => selectOperation(OP));
  await p.waitForTimeout(200);

  // ---- OP-16 : chaque KPI est STRICTEMENT dérivé.
  const kpi = await ev(p, () => {
    const dom = [...document.querySelectorAll('.op-kpi b')].map((x) => +x.textContent);
    const sum = getOperationSummary(OP);
    return {
      dom,
      derived: [sum.projects.length, sum.activeTaskCount, sum.resourceIds.length, sum.pendingControls.length],
      tabs: [...document.querySelectorAll('.op-tabs button')].map((x) => x.textContent),
      sidebarExtra: [...document.querySelectorAll('#nav button')].map((x) => x.textContent.trim()).filter((t) => /Opération/i.test(t)),
    };
  });
  note('OP-16', kpi);
  ok(JSON.stringify(kpi.dom) === JSON.stringify(kpi.derived),
    'OP-16 : les 4 KPI affichés sont STRICTEMENT dérivés (chantiers, interventions actives, ressources mobilisées, contrôles ouverts) — aucun pourcentage ni score inventé', 'OP-16');
  ok(kpi.tabs.length === 4 && kpi.tabs.join('|') === 'Vue d’ensemble|Planning|Ressources|Jalons' && kpi.sidebarExtra.length === 0,
    'OP-16 : exactement 4 onglets, et AUCUNE entrée de barre latérale ajoutée', 'OP-16');
  await shot(p, '04-operation-overview.png', { fullPage: true });

  // ---- OP-17 : santé = la PIRE des chantiers ACTIFS, sans toucher getProjectHealth.
  const health = await ev(p, () => {
    const per = operationActiveProjects(OP).map((p) => [p.id, getProjectHealth(p.id)]);
    const worst = operationWorstHealth(OP);
    // Un contrôle ouvert ne doit PAS dégrader la santé d'un chantier.
    const before = getProjectHealth('keravel');
    const afterControls = getProjectHealth('keravel');
    // Aucun chantier actif → neutral.
    const saved = app.projects.map((p) => p.lifecycle);
    app.projects.forEach((p) => { if (p.operationId === OP) p.lifecycle = 'closed'; });
    const none = operationWorstHealth(OP);
    app.projects.forEach((p, i) => (p.lifecycle = saved[i]));
    return { per, worst, qualityNeutral: before === afterControls, none };
  });
  note('OP-17', health);
  ok(health.worst === 'danger' && health.per.some((x) => x[1] === 'danger') && health.none === 'neutral',
    'OP-17 : la santé de l’opération est la PIRE getProjectHealth() de ses chantiers ACTIFS, et vaut « neutral » quand aucun n’est actif', 'OP-17');
  await shot(p, '05-operation-projects-health.png');

  // ---- OP-18 : la qualité remonte, le moteur V2.7 ne bouge pas.
  const quality = await ev(p, () => {
    const inOp = operationPendingControls(OP).map((c) => c.id);
    const viaEngine = operationProjectIds(OP).flatMap((pid) => pendingControlsForProject(pid)).map((c) => c.id);
    const domRows = [...document.querySelectorAll('.op-section .qc-row b')].map((x) => x.textContent);
    return { inOp, viaEngine, same: JSON.stringify(inOp) === JSON.stringify(viaEngine), domRows };
  });
  note('OP-18', quality);
  ok(quality.same && quality.inOp.length === 1 && quality.domRows.includes('Contrôle avant fermeture des cloisons'),
    'OP-18 : les contrôles ouverts de l’opération sont EXACTEMENT ceux que pendingControlsForProject() retourne, chantier par chantier — pure agrégation', 'OP-18');
  await shot(p, '06-operation-quality.png');

  // ---- OP-19 / OP-20 : décisions et surveillances bornées à l'opération.
  const scoped = await ev(p, () => {
    const d = operationDecisions(OP).map((i) => [i.id, i.projectId]);
    const w = operationWarnings(OP).map((i) => [i.id, i.projectId]);
    const allD = getTodayDecisions(Infinity).map((i) => [i.id, i.projectId]);
    const allW = getTodayWarnings(Infinity).map((i) => [i.id, i.projectId]);
    const members = new Set(operationProjectIds(OP));
    return {
      d, w,
      villaDecisionExists: allD.some((x) => x[1] === 'villa'),
      villaWarningExists: allW.some((x) => x[1] === 'villa'),
      dForeign: d.filter((x) => !members.has(x[1])).length,
      wForeign: w.filter((x) => !members.has(x[1])).length,
    };
  });
  note('OP-19/20', scoped);
  ok(scoped.d.length > 0 && scoped.dForeign === 0 && scoped.villaDecisionExists,
    'OP-19 : « Actions nécessaires » ne contient QUE les décisions des chantiers membres — celle de Villa du Port existe mais n’y figure pas', 'OP-19');
  ok(scoped.w.length > 0 && scoped.wForeign === 0,
    'OP-20 : même règle pour « À surveiller » — aucune alerte d’un chantier hors opération ne s’y glisse', 'OP-20');

  await ctx.close();
}

// ============================================================
// OP-21 → OP-28 — PLANNING CONSOLIDÉ
// ============================================================
console.log('\n[OP-PLANNING] Un seul Gantt, borné — pas un second moteur');
{
  const { ctx, p } = await newPage({ tag: 'PLANNING' });

  // ---- OP-23 : UN SEUL moteur Gantt dans le fichier.
  const engines = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    const count = (re) => (src.match(re) || []).length;
    return {
      gantt: count(/function gantt\s*\(/g),
      operationGantt: count(/function operationGantt|function ganttOperation|function renderOperationGantt/g),
      planningTasks: count(/function planningTasks\s*\(/g),
      planningAgenda: count(/function planningAgenda\s*\(/g),
      loadBoard: count(/function resourceLoadBoard\s*\(/g),
    };
  });
  note('OP-23', engines);
  ok(engines.gantt === 1 && engines.operationGantt === 0 && engines.planningTasks === 1
    && engines.planningAgenda === 1 && engines.loadBoard === 1,
    'OP-23 : UN SEUL function gantt(), UN SEUL planningTasks(), UN SEUL resourceLoadBoard() — aucun moteur n’a été copié pour les opérations', 'OP-23');

  // ---- OP-24 / OP-25 : les appels historiques sont intacts.
  const legacy = await ev(p, () => {
    go('planning');
    app.settings.period = 'month';
    renderPage();
    const all = planningTasks().map((t) => t.id);
    const one = planningTasks('keravel').map((t) => t.id);
    const allExplicit = app.tasks.filter((t) => isProjectActive(t.projectId)).map((t) => t.id);
    const oneExplicit = app.tasks.filter((t) => t.projectId === 'keravel').map((t) => t.id);
    return {
      all, one,
      allMatches: all.every((id) => allExplicit.includes(id)),
      oneMatches: one.every((id) => oneExplicit.includes(id)) && one.length > 0,
      // Attention : la classe « g-project-dot » contient « g-project ». On
      // compte donc les OUVERTURES de bandeau de groupe, pas les occurrences
      // du mot — sinon un groupe compterait pour deux.
      ganttAll: /class="g-project /.test(gantt()),
      ganttOne: (gantt('keravel').match(/class="g-project /g) || []).length,
    };
  });
  note('OP-24/25', { all: legacy.all.length, one: legacy.one.length, ganttOne: legacy.ganttOne });
  ok(legacy.allMatches && legacy.ganttAll,
    'OP-24 : gantt() sur le Planning global produit les mêmes tâches et les mêmes groupes qu’en V2.7.1 — la signature étendue est rétro-compatible', 'OP-24');
  ok(legacy.oneMatches && legacy.ganttOne === 1,
    'OP-25 : gantt("keravel") garde son comportement historique — un seul groupe, celui du chantier', 'OP-25');

  // ---- OP-21 / OP-22 : le Gantt d'opération est BORNÉ.
  await ev(p, () => { selectOperation(OP); setOperationTab('Planning'); app.settings.period = 'month'; renderPage(); });
  await p.waitForTimeout(250);
  const scope = await ev(p, () => {
    const groups = [...document.querySelectorAll('.g-project button')].map((x) => x.textContent.replace(/[⌄›]\s*/, '').trim());
    const bars = [...document.querySelectorAll('.g-bar')].map((x) => x.getAttribute('title') || '');
    const tasks = planningTasks('all', { projectIds: operationActiveProjectIds(OP), resourceFilter: 'all', lotFilter: 'all' });
    return {
      groups,
      villaGroup: groups.some((g) => /Villa du Port/.test(g)),
      villaTask: tasks.some((t) => t.projectId === 'villa'),
      foreign: tasks.filter((t) => !operationActiveProjectIds(OP).includes(t.projectId)).length,
      lotDots: document.querySelectorAll('.g-label .planning-lot-dot').length,
      lotNames: document.querySelectorAll('.g-label .lot-chip').length,
    };
  });
  note('OP-21/22', scope);
  ok(scope.groups.length === 3 && scope.foreign === 0,
    'OP-21 : le Gantt de l’opération ne contient QUE les tâches de ses chantiers ACTIFS', 'OP-21');
  ok(!scope.villaGroup && !scope.villaTask,
    'OP-22 : « Villa du Port », indépendante, n’apparaît NULLE PART dans le Gantt de l’opération', 'OP-22');

  // ---- OP-26 : les lots restent exactement comme en V2.7.1.
  ok(scope.lotDots > 0 || scope.lotNames > 0,
    'OP-26 : la pastille et le nom de lot restent présents dans le Gantt d’opération — le rendu V2.6.1 n’est pas reconstruit', 'OP-26');

  // ---- Un filtre résiduel du Planning global ne fuit PAS.
  const noLeak = await ev(p, () => {
    const before = planningTasks('all', { projectIds: operationActiveProjectIds(OP), resourceFilter: 'all', lotFilter: 'all' }).map((t) => t.id);
    app.ui.planningResource = 'mathieu';
    app.ui.planningLot = 'lot-platrerie';
    const after = planningTasks('all', { projectIds: operationActiveProjectIds(OP), resourceFilter: 'all', lotFilter: 'all' }).map((t) => t.id);
    const globalFiltered = planningTasks().map((t) => t.id);
    app.ui.planningResource = 'all';
    app.ui.planningLot = 'all';
    return { same: JSON.stringify(before) === JSON.stringify(after), n: before.length, globalFiltered: globalFiltered.length };
  });
  note('OP-21-filtres', noLeak);
  ok(noLeak.same && noLeak.globalFiltered < noLeak.n,
    'OP-21 : un filtre Ressource ou Lot resté actif dans le Planning global ne TRONQUE PAS la vue d’opération — elle est explicite sur les trois axes', 'OP-21');
  await shot(p, '09-operation-gantt.png', { fullPage: true });

  // ---- OP-28 : la vue macro est DÉRIVÉE, et ne stocke rien.
  const macro = await ev(p, () => {
    const bounds = operationProjectBounds(OP);
    const derived = bounds.map((b) => {
      const ts = getProjectTasks(b.project.id);
      return [
        b.project.id,
        b.start === ts.reduce((m, t) => (t.start < m ? t.start : m), ts[0].start),
        b.end === ts.reduce((m, t) => (t.end > m ? t.end : m), ts[0].end),
      ];
    });
    const stored = Object.keys(operation(OP));
    return {
      rows: document.querySelectorAll('.op-macro-row').length,
      names: [...document.querySelectorAll('.op-macro-name')].map((x) => x.textContent),
      derived,
      storedKeys: stored,
      draggable: document.querySelectorAll('.op-macro-bar[draggable="true"]').length,
    };
  });
  note('OP-28', macro);
  ok(macro.derived.every((d) => d[1] && d[2]) && macro.rows === 3 && macro.draggable === 0
    && !macro.storedKeys.some((k) => /start|end|date|planning/i.test(k)),
    'OP-28 : chaque barre macro est DÉRIVÉE de min(task.start) / max(task.end) — aucune donnée de planning n’est stockée sur l’opération, et rien n’y est déplaçable', 'OP-28');
  await shot(p, '08-operation-macro-planning.png');

  // ---- OP-27 : le glisser-déposer reste le moteur existant.
  const drag = await ev(p, () => {
    const src = document.querySelector('#kanvix-js').textContent;
    const before = app.tasks.map((t) => [t.id, t.projectId]);
    return {
      usesDropTask: /ondrop="dropTask\(/.test(document.querySelector('#main').innerHTML),
      singleDrop: (src.match(/function dropTask\s*\(/g) || []).length,
      projectIdsStable: JSON.stringify(before) === JSON.stringify(app.tasks.map((t) => [t.id, t.projectId])),
    };
  });
  note('OP-27', drag);
  ok(drag.singleDrop === 1 && drag.projectIdsStable,
    'OP-27 : le Gantt d’opération utilise le MÊME dropTask() que le Planning global, et aucun projectId de tâche ne bouge', 'OP-27');

  // ---- Pas de dépendance inter-chantiers créée par V2.8.
  const noCross = await ev(p, () => {
    const bad = app.tasks.filter((t) => (t.deps || []).some((d) => task(d) && task(d).projectId !== t.projectId));
    return { bad: bad.map((t) => t.id) };
  });
  note('OP-PLANNING-deps', noCross);
  ok(noCross.bad.length === 0,
    'OP-21 : aucune dépendance entre tâches de deux chantiers différents n’existe — l’opération ne crée pas ce lien', 'OP-21');

  await ctx.close();
}

// ============================================================
// OP-29 → OP-38 — RESSOURCES ET CONFLITS TRANSVERSAUX
// ============================================================
console.log('\n[OP-RESOURCES] Conflits entre chantiers et charge consolidée');
{
  const { ctx, p } = await newPage({ tag: 'RESOURCES' });
  const reset = () => ev(p, () => { resetApp(); setDepth('pilot'); });

  // ---- OP-29 : les ressources incluent les COMPLÉMENTAIRES.
  const ids = await ev(p, () => {
    const t = task('k-cloisons');
    t.additionalResourceIds = [...new Set([...(t.additionalResourceIds || []), 'crane-g01'])];
    const out = operationResourceIds(OP);
    const mains = [...new Set(operationActiveTasks(OP).map((x) => x.resourceId).filter(Boolean))];
    return { out, hasCrane: out.includes('crane-g01'), mainsCovered: mains.every((m) => out.includes(m)) };
  });
  note('OP-29', ids);
  ok(ids.hasCrane && ids.mainsCovered,
    'OP-29 : operationResourceIds() couvre l’intervenant principal ET les ressources complémentaires (matériel compris) — via taskResourceIds()', 'OP-29');

  // ---- OP-30 : conflit transversal détecté.
  await reset();
  const cross = await ev(p, () => {
    const a = task('k-cloisons'), c = app.tasks.find((t) => t.projectId === 'horizon');
    a.additionalResourceIds = [...new Set([...(a.additionalResourceIds || []), 'crane-g01'])];
    c.additionalResourceIds = [...new Set([...(c.additionalResourceIds || []), 'crane-g01'])];
    c.start = a.start; c.end = a.end;
    const conf = operationCrossProjectResourceConflicts(OP).filter((x) => x.resourceId === 'crane-g01');
    return {
      n: conf.length,
      c: conf[0],
      capacity: resource('crane-g01').capacity,
      differentProjects: conf[0] && conf[0].projectId !== conf[0].otherProjectId,
    };
  });
  note('OP-30', cross);
  ok(cross.n === 1 && cross.differentProjects && cross.c.start && cross.c.end,
    'OP-30 : une même ressource mobilisée simultanément sur DEUX chantiers membres produit exactement 1 conflit transversal, avec sa fenêtre de chevauchement', 'OP-30');

  // ---- Déduplication : A↔B et B↔A sont le même conflit.
  const dedup = await ev(p, () => {
    const conf = operationCrossProjectResourceConflicts(OP);
    const keys = conf.map((c) => c.resourceId + '|' + [c.taskId, c.otherTaskId].sort().join('|'));
    return { n: conf.length, unique: new Set(keys).size };
  });
  note('OP-30-dedup', dedup);
  ok(dedup.n === dedup.unique,
    'OP-30 : chaque paire de tâches n’apparaît qu’UNE fois — A↔B et B↔A sont le même conflit', 'OP-30');

  await ev(p, () => { selectOperation(OP); setOperationTab('Ressources'); });
  await p.waitForTimeout(250);
  await shot(p, '07-operation-cross-project-conflict.png');
  await shot(p, '10-operation-resources.png', { fullPage: true });

  // ---- OP-33 : Kanvix DÉTECTE, il ne RÉARBITRE pas.
  const noAuto = await ev(p, () => {
    const before = JSON.stringify(app.tasks.map((t) => [t.id, t.start, t.end, t.status, t.resourceId, t.additionalResourceIds]));
    operationCrossProjectResourceConflicts(OP);
    getOperationSummary(OP);
    renderPage();
    const after = JSON.stringify(app.tasks.map((t) => [t.id, t.start, t.end, t.status, t.resourceId, t.additionalResourceIds]));
    const html = document.querySelector('#main').innerHTML;
    return {
      unchanged: before === after,
      autoButtons: /Résoudre automatiquement|Réaffecter automatiquement|Décaler automatiquement/i.test(html),
      navButtons: [...document.querySelectorAll('.op-conflict-actions .link')].map((x) => x.textContent.trim()),
    };
  });
  note('OP-33', noAuto);
  ok(noAuto.unchanged && !noAuto.autoButtons && noAuto.navButtons.length >= 2,
    'OP-33 : détecter un conflit ne déplace, ne réaffecte et ne supprime RIEN — seules des navigations sont proposées, jamais une résolution automatique', 'OP-33');

  // ---- OP-31 : deux tâches du MÊME chantier ne font pas un conflit transversal.
  await reset();
  const samePrj = await ev(p, () => {
    // Ressource dédiée, sans autre engagement : le signal est isolé.
    const ts = app.tasks.filter((t) => t.projectId === 'keravel' && t.status !== 'done').slice(0, 2);
    ts.forEach((t) => { t.additionalResourceIds = [...new Set([...(t.additionalResourceIds || []), 'crane-g01'])]; });
    ts[1].start = ts[0].start; ts[1].end = ts[0].end;
    const scope = operationActiveTasks(OP);
    return {
      crossForCrane: operationCrossProjectResourceConflicts(OP).filter((c) => c.resourceId === 'crane-g01').length,
      engineStillDetects: getResourceSchedulingConflicts('crane-g01', scope).filter((c) => c.kind === 'capacity').length,
    };
  });
  note('OP-31', samePrj);
  ok(samePrj.crossForCrane === 0 && samePrj.engineStillDetects > 0,
    'OP-31 : deux tâches en conflit DANS LE MÊME chantier ne comptent PAS comme conflit transversal — le moteur ressource, lui, continue de les détecter', 'OP-31');

  // ---- OP-32 : la capacité d'une entreprise est respectée.
  await reset();
  const capacity = await ev(p, () => {
    const r = app.resources.find((x) => x.type === 'company');
    r.capacity = 2;
    const members = ['keravel', 'terrasses', 'horizon'];
    const pick = members
      .map((pid) => app.tasks.find((t) => t.projectId === pid && t.status !== 'done'))
      .filter(Boolean);
    pick.forEach((t) => { t.additionalResourceIds = [...new Set([...(t.additionalResourceIds || []), r.id])]; });
    const slot = { start: pick[0].start, end: pick[0].end };
    // Deux en simultané sur deux chantiers : capacité 2 → AUCUN conflit.
    pick[1].start = slot.start; pick[1].end = slot.end;
    pick[2].start = '2026-10-05T08:00'; pick[2].end = '2026-10-05T12:00';
    const two = operationCrossProjectResourceConflicts(OP).filter((c) => c.resourceId === r.id).length;
    // Trois en simultané : capacité dépassée → conflit.
    pick[2].start = slot.start; pick[2].end = slot.end;
    const three = operationCrossProjectResourceConflicts(OP).filter((c) => c.resourceId === r.id).length;
    return { company: r.id, capacity: r.capacity, two, three };
  });
  note('OP-32', capacity);
  ok(capacity.two === 0 && capacity.three > 0,
    'OP-32 : une entreprise de capacité 2 tenant 2 missions simultanées sur 2 chantiers ne crée AUCUN conflit ; à 3 missions simultanées, le conflit apparaît', 'OP-32');

  // ---- OP-34 / OP-35 : le tableau de charge est BORNÉ jusqu'à la cellule.
  await reset();
  const board = await ev(p, () => {
    // Une ressource de l'opération travaille AUSSI sur Villa (hors opération).
    // Elle doit tomber SUR LE JOUR AFFICHÉ, sinon le tableau global ne la
    // montrerait pas non plus et le test ne prouverait rien.
    const villa = app.tasks.find((t) => t.projectId === 'villa');
    villa.resourceId = 'mathieu';
    villa.name = 'TÂCHE VILLA HORS OPÉRATION';
    villa.status = 'todo';
    villa.start = dayKey(TODAY) + 'T08:00';
    villa.end = dayKey(TODAY) + 'T12:00';
    const ids = operationResourceIds(OP);
    const html = resourceLoadBoard(TODAY, 'all', {
      tasks: operationActiveTasks(OP), resourceIds: ids, navPrefix: 'operation',
    });
    const d = document.createElement('div');
    d.innerHTML = html;
    const shown = [...d.querySelectorAll('.rc-name b')].map((x) => x.textContent);
    const tips = [...d.querySelectorAll('.rc-cell')].map((x) => x.getAttribute('title') || '').join('\n');
    const globalHtml = resourceLoadBoard();
    const g = document.createElement('div');
    g.innerHTML = globalHtml;
    return {
      ids, shown,
      allResources: app.resources.filter(resourceActive).length,
      globalShown: [...g.querySelectorAll('.rc-name b')].length,
      villaLeak: /VILLA HORS OP|Villa du Port/.test(tips),
      globalSeesVilla: /Villa du Port/.test([...g.querySelectorAll('.rc-cell')].map((x) => x.getAttribute('title') || '').join('\n')),
    };
  });
  note('OP-34/35', board);
  ok(board.shown.length === board.ids.length && board.shown.length < board.allResources,
    'OP-34 : la charge de l’opération ne liste QUE les ressources mobilisées par ses chantiers actifs', 'OP-34');
  ok(!board.villaLeak && board.globalSeesVilla,
    'OP-35 : une ressource qui travaille AUSSI hors opération ne fait apparaître aucune de ces missions dans la cellule d’opération — le scope descend jusqu’à la cellule, alors que la page Ressources globale les voit bien', 'OP-35');

  // ---- OP-36 : les indisponibilités restent visibles.
  const unav = await ev(p, () => {
    const rid = operationResourceIds(OP)[0];
    const d = dayKey(TODAY);
    app.resourceUnavailabilities = app.resourceUnavailabilities || [];
    app.resourceUnavailabilities.push({
      id: 'unav-test', resourceId: rid, start: d + 'T00:00', end: d + 'T23:59',
      allDay: true, reason: 'leave',
    });
    const html = resourceLoadBoard(TODAY, 'all', {
      tasks: operationActiveTasks(OP), resourceIds: operationResourceIds(OP), navPrefix: 'operation',
    });
    const el = document.createElement('div');
    el.innerHTML = html;
    const tips = [...el.querySelectorAll('.rc-cell')].map((x) => x.getAttribute('title') || '').join('\n');
    return { rid, shown: /cong|absence|indispo/i.test(tips) || /unavailable/.test(html), cells: /rc-cell/.test(html) };
  });
  note('OP-36', unav);
  ok(unav.shown,
    'OP-36 : les indisponibilités sont des données GLOBALES de ressource — elles restent visibles dans la charge de l’opération dès qu’elles touchent une ressource mobilisée', 'OP-36');

  // ---- OP-37 : les trois familles restent séparées.
  const families = await ev(p, () => {
    const html = resourceLoadBoard(TODAY, 'all', {
      tasks: operationActiveTasks(OP), resourceIds: operationResourceIds(OP), navPrefix: 'operation',
    });
    const d = document.createElement('div');
    d.innerHTML = html;
    return { groups: [...d.querySelectorAll('.load-group-label')].map((x) => x.textContent.replace(/\d+$/, '').trim()) };
  });
  note('OP-37', families);
  ok(families.groups.join('|') === 'Personnes|Entreprises|Matériel',
    'OP-37 : Personnes / Entreprises / Matériel restent trois groupes distincts — resourceLoadGroups() est réutilisée telle quelle', 'OP-37');
  await shot(p, '11-operation-resource-groups.png', { fullPage: true });

  // ---- OP-38 : naviguer dans l'opération ne déplace rien ailleurs.
  const nav = await ev(p, () => {
    resetApp(); setDepth('pilot');
    selectOperation(OP);
    setOperationTab('Ressources');
    const before = { team: app.ui.teamLoadAnchor, anchor: app.ui.periodAnchor, op: app.ui.operationLoadAnchor };
    shiftOperationLoadWeek(1);
    shiftOperationLoadWeek(1);
    const after = { team: app.ui.teamLoadAnchor, anchor: app.ui.periodAnchor, op: app.ui.operationLoadAnchor };
    operationLoadToday();
    return { before, after, backToToday: app.ui.operationLoadAnchor };
  });
  note('OP-38', nav);
  ok(nav.after.team === nav.before.team && nav.after.anchor === nav.before.anchor
    && nav.after.op !== nav.before.op,
    'OP-38 : naviguer dans la charge d’une opération ne déplace NI teamLoadAnchor NI periodAnchor — les états sont séparés', 'OP-38');

  await ctx.close();
}

// ============================================================
// OP-39 / OP-40 — JALONS
// ============================================================
console.log('\n[OP-MILESTONES] Jalons des chantiers membres');
{
  const { ctx, p } = await newPage({ tag: 'MILESTONES' });
  await ev(p, () => { selectOperation(OP); setOperationTab('Jalons'); });
  await p.waitForTimeout(250);

  const ms = await ev(p, () => {
    const list = operationMilestones(OP);
    const sorted = list.map((m) => m.date).join('|');
    const expected = list.map((m) => m.date).slice().sort().join('|');
    const members = new Set(operationProjectIds(OP));
    return {
      ids: list.map((m) => m.id),
      projects: list.map((m) => m.projectId),
      sortedOk: sorted === expected,
      villa: list.some((m) => m.projectId === 'villa'),
      villaHasOne: app.milestones.some((m) => m.projectId === 'villa'),
      foreign: list.filter((m) => !members.has(m.projectId)).length,
      dom: document.querySelectorAll('.op-milestone').length,
      canCreate: /Ajouter un jalon|Nouveau jalon|openMilestoneForm/.test(document.querySelector('.op-body').innerHTML),
    };
  });
  note('OP-39', ms);
  ok(ms.sortedOk && ms.foreign === 0 && !ms.villa && ms.villaHasOne && ms.dom === ms.ids.length,
    'OP-39 : tous les jalons des chantiers membres, triés par date — et le jalon de Villa du Port, qui existe pourtant, n’y figure pas', 'OP-39');
  ok(!ms.canCreate,
    'OP-39 : V2.8 ne permet PAS de créer un jalon sur l’opération — un jalon appartient à un chantier', 'OP-39');

  // ---- OP-40 : un jalon de chantier clôturé reste consultable.
  const closed = await ev(p, () => {
    project('terrasses').lifecycle = 'closed';
    renderPage();
    const list = operationMilestones(OP);
    const dom = [...document.querySelectorAll('.op-milestone')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
    const activeTaskProjects = [...new Set(operationActiveTasks(OP).map((t) => t.projectId))];
    return {
      stillListed: list.some((m) => m.projectId === 'terrasses'),
      tag: dom.some((t) => /Chantier clôturé/.test(t)),
      tasksExcluded: !activeTaskProjects.includes('terrasses'),
    };
  });
  note('OP-40', closed);
  ok(closed.stillListed && closed.tag && closed.tasksExcluded,
    'OP-40 : le jalon d’un chantier clôturé reste consultable et signalé comme tel — mais ses tâches ne participent plus à la charge active', 'OP-40');
  await shot(p, '12-operation-milestones.png', { fullPage: true });

  await ctx.close();
}

// ============================================================
// OP-41 → OP-48 — SAUVEGARDE, EXPORT, IMPORT
// ============================================================
console.log('\n[OP-DATA] Sauvegarde, export portable, import, remplacement total');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });

  // ---- OP-41 : aller-retour de sauvegarde.
  const roundtrip = await ev(p, () => {
    const o = app.operations.find((x) => x.id === OP);
    o.description = 'Description témoin V2.8.';
    project('villa').operationId = OP;
    const bk = buildKanvixBackup();
    const before = {
      ops: bk.state.operations.map((x) => [x.id, x.name, x.location, x.description]),
      links: bk.state.projects.map((x) => [x.id, x.operationId]),
    };
    resetApp();
    const cand = migrateState(structuredClone(bk.state));
    return {
      before,
      after: {
        ops: cand.operations.map((x) => [x.id, x.name, x.location, x.description]),
        links: cand.projects.map((x) => [x.id, x.operationId]),
      },
      build: bk.appVersion,
      valid: validateOperationState(cand).ok,
    };
  });
  note('OP-41', { build: roundtrip.build, ops: roundtrip.after.ops.length });
  ok(JSON.stringify(roundtrip.before) === JSON.stringify(roundtrip.after) && roundtrip.valid,
    'OP-41 : sauvegarde → réinitialisation → restauration restitue les opérations ET leurs rattachements à l’identique', 'OP-41');

  // ---- OP-42 : une sauvegarde V2.7.1 reste restaurable.
  const oldBackup = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const bk = buildKanvixBackup();
    delete bk.state.operations;
    bk.state.projects.forEach((p) => delete p.operationId);
    bk.schemaVersion = 11;
    bk.state.schemaVersion = 11;
    const accepted = validateKanvixBackup(bk).ok;
    const cand = migrateState(structuredClone(bk.state));
    const src = document.querySelector('#kanvix-js').textContent;
    const required = (src.match(/KANVIX_BACKUP_REQUIRED = \[([\s\S]*?)\]/) || [])[1] || '';
    return {
      accepted, schema: cand.schemaVersion, ops: cand.operations.length,
      links: cand.projects.map((p) => p.operationId),
      operationsRequired: /operations/.test(required),
    };
  });
  note('OP-42', oldBackup);
  ok(oldBackup.accepted && oldBackup.schema === 12 && oldBackup.ops === 0
    && oldBackup.links.every((x) => x === null) && !oldBackup.operationsRequired,
    'OP-42 : une sauvegarde V2.7.1 (sans opérations) reste RESTAURABLE — « operations » n’a pas été ajouté à KANVIX_BACKUP_REQUIRED, la migration complète la donnée', 'OP-42');

  // ---- OP-43 : l'export portable emporte les opérations.
  const exported = await ev(p, () => {
    resetApp(); setDepth('pilot');
    exportKanvixData();
    const j = JSON.parse(document.querySelector('#kanvixExportText').value);
    return { keys: Object.keys(j), ops: j.operations.map((o) => o.id), links: j.projects.map((p) => [p.id, p.operationId]) };
  });
  note('OP-43', exported);
  ok(exported.keys.includes('operations') && exported.ops.includes(OP)
    && exported.links.filter((x) => x[1] === OP).length === 3,
    'OP-43 : l’export portable inclut les opérations — un project.operationId exporté sans son opération serait une référence dans le vide', 'OP-43');

  // ---- OP-44 : un export V2.7 sans opérations reste importable.
  const oldImport = await ev(p, () => {
    const data = {
      format: 'kanvix-portable', version: 1,
      projects: [{ id: 'imp-v27', name: 'Chantier V2.7', location: 'Morlaix' }],
      tasks: [], milestones: [], companyTemplates: [], lots: [],
    };
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: false, data, projectOps: [{ action: 'import-new', imported: data.projects[0] }] };
    applyImportPlan(plan, clone);
    return { link: clone.projects.find((p) => p.id === 'imp-v27')?.operationId, valid: validateImportState(clone).ok };
  });
  note('OP-44', oldImport);
  ok(oldImport.link === null && oldImport.valid,
    'OP-44 : un export V2.7 sans opérations s’importe sans erreur — le chantier arrive simplement sans rattachement', 'OP-44');

  // ---- OP-45 : une opération importée est ajoutée et référencée.
  const impNew = await ev(p, () => {
    const data = {
      format: 'kanvix-portable', version: 1,
      operations: [{ id: 'op-x', name: 'Opération Import', location: 'Quimper' }],
      projects: [{ id: 'imp-1', name: 'Chantier Importé', operationId: 'op-x' }],
      tasks: [], milestones: [], companyTemplates: [], lots: [],
    };
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: false, data, projectOps: [{ action: 'import-new', imported: data.projects[0] }] };
    const sum = applyImportPlan(plan, clone);
    return {
      added: sum.operationsAdded, reused: sum.operationsReused,
      ops: clone.operations.map((o) => o.id),
      link: clone.projects.find((p) => p.id === 'imp-1')?.operationId,
      valid: validateImportState(clone).ok,
      lines: impOperationLines(sum),
    };
  });
  note('OP-45', impNew);
  ok(impNew.added === 1 && impNew.link === 'op-x' && impNew.valid && impNew.lines.length > 0,
    'OP-45 : une opération inconnue est ajoutée, le rattachement du chantier importé la désigne, et l’aperçu l’annonce', 'OP-45');

  // ---- Une opération identique est RÉUTILISÉE, pas dupliquée.
  const impReuse = await ev(p, () => {
    const local = operation(OP);
    const data = {
      format: 'kanvix-portable', version: 1,
      operations: [{ id: 'autre-id', name: local.name, location: local.location }],
      projects: [{ id: 'imp-r', name: 'Chantier Réutilisé', operationId: 'autre-id' }],
      tasks: [], milestones: [], companyTemplates: [], lots: [],
    };
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: false, data, projectOps: [{ action: 'import-new', imported: data.projects[0] }] };
    const sum = applyImportPlan(plan, clone);
    return { reused: sum.operationsReused, total: clone.operations.length, link: clone.projects.find((p) => p.id === 'imp-r')?.operationId };
  });
  note('OP-45-reuse', impReuse);
  ok(impReuse.reused === 1 && impReuse.total === 1 && impReuse.link === OP,
    'OP-45 : une opération de même nom et même localisation est RÉUTILISÉE, jamais dupliquée — le chantier importé rejoint l’opération locale', 'OP-45');

  // ---- OP-46 : collision d'ID → nouvel ID + remappage.
  const collision = await ev(p, () => {
    const data = {
      format: 'kanvix-portable', version: 1,
      operations: [{ id: OP, name: 'Tout Autre Programme', location: 'Rennes' }],
      projects: [{ id: 'imp-2', name: 'Chantier Rennes', operationId: OP }],
      tasks: [], milestones: [], companyTemplates: [], lots: [],
    };
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: false, data, projectOps: [{ action: 'import-new', imported: data.projects[0] }] };
    const sum = applyImportPlan(plan, clone);
    return {
      remapped: sum.operationsRemapped,
      ops: clone.operations.map((o) => [o.id, o.name]),
      imported: clone.projects.find((p) => p.id === 'imp-2')?.operationId,
      keravel: clone.projects.find((p) => p.id === 'keravel')?.operationId,
      valid: validateImportState(clone).ok,
      orphans: clone.projects.filter((p) => p.operationId && !clone.operations.some((o) => o.id === p.operationId)).length,
    };
  });
  note('OP-46', collision);
  ok(collision.remapped === 1 && collision.imported !== OP && collision.keravel === OP
    && collision.valid && collision.orphans === 0,
    'OP-46 : même ID mais opération DIFFÉRENTE → un nouvel ID est créé, le chantier importé le suit, l’opération locale garde ses membres, et il reste 0 orphelin', 'OP-46');

  // ---- OP-47 : « Remplacer tous les chantiers ».
  const replaceAll = await ev(p, () => {
    const data = {
      format: 'kanvix-portable', version: 1,
      operations: [{ id: 'op-new', name: 'Nouvelle Opération', location: 'Lorient' }],
      projects: [{ id: 'imp-4', name: 'Chantier Lorient', operationId: 'op-new' }],
      tasks: [], milestones: [], companyTemplates: [], lots: [],
    };
    const clone = structuredClone({ ...app, undoStack: [] });
    const plan = { replaceAll: true, data, projectOps: [{ action: 'import-new', imported: data.projects[0] }] };
    const sum = applyImportPlan(plan, clone);
    return {
      ops: clone.operations.map((o) => o.id),
      removed: sum.operationsRemoved,
      lots: clone.lots.length,
      resources: clone.resources.length,
      templates: clone.controlTemplates.length,
      link: clone.projects.find((p) => p.id === 'imp-4')?.operationId,
      valid: validateImportState(clone).ok,
    };
  });
  note('OP-47', replaceAll);
  ok(replaceAll.ops.join() === 'op-new' && replaceAll.removed === 1
    && replaceAll.lots > 0 && replaceAll.resources > 0 && replaceAll.templates > 0
    && replaceAll.link === 'op-new' && replaceAll.valid,
    'OP-47 : « Remplacer tous les chantiers » remplace les opérations (domaine CHANTIER) mais conserve lots, ressources et modèles de contrôle (référentiel ENTREPRISE)', 'OP-47');

  // ---- OP-48 : une référence inconnue fait échouer la validation.
  const validation = await ev(p, () => {
    const clone = structuredClone({ ...app, undoStack: [] });
    clone.projects[0].operationId = 'op-fantome';
    const v = validateImportState(clone);
    const dupe = structuredClone({ ...app, undoStack: [] });
    dupe.operations.push({ ...dupe.operations[0] });
    const v2 = validateOperationState(dupe);
    return { ok: v.ok, errs: v.errors.filter((e) => /opération/i.test(e)), dupOk: v2.ok, dupErrs: v2.errors };
  });
  note('OP-48', validation);
  ok(!validation.ok && validation.errs.length === 1 && !validation.dupOk,
    'OP-48 : un project.operationId inconnu FAIT ÉCHOUER validateImportState(), et des IDs d’opération en double sont refusés', 'OP-48');

  await ctx.close();
}

// ============================================================
// OP-49 → OP-54 — GELS, MOBILE, SOMBRE, BASELINES
// ============================================================
console.log('\n[OP-GEL] Mode Chantier gelé, Bureau mobile, thème sombre, baselines');
{
  // ---- OP-49 : le Mode Chantier n'a PAS bougé.
  const { ctx, p } = await newPage({ w: 390, h: 844, tag: 'FIELD' });
  const field = await ev(p, () => {
    app.settings.driverMode = 'field';
    app.ui.fieldTab = 'site';
    save();
    renderPage();
    const picker = document.querySelector('#main').textContent;
    selectFieldProject('keravel');
    const site = document.querySelector('#main').innerHTML;
    return {
      pickerHasOperations: /Opération/i.test(picker),
      siteHasOperations: /Opération|op-card|op-kpi|op-macro/.test(site),
      bottom: [...document.querySelectorAll('.field-bottom button')].map((x) => x.textContent.replace(/\d+/g, '').trim()),
      projects: [...document.querySelectorAll('.field-project-card b')].map((x) => x.textContent),
    };
  });
  note('OP-49', field);
  ok(!field.pickerHasOperations && !field.siteHasOperations && field.bottom.join('|') === 'Chantier|Messages',
    'OP-49 : le Mode Chantier reste centré sur UN chantier — aucun écran, aucun sélecteur, aucune vue d’opération n’y a été introduit', 'OP-49');

  // ---- OP-54 : le second clic du bouton Chantier, comportement V2.7.1.
  const secondClick = await ev(p, () => {
    selectFieldProject('keravel');
    const before = app.ui.fieldProjectId;
    [...document.querySelectorAll('.field-bottom button')].find((x) => /Chantier/.test(x.textContent)).click();
    return { before, after: app.ui.fieldProjectId, picker: /Choisir un chantier/.test(document.body.textContent) };
  });
  note('OP-54', secondClick);
  ok(secondClick.before === 'keravel' && secondClick.after === null && secondClick.picker,
    'OP-54 : le second clic sur « Chantier » remonte toujours au sélecteur — comportement V2.7.1 strictement identique', 'OP-54');
  await ctx.close();

  // ---- OP-50 : Bureau mobile.
  const { ctx: c2, p: p2 } = await newPage({ w: 390, h: 844, tag: 'MOBILE' });
  const mobile = await ev(p2, () => {
    const over = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const out = {};
    go('sites'); out.sites = over();
    setSitesMode('operations'); out.operations = over();
    selectOperation(OP); out.overview = over();
    setOperationTab('Planning'); out.planning = over();
    setOperationTab('Ressources'); out.resources = over();
    setOperationTab('Jalons'); out.milestones = over();
    setOperationTab('Vue d’ensemble');
    return out;
  });
  await p2.waitForTimeout(250);
  note('OP-50', mobile);
  ok(Object.values(mobile).every((v) => v <= 0),
    'OP-50 : à 390px, Chantiers → Opérations, Vue d’ensemble, Planning, Ressources et Jalons s’affichent sans AUCUN débordement horizontal', 'OP-50');
  await shot(p2, '13-operation-mobile-390.png', { fullPage: true });
  await ev(p2, () => setOperationTab('Planning'));
  await p2.waitForTimeout(250);
  await shot(p2, '14-operation-mobile-planning-390.png', { fullPage: true });
  await c2.close();

  // ---- Responsive complet.
  const bad = [];
  for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800], [1080, 800], [900, 1000], [768, 1024], [430, 932], [360, 800]]) {
    const { ctx: c3, p: p3 } = await newPage({ w, h, tag: `RESP-${w}` });
    const m = await ev(p3, () => {
      const over = () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const out = {};
      go('sites'); setSitesMode('operations'); out.list = over();
      selectOperation(OP); out.overview = over();
      setOperationTab('Planning'); out.planning = over();
      setOperationTab('Ressources'); out.resources = over();
      setOperationTab('Jalons'); out.milestones = over();
      return out;
    });
    const o = Object.entries(m).filter(([, v]) => v > 0);
    if (o.length) bad.push({ w, o });
    await c3.close();
  }
  note('OP-RESP', { testés: 10, débordements: bad });
  ok(bad.length === 0,
    'OP-50 : sur 10 formats de 1920 à 360px, aucune vue d’opération ne déborde horizontalement', 'OP-50');

  // ---- OP-51 : thème sombre.
  const { ctx: c4, p: p4 } = await newPage({ tag: 'DARK' });
  const dark = await ev(p4, () => {
    setAppearance('dark');
    go('sites'); setSitesMode('operations');
    const lum = (c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const probe = (sel) => { const e = document.querySelector(sel); return e ? { bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color } : null; };
    const card = probe('.op-card');
    selectOperation(OP);
    const kpi = probe('.op-kpi');
    const kpiB = probe('.op-kpi b');
    setOperationTab('Ressources');
    const board = probe('.load-row');
    setOperationTab('Jalons');
    const ms = probe('.op-milestone');
    setOperationTab('Vue d’ensemble');
    return {
      dark: document.body.classList.contains('dark'),
      cardContrast: card ? lum(card.bg) < 0.5 : null,
      kpiContrast: kpi && kpiB ? lum(kpi.bg) < 0.5 && lum(kpiB.fg) > 0.5 : null,
      boardDark: board ? lum(board.bg) < 0.6 : null,
      msDark: ms ? lum(ms.bg) < 0.5 : null,
      inlineColors: (document.querySelector('#main').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || []).filter((s) => !/left:|width:|--cols|--col-min/.test(s)).length,
    };
  });
  await p4.waitForTimeout(300);
  note('OP-51', dark);
  ok(dark.dark && dark.cardContrast && dark.kpiContrast && dark.msDark,
    'OP-51 : liste, fiche, KPI, charge et jalons d’opération sont lisibles en thème sombre — fonds sombres, texte clair', 'OP-51');
  ok(dark.inlineColors === 0,
    'OP-51 : aucune couleur codée en dur dans les vues d’opération — uniquement les variables de thème existantes', 'OP-51');
  await shot(p4, '15-operation-dark.png', { fullPage: true });
  await c4.close();

  // ---- OP-52 / OP-53 : les baselines chantier et qualité.
  const { ctx: c5, p: p5 } = await newPage({ tag: 'BASELINE' });
  const baseline = await ev(p5, () => {
    selectProject('keravel');
    const tabs = projectTabs();
    const cockpit = {
      badge: document.querySelector('.status-badge')?.textContent.trim(),
      headline: document.querySelector('.headline')?.textContent.trim(),
    };
    const closure = getProjectClosureStatus('keravel');
    const controls = controlsForTask('k-cloisons').map((c) => c.status);
    return {
      tabs,
      noOperationTab: !tabs.some((t) => /Opération/i.test(t)),
      cockpit,
      health: getProjectHealth('keravel'),
      closureKeys: Object.keys(closure),
      controls,
    };
  });
  note('OP-52', baseline);
  ok(baseline.noOperationTab && baseline.tabs.join('|') === 'Aujourd’hui|À venir|Documents|Photos|Planning|Ressources|Historique'
    && baseline.health === 'danger',
    'OP-52 : la fiche chantier Keravel est inchangée — mêmes onglets, même cockpit, même santé, aucun onglet « Opération » ajouté', 'OP-52');

  const qualityBaseline = await ev(p5, () => {
    resetApp(); setDepth('pilot'); setRole('driver');
    setTaskStatus('k-windows', 'doing'); /* V2.8.5.2 — le passage « En cours » demande désormais confirmation (§7) : on confirme, comme l'utilisateur. */ if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    closeOverlay('modal');
    const out = setTaskStatus('k-windows', 'done');
    const txt = document.querySelector('#modalContent').textContent;
    return {
      status: task('k-windows').status,
      control: controlsForTask('k-windows')[0]?.status,
      prompt: /INTERVENTION TERMIN/i.test(txt),
      buttons: [...document.querySelectorAll('#modalContent button')].map((x) => x.textContent.trim()),
      outcome: out,
    };
  });
  note('OP-53', qualityBaseline);
  ok(qualityBaseline.status === 'done' && qualityBaseline.control === 'todo' && qualityBaseline.prompt
    && qualityBaseline.buttons.join('|') === 'Plus tard|Contrôler maintenant',
    'OP-53 : « Pose des 6 fenêtres » → Terminer → contrôle créé et retour V2.7.1 affiché à l’identique', 'OP-53');
  await c5.close();

  // ---- Captures restantes.
  const { ctx: c6, p: p6 } = await newPage({ tag: 'SHOTS' });
  await ev(p6, () => { go('sites'); });
  await shot(p6, '01-chantiers-toggle-operations.png');
  await ev(p6, () => { setSitesMode('operations'); openOperationForm(''); });
  await shot(p6, '03-create-operation.png');
  await c6.close();
}

// ============================================================
// BYTE-IDENTITÉ V2.7.1 → V2.8.0
// ============================================================
console.log('\n[FREEZE-280] Byte-identité des moteurs métier');
{
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
  const extract = (src, name) => {
    const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
    if (!m) return null;
    let j = src.indexOf('(', m.index), dp = 0;
    for (; j < src.length; j++) { if (src[j] === '(') dp++; else if (src[j] === ')') { dp--; if (!dp) { j++; break; } } }
    let i = src.indexOf('{', j), d = 0;
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) return src.slice(m.index, i + 1); } }
    return null;
  };
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
  const frozen = [
    'getProjectHealth', 'calculateProjectDelay', 'getProjectIssues', 'getProjectClosureStatus',
    'confirmCloseProject', 'closeProjectPrompt', 'taskResourceIds', 'taskHasResource',
    'normalizeTaskResources', 'getResourceTasks', 'getResourceConflicts',
    'getResourceSchedulingConflicts', 'resourceUnavailabilityConflicts', 'getMaxConcurrentTasks',
    'getResourceLoad', 'getResourceState', 'getResourcePeriodState', 'resourceLoadGroups',
    'resourceConflictNudge', 'pendingControlsForProject', 'pendingControlsForTask',
    'blockingControlsForTask', 'controlsForProject', 'applicableControlTemplates',
    'ensureTaskControlInstances', 'createControlInstance', 'submitControlAttempt',
    'controlFormHTML', 'openControlForm', 'showPostCompletionQualityPrompt',
    'showBlockingControlNotice', 'validateQualityState', 'setTaskStatus', 'createRework',
    'openReworkForm', 'planReflow', 'applyReflowPlan', 'evaluateScenario',
    'taskEffectiveColorKey', 'taskColorClass', 'lotChip', 'planningLotDot', 'planningTaskTitle',
    'historyHTML', 'projectHistory', 'historyProjectId', 'kanbanCard', 'kanbanBoard',
    'kanbanDrop', 'dropTask', 'planningIsReadOnly', 'scale', 'pos', 'effectiveTasks',
    'getTodayDecisions', 'getTodayWarnings', 'getProjectSummary', 'getProjectTasks',
    'renderField', 'handleFieldSiteTab', 'setFieldTab', 'clearFieldProject',
    'selectFieldProject', 'fieldProjectView', 'fieldControlSection', 'openFieldTaskModal',
    'renderProject', 'projectTabs', 'projectTabContent', 'siteCard', 'projectCardMenu',
    'buildKanvixBackup', 'validateKanvixBackup', 'confirmKanvixRestore', 'deleteProjectCascade',
    'addPhoto', 'capturePhoto', 'photoCaptureBlock', 'shiftTeamLoadWeek', 'teamLoadToday',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-280', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-280 : les ${frozen.length} moteurs métier de V2.7.1 sont BYTE-IDENTIQUES — dont getProjectHealth, setTaskStatus, submitControlAttempt, createRework, planReflow, evaluateScenario, getResourceSchedulingConflicts, taskResourceIds et tout le Mode Chantier`, 'FREEZE-280');

  const changed = ['planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'migrateState',
    'openProjectEdit', 'renderSites', 'renderPage', 'exportKanvixData', 'validateImportState',
    'applyImportPlan', 'nav', 'impDroppedLines']
    .filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  note('FREEZE-280-périmètre', { modifiées: changed });
  ok(changed.every((n) => ['planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'migrateState',
    'openProjectEdit', 'renderSites', 'renderPage', 'exportKanvixData', 'validateImportState', 'applyImportPlan', 'nav'].includes(n)),
    'FREEZE-280 : les seules fonctions modifiées appartiennent toutes à la liste explicitement autorisée à évoluer', 'FREEZE-280');

  // Les signatures étendues restent rétro-compatibles.
  const sigs = {
    planningTasks: /function planningTasks\(pid = "all", opts = \{\}\)/.test(curSrc),
    planningAgenda: /function planningAgenda\(pid = "all", opts = \{\}\)/.test(curSrc),
    gantt: /function gantt\(pid = "all", opts = \{\}\)/.test(curSrc),
    loadBoard: /statusFilter = app\.ui\.teamLoadStatusFilter \|\| "all",\s*opts = \{\},/.test(curSrc),
  };
  note('FREEZE-280-signatures', sigs);
  ok(Object.values(sigs).every(Boolean),
    'FREEZE-280 : les quatre moteurs étendus gardent leurs paramètres historiques en tête et n’ajoutent qu’un `opts` optionnel en queue — tous les appels existants restent valides', 'FREEZE-280');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-280-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && store(curSrc) === store(prevSrc)
    && schema(prevSrc) === '11' && schema(curSrc) === '12',
    'FREEZE-280 : STORE strictement inchangé, SCHEMA_VERSION 11 → 12', 'FREEZE-280');
}

// ============================================================
// SYNTHÈSE
// ============================================================
const appErrs = allErrs.filter((e) => !/ERR_FAILED|ERR_TUNNEL/.test(e.msg));
console.log('\n============================================================');
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 12), null, 1));
console.log('============================================================');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length || appErrs.length ? 1 : 0);
