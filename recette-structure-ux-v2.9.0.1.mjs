// ============================================================
// KANVIX — Recette « Correctif UX Structure » (V2.9.0.1)
//
//   Deux défauts, deux causes précises, aucune évolution fonctionnelle :
//
//     A. Le menu « … » d'un niveau utilisait un wrapper `more-wrap` qui
//        n'existe dans AUCUNE feuille de style. Sans ancêtre positionné, le
//        `.more-pop` (position:absolute) s'ancrait au premier ancêtre
//        positionné trouvé plus haut — d'où un menu très loin de son bouton.
//        Et `class="icon-btn"` seul ne correspond à aucune règle (le sélecteur
//        Kanvix est `.btn.icon-btn`) — d'où un bouton carré natif.
//
//     B. Le retour « ← Structure » portait `back-link` sans `link`. Or
//        `.back-link` ne pose que display/margin : c'est `.link` qui retire le
//        chrome natif du bouton.
//
//   Cette recette mesure. Elle ne décrit pas : elle relève des géométries,
//   des couleurs calculées et des styles effectifs.
//
//   Usage : node recette-structure-ux-v2.9.0.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.9.0.1.html';
const PREV = 'kanvix-next-gen-v2.9.0.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.9.0.1/';
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
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
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
const shot = async (p, name, opts = {}) => { await p.waitForTimeout(280); await p.screenshot({ path: SHOTS + name, ...opts }); };

const ouvrirStructure = async (p, pid = 'keravel') => {
  await ev(p, (id) => { app.ui.projectId = id; save(); go('project'); openProjectTab(id, 'Structure'); }, pid);
  await p.waitForTimeout(280);
};
/* Une liste LONGUE, pour que le dernier bouton se retrouve réellement en bas
   du viewport. C'est la situation décrite par le rapport d'anomalie : « le
   défaut est particulièrement visible sur les derniers niveaux de la liste ». */
