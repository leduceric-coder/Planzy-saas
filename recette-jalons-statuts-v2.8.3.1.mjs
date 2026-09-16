// ============================================================
// KANVIX — Recette « Sémantique des statuts de jalons » (V2.8.3.1)
//
//   Correctif MÉTIER, aucune refonte visuelle. V2.8.3 appliquait à TOUS les
//   jalons la règle de fin de chantier, qui n'a de sens que pour un jalon
//   FINAL — « Fondations 10 octobre » d'un chantier livré en janvier était
//   déclaré « Menacé ». Et elle déclarait « Atteint » un jalon passé sans
//   intervention ouverte : une inférence présentée comme une certitude.
//
//   La question à laquelle cette recette répond :
//     « Kanvix distingue-t-il un jalon réellement atteint, un jalon réellement
//       menacé, un jalon final en dérive et une simple date intermédiaire
//       passée — sans transformer une estimation en certitude, et sans toucher
//       à la frise validée ? »
//
//   Usage : node recette-jalons-statuts-v2.8.3.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.3.1.html';
const PREV = 'kanvix-next-gen-v2.8.3.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.3.1/';
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
const openJalons = async (p) => {
  await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons'); });
  await p.waitForTimeout(260);
};
const shot = async (p, name) => { await p.waitForTimeout(280); await p.screenshot({ path: SHOTS + name, fullPage: true }); };

/* Banc d'essai : on remplace les jalons de démonstration par UN seul jalon
   entièrement décrit, puis on lit le statut rendu à l'écran — pas seulement
   celui que renvoie la fonction. Le chantier « keravel » est conservé actif et
   sa fin estimée est volontairement lointaine, pour que la règle de fin de
   chantier soit tentante à chaque fois. */
const scenario = (p, spec) => ev(p, (spec) => {
  resetApp(); setDepth('pilot');
  const pid = spec.projectId || 'keravel';
  if (spec.lifecycle) project(pid).lifecycle = spec.lifecycle;
  app.milestones.length = 0;
  (spec.milestones || []).forEach((m, i) => app.milestones.push({
    id: 'mt-' + i,
    projectId: pid,
    name: m.name || ('Jalon ' + i),
    date: m.offset === null ? null : shiftDateStr(dayKey(TODAY), m.offset) + 'T17:00',
    isFinal: m.isFinal === true,
    taskId: m.taskId === undefined ? null : m.taskId,
  }));
  (spec.tasks || []).forEach((t) => {
    const ex = task(t.id);
    const row = ex || { id: t.id, projectId: pid, name: t.name || t.id, resourceId: null, status: 'todo' };
    row.status = t.status || row.status;
    row.start = shiftDateStr(dayKey(TODAY), t.startOffset ?? t.endOffset) + 'T08:00';
    row.end = shiftDateStr(dayKey(TODAY), t.endOffset) + 'T17:00';
    if (!ex) app.tasks.push(row);
  });
  if (spec.projectEndOffset !== undefined) {
    // On pilote la fin estimée du chantier par une tâche terminale dédiée.
    app.tasks.push({ id: 'tk-end', projectId: pid, name: 'Dernière intervention',
      resourceId: null, status: 'todo',
      start: shiftDateStr(dayKey(TODAY), spec.projectEndOffset) + 'T08:00',
      end: shiftDateStr(dayKey(TODAY), spec.projectEndOffset) + 'T17:00' });
  }
  save();
  go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
  return {
    moteur: app.milestones.map((m) => milestoneStatus(m)),
    dom: [...document.querySelectorAll('.op-ms')].map((e) => ({
      badge: e.querySelector('.op-badge')?.textContent.trim(),
      st: [...e.classList].find((c) => c.startsWith('st-')),
      meta: e.querySelector('.op-ms-meta')?.textContent.trim(),
    })),
    finChantier: calculateProjectEnd(pid),
  };
}, spec);

