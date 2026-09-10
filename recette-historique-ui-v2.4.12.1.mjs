// ============================================================
// KANVIX — Recette UI timeline Historique chantier (V2.4.12.1)
//   Usage : node recette-historique-ui-v2.4.12.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.12.1.html' + NOW;
const BASELINE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.12.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-historique-ui-v2.4.12.1/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
const allErrs = [];
async function newPage(w = 1440, h = 950, tag = 'x', url = FILE) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(url, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// Jeu de données couvrant tous les cas de rendu de la timeline.
const DATASET = `
  resetApp();
  setDepth('pilot');
  const kTasks = app.tasks.filter((t) => t.projectId === 'keravel');
  const T1 = kTasks.find((t) => t.id === 'k-electric') || kTasks[0];
  const T2 = kTasks.find((t) => t.id === 'k-windows') || kTasks[1];
  const vTask = app.tasks.find((t) => t.projectId === 'villa');
  app.history = [
    // taskId valide → bouton « Voir la tâche »
    { date: '22:11', text: T1.name + ' · commencée', author: 'Eric', taskId: T1.id },
    // changes + comment
    { date: '21:18', text: T2.name + ' modifiée.', author: 'Eric', taskId: T2.id,
      changes: [{ field: 'Début', from: '3 sept.', to: '5 sept.' }, { field: 'Ressource', from: 'Thomas', to: 'Mathieu' }],
      comment: 'Décalage validé avec le client.' },
    // projectId seul → aucune action tâche
    { date: '21:02', text: 'Incident « Accès étage » résolu', author: 'Eric', projectId: 'keravel' },
    // taskId supprimé → aucun bouton, aucune erreur
    { date: '20:40', text: 'Événement sur tâche disparue', author: 'Kanvix', projectId: 'keravel', taskId: 'tache-supprimee-xyz' },
    // sourceTaskId seul → bouton « Voir la tâche source »
    { date: '20:05', text: 'Replanification en cascade', author: 'Kanvix', sourceTaskId: T1.id },
    // date non parsable → l'événement n'est jamais perdu
    { date: 'hier', text: 'Entrée à date illisible', author: 'Eric', projectId: 'keravel' },
    // autre chantier → ne doit jamais apparaître dans Keravel
    { date: '19:00', text: 'EVT-VILLA', author: 'Eric', taskId: vTask.id },
    // entrée globale → absente de toute fiche chantier
    { date: '18:30', text: 'Modèle d’entreprise créé — Test', author: 'Eric' },
  ];
  save();
  app.ui.projectId = 'keravel';
  openProjectTab('keravel', 'Historique');
`;
const setup = async (p, extra = '') => { await ev(p, (src) => (0, eval)(src), DATASET + extra); await p.waitForTimeout(280); };

// ---- HIST-UI-01 : timeline, plus de .row générique ----
console.log('\n[HIST-UI-01] Timeline en place, plus de .row');
{
  const { ctx, p } = await newPage(1440, 950, 'UI01');
  await setup(p);
  const r = await ev(p, () => {
    const main = document.querySelector('.main');
    return {
      panel: !!main.querySelector('.history-panel'),
      header: !!main.querySelector('.history-header'),
      list: !!main.querySelector('.history-list'),
      events: main.querySelectorAll('.history-event').length,
      rails: main.querySelectorAll('.history-rail').length,
      dots: main.querySelectorAll('.history-dot').length,
      genericRows: main.querySelectorAll('.history-panel .row').length,
      count: main.querySelector('.history-count')?.textContent.trim(),
      expected: projectHistory('keravel').length,
    };
  });
  note('HIST-UI-01', r);
  ok(r.panel && r.header && r.list, 'HIST-UI-01 : structure .history-panel / .history-header / .history-list présente', 'HIST-UI-01');
  ok(r.genericRows === 0, 'HIST-UI-01 : aucun `.row` générique dans l’historique (§1/§75)', 'HIST-UI-01');
  ok(r.events === r.expected && r.events > 0, 'HIST-UI-01 : un .history-event par entrée filtrée', 'HIST-UI-01');
  ok(r.rails === r.events && r.dots === r.events, 'HIST-UI-01 : rail + pastille sur chaque événement (§11)', 'HIST-UI-01');
  ok(r.count === `${r.expected} événements`, `HIST-UI-01 : compteur = projectHistory().length (§9) — « ${r.count} »`, 'HIST-UI-01');
  await ctx.close();
}

// ---- HIST-UI-02 : cursor default (fausse affordance supprimée) ----
console.log('\n[HIST-UI-02] cursor: default sur les événements');
{
  const { ctx, p } = await newPage(1440, 950, 'UI02');
  await setup(p);
  const r = await ev(p, () => {
    const evs = [...document.querySelectorAll('.history-event')];
    const cursors = evs.map((e) => getComputedStyle(e).cursor);
    const bodies = evs.map((e) => getComputedStyle(e.querySelector('.history-event-body')).cursor);
    const titles = evs.map((e) => getComputedStyle(e.querySelector('.history-event-title')).cursor);
    const btns = [...document.querySelectorAll('.history-task-link')].map((e) => getComputedStyle(e).cursor);
    // hover simulé sur le fond d'un événement
    const first = evs[0];
    const bgBefore = getComputedStyle(first.querySelector('.history-event-body')).backgroundColor;
    first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const bgAfter = getComputedStyle(first.querySelector('.history-event-body')).backgroundColor;
    return { cursors: [...new Set(cursors)], bodies: [...new Set(bodies)], titles: [...new Set(titles)], btns: [...new Set(btns)], hoverStable: bgBefore === bgAfter };
  });
  note('HIST-UI-02', r);
  ok(r.cursors.every((c) => c === 'default'), 'HIST-UI-02 : cursor: default sur chaque .history-event', 'HIST-UI-02');
  ok(r.bodies.every((c) => c === 'default') && r.titles.every((c) => c === 'default'), 'HIST-UI-02 : corps et titre non cliquables — pas de main (§68)', 'HIST-UI-02');
  ok(r.btns.length > 0 && r.btns.every((c) => c === 'pointer'), 'HIST-UI-02 : seul « Voir la tâche » affiche la main', 'HIST-UI-02');
  ok(r.hoverStable, 'HIST-UI-02 : aucun hover suggérant un lien sur le fond de l’événement (§35)', 'HIST-UI-02');
  // .row reste inchangé pour les autres écrans (§75)
  // §75 — la règle générique n'a PAS été supprimée : elle reste en place pour
  // les écrans où la ligne est réellement cliquable. On la vérifie à la fois
  // dans la feuille de style et sur un élément vivant.
  const rowIntact = await ev(p, () => {
    let ruleFound = false;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const r of rules) {
        if (r.selectorText === '.row' && r.style.cursor === 'pointer') ruleFound = true;
      }
    }
    // Élément vivant : on injecte une ligne .row hors historique et on mesure.
    const probe = document.createElement('div');
    probe.className = 'row';
    document.querySelector('.main').appendChild(probe);
    const live = getComputedStyle(probe).cursor;
    probe.remove();
    return { ruleFound, live };
  });
  note('HIST-UI-02', { rowIntact });
  ok(rowIntact.ruleFound && rowIntact.live === 'pointer', 'HIST-UI-02 : `.row { cursor: pointer }` conservé pour les écrans où la ligne est réellement cliquable (§75)', 'HIST-UI-02');
  await ctx.close();
}

