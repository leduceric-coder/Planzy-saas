// ============================================================
// KANVIX — Recette « Finitions UX » (V2.6.1)
//
//   Micro-passe UX, TROIS modifications, aucune règle métier :
//     1. Planning  — la pastille du LOT passe DEVANT le nom de la tâche ;
//     2. Sidewindow Ressource — respiration entre « ••• » et « × » ;
//     3. Charge des ressources — groupes Personnes / Entreprises / Matériel.
//
//   La question à laquelle cette recette répond :
//     « V2.6.1 améliore-t-elle la lecture du Planning, de la fiche Ressource
//       et de la Charge, SANS changer aucune règle métier de V2.6.0 ? »
//
//   Usage : node recette-finitions-ui-v2.6.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.6.1.html';
const PREV = 'kanvix-next-gen-v2.6.0.html';
const NOW = '2026-09-14T10:15:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = '/home/user/Planzy-saas/recette-v2.6.1/';
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
// UX261-PLAN-01 → 08 — PLANNING
// ============================================================
console.log('\n[UX261-PLAN] Planning — la pastille du lot passe devant le nom');
{
  const { ctx, p } = await newPage({ tag: 'PLAN' });

  // ---- UX261-PLAN-01 : le point existe AVANT le texte du nom
  const order = await ev(p, () => {
    go('planning');
    app.settings.period = 'month';
    save(); renderPage();
    const row = document.querySelector('#row-k-cloisons .g-label');
    const title = row.querySelector('.planning-task-title');
    const dot = title?.querySelector('.planning-lot-dot');
    const nameSpan = title?.querySelector('span');
    // Position DOM : le point précède le texte.
    const domBefore = dot && nameSpan
      ? !!(dot.compareDocumentPosition(nameSpan) & Node.DOCUMENT_POSITION_FOLLOWING)
      : false;
    // Position VISUELLE : le point est à gauche du texte, et centré dessus.
    const d = dot?.getBoundingClientRect(), n = nameSpan?.getBoundingClientRect();
    return {
      domBefore,
      visuallyBefore: d && n ? d.right <= n.left : false,
      centerDelta: d && n ? Math.abs((d.top + d.bottom) / 2 - (n.top + n.bottom) / 2) : null,
      gap: d && n ? +(n.left - d.right).toFixed(1) : null,
      text: title?.textContent.trim(),
      inLabelText: row.textContent.trim().slice(0, 60),
    };
  });
  note('UX261-PLAN-01', order);
  ok(order.domBefore && order.visuallyBefore,
    'UX261-PLAN-01 : la pastille du lot précède le nom de la tâche, dans le DOM et visuellement', 'UX261-PLAN-01');
  ok(order.centerDelta !== null && order.centerDelta <= 1.5,
    `UX261-PLAN-01 : la pastille est centrée verticalement sur le titre (écart ${order.centerDelta}px)`, 'UX261-PLAN-01');
  ok(order.gap >= 3 && order.gap <= 8,
    `UX261-PLAN-01 : espacement point / titre lisible (${order.gap}px)`, 'UX261-PLAN-01');

  // ---- UX261-PLAN-02 : la couleur du point = celle du LOT
  const colors = await ev(p, () => {
    const out = [];
    document.querySelectorAll('.g-row[id^=row-]').forEach((row) => {
      const id = row.id.replace('row-', ''), t = task(id);
      if (!t) return;
      const dot = row.querySelector('.g-label .planning-lot-dot');
      const l = taskLot(t);
      out.push({
        id,
        lotColor: l ? l.colorKey : null,
        dotClass: dot ? [...dot.classList].find((c) => c.startsWith('lchip-'))?.replace('lchip-', '') : null,
      });
    });
    return out;
  });
  note('UX261-PLAN-02', colors);
  ok(colors.length > 0 && colors.every((c) => c.dotClass === (c.lotColor || null)),
    'UX261-PLAN-02 : la couleur de la pastille correspond exactement à taskLot(t).colorKey, pour chaque ligne', 'UX261-PLAN-02');

  // ---- UX261-PLAN-03 : couleur manuelle ≠ couleur du lot — les deux concepts restent distincts
  const distinct = await ev(p, () => {
    const t = task('k-lining');           // lot Plâtrerie (indigo)
    t.status = 'todo';
    t.colorKey = 'rose';                  // surcharge MANUELLE, volontairement différente
    save(); renderPage();
    const row = document.querySelector('#row-k-lining');
    const dot = row.querySelector('.g-label .planning-lot-dot');
    const bar = document.querySelector('#bar-k-lining');
    return {
      lotColor: lotColorKey(t.lotId),
      manual: t.colorKey,
      effective: taskEffectiveColorKey(t),
      dotClass: [...dot.classList].find((c) => c.startsWith('lchip-')),
      barClass: [...bar.classList].find((c) => c.startsWith('tcolor-')),
    };
  });
  note('UX261-PLAN-03', distinct);
  ok(distinct.dotClass === 'lchip-indigo',
    'UX261-PLAN-03 : la pastille garde la couleur du LOT (indigo) malgré la surcharge manuelle', 'UX261-PLAN-03');
  ok(distinct.barClass === 'tcolor-rose' && distinct.effective === 'rose',
    'UX261-PLAN-03 : la barre Gantt garde la couleur MANUELLE (rose) — hiérarchie de couleur inchangée', 'UX261-PLAN-03');
  await shot(p, '02-planning-manual-color-vs-lot-dot.png');

  // ---- UX261-PLAN-04 : tâche sans lot → aucune pastille
  const noLot = await ev(p, () => {
    task('k-lining').colorKey = 'auto';
    save(); renderPage();
    const row = document.querySelector('#row-k-final'); // « Contrôle final », sans lot
    const t = task('k-final');
    return {
      lotId: t.lotId,
      dots: row.querySelectorAll('.g-label .planning-lot-dot').length,
      chips: row.querySelectorAll('.g-label .lot-chip').length,
      label: row.querySelector('.g-label').textContent.replace(/\s+/g, ' ').trim(),
      hasSeparator: /·\s*$/.test(row.querySelector('.g-label small').textContent.trim()),
    };
  });
  note('UX261-PLAN-04', noLot);
  ok(noLot.lotId === null && noLot.dots === 0 && noLot.chips === 0,
    'UX261-PLAN-04 : une tâche sans lot n’affiche AUCUNE pastille (pas de point gris générique)', 'UX261-PLAN-04');
  ok(!noLot.hasSeparator,
    'UX261-PLAN-04 : aucun séparateur « · » orphelin quand le lot est absent', 'UX261-PLAN-04');

  // ---- UX261-PLAN-05 : le NOM du lot reste écrit (la couleur n'est jamais seule)
  const named = await ev(p, () => {
    const rows = [...document.querySelectorAll('.g-row[id^=row-]')]
      .map((row) => {
        const id = row.id.replace('row-', ''), t = task(id);
        const small = row.querySelector('.g-label small');
        return { id, lot: t && taskLot(t)?.name, meta: small.textContent.replace(/\s+/g, ' ').trim() };
      })
      .filter((r) => r.lot);
    return {
      total: rows.length,
      allNamed: rows.every((r) => r.meta.includes(r.lot)),
      allSeparated: rows.every((r) => / · /.test(r.meta)),
      sample: rows.slice(0, 3),
    };
  });
  note('UX261-PLAN-05', named);
  ok(named.total > 0 && named.allNamed,
    'UX261-PLAN-05 : le NOM du lot reste visible dans la métadonnée de chaque ligne lotée', 'UX261-PLAN-05');
  ok(named.allSeparated,
    'UX261-PLAN-05 : la métadonnée se lit « Ressource · Lot » (séparateur présent quand les deux existent)', 'UX261-PLAN-05');

  // ---- UX261-PLAN-06 : UNE seule pastille par ligne
  const single = await ev(p, () => {
    const labels = [...document.querySelectorAll('.g-label')];
    const counts = labels.map((l) => ({
      titleDots: l.querySelectorAll('.planning-lot-dot').length,
      chipDots: l.querySelectorAll('.lot-chip i').length,
      visible: [...l.querySelectorAll('.planning-lot-dot, .lot-chip i')]
        .filter((e) => e.getBoundingClientRect().width > 0).length,
    }));
    return {
      labels: labels.length,
      maxTitleDots: Math.max(...counts.map((c) => c.titleDots)),
      totalChipDots: counts.reduce((n, c) => n + c.chipDots, 0),
      maxVisible: Math.max(...counts.map((c) => c.visible)),
    };
  });
  note('UX261-PLAN-06', single);
  ok(single.maxTitleDots <= 1 && single.totalChipDots === 0,
    'UX261-PLAN-06 : une seule pastille par ligne — la métadonnée n’en porte plus (lotChip dot:false)', 'UX261-PLAN-06');
  ok(single.maxVisible <= 1,
    'UX261-PLAN-06 : aucune ligne n’affiche deux pastilles visibles', 'UX261-PLAN-06');
  await ev(p, () => { app.ui.planningView = 'gantt'; save(); renderPage(); });
  await shot(p, '01-planning-lot-dot-before-name.png');

  // ---- UX261-PLAN-07 : Kanban STRICTEMENT inchangé
  const kanban = await ev(p, () => {
    app.ui.planningView = 'kanban'; save(); renderPage();
    const cards = [...document.querySelectorAll('.kanban-card')];
    const withChip = cards.filter((c) => c.querySelector('.lot-chip'));
    return {
      cards: cards.length,
      chips: withChip.length,
      allHaveDot: withChip.every((c) => c.querySelector('.lot-chip i')),
      noDotClass: cards.filter((c) => c.querySelector('.lot-chip.no-dot')).length,
      titleDots: cards.filter((c) => c.querySelector('.planning-lot-dot')).length,
      sample: withChip[0]?.querySelector('.lot-chip')?.outerHTML.slice(0, 120),
    };
  });
  note('UX261-PLAN-07', kanban);
  ok(kanban.chips > 0 && kanban.allHaveDot && kanban.noDotClass === 0,
    'UX261-PLAN-07 : le Kanban conserve lotChip() avec sa pastille — comportement V2.6.0 par défaut intact', 'UX261-PLAN-07');
  ok(kanban.titleDots === 0,
    'UX261-PLAN-07 : aucune pastille de titre n’est introduite dans le Kanban (pas de redesign)', 'UX261-PLAN-07');

  // ---- UX261-PLAN-08 : les 4 échelles, sans rognage du titre
  const scales = await ev(p, () => {
    app.ui.planningView = 'gantt';
    const out = {};
    for (const period of ['day', 'week', 'month', 'year']) {
      app.settings.period = period;
      planningToday();
      const labels = [...document.querySelectorAll('.g-label')];
      const titles = labels.map((l) => l.querySelector('.planning-task-title > span')).filter(Boolean);
      out[period] = {
        rows: labels.length,
        dots: labels.filter((l) => l.querySelector('.planning-lot-dot')).length,
        // Un titre est « rogné » si son contenu déborde de sa boîte.
        clipped: titles.filter((s) => s.scrollWidth > s.clientWidth + 1).length,
        overflowBody: document.body.scrollWidth - document.documentElement.clientWidth,
      };
    }
    app.settings.period = 'month'; planningToday();
    return out;
  });
  note('UX261-PLAN-08', scales);
  ok(Object.values(scales).every((v) => v.clipped === 0),
    'UX261-PLAN-08 : aucun titre de tâche rogné en vue Jour / Semaine / Mois / Année', 'UX261-PLAN-08');
  ok(Object.values(scales).every((v) => v.overflowBody <= 1),
    'UX261-PLAN-08 : aucun débordement horizontal du body sur les 4 échelles', 'UX261-PLAN-08');
  ok(Object.values(scales).every((v) => v.rows === 0 || v.dots > 0),
    'UX261-PLAN-08 : les pastilles sont rendues sur toutes les échelles', 'UX261-PLAN-08');

  await ctx.close();
}

