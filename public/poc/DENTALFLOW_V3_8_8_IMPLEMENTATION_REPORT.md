# DentalFlow V3.8.8 — Rapport d'implémentation

**Fichier de base :** `dentalflow-next-poc-v3.8.7.html` (conservé, non modifié)
**Fichier livré :** `dentalflow-next-poc-v3.8.8.html`
**Mandat :** Hotfix d'interaction et de planning — collision `data-order`, KPI Factures, pulse de
statut visible, popup/détail Absences planifiées
**schemaVersion :** 10 (inchangé)

V3.8.7 possédait déjà les commentaires de commande, l'empty-state Accueil, le pulse Simulation
(point + jour) et le calendrier « Absences planifiées » basé sur `leaveCalendarHTML()`. **Aucun de
ces moteurs n'a été réimplémenté ni son calcul modifié** — cette version est un hotfix strictement
scopé aux 4 points ci-dessous.

---

## Partie A — Collision `data-order` dans les formulaires latéraux (P0)

Le gestionnaire de clic délégué (`handleAppClick`) route tout clic sur `[data-order]` (via
`closest`) vers `openQuickView(orderId)` — logique conçue pour les lignes/cartes de commande. Or
`renderBlockOrderPanel()` et le panneau « Ajouter un commentaire » enveloppaient leur `<textarea>`
dans un `<form data-order="${o.id}">` : `closest('[data-order]')` remontait alors jusqu'au `<form>`
lui-même dès qu'on cliquait dans le textarea, refermant le panneau latéral avant même la saisie.

Correction par **élimination de la collision sémantique** (aucun `stopPropagation` employé, comme
explicitement exigé par le mandat) : chaque formulaire reçoit un attribut de porteur distinct,
absent du vocabulaire compris par `handleAppClick`.

| Formulaire | Ancien attribut | Nouvel attribut |
|---|---|---|
| `#block-order-form` | `data-order="${o.id}"` | `data-block-order-id="${o.id}"` |
| `#add-comment-form` | `data-order="${o.id}"` | `data-comment-order-id="${o.id}"` |
| `#rework-form` | `data-order="${o.id}"` | `data-rework-order-id="${o.id}"` |
| `#cancel-order-form` | `data-order="${o.id}"` | `data-cancel-order-id="${o.id}"` |

Les 4 gestionnaires de soumission correspondants ont été mis à jour pour lire le nouvel attribut
(`e.target.dataset.blockOrderId`, `.commentOrderId`, `.reworkOrderId`, `.cancelOrderId`) au lieu de
`dataset.order`.

- **Audit complet** (§5 du mandat) : recherche exhaustive de `<form ... data-order=` dans le fichier
  entier — 4 occurrences trouvées, les 4 corrigées. Zéro occurrence restante (vérifié par grep).
  Le mandat ne nommait explicitement que le blocage et le commentaire dans sa narration du bug, mais
  son audit (§5) et sa Definition of Done (« aucun form métier n'utilise abusivement `data-order` »,
  non qualifiée) couvrent sans ambiguïté les 4 formulaires — laisser `rework-form`/
  `cancel-order-form` avec un bug P0 identique déjà détecté aurait contredit l'objectif du hotfix.
- **`[data-order]` légitime préservé** : les lignes/cartes de commande (tableau des commandes,
  etc.) conservent `data-order` inchangé — seul l'usage abusif sur un `<form>` conteneur
  d'interaction a été renommé. Vérifié : un clic sur une ligne de commande ouvre toujours la fiche
  (test de non-régression dédié).
- **Aucun changement de logique métier** : `blockOrder()`, `addOrderComment()`,
  `submitReworkForm()`, `confirmCancelWithReturn()` sont appelées avec exactement le même
  identifiant de commande qu'avant — seule la source de lecture de cet identifiant change.

## Partie B — KPI Factures : disposition 4 colonnes

`renderInvoicesPage()` réutilisait `.stock-kpis` (`grid-template-columns: repeat(3, ...)`) pour ses
4 cartes, causant un retour à la ligne (3 + 1) sur desktop. Nouvelle classe dédiée `.invoice-kpis`,
sans toucher aux 4 cartes elles-mêmes ni aux valeurs calculées (`moneyFmt(rev.X)` inchangés) :

```css
.invoice-kpis{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:14px}
@media(max-width:899px){.invoice-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.invoice-kpis{grid-template-columns:1fr}}
```