// ============================================================
// STAT-01 → STAT-02 — Le chantier n'est plus actif (priorité absolue)
// ============================================================
console.log('\n[STAT-CLOTURE] Priorité 1 — chantier non actif');
{
  const { ctx, p } = await newPage({ tag: 'CLOTURE' });
  const closed = await scenario(p, { lifecycle: 'closed', projectEndOffset: 40,
    milestones: [{ name: 'Contrôle intermédiaire', offset: -5 }] });
  note('STAT-01', closed);
  ok(closed.dom[0].badge === 'Chantier clôturé' && closed.moteur[0].key === 'closed',
    'STAT-01 : sur un chantier clôturé, le jalon affiche « Chantier clôturé » — la règle prime sur toutes les autres', 'STAT-01');

  const arch = await scenario(p, { lifecycle: 'archived', projectEndOffset: 40,
    milestones: [{ name: 'Contrôle intermédiaire', offset: -5 }] });
  note('STAT-02', arch);
  ok(arch.dom[0].badge === 'Chantier archivé' && arch.moteur[0].key === 'closed',
    'STAT-02 : sur un chantier archivé, le jalon affiche « Chantier archivé »', 'STAT-02');
  await ctx.close();
}

// ============================================================
// STAT-03 → STAT-06 — Priorité 2 : la tâche associée fait foi
// ============================================================
console.log('\n[STAT-TACHE] Priorité 2 — jalon lié à une tâche');
{
  const { ctx, p } = await newPage({ tag: 'TACHE' });

  const done = await scenario(p, { projectEndOffset: 60,
    tasks: [{ id: 'tk-a', status: 'done', endOffset: 3 }],
    milestones: [{ name: 'Pose des menuiseries', offset: 10, taskId: 'tk-a' }] });
  note('STAT-03', done);
  ok(done.dom[0].badge === 'Atteint' && done.moteur[0].key === 'done',
    'STAT-03 : jalon lié à une tâche TERMINÉE et daté dans le futur → « Atteint » — une tâche achevée est une preuve, pas une estimation', 'STAT-03');
  await shot(p, '04-jalon-task-atteint.png');

  const late = await scenario(p, { projectEndOffset: 60,
    tasks: [{ id: 'tk-b', status: 'todo', endOffset: -2 }],
    milestones: [{ name: 'Fin réseaux', offset: -3, taskId: 'tk-b' }] });
  note('STAT-04', late);
  ok(late.dom[0].badge === 'Dépassé' && late.moteur[0].key === 'late',
    'STAT-04 : jalon lié à une tâche NON terminée et date passée → « Dépassé »', 'STAT-04');

  const risk = await scenario(p, { projectEndOffset: 60,
    tasks: [{ id: 'tk-c', status: 'todo', endOffset: 20 }],
    milestones: [{ name: 'Hors d’eau', offset: 12, taskId: 'tk-c' }] });
  note('STAT-05', risk);
  ok(risk.dom[0].badge === 'Menacé' && risk.moteur[0].key === 'risk',
    'STAT-05 : jalon futur dont la tâche associée finit APRÈS la cible → « Menacé » — la dépendance est explicite, la menace est établie', 'STAT-05');

  const fine = await scenario(p, { projectEndOffset: 60,
    tasks: [{ id: 'tk-d', status: 'todo', endOffset: 6 }],
    milestones: [{ name: 'Hors d’eau', offset: 12, taskId: 'tk-d' }] });
  note('STAT-06', fine);
  ok(fine.dom[0].badge === 'À venir' && fine.moteur[0].key === 'soon',
    'STAT-06 : jalon futur dont la tâche associée finit AVANT la cible → « À venir », même si le chantier se termine bien après', 'STAT-06');
  await ctx.close();
}

