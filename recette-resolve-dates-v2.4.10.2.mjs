// ============================================================
// KANVIX — Recette : calendrier dynamique des scénarios Résoudre (V2.4.10.2)
//   Vérifie qu'AUCUN scénario runtime ne contient de date métier absolue
//   figée sur le seed d'août 2026, et que « Maintenir le jalon » ≠ « Décaler
//   la chaîne ». Usage : node recette-resolve-dates-v2.4.10.2.mjs
// ============================================================
import pw from '/home/user/Planzy-saas/node_modules/playwright-core/index.js';
import fs from 'fs';
const { chromium } = pw;
const BASE = 'file:///home/user/Planzy-saas/public/poc/kanvix-next-gen-v2.4.10.2.html?now=';
const SHOTS = '/home/user/Planzy-saas/recette-resolve-dates/';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let passed = 0, failed = [];
const results = [];
const ok = (c, name, sec) => { if (c) passed++; else failed.push(`[${sec}] ${name}`); results.push({ sec, name, status: c ? 'PASS' : 'FAIL' }); console.log(`  ${c ? '✓' : '✗'} [${sec}] ${name}`); };
const note = (sec, d) => console.log(`  (info) [${sec}] ${JSON.stringify(d)}`);
const allErrs = [];
async function openAt(now, tag) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => allErrs.push({ where: tag, msg: e.message }));
  p.on('console', (m) => { if (m.type() === 'error') allErrs.push({ where: tag, msg: m.text() }); });
  await p.route('https://api.open-meteo.com/**', (r) => r.abort('failed'));
  await p.route('https://data.geopf.fr/**', (r) => r.abort('failed'));
  await p.goto(BASE + now, { waitUntil: 'load' });
  await p.evaluate(() => setDepth('pilot'));
  return { ctx, p };
}
const ev = (p, f, ...a) => p.evaluate(f, ...a);
// Toutes les dates (start+end) des changements de tous les scénarios runtime.
const scenarioDates = (p) => ev(p, () => {
  const opts = scenarioOptions('windows-delay');
  let d = [];
  opts.forEach((s) => (s.changes || []).forEach((c) => { d.push(c.start); d.push(c.end); }));
  return { dates: d, kwindows: task('k-windows').start, milestone: app.milestones.find((m) => m.projectId === 'keravel')?.date };
});

// RES-DATE-01 — now=2026-09-04 : aucune date août dans un scénario runtime
console.log('\n[RES-DATE-01] now=2026-09-04 — aucune date août');
{
  const { ctx, p } = await openAt('2026-09-04T10:00', 'RD01');
  const r = await scenarioDates(p);
  note('RES-DATE-01', { kwindows: r.kwindows, milestone: r.milestone });
  ok(!r.dates.some((d) => d.startsWith('2026-08')), 'RES-DATE-01 : aucune date d’août dans les scénarios (recalculés sur septembre)', 'RES-DATE-01');
  ok(r.dates.every((d) => d.startsWith('2026-09') || d.startsWith('2026-10')), 'RES-DATE-01 : toutes les dates cohérentes avec septembre', 'RES-DATE-01');
  // §9 — aucun retour dans le passé : aucune date < début courant de k-windows
  ok(r.dates.every((d) => d >= r.kwindows), 'RES-DATE-01 : aucune date runtime antérieure à la date courante (pas de retour dans le passé)', 'RES-DATE-01');
  await p.screenshot({ path: SHOTS + 'res-date-01-sept.png', fullPage: true });
  await ctx.close();
}

// RES-DATE-02 — now=2026-11-12 : scénario cohérent novembre
console.log('\n[RES-DATE-02] now=2026-11-12 — cohérent novembre');
{
  const { ctx, p } = await openAt('2026-11-12T10:00', 'RD02');
  const r = await scenarioDates(p);
  ok(!r.dates.some((d) => d.startsWith('2026-08') || d.startsWith('2026-09')), 'RES-DATE-02 : aucune date août/septembre figée', 'RES-DATE-02');
  ok(r.dates.every((d) => d.startsWith('2026-11') || d.startsWith('2026-12')), 'RES-DATE-02 : dates recalculées autour de novembre', 'RES-DATE-02');
  ok(r.dates.every((d) => d >= r.kwindows), 'RES-DATE-02 : aucun retour dans le passé', 'RES-DATE-02');
  await ctx.close();
}

