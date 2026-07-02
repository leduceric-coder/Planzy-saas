# PLANZY — ROADMAP UX V2

> Plan d'exécution séquencé de la refonte UX. **Aucune modification de code dans ce lot (15.A).**
> À lire après `PLANZY_UX_V2_AUDIT.md` et `PLANZY_DESIGN_DIRECTION_V2.md`.
> Convention modèle : **Opus** = conception/architecture/refactor structurant ; **Sonnet** =
> implémentation cadrée ; **Haiku** = tâches mécaniques (renommages, passes répétitives).

---

## 1. Parcours utilisateurs à simplifier (Phase 4)

Pour chaque parcours : état actuel probable, friction, cible V2, écrans, microcopy, priorité.

### P1 — Créer un chantier · 🟢 Priorité moyenne
- **Actuel :** Nouveau chantier → onboarding 4 étapes (Infos → Tâches → Équipe → Récap). Bon.
- **Friction :** légère longueur ; étape Équipe à 3 sous-modes.
- **Cible V2 :** garder ; rendre l'étape Équipe « skippable » plus visiblement ; récap plus visuel.
- **Écrans :** `OnboardingChantier`.
- **Microcopy :** « Vous pourrez ajouter l'équipe plus tard » (CTA secondaire « Passer cette étape »).

### P2 — Reprendre un chantier en cours · 🟢 Priorité moyenne
- **Actuel :** parcours « en cours » 5 étapes (Infos → État → Équipe → Réserves → Récap). Différenciateur.
- **Friction :** 5 étapes = limite haute, risque d'abandon.
- **Cible V2 :** marquer Réserves comme optionnelle ; barre de progression rassurante ; sauvegarde implicite.
- **Écrans :** `OnboardingChantier`.
- **Microcopy :** « Renseignez ce que vous savez, complétez plus tard. »

### P3 — Voir ce qui ne va pas aujourd'hui · 🔴 Priorité haute
- **Actuel :** dashboard avec **deux** listes de tâches concurrentes + KPI non cliquables.
- **Friction :** redondance, pas d'action directe, définitions d'alerte divergentes.
- **Cible V2 :** **une file d'actions unique**, KPI cliquables, alertes actionnables.
- **Écrans :** Dashboard, `AlertesPrioritaires` (fusion), `TaskAlertList` (supprimé), `KpiPanel`.
- **Microcopy :** titre « À traiter aujourd'hui » ; lignes « Retard 3j », « Bloquée », « Réserve critique ».

### P4 — Corriger une alerte planning · 🔴 Priorité haute
- **Actuel :** il faut deviner qu'on clique un conflit de dépendance pour entrer en mode analyse.
- **Friction :** résolution cachée ; pas d'action 1-clic.
- **Cible V2 :** **panneau droit permanent « Alertes & résolution »** ; bouton *Replanifier* inline.
- **Écrans :** `GanttView`, nouveau panneau, `ReplanifierModal` (existant à brancher), `TaskSidePanel`.
- **Microcopy :** « Chevauchement de 3 jours » + [Replanifier] [Voir la tâche] [Marquer traité].

### P5 — Corriger une réserve critique · 🟠 Priorité haute
- **Actuel :** réserve visible dans fiche chantier (section Réserves) + alerte dashboard.
- **Friction :** résolution = ouvrir fiche → trouver section → éditer.
- **Cible V2 :** action « Ouvrir la réserve » depuis l'alerte ; résolution inline (statut) dans l'onglet Réserves.
- **Écrans :** Dashboard (alerte), fiche chantier onglet Réserves.
- **Microcopy :** « Marquer résolue » / « Rouvrir ».

### P6 — Retrouver un document · 🟢 Priorité moyenne (déjà bon depuis LOT 14)
- **Actuel :** /documents avec filtre chantier (LOT 14). Correct.
- **Friction :** label menu « Documents » cache les photos ; pas de visionneuse.
- **Cible V2 :** label « Documents & photos » ; filtre type ; ouverture rapide.
- **Écrans :** Sidebar (label), `DocumentsClient`.

