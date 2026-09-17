// ============================================================
// KANVIX — Recette « Ressources & Disponibilités » (V2.5.0)
//
//   Version majeure fonctionnelle : le matériel devient une RESSOURCE comme
//   une autre, une intervention peut mobiliser PLUSIEURS ressources, et une
//   ressource peut être INDISPONIBLE sur une période.
//
//   Principe directeur vérifié de bout en bout :
//     « Kanvix DÉTECTE. Kanvix EXPLIQUE. LE CONDUCTEUR DÉCIDE. »
//   — aucune indisponibilité ne déplace, n'annule ni ne réaffecte quoi que ce
//   soit ; elle se contente d'être signalée.
//
//   Contrainte d'architecture vérifiée : il n'existe PAS de moteur « matériel »
//   parallèle au moteur « humain ». Les MÊMES fonctions centrales servent les
//   trois familles (personne / entreprise / matériel).
//
//   Usage : node recette-ressources-disponibilites-v2.5.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.5.0.html';
const PREV = 'kanvix-next-gen-v2.4.15.6.html';
const NOW = '2026-09-14T10:15:00';
const F = (now = NOW, file = CUR) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = '/home/user/Planzy-saas/recette-v2.5.0/';
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
  const { now = NOW, w = 1440, h = 900, tag = 'x', file = CUR, reset = true } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    // Les routes météo / géocodage sont volontairement coupées : leurs
    // « Failed to load resource » ne sont pas des erreurs applicatives.
    if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
  await p.goto(F(now, file), { waitUntil: 'load' });
  if (reset)
    await p.evaluate(() => {
      resetApp();
      setDepth('pilot');
      dismissKanvixContinuityNotice();
      const t = document.querySelector('#toast');
      if (t) t.style.display = 'none';
    });
  await p.waitForTimeout(180);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// ============================================================
// A. MODÈLE DE DONNÉES & MIGRATION (RSC-01 → RSC-06)
// ============================================================
console.log('\n[RSC-01..06] Modèle de données, matériel, migration non destructive');
{
  const { ctx, p } = await newPage({ tag: 'A' });

  // ---- RSC-01 : schéma / STORE
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  ok(/STORE = "kanvix-product-8-3"/.test(src), 'RSC-01 : STORE reste "kanvix-product-8-3"', 'RSC-01');
  ok(/SCHEMA_VERSION = 9\b/.test(src), 'RSC-01 : SCHEMA_VERSION passe de 8 à 9', 'RSC-01');
  const live = await ev(p, () => ({ schema: app.schemaVersion, store: STORE }));
  note('RSC-01', live);
  ok(live.schema === 9 && live.store === 'kanvix-product-8-3', 'RSC-01 : état chargé en schéma 9 sur le même STORE', 'RSC-01');

  // ---- RSC-02 : collection d'indisponibilités, baseline SANS conflit
  const unav = await ev(p, () => ({
    isArray: Array.isArray(app.resourceUnavailabilities),
    n: app.resourceUnavailabilities.length,
    ids: app.resourceUnavailabilities.map((u) => u.id),
    reasons: app.resourceUnavailabilities.map((u) => u.reason),
    conflicts: app.resources.flatMap((r) => getResourceSchedulingConflicts(r.id, app.tasks)),
  }));
  note('RSC-02', unav);
  ok(unav.isArray && unav.n === 2, 'RSC-02 : app.resourceUnavailabilities existe et porte 2 périodes de démonstration', 'RSC-02');
  ok(unav.conflicts.length === 0, 'RSC-02 : la baseline de démonstration ne contient AUCUN conflit de planification', 'RSC-02');

  // ---- RSC-03 : le matériel est une ressource
  const equip = await ev(p, () => {
    const es = app.resources.filter((r) => r.type === 'equipment');
    return {
      n: es.length,
      caps: es.map((r) => r.capacity),
      cats: es.map((r) => r.equipmentCategory),
      labels: es.map((r) => equipmentCategoryLabel(r.equipmentCategory)),
      refs: es.map((r) => r.assetRef),
      scopes: es.map((r) => r.scope),
      provider: es.find((r) => r.scope === 'Externe')?.providerName || null,
      // Ni compte Artisan, ni invitation, ni poste métier pour du matériel.
      account: es.some((r) => canAccessArtisan(r.id)),
      jobTitles: es.some((r) => r.jobTitle),
    };
  });
  note('RSC-03', equip);
  ok(equip.n === 3, 'RSC-03 : 3 ressources matériel de démonstration', 'RSC-03');
  ok(equip.caps.every((c) => c === 1), 'RSC-03 : capacité du matériel = 1 (jamais deux chantiers au même instant)', 'RSC-03');
  ok(JSON.stringify(equip.labels) === JSON.stringify(['Grue', 'Camion', 'Nacelle']), 'RSC-03 : catégorie stockée en code, affichée en libellé français', 'RSC-03');
  ok(equip.refs.filter(Boolean).length === 3 && equip.provider === "Loc'Access", 'RSC-03 : référence matériel + prestataire (Externe) présents', 'RSC-03');
  ok(!equip.account && !equip.jobTitles, 'RSC-03 : aucun compte Artisan / poste métier pour du matériel', 'RSC-03');

  // ---- RSC-04 : additionalResourceIds sur toutes les tâches
  const extras = await ev(p, () => ({
    allArrays: app.tasks.every((t) => Array.isArray(t.additionalResourceIds)),
    withExtras: app.tasks.filter((t) => t.additionalResourceIds.length).map((t) => [t.id, t.additionalResourceIds]),
  }));
  note('RSC-04', extras);
  ok(extras.allArrays, 'RSC-04 : task.additionalResourceIds présent (tableau) sur toutes les tâches', 'RSC-04');
  ok(extras.withExtras.length >= 1, 'RSC-04 : au moins une tâche de démonstration mobilise une ressource complémentaire', 'RSC-04');

  await ctx.close();
}

// ---- RSC-05 : migration NON destructive depuis un état V8 réel
{
  // On fabrique un état V8 en ouvrant la version PRÉCÉDENTE, on relit son
  // localStorage, puis on l'injecte dans V2.5.0 : le passage de schéma doit
  // AJOUTER les nouveaux champs sans rien perdre.
  const { ctx: c8, p: p8 } = await newPage({ tag: 'V8', file: PREV });
  const v8 = await ev(p8, () => {
    // Une trace bien identifiable pour prouver qu'aucune donnée n'est perdue.
    app.history.unshift({ date: historyNow(), text: 'TRACE-V8', author: 'Eric' });
    save();
    return {
      raw: localStorage.getItem(STORE),
      schema: app.schemaVersion,
      counts: {
        projects: app.projects.length, tasks: app.tasks.length,
        resources: app.resources.length, history: app.history.length,
        messages: app.messages.length, photos: app.photos.length,
      },
      hasUnav: !!app.resourceUnavailabilities,
      hasExtras: app.tasks.some((t) => t.additionalResourceIds),
    };
  });
  note('RSC-05-source', { schema: v8.schema, counts: v8.counts, hasUnav: v8.hasUnav, hasExtras: v8.hasExtras });
  ok(v8.schema === 8 && !v8.hasUnav && !v8.hasExtras, 'RSC-05 : l’état source est bien un schéma 8 sans les nouveautés V2.5', 'RSC-05');
  await c8.close();

  const { ctx, p } = await newPage({ tag: 'MIG', reset: false });
  const migrated = await ev(p, (raw) => {
    localStorage.setItem(STORE, raw);
    location.reload();
  }, v8.raw).catch(() => null);
  await p.waitForLoadState('load');
  await p.waitForTimeout(250);
  const after = await ev(p, () => ({
    schema: app.schemaVersion,
    counts: {
      projects: app.projects.length, tasks: app.tasks.length,
      resources: app.resources.length, history: app.history.length,
      messages: app.messages.length, photos: app.photos.length,
    },
    trace: app.history.some((h) => h.text === 'TRACE-V8'),
    unav: Array.isArray(app.resourceUnavailabilities) ? app.resourceUnavailabilities.length : null,
    extras: app.tasks.every((t) => Array.isArray(t.additionalResourceIds)),
    kindFilter: app.ui.teamKindFilter,
  }));
  note('RSC-05-après', after);
  ok(after.schema === 9, 'RSC-05 : l’ouverture en V2.5.0 migre l’état 8 → 9', 'RSC-05');
  ok(JSON.stringify(after.counts) === JSON.stringify(v8.counts), 'RSC-05 : migration NON destructive — aucun compteur métier modifié', 'RSC-05');
  ok(after.trace, 'RSC-05 : la donnée témoin écrite en V8 est toujours présente après migration', 'RSC-05');
  ok(after.unav === 0 && after.extras && after.kindFilter === 'all', 'RSC-05 : les champs V2.5 sont AJOUTÉS avec des valeurs neutres', 'RSC-05');
  await ctx.close();
}

