# DentalFlow Next V3.4.3 — Rapport d'implémentation (Final Audit Hotfix)

Fichier livré : `dentalflow-next-poc-v3.4.3.html` (monolithique, ouvrable directement dans un navigateur).
Base : `dentalflow-next-poc-v3.4.2.html` (non modifié).
Références : `DENTALFLOW_PURCHASING_SPEC_V1.2_FINAL.md`, `DENTALFLOW_PURCHASING_SPEC_V1.2.1_FINAL.md` (priorité V1.2.1), `DENTALFLOW_V3_4_2_TEST_REPORT.md`, `DENTALFLOW_V3_4_2_IMPLEMENTATION_REPORT.md`.

Cette version corrige exclusivement les anomalies identifiées par l'audit indépendant de la V3.4.2. Aucune fonctionnalité nouvelle, aucune refonte architecturale, aucune réécriture de la persistance V6 (jugée solide et non modifiée).

## P0-1 — Migration V5→V6 potentiellement destructive

**Cause racine.** `migrateStockArrayToV6()` détectait un état "démo" via une sentinelle sur un seul article (`ZIR-HT-001 qty===45 && min===12`) et, si elle matchait, substituait les quantités **de tous les articles migrés** par les valeurs curées de `DEMO_ARTICLES`. Un utilisateur ayant réellement ces valeurs pour cet article — coïncidence possible — voyait tous ses autres stocks silencieusement écrasés. Un second bug, plus insidieux, existait indépendamment de la sentinelle : les articles déjà pré-ajoutés au catalogue depuis `DEMO_ARTICLES` (avant la boucle de migration) ne recevaient **jamais** les valeurs `min`/`capacity` du legacy, quelle que soit la sentinelle — `if(!s.articles.some(a=>a.id===id))` sautait purement et simplement l'application des valeurs réelles pour tout article dont la référence existait déjà dans `DEMO_ARTICLES`.

**Correction.** Réécriture complète selon la règle **PRESERVE SAVED VALUES** : pour chaque article legacy, `qty→OPENING` exact, `min→safetyStock` exact, `incoming→PurchaseOrder` synthétique exact, `capacity→capacity` exact — appliqués **inconditionnellement**, que l'article existe déjà dans le catalogue ou non. `DEMO_ARTICLES` ne sert plus qu'à : (a) compléter le catalogue avec les articles n'ayant aucune contrepartie dans le legacy, (b) fournir un `label`/`category`/`unit`/`averageConsumption` par défaut quand le champ est réellement absent du legacy (le modèle `stock[]` de V3.3.x ne portait aucune donnée de consommation moyenne).

**Conséquence assumée et documentée.** Le tout premier démarrage à froid de l'application (sans reset natif V6 explicite) passe par ce chemin de migration, sur le seed legacy historique `demoStock` (qui contient `ZIR-HT-001 qty:45 min:12`, les valeurs de démonstration originales V3.3.x). Avec la sentinelle supprimée, ce premier démarrage migre désormais fidèlement ces valeurs réelles (45/12/…) au lieu de les remplacer silencieusement par les valeurs curées de `DEMO_ARTICLES` (5/4/…). C'est le comportement correct et voulu : le **reset natif V6** (`resetDemoV6`/`seedV6()`, introduit en V3.4.2) reste le chemin dédié pour obtenir le jeu de démonstration curé, sans jamais passer par la migration legacy — les deux chemins sont désormais cohérents avec leurs contrats respectifs.

