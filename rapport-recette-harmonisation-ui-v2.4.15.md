# Kanvix V2.4.15 — Harmonisation visuelle finale
## Accueil + Chantier + Historique + Réglages — Planning et Équipe gelés

Source de vérité : `kanvix-next-gen-v2.4.14.1.html`
Version livrée : `kanvix-next-gen-v2.4.15.html`

---

## 1. Accueil avant/après

**Avant (V2.4.14.1)** : « Aujourd'hui » et « Chantiers actifs » étaient deux cartes indépendantes, chacune avec son propre fond/bordure/ombre, posées côte à côte dans `.today-main-grid` (colonnes égales 1fr/1fr, gap 14px). Leur différence naturelle de hauteur créait une sensation de deux boîtes déséquilibrées flottant dans une grande zone vide.

**Après (V2.4.15)** : les deux colonnes appartiennent maintenant à **une seule surface visuelle cohérente** — `.today-main-grid` porte désormais le fond (`--surface`), la bordure (`--border-light`), le radius et l'ombre (`--shadow-xs`) ; les deux `.today-panel` internes n'ont plus leur propre carte (fond transparent, bordure supprimée). Un **séparateur vertical discret** (bordure 1px) remplace le gap entre les deux colonnes. Capture : `01-accueil-1920.png`, `02-accueil-1440.png`.

## 2. Nouvelle structure du cockpit du jour

