# DentalFlow V3.12.0 — Rapport de tests

**Fichier testé :** `dentalflow-next-poc-v3.12.0.html`
**Base figée :** `dentalflow-next-poc-v3.11.0.html` — MD5 avant toute modification : `040b554552814aba6343c41b3af47f19` ;
MD5 après l'ensemble de ce travail : `040b554552814aba6343c41b3af47f19`. **Identique dans les deux cas** —
confirmé également par `git status --porcelain`, aucune modification détectée sur ce fichier.

## Méthodologie

Le bug terrain a d'abord été **reproduit** par interaction navigateur réelle (Playwright) avant tout correctif,
puis revérifié par le même type d'interaction. Les tests ciblés métier (REC/FLOW/CABFLOW) appellent le moteur
applicatif directement (mêmes fonctions que celles utilisées par l'UI — `moveOrderToStage`, `createRework`,
`ensureReceptionLocation`…), à l'identique de la méthodologie déjà utilisée par la suite interne 468 tests ;
les tests de non-régression Cabinet (SEL/CABSEL/CABTEETH/EDIT/DATE/QR) reproduisent des clics réels sur les
composants effectivement présentés à l'utilisateur, jamais `element.value = x`.

## RECEPTION_LOCATION_BUG

**PASS**

Reproduit AVANT correctif : `confirmPhysicalImpressionReceipt(id)` ne créait aucun LocationEvent (seuls
`physicalImpressionReceivedAt`/`physicalImpressionReceivedBy` étaient renseignés) ; `getCurrentOrderStage`
retournait légitimement `confirmed:false` ; `prodCardHTML` traitait séparément l'absence de scan comme une
absence de localisation. Résultat observé : `showsSansLocalisation: true` malgré une réception confirmée.

Après correctif (`ensureReceptionLocation()` + réécriture de `confirmPhysicalImpressionReceipt`/`printTrackingSheet`
+ correction des 5 écrans consommant à tort `lastScan()` comme preuve de localisation) :

| Test | Attendu | Résultat |
|---|---|---|
| REC01 | Confirmation réception → `physicalImpressionReceivedAt != null`, `getCurrentOrderStage().confirmed === true`, phase RECEPTION, localisation Réception | **PASS** |
| REC02 | Après REC01 : `lastScan(order) === null` MAIS localisation affichée = Réception, aucune mention « Sans localisation confirmée » | **PASS** |
| REC03 | Premier bon imprimé après REC01 : aucun LocationEvent Réception supplémentaire | **PASS** |
| REC04 | Second bon imprimé : toujours aucun nouveau LocationEvent Réception | **PASS** |
| REC05 | Commande déjà à Usinage, `ensureReceptionLocation()` appelée par accident : reste à Usinage, aucun recul automatique | **PASS** — `res.alreadyLocated === true` |
| REC06 | Commande sans aucune localisation : apparaît bien dans la zone « localisation non confirmée » | **PASS** |

## RECEPTION_NO_SCAN_STILL_CONFIRMED

**PASS**

Vérifié par REC02 ci-dessus et par audit exhaustif de tous les sites consommant `lastScan()` : classés en (a)
usage légitime complémentaire (colonne « Dernier scan » des tableaux, détail scan de la Quick View — jamais une
condition de confirmation) — laissés inchangés, (b) faux-positif corrigé (`prodCardHTML`, `alertItems`,
`renderSearchPopup`, le sous-texte « Dernier scan » de la Quick View, le sous-titre de la page Production). Plus
aucune occurrence de la forme `if(lastScan(order)) confirmed else not confirmed` dans le fichier.

## FLOW_PHASE_MODEL

**PASS**

| Test | Attendu | Résultat |
|---|---|---|
| FLOW01 | Config par défaut = les 6 nouveaux postes (STG-001..006) | **PASS** |
| FLOW02 | Modélisation/Usinage/Finition 1/Finition 2 → phase PRODUCTION | **PASS** |
| FLOW03 | Réception → phase RECEPTION | **PASS** |
| FLOW04 | Expédition → phase SHIPPING | **PASS** |
| FLOW05 | Ajout d'un poste → créé en PRODUCTION, inséré avant Expédition | **PASS** |
| FLOW06 | Désactivation de Finition 2 → flux reste valide (Réception + Expédition + postes restants) | **PASS** |
| FLOW07 | Entrée en Expédition → `productionCompletedAt` figé une seule fois, commande « Prête à livrer » ; une seconde entrée en Expédition ne change plus `productionCompletedAt` | **PASS** |
| FLOW08 | Retour exceptionnel d'Expédition vers un poste de Production via reprise → `productionCompletedAt` conservé (jamais réinitialisé), statut redevient cohérent (`progress`/`active`), comportement identique au moteur de reprise préexistant | **PASS** |
| FLOW09 | Expédition ≠ Livrée : aucun `deliveredAt` avant l'action de livraison explicite | **PASS** |