### P7 — Ajouter une photo chantier · 🟢 Priorité basse (bon)
- **Actuel :** upload side-window avec chantier pré-rempli (`defaultProjectId`). Bon.
- **Friction :** mineure.
- **Cible V2 :** garder ; ajouter légende rapide + association tâche/réserve optionnelle.
- **Écrans :** `UploadPhotoModal`.

### P8 — Voir qui intervient sur un chantier · 🟡 Priorité moyenne
- **Actuel :** fiche chantier section Équipe ; page /equipes = annuaire.
- **Friction :** pas de vue « qui/où aujourd'hui ».
- **Cible V2 :** onglet « Terrain » dans Équipes & terrain ; lien équipe → planning filtré.
- **Écrans :** `EquipesClient` (+ onglet Terrain), fiche chantier onglet Équipe.

### P9 — Générer un rapport global · 🟢 Priorité basse (fait au LOT 14)
- **Actuel :** /rapports/global opérationnel, imprimable.
- **Friction :** risque de densité.
- **Cible V2 :** garder ; veiller concision ; rapprocher du centre d'alertes.
- **Écrans :** `RapportGlobalView`.

### P10 — Préparer une réunion chantier · 🟡 Priorité moyenne
- **Actuel :** pas de parcours dédié ; on compose à la main (fiche + rapport + photos).
- **Friction :** dispersion.
- **Cible V2 :** depuis fiche chantier, « Préparer la réunion » → rapport chantier + dernières photos +
  réserves ouvertes, imprimable. (S'appuie sur l'existant rapports/impression.)
- **Écrans :** fiche chantier, `RapportView`.
- **Priorité :** V2+ (après le cœur).

---

## 2. Roadmap par lots (Phase 6)

Séquence pensée pour livrer de la valeur tôt, dérisquer le structurant, finir par le polish.
Chaque lot reste **court et autonome** (compatible « 0 erreur TS + Vercel READY » à chaque fin de lot).

---

### 🟦 LOT 15.B — Navigation V2 & quick wins
- **Objectif :** corriger les frictions navigation + plusieurs quick wins fort impact / faible coût.
- **Périmètre :**
  - Renommer libellés + réordonner nav (2 groupes Pilotage/Ressources, Chantiers remonté).
  - Renommer « Mon équipe » → « Membres & accès » (Administration). Fin du doublon (F1).
  - Label « Documents » → « Documents & photos » (F14).
  - Sortir le sélecteur de thème du bandeau marque → footer/Paramètres (F16).
  - Arbitrer Messages (contextuel vs footer discret) — décision produit à acter.
- **Fichiers probables :** `components/layout/Sidebar.tsx`, `app/(dashboard)/settings/team/page.tsx`
  (titre), éventuel `ThemeProvider`/footer.
- **Risques :** faibles. Ne pas changer les routes. Vérifier l'état actif (`pathname.startsWith`).
- **Modèle :** **Sonnet** (cadré). Renommages → possible **Haiku**.
- **Dépendances :** aucune. **Priorité : 1 (immédiat).**
- **Validation :** menu lisible, plus aucun doublon de nommage, thème accessible, 0 erreur TS.

---

### 🟦 LOT 15.C — Dashboard V2 (file d'actions unique)
- **Objectif :** répondre franchement à « Que dois-je traiter aujourd'hui ? ».
- **Périmètre :**
  - Fusionner `AlertesPrioritaires` + `TaskAlertList` → **une file d'actions unique** actionnable (F2).
  - Rendre les 4 KPI **cliquables** vers leurs listes filtrées (F9).
  - Aligner la définition « réserve à traiter » sur `getAlertsSummary` (F5 partiel).
  - Badge risque sur `ProjectCard` (F12).
- **Fichiers probables :** `app/(dashboard)/page.tsx`, `components/dashboard/AlertesPrioritaires.tsx`,
  `TaskAlertList.tsx` (suppression/fusion), `ProjectCard.tsx`, `KpiCard.tsx`.