// ---- RSC-06 : alignement des dates de démo (indispos suivies comme les tâches)
{
  const { ctx, p } = await newPage({ tag: 'ALIGN' });
  const a = await ev(p, () => ({
    seeded: app.seededFor,
    today: localDateKey(TODAY),
    unavs: app.resourceUnavailabilities.map((u) => [u.id, u.start, u.end]),
    tasks: app.tasks.slice(0, 2).map((t) => [t.id, t.start]),
  }));
  // Idempotence : un second passage ne doit RIEN décaler.
  const again = await ev(p, () => {
    alignDemoDates(app);
    return app.resourceUnavailabilities.map((u) => [u.id, u.start, u.end]);
  });
  note('RSC-06', { seeded: a.seeded, today: a.today, unavs: a.unavs });
  ok(a.unavs.every(([, s]) => s.slice(0, 10) >= a.today), 'RSC-06 : les indisponibilités de démo sont réalignées dans le futur proche', 'RSC-06');
  ok(JSON.stringify(again) === JSON.stringify(a.unavs), 'RSC-06 : le réalignement est idempotent (aucune dérive au second passage)', 'RSC-06');
  await ctx.close();
}

// ============================================================
// B. MOTEUR UNIQUE « RESSOURCE » (RSC-07 → RSC-12)
// ============================================================
console.log('\n[RSC-07..12] Un seul moteur ressource pour personnes, entreprises et matériel');
{
  const { ctx, p } = await newPage({ tag: 'B' });

  // ---- RSC-07 : taskResourceIds()
  const ids = await ev(p, () => ({
    windows: taskResourceIds(task('k-windows')),
    empty: taskResourceIds(null),
    dedupe: taskResourceIds({ resourceId: 'thomas', additionalResourceIds: ['thomas', 'crane-g01', 'crane-g01'] }),
    unassigned: taskResourceIds({ resourceId: null, additionalResourceIds: ['crane-g01'] }),
  }));
  note('RSC-07', ids);
  ok(ids.windows.length === 2 && ids.windows[0] === 'thomas', 'RSC-07 : taskResourceIds() = intervenant principal puis ressources complémentaires', 'RSC-07');
  ok(JSON.stringify(ids.dedupe) === JSON.stringify(['thomas', 'crane-g01']), 'RSC-07 : taskResourceIds() dédoublonne', 'RSC-07');
  ok(ids.empty.length === 0 && ids.unassigned.length === 1, 'RSC-07 : tâche nulle / non affectée gérées sans exception', 'RSC-07');

  // ---- RSC-08 : getResourceTasks() est LE point d'entrée unique
  const mob = await ev(p, () => ({
    principal: getResourceTasks('thomas').map((t) => t.id),
    // Le camion n'est JAMAIS intervenant principal : il n'apparaît que comme
    // ressource complémentaire — et pourtant la mobilisation est vue.
    complementaire: getResourceTasks('truck-cb02').map((t) => t.id),
    asMain: app.tasks.filter((t) => t.resourceId === 'truck-cb02').length,
  }));
  note('RSC-08', mob);
  ok(mob.complementaire.includes('k-windows') && mob.asMain === 0, 'RSC-08 : une ressource mobilisée UNIQUEMENT en complément est bien vue par getResourceTasks()', 'RSC-08');
  ok(mob.principal.length > 0, 'RSC-08 : l’intervenant principal reste vu par le même moteur', 'RSC-08');

  // ---- RSC-09 / RSC-10 : normalizeTaskResources()
  const norm = await ev(p, () => ({
    equipAsMain: normalizeTaskResources('crane-g01', ['thomas']),
    dedupe: normalizeTaskResources('thomas', ['thomas', 'crane-g01', 'crane-g01']),
    unknown: normalizeTaskResources('thomas', ['n-existe-pas', 'crane-g01']),
    none: normalizeTaskResources(null, []),
  }));
  note('RSC-09/10', norm);
  ok(norm.equipAsMain.resourceId === null, 'RSC-09 : un matériel ne peut JAMAIS être intervenant principal', 'RSC-09');
  ok(norm.dedupe.resourceId === 'thomas' && JSON.stringify(norm.dedupe.additionalResourceIds) === JSON.stringify(['crane-g01']), 'RSC-10 : le principal est exclu des complémentaires, la liste est dédoublonnée', 'RSC-10');
  ok(JSON.stringify(norm.unknown.additionalResourceIds) === JSON.stringify(['crane-g01']), 'RSC-10 : une ressource inconnue est écartée (jamais de référence orpheline)', 'RSC-10');

  // ---- RSC-11 : AUCUN moteur « matériel » parallèle
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  const forbidden = [
    /function\s+getEquipment(Tasks|State|Load|Conflicts)\s*\(/,
    /function\s+getMaterial\w*\s*\(/,
    /app\.equipments\b/,
    /app\.materials\b/,
  ];
  const noParallel = forbidden.every((re) => !re.test(src));
  const shared = await ev(p, () => {
    // Une SEULE implémentation sert les trois familles : on l'exécute pour
    // chacune et on vérifie qu'aucune ne lève ni ne renvoie d'incohérence.
    const day = localDateKey(TODAY),
      calls = {
        getResourceTasks: (id) => Array.isArray(getResourceTasks(id)),
        getResourceState: (id) => typeof getResourceState(id, day) === 'string',
        getResourceLoad: (id) => Array.isArray(getResourceLoad(id, day).tasks),
        getMaxConcurrentTasks: (id) => typeof getMaxConcurrentTasks(id, { start: day + 'T00:00', end: day + 'T23:59' }) === 'number',
        getResourceSchedulingConflicts: (id) => Array.isArray(getResourceSchedulingConflicts(id)),
      };
    const kinds = { person: 'thomas', company: app.resources.find((r) => r.type === 'company').id, equipment: 'crane-g01' };
    const out = {};
    for (const [k, id] of Object.entries(kinds))
      out[k] = Object.fromEntries(Object.entries(calls).map(([n, fn]) => { try { return [n, fn(id)]; } catch (e) { return [n, 'ERR ' + e.message]; } }));
    return out;
  });
  note('RSC-11', shared);
  ok(noParallel, 'RSC-11 : aucun moteur « matériel » parallèle dans le source (pas de getEquipment*/app.equipments)', 'RSC-11');
  ok(Object.values(shared).every((v) => Object.values(v).every((x) => x === true)), 'RSC-11 : les mêmes moteurs centraux répondent pour personne, entreprise et matériel', 'RSC-11');

  // ---- RSC-12 : resourceReferences() couvre l'usage complémentaire
  const refs = await ev(p, () => ({
    truck: resourceReferences('truck-cb02'),
    canDeleteTruck: canDeleteResource('truck-cb02'),
    lift: resourceReferences('lift-n03'),
    canDeleteLift: canDeleteResource('lift-n03'),
  }));
  note('RSC-12', refs);
  ok(refs.truck.tasks >= 1 && refs.canDeleteTruck === false, 'RSC-12 : une ressource utilisée SEULEMENT en complément n’est pas supprimable (archivage proposé)', 'RSC-12');
  ok(refs.lift.tasks === 0 && refs.canDeleteLift === true, 'RSC-12 : une ressource jamais mobilisée reste supprimable', 'RSC-12');

  await ctx.close();
}

// ============================================================
// C. INDISPONIBILITÉS — MOTEUR (RSC-13 → RSC-18)
// ============================================================
console.log('\n[RSC-13..18] Indisponibilités : plage, journée entière, état, conflits');
{
  const { ctx, p } = await newPage({ tag: 'C' });

  // ---- RSC-13 : plage
  const rng = await ev(p, () => {
    const u = app.resourceUnavailabilities.find((x) => x.resourceId === 'thomas');
    const d = u.start.slice(0, 10);
    return {
      u: [u.start, u.end],
      inside: getResourceUnavailabilitiesInRange('thomas', { start: d + 'T00:00', end: d + 'T23:59' }).map((x) => x.id),
      before: getResourceUnavailabilitiesInRange('thomas', { start: '2026-01-01T00:00', end: '2026-01-02T00:00' }).length,
      flag: resourceIsUnavailable('thomas', { start: d + 'T09:00', end: d + 'T10:00' }),
    };
  });
  note('RSC-13', rng);
  ok(rng.inside.length === 1 && rng.before === 0 && rng.flag === true, 'RSC-13 : getResourceUnavailabilitiesInRange / resourceIsUnavailable bornent correctement la période', 'RSC-13');

  // ---- RSC-14 : journée entière normalisée 00:00 / 23:59
  const allDay = await ev(p, () => {
    openUnavailabilityForm('lift-n03');
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=start]').value = '2026-10-05';
    f.querySelector('[name=end]').value = '2026-10-06';
    f.requestSubmit();
    const u = app.resourceUnavailabilities.at(-1);
    return { start: u.start, end: u.end, allDay: u.allDay, type: f.querySelector('[name=start]').type };
  });
  note('RSC-14', allDay);
  ok(allDay.type === 'date' && allDay.allDay === true, 'RSC-14 : « journée entière » présente des champs DATE (sans heure)', 'RSC-14');
  ok(allDay.start === '2026-10-05T00:00' && allDay.end === '2026-10-06T23:59', 'RSC-14 : la journée entière est normalisée 00:00 → 23:59', 'RSC-14');

  // ---- RSC-15 : état « indisponible » — ton calme, priorités
  const st = await ev(p, () => {
    const u = app.resourceUnavailabilities.find((x) => x.resourceId === 'crane-g01');
    const day = u.start.slice(0, 10);
    return {
      label: RESOURCE_STATE.unavailable.label,
      tone: RESOURCE_STATE.unavailable.tone,
      toneFn: resourceStateTone('unavailable'),
      order: RESOURCE_STATE_ORDER,
      state: getResourceState('crane-g01', day),
      cellLabel: CHARGE_CELL_LABEL.unavailable,
    };
  });
  note('RSC-15', st);
  ok(st.label === 'Indisponible' && st.tone === 'muted' && st.toneFn === 'muted', 'RSC-15 : l’état « Indisponible » est neutre/gris — ce n’est PAS une alerte rouge', 'RSC-15');
  ok(st.order.conflict < st.order.unavailable && st.order.unavailable < st.order.high && st.order.high < st.order.busy && st.order.busy < st.order.available,
    'RSC-15 : priorité conflit > indisponible > forte charge > occupé > disponible', 'RSC-15');
  ok(st.state === 'unavailable', 'RSC-15 : une ressource en période d’indisponibilité, sans tâche, est « Indisponible »', 'RSC-15');

  // ---- RSC-16 / RSC-17 : API de conflits
  const conf = await ev(p, () => {
    const t = task('k-windows');
    app.resourceUnavailabilities.push({
      id: 'u-clash', resourceId: 'thomas', start: t.start, end: t.end,
      allDay: false, reason: 'leave', comment: '', createdAt: t.start,
    });
    save();
    return {
      legacy: getResourceConflicts('thomas').map((pair) => pair.map((x) => x.id)),
      legacyShape: getResourceConflicts('thomas').every((x) => Array.isArray(x) && x.length === 2),
      modern: getResourceSchedulingConflicts('thomas'),
      day: getResourceState('thomas', t.start.slice(0, 10)),
    };
  });
  note('RSC-16/17', conf);
  ok(conf.legacyShape, 'RSC-16 : getResourceConflicts() conserve son API historique (paires de tâches en surcapacité)', 'RSC-16');
  ok(conf.legacy.length === 0, 'RSC-16 : une indisponibilité n’est PAS une surcapacité — l’API historique reste silencieuse', 'RSC-16');
  ok(conf.modern.length === 1 && conf.modern[0].kind === 'unavailability' && conf.modern[0].taskId === 'k-windows',
    'RSC-17 : getResourceSchedulingConflicts() qualifie le conflit { kind: "unavailability" }', 'RSC-17');
  ok(conf.day === 'conflict', 'RSC-17 : une tâche mobilisant une ressource PENDANT son indisponibilité est un CONFLIT', 'RSC-17');

  // Conflit de capacité : même moteur, autre « kind ».
  const cap = await ev(p, () => {
    const t = task('k-windows');
    app.tasks.push({
      id: 'task-cap-test', name: 'Test capacité', projectId: t.projectId,
      resourceId: 'thomas', additionalResourceIds: [], start: t.start, end: t.end,
      status: 'todo', deps: [],
    });
    save();
    return getResourceSchedulingConflicts('thomas').map((c) => c.kind);
  });
  note('RSC-17-capacity', cap);
  ok(cap.includes('capacity') && cap.includes('unavailability'), 'RSC-17 : les deux natures de conflit (capacité / indisponibilité) sortent du MÊME moteur', 'RSC-17');

  // ---- RSC-18 : pire état sur une période
  const period = await ev(p, () => {
    const t = task('k-windows');
    const days = getResourceWeekDays(t.start);
    return { days, period: getResourcePeriodState('thomas', days), single: getResourceState('thomas', days[0]) };
  });
  note('RSC-18', period);
  ok(period.period === 'conflict', 'RSC-18 : getResourcePeriodState retient le PIRE état de la période', 'RSC-18');

  await p.evaluate(() => { resetApp(); dismissKanvixContinuityNotice(); });
  await ctx.close();
}

// ============================================================
// D. DÉTECTER SANS DÉCIDER (RSC-19 → RSC-23)
// ============================================================
console.log('\n[RSC-19..23] Kanvix DÉTECTE, EXPLIQUE — le conducteur DÉCIDE');
{
  const { ctx, p } = await newPage({ tag: 'D' });

  // ---- RSC-19 : l'écran d'avertissement
  const warn = await ev(p, () => {
    const t = task('k-windows');
    go('team');
    openUnavailabilityForm('thomas');
    const f = document.querySelector('#drawerFormEl');
    const ad = f.querySelector('[name=allDay]');
    ad.checked = false;
    ad.dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('[name=start]').value = t.start;
    f.querySelector('[name=end]').value = t.end;
    f.requestSubmit();
    const c = document.querySelector('#drawerContent');
    const btns = [...c.querySelectorAll('button')].map((x) => x.textContent.trim());
    return {
      text: c.textContent,
      btns,
      stored: app.resourceUnavailabilities.length,
      taskNamed: c.textContent.includes(t.name),
    };
  });
  note('RSC-19', { btns: warn.btns, stored: warn.stored });
  ok(/⚠\s*1 intervention déjà planifiée/.test(warn.text), 'RSC-19 : l’avertissement annonce « ⚠ N intervention(s) déjà planifiée(s) »', 'RSC-19');
  ok(warn.taskNamed, 'RSC-19 : l’intervention en cause est NOMMÉE (Kanvix explique)', 'RSC-19');
  ok(warn.btns.includes('Annuler') && warn.btns.some((x) => /Enregistrer malgré le conflit/.test(x)),
    'RSC-19 : deux issues proposées — « Annuler » et « Enregistrer malgré le conflit »', 'RSC-19');
  ok(warn.stored === 2, 'RSC-19 : rien n’est enregistré tant que le conducteur n’a pas tranché', 'RSC-19');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '05-conflit-indisponibilite.png' });

  // ---- RSC-20 : Annuler
  const cancelled = await ev(p, () => {
    closeOverlay('drawer');
    return { stored: app.resourceUnavailabilities.length, drawerOpen: document.querySelector('#drawer').classList.contains('open') };
  });
  note('RSC-20', cancelled);
  ok(cancelled.stored === 2 && !cancelled.drawerOpen, 'RSC-20 : « Annuler » n’enregistre rien et referme le sidewindow', 'RSC-20');

  // ---- RSC-21 : Enregistrer malgré le conflit — sans AUCUN effet de bord
  const despite = await ev(p, () => {
    const t = task('k-windows');
    const snap = (x) => ({ start: x.start, end: x.end, status: x.status, resourceId: x.resourceId, extras: (x.additionalResourceIds || []).join(',') });
    const before = {
      tasks: app.tasks.map(snap), nTasks: app.tasks.length,
      messages: app.messages.length, issues: app.issues.length,
      reworks: app.tasks.filter((x) => x.reworkOfTaskId).length,
    };
    openUnavailabilityForm('thomas');
    const f = document.querySelector('#drawerFormEl');
    const ad = f.querySelector('[name=allDay]');
    ad.checked = false;
    ad.dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('[name=start]').value = t.start;
    f.querySelector('[name=end]').value = t.end;
    f.requestSubmit();
    confirmUnavailabilityDespiteConflict();
    const after = {
      tasks: app.tasks.map(snap), nTasks: app.tasks.length,
      messages: app.messages.length, issues: app.issues.length,
      reworks: app.tasks.filter((x) => x.reworkOfTaskId).length,
    };
    return {
      stored: app.resourceUnavailabilities.length,
      identical: JSON.stringify(before) === JSON.stringify(after),
      before, after,
      conflicts: getResourceSchedulingConflicts('thomas').map((c) => c.kind),
      undoable: app.undoStack.length > 0,
    };
  });
  note('RSC-21', { stored: despite.stored, identical: despite.identical, conflicts: despite.conflicts });
  ok(despite.stored === 3, 'RSC-21 : « Enregistrer malgré le conflit » enregistre bien l’indisponibilité', 'RSC-21');
  ok(despite.identical, 'RSC-21 : AUCUNE tâche déplacée, annulée, restatuée — aucun message, aucune reprise, aucun incident créé', 'RSC-21');
  ok(despite.conflicts.includes('unavailability'), 'RSC-21 : le conflit reste SIGNALÉ après enregistrement (il n’est pas absorbé)', 'RSC-21');
  ok(despite.undoable, 'RSC-21 : l’action reste annulable (snapshot pris)', 'RSC-21');

  // ---- RSC-22 : doublon de période sur la même ressource → refus net
  const dup = await ev(p, () => {
    const u = app.resourceUnavailabilities.at(-1);
    openUnavailabilityForm('thomas');
    const f = document.querySelector('#drawerFormEl');
    const ad = f.querySelector('[name=allDay]');
    ad.checked = false;
    ad.dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('[name=start]').value = u.start;
    f.querySelector('[name=end]').value = u.end;
    f.requestSubmit();
    return { stored: app.resourceUnavailabilities.length, toast: document.querySelector('#toast')?.textContent || '' };
  });
  note('RSC-22', dup);
  ok(dup.stored === 3 && /existe déjà sur cette période/.test(dup.toast), 'RSC-22 : deux indisponibilités ne peuvent pas se chevaucher pour la même ressource (refus net)', 'RSC-22');

  // ---- RSC-23 : le message d'attention NOMME la période, pas une surcharge
  const nudge = await ev(p, () => {
    closeOverlay('drawer');
    const t = task('k-windows');
    return {
      msg: resourceConflictNudge(getResourceWeekDays(t.start)),
      capacityMsg: resourceConflictNudge(getResourceWeekDays(t.start), [resource('thomas')]),
    };
  });
  note('RSC-23', nudge);
  ok(/pendant sa période/.test(nudge.msg) && !/interventions simultanées/.test(nudge.msg),
    'RSC-23 : un conflit d’indisponibilité est expliqué comme tel (et non comme une surcharge)', 'RSC-23');

  await ctx.close();
}

