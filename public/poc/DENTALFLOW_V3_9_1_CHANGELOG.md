# DentalFlow V3.9.1 — Changelog

**Base :** `dentalflow-next-poc-v3.9.0.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.1.html`
**Mandat :** Hotfix ciblé — menu contextuel « […] » de la fiche commande
**schemaVersion :** 10 (inchangé)

Correctif exclusivement CSS. Aucune modification métier, aucun changement de workflow,
de permission, d'état de commande ni de `schemaVersion`. Aucun nouveau système de menu
créé — le mécanisme historique `data-row-menu`/`data-row-menu-pop`/`pop.hidden=!pop.hidden`
(V3.8.3 Partie D) reste l'unique source de vérité de l'état ouvert/fermé.

## Corrigé

- **Menu « […] » de la fiche commande affiché en permanence.** La règle
  `.df-menu{display:flex}` introduite en V3.9.0 est une déclaration d'origine auteur, qui
  l'emporte toujours sur la règle `[hidden]{display:none}` de la feuille de style de
  l'agent utilisateur — le popover du menu restait donc rendu et visible dès l'ouverture
  de n'importe quelle fiche commande, sans qu'aucun clic n'ait eu lieu, et ne pouvait
  jamais être refermé (y compris après le clic extérieur, qui repasse pourtant bien
  `hidden=true`). Corrigé en retirant `display:flex` de la règle générique `.df-menu` et
  en le déplaçant dans `.df-menu:not([hidden])` : quand l'attribut `hidden` est présent,
  plus aucune règle auteur ne cible `.df-menu`, et `[hidden]{display:none}` de la feuille
  agent utilisateur s'applique normalement.
- **Débordement des libellés « Bloquer la commande »/« Annuler la commande ».** Dans le
  même composant, la spécificité de `.row-menu-pop button` (règle historique, 0-1-1)
  l'emportait sur `.df-menu-item` (0-1-0), annulant son `display:flex`/`gap`/
  `align-items` et forçant une hauteur fixe de 38px alors que le libellé sur deux mots
  nécessitait 43px. Sélecteur remonté en `.row-menu-pop .df-menu-item` (0-2-0, gagne
  désormais) et `height` remplacé par `min-height` pour rester robuste à un libellé plus
  long à l'avenir.

## Non-régression

- 367/367 tests persistés PASS (360 hérités de V3.9.0 + 7 nouveaux : MENU01-06 et le test
  de garde permanent DSMENU01), dont les 360 tests V3.9.0 conservés sans aucune
  modification de leur code.
- **DSMENU01** (garde Design System permanente) : vérifie que tout
  `[data-row-menu-pop][hidden]` de l'application (fiche commande, Stock, Charge) est
  réellement `display:none`, pour empêcher qu'une future classe CSS ne réintroduise ce
  bug sur ce composant ou un autre.
- Les 3 autres menus contextuels `.row-menu-pop` de l'application (Stock « Réceptionner »,
  Stock « […] », Demandes & simulation « […] ») n'étaient pas affectés (ils n'ont jamais
  porté la classe `.df-menu`) — revérifiés fermés par défaut, ouverture au clic, fermeture
  au clic extérieur : comportement inchangé.
- 4 scripts Playwright hérités de V3.8.8 (interaction réelle DOM) rejoués contre V3.9.1 :
  0 échec, 0 erreur console. Le script de la Partie A a nécessité une mise à jour non
  fonctionnelle (ouvrir le menu « […] » avant de cliquer sur « Bloquer »/« Commentaire »/
  « Reprise », puisque ces actions sont désormais dans ce menu depuis V3.9.0) — le
  correctif V3.8.8 (clic dans un textarea ne ferme jamais le panneau) reste intact,
  vérifié via ce nouveau chemin d'interaction réel.
- Responsive 21/21, thèmes light/dark/system 18/18, isolation JSON identique avant/après
  suite complète.
- `node --check` PASS sur les 5 blocs `<script>`.
- Zéro erreur console sur l'ensemble des scénarios testés (light et dark).
