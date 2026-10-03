# DentalFlow Next V3.8.1 — Rapport d'implémentation

Mission : **DENTALFLOW V3.8.1 — TRACEABILITY & MANUAL LOCATION CORRECTNESS**. Dernière correction de logique métier sur la traçabilité avant le gel fonctionnel Pre-SaaS, à partir de constats de terrain ayant échappé aux tests V3.8 : anciens « Scan Réception » survivant à la migration, événements de timeline redondants, anciennes restitutions matière encore visibles dans la trace, histoire difficile à suivre, fonction de localisation manuelle trop cachée.

Base : `dentalflow-next-poc-v3.8.html` (174/174 PASS, jamais modifié). Livrable : `dentalflow-next-poc-v3.8.1.html` (1 339 613 octets, 10 694 lignes, 4 blocs `<script>`).

## Résumé des constats terrain et de leur correction

| Constat terrain | Cause racine | Correction |
|---|---|---|
| « Scan Réception » visible sur des commandes migrées | `migrateV8toV9()` (V3.8) backfillait un LocationEvent `source:SCAN` depuis d'anciens `scanEvents` de Réception, sans savoir que ce cas devenait impossible dès que `moveOrderToStage` a commencé à le refuser | `repairLegacyTraceabilityV9(state)`, appelée à chaque démarrage (pas seulement lors d'une migration de schéma) |
| Timeline difficile à suivre, événements redondants | `orderTimeline()` listait des faits techniques (Scan X / SYSTEM / Bon imprimé / Réception séparés) plutôt qu'une histoire métier | `orderTimeline()` entièrement réécrite (Parties A/B/D/E/F/G) |
| Anciennes restitutions matière encore visibles sur la fiche | `orderTimeline()` de V3.8 affichait encore les `StockMovement` RETURN hérités du modèle pré-V3.8 | Push RETURN retiré de `orderTimeline()` — les mouvements restent intacts dans `state.stockMovements` (Journal/Stock/Audit), jamais supprimés |
| `createdAt` parfois incohérent sur une commande ancienne | `backfillOrderLifecycleDates()` retombe sur `Clock.iso()` (l'heure du **jour de la migration**) faute de mieux, sur une commande migrée depuis avant V3.6 | `repairLegacyLifecycleDates(order, state)`, appelée pour chaque commande à chaque démarrage — ne clampe qu'à la baisse, n'invente jamais |
| Fonction de localisation manuelle « trop cachée » | Le seul déclencheur de `renderOrderPanel()` (bouton `#more-options`) **n'était rendu nulle part** dans l'interface — la fonction existait dans le moteur mais était strictement inatteignable | Nouveau bloc « Localisation » prominent dans la fiche + colonne/carte Commandes, ouvrant une side-window dédiée |

## Détail technique par partie

### Parties A/B/D/E/F/G — `orderTimeline()`

Fonction réécrite en conservant exactement les mêmes sources canoniques que V3.8 (`createdAt`, `physicalImpressionReceivedAt`, `trackingSheetFirstPrintedAt`, `locationEvents`, `productionCompletedAt`, `reworks`, `deliveredAt`, `cancelledAt`) — **jamais** `historyEvents` en 2e source de vérité. Seule la couche de présentation (libellés, fusion, dédoublonnage) a changé :

- `push(o.createdAt, o.source==='CABINET'?'Commande reçue':'Commande saisie au laboratoire', '')` — premier fait dépendant de la source.
- Le LocationEvent SYSTEM sur le poste `scannable:false` (Réception, identifié par ce flag plutôt qu'un ID/label en dur, robuste à un renommage de poste) est fusionné en « Suivi démarré — Réception » / détail « Bon de suivi imprimé ».
- Chaque autre LocationEvent devient « Entrée en {label} » (ou « Prête à livrer » si son horodatage coïncide avec `productionCompletedAt` **et** que c'est la dernière étape active — dédoublonnage), avec détail « Scan · Nom » / « Localisation manuelle · Nom ».
- Un préfixe « Reprise N — » est ajouté quand `e.reworkId` correspond à une entrée de `order.reworks` (recherche par index, N = position + 1).
- Le repli `scanEvents` (pour les commandes pré-V9 sans aucun LocationEvent) reçoit le même traitement de libellés et filtre lui aussi tout scan hérité au poste Réception.
- Le push des `StockMovement` RETURN (dernière ligne de la V3.8) a été **supprimé** — c'est le seul retrait pur de fonctionnalité de la mission, explicitement demandé (Partie G).

### Partie C — `repairLegacyTraceabilityV9(state)`

```js
function repairLegacyTraceabilityV9(s){
  ensureArray(s,'locationEvents');
  const receptionDef=(s.stageDefinitions||stageDefs()).find(d=>d.scannable===false)||stageDefById('STG-001');
  const receptionId=receptionDef?receptionDef.id:'STG-001';
  s.locationEvents=s.locationEvents.filter(e=>!(e.stageId===receptionId&&e.source==='SCAN'));
  (s.orders||[]).forEach(o=>{
    if(!o.trackingSheetFirstPrintedAt)return;
    const hasSystemReception=s.locationEvents.some(e=>e.orderId===o.id&&e.stageId===receptionId&&e.source==='SYSTEM');
    if(hasSystemReception)return;
    s.locationEvents.push({id:uid('LOC'),orderId:o.id,stageId:receptionId,source:'SYSTEM',actorId:null,actorName:null,at:o.trackingSheetFirstPrintedAt,note:null,reworkId:null});
  });
}
```

Point de câblage décisif : cette fonction (et `repairLegacyLifecycleDates`) est appelée **en dehors** des deux branches `if(!persistedV7){...}` de `ensureV34Model()`, juste après la pose de `state.schemaVersion`. Raison : un état déjà persisté en schéma V9 par V3.8 (`persistedV7` vrai) ne traverse **aucune** des deux branches de migration — c'est précisément l'état qui porte encore les artefacts hérités du bug de backfill de V3.8. Un appel placé à l'intérieur d'une des deux branches n'aurait jamais réparé ce cas, qui est pourtant le cas terrain réel.

### Partie H — `repairLegacyLifecycleDates(order, state)`

```js
function repairLegacyLifecycleDates(order,state){
  if(!order)return;
  const times=[];
  if(order.physicalImpressionReceivedAt)times.push(order.physicalImpressionReceivedAt);
  if(order.trackingSheetFirstPrintedAt)times.push(order.trackingSheetFirstPrintedAt);
  (state.locationEvents||[]).filter(e=>e.orderId===order.id).forEach(e=>{if(e.at)times.push(e.at)});
  if(order.productionCompletedAt)times.push(order.productionCompletedAt);
  if(order.deliveredAt)times.push(order.deliveredAt);
  if(order.cancelledAt)times.push(order.cancelledAt);
  (order.reworks||[]).forEach(r=>{if(r.createdAt)times.push(r.createdAt)});
  if(!times.length)return;
  const earliest=times.reduce((a,b)=>new Date(b).getTime()<new Date(a).getTime()?b:a);
  if(!order.createdAt||new Date(earliest).getTime()<new Date(order.createdAt).getTime()){
    order.createdAt=earliest;
  }
}
```

Appelée pour chaque commande **après** `repairLegacyTraceabilityV9(state)`, afin que le LocationEvent SYSTEM Réception fraîchement backfillé participe déjà au calcul du minimum.

### Parties I/J/K — Localisation manuelle prominente

- `_renderQuickView()` : nouveau bloc `locBlockHTML` (variable calculée, insérée entre `weekStripHTML(o)` et `reworksHTML`) — étape actuelle (`locationText(o)`), ligne « Dernière mise à jour » (nouvelle fonction `locationUpdateLine(o)`), bouton `data-open-location` gardé par `canMoveLoc = can(currentUser(),'production.manage') && !cancelled && !delivered`.
- Nouvelle fonction `locationUpdateLine(o)` : lit `getCurrentOrderStage(o.id)` et compose « Scan/Localisation manuelle/Suivi démarré (système) · Nom · date ».
- Nouveau `sidePanel==='changeLocation'` + `renderChangeLocationPanel()` : formulaire dédié (select + textarea motif + Annuler/Confirmer), ids distincts (`loc-panel-select`/`loc-panel-note`/`loc-panel-confirm`/`loc-panel-cancel`) de l'ancien mécanisme `renderOrderPanel` (laissé intact, inchangé, désormais simplement redondant — jamais touché pour limiter le risque de régression sur du code déjà testé).
- Handler `#loc-panel-confirm` : appelle `moveOrderToStage(oid, stageId, {source:'MANUAL', note})`, puis `closeSidePanel();render();openQuickView(oid)` en cas de succès (re-rendu immédiat partout), ou ré-affiche le panneau avec le message d'erreur retourné par le moteur en cas d'échec — **aucune règle métier dupliquée côté UI**, uniquement de l'affichage du résultat.
- `moveOrderToStage()` : 4 nouvelles vérifications ajoutées, dans cet ordre, après les gardes existantes (permission, `STAGE_NOT_SCANNABLE`) : `ORDER_DELIVERED` (commande livrée) → `SAME_STAGE` (MANUAL uniquement) → `MOTIF_REQUIRED` (recul MANUAL sans `note`). Après le déplacement effectif, une dernière vérification rétrograde le statut « prête » si la commande n'atterrit pas sur la dernière étape active. `reworkId` est désormais auto-dérivé via `activeReworkForOrder(order)` quand non fourni explicitement par l'appelant.
- `renderTable()`/`renderOrderCards()` (Commandes desktop/mobile) : nouvelle fonction partagée `orderCanMoveLocation(o)` (même garde que la fiche), bouton `data-open-location` ajouté dans la cellule/ligne Localisation.
- `handleAppClick()` : nouveau bloc de gestion (`data-open-location`, `#loc-panel-cancel`, `#loc-panel-confirm`) inséré **avant** le handler générique `[data-order]` (l'ordre des vérifications par `closest()` dans une fonction à retours anticipés garantit qu'un clic sur le bouton imbriqué ne déclenche jamais aussi l'ouverture de la fiche).

### Partie L — Seed V9 (`seedV9Orders()`)

Réécriture complète en conservant l'architecture des helpers (`place`/`printAt`/`scanAt`/`moveManualAt`, cette dernière acceptant désormais un `note` optionnel pour les scénarios de recul). Nouveau helper `deliverAt(o, completedH, deliveredH)` qui pose `productionCompletedAt`/`deliveredAt`/`status`/`productionState` directement (comme en V3.8) — nécessaire car `markOrderReadyIfLastStage()`, déclenché automatiquement par `moveOrderToStage`, pose `productionCompletedAt` à `Clock.iso()` (l'heure réelle du seed) et non à l'horodatage historique demandé par le scénario ; ce correctif après-coup, déjà présent en V3.8, a été conservé à l'identique.

Scénario I (reprise) : construit la livraison complète, appelle `deliverAt`, pousse un `rework` réel (`status:'open'`), réinitialise `status`/`productionState` à `'progress'`/`'active'` (même geste que `createRework()`), puis appelle `moveManualAt(oI,'STG-004','Eric Leduc',-80,'Reprise — retour en Céramique pour ajustement occlusal')` — le motif est **requis** ici car il s'agit d'un recul (Prêtes → Céramique) ; le `reworkId` est automatiquement rattaché par le moteur.

### Partie M — Tests

Voir `DENTALFLOW_V3_8_1_TEST_REPORT.md` pour le détail complet (185/185 PASS, isolation, responsive 24/24, thèmes 12/12, `node --check` 4/4).

## Fichiers livrés

- `dentalflow-next-poc-v3.8.1.html`
- `DENTALFLOW_V3_8_1_TEST_REPORT.md`
- `DENTALFLOW_V3_8_1_IMPLEMENTATION_REPORT.md` (ce fichier)
- `DENTALFLOW_V3_8_1_CHANGELOG.md`

Aucun document de mapping SaaS n'a été redemandé pour cette mission (seuls 3 livrables documentaires, conformément au mandat).
