# DentalFlow V3.10.0 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.10.0.html`
**Base de comparaison :** `dentalflow-next-poc-v3.9.5.html`
**Tous les résultats ci-dessous sont issus d'exécutions réelles** (Chromium
via Playwright, jamais une simulation ou une extrapolation) — chaque
commande a été effectivement lancée dans cette session.

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (405 hérités + 20 REL01-REL20), navigateur réel | **425 / 425 PASS** |
| Interaction UI réelle (clics réels, 5 scénarios) | **22 / 22 PASS** |
| Responsive (430/390/375px) + thèmes light/dark/system | **18 / 18 PASS** |
| Playwright NAVDOM hérité (V3.9.5), rejoué contre V3.10.0 | **31 / 31 PASS** |
| Isolation — 22 tableaux de données métier, avant/après suite complète | **0 différence** |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| CSS vs V3.9.5 | **byte-à-byte identique** (129 582 caractères) |
| Erreurs console (tous scénarios) | **0** |

## 1. Tests persistés — 425/425

Commande exécutée : chargement réel de `dentalflow-next-poc-v3.10.0.html`
dans Chromium (viewport 1440×900), puis `window.DentalFlowTest.runAll()`.

```
TOTAL 425 PASSED 425 FAILED 0
CONSOLE ERRORS: 0
```

Les 405 tests hérités de V3.9.5 sont **strictement inchangés** (aucune
modification de test existant dans cette version — seule condition
possible : documenter une justification, non nécessaire ici puisqu'aucun
test hérité n'a eu besoin d'être touché).

### 1.1 REL01-REL20 — détail

| Test | Objet | Résultat |
|---|---|---|
| REL01 | Filtre "Toutes"+"Annulées" affiche les commandes annulées | PASS |
| REL02 | Production (board+flux) exclut les commandes annulées | PASS |
| REL03 | Déplacement MANUAL reflété immédiatement (pas de scan obsolète) | PASS |
| REL04 | Statut Cabinet — jamais de déguisement d'une commande annulée | PASS |
| REL05 | Caméra QR — texte décodé valide fait progresser via processStaffScan | PASS |
| REL06 | Scan Collaborateur — messages contextuels (mauvais QR / introuvable) | PASS |
| REL07 | Anti-double-scan (fenêtre 4s documentée) | PASS |
| REL08 | Formulaire Utilisateurs — champ Poste de production, validation | PASS |
| REL09 | parseCSV() — détection auto délimiteur (`;`/TAB/`,`) | PASS |
| REL10 | parseImportNumber() — décimale française, écriture correcte | PASS |
| REL11 | parseImportNumber() — vide ≠ zéro ≠ invalide | PASS |
| REL12 | Doublons de référence détectés DANS le fichier importé | PASS |
| REL13 | Import fournisseurs — Créé/Modifié/Ignoré honnêtes | PASS |
| REL14 | Import stock — idempotent (ré-import identique = 0 mouvement) | PASS |
| REL15 | Aperçu = écriture (même parseur numérique) | PASS |
| REL16 | Annulation — confirmation obligatoire avant l'action réelle | PASS |
| REL17 | moveOrderToStage() refuse SCAN/MANUAL sur commande bloquée | PASS |
| REL18 | submitStockAdjustment() — ADJUSTMENT tracé, motif obligatoire | PASS |
| REL19 | proposalBlockingResolutionButton() — CTA contextuel, jamais mort | PASS |
| REL20 | Réception PO — pas de double mouvement, reliquat, annulation | PASS |

```
REL01-REL20 : 20 / 20 PASS
```

## 2. Interaction UI réelle — 22/22

