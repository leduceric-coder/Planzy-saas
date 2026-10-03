# DentalFlow V3.8.8 — Rapport de tests

## Synthèse

| Suite | Résultat |
|---|---|
| `node --check` (5 blocs `<script>`) | 5/5 PASS |
| Suite persistée (`runAllTests()`) | **347/347 PASS** (335 hérités de V3.8.7 + 12 nouveaux) |
| Responsive (7 largeurs × 3 modes) | 21/21 PASS |
| Thèmes (light/dark/system × 6 vues) | 18/18 PASS |
| Isolation (export JSON avant/après suite) | Identique octet pour octet (111061 → 111061) |
| Scripts Playwright dédiés (interaction réelle DOM) | 4/4 scripts, 0 échec, 0 erreur console |
| Console (erreurs JS) | 0 sur l'ensemble des scénarios testés |

## Tests requis par le mandat — détail

### Partie A — Collision `data-order` (BLOCK01-05)

Vérifiés en **double méthode** : suite persistée (appel direct du moteur) ET script Playwright dédié
(`test_v388_partA.js`) reproduisant l'interaction réelle décrite par le bug (clic dans le textarea).

- **BLOCK01** — ouverture fiche → clic « Bloquer » → panneau latéral ouvert → clic **dans le
  textarea du motif** → panneau **reste ouvert** (`side-layer` toujours `.open`). **PASS**
  (Playwright : `afterOpen: true`, `afterClickTextarea: true`).
- **BLOCK02** — saisie du motif → bouton de soumission activé, valeur du textarea correctement
  capturée. **PASS**.
- **BLOCK03** — soumission → commande bloquée (`o.flags.blocked === true`), `historyEvent` type
  `Blocage` créé avec le bon motif. **PASS**.
- **BLOCK04** — fiche rafraîchie : badge « BLOQUÉE » et motif visibles immédiatement dans
  `#quick-body`. **PASS** (`hasBadge: true`, `hasMotif: true`).
- **BLOCK05** — même parcours pour « Ajouter un commentaire » : clic dans le textarea du panneau
  `#add-comment-form` ne ferme pas le panneau (`commentOpen: true`, `commentStillOpen: true`),
  soumission réussie, commentaire visible dans la fiche. **PASS**.
- **Audit complet (§5 du mandat)** : recherche exhaustive `<form ... data-order=` sur le fichier
  entier → 0 occurrence restante après correction des 4 formulaires (`block-order-form`,
  `add-comment-form`, `rework-form`, `cancel-order-form`). **PASS**.
- **Sanity — `rework-form`** : bug identique détecté par l'audit et corrigé de la même manière ;
  clic dans le textarea `notes` du formulaire de reprise ne ferme pas le panneau
  (`reworkOpen: true`, `reworkStillOpen: true`). **PASS** (non exigé nommément par le mandat mais
  couvert par son audit §5).
- **Sanity — usage légitime de `data-order` préservé** : un clic sur une ligne de commande (tableau,
  porteur `data-order` non-`<form>`) ouvre toujours la fiche via `openQuickView`. **PASS**
  (`quickOpen: true`).

### Partie B — KPI Factures (INVKPI01-03)

Vérifiés par script Playwright dédié (`test_v388_partB.js`), mesure de géométrie réelle
(`getBoundingClientRect()`) aux 7 largeurs requises.

- **INVKPI01** — desktop (1440/1366/1024, ≥900px) : les 4 cartes `.invoice-kpis .stock-kpi`
  partagent le même `top` (`maxDelta: 0`) et 4 positions `left` distinctes (`distinctLeftPositions:
  4`) → une seule ligne de 4 colonnes. **PASS** aux 3 largeurs.
- **INVKPI02** — tablette (768, 520–899px) : 2 lignes de 2 (`distinctLeftPositions: 2`, deux valeurs
  de `top` distinctes parmi les 4 cartes). **PASS**.
- **INVKPI03** — mobile (430/390/375, <520px) : 1 colonne, 4 valeurs de `top` distinctes
  (`distinctLeftPositions: 1`). **PASS** aux 3 largeurs.
