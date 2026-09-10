# Kanvix V2.4.11 — Harmonisation responsive + identité visuelle des chantiers

Source : `public/poc/kanvix-next-gen-v2.4.10.2.html` → cible `public/poc/kanvix-next-gen-v2.4.11.html`.
Version **UX / layout uniquement** : aucun moteur métier n'a été modifié (vérifié fonction par fonction).

## Verdict

**PASS.** Kanvix exploite désormais harmonieusement un écran 1920 à 100 %, les chantiers sont identifiables instantanément dans le Gantt et le Kanban, la charge des ressources fait partie de la page Équipe, et l'aperçu planning d'un chantier respire.

| Résultat | |
|---|---|
| Recette UI V2.4.11 (`recette-ui-responsive-v2.4.11.mjs`, UI-01→UI-19) | **47 / 47** |
| Accueil · Mode Chantier · Réglages · Édition · Import · ancien Planning | **149 · 95 · 63 · 58 · 75 · 17** |
| Planning Bureau · Résoudre dates · Chantiers (audit) | **76 · 14 · 48** |
| **Total** | **642 / 642** |
| Erreurs console applicatives | **0** |

## 1. Largeur maximale avant / après

| | Avant (V2.4.10.2) | Après (V2.4.11) |
|---|---|---|
| `.main` max-width | **1320 px** | **1760 px** |
| `.main` padding latéral | `40px` fixe | `clamp(24px, 3vw, 52px)` |

Le chiffre d'orientation du cahier des charges (1680) a été porté à **1760** après inspection : à 1920 avec la sidebar (178 px), la zone disponible est de ~1742 px. Un plafond à 1680 laissait 30 px de marge externe **+** 52 px de padding = 82 px de retrait, au-delà de la cible « 32–56 px » (§37). À 1760, `.main` remplit la zone disponible et la marge visible se réduit au padding : **52 px exactement**.

## 2. Comportement 1920

`.main` = **1727 px** (zone disponible 1742 − barre de défilement), marge de contenu **52 px**, **0 scroll horizontal**. L'Accueil présente deux colonnes équilibrées, la semaine occupe toute la largeur utile, plus de vide massif à droite. Les Chantiers affichent **4 cartes sur une seule ligne** (392 px chacune) — sans trou latéral ni carte démesurée.

## 3. Comportement 1440

`.main` = 1247 px, padding 43 px. **Aucun contrôle comprimé**, aucun scroll horizontal sur Accueil / Chantiers / Planning / Équipe. Le layout antérieur reste confortable (le plafond n'intervient pas en dessous de ~1940 px de fenêtre).

## 4. Comportement 900

Règles responsive existantes conservées (`@media (max-width:1080px)` reprend la main sur le padding). **0 overflow de page** sur Accueil, Chantiers, Planning, Équipe.

## 5. Comportement 390

Aucune casse : Accueil, Chantiers, Équipe sans overflow de page. Le Mode Chantier n'a pas été touché.

## 6. Mapping couleur chantier

Source **unique** : `projectToneKey(id)` → `projectToneClass(id)`.
- L'index est dérivé de l'**identifiant** du chantier (jamais du nom) : `PROJECT_VISUAL_INDEX[id]` pour les chantiers de démo, sinon `hashHue(id)` — deux helpers **déjà présents**.
- **Aucune propriété persistante ajoutée**, aucun champ de schéma.
- Palette de **8 teintes** : blue, green, teal, amber, violet, indigo, cyan, slate — chacune déclarant trois variables (`--project-accent`, `--project-soft`, `--project-ink`) plus une variante sombre.

Mapping obtenu sur la démo : **Résidence Keravel → bleu · Les Terrasses → vert · Villa du Port → teal · Bâtiment Horizon → ambre**. Stable après changement de période, de filtre et de représentation (vérifié UI-05 / UI-09 / UI-10).

## 7. Gantt

Le bandeau de groupe porte un fond teinté très subtil (`color-mix(in srgb, var(--project-accent) 10%, var(--surface))`), une **bordure gauche 3 px** à l'accent du chantier et une **pastille** devant le nom. Les lignes de tâches ne sont **pas** teintées (§12) et les **barres conservent leurs couleurs propres** (statut, danger, simulation, baseline, chaîne d'impact) — §13. En vue mono-chantier (`.gantt-single`), l'aplat tombe à 4 % : le repère demeure sans surdimensionner le code couleur (§14/§55).

