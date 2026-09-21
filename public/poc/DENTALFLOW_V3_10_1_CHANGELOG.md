# DentalFlow V3.10.1 — Changelog — LOCAL MOBILE MODE ROUTING (hotfix)

**Base :** `dentalflow-next-poc-v3.10.0.html` (conservée intacte, jamais
modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.1.html`
**Mandat :** hotfix minimal, un seul sujet — la navigation entre modes
(Laboratoire/Cabinet/Collaborateur) dans un fichier HTML local ouvert
depuis Android. **Aucun redesign, aucun feature creep, aucune
transformation en SPA.** `schemaVersion` : **10, inchangé**.

## Problème

Sur un Huawei P30 Pro (Android), le fichier HTML principal s'ouvre
correctement, mais cliquer sur "Voir comme cabinet" ou "Voir comme
collaborateur" affiche **"Impossible d'accéder à votre fichier"** — avant
même que l'interface Cabinet ou Collaborateur ne s'affiche.

## Cause

Les changements de mode et les retours au laboratoire reconstruisaient
l'adresse du document à partir de `location.pathname` (+ un query string) :

```js
location.href = location.pathname + '?mode=dentist';
location.href = location.pathname + '?mode=staff';
location.href = location.pathname; // retours au labo
```

Sur desktop/`file://` classique, `location.pathname` reste stable.
Sur Android, un fichier HTML ouvert depuis un gestionnaire de fichiers est
généralement exposé au navigateur via une `content://` URI (Storage
Access Framework) plutôt qu'un chemin de fichier stable — reconstruire
une nouvelle adresse à partir de `location.pathname` peut alors perdre
l'identité réelle de la ressource, et le navigateur tente d'ouvrir une
"nouvelle" ressource qu'il ne sait plus résoudre. D'où l'erreur, qui se
produit avant même le rendu de l'écran cible : la navigation elle-même
échoue.

## Correction

**Un seul point d'entrée pour lire le mode, un seul pour le changer —
tous deux fondés sur `location.hash`, jamais sur une adresse
reconstruite.**

### `getAppMode()` — lecture canonique du mode

```js
const VALID_APP_MODES=new Set(['lab','dentist','staff','scan']);
function getAppMode(){
  const hashParams=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const hashMode=hashParams.get('mode');
  if(VALID_APP_MODES.has(hashMode))return hashMode;
  const queryMode=new URLSearchParams(location.search).get('mode');
  if(VALID_APP_MODES.has(queryMode))return queryMode;
  return 'lab';
}
```

`#mode=...` est **prioritaire** sur `?mode=...` — la compatibilité
historique avec les ouvertures directes (`?mode=staff`, `?mode=dentist`,
utilisées par les tests et certains raccourcis existants) est conservée,
mais un utilisateur arrivé via `?mode=staff` peut revenir au labo via
`#mode=lab` sans jamais reconstruire le query string. Un fragment
invalide ou absent (`#mode=banana`, `#foo=bar`, `#`) ne casse jamais
l'application : repli sur le query s'il est valide, sinon `'lab'`.

### `switchAppMode(mode)` — changement canonique du mode

```js
function switchAppMode(mode){
  if(!VALID_APP_MODES.has(mode))return false;
  if(typeof stopStaffCameraScan==='function')stopStaffCameraScan();
  location.hash='mode='+mode;
  location.reload();
  return true;
}
```

Ne touche **jamais** `location.pathname`, `location.href` reconstruit, ou
`location.origin` — seul le fragment change, sur le **même document**.
Un `location.reload()` du même document (jamais une nouvelle adresse) est
accepté ici délibérément : `renderDentistMode()`/`renderStaffMode()`
remplacent déjà `document.body.innerHTML` en entier, un retour au
laboratoire nécessite de toute façon de reconstruire le DOM initial —
transformer DentalFlow en SPA avec un routeur runtime complet est
explicitement hors périmètre de ce hotfix minimal.

Avant tout changement de mode, `switchAppMode()` arrête la caméra active
si nécessaire (`stopStaffCameraScan()`, qui arrête déjà le moteur caméra
partagé sous-jacent introduit en V3.10.0 R02 — **aucun second mécanisme
de nettoyage caméra créé**) : aucun `MediaStream` ne doit rester actif
après un changement de mode.

### Fonctions migrées vers le router canonique

- `isDentistMode()`, `isStaffMode()`, `isScanMode()` délèguent désormais
  à `getAppMode()` — un seul parseur de mode dans tout le fichier, plus
  trois implémentations `URLSearchParams(location.search)` concurrentes.
- Le bouton "Voir comme cabinet" (`#open-dentist`) appelle
  `switchAppMode('dentist')`.
- Le bouton "Voir comme collaborateur" (`#open-staff`) appelle
  `switchAppMode('staff')`.
- Le bouton "Retour laboratoire" du portail Cabinet (`#portal-back`,
  dans `attachDentistHandlers`) appelle `switchAppMode('lab')`.
- Le bouton "Retour laboratoire" du portail Collaborateur (`#staff-back`,
  dans `attachStaffHandlers`) appelle `switchAppMode('lab')`.
- **Écran d'erreur "Aucun collaborateur n'a de poste de travail actif"**
  (`renderStaffMode()`, cas sans utilisateur éligible) : le lien
  `<a href="'+location.pathname+'">` a été remplacé par
  `<button class="link" id="staff-back">` — même id que le bouton normal,
  géré par le **même** gestionnaire `attachStaffHandlers()` (appelé
  explicitement même dans cette branche d'erreur) — même dans un état
  d'erreur, le retour au laboratoire passe par le router canonique,
  jamais par une adresse reconstruite.

### Mode Scan — audité, non modifié en profondeur

`isScanMode()` a été migré vers `getAppMode()` par cohérence (même
mécanisme que les deux autres modes), mais `renderScanMode()` ne
contient **aucun** bouton "Retour laboratoire" reconstruisant une
adresse — le seul contrôle de session ("Changer de poste") reste dans le
mode Scan lui-même et n'a pas été touché. Aucune autre modification du
mode Scan, de son moteur QR, ou de son workflow.

## Audit statique complet du fichier

Recherche exhaustive de `location.pathname`, `location.href=`,
`location.replace(`, et des chaînes `href="${location.pathname}"` /
`href="'+location.pathname` dans l'intégralité du fichier. Résultat, une
fois la correction appliquée : **plus aucune occurrence liée à un
changement de mode utilisateur**. Les seules occurrences restantes de
`location.href`/`location.pathname` dans le fichier appartiennent à des
zones explicitement hors périmètre du mandat :
- la bibliothèque jsPDF vendorée (`c.href===location.origin`, logique
  interne de téléchargement de blob, jamais touchée) ;
- `runV341MigrationSeedReload()`, une fonction de **test** de migration
  (`location.replace(location.href.split('?')[0]+'?migrationTest=verify')`)
  — usage de `location.search` explicitement réservé aux tests, que le
  mandat interdit de modifier (§22).

## Non modifié (vérifié explicitement)

- **CSS byte-à-byte identique** à V3.10.0 (comparaison intégrale du bloc
  `<style>`, pas seulement sa longueur).
- Navigation labo (sidebar/drawer mobile) — **non touchée**, aucun lien
  avec ce hotfix.
- Moteur caméra V3.10.0 (R02) — **non modifié** ; `switchAppMode()`
  réutilise `stopStaffCameraScan()` tel quel, sans y toucher.
- Import CSV, permissions, stockage, Design System — **non touchés**.
- `schemaVersion` : **10**, aucune migration.
- Les 405 tests hérités de V3.9.5 et les 20 REL01-REL20 de V3.10.0 restent
  **strictement inchangés** (aucune modification de test existant dans
  cette version).

## Limitation explicitement documentée

L'environnement de test de cette session (Playwright/Chromium sur
`file://`) ne fournit pas de véritable `content://` Android ni de
Storage Access Framework — il est donc **impossible de reproduire
littéralement** le bug tel qu'il se manifeste sur un Huawei P30 Pro dans
cet environnement, et cette limitation est assumée plutôt que dissimulée.
Ce qui EST vérifié en conditions réelles (Chromium, `file://`, clics
réels, jamais une simulation) :
1. le comportement de navigateur réel sur `file://` (voir Test Report,
   ROUTE02-ROUTE07) — en particulier que **l'adresse du document avant le
   fragment `#` ne change strictement jamais**, quel que soit le
   changement de mode effectué ;
2. l'invariant de code, garanti par audit statique exhaustif (ci-dessus) :
   aucun changement de mode utilisateur ne dépend plus de
   `location.pathname`.

Le mécanisme corrigé (fragment `#mode=...`, jamais une adresse
reconstruite) est exactement la classe de fix attendue pour ce type de
problème de résolution de ressource sous Android/Storage Access
Framework — mais l'absence d'un appareil Android réel dans cet
environnement signifie que la disparition complète du message
"Impossible d'accéder à votre fichier" sur un Huawei P30 Pro physique
n'a pas pu être observée directement dans cette session.
