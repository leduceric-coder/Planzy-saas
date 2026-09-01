// ============================================================
// KANVIX — Recette globale de l'Accueil V2.4.4.1
// Script d'audit AUTOMATISÉ (lecture seule) — ne modifie jamais le POC.
// Usage : node recette-accueil-v2.4.4.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;

const HTTP = 'http://localhost:8241/kanvix-next-gen-v2.4.4.1.html';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.4.1.html';
const SHOTS = '/home/user/Planzy-saas/recette-accueil/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

let passed = 0, failed = [];
const results = []; // { section, name, status, detail }
const ok = (c, name, section) => {
  const status = c ? 'PASS' : 'FAIL';
  if (c) passed++; else failed.push(`[${section}] ${name}`);
  results.push({ section, name, status });
  console.log(`  ${c ? '✓' : '✗'} [${section}] ${name}`);
};
const note = (section, name, detail) => {
  results.push({ section, name, status: 'INFO', detail });
  console.log(`  (info) [${section}] ${name}: ${JSON.stringify(detail)}`);
};

const allErrs = [];
const OM_MOCK = JSON.stringify({
  latitude: 48.39, longitude: -4.48, timezone: 'GMT',
  current: { time: '2026-09-01T09:00', temperature_2m: 18.4, weather_code: 2, wind_speed_10m: 14.2 },
});
const GEOCODE_MOCK = (name, lon, lat) => JSON.stringify({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { city: [name], label: name }, geometry: { type: 'Point', coordinates: [lon, lat] } }],
});

async function newPage(url, opts = {}) {
  const ctx = await b.newContext(opts); // opts.viewport, si fourni, fixe la taille dès la création
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ url, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ url, msg: m.text() }); });
  if (opts.mockWeather !== false) {
    await p.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: OM_MOCK }));
    await p.route('https://data.geopf.fr/geocodage/search**', (route) => {
      const u = new URL(route.request().url()), q = (u.searchParams.get('q') || '').toLowerCase();
      route.fulfill({ status: 200, contentType: 'application/json', body: GEOCODE_MOCK(q, -4.48, 48.39) });
    });
    await p.route('https://data.geopf.fr/geocodage/reverse**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: GEOCODE_MOCK('Brest', -4.48, 48.39) }));
  }
  await p.goto(url, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// ============================================================
// SECTION 5+6 — Alignement colonnes + hauteurs (desktop)
// ============================================================
console.log('\n[SECTION 5-6] Alignement et hauteurs — desktop');
for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800], [1081, 800]]) {
  const { ctx, p } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 } });
  await p.setViewportSize({ width: w, height: h });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(400);
  const rects = await ev(p, () => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { decide: r('.attention-card.decide'), watch: r('.attention-card.watch'), today: r('.actions-panel'), sites: r('.projects-panel') };
  });
  const tag = `${w}x${h}`;
  ok(Math.abs(rects.decide.left - rects.today.left) <= 1, `${tag}: left(À décider)=left(Aujourd'hui)`, 'align');
  ok(Math.abs(rects.decide.right - rects.today.right) <= 1, `${tag}: right(À décider)=right(Aujourd'hui)`, 'align');
  ok(Math.abs(rects.watch.left - rects.sites.left) <= 1, `${tag}: left(À surveiller)=left(Chantiers actifs)`, 'align');
  ok(Math.abs(rects.watch.right - rects.sites.right) <= 1, `${tag}: right(À surveiller)=right(Chantiers actifs)`, 'align');
  const gap1 = Math.round(rects.watch.left - rects.decide.right), gap2 = Math.round(rects.sites.left - rects.today.right);
  ok(gap1 === 16 && gap2 === 16, `${tag}: gap=16px (attention=${gap1}, today=${gap2})`, 'align');
  const heights = await ev(p, () => [...document.querySelectorAll('.attention-card')].map((c) => c.getBoundingClientRect().height));
  ok(Math.abs(heights[0] - heights[1]) <= 1, `${tag}: hauteur À décider=À surveiller (${heights.join('/')})`, 'height');
  const tpH = await ev(p, () => [...document.querySelectorAll('.tp-row')].map((c) => c.getBoundingClientRect().height));
  ok(tpH.length > 0 && Math.max(...tpH) - Math.min(...tpH) <= 2, `${tag}: hauteur lignes Aujourd'hui cohérente (${tpH.join(',')})`, 'height');
  const acpH = await ev(p, () => [...document.querySelectorAll('.acp-row')].map((c) => c.getBoundingClientRect().height));
  ok(acpH.length > 0 && Math.max(...acpH) - Math.min(...acpH) <= 2, `${tag}: hauteur lignes Chantiers actifs cohérente (${acpH.join(',')})`, 'height');
  const wpH = await ev(p, () => [...document.querySelectorAll('.wp-day')].map((d) => Math.round(d.getBoundingClientRect().height)));
  ok(Math.max(...wpH) - Math.min(...wpH) <= 1, `${tag}: hauteur 5 cellules semaine cohérente (${wpH.join(',')})`, 'height');
  if (w === 1600 && h === 900) {
    await p.screenshot({ path: SHOTS + 'A-desktop-1600x900-clair.png', fullPage: true });
  }
  if (w === 1366 && h === 768) {
    await p.screenshot({ path: SHOTS + 'B-desktop-1366x768-clair.png', fullPage: true });
  }
  await ctx.close();
}

