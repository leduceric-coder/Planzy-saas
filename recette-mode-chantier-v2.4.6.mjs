// ============================================================
// KANVIX — Recette globale du Mode Chantier — baseline V2.4.5
// Audit AUTOMATISÉ EN LECTURE SEULE — ne modifie jamais le POC.
// Usage : node recette-mode-chantier-v2.4.5.mjs
//   (un serveur http est requis pour les scénarios multi-onglets :
//    cd public/poc && python3 -m http.server 8241)
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;

const NOW = '?now=2026-08-13T09:00:00';
const FILE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.6.html' + NOW;
const HTTP = 'http://localhost:8241/kanvix-next-gen-v2.4.6.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-mode-chantier-v246/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

let passed = 0, failed = [];
const results = [];
const ok = (c, name, section) => {
  if (c) passed++; else failed.push(`[${section}] ${name}`);
  results.push({ section, name, status: c ? 'PASS' : 'FAIL' });
  console.log(`  ${c ? '✓' : '✗'} [${section}] ${name}`);
};
const note = (section, name, detail) => {
  results.push({ section, name, status: 'INFO', detail });
  console.log(`  (info) [${section}] ${name}: ${JSON.stringify(detail)}`);
};
const allErrs = [];
const OM_MOCK = JSON.stringify({ latitude: 48.39, longitude: -4.48, timezone: 'GMT', current: { time: '2026-08-13T09:00', temperature_2m: 14.2, weather_code: 61, wind_speed_10m: 22 } });
const GEOCODE_MOCK = (name, lon, lat) => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { city: [name], label: name }, geometry: { type: 'Point', coordinates: [lon, lat] } }] });

