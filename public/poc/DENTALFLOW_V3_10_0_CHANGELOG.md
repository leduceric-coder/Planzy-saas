# DentalFlow V3.10.0 — Changelog — FUNCTIONAL RELIABILITY

**Base :** `dentalflow-next-poc-v3.9.5.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.0.html`
**Mandat :** Fiabilité fonctionnelle uniquement — R01 (vérité de la commande),
R02 (scan caméra Collaborateur), R04 (import CSV fiable), R08 (intégrité
action/conséquence, périmètre limité), R12 (culs-de-sac Stock) — **aucun
redesign, aucun feature creep**. `schemaVersion` : **10, inchangé** (aucune
migration nécessaire).

**Non modifié (vérifié explicitement) :** CSS **byte-à-byte identique** à
V3.9.5 (129 582 caractères, comparaison intégrale, pas seulement la
longueur) ; navigation (31/31 vérifications Playwright NAVDOM rejouées) ;
Design System ; les trois expériences (Responsable/Collaborateur/Cabinet) ;
politique de confidentialité patient (non touchée — R03 Astra reste hors
périmètre, comme mandaté) ; moteur d'achats déterministe (StockEngine/
DemandEngine/ReplenishmentEngine/SupplierEngine/ProposalEngine) ; PWA ;
portail Cabinet.

`DENTALFLOW_AUDIT_ASTRA_V4.md` référencé au §0 du mandat **n'existe dans
aucune version du dépôt** (recherché par nom de fichier et dans tout
l'historique git — introuvable). Absence documentée ici par transparence ;
le travail ci-dessous a été mené à partir de la spécification inline très
détaillée du mandat lui-même et d'une reproduction directe contre le code
réel, jamais bloqué sur ce document manquant.

---

## R01 — Une seule vérité pour la commande

### 1. Filtre "Toutes" + statut "Annulées" retournait toujours un ensemble vide (§5-6)

**Reproduit :** `filteredOrders()` combine `state.filter` (4 boutons) et
`state.orderStatusFilter` (select secondaire) en ET logique
(V3.8.4 Partie D). Le cas `'all'` de `orderMatchesFilter` exclut par
construction les commandes annulées (`!isOrderCancelled(o)`). Sélectionner
explicitement le statut "Annulées" pendant que le filtre principal restait
sur sa valeur par défaut "Toutes" retournait donc **toujours** un ensemble
vide, quel que soit le nombre réel de commandes annulées.

**Cause racine :** intersection {non-annulées} ∩ {annulées} = ∅ par
construction — pas un bug de calcul, un conflit de deux filtres jamais
réconcilié pour ce cas précis.

**Fix :** `filteredOrders()` — quand le statut secondaire demande
explicitement `'cancelled'` alors que le filtre principal est resté sur sa
valeur par défaut `'all'` (jamais un choix explicite de l'utilisateur pour
ce cas), le filtre principal ne s'applique plus en amont. Tout autre filtre
principal (late/blocked/ready/completed/active) continue de s'appliquer
normalement.

**Fonction modifiée :** `filteredOrders()`.
**Test :** REL01.

### 2. Commandes annulées visibles dans le flux de Production (§7-8)

**Reproduit :** `renderProduction()` calculait `inLab` via
`state.orders.filter(o=>!isOrderCompleted(o))` — sans exclure les
commandes annulées (`productionState='cancelled'`, distinct de
`'completed'`). Une commande annulée restait affichée dans sa colonne de
poste et dans le bloc "Sans localisation confirmée". `renderFlow(st)`
(widget Accueil) comptait de la même façon sur `state.orders` brut.

**Fix :** les deux réutilisent `operationalOrders()` (V3.8.6 Partie A,
déjà la population canonique "hors annulées" utilisée par
`kpiCounts()`/`orderDistribution()`) au lieu de dupliquer la logique
d'exclusion. Vérifié explicitement que `orderDistribution()`/`kpiCounts()`
étaient déjà corrects — non modifiés.

**Fonctions modifiées :** `renderProduction()`, `renderFlow(st)`.
**Test :** REL02.

### 3. Cohérence de la localisation entre vues (§9-11)

**Investigué, aucun bug trouvé :** `getConfirmedStage()`/`effectiveStation()`/
`locationText()`/`technicianText()` sont déjà la source canonique partout
où la "localisation actuelle" est affichée (fiche commande, Quick View,
tableau Production). `lastScan()` n'est utilisé, dans tout le fichier, que
pour l'horodatage du dernier scan physique ("Dernier scan HH:MM"), jamais
pour une affirmation de position — c'était déjà correct depuis V3.8.
**Aucune modification de code** ; un test de régression a été ajouté pour
verrouiller ce comportement (un déplacement MANUAL, qui ne crée jamais de
scanEvent, doit être immédiatement reflété par `locationText()`, jamais par
un dernier scan devenu obsolète).
**Test :** REL03.

### 4. Statut Cabinet pouvait déguiser une commande annulée (§12-13)

**Reproduit :** `getDentistFacingStatus(o)` n'avait aucune vérification
`isOrderCancelled()` et retombait sur la déduction par localisation — une
commande annulée pouvait s'afficher côté Cabinet comme "Fabrication en
cours" ou "Prête", jamais comme annulée.

**Fix :** vérification `isOrderCancelled()` en tout premier, retour
`{key:'cancelled',label:'Annulée',color:'gray'}` (même convention que le
statut labo `statusInfo('cancelled')`) avant toute déduction par
localisation. Le reste de la taxonomie (Reçue/Contrôle/Fabrication/Prête/
Livrée) n'est pas retouché.

**Fonction modifiée :** `getDentistFacingStatus(o)`.
**Test :** REL04.

---

## R02 — Scan caméra QR Collaborateur

### Contexte

L'écran Collaborateur (`?mode=staff`, `staffScanHTML()`/
`handleStaffScanSubmit()`) n'offrait que la saisie clavier/douchette USB
(le QR de production, `qrSvg(o.id)`, encode déjà l'id de commande en clair
— **format non modifié**). Le moteur caméra ZXing existant côté Stock
(`checkCameraCapability`/`cameraUnavailableReason`/`decodeImageDataWithZXing`/
`grabVideoFrameImageData`/`explainCameraError`, V3.6.1/V3.7.1) décode déjà
DataMatrix **et QR_CODE** — entièrement réutilisable sans écrire un second
moteur.