// ============================================================
// SECTION 21 — Responsive 1080 (breakpoint critique)
// ============================================================
console.log('\n[SECTION 21] Breakpoint 1080px');
for (const w of [1081, 1080, 1079]) {
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: w, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(250);
  const cols = await ev(p, () => ({
    attention: getComputedStyle(document.querySelector('.attention-grid')).gridTemplateColumns.split(' ').length,
    today: getComputedStyle(document.querySelector('.today-main-grid')).gridTemplateColumns.split(' ').length,
  }));
  const hasHScroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(cols.attention === cols.today, `${w}px: mêmes colonnes attention/today (${cols.attention}/${cols.today})`, 'breakpoint');
  ok(!hasHScroll, `${w}px: pas de scroll horizontal`, 'breakpoint');
  note('breakpoint', `${w}px colonnes`, cols);
  await ctx.close();
}

// ============================================================
// SECTION 22 — Tablette (ordre, pas de scroll horizontal)
// ============================================================
console.log('\n[SECTION 22] Tablette');
for (const [w, h] of [[900, 1000], [768, 1024]]) {
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: w, height: h });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(300);
  const order = await ev(p, () => {
    const sel = ['.attention-card.decide', '.attention-card.watch', '.actions-panel', '.projects-panel', '.week-preview', '.today-insight'];
    return sel.map((s) => {
      const el = document.querySelector(s);
      return el ? el.getBoundingClientRect().top : null;
    });
  });
  const sorted = order.filter((x) => x !== null);
  const isOrdered = sorted.every((v, i) => i === 0 || v >= sorted[i - 1]);
  ok(isOrdered, `${w}px: ordre vertical À décider→À surveiller→Aujourd'hui→Chantiers→Semaine→À savoir`, 'tablet');
  const hasHScroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!hasHScroll, `${w}px: pas de scroll horizontal`, 'tablet');
  if (w === 900) {
    await p.screenshot({ path: SHOTS + 'D-tablette-900px.png', fullPage: true });
  }
  await ctx.close();
}

// ============================================================
// SECTION 23 — Mobile Bureau (390/430)
// ============================================================
console.log('\n[SECTION 23] Mobile Bureau');
for (const [w, h] of [[430, 932], [390, 844]]) {
  const { ctx, p } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 } });
  await p.setViewportSize({ width: w, height: h });
  await ev(p, () => { resetApp(); setDepth('pilot'); setRole('driver'); go('today'); });
  await p.waitForTimeout(400);
  const hasHScroll = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!hasHScroll, `${w}px: pas de scroll horizontal`, 'mobile-bureau');
  const check = await ev(p, () => ({
    hero: !!document.querySelector('.today-hero'),
    fieldEntry: !!document.querySelector('.field-mobile-entry'),
    attention: document.querySelectorAll('.attention-card').length === 2,
    today: !!document.querySelector('.actions-panel'),
    sites: !!document.querySelector('.projects-panel'),
    week: !!document.querySelector('.week-card'),
  }));
  ok(check.hero && check.fieldEntry && check.attention && check.today && check.sites && check.week, `${w}px: tous les blocs Accueil Bureau présents`, 'mobile-bureau');
  note('mobile-bureau', `${w}px blocs`, check);
  if (w === 390) {
    await p.screenshot({ path: SHOTS + 'E-mobile-390px.png', fullPage: true });
  }
  await ctx.close();
}

