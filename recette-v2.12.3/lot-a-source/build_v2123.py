#!/usr/bin/env python3
# Construit kanvix-next-gen-v2.12.3.html à partir de la base certifiée V2.12.2.1.
# Chaque remplacement exige EXACTEMENT une occurrence de l'ancre : sinon échec.
import sys, pathlib

T = pathlib.Path(__file__).resolve().parent
REPO = pathlib.Path(__file__).resolve().parents[2]
SRC = REPO / 'public/poc/kanvix-next-gen-v2.12.2.1.html'
DST = REPO / 'public/poc/kanvix-next-gen-v2.12.3.html'

s = SRC.read_text(encoding='utf-8')
log = []

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f'ÉCHEC [{label}] : {n} occurrence(s) de l\'ancre (attendu 1)\n---\n{old[:200]}')
    s = s.replace(old, new, 1)
    log.append(label)

core = (T / 'lotA-core.js').read_text(encoding='utf-8')
ui = (T / 'lotA-ui.js').read_text(encoding='utf-8')
css = (T / 'lotA.css').read_text(encoding='utf-8')

# ── Version / schéma ────────────────────────────────────────────────────────
rep('      const SCHEMA_VERSION = 15;', '      const SCHEMA_VERSION = 16;', 'schema 15→16')
rep('<link rel="icon" href="data:" />',
    '<link rel="icon" href="data:" />\n    <meta name="kanvix-version" content="2.12.3" />', 'meta version')

# ── Données de démonstration ────────────────────────────────────────────────
rep('{ id: "lot-plomberie", name: "Plomberie", colorKey: "cyan", defaultTrade: "Plombier", order: 80, active: true, createdAt: "2026-08-13T09:00" },',
    '{ id: "lot-plomberie", name: "Plomberie", colorKey: "cyan", defaultTrade: "Plombier", order: 80, active: true, createdAt: "2026-08-13T09:00" },\n'
    '          { id: "lot-sanitaire", name: "Sanitaire", colorKey: "teal", defaultTrade: "Installateur sanitaire", order: 85, active: true, createdAt: "2026-08-13T09:00" },',
    'demo lot sanitaire')
rep('            contactName: "Yann Le Gall",\n            status: "active",',
    '            contactName: "Yann Le Gall",\n            activityLotIds: ["lot-electricite"],\n            status: "active",',
    'demo Le Gall mono-activité')
rep('          // --- V2.5 : MATÉRIEL',
    '          // V2.12.3 — entreprise MULTI-ACTIVITÉS de démonstration.\n'
    '          {\n'
    '            id: "ouest-fluides",\n'
    '            name: "Ouest Fluides & Énergie",\n'
    '            scope: "Externe",\n'
    '            type: "company",\n'
    '            capacity: 2,\n'
    '            phone: "02 98 55 66 77",\n'
    '            email: "contact@ouest-fluides.test",\n'
    '            contactName: "Nadia Kerloc’h",\n'
    '            activityLotIds: ["lot-electricite", "lot-plomberie", "lot-sanitaire"],\n'
    '            status: "active",\n'
    '          },\n'
    '          // --- V2.5 : MATÉRIEL',
    'demo Ouest Fluides')

# ── Migration ───────────────────────────────────────────────────────────────
rep('      function migrateState(value) {', core + '      function migrateState(value) {', 'noyau pur avant migrateState')
rep('if (r[key] === undefined) r[key] = structuredClone(val);',
    '// V2.12.3 — les activités ne sont JAMAIS recopiées de la démo dans un état\n'
    '                // existant : ce serait une inférence (voir migrateCompanyActivities).\n'
    '                if (key !== "activityLotIds" && r[key] === undefined) r[key] = structuredClone(val);',
    'V4.6 sans injection activités')
rep('        value.ui.planningLot = value.ui.planningLot || "all";',
    '        // --- V2.12.3 (migration 15 → 16) : ACTIVITÉS D\'ENTREPRISE -----------\n'
    '        // Après la normalisation des lots (elle en a besoin), avant tout usage.\n'
    '        migrateCompanyActivities(value);\n'
    '        if (\n'
    '          typeof value.ui.teamActivityFilter !== "string" ||\n'
    '          (value.ui.teamActivityFilter !== "all" && !value.lots.some((l) => l.id === value.ui.teamActivityFilter))\n'
    '        )\n'
    '          value.ui.teamActivityFilter = "all";\n'
    '        value.ui.planningLot = value.ui.planningLot || "all";',
    'appel migration')

