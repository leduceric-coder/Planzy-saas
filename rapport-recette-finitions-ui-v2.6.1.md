# Kanvix V2.6.1 — Finitions UX : Planning, sidewindow Ressource, Charge des ressources

Source de vérité : `kanvix-next-gen-v2.6.0.html`
Version livrée : `kanvix-next-gen-v2.6.1.html`
Suite dédiée : `recette-finitions-ui-v2.6.1.mjs` — **64 assertions, 64 PASS, 0 FAIL, 0 erreur console**
Rejeu V2.6.0 : `recette-lots-v2.6.0.mjs` **non modifiée** → **130 PASS / 1 FAIL** (une assertion purement DOM, documentée au §18)
Captures : `recette-v2.6.1/` (10 captures nommées)

**`STORE = "kanvix-product-8-3"` et `SCHEMA_VERSION = 10` inchangés. Aucune migration. Aucune règle métier touchée.**

---

## 1. Structure V2.6.0 avant correction

Dans la colonne gauche du Gantt, chaque ligne était rendue ainsi :

```html
<div class="g-label">
  <b>Cloisons étage 1</b>
  <small>Mathieu</small>
  <span class="lot-chip lchip-indigo compact"><i></i><span>Plâtrerie</span></span>
</div>
```

Soit, à l'écran :

```
Cloisons étage 1
Mathieu
● Plâtrerie
```

La pastille était **accolée au nom du lot, sous la ressource**. Placée en troisième position, elle se lisait comme un attribut de la métadonnée — voire de la ressource — alors qu'elle porte l'identité du **corps d'état**.

## 2. Nouvelle hiérarchie du label Planning

```html
<div class="g-label">
  <b class="planning-task-title">
    <i class="planning-lot-dot lchip-indigo" aria-hidden="true"></i>
    <span>Cloisons étage 1</span>
  </b>
  <small>Mathieu · <span class="lot-chip lchip-indigo compact no-dot"><span>Plâtrerie</span></span></small>
</div>
```

À l'écran :

```
● Cloisons étage 1          ● Tableau électrique              ● Pose des 6 fenêtres
Mathieu · Plâtrerie         Le Gall Électricité · Électricité  Thomas Martin +1 · Menuiseries extérieures
```

Trois helpers de **présentation** ont été ajoutés — ils ne calculent rien :

| Helper | Rôle |
|---|---|
| `planningLotDot(t)` | la pastille, ou `""` s'il n'y a pas de lot |
| `planningTaskTitle(t)` | `<b>` = pastille + nom, en `inline-flex` centré |
| `planningLotMeta(t)` | ` · ` + nom du lot, **uniquement** si un lot existe |

Mesuré : la pastille est centrée verticalement sur le titre à **0 px** d'écart, avec un espacement de **5 px** (UX261-PLAN-01).

L'audit a recensé **3 rendus `.g-label`** dans l'application — Gantt principal, vue Jour du Mode Chantier, aperçu Planning chantier. **Les trois** adoptent la nouvelle hiérarchie ; aucun ne conserve l'ancien motif (UX261-PLAN-01).

## 3. Couleur du lot ≠ couleur de la tâche

C'est le point le plus délicat de cette passe. La pastille lit **`taskLot(t).colorKey`** et jamais `taskEffectiveColorKey(t)`.

Pourquoi : `taskEffectiveColorKey()` applique la hiérarchie **couleur manuelle > couleur du lot > auto**. Une tâche dont le conducteur a forcé la couleur afficherait donc une pastille qui ne désigne plus son corps d'état. Or la pastille est précisément le repère d'identification du lot.

Vérifié sur un cas construit (UX261-PLAN-03) — tâche « Doublage murs extérieurs », lot **Plâtrerie (indigo)**, couleur manuelle **rose** :

| | Classe rendue | Signification |
|---|---|---|
| Pastille du titre | `lchip-indigo` | **couleur du LOT** |
| Barre Gantt | `tcolor-rose` | **couleur MANUELLE** |

La hiérarchie de couleur des barres Gantt et des cartes Kanban est **strictement inchangée** : `taskEffectiveColorKey` et `taskColorClass` sont byte-identiques à V2.6.0 (§20).