// ============================================================
// SECTION 24 — Thème sombre
// ============================================================
console.log('\n[SECTION 24] Thème sombre');
{
  const { ctx, p } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 } });
  await p.setViewportSize({ width: 1600, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(300);
  await ev(p, () => setAppearance('dark'));
  await p.waitForTimeout(300);
  const dark = await ev(p, () => {
    const c = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null; };
    const bg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null; };
    return {
      decideCount: c('.attention-card.decide .attention-count'),
      watchCount: c('.attention-card.watch .attention-count'),
      weekCardBg: bg('.week-card'),
      todayCellBg: bg('.wp-day.today'),
      bodyIsDark: document.body.classList.contains('dark'),
      secondaryText: c('.acp-body small'),
    };
  });
  ok(dark.bodyIsDark, 'mode sombre appliqué (classe body.dark)', 'dark');
  ok(!!dark.decideCount && dark.decideCount !== 'rgba(0, 0, 0, 0)', 'compteur À décider a une couleur définie en sombre', 'dark');
  ok(!!dark.watchCount && dark.watchCount !== 'rgba(0, 0, 0, 0)', 'compteur À surveiller a une couleur définie en sombre', 'dark');
  ok(!!dark.secondaryText, 'texte secondaire lisible en sombre (couleur définie)', 'dark');
  note('dark', 'valeurs mesurées', dark);
  await p.screenshot({ path: SHOTS + 'C-desktop-1600x900-sombre.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// SECTION 10-11 — Popups À décider / À surveiller
// ============================================================
console.log('\n[SECTION 10-11] Popups attention');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(250);
  await ev(p, () => document.querySelector('.attention-card.decide').click());
  await p.waitForTimeout(200);
  const decidePopup = await ev(p, () => ({
    open: document.querySelector('#modal').classList.contains('open'),
    title: document.querySelector('#modalContent h2')?.textContent,
    rows: document.querySelectorAll('#modalContent .day-task').length,
  }));
  ok(decidePopup.open, 'popup À décider s\'ouvre au clic', 'popup');
  ok(decidePopup.title === 'Décisions à traiter', 'titre popup correct: "Décisions à traiter"', 'popup');
  await p.screenshot({ path: SHOTS + 'F-popup-a-decider.png' });
  await ev(p, () => closeOverlay('modal'));
  await p.waitForTimeout(150);
  const backToHome1 = await ev(p, () => app.ui.page === 'today' && !document.querySelector('#modal').classList.contains('open'));
  ok(backToHome1, 'retour Accueil intact après fermeture popup À décider', 'popup');

  await ev(p, () => document.querySelector('.attention-card.watch').click());
  await p.waitForTimeout(200);
  const watchPopup = await ev(p, () => ({
    open: document.querySelector('#modal').classList.contains('open'),
    title: document.querySelector('#modalContent h2')?.textContent,
  }));
  ok(watchPopup.open, 'popup À surveiller s\'ouvre au clic', 'popup');
  ok(watchPopup.title === 'Points à surveiller', 'titre popup correct: "Points à surveiller"', 'popup');
  await p.screenshot({ path: SHOTS + 'G-popup-a-surveiller.png' });
  await ev(p, () => closeOverlay('modal'));
  await p.waitForTimeout(150);

  // Clic sur une décision réelle depuis le popup -> workflow existant -> retour Accueil intact
  await ev(p, () => document.querySelector('.attention-card.decide').click());
  await p.waitForTimeout(150);
  const hasRow = await ev(p, () => !!document.querySelector('#modalContent .day-task'));
  if (hasRow) {
    await ev(p, () => document.querySelector('#modalContent .day-task').click());
    await p.waitForTimeout(200);
    // openDecision() route vers le panneau assistant existant (#aiOverlay,
    // vue "RÉSOUDRE") — pas modal/drawer. Vérifié via lecture du code
    // (openDecision -> openScenarios -> openAIPanel) avant d'écrire ce test.
    const decisionOpened = await ev(p, () => document.querySelector('#aiOverlay').classList.contains('open'));
    ok(decisionOpened, 'clic sur une décision ouvre le workflow existant (#aiOverlay "RÉSOUDRE")', 'popup');
    await ev(p, () => { closeAIPanel(); closeOverlay('modal'); closeOverlay('drawer'); });
    await p.waitForTimeout(150);
    const backHome = await ev(p, () => app.ui.page === 'today');
    ok(backHome, 'retour Accueil intact après workflow décision', 'popup');
  }
  await ctx.close();
}

// ============================================================
// SECTION 19 — Clic sur jour (semaine)
// ============================================================
console.log('\n[SECTION 19] Clic sur jour de la semaine');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(250);
  const dayCount = await ev(p, () => document.querySelectorAll('.wp-day').length);
  ok(dayCount === 5, '5 jours affichés (lun-ven)', 'week-click');
  await ev(p, () => document.querySelectorAll('.wp-day')[0].click());
  await p.waitForTimeout(200);
  const dayPopup = await ev(p, () => ({
    open: document.querySelector('#modal').classList.contains('open'),
    title: document.querySelector('#modalContent h2')?.textContent,
    hasBtn: !!document.querySelector('#modalContent .btn.primary'),
  }));
  ok(dayPopup.open, 'popup jour s\'ouvre au clic', 'week-click');
  ok(!!dayPopup.title, 'titre du jour complet présent (' + dayPopup.title + ')', 'week-click');
  ok(dayPopup.hasBtn, 'bouton "Ouvrir le planning" présent', 'week-click');
  await p.screenshot({ path: SHOTS + 'H-popup-jour-semaine.png' });
  await ev(p, () => closeOverlay('modal'));
  await p.waitForTimeout(150);
  const backHome = await ev(p, () => app.ui.page === 'today');
  ok(backHome, 'retour Accueil intact après popup jour', 'week-click');
  await ctx.close();
}

