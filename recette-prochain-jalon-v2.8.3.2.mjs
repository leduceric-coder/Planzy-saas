// ============================================================
// KANVIX — Recette « Cohérence du bandeau Prochain jalon » (V2.8.3.2)
//
//   Correctif SÉMANTIQUE, aucune modification visuelle. Le bandeau de synthèse
//   répondait par la seule DATE tandis que la frise répondait par
//   milestoneStatus() : un jalon daté au 27 août dont la tâche était TERMINÉE
//   s'affichait « Atteint » sur sa carte et restait annoncé « Prochain jalon ».
//
//   La question à laquelle cette recette répond :
//     « Le bandeau de synthèse utilise-t-il désormais la même vérité métier que
//       les statuts des jalons, sans modifier la chronologie, la frise, ni
//       aucun autre moteur ? »
//
//   Usage : node recette-prochain-jalon-v2.8.3.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.3.2.html';
const PREV = 'kanvix-next-gen-v2.8.3.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.3.2/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const OP = 'op-brest-ouest';

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
  const { w = 1440, h = 1000, tag = 'x', file = CUR } = opts;
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
  await p.evaluate(() => {
    resetApp(); setDepth('pilot'); setRole('driver');
    dismissKanvixContinuityNotice();
    const t = document.querySelector('#toast'); if (t) t.style.display = 'none';
  });
  await p.evaluate((id) => { window.OP = id; }, OP);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name) => { await p.waitForTimeout(280); await p.screenshot({ path: SHOTS + name, fullPage: true }); };

/* Banc d'essai. On décrit des jalons entièrement, on rend la page, puis on lit
   le bandeau de synthèse TEL QU'AFFICHÉ — pas seulement ce que renvoie une
   fonction. La fin estimée du chantier est poussée loin pour que la règle de
   date reste tentante à chaque scénario. */
const scenario = (p, spec) => ev(p, (spec) => {
  resetApp(); setDepth('pilot');
  app.milestones.length = 0;
  (spec.tasks || []).forEach((t) => app.tasks.push({
    id: t.id, projectId: t.projectId || 'keravel', name: t.name || t.id,
    resourceId: null, status: t.status || 'todo',
    start: shiftDateStr(dayKey(TODAY), t.endOffset) + 'T08:00',
    end: shiftDateStr(dayKey(TODAY), t.endOffset) + 'T17:00',
  }));
  (spec.milestones || []).forEach((m, i) => app.milestones.push({
    id: 'ms-' + i,
    projectId: m.projectId || 'keravel',
    name: m.name || ('Jalon ' + i),
    date: m.offset === null ? null : shiftDateStr(dayKey(TODAY), m.offset) + 'T17:00',
    isFinal: m.isFinal === true,
    taskId: m.taskId === undefined ? null : m.taskId,
  }));
  (spec.closed || []).forEach((pid) => { project(pid).lifecycle = 'closed'; });
  save();
  go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
  const tiles = [...document.querySelectorAll('.op-tl-stat')];
  return {
    badges: [...document.querySelectorAll('.op-ms')].map((e) => e.querySelector('.op-badge').textContent.trim()),
    noms: [...document.querySelectorAll('.op-ms-name')].map((e) => e.textContent),
    prochain: {
      titre: tiles[1]?.querySelector('.op-tl-stat-body > b')?.textContent.trim(),
      sous: tiles[1]?.querySelector('.op-tl-stat-body > span')?.textContent.trim(),
      muted: !!tiles[1]?.querySelector('b.muted'),
    },
    chantier: {
      label: tiles[2]?.querySelector('.op-tl-stat-body > small')?.textContent.trim(),
      nom: tiles[2]?.querySelector('.op-tl-stat-body > b')?.textContent.trim(),
      sous: tiles[2]?.querySelector('.op-tl-stat-body > span')?.textContent.trim(),
    },
    upcoming: app.milestones.map((m) => ({ nom: m.name, up: isUpcomingMilestone(m), key: milestoneStatus(m).key })),
  };
}, spec);