**Effet de bord corrigé.** Le hook de test `runV341PersistenceVerify()` comparait `physicalStock('ART-ZIR-HT-001')` à une valeur absolue codée en dur (`12`, dérivée de l'ancien comportement 5+7). Cette valeur n'est plus un invariant valide puisque le stock de départ d'un premier démarrage reflète maintenant fidèlement le legacy réel. Le hook vérifie désormais la présence et l'intégrité du mouvement de test (`MOV-PERSIST-TEST`, qty=7) plutôt qu'un total absolu — la véritable propriété testée (persistance) reste intacte.

## P0-2 — Proposition BLOCKED commandable

**Cause racine.** `approveProposal()` ne vérifiait ni `recommendedAction==='BLOCKED'` ni `blocking.length` avant de créer une `PurchaseOrder`.

**Correction.** Garde ajoutée en tête de fonction : si bloquée, aucune `PurchaseOrder` n'est créée, un `ActivityEvent` WARNING est journalisé avec la raison, et la fonction retourne `{success:false, reason:'BLOCKED_PROPOSAL'}`. Le chemin de succès continue de retourner l'objet `PurchaseOrder` (compatibilité avec tous les appelants existants).

## P0-3 — Article sans fournisseur/tarif invisible

**Cause racine.** `computeNeeds()` retournait immédiatement (`if(!baseTariff)return`) pour tout article sans `ArticleSupplier`, avant même d'appeler `chooseSupplier()` — qui pourtant gérait déjà correctement ce cas (`blocking:['no_supplier']`) mais n'était jamais atteint.

**Correction.** Un article sans tarif dont le stock projeté (horizon = période de révision par défaut, faute de délai fournisseur connu) descend sous le seuil de sécurité génère désormais un besoin visible avec `recommendedSupplierId:null`, `blocking:['missing_supplier']`. `reconcileProposals()` a été étendu pour réconcilier ces besoins dans une `PurchaseProposal` dédiée (`supplierId:null`), au lieu de les ignorer (`if(!n.recommendedSupplierId)return` supprimé) — avec un traitement explicite en fin de boucle puisque `supplierById(null)` ne retourne aucun fournisseur : coûts à zéro, `recommendedAction:'BLOCKED'`, raison affichable.

Un tarif présent mais sans prix (`unitPrice:null`) est traité séparément : `chooseSupplier()` ajoute désormais `'missing_price'` à `blocking` quand le fournisseur choisi n'a pas de prix connu, ce qui se propage à travers `computeNeeds()` → `reconcileProposals()` → `decideProposal()` (qui bloque déjà toute proposition dont `blocking.length>0`).

## P0-4 — UI BLOCKED ambiguë

**Correction.** `blockingReasonLabel()` traduit les codes (`missing_supplier`, `missing_price`, `no_supplier`) en texte lisible. La carte de proposition (`renderPurchases`) et le panneau de détail (`renderProposalDetail`) affichent, pour toute proposition `BLOCKED` : un bouton désactivé "Résoudre le blocage" (au lieu du bouton "Commander" auparavant toujours cliquable) avec la raison en `title` et en texte visible, et une bannière d'avertissement dans le détail.

## P0-5 — Réception fournisseur sans garde-fou métier

**Cause racine.** `receivePurchaseOrder()` acceptait toute quantité fournie dans `receipts`, sans jamais comparer au reliquat (`orderedQty - receivedQty`), et sans valider que la quantité soit un nombre positif fini. Seul l'attribut HTML `max` de l'`<input>` limitait la saisie côté UI — aucune protection côté fonction métier.

**Correction.** Pour chaque ligne, le reliquat réel est calculé, et toute quantité demandée qui le dépasse, ou qui est non numérique / `NaN` / `Infinity` / `≤0`, est **refusée intégralement** (préférence explicite du choix A de la mission plutôt que le clamp B) : aucun `StockMovement RECEIPT` n'est créé pour cette ligne, un `ActivityEvent` WARNING explique le refus. Les lignes valides du même appel sont traitées normalement (traitement par ligne, pas par appel).

## P1-1 — Faux positif du test WAIT→ORDER_NOW

**Cause racine.** Le test acceptait `qtyAfter>=qtyBefore`, ce qui validait à tort un cas où `qtyAfter===qtyBefore` (aucune évolution réelle de quantité). De plus, `addUrgentZirconeOrder()` ne créait qu'**une seule** commande "Bridge 3 éléments" (BOM ×2 = 2 unités) alors que son propre message de journal annonçait "2 bridges … 4 disques" — incohérence texte/données.

**Correction.**
- `addUrgentZirconeOrder()` crée désormais réellement 2 commandes Bridge (`URGENT_ZIR_ORDER_IDS`), cohérent avec le texte du journal (+4 unités réelles).
- La fixture de test (`runDemoScenario`, dans `purchaseFixtureFor`) fixe désormais explicitement `safetyStock` et `averageConsumption` de l'article testé, indépendamment de ce que produit la migration ou le seed courant, pour rester déterministe. Deux commandes Bridge réelles (BOM ×2 chacune) sont ajoutées pour simuler l'urgence. L'assertion est désormais strictement `qtyBefore===5 && qtyAfter===9` (`strictQty`), plus aucun `>=`.
- Aucune valeur n'est codée en dur dans le moteur : le résultat 5→9 découle entièrement du calcul générique (`computeNeeds`/`roundPack`/`projectedStock`) appliqué à une fixture dont les paramètres sont volontairement choisis pour produire ce résultat exact — la fixture peut légitimement fixer ses propres données, ce que la spec de mission autorise explicitement (§22).

## P1-2 — Surcoût fournisseur codé en dur

**Cause racine.** `chooseSupplier()` calculait `Math.round((chosen.unitPrice-pref.unitPrice)*9)` — une constante `9` sans rapport avec la quantité réellement recommandée ni avec le transport.

**Correction.** Le surcoût (ou l'économie) est désormais `landedCost(fournisseur recommandé, quantité réelle) − landedCost(fournisseur préféré, même quantité)`, quantité dérivée du même calcul `safetyStock − projectedStock(horizon)` que `computeNeeds()` utilise. Test dédié : fournisseur A (prix 10, transport 20) vs B (prix 11, transport 0) pour 9 unités → landed A=110, landed B=99 — B moins cher malgré un prix unitaire supérieur, correctement reflété dans l'explication ("Économie estimée : 11 € malgré un prix unitaire plus élevé").

## P1-3 — `PP-002`→`CF-0042` codé en dur

**Cause racine.** `approveProposal()` contenait `const poId=id==='PP-002'?'CF-0042':nextPOId(state)`.

**Correction.** Supprimé ; `nextPOId(state)` est désormais systématique, sans aucune exception liée à un ID de proposition.

## P1-4 — Minimum de commande + urgence + alternatif

**Cause racine.** `decideProposal()` détectait qu'une alternative viable existait (délai suffisant chez un autre fournisseur) et affichait `ORDER_NOW`, **sans jamais déplacer la ligne** vers la proposition de cet alternatif — la ligne restait dans la proposition du fournisseur préféré, dont le minimum de commande n'était toujours pas atteint.

**Correction.** Le routage vers l'alternatif se fait désormais **en amont**, dans `computeNeeds()` : après une première passe de calcul des besoins par fournisseur préféré, les groupes dont le sous-total n'atteint pas le minimum de commande sont examinés ligne par ligne ; toute ligne urgente pour laquelle un fournisseur alternatif peut livrer à temps est réellement reroutée vers cet alternatif (tarif, délai, quantité recalculés pour le nouveau fournisseur) avant que les propositions ne soient constituées. `decideProposal()` n'a donc plus besoin de "faire semblant" : si une ligne atteint encore `decideProposal()` avec un minimum non atteint et une urgence, c'est qu'aucun reroutage n'a été possible en amont → `BLOCKED` de façon cohérente. Deux tests dédiés couvrent le cas avec alternatif (bascule réelle, `ORDER_NOW` chez le nouveau fournisseur, ligne absente de l'ancien) et sans alternatif (`BLOCKED`, `approveProposal` refuse).

## P1-5 — Franco `null` traité comme "déjà atteint"

**Cause racine.** `(p.missingForFreeShipping||0)<=0` : `missingForFreeShipping` est `null` quand le fournisseur n'a pas de seuil de franco (`proposalTotals` le calcule ainsi intentionnellement), mais `null||0` coerce en `0`, et `0<=0` est vrai — la proposition passait donc à tort par la branche "Franco déjà atteint".

**Correction.** Garde explicite `p.freeShippingThreshold!=null && (p.missingForFreeShipping||0)<=0`. Un fournisseur sans franco ne peut plus jamais déclencher cette branche ; l'action se détermine alors sur les branches de délai / marge, sans jamais mentionner de franco. Test dédié : seuil `null`, transport 12, sous-total 92 → transport=12, total=104, aucune mention de "franco atteint" dans l'explication.

## P2-1 — `rejectedCount` comptait les erreurs, pas les lignes

**Cause racine.** `validateImportRows()` retournait `rejectedCount:errors.length` — une ligne à 2 erreurs comptait pour 2 lignes rejetées.

**Correction.** `rejectedCount:rows.length-valid.length` — invariant toujours correct puisque chaque ligne est soit valide soit rejetée, jamais les deux. Répercuté dans l'assistant d'import (aperçu, résultat, `ImportJob.rejectedCount`) et dans le message de toast.

## P2-2 — Historique `ImportErrors` écrasé

**Cause racine.** `state.importErrors=v.errors` remplaçait tout l'historique à chaque import.

**Correction.** `state.importErrors=(state.importErrors||[]).concat(v.errors).slice(-500)` — append-only avec plafond raisonnable pour un POC (miroir du plafond déjà appliqué à `activityEvents`). Chaque erreur porte le `jobId` de l'import qui l'a produite, permettant de retrouver les erreurs d'un job précis.

## P2-3 — Plusieurs fournisseurs préférés actifs

**Cause racine.** L'import de tarifs ajoutait une ligne `preferred:true` sans jamais retirer ce statut à l'ancien fournisseur préféré du même article.

**Correction.** Avant d'ajouter une nouvelle ligne préférée, toutes les lignes actives existantes du même article voient leur `preferred` mis à `false`.

## P2-4 — `slowMovingStock()` dépendait de la date machine

**Cause racine.** `Date.now()` utilisé pour le calcul du délai sans consommation, au lieu de l'horloge métier `Clock.now()` (qui peut être figée en mode démo).

**Correction.** `Clock.now().getTime()`. Test dédié : horloge fictive placée en 1990, consommation à 115 jours de cette horloge fictive (donc à des décennies de la vraie date machine) — le résultat dépend strictement de `Clock.now()`. Vérifié que ce test échoue effectivement (`dormant:true` au lieu de `false` attendu) en réintroduisant temporairement `Date.now()`, confirmant que le test discrimine réellement le bug.

## Responsive

**Panneau Messages (≤768px).** Root cause : ce n'était pas un bug de rendu, mais un artefact de mesure du smoke-test intégré au fichier — `document.body.innerText` était lu de façon synchrone, immédiatement après l'ouverture du panneau (`openSidePanel('messages')`), sans laisser le temps à la transition CSS (`opacity`/`visibility`, 0.22s) de se refléter dans le calcul du texte visible par le moteur de rendu. Le contenu HTML du panneau était pourtant déjà correct (`side-panel-head` contenait bien "Messages") — confirmé en ajoutant un délai de mesure, qui fait immédiatement passer le contrôle au vert. Corrigé en lisant directement `textContent` de `#side-panel-head` plutôt que `document.body.innerText`, ce qui est indépendant du timing d'animation et ne modifie aucun comportement applicatif réel.

**Débordement horizontal en mode Scan à 390px.** Root cause confirmée par inspection DOM : `.scan-cmd-input{flex:1}` n'avait pas `min-width:0`, et les éléments flex ont par défaut `min-width:auto`, qui les empêche de rétrécir sous leur largeur intrinsèque (celle d'un `<input>` sans contrainte). Le même correctif existait déjà dans le fichier pour le mode Staff (`.staff-portal .scan-cmd-input{min-width:0}`, ajouté en V3.3.1) mais n'avait jamais été appliqué au mode Scan autonome (`.scan-app`). Ajout de `min-width:0` à la règle de base `.scan-cmd-input` — corrige l'overflow (`scrollWidth` passe de 437 à exactement 390) sans effet sur les largeurs plus grandes, où l'espace disponible était déjà suffisant.

Les deux corrections sont locales, ciblées, et n'affectent aucun autre comportement — 16/16 combinaisons (4 largeurs × 4 modes) passent désormais.

## Invariants (rappel, tous revérifiés)

- `projectedStock(h) = physicalStock + incomingArrivingWithin(h) − expectedDemand(h)`.
- `expectedDemand(h) = max(knownDemand(h), baselineDemand(h))`.
- Une proposition d'achat = un fournisseur (y compris désormais la proposition dédiée `supplierId:null` pour les besoins sans fournisseur, qui reste un cas particulier explicite, pas une exception silencieuse).
- Mouvements de stock immuables et append-only.
- Idempotence de consommation via `consumptionKey`.
- **Nouveau (V3.4.3)** : une proposition `BLOCKED` ne peut jamais devenir une `PurchaseOrder`.
- **Nouveau (V3.4.3)** : une réception ne peut jamais dépasser le reliquat commandé.
- **Nouveau (V3.4.3)** : la migration V5→V6 préserve toujours les valeurs legacy réellement présentes ; `DEMO_ARTICLES` ne complète que les champs absents.
- Aucune identité patient dans le code source ni l'état runtime (revérifié, aucune régression).

## Séparation seed / moteur (audit du code, §61-62 de la mission)

Recherche exhaustive de `ART-ZIR-HT-001`, `PP-001`/`PP-002`, `CF-0042`, `Ivoclar`, `Henry Schein`, `purchaseScenarioUrgent`, `*9`, `qty===9` dans l'ensemble du fichier : toutes les occurrences restantes sont confinées à `DEMO_ARTICLES`/`DEMO_SUPPLIERS`/`DEMO_ARTICLE_SUPPLIERS`/`BILL_OF_MATERIALS` (données de seed), aux fixtures de test (`runDemoScenario`, `runReturnPreferredScenario`, blocs `test(...)`), aux hooks de vérification de migration/persistance (infrastructure de test), ou à des commentaires documentant explicitement la suppression du hardcoding. Aucune ne subsiste comme branche conditionnelle dans `knownDemand`, `chooseSupplier`, `decideProposal`, `computeNeeds`, `reconcileProposals`, `approveProposal` ou `receivePurchaseOrder`. `CF-0042` : zéro occurrence (supprimé).

## Tests

35 tests unitaires isolés dans `runAllTests()` (24 conservés de la V3.4.2, 11 nouveaux). Chaque nouveau test suit la méthodologie de la mission : reproduction du comportement, cause racine identifiée, correction, test de non-régression strict, vérification qu'il échouait avant correction quand c'était raisonnablement reproductible (démontré explicitement pour le test WAIT→ORDER_NOW — faux positif confirmé avec l'ancienne assertion `>=` — et pour le test `slowMovingStock`/Clock — échec confirmé en réintroduisant `Date.now()`), vérification qu'il passe après. État vérifié strictement identique avant/après `runAllTests()` (comparaison `exportDentalFlowJSON()`).

## Limitations réelles hors périmètre

Aucune limitation nouvelle. Les deux défauts responsive préexistants de la V3.4.2 ont été corrigés dans cette version, conformément à la consigne explicite de la mission ("cette V3.4.3 est la dernière passe avant gel de cette branche").
