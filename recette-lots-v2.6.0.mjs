// ============================================================
// KANVIX — Recette « Lots / corps d'état » (V2.6.0)
//
//   V2.6 introduit une structure métier BTP — le LOT / CORPS D'ÉTAT — sans
//   ajouter de complexité UX. La question à laquelle cette recette répond :
//
//     « Un conducteur peut-il désormais lire et organiser naturellement son
//       chantier par corps d'état, tout en conservant la simplicité de
//       Kanvix ? »
//
//   Règle sémantique absolue vérifiée partout :
//     PHASE (étape du projet) ≠ LOT (discipline métier) ≠ TÂCHE (travail).
//   Aucune phase n'est convertie en lot, aucun lot n'est deviné.
//
//   Usage : node recette-lots-v2.6.0.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.6.0.html';
const PREV = 'kanvix-next-gen-v2.5.0.html';
const NOW = '2026-09-14T10:15:00';
const F = (now = NOW, file = CUR) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = '/home/user/Planzy-saas/recette-v2.6.0/';
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
    // Les routes météo / géocodage sont volontairement coupées en test :
    // leurs échecs réseau ne sont pas des erreurs applicatives.
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
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
const shot = async (p, name, opts = {}) => {
  await p.waitForTimeout(260);
  await p.screenshot({ path: SHOTS + name, ...opts });
};

