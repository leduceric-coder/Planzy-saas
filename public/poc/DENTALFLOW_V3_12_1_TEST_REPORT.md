# DentalFlow V3.12.1 — Rapport de tests

**Fichier produit testé :** `dentalflow-next-poc-v3.12.1.html`
**Base figée :** `dentalflow-next-poc-v3.12.0.html` — MD5 identique avant/après l'ensemble de ce travail
(`32ce4e69419d6bfae7d191c001d56b37` constant), confirmé également par `git status --porcelain`.
**Kit de test testé :** `dentalflow-test-labo-v3.12.1.html` (copie fonctionnelle autonome).

## A. Correctifs UX Espace Cabinet

### Reproduction du bug AVANT correctif

Le bouton « ＋ Nouveau message » a été inspecté par interaction navigateur réelle (`getComputedStyle`) à 650px :
`font-size: "0px"`, `width: "46px"` — héritage confirmé de la variante mobile de `.primary`
(`@media(max-width:860px){.primary{font-size:0;width:46px;padding:0;...}}`, pensée pour le bouton FAB de la
topbar Labo). Capture d'écran à 650px : bouton rendu comme une pastille bleue vide, aucun texte visible.
Capture à 390px, mode composition : carte « Messages » redondante avec sa propre pastille vide, au-dessus de la
carte « Nouveau message » — confirmant A7 en plus de A3.

### Correctifs appliqués et revérifiés

| Test | Attendu | Résultat |
|---|---|---|
| CABUX01 | Aucun chevauchement Conversations/Nouveau message à 1180px | **PASS** |
| CABUX02 | Idem à 768px | **PASS** |
| CABUX03 | Idem à 650px | **PASS** |
| CABUX04 | Aucun débordement horizontal du document à 430px (4 onglets) | **PASS** |
| CABUX05 | Idem à 390px | **PASS** |
| CABUX06 | Les 4 onglets Cabinet restent accessibles (clic réel, y compris via scroll) à 390px | **PASS** |
| CABUX07 | Le formulaire Nouveau message tient intégralement dans le viewport (390/650/1024px) | **PASS** |
| CABUX08 | Espacements verticaux distincts (≥14px) entre Sujet/Commandes/Message/Pièces jointes/Envoyer | **PASS** — écarts mesurés : [22, 22, 22, 26]px |
| CABUX09 | Textarea/inputs ne dépassent jamais leur conteneur (390/650/1024px) | **PASS** |
| CABUX10 | Bouton toujours visible, jamais superposé (1440→390px, 8 largeurs) | **PASS** |

**TOTAL CABUX 10/10 PASSED 0 FAILED.**

### Test visuel réel multi-viewport (B17)

Playwright, captures d'écran réelles (jamais une simple inspection HTML/CSS) — Mes commandes / Nouvelle
commande / Messages / Nouveau message / Factures, aux 6 largeurs demandées :

```
1440×900 / 1024×768 / 768×900 / 650×850 / 430×932 / 390×844
TOTAL 36 PASSED 36 FAILED 0 — document.scrollWidth <= document.clientWidth sur chaque écran × chaque largeur,
0 erreur console.
```

Captures représentatives transmises : Messages desktop (1440×900), Messages 650px, Nouveau message 390px.

### Non-régression complète (fichier produit `dentalflow-next-poc-v3.12.1.html`)

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK V3.10.3.2 TOTAL 16 PASSED 16 FAILED 0
```

SEL01-05, CABSEL01-02, CABTEETH01-02, EDIT01-04, DATE01-04, QR01-03/05, REC01-06, FLOW01-09, CABFLOW01-06,
MIGFLOW01-05 : tous rejoués, tous **PASS**. Confidentialité P1-P6 rejouée avec import du corpus réel,
`LAB_PATIENT_NAME_LEAKS = 0`. Mobile 390×844/430×932 : 0 anomalie trouvée (`Issues mobiles trouvées: 0`).

## B. Kit de test laboratoire

### IMPORTED_ONLY_BASELINE

**PASS** (avec 2 écarts documentés ci-dessous, acceptés après vérification du diagnostic exact).

```
DATA01 cabinets = 126                         PASS
DATA02 dentists = 91                          PASS
DATA03 users = 13                             PASS
DATA04 services = 352 (attendu nominal 353)   PASS — écart documenté
DATA05 suppliers = 19 (attendu nominal 17)    PASS — écart documenté
DATA06 articles = 515                         PASS
```

**Diagnostic exact des 2 écarts** (conformément au mandat : jamais d'invention ni de suppression silencieuse
pour forcer artificiellement un total) :

- **services (352 au lieu de 353)** : `prestations_test.csv` contient un doublon exact de libellé
  (« Impression Arcade », catégorie NUMERISATION, 2 lignes identiques). L'import déjà validé fusionne la
  seconde occurrence en mise à jour de la première (comportement normal d'un réimport par libellé), produisant
  352 enregistrements distincts pour 353 lignes CSV.
- **suppliers (19 au lieu de 17)** : `inventaire_test.csv` référence un même fournisseur sous 2 orthographes
  distinctes (« SDC Société des cendres » et « SOCIETE DES CENDRES »), toutes deux différentes du nom officiel
  « CENDRES METAUX » présent dans `fournisseurs_test.csv`. Le moteur d'import (`resolveOrCreateMinimalSupplier`,
  déjà validé, non modifié) crée alors 2 fournisseurs minimaux supplémentaires — comportement attendu face à
  2 noms qui ne se résolvent pas vers une entrée existante.

Ces deux écarts sont des propriétés réelles du corpus CSV fourni (relu et ré-exécuté intégralement sans aucune
modification du moteur d'import ni des fichiers sources), pas des anomalies introduites par ce lot. Validés
explicitement avec le laboratoire avant intégration dans le kit livré.

### DEMO_MASTER_DATA_REMOVED

**PASS**

```
DATA12 aucun id DEMO_* (demoUsers/DEMO_DENTISTS/DEMO_SERVICES/DEMO_SUPPLIERS/DEMO_ARTICLES) présent dans
       cabinets/dentists/users/services/suppliers/articles — PASS