- **Risques :** moyens (cohérence des compteurs). Tester empty states.
- **Modèle :** **Opus** (conception de la file unifiée) → **Sonnet** (implémentation).
- **Dépendances :** s'appuie sur le modèle d'alerte (peut précéder 15.D mais s'aligne dessus).
  **Priorité : 2.**
- **Validation :** une seule liste de tâches, KPI cliquables, chiffres cohérents avec badges.

---

### 🟥 LOT 15.D — Modèle d'alerte unifié & actionnable
- **Objectif :** un seul modèle d'alerte, un vocabulaire, des actions inline (F5, F6).
- **Périmètre :**
  - Centraliser la définition (3 niveaux : Critique / À surveiller / Info) dans `lib/alerts.ts`.
  - KPI, badges, cloche, dashboard lisent les **mêmes** compteurs.
  - Actions inline (Voir / Replanifier / Ouvrir réserve / Marquer traité — acquittement V2+).
  - Vocabulaire unique « Alerte » partout (cloche/badge/dashboard).
- **Fichiers probables :** `lib/alerts.ts`, `components/layout/NotifDropdown.tsx`,
  `components/layout/AlertsContext.tsx`, `Sidebar.tsx` (badges), dashboard.
- **Risques :** moyens — transverse. Ne pas régresser les badges existants.
- **Modèle :** **Opus** (modèle de données/contrat) → **Sonnet** (câblage surfaces).
- **Dépendances :** idéalement avant/avec 15.C et 15.E. **Priorité : 2-3.**
- **Validation :** mêmes chiffres partout, vocabulaire unique, au moins une action par alerte.

---

### 🟥 LOT 15.E — Planning V2 : panneau droit « Alertes & résolution »
- **Objectif :** transformer le Gantt en outil de décision (F7, F8) — **le différenciateur**.
- **Périmètre :**
  - Panneau droit **permanent** (repliable) listant les conflits triés par gravité.
  - Chaque conflit : action *Replanifier* (brancher `ReplanifierModal` existant), *Voir*, *Marquer traité*.
  - Toolbar regroupée en 3 blocs (Affichage / Période / Outils).
  - Adoucir le halo de conflit (`shadow-glow-red`).
- **Fichiers probables :** `components/planning/GanttView.tsx`, `TaskSidePanel.tsx`,
  `ReplanifierModal.tsx`, `app/globals.css` (halo), nouveau composant panneau.
- **Risques :** **élevés** — fichier le plus complexe (1600 l.). Ne pas réactiver drag/resize, ne pas
  toucher au scroll unique, anti-cycle, undo/redo, side-window. Refactor prudent et incrémental.
- **Modèle :** **Opus** (architecture du panneau + intégration sans régression).
- **Dépendances :** s'appuie sur 15.D (modèle d'alerte). **Priorité : 3.**
- **Validation :** résolution atteignable sans deviner, 1-clic Replanifier, undo/redo intacts, 0 régression.

---

### 🟧 LOT 15.F — Fiche chantier V2 (onglets)
- **Objectif :** tuer le scroll unique 10+ sections (F3, F4) sans perdre de fonctionnalité.
- **Périmètre :**
  - Passage en **onglets** : Vue d'ensemble / Tâches / Équipe / Documents & photos / Réserves / Activité.
  - Supprimer les redondances tâches (1 vue) et la double activité.
  - Sortir Modifier/Archiver dans un menu « … ».
  - Unifier vers **un seul panneau tâche** (amorce de F15).
- **Fichiers probables :** `components/chantiers/ChantierDetail.tsx` (refactor majeur),
  `components/tasks/TaskPanel.tsx`, `TaskSidePanel.tsx`.
- **Risques :** **élevés** — gros composant (1027 l.). Découper en sous-composants d'onglet. Préserver
  side-window, ne pas casser les données (LOT 13.E équipe/artisan).
