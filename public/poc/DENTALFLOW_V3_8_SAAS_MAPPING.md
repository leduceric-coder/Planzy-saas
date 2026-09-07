# DentalFlow Next V3.8 — Audit Pre-SaaS (mapping structurel)

**Portée explicite** : ce document mappe chaque structure locale (POC monolithique, `localStorage`) vers sa future table/entité SaaS (Supabase/Postgres pressenti). **Aucun SQL, aucun DDL, aucun schéma de migration technique** — uniquement structure, relations, cardinalités, source de vérité et risques de migration. Le SaaS devra **connecter** ce modèle métier, jamais le réinventer.

## Principe général de migration

Chaque store `state.X` (tableau/objet JS en mémoire, sérialisé dans une seule clé `localStorage`) devient une table dédiée. Les identifiants actuels (`CMD-0001`, `NOTIF-xxxx`, générés côté client par `randToken`/compteur) devront devenir des UUID générés côté serveur — les préfixes lisibles (`CMD-`, `CONV-`, `NOTIF-`) peuvent être conservés comme convention d'affichage (colonne `display_id` ou équivalent) sans être la clé primaire technique.

## Commande et cycle de vie

| Local (`state.X`) | Table SaaS pressentie | Relation / cardinalité | Source de vérité | Risque de migration |
|---|---|---|---|---|
| `state.orders[]` | `orders` | 1 labo (implicite, POC mono-tenant) → N commandes ; 1 cabinet → N commandes ; 1 dentiste (nullable) → N commandes | Champ métier posé une fois (`priceSnapshot` figé à la création, jamais recalculé) | **Faible-Moyen** : `createdAt`/`deliveredAt`/`cancelledAt` nouvellement introduits en V3.8 doivent exister nativement ; `priceSnapshot` (copie figée, jamais une référence vivante vers `services`) doit être un JSON/JSONB, pas une clé étrangère |
| `order.reworks[]` (imbriqué) | `order_reworks` | N reprises → 1 commande | `restartStageId`, `priceAdjustment`, `status` | Faible — extraction directe d'un tableau imbriqué vers une table liée |
| `state.stageDefinitions[]` | `stage_definitions` (probablement par labo/tenant en SaaS) | 1 labo → N postes (ordonnés) | `order` (position), `scannable` (bool) | Faible |

## Localisation (nouveau en V9)

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.locationEvents[]` | `order_location_events` | N événements → 1 commande ; `stageId` → FK `stage_definitions` ; `actorId` → FK `users` (nullable, SYSTEM) | **Unique source de la localisation courante** — le SaaS ne doit jamais dériver la position d'un "dernier scan" séparé | **Faible** : modèle déjà append-only, pensé pour un stockage relationnel dès la conception V3.8. Le `source` enum (`SYSTEM`/`SCAN`/`MANUAL`) doit être conservé tel quel — il porte la distinction d'affichage "Scan X" vs "Déplacement manuel vers X" |
| `state.scanEvents[]` (legacy, conservé) | `order_scan_events` (historique, lecture seule) | N scans → 1 commande | Repli historique uniquement pour les commandes migrées sans `locationEvents` | **Migration ponctuelle requise** : au passage SaaS, chaque `scanEvent` legacy devra être converti en un `location_event` équivalent (`source:'SCAN'`) — logique déjà écrite et testée côté client (`migrateV8toV9`), réutilisable comme script de migration serveur |

## Stock

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.articles[]` | `articles` | 1 fabricant (nullable) → N articles | Référence catalogue | Faible |
| `state.stockMovements[]` | `stock_movements` | N mouvements → 1 article ; `sourceId` polymorphe (commande, PO, ajustement manuel) | **Source de vérité unique du stock physique** (`physicalStock()` = somme des mouvements, jamais un compteur stocké séparément) | **Moyen** : `sourceId` polymorphe (peut référencer une commande, un bon de commande fournisseur, ou rien) — en SaaS, préférer une colonne `source_type` + `source_id` explicite plutôt qu'une FK unique, ou deux colonnes nullables par type de source |
| `state.stockLots[]` | `stock_lots` | 1 article → N lots ; consommé par FEFO | `lotAllocations` sur les mouvements CONSUMPTION | Faible — déjà relationnel dans sa forme actuelle |
| `state.purchaseOrders[]` / `state.purchaseProposals[]` | `purchase_orders` / `purchase_proposals` | 1 fournisseur → N | Statuts métier (`confirmed`/`received`/…) | Faible |
| `state.suppliers[]` / `state.articleSuppliers[]` | `suppliers` / `article_suppliers` | table de jointure N↔N avec tarifs | Tarifs par fournisseur | Faible |

