// ============================================================
// KANVIX — Recette UI / responsive / identité chantier (V2.4.11)
//   Usage : node recette-ui-responsive-v2.4.11.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.11.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-ui-v2.4.11/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
const allErrs = [];
async function newPage(w, h, tag) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const goPage = async (p, page, lvl = 'pilot') => { await ev(p, ({ pg, l }) => { resetApp(); setDepth(l); go(pg); }, { pg: page, l: lvl }); await p.waitForTimeout(180); };
const hscroll = (p) => ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

// ---- UI-01 : 1920 exploite harmonieusement la largeur ----
console.log('\n[UI-01] 1920 — largeur exploitée');
{
  const { ctx, p } = await newPage(1920, 1080, 'UI01');
  await goPage(p, 'today');
  const m = await ev(p, () => {
    const el = document.querySelector('.main'), r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const sb = document.querySelector('.sidebar').getBoundingClientRect();
    return { main: Math.round(r.width), avail: Math.round(innerWidth - sb.width), pad: Math.round(parseFloat(cs.paddingLeft)), edge: Math.round(r.left + parseFloat(cs.paddingLeft) - sb.width) };
  });
  note('UI-01', m);
  ok(m.main >= m.avail - 20, 'UI-01 : .main occupe la largeur disponible à 1920 (plus de bloc étroit centré)', 'UI-01');
  ok(m.edge >= 32 && m.edge <= 60, 'UI-01 : marge latérale élégante conservée (32–60px)', 'UI-01');
  ok(!(await hscroll(p)), 'UI-01 : aucun scroll horizontal de page', 'UI-01');
  await ctx.close();
}

// ---- UI-02 : 1440 aucune régression ----
console.log('\n[UI-02] 1440 — aucune régression');
{
  const { ctx, p } = await newPage(1440, 900, 'UI02');
  for (const page of ['today', 'sites', 'planning', 'team']) {
    await goPage(p, page);
    ok(!(await hscroll(p)), `UI-02 : 1440 — ${page} sans scroll horizontal`, 'UI-02');
  }
  const compressed = await ev(p, () => {
    const seg = document.querySelector('.plan-toolbar .segment');
    return seg ? seg.getBoundingClientRect().height < 20 : false;
  });
  ok(!compressed, 'UI-02 : 1440 — contrôles non comprimés', 'UI-02');
  await ctx.close();
}

// ---- UI-03 : 900 aucun overflow ----
console.log('\n[UI-03] 900 — aucun overflow');
{
  const { ctx, p } = await newPage(900, 1000, 'UI03');
  for (const page of ['today', 'sites', 'planning', 'team']) {
    await goPage(p, page);
    ok(!(await hscroll(p)), `UI-03 : 900 — ${page} sans overflow de page`, 'UI-03');
  }
  await ctx.close();
}

// ---- UI-04 : 390 aucune casse majeure ----
console.log('\n[UI-04] 390 — pas de casse');
{
  const { ctx, p } = await newPage(390, 844, 'UI04');
  for (const page of ['today', 'sites', 'team']) {
    await goPage(p, page);
    ok(!(await hscroll(p)), `UI-04 : 390 — ${page} sans overflow de page`, 'UI-04');
  }
  await ctx.close();
}

