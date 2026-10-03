# DentalFlow V3.12.0 — Rapport d'implémentation

Lot correctif terrain, construit à partir de la baseline fonctionnelle `dentalflow-next-poc-v3.11.0.html`
(frozen, inchangée) et des retours de la deuxième séance de test réelle en laboratoire.

## BUGS_CORRIGES

1. **« Réception confirmée » affichée comme « Sans localisation confirmée ».** Cause racine double : (a)
   `confirmPhysicalImpressionReceipt(id)` ne créait jamais de LocationEvent (seuls
   `physicalImpressionReceivedAt`/`physicalImpressionReceivedBy` étaient renseignés) ; (b) plusieurs écrans
   (carte de production, alertes, recherche globale, Quick View, sous-titre de la page Production) traitaient à
   tort l'absence de scan comme une absence de localisation, alors que `getCurrentOrderStage()` — déjà
   canoniquement correcte — dérive la localisation des LocationEvents, pas des scans. Corrigé par un nouveau
   helper idempotent `ensureReceptionLocation()` (réutilisant strictement `moveOrderToStage()`), branché sur
   `confirmPhysicalImpressionReceipt()` et `printTrackingSheet()`, et par la correction des 5 écrans consommant
   `lastScan()` comme preuve de localisation à tort.
2. **Statut de fabrication fragile (`productionCompletedAt` dépendant de « la dernière étape »).** Un ajout ou un
   réordonnancement de poste pouvait silencieusement casser la détection de fin de fabrication. Corrigé : la
   détection dépend désormais de l'entrée en phase SHIPPING (propriété explicite du poste), jamais de sa position
   dans la liste.
3. **Statut Cabinet dérivé par expression régulière sur le texte du libellé de poste** (`getDentistFacingStatus`),
   fragile après tout renommage de poste. Corrigé : dérivé désormais de la phase métier (RECEPTION/PRODUCTION/
   SHIPPING), robuste à un renommage ou à l'ajout d'un poste.
4. **Régression découverte pendant les tests de ce lot** : `getCurrentOrderStage is not defined` (ReferenceError)
   au tout premier rendu du portail Cabinet (`?mode=dentist`) — plusieurs fonctions du script de base ajoutées
   par ce lot appelaient directement une fonction qui ne vit dans le bloc « implementation » (IIFE) et n'est
   exposée sur `window` qu'après son exécution. Corrigé par un stub de repli au comportement identique, rendant
   ces appels sûrs dès le premier rendu.

## AMELIORATIONS_UX

1. **Réorganisation du tableau de production par phase métier.** Desktop :
   `[RÉCEPTION] [——— PRODUCTION ———][Modélisation][Usinage][Finition 1][Finition 2] [EXPÉDITION]` — le
   glisser-déposer des postes de Production reste identique. Mobile : l'accordéon responsive affiche désormais un
   badge de phase sur chaque poste, sans perdre le détail par poste.