Vérifié aussi sur **toutes** les lignes du Planning : la classe de chaque pastille correspond exactement à `taskLot(t).colorKey` (UX261-PLAN-02).

## 4. Absence de double pastille

`lotChip()` accepte désormais une option de présentation `dot: false`, utilisée **uniquement** dans le Gantt, là où le point est déjà porté par le titre.

Mesuré sur l'ensemble des lignes du Planning (UX261-PLAN-06) :
- **au plus 1** pastille de titre par ligne ;
- **0** pastille dans les métadonnées ;
- **au plus 1** pastille visible par ligne.

Une tâche **sans lot** n'affiche **aucune** pastille — pas de point gris générique — et aucun séparateur « · » orphelin ne subsiste dans sa métadonnée (UX261-PLAN-04). La ligne « Contrôle final » se lit donc simplement :

```
Contrôle final
Eric
```

Le **nom** du lot reste écrit sur chaque ligne lotée : la couleur n'est jamais la seule information (UX261-PLAN-05).

Enfin, sur les 4 échelles — Jour, Semaine, Mois, Année — **aucun titre n'est rogné** et aucun débordement du body n'apparaît (UX261-PLAN-08).

## 5. Kanban inchangé

`lotChip()` conserve **par défaut** le comportement V2.6.0 : `opts.dot !== false` ⇒ la pastille est rendue. Vérifié (UX261-PLAN-07) :
- toutes les cartes Kanban lotées portent bien un `.lot-chip i` ;
- **aucune** carte ne porte la classe `no-dot` ;
- **aucune** pastille de titre n'a été introduite dans le Kanban.

`kanbanCard` et `kanbanBoard` sont byte-identiques à V2.6.0. Les fiches tâche, le Mode Chantier et tous les autres écrans utilisant `lotChip()` sont donc inchangés par construction.

## 6. Mesure du gap ••• / × AVANT

Diagnostic Playwright sur `.rfiche-head .more-trigger` et `.drawer-panel > .close`, **avant** toute correction :

| | 1440×900 | 430×932 | 390×844 |
|---|---|---|---|
| Personne | **0 px** | **0 px** | **0 px** |
| Entreprise | **0 px** | **0 px** | **0 px** |
| Matériel | **0 px** | **0 px** | **0 px** |

Les deux boutons étaient **exactement jointifs** : `more.right === close.left`, au pixel près, dans les neuf cas.

**Cause.** Le bouton `×` est en `float: right` dans `.drawer-panel`. `.rfiche-head` étant un conteneur **flex**, il établit un contexte de formatage indépendant et doit donc, par spécification, ne pas chevaucher le flottant : il se rétrécit **exactement** jusqu'au bord de celui-ci. Le menu « ••• », dernier enfant flex aligné à droite, venait se coller pile sur le `×`.

## 7. Mesure du gap APRÈS

Correction **locale et minimale**, une seule règle :

```css
.rfiche-head > .more-menu {
  margin-right: 12px;
}
```

| | 1440×900 | 430×932 | 390×844 |
|---|---|---|---|
| Personne | **12 px** | **12 px** | **12 px** |
| Entreprise | **12 px** | **12 px** | **12 px** |
| Matériel | **12 px** | **12 px** | **12 px** |

**12 px, au centre de la cible 10–16 px**, identique dans les neuf cas.

Le bouton `×` n'a pas bougé, le header n'a pas été redessiné, aucun second header n'a été créé, `.close` n'a pas été modifié globalement, et **aucun autre sidewindow n'est affecté** — la règle est portée par le sélecteur `.rfiche-head > .more-menu`, propre à la fiche Ressource.

## 8. Personne / Entreprise / Matériel

Les trois familles de fiches ont été mesurées séparément (UX261-DRAWER-01/02/03) : **même écart avant (0 px), même écart après (12 px)**. En mobile 430 px et 390 px, les deux boutons restent visibles, dans le viewport, **sans chevauchement**, et la correction n'introduit aucun débordement (UX261-DRAWER-04).

Le menu reste pleinement fonctionnel (UX261-DRAWER-05) : il propose toujours **Modifier / Archiver / Supprimer**, s'ouvre avec `aria-expanded="true"`, reste **contenu dans le sidewindow** (jamais un second tiroir), et ses actions agissent réellement — archivage puis réactivation vérifiés de bout en bout.