// ---- HIST-UI-03 : bouton présent quand taskId valide ----
console.log('\n[HIST-UI-03] Bouton « Voir la tâche »');
{
  const { ctx, p } = await newPage(1440, 950, 'UI03');
  await setup(p);
  const r = await ev(p, () => {
    const map = [...document.querySelectorAll('.history-event')].map((e) => ({
      title: e.querySelector('.history-event-title').textContent.trim(),
      btn: e.querySelector('.history-task-link')?.textContent.trim() || null,
      tag: e.querySelector('.history-task-link')?.tagName || null,
      type: e.querySelector('.history-task-link')?.getAttribute('type') || null,
    }));
    return map;
  });
  note('HIST-UI-03', r);
  const withBtn = r.filter((x) => x.btn);
  ok(withBtn.length >= 3, 'HIST-UI-03 : les événements à tâche valide portent un bouton', 'HIST-UI-03');
  ok(withBtn.every((x) => x.tag === 'BUTTON' && x.type === 'button'), 'HIST-UI-03 : vrai <button type="button">, pas un div onclick (§36)', 'HIST-UI-03');
  ok(r.some((x) => /Voir la tâche source/.test(x.btn || '')), 'HIST-UI-03 : « Voir la tâche source » pour une entrée sourceTaskId seule (§23)', 'HIST-UI-03');
  await ctx.close();
}