2. **Localisation affichée fidèle et complète.** La fiche commande distingue désormais toujours trois informations
   jamais fusionnées : la localisation confirmée (ex. « Réception »), sa dernière mise à jour (source réelle +
   acteur + horodatage, ex. « Suivi démarré (système) · 01/10/2026 14:32 »), et le dernier scan le cas échéant
   (« Aucun scan » si aucun scan n'a jamais eu lieu, sans jamais remettre en cause la localisation confirmée).
3. **Statut Cabinet simplifié et fiable.** Le suivi de commande côté Cabinet affiche désormais systématiquement
   l'un de quatre statuts clairs (Reçue / En fabrication / Expédition / Livrée), sans jamais exposer un poste
   interne du laboratoire (Modélisation/Usinage/Finition 1/Finition 2 sont tous regroupés sous « En fabrication »).

## NOUVELLE_FONCTION_METIER

1. **Modèle de flux à deux niveaux — phase métier et poste physique.** `stageDefinitions` porte un champ explicite
   `phase: 'RECEPTION'|'PRODUCTION'|'SHIPPING'` (jamais déduit du texte). Réception et Expédition sont les deux
   bornes métier du flux : non désactivables, non déplaçables dans une réorganisation. Un nouveau poste est
   toujours créé en phase PRODUCTION, inséré avant Expédition. Finition 2 reste désactivable pour les
   laboratoires mono-finition sans invalider le flux (Réception + Expédition + postes restants toujours présents).
2. **`ensureReceptionLocation(orderId, options)`.** Helper canonique et idempotent : si une localisation est déjà
   confirmée (quelle qu'elle soit), ne fait rien (`alreadyLocated:true`) ; sinon positionne la commande à
   Réception via `moveOrderToStage(source:'SYSTEM')`. Jamais de second moteur de localisation, jamais de recul
   automatique d'une commande déjà avancée.
3. **Fidélité historique (`stageLabelAtEvent`).** Chaque LocationEvent porte désormais un instantané du libellé
   du poste au moment de l'événement. L'historique de commande (`orderTimeline()`) utilise cet instantané plutôt
   que le libellé courant — un renommage de poste ne réécrit donc jamais silencieusement un événement passé.
4. **Migration déterministe V3.11.0 → V3.12.0** (`migrateStageDefinitionsAndEventsV312`). Renomme les postes par
   défaut historiques (Design CAD→Modélisation, Céramique→Finition 1, Contrôle qualité→Finition 2,
   Prêtes→Expédition) et leur assigne une `phase`, en rétro-remplissant les instantanés historiques
   (`stageLabelAtEvent`/`stageLabelAtScan`) sur les événements qui n'en ont pas déjà, avant le renommage. Aucune
   donnée n'est jamais perdue, dupliquée ou modifiée dans son sens historique ; une seconde exécution est un
   no-op strict (idempotence vérifiée par MIGFLOW02).

## MIGRATION_V3_11_VERS_V3_12

Aucune perte de donnée constatée. Vérifié par 5 tests ciblés (MIGFLOW01-05, voir rapport de tests) sur un état
reconstruit fidèle à V3.11.0 (anciens libellés de poste, LocationEvents sans instantané, scanEvents avec
instantané déjà présent en V3.11.0) : les 6 postes sont correctement renommés avec leur `phase`, la migration est
idempotente, toutes les commandes historiques gardent une localisation exploitable, tous les scanEvents
historiques restent identiques en dehors des champs explicitement ajoutés, et tous les LocationEvents historiques
gardent leur horodatage réel et leur libellé HISTORIQUE dans la timeline (jamais réécrits avec le nouveau
libellé).

## SCAN_REAL_DEVICE

**`HARDWARE_REAL_SCAN_NOT_VERIFIED`**

Aucun changement n'a été apporté au moteur caméra/QR dans ce lot — seuls deux scripts de test externes référençant
littéralement l'ancien libellé de poste « Design CAD » ont dû être mis à jour vers « Modélisation » (faux-positif
de script de test consécutif au renommage délibéré des postes, pas une régression produit). Aucun smartphone réel
ni serveur HTTPS n'était disponible pendant cette mission pour exercer le flux caméra physique de bout en bout
(QR04) — honnêtement déclaré non vérifié, jamais présenté comme un PASS matériel. Le décodage d'un vrai QR via
« Prendre une photo » reste vérifié de bout en bout (QR02).

## Décision finale

**`READY_FOR_SECOND_LAB_TEST`**

Justification : le bug terrain rapporté (réception confirmée affichée comme non localisée) est corrigé et vérifié
par reproduction AVANT/APRÈS ainsi que par 6 tests ciblés dédiés. Le nouveau modèle de flux par phase métier est
vérifié par 9 tests ciblés et par la réorganisation visuelle du tableau de production. La migration V3.11.0 →
V3.12.0 est vérifiée sans perte par 5 tests ciblés. Le statut Cabinet simplifié est vérifié par 6 tests ciblés.
Une régression a été trouvée et corrigée pendant les tests de ce lot (`getCurrentOrderStage` indéfinie au premier
rendu du portail Cabinet), et l'intégralité de la suite de non-régression a été rejouée après correctif sans
aucune anomalie résiduelle : 468/468 ×3, NAVDOM 31/31, UI CLICK 16/16, SEL01-05, CABSEL01-02, CABTEETH01-02,
EDIT01-04, DATE01-04, QR01-03/05, confidentialité patient P1-P6 intégralement maintenue
(`LAB_PATIENT_NAME_LEAKS = 0`), 0 anomalie mobile sur les deux viewports, `dentalflow-next-poc-v3.11.0.html`
strictement inchangée. Seule réserve : QR04 (caméra réelle sur smartphone) reste à vérifier physiquement lors de
la séance — ce point est documenté explicitement ci-dessus et dans le rapport de tests, jamais présenté comme
validé.