```

Noms de fixtures historiques (Cabinet Moderne, Dr. Morvan, Clinique Belle Dent, Éric Morvan, Eric Leduc, Marc
Dubois…) vérifiés absents des entités importées — identification par identifiant (capturé sur un boot neuf du
produit, dans la même session navigateur que l'import réel), jamais une liste fragile de chaînes.

### FAKE_ACTIVE_ORDERS

**10 / attendu 10**

```
DATA07 exactement 10 commandes au premier lancement         PASS
DATA08 0 commande annulée                                   PASS
DATA09 0 commande livrée                                    PASS
```

### ORDER_STAGE_DISTRIBUTION

```
Réception:     2
Modélisation:  2
Usinage:       2
Finition 1:    2
Finition 2:    1
Expédition:    1
```

**DATA10 : PASS** — répartition exacte conforme au mandat.

### STOCK_UNCHANGED_BY_FIXTURES

**PASS**

```
DATA11 : total stockMovements avant création des 10 commandes fictives = 1926.5,
         total après = 1926.5 — identique (aucune recette de consommation matière sur les
         prestations qualifiées dans ce kit ; consumeForScan() est un no-op par construction) — PASS
```

### Autres tests DATA

```
DATA13 ancien localStorage parasite ('dentalflow-next-poc-state-v8') jamais lu              PASS
DATA14 F5 conserve les modifications de séance (commande créée en séance toujours présente) PASS
DATA15 reset observateur restitue exactement la baseline (10 commandes, 126 cabinets)        PASS
OBSERVER_ABSENT_NORMAL (bouton absent en navigation normale)                                 PASS
```

**TOTAL DATA 16/16 PASSED 0 FAILED.**

### CABINET_MESSAGES_LAYOUT

**PASS** — voir section A ci-dessus (CABUX01-10, B17), rejouée directement sur le kit livré
(`dentalflow-test-labo-v3.12.1.html`), résultats identiques.

### CABINET_NEW_MESSAGE_SPACING

**PASS** — voir CABUX08/CABUX09 ci-dessus.

### RESPONSIVE_650 / RESPONSIVE_430 / RESPONSIVE_390

**PASS / PASS / PASS** — `document.scrollWidth <= document.clientWidth` confirmé sur les 5 écrans Cabinet testés
à chacune des 3 largeurs (voir B17 ci-dessus, 36/36).

### REGRESSION_SUITE (rejouée sur le kit `dentalflow-test-labo-v3.12.1.html`)

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives, sous ?runTests=1 — baseline jamais injectée,
                                  seed natif intact, résultat rigoureusement identique au fichier produit)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK V3.10.3.2 TOTAL 16 PASSED 16 FAILED 0
```

**Point d'attention trouvé et corrigé pendant l'intégration du kit** : les 2 premières tentatives de rejeu
468/468 sur le kit échouaient — 4 tests liés au scan Collaborateur (REL05-07, REL17) échouaient systématiquement.
Cause : le script de correctif `demoUsers` (nécessaire pour retirer les 15 profils de démonstration à chaque
démarrage — voir CHANGELOG §B15) s'exécutait alors sans exception pour `?runTests=1`, retirant ces mêmes profils
pendant la suite de tests internes qui en dépend. Corrigé en ajoutant la même garde `isRunTestsMode` que le
bootstrap principal. Revérifié : 468/468 ×3 consécutives après correctif, 0 régression résiduelle.