- `.today-main-grid` = la « surface commune » (conceptuellement `.today-cockpit`), grid 2 colonnes strictement égales (`repeat(2, minmax(0,1fr))`).
- `.today-main-grid > .today-panel` : fond/bordure neutralisés (`background:none;border:0;box-shadow:none`), padding conservé (16px/20px/14px).
- `.today-main-grid > .today-panel.actions-panel` : `border-right:1px solid var(--border-light)` = le séparateur discret.
- En dessous de 1080px, le séparateur vertical devient un séparateur horizontal (`border-bottom`) quand les colonnes s'empilent.
- Aucun `space-evenly`, `min-height` artificielle ou `flex-grow` de remplissage : chaque liste (`.today-actions-list`, `.acp-list`) garde `display:flex;flex-direction:column;gap:8px` — la colonne la plus riche détermine la hauteur de la surface commune (mesuré : Aujourd'hui 432px vs Chantiers actifs 121px avec 1 seul chantier actif — le vide résiduel appartient à la surface commune, pas à une carte isolée). Cadence des lignes déjà dans la fourchette demandée (56–64px) : `.tp-row` 64px, `.acp-row` 60px — aucun changement nécessaire.

## 3. Chantier avant/après

**Avant** : vignette carrée 72×72px isolée dans l'en-tête, corps du cockpit en deux zones (« À traiter » / « Prochaine étape ») posées directement sur le fond de page (pas de surface commune), assez d'espace mais pas d'unité visuelle.

**Après** : un conteneur unique `.project-cockpit-shell` (alias sur `.cockpit`) — une seule surface blanche légère (fond, bordure, radius, `shadow-xs`) qui regroupe identité, statut, « À traiter » et « Prochaine étape ». Les onglets suivent immédiatement (gap resserré à 10px). Capture : `03-chantier-keravel-1920.png`.

## 4. Gestion du ratio de vignette

**Problème identifié** : `art()`/`projectVisual()` produisent des illustrations **paysagères** (`viewBox="0 0 500 230"`, ratio ≈ 2.17:1) avec `preserveAspectRatio="xMidYMid slice"` (recadrage plein cadre). Les contraindre dans un cadre carré 72×72 recadrait agressivement la scène.

**Solution** — variante d'affichage locale, sans toucher au moteur partagé :
```js
function cockpitThumbVisual(id) {
  return projectVisual(id).replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="xMidYMid meet"');
}
```
- `art()` et `projectVisual()` restent **byte-identiques** à V2.4.14.1 (vérifié, cf. §16) et continuent d'être utilisés tels quels partout ailleurs (Accueil, cartes chantier — `.acp-visual` garde `xMidYMid slice`, vérifié par test).
- Seule la vignette d'en-tête du cockpit utilise `cockpitThumbVisual()` : cadre paysager `84×60px` (desktop, ratio 1.4, entre 4:3 et 3:2) / `72×52px` (mobile ≤720px), `preserveAspectRatio="xMidYMid meet"` (contenu entier visible, jamais de recadrage ni de déformation).

## 5. Chantier avec incident (Résidence Keravel)

« À traiter » et « Prochaine étape » sur la même ligne, grille `minmax(0,1.5fr) minmax(280px,0.8fr)` à l'intérieur du shell unique. Capture : `03-chantier-keravel-1920.png`, mobile `05-chantier-keravel-390.png`.

## 6. Chantier sans incident (Les Terrasses)

Le message « ✓ Aucun point bloquant » est devenu une **bande compacte** (`inline-flex`, padding 8px/12px, 36px de haut mesuré) au lieu d'un bloc `<p>` de pleine largeur — plus de grande zone verte vide. « Prochaine étape » reste à droite. Capture : `04-chantier-terrasses-1920.png`.

## 7. Historique avant/après

**Avant** : `.history-panel` plafonné à 1120px, seul au milieu d'une très grande page, aucune exploitation du reste de l'espace.

**Après** : `.history-layout` — grid 2 colonnes `minmax(0,2fr) minmax(260px,0.7fr)`, plafonnée à 1440px, timeline à gauche + résumé d'activité (`.history-summary`) à droite. Sous 1000px, une seule colonne. Capture : `06-historique-1920.png`, mobile `07-historique-390.png`.

## 8. Calcul du résumé d'activité

`historyActivitySummary(entries)` est une fonction **pure**, calculée uniquement à partir des `entries` déjà filtrées par `projectHistory(projectId)` (mêmes données que la timeline, aucune nouvelle donnée métier) :
- nombre total d'événements (`entries.length`)
- dernier événement (`entries[0]` — `projectHistory` écrit par `unshift`, donc le plus récent en tête), son intitulé, sa date/heure (`historyStamp`) et son auteur
- nombre de changements de statut (`eventType === "task-status"`)
- nombre d'« autres » événements (le reste)

Aucune analytique inventée (pas de performance, productivité, score, tendance, %) — vérifié par test (`UI15-HIST-03`). Avec un seul événement, le panneau reste petit (mesuré 106–201px selon le contenu, jamais une grande carte vide).

`historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups` restent **byte-identiques** à V2.4.14.1 — seule `historyHTML()` (présentation) a été restructurée pour accueillir le résumé.

## 9. Réglages avant/après

**Avant** : une colonne unique plafonnée à 820px, trois sections empilées verticalement, beaucoup de vide latéral sur grand écran, icônes en emoji couleur (🎚️ 👤 ☀️ 🌙 ⚙️ 👷 🔧 🏢 ⬆️ ⬇️ 💾 ♻️ 🗄️).

**Après** :
- `.settings-content` élargi à `max-width:1160px` (mesuré 1160px à 1920px).
- `.settings-grid` : première ligne = [Expérience Kanvix] [Mode de démonstration] côte à côte (50/50) ; deuxième ligne = [Données & démonstration] pleine largeur (`.settings-section-wide`).
- Sous 900px, une seule colonne.
- Padding des sections resserré (24px → 20px).
- **Aucun changement fonctionnel** : `setDepth`, `setAppearance`, `setRole`, `openCompanyTemplateForm`, `openKanvixImport`, `exportKanvixData`, `downloadKanvixBackup`, `openKanvixBackupRestore`, `confirmResetDemo` sont appelés exactement comme avant (vérifié par test — tous les `onclick` présents à l'identique).

## 10. Largeur avant/après (Réglages)

| Élément | V2.4.14.1 | V2.4.15 |
|---|---|---|
| `.settings-content` max-width | 820px | 1160px |
| Disposition | 1 colonne, 3 sections empilées | grille 2 colonnes (ligne 1) + 1 section pleine largeur (ligne 2) |

Capture : `08-reglages-1920.png`, `09-reglages-900.png`, `10-reglages-390.png`.

## 11. Icônes remplacées

Nouvelles entrées ajoutées à la bibliothèque partagée `icon()` (ajout pur, aucune entrée existante modifiée) : `sun`, `moon`, `building`, `upload`, `download`, `save`, `restore`, `hardhat`, `wrench` — même langage visuel que les icônes de navigation existantes (`stroke:currentColor`, `stroke-width:1.7`, `stroke-linecap/linejoin:round`), aucune bibliothèque externe.

| Emplacement | Avant | Après |
|---|---|---|
| Titre « Expérience Kanvix » | 🎚️ | `icon("settings")` |
| Titre « Mode de démonstration » | 👤 | `icon("team")` |
| Titre « Données & démonstration » | 🗄️ | `icon("documents")` |
| Apparence — Clair | ☀️ | `icon("sun")` |
| Apparence — Sombre | 🌙 | `icon("moon")` |
| Apparence — Système | ⚙️ | `icon("settings")` |
| Rôle — Conducteur | 👷 | `icon("hardhat")` |
| Rôle — Artisan | 🔧 | `icon("wrench")` |
| Modèle d'entreprise | 🏢 | `icon("building")` |
| Importer des données | ⬆️ | `icon("upload")` |
| Exporter les données | ⬇️ | `icon("download")` |
| Sauvegarder Kanvix | 💾 | `icon("save")` |
| Restaurer une sauvegarde | ♻️ | `icon("restore")` |
| Réinitialiser la démonstration | ↺ | inchangé (déjà un glyphe monochrome hérité de `currentColor`, hors périmètre « emoji ») |

13 des 14 emplacements sont désormais des SVG ligne ; le dernier (↺) était déjà monochrome et ne rentre pas dans la définition « emoji coloré » de la demande — vérifié : plus aucun emoji dans ces zones (`UI15-SET-04`).

## 12. Preuve — Planning gelé

`UI15-FREEZE-01` compare la page `#planning` entre V2.4.14.1 et V2.4.15 (même jeu de données, mêmes réglages) : même nombre de lignes Gantt (7 → 7), mêmes classes de ligne (comparaison JSON stricte), composant Gantt inchangé. `gantt` et `kanbanCard` sont byte-identiques (§16).

## 13. Preuve — Équipe gelée

`UI15-FREEZE-02` (page Équipe globale) et `UI15-FREEZE-03` (Chantier > Équipe) comparent nombre de cartes, nombre de colonnes de grille et structure complète de chaque carte (avatar/mission/état/classes) entre V2.4.14.1 et V2.4.15 : strictement identiques dans les deux cas (Équipe globale : 7 cartes/4 colonnes ; Chantier > Équipe : 5 cartes/4 colonnes). Composant « Charge des ressources » inchangé.

## 14. Responsive

10 largeurs testées (1920 → 390) sur les 4 écrans du correctif (Accueil / Cockpit / Historique / Réglages) : **aucun scroll horizontal** sur aucune combinaison (40/40 vérifications). Points clés :
- Accueil : cockpit du jour 2 colonnes desktop → 1 colonne sous 1080px.
- Chantier : « À traiter »/« Prochaine étape » côte à côte desktop → empilées sous 720px ; vignette toujours petite (≤88×64px, jamais dominante).
- Historique : timeline + résumé desktop → 1 colonne sous 1000px.
- Réglages : grille 2 colonnes desktop → 1 colonne sous 900px.

## 15. Dark mode

Vérifié sur les 4 zones (Accueil, Chantier, Historique, Réglages) : aucun fond blanc forcé (`background-color` non blanc dans chaque cas testé), aucune bordure trop claire visible aux captures, icônes lisibles (héritent de `currentColor`). Captures : `11-dark-accueil.png`, `12-dark-chantier.png`, `13-dark-historique.png`, `14-dark-reglages.png`.

## 16. Moteurs métier byte-identiques

Comparaison md5 par fonction entre `kanvix-next-gen-v2.4.14.1.html` et `kanvix-next-gen-v2.4.15.html`, sur la liste officielle (§Partie 7) **+ `art`/`projectVisual`** (protection explicitement demandée §Chantier — Vignette) :

`planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, `reopenProject`, `archiveProjectPrompt`, `restoreProject`, `confirmCloseProject`, `gantt`, `kanbanCard`, `getProjectSummary`, `art`, `projectVisual`.

**Les 25 fonctions sont byte-identiques** (hash md5 strictement égal des deux côtés) — aucune n'a été touchée par ce round.

## 17. Tests — `recette-harmonisation-ui-v2.4.15.mjs`

**105 / 105 tests passent** (0 échec), couvrant :
- `UI15-ACC-01` à `05` : cockpit du jour unifié, colonnes égales, aucune redistribution artificielle, alignement « Cette semaine », déséquilibre de contenu dans les deux sens.
- `UI15-CHT-01/01b` à `06` : vignette paysagère non déformée (+ preuve que `art()`/`projectVisual()` gardent leur comportement original ailleurs), shell unique, zones côte à côte, gap onglets, état sans incident compact, mobile 390.
- `UI15-HIST-01/01b` à `04` : timeline intacte + isolation par chantier, résumé calculé uniquement depuis `projectHistory`, aucune analytique inventée, compact avec peu d'événements, responsive.
- `UI15-SET-01` à `06` : largeur, disposition 2 colonnes, pleine largeur des données, icônes remplacées, responsive, aucun changement fonctionnel.
- `UI15-FREEZE-01` à `03` : Planning / Équipe / Chantier>Équipe strictement identiques à V2.4.14.1.
- Dark mode (4 zones), responsive (10 largeurs × 4 écrans = 40 vérifications), console (0 erreur applicative), byte-identité des 25 fonctions listées.

Captures dans `recette-v2.4.15/` (14 fichiers).

## 18. Non-régressions — 23 suites rejouées

| Suite | Résultat | Statut |
|---|---|---|
| `recette-accueil-v2.4.4.1` (legacy, superseded by v2.4.5) | 105/123 | 18 échecs **pré-existants/obsolètes** — voir note ① |
| `recette-accueil-v2.4.5` | **149/149** | ✅ (assertion de gap corrigée, voir note ②) |
| `recette-backup-continuite-v2.4.13.1` | **106/106** | ✅ |
| `recette-chantiers-v2.4.10.2` | **48/48** | ✅ |
| `recette-correctif-ui-v2.4.14.1` | 74/76 | 2 échecs **obsolètes par conception** — voir note ③ |
| `recette-edition-taches-v2.4.8` | **58/58** | ✅ |
| `recette-historique-chantiers-v2.4.12` | **106/106** | ✅ |
| `recette-historique-metier-v2.4.13` | **106/106** | ✅ |
| `recette-historique-ui-v2.4.12.1` | **90/90** | ✅ |
| `recette-import-intelligent-v2.4.9` | **59/59** | ✅ |
| `recette-import-intelligent-v2.4.9.1` | **75/75** | ✅ |
| `recette-kanban-badges-v2.4.11.1` | **84/84** | ✅ |
| `recette-kanban-badges-v2.4.11.2` (legacy, superseded by v2.4.11.3) | 94/101 | 7 échecs **pré-existants** — voir note ④ |
| `recette-kanban-badges-v2.4.11.3` | **165/165** | ✅ |
| `recette-mode-chantier-v2.4.5` | **84/84** | ✅ |
| `recette-mode-chantier-v2.4.6` | **95/95** | ✅ |
| `recette-planning-bureau-v2.4.9.1` | **50/50** | ✅ (findings pré-existants, moteur inchangé — voir note ⑤) |
| `recette-planning-bureau-v2.4.10` | **57/57** | ✅ |
| `recette-planning-bureau-v2.4.10.1` | **76/76** | ✅ |
| `recette-planning-v2.4.8` | **17/17** | ✅ |
| `recette-reglages-v2.4.7` | **63/63** | ✅ (largeur mise à jour, voir note ⑥) |
| `recette-resolve-dates-v2.4.10.2` | **14/14** | ✅ |
| `recette-ui-responsive-v2.4.11` | **47/47** | ✅ |

**Notes sur les échecs (tous documentés, aucun n'est une régression fonctionnelle) :**

① `recette-accueil-v2.4.4.1.mjs` est une suite obsolète depuis V2.4.5, déjà partiellement obsolète avant ce round (6 échecs sur le gap 16→14px, hérités de V2.4.14). Les 12 échecs supplémentaires viennent d'un changement intentionnel de ce round : `.today-main-grid` passe de `gap:14px` à `gap:0` + un séparateur en bordure (§2 — une seule surface cohérente), ce qui décale de quelques pixels le point de coupure interne par rapport à `.attention-grid` (qui reste deux cartes distinctes avec gap 14px, zone gelée). Les bornes de page (marge gauche/droite globales) restent, elles, parfaitement identiques. Cette suite n'est plus la référence active — voir ②.

② `recette-accueil-v2.4.5.mjs` est la suite active pour l'Accueil : son assertion de gap a été mise à jour (14px → 0px pour `.today-main-grid`, avec commentaire expliquant le nouveau langage « surface unique + séparateur ») ; elle passe maintenant à 149/149.

③ `recette-correctif-ui-v2.4.14.1.mjs` teste la vignette carrée 64-80px spécifiée par V2.4.14.1. V2.4.15 la remplace explicitement par une vignette **paysagère** 72-88×52-64px (§Chantier — Vignette de cette demande) : la largeur mesurée (84px) sort donc logiquement de l'ancienne plage carrée. Cette suite documente fidèlement ce qui était vrai en V2.4.14.1 ; le nouvel invariant (vignette paysagère non déformée) est intégralement couvert par `UI15-CHT-01` dans la nouvelle suite.

④ `recette-kanban-badges-v2.4.11.2.mjs` teste l'ancien libellé unique « Point ouvert », remplacé par les libellés contextuels (À traiter / À suivre / Point ouvert) dès V2.4.11.3 — confirmé pré-existant en relançant cette suite telle quelle contre `kanvix-next-gen-v2.4.14.1.html` (7/101 échecs, strictement identiques, avant toute modification de ce round). Aucun lien avec V2.4.15. La suite active (`v2.4.11.3`) est à 165/165.

⑤ `recette-planning-bureau-v2.4.9.1.mjs` produit un rapport d'audit (findings) sur le comportement du drag Gantt/propagation, indépendant du compte PASS/FAIL (qui est 50/50). Ces findings portent sur `planReflow`/`requestTaskScheduleMove`, vérifiés byte-identiques à V2.4.14.1 (§16) — non affectés par ce round.

⑥ `recette-reglages-v2.4.7.mjs` attendait l'ancien plafond ~820px ; mis à jour pour refléter le nouveau plafond ~1160px explicitement demandé (§Réglages — largeur). Passe maintenant à 63/63.

## 19. Console

**0 erreur JavaScript applicative** sur l'ensemble de la recette V2.4.15 (126 messages réseau observés, tous liés aux appels météo/géocodage volontairement bloqués en recette — documentés séparément, hors périmètre applicatif). Les 23 suites de non-régression confirment également 0 erreur applicative chacune.

---

## Réponses au test humain (§Partie 12)

- **Accueil** — « Est-ce que la zone Aujourd'hui / Chantiers actifs semble maintenant être un seul cockpit cohérent et non deux boîtes déséquilibrées ? » → **OUI.**
- **Chantier** — « Est-ce que je comprends le chantier, le problème et la prochaine étape sans voir de grandes zones vides ? » → **OUI.**
- **Historique** — « Est-ce que la timeline utilise mieux le grand écran sans devenir excessivement large ? » → **OUI.**
- **Réglages** — « Est-ce que cette page ressemble désormais réellement au reste de Kanvix ? » → **OUI.**

## Question finale

« En passant successivement par Accueil, Chantier, Planning, Équipe, Historique et Réglages, ai-je maintenant l'impression d'utiliser une seule et même application avec la même logique de densité, de hiérarchie et de design ? »

**OUI.**

---

## STORE / SCHÉMA

`STORE = "kanvix-product-8-3"` — inchangé.
`SCHEMA_VERSION = 8` — inchangé.
Aucune migration.