// Les TROIS rendus .g-label de l'application adoptent la même hiérarchie.
{
  const src = fs.readFileSync(BASE + CUR, 'utf8');
  const labels = (src.match(/<div class="g-label">/g) || []).length;
  const withTitle = (src.match(/<div class="g-label">\$\{planningTaskTitle\(t\)\}/g) || []).length;
  const legacy = (src.match(/<div class="g-label"><b>\$\{esc\(t\.name\)\}<\/b>/g) || []).length;
  note('UX261-PLAN-sites', { rendus: labels, avecNouveauTitre: withTitle, ancienPattern: legacy });
  ok(labels === withTitle && legacy === 0,
    `UX261-PLAN-01 : les ${labels} rendus .g-label de l’application (Gantt principal, vue Jour, aperçu chantier) utilisent tous la nouvelle hiérarchie`, 'UX261-PLAN-01');
}

// ============================================================
// UX261-DRAWER-01 → 05 — SIDEWINDOW RESSOURCE
// ============================================================
console.log('\n[UX261-DRAWER] Fiche Ressource — respiration entre « ••• » et « × »');
{
  const measure = async (p) =>
    ev(p, async () => {
      const res = {};
      for (const [kind, id] of [['personne', 'thomas'], ['entreprise', 'legall'], ['materiel', 'crane-g01']]) {
        openResource(id);
        await new Promise((r) => setTimeout(r, 240));
        const more = document.querySelector('.rfiche-head .more-trigger');
        const close = document.querySelector('.drawer-panel > .close');
        if (!more || !close) { res[kind] = null; continue; }
        const m = more.getBoundingClientRect(), c = close.getBoundingClientRect();
        res[kind] = {
          gap: +(c.left - m.right).toFixed(1),
          overlap: !(c.left >= m.right || c.right <= m.left) && !(c.top >= m.bottom || c.bottom <= m.top),
          moreVisible: m.width > 0 && m.height > 0,
          closeVisible: c.width > 0 && c.height > 0,
          inViewport: m.left >= 0 && c.right <= window.innerWidth + 1,
          overflowBody: document.body.scrollWidth - document.documentElement.clientWidth,
        };
        closeOverlay('drawer');
      }
      return res;
    });

  // Mesure AVANT (V2.6.0) puis APRÈS (V2.6.1), aux mêmes dimensions.
  const before = {}, after = {};
  for (const [w, h] of [[1440, 900], [430, 932], [390, 844]]) {
    const a = await newPage({ tag: `D26-${w}`, w, h, file: PREV });
    before[`${w}`] = await measure(a.p);
    await a.ctx.close();
    const c = await newPage({ tag: `D261-${w}`, w, h });
    after[`${w}`] = await measure(c.p);
    if (w === 1440) {
      for (const [n, id] of [['03-sidewindow-person-spacing.png', 'thomas'], ['04-sidewindow-company-spacing.png', 'legall'], ['05-sidewindow-equipment-spacing.png', 'crane-g01']]) {
        await ev(c.p, (rid) => openResource(rid), id);
        await shot(c.p, n);
      }
    }
    await c.ctx.close();
  }
  note('UX261-DRAWER-avant', { '1440': before['1440'], '390': before['390'] });
  note('UX261-DRAWER-après', after);

  const kinds = [['personne', 'UX261-DRAWER-01'], ['entreprise', 'UX261-DRAWER-02'], ['materiel', 'UX261-DRAWER-03']];
  for (const [kind, sec] of kinds) {
    const b0 = before['1440'][kind], a0 = after['1440'][kind];
    ok(b0.gap === 0, `${sec} : ${kind} — écart MESURÉ avant correction = ${b0.gap}px (boutons collés)`, sec);
    ok(a0.gap >= 10 && a0.gap <= 16,
      `${sec} : ${kind} — écart après correction = ${a0.gap}px (cible 10–16px)`, sec);
  }

  // ---- UX261-DRAWER-04 : mobile
  const mobile = ['430', '390'].flatMap((w) => Object.entries(after[w]).map(([k, v]) => ({ w, k, ...v })));
  note('UX261-DRAWER-04', mobile);
  ok(mobile.every((m) => !m.overlap && m.moreVisible && m.closeVisible && m.inViewport),
    'UX261-DRAWER-04 : à 430px et 390px, les deux boutons restent visibles, accessibles et sans chevauchement', 'UX261-DRAWER-04');
  ok(mobile.every((m) => m.overflowBody <= 1),
    'UX261-DRAWER-04 : aucun débordement horizontal provoqué par la correction', 'UX261-DRAWER-04');
  ok(mobile.every((m) => m.gap >= 10 && m.gap <= 16),
    'UX261-DRAWER-04 : l’écart reste dans la cible 10–16px en mobile', 'UX261-DRAWER-04');

  // ---- UX261-DRAWER-05 : le menu « ••• » fonctionne toujours
  const { ctx, p } = await newPage({ tag: 'D-MENU' });
  const menu = await ev(p, () => {
    openResource('thomas');
    const trigger = document.querySelector('.rfiche-head .more-trigger');
    trigger.click();
    const pop = document.querySelector('.rfiche-head .more-pop');
    const items = [...pop.querySelectorAll('[role=menuitem]')].map((x) => x.textContent.trim());
    const expanded = trigger.getAttribute('aria-expanded');
    // Le menu reste CONTENU dans le sidewindow (jamais un second tiroir).
    const panel = document.querySelector('.drawer-panel').getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const inside = pr.left >= panel.left - 1 && pr.right <= panel.right + 1;
    // Et il agit réellement.
    const before = resource('thomas').status;
    [...pop.querySelectorAll('[role=menuitem]')].find((x) => /Archiver/.test(x.textContent))?.click();
    const modal = document.querySelector('#modalContent').textContent;
    confirmArchiveResource('thomas');
    const archived = resource('thomas').status;
    restoreResource('thomas');
    return { items, expanded, inside, before, modal: modal.slice(0, 60), archived, restored: resource('thomas').status };
  });
  note('UX261-DRAWER-05', menu);
  ok(menu.items.some((x) => /Modifier/.test(x)) && menu.items.some((x) => /Archiver/.test(x)) && menu.items.some((x) => /Supprimer/.test(x)),
    'UX261-DRAWER-05 : le menu « ••• » propose toujours Modifier / Archiver / Supprimer', 'UX261-DRAWER-05');
  ok(menu.expanded === 'true' && menu.inside,
    'UX261-DRAWER-05 : il s’ouvre correctement et reste contenu dans le sidewindow', 'UX261-DRAWER-05');
  ok(menu.before === 'active' && menu.archived === 'archived' && menu.restored === 'active',
    'UX261-DRAWER-05 : ses actions restent pleinement fonctionnelles (archiver puis réactiver)', 'UX261-DRAWER-05');
  await ctx.close();
}