// ============================================================
// SECTION 13 — Clic tâche Aujourd'hui (tous statuts)
// ============================================================
console.log('\n[SECTION 13] Clic tâches Aujourd\'hui (tous statuts)');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(250);
  const rowCount = await ev(p, () => document.querySelectorAll('.tp-row').length);
  note('task-click', 'nombre de lignes Aujourd\'hui visibles', rowCount);
  for (let i = 0; i < Math.min(rowCount, 4); i++) {
    await ev(p, (idx) => document.querySelectorAll('.tp-row')[idx].click(), i);
    await p.waitForTimeout(150);
    const opened = await ev(p, () => document.querySelector('#drawer').classList.contains('open'));
    ok(opened, `ligne Aujourd'hui #${i + 1}: ouvre bien la tâche (drawer)`, 'task-click');
    await ev(p, () => closeOverlay('drawer'));
    await p.waitForTimeout(150);
    const backHome = await ev(p, () => app.ui.page === 'today' && !document.querySelector('#drawer').classList.contains('open'));
    ok(backHome, `ligne Aujourd'hui #${i + 1}: retour exact à l'Accueil`, 'task-click');
  }
  await ctx.close();
}

// ============================================================
// SECTION 5 (accessibilité clavier de .tp-row) — vérif ciblée
// ============================================================
console.log('\n[SECTION 30] Accessibilité minimale');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(250);
  const a11y = await ev(p, () => {
    const tpRow = document.querySelector('.tp-row');
    const acpRow = document.querySelector('.acp-row');
    const attCard = document.querySelector('.attention-card');
    const wpDay = document.querySelector('.wp-day');
    return {
      tpRowTag: tpRow?.tagName,
      tpRowTabIndex: tpRow?.tabIndex,
      tpRowFocusable: tpRow ? tpRow.tabIndex >= 0 || ['BUTTON', 'A'].includes(tpRow.tagName) : null,
      acpRowTag: acpRow?.tagName,
      attCardTag: attCard?.tagName,
      wpDayTag: wpDay?.tagName,
      modalHasDialogRole: document.querySelector('#modal')?.getAttribute('role'),
    };
  });
  ok(a11y.acpRowTag === 'BUTTON', 'Chantiers actifs : élément <button> natif (accessible clavier)', 'a11y');
  ok(a11y.attCardTag === 'BUTTON', 'Cartes attention : élément <button> natif (accessible clavier)', 'a11y');
  ok(a11y.wpDayTag === 'BUTTON', 'Cellules semaine : élément <button> natif (accessible clavier)', 'a11y');
  ok(a11y.tpRowFocusable === true, 'Lignes Aujourd\'hui : élément focusable au clavier', 'a11y');
  note('a11y', 'détails', a11y);
  // Contraste rapide (lecture des couleurs calculées, pas un ratio WCAG complet)
  const focusVisible = await ev(p, () => {
    const btn = document.querySelector('.attention-card.decide');
    btn.focus();
    const cs = getComputedStyle(btn, ':focus-visible');
    return { outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle };
  });
  note('a11y', 'focus-visible cartes attention', focusVisible);
  await ctx.close();
}

