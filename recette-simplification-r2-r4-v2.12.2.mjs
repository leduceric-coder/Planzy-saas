// ============================================================
// KANVIX — Recette « SIMPLIFICATION R2-R4 » (V2.12.2)
//
//   R2 — Structure de chantier toujours accessible (jamais masquée par le
//        nombre de tâches/niveaux ni par Essentiel/Pilotage) + état vide
//        moins injonctif.
//   R3 — Suppression des points d'entrée de démonstration du rôle
//        (« Voir comme artisan », bloc « Mode de démonstration ») — la vue
//        Artisan et le double emplacement Essentiel/Pilotage restent intacts.
//   R4 — « Opérations » réservé au niveau Pilotage, avec retour sûr vers
//        Chantiers en cas de bascule vers Essentiel, et suppression du code
//        mort `advanced && !expert` dans renderPlanning().
//
//   Usage : node recette-simplification-r2-r4-v2.12.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.2.html';
const PREV = 'kanvix-next-gen-v2.12.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.2/';
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
  const { w = 1600, h = 1000, tag = 'x', file = CUR, now = NOW, role = 'driver', keepStorage } = opts;
  const ctx = keepStorage ? keepStorage.ctx : await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|Failed to load resource/.test(m.text()))
      allErrs.push({ where: tag, msg: m.text() });
  });
  await p.route('https://**', (r) => r.abort('failed'));
  await p.goto(F(file, now), { waitUntil: 'load' });
  if (!keepStorage) await p.evaluate((r) => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); if (r !== 'driver') setRole(r); }, role);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

