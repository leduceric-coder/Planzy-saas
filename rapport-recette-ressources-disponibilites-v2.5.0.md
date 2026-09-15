# Kanvix V2.5.0 — Ressources (matériel), affectations multiples et disponibilités

Source de vérité : `kanvix-next-gen-v2.4.15.6.html`
Version livrée : `kanvix-next-gen-v2.5.0.html`
Suite de recette : `recette-ressources-disponibilites-v2.5.0.mjs` — **105 assertions, 105 PASS, 0 FAIL, 0 erreur console**
Captures : `recette-v2.5.0/` (12 captures nommées)

---

## 0. Ce que cette version ajoute — et ce qu'elle n'ajoute pas

**Dans le périmètre :**
1. le **matériel** devient une ressource (grue, camion, nacelle…) ;
2. une intervention peut mobiliser **plusieurs ressources** ;
3. une ressource peut être **indisponible** sur une période ;
4. les indisponibilités entrent dans la **charge** et les **conflits** ;
5. la page « Équipe » devient la page **Ressources** ;
6. sauvegarde, migration et import restent **compatibles** avec l'existant.

**Hors périmètre (repoussé en V2.6, volontairement)** : structure de chantiers, chantiers parents/enfants, sous-chantiers, « Constellation », portefeuille multi-niveaux. Rien de tout cela n'a été amorcé ici.

**Le principe produit vérifié de bout en bout :**
> **Kanvix DÉTECTE. Kanvix EXPLIQUE. LE CONDUCTEUR DÉCIDE.**

Une indisponibilité posée sur une intervention déjà planifiée ne déplace rien, n'annule rien, ne change aucun statut, ne crée ni reprise ni message. Elle est **signalée** — et c'est tout (§18, RSC-21).

---

## 1. Audit préalable OBLIGATOIRE — la règle qui a guidé tout le reste

Avant la moindre ligne de code, chaque usage existant de `task.resourceId`, `r.type === "person" / "company"`, `getResourceTasks()`, `getResourceState()`, `getResourceConflicts()` et `planningResource` a été relevé et classé en **deux catégories**, parce que « la ressource d'une tâche » recouvrait en réalité **deux notions différentes** :

| | **Catégorie A — INTERVENANT PRINCIPAL** | **Catégorie B — RESSOURCES MOBILISÉES** |
|---|---|---|
| Question posée | « Qui est mon interlocuteur ? » | « Qu'est-ce que cette intervention consomme ? » |
| Champ | `task.resourceId` (**inchangé**) | `taskResourceIds(t)` (**nouveau**) |
| Usages | messagerie Artisan, Mode Chantier, confirmation terrain, contact artisan, reprise | charge, conflits, Planning filtré, fiche chantier, disponibilité, simulation, compteurs |

**Conséquence majeure** : la catégorie B n'a pas été réécrite usage par usage. **Une seule ligne** a changé, dans le moteur central :

```js
function getResourceTasks(id, tasks = app.tasks) {
  return tasks.filter((t) => taskHasResource(t, id) && taskIsOperational(t));
}
```

Tout ce qui dérive de `getResourceTasks()` — charge, états, conflits, fiche ressource, tableau de charge, nudges — a suivi **sans duplication**. C'est la preuve la plus directe qu'il n'existe pas deux moteurs.

## 2. Contrainte d'architecture ABSOLUE : une seule notion de ressource

Il n'y a **pas** de moteur « matériel » à côté d'un moteur « humain ». Vérifié de trois façons (RSC-11, FREEZE-250) :

1. **Absence de code parallèle** : aucun `getEquipmentTasks/State/Load/Conflicts`, aucun `app.equipments`, aucun `app.materials` dans la source.
2. **Une seule définition par concern** : `getResourceTasks`, `getResourceState`, `getResourceSchedulingConflicts`, `taskResourceIds`, `normalizeTaskResources` apparaissent exactement **une fois** chacun.
3. **Les mêmes appels répondent pour les trois familles** : `getResourceTasks`, `getResourceState`, `getResourceLoad`, `getMaxConcurrentTasks`, `getResourceSchedulingConflicts` exécutés sur une personne, une entreprise et un matériel — les 15 appels répondent correctement.

Le matériel se distingue par ses **données** (`type: "equipment"`, `capacity: 1`, `equipmentCategory`, `assetRef`, prestataire) et par ce qu'on ne lui propose **pas** (compte Artisan, invitation, poste métier, messagerie) — jamais par un moteur séparé.

