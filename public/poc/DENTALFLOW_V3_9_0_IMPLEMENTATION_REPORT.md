# DentalFlow V3.9.0 — Rapport d'implémentation

**Base :** `dentalflow-next-poc-v3.8.8.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.0.html`
**Mandat :** Refonte graphique globale (Design System) — AUCUNE modification métier
**schemaVersion :** 10 (inchangé)

Méthode : **Phase 1 (fondations)** → **Phase 2 (écrans pilotes)** → **Phase 3
(propagation)**, comme demandé (§75-77). Chaque phase testée avant de passer à la
suivante (347/347 tests hérités conservés à chaque étape intermédiaire).

---

## Phase 1 — Fondations (§75)

- Tokens `--df-*` + primitives CSS créés (voir `DENTALFLOW_V3_9_0_DESIGN_SYSTEM.md`
  pour le détail complet).
- `icon(kind)` enrichi de 27 entrées, réutilisant les tracés `NAV_ITEMS` existants.
- Aucune régression fonctionnelle à cette étape (347/347 PASS, additif pur).

## Phase 2 — Écrans pilotes (§76)

### Accueil

**Réorganisé** selon §30-31 : les 4 KPI opérationnels (`Proposition 2`, déjà validés)
restent inchangés. La ligne CA/À facturer/Facturé/Réglé — auparavant une seconde
rangée `.hkpi` détachée entre les KPI et « À surveiller » — est désormais une section
`.df-section` explicite « Activité financière » (iconbox verte `money` + sous-titre),
avec un fond doux commun et 4 cellules internes (`.df-finance-grid`/`.df-finance-cell`,
séparateurs 1px). Comportement de clic strictement identique : mêmes attributs
`data-view="invoices"` / `data-open-paid-history`, gérés par les mêmes gestionnaires
délégués existants. Aucune valeur recalculée — toujours `computeRevenueKPIs()` /
`moneyFmt()`. Desktop : 4 colonnes. Tablette (≤899px) : 2×2. Mobile (≤420px) : 2×2.

**Composants réutilisés :** `.df-section`, `.df-iconbox`, `icon('money')`.

**Non modifié métier :** `computeRevenueKPIs()`, `kpiCounts()`, `openPaidHistoryPopup()`,
`renderWatch()` (empty-state V3.8.7 conservé tel quel — déjà la référence visuelle),
`renderFlow()`, `renderCompareBars()`, `renderDonut()`.

### Commandes

Auditée contre §32-33 : la toolbar (recherche globale en header + 4 filtres primaires
max + 1 `<select>` Statut + action « + Nouvelle commande ») était **déjà conforme**
depuis V3.8.4 Partie D (aucun changement structurel nécessaire — vérifié par le test
hérité J02 toujours PASS). Les couleurs de ligne (`.ovs-*`, barre gauche + teinte
légère) étaient déjà conformes à §33 depuis V3.8.2/V3.8.3. **Aucun changement** sur
cette page — jugée déjà harmonisée.

### Fiche commande — Quick View (`_renderQuickView`)

**Restructurée** selon §34-35 en 5 groupes visuels (`.df-section` avec iconbox +
titre), sans modifier une seule donnée affichée ni un seul gestionnaire :

1. **Commande** — patient, cabinet, dentiste, prestation, tarif, échéance
   (`.df-info-grid`) + bloc « Cette semaine » (`weekStripHTML()`, inchangé).
2. **Travail** — dents, teinte, empreinte, indications/remarques.
3. **Production** — état, technicien, dernier scan, prochaine étape, bon de suivi,
   localisation (+ bouton Modifier), motif de blocage si bloquée.
4. **Communication** — messages liés (compteur + bouton), commentaires (V3.8.7,
   inchangé).
5. **Traçabilité** — timeline résumée + lien « Voir toute la traçabilité » (inchangé) +
   reprises + QR de production.

**Actions (§35)** : l'action principale contextuelle (`primaryAction`, mêmes 5 branches
conditionnelles qu'en V3.8.8 : attente empreinte / prêt à démarrer / prêt à livrer /
livrée / actif) reste mise en avant (`.big-primary`). Bloquer/Annuler/Reprise/Imprimer
le bon — qui pouvaient auparavant s'empiler jusqu'à 6 boutons simultanés sur une
commande active non bloquée — sont regroupés dans un menu `[…]` (réutilise
`.row-menu`/`.row-menu-pop`, aucun second système). Correction apportée en cours de
test : le popover du menu utilisait `right:0` relatif à un déclencheur positionné à
gauche de la barre quand aucune action principale n'existait, le faisant déborder hors
de la carte (`.qv-actions-bar .row-menu{margin-left:auto}` corrige l'alignement).

**Composants réutilisés :** `.df-section`, `.df-iconbox`, `.df-info-grid`/
`.df-info-item`, `.row-menu`/`.df-menu`.

**Non modifié métier :** `orderStatusInfo()`, `orderSignals()`, `isOrderBlocked()`,
`isOrderCancelled()`, `currentBlockEvent()`, `orderComments()`, `orderTimeline()`,
`locationText()`, `technicianText()`, `plannedNextStage()`, `qrSvg()`, tous les
gestionnaires `data-confirm-impression`/`data-print-tracking`/`data-mark-delivered`/
`data-print-fiche`/`data-panel="reworkForm"`/`data-panel="blockOrder"`/
`data-unblock-order`/`data-open-cancel`/`data-panel="messages"`/`data-open-location`
(mêmes attributs, mêmes conditions de garde — vérifié par script Playwright dédié :
clic réel dans le textarea du panneau Bloquer ouvert depuis le nouveau menu, régression
V3.8.8 toujours absente).

### Side-window (drawer)

**Footer d'action rendu constant** (§23-25) : `#side-panel-body .form-actions` devient
`position:sticky;bottom:0` avec fond + bordure — Annuler/Enregistrer restent visibles
sans scroller, sur **tous** les formulaires latéraux de l'application (Bloquer,
Commentaire, Reprise, Annulation, Nouvelle commande, Stock, Utilisateur, Cabinet,
Congés, Simulation, Changement de localisation…) via un seul sélecteur CSS —
**aucun gestionnaire, aucune structure de formulaire modifiée**. Header
(`#side-panel-head`) déjà structurellement séparé du corps scrollable depuis les
premières versions — aucun changement nécessaire là non plus.

