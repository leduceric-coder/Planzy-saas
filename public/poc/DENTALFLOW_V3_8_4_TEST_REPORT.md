# DentalFlow Next V3.8.4 — Test Report

## Résumé

| Vérification | Résultat |
|---|---|
| Suite persistée (`?runTests=1`, navigateur réel Chromium/Playwright) | **297/297 PASS** |
| dont conservés de V3.8.3 (281 intacts + 2 réécrits) | 283 |
| dont nouveaux V3.8.4 | 14 |
| `node --check` (5 blocs `<script>`) | 5/5 OK |
| Isolation (`exportDentalFlowJSON()` avant/après suite complète) | Identique (111 061 caractères, avant = après) |
| Responsive (7 viewports × 3 modes) | 21/21 — 0 débordement horizontal, 0 erreur console |
| Thèmes (light/dark/system × 6 vues) | 18/18 — 0 erreur console |
| `dentalflow-next-poc-v3.8.3.html` | Confirmé inchangé (`git diff` vide) |

Deux exécutions consécutives de la suite complète confirment l'absence de flakiness introduite par V3.8.4 (297/297 les deux fois).

## Nouveaux tests V3.8.4 (14)

Tous exécutés dans un vrai navigateur Chromium (via `window.DentalFlowTest.runAll()`), avec accès complet au DOM rendu (`getComputedStyle`, `getBoundingClientRect`, inspection des règles CSS via `document.styleSheets`).

### CAB08-CAB12 — Réparation Cabinets P0 (Partie H)

- **CAB08** (§56) : fixture `schemaVersion=10`, `cabinets=[]`, orders référençant « Cabinet Moderne »/« Clinique Belle Dent », un dentiste et une facture référençant « Cabinet Moderne » — après `repairCabinetsV10()`, les 2 cabinets existent (`ACTIVE`), et les `cabinetId` sont rétro-remplis sur orders/dentists/invoices.
- **CAB09** (§57) : réparation partielle — « Cabinet Moderne » existe déjà avec `status=ARCHIVED` et un email personnalisé ; « Clinique Belle Dent » absente. Après réparation : Cabinet Moderne garde le **même id**, le **même statut ARCHIVED** et le **même email**, inchangés ; Clinique Belle Dent est créée `ACTIVE`.
- **CAB10** (§58) : idempotence — `repairCabinetsV10()` appelée deux fois sur le même état ne crée jamais de doublon (1 cabinet après le premier appel, toujours 1 après le second, `changed===false` au second appel).
- **CAB11** (§59) : un seed V10 déjà correctement peuplé (état réel du seed natif) n'est jamais affecté — `repairCabinetsV10()` renvoie `false`, aucun cabinet parasite ajouté.
- **CAB12** (§51) : garde-fou anti-id — un `conversation.cabinetId` orphelin ressemblant à un id réel (`CAB-ORPHAN-999`, ne correspondant à aucun cabinet existant) n'est **jamais** utilisé pour créer un cabinet nommé « CAB-XXXX ».

### I01-I03 — Factures (Partie A)

- **I01** : l'onglet autonome « Pointage » n'existe plus — exactement 3 onglets (À facturer/Factures/Prestations).
- **I02** : sur une facture `SENT` réelle du seed (ou synthétisée via `sendInvoiceToCabinet()` si aucune disponible), le filtre « À pointer » l'affiche avec le badge À POINTER ; `recordInvoicePayment()` la passe `PAID` ; elle disparaît **immédiatement** du filtre « À pointer » et apparaît dans « Réglées » avec le badge RÉGLÉE — `invoicePayments` reste intact.
- **I03** : un état avec `invoicesTab='pointage'` passé dans `ensureV34Model()` (via un échange de `state`, même technique que `migrateFixture()`) ressort avec `invoicesTab==='invoices'`, sans erreur.

### J01-J06 — Vérifications visuelles réelles à 1440px (Partie J)

- **J01** : Accueil — 4 cartes `.hkpi.has-icon` sur une seule ligne (même `top`), hauteur maximale mesurée ≤125px, contenu (`.hkpi-num`) réellement rendu (hauteur >0).
- **J02** : Commandes — exactement 4 boutons `[data-filter]` + le contrôle `#order-status-filter` présent.
- **J03** : Commandes — les fonds `.ovs-late`/`.ovs-blocked`/`.ovs-new`/`.ovs-ready` (lus directement dans les règles CSS appliquées via `findCssRuleExact`) sont tous distincts entre eux (`Set` de taille 4).
- **J04** : Stock — au plus 3 boutons d'action primaires dans la barre d'outils (`.filters`), en excluant les items de sous-menu (`[data-row-menu-pop]`) et les boutons de filtre (`[data-stock-filter]`).
- **J05** : Charge — `whatIfSectionHTML()` injecté dans un conteneur DOM réel de 1400px : les 2 `.chg-col` ont le même `top` et sont décalés horizontalement (`left` distincts, écart >50px) — mesure de position réelle, pas seulement la présence de la classe.
- **J06** : Prestations — après navigation directe `state.invoicesTab='invoices'` puis `'services'` (reproduisant Factures → Prestations), `#services-search-input` existe, a une largeur et une hauteur >0, et n'est ni `display:none` ni `visibility:hidden`.

