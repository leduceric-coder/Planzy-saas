# DentalFlow V3.8.6 — Rapport d'implémentation

**Fichier de base :** `dentalflow-next-poc-v3.8.5.html` (conservé, non modifié)
**Fichier livré :** `dentalflow-next-poc-v3.8.6.html`
**Mandat :** Opérationnel UX & cohérence de la charge
**schemaVersion :** 10 (inchangé — aucune migration de données structurelle)

Portée respectée : stock, achats, facturation, cabinets, PWA Collaborateur, portail Cabinet,
traçabilité hors événement de blocage, règles de consommation et architecture V10 n'ont pas été
modifiés. Cette version corrige uniquement : **cohérence + lisibilité + interaction**.

---

## Partie A — KPI Accueil / commandes annulées

**Bug confirmé et corrigé :** `getDistributionBucket(o)` ne traitait pas explicitement
`productionState==='cancelled'` et laissait une commande annulée retomber dans le seau `active`,
ce qui la faisait compter dans « En production ».

- `getDistributionBucket(o)` retourne désormais `null` pour toute commande annulée ;
  `orderDistribution()` ignore les seaux `null`.
- Nouvelle fonction canonique `operationalOrders()` = `state.orders.filter(o=>!isOrderCancelled(o))`,
  utilisée par `kpiCounts()` pour « À livrer aujourd'hui » et « En retard ».
- `isScanExpected(o)` recevait la même incohérence (pas de garde `!isOrderCancelled`) — corrigé pour
  être cohérent avec `isOrderLate`/`isOrderBlocked`, ce qui corrige en cascade
  `needsAttention()`, `orderSignals()`, `alertItems()` et `getAttentionOrders()`.
- Une commande annulée ne déclenche donc plus aucune notification active de retard, blocage ou scan
  attendu (l'historique d'audit, lui, reste intact).

## Partie B — Icône de notification Messagerie

`notifIcon()` mappait `messages:'info'`, ce qui affichait le glyphe générique « i » au lieu d'une
icône Messages reconnaissable. Ajout de la clé `message` dans `icon(kind)` (SVG bulle de dialogue,
identique à l'icône de navigation Messages) et correction du mapping `messages:'message'`. La
couleur violette de la catégorie Messages était déjà correcte.

## Partie C — Menus déroulants (composant DentalFlowSelect)

Composant réutilisable unique `DFSelect`, appliqué à tous les `<select>` de l'application (Commandes,
Stocks, Achats, Utilisateurs, Cabinets, Prestations, Nouvelle commande, Simulation, formulaires,
Facturation, Import…) :

- Le `<select>` natif reste la **source de vérité unique**. Sélectionner une option custom fait
  `select.selectedIndex = idx; select.dispatchEvent(new Event('change', {bubbles:true}))` —
  **aucune logique métier existante n'a été réécrite** (tous les handlers `change` délégués
  continuent de fonctionner tels quels).
- Bouton fermé : 41px, surface DentalFlow, bordure `var(--border)`, radius 11px, chevron SVG,
  aucune flèche native.
- Popover : surface premium, ombre forte, options ~38px/8px radius, état survolé/sélectionné avec
  coche, animation 140ms (opacity + translateY + scale).
- Accessibilité : `role="combobox"` + `aria-haspopup="listbox"` + `aria-expanded` sur le bouton,
  `role="option"` + `aria-selected` sur les options, navigation clavier complète
  (Enter/Espace/↑/↓/Escape/Home/End).
- Mobile (`pointer:coarse`) : le `<select>` natif reste interactif au-dessus du bouton stylé —
  le picker natif de l'OS s'ouvre au tap, comme demandé explicitement par le mandat.
- Amélioration re-jouée à chaque rendu via `MutationObserver` (le DOM est reconstruit par
  `innerHTML=` à chaque `render()` — chaque `<select>` réapparaît « neuf » et est ré-enrichi,
  marqué `data-df-enhanced` pour éviter le double-enrichissement).

## Partie D — Blocage manuel d'une commande

- `blockOrder(orderId, comment, actingUserId)` : refuse un motif vide (`COMMENT_REQUIRED`), une
  commande déjà annulée (`ORDER_CANCELLED`), livrée (`ORDER_DELIVERED`) ou un acteur sans la
  permission `production.manage` (`FORBIDDEN`). En cas de succès : `flags.blocked=true`,
  `historyEvent` de type `'Blocage'` avec acteur + commentaire + horodatage `Clock.iso()`.