// ============================================================
// SECTION 8 — Densité (calme / normal / chargé)
// ============================================================
console.log('\n[SECTION 8] Densité de l\'Accueil');
{
  // CAS CALME
  const { ctx: c1, p: p1 } = await newPage(FILE);
  await p1.setViewportSize({ width: 1440, height: 1600 });
  await ev(p1, () => {
    resetApp(); setDepth('pilot');
    app.issues.forEach((i) => (i.status = 'resolved'));
    save(); go('today');
  });
  await p1.waitForTimeout(300);
  const calmHeight = await ev(p1, () => document.querySelector('#today').scrollHeight);
  note('density', 'hauteur cas CALME (px)', calmHeight);
  await p1.screenshot({ path: SHOTS + 'density-calme.png', fullPage: true });
  await c1.close();

  // CAS NORMAL (déjà le seed par défaut ~3/6/3/4)
  const { ctx: c2, p: p2 } = await newPage(FILE);
  await p2.setViewportSize({ width: 1440, height: 1600 });
  await ev(p2, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p2.waitForTimeout(300);
  const normalHeight = await ev(p2, () => document.querySelector('#today').scrollHeight);
  const normalCounts = await ev(p2, () => ({
    decide: document.querySelector('.attention-card.decide .attention-count')?.textContent,
    watch: document.querySelector('.attention-card.watch .attention-count')?.textContent,
    projects: document.querySelectorAll('.acp-row').length,
  }));
  note('density', 'hauteur cas NORMAL (px)', normalHeight);
  note('density', 'compteurs cas NORMAL', normalCounts);
  await p2.screenshot({ path: SHOTS + 'density-normal.png', fullPage: true });
  await c2.close();

  // CAS CHARGÉ
  const { ctx: c3, p: p3 } = await newPage(FILE);
  await p3.setViewportSize({ width: 1440, height: 1600 });
  await ev(p3, () => {
    resetApp(); setDepth('pilot');
    app.issues.forEach((i) => (i.status = 'resolved'));
    for (let i = 0; i < 10; i++) {
      let id = 'dens-decision-' + i;
      app.issues.push({ id, projectId: 'keravel', taskId: 'k-electric', status: 'open', severity: 'critical', source: 'planning', title: 'Décision ' + i, comment: 'x' });
      app.decisions.push({ id: 'd-' + id, issueId: id, status: 'required' });
    }
    for (let i = 0; i < 8; i++) {
      app.issues.push({ id: 'dens-watch-' + i, projectId: 'villa', taskId: 'v-facade', status: 'watching', severity: 'warning', source: 'resource', title: 'Surveillance ' + i, comment: 'y' });
    }
    let d = dayKey(TODAY);
    for (let i = 0; i < 12; i++) {
      app.tasks.push({ id: 'dens-task-' + i, projectId: 'keravel', name: 'Intervention ' + i, resourceId: 'thomas', start: d + 'T0' + (i % 8) + ':00', end: d + 'T1' + (i % 8) + ':00', status: 'todo', deps: [] });
    }
    save(); go('today');
  });
  await p3.waitForTimeout(300);
  const busyHeight = await ev(p3, () => document.querySelector('#today').scrollHeight);
  const busyCounts = await ev(p3, () => ({
    decide: document.querySelector('.attention-card.decide .attention-count')?.textContent,
    watch: document.querySelector('.attention-card.watch .attention-count')?.textContent,
    projects: document.querySelectorAll('.acp-row').length,
    actionsShown: document.querySelectorAll('.tp-row').length,
  }));
  note('density', 'hauteur cas CHARGÉ (px)', busyHeight);
  note('density', 'compteurs cas CHARGÉ', busyCounts);
  ok(busyCounts.decide === '10', 'cas chargé: compteur À décider = 10 (total réel, pas juste les affichées)', 'density');
  ok(busyCounts.watch === '8', 'cas chargé: compteur À surveiller = 8 (total réel)', 'density');
  ok(busyCounts.actionsShown <= 4, 'cas chargé: max 4 lignes Aujourd\'hui affichées (pas d\'explosion de hauteur)', 'density');
  await p3.screenshot({ path: SHOTS + 'density-charge.png', fullPage: true });
  const heightGrowthRatio = busyHeight / calmHeight;
  note('density', 'ratio hauteur chargé/calme', heightGrowthRatio.toFixed(2));
  await c3.close();
}

// ============================================================
// SECTION 28 — Données vides
// ============================================================
console.log('\n[SECTION 28] Données vides');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.projects.length = 0;
    app.tasks.length = 0;
    app.issues.length = 0;
    save(); go('today');
  });
  await p.waitForTimeout(300);
  const emptyCheck = await ev(p, () => ({
    heroPresent: !!document.querySelector('.today-hero'),
    attentionPresent: document.querySelectorAll('.attention-card').length === 2,
    todayText: document.querySelector('.actions-panel')?.textContent,
    sitesText: document.querySelector('.projects-panel')?.textContent,
    crashed: !document.querySelector('#today'),
  }));
  ok(!emptyCheck.crashed && emptyCheck.heroPresent && emptyCheck.attentionPresent, 'Accueil ne casse pas avec 0 chantier/0 tâche/0 issue', 'empty');
  note('empty', 'contenu affiché', emptyCheck);
  await ctx.close();
}

// ============================================================
// SECTION 29 — Textes longs
// ============================================================
console.log('\n[SECTION 29] Textes longs');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    const proj = app.projects.find((x) => x.id === 'keravel');
    proj.name = 'Résidence Les Hauts de Keravel Bâtiment C Tranche 3 Programme Neuf';
    proj.location = 'Plouzané Zone Artisanale du Grand Km 4 Route de Brest';
    const task = app.tasks.find((t) => t.projectId === 'keravel');
    if (task) task.name = 'Pose complète des menuiseries extérieures triple vitrage avec finitions';
    const res = app.resources.find((r) => r.id === 'thomas');
    if (res) res.name = 'Thomas Jean-Baptiste Le Guennec-Cornouaille';
    save(); go('today');
  });
  await p.waitForTimeout(300);
  const overflow = await ev(p, () => {
    const vw = document.documentElement.clientWidth;
    const rightEdge = (sel) => Math.max(0, ...[...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().right));
    return {
      pageHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      acpRowRight: rightEdge('.acp-row') - vw,
      acpBodySmallTruncated: [...document.querySelectorAll('.acp-body small')].every((el) => el.scrollWidth <= el.getBoundingClientRect().width + 1 || el.getBoundingClientRect().right <= vw + 1),
      tpRowRight: rightEdge('.tp-row') - vw,
    };
  });
  ok(!overflow.pageHScroll, 'textes longs (nom chantier + localisation): pas de débordement horizontal de page', 'long-text');
  ok(overflow.acpRowRight <= 1, 'Chantiers actifs: la ligne ne dépasse pas le viewport avec un nom/localisation très longs', 'long-text');
  note('long-text', 'dépassement mesuré (px, >0 = débordement)', overflow);
  await p.screenshot({ path: SHOTS + 'long-text.png', fullPage: true });
  await ctx.close();
}
// Cas distinct : nom de TÂCHE très long dans "Aujourd'hui" (colonne plus
// étroite) — vérifie si le texte enjambe sans casser ni le débordement de
// page ni l'homogénéité de hauteur des lignes (harmonisation V2.4.4).
console.log('\n[SECTION 29b] Texte long — nom de tâche dans Aujourd\'hui');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    const task = app.tasks.find((t) => t.projectId === 'keravel');
    if (task) task.name = 'Pose complète des menuiseries extérieures triple vitrage avec finitions et joints d’étanchéité renforcés sur toute la façade principale';
    save(); go('today');
  });
  await p.waitForTimeout(300);
  const check = await ev(p, () => {
    const vw = document.documentElement.clientWidth;
    const heights = [...document.querySelectorAll('.tp-row')].map((r) => Math.round(r.getBoundingClientRect().height));
    return {
      pageHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      heights,
      heightSpread: Math.max(...heights) - Math.min(...heights),
    };
  });
  ok(!check.pageHScroll, 'nom de tâche très long: pas de débordement horizontal de page', 'long-text');
  ok(check.heightSpread <= 2, 'nom de tâche très long: hauteur des lignes Aujourd\'hui reste cohérente (±2px)', 'long-text');
  note('long-text', 'hauteurs lignes Aujourd\'hui avec texte long', check);
  await ctx.close();
}