// ============================================================
// E. PLANIFICATION & SIMULATION (RSC-24 → RSC-26)
// ============================================================
console.log('\n[RSC-24..26] Planning, simulation, éditeurs : le conflit reste visible');
{
  const { ctx, p } = await newPage({ tag: 'E' });

  // ---- RSC-24 : planningProblems intègre l'indisponibilité
  const prob = await ev(p, () => {
    const t = task('k-windows');
    const before = planningProblems();
    app.resourceUnavailabilities.push({
      id: 'u-plan', resourceId: 'thomas', start: t.start, end: t.end,
      allDay: false, reason: 'leave', comment: '', createdAt: t.start,
    });
    save();
    return { before, after: planningProblems() };
  });
  note('RSC-24', prob);
  ok(prob.after.res > prob.before.res, 'RSC-24 : le compteur de problèmes du Planning intègre les conflits d’indisponibilité', 'RSC-24');

  // ---- RSC-25 : simulation
  const sim = await ev(p, () => {
    const t = task('k-windows');
    const free = { taskId: 'k-lining', start: t.start, end: t.end };
    // Scénario A : on déplace une tâche de Thomas SUR son indisponibilité.
    const onUnav = evaluateScenario({ projectId: t.projectId, changes: [{ taskId: 'k-lining', start: app.resourceUnavailabilities.at(-1).start, end: app.resourceUnavailabilities.at(-1).end }] });
    // Scénario B : on la déplace loin de toute indisponibilité.
    const away = evaluateScenario({ projectId: t.projectId, changes: [{ taskId: 'k-lining', start: '2026-12-01T08:00', end: '2026-12-02T17:00' }] });
    return { onUnav: onUnav.resourceConflicts, away: away.resourceConflicts, mainRes: task('k-lining').resourceId };
  });
  note('RSC-25', sim);
  ok(sim.onUnav > sim.away, 'RSC-25 : evaluateScenario() détecte une tâche SIMULÉE déplacée sur une indisponibilité', 'RSC-25');

  // ---- RSC-26 : l'éditeur avertit sans bloquer
  const editor = await ev(p, () => {
    const u = app.resourceUnavailabilities.at(-1);
    openTaskEdit('k-lining', 'planning-gantt');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=resourceId]').value = 'thomas';
    f.querySelector('[name=resourceId]').dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('[name=start]').value = u.start;
    f.querySelector('[name=end]').value = u.end;
    f.querySelector('[name=start]').dispatchEvent(new Event('change', { bubbles: true }));
    const warn = document.querySelector('#taskResWarn');
    const shown = warn.textContent;
    submitTaskEdit();
    return {
      shown,
      hadWarning: /Ressource indisponible/.test(shown),
      saved: task('k-lining').start === u.start,
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
    };
  });
  note('RSC-26', { hadWarning: editor.hadWarning, saved: editor.saved, shown: editor.shown.slice(0, 160) });
  ok(editor.hadWarning, 'RSC-26 : l’éditeur AVERTIT quand la période choisie tombe sur une indisponibilité', 'RSC-26');
  ok(editor.saved, 'RSC-26 : l’avertissement ne BLOQUE pas l’enregistrement — le conducteur décide', 'RSC-26');

  await ctx.close();
}