// ============================================================
// LOT-01 → LOT-03 — SCHÉMA, MIGRATION, RÉFÉRENTIEL
// ============================================================
console.log('\n[LOT-01..03] Schéma 10, migration 9→10 non destructive, référentiel de départ');
{
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  ok(/STORE = "kanvix-product-8-3"/.test(src), 'LOT-01 : STORE reste "kanvix-product-8-3"', 'LOT-01');
  ok(/SCHEMA_VERSION = 10\b/.test(src), 'LOT-01 : SCHEMA_VERSION passe de 9 à 10', 'LOT-01');

  const { ctx, p } = await newPage({ tag: 'A' });
  const live = await ev(p, () => ({ schema: app.schemaVersion, store: STORE }));
  note('LOT-01', live);
  ok(live.schema === 10 && live.store === 'kanvix-product-8-3', 'LOT-01 : état chargé en schéma 10 sur le même STORE', 'LOT-01');

  // ---- LOT-03 : référentiel de départ
  const ref = await ev(p, () => ({
    n: app.lots.length,
    ids: app.lots.map((l) => l.id),
    ordered: activeLots().map((l) => l.order),
    colors: app.lots.map((l) => l.colorKey),
    allActive: app.lots.every((l) => l.active === true),
    trades: app.lots.filter((l) => l.defaultTrade).length,
    uniqueColors: new Set(app.lots.map((l) => l.colorKey)).size,
  }));
  note('LOT-03', ref);
  ok(ref.n === 9 && ref.ids.includes('lot-electricite') && ref.ids.includes('lot-menuiseries-ext'),
    'LOT-03 : 9 lots de départ avec des identifiants stables et explicites', 'LOT-03');
  ok(ref.ordered.every((o, i) => i === 0 || o > ref.ordered[i - 1]),
    'LOT-03 : les lots sont ordonnés par lot.order (strictement croissant)', 'LOT-03');
  ok(ref.allActive && ref.uniqueColors === 9,
    'LOT-03 : tous actifs, chacun avec une couleur distincte', 'LOT-03');

  // Aucune logique métier ne dépend d'un NOM de lot.
  const noNameLogic = !/(===|!==|==)\s*["'](Électricité|Plomberie|Maçonnerie|Peinture|Charpente)["']/.test(src)
    && !/lot\.name\s*===/.test(src);
  ok(noNameLogic, 'LOT-03 : aucune logique métier ne teste un NOM de lot (seuls les ID comptent)', 'LOT-03');
  await ctx.close();
}

// ---- LOT-02 : migration depuis un état V2.5.0 RÉEL
{
  const { ctx: c9, p: p9 } = await newPage({ tag: 'V9', file: PREV });
  const v9 = await ev(p9, () => {
    app.history.unshift({ date: historyNow(), text: 'TRACE-V9', author: 'Eric' });
    save();
    return {
      raw: localStorage.getItem(STORE),
      schema: app.schemaVersion,
      hasLots: !!app.lots,
      counts: {
        projects: app.projects.length, tasks: app.tasks.length,
        resources: app.resources.length, history: app.history.length,
        messages: app.messages.length, photos: app.photos.length,
        unav: app.resourceUnavailabilities.length,
      },
      statuses: app.tasks.map((t) => [t.id, t.status, t.start, t.end]),
    };
  });
  note('LOT-02-source', { schema: v9.schema, hasLots: v9.hasLots, counts: v9.counts });
  ok(v9.schema === 9 && !v9.hasLots, 'LOT-02 : l’état source est bien un schéma 9 sans lots', 'LOT-02');
  await c9.close();

  const { ctx, p } = await newPage({ tag: 'MIG', reset: false });
  await ev(p, (raw) => { localStorage.setItem(STORE, raw); location.reload(); }, v9.raw).catch(() => null);
  await p.waitForLoadState('load');
  await p.waitForTimeout(250);
  const after = await ev(p, () => ({
    schema: app.schemaVersion,
    counts: {
      projects: app.projects.length, tasks: app.tasks.length,
      resources: app.resources.length, history: app.history.length,
      messages: app.messages.length, photos: app.photos.length,
      unav: app.resourceUnavailabilities.length,
    },
    statuses: app.tasks.map((t) => [t.id, t.status, t.start, t.end]),
    trace: app.history.some((h) => h.text === 'TRACE-V9'),
    lots: app.lots.length,
    allNull: app.tasks.every((t) => t.lotId === null),
    planningLot: app.ui.planningLot,
  }));
  note('LOT-02-après', { schema: after.schema, lots: after.lots, allNull: after.allNull });
  ok(after.schema === 10, 'LOT-02 : l’ouverture en V2.6.0 migre l’état 9 → 10', 'LOT-02');
  ok(JSON.stringify(after.counts) === JSON.stringify(v9.counts) &&
     JSON.stringify(after.statuses) === JSON.stringify(v9.statuses),
    'LOT-02 : migration NON destructive — compteurs, statuts et dates inchangés', 'LOT-02');
  ok(after.trace, 'LOT-02 : la donnée témoin écrite en V2.5 est toujours présente', 'LOT-02');
  ok(after.lots === 9, 'LOT-02 : un référentiel de départ est ajouté à l’état migré', 'LOT-02');
  ok(after.allNull, 'LOT-02 : AUCUNE inférence — toutes les tâches historiques restent lotId = null', 'LOT-02');
  ok(after.planningLot === 'all', 'LOT-02 : app.ui.planningLot initialisé à "all"', 'LOT-02');
  await ctx.close();
}

// ---- Non-inférence : la preuve par le cas qui piège
{
  const { ctx, p } = await newPage({ tag: 'INFER' });
  // La démo porte volontairement des tâches dont la PHASE est « Électricité ».
  // Une inférence naïve phase → lot les rattacherait toutes à lot-electricite.
  // Ici, le lot vient d'une donnée EXPLICITE, jamais de la phase.
  const check = await ev(p, () => {
    const elecPhase = app.tasks.filter((t) => t.phase === 'Électricité').map((t) => [t.id, t.phase, t.lotId]);
    const secondOeuvre = app.tasks.filter((t) => t.phase === 'Second œuvre').map((t) => [t.id, t.lotId]);
    return { elecPhase, secondOeuvre, phasesIntact: app.tasks.every((t) => typeof t.phase === 'string') };
  });
  note('NON-INFERENCE', check);
  ok(check.phasesIntact, 'NON-INFÉRENCE : task.phase est intégralement CONSERVÉ (aucun champ supprimé ni renommé)', 'LOT-02');
  ok(new Set(check.secondOeuvre.map((x) => x[1])).size > 1,
    'NON-INFÉRENCE : une même PHASE porte des lots DIFFÉRENTS — phase et lot sont bien deux axes distincts', 'LOT-02');
  await ctx.close();
}

// ============================================================
// LOT-04 → LOT-09 — CYCLE DE VIE DU RÉFÉRENTIEL
// ============================================================
console.log('\n[LOT-04..09] Référentiel : créer, modifier, unicité, ordre, désactiver, supprimer');
{
  const { ctx, p } = await newPage({ tag: 'CRUD' });

  // Le référentiel vit dans RÉGLAGES, pas dans la barre latérale.
  const place = await ev(p, () => {
    go('more');
    const rows = [...document.querySelectorAll('.settings-row')].map((r) => r.textContent.trim());
    return {
      inSettings: rows.some((r) => /Lots \/ corps d’état/.test(r)),
      label: rows.find((r) => /Lots \/ corps d’état/.test(r)),
      sidebar: [...document.querySelectorAll('.sidebar button, .sidebar a')].map((x) => x.textContent.trim()),
    };
  });
  note('REFERENTIEL', { label: place.label });
  ok(place.inSettings, 'RÉFÉRENTIEL : le bloc « Lots / corps d’état » vit dans Réglages', 'LOT-04');
  ok(!place.sidebar.some((x) => /Lot/.test(x)), 'RÉFÉRENTIEL : aucune entrée de lots dans la barre latérale (navigation courte)', 'LOT-04');
  ok(/9 actifs/.test(place.label || ''), 'RÉFÉRENTIEL : le bloc annonce le nombre de lots actifs', 'LOT-04');
  await shot(p, '01-reglages-referentiel-lots.png');

  // Gérer = ACTION = sidewindow (jamais une pop-up).
  const mgr = await ev(p, () => {
    openLotsManager();
    return {
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      modalOpen: document.querySelector('#modal').classList.contains('open'),
      title: document.querySelector('#drawerContent h2')?.textContent,
      sub: [...document.querySelectorAll('#drawerContent .muted')].map((x) => x.textContent.trim()),
      rows: document.querySelectorAll('.lot-row').length,
      names: [...document.querySelectorAll('.lot-row .lot-body b')].map((x) => x.textContent),
    };
  });
  note('SIDEWINDOW', { title: mgr.title, rows: mgr.rows });
  ok(mgr.drawerOpen && !mgr.modalOpen, 'GRAMMAIRE : gérer les lots ouvre un SIDEWINDOW (action), pas une pop-up', 'LOT-04');
  ok(mgr.title === 'Lots / corps d’état' && mgr.sub.some((x) => /Référentiel métier de l’entreprise/.test(x)),
    'SIDEWINDOW : titre et sous-titre conformes', 'LOT-04');
  ok(mgr.rows === 9, 'SIDEWINDOW : les 9 lots sont listés', 'LOT-04');
  await shot(p, '02-sidewindow-lots.png');

  // ---- LOT-04 : créer puis modifier
  const created = await ev(p, () => {
    openLotsManager('form', '');
    const f = document.querySelector('#lotFormEl');
    f.querySelector('[name=name]').value = 'Étanchéité';
    f.querySelector('[name=defaultTrade]').value = 'Étancheur';
    f.querySelector('.swatch-teal').click();
    f.requestSubmit();
    const l = app.lots.at(-1);
    return { id: l.id, name: l.name, color: l.colorKey, trade: l.defaultTrade, active: l.active, order: l.order };
  });
  note('LOT-04-create', created);
  ok(created.name === 'Étanchéité' && created.color === 'teal' && created.trade === 'Étancheur' && created.active === true,
    'LOT-04 : création d’un lot (nom, couleur, métier indicatif)', 'LOT-04');
  ok(created.order > 90, 'LOT-04 : le nouveau lot prend le dernier rang', 'LOT-04');

  const edited = await ev(p, (id) => {
    openLotsManager('form', id);
    const f = document.querySelector('#lotFormEl');
    f.querySelector('[name=name]').value = 'Étanchéité toiture';
    f.querySelector('.swatch-rose').click();
    f.requestSubmit();
    const l = lot(id);
    // Persistance réelle (relecture depuis le stockage)
    const stored = JSON.parse(localStorage.getItem(STORE)).lots.find((x) => x.id === id);
    return { name: l.name, color: l.colorKey, storedName: stored?.name, storedColor: stored?.colorKey };
  }, created.id);
  note('LOT-04-edit', edited);
  ok(edited.name === 'Étanchéité toiture' && edited.color === 'rose',
    'LOT-04 : modification du nom et de la couleur', 'LOT-04');
  ok(edited.storedName === 'Étanchéité toiture' && edited.storedColor === 'rose',
    'LOT-04 : la modification est réellement enregistrée', 'LOT-04');
  await ev(p, () => openLotsManager('form', ''));
  await shot(p, '03-create-lot.png');

  // ---- LOT-05 : unicité (casse et espaces normalisés)
  const dup = await ev(p, () => {
    const n = app.lots.length;
    openLotsManager('form', '');
    const f = document.querySelector('#lotFormEl');
    f.querySelector('[name=name]').value = '  ÉLECTRICITÉ  ';
    f.requestSubmit();
    return { err: document.querySelector('#lotError')?.textContent, n, after: app.lots.length };
  });
  note('LOT-05', dup);
  ok(dup.after === dup.n && dup.err === 'Un lot portant ce nom existe déjà.',
    'LOT-05 : un doublon de nom (casse/espaces normalisés) est refusé avec un message simple', 'LOT-05');

  // ---- LOT-06 : ordre
  const order = await ev(p, () => {
    openLotsManager('list');
    const before = activeLots().map((l) => l.id);
    moveLot(before[2], -1);
    const afterUp = activeLots().map((l) => l.id);
    moveLot(afterUp[1], 1);
    const afterDown = activeLots().map((l) => l.id);
    const stored = JSON.parse(localStorage.getItem(STORE)).lots;
    return {
      before, afterUp, afterDown,
      normalized: activeLots().map((l) => l.order),
      persisted: stored.find((l) => l.id === afterUp[1])?.order,
    };
  });
  note('LOT-06', order);
  ok(order.afterUp[1] === order.before[2] && order.afterUp[2] === order.before[1],
    'LOT-06 : « Monter » échange bien deux lots', 'LOT-06');
  ok(JSON.stringify(order.afterDown) === JSON.stringify(order.before),
    'LOT-06 : « Descendre » ramène exactement à l’ordre initial', 'LOT-06');
  ok(order.normalized.every((o, i) => o === (i + 1) * 10),
    'LOT-06 : les valeurs order sont RENORMALISÉES après réorganisation (10, 20, 30…)', 'LOT-06');
  ok(typeof order.persisted === 'number', 'LOT-06 : l’ordre est persisté (conservé au rechargement)', 'LOT-06');

  // ---- LOT-07 : désactivation d’un lot UTILISÉ
  const off = await ev(p, () => {
    const tasksBefore = app.tasks.map((t) => [t.id, t.lotId]);
    setLotActive('lot-electricite', false);
    return {
      tasksAfter: app.tasks.map((t) => [t.id, t.lotId]),
      identical: JSON.stringify(tasksBefore) === JSON.stringify(app.tasks.map((t) => [t.id, t.lotId])),
      inActive: activeLots().some((l) => l.id === 'lot-electricite'),
      stillNamed: lotLabel('lot-electricite'),
      stillColored: taskEffectiveColorKey(task('k-electric')),
      proposedForNew: assignableLots(null).some((l) => l.id === 'lot-electricite'),
      proposedForOwner: assignableLots('lot-electricite').some((l) => l.id === 'lot-electricite'),
    };
  });
  note('LOT-07', off);
  ok(off.identical, 'LOT-07 : désactiver un lot ne change AUCUNE tâche', 'LOT-07');
  ok(!off.inActive && !off.proposedForNew, 'LOT-07 : le lot disparaît des NOUVELLES sélections', 'LOT-07');
  ok(off.stillNamed === 'Électricité' && off.stillColored === 'violet',
    'LOT-07 : son nom ET sa couleur restent disponibles pour l’historique', 'LOT-07');

  // ---- LOT-08 : édition d’une tâche portant un lot désactivé
  ok(off.proposedForOwner, 'LOT-08 : un lot désactivé reste proposé à la tâche qui le porte', 'LOT-08');
  const histLot = await ev(p, () => {
    openTaskEdit('k-electric', 'planning-gantt');
    const sel = document.querySelector('#taskEditForm [name=lotId]');
    const opts = [...sel.options].map((o) => [o.value, o.textContent]);
    const cur = opts.find((o) => o[0] === 'lot-electricite');
    closeOverlay('drawer');
    return { selected: sel.value, label: cur?.[1] };
  });
  note('LOT-08', histLot);
  ok(histLot.selected === 'lot-electricite' && /\(inactif\)/.test(histLot.label || ''),
    'LOT-08 : le lot désactivé est affiché, sélectionné, et clairement suffixé « (inactif) »', 'LOT-08');
  await ev(p, () => { setLotActive('lot-electricite', true); });

  // ---- LOT-09 : suppression
  const del = await ev(p, () => {
    const unusedId = app.lots.at(-1).id; // Étanchéité toiture, jamais utilisé
    const canUnused = canDeleteLot(unusedId);
    const canUsed = canDeleteLot('lot-electricite');
    const refsUsed = lotReferences('lot-electricite');
    deleteLotPrompt('lot-electricite');
    const blockedText = document.querySelector('#modalContent').textContent;
    closeOverlay('modal');
    confirmDeleteLot(unusedId);
    return {
      canUnused, canUsed, refsUsed, blockedText,
      gone: !lot(unusedId),
      n: app.lots.length,
    };
  });
  note('LOT-09', { canUnused: del.canUnused, canUsed: del.canUsed, refs: del.refsUsed, n: del.n });
  ok(del.canUnused && !del.canUsed, 'LOT-09 : seul un lot sans aucune référence est supprimable', 'LOT-09');
  ok(/Suppression impossible/.test(del.blockedText) && /Désactivez-le plutôt/.test(del.blockedText),
    'LOT-09 : un lot utilisé propose la DÉSACTIVATION, jamais une suppression brutale', 'LOT-09');
  ok(del.gone && del.n === 9, 'LOT-09 : le lot inutilisé est bien supprimé', 'LOT-09');

  // lotReferences compte AUSSI les étapes de modèle d'entreprise
  const refTpl = await ev(p, () => {
    app.companyTemplates.push({
      id: 'tpl-ref-test', name: 'Modèle test', companyOwned: true,
      tasks: [{ key: 's1', name: 'Étape', lotId: 'lot-couverture', offset: 0, duration: 1 }],
    });
    save();
    const r = lotReferences('lot-couverture');
    const can = canDeleteLot('lot-couverture');
    app.companyTemplates = app.companyTemplates.filter((t) => t.id !== 'tpl-ref-test');
    save();
    return { r, can };
  });
  note('LOT-09-templates', refTpl);
  ok(refTpl.r.templates === 1 && refTpl.can === false,
    'LOT-09 : lotReferences() compte aussi les étapes de modèles d’entreprise', 'LOT-09');

  await ctx.close();
}

// ============================================================
// LOT-10 → LOT-12 — TÂCHES
// ============================================================
console.log('\n[LOT-10..12] Création, édition, historique, « sans lot »');
{
  const { ctx, p } = await newPage({ tag: 'TASK' });

  // ---- LOT-10 : création
  const create = await ev(p, () => {
    openTaskForm('keravel');
    const f = document.querySelector('#drawerFormEl');
    const labels = [...f.querySelectorAll('label')].map((l) => l.textContent.split(/Sans lot|Non affecté/)[0].trim());
    const sel = f.querySelector('[name=lotId]');
    const order = [...f.querySelectorAll('[name]')].map((x) => x.name);
    f.querySelector('[name=name]').value = 'Tirage des câbles';
    sel.value = 'lot-electricite';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    f.querySelector('[name=resourceId]').value = 'legall';
    f.requestSubmit();
    const t = app.tasks.at(-1);
    return {
      labels: labels.slice(0, 4),
      order,
      name: t.name, lotId: t.lotId, colorKey: t.colorKey,
      effective: taskEffectiveColorKey(t),
    };
  });
  note('LOT-10', create);
  ok(create.lotId === 'lot-electricite' && create.name === 'Tirage des câbles',
    'LOT-10 : la tâche créée porte le bon lotId', 'LOT-10');
  /* V2.9.0 — RE-BASELINE. Le formulaire intercale « Structure / zone » entre
     le chantier et le lot (V2.9.0 §20) : la STRUCTURE dit OÙ sur le chantier,
     le LOT dit QUEL corps d'état, et l'ordre de lecture va du lieu au métier.
     L'exigence d'origine est CONSERVÉE À L'IDENTIQUE — chantier < lot <
     intervenant principal, sur l'ordre RÉEL des champs et non plus sur les
     quatre premiers — et elle est RENFORCÉE : quand la structure existe, sa
     position est elle aussi contrainte au millimètre (juste après le chantier,
     juste avant le lot). L'assertion vaut donc pour V2.6.0 comme pour V2.9.0. */
  {
    const iP = create.order.indexOf('projectId'),
      iL = create.order.indexOf('lotId'),
      iR = create.order.indexOf('resourceId'),
      iS = create.order.indexOf('structureNodeId'),
      ordreBase = iP >= 0 && iP < iL && iL < iR,
      ordreStructure = iS < 0 ? true : iS === iP + 1 && iL === iS + 1;
    note('LOT-10-ordre', { order: create.order, iP, iS, iL, iR });
    ok(ordreBase && ordreStructure,
      'LOT-10 : le champ Lot se place après le chantier et avant l’intervenant principal, la structure — lorsqu’elle existe — s’intercalant exactement entre les deux', 'LOT-10');
  }
  ok(create.labels.some((l) => /Lot \/ corps d’état/.test(l)),
    'LOT-10 : le champ est libellé « Lot / corps d’état »', 'LOT-10');
  ok(create.effective === 'violet',
    'LOT-10 : la couleur automatique de la tâche devient celle de son lot', 'LOT-10');

  // L'aide contextuelle explique ce que fait « Automatique ».
  const hint = await ev(p, () => {
    openTaskForm('keravel');
    const f = document.querySelector('#drawerFormEl');
    const empty = f.querySelector('#colorAutoHint').textContent;
    const sel = f.querySelector('[name=lotId]');
    sel.value = 'lot-peinture';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const withLot = f.querySelector('#colorAutoHint').textContent;
    closeOverlay('drawer');
    return { empty, withLot };
  });
  note('LOT-10-aide', hint);
  ok(/Automatique utilise la couleur du lot/.test(hint.empty) && /Peinture/.test(hint.withLot),
    'LOT-10 : « Automatique utilise la couleur du lot » est expliqué, et nomme le lot choisi', 'LOT-10');
  await ev(p, () => { openTaskForm('keravel'); const f = document.querySelector('#drawerFormEl'); f.querySelector('[name=name]').value = 'Pose des luminaires'; f.querySelector('[name=lotId]').value = 'lot-electricite'; f.querySelector('[name=lotId]').dispatchEvent(new Event('change', { bubbles: true })); });
  await shot(p, '04-task-with-lot.png');
  await ev(p, () => closeOverlay('drawer'));

  // ---- LOT-11 : édition + historique
  const edit = await ev(p, () => {
    const before = task('k-windows').lotId;
    openTaskEdit('k-windows', 'planning-gantt');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=lotId]').value = 'lot-electricite';
    markTaskEditDirty();
    submitTaskEdit();
    const h = app.history.find((x) => x.taskId === 'k-windows' && x.changes?.length);
    return {
      before,
      after: task('k-windows').lotId,
      changes: (h?.changes || []),
      histCount: app.history.filter((x) => x.taskId === 'k-windows' && x.changes?.length).length,
    };
  });
  note('LOT-11', edit);
  ok(edit.before === 'lot-menuiseries-ext' && edit.after === 'lot-electricite',
    'LOT-11 : le lot de la tâche est bien modifié', 'LOT-11');
  const lotChange = edit.changes.find((c) => c.field === 'Lot');
  ok(lotChange && lotChange.from === 'Menuiseries extérieures' && lotChange.to === 'Électricité',
    'LOT-11 : l’historique trace { field: "Lot", from, to } avec les LIBELLÉS', 'LOT-11');
  ok(edit.changes.length === 1,
    'LOT-11 : un changement de lot seul ne produit qu’UNE ligne de diff (aucun bruit)', 'LOT-11');
  await ev(p, () => openTaskEdit('k-windows', 'planning-gantt'));
  await shot(p, '05-task-edit-lot.png');
  await ev(p, () => { cancelTaskEdit?.(); closeOverlay('drawer'); });

  // ---- LOT-12 : sans lot
  const none = await ev(p, () => {
    openTaskEdit('k-windows', 'planning-gantt');
    const f = document.querySelector('#taskEditForm');
    f.querySelector('[name=lotId]').value = '';
    markTaskEditDirty();
    submitTaskEdit();
    const t = task('k-windows');
    const h = app.history.find((x) => x.taskId === 'k-windows' && x.changes?.some((c) => c.field === 'Lot'));
    const opts = (() => {
      openTaskForm('keravel');
      const g = document.querySelector('#drawerFormEl');
      const first = g.querySelector('[name=lotId]').options[0];
      closeOverlay('drawer');
      return { value: first.value, label: first.textContent };
    })();
    return {
      lotId: t.lotId,
      effective: taskEffectiveColorKey(t),
      chip: (() => { go('planning'); renderPage(); return !!document.querySelector(`#row-${t.id} .lot-chip`); })(),
      change: h?.changes.find((c) => c.field === 'Lot'),
      firstOption: opts,
      healthOk: typeof getProjectHealth('keravel') === 'string',
    };
  });
  note('LOT-12', none);
  ok(none.lotId === null, 'LOT-12 : « Sans lot » enregistre bien lotId = null', 'LOT-12');
  ok(none.change && none.change.to === 'Aucun', 'LOT-12 : l’historique affiche « Aucun » pour l’absence de lot', 'LOT-12');
  ok(none.effective === 'auto' && !none.chip,
    'LOT-12 : sans lot, la tâche retrouve exactement le comportement historique (aucune couleur, aucun marqueur)', 'LOT-12');
  ok(none.firstOption.value === '' && none.firstOption.label === 'Sans lot',
    'LOT-12 : « Sans lot » est toujours la première option proposée', 'LOT-12');
  ok(none.healthOk, 'LOT-12 : tout continue de fonctionner sans lot', 'LOT-12');

  await ctx.close();
}

