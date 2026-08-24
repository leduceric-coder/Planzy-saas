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