// ============================================================
// F. PAGE RESSOURCES (RSC-27 → RSC-31)
// ============================================================
console.log('\n[RSC-27..31] Page Ressources : nommage, filtre famille, fiche matériel, charge');
{
  const { ctx, p } = await newPage({ tag: 'F' });

  // ---- RSC-27 : « Ressources » visible, route interne « team » inchangée
  const naming = await ev(p, () => {
    go('team');
    return {
      route: app.ui.page,
      h1: document.querySelector('h1')?.textContent.trim(),
      sub: document.querySelector('.page-head p, .page-sub, h1 + p')?.textContent.trim() || '',
      sidebar: [...document.querySelectorAll('.sidebar button, .sidebar a')].map((x) => x.textContent.trim()),
      tabs: (() => { openProjectTab('keravel', 'Ressources'); return [...document.querySelectorAll('.tabs button, .project-tabs button')].map((x) => x.textContent.trim()); })(),
    };
  });
  note('RSC-27', { route: naming.route, h1: naming.h1, tabs: naming.tabs });
  ok(naming.route === 'team', 'RSC-27 : la route INTERNE reste « team » (aucune rupture de lien / d’historique)', 'RSC-27');
  ok(naming.h1 === 'Ressources', 'RSC-27 : le titre de la page est « Ressources »', 'RSC-27');
  ok(naming.sidebar.includes('Ressources') && !naming.sidebar.includes('Équipe'), 'RSC-27 : la navigation affiche « Ressources » (plus « Équipe »)', 'RSC-27');
  ok(naming.tabs.includes('Ressources') && !naming.tabs.includes('Équipe'), 'RSC-27 : l’onglet de la fiche chantier affiche « Ressources »', 'RSC-27');

  // ---- RSC-28 : filtre FAMILLE dédié
  const filter = await ev(p, () => {
    go('team');
    const typeBefore = app.ui.teamTypeFilter;
    const out = {};
    for (const k of ['all', 'person', 'company', 'equipment']) {
      app.ui.teamKindFilter = k; save(); renderPage();
      out[k] = document.querySelectorAll('.team-card').length;
    }
    app.ui.teamKindFilter = 'all'; save(); renderPage();
    return { counts: out, typeUntouched: app.ui.teamTypeFilter === typeBefore, distinct: 'teamKindFilter' in app.ui && 'teamTypeFilter' in app.ui };
  });
  note('RSC-28', filter);
  ok(filter.counts.equipment === 3 && filter.counts.all === filter.counts.person + filter.counts.company + filter.counts.equipment,
    'RSC-28 : le filtre famille (Tous / Personnes / Entreprises / Matériel) partitionne exactement les ressources', 'RSC-28');
  ok(filter.distinct && filter.typeUntouched, 'RSC-28 : app.ui.teamKindFilter est un état DÉDIÉ — teamTypeFilter (Interne/Externe) est intact', 'RSC-28');
  await ev(p, () => { app.ui.teamKindFilter = 'equipment'; save(); renderPage(); });
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '02-ressources-materiel.png' });
  await ev(p, () => { app.ui.teamKindFilter = 'all'; save(); renderPage(); });
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '01-ressources-toutes.png' });

  // ---- RSC-29 : fiche matériel
  const sheet = await ev(p, () => {
    openResource('lift-n03');
    const c = document.querySelector('#drawerContent');
    const txt = c.textContent;
    return {
      eyebrow: c.querySelector('.muted')?.textContent.trim(),
      hasCategory: /Nacelle/.test(txt),
      hasRef: /N03/.test(txt),
      hasProvider: /Loc'Access/.test(txt),
      noInvite: !/Inviter|compte Artisan|Invitation/i.test(txt),
      noMessage: ![...c.querySelectorAll('button')].some((x) => /message/i.test(x.textContent)),
      hasUnavSection: /Indisponibilités/.test(txt),
    };
  });
  note('RSC-29', sheet);
  ok(/MATÉRIEL/.test(sheet.eyebrow || ''), 'RSC-29 : la fiche matériel s’annonce comme telle', 'RSC-29');
  ok(sheet.hasCategory && sheet.hasRef && sheet.hasProvider, 'RSC-29 : catégorie (libellé français), référence et prestataire affichés', 'RSC-29');
  ok(sheet.noInvite && sheet.noMessage, 'RSC-29 : aucun compte Artisan, aucune invitation, aucune messagerie pour du matériel', 'RSC-29');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '03-fiche-materiel.png' });

  // ---- RSC-30 : CRUD indisponibilité depuis la fiche
  const crud = await ev(p, () => {
    const n0 = app.resourceUnavailabilities.length;
    openResource('lift-n03');
    openUnavailabilityForm('lift-n03');
    let f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=reason]').value = 'rental-end';
    f.querySelector('[name=start]').value = '2026-11-02';
    f.querySelector('[name=end]').value = '2026-11-04';
    f.querySelector('[name=comment]').value = 'Retour loueur';
    f.requestSubmit();
    const created = app.resourceUnavailabilities.at(-1);
    // Modification
    openUnavailabilityForm('lift-n03', created.id);
    f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=comment]').value = 'Retour loueur — confirmé';
    f.requestSubmit();
    const edited = app.resourceUnavailabilities.find((x) => x.id === created.id);
    // Lecture dans la fiche
    openResource('lift-n03');
    const listed = /Retour loueur — confirmé/.test(document.querySelector('#drawerContent').textContent);
    // Suppression
    deleteUnavailabilityPrompt(created.id);
    confirmDeleteUnavailability(created.id);
    return {
      created: !!created, n0, nAfterCreate: n0 + 1,
      reason: created.reason, comment: edited.comment, listed,
      nAfterDelete: app.resourceUnavailabilities.length,
      sameId: app.resourceUnavailabilities.some((x) => x.id === created.id),
    };
  });
  note('RSC-30', crud);
  ok(crud.created && crud.reason === 'rental-end', 'RSC-30 : création d’une indisponibilité avec un motif propre au matériel (fin de location)', 'RSC-30');
  ok(crud.comment === 'Retour loueur — confirmé' && crud.listed, 'RSC-30 : modification prise en compte et visible dans la fiche', 'RSC-30');
  ok(crud.nAfterDelete === crud.n0 && !crud.sameId, 'RSC-30 : suppression effective — retour à l’état initial', 'RSC-30');

  // Motifs contextuels selon la famille de ressource
  const reasons = await ev(p, () => ({
    person: Object.keys(unavailabilityReasons(resource('thomas'))),
    equipment: Object.keys(unavailabilityReasons(resource('crane-g01'))),
    company: Object.keys(unavailabilityReasons(app.resources.find((r) => r.type === 'company'))),
  }));
  note('RSC-30-motifs', reasons);
  ok(reasons.person.includes('leave') && reasons.equipment.includes('maintenance') && !reasons.equipment.includes('leave'),
    'RSC-30 : les motifs sont propres à la famille (congé pour une personne, maintenance pour du matériel)', 'RSC-30');

  // ---- RSC-31 : tableau de charge
  const board = await ev(p, () => {
    closeOverlay('drawer');
    go('team');
    const opts = [...document.querySelectorAll('#teamLoadStatusFilter option')].map((o) => [o.value, o.textContent.trim()]);
    const cells = [...document.querySelectorAll('.rc-cell')];
    const unavCells = cells.filter((c) => c.classList.contains('unavailable'));
    return {
      opts,
      unavCells: unavCells.length,
      muted: unavCells.every((c) => c.classList.contains('muted')),
      label: unavCells[0]?.textContent.trim(),
      tip: unavCells[0]?.getAttribute('title'),
      filterWorks: (() => {
        app.ui.teamLoadStatusFilter = 'unavailable'; save(); renderPage();
        const rows = document.querySelectorAll('.load-row:not(.load-head)').length;
        app.ui.teamLoadStatusFilter = 'all'; save(); renderPage();
        return rows;
      })(),
    };
  });
  note('RSC-31', board);
  ok(board.opts.some(([v, l]) => v === 'unavailable' && /Indisponible/.test(l)), 'RSC-31 : le filtre de charge propose « Indisponible »', 'RSC-31');
  ok(board.unavCells > 0 && board.muted, 'RSC-31 : les cellules indisponibles portent le ton calme (muted), pas une alerte', 'RSC-31');
  ok(/Indispo/.test(board.label || ''), 'RSC-31 : la cellule est libellée « Indispo. »', 'RSC-31');
  ok(/révision|maintenance|congé/i.test(board.tip || ''), 'RSC-31 : l’infobulle explique le motif de l’indisponibilité', 'RSC-31');
  ok(board.filterWorks > 0 && board.filterWorks < 10, 'RSC-31 : filtrer sur « Indisponible » restreint bien le tableau', 'RSC-31');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '04-charge-indisponible.png', fullPage: true });

  await ctx.close();
}