// ---- HIST-UI-04 : clic réel ouvre la BONNE tâche ----
console.log('\n[HIST-UI-04] Clic réel → bonne tâche');
{
  const { ctx, p } = await newPage(1440, 950, 'UI04');
  await setup(p);
  for (const name of ['Tableau électrique', 'Pose des 6 fenêtres']) {
    const idx = await ev(p, (n) => [...document.querySelectorAll('.history-event')].findIndex((e) => e.querySelector('.history-event-title').textContent.includes(n)), name);
    ok(idx >= 0, `HIST-UI-04 : l’événement « ${name} » est présent`, 'HIST-UI-04');
    const btn = p.locator('.history-event').nth(idx).locator('.history-task-link');
    await btn.click();
    await p.waitForTimeout(260);
    const opened = await ev(p, () => ({
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      title: document.querySelector('#drawerContent h2')?.textContent.trim(),
      selected: app.ui.selectedTask,
    }));
    note('HIST-UI-04', { name, ...opened });
    ok(opened.drawerOpen, `HIST-UI-04 : la fiche s’ouvre pour « ${name} »`, 'HIST-UI-04');
    ok(opened.title === name, `HIST-UI-04 : c’est bien la BONNE tâche (« ${opened.title} »)`, 'HIST-UI-04');
    if (name === 'Tableau électrique') await p.screenshot({ path: SHOTS + '05-history-task-action.png', fullPage: true });
    await ev(p, () => closeOverlay('drawer'));
    await p.waitForTimeout(200);
  }
  await ctx.close();
}

// ---- HIST-UI-05 : retour à l'onglet Historique ----
console.log('\n[HIST-UI-05] Retour sur l’onglet Historique');
{
  const { ctx, p } = await newPage(1440, 950, 'UI05');
  await setup(p);
  const before = await ev(p, () => ({ page: app.ui.page, tab: document.querySelector('.tab.active')?.textContent.trim(), events: document.querySelectorAll('.history-event').length }));
  await p.locator('.history-task-link').first().click();
  await p.waitForTimeout(250);
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(250);
  const after = await ev(p, () => ({ page: app.ui.page, tab: document.querySelector('.tab.active')?.textContent.trim(), events: document.querySelectorAll('.history-event').length, drawerOpen: document.querySelector('#drawer').classList.contains('open') }));
  note('HIST-UI-05', { before, after });
  ok(after.page === 'project' && before.page === 'project', 'HIST-UI-05 : app.ui.page reste « project » (§39)', 'HIST-UI-05');
  ok(after.tab === 'Historique', 'HIST-UI-05 : l’onglet Historique est toujours actif', 'HIST-UI-05');
  ok(after.events === before.events && !after.drawerOpen, 'HIST-UI-05 : la timeline est intacte après fermeture', 'HIST-UI-05');
  await ctx.close();
}

// ---- HIST-UI-06 / 07 : projectId seul, taskId invalide ----
console.log('\n[HIST-UI-06/07] Aucun faux bouton');
{
  const { ctx, p } = await newPage(1440, 950, 'UI0607');
  await setup(p);
  const r = await ev(p, () => {
    const find = (txt) => [...document.querySelectorAll('.history-event')].find((e) => e.querySelector('.history-event-title').textContent.includes(txt));
    const projOnly = find('Accès étage');
    const dead = find('tâche disparue');
    const unreadable = find('date illisible');
    return {
      projOnlyVisible: !!projOnly, projOnlyBtn: !!projOnly?.querySelector('.history-task-link'),
      deadVisible: !!dead, deadBtn: !!dead?.querySelector('.history-task-link'),
      unreadableVisible: !!unreadable, unreadableTime: unreadable?.querySelector('.history-time').textContent.trim(),
    };
  });
  note('HIST-UI-06/07', r);
  ok(r.projOnlyVisible && !r.projOnlyBtn, 'HIST-UI-06 : entrée projectId seul → visible, aucun bouton tâche (§24)', 'HIST-UI-06');
  ok(r.deadVisible && !r.deadBtn, 'HIST-UI-07 : taskId supprimé → événement visible, aucun bouton mort (§22)', 'HIST-UI-07');
  ok(r.unreadableVisible, 'HIST-UI-07 : date illisible → événement JAMAIS perdu (§7)', 'HIST-UI-07');
  ok(r.unreadableTime === 'hier', 'HIST-UI-07 : la valeur brute est affichée telle quelle', 'HIST-UI-07');
  await ctx.close();
}

