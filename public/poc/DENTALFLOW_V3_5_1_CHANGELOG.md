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

---

## Addendum — Horloge temps réel & confidentialité patient cabinet

Ajouté au micro-hotfix V3.5.1 avant l'audit final (pas de nouvelle version). Aucune modification des moteurs métier ; architecture générale inchangée.

### Corrigé

- **Horloge réelle par défaut** (`Clock.mode:'real'`, était `'demo'` figé sur 2026-08-21) : le démonstrateur ne montre plus de recommandations déjà expirées quel que soit le jour d'ouverture. Le mode démo/figé reste disponible, réservé aux tests qui ont besoin d'un « maintenant » déterministe.
- **Dates d'affichage des commandes de démo** (`demoOrders.due`, `addUrgentZirconeOrder`) : les 7 échéances codées en dur (« 26 août », « 27 août », « 18-20 août »…) sont remplacées par du texte relatif (Après-demain / Dans N jours / Il y a N jours / Hier) — le tableau Production/Commandes reste cohérent indéfiniment. Le moteur d'achats (`lastSafeOrderAt`/`stockoutAt`/seed articles/fournisseurs) était déjà entièrement relatif — rien à corriger côté engine.
- **Accueil** : sous-titre daté dynamiquement (« … — dimanche 30 août 2026 »), calculé via `Clock.now()` en `fr-FR`.

### Ajouté

- **`state.cabinetPatients`** : store cabinet privé (prénom/nom du patient), séparé physiquement de `state.orders` — qui continue de n'exposer que `patientRef` (opaque, inchangé). Jamais inclus dans `serializableState()`/`exportDentalFlowJSON()`/persistance labo ; persistance dédiée (`dentalflow-cabinet-patients-v1`).
- **Formulaire cabinet « Nouvelle commande »** : champs Prénom/Nom du patient, note de confidentialité. « Mes commandes » et le détail cabinet affichent le nom en avant, la référence DentalFlow (`patientRef`) en discret.
- Isolation inter-cabinets : un cabinet ne peut jamais voir le nom saisi par un autre (garde explicite + filtrage déjà existant par cabinet).

### Non touché — confidentialité

Recherche labo, Journal/`activityEvents`, messages auto-générés vers le labo, tous les écrans labo (Accueil, Commandes, Production, Messages, Charge, Stocks, Rapports, Recherche, fiches imprimées) : aucun ne lit `cabinetPatients`, aucun ne peut donc exposer le nom d'un patient — vérifié par 16 nouveaux tests unitaires + un scénario navigateur réel bout-en-bout (création cabinet → bascule cross-cabinet → reload → recherche labo → export JSON).

### Tests

88 tests unitaires isolés (77 conservés de la V3.5.1 initiale — 3 ajustés pour figer explicitement `Clock.mode` sur leur date de conception, sans affaiblissement, l'horloge n'étant plus figée par défaut — + 11 nouveaux). Suite complète re-vérifiée : isolation (export JSON identique avant/après), responsive 16/16, 0 erreur console, audit hardcoding de dates. Scénario navigateur réel dédié pour l'horloge temps réel et la confidentialité cabinet (contexte frais, sans état persisté, exécuté un dimanche pour exposer un éventuel biais de jour de semaine). Voir `DENTALFLOW_V3_5_1_TEST_REPORT.md`.