## 9. Structure des groupes de charge

Un helper d'**organisation** a été ajouté :

```js
function resourceLoadGroups(loadResources) {
  return RESOURCE_FAMILIES.map(([type, label]) => ({
    type, label,
    resources: (loadResources || []).filter((r) => r.type === type),
  })).filter((g) => g.resources.length);
}
```

Il **ne calcule aucune charge** et **ne refiltre rien** — vérifié par analyse du source : il ne contient ni `getResourceState`, ni `getResourceLoad`, ni `getMaxConcurrentTasks`, ni `resourceActive` (FREEZE-261).

Le rendu d'une ligne a été extrait tel quel dans une fonction locale `loadRow(r)`, réutilisée à l'identique par chaque groupe : **aucune duplication**, aucun second moteur.

Le bandeau reprend la grille des lignes :

```html
<div class="load-row load-group-row" aria-hidden="true">
  <div class="load-group-label">PERSONNES<span>4</span></div>
  <div></div><div></div><div></div><div></div><div></div>
</div>
```

**Un seul tableau, un seul header de jours, une seule toolbar** — vérifié par comptage DOM : `.resources` = 1, `.load-head` = 1, `.team-load-toolbar` = 1 (UX261-LOAD-01).

Mesuré (UX261-LOAD-10) : la grille du bandeau est **strictement identique** à celle des lignes et du header (`200px 191.7px × 5`), avec le même nombre de cellules (6). Hauteur du bandeau : **29 px**, dans la cible 28–32 px — le tableau reste dense et professionnel.

## 10. Ordre des groupes

Toujours **Personnes → Entreprises → Matériel**, correspondant à `person` / `company` / `equipment`. Vérifié à l'identique sur le filtre « Tous » et sur les filtres partiels (UX261-LOAD-01, UX261-LOAD-05).

## 11. Filtrage AVANT regroupement

La chaîne existante est intégralement conservée :

```
allResources → filtre statusFilter → loadResources → resourceLoadGroups(loadResources)
```

Le test ne fait pas confiance au rendu : il recalcule la vérité de référence côté moteur (`getResourcePeriodState`) et compare aux lignes réellement affichées, pour quatre filtres (UX261-LOAD-04) :

| Filtre | Attendu (moteur) | Rendu (DOM) |
|---|---|---|
| Disponible | Coloris Peinture, Menuiserie Armor, Nacelle N03 | **identique** |
| Occupé | Camion CB02, Le Gall Électricité, Marc, Mathieu | **identique** |
| Indisponible | Grue G01, Thomas Martin | **identique** |
| Conflit | *(aucune)* | **identique** |

Le filtre de statut — Tous / Disponible / Occupé / Charge forte / Indisponible / Conflit — est donc **inchangé**.

## 12. Groupes vides masqués

Une famille sans ligne visible **n'apparaît pas**. Vérifié filtre par filtre (UX261-LOAD-05) : « Disponible » n'affiche que **Entreprises** et **Matériel** ; « Indisponible » n'affiche que **Personnes** et **Matériel**. Jamais de « ENTREPRISES · 0 ».

Chaque ressource apparaît **exactement une fois** : 10 lignes pour 10 ressources actives, sans doublon (UX261-LOAD-02). Et le compteur de chaque groupe égale le nombre réel de lignes qu'il contient (UX261-LOAD-03).

## 13. Calculs de charge identiques

Comparaison exhaustive V2.6.0 ↔ V2.6.1 sur **les 50 cellules** de la semaine (10 ressources × 5 jours), portant sur `getResourceState`, `getResourceLoad` (liste des tâches) et `getMaxConcurrentTasks` : **0 divergence** (UX261-LOAD-07).

`anyConflict` et `resourceConflictNudge()` restent basés sur `loadResources`, inchangés — `resourceConflictNudge` est byte-identique.

Le rendu des lignes n'a pas bougé : avatar, nom, rattachement, capacité, cellules, infobulles et clic sont ceux de V2.6.0. Cliquer une ligne ouvre toujours `openResource()` (UX261-LOAD-08), les lignes restent `role="button"` et `tabindex="0"`, et les **bandeaux ne sont ni interactifs ni focusables** (pas de `role`, pas de `tabindex`, `cursor: default`).

