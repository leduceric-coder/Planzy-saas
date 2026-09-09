# DentalFlow V3.9.3 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.9.3.html`
**Base de comparaison :** `dentalflow-next-poc-v3.9.2.html`

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (unitaires, navigateur réel) | **385 / 385 PASS** |
| Playwright réel dédié navigation (desktop 1440/1024, mobile 430/390/375, dark) | **44 / 44 PASS** |
| Responsive (`responsive_v384.js`) | **21 / 21 PASS** |
| Thèmes light/dark/system (`themes_v384.js`) | **18 / 18 PASS** |
| Isolation (état identique avant/après suite complète) | **PASS** |
| Fonctions métier byte-identiques à V3.9.2 (13 fonctions) | **13 / 13 IDENTICAL** |
| Scripts Playwright hérités V3.8.8/V3.9.1 (rejoués tels quels) | **PASS**, 0 erreur console |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| Erreurs console (tous scénarios) | **0** |

## 1. Correspondance tests obsolètes → tests remplacés (§29 du mandat)

Les tests suivants, hérités de V3.5→V3.7.1, vérifiaient explicitement le comportement
de l'accordéon « Outils ». Ce comportement n'existe plus (changement UX volontaire de
cette mission) — ils sont supprimés, jamais laissés à affirmer un état qui n'est plus
vrai :

| Test supprimé | Ce qu'il vérifiait | Repris par |
|---|---|---|
| `V3.5 accordéon Outils : ouvre et ferme réellement, ne se rouvre jamais tout seul` | Ouverture/fermeture manuelle du groupe, absence de réouverture automatique | Obsolète — plus d'accordéon à ouvrir/fermer |
| `V3.5 accordéon Outils : aria-expanded reflète l'état réel` | `aria-expanded` du bouton toggle | Obsolète — plus de bouton toggle |
| `V3.5.1/V3.6/V3.8.2 navigation : Outils = Charge/Stock/Rapports/Factures/Cabinets/Utilisateurs` | Labels du groupe Outils, routes inchangées, pas d'entrée Achats/Journal | **NAV01** (composition des 3 nouveaux groupes) + **NAV02** (routes inchangées, pas d'Achats/Journal) |
| `V3.7.1 O01-O03 : chevron Outils — SVG réel, classe .open` | Chevron SVG réel (pas le caractère ›), classe `.open` synchronisée desktop/mobile | Obsolète — plus de chevron. Son intention (icônes SVG réelles, même source desktop/mobile) est reprise par **NAV07** (icônes réelles en mode réduit) et **NAV08** (contenu identique desktop/mobile) |