**Règle métier à préserver impérativement en SaaS** (Partie F, V3.8) : le stock physique ne doit **jamais** être recrédité par une annulation de commande une fois la matière consommée. Ceci doit devenir une contrainte/règle métier appliquée côté serveur (fonction/trigger ou service applicatif), pas seulement une convention respectée par le client — un appel API direct ne doit pas pouvoir contourner la règle.

## Facturation

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.invoices[]` | `invoices` | 1 cabinet → N factures ; N commandes ↔ 1 facture (`orderIds[]`) | `status` (DRAFT/ISSUED/SENT/PAID) | **Moyen** : `orderIds[]` est un tableau JSON côté client — en SaaS, une table de jointure `invoice_orders` est préférable (permet des contraintes d'unicité empêchant qu'une commande soit facturée deux fois, actuellement vérifié côté client par `createInvoice()`) |
| `state.invoicePayments[]` | `invoice_payments` | N règlements (partiels) → 1 facture | Historique append-only, jamais un statut résumé seul | Faible — déjà pensé append-only |
| `state.services[]` / `state.serviceMaterials[]` | `services` / `service_materials` | 1 prestation → N matières consommées (par étape) | Catalogue tarifaire + `consumeAtStageId` | Faible |

## Utilisateurs, droits, planning

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.users[]` | `users` (labo) | 1 labo → N utilisateurs ; `roleId` → droits | `assignedStageId` (poste Collaborateur) | **Moyen** : l'authentification actuelle est un simple `currentUserId` sans mot de passe — le SaaS doit introduire une vraie authentification (Supabase Auth pressenti) ; `roleId`/permissions doivent devenir une politique RLS (Row Level Security) réelle, pas une simple fonction `can()` côté client contournable |
| `state.absences[]` / `state.leaveRequests[]` | `absences` / `leave_requests` | 1 utilisateur → N | Statuts (`pending`/`approved`) | Faible |

## Dentistes / Cabinets (Partie H)

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.dentists[]` | `dentists` | `cabinet` (chaîne libre actuellement) → devrait devenir `cabinets.id` (FK) en SaaS | `accountStatus`/`inviteStatus` | **Moyen** : le POC identifie un cabinet par une **chaîne de caractères** (`cabinet: 'Cabinet Moderne'`), jamais un identifiant stable. En SaaS, `cabinets` doit être une table à part entière (id stable), et `dentists.cabinet_id`/`orders.cabinet_id` doivent y référer — condition **nécessaire** pour que l'authentification par cabinet (portail dentiste) soit réellement isolée (actuellement l'isolation "1 seul praticien / plusieurs praticiens" du portail repose sur cette même chaîne, voir Partie H) |
| `state.cabinetPatients{}` | `cabinet_patients` (ou colonnes chiffrées sur `orders`) | 1 commande → identité patient, visible uniquement du cabinet propriétaire | Séparation patientFirstName/Last de `orders.patientRef` opaque | **Élevé (confidentialité)** : en local, la "séparation" `cabinetPatients` vs `orders` est **logique seulement** (même runtime JS, aucune barrière technique réelle — documenté ainsi dans le code depuis V3.6). En SaaS, ceci **doit** devenir une vraie séparation RLS : le labo ne doit voir que ce que `anonymized` autorise, un cabinet ne doit jamais voir les patients d'un autre cabinet — actuellement seulement vrai "par construction UI", pas par une barrière serveur |

## Notifications et messagerie (nouveau en V9)

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.notifications[]` | `notifications` | `target` (LAB/CABINET) + `entityType`/`entityId` polymorphe | `readAt` (null = non lu) | **Moyen** : `target:'CABINET'` n'a **pas** de `cabinetId` dans le schéma V9 actuel (le portail est mono-cabinet-actif à la fois, donc l'ambiguïté n'existe pas en local) — **le SaaS DOIT ajouter une colonne `cabinet_id`** sur les notifications `target='CABINET'` avant que plusieurs cabinets puissent exister simultanément en base sans fuite de badge entre eux. C'est le changement de schéma le plus important identifié par cet audit. |
| `state.conversations[]` | `conversations` | 1 cabinet → N conversations ; `orderIds[]` (0, 1 ou N) | `cabinetId`, `subject` | **Moyen** : comme pour `invoices.orderIds[]`, préférer une table de jointure `conversation_orders` en SaaS plutôt qu'un tableau JSON — permet une contrainte serveur réelle pour l'isolation "jamais une commande d'un autre cabinet" (actuellement vérifiée uniquement dans `createConversation()` côté client) |
| `state.conversationMessages[]` | `conversation_messages` | N messages → 1 conversation | `labReadAt`/`cabinetReadAt` (double accusé de lecture) | Faible — déjà append-only, structure directement transposable |
| `state.messages{}` (legacy, V3.7 et antérieur) | — (migré, jamais recréé) | 1 entrée par commande | Conservé en lecture pour migration uniquement | La logique de migration `migrateMessagesToConversations()` (déjà écrite, testée, idempotente côté client) doit être le squelette du script de migration serveur unique — jamais réécrite indépendamment |

