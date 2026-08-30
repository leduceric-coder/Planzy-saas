# DentalFlow Next — Changelog V3.5

Évolution UX simplification & gestion fournisseurs. Aucune refonte moteur — les invariants Stocks/Achats/Fournisseurs de la V3.4.5 restent inchangés et intégralement retestés.

## Navigation

- **Accordéon « Outils » réparé** : `state.toolsOpen` est désormais l'unique source de vérité (le bug qui rouvrait le groupe à chaque `render()` dès qu'une page enfant était active est corrigé). Chevron `›`/`⌄`, `aria-expanded`, indicateur discret de page enfant active quand fermé.
- **Menu Outils simplifié** : Plan de charge / Stocks & achats / Rapports / Utilisateurs uniquement. Les entrées autonomes « Achats » et « Journal » ont disparu — leurs anciennes routes redirigent silencieusement (Achats → Stocks & achats/À traiter, Journal → Rapports/Journal).

## Stocks & achats

- Fusion des anciennes pages Stocks et Achats en une seule vue à 4 onglets : **À traiter** (vue par défaut, une carte = une décision, langage naturel, aucun code moteur affiché), **Stock**, **Commandes** (statuts traduits, montant affiché), **Fournisseurs**.
- Panneau **« Pourquoi ? »** enrichi : c'est désormais le seul endroit où stock physique/réservé/disponible/entrant, franco, minimum fournisseur et fournisseur préféré vs recommandé sont détaillés.

## Fournisseurs

- Gestion complète : création, modification, suspension, réactivation. **Jamais de suppression** (historique préservé).
- Nouveaux champs optionnels (contact, email, téléphone, site web), persistés dans `state.suppliers` existant.
- Édition de tarifs (`ArticleSupplier`) avec respect strict de l'invariant « un seul fournisseur préféré actif par article ».

## Rapports

- Fusion avec l'ancienne page Journal (supprimée en tant qu'entrée autonome) : onglets **Indicateurs** et **Journal**, un seul journal logique sur `state.activityEvents`.

## Données (Import/Export)

- Écran initial simplifié : « Importer des données » / « Exporter des données » uniquement.
- Parcours d'import guidé en 6 étapes (Type/Fichier/Correspondances/Aperçu/Vérification/Résultat), une action primaire par étape, mapping automatique résumé (colonnes à corriger mises en avant si nécessaire).
- Export présenté par catégories métier (icône + description + téléchargement).
- Export/restauration JSON complet relégués sous « Options avancées », avec avertissement avant restauration.

## Tests

67 tests unitaires isolés (46 conservés de la V3.4.5, aucune assertion affaiblie + 21 nouveaux couvrant l'accordéon, la navigation, les redirections, la gestion fournisseur, « À traiter »/« Pourquoi ? »/« Commander », Rapports/Journal et l'UX Import/Export). Persistance des nouveaux champs fournisseur vérifiée par rechargement à froid réel. Responsive 16/16, thèmes clair/sombre/système conformes, 0 erreur console. Voir `DENTALFLOW_V3_5_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

StockEngine, DemandEngine, SupplierEngine (`evaluateSupplierCandidate`, `chooseSupplier`), ProposalEngine (`computeNeeds`, `decideProposal`, `reconcileProposals`, `approveProposal`), migration V5→V6, persistance, `receivePurchaseOrder`, confidentialité patient.
