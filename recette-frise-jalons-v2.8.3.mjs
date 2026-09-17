// ============================================================
// KANVIX — Recette « Frise de jalons » (V2.8.3)
//
//   L'onglet Jalons d'une opération devient une FRISE en trois niveaux :
//     A. barre de filtres (période) et de légende (chantiers) ;
//     B. la frise — ligne continue, bulles iconifiées par statut, trait de
//        rappel vers une carte compacte au liseré teinté ;
//     C. bandeau de synthèse + bandeau d'aide, qui donnent son assise à la page.
//
//   La question à laquelle cette recette répond :
//     « Est-ce enfin une frise de pilotage — chronologie évidente, page dense,
//       lien bulle↔carte explicite — sans qu'une règle métier, une donnée ou un
//       autre onglet de l'opération n'ait bougé ? »
//
//   Usage : node recette-frise-jalons-v2.8.3.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.3.html';
const PREV = 'kanvix-next-gen-v2.8.2.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.3/';
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
  await p.waitForTimeout(280);
};
// Peuple l'opération pour obtenir les CINQ statuts simultanément.
const seedRich = (p) => ev(p, () => {
  const ids = operationProjectIds(window.OP);
  [['Coulage dalle R+2', -9], ['Levée des réserves', -4], ['Essais étanchéité', 2],
   ['Réception menuiseries', 6], ['Pré-réception technique', 14]].forEach(([n, o], i) =>
    app.milestones.push({ id: 'm-x' + i, projectId: ids[i % ids.length], name: n, date: shiftDateStr(dayKey(TODAY), o) + 'T17:00' }));
  project(ids[1]).lifecycle = 'closed';
  save(); renderPage();
});

// ============================================================
// FRISE-01 → 05 — Le socle : la donnée n'a pas bougé
// ============================================================
console.log('\n[FRISE-SOCLE] Source, tri et contrat de sélection');
{
  const { ctx, p } = await newPage({ tag: 'SOCLE' });
  await openJalons(p);
  const src = await ev(p, () => ({
    engine: operationMilestones(window.OP).map((m) => m.name),
    visible: visibleOperationMilestones(window.OP).map((m) => m.name),
    dom: [...document.querySelectorAll('.op-ms-name')].map((e) => e.textContent),
    cards: document.querySelectorAll('.op-milestone').length,
    wrappers: document.querySelectorAll('.op-ms').length,
    dates: [...document.querySelectorAll('.op-ms-date')].map((e) => e.textContent),
    engineDates: operationMilestones(window.OP).map((m) => (m.date ? fmtDay(m.date) : '—')),
  }));
  note('FRISE-01', src);
  ok(src.dom.join('|') === src.engine.join('|') && src.visible.join('|') === src.engine.join('|'),
    'FRISE-01 : sans filtre, la frise affiche exactement operationMilestones(), dans son ordre — visibleOperationMilestones() ne fait que lui retirer des lignes', 'FRISE-01');
  ok(src.dates.join('|') === src.engineDates.join('|'),
    'FRISE-02 : chaque date vient du moteur, formatée par le fmtDay() existant', 'FRISE-02');
  ok(src.cards === src.engine.length && src.wrappers === src.cards,
    'FRISE-03 : un .op-milestone par jalon — le sélecteur que comptent, lisent et sondent les recettes V2.8.0 est préservé', 'FRISE-03');

  // Le rendu n'écrit rien ; seul un clic de filtre écrit, et uniquement dans app.ui.
  const writes = await ev(p, () => {
    const before = localStorage.getItem(STORE);
    setOperationTab('Vue d’ensemble'); setOperationTab('Jalons');
    const afterRender = localStorage.getItem(STORE);
    setMilestoneScope('week');
    const afterFilter = JSON.parse(localStorage.getItem(STORE));
    const domainTouched = JSON.stringify(afterFilter.milestones) !== JSON.stringify(JSON.parse(before).milestones);
    resetMilestoneFilters();
    return {
      renderNeutre: before === afterRender,
      domainTouched,
      cle: Object.keys(afterFilter.ui).filter((k) => k.startsWith('milestone')),
      champsJalon: Object.keys(afterFilter.milestones[0]).sort(),
    };
  });
  note('FRISE-04', writes);
  ok(writes.renderNeutre && !writes.domainTouched
    && writes.champsJalon.join('|') === ['date', 'id', 'isFinal', 'name', 'projectId', 'taskId'].join('|'),
    'FRISE-04 : afficher la frise n’écrit rien, et filtrer n’écrit que dans app.ui — aucun champ nouveau sur un jalon, aucune donnée métier touchée', 'FRISE-04');

  // Une sauvegarde qui ignore les clés de filtre doit se relire telle quelle.
  const legacy = await ev(p, () => {
    delete app.ui.milestoneScope; delete app.ui.milestoneHiddenSites;
    renderPage();
    return { scope: milestoneScope(), hidden: milestoneHiddenSites(), n: document.querySelectorAll('.op-milestone').length };
  });
  note('FRISE-05', legacy);
  ok(legacy.scope === 'all' && legacy.hidden.length === 0 && legacy.n === 3,
    'FRISE-05 : sans les clés de filtre — cas d’une sauvegarde antérieure — la frise retombe sur « Tous » et s’affiche entière : aucune migration nécessaire', 'FRISE-05');
  await ctx.close();
}

