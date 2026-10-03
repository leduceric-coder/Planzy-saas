# DentalFlow V3.12.1 — Rapport d'implémentation

Lot correctif UX Espace Cabinet + nouveau kit de test laboratoire bâti exclusivement sur le corpus réellement
importé, construit à partir de la baseline fonctionnelle `dentalflow-next-poc-v3.12.0.html` (frozen, inchangée).

## BUGS_CORRIGES

1. **Bouton « Nouveau message » invisible sous 860px.** Cause racine reproduite par interaction navigateur
   réelle (`getComputedStyle`) : le bouton réutilisait la classe partagée `.primary`, dont la variante mobile
   (`@media(max-width:860px)`) est pensée exclusivement pour le bouton FAB de la topbar Labo
   (`font-size:0;width:46px;padding:0`, avec un `<span>` interne qui restaure la taille d'icône — structure que
   le bouton Cabinet n'a jamais eue). Corrigé par une classe dédiée `.cab-primary-btn`, indépendante de
   `.primary`, jamais affectée par la mobile de la topbar Labo.
2. **Carte « Messages » redondante en mode composition.** `dentistMessagesHTML()` affichait une carte « Messages »
   avec son propre bouton « Nouveau message » AU-DESSUS du formulaire « Nouveau message » (qui porte déjà son
   propre « Nouveau message » / « Annuler »). Corrigé : une seule carte principale en mode composition.
3. **`migrateUsers()` réinjecte les profils de démonstration à chaque démarrage du kit.** Découvert pendant
   l'intégration du kit (non lié au produit V3.12.1 lui-même, qui n'a jamais été modifié) : `load()` (script de
   base) appelle inconditionnellement `migrateUsers(s.users)`, laquelle réinjecte tout profil `demoUsers` absent
   du state persisté, quel que soit le schemaVersion — pensée pour faire apparaître un nouveau profil de
   démonstration ajouté au code plus tard, pas pour un kit qui exclut délibérément ces profils. Corrigé par un
   script additif propre au kit, s'exécutant après le bloc « implementation » (jamais entre le script de base et
   l'IIFE, où un `save()` prématuré — avant exposition de `window.v34Save` — écrirait une persistance V5
   incomplète, silencieusement privée des cabinets/dentistes/prestations/fournisseurs/articles importés).

## AMELIORATIONS_UX

1. **Affordance de défilement explicite sur la rangée d'onglets Cabinet** sous 600px : fondu en dégradé sur le
   bord droit au lieu d'une coupure nette.
2. **Grille de messagerie Cabinet dédiée** (`.cab-message-layout`), colonne Conversations élargie (260–320px au
   lieu de 190px), en-tête empilé verticalement — ne chevauche jamais le bouton. Bascule en une seule colonne
   sous ~900px plutôt que de forcer deux colonnes étroites.
3. **Formulaire « Nouveau message » restructuré** (`.dentist-message-form`) : espacements verticaux de 22px entre
   groupes fonctionnels, « Associer à une ou plusieurs commandes » en bloc visuellement distinct avec défilement
   interne, bouton Envoyer visuellement séparé du bloc pièces jointes.

## NOUVELLE_FONCTION_METIER

