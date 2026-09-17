# Rapport — Kanvix V2.8.5.2 · Édition du Planning en Mode Essentiel, démarrage réel depuis l'éditeur, re-baseline des recettes

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.5.2.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.5.1.html`
**Recette dédiée** : `recette-planning-edition-v2.8.5.2.mjs` — **52 / 52 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.5.2/` (52 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

**Recettes historiques : 48 rejouées, 0 échec inexpliqué.** 71 assertions rendues obsolètes
par le contrat métier ont été re-basées avec justification individuelle (§ « Re-baseline »),
et 8 échecs préexistants ont été résolus au passage.

---

## 1. Diagnostic — pourquoi le drag et la création disparaissaient

Kanvix démarre en `settings.level = "essential"`. Or `gantt()` calculait :

```js
advanced = app.settings.level !== "essential",
canDrag  = advanced && !readOnly,                    // ← le niveau gardait l'édition
```

et `planningCanDrawCreate()` refusait le geste sur le même critère :

```js
if (!ctx.advanced || ctx.readOnly) return false;     // ← idem
```

Conséquence mesurée sur V2.8.5.1, après un simple `resetApp()` :

| | Essentiel (par défaut) | Pilotage |
|---|---|---|
| lignes « + Ajouter une tâche » | **0** | 3 |
| barres `draggable="true"` | **0** | 9 |
| zones de dépôt | **0** | 63 |

**C'est une confusion de nature.** Le niveau décrit la profondeur d'ANALYSE offerte à
l'utilisateur ; il ne décrit pas un droit d'écriture. Les vraies gardes d'édition existaient
déjà, ailleurs et correctement : `planningIsReadOnly` (planning historique),
`canEditProject` / `guardEditable` (chantier actif), `t.status === "done"` (tâche terminée),
`app.simulation`.

**Pourquoi aucune recette ne l'avait vu** : la recette V2.8.5 contenait bien un test du Mode
Essentiel — mais il *affirmait l'inverse* (« DTC-05 : en niveau Essentiel, aucune création
graphique »), et toutes les autres recettes forçaient `setDepth('pilot')` dans leur
`newPage()`. L'état par défaut du produit n'était donc jamais exercé.

## 2. Le contrat appliqué

```
MODE ESSENTIEL   = planning SIMPLE, totalement manipulable
MODE PILOTAGE    = mêmes capacités d'édition + outils d'analyse
```

`gantt()` porte désormais une notion explicite, nommée pour ce qu'elle est :

```js
canEditPlanning = !readOnly,      // le droit d'éditer, hors de tout niveau
canDrag = canEditPlanning,
```

et `planningCanDrawCreate()` ne connaît plus le niveau :

```js
if (app.settings.period === "year") return false;   // trop imprécis
if (app.simulation) return false;                    // ambiguïté visuelle
if (ctx.readOnly) return false;                      // planning historique
if (ctx.collapsed) return false;
return !!p && isProjectActive(p) && canEditProject(projectId);
```

Le drapeau `advanced` a été **supprimé de `gantt()`** : il n'y servait plus à rien, et l'y
laisser aurait laissé croire que le niveau garde encore quelque chose. `expert` y reste, pour
la baseline et la légende — c'est-à-dire pour l'analyse.

`renderPlanning()` n'a pas été touché : la barre d'analyse, le bandeau « Vue simplifiée », le
bouton Dépendances et le nudge de conflits restent exactement gardés par le niveau.

## 3. Preuve — le Mode Essentiel est éditable

Mesuré après un simple `resetApp()`, **sans `setDepth`** :

| Mesure | Essentiel | Pilotage |
|---|---|---|
| `app.settings.level` | `essential` | `pilot` |
| lignes « + Ajouter une tâche » | **3** | 3 |
| pistes `.g-create-track` (curseur `crosshair`) | **3** | 3 |
| barres `draggable="true"` | **9** | 9 |
| zones de dépôt `.g-slot[ondrop]` | **63** | 63 |

**PE-01** vérifie d'abord que le niveau testé est bien `essential` — sans quoi tout le reste
ne prouverait rien.

## 4. Preuve — le Mode Essentiel reste simple (§17)