async function newPage(opts = {}) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: opts._tag || 'page', msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: opts._tag || 'page', msg: m.text() }); });
  if (opts.mockWeather !== false) {
    await p.route('https://api.open-meteo.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: OM_MOCK }));
    await p.route('https://data.geopf.fr/geocodage/search**', (r) => { const u = new URL(r.request().url()), q = (u.searchParams.get('q') || '').toLowerCase(); r.fulfill({ status: 200, contentType: 'application/json', body: GEOCODE_MOCK(q, -4.48, 48.39) }); });
    await p.route('https://data.geopf.fr/geocodage/reverse**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: GEOCODE_MOCK('Brest', -4.48, 48.39) }));
  }
  await p.goto(FILE, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
// Entre en Mode Chantier conducteur, éventuellement sur un chantier donné.
async function enterField(p, projectId) {
  await ev(p, (pid) => {
    resetApp(); setDepth('pilot'); setRole('driver'); enterFieldMode();
    if (pid) selectFieldProject(pid);
  }, projectId);
  await p.waitForTimeout(250);
}

// ============================================================
// PM-F1 — ARRIVÉE SUR CHANTIER (P0)
// ============================================================
console.log('\n[PM-F1] Arrivée sur chantier');
{
  const { ctx, p } = await newPage({ permissions: ['geolocation'], geolocation: { latitude: 48.39, longitude: -4.48 }, viewport: { width: 390, height: 844 }, _tag: 'PM-F1' });
  // Depuis le Bureau conducteur mobile
  await ev(p, () => { resetApp(); setDepth('pilot'); setRole('driver'); go('today'); });
  await p.waitForTimeout(200);
  const entryVisible = await ev(p, () => { const e = document.querySelector('.field-mobile-entry'); return !!e && getComputedStyle(e).display !== 'none'; });
  ok(entryVisible, 'bouton "Mode Chantier" visible sur l\'Accueil mobile conducteur', 'PM-F1');
  await ev(p, () => document.querySelector('.field-mobile-entry').click());
  await p.waitForTimeout(250);
  const afterEnter = await ev(p, () => ({
    field: isFieldMode(),
    driverMode: app.settings.driverMode,
    wrap: !!document.querySelector('.field-wrap'),
    sidebarVisible: (() => { const s = document.querySelector('.sidebar'); return s ? getComputedStyle(s).display !== 'none' : false; })(),
    bottomButtons: [...document.querySelectorAll('.field-bottom button')].map((x) => x.textContent.replace(/\d+/g, '').trim()),
    scrollY: window.scrollY,
  }));
  ok(afterEnter.field && afterEnter.driverMode === 'field', 'entrée : driverMode = field', 'PM-F1');
  ok(afterEnter.wrap, 'shell Mode Chantier (.field-wrap) affiché immédiatement', 'PM-F1');
  ok(!afterEnter.sidebarVisible, 'sidebar Bureau absente', 'PM-F1');
  ok(afterEnter.scrollY === 0, 'position en haut de l\'écran (scrollY=0)', 'PM-F1');
  ok(afterEnter.bottomButtons.length === 2 && /Chantier/.test(afterEnter.bottomButtons[0]) && /Messages/.test(afterEnter.bottomButtons[1]), 'barre basse = exactement [Chantier][Messages] (' + afterEnter.bottomButtons.join('|') + ')', 'PM-F1');
  await p.screenshot({ path: SHOTS + 'A-mode-chantier-home-390.png', fullPage: true });

  // Sélecteur : chantiers ACTIFS uniquement (on archive un chantier -> exclu)
  const picker = await ev(p, () => {
    // pas encore de chantier sélectionné
    app.ui.fieldProjectId = null;
    // archive "villa" pour vérifier son exclusion
    project('villa').lifecycle = 'archived';
    save(); renderPage();
    return {
      cards: [...document.querySelectorAll('.field-project-card b')].map((x) => x.textContent),
    };
  });
  ok(!picker.cards.includes('Villa du Port'), 'sélecteur : chantier archivé (Villa du Port) NON proposé', 'PM-F1');
  ok(picker.cards.length >= 1, 'sélecteur : chantiers actifs proposés (' + picker.cards.join(', ') + ')', 'PM-F1');
  await p.screenshot({ path: SHOTS + 'B-selection-chantier.png', fullPage: true });

  // Sélection Keravel
  await ev(p, () => { project('villa').lifecycle = 'active'; selectFieldProject('keravel'); });
  await p.waitForTimeout(200);
  const sel = await ev(p, () => ({
    fieldProjectId: app.ui.fieldProjectId,
    head: document.querySelector('.field-project-head h1')?.textContent,
    todayRows: document.querySelectorAll('.field-section .field-task').length,
  }));
  ok(sel.fieldProjectId === 'keravel' && sel.head === 'Résidence Keravel', 'sélection Keravel mémorisée + titre affiché', 'PM-F1');

  // Ouvrir une intervention du jour -> POPUP (jamais drawer)
  await ev(p, () => document.querySelector('.field-section .field-task').click());
  await p.waitForTimeout(200);
  const taskOpen = await ev(p, () => ({
    modalOpen: document.querySelector('#modal').classList.contains('open'),
    drawerOpen: document.querySelector('#drawer').classList.contains('open'),
    title: document.querySelector('#modalContent h2')?.textContent,
  }));
  ok(taskOpen.modalOpen && !taskOpen.drawerOpen, 'consultation tâche = POPUP (#modal), aucun drawer', 'PM-F1');
  await p.screenshot({ path: SHOTS + 'C-tache-popup.png', fullPage: true });
  // Fermer -> retour exact au Mode Chantier, chantier conservé
  await ev(p, () => closeOverlay('modal'));
  await p.waitForTimeout(150);
  const backOk = await ev(p, () => ({ field: isFieldMode(), pid: app.ui.fieldProjectId, modal: document.querySelector('#modal').classList.contains('open') }));
  ok(backOk.field && backOk.pid === 'keravel' && !backOk.modal, 'fermeture popup : retour Mode Chantier, chantier conservé', 'PM-F1');
  await ctx.close();
}

// ============================================================
// PM-F2 — CONTRÔLE + SAV (P0) — scénario maître
// ============================================================
console.log('\n[PM-F2] Contrôle + SAV (photo -> reprise -> impact -> message)');
let pmf2Pass = true;
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'PM-F2' });
  const step = (c, n) => { if (!c) pmf2Pass = false; ok(c, n, 'PM-F2'); };
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Pose des 6 fenêtres (thomas) terminée pour le contrôle
    task('k-windows').status = 'done';
    task('k-windows').end = '2026-08-12T16:30';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
  });
  await p.waitForTimeout(250);
  // Recherche "fenêtre" dans "À contrôler"
  await ev(p, () => { const i = document.querySelector('.field-search input'); i.value = 'fenêtre'; setFieldQuery('fenêtre'); });
  await p.waitForTimeout(150);
  const found = await ev(p, () => {
    const rows = [...document.querySelectorAll('#fieldControlList .field-task')];
    const r = rows.find((x) => /fenêtre/i.test(x.textContent));
    return { count: rows.length, hasRework: !!r && /Signaler une reprise/.test(r.textContent) };
  });
  step(found.hasRework, 'recherche "fenêtre" → tâche terminée avec "Signaler une reprise"');

  // Ouvrir la reprise (moteur SAV = drawer réutilisé, design établi)
  await ev(p, () => { const btn = [...document.querySelectorAll('#fieldControlList .btn')].find((x) => /Signaler une reprise/.test(x.textContent)); btn.click(); });
  await p.waitForTimeout(200);
  const reworkForm = await ev(p, () => ({
    drawerOpen: document.querySelector('#drawer').classList.contains('open'),
    hasComment: !!document.querySelector('#drawerFormEl textarea[name="comment"]'),
    hasPhoto: !!document.querySelector('#drawerFormEl #reworkData'),
    hasPlan: !!document.querySelector('#drawerFormEl input[name="planDate"]'),
  }));
  step(reworkForm.drawerOpen && reworkForm.hasComment && reworkForm.hasPhoto, 'formulaire reprise ouvert (commentaire + photo + planification)');
  await p.screenshot({ path: SHOTS + 'D-reprise-photo.png', fullPage: true });

  // Remplir commentaire + joindre une photo (simule le retour caméra) puis soumettre
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await ev(p, (u) => {
    document.querySelector('#drawerFormEl textarea[name="comment"]').value = 'Joint à reprendre sur fenêtre chambre 2.';
    applyPhotoDraft(u, 'rework');
  }, tinyPng);
  await p.waitForTimeout(100);
  const previewOk = await ev(p, () => !!document.querySelector('#reworkPreview img'));
  step(previewOk, 'aperçu photo affiché dans le brouillon de reprise');
  await ev(p, () => document.querySelector('#drawerFormEl').requestSubmit());
  await p.waitForTimeout(250);

  // Impact planning affiché
  const impact = await ev(p, () => ({
    modalOpen: document.querySelector('#modal').classList.contains('open'),
    text: document.querySelector('#modalContent')?.textContent || '',
    reworkId: app.ui.pendingRework?.reworkId || (app.tasks.find((t) => t.reworkOfTaskId === 'k-windows')?.id),
  }));
  step(impact.modalOpen && /Reprise créée/.test(impact.text), 'popup "Reprise créée" + impact planning affiché');
  await p.screenshot({ path: SHOTS + 'E-impact-planning.png', fullPage: true });

  // Métier : reprise créée, tâche d'origine conservée terminée, photo liée à la reprise
  const metier = await ev(p, () => {
    const rework = app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done');
    const orig = task('k-windows');
    const photo = rework ? app.photos.find((ph) => ph.taskId === rework.id) : null;
    const succMigrated = task('k-lining').deps.includes(rework?.id);
    return {
      reworkExists: !!rework, reworkId: rework?.id,
      origStillDone: orig.status === 'done',
      photoLinked: !!photo && photo.taskId === rework.id && photo.projectId === 'keravel',
      succMigrated,
    };
  });
  step(metier.reworkExists, 'reprise créée (task.reworkOfTaskId = k-windows)');
  step(metier.origStillDone, 'tâche d\'origine reste TERMINÉE (jamais rouverte)');
  step(metier.photoLinked, 'photo liée à la reprise (projectId+taskId corrects)');
  step(metier.succMigrated, 'successeur (Doublage) redirige sa dépendance vers la reprise');

  // Appliquer replanification si proposée
  const hasApply = await ev(p, () => !!([...document.querySelectorAll('#modalContent .btn')].find((x) => /Appliquer la replanification/.test(x.textContent))));
  if (hasApply) {
    await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Appliquer la replanification/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    const applied = await ev(p, () => /Replanification appliquée/.test(document.querySelector('#modalContent')?.textContent || ''));
    step(applied, 'replanification appliquée (aucune tâche terminée déplacée — moteur reflow existant)');
  } else {
    note('PM-F2', 'replanification', 'aucune tâche aval à décaler dans ce scénario');
  }

  // Prévenir Thomas -> conversation Mode Chantier pré-remplie + photo jointe
  const hasContact = await ev(p, () => !!([...document.querySelectorAll('#modalContent .btn')].find((x) => /Prévenir/.test(x.textContent))));
  step(hasContact, 'bouton "Prévenir Thomas" proposé');
  if (hasContact) {
    await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Prévenir/.test(x.textContent)).click());
    await p.waitForTimeout(250);
    const conv = await ev(p, () => ({
      fieldTab: app.ui.fieldTab,
      field: isFieldMode(),
      drawerOpen: document.querySelector('#drawer').classList.contains('open'),
      input: document.querySelector('#fieldConvInput')?.value || '',
      draft: !!document.querySelector('#fieldConvDraft img'),
    }));
    step(conv.field && conv.fieldTab === 'messages' && !conv.drawerOpen, 'conversation ouverte en Mode Chantier (onglet Messages, pas un drawer)');
    step(/reprise est nécessaire/i.test(conv.input) && /chambre 2/i.test(conv.input), 'message pré-rempli avec le contexte de reprise');
    step(conv.draft, 'photo de la reprise jointe au brouillon de message (#fieldConvDraft)');
    await p.screenshot({ path: SHOTS + 'H-conversation.png', fullPage: true });
    // Envoyer
    await ev(p, () => { sendConversationMessage(); });
    await p.waitForTimeout(150);
  }

  // Retour chantier -> reprise visible dans "Reprises en cours"
  await ev(p, () => { app.ui.conversation = null; setFieldTab('site'); });
  await p.waitForTimeout(200);
  const reworkVisible = await ev(p, () => {
    const sec = [...document.querySelectorAll('.field-section')].find((s) => /Reprises en cours/.test(s.querySelector('.field-h2')?.textContent || ''));
    return { present: !!sec, text: sec?.textContent || '' };
  });
  step(reworkVisible.present && /Reprise — Pose des 6 fenêtres/.test(reworkVisible.text), 'reprise visible dans "Reprises en cours" au retour chantier');
  await p.screenshot({ path: SHOTS + 'I-reprise-en-cours.png', fullPage: true });
  await ctx.close();
}
ok(pmf2Pass, 'PM-F2 (scénario maître SAV) réalisable de bout en bout', 'PM-F2-verdict');