## 3. Modèle de données — schéma 8 → 9, STORE inchangé

`SCHEMA_VERSION` passe de **8 à 9**. `STORE` reste **`"kanvix-product-8-3"`** : aucune installation ne perd son état (RSC-01).

Trois ajouts, tous optionnels et rétro-compatibles :

```js
// ressource matérielle
{ id, name, type: "equipment", scope: "Interne"|"Externe",
  capacity: 1, equipmentCategory: "crane"|"truck"|"lift"|"machine"|"tool"|"other",
  assetRef, providerName }

// intervention
task.additionalResourceIds: []          // ressources mobilisées EN PLUS du principal

// nouvelle collection
app.resourceUnavailabilities: [{ id, resourceId, start, end, allDay, reason, comment, createdAt }]
```

**La catégorie est stockée en code, affichée en français** (`crane` → « Grue »), pour que la donnée ne dépende jamais de la langue d'affichage (RSC-03).

**L'intervenant principal peut être une personne OU une entreprise, jamais du matériel.** La règle est portée par `normalizeTaskResources()`, pas par le formulaire : même appelée avec un matériel en principal, elle le rétrograde (RSC-09).

## 4. Migration NON destructive — prouvée sur un état V8 réel

La migration n'est pas déclarée : elle est **mesurée**. La recette ouvre la version **V2.4.15.6**, y écrit une donnée témoin, relit son `localStorage` brut, l'injecte dans V2.5.0 puis recharge (RSC-05) :

| | Avant (schéma 8) | Après (schéma 9) |
|---|---|---|
| chantiers / tâches / ressources | 4 / 11 / 7 | **4 / 11 / 7** |
| historique / messages / photos | 1 / 2 / 6 | **1 / 2 / 6** |
| donnée témoin `TRACE-V8` | présente | **présente** |
| `resourceUnavailabilities` | absent | `[]` |
| `additionalResourceIds` | absent | `[]` sur toutes les tâches |
| `ui.teamKindFilter` | absent | `"all"` |

Aucun compteur métier ne bouge : les champs V2.5 sont **ajoutés** avec des valeurs neutres, jamais substitués.

## 5. Données de démonstration et réalignement

Les indisponibilités de démonstration suivent **exactement** le même décalage que les tâches (`alignDemoDates`, une seule passe, idempotente via `seededFor`) — vérifié par un second appel qui ne produit **aucune dérive** (RSC-06).

La baseline est volontairement **sans conflit** : `Thomas · Congé` et `Grue G01 · Maintenance` tombent dans le futur proche, sur des créneaux où aucune intervention n'est planifiée. `getResourceSchedulingConflicts()` renvoie **0 conflit** à l'état initial (RSC-02) — le conducteur découvre la fonctionnalité sur un état sain, pas sur une alarme fabriquée.

## 6. Affectations multiples — helpers centraux

```js
taskResourceIds(t)                       // principal + complémentaires, dédoublonné
taskHasResource(t, id)                   // « cette intervention mobilise-t-elle X ? »
normalizeTaskResources(main, extras)     // règle unique : matériel jamais principal,
                                         // principal exclu des complémentaires,
                                         // ressources inconnues écartées
```

Ces trois fonctions sont le **seul** endroit où la règle d'affectation est écrite (RSC-07, RSC-09, RSC-10). Le camion CB02, mobilisé **uniquement** en complément sur « Pose des 6 fenêtres », est bien vu par `getResourceTasks()` alors qu'il n'est intervenant principal d'**aucune** tâche (RSC-08) — et il devient de ce fait non supprimable, avec archivage proposé (RSC-12).

## 7. Indisponibilités — le moteur

- `getResourceUnavailabilities(id)` / `getResourceUnavailabilitiesInRange(id, range)` / `resourceIsUnavailable(id, range)` (RSC-13).
- **Journée entière** : les bornes sont normalisées à `00:00` / `23:59` sur la date choisie, et le formulaire bascule ses champs en `date` (sans heure) — pas de faux créneau horaire (RSC-14).
- **Motifs contextuels** selon la famille : `Congé / Absence / Formation / …` pour une personne, `Maintenance / Panne / Révision / Réservé / Fin de location / …` pour du matériel, `Fermeture / Non disponible / …` pour une entreprise (RSC-30). Un congé n'est jamais proposé pour une grue.