// ============================================================
// G. ÉDITEURS, PLANNING, AFFICHAGES (RSC-32 → RSC-33)
// ============================================================
console.log('\n[RSC-32..33] Éditeur universel, historique, Planning, affichages secondaires');
{
  const { ctx, p } = await newPage({ tag: 'G' });

  // ---- RSC-32 : éditeur universel + création + historique
  const ed = await ev(p, () => {
    openTaskEdit('k-lining', 'planning-gantt');
    const f = document.querySelector('#taskEditForm');
    const mainOpts = [...f.querySelectorAll('[name=resourceId] option')].map((o) => o.value).filter(Boolean);
    const equipInMain = mainOpts.filter((id) => resource(id)?.type === 'equipment');
    const groups = [...f.querySelectorAll('.res-pick-group > small')].map((x) => x.textContent.trim());
    // On coche une grue + un camion.
    const boxes = [...f.querySelectorAll('input[name=additionalResourceIds]')];
    boxes.filter((x) => ['crane-g01', 'truck-cb02'].includes(x.value)).forEach((x) => { x.checked = true; });
    const beforeMain = task('k-lining').resourceId;
    submitTaskEdit();
    const t = task('k-lining');
    const h = app.history.find((x) => x.taskId === 'k-lining' && x.changes?.length);
    return {
      equipInMain, groups,
      extras: t.additionalResourceIds,
      mobilised: taskResourceIds(t).length,
      beforeMain,
      changes: (h?.changes || []).map((c) => c.field),
      extrasChange: (h?.changes || []).find((c) => c.field === 'Ressources complémentaires'),
    };
  });
  note('RSC-32', ed);
  ok(ed.equipInMain.length === 0, 'RSC-32 : le matériel n’est PAS proposé comme intervenant principal', 'RSC-32');
  ok(JSON.stringify(ed.groups) === JSON.stringify(['PERSONNES', 'ENTREPRISES', 'MATÉRIEL']), 'RSC-32 : les ressources complémentaires sont groupées par famille', 'RSC-32');
  ok(ed.extras.includes('crane-g01') && ed.extras.includes('truck-cb02') && ed.mobilised === 3,
    'RSC-32 : une intervention mobilise bien PLUSIEURS ressources (1 principal + 2 complémentaires)', 'RSC-32');
  ok(ed.changes.includes('Ressources complémentaires') && /Grue|Camion/.test(ed.extrasChange?.to || ''),
    'RSC-32 : l’historique trace le champ « Ressources complémentaires » avec avant → après', 'RSC-32');

  // Création : le même dispositif existe dans « Nouvelle tâche ».
  const create = await ev(p, () => {
    openTaskForm('keravel');
    const f = document.querySelector('#drawerFormEl');
    const has = { main: !!f.querySelector('[name=resourceId]'), picker: !!f.querySelector('#resPicker'), warn: !!f.querySelector('#taskResWarn') };
    f.querySelector('[name=name]').value = 'Levage charpente';
    f.querySelector('[name=resourceId]').value = 'thomas';
    f.querySelector('[name=resourceId]').dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('input[name=additionalResourceIds][value=crane-g01]').checked = true;
    f.requestSubmit();
    const t = app.tasks.at(-1);
    return { has, name: t.name, main: t.resourceId, extras: t.additionalResourceIds };
  });
  note('RSC-32-création', create);
  ok(create.has.main && create.has.picker && create.has.warn, 'RSC-32 : « Nouvelle tâche » offre EXACTEMENT le même dispositif que l’éditeur universel', 'RSC-32');
  ok(create.name === 'Levage charpente' && create.main === 'thomas' && create.extras.includes('crane-g01'),
    'RSC-32 : la tâche créée mémorise intervenant principal ET ressources complémentaires', 'RSC-32');
  await ev(p, () => { openTaskEdit('k-lining', 'planning-gantt'); });
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '06-editeur-ressources.png' });
  await ev(p, () => closeOverlay('drawer'));

  // ---- RSC-33 : Planning et affichages secondaires
  const plan = await ev(p, () => {
    go('planning');
    app.settings.period = 'week'; save(); renderPage();
    const sel = [...document.querySelectorAll('select')].find((s) => s.getAttribute('aria-label') === 'Filtrer par ressource');
    const groups = [...sel.querySelectorAll('optgroup')].map((o) => o.label);
    // Filtrer sur le camion : la tâche où il n'est QUE complémentaire doit rester.
    app.ui.planningResource = 'truck-cb02'; save(); renderPage();
    const filtered = planningTasks().map((t) => t.id);
    app.ui.planningResource = 'all'; save(); renderPage();
    return {
      groups, filtered,
      badges: document.querySelectorAll('.g-label .extra-res').length,
      barTitle: document.querySelector('.g-bar[id^=bar-]')?.getAttribute('title') || '',
    };
  });
  note('RSC-33', plan);
  ok(JSON.stringify(plan.groups) === JSON.stringify(['Personnes', 'Entreprises', 'Matériel']), 'RSC-33 : le filtre Planning regroupe les ressources par famille', 'RSC-33');
  ok(plan.filtered.includes('k-windows'), 'RSC-33 : filtrer sur une ressource montre les tâches où elle est MOBILISÉE (même en complément)', 'RSC-33');
  ok(plan.badges > 0, 'RSC-33 : la mention « +N » apparaît en métadonnée secondaire (jamais en titre)', 'RSC-33');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '07-planning-filtre-materiel.png' });

  const cards = await ev(p, () => {
    app.ui.planningView = 'kanban'; save(); renderPage();
    const kb = document.querySelectorAll('.kb-meta .extra-res').length;
    app.ui.planningView = 'gantt'; save(); renderPage();
    openTask('k-windows');
    const sheet = document.querySelector('#drawerContent').textContent;
    closeOverlay('drawer');
    return { kb, sheetHasRessources: /Ressources/.test(sheet), sheetNames: /Camion/.test(sheet) };
  });
  note('RSC-33-cartes', cards);
  ok(cards.kb > 0, 'RSC-33 : la carte Kanban porte la même mention discrète « +N »', 'RSC-33');
  ok(cards.sheetHasRessources && cards.sheetNames, 'RSC-33 : la fiche tâche liste « Ressources » en plus de l’intervenant principal', 'RSC-33');
  await ev(p, () => { openTask('k-windows'); });
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '08-fiche-tache-ressources.png' });

  // Mode Chantier : « Matériel : … »
  const field = await ev(p, () => {
    closeOverlay('drawer');
    enterFieldMode();
    openTask('k-windows');
    const txt = document.querySelector('#modalContent').textContent;
    return { isField: isFieldMode(), material: /Matériel\s*:/.test(txt), named: /Camion/.test(txt) };
  });
  note('RSC-33-chantier', field);
  ok(field.isField && field.material && field.named, 'RSC-33 : en Mode Chantier, la tâche annonce « Matériel : … » (je viens avec quoi)', 'RSC-33');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '09-mode-chantier-materiel.png' });

  await ctx.close();
}

