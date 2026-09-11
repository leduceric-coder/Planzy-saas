# KANVIX V2.4.14.1 — Correctif ciblé UI (Accueil + Cockpit chantier + Historique)

**Fichier livré :** `public/poc/kanvix-next-gen-v2.4.14.1.html`
**Fichier source :** `public/poc/kanvix-next-gen-v2.4.14.html` (V2.4.14)
**Verdict de validation visuelle V2.4.14 par l'utilisateur :** ACCUEIL: KO · CHANTIER/COCKPIT: KO · ÉQUIPE: OK
**Nature de cette version :** correctif ciblé, PAS une nouvelle refonte globale. Équipe (Chantier et page globale) strictement gelée.

---

## 1. Cause de la non-conformité Accueil (V2.4.14)

V2.4.14 avait interprété « équilibré » comme « autorisé à rester asymétrique » : `.today-main-grid` était resté à `1.4fr / 1fr` (seules les vignettes de synthèse `À décider`/`À surveiller` avaient été mises à `1fr/1fr`), et l'espace vertical résiduel entre les deux panneaux « Aujourd'hui »/« Chantiers actifs » était comblé artificiellement (`flex:1` + `justify-content:space-evenly` sur les listes). L'utilisateur a validé que ce n'était pas conforme à la maquette : les deux colonnes principales doivent être **strictement égales**, et la hauteur de chaque panneau doit être **celle de son contenu réel**, sans redistribution.

## 2. `.today-main-grid` : 1.4fr/1fr → 1fr/1fr

```css
/* avant (V2.4.14) */
.today-main-grid { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: stretch; }
/* après (V2.4.14.1) */
.today-main-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
```

Mesuré (recette, 1920px) : `todayW = sitesW = 805px` (écart ≤ 1px). Idem à 1440px (`573px = 573px`).

## 3. Suppression de l'égalisation de hauteur artificielle

`align-items: stretch` → `align-items: start` sur `.today-main-grid` : les deux panneaux ne sont plus forcés à la même hauteur.

## 4. Suppression de `flex:1` / `justify-content:space-evenly`

```css
/* avant (V2.4.14) */
.today-actions-list, .acp-list { flex: 1; justify-content: space-evenly; }
/* après (V2.4.14.1) */
.today-actions-list, .acp-list { display: flex; flex-direction: column; gap: 8px; }
```

Mesuré : avec 5 actions/1 chantier, « Aujourd'hui » (434px) est bien plus haut que « Chantiers actifs » (123px), sans compensation. Avec 1 action/4 chantiers, l'inverse est vrai (150px vs 327px). Dans les deux sens, aucune égalisation forcée — capture `03-accueil-contenu-desequilibre.png`.

## 5. Nouvelle composition du cockpit chantier

- L'illustration (`projectVisual`) quitte le corps du cockpit (`.cockpit-visual`, colonne dédiée de 96px) et rejoint l'en-tête dans une nouvelle ligne d'identité `.cockpit-id-row` (vignette + nom/localisation/accroche), à côté du nom du chantier.
- Le corps du cockpit (`.cockpit-content.cockpit-grid`) devient une grille 2 colonnes (`minmax(0,1.4fr) minmax(260px,0.9fr)`) : « À traiter » et « Prochaine étape » sont désormais **côte à côte** (même ligne) au lieu d'empilés verticalement.
- Les 4 gabarits qui produisaient `.cockpit-visual` (`closureReadyCockpit`, cockpit actif principal, lifecycle non-actif, setup requis) ont tous été mis à jour : plus aucune ancienne colonne vignette dans le corps.

## 6. Taille de la vignette avant/après

| | Avant (V2.4.14) | Après (V2.4.14.1) |
|---|---|---|
| Emplacement | Colonne dédiée dans le corps du cockpit | Intégrée à l'en-tête, à côté du nom |
| Taille bureau | 96px de haut × pleine largeur de colonne | **72×72px** (carré, plage 64-80px demandée) |
| Taille mobile (≤720px) | 84px de haut × pleine largeur | **64×64px** |

L'illustration SVG (`art(idx)`, `preserveAspectRatio="xMidYMid slice"`) est inchangée — seul son cadre a rétréci.

## 7. Hauteur du cockpit avant/après (Keravel, 1440×1000)

| | Avant (V2.4.14) | Après (V2.4.14.1) |
|---|---|---|
| « ← Chantiers » → haut des onglets | ~490-500px (estimé, vignette 96px + zones empilées) | **427px** (mesuré) |
| Cible demandée | — | ≤ 430px |