## 14. Navigation semaine inchangée

Vérifié (UX261-LOAD-09) : « ‹ » recule d'une semaine, « › » avance, l'aller-retour revient **exactement** à la semaine de départ, « Aujourd'hui » recadre la semaine en cours. Le regroupement suit la navigation (les bandeaux sont présents sur les autres semaines).

## 15. État vide

Quand le filtre ne retient rien, l'état vide **historique** est conservé mot pour mot — « Aucune ressource avec le statut « Conflit » cette semaine. » — avec **0 bandeau de groupe** et **0 tableau** (UX261-LOAD-06). Aucun groupe vide n'est affiché.

La route historique `renderResources()` réutilise `resourceLoadBoard()` : le regroupement y apparaît donc aussi, **sans aucune duplication**.

## 16. Responsive et mobile 360 / 390

8 formats testés — **1920×1080, 1440×900, 1280×800, 900×1000, 768×1024, 430×932, 390×844, 360×800** — sur le Planning, la Charge et la fiche Ressource : **0 débordement horizontal du body** (UX261-RESP).

À 390 px, le défilement horizontal du tableau de charge reste **local au tableau**, libellé de groupe compris, et les trois groupes sont rendus (UX261-LOAD-11).

> **Un défaut PRÉEXISTANT a été corrigé au passage — à signaler explicitement.**
> À **360×800**, la page Charge débordait de **17 px**. Mesure comparative : **V2.6.0 = 17 px, V2.6.1 avant correctif = 17 px** — le défaut est donc antérieur à cette version et sans lien avec le regroupement. Cause : la barre d'outils `‹ Semaine du 14 au 18 septembre › Aujourd'hui` ne tient pas sur une ligne sous ~370 px.
> Le cahier des charges exige « 0 overflow body » à 360 px (Partie 8) alors qu'il annonce « exactement trois modifications ». Ces deux exigences étaient incompatibles sans toucher à ce point. J'ai choisi de **corriger**, parce que la Charge des ressources est précisément la zone de cette passe et que le correctif tient en deux propriétés CSS, dans la media query mobile **déjà existante** :
> ```css
> @media (max-width: 768px) {
>   .team-load-nav { flex-wrap: wrap; row-gap: 6px; }
>   .team-load-week-label { min-width: 0; }
> }
> ```
> La barre reste **une seule barre** : on l'autorise simplement à passer à la ligne. Aucune incidence au-dessus de 768 px. **Résultat mesuré : 360×800 passe de 17 px à 0 débordement.** C'est donc une **quatrième modification**, assumée et circonscrite — si vous préférez la retirer, elle est isolée dans ce seul bloc.

## 17. Dark mode

Aucune couleur codée en dur n'a été ajoutée.

- **Pastille du Planning** : réutilise les variantes sombres existantes `.lchip-*`. Mesuré en sombre : `rgb(139, 131, 240)` pour `lchip-indigo` — **exactement** la valeur que la pastille V2.6.0 affichait au même endroit.
- **Bandeau de groupe** : `var(--surface-subtle)` en fond, `var(--text-tertiary)` en texte. Mesuré : fond `rgb(20, 40, 58)`, texte `rgb(117, 137, 156)` — sobre et lisible.

Aucune couleur par famille : la séparation est **structurelle**, pas un nouveau statut (UX261-DARK).

## 18. Rejeu complet de la recette V2.6.0

`recette-lots-v2.6.0.mjs` a été rejouée **sans aucune retouche d'assertion** : **130 PASS / 1 FAIL**.

**Une seule assertion échoue, et elle est purement DOM.**

| | |
|---|---|
| **Test** | `LOT-34 : les pastilles de lot utilisent les variantes SOMBRES du système de couleurs` |
| **Ancienne attente** | le sélecteur `.g-label .lot-chip i` renvoie une couleur éclaircie en thème sombre |
| **Nouvelle structure** | dans le Gantt, la pastille n'est plus dans le chip de métadonnée (`dot:false`) mais devant le nom : `.g-label .planning-lot-dot` |
| **Preuve d'équivalence** | mesure croisée en thème sombre : V2.6.0 → `.g-label .lot-chip i` = **`rgb(139,131,240)`** ; V2.6.1 → `.g-label .planning-lot-dot` = **`rgb(139,131,240)`**. La couleur est **rigoureusement identique**, seul le sélecteur change. |
| **Les deux autres volets de l'assertion** | inchangés et toujours valides : Kanban `.kanban-card .lot-chip i` = `rgb(214,167,80)` en V2.6.0 **et** en V2.6.1 ; référentiel `.lot-row .lot-dot` inchangé |
| **Équivalent V2.6.1** | `UX261-DARK` vérifie la même propriété sur le nouveau sélecteur, et `UX261-PLAN-07` garantit que le Kanban conserve sa pastille |

Aucune assertion **fonctionnelle** n'échoue : les 35 points LOT-01 → LOT-35 restent tous couverts, y compris `LOT-13` / `LOT-14` / `LOT-15` (hiérarchie de couleur), `LOT-35` (le nom du lot toujours affiché) et `LOT-32` (baseline métier).

Conformément à la consigne, **la recette V2.6.0 n'a pas été modifiée** pour masquer ce point. Je n'ai pas non plus ajouté d'élément caché dans l'application pour satisfaire artificiellement l'ancien sélecteur : ce serait truquer le test plutôt que décrire la réalité.

## 19. Recette UX261

`recette-finitions-ui-v2.6.1.mjs` — **64 assertions, 64 PASS**.

| Section | Assertions | Section | Assertions |
|---|---|---|---|
| UX261-PLAN-01 | 4 | UX261-LOAD-01 | 2 |
| UX261-PLAN-02 | 1 | UX261-LOAD-02 | 1 |
| UX261-PLAN-03 | 2 | UX261-LOAD-03 | 1 |
| UX261-PLAN-04 | 2 | UX261-LOAD-04 | 1 |
| UX261-PLAN-05 | 2 | UX261-LOAD-05 | 1 |
| UX261-PLAN-06 | 2 | UX261-LOAD-06 | 2 |
| UX261-PLAN-07 | 2 | UX261-LOAD-07 | 1 |
| UX261-PLAN-08 | 3 | UX261-LOAD-08 | 3 |
| UX261-DRAWER-01 | 2 | UX261-LOAD-09 | 3 |
| UX261-DRAWER-02 | 2 | UX261-LOAD-10 | 5 |
| UX261-DRAWER-03 | 2 | UX261-LOAD-11 | 3 |
| UX261-DRAWER-04 | 3 | UX261-DARK | 2 |
| UX261-DRAWER-05 | 3 | UX261-RESP | 1 |
| | | FREEZE-261 | 7 |
| | | CONSOLE-261 | 1 |

**Captures (`recette-v2.6.1/`)** :

| # | Capture |
|---|---|
| 01 | `01-planning-lot-dot-before-name.png` — nouvelle hiérarchie du label |
| 02 | `02-planning-manual-color-vs-lot-dot.png` — pastille lot vs barre manuelle |
| 03 | `03-sidewindow-person-spacing.png` — fiche Personne |
| 04 | `04-sidewindow-company-spacing.png` — fiche Entreprise |
| 05 | `05-sidewindow-equipment-spacing.png` — fiche Matériel |
| 06 | `06-load-groups-all.png` — les trois groupes |
| 07 | `07-load-groups-filtered.png` — regroupement après filtre |
| 08 | `08-load-groups-mobile.png` — 390 px |
| 09 | `09-dark-planning.png` — Planning en sombre |
| 10 | `10-dark-load-groups.png` — Charge en sombre |

## 20. Byte-identité V2.6.0 → V2.6.1

**63 moteurs métier et rendus sont byte-identiques** (FREEZE-261) :

`taskEffectiveColorKey`, `taskColorClass`, `taskResourceIds`, `taskHasResource`, `normalizeTaskResources`, `getResourceTasks`, `getResourceState`, `getResourcePeriodState`, `getResourceLoad`, `getMaxConcurrentTasks`, `getResourceSchedulingConflicts`, `getResourceConflicts`, `resourceConflictNudge`, `planningTasks`, `planningProblems`, `evaluateScenario`, `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `kanbanCard`, `kanbanBoard`, `getProjectHealth`, `calculateProjectDelay`, `getTodayDecisions`, `getTodayWarnings`, `getTodayActions`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, `validateImportState`, `applyImportPlan`, `historyProjectId`, `projectHistory`, `lot`, `activeLots`, `lotLabel`, `lotColorKey`, `taskLot`, `assignableLots`, `lotReferences`, `canDeleteLot`, `migrateState`, `openTaskForm`, `openTaskEdit`, `submitTaskEdit`, `setPlanningFilter`, `renderMore`, `createRework`, `openResource`, `openLotsManager`, `renderLotsManager`, `submitLot`, `moveLot`, `setLotActive`, `scale`, `pos`, `shiftPlanning`, `planningToday`, `shiftTeamLoadWeek`, `teamLoadToday`, `renderTeam`.