### 1. Refactor pour un chemin unique clavier/caméra

`handleStaffScanSubmit()` a été découpé : le cœur métier (résolution
commande/poste, appel à `moveOrderToStage`, feedback) est désormais dans
`processStaffScan(orderId)`, appelé identiquement par la saisie
clavier/douchette (`handleStaffScanSubmit`) **et** par la nouvelle caméra
(`handleStaffScanDecodedText`) — jamais deux implémentations qui
pourraient diverger.

### 2. Caméra QR réelle (`startStaffCameraScan`/`stopStaffCameraScan`)

Réutilise **exactement** le moteur caméra de Stock (mêmes variables de
module `cameraStream`/`cameraDetector`/`cameraRAF`/`cameraCapability` —
un seul flux caméra possible à la fois, cohérent) ; seule la décision
"que faire du texte décodé" diffère (pas de parsing GS1 côté Collaborateur,
le texte brut EST déjà l'id de commande).

**Piège structurel rencontré et corrigé :** le fichier est composé de
plusieurs blocs `<script>`, dont le bloc principal (moteur métier complet,
y compris `checkCameraCapability`/`explainCameraError`/`grabVideoFrameImageData`
et le moteur caméra de Stock) est une IIFE dont le contenu n'est PAS
visible depuis le script de base (où vivent `staffScanHTML`/
`handleStaffScanSubmit`/`attachStaffHandlers`). Deux bugs réels en ont
résulté et ont été corrigés :
- `checkCameraCapability` n'était exposée sur `window` qu'après le tout
  premier rendu synchrone du mode Collaborateur au chargement — un
  `ReferenceError` transitoire se produisait à chaque ouverture de
  `?mode=staff` (corrigé par une garde `typeof`, comportement final
  inchangé) ;
- `explainCameraError`/`grabVideoFrameImageData` et les variables de
  module `cameraStream`/`cameraDetector`/`cameraRAF`/`cameraCapability`
  n'étaient jamais exposées du tout — cliquer sur "Scanner avec la
  caméra" jetait un `ReferenceError` réel et permanent (pas seulement au
  chargement). Corrigé en étendant l'export déjà existant
  (`installOverrides()`) avec `window.explainCameraError`,
  `window.grabVideoFrameImageData`, et des accesseurs `Object.defineProperty`
  pour `cameraStream`/`cameraDetector`/`cameraRAF`/`cameraCapability` afin
  que les deux scripts partagent RÉELLEMENT le même état caméra (un seul
  flux actif possible, jamais deux moteurs qui se marchent dessus).
  Vérifié en conditions réelles (clic réel sur le bouton caméra, 0 erreur
  console avant/après).