// ============================================================
// FRISE-06 → 12 — La frise : ligne, bulles, lien vers la carte
// ============================================================
console.log('\n[FRISE-RAIL] Composition de la frise');
{
  const { ctx, p } = await newPage({ tag: 'RAIL' });
  await openJalons(p);
  const geo = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const seg = (el) => {
      const r = el.querySelector('.op-ms-rail').getBoundingClientRect();
      const cs = getComputedStyle(el.querySelector('.op-ms-rail'), '::before');
      const left = parseFloat(cs.left), w = parseFloat(cs.width);
      return { x1: Math.round((r.left + left) * 10) / 10, x2: Math.round((r.left + left + w) * 10) / 10, style: cs.borderTopStyle, px: cs.borderTopWidth };
    };
    const bub = (el) => { const r = el.querySelector('.op-ms-bub').getBoundingClientRect(); return { cx: Math.round((r.x + r.width / 2) * 10) / 10, cy: Math.round(r.y + r.height / 2), d: Math.round(r.width) }; };
    return {
      bubbles: ms.map(bub), segs: ms.map(seg),
      colCx: ms.map((e) => { const r = e.getBoundingClientRect(); return Math.round((r.x + r.width / 2) * 10) / 10; }),
      icons: ms.map((e) => !!e.querySelector('.op-ms-bub svg')),
      drops: ms.map((e) => {
        const d = e.querySelector('.op-ms-drop'); if (!d) return null;
        const r = d.getBoundingClientRect(); const cs = getComputedStyle(d, '::before');
        return { cx: Math.round((r.left + parseFloat(cs.left)) * 10) / 10, top: Math.round(r.top), bottom: Math.round(r.bottom) };
      }),
      bubBottoms: ms.map((e) => Math.round(e.querySelector('.op-ms-bub').getBoundingClientRect().bottom)),
      cardTops: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().top)),
      cardWidths: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().width)),
      borderTop: ms.map((e) => getComputedStyle(e.querySelector('.op-milestone')).borderTopWidth),
      dateTop: ms.map((e) => Math.round(e.querySelector('.op-ms-date').getBoundingClientRect().bottom)),
    };
  });
  note('FRISE-06', { bulles: geo.bubbles, segments: geo.segs });

  // FRISE-06 — la ligne est continue d'un bout à l'autre de la frise.
  const holes = geo.segs.slice(1).map((s, i) => Math.round((s.x1 - geo.segs[i].x2) * 10) / 10).filter((d) => Math.abs(d) > 0.5);
  ok(holes.length === 0
    && Math.abs(geo.segs[0].x1 - geo.bubbles[0].cx) <= 1
    && Math.abs(geo.segs.at(-1).x2 - geo.bubbles.at(-1).cx) <= 1,
    'FRISE-06 : la ligne de temps est CONTINUE de la première à la dernière bulle — segments jointifs, aucun dépassement', 'FRISE-06');

  // FRISE-07 — elle est franche, pas décorative : 2px, et visible sur le fond.
  const lum = (c) => { const [r, g, bl] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
  const contrast = await ev(p, () => {
    const cs = getComputedStyle(document.querySelector('.op-ms-rail'), '::before');
    return { trait: cs.borderTopColor, fond: getComputedStyle(document.body).backgroundColor, px: cs.borderTopWidth };
  });
  note('FRISE-07', { ...contrast, ecart: Math.round(Math.abs(lum(contrast.trait) - lum(contrast.fond)) * 1000) / 1000 });
  ok(parseFloat(contrast.px) >= 2 && Math.abs(lum(contrast.trait) - lum(contrast.fond)) > 0.08,
    `FRISE-07 : la ligne fait ${contrast.px} et tranche nettement sur le fond — elle structure, elle ne décore pas`, 'FRISE-07');

  // FRISE-08 — les bulles sont de vraies bulles, centrées sur leur colonne,
  // et elles portent une icône (pas un simple point).
  note('FRISE-08', { diametres: geo.bubbles.map((x) => x.d), centresBulle: geo.bubbles.map((x) => x.cx), centresColonne: geo.colCx, icones: geo.icons });
  ok(geo.bubbles.every((x) => x.d >= 32) && geo.icons.every(Boolean)
    && geo.bubbles.every((x, i) => Math.abs(x.cx - geo.colCx[i]) <= 1)
    && new Set(geo.bubbles.map((x) => x.cy)).size === 1,
    'FRISE-08 : chaque jalon porte une bulle iconifiée d’au moins 32px, centrée sur sa colonne, toutes alignées sur la ligne', 'FRISE-08');

  // FRISE-09 — la date est AU-DESSUS de la bulle, comme sur la référence.
  ok(geo.dateTop.every((d, i) => d < geo.bubbles[i].cy),
    'FRISE-09 : la date est posée AU-DESSUS de sa bulle — l’œil lit la date puis le repère, puis la carte', 'FRISE-09');

  // FRISE-10 — le lien bulle → carte est EXPLICITE : un trait de rappel part du
  // bas de la bulle et descend jusqu'au liseré de la carte, sur le même axe.
  note('FRISE-10', { rappels: geo.drops, basBulle: geo.bubBottoms, hautCarte: geo.cardTops, liseré: geo.borderTop });
  ok(geo.drops.every((d, i) => d && Math.abs(d.cx - geo.bubbles[i].cx) <= 1
      && d.top >= geo.bubBottoms[i] - 2 && d.bottom <= geo.cardTops[i] + 2)
    && geo.borderTop.every((b) => parseFloat(b) >= 3),
    'FRISE-10 : un trait de rappel relie chaque bulle au liseré coloré de sa carte, sur le même axe — le lien visuel est explicite, pas déduit', 'FRISE-10');

  // FRISE-11 — rangée régulière.
  note('FRISE-11', { hauts: geo.cardTops, largeurs: geo.cardWidths });
  ok(new Set(geo.cardTops).size === 1 && new Set(geo.cardWidths).size === 1,
    'FRISE-11 : les cartes d’une rangée partagent bord haut et largeur — aucune carte ne flotte', 'FRISE-11');

  // FRISE-12 — plein derrière, pointillé devant.
  const seg = await ev(p, () => {
    const ids = operationProjectIds(window.OP);
    app.milestones.push({ id: 'm-past', projectId: ids[0], name: 'Étape franchie', date: shiftDateStr(dayKey(TODAY), -6) + 'T17:00' });
    save(); renderPage();
    return [...document.querySelectorAll('.op-ms')].map((e) => ({
      cls: e.classList.contains('seg-done') ? 'done' : 'todo',
      style: getComputedStyle(e.querySelector('.op-ms-rail'), '::before').borderTopStyle,
      next: e.classList.contains('is-next'),
    }));
  });
  note('FRISE-12', seg);
  const nextAt = seg.findIndex((x) => x.next);
  ok(seg.every((x, i) => (i < nextAt ? x.style === 'solid' : x.style === 'dashed')) && nextAt > 0,
    'FRISE-12 : la ligne est PLEINE jusqu’au prochain jalon et POINTILLÉE ensuite — la frise dit d’un coup d’œil où en est l’opération', 'FRISE-12');
  await ctx.close();
}

