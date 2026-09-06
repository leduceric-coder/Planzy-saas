# DentalFlow Next — Changelog V3.6

Base : `dentalflow-next-poc-v3.5.1.html` (fourni comme `dentalflownextpocv3.5.1(2).html`), avec les correctifs V3.5.2 (Partie R) réappliqués par-dessus (Clock réel par défaut, parser d'échéances, recalcul silencieux au démarrage, montants sur les boutons WAIT, filtre « Aujourd'hui / en retard », géométrie des onglets). Livrable : `dentalflow-next-poc-v3.6.html`.

Mission : élargissement du modèle métier au flux terrain réel (identité patient, dentistes, empreintes, bon de suivi, reprises, traçabilité GS1/DataMatrix des lots, annulation/retour, tarification et facturation), sans jamais dériver vers un ERP lourd.

## Changement de fond : identité patient visible par défaut

Le retour terrain a invalidé la règle d'anonymisation systématique posée en V3.5.1. Le nom du patient suit désormais la commande et reste visible par défaut pour les acteurs autorisés (liste Commandes, fiche, production, Cabinet, recherche, bon imprimé) ; `patientRef` reste toujours présent comme référence technique secondaire. Une commande peut être explicitement **anonymisée** (case à cocher à la création) : dans ce cas, et uniquement dans ce cas, seul `patientRef` apparaît côté labo. Un helper unique, `displayPatient(order, context)`, centralise cette règle partout — plus aucun `if(anonymized)` dispersé dans les écrans. Le QR de production, lui, ne change pas : il n'a jamais contenu et ne contiendra jamais autre chose que `order.id`.

## Nouveautés

- **Dentistes** : annuaire `state.dentists` (compte actif ou non), sélecteur sur le formulaire de commande, invitation simulée (jamais un e-mail réel) quand le dentiste n'a pas de compte.
- **Formulaire de commande unifié** : un seul modèle de champs (Patient / Professionnel / Travail / Empreinte / Livraison / Notes) partagé par le labo (saisie manuelle) et le cabinet — plus deux formulaires qui divergent.
- **Sélecteur de dents FDI** : popup dédiée, dentition adulte complète (18-28 / 48-38), boutons réels avec `aria-pressed`/`aria-label`, sélection multiple.
- **Échéance canonique** : nouveau champ `dueAt` (ISO) posé à la création de toute commande, source de vérité pour le moteur (retards, tri, Plan de charge, filtres) ; les anciennes chaînes (« Demain », « Dans 3 jours »…) restent des libellés dérivés, jamais la source. Une commande migrée dont l'échéance texte est illisible garde `dueAt=null` et reçoit un `dataQualityFlag` — aucune date n'est jamais inventée.
- **Empreinte numérique / physique** : une commande à empreinte physique entre en « attente de l'empreinte » ; le labo confirme la réception avant de pouvoir démarrer le suivi.
- **Bon de suivi = déclencheur réel de la production** : ce n'est plus un scan à la Réception qui démarre le suivi, mais la **première impression du bon**. Une réimpression n'a jamais d'effet sur `trackingStartedAt`, seul le compteur d'impressions avance. Impossible d'imprimer tant qu'une empreinte physique attendue n'est pas confirmée reçue.
- **Reprises** : une commande livrée qui revient au labo n'est jamais recréée — même `CMD-xxxx`, historique de scans jamais effacé. Motif, étape de redémarrage et supplément optionnel sont enregistrés et apparaissent sur le bon réimprimé (« Reprise 1 », « Reprise 2 »…).
- **Lots de stock + scan GS1/DataMatrix** : `state.stockLots` (métadonnées seules, la quantité reste dérivée des mouvements de stock). Nouveau bouton « Scanner une réception » dans Stocks & achats → Stock : parseur GS1 (AI 01/10/11/17/21, format parenthésé et format brut symbologie + FNC1), détection caméra `BarcodeDetector` quand disponible, sinon douchette USB/Bluetooth ou saisie manuelle — fonctionne intégralement hors-ligne. GTIN inconnu → association explicite à un article existant, jamais un article deviné.
- **FEFO** : la consommation matière automatique (au scan) répartit désormais sur les lots par date de péremption la plus proche ; un lot expiré n'est jamais sélectionné automatiquement.
- **Annulation de commande** : sans matière consommée, la réservation disparaît simplement. Si de la matière a déjà été sortie, un retour en stock est **proposé**, jamais automatique — quantité éditable par matière, 0 accepté.
- **Catalogue de prestations + tarification** : CRUD simple (Créer/Modifier/Suspendre), tarif figé sur la commande à sa création (`priceSnapshot`), jamais recalculé rétroactivement si le catalogue change ensuite.
- **Chiffre d'affaires** : 4 compteurs sur l'Accueil (CA en production / À facturer / Facturé / Réglé), sans double comptage.
- **Module Factures** : nouvelle entrée « Factures » sous Outils (page à onglets À facturer / Factures / Prestations). Sélection de commandes livrées d'un même cabinet → facture ; cycle Brouillon → Émise → Envoyée (simulation, jamais un e-mail réel) → Réglée. Facture imprimable. Visible côté portail cabinet une fois envoyée.

## Migration V6 → V7

Toutes les données existantes (commandes, scans, messages, documents, utilisateurs, fournisseurs, mouvements de stock, commandes fournisseurs, propositions, journal, imports) sont préservées et complétées avec le jeu de champs V7. Point d'attention spécifique : une commande déjà en production avant la migration n'apparaît jamais comme « à démarrer » simplement parce qu'elle n'avait pas encore `trackingStartedAt` — le signal le plus fiable disponible (scans existants, ou état déjà Prête/Livrée) est utilisé pour reconstituer un `trackingStartedAt` cohérent.

## Tests

118 tests unitaires isolés (98 conservés de la base V3.5.1/V3.5.2 — 1 assertion mise à jour, Outils = 5 libellés au lieu de 4, pour refléter l'ajout de Factures ; 5 tests de confidentialité cabinet réécrits pour refléter le renversement de la règle d'anonymisation, sans affaiblissement — voir `DENTALFLOW_V3_6_TEST_REPORT.md` pour le détail) + 20 nouveaux tests V3.6 couvrant identité patient/anonymisation, tooth picker, empreinte physique, démarrage/réimpression du bon, dueAt canonique, migration §128, invitation dentiste, reprises, parsing GS1 (2 formats), FEFO, idempotence de consommation avec allocation de lots, annulation avec/sans consommation, immutabilité du tarif, cycle de vie facture, CA sans double comptage. Voir `DENTALFLOW_V3_6_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

StockEngine / DemandEngine / SupplierEngine / ProposalEngine (logique de décision achats), migration V5→V6, gestion fournisseurs, scan de production (QR = order.id, poste/technicien du contexte), architecture Import/Export CSV, accordéon Outils, `state.cabinetPatients` (conservé en repli de compatibilité, la commande est désormais la source canonique du nom patient).

## Explicitement exclu (hors périmètre POC)

Aucun CRM, aucun paiement Stripe réel, aucune comptabilité complète, aucun EDI, aucun backend, aucune authentification réelle, aucune signature électronique, aucun stock multi-entrepôt, aucune gestion comptable avancée.
