# DentalFlow Next V3.8.2 — Rapport de tests

Base : `dentalflow-next-poc-v3.8.1.html` (185/185 PASS). Livrable : `dentalflow-next-poc-v3.8.2.html`.

## Suite unitaire intégrée (`?runTests=1`)

**238/238 PASS**, 0 erreur console, stable sur plusieurs exécutions consécutives.

- **185 tests V3.8.1 conservés**, dont **1 explicitement réécrit et documenté comme tel** (changement de comportement métier explicite du mandat V3.8.2 Partie A §7, jamais une régression silencieuse) :
  - Navigation Outils : l'ancien test attendait `['Charge','Stock','Rapports','Factures','Utilisateurs']` (5 entrées) ; réécrit pour vérifier `['Charge','Stock','Rapports','Factures','Cabinets','Utilisateurs']` (6 entrées, l'ajout de la page Cabinets) — assertion strictement **plus complète**, jamais affaiblie.
- **53 nouveaux tests V3.8.2**, couvrant les Parties A/C/D/E/F/G/H/I sous les identifiants demandés par le mandat.

### Détail par partie (identifiants mandat)

| ID | Objet | Résultat (extrait réel) |
|---|---|---|
| C01 | Une seule carte « Demandes & simulation », un seul tableau | `oneCard:true,oneTable:true,hasSummary:true` |
| C02 | Colonnes Type/Collaborateur/Période/Jours/Motif/Impact capacité/Simulation/Décision-Actions + Inclure/Approuver/Refuser | `cols:true,hasApprove:true,hasInclude:true` |
| C03 | `approveLeave()` transitionne + retire de la liste à valider | `hadRow:true,nowApproved:true,absenceCreated:true,rowGone:true` |
| C04 | Projection 8 semaines / Absences planifiées restent séparées | `hasProjection:true,hasAbsences:true,hasMerged:true` |
| U01/U02 | Tri par Nom puis par Prénom | `sorted:true` (les deux) |
| U03 | Filtre par permission — ne garde que les utilisateurs habilités | `allHavePerm:true,someExcluded:true` |
| U04 | Recherche nom/prénom/email | `byFirst:true,byEmail:true` |
| U05 | Colonne Droits — compteur exact + popup avec le vrai nom | `hasCorrectCount:true,hasName:true` |
| CAB01 | `migrateV9toV10()` — cabinets uniques + `cabinetId` backfillé | `namesOk:true,idsBackfilled:true,allActive:true` |
| CAB02 | archive/désarchive — statut réel | `activeAtCreation:true,inactiveAfterArchive:true,activeAfterUnarchive:true` |
| CAB03 | create/update réels persistés | `createOk:true,updateOk:true` |
| CAB04 | delete refusé si utilisé, accepté sinon | `unusedDeleted:true,usedRefused:true` |
| CAB05 | Archivé exclu du select, visible sur commande historique | `excludedFromSelect:true,stillOnHistoricalOrder:true` |
| CAB06 | Permissions cabinets.view/manage + libellés FR | `hasView:true,hasManage:true` |
| CAB07 | Migration idempotente (pas de doublon) | `countAfterFirst:1,countAfterSecond:1` |
| O01 | `workInstructions` alimenté par Notes Lab **et** Cabinet | `labOk:true,cabOk:true` |
| O02 | Bloc Travail (Prestation/Dents/Teinte) présent | `hasBlock:true` |
| O03 | Bloc Indications présent seulement si non vide | `withOk:true,withoutOk:true` |
| O04 | Bon de suivi affiche aussi les indications | `hasIndications:true` |
| O05 | Feedback scan porte CMD/Patient/Prestation/Dents/Teinte/Indication | `hasAll:true` |
| F01 | Brouillon → « Prévisualiser », jamais « Émettre » en direct | `hasPreview:true,noDirectIssue:true` |
| F02 | `invoiceDocumentHTML()` — document unifié complet | `pass:true` |
| F03 | `issueInvoice()` — DRAFT jusqu'à l'appel explicite | `stillDraft:true,nowIssued:true` |
| F04 | Aperçu — actions adaptées au statut (DRAFT vs ISSUED) | `draftHasIssue:true,issuedHasPrintPdfSend:true,issuedHasNoIssueBtn:true` |
| F05 | `cabinetSnapshot` figé — modification du cabinet sans effet rétroactif | `createOk:true,cabActuallyUpdated:true,unaffected:true` |
| F06 | PDF réel (en-tête `%PDF-`) | `magic:"%PDF-"` |
| FC01 | Portail Cabinet — liste isolée (jamais DRAFT, jamais un autre cabinet) | `hasIssued:true,noDraft:true,noOtherCab:true` |
| FC02 | Document complet identique à `invoiceDocumentHTML` | `pass:true` |
| FC03 | Jamais Modifier/Émettre/Pointer/Annuler côté Cabinet | `hasPrint:true,hasPdf:true,hasNoForbidden:true` |
| FC04 | Garde-fou moteur — refuse DRAFT et autre cabinet même par id valide | `draftRefused:true,crossCabinetRefused:true,ownCabinetAllowed:true` |
| FC05 | Même `downloadInvoicePDF()` que le Lab | `pass:true` |
| N01 | Fusion feed — badge = longueur du feed | `isArray:true,allHaveCategory:true` |
| N02 | 7 filtres présents | `pass:true` |
| N03 | Dédoublonnage — commande NEW_ORDER + en retard = 1 ligne, rouge, NOUVEAU | `count:1,severity:"red",isNew:true` |
| N04 | Filtre par catégorie | `pass:true` |
| N05 | Clic commande → `openQuickView` + notification marquée lue | `nowRead:true,quickOpen:true` |
| N06 | Clic message → conversation sélectionnée + marquée lue | `nowRead:true` |
| N07 | Auto-résolution — situation dérivée disparaît sans action | `before:true,after:false` |
| N08 | Badge à zéro quand rien à signaler | `feedLen:0` |
| D01/D02 | `ensureDentistOrderDraft()`/`resetDentistOrderDraft()` — persistance et reset contrôlé | `pass:true` (les deux) |
| D03/D04 | Bascule Empreinte — ne touche QUE impressionMode+visibilité, jamais `renderDentistMode()` | `touchesOnlyExpected:true,neverRerenders:true` |
| D05 | Choix de date — jamais `renderDentistMode()` | `updatesDraft:true,neverRerenders:true` |
| D06 | Reproduction exacte §65 (Marie/Dupont/PHYSICAL) | `order:{patientFirstName:"Marie",patientLastName:"Dupont",impressionMode:"PHYSICAL"}` |
| D07 | Reset du brouillon uniquement après création réussie | `beforeSubmitStillThere:true,afterSubmitReset:true` |
| V01 | `orderVisualState()` — priorité stricte des 7 états | `late:"late",lateAndBlocked:"late",...,cancelled:"cancelled"` |
| V02 | `renderTable()` — classe `ovs-<état>` par ligne | `pass:true` |
| V03 | `renderOrderCards()` — classe `ovs-<état>` par carte | `pass:true` |
| V04 | Accessibilité — texte/pastille toujours présent, jamais la couleur seule | `pass:true` |
| V05 | Commande nouvelle — `ovs-new` + badge NOUVEAU (table et carte) | `vs:"new",trHasClass:true,cardHasClass:true,tableHasBadge:true,cardsHasBadge:true` |
| V06 | Ouverture → notification lue, `ovs-new` disparaît, état métier reste | `before:"new",after:"ready",stillReadyAfter:true` |
| V07 | Retard + Nouvelle — rouge prioritaire, badge NOUVEAU persiste | `vs:"late",trIsLate:true,hasBadge:true` |

