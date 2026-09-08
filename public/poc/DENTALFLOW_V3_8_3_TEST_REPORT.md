# DentalFlow Next V3.8.3 — Test Report

## Résumé

| Vérification | Résultat |
|---|---|
| Suite persistée (`?runTests=1`, navigateur réel Chromium/Playwright) | **283/283 PASS** |
| dont conservés de V3.8.2 (236 intacts + 2 réécrits) | 238 |
| dont nouveaux V3.8.3 | 45 |
| `node --check` (5 blocs `<script>`) | 5/5 OK |
| Isolation (`exportDentalFlowJSON()` avant/après suite complète) | Identique (111 061 caractères, avant = après) |
| Responsive (7 viewports × 3 modes) | 21/21 — 0 débordement horizontal, 0 erreur console |
| Thèmes (light/dark/system × 6 vues) | 18/18 — 0 erreur console |
| `dentalflow-next-poc-v3.8.2.html` | Confirmé inchangé (`git diff` vide) |

Deux exécutions consécutives de la suite complète confirment l'absence de flakiness introduite par V3.8.3 (283/283 les deux fois).

## Nouveaux tests V3.8.3 (45)

Tous exécutés dans un vrai navigateur Chromium (via `window.DentalFlowTest.runAll()`), avec accès complet au DOM rendu (`getComputedStyle`, `getBoundingClientRect`, inspection des règles CSS via `document.styleSheets` pour les exigences purement visuelles qu'un test d'état seul ne peut pas couvrir — ex. hauteur de bouton, présence d'une règle `:hover` dédiée).

### H01-H04 — Header (Partie A)
- **H01** : recherche et cloche à hauteur identique, dans la plage 48-52px.
- **H02** : badge de la cloche en `position:absolute`, bouton cloche toujours 48-52px (jamais déplacé).
- **H03** : conteneurs d'icônes KPI Accueil dans la plage 44-48px.
- **H04** : SVG des boutons icône du header ≥ 20px.

### N01-N03 — Notifications (Partie B)
- **N01** : `.notification-icon` exactement 40×40, `flex-shrink:0`, SVG interne 18-20px.
- **N02** : aucun débordement horizontal du panneau, chevron toujours présent dans chaque ligne.
- **N03** : mapping couleur/catégorie exact (Commandes=bleu, Messages/RH=violet, Production/Stock=orange, Achats=bleu, alerte critique=rouge prioritaire).

### C01-C06 — États commandes (Partie C)
- **C01** : priorité stricte (retard>bloquée>nouvelle) vérifiée sur l'intégralité du jeu de commandes réel (pas seulement un cas synthétique).
- **C02** : bordure gauche 5px + fond non-blanc pour les 7 états, lu directement dans les règles CSS appliquées.
- **C03** : le badge NOUVEAU coexiste avec la couleur d'état primaire (retard prioritaire même si la commande est aussi nouvelle).
- **C04** : chaque état a une règle `:hover` dédiée dont le fond diffère du survol générique blanc (`#fbfcff`) — couvre les 7 états, y compris Production/Livrée/Annulée qui n'en avaient aucune en V3.8.2.
- **C05** : variante `data-theme="dark"` explicite présente pour les 7 états.
- **C06** : **régression dédiée** au bug auto-corrigé pendant l'implémentation — vérifie que `html[data-theme="system"] .orders-table tr.ovs-late` n'existe **jamais** hors d'un `@media(prefers-color-scheme:dark)`.

### CH01-CH06 — Charge (Partie D)
- **CH01** : la table a au maximum 5 colonnes (Collaborateur/Période/Impact/Type/Actions).
- **CH02** : `#whatif-form` absent du rendu tant que la side-window n'est pas ouverte (fin du formulaire permanent).
- **CH03** : la side-window "+ Ajouter une simulation" contient bien les 4 champs attendus.
- **CH04** : approuver une demande la retire du tableau des demandes à valider ET la marque `approved` (le même moteur `approveLeave`, testé isolément puis restauré).
- **CH05** : une simulation ajoutée apparaît immédiatement avec le pill "Simulation".
- **CH06** : "Réinitialiser la simulation" absent quand `whatIfSims` est vide, présent dès qu'une simulation existe.

### S01-S05 — Stock (Partie E)
- **S01** : `createArticle()` — l'article apparaît immédiatement dans `state.articles` et dans le texte rendu de la page Stock.
- **S02** : stock physique initial strictement 0.
- **S03** : aucun `StockMovement` créé à la création (compteur global inchangé).
- **S04** : référence dupliquée refusée avec `reason:'DUPLICATE_ARTICLE_REFERENCE'`, aucun article ajouté.
- **S05** : `manufacturerId` correctement enregistré et résolu par `manufacturerName()`.

### F01-F04 — Facture (Partie F/G)
- **F01** : `invoiceDocumentHTML()` — au moins 3 cellules `class="num"` (Qté/Prix/Total) et la classe `class="label"` sur Prestation.
- **F02** : tous les boutons du pied d'aperçu partagent `.btn-fixed`, quel que soit le statut de la facture (DRAFT vs ISSUED/SENT testés implicitement selon le seed).
- **F03** : `invoiceMatchesQuery()` — une recherche par nom de cabinet trouve la facture correspondante et exclut une requête sans rapport.
- **F04** : `invoiceMatchesQuery()` — une recherche par identifiant de commande trouve la facture qui la contient.

### P01-P05 — Prestations (Partie H)
- **P01** : tri par nom (`label`) strictement alphabétique (locale FR).
- **P02** : tri par prix croissant puis décroissant, cohérent dans les deux sens.
- **P03** : tri par statut — actives et suspendues correctement regroupées selon la direction de tri.
- **P04** : les 3 boutons d'action (Modifier/Matières/Suspendre) mesurent exactement 32px de hauteur (mesure réelle post-rendu, pas seulement une classe partagée).
- **P05** : la recherche filtre par libellé/catégorie ; une requête sans correspondance renvoie une liste vide.

### M01-M06 — Matières multiples (Partie I)
- **M01** : ajout d'une matière A — persistée dans `state.serviceMaterials` avec la bonne quantité.
- **M02** : ajout d'une matière B (article différent, même prestation) — les deux coexistent (compte = 2, A non écrasée).
- **M03** : les deux matières sont lisibles **ensemble** pour la même prestation.
- **M04** : `knownDemand()` cumule la demande des deux matières associées (vérifié sur une commande réelle active du seed).
- **M05** : `consumeForScan()` ne consomme que la matière rattachée à l'étape scannée — l'autre matière (rattachée à une étape différente) reste non consommée après le scan.
- **M06** : retirer une association décrémente immédiatement le compteur "Utilisé pour" affiché dans Stock (mesuré avant/après sur le texte réellement rendu).

### U01-U06 — Utilisateurs (Partie J/K)
- **U01** : un avatar `.users-avatar` est rendu pour chaque ligne du tableau (compte = nombre d'utilisateurs).
- **U02** : les initiales affichées correspondent exactement à `userInitials(userDisplayName(u))`.
- **U03** : la couleur d'un même avatar est identique entre deux rendus successifs (déterminisme, pas d'aléatoire).
- **U04** : chaque pastille de rôle porte à la fois une classe de couleur connue (`ROLE_UI`) et un texte non vide — jamais la couleur seule.
- **U05** : le tri par Nom et par Prénom (`filteredSortedUsers`) reste strictement correct malgré la fusion visuelle de la colonne.
- **U06** : le filtre par droit (`usersFilterPerm`) continue de ne retourner que des utilisateurs possédant effectivement la permission demandée.

## Tests V3.8.2 réécrits (2, extension stricte du mandat)

- **C01** (« une seule carte "Demandes & simulation" ») : réécrit pour vérifier le nouveau résumé compact `.chg-impact`/« Impact du scénario » et l'absence du formulaire permanent (`#whatif-form`), au lieu de l'ancienne ligne de synthèse textuelle « Impact simulé : −N commandes sur 8 semaines ». La carte unique et le tableau unique restent vérifiés à l'identique.
- **C02** (colonnes du tableau fusionné) : réécrit pour vérifier les 5 colonnes exactes (Collaborateur/Période/Impact/Type/Actions) au lieu des 8 colonnes V3.8.2 (Type/Collaborateur/Période/Jours/Motif/Impact capacité/Simulation/Décision-Actions) — `data-leave-approve`/`data-whatif-req` (garde-fous moteur sous-jacents) vérifiés à l'identique.

Ces deux réécritures documentent un changement de comportement **explicitement demandé par le mandat V3.8.3 Partie D** — jamais une régression silencieuse ni un affaiblissement des garanties (les mêmes fonctions moteur — `approveLeave`, `chargeRowImpact`, `whatIfLeaves` — restent testées).

## Responsive détaillé

7 viewports (1440/1366/1024/768/430/390/375) × 3 modes (LAB responsive / STAFF mobile-first / DENTIST desktop-first) = 21 combinaisons, chacune vérifiée pour : absence de débordement horizontal (`scrollWidth <= clientWidth`), contenu réellement rendu (`body.innerText.length >= 20`), absence d'erreur JS console/page. **21/21 PASS.**

## Thèmes

3 thèmes (light/dark/system) × 6 vues (Accueil/Commandes/Charge/Stock/Factures/Utilisateurs) = 18 combinaisons, chacune vérifiée pour absence d'erreur console/page lors du changement de vue. **18/18 PASS.**

## `node --check`

Les 5 blocs `<script>` extraits et vérifiés individuellement avec `node --check` : **5/5 OK**, 0 `SyntaxError`.

## Isolation

`window.DentalFlowV34.exportDentalFlowJSON()` (état canonique sérialisable, `serializableState()`) capturé avant et après l'exécution complète des 283 tests : **chaînes strictement identiques** (111 061 caractères). Note méthodologique : une comparaison naïve sur `JSON.stringify(state)` brut (incluant des champs UI volatils comme `state.view`/`state.sidePanel`/les clés de tri/recherche en cours, jamais persistés) montre un delta — **ce delta existe déjà à l'identique sur `dentalflow-next-poc-v3.8.2.html`** (vérifié par comparaison croisée), confirmant qu'il ne s'agit pas d'une régression introduite par V3.8.3 mais d'un artefact préexistant sans impact sur l'état réellement exporté/persisté.

## Flakiness connue (non liée à V3.8.3)

Aucune instabilité observée sur les deux exécutions complètes de cette session (283/283 les deux fois). Une instabilité isolée du test *« Scénario métier complet V1.2.1 »* avait été observée une fois pendant les travaux de la Partie B (avant les changements ultérieurs des Parties C à K), puis confirmée non reproductible sur re-exécution immédiate, y compris sur le baseline V3.8.2 non modifié — non liée à un changement V3.8.3, hors périmètre de correction de cette mission.
