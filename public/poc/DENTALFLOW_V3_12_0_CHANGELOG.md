# DentalFlow V3.12.0 — Changelog

**Base :** `dentalflow-next-poc-v3.11.0.html` (frozen, inchangé — MD5 `040b554552814aba6343c41b3af47f19` avant/après).
**Nouveau fichier :** `dentalflow-next-poc-v3.12.0.html`.

Lot correctif terrain à partir des retours de la deuxième séance de test en laboratoire : un bug de localisation
(« Réception confirmée » affichant pourtant « Sans localisation confirmée ») et une refonte de la représentation
métier du flux de fabrication (phases Réception / Production / Expédition).

## 1. Règle canonique — un scan n'est pas une localisation

**Cause racine du bug terrain** : la seule vérité sur la localisation courante d'une commande est
`getCurrentOrderStage()` (LocationEvent en priorité, repli scanEvents pour les commandes antérieures à V3.8 sans
LocationEvent). Plusieurs écrans continuaient pourtant à traiter l'absence de scan comme une absence de
localisation, alors qu'une localisation (par exemple Réception, volontairement non scannable) peut être
parfaitement confirmée sans aucun scan.

- Audité et corrigé : la carte de production (`prodCardHTML`), la liste des alertes (`alertItems`), la recherche
  globale (`renderSearchPopup`), la ligne « Dernier scan » de la Quick View, le sous-titre de la page Production.
  Chacun dérive désormais la localisation affichée de `getCurrentOrderStage()`/`getConfirmedStage()`, jamais de
  `lastScan(o)`.
- Le dernier scan reste affiché là où c'est pertinent (colonne « Dernier scan » des tableaux, historique) — mais
  **toujours en complément**, jamais comme condition de confirmation de la localisation.
- **Garde-fou de démarrage** : `getCurrentOrderStage()` vit dans le bloc « implementation » (IIFE) et n'est exposée
  sur `window` qu'après `installOverrides()`. Plusieurs fonctions du script de base l'appellent désormais
  directement (`getDentistFacingStatus`, `locationUpdateLine`, `prodCardHTML`…) — un terrain déjà identifié comme
  fragile pour `getConfirmedStage()`. Un stub de repli (calcul en clair du même LocationEvent le plus récent,
  repli scanEvents) a été ajouté au script de base pour rendre ces appels sûrs dès le tout premier `render()`,
  avant que l'IIFE n'ait pu s'exécuter — trouvé et corrigé pendant les tests (voir rapport de tests).

## 2. `ensureReceptionLocation()` — toute confirmation de réception garantit une localisation

- Nouvelle fonction canonique `ensureReceptionLocation(orderId, options)`, qui réutilise strictement
  `moveOrderToStage()` (jamais un second moteur de localisation) : idempotente, elle ne fait rien si une
  localisation est déjà confirmée (quelle qu'elle soit, pas seulement Réception), sinon positionne la commande à
  Réception avec `source:'SYSTEM'`.
- `confirmPhysicalImpressionReceipt(id)` appelle désormais `ensureReceptionLocation()` : confirmer la réception
  d'une empreinte physique horodate `physicalImpressionReceivedAt`, enregistre l'acteur, ET garantit immédiatement
  `getCurrentOrderStage(id).confirmed === true` — sans jamais exiger une confirmation de localisation séparée.
- `printTrackingSheet()` reste compatible : le premier bon imprimé garantit toujours la Réception si aucune
  localisation n'est encore confirmée ; si Réception est déjà confirmée, aucun second LocationEvent Réception
  n'est créé ; si une localisation plus avancée existe déjà, la commande n'est jamais reculée.

## 3. Nouveau modèle de flux — phase métier vs. poste physique

- `stageDefinitions` porte désormais un champ explicite `phase: 'RECEPTION'|'PRODUCTION'|'SHIPPING'` (jamais déduit
  du texte du libellé). Configuration par défaut (mêmes identifiants STG-001..006 qu'avant, migration sans perte) :
  STG-001 Réception (RECEPTION, non scannable), STG-002 Modélisation (PRODUCTION), STG-003 Usinage (PRODUCTION),
  STG-004 Finition 1 (PRODUCTION), STG-005 Finition 2 (PRODUCTION, désactivable pour les labos mono-finition),
  STG-006 Expédition (SHIPPING).
- Réception et Expédition sont les deux bornes métier du flux : ni l'une ni l'autre ne peut être désactivée
  (`deleteStage`) ni déplacée dans une réorganisation (`reorderStages`). « Ajouter un poste » crée toujours un
  poste en phase PRODUCTION, inséré avant Expédition — jamais après.
- `productionCompletedAt` dépend désormais de l'entrée en phase SHIPPING (et non plus de « la dernière étape du
  flux », fragile si un poste est ajouté/réordonné) : figé une seule fois, à la première entrée réelle en
  Expédition. « Livrée » reste un état terminal distinct (`deliveredAt`), jamais confondu avec Expédition.
- `getDentistFacingStatus()` réécrit : dérive désormais le statut Cabinet (Reçue / En fabrication / Expédition /
  Livrée) de la phase métier, plus fiable que l'ancienne déduction par expression régulière sur le texte du
  libellé du poste (fragile après tout renommage).

## 4. Réorganisation visuelle du tableau de production

- Desktop : le tableau Production regroupe désormais visuellement les postes par phase —
  `[RÉCEPTION] [——— PRODUCTION ———][Modélisation][Usinage][Finition 1][Finition 2] [EXPÉDITION]` — sans changer le
  comportement de glisser-déposer des postes de Production.
- Mobile : l'accordéon responsive conserve le détail par poste et affiche désormais un badge de phase
  (Réception/Production/Expédition) sur chaque poste.

## 5. Traçabilité historique — `stageLabelAtEvent`

- `LocationEvent` porte désormais un instantané `stageLabelAtEvent` (libellé du poste au moment de l'événement).
  `orderTimeline()` préfère cet instantané au libellé courant du poste pour l'affichage de l'historique — un
  renommage de poste ne réécrit donc jamais silencieusement l'histoire d'un ancien événement.
- Migration déterministe et idempotente `migrateStageDefinitionsAndEventsV312()` : renomme les anciens postes par
  défaut (Design CAD→Modélisation, Céramique→Finition 1, Contrôle qualité→Finition 2, Prêtes→Expédition) et leur
  assigne une `phase`, en rétro-remplissant `stageLabelAtEvent`/`stageLabelAtScan` sur les événements historiques
  qui n'en ont pas encore — avant le renommage, jamais après. Aucun LocationEvent/scanEvent n'est jamais dupliqué
  ni supprimé ; aucun timestamp historique n'est jamais modifié ; une seconde exécution de la migration est un
  no-op strict.

## 6. Tests internes mis à jour

Trois tests internes existants (`?runTests=1`) référençaient littéralement les anciens libellés de poste
(« Céramique », « Contrôle qualité ») dans leurs assertions — conséquence nécessaire et attendue du renommage
délibéré, pas une régression logique. Mis à jour pour refléter les nouveaux libellés (Finition 1/Finition 2) :
le test T142 (consommation matière par poste), le test de narration `orderTimeline()`
(Partie A/B/D/E/F/G), et le test de distinction d'un cycle de reprise dans la timeline (Partie F).

## 7. Hors périmètre

Le mécanisme métier explicite permettant de supprimer le poste Expédition n'a volontairement pas été construit
dans ce lot (la borne reste non supprimable, conformément au mandat).
