# DentalFlow V3.11.0 — Changelog

**Base :** `dentalflow-next-poc-v3.10.3.6.html` (frozen, inchangé — MD5 `e474b06ec80a822daa9be3bbbde682e4` avant/après).
**Nouveau fichier :** `dentalflow-next-poc-v3.11.0.html`.

Lot correctif terrain à partir des retours du premier test utilisateur en laboratoire. Aucune refonte, aucune
fonctionnalité non concernée par les retours n'a été modifiée.

## 1. Sélecteurs Cabinet et Dentiste recherchables

- Extension générique de la couche DFSelect existante (`dfSelectEnhance`/`dfSelectOpen`/`dfSelectRefresh`) : un
  `<select>` marqué `data-dfselect-search="1"` reçoit un champ de recherche en tête de son popover — filtrage en
  temps réel, insensible à la casse et aux accents (`dfSearchNormalize`, normalisation Unicode NFD), navigation
  clavier (↑ ↓ Enter Escape) restreinte aux options visibles. Aucune option n'est jamais créée depuis le texte
  tapé — la valeur finale reste toujours une `<option>` existante du `<select>` natif.
- Appliqué au sélecteur **Cabinet** de la saisie manuelle Labo (`renderNewOrderPanel`) : tri alphabétique conservé,
  recherche ajoutée.
- Appliqué au sélecteur **Dentiste** (`dentistSelectHTML`, partagé Labo/Cabinet) : tri nom de famille puis prénom
  (au lieu de l'ordre d'import), recherche ajoutée. Lorsqu'un Cabinet est déjà choisi dans la saisie manuelle
  Labo, changer de cabinet régénère la liste de dentistes filtrée sur ce cabinet et désélectionne silencieusement
  tout dentiste qui n'y appartient plus — jamais une association croisée.
- Le fonctionnement des dentistes sans compte DentalFlow et le bouton d'invitation sont inchangés.

## 2. Correctif — sélection Prestation / Teinte côté Cabinet inopérante

