# DentalFlow Next V3.5.2 — Rapport d'implémentation

## Cadrage

V3.5.2 part de `dentalflow-next-poc-v3.5.1.html` (fourni comme `dentalflownextpocv3.5.1(2).html`) et corrige les anomalies résiduelles identifiées après le passage à l'horloge réelle (V3.5.1) : propositions d'achat obsolètes non recalculées, parser d'échéances incomplet, horloges figées résiduelles, QR de production absent côté laboratoire, boutons d'achat sans montant sur WAIT, libellé de filtre trompeur. Aucun moteur métier (`StockEngine`, `DemandEngine`, `SupplierEngine`, `ProposalEngine` au sens de la logique de décision), aucune architecture de persistance, aucune page nouvelle.

---

## Partie A — Recalcul des PurchaseProposals au démarrage

### Le problème

Une `PurchaseProposal` porte des champs dérivés (`lastSafeOrderAt`, `earliestStockoutAt`, `recommendedAction`, `projectedFrancoAt`) calculés au moment de sa dernière écriture. `ensureV34Model()` n'appelait `reconcileProposals()` que sur la toute première initialisation (`!persistedV6`) — un état V6 déjà persisté était chargé tel quel, sans jamais être recalculé. Avec l'horloge réelle (V3.5.1), un état sauvegardé un jour et rouvert plus tard pouvait donc afficher des recommandations calculées sur une date passée.

### La correction

```js
if(!persistedV6){
  reconcileProposals(state);save();
}else{
  reconcileProposals(state,{silent:true,onlyIfChanged:true});
  if(state.__lastReconcileChanged)save();
}
```

`reconcileProposals(s, opts)` gagne deux options, strictement rétrocompatibles (tous les appels existants passent `state` seul, donc `opts={}` par défaut — comportement byte-for-byte identique) :

