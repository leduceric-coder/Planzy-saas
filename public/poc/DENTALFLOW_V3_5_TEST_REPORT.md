# DentalFlow Next V3.5 — Rapport de tests

Base : `dentalflow-next-poc-v3.4.5.html` (non modifiée, conservée telle quelle).
Fichier testé : `dentalflow-next-poc-v3.5.html`.
Exécution : Playwright / Chromium headless (`/opt/pw-browsers/chromium`), suite unitaire interne (`?runTests=1`) + interactions DOM réelles (clics, formulaires) + contextes navigateur neufs pour la persistance et la migration.

## Synthèse

**67/67 tests PASS** (46 tests moteur conservés de la V3.4.5, aucune assertion affaiblie ni supprimée + 21 nouveaux tests V3.5 UX/navigation/fournisseurs). **0 erreur console.** **Responsive 16/16** (4 largeurs × 4 modes). **Thèmes clair/sombre/système** conformes sur toutes les nouvelles pages. **Isolation** : `exportDentalFlowJSON()` avant/après `runAllTests()` → identique.

## 1. Non-régression moteur — 46 tests V3.4.5 (aucun modifié)

Tous les tests hérités restent **PASS** sans aucune modification d'assertion, y compris les tests particulièrement sensibles explicitement désignés par le mandat (§102) :

| Test | Résultat |
|---|---|
| Supplier viability A/B/C (V3.4.5, 4 tests seconde passe computeNeeds) | PASS |
| WAIT → ORDER_NOW strict 5→9 | PASS |
| BLOCKED (sans fournisseur/tarif, sans prix) | PASS |
| Minimum de commande + urgence + alternatif (avec/sans) | PASS |
| Franco null jamais interprété comme atteint | PASS |
| PO cancelled / received / partially_received | PASS |
| Réception partielle 9→8, annulation retire reliquat | PASS |
| legacyIncoming (fournisseur inconnu, flags) | PASS |
| Migration V5→V6 (qty 10/incoming 5, sentinelle 45/12) | PASS |
| Persistance (Reset natif V6 supprime toute donnée custom) | PASS |
| knownDemand incrémentale (aucune constante codée) | PASS |
| Consommation au double scan idempotente | PASS |
| Privacy (patientRef opaque, aucun champ nom patient) | PASS |

