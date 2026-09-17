# Rapport — Kanvix V2.8.5 · Créer une tâche en dessinant sa période dans le Gantt

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.5.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.4.1.html`
**Recette dédiée** : `recette-planning-draw-create-v2.8.5.mjs` — **54 / 54 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.8.5/` (10 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## 1. Ce que le geste fait — et surtout ce qu'il ne fait pas

Le dessin dans le Gantt **ne crée rien**. Il produit un **préremplissage**, puis ouvre le
formulaire existant. La création réelle reste dans `openTaskForm()` et son submit : validation,
ressources, lots, dépendances, `snapshot()`, Undo et `actionToast()` sont **ceux du produit**.

```
pointerdown → pointermove → pointerup
                                 │
                                 └─► openTaskForm(projectId, "", { start, end })
                                                  │
                                              submit ──► snapshot() ──► création ──► toast + Undo
```

**DTC-17** mesure le moment charnière : au relâchement, le drawer est ouvert et
`app.tasks.length` est **inchangé**, `undoHistory.length` **à 0**. Rien n'a encore eu lieu.

## 2. Un seul moteur, une seule extension

`gantt(pid, opts)` n'a pas été dupliqué. Aucun `ganttCreate`, `interactiveGantt`,
`newPlanningGrid` ni `drawPlanning` n'existe. La ligne de création est injectée **dans la boucle
de groupes existante**, juste après le `.join("")` des tâches :

```js
.join("") +
  (planningCanDrawCreate(g, { advanced, readOnly, collapsed })
    ? planningCreateRow(g, s)
    : "")
```

## 3. Périmètre réel du diff — mesuré, pas déclaré

Découpage fonction par fonction des deux fichiers, md5 sur chaque corps :

| | V2.8.4.1 | V2.8.5 |
|---|---|---|
| fonctions de premier niveau | 717 | 728 |
| **supprimées** | — | **0** |
| **modifiées** | — | **2** — `gantt`, `openTaskForm` |
| **ajoutées** | — | **11**, toutes `planningCreate*` / `planningXToDate` |

> Un premier outil de comparaison écrit à la volée avait aussi signalé `renderAIPanel`,
> `planningAgenda` et `weekBounds`. Vérification faite ligne à ligne, **leurs corps sont
> strictement identiques** : le découpage par accolades dérivait sur un littéral de gabarit, et
> le découpage par indentation absorbait le commentaire d'en-tête de la fonction suivante. Les
> trois sont inchangées. La mesure retenue est celle de `FREEZE-285`, qui utilise l'extracteur
> parenthésé éprouvé des recettes précédentes.

## 4. Les onze fonctions ajoutées

| Fonction | Rôle | Pure ? |
|---|---|---|
| `planningXToDate(s, colF, edge)` | position → date, **unique** règle de conversion | ✔ |
| `planningCreateRange(s, colA, colB)` | deux positions → période normalisée | ✔ |
| `planningCanDrawCreate(pid, ctx)` | les gardes, toutes réutilisées | lecture seule |
| `planningCreateRow(pid, s)` | le HTML de la ligne | ✔ |
| `planningCreateColumns(track, x, s)` | pixels → colonnes fractionnaires | ✔ |
| `planningCreatePointerDown/Move/Up` | le geste | état d'IHM |
| `planningCreateLabel(range)` | le libellé de l'aperçu | ✔ |
| `planningCreateEscape` / `cancelPlanningCreateDrag` | sorties propres | état d'IHM |

## 5. La conversion vit à UN seul endroit

`planningXToDate` est la seule fonction qui sait traduire une abscisse en date. Aucun handler ne
refait le calcul de son côté ; `planningCreateRange` l'appelle deux fois, pour le début et pour
la fin. **FREEZE-285** vérifie que ces convertisseurs ne lisent que l'échelle qu'on leur passe.

## 6. Le pas de temps par échelle

| Échelle | Colonne | Pas du dessin | Bornes produites |
|---|---|---|---|
| **Jour** | 30 min | **30 min** | l'heure dessinée |
| **Semaine** | 1 jour | **1 jour** | `T08:00` → `T17:00` |
| **Mois** | 1 semaine | **1 jour DANS la colonne** | `T08:00` → `T17:00` |
| **Année** | 1 mois | **pas de dessin** | — |

En vue Mois, la position **relative dans la colonne hebdomadaire** désigne le jour :
`planningXToDate` prend `frac = colF - i`, puis `Math.floor(frac * 7)`. **DTC-11** dessine du 2/7
au 4/7 de la première colonne et obtient **mercredi → vendredi**, pas la semaine entière.

## 7. Pourquoi l'Année est exclue

Une colonne = un mois. Un geste d'un demi-pixel y déplacerait une intervention d'une journée
entière. Plutôt que d'inventer une règle d'arrondi, la ligne **n'apparaît pas** (`DTC-12` :
`0` ligne, `planningCanDrawCreate` renvoie `false`).