// ============================================================
// STAT-07 → STAT-09 — Priorité 3 : le jalon FINAL
// ============================================================
console.log('\n[STAT-FINAL] Priorité 3 — jalon final du chantier');
{
  const { ctx, p } = await newPage({ tag: 'FINAL' });

  const fpast = await scenario(p, { projectEndOffset: 30,
    milestones: [{ name: 'Livraison', offset: -4, isFinal: true }] });
  note('STAT-07', fpast);
  ok(fpast.dom[0].badge === 'Dépassé' && fpast.moteur[0].key === 'late',
    'STAT-07 : jalon FINAL passé alors que le chantier est encore actif → « Dépassé » — il n’est pas atteint', 'STAT-07');

  const frisk = await scenario(p, { projectEndOffset: 40,
    milestones: [{ name: 'Livraison', offset: 20, isFinal: true }] });
  note('STAT-08', frisk);
  ok(frisk.dom[0].badge === 'Menacé' && frisk.moteur[0].key === 'risk',
    'STAT-08 : jalon FINAL futur avec une fin de chantier estimée APRÈS la cible → « Menacé » — c’est ici, et seulement ici, que vit la règle historique', 'STAT-08');
  await shot(p, '03-jalon-final-menace.png');

  const fok = await scenario(p, { projectEndOffset: 10,
    milestones: [{ name: 'Livraison', offset: 25, isFinal: true }] });
  note('STAT-09', fok);
  ok(fok.dom[0].badge === 'À venir' && fok.moteur[0].key === 'soon',
    'STAT-09 : jalon FINAL futur avec une fin de chantier estimée AVANT la cible → « À venir »', 'STAT-09');
  await ctx.close();
}

// ============================================================
// STAT-10 → STAT-12 — Priorité 4 : le jalon intermédiaire sans tâche
// ============================================================
console.log('\n[STAT-INTER] Priorité 4 — jalon intermédiaire sans tâche');
{
  const { ctx, p } = await newPage({ tag: 'INTER' });

  // LE défaut de V2.8.3 : la fin du chantier est volontairement très au-delà.
  const ifut = await scenario(p, { projectEndOffset: 90,
    milestones: [{ name: 'Fondations', offset: 8 }] });
  note('STAT-10', { ...ifut, finChantier: ifut.finChantier });
  ok(ifut.dom[0].badge === 'À venir' && ifut.moteur[0].key === 'soon',
    'STAT-10 : jalon INTERMÉDIAIRE futur sans tâche → « À venir », alors même que le chantier se termine 82 jours plus tard — il n’est PLUS déclaré « Menacé »', 'STAT-10');
  await shot(p, '01-jalon-intermediaire-futur.png');

  const ipast = await scenario(p, { projectEndOffset: 90,
    milestones: [{ name: 'Fondations', offset: -12 }] });
  note('STAT-11', ipast);
  ok(ipast.dom[0].badge === 'Date passée' && ipast.moteur[0].key === 'past'
    && ipast.moteur[0].tone === '',
    'STAT-11 : jalon INTERMÉDIAIRE passé sans tâche → « Date passée », tonalité NEUTRE — ni « Atteint », ni « Dépassé » : Kanvix n’invente pas une preuve d’achèvement', 'STAT-11');
  await shot(p, '02-jalon-intermediaire-date-passee.png');

  const errBefore = allErrs.length;
  const bad = await scenario(p, { projectEndOffset: 90,
    milestones: [{ name: 'Jalon orphelin', offset: -6, taskId: 'does-not-exist' }] });
  note('STAT-12', { ...bad, erreursJS: allErrs.length - errBefore });
  ok(bad.dom[0].badge === 'Date passée' && bad.moteur[0].key === 'past' && allErrs.length === errBefore,
    'STAT-12 : un taskId qui ne pointe nulle part est traité comme une ABSENCE de lien — « Date passée », et zéro erreur JavaScript', 'STAT-12');
  await ctx.close();
}

