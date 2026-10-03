# DentalFlow V3.12.2 — Rapport de tests

Tous les tests ci-dessous ont été exécutés avec de **véritables interactions navigateur** (`.click()`,
`.fill()`, `.selectOption()`) — jamais une assignation `.value=` pour tout ce que l'interface médie. Chaque
suite a été rejouée à la fois sur `dentalflow-next-poc-v3.12.2.html` (produit) et sur
`dentalflow-test-labo-v3.12.2.html` (kit).

## Vérification MD5 produit (AVANT / APRÈS)

```
AVANT : 32ce4e69419d6bfae7d191c001d56b37  dentalflow-next-poc-v3.12.1.html
APRÈS : 32ce4e69419d6bfae7d191c001d56b37  dentalflow-next-poc-v3.12.1.html
git diff -- dentalflow-next-poc-v3.12.1.html   →  (vide)
```

## Tests ciblés — MESSAGES (produit + kit, 10/10 chacun)

| Test | Produit | Kit |
|---|---|---|
| MSGRESP01 (1440×900, 0 overflow) | PASS | PASS |
| MSGRESP02 (1024×768) | PASS | PASS |
| MSGRESP03 (768×900) | PASS | PASS |
| MSGRESP04 (650×850) | PASS | PASS |
| MSGRESP05 (430×932) | PASS | PASS |
| MSGRESP06 (390×844) | PASS | PASS |
| MSGRESP07 (sujet long revient à la ligne) | PASS | PASS |
| MSGRESP08 (3 boutons CMD associés reviennent à la ligne) | PASS | PASS |
| MSGRESP09 (message long sans espaces ne casse pas le layout) | PASS | PASS |
| MSGRESP10 (composer utilisable à 390px) | PASS | PASS |

## Tests ciblés — STOCK (produit + kit, 11/11 chacun)

| Test | Produit | Kit |
|---|---|---|
| STOCKUX01 (6 KPI, plus de min-height:114px) | PASS | PASS |
| STOCKUX02 (fiche compacte desktop, <300px de hauteur) | PASS | PASS |
| STOCKUX03 (430px sans overflow) | PASS | PASS |
| STOCKUX04 ("Aucune prestation associée" compact) | PASS | PASS |
| STOCKUX05 (clic Ajuster → Quick View fermée) | PASS | PASS |
| STOCKUX06 (après transition, seule side-window stockAction ouverte) | PASS | PASS |
| STOCKUX07 (Annuler Ajuster → aucune Quick View fantôme) | PASS | PASS |
| STOCKUX08 (Gérer les prestations, même exclusivité) | PASS | PASS |
| STOCKUX09 (toolbar 1024px, aucun chevauchement) | PASS | PASS |
| STOCKUX10 (toolbar 650px) | PASS | PASS |
| STOCKUX11 (toolbar 430/390px) | PASS | PASS |

## Tests ciblés — FACTURES (produit + kit, 6/6 chacun)

| Test | Produit | Kit |
|---|---|---|
| INVUX01 (« À qualifier » sur une ligne) | PASS | PASS |
| INVUX02 (« Par dent » sur une ligne) | PASS | PASS |
| INVUX03 (« Forfait » sur une ligne) | PASS | PASS |
| INVUX04 (aucune modification de pricingModeLabel — seules 3 valeurs connues rendues) | PASS | PASS |
| INVUX05 (prestation non qualifiée reste non commandable) | PASS | PASS |
| INVUX06 (qualification par lot toujours accessible) | PASS | PASS |

## Tests ciblés — UTILISATEURS (produit + kit, 15/15 chacun)

