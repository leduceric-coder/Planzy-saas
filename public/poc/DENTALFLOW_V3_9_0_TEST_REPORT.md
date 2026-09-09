# DentalFlow V3.9.0 — Rapport de tests

## Synthèse

| Suite | Résultat |
|---|---|
| `node --check` (5 blocs `<script>`) | 5/5 PASS |
| Suite persistée (`runAllTests()`) | **360/360 PASS** (347 hérités + 13 Design System) |
| Responsive (7 largeurs × 3 modes) | 21/21 PASS |
| Thèmes (light/dark/system × 6 vues) | 18/18 PASS |
| Isolation (export JSON avant/après suite) | Identique octet pour octet |
| Scripts Playwright hérités V3.8.8 (interaction réelle) | 4/4 scripts, 0 échec, 0 erreur console |
| Console (erreurs JS) | 0 sur l'ensemble des scénarios testés |

## Suite Design System — DS01 à DS13 (§82-94)

Tous exécutés en contexte navigateur réel (Chromium/Playwright,
`window.DentalFlowTest.runAll()`), avec `getBoundingClientRect()`/`getComputedStyle()`
réels — pas uniquement une vérification de chaînes.

- **DS01** — boutons standards d'une même rangée (barre d'action fiche commande +
  panneau Bloquer) : delta de hauteur ≤ 1px. **PASS**.
- **DS02** — shell de pop-up commun : Quick View, Historique Réglé, Effectif, Absence
  jour ouverts successivement ; `X` positionné au même endroit relatif (±2px), aucun
  débordement (`scrollWidth`/`clientWidth`). **PASS** (4 pop-ups vérifiées).
- **DS03** — side-window : Nouvelle commande, Bloquer, Commentaire, Stock, Utilisateur,
  Cabinet ouverts successivement ; même largeur desktop (±2px), header non vide sur les
  6. **PASS**.
- **DS04** — actions principales de la fiche commande : menu `[…]` avec icône `<svg>`
  (jamais un emoji), les 5 groupes portent chacun une iconbox `<svg>`. **PASS**.
- **DS05** — invariants de couleur : bulle de message laboratoire rendue avec la même
  couleur calculée que `var(--violet)` (comparaison de couleur calculée réelle, pas de
  lecture de règle CSS fragile), `notifColor({category:'messages'})==='violet'`, une
  commande bloquée obtient bien `isOrderBlocked()===true` (couleur orange du pill
  associée). **PASS**.
- **DS06** — responsive (smoke test dans la suite persistée, viewport courant) :
  Accueil sans débordement horizontal global (`document.documentElement.scrollWidth`).
  **PASS** — couverture complète des 7 largeurs assurée par la suite dédiée
  `responsive_v384.js` (voir ci-dessous).
- **DS07** — portail Cabinet : `isDentistMode()` toujours présente, aucune classe
  PWA/mobile-first appliquée à ce contexte. **PASS**.
- **DS08** — PWA Collaborateur : `isStaffMode()`/`renderStaffMode()` toujours
  présentes et inchangées (priorité Scan non altérée par le Design System). **PASS**.
- **DS09** — dark mode : le bloc CSS `DENTALFLOW DESIGN SYSTEM V3.9` ne contient aucune
  couleur codée en dur en dehors du blanc de texte sur fond saturé (`#fff`, pattern déjà
  établi par `.primary`/`.big-primary{color:white}`) — tous les tokens `--df-*` sont
  utilisés. **PASS**.
- **DS10** — géométrie : les 4 cellules `.df-finance-cell` de l'Activité financière
  Accueil partagent le même `top` (tolérance 1px). **PASS**.
- **DS11** — overlays : clic réel (`MouseEvent`) dans le textarea du panneau Bloquer
  (ouvert depuis le nouveau menu `[…]` de la fiche commande) ne ferme jamais le
  panneau — re-test du bug P0 corrigé en V3.8.8 sur le nouveau point d'entrée.
  **PASS**.
- **DS12** — focus clavier : Escape ferme la pop-up Effectif (basée sur `quick-layer`,
  généralisation V3.8.8 toujours active). **PASS**.
- **DS13** — `prefers-reduced-motion` : la règle de neutralisation des transitions
  `.df-btn`/`.df-card.interactive` est bien présente dans le CSS livré. **PASS**.

## Non-régression V3.8.8

- Les 347 tests persistés de V3.8.8 (dont les 12 ajoutés lors de cette version :
  BLOCK01-05, INVKPI01-03, WEEK01-05, ABSUI01-08) passent **sans aucune modification**
  de leur code — confirmant qu'aucun comportement V3.8.8 n'a été altéré par la refonte
  visuelle. Un seul test (COM02) a nécessité un ajustement du markup généré (le libellé
  « Commentaires » n'apparaissait plus comme titre `<h3>` autonome une fois le bloc
  fusionné dans le groupe « Communication » — réintroduit comme sous-label au-dessus de
  la liste, comportement du test inchangé, aucun affaiblissement).
- **4 scripts Playwright hérités de V3.8.8** ré-exécutés tels quels contre
  `dentalflow-next-poc-v3.9.0.html` (chemin de fichier substitué, code de test
  identique) :
  - `test_v388_partA.js` (collision `data-order`, clic réel dans les textareas
    Bloquer/Commentaire/Reprise) : **PASS**, 0 erreur console.
  - `test_v388_partB.js` (géométrie KPI Factures aux 7 largeurs) : **PASS** identique
    (classe `.invoice-kpis` non touchée par V3.9.0).
  - `test_v388_partC.js` (pulse de statut de semaine, `reducedMotion`) : **PASS**
    identique (moteur `pulseScenarioChanges()` non touché).
  - `test_v388_partD.js` (popup jour Absences planifiées, détail dépliable, Escape) :
    **PASS** identique (calendrier Simulation/Absences non touché).
- Responsive 1440/1366/1024/768/430/390/375 × LAB/STAFF/DENTIST : 21/21 PASS.
- Thèmes light/dark/system : 18/18 PASS.
- Isolation (export JSON avant/après la suite complète de 360 tests) : identique octet
  pour octet.

## Méthodologie

- Tests persistés exécutés en contexte navigateur réel (Chromium/Playwright), avec
  sauvegarde/restauration `cloneDeep(serializableState())` + `Object.assign(state,bak)`
  pour tout test avec effet de bord — confirmé sans pollution inter-tests par
  l'isolation JSON identique.
- Découverte et correction en cours de test : le popover du menu `[…]` de la fiche
  commande (`right:0` relatif à un déclencheur non aligné à droite de la barre)
  débordait hors de la carte quand aucune action principale n'était affichée
  (commande active non bloquée) — détecté par timeout Playwright réel (« element
  intercepts pointer events »), diagnostiqué par mesure `getBoundingClientRect()`,
  corrigé (`margin-left:auto` sur le conteneur du menu), revérifié PASS.
- Zéro erreur console (`pageerror`/`console.error`) sur l'ensemble de la suite
  persistée et des scripts Playwright dédiés.