// ============================================================
// STAT-13 → STAT-14 — Indépendance et distinction final / intermédiaire
// ============================================================
console.log('\n[STAT-CROISE] Volumétrie indépendante, final vs intermédiaire');
{
  const { ctx, p } = await newPage({ tag: 'CROISE' });

  const vol = await scenario(p, { projectEndOffset: 90,
    tasks: [{ id: 'tk-o1', status: 'todo', endOffset: -8 }, { id: 'tk-o2', status: 'doing', endOffset: -7 }],
    milestones: [{ name: 'Fondations', offset: -5 }] });
  note('STAT-13', vol);
  ok(vol.dom[0].badge === 'Date passée' && /2 interventions d’ici là/.test(vol.dom[0].meta || ''),
    'STAT-13 : un jalon intermédiaire passé reste « Date passée » ET affiche « 2 interventions d’ici là » — le statut et la volumétrie sont deux notions indépendantes', 'STAT-13');

  // Deux jalons, MÊME date future, MÊME chantier : seul isFinal les sépare.
  const ab = await scenario(p, { projectEndOffset: 60,
    milestones: [
      { name: 'Étape A (intermédiaire)', offset: 15, isFinal: false },
      { name: 'Étape B (finale)', offset: 15, isFinal: true },
    ] });
  note('STAT-14', ab);
  ok(ab.dom.length === 2 && ab.dom[0].badge === 'À venir' && ab.dom[1].badge === 'Menacé',
    'STAT-14 : à date identique et chantier identique, seul isFinal décide — l’intermédiaire est « À venir », le final est « Menacé ». La fin de chantier ne contamine plus les jalons intermédiaires', 'STAT-14');

  // isFinal absent ou false ne doit JAMAIS être traité comme un jalon final.
  const legacy = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.milestones.length = 0;
    app.milestones.push({ id: 'ml-1', projectId: 'keravel', name: 'Jalon historique', date: shiftDateStr(dayKey(TODAY), 15) + 'T17:00', taskId: null });
    app.tasks.push({ id: 'tk-z', projectId: 'keravel', name: 'Fin', resourceId: null, status: 'todo',
      start: shiftDateStr(dayKey(TODAY), 60) + 'T08:00', end: shiftDateStr(dayKey(TODAY), 60) + 'T17:00' });
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    return { isFinal: app.milestones[0].isFinal, badge: document.querySelector('.op-badge').textContent.trim() };
  });
  note('STAT-14b', legacy);
  ok(legacy.isFinal === undefined && legacy.badge === 'À venir',
    'STAT-14 : un jalon historique dont isFinal est ABSENT n’est pas traité comme final — il reste « À venir »', 'STAT-14');
  await ctx.close();
}