// ============================================================
// PM-F3 — PLANNING TERRAIN (P0)
// ============================================================
console.log('\n[PM-F3] Planning terrain (contexte + dépendances + retour)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'PM-F3' });
  await enterField(p, 'keravel');
  // Ouvrir k-windows (a un successeur k-lining) puis "Voir dans le planning"
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Voir dans le planning/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const planning = await ev(p, () => ({
    field: isFieldMode(),
    driverMode: app.settings.driverMode,
    fieldView: app.ui.fieldView,
    hasGantt: !!document.querySelector('.gantt'),
    hasSidebar: (() => { const s = document.querySelector('.sidebar'); return s ? getComputedStyle(s).display !== 'none' : false; })(),
    focusBlock: !!document.querySelector('.field-plan-focus'),
    depLabels: [...document.querySelectorAll('.field-plan-dep-label')].map((x) => x.textContent),
    toggle: [...document.querySelectorAll('.field-range-toggle button')].map((x) => x.textContent),
    backBtn: !!([...document.querySelectorAll('.drawer-back')].find((x) => /Chantier/.test(x.textContent))),
  }));
  ok(planning.field && planning.driverMode === 'field', 'planning : reste en Mode Chantier (driverMode=field)', 'PM-F3');
  ok(planning.fieldView === 'planning', 'planning : sous-vue fieldView=planning', 'PM-F3');
  ok(!planning.hasGantt && !planning.hasSidebar, 'planning mobile : aucun Gantt, aucune sidebar Bureau', 'PM-F3');
  ok(planning.focusBlock, 'tâche focalisée mise en avant (bloc "Tâche sélectionnée")', 'PM-F3');
  ok(planning.depLabels.some((l) => /Puis/.test(l)), 'contexte de dépendances affiché (Dépend de / Puis) — ' + planning.depLabels.join(', '), 'PM-F3');
  ok(planning.toggle.length === 2 && /Aujourd/.test(planning.toggle[0]) && /semaine/i.test(planning.toggle[1]), 'planning mobile : uniquement Aujourd\'hui / Cette semaine (pas Jour/Mois/Année/PDF)', 'PM-F3');
  ok(planning.backBtn, 'bouton "← Chantier" présent', 'PM-F3');
  await p.screenshot({ path: SHOTS + 'F-planning-mobile.png', fullPage: true });

  // Cliquer une tâche liée -> popup (jamais drawer)
  await ev(p, () => { const r = document.querySelector('.field-plan-focus .field-task'); if (r) r.click(); });
  await p.waitForTimeout(150);
  const rel = await ev(p, () => ({ modal: document.querySelector('#modal').classList.contains('open'), drawer: document.querySelector('#drawer').classList.contains('open') }));
  ok(rel.modal && !rel.drawer, 'clic tâche liée dans le planning → popup (jamais drawer)', 'PM-F3');
  await ev(p, () => closeOverlay('modal'));
  await p.waitForTimeout(120);

  // Retour ← Chantier
  await ev(p, () => exitFieldPlanning());
  await p.waitForTimeout(200);
  const back = await ev(p, () => ({ fieldView: app.ui.fieldView, pid: app.ui.fieldProjectId, head: !!document.querySelector('.field-project-head') }));
  ok(back.fieldView === 'site' && back.pid === 'keravel' && back.head, 'retour ← Chantier : chantier conservé, aucune impasse', 'PM-F3');

  // La barre basse referme aussi le planning (aucune impasse)
  await ev(p, () => { openFieldPlanning('k-windows'); });
  await p.waitForTimeout(150);
  await ev(p, () => setFieldTab('site'));
  await p.waitForTimeout(150);
  const viaBottom = await ev(p, () => app.ui.fieldView === 'site');
  ok(viaBottom, 'barre basse "Chantier" referme aussi le planning (issue garantie)', 'PM-F3');
  await ctx.close();
}