### 3. Feedback persistant et messages contextuels

`processStaffScan()` distingue, via `#staff-scan-feedback` (persistant
dans le DOM, jamais un simple toast) :
- poste non affecté (`NO_STAGE`) ;
- code vide (`EMPTY`) ;
- **code reconnu comme n'étant pas un QR de production DentalFlow**
  (`WRONG_QR_TYPE`, préfixe `CMD-` attendu) — distinct d'une commande
  simplement introuvable ;
- commande introuvable (`NOT_FOUND`) ;
- double lecture (`DUPLICATE_SCAN`, voir ci-dessous) ;
- transition refusée par le moteur (`res.message` de `moveOrderToStage` —
  commande bloquée/annulée/livrée/droits insuffisants, affiché tel quel,
  jamais réécrit).
Le succès reste sur `state.staffFeedback`/`applyStaffFeedback()`
(inchangé, déjà persistant depuis V3.8.2 Partie B).

### 4. Anti-double-scan (fenêtre documentée)

`STAFF_SCAN_DEDUPE_MS = 4000` : deux scans de la **même** commande par le
**même** collaborateur en moins de 4 secondes sont traités comme une
double lecture (rebond scanner USB ou QR tenu trop longtemps devant la
caméra) et ignorés — jamais un second événement de localisation
silencieusement dupliqué. S'applique identiquement à la caméra et à la
saisie clavier (chemin unique, voir §1).

### 5. Feature-detection caméra, jamais de cul-de-sac

`staffScanHTML()` reprend la même structure de décision que
`renderStockScanPanel()` : caméra active → flux vidéo + bouton Arrêter ;
sinon bouton "Scanner avec la caméra" si une tentative est possible,
sinon message de repli explicite (`cameraUnavailableReason()` — contexte
non sécurisé, `file://`, navigateur sans `getUserMedia`…). **La saisie
manuelle/douchette USB reste toujours visible et utilisable**, quel que
soit l'état de la caméra — jamais de cul-de-sac.

### 6. "Poste de production" dans le formulaire Utilisateurs

**Reproduit :** `assignedStageId` existe comme champ de données depuis
V3.3 (c'est lui que `getAssignedStage()`/`staffEligibleUsers()` lisent
pour déterminer l'accès à l'écran Scan et le poste cible des scans) mais
n'était exposé dans **aucun** formulaire — impossible d'affecter ou de
changer le poste de production d'un collaborateur autrement qu'en éditant
l'état persisté à la main.

**Fix :** champ dédié "Poste de production" dans `renderUserFormPanel()`,
explicitement distinct de "Poste" (le libellé de fonction, `urole`) et de
"Rôle (droits)" (les permissions, `uroleId`) — une liste des postes de
production actifs + une option "Aucun (non-productif / administratif)".
`submitUserForm()` valide la valeur contre `stageDefinitions` (même garde
que `migrateUsers()`, V3.3.2) ; une valeur vide ou invalide retombe sur
`null`, jamais une chaîne orpheline.

**Fonctions modifiées :** `handleStaffScanSubmit` (découpé),
`staffScanHTML`, `attachStaffHandlers`, `renderUserFormPanel`,
`submitUserForm`, `installOverrides` (exports caméra).
**Fonctions ajoutées :** `processStaffScan`, `startStaffCameraScan`,
`stopStaffCameraScan`, `handleStaffScanDecodedText`.
**Tests :** REL05 (scan caméra valide, même chemin que le clavier), REL06
(code non reconnu / commande introuvable — messages distincts), REL07
(anti-double-scan), REL08 (champ Poste de production, validation).