// ---- HIST-UI-08 / 09 : regroupement par jour ----
console.log('\n[HIST-UI-08/09] Regroupement par date');
{
  const { ctx, p } = await newPage(1440, 950, 'UI0809');
  // 5 événements le même jour
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = [0, 1, 2, 3, 4].map((i) => ({ date: `2026-09-10T1${i}:30`, text: 'Evenement J1 ' + i, author: 'Eric', taskId: t.id }));
    save(); app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique');
  });
  await p.waitForTimeout(280);
  const one = await ev(p, () => ({
    days: document.querySelectorAll('.history-day').length,
    labels: [...document.querySelectorAll('.history-day-label')].map((x) => x.textContent.trim()),
    events: document.querySelectorAll('.history-event').length,
    times: [...document.querySelectorAll('.history-time')].map((x) => x.textContent.trim()),
  }));
  note('HIST-UI-08', one);
  ok(one.days === 1 && one.labels.length === 1, 'HIST-UI-08 : 5 événements du même jour → UNE seule date de groupe (§4)', 'HIST-UI-08');
  ok(one.events === 5 && one.times.length === 5, 'HIST-UI-08 : chaque événement garde son heure en colonne (§5)', 'HIST-UI-08');
  ok(one.times.every((t) => /^\d{2}:\d{2}$/.test(t)), 'HIST-UI-08 : heures au format HH:MM', 'HIST-UI-08');

  // Deux jours
  await ev(p, () => {
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = [
      { date: '2026-09-10T18:00', text: 'Evenement J2 a', author: 'Eric', taskId: t.id },
      { date: '2026-09-10T09:15', text: 'Evenement J2 b', author: 'Eric', taskId: t.id },
      { date: '2026-09-09T17:40', text: 'Evenement J1 a', author: 'Eric', taskId: t.id },
    ];
    save(); openProjectTab('keravel', 'Historique');
  });
  await p.waitForTimeout(280);
  const two = await ev(p, () => ({
    days: document.querySelectorAll('.history-day').length,
    labels: [...document.querySelectorAll('.history-day-label')].map((x) => x.textContent.trim()),
    perDay: [...document.querySelectorAll('.history-day')].map((d) => d.querySelectorAll('.history-event').length),
    order: [...document.querySelectorAll('.history-event-title')].map((x) => x.textContent.trim()),
  }));
  note('HIST-UI-09', two);
  ok(two.days === 2, 'HIST-UI-09 : deux journées → deux groupes distincts', 'HIST-UI-09');
  ok(JSON.stringify(two.perDay) === JSON.stringify([2, 1]), 'HIST-UI-09 : 2 événements le premier jour, 1 le second', 'HIST-UI-09');
  ok(JSON.stringify(two.order) === JSON.stringify(['Evenement J2 a', 'Evenement J2 b', 'Evenement J1 a']), 'HIST-UI-09 : ordre chronologique de app.history strictement conservé (§47/§48)', 'HIST-UI-09');
  ok(two.labels.length === 2 && two.labels[0] !== two.labels[1], 'HIST-UI-09 : deux libellés de date différents', 'HIST-UI-09');
  await ctx.close();
}

// ---- HIST-UI-10 : changes + comment ----
console.log('\n[HIST-UI-10] changes et comment conservés');
{
  const { ctx, p } = await newPage(1440, 950, 'UI10');
  await setup(p);
  const r = await ev(p, () => {
    const e = [...document.querySelectorAll('.history-event')].find((x) => x.querySelector('.history-changes'));
    return {
      found: !!e,
      changes: [...(e?.querySelectorAll('.history-change') || [])].map((c) => c.querySelector('dt').textContent.trim() + ' | ' + c.querySelector('dd').textContent.replace(/\s+/g, ' ').trim()),
      comment: e?.querySelector('.history-event-detail')?.textContent.trim(),
      author: e?.querySelector('.history-event-meta')?.textContent.trim(),
      noLegacyList: !document.querySelector('.history-panel .ta-changes'),
    };
  });
  note('HIST-UI-10', r);
  ok(r.found && r.changes.length === 2, 'HIST-UI-10 : les deux différences sont rendues (§16)', 'HIST-UI-10');
  ok(r.changes[0].includes('Début') && r.changes[0].includes('3 sept.') && r.changes[0].includes('5 sept.'), 'HIST-UI-10 : avant → après lisible', 'HIST-UI-10');
  ok(r.comment === 'Décalage validé avec le client.', 'HIST-UI-10 : le commentaire est conservé (§17)', 'HIST-UI-10');
  ok(r.author === 'Eric', 'HIST-UI-10 : l’auteur est affiché tel quel, jamais réinventé (§18)', 'HIST-UI-10');
  ok(r.noLegacyList, 'HIST-UI-10 : plus de liste .ta-changes lourde dans l’historique', 'HIST-UI-10');
  await p.screenshot({ path: SHOTS + '07-history-changes-comment.png', fullPage: true });
  await ctx.close();
}

