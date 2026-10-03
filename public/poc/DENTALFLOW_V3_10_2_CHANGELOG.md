# DentalFlow V3.10.2 — Changelog — IN-DOCUMENT MODE SWITCHING (hotfix)

**Base :** `dentalflow-next-poc-v3.10.1.html` (conservée intacte, jamais
modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.2.html`
**Mandat :** hotfix technique, un seul sujet — éliminer tout rechargement
et toute navigation du document lors d'un changement de mode
(Laboratoire/Cabinet/Collaborateur). **Aucun redesign, aucune
transformation en SPA, aucun routeur complexe.** `schemaVersion` :
**10, inchangé**.

## 1. Pourquoi V3.10.1 n'a pas suffi

V3.10.1 avait supprimé la reconstruction d'adresse
(`location.pathname+'?mode=...'`), remplacée par :

```js
location.hash = 'mode=' + mode;
location.reload();
```

Ceci fonctionne parfaitement dans Chromium/`file://` (425/425 puis
427/427 tests, 0 erreur console) — mais **le bug terrain persistait sur
Huawei P30 Pro** : cliquer "Voir comme cabinet"/"Voir comme
collaborateur" affichait toujours "Impossible d'accéder à votre
fichier".

**Cause réelle** : même sans changer d'adresse, `location.reload()`
force le navigateur à retenter l'accès à la ressource. Sur Android, un
fichier HTML ouvert depuis un gestionnaire de fichiers est souvent
exposé via une `content://` URI (Storage Access Framework) plutôt qu'un
chemin de fichier stable — cette **seconde tentative d'ouverture**, pas
seulement une adresse mal formée, peut échouer selon la façon dont le
navigateur reçoit l'accès à cette URI (permission ponctuelle, URI à
usage unique, etc.). Tant qu'un `reload` — même « sur place » —
subsiste, la classe de bug n'est pas éliminée.

**Conclusion de ce lot : le document ne doit plus jamais être rechargé
ni renavigué pour changer de mode. Un seul chargement du fichier,
plus jamais aucune seconde ouverture.**

## 2. Nouvelle architecture — `#mode-host` + `runtimeAppMode`

### Avant (V3.10.0/V3.10.1)

`renderDentistMode()` / `renderStaffMode()` / `renderScanMode()`
remplaçaient **tout `document.body.innerHTML`**. Le DOM Laboratoire
était détruit à chaque changement de mode, et un `location.reload()`
était nécessaire pour revenir à un Laboratoire propre.

### Après (V3.10.2)

- Un unique conteneur statique, ajouté dans le `<body>` juste avant les
  scripts (jamais recréé) :
  ```html
  <div id="mode-host" class="hidden" aria-hidden="true"></div>
  ```
- Le DOM Laboratoire (`.shell`, contenant sidebar/topbar/`#view-root`)
  **n'est plus jamais détruit** : il est masqué via la classe `.hidden`
  déjà utilisée partout ailleurs dans ce fichier (`display:none!important`),
  jamais recréé, jamais réinitialisé.
- `renderDentistMode()` et `renderStaffMode()` (y compris son écran de
  fallback "aucun collaborateur éligible") écrivent désormais dans
  `document.getElementById('mode-host').innerHTML` — **jamais**
  `document.body.innerHTML`.
- Deux fonctions d'orchestration unique (V3.10.2) :

  ```js
  function enterPortalMode(){
    // ferme les overlays Lab ouverts (panneau, Quick View, drawer mobile,
    // recherche, menu utilisateur), retire le focus, masque .shell,
    // affiche #mode-host (aria-hidden/inert gérés proprement)
  }
  function leavePortalMode(){
    // arrête la caméra Staff si active, vide et masque #mode-host,
    // réaffiche .shell (jamais reconstruit — les handlers Lab
    // n'ont jamais disparu)
  }
  function showLabMode(){ renderNav(); render() }
  function renderCurrentAppMode(){
    const mode = getAppMode();
    if(mode==='scan'){ renderScanMode(); return }      // inchangé, voir §5
    if(mode==='lab'){ leavePortalMode(); showLabMode(); return }
    enterPortalMode();
    if(mode==='staff'){ renderStaffMode(); return }
    if(mode==='dentist'){ renderDentistMode(); return }
  }
  ```