// ============================================================
// NEXT-01 → NEXT-03 — Ce qui compte comme « restant à traiter »
// ============================================================
console.log('\n[NEXT-CHOIX] Sélection du prochain jalon');
{
  const { ctx, p } = await newPage({ tag: 'CHOIX' });

  // NEXT-01 — un jalon FUTUR mais déjà ATTEINT n'est plus le prochain.
  const r1 = await scenario(p, {
    tasks: [{ id: 'tk1', status: 'done', endOffset: 2 }],
    milestones: [{ name: 'Pose des menuiseries', offset: 10, taskId: 'tk1' }],
  });
  note('NEXT-01', r1);
  ok(r1.badges[0] === 'Atteint' && r1.prochain.titre === 'Aucun à venir' && r1.prochain.muted
    && r1.upcoming[0].up === false,
    'NEXT-01 : un jalon daté dans le futur mais déjà « Atteint » n’est PLUS annoncé comme prochain jalon — la contradiction de V2.8.3.1 est levée', 'NEXT-01');
  await shot(p, '01-futur-atteint-pas-prochain.png');

  // NEXT-02 — il est enjambé au profit du suivant réellement à traiter.
  const r2 = await scenario(p, {
    tasks: [{ id: 'tk2', status: 'done', endOffset: 1 }],
    milestones: [
      { name: 'Étape A', offset: 5, taskId: 'tk2' },
      { name: 'Étape B', offset: 8 },
    ],
  });
  note('NEXT-02', r2);
  ok(r2.badges.join('|') === 'Atteint|À venir'
    && /Étape B/.test(r2.prochain.sous) && !r2.prochain.muted,
    'NEXT-02 : le jalon atteint est enjambé — le prochain jalon est « Étape B », le premier réellement restant à traiter', 'NEXT-02');
  await shot(p, '02-atteint-puis-a-venir.png');

  // NEXT-03 — un jalon MENACÉ reste devant nous : il peut être le prochain.
  const r3 = await scenario(p, {
    milestones: [
      { name: 'Livraison', offset: 5, isFinal: true },
      { name: 'Étape B', offset: 8 },
    ],
    tasks: [{ id: 'tk-fin', status: 'todo', endOffset: 40 }],
  });
  note('NEXT-03', r3);
  ok(r3.badges[0] === 'Menacé' && /Livraison/.test(r3.prochain.sous) && r3.upcoming[0].up === true,
    'NEXT-03 : un jalon « Menacé » reste un jalon à traiter — il est bien retenu comme prochain jalon', 'NEXT-03');
  await shot(p, '03-menace-prochain.png');
  await ctx.close();
}

// ============================================================
// NEXT-04 → NEXT-06 — Les statuts exclus
// ============================================================
console.log('\n[NEXT-EXCLUS] Statuts qui ne peuvent jamais être « prochain »');
{
  const { ctx, p } = await newPage({ tag: 'EXCLUS' });

  // NEXT-04 — « Dépassé » n'est jamais upcoming.
  const r4 = await scenario(p, {
    tasks: [{ id: 'tk4', status: 'todo', endOffset: -1 }],
    milestones: [
      { name: 'Reprise en retard', offset: -3, taskId: 'tk4' },
      { name: 'Étape suivante', offset: 9 },
    ],
  });
  note('NEXT-04', r4);
  ok(r4.badges[0] === 'Dépassé' && r4.upcoming[0].up === false && /Étape suivante/.test(r4.prochain.sous),
    'NEXT-04 : un jalon « Dépassé » n’est jamais sélectionné comme prochain — c’est un retard, pas une échéance à venir', 'NEXT-04');

  // NEXT-05 — « Date passée » non plus.
  const r5 = await scenario(p, {
    milestones: [
      { name: 'Fondations', offset: -12 },
      { name: 'Étape suivante', offset: 9 },
    ],
  });
  note('NEXT-05', r5);
  ok(r5.badges[0] === 'Date passée' && r5.upcoming[0].up === false && /Étape suivante/.test(r5.prochain.sous),
    'NEXT-05 : un jalon « Date passée » n’est jamais sélectionné comme prochain', 'NEXT-05');

  // NEXT-06 — ni un jalon futur porté par un chantier clôturé.
  const r6 = await scenario(p, {
    closed: ['terrasses'],
    milestones: [
      { name: 'Jalon du chantier clôturé', offset: 4, projectId: 'terrasses' },
      { name: 'Étape active', offset: 9 },
    ],
  });
  note('NEXT-06', r6);
  ok(r6.badges[0] === 'Chantier clôturé' && r6.upcoming[0].up === false
    && /Étape active/.test(r6.prochain.sous),
    'NEXT-06 : un jalon futur sur un chantier clôturé reste « Chantier clôturé » et n’est jamais le prochain jalon', 'NEXT-06');
  await ctx.close();
}