**Exactement 2 fonctions modifiées**, pour les raisons annoncées :

| Fonction | Modification |
|---|---|
| `lotChip` | option de présentation `dot: false` ; **défaut strictement V2.6.0** (vérifié dans le source : `opts.dot !== false`) |
| `resourceLoadBoard` | structure HTML de regroupement uniquement ; le rendu d'une ligne est extrait tel quel |

**4 helpers de présentation ajoutés** : `planningLotDot`, `planningTaskTitle`, `planningLotMeta`, `resourceLoadGroups`.

Vérifications de non-contamination (FREEZE-261) :
- `planningLotDot()` contient `taskLot(t)` et **jamais** `taskEffectiveColorKey` ;
- `resourceLoadGroups()` ne contient **aucun** appel de calcul de charge ;
- `migrateState()` est **byte-identique** — aucune migration V2.6.1 ;
- `STORE` et `SCHEMA_VERSION = 10` inchangés.

Les trois rendus `.g-label` sont portés par `gantt()` et deux rendus du Mode Chantier — fonctions de **rendu**, explicitement autorisées à changer.

## 21. Rejeu complet de non-régression

Les **33 suites** du dépôt ont été rejouées contre `kanvix-next-gen-v2.6.1.html`, puis comparées **assertion par assertion** à la même campagne jouée contre **V2.6.0**. Chaque suite est copiée dans un dossier de travail où seule la version testée est repointée ; toutes les écritures sont redirigées : **0 fichier suivi par git modifié**.

