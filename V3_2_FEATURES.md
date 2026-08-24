# DentalFlow Next — V3.2 — Nouvelles fonctionnalités

**Fichier livré :** `public/poc/dentalflow-next-poc-v3.2.html`
**Base :** `dentalflow-next-poc-v3.1.1.html`

Poursuite du POC. Trois ajouts fonctionnels + amélioration du contraste en mode sombre. Aucune régression sur l'existant (Accueil, Commandes, Production, Messages, Scan, Utilisateurs, Paramètres).

---

## 1. Page Stocks

Nouvelle entrée de menu **Stocks** (section Principal) + vue dédiée `renderStock()`.

- **3 cartes de synthèse** dérivées des données (aucun chiffre codé en dur) :
  - **Unités en stock** = somme des quantités (`206`) + nombre de références (`8`) ;
  - **Stock critique** = nombre d'articles au seuil critique (`2`) ;
  - **En transit** = nombre de références avec réapprovisionnement en cours (`3`).
- **Grille d'articles** : nom, référence, jauge de remplissage (`qty/capacity`), badge de pourcentage, quantité, mention « + N en transit » et statut.
- **Statut calculé** (explicable) via un seuil de réappro par article :
  `qty ≤ min` → **Critique** (rouge) · `qty ≤ 2·min` → **Moyen** (orange) · sinon **Bon** (vert).
- **Badge sidebar** : nombre d'articles en stock critique (masqué si 0), mis à jour par `updateNotif()`.
- Données `demoStock` persistées dans `localStorage` (seed + load + save).

## 2. Journal d'audit (dans Rapports)

Source unique `auditEvents()` qui **fusionne les vrais événements** de l'application :

- scans confirmés (`state.scanEvents`),
- événements métier (`state.historyEvents` : blocages, créations),
- historique de démonstration `seedAuditLog` (statuts, livraisons, mouvements de stock, connexions, gestion utilisateurs) réparti sur ~90 jours.

Rendu sous forme de table (`renderAuditTable()`) : Date · Type (pastille colorée) · Commande/Réf. · Acteur · Détail. Tri antéchronologique.

## 3. Paramétrage des Rapports par période

Sélecteur segmenté **7 jours / 30 jours / 90 jours** (`state.reportPeriod`, défaut `30d`, handler `data-report-period`).

Le choix **filtre réellement les données** via `auditInPeriod(days)` :

- les 4 KPI se recalculent sur la période : **Événements journalisés**, **Commandes livrées** (+ % à temps calculé sur les livraisons de la période), **Blocages**, **Scans enregistrés** ;
- le **Journal d'audit** n'affiche que les entrées de la fenêtre choisie.

Exemple mesuré (dataset démo) : 7 j → 16 entrées · 30 j → 20 · 90 j → 25 (filtrage monotone vérifié). Le « % à temps » (80 % sur 90 j) est dérivé des livraisons journalisées, plus aucun `91%` codé en dur.

## 4. Contraste du mode sombre