Resserrement obtenu via : padding `.cockpit` 16px→14px, `.cockpit-header` margin-bottom 16px→12px, `.cockpit-id-row` margin-top 10px→8px, en plus de la suppression de la colonne vignette et du passage en grille 2 colonnes pour les zones.

## 8. « À traiter » / « Prochaine étape » côte à côte

Mesuré (Keravel, 1440px) : les deux zones démarrent à `top:210px`, `À traiter` à `left:221px` (largeur 698px), `Prochaine étape` à `left:933px` (largeur 449px) — même ligne, colonnes distinctes. Capture `05-chantier-keravel-1440.png`.

## 9. Largeur de l'Historique avant/après

```css
/* avant (V2.4.14) */
.history-panel { max-width: 820px; }
/* après (V2.4.14.1) */
.history-panel { max-width: min(100%, 1120px); }
```

Mesuré : **1120px** (plage demandée 950-1150px), toujours aligné à gauche (`panelLeft === containerLeft`, écart ≤ 2px — pas de centrage). La timeline, les dates, le rail, les transitions de statut, le bouton « Voir la tâche » et la logique `historyProjectId`/`projectHistory`/`historyGroups`/`historyStamp` sont strictement inchangés (byte-identiques, voir §12).

## 10. Preuve qu'Équipe est intacte (Chantier + page globale)

Deux comparaisons structurelles automatisées (`GEL-141-01`, `GEL-141-02`) chargent **V2.4.14** et **V2.4.14.1** côte à côte et comparent le rendu réel :

- **Chantier > Équipe** (Keravel) : 5 cartes, 4 colonnes de grille dans les deux versions ; structure carte par carte (avatar/mission/état/classes CSS) strictement identique (`JSON.stringify` égal).
- **Équipe (page globale)** : 7 cartes, 4 colonnes dans les deux versions ; composant « Charge des ressources » toujours présent ; structure des cartes strictement identique.

Aucune ligne de `projectTeamCard()`, `teamCard()`, `.team-card`/`.tc-*` n'a été touchée.

## 11. Responsive

10 largeurs testées (1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390px) × 3 écrans du correctif (Accueil, Cockpit, Historique) : **aucun scroll horizontal** sur les 30 combinaisons. Sur mobile (≤720px) : vignette d'en-tête réduite à 64px, grille 2 colonnes du cockpit repasse à 1 colonne (empilée). À 390px : vignette 64×64px, nom lisible, menu accessible, aucun débordement (capture `08-chantier-390.png`).

## 12. Byte-identité des moteurs métier (§39)

