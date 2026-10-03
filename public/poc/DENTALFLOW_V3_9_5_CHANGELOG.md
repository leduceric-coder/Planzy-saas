# DentalFlow V3.9.5 — Changelog

**Base :** `dentalflow-next-poc-v3.9.4.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.5.html`
**Mandat :** Durcissement DOM de la navigation — élimination des IDs dupliqués entre
sidebar desktop et drawer mobile.
**schemaVersion :** 10 (inchangé)

V3.9.5 élimine les IDs DOM dupliqués entre la sidebar desktop et le drawer mobile.
Les éléments répliqués sont désormais adressés par `data-nav`/`data-nav-badge` et mis
à jour avec `querySelectorAll()`, garantissant la synchronisation des états actifs et
des badges sur desktop et mobile. **Aucune modification visuelle** : CSS strictement
inchangée (vérifié byte-à-byte, voir Test Report), architecture `NAV_GROUPS`/
`NAV_ITEMS` inchangée, aucune route, permission, calcul de badge ou fonction métier
modifiés.

## Cause corrigée

Depuis V3.7, `navItemHTML(k)` générait `id="nav-${k}"` et `id="${it.badgeId}"`, et
`renderNav()` injectait la même fonction dans `#side-nav` (sidebar desktop) ET
`#mobile-side-nav` (drawer mobile) — produisant deux éléments avec le **même id** dans
le document à chaque rendu (ex. deux `id="nav-messages"`, deux
`id="side-stock-count"`). `document.getElementById()`/`$()` (basé sur
`querySelector()`) ne renvoient que le **premier** élément trouvé, laissant la copie
mobile silencieusement non synchronisée dans certains cas.

## Changé

- **`navItemHTML(k, context)`** accepte désormais un `context` (`'desktop'` ou
  `'mobile'`) et génère des ids uniques : `id="nav-desktop-${k}"` /
  `id="nav-mobile-${k}"` pour chaque item, `id="desktop-${badgeId}"` /
  `id="mobile-${badgeId}"` pour chaque badge. `NAV_ITEMS.badgeId` est conservé tel
  quel (compatibilité) — il sert de suffixe d'id préfixé par le contexte plutôt que
  d'id DOM partagé directement.
- Chaque badge porte désormais l'attribut **`data-nav-badge="${k}"`**, clé métier
  commune aux deux copies — exactement le même principe que `data-nav`, déjà utilisé
  pour la clé métier des items eux-mêmes.
- **`renderNav()`** appelle `navHTML('desktop')` pour `#side-nav` et
  `navHTML('mobile')` pour `#mobile-side-nav` — source canonique unique
  (`NAV_GROUPS`/`NAV_ITEMS`/`navItemHTML`) strictement conservée, aucune seconde
  liste de navigation créée.
- **`updateNav()`** : l'état actif de Messages n'utilise plus `$('#nav-messages')`
  (qui ne ciblait que la première des deux copies, desktop) mais
  `document.querySelectorAll('.side-item[data-nav="messages"]')`, mettant à jour les
  **deux** copies à chaque appel.
- **Nouveau helper `setNavBadge(key, value)`** : calcule une seule fois la valeur
  (côté appelant) et l'applique aux deux copies via
  `document.querySelectorAll('[data-nav-badge="${key}"]')` — texte et classe
  `is-hidden` synchronisés en un seul appel, jamais de double calcul.
- **`updateNotif()`** refactorée pour utiliser `setNavBadge('messages', …)`,
  `setNavBadge('stock', …)`, `setNavBadge('planning', …)`, `setNavBadge('orders', …)`
  — **aucun calcul métier modifié** (mêmes fonctions sources :
  `unreadConversationsCountForLab()`, `stockSummary().critical`, filtre
  `leaveRequests` pending, `unreadNotifCount('LAB','NEW_ORDER')`). La surcharge
  `updateNotif` (raffinement `stockSummaryV34()` du badge Stock) utilise elle aussi
  `setNavBadge('stock', …)`.

## Non modifié (vérifié explicitement)

- **CSS strictement inchangée** — `.nav-group-title`, `.side-nav`, `.nav-group`,
  `.side-item`, `.side-item.active`, `.side-item.active::before`, `.side-badge`,
  CSS du drawer mobile : **byte-à-byte identiques** à V3.9.4 (la ligne CSS complète
  de la sidebar a été comparée caractère pour caractère).
- `NAV_GROUPS`, l'ordre des groupes et des items, les routes, les labels : inchangés.
- Aucun calcul de badge modifié — seules les cibles DOM de mise à jour ont changé.
- **13 fonctions métier** vérifiées byte-identiques à V3.9.4
  (`computeRevenueKPIs`, `kpiCounts`, `blockOrder`, `moveOrderToStage`,
  `orderStatusInfo`, `filteredOrders`, `notifColor`, `userPermissions`, `can`,
  `isDentistMode`, `renderDentistMode`, `isStaffMode`, `renderStaffMode`).

## Non-régression

- **405/405 tests persistés PASS** (393 hérités de V3.9.4 + 12 nouveaux
  NAVDOM01-NAVDOM12). 7 tests hérités qui ciblaient l'ancien id partagé (`nav-orders`,
  `nav-stock`, `nav-home`, `side-planning-count`, `side-stock-count`) ont été mis à
  jour vers le nouvel id desktop préfixé (`nav-desktop-*`, `desktop-side-*-count`) —
  le comportement qu'ils vérifient (état actif, valeur des badges) reste strictement
  identique, seule l'adresse DOM change (documenté en tête de bloc dans le fichier).
- **Playwright réel dédié : 31/31 vérifications PASS** — desktop (1440px, 1024px :
  aucun id dupliqué, badges non nuls sur les deux copies, Stock actif, Messages actif
  desktop+mobile, sidebar réduite) et mobile (430/390/375px : aucun id dupliqué,
  badges du drawer non nuls, routing Stock avec fermeture puis état actif à la
  réouverture) + dark/light/system. 0 erreur console.
- **Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite
  complète.**
- **4 scripts Playwright hérités de V3.8.8/V3.9.1 rejoués sans modification** :
  tous PASS, 0 erreur console.
- **13 fonctions métier byte-identiques** à V3.9.4.
- `node --check` PASS sur les 5 blocs `<script>`.
- Zéro erreur console sur l'ensemble des scénarios testés.