// ============================================================
// LOT-13 → LOT-15 — COULEURS
// ============================================================
console.log('\n[LOT-13..15] Couleur du lot, surcharge manuelle, changement de couleur du lot');
{
  const { ctx, p } = await newPage({ tag: 'COLOR' });

  // Lot Électricité forcé en AMBER pour coller au scénario de référence.
  const setup = await ev(p, () => {
    lot('lot-electricite').colorKey = 'amber';
    save();
    return { color: lotColorKey('lot-electricite') };
  });
  note('COLOR-setup', setup);

  // ---- LOT-13 : couleur AUTO → couleur du lot, en Gantt ET en Kanban
  const auto = await ev(p, () => {
    // La couleur ne s'applique qu'aux tâches todo/doing : les états métier
    // (retard, attente, terminé) restent prioritaires. On teste donc sur une
    // tâche « à faire ».
    const t = task('k-lining');
    t.lotId = 'lot-electricite';
    t.colorKey = 'auto';
    t.status = 'todo';
    save();
    go('planning');
    app.settings.period = 'month';
    app.ui.planningView = 'gantt';
    save(); renderPage();
    const bar = document.querySelector('#bar-k-lining');
    app.ui.planningView = 'kanban';
    save(); renderPage();
    const card = [...document.querySelectorAll('.kanban-card')].find((c) => c.querySelector('b')?.textContent === 'Doublage murs extérieurs');
    app.ui.planningView = 'gantt';
    save(); renderPage();
    return {
      status: t.status,
      effective: taskEffectiveColorKey(t),
      ganttClass: bar?.className,
      kanbanClass: card?.className,
    };
  });
  note('LOT-13', auto);
  ok(auto.effective === 'amber', 'LOT-13 : taskEffectiveColorKey() renvoie la couleur du lot', 'LOT-13');
  ok(/tcolor-amber/.test(auto.ganttClass || ''), 'LOT-13 : la barre Gantt porte tcolor-amber', 'LOT-13');
  ok(/tcolor-amber/.test(auto.kanbanClass || ''), 'LOT-13 : la carte Kanban porte tcolor-amber — MÊME source, aucun second calcul', 'LOT-13');

  // ---- LOT-14 : surcharge manuelle prioritaire
  const manual = await ev(p, () => {
    const t = task('k-lining');
    t.colorKey = 'violet';
    save();
    renderPage();
    const bar = document.querySelector('#bar-k-lining');
    app.ui.planningView = 'kanban'; save(); renderPage();
    const card = [...document.querySelectorAll('.kanban-card')].find((c) => c.querySelector('b')?.textContent === 'Doublage murs extérieurs');
    app.ui.planningView = 'gantt'; save(); renderPage();
    return { effective: taskEffectiveColorKey(t), gantt: bar?.className, kanban: card?.className, lotColor: lotColorKey(t.lotId) };
  });
  note('LOT-14', { effective: manual.effective, lotColor: manual.lotColor });
  ok(manual.effective === 'violet' && manual.lotColor === 'amber',
    'LOT-14 : la couleur MANUELLE de la tâche gagne toujours sur celle du lot', 'LOT-14');
  ok(/tcolor-violet/.test(manual.gantt || '') && /tcolor-violet/.test(manual.kanban || ''),
    'LOT-14 : Gantt et Kanban affichent tous deux le violet', 'LOT-14');

  // ---- LOT-15 : changer la couleur du lot
  const recolor = await ev(p, () => {
    // Une tâche AUTO et une tâche MANUELLE sur le même lot.
    task('k-lining').colorKey = 'violet'; // manuelle (lot Électricité)
    task('h-electric').colorKey = 'auto';  // automatique (lot Électricité)
    task('h-electric').status = 'todo';
    save();
    const before = {
      auto: taskEffectiveColorKey(task('h-electric')),
      manual: taskEffectiveColorKey(task('k-lining')),
    };
    // Le conducteur change la couleur du lot : amber → blue
    openLotsManager('form', 'lot-electricite');
    const f = document.querySelector('#lotFormEl');
    f.querySelector('.swatch-blue').click();
    f.requestSubmit();
    return {
      before,
      after: {
        auto: taskEffectiveColorKey(task('h-electric')),
        manual: taskEffectiveColorKey(task('k-lining')),
      },
      // La couleur du lot n'est JAMAIS recopiée dans la tâche.
      storedAuto: task('h-electric').colorKey,
      storedManual: task('k-lining').colorKey,
    };
  });
  note('LOT-15', recolor);
  ok(recolor.before.auto === 'amber' && recolor.after.auto === 'blue',
    'LOT-15 : changer la couleur du lot fait immédiatement évoluer ses tâches « auto »', 'LOT-15');
  ok(recolor.after.manual === 'violet',
    'LOT-15 : les tâches à couleur manuelle restent INCHANGÉES', 'LOT-15');
  ok(recolor.storedAuto === 'auto',
    'LOT-15 : la couleur du lot n’est jamais écrite physiquement dans la tâche', 'LOT-15');

  // Les états métier restent prioritaires : le lot est une identité, pas une gravité.
  const gravity = await ev(p, () => {
    const t = task('k-windows');
    const status = t.status;
    t.lotId = 'lot-electricite';
    t.colorKey = 'auto';
    save(); renderPage();
    return { status, cls: taskColorClass(t), late: status === 'late' || status === 'done' || status === 'waiting' };
  });
  note('GRAVITÉ', gravity);
  ok(gravity.late ? gravity.cls === '' : true,
    'COULEURS : sur un état métier (retard / attente / terminé), la couleur de lot s’efface — le lot est une IDENTITÉ, pas une gravité', 'LOT-13');

  await ev(p, () => { closeOverlay('drawer'); closeOverlay('modal'); go('planning'); app.settings.period = 'month'; app.ui.planningView = 'gantt'; save(); renderPage(); });
  await shot(p, '07-gantt-lot-colors.png');
  await ev(p, () => { app.ui.planningView = 'kanban'; save(); renderPage(); });
  await shot(p, '08-kanban-lot-colors.png');
  await ctx.close();
}

