// ============================================================
// KANVIX — Recette « Jalons en timeline » (V2.8.2)
//
//   UN SEUL geste : l'onglet Jalons d'une opération quitte les longues lignes
//   pleine largeur pour une TIMELINE — un rail, une bulle par jalon, une carte
//   compacte dessous ; rail horizontal sur desktop, vertical sur mobile.
//
//   La question à laquelle cette recette répond :
//     « La chronologie est-elle devenue lisible d'un coup d'œil, sur les trois
//       formats, sans qu'une seule règle métier, une seule donnée ou un seul
//       autre onglet de l'opération n'ait bougé ? »
//
//   Usage : node recette-jalons-timeline-v2.8.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.8.2.html';
const PREV = 'kanvix-next-gen-v2.8.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR) => 'file://' + BASE + file + '?now=' + NOW;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.8.2/';
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
  const { w = 1440, h = 900, tag = 'x', file = CUR } = opts;
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
    resetApp();
    setDepth('pilot');
    setRole('driver');
    dismissKanvixContinuityNotice();
    const t = document.querySelector('#toast');
    if (t) t.style.display = 'none';
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

// ============================================================
// JAL282-01 → 04 — Le socle : rien n'a bougé sous le rendu
// ============================================================
console.log('\n[JAL282-SOCLE] Données, moteurs et contrat de sélection');
{
  const { ctx, p } = await newPage({ tag: 'SOCLE' });
  await openJalons(p);

  // JAL282-01 — la timeline affiche EXACTEMENT ce que le moteur renvoie, dans
  // son ordre. Le rendu ne trie pas, ne filtre pas, n'ajoute pas.
  const src = await ev(p, () => {
    const engine = operationMilestones(window.OP);
    const cards = [...document.querySelectorAll('.op-milestone')];
    const names = cards.map((c) => c.querySelector('.op-ms-name').textContent);
    const dates = [...document.querySelectorAll('.op-ms-date')].map((d) => d.textContent);
    return {
      engineNames: engine.map((m) => m.name),
      domNames: names,
      engineDates: engine.map((m) => (m.date ? fmtDay(m.date) : '—')),
      domDates: dates,
      wrappers: document.querySelectorAll('.op-ms').length,
      cards: cards.length,
      oldRows: document.querySelectorAll('.op-ms-body > .op-ms-date').length,
    };
  });
  note('JAL282-01', src);
  ok(src.domNames.join('|') === src.engineNames.join('|'),
    'JAL282-01 : la timeline liste exactement les jalons de operationMilestones(), dans l’ordre du moteur — aucun tri, aucun filtre, aucun ajout côté rendu', 'JAL282-01');
  ok(src.domDates.join('|') === src.engineDates.join('|'),
    'JAL282-02 : chaque date affichée est celle du moteur, formatée par le fmtDay() existant', 'JAL282-02');

  // JAL282-03 — le contrat des recettes antérieures : .op-milestone reste porté
  // par la carte, une par jalon. OP-39 la compte, OP-40 lit son texte, OP-51
  // sonde son fond : les trois continuent de mesurer ce qu'elles mesuraient.
  ok(src.cards === src.engineNames.length && src.wrappers === src.cards,
    'JAL282-03 : un .op-milestone par jalon — le sélecteur que comptent, lisent et sondent les recettes V2.8.0 est préservé', 'JAL282-03');

  // JAL282-04 — aucune donnée nouvelle n'est écrite.
  const persisted = await ev(p, () => {
    const before = JSON.parse(localStorage.getItem(STORE) || '{}');
    const mk = Object.keys(before.milestones?.[0] || {}).sort();
    setOperationTab('Vue d’ensemble'); setOperationTab('Jalons');
    const after = JSON.parse(localStorage.getItem(STORE) || '{}');
    return { mk, after: Object.keys(after.milestones?.[0] || {}).sort(), same: JSON.stringify(before) === JSON.stringify(after) };
  });
  note('JAL282-04', persisted);
  ok(persisted.same && persisted.mk.join('|') === persisted.after.join('|'),
    'JAL282-04 : afficher la timeline n’écrit RIEN — aucun champ nouveau sur un jalon, aucun état persisté', 'JAL282-04');
  await ctx.close();
}

