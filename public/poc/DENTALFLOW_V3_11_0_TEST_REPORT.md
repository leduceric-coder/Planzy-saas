# DentalFlow V3.11.0 — Rapport de tests

**Fichier testé :** `dentalflow-next-poc-v3.11.0.html`
**Base figée :** `dentalflow-next-poc-v3.10.3.6.html` — MD5 avant toute modification : `e474b06ec80a822daa9be3bbbde682e4` ;
MD5 après l'ensemble de ce travail (génération + tous les tests ci-dessous) : `e474b06ec80a822daa9be3bbbde682e4`.
**Identique dans les deux cas** — vérifié également par `git status --porcelain`, aucune modification détectée sur
ce fichier.

## Méthodologie

Chaque correctif a d'abord été **reproduit** par interaction navigateur réelle (Playwright, clics sur les
composants effectivement présentés à l'utilisateur — jamais `element.value = x` ni `select.value = x` suivi d'un
`dispatchEvent` artificiel pour les comportements cliquables), puis corrigé, puis revérifié par le même type
d'interaction.

## Tests ciblés

### SEL — Sélecteurs Cabinet/Dentiste

| Test | Attendu | Résultat |
|---|---|---|
| SEL01 | Cabinets triés alphabétiquement | **PASS** — `["Cabinet Moderne","Clinique Belle Dent","Clinique Sourire","Dr. Lucas Dupont","Dr. Morvan"]` |
| SEL02 | Dentistes triés nom puis prénom | **PASS** — ordre vérifié contre un tri de référence nom→prénom |
| SEL03 | Recherche « dup » trouve Dupont | **PASS** — 1 seule option visible après filtrage : « Lucas Dupont » |
| SEL04 | Recherche insensible casse/accents (« ERIC » → Éric Morvan) | **PASS** — 1 seule option visible : « Éric Morvan » |
| SEL05 | Choisir le Cabinet filtre les dentistes disponibles | **PASS** — « Cabinet Moderne » → uniquement Sophie Renard / Amélie Rousseau ; un dentiste déjà sélectionné d'un autre cabinet est désélectionné lors du changement, jamais associé silencieusement |

### CABSEL — Sélection Prestation/Teinte Cabinet (bug terrain)

- **Reproduction** (AVANT correctif) : clic réel sur le bouton combobox Prestation → popover ne s'ouvre pas
  (`POPOVER OPEN AFTER BTN CLICK: false`) ; commande créée avec `serviceId` et `shade` restés sur la première
  option malgré le clic sur une autre option.
- **CABSEL01** (APRÈS correctif) : clic réel sur une prestation autre que la première → popover s'ouvre, option
  sélectionnée visuellement, `draft.serviceId` mis à jour, commande créée contenant EXACTEMENT la prestation
  choisie. **PASS**.
- **CABSEL02** : même scénario teinte (A1 affichée → sélection A2 → soumission) → `order.shade === "A2"`.
  **PASS**.
- Vérifié également via le flux complet `EDIT01-04`/`DATE01-04` (commande créée puis modifiée), confirmant la
  non-régression du correctif dans la durée.

### CABTEETH — Dent obligatoire

| Test | Résultat |
|---|---|
| CABTEETH01 — Soumission sans dent | **PASS** — refus, texte d'erreur affiché, champ mis en évidence, 0 mutation (orders/cabinetPatients/audit/conversations/notifications identiques avant/après), toutes les données déjà saisies conservées |
| CABTEETH02 — Sélection dent 14 → commande créée avec `["14"]` | **PASS** |
| Garde moteur directe (bypass UX) | **PASS** — `createDentistOrderCore()` avec `teeth:[]` renvoie `null`, 0 effet de bord |

### EDIT — Modification de commande Cabinet

| Test | Résultat |
|---|---|
| EDIT01 — Modifier une commande non livrée/non annulée, persistance | **PASS** |
| EDIT02 — `order.id`/`patientRef`/`createdAt`/`source` inchangés | **PASS** |
| EDIT03 — Audit contenant ancien → nouveau | **PASS** — `"Nom du patient : « EditTest » → « EditTestModifie » ; Notes / indications : « — » → « Note modifiee EDIT01 »"` |
| EDIT04 — Notification Labo créée | **PASS** — 1 notification `ORDER_UPDATE`/`target:LAB` |
| Garde-fous moteur (commande annulée/livrée/autre cabinet/sans dent/prestation non qualifiée) | **PASS** — chacun refusé avec le motif attendu (`ORDER_CANCELLED`/`ORDER_DELIVERED`/`FORBIDDEN`/`TEETH_REQUIRED`/`SERVICE_NOT_ORDERABLE`), 0 effet de bord cumulé vérifié |

### DATE — Protection de la date initiale

| Test | Résultat |
|---|---|
| DATE01 — Nouvelle date antérieure à `initialRequestedDueAt` → confirmation obligatoire | **PASS** — écran de confirmation affiché |
| DATE02 — Annuler la confirmation → date inchangée, formulaire intact | **PASS** |
| DATE03 — Confirmer → `dueAt` modifié, `initialRequestedDueAt` inchangé, audit présent | **PASS** |
| DATE04 — Aucun événement antidaté avant `createdAt` | **PASS** |

