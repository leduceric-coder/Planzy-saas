# DentalFlow V3.10.2 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.10.2.html`
**Base de comparaison :** `dentalflow-next-poc-v3.10.1.html`
**Tous les résultats ci-dessous sont issus d'exécutions réelles**
(Chromium via Playwright, jamais une simulation ou une extrapolation).

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (405 hérités + 20 REL + ROUTE01 adapté + ROUTE_CAM + ROUTE_RUNTIME) | **428 / 428 PASS** |
| P0 — zéro navigation / zéro reload / body non détruit / console | **5 / 5 PASS** |
| MODE01–MODE13 (navigation réelle, clics réels) | **13 / 13 scénarios PASS (58/58 vérifications)** |
| Interaction UI réelle héritée de V3.10.1 (5 scénarios) | **22 / 22 PASS** |
| Playwright NAVDOM hérité (V3.9.5), rejoué contre V3.10.2 | **31 / 31 PASS** |
| Responsive (430/390/375px) — LAB/STAFF/CABINET | **18 / 18 PASS** |
| Responsive/thèmes hérités de V3.10.0 | **18 / 18 PASS** |
| Isolation — 22 tableaux de données métier | **0 différence** |
| Duplication d'ID DOM après cycle complet | **0 nouvelle duplication** (voir §7) |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| CSS vs V3.10.1 | **byte-à-byte identique** |
| Erreurs console (tous scénarios) | **0** |

## 1. Tests persistés — 428/428

```
node run_v3102_baseline.js
TOTAL 428 PASSED 428 FAILED 0
CONSOLE ERRORS: 0
```

Les 405 tests hérités de V3.9.5, les 20 REL01-REL20 de V3.10.0 et
ROUTE_CAM de V3.10.1 sont **strictement inchangés**. ROUTE01 a été
**adapté** (neutralise `runtimeAppMode` autour de ses vérifications,
voir Changelog §11). Un nouveau test :

| Test | Objet | Résultat |
|---|---|---|
| ROUTE_RUNTIME | `switchAppMode()` ne contient aucune API de navigation, appelle `renderCurrentAppMode()`, `getAppMode()` lit `runtimeAppMode` en priorité | PASS |

## 2. P0 — zéro navigation / zéro reload / body non détruit

Script Playwright dédié (`v3102_mode_tests.js`), sur un cycle réel
complet LAB→STAFF→LAB→CABINET→LAB (avec vérifications intermédiaires
MODE01-13, voir §3) :

- **P0-NAV** : compteur `page.on('framenavigated')` sur le frame
  principal, posé à zéro après le chargement initial → **0** navigation
  sur l'ensemble du cycle (vérifié à chaque étape individuellement dans
  MODE01-MODE09, jamais une seule fois > 0).
- **P0-RELOAD** : `window.__dfRuntimeSentinel` et
  `document.body.dataset.dfRuntimeSentinel` (posés après le chargement
  initial) **strictement identiques** avant/après tout le cycle ;
  `performance.timeOrigin` **strictement identique** — preuve directe
  qu'aucun document n'a été recréé.
- **P0-BODY** : un élément sentinelle (`#df-dom-sentinel-test`, hors
  `#mode-host`) **toujours présent** après le cycle complet — aurait
  disparu si `renderStaffMode()`/`renderDentistMode()` avait encore
  utilisé `document.body.innerHTML`.
- **P0-CONSOLE** : **0 erreur console** sur l'intégralité du scénario.

```
MODE TESTS TOTAL 58 PASSED 58 FAILED 0
```

## 3. MODE01–MODE13 — détail par scénario

Tous exécutés via de vrais clics (`page.click`), jamais un appel direct
à une fonction interne pour déclencher la navigation.

- **MODE01 — LAB → STAFF** : `#staff-portal` présent, `#mode-host`
  visible, `.shell` masqué, 0 navigation. **PASS**
- **MODE02 — STAFF → LAB** : `#staff-portal` absent, `#mode-host`
  masqué et vidé, `#view-root` présent, 0 navigation. **PASS**
- **MODE03 — LAB → CABINET** : `#portal` présent, `#mode-host`
  visible, 0 navigation. **PASS**
- **MODE04 — CABINET → LAB** : `#portal` absent, Lab visible, 0
  navigation. **PASS**
- **MODE05 — cycle complet répété** (LAB→STAFF→LAB→STAFF→LAB→CABINET→LAB→CABINET→LAB,
  sans reload) : tous les écrans répondent, 0 navigation, 0 erreur
  console. **PASS**
- **MODE06 — Lab après retour** : routing Commandes et Stock
  fonctionnels (`state.view` changé), Quick View fonctionnelle
  (`openQuickView()` réel), side-window (panneau Messages)
  fonctionnelle. **PASS**
- **MODE07 — Cabinet après Staff** : aucun résidu (`#staff-portal`
  absent, 0 `<video>` dans `#mode-host`, aucun `MediaStream` actif).
  **PASS**
- **MODE08 — Staff après Cabinet** (page fraîche, cycle inverse) :
  Staff fonctionne normalement, aucun résidu Cabinet, 0 navigation, 0
  erreur console. **PASS**