| Élément d'analyse | Essentiel | Pilotage |
|---|---|---|
| `.analysis-bar` (Baseline / Dépendances / Chaîne d'impact) | **0** | 1 |
| `.baseline` (rails « prévu initialement ») | **0** | — |
| `.plan-legend` | **0** | 1 |
| `.impact-band` | **0** | — |
| bandeau « Vue simplifiée · Passer en Pilotage » | **1** | 0 |

**PE-02** mesure les deux moitiés du contrat dans la même assertion : l'édition est là,
l'analyse n'y est pas.

## 5. Preuve — de VRAIS gestes utilisateur

Le PC-23 de V2.8.5.1 appelait `requestTaskScheduleMove()` et se contentait de vérifier
l'existence de la chaîne. Les tests de V2.8.5.2 déclenchent les **événements du navigateur** :

| Geste | Mécanisme | Ce qui est réellement déclenché |
|---|---|---|
| déplacer une tâche | `locator.dragTo()` | `dragstart` → `dragover` → `drop` HTML5 du produit |
| dessiner une période | `mouse.down / move / up` | `pointerdown` / `pointermove` / `pointerup` |
| déposer une carte Kanban | `DragEvent` + `DataTransfer` | les handlers réels du Kanban |

**PE-03** (Essentiel) : la tâche part de `2026-08-17T08:00` et arrive à `2026-08-19T08:00`,
durée conservée, `undoHistory` `0 → 1`. **PE-04** l'annule aux dates exactes, **PE-05** le
rejoue. **PE-15** refait le même geste en Pilotage : résultat identique.

**PE-06 → PE-08** déposent la barre sur le samedi 22 : la confirmation « jour non ouvré »
s'ouvre et nomme le jour ; « Annuler » ne touche à rien (dates, historique et snapshot
inchangés) ; « Planifier quand même » applique le déplacement en **une** transaction.

**PE-11 → PE-14** dessinent réellement à la souris en Essentiel : aperçu en tirets, formulaire
prérempli `2026-08-17T08:00 → 2026-08-19T17:00`, `0` tâche créée avant validation, puis
`11 → 12` tâches et `0 → 1` Undo à la validation, Undo/Redo exacts.

## 6. Le Planning d'Opération hérite, sans une ligne de code spécifique

`FREEZE-2852` et **PE-17** vérifient qu'il n'existe qu'**un** `gantt(` dans tout le fichier.
En Opération, en Essentiel : **9** barres draggables, **3** lignes de création, et
**PE-18** dessine sur la piste, ouvre le formulaire sur un chantier du périmètre
(`keravel`), sans rien muter avant validation.

## 7. Les vraies interdictions, elles, tiennent

| Garde | Mesure | Test |
|---|---|---|
| chantier clôturé (`lifecycle`) | `readOnly`, 0 ligne, 0 barre draggable | **PE-19** |
| tâche terminée | `draggable` absent, pas de `ondragstart` | **PE-20** |
| vue Année | 0 ligne, `planningCanDrawCreate` faux | **PE-21** |
| simulation | 0 ligne, `planningCanDrawCreate` faux | **PE-22** |

## 8. Le deuxième correctif — démarrage réel depuis l'éditeur universel

**Le diagnostic.** `submitTaskEdit()` appelle le moteur de statut en mode transactionnel :

```js
setTaskStatus(st.id, status, "manual-edit", { transactional: true, manual: true })
```

et `setTaskStatus` en dérive `silent = opts.transactional === true`. Or la garde de démarrage
réel de V2.8.5.1 est posée sous `!silent` — elle n'était donc **jamais atteinte** par ce
chemin. Modifier une tâche « À faire → En cours » depuis l'éditeur laissait ses dates dans le
futur : exactement l'incohérence que le §7 de V2.8.5.1 prétendait avoir supprimée.

**La correction, et pourquoi pas ailleurs.** Déplacer la garde dans `setTaskStatus` sous
`silent` aurait posé une confirmation — donc potentiellement un second snapshot — au milieu
de la transaction de l'éditeur, en violation du §8. La même question est donc posée **dans
`submitTaskEdit`, avant son `snapshot()`**, avec les **mêmes fonctions** :
`realStartPlan()`, `nonWorkingDaysInRange()`, `calendarConfirm()`. Aucun second moteur :
`FREEZE-2852` et **PE-36 → PE-39** comptent une seule occurrence de chacun.

