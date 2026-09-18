// ============================================================
// KANVIX — Recette correctifs UX ciblés (V2.4.15.4)
//   5 correctifs indépendants remontés par retour utilisateur :
//   1) Planning : l'échelle (Jour/Semaine/Mois/Année) doit démarrer sur la
//      période courante, sans montrer le passé à l'ouverture.
//   2) Kanban : le drag&drop vers une colonne courte (peu de tâches) échouait
//      hors de sa zone visible ; + pop-up du nouveau statut au dépôt.
//   3) Chantiers : accès direct à « Modèle d'entreprise » dans +Nouveau chantier.
//   4) Mode Chantier : le bouton « Chantier » de la barre du bas laissait une
//      conversation Messages ouverte « collée », donnant l'impression que la
//      barre ne répondait plus.
//   5) Fiche tâche : le bouton « Signaler une reprise » restait visible même
//      quand une reprise avait déjà été signalée pour la tâche.
//   Usage : node recette-correctifs-v2.4.15.4.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const NOW = '?now=2026-09-17T09:15:00';
const BASE = '/home/user/Planzy-saas/public/poc/';
const PREV = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.3.html' + NOW;
const FILE = 'file://' + BASE + 'kanvix-next-gen-v2.4.15.4.html' + NOW;
const SHOTS = '/home/user/Planzy-saas/recette-v2.4.15.4/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 600)}`);
const allErrs = [];
async function newPage(w = 1440, h = 1000, tag = 'x', url = FILE) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.route('https://nominatim.openstreetmap.org/**', (r) => r.abort('failed'));
  await p.goto(url, { waitUntil: 'load' });
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
const reset = (p, extra = '') => ev(p, (s) => (0, eval)('resetApp();setDepth("pilot");dismissKanvixContinuityNotice();' + s), extra);

