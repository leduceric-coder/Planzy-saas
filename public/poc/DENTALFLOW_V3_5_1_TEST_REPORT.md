# DentalFlow Next V3.5.1 — Rapport de tests

Base : `dentalflow-next-poc-v3.5.html` (non modifiée, conservée telle quelle).
Fichier testé : `dentalflow-next-poc-v3.5.1.html`.
Exécution : Playwright / Chromium headless, suite unitaire interne (`?runTests=1`), interactions DOM réelles, mesures de position d'éléments (stabilité visuelle) et contextes navigateur neufs (persistance/migration).

## Synthèse

**77/77 tests PASS** (65 tests moteur/UX conservés de la V3.5 — 2 mis à jour pour refléter fidèlement les nouveaux libellés/le nouveau filtre demandés par ce hotfix, sans affaiblissement — + 10 nouveaux tests V3.5.1 requis par le mandat, §16-18, §22-23, §30, §79-81). **0 erreur console.** **Responsive 16/16.** **Stabilité visuelle des onglets : 0.00px de déplacement mesuré sur les 4 largeurs.** **Verrouillage de scroll du wizard confirmé à 390px.**

## A. Scénario 680 € — une carte = un engagement (§16, §47.A)

Fixture : `PP-V351-680`, fournisseur Ivoclar Test, 4 lignes A=462€, B=60€, C=68€, D=90€, total=680€.

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Une seule carte pour la proposition | 1 `data-proposal-card="PP-V351-680"` | `oneCard:true` | PASS |
| Montant affiché sur la carte | « 680 € » visible, bouton « Commander 680 € » | `showsTotal:true` | PASS |
| Après clic Commander : PurchaseOrder créée | `poCreated:true` | `true` | PASS |
| Montant PO = montant carte | `680` | `poTotal:680` → `poTotalMatches:true` | PASS |

Aucune ambiguïté possible entre le montant affiché avant clic et l'engagement réel : les deux valent **680 €**, dérivées de la même donnée (`p.total`).

## B. Article réellement déclencheur (§17, §47.B)

