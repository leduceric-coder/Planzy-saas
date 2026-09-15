# Kanvix V2.6.0 — Lots / corps d'état : référentiel entreprise, tâches, couleurs, Planning, modèles

Source de vérité : `kanvix-next-gen-v2.5.0.html`
Version livrée : `kanvix-next-gen-v2.6.0.html`
Suite de recette : `recette-lots-v2.6.0.mjs` — **131 assertions, 131 PASS, 0 FAIL, 0 erreur console**
Captures : `recette-v2.6.0/` (13 captures nommées)

> **Document de cadrage** — `KANVIX_recommandations_plan_developpement_IA(1).md` n'était présent ni dans le dépôt ni en pièce jointe de la demande. Il n'a donc pas pu être lu, et **aucune de ses recommandations n'a été devinée**. Le cahier des charges V2.6 étant lui-même complet et prescriptif, il a servi de référence unique, et le HTML V2.5.0 de source de vérité technique. Les deux points du cadrage explicitement cités dans la demande — **validation terrain 360/390 px** (§30) et **progressive disclosure** (§9, §19) — ont été traités. Si le document contient d'autres exigences, elles restent à arbitrer : **aucune contradiction avec l'existant n'a été rencontrée**, puisqu'aucune décision n'a été prise à partir de lui.

---

## 1. Audit préalable — PHASE ≠ LOT ≠ TÂCHE

Avant toute ligne de code, tous les usages de `project.phase` et `task.phase` ont été relevés. Deux constats ont guidé l'implémentation.

**Constat n° 1 — `task.phase` est une donnée DORMANTE.** Elle est stockée sur les 11 tâches de démonstration et transportée par le moteur d'import (`it.phase → t.phase`), mais **elle n'est lue par aucun rendu**. Toutes les lectures d'affichage portent sur `project.phase` : sous-titre des cartes chantier, ligne « Chantiers actifs » de l'Accueil, formulaire chantier, wizard, modèle d'entreprise, diff d'import.

**Constat n° 2 — la donnée existante prouve la confusion que V2.6 vient lever.** Les tâches de démonstration portent des `phase` de deux natures différentes :

| Tâche | `phase` | Nature réelle |
|---|---|---|
| Cloisons étage 1 | « Second œuvre » | **étape de projet** |
| Contrôle dalle RDC | « Gros œuvre » | **étape de projet** |
| Peinture étage 1 | « Finitions » | **étape de projet** |
| **Tableau électrique** | **« Électricité »** | **corps d'état** |
| **Appareillage électrique** | **« Électricité »** | **corps d'état** |

Un seul champ servait donc déjà à exprimer deux axes distincts. C'est exactement ce que la règle sémantique de V2.6 interdit.

**Décision.** Le champ n'a été ni renommé, ni converti, ni nettoyé : `task.phase` et `project.phase` sont **conservés à l'identique**, valeurs comprises. V2.6 ajoute `task.lotId` comme **relation explicite et séparée**. Les deux axes coexistent, et la recette le démontre : une même PHASE (« Second œuvre ») porte désormais des lots DIFFÉRENTS (Plâtrerie, Menuiseries extérieures) — preuve que ce sont bien deux dimensions orthogonales (LOT-02).

## 2. Modèle `app.lots`

```js
{
  id: "lot-electricite",
  name: "Électricité",
  colorKey: "violet",
  defaultTrade: "Électricien",   // facultatif, purement informatif
  order: 70,
  active: true,
  createdAt: "2026-08-13T09:00"
}
```