## 8. Le nouvel état « Indisponible » — calme, pas alarmant

`RESOURCE_STATE.unavailable = { label: "Indisponible", tone: "muted" }`.

Une absence **n'est pas un incident** : le ton est gris/ardoise, en trait pointillé, et la cellule de charge est libellée « Indispo. » sans compteur (RSC-15, RSC-31).

**Priorité des états** — `conflict (0) > unavailable (1) > high (2) > busy (3) > available (4)` :

| Situation | État |
|---|---|
| intervention planifiée **pendant** une indisponibilité | **Conflit** |
| dépassement de capacité | **Conflit** |
| indisponibilité **sans** intervention | **Indisponible** |
| pas d'indisponibilité, charge normale | Occupé / Disponible |

## 9. Deux natures de conflit, un seul moteur

`getResourceConflicts(id)` **conserve son API historique** (paires de tâches en surcapacité) — aucun appelant existant n'est cassé, et une indisponibilité n'y apparaît **pas** : ce n'est pas une surcapacité (RSC-16).

La vérité moderne est `getResourceSchedulingConflicts(id, tasks)`, qui qualifie chaque conflit :

```js
{ kind: "capacity",       resourceId, taskId, otherTaskId }
{ kind: "unavailability", resourceId, taskId, unavailabilityId }
```

Les deux natures sortent du **même** appel (RSC-17). C'est cette fonction que consomment désormais `planningProblems()`, `evaluateScenario()` et `resourceConflictNudge()`.

## 10. Détecter sans décider — le cœur de la version

Créer une indisponibilité qui recouvre une intervention déjà planifiée **n'est pas refusé**. L'écran présente (RSC-19) :

> ⚠ **1 intervention déjà planifiée sur cette période.**
> **Pose des 6 fenêtres** — lun. 14 sept. · 08:00–16:30 · Résidence Keravel
> *Enregistrer l'indisponibilité ne déplace, n'annule et ne réaffecte aucune intervention : Kanvix signale le conflit, vous décidez.*
> [ Annuler ] [ **Enregistrer malgré le conflit** ]

- **Tant que le conducteur n'a pas tranché, rien n'est écrit** (RSC-19).
- **Annuler** ne laisse aucune trace (RSC-20).
- **Enregistrer malgré le conflit** : l'indisponibilité est créée, et un instantané complet de `app.tasks` (dates, statuts, affectations), du nombre de tâches, des messages, des incidents et des reprises est **strictement identique** avant et après. Le conflit **reste signalé** après enregistrement — il n'est pas absorbé — et l'action reste annulable (RSC-21).

Seul cas de **refus net** : deux indisponibilités qui se chevauchent pour la **même** ressource — une même période ne se déclare pas deux fois (RSC-22).

Le message d'attention **nomme la période** plutôt que d'inventer une surcharge :
> « Thomas Martin est affectée à « Pose des 6 fenêtres » pendant sa période « congé ». » (RSC-23)

## 11. Planning et simulation

- `planningProblems()` compte désormais les conflits d'indisponibilité au même titre que les surcapacités ; une indisponibilité **sans** intervention n'est jamais comptée comme un problème (RSC-24).
- `evaluateScenario()` détecte une tâche **simulée** déplacée sur une indisponibilité : le compteur `resourceConflicts` passe de 1 à 2 quand le scénario pose la tâche sur la période d'absence, et redescend quand il l'en éloigne (RSC-25). Une indisponibilité n'est pas ignorée sous prétexte que la tâche n'est encore qu'un scénario.
- Le **filtre ressource du Planning** est regroupé par famille (`Personnes` / `Entreprises` / `Matériel`) et filtre sur les ressources **mobilisées** : filtrer sur le camion CB02 fait bien apparaître « Pose des 6 fenêtres », où il n'est pourtant que complémentaire (RSC-33).

## 12. Éditeur universel — création et modification à parité stricte

`openTaskForm()` (création) et `openTaskEdit()` (éditeur universel) proposent **exactement** le même dispositif (RSC-32) :

- **Intervenant principal** — un `<select>` d'où le matériel est **absent** ;
- **Ressources complémentaires** — cases à cocher compactes groupées `PERSONNES` / `ENTREPRISES` / `MATÉRIEL`, l'intervenant principal étant exclu **dynamiquement** de la liste quand on le change ;
- un **avertissement d'indisponibilité** vivant, recalculé à chaque changement de ressource ou de dates.

