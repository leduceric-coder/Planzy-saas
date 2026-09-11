# Kanvix V2.4.14 — Densité visuelle et harmonisation de l'espace

Source : `public/poc/kanvix-next-gen-v2.4.13.1.html` → cible `public/poc/kanvix-next-gen-v2.4.14.html`.
Version **rendu / mise en page uniquement**. Diff total : **233 lignes**, réparties sur 4 écrans (Accueil, Chantier, Équipe chantier, Équipe globale) + un plafond de lecture sur l'Historique.

## Verdict

**PASS.** Les quatre écrans visés occupent mieux l'espace, se ressemblent davantage entre eux, et aucune fonctionnalité n'a bougé.

| Résultat | |
|---|---|
| Recette densité (`recette-densite-v2.4.14.mjs`, nouvelle) | **64 / 64** |
| Accueil (assertions d'alignement mises à jour, voir §6) | **143 / 143** |
| Mode Chantier · Réglages · Édition · ancien Planning | **95 · 63 · 58 · 17** |
| Import · Badges Kanban · Planning Bureau · Résoudre · UI responsive | **75 · 165 · 76 · 14 · 47** |
| Chantiers (audit SITE) — **0 finding** | **48 / 48** |
| Historique contextualisé · Timeline · Historique métier · Sauvegarde | **106 · 90 · 106 · 106** |
| **Total** | **1273 / 1273** |
| Erreurs console applicatives | **0** |

**35 moteurs métier vérifiés byte-identiques** entre V2.4.13.1 et V2.4.14 (`planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `historyProjectId`, `projectHistory`, `getProjectSummary`, `buildKanvixBackup`, le cycle de vie chantier, l'import intelligent, etc.) : cette version ne touche que le rendu.

## Note sur la maquette de référence

L'image fournie a servi de référence d'**intention** (densité, proportions, hiérarchie), pas de gabarit à reproduire à l'identique. Deux écarts assumés :

1. **Pas de « Avancement » en pourcentage** sur les cartes chantier (maquette : barre de progression avec %). Kanvix n'a aujourd'hui aucune notion d'avancement de chantier (ni champ, ni calcul) — l'inventer aurait ajouté une fausse donnée. Le badge de santé existant (Risque / À surveiller / Dans les temps) reste seul indicateur de statut.
2. **Pas de champs « Type » / « Fin prévue »** dans l'en-tête chantier (maquette : « Maison individuelle », date de fin). Ces champs n'existent pas dans le modèle de données Kanvix — l'en-tête met en avant nom, localisation, incident prioritaire et prochaine étape, qui EUX sont des données réelles (`getProjectSummary`).

## 1. Accueil — harmonisation des largeurs (§1)

### Avant / après

| | Avant | Après |
|---|---|---|
| `.attention-grid` (À décider / À surveiller) | `1.4fr / 1fr` (asymétrique) | **`1fr / 1fr`** — largeur strictement égale |
| `.today-main-grid` (Aujourd'hui / Chantiers actifs) | `1.4fr / 1fr` | inchangé — **« équilibré »**, pas égal (Aujourd'hui reste la colonne dense, comme dans la référence) |
| Hauteur `.attention-card` | 96px | 84px |
| Hauteur `.tp-row` (ligne Aujourd'hui) | 76px | 64px |
| Hauteur `.acp-row` (ligne Chantiers actifs) | 72px | 60px |
| Vignette `.acp-visual` | 44×44px | 36×36px |
| Gouttières (`gap`) | 16px | 14px |

Mesuré : `À décider` et `À surveiller` font désormais exactement la même largeur (649px à 1600px de large), parfaitement alignées.

### Le vide résiduel (§7)

Avec les nouvelles hauteurs de ligne plus compactes, « Aujourd'hui » (jusqu'à 4 actions) et « Chantiers actifs » (jusqu'à 4 chantiers) ne totalisent pas forcément la même hauteur de contenu, alors que `.today-main-grid{align-items:stretch}` force les deux panneaux à la même hauteur totale — ce qui recréait un vide en bas du panneau le plus court.

**Solution :** la liste interne (`.today-actions-list` / `.acp-list`) passe en `flex:1` avec `justify-content:space-evenly` : l'espace disponible se redistribue en respiration ENTRE les lignes plutôt qu'en un bloc mort en bas. Avec une seule ligne (cas extrême testé), la carte se **centre** verticalement au lieu de rester collée en haut avec un grand vide dessous.

## 2. Chantier — cockpit compact (§2)

| | Avant | Après |
|---|---|---|
| Colonne vignette (`.cockpit-body`) | `1fr 320px` | **`1fr 96px`** |
| Hauteur vignette (`.cockpit-visual`) | 240px | **96px** (mobile : 84px) |
| Gouttière cockpit | 32px | 18px |
| `.cockpit{padding}` | 20px 0 | 16px 0 |
| `.cockpit-content{gap}` | 20px | 14px |
| `.issue-card`/`.milestone-card{padding}` | 14px | 12px 14px |

L'illustration du bâtiment (`projectVisual()`, SVG `preserveAspectRatio="xMidYMid slice"`) est **conservée à l'identique** — seule sa taille change, elle recadre proprement à n'importe quel format sans déformation. Elle devient un repère d'identité secondaire (36→96px de haut selon densité) : le nom, la localisation, le point à traiter et la prochaine étape récupèrent la largeur.

**Les 5 variantes du cockpit** (actif normal, clôturé, archivé, à configurer, prêt-à-clôturer) partagent la même colonne CSS `.cockpit-body`/`.cockpit-visual` : un seul changement de style suffit à toutes les traiter, vérifié explicitement sur clôturé/archivé/à-configurer (aucune ne perd sa vignette ni son bandeau propre).

## 3. Chantier > Équipe — grille de cartes (§2/§5)

`resourceRow()` (une ligne `.row` générique) est remplacée par **`projectTeamCard()`**, qui réutilise la famille visuelle `.team-card`/`.tc-*` — la même que la page Équipe globale (cohérence transverse, §5). Chaque carte affiche avatar, nom, type (interne/externe, personne/entreprise), tâche en cours **sur ce chantier** ou « Aucune intervention », état de charge, et badge de message non lu s'il y en a — toutes des données réelles, aucune invention.

`resourceRow()` legacy est conservée (plus appelée), aucune fonction supprimée.

Le libellé « Aucune ressource assignée » pour les tâches non affectées est préservé mot pour mot (le garde-fou SITE-F4 de l'audit Chantiers, qui interdit tout faux « Non affecté », reste vert).

## 4. Équipe (page globale) — grille de cartes (§3)

`.team-list` passait d'une boîte unique à bordure (lignes pleine largeur séparées par un filet) à une **grille** (`repeat(auto-fill, minmax(272px,1fr))`) de cartes indépendantes, chacune avec sa propre bordure/ombre/rayon.

Point notable : la structure DOM de `teamCard()` (avatar, `.tc-id`, `.tc-mission`, `.tc-state`) était **déjà** exactement celle qu'une media query à 720px utilisait pour composer une mise en page 2 lignes (grid-template-areas `"av id st" "av mi mi"`). Il a donc suffi de **généraliser cette disposition à toutes les largeurs** au lieu de la réserver au mobile — **zéro ligne de JavaScript modifiée** pour cette page, uniquement du CSS. La media query mobile, devenue redondante, a été retirée.

Filtres (Tous/Internes/Externes/À surveiller), vue Archives, et le composant `resourceLoadBoard()` sous la grille sont **entièrement inchangés** et fonctionnels (vérifié).

## 5. Historique — largeur de lecture (§2/§4)

`.history-panel` reçoit un plafond `max-width: 820px` — la même valeur que la colonne de Réglages, réutilisation d'un motif déjà établi dans Kanvix plutôt qu'une nouvelle règle inventée. Densité déjà largement travaillée en V2.4.12.1/V2.4.13 : seul un tour de vis supplémentaire sur les marges (`.history-list`/`.history-day + .history-day` : 16-18px → 14px).

**SITE-01 non régressé** : `historyProjectId()` et `projectHistory()` sont byte-identiques ; testé explicitement — aucune fuite Keravel ↔ Villa après la refonte visuelle.

## 6. Cohérence transverse (§5 de la demande)

- Même famille de carte (`.team-card`) entre la page Équipe et l'onglet Équipe d'un chantier.
- Mêmes tokens (`--radius-md/lg`, `--shadow-xs`, `--border-light`) partout, aucune nouvelle échelle d'ombre introduite.
- Même logique de réduction de hauteur de ligne appliquée à l'Accueil (tp-row/acp-row) qu'au cockpit (padding/gap) : un seul geste de densité, décliné cohéremment.
- Aucun élément décoratif ajouté ; aucune donnée inventée.

## 7. Mise à jour d'une suite existante

`recette-accueil-v2.4.5.mjs` contenait une vérification figée sur l'**ancien** design : elle attendait que le bord droit de « À décider » coïncide avec celui d'« Aujourd'hui » — vrai uniquement parce que les deux grilles partageaient la même répartition `1.4fr/1fr`. La demande de cette version rend cette coïncidence **structurellement impossible** (§1 : le haut doit être égal, le bas reste asymétrique) : ce n'est pas une régression, c'est le changement demandé.

L'assertion a été réécrite pour vérifier l'invariant réellement demandé — l'**égalité de largeur** des deux vignettes — et la valeur de gouttière attendue mise à jour (16 → 14px). Deux vérifications de bord devenues sans objet (le coin de coupure entre colonnes n'est plus partagé) ont été retirées plutôt que remplacées par un test sans signification. Résultat : **143/143** (149 avant, -6 assertions obsolètes, +1 assertion du nouvel invariant réel).

## 8. Vérification fonctionnelle

- **Clic sur une carte ressource** (page Équipe ou onglet Équipe d'un chantier) → ouvre bien la fiche ressource (`openResource`), vérifié par un vrai clic Playwright.
- **Filtres Équipe** (Internes/Externes/À surveiller) → toujours opérants avec la nouvelle présentation en cartes.
- **Tabs du Chantier** (Aujourd'hui/À venir/Documents/Photos/Planning/Équipe/Historique) → tous rendus sans erreur sur les 5 états de cycle de vie testés.
- **Annuler/Résoudre/Voir dans le planning** dans le cockpit → inchangés (markup non touché, seule la taille de la colonne voisine a changé).

## 9. Dark mode

Vérifié sur l'Accueil (vignette de synthèse, panneau Aujourd'hui) et sur la carte ressource de l'onglet Équipe chantier : aucun aplat blanc forcé, contraste texte/fond correct dans les trois cas.

## 10. Responsive

**1920 / 1440 / 1280 / 900 / 768 / 430 / 390 px**, sur les 4 écrans touchés (Accueil, Chantier, Chantier > Équipe, Équipe) : **0 scroll horizontal** dans les 28 combinaisons testées. Sur mobile, la vignette du cockpit redevient une bande pleine largeur discrète (84px), les cartes ressources repassent en une colonne.

## 11. Résultats détaillés — `recette-densite-v2.4.14.mjs`

| Section | Objet | Résultat |
|---|---|---|
| ACCUEIL | Vignettes égales, panneaux alignés en hauteur, « Cette semaine » cadré sur la page | **PASS** |
| ACCUEIL-VIDE | 1 seul chantier actif : la liste reste étirée, la carte se centre | **PASS** |
| CHANTIER | Vignette ≤110px, illustration conservée, contenu prioritaire, données réelles | **PASS** |
| CHANTIER-ETATS | Clôturé / archivé / à configurer : vignette + bandeau propres | **PASS** |
| CHANTIER-EQUIPE | Grille de cartes, avatar+mission+état, clic → fiche ressource | **PASS** |
| CHANTIER-EQUIPE-VIDE | Tâche non affectée : carte dédiée, jamais « Non affecté » | **PASS** |
| HISTORIQUE | Plafond 820px respecté, événements réels affichés | **PASS** |
| HISTORIQUE-ISOLATION | SITE-01 toujours fermé après la refonte visuelle | **PASS** |
| EQUIPE | Grille multi-colonnes, filtres fonctionnels, charge des ressources intacte | **PASS** |
| DARK | Accueil + carte ressource sans aplat blanc | **PASS** |
| RESPONSIVE | 1920→390 × 4 écrans : 0 scroll horizontal (28 combinaisons) | **PASS** |
| CONSOLE | 0 erreur JavaScript applicative | **PASS** |

**64 assertions, 64 PASS.**

## 12. Non-régressions

| Suite | Résultat |
|---|---|
| Accueil (assertions mises à jour, §7) | **143 / 143** |
| Mode Chantier | **95 / 95** |
| Réglages | **63 / 63** |
| Édition universelle des tâches | **58 / 58** |
| ancien Planning | **17 / 17** |
| Import intelligent | **75 / 75** |
| Badges Kanban | **165 / 165** |
| Planning Bureau (dont PLAN-F1→F10) | **76 / 76** |
| Résoudre — calendrier dynamique | **14 / 14** |
| Recette UI / responsive V2.4.11 | **47 / 47** |
| Chantiers (audit SITE) | **48 / 48** — 0 finding |
| Historique contextualisé (V2.4.12) | **106 / 106** |
| Timeline Historique (V2.4.12.1) | **90 / 90** |
| Historique métier (V2.4.13) | **106 / 106** |
| Sauvegarde / continuité (V2.4.13.1) | **106 / 106** |

## 13. Périmètre technique

**35 fonctions vérifiées byte-identiques** entre V2.4.13.1 et V2.4.14, dont `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `historyHTML`, `getProjectSummary`, `getResourceState`, `resourceStateTone`, `resourceStateLabel`, `teamCard`, `getTodayWorkflow`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, le cycle de vie chantier, l'import intelligent, `gantt`, `kanbanCard`.

`SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (`kanvix-product-8-3`), aucune migration.

## 14. Erreurs console

**0 erreur JavaScript applicative** sur la nouvelle recette et l'ensemble des 15 suites de non-régression rejouées.

## Points perfectibles (transparence)

1. **Un seul chantier actif** dans la démo produit un panneau « Chantiers actifs » avec une carte centrée plutôt que remplie — visuellement correct mais moins riche qu'avec plusieurs chantiers ; comportement attendu, pas un défaut.
2. **`resourceRow()` (legacy)** reste dans le fichier, non appelée, par prudence (aucune suppression sans nécessité). Un nettoyage pourrait la retirer dans une version future si confirmé qu'aucun usage ne subsiste.
3. **Pas d'indicateur d'avancement chantier** (cf. note sur la maquette, §0) : si cette donnée devient un jour réelle (calcul tâches terminées / total), la carte pourra l'accueillir sans repenser la mise en page.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.14.html` — fichier complet.
2. `recette-densite-v2.4.14.mjs` — nouvelle suite (64 vérifications).
3. `rapport-recette-densite-v2.4.14.md` — ce rapport.
4. Captures : `recette-densite-v2.4.14/` (01→04).
5. `recette-accueil-v2.4.5.mjs` — mis à jour (invariant d'égalité de largeur, §7).
