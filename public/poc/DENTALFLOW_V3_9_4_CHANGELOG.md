# DentalFlow V3.9.4 — Changelog

**Base :** `dentalflow-next-poc-v3.9.3.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.4.html`
**Mandat :** Micro-retouche visuelle pure de la sidebar — hiérarchie plus nette entre les
titres de section (Principal/Gestion/Administration) et les pages cliquables.
**schemaVersion :** 10 (inchangé)

Modification strictement visuelle : titres de section, séparateurs. Aucun changement
d'architecture (`NAV_GROUPS`/`NAV_ITEMS`), de route, de permission, de badge, de state
métier, de PWA Collaborateur ni de portail Cabinet.

## Changé

- **Titres de section (Principal/Gestion/Administration) rendus plus « méta ».**
  `.nav-group-title` : `font-size` 11px → **10.5px**, `font-weight` 850 → **750**,
  `letter-spacing` .07em → **.1em**, ajout d'une **opacité .78**. Couleur passée de
  la valeur hexadécimale figée `#7c879c` à `var(--text-tertiary)` (déjà theme-aware,
  identique en valeur sous light — aucun changement visuel de couleur, seulement une
  dépendance explicite au token plutôt qu'à une copie figée). Aucun fond, aucune
  capsule ajoutés — toujours un simple libellé sur fond nu, conforme à la référence
  visuelle validée (§2 du mandat).
- **Séparateur horizontal très discret avant Gestion et avant Administration,
  jamais avant Principal.** `.nav-group+.nav-group{border-top:1px solid
  var(--border);padding-top:14px}` — le sélecteur `+` (frère adjacent) exclut
  naturellement le premier groupe. Le trait reste inscrit dans la largeur du
  contenu de la sidebar (inset par le padding existant de `.nav-block`, 20px),
  jamais jusqu'aux bords physiques de la sidebar.
- **Espacements recalibrés pour éviter le double espace** (mise en garde explicite
  du mandat, §6) : `.side-nav{gap:24px}` → **`gap:12px`** ; le supplément vient
  désormais du `padding-top:14px` ajouté par le séparateur lui-même — distance
  visuelle totale mesurée **27px** entre le dernier item d'un groupe et le titre du
  suivant (cible 22–28px). `.nav-group-title{margin-bottom}` réduit de 10px à
  **7px** pour compenser le `gap:5px` déjà présent entre les enfants de `.nav-group`
  — distance titre→premier item mesurée **12px** (cible 10–14px).
- **Sidebar réduite (collapsed)** : nouvelle règle `.nav-collapsed .nav-group+
  .nav-group{border-top:0;padding-top:12px}` — le séparateur disparaît, la
  séparation entre groupes reste assurée uniquement par l'espace (12px de padding +
  12px de gap = 24px), jamais par un trait qui aurait été disproportionné une fois
  les titres masqués.
- **Drawer mobile** : alimenté par la même source `NAV_GROUPS`/`renderNav()`
  qu'auparavant (inchangée) — hérite donc automatiquement des mêmes titres et
  séparateurs, sans code dédié supplémentaire.

## Non modifié (vérifié explicitement)

- `NAV_GROUPS`, `NAV_ITEMS`, routes, `renderNav()` (logique), `updateNav()`,
  permissions, badges (ids, classes, calculs), `state.view`/state métier, sidebar
  toggle, menu utilisateur, routage mobile, PWA Collaborateur, portail Cabinet :
  **aucune ligne touchée**.
- `.side-item`, `.side-item.active`, `.side-item.active::before` (barre verticale),
  `.side-item svg` : **aucune modification** — géométrie et comportement de l'état
  actif strictement identiques à V3.9.3.
- **13 fonctions métier** vérifiées byte-identiques à V3.9.3
  (`computeRevenueKPIs`, `kpiCounts`, `blockOrder`, `moveOrderToStage`,
  `orderStatusInfo`, `filteredOrders`, `notifColor`, `userPermissions`, `can`,
  `isDentistMode`, `renderDentistMode`, `isStaffMode`, `renderStaffMode`).

## Constat annexe (documenté, non corrigé — hors périmètre)

En préparant le test NAVH05, une mesure du **fond propre** de l'item actif
(`background` shorthand + `var(--surface-selected)`) s'est révélée occasionnellement
transparente **après l'exécution complète de la suite persistée dans une même page**
(des centaines de `renderNav()`/`render()` imbriqués par les tests hérités). Ce
comportement est **reproduit à l'identique sur V3.9.3 non modifiée** — c'est donc un
artefact latent préexistant, indépendant de cette version, jamais observé en usage
réel (chargement de page normal, y compris après des dizaines de `renderNav()`
consécutifs en isolation — voir Test Report). Le texte, l'icône et la barre verticale
de l'item actif restent, eux, parfaitement bleus dans tous les cas. NAVH05 a donc été
écrit pour mesurer ces trois signaux fiables plutôt que le fond de l'item — voir
`DENTALFLOW_V3_9_4_TEST_REPORT.md` pour le détail de la reproduction.

## Non-régression

- **393/393 tests persistés PASS** (385 hérités de V3.9.3 intégralement conservés +
  8 nouveaux NAVH01-NAVH08).
- **Playwright réel dédié : 30/30 vérifications PASS** — desktop (1440px, 1024px :
  hiérarchie typographique mesurée, séparateurs présents/absents aux bons endroits,
  état actif inchangé, sidebar réduite propre) et mobile (430/390/375px : titres
  visibles, séparateurs discrets, aucun overflow horizontal) + dark/light/system.
  0 erreur console.
- **Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite
  complète.**
- **4 scripts Playwright hérités de V3.8.8/V3.9.1 rejoués sans modification** :
  tous PASS, 0 erreur console.
- **13 fonctions métier byte-identiques** à V3.9.3.
- `node --check` PASS sur les 5 blocs `<script>`.
- Zéro erreur console sur l'ensemble des scénarios testés.
