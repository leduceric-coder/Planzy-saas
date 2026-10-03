# DentalFlow Next V3.8.2 — Rapport d'implémentation

Mission : **DENTALFLOW V3.8.2 — BUSINESS UX CONSOLIDATION**. Consolidation des derniers retours utilisateurs métier avant la porte SaaS : cabinets comme entité canonique, fiche commande enrichie (travail/indications), fusion Charge (Demandes & simulation), page Utilisateurs professionnalisée, prévisualisation de facture avant émission, portail Cabinet avec vraies factures (PDF réel), centre de notifications réel, correction P0 du formulaire Cabinet, et états visuels de commande.

Base : `dentalflow-next-poc-v3.8.1.html` (185/185 PASS, **jamais modifié** — confirmé par `git status`). Livrable : `dentalflow-next-poc-v3.8.2.html` (1 807 213 octets, 12 376 lignes, **5** blocs `<script>` — le nouveau bloc jsPDF embarqué, voir Partie F).

## Vue d'ensemble par partie

| Partie | Périmètre | Statut |
|---|---|---|
| A | Schéma V10 — entité Cabinets | Fait |
| B | Fiche commande — bloc Travail/Indications | Fait |
| C | Charge — fusion Demandes & simulation | Fait |
| D | Utilisateurs — tri/filtre/recherche | Fait |
| E | Facture — aperçu avant émission | Fait |
| F | Portail Cabinet — factures + PDF réel + isolation | Fait |
| G | Centre de notifications | Fait |
| H | Correction P0 — formulaire Cabinet perd Nom/Prénom | Fait |
| I | États visuels des commandes | Fait |
| J | Non-régression du périmètre V3.8.1 | Respecté (voir vérifications ci-dessous) |
| K | Tests, régression, livrables | Fait (voir `DENTALFLOW_V3_8_2_TEST_REPORT.md`) |

## Partie A — Schéma V10 : entité Cabinets

`V34_SCHEMA_VERSION` passe de 9 à 10. `migrateV9toV10(s)` (appelée depuis `ensureV34Model()`, chaîne `migrateV6toV7→migrateV8toV9→migrateV9toV10`, dans cet ordre) construit `state.cabinets[]` à partir des noms **uniques** déjà présents dans `orders`/`dentists`/`invoices`/`conversations.cabinetId` (ce dernier contient délibérément un **nom**, pas un vrai id — la messagerie reste hors périmètre, Partie J) :

```js
function migrateV9toV10(s){
  ensureArray(s,'cabinets');
  const names=new Set();
  (s.orders||[]).forEach(o=>{if(o.cabinet)names.add(o.cabinet)});
  (s.dentists||[]).forEach(d=>{if(d.cabinet)names.add(d.cabinet)});
  (s.invoices||[]).forEach(i=>{if(i.cabinet)names.add(i.cabinet)});
  (s.conversations||[]).forEach(c=>{if(c.cabinetId)names.add(c.cabinetId)});
  Array.from(names).sort((a,b)=>a.localeCompare(b,'fr')).forEach(name=>{
    if(s.cabinets.some(c=>c.name===name))return; // idempotent
    s.cabinets.push({id:uid('CAB'),name,legalName:'',...,status:'ACTIVE',createdAt:Clock.iso(),archivedAt:null});
  });
  (s.orders||[]).forEach(o=>{if(!o.cabinetId&&o.cabinet)o.cabinetId=idFor(o.cabinet)});
  (s.dentists||[]).forEach(d=>{if(!d.cabinetId&&d.cabinet)d.cabinetId=idFor(d.cabinet)});
  (s.invoices||[]).forEach(i=>{if(!i.cabinetId&&i.cabinet)i.cabinetId=idFor(i.cabinet)});
  migrateUserNamesV10(s);
}
```

Choix structurant : **`cabinetId` est purement additif**. Aucun champ `.cabinet` (string) existant n'est renommé ni supprimé sur order/dentist/invoice — la migration est donc non-destructive et réversible en lecture (le nom historique reste toujours lisible même si le cabinet est ensuite renommé ou archivé). `migrateUserNamesV10(s)` (même partie) dérive `firstName`/`lastName` de `name` pour tout utilisateur qui n'en a encore aucun, sans jamais toucher `name`.

Helpers exposés (IIFE → base-script, `installOverrides()`) : `cabinetById`, `cabinetByName`, `cabinetName`, `cabinetIsActive`, `ensureCabinetForName`, `cabinetUsageCount`, `createCabinet`, `updateCabinet`, `archiveCabinet`, `unarchiveCabinet`, `deleteCabinet`. `deleteCabinet(id)` refuse (`{success:false,reason:'IN_USE'}`) si `cabinetUsageCount(id).total>0` ; sinon suppression réelle. Un cabinet archivé (`archiveCabinet`) est exclu du `<select>` de nouvelle commande (`renderNewOrderPanel`, changé de champ libre à `<select>` peuplé des cabinets actifs uniquement) mais reste visible sur toute commande/facture historique qui le référence par nom.