// ============================================================
// STAT-15 — La synthèse connaît « Date passée »
// ============================================================
console.log('\n[STAT-SYNTHESE] Répartition de la frise');
{
  const { ctx, p } = await newPage({ tag: 'SYNTH' });
  const one = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.milestones.length = 0;
    app.milestones.push({ id: 'p1', projectId: 'keravel', name: 'Étape A', date: shiftDateStr(dayKey(TODAY), -9) + 'T17:00', isFinal: false, taskId: null });
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    return [...document.querySelectorAll('.op-tl-dot')].map((e) => e.textContent.trim());
  });
  const two = await ev(p, () => {
    app.milestones.push({ id: 'p2', projectId: 'terrasses', name: 'Étape B', date: shiftDateStr(dayKey(TODAY), -4) + 'T17:00', isFinal: false, taskId: null });
    save(); renderPage();
    return { dots: [...document.querySelectorAll('.op-tl-dot')].map((e) => e.textContent.trim()),
      total: document.querySelector('.op-tl-big').textContent };
  });
  note('STAT-15', { un: one, deux: two });
  ok(one.includes('1 date passée') && two.dots.includes('2 dates passées') && two.total === '2',
    'STAT-15 : la synthèse compte le statut « Date passée » et l’accorde en nombre — « 1 date passée » puis « 2 dates passées »', 'STAT-15');

  // « past » et « done » ne doivent jamais être fusionnés.
  const distinct = await ev(p, () => {
    app.milestones.length = 0;
    app.tasks.push({ id: 'tk-done', projectId: 'keravel', name: 'Travaux', resourceId: null, status: 'done',
      start: shiftDateStr(dayKey(TODAY), -12) + 'T08:00', end: shiftDateStr(dayKey(TODAY), -11) + 'T17:00' });
    app.milestones.push({ id: 'd1', projectId: 'keravel', name: 'Avec tâche terminée', date: shiftDateStr(dayKey(TODAY), -9) + 'T17:00', isFinal: false, taskId: 'tk-done' });
    app.milestones.push({ id: 'd2', projectId: 'keravel', name: 'Sans tâche', date: shiftDateStr(dayKey(TODAY), -8) + 'T17:00', isFinal: false, taskId: null });
    save(); renderPage();
    return { badges: [...document.querySelectorAll('.op-badge')].map((e) => e.textContent.trim()),
      dots: [...document.querySelectorAll('.op-tl-dot')].map((e) => e.textContent.trim()) };
  });
  note('STAT-15b', distinct);
  ok(distinct.badges.join('|') === 'Atteint|Date passée'
    && distinct.dots.includes('1 atteint') && distinct.dots.includes('1 date passée'),
    'STAT-15 : « Atteint » et « Date passée » restent DISTINCTS dans la frise comme dans la répartition — ils ne disent pas la même chose', 'STAT-15');
  await ctx.close();
}

// ============================================================
// STAT-16 → STAT-18 — Données, schéma, magasin
// ============================================================
console.log('\n[STAT-DONNEES] Aucune mutation, schéma et magasin');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });
  await openJalons(p);
  const mut = await ev(p, () => {
    const snap = () => JSON.stringify({ m: app.milestones, p: app.projects, t: app.tasks });
    const before = snap();
    app.milestones.forEach((m) => milestoneStatus(m));
    operationMilestoneStats(window.OP, visibleOperationMilestones(window.OP));
    milestoneLinkedTask({ taskId: 'inconnu' });
    milestoneLinkedTask(null);
    return { identique: snap() === before, champs: Object.keys(app.milestones[0]).sort() };
  });
  note('STAT-16', mut);
  ok(mut.identique && mut.champs.join('|') === ['date', 'id', 'isFinal', 'name', 'projectId', 'taskId'].join('|'),
    'STAT-16 : appeler milestoneStatus() et operationMilestoneStats() ne modifie NI app.milestones, NI app.projects, NI app.tasks — et aucune propriété n’est ajoutée à un jalon', 'STAT-16');

  const socle = await ev(p, () => ({ schema: SCHEMA_VERSION, store: STORE }));
  note('STAT-17', socle);
  ok(socle.schema === 12, 'STAT-17 : SCHEMA_VERSION reste à 12 — aucune migration', 'STAT-17');
  ok(socle.store === 'kanvix-product-8-3', 'STAT-18 : STORE reste « kanvix-product-8-3 »', 'STAT-18');
  await ctx.close();
}