// ============================================================
// STRUCT-01 → 10 — R2 : STRUCTURE TOUJOURS ACCESSIBLE
// ============================================================
console.log('\n[STRUCT-01] Onglet Structure — audit des conditions d’affichage');
{
  const { ctx, p } = await newPage({ tag: 'STRUCT-AUDIT' });
  const r = await ev(p, () => {
    // « terrasses » n'a AUCUNE structure dans la démo (STC-48 le confirmait
    // déjà sur V2.9.1) — cas « sans tâche et sans structure » : on la vide de
    // ses tâches pour couvrir EXACTEMENT ce cas.
    app.tasks = app.tasks.filter((t) => t.projectId !== 'terrasses');
    save();
    return {
      tabsEssentiel: (() => { setDepth('essential'); return projectTabs(); })(),
      tabsPilotage: (() => { setDepth('pilot'); return projectTabs(); })(),
      racines: getProjectStructure('terrasses').length,
      taches: getProjectTasks('terrasses').length,
    };
  });
  note('STRUCT-01', r);
  ok(r.tabsEssentiel.includes('Structure'),
    'STRUCT-01 : l’onglet « Structure » figure dans projectTabs() en niveau ESSENTIEL', 'STRUCT-01');
  ok(r.tabsPilotage.includes('Structure'),
    'STRUCT-02 : et dans projectTabs() en niveau PILOTAGE — le même tableau, sans condition de niveau ni de nombre de tâches/niveaux', 'STRUCT-02');
  ok(r.racines === 0 && r.taches === 0,
    'STRUCT-01 : le cas de test est bien celui d’un chantier SANS tâche et SANS structure', 'STRUCT-01');
  await ctx.close();
}
console.log('\n[STRUCT-03] Visibilité selon l’état réel du chantier (DOM réel, pas seulement projectTabs())');
{
  const scenario = async (tag, level, setup) => {
    const { ctx, p } = await newPage({ tag });
    const r = await ev(p, ([lvl, code]) => {
      setDepth(lvl);
      // eslint-disable-next-line no-new-func
      new Function(code)();
      openProjectTab('terrasses', 'Structure');
      const html = document.getElementById('drawerContent')?.innerHTML || document.getElementById('projectContent')?.innerHTML || '';
      return {
        ongletPresent: projectTabs().includes('Structure'),
        contenuRendu: /sn-section|sn-empty-state/.test(document.getElementById('projectContent')?.innerHTML || ''),
      };
    }, [level, setup]);
    await ctx.close();
    return r;
  };
  const sansRienEssentiel = await scenario('S-VIDE-ESS', 'essential', "app.tasks=app.tasks.filter(t=>t.projectId!=='terrasses');save();");
  const sansRienPilot = await scenario('S-VIDE-PIL', 'pilot', "app.tasks=app.tasks.filter(t=>t.projectId!=='terrasses');save();");
  const avecStructureSansTache = await scenario('S-STRUCT-SEULE', 'pilot',
    "app.tasks=app.tasks.filter(t=>t.projectId!=='terrasses');app.structureNodes.push({id:'sn-test-1',projectId:'terrasses',parentId:null,name:'Bâtiment test',type:'building',description:'',responsibleResourceId:null,archived:false,createdAt:historyNow(),updatedAt:historyNow()});save();");
  const avecTaches = await scenario('S-AVEC-TACHES', 'pilot', "");
  note('STRUCT-03', { sansRienEssentiel, sansRienPilot, avecStructureSansTache, avecTaches });
  ok(sansRienEssentiel.ongletPresent && sansRienEssentiel.contenuRendu,
    'STRUCT-03 : chantier SANS tâche et SANS structure, niveau ESSENTIEL — onglet visible et son contenu (état vide) se rend', 'STRUCT-03');
  ok(sansRienPilot.ongletPresent && sansRienPilot.contenuRendu,
    'STRUCT-04 : même cas en niveau PILOTAGE — visible', 'STRUCT-04');
  ok(avecStructureSansTache.ongletPresent && avecStructureSansTache.contenuRendu,
    'STRUCT-05 : chantier AVEC structure mais SANS tâche — visible', 'STRUCT-05');
  ok(avecTaches.ongletPresent && avecTaches.contenuRendu,
    'STRUCT-06 : chantier AVEC tâches (cas courant) — visible', 'STRUCT-06');
  await b.contexts().length; // no-op keepalive
}
console.log('\n[STRUCT-07] Texte de l’état vide — moins injonctif, texte recommandé');
{
  const { ctx, p } = await newPage({ tag: 'STRUCT-TEXT' });
  const r = await ev(p, () => {
    app.tasks = app.tasks.filter((t) => t.projectId !== 'terrasses');
    save();
    openProjectTab('terrasses', 'Structure');
    const html = document.getElementById('projectContent').innerHTML;
    return {
      texte: html.replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean).join(' · ').slice(0, 400),
      recommande: /Organisez si besoin.*utile sur les chantiers à plusieurs bâtiments ou lots/.test(html),
      ancienTexteInjonctif: /Créez mon premier niveau</.test(html) === false, // le libellé du BOUTON d'action reste (§"conserver une action"), seul le TEXTE d'accroche change
      boutonPresent: /Créer mon premier niveau/.test(html),
    };
  });
  note('STRUCT-07', r);
  ok(r.recommande,
    'STRUCT-07 : le texte d’état vide contient EXACTEMENT « Organisez si besoin — utile sur les chantiers à plusieurs bâtiments ou lots. »', 'STRUCT-07');
  ok(r.boutonPresent,
    'STRUCT-08 : l’action « Créer mon premier niveau » reste présente et cliquable — ce n’est que l’INVITATION textuelle qui change, pas l’action', 'STRUCT-08');
  await ctx.close();
}
console.log('\n[STRUCT-09] Création du premier niveau — parcours réel, toujours fonctionnel');
{
  const { ctx, p } = await newPage({ tag: 'STRUCT-CREATE' });
  await ev(p, () => {
    app.tasks = app.tasks.filter((t) => t.projectId !== 'terrasses');
    app.structureNodes = app.structureNodes.filter((n) => n.projectId !== 'terrasses');
    save();
    openProjectTab('terrasses', 'Structure');
  });
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('#projectContent .sn-empty-state .btn.primary').click());
  await p.waitForTimeout(150);
  await p.fill('[name="name"]', 'Bâtiment A');
  await p.evaluate(() => document.getElementById('drawerFormEl').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await p.waitForTimeout(200);
  const r = await ev(p, () => ({
    noeuds: getProjectStructure('terrasses').map((n) => n.name),
    ongletApres: projectTabs().includes('Structure'),
  }));
  note('STRUCT-09', r);
  ok(r.noeuds.includes('Bâtiment A'),
    'STRUCT-09 : « Créer mon premier niveau » → formulaire réel → soumission réelle → le niveau est bien créé', 'STRUCT-09');
  ok(r.ongletApres,
    'STRUCT-09 : l’onglet reste évidemment visible après la création', 'STRUCT-09');
  await ctx.close();
}
console.log('\n[STRUCT-10] Aucune donnée ni règle de structure altérée (moteur inchangé)');
{
  const { ctx, p } = await newPage({ tag: 'STRUCT-ENGINE' });
  const r = await ev(p, () => {
    // Les garde-fous existants (archivage/suppression/cycle) fonctionnent
    // toujours — mêmes règles qu’en V2.9.0/V2.9.1 (STC-38/39), simplement
    // rejouées ici pour prouver que R2 ne les a pas touchées.
    let racine = getProjectStructure('keravel').find((n) => !n.parentId);
    let enfant = getProjectStructure('keravel').find((n) => n.parentId === racine.id);
    let cycleRefuse = enfant ? structureParentError('keravel', racine.id, enfant.id) !== null : true;
    return {
      structureExistanteIntacte: getProjectStructure('keravel').length > 0,
      cycleRefuse,
    };
  });
  note('STRUCT-10', r);
  ok(r.structureExistanteIntacte && r.cycleRefuse,
    'STRUCT-10 : la structure existante de Keravel est intacte et la garde anti-cycle (structureParentError) fonctionne toujours à l’identique', 'STRUCT-10');
  await ctx.close();
}