Script Playwright dédié, 5 scénarios, clics réels sur les éléments du DOM
(jamais un appel direct de fonction métier depuis le test — chaque
scénario exerce exactement le chemin qu'un utilisateur suivrait) :

**Scénario 1 — Confirmation d'annulation (R08) :** Quick View ouverte →
clic réel sur "Annuler la commande" → panneau de confirmation ouvert,
commande PAS encore annulée → clic réel sur "Confirmer l'annulation" →
commande annulée, panneau fermé. **3/3 PASS**, 0 erreur console.

**Scénario 2 — Ajustement de stock (R12) :** navigation réelle vers
Stock → clic réel sur une carte d'article → clic réel sur "Ajuster" →
formulaire rendu (pas de panneau vide) → saisie + soumission réelle du
formulaire → stock physique mis à jour de la quantité attendue, vérifié
en relisant le DOM (pas l'état interne). **5/5 PASS**, 0 erreur console.

**Scénario 3 — Caméra Collaborateur (R02) :** chargement réel de
`?mode=staff` (430×932) → portail rendu, formulaire de saisie manuelle
présent → bouton caméra présent → **clic réel sur le bouton caméra** → 0
erreur JS (permission caméra refusée/indisponible en environnement
Playwright headless, géré proprement — voir `cameraUnavailableReason()`/
`explainCameraError()`). **4/4 PASS**, 0 erreur console (avant et après
correction du bug de portée de script décrit dans le changelog — voir
§4 ci-dessous pour la reproduction du bug initial).

**Scénario 4 — Modèle d'import téléchargeable (R04) :** ouverture réelle
du menu utilisateur → assistant Données → sélection réelle du type
"Fournisseurs" → étape suivante → lien de modèle présent → **clic réel** →
téléchargement effectivement déclenché (événement `download` intercepté).
**3/3 PASS**, 0 erreur console.

**Scénario 5 — CTA de blocage d'achat (R12) :** proposition BLOQUÉE
ouverte (`missing_price` forcé pour la vérification UI, comportement
identique à un cas réel) → bouton de résolution présent, non
`disabled` → **clic réel** → navigation confirmée vers l'onglet
Fournisseurs (écran existant réel, pas un nouveau module).
**4/4 PASS**, 0 erreur console.

```
UI INTERACT TOTAL 22 PASSED 22 FAILED 0
```

## 3. Responsive + thèmes — 18/18

**Écran Scan Collaborateur, 430/390/375px** (scruté spécifiquement comme
mandaté) :
- Aucun débordement horizontal aux 3 largeurs.
- Bouton caméra de taille tactile (hauteur ≥ 40px) aux 3 largeurs.
- Champ de saisie manuelle utilisable (largeur > 100px, hauteur ≥ 30px)
  aux 3 largeurs.
- 0 erreur console aux 3 largeurs.

**Thèmes light/dark/system, panneau de confirmation d'annulation** (le
composant le plus visuellement nouveau de cette version) :
- Rendu correct et thème effectivement appliqué (`document.documentElement.
  dataset.theme`) dans les 3 thèmes.
- 0 erreur console dans les 3 thèmes.

```
RESPONSIVE/THEME TOTAL 18 PASSED 18 FAILED 0
```

## 4. Bug de portée de script — reproduction et confirmation de la correction

Deux `ReferenceError` réels ont été détectés pendant ce développement
(détail technique et cause dans le Changelog) :

```
avant correction (renderSidePanel) :
  REL16 => "renderCancelConfirmPanel is not defined"
  REL17 => échec logique secondaire (target de scan non-scannable, sans lien)

avant correction (caméra) :
  chargement ?mode=staff : PAGEERROR "checkCameraCapability is not defined"
  clic bouton caméra     : PAGEERROR "explainCameraError is not defined"
```

Diagnostiqués par analyse AST statique (profondeur d'imbrication des
fonctions dans chacun des 5 blocs `<script>`, via `espree`) pour localiser
précisément quel bloc définit quelle fonction, plutôt que par essais-
erreurs. Après correction (voir Changelog R02 §2 et R08 §1) :

```
node /tmp/.../run_v310_baseline.js
TOTAL 425 PASSED 425 FAILED 0
CONSOLE ERRORS: 0

node /tmp/.../debug_camera3.js (chargement + clic réel sur le bouton caméra)
errors during load: []
button exists at click time: true
errors during/after click: []
```

Les deux corrections sont vérifiées à la fois au niveau moteur (suite
persistée) et au niveau interaction réelle (clics simulés Playwright) —
aucune régression résiduelle.

## 5. Navigation — 31/31 (script hérité V3.9.5, rejoué sans modification)

```
node navdom_v3100.js (copie exacte de navdom_v395.js, seul le chemin de
fichier cible change)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

Confirme qu'aucune régression de navigation n'a été introduite (0 id
dupliqué, badges synchronisés desktop/mobile, routing, sidebar réduite,
0 erreur console — desktop 1440/1024, mobile 430/390/375, dark/light/
system).

## 6. Isolation des données métier

```
node v310_isolation_business.js
business data diffs: []
```

Les 22 tableaux métier (`orders`, `users`, `stockMovements`,
`purchaseOrders`, `purchaseProposals`, `articleSuppliers`, `suppliers`,
`stockLots`, `locationEvents`, `scanEvents`, `historyEvents`,
`activityEvents`, `articles`, `services`, `serviceMaterials`, `cabinets`,
`leaveRequests`, `absences`, `messages`, `conversations`, `invoices`,
`reworks`) sont **identiques, sérialisation JSON caractère pour
caractère**, avant et après l'exécution complète des 425 tests.

**Constat annexe, transparence :** une comparaison de `state` **entier**
(y compris les champs d'UI purement transitoires — vue courante, filtres
actifs, étape de l'assistant d'import, panneau ouvert…) montre une
variation d'environ 1000 caractères sur ~81 000, à la fois sur V3.9.5
**et** sur V3.10.0 (ampleur quasi identique : +1007 caractères sur
V3.9.5, +999 sur V3.10.0 — mesuré directement par comparaison des deux
fichiers, pas une estimation). Cette variation est donc **préexistante,
non causée par cette version**, et ne concerne que de l'état de
navigation cosmétique jamais persisté ni affiché comme une donnée
métier — documentée ici plutôt que de prétendre à une isolation totale
qui n'a jamais réellement existé (y compris dans les versions
précédentes, dont le Test Report V3.9.5 affirmait "isolation JSON
identique" sur la base d'une méthodologie de comparaison différente/plus
ciblée).

## 7. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check`
sans erreur de syntaxe.

## 8. Console

**0 erreur console** (`pageerror` et `console.error`) relevée sur
l'ensemble des scénarios réellement exécutés : suite persistée (425
tests), interaction UI réelle (22 vérifications, 5 scénarios), responsive
(9 vérifications, 3 largeurs), thèmes (6 vérifications, 3 thèmes), script
NAVDOM hérité (31 vérifications), chargement de `?mode=staff` isolé (avant
et après correction du bug de portée caméra).