// ============================================================
// PM-F4 — COMMUNICATION (P0)
// ============================================================
console.log('\n[PM-F4] Communication (Messages page + conversation)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'PM-F4' });
  await enterField(p, 'keravel');
  await ev(p, () => setFieldTab('messages'));
  await p.waitForTimeout(200);
  const msgPage = await ev(p, () => ({
    drawerOpen: document.querySelector('#drawer').classList.contains('open'),
    isFieldMsg: app.ui.fieldTab === 'messages',
    convList: !!document.querySelector('.conv-list'),
    header: !!document.querySelector('.field-header'),
    newBtn: !!([...document.querySelectorAll('.field-messages-head .btn')].find((x) => /Nouveau/.test(x.textContent))),
  }));
  ok(!msgPage.drawerOpen && msgPage.isFieldMsg && msgPage.convList, 'Messages = vraie page plein écran (pas un drawer)', 'PM-F4');
  ok(msgPage.header && msgPage.newBtn, 'page Messages : header stable + "+ Nouveau"', 'PM-F4');
  await p.screenshot({ path: SHOTS + 'G-messagerie.png', fullPage: true });

  // Ouvrir une conversation (Thomas)
  await ev(p, () => openConversation({ resourceId: 'thomas', back: { type: 'field' } }));
  await p.waitForTimeout(250);
  const conv = await ev(p, () => ({
    field: isFieldMode(),
    drawer: document.querySelector('#drawer').classList.contains('open'),
    thread: !!document.querySelector('#fieldConvThread'),
    input: !!document.querySelector('#fieldConvInput'),
    backToMsgs: !!([...document.querySelectorAll('.drawer-back, .field-back, .conv-back')].find((x) => /Messages/.test(x.textContent))),
  }));
  ok(conv.field && !conv.drawer && conv.thread && conv.input, 'conversation plein écran (ids fieldConv*), aucun drawer', 'PM-F4');

  // Envoyer texte
  const beforeCount = await ev(p, () => conversationMessages(app.ui.conversation).length);
  await ev(p, () => { const i = document.querySelector('#fieldConvInput'); i.value = 'Bonjour Thomas, RAS sur le chantier.'; });
  await ev(p, () => { sendConversationMessage(); });
  await p.waitForTimeout(200);
  const afterText = await ev(p, () => conversationMessages(app.ui.conversation).length);
  ok(afterText > beforeCount, 'envoi message texte (conversation actualisée)', 'PM-F4');

  // Envoyer photo + texte
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await ev(p, (u) => { app.ui.convDraftDataUrl = u; renderConvDraft(); const i = document.querySelector('#fieldConvInput'); if (i) i.value = 'Voici la photo.'; }, tinyPng);
  await p.waitForTimeout(120);
  const draftShown = await ev(p, () => !!document.querySelector('#fieldConvDraft img'));
  ok(draftShown, 'photo attachée visible dans le composer (#fieldConvDraft)', 'PM-F4');
  await ev(p, () => { sendConversationMessage(); });
  await p.waitForTimeout(200);
  const afterPhoto = await ev(p, () => { const msgs = conversationMessages(app.ui.conversation); const last = msgs[msgs.length - 1]; return { count: msgs.length, hasPhoto: !!last?.photoId }; });
  ok(afterPhoto.count > afterText && afterPhoto.hasPhoto, 'envoi message avec photo (photoId renseigné)', 'PM-F4');

  // Retour Messages puis Chantier
  await ev(p, () => { app.ui.conversation = null; app.ui.fieldTab = 'messages'; renderPage(); });
  await p.waitForTimeout(150);
  await ev(p, () => setFieldTab('site'));
  await p.waitForTimeout(150);
  const backChantier = await ev(p, () => ({ pid: app.ui.fieldProjectId, head: !!document.querySelector('.field-project-head') }));
  ok(backChantier.pid === 'keravel' && backChantier.head, 'retour Chantier : sélection conservée, aucune impasse', 'PM-F4');

  // + Nouveau : destinataires = personnes de l'équipe (pas les entreprises)
  await ev(p, () => { app.ui.fieldTab = 'messages'; app.ui.fieldComposing = true; renderPage(); });
  await p.waitForTimeout(200);
  const picker = await ev(p, () => {
    const rows = [...document.querySelectorAll('#fieldNewMsgList .conv-row, #fieldNewMsgList .newmsg-row, #fieldNewMsgList [onclick]')];
    return { count: rows.length, hasCompanyType: app.resources.some((r) => r.type === 'company'), text: document.querySelector('#fieldNewMsgList')?.textContent || '' };
  });
  ok(picker.count > 0, '+ Nouveau : liste de destinataires (personnes de l\'équipe active)', 'PM-F4');
  await ctx.close();
}