// ============================================================
// NEXT-07 → NEXT-09 — Mix complet, compteur, multi-chantiers
// ============================================================
console.log('\n[NEXT-MIX] Scénarios composés');
{
  const { ctx, p } = await newPage({ tag: 'MIX' });

  // NEXT-07 — les quatre natures cohabitent, une seule est retenue.
  const r7 = await scenario(p, {
    tasks: [{ id: 'tk7', status: 'done', endOffset: 1 }, { id: 'tk-fin7', status: 'todo', endOffset: 40 }],
    milestones: [
      { name: 'A — passée', offset: -6 },
      { name: 'B — atteinte', offset: 4, taskId: 'tk7' },
      { name: 'C — à venir', offset: 7 },
      { name: 'D — menacée', offset: 10, isFinal: true },
    ],
  });
  note('NEXT-07', r7);
  ok(r7.badges.join('|') === 'Date passée|Atteint|À venir|Menacé'
    && /C — à venir/.test(r7.prochain.sous)
    && r7.upcoming.map((x) => x.up).join('|') === 'false|false|true|true',
    'NEXT-07 : avec « Date passée », « Atteint », « À venir » et « Menacé » côte à côte, le prochain jalon est C — le premier chronologiquement restant à traiter', 'NEXT-07');

  // NEXT-08 — le compteur du chantier ne compte que ce qui reste à traiter.
  const r8 = await scenario(p, {
    tasks: [{ id: 'tk8', status: 'done', endOffset: 1 }],
    milestones: [
      { name: 'Atteint futur', offset: 5, taskId: 'tk8' },
      { name: 'À venir 1', offset: 7 },
      { name: 'À venir 2', offset: 11 },
      { name: 'Date passée', offset: -3 },
    ],
  });
  note('NEXT-08', r8);
  ok(r8.chantier.sous === '2 jalons à venir' && /Résidence Keravel/.test(r8.chantier.nom),
    'NEXT-08 : sur un chantier portant 1 atteint futur, 2 à venir et 1 date passée, le compteur annonce « 2 jalons à venir » — ni 3, ni 4', 'NEXT-08');

  // NEXT-09 — le chantier concerné suit le prochain jalon réel.
  const r9 = await scenario(p, {
    tasks: [{ id: 'tk9', status: 'done', endOffset: 1 }],
    milestones: [
      { name: 'Keravel atteint', offset: 4, projectId: 'keravel', taskId: 'tk9' },
      { name: 'Terrasses à venir', offset: 9, projectId: 'terrasses' },
    ],
  });
  note('NEXT-09', r9);
  ok(/Terrasses à venir/.test(r9.prochain.sous) && /Les Terrasses/.test(r9.chantier.nom)
    && r9.chantier.sous === '1 jalon à venir',
    'NEXT-09 : le chantier concerné est celui du prochain jalon RÉEL — Les Terrasses, et non Keravel dont le jalon est déjà atteint', 'NEXT-09');
  await ctx.close();
}

