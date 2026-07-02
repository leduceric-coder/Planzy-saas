# PLANZY — DIRECTION DESIGN V2

> Document de direction produit & design. **Aucune modification de code.**
> À lire après `PLANZY_UX_V2_AUDIT.md`. Sert de référence pour tous les lots 15.x.
> Cible : **80 % simplicité Apple · 15 % cockpit métier · 5 % effet waouh.**

---

## 1. Principes directeurs (le contrat V2)

Sept principes non négociables. En cas de doute sur une décision de design, on tranche par eux.

1. **Une chose importante par écran.** Chaque page répond à *une* question. Le reste est secondaire,
   visuellement subordonné.
2. **Soustraire avant d'ajouter.** La V2 retire de la densité. Toute nouvelle UI doit justifier sa
   présence ; à défaut, elle dégage.
3. **Le calme est une fonctionnalité.** Beaucoup d'espace, peu de bordures, peu de couleurs vives.
   La couleur sert le sens (statut, risque), pas la décoration.
4. **Alerter = proposer d'agir.** On ne signale jamais un problème sans offrir le geste qui le résout,
   au même endroit.
5. **Métier d'abord.** Vocabulaire de chantier (conducteur de travaux, réserve, échéance, intervention),
   pas de jargon logiciel.
6. **Cohérence radicale.** Un type d'objet = une carte. Une action latérale = un side-window. Un mot
   par concept. Pas de variantes locales.
7. **Lisible avant beau, beau avant riche.** Contraste et hiérarchie d'abord ; esthétique ensuite ;
   fonctionnalités empilées jamais au prix des deux premiers.

**Anti-objectifs explicites :** pas de mini-ERP, pas de GED lourde, pas d'interface « jeu vidéo /
futuriste », pas de reporting usine à gaz, pas de densité tableur.

---

## 2. Inspiration Gemini — ce qu'on garde, ce qu'on écarte

Les essais Gemini ouvrent de bonnes pistes. On les **traduit pour Planzy**, on ne les copie pas.