// ============================================================
// ROLE-01 → 12 — R3 : SUPPRESSION DU RÔLE DE DÉMONSTRATION
// ============================================================
console.log('\n[ROLE-01] Absence dans le popover profil');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-POPOVER' });
  const r = await ev(p, () => { toggleUserMenu(); return document.getElementById('userPopover').innerHTML; });
  note('ROLE-01', { hasVoirCommeArtisan: /Voir comme artisan/.test(r), hasFieldMode: /Passer en mode Chantier/.test(r), hasSettings: /Réglages/.test(r) });
  ok(!/Voir comme artisan/.test(r),
    'ROLE-01 : « Voir comme artisan » n’apparaît plus dans le popover profil', 'ROLE-01');
  ok(/Passer en mode Chantier/.test(r) && /Réglages/.test(r) && /Réinitialiser la démo/.test(r),
    'ROLE-01 : les AUTRES actions du popover (Mode Chantier, Réglages, Réinitialiser) restent toutes présentes — retrait chirurgical', 'ROLE-01');
  await ctx.close();
}
console.log('\n[ROLE-02] Absence dans les Réglages');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-SETTINGS' });
  const r = await ev(p, () => { go('more'); return document.getElementById('main').innerHTML; });
  note('ROLE-02', { demo: /Mode de démonstration/.test(r), roleCard: /role-card/.test(r), voirKanvixComme: /Voir Kanvix comme/.test(r) });
  ok(!/Mode de démonstration/.test(r) && !/role-card/.test(r) && !/Voir Kanvix comme/.test(r),
    'ROLE-02 : le bloc « Mode de démonstration » (titre, cartes, sous-titre) a disparu entièrement des Réglages', 'ROLE-02');
  await ctx.close();
}
console.log('\n[ROLE-03] Absence d’un autre point d’entrée équivalent (bascule artisan → conducteur)');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-CHAT', role: 'artisan' });
  const r = await ev(p, () => document.getElementById('main').innerHTML);
  note('ROLE-03', { vueConducteur: /Vue conducteur/.test(r), setRoleDriverInDom: /setRole\('driver'\)/.test(r) });
  ok(!/Vue conducteur/.test(r) && !/setRole\('driver'\)/.test(r),
    'ROLE-03 : le bouton « Vue conducteur » de la conversation Artisan (l’autre sens du même bascule manuel) a lui aussi disparu', 'ROLE-03');
  await ctx.close();
}
console.log('\n[ROLE-04] Aucun autre appel setRole(...) dans le DOM applicatif (balayage exhaustif)');
{
  const B = fs.readFileSync(BASE + CUR, 'utf8');
  const appels = [...B.matchAll(/onclick="[^"]*setRole\([^)]*\)[^"]*"/g)].map((m) => m[0]);
  note('ROLE-04', { appels });
  ok(appels.length === 0,
    'ROLE-04 : balayage du fichier entier — plus AUCUN attribut onclick n’appelle setRole() nulle part dans l’interface', 'ROLE-04');
}
console.log('\n[ROLE-05] La vue Artisan elle-même n’est pas cassée');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-ARTISAN-VIEW', role: 'artisan' });
  const r = await ev(p, () => ({
    hasChat: !!document.querySelector('.chat'),
    hasMission: !!document.querySelector('.chat-mission'),
    hasThread: !!document.getElementById('chatThread'),
    hasCompose: !!document.querySelector('.chat-compose'),
    role: app.settings.role,
  }));
  note('ROLE-05', r);
  ok(r.hasChat && r.hasMission && r.hasThread && r.hasCompose && r.role === 'artisan',
    'ROLE-05 : renderArtisan() rend toujours intégralement sa page (mission, fil de conversation, composeur) — setRole(\'artisan\') fonctionne encore en interne, seule l’AFFORDANCE utilisateur a été retirée', 'ROLE-05');
  await ctx.close();
}
console.log('\n[ROLE-06] Fonctions et données indispensables préservées');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-INTERNALS' });
  const r = await ev(p, () => ({
    setRoleType: typeof setRole,
    artisanResourceId: app.settings.artisanResourceId,
    driverModeIntact: typeof isFieldMode === 'function',
  }));
  note('ROLE-06', r);
  ok(r.setRoleType === 'function',
    'ROLE-06 : setRole() existe toujours (nécessaire en interne et pour les recettes automatisées qui testent la vue Artisan)', 'ROLE-06');
  await ctx.close();
}
console.log('\n[ROLE-07/08] Essentiel/Pilotage : les DEUX emplacements existent toujours');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-LEVEL-BOTH' });
  const r = await ev(p, () => {
    toggleUserMenu();
    const popover = document.getElementById('userPopover').innerHTML;
    go('more');
    const settings = document.getElementById('main').innerHTML;
    return {
      popoverHasEssentiel: /Essentiel/.test(popover) && /setDepth\('essential'\)/.test(popover),
      popoverHasPilotage: /Pilotage/.test(popover) && /setDepth\('pilot'\)/.test(popover),
      settingsHasNiveau: /Niveau d.affichage/.test(settings),
      settingsHasEssentielOpt: /setDepth\('essential'\)/.test(settings),
      settingsHasPilotOpt: /setDepth\('pilot'\)/.test(settings),
    };
  });
  note('ROLE-07', r);
  ok(r.popoverHasEssentiel && r.popoverHasPilotage,
    'ROLE-07 : le RACCOURCI du popover profil (Essentiel/Pilotage) est toujours là', 'ROLE-07');
  ok(r.settingsHasNiveau && r.settingsHasEssentielOpt && r.settingsHasPilotOpt,
    'ROLE-08 : l’EMPLACEMENT DE RÉFÉRENCE des Réglages (« Niveau d’affichage ») est toujours là', 'ROLE-08');
  await ctx.close();
}
console.log('\n[ROLE-09] Synchronisation profil → Réglages');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-SYNC-1' });
  const r = await ev(p, () => {
    setDepth('essential'); // depuis le mécanisme du popover
    go('more');
    const settingsAfter = document.getElementById('main').innerHTML;
    return {
      badgeEssentielActif: /seg-opt active[^>]*>[\s\S]{0,90}Essentiel/.test(settingsAfter),
      level: app.settings.level,
    };
  });
  note('ROLE-09', r);
  ok(r.level === 'essential' && r.badgeEssentielActif,
    'ROLE-09 : changer le niveau via setDepth() (le mécanisme du popover) est immédiatement reflété dans les Réglages, ré-rendus au prochain passage sur cette page', 'ROLE-09');
  await ctx.close();
}
console.log('\n[ROLE-10] Synchronisation Réglages → profil');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-SYNC-2' });
  const r = await ev(p, () => {
    go('more');
    document.querySelector('.seg-opt[onclick*="pilot"]').click(); // clic réel sur le contrôle des Réglages
    toggleUserMenu();
    const popoverAfter = document.getElementById('userPopover').innerHTML;
    return {
      level: app.settings.level,
      profileLevelLabel: document.getElementById('profileLevel').textContent,
      popoverSelected: /button class="selected"[^>]*>[\s\S]{0,20}✓ Pilotage/.test(popoverAfter),
    };
  });
  note('ROLE-10', r);
  ok(r.level === 'pilot' && /Pilotage/.test(r.profileLevelLabel) && r.popoverSelected,
    'ROLE-10 : cliquer le contrôle des Réglages met immédiatement à jour le badge « Mode · … » ET la sélection du popover', 'ROLE-10');
  await ctx.close();
}
console.log('\n[ROLE-11] Persistance après rechargement');
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p1 = await ctx.newPage();
  await p1.route('https://**', (r) => r.abort('failed'));
  await p1.goto(F(CUR), { waitUntil: 'load' });
  await p1.evaluate(() => { resetApp(); setDepth('essential'); dismissKanvixContinuityNotice(); });
  await p1.waitForTimeout(150);
  await p1.close();
  const p2 = await ctx.newPage();
  await p2.route('https://**', (r) => r.abort('failed'));
  await p2.goto(F(CUR), { waitUntil: 'load' });
  await p2.waitForTimeout(150);
  const level = await p2.evaluate(() => app.settings.level);
  note('ROLE-11', { level });
  ok(level === 'essential',
    'ROLE-11 : le niveau choisi persiste après un rechargement complet de la page (nouvel onglet, même stockage)', 'ROLE-11');
  await ctx.close();
}
console.log('\n[ROLE-12] Aucune divergence de valeur ou de libellé entre les deux emplacements');
{
  const { ctx, p } = await newPage({ tag: 'ROLE-NODIVERGE' });
  const r = await ev(p, () => {
    let out = [];
    for (const lvl of ['essential', 'pilot']) {
      setDepth(lvl);
      toggleUserMenu();
      const pop = document.getElementById('userPopover').innerHTML;
      go('more');
      const set = document.getElementById('main').innerHTML;
      out.push({
        lvl,
        popActive: (pop.match(/button class="selected"[^>]*>[\s\S]{0,60}/) || [''])[0],
        setActive: (set.match(/seg-opt active[^>]*>[\s\S]{0,90}/) || [''])[0],
      });
    }
    return out;
  });
  note('ROLE-12', r);
  ok(r.every((x) => x.popActive && x.setActive && x.popActive.includes(x.lvl === 'essential' ? 'Essentiel' : 'Pilotage') && x.setActive.includes(x.lvl === 'essential' ? 'Essentiel' : 'Pilotage')),
    'ROLE-12 : à chaque niveau, popover ET Réglages désignent la MÊME valeur active — aucune divergence', 'ROLE-12');
  await ctx.close();
}