- **MODE09 — URL directe historique** (`?mode=staff`, `?mode=dentist`,
  `#mode=staff`, `#mode=dentist`, 4 pages fraîches) : mode correct au
  premier chargement, retour labo sans reload pour chacun des 4 cas, 0
  navigation, 0 erreur console. **PASS**
- **MODE10 — Caméra et changement de mode** : sortie de STAFF avec un
  flux caméra actif (simulé) → tracks réellement stoppés
  (`track.stop()` appelé, `cameraStream===null`,
  `state.staffScanCameraActive===false`) ; retour en STAFF → nouvelle
  ouverture caméra possible, aucune référence orpheline. **PASS**
- **MODE11 — Fallback Staff** (aucun collaborateur éligible) : écran
  "Erreur de configuration" rendu dans `#mode-host`, bouton
  `#staff-back` est un vrai `<button>` (jamais `<a href>`), 0
  navigation à l'entrée ni au retour labo. **PASS**
- **MODE12 — État métier** : 22 tableaux métier capturés avant/après 5
  cycles LAB↔STAFF↔CABINET (20 changements de mode au total) → **0
  différence**, 0 erreur console. **PASS**
- **MODE13 — Handlers dupliqués** : après 5 allers-retours
  LAB↔STAFF, un scan manuel contrôlé produit **exactement un**
  événement de localisation (jamais 2, jamais plus) ; après 3
  allers-retours LAB↔CABINET, un seul onglet "Nouvelle commande" existe
  dans le DOM (aucun markup dupliqué par ré-attachement de handlers).
  **PASS**

```
MODE01–MODE13 : 13 / 13 scénarios PASS (58 vérifications unitaires, 58/58 PASS)
```

## 4. Interaction UI réelle héritée de V3.10.1 — 22/22

Les 5 scénarios du Test Report V3.10.0/V3.10.1 (confirmation
d'annulation, ajustement de stock, bouton caméra Collaborateur, modèle
d'import téléchargeable, CTA de blocage d'achat) rejoués intégralement
contre V3.10.2, sans modification.

```
node v3102_ui_interact.js
UI INTERACT TOTAL 22 PASSED 22 FAILED 0
```

## 5. Navigation — 31/31 (script hérité V3.9.5, rejoué contre V3.10.2)

```
node navdom_v3102.js
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

Confirme que la nouvelle architecture `#mode-host`/`runtimeAppMode` n'a
introduit aucune régression sur la navigation labo (sidebar/drawer
mobile, badges, routing, sidebar réduite, dark/light/system) — le DOM
Labo n'étant jamais recréé, ce résultat était attendu mais a été
vérifié explicitement.

## 6. Responsive — 18/18 (LAB/STAFF/CABINET × 430/390/375px) + 18/18 hérité

```
node v3102_responsive.js
RESPONSIVE TOTAL 18 PASSED 18 FAILED 0

node v3102_responsive_theme_full.js
RESPONSIVE/THEME TOTAL 18 PASSED 18 FAILED 0
```

Aucun débordement horizontal, 0 erreur console, pour les trois modes
aux trois largeurs mobiles mandatées. Aucune modification visuelle
demandée ni apportée (CSS byte-identique, voir §9).

## 7. Duplication d'ID — audit avant/après

Vérification que la nouvelle architecture (DOM Labo jamais détruit,
donc potentiellement coexistant avec le contenu de `#mode-host`) n'a
introduit **aucune** duplication d'ID nouvelle :

```
node v3102_dup_ids.js
```

Résultat identique en LAB initial / STAFF / LAB après staff / CABINET /
LAB après cabinet : **seule** la duplication `open-dentist`/`open-staff`/
`open-data`/`reset-demo` du menu utilisateur, **déjà présente à
l'identique dans V3.10.1** (vérifié par comparaison directe,
`v3101_dup_ids.js` → même résultat), non liée à ce hotfix, hors
périmètre.

**Deux vraies duplications ont en revanche été détectées et corrigées
pendant le développement** (voir Changelog §6-8) :
- `#toast` dupliqué entre le `<body>` statique et les templates
  Cabinet/Collaborateur — retiré des deux templates, résultat vérifié :
  `document.querySelectorAll('[id="toast"]').length === 1` en toutes
  circonstances.
- `#tooth-picker-layer`/`#tooth-picker-card` dupliqué entre le `<body>`
  statique et le template Cabinet — retiré du template, résultat
  vérifié (`v3102_toothpicker.js`) :

  ```
  totalToothPickerLayers: 1
  globalLayerOpen: true   (après appel réel de openToothPicker() en contexte Cabinet)
  ```

  Le sélecteur de dents du formulaire "Nouvelle commande" du portail
  Cabinet fonctionne donc réellement (bug qui aurait été invisible sous
  l'architecture V3.10.1, où chaque mode disposait toujours d'une copie
  unique du calque).

## 8. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check`
sans erreur de syntaxe.

## 9. CSS

```
CSS identical v3.10.1 vs v3.10.2: True
```