Ajustement du thème sombre (le reste de l'architecture de thème est inchangé) :

- surfaces relevées : `--surface-1 #151517 → #18191C`, `--surface-2 #1C1C1E → #212227`, `--surface-hover → #292A2F` ;
- bordures plus lisibles : `--border .075 → .14`, `--border-strong .12 → .24` ;
- ombre de carte renforcée (fin liseré + profondeur) pour détacher les cartes du fond `#0B0B0C`.

Les cartes (KPI, sections, articles de stock) se distinguent désormais nettement du fond, conformément à la version de référence.

---

## Tests réalisés

| Vérification | Résultat |
|---|---|
| Syntaxe JS | ✅ `node --check` |
| Stocks : 3 KPI + 8 cartes, statuts calculés | ✅ 206 / 2 / 3 · Bon/Moyen/Critique cohérents |
| Badge sidebar stock critique | ✅ 2 |
| Rapports : période 7/30/90 j filtre KPI + journal | ✅ 16 / 20 / 25 entrées (monotone) |
| Onglets Entrées/Terminées + donut (repris de v3.1.1) | ✅ |
| Mode sombre — contraste | ✅ cartes détachées du fond |
| Mode clair — non-régression | ✅ |
| Erreurs console | ✅ Aucune (light + dark, toutes les vues) |

---

## Correctifs (retour utilisateur)

1. **Contraste mode sombre** — teinte des vignettes recalée sur la version de référence :
   fond app `#0A0D14`, cartes `#171D2B` (navy plus clair), surfaces et bordures ajustées.
   Les vignettes se détachent nettement du fond.
2. **Commandes** — suppression des boutons « Accueil » et « ＋ Nouvelle commande » de l'en-tête de la page.
3. **Stocks — saisie** — chaque article dispose d'un pas rapide **− / +** (`adjustStock`) et d'un bouton
   **Ajuster** (formulaire latéral pré-rempli) ; bouton **＋ Nouvel article** (`renderStockFormPanel` /
   `submitStockForm`) pour créer une référence. Chaque mouvement est journalisé dans l'audit
   (type « Stock ») et persisté.
4. **Rapports — cohérence période/vignettes** — les données de démonstration (scans, blocages, livraisons)
   sont désormais réparties sur toute la fenêtre 90 j, de sorte que **les 4 vignettes** varient avec le filtre
   (mesuré 7/30/90 j : Événements 18/26/37 · Livrées 2/3/6 · Blocages 3/4/6 · Scans 8/11/14). Les mini-courbes
   décoratives (tendance non liée à la période) sont remplacées par une étiquette de période sur chaque vignette.
5. **Menu** — « Paramètres » retiré du bloc Secondaire et déplacé **en bas, à côté de l'utilisateur**
   (engrenage dans le pied de la sidebar).
6. **Menu pliable/dépliable** — bouton de repli dans l'en-tête (`state.sidebarCollapsed`, persistant) :
   la sidebar passe en rail d'icônes 76 px (libellés masqués, badges en pastilles), chevron inversé.

### Détail technique notable
Le formulaire de stock utilisait un champ `name="id"` : sur un `<form>`, un contrôle nommé masque la
propriété homonyme de l'élément, donc `form.id` renvoyait le nœud input et la délégation `submit`
(`e.target.id==='stock-form'`) échouait → le formulaire partait en navigation native. Champ renommé `ref`.

| Correctif | Vérification Playwright |
|---|---|
| Contraste dark | ✅ vignettes navy détachées |
| Commandes sans boutons | ✅ 0 bloc page-actions |
| Stock − / + | ✅ 45 → 44 |
| Stock nouvel article | ✅ 8 → 9 cartes, réf. créée visible |
| Rapports 4 vignettes vs période | ✅ croissance monotone 7/30/90 j |
| Paramètres en pied de menu | ✅ absent du nav, gear footer actif |
| Menu pliable + persistance | ✅ 248 → 76 px, conservé au reload |
| Erreurs console | ✅ Aucune |

---

## Correctifs (2ᵉ retour)

1. **Mode clair plus nuancé** — fond app `#eceff5` (plus froid), surfaces/bordures resserrées
   (`--border #dbe1ec`, `--border-strong #c6cedd`) et ombre de carte renforcée. Les cartes se détachent
   mieux, de façon homogène entre navigateurs.
2. **Production sans chariot** — la grille des 6 postes passe en `repeat(6,minmax(0,1fr))` sans `overflow-x`
   ni `min-width` : les colonnes remplissent toute la largeur, plus de défilement horizontal.
3. **Messagerie (dark)** — les panneaux liste/conversation reçoivent une surface plus claire, une bordure
   renforcée et une **ombre lumineuse** (rim clair) en thème sombre, pour se détacher du fond.
4. **Apparence Système par défaut** — `seed()` remet le thème sur `system` ; la réinitialisation des données
   démo restaure l'apparence Système (et l'applique aussitôt).
5. **Rapports — graphique Production adapté à la période** — nouveau jeu de données agrégé
   (`reportProductionData`) et `renderReportBars()` : 7 j → 7 barres (jours), 30 j → 4 barres (semaines),
   90 j → 3 barres (mois). Titre « Production · {période} ».
6. **Rapports — donut supprimé** — la vignette « Répartition des commandes » (pertinente seulement le jour J)
   est retirée des Rapports ; le graphique Production occupe désormais toute la largeur. Le donut reste sur
   l'Accueil.

| Correctif | Vérification |
|---|---|
| Production sans scroll | ✅ scrollWidth == clientWidth |
| Rapports barres 7/30/90 | ✅ 7 / 4 / 3 barres |
| Rapports sans donut | ✅ 0 donut |
| Messagerie dark relief | ✅ box-shadow appliquée |
| Thème par défaut | ✅ system |
| Erreurs console | ✅ Aucune |

---

## Correctifs (3ᵉ retour)

1. **Cohérence des compteurs (8 partout)** — une commande non encore scannée était absente du « Flux de
   production » et de la page Production (7) alors que le donut comptait 8. Nouveau helper
   `effectiveStation(o)` : poste confirmé par scan, sinon poste déclaré de la commande. Flux + Production
   totalisent désormais 8, comme le donut.