---

## R04 — Import CSV fiable (priorité haute)

### 1. Délimiteur codé en dur sur la virgule (§25-30)

**Reproduit :** `parseCSV()` ne reconnaissait que `,` (`ch===','` codé en
dur). Un export Excel FR (`;` par défaut) ou un ERP en TAB était
silencieusement mal découpé — chaque ligne entière atterrissait dans la
première colonne, toutes les autres valant `''`, provoquant des rejets en
cascade (`MISSING_REQUIRED`) sans jamais expliquer la vraie cause.

**Fix :** nouvelle fonction `detectCsvDelimiter(headerLine)` — compte les
occurrences de `;`, `,`, TAB sur la ligne d'en-tête HORS zones entre
guillemets (jamais un split naïf qui casserait un champ cité contenant le
délimiteur), le plus fréquent gagne. Le découpage par champs cités (déjà
correct — gestion des guillemets échappés `""`) est conservé tel quel,
seul le délimiteur devient paramétrable.

**Fonction modifiée :** `parseCSV(text)`. **Fonction ajoutée :**
`detectCsvDelimiter(headerLine)`.
**Test :** REL09.

### 2. Parseur numérique divergent entre aperçu et écriture (§31-36, §39-44)

**Reproduit :** `validateImportRows()` acceptait déjà "12,50" comme valide
(`Number(String(v).replace(',','.'))`), mais `applyImportRows()`
utilisait `+r.champ||0` **sans** ce remplacement pour articles/
fournisseurs/tarifs (seul `stocks` faisait l'effort) — "12,50" y valait
`Number("12,50")` = `NaN` → `||0` → **0 silencieusement écrit**, alors que
l'aperçu venait d'accepter cette même ligne comme valide. De plus,
`+r.champ||0` confondait vide, zéro et invalide (les trois donnaient 0).

**Fix :** parseur numérique **canonique unique**, `parseImportNumber(raw)`,
retournant `{empty, valid, value}` — distingue explicitement vide
(`{empty:true,valid:true,value:null}`) de zéro explicite
(`{empty:false,valid:true,value:0}`) et d'invalide
(`{valid:false}`). Reconnaît la virgule décimale française ET le point.
Utilisé **identiquement** par `validateImportRows()` (son `num(k)`
délègue désormais à `parseImportNumber`) et `applyImportRows()` (via le
raccourci `importNumOr(raw,def)`) — un seul chemin de conversion, jamais
deux. Le contrôle `NEGATIVE_QTY` de l'import stock, qui utilisait
`Number(r.stock)<0` (échouait silencieusement sur "-5,5"), utilise
désormais aussi `parseImportNumber`.

**Fonctions modifiées :** `validateImportRows()`, `applyImportRows()`.
**Fonctions ajoutées :** `parseImportNumber(raw)`, `importNumOr(raw,def)`.
**Tests :** REL10 (décimale française, aperçu→écriture), REL11
(vide ≠ zéro ≠ invalide), REL15 (aperçu = écriture, valeur identique).

### 3. Doublons de référence non détectés DANS le fichier (§37-38)

**Reproduit :** `validateImportRows()` ne vérifiait les doublons que
contre l'état **déjà persisté**. Deux lignes du même fichier partageant
une référence nouvelle passaient toutes les deux la validation puis
produisaient, à l'écriture, soit un article fantôme en double avec un id
`ART-xxx` collisionné (`state.articles.push` deux fois avec le même id,
silencieusement — la seconde devenait invisible pour `findArticle`), soit
un tarif dupliqué non fusionné.

**Fix :** `importDuplicateKeyFn(type)` — clé de déduplication intra-
fichier par type (référence pour articles/commandes, nom pour
fournisseurs/utilisateurs, référence+fournisseur pour tarifs) ; toute
référence apparaissant plus d'une fois dans le fichier est rejetée pour
**toutes** ses occurrences (`DUPLICATE_IN_FILE`), jamais "le dernier
gagne" silencieusement. Cas particulier `stocks` : plusieurs lignes pour
la même référence restent acceptées **si elles s'accordent sur la
quantité cible** (comportement déjà couvert par le test hérité
"rejectedCount…", 8 lignes identiques) — seul un désaccord de quantité
pour la même référence est traité comme ambigu et rejeté.

**Fonction ajoutée :** `importDuplicateKeyFn(type)`. **Fonction
modifiée :** `validateImportRows()`.
**Test :** REL12.

### 4. Comptage "Importé" trompeur — fournisseurs et tarifs (§39-44)

**Reproduit (fournisseurs) :** `if(!state.suppliers.some(s=>s.id===id))
state.suppliers.push(...);imported++` — le `imported++` s'exécutait
**inconditionnellement**, même quand le fournisseur existait déjà et que
la ligne était intégralement ignorée (rien poussé, rien modifié) :
"Importé : 1" alors que rien n'avait changé.

**Reproduit (tarifs) :** chaque exécution empilait une **nouvelle**
entrée dans `state.articleSuppliers` pour le même (article, fournisseur),
même si une existait déjà — un ré-import n'était jamais idempotent (deux
tarifs actifs pour la même paire après un second import).