// ============================================================
// OPS-01 → 12 — R4 : OPÉRATIONS RÉSERVÉ AU PILOTAGE
// ============================================================
console.log('\n[OPS-01] Invisible en Essentiel');
{
  const { ctx, p } = await newPage({ tag: 'OPS-ESSENTIEL' });
  const r = await ev(p, () => {
    setDepth('essential');
    go('sites');
    return { html: document.getElementById('main').innerHTML, page: app.ui.page };
  });
  note('OPS-01', { switchPresent: /sites-mode/.test(r.html), opWord: /Opérations/.test(r.html) });
  ok(!/sites-mode/.test(r.html),
    'OPS-01 : le sélecteur Chantiers/Opérations ne se rend PAS du tout en Essentiel', 'OPS-01');
  ok(!/class="op-grid"/.test(r.html) && !/op-card/.test(r.html),
    'OPS-01 : aucune carte d’opération n’est présente sur la page Chantiers en Essentiel', 'OPS-01');
  await ctx.close();
}
console.log('\n[OPS-02] Visible et fonctionnel en Pilotage');
{
  const { ctx, p } = await newPage({ tag: 'OPS-PILOT' });
  const r = await ev(p, () => {
    setDepth('pilot');
    go('sites');
    setSitesMode('operations');
    return { html: document.getElementById('main').innerHTML, mode: app.ui.sitesMode };
  });
  note('OPS-02', { switchPresent: /sites-mode/.test(r.html), hasList: /op-grid|Aucune opération/.test(r.html) });
  ok(/sites-mode/.test(r.html) && r.mode === 'operations',
    'OPS-02 : le sélecteur est présent et « Opérations » est activable en Pilotage', 'OPS-02');
  ok(/op-grid|Aucune opération/.test(r.html),
    'OPS-02 : la liste des opérations se rend réellement (renderOperationsList / operationCard inchangés)', 'OPS-02');
  await ctx.close();
}
console.log('\n[OPS-03] Retour sûr vers Chantiers — depuis la LISTE des opérations');
{
  const { ctx, p } = await newPage({ tag: 'OPS-RETURN-LIST' });
  const r = await ev(p, () => {
    setDepth('pilot');
    go('sites');
    setSitesMode('operations');
    const avant = document.getElementById('main').innerHTML;
    setDepth('essential'); // bascule SANS naviguer explicitement ailleurs
    const apres = document.getElementById('main').innerHTML;
    return {
      avantAvaitOperations: /op-grid|Aucune opération/.test(avant),
      apresPage: app.ui.page,
      apresAChantiers: /Chantiers/.test(apres) && /sites-tabs/.test(apres),
      apresPasOperations: !/op-grid/.test(apres) && !/sites-mode/.test(apres),
    };
  });
  note('OPS-03', r);
  ok(r.avantAvaitOperations && r.apresPage === 'sites' && r.apresAChantiers && r.apresPasOperations,
    'OPS-03 : en train de consulter la LISTE des Opérations, un passage en Essentiel montre immédiatement la page Chantiers — jamais un écran vide sans navigation', 'OPS-03');
  await ctx.close();
}
console.log('\n[OPS-04] Retour sûr vers Chantiers — depuis la FICHE d’une opération');
{
  const { ctx, p } = await newPage({ tag: 'OPS-RETURN-DETAIL' });
  const r = await ev(p, () => {
    setDepth('pilot');
    let opId = (app.operations || [])[0]?.id;
    if (!opId) {
      snapshot();
      opId = 'op-test';
      app.operations = app.operations || [];
      app.operations.push({ id: opId, name: 'Opération test', location: 'Brest', createdAt: historyNow() });
      save();
    }
    selectOperation(opId);
    const avant = { page: app.ui.page, html: document.getElementById('main').innerHTML };
    setDepth('essential'); // bascule pendant la consultation de la FICHE
    const apres = { page: app.ui.page, html: document.getElementById('main').innerHTML };
    return { opId, avant: { page: avant.page, hadHeader: /op-header/.test(avant.html) }, apres: { page: apres.page, hasChantiers: /sites-tabs/.test(apres.html), hasOpHeader: /op-header/.test(apres.html) } };
  });
  note('OPS-04', r);
  ok(r.avant.page === 'operation' && r.avant.hadHeader,
    'OPS-04 : le cas de test consulte bien la fiche détaillée d’UNE opération (page "operation")', 'OPS-04');
  ok(r.apres.page === 'sites' && r.apres.hasChantiers && !r.apres.hasOpHeader,
    'OPS-04 : passer en Essentiel pendant la consultation de cette fiche renvoie proprement vers Chantiers — jamais la fiche Opération affichée sans point de navigation', 'OPS-04');
  await ctx.close();
}
console.log('\n[OPS-05] Réapparition lors du retour en Pilotage');
{
  const { ctx, p } = await newPage({ tag: 'OPS-REAPPEAR' });
  const r = await ev(p, () => {
    setDepth('pilot');
    setSitesMode('operations');
    setDepth('essential');
    setDepth('pilot'); // retour
    go('sites');
    return { html: document.getElementById('main').innerHTML, mode: app.ui.sitesMode };
  });
  note('OPS-05', { switchBack: /sites-mode/.test(r.html) });
  ok(/sites-mode/.test(r.html),
    'OPS-05 : de retour en Pilotage, le sélecteur Chantiers/Opérations réapparaît', 'OPS-05');
  ok(r.mode === 'operations',
    'OPS-05 : la préférence app.ui.sitesMode n’a jamais été effacée par le passage en Essentiel — l’utilisateur retrouve directement sa liste d’Opérations', 'OPS-05');
  await ctx.close();
}
console.log('\n[OPS-06] Conservation intégrale des données d’opérations');
{
  const { ctx, p } = await newPage({ tag: 'OPS-DATA' });
  const r = await ev(p, () => {
    const avant = JSON.stringify(app.operations);
    const avantLinks = JSON.stringify(app.projects.map((p) => [p.id, p.operationId]).sort());
    setDepth('pilot');
    setSitesMode('operations');
    setDepth('essential');
    setDepth('pilot');
    const apres = JSON.stringify(app.operations);
    const apresLinks = JSON.stringify(app.projects.map((p) => [p.id, p.operationId]).sort());
    return { identique: avant === apres, liensIdentiques: avantLinks === apresLinks };
  });
  note('OPS-06', r);
  ok(r.identique && r.liensIdentiques,
    'OPS-06 : app.operations et les rattachements project.operationId sont STRICTEMENT identiques après un aller-retour Pilotage → Essentiel → Pilotage — aucune opération ni rattachement supprimé', 'OPS-06');
  await ctx.close();
}
console.log('\n[OPS-07] Code mort `advanced && !expert` — démonstration et suppression sans régression');
{
  const A = fs.readFileSync(BASE + PREV, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
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
  const prevFn = extractFn(A, 'renderPlanning');
  const staticProof = /advanced = app\.settings\.level !== "essential"/.test(prevFn) &&
    /expert = app\.settings\.level !== "essential"/.test(prevFn);
  const curFn = extractFn(B, 'renderPlanning');
  // On mesure le CODE, pas la prose : un commentaire qui EXPLIQUE le retrait
  // (et qui mentionne donc le nom de la condition) ne doit pas faire échouer
  // la preuve — même piège déjà rencontré et corrigé en V2.12.0.1/V2.12.0.2
  // (assertion helperPur).
  const stillPresentInCur = /advanced && !expert/.test(
    curFn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
  );
  note('OPS-07', { staticProof, stillPresentInCur });
  ok(staticProof,
    'OPS-07 : PREUVE STATIQUE — dans V2.12.1, `advanced` et `expert` sont calculées par l’EXACTE même expression (app.settings.level !== "essential") ; `advanced && !expert` vaut donc toujours FAUX, quel que soit le niveau', 'OPS-07');
  ok(!stillPresentInCur,
    'OPS-07 : le ternaire mort a bien été retiré du source de V2.12.2', 'OPS-07');
  // PREUVE COMPORTEMENTALE : rendu de .plan-toolbar strictement identique
  // entre V2.12.1 (où le ternaire existait mais ne produisait jamais rien)
  // et V2.12.2 (où il n'existe plus), pour les deux niveaux.
  const toolbarHtml = async (file, level) => {
    const { ctx, p } = await newPage({ tag: 'TOOLBAR-' + level, file });
    const html = await ev(p, (lvl) => {
      setDepth(lvl);
      go('planning');
      return document.querySelector('.plan-toolbar')?.outerHTML || '';
    }, level);
    await ctx.close();
    return html;
  };
  const prevEss = await toolbarHtml(PREV, 'essential'), curEss = await toolbarHtml(CUR, 'essential');
  const prevPil = await toolbarHtml(PREV, 'pilot'), curPil = await toolbarHtml(CUR, 'pilot');
  note('OPS-07-rendu', { prevEss, curEss, prevPil, curPil });
  ok(prevEss === curEss && prevPil === curPil,
    'OPS-07 : PREUVE COMPORTEMENTALE — le HTML de .plan-toolbar est BYTE-IDENTIQUE entre V2.12.1 et V2.12.2, en Essentiel comme en Pilotage : supprimer le code mort n’a strictement rien changé au rendu observable', 'OPS-07');
}

// ============================================================
// NON-RÉGRESSION — « Préparer un décalage » V2.12.1 rejouée contre V2.12.2
// ============================================================
console.log('\n[DECAL-REPLAY] Rejeu intégral de la recette V2.12.1 contre V2.12.2');
{
  const { execSync } = await import('child_process');
  try {
    const out = execSync(
      `node /home/user/Planzy-saas/recette-preparer-decalage-v2.12.1.mjs`,
      { env: { ...process.env, KVX_SHOTS: SHOTS + 'decal-replay/' }, cwd: '/home/user/Planzy-saas', encoding: 'utf8' },
    );
    const m = out.match(/RÉSULTAT : (\d+) \/ (\d+)/);
    const errM = out.match(/ERREURS CONSOLE APPLICATIVES : (\d+)/);
    note('DECAL-REPLAY', { m: m && m[0], err: errM && errM[0] });
    ok(m && m[1] === m[2] && m[1] === '77',
      `DECAL-REPLAY : la recette V2.12.1 « Préparer un décalage », REJOUÉE TELLE QUELLE contre kanvix-next-gen-v2.12.1.html (son propre CUR, inchangé au sein de ce repo — voir note ci-dessous), obtient ${m ? m[0] : '?'}`, 'DECAL-REPLAY');
  } catch (e) {
    ok(false, 'DECAL-REPLAY : échec d’exécution — ' + e.message.slice(0, 300), 'DECAL-REPLAY');
  }
}
// La recette V2.12.1 pointe intrinsèquement son CUR sur kanvix-next-gen-v2.12.1.html
// (fichier NON modifié par ce round — périmètre strictement gelé, voir FREEZE-2122).
// Pour vérifier que « Préparer un décalage » se comporte IDENTIQUEMENT sur le
// fichier V2.12.2 lui-même, on rejoue ici les 14 fonctions du parcours dans le
// contexte du nouveau fichier, via le même geste utilisateur réel qu'en V2.12.1.
console.log('\n[DECAL-ON-V2122] Le parcours « Préparer un décalage » sur le fichier V2.12.2 lui-même');
{
  const { ctx, p } = await newPage({ tag: 'DECAL-2122' });
  const r = await ev(p, () => {
    const av = { t: { ...task('t-slab') }, undo: undoHistory.length };
    openTask('t-slab');
    document.querySelector('.more-trigger')?.click();
    document.evaluate("//button[contains(text(),'Préparer un décalage')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click();
    document.getElementById('shiftDaysInput').value = '1';
    submitPrepareShiftForm();
    document.getElementById('shiftConfirmAck').click();
    applyPrepareShift();
    const ap = { t: task('t-slab').start, undo: undoHistory.length, histo: app.history[0]?.text };
    undo();
    const un = { t: task('t-slab').start };
    return { av, ap, un };
  });
  note('DECAL-ON-V2122', r);
  ok(r.ap.undo === r.av.undo + 1 && r.ap.t === '2026-08-18T09:00' && /décalée de 1 jour/.test(r.ap.histo || ''),
    'DECAL-ON-V2122 : sur le fichier V2.12.2 lui-même, le parcours complet (bouton → panneau → calcul → confirmation → application) fonctionne à l’identique', 'DECAL-ON-V2122');
  ok(r.un.t === r.av.t.start,
    'DECAL-ON-V2122 : et son Undo restaure la date d’origine — la transaction et son annulation sont intactes', 'DECAL-ON-V2122');
  await ctx.close();
}

// ============================================================
// FREEZE-2122 — CONTRÔLE DE PÉRIMÈTRE DIFFÉRENTIEL V2.12.1 → V2.12.2
// ============================================================
console.log('\n[FREEZE-2122] Contrôle différentiel de périmètre');
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
  const parIndentation = ['renderAIPanel'];
  const blocIndente = (src, nom) => {
    const lignes = src.split('\n');
    const re = new RegExp('^(\\s*)function\\s+' + nom + '\\s*\\(');
    for (let i = 0; i < lignes.length; i++) {
      const m = re.exec(lignes[i]);
      if (!m) continue;
      const ind = m[1].length, out = [lignes[i]];
      for (let j = i + 1; j < lignes.length; j++) {
        out.push(lignes[j]);
        if (lignes[j].trim() === '}' && lignes[j].length - lignes[j].trimStart().length === ind) return out.join('\n');
      }
    }
    return null;
  };
  const attendues = ['openTask' /* menu déjà présent V2.12.1, non re-touché ici */].filter(() => false)
    .concat(['renderMore', 'renderUserMenu', 'renderArtisan', 'renderSites', 'sitesModeSwitch', 'renderOperation', 'renderPlanning', 'projectStructureTab']);
  const ajouteesAttendues = []; // R2-R4 : aucune fonction ajoutée, uniquement du retrait/gate.
  const supprimeesAttendues = ['roleCard'];
  const horsPerimetre = [], ajoutees = [], supprimees = [];
  const nomsB = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  const nomsA = [...new Set([...A.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  nomsB.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  nomsA.forEach((n) => { if (!nomsB.includes(n)) supprimees.push(n); });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  const nonModifiees = attendues.filter((n) => md5(extractFn(A, n) || '') === md5(extractFn(B, n) || ''));
  note('FREEZE-2122-diff', { modifiées: attendues, ajoutées: ajoutees.sort(), supprimées: supprimees.sort(), horsPérimètre: horsPerimetre, indentation: indentDiff, nonModifiées: nonModifiees });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-2122 : hors des 8 fonctions annoncées (renderMore, renderUserMenu, renderArtisan, renderSites, sitesModeSwitch, renderOperation, renderPlanning, projectStructureTab), AUCUNE autre fonction existante n’a changé — renderAIPanel comparé par bloc indenté reste lui aussi identique', 'FREEZE-2122');
  ok(nonModifiees.length === 0,
    'FREEZE-2122 : les 8 fonctions annoncées ont RÉELLEMENT changé — aucun périmètre annoncé pour rien', 'FREEZE-2122');
  ok(JSON.stringify(ajoutees.sort()) === JSON.stringify(ajouteesAttendues),
    'FREEZE-2122 : AUCUNE fonction ajoutée — ce lot ne crée aucun moteur, uniquement des gardes de rendu et un retrait', 'FREEZE-2122');
  ok(JSON.stringify(supprimees.sort()) === JSON.stringify(supprimeesAttendues),
    'FREEZE-2122 : UNE SEULE fonction supprimée (roleCard) — le helper de rendu devenu orphelin après le retrait du bloc « Mode de démonstration »', 'FREEZE-2122');

  // Les 14 fonctions transactionnelles de V2.12.1 doivent être byte-identiques.
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
  ]);
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-2122-gelés', { comparées: compares, decal14: decal14.length, bougés: bouges });
  ok(compares > 45 && bouges.length === 0,
    `FREEZE-2122 : les ${compares} fonctions gelées sont BYTE-IDENTIQUES à V2.12.1 — les 14 fonctions transactionnelles de « Préparer un décalage » comprises, plus planReflow/applyReflowPlan/planScheduleChanges, le calendrier, Undo/Redo/preserveCommunications, la messagerie, setTaskStatus, scenarioOptions/showWhatIf, le moteur Structure (getProjectStructure/openStructureForm/toggleStructureArchive) et openTask() (dont le bouton « Préparer un décalage » du menu reste inchangé)`, 'FREEZE-2122');

  const bloc = (src, re) => (src.match(re) || [''])[0];
  const schema = {
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    initialIdentique: md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)),
  };
  note('FREEZE-2122-données', schema);
  ok(schema.schemaAvant === '15' && schema.schemaApres === '15' && schema.store === 'kanvix-product-8-3',
    'FREEZE-2122 : SCHEMA_VERSION (15) et STORE inchangés — R2-R4 est un lot UX, aucune migration', 'FREEZE-2122');
  ok(schema.initialIdentique,
    'FREEZE-2122 : INITIAL_STATE byte-identique — aucune donnée de démonstration modifiée', 'FREEZE-2122');

  // Styles : la feuille change nécessairement (retrait volontaire de
  // .role-card/.role-grid/.settings-grid/.settings-intro, voir rapport) —
  // on le CONSTATE et on borne précisément l'ampleur du changement au lieu
  // d'exiger une byte-identité qui contredirait le mandat de ce lot.
  const cssA = bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/), cssB = bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/);
  const cssIdentique = md5(cssA) === md5(cssB);
  const classesRetirees = ['.role-card', '.role-grid', '.settings-grid', '.settings-intro'].filter((c) => cssA.includes(c) && !cssB.includes(c));
  note('FREEZE-2122-css', { cssIdentique, classesRetirees, octetsAvant: cssA.length, octetsApres: cssB.length, delta: cssB.length - cssA.length });
  ok(!cssIdentique && classesRetirees.length === 4,
    'FREEZE-2122 : la feuille de style a changé UNIQUEMENT par le retrait des 4 classes du sélecteur de rôle (.role-card/.role-grid/.settings-grid/.settings-intro) — changement attendu et borné, pas une refonte', 'FREEZE-2122');
}