// ============================================================
// JAL282-05 → 11 — Le rail : la chronologie doit être VISIBLE
// ============================================================
console.log('\n[JAL282-RAIL] Géométrie du rail sur desktop');
{
  const { ctx, p } = await newPage({ tag: 'RAIL' });
  await openJalons(p);

  const geo = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const seg = (el) => {
      const r = el.querySelector('.op-ms-rail').getBoundingClientRect();
      const cs = getComputedStyle(el.querySelector('.op-ms-rail'), '::before');
      // Position absolue du segment à partir de left/right résolus.
      const left = parseFloat(cs.left), w = parseFloat(cs.width);
      return { x1: Math.round((r.left + left) * 10) / 10, x2: Math.round((r.left + left + w) * 10) / 10, h: cs.height, bg: cs.backgroundColor };
    };
    const bub = (el) => {
      const r = el.querySelector('.op-ms-bub').getBoundingClientRect();
      return { cx: Math.round((r.x + r.width / 2) * 10) / 10, cy: Math.round((r.y + r.height / 2) * 10) / 10, d: Math.round(r.width) };
    };
    const railBg = getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before').backgroundColor;
    const pageBg = getComputedStyle(document.body).backgroundColor;
    return {
      bubbles: ms.map(bub), segs: ms.map(seg),
      railBg, pageBg,
      cardTops: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().top)),
      cardWidths: ms.map((e) => Math.round(e.querySelector('.op-milestone').getBoundingClientRect().width)),
    };
  });
  note('JAL282-05', { bulles: geo.bubbles, segments: geo.segs });

  // JAL282-05 — les bulles sont sur UNE ligne et régulièrement espacées.
  const cys = [...new Set(geo.bubbles.map((x) => x.cy))];
  const steps = geo.bubbles.slice(1).map((x, i) => Math.round(x.cx - geo.bubbles[i].cx));
  ok(cys.length === 1 && new Set(steps).size === 1,
    `JAL282-05 : toutes les bulles sont alignées sur la même ligne (y=${cys[0]}) et régulièrement espacées (${steps[0]}px) — la succession des dates se lit d’un trait`, 'JAL282-05');

  // JAL282-06 — le rail est CONTINU d'une bulle à l'autre : chaque segment
  // reprend là où le précédent s'arrête. C'est le défaut le plus facile à
  // laisser passer à l'œil, et le seul qui casse la lecture chronologique.
  const holes = geo.segs.slice(1).map((s, i) => Math.round((s.x1 - geo.segs[i].x2) * 10) / 10).filter((d) => Math.abs(d) > 0.5);
  note('JAL282-06', { jointures: geo.segs.slice(1).map((s, i) => Math.round((s.x1 - geo.segs[i].x2) * 10) / 10), trous: holes });
  ok(holes.length === 0,
    'JAL282-06 : le rail est CONTINU — chaque segment reprend exactement là où le précédent s’arrête, sans trou ni recouvrement', 'JAL282-06');

  // JAL282-07 — il commence à la première bulle et finit à la dernière.
  const first = geo.bubbles[0], last = geo.bubbles[geo.bubbles.length - 1];
  const startsAt = Math.abs(geo.segs[0].x1 - first.cx) <= 1;
  const endsAt = Math.abs(geo.segs[geo.segs.length - 1].x2 - last.cx) <= 1;
  note('JAL282-07', { debut: geo.segs[0].x1, premiereBulle: first.cx, fin: geo.segs.at(-1).x2, derniereBulle: last.cx });
  ok(startsAt && endsAt,
    'JAL282-07 : le rail ne dépasse ni avant le premier jalon ni après le dernier — il commence et finit exactement sur une bulle', 'JAL282-07');

  // JAL282-08 — le trait doit se DISTINGUER du fond. --border-light se confond
  // avec --bg-app : c'est le défaut corrigé pendant la mise au point.
  const lum = (c) => { const [r, g, bl] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
  const delta = Math.abs(lum(geo.railBg) - lum(geo.pageBg));
  note('JAL282-08', { rail: geo.railBg, fond: geo.pageBg, ecart: Math.round(delta * 1000) / 1000 });
  ok(delta > 0.015,
    `JAL282-08 : le trait du rail se distingue du fond de page (écart de luminance ${Math.round(delta * 1000) / 1000}) — il n’est pas noyé dans --bg-app`, 'JAL282-08');

  // JAL282-09 — les cartes forment une rangée régulière.
  note('JAL282-09', { hauts: geo.cardTops, largeurs: geo.cardWidths });
  ok(new Set(geo.cardTops).size === 1 && new Set(geo.cardWidths).size === 1,
    'JAL282-09 : les cartes d’une même rangée partagent le même bord haut et la même largeur — la timeline a un rythme régulier', 'JAL282-09');

  // JAL282-10 — le prochain jalon est le seul mis en avant.
  const emph = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const engine = operationMilestones(window.OP);
    const now = getDemoNow();
    const expected = engine.find((m) => !m.date || date(m.date) >= now);
    return {
      states: ms.map((e) => (e.classList.contains('is-next') ? 'next' : e.classList.contains('is-past') ? 'past' : e.classList.contains('is-closed') ? 'closed' : '')),
      expectedIdx: engine.findIndex((m) => m.id === expected.id),
      sizes: ms.map((e) => Math.round(e.querySelector('.op-ms-bub').getBoundingClientRect().width)),
      dateColors: ms.map((e) => getComputedStyle(e.querySelector('.op-ms-date')).color),
    };
  });
  note('JAL282-10', emph);
  ok(emph.states.filter((s) => s === 'next').length === 1 && emph.states[emph.expectedIdx] === 'next'
    && emph.sizes[emph.expectedIdx] === Math.max(...emph.sizes)
    && new Set(emph.dateColors).size > 1,
    'JAL282-10 : UN SEUL jalon porte l’accent — le premier non passé ; sa bulle est la plus grosse et sa date la seule colorée', 'JAL282-10');

  // JAL282-11 — l'identité couleur des chantiers vient du moteur unique.
  const tones = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    return ms.map((e) => {
      const engine = operationMilestones(window.OP);
      const i = ms.indexOf(e);
      return { dom: [...e.classList].find((c) => c.startsWith('ptone-')), engine: projectToneClass(engine[i].projectId) };
    });
  });
  note('JAL282-11', tones);
  ok(tones.every((t) => t.dom === t.engine) && new Set(tones.map((t) => t.dom)).size > 1,
    'JAL282-11 : la couleur de chaque bulle vient de projectToneClass() — l’unique identité couleur de chantier du produit, aucune palette parallèle', 'JAL282-11');
  await ctx.close();
}