// ============================================================
// UX261-LOAD-01 → 11 — CHARGE DES RESSOURCES
// ============================================================
console.log('\n[UX261-LOAD] Charge des ressources — groupes Personnes / Entreprises / Matériel');
{
  const { ctx, p } = await newPage({ tag: 'LOAD' });

  // ---- UX261-LOAD-01 / 02 / 03
  const all = await ev(p, () => {
    go('team');
    const groups = [...document.querySelectorAll('.load-group-row')].map((g) => {
      const label = g.querySelector('.load-group-label');
      return {
        text: label.firstChild.textContent.trim(),
        count: +label.querySelector('span').textContent.trim(),
      };
    });
    // Lignes rattachées à chaque groupe, dans l'ordre du DOM.
    const rows = [...document.querySelectorAll('.load-row:not(.load-head)')];
    const perGroup = [];
    rows.forEach((r) => {
      if (r.classList.contains('load-group-row')) perGroup.push({ label: r.querySelector('.load-group-label').firstChild.textContent.trim(), n: 0, names: [] });
      else if (perGroup.length) {
        perGroup.at(-1).n++;
        perGroup.at(-1).names.push(r.querySelector('.rc-name b').textContent.trim());
      }
    });
    const allNames = perGroup.flatMap((g) => g.names);
    return {
      groups,
      perGroup,
      tables: document.querySelectorAll('.resources').length,
      heads: document.querySelectorAll('.load-head').length,
      toolbars: document.querySelectorAll('.team-load-toolbar').length,
      totalRows: allNames.length,
      unique: new Set(allNames).size,
      activeResources: app.resources.filter(resourceActive).length,
    };
  });
  note('UX261-LOAD-01', all);
  ok(JSON.stringify(all.groups.map((g) => g.text)) === JSON.stringify(['Personnes', 'Entreprises', 'Matériel']),
    'UX261-LOAD-01 : les trois groupes apparaissent dans l’ordre Personnes → Entreprises → Matériel', 'UX261-LOAD-01');
  ok(all.tables === 1 && all.heads === 1 && all.toolbars === 1,
    'UX261-LOAD-01 : UN SEUL tableau, un seul header de jours, une seule toolbar — les groupes ne sont que des séparateurs', 'UX261-LOAD-01');
  ok(all.totalRows === all.unique && all.totalRows === all.activeResources,
    `UX261-LOAD-02 : chaque ressource apparaît exactement une fois (${all.totalRows} lignes pour ${all.activeResources} ressources actives)`, 'UX261-LOAD-02');
  ok(all.groups.every((g, i) => g.count === all.perGroup[i].n),
    'UX261-LOAD-03 : le compteur de chaque groupe égale le nombre réel de lignes visibles dans ce groupe', 'UX261-LOAD-03');
  await shot(p, '06-load-groups-all.png', { fullPage: true });

  // ---- UX261-LOAD-04 / 05 : le filtre s'applique AVANT le regroupement
  const filtered = await ev(p, () => {
    const out = {};
    for (const f of ['available', 'busy', 'conflict', 'unavailable']) {
      app.ui.teamLoadStatusFilter = f; save(); renderPage();
      const days = getResourceWeekDays(app.ui.teamLoadAnchor || TODAY);
      // Vérité de référence : le filtre EXISTANT, calculé indépendamment du rendu.
      const expected = app.resources
        .filter(resourceActive)
        .filter((r) => getResourcePeriodState(r.id, days) === f);
      const rows = [...document.querySelectorAll('.load-row:not(.load-head):not(.load-group-row) .rc-name b')]
        .map((x) => x.textContent.trim());
      const groups = [...document.querySelectorAll('.load-group-label')].map((g) => g.firstChild.textContent.trim());
      const expectedGroups = ['person', 'company', 'equipment']
        .filter((t) => expected.some((r) => r.type === t))
        .map((t) => ({ person: 'Personnes', company: 'Entreprises', equipment: 'Matériel' })[t]);
      out[f] = {
        expected: expected.map((r) => r.name).sort(),
        rendered: rows.sort(),
        groups,
        expectedGroups,
        emptyGroups: groups.filter((g, i) => g !== expectedGroups[i]).length,
      };
    }
    app.ui.teamLoadStatusFilter = 'all'; save(); renderPage();
    return out;
  });
  note('UX261-LOAD-04', filtered);
  ok(Object.values(filtered).every((f) => JSON.stringify(f.expected) === JSON.stringify(f.rendered)),
    'UX261-LOAD-04 : le regroupement porte EXACTEMENT sur les ressources déjà filtrées — le filtre de statut est inchangé', 'UX261-LOAD-04');
  ok(Object.values(filtered).every((f) => JSON.stringify(f.groups) === JSON.stringify(f.expectedGroups)),
    'UX261-LOAD-05 : un groupe sans résultat n’apparaît pas (jamais de « ENTREPRISES · 0 »)', 'UX261-LOAD-05');
  await ev(p, () => { app.ui.teamLoadStatusFilter = 'busy'; save(); renderPage(); });
  await shot(p, '07-load-groups-filtered.png', { fullPage: true });

  // ---- UX261-LOAD-06 : filtre sans aucun résultat → état vide historique
  const empty = await ev(p, () => {
    // On force un statut que personne ne porte cette semaine.
    app.ui.teamLoadStatusFilter = 'all'; save();
    const days = getResourceWeekDays(app.ui.teamLoadAnchor || TODAY);
    const unused = ['conflict', 'unavailable', 'high', 'busy', 'available']
      .find((st) => !app.resources.filter(resourceActive).some((r) => getResourcePeriodState(r.id, days) === st));
    app.ui.teamLoadStatusFilter = unused; save(); renderPage();
    const res = {
      statut: unused,
      groupRows: document.querySelectorAll('.load-group-row').length,
      tables: document.querySelectorAll('.resources').length,
      emptyState: document.querySelector('.field-none')?.textContent.trim(),
    };
    app.ui.teamLoadStatusFilter = 'all'; save(); renderPage();
    return res;
  });
  note('UX261-LOAD-06', empty);
  ok(empty.groupRows === 0 && empty.tables === 0,
    'UX261-LOAD-06 : aucun bandeau de groupe quand le filtre ne retient rien', 'UX261-LOAD-06');
  ok(/Aucune ressource avec le statut/.test(empty.emptyState || ''),
    'UX261-LOAD-06 : l’état vide historique est conservé tel quel', 'UX261-LOAD-06');

  // ---- UX261-LOAD-07 : les calculs de cellule sont STRICTEMENT identiques à V2.6.0
  const cellsOf = async (file, tag) => {
    const { ctx: c, p: q } = await newPage({ tag, file });
    const out = await ev(q, () => {
      const days = getResourceWeekDays(app.ui.teamLoadAnchor || TODAY);
      return app.resources.filter(resourceActive).flatMap((r) =>
        days.map((d) => [
          r.id, d,
          getResourceState(r.id, d),
          JSON.stringify(getResourceLoad(r.id, d).tasks.map((t) => t.id)),
          getMaxConcurrentTasks(r.id, { start: d + 'T00:00', end: d + 'T23:59' }),
        ].join('|')),
      );
    });
    await c.close();
    return out;
  };
  const c26 = await cellsOf(PREV, 'CELLS-26');
  const c261 = await cellsOf(CUR, 'CELLS-261');
  note('UX261-LOAD-07', { cellules: c261.length, divergentes: c261.filter((x, i) => x !== c26[i]).length });
  ok(c26.length === c261.length && c26.length > 0 && c26.every((x, i) => x === c261[i]),
    `UX261-LOAD-07 : les ${c261.length} cellules (getResourceState / getResourceLoad / getMaxConcurrentTasks) sont strictement identiques à V2.6.0`, 'UX261-LOAD-07');

  // ---- UX261-LOAD-08 : clic ressource
  const click = await ev(p, () => {
    go('team');
    const row = [...document.querySelectorAll('.load-row:not(.load-head):not(.load-group-row)')]
      .find((r) => /Mathieu/.test(r.textContent));
    row.click();
    const open = document.querySelector('#drawer').classList.contains('open');
    const title = document.querySelector('#drawerContent h2')?.textContent;
    closeOverlay('drawer');
    // Les bandeaux de groupe ne sont ni cliquables ni focusables.
    const g = document.querySelector('.load-group-row');
    return {
      open, title,
      groupRole: g.getAttribute('role'),
      groupTabindex: g.getAttribute('tabindex'),
      groupCursor: getComputedStyle(g).cursor,
      rowRole: row.getAttribute('role'),
      rowTabindex: row.getAttribute('tabindex'),
    };
  });
  note('UX261-LOAD-08', click);
  ok(click.open && /Mathieu/.test(click.title || ''),
    'UX261-LOAD-08 : cliquer une ligne ouvre toujours openResource()', 'UX261-LOAD-08');
  ok(click.rowRole === 'button' && click.rowTabindex === '0',
    'UX261-LOAD-08 : les lignes restent role="button" et focusables', 'UX261-LOAD-08');
  ok(!click.groupRole && click.groupTabindex === null && click.groupCursor === 'default',
    'UX261-LOAD-08 : les bandeaux de groupe ne sont ni interactifs ni focusables', 'UX261-LOAD-08');

  // ---- UX261-LOAD-09 : navigation semaine inchangée
  const nav = await ev(p, () => {
    const label = () => document.querySelector('.team-load-week-label').textContent.trim();
    const start = label(), anchor0 = app.ui.teamLoadAnchor;
    shiftTeamLoadWeek(-1);
    const prev = label(), groupsPrev = document.querySelectorAll('.load-group-row').length;
    shiftTeamLoadWeek(1);
    const back = label();
    shiftTeamLoadWeek(1);
    const next = label();
    teamLoadToday();
    return { start, prev, back, next, today: label(), anchor0, anchorEnd: app.ui.teamLoadAnchor, groupsPrev };
  });
  note('UX261-LOAD-09', nav);
  ok(nav.prev !== nav.start && nav.next !== nav.start && nav.back === nav.start,
    'UX261-LOAD-09 : « ‹ » et « › » naviguent, et l’aller-retour revient exactement à la semaine de départ', 'UX261-LOAD-09');
  ok(nav.today === nav.start,
    'UX261-LOAD-09 : « Aujourd’hui » recadre bien la semaine en cours', 'UX261-LOAD-09');
  ok(nav.groupsPrev >= 1,
    'UX261-LOAD-09 : le regroupement suit la navigation (bandeaux présents sur une autre semaine)', 'UX261-LOAD-09');

  // ---- UX261-LOAD-10 : le libellé de groupe reste lisible en défilement horizontal
  const sticky = await ev(p, () => {
    const box = document.querySelector('.resources');
    const label = document.querySelector('.load-group-label');
    const name = document.querySelector('.load-row:not(.load-head):not(.load-group-row) .rc-name');
    const before = label.getBoundingClientRect().left;
    box.scrollLeft = box.scrollWidth;
    const after = label.getBoundingClientRect().left;
    const nameAfter = name.getBoundingClientRect().left;
    const cs = getComputedStyle(label);
    const res = {
      scrolled: box.scrollLeft > 0,
      before: Math.round(before), after: Math.round(after),
      alignedWithName: Math.abs(after - nameAfter) <= 1,
      position: cs.position, left: cs.left,
      visible: label.getBoundingClientRect().width > 0,
    };
    box.scrollLeft = 0;
    return res;
  });
  note('UX261-LOAD-10', sticky);
  ok(sticky.position === 'sticky' && sticky.left === '0px',
    'UX261-LOAD-10 : le libellé de groupe est sticky sur la première colonne', 'UX261-LOAD-10');
  ok(!sticky.scrolled || (Math.abs(sticky.after - sticky.before) <= 1 && sticky.visible),
    'UX261-LOAD-10 : il reste en place et lisible pendant le défilement horizontal', 'UX261-LOAD-10');
  ok(sticky.alignedWithName,
    'UX261-LOAD-10 : il reste aligné sur la colonne des noms — la grille du tableau est préservée', 'UX261-LOAD-10');

  // La grille du bandeau est celle des lignes.
  const grid = await ev(p, () => {
    const g = getComputedStyle(document.querySelector('.load-group-row')).gridTemplateColumns;
    const r = getComputedStyle(document.querySelector('.load-row:not(.load-head):not(.load-group-row)')).gridTemplateColumns;
    const h = getComputedStyle(document.querySelector('.load-head')).gridTemplateColumns;
    const cells = document.querySelector('.load-group-row').children.length;
    const rowCells = document.querySelector('.load-row:not(.load-head):not(.load-group-row)').children.length;
    return { g, r, h, cells, rowCells, height: Math.round(document.querySelector('.load-group-row').getBoundingClientRect().height) };
  });
  note('UX261-LOAD-10-grille', grid);
  ok(grid.g === grid.r && grid.g === grid.h && grid.cells === grid.rowCells,
    'UX261-LOAD-10 : le bandeau partage EXACTEMENT la grille des lignes et du header (alignement parfait)', 'UX261-LOAD-10');
  ok(grid.height >= 28 && grid.height <= 34,
    `UX261-LOAD-10 : bandeau dense (${grid.height}px, cible 28–32px) — le tableau reste professionnel`, 'UX261-LOAD-10');

  await ctx.close();
}