Nouvelle page **Cabinets** sous Outils (`NAV_ITEMS.cabinets`, `TOOLS_NAV` étendu) : recherche + filtre Actifs/Archivés/Tous, table desktop + cartes mobile, formulaire de création/édition en side-window (`renderCabinetFormPanel`), bouton +Nouveau. Nouvelles permissions `cabinets.view`/`cabinets.manage` (libellés « Voir les cabinets »/« Gérer les cabinets »), accordées à `ADMINISTRATIF` (les deux) et `LECTURE` (voir seule).

## Partie B — Fiche commande : bloc Travail / Indications

`order.workInstructions` devient la source canonique des indications, alimentée par le champ **Notes** du formulaire Lab (`createOrder`) **et** du formulaire Cabinet (`createDentistOrderCore`) — plus seulement le premier message de conversation comme avant V3.8.2 :

```js
o.workInstructions:String(input.workInstructions||input.notes||'').trim()
```

`_renderQuickView()` insère un nouveau bloc « Travail » (Prestation/Dents/Teinte/Empreinte) immédiatement après Patient/livraison, suivi d'un bloc « Indications / remarques » **seulement si** `workInstructions` est non vide. `printFiche()` (bon de suivi imprimé) reprend les mêmes informations. `handleStaffScanSubmit()`/`applyStaffFeedback()` (feedback scan Collaborateur) enrichis pour afficher CMD/Patient/Prestation/Dents/Teinte/Indication — un minimum métier utile, jamais la fiche admin complète.

## Partie C — Charge : fusion Demandes & simulation

`whatIfSectionHTML()` entièrement réécrite : une seule carte « Demandes & simulation » avec un **seul** tableau (colonnes Type/Collaborateur/Période/Jours/Motif/Impact capacité/Simulation/Décision-Actions). Les demandes réelles portent une case « Inclure » (`data-whatif-req`) + boutons Approuver/Refuser (`data-leave-approve`/`data-leave-refuse`, engine `approveLeave`/`refuseLeave` inchangés) ; les hypothèses portent « Incluse ✓ » + Supprimer. Le formulaire « + Ajouter une hypothèse » vit désormais dans la même carte. Ligne de synthèse : « Impact simulé : −N commandes sur 8 semaines » + nombre de semaines en tension. Approuver une demande réelle transitionne toujours l'absence **et** la retire de la liste « à valider » (même moteur `approveLeave`, aucune double comptabilisation).

« Projection sur 8 semaines » et « Absences planifiées » (`renderPlanning`) sont restées **des sections strictement séparées**, jamais fusionnées — vérifié explicitement (test C04).

## Partie D — Utilisateurs : tri/filtre/recherche

`state.users[].firstName`/`.lastName` ajoutés au schéma V10 (`migrateUserNamesV10`, dérivés de `name` si absents, `name` jamais perdu). Helpers `userFirstName`/`userLastName`/`userDisplayName`. Nouvelle table desktop compacte (`renderUsersTableHTML`) : Prénom/Nom/Poste/Rôle/Droits/Capacité/Actions, triable par clic sur Nom/Prénom/Poste(scope)/Rôle/Capacité (`usersSortTh`, `state.usersSortKey`/`usersSortDir`), filtrable par permission via un `<select>` peuplé de `PERMISSION_LABELS` (`state.usersFilterPerm`, filtre réel via `can(u, perm)`), recherche libre nom/prénom/email/poste (`state.usersSearch`). Colonne Droits = compteur cliquable ouvrant `renderUserPermsPanel` (popup avec libellés français complets). Cartes mobile ≤390px avec les mêmes filtres/tri accessibles (`renderUsersCardsHTML`).

## Partie E — Prévisualisation de facture avant émission

Renderer unifié `invoiceDocumentHTML(inv)` (basé sur `invoiceDocumentFields(inv)`, structure de données unique) : en-tête DentalFlow, N° facture, cabinet (identité **figée** — voir Partie F), adresse de facturation si renseignée, date de brouillon/émission, commandes facturées, lignes (prestation/qté/prix/total), total. Utilisé **sans aucune divergence** par l'aperçu Lab, l'aperçu portail Cabinet, l'impression (`printInvoice`, refactorée pour l'appeler) et la génération PDF (Partie F).

