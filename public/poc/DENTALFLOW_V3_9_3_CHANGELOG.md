# DentalFlow V3.9.3 — Changelog

**Base :** `dentalflow-next-poc-v3.9.2.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.3.html`
**Mandat :** Refonte ciblée de l'architecture du menu principal — PRINCIPAL / GESTION /
ADMINISTRATION, suppression de l'accordéon « Outils »
**schemaVersion :** 10 (inchangé)

Modification strictement de navigation : architecture, hiérarchie visuelle, espacements,
icônes, badges, état actif, desktop, sidebar réduite, menu mobile. Aucune route
renommée, aucun changement de state métier, de permission, de moteur, de workflow, de
PWA Collaborateur ni de portail Cabinet.

## Changé

- **Suppression du groupe « Outils » et de son accordéon.** Le bouton, le chevron, le
  sous-conteneur replié (`.nav-tools`/`.nav-tools-toggle`), l'indentation et le trait
  vertical associés n'existent plus. Les 10 liens de navigation sont désormais répartis
  en **3 groupes toujours visibles**, jamais repliables :
  - **Principal** — Accueil, Commandes, Production, Messages
  - **Gestion** — Charge, Stock, Factures
  - **Administration** — Rapports, Cabinets, Utilisateurs
- **Nouvelle source canonique unique `NAV_GROUPS`.** Remplace `PRIMARY_NAV`/`TOOLS_NAV`.
  `NAV_ITEMS` (labels, routes, SVG, `badgeId`/`badgeClass`) reste **strictement
  inchangé** — aucune route renommée, aucun id modifié. `renderNav()` alimente la
  sidebar desktop (`#side-nav`) ET le drawer mobile (`#mobile-side-nav`) à partir de
  cette **même** source, comme avant (principe hérité de V3.7, jamais une deuxième liste
  hardcodée).
- **Titres de groupe** : 11px, 800/850, `letter-spacing:.07em`, majuscules par CSS
  uniquement (`text-transform:uppercase` — le texte source reste « Principal »,
  « Gestion », « Administration »), couleur `text-tertiary`, alignés avec le padding des
  entrées (12px). Écart entre groupes : 24px (`.side-nav{gap:24px}`). Pas de gros
  séparateur visuel — la hiérarchie vient de l'espace, comme demandé.
- **Icônes légèrement agrandies** : 18px → 19px, même trait pour toute la navigation,
  aucun SVG remplacé.
- **État actif amélioré.** Conserve le fond bleu doux existant
  (`background:#edf4ff`/`var(--surface-selected)` en dark) et ajoute une **barre
  verticale bleue discrète** à gauche de l'item actif :
  `.side-item.active::before{position:absolute;left:-8px;top:8px;bottom:8px;width:3px;
  border-radius:3px;background:var(--accent)}` — `var(--accent)` est déjà theme-aware
  (résolu automatiquement en light/dark/system), reste dans la zone de padding de la
  sidebar (aucun débordement mesuré).
- **Hover** : ajout d'une transition `background .14s ease` (dans la fourchette
  120–160ms demandée), aucune translation ni grossissement.
- **Espacements légèrement resserrés** : hauteur d'item inchangée (42px, dans la
  fourchette 42–44px demandée), `gap` interne au groupe 5px, `gap` entre groupes 24px
  (fourchette 22–28px demandée).
- **Sidebar réduite (collapsed)** : les titres de groupe sont masqués
  (`.nav-collapsed .nav-group-title{display:none}`), les 10 icônes restent visibles et
  cliquables, chaque bouton conserve son `title` (tooltip natif au survol) —
  comportement hérité, non modifié. La séparation entre groupes reste assurée par
  l'espace (`gap:24px`), jamais par du texte.
- **Drawer mobile** : alimenté par la même architecture `NAV_GROUPS`, affiche désormais
  les 3 groupes directement (plus de clic supplémentaire pour déplier « Outils »). Le
  clic sur un item réel referme toujours le drawer (logique simplifiée : il n'existe
  plus de bouton « Outils » à exclure de cette fermeture).

## Non modifié (vérifié explicitement)

- **Routes** : `home/orders/production/planning/stock/reports/users/invoices/cabinets`
  gardent exactement leur `view`, `messages` garde son `panel`. Aucune entrée
  `purchases`/`activity` recréée.
- **Badges métier** : `side-orders-count`, `side-planning-count`, `side-stock-count`,
  `side-message-count` — mêmes ids, mêmes classes (`badgeClass:'warn'` sur Charge),
  **aucun calcul touché** (`updateNotif()` inchangée).
- **Permissions** : la navigation ne filtrait déjà aucun lien par droit utilisateur
  avant V3.9.3 (confirmé par lecture de `navItemHTML()`/`renderNav()`) — le
  réagencement en groupes ne restreint ni n'élargit donc l'accès à aucune page.
- **13 fonctions métier** (`computeRevenueKPIs`, `kpiCounts`, `blockOrder`,
  `moveOrderToStage`, `orderStatusInfo`, `filteredOrders`, `notifColor`,
  `userPermissions`, `can`, `isDentistMode`, `renderDentistMode`, `isStaffMode`,
  `renderStaffMode`) — byte-identiques à V3.9.2, `renderDentistMode`/`renderStaffMode`
  confirmant qu'aucune régression n'a atteint le portail Cabinet ni la PWA
  Collaborateur.
- `state.toolsOpen` : peut subsister dans un ancien état persisté — devient simplement
  ignoré par le renderer V3.9.3, aucune migration nécessaire, `schemaVersion` inchangé.

## Non-régression

- **385/385 tests persistés PASS** (373 hérités de V3.9.2 conservés à l'identique + 12
  nouveaux NAV01-NAV12). 4 tests devenus obsolètes par ce changement UX volontaire —
  l'ancien accordéon « Outils » — ont été retirés et remplacés (jamais laissés à
  affirmer un comportement qui n'existe plus) : voir
  `DENTALFLOW_V3_9_3_TEST_REPORT.md` pour la correspondance explicite.
- **Playwright réel dédié : 44/44 vérifications PASS** — desktop (1440px, 1024px :
  contenu des 3 groupes, clic + route + état actif exclusif, géométrie de la barre
  active, sidebar réduite) et mobile (430/390/375px : ouverture du drawer, absence
  d'overflow horizontal, contenu des 3 groupes, défilement vertical + footer visible,
  clic Stock/Factures avec fermeture du drawer) + dark/light/system sur l'état actif.
  0 erreur console sur l'ensemble.
- **Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite
  complète.**
- **4 scripts Playwright hérités de V3.8.8/V3.9.1 rejoués sans modification** contre
  V3.9.3 (blocage/commentaire, alignement KPI factures, pulsation statut semaine,
  popup jour d'absence) : tous PASS, 0 erreur console — confirme qu'aucune page autre
  que la navigation n'a été affectée.
- `node --check` PASS sur les 5 blocs `<script>`.
- Zéro erreur console sur l'ensemble des scénarios testés (light, dark, system,
  desktop, mobile).