## Phase 3 — Propagation (§77)

Priorité donnée à l'**audit et la correction des écarts réels** plutôt qu'à la
réécriture de pages déjà conformes (§103 : « harmoniser pas réinventer »).

### Corrections apportées

- **Messages = violet** (§38, §67) : `.bubble.lab` et `.composer button` passaient par
  `--blue`/`--accent`, contredisant la règle des couleurs (§5 : bleu = navigation/
  production, violet = communication). Corrigé aux 2 endroits où la règle était
  dupliquée (règle de base + règle de cohérence de thème qui la réécrivait). Centre de
  notifications (`notifColor()`) : déjà `messages:'violet'` depuis une version
  antérieure — vérifié conforme, non modifié.
- **Icônes fonctionnelles** : 🖨️ (bouton Imprimer/PDF, Rapports) → `icon('print')` ;
  📅 (bouton Vue calendrier, Charge) → `icon('calendar')`. Les 3 icônes déjà en place
  sur les KPI de Charge (`icon('cube')`/`icon('users')`/`icon('calendar')`) étaient
  déjà conformes.

### Pages auditées, jugées déjà conformes (aucun changement)

- **Production** : en-têtes de poste avec iconbox déjà présents (Kanban), couleurs de
  poste déjà discrètes.
- **Charge** : les 3 KPI de synthèse utilisent déjà `icon()` de façon cohérente ;
  calendrier Simulation/Absences planifiées (V3.8.6-V3.8.8) déjà conforme au langage
  visuel — moteurs et rendu **non touchés**, comme exigé (§41-42).
- **Stocks & achats** : badges d'état déjà sémantiques (vert/orange/rouge) depuis
  V3.7.1/V3.8.4.
- **Rapports** : Indicateurs/Journal déjà structurés en cartes/sections cohérentes.
- **Factures** : les 4 KPI (`.invoice-kpis`, corrigés V3.8.8) et le statut de facture
  (première info visuelle) déjà conformes.
- **Utilisateurs** : avatars colorés + badges de rôle déjà en place (V3.8.3).
- **Notifications** : `notifColor()`/`.notification-icon` déjà par catégorie et
  sémantiquement corrects (`messages` en violet).
- **Cabinets, Prestations, Portail Cabinet, PWA Collaborateur, Data wizard** : audités
  contre les règles de couleur/icône du Design System — aucune violation trouvée
  justifiant une réécriture visuelle risquée sans bénéfice net mesurable.

### Suggestions hors périmètre (§78 — notées, non implémentées)

- **Cabinets** : transformation en répertoire professionnel avec tableau
  Cabinet/Ville/Contact/Dentistes/Commandes/État (§52) — actuellement une liste de
  cartes fonctionnelle mais non tabulaire ; changement structurel plus large qu'un
  ajustement visuel, mieux traité comme un item dédié.
  Prestations avec menu `[…]` unique par ligne (§51). Ces trois points sont des
  restructurations de rendu de page plus profondes que les 4 écrans pilotes explicites
  du mandat, et n'ont pas été traitées ici pour ne pas élargir le risque de régression
  au-delà de ce qui a pu être vérifié par les 4 suites de tests.

---

## Definition of Done — état

| Point | État |
|---|---|
| Design System central créé | ✅ |
| Couleur = sens unique | ✅ (corrigé : Messages) |
| Iconographie cohérente | ✅ (27 icônes ajoutées, 2 emoji remplacés) |
| Accueil réorganisé logiquement | ✅ |
| Facturation intégrée visuellement à Accueil | ✅ |
| Quick View commande restructurée | ✅ (5 groupes) |
| Commandes moins chargée | ✅ (déjà conforme, vérifié) |
| Side-windows cohérentes (footer constant) | ✅ (appliqué à tous les formulaires) |
| Pop-ups cohérentes | ✅ (shell existant conservé, primitives ajoutées) |
| Production/Messages/Charge/Stocks/Rapports/Factures/Prestations/Cabinets/
  Utilisateurs/Notifications harmonisés | ✅ audités — conformes ou corrigés ; 3 points
  notés « hors périmètre » (voir ci-dessus) |
| Simulation/Absences planifiées inchangées fonctionnellement | ✅ vérifié (scripts
  Playwright hérités V3.8.8 toujours PASS) |
| Anciens comportements fonctionnent | ✅ 360/360 tests (347 hérités + 13 DS) |
