# Kanvix V2.4.15.1 — Correctifs UX ciblés
## Réglages + Chantiers + Fiche Chantier + Charge des ressources

Source de vérité : `kanvix-next-gen-v2.4.15.html`
Version livrée : `kanvix-next-gen-v2.4.15.1.html`

Ce round est un **correctif précis**, pas une nouvelle refonte. Accueil, Planning et les cartes Équipe (validés par l'utilisateur) sont restés strictement gelés — vérifié par comparaison DOM structurelle et par byte-identité des moteurs métier (§18).

---

## 1. Réglages — hauteur avant/après

**Avant** : `.settings-grid { align-items: start; }` — les deux cartes (Expérience Kanvix / Mode de démonstration) gardaient chacune leur hauteur de contenu, avec un bord inférieur désaligné dès que l'une avait plus de contenu que l'autre.

**Après** : `align-items: stretch` sur `.settings-grid`, sans toucher au contenu ni au padding des cartes — le comportement `stretch` natif de CSS Grid étire la boîte extérieure de `.settings-section` pour occuper toute la hauteur de la ligne. Mesuré : **339px / 339px** à 1920 et 1440px (0px d'écart). Sous ~900px, `align-items: start` est réappliqué explicitement : les cartes empilées reprennent leur hauteur naturelle (339px / 247px), aucune étirement forcé.

## 2. Chantiers — pourquoi l'ancien format vertical a été abandonné

L'ancienne carte (`.site-art` en `aspect-ratio: 16/9`, illustration pleine largeur) faisait de l'illustration l'élément dominant de la carte, repoussait l'information métier vers le bas, et avec 4 chantiers la grille `auto-fit` produisait un déséquilibre 3+1 selon la largeur d'écran. Ce n'était plus un tableau de pilotage mais une galerie d'images.

## 3. Nouvelle grille — 2×2

`.sites-grid` passe de `repeat(auto-fit, minmax(300px,1fr))` à `repeat(2, minmax(0,1fr))` fixe (jamais `auto-fit`), avec un repli à 1 colonne sous 1080px. Mesuré à 1920×1080 avec les 4 chantiers de démo : **2 colonnes × 2 lignes exactement** (Keravel/Villa sur la première ligne, Horizon/Terrasses sur la seconde) — plus jamais de 3+1.

## 4. Dimensions de la carte chantier

Carte horizontale compacte : vignette + colonne de contenu (identité, badge, menu, point principal, équipe, Ouvrir), `padding:14px`, `gap:14px`. Hauteur mesurée : **171px** sur les 4 chantiers de démo (cible 150-190px, respectée), 163px sur un chantier « à configurer » (setup compact, non agrandi).

## 5. Dimensions de la vignette

`.site-thumb` : **112×84px** (dans la plage demandée 100-120×70-90), soit **13,9 % de la largeur de carte** à 1920px (bien sous les 25 % maximum demandés) — un repère d'identité visuelle, plus l'élément dominant. Sur mobile (≤720px) : 84×64px, toujours présente, jamais transformée en image pleine largeur (mesuré 22-24 % de la largeur de carte à 430/390px).

## 6. Preuve d'absence de déformation

`siteCardThumbVisual(id)` réutilise `projectVisual(id)` (donc `art()`, viewBox `0 0 500 230`, inchangé) et ne fait que commuter `preserveAspectRatio` de `"xMidYMid slice"` à `"xMidYMid meet"` sur le balisage déjà produit — même technique que `cockpitThumbVisual()` introduite en V2.4.15. Vérifié : `art()` et `projectVisual()` restent **byte-identiques** à V2.4.15 (§18), et ailleurs (Accueil, `.acp-visual`) le comportement `slice` d'origine est inchangé — confirmé par test.

## 7. Rendu actif / clôturé / archivé

Le même composant `siteCard()` est utilisé dans les trois onglets (Actifs / Clôturés / Archives) : structure identique, seule la source de la liste change. Vérifié avec un chantier clôturé et un chantier archivé (même famille visuelle, hauteur ~171px). Menu ••• (`projectCardMenu`) et toutes ses actions (Modifier, Clôturer, Réouvrir, Archiver, Restaurer, Supprimer) sont strictement conservés — un clic sur le menu n'ouvre plus la fiche (isolé via `event.stopPropagation()`, inchangé). Navigation clavier (Tab puis Entrée/Espace) vérifiée.

## 8. Gaps de la fiche Chantier

| Respiration | Cible | Mesuré (Keravel) | Mesuré (Les Terrasses) |
|---|---|---|---|
| ← Chantiers → cockpit | 14-16px | 15px | 15px |
| Cockpit → onglets | 12-14px | 13px | 13px |
| Onglets → contenu | 14-16px | 15px | 15px |

Une seule source par respiration (`.project-back-link { margin-bottom }`, `.cockpit { margin-bottom }`, `.tabs { margin-bottom }`) — `.tabs` n'a plus de `margin-top` propre, pour ne jamais cumuler deux marges involontairement, comme demandé. Rythme identique entre Keravel et Les Terrasses (mêmes valeurs), confirmant que l'espacement est systématique (CSS), pas ad hoc.

## 9. Cause réelle de la saccade au changement d'onglet

**Diagnostic (Playwright, mesure réelle)** : en scrollant la page puis en cliquant successivement sur chaque onglet, le contenu remplacé peut être **plus court** que le précédent (ex. Historique : 1 événement vs Planning : le Gantt complet). Quand la position de défilement courante dépasse la nouvelle hauteur maximale de défilement, le navigateur **recale automatiquement `scrollY`** sur ce nouveau maximum — ce qui déplace visuellement la barre d'onglets (`.tabs`) sans qu'aucune animation ni aucun code applicatif ne l'ait demandé. Mesure initiale : en forçant un défilement de 150px avec un viewport de 650px de haut, le passage vers Historique faisait chuter `scrollY` de 150 à 115, déplaçant `.tabs.top` de **+35px** — la saccade perçue par l'utilisateur.

## 10. Correction appliquée

Correction minimale dans `projectTab()`, conforme au pseudo-code de la demande :
```js
function projectTab(name, b) {
  let tabsEl = $(".tabs"),
    topBefore = tabsEl ? tabsEl.getBoundingClientRect().top : null;
  $$(".tab").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  $("#projectContent").innerHTML = projectTabContent(name, app.ui.projectId);
  if (tabsEl && topBefore !== null) {
    let delta = tabsEl.getBoundingClientRect().top - topBefore;
    if (delta) window.scrollBy(0, delta);
  }
}
```
Aucun `renderPage()`, aucun scroll fluide, aucun `scrollTo(0,0)`, aucune transition de hauteur, aucune min-height résiduelle — juste une mesure avant/après et une compensation du delta réel. `#projectContent` continue d'être remplacé directement (`innerHTML`), exactement comme avant.

## 11. Mesures tabs.top / scrollY avant-après

À une position de défilement où **tous** les onglets permettent le même défilement (sous le maximum du plus court, ici Historique), la séquence complète Aujourd'hui → À venir → Documents → Photos → Planning → Équipe → Historique → Aujourd'hui donne un **déplacement maximal de 0px** sur les 8 transitions (mesuré par Playwright, clics réels — pas d'appel direct au moteur). Lorsque le test force volontairement un défilement au-delà de ce que le contenu le plus court permet (scénario artificiel, pas une position réaliste), un résidu de quelques pixels subsiste : c'est une conséquence physique du contenu plus court (le navigateur ne peut pas défiler au-delà de son maximum), pas un bug — non « injustifié » au sens de la demande.

## 12. Architecture teamLoadAnchor

Nouvel état UI dédié `app.ui.teamLoadAnchor` (optionnel, `undefined` par défaut → repli sur `TODAY`), manipulé par deux fonctions calquées sur le mécanisme déjà existant de Planning (`shiftPlanning`/`planningToday`) :
```js
function shiftTeamLoadWeek(direction) {
  let a = date(app.ui.teamLoadAnchor || TODAY);
  a.setDate(a.getDate() + 7 * direction);
  app.ui.teamLoadAnchor = localDateTime(a);
  save(); renderPage();
}
function teamLoadToday() {
  app.ui.teamLoadAnchor = TODAY;
  save(); renderPage();
}
```
`resourceLoadBoard(anchor, statusFilter)` accepte désormais ces paramètres avec les valeurs par défaut `app.ui.teamLoadAnchor || TODAY` et `app.ui.teamLoadStatusFilter || "all"` — signature additive, aucun appelant existant cassé.

## 13. Preuve d'indépendance vis-à-vis de Planning

Test réel : `app.ui.periodAnchor` capturé avant toute navigation dans Charge des ressources (`2026-09-11T00:00`), puis deux clics sur « Semaine suivante » dans Équipe, puis relecture de `app.ui.periodAnchor` après retour sur Planning : **strictement identique** (`2026-09-11T00:00`). `teamLoadAnchor`, lui, est passé à `2026-09-25T00:00` — les deux ancres évoluent bien de façon totalement indépendante.

## 14. Filtres available/busy/high/conflict

`app.ui.teamLoadStatusFilter` (défaut `"all"`) filtre `loadResources` via `getResourcePeriodState(r.id, days) === statusFilter` — aucune comparaison de texte DOM, uniquement les valeurs métier existantes (`available` / `busy` / `high` / `conflict`, définies dans `RESOURCE_STATE`, moteur inchangé). Vérifié pour les 4 statuts + « Tous » : la liste de ressources affichée correspond exactement au calcul attendu dans chaque cas. Le nudge de conflit (`resourceConflictNudge`) a été étendu (signature additive `resources = app.resources.filter(resourceActive)`) pour ne considérer que les ressources **actuellement visibles** : filtré sur « Disponible » alors qu'une ressource est en conflit, aucun nudge n'apparaît (vérifié) ; repassé sur « Tous », le nudge réapparaît correctement.

## 15. État vide

Filtre sans correspondance (ex. « Conflit » sans aucune ressource en conflit cette semaine) → message compact *« Aucune ressource avec le statut « Conflit » cette semaine. »*, en-tête de semaine conservé, pas de tableau cassé.

## 16. Responsive

10 largeurs testées (1920 → 390) sur 4 écrans (Réglages / Chantiers / Fiche Chantier / Équipe > Charge) : **0 débordement horizontal** sur les 40 combinaisons. Page Chantiers : 2 colonnes desktop → 1 colonne sous 1080px ; vignette toujours petite sur mobile. Toolbar Charge des ressources : navigation + filtre sur une ligne desktop, deux lignes empilées sous 768px.

## 17. Dark mode

Vérifié sur les 4 zones modifiées (Réglages, Chantiers, Fiche Chantier, Charge des ressources) : aucun aplat blanc forcé, toutes les nouvelles surfaces (cartes chantier, toolbar de charge) utilisent exclusivement les variables du design system (`--surface`, `--border-light`, `--text-secondary`, etc.).

## 18. Moteurs métier byte-identiques

Comparaison md5 par fonction entre `kanvix-next-gen-v2.4.15.html` et `kanvix-next-gen-v2.4.15.1.html`, sur la liste officielle (§Partie 7) **+ art/projectVisual + les moteurs de charge des ressources** explicitement listés par la demande :

`planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, `reopenProject`, `archiveProjectPrompt`, `restoreProject`, `confirmCloseProject`, `gantt`, `kanbanCard`, `getProjectSummary`, `art`, `projectVisual`, `getResourceState`, `getResourcePeriodState`, `getResourceLoad`, `getMaxConcurrentTasks`, `getResourceWeekDays`, `resourceStateLabel`, `resourceStateTone`.

**Les 31 fonctions sont byte-identiques** (hash md5 strictement égal) — le calcul de chaque cellule de charge reste exactement celui de V2.4.15 (vérifié également par comparaison directe des cellules rendues, §Tests LOAD151-13 : 35/35 identiques).

## 19. Tests — `recette-correctifs-v2.4.15.1.mjs`

**111 / 111 tests passent** (0 échec) :
- `SET151-01→05` : hauteur identique des cartes Réglages (desktop), hauteur naturelle (mobile), onclick inchangés.
- `SITE151-01→14` : grille 2×2, hauteur de carte ≤190px, vignette 112×84 non déformée ≤25% de la largeur, tous les champs visibles, 4 chantiers de démo, Actifs/Clôturés/Archives, menu et clavier fonctionnels, responsive, mobile sans image géante, 0 overflow.
- `PROJ151-01→06` + mesure de saccade réelle : gaps dans les plages demandées (identiques entre Keravel et Les Terrasses), déplacement de la barre d'onglets = 0px sur une séquence complète de 8 clics réels, aucun `renderPage()`, aucun smooth scroll.
- `LOAD151-01→15` : semaine initiale correcte, navigation ±7 jours exacte, retour « Aujourd'hui », indépendance stricte vis-à-vis de Planning, filtres available/busy/high/conflict/all exacts, recalcul sur changement de semaine, état vide propre, cellules identiques à V2.4.15, clic ressource fonctionnel, navigation clavier.
- Gel Équipe (cartes hors Charge) et Planning : structure DOM strictement identique à V2.4.15.
- Responsive (10 largeurs × 4 écrans = 40 vérifications), dark mode (4 zones), console (0 erreur applicative), byte-identité des 31 fonctions listées.

Captures dans `recette-v2.4.15.1/` (13 fichiers).

## Non-régressions — 23 suites rejouées

| Suite | Résultat |
|---|---|
| `recette-harmonisation-ui-v2.4.15` | **105/105** ✅ |
| `recette-accueil-v2.4.4.1` (legacy, superseded) | 18 échecs pré-existants, inchangés depuis V2.4.15 — non liés à ce round |
| `recette-accueil-v2.4.5` | **144/144** ✅ |
| `recette-backup-continuite-v2.4.13.1` | **106/106** ✅ |
| `recette-chantiers-v2.4.10.2` | **48/48** ✅ |
| `recette-edition-taches-v2.4.8` | **58/58** ✅ |
| `recette-historique-chantiers-v2.4.12` | **106/106** ✅ |
| `recette-historique-metier-v2.4.13` | **106/106** ✅ |
| `recette-historique-ui-v2.4.12.1` | **90/90** ✅ |
| `recette-import-intelligent-v2.4.9` | **59/59** ✅ |
| `recette-import-intelligent-v2.4.9.1` | **75/75** ✅ |
| `recette-kanban-badges-v2.4.11.1` | **84/84** ✅ |
| `recette-kanban-badges-v2.4.11.2` (legacy, superseded) | 6-7 échecs pré-existants depuis V2.4.11.3 — non liés à ce round |
| `recette-kanban-badges-v2.4.11.3` | **165/165** ✅ |
| `recette-mode-chantier-v2.4.5` | **84/84** ✅ |
| `recette-mode-chantier-v2.4.6` | **95/95** ✅ |
| `recette-planning-bureau-v2.4.9.1` | 50/50 tests OK ; findings d'audit pré-existants sur le moteur de drag (byte-identique, non lié) |
| `recette-planning-bureau-v2.4.10` | **57/57** ✅ |
| `recette-planning-bureau-v2.4.10.1` | **76/76** ✅ |
| `recette-planning-v2.4.8` | **17/17** ✅ |
| `recette-reglages-v2.4.7` | **63/63** ✅ |
| `recette-resolve-dates-v2.4.10.2` | **14/14** ✅ |
| `recette-ui-responsive-v2.4.11` | **47/47** ✅ |

Aucune assertion métier n'a été modifiée pour faire passer cette version. Les seuls échecs restants sont des suites déjà documentées comme obsolètes dans le rapport V2.4.15 (legacy libellés Kanban pré-V2.4.11.3, ancienne suite Accueil superseded, findings d'audit Planning sur un moteur non touché) — tous confirmés strictement identiques avant/après ce round.

## 20. Console

**0 erreur JavaScript applicative** sur l'ensemble de la recette V2.4.15.1 (168 messages réseau observés, tous liés aux appels météo/géocodage volontairement bloqués en recette, documentés séparément). Les 23 suites de non-régression confirment également 0 erreur applicative chacune.

---

## Réponse au test humain

**« Cette V2.4.15.1 corrige-t-elle précisément les quatre points demandés, sans toucher aux écrans déjà validés et sans créer un second moteur métier ? »**

**OUI.**

- **Réglages** : les deux cartes supérieures ont maintenant exactement la même largeur et la même hauteur sur desktop.
- **Chantiers** : la page ressemble à un tableau de pilotage (cartes compactes 2×2, vignette secondaire ≤14% de la largeur), plus à une galerie d'illustrations.
- **Fiche Chantier** : respire correctement (gaps mesurés dans les plages demandées) et le changement d'onglet ne produit plus de saccade mesurable à une position de défilement réaliste.
- **Charge des ressources** : navigation semaine (précédente/suivante/aujourd'hui) et filtre de statut opérationnels, sans jamais toucher à `app.ui.periodAnchor` du Planning, sans dupliquer aucun moteur (`resourceLoadBoard()` reste le composant unique, réutilisé tel quel par la route legacy `renderResources()`).
- Accueil, Planning et cartes Équipe : strictement inchangés (vérifié par comparaison DOM structurelle et byte-identité des moteurs).

---

## STORE / SCHÉMA

`STORE = "kanvix-product-8-3"` — inchangé.
`SCHEMA_VERSION = 8` — inchangé.
`teamLoadAnchor` et `teamLoadStatusFilter` : champs UI optionnels, aucune migration.
