# Kanvix V2.4.15.2 — Correctifs suite au retour utilisateur sur V2.4.15.1
## Suppression du menu ••• inutile du cockpit + suppression totale de la saccade au changement d'onglet

Source de vérité : `kanvix-next-gen-v2.4.15.1.html`
Version livrée : `kanvix-next-gen-v2.4.15.2.html`

Retour utilisateur (2 points, sur captures) :
1. « Dans la vignette chantier, le bouton avec les 3 points ne fonctionne pas et finalement ne sert à rien > à supprimer. »
2. « Dans un chantier, si je ne suis pas tout en haut de page et que je passe sur les différents onglets, l'ouverture de l'onglet me ramène en haut, donnant un effet de saccade. Il ne faudrait pas bouger la page. »

---

## 1. Menu ••• du cockpit — supprimé

Le bouton ••• de l'en-tête du cockpit (`.cockpit-head-row`) appelait `projectCardMenu(p)`, qui propose Modifier/Clôturer/Réouvrir/Archiver/Restaurer/Supprimer selon le cycle de vie. Ces mêmes actions restent intégralement accessibles depuis le menu ••• de la carte du chantier sur la page **Chantiers** (`siteCard()` utilise la même fonction) : rien n'est perdu, seule la redondance dans le cockpit est retirée, comme demandé.

**Changement** : suppression d'un seul appel dans `renderProject()` :
```diff
  <div class="cockpit-head-row">
    ${badge}
-   ${projectCardMenu(p)}
  </div>
```
`projectCardMenu()` elle-même n'est pas modifiée (byte-identique, vérifié) — elle reste utilisée telle quelle par la liste Chantiers.

## 2. Saccade au changement d'onglet — cause complète corrigée

Le correctif V2.4.15.1 (mesurer et compenser le déplacement de `.tabs`) restait sans effet dans un cas précis : quand le nouvel onglet est **réellement plus court** que ne le permettait la position de défilement courante, le navigateur recale `scrollY` sur le nouveau maximum — et aucune compensation a posteriori ne peut revenir au-delà de ce maximum (on ne peut pas défiler plus loin que ce que le document permet). C'est exactement le scénario des captures : en cours de lecture de l'onglet « Aujourd'hui » (avec le planning du jour), passer sur « Équipe » (contenu plus court) ramenait la page en haut.

**Correctif** : `projectTab()` empêche maintenant `#projectContent` de rétrécir d'un onglet à l'autre au cours d'une même visite de la fiche — un plancher de hauteur (`min-height`), remonté à la plus grande hauteur déjà atteinte sur cette fiche, appliqué **avant** le remplacement du contenu :
```js
function projectTab(name, b) {
  let tabsEl = $(".tabs"),
    contentEl = $("#projectContent"),
    topBefore = tabsEl ? tabsEl.getBoundingClientRect().top : null;
  if (contentEl) {
    let currentHeight = contentEl.getBoundingClientRect().height,
      floor = parseFloat(contentEl.style.minHeight) || 0;
    if (currentHeight > floor) contentEl.style.minHeight = currentHeight + "px";
  }
  $$(".tab").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  contentEl.innerHTML = projectTabContent(name, app.ui.projectId);
  if (tabsEl && topBefore !== null) {
    let delta = tabsEl.getBoundingClientRect().top - topBefore;
    if (delta) window.scrollBy(0, delta);
  }
}
```
Le plancher ne fait jamais que **monter** : un onglet plus long que tout ce qui a été vu jusque-là grandit toujours librement au-delà. Il redevient vide dès qu'on change de chantier (une fiche fraîche est régénérée sans style résiduel).

**Preuve** (Playwright, clics réels, scénario exact du retour utilisateur) :
- Scrollé au maximum de « Aujourd'hui » (177px) puis clic sur « Équipe » : `scrollY` reste à **177px, 0 déplacement** (contre un recalage à 155px et une chute visible en V2.4.15.1).
- Séquence complète des 7 onglets (+ retour) testée à 3 profondeurs de défilement différentes (50/150/300px) : **0px de déplacement dans les 24 transitions mesurées**.
- Toujours aucun `renderPage()`, aucun `scrollTo(0,0)`, aucun smooth scroll, aucune animation.

## 3. Tests

Nouvelle suite `recette-correctifs-v2.4.15.2.mjs` : **16/16 tests passent** — suppression du menu (présence/absence, actions toujours accessibles depuis Chantiers), 5 scénarios de saccade (dont le scénario exact signalé), remise à zéro du plancher au changement de chantier, absence de `renderPage()`, gel du reste de la fiche chantier (comparaison structurelle avec V2.4.15.1), console, byte-identité de 32 fonctions métier (dont `projectCardMenu`, inchangée).

Rejeu complet : `recette-correctifs-v2.4.15.1.mjs` (**111/111**) et `recette-harmonisation-ui-v2.4.15.mjs` (**105/105**) toujours entièrement verts contre V2.4.15.2, plus les 21 autres suites actives — toutes vertes, seuls les 2 échecs déjà documentés (legacy Accueil pré-V2.4.5, legacy Kanban pré-V2.4.11.3) réapparaissent à l'identique, confirmés sans lien avec ce round.

## 4. Console

0 erreur JavaScript applicative.

## 5. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"`, `SCHEMA_VERSION = 8` — inchangés.
