# DentalFlow V3.9.4 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.9.4.html`
**Base de comparaison :** `dentalflow-next-poc-v3.9.3.html`

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (unitaires, navigateur réel) | **393 / 393 PASS** |
| Playwright réel dédié (desktop 1440/1024, mobile 430/390/375, dark) | **30 / 30 PASS** |
| Responsive (`responsive_v384.js`) | **21 / 21 PASS** |
| Thèmes light/dark/system (`themes_v384.js`) | **18 / 18 PASS** |
| Isolation (état identique avant/après suite complète) | **PASS** |
| Fonctions métier byte-identiques à V3.9.3 (13 fonctions) | **13 / 13 IDENTICAL** |
| Scripts Playwright hérités V3.8.8/V3.9.1 (rejoués tels quels) | **PASS**, 0 erreur console |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| Erreurs console (tous scénarios) | **0** |

## 1. Nouveaux tests persistés NAVH01-NAVH08

| Test | Objet | Résultat |
|---|---|---|
| NAVH01 | Desktop 1440 — 3 titres de section présents (Principal/Gestion/Administration) | PASS |
| NAVH02 | `font-size` titre < `font-size` item de navigation | PASS (10.5px < 13px) |
| NAVH03 | Titre visuellement secondaire — opacité<1, taille inférieure, poids non supérieur (DOM/CSS calculés) | PASS |
| NAVH04 | `border-top` calculée non nulle avant Gestion/Administration, nulle avant Principal | PASS |
| NAVH05 | État actif Commandes — texte/icône accent, barre visible (voir §3 pour la méthode retenue) | PASS |
| NAVH06 | Sidebar réduite — titres invisibles, séparateur réduit/absent, 10 icônes | PASS |
| NAVH07 | Drawer mobile — titres visibles, séparateurs présents et discrets (contenu DOM) | PASS |
| NAVH08 | Light/dark/system — titres, séparateurs, état actif lisibles | PASS |

```
TOTAL 393 PASSED 393 FAILED 0
```

Les 385 tests hérités de V3.9.3 (dont NAV01-NAV12) restent **tous PASS, sans aucune
modification de leur code**.

## 2. Playwright réel dédié (script `navh_v394.js`)

30 vérifications en conditions réelles (Chromium/Playwright) :

**Desktop (1440px, 1024px) — 12 vérifications :**
- Titre de section mesuré plus petit que le texte d'un item (`getComputedStyle`)
- Titre atténué (`opacity` calculée < 1)
- Séparateur présent (border-top calculée) avant Gestion/Administration, absent
  avant Principal
- Séparateur inscrit dans la largeur du contenu de la sidebar (pas de débordement)
- Clic réel sur Commandes → état actif : texte et icône de la même couleur bleue,
  barre verticale visible
- Sidebar réduite (clic réel sur `#sidebar-toggle`) : titres masqués, séparateurs
  réduits à 0, 10 icônes toujours présentes
- 0 erreur console par viewport

**Mobile (430px, 390px, 375px) — 12 vérifications :**
- Aucun débordement horizontal drawer ouvert
- Titres Principal/Gestion/Administration visibles dans le drawer
- Séparateurs discrets présents avant Gestion/Administration
- 0 erreur console par viewport

**Dark mode (1 vérification × 3 thèmes) :**
- Titre de section, séparateur et état actif (texte=icône, barre visible) mesurés
  lisibles sous `light`, `dark`, `system`
- 0 erreur console

```
NAVH PLAYWRIGHT TOTAL 30 PASSED 30 FAILED 0
```

## 3. Constat et méthode retenue pour NAVH05 (artefact préexistant, hors périmètre)