La confirmation acquise, un accusé de réception (`taskEditConfirmAck`) porte la saisie exacte
confirmée — tâche, dates, statut, réalignement — et est **consommé immédiatement**. L'éditeur
écrit alors les dates réalignées dans sa propre transaction.

## 9. Preuve — UNE transaction pour nom + statut + dates

Scénario **PE-23 → PE-28**, horloge au 17 août 14:30 :

```
avant     Cloisons étage 1 · À faire · 18 août 08:00 → 12:00   (4 h)
saisie    nom → « Nom B »,  statut → « En cours »,  Enregistrer
```

| Étape | `nom` | `statut` | `start` | `end` | `undoHistory` | `app.history` |
|---|---|---|---|---|---|---|
| **avant confirmation** | Cloisons étage 1 | todo | 18/08 08:00 | 18/08 12:00 | **0** | **0** |
| **après confirmation** | **Nom B** | **doing** | **17/08 14:30** | **17/08 18:30** | **1** | 2 |
| **après Undo** | Cloisons étage 1 | todo | 18/08 08:00 | 18/08 12:00 | **0** | — |
| **après Redo** | Nom B | doing | 17/08 14:30 | 17/08 18:30 | — | — |

Durée **4 h avant, 4 h après**. L'entrée de synthèse porte les trois champs :
`["Nom", "Début", "Fin"]`. **UN seul Undo** restaure les trois ensemble — il ne peut pas en
aller autrement : il n'existe qu'**un** point de capture, le `snapshot()` unique de
l'éditeur, posé **après** la confirmation.

**PE-29** : « Annuler » ne mute rien et **laisse le formulaire ouvert avec la saisie**
(`champNom === 'Jamais enregistré'`) — rien n'est perdu.
**PE-30** : un écart de 2 minutes (tolérance 5 min) ne déclenche aucune confirmation.
**PE-31** : `baselineStart` / `baselineEnd` strictement inchangés.
**PE-32** : quand le repositionnement traverse aussi un week-end, **une seule** modale
(`modales: 1`, 2 boutons) porte les deux messages.

## 10. Les quatre chemins, une seule vérité

**PE-33 / PE-34 / PE-35** rejouent le même scénario depuis le **Kanban**, la **fiche tâche**
et le **Mode Chantier** : confirmation identique, `start = 2026-08-17T14:30`, durée 4 h
conservée, `0` mutation avant confirmation. Avec **PE-23**, les quatre chemins du §7 sont
désormais couverts par un test, et non par une affirmation.

## 11. Fonctions modifiées / ajoutées

Découpage fonction par fonction, md5 sur chaque corps :

| | V2.8.5.1 | V2.8.5.2 |
|---|---|---|
| fonctions | 755 | **756** |
| **supprimées** | — | **0** |
| **modifiées** | — | **4** |
| **ajoutées** | — | **1** |

| Fonction | Raison |
|---|---|
| `gantt` | `canEditPlanning` remplace `advanced` ; `advanced` supprimé (§3) |
| `planningCanDrawCreate` | le niveau n'est plus une garde (§4) |
| `submitTaskEdit` | démarrage réel + jour non ouvré, avant le snapshot (§6–§9) |
| `closeOverlay` | purge de `taskEditConfirmAck` à la fermeture du formulaire |
| **`clearTaskEditAck`** (ajoutée) | remise à zéro de l'accusé de réception |

> L'extracteur brut signale aussi `renderAIPanel` ; comparaison ligne à ligne bornée à
> l'indentation : **corps strictement identique**. C'est le même artefact qu'aux rounds
> précédents — ses littéraux de gabarit mettent en défaut le découpage par accolades.
> `FREEZE-2852` utilise l'extracteur parenthésé et ne le compte pas.

`FREEZE-2852` vérifie que **84 moteurs de V2.8.5.1 sont byte-identiques** : tout le
calendrier des jours non ouvrés, `realStartPlan`, `askRealStartConfirm`, `calendarConfirm`,
la propagation, `dropTask` / `dragStart` / `requestTaskScheduleMove`, `openTaskForm` et tout
le draw-to-create, la Qualité, les Ressources, les Jalons, le Backup et le Mode Chantier.

