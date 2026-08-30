# DentalFlow Next — Changelog V3.5.1

Hotfix UX ciblé suite à un audit indépendant de la V3.5. Aucune modification du moteur (StockEngine/DemandEngine/SupplierEngine/ProposalEngine) — gestion fournisseurs, accordéon Outils et architecture Import/Export V3.5 non retouchées.

## Corrigé

- **Une carte « À traiter » = une PurchaseProposal**, plus jamais une carte par article : le montant affiché et celui du bouton (« Commander XXX € ») correspondent désormais exactement au montant de la `PurchaseOrder` réellement créée au clic — aucune ambiguïté possible entre ce qui est vu et ce qui est engagé.
- **Article réellement déclencheur** : seule la ligne dont la propre `lastSafeOrderAt` est dépassée est marquée « Urgent » ; une proposition WAIT n'affiche jamais de fausse urgence article par article.
- **`renderStockSupply()` est redevenu un pur render** : `reconcileProposals()` a été retiré de l'affichage de la page. Le simple fait de consulter Stocks & achats ne crée plus d'`ActivityEvent` « Recommandations recalculées » ; le recalcul reste déclenché uniquement après une vraie mutation métier.
- **Journal enrichi** : recherche texte, filtre période (7/30/90 jours/Tout, défaut 30 jours), pagination légère au-delà de 50 événements — toujours sur la même source unique `state.activityEvents`.
- **Wizard Données** : le défilement de la page en arrière-plan est verrouillé pendant que l'assistant Import/Export est ouvert (mobile inclus), le wizard lui-même reste scrollable.

## Finitions

- **Stabilité visuelle** : `scrollbar-gutter: stable` élimine le saut horizontal entre onglets (Commandes, Stocks & achats, Rapports) causé par l'apparition/disparition de la scrollbar — 0px de déplacement mesuré aux 4 largeurs.
- **Espacement des actions** des cartes « À traiter » (gap 8px→12px) et **padding des boutons secondaires** (« Détail » et autres, qui n'avaient aucun padding propre) — plus de texte collé au bord.
- **Filtres « À traiter »** (fournisseur, échéance, action) : purement UI, aucune mutation métier, réinitialisation et état vide explicite.
- **Menu Outils raccourci** : Charge / Stock / Rapports / Utilisateurs — le titre de la page « Stocks & achats » et les routes internes restent inchangés.

## Tests

77 tests unitaires isolés (65 conservés de la V3.5 — 2 mis à jour pour refléter les nouveaux libellés/le nouveau filtre demandés par ce hotfix, sans affaiblissement — + 10 nouveaux couvrant chacun des points ci-dessus via le moteur réel). Stabilité visuelle et verrouillage de scroll mobile vérifiés par mesure réelle en navigateur. Voir `DENTALFLOW_V3_5_1_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

StockEngine, DemandEngine, SupplierEngine, ProposalEngine, `receivePurchaseOrder`, migration V5→V6, persistance, gestion fournisseurs (création/modification/suspension/réactivation/tarifs), accordéon Outils, architecture Import/Export.