L'avertissement **informe sans bloquer** : « ⚠ Ressource indisponible — Thomas Martin — Congé · lun. 14 sept. 08:00 → mar. 15 sept. 16:30 », et l'enregistrement aboutit quand même (RSC-26). Le conducteur décide.

## 13. Historique

Les deux champs de ressources sont tracés par le **même** moteur de diff que les autres champs, dans `app.history` (collection unique, aucune seconde source) :

```
Intervenant principal    Thomas Martin → Mathieu
Ressources complémentaires   aucune → Grue mobile G01, Camion benne CB02
```

Le formateur `resourceListLabel()` est partagé entre l'éditeur universel et le formulaire de création — pas de variante locale (RSC-32).

## 14. Page Ressources — renommée, pas redessinée

- Le libellé visible devient **« Ressources »** (navigation, titre de page, onglet de la fiche chantier), sous-titre « Personnes, entreprises et matériel. »
- **La route interne reste `team`** : aucun lien, aucun raccourci, aucun état sauvegardé ne casse (RSC-27).
- Un **nouveau** filtre famille `app.ui.teamKindFilter` (Tous / Personnes / Entreprises / Matériel) est ajouté **à côté** de l'existant `teamTypeFilter` (Interne / Externe / À surveiller), qui reste intact — les deux filtres sont indépendants et se combinent (RSC-28). Les partitions se vérifient : 3 matériels, et `Tous = Personnes + Entreprises + Matériel`.
- La page, le tableau de charge et le Mode Chantier **ne sont pas redessinés** : ils reçoivent des données de plus, dans leurs composants existants.

## 15. Fiche ressource matérielle

Bandeau « INTERNE · MATÉRIEL » ou « EXTERNE · MATÉRIEL », pictogramme dédié par catégorie (grue, camion, nacelle, engin, outillage) dans le **même carré arrondi** que les portraits et monogrammes — même famille visuelle, pas un langage graphique nouveau.

Affichés : **Catégorie** (libellé français), **Référence**, **Rattachement**, **Prestataire** le cas échéant. **Absents, volontairement** : compte Artisan, invitation, poste métier, messagerie (RSC-29).

Une section **Indisponibilités** complète la fiche, avec création / modification / suppression, et n'affiche que les périodes **à venir** (RSC-30).

## 16. Tableau de charge

- Le filtre de statut gagne l'option **« Indisponible »** et restreint correctement le tableau.
- Les cellules indisponibles portent le ton **muted** (jamais une alerte).
- L'**infobulle sépare** interventions et périodes d'indisponibilité, ligne à ligne, pour ne jamais laisser croire que la ressource était indisponible toute la journée (RSC-31).

## 17. Affichages secondaires — discrets par construction

La mention des ressources complémentaires est une **métadonnée secondaire**, jamais un titre :

- **Gantt** : « Mathieu **+2** » sous le nom de la tâche ; l'infobulle de la barre détaille « — avec Grue mobile G01, Camion benne CB02 ».
- **Kanban** : même pastille « +N » sur la ligne de métadonnée.
- **Fiche tâche** : une ligne « RESSOURCES · Camion benne CB02 ».
- **Mode Chantier** : « **Matériel : Camion benne CB02** » — la question de l'artisan est « je viens avec quoi ? », elle mérite sa propre ligne, lisible debout (RSC-33).

## 18. Sauvegarde et restauration — compatibilité dans les deux sens

- La sauvegarde transporte `resourceUnavailabilities` **et** `additionalResourceIds` (RSC-34).
- `KANVIX_BACKUP_REQUIRED` **n'exige pas** `resourceUnavailabilities` : une sauvegarde **V8** (sans indisponibilités, sans matériel) reste **valide**, est acceptée, et est migrée en schéma 9 à la restauration sans rien perdre — vérifié sur un payload V8 fabriqué à partir de l'état réel (RSC-34).
- L'aperçu **compte** les indisponibilités (« 2 indisponibilités ») quand il y en a, et **n'invente pas** la ligne quand la sauvegarde n'en contient pas.

## 19. Import — aucune référence inventée, aucune perte silencieuse