D01-D07 sont doublés par un scénario navigateur réel bout-en-bout (voir ci-dessous) reproduisant le clic/la frappe utilisateur exacts du terrain, plutôt qu'un simple appel de fonction.

## Isolation (export JSON avant/après, même session)

`window.DentalFlowV34.exportDentalFlowJSON()` capturé avant `DentalFlowTest.runAll()` puis après, **dans la même session** (méthodologie V3.8/V3.8.1 reconduite) :

```json
{"identical": true, "testResult": {"total": 238, "passed": 238, "failed": 0}}
```

Chaque nouveau test créant un objet réel (cabinet/commande/facture/congé approuvé) restaure l'état complet par snapshot/rollback (`bak=cloneDeep(serializableState())` … `Object.assign(state,{...state,...bak})`), y compris le journal d'audit append-only (`activityEvents`/`historyEvents`) — aucune trace d'exécution des tests ne subsiste dans l'état applicatif.

**Correction découverte pendant cette vérification** : `serializableState()` n'incluait pas `state.cabinets` avant ce contrôle — corrigée dans le livrable (voir rapport d'implémentation, section « Correction annexe »), sans quoi l'entité Cabinets aurait été absente de tout export/sauvegarde JSON.

## Scénarios navigateur réels bout-en-bout (clics/flux réels, contexte frais)