**Fix :** upsert honnête pour fournisseurs/tarifs/utilisateurs — Créé si
nouveau, Modifié si au moins un champ diffère de l'existant, Ignoré si
rigoureusement identique. `applyImportRows(type,valid,mapping,statsOut)`
accepte un 4ᵉ paramètre optionnel (signature rétro-compatible — les
appels existants qui l'omettent sont inchangés) rempli avec
`{created,updated,skipped}` ; la valeur de retour reste `created+updated`
(= l'ancien `imported`, tests hérités inchangés). L'invariant "un seul
tarif préféré actif par article" (`isPreferred` → désactive les autres)
est **strictement préservé**, appliqué avant la branche création/mise à
jour. Le résultat de l'assistant d'import (étape 5) affiche désormais
Créé/Modifié/Ignoré/Rejeté au lieu d'un unique "importées".

**Fonction modifiée :** `applyImportRows()`, le gestionnaire de l'étape 4
de l'assistant, la carte de résultat de l'étape 5.
**Test :** REL13 (fournisseurs : création → ré-import identique → Ignoré
→ ré-import modifié → Modifié).

### 5. Import stock — idempotence vérifiée (§39-44, déjà correcte)

**Vérifié, aucun bug trouvé :** `applyImportRows('stocks',…)` calcule déjà
`delta = target − physicalStock(articleId)` et ne crée un StockMovement
`ADJUSTMENT` que si `delta≠0` — un ré-import de la même quantité cible ne
produit déjà aucun second mouvement. Seule la conversion numérique a été
unifiée sur `parseImportNumber` (voir §2) ; la logique delta/ADJUSTMENT
elle-même n'a pas été modifiée.
**Test :** REL14 (ré-import identique → 0 nouveau mouvement ; quantité
différente → 1 nouveau mouvement).

### 6. Modèles téléchargeables (§43-44)

`downloadImportTemplate(type)` génère un CSV `;`-délimité dont les
en-têtes proviennent **directement** de `IMPORT_FIELD_SCHEMAS[type].key`
(jamais une liste recopiée à la main qui pourrait diverger du parseur
réel), avec une ligne d'exemple réaliste (décimale française incluse).
Lien discret "Télécharger un modèle…" ajouté à l'étape 1 de l'assistant
pour Fournisseurs/Stocks/Tarifs/Articles — pas Commandes/Utilisateurs
(hors périmètre mission). **Explicitement non fait, comme mandaté :** la
simplification de l'UX de l'assistant d'import (Astra R17) reste hors
périmètre de cette version — fiabilité uniquement.

**Fonctions ajoutées :** `IMPORT_TEMPLATE_EXAMPLES`,
`downloadImportTemplate(type)`.
**Test :** vérifié en conditions réelles (clic réel → téléchargement
déclenché, voir non-régression ci-dessous) ; le contenu ligne d'en-tête
est directement dérivé du schéma testé par REL09/REL10/REL12/REL13/REL15.

---

## R08 — Intégrité action/conséquence (périmètre limité)

### 1. Annulation de commande sans confirmation (§45-46)

**Reproduit :** le bouton "Annuler la commande" du menu "…" appelait
directement `openCancelFlow()` → `cancelOrder()` en un seul clic, sans
aucune étape de confirmation, pour une action que le mandat lui-même
reconnaît irréversible.

**Fix :** réutilise le panneau latéral **existant**
(`openSidePanel`/`renderSidePanel`, même mécanique que `cancelForm`/
`stockForm`/`userForm` — aucun second système de confirmation inventé)
comme étape intermédiaire obligatoire. Le clic ouvre désormais
`renderCancelConfirmPanel()` (récapitulatif : id, cabinet, avertissement
si de la matière a déjà été consommée, action non réversible) ; c'est
**uniquement** son bouton "Confirmer l'annulation" qui appelle
`openCancelFlow()` — **byte-identique**, non modifié. Les deux tests
hérités qui appellent `openCancelFlow(id)` directement (chemin moteur)
continuent de fonctionner à l'identique : ils exercent le même chemin
d'annulation réel, simplement plus atteignable depuis un seul clic côté
UI.

**Fonctions ajoutées :** `requestCancelOrder(orderId)`,
`renderCancelConfirmPanel()`. **Fonction inchangée :** `openCancelFlow()`.
**Test :** REL16.

### 2. Wording "imprimé" affirmant une preuve physique impossible (§47)

**Reproduit :** `printTrackingSheet()` appelle `logAudit(...)` **avant**
`printFiche(id)` (qui appelle `window.print()`) — et le texte du journal
utilisait "imprimé"/"réimprimé" (passé, affirmatif), alors qu'un
navigateur ne peut jamais garantir qu'une impression physique a
réellement abouti (l'utilisateur peut annuler la boîte de dialogue
d'impression). Le comportement produit (le suivi démarre à la première
impression) n'est PAS remis en cause — seul le vocabulaire devient
honnête : "Bon de suivi préparé" / "Suivi démarré" / "nouvelle impression
lancée", jamais "imprimé avec succès".

**Fix :** trois libellés corrigés — `orderTimeline()` (détail affiché :
"Bon de suivi imprimé" → "Bon de suivi préparé"), et les deux appels
`logAudit` de `printTrackingSheet()` (première impression et
réimpression). Vérifié qu'aucun test existant n'asserte ces chaînes
littérales avant modification (le seul test lié, `noStaleWording`, cible
une chaîne structurellement différente — le champ `text`, pas `detail`/
les messages `logAudit`).

**Fonctions modifiées :** `orderTimeline()`, `printTrackingSheet()`.

### 3. `isReadyToStartTracking` — déjà correctement appliqué (§48, vérifié)

**Vérifié, aucun bug trouvé :** le pré-requis "empreinte physique reçue
avant démarrage du suivi" est déjà appliqué **dans la fonction**
`printTrackingSheet()` elle-même (`if(!isReadyToStartTracking(o)){...
return}`), pas seulement un bouton masqué côté UI. Aucune modification.

### 4. Garde-fou "commande bloquée" ajouté au moteur unique de mouvement (§48-49)

**Reproduit :** `blockOrder()`/`unblockOrder()` (V3.8.6 Partie D) posent
`o.flags.blocked` comme unique source de vérité métier, mais aucune
fonction de mouvement ne le consultait — une commande bloquée restait
scannable/déplaçable normalement, contredisant silencieusement le sens
même du blocage (affiché partout ailleurs comme suspension de la
production : pill "Bloquée", KPI, filtre "Bloquées").

**Fix :** `moveOrderToStage()` refuse désormais SCAN et MANUAL sur une
commande bloquée (`{success:false,reason:'ORDER_BLOCKED'}`), au même
niveau que les gardes déjà existantes ORDER_CANCELLED/ORDER_DELIVERED —
dans le moteur unique, pas un garde-fou dupliqué côté UI. La correction
SYSTEM (démarrage du suivi par `printTrackingSheet`) n'est pas concernée,
car elle ne représente pas une progression physique de production.
Redevient possible immédiatement après `unblockOrder()`.

**Fonction modifiée :** `moveOrderToStage()`.
**Test :** REL17.

### 5. Manuel vs consommation — déjà distinct (vérifié)

**Vérifié, aucun bug trouvé :** une correction manuelle de localisation
(`source:'MANUAL'`) et un scan (`source:'SCAN'`) sont déjà des chemins
distincts dans `moveOrderToStage()` — seul `source==='SCAN'` déclenche
`recordScan()`/`consumeForScan()` (consommation matière) ; `MANUAL`
n'appelle jamais `consumeForScan` pour la consommation initiale (établi
depuis V3.8 Partie I/J/K). Aucune modification.

---

## R12 — Culs-de-sac Stock

### 1. Bouton "Ajuster" — dead-end réel reproduit et corrigé (§50-53)

**Reproduit :** le bouton "Ajuster" de la fiche article
(`data-panel="stockAction"`) déclenchait le dispatcher générique
`[data-panel]`, qui lit `sidePanelOrderId` depuis `data-trace-order` — un
attribut que le bouton **ne portait pas** (il portait `data-stock-action`,
jamais lu par ce dispatcher). `renderSidePanel()` n'avait de plus **aucun
cas** pour `'stockAction'`. Résultat : `openSidePanel('stockAction', null)`
ouvrait la classe `.open` du panneau latéral (ajoutée
inconditionnellement par `openSidePanel`, avant même de savoir si un
contenu a été rendu) — un panneau vide, un vrai cul-de-sac.

**Fix :** l'attribut du bouton est corrigé en `data-trace-order` (même
convention que le bouton "Gérer les prestations" juste au-dessus dans le
même `quick-actions`). Nouveau panneau minimal
(`renderStockActionPanel()`/`submitStockAdjustment()`) : article, stock
physique actuel, nouvelle quantité, motif **obligatoire**. La correction
ne réécrit **jamais** `state.stockMovements` en place ni ne mute une
quantité directement — comme toute correction physique existante
(réception, scan, retour), elle passe par un **nouveau** StockMovement de
type `ADJUSTMENT` (qty = delta signé), exactement le type déjà utilisé
par les fixtures de test achats existantes.

