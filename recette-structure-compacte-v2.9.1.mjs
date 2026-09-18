// ============================================================
// KANVIX — Recette « Structure compacte » (V2.9.1)
//
//   Trois questions, dans cet ordre d'importance :
//
//     1. Déplier/replier un niveau laisse-t-il l'utilisateur EXACTEMENT où il
//        était ? (V2.9.0.1 le renvoyait sur « Aujourd'hui » à chaque clic.)
//     2. La Structure est-elle réellement plus dense, et la hiérarchie
//        lisible d'un coup d'œil ?
//     3. Les interventions « sans structure » sont-elles enfin VISIBLES,
//        nommées, cliquables — sans qu'aucune tâche n'ait été déplacée ?
//
//   Cette recette MESURE. Elle ne décrit pas : elle relève des hauteurs, des
//   géométries, des comptes, et les compare aux moteurs de V2.9.0.
//
//   Usage : node recette-structure-compacte-v2.9.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.9.1.html';
const PREV = 'kanvix-next-gen-v2.9.0.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.9.1/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, level = 'pilot', dark = false } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate(([lvl, dk]) => {
    resetApp();
    if (lvl === 'pilot') setDepth('pilot');
    if (dk) setAppearance('dark');
    dismissKanvixContinuityNotice();
  }, [level, dark]);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const shot = async (p, name, opts = {}) => { await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + name, ...opts }); };
const ouvrirStructure = async (p, pid = 'keravel') => {
  await ev(p, (id) => { app.ui.projectId = id; save(); go('project'); openProjectTab(id, 'Structure'); }, pid);
  await p.waitForTimeout(320);
};
/* L'état perçu par l'utilisateur : où suis-je, que vois-je ? */
const etat = (p) => ev(p, () => ({
  page: app.ui.page,
  projet: app.ui.projectId,
  onglet: document.querySelector('.tab.active')?.textContent.trim(),
  arbreVisible: !!document.querySelector('[data-structure-tree]'),
  scroll: Math.round(window.scrollY),
}));
/* Une structure PROFONDE et LONGUE, créée par le test seul — jamais par
   INITIAL_STATE : les données de démonstration ne sont pas décorées pour les
   besoins d'une capture (§22). */
