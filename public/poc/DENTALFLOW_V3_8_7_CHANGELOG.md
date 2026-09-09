# DentalFlow V3.8.7 — Changelog

**Base :** V3.8.6 (conservée intacte) · **schemaVersion :** 10 (inchangé)

Correctif ciblé — aucune fonctionnalité V3.8.6 (moteur Simulation/Projection, DFSelect, blocage de
commande, calendrier du scénario, animations de pop-ups) n'a été réimplémentée ni son comportement
modifié.

## Ajouté

- **Commentaires de commande** : parcours complet clic → saisie → validation → persistance →
  affichage immédiat → conservé au rechargement. `addOrderComment(orderId, text)` (append-only
  dans `state.historyEvents`, type `'Commentaire'`, jamais confondu avec `order.workInstructions`),
  bloc « Commentaires » toujours visible dans la fiche avec liste triée du plus récent au plus
  ancien, panneau « Ajouter un commentaire » réutilisant le panneau latéral existant.
- **Accueil — empty-state « À surveiller »** : quand aucune commande n'a besoin d'attention,
  affichage centré et rassurant (« Tout est sous contrôle ! ») au lieu d'un espace vide.
- **Simulation — pulse ciblé** : les jours et semaines qui changent réellement suite à une action
  sur le scénario (tester/retirer une demande, ajouter/modifier/supprimer une hypothèse) pulsent
  brièvement (2-3 pulsations, ~1.5s), jamais en boucle infinie, jamais sur ce qui n'a pas changé.
  Respecte `prefers-reduced-motion`.
- **Absences planifiées — calendrier** : remplace l'ancienne liste par le même calendrier visuel
  que la Simulation, limité aux absences réellement validées (jamais de demande en attente, jamais
  d'hypothèse), sans statut de semaine ni pulse.
- **`approvedAbsences()`** : source canonique unique des absences validées, avec déduplication
  stricte contre les demandes de congés déjà matérialisées en absence.
- **`leaveCalendarHTML({mode, weeks, leaves, showWeekStatus, animate})`** : renderer calendrier
  unique, réutilisé par la Simulation (`mode:'simulation'`, comportement V3.8.6 strictement
  inchangé) et par Absences planifiées (`mode:'approved'`).

## Supprimé

- L'affichage liste `.abs-list`/`.abs-row` des absences planifiées et `deleteAbsence()` (devenus
  inutilisés une fois remplacés par le calendrier). Le bouton « + Absence » (création) est
  conservé.

## Non-régression

- 335/335 tests persistés PASS (317 hérités + 18 nouveaux), dont les 317 tests V3.8.6 conservés
  sans aucune modification de leur code.
- Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite complète.
- Zéro erreur console sur l'ensemble des scénarios testés.