// ============================================================
// LOT-16 → LOT-19 — PLANNING
// ============================================================
console.log('\n[LOT-16..19] Filtre lot, filtres combinés, Kanban, « Sans lot »');
{
  const { ctx, p } = await newPage({ tag: 'PLAN' });

  const sel = await ev(p, () => {
    go('planning');
    app.settings.period = 'month'; save(); renderPage();
    const s = [...document.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'Filtrer par lot');
    const all = [...document.querySelectorAll('select')].map((x) => x.getAttribute('aria-label'));
    return { exists: !!s, options: [...s.options].map((o) => [o.value, o.textContent]), filters: all };
  });
  note('LOT-16-sélecteur', { filters: sel.filters, first: sel.options.slice(0, 3), last: sel.options.at(-1) });
  ok(sel.exists && sel.filters.filter(Boolean).length === 3,
    'LOT-16 : le Planning propose bien TROIS filtres — chantier, ressource, lot', 'LOT-16');
  ok(sel.options[0][1] === 'Tous les lots', 'LOT-16 : l’option par défaut est « Tous les lots »', 'LOT-16');
  ok(sel.options.at(-1)[1] === 'Sans lot', 'LOT-19 : « Sans lot » est proposé en fin de liste', 'LOT-19');

  const filtered = await ev(p, () => {
    const all = planningTasks().map((t) => t.id);
    setPlanningFilter('lot', 'lot-electricite');
    const elec = planningTasks().map((t) => t.id);
    const ganttRows = [...document.querySelectorAll('.g-row')].map((r) => r.id).filter(Boolean);
    app.ui.planningView = 'kanban'; save(); renderPage();
    const kanbanCards = document.querySelectorAll('.kanban-card').length;
    app.ui.planningView = 'gantt'; save(); renderPage();
    setPlanningFilter('lot', 'none');
    const none = planningTasks().map((t) => [t.id, t.lotId]);
    setPlanningFilter('lot', 'all');
    return { all, elec, ganttRows, kanbanCards, none };
  });
  note('LOT-16/18/19', filtered);
  ok(filtered.elec.length > 0 && filtered.elec.every((id) => ['k-electric', 'h-electric'].includes(id)),
    'LOT-16 : filtrer sur Électricité ne retient que les tâches de ce lot', 'LOT-16');
  ok(filtered.ganttRows.length === filtered.elec.length,
    'LOT-18 : le Gantt affiche exactement les tâches filtrées', 'LOT-18');
  ok(filtered.kanbanCards === filtered.elec.length,
    'LOT-18 : le Kanban applique le MÊME filtre que le Gantt (aucune divergence)', 'LOT-18');
  ok(filtered.none.length > 0 && filtered.none.every(([, lotId]) => !lotId),
    'LOT-19 : « Sans lot » ne retient que les tâches sans lot', 'LOT-19');

  // ---- LOT-17 : intersection exacte des trois filtres
  const combined = await ev(p, () => {
    // On construit un cas qui n'est vrai QUE pour les trois critères réunis.
    const t = task('k-windows');
    t.lotId = 'lot-menuiseries-ext';
    t.additionalResourceIds = ['truck-cb02'];
    save();
    setPlanningFilter('project', 'keravel');
    setPlanningFilter('resource', 'truck-cb02');
    setPlanningFilter('lot', 'lot-menuiseries-ext');
    const hit = planningTasks().map((x) => x.id);
    // On casse UN seul critère : le résultat doit disparaître.
    setPlanningFilter('lot', 'lot-peinture');
    const miss = planningTasks().map((x) => x.id);
    setPlanningFilter('project', 'all');
    setPlanningFilter('resource', 'all');
    setPlanningFilter('lot', 'all');
    return { hit, miss };
  });
  note('LOT-17', combined);
  ok(JSON.stringify(combined.hit) === JSON.stringify(['k-windows']),
    'LOT-17 : chantier + ressource + lot donnent l’intersection EXACTE', 'LOT-17');
  ok(combined.miss.length === 0,
    'LOT-17 : casser un seul des trois critères vide le résultat (les filtres se combinent, ils ne se remplacent pas)', 'LOT-17');

  // Une seule vérité de filtrage : le source ne refiltre pas dans les vues.
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  const single = (src.match(/planningLot/g) || []).length;
  const inViews = /kanbanBoard[\s\S]{0,2000}?app\.ui\.planningLot/.test(src);
  note('LOT-18-source', { occurrences: single, refiltreDansKanban: inViews });
  ok(!inViews, 'LOT-18 : aucun refiltrage par lot dans le Kanban — planningTasks() est l’unique point d’entrée', 'LOT-18');

  await ev(p, () => { closeOverlay('drawer'); go('planning'); setPlanningFilter('lot', 'lot-electricite'); });
  await shot(p, '06-planning-filter-lot.png');
  await ctx.close();
}