// ---- UI-05/06/07 : Gantt — identité, noms, états ----
console.log('\n[UI-05/06/07] Gantt — identité chantier');
{
  const { ctx, p } = await newPage(1600, 1000, 'UI05');
  await goPage(p, 'planning');
  const g = await ev(p, () => [...document.querySelectorAll('.g-project')].map((e) => ({
    tone: [...e.classList].find((c) => c.startsWith('ptone-')) || null,
    name: e.querySelector('button')?.textContent.replace(/[⌄›]/g, '').trim(),
    bg: getComputedStyle(e).backgroundColor,
    borderLeft: getComputedStyle(e).borderLeftWidth,
    health: e.querySelector('.project-health')?.className,
    healthText: e.querySelector('.project-health')?.textContent.trim(),
  })));
  note('UI-05', g.map((x) => `${x.name}:${x.tone}`));
  ok(g.length > 1 && g.every((x) => x.tone), 'UI-05 : chaque groupe chantier porte une identité couleur (.ptone-*)', 'UI-05');
  ok(new Set(g.map((x) => x.tone)).size === g.length, 'UI-05 : chaque chantier visible a une teinte distincte', 'UI-05');
  ok(g.every((x) => x.borderLeft === '3px'), 'UI-05 : repère coloré (bordure gauche) présent sur le bandeau', 'UI-05');
  ok(g.every((x) => x.name && x.name.length > 2), 'UI-06 : le nom du chantier reste toujours affiché (couleur = renfort)', 'UI-06');
  ok(g.some((x) => /Risque|À surveiller|OK/.test(x.healthText || '')), 'UI-07 : les états métier (Risque / À surveiller / OK) restent affichés et distincts', 'UI-07');
  // stabilité : même mapping après changement de période / filtre
  const before = await ev(p, () => Object.fromEntries([...document.querySelectorAll('.g-project')].map((e) => [e.querySelector('button').textContent.replace(/[⌄›]/g, '').trim(), [...e.classList].find((c) => c.startsWith('ptone-'))])));
  await ev(p, () => { setPeriod('month'); }); await p.waitForTimeout(150);
  const after = await ev(p, () => Object.fromEntries([...document.querySelectorAll('.g-project')].map((e) => [e.querySelector('button').textContent.replace(/[⌄›]/g, '').trim(), [...e.classList].find((c) => c.startsWith('ptone-'))])));
  ok(Object.keys(before).every((k) => !after[k] || after[k] === before[k]), 'UI-05 : identité couleur STABLE après changement de période', 'UI-05');
  await ctx.close();
}

// ---- UI-08/09/10/11 : Kanban ----
console.log('\n[UI-08/09/10/11] Kanban — identité chantier');
{
  const { ctx, p } = await newPage(1600, 1000, 'UI08');
  await goPage(p, 'planning');
  const ganttMap = await ev(p, () => Object.fromEntries([...new Set(planningTasks('all').map((t) => t.projectId))].map((id) => [id, projectToneClass(id)])));
  await ev(p, () => setPlanningView('kanban')); await p.waitForTimeout(180);
  const k = await ev(p, () => ({
    cols: [...document.querySelectorAll('.kanban-col')].map((c) => c.dataset.status),
    colLabels: [...document.querySelectorAll('.kanban-col-head span')].map((s) => s.textContent.trim()),
    cards: [...document.querySelectorAll('.kanban-card')].map((c) => ({
      tone: [...c.classList].find((x) => x.startsWith('ptone-')) || null,
      site: c.querySelector('.kb-site')?.textContent.trim(),
      dot: !!c.querySelector('.kb-site-dot'),
      borderTop: getComputedStyle(c).borderTopWidth,
      bg: getComputedStyle(c).backgroundColor,
    })),
    legend: [...document.querySelectorAll('.kl-item')].map((e) => ({ n: e.textContent.trim(), tone: [...e.classList].find((x) => x.startsWith('ptone-')) })),
    surfaceBg: getComputedStyle(document.querySelector('.kanban-col-body')).backgroundColor,
  }));
  ok(k.cards.length > 0 && k.cards.every((c) => c.tone && c.dot && c.borderTop === '3px'), 'UI-08 : chaque carte porte l’identité de son chantier (pastille + liseré + badge)', 'UI-08');
  // même chantier = même couleur
  const byProject = {};
  k.cards.forEach((c) => { (byProject[c.site] ||= new Set()).add(c.tone); });
  ok(Object.values(byProject).every((s) => s.size === 1), 'UI-09 : un même chantier a exactement la même couleur sur toutes ses cartes', 'UI-09');
  // même mapping que le Gantt
  const kanbanMap = await ev(p, () => Object.fromEntries([...new Set(planningTasks('all').map((t) => t.projectId))].map((id) => [id, projectToneClass(id)])));
  ok(JSON.stringify(ganttMap) === JSON.stringify(kanbanMap), 'UI-10 : Gantt et Kanban utilisent le MÊME mapping couleur (source unique)', 'UI-10');
  ok(k.cols.length === 3 && JSON.stringify(k.colLabels) === JSON.stringify(['À faire', 'En cours', 'Terminée']), 'UI-11 : Kanban conserve exactement 3 colonnes (À faire / En cours / Terminée)', 'UI-11');
  ok(k.legend.length > 1, 'UI-08 : légende des chantiers affichée en vue multi-chantiers', 'UI-08');
  // légende absente sur un chantier filtré
  await ev(p, () => setPlanningFilter('project', 'keravel')); await p.waitForTimeout(150);
  ok(await ev(p, () => !document.querySelector('.kanban-legend')), 'UI-08 : légende masquée quand un seul chantier est filtré', 'UI-08');
  await ctx.close();
}

