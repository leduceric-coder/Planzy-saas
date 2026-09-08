# DentalFlow Next V3.8.2 — Changelog

Base : `dentalflow-next-poc-v3.8.1.html` (185/185 PASS). Livrable : `dentalflow-next-poc-v3.8.2.html`. V3.8.1 n'a jamais été modifié.

Schéma : **V10** (était V9). Migration `migrateV9toV10(state)` ajoutée à la chaîne (`migrateV6toV7→migrateV8toV9→migrateV9toV10`), déterministe, idempotente, non-destructive.

## Partie A — Entité Cabinets (schéma V10)

- Nouveau `state.cabinets[]` : `{id,name,legalName,address,postalCode,city,country,phone,email,billingEmail,siret,status:'ACTIVE'|'ARCHIVED',createdAt,archivedAt}`.
- Migration `migrateV9toV10()` : construit les cabinets à partir des noms **uniques** déjà présents dans orders/dentists/invoices/conversations ; backfille `cabinetId` sur order/dentist/invoice **sans jamais renommer ni supprimer** les champs `.cabinet` (string) historiques.
- `migrateUserNamesV10()` : dérive `firstName`/`lastName` pour tout utilisateur legacy qui n'en a encore aucun (`name` inchangé).
- Nouveaux helpers moteur : `cabinetById`, `cabinetByName`, `cabinetName`, `cabinetIsActive`, `ensureCabinetForName`, `cabinetUsageCount`, `createCabinet`, `updateCabinet`, `archiveCabinet`, `unarchiveCabinet`, `deleteCabinet` (refuse si utilisé — `IN_USE`).
- Nouvelle page **Cabinets** (Outils) : recherche, filtre Actifs/Archivés/Tous, table desktop + cartes mobile, création/édition en side-window.
- Nouvelles permissions `cabinets.view`/`cabinets.manage` (« Voir les cabinets »/« Gérer les cabinets »), accordées à ADMINISTRATIF (les deux) et LECTURE (voir seule).
- Le champ Cabinet du formulaire « Nouvelle commande » Lab passe de texte libre à `<select>` peuplé des cabinets **actifs** uniquement — un cabinet archivé reste visible sur toute commande/facture historique.

## Partie B — Fiche commande : Travail / Indications

- `order.workInstructions` devient la source canonique des indications — alimentée par le champ Notes du formulaire **Lab et Cabinet**, plus seulement le premier message de conversation.
- Nouveau bloc « Travail » (Prestation/Dents/Teinte/Empreinte) dans la fiche, juste après Patient/livraison.
- Nouveau bloc « Indications / remarques », affiché seulement si non vide.
- Bon de suivi imprimé (`printFiche`) affiche désormais aussi Dents/Teinte/Indications.
- Feedback scan Collaborateur enrichi : CMD/Patient/Prestation/Dents/Teinte/Indication (minimum métier utile, jamais la fiche admin complète).

## Partie C — Charge : fusion Demandes & simulation

- « Demandes de congés à valider » et « Simulateur What-If » **fusionnés en une seule carte** « Demandes & simulation » avec un seul tableau (Type/Collaborateur/Période/Jours/Motif/Impact capacité/Simulation/Décision-Actions).
- Demandes réelles : case « Inclure » + Approuver/Refuser. Hypothèses : « Incluse ✓ » + Supprimer. Formulaire « + Ajouter une hypothèse » déplacé dans la même carte.
- Ligne de synthèse « Impact simulé : −N commandes sur 8 semaines » + décompte des semaines en tension.
- Approuver une demande réelle transitionne toujours l'absence **et** la retire de la liste à valider (même moteur `approveLeave`).
- « Projection sur 8 semaines » et « Absences planifiées » **non touchées**, restent des sections séparées.

## Partie D — Page Utilisateurs

- `firstName`/`lastName` ajoutés au schéma (V10), dérivés de `name` si absents.
- Table desktop compacte : Prénom/Nom/Poste/Rôle/Droits/Capacité/Actions, triable par clic d'en-tête (Nom/Prénom/Poste/Rôle/Capacité).
- Filtre par permission (`<select>` peuplé de `PERMISSION_LABELS`), recherche libre nom/prénom/email/poste.
- Colonne Droits = compteur cliquable ouvrant le popup des droits complets (libellés français).
- Cartes mobile ≤390px avec les mêmes filtres/tri accessibles.

## Partie E — Aperçu de facture avant émission

- Nouveau renderer unifié `invoiceDocumentHTML(inv)` (basé sur `invoiceDocumentFields(inv)`) — utilisé par l'aperçu Lab, l'aperçu Cabinet, l'impression et le PDF, sans aucune divergence.
- Le bouton « Émettre » d'un Brouillon est remplacé par « Prévisualiser » — ouvre un aperçu plein écran du document réel.
- Actions de l'aperçu adaptées au statut : DRAFT → Fermer/Modifier la sélection/Émettre la facture ; ISSUED/SENT/PAID → Fermer/Imprimer/Télécharger PDF/Envoyer au cabinet ou Pointer selon droits.
- `issueInvoice()` appelée **uniquement** depuis le clic explicite « Émettre la facture » dans l'aperçu — plus aucun accès direct depuis la liste.
- Nouvelle fonction moteur `cancelDraftInvoice(id)` (« Modifier la sélection » — statut → CANCELLED, jamais de suppression silencieuse).