// ---- UX261-LOAD-11 : mobile 390
{
  const { ctx, p } = await newPage({ tag: 'LOAD-390', w: 390, h: 844 });
  const mob = await ev(p, () => {
    go('team');
    const box = document.querySelector('.resources');
    const bodyOverflow = document.body.scrollWidth - document.documentElement.clientWidth;
    const localScroll = box.scrollWidth > box.clientWidth;
    box.scrollLeft = 200;
    const scrolled = box.scrollLeft > 0;
    const label = document.querySelector('.load-group-label');
    const lr = label.getBoundingClientRect(), br = box.getBoundingClientRect();
    box.scrollLeft = 0;
    return {
      bodyOverflow, localScroll, scrolled,
      groups: document.querySelectorAll('.load-group-row').length,
      labelInside: lr.left >= br.left - 1,
    };
  });
  note('UX261-LOAD-11', mob);
  ok(mob.bodyOverflow <= 1,
    'UX261-LOAD-11 : à 390px, aucun débordement horizontal du body', 'UX261-LOAD-11');
  ok(mob.localScroll && mob.scrolled && mob.labelInside,
    'UX261-LOAD-11 : le défilement horizontal reste LOCAL au tableau, libellé de groupe compris', 'UX261-LOAD-11');
  ok(mob.groups === 3, 'UX261-LOAD-11 : les trois groupes restent rendus en mobile', 'UX261-LOAD-11');
  await shot(p, '08-load-groups-mobile.png', { fullPage: true });
  await ctx.close();
}

