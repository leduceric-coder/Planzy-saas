# Rapport — Kanvix V2.8.5.1 · Jours non ouvrés, navigation Opération, démarrage réel

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.5.1.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.5.html`
**Recette dédiée** : `recette-planning-calendrier-realite-v2.8.5.1.mjs` — **75 / 75 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.5.1/` (32 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

> **À lire en priorité** : ce patch change un comportement métier central — passer une
> tâche « En cours » repositionne désormais ses dates. C'est ce que demande le §7, et cela
> fait tomber **50 assertions de recettes historiques** qui figeaient l'ancien contrat.
> La section **« Rejeu des recettes historiques »** en donne le détail, la preuve de
> causalité unique, et la décision qui vous revient.

---

## 1. Périmètre réel du diff — mesuré

Découpage fonction par fonction des deux fichiers, md5 sur chaque corps :

| | V2.8.5 | V2.8.5.1 |
|---|---|---|
| fonctions | 733 | **755** |
| **supprimées** | — | **0** |
| **modifiées** | — | **9** |
| **ajoutées** | — | **22** |

**Les 9 modifiées**, et pourquoi :

| Fonction | Raison |
|---|---|
| `setTaskStatus` | §7–§13 — démarrage réel |
| `requestTaskScheduleMove` | §5 — confirmation avant un déplacement vers un jour non ouvré |
| `openTaskForm` | §16/§17 — confirmation à la validation du formulaire |
| `gantt` | §4 — classes de colonne et pastille « Férié » |
| `renderPlanning` | §6 — le libellé de période devient partageable |
| `operationPlanningTab` | §6 — barre ← Aujourd'hui → |
| `planningCreateRow` | §4 — la ligne de création lit le même calendrier |
| `projectUpcomingTimeline` | §4 — l'agenda mobile lit le même calendrier |
| `closeOverlay` | §5.2 — nettoyage de l'état temporaire |

> **Sur l'outil de mesure.** Mon premier extracteur de corps de fonction coupait à la
> première accolade rencontrée — c'est-à-dire à celle d'un **paramètre par défaut**
> (`opts = {}`). `setTaskStatus` et `gantt` n'étaient donc comparés que **par leur
> signature** et paraissaient gelés alors que je venais de les réécrire. L'extracteur saute
> désormais la liste de paramètres parenthèse par parenthèse avant de chercher l'accolade du
> corps. `FREEZE-2851` a été relancé avec l'outil corrigé : c'est ce chiffre-là qui est
> publié. `renderAIPanel` reste hors liste (ses littéraux de gabarit mettent l'extracteur en
> défaut quelle que soit la correction) ; sa byte-identité est vérifiée séparément, par
> découpe à l'indentation.

---

## 2. Logique des jours fériés

`easterSunday(year)` implémente l'**algorithme grégorien anonyme** (Meeus/Jones/Butcher) :
arithmétique pure, valable pour n'importe quelle année. `frenchPublicHolidays(year)` en
dérive les trois dates mobiles et y ajoute les huit dates fixes, puis mémorise le résultat
par année.

| Fixes | Mobiles (depuis Pâques) |
|---|---|
| 1ᵉʳ janvier · 1ᵉʳ mai · 8 mai · 14 juillet | Lundi de Pâques (**+1**) |
| 15 août · 1ᵉʳ novembre · 11 novembre · 25 décembre | Ascension (**+39**) · Lundi de Pentecôte (**+50**) |

**PC-12 à PC-14** vérifient les trois dates mobiles sur **trois années distinctes** — 2026,
2027 et 2031 — précisément pour qu'une table figée ne puisse pas passer le test :

```
Lundi de Pâques   2026-04-06   2027-03-29   2031-04-14
Ascension         2026-05-14   2027-05-06   2031-05-22
Lundi de Pentecôte 2026-05-25  2027-05-17   2031-06-02
```

Hors périmètre assumé, comme demandé : Alsace-Moselle, jours territoriaux, conventions
collectives.

## 3. Une seule vérité calendaire

Sept fonctions pures, et **une seule règle de week-end dans tout le fichier** —
`FREEZE-2851` compte les occurrences de `[0, 6].includes(` : il en reste **exactement une**,
dans `isWeekendDate`.

```
isWeekendDate ─┐
               ├─► isNonWorkingDate ─► nonWorkingDaysInRange ─► taskTouchesNonWorkingDay
publicHolidayName ─┘                            │
                                                ├─► l'AFFICHAGE  (planningColumnFlags)
                                                └─► l'AVERTISSEMENT (needsNonWorkingConfirm)
```

Une colonne ne peut donc pas être teintée « week-end » alors que la confirmation la dirait
ouvrable : les deux lisent la même fonction.

## 4. La détection parcourt toute la période

`nonWorkingDaysInRange` itère **jour par jour** du début à la fin, pas seulement le jour de
début. **PC-18** : une tâche `vendredi 21 août 16:00 → samedi 22 août 11:00` remonte bien
`sam. 22 août`. Une fin calée exactement à `00:00` n'entame pas le jour suivant.

## 5. Identification visuelle — chiffrée

| Thème | V2.8.5 | V2.8.5.1 | Gain |
|---|---|---|---|
| **clair** — écart de luminance week-end / surface | **5,45 %** | **17,29 %** | ×3,2 |
| **sombre** — écart RGB week-end / surface | **4/8/11** | **10/17/22** | ×2,3 |

`--surface-subtle` (#f7f9fc) était à 3 % du blanc : invisible en pratique. Deux jetons
dédiés le remplacent, `--nonworking` et `--nonworking-holiday`, définis dans les deux
thèmes. **Ni rouge ni orangé** : un week-end n'est pas une anomalie (**PC-26**, **PC-27**).

| Échelle | Ce qui est signalé |
|---|---|
| **Jour** | toute la zone temporelle, + le nom du férié dans le libellé (« samedi 15 août 2026 · Assomption ») |
| **Semaine** | chaque colonne-jour, + pastille **Férié** (info-bulle = le nom) |
| **Mois** | une colonne = une SEMAINE : ni samedi ni dimanche. Seule la présence d'un férié y est signalée — c'est la seule information pertinente à cette échelle |
| **Année** | rien : une colonne est un mois entier |

**§4.2 — un seul aplat.** Le 15 août 2026 est à la fois samedi *et* Assomption :
`planningColumnClass` n'émet **qu'une** classe, `holiday`. **PC-28** le mesure.

**Un choix assumé** : en vue Jour, les vingt colonnes sont des demi-heures du même jour.
Répéter « Férié » vingt fois serait du bruit — la pastille y est supprimée, la teinte et le
libellé de période portent l'information.

## 6. Logique de confirmation

**Un composant, quatre appelants.** `calendarConfirm` n'écrit rien : elle affiche, mémorise
le rappel de l'appelant, et ne le rejoue que si l'utilisateur confirme.

```
création (formulaire)   ─┐
modification            ─┤
glisser-déposer Gantt   ─┼─► needsNonWorkingConfirm ─► calendarConfirm ─► rappel de l'appelant
démarrage réel          ─┘         (aucune écriture avant validation)
```

Le rejeu se fait par un **accusé de réception de période** (`planningNonWorkingAck`), qui ne
vaut que pour ce couple début/fin précis et qui est consommé immédiatement. « Planifier
quand même » resoumet donc le formulaire d'origine, avec sa validation, son `snapshot()`,
son historique et son Undo : **la confirmation n'ajoute aucune transaction** (**PC-21**).

**§5.2 — Annuler.** `0` tâche, `0` historique, `0` snapshot, dates d'origine intactes, et le
formulaire reste ouvert derrière la modale pour corriger la saisie (**PC-19**, **PC-24**).

**Aucun décalage automatique au lundi.** **PC-20** : une tâche confirmée est créée aux dates
**exactes** saisies.

## 7. Logique du démarrage réel

`realStartPlan(t)` compare l'heure courante au début planifié. En deçà de
`REAL_START_TOLERANCE_MS` (**5 minutes**, constante nommée), le planning est déclaré
cohérent et **rien n'est demandé** (**PC-46**). Au-delà, la confirmation nomme l'horaire
prévu **et** le nouveau, puis :

```
début  := maintenant
fin    := maintenant + durée PLANIFIÉE   ← la durée est la seule chose que le plan savait
statut := doing                             et que la réalité ne remet pas en cause
```

| Cas | Prévu | Démarré | Résultat |
|---|---|---|---|
| **avant** (§8.2) | mar. 18 · 08:00–12:00 | lun. 17 · 14:30 | 17 · **14:30–18:30** (4 h) |
| **après** (§10/§11) | lun. 17 · 08:00–16:00 | lun. 17 · 14:30 | 17 · **14:30–22:30** (8 h) |

**PC-37** et **PC-45** vérifient la durée au quart d'heure près. La fin n'est jamais forcée à
17:00 ni 18:00.

**La garde précède TOUT effet de bord.** Je l'avais d'abord placée après
`ensureTaskControlInstances(id)` : une confirmation refusée laissait alors un contrôle
qualité créé « au passage ». Elle est désormais la **première** chose après les gardes
« no-op » et « terminé ». **PC-35** mesure que refuser ne crée ni contrôle, ni historique,
ni snapshot, ni changement de statut.

**§9 — pas de second moteur.** La propagation aval réutilise `planReflow` /
`applyReflowPlan`, dans la même transaction. `FREEZE-2851` vérifie qu'il n'existe **qu'un**
`planReflow` et que `setTaskStatus` l'appelle bien. Les gardes métier y sont intactes : une
tâche **terminée** n'est jamais déplacée et coupe la cascade, une tâche **en cours** passe
en arbitrage (**PC-49**).

**§12 — une seule modale.** Si le repositionnement amène la tâche sur un jour non ouvré, les
deux messages sont **fusionnés** : un titre, un avertissement, deux boutons. **PC-47**
compte `1` modale ouverte et `2` boutons.

**§48 — la garde « terminé » de V2.7 tient.** Une tâche `done` ne redevient pas `doing` par
ce chemin (**PC-48**).

## 8. Comment Undo/Redo garantit UNE transaction

Le repositionnement est appliqué **à l'intérieur** de la transaction du changement de
statut, entre le `snapshot()` unique et le `save()` :

```js
if (!silent) snapshot();              // ← LE seul snapshot
if (realign) { t.start = …; t.end = …; }
t.status = status;
app.history.unshift({ …, changes: [Statut, Début, Fin] });   // UNE entrée
if (realign) applyReflowPlan(planReflow(id), id);            // aval, même transaction
save();
```

Il est donc **structurellement impossible** d'obtenir « Undo 1 = statut, Undo 2 = date » :
il n'existe qu'un point de capture. **PC-43** mesure `undoHistory` avant/après et vérifie
qu'**un seul** Undo restaure ensemble `status`, `start` et `end` ; **PC-44** qu'un seul Redo
les rejoue.

Même garantie pour la création confirmée (**PC-21/22**) et pour le déplacement confirmé
(**PC-25**).

## 9. Preuve de non-modification de la baseline

La baseline vit sur la tâche, dans `baselineStart` / `baselineEnd`. Aucune des neuf
fonctions modifiées ne les écrit — `grep` le confirme, et **PC-42** le mesure de bout en
bout :

```
avant  baseline = ["2026-08-18T08:00", "2026-08-18T12:00"]
après  start/end = 2026-08-17T14:30 → 18:30
après  baseline = ["2026-08-18T08:00", "2026-08-18T12:00"]   ← identique
```

Le planning actuel bouge, le plan initial de référence ne bouge pas.

## 10. Navigation temporelle de l'Opération

Aucun moteur propre à l'Opération. Les trois boutons portent **littéralement**
`shiftPlanning(-1)`, `planningToday()`, `shiftPlanning(1)` — `FREEZE-2851` lit les attributs
`onclick` dans le source et vérifie qu'aucune fonction `shiftOperationPlanning` /
`operationShiftPeriod` / `opPlanningShift` n'existe. `app.ui.periodAnchor` reste la seule
vérité temporelle.

Le libellé de période est sorti de `renderPlanning` dans `planningPeriodLabel()` : les deux
barres affichent **le même texte**, calculé une fois.

| Test | Mesure |
|---|---|
| **PC-29** | `→` avance de **7 jours** en Semaine, le Gantt consolidé se recalcule |
| **PC-30** | `←` recule de **7 jours** |
| **PC-31** | traverse une fin de mois (août → septembre) **et** une fin d'année (→ 2027-01-04) |
| **PC-32** | Mois : `→` avance d'**un mois** |
| **PC-33** | Année : `→` avance d'**un an** |
| **PC-34** | « Aujourd'hui » ramène l'ancre au jour courant **sans quitter l'onglet** |

## 11. Nettoyage visuel — le diagnostic des « bandes bleues »

Mesure sur la ligne d'une tâche fraîchement créée, sans lot, chevauchant la colonne du jour :

| | V2.8.5 | V2.8.5.1 |
|---|---|---|
| fond de la barre « à faire » | `rgb(237, 244, 255)` | `rgb(255, 255, 255)` |
| fond de la colonne AUJOURD'HUI | `rgb(241, 246, 255)` | `rgb(241, 246, 255)` |
| **écart** | **4/2/0 — 1,92 %** | **14/9/0 — 8,15 %** |

**La cause.** `--accent-soft` (le fond de la barre « à faire ») était à **4 points de rouge**
de la teinte de la colonne AUJOURD'HUI. La barre disparaissait dans la colonne et il ne
restait d'elle que son **liseré**, lu comme une seconde ligne bleue verticale juste à côté
du repère du jour — deux traits bleus à 10 px l'un de l'autre. Pire : l'aperçu de sélection
du dessin (`color-mix(accent 18%)` + trait **plein**) avait exactement la même apparence, si
bien qu'une tâche fraîchement créée se lisait comme *un aperçu resté à l'écran*.

**Les deux corrections :**
1. la barre « à faire » reçoit un fond **opaque** — elle se lit comme un objet sur n'importe
   quelle colonne, aujourd'hui, week-end ou férié ;
2. l'aperçu de sélection passe en **tirets** — trait discontinu = sélection en cours, trait
   plein = objet réel. Les deux ne peuvent plus être confondus.

**Ce qui n'a PAS changé :** le repère AUJOURD'HUI (`border-left: 2px solid var(--accent)`,
en-tête **et** créneaux) est intact (**PC-53**), et une tâche sans lot ne reçoit **aucune**
pastille de couleur (**PC-54**). `closeOverlay('drawer')` purge en plus l'accusé de réception
et tout geste de dessin en cours : **PC-52** mesure `0` aperçu, `0` sélection, `0` survol.

## 12. Création à la souris

Le geste de V2.8.5 est intact. **PC-51** : pendant le mouvement, l'aperçu s'affiche,
**aucune** alerte n'apparaît, `app.tasks` et `undoHistory` sont inchangés. L'avertissement
arrive **à la validation** du formulaire, comme pour tout autre chemin.

---

## Recette dédiée

`recette-planning-calendrier-realite-v2.8.5.1.mjs` — **75 / 75 PASS**, **0 erreur console
applicative**, PC-01 → PC-60 plus `FREEZE-2851`, `MOBILE` et `CAPTURES`.

| Section | Identifiants |
|---|---|
| Moteur calendaire | PC-01 → PC-14 |
| Confirmation à la création | PC-15 → PC-22 |
| Déplacement | PC-23 → PC-25 |
| Identification visuelle | PC-26 → PC-28 |
| Navigation Opération | PC-29 → PC-34 |
| Démarrage réel | PC-35 → PC-49 |
| Souris et nettoyage visuel | PC-50 → PC-54 |
| Non-régression | PC-55 → PC-59 |
| Console | PC-60 |
| Byte-identité et périmètre | FREEZE-2851 |

`FREEZE-2851` vérifie que **67 moteurs de V2.8.5 sont byte-identiques** — Undo/Redo complet,
`planReflow`/`applyReflowPlan`, glisser-déposer HTML5, `drawDeps`, `scale()`, `pos()`,
`planningTasks()`, la Qualité, les Ressources, les Jalons, le Backup et le Mode Chantier —
et que **STORE** (`kanvix-product-8-3`) et **SCHEMA_VERSION** (**12**) sont inchangés :
aucune nouvelle donnée persistante, aucune migration.

### Trois défauts de sonde corrigés avant de conclure

1. **PC-23** testait `dropTask → requestTaskScheduleMove`. La chaîne réelle compte **deux**
   maillons : `dropTask → requestGanttTaskMove → requestTaskScheduleMove`.
2. **PC-59** ouvrait le Mode Chantier par `go('field')`. Le bon point d'entrée est
   `enterFieldMode()` — `go()` change la page sans basculer `driverMode`.
3. **FREEZE-2851** figeait `openTaskForm`, que le §17 demande précisément de modifier ; et
   son extracteur coupait sur les paramètres par défaut (voir §1).

---

## Rejeu des recettes historiques — **à lire**

**47 recettes rejouées**, chacune sur V2.8.5 **puis** sur V2.8.5.1, verdict par verdict.
**Aucune recette historique n'a été modifiée** : chaque copie de travail vit hors du dépôt
et ne change qu'une constante — le fichier ciblé. `git status` confirme **0 fichier suivi
modifié** pendant tout le balayage.

**Résultat : 66 nouveaux échecs, répartis sur 22 des 47 recettes**, plus un plantage de
sonde (`recette-historique-metier-v2.4.13`, même cause).

### Preuve de causalité unique

Plutôt que de raisonner, j'ai construit un **build de diagnostic** — une copie de V2.8.5.1
dont `calendarConfirm` confirme automatiquement — et rejoué les 47 recettes dessus. Ce build
a servi au diagnostic puis a été **supprimé** ; il n'est pas livré.

| | nombre |
|---|---|
| nouveaux échecs sur V2.8.5.1 | **66** |
| …qui **disparaissent** quand la confirmation est acceptée automatiquement | **49** |
| …qui **subsistent** | **17** |

Les **49** ne sont donc causés **que** par l'étape de confirmation : la recette appelle
`setTaskStatus(…, 'doing')`, la modale attend, et la recette teste un état qui n'est pas
encore advenu. Aucune autre cause n'est à l'œuvre.

### Les 17 échecs résiduels

| Nature | Nombre | Détail |
|---|---|---|
| **Byte-identité** d'une fonction que le cahier des charges demande de modifier | **11** | `requestTaskScheduleMove` ×5, `gantt` ×2, `setTaskStatus` ×2, `renderPlanning` ×1, `FREEZE-285` ×1 |
| **« le drag Kanban change le statut SANS toucher aux dates »** | **4** | `PLAN-F` ×3, `P8` ×1 |
| Conséquences de l'enrichissement de l'historique | **2** | `ORDRE`, `RESPONSIVE` (l'entrée porte désormais les dates) |

### Le point qui mérite votre arbitrage

Les **4** résiduels de la deuxième ligne, et une grande partie des **49**, disent tous la
même chose : **un démarrage ne change plus seulement le statut, il repositionne les dates.**

C'est exactement ce que demande le §7 — « elle est *En cours* mais n'apparaît pas dans le
Planning du jour. C'est incohérent. » — et le §8 impose que les quatre chemins (fiche,
Kanban, Mode Chantier, éditeur) partagent la même logique. Le contrat historique
« drag Kanban = statut seul » est donc **objectivement rendu obsolète par le comportement
explicitement demandé ici**, au sens de votre §23.

Je n'ai **pas** touché à ces assertions. Les réécrire demanderait de modifier une vingtaine
de recettes historiques et leur ferait perdre leur valeur de détecteur pour les prochaines
versions. **Deux options s'offrent à vous** :

1. **Re-baseliner** les recettes concernées sur le nouveau contrat (travail identifié :
   22 recettes, ~50 assertions) ;
2. **Restreindre** le repositionnement à certains chemins — mais cela contredirait le §8
   (« Ne pas créer quatre logiques différentes ») et le §11.

Je recommande la première. Le choix vous revient : je ne l'ai pas fait à votre place.

### Deux régressions de MON fait, corrigées

Le diagnostic a isolé deux écarts qui n'étaient **pas** dus au comportement demandé, mais à
mon implémentation. Les deux sont corrigés :

1. le toast disait « Tâche démarrée » lors d'un réalignement, ce qui écrasait le contrat
   V2.4.15.4 (« un dépôt Kanban nomme la colonne cible, toutes les autres origines gardent
   le message générique »). Le libellé d'origine est **rétabli mot pour mot** — V2.8.5.1 ne
   touche à aucun retour utilisateur ;
2. la garde de démarrage réel se trouvait **après** la matérialisation des contrôles
   qualité : refuser la confirmation laissait un contrôle créé. Elle est désormais posée
   avant tout effet de bord (**PC-35**).

### Erreurs console

**Identiques** dans les deux balayages : aucune nouvelle.

---

## Captures — `recette-v2.8.5.1/`

**Dix largeurs** : 1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390. Aucune ne produit
de débordement horizontal.

| Fichier | Contenu |
|---|---|
| `w{L}-01-planning-semaine-clair.png` | Planning Semaine, thème clair, samedi + dimanche visibles — **10 largeurs** |
| `w{L}-02-planning-semaine-sombre.png` | idem, thème sombre — **10 largeurs** |
| `03-planning-jour-ferie.png` | semaine du 10 août 2026 — « sam. 15 / FÉRIÉ » (Assomption) |
| `04-modale-jour-non-ouvre.png` | confirmation « Planification sur un jour non ouvré » |
| `05-operation-semaine-N.png` | Planning d'Opération, semaine N |
| `06-operation-semaine-N1.png` | semaine N+1, après `→` |
| `07-demarrage-avant-confirmation.png` | « Démarrer cette tâche maintenant ? » |
| `08-planning-jour-apres-demarrage.png` | Planning Jour, la tâche réalignée y est présente |
| `09-planning-apres-creation-souris.png` | après création à la souris, sans bande bleue parasite |
| `w430-10 / w390-10-mobile-planning.png` | Planning mobile |
| `w430-11 / w390-11-mobile-confirmation.png` | confirmation mobile — 402 px pour 430, 362 px pour 390, boutons ≥ 38 px |
| `12-undo-redo-apres-demarrage.png` | Undo/Redo après un démarrage réel |

---

## Limites résiduelles, assumées

1. **Jours fériés** : France métropolitaine uniquement. Alsace-Moselle, territoires
   d'outre-mer et conventions collectives sont hors périmètre, comme demandé.
2. **Vue Année** : aucun marquage calendaire — une colonne est un mois entier.
3. **Texte d'historique** : l'entrée conserve son libellé existant (« statut modifié
   manuellement : À faire → En cours »). Ce sont les `changes` structurés qui portent les
   dates. Réécrire le libellé aurait cassé les recettes d'historique sans rien apporter au
   fond.
4. **Retour de `setTaskStatus`** : quand une confirmation s'ouvre, la fonction rend la main
   sans valeur — la transition n'a pas encore eu lieu. Un appelant qui attend un `outcome`
   doit le lire après confirmation. Une assertion de V2.7.1 s'appuyait sur ce retour.
5. **Re-baseline des recettes historiques** : non fait, volontairement — voir ci-dessus.
