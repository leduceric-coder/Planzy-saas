# DentalFlow V3.11.0 — Rapport d'implémentation

Lot correctif terrain, construit à partir de la baseline fonctionnelle `dentalflow-next-poc-v3.10.3.6.html`
(frozen, inchangée) et des retours du premier test utilisateur réel en laboratoire.

## BUGS_CORRIGES

1. **Sélection prestation Cabinet inopérante.** Cause racine : `handleAppClick()` retournait avant d'avoir pu
   traiter les clics DFSelect (ouverture/sélection) dès que `#portal` (portail Cabinet) existait dans le DOM — le
   combobox Prestation était affiché mais totalement inerte au clic. Corrigé en extrayant la logique de clic
   DFSelect dans `handleDfSelectClick()`, appelée AVANT ce retour anticipé — fonctionne désormais dans tous les
   contextes.
2. **Sélection teinte Cabinet inopérante.** Même cause racine, même correctif (couche DFSelect partagée).
3. **Dents obligatoires non appliquées.** Une commande Cabinet pouvait être envoyée sans aucune dent
   sélectionnée. Corrigé à deux niveaux : blocage UX (message + mise en évidence du champ, sans perte des
   données déjà saisies) et refus moteur dans `createDentistOrderCore()` (avant tout effet de bord — 0
   commande/cabinetPatients/audit/conversation/notification/save en cas de refus).
4. **Parcours scan smartphone cassé.** `?mode=scan` n'offrait qu'une saisie manuelle historique, prétendant
   couvrir le test caméra alors que le moteur caméra réel vivait exclusivement dans `?mode=staff`. Corrigé en
   dotant le mode Scan des mêmes capacités caméra/photo que le Collaborateur, en réutilisant littéralement le
   même moteur de décodage (ZXing embarqué, `grabVideoFrameImageData`, `runMultiPassDecode`).

## AMELIORATIONS_UX

1. **Recherche Cabinet** dans la saisie manuelle Labo — combobox recherchable (clic pour parcourir OU frappe
   immédiate), insensible casse/accents, tri alphabétique conservé.
2. **Recherche Dentiste** — même combobox recherchable, partagé Labo/Cabinet. Filtré automatiquement sur le
   Cabinet déjà choisi côté Labo, sans jamais associer silencieusement un dentiste d'un autre cabinet.
3. **Tri Dentiste** par nom de famille puis prénom (au lieu de l'ordre d'import, non trié).
4. **Placeholder explicite** « — Choisir une prestation — » sur le sélecteur Prestation Cabinet : plus aucune
   présélection implicite pouvant être envoyée sans choix réel de l'utilisateur.
5. **Mise en évidence visuelle** du champ « Dents concernées » lors d'un envoi refusé faute de dent.

## NOUVELLE_FONCTION_METIER

1. **Modification d'une commande Cabinet.** Bouton « Modifier la commande » sur une commande non annulée/non
   livrée, ouvrant une side-window dédiée (règle UX DentalFlow : action/workflow = side-window). Champs
   modifiables : dentiste, identité patient, prestation, teinte, dents, empreinte, notes, date de livraison
   souhaitée — `order.id`/`patientRef`/`createdAt`/`source` jamais réassignés. Traçabilité complète : audit
   horodaté avec acteur Cabinet et détail ancien→nouveau par champ, notification Labo (`ORDER_UPDATE`), visible
   dans l'historique de la commande, sans jamais toucher l'événement de création initiale.
2. **Protection de la date initiale.** `initialRequestedDueAt` figé à la création, jamais réécrit. Toute demande
   de livraison plus tôt que cette date déclenche une confirmation explicite dans la side-window ; Annuler ne
   produit aucune mutation (même partielle) ; Confirmer applique la nouvelle date tout en conservant la date
   initiale comme référence et journalise l'action.

## SCAN_REAL_DEVICE

**`HARDWARE_REAL_SCAN_NOT_VERIFIED`**

Aucun smartphone réel ni serveur HTTPS n'était disponible pendant cette mission pour exercer un flux caméra
physique de bout en bout. Ce qui a été vérifié, sans inventer de PASS matériel :

- la détection de capacité caméra (`cameraCapability`/`getCameraDiagnostic`/`cameraUnavailableReason`) est
  correctement branchée dans le mode Scan et produit le message attendu selon le contexte (y compris le message
  explicite dédié à un fichier ouvert en `file://`) ;
- l'appel réel `navigator.mediaDevices.getUserMedia()` a été déclenché et a échoué proprement faute de caméra
  physique dans l'environnement de test (`NotFoundError` → message explicite, état remis à zéro, aucun plantage) ;
- le décodage d'un **vrai** QR code (généré par l'encodeur embarqué de l'application, identique à celui imprimé
  sur les fiches) via la voie « Prendre une photo » a été vérifié de bout en bout avec succès, alimentant le même
  moteur métier (`moveOrderToStage`) que la saisie manuelle ;
- le flux vidéo caméra live sur un appareil physique (démarrage/détection/arrêt propre, QR04 du mandat) n'a pas
  pu être observé et n'est donc pas déclaré validé.

**Recommandation :** vérifier QR04 lors du second test laboratoire, sur un smartphone réel via le lien HTTPS qui
sera transmis pour cette mission.

## Décision finale

**`READY_FOR_SECOND_LAB_TEST`**

Justification : tous les bugs terrain rapportés sont corrigés et vérifiés par interaction navigateur réelle,
468/468 tests internes ×3, NAVDOM 31/31, UI CLICK 16/16, confidentialité patient P1-P6 intégralement maintenue
(`LAB_PATIENT_NAME_LEAKS = 0`), 0 anomalie mobile sur les deux viewports, `dentalflow-next-poc-v3.10.3.6.html`
strictement inchangée. Seule réserve : QR04 (caméra réelle sur smartphone) reste à vérifier physiquement lors de
la séance — ce point est documenté explicitement ci-dessus et dans le scénario de test transmis, jamais présenté
comme validé.