// ============================================================
// VISUEL — La frise de V2.8.3 doit être indiscernable
// ============================================================
console.log('\n[STAT-VISUEL] La frise validée n’a pas bougé');
{
  const mesure = async (file, w) => {
    const { ctx, p } = await newPage({ w, h: 1000, tag: 'V' + w, file });
    await openJalons(p);
    const r = await ev(p, () => {
      const ms = [...document.querySelectorAll('.op-ms')];
      const top0 = Math.round(ms[0].getBoundingClientRect().top);
      const cs = getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before');
      const bub = ms[0].querySelector('.op-ms-bub').getBoundingClientRect();
      return {
        colonnes: ms.filter((e) => Math.round(e.getBoundingClientRect().top) === top0).length,
        carte: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().width)),
        hautCarte: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().top)),
        rail: cs.borderTopWidth + '/' + cs.borderLeftWidth + '/' + cs.borderTopStyle,
        bulle: Math.round(bub.width) + 'x' + Math.round(bub.height),
        // Squelette de COMPOSITION : suite des balises et de leurs classes, sans
        // le texte. Quatre porteurs du statut sont neutralisés, parce qu'ils
        // sont exactement ce que ce lot a le droit de changer : les classes
        // st-*, la tonalité du badge, le dessin de l'icône dans la bulle, et
        // les vignettes de répartition (dont le NOMBRE dépend des statuts
        // présents). Tout le reste de la frise doit correspondre au caractère
        // près.
        squelette: [...document.querySelector('.op-body').querySelectorAll('*')]
          .filter((e) => !e.closest('.op-ms-bub') && !e.closest('.op-tl-split'))
          .map((e) => {
            const cls = [...e.classList].filter((c) => !c.startsWith('st-'));
            return e.classList.contains('op-badge')
              ? e.tagName + '.op-badge'
              : e.tagName + '.' + cls.join('.');
          })
          .join('|'),
        bulles: document.querySelectorAll('.op-ms-bub').length,
        repartition: [...document.querySelectorAll('.op-tl-dot')].map((e) => e.textContent.trim()),
        statuts: [...document.querySelectorAll('.op-badge')].map((e) => e.textContent.trim()),
        blocs: ['.op-tl-bar', '.op-milestones', '.op-tl-stats', '.op-tl-hint', '.op-ms-drop'].map((s) => document.querySelectorAll(s).length).join('|'),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        nav: document.querySelectorAll('.field-bottom-nav, .bottom-nav, nav').length,
      };
    });
    await ctx.close();
    return r;
  };
  for (const w of [1440, 390]) {
    const a = await mesure(PREV, w), c = await mesure(CUR, w);
    const compo = (x) => { const { statuts, repartition, ...rest } = x; return rest; };
    note('VISUEL', { largeur: w, v283: compo(a), v2831: compo(c), memeSquelette: a.squelette === c.squelette });
    ok(JSON.stringify(compo(a)) === JSON.stringify(compo(c)),
      `VISUEL : à ${w}px, colonnes, dimensions de cartes, rail, bulles, squelette DOM et absence de débordement sont STRICTEMENT identiques à V2.8.3`, 'VISUEL');
    // Et l'on nomme la SEULE différence de rendu — celle qui est le but du lot.
    note('VISUEL-statuts', { largeur: w, statutsV283: a.statuts, statutsV2831: c.statuts, repartitionV283: a.repartition, repartitionV2831: c.repartition });
    ok(a.statuts.join('|') === 'Menacé|À venir|À venir' && c.statuts.join('|') === 'À venir|À venir|À venir'
      && a.repartition.join('|') === '2 à venir|1 menacé' && c.repartition.join('|') === '3 à venir',
      `VISUEL : à ${w}px, les seules différences de rendu sont le LIBELLÉ du statut et la répartition qui en découle — le jalon intermédiaire de Keravel n’est plus « Menacé » parce que le chantier se termine après lui`, 'VISUEL');
  }

  // Captures de la frise livrée.
  for (const [w, h, name, dark] of [[1440, 900, '05-frise-desktop.png', false], [390, 900, '06-frise-mobile.png', false], [1440, 900, '07-frise-dark.png', true]]) {
    const { ctx, p } = await newPage({ w, h, tag: 'SHOT' });
    if (dark) await ev(p, () => { app.ui.theme = 'dark'; document.body.classList.add('dark'); save(); });
    await openJalons(p);
    await shot(p, name);
    await ctx.close();
  }
  ok(true, 'VISUEL : parcours de captures exécuté sans erreur', 'VISUEL');
}