**STORE** reste `kanvix-product-8-3`, **SCHEMA_VERSION** reste **12**. Aucune migration,
aucune donnée persistante nouvelle.

---

## Recette dédiée

`recette-planning-edition-v2.8.5.2.mjs` — **52 / 52 PASS**, **0 erreur console applicative**.

Sa différence de méthode avec les recettes précédentes tient en une ligne :
`newPage({ level })` est **explicite**, et vaut **`'essential'` par défaut**. Les scénarios
qui doivent tester le Pilotage le demandent ; les autres exercent l'état réel du produit.

| Section | Identifiants |
|---|---|
| Drag en Essentiel (vrai geste) | PE-01 → PE-08 |
| Création à la souris en Essentiel | PE-09 → PE-14 |
| Pilotage et Opération | PE-15 → PE-18 |
| Gardes métier | PE-19 → PE-22 |
| Éditeur universel | PE-23 → PE-32 |
| Kanban / fiche / Mode Chantier | PE-33 → PE-35 |
| Aucun moteur parallèle | PE-36 → PE-39 |
| Console | PE-40 |
| Byte-identité et périmètre | FREEZE-2852 |

### Deux défauts de sonde corrigés avant de conclure

1. **PE-19** posait `pr.status = 'closed'`. Le verrou lecture seule lit `lifecycle`
   (`projectLifecycle`), pas `status` : le chantier restait actif et le test ne prouvait rien.
2. **PE-32** saisissait des dates de week-end dans le formulaire. La période réalignée part de
   **maintenant**, pas des dates saisies : pour que les deux sujets se présentent ensemble,
   c'est la **durée** qui doit traverser le week-end (5 j 4 h → lundi 14:30 → samedi 18:30).

---

## Re-baseline des recettes historiques