// ============================================================
// 1) PLANNING — anchoring sur la période courante
// ============================================================
console.log('\n[PLAN-1514] Planning — la période/l’heure courante démarre la vue (aucun passé affiché à l’ouverture)');
{
  const { ctx, p } = await newPage(1440, 900, 'PLAN-day', FILE);
  await reset(p, "go('planning');");
  const dayInfo = await ev(p, () => {
    app.settings.period = 'day'; app.ui.periodAnchor = TODAY; app.ui.planningNeedsCenter = true; save(); renderPage();
    return new Promise((r) => setTimeout(() => {
      const wrap = document.querySelector('.gantt-wrap'), s = scale();
      const taskCol = window.innerWidth < 720 ? 155 : window.innerWidth < 1200 ? 180 : 210;
      const cell = (wrap.scrollWidth - taskCol) / s.labels.length;
      r({ scrollLeft: wrap.scrollLeft, todayIndex: s.todayIndex, expected: Math.round(cell * s.todayIndex), label: s.labels[s.todayIndex] });
    }, 250));
  });
  note('PLAN-1514-day', dayInfo);
  // now=09:15 -> créneau courant = 9h (index 2 dans une journée 8h-18h) : le
  // planning ne doit PAS ouvrir sur 8h/8h30 (le passé), mais sur ce créneau.
  ok(dayInfo.todayIndex === 2 && dayInfo.label === '9h', 'PLAN-1514-day : le créneau courant est bien 9h', 'PLAN-1514');
  ok(dayInfo.scrollLeft > 0, 'PLAN-1514-day : la vue Jour ne s’ouvre plus figée sur le début de journée (8h)', 'PLAN-1514');
  ok(Math.abs(dayInfo.scrollLeft - dayInfo.expected) <= 2, 'PLAN-1514-day : le créneau courant est bien la 1ère colonne visible (aucune heure passée devant)', 'PLAN-1514');
  await ctx.close();
}
{
  // Semaine / Mois : à 1000px de large, le planning déborde horizontalement
  // (7/5 colonnes ne tiennent pas) — condition nécessaire pour vérifier que
  // la période courante démarre bien la vue, et non un simple recentrage.
  const { ctx, p } = await newPage(1000, 900, 'PLAN-week-month', FILE);
  await reset(p, "go('planning');");
  for (const period of ['week', 'month']) {
    const info = await ev(p, (per) => {
      app.settings.period = per; app.ui.periodAnchor = TODAY; app.ui.planningNeedsCenter = true; save(); renderPage();
      return new Promise((r) => setTimeout(() => {
        const wrap = document.querySelector('.gantt-wrap'), s = scale();
        const taskCol = window.innerWidth < 720 ? 155 : window.innerWidth < 1200 ? 180 : 210;
        const cell = (wrap.scrollWidth - taskCol) / s.labels.length;
        const maxScroll = wrap.scrollWidth - wrap.clientWidth;
        r({ scrollLeft: wrap.scrollLeft, todayIndex: s.todayIndex, maxScroll, expected: Math.min(maxScroll, Math.round(cell * s.todayIndex)) });
      }, 250));
    }, period);
    note('PLAN-1514-' + period, info);
    ok(info.maxScroll > 20, `PLAN-1514-${period} : la fenêtre de test déborde bien horizontalement (condition du scénario)`, 'PLAN-1514');
    ok(info.scrollLeft > 0, `PLAN-1514-${period} : la vue ne reste plus au calage historique (Lundi/S1) — elle avance vers la période courante`, 'PLAN-1514');
    ok(Math.abs(info.scrollLeft - info.expected) <= 2, `PLAN-1514-${period} : la période courante démarre la vue (1ère colonne visible), sans décalage vers le passé`, 'PLAN-1514');
  }
  await ctx.close();
}
{
  // Changer d'onglet Jour/Semaine/Mois/Année doit re-déclencher le recentrage
  // (auparavant setPeriod ne posait pas planningNeedsCenter=true).
  const { ctx, p } = await newPage(1000, 900, 'PLAN-switch', FILE);
  // Onglet Jour au départ (scrollé sur 9h) : le changement d'échelle réel via
  // l'UI (bouton segmenté « Mois ») doit re-déclencher le recentrage — avant
  // ce correctif, setPeriod() ne posait pas planningNeedsCenter=true et la
  // vue Mois s'ouvrait au calage historique (scrollLeft=0).
  await reset(p, "go('planning'); app.settings.period='day'; app.ui.periodAnchor=TODAY; save(); renderPage();");
  await p.waitForTimeout(250);
  const monthBtn = p.locator('.plan-toolbar .segment button', { hasText: 'Mois' });
  await monthBtn.waitFor({ state: 'visible' });
  await monthBtn.click();
  await p.waitForTimeout(250);
  const after = await ev(p, () => {
    const wrap = document.querySelector('.gantt-wrap');
    return wrap ? { scrollLeft: wrap.scrollLeft, period: app.settings.period } : { scrollLeft: null, period: app.settings.period };
  });
  note('PLAN-1514-switch', after);
  ok(after.period === 'month', 'PLAN-1514-switch : le clic sur l’onglet « Mois » a bien changé l’échelle', 'PLAN-1514');
  ok(after.scrollLeft > 0, 'PLAN-1514-switch : cliquer sur un onglet d’échelle (Mois) réaligne bien la vue sur la période courante', 'PLAN-1514');
  await ctx.close();
}