### `runtimeAppMode` — le mode devient un état mémoire, plus une URL

```js
let runtimeAppMode = null;
function getAppMode(){
  if (VALID_APP_MODES.has(runtimeAppMode)) return runtimeAppMode;
  // sinon : résolution historique depuis #mode=…/?mode=… (voir §4)
  return 'lab';
}
function switchAppMode(mode){
  if (!VALID_APP_MODES.has(mode)) return false;
  if (typeof stopStaffCameraScan === 'function') stopStaffCameraScan();
  runtimeAppMode = mode;
  renderCurrentAppMode();
  return true;
}
```

`switchAppMode()` **ne touche plus jamais** `location.*` ni
`history.*` — ni `location.hash`, ni `location.reload()`. Le mode
change **uniquement** en mémoire (`runtimeAppMode`), et
`renderCurrentAppMode()` réoriente l'affichage dans le document déjà
ouvert.

## 3. Fonctions migrées vers le router in-document

- `#open-dentist` → `switchAppMode('dentist')` (inchangé dans son
  appel, mais l'effet ne recharge plus rien).
- `#open-staff` → `switchAppMode('staff')`.
- `#portal-back` (Cabinet, `attachDentistHandlers`) →
  `switchAppMode('lab')`.
- `#staff-back` (Collaborateur, `attachStaffHandlers`) →
  `switchAppMode('lab')`.
- Écran fallback "aucun collaborateur n'a de poste actif" — rendu
  désormais dans `#mode-host` (au lieu de `document.body.innerHTML`),
  bouton `#staff-back` inchangé (déjà un `<button>` depuis V3.10.1,
  jamais un `<a href>`).

## 4. Compatibilité des URLs historiques — inchangée au premier chargement

`getAppMode()` continue de résoudre `#mode=…` puis `?mode=…` **au tout
premier chargement** (`runtimeAppMode` vaut alors `null`) — aucun test
existant, aucun raccourci d'ouverture directe n'est cassé. La
différence avec V3.10.1 : une fois `switchAppMode()` appelé une seule
fois, `runtimeAppMode` devient définitivement prioritaire — l'URL n'est
plus jamais relue pour un changement de mode. C'est volontaire (mandat
§11) : ouvrir `fichier.html?mode=staff` affiche STAFF au chargement ;
cliquer "Retour laboratoire" affiche LAB **sans jamais retirer
`?mode=staff` de l'URL**, sans reload, sans nouvelle adresse.

## 5. Mode Scan — non touché, exception documentée

`renderScanMode()` continue de remplacer `document.body.innerHTML` en
entier. Décision assumée (mandat §45, option B) : le mode Scan n'a
**aucun** bouton "Retour laboratoire" ni aucun chemin vers
`switchAppMode()` — c'est un mode kiosque à usage unique, atteint
uniquement via `?mode=scan`/`#mode=scan` au premier chargement, jamais
via un changement de mode en cours de session. Il n'est donc **pas**
concerné par le bug Android (qui ne se produit qu'au moment d'un
second accès à la ressource, via `location.reload()`) et n'a pas été
migré vers `#mode-host`, pour respecter la consigne « ne pas élargir le
périmètre ». `isScanMode()` délègue néanmoins à `getAppMode()` pour
rester cohérent avec les deux autres modes.

## 6. Bug réel trouvé et corrigé pendant le développement — scope global du boot prématuré

**Découverte** : `stopStaffCameraScan(){stopCameraScan();...}` appelle
la fonction caméra Stock partagée (`stopCameraScan`, privée à l'IIFE du
bloc `<script>` "implementation", exposée sur `window` seulement une
fois `installOverrides()` exécuté). `leavePortalMode()` (nouveau en
V3.10.2) appelle `stopStaffCameraScan()` **au tout premier rendu**, via
le boot prématuré du bloc de script de base (qui s'exécute *avant* le
bloc "implementation" et son `installOverrides()`). Résultat observé
lors des tests : `PAGEERROR: stopCameraScan is not defined` sur
**toute** ouverture du fichier en mode labo (le cas le plus courant).