`defaultTrade` **n'affecte rien** : aucune ressource n'est assignée automatiquement, `resourceId` n'est jamais touché, aucune entreprise n'est créée. Le champ prépare un futur modèle métier, rien de plus — et le formulaire le dit (« Facultatif — information seule : aucune ressource n'est affectée automatiquement »).

Pas de bibliothèque d'icônes : **la couleur et le nom suffisent** pour cette première version.

## 3. Référentiel de départ — un point de départ, pas une constante

9 lots, avec des identifiants stables (`lot-terrassement`, `lot-maconnerie`, `lot-charpente`, `lot-couverture`, `lot-menuiseries-ext`, `lot-platrerie`, `lot-electricite`, `lot-plomberie`, `lot-peinture`), chacun avec sa couleur distincte et son métier indicatif (LOT-03).

La stabilité des ID n'est pas cosmétique : les futurs contrôles qualité devront pouvoir référencer un lot, ce qui suppose des identifiants explicites et durables (§21 du cahier des charges).

## 4. Configurabilité — aucune logique ne dépend d'un nom

Les lots sont **renommables, recolorables, réordonnables, désactivables, extensibles et supprimables**. La recette vérifie par analyse du source qu'**aucune comparaison métier ne teste un nom de lot** (`=== "Électricité"`, `lot.name ===`…) : seuls les ID comptent (LOT-03).

## 5. `task.lotId`

`string | null`. Une tâche sans lot fonctionne **partout** : elle n'a pas de marqueur, retrouve exactement le comportement de couleur historique, est filtrable via « Sans lot », et aucune fonction n'exige qu'elle porte un lot (LOT-12). La tâche de démonstration « Contrôle final » est volontairement laissée **sans lot** pour que ce cas soit visible en permanence.

## 6. Migration 9 → 10

`SCHEMA_VERSION` passe de **9 à 10**. `STORE` reste **`"kanvix-product-8-3"`** (LOT-01).

La migration est **mesurée, pas déclarée** : la recette ouvre V2.5.0, y écrit une donnée témoin, relit son `localStorage` brut, l'injecte dans V2.6.0 et recharge (LOT-02).

| | Avant (schéma 9) | Après (schéma 10) |
|---|---|---|
| chantiers / tâches / ressources | 4 / 11 / 7 | **identiques** |
| historique / messages / photos | identiques | **identiques** |
| indisponibilités (V2.5) | 2 | **2** |
| statuts, dates de début et de fin | — | **strictement inchangés** |
| donnée témoin `TRACE-V9` | présente | **présente** |
| `app.lots` | absent | référentiel de départ |
| `task.lotId` | absent | **`null` partout** |
| `app.ui.planningLot` | absent | `"all"` |

## 7. Absence d'inférence — la règle la plus importante de la migration

Le lot n'est **jamais** deviné depuis `task.phase`, `task.name`, `resource.jobTitle` ou `companyName`.

C'est un choix assumé : les tâches de démonstration portant `phase: "Électricité"` seraient les premières candidates à une inférence naïve. Une association métier fausse serait bien pire qu'une absence d'information — un conducteur qui filtre par corps d'état doit pouvoir faire confiance au résultat. Toutes les tâches migrées restent donc à `lotId = null`, et la recette l'exige explicitement (LOT-02).

## 8. `taskEffectiveColorKey()` — une seule vérité de couleur

```js
function taskEffectiveColorKey(t) {
  if (t?.colorKey && t.colorKey !== "auto") return t.colorKey;  // 1. manuelle
  let l = lot(t?.lotId);
  if (l?.colorKey) return l.colorKey;                            // 2. lot
  return "auto";                                                 // 3. historique
}
```

Le point clé : `taskColorClass()` — l'**unique** fonction qui transforme une couleur en classe CSS, déjà consommée par le Gantt **et** par le Kanban — lit désormais `taskEffectiveColorKey(t)` au lieu de `t.colorKey`. **Une ligne changée** suffit donc à donner sa couleur au lot dans les deux vues, sans second calcul (LOT-13, FREEZE-260).

Un lot **désactivé** garde sa couleur et son nom : `taskEffectiveColorKey()` n'exige pas `lot.active === true`, sinon l'historique d'un chantier deviendrait illisible le jour où un corps d'état sort du catalogue (LOT-07).

## 9. Priorité de la couleur manuelle

| Lot | `task.colorKey` | Affiché |
|---|---|---|
| Électricité = amber | `auto` | **amber** (LOT-13) |
| Électricité = amber | `violet` | **violet** (LOT-14) |
| Électricité amber **→ blue** | `auto` | **blue immédiatement** (LOT-15) |
| Électricité amber **→ blue** | `violet` | **violet, inchangé** (LOT-15) |

La couleur du lot n'est **jamais écrite physiquement dans la tâche** : `task.colorKey` reste `"auto"` après un changement de couleur de lot (LOT-15). C'est ce qui rend la propagation instantanée et réversible.

**Les états métier restent prioritaires.** Sur une tâche en retard, en attente ou terminée, `taskColorClass()` rend une chaîne vide : la couleur de lot s'efface devant l'état. Le lot est une **identité**, pas une gravité (LOT-13).

## 10. CRUD du référentiel

Le bloc **RÉFÉRENTIEL MÉTIER** vit dans **Réglages** — délibérément **pas** dans la barre latérale, qui reste courte. Il annonce « Lots / corps d'état · 9 actifs » (LOT-04).

Gérer les lots est une **action de configuration**, donc un **SIDEWINDOW**, conformément à la grammaire Kanvix (pop-up = consultation rapide, sidewindow = action). La recette vérifie que le tiroir s'ouvre et qu'aucune modale ne s'ouvre (LOT-04).

Une **seule** sidewindow, deux vues internes (liste / formulaire) : on n'empile jamais deux tiroirs. Le formulaire tient en trois champs — Nom, Couleur, Métier indicatif (LOT-04).

**Ordre** : boutons « ↑ / ↓ » accessibles au clavier et étiquetés, jamais un glisser-déposer. Après chaque déplacement les valeurs `order` sont **renormalisées** (10, 20, 30…) et persistées ; un aller-retour ↑ puis ↓ ramène exactement à l'ordre initial (LOT-06).

**Unicité** : deux lots actifs ne peuvent pas porter le même nom après normalisation de la casse et des espaces. « ` ÉLECTRICITÉ ` » est refusé avec un message simple : « Un lot portant ce nom existe déjà. » (LOT-05).

## 11. Désactivation et suppression

**Désactiver** ne change **aucune** tâche : `lotId`, couleur historique et planning restent identiques. Le lot disparaît des nouvelles sélections mais reste **nommé et coloré** partout où il est déjà utilisé (LOT-07).

**Supprimer** n'est possible qu'avec **0 tâche et 0 étape de modèle** — `lotReferences()` compte les deux (LOT-09). Un lot utilisé ne propose pas de suppression : il propose la désactivation, en nommant le nombre d'usages.

**Réactiver** est disponible dans une vue « lots inactifs » repliée, discrète.

## 12. Création de tâche

Le champ **Lot / corps d'état** se place juste après le chantier et **avant** l'intervenant principal — vérifié par l'ordre réel des champs du formulaire (LOT-10). La logique cible reste lisible :

> Nom · **Lot / corps d'état** · Intervenant principal · Ressources complémentaires · Quand ? · Après quelle intervention ?

« Sans lot » est **toujours** la première option. Un lot désactivé encore porté par la tâche reste proposé, suffixé **« (inactif) »** (LOT-08, LOT-12).

Une aide contextuelle clarifie « Automatique » : sans lot, « Automatique utilise la couleur du lot lorsqu'un lot est renseigné » ; avec un lot, elle le **nomme** : « Automatique utilise la couleur du lot (Peinture). » (LOT-10).

## 13. Éditeur universel

`openTaskEdit()` propose le même champ, dans la section **Intervention**, avec les mêmes règles — `assignableLots()`, lot désactivé visible, « Sans lot » possible (LOT-08, LOT-11).

## 14. Historique

`taskEditState.before` inclut `lotId`, et le diff passe par le **même** moteur que tous les autres champs :

```
Lot    Menuiseries extérieures → Électricité
Lot    Électricité → Aucun
```

Un changement de lot seul ne produit **qu'une** ligne de diff — aucun bruit (LOT-11). Aucun second historique n'est créé : `app.history` reste l'unique collection.

Les actions de **référentiel** produisent des événements globaux structurés (`lot-created`, `lot-updated`, `lot-disabled`, `lot-enabled`) avec `entityType: "lot"` et `entityId`. Ils n'ont ni `projectId` ni `taskId`, donc `historyProjectId()` renvoie `null` et **ils n'apparaissent jamais dans l'historique d'un chantier** — vérifié (`projectHistory('keravel')` n'en contient aucun). `historyProjectId()` reste byte-identique à V2.5.0.

## 15. Reprise

Une reprise hérite du `lotId` de l'intervention d'origine : une reprise de « Contrôle dalle RDC » (Maçonnerie) appartient au même corps d'état (LOT-22).

## 16. Gantt

La couleur vient de `taskEffectiveColorKey()` via `taskColorClass()`. Le lot apparaît en **métadonnée de 3ᵉ niveau**, sous le nom et l'intervenant : un petit point coloré + le nom (`● Plâtrerie`). Pas de grosse carte colorée, pas de pictogramme.

## 17. Kanban

**Même source de couleur, aucune divergence** : la carte porte la même classe `tcolor-*` que la barre Gantt, calculée par la même fonction (LOT-13, LOT-14). Elle porte le même chip discret.

## 18. Filtre Planning

`app.ui.planningLot` (`"all"` par défaut, ou `"none"`, ou un ID). Le sélecteur affiche « Tous les lots » puis les lots **ordonnés**, et n'ajoute « Sans lot » **que si** au moins une tâche du périmètre n'en porte pas — on ne propose jamais une option qui ne trierait rien (LOT-16, LOT-19).

Les quatre points d'entrée « montrer cette tâche / ce jour » (`focusPlanningTask`, `focusPlanningDependency`, `focusPlanningDay`, `openWeekPlanning`) neutralisent aussi le filtre de lot : sans cela, cliquer « Voir dans le planning » pouvait tomber sur une vue vide.

## 19. Filtres combinés

Les trois filtres se **combinent** dans le seul `planningTasks()`. La recette construit un cas vrai uniquement pour les trois critères réunis (Keravel + Camion CB02 + Menuiseries extérieures → `k-windows`), puis casse **un seul** critère : le résultat se vide (LOT-17).

Gantt et Kanban consomment tous deux `planningTasks()` : même nombre de lignes et de cartes, et l'analyse du source confirme **aucun refiltrage par lot dans le Kanban** (LOT-18).

## 20. Mode Chantier

Aucun redesign. L'intervention ouverte affiche une ligne « **Lot : Menuiseries extérieures** ». La **liste principale terrain n'est pas densifiée** — vérifié : le nom du lot n'apparaît pas dans la liste, seulement dans la fiche ouverte (LOT-23).

## 21. Artisan

Le lot est visible quand il aide à comprendre l'intervention. **Aucune gestion du référentiel** n'est proposée dans l'expérience Artisan (LOT-24).

## 22. Modèles intégrés

`PROJECT_TEMPLATES` porte désormais un `lotId` **explicite** sur chaque étape — jamais dérivé du nom au runtime, et la recette le vérifie dans le source. Créer un chantier depuis un modèle conserve tous les lots, y compris les étapes volontairement sans lot (LOT-20).

Si un lot du modèle a disparu du référentiel, la tâche naît avec `lotId = null` : **aucun ID orphelin** (LOT-20).

## 23. Modèles d'entreprise

`openCompanyTemplateForm()` copie désormais aussi le `lotId` de chaque tâche source (les dates et affectations restent, comme avant, non copiées). Un chantier créé depuis ce modèle conserve les lots (LOT-21). Un modèle ne crée jamais un second lot identique : il **réutilise l'ID existant**.

## 24. Sauvegarde

La sauvegarde transporte `app.lots`, `task.lotId` et `companyTemplates[].tasks[].lotId`. Le roundtrip **backup → reset → restore** est strictement fidèle : le référentiel revient à l'identique (id, nom, couleur, ordre, état), les lots de tâches et d'étapes de modèle aussi (LOT-26). L'aperçu annonce le nombre de lots — une ligne d'information, pas un KPI.

## 25. Sauvegarde V9

`KANVIX_BACKUP_REQUIRED` **n'exige pas** `app.lots`. Une sauvegarde V2.5 (sans lots, sans `task.lotId`) est **acceptée**, puis migrée en schéma 10 : référentiel de départ ajouté, toutes les tâches à `lotId = null` (LOT-27).

## 26. Export portable

L'export contient désormais `lots` : une tâche exportée avec un `lotId` **sans son référentiel serait incomplète**. L'écran d'export annonce le nombre de lots (LOT-28).

## 27. Import — le référentiel se MERGE, il ne s'écrase pas

Un lot est une donnée d'**entreprise**, pas de chantier. Quatre cas, tous testés (LOT-29) :

| Cas | Comportement |
|---|---|
| même ID **et** même nom | le lot **local** est réutilisé |
| ID inconnu, nom déjà présent | le lot **local** est réutilisé (pas de doublon « Électricité ») |
| ID et nom inconnus | le lot est **ajouté** |
| même ID, **autre** nom | collision réelle → **remappage** vers un nouvel ID, et toutes les références suivent |
| `lotId` sans lot correspondant | → `null` |

Une table `lotIdMap` est consultée par **chaque** tâche et **chaque** étape de modèle importée. Résultat vérifié : **0 référence orpheline**, et le lot local `lot-plomberie` (« Plomberie ») n'est jamais écrasé par un entrant homonyme d'ID nommé « Désamiantage ».

Le rapport annonce explicitement « **N lots ajoutés · N lots réutilisés · N lots réidentifiés** », avant **et** après l'import, avec le même formateur — aucune perte silencieuse.

## 28. Remplacer tous les chantiers

`S.lots` n'est **jamais vidé**. Un « remplacer tous les chantiers » supprime le domaine chantier mais **conserve intégralement le référentiel local**, et le complète des lots nécessaires à l'import. Vérifié : les 9 lots locaux survivent, `lot-vrd` est ajouté, la tâche importée le référence correctement, l'état final est valide (LOT-30). La modale de confirmation le dit maintenant explicitement.

## 29. Validation des références

`validateImportState()` contrôle désormais que tout `task.lotId` non nul **et** tout `lotId` d'étape de modèle référencent un lot existant. Un `lotId` inventé fait échouer la validation, dans les deux cas, sans faux positif sur un état sain (LOT-31).

## 30. Responsive

11 formats testés — **1920×1080, 1600×900, 1440×900, 1366×768, 1280×800, 1080×800, 900×1000, 768×1024, 430×932, 390×844, 360×800** — sur le Planning, les Réglages, la sidewindow de référentiel, le formulaire de lot, la création et l'édition de tâche : **0 débordement horizontal du body** (LOT-33). La validation terrain 360/390 px demandée par le cadrage est couverte, captures à l'appui.

## 31. Thème sombre

Toutes les teintes de lot utilisent le **système de variables existant**, y compris ses variantes sombres. Mesuré en dark mode : pastille Gantt `rgb(139,131,240)` (indigo sombre), pastille Kanban `rgb(214,167,80)` (ambre sombre), pastille du référentiel `rgb(147,163,182)` — les trois sont bien les variantes éclaircies, pas les teintes claires (LOT-34).

## 32. Accessibilité

**La couleur ne porte jamais seule l'information.** Le nom du lot est affiché partout — Gantt, Kanban, fiche tâche, Mode Chantier, référentiel. Les pastilles colorées sont `aria-hidden="true"` (décoratives), les boutons « ↑ / ↓ » portent un `aria-label` explicite, et le filtre de lot du Planning est étiqueté (LOT-35).

## 33. Résultats LOT-01 → LOT-35

**131 assertions, 131 PASS**, réparties sur les 35 points demandés, plus le gel byte-identité, les niveaux Essentiel/Pilotage, l'historique du référentiel et la console.

| | | | |
|---|---|---|---|
| LOT-01 schéma · 3 | LOT-02 migration · 9 | LOT-03 référentiel · 4 | LOT-04 CRUD · 16 |
| LOT-05 doublon · 1 | LOT-06 ordre · 4 | LOT-07 désactivation · 3 | LOT-08 historique · 2 |
| LOT-09 suppression · 4 | LOT-10 création · 5 | LOT-11 édition · 3 | LOT-12 sans lot · 5 |
| LOT-13 couleur auto · 4 | LOT-14 surcharge · 2 | LOT-15 recolorisation · 3 | LOT-16 filtre · 3 |
| LOT-17 combinés · 2 | LOT-18 Kanban · 3 | LOT-19 sans lot · 2 | LOT-20 modèle · 5 |
| LOT-21 entreprise · 2 | LOT-22 reprise · 1 | LOT-23 chantier · 5 | LOT-24 artisan · 1 |
| LOT-25 clôturé · 2 | LOT-26 backup · 5 | LOT-27 backup V9 · 3 | LOT-28 export · 2 |
| LOT-29 import · 7 | LOT-30 replace all · 3 | LOT-31 validation · 3 | LOT-32 baseline · 1 |
| LOT-33 responsive · 1 | LOT-34 sombre · 2 | LOT-35 a11y · 4 | FREEZE-260 · 5 |

**LOT-32 — baseline métier.** Neuf familles d'indicateurs ont été comparées entre V2.5.0 et V2.6.0 sur les mêmes données : `getProjectHealth`, `calculateProjectDelay`, `getTodayDecisions`, `getTodayWarnings`, `getTodayActions`, `planningProblems`, conflits de ressources, états de ressources, et l'ensemble statuts/dates des tâches. **Aucune divergence.** Le lot seul ne crée aucun risque.

**Captures (`recette-v2.6.0/`)** :

| # | Capture |
|---|---|
| 01 | `01-reglages-referentiel-lots.png` — bloc Référentiel métier dans Réglages |
| 02 | `02-sidewindow-lots.png` — sidewindow de gestion, liste ordonnée |
| 03 | `03-create-lot.png` — formulaire de création |
| 04 | `04-task-with-lot.png` — création de tâche avec lot |
| 05 | `05-task-edit-lot.png` — éditeur universel |
| 06 | `06-planning-filter-lot.png` — Planning filtré par lot |
| 07 | `07-gantt-lot-colors.png` — Gantt coloré par lot + chips |
| 08 | `08-kanban-lot-colors.png` — Kanban, même source de couleur |
| 09 | `09-company-template-lots.png` — référentiel après modèle d'entreprise |
| 10 | `10-mode-chantier-lot.png` — Mode Chantier, ligne « Lot : … » |
| 11 | `11-mobile-task-lot-390.png` — création de tâche à 390 px |
| 12 | `12-mobile-lots-390.png` — référentiel à 390 px |
| 13 | `13-dark-lots.png` — thème sombre |

## 34. Non-régression V2.5

`recette-ressources-disponibilites-v2.5.0.mjs` a été rejouée **intégralement** contre V2.6.0.

- **Sans aucune adaptation : 96 PASS / 9 FAIL.** Les 9 échecs sont **exclusivement** des assertions de schéma, de version ou de référence de gel — `SCHEMA_VERSION === 9` (×2), état source « schéma 8 » et migration « 8 → 9 » (×3), sauvegarde « schéma 9 / version 2.5.0 » (×2), et les deux assertions de byte-identité dont la référence de comparaison a changé de rôle (×2). **Aucun comportement métier n'échoue.**
- **Après adaptation des seules assertions de schéma : 105 PASS / 0 FAIL.** Les 105 comportements métier de V2.5 — ressources matérielles, affectations multiples, indisponibilités, détection sans décision, sauvegarde, import — restent intégralement fonctionnels.

## 35. Byte-identité hors périmètre

**Les 48 moteurs que le lot ne devait pas modifier sont strictement byte-identiques à V2.5.0** :

`getResourceTasks`, `taskResourceIds`, `taskHasResource`, `normalizeTaskResources`, `getResourceState`, `getResourceSchedulingConflicts`, `getResourceConflicts`, `getMaxConcurrentTasks`, `getResourceLoad`, `getResourcePeriodState`, `planningProblems`, `evaluateScenario`, `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `getProjectHealth`, `calculateProjectDelay`, `getTodayDecisions`, `getTodayWarnings`, `getTodayActions`, `buildKanvixBackup`, `confirmKanvixRestore`, `validateKanvixBackup`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `scale`, `pos`, `shiftPlanning`, `planningToday`, `setPeriod`, `getTaskPredecessors`, `getTaskSuccessors`, `taskCreatesCycle`, `nextWorkingTime`, `workdayDelay`, `getWeekNumber`, `weekBounds`, `getResourceUnavailabilities`, `getResourceUnavailabilitiesInRange`, `resourceIsUnavailable`, `resourceUnavailabilityConflicts`, `submitUnavailability`, `confirmDeleteResource`.

`buildKanvixBackup` est byte-identique parce qu'il clone `app` entièrement : `app.lots` voyage **sans modification du moteur**.

**Les 11 fonctions du périmètre ont bien évolué** — et pourquoi :

| Fonction | Raison |
|---|---|
| `planningTasks` | 3ᵉ filtre (lot), point d'entrée unique |
| `taskColorClass` | lit `taskEffectiveColorKey()` au lieu de `t.colorKey` |
| `openTaskForm` / `openTaskEdit` / `submitTaskEdit` | champ Lot, diff, persistance |
| `setPlanningFilter` | accepte le type « lot » |
| `applyImportPlan` / `validateImportState` | merge du référentiel, contrôle des références |
| `renderMore` | bloc Référentiel métier |
| `migrateState` | migration 9 → 10 |
| `createRework` | héritage du `lotId` |

Les lectures de `t.colorKey` qui subsistent sont des lectures de **formulaire** (la pastille sélectionnée doit refléter la couleur *propre* de la tâche, pas sa couleur effective) : `taskColorClass()` est bien la seule voie d'affichage, et ni la barre Gantt ni la carte Kanban ne lisent `t.colorKey` directement.

## 36. Rejeu complet de non-régression

Pour séparer honnêtement « échec préexistant » et « échec causé par ce round », la même campagne a été rejouée deux fois : une fois contre **V2.5.0** (référence) et une fois contre **V2.6.0**. Chaque suite est copiée dans un dossier de travail où **seule la version qu'elle teste** est repointée — les références à des versions antérieures, utilisées pour les comparaisons de byte-identité, restent intactes. Toutes les écritures absolues (captures **et** `resultats.json`) sont redirigées : **0 fichier suivi par git modifié**.

| Suite | V2.5.0 (réf.) | V2.6.0 | Écart |
|---|---|---|---|
| `accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | — |
| `accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | — |
| `backup-continuite-v2.4.13.1` | 103 ✓ / 3 ✗ | 103 ✓ / 3 ✗ | — |
| `chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | — |
| `correctif-ui-v2.4.14.1` | 88 ✓ / 11 ✗ | 88 ✓ / 11 ✗ | 2 lignes de gel |
| `correctifs-v2.4.15.1` | 40 ✓ / 0 ✗ | 40 ✓ / 0 ✗ | — |
| `correctifs-v2.4.15.2` | 5 ✓ / 0 ✗ | 5 ✓ / 0 ✗ | — |
| `correctifs-v2.4.15.3` | 50 ✓ / 5 ✗ | 50 ✓ / 5 ✗ | 2 lignes de gel |
| `correctifs-v2.4.15.4` | 78 ✓ / 11 ✗ | 76 ✓ / 13 ✗ | 4 lignes de gel |
| `correctifs-v2.4.15.5` | 61 ✓ / 7 ✗ | 61 ✓ / 7 ✗ | 2 lignes de gel |
| `correctifs-v2.4.15.6` | 65 ✓ / 7 ✗ | 65 ✓ / 7 ✗ | 3 lignes de gel |
| `densite-v2.4.14` | 4 ✓ / 3 ✗ | 4 ✓ / 3 ✗ | — |
| `edition-taches-v2.4.8` | 56 ✓ / 2 ✗ | 56 ✓ / 2 ✗ | — |
| `harmonisation-ui-v2.4.15` | 120 ✓ / 10 ✗ | 120 ✓ / 10 ✗ | 2 lignes de gel |
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
| `ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | 47 ✓ / 0 ✗ | — |
| `ressources-disponibilites-v2.5.0` | (suite du round précédent) | 99 ✓ / 6 ✗ | schéma uniquement |

**25 suites sur 31 sont strictement identiques à la référence**, échecs préexistants compris (`accueil-v2.4.4.1` 18, `kanban-badges-v2.4.11.2` 8, `correctifs-v2.4.15.4` 11, `harmonisation-ui-v2.4.15` 10, `densite-v2.4.14` 3, `backup-continuite` 3, `planning-bureau` ×3…). **Aucun échec préexistant ne s'aggrave, et aucune suite ne s'interrompt** — contrairement au round V2.5.0, le renommage n'ayant cette fois touché aucun libellé existant.

Les **15 divergences nouvelles** sont **toutes** des lignes de gel byte-identité, portant sur **six fonctions et six seulement** — exactement celles que V2.6 devait faire évoluer :

| Fonction | Suites concernées | Pourquoi elle a changé |
|---|---|---|
| `gantt` | correctif-ui-14.1, 15.3, 15.4, 15.5, harmonisation-15 | chip de lot sous le nom de la tâche |
| `kanbanCard` | les 6 mêmes | chip de lot sur la carte |
| `planningTasks` | 15.6 | filtre de lot (3ᵉ dimension) |
| `renderPlanning` | 15.6 | sélecteur « Tous les lots » |
| `createRework` | 15.4 | héritage du `lotId` |
| `createTemplateFromWizard` | 15.4 | `lotId` repris du modèle |

`correctifs-v2.4.15.4` affiche 11 ✗ → 13 ✗ : deux anciennes lignes de gel (`gantt`, `kanbanCard`) ont simplement changé de hachage — elles échouaient déjà — et deux fonctions s'y ajoutent (`createRework`, `createTemplateFromWizard`). **Aucune assertion fonctionnelle ne passe de ✓ à ✗.**

Ces suites attestaient correctement que ces fonctions n'avaient pas bougé **dans leur propre round** ; elles détectent donc précisément ce qui était voulu ici. La contrepartie — ce qui ne devait **pas** bouger — est couverte par `FREEZE-260` : **48 moteurs protégés byte-identiques**.

Le rejeu de la suite V2.5 dans cette campagne (99 ✓ / 6 ✗) échoue uniquement sur des assertions de **schéma et de version** (`SCHEMA_VERSION === 9` ×3, sauvegarde « schéma 9 / version 2.5.0 » ×2) et sur l'agrégat de gel dont la référence a changé de rôle. Le rejeu **adapté** de cette même suite, décrit au §34, donne **105 / 105**.

Comme aux rounds précédents, ces suites spécifiques à une version testent correctement **leur propre** `.html` et sont laissées telles quelles (archives) ; la **baseline active V2.6** — `recette-lots-v2.6.0.mjs`, 131/131 — fait foi.

## 37. Console

**0 erreur JavaScript applicative** sur l'ensemble de la recette V2.6.0 (les échecs réseau des routes météo/géocodage, volontairement coupées en test, sont exclus car ils ne proviennent pas du code applicatif).

## 38. Réponse à la question finale

> « Un conducteur peut-il désormais lire et organiser naturellement son chantier par corps d'état, tout en conservant la simplicité actuelle de Kanvix ? »

**Oui.** Il crée une intervention en renseignant Nom · Lot · Intervenant · Quand · Après quelle intervention — six champs, pas un formulaire ERP. Un lot créé une fois est réutilisé dans les tâches, le Planning, les couleurs et les modèles. Le Planning devient lisible par corps d'état sans second moteur de planning : **un filtre de plus dans le seul `planningTasks()`**. Et une ancienne tâche sans lot reste parfaitement fonctionnelle.

La navigation principale n'a pas changé — pas d'entrée « Lots » dans la barre latérale, pas d'onglet chantier supplémentaire, pas de tableau de bord d'analyse. V2.6 **structure**, elle n'analyse pas : les lots préparent les contrôles qualité, les approvisionnements, la réception, le SAV et les opérations multi-chantiers sans en implémenter la moindre partie.

## 39. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"` — **inchangé**.
`SCHEMA_VERSION = 10` (était 9) — migration non destructive prouvée au §6.