// ============================================================
// LOT-20 → LOT-22 — MODÈLES ET REPRISE
// ============================================================
console.log('\n[LOT-20..22] Modèles intégrés, modèle d’entreprise, reprise');
{
  const { ctx, p } = await newPage({ tag: 'TPL' });

  // ---- LOT-20 : modèle intégré
  const builtin = await ev(p, () => {
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === 'second-work');
    app.ui.wizard = {
      step: 'template',
      data: { name: 'Chantier modèle', templateId: 'second-work', startDate: localDateKey(getDemoNow()) },
    };
    createTemplateFromWizard();
    const pid = app.projects.at(-1).id;
    const tasks = app.tasks.filter((t) => t.projectId === pid);
    return {
      tplLots: tpl.tasks.map((x) => [x.name, x.lotId]),
      created: tasks.map((t) => [t.name, t.lotId]),
      orphans: tasks.filter((t) => t.lotId && !lot(t.lotId)).length,
    };
  });
  note('LOT-20', builtin);
  ok(builtin.created.length === 5 && builtin.created[0][1] === 'lot-platrerie',
    'LOT-20 : créer un chantier depuis un modèle intégré conserve le lotId de chaque étape', 'LOT-20');
  ok(JSON.stringify(builtin.created.map((x) => x[1])) === JSON.stringify(builtin.tplLots.map((x) => x[1])),
    'LOT-20 : tous les lots du modèle sont repris à l’identique (y compris les étapes sans lot)', 'LOT-20');
  ok(builtin.orphans === 0, 'LOT-20 : aucune tâche créée ne porte un lot inconnu', 'LOT-20');

  // Le lot du modèle est une DONNÉE, jamais dérivé du nom au runtime.
  const srcTpl = fs.readFileSync(BASE + CUR, 'utf8');
  ok(/\{ key: "cloisons", name: "Cloisons", lotId: "lot-platrerie"/.test(srcTpl),
    'LOT-20 : lotId est défini EXPLICITEMENT dans la donnée du modèle (aucune dérivation depuis le nom)', 'LOT-20');

  // ---- LOT-21 : modèle d'entreprise
  const company = await ev(p, () => {
    openCompanyTemplateForm();
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=name]').value = 'Modèle Keravel';
    f.querySelector('[name=projectId]').value = 'keravel';
    f.requestSubmit();
    const tpl = app.companyTemplates.at(-1);
    // Puis on crée un chantier à partir de CE modèle.
    app.ui.wizard = {
      step: 'template',
      data: { name: 'Depuis modèle entreprise', templateId: tpl.id, startDate: localDateKey(getDemoNow()) },
    };
    createTemplateFromWizard();
    const pid = app.projects.at(-1).id;
    return {
      tplSteps: tpl.tasks.map((x) => [x.name, x.lotId]),
      sourceTasks: app.tasks.filter((t) => t.projectId === 'keravel').map((t) => [t.name, t.lotId]),
      created: app.tasks.filter((t) => t.projectId === pid).map((t) => [t.name, t.lotId]),
    };
  });
  note('LOT-21', { tplSteps: company.tplSteps, created: company.created });
  ok(company.tplSteps.some((x) => x[1]), 'LOT-21 : le modèle d’entreprise copie le lot de chaque tâche source', 'LOT-21');
  ok(JSON.stringify(company.created.map((x) => x[1])) === JSON.stringify(company.tplSteps.map((x) => x[1])),
    'LOT-21 : un chantier créé depuis ce modèle conserve les lots', 'LOT-21');
  await ev(p, () => { closeOverlay('drawer'); go('more'); openLotsManager(); });
  await shot(p, '09-company-template-lots.png');
  await ev(p, () => closeOverlay('drawer'));

  // Lot disparu du référentiel → la tâche naît SANS lot (jamais un ID mort).
  const ghost = await ev(p, () => {
    app.companyTemplates.push({
      id: 'tpl-ghost', name: 'Modèle fantôme', companyOwned: true,
      tasks: [{ key: 'a', name: 'Étape fantôme', lotId: 'lot-qui-nexiste-pas', offset: 0, duration: 1 }],
    });
    save();
    app.ui.wizard = { step: 'template', data: { name: 'Chantier fantôme', templateId: 'tpl-ghost', startDate: localDateKey(getDemoNow()) } };
    createTemplateFromWizard();
    const pid = app.projects.at(-1).id;
    return app.tasks.filter((t) => t.projectId === pid).map((t) => [t.name, t.lotId]);
  });
  note('LOT-20-fantôme', ghost);
  ok(ghost.every((x) => x[1] === null), 'LOT-20 : un lot absent du référentiel donne lotId = null — aucun ID orphelin', 'LOT-20');

  // ---- LOT-22 : reprise
  const rework = await ev(p, () => {
    const orig = task('k-control');
    orig.status = 'done';
    orig.lotId = 'lot-maconnerie';
    save();
    openReworkForm(orig.id);
    const f = document.querySelector('#drawerFormEl');
    f.querySelector('[name=comment]').value = 'Reprise du contrôle de dalle.';
    f.requestSubmit();
    const r = app.tasks.find((t) => t.reworkOfTaskId === orig.id);
    return { origLot: orig.lotId, reworkLot: r?.lotId, reworkName: r?.name, created: !!r };
  });
  note('LOT-22', rework);
  ok(rework.reworkLot === 'lot-maconnerie',
    'LOT-22 : une reprise hérite du lot de l’intervention d’origine', 'LOT-22');

  await ctx.close();
}

// ============================================================
// LOT-23 → LOT-25 — MODE CHANTIER, ARTISAN, CHANTIER CLÔTURÉ
// ============================================================
console.log('\n[LOT-23..25] Mode Chantier, Artisan, chantier clôturé');
{
  const { ctx, p } = await newPage({ tag: 'FIELD', w: 390, h: 844 });

  // ---- Fiche tâche bureau : métadonnée discrète
  const sheet = await ev(p, () => {
    openTask('k-windows');
    const c = document.querySelector('#drawerContent');
    return {
      hasLot: /Lot/.test(c.textContent),
      named: /Menuiseries extérieures/.test(c.textContent),
      lines: c.querySelectorAll('.task-extra-res').length,
      blocks: c.querySelectorAll('.drawer-section').length,
    };
  });
  note('FICHE', sheet);
  ok(sheet.hasLot && sheet.named, 'FICHE TÂCHE : le lot apparaît, toujours NOMMÉ', 'LOT-23');
  ok(sheet.lines <= 2, 'FICHE TÂCHE : une simple ligne de métadonnée, pas un gros bloc', 'LOT-23');

  // ---- LOT-23 : Mode Chantier
  const field = await ev(p, () => {
    closeOverlay('drawer');
    enterFieldMode();
    const listBefore = document.querySelector('.field-task-list, .field-list, main')?.textContent || '';
    openTask('k-windows');
    const m = document.querySelector('#modalContent');
    return {
      isField: isFieldMode(),
      lotLine: /Lot\s*:/.test(m.textContent),
      named: /Menuiseries extérieures/.test(m.textContent),
      listMentionsLot: /Menuiseries extérieures/.test(listBefore),
      actions: [...m.querySelectorAll('button')].map((x) => x.textContent.trim()),
    };
  });
  note('LOT-23', { lotLine: field.lotLine, named: field.named, listMentionsLot: field.listMentionsLot });
  ok(field.isField && field.lotLine && field.named,
    'LOT-23 : en Mode Chantier, l’intervention ouverte affiche « Lot : … »', 'LOT-23');
  ok(!field.listMentionsLot,
    'LOT-23 : la liste principale terrain n’est PAS densifiée par le lot', 'LOT-23');
  ok(field.actions.some((a) => /Voir dans le planning|Fermer/.test(a)),
    'LOT-23 : le workflow terrain reste inchangé', 'LOT-23');
  await shot(p, '10-mode-chantier-lot.png');

  // ---- LOT-24 : Artisan — aucune gestion du référentiel
  const artisan = await ev(p, () => {
    closeOverlay('modal');
    setRole('artisan');
    renderPage();
    const body = document.body.textContent;
    go('more');
    const settings = document.body.textContent;
    return {
      role: app.settings.role,
      manageInSettings: /Lots \/ corps d’état/.test(settings),
      hasManagerEntry: [...document.querySelectorAll('button,a')].some((x) => /Gérer les lots/i.test(x.textContent)),
    };
  });
  note('LOT-24', artisan);
  ok(artisan.role === 'artisan' && !artisan.hasManagerEntry,
    'LOT-24 : l’expérience Artisan n’offre AUCUNE gestion du référentiel', 'LOT-24');
  await ev(p, () => { setRole('driver'); exitFieldMode?.(); app.settings.driverMode = 'office'; save(); renderPage(); });
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'CLOSED' });
  const closed = await ev(p, () => {
    const pid = 'keravel';
    project(pid).lifecycle = 'closed';
    save();
    openTask('k-lining');
    const c = document.querySelector('#drawerContent');
    return {
      editable: canEditProject(pid),
      lotVisible: /Plâtrerie/.test(c.textContent),
      readOnlyNote: /lecture seule/.test(c.textContent),
      hasEdit: [...c.querySelectorAll('button')].some((x) => /Modifier la tâche/.test(x.textContent)),
    };
  });
  note('LOT-25', closed);
  ok(!closed.editable && closed.lotVisible,
    'LOT-25 : sur un chantier clôturé, le lot reste VISIBLE', 'LOT-25');
  ok(closed.readOnlyNote && !closed.hasEdit,
    'LOT-25 : la tâche reste en lecture seule — aucune modification possible', 'LOT-25');
  await ctx.close();
}