// ---- HIST-UI-11 / 12 : SITE-01 non régressé ----
console.log('\n[HIST-UI-11/12] SITE-01 toujours fermé');
{
  const { ctx, p } = await newPage(1440, 950, 'UI1112');
  await setup(p);
  const r = await ev(p, () => {
    const k = projectTabContent('Historique', 'keravel');
    const v = projectTabContent('Historique', 'villa');
    return {
      keravelGlobal: /Modèle d’entreprise créé/.test(k),
      keravelVilla: /EVT-VILLA/.test(k),
      villaKeravel: /commencée/.test(v),
      identical: k === v,
      villaHasOwn: /EVT-VILLA/.test(v),
      engineIntact: typeof historyProjectId === 'function' && typeof projectHistory === 'function',
    };
  });
  note('HIST-UI-11/12', r);
  ok(!r.keravelGlobal, 'HIST-UI-11 : entrée globale toujours absente de la fiche chantier', 'HIST-UI-11');
  ok(!r.keravelVilla && !r.villaKeravel, 'HIST-UI-12 : aucune fuite Keravel ↔ Villa', 'HIST-UI-12');
  ok(!r.identical && r.villaHasOwn, 'HIST-UI-12 : chaque chantier a son propre historique', 'HIST-UI-12');
  ok(r.engineIntact, 'HIST-UI-12 : historyProjectId / projectHistory toujours en place (§40)', 'HIST-UI-12');
  // Fiche tâche : pas de retour de l'historique global (§42)
  const fiche = await ev(p, () => { openTask('k-electric'); const h = document.querySelector('#drawerContent').innerHTML; return { suivi: /Suivi de la tâche/.test(h), panel: (h.match(/history-panel/g) || []).length }; });
  ok(fiche.suivi && fiche.panel === 0, 'HIST-UI-12 : la fiche tâche ne réintroduit pas l’historique global (§42)', 'HIST-UI-12');
  await ctx.close();
}

// ---- HIST-UI-13 : dark mode ----
console.log('\n[HIST-UI-13] Dark mode');
{
  const { ctx, p } = await newPage(1440, 1000, 'UI13');
  await setup(p, `app.settings.theme = 'dark'; document.body.classList.add('dark'); save(); openProjectTab('keravel','Historique');`);
  const r = await ev(p, () => {
    const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundColor, fg: cs.color }; };
    const body = document.querySelector('.history-event-body');
    const parse = (c) => (c.match(/\d+/g) || []).map(Number);
    const bodyBg = parse(getComputedStyle(body).backgroundColor);
    return {
      dark: document.body.classList.contains('dark'),
      panel: g('.history-panel'), evBody: g('.history-event-body'), time: g('.history-time'),
      meta: g('.history-event-meta'), btn: g('.history-task-link'),
      dot: getComputedStyle(document.querySelector('.history-dot')).backgroundColor,
      rail: getComputedStyle(document.querySelector('.history-rail'), '::before').backgroundColor,
      changesOk: !!document.querySelector('.history-changes'),
      whiteFlat: bodyBg[0] > 240 && bodyBg[1] > 240 && bodyBg[2] > 240,
    };
  });
  note('HIST-UI-13', r);
  ok(r.dark, 'HIST-UI-13 : la vue est bien en mode sombre', 'HIST-UI-13');
  ok(!r.whiteFlat, 'HIST-UI-13 : aucun aplat blanc forcé sur les événements (§34)', 'HIST-UI-13');
  ok(r.time && r.meta && r.btn && r.changesOk, 'HIST-UI-13 : heure, auteur, bouton et différences tous rendus en sombre', 'HIST-UI-13');
  // Libellé de journée en sombre : nécessite une donnée réellement datée.
  const darkDay = await ev(p, () => {
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = [{ date: '2026-09-10T18:00', text: 'Evt daté', author: 'Eric', taskId: t.id }];
    save(); openProjectTab('keravel', 'Historique');
    const l = document.querySelector('.history-day-label');
    return l ? { txt: l.textContent.trim(), fg: getComputedStyle(l).color } : null;
  });
  note('HIST-UI-13', { darkDay });
  ok(darkDay && /2026/.test(darkDay.txt), 'HIST-UI-13 : date de groupe lisible en mode sombre', 'HIST-UI-13');
  ok(r.evBody.fg !== r.evBody.bg && r.btn.fg !== r.btn.bg, 'HIST-UI-13 : textes lisibles (couleur ≠ fond)', 'HIST-UI-13');
  await p.screenshot({ path: SHOTS + '06-history-dark.png', fullPage: true });
  await ctx.close();
}