- **Modèle :** **Opus** (architecture onglets + découpe) → **Sonnet** (onglets simples).
- **Dépendances :** bénéficie de 15.D. **Priorité : 3-4.**
- **Validation :** navigation par onglets, aucune redondance, parité fonctionnelle, 0 erreur TS.

---

### 🟨 LOT 15.G — Documents & photos V2
- **Objectif :** retrouver et présenter pièces/preuves plus agréablement (P6, P7).
- **Périmètre :**
  - **Visionneuse photo** plein écran (overlay, légende, navigation ←/→).
  - Filtre type document ; regroupement « derniers ajouts ».
  - (Option) regroupement par usage via `task_id`/`issue_id` existants.
  - (Option) statut validation si métier confirmé.
- **Fichiers probables :** `components/documents/DocumentsClient.tsx`, nouveau composant visionneuse.
- **Risques :** faibles-moyens. Conserver signed URLs / sécurité.
- **Modèle :** **Sonnet**.
- **Dépendances :** aucune. **Priorité : 4.**
- **Validation :** visionneuse fluide, filtres, 0 régression upload.

---

### 🟨 LOT 15.H — Équipes & terrain V2
- **Objectif :** rendre la page opérationnelle (P8, F13).
- **Périmètre :**
  - Onglet **« Terrain »** : équipes actives → chantiers couverts (semaine), lien planning filtré.
  - Onglet **« Annuaire »** : l'existant.
  - Carte/plan : **non prioritaire** (V2+ si adresses fiables).
- **Fichiers probables :** `components/equipes/EquipesClient.tsx`, nouvelle vue Terrain,
  données planning/affectations.
- **Risques :** moyens (agrégation de données). Pas de migration.
- **Modèle :** **Opus** (conception vue terrain) → **Sonnet**.
- **Dépendances :** bénéficie de 15.E (planning). **Priorité : 4-5.**
- **Validation :** « qui/où » répondu en un coup d'œil.

---

### 🟨 LOT 15.I — Rapports & alertes V2
- **Objectif :** rapprocher synthèse et surveillance (P9, P10).
- **Périmètre :**
  - Regrouper Rapports & centre d'alertes sous une même entrée.
  - Parcours « Préparer la réunion » (rapport chantier + photos + réserves, imprimable).
  - Veiller à la concision du rapport global.
- **Fichiers probables :** `app/(dashboard)/rapports/*`, `components/rapports/*`.
- **Risques :** faibles. Conserver l'impression (`@media print`).
- **Modèle :** **Sonnet**.
- **Dépendances :** 15.D (alertes). **Priorité : 5.**
- **Validation :** synthèse claire, imprimable, parcours réunion fonctionnel.

---

### 🟩 LOT 15.J — Polish design system
- **Objectif :** cohérence visuelle finale (F11, F15, calme global).
- **Périmètre :**
  - **Token de bordure unique** ; bannir `border-border/30 dark:border-white/[0.07]` en dur.
  - **Adoucir le dark** (fond légèrement remonté) ; peaufiner le light.
  - Normaliser cards (catalogue §7 de la Direction Design), largeurs side-windows.
  - Unifier définitivement le panneau tâche (F15).
  - Audit contraste (bannir les `/40` `/50` sous le seuil).
- **Fichiers probables :** `app/globals.css`, `tailwind.config.*`, composants `ui/*`, cards.
- **Risques :** moyens (transverse visuel). Passes incrémentales + revue visuelle clair/sombre.
- **Modèle :** **Opus** (définition système) → **Haiku/Sonnet** (passes de remplacement).
- **Dépendances :** après les refontes d'écrans. **Priorité : 6 (fin).**
- **Validation :** cohérence visuelle, dark adouci, contraste AA, 0 régression.

---

## 3. Ordre recommandé (synthèse)

```
Sprint 0 (quick wins)     : 15.B
Sprint 1 (pilotage)       : 15.D → 15.C
Sprint 2 (cockpit)        : 15.E
Sprint 3 (chantier)       : 15.F
Sprint 4 (ressources)     : 15.G, 15.H, 15.I
Sprint 5 (polish)         : 15.J
```