| Test | Produit | Kit |
|---|---|---|
| USRARCH01 (utilisateur legacy sans `active` → considéré actif) | PASS | PASS |
| USRARCH02 (désactivation sans motif → refusée, clic réel sur le formulaire) | PASS | PASS |
| USRARCH03 (DEPART → active=false + archivedAt + motif, via vrai `.selectOption()`+clic) | PASS | PASS |
| USRARCH04 (END_CONTRACT → idem) | PASS | PASS |
| USRARCH05 (OTHER sans commentaire → refusé) | PASS | PASS |
| USRARCH06 (absent de `staffEligibleUsers()`) | PASS | PASS |
| USRARCH07 (absent du sélecteur Scan/Collaborateur) | PASS | PASS |
| USRARCH08 (historique ancien toujours visible) | PASS | PASS |
| USRARCH09 (nombre de LocationEvents/ScanEvents historiques inchangé) | PASS | PASS |
| USRARCH10 (réactivation → active=true) | PASS | PASS |
| USRARCH11 (désactivation du currentUser → CANNOT_DISABLE_CURRENT_USER) | PASS | PASS |
| USRARCH12 (filtre Actifs par défaut) | PASS | PASS |
| USRARCH13 (filtre Désactivés n'affiche que les comptes désactivés) | PASS | PASS |
| USRARCH14 (audit de désactivation + réactivation présent) | PASS | PASS |
| USRARCH15 (aucun splice/delete physique de state.users) | PASS | PASS |

**Total tests ciblés V3.12.2 : 42/42 PASS sur le produit, 42/42 PASS sur le kit (84/84), 0 erreur console.**

## Test visuel réel (captures multi-viewport)

Captures réelles (Playwright, rendu identique produit/kit — même code UI patché à l'identique) :

1. Messages Labo desktop (1440px) — deux colonnes, panneau 900px, aucun débordement.
2. Messages Labo 650px — une colonne, aucun débordement.
3. Messages Labo 390px — une colonne, composer utilisable.
4. Fiche Article après compactage (1440px) — 3 colonnes de KPI, hauteur réduite.
5. Toolbar Stock 650px — lisible, aucun chevauchement.
6. Toolbar Stock 390px — « Nouvel article »/« Réceptionner »/« ⋯ » tous accessibles.
7. Factures > Prestations — badges « À qualifier » sur une ligne.
8. Utilisateurs > Désactivation compte — formulaire réel, motif + commentaire.
9. Utilisateurs > filtre Désactivés — badge gris + motif/date affichés.

Pour chaque capture : `document.documentElement.scrollWidth <= document.documentElement.clientWidth` vérifié
automatiquement (vrai sur les 9 écrans, aux 7 largeurs demandées : 1440/1180/1024/768/650/430/390).

## V3.12.1.1 — Session Scan / Permissions (rejoués sur le kit V3.12.2, 21/21)

Baseline V3.12.1.1 intégralement préservée sur le kit : SCANSESSION01-10, TEST_FIXTURE_PATIENT_RAW_STATE,
TESTPERM01-09 — tous PASS, valeurs identiques à V3.12.1.1 (technicien par défaut Coralie BASTIER, poste par
défaut Modélisation, `testSessionOverride` actif hors `?runTests=1`, attribution « Session test laboratoire »
pour les déplacements manuels sans acteur explicite).

## Scénarios A/B/C (rejoués sur le kit V3.12.2, 15/15, clics réels)

Scénario A (Labo — création, déplacements Réception→Modélisation→Usinage, aucun « Droits insuffisants ») :
6/6. Scénario B (Scan — technicien réel, poste scannable, scan réel, aucune trace de « Marc ») : 5/5.
Scénario C (Réception — blocage immédiat, aucun LocationEvent créé) : 4/4.

## Non-régression complète

| Suite | Produit | Kit |
|---|---|---|
| Suite interne (`?runTests=1`) ×3 | 467/468 ×3 (voir note ci-dessous) | 467/468 ×3 (identique) |
| NAVDOM | 31/31 | 31/31 |
| UI CLICK | 16/16 | 16/16 |
| REC01-06 / FLOW01-09 / CABFLOW01-06 (21 tests) | 21/21 | 21/21 |
| MIGFLOW01-05 | 5/5 | 5/5 |
| SEL01-05 (kit : adapté au roster réel importé, même principe que Mission V3.12.1.1) | 5/5 | 5/5 |
| CABSEL01-02 | 2/2 | 2/2 |
| CABTEETH01-02 | 2/2 | 2/2 |
| EDIT01-04 / DATE01-04 | 8/8 | 8/8 |
| QR01, QR02, QR03, QR05 (QR04 : voir réserve) | 4/4 | 4/4 |
| CABUX01-10 | 10/10 | 10/10 |
| Confidentialité P1-P6 + anti-fuite | 6/6, 0 fuite | 6/6, 0 fuite |

Erreurs console relevées sur l'ensemble de ces runs (produit + kit) : **0**.

### Note sur l'échec unique de la suite interne (467/468) — pré-existant, non lié à ce lot

Le test **« V3.7.1 C01-C04 : Plan de charge »** échoue de façon identique et déterministe sur
`dentalflow-next-poc-v3.12.1.html` **non modifié** (vérifié par comparaison directe, même run, même date) —
dépendance calendaire pré-existante du test (fenêtre de semaine relative à la date système courante), sans
aucun rapport avec les correctifs de ce lot. 467/468 sur le produit V3.12.2 est donc **strictement identique**
à 467/468 sur le produit V3.12.1 non modifié — aucune régression introduite.

### Historique du diagnostic — correctif C (transition Quick View → side-window)

Une première version du correctif C (différer l'ouverture de la side-window jusqu'à la fin de l'animation de
fermeture de la Quick View, ~200ms) a fait chuter la suite interne à 463/468 (5 échecs :
BLOCK01/BLOCK02/BLOCK05, DS11, et une collision indirecte sur « Plan de charge »). Root cause isolée par
inspection directe du test `COM02` (pré-existant, jamais modifié) : celui-ci appelle `_renderQuickView()`
directement sans jamais fermer la Quick View ensuite — comportement sans conséquence avec l'ancien
`openSidePanel()` (qui ne vérifiait jamais l'état de la Quick View), mais qui laissait `#quick-layer` avec la
classe `open`, perturbant tout test synchrone suivant une fois le correctif temporisé introduit. Solution
retenue : fermeture strictement **synchrone** (classe + contenu) au lieu d'une attente temporisée — résout le
bug UX rapporté sans dépendre du temps, 467/468 (écart pré-existant uniquement) confirmé sur 3 runs
consécutifs, sur le produit ET sur le kit.

### QR04 — réserve inchangée

```
QR04 : HARDWARE_REAL_SCAN_NOT_VERIFIED
```

Aucun test caméra réelle sur smartphone physique n'a été effectué dans le cadre de ce lot (environnement
d'exécution sans accès matériel) — identique à V3.12.1/V3.12.1.1.

## Baseline — comptages exacts (produit et kit, inchangés)

```
cabinets: 126   dentists: 91   users: 13   services: 352   suppliers: 19   articles: 515   orders: 10
Répartition : Réception 2 / Modélisation 2 / Usinage 2 / Finition 1 2 / Finition 2 1 / Expédition 1
Stock total (qty) : 1926.5 (identique à V3.12.1/V3.12.1.1)   stockMovements : 515
Aucun compte utilisateur pré-désactivé dans la baseline livrée.
```

DATA01 à DATA15 : **15/15 PASS** sur le kit.

## Clés localStorage dédiées

`dentalflow-test-labo-v3122-state-v1` / `dentalflow-test-labo-v3122-cabinet-patients-v1` — distinctes des
clés V3.12.1 et V3.12.1.1. Amorçage vérifié depuis sa propre baseline au premier lancement.