// ============================================================
// NEXT-10 → NEXT-13 — Cas limites, filtres, ordre
// ============================================================
console.log('\n[NEXT-LIMITES] Aucun restant, sans date, filtres, ordre');
{
  const { ctx, p } = await newPage({ tag: 'LIMITES' });

  // NEXT-10 — aucun jalon restant : le sous-texte ne doit pas mentir.
  const r10 = await scenario(p, {
    closed: ['terrasses'],
    tasks: [{ id: 'tk10', status: 'done', endOffset: 1 }, { id: 'tk10b', status: 'todo', endOffset: -1 }],
    milestones: [
      { name: 'Atteint futur', offset: 6, taskId: 'tk10' },
      { name: 'Date passée', offset: -4 },
      { name: 'Dépassé', offset: -2, taskId: 'tk10b' },
      { name: 'Clôturé', offset: 8, projectId: 'terrasses' },
    ],
  });
  note('NEXT-10', r10);
  ok(r10.badges.join('|') === 'Date passée|Dépassé|Atteint|Chantier clôturé'
    && r10.prochain.titre === 'Aucun à venir'
    && r10.prochain.sous === 'Aucun jalon restant à traiter'
    && r10.upcoming.every((x) => x.up === false),
    'NEXT-10 : sans aucun jalon restant, le bandeau dit « Aucun à venir · Aucun jalon restant à traiter » — et non « tous les jalons affichés sont passés », qui serait FAUX puisqu’un jalon futur est déjà atteint', 'NEXT-10');
  await shot(p, '04-aucun-jalon-restant.png');

  // NEXT-11 — un jalon sans date ne peut pas être situé, donc pas prochain.
  const errAvant = allErrs.length;
  const r11 = await scenario(p, {
    milestones: [
      { name: 'Jalon sans date', offset: null },
      { name: 'Étape datée', offset: 9 },
    ],
  });
  note('NEXT-11', { ...r11, erreursJS: allErrs.length - errAvant });
  ok(r11.upcoming.find((x) => x.nom === 'Jalon sans date').up === false
    && /Étape datée/.test(r11.prochain.sous) && allErrs.length === errAvant,
    'NEXT-11 : un jalon sans date n’est jamais désigné comme prochain — il est impossible de le situer — et cela ne produit aucune erreur JavaScript', 'NEXT-11');

  // NEXT-12 — la synthèse travaille sur la liste FILTRÉE, pas sur toute l'opération.
  const r12 = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.milestones.length = 0;
    app.milestones.push({ id: 'f1', projectId: 'keravel', name: 'A Keravel', date: shiftDateStr(dayKey(TODAY), 5) + 'T17:00', isFinal: false, taskId: null });
    app.milestones.push({ id: 'f2', projectId: 'terrasses', name: 'B Terrasses', date: shiftDateStr(dayKey(TODAY), 9) + 'T17:00', isFinal: false, taskId: null });
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const lire = () => document.querySelectorAll('.op-tl-stat')[1].querySelector('.op-tl-stat-body > span').textContent.trim();
    const avant = lire();
    toggleMilestoneSite('keravel');
    const apres = lire();
    const nom = document.querySelectorAll('.op-tl-stat')[2].querySelector('.op-tl-stat-body > b').textContent.trim();
    resetMilestoneFilters();
    return { avant, apres, chantier: nom };
  });
  note('NEXT-12', r12);
  ok(/A Keravel/.test(r12.avant) && /B Terrasses/.test(r12.apres) && /Les Terrasses/.test(r12.chantier),
    'NEXT-12 : masquer un chantier par filtre déplace le prochain jalon sur B — la synthèse travaille bien sur la liste VISIBLE, pas sur toute l’opération', 'NEXT-12');

  // NEXT-13 — aucun tri parallèle : l'ordre du moteur fait foi.
  const r13 = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.milestones.length = 0;
    [10, 3, 7].forEach((o, i) => app.milestones.push({ id: 'o' + i, projectId: 'keravel', name: 'J+' + o,
      date: shiftDateStr(dayKey(TODAY), o) + 'T17:00', isFinal: false, taskId: null }));
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const src = operationMilestoneStats.toString();
    return {
      ordreMoteur: operationMilestones(window.OP).map((m) => m.name),
      prochain: document.querySelectorAll('.op-tl-stat')[1].querySelector('.op-tl-stat-body > span').textContent.trim(),
      sansTri: !/\.sort\(/.test(src),
    };
  });
  note('NEXT-13', r13);
  ok(r13.ordreMoteur.join('|') === 'J+3|J+7|J+10' && /J\+3/.test(r13.prochain) && r13.sansTri,
    'NEXT-13 : le prochain jalon est le premier de l’ordre déjà produit par operationMilestones() — operationMilestoneStats() ne recrée aucun tri', 'NEXT-13');
  await ctx.close();
}