**373 tests hérités de V3.9.2 restent strictement inchangés** (377 − 4 tests
d'accordéon retirés). Aucun autre test existant n'a été modifié ni retiré.

## 2. Nouveaux tests persistés NAV01-NAV12

| Test | Objet | Résultat |
|---|---|---|
| NAV01 | `NAV_GROUPS` — 3 groupes exacts, items dans l'ordre attendu | PASS |
| NAV02 | Routes `NAV_ITEMS` strictement inchangées, aucune route renommée | PASS |
| NAV03 | Sidebar desktop — 3 titres de groupe affichés, aucun texte « Outils » | PASS |
| NAV04 | Ordre strict des 10 liens dans le DOM | PASS |
| NAV05 | État actif — fond sélectionné, barre verticale visible, un seul item actif à la fois | PASS |
| NAV06 | Badges Charge/Stock — valeurs métier inchangées après réorganisation | PASS |
| NAV07 | Sidebar réduite — titres masqués, 10 icônes, tooltips `title` conservés | PASS |
| NAV08 | Drawer mobile — mêmes 3 groupes, aucun « Outils » (contenu DOM) | PASS |
| NAV09 | Clic dans le drawer mobile — navigue et referme (Stock puis Factures) | PASS |
| NAV10 | Permissions — regroupement n'élargit ni ne restreint l'accès (U1 vs U3) | PASS |
| NAV11 | Géométrie desktop — aucun débordement, footer utilisateur visible | PASS |
| NAV12 | Dark mode — titres, état actif, barre lisibles sous light/dark/system | PASS |

```
TOTAL 385 PASSED 385 FAILED 0
```

## 3. Playwright réel dédié (script `nav_v393.js`)

44 vérifications en conditions réelles (Chromium/Playwright, pas de simulation
d'événements) :

**Desktop (1440px, 1024px) — 22 vérifications :**
- Composition exacte des 3 groupes dans le DOM réel (titres + items)
- Absence littérale du texte « Outils »
- Clic réel sur Commandes → Stock → Factures : route change, état actif exclusif à
  chaque étape (jamais deux items actifs simultanément)
- Géométrie de la barre active (`::before`) : largeur non nulle, item dans les
  limites de la sidebar (`getBoundingClientRect()`)
- Sidebar réduite (clic réel sur `#sidebar-toggle`) : titres masqués
  (`display:none` calculé), 10 icônes SVG présentes, `title` (tooltip) sur chaque
  bouton
- 0 erreur console par viewport

**Mobile (430px, 390px, 375px) — 21 vérifications :**
- Ouverture réelle du drawer (clic sur `#mobile-menu-btn`)
- Aucun débordement horizontal (`scrollWidth <= innerWidth + 2`) drawer ouvert
- Composition exacte des 3 groupes dans le drawer
- Absence littérale du texte « Outils » dans le drawer
- Défilement vertical activé (`overflow-y:auto`) + footer utilisateur visible
- Clic réel sur Stock → navigation + fermeture automatique du drawer
- Clic réel sur Factures → navigation + fermeture automatique du drawer
- 0 erreur console par viewport

**Dark mode (1 vérification × 3 thèmes) :**
- Titre de groupe, texte de l'item actif et barre verticale mesurés lisibles
  (`getComputedStyle`) sous `light`, `dark`, `system`
- 0 erreur console

```
NAV PLAYWRIGHT TOTAL 44 PASSED 44 FAILED 0
```

## 4. Responsive / thèmes / isolation

- `responsive_v384.js` : 7 viewports × 3 modes = 21/21 PASS.
- `themes_v384.js` : light/dark/system × 6 vues = 18/18 PASS.
- `isolation_v384.js` : export JSON de l'état avant/après la suite complète de 385
  tests — strictement identique (`before length 111061 after length 111061 identical
  true`), confirmant qu'aucun des nouveaux tests NAV0x ne laisse de mutation durable
  (chaque test restaure `state.view`/`state.currentUserId`/`state.sidebarCollapsed`/
  `state.theme` à sa valeur d'origine).

## 5. Non-régression métier (13 fonctions)

Extraction et comparaison textuelle du corps complet des 13 fonctions nommées par la
mission entre V3.9.2 et V3.9.3 :

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

13/13 identiques byte-à-byte — `renderDentistMode`/`renderStaffMode` confirment
l'absence de toute régression sur le portail Cabinet et la PWA Collaborateur.

## 6. Scripts Playwright hérités (V3.8.8/V3.9.1, rejoués sans modification)

Les 4 scripts d'interaction réelle déjà adaptés en V3.9.2 sont rejoués tels quels
(seul le nom de fichier cible est substitué) contre `dentalflow-next-poc-v3.9.3.html` :

- **Partie A** — Blocage manuel de commande, commentaire, clic dans un textarea ne
  ferme pas le panneau : tous les scénarios passent, 0 erreur JS.
- **Partie B** — Alignement des 4 KPI facture : `maxDelta:0` aux largeurs desktop,
  comportement responsive attendu en dessous de 768px, 0 erreur JS.
- **Partie C** — Animation de statut hebdomadaire : tous les scénarios passent, 0
  erreur JS.
- **Partie D** — Popup jour d'absence : tous les scénarios passent, 0 erreur JS.

Ces 4 scripts n'exercent aucun composant de navigation directement — leur succès
inchangé confirme qu'aucune page autre que la sidebar/le drawer n'a été affectée par
cette version.

## 7. Diff V3.9.2 → V3.9.3

Diff complet lu intégralement avant livraison : **18 zones de changement**, toutes
confinées à la navigation — CSS (règles `.nav-block`/`.nav-group-title`/`.side-nav`/
`.side-item`/suppression du bloc `.nav-tools*`), HTML (suppression de la `<div
class="nav-title">` statique), JS (`NAV_GROUPS`, `renderNav()`, 2 handlers de clic,
1 listener mobile, 1 commentaire), et les tests de navigation remplacés (§1
ci-dessus). Aucune ligne touchant un moteur métier, une route, un `badgeId`, ou
`schemaVersion`.

## 8. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check` sans erreur
de syntaxe.

## 9. Console

0 erreur console (`pageerror` et `console.error`) relevée sur l'ensemble des
scénarios testés : suite persistée (385 tests), script Playwright dédié navigation
(21 combinaisons viewport/thème), 4 scripts d'interaction réelle hérités.