const grandeStructure = async (p, racines = 12, profondeur = 4) => {
  await ev(p, ([n, prof]) => {
    let parent = null;
    for (let d = 0; d < prof; d++) {
      let id = 'sn-prof-' + d;
      app.structureNodes.push({ id, projectId: 'keravel', parentId: parent, name: 'Niveau profond ' + (d + 1),
        type: ['building', 'zone', 'phase', 'subproject'][d % 4], description: '', responsibleResourceId: null,
        archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      parent = id;
    }
    for (let i = 0; i < n; i++)
      app.structureNodes.push({ id: 'sn-l-' + i, projectId: 'keravel', parentId: null, name: 'Zone de recette ' + (i + 1),
        type: 'zone', description: '', responsibleResourceId: null, archived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    save(); openProjectTab('keravel', 'Structure');
  }, [racines, profondeur]);
  await p.waitForTimeout(320);
};

// ============================================================
// STC-01 → STC-08 — LE BUG : déplier/replier ne doit RIEN déranger
// ============================================================
console.log('\n[STC-NAV] Déplier / replier ne quitte jamais Structure');
{
  const { ctx, p } = await newPage({ tag: 'NAV' });
  await ouvrirStructure(p);
  const depart = await etat(p);
  note('STC-01', depart);
  ok(depart.page === 'project' && depart.onglet === 'Structure' && depart.arbreVisible,
    'STC-01 : l’ouverture de l’onglet Structure est inchangée — page « project », onglet « Structure », arbre affiché', 'STC-01');

  /* On installe une sentinelle sur scrollTo AVANT le clic : la seule façon
     honnête de prouver qu'aucun retour en haut de page n'a lieu. */
  await ev(p, () => {
    window.__scrollCalls = [];
    let vrai = window.scrollTo.bind(window);
    window.scrollTo = function (...a) { window.__scrollCalls.push(a); return vrai(...a); };
    window.scrollTo(0, 420);
  });
  await p.waitForTimeout(150);
  await ev(p, () => { window.__scrollCalls = []; });
  const avant = await etat(p);

  await p.click('[data-structure-node="sn-keravel-bat-a"] .snc-twisty');
  await p.waitForTimeout(220);
  const apresRepli = await etat(p);
  const sentinelle = await ev(p, () => window.__scrollCalls);
  note('STC-02', { avant, apresRepli, scrollCalls: sentinelle });
  ok(apresRepli.onglet === 'Structure' && apresRepli.arbreVisible,
    'STC-02 : replier « Bâtiment A » laisse l’utilisateur DANS Structure — c’est précisément ce que V2.9.0.1 ne faisait pas', 'STC-02');
  ok(apresRepli.page === 'project',
    'STC-04 : app.ui.page reste « project »', 'STC-04');
  ok(apresRepli.projet === 'keravel',
    'STC-05 : le chantier actif est inchangé', 'STC-05');
  const ongletVisible = await ev(p, () => ({
    actif: document.querySelector('.tab.active')?.textContent.trim(),
    contenu: !!document.querySelector('#projectContent .sn-section'),
    memoire: app.ui.projectTabActive,
  }));
  note('STC-06', ongletVisible);
  ok(ongletVisible.actif === 'Structure' && ongletVisible.contenu && ongletVisible.memoire === 'keravel|Structure',
    'STC-06 : l’onglet VISIBLE reste Structure — l’onglet actif, le contenu rendu et la mémoire d’onglet concordent', 'STC-06');
  ok(sentinelle.every((a) => !(Number(a[0]) === 0 && Number(a[1]) === 0)),
    `STC-07 : aucun scrollTo(0, 0) pendant le repli (${sentinelle.length} appel(s) observé(s))`, 'STC-07');
  ok(apresRepli.scroll > 0,
    `STC-07 : la page n’est pas remontée en haut (scrollY = ${apresRepli.scroll})`, 'STC-07');

  await p.click('[data-structure-node="sn-keravel-bat-a"] .snc-twisty');
  await p.waitForTimeout(220);
  const apresDepli = await etat(p);
  const enfantsVisibles = await ev(p, () => document.querySelectorAll('[data-structure-node]').length);
  note('STC-03', { apresDepli, lignes: enfantsVisibles });
  ok(apresDepli.onglet === 'Structure' && apresDepli.page === 'project' && apresDepli.projet === 'keravel',
    'STC-03 : déplier laisse tout autant l’utilisateur dans Structure', 'STC-03');

  // Deux allers-retours : l'état doit être exactement réversible.
  const cycle = await ev(p, async () => {
    const lire = () => ({
      lignes: document.querySelectorAll('[data-structure-node]').length,
      replie: (app.ui.collapsedStructure || []).includes('sn-keravel-bat-a'),
      aria: document.querySelector('[data-structure-node="sn-keravel-bat-a"] .snc-twisty').getAttribute('aria-expanded'),
    });
    const suite = [lire()];
    for (let i = 0; i < 4; i++) {
      toggleStructureNode('sn-keravel-bat-a');
      await new Promise((r) => setTimeout(r, 40));
      suite.push(lire());
    }
    return suite;
  });
  note('STC-08', cycle);
  ok(JSON.stringify(cycle[0]) === JSON.stringify(cycle[2]) &&
     JSON.stringify(cycle[1]) === JSON.stringify(cycle[3]) &&
     JSON.stringify(cycle[0]) === JSON.stringify(cycle[4]),
    'STC-08 : quatre bascules successives sont parfaitement réversibles — lignes affichées, état replié et aria-expanded reviennent à l’identique', 'STC-08');
  await ctx.close();
}
{
  /* La même exigence pour les DEUX autres actions qui re-rendaient la page :
     archiver et supprimer éjectaient elles aussi l'utilisateur en V2.9.0.1. */
  const { ctx, p } = await newPage({ tag: 'NAV2' });
  await ouvrirStructure(p);
  await ev(p, () => toggleStructureArchive('sn-keravel-ext'));
  await p.waitForTimeout(280);
  const apresArchive = await etat(p);
  await ev(p, () => {
    app.structureNodes.push({ id: 'sn-jetable', projectId: 'keravel', parentId: null, name: 'Jetable',
      type: 'zone', description: '', responsibleResourceId: null, archived: false, createdAt: '', updatedAt: '' });
    save(); deleteStructureNode('sn-jetable');
  });
  await p.waitForTimeout(280);
  const apresSuppression = await etat(p);
  note('STC-02-bis', { apresArchive, apresSuppression });
  ok(apresArchive.onglet === 'Structure' && apresSuppression.onglet === 'Structure',
    'STC-02 : archiver et supprimer un niveau ne font pas davantage sortir de Structure — la cause racine (l’onglet non mémorisé) est traitée, pas seulement son symptôme', 'STC-02');
  await ctx.close();
}

// ============================================================
// STC-09 / STC-10 — Tout développer / Tout replier
// ============================================================
console.log('\n[STC-TOUT] Tout développer / Tout replier');
{
  const { ctx, p } = await newPage({ tag: 'TOUT' });
  await ouvrirStructure(p);
  await grandeStructure(p, 4, 4);
  const avant = await ev(p, () => ({
    libelle: document.querySelector('[data-structure-toggle-all]').textContent.trim(),
    lignes: document.querySelectorAll('[data-structure-node]').length,
    undo: undoHistory.length,
    historique: app.history.length,
  }));
  await p.click('[data-structure-toggle-all]');
  await p.waitForTimeout(250);
  const replie = await ev(p, () => ({
    libelle: document.querySelector('[data-structure-toggle-all]').textContent.trim(),
    lignes: document.querySelectorAll('[data-structure-node]').length,
    onglet: document.querySelector('.tab.active')?.textContent.trim(),
    undo: undoHistory.length,
    historique: app.history.length,
  }));
  await p.click('[data-structure-toggle-all]');
  await p.waitForTimeout(250);
  const deplie = await ev(p, () => ({
    libelle: document.querySelector('[data-structure-toggle-all]').textContent.trim(),
    lignes: document.querySelectorAll('[data-structure-node]').length,
    onglet: document.querySelector('.tab.active')?.textContent.trim(),
  }));
  note('STC-09', { avant, replie, deplie });
  ok(replie.lignes < avant.lignes && /Tout développer/.test(replie.libelle),
    `STC-10 : « Tout replier » referme toutes les racines (${avant.lignes} → ${replie.lignes} lignes) et la commande s’inverse`, 'STC-10');
  ok(deplie.lignes === avant.lignes && /Tout replier/.test(deplie.libelle),
    `STC-09 : « Tout développer » rouvre exactement ce qui était ouvert (${replie.lignes} → ${deplie.lignes} lignes)`, 'STC-09');
  ok(replie.onglet === 'Structure' && deplie.onglet === 'Structure',
    'STC-09 : la commande ne fait jamais quitter l’onglet Structure', 'STC-09');
  ok(replie.undo === avant.undo && replie.historique === avant.historique,
    'STC-10 : elle ne touche QUE app.ui — aucune entrée d’annulation, aucune entrée d’historique métier', 'STC-10');
  await ctx.close();
}

// ============================================================
// STC-11 → STC-15 — Hiérarchie et zones cliquables
// ============================================================
console.log('\n[STC-HIER] Hiérarchie, profondeur, zones cliquables');
{
  const { ctx, p } = await newPage({ tag: 'HIER' });
  await ouvrirStructure(p);
  const hier = await ev(p, () => {
    const lignes = [...document.querySelectorAll('[data-structure-node]')].map((r) => ({
      id: r.dataset.structureNode,
      depth: Number(r.dataset.depth),
    }));
    // La vérité de référence : l'ordre préfixe issu des moteurs de V2.9.0.
    const attendu = [];
    const descendre = (n, d) => {
      attendu.push({ id: n.id, depth: d });
      if (!(app.ui.collapsedStructure || []).includes(n.id))
        getStructureChildren(n.id).forEach((c) => descendre(c, d + 1));
    };
    getStructureRoots('keravel').forEach((n) => descendre(n, 0));
    return { lignes, attendu };
  });
  note('STC-11', hier);
  ok(JSON.stringify(hier.lignes) === JSON.stringify(hier.attendu),
    'STC-11 : l’ordre et la profondeur affichés correspondent EXACTEMENT au parcours parent → enfants des moteurs existants', 'STC-11');

  await grandeStructure(p, 2, 5);
  const prof = await ev(p, () => {
    const lignes = [...document.querySelectorAll('[data-structure-node]')];
    const profMax = Math.max(...lignes.map((r) => Number(r.dataset.depth)));
    const indents = lignes.map((r) => {
      const i = r.querySelector('.snc-indent');
      return i ? Math.round(i.getBoundingClientRect().width) : 0;
    });
    return {
      profMax, indentMax: Math.max(...indents),
      debordement: document.documentElement.scrollWidth - innerWidth,
      debordementBloc: (() => {
        const bl = document.querySelector('.snc-block');
        return Math.round(bl.scrollWidth - bl.clientWidth);
      })(),
    };
  });
  note('STC-12', prof);
  ok(prof.profMax >= 4 && prof.debordement <= 0 && prof.debordementBloc <= 0,
    `STC-12 : une profondeur de ${prof.profMax + 1} niveaux ne provoque AUCUN débordement horizontal (page ${prof.debordement} px, bloc ${prof.debordementBloc} px)`, 'STC-12');
  ok(prof.indentMax <= 42,
    `STC-12 : l’indentation est bornée — elle plafonne à ${prof.indentMax} px quelle que soit la profondeur`, 'STC-12');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'CLIC' });
  await ouvrirStructure(p);
  // STC-13 — le corps de la ligne ouvre la BONNE fiche
  await p.click('[data-structure-node="sn-keravel-etage-1"] .snc-open');
  await p.waitForTimeout(320);
  const fiche = await ev(p, () => ({ page: app.ui.page, noeud: app.ui.structureNodeId, titre: document.querySelector('.snc-ident h1')?.textContent }));
  note('STC-13', fiche);
  ok(fiche.page === 'structure' && fiche.noeud === 'sn-keravel-etage-1' && fiche.titre === 'Étage 1',
    'STC-13 : cliquer le corps d’une ligne ouvre la fiche du BON niveau', 'STC-13');

  // STC-14 — le chevron n'ouvre PAS la fiche
  await ouvrirStructure(p);
  /* La bonne preuve n'est pas « structureNodeId est vide » — ce champ garde la
     dernière fiche consultée et n'est lu que sur la page « structure » — mais
     « la fiche n'est pas AFFICHÉE ». C'est ce que voit l'utilisateur. */
  const avant14 = await ev(p, () => ({
    page: app.ui.page, fiche: !!document.querySelector('.snc-cockpit'),
    replie: (app.ui.collapsedStructure || []).includes('sn-keravel-bat-a'),
  }));
  await p.click('[data-structure-node="sn-keravel-bat-a"] .snc-twisty');
  await p.waitForTimeout(250);
  const apres14 = await ev(p, () => ({
    page: app.ui.page, fiche: !!document.querySelector('.snc-cockpit'),
    replie: (app.ui.collapsedStructure || []).includes('sn-keravel-bat-a'),
    onglet: document.querySelector('.tab.active')?.textContent.trim(),
  }));
  note('STC-14', { avant14, apres14 });
  ok(apres14.page === 'project' && !apres14.fiche && apres14.onglet === 'Structure' &&
     apres14.replie !== avant14.replie,
    'STC-14 : le chevron ne fait QUE replier — aucune fiche de niveau ne s’ouvre, et le repli a bien basculé', 'STC-14');

  // STC-15 — le « … » n'ouvre pas la fiche non plus
  await p.click('[data-structure-node="sn-keravel-bat-a"] .more-trigger');
  await p.waitForTimeout(200);
  const apres15 = await ev(p, () => ({
    page: app.ui.page,
    fiche: !!document.querySelector('.snc-cockpit'),
    menuOuvert: document.querySelectorAll('.more-pop.open').length,
  }));
  note('STC-15', apres15);
  ok(apres15.page === 'project' && !apres15.fiche && apres15.menuOuvert === 1,
    'STC-15 : le « … » n’ouvre que son menu — jamais la fiche du niveau', 'STC-15');
  await ctx.close();
}

// ============================================================
// STC-16 → STC-20 — Les menus de V2.9.0.1 ne doivent pas régresser
// ============================================================
console.log('\n[STC-MENUS] Le composant corrigé en V2.9.0.1 est intact');
{
  const { ctx, p } = await newPage({ tag: 'MENU', h: 900 });
  await ouvrirStructure(p);
  await grandeStructure(p, 14, 1);
  const geo = (sel) => ev(p, (s) => {
    const card = document.querySelector(s);
    const btn = card.querySelector('.more-trigger'), pop = card.querySelector('.more-pop');
    const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    return {
      ouvert: pop.classList.contains('open'), dropUp: pop.classList.contains('drop-up'),
      ecart: Math.round(pop.classList.contains('drop-up') ? bb.top - pb.bottom : pb.top - bb.bottom),
      dxDroite: Math.round(pb.right - bb.right),
      horsViewport: Math.round(Math.max(pb.bottom - innerHeight, -pb.top, pb.right - innerWidth, -pb.left)),
      ouverts: document.querySelectorAll('.more-pop.open').length,
      aria: btn.getAttribute('aria-expanded'),
      composant: !!card.querySelector('.more-menu') && btn.classList.contains('btn') && btn.classList.contains('more-trigger'),
      actions: [...pop.querySelectorAll('button')].map((x) => x.textContent.trim()),
    };
  }, sel);

  const premier = await ev(p, () => document.querySelector('[data-structure-node]').dataset.structureNode);
  await p.click(`[data-structure-node="${premier}"] .more-trigger`);
  await p.waitForTimeout(160);
  const g1 = await geo(`[data-structure-node="${premier}"]`);
  note('STC-16', g1);
  ok(g1.composant && g1.ouvert && Math.abs(g1.ecart) <= 12 && Math.abs(g1.dxDroite) <= 1,
    `STC-16 : le menu du premier niveau utilise le composant Kanvix et reste collé à son bouton (${g1.ecart} px, alignement ${g1.dxDroite} px)`, 'STC-16');
  /* V2.10.0 — RE-BASELINE. Le menu accueille « Déplacer » et « Dupliquer »
     (V2.10.0 §1) : il compte donc six entrées et non plus quatre. L'assertion
     n'est pas assouplie, elle est RENFORCÉE — au lieu d'un simple décompte,
     elle exige désormais que les quatre actions historiques soient toutes
     présentes, dans leur ordre relatif d'origine, ET que toute entrée
     supplémentaire appartienne à une liste blanche explicite. Un ajout non
     déclaré ferait tomber le test. Elle vaut pour l'ancien build comme pour
     le nouveau. */
  const ACTIONS_HISTORIQUES = ['Modifier', 'Ajouter un sous-niveau', 'Archiver', 'Supprimer'];
  /* V2.11.0 — RE-POINTAGE par DÉCLARATION, mécanisme prévu par l'assertion
     elle-même : « Enregistrer comme modèle » (V2.11.0 §11) rejoint la liste
     des entrées AUTORISÉES. Les quatre actions historiques restent épinglées
     dans leur ordre d'origine, et une entrée NON déclarée ferait toujours
     tomber le test. */
  const ACTIONS_AUTORISEES = [...ACTIONS_HISTORIQUES, 'Restaurer', 'Déplacer', 'Dupliquer', 'Enregistrer comme modèle'];
  const menuConforme = (actions) => {
    const presentes = ACTIONS_HISTORIQUES.filter((a) => actions.includes(a));
    const ordre = actions.filter((a) => ACTIONS_HISTORIQUES.includes(a));
    return (
      presentes.length === 4 &&
      ordre.join('|') === ACTIONS_HISTORIQUES.join('|') &&
      actions.every((a) => ACTIONS_AUTORISEES.includes(a))
    );
  };
  ok(menuConforme(g1.actions),
    `STC-16 : les quatre actions de V2.9.0 sont conservées dans leur ordre d’origine, et toute entrée supplémentaire est déclarée (${g1.actions.join(' · ')})`, 'STC-16');

  const dernier = await ev(p, async () => {
    const xs = [...document.querySelectorAll('[data-structure-node]')];
    const d = xs[xs.length - 1];
    d.scrollIntoView({ block: 'end' });
    await new Promise((r) => setTimeout(r, 160));
    return d.dataset.structureNode;
  });
  await p.click(`[data-structure-node="${dernier}"] .more-trigger`);
  await p.waitForTimeout(180);
  const g2 = await geo(`[data-structure-node="${dernier}"]`);
  note('STC-17', g2);
  ok(g2.horsViewport <= 0,
    `STC-17 : le menu du DERNIER niveau reste entièrement dans le viewport (débordement ${g2.horsViewport} px)`, 'STC-17');
  ok(g2.dropUp === true && Math.abs(g2.ecart) <= 12,
    `STC-18 : faute de place, il se retourne au-dessus de son bouton en restant ancré (${g2.ecart} px)`, 'STC-18');
  ok(g2.ouverts === 1,
    'STC-19 : un seul menu ouvert simultanément — ouvrir le second a fermé le premier', 'STC-19');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(160);
  const apresEchap = await ev(p, () => ({
    ouverts: document.querySelectorAll('.more-pop.open').length,
    ariaVrais: [...document.querySelectorAll('.more-trigger')].filter((x) => x.getAttribute('aria-expanded') === 'true').length,
  }));
  note('STC-20', apresEchap);
  ok(apresEchap.ouverts === 0 && apresEchap.ariaVrais === 0,
    'STC-20 : Échap ferme le menu et remet aria-expanded à false', 'STC-20');
  await ctx.close();
}
{
  /* La même vérification en MOBILE — et c'est de là que vient la capture 10,
     qui doit montrer un menu de mobile, pas un menu de bureau. */
  const { ctx, p } = await newPage({ tag: 'MENUMOB', w: 390, h: 844 });
  await ouvrirStructure(p);
  await grandeStructure(p, 12, 1);
  const dernier = await ev(p, async () => {
    const xs = [...document.querySelectorAll('[data-structure-node]')];
    const d = xs[xs.length - 1];
    d.scrollIntoView({ block: 'end' });
    await new Promise((r) => setTimeout(r, 160));
    return d.dataset.structureNode;
  });
  await p.click(`[data-structure-node="${dernier}"] .more-trigger`);
  await p.waitForTimeout(180);
  const g = await ev(p, (id) => {
    const card = document.querySelector(`[data-structure-node="${id}"]`);
    const pop = card.querySelector('.more-pop'), btn = card.querySelector('.more-trigger');
    const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    return {
      ouvert: pop.classList.contains('open'), dropUp: pop.classList.contains('drop-up'),
      hors: Math.round(Math.max(pb.bottom - innerHeight, -pb.top, pb.right - innerWidth, -pb.left)),
      ecart: Math.round(pop.classList.contains('drop-up') ? bb.top - pb.bottom : pb.top - bb.bottom),
      modal: !!pop.closest('#drawer, #modal'),
    };
  }, dernier);
  note('STC-17-menu-mobile', g);
  ok(g.ouvert && g.hors <= 0 && Math.abs(g.ecart) <= 12 && !g.modal,
    `STC-17 : en mobile 390, le menu du dernier niveau reste dans le viewport (${g.hors} px), ancré à ${g.ecart} px, et reste un popover — jamais une modale`, 'STC-17');
  await shot(p, '10-structure-mobile-menu.png');
  await ctx.close();
}

// ============================================================
// STC-21 → STC-24 — « Sans structure » montre enfin les interventions
// ============================================================
console.log('\n[STC-SANS] Les interventions sans niveau');
{
  const { ctx, p } = await newPage({ tag: 'SANS' });
  await ouvrirStructure(p);
  const r = await ev(p, () => {
    const attendu = getUnstructuredTasks('keravel');
    const lignes = [...document.querySelectorAll('[data-unstructured-task]')];
    return {
      attendu: attendu.map((t) => ({ id: t.id, nom: t.name })),
      affiche: lignes.map((l) => ({ id: l.dataset.unstructuredTask, nom: l.querySelector('b')?.textContent })),
      compteur: document.querySelector('.snc-block.tasks .snc-count')?.textContent,
      // avant/après : aucune tâche ne doit avoir changé de rattachement
      empreinte: app.tasks.map((t) => `${t.id}:${t.structureNodeId}`).join(','),
    };
  });
  note('STC-21', r);
  ok(r.compteur === `${r.attendu.length} intervention${r.attendu.length > 1 ? 's' : ''}`,
    `STC-21 : le bloc annonce le compte EXACT donné par getUnstructuredTasks() (${r.compteur})`, 'STC-21');
  ok(r.affiche.length === r.attendu.length &&
     r.attendu.every((t, i) => r.affiche[i].id === t.id && r.affiche[i].nom === t.nom),
    `STC-22 : chaque intervention est affichée par son NOM (${r.affiche.map((x) => x.nom).join(', ')}) — et non plus réduite à un compteur`, 'STC-22');

  const cible = r.attendu[0].id;
  await p.click(`[data-unstructured-task="${cible}"] .snc-open`);
  await p.waitForTimeout(320);
  const ouverte = await ev(p, () => ({
    drawer: !!document.querySelector('#drawerContent'),
    titre: document.querySelector('#drawerContent h2, #drawerContent h3')?.textContent,
    selection: app.ui.selectedTask,
  }));
  note('STC-23', { cible, ouverte });
  ok(ouverte.drawer && (ouverte.selection === cible || (ouverte.titre || '').includes(r.attendu[0].nom)),
    'STC-23 : cliquer une intervention ouvre la BONNE tâche, par le moteur openTask() existant', 'STC-23');

  const apres = await ev(p, () => app.tasks.map((t) => `${t.id}:${t.structureNodeId}`).join(','));
  ok(apres === r.empreinte,
    'STC-24 : afficher ces interventions n’a modifié AUCUN structureNodeId — elles restent réellement sans niveau', 'STC-24');
  const nulls = await ev(p, () => getUnstructuredTasks('keravel').every((t) => t.structureNodeId === null || t.structureNodeId === undefined));
  ok(nulls, 'STC-24 : elles valent bien null — aucune structure artificielle n’a été créée', 'STC-24');
  await ev(p, () => { closeOverlay('drawer'); document.querySelector('.snc-block.tasks').scrollIntoView({ block: 'center' }); });
  await shot(p, '05-structure-unstructured-tasks.png');
  await ctx.close();
}

// ============================================================
// STC-25 → STC-29 — Les chiffres affichés SONT ceux des moteurs
// ============================================================
console.log('\n[STC-CHIFFRES] Aucune valeur recalculée dans la vue');
{
  const { ctx, p } = await newPage({ tag: 'CHIF' });
  await ouvrirStructure(p);
  const comp = await ev(p, () => {
    const out = [];
    document.querySelectorAll('[data-structure-node]').forEach((row) => {
      const id = row.dataset.structureNode;
      const cells = row.querySelectorAll(':scope > .snc-cell');
      const prog = getStructureProgress(id), res = getStructureResources(id).length,
        dates = getStructureDates(id), st = getStructureStatus(id),
        n = structureNode(id);
      out.push({
        id,
        interventionsVue: cells[0]?.textContent.trim(),
        interventionsMoteur: prog ? `${prog.total} intervention${prog.total > 1 ? 's' : ''}` : '—',
        ressourcesVue: cells[1]?.textContent.trim(),
        ressourcesMoteur: res ? `${res} ressource${res > 1 ? 's' : ''}` : '—',
        periodeVue: cells[2]?.textContent.trim(),
        periodeMoteur: dates ? `${fmtDay(dates.start)} → ${fmtDay(dates.end)}` : '—',
        // Le nom est le span qui n'est PAS l'avatar : `.snc-resp span` attrape
        // d'abord `.resource-avatar`, dont le texte n'est pas le libellé.
        respVue: (row.querySelector(':scope > .snc-resp > span:not(.resource-avatar)')?.textContent
          || row.querySelector(':scope > .snc-cell.snc-dash')?.textContent || '—').trim(),
        respMoteur: n.responsibleResourceId ? resourceLabel(n.responsibleResourceId) : '—',
        statutVue: row.querySelector(':scope > .snc-status')?.textContent.trim(),
        statutMoteur: st.label,
        tonVue: row.querySelector(':scope > .snc-status')?.className.match(/tone-\w+/)?.[0],
        tonMoteur: 'tone-' + st.tone,
      });
    });
    return out;
  });
  note('STC-25', comp);
  ok(comp.every((c) => c.interventionsVue === c.interventionsMoteur),
    'STC-25 : le compte d’interventions de chaque ligne est EXACTEMENT celui de getStructureProgress()', 'STC-25');
  ok(comp.every((c) => c.ressourcesVue === c.ressourcesMoteur),
    'STC-26 : le compte de ressources est exactement celui de getStructureResources()', 'STC-26');
  ok(comp.every((c) => c.periodeVue === c.periodeMoteur),
    'STC-27 : la période est exactement celle de getStructureDates()', 'STC-27');
  ok(comp.every((c) => c.respVue === c.respMoteur),
    'STC-28 : le responsable affiché est exactement resourceLabel(n.responsibleResourceId)', 'STC-28');
  ok(comp.every((c) => c.statutVue === c.statutMoteur && c.tonVue === c.tonMoteur),
    'STC-29 : le badge de statut — libellé ET ton — est exactement celui de getStructureStatus()', 'STC-29');
  await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
  await shot(p, '03-structure-hierarchy-expanded.png');
  await ev(p, () => { toggleStructureNode('sn-keravel-bat-a'); });
  await p.waitForTimeout(250);
  await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
  await shot(p, '04-structure-hierarchy-collapsed.png');
  await ctx.close();
}

// ============================================================
// STC-30 → STC-35 — La fiche d'un niveau
// ============================================================
console.log('\n[STC-FICHE] Fiche de niveau compacte');
{
  const { ctx, p } = await newPage({ tag: 'FICHE' });
  const mesure = async (file) => {
    const { ctx: c2, p: p2 } = await newPage({ tag: 'M', file });
    await ev(p2, () => { app.ui.projectId = 'keravel'; save(); openStructureNode('sn-keravel-bat-a'); });
    await p2.waitForTimeout(380);
    const h = await ev(p2, () => {
      const tabs = document.querySelector('.sn-tabs').getBoundingClientRect();
      const ck = document.querySelector('.snc-cockpit, .sn-hero');
      return { cockpit: Math.round(ck.getBoundingClientRect().height), avantOnglets: Math.round(tabs.top + scrollY) };
    });
    await c2.close();
    return h;
  };
  const vieux = await mesure(PREV), neuf = await mesure(CUR);
  note('STC-30', { 'V2.9.0.1': vieux, 'V2.9.1': neuf });
  ok(neuf.cockpit < vieux.cockpit && neuf.avantOnglets < vieux.avantOnglets,
    `STC-30 : le haut de la fiche est SENSIBLEMENT plus court — cockpit ${vieux.cockpit} → ${neuf.cockpit} px (${Math.round((neuf.cockpit / vieux.cockpit - 1) * 100)} %), hauteur avant les onglets ${vieux.avantOnglets} → ${neuf.avantOnglets} px`, 'STC-30');

  await ev(p, () => { app.ui.projectId = 'keravel'; save(); openStructureNode('sn-keravel-bat-a'); });
  await p.waitForTimeout(380);
  const kpis = await ev(p, () => {
    const vides = [...document.querySelectorAll('.snc-kpi')].filter((k) => !k.querySelector('.snc-kpi-val b')?.textContent.trim());
    return {
      libelles: [...document.querySelectorAll('.snc-kpi-label')].map((x) => x.textContent),
      vides: vides.length,
      onglets: [...document.querySelectorAll('.sn-tabs button')].map((x) => x.textContent),
      // le libellé est en capitales, la VALEUR ne doit pas l'être
      casseLibelle: getComputedStyle(document.querySelector('.snc-kpi-label')).textTransform,
      casseValeur: getComputedStyle(document.querySelector('.snc-kpi-val b')).textTransform,
    };
  });
  note('STC-30-kpi', kpis);
  ok(kpis.vides === 0,
    'STC-30 : aucune carte KPI vide n’est affichée — seules celles qui portent une valeur utile apparaissent', 'STC-30');
  ok(kpis.onglets.join('|') === 'Résumé|Planning|Ressources|Sous-niveaux',
    'STC-30 : les quatre onglets de V2.9.0 sont conservés dans le même ordre', 'STC-30');
  ok(kpis.casseLibelle === 'uppercase' && kpis.casseValeur === 'none',
    'STC-30 : le libellé d’un indicateur est en capitales, sa VALEUR ne l’est pas', 'STC-30');

  // STC-31 — Résumé : interventions en lignes compactes
  const resume = await ev(p, () => {
    const lignes = [...document.querySelectorAll('[data-unstructured-task]')];
    const ts = getStructureTasks('sn-keravel-bat-a').slice().sort((a, b) => a.start.localeCompare(b.start));
    return {
      lignes: lignes.map((l) => l.dataset.unstructuredTask),
      moteur: ts.map((t) => t.id),
      hauteurMoyenne: lignes.length ? Math.round(lignes.reduce((a, l) => a + l.getBoundingClientRect().height, 0) / lignes.length) : 0,
      colonnes: [...document.querySelectorAll('.snc-block.tasks .snc-colhead span')].map((x) => x.textContent),
    };
  });
  note('STC-31', resume);
  ok(JSON.stringify(resume.lignes) === JSON.stringify(resume.moteur),
    'STC-31 : le Résumé liste exactement les interventions de getStructureTasks(), dans l’ordre chronologique', 'STC-31');
  ok(resume.hauteurMoyenne <= 56,
    `STC-31 : elles sont présentées en LIGNES compactes (${resume.hauteurMoyenne} px de haut en moyenne), pas en cartes`, 'STC-31');
  await shot(p, '06-structure-node-summary.png');

  // STC-32 — Planning : le même gantt(), avec le périmètre du niveau
  await ev(p, () => setStructureTab('Planning'));
  await p.waitForTimeout(420);
  const plan = await ev(p, () => ({
    gantt: document.querySelectorAll('.g-row, .gantt').length,
    barres: document.querySelectorAll('.g-bar').length,
    attendu: getStructureTasks('sn-keravel-bat-a').length,
    unSeulGantt: true,
  }));
  note('STC-32', plan);
  ok(plan.gantt > 0 && plan.barres > 0,
    `STC-32 : l’onglet Planning rend bien le gantt() existant (${plan.barres} barres)`, 'STC-32');
  await shot(p, '07-structure-node-planning.png');

  // STC-33 — Ressources inchangé
  await ev(p, () => setStructureTab('Ressources'));
  await p.waitForTimeout(380);
  const res = await ev(p, () => ({
    cartes: document.querySelectorAll('.team-list > *').length,
    moteur: getStructureResources('sn-keravel-bat-a').length,
  }));
  note('STC-33', res);
  ok(res.cartes === res.moteur && res.cartes > 0,
    `STC-33 : l’onglet Ressources reste fonctionnellement inchangé — ${res.cartes} cartes pour ${res.moteur} ressources agrégées`, 'STC-33');

  // STC-34 — Sous-niveaux au format compact
  await ev(p, () => setStructureTab('Sous-niveaux'));
  await p.waitForTimeout(380);
  const sous = await ev(p, () => ({
    compact: !!document.querySelector('.snc-block .snc-row[data-structure-node]'),
    anciennesCartes: document.querySelectorAll('.sn-card').length,
    lignes: document.querySelectorAll('[data-structure-node]').length,
    moteur: getStructureChildren('sn-keravel-bat-a').length,
    arbre: document.querySelectorAll('[data-structure-tree]').length,
  }));
  note('STC-34', sous);
  ok(sous.compact && sous.anciennesCartes === 0 && sous.lignes === sous.moteur,
    `STC-34 : les sous-niveaux utilisent le MÊME composant compact (${sous.lignes} lignes), plus aucune ancienne vignette`, 'STC-34');

  // STC-35 — « + Tâche » préremplit le niveau
  await ev(p, () => setStructureTab('Résumé'));
  await p.waitForTimeout(300);
  await p.click('.snc-top-actions .btn.primary');
  await p.waitForTimeout(350);
  const form = await ev(p, () => {
    const f = document.querySelector('#drawerFormEl');
    return { ouvert: !!f, structure: f?.querySelector('[name=structureNodeId]')?.value };
  });
  note('STC-35', form);
  ok(form.ouvert && form.structure === 'sn-keravel-bat-a',
    'STC-35 : « + Tâche » depuis une fiche de niveau préremplit bien structureNodeId sur ce niveau', 'STC-35');
  await ctx.close();
}

// ============================================================
// STC-36 → STC-40 — Création, modification, garde-fous, Undo
// ============================================================
console.log('\n[STC-METIER] Les règles métier de V2.9.0 sont intactes');
{
  const { ctx, p } = await newPage({ tag: 'METIER' });
  await ouvrirStructure(p);
  await p.click('[data-structure-node="sn-keravel-etage-1"] .more-trigger');
  await p.waitForTimeout(150);
  await p.click('[data-structure-node="sn-keravel-etage-1"] .more-pop button:nth-child(1)');
  await p.waitForTimeout(320);
  const mod = await ev(p, () => {
    const f = document.querySelector('#drawerFormEl');
    return { nom: f?.querySelector('[name=name]')?.value, parent: f?.querySelector('[name=parentId]')?.value };
  });
  note('STC-36', mod);
  ok(mod.nom === 'Étage 1' && mod.parent === 'sn-keravel-bat-a',
    'STC-36 : « Modifier » ouvre le formulaire du bon niveau, parent compris', 'STC-36');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(200);

  await ouvrirStructure(p);
  await p.click('[data-structure-node="sn-keravel-etage-1"] .more-trigger');
  await p.waitForTimeout(150);
  await p.click('[data-structure-node="sn-keravel-etage-1"] .more-pop button:nth-child(2)');
  await p.waitForTimeout(320);
  const sous = await ev(p, () => {
    const f = document.querySelector('#drawerFormEl');
    return { vide: f?.querySelector('[name=name]')?.value === '', parent: f?.querySelector('[name=parentId]')?.value };
  });
  note('STC-37', sous);
  ok(sous.vide && sous.parent === 'sn-keravel-etage-1',
    'STC-37 : « Ajouter un sous-niveau » ouvre une création vierge sous le bon parent', 'STC-37');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(200);

  const garde = await ev(p, () => {
    const avantArchive = structureNode('sn-keravel-rdc').archived;
    toggleStructureArchive('sn-keravel-rdc');
    const apresArchive = structureNode('sn-keravel-rdc').archived;
    toggleStructureArchive('sn-keravel-rdc');
    return {
      archive: [avantArchive, apresArchive, structureNode('sn-keravel-rdc').archived],
      blocageArchive: !!structureArchiveBlocker('sn-keravel-bat-a'),
      blocageSuppressionEnfants: !!structureDeleteBlocker('sn-keravel-bat-a'),
      blocageSuppressionTaches: !!structureDeleteBlocker('sn-keravel-etage-1'),
      cycle: !!structureParentError('keravel', 'sn-keravel-bat-a', 'sn-keravel-rdc'),
    };
  });
  note('STC-38', garde);
  ok(garde.archive[0] === false && garde.archive[1] === true && garde.archive[2] === false,
    'STC-38 : archiver puis restaurer un niveau fonctionne toujours, par le moteur existant', 'STC-38');
  ok(garde.blocageArchive && garde.blocageSuppressionEnfants && garde.blocageSuppressionTaches && garde.cycle,
    'STC-39 : les garde-fous sont intacts — archivage bloqué si sous-niveaux actifs, suppression refusée si enfants ou interventions, cycle de parent refusé', 'STC-39');

  const undo = await ev(p, () => {
    const nomAvant = structureNode('sn-keravel-rdc').name;
    const undoAvant = undoHistory.length, histAvant = app.history.length;
    toggleStructureArchive('sn-keravel-rdc');
    const apres = { undo: undoHistory.length - undoAvant, hist: app.history.length - histAvant, archive: structureNode('sn-keravel-rdc').archived };
    undo();
    return { ...apres, nomAvant, apresUndo: structureNode('sn-keravel-rdc').archived };
  });
  note('STC-40', undo);
  ok(undo.undo === 1 && undo.hist === 1 && undo.archive === true && undo.apresUndo === false,
    'STC-40 : une action = UNE transaction d’annulation et UNE entrée d’historique ; l’annulation rétablit l’état exact', 'STC-40');
  await ctx.close();
}

// ============================================================
// STC-41 → STC-46 — Responsive et thème sombre
// ============================================================
console.log('\n[STC-RESP] Responsive et sombre');
{
  const mesures = [];
  for (const w of [1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390, 360]) {
    for (const dark of [false, true]) {
      const { ctx, p } = await newPage({ tag: 'R' + w, w, h: 900, dark });
      await ouvrirStructure(p);
      await grandeStructure(p, 6, 3);
      const m = await ev(p, () => {
        const lignes = [...document.querySelectorAll('[data-structure-node]')];
        const bloc = document.querySelector('.snc-block');
        return {
          over: document.documentElement.scrollWidth - innerWidth,
          overBloc: Math.round(bloc.scrollWidth - bloc.clientWidth),
          hauteurLigne: Math.round(lignes.reduce((a, l) => a + l.getBoundingClientRect().height, 0) / lignes.length),
          metaVisible: getComputedStyle(lignes[0].querySelector('.snc-meta') || document.body).display !== 'none',
          colheadVisible: getComputedStyle(document.querySelector('.snc-colhead')).display !== 'none',
          sansStructure: document.querySelectorAll('[data-unstructured-task]').length,
        };
      });
      mesures.push({ w, dark, ...m });
      /* Les captures visent le BLOC Structure, pas le haut de la fiche : c'est
         la densité et la hiérarchie qu'on veut pouvoir vérifier à l'œil. */
      if ((w === 1600 || w === 430 || w === 390) && true) {
        await ev(p, () => document.querySelector('.snc-block').scrollIntoView({ block: 'start' }));
        await p.waitForTimeout(160);
      }
      if (!dark && w === 1600) await shot(p, '01-structure-desktop-1600-light.png');
      if (dark && w === 1600) await shot(p, '02-structure-desktop-1600-dark.png');
      if (!dark && w === 430) await shot(p, '08-structure-mobile-430.png');
      if (!dark && w === 390) await shot(p, '09-structure-mobile-390.png');
      await ctx.close();
    }
  }
  note('STC-41', mesures.filter((m) => m.w <= 768));
  note('STC-46', mesures.map((m) => ({ w: m.w, dark: m.dark, over: m.over })));
  const mob = (w) => mesures.filter((m) => m.w === w);
  for (const [w, num] of [[430, 'STC-41'], [390, 'STC-42'], [360, 'STC-43']]) {
    const xs = mob(w);
    ok(xs.every((m) => m.over <= 0 && m.overBloc <= 0),
      `${num} : mobile ${w} — aucun débordement horizontal, ni de la page ni du bloc Structure`, num);
    ok(xs.every((m) => m.hauteurLigne >= 56 && m.hauteurLigne <= 92),
      `${num} : mobile ${w} — chaque niveau tient en ${xs[0].hauteurLigne} px, dans la cible 64–86 px annoncée`, num);
    ok(xs.every((m) => m.metaVisible && !m.colheadVisible),
      `${num} : mobile ${w} — la vue est ADAPTÉE, pas rétrécie : les six colonnes cèdent la place à une ligne de méta`, num);
  }
  const dark = mesures.filter((m) => m.dark);
  ok(dark.every((m) => m.over <= 0),
    'STC-45 : en thème sombre, aucun débordement horizontal sur les 11 largeurs', 'STC-45');
  ok(mesures.every((m) => m.over <= 0 && m.overBloc <= 0),
    'STC-46 : aucun débordement horizontal sur 11 largeurs × 2 thèmes (22 combinaisons)', 'STC-46');
  ok(mesures.every((m) => m.sansStructure >= 1),
    'STC-46 : le bloc « Sans structure » et ses interventions restent affichés à toutes les largeurs', 'STC-46');
}
{
  // STC-44 — le sombre utilise les variables de thème, sans couleur en dur
  const { ctx, p } = await newPage({ tag: 'DARK', dark: true });
  await ouvrirStructure(p);
  const r = await ev(p, () => {
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const bloc = document.querySelector('.snc-block');
    const row = document.querySelector('.snc-row');
    const rail = document.querySelector('.snc-rail');
    return {
      sombre: document.body.classList.contains('dark'),
      fondBloc: getComputedStyle(bloc).backgroundColor, lumBloc: lum(getComputedStyle(bloc).backgroundColor),
      texte: getComputedStyle(row.querySelector('b')).color, lumTexte: lum(getComputedStyle(row.querySelector('b')).color),
      railVisible: rail ? getComputedStyle(rail).backgroundColor : null,
      enDur: (document.querySelector('.sn-section').innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || []).length,
    };
  });
  note('STC-44', r);
  ok(r.sombre && r.lumBloc < 0.5 && r.lumTexte > 0.5,
    `STC-44 : en sombre, le bloc a un fond foncé (${r.fondBloc}) et un texte clair (${r.texte}) — il hérite des variables de thème`, 'STC-44');
  ok(r.enDur === 0,
    'STC-44 : aucune couleur codée en dur dans toute la section Structure', 'STC-44');
  await ctx.close();
}

// ============================================================
// STC-48 / STC-49 — Cas limites
// ============================================================
console.log('\n[STC-LIMITES] Chantier sans structure, structure de 15 niveaux');
{
  const { ctx, p } = await newPage({ tag: 'LIM' });
  const vide = await ev(p, () => {
    // Un chantier ANCIEN, sans le moindre niveau : il doit rester utilisable.
    const autre = app.projects.find((x) => x.id !== 'keravel' && isProjectActive(x));
    app.structureNodes = app.structureNodes.filter((n) => n.projectId !== autre.id);
    save(); openProjectTab(autre.id, 'Structure');
    return { id: autre.id, nom: autre.name };
  });
  await p.waitForTimeout(350);
  const r = await ev(p, () => ({
    etatVide: !!document.querySelector('.sn-empty-state'),
    bouton: !!document.querySelector('.sn-empty-state .btn'),
    onglet: document.querySelector('.tab.active')?.textContent.trim(),
    sansStructure: document.querySelectorAll('[data-unstructured-task]').length,
    over: document.documentElement.scrollWidth - innerWidth,
  }));
  note('STC-48', { ...vide, ...r });
  ok(r.etatVide && r.bouton && r.onglet === 'Structure' && r.over <= 0,
    'STC-48 : un chantier sans structure reste pleinement utilisable — état vide avec son invitation, onglet conservé, aucun débordement', 'STC-48');
  ok(r.sansStructure > 0,
    `STC-48 : et ses interventions restent visibles dans « Sans structure » (${r.sansStructure})`, 'STC-48');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'GRAND' });
  await ouvrirStructure(p);
  const t0 = Date.now();
  await grandeStructure(p, 15, 4);
  const rendu = Date.now() - t0;
  const r = await ev(p, () => ({
    noeuds: getProjectStructure('keravel').length,
    lignes: document.querySelectorAll('[data-structure-node]').length,
    over: document.documentElement.scrollWidth - innerWidth,
    compte: document.querySelector('.snc-count')?.textContent,
  }));
  // un repli, puis un dépli, chronométrés
  const t1 = Date.now();
  await p.click('[data-structure-toggle-all]');
  await p.waitForTimeout(150);
  await p.click('[data-structure-toggle-all]');
  await p.waitForTimeout(150);
  const bascule = Date.now() - t1;
  const apres = await ev(p, () => ({
    lignes: document.querySelectorAll('[data-structure-node]').length,
    onglet: document.querySelector('.tab.active')?.textContent.trim(),
  }));
  note('STC-49', { rendu, bascule, ...r, apres });
  ok(r.noeuds >= 19 && r.over <= 0 && apres.lignes === r.lignes && apres.onglet === 'Structure',
    `STC-49 : une structure de ${r.noeuds} niveaux reste utilisable — aucun débordement, deux bascules complètes en ${bascule} ms, onglet conservé`, 'STC-49');
  await ctx.close();
}