Le bouton « Émettre » d'un Brouillon dans la liste Factures est **remplacé** par « Prévisualiser » (`data-preview-invoice`) — plus aucun accès direct à `issueInvoice()` depuis la liste. Le clic ouvre `renderInvoicePreviewPanel()`, un aperçu plein écran affichant le document complet + actions adaptées au statut : DRAFT → [Fermer] [Modifier la sélection] [Émettre la facture] ; ISSUED/SENT/PAID → [Fermer] [Imprimer] [Télécharger PDF] [Envoyer au cabinet]/[Pointer] selon statut et droits (`billing.point`). `issueInvoice()` n'est appelée **que** depuis le clic explicite sur « Émettre la facture » à l'intérieur de l'aperçu. « Modifier la sélection » appelle une nouvelle fonction `cancelDraftInvoice(id)` (statut → `CANCELLED`, jamais de suppression silencieuse de l'Invoice) et ramène l'utilisateur sur l'onglet « À facturer » pour resélectionner les commandes (redevenues disponibles, `isOrderAvailableForNewInvoice` ignore les factures `CANCELLED`).

## Partie F — Portail Cabinet : factures, PDF réel, isolation

**jsPDF 2.5.2** (MIT, James Hall et al.) embarqué inline comme **5ᵉ bloc `<script>`** (même pattern que ZXing/QR-code déjà présents dans le fichier — build UMD officiel minifié, licence complète conservée en commentaire d'en-tête, **aucun appel CDN au runtime**). `downloadInvoicePDF(id)` construit un PDF réel à partir des **mêmes données** que `invoiceDocumentHTML` (`invoiceDocumentFields` — source unique, seule la technique de rendu diverge par nécessité HTML vs dessin PDF), nommé `FAC-XXXX.pdf`, jamais un `window.print()` déguisé (vérifié : en-tête binaire `%PDF-` du fichier téléchargé).

Portail Cabinet (`dentistFacturesHTML`) : liste cliquable (`data-dinvoice`) ouvrant `dentistInvoiceDetailHTML(inv)` — le document complet, avec **seulement** Imprimer/Télécharger PDF (aucun bouton Modifier/Émettre/Pointer/Annuler, ni dans le rendu ni dans le moteur).

**Garde-fou d'isolation au niveau moteur** (pas seulement l'UI) : `cabinetCanAccessInvoice(invoiceId, cabinetName)` — refuse tout Brouillon (jamais exposé à un cabinet) et toute facture d'un **autre** cabinet, vérifié à **chaque** action (ouverture, impression, PDF), y compris via un id manipulé dans le DOM (bouton injecté hors liste rendue) :

```js
function cabinetCanAccessInvoice(invoiceId,cabinetName){
  const inv=(state.invoices||[]).find(x=>x.id===invoiceId);
  if(!inv)return false;
  if(inv.status==='DRAFT')return false;
  return inv.cabinet===cabinetName;
}
```

`cabinetSnapshot` (déjà figé à la création de la facture, `createInvoice`) garantit qu'une modification ultérieure du cabinet (adresse, SIRET, ville…) ne modifie **jamais** une facture déjà émise, y compris un brouillon.

## Partie G — Centre de notifications

Le contrôle `#notif-btn`/`#notif-count` existait déjà dans le code (référencé par `updateNotif()`/le gestionnaire de clic) mais **n'était jamais rendu dans le markup** — complété : vraie cloche 🔔 avec badge dans le header Lab desktop (`.topbar`, grille étendue à 3 colonnes) et un équivalent compact dans le `.mobile-topbar` (visible ≤860px uniquement, jamais les deux à la fois — vérifié par mesure de `getComputedStyle().display` aux deux tailles).

`buildNotificationFeed()` fusionne les notifications persistées non lues (`state.notifications`, target LAB — NEW_ORDER/NEW_MESSAGE/ORDER_UPDATE) avec des situations dérivées calculées en direct à chaque appel (commande en retard/bloquée, stock critique, achat BLOCKED/ORDER_NOW, congé en attente), sous une **clé logique stable par objet métier** (`order:CMD-0001`, `stock:ART-xxx`, `purchase:PP-xxx`, `leave:L1`, `conversation:CONV-xxx`) — un même objet ne compte jamais deux fois ; en cas de conflit, l'état le plus sévère (rouge > orange > bleu) l'emporte pour la couleur/le titre affichés, mais le badge « NOUVEAU » (notification persistée non lue) reste porté indépendamment. Rien n'est mis en cache : une situation résolue disparaît du prochain calcul sans action explicite.

`renderNotificationsPanel()` : side-window avec les 7 filtres exacts Toutes/Commandes/Messages/Production/Stock/Achats/RH. Chaque ligne (`data-notif-open`) route vers l'objet concerné : commande → `openQuickView` (marque déjà lu) ; message → sélection de la conversation + `markConversationReadForLab` ; stock/achat/congé → navigation directe vers la page concernée (aucune de ces trois n'étant persistée, rien à marquer lu).

## Partie H — Correction P0 : formulaire Cabinet perd Nom/Prénom