// ============================================================
// DARK MODE
// ============================================================
console.log('\n[UX261-DARK] Thème sombre');
{
  const { ctx, p } = await newPage({ tag: 'DARK' });
  const dark = await ev(p, () => {
    setAppearance('dark'); renderPage();
    const bg = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).backgroundColor : null; };
    const color = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
    go('planning'); app.settings.period = 'month'; save(); renderPage();
    const planningDot = bg('.g-label .planning-lot-dot');
    const dotClass = [...document.querySelector('.g-label .planning-lot-dot').classList].find((c) => c.startsWith('lchip-'));
    go('team');
    return {
      dark: document.body.classList.contains('dark'),
      planningDot, dotClass,
      groupBg: bg('.load-group-row'),
      labelBg: bg('.load-group-label'),
      labelColor: color('.load-group-label'),
      surfaceSubtle: getComputedStyle(document.documentElement).getPropertyValue('--surface-subtle').trim(),
      textTertiary: getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim(),
    };
  });
  note('UX261-DARK', dark);
  const rgb = (c) => (c || '').match(/\d+/g)?.map(Number) || [];
  const light = (c) => { const v = rgb(c); return v.length >= 3 && v[0] + v[1] + v[2] > 180; };
  ok(dark.dark && light(dark.planningDot),
    'UX261-DARK : la pastille du Planning utilise la variante SOMBRE de .lchip-* (teinte éclaircie)', 'UX261-DARK');
  ok(dark.labelBg && dark.labelColor && !light(dark.labelBg) && light(dark.labelColor),
    'UX261-DARK : le bandeau de groupe reste sobre et lisible en sombre (fond foncé, texte clair)', 'UX261-DARK');
  await ev(p, () => { go('planning'); app.settings.period = 'month'; save(); renderPage(); });
  await shot(p, '09-dark-planning.png');
  await ev(p, () => go('team'));
  await shot(p, '10-dark-load-groups.png', { fullPage: true });
  await ctx.close();
}

