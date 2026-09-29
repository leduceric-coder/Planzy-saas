#!/usr/bin/env python3
# Construit le PROTOTYPE « Bilan des retards » à partir de la version produit V2.12.3.
# Chaque remplacement exige EXACTEMENT une occurrence de l'ancre : sinon échec.
import sys, pathlib

T = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path(__file__).resolve().parents[2]
SRC = REPO / 'public/poc/kanvix-next-gen-v2.12.3.html'
DST = REPO / 'public/poc/kanvix-next-gen-v2.12.3-bilan-retards-prototype.html'

s = SRC.read_text(encoding='utf-8')
log = []

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f'ÉCHEC [{label}] : {n} occurrence(s) de l\'ancre (attendu 1)\n---\n{old[:200]}')
    s = s.replace(old, new, 1)
    log.append(label)

core = (T / 'lotB-core.js').read_text(encoding='utf-8')
ui = (T / 'lotB-ui.js').read_text(encoding='utf-8')
css = (T / 'lotB.css').read_text(encoding='utf-8')

# Identité du prototype ------------------------------------------------------
rep('<title>Kanvix — Piloter simplement</title>', '<title>Kanvix — Prototype · Bilan des retards</title>', 'titre')
rep('<meta name="kanvix-version" content="2.12.3" />',
    '<meta name="kanvix-version" content="2.12.3-bilan-retards-prototype" />', 'meta version')
# Le prototype ne partage PAS son stockage avec le produit : ouvert dans le même
# navigateur, il ne doit ni lire ni écraser l'état de la V2.12.3 certifiable.
rep('STORE = "kanvix-product-8-3",', 'STORE = "kanvix-proto-bilan-retards-8-3",', 'clé de stockage isolée')

# Code du prototype (noyau + interface), avant renderProject ----------------
rep('      function renderProject() {', core + ui + '      function renderProject() {', 'bloc prototype')

# Accès clair depuis la fiche chantier --------------------------------------
rep('sum.setupNeeded ? `<p class="headline">Votre chantier est prêt.</p>` : ""}',
    'sum.setupNeeded ? `<p class="headline">Votre chantier est prêt.</p>` : ""}\n'
    '                  <button type="button" class="btn small dly-entry" onclick="openDelaysBilan(\'${p.id}\')">Bilan des retards</button>',
    'accès depuis la fiche chantier')

# Route interne « delays » (aucune entrée de barre latérale) ------------------
rep('            structure: renderStructureNode,',
    '            structure: renderStructureNode,\n'
    '            // PROTOTYPE — route INTERNE du bilan des retards : on y entre depuis\n'
    '            // la fiche chantier, aucune entrée de barre latérale n\'est ajoutée.\n'
    '            delays: renderDelays,',
    'route interne')
rep('(x[0] === "sites" && app.ui.page === "operation")',
    '(x[0] === "sites" && (app.ui.page === "operation" || app.ui.page === "delays"))',
    'navigation : Chantiers reste allumé')

# CSS ----------------------------------------------------------------------
i = s.index('<style id="kanvix-css">')
j = s.index('</style>', i)
s = s[:j] + css + '    ' + s[j:]
log.append('css')

DST.write_text(s, encoding='utf-8')
print('OK —', len(log), 'modifications :')
for l in log:
    print('  ·', l)