**Cause racine identifiée et éliminée** : `attachDentistHandlers()` appelait `renderDentistMode()` (reconstruction complète du formulaire, donc du DOM des champs texte) sur changement de Prestation/Empreinte/Date de livraison — perdant Nom/Prénom déjà saisis à chaque changement, alors même qu'ils restaient visibles à l'écran juste avant.

`state.dentistOrderDraft` (via `ensureDentistOrderDraft()`/`resetDentistOrderDraft()`) devient la source de vérité UI du formulaire — mise à jour à chaque frappe/changement (listeners `input`/`change` étendus), **jamais réinitialisée** pendant la saisie, seulement après une création réussie. Le bascule Empreinte (`data-impression-mode`) touche **uniquement** `impressionMode` + visibilité pièces jointes/message explicatif (classes `.active`/`checked`/`style.display` ciblés) :

```js
if(opt.hasAttribute('data-impression-mode')){
  const mode=opt.dataset.impressionMode;
  ensureDentistOrderDraft().impressionMode=mode;
  // ... .impr-opt .active, radio .checked, #order-digital-files-wrap / #order-physical-hint-wrap
  return; // jamais renderDentistMode()
}
```

Le choix d'une date proposée met à jour uniquement la sélection visuelle du groupe (`ensureDentistOrderDraft().deliveryChoice`). Un changement de Prestation appelle `updateDentistDeliveryZone()` — qui recalcule les dates proposées et ne remplace **que** la zone `#dnew-deliv-opts`, jamais le formulaire entier. `createDentistOrderCore()` lit les valeurs réelles du brouillon/formulaire au moment de la soumission.

Test terrain exact reproduit (§65, D06) : Marie/Dupont/Couronne zircone/A2/dent 14/date, puis clic PHYSIQUE, puis soumission → commande créée avec `patientFirstName:'Marie'`, `patientLastName:'Dupont'`, `impressionMode:'PHYSICAL'`, aucune erreur « Nom/Prénom requis ».

## Partie I — États visuels des commandes

`orderVisualState(o)` — priorité stricte En retard(rouge) > Bloquée(orange) > Nouvelle(bleu) > Prête à livrer(vert) > En production(bleu clair) > Livrée(gris discret) > Annulée(gris terne) :

```js
function orderVisualState(o){
  if(isOrderLate(o))return 'late';
  if(isOrderBlocked(o))return 'blocked';
  if(orderHasUnreadNewOrderNotif(o.id))return 'new';
  if(isOrderReady(o))return 'ready';
  if(isOrderCompleted(o))return 'delivered';
  if(isOrderCancelled(o))return 'cancelled';
  return 'production';
}
```

Classe `ovs-<état>` appliquée au `<tr>` (`renderTable`) et à `.order-card` (`renderOrderCards`) — fond légèrement teinté + barre gauche colorée (CSS uniquement, aucune donnée dupliquée). Le badge « NOUVEAU » existant coexiste avec la couleur primaire : une commande en retard **et** nouvelle affiche le rouge comme couleur primaire mais garde le badge « NOUVEAU » tant qu'elle n'est pas ouverte (`openQuickView` marque lu → l'état retombe sur l'état métier sous-jacent au rendu suivant). Chaque état porte toujours aussi un texte/pastille (le pill de statut existant + le badge NOUVEAU), jamais la couleur seule — accessibilité vérifiée par test (V04).

## Partie J — Non-régression du périmètre V3.8.1

Aucune modification de `repairLegacyTraceabilityV9`, `repairLegacyLifecycleDates`, `orderTimeline`, la fusion démarrage/Réception, l'invariant « aucun Scan Réception », les cycles de reprise, la localisation manuelle, `moveOrderToStage`, ni les garde-fous moteur associés — confirmé par lecture du diff (ces fonctions n'apparaissent dans aucun des blocs modifiés) et par les 185 tests V3.8.1 tous conservés et passants sans réécriture (sauf 1, documenté ci-dessous comme changement de comportement explicite du mandat).

## Correction annexe (complétude d'export/import)

`serializableState()` (utilisée par `exportDentalFlowJSON()` et par la restauration JSON avancée `applyImportedFullState()`) n'incluait pas `cabinets` — une sauvegarde/restauration JSON aurait silencieusement perdu l'entité Cabinets introduite en Partie A. Corrigé (`cabinets:state.cabinets||[]` ajouté à la liste des champs exportés), sans quoi l'isolation stricte des tests (voir rapport de tests) aurait elle-même été faussée.

## Écarts et scope (§89)

Aucun ajout de Supabase, Vercel, backend, Stripe, TVA/comptabilité réglementaire, CRM, email/SMS réel — V3.8.2 reste un POC fonctionnel Pre-SaaS, conformément au mandat.