## 8. Le geste ne fabrique aucune heure arbitraire

En vue Semaine et Mois, relâcher au milieu d'une colonne ne produit pas « 13 h 47 » : les bornes
sont la **journée de travail** du produit, `08:00` → `17:00`. **DTC-09** et **DTC-10** le
mesurent dans les deux sens de geste.

## 9. Le sens du geste n'a aucune importance

`planningCreateRange` normalise : `lo = min(a, b)`, `hi = max(a, b)`. **DTC-08** et **DTC-10**
comparent la période obtenue de gauche à droite avec celle obtenue de droite à gauche —
`JSON.stringify` identique.

## 10. Le seuil de 6 px

Un clic simple ne doit jamais ouvrir un formulaire. `planningCreatePointerMove` ne bascule
`moved` à `true` qu'au-delà de **6 px**, et `planningCreatePointerUp` n'ouvre rien tant que
`moved` est faux. **DTC-13** : un déplacement de 0,2 % de la piste → aucun aperçu, aucun drawer.

## 11. Pointer Events, jamais Drag & Drop HTML5

Le drag natif reste la propriété **exclusive** du déplacement des tâches existantes
(`dragStart` / `dropTask`). La ligne de création n'a **ni `draggable`, ni `ondragstart`, ni
`ondrop`** — `FREEZE-285` le vérifie sur le HTML produit. Les deux mécanismes ne partagent
aucun état.

## 12. Souris et stylet seulement

`if (e.pointerType === "touch" || e.button !== 0) return;`

Le tactile garde l'agenda mobile et le bouton **+ Tâche**. **DTC-39** vérifie à 390 px qu'aucun
Gantt n'est affiché, donc aucun geste possible, et **aucun débordement horizontal** (−15 px).

## 13. Zéro mutation métier pendant le geste

**DTC-16** photographie `app.tasks`, `app.history` et `undoHistory` **avant** le
`pointerdown`, puis **pendant** le `pointermove`, avec une signature
`id + start + end` de chaque tâche. Les deux clichés sont **strictement identiques**.

## 14. `planningCreateDrag` ne quitte jamais la mémoire

L'état du geste est une variable de module, hors de `app`. **DTC-43** inspecte `localStorage`
pendant le geste, **DTC-44** inspecte la sauvegarde Kanvix : aucune trace. Il n'entre donc ni
dans l'export, ni dans le backup, ni dans l'Undo.

## 15. La ligne, comme outil et non comme tâche

| Propriété | Mesure |
|---|---|
| hauteur | **34 px** |
| curseur | `crosshair` |
| libellé | « + Ajouter une tâche » + indice « Glissez sur la frise » |
| fond | rayures très discrètes, opacité `.55`, `1` au survol |

> La première version stockait le bouton et l'indice avec `padding: 4px 12px` et un `gap`, ce qui
> donnait **45 px** — au-dessus de la cible 32–36 px, et la ligne se lisait comme une tâche.
> Les interlignes sont désormais **explicites** (15 px + 12 px) et la hauteur est **fixée à
> 34 px** : elle ne dépend plus du `line-height` hérité du corps de page. **DTC-02** la mesure.

## 16. L'alignement au pixel est structurel

`.g-create-row` reprend **exactement** le `grid-template-columns` de `.g-head` et `.g-row` :

```css
grid-template-columns: var(--task-col) repeat(var(--cols), minmax(var(--col-min, 94px), 1fr));
```