- `unblockOrder(orderId, comment?)` : lève le blocage, ajoute un `historyEvent` `'Blocage levé'`.
  Commentaire optionnel.
- `currentBlockEvent(orderId)` dérive le dernier événement de blocage actif depuis l'historique —
  **aucune double source de vérité** (`o.blockComment` n'a jamais été créé).
- UI fiche commande : bouton secondaire orange « Bloquer la commande » (si non bloquée, non annulée,
  non livrée, permission présente) ouvrant un popup avec `textarea` obligatoire — impossible de
  valider sans motif. Une fois bloquée : badge « BLOQUÉE », motif, « Bloquée par : Nom · date/heure »,
  bouton « Lever le blocage ».
- KPI Bloquées et notifications se mettent à jour immédiatement (le blocage change directement l'état
  applicatif consommé par `kpiCounts()`/`orderDistribution()`).

**Bug de frontière IIFE découvert et corrigé pendant les tests réels (clics DOM) :** le script de
base (hors IIFE) appelait directement `currentBlockEvent()` et `unblockOrder()`, deux fonctions
internes à l'IIFE d'implémentation — `ReferenceError` en conditions réelles. Corrigé en exposant
`window.currentBlockEvent` et `window.unblockOrder` dans `installOverrides()`, suivant la convention
déjà en place dans le code (`window.createArticle`, `window.filterInvoices`, etc.).

## Partie E — Cohérence Simulation / Projection

**Bug confirmé :** la table « Projection sur 8 semaines » utilisait `weekChargeToDeliver()` (données
réelles) tandis que `whatIfImpact()` (simulateur) utilisait `weekForecast()` reposant sur
`ORDER_BOOK`/`buildOrderBook()` — un carnet synthétique mêlant commandes réelles et données
aléatoires — rendant le nombre de « semaines en tension » incohérent avec la Projection.

- Suppression complète de `ORDER_BOOK`, `buildOrderBook()` et `weekForecast()` — plus aucune
  référence dans le moteur.
- Nouveau helper canonique unique `weekLoadStatus(capacity, load)` : occupation < 90 % → À l'aise ;
  90–100 % → Tendu ; > 100 % → Surcharge. Utilisé par **la Projection ET la Simulation** (plus aucun
  seuil dupliqué).
- Nouveau helper `scenarioWeekMetrics(i, simLeaves)` retournant
  `{week, baseCapacity, scenarioCapacity, load, balance, occupancy, status, statusLabel, statusColor}`
  où `load = weekChargeToDeliver(i)` (source unique et réelle, jamais synthétique) et
  `scenarioCapacity = netWeekCapacity(week, simLeaves)`.
- `whatIfImpact()` recalculé : `negWeeks` compte désormais les semaines `tight` + `over` via
  `scenarioWeekMetrics(...).status` (au lieu d'un simple solde négatif sur données synthétiques).
- `renderPlanning()` et `openPlanWeek()` réutilisent `weekLoadStatus()` — plus aucune logique de
  seuil dupliquée ailleurs.
- `openMonthCalendar()` (popup « Plan de charge — calendrier ») simplifié : la variante « scénario »
  (qui dépendait de `ORDER_BOOK`) a été retirée car devenue inaccessible une fois le bouton
  « Voir le calendrier du scénario » supprimé (Partie G) — le popup ne sert plus que pour la
  Projection réelle.

## Parties F/G — Suppression des vignettes, calendrier toujours visible

- Les deux vignettes `chg-impact-kpi` (« Impact du scénario » / « N semaines en tension ») sont
  supprimées, remplacées par un résumé compact `.chg-summary` en une ligne : pastilles
  « −N commande(s) de capacité » / « N semaine(s) sous tension », ou un texte neutre
  « Aucune absence simulée » si le scénario est vide.
- Le bouton « 📅 Voir le calendrier du scénario » est supprimé — le calendrier
  (`whatIfCalendarHTML()`) est **directement visible** sous la carte « Demandes & simulation »,
  horizon de 8 semaines, groupé **par mois** (titre de mois en majuscules, grille Lun→Dim), en
  grille responsive (`repeat(auto-fit, minmax(320px,1fr))` — 2 mois côte à côte en desktop, empilés
  en mobile).

## Parties H/I — Détail visuel du calendrier

- Jour normal : cellule sobre, numéro visible.
- Jour simulé : bordure 3px colorée + fond légèrement teinté, immédiatement identifiable.
  Trois types distincts, jamais confondus : demande réelle testée (**orange**, `sim-real`),
  hypothèse pure (**violet**, `sim-hyp`), absence déjà approuvée (**neutre gris**, `sim-planned`).
- Avatar(s) du/des collaborateur(s) affiché(s) dans la cellule (jusqu'à 3 avatars superposés puis
  « +N »), via `userColor()`/`userInitials()` — aucune donnée inventée.
- Légende claire : « ● Absence planifiée · ● Demande testée · ● Hypothèse ».
- Survol (title natif) ou clic (toast) sur un jour simulé affiche le détail :
  « Nom / Type / DD mois→DD mois » pour chaque événement concerné.
- Tension au niveau semaine : point vert/orange/rouge par semaine, dérivé **exclusivement** de
  `scenarioWeekMetrics()` — jamais de couleur globale sur tout le calendrier. Vérifié par test
  automatisé que le point affiché correspond EXACTEMENT au statut retourné par le même moteur que
  la Projection.

## Partie J — Animations des pop-ups

Nouveaux helpers centraux `openModalAnimated(layer)` / `closeModalAnimated(layer, afterClose)`
(scope global, réutilisables depuis le script de base et l'IIFE) :

- `quick-layer`, `tooth-picker-layer` et `form-modal` restent désormais toujours dans le flux DOM
  (`display:flex` permanent) et sont pilotés par `opacity`/`visibility`/`pointer-events` — ainsi
  **tout** point d'ouverture existant (`classList.add('open')`, une dizaine d'emplacements dans le
  code) bénéficie automatiquement de l'animation d'entrée en CSS pur (overlay opacity 0→1, carte
  opacity 0→1 + scale(.97)→1 + translateY(8px)→0, 200ms, `cubic-bezier(.22,.61,.36,1)`) — sans
  réécriture de chaque site d'appel.
- `closeModalAnimated()` retire la classe `open` immédiatement (déclenche la transition CSS
  inverse) puis **attend la fin de l'animation avant d'exécuter `afterClose`** (nettoyage
  d'état/DOM) — jamais de `display:none`/`innerHTML=''` instantané pendant que la carte est encore
  visible. `closeQuickView()` et `closeToothPicker()` ont été réécrits sur ce modèle.
- `pdetail-layer` (portail Dentiste, remonté en entier via `document.body.innerHTML` à chaque
  `renderDentistMode()`) reçoit une animation d'entrée en `@keyframes` (jouée automatiquement au
  montage) et un helper dédié `closePdetailAnimated(elId, afterClose)` qui ajoute une classe
  `closing` (déclenchant l'animation de sortie) avant de déclencher le re-rendu complet.
- `@media (prefers-reduced-motion: reduce)` réduit toutes les durées à 0.01s — `closeModalAnimated`
  détecte également ce mode et exécute `afterClose` sans attendre de délai artificiel.

## Non-régression (Partie R)

- Les 297 tests V3.8.5 pertinents sont conservés, aucun invariant métier affaibli.
- 20 nouveaux tests persistés ajoutés (K01/K02, N01, B01-B04, S01-S03, SIM01-SIM05, CAL01/CAL02,
  CAL03/CAL04/CAL05, A01-A04) — suite totale : **317/317 PASS**.
- Le test C01 (Charge) a été **réécrit** pour refléter le changement de comportement explicite du
  mandat (suppression des vignettes `.chg-impact-kpi`, calendrier toujours visible) — documenté dans
  le code comme extension stricte du mandat, jamais un affaiblissement.
- `node --check` PASS sur les 5 blocs `<script>`.
- Responsive : 21/21 (7 largeurs × 3 modes LAB/STAFF/DENTIST), aucun débordement horizontal.
- Thèmes : 18/18 (light/dark/system × 6 vues), zéro erreur console.
- Isolation : export JSON avant/après la suite complète de tests — identique octet pour octet.
- Zéro `SyntaxError`/`ReferenceError`/`TypeError`/`UnhandledPromiseRejection` en console sur
  l'ensemble des scénarios testés.