## V3_11_MIGRATION

**PASS**

Un état « V3.11.0-style » a été reconstruit en mémoire (stageDefinitions sans champ `phase`, libellés historiques
Réception/Design CAD/Usinage/Céramique/Contrôle qualité/Prêtes, LocationEvents sans `stageLabelAtEvent`,
scanEvents avec `stageLabelAtScan` déjà présent en V3.11.0) avec 3 commandes porteuses d'historique réel, puis
migré par `migrateStageDefinitionsAndEventsV312()`.

| Test | Attendu | Résultat |
|---|---|---|
| MIGFLOW01 | Les 6 postes sont renommés avec la bonne `phase` | **PASS** |
| MIGFLOW02 | Ré-exécution de la migration : 0 duplication de LocationEvent/scanEvent, 0 nouvelle mutation de `stageDefinitions` | **PASS** — idempotence stricte |
| MIGFLOW03 | Les 3 commandes historiques gardent chacune une localisation exploitable (`confirmed === true`) après migration | **PASS** |
| MIGFLOW04 | Les scanEvents historiques restent identiques en dehors des champs explicitement ajoutés (`stageLabelAtScan`/`stageLabelAtEvent`) | **PASS** |
| MIGFLOW05 | Les LocationEvents historiques gardent leur horodatage réel et leur libellé HISTORIQUE (`stageLabelAtEvent`) dans `orderTimeline()` — jamais réécrits avec le nouveau libellé | **PASS** — timeline affiche bien « Entrée en Céramique », jamais « Entrée en Finition 1 », pour cet événement passé |

## CABINET_FLOW

**PASS**

| Test | Attendu | Résultat |
|---|---|---|
| CABFLOW01 | Réception → « Reçue » | **PASS** |
| CABFLOW02 | Modélisation → « En fabrication » | **PASS** |
| CABFLOW03 | Usinage → « En fabrication » | **PASS** |
| CABFLOW04 | Finition 1 → « En fabrication » | **PASS** |
| CABFLOW05 | Expédition → « Expédition » | **PASS** |
| CABFLOW06 | Livraison explicite → « Livrée », `deliveredAt != null` | **PASS** |

Aucun poste interne du laboratoire (Modélisation/Usinage/Finition 1/Finition 2) n'est jamais exposé tel quel côté
Cabinet — toujours regroupé sous « En fabrication ».

## QR_REAL_DEVICE

**`HARDWARE_REAL_SCAN_NOT_VERIFIED`**

Aucun changement n'a été apporté au moteur caméra/QR dans ce lot (hors mise à jour des deux scripts de test qui
référençaient littéralement l'ancien libellé de poste « Design CAD » pour positionner `state.scanStation` —
renommé en « Modélisation », sans quoi `processScanModeOrder` retournait `STAGE_NOT_FOUND` : un faux-positif de
script de test, pas une régression produit). QR01/QR02/QR03/QR05 repassés PASS après ce correctif de script ; QR04
(flux caméra live sur un smartphone réel via HTTPS) reste non vérifiable dans cet environnement — aucun
smartphone réel ni serveur HTTPS disponible. Déclaré honnêtement non vérifié, jamais présenté comme un PASS.

| Test | Résultat |
|---|---|
| QR01 — `?mode=scan` propose réellement caméra/photo, pas seulement une saisie | **PASS** |
| QR02 — QR décodé (photo réelle, encodeur embarqué `qrSvg`) alimente le même moteur métier que la saisie manuelle | **PASS** — vérifié avec un vrai QR rasterisé en PNG, décodé via `handleScanModePhotoFile()` → `runMultiPassDecode()` → `processScanModeOrder()` → `moveOrderToStage()` |
| QR03 — Contexte `file://` → message explicite + photo + saisie manuelle disponibles | **PASS** |
| QR04 — Caméra live sur smartphone réel via HTTPS | **`HARDWARE_REAL_SCAN_NOT_VERIFIED`** |
| QR05 — Après scan valide : feedback visible, localisation enregistrée une seule fois | **PASS** |

## Régression trouvée et corrigée pendant les tests

**`getCurrentOrderStage is not defined` (ReferenceError) à l'ouverture directe de `?mode=dentist`.**