// ============================================================
// LOT-26 → LOT-31 — SAUVEGARDE, EXPORT, IMPORT
// ============================================================
console.log('\n[LOT-26..31] Sauvegarde, restauration V9, export, import, replace-all, validation');
{
  const { ctx, p } = await newPage({ tag: 'DATA' });

  // ---- LOT-26 : roundtrip backup → reset → restore
  const round = await ev(p, () => {
    // On modifie le référentiel ET une tâche.
    openLotsManager('form', '');
    const f = document.querySelector('#lotFormEl');
    f.querySelector('[name=name]').value = 'Serrurerie';
    f.querySelector('.swatch-cyan').click();
    f.requestSubmit();
    const newLotId = app.lots.at(-1).id;
    task('k-paint').lotId = newLotId;
    app.companyTemplates.push({
      id: 'tpl-round', name: 'Modèle round', companyOwned: true,
      tasks: [{ key: 'a', name: 'Étape', lotId: newLotId, offset: 0, duration: 1 }],
    });
    save();
    const payload = buildKanvixBackup();
    const before = {
      lots: app.lots.map((l) => [l.id, l.name, l.colorKey, l.order, l.active]),
      taskLot: task('k-paint').lotId,
      tplLot: app.companyTemplates.at(-1).tasks[0].lotId,
    };
    resetApp();
    dismissKanvixContinuityNotice();
    const afterReset = { lots: app.lots.length, taskLot: task('k-paint').lotId };
    pendingKanvixBackup = payload;
    confirmKanvixRestore();
    return {
      before, afterReset,
      after: {
        lots: app.lots.map((l) => [l.id, l.name, l.colorKey, l.order, l.active]),
        taskLot: task('k-paint').lotId,
        tplLot: app.companyTemplates.find((t) => t.id === 'tpl-round')?.tasks[0].lotId,
      },
      carriedLots: (payload.state.lots || []).length,
      carriedTaskLot: payload.state.tasks.find((t) => t.id === 'k-paint')?.lotId,
      version: payload.appVersion,
      schema: payload.schemaVersion,
    };
  });
  note('LOT-26', { carriedLots: round.carriedLots, version: round.version, schema: round.schema });
  ok(round.carriedLots === 10 && round.carriedTaskLot === round.before.taskLot,
    'LOT-26 : la sauvegarde transporte app.lots ET task.lotId', 'LOT-26');
  ok(JSON.stringify(round.before.lots) === JSON.stringify(round.after.lots),
    'LOT-26 : roundtrip strictement fidèle — le référentiel est restauré à l’identique', 'LOT-26');
  ok(round.after.taskLot === round.before.taskLot && round.after.tplLot === round.before.tplLot,
    'LOT-26 : task.lotId et companyTemplates[].tasks[].lotId sont restaurés', 'LOT-26');
  ok(round.schema === 10 && round.version === '2.6.0',
    'LOT-26 : la sauvegarde s’annonce en schéma 10 / version 2.6.0', 'LOT-26');

  // L'aperçu compte les lots — information, pas KPI.
  const preview = await ev(p, () => {
    const payload = buildKanvixBackup();
    pendingKanvixBackup = payload;
    showKanvixBackupPreview(payload);
    const txt = document.querySelector('#modalContent').textContent;
    closeOverlay('modal');
    return txt;
  });
  note('LOT-26-aperçu', preview.slice(0, 200));
  ok(/10 lots/.test(preview), 'LOT-26 : l’aperçu de sauvegarde annonce le nombre de lots', 'LOT-26');

  // ---- LOT-27 : restaurer une sauvegarde V2.5 (sans lots)
  const legacy = await ev(p, () => {
    const payload = buildKanvixBackup();
    payload.schemaVersion = 9;
    payload.appVersion = '2.5.0';
    payload.state.schemaVersion = 9;
    delete payload.state.lots;
    payload.state.tasks.forEach((t) => { delete t.lotId; });
    (payload.state.companyTemplates || []).forEach((tpl) => (tpl.tasks || []).forEach((st) => { delete st.lotId; }));
    const check = validateKanvixBackup(payload);
    const requires = KANVIX_BACKUP_REQUIRED.includes('lots');
    pendingKanvixBackup = payload;
    showKanvixBackupPreview(payload);
    const previewTxt = document.querySelector('#modalContent').textContent;
    confirmKanvixRestore();
    return {
      check, requires,
      previewMentionsLots: /lots?\b/i.test(previewTxt.replace(/Restaurer|sauvegarde/gi, '')),
      schema: app.schemaVersion,
      lots: app.lots.length,
      allNull: app.tasks.every((t) => t.lotId === null),
      tasks: app.tasks.length,
    };
  });
  note('LOT-27', legacy);
  ok(!legacy.requires, 'LOT-27 : KANVIX_BACKUP_REQUIRED n’exige PAS app.lots', 'LOT-27');
  ok(legacy.check.ok, 'LOT-27 : une sauvegarde V2.5 (sans lots) est ACCEPTÉE', 'LOT-27');
  ok(legacy.schema === 10 && legacy.lots === 9 && legacy.allNull,
    'LOT-27 : elle est migrée en schéma 10 — référentiel ajouté, tâches à lotId = null', 'LOT-27');

  // ---- LOT-28 : export portable
  await ev(p, () => { resetApp(); dismissKanvixContinuityNotice(); });
  const exported = await ev(p, () => {
    app.companyTemplates.push({
      id: 'tpl-exp', name: 'Modèle export', companyOwned: true,
      tasks: [{ key: 'a', name: 'Étape', lotId: 'lot-peinture', offset: 0, duration: 1 }],
    });
    save();
    exportKanvixData();
    const json = JSON.parse(document.querySelector('#kanvixExportText').value);
    const txt = document.querySelector('#drawerContent').textContent;
    closeOverlay('drawer');
    return {
      hasLots: Array.isArray(json.lots) && json.lots.length,
      taskLots: json.tasks.filter((t) => t.lotId).length,
      tplLot: json.companyTemplates.find((t) => t.id === 'tpl-exp')?.tasks[0].lotId,
      mentionsLots: /lot\(s\)/.test(txt),
    };
  });
  note('LOT-28', exported);
  ok(exported.hasLots === 9 && exported.taskLots > 0 && exported.tplLot === 'lot-peinture',
    'LOT-28 : l’export portable contient lots, task.lotId et les lotId des modèles', 'LOT-28');
  ok(exported.mentionsLots, 'LOT-28 : l’écran d’export annonce le nombre de lots', 'LOT-28');

  // ---- LOT-29 : import — ajout, réutilisation, remapping
  const imported = await ev(p, () => {
    const S = structuredClone({ ...app, undoStack: [] });
    const plan = {
      replaceAll: false,
      data: {
        lots: [
          // déjà connu, même nom → réutilisé
          { id: 'lot-peinture', name: 'Peinture', colorKey: 'green', active: true },
          // ID inconnu mais nom déjà présent → réutilisé (pas de doublon)
          { id: 'lot-xyz-123', name: 'Électricité', colorKey: 'green', active: true },
          // totalement nouveau → ajouté
          { id: 'lot-vrd', name: 'VRD', colorKey: 'amber', active: true },
          // MÊME ID qu'un lot local, AUTRE nom → collision → remappé
          { id: 'lot-plomberie', name: 'Désamiantage', colorKey: 'rose', active: true },
        ],
        tasks: [
          { id: 'imp-1', name: 'Réutilisé', projectId: 'keravel', lotId: 'lot-xyz-123', start: '2026-11-10T08:00', end: '2026-11-10T17:00' },
          { id: 'imp-2', name: 'Nouveau', projectId: 'keravel', lotId: 'lot-vrd', start: '2026-11-11T08:00', end: '2026-11-11T17:00' },
          { id: 'imp-3', name: 'Collision', projectId: 'keravel', lotId: 'lot-plomberie', start: '2026-11-12T08:00', end: '2026-11-12T17:00' },
          { id: 'imp-4', name: 'Inconnu', projectId: 'keravel', lotId: 'lot-jamais-vu', start: '2026-11-13T08:00', end: '2026-11-13T17:00' },
        ],
        milestones: [],
        companyTemplates: [
          { id: 'tpl-imp', name: 'Modèle importé', tasks: [{ key: 'a', name: 'Étape', lotId: 'lot-vrd', offset: 0, duration: 1 }] },
        ],
      },
      projectOps: [{ action: 'merge', imported: { id: 'keravel', name: 'Résidence Keravel' }, existingId: 'keravel', taskStrategy: 'add' }],
      templateOps: [],
    };
    const sum = applyImportPlan(plan, S);
    const valid = validateImportState(S);
    const byName = (n) => S.tasks.find((t) => t.name === n);
    return {
      lotsAdded: sum.lotsAdded, lotsReused: sum.lotsReused, lotsRemapped: sum.lotsRemapped,
      lines: impLotLines(sum),
      reused: byName('Réutilisé')?.lotId,
      added: byName('Nouveau')?.lotId,
      collision: byName('Collision')?.lotId,
      unknown: byName('Inconnu')?.lotId,
      tplLot: S.companyTemplates.find((t) => t.id === 'tpl-imp')?.tasks[0].lotId,
      localPlomberieIntact: S.lots.find((l) => l.id === 'lot-plomberie')?.name,
      orphans: S.tasks.filter((t) => t.lotId && !S.lots.some((l) => l.id === t.lotId)).length,
      valid: valid.ok, errors: valid.errors.slice(0, 3),
      totalLots: S.lots.length,
    };
  });
  note('LOT-29', imported);
  ok(imported.reused === 'lot-electricite',
    'LOT-29 : un lot entrant dont le NOM existe déjà réutilise le lot local (aucun doublon)', 'LOT-29');
  ok(imported.added === 'lot-vrd' && imported.lotsAdded === 2,
    'LOT-29 : un lot réellement nouveau est ajouté au référentiel', 'LOT-29');
  ok(imported.localPlomberieIntact === 'Plomberie' && imported.collision !== 'lot-plomberie' && !!imported.collision,
    'LOT-29 : une collision d’ID est REMAPPÉE — le lot local n’est jamais écrasé', 'LOT-29');
  ok(imported.unknown === null,
    'LOT-29 : un lotId sans référentiel correspondant devient null', 'LOT-29');
  ok(imported.tplLot === 'lot-vrd',
    'LOT-29 : les étapes de modèle importées passent par la même résolution', 'LOT-29');
  ok(imported.orphans === 0 && imported.valid && imported.errors.length === 0,
    'LOT-29 : 0 référence orpheline après import', 'LOT-29');
  ok(imported.lines.some((l) => /lots? ajoutés?/.test(l)) && imported.lines.some((l) => /réutilisés?/.test(l)),
    'LOT-29 : l’aperçu annonce « N lots ajoutés » et « N lots réutilisés » — aucune perte silencieuse', 'LOT-29');

  // ---- LOT-30 : remplacer tous les chantiers
  const replaceAll = await ev(p, () => {
    const S = structuredClone({ ...app, undoStack: [] });
    const localBefore = S.lots.map((l) => [l.id, l.name]);
    const plan = {
      replaceAll: true,
      data: {
        lots: [{ id: 'lot-vrd', name: 'VRD', colorKey: 'amber', active: true }],
        projects: [{ id: 'nouveau', name: 'Chantier importé' }],
        tasks: [{ id: 'n1', name: 'Terrassement VRD', projectId: 'nouveau', lotId: 'lot-vrd', start: '2026-11-10T08:00', end: '2026-11-10T17:00' }],
        milestones: [],
        companyTemplates: [],
      },
      projectOps: [{ action: 'import-new', imported: { id: 'nouveau', name: 'Chantier importé' } }],
      templateOps: [],
    };
    const sum = applyImportPlan(plan, S);
    const valid = validateImportState(S);
    return {
      localBefore: localBefore.length,
      localAfter: S.lots.map((l) => [l.id, l.name]),
      kept: localBefore.every(([id]) => S.lots.some((l) => l.id === id)),
      needed: S.lots.some((l) => l.id === 'lot-vrd'),
      taskLot: S.tasks.find((t) => t.id === 'n1')?.lotId,
      valid: valid.ok,
      projects: S.projects.length,
    };
  });
  note('LOT-30', { before: replaceAll.localBefore, after: replaceAll.localAfter.length, kept: replaceAll.kept });
  ok(replaceAll.kept,
    'LOT-30 : « Remplacer tous les chantiers » ne DÉTRUIT PAS le référentiel local', 'LOT-30');
  ok(replaceAll.needed && replaceAll.taskLot === 'lot-vrd',
    'LOT-30 : les lots nécessaires à l’import sont présents et correctement référencés', 'LOT-30');
  ok(replaceAll.valid && replaceAll.projects === 1,
    'LOT-30 : l’état résultant est valide (chantiers remplacés, référentiel intact)', 'LOT-30');

  // ---- LOT-31 : validation
  const invalid = await ev(p, () => {
    const S = structuredClone({ ...app, undoStack: [] });
    S.tasks[0].lotId = 'lot-inconnu';
    const a = validateImportState(S);
    const S2 = structuredClone({ ...app, undoStack: [] });
    S2.companyTemplates = [{ id: 'tpl-bad', name: 'X', tasks: [{ key: 'a', name: 'Y', lotId: 'lot-inconnu' }] }];
    const b2 = validateImportState(S2);
    const S3 = structuredClone({ ...app, undoStack: [] });
    const good = validateImportState(S3);
    return { task: a, tpl: b2, good: good.ok };
  });
  note('LOT-31', { taskErrors: invalid.task.errors.slice(0, 2), tplErrors: invalid.tpl.errors.slice(0, 2) });
  ok(!invalid.task.ok && invalid.task.errors.some((e) => /lot inconnu/.test(e)),
    'LOT-31 : un task.lotId inconnu fait ÉCHOUER validateImportState', 'LOT-31');
  ok(!invalid.tpl.ok && invalid.tpl.errors.some((e) => /lot inconnu/.test(e)),
    'LOT-31 : un lotId d’étape de modèle inconnu fait aussi échouer la validation', 'LOT-31');
  ok(invalid.good, 'LOT-31 : l’état sain reste valide (aucun faux positif)', 'LOT-31');

  await ctx.close();
}

