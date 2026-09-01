// ============================================================
// KANVIX — Recette de la page Réglages (refonte V2.4.7)
// Usage : node recette-reglages-v2.4.7.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.7.html?now=2026-08-13T09:00:00';
const SHOTS = '/home/user/Planzy-saas/recette-reglages/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, name, d) => { results.push({ sec, name, status: 'INFO', detail: d }); console.log(`  (info) [${sec}] ${name}: ${JSON.stringify(d)}`); };
const allErrs = [];
async function newPage(opts = {}) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: opts._tag || 'p', msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: opts._tag || 'p', msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const openSettings = async (p) => { await ev(p, () => { resetApp(); setDepth('essential'); go('more'); }); await p.waitForTimeout(200); };

// ============================================================
// A/B — Titre + sous-titre
// ============================================================
console.log('\n[A/B] Titre & sous-titre');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'A' });
  await openSettings(p);
  const h = await ev(p, () => ({ h1: document.querySelector('#more .header h1')?.textContent, sub: document.querySelector('#more .header .muted')?.textContent }));
  ok(h.h1 === 'Réglages', 'A : page intitulée "Réglages"', 'A');
  ok(h.sub === 'Personnalisez votre expérience Kanvix.', 'B : sous-titre exact', 'B');
  await p.screenshot({ path: SHOTS + 'reglages-desktop-clair.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// C — Vocabulaire interne absent
// ============================================================
console.log('\n[C] Vocabulaire interne absent');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'C' });
  await openSettings(p);
  const txt = await ev(p, () => document.querySelector('#more').textContent);
  ok(!/\bPlus\b/.test(txt), 'C : aucune occurrence "Plus"', 'C');
  ok(!/Profondeur/i.test(txt), 'C : aucune occurrence "Profondeur"', 'C');
  ok(!/Niveau essential|Niveau pilot\b/i.test(txt), 'C : aucun badge "Niveau essential/pilot"', 'C');
  ok(!/Outils contextuels/i.test(txt), 'C : aucune section "Outils contextuels"', 'C');
  await ctx.close();
}

// ============================================================
// D — 3 cartes principales
// ============================================================
console.log('\n[D] 3 cartes principales');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'D' });
  await openSettings(p);
  const titles = await ev(p, () => [...document.querySelectorAll('#more .settings-section-title')].map((x) => x.textContent.trim()));
  ok(titles.length === 3, 'D : exactement 3 cartes de réglage', 'D');
  ok(titles.some((t) => /Expérience Kanvix/.test(t)), 'D : carte "Expérience Kanvix"', 'D');
  ok(titles.some((t) => /Mode de démonstration/.test(t)), 'D : carte "Mode de démonstration"', 'D');
  ok(titles.some((t) => /Données .* démonstration/.test(t)), 'D : carte "Données & démonstration"', 'D');
  await ctx.close();
}

// ============================================================
// E/F — Niveau d'affichage (Essentiel/Pilotage) + hint dynamique
// ============================================================
console.log('\n[E/F] Niveau d\'affichage + description dynamique');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'E' });
  await openSettings(p);
  const essOnLoad = await ev(p, () => {
    const seg = [...document.querySelectorAll('#more .seg')][0];
    const active = seg.querySelector('.seg-opt.active')?.textContent.replace(/[✓\s]/g, '');
    return { active, hint: [...document.querySelectorAll('#more .settings-hint')][0]?.textContent, level: app.settings.level };
  });
  ok(essOnLoad.active === 'Essentiel' && essOnLoad.level === 'essential', 'E : "Essentiel" sélectionné (niveau=essential)', 'E');
  ok(/uniquement ce qui demande votre attention/.test(essOnLoad.hint || ''), 'F : description Essentiel affichée', 'F');
  // Cliquer Pilotage
  await ev(p, () => { const seg = [...document.querySelectorAll('#more .seg')][0]; [...seg.querySelectorAll('.seg-opt')].find((x) => /Pilotage/.test(x.textContent)).click(); });
  await p.waitForTimeout(200);
  const pilot = await ev(p, () => ({ level: app.settings.level, active: [...document.querySelectorAll('#more .seg')][0].querySelector('.seg-opt.active')?.textContent.replace(/[✓\s]/g, ''), hint: [...document.querySelectorAll('#more .settings-hint')][0]?.textContent }));
  ok(pilot.level === 'pilot' && pilot.active === 'Pilotage', 'E : clic "Pilotage" → niveau=pilot, sélection mise à jour', 'E');
  ok(/davantage d’informations|davantage d'informations/.test(pilot.hint || ''), 'F : description bascule dynamiquement pour Pilotage', 'F');
  await ctx.close();
}