// ============================================================
// 2) KANBAN — drag&drop vers colonne courte + pop-up de statut
// ============================================================
console.log('\n[KAN-1514] Kanban — zone de dépôt élargie (colonnes de même hauteur) + confirmation visuelle du nouveau statut');
{
  const { ctx, p } = await newPage(1200, 1800, 'KAN-geom', FILE);
  await reset(p, "");
  const setup = await ev(p, () => {
    const pid = app.projects.find(isProjectActive).id;
    // Colonne « À faire » volontairement longue, « Terminé » volontairement
    // courte (0 tâche) — reproduit exactement le scénario signalé : glisser
    // une tâche basse dans la colonne de gauche vers une colonne à droite
    // trop courte pour couvrir cette position à l'écran.
    app.tasks.filter((t) => t.projectId === pid).forEach((t) => { t.status = 'todo'; });
    for (let i = 0; i < 8; i++) {
      app.tasks.push({ id: 'kan-fill-' + i, projectId: pid, name: 'Tâche remplissage ' + i, status: 'todo',
        start: TODAY, end: add(TODAY, DAY), resourceId: app.resources.find((r) => r.type === 'person').id, deps: [] });
    }
    app.ui.planningProject = pid; app.settings.period = 'week';
    save();
    go('planning'); setPlanningView('kanban');
    return { pid };
  });
  await p.waitForTimeout(250);
  const geom = await ev(p, () => {
    const cols = [...document.querySelectorAll('.kanban-col')];
    const heights = cols.map((c) => Math.round(c.getBoundingClientRect().height));
    const todoCards = cols.find((c) => c.dataset.status === 'todo').querySelectorAll('.kanban-card');
    const lastCard = todoCards[todoCards.length - 1];
    const lastRect = lastCard.getBoundingClientRect();
    const doneCol = cols.find((c) => c.dataset.status === 'done');
    const doneRect = doneCol.getBoundingClientRect();
    // Point testé : hauteur verticale de la DERNIÈRE carte de « À faire »,
    // dans la colonne X de « Terminé ». Avant le correctif (align-items:
    // start), ce point tombait hors de la colonne (align-items:stretch la
    // corrige).
    const px = doneRect.left + doneRect.width / 2, py = lastRect.top + lastRect.height / 2;
    const elAtPoint = document.elementFromPoint(px, py);
    const pointInsideDoneCol = doneCol.contains(elAtPoint);
    return { heights, doneColHeight: Math.round(doneRect.height), pointInsideDoneCol, lastCardY: Math.round(lastRect.top) };
  });
  note('KAN-1514-geom', geom);
  ok(new Set(geom.heights).size === 1, 'KAN-1514-geom : les 3 colonnes ont désormais la même hauteur (align-items:stretch)', 'KAN-1514');
  ok(geom.pointInsideDoneCol, 'KAN-1514-geom : la zone de dépôt de la colonne courte (« Terminé ») couvre bien la hauteur d’une carte basse de « À faire » — le dépôt y est possible', 'KAN-1514');
  await ctx.close();
}
{
  const { ctx, p } = await newPage(1200, 900, 'KAN-drop', FILE);
  await reset(p, "");
  await ev(p, () => { go('planning'); setPlanningView('kanban'); });
  await p.waitForTimeout(200);
  const drag = await ev(p, () => {
    const card = document.querySelector('.kanban-card[draggable="true"]');
    const name = card.querySelector('b').textContent.trim();
    const id = [...document.querySelectorAll('.kanban-col')].reduce((found, col) => found, null);
    const col = document.querySelector('.kanban-col[data-status="doing"]');
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    /* V2.8.5.2 — RE-BASELINE : le dépôt demande confirmation quand il vaut
       démarrage réel (V2.8.5.1 §7). Le toast testé ci-dessous reste le MÊME. */
    if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    return { name };
  });
  await p.waitForTimeout(150);
  const toastText = await ev(p, () => document.querySelector('#toast')?.textContent || '');
  note('KAN-1514-drop', { drag, toastText });
  ok(/^Tâche déplacée · /.test(toastText), 'KAN-1514-drop : une pop-up nomme explicitement le nouvel état au dépôt', 'KAN-1514');
  ok(toastText.includes('En cours'), 'KAN-1514-drop : le libellé affiché correspond bien à la colonne cible (« En cours »)', 'KAN-1514');
  ok(toastText.includes('Annuler'), 'KAN-1514-drop : l’action reste annulable (undo réel conservé, pas un simple message)', 'KAN-1514');
  const otherToast = await ev(p, () => { setTaskStatus(app.tasks.find((t) => t.status === 'todo').id, 'doing', 'task');
    /* V2.8.5.2 — RE-BASELINE : confirmation de démarrage réel (V2.8.5.1 §7). */
    if (document.querySelector('#modal.open [data-calendar-confirm]')) runCalendarConfirm();
    return document.querySelector('#toast')?.textContent || ''; });
  ok(otherToast === 'Tâche mise à jour · Annuler', 'KAN-1514-drop : les autres origines (édition, terrain…) gardent le message générique inchangé', 'KAN-1514');
  await ctx.close();
}

