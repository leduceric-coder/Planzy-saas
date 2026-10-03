# DentalFlow V3.8.6 — Changelog

**Base :** V3.8.5 (conservée intacte) · **schemaVersion :** 10 (inchangé)

## Corrigé

- **KPI Accueil** : une commande annulée n'apparaît plus jamais dans « En production »,
  « À livrer aujourd'hui », « En retard » ou « Bloquées » — exclusion immédiate, sans rechargement
  (`getDistributionBucket`, `kpiCounts`, `operationalOrders`, `isScanExpected`).
- **Icône notification Messagerie** : affiche désormais une vraie icône de bulle de message au lieu
  du glyphe générique « i » (`notifIcon`, ajout de la clé `message` dans `icon()`).
- **Cohérence Simulation/Projection (Charge)** : la Simulation What-If utilisait un carnet de
  commandes synthétique (`ORDER_BOOK`) différent des commandes réelles de la table Projection,
  produisant des « semaines en tension » incohérentes. Le simulateur utilise désormais exactement
  la même source de charge réelle (`weekChargeToDeliver`) et les mêmes seuils d'occupation
  (`weekLoadStatus`, 90 %/100 %) que la Projection — `ORDER_BOOK`/`buildOrderBook`/`weekForecast`
  supprimés du moteur.

## Ajouté

- **Composant DentalFlowSelect (DFSelect)** : tous les menus déroulants de l'application ont
  désormais une apparence DentalFlow cohérente (bouton stylé, popover animé, coche de sélection),
  entièrement accessible au clavier (ARIA combobox/listbox/option), sans réécriture d'aucune
  logique métier existante — le `<select>` natif reste la source de vérité.
- **Blocage manuel d'une commande** : un manager peut bloquer une commande avec un motif
  obligatoire (`blockOrder`), afficher le motif/l'auteur/la date dans la fiche, et lever le blocage
  (`unblockOrder`) — historique tracé, KPI Bloquées mis à jour immédiatement.
- **Calendrier du scénario toujours visible** : plus besoin de cliquer sur « Voir le calendrier » —
  le calendrier des 8 prochaines semaines s'affiche directement, groupé par mois, avec jours
  simulés visuellement distincts (bordure + avatar) selon leur type (demande testée / hypothèse /
  absence planifiée) et un indicateur de tension par semaine dérivé du même moteur que la
  Projection.
- **Animations d'ouverture/fermeture des pop-ups centrales** : `quick-layer`, `tooth-picker-layer`,
  `form-modal` et `pdetail-layer` (portail Dentiste) s'ouvrent et se ferment désormais avec une
  transition douce (fondu + léger zoom), jamais un affichage/effacement instantané — respecte
  `prefers-reduced-motion`.

## Supprimé

- Les deux vignettes « Impact du scénario » / « N semaines en tension » sur la page Charge,
  remplacées par un résumé compact en une ligne.
- Le bouton « 📅 Voir le calendrier du scénario » (le calendrier est désormais toujours visible).
- Le carnet de commandes synthétique `ORDER_BOOK` et les fonctions `buildOrderBook()`/
  `weekForecast()` (devenus totalement inutilisés une fois la Partie E/G appliquée).

## Non-régression

- 317/317 tests persistés PASS (297 hérités + 20 nouveaux).
- Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite complète.
- Zéro erreur console sur l'ensemble des scénarios testés.