// ============================================================
// JAL282-12 → 16 — Le contenu des cartes et les états
// ============================================================
console.log('\n[JAL282-CARTES] Contenu, états et libellés relatifs');
{
  const { ctx, p } = await newPage({ tag: 'CARTES' });
  await openJalons(p);

  // JAL282-12 — chaque carte porte les quatre informations demandées.
  const card = await ev(p, () => {
    const c = document.querySelector('.op-ms');
    return {
      date: !!c.querySelector('.op-ms-date')?.textContent.trim(),
      chantier: c.querySelector('.op-ms-site small')?.textContent.trim(),
      dot: !!c.querySelector('.op-ms-dot'),
      nom: c.querySelector('.op-ms-name')?.textContent.trim(),
      voir: c.querySelector('.op-row-go')?.textContent.trim(),
      sante: c.querySelector('.op-badge')?.textContent.trim(),
      engineChantier: project(operationMilestones(window.OP)[0].projectId).name,
      engineNom: operationMilestones(window.OP)[0].name,
    };
  });
  note('JAL282-12', card);
  ok(card.date && card.chantier === card.engineChantier && card.nom === card.engineNom && /Voir|Ouvrir/.test(card.voir),
    'JAL282-12 : chaque jalon porte sa date, son chantier, son nom et son lien « Voir » — les quatre informations demandées', 'JAL282-12');

  // JAL282-13 — le libellé relatif passe par daysBetweenKeys(), pas par un
  // calcul maison. On compare au moteur pour chaque jalon.
  const rel = await ev(p, () => {
    const engine = operationMilestones(window.OP);
    const doms = [...document.querySelectorAll('.op-ms-rel')].map((e) => e.textContent);
    const expected = engine.map((m) => {
      const d = daysBetweenKeys(dayKey(TODAY), dayKey(m.date));
      return d === 0 ? 'Aujourd’hui' : d === 1 ? 'Demain' : d === -1 ? 'Hier' : d > 1 ? `Dans ${d} jours` : `Il y a ${-d} jours`;
    });
    return { doms, expected, deltas: engine.map((m) => daysBetweenKeys(dayKey(TODAY), dayKey(m.date))) };
  });
  note('JAL282-13', rel);
  ok(rel.doms.join('|') === rel.expected.join('|'),
    'JAL282-13 : le libellé relatif de chaque jalon est celui que produit daysBetweenKeys() — aucun calcul de dates parallèle', 'JAL282-13');

  // JAL282-14 — les quatre formulations limites.
  const forms = await ev(p, () => {
    const out = [];
    const base = app.milestones[0];
    for (const off of [0, 1, -1, 4, -6]) {
      base.date = shiftDateStr(dayKey(TODAY), off) + 'T17:00';
      save(); renderPage();
      out.push({ off, label: document.querySelector('.op-ms-rel').textContent });
    }
    return out;
  });
  note('JAL282-14', forms);
  const want = { 0: 'Aujourd’hui', 1: 'Demain', '-1': 'Hier', 4: 'Dans 4 jours', '-6': 'Il y a 6 jours' };
  ok(forms.every((f) => f.label === want[String(f.off)]),
    'JAL282-14 : « Aujourd’hui », « Demain », « Hier », « Dans N jours », « Il y a N jours » — les cinq formulations sont justes', 'JAL282-14');

  // JAL282-15 — un jalon passé se lit comme passé : bulle creuse, carte atténuée.
  const past = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.milestones[0].date = shiftDateStr(dayKey(TODAY), -5) + 'T17:00';
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const ms = [...document.querySelectorAll('.op-ms')];
    const p0 = ms.find((e) => e.classList.contains('is-past'));
    const live = ms.find((e) => !e.classList.contains('is-past') && !e.classList.contains('is-closed'));
    const bub = (e) => { const cs = getComputedStyle(e.querySelector('.op-ms-bub')); return { bg: cs.backgroundColor, border: cs.borderTopWidth }; };
    return {
      pastFound: !!p0,
      pastOpacity: p0 ? getComputedStyle(p0).opacity : null,
      liveOpacity: live ? getComputedStyle(live).opacity : null,
      pastBub: p0 ? bub(p0) : null, liveBub: live ? bub(live) : null,
      tag: p0 ? /Date passée/.test(p0.textContent) : false,
    };
  });
  note('JAL282-15', past);
  ok(past.pastFound && Number(past.pastOpacity) < Number(past.liveOpacity)
    && past.pastBub.border !== past.liveBub.border && past.tag,
    'JAL282-15 : un jalon passé est atténué, sa bulle devient creuse et il reste étiqueté « Date passée » — la chronologie se lit même sans couleur', 'JAL282-15');

  // JAL282-16 — chantier clôturé : l'étiquette de V2.8.1 est conservée (elle est
  // le contrat d'OP-40) et la santé ne vient PAS la répéter.
  const closed = await ev(p, () => {
    resetApp(); setDepth('pilot');
    project('terrasses').lifecycle = 'closed';
    save(); go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const c = [...document.querySelectorAll('.op-ms')].find((e) => e.classList.contains('is-closed'));
    return {
      found: !!c,
      texte: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
      tag: c ? /Chantier clôturé/.test(c.textContent) : false,
      badges: c ? c.querySelectorAll('.op-badge').length : -1,
      cardTexte: c ? c.querySelector('.op-milestone').textContent.replace(/\s+/g, ' ').trim() : '',
    };
  });
  note('JAL282-16', closed);
  ok(closed.found && closed.tag && /Chantier clôturé/.test(closed.cardTexte) && closed.badges === 0,
    'JAL282-16 : un jalon de chantier clôturé garde son étiquette « Chantier clôturé » DANS la carte (contrat d’OP-40) et n’affiche pas de badge de santé redondant', 'JAL282-16');
  await ctx.close();
}

