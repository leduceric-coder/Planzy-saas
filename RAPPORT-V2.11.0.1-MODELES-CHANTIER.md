# Kanvix V2.11.0.1 — Correctif ciblé des modèles de chantier

## A. Source et livrable

| | |
|---|---|
| **Source** | `public/poc/kanvix-next-gen-v2.11.0.html` |
| **Livrable** | `public/poc/kanvix-next-gen-v2.11.0.1.html` — 30 095 lignes |
| **Recette dédiée** | `recette-modeles-chantier-v2.11.0.1.mjs` — **110 / 110**, **0 erreur console** |
| **Non-régression** | 55 recettes rejouées — **RESTE : 0** |
| **Captures** | `recette-v2.11.0.1/` (23 images) |

Correctif strict : les quatre écarts identifiés, rien d'autre. Aucune
unification des familles de modèles, aucune migration de `companyTemplates`,
aucun `PROJECT_TEMPLATES` supprimé, aucun wizard refait, aucun Planning,
Ressources, Undo/Redo ni import/export touché, aucune dette historique traitée.

---

## B. Fonctions réellement modifiées — neuf, mesurées

Le balayage de **tout** le fichier, comparé à V2.11.0, ne trouve **aucune**
autre fonction modifiée (FREEZE-21101) :

| Fonction | Motif |
|---|---|
| `cloneStructureTree` | §3 — les affectations suggérées, principal **et** complémentaires |
| `templateCaptureScope` | §2 — l'option `includeTasks` |
| `buildProjectTemplateRecord` | §2 + §3 |
| `saveProjectTemplateFrom` | §2 — transmission du choix |
| `templateCaptureCard` | §2.3 — l'aperçu suit le choix |
| `openTemplateSaveForm` | §2.1 — le bloc « Contenu du modèle » |
| `openTemplateInsert` | §3.5 vocabulaire + §8 modèle sans intervention |
| `migrateState` | §4 — normalisation du champ facultatif |
| `openProjectTemplatesManager` | §6 — le CTA direct |

Une fonction **ajoutée** (`templateSuggestedExtras`) et une autre
(`openProjectCreateFromTemplate`), toutes deux nouvelles — donc sans
équivalent à geler côté V2.11.0.

Le gel vérifie aussi l'inverse : les neuf fonctions annoncées ont **réellement**
changé. Aucune modification silencieusement absente.

---

## C. Correctif 1 — « Structure seule » / « Structure + interventions »

### L'écran

La side-window « Enregistrer comme modèle » porte un bloc **Contenu du
modèle**, avec la grammaire exacte de la duplication d'un niveau (V2.10.0) :
un `.snc-picks`, deux options contrastées, les mêmes valeurs internes
`structure` / `taches`. Aucun composant nouveau, aucun vocabulaire nouveau.

```
CONTENU DU MODÈLE
○ Structure seule
  Conserve les niveaux et leur hiérarchie, sans intervention.
● Structure + interventions
  Conserve aussi les interventions, leurs lots, leurs durées,
  leurs dépendances et les affectations suggérées.
```

**« Structure + interventions » est coché par défaut.** Qui ne touche à rien
retrouve exactement le comportement de V2.11.0 — FIXTPL-04 le prouve en
comparant l'appel *avec* l'option et l'appel *sans* : résultats identiques.

L'aperçu se met à jour au changement de radio (« 4 interventions » ⇄ « aucune
intervention ») **sans re-rendre l'application** : seule la carte concernée est
remplacée, et ce qui a déjà été saisi dans le formulaire survit — vérifié
(FIXTPL-02).

### Le moteur

L'option transite explicitement, sans qu'aucun périmètre soit dupliqué :

```
openTemplateSaveForm()  → includeTasks
  → saveProjectTemplateFrom()
    → buildProjectTemplateRecord()
      → templateCaptureScope(projectId, nodeId, { includeTasks })
```

`templateCaptureScope()` calcule la hiérarchie **exactement comme avant** et ne
retient simplement pas les interventions. Une seule vérité de périmètre.

| Portée | Structure seule | Structure + interventions |
|---|---|---|
| **Niveau** | descendance active, `tasks = []` | comportement V2.11.0 |
| **Chantier entier** | forêt active complète, `tasks = []`, **y compris zéro intervention sans structure** | comportement V2.11.0, interventions sans structure incluses |