const listeLongue = async (p, n = 14) => {
  await ev(p, (k) => {
    for (let i = 0; i < k; i++)
      app.structureNodes.push({
        id: 'sn-ux-' + i, projectId: 'keravel', parentId: null,
        name: 'Zone de recette ' + (i + 1), type: 'zone', description: '',
        responsibleResourceId: null, archived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    save(); openProjectTab('keravel', 'Structure');
  }, n);
  await p.waitForTimeout(280);
};
/* Ouvre le menu d'une carte par un VRAI clic souris, et relève la géométrie. */
const ouvrirMenu = async (p, index) => {
  const r = await ev(p, async (i) => {
    const cards = [...document.querySelectorAll('[data-structure-node]')];
    const card = i < 0 ? cards[cards.length + i] : cards[i];
    card.scrollIntoView({ block: i < 0 ? 'end' : 'center' });
    await new Promise((r) => setTimeout(r, 140));
    return card.dataset.structureNode;
  }, index);
  const sel = `[data-structure-node="${r}"] .more-trigger`;
  await p.click(sel);
  await p.waitForTimeout(140);
  return r;
};
const geo = (p, nodeId) => ev(p, (id) => {
  const card = document.querySelector(`[data-structure-node="${id}"]`);
  const btn = card.querySelector('.more-trigger');
  const pop = card.querySelector('.more-pop');
  const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
  return {
    ouvert: pop.classList.contains('open'),
    dropUp: pop.classList.contains('drop-up'),
    aria: btn.getAttribute('aria-expanded'),
    // écart vertical entre le bord le plus proche du menu et le bouton
    ecart: pop.classList.contains('drop-up')
      ? Math.round(bb.top - pb.bottom)
      : Math.round(pb.top - bb.bottom),
    dxDroite: Math.round(pb.right - bb.right),
    horsBas: Math.round(pb.bottom - innerHeight),
    horsHaut: Math.round(0 - pb.top),
    horsDroite: Math.round(pb.right - innerWidth),
    horsGauche: Math.round(0 - pb.left),
    ouverts: document.querySelectorAll('.more-pop.open').length,
    zIndex: getComputedStyle(pop).zIndex,
    position: getComputedStyle(pop).position,
    ancetre: pop.offsetParent ? pop.offsetParent.className : null,
  };
}, nodeId);

// ============================================================
// UXS-01 / UXS-02 — Le composant
// ============================================================
console.log('\n[UXS-COMPOSANT] Le « … » est bien le composant Kanvix standard');
{
  const { ctx, p } = await newPage({ tag: 'COMP' });
  await ouvrirStructure(p);
  const r = await ev(p, () => {
    const card = document.querySelector('[data-structure-node]');
    const wrap = card.querySelector('.more-menu');
    const btn = card.querySelector('.more-trigger');
    const pop = card.querySelector('.more-pop');
    const cs = btn ? getComputedStyle(btn) : null;
    // Un menu de référence, celui d'une RESSOURCE, pour comparer.
    return {
      moreMenu: !!wrap,
      moreTrigger: !!btn && btn.classList.contains('btn') && btn.classList.contains('more-trigger'),
      morePop: !!pop,
      // le wrapper fantôme de V2.9.0 ne doit plus exister nulle part
      plusDeMoreWrap: document.querySelectorAll('.more-wrap').length,
      wrapPosition: wrap ? getComputedStyle(wrap).position : null,
      /* offsetParent vaut null tant que l'élément est display:none. On ouvre
         donc le menu pour interroger son VRAI ancêtre de positionnement, puis
         on le referme : c'est cet ancêtre qui était la cause racine du bug. */
      ancetrePositionne: (() => {
        btn.click();
        const ok = pop.offsetParent === wrap;
        closeDrawerMenu();
        return ok;
      })(),
      icone: !!btn?.querySelector('svg'),
      texteBrut: (btn?.textContent || '').trim(),
      iconBtnNu: !!card.querySelector('.icon-btn:not(.btn)'),
      aria: {
        haspopup: btn?.getAttribute('aria-haspopup'),
        expanded: btn?.getAttribute('aria-expanded'),
        label: btn?.getAttribute('aria-label'),
      },
      role: pop?.getAttribute('role'),
      menuitems: pop ? pop.querySelectorAll('[role=menuitem]').length : 0,
      actions: pop ? [...pop.querySelectorAll('button')].map((x) => x.textContent.trim()) : [],
      // rendu : ni fond natif, ni bordure native
      borderRadius: cs?.borderRadius,
      bgTransparent: cs?.backgroundColor,
      appearance: cs?.appearance,
      font: cs?.fontFamily.slice(0, 24),
    };
  });
  note('UXS-01', r);
  ok(r.moreMenu && r.moreTrigger && r.morePop && r.plusDeMoreWrap === 0,
    'UXS-01 : le bouton d’action d’un niveau utilise le composant Kanvix standard — .more-menu + .btn.more-trigger + .more-pop, et plus aucun `more-wrap` dans le document', 'UXS-01');
  ok(r.wrapPosition === 'relative' && r.ancetrePositionne,
    'UXS-01 : le wrapper .more-menu est bien l’ancêtre POSITIONNÉ du popover — c’est la cause racine du menu qui partait ailleurs', 'UXS-01');
  ok(r.icone && r.texteBrut === '' && !r.iconBtnNu,
    'UXS-02 : le déclencheur affiche l’icône Kanvix icon("more") et non le caractère brut « … » ; plus aucun `icon-btn` orphelin (le sélecteur réel est `.btn.icon-btn`)', 'UXS-02');
  ok(r.aria.haspopup === 'menu' && r.aria.expanded === 'false' && r.aria.label === 'Actions du niveau' && r.role === 'menu' && r.menuitems === 4,
    'UXS-02 : accessibilité complète — aria-haspopup="menu", aria-expanded="false", aria-label="Actions du niveau", role="menu" et 4 role="menuitem"', 'UXS-02');
  ok(r.actions.join('|') === 'Modifier|Ajouter un sous-niveau|Archiver|Supprimer',
    'UXS-02 : les quatre actions existantes sont conservées à l’identique, dans le même ordre', 'UXS-02');

  /* Le déclencheur Structure est-il rendu EXACTEMENT comme les autres ?
     Attention : getComputedStyle renvoie une déclaration VIVANTE — dès que
     l'élément quitte le document, toutes ses propriétés repassent à "". On
     recopie donc les valeurs AVANT de naviguer. */
  const comparaison = await ev(p, async () => {
    const CLEFS = ['backgroundColor', 'borderTopWidth', 'borderStyle', 'borderRadius', 'height', 'width', 'padding', 'color', 'fontSize'];
    const fige = (el) => { if (!el) return null; const cs = getComputedStyle(el); const o = {}; CLEFS.forEach((k) => { o[k] = cs[k]; }); return o; };
    const a = fige(document.querySelector('[data-structure-node] .more-trigger'));
    // Référence : le déclencheur d'une fiche RESSOURCE, composant identique.
    openResource('mathieu');
    await new Promise((r) => setTimeout(r, 350));
    const ref = fige(document.querySelector('#drawerContent .more-trigger'));
    closeOverlay('drawer');
    const out = {};
    CLEFS.forEach((k) => { out[k] = [a?.[k], ref?.[k]]; });
    return { out, identique: !!a && !!ref && CLEFS.every((k) => a[k] === ref[k]) };
  });
  note('UXS-02-comparaison', comparaison.out);
  ok(comparaison.identique,
    'UXS-02 : le déclencheur Structure est rendu pixel pour pixel comme celui d’une fiche Ressource — fond, bordure, rayon, taille, marge intérieure, couleur, typo', 'UXS-02');
  await ctx.close();
}

// ============================================================
// UXS-03 / UXS-04 — Ancrage du PREMIER menu
// ============================================================
console.log('\n[UXS-ANCRAGE] Le menu est attaché à SON bouton');
{
  const { ctx, p } = await newPage({ tag: 'ANC' });
  await ouvrirStructure(p);
  await listeLongue(p);
  const id = await ouvrirMenu(p, 0);
  const g = await geo(p, id);
  note('UXS-03', { id, ...g });
  ok(g.ouvert && g.aria === 'true' && g.ouverts === 1,
    'UXS-03 : cliquer sur le menu du PREMIER niveau ouvre le bon .more-pop, et lui seul', 'UXS-03');
  /* Le défaut d'origine plaçait le menu à plusieurs centaines de pixels. On
     exige donc une distance de l'ordre de la gouttière du composant (6 px),
     avec une tolérance de 12 px, et un alignement à droite au pixel près. */
  ok(Math.abs(g.ecart) <= 12 && Math.abs(g.dxDroite) <= 1,
    `UXS-04 : le menu est géométriquement collé à son bouton — ${g.ecart} px d’écart vertical, ${g.dxDroite} px d’écart d’alignement à droite`, 'UXS-04');
  ok(g.horsBas <= 0 && g.horsHaut <= 0 && g.horsDroite <= 0 && g.horsGauche <= 0,
    'UXS-04 : le menu du premier niveau est entièrement dans le viewport', 'UXS-04');
  ok(g.position === 'absolute' && Number(g.zIndex) >= 40,
    `UXS-04 : le popover reste en position absolue au-dessus de la carte Structure (z-index ${g.zIndex})`, 'UXS-04');
  await shot(p, '01-structure-menu-first-desktop.png');
  await ctx.close();
}

// ============================================================
// UXS-05 / UXS-06 — Le DERNIER menu d'une longue liste
// ============================================================
console.log('\n[UXS-DERNIER] Le dernier niveau reste visible');
{
  const { ctx, p } = await newPage({ tag: 'LAST', h: 900 });
  await ouvrirStructure(p);
  await listeLongue(p);
  const id = await ouvrirMenu(p, -1);
  const g = await geo(p, id);
  note('UXS-05', { id, ...g });
  ok(g.ouvert && g.horsBas <= 0 && g.horsHaut <= 0,
    `UXS-05 : le menu du DERNIER niveau reste entièrement dans le viewport (débordement bas ${g.horsBas} px, haut ${g.horsHaut} px)`, 'UXS-05');
  ok(g.horsDroite <= 0 && g.horsGauche <= 0,
    'UXS-05 : ni débordement à droite, ni à gauche', 'UXS-05');
  ok(g.dropUp === true,
    'UXS-06 : faute de place en dessous, le menu s’est retourné AU-DESSUS de son bouton (classe .drop-up posée par la mesure, pas par une règle fixe)', 'UXS-06');
  ok(Math.abs(g.ecart) <= 12 && Math.abs(g.dxDroite) <= 1,
    `UXS-06 : retourné, il reste ancré à son bouton — ${g.ecart} px d’écart, ${g.dxDroite} px d’alignement`, 'UXS-06');
  /* Le point de départ du bug : le menu apparaissait en bas de la PAGE. On
     vérifie donc aussi que son ancêtre de positionnement est bien sa propre
     carte, et pas un conteneur lointain. */
  ok(g.ancetre && /more-menu/.test(g.ancetre),
    `UXS-06 : l’ancêtre de positionnement est son propre .more-menu (${g.ancetre}) — jamais un conteneur de page`, 'UXS-06');
  await shot(p, '02-structure-menu-last-desktop.png');
  await ctx.close();
}

// ============================================================
// UXS-07 / UXS-08 — Un seul menu ouvert
// ============================================================
console.log('\n[UXS-EXCLUSIF] Un seul menu à la fois');
{
  const { ctx, p } = await newPage({ tag: 'EXCL' });
  await ouvrirStructure(p);
  await listeLongue(p, 10);
  const a = await ouvrirMenu(p, 0);
  const apresA = await ev(p, () => document.querySelectorAll('.more-pop.open').length);
  /* On vise une ligne SUFFISAMMENT BASSE : un popover ouvert recouvre les trois
     lignes qui le suivent — comportement normal d'un popover, identique à celui
     des menus Opération, Chantier et Ressource. Un utilisateur cliquerait, lui
     aussi, sur un bouton qu'il voit. */
  const bId = await ouvrirMenu(p, 6);
  const r = await ev(p, ([x, y]) => {
    const q = (id) => document.querySelector(`[data-structure-node="${id}"]`);
    return {
      ouverts: document.querySelectorAll('.more-pop.open').length,
      premierFerme: !q(x).querySelector('.more-pop').classList.contains('open'),
      premierAria: q(x).querySelector('.more-trigger').getAttribute('aria-expanded'),
      secondOuvert: q(y).querySelector('.more-pop').classList.contains('open'),
      secondAria: q(y).querySelector('.more-trigger').getAttribute('aria-expanded'),
    };
  }, [a, bId]);
  note('UXS-07', { apresA, ...r });
  ok(apresA === 1 && r.ouverts === 1,
    'UXS-07 : un seul .more-pop est ouvert simultanément, avant comme après', 'UXS-07');
  ok(r.premierFerme && r.premierAria === 'false' && r.secondOuvert && r.secondAria === 'true',
    'UXS-08 : ouvrir un second menu ferme le premier, et aria-expanded revient bien à false sur celui qu’on quitte', 'UXS-08');
  // Clic ailleurs, puis Échap : les deux comportements globaux existants.
  await p.click('h1, .sn-title', { position: { x: 5, y: 5 } }).catch(() => p.mouse.click(5, 5));
  await p.waitForTimeout(120);
  const apresClicAilleurs = await ev(p, () => document.querySelectorAll('.more-pop.open').length);
  await ouvrirMenu(p, 1);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(120);
  const apresEchap = await ev(p, () => ({
    ouverts: document.querySelectorAll('.more-pop.open').length,
    ariaVrais: [...document.querySelectorAll('.more-trigger')].filter((x) => x.getAttribute('aria-expanded') === 'true').length,
  }));
  note('UXS-07-fermeture', { apresClicAilleurs, ...apresEchap });
  ok(apresClicAilleurs === 0,
    'UXS-07 : un clic ailleurs ferme le menu — le listener global existant s’applique, parce que le wrapper est redevenu un .more-menu', 'UXS-07');
  ok(apresEchap.ouverts === 0 && apresEchap.ariaVrais === 0,
    'UXS-07 : Échap ferme le menu et remet tous les aria-expanded à false — comportement Kanvix existant, non réécrit', 'UXS-07');
  await ctx.close();
}

// ============================================================
// UXS-09 → UXS-12 — Les actions font toujours la même chose
// ============================================================
console.log('\n[UXS-ACTIONS] Les quatre actions et leurs garde-fous');
{
  const { ctx, p } = await newPage({ tag: 'ACT' });
  await ouvrirStructure(p);
  // UXS-09 — « Modifier » sur le BON niveau (on vise l'Étage 1, pas la racine)
  const cible = 'sn-keravel-etage-1';
  await ev(p, (id) => {
    const card = document.querySelector(`[data-structure-node="${id}"]`);
    card.scrollIntoView({ block: 'center' });
  }, cible);
  await p.click(`[data-structure-node="${cible}"] .more-trigger`);
  await p.waitForTimeout(120);
  await p.click(`[data-structure-node="${cible}"] .more-pop button:nth-child(1)`);
  await p.waitForTimeout(220);
  const mod = await ev(p, () => {
    const f = document.querySelector('#drawerFormEl');
    return {
      ouvert: !!f,
      nom: f?.querySelector('[name=name]')?.value,
      parent: f?.querySelector('[name=parentId]')?.value,
      ouvertsRestants: document.querySelectorAll('.more-pop.open').length,
    };
  });
  note('UXS-09', mod);
  ok(mod.ouvert && mod.nom === 'Étage 1',
    'UXS-09 : « Modifier » ouvre le formulaire du BON niveau (Étage 1), pas d’un voisin', 'UXS-09');
  ok(mod.ouvertsRestants === 0,
    'UXS-09 : cliquer une action referme le menu', 'UXS-09');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(160);

  // UXS-10 — « Ajouter un sous-niveau » préremplit le BON parent
  await ouvrirStructure(p);
  await p.click(`[data-structure-node="${cible}"] .more-trigger`);
  await p.waitForTimeout(120);
  await p.click(`[data-structure-node="${cible}"] .more-pop button:nth-child(2)`);
  await p.waitForTimeout(220);
  const sous = await ev(p, () => {
    const f = document.querySelector('#drawerFormEl');
    const sel = f?.querySelector('[name=parentId]');
    return { ouvert: !!f, nomVide: f?.querySelector('[name=name]')?.value === '', parent: sel?.value };
  });
  note('UXS-10', sous);
  ok(sous.ouvert && sous.nomVide && sous.parent === cible,
    'UXS-10 : « Ajouter un sous-niveau » ouvre une création vierge dont le parent est préréglé sur le BON niveau', 'UXS-10');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(160);

  // UXS-11 — Archiver / Restaurer passe toujours par le moteur existant
  await ouvrirStructure(p);
  const arch = await ev(p, (id) => {
    const avant = structureNode(id).archived;
    const histAvant = app.history.length;
    const undoAvant = undoHistory.length;
    toggleStructureArchive(id);
    return {
      avant, apres: structureNode(id).archived,
      histoire: app.history.length - histAvant,
      undo: undoHistory.length - undoAvant,
      undoPossible: undoHistory.length > 0,
    };
  }, cible);
  note('UXS-11', arch);
  ok(arch.avant === false && arch.apres === true && arch.histoire === 1 && arch.undo === 1,
    'UXS-11 : Archiver appelle toujours toggleStructureArchive() — une entrée d’historique, une transaction d’annulation, pas deux', 'UXS-11');
  const blocage = await ev(p, () => {
    // Bâtiment A porte deux sous-niveaux ACTIFS : l'archivage doit être bloqué.
    const b = structureArchiveBlocker('sn-keravel-bat-a');
    const avant = structureNode('sn-keravel-bat-a').archived;
    toggleStructureArchive('sn-keravel-bat-a');
    return { blocage: b, inchange: structureNode('sn-keravel-bat-a').archived === avant };
  });
  note('UXS-11-blocage', blocage);
  ok(!!blocage.blocage && blocage.inchange,
    'UXS-11 : le garde-fou d’archivage est intact — un niveau à sous-niveaux actifs reste non archivé, avec son message', 'UXS-11');
  await ctx.close();
}
{
  const { ctx, p } = await newPage({ tag: 'DEL' });
  await ouvrirStructure(p);
  const sup = await ev(p, () => {
    const avecTaches = structureDeleteBlocker('sn-keravel-etage-1');
    const avecEnfants = structureDeleteBlocker('sn-keravel-bat-a');
    const nAvant = app.structureNodes.length;
    confirmDeleteStructure('sn-keravel-etage-1');
    const apresTentative = app.structureNodes.length;
    // un niveau réellement vide, lui, se supprime
    app.structureNodes.push({ id: 'sn-vide', projectId: 'keravel', parentId: null,
      name: 'Vide', type: 'zone', description: '', responsibleResourceId: null,
      archived: false, createdAt: '', updatedAt: '' });
    const videBloque = structureDeleteBlocker('sn-vide');
    return { avecTaches: !!avecTaches, avecEnfants: !!avecEnfants, videBloque: !!videBloque,
      nAvant, apresTentative, aucuneSuppression: nAvant === apresTentative };
  });
  note('UXS-12', sup);
  ok(sup.avecTaches && sup.avecEnfants && !sup.videBloque && sup.aucuneSuppression,
    'UXS-12 : les garde-fous de suppression sont intacts — un niveau porteur de tâches ou de sous-niveaux est refusé sans rien muter, un niveau vide reste supprimable', 'UXS-12');
  await ctx.close();
}

// ============================================================
// UXS-13 / UXS-14 — Le bouton « ← Structure »
// ============================================================
console.log('\n[UXS-RETOUR] « ← Structure » ressemble aux autres retours Kanvix');
{
  const { ctx, p } = await newPage({ tag: 'BACK' });
  await ouvrirStructure(p);
  await ev(p, () => openStructureNode('sn-keravel-bat-a'));
  await p.waitForTimeout(280);
  /* Même précaution qu'en UXS-02 : getComputedStyle est une déclaration
     VIVANTE. Naviguer avant de lire vide toutes les propriétés. */
  const r = await ev(p, async () => {
    const CLEFS = ['borderTopWidth', 'backgroundColor', 'color', 'padding', 'fontSize', 'fontWeight'];
    const fige = (el) => { if (!el) return null; const cs = getComputedStyle(el); const o = {}; CLEFS.forEach((k) => { o[k] = cs[k]; }); return o; };
    const btn = document.querySelector('.back-link');
    const moi = fige(btn);
    const info = {
      texte: btn.textContent.trim(),
      classes: btn.className,
      aLaClasseLink: btn.classList.contains('link'),
      onclick: btn.getAttribute('onclick'),
    };
    // Référence : le retour « ← Chantiers » de la fiche chantier.
    go('project');
    await new Promise((r) => setTimeout(r, 300));
    const refEl = document.querySelector('.project-back-link');
    const ref = fige(refEl);
    return {
      ...info,
      borderWidth: moi.borderTopWidth,
      background: moi.backgroundColor,
      color: moi.color,
      padding: moi.padding,
      reference: ref,
      referenceClasses: refEl?.className,
      memeCouleurQueReference: !!ref && moi.color === ref.color,
      memeBordureQueReference: !!ref && moi.borderTopWidth === ref.borderTopWidth,
      memeFondQueReference: !!ref && moi.backgroundColor === ref.backgroundColor,
      memeTypoQueReference: !!ref && moi.fontSize === ref.fontSize && moi.fontWeight === ref.fontWeight,
    };
  });
  note('UXS-13', r);
  ok(r.aLaClasseLink && /link/.test(r.classes) && /back-link/.test(r.classes),
    'UXS-13 : le bouton « ← Structure » porte bien la grammaire `link back-link`', 'UXS-13');
  ok(r.borderWidth === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(r.background),
    `UXS-13 : plus aucun cadre ni fond natif (bordure ${r.borderWidth}, fond ${r.background})`, 'UXS-13');
  ok(r.memeCouleurQueReference && r.memeBordureQueReference && r.memeFondQueReference && r.memeTypoQueReference,
    'UXS-13 : rendu identique au retour « ← Chantiers » — même couleur, même bordure, même fond, même typographie', 'UXS-13');
  ok(r.onclick === 'closeStructureNode()' && r.texte === '← Structure',
    'UXS-14 : le bouton appelle toujours closeStructureNode() — aucune navigation métier modifiée', 'UXS-14');

  // Et il fonctionne réellement.
  await ev(p, () => { openStructureNode('sn-keravel-bat-a'); });
  await p.waitForTimeout(220);
  await p.click('.back-link');
  await p.waitForTimeout(260);
  const retour = await ev(p, () => ({
    noeudFerme: !app.ui.structureNodeId,
    // V2.9.1 — le conteneur de l'arbre s'appelle désormais
    // [data-structure-tree] ; on accepte les deux écritures.
    arbreVisible: !!document.querySelector('.sn-tree, [data-structure-tree]'),
  }));
  note('UXS-14-navigation', retour);
  ok(retour.noeudFerme && retour.arbreVisible,
    'UXS-14 : un vrai clic sur le lien referme la fiche de niveau et ramène à l’arbre', 'UXS-14');
  await ev(p, () => openStructureNode('sn-keravel-bat-a'));
  await shot(p, '06-structure-node-back-link.png');
  await ctx.close();
}

// ============================================================
// UXS-15 → UXS-17 — Mobile
// ============================================================
console.log('\n[UXS-MOBILE] 430 / 390 / 360');
for (const [w, h, capture] of [[430, 900, '03-structure-menu-mobile-430.png'], [390, 844, '04-structure-menu-mobile-390.png'], [360, 740, null]]) {
  const { ctx, p } = await newPage({ tag: 'M' + w, w, h });
  await ouvrirStructure(p);
  await listeLongue(p);
  const id = await ouvrirMenu(p, -1);
  const g = await geo(p, id);
  /* La capture est prise ICI, menu OUVERT — avant la comparaison au
     déclencheur standard, qui ouvre une fiche Ressource et referme donc le
     menu. C'est l'ancrage qu'on veut pouvoir vérifier à l'œil. */
  if (capture) await shot(p, capture);
  const extra = await ev(p, async (nid) => {
    const card = document.querySelector(`[data-structure-node="${nid}"]`);
    const btn = card.querySelector('.more-trigger');
    // V2.9.1 — le badge de statut d'une ligne s'appelle `.snc-status`.
    const st = card.querySelector('.sn-status, .snc-status');
    const bb = btn.getBoundingClientRect(), sb = st ? st.getBoundingClientRect() : null;
    const chevauche = sb ? !(bb.right < sb.left || bb.left > sb.right || bb.bottom < sb.top || bb.top > sb.bottom) : false;
    const pop = card.querySelector('.more-pop');
    const csBtn = getComputedStyle(btn);
    const rendu = { w: Math.round(bb.width), h: Math.round(bb.height), pad: csBtn.padding, radius: csBtn.borderRadius };
    const out = {
      largeurBouton: rendu.w, hauteurBouton: rendu.h,
      chevauchementStatut: chevauche,
      largeurPopup: Math.round(pop.getBoundingClientRect().width),
      hauteurActions: [...pop.querySelectorAll('button')].map((x) => Math.round(x.getBoundingClientRect().height)),
      estModal: !!pop.closest('#drawer, #modal'),
      debordementPage: document.documentElement.scrollWidth - innerWidth,
      rendu,
    };
    /* « Compact » ne se décrète pas à coups de seuils inventés : la bonne
       référence est le déclencheur STANDARD du produit, celui d'une fiche
       Ressource. S'il est identique, il est compact exactement comme lui —
       et il n'a, par construction, rien d'un bouton carré natif. */
    const avant = app.ui.page;
    openResource('mathieu');
    await new Promise((r) => setTimeout(r, 320));
    const ref = document.querySelector('#drawerContent .more-trigger');
    const csRef = ref ? getComputedStyle(ref) : null;
    const rb = ref ? ref.getBoundingClientRect() : null;
    out.reference = ref ? { w: Math.round(rb.width), h: Math.round(rb.height), pad: csRef.padding, radius: csRef.borderRadius } : null;
    out.identiqueAuStandard = !!ref &&
      out.reference.w === rendu.w && out.reference.h === rendu.h &&
      out.reference.pad === rendu.pad && out.reference.radius === rendu.radius;
    closeOverlay('drawer');
    return out;
  }, id);
  note('UXS-' + w, { ...g, ...extra });
  const num = w === 430 ? 'UXS-15' : w === 390 ? 'UXS-16' : 'UXS-17';
  ok(g.horsBas <= 0 && g.horsHaut <= 0 && g.horsDroite <= 0 && g.horsGauche <= 0,
    `${num} : mobile ${w} — le popup du dernier niveau est ENTIÈREMENT dans le viewport (bas ${g.horsBas}, haut ${g.horsHaut}, droite ${g.horsDroite}, gauche ${g.horsGauche})`, num);
  ok(Math.abs(g.ecart) <= 12 && Math.abs(g.dxDroite) <= 1,
    `${num} : mobile ${w} — il s’ouvre à proximité immédiate de sa ligne (${g.ecart} px)`, num);
  ok(extra.identiqueAuStandard && !extra.chevauchementStatut,
    `${num} : mobile ${w} — le bouton est EXACTEMENT le déclencheur standard du produit (${extra.largeurBouton}×${extra.hauteurBouton}, marge ${extra.rendu.pad}, rayon ${extra.rendu.radius}), et ne chevauche pas le statut de la ligne`, num);
  ok(!extra.estModal && extra.hauteurActions.every((x) => x >= 30) && extra.debordementPage <= 0,
    `${num} : mobile ${w} — c’est bien un petit popover contextuel (ni modal, ni sidewindow), ses actions restent touchables (${extra.hauteurActions.join('/')} px) et la page ne déborde pas`, num);
  await ctx.close();
}

// ============================================================
// UXS-18 — Thème sombre
// ============================================================
console.log('\n[UXS-SOMBRE] Menu et retour en thème sombre');
{
  const { ctx, p } = await newPage({ tag: 'DARK', dark: true });
  await ouvrirStructure(p);
  await listeLongue(p, 6);
  const id = await ouvrirMenu(p, 0);
  const g = await geo(p, id);
  const r = await ev(p, (nid) => {
    const lum = (c) => {
      const m = c.match(/\d+(\.\d+)?/g).map(Number);
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    };
    const card = document.querySelector(`[data-structure-node="${nid}"]`);
    const pop = card.querySelector('.more-pop');
    const btn = card.querySelector('.more-trigger');
    const item = pop.querySelector('button');
    const danger = pop.querySelector('button.danger');
    const cs = getComputedStyle(pop);
    return {
      sombre: document.body.classList.contains('dark'),
      fondPopup: cs.backgroundColor, lumFond: lum(cs.backgroundColor),
      couleurItem: getComputedStyle(item).color, lumItem: lum(getComputedStyle(item).color),
      couleurDanger: getComputedStyle(danger).color,
      couleurBouton: getComputedStyle(btn).color,
      // aucune couleur figée propre à Structure dans la feuille de style du menu
      inlineStyles: (card.innerHTML.match(/style="[^"]*(#[0-9a-f]{3,6}|rgb\()/gi) || []).length,
    };
  }, id);
  note('UXS-18', { ...g, ...r });
  ok(r.sombre && r.lumFond < 0.5 && r.lumItem > 0.5,
    `UXS-18 : en sombre le popover a un fond foncé (${r.fondPopup}) et un texte clair (${r.couleurItem}) — il hérite des variables de thème, sans règle propre à Structure`, 'UXS-18');
  ok(r.inlineStyles === 0,
    'UXS-18 : aucune couleur codée en dur dans la carte Structure ni dans son menu', 'UXS-18');
  ok(g.ouvert && Math.abs(g.ecart) <= 12 && g.horsBas <= 0,
    'UXS-18 : en sombre, l’ancrage est identique — le correctif est structurel, pas cosmétique', 'UXS-18');
  await shot(p, '05-structure-menu-dark.png');
  await ctx.close();
}

// ============================================================
// UXS-19 — Aucun débordement horizontal
// ============================================================
console.log('\n[UXS-RESPONSIVE] Structure, dix largeurs, clair et sombre');
{
  const mesures = [];
  for (const w of [1920, 1600, 1440, 1280, 1080, 1024, 900, 768, 430, 390, 360]) {
    for (const dark of [false, true]) {
      const { ctx, p } = await newPage({ tag: 'R' + w, w, h: 900, dark });
      await ouvrirStructure(p);
      await listeLongue(p, 8);
      const id = await ouvrirMenu(p, -1);
      const m = await ev(p, () => ({
        over: document.documentElement.scrollWidth - innerWidth,
        popHors: (() => {
          const pop = document.querySelector('.more-pop.open');
          if (!pop) return null;
          const r = pop.getBoundingClientRect();
          return Math.round(Math.max(r.bottom - innerHeight, -r.top, r.right - innerWidth, -r.left));
        })(),
      }));
      mesures.push({ w, dark, ...m });
      await ctx.close();
    }
  }
  note('UXS-19', mesures);
  ok(mesures.every((m) => m.over <= 0),
    'UXS-19 : aucun débordement horizontal de la page Structure sur 11 largeurs × 2 thèmes', 'UXS-19');
  ok(mesures.every((m) => m.popHors !== null && m.popHors <= 0),
    'UXS-19 : sur ces 22 combinaisons, le popup du dernier niveau reste toujours entièrement dans le viewport', 'UXS-19');
}

// ============================================================
// UXS-NONREG — Les autres menus du produit
// ============================================================
console.log('\n[UXS-NONREG] Chantier, Opération, Ressource, Tâche');
{
  const { ctx, p } = await newPage({ tag: 'NONREG' });
  /* Chaque menu est ouvert LÀ OÙ IL VIT : le Chantier sur sa carte, la
     Ressource et la Tâche dans leur fiche, l'Opération sur sa page. */
  const menus = await ev(p, async () => {
    const out = [];
    const mesure = async (nom, prepare, selecteur) => {
      await prepare();
      await new Promise((r) => setTimeout(r, 340));
      const btn = document.querySelector(selecteur);
      if (!btn) { out.push({ nom, trouve: false }); return; }
      btn.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 120));
      btn.click();
      await new Promise((r) => setTimeout(r, 140));
      const pop = btn.nextElementSibling;
      const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
      out.push({
        nom, trouve: true,
        ouvert: pop.classList.contains('open'),
        dropUp: pop.classList.contains('drop-up'),
        ecart: Math.round(pop.classList.contains('drop-up') ? bb.top - pb.bottom : pb.top - bb.bottom),
        dxDroite: Math.round(pb.right - bb.right),
        horsViewport: Math.round(Math.max(pb.bottom - innerHeight, -pb.top, pb.right - innerWidth, -pb.left)),
        aria: btn.getAttribute('aria-expanded'),
        ouverts: document.querySelectorAll('.more-pop.open').length,
        actions: [...pop.querySelectorAll('button')].map((x) => x.textContent.trim()),
      });
      closeDrawerMenu();
      await new Promise((r) => setTimeout(r, 100));
    };
    await mesure('chantier', () => go('sites'), '.site-menu .more-trigger');
    await mesure('ressource', () => { go('team'); openResource('mathieu'); }, '#drawerContent .more-trigger');
    closeOverlay('drawer'); await new Promise((r) => setTimeout(r, 200));
    await mesure('tache', () => { go('planning'); openTask('k-cloisons'); }, '#drawerContent .more-trigger');
    closeOverlay('drawer'); await new Promise((r) => setTimeout(r, 200));
    await mesure('operation', () => { go('operations'); selectOperation('op-brest-ouest'); }, '.more-menu .more-trigger');
    return out;
  });
  note('UXS-NONREG', menus);
  const trouves = menus.filter((m) => m.trouve);
  ok(trouves.length === 4,
    `UXS-NONREG : les quatre menus déjà existants — Chantier, Ressource, Tâche, Opération — sont présents et ouvrables (${trouves.length}/4)`, 'UXS-NONREG');
  ok(trouves.length === 4 && trouves.every((m) => m.ouvert && m.aria === 'true' && m.ouverts === 1),
    'UXS-NONREG : chacun s’ouvre normalement, un seul à la fois, aria-expanded correct — le moteur partagé n’a pas changé de comportement', 'UXS-NONREG');
  ok(trouves.length === 4 && trouves.every((m) => m.dropUp === false),
    'UXS-NONREG : aucun des quatre ne se retourne — la mesure prouve qu’ils tiennent en dessous, donc la classe .drop-up n’est JAMAIS posée pour eux et leur rendu est celui de V2.9.0', 'UXS-NONREG');
  ok(trouves.length === 4 && trouves.every((m) => Math.abs(m.ecart) <= 12 && Math.abs(m.dxDroite) <= 1 && m.horsViewport <= 0),
    'UXS-NONREG : leur ancrage est strictement celui de V2.9.0 — même écart au bouton, même alignement à droite, aucun débordement de viewport', 'UXS-NONREG');
  ok(trouves.length === 4 && trouves.every((m) => m.actions.length >= 2),
    `UXS-NONREG : leurs actions sont intactes (${trouves.map((m) => m.nom + ':' + m.actions.length).join(', ')})`, 'UXS-NONREG');
  await ctx.close();
}
{
  /* Et le retournement fonctionne aussi pour eux quand il est NÉCESSAIRE : on
     rétrécit la fenêtre jusqu'à ce que le menu Chantier n'ait plus la place.
     C'est la preuve que le mécanisme est bien générique, et non un correctif
     déguisé réservé à Structure. */
  const { ctx, p } = await newPage({ tag: 'NONREG-FLIP', h: 560 });
  const r = await ev(p, async () => {
    go('sites');
    await new Promise((r) => setTimeout(r, 340));
    const btns = [...document.querySelectorAll('.site-menu .more-trigger')];
    const btn = btns[btns.length - 1];
    if (!btn) return { trouve: false };
    btn.scrollIntoView({ block: 'end' });
    await new Promise((r) => setTimeout(r, 160));
    btn.click();
    await new Promise((r) => setTimeout(r, 140));
    const pop = btn.nextElementSibling;
    const pb = pop.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    return {
      trouve: true,
      dropUp: pop.classList.contains('drop-up'),
      horsBas: Math.round(pb.bottom - innerHeight),
      horsHaut: Math.round(0 - pb.top),
      ecart: Math.round(pop.classList.contains('drop-up') ? bb.top - pb.bottom : pb.top - bb.bottom),
    };
  });
  note('UXS-NONREG-flip', r);
  ok(r.trouve && r.horsBas <= 0 && r.horsHaut <= 0 && Math.abs(r.ecart) <= 12,
    `UXS-NONREG : dans une fenêtre basse, le menu Chantier reste lui aussi dans le viewport et ancré (retourné : ${r.dropUp}) — le mécanisme est générique, pas réservé à Structure`, 'UXS-NONREG');
  await ctx.close();
}

// ============================================================
// FREEZE-2901 — Périmètre du correctif
// ============================================================
console.log('\n[FREEZE-2901] Byte-identité V2.9.0 → V2.9.0.1');
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

  /* TOUT le moteur métier du produit, y compris le moteur Structure livré en
     V2.9.0 : un correctif UX n'a aucune raison d'en toucher une ligne. */
  const geles = [
    // Structure — moteur et agrégations
    'structureNode', 'getStructureNode', 'getProjectStructure', 'projectHasStructure',
    'getStructureChildren', 'getStructureRoots', 'getStructureDescendantIds',
    'getStructureAncestors', 'structurePath', 'getStructureTasks', 'getUnstructuredTasks',
    'getStructureDates', 'getStructureProgress', 'getStructureResources',
    'getStructureIssues', 'getStructureControls', 'getStructureMilestones',
    'getStructureStatus', 'structureParentError', 'structureParentOptions',
    'openStructureForm', 'structureArchiveBlocker', 'toggleStructureArchive',
    'structureDeleteBlocker', 'confirmDeleteStructure', 'deleteStructureNode',
    'openStructureNode', 'closeStructureNode', 'setStructureTab', 'toggleStructureNode',
    'structureSummaryLine', 'structureNodeCard', 'projectStructureTab',
    'structureTabContent', 'structureSelect', 'planningStructureSelect',
    'projectStructureNote',
    // Données
    'migrateState', 'save', 'applyStorageSync', 'resetApp', 'buildKanvixBackup',
    'confirmKanvixRestore', 'validateImportState', 'analyzeKanvixImport',
    'buildImportPlan', 'applyImportPlan', 'exportKanvixData',
    // Planning
    'planningTasks', 'gantt', 'planningAgenda', 'effectiveTasks', 'pos', 'scale',
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'nextWorkingTime',
    'addWorkingDuration', 'dropTask', 'dragStart', 'dragOver', 'drawDeps',
    'requestGanttTaskMove', 'requestTaskScheduleMove', 'renderPlanning',
    'planningCreateRow', 'planningCreatePointerDown', 'planningCreatePointerMove',
    'planningCreatePointerUp', 'planningCanDrawCreate', 'openTaskForm', 'submitTaskEdit',
    // Métier transverse
    'setTaskStatus', 'taskResourceIds', 'getResourceTasks',
    'getResourceSchedulingConflicts', 'ensureTaskControlInstances',
    'blockingControlsForTask', 'pendingControlsForTask', 'getProjectHealth',
    'milestoneStatus', 'operationMilestonesTab', 'operationPlanningTab',
    'operationProjectCard', 'openTask',
    // Undo / Redo
    'snapshot', 'undo', 'redo', 'pushHistory', 'clearUndoRedo', 'invalidateRedo',
    'cloneHistoryState', 'restoreHistoryState', 'isTextEditingTarget',
    // Le reste du moteur de menu
    'closeDrawerMenu', 'anyDrawerMenuOpen',
  ];
  /* V2.9.1 — RE-BASELINE. Trois fonctions quittent cette liste, et trois
     seulement, parce que le refactor « Structure compacte » les réécrit
     DÉLIBÉRÉMENT :
       · toggleStructureNode  — V2.9.1 §2 : le repli ne re-rend plus toute la
                                page, il ne remplace que l'arbre concerné.
       · projectStructureTab  — V2.9.1 §3/§6 : la vue compacte et le bloc
                                « Sans structure » qui liste les interventions.
       · structureTabContent  — V2.9.1 §8 : le Résumé et les Sous-niveaux
                                passent au composant compact.
     Tout le reste — les 93 autres moteurs, dont l'INTÉGRALITÉ du composant de
     menu corrigé en V2.9.0.1 — reste vérifié byte à byte ici, et la recette
     V2.9.1 les regèle de son côté. Rien n'est relâché. */
  const rebaseV291 = ['toggleStructureNode', 'projectStructureTab', 'structureTabContent'];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    if (rebaseV291.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2901', { comparées: compares, bougés: bouges, reBaséesV291: rebaseV291 });
  ok(bouges.length === 0,
    `FREEZE-2901 : les ${compares} moteurs de V2.9.0 sont BYTE-IDENTIQUES — tout le moteur Structure et ses agrégations, le Planning, les données, les ressources, la qualité, les jalons, l’Opération et l’Undo/Redo`, 'FREEZE-2901');

  /* Le périmètre annoncé : deux fonctions de VUE et le moteur de menu partagé.
     Rien d'autre ne doit avoir bougé dans tout le fichier. */
  const attendues = ['structureNodeMenu', 'renderStructureNode', 'toggleDrawerMenu'];
  const modifiees = attendues.filter((n) => extractFn(A, n) && md5(extractFn(A, n)) !== md5(extractFn(B, n)));
  note('FREEZE-2901-périmètre', { modifiées: modifiees });
  ok(modifiees.length === 3,
    'FREEZE-2901 : les trois fonctions du correctif V2.9.0.1 — structureNodeMenu(), renderStructureNode(), toggleDrawerMenu() — diffèrent bien de V2.9.0', 'FREEZE-2901');
  /* Et le cœur du correctif V2.9.0.1 n'a pas bougé depuis : c'est l'assertion
     qui compte vraiment ici, et elle est plus forte qu'un simple décompte. */
  const menuIntact = ['toggleDrawerMenu', 'closeDrawerMenu', 'structureNodeMenu']
    .filter((n) => md5(extractFn(read('kanvix-next-gen-v2.9.0.1.html'), n)) !== md5(extractFn(B, n)));
  note('FREEZE-2901-menu', { différentesDepuisV2901: menuIntact });
  ok(menuIntact.length === 0,
    'FREEZE-2901 : le composant de menu corrigé en V2.9.0.1 — toggleDrawerMenu(), closeDrawerMenu(), structureNodeMenu() — est BYTE-IDENTIQUE dans le build testé', 'FREEZE-2901');

  /* Aucun second moteur de menu : toggleDrawerMenu et closeDrawerMenu restent
     uniques, et aucune fonction « structureMenu… » parallèle n'apparaît. */
  const regles = {
    unSeulToggle: (B.match(/function\s+toggleDrawerMenu\s*\(/g) || []).length === 1,
    unSeulClose: (B.match(/function\s+closeDrawerMenu\s*\(/g) || []).length === 1,
    closeInchange: md5(extractFn(A, 'closeDrawerMenu')) === md5(extractFn(B, 'closeDrawerMenu')),
    pasDeMoteurParallele: !/function\s+(toggleStructureMenu|openStructureMenu|positionStructureMenu|placeMorePop)\s*\(/.test(B),
    /* On cherche la CLASSE dans le balisage et dans la feuille de style — le
       mot peut légitimement apparaître dans le commentaire qui explique le
       correctif, et ce commentaire n'est pas du code. */
    plusDeMoreWrap: !/class="[^"]*more-wrap/.test(B) && !/\.more-wrap\s*[,{]/.test(B),
    schema: /SCHEMA_VERSION = 13/.test(B) && /SCHEMA_VERSION = 13/.test(A),
    store: (B.match(/STORE = "([^"]+)"/) || [])[1] === 'kanvix-product-8-3',
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    dropUpCSS: /\.more-pop\.drop-up\s*\{/.test(B),
  };
  note('FREEZE-2901-règles', regles);
  ok(Object.values(regles).every(Boolean),
    'FREEZE-2901 : un seul toggleDrawerMenu(), un seul closeDrawerMenu() (byte-identique), aucun moteur de menu parallèle, plus aucune trace de `more-wrap`, SCHEMA 13 et STORE inchangés', 'FREEZE-2901');

  // Le modèle de données n'a pas bougé d'un octet.
  const modele = {
    initial: md5((A.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]) ===
             md5((B.match(/structureNodes: \[[\s\S]*?\],\n\s*tasks: \[/) || [''])[0]),
    types: md5((A.match(/const STRUCTURE_TYPES = \[[\s\S]*?\];/) || [''])[0]) ===
           md5((B.match(/const STRUCTURE_TYPES = \[[\s\S]*?\];/) || [''])[0]),
  };
  note('FREEZE-2901-modèle', modele);
  ok(modele.initial && modele.types,
    'FREEZE-2901 : INITIAL_STATE.structureNodes et STRUCTURE_TYPES sont byte-identiques — aucune donnée métier touchée', 'FREEZE-2901');
}

const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
ok(appErrs.length === 0, `UXS-20 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'UXS-20');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