# ── Cycle de vie d'un lot : une activité d'entreprise est une référence ────
rep('            0,\n          ),\n        };\n      }\n      function canDeleteLot(id) {\n        let r = lotReferences(id);\n        return r.tasks + r.templates === 0;\n      }',
    '            0,\n          ),\n          // V2.12.3 — une activité d\'entreprise référence le lot.\n'
    '          resources: (app.resources || []).filter((x) => (x.activityLotIds || []).includes(id)).length,\n'
    '        };\n      }\n      function canDeleteLot(id) {\n        let r = lotReferences(id);\n        return r.tasks + r.templates + r.resources === 0;\n      }',
    'lotReferences + canDeleteLot')
rep('used = refs.tasks + refs.templates,', 'used = refs.tasks + refs.templates + refs.resources,', 'compteur usages lot')
rep('est utilisé par ${r.tasks} intervention${r.tasks > 1 ? "s" : ""}${r.templates ? ` et ${r.templates} étape${r.templates > 1 ? "s" : ""} de modèle` : ""}.',
    'est utilisé par ${lotUsageText(r)}.', 'message refus suppression lot')
rep('n’est utilisé par aucune intervention ni aucun modèle.',
    'n’est utilisé par aucune intervention, aucun modèle ni aucune entreprise.', 'message confirmation suppression lot')

# ── Interface ───────────────────────────────────────────────────────────────
rep('      function openResourceForm(editId = "") {', ui + '      function openResourceForm(editId = "") {', 'bloc UI avant openResourceForm')
rep('`<div id="companyFields" style="display:${show ? "grid" : "none"};gap:12px">` +',
    '`<div id="companyFields" style="display:${show ? "grid" : "none"};gap:12px">` +\n'
    '            activityPickerHTML(r?.activityLotIds) +',
    'formulaire : sélecteur')
rep('                r.contactName = f.get("contactName") || undefined;\n                r.capacity = Math.max(1, +f.get("capacity") || 1);\n              }',
    '                r.contactName = f.get("contactName") || undefined;\n                r.capacity = Math.max(1, +f.get("capacity") || 1);\n                applyCompanyActivities(r, f);\n              }',
    'formulaire : édition')
rep('              else\n                app.resources.push({\n                  ...base,\n                  capacity: Math.max(1, +f.get("capacity") || 1),\n                  contactName: f.get("contactName") || undefined,\n                });',
    '              else {\n                let company = {\n                  ...base,\n                  capacity: Math.max(1, +f.get("capacity") || 1),\n                  contactName: f.get("contactName") || undefined,\n                  activityLotIds: [],\n                };\n                app.resources.push(company);\n                applyCompanyActivities(company, f);\n              }',
    'formulaire : création')

# Équipe : recherche + filtre
rep('        if (kind !== "all") filtered = filtered.filter(({ r }) => r.type === kind);',
    '        if (kind !== "all") filtered = filtered.filter(({ r }) => r.type === kind);\n'
    '        // V2.12.3 — recherche (nom, activité…) et filtre d\'activité. Le filtre\n'
    '        // d\'activité ne retient que les ENTREPRISES qui exercent cette activité.\n'
    '        let actFilter = teamEffectiveActivityFilter();\n'
    '        if (actFilter !== "all")\n'
    '          filtered = filtered.filter(({ r }) => r.type === "company" && (r.activityLotIds || []).includes(actFilter));\n'
    '        if (teamQuery.trim()) filtered = filtered.filter(({ r }) => resourceMatchesTeamSearch(r, teamQuery));',
    'équipe : filtres')
rep('            : type === "external"\n              ? empty("Aucune ressource externe",',
    '            : teamQuery.trim() || actFilter !== "all"\n'
    '              ? empty("Aucun résultat", "Aucune ressource ne correspond à la recherche ou à l’activité choisie.") +\n'
    '                `<div class="team-actions"><button class="link" onclick="resetTeamSearch()">Effacer la recherche</button></div>`\n'
    '              : type === "external"\n              ? empty("Aucune ressource externe",',
    'équipe : état vide')