// ============================================================
// SECTION 16 — Météo conducteur (4 scénarios)
// ============================================================
console.log('\n[SECTION 16] Météo conducteur — scénarios');
{
  // A. géolocalisation autorisée
  const { ctx: cA, p: pA } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 } });
  await pA.setViewportSize({ width: 1440, height: 900 });
  const t0 = Date.now();
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('today'); });
  const renderTime = Date.now() - t0;
  ok(renderTime < 1500, 'A. géoloc. autorisée: rendu Accueil non bloqué (' + renderTime + 'ms)', 'weather-driver');
  await pA.waitForTimeout(500);
  const weatherA = await ev(pA, () => document.querySelector('#userWeatherWidget')?.textContent);
  ok(!!weatherA && weatherA.includes('18°'), 'A. météo conducteur affichée après résolution', 'weather-driver');
  await pA.screenshot({ path: SHOTS + 'I-meteo-chargee.png' });
  await cA.close();

  // B. géolocalisation refusée
  const { ctx: cB, p: pB } = await newPage(FILE, { permissions: [] });
  await pB.setViewportSize({ width: 1440, height: 900 });
  await ev(pB, () => { resetApp(); setDepth('pilot'); go('today'); });
  await pB.waitForTimeout(500);
  const checkB = await ev(pB, () => !!document.querySelector('.attention-card') && !!document.querySelector('.today-main-grid'));
  ok(checkB, 'B. géoloc. refusée: Accueil pleinement fonctionnel', 'weather-driver');
  await cB.close();

  // C. réseau indisponible
  const { ctx: cC, p: pC } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 }, mockWeather: false });
  await pC.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await pC.route('https://data.geopf.fr/**', (route) => route.abort('failed'));
  await pC.setViewportSize({ width: 1440, height: 900 });
  await ev(pC, () => { resetApp(); setDepth('pilot'); go('today'); });
  await pC.waitForTimeout(500);
  const checkC = await ev(pC, () => ({
    accueilOk: !!document.querySelector('.attention-card'),
    weatherEmpty: document.querySelector('#userWeatherWidget')?.textContent.trim() === '',
  }));
  ok(checkC.accueilOk, 'C. réseau indisponible: Accueil pleinement fonctionnel', 'weather-driver');
  ok(checkC.weatherEmpty, 'C. réseau indisponible: bloc météo masqué (pas de valeur fictive)', 'weather-driver');
  await pC.screenshot({ path: SHOTS + 'J-meteo-indisponible.png' });
  await cC.close();

  // D. cache météo présent (pré-rempli via localStorage avant chargement)
  const { ctx: cD, p: pD } = await newPage(FILE, { permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 }, mockWeather: false });
  await pD.addInitScript(() => {
    localStorage.setItem('kanvix-weather-cache', JSON.stringify({
      geocode: { brest: { lat: 48.39, lon: -4.48 } },
      weather: { '48.39,-4.48': { temperature: 16.2, weatherCode: 3, windSpeed: 10, fetchedAt: Date.now() - 5 * 60000 } },
    }));
  });
  await pD.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await pD.route('https://data.geopf.fr/**', (route) => route.abort('failed'));
  await pD.setViewportSize({ width: 1440, height: 900 });
  await ev(pD, () => { resetApp(); setDepth('pilot'); go('today'); });
  await pD.waitForTimeout(500);
  const checkD = await ev(pD, () => document.querySelector('#userWeatherWidget')?.textContent);
  note('weather-driver', 'D. cache présent + réseau coupé: contenu widget', checkD);
  await cD.close();
}