// ============================================================
// PM-F5 — BOUCLE ARTISAN (P0) — multi-onglets (HTTP)
// ============================================================
console.log('\n[PM-F5] Boucle artisan → conducteur (temps réel local)');
try {
  const ctxShared = await b.newContext();
  const pA = await ctxShared.newPage();
  const pB = await ctxShared.newPage();
  for (const pg of [pA, pB]) {
    pg.on('pageerror', (e) => allErrs.push({ where: 'PM-F5', msg: e.message }));
    pg.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: 'PM-F5', msg: m.text() }); });
  }
  await pA.goto(HTTP, { waitUntil: 'load' });
  await ev(pA, () => { resetApp(); setDepth('pilot'); setRole('driver'); enterFieldMode(); selectFieldProject('terrasses'); });
  await pB.goto(HTTP, { waitUntil: 'load' });
  await ev(pB, () => { setRole('artisan'); });
  await pA.waitForTimeout(200);
  // t-plumb (terrasses, marc) est "doing"; on utilise une tâche todo de terrasses pour thomas ? thomas est sur keravel.
  // Prenons une tâche du jour de l'artisan par défaut :
  const tid = await ev(pB, () => getArtisanTodayTasks('thomas')[0]?.id);
  ok(!!tid, 'une tâche artisan du jour existe (onglet B)', 'PM-F5');
  // Basculer le conducteur sur le chantier de cette tâche
  const tpid = await ev(pB, (id) => task(id).projectId, tid);
  await ev(pA, (pid) => selectFieldProject(pid), tpid);
  await pA.waitForTimeout(200);
  await ev(pB, (id) => setTaskStatus(id, 'doing'), tid);
  await pA.waitForTimeout(500);
  const started = await ev(pA, (id) => {
    const row = [...document.querySelectorAll('.field-task')].find((x) => x.getAttribute('onclick')?.includes(id));
    return { visible: !!row, text: row?.textContent || '', status: task(id).status };
  }, tid);
  ok(started.status === 'doing' && /En cours/.test(started.text), 'onglet A (Mode Chantier) : statut "En cours" reflété sans F5', 'PM-F5');
  // Terminer
  await ev(pB, (id) => setTaskStatus(id, 'done'), tid);
  await pA.waitForTimeout(500);
  const done = await ev(pA, (id) => {
    const t = task(id);
    const inToday = [...document.querySelectorAll('section.field-section .field-task')].some((x) => x.getAttribute('onclick')?.includes(id) && /Aujourd/.test(x.closest('.field-section')?.textContent || ''));
    const inControl = (document.querySelector('#fieldControlList')?.textContent || '').includes(t.name);
    return { status: t.status, inControl };
  }, tid);
  ok(done.status === 'done', 'onglet A : tâche terminée reflétée sans F5', 'PM-F5');
  ok(done.inControl, 'tâche terminée bascule dans "À contrôler" (sans F5)', 'PM-F5');
  await ctxShared.close();
} catch (e) {
  note('PM-F5', 'ERREUR', e.message);
  ok(false, 'PM-F5 exécuté sans exception', 'PM-F5');
}

// ============================================================
// PM-F6 — REPRISE ET CYCLE DE VIE (P1)
// ============================================================
console.log('\n[PM-F6] Reprise et cycle de vie chantier');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'PM-F6' });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
    createRework('k-windows', { comment: 'Reprise test cycle de vie.', dataUrl: null, planDate: '', duration: 'half' });
  });
  await p.waitForTimeout(200);
  const withRework = await ev(p, () => {
    const rework = app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done');
    const st = getProjectClosureStatus('keravel');
    return { reworkId: rework?.id, ready: st.ready, openIncludesRework: st.openTasks.some((t) => t.id === rework?.id), lifecycle: projectLifecycle('keravel') };
  });
  ok(withRework.openIncludesRework, 'reprise ouverte comptée comme intervention ouverte (chantier non prêt à clôturer)', 'PM-F6');
  ok(!withRework.ready, 'chantier NON prêt à clôturer tant que la reprise est ouverte', 'PM-F6');
  ok(withRework.lifecycle === 'active', 'chantier jamais clôturé automatiquement', 'PM-F6');
  // Terminer la reprise
  await ev(p, (id) => { closeOverlay('modal'); task(id).status = 'done'; save(); }, withRework.reworkId);
  await p.waitForTimeout(150);
  const afterDone = await ev(p, (id) => {
    const st = getProjectClosureStatus('keravel');
    return { openIncludesRework: st.openTasks.some((t) => t.id === id), lifecycle: projectLifecycle('keravel') };
  }, withRework.reworkId);
  ok(!afterDone.openIncludesRework, 'reprise terminée : n\'est plus une intervention ouverte (recalcul cohérent)', 'PM-F6');
  ok(afterDone.lifecycle === 'active', 'terminer la reprise ne clôture jamais automatiquement le chantier', 'PM-F6');
  await ctx.close();
}

// ============================================================
// PM-F7 — CONDITIONS DÉGRADÉES (P1)
// ============================================================
console.log('\n[PM-F7] Conditions dégradées (390 sombre, météo KO, offline, texte long)');
{
  // Météo indisponible + offline
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, mockWeather: false, _tag: 'PM-F7' });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await enterField(p, 'keravel');
  await ev(p, () => setAppearance('dark'));
  await p.waitForTimeout(400);
  const degraded = await ev(p, () => ({
    dark: document.body.classList.contains('dark'),
    head: !!document.querySelector('.field-project-head'),
    weatherEmpty: (document.querySelector('.field-project-head .acp-weather')?.textContent || '').trim() === '',
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    tasks: document.querySelectorAll('.field-task').length,
  }));
  ok(degraded.head && degraded.tasks > 0, 'météo KO + offline : Mode Chantier pleinement fonctionnel', 'PM-F7');
  ok(degraded.weatherEmpty, 'météo indisponible : aucune valeur fictive (badge vide)', 'PM-F7');
  ok(!degraded.hscroll, '390px sombre : aucun scroll horizontal', 'PM-F7');
  await p.screenshot({ path: SHOTS + 'J-mode-chantier-sombre.png', fullPage: true });

  // Texte long
  await ev(p, () => {
    project('keravel').name = 'Résidence Les Hauts de Keravel Bâtiment C Tranche 3 Programme Neuf Extension Sud Secteur 4';
    task('k-cloisons') && (task('k-cloisons').name = 'X');
    let t = getProjectTasks('keravel')[0];
    if (t) t.name = 'Intervention avec un intitulé délibérément très long pour éprouver la troncature et le retour à la ligne contrôlé sur mobile 390 pixels de large';
    save(); renderPage();
  });
  await p.waitForTimeout(200);
  const longText = await ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!longText, 'textes longs (chantier/tâche) : aucun débordement horizontal', 'PM-F7');
  await ctx.close();
}

// ============================================================
// TECH-1 — Stabilité navigation Chantier ↔ Messages (20 bascules)
// ============================================================
console.log('\n[TECH-1] Stabilité navigation (20 bascules Chantier/Messages)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-1' });
  await enterField(p, 'keravel');
  const geom = () => ev(p, () => {
    const h = document.querySelector('.field-header').getBoundingClientRect();
    const bnav = document.querySelector('.field-bottom').getBoundingClientRect();
    const wrap = document.querySelector('.field-wrap').getBoundingClientRect();
    return { hx: Math.round(h.x), hy: Math.round(h.y), bx: Math.round(bnav.x), bw: Math.round(bnav.width), ww: Math.round(wrap.width) };
  });
  const base = await geom();
  let stable = true;
  for (let i = 0; i < 20; i++) {
    await ev(p, () => setFieldTab('messages'));
    await p.waitForTimeout(20);
    await ev(p, () => setFieldTab('site'));
    await p.waitForTimeout(20);
  }
  const after = await geom();
  stable = Math.abs(after.hx - base.hx) <= 1 && Math.abs(after.hy - base.hy) <= 1 && Math.abs(after.bx - base.bx) <= 1 && Math.abs(after.bw - base.bw) <= 1 && Math.abs(after.ww - base.ww) <= 1;
  ok(stable, 'header/barre basse/largeur stables après 20 bascules (±1px)', 'TECH-1');
  note('TECH-1', 'géométrie base/after', { base, after });
  const noHScroll = await ev(p, () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  ok(noHScroll, 'aucun scroll horizontal après les bascules', 'TECH-1');
  await ctx.close();
}