**Fix** (même pattern que les deux bugs de portée déjà documentés dans
le Changelog V3.10.0) :

```js
function stopStaffCameraScan(){
  if (typeof stopCameraScan === 'function') stopCameraScan();
  state.staffScanCameraActive = false;
}
```

Vérifié : 0 erreur console sur l'ensemble de la suite après correction
(auparavant : 1 `PAGEERROR` systématique).

## 7. Bug réel trouvé et corrigé pendant le développement — doublon `#tooth-picker-layer`

**Découverte** : `renderDentistMode()` réinjectait sa propre copie de
`<div id="tooth-picker-layer">…<div id="tooth-picker-card">` dans son
template, **en plus** de la copie statique déjà présente dans le
`<body>` (utilisée par tous les autres écrans, y compris pour le
sélecteur de dents du formulaire "Nouvelle commande" du portail
Cabinet). Sous l'architecture V3.10.1 (destruction complète du body à
chaque mode), il n'y avait jamais qu'une seule copie en mémoire à la
fois — aucun conflit. Sous l'architecture V3.10.2 (DOM Labo préservé,
seulement masqué), **les deux copies coexistaient** : `openToothPicker()`
utilise `document.getElementById('tooth-picker-layer')`, qui résout
toujours le **premier** élément du DOM — celui du Laboratoire, caché
dans `.shell.hidden` — jamais la copie visible du portail Cabinet. Le
sélecteur de dents aurait donc semblé ne rien faire pour un dentiste en
train de créer une commande.

**Fix** : suppression de la copie dupliquée dans le template de
`renderDentistMode()` (même traitement que la duplication `#toast`
détectée pendant la conception, voir §8) — le calque
`#tooth-picker-layer` est `position:fixed`, un unique exemplaire
partagé (déjà présent dans le `<body>` statique) suffit et reste
correctement au-dessus de tout contenu, Labo ou portail. Vérifié :
`document.querySelectorAll('[id="tooth-picker-layer"]').length === 1`
en permanence, et un appel réel à `openToothPicker()` depuis le
contexte Cabinet ouvre bien l'unique calque partagé
(`globalLayerOpen: true`).

## 8. Doublon `#toast` — anticipé et corrigé dès la conception

Même raisonnement que §7 : `renderDentistMode()` et `renderStaffMode()`
réinjectaient chacun leur propre `<div id="toast">`, en plus de la
copie statique du `<body>` (elle aussi `position:fixed`, ciblée par
`showToast()` via `$('#toast')` — premier match du DOM). Les deux
copies dupliquées, désormais inutiles et invalides (ID dupliqué), ont
été retirées des deux templates avant même l'exécution des premiers
tests — `showToast()` continue de fonctionner à l'identique, aucune
modification de son code.

## 9. Audit statique complet — aucune API de navigation restante

Recherche exhaustive de `location.reload`, `location.href=`,
`location.assign(`, `location.replace(`, `location.pathname=`,
`window.location=`, `history.go(`, `history.back(`, `history.forward(`
dans l'intégralité du fichier. Résultat après correction : **aucune
occurrence exécutable liée à un changement de mode utilisateur**. Les
seules occurrences restantes :
- `location.href=`/`document.location.href=` : bibliothèque jsPDF
  vendorée (logique interne de téléchargement de blob), jamais liée au
  routing applicatif — hors périmètre, non touchée.
- `location.replace(...)` : `runV341MigrationSeedReload()`, fonction de
  **test** de migration (`location.replace(location.href.split('?')[0]+'?migrationTest=verify')`)
  — usage explicitement réservé aux tests, hors périmètre du mandat
  (§22), non modifiée.
- `location.reload` : n'apparaît plus que dans un commentaire
  documentant la cause du bug (texte, pas du code exécutable).

`document.body.innerHTML` ne subsiste que dans `renderScanMode()` (§5,
exception documentée) et dans deux fonctions de test qui
sauvegardent/restaurent `document.body.innerHTML` par précaution
(`REL05`/`REL07`, héritées inchangées de V3.10.0, qui n'appellent
jamais `renderDentistMode`/`renderStaffMode`).

## 10. Non modifié (vérifié explicitement)