// RES-DATE-03 — now=2026-08-13 : fonctionnement seed
console.log('\n[RES-DATE-03] now=2026-08-13 — seed');
{
  const { ctx, p } = await openAt('2026-08-13T10:00', 'RD03');
  const r = await ev(p, () => {
    const opts = scenarioOptions('windows-delay');
    const a = opts.find((x) => x.id === 'a'), bb = opts.find((x) => x.id === 'b');
    return { a: !!a && a.changes.length > 0 && a.result?.valid, b: !!bb && bb.changes.length > 0, aDates: a.changes.every((c) => c.start.startsWith('2026-08')), bDates: bb.changes.every((c) => c.start.startsWith('2026-08')) };
  });
  ok(r.a && r.b, 'RES-DATE-03 : les deux scénarios existent et sont calculés sur le seed', 'RES-DATE-03');
  ok(r.aDates && r.bDates, 'RES-DATE-03 : dates cohérentes avec la date de seed (août)', 'RES-DATE-03');
  await ctx.close();
}

// RES-DATE-04 — Maintenir le jalon ≠ Décaler la chaîne
console.log('\n[RES-DATE-04] Maintenir le jalon ≠ Décaler la chaîne');
{
  const { ctx, p } = await openAt('2026-09-04T10:00', 'RD04');
  const r = await ev(p, () => {
    const opts = scenarioOptions('windows-delay');
    const a = opts.find((x) => x.id === 'a'), bb = opts.find((x) => x.id === 'b');
    const mk = app.milestones.find((m) => m.projectId === 'keravel');
    return {
      aFinal: a.result.finalDate, bFinal: bb.result.finalDate,
      aDelay: a.result.projectDelay, bDelay: bb.result.projectDelay,
      milestone: mk.date,
      bHoldsMilestone: bb.result.finalDate <= mk.date,
      changesetEqual: JSON.stringify(a.changes) === JSON.stringify(bb.changes),
    };
  });
  note('RES-DATE-04', r);
  ok(r.aFinal !== r.bFinal && !r.changesetEqual, 'RES-DATE-04 : les deux scénarios ont une date finale / des changements différents', 'RES-DATE-04');
  ok(r.bHoldsMilestone && r.bDelay <= r.aDelay, 'RES-DATE-04 : « Maintenir le jalon » tient réellement la date du jalon (retard ≤ « Décaler la chaîne »)', 'RES-DATE-04');
  await ctx.close();
}

// RES-DATE-05 — startWhatIf(done) → aucun scénario créé
console.log('\n[RES-DATE-05] startWhatIf(done) — garde défensive');
{
  const { ctx, p } = await openAt('2026-09-04T10:00', 'RD05');
  const r = await ev(p, () => {
    task('k-final').status = 'done'; save();
    startWhatIf('k-final', 2);
    const viaShow = (() => { showWhatIf('k-final'); return document.querySelector('#modal').classList.contains('open'); })();
    return { simulation: app.simulation, whatIfModal: viaShow };
  });
  ok(r.simulation === null, 'RES-DATE-05 : startWhatIf(doneTask) ne crée aucune simulation', 'RES-DATE-05');
  ok(!r.whatIfModal, 'RES-DATE-05 : showWhatIf(doneTask) n’ouvre pas non plus de simulation', 'RES-DATE-05');
  await ctx.close();
}

// RES-DATE-06 — application d'un scénario runtime respecte les protections
console.log('\n[RES-DATE-06] Application scénario runtime (sûr)');
{
  const { ctx, p } = await openAt('2026-11-12T10:00', 'RD06');
  const r = await ev(p, () => {
    const bb = scenarioOptions('windows-delay').find((x) => x.id === 'b');
    app.simulation = bb;
    const u = app.undoStack.length;
    applySimulation();
    const T = new Set(app.tasks.map((t) => t.id));
    const orphan = app.tasks.some((t) => (t.deps || []).some((d) => !T.has(d)));
    return { applied: app.undoStack.length === u + 1, orphan, valid: validateImportState().ok };
  });
  ok(r.applied && !r.orphan && r.valid, 'RES-DATE-06 : un scénario runtime s’applique proprement (1 Undo, 0 orpheline, état valide)', 'RES-DATE-06');
  await ctx.close();
}

await b.close();
const uniq = [...new Map(allErrs.map((e) => [e.msg, e])).values()];
const appErrs = uniq.filter((e) => !/net::ERR_|ERR_TUNNEL|Failed to load resource/.test(e.msg));
ok(appErrs.length === 0, 'CONSOLE : 0 erreur JavaScript applicative', 'CONSOLE');
console.log('\n==== ' + passed + ' passed, ' + failed.length + ' failed ====');
if (failed.length) console.log('FAILED:\n' + failed.join('\n'));
console.log(appErrs.length ? 'ERREURS APP:\n' + appErrs.map((e) => e.msg).join('\n') : '=== 0 erreur console applicative ===');
fs.writeFileSync(SHOTS + 'resultats.json', JSON.stringify({ passed, failed, results, consoleApp: appErrs }, null, 2));
process.exit(0);
