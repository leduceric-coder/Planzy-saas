# PLANZY — AUDIT UX GLOBAL (V1 → V2)

> Document d'audit produit. **Aucune modification de code.** Analyse fondée sur le code réel
> du dépôt `planzy-saas` au 2026-06-02 (LOT 14 inclus).
> Auteur : audit UX/produit (Opus). Statut : à valider avant lancement refonte V2.

---

## 0. Méthode & périmètre

Audit fondé sur la lecture du code réel, pas sur des impressions :

- Navigation : `components/layout/Sidebar.tsx`, `components/layout/Header.tsx`, `components/layout/NotifDropdown.tsx`, `app/(dashboard)/layout.tsx`
- Dashboard : `app/(dashboard)/page.tsx` + `components/dashboard/*`
- Chantiers : `app/(dashboard)/chantiers/page.tsx`, `components/chantiers/ChantiersClient.tsx`
- Fiche chantier : `components/chantiers/ChantierDetail.tsx` (1027 lignes)
- Planning : `components/planning/GanttView.tsx` (1600 l.), `TaskSidePanel.tsx` (1186 l.)
- Équipes : `components/equipes/EquipesClient.tsx`, `app/(dashboard)/equipes/page.tsx`
- Documents/Photos : `app/(dashboard)/documents/page.tsx`, `components/documents/*`
- Rapports : `app/(dashboard)/rapports/page.tsx`, `rapports/global/page.tsx`, `components/rapports/*`
- Alertes : `lib/alerts.ts`, `components/layout/AlertsContext.tsx`
- Design system : `app/globals.css`, `tailwind.config.*`

**Verdict global en une phrase :** Planzy V1 est fonctionnellement riche et techniquement solide,
mais l'interface a grossi par accumulation de lots. La densité, les redondances et un système
de nommage ambigu créent une charge cognitive qui éloigne l'objectif initial (cockpit chantier
simple et beau). **La V2 ne doit rien ajouter de fonctionnel — elle doit soustraire, regrouper,
hiérarchiser.**

---

## 1. Cartographie de l'existant — écran par écran

### 1.1 Dashboard (`/`, `app/(dashboard)/page.tsx`)

**Rôle actuel :** point d'entrée quotidien. Salutation contextuelle (Bonjour/Bon après-midi/Bonsoir),
date, bouton « Nouveau chantier », puis 4 blocs empilés.