2. **Règle info → pop-up / action → side-window** — le détail d'une commande (actions : messagerie,
   traçabilité) s'ouvre désormais dans une **side-window** (`renderOrderPanel`) au lieu du pop-up centré,
   depuis « À surveiller », le tableau Commandes, la Production, la recherche et les Alertes.
3. **Icônes « À surveiller »** — items transformés en cartes bordées avec padding et centrage vertical :
   les icônes ne touchent plus les lignes de séparation.
4. **Graphiques Production (Accueil + Rapports)** — lignes de grille horizontales aux paliers, et
   **interactivité** : au survol d'une colonne, une infobulle affiche le total ; la barre s'éclaircit.
5. **Accueil plus amical** — en-tête « Bonjour Eric 👋 / Voici la vue d'ensemble de votre laboratoire »
   (Bonjour/Bonsoir selon l'heure).
6. **Utilisateurs CRUD** — bouton « ＋ Nouvel utilisateur » et « Modifier » par ligne, formulaire latéral
   (`renderUserFormPanel` / `submitUserForm`), données `demoUsers` persistées ; chaque ajout/édition est
   journalisé dans l'audit (type « Utilisateur »). Avatars à initiales calculées.

| Correctif | Vérification |
|---|---|
| Cohérence donut/flux/production | ✅ 8 = 8 = 8 |
| Clic commande → side-window | ✅ side ouvert, pop-up fermé, actions présentes |
| Barres : grille + tooltip au survol | ✅ background grille + tip opacity 1 |
| Greeting | ✅ « Bonjour Eric 👋 » |
| Utilisateurs ajout/édition | ✅ 4 → 5, édition appliquée |
| Erreurs console | ✅ Aucune |

---

## Correctifs & améliorations (4ᵉ retour)

### Corrections
1. **Cohérence graduation / infobulle du graphique** — l'axe des Y était réparti sur 4 lignes égales (0/32/64/96 px)
   alors que barres et grille utilisaient l'échelle réelle (0→128 px) : le « 0 » ne tombait pas sur la ligne de base.
   Graphique réécrit (`chartBars`) : axe aligné sur la grille via `justify-content:space-between`, hauteurs de barres
   en pourcentage de `axMax`. La valeur au survol correspond désormais exactement à la graduation.
2. **Barre de recherche** — suppression du badge « ⌘ K » (le raccourci clavier reste actif).

### Améliorations
3. **Espace cabinet (portail dentiste)** — accessible via `?mode=dentist` ou depuis Paramètres → « Ouvrir l'espace
   cabinet ». Un cabinet peut :
   - **passer une commande** (`renderDentistMode` / `createDentistOrder`) avec un bon de commande proposant **3 dates
     de livraison calculées** : délai de fabrication par type (`fabricationDays`) + tampon selon la charge du
     laboratoire (`labLoadBufferDays`, jours ouvrés) ;
   - **suivre ses commandes** (statut, poste, date de livraison) ;
   - **communiquer** avec le laboratoire (messagerie bidirectionnelle : `addCabinetMessage`).
   Les commandes et messages créés côté cabinet apparaissent immédiatement côté laboratoire (état partagé via
   `localStorage`, cloche et badge messages incrémentés).
4. **Plan de charge (GTA)** — nouvelle vue « Plan de charge » : capacité hebdomadaire de l'équipe (capacité par
   membre, éditable dans la fiche utilisateur), **projection sur 8 semaines** (capacité nette vs charge prévue,
   occupation, solde coloré), et **gestion des absences** (ajout/suppression via formulaire latéral) qui réduisent la
   capacité nette des semaines concernées. Absences journalisées dans l'audit.

| Élément | Vérification |
|---|---|
| Graphique : graduation = infobulle | ✅ barre 30 → 50 % (axe max 60) ; 228 → bonne hauteur (axe 300) |
| Badge ⌘K retiré | ✅ 0 |
| Portail : dates calculées selon type + charge | ✅ Zircone 27/08 vs Denture 01/09 |
| Portail → commande visible côté labo | ✅ CMD-0191 + message non lu |
| Plan de charge : capacité/charge/solde sur 8 sem. | ✅ absences réduisent la capacité |
| Erreurs console (labo + portail) | ✅ Aucune |

---

## Modifications (5ᵉ retour)

