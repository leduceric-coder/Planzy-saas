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