**Contenu réel (dans l'ordre du DOM) :**
1. Header : salutation + date + CTA Nouveau chantier
2. `KpiPanel` — 4 KPI : Chantiers actifs, Tâches en retard, Tâches bloquées, Réserves ouvertes
3. `AlertesPrioritaires` (2/3) « Priorités du jour » (max 5) + `ActivityFeed` (1/3)
4. `ProjectCard` grid « Chantiers actifs » (max 6)
5. `TaskAlertList` « Tâches prioritaires » — 3 colonnes (À faire / En cours / Retard & bloquées)

**Points forts :**
- Salutation + date = chaleureux, humain, bon ton.
- Empty state d'onboarding bien pensé (3 étapes, `OnboardingStep`).
- Hiérarchie verticale lisible, bonnes respirations (`gap-10`).

**Points faibles / surcharge :**
- 🔴 **Double liste de tâches redondante.** `AlertesPrioritaires` (« Priorités du jour ») affiche
  late + blocked + critical issues. `TaskAlertList` (« Tâches prioritaires ») affiche une colonne
  « Retard & bloquées ». **Les mêmes tâches en retard/bloquées apparaissent deux fois sur le même
  écran**, sous deux titres quasi synonymes. Confusion garantie.
- 🟠 **Incohérence KPI ↔ alertes.** Le KPI « Réserves ouvertes » compte `status = 'open'`
  (`page.tsx:53`), alors que `lib/alerts.ts` et le badge sidebar comptent `priority in (high, critical)`.
  Deux définitions de « réserve à traiter » coexistent → le chiffre du dashboard et le badge ne
  concordent pas.
- 🟠 KPI non cliquables : « Tâches en retard = 7 » n'amène nulle part. Un KPI qui annonce un problème
  doit conduire à sa résolution.
- 🟡 Le dashboard ne répond pas frontalement à « Que dois-je traiter aujourd'hui ? » : il mélange
  vue de pilotage (KPI, chantiers) et vue d'action (priorités, tâches).

**À conserver :** salutation, empty state, ProjectCard, ActivityFeed.
**À simplifier :** fusionner les deux listes de tâches en **une seule** file d'actions priorisée ;
rendre les KPI cliquables ; aligner la définition « réserve à traiter ».

---

### 1.2 Mes chantiers (`/chantiers`, `ChantiersClient.tsx`)

**Rôle actuel :** liste filtrable/triable de tous les chantiers non archivés.

**Contenu réel :** toolbar (4 onglets de statut avec compteurs + recherche + tri 5 critères) puis grille
de `ProjectCard` (1/2/3 colonnes responsive). Sous-titre serveur intelligent (« 3 actifs · 1 en pause »).

**Points forts :**
- Toolbar propre et complète, compteurs par statut, recherche nom+adresse, tri pertinent.
- Réutilise `ProjectCard` (cohérence avec dashboard).
- Empty states distincts (aucun résultat de filtre vs aucun chantier).

**Points faibles :**
- 🟡 La `ProjectCard` n'expose **aucun signal de risque** : pas de « 2 tâches en retard » ni « 1 réserve
  critique » sur la carte. On voit l'avancement et les jours restants, mais pas la santé du chantier.
  Sur une page dédiée aux chantiers, c'est l'information la plus utile au conducteur de travaux.
- 🟡 Pas de regroupement visuel actifs/terminés quand on est sur « Tous ».
- 🟢 Sinon, écran sain — un des plus proches de la cible V2.

**À conserver :** quasi tout.
**À simplifier/enrichir :** ajouter un **badge santé** discret sur `ProjectCard` (retard / réserve critique).

---

### 1.3 Fiche chantier (`/chantiers/[id]`, `ChantierDetail.tsx`)

**Rôle actuel :** vue complète d'un chantier. **C'est l'écran le plus dense de Planzy (1027 lignes).**

**Contenu réel (scroll unique, dans l'ordre) :**
1. Bande couleur + header (nom, adresse, statut, dates, Modifier, Archiver, Planning, Nouvelle tâche)
2. Bande KPI compacte — 4 cellules (Tâches ouvertes / En retard / Réserves / Prochaine échéance)
3. Grille 2/3 + 1/3 : « À traiter maintenant » + « Activité récente »
4. Séparateur **« Planning & Tâches »**
5. « Prochaines étapes » (PlanningGroup)
6. « Tâches » — **kanban 3 colonnes** (À faire / En cours / Retard & bloquées)
7. Séparateur **« Équipe & Ressources »**
8. Grille 2 col : « Équipe » + « Réserves »
9. Grille 2 col : « Documents » + « Photos »
10. MiniStats — 3 cellules (Messages / Matériaux suivis / Rapports)
11. « Activité récente » (ActivitySection)

**Points forts :**
- Couvre tout le métier d'un chantier en un seul endroit.
- Le pattern `SectionCard` / `SectionDivider` apporte un rythme.
- Side-window tâche (`TaskPanel`) au clic — bon réflexe (pas de modal).

**Points faibles / surcharge — c'est ici que se concentre le problème UX :**
- 🔴 **Trop de sections empilées (10+) dans un scroll unique.** L'utilisateur scrolle longtemps
  sans repère de navigation. Aucune ancre, aucun onglet.
- 🔴 **Triple redondance tâches.** « À traiter maintenant » (urgentItems = blocked + late + issues),
  la colonne « Retard & bloquées » du kanban, ET « Prochaines étapes » montrent des tâches qui se
  recoupent. Trois représentations du même sujet sur une page.
- 🔴 **Double activité.** « Activité récente » apparaît potentiellement deux fois (bloc 3 et bloc 11).
- 🟠 Matériaux réduits à un compteur mort (`MiniStatCell`), sans action — promesse non tenue.
- 🟠 Deux panneaux tâche différents dans l'app : `TaskPanel` (fiche, lecture) et `TaskSidePanel`
  (planning, édition complète). Incohérence d'expérience selon le point d'entrée.
- 🟡 Header riche mais les actions principales (Nouvelle tâche, Planning) cohabitent avec secondaires
  (Modifier, Archiver) sans hiérarchie nette.

**À conserver :** header + bande KPI, side-window tâche, sections Équipe/Réserves/Documents/Photos.
**À simplifier :** **passer en onglets** (Vue d'ensemble / Tâches / Équipe / Documents & photos /
Réserves / Activité). Supprimer les redondances tâches (1 seule vue par onglet). Une seule activité.

---

### 1.4 Planning Gantt (`/planning`, `GanttView.tsx` + `TaskSidePanel.tsx`)

**Rôle actuel :** planification multi-chantiers. **Le module le plus puissant et le plus complexe
(2786 lignes combinées).**

**Contenu réel — toolbar (12 contrôles sur une barre de 48px) :**
- Titre « Planning » + switch **Global / Par artisan**
- Navigation période (◀ Aujourd'hui ▶)
- **Undo / Redo** (avec libellés d'action)
- Zoom **Jour / Semaine / Mois**
- **Filtres** (popover : projet / artisan / statut / terminées) avec compteur de filtres actifs
- Plein écran
- Panneau de conflits (`conflictsOpen`)
- **Mode analyse de dépendance** (LOT 6.E) : déclenché au clic sur un conflit de dépendance, scroll
  auto vers les deux barres, zone d'overlap orange, message d'analyse détaillé.

**Points forts :**
- Techniquement remarquable : dépendances, conflits dérivés en temps réel, anti-cycle, undo/redo,
  analyse contextuelle. C'est le vrai différenciateur « cockpit » de Planzy.
- Le mode analyse (LOT 6.E) est excellent sur le fond : il explique *pourquoi* il y a un problème
  (chevauchement de N jours, ordre inversé, dates manquantes).

**Points faibles :**
- 🔴 **Densité de la toolbar.** 6 groupes de contrôles + filtres + plein écran sur 48px de haut.
  Un conducteur de travaux non technophile est noyé. Trop d'options de même poids visuel.
- 🟠 **Le mode analyse est caché.** Il ne se déclenche qu'au clic sur un conflit de dépendance. La
  résolution des problèmes — qui est la valeur n°1 du planning — n'a pas de point d'entrée évident.
  Il manque un **panneau « Ce qui bloque » permanent** à droite.
- 🟠 Le Gantt répond à « comment c'est planifié » mais guide mal vers « qu'est-ce que je fais pour
  corriger ». L'analyse explique le problème, propose peu l'action (replanifier en 1 clic).
- 🟡 Deux représentations (Global / Par artisan) sans aide au choix : quand utiliser laquelle ?

**À conserver :** moteur de dépendances, conflits, undo/redo, mode analyse (le fond est en or).
**À simplifier :** dégrossir la toolbar (regrouper en « Affichage » / « Période » / « Outils ») ;
**rendre permanent un panneau droit « Alertes & résolution »** ; offrir des actions de correction
en 1 clic depuis l'analyse (Replanifier — le composant `ReplanifierModal` existe déjà).

---

### 1.5 Équipes / artisans (`/equipes`, `EquipesClient.tsx`)

**Rôle actuel :** gestion des équipes (groupes typés : chantier/métier/entreprise/libre) et des artisans.

**Contenu réel :** section « Équipes » (cards avec type, chef, projet, membres) + section « Artisans »
(`ArtisanList`). Création/édition via `TeamSlidePanel` (bon : side-window, pas de modal).

**Points forts :**
- Cards équipe claires (badge de type coloré, chef, chantier rattaché, avatars membres).
- Side-window cohérent. Typage des équipes pertinent métier.

**Points faibles :**
- 🔴 **Conflit de nommage majeur : « Équipes » (`/equipes`) vs « Mon équipe » (`/settings/team`).**
  Les deux portent l'icône `Users`. L'un gère les *artisans terrain* (ressources métier), l'autre
  les *utilisateurs du compte* (membres de l'org avec droits). Un utilisateur ne peut pas deviner
  lequel ouvrir. C'est le défaut de navigation le plus grave.
- 🟠 **Page orientée annuaire, pas terrain.** Elle répond à « qui sont mes équipes » mais pas à
  « qui intervient où aujourd'hui ». Pas de vue opérationnelle (équipes actives, chantiers couverts).
- 🟡 Pas de lien direct depuis une équipe vers son chantier / son planning filtré.

**À conserver :** cards équipe, typage, side-window.
**À renommer/repositionner :** « Mon équipe » (settings) → « Membres & accès » (dans Administration).
**À enrichir :** ajouter une **vue opérationnelle « Terrain »** (qui est sur quel chantier).

---

### 1.6 Documents & Photos (`/documents`, `DocumentsClient.tsx`)

**Rôle actuel :** bibliothèque org-wide de documents (par catégorie) + galerie photos. Filtrage par
chantier ajouté au LOT 14.

**Points forts :**
- LOT 14 a apporté le **filtre par chantier** (pills) — gros progrès.
- Catégorisation des documents, galerie photos en grille, signed URLs sécurisées côté serveur.
- Upload en side-window avec pré-remplissage chantier (`defaultProjectId`).

**Points faibles :**
- 🟡 Le label de navigation dit **« Documents »** alors que la page est « Documents & **Photos** ».
  Les photos sont invisibles dans le menu.
- 🟡 **Pas de notion de validation / preuve.** En BTP, documents et photos servent souvent de preuve
  (réception, PV, avancement). Aucun statut « à valider / validé ».
- 🟡 Galerie photo basique : pas de visionneuse plein écran, pas de regroupement « photos du jour »
  ou par tâche/réserve (les champs `task_id` / `issue_id` existent pourtant en base).

**À conserver :** filtre chantier, catégories, upload side-window.
**À enrichir :** renommer le menu, ajouter visionneuse photo, regroupements par usage, statut validation.

---

### 1.7 Rapports (`/rapports`, `+ /rapports/global`)

**Rôle actuel :** génération de rapports par chantier (hebdo/mensuel/ponctuel) + rapport global
multi-chantiers (LOT 14) + vue portfolio.

**Points forts :**
- LOT 14 : rapport global avec synthèse, vue par chantier, points à surveiller, activité, docs/photos.
- Impression propre (`@media print` masque la sidebar, `globals.css`).
- Choix clair Rapport chantier / Rapport global.

**Points faibles :**
- 🟡 « Rapports » et « Alertes » sont conceptuellement proches (synthèse de ce qui ne va pas) mais
  vivent dans des endroits différents (rapports = page ; alertes = cloche + badges + dashboard).
- 🟡 Le rapport global peut devenir dense ; à cadrer pour rester « présentable en réunion ».
- 🟢 Module sain dans l'ensemble.

**À conserver :** structure du rapport global, impression.
**À regrouper :** rapprocher conceptuellement Rapports & Alertes (cf. architecture V2).

---

### 1.8 Alertes / notifications (`lib/alerts.ts`, `NotifDropdown.tsx`, badges sidebar)

**Rôle actuel :** agrégation transverse des signaux (retard, bloqué, réserve critique, message récent,
échéance 7j). Surfacée via : cloche header (`NotifBell`), badges sidebar (Planning, Chantiers, Messages),
bloc « Priorités du jour » du dashboard.

**Points forts :**
- Logique d'agrégation propre, dédoublonnée (deadline exclut les déjà late/blocked).
- Multi-surface (cloche, badges, dashboard).

**Points faibles :**
- 🔴 **Trop de surfaces, définitions divergentes.** Le badge « Chantiers » = `issuesCritical`
  (high/critical). Le badge « Planning » = `tasksLate + tasksBlocked`. Le KPI dashboard « Réserves
  ouvertes » = `status open`. La cloche = tout. **L'utilisateur voit des chiffres différents pour
  des notions proches, sans modèle mental unifié.**
- 🟠 **Alertes peu actionnables.** Cloche et badges *signalent* mais la résolution se fait ailleurs.
  Pas de « marquer comme traité », pas d'action inline.
- 🟡 Le terme « notification » (cloche) vs « priorité » (dashboard) vs « alerte » (badge) — 3 mots
  pour un même concept.

**À conserver :** moteur `getAlertsSummary`.
**À unifier :** **un seul modèle d'alerte**, un vocabulaire unique, des alertes actionnables.

---

### 1.9 Onboarding chantier (`OnboardingChantier.tsx`)

**Rôle actuel :** création guidée. Deux parcours : « Nouveau chantier » (4 étapes) et « Chantier déjà
en cours » (5 étapes). Étapes : Infos → Tâches/État → Équipe → (Réserves) → Récap.

**Points forts :**
- Distinction nouveau / en cours = très pertinente métier (rare et précieux).
- Stepper clair, templates de tâches par type de chantier, choix d'équipe existante (LOT 13.E).
- Rassurant : « Vous pourrez modifier plus tard ».

**Points faibles :**
- 🟡 5 étapes pour un chantier en cours, c'est à la limite haute. Risque d'abandon.
- 🟡 L'étape Équipe propose 3 sous-modes (Passer / Équipe / Artisans) — un peu de charge.
- 🟢 Globalement un des meilleurs parcours de l'app.

**À conserver :** la dualité nouveau/en cours, les templates.
**À simplifier :** rendre certaines étapes optionnelles/skippables plus visiblement.

---

### 1.10 Menu / mini-menu (`Sidebar.tsx`)

**Rôle actuel :** navigation principale, collapsible (w-60 ↔ w-16), 3 groupes + bouton Nouveau + footer.

**Contenu réel :**
- **Principal** : Dashboard, Planning, Messages
- **Gestion** : Chantiers, Équipes, Documents, Rapports
- **Administration** (owner/admin) : Mon équipe
- Bouton « Nouveau » (dropdown : Chantier / Tâche / Message)
- Footer : profil + Paramètres + Déconnexion

**Points forts :**
- Collapsible bien fait (tooltips en mode mini, portal pour le dropdown).
- Badges contextuels sur les items.
- Bouton Nouveau central.

**Points faibles :**
- 🔴 **Regroupement discutable.** Pourquoi « Messages » est-il en Principal et « Chantiers » en
  Gestion ? Les chantiers sont le cœur du produit, ils devraient être en haut. La logique
  Principal/Gestion n'est pas évidente pour l'utilisateur.
- 🔴 **« Équipes » (Gestion) vs « Mon équipe » (Administration)** — cf. 1.5, doublon de nommage.
- 🟠 **Bandeau marque surchargé** : logo + nom + 3 boutons thème (Sun/Moon/Monitor) + collapse = 4
  contrôles serrés. Le réglage de thème n'a pas sa place au premier niveau, en permanence.
- 🟡 8 destinations de premier niveau, c'est beaucoup. Certaines peuvent fusionner.

**À conserver :** collapsible, bouton Nouveau, badges.
**À refondre :** regroupement et libellés (cf. architecture V2), sortir le thème du bandeau.

---

### 1.11 Side-windows (`SlidePanel.tsx`, `TaskSidePanel`, `TeamSlidePanel`, upload modals)

**Rôle actuel :** pattern de panneau latéral pour actions métier (tâche, équipe, upload doc/photo).

**Points forts :**
- 🟢 **Excellent choix de pattern** — la consigne « pas de modal métier » est respectée presque
  partout. À garder comme pilier du design system V2.

**Points faibles :**
- 🟡 Coexistence de `TaskPanel` (lecture, fiche) et `TaskSidePanel` (édition, planning) — deux
  panneaux tâche. À unifier.
- 🟡 Largeurs variables selon les panneaux (460px planning, autres). À normaliser.

**À conserver :** le pattern lui-même.
**À unifier :** un seul composant panneau tâche, largeurs standardisées.

---

### 1.12 Thème clair / sombre / système (`globals.css`, `ThemeProvider`)

**Rôle actuel :** 3 thèmes. Dark par défaut (`#0B0F19` fond, `#111827` surface).

**Points forts :**
- Tokens HSL propres, light ET dark définis, mode système.
- Tokens sémantiques (`surface`, `elevated`, `muted-foreground`, `success`, `warning`).

**Points faibles :**
- 🟠 **Dark par défaut très sombre** (`222 47% 7%`) — proche du noir. Peut paraître « back-office /
  terminal » plutôt que premium calme. À tempérer (un dark un peu plus doux et bleuté est plus Apple).
- 🟠 **Traitement des bordures incohérent** : on trouve partout `border-border/30 dark:border-white/[0.07]`
  en dur, répété dans des dizaines de composants. Pas de token unique → dérive visuelle.
- 🟡 Light mode moins soigné que le dark (densité de contraste à revoir).
- 🟡 3 boutons de thème toujours visibles = sur-offre pour un réglage rare.

**À conserver :** l'architecture de tokens.
**À régler :** adoucir le dark, créer un token de bordure unique, peaufiner le light, sortir le
sélecteur de thème vers les Paramètres (ou un seul toggle discret).

---

## 2. Diagnostic UX transverse

### 2.1 Navigation
- **Le menu n'est pas clair pour un non-initié.** Regroupement Principal/Gestion arbitraire, Chantiers
  noyé en 2ᵉ groupe alors que c'est le cœur.
- **Doublon de nommage critique** : Équipes vs Mon équipe.
- **Labels imparfaits** : « Documents » cache les photos.
- **Trop de premier niveau** (8 items) + réglage thème parasite.

### 2.2 Hiérarchie visuelle
- **Trop d'informations de même poids.** KPI, listes, cards, mini-stats se succèdent sans dramaturgie.
  L'œil ne sait pas où se poser car tout crie pareil.
- **Redondances multiples** (tâches en double sur dashboard ET fiche chantier ; activité en double).
- Manque de **« une chose importante par écran »**.

### 2.3 Alertes
- **Pas de modèle mental unifié** : 4 définitions différentes de « ce qui ne va pas » selon la surface.
- **Peu actionnables** : on signale, on ne résout pas inline.
- **Vocabulaire éclaté** : notification / priorité / alerte.

### 2.4 Planning
- C'est **plus qu'un Gantt** (dépendances, conflits, analyse) — mais ça ne se *voit* pas comme un
  outil de décision : la résolution est cachée derrière un clic sur conflit.
- **Toolbar trop dense** pour le public cible.
- Manque un **panneau de résolution permanent** et des **actions de correction en 1 clic**.

### 2.5 Documents / Photos
- Assez simple depuis le LOT 14 (filtre chantier). Bonne base.
- Manque : visionneuse photo, regroupements par usage, notion de **validation/preuve**.
- Pas « trop GED » — risque inverse maîtrisé. ✅

### 2.6 Équipes / Terrain
- Page = **annuaire**, pas **terrain**. Ne répond pas à « qui intervient où aujourd'hui ».
- Doublon de nommage avec les membres du compte.

### 2.7 Rapport global
- Utile, présentable, imprimable. Veiller à ne pas le densifier.
- Conceptuellement proche des Alertes → à rapprocher.

### 2.8 Onboarding
- Bon parcours. Léger risque de longueur (5 étapes en cours).

### 2.9 Design
- **Trop dense** par endroits (fiche chantier surtout).
- **Trop sombre** par défaut.
- **Pas assez respirant** sur les écrans riches.
- **Un peu back-office** (bordures dures répétées, fond quasi noir).
- Bonnes fondations (tokens, side-windows, ProjectCard) à capitaliser.

---

## 3. Analyse des frictions (synthèse priorisée)

| # | Friction | Écran(s) | Gravité | Effort fix |
|---|----------|----------|---------|------------|
| F1 | Doublon nommage Équipes / Mon équipe | Sidebar, /equipes, /settings/team | 🔴 Critique | Faible |
| F2 | Double liste de tâches redondante | Dashboard | 🔴 Critique | Faible |
| F3 | Fiche chantier = scroll unique 10+ sections | /chantiers/[id] | 🔴 Critique | Élevé |
| F4 | Triple redondance tâches | Fiche chantier | 🔴 Critique | Moyen |
| F5 | Modèle d'alerte non unifié (4 définitions) | Transverse | 🔴 Critique | Moyen |
| F6 | Alertes non actionnables | Transverse | 🟠 Majeur | Moyen |
| F7 | Toolbar Planning trop dense | /planning | 🟠 Majeur | Moyen |
| F8 | Résolution planning cachée | /planning | 🟠 Majeur | Élevé |
| F9 | KPI non cliquables | Dashboard, fiche | 🟠 Majeur | Faible |
| F10 | Navigation : regroupement + Chantiers noyé | Sidebar | 🟠 Majeur | Faible |
| F11 | Dark trop sombre / bordures incohérentes | Global | 🟠 Majeur | Moyen |
| F12 | ProjectCard sans signal de risque | Dashboard, /chantiers | 🟡 Moyen | Faible |
| F13 | Équipes = annuaire, pas terrain | /equipes | 🟡 Moyen | Élevé |
| F14 | Label « Documents » cache les photos | Sidebar | 🟡 Mineur | Trivial |
| F15 | Deux panneaux tâche (TaskPanel / TaskSidePanel) | Fiche / Planning | 🟡 Moyen | Moyen |
| F16 | Sélecteur de thème parasite le bandeau | Sidebar | 🟡 Mineur | Faible |

---

## 4. Ce qu'il faut GARDER (ne pas casser)

- Le **pattern side-window** (`SlidePanel`) — pilier V2.
- Le **moteur Planning** : dépendances, conflits, anti-cycle, undo/redo, mode analyse LOT 6.E.
- `ProjectCard`, `KpiPanel`, `ActivityFeed`, `OnboardingChantier`.
- L'**architecture de tokens** (globals.css) — à raffiner, pas à jeter.
- La **dualité onboarding** nouveau / en cours.
- Le **filtre chantier** Documents (LOT 14) et le **rapport global**.
- Le **modèle d'assignation** équipe/artisan (LOT 13.E).

## 5. Ce qu'il faut SIMPLIFIER / FUSIONNER / SUPPRIMER / RENOMMER

- **Fusionner** les deux listes de tâches du dashboard → une file d'actions unique.
- **Fusionner** les trois représentations de tâches de la fiche chantier → onglets.
- **Fusionner** `TaskPanel` + `TaskSidePanel` → un panneau tâche unique.
- **Unifier** le modèle d'alerte (un vocabulaire, une définition, des actions).
- **Renommer** « Mon équipe » → « Membres & accès » ; « Documents » → « Documents & photos ».
- **Supprimer** la double activité de la fiche chantier ; les mini-stats mortes (Matériaux compteur).
- **Sortir** le sélecteur de thème du bandeau marque.
- **Dégrossir** la toolbar Planning.

---

## 6. Priorités (ce qui rapporte le plus, vite)

1. **Quick wins à fort impact, faible coût (Sprint 0) :** F1 (renommage), F2 (fusion listes dashboard),
   F9 (KPI cliquables), F10 (nav), F12 (badge risque card), F14, F16.
2. **Cœur de la refonte (Sprint 1-2) :** F3+F4 (fiche chantier en onglets), F5+F6 (modèle d'alerte unifié
   et actionnable).
3. **Valeur cockpit (Sprint 3) :** F7+F8 (Planning : toolbar + panneau résolution permanent).
4. **Finitions (Sprint 4) :** F11 (design system), F13 (terrain), F15 (panneau tâche unique).

> **La suite de la démarche est détaillée dans `PLANZY_DESIGN_DIRECTION_V2.md` (cible) et
> `PLANZY_ROADMAP_UX_V2.md` (exécution).**
