// ============================================================
// KANVIX — Recette corrective « CERTIFICATION V2.12.2.1 »
//
//   Corrige DEUX insuffisances de validation de V2.12.2, sans toucher aux
//   décisions produit R2-R4 :
//
//   1. ÉTAT ARTISAN HISTORIQUE — un état persistant écrit AVANT le retrait
//      des sélecteurs de rôle de démonstration (V2.12.1 ou antérieur) peut
//      porter settings.role="artisan" / ui.page="artisan". Sans sélecteur
//      visible, l'utilisateur resterait bloqué sans commande de retour.
//      migrateState() normalise désormais cet état hérité vers driver/today,
//      SANS toucher aux données métier ni réintroduire de sélecteur.
//
//   2. REJEU RÉEL DE LA RECETTE V2.12.1 — la recette V2.12.2 ne lançait
//      « recette-preparer-decalage-v2.12.1.mjs » que sur son PROPRE CUR
//      (kanvix-next-gen-v2.12.1.html), ce qui ne prouve rien sur V2.12.2.
//      Cette recette corrective génère une COPIE EXACTE de ce fichier — sa
//      seule différence textuelle est la ligne `const CUR = …` — l'exécute
//      RÉELLEMENT contre kanvix-next-gen-v2.12.2.1.html, et relaie CHACUNE
//      de ses 77 assertions individuellement (aucune agrégation). La
//      recette historique originale n'est ni modifiée, ni affaiblie.
//
//   Usage : node recette-corrective-v2.12.2.1.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.2.1.html';
const PREV = 'kanvix-next-gen-v2.12.2.html';
const V2121 = 'kanvix-next-gen-v2.12.1.html'; // le fichier d'origine du bug (état hérité)
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.2.1/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1400)}`);
const allErrs = [];

async function newPage(opts = {}) {
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, role = 'driver' } = opts;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  await p.evaluate((r) => { resetApp(); dismissKanvixContinuityNotice(); if (r !== 'driver') setRole(r); }, role);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// ============================================================
// PARTIE 1 — ÉTAT ARTISAN HISTORIQUE (ROLE-RECOVER-01 → 06)
// ============================================================
console.log('\n[ROLE-RECOVER-01] Fabrication d’un état V2.12.1 AUTHENTIQUE en rôle artisan');
let persistedV2121 = null;
{
  // 1. On produit l'état persistant EN LE JOUANT RÉELLEMENT sur le fichier
  //    V2.12.1 d'origine — pas une approximation reconstituée à la main :
  //    setRole('artisan') y écrit settings.role="artisan" ET
  //    ui.page="artisan" (V2.12.1 §31827-31828), exactement le scénario visé.
  const { ctx, p } = await newPage({ tag: 'SEED-V2121', file: V2121 });
  const seed = await ev(p, () => {
    setRole('artisan');
    return {
      raw: localStorage.getItem(STORE),
      role: app.settings.role, page: app.ui.page,
      projects: app.projects.length, tasks: app.tasks.length,
      messages: app.messages.length, photos: app.photos.length,
      level: app.settings.level, appearance: app.settings.appearance,
    };
  });
  persistedV2121 = seed.raw;
  note('ROLE-RECOVER-01', { role: seed.role, page: seed.page, projects: seed.projects, tasks: seed.tasks, messages: seed.messages, photos: seed.photos, level: seed.level });
  ok(seed.role === 'artisan' && seed.page === 'artisan' && !!persistedV2121,
    'ROLE-RECOVER-01 : l’état V2.12.1 fabriqué porte bien settings.role="artisan" ET ui.page="artisan" — le VRAI scénario hérité, produit par le VRAI fichier V2.12.1, pas une simulation', 'ROLE-RECOVER-01');
  await ctx.close();
}
console.log('\n[ROLE-RECOVER-02] Rechargement RÉEL de V2.12.2.1 avec ce localStorage V2.12.1');
{
  // 2. Nouveau contexte Playwright = nouveau localStorage vierge, dans lequel
  //    on installe l'état V2.12.1 AVANT le tout premier chargement de la
  //    page — pour que `let app = migrateState(load())` (exécuté à l'ouverture
  //    du script, avant toute autre ligne) soit RÉELLEMENT ce qui normalise
  //    cet état, pas un appel manuel a posteriori.
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: 'RELOAD-V21221', msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text())) allErrs.push({ where: 'RELOAD-V21221', msg: m.text() }); });
  await p.route('https://**', (r) => r.abort('failed'));
  // On pose le STORE cible AVANT navigation : addInitScript s'exécute avant
  // tout script de la page, donc avant `let app = migrateState(load())`.
  await p.addInitScript(([storeKey, raw]) => { localStorage.setItem(storeKey, raw); }, ['kanvix-product-8-3', persistedV2121]);
  await p.goto(F(CUR), { waitUntil: 'load' });
  await p.waitForTimeout(250);
  const r = await ev(p, () => ({
    role: app.settings.role,
    page: app.ui.page,
    domPage: document.getElementById('main').querySelector('.page.active')?.id,
    hasArtisanChat: !!document.querySelector('.chat-mission'),
    hasTodayGreeting: /Bonjour/.test(document.getElementById('main').innerHTML),
    projects: app.projects.length, tasks: app.tasks.length,
    messages: app.messages.length, photos: app.photos.length,
    level: app.settings.level, appearance: app.settings.appearance,
    artisanResourceId: app.settings.artisanResourceId,
  }));
  note('ROLE-RECOVER-02-06', r);
  // 3. Arrivée en rôle driver sur Aujourd'hui.
  ok(r.role === 'driver' && r.page === 'today' && r.domPage === 'today' && r.hasTodayGreeting && !r.hasArtisanChat,
    'ROLE-RECOVER-02/03 : chargé avec un localStorage V2.12.1 en rôle artisan, V2.12.2.1 démarre RÉELLEMENT en rôle driver, sur la page Aujourd’hui (pas la conversation Artisan) — la normalisation agit dès le tout premier chargement, via migrateState(load())', 'ROLE-RECOVER-02');
  await ctx.close();
}
console.log('\n[ROLE-RECOVER-04] Aucune donnée métier ni réglage perdu');
{
  const { ctx: ctxBefore, p: pBefore } = await newPage({ tag: 'BEFORE-DATA', file: V2121 });
  const before = await ev(pBefore, () => ({
    projects: app.projects.length, tasks: app.tasks.length, messages: app.messages.length, photos: app.photos.length,
    level: app.settings.level, appearance: app.settings.appearance, artisanResourceId: app.settings.artisanResourceId,
    driverResourceId: app.settings.driverResourceId,
  }));
  await ctxBefore.close();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  await p.route('https://**', (r) => r.abort('failed'));
  await p.addInitScript(([storeKey, raw]) => { localStorage.setItem(storeKey, raw); }, ['kanvix-product-8-3', persistedV2121]);
  await p.goto(F(CUR), { waitUntil: 'load' });
  await p.waitForTimeout(200);
  const after = await ev(p, () => ({
    projects: app.projects.length, tasks: app.tasks.length, messages: app.messages.length, photos: app.photos.length,
    level: app.settings.level, appearance: app.settings.appearance, artisanResourceId: app.settings.artisanResourceId,
    driverResourceId: app.settings.driverResourceId,
  }));
  note('ROLE-RECOVER-04', { before, after });
  ok(before.projects === after.projects && before.tasks === after.tasks && before.messages === after.messages && before.photos === after.photos,
    'ROLE-RECOVER-04 : projets, tâches, messages et photos sont EXACTEMENT les mêmes en nombre après la normalisation — aucune donnée métier perdue', 'ROLE-RECOVER-04');
  ok(after.level === before.level && after.appearance === before.appearance && after.artisanResourceId === before.artisanResourceId && after.driverResourceId === before.driverResourceId,
    `ROLE-RECOVER-04 : les AUTRES réglages persistés (niveau=${before.level}, apparence=${before.appearance}, ressource artisan de référence=${before.artisanResourceId}) traversent la normalisation STRICTEMENT intacts — seuls role/page hérités sont corrigés`, 'ROLE-RECOVER-04');
  await ctx.close();
}
console.log('\n[ROLE-RECOVER-05] La vue Artisan reste exécutable en interne (setRole)');
{
  const { ctx, p } = await newPage({ tag: 'ARTISAN-STILL-WORKS', role: 'artisan' });
  const r = await ev(p, () => ({
    role: app.settings.role,
    hasChat: !!document.querySelector('.chat-mission'),
    hasThread: !!document.getElementById('chatThread'),
    hasCompose: !!document.querySelector('.chat-compose'),
    fnType: typeof setRole,
    renderArtisanType: typeof renderArtisan,
  }));
  note('ROLE-RECOVER-05', r);
  ok(r.role === 'artisan' && r.hasChat && r.hasThread && r.hasCompose,
    'ROLE-RECOVER-05 : setRole("artisan") dans une recette (ce geste, exactement) rend toujours intégralement la vue Artisan — non cassée, seulement rendue inatteignable par l’UI historique', 'ROLE-RECOVER-05');
  ok(r.fnType === 'function' && r.renderArtisanType === 'function',
    'ROLE-RECOVER-05 : setRole() et renderArtisan() existent toujours dans le fichier — fonctions internes nécessaires, non supprimées', 'ROLE-RECOVER-05');
  await ctx.close();
}
console.log('\n[ROLE-RECOVER-06] Un état V2.12.1 en rôle driver n’est pas altéré (non-régression du chemin normal)');
{
  const { ctx: ctxSeed, p: pSeed } = await newPage({ tag: 'SEED-DRIVER', file: V2121 });
  const seed = await ev(pSeed, () => { setDepth('essential'); return localStorage.getItem(STORE); });
  await ctxSeed.close();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  await p.route('https://**', (r) => r.abort('failed'));
  await p.addInitScript(([storeKey, raw]) => { localStorage.setItem(storeKey, raw); }, ['kanvix-product-8-3', seed]);
  await p.goto(F(CUR), { waitUntil: 'load' });
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({ role: app.settings.role, page: app.ui.page, level: app.settings.level }));
  note('ROLE-RECOVER-06', r);
  ok(r.role === 'driver' && r.page === 'today' && r.level === 'essential',
    'ROLE-RECOVER-06 : un état V2.12.1 déjà en rôle driver (le cas normal, très majoritaire) traverse la migration sans AUCUN changement de comportement — la normalisation n’agit que sur le cas artisan hérité', 'ROLE-RECOVER-06');
  await ctx.close();
}

// ============================================================
// PARTIE 2 — REJEU RÉEL DE LA RECETTE V2.12.1 CONTRE V2.12.2.1
// ============================================================
console.log('\n[DECAL-REJEU] Génération de la copie exacte (seule la ligne CUR change) et exécution réelle');
const ORIGINAL_RECETTE = '/home/user/Planzy-saas/recette-preparer-decalage-v2.12.1.mjs';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanvix-decal-rejeu-'));
const tmpRecette = path.join(tmpDir, 'recette-preparer-decalage-CONTRE-v2.12.2.1.mjs');
let rejeu = { total: 0, pass: 0, fail: 0, lines: [], resultLine: null, errLine: null, horsPerimetre: null, css: null };
{
  const source = fs.readFileSync(ORIGINAL_RECETTE, 'utf8');
  const oldLine = "const CUR = 'kanvix-next-gen-v2.12.1.html';";
  const newLine = `const CUR = '${CUR}';`;
  ok(source.includes(oldLine),
    'DECAL-REJEU : la ligne CUR attendue est bien trouvée telle quelle dans la recette originale — la substitution qui va suivre est chirurgicale, pas une réécriture', 'DECAL-REJEU');
  const patched = source.split(oldLine).join(newLine);
  const diffLines = source.split('\n').length === patched.split('\n').length &&
    source.split('\n').filter((l, i) => l !== patched.split('\n')[i]).length;
  note('DECAL-REJEU-diff', { lignesTotal: source.split('\n').length, lignesModifiees: diffLines });
  ok(diffLines === 1,
    'DECAL-REJEU : la copie exécutée ne diffère de recette-preparer-decalage-v2.12.1.mjs que par CETTE SEULE LIGNE (const CUR) — aucune assertion, aucun seuil, aucune donnée n’a été touché', 'DECAL-REJEU');
  fs.writeFileSync(tmpRecette, patched);

  let stdout = '';
  try {
    stdout = execSync(`node "${tmpRecette}"`, {
      cwd: '/home/user/Planzy-saas',
      env: { ...process.env, KVX_SHOTS: SHOTS + 'decal-v21221/' },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    // node exit(1) quand des assertions échouent : c'est attendu (perimètre),
    // pas un échec d'exécution — on récupère quand même la sortie complète.
    stdout = (e.stdout || '') + (e.stderr || '');
  }
  fs.writeFileSync(SHOTS + 'decal-rejeu-sortie-brute.txt', stdout);

  // Relais INDIVIDUEL de CHACUNE des 77 assertions — aucune agrégation.
  // On s'arrête à la ligne « RÉSULTAT : » : au-delà, la recette originale
  // RÉ-IMPRIME les échecs sous le même format (section « ÉCHECS : ») pour
  // son propre résumé — les compter là aussi les doublonnerait.
  const assertRe = /^\s*(✓|✗)\s*\[([^\]]+)\]\s*(.+)$/;
  const corpsAvantResultat = stdout.split(/\nRÉSULTAT : \d+ \/ \d+/)[0];
  for (const line of corpsAvantResultat.split('\n')) {
    const m = assertRe.exec(line);
    if (m) {
      const [, mark, sec, text] = m;
      rejeu.total++;
      if (mark === '✓') rejeu.pass++; else rejeu.fail++;
      rejeu.lines.push({ sec, text, pass: mark === '✓' });
      ok(mark === '✓', text, 'REJEU-' + sec);
    }
  }
  rejeu.resultLine = (stdout.match(/RÉSULTAT : \d+ \/ \d+/) || [null])[0];
  rejeu.errLine = (stdout.match(/ERREURS CONSOLE APPLICATIVES : \d+/) || [null])[0];
  const perimLine = stdout.match(/\(info\) \[FREEZE-2121-périmètre\] (\{.+\})/);
  if (perimLine) { try { rejeu.horsPerimetre = JSON.parse(perimLine[1]).horsPérimètre; } catch (_) {} }
  const cssLine = stdout.match(/\(info\) \[FREEZE-2121-css\] (\{.+\})/);
  if (cssLine) { try { rejeu.css = JSON.parse(cssLine[1]).css; } catch (_) {} }

  note('DECAL-REJEU-résumé', { fichierRéellementTesté: CUR, total: rejeu.total, pass: rejeu.pass, fail: rejeu.fail, résultatAnnoncé: rejeu.resultLine, erreursConsole: rejeu.errLine });
  ok(rejeu.total === 77,
    `DECAL-REJEU : la copie a bien produit 77 assertions individuelles (relayées une à une ci-dessus sous le préfixe REJEU-), rejouées RÉELLEMENT contre ${CUR} — aucune agrégation en 1 ou 2 contrôles`, 'DECAL-REJEU');
  ok(/ERREURS CONSOLE APPLICATIVES : 0/.test(rejeu.errLine || ''),
    'DECAL-REJEU : 0 erreur JavaScript applicative en console pendant tout le rejeu', 'DECAL-REJEU');
}
console.log('\n[DECAL-REJEU-ISOLATION] Isolement précis des échecs de FREEZE historique');
{
  const attendu = ['migrateState', 'renderOperation', 'sitesModeSwitch', 'renderSites', 'projectStructureTab', 'renderPlanning', 'renderMore', 'renderArtisan', 'renderUserMenu'].sort();
  const obtenu = (rejeu.horsPerimetre || []).slice().sort();
  const inattendu = obtenu.filter((n) => !attendu.includes(n));
  const manquant = attendu.filter((n) => !obtenu.includes(n));
  note('DECAL-REJEU-ISOLATION', { attendu, obtenu, inattendu, manquant, cssIdentique: rejeu.css });
  ok(inattendu.length === 0,
    'DECAL-REJEU-ISOLATION : le seul échec de périmètre FREEZE-2121 (« hors périmètre ») est composé EXCLUSIVEMENT des 8 fonctions R2-R4 déjà documentées (RAPPORT-V2.12.2) et de migrateState (cette certification) — AUCUNE fonction inattendue, donc AUCUNE régression cachée', 'DECAL-REJEU-ISOLATION');
  ok(manquant.length === 0,
    'DECAL-REJEU-ISOLATION : les 9 fonctions attendues apparaissent TOUTES dans l’échec de périmètre — le changement est complet, rien n’y manque non plus (pas de faux-négatif)', 'DECAL-REJEU-ISOLATION');
  ok(rejeu.css === false,
    'DECAL-REJEU-ISOLATION : l’échec « feuille de style byte-identique » est celui, déjà documenté, du retrait volontaire de .role-card/.role-grid/.settings-grid/.settings-intro en R3 — pas un effet de cette certification (aucune CSS ici)', 'DECAL-REJEU-ISOLATION');
  const attenduesFail = ['DECAL-70', 'FREEZE-2121'];
  const echecsReels = rejeu.lines.filter((l) => !l.pass && !attenduesFail.some((s) => l.sec.includes(s)));
  note('DECAL-REJEU-régressions', { echecsReels: echecsReels.map((l) => l.sec + ' :: ' + l.text.slice(0, 90)) });
  ok(echecsReels.length === 0,
    'DECAL-REJEU-ISOLATION : hors DECAL-70 (migrateState modifiée, attendu) et FREEZE-2121 (périmètre/CSS, attendu), AUCUNE autre assertion — sur les 77 — n’échoue : AUCUNE régression fonctionnelle réelle sur « Préparer un décalage »', 'DECAL-REJEU-ISOLATION');
}
fs.rmSync(tmpDir, { recursive: true, force: true });

// ============================================================
// FREEZE-2122.1 — CONTRÔLE DE PÉRIMÈTRE V2.12.2 → V2.12.2.1
// ============================================================
console.log('\n[FREEZE-21221] Contrôle de périmètre de la certification elle-même');
{
  const A = fs.readFileSync(BASE + PREV, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
  const extractFn = (src, name) => {
    const re = new RegExp('\\n\\s*function ' + name + '\\s*\\(');
    const m = re.exec(src); if (!m) return null;
    let par = src.indexOf('(', m.index), depth = 0, k = par;
    for (; k < src.length; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') { depth--; if (!depth) { k++; break; } } }
    let i = src.indexOf('{', k), d = 0, j = i, s = null, esc = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (s) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === s) s = null; continue; }
      if (c === '"' || c === "'" || c === '`') { s = c; continue; }
      if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
      if (c === '{') d++; else if (c === '}') { d--; if (!d) { j++; break; } }
    }
    return src.slice(m.index, j);
  };
  const attendues = ['migrateState'];
  const horsPerimetre = [], ajoutees = [], supprimees = [];
  const nomsB = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  const nomsA = [...new Set([...A.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  nomsB.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  nomsA.forEach((n) => { if (!nomsB.includes(n)) supprimees.push(n); });
  note('FREEZE-21221-diff', { modifiées: attendues, ajoutées: ajoutees, supprimées: supprimees, horsPérimètre: horsPerimetre });
  ok(horsPerimetre.length === 0,
    'FREEZE-21221 : hors de migrateState(), AUCUNE autre fonction n’a changé entre V2.12.2 et V2.12.2.1 — la certification est strictement limitée à la normalisation de l’état hérité', 'FREEZE-21221');
  ok(ajoutees.length === 0 && supprimees.length === 0,
    'FREEZE-21221 : aucune fonction ajoutée, aucune fonction supprimée — un seul comportement corrigé dans une fonction existante', 'FREEZE-21221');

  const bloc = (src, re) => (src.match(re) || [''])[0];
  const cssIdentique = md5(bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/)) === md5(bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/));
  const initialIdentique = md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/));
  const schema = { A: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1], B: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1] };
  note('FREEZE-21221-données', { cssIdentique, initialIdentique, schema });
  ok(cssIdentique,
    'FREEZE-21221 : la feuille de style est BYTE-IDENTIQUE — cette certification ne change rien de visible', 'FREEZE-21221');
  ok(initialIdentique && schema.A === schema.B,
    'FREEZE-21221 : INITIAL_STATE et SCHEMA_VERSION inchangés — aucune donnée de démonstration, aucune migration de schéma', 'FREEZE-21221');

  // Les moteurs déjà gelés en R1-R4 restent gelés ICI aussi.
  const decal14 = [
    'taskShiftEligibility', 'shiftChainHasCycle', 'computeShiftChain', 'buildShiftFingerprint',
    'evaluateShiftImpact', 'openPrepareShift', 'renderPrepareShiftForm', 'pickShiftPropagate',
    'submitPrepareShiftForm', 'renderPrepareShiftPreview', 'toggleShiftConfirm', 'cancelPrepareShift',
    'renderPrepareShiftError', 'applyPrepareShift',
  ];
  const geles = decal14.concat([
    'planReflow', 'applyReflowPlan', 'planScheduleChanges', 'evaluateDependencyConflicts',
    'getResourceSchedulingConflicts', 'addBusinessDays', 'addWorkingDuration', 'nextWorkingTime',
    'nonWorkingDaysInRange', 'snapshot', 'undo', 'redo', 'cloneHistoryState', 'restoreHistoryState',
    'preserveCommunications', 'invalidateRedo', 'setTaskStatus', 'scenarioOptions', 'evaluateScenario',
    'showWhatIf', 'startWhatIf', 'sendConversationMessage', 'sendArtisanMessage', 'openConversation',
    'addPhoto', 'addFieldPhoto', 'taskCreatesCycle', 'getTaskSuccessors', 'getTaskPredecessors',
    'getProjectStructure', 'openStructureForm', 'toggleStructureArchive', 'confirmDeleteTask',
    'guardEditable', 'canEditProject', 'save', 'resetApp', 'render', 'openTask',
    'renderOperationsList', 'operationCard', 'getOperationSummary', 'selectOperation',
  ]);
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-21221-gelés', { comparées: compares, bougés: bouges });
  ok(compares > 50 && bouges.length === 0,
    `FREEZE-21221 : les ${compares} moteurs gelés (14 fonctions transactionnelles de « Préparer un décalage » + calendrier + dépendances + ressources + Undo/Redo/communications + Structure + Opérations) restent BYTE-IDENTIQUES entre V2.12.2 et V2.12.2.1`, 'FREEZE-21221');
}

// ============================================================
const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim|google\.com/.test(e.msg));
ok(appErrs.length === 0, `CERTIF : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'CERTIF');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 15), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log(`FICHIER RÉELLEMENT TESTÉ PAR LE REJEU V2.12.1 : ${CUR}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({
  passed, failed, results, consoleErrors: appErrs,
  rejeuV2121: { fichierRéellementTesté: CUR, total: rejeu.total, pass: rejeu.pass, fail: rejeu.fail, résultatAnnoncé: rejeu.resultLine },
}, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