// ============================================================
// LOT-32 — BASELINE MÉTIER : le lot ne crée AUCUN risque
// ============================================================
console.log('\n[LOT-32] Baseline métier V2.5.0 vs V2.6.0 — résultats identiques');
{
  const snapshotOf = async (file, tag) => {
    const { ctx, p } = await newPage({ tag, file });
    const out = await ev(p, () => ({
      health: app.projects.map((x) => [x.id, JSON.stringify(getProjectHealth(x.id))]),
      delay: app.projects.map((x) => [x.id, calculateProjectDelay(x.id)]),
      decisions: getTodayDecisions(Infinity).length,
      warnings: getTodayWarnings(Infinity).length,
      actions: getTodayActions(Infinity).length,
      planningProblems: planningProblems(),
      resourceConflicts: app.resources.flatMap((r) => getResourceSchedulingConflicts(r.id, app.tasks)).length,
      resourceStates: app.resources.map((r) => [r.id, getResourceState(r.id, localDateKey(TODAY))]),
      taskStates: app.tasks.map((t) => [t.id, t.status, t.start, t.end]),
      mobilised: app.tasks.map((t) => [t.id, taskResourceIds(t).join(',')]),
    }));
    await ctx.close();
    return out;
  };
  const a = await snapshotOf(PREV, 'BASE-25');
  const c = await snapshotOf(CUR, 'BASE-26');
  const keys = Object.keys(a);
  const diffs = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(c[k]));
  note('LOT-32', { comparés: keys.length, divergents: diffs });
  ok(diffs.length === 0,
    `LOT-32 : à données métier équivalentes, V2.6.0 produit EXACTEMENT les mêmes résultats que V2.5.0 (${keys.length} indicateurs : santé, retards, décisions, surveillances, conflits ressources, états)`, 'LOT-32');
}

// ============================================================
// LOT-33 → LOT-35 — RESPONSIVE, SOMBRE, ACCESSIBILITÉ
// ============================================================
console.log('\n[LOT-33..35] Responsive, thème sombre, accessibilité');
{
  const sizes = [
    [1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800],
    [1080, 800], [900, 1000], [768, 1024], [430, 932], [390, 844], [360, 800],
  ];
  const overflows = [];
  for (const [w, h] of sizes) {
    const { ctx, p } = await newPage({ tag: `RSP-${w}`, w, h });
    const r = await ev(p, () => {
      const probe = () => document.body.scrollWidth - document.documentElement.clientWidth;
      const out = {};
      go('planning');
      app.settings.period = 'month'; save(); renderPage();
      out.planning = probe();
      go('more');
      out.settings = probe();
      openLotsManager();
      out.lotsManager = probe();
      openLotsManager('form', '');
      out.lotForm = probe();
      closeOverlay('drawer');
      openTaskForm('keravel');
      out.taskForm = probe();
      closeOverlay('drawer');
      openTaskEdit('k-windows', 'planning-gantt');
      out.taskEdit = probe();
      closeOverlay('drawer');
      return out;
    });
    const bad = Object.entries(r).filter(([, v]) => v > 1);
    if (bad.length) overflows.push({ size: `${w}×${h}`, bad });
    if (w === 390) {
      await ev(p, () => { openTaskForm('keravel'); const f = document.querySelector('#drawerFormEl'); f.querySelector('[name=lotId]').value = 'lot-electricite'; f.querySelector('[name=lotId]').dispatchEvent(new Event('change', { bubbles: true })); });
      await shot(p, '11-mobile-task-lot-390.png', { fullPage: true });
      await ev(p, () => { closeOverlay('drawer'); go('more'); openLotsManager(); });
      await shot(p, '12-mobile-lots-390.png', { fullPage: true });
    }
    await ctx.close();
  }
  note('LOT-33', { testés: sizes.length, débordements: overflows });
  ok(overflows.length === 0,
    `LOT-33 : aucun débordement horizontal du body sur ${sizes.length} formats (1920 → 360), création/édition de tâche et gestion du référentiel incluses`, 'LOT-33');
}
{
  const { ctx, p } = await newPage({ tag: 'DARK' });
  const dark = await ev(p, () => {
    setAppearance('dark');
    renderPage();
    // On lit la valeur IMMÉDIATEMENT : getComputedStyle renvoie une
    // déclaration VIVANTE, qui se vide dès que l'élément est détaché par un
    // rendu suivant.
    const bg = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).backgroundColor : null;
    };
    go('planning');
    app.settings.period = 'month'; save(); renderPage();
    const chipDot = bg('.g-label .lot-chip i');
    app.ui.planningView = 'kanban'; save(); renderPage();
    const kanbanDot = bg('.kanban-card .lot-chip i');
    app.ui.planningView = 'gantt'; save(); renderPage();
    go('more');
    openLotsManager();
    const managerDot = bg('.lot-row .lot-dot');
    const nameEl = document.querySelector('.lot-row .lot-body b');
    return {
      dark: document.body.classList.contains('dark'),
      chipDot, kanbanDot, managerDot,
      nameColor: nameEl ? getComputedStyle(nameEl).color : null,
      rows: document.querySelectorAll('.lot-row').length,
    };
  });
  note('LOT-34', dark);
  const parsed = (c) => (c || '').match(/\d+/g)?.map(Number) || [];
  const isLightened = (c) => { const v = parsed(c); return v.length >= 3 && v[0] + v[1] + v[2] > 180; };
  ok(dark.dark && dark.rows === 9, 'LOT-34 : le référentiel s’affiche correctement en thème sombre', 'LOT-34');
  ok(isLightened(dark.chipDot) && isLightened(dark.kanbanDot) && isLightened(dark.managerDot),
    'LOT-34 : les pastilles de lot utilisent les variantes SOMBRES du système de couleurs (teintes éclaircies)', 'LOT-34');
  await shot(p, '13-dark-lots.png');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'A11Y' });
  const a11y = await ev(p, () => {
    go('planning');
    app.settings.period = 'month'; save(); renderPage();
    const ganttChips = [...document.querySelectorAll('.g-label .lot-chip')];
    app.ui.planningView = 'kanban'; save(); renderPage();
    const kanbanChips = [...document.querySelectorAll('.kanban-card .lot-chip')];
    app.ui.planningView = 'gantt'; save(); renderPage();
    openLotsManager();
    const rows = [...document.querySelectorAll('.lot-row')];
    const navButtons = [...document.querySelectorAll('.lot-actions button')];
    return {
      ganttNamed: ganttChips.length > 0 && ganttChips.every((c) => c.textContent.trim().length > 0),
      kanbanNamed: kanbanChips.length > 0 && kanbanChips.every((c) => c.textContent.trim().length > 0),
      dotsHidden: [...document.querySelectorAll('.lot-chip i')].every((i) => i.getAttribute('aria-hidden') === 'true'),
      rowsNamed: rows.every((r) => r.querySelector('.lot-body b')?.textContent.trim().length > 0),
      dotDecorative: rows.every((r) => r.querySelector('.lot-dot')?.getAttribute('aria-hidden') === 'true'),
      labelled: navButtons.filter((b) => /↑|↓/.test(b.textContent)).every((b) => (b.getAttribute('aria-label') || '').length > 3),
      selectLabelled: !!document.querySelector('[aria-label="Filtrer par lot"]'),
    };
  });
  note('LOT-35', a11y);
  ok(a11y.ganttNamed && a11y.kanbanNamed,
    'LOT-35 : le NOM du lot est toujours affiché en Gantt et en Kanban — jamais la couleur seule', 'LOT-35');
  ok(a11y.rowsNamed && a11y.dotsHidden && a11y.dotDecorative,
    'LOT-35 : les pastilles colorées sont décoratives (aria-hidden), l’information est portée par le texte', 'LOT-35');
  ok(a11y.labelled, 'LOT-35 : les boutons « ↑ / ↓ » portent un aria-label explicite', 'LOT-35');
  ok(a11y.selectLabelled, 'LOT-35 : le filtre de lot du Planning est étiqueté', 'LOT-35');
  await ctx.close();
}