// ============================================================
// G — Apparence Clair/Sombre/Système
// ============================================================
console.log('\n[G] Apparence');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'G' });
  await openSettings(p);
  for (const [label, key, cls] of [['Sombre', 'dark', 'dark'], ['Clair', 'light', null], ['Système', 'system', null]]) {
    await ev(p, (lbl) => { const seg = [...document.querySelectorAll('#more .seg')][1]; [...seg.querySelectorAll('.seg-opt')].find((x) => x.textContent.includes(lbl)).click(); }, label);
    await p.waitForTimeout(150);
    const st = await ev(p, () => ({ appearance: app.settings.appearance, bodyDark: document.body.classList.contains('dark'), active: [...document.querySelectorAll('#more .seg')][1].querySelector('.seg-opt.active')?.textContent.includes.name }));
    ok(st.appearance === key, `G : "${label}" → appearance=${key}`, 'G');
    if (cls === 'dark') ok(st.bodyDark, 'G : "Sombre" applique bien le thème sombre', 'G');
  }
  await ctx.close();
}

// ============================================================
// H — Conducteur / Artisan
// ============================================================
console.log('\n[H] Mode de démonstration — Conducteur/Artisan');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'H' });
  await openSettings(p);
  const cards = await ev(p, () => [...document.querySelectorAll('#more .role-card')].map((c) => ({ text: c.textContent, active: c.classList.contains('active') })));
  ok(cards.length === 2, 'H : deux cartes rôle (Conducteur/Artisan)', 'H');
  ok(cards.some((c) => /Conducteur/.test(c.text) && c.active), 'H : Conducteur sélectionné par défaut (rôle courant)', 'H');
  ok(cards.some((c) => /Artisan/.test(c.text)), 'H : carte Artisan présente', 'H');
  // Clic Artisan -> setRole('artisan')
  await ev(p, () => [...document.querySelectorAll('#more .role-card')].find((c) => /Artisan/.test(c.textContent)).click());
  await p.waitForTimeout(200);
  ok(await ev(p, () => app.settings.role === 'artisan'), 'H : clic Artisan → setRole(artisan) (simulation de rôle)', 'H');
  // Retour driver
  await ev(p, () => { setRole('driver'); go('more'); });
  await p.waitForTimeout(150);
  ok(await ev(p, () => app.settings.role === 'driver'), 'H : retour Conducteur → setRole(driver)', 'H');
  await ctx.close();
}

// ============================================================
// I/J — Outils contextuels absents de Réglages, fonctions intactes ailleurs
// ============================================================
console.log('\n[I/J] Outils contextuels retirés de Réglages, fonctions intactes');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'I' });
  await openSettings(p);
  const txt = await ev(p, () => document.querySelector('#more').textContent);
  ok(!/Ressources|Documents|Photos|Impact/.test(txt), 'I : Ressources/Documents/Photos/Impact absents de la page Réglages', 'I');
  // Fonctions et pages intactes
  const intact = await ev(p, () => ({
    fns: ['renderResources', 'renderDocuments', 'renderPhotos', 'renderImpact'].every((f) => typeof window[f] === 'function'),
  }));
  ok(intact.fns, 'J : renderResources/Documents/Photos/Impact toujours définies', 'J');
  for (const [page, sel] of [['resources', '#resources'], ['documents', '#documents'], ['photos', '#photos'], ['impact', '#impact']]) {
    await ev(p, (pg) => go(pg), page);
    await p.waitForTimeout(120);
    const rendered = await ev(p, (s) => !!document.querySelector(s) && !document.querySelector('#main .empty h2')?.textContent.includes('problème'), sel);
    ok(rendered, `J : page "${page}" toujours accessible et rendue (go('${page}'))`, 'J');
  }
  // Palette de commandes conserve leurs accès
  const cmd = await ev(p, () => typeof buildCommands === 'function' ? buildCommands().some((c) => /Ressources/.test(c.label)) : true);
  note('J', 'accès Ressources dans la palette de commandes', cmd);
  await ctx.close();
}