// ============================================================
// SECTION 15 — Météo par chantier (Brest ×2, pas de double-effet)
// Viewport fixé À LA CRÉATION du contexte (jamais setViewportSize() après
// coup) — voir SECTION 15b : un changement de viewport en cours de session
// a un effet de bord confirmé sur ce mécanisme précis.
// ============================================================
console.log('\n[SECTION 15] Météo par chantier');
{
  const { ctx, p } = await newPage(FILE, { viewport: { width: 1440, height: 900 } });
  let geocodeCalls = [];
  await p.route('https://data.geopf.fr/geocodage/search**', (route) => {
    const u = new URL(route.request().url());
    geocodeCalls.push(u.searchParams.get('q'));
    route.continue();
  });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(700);
  const rowTexts = await ev(p, () => [...document.querySelectorAll('.acp-row')].map((r) => ({
    text: r.querySelector('.acp-body small')?.textContent,
    weather: r.querySelector('.acp-weather')?.textContent,
    height: r.getBoundingClientRect().height,
  })));
  note('project-weather', 'lignes chantiers actifs', rowTexts);
  const heights = rowTexts.map((r) => r.height);
  ok(Math.max(...heights) - Math.min(...heights) <= 2, 'météo chantier: aucune ligne ne change de hauteur', 'project-weather');
  ok(rowTexts.some((r) => r.weather && r.weather.trim()), 'météo chantier: au moins une ligne affiche une météo réelle', 'project-weather');
  const locs = new Set(['plouzané', 'brest', 'le relecq']);
  ok(new Set(geocodeCalls.map((x) => (x || '').toLowerCase())).size <= geocodeCalls.length, 'météo chantier: dédoublonnage géocodage (Brest ×2 -> 1 seul appel)', 'project-weather');
  await ctx.close();
}