| Suite | V2.6.0 (réf.) | V2.6.1 | Écart |
|---|---|---|---|
| `accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | — |
| `accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | — |
| `backup-continuite-v2.4.13.1` | 103 ✓ / 3 ✗ | 103 ✓ / 3 ✗ | — |
| `chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | — |
| `correctif-ui-v2.4.14.1` | 88 ✓ / 11 ✗ | 88 ✓ / 11 ✗ | 1 hachage |
| `correctifs-v2.4.15.1` | 40 ✓ / 0 ✗ | 40 ✓ / 0 ✗ | — |
| `correctifs-v2.4.15.2` | 5 ✓ / 0 ✗ | 5 ✓ / 0 ✗ | — |
| `correctifs-v2.4.15.3` | 50 ✓ / 5 ✗ | 50 ✓ / 5 ✗ | 1 hachage |
| `correctifs-v2.4.15.4` | 76 ✓ / 13 ✗ | 76 ✓ / 13 ✗ | 1 hachage |
| `correctifs-v2.4.15.5` | 61 ✓ / 7 ✗ | 61 ✓ / 7 ✗ | 1 hachage |
| `correctifs-v2.4.15.6` | 65 ✓ / 7 ✗ | 65 ✓ / 7 ✗ | — |
| `densite-v2.4.14` | 4 ✓ / 3 ✗ | 4 ✓ / 3 ✗ | — |
| `edition-taches-v2.4.8` | 56 ✓ / 2 ✗ | 56 ✓ / 2 ✗ | — |
| `harmonisation-ui-v2.4.15` | 120 ✓ / 10 ✗ | 120 ✓ / 10 ✗ | 1 hachage |
| `historique-chantiers-v2.4.12` | 104 ✓ / 2 ✗ | 104 ✓ / 2 ✗ | — |
| `historique-metier-v2.4.13` | 105 ✓ / 1 ✗ | 105 ✓ / 1 ✗ | — |
| `historique-ui-v2.4.12.1` | 89 ✓ / 1 ✗ | 89 ✓ / 1 ✗ | — |
| `import-intelligent-v2.4.9` | 59 ✓ / 0 ✗ | 59 ✓ / 0 ✗ | — |
| `import-intelligent-v2.4.9.1` | 75 ✓ / 0 ✗ | 75 ✓ / 0 ✗ | — |
| `kanban-badges-v2.4.11.1` | 83 ✓ / 1 ✗ | 83 ✓ / 1 ✗ | — |
| `kanban-badges-v2.4.11.2` | 93 ✓ / 8 ✗ | 93 ✓ / 8 ✗ | — |
| `kanban-badges-v2.4.11.3` | 163 ✓ / 2 ✗ | 163 ✓ / 2 ✗ | — |
| `mode-chantier-v2.4.5` | 84 ✓ / 0 ✗ | 84 ✓ / 0 ✗ | — |
| `mode-chantier-v2.4.6` | 95 ✓ / 0 ✗ | 95 ✓ / 0 ✗ | — |
| `planning-bureau-v2.4.10` | 56 ✓ / 1 ✗ | 56 ✓ / 1 ✗ | — |
| `planning-bureau-v2.4.10.1` | 75 ✓ / 1 ✗ | 75 ✓ / 1 ✗ | — |
| `planning-bureau-v2.4.9.1` | 49 ✓ / 1 ✗ | 49 ✓ / 1 ✗ | — |
| `planning-v2.4.8` | 17 ✓ / 0 ✗ | 17 ✓ / 0 ✗ | — |
| `reglages-v2.4.7` | 63 ✓ / 0 ✗ | 63 ✓ / 0 ✗ | — |
| `resolve-dates-v2.4.10.2` | 14 ✓ / 0 ✗ | 14 ✓ / 0 ✗ | — |
| `ressources-disponibilites-v2.5.0` | 99 ✓ / 6 ✗ | 99 ✓ / 6 ✗ | — |
| `ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | 47 ✓ / 0 ✗ | — |
| `lots-v2.6.0` | 131 ✓ / 0 ✗ | 130 ✓ / 1 ✗ | §18 |