// ============================================================
// NEXT-14 — Le rail temporel est VOLONTAIREMENT inchangé
// ============================================================
console.log('\n[NEXT-RAIL] La chronologie ne bouge pas');
{
  /* Le rail répond à « où sommes-nous dans le temps ? » et doit rester piloté
     par la DATE. Le bandeau répond à « que reste-t-il à traiter ? ». Deux
     questions différentes : un jalon futur déjà atteint reste devant nous sur
     la frise, tout en cessant d'être une action à venir. */
  const mesure = async (file) => {
    const { ctx, p } = await newPage({ tag: 'RAIL', file });
    const r = await ev(p, () => {
      resetApp(); setDepth('pilot');
      app.milestones.length = 0;
      app.tasks.push({ id: 'tkr', projectId: 'keravel', name: 'Faite', resourceId: null, status: 'done',
        start: shiftDateStr(dayKey(TODAY), 1) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 1) + 'T17:00' });
      app.milestones.push({ id: 'r1', projectId: 'keravel', name: 'Passée', date: shiftDateStr(dayKey(TODAY), -5) + 'T17:00', isFinal: false, taskId: null });
      app.milestones.push({ id: 'r2', projectId: 'keravel', name: 'Future atteinte', date: shiftDateStr(dayKey(TODAY), 4) + 'T17:00', isFinal: false, taskId: 'tkr' });
      app.milestones.push({ id: 'r3', projectId: 'keravel', name: 'Future à venir', date: shiftDateStr(dayKey(TODAY), 9) + 'T17:00', isFinal: false, taskId: null });
      save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
      const ms = [...document.querySelectorAll('.op-ms')];
      return {
        seg: ms.map((e) => (e.classList.contains('seg-done') ? 'done' : 'todo')),
        next: ms.map((e) => e.classList.contains('is-next')),
        styles: ms.map((e) => getComputedStyle(e.querySelector('.op-ms-rail'), '::before').borderTopStyle),
      };
    });
    await ctx.close();
    return r;
  };
  const a = await mesure(PREV), c = await mesure(CUR);
  note('NEXT-14', { v2831: a, v2832: c });
  ok(JSON.stringify(a) === JSON.stringify(c) && a.next.filter(Boolean).length === 1
    && a.next[1] === true,
    'NEXT-14 : avec un jalon FUTUR déjà atteint, le rail (seg-done / seg-todo, trait plein / pointillé, repère is-next) est STRICTEMENT identique à V2.8.3.1 — la chronologie reste pilotée par la date', 'NEXT-14');
}