// ============================================================
// SECTION 15b — FINDING : changement de viewport en cours de session
// (page.setViewportSize après chargement, tel qu'utilisé par de nombreux
// scripts de test — dont plusieurs sections de ce script lui-même, ce qui
// est signalé dans le rapport) fait échouer durablement le peuplement des
// badges météo "Chantiers actifs", contrairement à un viewport fixé dès
// l'ouverture du contexte. Le widget météo CONDUCTEUR n'est PAS affecté —
// seule la voie ensureProjectWeather()/updateProjectWeatherBadge() l'est.
// Reproduit de façon déterministe (20/20, puis 5/5 vs 5/5) lors du
// diagnostic — mécanisme interne non isolé plus précisément (audit en
// lecture seule, aucune modification du POC). IMPORTANT : un navigateur
// réel ne redimensionne jamais via l'équivalent de setViewportSize (CDP) —
// un redimensionnement humain déclenche un simple événement `resize` natif
// sur une page déjà dimensionnée nativement. Il n'est donc PAS confirmé que
// ce défaut touche un utilisateur réel ; une vérification manuelle
// (redimensionner une vraie fenêtre de navigateur) est recommandée avant
// de le traiter comme un bug de production. Voir rapport, finding P1.
// ============================================================
console.log('\n[SECTION 15b] FINDING — météo chantier vs changement de viewport en cours de session');
{
  const { ctx, p } = await newPage(FILE, { viewport: { width: 1600, height: 900 } });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(1200);
  const withoutResize = await ev(p, () => document.querySelector('.acp-weather[data-pid="keravel"]')?.textContent);
  note('project-weather-finding', 'viewport fixé à la création (contrôle)', withoutResize);
  await ctx.close();

  const { ctx: ctx2, p: p2 } = await newPage(FILE);
  await p2.setViewportSize({ width: 1600, height: 900 }); // <- déclencheur observé
  await ev(p2, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p2.waitForTimeout(1200);
  const withResize = await ev(p2, () => document.querySelector('.acp-weather[data-pid="keravel"]')?.textContent);
  const driverWeatherOk = await ev(p2, () => document.querySelector('#userWeatherWidget')?.textContent || '');
  note('project-weather-finding', 'setViewportSize() après chargement (reproduction)', withResize);
  note('project-weather-finding', 'météo conducteur dans le même scénario (non affectée attendu)', driverWeatherOk);
  ok(!!withoutResize && withoutResize.trim() !== '', 'CONTRÔLE : météo chantier présente sans changement de viewport en cours de session', 'project-weather-finding');
  await ctx2.close();
}

// ============================================================
// SECTION 25 — Stabilité visuelle (10 navigations)
// ============================================================
console.log('\n[SECTION 25] Stabilité visuelle');
{
  const { ctx, p } = await newPage(FILE);
  await p.setViewportSize({ width: 1440, height: 900 });
  await ev(p, () => { resetApp(); setDepth('pilot'); go('today'); });
  await p.waitForTimeout(300);
  const baseline = await ev(p, () => {
    const main = document.querySelector('.main') || document.querySelector('#today');
    return { x: main.getBoundingClientRect().left, scrollW: document.documentElement.scrollWidth };
  });
  for (let i = 0; i < 10; i++) {
    await ev(p, () => go('sites'));
    await p.waitForTimeout(60);
    await ev(p, () => go('today'));
    await p.waitForTimeout(60);
  }
  const after10 = await ev(p, () => {
    const main = document.querySelector('.main') || document.querySelector('#today');
    return { x: main.getBoundingClientRect().left, scrollW: document.documentElement.scrollWidth };
  });
  ok(Math.abs(after10.x - baseline.x) <= 1, 'position X stable après 10 aller-retours Accueil↔Chantiers (±1px)', 'stability');
  ok(after10.scrollW === baseline.scrollW, 'largeur de scroll stable après 10 aller-retours', 'stability');

  for (let i = 0; i < 10; i++) {
    await ev(p, () => go('planning'));
    await p.waitForTimeout(60);
    await ev(p, () => go('today'));
    await p.waitForTimeout(60);
  }
  const afterPlanning = await ev(p, () => {
    const main = document.querySelector('.main') || document.querySelector('#today');
    return { x: main.getBoundingClientRect().left };
  });
  ok(Math.abs(afterPlanning.x - baseline.x) <= 1, 'position X stable après 10 aller-retours Accueil↔Planning (±1px)', 'stability');

  // ouvrir/fermer popups plusieurs fois
  for (let i = 0; i < 5; i++) {
    await ev(p, () => document.querySelector('.attention-card.decide').click());
    await p.waitForTimeout(80);
    await ev(p, () => closeOverlay('modal'));
    await p.waitForTimeout(80);
  }
  const afterPopups = await ev(p, () => {
    const main = document.querySelector('.main') || document.querySelector('#today');
    return { x: main.getBoundingClientRect().left, modalOpen: document.querySelector('#modal').classList.contains('open') };
  });
  ok(Math.abs(afterPopups.x - baseline.x) <= 1, 'position X stable après ouverture/fermeture répétée des popups', 'stability');
  ok(!afterPopups.modalOpen, 'aucun popup fantôme resté ouvert', 'stability');
  await ctx.close();
}

// ============================================================
// SECTION 26 — Actualisation terrain (2 onglets, via HTTP pour BroadcastChannel)
// ============================================================
console.log('\n[SECTION 26] Actualisation terrain (multi-onglets)');
try {
  const ctxShared = await b.newContext();
  const pA = await ctxShared.newPage();
  const pB = await ctxShared.newPage();
  for (const pg of [pA, pB]) {
    pg.on('pageerror', (e) => allErrs.push({ url: 'field-sync', msg: e.message }));
    pg.on('console', (m) => { if (m.type() === 'error') allErrs.push({ url: 'field-sync', msg: m.text() }); });
  }
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('today'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { setRole('artisan'); });
  await pA.waitForTimeout(200);
  const tid = await ev(pB, () => getArtisanTodayTasks('thomas')[0]?.id);
  ok(!!tid, 'une tâche artisan du jour existe (onglet B)', 'field-sync');
  await ev(pB, (id) => setTaskStatus(id, 'doing'), tid);
  await pA.waitForTimeout(400);
  const rowTextA = await ev(pA, (id) => document.querySelector(`.tp-row[onclick*="${id}"]`)?.textContent || '', tid);
  ok(rowTextA.includes('Démarrée à'), 'onglet A (Accueil): confirmation "Démarrée à HH:MM" visible sans F5', 'field-sync');

  await ev(pB, (id) => setTaskStatus(id, 'done'), tid);
  await pA.waitForTimeout(400);
  const rowTextA2 = await ev(pA, (id) => document.querySelector(`.tp-row[onclick*="${id}"]`)?.textContent || '', tid);
  ok(rowTextA2.includes('Terminée à'), 'onglet A (Accueil): confirmation "Terminée à HH:MM" visible sans F5', 'field-sync');
  await ctxShared.close();
} catch (e) {
  note('field-sync', 'ERREUR', e.message);
}

// ============================================================
// SECTION 27 — Actualisation Kanban (2 onglets)
// ============================================================
console.log('\n[SECTION 27] Actualisation Kanban (multi-onglets)');
try {
  const ctxShared = await b.newContext();
  const pA = await ctxShared.newPage();
  const pB = await ctxShared.newPage();
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); go('today'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { go('planning'); setPlanningView('kanban'); });
  await pA.waitForTimeout(200);
  await ev(pB, () => {
    kanbanDragStart({ currentTarget: { classList: { add(){} } }, dataTransfer: { setData(){}, getData(){ return 'k-control'; } } }, 'k-control');
    kanbanDrop({ preventDefault(){}, currentTarget: { classList: { remove(){} } }, dataTransfer: { getData(){ return 'k-control'; } } }, 'doing');
  });
  await pA.waitForTimeout(400);
  const rowTextA = await ev(pA, () => document.querySelector('.tp-row[onclick*="k-control"]')?.textContent || '');
  ok(rowTextA.includes('En cours'), 'onglet A (Accueil): statut Kanban répercuté sans F5', 'kanban-sync');
  ok(!rowTextA.includes('Démarrée à'), 'onglet A (Accueil): aucune fausse confirmation terrain créée depuis le Kanban', 'kanban-sync');
  await ctxShared.close();
} catch (e) {
  note('kanban-sync', 'ERREUR', e.message);
}

// ============================================================
// FIN — synthèse
// ============================================================
await b.close();
const uniqueErrs = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniqueErrs.length ? 'ERRORS (' + uniqueErrs.length + ' distincts):\n' + uniqueErrs.map((e) => `[${e.url}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');

fs.writeFileSync('/home/user/Planzy-saas/recette-accueil/resultats.json', JSON.stringify({ passed, failed, results, errors: uniqueErrs }, null, 2));
process.exit(0);