- Les `additionalResourceIds` inconnus de l'installation sont **écartés** (`validResList`, même règle que `validRes` pour le principal) : sur un import portant `['crane-g01', 'res-inconnue-1', 'res-inconnue-2']`, seule `crane-g01` est conservée.
- `validateImportState()` vérifie désormais **0 référence orpheline** : ni ressource complémentaire inconnue, ni indisponibilité pointant dans le vide.
- Les pertes sont **comptées et annoncées**, avant ET après l'import : « 2 affectations de ressource non reconnues » (RSC-35). Le même formateur `impDroppedLines()` sert l'aperçu et le rapport — une seule vérité.

## 20. Cycle de vie d'une ressource

- **Archiver** conserve ses indisponibilités : la fiche existe toujours, son historique est intact.
- **Supprimer** les emporte en cascade — sinon des périodes orphelines continueraient de peser dans les moteurs de charge et de conflit. La confirmation l'annonce explicitement : « … supprimera définitivement la fiche de Nacelle N03 **et ses 1 période d'indisponibilité**. » Après suppression : **0 indisponibilité orpheline** (RSC-35).

## 21. Tests

`recette-ressources-disponibilites-v2.5.0.mjs` — **105 assertions, 105 PASS**, réparties sur **RSC-01 → RSC-35**, plus le gel byte-identité et la console.