- **P0 formulaire Cabinet (§65 exact)** : `Marie`/`Dupont` saisis via `page.fill`, sélection Couronne zircone (change réel), sélection teinte A2, sélection dent 14 via le sélecteur de dents, clic sur une date proposée, clic PHYSIQUE, aller-retour DIGITAL→PHYSICAL, soumission réelle du formulaire (`dispatchEvent(submit)`) → à chaque étape intermédiaire, Nom/Prénom **restent renseignés dans le DOM** (vérifié après le changement de prestation ET après le choix de date) ; commande créée avec `patientFirstName:"Marie"`, `patientLastName:"Dupont"`, `impressionMode:"PHYSICAL"`, `shade:"A2"`, `teeth:["14"]`, brouillon réinitialisé après coup seulement. 0 erreur console.
- **Fiche commande — bloc Travail/Indications** : commande Lab créée avec Notes réelles → `order.workInstructions` correctement alimenté, fiche ouverte affiche le bloc « Travail » (dents/teinte) et le bloc « Indications / remarques » avec le texte exact saisi. 0 erreur console.
- **Cabinets — cycle de vie complet** : migration V9→V10 sur seed réel (5 cabinets dérivés des commandes/dentistes existants, tous `cabinetId` backfillés), page Cabinets rendue (table desktop), création réelle d'un nouveau cabinet via le formulaire side-window, modification réelle (ville), archivage (disparaît du select « Nouvelle commande »), suppression d'un cabinet inutilisé acceptée, suppression d'un cabinet utilisé refusée (`IN_USE`). 0 erreur console.
- **Facture — aperçu avant émission (flux réel)** : liste Factures affiche « Prévisualiser » (jamais « Émettre ») pour un Brouillon → clic ouvre l'aperçu plein écran avec le document complet → clic « Émettre la facture » (le seul chemin qui appelle `issueInvoice()`) → statut passe réellement à ISSUED, `issuedAt` posé → aperçu rouvert sur la même facture affiche désormais Imprimer/Télécharger PDF/Envoyer au cabinet, plus aucun bouton Émettre/Modifier la sélection. 0 erreur console.
- **Portail Cabinet — factures + PDF réel + isolation croisée** : facture émise pour le cabinet A (via les vrais clics de la liste « À facturer » → case à cocher → « Créer la facture » → aperçu → « Émettre »), portail Cabinet ouvert sur le cabinet A, clic sur la facture dans « Factures » → document complet affiché (aucun bouton Modifier/Émettre/Pointer/Annuler), clic « Télécharger PDF » → **téléchargement réel intercepté par Playwright**, fichier `FAC-XXXX.pdf` de 5 369 octets commençant par la signature binaire `%PDF-` (jamais un HTML imprimé). Isolation croisée testée avec deux fausses factures injectées directement en state (un Brouillon et une facture Émise d'un « Cabinet Isolation Test XYZ ») : `cabinetCanAccessInvoice()` refuse les deux pour le cabinet A, la liste rendue pour le cabinet A ne les contient jamais, et un bouton `data-dinvoice-print` **injecté manuellement dans le DOM** pointant vers la facture d'un autre cabinet est bien bloqué par le gestionnaire de clic (le vrai `printInvoice()` n'est jamais appelé) — preuve que le garde-fou est au niveau moteur, pas seulement dans la liste affichée. 0 erreur console.
- **Centre de notifications — cloche réelle** : bouton `#notif-btn` présent et visible sur Accueil, badge = `buildNotificationFeed().length` exact, clic ouvre la side-window avec les 7 filtres, dédoublonnage vérifié (une commande à la fois « Nouvelle » et « En retard » n'apparaît qu'une fois, en rouge, badge NOUVEAU conservé), clic sur une ligne commande ouvre bien la fiche et marque la notification lue, auto-résolution vérifiée (le flag levé fait disparaître la situation du feed suivant sans action). Bascule desktop/mobile vérifiée par mesure réelle (`getComputedStyle`) : à 1440px seul `#notif-btn` est visible (46×46), à 390px seul `#notif-btn-mobile` l'est (38×38) — jamais les deux cloches simultanément. 0 erreur console.

## Responsive & console (28 combos : 7 viewports × 4 modes)

`v382_full_regression_7vp.js` (dérivé du script V3.8.1, viewports mis à jour selon le mandat V3.8.2), viewports **1440×900 / 1366×768 / 1024×800 / 768×1024 / 430×932 / 390×844 / 375×812**, modes lab/staff/dentist/scan : **28/28 PASS**, 0 erreur console, 0 débordement horizontal.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

`v352_theme_quick.js`, viewports 1440×900/1024×800/768×1024/390×844, thèmes light/dark/system, vues home/orders/stock/reports : **12/12 PASS**, thème appliqué correctement, 0 débordement, 0 erreur console.

## `node --check` — syntaxe des 5 blocs `<script>`

Tous les blocs, y compris le nouveau bloc jsPDF embarqué (Partie F), passent `node --check` sans erreur :

```
0 56 724 octets   OK  (QR code generator)
1 362 376 octets  OK  (ZXing)
2 366 143 octets  OK  (jsPDF — nouveau)
3 304 778 octets  OK  (config / base script)
4 579 013+ octets OK  (implémentation V3.4+)
```

## Console — 4 types d'erreurs recherchées

`pageerror` et `console.error` collectés sur **toutes** les exécutions ci-dessus (suite unitaire, 28 combos responsive, 12 combos thème, 7 scénarios bout-en-bout, migration V9→V10, cycle de vie Cabinets) : **0 occurrence**, aucune des 4 catégories mandatées (erreur JS non interceptée, erreur console explicite, avertissement de rendu React/DOM invalide, promesse rejetée non gérée) n'a été observée.

## Non-régression V3.8.1 (Partie J)

Les 185 tests V3.8.1 sont exécutés dans la même suite et **tous passants** (1 seul réécrit, documenté ci-dessus comme extension stricte, jamais un affaiblissement). Aucune des fonctions listées comme hors-périmètre (`repairLegacyTraceabilityV9`, `repairLegacyLifecycleDates`, `orderTimeline`, fusion démarrage/Réception, invariant Scan Réception, cycles de reprise, localisation manuelle, `moveOrderToStage`, garde-fous moteur associés) n'a été modifiée — confirmé par grep ciblé sur le diff, aucune occurrence de ces noms de fonction dans les zones éditées de V3.8.2 hors leurs définitions d'origine inchangées.