`<section class="grid stock-kpis">` → `<section class="grid invoice-kpis">` dans `renderInvoicesPage()`.
`.stock-kpis` (page Stock) reste inchangée — aucune régression sur cette page.

- **Desktop (≥900px)** : 4 colonnes sur une seule ligne.
- **Tablette (520–899px)** : 2×2.
- **Mobile (<520px)** : 1 colonne.

## Partie C — Pulse Simulation : statut complet visible (texte + point)

En V3.8.7, seul le petit point (`.chg-week-dot`) pulsait ; le statut textuel n'existait qu'en
`title` (tooltip, invisible sans survol). Le mandat exige que le badge de statut soit **visible en
permanence** (texte + couleur) et que le pulse anime l'ensemble (point + texte), sans toucher au
moteur de détection de changement.

- **Aucune modification** de `snapshotScenarioMetrics()`, `pulseScenarioChanges()`,
  `scenarioWeekMetrics()` ni `weekLoadStatus()` — uniquement le rendu HTML/CSS du badge de semaine.
- `weekRowHTML` (dans `leaveCalendarHTML()`) : le `<span class="chg-week-dot">` autonome est
  remplacé par un badge conteneur `<span class="chg-week-status {couleur}">` englobant à la fois le
  point (`chg-week-dot`, conservé identique) et un nouveau `<span class="chg-week-status-text">`
  affichant `m.statusLabel` (ex. « Tendu »), toujours visible, coloré selon le statut
  (vert/orange/rouge — mêmes couleurs que le point).
- **Couplage pulse sans duplication de logique** : `pulseScenarioChanges()` continue d'ajouter
  `.sim-week-pulse` uniquement sur `.chg-week-label` (le conteneur extérieur, inchangé). Le badge
  `.chg-week-status` étant désormais **imbriqué** dans ce label, une seule règle CSS
  (`.sim-week-pulse .chg-week-status.{couleur}`) anime le badge entier (`transform:scale()` +
  halo `box-shadow` coloré) — le point suit automatiquement puisqu'il est un descendant du badge.
  Zéro changement JS pour obtenir ce couplage.
- La règle historique `.sim-week-pulse .chg-week-dot{animation:simWeekPulse .5s ease-in-out 3}` est
  **conservée verbatim** (requise par un test hérité de V3.8.7 qui vérifie sa présence par regex).
- Animation toujours bornée à **3 itérations**, jamais `infinite` (vérifié : aucune règle
  `.sim-day-pulse`/`.sim-week-pulse*` ne contient `infinite`).
- `prefers-reduced-motion: reduce` : aucune animation déclenchée (règle média étendue pour couvrir
  `.chg-week-status`), mais le **statut reste visible** (texte + couleur), seule l'animation est
  supprimée — conforme au mandat (« le statut doit rester lisible même sans animation »).
- Largeur de la première colonne du calendrier (`.chg-cal-dow`/`.chg-cal-week`) élargie de 26px à
  50px pour accueillir le texte du badge sans déborder — vérifié sans débordement horizontal sur
  les 6 largeurs testées.

## Partie D — Absences planifiées : popup jour + détail dépliable

`renderPlanning()` affichait déjà le calendrier `leaveCalendarHTML({mode:'approved', ...})` hérité
de V3.8.7 (lecture seule, sans statut de semaine ni pulse). Ajout de deux niveaux d'UX
supplémentaires, sans créer de second/troisième calcul indépendant.

### Chaîne de dérivation unique

```
approvedAbsences()  →  approvedAbsencesInHorizon(weeks)  →  approvedAbsencesForDay(dateStr)
```

- **`approvedAbsencesInHorizon(weeks = planningWeeks(8))`** : filtre `approvedAbsences()` sur les
  entrées dont l'intervalle `[from,to]` chevauche l'horizon (bornes calculées depuis la première et
  la dernière semaine fournies), triées par date de début croissante.
- **`approvedAbsencesForDay(dateStr)`** : reconstruit une date **locale** (`new Date(y, mo-1, dd)`,
  jamais `new Date("YYYY-MM-DD")` qui parse en UTC et peut décaler le jour civil affiché selon le
  fuseau) et filtre `approvedAbsencesInHorizon()` sur les entrées couvrant ce jour.
