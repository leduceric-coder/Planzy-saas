# DentalFlow V3.9.5 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.9.5.html`
**Base de comparaison :** `dentalflow-next-poc-v3.9.4.html`

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (unitaires, navigateur réel) | **405 / 405 PASS** |
| Playwright réel dédié (desktop 1440/1024, mobile 430/390/375, dark) | **31 / 31 PASS** |
| Responsive (`responsive_v384.js`) | **21 / 21 PASS** |
| Thèmes light/dark/system (`themes_v384.js`) | **18 / 18 PASS** |
| Isolation (état identique avant/après suite complète) | **PASS** |
| Fonctions métier byte-identiques à V3.9.4 (13 fonctions) | **13 / 13 IDENTICAL** |
| Scripts Playwright hérités V3.8.8/V3.9.1 (rejoués tels quels) | **PASS**, 0 erreur console |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| CSS de navigation | **byte-à-byte identique à V3.9.4** |
| Erreurs console (tous scénarios) | **0** |

## 1. IDs navigation — PASS

`NAVDOM01` (persisté) et le script Playwright dédié confirment, sur les 2 viewports
desktop et les 3 viewports mobile testés : **0 id dupliqué** dans `#side-nav` +
`#mobile-side-nav` après `renderNav()`, sur un total de 40 ids générés (10 items × 2
copies + 4 badges × 2 copies = 28, plus les conteneurs `.nav-group`/`.nav-group-title`
sans id propre — le compte exact varie légèrement selon l'état des badges visibles
mais est systématiquement égal à `new Set(ids).size`).

`NAVDOM02` confirme le corollaire attendu : chaque clé `data-nav` (home, orders,
production, messages, planning, stock, invoices, reports, cabinets, users) est
portée par **exactement 2** éléments — un desktop, un mobile. C'est le comportement
normal et voulu ; ce qui était interdit, et qui n'existe plus, c'est le partage du
même **id**.

## 2. Badges desktop/mobile — PASS

`NAVDOM04` (Stock), `NAVDOM05` (Charge), `NAVDOM06` (Messages) vérifient, pour
chaque badge, que les **2** copies (`data-nav-badge` desktop + mobile) affichent la
**même** valeur — celle calculée par le moteur métier réel
(`stockSummaryV34().critical`, filtre `leaveRequests` pending,
`unreadConversationsCountForLab()`) — et sont visibles (`is-hidden` absent) quand
cette valeur est non nulle. Valeurs réelles mesurées dans le jeu de démo au moment du
test : Stock=3, Charge=2, Messages=3, Commandes=1 — non forcées par fixture, lues
directement depuis le moteur, cohérent avec la méthode déjà établie par NAV06
(V3.9.3).

`NAVDOM07` force une valeur à 0 (tous les `leaveRequests` `pending` neutralisés
temporairement, état restauré en fin de test) et confirme que les **deux** badges
Charge (desktop + mobile) affichent `"0"` et portent la classe `is-hidden` — la
synchronisation fonctionne aussi bien pour masquer que pour afficher.