// ---- HIST-UI-14 : responsive ----
console.log('\n[HIST-UI-14] Responsive');
{
  for (const w of [1920, 1440, 1280, 900, 768, 430, 390]) {
    const { ctx, p } = await newPage(w, 1000, 'UI14-' + w);
    await setup(p);
    const r = await ev(p, () => {
      const main = document.querySelector('.main'), mr = main.getBoundingClientRect();
      let over = 0;
      main.querySelectorAll('.history-event, .history-panel').forEach((e) => {
        const b = e.getBoundingClientRect();
        if (b.right > mr.right + 1 || b.left < mr.left - 1) over++;
      });
      return {
        events: main.querySelectorAll('.history-event').length,
        over,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        railVisible: getComputedStyle(main.querySelector('.history-rail')).display !== 'none',
      };
    });
    note('HIST-UI-14', { w, ...r });
    ok(r.events > 0, `HIST-UI-14 : ${w}px — la timeline est rendue`, 'HIST-UI-14');
    ok(r.over === 0 && !r.hscroll, `HIST-UI-14 : ${w}px — aucun débordement, 0 scroll horizontal (§33)`, 'HIST-UI-14');
    if (w >= 768) ok(r.railVisible, `HIST-UI-14 : ${w}px — rail visible (3 zones, §31)`, 'HIST-UI-14');
    else ok(!r.railVisible, `HIST-UI-14 : ${w}px — pas de colonne gauche coûteuse sur petit écran (§33)`, 'HIST-UI-14');
    const shots = { 1920: '01-history-1920.png', 1440: '02-history-1440.png', 900: '03-history-900.png', 390: '04-history-390.png' };
    if (shots[w]) await p.screenshot({ path: SHOTS + shots[w], fullPage: true });
    await ctx.close();
  }
}

// ---- HIST-UI-15 : navigation clavier ----
console.log('\n[HIST-UI-15] Clavier');
{
  const { ctx, p } = await newPage(1440, 950, 'UI15');
  await setup(p);
  const focused = await ev(p, () => {
    const btn = document.querySelector('.history-task-link');
    btn.focus();
    return { tag: document.activeElement.tagName, isBtn: document.activeElement === btn, txt: document.activeElement.textContent.trim() };
  });
  note('HIST-UI-15', focused);
  ok(focused.isBtn && focused.tag === 'BUTTON', 'HIST-UI-15 : le bouton est atteignable au clavier (focus natif)', 'HIST-UI-15');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(260);
  const opened = await ev(p, () => ({ open: document.querySelector('#drawer').classList.contains('open'), title: document.querySelector('#drawerContent h2')?.textContent.trim() }));
  note('HIST-UI-15', opened);
  ok(opened.open && opened.title === 'Tableau électrique', 'HIST-UI-15 : Entrée ouvre la bonne tâche', 'HIST-UI-15');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(200);
  await ev(p, () => document.querySelector('.history-task-link').focus());
  await p.keyboard.press('Space');
  await p.waitForTimeout(260);
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'HIST-UI-15 : Espace active également le bouton', 'HIST-UI-15');
  await ctx.close();
}

// ---- HIST-UI-16 : aucun élément non interactif faussement actionnable ----
console.log('\n[HIST-UI-16] Aucune fausse interactivité');
{
  const { ctx, p } = await newPage(1440, 950, 'UI16');
  await setup(p);
  const r = await ev(p, () => {
    const evs = [...document.querySelectorAll('.history-event')];
    const bad = [];
    evs.forEach((e) => {
      [e, ...e.querySelectorAll('*')].forEach((n) => {
        if (n.closest && n.closest('.history-task-link')) return;
        if (n.hasAttribute('onclick')) bad.push('onclick:' + n.className);
        if (n.getAttribute('role') === 'button') bad.push('role:' + n.className);
        if (n.hasAttribute('tabindex')) bad.push('tabindex:' + n.className);
        if (getComputedStyle(n).cursor === 'pointer') bad.push('pointer:' + n.className);
      });
    });
    const focusables = [...document.querySelector('.history-panel').querySelectorAll('a,button,[tabindex],input,select')];
    return { bad, focusables: focusables.map((f) => f.className) };
  });
  note('HIST-UI-16', r);
  ok(r.bad.length === 0, 'HIST-UI-16 : aucun onclick / role=button / tabindex / cursor:pointer sur un élément non interactif', 'HIST-UI-16');
  ok(r.focusables.every((c) => c.includes('history-task-link')), 'HIST-UI-16 : les seuls éléments focusables sont les boutons « Voir la tâche »', 'HIST-UI-16');
  await ctx.close();
}