- **`silent`** : chacun des quatre points de `logActivity()` internes à la fonction est gardé par `if(!silent)`. En mode silencieux, cet appel n'écrit **jamais** dans le Journal, quel que soit ce qui a changé.
- **`onlyIfChanged`** : remplace le déclencheur historique du log de synthèse (`changed`, qui devenait vrai dès qu'au moins une proposition ouverte existait — donc quasi toujours) par un **diff métier réel** (`proposalBusinessSignature`) comparé avant/après l'appel : supplierId, recommendedAction, blocking, subtotal/shipping/total, lastSafeOrderAt/earliestStockoutAt/projectedFrancoAt, et les lignes (article/quantité/prix) — jamais `updatedAt`/`createdAt`/`waitingSince`. Le résultat est exposé via `state.__lastReconcileChanged` (champ transitoire, jamais persisté) pour permettre à l'appelant de décider s'il vaut la peine d'écrire dans `localStorage`.

Aucune `PurchaseOrder`, aucun `StockMovement`, aucun `ScanEvent`, aucun historique n'est jamais touché par `reconcileProposals()` — c'est structurellement garanti : la fonction ne lit/écrit que `s.purchaseProposals`.

Vérifié par test direct (T01) : une proposition injectée avec des dates volontairement obsolètes (`lastSafeOrderAt` 2026-08-17) est bien rafraîchie par un recalcul silencieux, sans qu'aucune `PurchaseOrder` existante ne bouge. Et (T02) : trois recalculs silencieux consécutifs ne créent aucun nouvel `ActivityEvent`.

---

## Partie B — Parser canonique des échéances (`orderDueDate`)

### Le problème

`orderDueDate(o)` existait déjà (introduit avant ce hotfix pour le tri/la charge/`knownDemand`) mais ne comprenait que « Aujourd'hui », « Demain » et les dates absolues françaises (« 17 août »). Or le seed V3.5.1(2) utilise désormais couramment « Après-demain », « Dans N jours », « Hier », « Il y a N jours » (introduits pour éliminer les dates codées en dur). Deux bugs concrets :

1. **Ordre des tests** : `/demain/.test(low)` étant vérifié avant tout test d'« après-demain », et « après-demain » contenant la sous-chaîne « demain », toute échéance « Après-demain » était lue comme J+1 au lieu de J+2.
2. **Formats manquants** : « Dans N jours », « Hier », « Il y a N jours » n'étaient reconnus par aucune branche → la fonction renvoyait `null`. Or `knownDemand()` traite une date non comprise comme un besoin **immédiat** (`if(!d||d<=target)total+=b.qty`) — un faux positif qui aurait pu déclencher des recommandations d'achat prématurées.

### La correction

```js
function orderDueDate(o){
  const raw=(o&&o.due)||'';const low=String(raw).toLowerCase();const now=Clock.now();
  const timeMatch=low.match(/(\d{1,2})[h:](\d{2})/);
  const applyTime=d=>{if(timeMatch)d.setHours(+timeMatch[1],+timeMatch[2],0,0);else d.setHours(23,59,0,0);return d};
  const shiftDays=n=>{const d=new Date(now);d.setDate(d.getDate()+n);return applyTime(d)};
  if(/apr[eè]s[- ]?demain/.test(low))return shiftDays(2);   // AVANT le test "demain"
  if(/demain/.test(low))return shiftDays(1);
  if(/aujourd/.test(low))return shiftDays(0);
  let m=low.match(/il y a\s+(\d+)\s*jours?/);if(m)return shiftDays(-parseInt(m[1],10));
  if(/\bhier\b/.test(low))return shiftDays(-1);
  m=low.match(/dans\s+(\d+)\s*jours?/);if(m)return shiftDays(parseInt(m[1],10));
  // + dd/mm/yyyy et "17 août[ 2026]" (comportement antérieur conservé)
  ...
}
```

Une heure explicite (`14:30` ou `14h30`) est toujours utilisée telle quelle ; en son absence, une heure canonique de **fin de journée** (23:59, jamais minuit — qui aurait fait paraître en retard une commande due plus tard le même jour) est retenue. `isOrderLate()` reste totalement indépendant (`orderFlags(o).late`, un flag figé au seed, jamais dérivé d'une date) : aucune incohérence possible entre les deux, par construction.

**Source unique** : `dueRank()` (tri de la colonne Échéance sur Commandes) et `isDueToday()` s'appuient désormais sur `orderDueDate()` en premier recours (repli sur l'ancien heuristique texte uniquement en cas d'échec de parsing, défensif). `weekStripHTML()` (déjà consommateur historique) a été ajusté pour comparer les dates au niveau du jour calendaire (année/mois/jour) plutôt que par égalité stricte de timestamp, puisque `orderDueDate()` porte désormais une heure réelle et non plus systématiquement minuit.

Vérifié (§17 du mandat, horloge figée 2026-08-31 10:00) : les 6 correspondances exactes demandées (Aujourd'hui/Demain/Après-demain/Dans 3 jours/Hier/Il y a 2 jours) sont validées au jour ET à l'heure près. `knownDemand()` (T07) : une commande « Dans 3 jours » n'est plus comptée comme besoin immédiat à horizon 0, mais entre normalement à horizon suffisant.

---

## Partie C — Suppression du temps figé à l'ouverture (`baseNow`)

`baseNow=Clock.now()` était une constante de module, calculée une seule fois à l'exécution du script (donc à chaque chargement de page, mais figée pour toute la durée de la session). Elle alimentait correctement `minutesAgo()`/`isoDay()` (utilisées uniquement par `seed()`, où une ancre stable pour toute la durée d'un même seed est en fait souhaitable — §21 du mandat), mais **aussi** deux calculs fonctionnels courants, relus à chaque rendu :

- `auditEventsV34()`/`auditEvents()` (Journal) : `baseNow.getTime()-e.daysAgo*86400000` — une session ouverte plusieurs jours aurait affiché des « il y a N jours » ancrés sur l'heure d'ouverture de la page, pas sur l'instant présent.
- `openMonthCalendar()` (Plan de charge) : le marqueur « aujourd'hui » du calendrier utilisait `new Date(baseNow)`.

Correction : `baseNow` devient `let` (au lieu de `const`) et n'est plus qu'une **ancre de seed**, rafraîchie explicitement en première ligne de `seed()` ; les deux calculs fonctionnels ci-dessus lisent désormais `Clock.now()` directement au moment de l'appel. Conséquence directe : un `resetDemoV6()` déclenché un autre jour réel (sans recharger le script) reconstruit un seed calé sur ce nouveau jour — vérifié (T08) en figeant `Clock` sur deux dates successives et en comparant la date d'`expectedAt` de la `PurchaseOrder` de démo `CF-DEMO-EMX` entre les deux resets.

---

## Partie D — QR de production

### Ce qui existait déjà

Le portail cabinet (introduit lors du hotfix confidentialité) affichait déjà un QR (`qrSvg(o.id)`) dans le détail de sa propre commande, et `printFiche(id)` — bien que jamais appelée avant ce hotfix dans le code visité — existait déjà plus loin dans le fichier, générait une fiche imprimable avec QR (`qrSvg(o.id)`, taille CSS 52mm, dans la fourchette 45-55mm visée) et une référence patient opaque en pied de page.

### Ce qui manquait

Le QR n'était accessible que du côté cabinet : la Quick View labo (fiche commande vue depuis le laboratoire) n'avait ni section QR ni bouton d'impression. Ajoutés :

```js
<div class="order-qr"><div class="order-qr-code">${qrSvg(o.id)}</div>
  <div class="order-qr-info"><div class="mini-label">QR de production</div>
  <div class="mini-value">${h(o.id)}</div>
  <div class="mini-sub">À scanner à chaque changement de poste.</div></div></div>
...
<button class="secondary" data-print-fiche="${h(o.id)}">Imprimer la fiche</button>
```

Le gestionnaire de clic `[data-print-fiche]` existait déjà dans le délégué d'événements du labo (partagé avec d'autres actions comme `data-stock-adj`) — il suffisait d'ajouter le bouton, aucun câblage supplémentaire nécessaire.

`printFiche()` a été complétée avec des champs explicites « Commande » et « Référence patient » dans la grille (auparavant seule la référence patient apparaissait, en pied de page) et un libellé de section « QR de production » harmonisé avec la Quick View.

### Confidentialité du QR

Le payload du QR est **strictement** `order.id` — jamais `patientRef`, jamais le nom du patient (que `state.orders` ne porte de toute façon jamais, cf. le store cabinet séparé introduit précédemment). Vérifié par un test qui intercepte temporairement `qrSvg()` (réassignation de la liaison de fonction, comme le fait déjà `installOverrides()` pour `save`/`logAudit`) pour capturer exactement la chaîne encodée lors du rendu de la Quick View **et** de l'impression d'une commande dont le cabinet connaît le nom (« Marie Dupont ») : la seule valeur jamais passée à `qrSvg()` est l'identifiant de commande, et ni le HTML de la Quick View ni celui de la fiche imprimée ne contiennent le nom.

Le QR est stable par construction : `order.id` est assigné une seule fois (`generateOrderId()`) et jamais réassigné ; un scan (`recordScan`) ne le modifie jamais — vérifié par test direct.

---

## Partie E — Compatibilité scan (douchette USB/Bluetooth)

Le workflow de scan (mode Staff, onglet Scan, et le portail Scan autonome `?mode=scan`) fonctionnait déjà exactement selon le principe demandé : un champ texte auto-focalisé (`#staff-scan-input` / `#scan-cmd-input`), un `<form>` qui se soumet sur Entrée, une recherche de la commande par identifiant texte (`state.orders.find(x=>x.id===orderId)`), le poste et le technicien venant du **contexte** (profil du technicien connecté ou session de poste configurée), jamais d'un contenu décodé de QR. Une douchette USB/Bluetooth, qui se comporte comme un clavier tapant `CMD-0205` puis Entrée, fonctionne donc sans aucune modification. Vérifié en navigateur réel : saisie programmatique de l'identifiant + touche Entrée sur le portail Scan crée bien un `ScanEvent` correct.

---

## Partie G — Montant sur tous les boutons d'achat

`todoCardHTML()` (carte « À traiter ») et `renderProposalDetail()` (panneau « Pourquoi ? ») affichaient déjà le montant sur ORDER_NOW (`Commander ${money(p.total)}`) mais un simple « Commander » sans montant sur WAIT — ambigu, puisque cliquer dessus déclenche la même `approveProposal()` qu'un ORDER_NOW. Devient `Commander quand même ${money(p.total)}` aux deux endroits, rendant explicite qu'on passe outre la recommandation. BLOCKED n'affiche toujours aucun bouton Commander (inchangé).

## Partie H — Filtre Échéance

Renommé « Aujourd'hui » → « Aujourd'hui / en retard » dans le `<select>` du filtre À traiter. La logique (`d<=0`, où `d=todoProposalDueDays(p)`) incluait déjà les échéances dépassées — seul le libellé ne le signalait pas.

---

## Portée des changements

| Fonctions modifiées | Fonctions explicitement NON modifiées |
|---|---|
| `ensureV34Model`, `reconcileProposals` (+ `proposalBusinessSignature`), `orderDueDate`, `dueRank`, `isDueToday`, `weekStripHTML`, `knownDemand` (consommateur inchangé, bénéficie du parser corrigé), `baseNow`/`seed`/`auditEvents`/`auditEventsV34`/`openMonthCalendar`, `printFiche`, `_renderQuickView` (section QR + bouton impression), `todoCardHTML`, `renderProposalDetail`, `renderSupplyTodoTab` (libellé filtre) | `computeNeeds`, `decideProposal`, `evaluateSupplierCandidate`, `chooseSupplier`, `approveProposal`, `receivePurchaseOrder`, `cancelPurchaseOrder`, migration V5→V6, persistance (`serializableState`/`v34Save`), gestion fournisseurs, accordéon Outils, Import/Export, `state.cabinetPatients` et son isolation inter-cabinets, `handleStaffScanSubmit`/`handleScanSubmit`/`recordScan` |

Aucune signature de fonction moteur publique n'a changé (à l'exception de `reconcileProposals`, dont le second paramètre `opts` est optionnel et rétrocompatible avec tous les appels existants).