// ============================================================
// 3) CHANTIERS — « Modèle d'entreprise » dans +Nouveau chantier
// ============================================================
console.log('\n[SITE-1514] Chantiers — accès direct à « Modèle d’entreprise » depuis +Nouveau chantier');
{
  const { ctx, p } = await newPage(1200, 900, 'SITE-tpl', FILE);
  await reset(p, "go('sites'); openProjectCreate();");
  await p.waitForTimeout(150);
  const choices = await ev(p, () => [...document.querySelectorAll('.wiz-choice b')].map((b) => b.textContent.trim()));
  note('SITE-1514-choices', choices);
  /* V2.11.0 — RE-POINTAGE. Le wizard gagne un cinquième mode, « Modèle de
     chantier » (§26). Ce que SITE-1514 protège — l'accès DIRECT à « Modèle
     d'entreprise » depuis le choix initial — est vérifié par l'assertion
     suivante, inchangée. On épingle donc les cinq libellés dans leur ordre
     exact : c'est plus strict qu'un simple compte. */
  ok(choices.join('|') === 'Partir de zéro|Utiliser un modèle|Modèle d’entreprise|Modèle de chantier|Reprendre un chantier en cours',
    'SITE-1514 : le choix initial propose cinq options dans cet ordre exact — « Modèle de chantier » (V2.11.0) s’ajoute sans déplacer ni renommer les quatre modes existants', 'SITE-1514');
  ok(choices.includes('Modèle d’entreprise'), 'SITE-1514 : « Modèle d’entreprise » apparaît comme point d’entrée explicite', 'SITE-1514');
  await p.click('.wiz-choice:has-text("Modèle d’entreprise")');
  await p.waitForTimeout(150);
  const empty = await ev(p, () => ({
    heading: document.querySelector('#drawerContent h2')?.textContent,
    templatesShown: document.querySelectorAll('.wiz-template').length,
    createShortcut: !!document.querySelector('[onclick="openCompanyTemplateForm()"]'),
  }));
  note('SITE-1514-empty', empty);
  ok(empty.templatesShown === 0, 'SITE-1514 : sans modèle d’entreprise existant, la liste est vide (pas les modèles génériques)', 'SITE-1514');
  ok(empty.createShortcut, 'SITE-1514 : un raccourci propose de créer un modèle d’entreprise directement depuis ce point', 'SITE-1514');
  const withTpl = await ev(p, () => {
    closeOverlay('drawer');
    app.companyTemplates.push({ id: 'ct-1514', name: 'Modèle 1514', phase: '', milestone: 'Jalon', companyOwned: true,
      tasks: [{ key: 's1', name: 'Étape 1', offset: 0, duration: 2 }] });
    save();
    openProjectCreate(); wizardPickMode('company-template');
    return { count: document.querySelectorAll('.wiz-template').length, label: document.querySelector('.wiz-template b')?.textContent };
  });
  note('SITE-1514-withTpl', withTpl);
  ok(withTpl.count === 1, 'SITE-1514 : le modèle d’entreprise nouvellement créé apparaît bien dans cette liste dédiée', 'SITE-1514');
  ok(withTpl.label.includes('Entreprise'), 'SITE-1514 : le modèle porte bien le repère « Entreprise »', 'SITE-1514');
  const generic = await ev(p, () => { wizardGo('choice'); wizardPickMode('template'); return document.querySelectorAll('.wiz-template').length; });
  ok(generic === 4, 'SITE-1514 : « Utiliser un modèle » (générique) continue de montrer les 3 modèles historiques + le nouveau modèle d’entreprise (aucune régression)', 'SITE-1514');
  await ctx.close();
}