La piste occupe `grid-column: 2 / -1` et rejoue la même répartition en interne. **DTC-01**
compare les bords gauches des cellules de création à ceux des créneaux du Gantt : **écart
maximal 0 px**, 7 colonnes contre 7 créneaux.

## 17. L'aperçu ne capte jamais la souris

`.g-create-preview { pointer-events: none }`. **DTC-14** le lit dans le style calculé pendant le
geste et vérifie que la largeur suit le pointeur : **28,57 % → 57,14 %**.

## 18. L'aperçu parle la langue de l'échelle

En vue Jour il annonce des **heures** — « 09:30 → 13:00 » (**DTC-50**, capture 02). En vue
Semaine et Mois il annonce des **jours** — « lun. 17 août → jeu. 20 août » (**DTC-15**,
capture 03). Aucune unité inventée : `fmtTime` et `fmtDay` sont les formateurs du produit.

## 19. Les gardes sont celles qui existaient déjà

`planningCanDrawCreate` n'invente rien :

| Garde | Origine |
|---|---|
| `advanced` / `readOnly` | la condition `canDrag` du drag des tâches |
| `collapsed` | le repli de groupe du Gantt |
| `isProjectActive` | le statut de chantier |
| `canEditProject` | les droits d'édition |
| `app.simulation` | le mode simulation |

**DTC-03** (groupe replié), **DTC-04** (chantier clôturé), **DTC-05** (niveau Essentiel) et
**DTC-38** (simulation) mesurent chacune de ces absences.

## 20. Pourquoi la simulation est exclue

Une tâche **réellement créée** au milieu d'un scénario simulé serait ambiguë : appartient-elle au
plan ou à l'hypothèse ? Plutôt que de trancher à la place de l'utilisateur, la ligne disparaît
(**DTC-38** : `0` ligne).

## 21. La signature de `openTaskForm` reste rétrocompatible

```js
function openTaskForm(pid = app.ui.projectId, editId = "", prefill = null)
```

Le paramètre est **optionnel et en queue**. **DTC-25** rejoue les deux appels historiques :
`openTaskForm()` donne toujours `08:00 → 12:00` du jour, `openTaskForm('terrasses')`
présélectionne toujours le chantier. **FREEZE-285** vérifie la position du paramètre dans le
source.

## 22. Le préremplissage ne s'applique qu'en création

```js
let draw = !current && prefill && prefill.start && prefill.end ? prefill : null;
```

En **édition** (`current` non nul), le prefill est ignoré : les dates de la tâche l'emportent
toujours. Il est structurellement impossible qu'un geste écrase une tâche existante.

## 23. Chantiers planifiés à la semaine

Quand `taskGranularity === "week"`, le formulaire ne montre pas des dates mais une **semaine ISO**
et une **durée en semaines**. La période dessinée n'est pas perdue : elle est ramenée au lundi de
la semaine du début, et la durée couvre la fin. **DTC-28** : un geste sur une semaine préremplit
`2026-W34`, durée `1`.

## 24. Aucune préaffectation depuis les filtres

Un filtre dit **ce qu'on regarde**, pas **ce qu'on veut affecter**. Avec un filtre Ressource
*et* un filtre Lot actifs, le drawer ouvre `resource = ""` et `lot = ""`. **DTC-26 / DTC-27**.

> La sonde choisissait d'abord un couple ressource/lot au hasard, qui vidait le Gantt — l'écran
> « Aucune tâche sur cette période » remplace la frise, donc il n'y avait **aucune** ligne à
> tester et l'absence ne prouvait rien. Le filtre est maintenant **dérivé d'une tâche réellement
> affichée** (`mathieu` / `lot-platrerie`), et la ligne est bien là.

## 25. Annuler le drawer n'a aucune conséquence

**DTC-20** ferme le formulaire sans valider et mesure : `app.tasks` inchangé, `app.history`
inchangé, `undoHistory` à `0`. Pas de tâche, pas de snapshot, pas d'événement d'historique.

## 26. Undo supprime, Redo restaure à l'identique

| Étape | `app.tasks` | `undoHistory` | `redoHistory` |
|---|---|---|---|
| départ | 11 | 0 | 0 |
| après validation | **12** | **1** | 0 |
| après Undo | **11** | 0 | **1** |
| après Redo | **12** | 1 | 0 |