Fixture : proposition ORDER_NOW à 4 lignes, seule la ligne A a `lastSafeOrderAt` dépassé (B/D ont une échéance future, C n'a pas de rupture calculable).

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Le tag « Urgent » apparaît uniquement sur la ligne A | `urgentCount===1`, positionné juste après l'article A | `{"urgentNearA":true,"urgentCount":1}` | PASS |

## Proposition WAIT (§13, §18)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Une seule carte fournisseur, aucune ligne « Urgent », pas de gros bouton Commander, raison WAIT affichée | Tout vrai | `{"oneCard":true,"noUrgentTag":true,"hasWaitReason":true,"noBigPrimary":true}` | PASS |

## C. Render pur — aucune mutation métier (§19-23, §47.C)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| 5 appels consécutifs à `renderStockSupply()` → aucun nouvel `ActivityEvent` | `after===before` | `{"before":3,"after":3,"delta":0}` | PASS |
| Après une vraie mutation (tarif modifié via `submitTariffForm`), `reconcileProposals()` fonctionne toujours ; 5 renders supplémentaires ne journalisent rien de plus | `mutationCreatedEvents:true`, `noRenderPollution:true` | idem | PASS |

`reconcileProposals(state)` a été retiré de `renderStockSupply()`. Il reste appelé exclusivement après une vraie mutation métier — points de mutation vérifiés inchangés : `submitSupplierForm`, `setSupplierActive`, `submitTariffForm`, `applyImportRows`, `approveProposal`, `receivePurchaseOrder`, `cancelPurchaseOrder`, `resetDemoV6`, `ensureV34Model` (démarrage/migration), simulateur d'urgence de démonstration.

## D. Journal — recherche, période, pagination (§25-30, §47.D)

Fixture : 80 `ActivityEvent` injectés (dates échelonnées sur 80 jours), dont un titre unique de test.

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Les 80 événements présents (période = Tout) | `containsAll:true` | `true` | PASS |
| Recherche isole l'événement au titre unique | 1 résultat exact | `searchWorks:true` | PASS |
| Période « 7 jours » réduit strictement la liste (8 événements attendus sur 80) | `<80` et `≥7` | `periodWorks:true` | PASS |
| Pagination visible et fonctionnelle (>50 lignes) | Page 1/N affichée, bouton Suivant actif | `paginationWorks:true` | PASS |
| Aucune duplication (source unique `state.activityEvents`) | 80 identifiants uniques | `noDuplication:true` | PASS |

Le champ de recherche est mis à jour de façon **ciblée** (`refreshJournalResults()` ne remplace que `#journal-results-wrap`/`#journal-count`), jamais tout l'onglet — le focus du champ n'est jamais perdu pendant la frappe.

## Filtres « À traiter » (§70-81)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Filtre fournisseur : PP-A (fournisseur A), PP-B/PP-C (fournisseur B) → filtre B isole B et C | `hasA:false, hasB:true, hasC:true` | conforme | PASS |
| Filtre échéance « 7 prochains jours » : A (auj.), B (+5j) visibles ; C (+20j), D (+45j) exclus | `hasA:true,hasB:true,hasC:false,hasD:false` | conforme | PASS |
| Filtres purement UI : aucun `ActivityEvent`, aucune `PurchaseProposal` modifiée en changeant de filtre | `noNewEvents:true, proposalsUnchanged:true` | conforme | PASS |
| État vide filtré : message clair + bouton Réinitialiser | présents | `hasMessage:true, hasReset:true` | PASS |

## Navigation — libellés courts (§82-87)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Menu Outils = Charge / Stock / Rapports / Utilisateurs | Exact | `["Charge","Stock","Rapports","Utilisateurs"]` | PASS |
| Routes internes inchangées (`planning`, `stock`, `reports`, `users`) | `routesUnchanged:true` | `true` | PASS |
| Titre de la page Stocks & achats après clic sur « Stock » | « Stocks & achats », onglets À traiter/Stock/Commandes/Fournisseurs | confirmé (via `setPageMeta`, non modifié) | PASS |
| Aucune entrée Achats/Journal autonome | `noPurchases:true, noActivity:true` | conforme | PASS |

## E. Wizard Données — verrouillage de scroll mobile (§31-33, §47.E)

Contexte navigateur réel, viewport 390×844, via le hook de test dédié `?openWizard=import` (même convention que `?persistTest=`/`?migrationTest=`/`?emptyTest=` déjà existants — la barre latérale desktop, entièrement masquée sous 860px, est un comportement hérité de la V3.3 hors périmètre de ce hotfix).

| ÉTAPE | RÉSULTAT |
|---|---|
| Sans wizard, la page est scrollable (contrôle) | `baselineScrollableProof:true` (scroll à 300px réussi) |
| Ouverture du wizard | `wizardOpen:true` |
| `<html>` : `overflow:hidden`, classe `scroll-locked` appliquée | `htmlOverflow:"hidden"`, `scrollLockedClass:true` |
| Geste utilisateur réel (molette) sur l'arrière-plan pendant que le wizard est ouvert | **aucun déplacement** — `backgroundLocked:true` |
| Le wizard lui-même reste scrollable (`.wizard-card{overflow:auto}`, inchangé) | confirmé structurellement |
| Fermeture du wizard → le verrou se relâche | `overflow:"visible"`, `scroll-locked` retiré |

**PASS** sur l'ensemble.

## F. Tests moteur existants (65 tests V3.5, aucune régression)

Tous restent **PASS**. Deux tests ont été **mis à jour** pour refléter fidèlement les changements explicitement demandés par ce hotfix (jamais affaiblis — la rigueur de l'assertion est identique, seule la valeur attendue change en cohérence avec le nouveau comportement demandé) :

- *« Navigation : Outils… »* — attend désormais `["Charge","Stock","Rapports","Utilisateurs"]` (§82-86 du mandat) au lieu des anciens libellés longs, et vérifie en plus que les routes internes n'ont pas changé.
- *« À traiter : … aucun code moteur visible »* — la vérification « pas de code moteur » compare désormais le **texte visible réellement rendu** (balises retirées) plutôt que le HTML brut, car le nouveau filtre Action (§74) encode nécessairement `ORDER_NOW`/`WAIT`/`BLOCKED` dans des attributs `value=""` invisibles pour le fonctionnement du filtre — jamais dans un texte que l'utilisateur peut lire.

Tests particulièrement sensibles retestés et confirmés PASS : supplier viability A/B/C, WAIT 5→9, minimumOrder, franco null, BLOCKED, `approveProposal`, réception partielle, PO cancelled, migration V5→V6, persistance, legacyIncoming, premier démarrage réel, `knownDemand`, double scan.

## G. Stabilité visuelle des onglets (§54-61)

Mesure de la position horizontale (`boundingBox().x`) de `#page-title` et `#search` avant/après changement d'onglet, aux 4 largeurs :

| Largeur | Commandes (filtres) | Stocks & achats (4 onglets) | Rapports (2 onglets) |
|---|---|---|---|
| 1440px | Δ=0.00px | Δ titre=0.00px, Δ recherche=0.00px | Δ=0.00px |
| 1024px | Δ=0.00px | Δ titre=0.00px, Δ recherche=0.00px | Δ=0.00px |
| 768px | Δ=0.00px | Δ titre=0.00px, Δ recherche=0.00px | Δ=0.00px |
| 390px | Δ=0.00px | Δ titre=0.00px, Δ recherche=0.00px | Δ=0.00px |

**0 erreur console** sur l'ensemble de ces mesures. Cause racine traitée directement (`scrollbar-gutter:stable` sur `<html>`, §57 du mandat) plutôt que masquée par une animation.

## H. Boutons et espacement (§62-69)

- `.purchase-actions` (zone d'actions des cartes « À traiter ») : `gap` porté de 8px à 12px — respiration visuelle nette entre `[Commander]` et `Pourquoi ?`.
- `.secondary` (bouton « Détail » et autres actions secondaires standard) : n'avait **aucun padding propre** — ajout de `padding:0 16px`, cohérent avec les autres classes de bouton du système (`.ghost`, `.filter`, `.stock-edit-btn`).
- Vérifié visuellement sur Détail, Commander XXX €, Pourquoi ?, Voir le problème, Modifier, Suspendre, Réactiver — aucun texte collé au bord ni coupé.

## I. Responsive — 16/16

| Largeur | lab | staff | dentist | scan |
|---|---|---|---|---|
| 1440px | PASS | PASS | PASS | PASS |
| 1024px | PASS | PASS | PASS | PASS |
| 768px | PASS | PASS | PASS | PASS |
| 390px | PASS | PASS | PASS | PASS |

**ALL_OK: true**, 0 erreur console/page.

## J. Persistance / migration (contexte navigateur neuf, revérifié)

| TEST | ACTUAL | PASS/FAIL |
|---|---|---|
| Premier démarrage réel (localStorage vide) | `zirconePhys:5`, `schemaVersion:6` | PASS |
| legacyIncoming (2 chargements à froid) | `supplierId:null`, idempotent | PASS |
| Sentinelle 45/12 (2 chargements à froid) | valeurs réelles préservées, idempotent | PASS |
| Persistance générique + migration (hooks combinés) | tout `pass:true` | PASS |
| Persistance des champs fournisseur V3.5 (rechargement à froid réel) | tous les champs intacts | PASS |

## K. Vie privée

Grep direct : `patientName|patient_name|nomPatient|patientFirstName|patientLastName` → **0 occurrence**.

## L. Non-hardcoding

Audit ciblé sur les fonctions moteur et fournisseur : seuls les 2 littéraux légitimes `CF-DEMO-EMX`/`SUP-IVOCLAR` du seed de démonstration (préexistant, non touché) subsistent — aucune nouvelle occurrence codée en dur.

## Synthèse finale

- **77/77 tests PASS** (65 conservés + 10 nouveaux V3.5.1)
- **Une carte = une PurchaseProposal**, montant UI = montant engagé, confirmé sur le scénario 680€
- **Seul l'article réellement déclencheur** est marqué Urgent
- **`renderStockSupply()` est un pur render** : 5 renders = 0 ActivityEvent parasite ; les vraies mutations continuent de fonctionner
- **Journal** : recherche + période + pagination opérationnelles sur 80 événements, source unique
- **Wizard mobile** : arrière-plan verrouillé, wizard lui-même scrollable, confirmé à 390px
- **Stabilité visuelle** : 0.00px de déplacement mesuré sur Commandes/Stocks & achats/Rapports aux 4 largeurs
- **Filtres À traiter** : fournisseur/échéance fonctionnels, purement UI, jamais de mutation
- **Menu Outils** : Charge/Stock/Rapports/Utilisateurs, routes et titre de page inchangés
- **Responsive 16/16, console 0 erreur, vie privée conforme, aucune régression moteur**