Aucune — ce lot est un correctif UX + packaging, sans nouvelle fonction métier côté produit. Côté outillage de
recette : nouveau kit de test laboratoire bâti sur un principe d'identification des fixtures par identifiant
(capturé sur un boot neuf, dans la même session navigateur que l'import réel), réutilisable pour de futures
séances de recette sans dérive liée à des identifiants générés aléatoirement d'un boot à l'autre.

## KIT_DE_TEST — Synthèse de construction

1. **Identification des fixtures** : boot neuf de `dentalflow-next-poc-v3.12.1.html`, capture des identifiants
   `cabinets/dentists/users/services/suppliers/articles` AVANT tout import, dans la session qui exécute ensuite
   l'import réel (élimine toute ambiguïté liée aux identifiants de cabinet générés aléatoirement).
2. **Import réel** : mêmes 6 fichiers CSV déjà validés (`cabinets_test.csv`, `dentistes_test.csv`,
   `utilisateurs_test.csv`, `prestations_test.csv`, `fournisseurs_test.csv`, `inventaire_test.csv`), mêmes étapes,
   même mapping de pôles, même procédure de qualification par lot des 3 prestations confirmées — rien n'a été
   réinventé, le mandat de « réutiliser la baseline d'import déjà validée » est honoré en rejouant la procédure
   déjà validée sur la nouvelle version du produit plutôt qu'en tentant de réparer un état déjà fusionné d'une
   version antérieure (dont le diagnostic a révélé des identifiants de cabinet non reproductibles d'un boot à
   l'autre).
3. **Filtrage** : chaque entité dont l'identifiant n'appartient pas à l'ensemble de fixtures capturé à l'étape 1
   est retenue ; les relations dépendantes (articleSuppliers, stockLots, stockMovements, servicePriceOverrides,
   manufacturers) sont filtrées par cohérence avec les entités retenues, jamais par une seconde logique
   indépendante. Compteurs finaux vérifiés exacts pour cabinets/dentistes/utilisateurs/articles ; 2 écarts
   diagnostiqués avec leur cause exacte pour services/fournisseurs (voir TEST_REPORT), validés avec le
   laboratoire avant intégration.
4. **Nettoyage transactionnel** : toutes les données de démonstration transactionnelles (commandes, conversations,
   messages, notifications, documents, scanEvents, locationEvents, historyEvents, factures, paiements,
   PurchaseOrders, PurchaseProposals, absences, congés) retirées — aucune trace de stock importé perdue.
5. **10 commandes fictives** construites via le moteur réel (`createOrder`, `ensureReceptionLocation`,
   `moveOrderToStage`), chronologie backdatée via `Clock.mode='demo'` posé et restauré autour de chaque appel
   moteur (jamais une horloge globale laissée en mode démo), garantissant que `productionCompletedAt` et chaque
   `LocationEvent` restent cohérents entre eux. Patients fictifs dans le store Cabinet dédié
   (`cabinetPatients`), jamais dans `state.orders` (patientRef opaque, règle de confidentialité V3.10.3.6
   intégralement maintenue).
6. **Bootstrap autonome** : même principe que le kit V2 (clé localStorage dédiée, amorçage au premier lancement
   uniquement, mode observateur, exception `?runTests=1`), plus le correctif `demoUsers` additionnel décrit
   ci-dessus.

## Décision finale

**`READY_FOR_SECOND_LAB_TEST`**

Justification : le bug racine du bouton « Nouveau message » invisible est corrigé et vérifié par reproduction
AVANT/APRÈS ; 10/10 tests CABUX ciblés et 36/36 captures visuelles réelles sur 6 largeurs confirment l'absence de
chevauchement, de débordement et d'élément superposé sur l'ensemble des écrans Cabinet. Le kit de test
laboratoire contient exactement les données réellement importées (deux écarts mineurs diagnostiqués avec leur
cause exacte et validés avec le laboratoire plutôt que masqués), 10 commandes fictives cohérentes réparties selon
le mandat, un stock strictement inchangé par ces fixtures, et une persistance/reset vérifiés par interaction
navigateur réelle (F5, fermeture/réouverture simulée, reset observateur). 468/468 ×3, NAVDOM 31/31, UI CLICK
16/16 et confidentialité patient (0 fuite sur 16 surfaces) confirmés à la fois sur le fichier produit et sur le
kit lui-même. `dentalflow-next-poc-v3.12.1.html` strictement inchangé (MD5 identique) tout au long de ce travail.
Seule réserve inchangée : QR04 (caméra réelle sur smartphone) reste à vérifier physiquement lors de la séance.