**Fonctions ajoutées :** `renderStockActionPanel()`,
`submitStockAdjustment(articleId,data)`.
**Test :** REL18 (motif vide refusé ; motif fourni → ADJUSTMENT tracé,
stock mis à jour).

### 2. Proposition d'achat BLOQUÉE — CTA contextuel au lieu d'un bouton mort (§54-55)

**Reproduit :** pour une proposition `BLOCKED`, `renderProposalDetail()`
affichait `<button ... disabled>Résoudre le blocage</button>` — aucune
action possible, aucun lien vers l'écran de configuration pertinent, un
cul-de-sac de la même famille que le bouton "Ajuster" ci-dessus.

**Fix :** `proposalBlockingResolutionButton(p)` identifie la raison de
blocage **canonique** déjà calculée par le moteur (`p.blocking`,
`computeNeeds`/`reconcileProposals` — jamais recalculée ici) et propose un
CTA contextuel vers l'écran **existant** pertinent, jamais un nouveau
module de résolution : "Configurer le fournisseur" (onglet Fournisseurs)
pour `missing_supplier`/`no_supplier`, "Configurer le tarif" (panneau
`tariffForm` déjà utilisé pour créer/modifier un tarif, pré-rempli avec
l'article/fournisseur concernés) pour `missing_price`, "Voir le
fournisseur" (panneau `supplierDetail` déjà utilisé) pour
`minimum_order`.

**Fonctions ajoutées :** `proposalBlockingResolutionButton(p)`, le
gestionnaire de clic `[data-resolve-blocking]`.
**Fonction modifiée :** `renderProposalDetail()` (un seul appel remplacé).
**Test :** REL19.

### 3. Réception PO — vérifiée correcte (§55, aucun bug trouvé)

**Vérifié, aucun bug trouvé :** `receivePurchaseOrder()` ne crée qu'**un**
StockMovement `RECEIPT` par ligne par appel (jamais de double création
pour une même quantité) ; le reliquat (`orderedQty − receivedQty`) est
recalculé à chaque appel et détermine `partially_received`/`received` ;
une PO non-`OPEN` (déjà `received`/`cancelled`) est refusée
(`PO_NOT_RECEIVABLE`) avant toute écriture. `cancelPurchaseOrder()` ne
touche jamais `state.stockMovements` — l'historique des réceptions déjà
enregistrées est **structurellement préservé** après annulation. Aucune
modification de code — comportement déjà conforme au mandat.
**Test :** REL20 (réception partielle → reliquat correct, un seul
mouvement ; réception complémentaire → deux mouvements distincts, jamais
fusionnés ; sur-réception après complétion → refusée ;
annulation → historique RECEIPT intact).

---

## Non-régression

- **425/425 tests persistés PASS** (405 hérités de V3.9.5, strictement
  inchangés + 20 nouveaux REL01-REL20).
- **CSS byte-à-byte identique** à V3.9.5 (comparaison intégrale du bloc
  `<style>`, 129 582 caractères, pas seulement la longueur).
- **Navigation : 31/31 vérifications Playwright NAVDOM rejouées contre
  V3.10.0**, PASS — aucune régression de nav.
- **22/22 vérifications d'interaction UI réelle** (clics réels, pas
  d'appel direct de fonction) : confirmation d'annulation de bout en
  bout, panneau d'ajustement de stock de bout en bout, bouton caméra
  Collaborateur (rendu + clic, 0 erreur), lien de téléchargement de
  modèle d'import (clic réel → téléchargement déclenché), CTA de
  résolution de blocage (clic réel → navigation vers l'écran réel).
- **18/18 vérifications responsive (430/390/375px, écran Scan
  Collaborateur particulièrement scruté) + thèmes light/dark/system**
  (panneau de confirmation d'annulation testé dans les 3 thèmes).
- **Isolation des données métier : 0 différence** sur les 22 tableaux
  métier (orders/users/stockMovements/purchaseOrders/
  purchaseProposals/articleSuppliers/suppliers/stockLots/
  locationEvents/scanEvents/historyEvents/activityEvents/articles/
  services/serviceMaterials/cabinets/leaveRequests/absences/messages/
  conversations/invoices/reworks) avant/après la suite complète de 425
  tests. Des champs d'état UI purement transitoires (vue courante,
  filtres actifs, étape de l'assistant d'import…) ne sont pas remis à
  zéro par chaque test — **comportement préexistant identique dans
  V3.9.5** (vérifié par comparaison directe, même ampleur de variation),
  non modifié par cette version, documenté ici par transparence plutôt
  que de prétendre à une isolation totale non vérifiée.
- `node --check` PASS sur les 5 blocs `<script>`.
- **0 erreur console** sur l'ensemble des scénarios testés (suite
  persistée, interactions UI réelles, responsive, thèmes, chargement
  `?mode=staff`).

## Bug de portée de script découvert et corrigé pendant le développement

Le fichier est structuré en 5 blocs `<script>` ; un bloc "script de base"
(portail Collaborateur/Cabinet/Scan, formulaires) coexiste avec le bloc
principal (IIFE `dentalflow-v34-implementation`, moteur métier + suite de
tests). Les fonctions de l'IIFE ne sont visibles depuis le script de base
que si explicitement exportées sur `window` (pattern déjà utilisé avant
cette version pour une partie du moteur caméra). Deux fois pendant ce
développement, une fonction ajoutée dans l'IIFE a été appelée depuis le
script de base sans être exportée, provoquant un `ReferenceError` réel :
d'abord `renderCancelConfirmPanel`/`renderStockActionPanel` (appelées
depuis le dispatcher `renderSidePanel()` du script de base — corrigé en
les rattachant au bon override, celui déjà défini dans l'IIFE, où elles
sont nativement visibles), puis `checkCameraCapability`/
`explainCameraError`/le moteur caméra partagé (appelés depuis
`startStaffCameraScan()`, ajoutée au script de base — corrigé par export
explicite, voir R02 §2). Les deux ont été détectés par une vérification
statique de portée (analyse AST) puis confirmés/corrigés via interaction
réelle (Playwright), **avant** livraison — aucun des deux n'atteint ce
fichier final.