## Tests V3.8.3 réécrits (2, extension stricte du mandat)

- **C02** (bordure gauche des états de commande) : réécrit pour attendre **6px** (au lieu de 5px) — changement de comportement **explicitement demandé par le mandat V3.8.4 Partie E** (couleurs renforcées). L'invariant « jamais un fond blanc uni » reste vérifié à l'identique pour les 7 états.
- Tests de structure de la carte Charge (hérité V3.8.2 « C02 » et V3.8.3 « CH01 ») : réécrits pour vérifier la nouvelle structure `.chg-split`/2×`.chg-col` (« Demandes de congés »/« Simulation ») au lieu de l'ancien tableau fusionné à colonnes unique — changement de comportement **explicitement cité par le mandat V3.8.4 §71**. Les garde-fous moteur sous-jacents (`approveLeave`, `chargeRowImpact`, `whatIfLeaves`) restent testés à l'identique par d'autres tests de la suite (CH04-CH06, non modifiés).

Ces réécritures documentent des changements de comportement **explicitement demandés ou explicitement autorisés par le mandat V3.8.4** — jamais une régression silencieuse ni un affaiblissement des garanties.

## Responsive détaillé

7 viewports (1440/1366/1024/768/430/390/375) × 3 modes (LAB responsive / STAFF mobile-first / DENTIST desktop-first) = 21 combinaisons, chacune vérifiée pour : absence de débordement horizontal (`scrollWidth <= clientWidth`), contenu réellement rendu (`body.innerText.length >= 20`), absence d'erreur JS console/page. **21/21 PASS.**

## Thèmes

3 thèmes (light/dark/system) × 6 vues (Accueil/Commandes/Charge/Stock/Factures/Utilisateurs) = 18 combinaisons, chacune vérifiée pour absence d'erreur console/page lors du changement de vue. **18/18 PASS.**

## `node --check`

Les 5 blocs `<script>` extraits et vérifiés individuellement avec `node --check` : **5/5 OK**, 0 `SyntaxError`.

## Isolation

`window.DentalFlowV34.exportDentalFlowJSON()` (état canonique sérialisable, `serializableState()`) capturé avant et après l'exécution complète des 297 tests : **chaînes strictement identiques** (111 061 caractères). Ce chiffre est identique à celui mesuré en V3.8.3 — cohérent, aucune Partie de V3.8.4 n'ajoute ou ne modifie de champ persisté par défaut sur le seed natif (Cabinets déjà correctement peuplés en seed frais, `repairCabinetsV10()` n'y ajoute donc rien, confirmé par le test CAB11).

## Flakiness connue (non liée à V3.8.4)

Aucune instabilité observée sur les deux exécutions complètes de cette session (297/297 les deux fois). Le test *« Scénario métier complet V1.2.1 »*, déjà documenté comme ponctuellement instable et non reproductible en V3.8.3 (et confirmé indépendant de tout changement de code des deux sessions), n'a montré aucune instabilité durant cette session.

## Méthodologie de vérification de la Partie H (note technique)

`repairCabinetsV10()`, `migrateFixture()`, `ensureV34Model()` et `serializableState()` sont tous définis à l'intérieur de l'IIFE d'implémentation (`<script id="dentalflow-v34-implementation">`), donc inatteignables depuis un script Playwright externe via `page.evaluate()` au niveau racine de la page (frontière déjà documentée en V3.8.2/V3.8.3). Plutôt que d'ajouter des expositions `window.X=X` pour un besoin de vérification ponctuel, les 4 scénarios requis par le mandat (§56-59) et le garde-fou §51 ont été écrits **directement comme tests persistés** (CAB08-CAB12) — exécutés dans le même contexte que le reste de la suite (`runAllTests()`, également interne à l'IIFE), sans limitation d'accès. Cette approche a l'avantage supplémentaire de couvrir ces scénarios de façon durable dans toute exécution future de la suite, plutôt que dans un script de vérification jetable.