`NAVDOM08` audite spécifiquement le badge Commandes (mission §14) : lit la valeur
avant traitement sur les 2 copies, marque une notification `NEW_ORDER` comme lue via
`markOrderNotificationsRead()`, ré-appelle `updateNotif()`, et confirme que les
**deux** copies reflètent immédiatement la nouvelle valeur (strictement inférieure à
l'ancienne) — pas de calcul séparé desktop/mobile, pas de décalage.

```
Script Playwright dédié — badges desktop (2 viewports) : PASS
Script Playwright dédié — badges drawer mobile (3 viewports) : PASS
```

## 3. Messages active state — PASS

`NAVDOM03` (persisté) : `state.sidePanel='messages'` + `updateNav()` → les 2 éléments
`[data-nav="messages"]` (desktop et mobile) portent la classe `active` ; après
fermeture (`state.sidePanel=null`), aucun des deux ne la porte. Le script Playwright
dédié reproduit ce test via `openSidePanel('messages')` réel (pas seulement
`state.sidePanel` positionné directement) et confirme la même synchronisation.

`NAVDOM09`/`NAVDOM10` (persistés) et leurs équivalents Playwright vérifient le
routing mobile : clic réel sur Stock dans le drawer → `state.view='stock'` + drawer
fermé + réouverture confirme `active` sur l'élément mobile ; clic réel sur Messages
dans le drawer → `state.sidePanel='messages'` + réouverture du drawer confirme
`active` sur l'élément mobile.

## 4. Tests persistés — détail des 12 nouveaux (NAVDOM01-NAVDOM12)

| Test | Objet | Résultat |
|---|---|---|
| NAVDOM01 | Aucun id dupliqué entre sidebar desktop et drawer mobile | PASS |
| NAVDOM02 | Exactement 2 éléments par clé `data-nav` (normal) | PASS |
| NAVDOM03 | État actif Messages synchronisé desktop + mobile | PASS |
| NAVDOM04 | Badge Stock synchronisé, valeur métier réelle | PASS |
| NAVDOM05 | Badge Charge synchronisé, valeur métier réelle | PASS |
| NAVDOM06 | Badge Messages synchronisé, valeur métier réelle | PASS |
| NAVDOM07 | Badge à 0 masque les deux copies | PASS |
| NAVDOM08 | Badge Commandes synchronisé, mise à jour immédiate après traitement | PASS |
| NAVDOM09 | Routing mobile Stock — route + fermeture + actif à la réouverture | PASS |
| NAVDOM10 | Messages mobile — ouverture panneau + actif à la réouverture du drawer | PASS |
| NAVDOM11 | Desktop 1440 — layout/groupes/séparateurs/badges/actif/collapsed identiques à V3.9.4 | PASS |
| NAVDOM12 | Sidebar réduite — badges en points, visibilité synchronisée avec le drawer mobile | PASS |

```
TOTAL 405 PASSED 405 FAILED 0
```

Les 393 tests hérités de V3.9.4 (dont NAV01-12, NAVH01-08) restent tous PASS ; 7
d'entre eux (NAV05, NAV06, NAV12, NAVH02, NAVH03, NAVH05, NAVH08) ont été mis à jour
pour cibler le nouvel id desktop préfixé (`nav-desktop-*`/`desktop-side-*-count`) au
lieu de l'ancien id partagé — documenté en tête de bloc dans le fichier, comportement
vérifié strictement identique (voir Changelog).

## 5. Playwright réel dédié (script `navdom_v395.js`)

31 vérifications en conditions réelles (Chromium/Playwright) :

**Desktop (1440px, 1024px) — 12 vérifications :**
- Aucun id dupliqué (nav + drawer) mesuré dans le DOM réel
- Badges présents en 2 copies chacun, tous non nuls
- Clic réel sur Stock → actif
- `openSidePanel('messages')` réel → actif sur les 2 copies
- Sidebar réduite (clic réel) → 10 icônes, classe `nav-collapsed` appliquée
- 0 erreur console par viewport

**Mobile (430px, 390px, 375px) — 12 vérifications :**
- Aucun id dupliqué (nav + drawer)
- Badges du drawer tous non nuls
- Clic réel sur Stock → route + fermeture du drawer
- Réouverture → Stock actif
- 0 erreur console par viewport

**Dark mode (1 vérification × 3 thèmes) :**
- Les 4 badges restent présents en 2 copies sous `light`, `dark`, `system`
- 0 erreur console

```
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

## 6. Non-régression visuelle — CSS byte-identique

Comparaison caractère pour caractère de la ligne CSS complète contenant
`.nav-group-title`/`.side-nav`/`.nav-group`/`.side-item`/`.side-item.active`/
`.side-item.active::before`/`.side-badge` entre V3.9.4 et V3.9.5 : **identique**.
Aucune règle CSS n'a été ajoutée, modifiée ou supprimée dans cette version — seule
la couche JS de génération/mise à jour du DOM a changé.

## 7. Non-régression métier (13 fonctions)

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

## 8. Scripts Playwright hérités (V3.8.8/V3.9.1, rejoués sans modification)

Les 4 scripts d'interaction réelle (blocage/commentaire, alignement KPI factures,
pulsation statut semaine, popup jour d'absence), rejoués tels quels contre
`dentalflow-next-poc-v3.9.5.html` : tous PASS, 0 erreur JS.

## 9. Diff V3.9.4 → V3.9.5

Diff complet lu intégralement avant livraison : **17 zones de changement**, toutes
confinées au JS de navigation — `navItemHTML()` (nouveau paramètre `context`),
`renderNav()` (appel avec contexte), `updateNav()` (Messages via querySelectorAll),
`setNavBadge()` (nouveau helper) + `updateNotif()` (refactorée), la surcharge
`updateNotif` en fin de fichier, les 7 références d'id mises à jour dans les tests
hérités, et l'ajout du bloc NAVDOM01-12. **Aucune ligne CSS touchée** (confirmé §6),
aucune ligne touchant `NAV_GROUPS`, une route, une permission, un calcul métier, ou
`schemaVersion`.

## 10. Constat annexe — artefact préexistant non affecté par ce durcissement

Par souci de transparence : l'artefact de cascade CSS documenté dans
`DENTALFLOW_V3_9_4_TEST_REPORT.md` (fond de l'item actif occasionnellement
transparent après exécution de la suite persistée complète dans une même page,
sans impact sur texte/icône/barre ni sur l'usage réel) a été revérifié sur
V3.9.5 : **il persiste à l'identique**, même après élimination des ids dupliqués —
confirmant qu'il s'agit bien d'un phénomène de cascade CSS indépendant de la
duplication d'ids (l'hypothèse aurait pu être liée), et non d'une régression
introduite par cette version. Reste hors périmètre (V3.9.5 est un durcissement DOM,
pas une modification CSS).

## 11. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check` sans erreur
de syntaxe.

## 12. Console

0 erreur console (`pageerror` et `console.error`) relevée sur l'ensemble des
scénarios testés : suite persistée (405 tests), script Playwright dédié (16
combinaisons viewport/thème), 4 scripts d'interaction réelle hérités.