// ============================================================
// NEXT-15 → NEXT-17 — Données, schéma, magasin
// ============================================================
console.log('\n[NEXT-DONNEES] Immuabilité, schéma, magasin');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });
  await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons'); });
  await p.waitForTimeout(240);
  const mut = await ev(p, () => {
    const snap = () => JSON.stringify({ m: app.milestones, p: app.projects, t: app.tasks });
    const before = snap();
    operationMilestoneStats(window.OP, visibleOperationMilestones(window.OP));
    app.milestones.forEach((m) => isUpcomingMilestone(m));
    isUpcomingMilestone(null);
    isUpcomingMilestone({ date: null });
    return { identique: snap() === before, champs: Object.keys(app.milestones[0]).sort() };
  });
  note('NEXT-15', mut);
  ok(mut.identique && mut.champs.join('|') === ['date', 'id', 'isFinal', 'name', 'projectId', 'taskId'].join('|'),
    'NEXT-15 : operationMilestoneStats() et isUpcomingMilestone() ne modifient NI app.milestones, NI app.projects, NI app.tasks — et aucune propriété n’est ajoutée', 'NEXT-15');

  const socle = await ev(p, () => ({ schema: SCHEMA_VERSION, store: STORE }));
  note('NEXT-16', socle);
  ok(socle.schema === 12, 'NEXT-16 : SCHEMA_VERSION reste à 12 — aucune migration', 'NEXT-16');
  ok(socle.store === 'kanvix-product-8-3', 'NEXT-17 : STORE reste « kanvix-product-8-3 »', 'NEXT-17');
  await ctx.close();
}

// ============================================================
// VISUEL — V2.8.3.2 doit être indiscernable de V2.8.3.1
// ============================================================
console.log('\n[NEXT-VISUEL] Aucune modification de composition');
{
  const mesure = async (file, w) => {
    const { ctx, p } = await newPage({ w, h: 1000, tag: 'V' + w, file });
    await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons'); });
    await p.waitForTimeout(260);
    const r = await ev(p, () => {
      const ms = [...document.querySelectorAll('.op-ms')];
      const top0 = Math.round(ms[0].getBoundingClientRect().top);
      const cs = getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before');
      const bub = ms[0].querySelector('.op-ms-bub').getBoundingClientRect();
      return {
        colonnes: ms.filter((e) => Math.round(e.getBoundingClientRect().top) === top0).length,
        cartes: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().width)),
        hauts: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().top)),
        rail: cs.borderTopWidth + '/' + cs.borderTopStyle,
        bulle: Math.round(bub.width) + 'x' + Math.round(bub.height),
        // Squelette COMPLET, texte exclu : cette version ne touche à aucune classe.
        squelette: [...document.querySelector('.op-body').querySelectorAll('*')]
          .map((e) => e.tagName + '.' + [...e.classList].join('.')).join('|'),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        synthese: [...document.querySelectorAll('.op-tl-stat')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      };
    });
    await ctx.close();
    return r;
  };
  for (const w of [1440, 390]) {
    const a = await mesure(PREV, w), c = await mesure(CUR, w);
    const compo = (x) => { const { synthese, ...rest } = x; return rest; };
    note('VISUEL', { largeur: w, v2831: compo(a), identique: JSON.stringify(compo(a)) === JSON.stringify(compo(c)) });
    ok(JSON.stringify(compo(a)) === JSON.stringify(compo(c)),
      `VISUEL : à ${w}px, colonnes, cartes, rail, bulles, squelette DOM COMPLET (classes incluses) et débordement sont STRICTEMENT identiques à V2.8.3.1`, 'VISUEL');
    note('VISUEL-synthese', { largeur: w, v2831: a.synthese, v2832: c.synthese });
    ok(a.synthese.join('##') === c.synthese.join('##'),
      `VISUEL : à ${w}px, sur les données de démonstration le bandeau de synthèse est lui aussi inchangé — aucun jalon de démonstration n’était concerné par l’incohérence`, 'VISUEL');
  }
  for (const [w, h, name, dark] of [[1440, 900, '05-frise-desktop-compare.png', false], [390, 900, '06-frise-mobile-compare.png', false], [1440, 900, '07-frise-dark-compare.png', true]]) {
    const { ctx, p } = await newPage({ w, h, tag: 'SHOT' });
    if (dark) await ev(p, () => { app.ui.theme = 'dark'; document.body.classList.add('dark'); save(); });
    await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons'); });
    await shot(p, name);
    await ctx.close();
  }
  ok(true, 'VISUEL : parcours de captures exécuté sans erreur', 'VISUEL');
}