**Cause racine identifiée et reproduite par interaction navigateur réelle** (clic sur le combobox présenté à
l'utilisateur, jamais `select.value=...`) : `handleAppClick()` retournait avant d'avoir pu traiter les clics
DFSelect (ouverture du popover, sélection d'une option) dès que `#portal` (portail Cabinet) était présent dans le
DOM. Le combobox Prestation/Teinte/Dentiste était donc visuellement affiché mais totalement inerte au clic dans
le portail Cabinet — la valeur envoyée restait bloquée sur la première option.

- La logique de clic DFSelect est extraite dans `handleDfSelectClick()`, appelée en tout début de
  `handleAppClick()` — AVANT le retour anticipé `#portal` — et fonctionne désormais identiquement en contexte
  Labo et Cabinet. Aucune duplication de la couche DFSelect.
- Un placeholder « — Choisir une prestation — » (option vide, `disabled`) est ajouté au sélecteur Prestation de
  la commande Cabinet : plus aucune prestation n'est pré-sélectionnée implicitement, le `required` HTML bloque
  l'envoi tant que l'utilisateur n'a pas choisi explicitement.

## 3. Règle métier — dent obligatoire sur une commande Cabinet

- **UX** : l'envoi est bloqué si aucune dent n'est sélectionnée ; le champ « Dents concernées » est mis en
  évidence et le message « Sélectionnez au moins une dent avant d'envoyer la commande. » s'affiche, sans perte
  des autres champs déjà saisis.
- **Moteur** : `createDentistOrderCore()` refuse également `teeth=[]`, AVANT tout effet de bord — vérifié : 0
  commande ajoutée, 0 `cabinetPatients` modifié, 0 audit, 0 conversation, 0 notification, 0 `save()`.

## 4. Nouvelle fonction métier — modification d'une commande Cabinet

- Bouton « Modifier la commande » sur la fiche Cabinet d'une commande non annulée/non livrée — ouvre une
  **side-window** dédiée (`openSidePanel('editCabinetOrder')`), conformément à la règle UX DentalFlow
  (consultation rapide = popup, action/workflow = side-window).
- Champs modifiables : dentiste, prénom/nom du patient, prestation, teinte, dents, mode d'empreinte, notes, date
  de livraison souhaitée. `order.id`, `patientRef`, `createdAt` et `source` ne sont jamais réassignés.
  Impossible d'éditer une commande annulée ou livrée.
- Moteur unique `updateCabinetOrderCore()` : mêmes garde-fous que la création (dent obligatoire, prestation
  qualifiée) + isolation inter-cabinets (une commande d'un autre cabinet est refusée, `FORBIDDEN`).
- **Traçabilité** : chaque modification réussie est horodatée, indique l'acteur Cabinet, journalise les champs
  réellement modifiés (ancien → nouveau) via `logAudit(id,'Modification',…)`, génère une notification
  `ORDER_UPDATE` côté Labo, et apparaît dans l'historique de la commande (panneau Traçabilité). L'événement de
  création initiale n'est jamais supprimé ni réécrit.
- **Protection de la date initiale** : `initialRequestedDueAt` est figé une seule fois à la création, jamais
  réécrit. Une modification proposant une date plus tôt (comparaison au jour calendaire, pas à la milliseconde)
  déclenche un écran de confirmation dédié dans la side-window — Annuler laisse le formulaire intact sans aucune
  mutation, Confirmer applique la nouvelle date, journalise et notifie. Une date identique ou plus tardive suit
  le flux normal. Aucun événement n'est jamais antidaté avant `createdAt`.

## 5. Correctif — parcours de scan smartphone

**Diagnostic** : `?mode=scan` (`renderScanMode`) n'offrait qu'une saisie manuelle historique — le moteur caméra
QR réel n'existait que dans `?mode=staff` (`startStaffCameraScan`).

- Le mode Scan propose désormais réellement, dans cet ordre : **1.** Scanner avec la caméra, **2.** Prendre une
  photo, **3.** Saisie manuelle/douchette (toujours disponible en dernier recours).
- Aucun nouveau moteur de décodage : réutilisation littérale de `cameraCapability`, `getCameraDiagnostic()`,
  `cameraUnavailableReason()`, `checkCameraCapability()`, `grabVideoFrameImageData()`, `decodeImageDataWithZXing()`
  et `runMultiPassDecode()` (ce dernier déjà utilisé par le scan photo Stock). `startScanModeCameraScan()` suit
  exactement le même schéma que `startStaffCameraScan()`/`startCameraScan()` (variables de module partagées
  `cameraStream`/`cameraDetector`/`cameraRAF`/`cameraCapability`, exposées entre le script de base et le bloc
  « implementation » via les accesseurs `Object.defineProperty` déjà en place).
- « Prendre une photo » (`<input type="file" accept="image/*" capture="environment">`) décode via
  `runMultiPassDecode()` sur la photo entière (un QR commande remplit généralement l'essentiel du cadre,
  contrairement à un DataMatrix produit noyé dans l'emballage — pas d'étape de recadrage nécessaire).
- Un seul moteur métier pour toutes les méthodes de saisie : `processScanModeOrder()`, appelé identiquement par
  la saisie manuelle, la caméra live et la photo — jamais une résolution de commande dupliquée.
- Contexte `file://` : `cameraUnavailableReason()` explique déjà précisément cette cause et propose directement
  « Prendre une photo » et la saisie manuelle.

## 6. Tests internes ajoutés

Aucun test interne (`?runTests=1`) n'a été ajouté dans cette version — les correctifs ont été vérifiés par une
suite de scripts Playwright externes dédiés (SEL01-05, CABSEL01-02, CABTEETH01-02, EDIT01-04, DATE01-04,
QR01-05), documentée dans `DENTALFLOW_V3_11_0_TEST_REPORT.md`. Les 468 tests internes existants restent
inchangés et 100% passants (468/468 ×3).

## 7. Hors périmètre

ISS-003 (taille du bouton de sélection de dent) n'a pas été touché, conformément au mandat.