**§45 vérifié** : Résidence Keravel garde son bandeau bleu tout en affichant le badge **Risque** rouge. La couleur chantier ne remplace jamais le signal métier.

## 8. Kanban

Chaque carte porte : **liseré supérieur 3 px** à l'accent du chantier, **badge compact** (fond `--project-soft`, texte `--project-ink`) précédé d'une **pastille**. La carte reste sur fond surface (§17) ; les badges métier (« À TRAITER », reprise) et les dépendances gardent la priorité (§46). Les **3 colonnes sont strictement conservées** (À faire / En cours / Terminée) — aucune colonne « En attente » n'a été introduite (§18) ; les statuts internes `waiting`/`late` restent gérés comme en V2.4.10.2.

**Légende** discrète sous le tableau en vue multi-chantiers uniquement, masquée dès qu'un seul chantier est filtré (§19, vérifié UI-08).

## 9. Équipe / charge

Le lien « Charge semaine → » a disparu du header (§26) ; « + Ressource » est conservé. La page affiche désormais, directement sous la liste : **« Charge des ressources »** + « Visibilité de la charge de travail sur la semaine en cours. » + le tableau de charge complet.

**Aucun calcul dupliqué** : le corps de `renderResources()` a été extrait dans un composant unique **`resourceLoadBoard()`**, consommé à la fois par la page Équipe et par la route historique. Le test UI-14 compare octet à octet le HTML `.resources` rendu dans Équipe et celui produit par le composant : **identiques**. `getResourceWeekDays` / `getResourceState` / `getResourceLoad` / `getMaxConcurrentTasks` / `resourceConflictNudge` restent la seule vérité, l'interaction `openResource()` est préservée.

La route `go('resources')` **reste fonctionnelle** (aucun retrait brutal de legacy, §30) : elle affiche exactement le même composant, précédé de son retour « ← Équipe ».

## 10. Chantier > Planning

Structure introduite (le moteur `gantt()` est inchangé) :

```
<div class="project-planning-actions"> [ Ouvrir le planning complet ] </div>
<div class="project-planning-preview">  ${gantt(id)}                    </div>
```

Espacement mesuré entre le bas du bouton et le haut de l'aperçu : **22 px** (cible ≥ 18 px, §61).

## 11. Dark mode

Chaque teinte possède une variante sombre désaturée (`--project-soft` en `rgba(...,0.13)`), sans effet fluo. Bandeaux Gantt, badges Kanban, légende et textes restent lisibles ; les couleurs métier conservent leur contraste (vérifié UI-16 + captures `08-dark-gantt` / `09-dark-kanban`).

## 12. Sidebar collapsed

À 1920 : sidebar ouverte → `.main` = 1727 px ; sidebar repliée (68 px) → `.main` = **1760 px**. Le contenu **exploite l'espace libéré**, sans saut brutal ni scroll horizontal (UI-17).

## 13. Overflow

**0 scroll horizontal de page** à 1920, 1680, 1600, 1440, 1366, 1280, 1080, 900, 768, 430 et 390. Le Gantt conserve son propre scroll horizontal interne lorsque nécessaire (comportement inchangé).

## 14. Résultats UI-01 → UI-19