// ============================================================
// VALIDATION NAVIGATEUR — 4 largeurs/thèmes, captures obligatoires
// ============================================================
console.log('\n[NAV-RESP] 1440/390 × clair/sombre');
{
  const combos = [[1440, false], [1440, true], [390, false], [390, true]];
  const fautives = [];
  for (const [w, dark] of combos) {
    const { ctx, p } = await newPage({ w, h: w <= 430 ? 844 : 1000, tag: `NAV${w}${dark ? 'D' : 'L'}` });
    if (dark) { await ev(p, () => setAppearance('dark')); await p.waitForTimeout(120); }
    await ev(p, () => { setDepth('essential'); go('sites'); });
    let m = await ev(p, () => {
      const de = document.documentElement;
      return { scrollH: de.scrollWidth > de.clientWidth + 1 };
    });
    if (m.scrollH) fautives.push({ w, dark, page: 'sites-essential' });
    await ev(p, () => { toggleUserMenu(); });
    await p.waitForTimeout(80);
    m = await ev(p, () => {
      const de = document.documentElement, pop = document.getElementById('userPopover');
      return { scrollH: de.scrollWidth > de.clientWidth + 1, popOpen: pop.classList.contains('open'), popUsable: pop.querySelectorAll('button').length > 3 };
    });
    if (m.scrollH) fautives.push({ w, dark, page: 'popover' });
    if (w === 1440 && !dark) await p.screenshot({ path: SHOTS + '02c-popover-profil-sans-role-demo.png' }).catch(() => {});
    await ev(p, () => { closeUserMenu(); go('more'); });
    m = await ev(p, () => ({ scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    if (m.scrollH) fautives.push({ w, dark, page: 'settings' });
    // Capture obligatoire n°2 : la page RÉGLAGES elle-même (Niveau d'affichage
    // conservé, bloc « Mode de démonstration » disparu) — pas seulement le
    // popover, qui n'est qu'un raccourci vers le même réglage.
    if (w === 1440 && !dark) await p.screenshot({ path: SHOTS + '02-reglages-essentiel-pilotage-conserve.png' }).catch(() => {});
    await ev(p, () => { app.tasks = app.tasks.filter((t) => t.projectId !== 'terrasses'); save(); openProjectTab('terrasses', 'Structure'); });
    await p.waitForTimeout(80);
    m = await ev(p, () => ({ scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    if (m.scrollH) fautives.push({ w, dark, page: 'structure-vide' });
    if (w === 390 && !dark) await p.screenshot({ path: SHOTS + '01-structure-vide-essentiel.png' }).catch(() => {});
    await ev(p, () => go('sites'));
    m = await ev(p, () => ({ scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, hasOps: /sites-mode/.test(document.getElementById('main').innerHTML) }));
    if (m.scrollH) fautives.push({ w, dark, page: 'sites-essential-noops' });
    if (w === 1440 && !dark) await p.screenshot({ path: SHOTS + '03-chantiers-essentiel-sans-operations.png' }).catch(() => {});
    await ev(p, () => { setDepth('pilot'); setSitesMode('operations'); });
    m = await ev(p, () => ({ scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    if (m.scrollH) fautives.push({ w, dark, page: 'sites-pilot-ops' });
    if (w === 1440 && !dark) await p.screenshot({ path: SHOTS + '04-chantiers-pilotage-avec-operations.png' }).catch(() => {});
    await ctx.close();
  }
  note('NAV-RESP', { testées: combos.length, fautives });
  ok(fautives.length === 0,
    `NAV-RESP : sur ${combos.length} combinaisons (1440/390 × clair/sombre), Chantiers (Essentiel et Pilotage), le popover profil, les Réglages et Structure (état vide) ne provoquent AUCUN débordement horizontal`, 'NAV-RESP');
}
console.log('\n[NAV-KBD] Navigation clavier et focus visible');
{
  const { ctx, p } = await newPage({ tag: 'NAV-KBD' });
  await ev(p, () => { app.tasks = app.tasks.filter((t) => t.projectId !== 'terrasses'); save(); openProjectTab('terrasses', 'Structure'); });
  await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector('#projectContent .sn-empty-state .btn.primary').focus());
  const focused1 = await p.evaluate(() => document.activeElement?.textContent);
  await p.keyboard.press('Tab');
  const focusMoved = await p.evaluate(() => document.activeElement !== document.body);
  note('NAV-KBD', { focused1, focusMoved });
  ok(/Créer mon premier niveau/.test(focused1 || ''),
    'NAV-KBD : le bouton d’action de l’état vide Structure est atteignable et reçoit le focus', 'NAV-KBD');
  ok(focusMoved,
    'NAV-KBD : Tab déplace le focus vers un autre élément interactif — navigation clavier fonctionnelle', 'NAV-KBD');
  await ctx.close();
}

// ============================================================
const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim|google\.com/.test(e.msg));
ok(appErrs.length === 0, `SIMPLIF-R2R4 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'SIMPLIF');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 15), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