FIXTPL-05 ne se contente pas de constater l'absence : il vérifie d'abord que
ces interventions sans structure **sont bien capturées** en mode complet
(2 d'entre elles), pour que leur absence en mode « Structure seule » ne puisse
pas être un faux positif.

### Utiliser un modèle sans intervention (§8)

La side-window « Utiliser le modèle » annonce « X niveaux · **aucune
intervention** », et **masque** le choix d'affectation **ainsi que la date de
démarrage** : ni l'un ni l'autre n'a d'objet. Un niveau n'a jamais porté de
date propre (règle de V2.9.0) — aucune date n'est donc inventée, ce que
FIXTPL-07 mesure explicitement.

La pose crée tous les niveaux et **zéro** tâche, sans erreur, sans fausse
intervention, sans conflit artificiel. Le toast dit « Modèle appliqué ·
3 niveaux, structure seule ».

---

## D. Format d'une intervention de modèle — onze champs → douze

```
id · structureNodeId · name · lotId · phase
offsetDays · durationDays · startTime · endTime
deps
suggestedResourceId
suggestedAdditionalResourceIds        ← V2.11.0.1
```

La capture reste une **liste blanche** : la recette épingle la liste **exacte**
des douze champs (TPL-15 re-pointée). Un treizième champ, quel qu'il soit, la
ferait tomber. Rien d'opérationnel n'y est entré — TPL-14 continue de refuser
nommément `status`, `resourceId`, `additionalResourceIds`, `reworkOfTaskId`,
`baselineStart/End`, `start`, `end`, `colorKey`, `projectId`.

---

## E. `suggestedAdditionalResourceIds` — une seule normalisation

`templateSuggestedExtras(t, principal)` est **la** règle, et la seule. Elle
sert à **trois** endroits — la capture, la migration, la pose :

- un tableau, toujours ;
- des identifiants non vides ;
- sans doublon ;
- **jamais l'intervenant principal** (une ressource ne peut pas être à la fois
  l'intervenant et son propre renfort) ;
- **aucune vérification d'existence ici** — un modèle reste réutilisable même
  si la ressource a disparu. C'est la pose qui tranche.

Mesuré sur une intervention volontairement sale
(`['crane-g01', 'coloris', 'crane-g01', 'mathieu', '', null]`, principal
`mathieu`) → `['crane-g01', 'coloris']`, **et la tâche source reste intacte**
(FIXTPL-10).

---

## F. Quand une ressource suggérée a disparu

| Choix | Intervenant principal | Ressources complémentaires |
|---|---|---|
| **Ne pas affecter** | `null` | `[]` |
| **Reprendre les affectations suggérées** | repris **si** `resource(id)` existe encore, sinon `null` | chacune reprise **si** elle existe encore ; dédoublonnées ; **jamais** le principal |

**Jamais de référence orpheline.** Personnes, entreprises et matériel suivent
la même règle — Kanvix ne fait aucune différence ici. Le matériel n'est
**jamais** promu intervenant principal : `resourceId` reste celui qui était
enregistré comme tel (FIXTPL-17, FIXTPL-18, mesurés sur les *types* réels
`equipment` et `company`).

Séquence mesurée (FIXTPL-13) : `coloris` disparaît → il reste `crane-g01`,
zéro orpheline ; puis `crane-g01` disparaît → `additionalResourceIds` vide,
`mathieu` toujours repris.

---

## G. Le compteur `ressourcesAbandonnees`

**Un seul compteur**, pas deux. Il compte toutes les suggestions **non
reposées** — principal et complémentaires confondus :

| Situation | Valeur |
|---|---|
| `suggest`, les 3 existent | **0** |
| `suggest`, 1 complémentaire disparue | **1** |
| `suggest`, 2 complémentaires disparues | **2** |
| `none` (principal + 2 compléments non affectés) | **3** |

La convention de V2.11.0 est **conservée** : en mode « Ne pas affecter », le
compteur dit ce que la pose n'a pas repris. Le correctif l'étend simplement aux
ressources complémentaires, comme demandé au §3.4.

---

## H. Compatibilité des modèles V2.11.0

Un modèle enregistré par V2.11.0 ne porte pas le champ. `migrateState()` le
normalise à `[]`, **sans toucher à quoi que ce soit d'autre** : nom, lot,
offsets, durée, dépendances et intervenant principal sont vérifiés intacts
(FIXTPL-19). La migration est **idempotente**.

Une valeur aberrante est normalisée de la même façon : `['a','a','',null,42,
'mathieu','b']` avec `suggestedResourceId: 'mathieu'` → `['a','b']`
(FIXTPL-20).

---

## I. `SCHEMA_VERSION` et `STORE`

**`SCHEMA_VERSION` reste 14.** Aucun bump n'est nécessaire, et en imposer un
serait inutilement coûteux :

- le champ ajouté est **strictement facultatif** ;
- son absence est **rétrocompatible** — elle ne change aucun comportement ;
- `migrateState()` le normalise à chaque chargement, sur un état neuf comme sur
  une sauvegarde ;
- c'est exactement la discipline déjà appliquée à `reworkOfTaskId` (v7) et à
  `additionalResourceIds` (v9), tous deux introduits sans bump.

Un bump aurait rendu **invalides** des sauvegardes V14 parfaitement lisibles,
pour aucun gain. FIXTPL-37 épingle `14` **des deux côtés** (V2.11.0 et
V2.11.0.1) : un bump futur non justifié ferait tomber l'assertion.

**`STORE` reste `kanvix-product-8-3`** (FIXTPL-36).

---

## J. Sauvegarde et restauration

- `projectTemplates` continue de voyager avec `buildKanvixBackup()`.
- Un modèle porteur de suggestions complémentaires est restitué **octet pour
  octet** (FIXTPL-21).
- Une sauvegarde **V14 produite par V2.11.0** — schéma 14, modèles présents,
  aucun `suggestedAdditionalResourceIds` — reste **valide** : elle se restaure,
  tous ses modèles sont normalisés à `[]`, aucun chantier n'est perdu
  (FIXTPL-22).
- Une sauvegarde plus ancienne, **sans** `projectTemplates`, fonctionne
  toujours (TPL-50, rejouée).
- `projectTemplates` n'est **toujours pas** dans `KANVIX_BACKUP_REQUIRED`.

---

## K. Undo / Redo

Aucun moteur touché, aucune pile ajoutée — vérifié par balayage
(`pasDePileUndoParallele`), et un seul `snapshot()` dans tout le fichier
(FIXTPL-34).

| Action | Snapshots |
|---|---|
| Enregistrer un modèle (structure seule **ou** complet) | **1** |
| Supprimer un modèle | **1** |
| Appliquer un modèle | **1** |
| Créer un chantier depuis un modèle (chantier + structure + interventions) | **1** |

La pose d'un modèle **structure seule** s'annule et se rétablit d'un seul geste
(FIXTPL-08, FIXTPL-09). Les suggestions de ressources ne créent **aucun**
snapshot supplémentaire : elles sont calculées à l'intérieur de la primitive,
avant le `push`.

---

## L. Correctif 3 — la troncature

### La cause, mesurée avant d'être corrigée

La side-window fait **432 px à toute largeur d'écran** — c'est une fenêtre
latérale, pas une colonne de page. Moins le padding, il reste 376 px ; les
trois boutons d'action en occupaient **229 px**, ne laissant que **67 px** au
nom. D'où « Étage t… » même en 1920 px.

Élargir la side-window aurait touché un composant partagé par tout le produit.
Réduire les boutons aurait rogné des cibles tactiles.

### La correction

Les actions reçoivent leur **propre rangée**, à toutes les largeurs
(`grid-template-columns: auto minmax(0, 1fr)`, actions en `grid-column: 2`).
Le nom dispose alors de **308 px**. L'ellipsis reste en place — elle ne se
déclenche simplement plus tant qu'il reste de la place.

| Largeur | Place pour le nom | « Étage type — logements » | « Maison individuelle — gros œuvre » |
|---|---|---|---|
| avant, 1366→1920 | 67 px | tronqué | tronqué |
| **après, 1366→1920** | **308 px** | **entier** | **entier** (228 px requis) |
| après, 430 / 390 / 360 | 266 px | entier | entier |

Aucune largeur de 1920 à 360 px ne provoque de défilement horizontal, et aucun
bouton d'action n'est coupé (FIXTPL-23, FIXTPL-24, FIXTPL-25 — onze largeurs
mesurées). En dessous de 620 px les boutons s'étalent pour rester de vraies
cibles tactiles.

---

## M. Correctif 4 — le CTA direct

`openProjectCreateFromTemplate()` enchaîne **les deux fonctions existantes** :

```js
openProjectCreate();              // le wizard, tel quel
wizardPickMode("project-template"); // le mode, tel quel
```

Une seule structure `app.ui.wizard`, un seul `renderWizard()`, un seul
`wizardPickMode()`, un seul `createProjectFromProjectTemplate()`. Aucun second
wizard.

Depuis Réglages → Modèles de chantier → « Créer un chantier depuis un modèle »,
l'utilisateur arrive **directement** sur la liste de `app.projectTemplates`
(étape `ptpl-select`, titre « Choisir un modèle »). L'écran « Comment
souhaitez-vous démarrer ? » n'est **pas** affiché — mesuré à zéro carte de
choix (FIXTPL-26, FIXTPL-27).

Le parcours **normal** conserve exactement ses cinq choix, dans le même ordre
(FIXTPL-28), et les deux familles historiques restent pleinement
fonctionnelles : « Second œuvre résidentiel » crée toujours ses 5 étapes
(FIXTPL-29), un modèle d'entreprise crée toujours ses tâches et ses
dépendances (FIXTPL-30).

---

## N. Recette dédiée — 110 / 110

`recette-modeles-chantier-v2.11.0.1.mjs` = **toute** la recette V2.11.0
(65 contrôles, aucun retiré) **plus** le bloc FIXTPL et le gel FREEZE-21101.

| Bloc | Contenu |
|---|---|
| TPL-01 → TPL-55, FREEZE-2110 | la recette V2.11.0 intégrale, rejouée contre le correctif |
| FIXTPL-01 → FIXTPL-09 | le choix de contenu : UI, défaut, aperçu vivant, capture niveau / chantier, pose, Undo, Redo, écran d'utilisation |
| FIXTPL-10 → FIXTPL-18 | capture des compléments, `none` / `suggest`, disparitions, compteur, pas de doublon, pas de principal en complément, matériel et entreprise |
| FIXTPL-19 → FIXTPL-22 | modèle V2.11.0, normalisation, idempotence, valeur aberrante, sauvegarde/restauration, sauvegarde V14 de V2.11.0 |
| FIXTPL-23 → FIXTPL-25 | la troncature, onze largeurs |
| FIXTPL-26 → FIXTPL-30 | le CTA direct, le parcours normal, les deux familles historiques |
| FIXTPL-31 → FIXTPL-37 | le gel architectural et les données |
| FIXTPL-38 | console |

**Erreurs JavaScript applicatives : 0.**

### Deux assertions re-pointées — obsolescence de contrat

Aucune n'a été supprimée ni affaiblie. Le motif est écrit dans le code des
**deux** recettes (celle de V2.11.0, devenue historique, et celle de ce round).

| Assertion | Constat | Re-pointage |
|---|---|---|
| `TPL-15` | le format portait onze champs | **douze champs épinglés** — liste toujours EXACTE, donc plus stricte : un treizième la ferait tomber |
| `TPL-55` | le formulaire portait deux contrôles | **quatre contrôles épinglés** (`name`, `description`, les deux radios) — plus strict qu'avant |

---

## O. Recettes V2.11.0 et Structure

| Recette | Résultat contre V2.11.0.1 |
|---|---|
| `recette-modeles-chantier-v2.11.0.mjs` | **65 / 65** |
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** |
| `recette-structure-operationnelle-v2.10.0.mjs` | **69 / 69** |
| `recette-structure-rework-v2.10.0.1.mjs` | **29 / 29** |

---

## P. Comparaison des échecs historiques

**55 recettes** rejouées contre `v2.11.0.1`.

| | |
|---|---|
| `ECHECS_REFERENCE_V2110` | **262** |
| `ECHECS_V21101` | **262** |
| **RESTE (échecs nouveaux)** | **0** |

Le jeu d'échecs est **identique, ligne à ligne**, à celui de V2.11.0 : dette
historique accumulée depuis V2.4 (vues Planning Jour/Semaine/Mois, géométrie
Kanban, empreintes de moteurs ayant légitimement évolué entre V2.4.15.4 et
aujourd'hui). Aucun n'est introduit par ce correctif, aucun ne concerne les
modèles, et aucun n'a été traité — conformément au §0.

---

## Q. Erreurs console

**0 erreur applicative**, sur la recette dédiée comme sur les 55 recettes de
non-régression. Les seules lignes `console.error` restantes sont (a) des
`net::ERR_FAILED` dus au blocage réseau volontaire des tests, (b) l'erreur
**simulée exprès** par `IMP-15` pour vérifier le rollback d'import. Strictement
identiques à la référence V2.11.0.

---

## R. Preuve qu'il n'existe toujours qu'un seul moteur de clonage

Le correctif **étend** `cloneStructureTree()` — il ne le contourne pas.
Mesuré (FREEZE-21101 / FIXTPL-31 → FIXTPL-33) :

| Propriété | Mesure |
|---|---|
| `function cloneStructureTree(` | **1 occurrence** |
| Appels `= cloneStructureTree(` dans tout le fichier | **2** |
| Appelants, et eux seuls | `applyTemplateToProject` \| `duplicateStructureNode` |
| `renderAIPanel` n'en appelle pas (mesuré par indentation) | ✔ |
| Les deux appelants **délèguent** et ne construisent **aucune** table | ✔ |
| `mapNoeuds = new Map` / `mapTaches = new Map` | **1 chacune** |
| `deps: internes.map` / `reworkOfTaskId: repriseInterne` / `structureNodeId: mapNoeuds.get` | **1 chacune** |
| La primitive reste **PURE** (ni `app.*`, ni `save()`, ni `snapshot()`, ni `render()`) | ✔ |
| Aucun `TemplateEngine`, `cloneTemplateTree`, `cloneTemplate`, `structureClone`, `copyStructureTree`, `instantiateTemplateTree`, `applyTemplateTasks` | ✔ |
| Aucune pile Undo parallèle, aucun moteur de ressources parallèle | ✔ |
| `templateSuggestedExtras()` : **1 définition, 3 usages** (capture, migration, pose) | ✔ |
| Un seul `snapshot()`, un seul `gantt()` | ✔ |
| Aucun drag & drop de structure | ✔ |

Les données de démonstration — niveaux **et** interventions — restent
**byte-identiques** à V2.11.0, et le **seul** bloc de style touché est celui des
modèles : tout le reste de la feuille est byte-identique.

---

## Captures — `recette-v2.11.0.1/`

```
01-enregistrer-structure-interventions.png  le choix, défaut « + interventions »
02-enregistrer-structure-seule.png          « Structure seule » sélectionné,
                                            aperçu « aucune intervention »
03-modele-structure-seule.png               utiliser un modèle sans intervention
04-affectations-suggerees.png               le vocabulaire corrigé
05-gestionnaire-desktop.png                 1600 px, noms entiers
06-gestionnaire-mobile.png                  390 px, noms entiers
07-cta-direct-modeles.png                   accès direct à la liste
08-modele-ressources-complementaires.png    les renforts reposés
09-sombre.png                               gestionnaire, thème sombre
10-enregistrer-sombre.png                   le choix de contenu, thème sombre
11-affectations-posees.png                  les ressources du chantier créé
12-gestionnaire-1366.png                    la largeur desktop la plus contrainte
01/02/03…-*.png (V2.11.0)                   la recette héritée, rejouée
resultats.json                              les 110 assertions, machine-lisibles
```

---

## Critères de fin

| | |
|---|---|
| ✓ | enregistrer une structure sans interventions |
| ✓ | « Structure + interventions » reste le défaut |
| ✓ | ressources complémentaires conservées comme suggestions |
| ✓ | aucune ressource disparue ne génère de référence orpheline |
| ✓ | personnes / entreprises / matériel complémentaires fonctionnent |
| ✓ | ancien modèle V2.11.0 reste compatible |
| ✓ | noms lisibles sur desktop (1366 → 1920) |
| ✓ | mobile propre (360 / 390 / 430) |
| ✓ | CTA gestionnaire → modèles direct |
| ✓ | les 5 choix du wizard normal restent intacts |
| ✓ | `PROJECT_TEMPLATES` intacts |
| ✓ | modèles d'entreprise intacts |
| ✓ | Undo/Redo intacts |
| ✓ | Backup / Restore intact |
| ✓ | `STORE` intact, `SCHEMA_VERSION` toujours 14 |
| ✓ | architecture `cloneStructureTree` intacte |
| ✓ | aucun moteur parallèle |
| ✓ | RESTE non-régression = **0** |
| ✓ | **0** erreur JS applicative |