// ---- HIST-DENSITY : densité avant / après ----
console.log('\n[HIST-DENSITY] Densité V2.4.12 → V2.4.12.1');
{
  const SAME = `
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = Array.from({ length: 10 }, (_, i) => ({ date: '2' + (2 - Math.floor(i / 5)) + ':' + String(10 + i).padStart(2, '0'), text: t.name + ' · événement ' + i, author: 'Eric', taskId: t.id }));
    save(); app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique');
  `;
  const measure = async (url, tag) => {
    const { ctx, p } = await newPage(1440, 1000, tag, url);
    await ev(p, (s) => (0, eval)(s), SAME);
    await p.waitForTimeout(280);
    const m = await ev(p, () => {
      const items = document.querySelectorAll('.history-event, .main .section .row');
      const hs = [...items].map((e) => e.getBoundingClientRect().height);
      const first = items[0].getBoundingClientRect().top, last = items[items.length - 1].getBoundingClientRect().bottom;
      return { n: items.length, avg: Math.round(hs.reduce((a, x) => a + x, 0) / hs.length), total: Math.round(last - first) };
    });
    await ctx.close();
    return m;
  };
  const before = await measure(BASELINE, 'DENS-before');
  const after = await measure(FILE, 'DENS-after');
  const gain = Math.round((1 - after.total / before.total) * 100);
  note('HIST-DENSITY', { v2412: before, v24121: after, gainPct: gain });
  ok(before.n === 10 && after.n === 10, 'HIST-DENSITY : 10 événements identiques des deux côtés', 'HIST-DENSITY');
  ok(after.avg < before.avg, `HIST-DENSITY : hauteur moyenne par événement réduite (${before.avg}px → ${after.avg}px)`, 'HIST-DENSITY');
  ok(after.total < before.total, `HIST-DENSITY : hauteur totale réduite de ${gain}% (${before.total}px → ${after.total}px)`, 'HIST-DENSITY');
  ok(after.avg >= 50 && after.avg <= 110, `HIST-DENSITY : événement simple compact sans être illisible (${after.avg}px)`, 'HIST-DENSITY');
}

// ---- HIST-VOLUME : 1 / 50 / 1000 événements ----
console.log('\n[HIST-VOLUME] 1, 50 et 1000 événements');
{
  const { ctx, p } = await newPage(1440, 1000, 'VOL');
  const one = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = [{ date: '09:00', text: 'Unique événement', author: 'Eric', taskId: t.id }];
    save(); app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique');
    return { panel: !!document.querySelector('.history-panel'), events: document.querySelectorAll('.history-event').length, count: document.querySelector('.history-count').textContent.trim() };
  });
  await p.waitForTimeout(200);
  note('HIST-VOLUME', { one });
  ok(one.panel && one.events === 1, 'HIST-VOLUME : 1 événement → même structure timeline (§44)', 'HIST-VOLUME');
  ok(one.count === '1 événement', 'HIST-VOLUME : compteur au singulier', 'HIST-VOLUME');

  const fifty = await ev(p, () => {
    const t = app.tasks.find((x) => x.projectId === 'keravel');
    app.history = Array.from({ length: 50 }, (_, i) => ({ date: '2026-09-1' + (i % 2) + 'T10:' + String(i % 60).padStart(2, '0'), text: 'Evt ' + i, author: 'Eric', taskId: t.id }));
    save(); openProjectTab('keravel', 'Historique');
    return { events: document.querySelectorAll('.history-event').length, days: document.querySelectorAll('.history-day').length };
  });
  await p.waitForTimeout(250);
  note('HIST-VOLUME', { fifty });
  ok(fifty.events === 50, 'HIST-VOLUME : 50 événements tous rendus (§45)', 'HIST-VOLUME');

  const thousand = await ev(p, () => {
    resetApp(); setDepth('pilot');
    const src = project('keravel'), srcTask = app.tasks.filter((t) => t.projectId === 'keravel')[0];
    for (let i = 0; i < 30; i++) {
      app.projects.push({ ...structuredClone(src), id: 'perf-' + i, name: 'Chantier perf ' + i });
      app.tasks.push({ ...structuredClone(srcTask), id: 'perf-t-' + i, projectId: 'perf-' + i, name: 'Tache perf ' + i, deps: [] });
    }
    app.history = Array.from({ length: 1000 }, (_, i) => (i % 7 === 0
      ? { date: '09:00', text: 'Global ' + i, author: 'Eric' }
      : { date: '09:00', text: 'Evt ' + i, author: 'Eric', taskId: 'perf-t-' + (i % 30) }));
    save();
    const t0 = performance.now();
    const html = historyHTML({ projectId: 'perf-7' });
    const ms = performance.now() - t0;
    const expected = app.history.filter((h) => h.taskId === 'perf-t-7').length;
    return { ms: Math.round(ms), rendered: (html.match(/history-event /g) || []).length, expected };
  });
  note('HIST-VOLUME', { thousand });
  ok(thousand.rendered === thousand.expected, 'HIST-VOLUME : 1000 entrées / 30 chantiers — filtrage exact conservé (§46)', 'HIST-VOLUME');
  ok(thousand.ms < 300, `HIST-VOLUME : rendu performant (${thousand.ms} ms)`, 'HIST-VOLUME');
  await ctx.close();
}