- **CSS byte-à-byte identique** à V3.10.1 (comparaison intégrale du
  bloc `<style>`). `#mode-host` réutilise la classe `.hidden` déjà
  existante — aucune règle CSS ajoutée.
- Navigation labo (`NAV_GROUPS`, sidebar, drawer mobile, badges) — non
  touchée.
- Moteur caméra Stock/Collaborateur (V3.10.0 R02) — non modifié ;
  `switchAppMode()`/`leavePortalMode()` réutilisent
  `stopStaffCameraScan()`/`stopCameraScan()` tels quels.
- Import CSV, permissions, stockage, Design System, impression
  (`#print-area`, `@media print`) — non touchés. Le Labo n'étant plus
  jamais recréé, l'impression depuis le Labo après un aller-retour
  portail se comporte au moins aussi bien qu'avant (DOM Labo jamais
  réinitialisé).
- `schemaVersion` : **10**, aucune migration.
- Les 405 tests hérités de V3.9.5, les 20 REL01-REL20 de V3.10.0 et le
  test ROUTE_CAM de V3.10.1 restent **strictement inchangés**.

## 11. Tests

### Persistés (dans le fichier)

- **ROUTE01** (V3.10.1, **adapté** en V3.10.2) : `getAppMode()` lit
  désormais `runtimeAppMode` en priorité — le test neutralise
  explicitement cette variable autour de ses 11 vérifications de
  résolution URL (hash/query/repli/invalide), pour rester déterministe
  quel que soit l'ordre d'exécution des tests.
- **ROUTE_CAM** (V3.10.1) : inchangé, toujours valide (`switchAppMode()`
  appelle toujours `stopStaffCameraScan()` en premier).
- **ROUTE_RUNTIME** (nouveau, V3.10.2) : vérifie statiquement que le
  code source de `switchAppMode()` ne contient **aucune** API de
  navigation (`location.*`/`history.*`), qu'il appelle bien
  `renderCurrentAppMode()`, et fonctionnellement que `getAppMode()` lit
  `runtimeAppMode` en priorité sur l'URL.

### Externes (Playwright, navigation réelle — voir Test Report)

- **P0** : zéro navigation du frame principal, zéro reload (sentinelles
  `window.__dfRuntimeSentinel`/`performance.timeOrigin` inchangées),
  body jamais détruit (élément sentinelle toujours présent), zéro
  erreur console — sur un cycle complet réel LAB→STAFF→LAB→CABINET→LAB.
- **MODE01–MODE13** : chaque scénario du mandat (§26-38), avec de vrais
  clics et de vraies vérifications DOM — voir Test Report pour le
  détail par scénario.

### Contrat de test qui change (mandat §40)

Les tests **ROUTE02-ROUTE07** de V3.10.1 (script Playwright dédié)
vérifiaient explicitement qu'un `location.reload()` réel se produisait
et que l'adresse avant le `#` restait identique. Ce contrat n'est
**plus** celui attendu en V3.10.2 : un `reload`, même sans changer
d'adresse, n'est plus acceptable. Ces tests sont **remplacés** par les
vérifications P0 (zéro navigation, zéro reload) et MODE01-MODE13
(mêmes scénarios de navigation, mais qui vérifient désormais
l'ABSENCE de toute navigation/reload plutôt que sa présence contrôlée).
Aucun test n'affirme plus qu'un reload est souhaité.

## 12. Limitation explicitement documentée

Comme en V3.10.1, cet environnement ne fournit pas de véritable
`content://` Android ni de Storage Access Framework — la disparition
complète du message "Impossible d'accéder à votre fichier" sur un
Huawei P30 Pro physique **n'a pas pu être observée directement** dans
cette session. Ce qui EST vérifié, en conditions réelles
(Chromium/`file://`, clics réels, jamais une simulation) : le document
n'effectue **strictement aucune** navigation ni recharge lors d'un
changement de mode, quel que soit le scénario exercé (voir Test
Report) — l'invariant de code qui élimine structurellement la classe de
problème observée sur le terrain (une ressource locale n'est plus
jamais réouverte après le chargement initial). **Validation finale à
effectuer sur Huawei P30 Pro** (voir checklist utilisateur, Test
Report §14).