**Logique :** on stabilise d'abord le **modèle d'alerte** (15.D) car dashboard (15.C), planning (15.E)
et fiche chantier (15.F) en dépendent. On finit par le **design system** (15.J) une fois les écrans
stabilisés, pour ne pas repeindre deux fois.

---

## 4. Matrice modèle Claude par lot

| Lot | Nature | Modèle conception | Modèle implémentation |
|-----|--------|-------------------|------------------------|
| 15.B | Nav + quick wins | — | Sonnet (Haiku pour renommages) |
| 15.C | Dashboard | Opus | Sonnet |
| 15.D | Modèle d'alerte | Opus | Sonnet |
| 15.E | Planning (complexe) | **Opus** | **Opus** |
| 15.F | Fiche chantier (gros refactor) | **Opus** | Opus/Sonnet |
| 15.G | Documents/photos | — | Sonnet |
| 15.H | Équipes/terrain | Opus | Sonnet |
| 15.I | Rapports/alertes | — | Sonnet |
| 15.J | Design system | Opus | Haiku/Sonnet |

> Règle : **Opus** dès qu'il y a refactor structurant ou risque de régression (15.E, 15.F surtout).
> **Sonnet** pour l'implémentation cadrée. **Haiku** pour les passes mécaniques (renommages, remplacement
> de classes).

---

## 5. Points de vigilance (à respecter sur TOUS les lots)

Contraintes héritées des lots précédents — **interdictions absolues** :
- Ne jamais désactiver RLS ; jamais de `service_role` côté client ; aucun secret en dur.
- Ne pas modifier le schéma Supabase ni créer de migration sans accord explicite.
- Ne pas modifier les dates automatiquement.
- Ne pas réactiver drag/resize sur le Gantt ; ne pas toucher au scroll unique du planning.
- Ne pas casser la side-window ; ne pas casser l'anti-cycle ; ne pas toucher `task_dependencies`.
- Ne pas réintroduire : modals métier ; crash sur `full_name`/données null ; redirection vague.
- **0 erreur TypeScript + Vercel READY à chaque fin de lot.**

Vigilances UX spécifiques :
- Préserver la **parité fonctionnelle** lors des refontes (ne rien perdre, juste réorganiser).
- Tester systématiquement **clair ET sombre**, et le **responsive desktop/laptop**.
- Vérifier les **empty states** après chaque refonte d'écran.
- Refactors lourds (15.E, 15.F) : **incrémental**, sous-composants, commits petits et vérifiables.

---

## 6. Critères de validation transverses (Definition of Done UX V2)

Un lot est « done » quand :
1. Il répond à *une* question utilisateur clairement (principe « une chose par écran »).
2. Aucune redondance réintroduite (pas de double liste, double activité, double panneau).
3. Vocabulaire unique respecté (Alerte, réserve, échéance…).
4. Toute alerte affichée est actionnable.
5. Clair + sombre + responsive vérifiés.
6. 0 erreur TS, build OK, Vercel READY.
7. Aucune contrainte du §5 violée.

---

## 7. GO / NO GO — recommandation

**GO pour lancer la refonte UX V2**, en commençant par **15.B (quick wins)** puis **15.D (modèle
d'alerte)**.

Justification : le diagnostic est clair et fondé sur le code réel ; les problèmes sont des excès de
densité et de redondance, **pas des manques fonctionnels** — donc la V2 est majoritairement du
**réagencement à risque maîtrisé**, sauf deux lots structurants (15.E Planning, 15.F Fiche chantier)
qui exigent Opus et une approche incrémentale. Aucune migration n'est requise. Le pattern side-window
et le moteur planning, déjà solides, sont conservés.

**Condition du GO :** acter en amont les **3 décisions produit** suivantes (cf. document de synthèse) —
sort de Messages dans la nav, niveau de validation documents, priorité de la vue Terrain — pour ne
pas bloquer 15.B et 15.H.