## Partie F — Portail Cabinet : factures, PDF réel, isolation

- **jsPDF 2.5.2** (MIT) embarqué inline comme 5ᵉ bloc `<script>` — aucun appel CDN au runtime.
- Nouvelle fonction `downloadInvoicePDF(id)` : génère un vrai fichier `FAC-XXXX.pdf` (en-tête binaire `%PDF-` vérifié) à partir des mêmes données que `invoiceDocumentHTML` — jamais un `window.print()` déguisé.
- Portail Cabinet : liste des factures cliquable, ouvre le document complet (View/Print/PDF uniquement — jamais modifier/émettre/pointer/annuler).
- Nouveau garde-fou **moteur** `cabinetCanAccessInvoice(invoiceId, cabinetName)` : refuse tout Brouillon et toute facture d'un autre cabinet, vérifié à chaque action (pas seulement au niveau de la liste affichée).
- `cabinetSnapshot` (déjà figé à la création dans `createInvoice`) garantit qu'une facture existante n'est jamais affectée par une modification ultérieure du cabinet.

## Partie G — Centre de notifications

- Vraie cloche 🔔 + badge complétée dans le header Lab desktop (`#notif-btn`/`#notif-count`, déjà référencés en JS mais jamais rendus) et un équivalent mobile compact (`#notif-btn-mobile`/`#notif-count-mobile`, visible ≤860px uniquement).
- Nouvelle fonction `buildNotificationFeed()` : fusionne les notifications persistées non lues (NEW_ORDER/NEW_MESSAGE/ORDER_UPDATE) avec des situations dérivées en direct (commande en retard/bloquée, stock critique, achat BLOCKED/ORDER_NOW, congé en attente) sous une clé stable par objet métier — aucun double comptage.
- Nouvelle side-window Notifications avec les 7 filtres Toutes/Commandes/Messages/Production/Stock/Achats/RH.
- Chaque ligne ouvre l'objet concerné et marque la notification lue le cas échéant ; une situation dérivée disparaît automatiquement une fois résolue.

## Partie H — Correction P0 : formulaire Cabinet perd Nom/Prénom (CRITIQUE)

- **Cause racine éliminée** : `renderDentistMode()` (reconstruction complète du formulaire) n'est plus jamais appelée sur changement de Prestation/Empreinte/Date de livraison.
- Nouveau `state.dentistOrderDraft` (via `ensureDentistOrderDraft()`/`resetDentistOrderDraft()`) : source de vérité UI persistante du formulaire, mise à jour à chaque frappe, réinitialisée uniquement après création réussie.
- Bascule DIGITAL↔PHYSICAL : touche uniquement `impressionMode` + visibilité pièces jointes/message explicatif.
- Changement de date proposée : met à jour uniquement la sélection visuelle du groupe.
- Changement de Prestation : recalcule les dates via `updateDentistDeliveryZone()`, remplace uniquement la zone des dates, jamais le formulaire entier.
- Reproduction exacte du terrain (§65) vérifiée : Marie/Dupont/Couronne zircone/A2/dent 14/date puis PHYSIQUE puis soumission → commande créée correctement, aucune erreur « Nom/Prénom requis ».

## Partie I — États visuels des commandes

- Nouvelle fonction `orderVisualState(o)` : priorité stricte En retard > Bloquée > Nouvelle > Prête à livrer > En production > Livrée > Annulée.
- Classe `ovs-<état>` appliquée aux lignes du tableau Commandes et aux cartes mobile — fond légèrement teinté + barre gauche colorée, jamais la couleur seule (le pill de statut et le badge NOUVEAU restent toujours présents).
- Le badge « NOUVEAU » (notification non lue) coexiste avec la couleur d'état primaire ; une commande en retard et nouvelle affiche le rouge en priorité, badge NOUVEAU conservé jusqu'à l'ouverture.

## Correction annexe

- `serializableState()` (export JSON / restauration avancée) n'incluait pas `state.cabinets` — corrigé pour que l'entité Cabinets survive à un export/import complet.

## Tests et non-régression

- **53 nouveaux tests** ajoutés à la suite persistée (`?runTests=1`) : C01-C04, U01-U05, CAB01-CAB07, O01-O05, F01-F06, FC01-FC05, N01-N08, D01-D07, V01-V07.
- **1 test V3.8.1 réécrit** (changement de comportement explicite du mandat — ajout de la page Cabinets à la navigation Outils), documenté comme extension stricte jamais un affaiblissement.
- 185 tests V3.8.1 strictement conservés + 53 nouveaux = **238/238 PASS**, isolation confirmée (export JSON identique avant/après la suite complète).
- Responsive : 28/28 (7 viewports × 4 modes). Thèmes : 12/12. `node --check` : 5/5 blocs `<script>` OK. 0 erreur console sur l'ensemble des vérifications.

## Non-régression (Partie J)

Toutes les fonctionnalités V3.8.1 sont conservées inchangées : `repairLegacyTraceabilityV9`, `repairLegacyLifecycleDates`, `orderTimeline`, la fusion démarrage/Réception, l'invariant « aucun Scan Réception », les cycles de reprise, la localisation manuelle, `moveOrderToStage` et les garde-fous moteur associés — aucun n'a été modifié.

## Hors périmètre (§89)

Aucun ajout de Supabase, Vercel, backend, Stripe, TVA/comptabilité réglementaire, CRM, email/SMS réel.