**48 recettes rejouées**, chacune sur V2.8.5 (référence d'avant le changement de contrat) puis
sur V2.8.5.2, verdict par verdict.

| | nombre |
|---|---|
| assertions en écart au départ | **71** |
| re-basées (contrat obsolète) | **71** |
| régressions produit corrigées | **0** |
| **échecs restant inexpliqués** | **0** |
| échecs préexistants résolus au passage | **8** |

### Tableau de justification

| Recette | Assertion historique | Cause | Catégorie | Action |
|---|---|---|---|---|
| `accueil-v2.4.4.1`, `accueil-v2.4.5` | `field-sync` / `kanban-sync` : statut répercuté sans F5 | la transition « En cours » attend une confirmation | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | le geste inclut la confirmation ; assertion inchangée |
| `backup-continuite-v2.4.13.1` | `BACKUP-F12` : événements restaurés, transitions structurées | idem (scénario amont) | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `controles-qualite-v2.7.0` | `QC-*` : « en cours » matérialise les contrôles | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `correctif-ui-v2.4.14.1` | `CHT-*` : timeline, étanchéité inter-chantiers | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `correctifs-v2.7.1` | `QUAL271-02` : `setTaskStatus()` renvoie un outcome exploitable | l'appel initial rend la main **avant** la transition | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | l'outcome est lu sur la transition réellement effectuée ; l'exigence (`completed === false`) est inchangée |
| `harmonisation-ui-v2.4.15` | `UI5-HIST-*` : comptage des entrées `task-status` | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `historique-metier-v2.4.13` | 26 sites + `realDrag` (la recette plantait) | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `historique-metier-v2.4.13` | `ORDRE` : plus récent en haut, aucun tri | la timeline porte aussi les replanifications automatiques | **CONTRAT OBSOLÈTE** — V2.8.5.1 §9 | l'ordre est vérifié sur les **transitions de statut**, seuls événements que l'assertion a jamais prétendu ordonner |
| `historique-metier-v2.4.13` | `RESPONSIVE` : ≤ 110 px/événement | une transition qui vaut démarrage réel porte aussi Début/Fin | **CONTRAT OBSOLÈTE** — V2.8.5.1 §14 | **deux** assertions désormais : l'entrée sans repositionnement tient toujours dans les 110 px d'origine, la moyenne enrichie reste sous 135 px |
| `kanban-badges-v2.4.11.1/.2/.3` | `BADGE-*`, `KAN-CTX-*` : colonnes et badges après démarrage | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | confirmation intégrée à `realDrag` ; **toutes** les assertions de badges inchangées |
| `correctifs-v2.4.15.4` | `KAN-1514-drop` : le toast nomme la colonne cible | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem ; le libellé attendu est **le même** |
| `non-regression-v2.6.1-vers-v2.7` | `NR-*` : démarrer puis terminer sans contrôle | idem | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | idem |
| `planning-bureau-v2.4.10.1/.10/.9.1` | `PLAN-F5` : « drag Kanban change le statut **sans toucher aux dates** » | **contrat directement remplacé** | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | assertion **re-pointée** : le dépôt applique le statut et, s'il vaut démarrage réel, recale le début sur l'heure réelle **en conservant la durée** — exigence équivalente, pas plus faible |
| `planning-bureau-v2.4.9.1` | `PLAN-F4` : Undo restaure les dates après un drag | le dépôt peut tomber sur un jour non ouvré | **CONTRAT OBSOLÈTE** — V2.8.5.1 §5 | confirmation intégrée au geste ; exigence inchangée |
| `planning-v2.4.8` | `P3` : « drag ne déplace PAS les dates » + historique en tête | **contrat directement remplacé** | **CONTRAT OBSOLÈTE** — V2.8.5.1 §7 | re-pointée comme `PLAN-F5` ; l'entrée « commencée » est cherchée dans l'historique au lieu d'être supposée en tête |
| `edition-taches-v2.4.8` | `EDIT-07` et 13 autres sites `submitTaskEdit()` | **l'éditeur applique désormais le démarrage réel** | **CONTRAT OBSOLÈTE** — V2.8.5.2 §6 | confirmation intégrée ; `EDIT-07` cherche l'entrée de transition au lieu de la supposer en tête |
| `planning-draw-create-v2.8.5` | `DTC-05` : « en Essentiel, aucune création graphique » | **contrat directement remplacé** | **CONTRAT OBSOLÈTE** — V2.8.5.2 §2 | assertion **re-pointée sur les deux moitiés du nouveau contrat** : la création et le drag sont DISPONIBLES, **et** l'interface reste simple (0 barre d'analyse, 0 baseline) |
| `planning-draw-create-v2.8.5` | `FREEZE-285` : périmètre attendu | `requestTaskScheduleMove`, `setTaskStatus`, `submitTaskEdit` ont changé depuis | **CONTRAT OBSOLÈTE** — V2.8.5.1 §5/§7, V2.8.5.2 §6 | les trois passent de la liste « gelées » à la liste « attendues » ; la vérification exige désormais que **toutes** les fonctions attendues aient changé — aucune dérive hors liste |
| `correctif-ui-v2.4.14.1`, `correctifs-v2.4.15.3/.4/.5/.6`, `harmonisation-ui-v2.4.15` | listes de gel : `setTaskStatus`, `requestTaskScheduleMove`, `gantt`, `renderPlanning` | fonctions modifiées à la demande explicite du produit | **CONTRAT OBSOLÈTE** — V2.8.5.1 §4/§5/§6/§7, V2.8.5.2 §3 | ces quatre noms sortent des listes, avec en commentaire la version et la raison de chacun. **Tous les autres moteurs de ces listes restent vérifiés byte à byte** |

### Ce qui n'a PAS été fait

Aucune assertion n'a été supprimée. Aucun seuil n'a été déplacé sans mesure : le seul seuil
modifié (110 → 135 px/événement) est **accompagné d'une seconde assertion** qui vérifie que
le budget d'origine tient toujours pour une entrée simple. Aucune vérification métier n'a été
remplacée par une vérification plus faible : les quatre assertions de contrat re-pointées
exigent toutes **autant** que celles qu'elles remplacent (statut appliqué, durée conservée,
début recalé, simplicité préservée).

**Catégorie RÉGRESSION PRODUIT : aucune.** Les 71 écarts s'expliquent tous par un contrat
métier explicitement demandé en V2.8.5.1 ou V2.8.5.2.