**DTC-23** compare la tâche rétablie à l'originale : **même identifiant**
(`task-1789649570593`), mêmes dates, même chantier, même lot, mêmes dépendances. Ce n'est pas une
tâche équivalente, c'est **la même**.

## 27. Le toast et la barre d'outils disent la même chose

Le toast affiche « Tâche ajoutée · Annuler », l'infobulle du bouton ↶ affiche « Annuler : Tâche
ajoutée — Ctrl+Z » : **même `actionToast`**, même transaction (**DTC-47**). Après l'Undo, le
bouton ↷ devient actif et nomme la même transaction (**DTC-48**).

## 28. Passé les 4 secondes du toast

**DTC-24** attend **4,6 s**, vérifie que le toast a disparu, puis clique le bouton ↶ : la tâche
créée graphiquement est bien annulée. Les commandes persistantes de V2.8.4.1 prennent le relais
sans que rien n'ait été ajouté pour ce cas.

## 29. Trois transactions distinctes, dans le bon ordre

**DTC-49** enchaîne une **création graphique**, une **modification** et un **déplacement**, puis
remonte par trois Undo. Les libellés de la pile sont
`["Tâche ajoutée", "Tâche modifiée", "Tâche déplacée"]` et chaque Undo défait exactement une
étape. Le geste n'est pas un cas particulier de l'historique : c'est une transaction comme les
autres.

## 30. Sorties propres

| Sortie | Effet mesuré |
|---|---|
| **Échap** | aperçu retiré, `planningCreateDrag` vidé, aucun drawer, aucune mutation (**DTC-29**) |
| **`pointercancel`** | idem (**DTC-30**) |
| **débordement à gauche** | borné à `scale.start` (**DTC-31**) |
| **débordement à droite** | borné à `scale.end` (**DTC-32**) |
| **samedi / dimanche** | la date dessinée est **conservée**, aucun saut au lundi (**DTC-33**) |

Le week-end mérite un mot : une intervention **peut** avoir lieu un samedi. Déplacer
silencieusement la sélection au lundi inventerait une règle métier que le produit n'a pas.

## 31. Cohabitation avec l'existant

| Mécanisme | Vérification |
|---|---|
| drag HTML5 des tâches | **DTC-34** — `draggable="true"`, `ondragstart` présent, déplacement effectif, **aucun aperçu de création affiché** |
| clic sur une barre | **DTC-35** — `openTask()` inchangé |
| dépendances | **DTC-36** — `drawDeps()` fonctionne ; la ligne ne porte **ni identifiant de tâche ni ancre**, aucune flèche ne peut la viser |
| Planning d'Opération | **DTC-37** — 3 lignes, 3 chantiers, **aucun code spécifique à l'opération** |
| thème sombre | **DTC-41** — aperçu et libellé lisibles, **uniquement des variables du design system** |
| clavier | **DTC-42** — « + Ajouter une tâche » est un vrai `<button>`, atteignable au clavier, qui ouvre le formulaire **classique** : le dessin n'est jamais le seul chemin |

## 32. Données : rien n'a bougé

`STORE` reste **`kanvix-product-8-3`**, `SCHEMA_VERSION` reste **12**, aucune migration, aucun
nouveau champ métier (**DTC-44 / 45 / 46**, `FREEZE-285`).

---

## Recette dédiée

`recette-planning-draw-create-v2.8.5.mjs` — **54 / 54 PASS**, **0 erreur console applicative**,
50 identifiants DTC-01 → DTC-50 plus le bloc `FREEZE-285`.

| Section | Identifiants |
|---|---|
| Présence de la ligne | DTC-01 → DTC-05 |
| Échelles et seuil | DTC-06 → DTC-13, DTC-50 |
| Le geste | DTC-14 → DTC-20, DTC-43 |
| Création, Undo, Redo | DTC-21 → DTC-24, DTC-47, DTC-48 |
| Formulaire et filtres | DTC-25 → DTC-28 |
| Gardes | DTC-29 → DTC-33 |
| Cohabitation | DTC-34 → DTC-38 |
| Contextes | DTC-39 → DTC-46 |
| Chaîne complète | DTC-49 |
| Byte-identité | FREEZE-285 |