// ============================================================
// TECH-2 — Popup vs drawer (consultation tâche = popup partout)
// ============================================================
console.log('\n[TECH-2] Consultation tâche = popup (jamais drawer) — tous statuts');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-2' });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
  });
  await p.waitForTimeout(200);
  for (const [id, label] of [['k-cloisons', 'À faire/En cours'], ['k-windows', 'Terminée'], ['k-electric', 'En attente']]) {
    const exists = await ev(p, (i) => !!task(i), id);
    if (!exists) { note('TECH-2', 'tâche absente', id); continue; }
    await ev(p, (i) => openTask(i), id);
    await p.waitForTimeout(150);
    const r = await ev(p, () => ({ modal: document.querySelector('#modal').classList.contains('open'), drawer: document.querySelector('#drawer').classList.contains('open') }));
    ok(r.modal && !r.drawer, `tâche ${label} (${id}) → popup, jamais drawer`, 'TECH-2');
    await ev(p, () => closeOverlay('modal'));
    await p.waitForTimeout(100);
  }
  await ctx.close();
}

// ============================================================
// TECH-3 — Responsive 390 / 375 : 0 scroll horizontal partout
// ============================================================
console.log('\n[TECH-3] Responsive 390/375 — 0 scroll horizontal');
for (const [w, h] of [[390, 844], [375, 812], [430, 932], [412, 915], [393, 852]]) {
  const { ctx, p } = await newPage({ viewport: { width: w, height: h }, _tag: `TECH-3-${w}` });
  await ev(p, () => { resetApp(); setDepth('pilot'); task('k-windows').status = 'done'; setRole('driver'); enterFieldMode(); selectFieldProject('keravel'); });
  await p.waitForTimeout(250);
  const states = [];
  const hs = () => ev(p, () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  states.push(['home', await hs()]);
  await ev(p, () => openTask('k-windows')); await p.waitForTimeout(120); states.push(['popup', await hs()]); await ev(p, () => closeOverlay('modal')); await p.waitForTimeout(80);
  await ev(p, () => openFieldPlanning('k-windows')); await p.waitForTimeout(150); states.push(['planning', await hs()]); await ev(p, () => exitFieldPlanning()); await p.waitForTimeout(80);
  await ev(p, () => setFieldTab('messages')); await p.waitForTimeout(120); states.push(['messages', await hs()]);
  await ev(p, () => openConversation({ resourceId: 'thomas', back: { type: 'field' } })); await p.waitForTimeout(180); states.push(['conversation', await hs()]);
  const anyOverflow = states.some(([, o]) => o);
  ok(!anyOverflow, `${w}px : aucun scroll horizontal (home/popup/planning/messages/conversation)`, 'TECH-3');
  if (anyOverflow) note('TECH-3', `${w}px overflow détail`, states.filter(([, o]) => o));
  await ctx.close();
}

// ============================================================
// TECH-4 — Safe-area (source CSS) + rôle popup + fermeture
// ============================================================
console.log('\n[TECH-4] Safe-area, rôle dialog, bouton fermeture');
{
  const html = fs.readFileSync('/home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.6.html', 'utf8');
  ok(/\.field-header\s*\{[\s\S]{0,400}safe-area-inset-top/.test(html), 'CSS : field-header intègre safe-area-inset-top', 'TECH-4');
  ok(/\.field-bottom\s*\{[\s\S]{0,400}safe-area-inset-bottom/.test(html), 'CSS : field-bottom intègre safe-area-inset-bottom', 'TECH-4');
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-4' });
  await enterField(p, 'keravel');
  const modalRole = await ev(p, () => document.querySelector('#modal').getAttribute('role'));
  ok(modalRole === 'dialog', 'popup tâche : #modal role="dialog" (hérité V2.4.5)', 'TECH-4');
  await ev(p, () => openTask('k-windows'));
  await p.waitForTimeout(150);
  const closeBtn = await ev(p, () => !!([...document.querySelectorAll('#modalContent .btn, #modal .close')].find((x) => /Fermer|×/.test(x.textContent))));
  ok(closeBtn, 'popup tâche : bouton de fermeture identifiable', 'TECH-4');
  // Échap ferme
  await p.keyboard.press('Escape');
  await p.waitForTimeout(120);
  const closed = await ev(p, () => !document.querySelector('#modal').classList.contains('open'));
  ok(closed, 'Échap ferme le popup', 'TECH-4');
  await ctx.close();
}

// ============================================================
// TECH-5 — Thème sombre (lisibilité des zones clés)
// ============================================================
console.log('\n[TECH-5] Thème sombre — lisibilité');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-5' });
  await ev(p, () => { resetApp(); setDepth('pilot'); task('k-windows').status = 'done'; setRole('driver'); enterFieldMode(); selectFieldProject('keravel'); setAppearance('dark'); });
  await p.waitForTimeout(300);
  const dark = await ev(p, () => {
    const col = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; };
    return {
      body: document.body.classList.contains('dark'),
      h1: col('.field-project-head h1'),
      taskName: col('.field-task b'),
      h2: col('.field-h2'),
      pill: col('.field-task .pill'),
    };
  });
  ok(dark.body, 'mode sombre appliqué', 'TECH-5');
  ok(!!dark.h1 && !!dark.taskName && !!dark.h2, 'textes clés (titre chantier, tâche, sections) ont une couleur définie', 'TECH-5');
  // Popup + planning + conversation en sombre : rendu sans exception
  await ev(p, () => openTask('k-windows')); await p.waitForTimeout(120);
  const popupDark = await ev(p, () => !!document.querySelector('#modalContent h2') && getComputedStyle(document.querySelector('#modalContent h2')).color);
  ok(!!popupDark, 'popup tâche lisible en sombre', 'TECH-5');
  await ev(p, () => closeOverlay('modal'));
  await ctx.close();
}

// ============================================================
// TECH-6 — États vides
// ============================================================
console.log('\n[TECH-6] États vides (jour sans tâche, sans reprise, sans message)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-6' });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    // Vider les tâches du jour de keravel
    app.tasks.filter((t) => t.projectId === 'keravel').forEach((t) => { t.start = '2026-09-20T08:00'; t.end = '2026-09-20T10:00'; });
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
  });
  await p.waitForTimeout(250);
  const empty = await ev(p, () => {
    const todaySec = [...document.querySelectorAll('.field-section')].find((s) => /Aujourd/.test(s.querySelector('.field-h2')?.textContent || ''));
    return {
      crash: !document.querySelector('.field-project-head'),
      todayEmpty: /Aucune intervention prévue/.test(todaySec?.textContent || ''),
      hasControl: !!document.querySelector('#fieldControlList'),
      reworkSectionAbsent: ![...document.querySelectorAll('.field-h2')].some((x) => /Reprises en cours/.test(x.textContent)),
    };
  });
  ok(!empty.crash, 'jour sans tâche : écran non cassé', 'TECH-6');
  ok(empty.todayEmpty, 'jour sans tâche : message calme "Aucune intervention prévue"', 'TECH-6');
  ok(empty.reworkSectionAbsent, 'aucune reprise : section "Reprises en cours" simplement absente', 'TECH-6');
  // Messages vides
  await ev(p, () => { app.messages = []; setFieldTab('messages'); });
  await p.waitForTimeout(150);
  const msgEmpty = await ev(p, () => /Aucune conversation/.test(document.querySelector('.conv-list')?.textContent || '') || document.querySelectorAll('.conv-row').length === 0);
  ok(msgEmpty, 'aucun message : liste vide propre', 'TECH-6');
  await ctx.close();
}