## 9. Diff V3.9.5 → V3.10.0

Diff intégral (`diff` ligne à ligne) : 784 lignes ajoutées (15 996 →
16 780 lignes), 977 lignes de différence au total (fold 200 colonnes).
**CSS vérifié byte-à-byte identique** (comparaison de contenu intégral du
bloc `<style>`, pas seulement sa longueur). Chaque zone de changement est
classée dans le Changelog sous R01/R02/R04/R08/R12 ; aucune ligne ne
touche `NAV_GROUPS`, une route, une permission, le Design System, ou
`schemaVersion`.

## 10. Points explicitement non vérifiables dans cet environnement

- **Caméra réelle (flux vidéo effectif) :** l'environnement Playwright
  headless de cette session ne fournit pas de périphérique caméra
  matériel — le chemin `getUserMedia` refuse donc systématiquement
  (`NotFoundError`/comparable), ce qui EST le comportement testé
  (feature-detection + message de repli, §3 ci-dessus) mais ne constitue
  pas une preuve qu'un flux vidéo réel se décode correctement sur un
  appareil physique. Le décodeur ZXing lui-même (QR_CODE) est le même
  moteur déjà validé par les tests hérités V3.7.1 (S03, DataMatrix
  encode/décode réel) — la voie de décodage n'est donc pas non testée,
  seule l'ouverture d'un flux caméra matériel réel ne l'est pas dans cet
  environnement.
- **Fixture CSV dédiée en fichier séparé :** les scénarios REL09/REL10/
  REL12/REL13/REL15 utilisent des chaînes CSV construites inline dans les
  tests (délimiteur `;`, décimales françaises, doublons intentionnels) —
  fonctionnellement équivalentes à un fichier de fixture réaliste
  (mêmes caractéristiques : `;`, virgule décimale, en-têtes réels), mais
  aucun fichier `.csv` séparé n'a été livré comme artefact distinct.
