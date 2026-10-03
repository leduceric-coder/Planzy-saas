# DentalFlow V3.12.2 — Rapport d'implémentation

Base : `dentalflow-next-poc-v3.12.1.html` (frozen, inchangé — MD5 identique avant/après tout ce travail,
`git diff` vide). Quatre retours de la 2e recette laboratoire traités, détail technique complet dans
`DENTALFLOW_V3_12_2_CHANGELOG.md`. Kit `dentalflow-test-labo-v3.12.2.html` construit en appliquant le même
patch exact (`diff` V3.12.1→V3.12.1.1 appliqué proprement via `patch`, aucune divergence manuelle) sur
`dentalflow-test-labo-v3.12.1.1.html`, baseline V3.12.1.1 strictement préservée.

## MESSAGES_LAB_RESPONSIVE

Cause racine identifiée par lecture directe du CSS/DOM (pas seulement supposée) : `.side-message-layout`
(190px/1fr) n'avait jamais été retouchée par le correctif V3.12.1, qui ne portait que sur
`.cab-message-layout` (portail Cabinet) — confusion explicitement signalée par le mandat, vérifiée avant
toute correction. Fix scopé : nouvelle classe `.side-panel.messages-panel` (largeur dédiée, jamais globale),
grille redéfinie avec `min-width:0`, commandes associées en conteneur `flex-wrap`, bulles et composer
responsives. Aucune régression sur `.cab-message-layout` (classes totalement distinctes, jamais touchées).

## STOCK_ARTICLE_COMPACT

Nouvelle classe `.article-kpi` (dans `.article-kpi-grid`, scopée, jamais une redéfinition globale de
`.article-info-grid` qui aurait aussi affecté la fiche Fournisseur — vérifié et corrigé en cours de
développement : une première tentative redéfinissait `.article-info-grid` globalement et aurait changé à
tort la grille Identité/Conditions commerciales du Fournisseur ; la classe dédiée élimine ce risque).

## STOCK_QUICK_TO_SIDE_TRANSITION

Root cause réellement reproduite (pas supposée) : `openSidePanel()` ne vidait jamais `#quick-body` avant
d'ouvrir la side-window, laissant le contenu de la Quick View visible en concurrence pendant l'animation de
fermeture. Première version du correctif tentée : différer l'ouverture de la side-window via
`closeModalAnimated` (attendre la fin de l'animation, ~200ms) — a cassé 5 tests internes
(BLOCK01/BLOCK02/BLOCK05/DS11, et une collision indirecte sur « Plan de charge ») car la suite de tests
interne appelle `openSidePanel()` de façon strictement synchrone et certains tests laissent `#quick-layer`
avec la classe `open` sans jamais la retirer (root cause isolée : `COM02` appelle `_renderQuickView()` sans
fermer ensuite — comportement pré-existant, invisible avant ce correctif car l'ancien `openSidePanel()` ne
se souciait jamais de l'état de la Quick View). Solution retenue : fermeture **strictement synchrone**
(classe `open` retirée ET contenu vidé dans le même tick) au lieu d'une attente temporisée — résout le bug
rapporté sans introduire la moindre dépendance au temps, et sans casser l'hypothèse de synchronicité de la
suite de tests interne. Revérifié : 468/468 (hors l'unique échec pré-existant documenté ci-dessous, déjà
présent à l'identique sur `dentalflow-next-poc-v3.12.1.html` non modifié).

## STOCK_TOOLBAR_RESPONSIVE

Cause racine identique dans son principe au bug Cabinet V3.12.1 (collision avec la variante mobile de
`.primary`), ici sur le bouton « ＋ Nouvel article » du Stock. Classe dédiée `.stock-toolbar-actions`,
neutralisation ciblée de la variante mobile de `.primary` dans ce seul contexte.

## SERVICE_QUALIFIER_SINGLE_LINE

Classe dédiée `.service-pricing-pill` (`white-space:nowrap`), appliquée aux trois valeurs possibles (« À
qualifier », « Par dent », « Forfait »). `pricingModeLabel()`/`serviceIsOrderable()`/qualification par lot :
non modifiés (vérifié par lecture — aucune ligne touchée).

## USER_ACCOUNT_DEACTIVATION / USER_DEACTIVATION_REASONS / USER_HISTORY_PRESERVED / CURRENT_USER_PROTECTED

Modèle `active`/`archivedAt`/`archiveReasonCode`/`archiveReason` ajouté de façon rétrocompatible (aucune
réécriture forcée des 15 utilisateurs de démonstration existants — `isUserActive()` les considère actifs par
construction, `active!==false`). `deactivateUser()`/`reactivateUser()` : jamais de `splice`/`delete` sur
`state.users` (vérifié par test USRARCH15 : longueur de `state.users` strictement inchangée après tout le
cycle désactivation/réactivation). `staffEligibleUsers()` exclut désormais les comptes désactivés —
unique point d'entrée du sélecteur Collaborateur/Scan du produit, jamais dupliqué. Protection du compte
courant vérifiée : `CANNOT_DISABLE_CURRENT_USER` retourné et jamais contourné, y compris en appel direct au
moteur (pas seulement un bouton masqué côté UI — le bouton est d'ailleurs absent du formulaire pour son
propre compte, **et** le moteur refuse explicitement si jamais sollicité autrement).

## Tests ciblés

42/42 PASS (MSGRESP01-10, STOCKUX01-11, INVUX01-06, USRARCH01-15) — vérifiés par interaction navigateur
réelle (clics, `.selectOption()`, `.fill()`) sur `dentalflow-next-poc-v3.12.2.html`, puis rejoués à
l'identique sur `dentalflow-test-labo-v3.12.2.html` (42/42 également). Détail complet dans
`DENTALFLOW_V3_12_2_TEST_REPORT.md`.

## Décision finale

**`READY_FOR_NEXT_LAB_TEST`**

Les quatre retours de recette sont corrigés, vérifiés par tests ciblés ET par interaction navigateur réelle,
captures d'écran à l'appui (0 débordement horizontal sur l'ensemble des écrans/largeurs testés). Le produit
`dentalflow-next-poc-v3.12.1.html` reste strictement inchangé. La non-régression complète (suite interne
467/468 ×3 — écart unique, pré-existant, daté, identique sur le produit non modifié — NAVDOM 31/31, UI CLICK
16/16, REC01-06/FLOW01-09/CABFLOW01-06, MIGFLOW01-05, SEL01-05, CABSEL01-02, CABTEETH01-02, EDIT01-04,
DATE01-04, QR01-03/05, CABUX01-10, confidentialité P1-P6/LAB_PATIENT_NAME_LEAKS=0) est confirmée à la fois
sur le produit et sur le kit V3.12.2, 0 erreur console sur l'ensemble des runs. Le kit conserve intégralement
la baseline V3.12.1.1 (126/91/13/352/19/515 + 10 commandes fictives 2/2/2/2/1/1, contexte de recette
`testSessionOverride`, correctif Scan) — les tests Scan Session/Permissions V3.12.1.1 (21/21) et les
Scénarios A/B/C (15/15) ont été rejoués sans régression sur le kit V3.12.2. Seule réserve inchangée depuis
V3.12.1 : QR04 (caméra réelle sur smartphone) reste à vérifier physiquement lors de la séance.