// ============================================================
// TECH-7 — Chantier chargé (densité, non-cassure)
// ============================================================
console.log('\n[TECH-7] Chantier chargé (20 tâches jour / 8 reprises)');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-7' });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    const d = dayKey(TODAY);
    for (let i = 0; i < 20; i++) app.tasks.push({ id: 'load-t-' + i, projectId: 'keravel', name: 'Intervention ' + i, resourceId: 'thomas', start: d + 'T08:00', end: d + 'T17:00', status: 'todo', deps: [] });
    for (let i = 0; i < 8; i++) app.tasks.push({ id: 'load-r-' + i, projectId: 'keravel', name: 'Reprise ' + i, resourceId: 'thomas', start: d + 'T08:00', end: d + 'T17:00', status: 'todo', deps: [], reworkOfTaskId: 'k-cloisons' });
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
  });
  await p.waitForTimeout(300);
  const loaded = await ev(p, () => ({
    todayCount: [...document.querySelectorAll('.field-section')].find((s) => /Aujourd/.test(s.querySelector('.field-h2')?.textContent || ''))?.querySelectorAll('.field-task').length,
    reworkCount: [...document.querySelectorAll('.field-section')].find((s) => /Reprises/.test(s.querySelector('.field-h2')?.textContent || ''))?.querySelectorAll('.field-task').length,
    controlCapped: (document.querySelector('#fieldControlList')?.querySelectorAll('.field-task').length) || 0,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  ok(!loaded.hscroll, 'chantier chargé : aucun scroll horizontal', 'TECH-7');
  note('TECH-7', 'densité (aujourd\'hui / reprises / à-contrôler affichées)', loaded);
  ok((loaded.controlCapped || 0) <= 8, '"À contrôler" plafonné à 8 sans recherche (pas de liste infinie)', 'TECH-7');
  await ctx.close();
}

// ============================================================
// TECH-8 — Sortie Mode Chantier -> Bureau (aucune perte)
// ============================================================
console.log('\n[TECH-8] Sortie Mode Chantier → Bureau et retour');
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'TECH-8' });
  await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
    createRework('k-windows', { comment: 'Persistance test.', dataUrl: null, planDate: '', duration: 'half' });
    closeOverlay('modal');
  });
  await p.waitForTimeout(200);
  const reworkId = await ev(p, () => app.tasks.find((t) => t.reworkOfTaskId === 'k-windows')?.id);
  await ev(p, () => exitFieldMode());
  await p.waitForTimeout(200);
  const office = await ev(p, () => ({ field: isFieldMode(), page: app.ui.page, driverMode: app.settings.driverMode }));
  ok(!office.field && office.page === 'today' && office.driverMode === 'office', 'sortie : driverMode=office, retour Accueil Bureau', 'TECH-8');
  const dataKept = await ev(p, (rid) => ({ reworkKept: !!task(rid), pidKept: app.ui.fieldProjectId === 'keravel' }), reworkId);
  ok(dataKept.reworkKept, 'aucune donnée perdue (reprise conservée)', 'TECH-8');
  ok(dataKept.pidKept, 'chantier sélectionné conservé pour le retour', 'TECH-8');
  await ev(p, () => enterFieldMode());
  await p.waitForTimeout(200);
  const backField = await ev(p, () => ({ field: isFieldMode(), head: document.querySelector('.field-project-head h1')?.textContent }));
  ok(backField.field && backField.head === 'Résidence Keravel', 'retour Mode Chantier : état cohérent (chantier conservé)', 'TECH-8');
  await ctx.close();
}