| Piste Gemini | Verdict | Adaptation Planzy |
|--------------|---------|-------------------|
| Pages plus immersives | ✅ Garder, avec mesure | Plus d'espace, en-têtes de page calmes, hero discret sur fiche chantier. Pas d'images plein écran tape-à-l'œil. |
| Navigation plus claire | ✅ Garder | Nav à 6 entrées métier, libellés explicites (cf. §4). |
| Modules métier plus visibles | ✅ Garder | Onglets sur fiche chantier, cards métier typées. |
| Documents/photos plus agréables | ✅ Garder | Visionneuse photo, galerie respirante, regroupements par usage. |
| Équipes/terrain opérationnel | ✅ Garder | Vue « Terrain » (qui/où aujourd'hui). |
| Planning plus guidé | ✅ Garder (priorité) | Panneau droit « Alertes & résolution » permanent. |
| Rapports/alertes synthétiques | ✅ Garder | Rapprocher Rapports & Alertes. |
| Effets visuels marqués, néons, dégradés | ❌ Écarter | Crédibilité BTP. Couleur fonctionnelle uniquement. |
| Densité « dashboard analytics » | ❌ Écarter | On va vers moins de chiffres, mieux hiérarchisés. |

**Règle d'arbitrage :** si un élément Gemini augmente le « waouh » mais baisse la lisibilité ou la
crédibilité pro → on l'écarte. Le waouh de Planzy vient du **calme** et de la **clarté de résolution**,
pas des effets.

---

## 3. Architecture cible (information & navigation)

### 3.1 Modèle mental V2

Planzy s'organise autour de 3 intentions utilisateur, dans cet ordre de fréquence d'usage :

1. **Piloter au quotidien** → *Tableau de bord*
2. **Agir sur un chantier** → *Chantiers* → *Fiche chantier* (onglets)
3. **Décider / planifier / synthétiser** → *Planning*, *Documents & photos*, *Rapports & alertes*

Plus une zone d'administration séparée (membres, paramètres).

### 3.2 Navigation cible (6 entrées + admin)

```
PILOTAGE
  1. Tableau de bord        "Que dois-je traiter aujourd'hui ?"
  2. Chantiers              "Où en sont mes chantiers ?"
  3. Planning               "Qu'est-ce qui bloque ou décale mes chantiers ?"

RESSOURCES
  4. Équipes & terrain      "Qui intervient, et où ?"
  5. Documents & photos     "Où sont les pièces et les preuves terrain ?"
  6. Rapports & alertes     "Qu'est-ce que je présente / surveille ?"

ADMINISTRATION (owner/admin)
  •  Membres & accès        (ex « Mon équipe »)
  •  Paramètres
```

**Décisions clés :**
- **Chantiers remonte en pilotage** (c'est le cœur), juste après le dashboard.
- **Messages quitte le premier niveau** : la messagerie devient contextuelle (onglet fiche chantier +
  accès depuis l'activité). Si conservée en nav, la mettre en bas, discrète. *(À arbitrer — cf. roadmap.)*
- **« Équipes & terrain »** absorbe la vue opérationnelle ; **« Mon équipe » → « Membres & accès »**
  part en Administration. Fin du doublon de nommage.
- **« Documents & photos »** : le label dit enfin les photos.
- **« Rapports & alertes »** : on rapproche les deux notions de synthèse/surveillance.

### 3.3 Spécification par section

#### 1. Tableau de bord — « Que dois-je traiter aujourd'hui ? »
- **Prioritaire :** une **file d'actions unique** (retards, blocages, réserves critiques, échéances
  proches) — fusion de `AlertesPrioritaires` + `TaskAlertList`. Chaque ligne est **actionnable**.
- **Secondaire :** 4 KPI **cliquables** (chaque KPI mène à sa liste filtrée) ; chantiers actifs (cards
  avec badge risque) ; activité récente.
- **Action principale :** traiter une alerte. **Secondaire :** Nouveau chantier.
- **Simplification :** supprimer la 2ᵉ liste de tâches ; aligner la définition « réserve à traiter ».

#### 2. Chantiers — « Où en sont mes chantiers ? »
- **Prioritaire :** grille de `ProjectCard` **enrichies d'un badge santé** (retard / réserve critique).
- **Secondaire :** toolbar filtres/tri (déjà bonne).
- **Action principale :** ouvrir un chantier. **Secondaire :** créer, filtrer.
- **Simplification :** regrouper actifs/terminés quand « Tous ».

#### 3. Fiche chantier — « Tout sur ce chantier, sans scroll infini »
- **Passage en ONGLETS** (fin du scroll unique) :
  - **Vue d'ensemble** : header + KPI cliquables + « À traiter » (unique) + activité.
  - **Tâches** : une seule représentation (kanban *ou* liste), panneau tâche unifié.
  - **Équipe** : équipes associées + artisans + (lien terrain).
  - **Documents & photos** : filtrés sur ce chantier, visionneuse.
  - **Réserves** : liste + résolution inline.
  - **Activité** : journal unique.
- **Action principale (header) :** Nouvelle tâche + Planning du chantier. **Secondaire :** Modifier,
  Archiver (dans un menu « … »).
- **Simplification :** supprimer les redondances tâches/activité ; sortir Modifier/Archiver du flux.

#### 4. Planning — « Qu'est-ce qui bloque ou décale ? »
- **Prioritaire :** Gantt + **panneau droit permanent « Alertes & résolution »** (liste des conflits,
  triés par gravité, chacun avec une action : *Replanifier*, *Voir la tâche*, *Marquer traité*).
- **Secondaire :** toolbar **dégrossie** en 3 groupes (Affichage · Période · Outils).
- **Action principale :** résoudre un conflit. **Secondaire :** filtrer, zoomer.
- **Simplification :** rendre le mode analyse permanent et atteignable sans deviner ; brancher
  `ReplanifierModal` (existant) comme action 1-clic.

#### 5. Équipes & terrain — « Qui intervient, et où ? »
- **Prioritaire :** vue **Terrain** (équipes actives → chantiers couverts aujourd'hui/cette semaine).
- **Secondaire :** annuaire équipes + artisans (l'existant).
- **Action principale :** voir/affecter une équipe à un chantier. **Secondaire :** créer/éditer.

#### 6. Documents & photos — « Où sont les pièces et preuves ? »
- **Prioritaire :** filtre chantier (existant) + galerie respirante + **visionneuse photo**.
- **Secondaire :** catégories, regroupement « derniers ajouts » / par usage (tâche, réserve).
- **Action principale :** retrouver/ouvrir. **Secondaire :** ajouter (side-window pré-rempli).
- **Option V2+ :** statut de validation (à valider / validé) si besoin métier confirmé.

#### 7. Rapports & alertes — « Que je présente / surveille ? »
- **Prioritaire :** rapport global (existant) + centre d'alertes unifié (la file d'actions, en grand).
- **Secondaire :** historique des rapports, portfolio.
- **Action principale :** générer / imprimer / traiter. **Secondaire :** filtrer période.

---

## 4. Navigation — spécification visuelle

### 4.1 Libellés & ordre (définitif proposé)

| Ordre | Libellé | Route | Icône (lucide) | Groupe |
|------|---------|-------|----------------|--------|
| 1 | Tableau de bord | `/` | `LayoutDashboard` | Pilotage |
| 2 | Chantiers | `/chantiers` | `Building2` | Pilotage |
| 3 | Planning | `/planning` | `Calendar` | Pilotage |
| 4 | Équipes & terrain | `/equipes` | `Users` | Ressources |
| 5 | Documents & photos | `/documents` | `FolderOpen` | Ressources |
| 6 | Rapports & alertes | `/rapports` | `FileText` | Ressources |
| — | Membres & accès | `/settings/team` | `UserCog` | Administration |
| — | Paramètres | `/settings` | `Settings` | Administration |

> Routes inchangées (consigne respectée) — on ne renomme que les **libellés** et l'**ordre**.
> Messages : à arbitrer (cf. roadmap 15.B) — soit contextualisé, soit footer discret.

### 4.2 Menu normal vs mini-menu
- **Normal (w-60) :** 2 groupes visibles (Pilotage / Ressources), Administration repliée pour
  owner/admin. Bandeau marque **épuré** : logo + nom + collapse uniquement.
- **Mini (w-16) :** icônes + tooltips (existant, à garder).
- **Sélecteur de thème : sorti du bandeau** → dans Paramètres (ou un unique toggle discret en footer).
- **Bouton « Nouveau » :** conservé, central, dropdown (Chantier / Tâche / [Message]).
- **Badges :** un seul système d'alerte (cf. §6), badge sur Chantiers (réserves critiques) et Planning
  (retards+blocages) — alignés sur la définition unique.

---

## 5. Layout & rythme

- **Largeur de contenu :** plafonner les écrans de lecture (dashboard, rapports) à ~`max-w-[1200px]`
  centré. Le Planning reste pleine largeur (outil).
- **Grille :** 12 colonnes mentales ; cards en 1/2/3 selon breakpoint (déjà le cas).
- **Rythme vertical :** sections espacées `gap-8`/`gap-10` ; **densité maximale = ce qui tient sans
  scroll sur la zone prioritaire**. Si ça déborde, c'est qu'il faut un onglet.
- **En-têtes de page :** calmes — titre + sous-titre + 1 action primaire max à droite. Le reste va
  dans un « … ».
- **Padding généreux :** `px-10` desktop (existant), respiration intérieure des cards `p-5`/`p-6`.

---

## 6. Système d'alerte unifié (transverse)

**Un seul modèle. Un seul vocabulaire. Partout.**

### 6.1 Vocabulaire
- On garde **« Alerte »** comme terme unique de surface (fini « notification » / « priorité » mélangés).
- Une alerte a un **type**, une **gravité**, un **objet** (tâche/réserve/échéance), un **chantier**,
  un **lien**, et **au moins une action**.

### 6.2 Niveaux & couleurs (3 niveaux, pas plus)

| Niveau | Sens | Couleur token | Exemple |
|--------|------|---------------|---------|
| **Critique** | Bloque / urgent | `destructive` (rouge) | Réserve critique, tâche bloquée |
| **À surveiller** | Risque proche | `warning` (orange/ambre) | Retard, échéance < 7j |
| **Info** | Pour mémoire | `primary`/neutre | Nouveau message, ajout doc |

> On supprime le 4ᵉ niveau implicite (jaune « high » vs rouge « critical » ≈ même chose à l'œil).
> Réserve high + critical → **un seul niveau « Critique »** côté affichage.

### 6.3 Définition unique de « ce qui ne va pas »
`getAlertsSummary` devient **la** source. Le KPI dashboard, les badges et la cloche lisent **les
mêmes compteurs**. Fini les divergences `status:open` vs `priority:high/critical`.

### 6.4 Actionnabilité
Chaque alerte affiche, inline, l'action qui la résout :
- Retard / conflit → **Replanifier** (ouvre `ReplanifierModal`).
- Tâche bloquée → **Voir la tâche** (panneau).
- Réserve critique → **Ouvrir la réserve**.
- Toute alerte → **Marquer comme traité** (acquittement, V2+).

### 6.5 Badges
Forme unique : pastille ronde, chiffre, couleur = gravité max de l'item. `9+` au-delà.

---

## 7. Cards — catalogue normalisé

Un type d'objet = une carte. Cinq cartes canoniques.

### 7.1 Carte chantier (`ProjectCard`, à enrichir)
- Bande couleur en tête, statut, nom, adresse, **% avancement**, échéance.
- **+ Badge santé** (nouveau) : pastille discrète « 2 en retard » / « 1 réserve critique » en bas.
- Hover : élévation douce, CTA « Voir le chantier ».

### 7.2 Carte tâche (chip)
- Titre (2 lignes max), chantier, avatar **assigné (artisan OU équipe)**, échéance colorée si proche/dépassée.
- Pastille de statut (todo/en cours/bloqué). Clic → **panneau tâche unifié**.

### 7.3 Carte alerte (ligne d'action)
- Bande de gravité (1px), icône type, titre, chantier, **badge niveau**, **action inline**.
- Modèle commun dashboard / planning / centre d'alertes.

### 7.4 Carte document / photo
- Doc : icône type, nom, chantier (pastille couleur), catégorie, date, auteur, ouvrir.
- Photo : vignette, overlay (chantier + légende au survol), clic → **visionneuse**.

### 7.5 Carte équipe
- Pastille couleur + icône type (chantier/métier/entreprise/libre), nom, chef, chantier rattaché,
  avatars membres (max 6 +N). Clic → side-window édition (existant).

**Règles communes :** `rounded-2xl`, `bg-surface`, **un seul token de bordure** (cf. §10),
`shadow-sm` → `shadow-md` au hover, padding `p-5`.

---

## 8. Planning — direction visuelle

- **Layout 2 zones :** Gantt (gauche, flexible) + **panneau « Alertes & résolution »** (droite, ~340px,
  permanent, repliable).
- **Toolbar regroupée :** `[ Affichage: Global|Artisan · Jour|Semaine|Mois ]  [ Période: ◀ Aujourd'hui ▶ ]
  [ Outils: Filtres · Undo/Redo · Plein écran ]`. Trois groupes lisibles au lieu de six.
- **Conflits :** style sobre. Barre en surbrillance + liaison. Le rouge néon (`shadow-glow-red`) est
  **adouci** (halo léger, pas agressif).
- **Dépendances :** flèches discrètes, focus au survol (existant, à garder).
- **Résolution :** chaque conflit du panneau droit propose *Replanifier* / *Voir* / *Traiter*.
- **Aide au choix de vue :** micro-légende « Global = tous chantiers · Par artisan = charge par personne ».

---

## 9. Documents/photos & Équipes/terrain — direction visuelle

### 9.1 Documents & photos
- **Filtre chantier** en pills (existant) + filtre type doc.
- **Galerie photo respirante** : grille 4/6, vignettes `rounded-xl`, **visionneuse plein écran** au clic
  (overlay sombre, légende, navigation ←/→).
- **Regroupements par usage** (V2+) : « Derniers ajouts », « Photos par réserve », « Pièces par
  catégorie » — en s'appuyant sur `task_id` / `issue_id` déjà présents en base.
- **Validation** (option, si métier confirmé) : badge « à valider » / « validé ».

### 9.2 Équipes & terrain
- **Onglet « Terrain » (prioritaire) :** liste des équipes actives → chantiers couverts (cette semaine),
  + accès rapide au planning filtré par équipe.
- **Onglet « Annuaire » :** l'existant (cards équipe + artisans).
- Carte/plan : **optionnel V2+**, seulement si les adresses chantier sont fiables. Ne pas prioriser.

---

## 10. Mode clair / sombre — règles

### 10.1 Réglages
- **Adoucir le dark** : remonter légèrement le fond (de `222 47% 7%` ≈ #0B0F19 vers ~`222 40% 10-11%`)
  pour un dark « premium calme » plutôt que « terminal ». À tester sur fiche chantier et planning.
- **Light mode** : soigner le contraste des bordures et des textes secondaires (déjà amorcé).
- **Token de bordure unique** : créer/centraliser une variable (ex. `--hairline`) et **bannir** le
  `border-border/30 dark:border-white/[0.07]` répété en dur. Une seule règle, appliquée partout.

### 10.2 Usage
- **Dark = défaut** (terrain, faible luminosité, écrans le soir) — on garde, adouci.
- **Light = recommandé pour l'impression / la présentation** (rapports).
- **Contraste :** AA minimum sur texte courant ; textes secondaires jamais sous `muted-foreground`
  réel (éviter les `/40`, `/50` répétés qui passent sous le seuil de lisibilité).
- **Couleur fonctionnelle :** réserver rouge/orange aux alertes, bleu au primaire/actif, vert au
  succès. Pas de couleur décorative.

### 10.3 Sélecteur
- **Sortir du bandeau marque.** Le mettre dans Paramètres + éventuellement un **toggle unique** discret
  en footer de sidebar (cycle clair → sombre → système).

---

## 11. Exemples de pages cibles (maquettes textuelles)

### 11.1 Tableau de bord V2
```
Bonjour, Éric                                        [+ Nouveau chantier]
mardi 2 juin

┌── À TRAITER AUJOURD'HUI (file unique, actionnable) ─────────────────┐
│ ● Critique  Tâche bloquée · Villa Marius        [Voir]  [Replanifier]│
│ ● À surv.   Retard 3j · Lot peinture · Rés. Lac [Voir]  [Replanifier]│
│ ● Critique  Réserve critique · Toiture · Villa  [Ouvrir la réserve]  │
└─────────────────────────────────────────────────────────────────────┘

[ Chantiers actifs: 5 ]  [ En retard: 3 → ]  [ Bloquées: 1 → ]  [ Réserves: 2 → ]
  (KPI cliquables → liste filtrée)

CHANTIERS ACTIFS                                              Voir tous →
[card+badge risque] [card+badge risque] [card] [card]

ACTIVITÉ RÉCENTE
…
```

### 11.2 Fiche chantier V2 (onglets)
```
▌Villa Marius                          [+ Tâche] [Planning]      [ … ]
 12 rue des Lilas · Actif · 12 mars → 30 sept

[ Vue d'ensemble ] [ Tâches ] [ Équipe ] [ Documents & photos ] [ Réserves ] [ Activité ]
─────────────────────────────────────────────────────────────────────
(onglet Vue d'ensemble)
[ Ouvertes: 8 ] [ En retard: 2 → ] [ Réserves: 1 → ] [ Prochaine éch.: 5j ]

À TRAITER (unique)            │  ACTIVITÉ
● Bloquée · Plomberie  [Voir] │  …
● Retard · Carrelage   [Voir] │
```

### 11.3 Planning V2
```
[Affichage: Global|Artisan · J|S|M]  [◀ Aujourd'hui ▶]  [Filtres · ↶↷ · ⛶]
┌───────────────────────────── GANTT ─────────────┬── ALERTES & RÉSOLUTION ──┐
│  ▓▓▓ Gros œuvre                                  │ ● Chevauchement 3j        │
│      ▓▓▓ Plomberie  (chevauchement)              │   Plomberie ↔ Gros œuvre  │
│  ▓▓▓▓ Carrelage                                  │   [Replanifier] [Voir]    │
│                                                  │ ● Dépendance non vérif.   │
│                                                  │   [Planifier la tâche]    │
└──────────────────────────────────────────────────┴───────────────────────────┘
```

---

## 12. Ce que la direction design garantit

- **Moins de densité** (onglets, fusions, suppressions de redondance).
- **Plus de calme** (espace, bordure unique, dark adouci, couleur fonctionnelle).
- **Plus d'intuition** (nav métier 6 entrées, fin des doublons de nommage, KPI cliquables).
- **Plus d'efficacité** (alertes actionnables, résolution planning permanente, panneau tâche unique).
- **Toujours crédible BTP** (pas d'effets, vocabulaire métier, imprimable, pro).

> **Exécution détaillée et séquencée dans `PLANZY_ROADMAP_UX_V2.md`.**