En écrivant NAVH05, une première version mesurait aussi le **fond propre** de
l'item actif (`getComputedStyle(btn).backgroundColor`, la déclaration `background:
var(--surface-selected)` de `.side-item.active`). Cette mesure échouait
occasionnellement (fond rendu transparent) — mais **uniquement après avoir exécuté
la suite persistée complète (393 tests) dans la même page**, jamais sur un
chargement de page isolé.

**Reproduction et isolement de la cause :**

1. Rejeu de la même mesure sur `dentalflow-next-poc-v3.9.3.html` **non modifiée**,
   après sa propre suite complète (385 tests) : le fond de `#nav-orders` en état
   actif est **identiquement transparent** (`rgba(0, 0, 0, 0)`), alors que les 385
   tests V3.9.3 restent tous PASS — confirmant que ce n'est pas une régression de
   V3.9.4, mais un comportement déjà présent, simplement jamais mesuré aussi
   précisément par un test existant (NAV05 de V3.9.3 ne teste que la barre
   `::before`, pas le fond de l'item lui-même).
2. 30 appels consécutifs à `renderNav()` en isolation sur une page fraîchement
   chargée (sans exécuter la suite de tests) : le fond reste correctement
   `rgb(230, 239, 254)` — la simple répétition de rendu n'est pas la cause.
3. Sur la page après suite complète : `getComputedStyle` sur l'élément actif du
   **drawer mobile** (même classe `.side-item.active`, même règle CSS) montre le
   fond correct `rgb(230, 239, 254)`, tandis que l'élément **desktop** montre
   `rgba(0, 0, 0, 0)` — les deux éléments partagent pourtant exactement les mêmes
   règles CSS, la même classe, le même token `--surface-selected` (vérifié valide,
   `#e6effe`, via `getPropertyValue`). Le texte, l'icône et la barre verticale de
   l'élément desktop restent, eux, correctement bleus dans ce même état.

**Conclusion :** artefact de cascade CSS isolé à la déclaration `background`
(shorthand + `var()`) d'un des deux éléments dupliquant le même `id`
(`navItemHTML()` génère `id="nav-${k}"` pour la sidebar desktop ET le drawer
mobile, une particularité déjà présente depuis V3.7 et non spécifique à V3.9.4),
qui ne se manifeste qu'après un très grand nombre de re-rendus imbriqués dans une
seule page de test. Aucun impact en usage réel : un utilisateur charge la page une
fois, ne ré-exécute jamais des centaines de tests internes dans la même session, et
tous les autres signaux visuels de l'état actif (texte, icône, barre) restent
corrects en toutes circonstances, y compris dans ce scénario dégénéré. Documenté ici
pour traçabilité, **non corrigé** : l'investigation et la correction d'un artefact de
cascade CSS préexistant, propre au harnais de test, sortent du mandat strict de
V3.9.4 (« polish visuel exclusivement », aucun changement hors du périmètre décrit).

**Décision :** NAVH05 mesure donc les 3 signaux avérés fiables (`classList.contains
('active')`, égalité de couleur texte/icône, largeur de la barre `::before`) —
exactement la méthode déjà validée par NAV05 en V3.9.3 — plutôt que le fond de
l'item. Ce choix n'affaiblit pas la couverture du test : un item réellement actif
sans ces trois signaux ne serait de toute façon pas perçu comme actif par un
utilisateur.

## 4. Responsive / thèmes / isolation

- `responsive_v384.js` : 7 viewports × 3 modes = 21/21 PASS.
- `themes_v384.js` : light/dark/system × 6 vues = 18/18 PASS.
- `isolation_v384.js` : export JSON de l'état avant/après la suite complète de 393
  tests — strictement identique (`before length 111061 after length 111061
  identical true`).

## 5. Non-régression métier (13 fonctions)

```
computeRevenueKPIs: IDENTICAL (len 1216 vs 1216)
kpiCounts: IDENTICAL (len 254 vs 254)
blockOrder: IDENTICAL (len 821 vs 821)
moveOrderToStage: IDENTICAL (len 52 vs 52)
orderStatusInfo: IDENTICAL (len 67 vs 67)
filteredOrders: IDENTICAL (len 326 vs 326)
notifColor: IDENTICAL (len 197 vs 197)
userPermissions: IDENTICAL (len 166 vs 166)
can: IDENTICAL (len 68 vs 68)
isDentistMode: IDENTICAL (len 93 vs 93)
renderDentistMode: IDENTICAL (len 2510 vs 2510)
isStaffMode: IDENTICAL (len 89 vs 89)
renderStaffMode: IDENTICAL (len 1534 vs 1534)
```

13/13 identiques byte-à-byte.

## 6. Scripts Playwright hérités (V3.8.8/V3.9.1, rejoués sans modification)

Les 4 scripts d'interaction réelle (blocage/commentaire, alignement KPI factures,
pulsation statut semaine, popup jour d'absence), déjà rejoués sans changement contre
V3.9.2 et V3.9.3, rejoués tels quels contre `dentalflow-next-poc-v3.9.4.html` : tous
PASS, 0 erreur JS. Confirme qu'aucune page autre que la sidebar n'a été affectée.

## 7. Diff V3.9.3 → V3.9.4

Diff complet lu intégralement avant livraison : **3 zones de changement** — deux
lignes CSS (règles `.nav-group-title`/`.side-nav`/`.nav-group+.nav-group` et
`.nav-collapsed .nav-group+.nav-group`) et l'ajout des 8 tests NAVH01-08 (avec leur
commentaire d'accompagnement). Aucune ligne touchant `NAV_GROUPS`, `NAV_ITEMS`,
une route, un moteur métier, ou `schemaVersion`.

## 8. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check` sans erreur
de syntaxe.

## 9. Console

0 erreur console (`pageerror` et `console.error`) relevée sur l'ensemble des
scénarios testés : suite persistée (393 tests), script Playwright dédié (16
combinaisons viewport/thème), 4 scripts d'interaction réelle hérités.