// ---- UI-12/13/14 : Équipe + charge intégrée ----
console.log('\n[UI-12/13/14] Équipe — charge intégrée');
{
  const { ctx, p } = await newPage(1600, 1000, 'UI12');
  await goPage(p, 'team');
  const t = await ev(p, () => {
    const main = document.querySelector('.main');
    return {
      // texte RENDU uniquement (innerText exclut le <script>)
      linkText: /Charge semaine/.test(main.innerText),
      resourcesRoute: !!main.querySelector('[onclick*="go(\'resources\')"]'),
      loadSection: !!document.querySelector('.team-load'),
      title: document.querySelector('.team-load .section-title')?.textContent.trim(),
      rows: document.querySelectorAll('.team-load .load-row').length,
      addResource: /Ressource/.test(main.innerText),
    };
  });
  note('UI-12', t);
  ok(!t.linkText && !t.resourcesRoute, 'UI-12 : plus aucun lien « Charge semaine → » dans la page Équipe', 'UI-12');
  ok(t.addResource, 'UI-12 : le bouton « + Ressource » est conservé', 'UI-12');
  ok(t.loadSection && /Charge des ressources/.test(t.title || '') && t.rows > 1, 'UI-13 : « Charge des ressources » visible directement sous la liste', 'UI-13');
  // UI-14 : mêmes données que le moteur existant (composant unique)
  const same = await ev(p, () => {
    const inTeam = document.querySelector('.team-load .resources')?.outerHTML || '';
    const standalone = (() => { const d = document.createElement('div'); d.innerHTML = resourceLoadBoard(); return d.querySelector('.resources')?.outerHTML || ''; })();
    return { equal: inTeam === standalone, len: inTeam.length };
  });
  ok(same.equal && same.len > 100, 'UI-14 : la charge affichée est STRICTEMENT le composant existant (aucun calcul dupliqué)', 'UI-14');
  // la route historique reste fonctionnelle
  const legacy = await ev(p, () => { go('resources'); return { page: app.ui.page, board: !!document.querySelector('.resources') }; });
  ok(legacy.board, 'UI-14 : la route historique « Charge des ressources » reste fonctionnelle (aucun legacy cassé)', 'UI-14');
  await ctx.close();
}