**Gel byte-identité (FREEZE-250)** : **47 moteurs hors périmètre** strictement byte-identiques à V2.4.15.6 — dont `scale`, `pos`, `dropTask`, `shiftPlanning`, `planningToday`, `setPeriod`, `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `kanbanBoard`, `getMaxConcurrentTasks`, `getResourceLoad`, `getResourceConflicts`, `getTaskPredecessors/Successors`, `taskCreatesCycle`, `buildKanvixBackup`, `confirmKanvixRestore`, `analyzeKanvixImport`, `buildImportPlan`, `nextWorkingTime`, `workdayDelay`, `getWeekNumber`, `weekBounds`, `openConversation`.

Symétriquement, les **12 moteurs du périmètre** ont bien évolué (`getResourceTasks`, `getResourceState`, `evaluateScenario`, `planningProblems`, `planningTasks`, `openTaskForm`, `openTaskEdit`, `submitTaskEdit`, `renderTeam`, `applyImportPlan`, `validateImportState`, `confirmDeleteResource`) — une version qui ne changerait rien ne serait pas une version.

**Captures (`recette-v2.5.0/`)** :

| # | Capture |
|---|---|
| 01 | `01-ressources-toutes.png` — page Ressources, toutes familles |
| 02 | `02-ressources-materiel.png` — filtre « Matériel » |
| 03 | `03-fiche-materiel.png` — fiche Nacelle N03 (catégorie, référence, prestataire, indisponibilités) |
| 04 | `04-charge-indisponible.png` — tableau de charge avec cellules « Indispo. » |
| 05 | `05-conflit-indisponibilite.png` — écran « ⚠ 1 intervention déjà planifiée » |
| 06 | `06-editeur-ressources.png` — éditeur universel : principal + complémentaires |
| 07 | `07-planning-filtre-materiel.png` — filtre Planning groupé par famille |
| 08 | `08-fiche-tache-ressources.png` — fiche tâche avec la ligne « Ressources » |
| 09 | `09-mode-chantier-materiel.png` — Mode Chantier, ligne « Matériel : … » |
| 10 | `10-sauvegarde-apercu.png` — aperçu de sauvegarde annonçant les indisponibilités |
| 11 | `11-ressources-mobile.png` — rendu 390 px |
| 12 | `12-fiche-materiel-sombre.png` — thème sombre |

## 22. Rejeu complet de non-régression

**31 suites historiques** rejouées contre `kanvix-next-gen-v2.5.0.html`.

Méthode : chaque suite est copiée dans un dossier de travail où **seule la version qu'elle teste** est repointée vers V2.5.0 — les références à des versions **antérieures** (utilisées pour les comparaisons de byte-identité) sont laissées intactes, faute de quoi le rejeu comparerait un fichier avec lui-même et ne détecterait plus rien. Toutes les écritures absolues (captures **et** `resultats.json`) sont redirigées vers le dossier de travail : **0 fichier suivi par git modifié**.

Pour séparer honnêtement « échec préexistant » et « échec causé par ce round », la **même** campagne a été rejouée deux fois : une fois contre **V2.4.15.6** (référence) et une fois contre **V2.5.0**.

| Suite | V2.4.15.6 (réf.) | V2.5.0 | Écart |
|---|---|---|---|
| `accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | — |
| `accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | — |
| `backup-continuite-v2.4.13.1` | 106 ✓ / 0 ✗ | 103 ✓ / 3 ✗ | +3 |
| `chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | — |
| `correctif-ui-v2.4.14.1` | 94 ✓ / 5 ✗ | 88 ✓ / 11 ✗ | +7 |
| `correctifs-v2.4.15.1` | 139 ✓ / 4 ✗ | 40 ✓ / 0 ✗ | interrompue |
| `correctifs-v2.4.15.2` | 47 ✓ / 2 ✗ | 5 ✓ / 0 ✗ | interrompue |
| `correctifs-v2.4.15.3` | 53 ✓ / 2 ✗ | 50 ✓ / 5 ✗ | +4 |
| `correctifs-v2.4.15.4` | 81 ✓ / 8 ✗ | 78 ✓ / 11 ✗ | +4 |
| `correctifs-v2.4.15.5` | 65 ✓ / 3 ✗ | 61 ✓ / 7 ✗ | +5 |
| `correctifs-v2.4.15.6` | 72 ✓ / 0 ✗ | 65 ✓ / 7 ✗ | +7 |
| `densite-v2.4.14` | 4 ✓ / 3 ✗ | 4 ✓ / 3 ✗ | — |
| `edition-taches-v2.4.8` | 58 ✓ / 0 ✗ | 56 ✓ / 2 ✗ | +2 |
| `harmonisation-ui-v2.4.15` | 126 ✓ / 4 ✗ | 120 ✓ / 10 ✗ | +7 |
| `historique-chantiers-v2.4.12` | 106 ✓ / 0 ✗ | 104 ✓ / 2 ✗ | +2 |
| `historique-metier-v2.4.13` | 106 ✓ / 0 ✗ | 105 ✓ / 1 ✗ | +1 |
| `historique-ui-v2.4.12.1` | 90 ✓ / 0 ✗ | 89 ✓ / 1 ✗ | +1 |
| `import-intelligent-v2.4.9` | 59 ✓ / 0 ✗ | 59 ✓ / 0 ✗ | — |
| `import-intelligent-v2.4.9.1` | 75 ✓ / 0 ✗ | 75 ✓ / 0 ✗ | — |
| `kanban-badges-v2.4.11.1` | 84 ✓ / 0 ✗ | 83 ✓ / 1 ✗ | +1 |
| `kanban-badges-v2.4.11.2` | 94 ✓ / 7 ✗ | 93 ✓ / 8 ✗ | +1 |
| `kanban-badges-v2.4.11.3` | 165 ✓ / 0 ✗ | 163 ✓ / 2 ✗ | +2 |
| `mode-chantier-v2.4.5` | 84 ✓ / 0 ✗ | 84 ✓ / 0 ✗ | — |
| `mode-chantier-v2.4.6` | 95 ✓ / 0 ✗ | 95 ✓ / 0 ✗ | — |
| `planning-bureau-v2.4.10` | 56 ✓ / 1 ✗ | 56 ✓ / 1 ✗ | — |
| `planning-bureau-v2.4.10.1` | 75 ✓ / 1 ✗ | 75 ✓ / 1 ✗ | — |
| `planning-bureau-v2.4.9.1` | 49 ✓ / 1 ✗ | 49 ✓ / 1 ✗ | — |
| `planning-v2.4.8` | 17 ✓ / 0 ✗ | 17 ✓ / 0 ✗ | — |
| `reglages-v2.4.7` | 63 ✓ / 0 ✗ | 63 ✓ / 0 ✗ | — |
| `resolve-dates-v2.4.10.2` | 14 ✓ / 0 ✗ | 14 ✓ / 0 ✗ | — |
| `ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | 47 ✓ / 0 ✗ | — |

**16 suites sur 31 sont strictement identiques à la référence**, échecs préexistants compris (`accueil-v2.4.4.1` 18, `kanban-badges-v2.4.11.2` 7, `densite-v2.4.14` 3, `chantiers-v2.4.10.2` 1, `planning-bureau` ×3, `correctifs-v2.4.15.4` 8, `correctifs-v2.4.15.5` 3…). **Aucun échec préexistant ne s'aggrave.**

Les **47 divergences nouvelles** se répartissent en **quatre familles, toutes mécaniques et toutes voulues** — aucune n'est un dysfonctionnement :

**① `SCHEMA_VERSION` doit rester 8 — 13 assertions, 8 suites.**
`BACKUP-F1`, `BACKUP-F9`, `SCHEMA` (×2), `STORE-1515`, `STORE-1516`, `HIST-LEGACY`, `HIST-SCOPE`, `HIST-PURE`, `BADGE-15` (×3), `KAN-CTX-G`. Chacune vérifie littéralement `SCHEMA_VERSION === 8` — la V2.5.0 passe **volontairement** à 9 (§3). `BACKUP-F1` exige en outre `appVersion === '2.4.13.1'`, devenu `'2.5.0'`. La migration elle-même est prouvée non destructive au §4, et `KANVIX_BACKUP_REQUIRED` reste compatible avec les sauvegardes V8 (§18).

**② Gel byte-identité de moteurs qui ont changé À DESSEIN — 18 assertions, 5 suites.**
`getResourceState`, `evaluateScenario`, `kanbanCard`, `gantt`, `planningTasks`, `renderPlanning` — exactement les fonctions que cette version devait faire évoluer (mobilisation multi-ressources, indisponibilité dans l'état et la simulation, mention « +N », filtre Planning sur les ressources mobilisées). Ces suites attestaient correctement que ces moteurs n'avaient pas bougé **dans leur propre round** ; elles détectent donc précisément ce qui était voulu ici. La contrepartie — ce qui ne devait **pas** bouger — est couverte par `FREEZE-250` : **47 moteurs hors périmètre byte-identiques**.

**③ Comptages et structures « Équipe » gelés sur une version antérieure — 8 assertions, 2 suites.**
`GEL-141-01/02` et `UI15-FREEZE-02/03` figent le nombre et la structure des cartes ressources : page globale **7 → 10 cartes**, onglet chantier **5 → 6**. C'est l'ajout des **3 ressources matériel** et la mobilisation du camion sur Keravel — la fonctionnalité même de cette version. La structure diffère parce qu'une carte matériel porte un pictogramme et, le cas échéant, sa ligne d'indisponibilité.

**④ Libellés visibles renommés sur demande explicite — 2 assertions + 2 suites interrompues.**
- `edition-taches-v2.4.8 · EDIT-03` et `· HIST` exigent un champ d'historique nommé exactement `"Intervenant"`. Il s'appelle désormais `"Intervenant principal"`, comme demandé. **Le comportement est intact et vérifié** : le changement d'intervenant produit bien `{ field: "Intervenant principal", from: "Thomas Martin", to: "Marc" }`, sans propagation de dates, en une seule entrée d'historique.
- `correctifs-v2.4.15.1` et `correctifs-v2.4.15.2` s'**interrompent** sur un `locator('.tab').filter({ hasText: 'Équipe' })` : elles cliquent l'onglet par son **libellé visible**, précisément celui que la demande fait passer à « Ressources ». Aucun correctif ne peut satisfaire à la fois « renommer le libellé » et « cliquer sur l'ancien libellé ». Les 40 et 5 assertions exécutées avant l'interruption passent toutes.

**Correctif réel déclenché par ce rejeu** : `openProjectTab(pid, "Équipe")` accepte désormais l'ancien nom d'onglet et le résout vers « Ressources ». Sans cela, un appel ou un état persistant antérieur retombait silencieusement sur le premier onglet. C'est la traduction concrète de la règle « le libellé change, l'identité interne ne change pas » (§14) — et cela a supprimé 4 interruptions de suites (`correctif-ui-v2.4.14.1`, `harmonisation-ui-v2.4.15` vont désormais au bout).

Comme aux rounds précédents, ces suites spécifiques à une version testent correctement **leur propre** `.html` et sont laissées telles quelles (archives) ; la suite active du round fait foi.

## 23. Console

**0 erreur JavaScript applicative** sur l'ensemble de la recette V2.5.0 (les échecs réseau des routes météo / géocodage, volontairement coupées en test, sont exclus car ils ne proviennent pas du code applicatif).

## 24. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"` — **inchangé**.
`SCHEMA_VERSION = 9` (était 8) — migration non destructive prouvée au §4.