// ============================================================
// FREEZE-2832 — Périmètre du correctif
// ============================================================
console.log('\n[FREEZE-2832] Byte-identité');
{
  const curSrc = fs.readFileSync(BASE + CUR, 'utf8');
  const prevSrc = fs.readFileSync(BASE + PREV, 'utf8');
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
    'milestoneStatus', 'milestoneLinkedTask', 'milestoneOpenTasks', 'milestoneRelativeLabel',
    'operationMilestoneBar', 'operationMilestonesTab', 'operationMilestones',
    'visibleOperationMilestones', 'milestoneImpactNote', 'calculateProjectEnd', 'getProjectTasks',
    'isProjectActive', 'isProjectArchived', 'milestoneScope', 'milestoneHiddenSites',
    'setMilestoneScope', 'toggleMilestoneSite', 'resetMilestoneFilters', 'getCurrentWeekRange',
    'renderOperation', 'setOperationTab', 'selectOperation', 'operationOverviewTab',
    'operationAttentionGrid', 'operationProjectCard', 'operationPlanningTab',
    'operationResourcesTab', 'operationMacroPlanning', 'operationCard', 'operationCardMenu',
    'renderOperationsList', 'getOperationSummary', 'operationProjectIds', 'operationTasks',
    'planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'resourceLoadGroups',
    'getResourceSchedulingConflicts', 'getResourceState', 'getResourceLoad', 'getProjectHealth',
    'getProjectSummary', 'getProjectClosureStatus', 'pendingControlsForProject',
    'submitControlAttempt', 'controlFormHTML', 'openControlForm', 'controlRowHTML',
    'setTaskStatus', 'createRework', 'buildKanvixBackup', 'applyImportPlan', 'validateImportState',
    'exportKanvixData', 'migrateState', 'renderField', 'handleFieldSiteTab', 'fieldControlSection',
    'attentionCard', 'pageToday', 'getTodayDecisions', 'getTodayWarnings', 'renderSites',
    'siteCard', 'openProjectEdit', 'historyHTML', 'projectHistory', 'projectToneClass',
    'projectVisual', 'emptyState', 'icon',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-2832', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-2832 : les ${frozen.length} moteurs et rendus de V2.8.3.1 sont BYTE-IDENTIQUES — dont milestoneStatus(), milestoneOpenTasks(), operationMilestonesTab() et toute la frise`, 'FREEZE-2832');

  const changed = ['operationMilestoneStats'].filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['isUpcomingMilestone'].filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-2832-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 1 && added.length === 1,
    'FREEZE-2832 : operationMilestoneStats() est la SEULE fonction modifiée, isUpcomingMilestone() la seule ajoutée', 'FREEZE-2832');

  // Aucune règle CSS n'a été touchée.
  const css = (src) => src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  note('FREEZE-2832-css', { identique: md5(css(prevSrc)) === md5(css(curSrc)) });
  ok(md5(css(prevSrc)) === md5(css(curSrc)),
    'FREEZE-2832 : la feuille de style entière est BYTE-IDENTIQUE — aucune modification visuelle', 'FREEZE-2832');

  // La garantie structurelle : le rail n'emprunte pas la nouvelle définition.
  const tab = extract(curSrc, 'operationMilestonesTab');
  note('FREEZE-2832-rail', { railParDate: /date\(m\.date\) >= now/.test(tab), railSansUpcoming: !/isUpcomingMilestone/.test(tab) });
  ok(/date\(m\.date\) >= now/.test(tab) && !/isUpcomingMilestone/.test(tab),
    'FREEZE-2832 : operationMilestonesTab() continue de calculer nextIdx par la DATE et n’appelle jamais isUpcomingMilestone() — la chronologie et le reste-à-traiter demeurent deux notions séparées', 'FREEZE-2832');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-2832-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '12',
    'FREEZE-2832 : STORE et SCHEMA_VERSION (12) strictement inchangés', 'FREEZE-2832');
}

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