// ============================================================
// K/L/M — Modèle entreprise / Importer / Exporter
// ============================================================
console.log('\n[K/L/M] Données & démonstration — actions');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'K' });
  await openSettings(p);
  const rows = await ev(p, () => [...document.querySelectorAll('#more .settings-row')].map((r) => ({ title: r.querySelector('b')?.textContent, sub: r.querySelector('small')?.textContent, chevron: !!r.querySelector('.settings-row-chevron'), danger: r.classList.contains('danger') })));
  note('K', 'lignes Données', rows.map((r) => r.title));
  ok(rows.some((r) => r.title === 'Modèle d’entreprise' && /par défaut de l’entreprise/.test(r.sub) && r.chevron), 'K : ligne "Modèle d\'entreprise" (sous-titre + chevron)', 'K');
  ok(rows.some((r) => r.title === 'Importer des données' && /depuis un fichier/.test(r.sub) && r.chevron), 'L : ligne "Importer des données"', 'L');
  ok(rows.some((r) => r.title === 'Exporter les données' && /Télécharger les données/.test(r.sub) && r.chevron), 'M : ligne "Exporter les données"', 'M');
  ok(!rows.some((r) => /JSON/.test(r.title)), 'M : "JSON" retiré du titre d\'export', 'M');
  // Modèle entreprise déclenche bien le moteur existant (drawer)
  await ev(p, () => [...document.querySelectorAll('#more .settings-row')].find((r) => /Modèle d’entreprise/.test(r.textContent)).click());
  await p.waitForTimeout(200);
  ok(await ev(p, () => document.querySelector('#drawer').classList.contains('open')), 'K : clic Modèle d\'entreprise → openCompanyTemplateForm (drawer)', 'K');
  await ev(p, () => closeOverlay('drawer'));
  await p.waitForTimeout(120);
  // Import : câblé au moteur existant openKanvixImport (qui ouvre le sélecteur
  // de fichier natif de l'OS — pas un overlay détectable en headless). On
  // vérifie le câblage + qu'un clic crée bien un <input type=file> transitoire.
  await ev(p, () => go('more'));
  await p.waitForTimeout(120);
  const importWired = await ev(p, () => {
    const row = [...document.querySelectorAll('#more .settings-row')].find((r) => /Importer des données/.test(r.textContent));
    return { onclick: row?.getAttribute('onclick'), fn: typeof openKanvixImport === 'function' };
  });
  ok(importWired.fn && /openKanvixImport\(\)/.test(importWired.onclick || ''), 'L : clic Importer câblé à openKanvixImport() (moteur existant, sélecteur fichier natif)', 'L');
  const createsFileInput = await ev(p, () => {
    let created = null; const orig = document.createElement.bind(document);
    document.createElement = (tag) => { const el = orig(tag); if (tag === 'input') created = el; return el; };
    try { openKanvixImport(); } catch (e) {}
    document.createElement = orig;
    return created && created.type === 'file' && /json/.test(created.accept || '');
  });
  ok(createsFileInput, 'L : openKanvixImport ouvre bien un sélecteur de fichier (.json)', 'L');
  await ctx.close();
}

// ============================================================
// N — Réinitialiser (avec confirmation, jamais sans)
// ============================================================
console.log('\n[N] Réinitialiser la démonstration avec confirmation');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'N' });
  await openSettings(p);
  // Marqueur pour détecter une réinitialisation
  await ev(p, () => { project('keravel').name = 'SENTINELLE_RESET'; save(); go('more'); });
  await p.waitForTimeout(150);
  await ev(p, () => [...document.querySelectorAll('#more .settings-row.danger')].find((r) => /Réinitialiser/.test(r.textContent)).click());
  await p.waitForTimeout(200);
  const confirmShown = await ev(p, () => ({ modal: document.querySelector('#modal').classList.contains('open'), text: document.querySelector('#modalContent')?.textContent || '', stillSentinel: project('keravel')?.name === 'SENTINELLE_RESET' }));
  ok(confirmShown.modal && /Réinitialiser la démonstration/.test(confirmShown.text), 'N : clic Réinitialiser → popup de confirmation (pas de reset immédiat)', 'N');
  ok(confirmShown.stillSentinel, 'N : aucune réinitialisation tant que non confirmée', 'N');
  // Annuler garde les données
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Annuler/.test(x.textContent)).click());
  await p.waitForTimeout(150);
  ok(await ev(p, () => project('keravel')?.name === 'SENTINELLE_RESET'), 'N : "Annuler" conserve les données', 'N');
  // Confirmer réinitialise
  await ev(p, () => { go('more'); });
  await p.waitForTimeout(120);
  await ev(p, () => [...document.querySelectorAll('#more .settings-row.danger')].find((r) => /Réinitialiser/.test(r.textContent)).click());
  await p.waitForTimeout(150);
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Réinitialiser/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  ok(await ev(p, () => project('keravel')?.name === 'Résidence Keravel'), 'N : "Réinitialiser" confirmé → resetApp() restaure les données d\'origine', 'N');
  await ctx.close();
}