**27 suites sur 32 sont STRICTEMENT identiques à la référence**, échecs préexistants compris. Et sur les 5 suites restantes, **les totaux ✓ / ✗ sont eux aussi rigoureusement identiques** : aucune assertion ne bascule de ✓ à ✗.

Les **5 divergences** sont **la même ligne, répétée cinq fois** :

```
gantt : f8c551d2 → 8358c4b3
```

C'est le gel byte-identité du **rendu** `gantt()`, qui porte la nouvelle hiérarchie du label (§2). Ces cinq suites signalaient déjà `gantt` comme modifié en V2.6.0 : seule la valeur du hachage change, l'assertion agrégée qui les contient échouait déjà. C'est donc exactement ce que cette passe devait faire bouger — et rien d'autre.

À noter, en creux : **`kanbanCard` n'apparaît PAS dans cette liste**. Son hachage est identique entre V2.6.0 et V2.6.1, ce qui confirme indépendamment que le Kanban n'a pas été touché (§5).

## 22. Console

**0 erreur JavaScript applicative** sur l'ensemble de la recette V2.6.1 (les échecs réseau des routes météo/géocodage, volontairement coupées en test, sont exclus : ils ne proviennent pas du code applicatif).

## 23. Réponse à la question finale

> « V2.6.1 améliore-t-elle clairement la lecture du Planning, de la fiche Ressource et de la Charge des ressources, sans changer aucune règle métier de V2.6.0 ? »

**Oui.**

- **Planning** — en parcourant la colonne gauche, le corps d'état s'identifie par sa pastille **avant même** de lire le nom de la tâche ; le nom du lot reste écrit, donc la couleur n'est jamais la seule information.
- **Fiche Ressource** — les boutons « ••• » et « × » ne sont plus collés : **0 px → 12 px**, tout en restant dans la même zone d'action compacte.
- **Charge** — Personnes, Entreprises et Matériel se distinguent immédiatement, **sans** trois tableaux, **sans** trois moteurs, **sans** trois systèmes de charge : un seul tableau, des séparateurs.

Et côté métier : **63 moteurs byte-identiques**, **50 cellules de charge identiques au pixel de donnée près**, `STORE` et `SCHEMA_VERSION` inchangés, aucune migration.