// ============================================================
// H. SAUVEGARDE, IMPORT, CYCLE DE VIE (RSC-34 → RSC-35)
// ============================================================
console.log('\n[RSC-34..35] Sauvegarde, restauration d’une sauvegarde V8, import, suppression');
{
  const { ctx, p } = await newPage({ tag: 'H' });

  // ---- RSC-34 : la sauvegarde transporte les indisponibilités
  const backup = await ev(p, () => {
    const payload = buildKanvixBackup();
    return {
      required: KANVIX_BACKUP_REQUIRED,
      requiresUnav: KANVIX_BACKUP_REQUIRED.includes('resourceUnavailabilities'),
      carries: Array.isArray(payload.state.resourceUnavailabilities) && payload.state.resourceUnavailabilities.length,
      extras: payload.state.tasks.every((t) => Array.isArray(t.additionalResourceIds)),
      schema: payload.schemaVersion,
      version: payload.appVersion,
    };
  });
  note('RSC-34', backup);
  ok(backup.carries === 2 && backup.extras, 'RSC-34 : la sauvegarde transporte indisponibilités ET ressources complémentaires', 'RSC-34');
  ok(!backup.requiresUnav, 'RSC-34 : resourceUnavailabilities n’est PAS exigée — une sauvegarde V8 reste valide', 'RSC-34');
  ok(backup.schema === 9 && backup.version === '2.5.0', 'RSC-34 : la sauvegarde s’annonce en schéma 9 / version 2.5.0', 'RSC-34');

  // Restauration d'une sauvegarde V8 (sans les nouveautés) : acceptée + migrée.
  const legacy = await ev(p, () => {
    const payload = buildKanvixBackup();
    payload.schemaVersion = 8;
    payload.appVersion = '2.4.15.6';
    delete payload.state.resourceUnavailabilities;
    payload.state.schemaVersion = 8;
    payload.state.tasks.forEach((t) => { delete t.additionalResourceIds; });
    payload.state.resources = payload.state.resources.filter((r) => r.type !== 'equipment');
    const check = validateKanvixBackup(payload);
    pendingKanvixBackup = payload;
    showKanvixBackupPreview(payload);
    const preview = document.querySelector('#modalContent').textContent;
    confirmKanvixRestore();
    return {
      check,
      previewMentionsUnav: /indisponibilité/i.test(preview),
      schema: app.schemaVersion,
      unav: app.resourceUnavailabilities.length,
      extras: app.tasks.every((t) => Array.isArray(t.additionalResourceIds)),
      tasks: app.tasks.length,
    };
  });
  note('RSC-34-legacy', legacy);
  ok(legacy.check.ok, 'RSC-34 : une sauvegarde V8 (sans indisponibilités ni matériel) est ACCEPTÉE', 'RSC-34');
  ok(!legacy.previewMentionsUnav, 'RSC-34 : l’aperçu d’une sauvegarde V8 n’invente pas une ligne « indisponibilités »', 'RSC-34');
  ok(legacy.schema === 9 && legacy.unav === 0 && legacy.extras, 'RSC-34 : la restauration migre l’état V8 vers le schéma 9 sans rien casser', 'RSC-34');

  // L'aperçu d'une sauvegarde V2.5 COMPTE les indisponibilités.
  await ev(p, () => { resetApp(); dismissKanvixContinuityNotice(); });
  const preview25 = await ev(p, () => {
    showKanvixBackupPreview(buildKanvixBackup());
    return document.querySelector('#modalContent').textContent;
  });
  note('RSC-34-apercu', preview25.slice(0, 220));
  ok(/2 indisponibilités/.test(preview25), 'RSC-34 : l’aperçu d’une sauvegarde V2.5 annonce « 2 indisponibilités »', 'RSC-34');
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '10-sauvegarde-apercu.png' });
  await ev(p, () => closeOverlay('modal'));

  // ---- RSC-35 : import — références inconnues écartées et DOCUMENTÉES
  const imp = await ev(p, () => {
    const S = structuredClone({ ...app, undoStack: [] });
    const plan = {
      replaceAll: false,
      data: {
        tasks: [{
          id: 'imp-task-1', name: 'Tâche importée', projectId: 'keravel',
          resourceId: 'thomas', additionalResourceIds: ['crane-g01', 'res-inconnue-1', 'res-inconnue-2'],
          start: '2026-11-10T08:00', end: '2026-11-10T17:00',
        }],
        milestones: [],
      },
      projectOps: [{ action: 'merge', imported: { id: 'keravel', name: 'Résidence Keravel' }, existingId: 'keravel', taskStrategy: 'add' }],
      templateOps: [],
    };
    const sum = applyImportPlan(plan, S);
    const valid = validateImportState(S);
    const t = S.tasks.find((x) => x.id === 'imp-task-1') || S.tasks.at(-1);
    return {
      extras: t?.additionalResourceIds,
      droppedRefs: sum.dropped.resourceRefs,
      lines: impDroppedLines(sum),
      valid: valid.ok,
      errors: valid.errors.slice(0, 3),
    };
  });
  note('RSC-35', imp);
  ok(JSON.stringify(imp.extras) === JSON.stringify(['crane-g01']), 'RSC-35 : l’import écarte les ressources complémentaires inconnues', 'RSC-35');
  ok(imp.valid && imp.errors.length === 0, 'RSC-35 : 0 référence orpheline après import', 'RSC-35');
  ok(imp.droppedRefs === 2 && imp.lines.some((l) => /affectations de ressource non reconnues/.test(l)),
    'RSC-35 : les pertes sont COMPTÉES et ANNONCÉES (jamais silencieuses)', 'RSC-35');

  // Suppression / archivage d'une ressource
  const life = await ev(p, () => {
    // L'archivage CONSERVE les indisponibilités (la fiche existe toujours).
    const nBefore = getResourceUnavailabilities('crane-g01').length;
    confirmArchiveResource('crane-g01');
    const afterArchive = getResourceUnavailabilities('crane-g01').length;
    restoreResource('crane-g01');
    // La suppression les emporte (aucune période orpheline).
    openUnavailabilityForm('lift-n03');
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=start]').value = '2026-12-01';
    f.querySelector('[name=end]').value = '2026-12-02';
    f.requestSubmit();
    const liftUnav = getResourceUnavailabilities('lift-n03').length;
    deleteResource('lift-n03');
    const prompt = document.querySelector('#modalContent').textContent;
    confirmDeleteResource('lift-n03');
    return {
      nBefore, afterArchive, liftUnav,
      prompt,
      left: (app.resourceUnavailabilities || []).filter((u) => u.resourceId === 'lift-n03').length,
      gone: !resource('lift-n03'),
      orphans: (app.resourceUnavailabilities || []).filter((u) => !resource(u.resourceId)).length,
    };
  });
  note('RSC-35-cycle', life);
  ok(life.nBefore === 1 && life.afterArchive === 1, 'RSC-35 : ARCHIVER une ressource conserve ses indisponibilités', 'RSC-35');
  ok(/période d’indisponibilité/.test(life.prompt), 'RSC-35 : la confirmation de suppression annonce les périodes emportées', 'RSC-35');
  ok(life.gone && life.left === 0 && life.orphans === 0, 'RSC-35 : SUPPRIMER une ressource supprime ses indisponibilités — aucune période orpheline', 'RSC-35');

  await ctx.close();
}