### Résultats finaux, recette par recette

Les 48 recettes historiques sont désormais **au niveau ou au-dessus de leur référence
V2.8.5**. Les échecs qui subsistent sont **antérieurs** à ces trois versions (ils existaient
déjà sur V2.8.5) : listes de gel de rounds anciens comparant à des versions lointaines,
assertions `app.undoStack` d'avant V2.8.4, `SCHEMA_VERSION` attendu à 8 dans une recette de
V2.4.13. Ils sont hors du périmètre de cette version et n'ont pas été touchés.

Trois recettes remarquables :

| Recette | V2.8.5 | V2.8.5.2 |
|---|---|---|
| `recette-planning-draw-create-v2.8.5` | 54 / 0 | **54 / 0** |
| `recette-planning-calendrier-realite-v2.8.5.1` | — | **76 / 0** |
| `recette-planning-edition-v2.8.5.2` | — | **52 / 52** |

Toutes les fonctions de V2.8.5.1 sont donc opérationnelles : jours ouvrés et fériés fixes et
mobiles, coloration samedi/dimanche/férié en clair et en sombre, confirmations à la création,
à la modification et au drag, aucun décalage automatique au lundi, navigation
← Aujourd'hui → du Planning d'Opération, démarrage réel, conservation de durée, propagation
aval, baseline immuable, Undo/Redo global, absence de doubles bandes bleues, aperçu
draw-to-create en tirets.

---

## Erreurs console

**0** erreur JavaScript applicative dans la recette dédiée. Aucune erreur console nouvelle
dans le balayage historique.

## Responsive et thèmes

**Dix largeurs × deux niveaux × deux thèmes = 40 combinaisons**, plus les deux captures
d'Opération.

- **Aucun débordement horizontal** : l'écart `scrollWidth − clientWidth` vaut −15 px partout.
- **De 768 à 1920 px**, l'édition est présente dans les **deux** niveaux : 32 combinaisons
  mesurées avec `lignes > 0` et `barres > 0`.
- **À 430 et 390 px**, le parcours mobile reste l'agenda : aucun drag tactile n'a été ajouté,
  conformément au §13.

## Captures — `recette-v2.8.5.2/`

| Fichier | Contenu |
|---|---|
| `01-essential-planning-week.png` | Mode Essentiel — « + Ajouter une tâche » visible sous chaque chantier |
| `02-essential-draw-preview.png` | aperçu de création à la souris, en tirets |
| `03-essential-after-draw-create.png` | la tâche créée en Essentiel |
| `04-essential-drag.png` | la tâche réellement déplacée par un drag HTML5 |
| `05-essential-drag-weekend-confirm.png` | confirmation « jour non ouvré » après un vrai drag vers le samedi |
| `06-pilot-planning-week.png` | Pilotage — mêmes capacités d'édition + analyse |
| `07-operation-essential-planning.png` | Planning d'Opération éditable en Essentiel |
| `08-editor-real-start-confirm.png` | confirmation de démarrage réel depuis l'éditeur universel |
| `09-editor-real-start-after.png` | la tâche repositionnée, nom modifié conservé |
| `10-editor-real-start-undo.png` | état restauré par un seul Undo |
| `w{L}-{E\|P}-{clair\|sombre}.png` | 40 captures : 10 largeurs × 2 niveaux × 2 thèmes |
| `operation-essential.png`, `operation-pilot.png` | Planning d'Opération dans les deux niveaux |

## Limites résiduelles, assumées

1. **Mobile** : aucun drag tactile n'a été introduit. Le parcours mobile reste l'agenda, et le
   draw-to-create demeure réservé à la souris et au stylet.
2. **Retour de `setTaskStatus`** : quand une confirmation s'ouvre, la fonction rend la main
   sans valeur — la transition n'a pas encore eu lieu. C'est inhérent à une confirmation
   asynchrone ; l'appelant lit l'outcome de la transition effectivement réalisée.
3. **Échecs historiques antérieurs à V2.8.5** : non traités, hors périmètre de cette version.
   Ils sont identiques avant et après.
4. **Texte d'historique** : inchangé. Ce sont les `changes` structurés qui portent le
   repositionnement.