23 fonctions comparées par hash MD5 entre V2.4.14 et V2.4.14.1 — toutes identiques : `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, `reopenProject`, `archiveProjectPrompt`, `restoreProject`, `confirmCloseProject`, `gantt`, `kanbanCard`, `getProjectSummary`. Seules les fonctions de **présentation** (`renderProject`, `projectTabs`, `closureReadyCockpit`) et le CSS ont été modifiées, comme attendu pour un correctif visuel.

## 13. Dark mode

Vérifié sur les 3 zones du correctif : panneau « Aujourd'hui », vignette de synthèse (Accueil), carte « À traiter » (Cockpit), panneau Historique — aucun aplat blanc forcé dans les 4 cas. Captures `09-dark-accueil.png` / `10-dark-chantier.png`.

## 14. Résultats de la recette dédiée

`recette-correctif-ui-v2.4.14.1.mjs` — **76 PASS / 0 FAIL**, couvrant :

- ACC-141-01 → 07 : colonnes strictement égales (1920 et 1440px), hauteur naturelle dans les deux sens de déséquilibre, absence de `space-evenly`/`flex:1`, non-régression des vignettes de synthèse et de « Cette semaine ».
- CHT-141-01 → 07 : vignette en en-tête (64-80px), zones côte à côte, hauteur cockpit ≤430px, les 5 états du cockpit (actif avec point ouvert, clôturé, archivé, à configurer, prêt à clôturer) sans ancienne colonne vignette, largeur Historique (950-1150px) + alignement gauche, isolation historique par chantier (SITE-01), responsive 900/390px.
- GEL-141-01/02 : structure Équipe (Chantier + page globale) strictement identique à V2.4.14.
- DARK-141, RESP-141 (10 largeurs × 3 écrans), CONSOLE-141, ENGINES-141.

Aucune assertion n'a été assouplie pour faire passer un test : chaque seuil (colonnes égales à ±1px, vignette 64-80px, cockpit ≤430px, historique 950-1150px) reflète l'exigence réelle du correctif.

## 15. Non-régressions et erreurs console

**22 suites de régression antérieures** ré-exécutées intégralement contre `kanvix-next-gen-v2.4.14.1.html` (serveur HTTP local sur le port 8241 démarré pour les tests multi-onglets) :

| Suite | Résultat |
|---|---|
| recette-accueil-v2.4.5 | 138 PASS / 0 FAIL |
| recette-accueil-v2.4.4.1 *(suite obsolète, voir note)* | 117 PASS / 6 FAIL |
| recette-backup-continuite-v2.4.13.1 | 106 PASS / 0 FAIL |
| recette-chantiers-v2.4.10.2 | 48 PASS / 0 FAIL |
| recette-edition-taches-v2.4.8 | 58 PASS / 0 FAIL |
| recette-historique-chantiers-v2.4.12 | 106 PASS / 0 FAIL |
| recette-historique-metier-v2.4.13 | 106 PASS / 0 FAIL |
| recette-historique-ui-v2.4.12.1 | 90 PASS / 0 FAIL |
| recette-import-intelligent-v2.4.9(.1) | 59 + 75 PASS / 0 FAIL |
| recette-kanban-badges-v2.4.11.1 | 84 PASS / 0 FAIL |
| recette-kanban-badges-v2.4.11.2 *(suite obsolète, voir note)* | 94 PASS / 7 FAIL |
| recette-kanban-badges-v2.4.11.3 | 165 PASS / 0 FAIL |
| recette-mode-chantier-v2.4.5 / v2.4.6 | 84 + 95 PASS / 0 FAIL |
| recette-planning-bureau-v2.4.9.1/10/10.1 | 50 + 57 + 76 PASS / 0 FAIL |
| recette-planning-v2.4.8 | 17 PASS / 0 FAIL |
| recette-reglages-v2.4.7 | 63 PASS / 0 FAIL |
| recette-resolve-dates-v2.4.10.2 | 14 PASS / 0 FAIL |
| recette-ui-responsive-v2.4.11 | 47 PASS / 0 FAIL |

**Notes sur les 2 suites en échec partiel (non-régressions confirmées, pas de nouveaux échecs) :**
- `recette-accueil-v2.4.4.1.mjs` (6 échecs) teste un écart de gouttière de 16px devenu obsolète depuis le passage à 14px en V2.4.14 — **vérifié identique en ré-exécutant cette même suite contre le V2.4.14 non modifié** (même 6 échecs). Cette suite est supersédée par `recette-accueil-v2.4.5.mjs` (138/0).
- `recette-kanban-badges-v2.4.11.2.mjs` (7 échecs) teste l'absence totale de « À traiter » dans le Kanban, invariant devenu obsolète depuis les libellés contextuels de V2.4.11.3 — **vérifié identique contre le V2.4.14 non modifié** (même 7 échecs, 94/7). Supersédée par `recette-kanban-badges-v2.4.11.3.mjs` (165/0).
- Un échec isolé et non reproductible de `recette-edition-taches-v2.4.8.mjs` (57/1 lors du premier passage) tenait à une variation de timing sur l'appel réseau météo intentionnellement bloqué en test — confirmé non déterministe (58/0 en ré-exécution) et confirmé identique contre le V2.4.14 non modifié.

**Console :** 0 erreur JavaScript applicative sur l'ensemble des 23 suites (recette dédiée incluse) — les seuls messages `ERR_FAILED`/`ERR_TUNNEL_CONNECTION_FAILED` proviennent des appels météo/géocodage intentionnellement interceptés (`route().abort()`) pour isoler les tests du réseau.

---

## Zones gelées — non touchées

- Chantier > Équipe (`projectTeamCard`, `.team-card`, `.tc-*`)
- Page Équipe globale (grille de cartes, filtres, « Charge des ressources »)
- Libellés/ordre des onglets, visibilité Essentiel/Pilotage
- Toute la logique métier (planReflow, Kanban, scénarios, sauvegarde/restauration, historique métier)

## Fichiers livrés

- `public/poc/kanvix-next-gen-v2.4.14.1.html`
- `recette-correctif-ui-v2.4.14.1.mjs`
- `recette-v2.4.14.1/` (10 captures + `resultats.json`)
- `rapport-recette-correctif-ui-v2.4.14.1.md` (ce document)