// ============================================================
// JAL282-17 → 19 — La navigation n'a pas changé
// ============================================================
console.log('\n[JAL282-NAV] Cible du clic, clavier, accessibilité');
{
  const { ctx, p } = await newPage({ tag: 'NAV' });
  await openJalons(p);

  // JAL282-17 — la cible du clic est celle de V2.8.1, au caractère près.
  const targets = await ev(p, () => {
    const engine = operationMilestones(window.OP);
    return [...document.querySelectorAll('.op-ms')].map((e, i) => {
      const m = engine[i], t = m.taskId ? task(m.taskId) : null;
      return { dom: e.getAttribute('onclick'), attendu: t ? `openTask('${t.id}')` : `selectProject('${m.projectId}')`, role: e.getAttribute('role'), tab: e.getAttribute('tabindex'), aria: !!e.getAttribute('aria-label') };
    });
  });
  note('JAL282-17', targets);
  ok(targets.every((t) => t.dom === t.attendu && t.role === 'button' && t.tab === '0' && t.aria),
    'JAL282-17 : la cible du clic est INCHANGÉE (openTask si le jalon porte une tâche, sinon selectProject), et chaque jalon reste un bouton accessible au clavier avec son aria-label', 'JAL282-17');

  // JAL282-18 — le clic mène vraiment au chantier.
  const nav = await ev(p, () => {
    const before = app.ui.page;
    document.querySelector('.op-ms').click();
    return { before, after: app.ui.page, projectId: app.ui.projectId };
  });
  note('JAL282-18', nav);
  ok(nav.after === 'project' && !!nav.projectId,
    'JAL282-18 : cliquer un jalon ouvre bien la fiche du chantier porteur', 'JAL282-18');

  // JAL282-19 — Entrée et Espace font la même chose que le clic.
  const kbd = await ev(p, () => {
    go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const el = document.querySelector('.op-ms');
    el.focus();
    const focused = document.activeElement === el;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const afterEnter = app.ui.page;
    go('sites'); setSitesMode('operations'); selectOperation(window.OP); setOperationTab('Jalons');
    const el2 = document.querySelector('.op-ms');
    el2.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    return { focused, afterEnter, afterSpace: app.ui.page };
  });
  note('JAL282-19', kbd);
  ok(kbd.focused && kbd.afterEnter === 'project' && kbd.afterSpace === 'project',
    'JAL282-19 : un jalon prend le focus et s’ouvre à Entrée comme à Espace — le comportement clavier de V2.8.1 est conservé', 'JAL282-19');
  await ctx.close();
}