1. **Données réalistes (labo ~15 personnes)** — clé de stockage passée en `v3` (réinitialise automatiquement
   l'ancien état). Effectif porté à **15 collaborateurs** avec capacités individuelles (total 278 cmd/sem., soit
   ~56/jour, < 60). Dataset de commandes en cours enrichi (**19 commandes**), production hebdo/mensuelle et
   prévisions du plan de charge recalées sur une production ≤ ~58/jour.
2. **Menu réorganisable (drag & drop)** — la navigation est un conteneur unique réordonnable par glisser-déposer
   (`renderNav`, `setupNavDnD`), avec poignée au survol ; l'ordre est **persisté** (`state.navOrder`).
3. **Plan de charge sous Production** — ordre par défaut : Accueil, Commandes, Production, **Plan de charge**,
   Stocks, Messages, Rapports, Utilisateurs.
4. **Accueil — vignettes KPI colorées** — barre de couleur en haut **et** sur le côté gauche, + **icône colorée**
   par KPI (sac, horloge, alerte, cadenas), comme la maquette de référence.
5. **Accueil — suppression de « Dernières commandes »**.
6. **Accueil — comparatif de production** — le graphique « 7 derniers jours » devient **« cette semaine vs semaine
   précédente »** : pour chaque jour, deux colonnes accolées (semaine courante / précédente) avec légende et
   infobulle au survol.
7. **Bouton « + Nouvelle commande »** — retiré du bandeau supérieur, conservé uniquement dans la page Commandes.
8. **Icônes** — jeu d'icônes enrichi (sac, horloge, coche, cadenas, camion, calendrier, cube, équipe) et réaffecté
   (KPI Accueil, stock « En transit », plan de charge).
9. **Plan de charge — espacement** entre le tableau de projection et les blocs Équipe / Absences.
10. **Plan de charge — vignettes** — « Capacité hebdo » = somme des capacités individuelles (définies par
    collaborateur dans la fiche utilisateur ; la vignette renvoie vers Utilisateurs pour ajuster). « Absences à
    venir » affiche la **date de la prochaine absence** (et la personne), ou « Aucune dans les 30 prochains jours ».
11. **Plan de charge fonctionnel** avec les 15 collaborateurs et 3 absences de démonstration.

| Modification | Vérification |
|---|---|
| Effectif 15 · capacité 278 · donut 19 | ✅ |
| Menu drag & drop + persistance | ✅ Stocks→avant Commandes, conservé au reload |
| Plan de charge sous Production | ✅ ordre par défaut |
| KPI Accueil colorés (haut+côté+icône) | ✅ 4 vignettes |
| « Dernières commandes » supprimée | ✅ |
| Comparatif 2 colonnes/jour | ✅ 14 barres |
| + Nouvelle commande hors topbar | ✅ uniquement dans Commandes |
| Prochaine absence datée | ✅ « jeu. 27 août · Nora » |
| Erreurs console (light + dark) | ✅ Aucune |

---

## Améliorations & corrections (6ᵉ retour)

1. **Accueil — accents de couleur** : retrait de la bande latérale sur les vignettes KPI du haut (seule la barre
   supérieure reste colorée) ; la barre latérale colorée passe sur les cartes de « À surveiller » (rouge/orange/bleu
   selon l'alerte).
2. **Accueil — camembert interactif** : donut réécrit en SVG (arcs `stroke-dasharray`). Au survol d'un segment ou
   d'une ligne de légende, le centre affiche la catégorie et son pourcentage (ex. « 14 · En production · 74 % »),
   et retourne au total à la sortie.
3. **Side-windows fluides** : ouverture/fermeture animées (panneau qui glisse via `translateX`, fond en fondu),
   au lieu d'un affichage instantané.
4. **Commandes — tri des colonnes** : en-têtes cliquables (Commande, Référence, Type, Cabinet, État, Localisation,
   Dernier scan, Échéance) avec tri ascendant/descendant et indicateur ; compatible recherche + filtres.
5. **Référence patient automatique** : générée à la prise de commande sous la forme **3 lettres du cabinet + 3 du
   nom + 3 du prénom** (`buildPatientRef`), ex. « Dr. Morvan / Dupont / Jean » → `DRMDUPJEA`. Les formulaires
   (laboratoire et espace cabinet) demandent désormais nom et prénom du patient.

| Point | Vérification |
|---|---|
| KPI sans bande latérale · À surveiller accentué | ✅ |
| Donut interactif au survol | ✅ centre = catégorie + % |
| Side-window animée | ✅ transition transform/opacity |
| Tri colonnes Commandes | ✅ asc/desc |
| Réf. patient CAB+NOM+PRE | ✅ DRMDUPJEA / CABBERALI |
| Erreurs console | ✅ Aucune |