// ---- HIST-PURE : aucun effet de bord ----
console.log('\n[HIST-PURE] Rendu sans effet de bord');
{
  const { ctx, p } = await newPage(1440, 950, 'PURE');
  await setup(p);
  const r = await ev(p, () => {
    const snap = () => JSON.stringify({ h: app.history, t: app.tasks.map((x) => x.id + x.status), p: app.projects.map((x) => x.id), i: app.issues.map((x) => x.id + x.status) });
    const before = snap();
    historyHTML({ projectId: 'keravel' });
    historyHTML({ projectId: 'villa' });
    historyHTML();
    app.history.forEach((h) => { historyStamp(h); historyEventTone(h); });
    return {
      pure: before === snap(),
      noPersistedType: !app.history.some((h) => 'eventType' in h || 'tone' in h),
      schema: SCHEMA_VERSION,
      store: Object.keys(localStorage).filter((k) => k.indexOf('kanvix') === 0),
    };
  });
  note('HIST-PURE', r);
  ok(r.pure, 'HIST-PURE : ouvrir l’historique ne modifie ni history, ni tasks, ni projects, ni issues (§49)', 'HIST-PURE');
  ok(r.noPersistedType, 'HIST-PURE : aucun eventType / tone persisté (§27)', 'HIST-PURE');
  ok(r.schema === 8 && r.store.every((k) => k === 'kanvix-product-8-3'), 'HIST-PURE : SCHEMA_VERSION et STORE inchangés (§74)', 'HIST-PURE');
  await ctx.close();
}

// ---- HIST-EMPTY ----
console.log('\n[HIST-EMPTY] État vide');
{
  const { ctx, p } = await newPage(1440, 950, 'EMPTY');
  const r = await ev(p, () => {
    resetApp(); setDepth('pilot');
    app.history = [{ date: '09:00', text: 'Autre chantier', author: 'Eric', projectId: 'villa' }];
    save(); app.ui.projectId = 'keravel'; openProjectTab('keravel', 'Historique');
    const main = document.querySelector('.main');
    return {
      empty: !!main.querySelector('.history-empty'),
      txt: main.querySelector('.history-empty p')?.textContent.trim(),
      events: main.querySelectorAll('.history-event').length,
      count: main.querySelector('.history-count')?.textContent.trim(),
      leak: /Autre chantier/.test(main.innerText),
    };
  });
  await p.waitForTimeout(200);
  note('HIST-EMPTY', r);
  ok(r.empty && r.txt === 'Aucune modification récente.', 'HIST-EMPTY : zone vide légère avec le libellé attendu (§43)', 'HIST-EMPTY');
  ok(r.events === 0 && !r.leak, 'HIST-EMPTY : jamais rempli avec les événements d’un autre chantier', 'HIST-EMPTY');
  ok(r.count === '0 événement', 'HIST-EMPTY : compteur à 0', 'HIST-EMPTY');
  await ctx.close();
}

// ---- CONSOLE ----
console.log('\n[CONSOLE]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE : 0 erreur JavaScript applicative', 'CONSOLE');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