// ============================================================
// 4) MODE CHANTIER — barre du bas, sortie garantie sans impasse
// ============================================================
console.log('\n[FIELD-1514] Mode Chantier — le bouton « Chantier » referme toujours une conversation Messages restée ouverte');
{
  const { ctx, p } = await newPage(390, 844, 'FIELD-nav', FILE);
  await reset(p, "");
  await ev(p, () => {
    // toast de reset() sans lien avec ce scénario : il reste dans le flux
    // (pointer-events actif) même sans la classe "show" — on le neutralise.
    const t = document.querySelector('#toast');
    if (t) { t.classList.remove('show'); t.style.display = 'none'; }
    enterFieldMode(); selectFieldProject(app.projects.find(isProjectActive).id);
  });
  await p.waitForTimeout(150);
  await p.click('.field-bottom button:nth-child(2)');
  await p.waitForTimeout(150);
  const hasConv = await p.$('.conv-list .conv-item');
  ok(!!hasConv, 'FIELD-1514 : au moins une conversation existe pour le scénario', 'FIELD-1514');
  if (hasConv) await hasConv.click();
  await p.waitForTimeout(200);
  const convOpen = await ev(p, () => !!app.ui.conversation);
  ok(convOpen, 'FIELD-1514 : une conversation est bien ouverte (plein écran, onglet Messages)', 'FIELD-1514');
  await p.click('.field-bottom button:nth-child(1)'); // Chantier
  await p.waitForTimeout(200);
  const afterChantier = await ev(p, () => ({ conv: app.ui.conversation, tab: app.ui.fieldTab, heading: document.querySelector('.field-project-head h1')?.textContent }));
  note('FIELD-1514-afterChantier', afterChantier);
  ok(afterChantier.tab === 'site', 'FIELD-1514 : le bouton Chantier affiche bien la vue chantier', 'FIELD-1514');
  ok(!!afterChantier.heading, 'FIELD-1514 : le contenu du chantier est bien visible (pas un écran vide)', 'FIELD-1514');
  ok(afterChantier.conv === null, 'FIELD-1514 : la conversation ouverte a bien été refermée (sortie garantie, comme pour le Planning)', 'FIELD-1514');
  await p.click('.field-bottom button:nth-child(2)'); // Messages, à nouveau
  await p.waitForTimeout(200);
  const backOnMessages = await ev(p, () => ({ stuck: !!document.querySelector('#fieldConvThread'), listShown: !!document.querySelector('.conv-list') }));
  note('FIELD-1514-backOnMessages', backOnMessages);
  ok(!backOnMessages.stuck, 'FIELD-1514 : retourner sur Messages affiche la LISTE des conversations, plus jamais bloqué sur l’ancienne', 'FIELD-1514');
  ok(backOnMessages.listShown, 'FIELD-1514 : la liste des conversations est bien affichée', 'FIELD-1514');
  await p.screenshot({ path: SHOTS + '04-field-nav.png' });
  await ctx.close();
}

// ============================================================
// 5) FICHE TÂCHE — masquage de « Signaler une reprise » déjà signalée
// ============================================================
console.log('\n[REWORK-1514] « Signaler une reprise » disparaît une fois la reprise déjà signalée');
{
  const { ctx, p } = await newPage(1200, 900, 'REWORK-desktop', FILE);
  await reset(p, "");
  const before = await ev(p, () => {
    const t = app.tasks[0];
    t.status = 'done'; delete t.reworkOfTaskId; save();
    openTask(t.id);
    const present = !!document.querySelector(`[onclick="openReworkForm('${t.id}')"]`);
    closeOverlay('drawer');
    return { id: t.id, present };
  });
  note('REWORK-1514-before', before);
  ok(before.present, 'REWORK-1514 : avant toute reprise, le bouton « Signaler une reprise » est bien proposé (comportement de référence)', 'REWORK-1514');
  const after = await ev(p, (id) => {
    app.tasks.push({ id: 'rework-1514', projectId: task(id).projectId, name: 'Reprise 1514', status: 'todo',
      start: task(id).end, end: task(id).end, resourceId: task(id).resourceId, deps: [] });
    task('rework-1514').reworkOfTaskId = id;
    save();
    openTask(id);
    const present = !!document.querySelector(`[onclick="openReworkForm('${id}')"]`);
    const menuStillThere = !!document.querySelector('.more-menu');
    closeOverlay('drawer');
    return { present, menuStillThere };
  }, before.id);
  note('REWORK-1514-after-desktop', after);
  ok(!after.present, 'REWORK-1514-desktop : le bouton disparaît dès qu’une reprise existe pour cette tâche (fiche Bureau)', 'REWORK-1514');
  ok(after.menuStillThere, 'REWORK-1514-desktop : le reste de la fiche (menu ···) reste disponible, seul le bouton de reprise est retiré', 'REWORK-1514');
  const fieldControl = await ev(p, (id) => {
    enterFieldMode(); selectFieldProject(task(id).projectId);
    const btn = document.querySelector(`[onclick="event.stopPropagation();openReworkForm('${id}')"]`);
    return { present: !!btn };
  }, before.id);
  ok(!fieldControl.present, 'REWORK-1514-field-control : la liste « À contrôler » du Mode Chantier retire aussi le bouton', 'REWORK-1514');
  const fieldModal = await ev(p, (id) => {
    openFieldTaskModal(id);
    const btn = document.querySelector(`[onclick*="openReworkForm('${id}')"]`);
    closeOverlay('modal');
    exitFieldMode();
    return { present: !!btn };
  }, before.id);
  ok(!fieldModal.present, 'REWORK-1514-field-modal : la pop-up tâche du Mode Chantier retire elle aussi le bouton', 'REWORK-1514');
  await ctx.close();
}

