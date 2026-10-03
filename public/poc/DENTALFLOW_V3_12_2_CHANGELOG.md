# DentalFlow V3.12.2 — Changelog

**Base :** `dentalflow-next-poc-v3.12.1.html` (frozen, inchangé).
**Nouveau fichier produit :** `dentalflow-next-poc-v3.12.2.html`.
**Nouveau kit de test :** `dentalflow-test-labo-v3.12.2.html` — mêmes correctifs produit, baseline V3.12.1.1
strictement conservée (corpus importé, 10 commandes fictives, contexte de recette, correctif Scan).

Quatre retours de la 2e recette utilisateur réelle traités dans ce lot.

## A. Messagerie Laboratoire — responsive sans scroll horizontal

**Cause racine** : la side-window Messages du Labo utilisait encore `.side-message-layout`
(`grid-template-columns:190px 1fr`), une grille étroite pensée pour l'ancien volet 560px — jamais retouchée
par le correctif V3.12.1 (qui ne concernait que `.cab-message-layout`, le portail Cabinet).

- `.side-panel.messages-panel` : largeur dédiée `min(900px,100vw)` appliquée **uniquement** quand
  `state.sidePanel==='messages'` (classe posée/retirée dans `renderSidePanel()`, point d'entrée unique de
  tout rendu de side-window) — aucune autre side-window n'est élargie.
- Grille desktop `minmax(230px,280px) minmax(0,1fr)`, `min-width:0` sur les colonnes, bascule en une seule
  colonne sous ~760px.
- Titre + commandes associées : les boutons `[CMD-xxxx]` sont désormais dans un conteneur dédié
  (`.thread-order-links`, `flex-wrap:wrap`) — ne forcent plus jamais une largeur intrinsèque supérieure au
  panneau.
- Bulles : `max-width` responsive (82% desktop, jusqu'à 94% sous 600px), `overflow-wrap:anywhere`.
- Composer : passe proprement sur plusieurs lignes sous 480px, le champ texte garde toujours `min-width:0`,
  le bouton Envoyer ne sort jamais du viewport.
- Vérifié à toutes les largeurs testées : `scrollWidth <= clientWidth` sur le document ET sur le panneau.

## B. Stock — Fiche Article plus compacte

**Cause racine** : les 6 indicateurs (Stock physique/Réservé/Disponible/En commande/Projeté/Couverture)
utilisaient `.mini-card` (`min-height:114px`), pensée pour d'autres surfaces (ex. fiche commande) —
beaucoup trop d'espace vide pour ces 6 petites valeurs.

- Nouvelle classe dédiée `.article-kpi` (dans `.article-kpi-grid`, 3 colonnes desktop → 2 → 1 colonne) :
  padding réduit, hauteur basée sur le contenu, `.mini-card` lui-même **inchangé** (aucune autre surface qui
  l'utilise n'est affectée).
- « Utilisé pour » vide : nouvel état compact `.article-used-for-empty` au lieu du grand bloc `.empty`
  (padding 46px, pensé pour une page entière vide).
- Cycle de vie (Suspendre/Archiver/Fermer) : sémantique strictement inchangée, rendu cohérent avec la
  nouvelle fiche compacte.

## C. Stock — « Ajuster » ferme désormais la Quick View

**Cause racine** : `openSidePanel()` retirait la classe `open` de la Quick View (déclenchant son animation de
fermeture) mais ouvrait **immédiatement** la side-window sans jamais vider le contenu de la Quick View ni
attendre — les deux couches affichaient du contenu concurrent pendant la transition.

- `openSidePanel()` ferme désormais la Quick View de façon **strictement synchrone** (classe `open` retirée
  ET `#quick-body` vidé dans le même tick) avant d'ouvrir la side-window, elle aussi dans ce même tick :
  à aucune frame rendue les deux couches ne portent de contenu concurrent.
- Détection par l'état réel du DOM (`#quick-layer.open`), pas seulement `state.quickOrderId` — la Quick View
  Article (`renderArticleInfo`) ouvre `#quick-layer` directement sans jamais poser `state.quickOrderId`
  (architecture pré-existante, différente de la Quick View Commande) ; s'appuyer uniquement sur
  `state.quickOrderId` aurait manqué exactement le cas « Ajuster ».
- S'applique uniformément à **toute** action Quick View ouvrant une side-window (Ajuster, Gérer les
  prestations, Messagerie…) — un seul point d'entrée (`[data-panel]` → `openSidePanel()`), jamais une
  logique différente par bouton.
- Alias explicite `openSidePanelFromQuickView(kind,id)` ajouté (même comportement que `openSidePanel`),
  pour tout appelant qui préfère nommer son intention.