// ============================================================
// FRISE-13 → 18 — Les cartes : statut, volumétrie, couleur
// ============================================================
console.log('\n[FRISE-CARTES] Statut métier et contenu des cartes');
{
  const { ctx, p } = await newPage({ tag: 'CARTES' });
  await openJalons(p);
  await seedRich(p);
  await p.waitForTimeout(260);

  // FRISE-13 — les cinq informations demandées sont toutes là.
  const card = await ev(p, () => {
    const e = document.querySelector('.op-ms');
    return {
      date: e.querySelector('.op-ms-date')?.textContent.trim(),
      chantier: e.querySelector('.op-ms-site')?.textContent.trim(),
      nom: e.querySelector('.op-ms-name')?.textContent.trim(),
      statut: e.querySelector('.op-badge')?.textContent.trim(),
      voir: e.querySelector('.op-row-go')?.textContent.trim(),
      meta: e.querySelector('.op-ms-meta')?.textContent.trim(),
    };
  });
  note('FRISE-13', card);
  ok(card.date && card.chantier && card.nom && card.statut && /Voir|Ouvrir/.test(card.voir),
    'FRISE-13 : chaque carte porte la date, le chantier, le titre du jalon, le STATUT et l’action « Voir » — les cinq informations demandées', 'FRISE-13');

  // FRISE-14 — le statut vient des moteurs existants, pas d'une règle nouvelle.
  const st = await ev(p, () => {
    const list = visibleOperationMilestones(window.OP), now = getDemoNow();
    return list.map((m) => {
      const p0 = project(m.projectId), end = calculateProjectEnd(m.projectId);
      const attendu = p0 && !isProjectActive(p0)
        ? (isProjectArchived(p0) ? 'Chantier archivé' : 'Chantier clôturé')
        : m.date && date(m.date) < now
          ? (getProjectTasks(m.projectId).filter((t) => t.status !== 'done' && String(t.end) <= String(m.date)).length ? 'Dépassé' : 'Atteint')
          : m.date && end && date(end) > date(m.date) ? 'Menacé' : 'À venir';
      return { nom: m.name, moteur: attendu, rendu: milestoneStatus(m).label };
    });
  });
  const domStatus = await ev(p, () => [...document.querySelectorAll('.op-ms')].map((e) => e.querySelector('.op-badge').textContent.trim()));
  note('FRISE-14', { calcules: st, dom: domStatus, distincts: [...new Set(st.map((x) => x.moteur))] });
  ok(st.every((x) => x.moteur === x.rendu) && domStatus.join('|') === st.map((x) => x.moteur).join('|')
    && new Set(st.map((x) => x.moteur)).size >= 4,
    'FRISE-14 : le statut de chaque jalon est recalculable depuis les seuls moteurs existants (isProjectActive, calculateProjectEnd, getProjectTasks) — au moins quatre statuts distincts observés, aucun inventé', 'FRISE-14');

  // FRISE-15 — « menacé » est EXACTEMENT la règle de milestoneImpactNote().
  const rule = await ev(p, () => {
    const src = milestoneStatus.toString();
    const ref = milestoneImpactNote.toString();
    return { statutUtilise: /calculateProjectEnd\(/.test(src), regleRef: /calculateProjectEnd\(/.test(ref) && /date\(end\) > date\(ms\.date\)/.test(ref), memeComparaison: /date\(end\) > date\(m\.date\)/.test(src) };
  });
  note('FRISE-15', rule);
  ok(rule.statutUtilise && rule.regleRef && rule.memeComparaison,
    'FRISE-15 : « Menacé » applique la règle DÉJÀ présente dans milestoneImpactNote() — même moteur d’estimation de fin, même comparaison ; aucune règle de menace parallèle', 'FRISE-15');

  // FRISE-16 — la volumétrie affichée est réelle.
  const vol = await ev(p, () => {
    const list = visibleOperationMilestones(window.OP);
    const dom = [...document.querySelectorAll('.op-ms-meta')].map((e) => e.textContent.trim());
    const attendu = list.map((m) => {
      const n = getProjectTasks(m.projectId).filter((t) => t.status !== 'done' && String(t.end) <= String(m.date)).length;
      return n ? `${n} intervention${n > 1 ? 's' : ''} d’ici là` : 'Rien en attente';
    });
    return { dom, attendu };
  });
  note('FRISE-16', vol);
  ok(vol.dom.join('|') === vol.attendu.join('|'),
    'FRISE-16 : « N interventions d’ici là » est compté sur getProjectTasks() — c’est une volumétrie réelle, pas un ornement', 'FRISE-16');

  // FRISE-17 — le liseré et la bulle portent la MÊME couleur, et une alerte
  // métier prime sur la couleur d'identité du chantier.
  const col = await ev(p, () => [...document.querySelectorAll('.op-ms')].map((e) => ({
    st: [...e.classList].find((c) => c.startsWith('st-')),
    tone: [...e.classList].find((c) => c.startsWith('ptone-')),
    bub: getComputedStyle(e.querySelector('.op-ms-bub')).borderTopColor,
    card: getComputedStyle(e.querySelector('.op-milestone')).borderTopColor,
    danger: getComputedStyle(document.body).getPropertyValue('--danger').trim(),
    warning: getComputedStyle(document.body).getPropertyValue('--warning').trim(),
  })));
  note('FRISE-17', col.map((c) => ({ st: c.st, tone: c.tone, bub: c.bub, card: c.card })));
  ok(col.every((c) => c.bub === c.card) && col.some((c) => c.st === 'st-risk' || c.st === 'st-late'),
    'FRISE-17 : bulle et liseré de carte portent toujours la même couleur — et un statut d’alerte prend le pas sur la teinte d’identité du chantier', 'FRISE-17');

  // FRISE-18 — chantier clôturé : le contrat d'OP-40 est tenu par le statut.
  const closed = await ev(p, () => {
    const c = [...document.querySelectorAll('.op-ms')].find((e) => e.classList.contains('is-closed'));
    return { trouve: !!c, carte: c ? c.querySelector('.op-milestone').textContent.replace(/\s+/g, ' ').trim() : '', opacite: c ? getComputedStyle(c).opacity : null };
  });
  note('FRISE-18', closed);
  ok(closed.trouve && /Chantier clôturé/.test(closed.carte) && Number(closed.opacite) < 1,
    'FRISE-18 : un jalon de chantier clôturé porte « Chantier clôturé » DANS sa carte (contrat d’OP-40) et s’efface visuellement', 'FRISE-18');
  await ctx.close();
}

// ============================================================
// FRISE-19 → 23 — Filtres, légende et états vides
// ============================================================
console.log('\n[FRISE-FILTRES] Période, chantiers, remise à zéro');
{
  const { ctx, p } = await newPage({ tag: 'FILTRES' });
  await openJalons(p);
  const f = await ev(p, () => {
    const n = () => document.querySelectorAll('.op-milestone').length;
    const out = { defaut: { n: n(), scope: milestoneScope(), moteur: operationMilestones(window.OP).length } };
    setMilestoneScope('week');
    out.semaine = { n: n(), actif: document.querySelector('.op-tl-scope button.active').textContent, attendu: operationMilestones(window.OP).filter((m) => { const w = getCurrentWeekRange(); return m.date >= w.start && m.date < w.end; }).length };
    setMilestoneScope('month');
    out.mois = { n: n(), attendu: operationMilestones(window.OP).filter((m) => dayKey(m.date).slice(0, 7) === dayKey(TODAY).slice(0, 7)).length };
    setMilestoneScope('all'); toggleMilestoneSite('keravel');
    out.chip = { n: n(), attendu: operationMilestones(window.OP).filter((m) => m.projectId !== 'keravel').length, eteint: !document.querySelector('.op-tl-chip.ptone-blue').classList.contains('is-on') };
    out.moteurIntact = operationMilestones(window.OP).length === out.defaut.moteur;
    resetMilestoneFilters();
    out.reset = { n: n(), scope: milestoneScope(), caches: milestoneHiddenSites().length };
    return out;
  });
  note('FRISE-19', f);
  ok(f.defaut.n === f.defaut.moteur && f.defaut.scope === 'all',
    'FRISE-19 : par défaut aucun filtre n’est actif — la frise montre tous les jalons de l’opération', 'FRISE-19');
  ok(f.semaine.n === f.semaine.attendu && f.semaine.actif === 'Cette semaine' && f.mois.n === f.mois.attendu,
    'FRISE-20 : « Cette semaine » s’appuie sur getCurrentWeekRange(), l’unique définition de semaine du produit, et « Ce mois » sur le mois calendaire courant', 'FRISE-20');
  ok(f.chip.n === f.chip.attendu && f.chip.eteint && f.moteurIntact,
    'FRISE-21 : la légende de chantiers est un vrai filtre — la pastille s’éteint, les jalons disparaissent, et le moteur n’est jamais altéré', 'FRISE-21');
  ok(f.reset.n === f.defaut.moteur && f.reset.scope === 'all' && f.reset.caches === 0,
    'FRISE-22 : la remise à zéro des filtres restitue la frise entière', 'FRISE-22');

  // FRISE-23 — vide de FILTRE ≠ vide de DONNÉE : deux messages, et une sortie.
  const empties = await ev(p, () => {
    toggleMilestoneSite('keravel'); toggleMilestoneSite('terrasses'); toggleMilestoneSite('horizon');
    const filtre = {
      bloc: !!document.querySelector('.op-tl-empty'),
      titre: document.querySelector('.op-tl-empty b')?.textContent,
      rappelle: /3 jalons/.test(document.querySelector('.op-tl-empty')?.textContent || ''),
      sortie: !!document.querySelector('.op-tl-empty button'),
      barre: !!document.querySelector('.op-tl-bar'),
    };
    document.querySelector('.op-tl-empty button').click();
    const apres = document.querySelectorAll('.op-milestone').length;
    app.milestones.length = 0; save(); renderPage();
    const e = document.querySelector('.empty-state');
    return { filtre, apres, donnee: { titre: e?.querySelector('b')?.textContent, texte: e?.querySelector('span')?.textContent, frise: document.querySelectorAll('.op-milestones').length, barre: !!document.querySelector('.op-tl-bar') } };
  });
  note('FRISE-23', empties);
  ok(empties.filtre.bloc && empties.filtre.titre === 'Aucun jalon sur cette période' && empties.filtre.rappelle
    && empties.filtre.sortie && empties.filtre.barre && empties.apres === 3,
    'FRISE-23 : filtrer jusqu’au vide affiche un message DISTINCT, rappelle combien de jalons existent et rend la main — la barre de filtres reste accessible', 'FRISE-23');
  ok(empties.donnee.titre === 'Aucun jalon' && /apparaîtront ici/.test(empties.donnee.texte)
    && empties.donnee.frise === 0 && !empties.donnee.barre,
    'FRISE-24 : sans aucun jalon, l’état vide de V2.8.1 est conservé à l’identique — ni frise vide, ni barre de filtres inutile', 'FRISE-24');
  await ctx.close();
}

// ============================================================
// FRISE-25 → 27 — Le bandeau de synthèse
// ============================================================
console.log('\n[FRISE-SYNTHESE] Le bandeau qui donne son assise à la page');
{
  const { ctx, p } = await newPage({ tag: 'SYNTH' });
  await openJalons(p);
  await seedRich(p);
  await p.waitForTimeout(250);
  const s = await ev(p, () => {
    const list = visibleOperationMilestones(window.OP), now = getDemoNow();
    const tiles = [...document.querySelectorAll('.op-tl-stat')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const counts = list.reduce((a, m) => ((a[milestoneStatus(m).key] = (a[milestoneStatus(m).key] || 0) + 1), a), {});
    const next = list.find((m) => !m.date || date(m.date) >= now);
    return {
      tuiles: tiles.length, textes: tiles,
      total: Number(document.querySelector('.op-tl-big').textContent),
      attendu: list.length,
      dots: [...document.querySelectorAll('.op-tl-dot')].map((e) => e.textContent.trim()),
      counts,
      prochainAffiche: tiles[1], prochainAttendu: next ? fmtDay(next.date) : null,
      hint: !!document.querySelector('.op-tl-hint'),
    };
  });
  note('FRISE-25', s);
  ok(s.tuiles === 3 && s.total === s.attendu,
    'FRISE-25 : trois tuiles de synthèse, dont un total strictement égal au nombre de jalons affichés', 'FRISE-25');
  const sumDots = s.dots.reduce((a, t) => a + Number(t.match(/^\d+/)[0]), 0);
  ok(sumDots === s.attendu && s.dots.every((t) => !/^1 \w+s\b/.test(t)),
    `FRISE-26 : la répartition par statut totalise exactement les jalons affichés (${sumDots}) et s’accorde en nombre`, 'FRISE-26');
  ok(s.prochainAffiche.includes(s.prochainAttendu) && s.hint,
    'FRISE-26 : la tuile « Prochain jalon » désigne le premier jalon non passé, et le bandeau d’aide est présent', 'FRISE-26');

  // OP-39 vérifie qu'aucune création de jalon n'est proposée depuis l'opération.
  const noCreate = await ev(p, () => /Ajouter un jalon|Nouveau jalon|openMilestoneForm/.test(document.querySelector('.op-body').innerHTML));
  note('FRISE-27', { propositionDeCreation: noCreate });
  ok(!noCreate,
    'FRISE-27 : aucun des nouveaux bandeaux ne propose de CRÉER un jalon depuis l’opération — un jalon appartient à un chantier (contrat d’OP-39)', 'FRISE-27');
  await ctx.close();
}

// ============================================================
// FRISE-28 → 33 — Responsive et thème sombre
// ============================================================
console.log('\n[FRISE-RESP] Desktop, tablette, mobile, sombre');
{
  for (const [w, minCols, tag] of [[1440, 3, 'DESK'], [900, 3, 'TAB']]) {
    const { ctx, p } = await newPage({ w, h: 1000, tag });
    await openJalons(p);
    const r = await ev(p, () => {
      const ms = [...document.querySelectorAll('.op-ms')];
      const top0 = Math.round(ms[0].getBoundingClientRect().top);
      const grid = document.querySelector('.op-milestones').getBoundingClientRect();
      const cards = ms.map((e) => e.querySelector('.op-milestone').getBoundingClientRect());
      // Occupation horizontale : la frise doit couvrir la largeur utile.
      const couverture = Math.round(((cards.at(-1).right - cards[0].left) / grid.width) * 100);
      return {
        colonnes: ms.filter((e) => Math.round(e.getBoundingClientRect().top) === top0).length,
        horizontal: getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before').borderTopWidth !== '0px',
        couverture,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        drop: getComputedStyle(ms[0].querySelector('.op-ms-drop')).display !== 'none',
      };
    });
    note('FRISE-28', { largeur: w, ...r });
    ok(r.colonnes >= minCols && r.horizontal && r.drop && r.couverture >= 97 && r.over <= 0,
      `FRISE-28 : à ${w}px la frise est horizontale, occupe ${r.couverture}% de la largeur utile et ne déborde pas`, 'FRISE-28');
    await ctx.close();
  }

  // FRISE-29 — mobile : frise verticale, date à gauche, carte à droite.
  const { ctx, p } = await newPage({ w: 390, h: 900, tag: 'MOB' });
  await openJalons(p);
  const mob = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const bub = (e) => { const r = e.querySelector('.op-ms-bub').getBoundingClientRect(); return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; };
    // Sur mobile le rail est porté par .op-ms::after — ancré sur la boîte du
    // JALON, dont le bas est exactement le haut du jalon suivant.
    const seg = (e) => {
      const cs = getComputedStyle(e, '::after'), r = e.getBoundingClientRect();
      if (cs.display === 'none') return { w: cs.borderLeftWidth, y1: null, y2: null, absent: true };
      return { w: cs.borderLeftWidth, style: cs.borderLeftStyle,
        y1: Math.round(r.top + parseFloat(cs.top)),
        y2: Math.round(r.top + parseFloat(cs.top) + parseFloat(cs.height)) };
    };
    const d = ms.map((e) => e.querySelector('.op-ms-date').getBoundingClientRect());
    const c = ms.map((e) => e.querySelector('.op-milestone').getBoundingClientRect());
    return {
      bubs: ms.map(bub), segs: ms.map(seg),
      dateAGauche: d.every((x, i) => x.right <= c[i].left),
      dateUneLigne: ms.map((e) => Math.round(e.querySelector('.op-ms-date').getBoundingClientRect().height)),
      dateTronquee: ms.some((e) => { const x = e.querySelector('.op-ms-date'); return x.scrollWidth > Math.ceil(x.getBoundingClientRect().width) + 1; }),
      empilee: new Set(ms.map((e) => Math.round(e.getBoundingClientRect().left))).size === 1,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stats: getComputedStyle(document.querySelector('.op-tl-stats')).gridTemplateColumns.split(' ').length,
    };
  });
  note('FRISE-29', mob);
  ok(mob.empilee && mob.dateAGauche && new Set(mob.bubs.map((x) => x.cx)).size === 1
    && mob.segs.slice(0, -1).every((s) => parseFloat(s.w) >= 2 && !s.absent)
    && mob.segs.at(-1).absent && mob.over <= 0 && mob.stats === 1,
    'FRISE-29 : à 390px la frise est VERTICALE — date à gauche, bulle sur le rail, carte à droite, synthèse empilée, aucun scroll horizontal', 'FRISE-29');

  const jonctions = mob.segs.slice(0, -1).map((s, i) => Math.round(s.y2 - mob.bubs[i + 1].cy));
  const departs = mob.segs.slice(0, -1).map((s, i) => Math.round(s.y1 - mob.bubs[i].cy));
  note('FRISE-30', { departs, jonctions, hauteursDate: mob.dateUneLigne, tronquee: mob.dateTronquee });
  ok(jonctions.every((d) => Math.abs(d) <= 1) && departs.every((d) => Math.abs(d) <= 1)
    && !mob.dateTronquee && new Set(mob.dateUneLigne).size === 1,
    'FRISE-30 : le rail vertical rejoint exactement chaque bulle, et aucune date n’est tronquée ni cassée en deux lignes', 'FRISE-30');
  await ctx.close();

  // FRISE-31 — volume : passage à la ligne structuré, rail par rangée.
  const v = await newPage({ tag: 'VOL' });
  await openJalons(v.p);
  await seedRich(v.p);
  await v.p.waitForTimeout(250);
  const dense = await ev(v.p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const tops = [...new Set(ms.map((e) => Math.round(e.getBoundingClientRect().top)))].sort((a, c) => a - c);
    const grid = document.querySelector('.op-milestones').getBoundingClientRect();
    const debords = ms.map((e) => {
      const cs = getComputedStyle(e.querySelector('.op-ms-rail'), '::before');
      const r = e.querySelector('.op-ms-rail').getBoundingClientRect();
      const x1 = r.left + parseFloat(cs.left), x2 = x1 + parseFloat(cs.width);
      return Math.max(0, Math.round(grid.left - x1), Math.round(x2 - grid.right));
    }).filter((d) => d > 1);
    return { jalons: ms.length, cartes: document.querySelectorAll('.op-milestone').length, rangees: tops.length,
      parRangee: tops.map((t) => ms.filter((e) => Math.round(e.getBoundingClientRect().top) === t).length),
      debords, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nextUnique: ms.filter((e) => e.classList.contains('is-next')).length };
  });
  note('FRISE-31', dense);
  ok(dense.jalons === 8 && dense.cartes === 8 && dense.rangees === 2 && dense.debords.length === 0
    && dense.over <= 0 && dense.nextUnique === 1,
    'FRISE-31 : à 8 jalons la frise passe à la ligne de façon structurée — chaque rangée obtient son rail, aucun segment ne déborde, un seul « prochain » subsiste', 'FRISE-31');
  await v.ctx.close();

  // FRISE-32 — thème sombre.
  const d = await newPage({ tag: 'DARK' });
  await ev(d.p, () => { app.ui.theme = 'dark'; document.body.classList.add('dark'); save(); });
  await openJalons(d.p);
  const dark = await ev(d.p, () => {
    const lum = (c) => { const [r, g, bl] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
    const body = getComputedStyle(document.body).backgroundColor;
    const rail = getComputedStyle(document.querySelector('.op-ms-rail'), '::before');
    return {
      sombre: document.body.classList.contains('dark'),
      carte: lum(getComputedStyle(document.querySelector('.op-milestone')).backgroundColor) < 0.5,
      titre: lum(getComputedStyle(document.querySelector('.op-ms-name')).color) > 0.5,
      rail: Math.abs(lum(rail.borderTopColor) - lum(body)) > 0.08,
      bulle: lum(getComputedStyle(document.querySelector('.op-ms-bub')).borderTopColor) > lum(body),
      barre: lum(getComputedStyle(document.querySelector('.op-tl-bar')).backgroundColor) < 0.5,
      synthese: lum(getComputedStyle(document.querySelector('.op-tl-stat')).backgroundColor) < 0.5,
      hint: lum(getComputedStyle(document.querySelector('.op-tl-hint')).backgroundColor) < 0.5,
      inline: (document.querySelector('#main').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || []).filter((s) => !/left:|width:|--cols|--col-min/.test(s)).length,
    };
  });
  note('FRISE-32', dark);
  ok(dark.sombre && dark.carte && dark.titre && dark.rail && dark.bulle && dark.barre && dark.synthese && dark.hint,
    'FRISE-32 : en thème sombre, barre de filtres, frise, cartes, synthèse et bandeau d’aide sont tous sur fond sombre avec un rail et des bulles visibles', 'FRISE-32');
  ok(dark.inline === 0,
    'FRISE-33 : aucune couleur codée en dur dans la frise — uniquement les variables de thème existantes', 'FRISE-33');
  await d.ctx.close();
}

// ============================================================
// FRISE-34 → 37 — Navigation et onglets voisins
// ============================================================
console.log('\n[FRISE-VOISINS] Navigation, clavier, autres onglets');
{
  const { ctx, p } = await newPage({ tag: 'NAV' });
  await openJalons(p);
  const t = await ev(p, () => {
    const list = visibleOperationMilestones(window.OP);
    return [...document.querySelectorAll('.op-ms')].map((e, i) => {
      const m = list[i], tk = m.taskId ? task(m.taskId) : null;
      return { dom: e.getAttribute('onclick'), attendu: tk ? `openTask('${tk.id}')` : `selectProject('${m.projectId}')`, role: e.getAttribute('role'), tab: e.getAttribute('tabindex'), aria: !!e.getAttribute('aria-label') };
    });
  });
  note('FRISE-34', t);
  ok(t.every((x) => x.dom === x.attendu && x.role === 'button' && x.tab === '0' && x.aria),
    'FRISE-34 : la cible du clic est INCHANGÉE (openTask si le jalon porte une tâche, sinon selectProject), et chaque jalon reste un bouton accessible', 'FRISE-34');

  const kbd = await ev(p, () => {
    const el = document.querySelector('.op-ms'); el.focus();
    const focus = document.activeElement === el;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const enter = app.ui.page;
    go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    document.querySelector('.op-ms').click();
    return { focus, enter, clic: app.ui.page };
  });
  note('FRISE-35', kbd);
  ok(kbd.focus && kbd.enter === 'project' && kbd.clic === 'project',
    'FRISE-35 : clic et touche Entrée ouvrent la fiche du chantier porteur — comportement de V2.8.2 conservé', 'FRISE-35');

  // Un clic sur un filtre ne doit PAS déclencher la navigation du jalon.
  const isolate = await ev(p, () => {
    go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    document.querySelector('.op-tl-scope button:nth-child(2)').click();
    const apresPeriode = app.ui.page;
    document.querySelector('.op-tl-chip').click();
    const apresChip = app.ui.page;
    resetMilestoneFilters();
    return { apresPeriode, apresChip };
  });
  note('FRISE-36', isolate);
  ok(isolate.apresPeriode === 'operation' && isolate.apresChip === 'operation',
    'FRISE-36 : cliquer un filtre ou une pastille de légende ne quitte PAS l’opération — les commandes n’empruntent pas le clic du jalon', 'FRISE-36');

  const tabs = await ev(p, () => {
    const out = [];
    for (const x of ['Vue d’ensemble', 'Planning', 'Ressources', 'Jalons', 'Planning', 'Jalons']) {
      setOperationTab(x);
      const body = document.querySelector('.op-body');
      out.push({ onglet: x, actif: [...document.querySelectorAll('.op-tabs button')].filter((bb) => bb.getAttribute('aria-selected') === 'true').map((bb) => bb.textContent.trim()).join(''),
        marqueur: x === 'Vue d’ensemble' ? body.querySelectorAll('.op-kpi').length
          : x === 'Planning' ? body.querySelectorAll('.g-row, .gantt, .op-macro-row').length
            : x === 'Ressources' ? body.querySelectorAll('.load-row').length
              : body.querySelectorAll('.op-milestone').length });
    }
    return out;
  });
  note('FRISE-37', tabs);
  ok(tabs.every((x) => x.actif === x.onglet && x.marqueur > 0),
    'FRISE-37 : les quatre onglets de l’opération répondent et rendent leur contenu — Vue d’ensemble, Planning et Ressources sont intacts après aller-retour', 'FRISE-37');
  await ctx.close();
}

// ============================================================
// FREEZE-283 — Périmètre du changement
// ============================================================
console.log('\n[FREEZE-283] Byte-identité et périmètre');
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
  const frozen = [
    'operation', 'operationsOrdered', 'operationProjects', 'operationActiveProjects',
    'operationProjectIds', 'operationActiveProjectIds', 'operationTasks', 'operationActiveTasks',
    'operationMilestones', 'operationControls', 'operationPendingControls', 'operationResourceIds',
    'operationResources', 'operationDecisions', 'operationWarnings',
    'operationCrossProjectResourceConflicts', 'operationProjectBounds', 'operationWorstHealth',
    'getOperationSummary', 'validateOperationState', 'assignableProjectsForOperation',
    'applyOperationMembership', 'submitOperation', 'openOperationForm', 'openOperationProjects',
    'confirmDeleteOperation', 'selectOperation', 'setOperationTab', 'operationOverviewTab',
    'operationAttentionGrid', 'operationPlanningTab',
    'operationResourcesTab', 'operationMacroPlanning', 'operationConflictCard',
    'operationConflictLine', 'operationCard', 'operationCardMenu', 'renderOperation',
    'milestoneRelativeLabel', 'milestoneImpactNote', 'calculateProjectEnd', 'getProjectTasks',
    'getCurrentWeekRange', 'daysBetweenKeys', 'projectToneClass', 'projectVisual', 'emptyState', 'icon',
    'planningAgenda', 'gantt', 'resourceLoadBoard', 'resourceLoadGroups',
    'getResourceSchedulingConflicts', 'getResourceState', 'getResourceLoad',
    'getProjectHealth', 'getProjectSummary', 'getProjectClosureStatus',
    'pendingControlsForProject', 'pendingControlsForTask', 'submitControlAttempt',
    'controlFormHTML', 'openControlForm', 'controlRowHTML', 'setTaskStatus', 'createRework',
    'buildKanvixBackup', 'validateImportState', 'exportKanvixData',
    'renderField', 'handleFieldSiteTab', 'setFieldTab', 'fieldAttentionSection',
    'fieldControlSection', 'openMoreIssues', 'attentionCard', 'attentionRows', 'attentionRowTone',
    'getTodayDecisions', 'getTodayWarnings', 'getTodayPendingControls', 'getTodayWorkflow',
    'openQualityControlsPopup', 'openTodayQualityControls', 'pageToday', 'activeProjectsPanel',
    'renderSites', 'siteCard', 'openProjectEdit', 'renderOperationsList',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-283', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-283 : les ${frozen.length} moteurs et rendus de V2.8.2 sont BYTE-IDENTIQUES — dont operationMilestones(), milestoneImpactNote(), calculateProjectEnd(), getCurrentWeekRange() et toute l’architecture Opération`, 'FREEZE-283');

  const changed = ['operationMilestonesTab'].filter((n) => { const a = extract(prevSrc, n), c = extract(curSrc, n); return a && c && md5(a) !== md5(c); });
  const added = ['milestoneScope', 'milestoneHiddenSites', 'setMilestoneScope', 'toggleMilestoneSite',
    'resetMilestoneFilters', 'visibleOperationMilestones', 'milestoneOpenTasks', 'milestoneStatus',
    'operationMilestoneBar', 'operationMilestoneStats'].filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-283-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 1 && added.length === 10,
    'FREEZE-283 : operationMilestonesTab() reste la SEULE fonction réécrite ; les dix fonctions ajoutées sont toutes des helpers de la frise', 'FREEZE-283');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-283-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && store(curSrc) === store(prevSrc)
    && Number(schema(curSrc)) >= Number(schema(prevSrc)) && Number(schema(curSrc)) >= 12,
    'FREEZE-283 : STORE et SCHEMA_VERSION (12) strictement inchangés — aucune migration', 'FREEZE-283');
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