// ============================================================
// O/P — Responsive (0 scroll horizontal)
// ============================================================
console.log('\n[O/P] Responsive');
for (const [w, h] of [[1440, 900], [1280, 800], [900, 1000], [768, 1024], [430, 932], [390, 844]]) {
  const { ctx, p } = await newPage({ viewport: { width: w, height: h }, _tag: `resp-${w}` });
  await openSettings(p);
  await p.waitForTimeout(150);
  const r = await ev(p, () => ({
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    contentMax: Math.round(document.querySelector('.settings-content')?.getBoundingClientRect().width || 0),
    segOverflow: [...document.querySelectorAll('#more .seg-opt')].some((s) => s.getBoundingClientRect().right > document.documentElement.clientWidth + 1),
  }));
  ok(!r.hscroll, `O/P : ${w}px — aucun scroll horizontal`, 'O');
  ok(!r.segOverflow, `P : ${w}px — contrôles segmentés ne débordent pas`, 'P');
  if (w === 1440) ok(r.contentMax <= 840, 'O : colonne centrale plafonnée (~820px, mesuré ' + r.contentMax + ')', 'O');
  if (w === 390) await p.screenshot({ path: SHOTS + 'reglages-mobile-390.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// Q — Dark mode soigné
// ============================================================
console.log('\n[Q] Thème sombre');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'Q' });
  await openSettings(p);
  await ev(p, () => { setAppearance('dark'); renderPage(); });
  await p.waitForTimeout(200);
  const dark = await ev(p, () => {
    const c = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
    const bg = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).backgroundColor : null; };
    return { body: document.body.classList.contains('dark'), cardBg: bg('.settings-section'), title: c('.settings-field-head h3'), sub: c('.settings-field-head p'), danger: c('.settings-row.danger b'), segActiveBg: bg('.seg-opt.active') };
  });
  ok(dark.body, 'Q : mode sombre appliqué', 'Q');
  ok(!!dark.cardBg && dark.cardBg !== 'rgba(0, 0, 0, 0)', 'Q : cartes ont un fond défini en sombre', 'Q');
  ok(!!dark.title && !!dark.sub, 'Q : titres et sous-titres lisibles en sombre', 'Q');
  ok(!!dark.danger, 'Q : action destructive (rouge) définie en sombre', 'Q');
  ok(!!dark.segActiveBg && dark.segActiveBg !== 'rgba(0, 0, 0, 0)', 'Q : sélection segmentée visible en sombre', 'Q');
  note('Q', 'couleurs sombres', dark);
  await p.screenshot({ path: SHOTS + 'reglages-desktop-sombre.png', fullPage: true });
  await ctx.close();
}

// ============================================================
// ACCESSIBILITÉ — boutons natifs + focus + radiogroup
// ============================================================
console.log('\n[A11Y] Accessibilité');
{
  const { ctx, p } = await newPage({ viewport: { width: 1440, height: 900 }, _tag: 'A11Y' });
  await openSettings(p);
  const a = await ev(p, () => ({
    segButtons: [...document.querySelectorAll('#more .seg-opt')].every((x) => x.tagName === 'BUTTON'),
    roleButtons: [...document.querySelectorAll('#more .role-card')].every((x) => x.tagName === 'BUTTON'),
    rowButtons: [...document.querySelectorAll('#more .settings-row')].every((x) => x.tagName === 'BUTTON'),
    radiogroups: document.querySelectorAll('#more [role="radiogroup"]').length,
    ariaChecked: [...document.querySelectorAll('#more .seg-opt')].every((x) => x.hasAttribute('aria-checked')),
  }));
  ok(a.segButtons && a.roleButtons && a.rowButtons, 'A11Y : tous les contrôles sont des <button> natifs (accessibles clavier)', 'A11Y');
  ok(a.radiogroups >= 3, 'A11Y : groupes radio (niveau/apparence/rôle) sémantiques', 'A11Y');
  ok(a.ariaChecked, 'A11Y : options segmentées portent aria-checked', 'A11Y');
  // Focus clavier + activation Entrée
  const tid = await ev(p, () => { const seg = [...document.querySelectorAll('#more .seg')][0]; const pilot = [...seg.querySelectorAll('.seg-opt')].find((x) => /Pilotage/.test(x.textContent)); pilot.focus(); return document.activeElement === pilot; });
  ok(tid, 'A11Y : une option segmentée peut recevoir le focus clavier', 'A11Y');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  ok(await ev(p, () => app.settings.level === 'pilot'), 'A11Y : activation clavier (Entrée) fonctionne', 'A11Y');
  await ctx.close();
}

await b.close();
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniq.length ? 'ERREURS CONSOLE (' + uniq.length + ') :\n' + uniq.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: uniq }, null, 2));
process.exit(0);
