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

---

## Améliorations (7ᵉ retour)

1. **Journal d'audit — recherche** : champ de recherche filtrant les entrées par acteur, commande, type,
   détail ou date (`auditMatch` / `filterAudit`), mise à jour instantanée sans perte de focus, compteur
   d'entrées recalculé.
2. **Espace cabinet — détail commande** : clic sur une commande de « Mes commandes » ouvre une fiche détaillée
   (statut, livraison prévue, localisation, suivi de fabrication, bouton « Écrire au laboratoire »).
3. **Numéro de commande = code anonymisé** : l'identifiant de la nouvelle commande est généré à partir de
   3 lettres du cabinet + 3 du nom + 3 du prénom du patient (`uniqueOrderCode`, unicité garantie). **Le nom et
   le prénom du patient ne sont visibles que dans l'espace cabinet** ; le laboratoire ne voit que le code
   (tables, fiches, recherche). Les commandes de démo reçoivent des noms fictifs pour illustrer.
4. **Accueil — vignette Répartition plus lisible** : donut agrandi et épaissi, texte de survol contraint dans
   le centre (catégorie + %), segment survolé mis en avant et légende synchronisée (survol/estompage).
5. **Mode sombre — donut réparé** : une ancienne règle peignait le centre (désormais en `inset:0`) par-dessus
   le SVG en thème sombre ; fond du centre rendu transparent → le camembert s'affiche correctement en dark.

| Point | Vérification |
|---|---|
| Recherche journal d'audit | ✅ 35 → 6 (« Marc ») → 2 (« Stock ») |
| Détail commande dentiste | ✅ fiche + nom patient visible |
| N° commande = code, nom masqué labo | ✅ CABBERALI, labo sans nom |
| Donut visible + lisible (light) | ✅ survol = catégorie + % |
| Donut visible en dark | ✅ arcs affichés |
| Erreurs console (light + dark) | ✅ Aucune |

---

## Améliorations (8ᵉ retour)

1. **Icône Stocks** : la vignette « Unités en stock » utilise une icône de cube (et « En transit » un camion),
   à la place du « i ».