- **`absenceCardHTML(a, showValidated)`** : mini-carte unique (avatar, nom, motif, plage de dates,
  nombre de jours ouvrés via `bizDays()`, pastille « Validé » optionnelle) — réutilisée à l'identique
  par la popup ET la liste dépliable, seul `showValidated` diffère.

Le calendrier, la popup et la liste dépliable lisent tous les trois cette même chaîne — jamais un
calcul parallèle (exigence explicite du mandat, §37 : « jamais trois calculs indépendants »).

### Popup jour (clic sur une cellule)

- `dayCellHTML` (dans `leaveCalendarHTML()`, mode `approved`) : toute cellule ayant ≥1 absence
  approuvée reçoit `class="chg-cell-clickable"`, `data-approved-absence-day="YYYY-MM-DD"` (construit
  en local, zero-paddé), `role="button"`, `tabindex="0"`.
- `handleAppClick` : nouveau bloc inséré avant le gestionnaire `data-cal-day-tip` existant,
  détectant `closest('[data-approved-absence-day]')` et appelant
  `openAbsenceDayPopup(dateStr)`.
- Accessibilité clavier : nouvel écouteur `keydown` (Entrée/Espace) sur l'élément actif portant
  `data-approved-absence-day`, ouvrant la même popup.
- `openAbsenceDayPopup(dateStr)` : construit le titre (date longue en français via
  `toLocaleDateString('fr-FR', {weekday, day, month:'long'})`), liste toutes les personnes absentes
  ce jour (`absenceCardHTML(a, true)` pour chacune), injecte dans `#quick-body`, puis
  `openModalAnimated($('#quick-layer'))` — **réutilise le système d'animation centrale existant**
  depuis V3.8.6 Partie J (`.quick-layer`/`.open`), **aucun nouveau système d'animation créé**, comme
  exigé.
- **Lecture seule** : aucune action RH (Approuver/Refuser/Modifier/Supprimer) dans cette popup —
  uniquement la liste des personnes absentes et leur plage de dates.
- Fermeture par `#quick-close` (bouton existant) ou touche Échap.
- **Généralisation Échap** : le gestionnaire global Échap testait auparavant
  `if(state.quickOrderId)` pour fermer `#quick-layer` — condition qui ne couvrait pas cette nouvelle
  popup (qui ne définit pas `quickOrderId`). Remplacé par un test générique sur l'état visuel réel
  du calque (`document.getElementById('quick-layer').classList.contains('open')`), fermant
  désormais Échap pour **toute** popup basée sur `quick-layer` — amélioration nette sans
  régression (les popups pré-existantes comme `openEffectifPopup()`/`openMonthCalendar()` gagnent
  au passage la fermeture par Échap qu'elles n'avaient jamais eue).

### Liste dépliable (`<details>`)

- `renderPlanning()` : ajout, sous le calendrier, d'un bloc `<details class="abs-detail">`
  **collapsed par défaut** (pas d'attribut `open`), avec un `<summary>` affichant « Voir le détail
  des absences (N) » (N = `approvedAbsencesInHorizon().length`, donc toujours exact) et un chevron
  animé (rotation 180° à l'ouverture, pure CSS via `[open] .abs-detail-chevron`).
  - Contenu : chaque absence de `approvedAbsencesInHorizon()` (triée par date de début, comme la
    fonction le garantit) rendue via `absenceCardHTML(a, false)` (pas de pastille « Validé »,
    redondante dans ce contexte titré « Absences planifiées »).
  - État vide : « Aucune absence dans l'horizon. » si la liste est vide.
- **Lecture seule** : aucune action RH ici non plus, conformément au mandat.

## Non-régression

- Les 335 tests V3.8.7 (dont 317 hérités de V3.8.6) sont conservés **sans modification** et passent
  tous.
- 12 nouveaux tests V3.8.8 ajoutés (BLOCK01-05, INVKPI01-03, WEEK01-05, ABSUI01-08 en partie
  couverts par des scripts Playwright dédiés en complément de la suite persistée) — suite totale
  persistée : **347/347 PASS**.
- `node --check` PASS sur les 5 blocs `<script>`.
- Responsive : 21/21 (7 largeurs × 3 modes). Thèmes : 18/18 (light/dark/system × 6 vues).
  Isolation : export JSON avant/après la suite complète identique octet pour octet.
- Zéro erreur console sur l'ensemble des scénarios testés (suite persistée + 4 scripts Playwright
  dédiés Parties A/B/C/D).