// ============================================================
// ESSENTIEL / PILOTAGE
// ============================================================
console.log('\n[NIVEAUX] Essentiel vs Pilotage');
{
  const { ctx, p } = await newPage({ tag: 'LVL' });
  const levels = await ev(p, () => {
    setDepth('essential');
    go('more');
    const settingsRowsText = () =>
      [...document.querySelectorAll('.settings-row')].map((r) => r.textContent).join(' | ');
    const essentialSettings = settingsRowsText();
    const canSelectLot = (() => {
      openTaskForm('keravel');
      const has = !!document.querySelector('#drawerFormEl [name=lotId]');
      closeOverlay('drawer');
      return has;
    })();
    const seesLot = (() => {
      openTask('k-lining');
      const t = /Plâtrerie/.test(document.querySelector('#drawerContent').textContent);
      closeOverlay('drawer');
      return t;
    })();
    setDepth('pilot');
    go('more');
    const pilotSettings = settingsRowsText();
    return {
      essentialHasManager: /Lots \/ corps d’état/.test(essentialSettings),
      pilotHasManager: /Lots \/ corps d’état/.test(pilotSettings),
      canSelectLot, seesLot,
    };
  });
  note('NIVEAUX', levels);
  ok(!levels.essentialHasManager && levels.pilotHasManager,
    'NIVEAUX : la gestion du référentiel n’apparaît qu’en Pilotage', 'LOT-04');
  ok(levels.canSelectLot && levels.seesLot,
    'NIVEAUX : en Essentiel, l’utilisateur VOIT et SÉLECTIONNE quand même le lot d’une tâche', 'LOT-04');

  // Pas de tableau de bord « analyse des lots », même en Pilotage.
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  ok(!/Analyse des lots|Répartition par lot|lot-dashboard|lotStats/i.test(src),
    'NIVEAUX : aucun tableau de bord d’analyse des lots — V2.6 structure, elle n’analyse pas', 'LOT-04');
  await ctx.close();
}

// ============================================================
// HISTORIQUE DU RÉFÉRENTIEL
// ============================================================
console.log('\n[HISTORIQUE] Événements de référentiel — globaux, jamais rattachés à un chantier');
{
  const { ctx, p } = await newPage({ tag: 'HIST' });
  const hist = await ev(p, () => {
    const before = app.history.length;
    openLotsManager('form', '');
    const f = document.querySelector('#lotFormEl');
    f.querySelector('[name=name]').value = 'Ravalement';
    f.requestSubmit();
    const id = app.lots.at(-1).id;
    setLotActive(id, false);
    setLotActive(id, true);
    const events = app.history.filter((h) => h.entityType === 'lot');
    return {
      before,
      kinds: events.map((e) => e.kind),
      entityIds: [...new Set(events.map((e) => e.entityId))],
      projectIds: events.map((e) => historyProjectId(e)),
      inProjectHistory: projectHistory('keravel').some((h) => h.entityType === 'lot'),
      single: !Object.keys(app).some((k) => /history/i.test(k) && k !== 'history'),
    };
  });
  note('HISTORIQUE', hist);
  ok(hist.kinds.includes('lot-created') && hist.kinds.includes('lot-disabled') && hist.kinds.includes('lot-enabled'),
    'HISTORIQUE : les événements lot-created / lot-disabled / lot-enabled sont tracés', 'LOT-04');
  ok(hist.projectIds.every((x) => x === null) && !hist.inProjectHistory,
    'HISTORIQUE : un événement de RÉFÉRENTIEL n’apparaît JAMAIS dans l’historique d’un chantier', 'LOT-04');
  ok(hist.single, 'HISTORIQUE : app.history reste l’unique collection d’historique', 'LOT-04');
  await ctx.close();
}

// ============================================================
// GEL BYTE-IDENTITÉ — moteurs hors périmètre
// ============================================================
console.log('\n[FREEZE-260] Byte-identité des moteurs hors périmètre V2.6.0');
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
  // Les moteurs que le LOT ne doit PAS modifier (liste du cahier des charges).
  const protectedEngines = [
    'getResourceTasks', 'taskResourceIds', 'taskHasResource', 'normalizeTaskResources',
    'getResourceState', 'getResourceSchedulingConflicts', 'getResourceConflicts',
    'getMaxConcurrentTasks', 'getResourceLoad', 'getResourcePeriodState',
    'planningProblems', 'evaluateScenario', 'planReflow', 'applyReflowPlan',
    'setTaskStatus', 'kanbanDrop', 'dropTask', 'requestTaskScheduleMove',
    'getProjectHealth', 'calculateProjectDelay', 'getTodayDecisions', 'getTodayWarnings',
    'getTodayActions', 'buildKanvixBackup', 'confirmKanvixRestore', 'validateKanvixBackup',
    'historyProjectId', 'projectHistory', 'historyStamp', 'historyGroups',
    'scale', 'pos', 'shiftPlanning', 'planningToday', 'setPeriod',
    'getTaskPredecessors', 'getTaskSuccessors', 'taskCreatesCycle',
    'nextWorkingTime', 'workdayDelay', 'getWeekNumber', 'weekBounds',
    'getResourceUnavailabilities', 'getResourceUnavailabilitiesInRange', 'resourceIsUnavailable',
    'resourceUnavailabilityConflicts', 'submitUnavailability', 'confirmDeleteResource',
  ];
  let moved = [], frozen = 0;
  for (const name of protectedEngines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    if (a && c && md5(a) === md5(c)) frozen++;
    else moved.push(`${name} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-260', { gelés: frozen, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-260 : les ${protectedEngines.length} moteurs à protéger sont byte-identiques à V2.5.0 — le lot ne modifie AUCUN résultat métier`, 'FREEZE-260');

  // Et ce qui devait changer a bien changé.
  const expectedChanged = ['planningTasks', 'taskColorClass', 'openTaskForm', 'openTaskEdit', 'submitTaskEdit', 'setPlanningFilter', 'validateImportState', 'renderMore', 'createRework', 'lotChip'];
  const stillSame = expectedChanged.filter((n) => {
    const a = extractFn(prevSrc, n), c = extractFn(curSrc, n);
    return a && c && md5(a) === md5(c);
  });
  note('FREEZE-260-changés', { inchangés: stillSame });
  ok(stillSame.length === 0, 'FREEZE-260 : les fonctions du périmètre V2.6.0 ont bien évolué', 'FREEZE-260');

  // Un seul moteur par concern.
  const dupes = ['taskEffectiveColorKey', 'lot', 'activeLots', 'lotLabel', 'assignableLots', 'lotReferences', 'canDeleteLot', 'planningTasks', 'taskColorClass']
    .filter((n) => (curSrc.match(new RegExp(`function\\s+${n}\\s*\\(`, 'g')) || []).length !== 1);
  ok(dupes.length === 0, 'FREEZE-260 : un seul moteur par concern (aucune définition dupliquée)', 'FREEZE-260');

  // La couleur est lue en UN seul endroit.
  // Les lectures restantes de t.colorKey sont des lectures de FORMULAIRE (la
  // pastille sélectionnée doit refléter la couleur PROPRE de la tâche, pas la
  // couleur effective), jamais des lectures d'affichage.
  const colorFn = extractFn(curSrc, 'taskColorClass');
  const displayReads = (curSrc.match(/colorKey/g) || []).length;
  const formReads = (curSrc.match(/colorKey \|\| "auto"/g) || []).length;
  note('FREEZE-260-couleur', { taskColorClass: colorFn, lecturesFormulaire: formReads, total: displayReads });
  ok(/taskEffectiveColorKey\(t\)/.test(colorFn || '') && !/t\.colorKey/.test(colorFn || ''),
    'FREEZE-260 : taskColorClass() lit taskEffectiveColorKey() et JAMAIS t.colorKey — unique source d’affichage', 'FREEZE-260');
  ok(!/class="g-bar[^`]*\$\{[^}]*t\.colorKey/.test(curSrc) && !/kanban-card \$\{[^}]*t\.colorKey/.test(curSrc),
    'FREEZE-260 : ni la barre Gantt ni la carte Kanban ne lisent t.colorKey directement', 'FREEZE-260');
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-260] Erreurs JavaScript applicatives');
note('CONSOLE-260', allErrs);
ok(allErrs.length === 0, 'CONSOLE-260 : 0 erreur JavaScript applicative sur l’ensemble de la recette', 'CONSOLE-260');

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