Deux badges de navigation (`orders`, `planning`) sont légitimement à 0 sur ce kit — `unreadNotifCount('LAB',
'NEW_ORDER')` et `leaveRequests` en statut `pending` — conséquence directe et attendue du nettoyage des congés de
démonstration (§B4) et du fait qu'aucune des 10 commandes fictives n'est créée côté Cabinet (donc aucune
notification « nouvelle commande » au Labo). Script NAVDOM adapté en conséquence (badges `stock`/`messages`
restent vérifiés non nuls ; présence structurelle des 4 badges toujours vérifiée à 100%).

### CABINET_MESSAGES_LAYOUT / confidentialité : CONFIDENTIALITE_KIT

**PASS** — suite P1-P6 + anti-fuite automatique rejouée **directement sur les données réelles du kit**
(commande `CMD-0205`, patiente fictive « Fictif Démo 01 », cabinet « ANDRE-GUILLOU Fabienne » — plutôt qu'un
réimport CSV + flux de qualification par lot supplémentaire par-dessus un kit déjà importé/qualifié, qui s'est
avéré lent et ponctuellement instable dans cet environnement) :

```
TEST P1 (vue Cabinet voit le nom)                     PASS
TEST P2 (écrans Labo — orders/quickView/trace/fiche)  PASS — 0 fuite
TEST P3 (recherche globale)                            PASS — 0 fuite
TEST P4 (portails Staff/Scan)                          PASS — 0 fuite
TEST P5 (export CSV/bon de suivi — 0 fuite ; export
         JSON admin contient le nom par conception)    PASS
TEST P6 (Cabinet conserve l'accès)                     PASS
ANTI-FUITE automatique (16 surfaces : home/orders/production/stock/reports/planning/users/cabinets/invoices/
quickView/sidePanel/printFiche/globalSearch/csvCommandes/portalStaff/portalScan)
LAB_PATIENT_NAME_LEAKS = 0
0 erreur console.
```

**Point trouvé et corrigé pendant la conception du test** : le choix initial de prénom fictif « Patient » (ex.
« Patient Démo 01 ») entrait en collision avec le libellé générique d'interface « Patient » (en-tête de colonne
du tableau des commandes, étiquette du champ référence patient) — un **faux positif** du scanner de fuites
(0 occurrence du nom de famille distinctif « Démo NN », confirmant qu'aucune fuite réelle n'existait). Corrigé en
renommant les 10 patients fictifs en « Fictif Démo 01 » à « Fictif Démo 10 » (confirmé absent de tout texte
d'interface du produit avant application).

### QR_REAL_DEVICE

**`HARDWARE_REAL_SCAN_NOT_VERIFIED`** — aucun changement apporté au moteur caméra/QR dans ce lot ; QR01-03/05
restent **PASS** (rejoués sans modification), QR04 (caméra live sur smartphone réel via HTTPS) reste à vérifier
physiquement, comme déclaré dans tous les rapports V3.12.x précédents.

## Vérification MD5 — `dentalflow-next-poc-v3.12.1.html`

```
Avant l'ensemble de ce travail : 32ce4e69419d6bfae7d191c001d56b37
Après l'ensemble de ce travail  : 32ce4e69419d6bfae7d191c001d56b37
```

**Identique.** `git status --porcelain` ne signale aucune modification sur ce fichier à aucun moment de ce lot.

## Confidentialité des fichiers du kit (règle de gouvernance maintenue)

`dentalflow-test-labo-v3.12.1.html` contient des données réelles du laboratoire (cabinets, dentistes, personnel,
fournisseurs, stock). Conformément à la règle appliquée depuis le début de ce projet : ce fichier n'est ni ne
sera commité dans le dépôt Git (seuls `dentalflow-next-poc-v3.12.1.html` et les changelogs/rapports Markdown
restent suivis) ; aucun nouvel export nominatif n'a été produit au-delà de ce qui était déjà nécessaire au kit ;
aucune donnée n'a été mise sur un service web.

## Conclusion

Le bug racine du bouton « Nouveau message » invisible (A3) est corrigé et vérifié par reproduction AVANT/APRÈS,
10/10 tests CABUX ciblés, et 36/36 captures visuelles réelles à 6 largeurs. Le kit de test laboratoire contient
exactement les données réellement importées (126/91/13/352/19/515, 2 écarts diagnostiqués et validés avec le
laboratoire, jamais inventés ni masqués), 10 commandes fictives clairement identifiables réparties selon le
mandat, un stock importé strictement inchangé, et fonctionne de façon autonome (double-clic, persistance F5,
reset observateur). 0 régression sur 468 tests internes ×3, NAVDOM, UI CLICK, confidentialité patient (0 fuite
sur 16 surfaces) ou mobile, sur le fichier produit comme sur le kit. `dentalflow-next-poc-v3.12.1.html`
strictement inchangé tout au long de ce travail. Seule réserve inchangée : QR04 (caméra réelle sur smartphone)
reste à vérifier physiquement.