rep(')}</div></div>${pilot && archivedResources.length ?',
    ')}</div></div>${teamSearchFilters(actFilter)}${pilot && archivedResources.length ?',
    'équipe : contrôles')
rep('<div class="tc-id"><h3>${esc(r.name)}${unreadBadge}</h3><p>${r.scope} · ${typeLabel}</p></div><div class="tc-mission">${block}${reasonLine}</div>',
    '<div class="tc-id"><h3>${esc(r.name)}${unreadBadge}</h3><p>${r.scope} · ${typeLabel}</p>${isCompany ? activityChipsHTML(r, 2) : ""}</div><div class="tc-mission">${block}${reasonLine}</div>',
    'carte équipe')
rep('<div class="tc-id"><h3>${esc(r.name)}${unreadBadge}</h3><p>${r.scope} · ${typeLabel}</p></div><div class="tc-mission">${block}</div>',
    '<div class="tc-id"><h3>${esc(r.name)}${unreadBadge}</h3><p>${r.scope} · ${typeLabel}</p>${r.type === "company" ? activityChipsHTML(r, 2) : ""}</div><div class="tc-mission">${block}</div>',
    'carte équipe chantier')
rep('<p>${r.scope} · ${resourceKindLabel(r)}</p>',
    '<p>${r.scope} · ${resourceKindLabel(r)}${r.type === "company" && activitySummaryText(r) ? " · " + esc(activitySummaryText(r)) : ""}</p>',
    'ligne ressource')
rep('${[r.jobTitle, r.companyName].filter(Boolean).map(esc).join(" · ") || (resourceKindLabel(r))}',
    '${[r.jobTitle, r.companyName, activitySummaryText(r)].filter(Boolean).map(esc).join(" · ") || (resourceKindLabel(r))}',
    'archives')

# Formulaires d'affectation
rep('${r.id === currentId ? "selected" : ""}>${esc(r.name)}${resourceActive(r) ? "" : " (archivée)"}</option>',
    '${r.id === currentId ? "selected" : ""}>${esc(r.name)}${r.type === "company" && activitySummaryText(r) ? " — " + esc(activitySummaryText(r)) : ""}${resourceActive(r) ? "" : " (archivée)"}</option>',
    'sélecteur intervenant principal')
rep('${selectedId === r.id ? "selected" : ""}>${esc(r.name)}${resourceActive(r) ? "" : " (archivée)"}</option>',
    '${selectedId === r.id ? "selected" : ""}>${esc(r.name)}${r.type === "company" && activitySummaryText(r) ? " — " + esc(activitySummaryText(r)) : ""}${resourceActive(r) ? "" : " (archivée)"}</option>',
    'filtre ressource du planning')
rep('${resourceAvatar(r, true)}<span>${esc(r.name)}</span></label>',
    '${resourceAvatar(r, true)}<span>${esc(r.name)}${r.type === "company" && activitySummaryText(r) ? ` <small class="muted">${esc(activitySummaryText(r))}</small>` : ""}</span></label>',
    'sélecteur renforts')

# Fiche
rep('        // Contact : seulement les infos disponibles',
    '        // V2.12.3 — activités d\'une entreprise : liste COMPLÈTE (jamais « +N » ici).\n'
    '        let activitiesBlock = isCompany\n'
    '          ? `<div class="drawer-section"><h3>Activités / corps d’état</h3>${companyActivityLots(r).length ? activityChipsHTML(r) : `<p class="muted">Aucune activité renseignée.</p>`}</div>`\n'
    '          : "";\n'
    '        // Contact : seulement les infos disponibles',
    'fiche : bloc')
rep('          equipmentBlock +\n          contactBlock +', '          equipmentBlock +\n          activitiesBlock +\n          contactBlock +', 'fiche : insertion')

# Recherche globale (palette)
rep('label: r.name,\n            meta: r.scope,',
    'label: r.name,\n            meta: [r.scope, activitySummaryText(r, 99)].filter(Boolean).join(" · "),',
    'palette')

# CSS : juste avant la fermeture de la feuille kanvix-css
i = s.index('<style id="kanvix-css">')
j = s.index('</style>', i)
s = s[:j] + css + '    ' + s[j:]
log.append('css')

DST.write_text(s, encoding='utf-8')
print('OK —', len(log), 'modifications :')
for l in log:
    print('  ·', l)
print('taille', len(s), 'octets ; lignes', s.count('\n'))
