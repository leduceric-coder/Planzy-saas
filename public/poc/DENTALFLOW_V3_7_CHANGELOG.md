# DentalFlow Next — Changelog V3.7 « Native Operational Baseline »

Ce n'est pas un hotfix : nouvelle base de données de démonstration native (schéma V8) + plusieurs refontes fonctionnelles + mise à niveau mobile prioritaire P0. Base : `dentalflow-next-poc-v3.6.2.html`. Livrable : `dentalflow-next-poc-v3.7.html`.

## Ajouté / refondu

- **Schéma V8 natif** : nouvelle clé de stockage (`dentalflow-next-poc-state-v8`), `schemaVersion=8`. Un navigateur ayant déjà utilisé V3.6.2 ne recharge jamais silencieusement l'ancien état — premier chargement V3.7 = seed natif propre.
- **Seed unique `seedV8()`** : remplace `demoOrders`+`seedV6()`+`seedV7Scenarios()` empilés comme source de démonstration normale (ces fonctions restent présentes, inchangées, uniquement pour `resetDemoV6()` que d'anciens tests continuent d'utiliser comme baseline connue). 23 commandes, 100% avec patient nommé + `priceSnapshot`, couvrant tous les états (attente empreinte, en production, prêtes, livrées, en reprise, annulées avec/sans matière retournée, facturées à tous les stades, une commande anonymisée).
- **Filtres Commandes** : « Toutes actives » exclut désormais les commandes annulées ; nouveau filtre « Annulées » dédié. Les signaux retard/blocage s'éteignent avec la commande (annulée ou livrée).
- **Restitution de stock différée** : une commande annulée avec un solde encore retournable affiche « Matières pouvant encore être restituées » + action dédiée, réutilisant le même formulaire de retour.
- **Accueil** : KPI « Réglé » retiré (le pointage se pilote depuis Factures) ; comparaison hebdomadaire calculée depuis les `productionCompletedAt` réels (jamais un tableau statique).
- **Traçabilité** : `orderTimeline()` restitue l'histoire complète de la commande (création, empreinte, bon de suivi, scans, reprise, annulation, retour matière) avec dates/heures réelles — plus jamais « Aujourd'hui » pour un événement ancien.
- **Stock** : entrée manuelle (article/quantité/lot/fabricant/péremption/fournisseur/commentaire), fabricants (`state.manufacturers`), cycle de vie article (ACTIVE/SUSPENDED/ARCHIVED/CLOSED), table compacte avec fabricant/statut/prestations utilisatrices.
- **Article ↔ Prestation** : `state.serviceMaterials` remplace la constante `BILL_OF_MATERIALS` — une prestation créée en UI peut consommer du stock sans toucher au code, gérable depuis l'article ou la prestation.
- **Prestations** : table compacte, création réelle, gestion des matières associées.
- **Facturation** : nouvel onglet Pointage (`state.invoicePayments` append-only), paiement enregistré = règlement intégral.
- **Plan de charge** : colonne « Valeur à livrer » (€), calculée depuis les commandes réellement dues, jamais de double comptage sur une annulée.
- **Droits utilisateurs** : rôles canoniques (RESPONSABLE/PRODUCTION/STOCK/ADMINISTRATIF/LECTURE) pré-remplissant des permissions ajustables, garde-fous moteur (`can()`) sur l'entrée stock et le pointage facture — simulation fonctionnelle documentée, pas une sécurité serveur réelle.
- **Navigation mobile (P0)** : header sticky + drawer réutilisant la même source de navigation que la sidebar desktop (jamais une seconde liste hardcodée), fermeture par croix/overlay/Échap/navigation, scroll de fond verrouillé.
- **Production mobile** : accordéon vertical par poste sous 600px (le board desktop à colonnes reste inchangé) ; les cartes commande affichent désormais aussi le patient et les dents (sur les deux mises en page).
- **Commandes mobile** : cartes sous 600px en remplacement de la table à défilement horizontal.

## Tests

134 tests V3.6.2 strictement conservés + 9 tests V3.6.2 (T135-T146) + 11 nouveaux tests V3.7 = **154/154 PASS**. 1 test V3.6.2 mis à jour (jamais affaibli) car son premier chargement dépendait d'un identifiant de commande de l'ancien seed, remplacé par une fixture isolée testant exactement le même invariant. Voir `DENTALFLOW_V3_7_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

StockEngine/FEFO/retours par lot (V3.6.1/V3.6.2), scanner caméra DataMatrix, board Production desktop (drag & drop/renommage), thèmes, `schemaVersion` V7 legacy conservé pour `resetDemoV6()`.

## Limites connues (honnêtement documentées)

Par manque de temps dans le périmètre de cette mission : les tables Stock/Factures/Prestations/Fournisseurs restent en défilement horizontal sous 600px (fallback explicitement toléré par le mandat, §112) plutôt qu'une conversion complète en cartes — seule la table Commandes a été convertie. Aucune interface de changement d'utilisateur courant n'a été construite (`state.currentUserId` fixe à 'U1' en usage normal) ; les droits sont vérifiés et testés au niveau moteur comme demandé.