## Journal / Audit

| Local | Table SaaS | Relation | Source de vérité | Risque |
|---|---|---|---|---|
| `state.historyEvents[]` | `order_history_events` | N événements → 1 commande | Audit uniquement — **n'est plus la source de la traçabilité affichée** depuis V3.8 (voir Partie E) | Faible — purement informatif désormais, aucune logique métier n'en dépend |
| `state.activityEvents[]` | `activity_log` | Journal global (toutes entités) | Utilisé par la page Rapports/Journal | Faible |

## Architecture UX — 3 modes, routage SaaS (Partie §170-180)

En SaaS, le mode (LAB / STAFF / DENTIST) ne doit plus être un paramètre d'URL (`?mode=staff`) mais dérivé de la session authentifiée :

- `role='RESPONSABLE'`/`'ADMINISTRATIF'`/etc. (table `users`) → mode **LAB** (application web responsive, aujourd'hui déjà fonctionnelle en desktop et mobile).
- `role='PRODUCTION'`/`'STOCK'` avec `assignedStageId` → mode **STAFF**, à servir comme PWA installable mobile-first.
- Un dentiste authentifié (table `dentists`, liée à un compte `auth.users` Supabase) → mode **DENTIST**, portail desktop-first, jamais une PWA.

### Préparation PWA — Collaborateur/Staff (documentation uniquement, non implémenté en V3.8)

Le mandat V3.8 demande explicitement de **préparer** l'architecture sans implémenter de synchronisation offline réelle. Éléments à fournir lors du passage SaaS (HTTPS obligatoire — un fichier `file://` ne peut structurellement pas être une PWA installable, ceci reste vrai et ne doit jamais être présenté autrement) :

- **`manifest.json`** (à créer) :
  - `name`: "DentalFlow Collaborateur"
  - `short_name`: "DentalFlow"
  - `display`: "standalone"
  - `orientation`: "portrait-primary"
  - `start_url`: la route Collaborateur (`/staff` ou équivalent), jamais la racine labo
  - Icônes (192×192, 512×512 minimum) — non produites en V3.8, à fournir avec la charte graphique définitive
- **Service worker** (à créer) : cache-first pour l'app-shell Collaborateur, stratégie réseau à définir pour les données (les scans doivent probablement rester **online-only** en première itération SaaS — une file d'attente offline est une extension future, pas un prérequis V3.8/premier SaaS)
- Le portail dentiste ne doit **jamais** recevoir de manifeste ni de bouton d'installation — confirmé conforme en V3.8 (vérifié en navigateur, aucun bouton "Installer DentalFlow" présent).

## Ce qui n'est PAS dans ce document

Conformément au mandat (§138-140, §142) : aucun schéma SQL, aucune structure de RLS Postgres réelle, aucun endpoint API, aucune configuration Supabase/Vercel. Ce document est une carte de correspondance structurelle destinée à accélérer la conception technique du SaaS, pas une spécification technique de celui-ci.
