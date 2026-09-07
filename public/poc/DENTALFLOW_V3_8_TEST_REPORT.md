# DentalFlow Next V3.8 — Rapport de tests

Base : `dentalflow-next-poc-v3.7.1.html` (166/166 PASS). Livrable : `dentalflow-next-poc-v3.8.html`.

## Suite unitaire intégrée (`?runTests=1`)

**174/174 PASS**, 0 erreur console, stable sur plusieurs exécutions consécutives.

- **166 tests V3.7.1 strictement conservés, inchangés, aucune assertion affaiblie.**
- **1 test explicitement réécrit et documenté comme tel** (`V3.7 Partie F §76` → `V3.8 Partie E (§29-37)`) : l'ancien test attendait les libellés `Création`/`Commande prête`/`Reprise` issus de `historyEvents` ; `orderTimeline()` a été réécrite par mandat explicite du V3.8 pour lire des sources canoniques (`createdAt`, `locationEvents`, `reworks`, …) et produire `Commande créée`/`Prête à livrer`/`Reprise N demandée` — changement de comportement voulu, pas une régression.
- **9 nouveaux tests V3.8**, un par sous-partie testable au niveau moteur.

### Détail des nouveaux tests (valeurs réelles observées)

| TEST | EXPECTED | ACTUAL (extrait) | PASS/FAIL |
|---|---|---|---|
| V3.8 Partie E : orderTimeline() sources canoniques, chronologie stricte, "Prête à livrer", aucun "Scan Réception" | PASS | `hasCreation:true,hasPrint:true,hasReception:true,hasUsinageScan:true,hasCeramiqueScan:true,hasReprise:true,noScanReception:true,noStaleWording:true,chronological:true` | PASS |
| V3.8 Partie F R08 : annulation AVANT consommation (openCancelFlow réel) | physicalStock inchangé, aucun RETURN | `consumedBefore:false,cancelled:true,stockUnchanged:true,noReturn:true` | PASS |
| V3.8 Partie F R09 : annulation APRÈS consommation (openCancelFlow réel) | physicalStock reste diminué, aucun RETURN | `consumed:true,stockDropped:true,cancelled:true,stockStaysDiminished:true,noReturn:true` | PASS |
| V3.8 Partie H : identification auto (1 praticien) vs sélecteur (cabinet groupé) | soleHasHiddenId, groupHasSelect | `soleHasHiddenId:true,soleHasSelect:false,soleHasHeader:false,groupHasSelect:true,groupHasHeader:true,groupOptionCount:3` | PASS |
| V3.8 Partie I : Notification NEW_ORDER, badge Commandes, lecture immédiate | afterCreate=before+1, afterRead=before | `afterCreate===before+1:true, hasUnread:true, afterRead===before:true, stillUnread:false` | PASS |
| V3.8 Partie J/K : conversations 0/1 commande, badge Messages labo | afterGeneral=before+1, afterOrder=before+2, afterRead=before | `generalVisibleForLab:true,linkedToOrder:true,afterOrder===before+2:true,afterRead===before:true` | PASS |
| V3.8 Partie J/K T : isolation cabinet + multi-commandes | isolation refusée, multi visible dans les 2 fiches | `isolationRefused:true,multiSuccess:true,visibleInA:true,visibleInB:true` | PASS |
| V3.8 Partie M : cohérence globale seed V9 (12 scénarios A-L) | chronologie stricte partout, aucun Scan Réception | `orderCount:12,chronologyOk:true,allHaveCreatedAt:true,createdAtIsMinimal:true,noReceptionScan:true`, tous les statuts A-L présents | PASS |
| V3.8 Partie N : petit DataMatrix dans grande photo — décodage entier échoue, décodage recadré réussit | wholeImageFails, croppedDecodes | `wholeImageFails:true,croppedDecodes:true` | PASS |
| V3.8 Partie N : rotations 0/90/180/270° | 4/4 décodées | `0:true,90:true,180:true,270:true` | PASS |
| V3.8 Partie N : applyPhotoVariant("inverted") réellement inversé | before≠after, source non mutée | `before:[0,255],after:[255,0]` | PASS |

## Isolation (export JSON avant/après, même session)

`window.DentalFlowV34.exportDentalFlowJSON()` capturé avant `DentalFlowTest.runAll()` puis après, **dans la même session** (méthodologie corrigée : une comparaison entre deux démarrages séparés produit un faux négatif, les horodatages `createdAt` du seed V9 étant réellement horodatés à `Clock.now()` à chaque démarrage) :

```json
{"identical": true, "testResult": {"pass": true, "total": 174, "passed": 174, "failed": 0}}
```

## Scénarios navigateur réels bout-en-bout (clics/fichiers/flux réels, contexte frais)