## D. Stock — Toolbar des actions responsive

**Cause racine** : le bouton « ＋ Nouvel article » utilisait la classe partagée `.primary`, dont la variante
mobile (`@media(max-width:860px)`, pensée exclusivement pour le bouton FAB de la topbar Labo) impose
`font-size:0;width:46px;padding:0` — exactement le même type de collision que le bug « Nouveau message »
Cabinet corrigé en V3.12.1, cette fois sur un bouton différent.

- Nouvelle classe dédiée `.stock-toolbar-actions` (remplace le style inline générique).
- `.stock-toolbar-actions .primary` neutralise la variante mobile de la topbar Labo sous 860px (texte
  toujours visible, jamais réduit à une icône).
- « Réceptionner ▾ » : `white-space:nowrap`, texte jamais tronqué. « ⋯ » : largeur fixe 40px. Aucun
  chevauchement vérifié à 1024/650/390px.

## E. Factures > Prestations — badge Tarification sur une ligne

**Cause racine** : `.pill` (`display:inline-flex`, sans `white-space:nowrap`) laissait le texte se replier
sur deux lignes dans une colonne étroite.

- Nouvelle classe dédiée `.service-pricing-pill` (`white-space:nowrap`) — jamais un `nowrap` global sur
  `.pill` (~15 autres usages dans l'application, non concernés).
- « À qualifier », « Par dent », « Forfait » : toujours affichés sur une seule ligne.
- **Aucune modification de logique** : `pricingModeLabel()`, `serviceIsOrderable()`, le workflow de
  qualification par lot restent strictement inchangés.

## F-L. Utilisateurs — désactivation de compte avec motif (jamais de suppression physique)

Un utilisateur peut être référencé par des LocationEvents/ScanEvents/StockMovements/audit/historique de
production — un hard delete détruirait l'intégrité de la traçabilité. La fonction « Supprimer un compte »
devient donc **Désactiver le compte**, réversible, avec motif obligatoire.

### Modèle (rétrocompatible)

```js
{ active: false, archivedAt: "2026-...", archiveReasonCode: "END_CONTRACT", archiveReason: "Fin du CDD" }
```

Tout utilisateur existant sans `active` est considéré actif (`isUserActive(u)` lit `active!==false`, jamais
une présence de clé) — migration implicite, idempotente, aucune réécriture forcée des utilisateurs existants.

### Workflow

- Utilisateurs > Modifier > « Désactiver le compte » : side-window dédiée (`userDeactivate`), motif
  obligatoire (Départ / Fin de contrat / Autre — commentaire obligatoire si Autre), message explicite
  « Le compte ne pourra plus être utilisé mais son historique sera conservé. ».
- `deactivateUser(userId,{reasonCode,reason})` : refuse explicitement de désactiver le compte **actuellement
  connecté** (`CANNOT_DISABLE_CURRENT_USER`, message UX dédié) ; refuse sans motif (`REASON_REQUIRED`) ;
  refuse « Autre » sans commentaire (`COMMENT_REQUIRED`). Jamais de `splice`/`delete` sur `state.users`.
- `reactivateUser(userId)` : `active=true`, `archivedAt=null` ; le motif de désactivation n'est plus présenté
  comme motif **actuel** (`archiveReasonCode`/`archiveReason` effacés) mais reste consultable dans
  l'historique/audit (l'événement « Compte désactivé » déjà enregistré n'est jamais réécrit ni supprimé).
- Audit : chaque désactivation/réactivation crée un `historyEvent` type `Utilisateur` (« Compte désactivé —
  [motif] — [nom] » / « Compte réactivé — [nom] »).

### Effets

- `staffEligibleUsers()` (sélecteur Collaborateur/Scan du produit) exclut désormais les comptes désactivés —
  un employé parti n'est plus jamais proposé pour une nouvelle opération.
- L'historique existant (LocationEvents, ScanEvents, StockMovements, audit) reste **strictement inchangé** —
  rien n'est supprimé, le nom de l'employé continue de s'afficher sur les événements passés.
- Page Utilisateurs : filtre Actifs (défaut) / Désactivés / Tous ; badge gris « Désactivé » + motif/date en
  sous-ligne ; actions « Voir / Modifier » et « Réactiver » pour un compte désactivé.

## Hors périmètre

Aucune suppression physique d'utilisateur n'a été ajoutée (volontairement hors périmètre — voir mandat).
Aucune modification des logiques `pricingModeLabel`/`serviceIsOrderable`/qualification par lot. Le
questionnaire `dentalflow-questionnaire-utilisateur-v2.2.html` reste inchangé.