`getCurrentOrderStage()` vit dans le bloc « implementation » (IIFE) et n'est exposée sur `window` qu'après
`installOverrides()`. Plusieurs fonctions du script de base ajoutées/modifiées par ce lot
(`getDentistFacingStatus`, `locationUpdateLine`, `prodCardHTML`) l'appellent directement — un terrain déjà
identifié comme fragile pour `getConfirmedStage()` (garde défensive existante depuis V3.8). Le tout premier
`render()` du portail Cabinet (avant que l'IIFE n'ait pu s'exécuter) listant les commandes du dentiste via
`getDentistFacingStatus()` déclenchait l'erreur. **Reproduit** via `test_teeth.js` (`?mode=dentist`, 1 erreur
console), **corrigé** par l'ajout d'un stub de repli de `getCurrentOrderStage()` dans le script de base (même
comportement exact, calculé en clair à partir de `state.locationEvents`/`getLastScan`, sans dépendre de l'IIFE),
automatiquement remplacé par l'implémentation réelle dès que l'IIFE s'exécute (`window.getCurrentOrderStage =
getCurrentOrderStage`). **Revérifié** : 0 erreur console sur l'ensemble de la suite de non-régression ci-dessous,
rejouée intégralement après ce correctif.

## Non-régression complète

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives, après le correctif ci-dessus)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK V3.10.3.2 TOTAL 16 PASSED 16 FAILED 0
```

- **SEL01-05** (sélecteurs Cabinet/Dentiste recherchables) : **PASS** (5/5), 0 erreur console.
- **CABSEL01-02** (sélection prestation/teinte Cabinet par clic réel) : **PASS** (2/2) — `order.serviceId`/
  `order.shade` correspondent exactement à l'option cliquée (différente de la première), 0 erreur console.
- **CABTEETH01-02** (dent obligatoire, UX + moteur) : **PASS** (2/2 + garde moteur directe), 0 mutation en cas de
  refus, 0 erreur console après le correctif `getCurrentOrderStage`.
- **EDIT01-04** (modification de commande Cabinet, traçabilité) : **PASS** (4/4), 0 erreur console.
- **DATE01-04** (protection de la date initiale) : **PASS** (4/4), 0 erreur console.
- **QR01-05** : voir QR_REAL_DEVICE ci-dessus.
- **Confidentialité patient P1-P6** : rejoué intégralement sur `dentalflow-next-poc-v3.12.0.html` avec import du
  corpus réel (126 cabinets / 91 dentistes / 13 utilisateurs / 353 prestations / 17 fournisseurs / 515 articles) —
  tous **PASS**, `LAB_PATIENT_NAME_LEAKS = 0` (anti-fuite automatique sur 16 surfaces : home, orders, production,
  stock, reports, planning, users, cabinets, invoices, Quick View, side panel, impression de fiche, recherche
  globale, export CSV commandes, portail Staff, portail Scan).
- **Mobile** (390×844 et 430×932) : menu, tableaux de commandes, **tableau de production réorganisé par phases**
  (nouveauté V3.12.0 — accordéon mobile avec badge de phase), Quick View, formulaire Cabinet, portail Staff, mode
  Scan — **0 erreur console, 0 anomalie mobile trouvée** sur les deux viewports.

## Conclusion

Le bug terrain (réception confirmée affichée comme non localisée) est corrigé et vérifié à la fois par reproduction
AVANT/APRÈS et par 6 tests ciblés dédiés (REC01-06). Le nouveau modèle de flux par phase métier est vérifié par 9
tests ciblés (FLOW01-09) et par la réorganisation visuelle du tableau de production (desktop et mobile). La
migration V3.11.0 → V3.12.0 est vérifiée sans perte ni duplication par 5 tests ciblés (MIGFLOW01-05), y compris la
fidélité historique des libellés de poste dans la timeline. Le statut Cabinet simplifié est vérifié par 6 tests
ciblés (CABFLOW01-06). Une régression a été trouvée et corrigée pendant les tests (`getCurrentOrderStage`
indéfinie au premier rendu du portail Cabinet) et la suite complète a été rejouée après correctif sans aucune
régression résiduelle : 468/468 ×3, NAVDOM 31/31, UI CLICK 16/16, confidentialité patient intégralement
maintenue, 0 anomalie mobile. Seul QR04 (caméra réelle sur smartphone) reste à vérifier physiquement — déclaré
honnêtement `HARDWARE_REAL_SCAN_NOT_VERIFIED`, jamais présenté comme validé.