// ============================================================
// FREEZE — pages non concernées inchangées (Chantiers, cockpit)
// ============================================================
console.log('\n[FREEZE-1514] Aucune régression visuelle sur les pages non concernées par ce round');
{
  const { ctx: cPrev, p: pPrev } = await newPage(1440, 1000, 'FZ-prev', PREV);
  const { ctx: cCur, p: pCur } = await newPage(1440, 1000, 'FZ-cur', FILE);
  await ev(pPrev, () => { resetApp(); go('sites'); });
  await ev(pCur, () => { resetApp(); go('sites'); });
  await pPrev.waitForTimeout(150); await pCur.waitForTimeout(150);
  const shape = (p) => ev(p, () => ({
    count: document.querySelectorAll('.site-card').length,
    heights: [...document.querySelectorAll('.site-card')].map((c) => Math.round(c.getBoundingClientRect().height)),
  }));
  const prev = await shape(pPrev), cur = await shape(pCur);
  note('FREEZE-1514', { prev, cur });
  ok(prev.count === cur.count, 'FREEZE-1514 : même nombre de cartes chantier', 'FREEZE-1514');
  ok(JSON.stringify(prev.heights) === JSON.stringify(cur.heights), 'FREEZE-1514 : cartes chantier visuellement inchangées', 'FREEZE-1514');
  await cPrev.close(); await cCur.close();
}

// ============================================================
// CONSOLE
// ============================================================
console.log('\n[CONSOLE-1514]');
{
  const appErrs = allErrs.filter((e) => !/open-meteo|geopf|nominatim|net::ERR|Failed to load resource/i.test(e.msg));
  note('CONSOLE-1514', { total: allErrs.length, applicatives: appErrs.length, detail: appErrs.slice(0, 5) });
  ok(appErrs.length === 0, 'CONSOLE-1514 : 0 erreur JavaScript applicative', 'CONSOLE-1514');
}

