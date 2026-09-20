// ============================================================
// KANVIX — Recette « Undo/Redo et communications » (V2.12.0.2)
//
//   Undo/Redo restaure un ÉTAT complet : `app = state`. Une communication
//   émise APRÈS la prise du snapshot était donc « dé-envoyée » par
//   l'annulation d'une transaction qui ne la concernait même pas.
//
//   La règle que cette recette protège :
//   UNDO / REDO RESTAURE LE DOMAINE TRANSACTIONNEL,
//   MAIS NE REMONTE PAS LE TEMPS SUR LES COMMUNICATIONS ÉMISES ENSUITE.
//
//   Les messages passent par le WORKFLOW PRODUIT réel — openConversation()
//   puis sendConversationMessage(), ou sendArtisanMessage() côté terrain —
//   avec les vrais champs du composer. Aucun test ne pousse directement dans
//   app.messages : ce serait tester une fiction.
//
//   Usage : node recette-undo-communications-v2.12.0.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
import crypto from 'crypto';
const { chromium } = pw;
const BASE = '/home/user/Planzy-saas/public/poc/';
const CUR = 'kanvix-next-gen-v2.12.0.2.html';
const PREV = 'kanvix-next-gen-v2.12.0.1.html';
const NOW = '2026-08-17T08:00:00';
const F = (file = CUR, now = NOW) => 'file://' + BASE + file + '?now=' + now;
const SHOTS = process.env.KVX_SHOTS || '/home/user/Planzy-saas/recette-v2.12.0.2/';
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
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d).slice(0, 1100)}`);
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
  await p.evaluate((r) => { resetApp(); setDepth('pilot'); dismissKanvixContinuityNotice(); if (r !== 'driver') setRole(r); }, role);
  await p.waitForTimeout(200);
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);

/* Le PNG 1×1 le plus court qui soit : une vraie dataUrl, pas une chaîne bidon,
   pour que le brouillon photo du composer se comporte comme en production. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* Le SCÉNARIO du défaut, joué par les fonctions produit. Il est partagé par la
   reproduction sur V2.12.0.1 et par la vérification sur V2.12.0.2 : c'est le
   MÊME geste des deux côtés, la comparaison est donc honnête. */
const scenario = (png) => {
  const envoyer = (texte, avecPhoto) => {
    openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
    const el = document.querySelector('#' + conversationRenderTarget + 'Input');
    el.value = texte;
    if (avecPhoto) app.ui.convDraftDataUrl = png;
    sendConversationMessage();
    return app.messages[app.messages.length - 1];
  };
  const avant = { messages: app.messages.length, photos: app.photos.length, nom: task('k-windows').name };
  // 1 · une transaction métier ordinaire : le produit prend son snapshot.
  snapshot();
  task('k-windows').name = 'Renommée par transaction';
  save(); actionToast('Tâche modifiée'); render();
  // 2 · APRÈS la transaction, deux communications réelles.
  const m1 = envoyer('Message sans photo, après la transaction', false);
  const m2 = envoyer('Message avec photo, après la transaction', true);
  const apresEnvoi = { messages: app.messages.length, photos: app.photos.length,
    undo: undoHistory.length, redo: redoHistory.length, histo: app.history.length };
  // 3 · UNDO de la transaction.
  undo();
  const apresUndo = {
    messages: app.messages.length, photos: app.photos.length,
    nom: task('k-windows').name,
    m1: app.messages.some((x) => x.id === m1.id),
    m2: app.messages.some((x) => x.id === m2.id),
    photoLiee: app.photos.some((x) => x.id === m2.photoId),
    photoResolvable: !!app.photos.find((x) => x.id === (app.messages.find((y) => y.id === m2.id) || {}).photoId),
    doublonsMessages: app.messages.length - new Set(app.messages.map((x) => x.id)).size,
    doublonsPhotos: app.photos.length - new Set(app.photos.map((x) => x.id)).size,
    contexte: (() => { const m = app.messages.find((x) => x.id === m2.id); return m ? [m.resourceId, m.taskId, m.projectId] : null; })(),
    histo: app.history.length,
  };
  // 4 · REDO.
  redo();
  const apresRedo = {
    messages: app.messages.length, photos: app.photos.length,
    nom: task('k-windows').name,
    m1: app.messages.some((x) => x.id === m1.id),
    m2: app.messages.some((x) => x.id === m2.id),
    photoLiee: app.photos.some((x) => x.id === m2.photoId),
    doublonsMessages: app.messages.length - new Set(app.messages.map((x) => x.id)).size,
    doublonsPhotos: app.photos.length - new Set(app.photos.map((x) => x.id)).size,
  };
  return { avant, apresEnvoi, apresUndo, apresRedo, m2PhotoId: m2.photoId };
};

// ============================================================
// UNDOCOM-01 — LE DÉFAUT, REPRODUIT SUR V2.12.0.1
// ============================================================
console.log('\n[UNDOCOM-01] Reproduction du défaut sur V2.12.0.1');
let refBug = null;
{
  const { ctx, p } = await newPage({ tag: 'BUG', file: PREV });
  refBug = await ev(p, scenario, PNG);
  note('UNDOCOM-01', { apresEnvoi: refBug.apresEnvoi, apresUndo: refBug.apresUndo });
  ok(refBug.apresEnvoi.messages === refBug.avant.messages + 2
    && refBug.apresEnvoi.photos === refBug.avant.photos + 1,
    'UNDOCOM-01 : le cas de test est bien celui du défaut — deux communications réelles sont émises APRÈS la transaction, dont une avec photo jointe', 'UNDOCOM-01');
  ok(refBug.apresUndo.m1 === false && refBug.apresUndo.m2 === false
    && refBug.apresUndo.photoLiee === false,
    'UNDOCOM-01 : sur V2.12.0.1, l’Undo de la transaction EFFACE les deux messages ET la photo jointe — une opération de planning supprime des communications émises ensuite. Le défaut est REPRODUIT, pas supposé', 'UNDOCOM-01');
  await ctx.close();
}

// ============================================================
// UNDOCOM-02 → 09 — LE MÊME GESTE SUR V2.12.0.2
// ============================================================
console.log('\n[UNDOCOM-02] Le même geste sur V2.12.0.2');
let cur = null;
{
  const { ctx, p } = await newPage({ tag: 'FIX' });
  cur = await ev(p, scenario, PNG);
  note('UNDOCOM-02', { apresUndo: cur.apresUndo, apresRedo: cur.apresRedo });
  ok(cur.apresUndo.m1 === true,
    'UNDOCOM-02 : après Undo, le message SANS photo émis après la transaction est CONSERVÉ', 'UNDOCOM-02');
  ok(cur.apresUndo.m2 === true,
    'UNDOCOM-03 : après Undo, le message AVEC photo émis après la transaction est CONSERVÉ', 'UNDOCOM-03');
  ok(cur.apresUndo.photoLiee === true,
    'UNDOCOM-04 : la photo rattachée à ce message est CONSERVÉE elle aussi — une pièce jointe n’est pas une donnée transactionnelle comme une autre', 'UNDOCOM-04');
  ok(cur.apresUndo.photoResolvable === true,
    'UNDOCOM-05 : message.photoId reste RÉSOLVABLE — la pièce jointe se retrouve toujours dans app.photos, aucune référence cassée', 'UNDOCOM-05');
  ok(cur.apresUndo.doublonsMessages === 0 && cur.apresRedo.doublonsMessages === 0,
    'UNDOCOM-06 : aucun message dupliqué, ni après Undo ni après Redo', 'UNDOCOM-06');
  ok(cur.apresUndo.doublonsPhotos === 0 && cur.apresRedo.doublonsPhotos === 0,
    'UNDOCOM-07 : aucune photo dupliquée, aucun identifiant de photo en double', 'UNDOCOM-07');
  ok(cur.apresRedo.m1 === true && cur.apresRedo.m2 === true && cur.apresRedo.photoLiee === true,
    'UNDOCOM-11 : après Redo, les deux messages et la photo jointe sont toujours là — la règle est SYMÉTRIQUE, parce qu’elle est posée au point de restauration unique', 'UNDOCOM-11');
  ok(cur.apresUndo.contexte && cur.apresUndo.contexte.join('|') === 'thomas|k-windows|keravel',
    'UNDOCOM-13 / 14 / 15 : le contexte du message conducteur ↔ artisan est intact après Undo — resourceId, taskId et projectId sont conservés tels quels', 'UNDOCOM-13');
  await ctx.close();
}

// ============================================================
// UNDOCOM-08 → 09 — MESSAGES AVANT LE SNAPSHOT, PLUSIEURS APRÈS
// ============================================================
console.log('\n[UNDOCOM-08] Messages avant le snapshot, plusieurs après');
{
  const { ctx, p } = await newPage({ tag: 'MULTI' });
  const r = await ev(p, () => {
    const envoyer = (texte) => {
      openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
      document.querySelector('#' + conversationRenderTarget + 'Input').value = texte;
      sendConversationMessage();
      return app.messages[app.messages.length - 1].id;
    };
    const demo = app.messages.map((m) => m.id);
    const avantA = envoyer('Avant la transaction — 1');
    const avantB = envoyer('Avant la transaction — 2');
    snapshot(); task('k-windows').name = 'Transaction'; save(); actionToast('Tâche modifiée'); render();
    const apres = [envoyer('Après — 1'), envoyer('Après — 2'), envoyer('Après — 3')];
    undo();
    const u = {
      demo: demo.every((id) => app.messages.some((m) => m.id === id)),
      avant: [avantA, avantB].every((id) => app.messages.some((m) => m.id === id)),
      apres: apres.filter((id) => app.messages.some((m) => m.id === id)).length,
      total: app.messages.length, nom: task('k-windows').name,
    };
    redo();
    const rd = {
      demo: demo.every((id) => app.messages.some((m) => m.id === id)),
      avant: [avantA, avantB].every((id) => app.messages.some((m) => m.id === id)),
      apres: apres.filter((id) => app.messages.some((m) => m.id === id)).length,
      total: app.messages.length, nom: task('k-windows').name,
    };
    return { attendus: demo.length + 5, u, rd };
  });
  note('UNDOCOM-08', r);
  ok(r.u.demo && r.u.avant && r.rd.demo && r.rd.avant,
    'UNDOCOM-08 : les messages ANTÉRIEURS au snapshot — ceux de la démonstration comme ceux envoyés juste avant la transaction — restent évidemment présents, après Undo comme après Redo', 'UNDOCOM-08');
  ok(r.u.apres === 3 && r.rd.apres === 3 && r.u.total === r.attendus && r.rd.total === r.attendus,
    'UNDOCOM-09 : les TROIS messages postérieurs au snapshot survivent tous, à l’Undo comme au Redo — et le total est exact, donc rien n’a été ni perdu ni dupliqué', 'UNDOCOM-09');
  await ctx.close();
}

// ============================================================
// UNDOCOM-10 — TRANSACTION → UNDO → MESSAGE → REDO
// ============================================================
console.log('\n[UNDOCOM-10] Transaction, Undo, message, Redo');
{
  const mesure = async (file, tag) => {
    const { ctx, p } = await newPage({ tag, file });
    const r = await ev(p, () => {
      snapshot(); task('k-windows').name = 'A'; save(); actionToast('Tâche modifiée'); render();
      undo();
      openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
      document.querySelector('#' + conversationRenderTarget + 'Input').value = 'Message envoyé entre Undo et Redo';
      sendConversationMessage();
      const M = app.messages[app.messages.length - 1];
      const avant = { redo: redoHistory.length, present: app.messages.some((x) => x.id === M.id) };
      const rendu = redo();
      return { avant, rendu, present: app.messages.some((x) => x.id === M.id),
        nom: task('k-windows').name, messages: app.messages.length };
    });
    await ctx.close();
    return r;
  };
  const a = await mesure(PREV, 'RDO-PREV'), c = await mesure(CUR, 'RDO-CUR');
  note('UNDOCOM-10', { v21201: a, v21202: c });
  ok(c.present === true,
    'UNDOCOM-10 : un message envoyé ENTRE l’Undo et le Redo est conservé — aucun Redo ne réinjecte une collection de messages plus ancienne', 'UNDOCOM-10');
  ok(JSON.stringify(a) === JSON.stringify(c),
    'UNDOCOM-10 : et ce cas se comportait DÉJÀ correctement en V2.12.0.1, pour une autre raison — l’envoi d’un message appelle invalidateRedo(), qui coupe la branche Redo (redoHistory vide, redo() rend false). Le correctif ne change donc rien à ce contrat : il le rend simplement inutile comme unique rempart', 'UNDOCOM-10');
  await (async () => {})();
}

// ============================================================
// UNDOCOM-12 — UNE PHOTO NON LIÉE À UN MESSAGE RESTE ANNULABLE
// ============================================================
console.log('\n[UNDOCOM-12] Photo non liée à un message');
{
  const { ctx, p } = await newPage({ tag: 'PHOTO' });
  const r = await ev(p, () => {
    // Le geste du formulaire Photo du conducteur : snapshot() puis addPhoto()
    // SANS rattachement à un message (notify pose un message d'information,
    // mais il ne porte aucun photoId).
    const av = { photos: app.photos.length, messages: app.messages.length, histo: app.history.length };
    snapshot();
    const ph = addPhoto({ projectId: 'keravel', taskId: 'k-windows', resourceId: 'thomas',
      author: 'Thomas Martin', comment: 'Photo ajoutée depuis le terrain.', dataUrl: 'data:image/png;base64,AAA' });
    const msg = app.messages[app.messages.length - 1];
    const ap = { photos: app.photos.length, messages: app.messages.length, histo: app.history.length,
      texte: msg.text, photoIdDuMessage: msg.photoId ?? null };
    undo();
    return { av, ap, un: {
      photos: app.photos.length, messages: app.messages.length, histo: app.history.length,
      photoPresente: app.photos.some((x) => x.id === ph.id),
      messagePresent: app.messages.some((x) => x.id === msg.id),
      referenceCassee: app.messages.some((m) => m.photoId && !app.photos.some((x) => x.id === m.photoId)),
    } };
  });
  note('UNDOCOM-12', r);
  ok(r.ap.photoIdDuMessage === null,
    'UNDOCOM-12 : le message d’information posé par addPhoto() ne porte AUCUN photoId — la photo n’est donc rattachée à aucune communication', 'UNDOCOM-12');
  ok(r.un.photoPresente === false && r.un.photos === r.av.photos,
    'UNDOCOM-12 : et elle DISPARAÎT bien à l’Undo — une photo non rattachée à un message suit le comportement transactionnel historique. La galerie n’est pas devenue un domaine hors-Undo', 'UNDOCOM-12');
  ok(r.un.histo === r.av.histo,
    'UNDOCOM-12 : l’entrée d’historique de la photo disparaît elle aussi — la transaction est bien annulée', 'UNDOCOM-12');
  ok(r.un.referenceCassee === false,
    'UNDOCOM-12 : aucune référence cassée ne subsiste — aucun message ne pointe vers une photo absente', 'UNDOCOM-12');
  /* CONSÉQUENCE ASSUMÉE ET MESURÉE, pas un effet de bord découvert après coup :
     le message d'information « Photo terrain ajoutée. » est enregistré dans
     app.messages, c'est donc une communication au sens de la règle, et il
     survit à l'Undo. Il ne porte aucun photoId : il ne laisse donc aucune
     référence cassée derrière lui. En V2.12.0.1 il disparaissait avec la
     transaction. C'est le seul changement de comportement du round en dehors
     du défaut corrigé, et il découle directement de la doctrine que le produit
     énonce lui-même : un message enregistré n'est jamais « dé-envoyé ». */
  ok(r.un.messagePresent === true && r.un.messages === r.av.messages + 1,
    'UNDOCOM-12 : conséquence assumée — le message d’information « Photo terrain ajoutée. », lui, est enregistré dans app.messages et survit à l’Undo, sans référence cassée puisqu’il ne porte pas de photoId', 'UNDOCOM-12');
  await ctx.close();
}

// ============================================================
// UNDOCOM-12bis — UNION, ET SURTOUT PAS REMPLACEMENT
//   Le piège de cette règle : si l'état restauré recevait la collection
//   COURANTE de messages, un Undo d'import « remplacer les chantiers » —
//   qui vide app.messages — ne rendrait plus rien. La préservation doit
//   AJOUTER ce qui est apparu depuis, jamais écraser ce que le snapshot
//   contient. Cas mesuré des deux côtés.
// ============================================================
console.log('\n[UNDOCOM-12bis] Union, et surtout pas remplacement');
{
  const remplacementTotal = async (file, tag) => {
    const { ctx, p } = await newPage({ tag, file });
    const r = await ev(p, () => {
      const av = { messages: app.messages.length, photos: app.photos.length,
        projets: app.projects.length, ids: app.messages.map((m) => m.id) };
      // Le geste d'un import « remplacer les chantiers » : une transaction qui
      // REMPLACE les collections au lieu d'y ajouter.
      snapshot();
      app.projects = [{ id: 'newp', name: 'Nouveau', location: 'Lorient', phase: 'GO' }];
      app.tasks = []; app.messages = []; app.photos = []; app.documents = []; app.issues = [];
      save(); render();
      const ap = { messages: app.messages.length, photos: app.photos.length, projets: app.projects.length };
      undo();
      return { av, ap, un: { messages: app.messages.length, photos: app.photos.length,
        projets: app.projects.length,
        memesIds: JSON.stringify(app.messages.map((m) => m.id)) === JSON.stringify(av.ids) } };
    });
    await ctx.close();
    return r;
  };
  const a = await remplacementTotal(PREV, 'REPL-PREV'), c = await remplacementTotal(CUR, 'REPL-CUR');
  note('UNDOCOM-12bis', { v21201: a, v21202: c });
  ok(c.ap.messages === 0 && c.un.messages === c.av.messages && c.un.memesIds,
    'UNDOCOM-12bis : après une transaction qui VIDE app.messages, l’Undo les rend tous, aux mêmes identifiants et dans le même ordre — la préservation est une UNION, jamais un remplacement par la collection courante', 'UNDOCOM-12bis');
  ok(JSON.stringify(a) === JSON.stringify(c),
    'UNDOCOM-12bis : et le résultat est IDENTIQUE à V2.12.0.1 — ce cas fonctionnait, il continue de fonctionner à l’identique', 'UNDOCOM-12bis');
}

// ============================================================
// UNDOCOM-12ter — SEULE L'EXISTENCE EST SANCTUARISÉE
// ============================================================
console.log('\n[UNDOCOM-12ter] Le contenu d’un message reste transactionnel');
{
  const { ctx, p } = await newPage({ tag: 'CONTENU' });
  const r = await ev(p, () => {
    // Un message DÉJÀ présent au moment du snapshot, dont une propriété est
    // ensuite modifiée par la transaction elle-même.
    const m = app.messages.find((x) => x.from === 'artisan') || app.messages[0];
    const avantLu = m.read;
    m.read = false; save();
    snapshot();
    task('k-windows').name = 'Transaction'; 
    app.messages.find((x) => x.id === m.id).read = true;
    save(); actionToast('Tâche modifiée'); render();
    undo();
    const apres = app.messages.find((x) => x.id === m.id);
    return { avantLu, presente: !!apres, luApresUndo: apres ? apres.read : null,
      total: app.messages.length, nom: task('k-windows').name };
  });
  note('UNDOCOM-12ter', r);
  ok(r.presente && r.luApresUndo === false,
    'UNDOCOM-12ter : pour un message DÉJÀ présent au snapshot, c’est la version du SNAPSHOT qui est restaurée — son contenu appartient au domaine transactionnel, seule son EXISTENCE est sanctuarisée', 'UNDOCOM-12ter');
  await ctx.close();
}

// ============================================================
// UNDOCOM-13 — MESSAGERIE ARTISAN (l'autre point d'envoi du produit)
// ============================================================
console.log('\n[UNDOCOM-13] Messagerie artisan');
{
  const { ctx, p } = await newPage({ tag: 'ARTISAN', w: 390, h: 844, role: 'artisan' });
  const r = await ev(p, () => {
    snapshot(); task('k-windows').name = 'Transaction côté bureau'; save(); actionToast('Tâche modifiée'); render();
    renderPage();
    const el = document.querySelector('#messageInput');
    el.value = 'Je suis sur place, il manque les fenêtres';
    document.querySelector('.chat-compose').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const M = app.messages[app.messages.length - 1];
    const envoye = { id: M.id, from: M.from, resourceId: M.resourceId, taskId: M.taskId, projectId: M.projectId };
    undo();
    const m = app.messages.find((x) => x.id === M.id);
    return { envoye, present: !!m, nom: task('k-windows').name,
      contexte: m ? [m.from, m.resourceId, m.taskId, m.projectId] : null };
  });
  note('UNDOCOM-13', r);
  ok(r.present === true,
    'UNDOCOM-13 : un message envoyé depuis la CONVERSATION ARTISAN — l’autre point d’envoi du produit — survit lui aussi à l’Undo', 'UNDOCOM-13');
  ok(r.contexte && r.contexte[0] === 'artisan'
    && r.contexte[1] === r.envoye.resourceId
    && r.contexte[2] === r.envoye.taskId
    && r.contexte[3] === r.envoye.projectId,
    'UNDOCOM-14 / 15 : son contexte complet est conservé à l’identique — émetteur, ressource, tâche et chantier', 'UNDOCOM-14');
  await ctx.close();
}

// ============================================================
// UNDOCOM-14 — BROUILLON NON PERSISTÉ
// ============================================================
console.log('\n[UNDOCOM-14] Un brouillon n’est pas une communication');
{
  const { ctx, p } = await newPage({ tag: 'DRAFT' });
  const r = await ev(p, () => {
    snapshot(); task('k-windows').name = 'Transaction'; save(); actionToast('Tâche modifiée'); render();
    openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
    // Saisie NON envoyée : elle ne touche pas app.messages.
    document.querySelector('#' + conversationRenderTarget + 'Input').value = 'Brouillon jamais envoyé';
    const avant = app.messages.length;
    undo();
    return { avant, apres: app.messages.length,
      brouillonEnBase: app.messages.some((m) => /Brouillon jamais envoyé/.test(m.text || '')) };
  });
  note('UNDOCOM-14', r);
  ok(r.brouillonEnBase === false && r.apres === r.avant,
    'UNDOCOM-14 : un simple brouillon de composer n’est pas persisté dans app.messages — il n’est donc PAS sanctuarisé, et la règle ne s’applique qu’à une communication réellement enregistrée', 'UNDOCOM-14');
  await ctx.close();
}

// ============================================================
// UNDOCOM-16 → 18 — L'UNDO RESTE UN UNDO
// ============================================================
console.log('\n[UNDOCOM-16] L’Undo continue de faire son travail');
{
  const { ctx, p } = await newPage({ tag: 'DOMAINE' });
  const r = await ev(p, () => {
    const t = task('k-windows');
    const av = { nom: t.name, start: t.start, res: t.resourceId, statut: t.status, histo: app.history.length };
    snapshot();
    t.name = 'Nom transactionnel'; t.start = '2026-08-19T09:00'; t.resourceId = 'eric';
    app.history.unshift({ date: historyNow(), text: 'Tâche modifiée.', author: 'Eric', taskId: 'k-windows' });
    save(); actionToast('Tâche modifiée'); render();
    openConversation({ resourceId: 'thomas', taskId: 'k-windows', projectId: 'keravel' });
    document.querySelector('#' + conversationRenderTarget + 'Input').value = 'Communication postérieure';
    sendConversationMessage();
    const histoApresEnvoi = app.history.length;
    const ap = { nom: task('k-windows').name, start: task('k-windows').start, res: task('k-windows').resourceId };
    undo();
    const un = { nom: task('k-windows').name, start: task('k-windows').start,
      res: task('k-windows').resourceId, histo: app.history.length };
    redo();
    const rd = { nom: task('k-windows').name, start: task('k-windows').start, res: task('k-windows').resourceId };
    return { av, ap, un, rd, histoApresEnvoi };
  });
  note('UNDOCOM-17', r);
  ok(r.histoApresEnvoi === r.av.histo + 1,
    'UNDOCOM-16 : envoyer un message n’écrit AUCUNE entrée d’historique — la seule entrée est celle de la transaction elle-même. Aucun événement artificiel « message préservé » n’est inventé', 'UNDOCOM-16');
  ok(r.un.nom === r.av.nom && r.un.start === r.av.start && r.un.res === r.av.res
    && r.un.histo === r.av.histo,
    'UNDOCOM-17 : l’Undo restaure toujours la TÂCHE elle-même — nom, dates, intervenant — et retire l’entrée d’historique de la transaction. Le domaine transactionnel garde tous ses droits', 'UNDOCOM-17');
  ok(r.rd.nom === r.ap.nom && r.rd.start === r.ap.start && r.rd.res === r.ap.res,
    'UNDOCOM-18 : et le Redo la rétablit intégralement', 'UNDOCOM-18');
  await ctx.close();
}

// ============================================================
// UNDOCOM-19 → 22 — ARCHITECTURE, SCHÉMA, STOCKAGE
// ============================================================
console.log('\n[UNDOCOM-19] Un seul moteur, aucune donnée nouvelle');
{
  const B = fs.readFileSync(BASE + CUR, 'utf8'), A = fs.readFileSync(BASE + PREV, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
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
  const undoSrc = extractFn(B, 'undo'), redoSrc = extractFn(B, 'redo');
  const arch = {
    unSeulRestore: (B.match(/function\s+restoreHistoryState\s*\(/g) || []).length === 1,
    unSeulClone: (B.match(/function\s+cloneHistoryState\s*\(/g) || []).length === 1,
    unSeulSnapshot: (B.match(/function\s+snapshot\s*\(/g) || []).length === 1,
    unSeulHelper: (B.match(/function\s+preserveCommunications\s*\(/g) || []).length === 1,
    // Le helper n'est appelé QUE par le point de restauration unique.
    appelsHelper: (B.match(/preserveCommunications\(/g) || []).length === 2,
    helperDansRestore: /preserveCommunications\(/.test(extractFn(B, 'restoreHistoryState')),
    // undo() et redo() ne contiennent AUCUNE logique de fusion : ils ne parlent
    // ni de messages, ni de photos, ni du helper.
    undoSansFusion: !/messages|photos|preserveCommunications/.test(undoSrc),
    redoSansFusion: !/messages|photos|preserveCommunications/.test(redoSrc),
    undoGele: md5(extractFn(A, 'undo')) === md5(undoSrc),
    redoGele: md5(extractFn(A, 'redo')) === md5(redoSrc),
    snapshotGele: md5(extractFn(A, 'snapshot')) === md5(extractFn(B, 'snapshot')),
    cloneGele: md5(extractFn(A, 'cloneHistoryState')) === md5(extractFn(B, 'cloneHistoryState')),
    invalidateGele: md5(extractFn(A, 'invalidateRedo')) === md5(extractFn(B, 'invalidateRedo')),
    /* Le helper est PUR : il ne lit ni n'écrit `app`, il reçoit ses entrées.
       On mesure le CODE, pas la prose : les commentaires sont retirés avant le
       test, sans quoi une simple mention de « app.messages » dans une phrase
       ferait passer un commentaire pour une dépendance. */
    helperPur: !/\bapp\b/.test(
      extractFn(B, 'preserveCommunications')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, ''),
    ),
    // Aucune collection nouvelle, aucun marqueur persisté.
    pasDeCollectionBis: !/app\.(preservedMessages|communications|sanctuary)/.test(B),
    pasDeChampPersiste: !/\bpreserved\s*:|\bsanctuarized\b|\bkeepOnUndo\b/.test(B),
  };
  note('UNDOCOM-19', arch);
  ok(arch.unSeulRestore && arch.unSeulClone && arch.unSeulSnapshot && arch.unSeulHelper
    && arch.appelsHelper && arch.helperDansRestore,
    'UNDOCOM-19 : il n’existe QU’UN restoreHistoryState(), QU’UN cloneHistoryState(), QU’UN snapshot() et QU’UN helper de préservation — appelé uniquement depuis le point de restauration unique (une définition, un appel)', 'UNDOCOM-19');
  ok(arch.undoSansFusion && arch.redoSansFusion && arch.undoGele && arch.redoGele,
    'UNDOCOM-20 : undo() et redo() sont BYTE-IDENTIQUES à V2.12.0.1 et ne contiennent aucune logique de fusion — ils ne mentionnent ni messages, ni photos, ni le helper. La symétrie vient du point de restauration commun, pas d’un code dupliqué', 'UNDOCOM-20');
  ok(arch.snapshotGele && arch.cloneGele && arch.invalidateGele,
    'UNDOCOM-20 : snapshot(), cloneHistoryState() et invalidateRedo() sont eux aussi byte-identiques — le contrat d’invalidation du Redo n’a PAS été changé', 'UNDOCOM-20');
  ok(arch.helperPur && arch.pasDeCollectionBis && arch.pasDeChampPersiste,
    'UNDOCOM-19 : le helper est PUR — il ne touche jamais `app` — et aucune collection ni aucun champ persistant n’a été inventé pour piloter la règle', 'UNDOCOM-19');

  const donnees = {
    schemaAvant: (A.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    schemaApres: (B.match(/SCHEMA_VERSION = (\d+)/) || [])[1],
    store: (B.match(/STORE = "([^"]+)"/) || [])[1],
    build: (B.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1] === (A.match(/KANVIX_APP_BUILD = "([^"]+)"/) || [])[1],
    migrationGelee: md5(extractFn(A, 'migrateState')) === md5(extractFn(B, 'migrateState')),
    backupGele: md5(extractFn(A, 'buildKanvixBackup')) === md5(extractFn(B, 'buildKanvixBackup'))
      && md5(extractFn(A, 'validateKanvixBackup')) === md5(extractFn(B, 'validateKanvixBackup'))
      && md5(extractFn(A, 'confirmKanvixRestore')) === md5(extractFn(B, 'confirmKanvixRestore')),
  };
  note('UNDOCOM-21', donnees);
  ok(donnees.schemaAvant === '15' && donnees.schemaApres === '15',
    'UNDOCOM-21 : SCHEMA_VERSION reste 15 — aucune donnée persistée nouvelle, aucune migration', 'UNDOCOM-21');
  ok(donnees.store === 'kanvix-product-8-3' && donnees.build,
    'UNDOCOM-22 : STORE reste « kanvix-product-8-3 » et le build est inchangé', 'UNDOCOM-22');
  ok(donnees.migrationGelee && donnees.backupGele,
    'UNDOCOM-22 : migrateState(), buildKanvixBackup(), validateKanvixBackup() et confirmKanvixRestore() sont BYTE-IDENTIQUES', 'UNDOCOM-22');
}

// ============================================================
// FREEZE-21202 — périmètre et absence de changement visuel
// ============================================================
console.log('\n[FREEZE-21202] Périmètre et aucune modification d’interface');
{
  const A = fs.readFileSync(BASE + PREV, 'utf8'), B = fs.readFileSync(BASE + CUR, 'utf8');
  const md5 = (x) => crypto.createHash('md5').update(x).digest('hex').slice(0, 8);
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
  const attendues = ['restoreHistoryState'];
  const ajouteesAttendues = ['preserveCommunications'];
  const parIndentation = ['renderAIPanel'];
  const horsPerimetre = [], ajoutees = [];
  const noms = [...new Set([...B.matchAll(/\n\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))];
  noms.forEach((n) => {
    if (parIndentation.includes(n)) return;
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a && c) { ajoutees.push(n); return; }
    if (a && c && md5(a) !== md5(c) && !attendues.includes(n)) horsPerimetre.push(n);
  });
  const indentDiff = parIndentation.filter((n) => blocIndente(A, n) !== blocIndente(B, n));
  const nonModifiees = attendues.filter((n) => md5(extractFn(A, n) || '') === md5(extractFn(B, n) || ''));
  note('FREEZE-21202-périmètre', { modifiées: attendues, ajoutées: ajoutees, horsPérimètre: horsPerimetre, indentation: indentDiff, nonModifiées: nonModifiees });
  ok(horsPerimetre.length === 0 && indentDiff.length === 0,
    'FREEZE-21202 : hors de restoreHistoryState(), le balayage md5 de TOUT le fichier ne trouve AUCUNE autre fonction modifiée depuis V2.12.0.1', 'FREEZE-21202');
  ok(nonModifiees.length === 0 && JSON.stringify(ajoutees) === JSON.stringify(ajouteesAttendues),
    'FREEZE-21202 : restoreHistoryState() a réellement changé, et la SEULE fonction ajoutée est le helper pur preserveCommunications()', 'FREEZE-21202');

  /* Les moteurs que ce patch n'a pas le droit de toucher, nommés un par un. */
  const geles = [
    'snapshot', 'undo', 'redo', 'cloneHistoryState', 'pushHistory', 'clearUndoRedo',
    'invalidateRedo', 'historyToast', 'actionToast', 'toast', 'refreshHistoryControls',
    'sendConversationMessage', 'sendArtisanMessage', 'openConversation', 'conversationMessages',
    'renderConvDraft', 'convBack', 'artisanMessageBubbles', 'renderArtisan', 'markArtisanRead',
    'addPhoto', 'addFieldPhoto', 'capturePhoto', 'photoCaptureBlock', 'applyPhotoDraft',
    'viewPhoto', 'photoVisual', 'openPhotoForm',
    'gantt', 'planningTasks', 'planReflow', 'applyReflowPlan', 'dropTask', 'dragStart',
    'requestTaskScheduleMove', 'realStartPlan', 'calendarConfirm', 'runCalendarConfirm',
    'setTaskStatus', 'openTask', 'openTaskEdit', 'submitTaskEdit', 'openTaskForm',
    'confirmDeleteTask', 'openFieldTaskModal', 'renderField',
    'taskPrerequisites', 'taskStartReadiness', 'prerequisiteEffectiveStatus',
    'askPrerequisiteStartConfirm', 'confirmPrerequisiteStart', 'cancelPrerequisiteStart',
    'clearTaskEditAck', 'taskPrerequisitesSection', 'openTaskPrerequisites',
    'cloneStructureTree', 'collectStructureSource', 'duplicateStructureNode',
    'applyTemplateToProject', 'buildProjectTemplateRecord', 'templateCaptureScope',
    'migrateState', 'buildKanvixBackup', 'validateKanvixBackup', 'confirmKanvixRestore',
    'exportKanvixData', 'applyImportPlan', 'analyzeKanvixImport', 'buildImportPlan',
    'validateImportState', 'impDroppedLines',
    'normalizeTaskResources', 'taskResourceIds', 'canAssignResource', 'getResourceTasks',
    'ensureTaskControlInstances', 'blockingControlsForTask', 'kanbanBoard', 'kanbanCard',
    'save', 'resetApp', 'render', 'renderPage', 'guardEditable', 'canEditProject',
  ];
  const bouges = [];
  let compares = 0;
  geles.forEach((n) => {
    const a = extractFn(A, n), c = extractFn(B, n);
    if (!a || !c) return;
    compares++;
    if (md5(a) !== md5(c)) bouges.push(`${n} (${md5(a)} → ${md5(c)})`);
  });
  note('FREEZE-21202-gelés', { comparées: compares, bougés: bouges });
  ok(compares > 70 && bouges.length === 0,
    `FREEZE-21202 : les ${compares} moteurs nommément protégés sont BYTE-IDENTIQUES — tout l’Undo/Redo hors restauration, la Messagerie, les Photos, le Planning, les Tâches, les Conditions de démarrage, la Structure, les Modèles, les Ressources, la Qualité, le Kanban, la Sauvegarde et l’Import/Export`, 'FREEZE-21202');

  /* §17 — AUCUNE modification d'interface. On le prouve sur le fichier. */
  const bloc = (src, re) => (src.match(re) || [''])[0];
  const ui = {
    css: md5(bloc(A, /<style id="kanvix-css">[\s\S]*?<\/style>/)) === md5(bloc(B, /<style id="kanvix-css">[\s\S]*?<\/style>/)),
    balisage: md5(bloc(A, /<body[\s\S]*?<script id="kanvix-js">/)) === md5(bloc(B, /<body[\s\S]*?<script id="kanvix-js">/)),
    initial: md5(bloc(A, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)) === md5(bloc(B, /const INITIAL_STATE = \{[\s\S]*?\n      \};/)),
    // Le diff ne touche QU'UNE zone du fichier : celle de l'Undo/Redo.
    octetsAjoutes: B.length - A.length,
  };
  note('FREEZE-21202-interface', ui);
  ok(ui.css && ui.balisage && ui.initial,
    'FREEZE-21202 / §17 : la feuille de style, le balisage <body> et INITIAL_STATE sont BYTE-IDENTIQUES — ce patch ne change rien de visible, ni en clair, ni en sombre, ni sur mobile', 'FREEZE-21202');
}

// ============================================================
const appErrs = allErrs.filter((e) => !/net::|Failed to fetch|open-meteo|geopf|nominatim/.test(e.msg));
/* Posée AVANT le décompte final : le nombre annoncé est EXACTEMENT celui de
   resultats.json. */
ok(appErrs.length === 0, `UNDOCOM-23 : aucune erreur JavaScript applicative en console (${appErrs.length})`, 'UNDOCOM-23');
if (appErrs.length) console.log(JSON.stringify(appErrs.slice(0, 10), null, 1));
console.log('\n' + '='.repeat(60));
console.log(`RÉSULTAT : ${passed} / ${passed + failed.length}`);
if (failed.length) { console.log('ÉCHECS :'); failed.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`ERREURS CONSOLE APPLICATIVES : ${appErrs.length}`);
console.log('='.repeat(60));
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleErrors: appErrs }, null, 2));
await b.close();
process.exit(failed.length ? 1 : 0);