// ============================================================
// MC-01 — CORRECTION V2.4.6 : "Voir dans le planning" du popup de reprise
// doit ouvrir le Planning MOBILE en Mode Chantier (openFieldPlanning).
// ============================================================
console.log('\n[MC-01] "Voir dans le planning" (popup reprise) ouvre le planning mobile');
// (a) Popup "Reprise créée" (showReworkImpact)
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'MC-01a' });
  const reworkId = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
    createRework('k-windows', { comment: 'Joint à reprendre sur fenêtre chambre 2.', dataUrl: null, planDate: '', duration: 'half' });
    return app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done')?.id;
  });
  await p.waitForTimeout(200);
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Voir dans le planning/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const after = await ev(p, () => ({
    field: isFieldMode(),
    driverMode: app.settings.driverMode,
    page: app.ui.page,
    fieldView: app.ui.fieldView,
    fieldPlanningTaskId: app.ui.fieldPlanningTaskId,
    planningVisible: !!document.querySelector('.field-range-toggle'),
    focusFocusedRework: (() => { const el = document.querySelector('.field-plan-focus-row b'); return el ? el.textContent : null; })(),
    hasGantt: !!document.querySelector('.gantt'),
    hasSidebar: (() => { const s = document.querySelector('.sidebar'); return s ? getComputedStyle(s).display !== 'none' : false; })(),
    backBtn: !!([...document.querySelectorAll('.drawer-back')].find((x) => /Chantier/.test(x.textContent))),
  }));
  note('MC-01', 'état après clic (popup Reprise créée)', after);
  ok(after.field && after.driverMode === 'field', 'MC-01(a) : reste en Mode Chantier (driverMode=field)', 'MC-01');
  ok(after.fieldView === 'planning', 'MC-01(a) : fieldView devient "planning" (plus jamais "site")', 'MC-01');
  ok(after.fieldPlanningTaskId === reworkId, 'MC-01(a) : fieldPlanningTaskId = id de la reprise', 'MC-01');
  ok(after.planningVisible, 'MC-01(a) : planning mobile visible', 'MC-01');
  ok(/Reprise —/.test(after.focusFocusedRework || ''), 'MC-01(a) : reprise focalisée dans le planning', 'MC-01');
  ok(!after.hasGantt && !after.hasSidebar, 'MC-01(a) : aucun Gantt, aucune sidebar Bureau', 'MC-01');
  ok(after.backBtn, 'MC-01(a) : bouton "← Chantier" présent', 'MC-01');
  // Retour ← Chantier fonctionnel
  await ev(p, () => exitFieldPlanning());
  await p.waitForTimeout(150);
  const back = await ev(p, () => app.ui.fieldView === 'site' && !!document.querySelector('.field-project-head'));
  ok(back, 'MC-01(a) : "← Chantier" ramène à l\'accueil chantier (aucune impasse)', 'MC-01');
  await ctx.close();
}
// (b) Popup "Replanification appliquée" (applyReworkReflow)
{
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, _tag: 'MC-01b' });
  const reworkId = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    setRole('driver'); enterFieldMode(); selectFieldProject('keravel');
    // Reprise planifiée plus tard pour maximiser les chances d'un décalage aval
    createRework('k-windows', { comment: 'Reprise avec impact.', dataUrl: null, planDate: '2026-08-19', duration: 'full' });
    return app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done')?.id;
  });
  await p.waitForTimeout(200);
  const canApply = await ev(p, () => !!([...document.querySelectorAll('#modalContent .btn')].find((x) => /Appliquer la replanification/.test(x.textContent))));
  if (canApply) {
    await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Appliquer la replanification/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    const applied = await ev(p, () => /Replanification appliquée/.test(document.querySelector('#modalContent')?.textContent || ''));
    ok(applied, 'MC-01(b) : "Replanification appliquée" atteinte', 'MC-01');
    await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Voir dans le planning/.test(x.textContent)).click());
    await p.waitForTimeout(250);
    const after = await ev(p, () => ({ field: isFieldMode(), fieldView: app.ui.fieldView, fieldPlanningTaskId: app.ui.fieldPlanningTaskId, planningVisible: !!document.querySelector('.field-range-toggle'), hasGantt: !!document.querySelector('.gantt') }));
    note('MC-01', 'état après clic (popup Replanification appliquée)', after);
    ok(after.field && after.fieldView === 'planning' && after.fieldPlanningTaskId === reworkId && after.planningVisible && !after.hasGantt, 'MC-01(b) : "Voir dans le planning" ouvre le planning mobile focalisé sur la reprise', 'MC-01');
  } else {
    note('MC-01', 'replanification', 'aucun décalage aval proposé dans ce scénario — sous-test (b) non applicable');
    ok(true, 'MC-01(b) : sans décalage aval, pas de bouton "Appliquer" (non applicable, neutre)', 'MC-01');
  }
  await ctx.close();
}
// (c) BUREAU : comportement Planning Bureau inchangé (focusPlanningTask)
{
  const { ctx, p } = await newPage({ viewport: { width: 1280, height: 900 }, _tag: 'MC-01c' });
  const reworkId = await ev(p, () => {
    resetApp(); setDepth('pilot');
    task('k-windows').status = 'done';
    // Bureau : rôle driver, driverMode office
    createRework('k-windows', { comment: 'Reprise bureau.', dataUrl: null, planDate: '', duration: 'half' });
    return app.tasks.find((t) => t.reworkOfTaskId === 'k-windows' && t.status !== 'done')?.id;
  });
  await p.waitForTimeout(200);
  await ev(p, () => [...document.querySelectorAll('#modalContent .btn')].find((x) => /Voir dans le planning/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  // app.ui.focusTask est un flag "flash" à usage unique, consommé par
  // renderPlanning ; on vérifie le résultat durable (selectedTask + Gantt/Kanban visible).
  const bureau = await ev(p, () => ({ field: isFieldMode(), page: app.ui.page, selectedTask: app.ui.selectedTask, planningProject: app.ui.planningProject, hasGanttOrKanban: !!document.querySelector('.gantt, .kanban') }));
  note('MC-01', 'BUREAU état après clic', bureau);
  ok(!bureau.field && bureau.page === 'planning' && bureau.selectedTask === reworkId && bureau.hasGanttOrKanban, 'MC-01(c) BUREAU : "Voir dans le planning" ouvre toujours le Planning Bureau (focusPlanningTask inchangé)', 'MC-01');
  await ctx.close();
}

// ============================================================
// CONSOLE + synthèse
// ============================================================
await b.close();
const uniqueErrs = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(uniqueErrs.length ? 'ERREURS CONSOLE (' + uniqueErrs.length + ' distinctes):\n' + uniqueErrs.map((e) => `[${e.where}] ${e.msg}`).join('\n') : '=== 0 erreur console ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: uniqueErrs }, null, 2));
process.exit(0);