// ============================================================
// FREEZE-2831 — Périmètre du correctif
// ============================================================
console.log('\n[FREEZE-2831] Byte-identité');
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
    'operationMilestones', 'visibleOperationMilestones', 'milestoneOpenTasks',
    'milestoneRelativeLabel', 'operationMilestoneBar', 'milestoneImpactNote',
    'calculateProjectEnd', 'getProjectTasks', 'isProjectActive', 'isProjectArchived',
    'milestoneScope', 'milestoneHiddenSites', 'setMilestoneScope', 'toggleMilestoneSite',
    'resetMilestoneFilters', 'renderOperation', 'setOperationTab', 'selectOperation',
    'operationOverviewTab', 'operationAttentionGrid', 'operationProjectCard',
    'operationPlanningTab', 'operationResourcesTab', 'operationMacroPlanning',
    'operationCard', 'operationCardMenu', 'renderOperationsList', 'getOperationSummary',
    'operationProjectIds', 'operationTasks', 'operationActiveTasks', 'operationWorstHealth',
    'planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'resourceLoadGroups',
    'getResourceSchedulingConflicts', 'getResourceState', 'getResourceLoad',
    'getProjectHealth', 'getProjectSummary', 'getProjectClosureStatus',
    'pendingControlsForProject', 'submitControlAttempt', 'controlFormHTML', 'openControlForm',
    'controlRowHTML', 'setTaskStatus', 'createRework', 'buildKanvixBackup', 'applyImportPlan',
    'validateImportState', 'exportKanvixData', 'migrateState', 'renderField',
    'handleFieldSiteTab', 'fieldControlSection', 'attentionCard', 'pageToday',
    'getTodayDecisions', 'getTodayWarnings', 'getTodayPendingControls', 'renderSites',
    'siteCard', 'openProjectEdit', 'projectToneClass', 'projectVisual', 'emptyState', 'icon',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-2831', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-2831 : les ${frozen.length} moteurs et rendus de V2.8.3 sont BYTE-IDENTIQUES — dont milestoneImpactNote(), calculateProjectEnd(), milestoneOpenTasks(), operationMilestoneBar() et toute la frise`, 'FREEZE-2831');

  const changed = ['milestoneStatus', 'operationMilestoneStats', 'operationMilestonesTab']
    .filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['milestoneLinkedTask'].filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-2831-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 3 && added.length === 1,
    'FREEZE-2831 : trois fonctions modifiées (milestoneStatus, operationMilestoneStats, et operationMilestonesTab pour la seule prise en charge du statut « past ») et un helper PUR ajouté', 'FREEZE-2831');

  // La preuve que le correctif est bien sémantique : milestoneStatus n'appelle
  // plus milestoneOpenTasks, et n'appelle calculateProjectEnd que sous isFinal.
  const body = extract(curSrc, 'milestoneStatus');
  note('FREEZE-2831-règles', {
    plusDeDeduction: !/milestoneOpenTasks\(/.test(body),
    finSousIsFinal: /m\.isFinal === true/.test(body) && body.indexOf('calculateProjectEnd(') > body.indexOf('m.isFinal === true'),
    tacheDAbord: body.indexOf('milestoneLinkedTask(') < body.indexOf('m.isFinal === true'),
  });
  ok(!/milestoneOpenTasks\(/.test(body)
    && /m\.isFinal === true/.test(body)
    && body.indexOf('calculateProjectEnd(') > body.indexOf('m.isFinal === true')
    && body.indexOf('milestoneLinkedTask(') < body.indexOf('m.isFinal === true'),
    'FREEZE-2831 : milestoneStatus() n’infère plus « Atteint » depuis milestoneOpenTasks(), et calculateProjectEnd() n’est atteint QU’APRÈS le test isFinal — la règle de fin de chantier est structurellement inaccessible aux jalons intermédiaires', 'FREEZE-2831');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-2831-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '12',
    'FREEZE-2831 : STORE et SCHEMA_VERSION (12) strictement inchangés', 'FREEZE-2831');
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