Comparaison intégrale du contenu du bloc `<style>` — byte-à-byte
identique. `#mode-host` réutilise la classe `.hidden` déjà existante,
aucune ligne CSS ajoutée ou modifiée.

## 10. Console

**0 erreur console** relevée sur l'ensemble des scénarios réellement
exécutés : suite persistée (428 tests), scénario P0+MODE01-13 complet
(58 vérifications), script NAVDOM hérité (31 vérifications), 22
vérifications d'interaction UI héritées, 18+18 vérifications
responsive/thèmes, vérification duplication d'ID, vérification
sélecteur de dents.

Une erreur console (`PAGEERROR: stopCameraScan is not defined`) a été
détectée puis corrigée **pendant le développement** — voir Changelog
§6 pour le détail (bug de portée de script au boot prématuré, même
classe que les deux bugs déjà documentés dans le Changelog V3.10.0).
Après correction : 0 erreur sur l'ensemble de la suite.

## 11. Audit statique — API de navigation restantes

```
grep -n "location\.reload|location\.href *=|location\.assign\(|location\.replace\(|location\.pathname *=|window\.location *=|history\.go\(|history\.back\(|history\.forward\(" dentalflow-next-poc-v3.10.2.html
```

Après correction, **aucune occurrence exécutable** liée à un
changement de mode utilisateur. Détail des occurrences restantes,
toutes hors périmètre :
- `location.href=`/`document.location.href=` (×4) : bibliothèque jsPDF
  vendorée, logique interne de téléchargement de blob.
- `location.replace(...)` (×1) : `runV341MigrationSeedReload()`,
  fonction de test de migration, hors périmètre du mandat (§22).
- `location.reload` : uniquement dans un commentaire (texte
  documentant la cause du bug), aucun code exécutable.

`document.body.innerHTML` : ne subsiste que dans `renderScanMode()`
(exception documentée, Changelog §5) et dans deux fonctions de test
(`REL05`/`REL07`, héritées, sauvegarde/restauration par précaution,
n'appellent jamais les fonctions de rendu de mode).

## 12. Diff V3.10.1 → V3.10.2

80 lignes ajoutées (16 858 → 16 938 lignes). Chaque zone de changement
est documentée dans le Changelog ; aucune ligne ne touche le CSS,
`NAV_GROUPS`, une route de navigation labo, une permission, le moteur
caméra, l'import CSV, ou `schemaVersion`.

## 13. Contrat de test — ROUTE02-ROUTE07 (V3.10.1) remplacés

Les tests ROUTE02-ROUTE07 de V3.10.1 vérifiaient qu'un
`location.reload()` réel se produisait (comportement alors attendu).
Ce contrat n'est plus celui de V3.10.2 : aucun test de cette livraison
n'affirme qu'un reload ou qu'une navigation est souhaitable. Ils sont
remplacés par les vérifications P0 (§2) et MODE01-MODE13 (§3), qui
couvrent les mêmes scénarios de navigation utilisateur mais vérifient
désormais l'**absence totale** de navigation/reload plutôt que sa
présence contrôlée. Voir Changelog §11 pour la justification complète.

## 14. Points explicitement non vérifiables dans cet environnement

- **`content://` Android réel / Storage Access Framework :**
  l'environnement Playwright de cette session ne fournit pas de
  périphérique Android ni de gestionnaire de fichiers Android — il est
  donc impossible de confirmer directement, dans cet environnement, la
  disparition du message "Impossible d'accéder à votre fichier" sur un
  Huawei P30 Pro physique. Ce qui a été vérifié à la place (§2-3
  ci-dessus) : que le document ne subit **strictement aucune**
  navigation ni recharge lors d'un changement de mode, quel que soit le
  scénario exercé — l'invariant de code qui, structurellement, élimine
  la classe de problème observée sur le terrain (plus aucune seconde
  tentative d'accès à la ressource locale après le chargement initial)
  — plus un audit statique exhaustif confirmant qu'aucun changement de
  mode ne dépend plus d'une API de navigation.

### Checklist de validation manuelle — Huawei P30 Pro (7 étapes max)

1. Ouvrir le fichier `dentalflow-next-poc-v3.10.2.html` depuis le
   gestionnaire de fichiers du téléphone.
2. Toucher "Voir comme collaborateur" (menu utilisateur, en bas de la
   barre latérale) — l'écran Collaborateur doit s'afficher directement,
   sans message d'erreur.
3. Toucher "Retour laboratoire" — l'écran Laboratoire doit réapparaître
   immédiatement.
4. Toucher "Voir comme cabinet" — l'écran Cabinet doit s'afficher
   directement, sans message d'erreur.
5. Toucher "Retour laboratoire" — l'écran Laboratoire doit réapparaître
   immédiatement.
6. Toucher à nouveau "Voir comme collaborateur" — doit fonctionner une
   seconde fois, sans message d'erreur.
7. Sur l'écran Collaborateur, toucher "Scanner avec la caméra" — la
   caméra doit s'ouvrir normalement.

Aucun outil développeur Android n'est nécessaire pour cette
vérification.