### Deux défauts de sonde corrigés avant de conclure

1. **DTC-06 plantait la recette.** J'avais écrit `(date_diff = ...) === 150` — une affectation à
   une variable non déclarée, interdite en module ES. Remplacée par une constante calculée avant
   l'assertion.
2. **DTC-21 créait deux tâches.** `form.requestSubmit() || autreForm.requestSubmit()` :
   `requestSubmit()` renvoie `undefined`, donc la seconde branche s'exécutait **aussi**. Le
   `total` passait à 13 au lieu de 12 et faisait tomber DTC-21, DTC-22 et DTC-24 en cascade. Le
   formulaire est maintenant résolu **avant** d'être soumis, une seule fois.

## Rejeu de l'ensemble des recettes historiques

**46 recettes rejouées**, chacune sur V2.8.4.1 **puis** sur V2.8.5, verdict par verdict.
**Aucune recette historique n'a été modifiée** : chaque copie de travail vit hors du dépôt et ne
change qu'une constante — le fichier ciblé. `git status` confirme **0 fichier suivi modifié**
pendant tout le balayage.

**Résultat : un seul verdict bascule sur l'ensemble du corpus.**

| Recette | V2.8.4.1 | V2.8.5 | Nature |
|---|---|---|---|
| `recette-undo-redo-ui-v2.8.4.1.mjs` | **38 / 38** | **37 / 38** | `gantt` n'est plus byte-identique |
| les 45 autres | — | **identique** | aucun écart |

Les erreurs console sont **identiques dans les deux balayages** (7 au total, toutes préexistantes,
aucune nouvelle).

### Obsolescence de liste, ou vraie régression ?

**Obsolescence de liste.** La recette V2.8.4.1 gelait `gantt()` parce que V2.8.4.1 n'y touchait
pas. La spécification V2.8.5 demande explicitement d'**étendre `gantt()`**. Le détail le montre :

```
"gelés": 60, "bougés": ["gantt (15dee839 → 228e0625)"]
```

**Une seule fonction bouge, et c'est celle qu'il fallait changer.** Les 60 autres — tout
l'Undo/Redo, `cloneHistoryState`, `restoreHistoryState`, `isTextEditingTarget`, `save`,
`migrateState`, `applyStorageSync`, `resetApp`, `confirmKanvixRestore` — sont intactes, et les
**35 assertions de comportement UIUR-01 → UIUR-35 passent toutes**.

Trois autres recettes gèlent aussi `gantt` (`recette-undo-redo-v2.8.4`,
`recette-harmonisation-ux-v2.8.1`, `recette-correctifs-v2.4.15.4/.5`) : leur assertion de gel
était **déjà rouge sur V2.8.4.1** pour d'autres fonctions (`pageToday`, `icon`,
`operationMilestonesTab`, `migrateState`, `openProjectEdit`, `renderProject`,
`confirmKanvixRestore`). Le verdict n'y change pas — seule la liste des hachages diffère.

`openTaskForm` n'apparaît dans **aucune** liste de gel historique : son extension ne fait donc
tomber aucune assertion.

## Captures — `recette-v2.8.5/`

| Fichier | Contenu |
|---|---|
| `01-create-row-desktop.png` | la ligne « + Ajouter une tâche » dans le Gantt, vue Semaine |
| `02-drag-preview-day.png` | aperçu en vue Jour — « 09:30 → 13:00 » |
| `03-drag-preview-week.png` | aperçu en vue Semaine — « lun. 17 août → jeu. 20 août » |
| `04-drawer-prefilled.png` | le drawer prérempli, avant toute validation |
| `05-task-created.png` | la tâche créée + le toast « Tâche ajoutée · Annuler » |
| `06-after-undo.png` | après Undo — la tâche a disparu, ↷ est actif |
| `07-after-redo.png` | après Redo — la même tâche, même identifiant |
| `08-operation-draw-create.png` | la même ligne dans le Planning d'Opération |
| `09-dark-preview.png` | thème sombre |
| `10-mobile-no-draw.png` | 390 px — l'agenda, aucune création graphique |