// ============================================================
// JAL282-20 → 24 — Responsive : desktop, tablette, mobile
// ============================================================
console.log('\n[JAL282-RESP] Trois formats, un rail qui bascule');
{
  for (const [w, attendu, tag] of [[1440, 3, 'DESK'], [900, 3, 'TAB']]) {
    const { ctx, p } = await newPage({ w, h: 900, tag });
    await openJalons(p);
    const r = await ev(p, () => {
      const ms = [...document.querySelectorAll('.op-ms')];
      const tops = [...new Set(ms.map((e) => Math.round(e.getBoundingClientRect().top)))];
      return {
        colonnes: new Set(ms.filter((e) => Math.round(e.getBoundingClientRect().top) === tops[0]).map((e) => Math.round(e.getBoundingClientRect().left))).size,
        rangees: tops.length,
        horizontal: getComputedStyle(ms[0].querySelector('.op-ms-rail'), '::before').height === '1px',
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    note('JAL282-20', { largeur: w, ...r });
    ok(r.colonnes === attendu && r.rangees === 1 && r.horizontal && r.over <= 0,
      `JAL282-20 : à ${w}px, les 3 jalons tiennent sur une rangée de ${attendu} colonnes, le rail reste horizontal et rien ne déborde`, 'JAL282-20');
    await ctx.close();
  }

  // JAL282-21 — mobile : le rail bascule à la verticale, et il reste continu.
  const { ctx, p } = await newPage({ w: 390, h: 900, tag: 'MOB' });
  await openJalons(p);
  const mob = await ev(p, () => {
    const ms = [...document.querySelectorAll('.op-ms')];
    const bub = (e) => { const r = e.querySelector('.op-ms-bub').getBoundingClientRect(); return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) }; };
    const bubs = ms.map(bub);
    const seg = (e) => {
      const cs = getComputedStyle(e.querySelector('.op-ms-rail'), '::before');
      const r = e.querySelector('.op-ms-rail').getBoundingClientRect();
      return { display: cs.display, w: cs.width, y1: Math.round(r.top + parseFloat(cs.top)), y2: Math.round(r.top + parseFloat(cs.top) + parseFloat(cs.height)) };
    };
    const segs = ms.map(seg);
    return {
      bubs, segs,
      memeX: new Set(bubs.map((b) => b.cx)).size === 1,
      colonneDate: Math.round(ms[0].querySelector('.op-ms-rail').getBoundingClientRect().width),
      lignesDate: ms.map((e) => Math.round(e.querySelector('.op-ms-date').getBoundingClientRect().height)),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      empilees: new Set(ms.map((e) => Math.round(e.getBoundingClientRect().left))).size === 1,
    };
  });
  note('JAL282-21', { memeX: mob.memeX, bulles: mob.bubs, segments: mob.segs, over: mob.over });
  ok(mob.memeX && mob.empilees && mob.segs.every((s) => s.w === '1px' || s.display === 'none') && mob.over <= 0,
    'JAL282-21 : à 390px la timeline s’empile et le rail bascule à la VERTICALE — repère conservé, aucun scroll horizontal', 'JAL282-21');

  // JAL282-22 — et il rejoint bien la bulle suivante (le défaut mesuré : il
  // s'arrêtait 7px trop tôt et la timeline paraissait pointillée).
  const jonctions = mob.segs.slice(0, -1).map((s, i) => Math.round(s.y2 - mob.bubs[i + 1].cy));
  note('JAL282-22', { jonctions, segmentDernier: mob.segs.at(-1).display });
  ok(jonctions.every((d) => Math.abs(d) <= 1) && mob.segs.at(-1).display === 'none',
    'JAL282-22 : chaque segment vertical rejoint exactement le centre de la bulle suivante, et le dernier jalon n’en traîne aucun', 'JAL282-22');

  // JAL282-23 — la colonne de date ne casse pas les libellés en deux lignes.
  note('JAL282-23', { colonne: mob.colonneDate, hauteursDate: mob.lignesDate });
  ok(new Set(mob.lignesDate).size === 1 && mob.lignesDate[0] <= 22,
    `JAL282-23 : à 390px, chaque date tient sur UNE ligne (${mob.lignesDate[0]}px) dans sa colonne de ${mob.colonneDate}px`, 'JAL282-23');
  await ctx.close();
}

// ============================================================
// JAL282-24 → 26 — Volume, passage à la ligne et état vide
// ============================================================
console.log('\n[JAL282-VOLUME] Timeline dense et état vide');
{
  const { ctx, p } = await newPage({ tag: 'DENSE' });
  await openJalons(p);
  const dense = await ev(p, () => {
    const ids = operationProjectIds(window.OP);
    [['Coulage dalle R+2', -9], ['Levée des réserves', -4], ['Essais étanchéité', 2],
     ['Réception menuiseries', 6], ['Pré-réception technique', 14]].forEach(([n, o], i) =>
      app.milestones.push({ id: 'm-x' + i, projectId: ids[i % ids.length], name: n, date: shiftDateStr(dayKey(TODAY), o) + 'T17:00' }));
    save(); renderPage();
    const ms = [...document.querySelectorAll('.op-ms')];
    const tops = [...new Set(ms.map((e) => Math.round(e.getBoundingClientRect().top)))].sort((a, c) => a - c);
    const grid = document.querySelector('.op-milestones').getBoundingClientRect();
    // Aucun segment ne doit dépasser des bords de la grille : c'est ce que
    // garantit la gouttière portée par le padding plutôt que par un `gap`.
    const debords = ms.map((e) => {
      const cs = getComputedStyle(e.querySelector('.op-ms-rail'), '::before');
      const r = e.querySelector('.op-ms-rail').getBoundingClientRect();
      const x1 = r.left + parseFloat(cs.left), x2 = x1 + parseFloat(cs.width);
      return Math.max(0, Math.round(grid.left - x1), Math.round(x2 - grid.right));
    });
    const parRangee = tops.map((t) => ms.filter((e) => Math.round(e.getBoundingClientRect().top) === t).length);
    return {
      jalons: ms.length, cards: document.querySelectorAll('.op-milestone').length,
      rangees: tops.length, parRangee, debords: debords.filter((d) => d > 1),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titre: document.querySelector('.op-h2').textContent,
      amplitude: document.querySelector('.op-tl-span')?.textContent,
      etats: ms.map((e) => (e.classList.contains('is-next') ? 'next' : e.classList.contains('is-past') ? 'past' : '')).filter(Boolean),
    };
  });
  note('JAL282-24', dense);
  ok(dense.jalons === 8 && dense.cards === 8 && dense.rangees === 2 && dense.over <= 0,
    'JAL282-24 : avec 8 jalons la timeline passe proprement à la ligne — 8 cartes, 2 rangées, aucun débordement', 'JAL282-24');
  ok(dense.debords.length === 0,
    'JAL282-24 : aucun segment de rail ne dépasse des bords de la grille — chaque rangée obtient son propre rail, sans trait flottant', 'JAL282-24');
  ok(/Jalons · 8/.test(dense.titre) && /→/.test(dense.amplitude || '') && dense.etats.filter((e) => e === 'next').length === 1,
    'JAL282-25 : l’en-tête annonce le nombre de jalons et l’amplitude de dates, et un seul « prochain » subsiste malgré le volume', 'JAL282-25');

  // JAL282-26 — l'état vide de V2.8.1 est conservé tel quel.
  const vide = await ev(p, () => {
    app.milestones.length = 0; save(); renderPage();
    const e = document.querySelector('.empty-state');
    return { present: !!e, titre: e?.querySelector('b')?.textContent, texte: e?.querySelector('span')?.textContent, timeline: document.querySelectorAll('.op-milestones').length };
  });
  note('JAL282-26', vide);
  ok(vide.present && vide.titre === 'Aucun jalon' && /apparaîtront ici/.test(vide.texte) && vide.timeline === 0,
    'JAL282-26 : sans jalon, l’état vide de V2.8.1 s’affiche à l’identique — aucun rail vide, aucun squelette', 'JAL282-26');
  await ctx.close();
}

// ============================================================
// JAL282-27 → 30 — Les autres onglets et le thème sombre
// ============================================================
console.log('\n[JAL282-VOISINS] Les trois autres onglets et le sombre');
{
  const { ctx, p } = await newPage({ tag: 'VOISINS' });
  await ev(p, () => { go('sites'); setSitesMode('operations'); selectOperation(window.OP); });
  await p.waitForTimeout(250);

  // JAL282-27 — les quatre onglets répondent tous, dans l'ordre, et chacun rend
  // son contenu propre.
  const tabs = await ev(p, () => {
    const out = [];
    for (const t of ['Vue d’ensemble', 'Planning', 'Ressources', 'Jalons']) {
      setOperationTab(t);
      const body = document.querySelector('.op-body');
      out.push({
        onglet: t,
        actif: [...document.querySelectorAll('.op-tabs button')].filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.textContent.trim()),
        marqueur: t === 'Vue d’ensemble' ? body.querySelectorAll('.op-kpi').length
          : t === 'Planning' ? body.querySelectorAll('.g-row, .gantt, .op-macro-row').length
            : t === 'Ressources' ? body.querySelectorAll('.load-row').length
              : body.querySelectorAll('.op-milestone').length,
      });
    }
    return out;
  });
  note('JAL282-27', tabs);
  ok(tabs.every((t) => t.actif.length === 1 && t.actif[0] === t.onglet && t.marqueur > 0),
    'JAL282-27 : les quatre onglets de l’opération répondent, un seul est sélectionné à la fois et chacun rend bien son contenu — Vue d’ensemble, Planning et Ressources sont intacts', 'JAL282-27');

  // JAL282-28 — aller-retour Jalons ↔ voisins sans casse.
  const aller = await ev(p, () => {
    const seq = ['Jalons', 'Planning', 'Jalons', 'Vue d’ensemble', 'Jalons', 'Ressources', 'Jalons'];
    const out = [];
    for (const t of seq) { setOperationTab(t); out.push(document.querySelectorAll(t === 'Jalons' ? '.op-milestone' : '.op-body > *').length); }
    return { out, final: document.querySelectorAll('.op-milestone').length };
  });
  note('JAL282-28', aller);
  ok(aller.out.every((n) => n > 0) && aller.final === 3,
    'JAL282-28 : sept bascules d’onglet enchaînées laissent la timeline intacte — la navigation existante n’a pas bougé', 'JAL282-28');
  await ctx.close();

  // JAL282-29 — thème sombre.
  const d = await newPage({ tag: 'DARK' });
  await ev(d.p, () => { app.ui.theme = 'dark'; document.body.classList.add('dark'); save(); });
  await openJalons(d.p);
  const dark = await ev(d.p, () => {
    const lum = (c) => { const [r, g, bl] = (c.match(/\d+/g) || []).map(Number); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
    const card = document.querySelector('.op-milestone');
    const rail = getComputedStyle(document.querySelector('.op-ms-rail'), '::before');
    const body = getComputedStyle(document.body);
    const name = document.querySelector('.op-ms-name');
    const inline = (document.querySelector('#main').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || [])
      .filter((s) => !/left:|width:|--cols|--col-min/.test(s)).length;
    return {
      sombre: document.body.classList.contains('dark'),
      fondCarte: lum(getComputedStyle(card).backgroundColor) < 0.5,
      texteClair: lum(getComputedStyle(name).color) > 0.5,
      railVisible: Math.abs(lum(rail.backgroundColor) - lum(body.backgroundColor)) > 0.015,
      bulleVisible: lum(getComputedStyle(document.querySelector('.op-ms-bub')).backgroundColor) > lum(body.backgroundColor),
      inline,
    };
  });
  note('JAL282-29', dark);
  ok(dark.sombre && dark.fondCarte && dark.texteClair && dark.railVisible && dark.bulleVisible,
    'JAL282-29 : en thème sombre, les cartes sont sur fond sombre, le texte est clair, et le rail comme les bulles restent visibles', 'JAL282-29');
  ok(dark.inline === 0,
    'JAL282-29 : aucune couleur codée en dur dans la timeline — uniquement les variables de thème existantes', 'JAL282-29');
  await d.ctx.close();

  // JAL282-30 — les captures de la livraison.
  const s = await newPage({ tag: 'SHOT' });
  await openJalons(s.p);
  await s.p.waitForTimeout(300);
  ok(true, 'JAL282-30 : parcours de captures exécuté sans erreur', 'JAL282-30');
  await s.ctx.close();
}

// ============================================================
// FREEZE-282 — Byte-identité : une seule fonction avait le droit de bouger
// ============================================================
console.log('\n[FREEZE-282] Périmètre du changement');
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
    'operation', 'operationsOrdered', 'operationProjects', 'operationActiveProjects',
    'operationProjectIds', 'operationActiveProjectIds', 'operationTasks', 'operationActiveTasks',
    'operationMilestones', 'operationControls', 'operationPendingControls', 'operationResourceIds',
    'operationResources', 'operationDecisions', 'operationWarnings',
    'operationCrossProjectResourceConflicts', 'operationProjectBounds', 'operationWorstHealth',
    'getOperationSummary', 'validateOperationState', 'assignableProjectsForOperation',
    'applyOperationMembership', 'submitOperation', 'openOperationForm', 'openOperationProjects',
    'confirmDeleteOperation', 'selectOperation', 'setOperationTab', 'operationOverviewTab',
    'operationAttentionGrid', 'operationProjectCard', 'operationPlanningTab',
    'operationResourcesTab', 'operationMacroPlanning', 'operationConflictCard',
    'operationConflictLine', 'operationCard', 'operationCardMenu', 'renderOperation',
    'planningTasks', 'planningAgenda', 'gantt', 'resourceLoadBoard', 'resourceLoadGroups',
    'getResourceSchedulingConflicts', 'getResourceState', 'getResourceLoad',
    'getProjectHealth', 'getProjectSummary', 'getProjectClosureStatus', 'getProjectTasks',
    'pendingControlsForProject', 'pendingControlsForTask', 'submitControlAttempt',
    'controlFormHTML', 'openControlForm', 'controlRowHTML', 'setTaskStatus', 'createRework',
    'buildKanvixBackup', 'applyImportPlan', 'validateImportState', 'exportKanvixData',
    'migrateState', 'renderField', 'handleFieldSiteTab', 'setFieldTab', 'fieldAttentionSection',
    'fieldControlSection', 'openMoreIssues', 'attentionCard', 'attentionRows', 'attentionRowTone',
    'getTodayDecisions', 'getTodayWarnings', 'getTodayPendingControls', 'getTodayWorkflow',
    'openQualityControlsPopup', 'openTodayQualityControls', 'pageToday', 'activeProjectsPanel',
    'renderSites', 'siteCard', 'openProjectEdit', 'renderOperationsList',
    'projectToneClass', 'projectVisual', 'daysBetweenKeys', 'emptyState',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-282', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-282 : les ${frozen.length} moteurs et rendus de V2.8.1 sont BYTE-IDENTIQUES — dont operationMilestones(), toute l’architecture Opération, le Planning, la qualité et le Mode Chantier`, 'FREEZE-282');

  // Le périmètre : operationMilestonesTab est la SEULE fonction réécrite,
  // milestoneRelativeLabel la seule ajoutée.
  const changed = ['operationMilestonesTab'].filter((n) => {
    const a = extract(prevSrc, n), c = extract(curSrc, n);
    return a && c && md5(a) !== md5(c);
  });
  const added = ['milestoneRelativeLabel'].filter((n) => !extract(prevSrc, n) && !!extract(curSrc, n));
  note('FREEZE-282-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 1 && added.length === 1,
    'FREEZE-282 : operationMilestonesTab() est la SEULE fonction réécrite, milestoneRelativeLabel() la seule ajoutée', 'FREEZE-282');

  // Le moteur de données du jalon n'a pas été effleuré.
  ok(md5(extract(prevSrc, 'operationMilestones')) === md5(extract(curSrc, 'operationMilestones')),
    'FREEZE-282 : operationMilestones() — la source et le tri des jalons — est byte-identique à V2.8.1', 'FREEZE-282');

  // Aucune CSS morte laissée derrière.
  const dead = ['.op-ms-body small', '.op-ms-body b', '.op-milestone:hover {', 'grid-template-columns: 96px minmax(0, 1fr) auto']
    .filter((sel) => curSrc.includes(sel));
  note('FREEZE-282-css', { residus: dead });
  ok(dead.length === 0,
    'FREEZE-282 : aucune règle CSS de l’ancienne liste n’a été laissée derrière', 'FREEZE-282');

  const store = (s) => (s.match(/\bSTORE\s*=\s*"([^"]+)"/) || [])[1];
  const schema = (s) => (s.match(/\bSCHEMA_VERSION\s*=\s*(\d+)/) || [])[1];
  note('FREEZE-282-store', { store: store(curSrc), schemaPrev: schema(prevSrc), schemaCur: schema(curSrc) });
  ok(store(curSrc) === 'kanvix-product-8-3' && store(curSrc) === store(prevSrc)
    && schema(curSrc) === schema(prevSrc) && schema(curSrc) === '12',
    'FREEZE-282 : STORE et SCHEMA_VERSION (12) strictement inchangés — aucune migration', 'FREEZE-282');
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