| Test | Objet | Résultat |
|---|---|---|
| UI-01 | 1920 : largeur exploitée + marge élégante | **PASS** |
| UI-02 | 1440 : aucune régression layout | **PASS** |
| UI-03 | 900 : aucun overflow | **PASS** |
| UI-04 | 390 : aucune casse majeure | **PASS** |
| UI-05 | Gantt : identité couleur stable | **PASS** |
| UI-06 | Gantt : noms chantier toujours présents | **PASS** |
| UI-07 | Gantt : Risque / À surveiller restent distincts | **PASS** |
| UI-08 | Kanban : cartes affichent l'identité chantier (+ légende) | **PASS** |
| UI-09 | Kanban : même chantier = même couleur | **PASS** |
| UI-10 | Gantt / Kanban : même mapping | **PASS** |
| UI-11 | Kanban : exactement 3 colonnes | **PASS** |
| UI-12 | Équipe : aucun lien « Charge semaine » | **PASS** |
| UI-13 | Équipe : charge visible sous la liste | **PASS** |
| UI-14 | Équipe : données identiques au moteur existant | **PASS** |
| UI-15 | Chantier > Planning : espacement conforme (22 px) | **PASS** |
| UI-16 | Dark mode : couleurs chantier lisibles | **PASS** |
| UI-17 | Sidebar collapsed exploite l'espace | **PASS** |
| UI-18 | 0 scroll horizontal desktop | **PASS** |
| UI-19 | 0 erreur console | **PASS** |

## 15. Suites de non-régression

Accueil **149/149** · Mode Chantier **95/95** · Réglages **63/63** · Édition des tâches **58/58** · Import intelligent **75/75** · ancien Planning **17/17** · Planning Bureau **76/76** (PLAN-F1→F10 = 10/10) · Résoudre dates **14/14** · Chantiers (audit) **48/48**. **Aucune régression.**

## 16. Erreurs console

**0 erreur JavaScript applicative** sur l'ensemble de la recette.

## 17. Périmètre technique & réserves

**Moteurs métier vérifiés byte-identiques** (§47) : `planReflow`, `applyReflowPlan`, `setTaskStatus`, `requestTaskScheduleMove`, `dropTask`, `kanbanDrop`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `alignDemoDates`, `analyzeKanvixImport`, `applyImportPlan`, `confirmCloseProject`, `restoreProject`, `deleteProjectCascade`. `SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (`kanvix-product-8-3`), aucune migration. Sidebar, design system et navigation inchangés (aucune sidebar bleu foncé : la maquette n'a pas été recopiée).

**Réserves / points d'attention :**

1. **Messagerie** — elle vit dans `.main` et hérite donc de la largeur fluide. Le comportement fonctionnel est inchangé et aucun test ne régresse, mais si une largeur de lecture contrôlée est souhaitée pour cette page (§4), elle devra faire l'objet d'un plafond dédié dans une version ultérieure.
2. **Réglages** conserve sa colonne centrale à 820 px (plafond interne déjà présent) : la nouvelle largeur ne l'affecte pas.
3. **Charge des ressources dans Équipe** est affichée en **Pilotage uniquement**, comme l'était le lien « Charge semaine → » qu'elle remplace ; l'expérience Essentiel est donc inchangée.
4. La **palette compte 8 teintes** : au-delà de 8 chantiers simultanément visibles, deux chantiers peuvent partager une teinte. Le nom du chantier étant toujours affiché (§44), l'identification reste garantie.

## Question finale

> « À 100 % sur un grand écran, Kanvix donne-t-il désormais l'impression d'être une application professionnelle pensée pour utiliser l'espace disponible, tout en permettant de distinguer instantanément les chantiers dans le Gantt et le Kanban ? »

**OUI.** À 1920, `.main` occupe 1727 px avec 52 px de marge élégante ; les groupes Gantt sont segmentés par un bandeau teinté + pastille, et chaque carte Kanban porte un badge coloré identifiant son chantier — avec la même couleur des deux côtés.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.11.html` — fichier complet.
2. `recette-ui-responsive-v2.4.11.mjs` — suite (47 vérifications, UI-01→UI-19).
3. `rapport-recette-ui-v2.4.11.md` — ce rapport.
4. Captures : `recette-ui-v2.4.11/` (01→12).