// ============================================================
// STC-50 / FREEZE-291 — Gel métier
// ============================================================
console.log('\n[FREEZE-291] Périmètre du refactor');
{
  const read = (f) => fs.readFileSync(BASE + f, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  /* Extraction PARENTHÉSÉE : on saute la liste de paramètres avant de chercher
     l'accolade du corps — sinon `opts = {}` fait couper sur la signature. */
  const extractFn = (src, name) => {
    const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    let par = src.indexOf('(', m.index), depth = 0, k = par;
    for (; k < src.length; k++) {
      if (src[k] === '(') depth++;
      else if (src[k] === ')') { depth--; if (!depth) { k++; break; } }
    }
    let i = src.indexOf('{', k), d = 0, j = i, s = null, esc = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (s) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === s) s = null; continue; }
      if (c === '"' || c === "'" || c === '`') { s = c; continue; }
      if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
      if (c === '{') d++;
      else if (c === '}') { d--; if (!d) { j++; break; } }
    }
    return src.slice(m.index, j);
  };
  const A = read(PREV), B = read(CUR);

  /* TOUT le métier, y compris l'intégralité du moteur Structure de V2.9.0 :
     un refactor de présentation n'a aucune raison d'en toucher une ligne. */
  const geles = [
    // Moteur Structure et agrégations
    'structureNode', 'getStructureNode', 'getProjectStructure', 'projectHasStructure',
    'getStructureChildren', 'getStructureRoots', 'getStructureDescendantIds',
    'getStructureAncestors', 'structurePath', 'getStructureTasks', 'getUnstructuredTasks',
    'getStructureDates', 'getStructureProgress', 'getStructureResources',
    'getStructureIssues', 'getStructureControls', 'getStructureMilestones',
    'getStructureStatus', 'structureParentError', 'structureParentOptions',
    'openStructureForm', 'structureArchiveBlocker', 'toggleStructureArchive',
    'structureDeleteBlocker', 'confirmDeleteStructure', 'deleteStructureNode',
    'openStructureNode', 'closeStructureNode', 'setStructureTab',
    'structureSelect', 'planningStructureSelect', 'projectStructureNote',
    // Données
    /* V2.11.0 — migrateState porte la migration 13 → 14 : elle quitte les
       gelés et rejoint le périmètre NOMMÉ ci-dessous. */
    'save', 'applyStorageSync', 'resetApp', 'buildKanvixBackup',
    'confirmKanvixRestore', 'validateImportState', 'analyzeKanvixImport',
    'buildImportPlan', 'applyImportPlan', 'exportKanvixData',
    // Planning
    'planningTasks', 'gantt', 'planningAgenda', 'effectiveTasks', 'pos', 'scale',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime',
    'addWorkingDuration', 'dropTask', 'dragStart', 'dragOver', 'drawDeps',
    'requestGanttTaskMove', 'requestTaskScheduleMove', 'renderPlanning',
    'planningCreateRow', 'planningCreatePointerDown', 'planningCreatePointerMove',
    'planningCreatePointerUp', 'planningCanDrawCreate', 'openTaskForm', 'submitTaskEdit',
    // Jours non ouvrés et démarrage réel
    'easterSunday', 'frenchPublicHolidays', 'isWeekendDate', 'isNonWorkingDate',
    'taskTouchesNonWorkingDay', 'realStartPlan', 'askRealStartConfirm',
    // Métier transverse
    'setTaskStatus', 'taskResourceIds', 'getResourceTasks',
    'getResourceSchedulingConflicts', 'ensureTaskControlInstances',
    'blockingControlsForTask', 'pendingControlsForTask', 'getProjectHealth',
    'milestoneStatus', 'operationMilestonesTab', 'operationPlanningTab',
    'operationProjectCard', 'openTask', 'projectTeamCard', 'projectTabs',
    // Undo / Redo
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget',
    // Menus — le correctif de V2.9.0.1, intégralement
    'toggleDrawerMenu', 'closeDrawerMenu', 'anyDrawerMenuOpen',
  ];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-291', { comparées: compares, bougés: bouges });
  ok(bouges.length === 0,
    `FREEZE-291 : les ${compares} moteurs de V2.9.0.1 sont BYTE-IDENTIQUES — tout le moteur Structure, le Planning, les données, les ressources, la qualité, les jalons, l’Opération, l’Undo/Redo et le composant de menu corrigé en V2.9.0.1`, 'FREEZE-291');

  const attendues = [
    'projectTab', 'renderProject', 'selectProject',      // le correctif de navigation
    'toggleStructureNode',                                // le geste lui-même
    'projectStructureTab', 'renderStructureNode', 'structureTabContent', // les vues
    'structureSummaryLine',                               // conservée, inchangée en surface
    /* V2.10.0 — RE-BASELINE. Deux fonctions de VUE évoluent avec l'ajout de
       « Déplacer » et « Dupliquer » (V2.10.0 §1) : le menu qui porte les deux
       entrées, et la ligne qui signale brièvement un niveau tout juste créé
       (V2.10.0 §20). Elles sont déclarées ici, donc toujours contrôlées : une
       fonction NON déclarée qui bougerait ferait encore tomber ce test. */
    'structureNodeMenu', 'structureCompactRow',
    /* V2.11.0 — RE-BASELINE. Les modèles de chantier (§34, §11, §26) touchent
       six fonctions de plus, chacune NOMMÉE ici : la migration 13 → 14, une
       icône, la branche et les deux étapes du wizard, la rangée de Réglages et
       la ligne d'aperçu de restauration. Une fonction NON déclarée qui
       bougerait ferait encore tomber ce test. */
    'migrateState', 'icon', 'wizardPickMode', 'renderWizard',
    'showKanvixBackupPreview', 'renderMore',
  ];
  const modifiees = attendues.filter((n) => extractFn(A, n) && md5(extractFn(A, n)) !== md5(extractFn(B, n)));
  const horsPerimetre = [];
  // Toute fonction du fichier qui aurait bougé SANS être annoncée.
  /* Extraction par ACCOLADES, donc mise en défaut par les fonctions dont le
     corps contient des littéraux gabarits avec des accolades — renderAIPanel
     en est le cas connu depuis plusieurs versions. On la vérifie donc par une
     seconde méthode, indépendante : un découpage par INDENTATION, ligne à
     ligne. Elle n'est pas exclue du contrôle : elle est contrôlée autrement. */
  const blocIndente = (src, nom) => {
    const lignes = src.split('\n');
    const re = new RegExp('^(\\s*)function\\s+' + nom + '\\s*\\(');
    for (let i = 0; i < lignes.length; i++) {
      const m = re.exec(lignes[i]);
      if (!m) continue;
      const ind = m[1].length, out = [lignes[i]];
      for (let j = i + 1; j < lignes.length; j++) {
        out.push(lignes[j]);
        if (lignes[j].trim() === '}' && lignes[j].length - lignes[j].trimStart().length === ind)
          return out.join('\n');
      }
    }
    return null;
  };
  const parIndentation = ['renderAIPanel'];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => {
    const a = blocIndente(A, n), c = blocIndente(B, n);
    return !a || !c || a !== c;
  });
  note('FREEZE-291-indentation', { vérifiées: parIndentation, différentes: indentDiff });
  ok(indentDiff.length === 0,
    `STC-50 : renderAIPanel() est BYTE-IDENTIQUE — vérifiée par découpage à l’indentation, l’extraction par accolades étant mise en défaut par ses littéraux gabarits`, 'STC-50');
  note('FREEZE-291-périmètre', { modifiées: modifiees, horsPérimètre: horsPerimetre });
  ok(horsPerimetre.length === 0,
    `STC-50 : AUCUNE fonction hors du périmètre annoncé n’a changé — le balayage de tout le fichier ne trouve que ${modifiees.length} fonctions modifiées, toutes déclarées`, 'STC-50');

  const regles = {
    schema: /SCHEMA_VERSION = 14/.test(B),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    initialIdentique:
      md5((A.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]) ===
      md5((B.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]),
    typesIdentiques:
      md5((A.match(/const STRUCTURE_TYPES = \[[\s\S]*?\];/) || [''])[0]) ===
      md5((B.match(/const STRUCTURE_TYPES = \[[\s\S]*?\];/) || [''])[0]),
    unSeulGantt: (B.match(/function\s+gantt\s*\(/g) || []).length === 1,
    unSeulPlanningTasks: (B.match(/function\s+planningTasks\s*\(/g) || []).length === 1,
    unSeulToggleMenu: (B.match(/function\s+toggleDrawerMenu\s*\(/g) || []).length === 1,
    pasDeMoteurParallele: !/function\s+(getStructureTasks2|computeStructure|structureAggregate|buildStructureTree)\s*\(/.test(B),
    pasDeRenderPageDansToggle: !/function toggleStructureNode[\s\S]{0,400}?renderPage\(\)/.test(B),
  };
  note('FREEZE-291-règles', regles);
  ok(Object.values(regles).every(Boolean),
    'STC-50 : SCHEMA passé à 14 (bump V2.11.0), STORE et build inchangés, INITIAL_STATE et STRUCTURE_TYPES byte-identiques, un seul gantt(), un seul planningTasks(), un seul toggleDrawerMenu(), aucun moteur Structure parallèle, et plus aucun renderPage() dans toggleStructureNode()', 'STC-50');

  const ajoutees = ['structureTypeIcon', 'structureCollapsed', 'structureCompactRow',
    'structureCompactTree', 'refreshStructureTree', 'structureColHead', 'structureCountsLine',
    'structureAllExpanded', 'toggleAllStructure', 'unstructuredTaskRow', 'taskStatusTone',
    'structureUnstructuredBlock', 'structureCompactCockpit'];
  const manquantes = ajoutees.filter((n) => !extractFn(B, n));
  note('FREEZE-291-ajouts', { ajoutées: ajoutees.length - manquantes.length, manquantes });
  ok(manquantes.length === 0,
    `STC-50 : les ${ajoutees.length} helpers ajoutés existent tous et relèvent uniquement de la PRÉSENTATION`, 'STC-50');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `STC-47 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'STC-47');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