- **Valeurs inchangées** : les 4 `moneyFmt(rev.X)` affichés sont strictement identiques à la version
  V3.8.7 (aucun changement du calcul, uniquement de la classe CSS conteneur). **PASS** (vérifié par
  la suite persistée héritée, aucun test de calcul de revenus n'a régressé).

### Partie C — Pulse de statut complet (WEEK01-05)

Vérifiés par script Playwright dédié (`test_v388_partC.js`) et suite persistée, technique du
« mismatch synthétique » héritée de V3.8.7 (PULSE02) pour garantir un changement de statut réel et
vérifiable sans dépendre de la variance naturelle du jeu de données démo.

- **Statut visible en permanence** — badge `.chg-week-status` présent avec un texte non vide
  (ex. « Tendu ») **avant même** toute pulsation, contenant le point `.chg-week-dot` en enfant.
  **PASS** (`{text:'Tendu', hasDot:true}`, indépendamment de tout déclenchement de pulse).
- **WEEK01/02** — un changement de statut synthétique sur la semaine d'index 1 déclenche
  `.sim-week-pulse` sur `.chg-week-label[data-week-idx="1"]`, et **le point ET le badge de statut**
  portent chacun une `animation-name` CSS active simultanément (`dotAnim` et `badgeAnim` tous deux
  non-`none`), le texte du statut restant visible pendant l'animation. **PASS**.
- **WEEK03** — une semaine inchangée ne pulse jamais (`pulseScenarioChanges(before)` avec `before`
  identique à l'état courant → `0` élément `.sim-week-pulse`, vérifié après extinction complète
  d'un pulse précédent pour éviter un faux positif de séquençage). **PASS**.
- **WEEK04** — après ~1.8s, plus aucune classe `.sim-week-pulse` en DOM (nettoyage `setTimeout`,
  jamais un état visuel permanent). **PASS** (`0` élément restant).
- **WEEK05** — aucune règle CSS `.sim-day-pulse`/`.sim-week-pulse*` ne contient `infinite` (inspection
  de toutes les règles matchées dans les `<style>` de la page). **PASS**.
- **Reduced motion** (`reducedMotion:'reduce'`, contexte Playwright dédié) — statut toujours visible
  (texte non vide) mais `animation-duration` neutralisée (`0s`/`none`) sur le point ET le badge.
  **PASS**.
- **Non-régression moteur** — `snapshotScenarioMetrics()`, `pulseScenarioChanges()`,
  `scenarioWeekMetrics()`, `weekLoadStatus()` : code source inchangé caractère pour caractère par
  rapport à V3.8.7 (vérifié par diff), tous les tests PULSE01-05 hérités de V3.8.7 passent sans
  modification. **PASS**.

### Partie D — Popup jour + détail dépliable (ABSUI01-08)

Vérifiés par script Playwright dédié (`test_v388_partD.js`), interaction réelle (`page.click`,
`page.keyboard.press`).

- **ABSUI01** — cellule avec ≥1 absence approuvée porte `role="button"` et `tabindex="0"`. **PASS**
  (`{found:true, tabindex:'0', role:'button'}`).
- **ABSUI02** — clic sur la cellule → popup ouverte (`quick-layer.open`), titre = date longue en
  français, contenu incluant la pastille « Validé ». **PASS**.
- **ABSUI03** — deux collaborateurs absents le même jour (scénario injecté) → les deux noms
  apparaissent dans la popup. **PASS** (`{hasU1:true, hasU2:true}`).
- **ABSUI04/ABSUI05** — une demande pending ou une hypothèse (`state.whatIfSims`) n'apparaît jamais
  dans « Absences planifiées » (calendrier, popup, ni détail) : test dédié injectant une hypothèse
  et vérifiant l'absence du terme « Hypothèse » dans `#abs-planifiees`. **PASS** (`{hasHyp:false}`).
- **ABSUI06** — la liste dépliable est **collapsed par défaut** (pas d'attribut `open` sur
  `.abs-detail` au premier rendu). **PASS** (`{initiallyOpen:false}`) — vérifié en synchrone via la
  suite persistée (fait structurel garanti) ; le comportement de bascule au clic natif du
  `<summary>` (ABSUI07) dépend du comportement natif du navigateur sur un clic synthétique, jugé
  moins fiable à garantir dans un test persisté et donc vérifié séparément et de façon autoritaire
  par ce script Playwright utilisant de vrais clics `page.click()` (voir ci-dessous).
- **ABSUI07** — clic sur le `<summary>` → ouverture (`afterFirstClick:true`) ; second clic →
  fermeture (`afterSecondClick:false`). **PASS** (vrais clics navigateur, comportement natif
  `<details>`/`<summary>` confirmé fonctionnel).
- **ABSUI08** — le compteur affiché dans le résumé (« Voir le détail des absences (N) ») correspond
  exactement à `approvedAbsencesInHorizon().length`. **PASS** (`displayedCount === actualCount`).
- **Lecture seule** — aucune action RH (Approuver/Refuser/Modifier/Supprimer) présente dans la popup
  ni dans le détail dépliable (vérifié par inspection du HTML généré : aucun bouton d'action, aucun
  gestionnaire `data-approve-leave`/`data-reject-leave` dans ces deux zones). **PASS**.
- **Échap généralisé** — popup jour ouverte via `openAbsenceDayPopup()`, touche Échap pressée →
  popup fermée (`beforeEsc:true`, `afterEsc:false`). **PASS**.
- **Fuseau horaire / cohérence de date** — la cellule cliquée correspond exactement au jour affiché
  dans le titre de la popup et aux entrées listées (construction de date locale via
  `new Date(y, mo-1, dd)`, jamais de parsing UTC pour les clés de jour). **PASS** (vérifié
  implicitement par ABSUI02/03 : aucun décalage de jour observé).

## Non-régression V3.8.7

- Les 335 tests persistés de V3.8.7 (dont les 18 ajoutés lors de cette version : COM01-05, HOME01-03,
  PULSE01-05, ABS01-06, eux-mêmes incluant les 317 tests V3.8.6) passent **sans aucune modification**
  de leur code — confirmant qu'aucun comportement V3.8.7 n'a été altéré par ce hotfix.
- Commentaires de commande (Partie A V3.8.7) : parcours complet toujours fonctionnel, désormais
  vérifié également via le nouveau chemin `data-comment-order-id` (BLOCK05).
- Empty-state Accueil (Partie B V3.8.7) : inchangé, tests HOME01-03 hérités toujours PASS.
- Pulse jour (`.sim-day-pulse`, Partie C V3.8.7) : mécanisme de déclenchement/nettoyage inchangé,
  seul le rendu du badge de semaine a été étendu (Partie C V3.8.8) — tests PULSE01/03/04 hérités
  toujours PASS.
- Calendrier « Absences planifiées » (Partie D V3.8.7) : `leaveCalendarHTML({mode:'approved', ...})`
  toujours rendu à l'identique pour les éléments hérités (avatars, tooltip, état vide) — tests
  ABS01-06 hérités toujours PASS ; seule une classe `chg-cell-clickable` et des attributs
  d'interaction ont été ajoutés aux cellules concernées, sans changement des classes/chaînes
  existantes.
- Responsive 1440/1366/1024/768/430/390/375 × LAB/STAFF/DENTIST : 21/21 PASS.
- Thèmes light/dark/system : 18/18 PASS.
- Isolation (export JSON avant/après la suite complète de 347 tests) : identique octet pour octet.

## Méthodologie

- Tests persistés exécutés en contexte navigateur réel (Chromium/Playwright,
  `window.DentalFlowTest.runAll()`), permettant l'usage direct du DOM, de `getComputedStyle` et de
  `matchMedia` mocké dans les assertions.
- Chaque test avec effet de bord sur `state` sauvegarde via `cloneDeep(serializableState())` et
  restaure après assertion — confirmé sans pollution inter-tests par l'isolation JSON identique.
- **4 scripts Playwright dédiés** (un par partie A/B/C/D), exécutés en complément de la suite
  persistée, utilisant de **vrais événements navigateur** (`page.click`, `page.fill`,
  `page.keyboard.press`, `page.setViewportSize`) plutôt que des appels directs au moteur — méthode
  qui avait révélé les bugs de frontière IIFE en V3.8.6 et qui est la seule à pouvoir reproduire
  fidèlement le bug P0 de la Partie A (un clic synthétique via `dispatchEvent` ne traverse pas
  toujours le DOM de la même façon qu'un clic réel intercepté par `closest()`).
  - `test_v388_partA.js` : BLOCK01-05 + sanity `rework-form` + sanity clic légitime.
  - `test_v388_partB.js` : géométrie des 4 cartes KPI aux 7 largeurs requises.
  - `test_v388_partC.js` : WEEK01-05 + visibilité du texte de statut + `reducedMotion:'reduce'` en
    contexte navigateur dédié.
  - `test_v388_partD.js` : ABSUI01-08 + fermeture par Échap.
- Zéro erreur console (`pageerror`/`console.error`) sur l'ensemble des 4 scripts et de la suite
  persistée.