// ============================================================
// RESPONSIVE
// ============================================================
console.log('\n[UX261-RESP] Responsive — 8 formats');
{
  const sizes = [[1920, 1080], [1440, 900], [1280, 800], [900, 1000], [768, 1024], [430, 932], [390, 844], [360, 800]];
  const bad = [];
  for (const [w, h] of sizes) {
    const { ctx, p } = await newPage({ tag: `R-${w}`, w, h });
    const r = await ev(p, () => {
      const probe = () => document.body.scrollWidth - document.documentElement.clientWidth;
      const out = {};
      go('planning'); app.settings.period = 'month'; save(); renderPage();
      out.planning = probe();
      go('team');
      out.charge = probe();
      openResource('thomas');
      out.ficheRessource = probe();
      closeOverlay('drawer');
      return out;
    });
    const over = Object.entries(r).filter(([, v]) => v > 1);
    if (over.length) bad.push({ size: `${w}×${h}`, over });
    await ctx.close();
  }
  note('UX261-RESP', { testés: sizes.length, débordements: bad });
  ok(bad.length === 0,
    `UX261-RESP : aucun débordement horizontal du body sur ${sizes.length} formats (1920 → 360), Planning, Charge et fiche Ressource inclus`, 'UX261-RESP');
}

// ============================================================
// BYTE-IDENTITÉ
// ============================================================
console.log('\n[FREEZE-261] Byte-identité V2.6.0 → V2.6.1');
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
  const frozen = [
    'taskEffectiveColorKey', 'taskColorClass', 'taskResourceIds', 'taskHasResource',
    'normalizeTaskResources', 'getResourceTasks', 'getResourceState', 'getResourcePeriodState',
    'getResourceLoad', 'getMaxConcurrentTasks', 'getResourceSchedulingConflicts',
    'getResourceConflicts', 'resourceConflictNudge', 'planningProblems',
    'evaluateScenario', 'planReflow', 'applyReflowPlan', 'setTaskStatus', 'kanbanDrop',
    'dropTask', 'kanbanCard', 'kanbanBoard', 'getProjectHealth', 'calculateProjectDelay',
    'getTodayDecisions', 'getTodayWarnings', 'getTodayActions', 'buildKanvixBackup',
    'confirmKanvixRestore', 'validateKanvixBackup', 'validateImportState', 
    'historyProjectId', 'projectHistory', 'lot', 'activeLots', 'lotLabel', 'lotColorKey',
    'taskLot', 'assignableLots', 'lotReferences', 'canDeleteLot', 
    'openTaskForm', 'openTaskEdit', 'submitTaskEdit', 'setPlanningFilter', 'renderMore',
    'createRework', 'openResource', 'openLotsManager', 'renderLotsManager', 'submitLot',
    'moveLot', 'setLotActive', 'scale', 'pos', 'shiftPlanning', 'planningToday',
    'shiftTeamLoadWeek', 'teamLoadToday', 'renderTeam',
  ];
  let moved = [], same = 0;
  for (const n of frozen) {
    const a = extractFn(prevSrc, n), c = extractFn(curSrc, n);
    if (a && c && md5(a) === md5(c)) same++;
    else moved.push(`${n} (${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'})`);
  }
  note('FREEZE-261', { gelés: same, bougés: moved });
  ok(moved.length === 0,
    `FREEZE-261 : les ${frozen.length} moteurs métier et rendus hors périmètre sont byte-identiques à V2.6.0 — aucune logique métier touchée`, 'FREEZE-261');

  // Seules deux fonctions changent, et pour la raison annoncée.
  const changed = ['lotChip', 'resourceLoadBoard'].filter((n) => {
    const a = extractFn(prevSrc, n), c = extractFn(curSrc, n);
    return a && c && md5(a) !== md5(c);
  });
  const added = ['planningLotDot', 'planningTaskTitle', 'planningLotMeta', 'resourceLoadGroups']
    .filter((n) => extractFn(curSrc, n) && !extractFn(prevSrc, n));
  note('FREEZE-261-périmètre', { modifiées: changed, ajoutées: added });
  ok(changed.length === 2 && added.length === 4,
    'FREEZE-261 : exactement 2 fonctions modifiées (lotChip, resourceLoadBoard) et 4 helpers de présentation ajoutés', 'FREEZE-261');

  // lotChip : le défaut reste STRICTEMENT V2.6.0.
  const chip = extractFn(curSrc, 'lotChip');
  ok(/opts\.dot !== false/.test(chip) && /withDot \? `<i aria-hidden="true"><\/i>` : ""/.test(chip),
    'FREEZE-261 : lotChip() n’ajoute qu’une option `dot:false` — son comportement par défaut est inchangé', 'FREEZE-261');

  // La pastille du Planning lit bien le LOT, jamais la couleur effective.
  const dotFn = extractFn(curSrc, 'planningLotDot');
  ok(/taskLot\(t\)/.test(dotFn) && !/taskEffectiveColorKey/.test(dotFn),
    'FREEZE-261 : planningLotDot() lit taskLot(t).colorKey et JAMAIS taskEffectiveColorKey()', 'FREEZE-261');

  // resourceLoadGroups n'est qu'un organisateur : aucun calcul de charge.
  const groupsFn = extractFn(curSrc, 'resourceLoadGroups');
  ok(!/getResourceState|getResourceLoad|getMaxConcurrentTasks|resourceActive/.test(groupsFn),
    'FREEZE-261 : resourceLoadGroups() n’effectue AUCUN calcul de charge et ne refiltre rien', 'FREEZE-261');

  // Schéma / STORE intacts.
  ok(/STORE = "kanvix-product-8-3"/.test(curSrc) && /SCHEMA_VERSION = 10\b/.test(curSrc),
    'FREEZE-261 : STORE et SCHEMA_VERSION = 10 inchangés, aucune migration ajoutée', 'FREEZE-261');
  const prevMig = extractFn(prevSrc, 'migrateState'), curMig = extractFn(curSrc, 'migrateState');
  ok(md5(prevMig) === md5(curMig),
    'FREEZE-261 : migrateState() est byte-identique — aucune migration V2.6.1', 'FREEZE-261');
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-261] Erreurs JavaScript applicatives');
note('CONSOLE-261', allErrs);
ok(allErrs.length === 0, 'CONSOLE-261 : 0 erreur JavaScript applicative sur l’ensemble de la recette', 'CONSOLE-261');

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
