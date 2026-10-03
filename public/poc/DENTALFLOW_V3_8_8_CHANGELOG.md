# DentalFlow V3.8.8 — Changelog

**Base :** V3.8.7 (conservée intacte) · **schemaVersion :** 10 (inchangé)

Hotfix strictement scopé — aucune fonctionnalité V3.8.7 (commentaires de commande, empty-state
Accueil, moteur de pulse Simulation, calendrier Absences planifiées) n'a été réimplémentée ni son
comportement modifié en dehors des 4 points ci-dessous.

## Corrigé

- **P0 — Collision `data-order` sur formulaires latéraux** : un clic dans le textarea du motif de
  blocage (ou du commentaire) fermait le panneau latéral au lieu de permettre la saisie, à cause
  d'un `<form data-order="...">` interprété à tort par le routeur de clic global comme une demande
  d'ouverture de fiche. Corrigé par renommage sémantique des attributs porteurs
  (`data-block-order-id`, `data-comment-order-id`, `data-rework-order-id`, `data-cancel-order-id`)
  — aucun `stopPropagation` utilisé. Audit complet du fichier : 4 formulaires concernés, tous
  corrigés, 0 collision restante.
- **KPI Factures sur 2 lignes en desktop** : les 4 cartes KPI de la page Factures réutilisaient
  `.stock-kpis` (3 colonnes), provoquant un retour à la ligne (3+1). Nouvelle classe
  `.invoice-kpis` : 4 colonnes ≥900px, 2×2 en tablette, 1 colonne en mobile — aucune valeur
  affichée modifiée.

## Ajouté

- **Statut de semaine visible en permanence** dans le calendrier Simulation : le badge affiche
  désormais le texte du statut (ex. « Tendu ») coloré en plus du point, au lieu d'un simple
  `title` invisible sans survol. Le pulse anime désormais l'ensemble du badge (texte + point)
  ensemble, sans toucher au moteur de détection de changement (`snapshotScenarioMetrics()`/
  `pulseScenarioChanges()` inchangés).
- **Popup jour « Absences planifiées »** : cliquer (ou activer au clavier) une cellule du
  calendrier ayant au moins une absence approuvée ouvre une popup centrale lecture seule listant
  toutes les personnes absentes ce jour — réutilise le système d'animation central existant
  (`openModalAnimated`), aucun nouveau système créé. Fermeture par Échap généralisée à toute popup
  basée sur `quick-layer`.
- **Détail dépliable des absences** : liste `<details>` collapsée par défaut sous le calendrier,
  affichant toutes les absences approuvées de l'horizon 8 semaines triées par date de début, avec
  compteur exact dans le résumé.
- **`approvedAbsencesInHorizon(weeks)`** et **`approvedAbsencesForDay(dateStr)`** : dérivées de
  `approvedAbsences()` (V3.8.7, inchangée), source unique partagée par le calendrier, la popup et
  le détail dépliable — jamais de calcul indépendant. Construction de date locale (pas de parsing
  UTC) pour éviter tout décalage de jour civil selon le fuseau.
- **`absenceCardHTML(absence, showValidated)`** : mini-carte de rendu unique réutilisée par la
  popup et le détail dépliable.

## Non-régression

- 347/347 tests persistés PASS (335 hérités + 12 nouveaux), dont les 335 tests V3.8.7 conservés
  sans aucune modification de leur code.
- 4 scripts Playwright dédiés (interaction réelle DOM : clics, saisie, clavier, redimensionnement)
  confirmant les 4 parties, 0 échec, 0 erreur console.
- Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite complète.
- Zéro erreur console sur l'ensemble des scénarios testés.