// ============================================================
// ENGINES — byte-identité des moteurs NON concernés par ce round
// ============================================================
console.log('\n[ENGINES-1514] Byte-identité des moteurs métier (V2.4.15.3 → V2.4.15.4)');
{
  const crypto = await import('crypto');
  const prevSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.3.html', 'utf8');
  const curSrc = fs.readFileSync(BASE + 'kanvix-next-gen-v2.4.15.4.html', 'utf8');
  // NB : contrairement aux suites précédentes, on saute la liste de
  // paramètres (paren-aware) avant de chercher l'accolade d'ouverture du
  // CORPS — sinon un défaut littéral comme `opts = {}` dans la signature
  // (ex. setTaskStatus) fait matcher cette accolade-là au lieu du corps
  // réel, et tronque l'extraction dès la fin de ce défaut (faux-positif
  // « identique » silencieux, présent sans le savoir dans les suites
  // .1/.2/.3 pour toute fonction avec un défaut objet/tableau).
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
  // Inchangées ce round : moteurs métier non touchés par les 5 correctifs.
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
  const engines = [
    /* V2.8.5.2 — RE-BASELINE des listes de gel. Ces listes comparent le fichier
       COURANT à la version précédente de LEUR round. Quatre moteurs ont depuis
       été modifiés à la demande explicite du produit ; ils sortent donc de la
       liste des « inchangés », sans que rien d'autre n'y soit relâché :
         · setTaskStatus            — V2.8.5.1 §7  : démarrage réel
         · requestTaskScheduleMove  — V2.8.5.1 §5  : confirmation jour non ouvré
         · gantt                    — V2.8.5.1 §4 (colonnes non ouvrées)
                                      et V2.8.5.2 §3 (édition hors niveau)
         · renderPlanning           — V2.8.5.1 §6  : libellé de période partagé
       Tous les autres moteurs de la liste restent vérifiés byte à byte. */
    'planReflow', 'applyReflowPlan', 'kanbanDrop', 'dropTask', 
    'scenarioOptions', 'evaluateScenario', 'applySimulation', 'historyProjectId', 'projectHistory',
    'historyStamp', 'historyGroups', 'buildKanvixBackup', 'confirmKanvixRestore', 'validateKanvixBackup',
    'reopenProject', 'archiveProjectPrompt', 'restoreProject', 'confirmCloseProject',
    'kanbanCard', 'getProjectSummary', 'art', 'projectVisual', 'projectCardMenu',
    'getResourceState', 'getResourcePeriodState', 'getResourceLoad', 'getMaxConcurrentTasks',
    'getResourceWeekDays', 'siteCard', 'closeDrawerMenu',
    'getTaskPredecessors', 'getTaskSuccessors', 'createRework', 'allProjectTemplates', 'createTemplateFromWizard',
  ];
  let allIdentical = true;
  for (const name of engines) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const identical = a && c && md5(a) === md5(c);
    if (!identical) allIdentical = false;
    console.log(`  ${identical ? '✓' : '✗'} ${name} : ${a ? md5(a).slice(0, 8) : 'ABSENT'} → ${c ? md5(c).slice(0, 8) : 'ABSENT'}`);
  }
  ok(allIdentical, 'ENGINES-1514 : tous les moteurs listés, non concernés par ce round, sont byte-identiques', 'ENGINES-1514');

  /* V2.9.0.1 — RE-BASELINE. toggleDrawerMenu() a reçu le retournement vertical
     du popover (V2.9.0.1 §3), et ce n'est pas un confort : mesuré sur une liste
     Structure longue, le menu du DERNIER niveau sortait de 165 à 169 px sous le
     bas du viewport, sur les cinq largeurs testées. La fonction quitte donc la
     liste des « byte-identiques » — mais elle n'est PAS relâchée : l'assertion
     dédiée ajoutée plus bas vérifie qu'en retirant le seul bloc ajouté, elle
     redevient BYTE-IDENTIQUE à la version d'origine. closeDrawerMenu(), elle,
     reste gelée telle quelle et continue d'être vérifiée dans cette liste. */
  {
    const sansFlip = (src) => src
      .replace(/\/\* V2\.9\.0\.1[\s\S]*?\*\//g, '')
      .replace(/pop\.classList\.remove\("drop-up"\);/g, '')
      .replace(/let r = btn\.getBoundingClientRect\(\),[\s\S]*?pop\.classList\.add\("drop-up"\);/g, '')
      .replace(/\s+/g, ' ').trim();
    const a = extractFn(prevSrc, 'toggleDrawerMenu'), c = extractFn(curSrc, 'toggleDrawerMenu');
    const identiqueHorsFlip = !!a && !!c && md5(sansFlip(a)) === md5(sansFlip(c));
    console.log('  (info) [ENGINES-1514] ' + JSON.stringify({ identiqueHorsFlip, brut: [a && md5(a).slice(0, 8), c && md5(c).slice(0, 8)], normalise: [a && md5(sansFlip(a)).slice(0, 8), c && md5(sansFlip(c)).slice(0, 8)] }));
    ok(identiqueHorsFlip,
      'ENGINES-1514 : toggleDrawerMenu() ne diffère QUE par le retournement vertical — ce bloc retiré, elle redevient byte-identique à l’origine ; toute autre ligne ajoutée ferait tomber cette assertion', 'ENGINES-1514');
  }


  // Volontairement modifiées ce round — vérifiées ici comme CHANGÉES, pas
  // identiques (traçabilité explicite des 5 correctifs, cf rapport §1).
  const changed = ['scrollPlanningToToday', 'setPeriod', 'setTaskStatus', 'setFieldTab', 'wizardPickMode', 'renderWizard', 'openTask', 'fieldControlItems', 'openFieldTaskModal'];
  let allChanged = true;
  for (const name of changed) {
    const a = extractFn(prevSrc, name), c = extractFn(curSrc, name);
    const same = a && c && md5(a) === md5(c);
    if (same) allChanged = false;
    console.log(`  ${!same ? '✓ (changé)' : '✗ (identique, inattendu)'} ${name}`);
  }
  ok(allChanged, 'ENGINES-1514 : les fonctions volontairement modifiées ce round ont bien changé (pas un no-op silencieux)', 'ENGINES-1514');
  ok(!!extractFn(curSrc, 'hasReworkSignaled'), 'ENGINES-1514 : le nouvel helper hasReworkSignaled est bien présent', 'ENGINES-1514');
}

await b.close();
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, errors: allErrs }, null, 2));
console.log(`\n===== ${passed} PASS / ${failed.length} FAIL =====`);
if (failed.length) { failed.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