// ============================================================
// GEL BYTE-IDENTITÉ — les moteurs non concernés n'ont pas bougé
// ============================================================
console.log('\n[FREEZE-250] Byte-identité des moteurs hors périmètre V2.5.0');
{
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
  function extractFn(src, name) {
    const re = new RegExp(`function\\s+${name}\\s*\\(`);
    const m = re.exec(src);
    if (!m) return null;
    let j = src.indexOf('(', m.index), depthP = 0;
    for (; j < src.length; j++) {
      if (src[j] === '(') depthP++;
      else if (src[j] === ')') { depthP--; if (depthP === 0) { j++; break; } }
    }
    let i = src.indexOf('{', j);
    if (i < 0) return null;
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
    }
    return null;
  }
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
    /* V2.9.0 — RE-BASELINE des listes de gel. Six moteurs ont été étendus par
       la STRUCTURE, à la demande explicite du produit ; ils sortent donc de la
       liste des « inchangés », sans que rien d'autre n'y soit relâché :
         · planningTasks            — §18 : quatrième axe de filtrage (périmètre
                                      structure). Sans cet axe, le Gantt d'un
                                      niveau exigerait un second moteur.
         · migrateState             — §43 : migration 12 → 13
         · applyImportPlan          — §47/§48 : aucune référence orpheline
         · openTask                 — §31/§32 : l'emplacement de la tâche
         · planningCreatePointerUp  — §22 : le niveau voyage avec le geste
         · operationProjectCard     — §26 : mention discrète « N niveaux »
       Tous les autres moteurs de ces listes restent vérifiés byte à byte. */
  const engines = [
    'scale', 'pos', 'dropTask', 'shiftPlanning', 'planningToday', 'setPeriod',
    'planReflow', 'applyReflowPlan', 'setTaskStatus', 'kanbanDrop', 'kanbanBoard',
    'requestTaskScheduleMove', 'applySimulation', 'evaluateDependencyConflicts',
    'getMaxConcurrentTasks', 'getResourceLoad', 'getResourceWeekDays', 'getCurrentWeekRange',
    'getResourceConflicts', 'getTaskPredecessors', 'getTaskSuccessors', 'taskCreatesCycle',
    'historyProjectId', 'projectHistory', 'historyStamp', 'historyGroups', 'taskActivity',
    'reopenProject', 'restoreProject', 'confirmCloseProject', 'getProjectSummary',
    'siteCard', 'projectVisual', 'projectCardMenu', 'hasReworkSignaled', 'openReworkForm',
    'buildKanvixBackup', 'confirmKanvixRestore', 'analyzeKanvixImport', 'buildImportPlan',
    'nextWorkingTime', 'workdayDelay', 'getWeekNumber', 'weekBounds',
    'toggleUserMenu', 'renderUserMenu', 'openConversation',
  ];
  let identical = 0, moved = [];
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    if (a && c && md5(a) === md5(c)) identical++;
    else moved.push(`${name} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-250', { gelés: identical, bougés: moved });
  ok(moved.length === 0, `FREEZE-250 : ${engines.length} moteurs hors périmètre byte-identiques à V2.4.15.6`, 'FREEZE-250');

  // Les moteurs DU périmètre ont bien changé (sinon la version n'apporte rien).
  const expectedChanged = ['getResourceTasks', 'getResourceState', 'evaluateScenario', 'planningProblems', 'planningTasks', 'openTaskForm', 'openTaskEdit', 'submitTaskEdit', 'renderTeam', 'applyImportPlan', 'validateImportState', 'confirmDeleteResource'];
  const stillSame = expectedChanged.filter((n) => {
    const a = extractFn(prevSrc, n), c = extractFn(curSrc, n);
    return a && c && md5(a) === md5(c);
  });
  note('FREEZE-250-changés', { inchangés: stillSame });
  ok(stillSame.length === 0, 'FREEZE-250 : les moteurs du périmètre V2.5.0 ont bien évolué', 'FREEZE-250');

  // Et aucune duplication de moteur : une seule définition par nom.
  const dupes = ['getResourceTasks', 'getResourceState', 'getResourceSchedulingConflicts', 'taskResourceIds', 'normalizeTaskResources']
    .filter((n) => (curSrc.match(new RegExp(`function\\s+${n}\\s*\\(`, 'g')) || []).length !== 1);
  ok(dupes.length === 0, 'FREEZE-250 : un seul moteur par concern (aucune définition dupliquée)', 'FREEZE-250');
}

// ============================================================
// RENDU MOBILE + THÈME SOMBRE (captures)
// ============================================================
{
  const { ctx, p } = await newPage({ tag: 'MOBILE', w: 390, h: 844 });
  await ev(p, () => { go('team'); });
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '11-ressources-mobile.png', fullPage: true });
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'DARK' });
  await ev(p, () => { setAppearance('dark'); go('team'); openResource('crane-g01'); });
  await p.waitForTimeout(150);
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + '12-fiche-materiel-sombre.png' });
  await ctx.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-250] Erreurs JavaScript applicatives');
note('CONSOLE-250', allErrs);
ok(allErrs.length === 0, 'CONSOLE-250 : 0 erreur JavaScript applicative sur l’ensemble de la recette', 'CONSOLE-250');

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