2. **QR Code de commande** : chaque commande possède un **QR Code scannable** (librairie QR MIT inline, sans
   dépendance externe) encodant le numéro de commande. Il figure sur la **fiche commande** (côté laboratoire et
   espace cabinet) et une **fiche imprimable** est générée (`Imprimer la fiche` → mise en page A4 dédiée avec
   QR agrandi). Scannabilité vérifiée par décodage (jsQR : `DRM-DUP-JEA` encodé → décodé à l'identique).
3. **Espace collaborateur** (`?mode=staff`, ou Paramètres → « Ouvrir l'espace collaborateur ») :
   - **Scan production** : sélection du poste, saisie/scan du numéro de commande (le QR ci-dessus), retour visuel
     et journal des derniers scans (alimente la traçabilité et l'audit).
   - **Congés payés** : compteur (jours acquis / pris / solde restant, jours en attente), **demande de congés**
     soumise à **validation du manager**, liste « Mes demandes » avec statut, et **calendrier d'équipe** mensuel
     navigable (jours de congés perso et absences d'équipe).
   - **Validation manager** : les demandes en attente apparaissent dans **Plan de charge → « Demandes de congés à
     valider »** (Approuver / Refuser). Une demande approuvée devient une absence et **réduit la capacité** des
     semaines concernées (lien avec la GTA).

| Point | Vérification |
|---|---|
| Icône Stocks (cube/camion) | ✅ |
| QR sur fiche + impression | ✅ svg présent, fiche A4 |
| QR scannable (décodage jsQR) | ✅ match exact |
| Espace collaborateur — scan | ✅ CMD scannée, journal maj |
| Congés : demande → manager → capacité | ✅ 3→2 en attente après validation |
| Erreurs console | ✅ Aucune |

---

## Améliorations (9ᵉ retour)

1. **Icône « Solde restant »** (espace collaborateur) : pictogramme « soleil / congés » à la place du « i ».
2. **Simulateur What‑If (Plan de charge)** : outil pour évaluer l'impact de congés sur le plan de charge **avant
   décision**. Le manager peut cocher des **demandes en attente** et/ou ajouter des **congés hypothétiques**
   (collaborateur + dates) ; le simulateur recalcule, sur 8 semaines, la **capacité simulée** vs la capacité
   actuelle (avec le delta), le **solde simulé** coloré, le **nombre de semaines qui passeraient en
   sous‑capacité** et la **capacité totale perdue** (cmd). Il permet aussi d'**approuver directement la sélection**
   (les congés deviennent alors des absences réelles qui réduisent la capacité).

| Point | Vérification |
|---|---|
| Icône Solde restant (soleil) | ✅ |
| What‑If : inclure une demande recalcule la capacité | ✅ S3 264 → 252 (−12) |
| What‑If : congé hypothétique + suppression | ✅ |
| What‑If : approuver la sélection / réinitialiser | ✅ |
| Erreurs console | ✅ Aucune |

---

## Amélioration (10ᵉ retour) — charge pilotée par les données

- **Charge du plan de charge dérivée des vraies échéances de commandes** (fin du tableau `demoWeeklyForecast`
  codé en dur). Un parser `orderDueDate()` convertit les échéances (« Aujourd'hui », « Demain », « 26 août »,
  « jeu. 27 août », « 02 septembre »…) en dates réelles. Un **carnet de commandes** (`buildOrderBook`) combine les
  commandes en cours (échéances réelles) et une projection déterministe du carnet aux semaines suivantes, calée sur
  la capacité de l'équipe. `weekForecast(i)` **compte les échéances tombant dans la semaine i** — la charge n'est
  plus un nombre magique mais le décompte d'échéances réelles.
- La projection sur 8 semaines et le simulateur What‑If utilisent cette charge : soldes et sous‑capacités
  reflètent le carnet réel (ex. mesuré : charge [271, 278, 280, 248, 309, 297, 297, 272], soldes négatifs sur les
  semaines chargées). Colonne renommée « Charge à livrer ».

| Point | Vérification |
|---|---|
| Parser d'échéances | ✅ Aujourd'hui/Demain/DD mois/dentiste |
| Charge = décompte d'échéances par semaine | ✅ [271…272], variée |
| Déterministe & stable au reload | ✅ |
| What‑If sur charge réelle | ✅ semaines en sous‑capacité |
| Erreurs console | ✅ Aucune |

---

## Améliorations (11ᵉ retour) — Plan de charge interactif & notifications

1. **Suppression de la cloche à alerte** (barre supérieure). L'accès aux alertes se fait désormais uniquement
   depuis l'Accueil.
2. **Vignette « À surveiller » → « Tout voir »** ouvre la **side‑window Alertes** (comme le faisait la cloche),
   au lieu de basculer vers la liste filtrée.
3. **Notification « Plan de charge »** : lorsqu'une **demande de congés est en attente de validation**, un
   **badge orange** apparaît dans le menu au niveau de « Plan de charge » (compteur des demandes `pending`,
   masqué à 0, mis à jour en temps réel après approbation/refus).
4. **Plan de charge — refonte de la projection** :
   - **Tableau de projection interactif** : chaque ligne de semaine est cliquable et ouvre une **fenêtre pop‑up**
     détaillée (capacité brute, impact des absences, capacité nette, charge à livrer, occupation %, marge, et la
     liste des absences de la semaine).
   - **Occupation sans barre** : remplacée par un **signal de couleur** (pastille + libellé « À l'aise » / « Tendu »
     / « Surcharge » selon le taux d'occupation).
   - **Solde mis en valeur** : chip coloré (vert/rouge) dans le tableau et grand nombre coloré dans la pop‑up.
   - **Suppression du tableau « Équipe & capacités »**.
   - **Vignette Absences revisitée** : cartes claires colorées par motif (formation = bleu, maladie = rouge,
     congé/autre = orange), pour les demandes à valider comme pour les absences planifiées.

| Point | Vérification |
|---|---|
| Cloche supprimée | ✅ 0 bouton cloche |
| « Tout voir » → side‑window Alertes | ✅ ouverture, titre « Alertes » |
| Badge Plan de charge sur congés en attente | ✅ « 2 » visible, « 1 » après approbation |
| Ligne de semaine cliquable → pop‑up détail | ✅ titre « Semaine 5 · Surcharge », solde −53 |
| Occupation = signal couleur (pas de barre) | ✅ pastilles À l'aise/Tendu/Surcharge |
| Solde mis en valeur (chip + grand nombre) | ✅ 8 chips colorés |
| Tableau « Équipe » supprimé | ✅ absent |
| Absences en cartes colorées | ✅ 5 cartes |
| Erreurs console | ✅ Aucune |

---

## Améliorations (12ᵉ retour) — Production interactive, rapports & personnalisation

**Espace collaborateur**
- Espace ajouté entre les deux vignettes (scan / derniers scans).
- La vignette « Mes derniers scans » ne présente plus que les scans **du collaborateur connecté**
  (filtrage par technicien).

**Espace cabinet**
- Icône des cartes commande corrigée : pictogramme **dent** coloré selon le statut (au lieu du « i »).
- **Bouton « Messagerie » retiré** de la barre d'onglets (la communication reste accessible par commande
  via « Écrire au laboratoire » depuis le détail).

**Production — tableau de flux interactif**
- **Glisser‑déposer des commandes** d'un poste à l'autre : la commande repasse automatiquement
  « **en attente de scan** » (elle sera reconfirmée au prochain scan du technicien).
- **Couleur en haut de chaque colonne** (repère visuel par poste).
- **Postes éditables** : renommer un poste (clic sur le titre) et **ajouter de nouveaux postes**.
- **Colonnes réorganisables par glisser‑déposer** (poignée ⠿) — l'ordre redéfinit le **flux de production**.
- **Pop‑up de détail** : ajout d'un **calendrier de la semaine** (échéance de la commande mise en évidence).
- **Vue calendrier du plan de charge** : depuis la vignette *Projection*, bouton « 📅 Vue calendrier » ouvrant
  un **calendrier mensuel navigable** avec la **charge quotidienne** (nombre d'échéances/jour), un signal de
  couleur (sous‑capacité / pleine charge / surcharge) et la capacité indicative par jour.

**Rapports — journal d'audit**
- **Pagination** : 10 résultats maximum par page (navigation Précédent / Suivant).
- **Tri des colonnes** (Date, Type, Commande, Acteur) et **filtres par type** d'événement (puces).

**Utilisateurs**
- **Couleur d'avatar personnalisable** : sélecteur de couleur dans le formulaire ; **couleurs distinctes**
  attribuées aux 15 collaborateurs du POC (avatars repris dans le plan de charge et l'espace collaborateur).

| Point | Vérification |
|---|---|
| Collaborateur : espace + scans filtrés | ✅ « Mes derniers scans » = scans du user, isolés |
| Cabinet : icône dent + Messagerie retirée | ✅ onglets [Mes commandes, Nouvelle commande] |
| Production : déplacer une commande → attente de scan | ✅ pastille orange, effacée au scan |
| Production : couleur en tête de colonne | ✅ bandeau coloré par poste |
| Production : renommer / ajouter un poste | ✅ édition inline + ＋ Ajouter |
| Production : réorganiser les colonnes (flux) | ✅ DnD colonnes, ordre persistant |
| Détail : calendrier de la semaine | ✅ 7 jours, échéance mise en avant |
| Projection : calendrier mensuel de charge | ✅ 36 cellules, couleurs, navigation mois |
| Rapports : 10 max + tri + filtres | ✅ page 1/4 (36), tri, filtre par type |
| Utilisateurs : couleur d'avatar | ✅ 15 avatars colorés + sélecteur (15 teintes) |
| Erreurs console | ✅ Aucune |

---

## Améliorations (13ᵉ retour) — Pagination, side-windows & lisibilité

**Commandes**
- Liste **paginée par 10** (navigation Précédent / Suivant, retour page 1 au changement de filtre, tri ou recherche).

**Accueil**
- Les **4 vignettes du haut** (En production, À livrer aujourd'hui, En retard, Bloquées) sont **cliquables** :
  chacune ouvre une **side-window** listant les **commandes concernées** (statut, poste, dernier scan, échéance),
  chaque ligne ouvrant le détail de la commande.

**Production**
- **Suppression du défilement horizontal** (plus de « chariot ») : toutes les colonnes **tiennent sur la page**
  (colonnes fluides qui se répartissent la largeur, le bouton « ＋ Ajouter un poste » passe à la ligne).

**Plan de charge**
- Vignette **Effectif** cliquable → **pop-up** avec la **liste des collaborateurs présents** (et les absents du jour).
- Vignette **Absences à venir** cliquable → **défilement** vers la section « Absences planifiées ».
- **Vue calendrier** : **dimensions de la pop-up constantes** quel que soit le mois (grille fixe de 6 semaines).
- **Simulateur What-If** : la **présentation initiale n'affiche plus le tableau** semaine par semaine ; un bouton
  « 📅 Voir le calendrier du scénario » ouvre une **pop-up calendrier** montrant l'impact du scénario
  (charge/capacité par jour + repérage des jours de **congé simulé**).

**Utilisateurs**
- **Adresse email** ajoutée à la fiche collaborateur (affichée dans la liste et éditable dans le formulaire),
  présentée comme **identifiant de connexion**. Emails attribués aux 15 collaborateurs du POC.

| Point | Vérification |
|---|---|
| Commandes paginées par 10 | ✅ page 1/2 de 19, navigation |
| Accueil : vignette → side-window | ✅ « En production » → 14 commandes listées |
| Production sans défilement horizontal | ✅ 6 colonnes, aucun scroll |
| Effectif → pop-up des présents | ✅ 15 collaborateurs (+ absents du jour) |
| Absences → défilement vers la section | ✅ #abs-planifiees |
| Calendrier : dimensions constantes | ✅ 42 cellules sur tous les mois |
| What-If : pas de tableau au lancement | ✅ bouton calendrier du scénario |
| What-If : calendrier de scénario | ✅ congés simulés repérés |
| Utilisateurs : email = identifiant | ✅ 15 emails + champ formulaire |
| Erreurs console | ✅ Aucune |

---

## Améliorations (14ᵉ retour) — Scroll, messagerie fichiers, impression

**Accueil / side-windows**
- **Isolation du défilement** : le contenu de la side-window défile désormais dans son propre panneau
  (hauteur bornée à l'écran, `overscroll-behavior:contain`, page d'arrière-plan verrouillée pendant l'ouverture) —
  le « chariot » n'entraîne plus le défilement de la page derrière.

**Production**
- **Bouton « ＋ Ajouter un poste » déplacé** dans une barre d'action au-dessus du tableau (plus à côté des colonnes).
- L'ajout d'un poste **crée une colonne et redimensionne** automatiquement les autres (colonnes fluides).

**Plan de charge**
- Le **texte des boutons** (ex. « Approuver la sélection ») ne touche plus les bords (padding interne).

**Messagerie (laboratoire ⇄ cabinet)**
- **Transmission de fichiers** : bouton 📎 dans la zone de saisie (côté laboratoire **et** côté dentiste),
  sélection multiple, aperçu des fichiers choisis (retirables), et **pièces jointes cliquables** dans la
  conversation (icône selon le type, taille, ouverture/téléchargement). Les fichiers > 2 Mo transmettent leur
  nom (aperçu non embarqué, pour rester dans la limite de stockage du POC).

**Rapports**
- **Impression / génération PDF** : bouton « 🖨️ Imprimer / PDF » produisant une mise en page dédiée
  (synthèse + journal d'audit complet de la période/filtre courant) via l'impression du navigateur.
- **Journal d'audit** : **alignement des colonnes constant** d'une page de résultats à l'autre
  (largeurs fixes `table-layout:fixed` + `colgroup`).

| Point | Vérification |
|---|---|
| Side-window : défilement isolé | ✅ panneau borné à l'écran, page verrouillée |
| Production : bouton ajouter hors colonnes | ✅ barre d'action au-dessus |
| Production : ajout redimensionne | ✅ 6 → 7 colonnes fluides |
| Bouton What-If : padding interne | ✅ 18px |
| Messagerie labo : pièce jointe | ✅ 📎 + chips + envoi |
| Messagerie dentiste : pièce jointe | ✅ 📎 + envoi |
| Rapports : imprimer / PDF | ✅ mise en page dédiée |
| Audit : colonnes alignées page à page | ✅ offsets identiques |
| Erreurs console | ✅ Aucune |

---

## Correctifs (14ᵉ retour · suite)

- **Production** : l'ajout d'un poste crée désormais une colonne **à côté des autres** (colonnes en rangée unique
  `flex-wrap:nowrap`, largeurs recalculées) au lieu d'une colonne pleine largeur passée à la ligne. En-tête de
  colonne réorganisé (grille sur deux lignes) pour garder les **titres lisibles** même en colonnes étroites.
- **Messagerie** : le bouton de pièce jointe utilise désormais une **icône SVG (trombone)** au lieu de l'emoji 📎
  (toujours visible quel que soit le système/police).

| Point | Vérification |
|---|---|
| Ajout poste → colonne à côté, redimensionnement | ✅ 7 colonnes, même rangée, sans scroll |
| Titres de colonnes lisibles (colonnes étroites) | ✅ 1–2 lignes, pas de coupure lettre par lettre |
| Bouton pièce jointe visible (labo + dentiste) | ✅ icône SVG |
| Erreurs console | ✅ Aucune |