Liste complète des 46 tests conservés : voir `DENTALFLOW_V3_4_5_TEST_REPORT.md` (rejouée intégralement à l'identique dans cette exécution, aucune régression).

## 2. Nouveaux tests V3.5 (21)

### 2.a Accordéon Outils (§80-81 du mandat)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 47 | Ouvre et ferme réellement, ne se rouvre jamais tout seul | `state.toolsOpen` seul source de vérité ; fermeture respectée même sur une page Outils active, y compris après un `renderNav()` supplémentaire | `{"openNow":true,"closedAfterToggle":true,"domClosed":true,"panelClosed":true,"stillClosed":true}` | PASS |
| 48 | `aria-expanded` reflète l'état réel | `true` ouvert / `false` fermé | `{"openAria":true,"closedAria":true}` | PASS |

### 2.b Navigation (§82-84)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 49 | Outils = Plan de charge / Stocks & achats / Rapports / Utilisateurs uniquement | Liste exacte, aucune entrée Achats/Journal | `{"toolsLabels":["Plan de charge","Stocks & achats","Rapports","Utilisateurs"],"noPurchases":true,"noActivity":true}` | PASS |
| 50 | Redirection `view=purchases` → Stocks & achats / À traiter | `state.view==='stock'`, `supplyTab==='todo'`, contenu rendu | `{"view":"stock","supplyTab":"todo","hasContent":true}` | PASS |
| 51 | Redirection `view=activity` → Rapports / Journal | `state.view==='reports'`, `reportsTab==='journal'`, contenu rendu | `{"view":"reports","reportsTab":"journal","hasContent":true}` | PASS |

### 2.c Gestion fournisseurs (§85-90)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 52 | Création (nom, contact, email, délai 3, transport 12, franco vide→null, minimum 100) | Fournisseur créé, `active=true`, `freeShippingThreshold===null`, ActivityEvent créé | `{"found":true,"active":true,"francoNull":true,"leadOk":true,"shipOk":true,"minOk":true,"contactOk":true,"emailOk":true,"countGrew":true,"activityLogged":true}` | PASS |
| — | Persistance réelle (rechargement à froid, contexte navigateur neuf) | Champs `contactName/email/phone/website` intacts après reload | `{"found":true,"contactName":"Bob Martin","email":"bob@example.test","phone":"0102030405","website":"https://example.test"}` (voir §5) | PASS |
| 53 | Modification (délai 3→2, transport 12→9) | Mis à jour, `reconcileProposals` appelé, ActivityEvent créé | `{"leadUpdated":true,"shipUpdated":true,"activityLogged":true}` | PASS |
| 54 | Suspension | `active=false`, PO existantes visibles, tarif retiré des candidats (`tariffsForArticle`) | `{"active":false,"poVisible":true,"stillReferenced":true,"notCandidate":true}` | PASS |
| 55 | Réactivation | `active=true`, redevient candidat | `{"active":true,"beforeCandidate":false,"afterCandidate":true}` | PASS |
| 56 | Aucun bouton Supprimer dans la fiche | Absent du HTML | `{"hasDelete":false}` | PASS |
| 57 | Tarif préféré (`submitTariffForm`) retire le préféré des autres | A→false, B→true | `{"aPreferred":false,"bPreferred":true}` | PASS |

### 2.d « À traiter » / « Pourquoi ? » / « Commander » (§91-93)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 58 | ORDER_NOW et BLOCKED visibles, NO_ACTION jamais affiché, aucun code moteur visible | Fixture A/B/C réelle (ORDER_NOW + BLOCKED sans tarif + NO_ACTION consommation nulle) | `{"orderVisible":true,"blockedVisible":true,"noActionHidden":true,"noCodesLeaked":true}` | PASS |
| 59 | « Pourquoi ? » affiche les données réelles du moteur (physique/disponible) | Panneau ouvert, aucune donnée recalculée en parallèle | `{"found":true,"showsPhysical":true,"showsAvailable":true,"panelOpen":true}` | PASS |
| 60 | « Commander » réutilise `approveProposal()`, absent sur BLOCKED | Carte ORDER_NOW → bouton présent → PO créée ; carte BLOCKED → bouton absent | `{"cardHasApprove":true,"poCreated":true,"blockedFound":true,"noApproveOnBlocked":true}` | PASS |

### 2.e Rapports / Journal (§94)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 61 | Indicateurs (graphiques) et Journal (ActivityEvents, aucun store supplémentaire) | Graphique présent, nouvel événement visible immédiatement dans Journal | `{"hasCharts":true,"eventVisible":true}` | PASS |

### 2.f Import/Export UX (§95-100)

| # | TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|------|----------|--------|-----------|
| 62 | Écran initial Données = 2 actions seulement, JSON absent | `hasImport`, `hasExport`, aucun bouton JSON/CSV visible | `{"hasImport":true,"hasExport":true,"noJsonVisible":true}` | PASS |
| 63 | Parcours import en 6 étapes nommées (Type/Fichier/Correspondances/Aperçu/Vérification/Résultat), une action primaire par étape | 1 seul `.big-primary` par étape | `{"primaryButtons":1,"labelsPresent":true}` | PASS |
| 64 | Mapping entièrement reconnu → confirmation compacte, 0 select affiché par défaut | `hasConfirmation:true`, `selectCount:0` | `{"hasConfirmation":true,"selectCount":0}` | PASS |
| 65 | Colonne obligatoire non reconnue → Continuer bloqué, colonnes problématiques visibles | `nextDisabled:true`, colonnes affichées | `{"nextDisabled":true,"warnsAttention":true,"showsProblemCols":true}` | PASS |
| 66 | Export : liste des 7 catégories métier, JSON absent au premier niveau | Toutes catégories présentes, aucun bouton JSON | `{"allPresent":true,"noJson":true}` | PASS |
| 67 | Options avancées : JSON accessible + avertissement avant restauration | Export/restauration présents, avertissement affiché, `exportDentalFlowJSON()` fonctionnel | `{"hasExportJson":true,"hasImportJson":true,"hasWarning":true,"jsonWorks":true}` | PASS |

## 3. Persistance — contexte navigateur neuf (rechargement à froid réel)

| TEST | EXPECTED | ACTUAL | PASS/FAIL |
|---|---|---|---|
| Champs fournisseur V3.5 (`contactName/email/phone/website`) survivent à un rechargement complet | Valeurs identiques après reload, sans second store | setup: `{"pass":true}` → reload → verify: `{"pass":true,"found":true,"contactName":"Bob Martin","email":"bob@example.test","phone":"0102030405","website":"https://example.test"}` | PASS |
| Persistance générique (mouvement/PO/note/ActivityEvent custom) | Inchangé depuis V3.4.5 | `{"pass":true,"mov":true,"act":true,"po":true,"notes":true}` | PASS |
| Migration V5→V6 (qty 10/incoming 5), rechargement ×2 (idempotence) | Inchangé | `{"pass":true,"schemaVersion":6,"openings":1,"legacyIncomingPOs":1}` (×2, identique) | PASS |
| Premier démarrage réel (localStorage vide) | Inchangé, Zircone=5 | `{"schemaVersion":6,"zirconePhys":5,"migrationV5MovementsCount":0}` | PASS |
| legacyIncoming / sentinelle 45/12, rechargement à froid ×2 | Inchangé, idempotent | `identical:true` (les deux) | PASS |

## 4. Responsive — 16/16 (4 largeurs × 4 modes)

| Largeur | lab | staff | dentist | scan |
|---|---|---|---|---|
| 1440px | PASS | PASS | PASS | PASS |
| 1024px | PASS | PASS | PASS | PASS |
| 768px | PASS | PASS | PASS | PASS |
| 390px | PASS | PASS | PASS | PASS |

Le smoke-test embarqué (`?smokeV34=1`) a été étendu pour couvrir explicitement les 4 nouveaux onglets Stocks & achats (À traiter/Stock/Commandes/Fournisseurs) et les 2 onglets Rapports (Indicateurs/Journal) à chaque largeur — **ALL_OK: true**, 0 erreur console/page sur l'ensemble de la matrice.

## 5. Thèmes clair / sombre / système

Vérifiés via `?theme=light|dark|system` (mécanisme déjà existant) sur les nouvelles pages (Stocks & achats, fiche/formulaire Fournisseur, Rapports/Journal, Données Import/Export) à 1440px et 1024px (largeurs où le panneau de navigation desktop est visible) : `document.documentElement.dataset.theme` correctement appliqué, aucun débordement horizontal, **0 erreur console** sur les 3 thèmes. Les 4 largeurs (y compris 768/390, où le panneau desktop se replie selon le comportement responsive préexistant de l'application) sont couvertes indépendamment via le smoke-test embarqué du §4, qui exerce les mêmes pages sans dépendre de l'interaction avec la barre latérale.

## 6. Console

Sur l'intégralité des exécutions (suite unitaire, non-régression moteur, nouveaux tests V3.5, persistance à froid, migration, responsive, thèmes) : **0 `SyntaxError`, 0 `ReferenceError`, 0 `TypeError`, 0 `Unhandled rejection`**.

## 7. Vie privée

Grep direct : `patientName|patient_name|nomPatient|patientFirstName|patientLastName` → **0 occurrence**. Le nouveau champ téléphone (`phone`) concerne exclusivement le modèle Fournisseur (`state.suppliers`), jamais un patient — confirmé par relecture du code (aucun champ `phone` n'a été ajouté au modèle `Order`/`patientRef`).

## 8. Non-hardcoding

Audit ciblé sur les 8 fonctions moteur + 3 fonctions fournisseur nouvelles (`submitSupplierForm`, `setSupplierActive`, `submitTariffForm`) : aucune occurrence de `SUP-IVOCLAR`, `SUP-HENRY`, `ART-ZIR-HT-001` en dehors des deux littéraux légitimes de la commande de démonstration `CF-DEMO-EMX` (seed préexistant, non touché). `nextSupplierId()` génère des identifiants génériques (`SUP-001`, `SUP-002`…), jamais un nom de fournisseur codé en dur.

## Synthèse finale

- **67/67 tests PASS** (46 moteur conservés + 21 nouveaux V3.5)
- **Accordéon Outils** : bug corrigé, ouvre et ferme réellement, jamais de réouverture automatique
- **Navigation** : Achats et Journal ne sont plus des entrées autonomes ; redirections transparentes
- **Stocks & achats** : 4 onglets, À traiter par défaut, langage traduit, complexité révélée uniquement dans « Pourquoi ? »
- **Fournisseurs** : création/modification/suspension/réactivation opérationnelles, jamais de suppression, persistance réelle confirmée
- **Rapports/Journal** : un seul journal logique, source unique `activityEvents`
- **Données** : parcours guidé, une action primaire par étape, JSON relégué en Options avancées
- **Responsive 16/16, thèmes conformes, console 0 erreur, vie privée conforme, aucune régression moteur**