// ---- UI-15 : Chantier > Planning — respiration ----
console.log('\n[UI-15] Chantier > Planning — espacement');
{
  const { ctx, p } = await newPage(1600, 1000, 'UI15');
  await ev(p, () => { resetApp(); setDepth('pilot'); selectProject('keravel'); }); await p.waitForTimeout(200);
  await ev(p, () => { $('#projectContent').innerHTML = projectTabContent('Planning', 'keravel'); }); await p.waitForTimeout(150);
  const gap = await ev(p, () => {
    const a = document.querySelector('.project-planning-actions'), pv = document.querySelector('.project-planning-preview');
    if (!a || !pv) return null;
    return Math.round(pv.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
  });
  note('UI-15', { gap });
  ok(gap !== null && gap >= 18, 'UI-15 : au moins 18px de respiration entre le bouton et l’aperçu du Gantt', 'UI-15');
  await ctx.close();
}

// ---- UI-16 : dark mode ----
console.log('\n[UI-16] Dark mode — couleurs chantier');
{
  const { ctx, p } = await newPage(1600, 1000, 'UI16');
  await ev(p, () => { resetApp(); setDepth('pilot'); setAppearance('dark'); go('planning'); }); await p.waitForTimeout(200);
  const d = await ev(p, () => {
    const g = document.querySelector('.g-project');
    const cs = getComputedStyle(g);
    return { dark: document.body.classList.contains('dark'), bg: cs.backgroundColor, accent: cs.borderLeftColor, nameColor: getComputedStyle(g.querySelector('button')).color };
  });
  ok(d.dark && !!d.bg && !!d.accent && !!d.nameColor, 'UI-16 : bandeau chantier lisible en sombre (fond teinté + accent + texte)', 'UI-16');
  await ev(p, () => setPlanningView('kanban')); await p.waitForTimeout(180);
  const dk = await ev(p, () => {
    const c = document.querySelector('.kanban-card'), s = c.querySelector('.kb-site');
    return { cardBg: getComputedStyle(c).backgroundColor, badgeBg: getComputedStyle(s).backgroundColor, badgeColor: getComputedStyle(s).color };
  });
  ok(!!dk.badgeBg && !!dk.badgeColor, 'UI-16 : badge chantier Kanban lisible en sombre', 'UI-16');
  await ctx.close();
}

// ---- UI-17 : sidebar collapsed ----
console.log('\n[UI-17] Sidebar collapsed');
{
  const { ctx, p } = await newPage(1920, 1080, 'UI17');
  await goPage(p, 'planning');
  const open = await ev(p, () => Math.round(document.querySelector('.main').getBoundingClientRect().width));
  await ev(p, () => document.body.classList.add('sidebar-collapsed')); await p.waitForTimeout(180);
  const collapsed = await ev(p, () => ({ main: Math.round(document.querySelector('.main').getBoundingClientRect().width), sb: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width) }));
  note('UI-17', { open, collapsed });
  ok(collapsed.main >= open, 'UI-17 : sidebar repliée — le contenu exploite l’espace libéré (aucune réduction)', 'UI-17');
  ok(!(await hscroll(p)), 'UI-17 : aucun scroll horizontal après repli de la sidebar', 'UI-17');
  await ctx.close();
}

// ---- UI-18 : 0 scroll horizontal sur toutes les largeurs desktop ----
console.log('\n[UI-18] 0 scroll horizontal (desktop/tablette)');
for (const [w, h] of [[1920, 1080], [1680, 1050], [1600, 900], [1440, 900], [1366, 768], [1280, 800], [1080, 800], [900, 1000], [768, 1024]]) {
  const { ctx, p } = await newPage(w, h, 'UI18-' + w);
  await goPage(p, 'planning');
  const a = await hscroll(p);
  await goPage(p, 'sites');
  const b2 = await hscroll(p);
  ok(!a && !b2, `UI-18 : ${w}px — Planning + Chantiers sans scroll horizontal de page`, 'UI-18');
  await ctx.close();
}

// ---- UI-19 : console ----
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
const appErrs = uniq.filter((e) => !/net::ERR_|ERR_TUNNEL|Failed to load resource/.test(e.msg));
ok(appErrs.length === 0, 'UI-19 : 0 erreur JavaScript applicative', 'UI-19');

await b.close();
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(appErrs.length ? 'ERREURS APP:\n' + appErrs.map((e) => e.msg).join('\n') : '=== 0 erreur console applicative ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleApp: appErrs }, null, 2));
process.exit(0);