- **Moteur `moveOrderToStage`** : déplacement manuel réel, idempotence (2e appel → même nombre de CONSUMPTION), refus scan Réception avec le message exact mandaté, refus permission (utilisateur LECTURE) — 4/4 scénarios corrects, 0 erreur.
- **Bug empreinte physique (Partie G)** : saisie "Marie" survit au clic sur "Physique" ; bascule Numérique→Physique→Numérique ×3 conserve toutes les valeurs ; classes `.active` correctement basculées.
- **Notifications (Partie I)** : soumission réelle d'une commande cabinet → badge "Commandes" passe de 0 à 1, tag "NOUVEAU" visible dans le tableau labo, ouverture de la fiche → badge revient à 0, `notification.readAt` posé.
- **Messagerie (Partie J/K)** : conversation générale (0 commande) créée côté portail → visible côté labo ; conversation liée à 1 commande → visible et taguée `[CMD-xxxx]` ; réponse labo réelle → apparaît côté portail avec `authorType:'LAB'` ; tentative d'associer la commande d'un autre cabinet → refusée (`ORDER_NOT_IN_CABINET`) ; bouton "Messages liés" sur la fiche commande → ouvre directement la bonne conversation.
- **Persistance cold-reload (bug découvert et corrigé)** : avant correctif, `invoices`/`stockLots` passaient de `{3,1}` à `{0,0}` après un simple rechargement de page (localStorage pourtant correctement écrit) ; `dentists`/`services` semblaient "survivre" par coïncidence (ré-ensemencés à l'identique par la migration V6→V7 qui se rejouait à tort à chaque démarrage). Après correctif de `load()` : `{"dentists":6,"services":7,"invoices":3,"stockLots":1,"schemaVersion":9}` strictement identique avant/après reload.
- **Seed V9 (12 scénarios A-L)** : démarrage frais réel → exactement 12 commandes, chronologie strictement croissante sur chacune, aucun "Scan Réception", 4 notifications, 3 conversations, 0 erreur console. Vérifié explicitement : F = "Déplacement manuel vers Céramique" (jamais "Scan"), L = commande annulée avec un vrai `StockMovement` CONSUMPTION et sans aucun RETURN.
- **Scan photo (Partie N)** : DataMatrix généré par `ZXing.DataMatrixWriter`, placé (rotation 90°) dans le coin d'une image 1400×1400 avec du bruit visuel — upload réel via `page.setInputFiles()` sur l'input caché réel → écran "Cadrez le code" affiché avec aperçu visible (bug blob URL corrigé) → cadrage par défaut (centré) → échec attendu et confirmé → cadrage ciblé sur la zone réelle du code → décodage réussi, GTIN/lot/péremption corrects extraits.

## Responsive & console (24 combos : 6 viewports × 4 modes)

`full_regression_6vp.js`, viewports 1440×900/1024×800/768×1024/430×900/390×844/375×812, modes lab/staff/dentist/scan : **24/24 PASS**, 0 erreur console, 0 débordement horizontal.

## Thèmes (12 combos : 4 viewports × 3 thèmes)

`v352_theme_quick.js` : **12/12 PASS**, thème appliqué (light/dark/system) sur Accueil/Commandes/Stock/Rapports, aucun débordement horizontal, 0 erreur console.

## Vérification UX 3 modes (Partie PWA/UX)

| Mode | Viewport | Résultat |
|---|---|---|
| Collaborateur/Staff | 390×844 | Aucune sidebar labo, action "Scanner" visible, aucun débordement horizontal |
| Collaborateur/Staff | 360×800 | Aucun débordement horizontal |
| Portail dentiste | 1440×900 | Aucun débordement horizontal, aucun bouton "Installer DentalFlow" (conforme — pas une PWA) |
| Labo | 1440×900 | Sidebar complète présente, aucun débordement horizontal |
| Labo | 390×844 | Aucun débordement horizontal |

## `node --check`

Le fichier compte **4 blocs `<script>`** — les 4 passent `node --check` sans erreur, vérifié après chaque modification substantielle tout au long de la mission.

## Synthèse Definition of Done (mandat §141, §180)

| Exigence | Statut |
|---|---|
| Localisation dérivée des LocationEvents, jamais du seul dernier scan | ✅ |
| Aucun Scan Réception possible (refusé au niveau moteur) | ✅ |
| Bon imprimé initialise Réception (SYSTEM) | ✅ |
| Scan et déplacement manuel partagent le même moteur (moveOrderToStage) | ✅ |
| Consommation identique scan/manuel (même consumeForScan, idempotent) | ✅ |
| Drag & drop desktop + "Changer la localisation" mobile | ✅ |
| Traçabilité chronologique stricte, "Prête à livrer" jamais "Commande prête" | ✅ |
| Annulation avant consommation : stock inchangé, aucun RETURN | ✅ |
| Annulation après consommation : aucune restitution proposée/créée | ✅ |
| Bug empreinte physique du portail corrigé | ✅ |
| Dentiste identifié automatiquement (compte individuel) / sélecteur (compte groupé) | ✅ |
| Notification NEW_ORDER + badge Commandes fonctionnel | ✅ |
| Messagerie conversations 0/1/N commandes + isolation cabinet | ✅ |
| Badge Messages fonctionnel (labo + portail) | ✅ |
| Scan photo : écran de cadrage systématique, jamais de décodage direct de la photo entière | ✅ |
| Décodage multi-passes (rotation/contraste/inversion/échelle) | ✅ |
| Repli manuel toujours disponible | ✅ |
| Seed V9 : 12 scénarios A-L, chronologie cohérente | ✅ |
| 3 modes UX distincts (labo responsive / staff mobile-first / dentiste desktop) | ✅ (vérifié, hérité de V3.3+) |
| Toutes les fonctions V3.7.1 non liées préservées | ✅ |
| Tests existants PASS | ✅ (166/166, 1 réécriture documentée) |
| Nouveaux tests PASS | ✅ (9/9 dont 3 tests Partie N) |
| Responsive PASS | ✅ (24/24) |
| `node --check` PASS | ✅ (4 blocs) |
| Zéro erreur console | ✅ |
| Isolation des tests (export JSON identique) | ✅ |
| Mapping SaaS produit (sans SQL) | ✅ (`DENTALFLOW_V3_8_SAAS_MAPPING.md`) |