*Bug trouvé et corrigé pendant ces tests* : la comparaison « date antérieure » utilisait initialement les
timestamps ISO complets (avec l'heure arbitraire de création), déclenchant un faux recul de date pour un même
jour calendaire. Corrigé par comparaison au jour (YYYY-MM-DD) uniquement, conforme à un `<input type="date">` qui
ne permet de choisir qu'un jour.

### QR — Parcours de scan smartphone

| Test | Résultat |
|---|---|
| QR01 — `?mode=scan` affiche une vraie action caméra/photo, pas seulement une zone de saisie | **PASS** |
| QR02 — QR décodé (caméra ou photo) alimente le même moteur métier que la saisie manuelle | **PASS** — vérifié avec un **vrai code QR** généré par l'encodeur embarqué (`qrSvg`, identique à celui des fiches imprimées), rasterisé en PNG, décodé via `handleScanModePhotoFile()` → `runMultiPassDecode()` → `processScanModeOrder()` → `moveOrderToStage()` : commande effectivement déplacée, `scanEvents` incrémenté |
| QR03 — Contexte sans caméra → message explicite + photo + saisie manuelle disponibles | **PASS** — message `cameraUnavailableReason()` affiché (vérifié en forçant la condition `file://`+non sécurisé, car le Chromium de test expose `getUserMedia` même sur `file://`, contrairement à un navigateur mobile réel) ; bouton photo et saisie manuelle toujours présents |
| QR04 — Origine HTTPS avec `getUserMedia` autorisé → flux démarré/arrêté proprement | **`HARDWARE_REAL_SCAN_NOT_VERIFIED`** — aucun appareil/navigateur mobile réel ni serveur HTTPS disponible pendant cette mission. Le déclenchement caméra a été exercé jusqu'à l'appel réel `getUserMedia()` (échec propre et explicite faute de caméra physique dans le bac de test : `NotFoundError` → « Aucune caméra détectée sur cet appareil. », `state.scanModeCameraActive` correctement remis à `false`, aucun plantage) — la chaîne fonctionnelle est vérifiée jusqu'à ce point, mais le flux vidéo réel sur un smartphone n'a pas pu être observé. |
| QR05 — Après scan valide : caméra arrêtée, commande identifiée, localisation enregistrée une seule fois, feedback visible | **PASS** — `scanEvents` incrémenté de 1 (pas de doublon), feedback `"CMD-xxxx enregistrée — <poste> · <technicien>"` affiché |

*Bug trouvé et corrigé pendant ces tests* : `handleScanModePhotoFile()` référençait initialement `zxingScanCanvas`,
une variable privée du bloc `dentalflow-v34-implementation` (IIFE), inaccessible depuis le script de base où vit
le code du mode Scan (`ReferenceError`). Corrigé par l'utilisation d'un canvas local au script de base
(`scanModeCanvas`), passé en paramètre à `runMultiPassDecode()` (qui ne dépend jamais d'un canvas interne pour sa
source — seul son usage propre, `cropDragCanvas`, reste privé à l'IIFE).

## Non-régression complète

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK V3.10.3.2 TOTAL 16 PASSED 16 FAILED 0
```

- **Confidentialité patient (règle V3.10.3.6 maintenue)** : P1-P6 rejoués intégralement sur
  `dentalflow-next-poc-v3.11.0.html` avec import du corpus réel (126 cabinets / 91 dentistes / 13 utilisateurs /
  353 prestations / 17 fournisseurs / 515 articles) — tous **PASS**, `LAB_PATIENT_NAME_LEAKS = 0`.
- **Mobile** (390×844 et 430×932) : menu, tableaux, production, Quick View, formulaire Cabinet (incluant les
  nouveaux champs Prestation/Dents/placeholder), portail Staff, **mode Scan** (caméra/photo/saisie manuelle) —
  **0 erreur console, 0 anomalie mobile trouvée** sur les deux viewports.
- **Prestations non qualifiées restent non commandables** : vérifié directement sur `dentalflow-next-poc-v3.11.0.html`
  — `serviceIsOrderable()` refuse une prestation forcée en `pricingMode:null`/`pricingReviewRequired:true`, et
  à la fois `createDentistOrderCore()` (Cabinet) et `buildOrderFromInput()` (Labo) la refusent également (`null`).
- **Aucune commande partielle créée en cas de validation refusée** : confirmé pour toutes les gardes (dent
  manquante, prestation non qualifiée, commande annulée/livrée, cabinet étranger) — 0 mutation
  orders/cabinetPatients/historyEvents/notifications dans tous les cas.
- **Données du kit de test labo V2 intactes** : `dentalflow-next-poc-v3.10.3.6.html` (base de génération du kit)
  confirmé strictement inchangé (MD5 identique + `git status` propre) tout au long de ce travail — le kit
  `dentalflow-test-labo-v2.html` n'a pas été régénéré ni modifié dans cette mission.

## Conclusion

Tous les correctifs demandés sont vérifiés par interaction navigateur réelle, sans régression détectée sur les
468 tests internes, NAVDOM, UI, confidentialité patient ou mobile. Seul QR04 (caméra réelle sur smartphone/HTTPS)
n'a pas pu être vérifié faute de matériel — déclaré honnêtement `HARDWARE_REAL_SCAN_NOT_VERIFIED`, jamais
présenté comme un PASS.
