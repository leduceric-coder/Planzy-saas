# Kanvix V2.11.0.2 — Correctif ultra-ciblé des modèles de chantier

## Source, livrable, commit

| | |
|---|---|
| **Source** | `public/poc/kanvix-next-gen-v2.11.0.1.html` |
| **Livrable** | `public/poc/kanvix-next-gen-v2.11.0.2.html` — 30 152 lignes |
| **Recette dédiée** | `recette-modeles-chantier-v2.11.0.2.mjs` — **140 / 140**, **0 erreur console** |
| **Non-régression** | 56 recettes rejouées — **RESTE : 0** |
| **Captures** | `recette-v2.11.0.2/` (25 images) |
| **Branche** | `claude/kanvix-next-gen-poc-im084x` |

Deux angles morts corrigés, rien d'autre. Aucune évolution produit.

---

## 1. Fonctions réellement modifiées — trois. Et une ajoutée.

Mesuré par balayage de **tout** le fichier contre V2.11.0.1 (FREEZE-21102) :

| Fonction | Statut | Justification exacte |
|---|---|---|
| `cloneStructureTree` | **modifiée** | §2 — les deux gardes d'assignabilité (`resource(id)` → `canAssignResource(id, rôle)`). Deux lignes. |
| `renderWizard` | **modifiée** | §3 — l'étape `ptpl-preview` distingue désormais un modèle sans intervention. |
| `createProjectFromProjectTemplate` | **modifiée** | §3.4 / §3.5 — c'est le modèle qui fait foi, plus `wizard.data`. |
| `canAssignResource` | **ajoutée** | §2.4 — la lecture de la règle d'assignabilité **existante**, 4 lignes. |

**`horsPérimètre: []`** — aucune autre fonction du fichier n'a changé.
**`nonModifiées: []`** — les trois annoncées ont réellement changé, aucune
modification silencieusement absente.
**`ajoutsRéels: ["canAssignResource"]`** — une seule fonction ajoutée.

Byte-identiques, mesurés nommément : `assignableResources`,
`mainAssignableResources`, `resourceActive`, `normalizeTaskResources`,
`migrateState`, `buildKanvixBackup`, `validateKanvixBackup`,
`confirmKanvixRestore`, `KANVIX_BACKUP_REQUIRED`, **`INITIAL_STATE` en entier**
et **la feuille de style en entier**.

---

## 2. Correctif A — les affectations suggérées respectent les règles Ressources

### Le problème

`cloneStructureTree()` reprenait une ressource suggérée dès que `resource(id)`
**existait**. Deux règles métier déjà appliquées ailleurs dans Kanvix étaient
donc contournées quand un modèle était posé : une ressource **archivée**
pouvait être réaffectée, et un **équipement** pouvait devenir intervenant
principal — ce que les sélecteurs de tâche refusent depuis V2.5.

### La correction : lire la règle, ne pas la réécrire

```js
function canAssignResource(id, role) {
  if (!id) return false;
  return (role === "main" ? mainAssignableResources() : assignableResources())
    .some((r) => r.id === id);
}
```

C'est volontairement une **lecture**, pas une copie : la fonction interroge les
listes que le produit propose **déjà** dans ses sélecteurs de tâche. Elle ne
contient ni `archived`, ni `equipment`, ni `status` — vérifié par regex
(FREEZE-21102). Si la notion d'assignabilité évolue un jour, la pose d'un
modèle suivra d'elle-même, sans qu'une seconde vérité ait le temps de diverger.

Dans `cloneStructureTree()`, deux guards changent, et rien d'autre :
`resource(principalSuggere)` → `canAssignResource(principalSuggere, "main")`,
`resource(id)` → `canAssignResource(id, "extra")`.

### Règle exacte — intervenant principal suggéré

Repris **si et seulement si** : existe **ET** actif **ET** type ≠ `equipment`.

| Cas | `task.resourceId` | mesuré |
|---|---|---|
| personne active (`mathieu`) | **repris** | FIXTPL2-01 |
| entreprise active (`legall`) | **repris** | FIXTPL2-02 |
| équipement actif (`crane-g01`) | **`null`** | FIXTPL2-03 |
| personne archivée (`marc`) | **`null`** | FIXTPL2-04 |
| entreprise archivée (`coloris`) | **`null`** | FIXTPL2-05 |
| ressource inconnue | **`null`** | FIXTPL2-08 |

**Un équipement suggéré comme principal est simplement ABANDONNÉ** — il n'est
jamais reclassé en renfort. Un modèle n'invente pas une affectation qu'il ne
contenait pas. Mesuré : sur l'intervention `engin-principal`
(`suggestedResourceId: 'crane-g01'`, `suggestedAdditionalResourceIds:
['lift-n03']`), le résultat est `res: null, add: ['lift-n03']` — la grue n'est
nulle part, la nacelle que le modèle déclarait est bien posée.

### Règle exacte — ressources complémentaires suggérées

Reprise **si et seulement si** : existe **ET** active **ET** différente du
principal effectivement retenu. **Les trois types restent autorisés** —
`person`, `company`, `equipment`.

| Cas | `additionalResourceIds` | mesuré |
|---|---|---|
| équipements actifs (`crane-g01`, `lift-n03`) | **les deux repris** | FIXTPL2-06 |
| personne + entreprise archivées | **écartées** | FIXTPL2-07 |
| ressource inconnue | **écartée** | FIXTPL2-08 |

Bilan global sur les **neuf** interventions posées : **0 référence orpheline**,
**0 ressource archivée réaffectée**, **0 équipement promu principal**,
**0 doublon**, **0 principal présent aussi en complément**.

### Le compteur `ressourcesAbandonnees`

**Un seul compteur**, convention de V2.11.0.1 conservée : il compte toutes les
suggestions **non reposées**.

| Mode | Valeur mesurée | Détail |
|---|---|---|
| `suggest` | **7** | engin promu principal (1) + personne archivée (1) + entreprise archivée (1) + compléments archivés (2) + complément inconnu (1) + principal inconnu (1) |
| `none` | **16** | toutes les suggestions du modèle (9 principaux + 7 compléments) |

La valeur attendue en mode `none` n'est pas codée en dur dans le test : elle est
**recalculée depuis le modèle** (`Σ principaux + Σ compléments`), puis comparée.

---

## 3. Correctif B — créer un chantier depuis un modèle « Structure seule »

### Une seule condition métier

`avecTaches = tpl.tasks.length > 0` — **la même** que celle qu'utilise déjà
`openTemplateInsert()`. Aucun second concept n'a été créé.

### Modèle AVEC interventions — inchangé

Mesuré (FIXTPL2-10) : champs `name|location|startDate|taskGranularity|
ptplResources`, méta `4 niveaux|6 interventions|5 dépendances`, chaîne de
6 interventions, « Fin estimée : mar. 25 août », texte « à faire, sans
incident, sans photo et sans reprise ». Comportement identique à V2.11.0.1.

**Seul le vocabulaire change**, pour coller à la réalité et à « Utiliser le
modèle » :

| Avant | Après |
|---|---|
| `Intervenants` | **`Affectations`** |
| `Reprendre les intervenants suggérés` | **`Reprendre les affectations suggérées`** |

C'est exact : il s'agit bien de l'intervenant principal **et** de ses renforts.

### Modèle STRUCTURE SEULE — l'écran devient sobre

Mesuré (FIXTPL2-11) : champs **`name|location`** — et c'est tout.

Disparaissent : la date de démarrage, la gestion des tâches, les affectations,
la fin estimée, la chaîne d'interventions vide, et le texte annonçant des
interventions à créer. La méta affiche `3 niveaux | Structure seule` au lieu
d'un « 0 intervention · 0 dépendance » qui ne dirait rien.

Le texte affiché :

> Ce modèle contient uniquement une structure. Le chantier sera créé avec ses
> 3 niveaux, sans intervention ni date planifiée.

### Le chantier créé

Mesuré (FIXTPL2-12) :

| Champ | Valeur |
|---|---|
| `startDate` | **`null`** |
| `baselineEnd` | **`null`** |
| interventions | **0** |
| jalons | **0** |
| niveaux | **3**, dont 1 racine, hiérarchie conservée |
| dates posées sur un niveau | **0** |
| `lifecycle` | `active` |
| `creationMode` | `project-template` |
| `projectTemplateId` | `ptpl-nue` |
| `taskGranularity` | `day` (valeur par défaut du produit) |

Le chantier retombe naturellement dans l'état vide que le produit connaît déjà
(« À CONFIGURER — Ajoutez votre première intervention ou un jalon »), sans
qu'une seule ligne d'écran ait été ajoutée pour ce cas.

### §3.5 — les données périmées du wizard ne fuient pas

Scénario joué littéralement (FIXTPL2-13) :

1. ouvrir `ptpl-etage-type` (6 interventions) ;
2. saisir `startDate = 2027-01-11`, `ptplResources = suggest`,
   `taskGranularity = week` ;
3. revenir (`wizardGo('ptpl-select')`) — le test **vérifie d'abord** que
   `app.ui.wizard.data` porte toujours ces trois valeurs ;
4. choisir `ptpl-nue` (0 intervention) ;
5. créer.

Résultat : `startDate: null`, `baselineEnd: null`, `taskGranularity: 'day'`,
0 tâche, 0 affectation. **Aucune des trois valeurs périmées n'a fui.**

`createProjectFromProjectTemplate()` ne lit plus `d.startDate` ni
`d.ptplResources` quand `tpl.tasks.length === 0` : c'est le modèle qui fait foi.
La granularité, elle, n'ayant pas été demandée, retombe sur la valeur par défaut
du produit plutôt que sur un reste de saisie.

---

## 4. Undo / Redo

Aucune mécanique touchée. Mesuré (FIXTPL2-14), en un seul geste :

| | projets | niveaux | tâches | jalons |
|---|---|---|---|---|
| avant | 4 | 4 | 11 | 4 |
| après création | **5** | **7** | 11 | 4 |
| après *Annuler* | **4** | **4** | 11 | 4 |
| après *Rétablir* | **5** | **7** | 11 | 4 |

Après *Rétablir* : `startDate` toujours `null`, `baselineEnd` toujours `null`,
3 niveaux, 0 tâche. **Aucun chantier vide résiduel.**

---

## 5. `SCHEMA_VERSION` et `STORE`

**`SCHEMA_VERSION` reste 14** — mesuré des deux côtés (V2.11.0.1 et V2.11.0.2).
Aucune donnée persistée nouvelle n'est introduite : le correctif ne fait que
filtrer autrement des suggestions déjà stockées, et cesser de fabriquer deux
dates.

**`STORE` reste `kanvix-product-8-3`.** `KANVIX_APP_BUILD` inchangé.

Aucune migration créée : `migrateState()` est **byte-identique**. Le format de
sauvegarde est intact : `buildKanvixBackup()`, `validateKanvixBackup()`,
`confirmKanvixRestore()` et `KANVIX_BACKUP_REQUIRED` sont **byte-identiques**.
Les modèles V2.11.0 et V2.11.0.1 restent intégralement compatibles — les
26 contrôles de compatibilité et de sauvegarde hérités passent tous.

---

## 6. Recette dédiée — 140 / 140

`recette-modeles-chantier-v2.11.0.2.mjs` = **toute** la recette V2.11.0.1
(110 contrôles, elle-même héritée des 65 de V2.11.0), **plus** le bloc FIXTPL2,
le bloc responsive et le gel FREEZE-21102. **Aucun contrôle retiré ni
affaibli.**

| Bloc | Résultat |
|---|---|
| TPL-01 → TPL-55, FREEZE-2110 (V2.11.0) | ✔ |
| FIXTPL-01 → FIXTPL-38, FREEZE-21101 (V2.11.0.1) | ✔ |
| **FIXTPL2-01 → FIXTPL2-09** — règles Ressources | ✔ |
| **FIXTPL2-10 → FIXTPL2-14** — wizard Structure seule | ✔ |
| **Responsive** — 22 combinaisons | ✔ |
| **FREEZE-21102** — périmètre, règle, architecture, données | ✔ |

**Erreurs JavaScript applicatives : 0.**

Un seul re-pointage a été nécessaire, et il porte sur le **gel** de
V2.11.0.1, pas sur une règle produit :

| Assertion | Constat | Re-pointage |
|---|---|---|
| `FREEZE-21101` (périmètre) | mesure la distance depuis V2.11.0 ; signalait `renderWizard` et `createProjectFromProjectTemplate` comme dérive | les deux fonctions sont **nommées** dans la liste, avec leur motif écrit dans la recette. La liste reste **fermée** : une onzième fonction ferait toujours tomber le test, et `FREEZE-21102` vérifie ce périmètre-là de façon **indépendante**, contre V2.11.0.1 |

Aucune autre recette n'a été modifiée.

---

## 7. Recettes Structure et modèles

| Recette | Résultat contre V2.11.0.2 |
|---|---|
| `recette-modeles-chantier-v2.11.0.1.mjs` | **110 / 110** |
| `recette-modeles-chantier-v2.11.0.mjs` | **65 / 65** |
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** |
| `recette-structure-operationnelle-v2.10.0.mjs` | **69 / 69** |
| `recette-structure-rework-v2.10.0.1.mjs` | **29 / 29** |

---

## 8. Comparaison des échecs historiques

**56 recettes** rejouées contre `v2.11.0.2`.

| | |
|---|---|
| `ECHECS_REFERENCE_V21101` | **262** |
| `ECHECS_V21102` | **262** |
| **RESTE (échecs nouveaux)** | **0** |

Le jeu d'échecs est **identique, ligne à ligne**, à celui de V2.11.0.1.

**Confirmation explicite : aucune dette historique n'a été traitée dans ce
round.** Les 262 échecs — vues Planning Jour/Semaine/Mois, géométrie Kanban,
empreintes de moteurs ayant légitimement évolué entre V2.4.15.4 et aujourd'hui —
sont laissés exactement dans l'état où V2.11.0.1 les avait laissés. Aucune
recette historique n'a été modifiée pour « faire passer » le correctif.

---

## 9. Erreurs console

**0 erreur applicative**, sur la recette dédiée comme sur les 56 recettes de
non-régression. Les seules lignes `console.error` restantes, strictement
identiques à la référence V2.11.0.1 :

```
[A11Y] Failed to load resource: net::ERR_FAILED       ← blocage réseau du test
[P8]   Failed to load resource: net::ERR_FAILED       ← idem
[IMP-18]/[IMP-22] Failed to load resource: net::ERR_FAILED  ← idem
[IMP-15] Kanvix: import annulé (rollback) Error: erreur simulée
         ← erreur SIMULÉE EXPRÈS par le test, pour vérifier le rollback
```

---

## 10. Responsive et thèmes

**22 combinaisons** mesurées — 11 largeurs (1920, 1600, 1440, 1366, 1280, 1080,
900, 768, 430, 390, 360) × 2 thèmes (clair, sombre) — sur **trois** écrans à
chaque fois : aperçu avec interventions, aperçu Structure seule, gestionnaire
de modèles.

Résultat : `fautives: []`. Aucun défilement horizontal, aucun dépassement de la
side-window, aucun bouton coupé, à aucune largeur, dans aucun thème.

Thème sombre mesuré sur l'écran Structure seule : titre à **243** de luminance
sur un fond à **37**, avec les mêmes deux champs qu'en clair. Les jetons du
produit sont utilisés, aucune couleur codée en dur.

**Le design du gestionnaire de modèles, corrigé en V2.11.0.1, n'a pas été
retouché** — la feuille de style est byte-identique.

---

## 11. Captures — `recette-v2.11.0.2/`

Toutes produites par les tests réels.

```
01-ptpl-avec-interventions-desktop.png   l'aperçu complet, inchangé
02-ptpl-structure-seule-desktop.png      deux champs, une phrase, rien d'autre
03-ptpl-structure-seule-mobile.png       le même à 390 px
04-chantier-cree-structure-seule.png     le chantier créé : 3 niveaux, 0 tâche,
                                         état « À configurer » du produit
05-affectations-valides.png              les neuf cas de règles ressources
06-dark-mode.png                         Structure seule, thème sombre
(+ les 19 captures héritées de V2.11.0 et V2.11.0.1, régénérées)
resultats.json                           les 140 assertions, machine-lisibles
```

---

## 12. Preuve du gel architectural

| Propriété | Mesure |
|---|---|
| `function cloneStructureTree(` | **1 occurrence** |
| Appels `= cloneStructureTree(` | **2** |
| Appelants, et eux seuls | `applyTemplateToProject` \| `duplicateStructureNode` |
| `renderAIPanel` n'en appelle pas (mesuré par indentation) | ✔ |
| Les deux appelants ne construisent **aucune** table | ✔ |
| `mapNoeuds = new Map` / `mapTaches = new Map` | **1 chacune** |
| `deps: internes.map` / `reworkOfTaskId: repriseInterne` / `structureNodeId: mapNoeuds.get` | **1 chacune** |
| Primitive **PURE** (ni `app.*`, ni `save()`, ni `snapshot()`, ni `render()`) | ✔ |
| `app.structureNodes.push(` dans tout le fichier | **3** — création manuelle d'un niveau + les deux appelants |
| Aucun `TemplateEngine`, `cloneTemplateTree`, `cloneTemplate`, `applyTemplateEngine`, `structureClone`, `copyStructureTree`, `instantiateTemplateTree`, `applyTemplateTasks` | ✔ |
| Aucune pile Undo parallèle (`templateUndoStack`, `resourceUndoStack`, `wizardUndoStack`…) | ✔ |
| `renderWizard` / `wizardPickMode` / `createProjectFromProjectTemplate` | **1 chacun** |
| `snapshot()` / `gantt()` | **1 chacun** |
| Aucun moteur de ressources parallèle (`ResourceAssignmentEngine`, …) | ✔ |
| `canAssignResource()` appelée **uniquement** aux 2 endroits de la primitive | ✔ (3 occurrences : 1 définition + 2 appels) |
| Aucun drag & drop de structure | ✔ |

**Aucune logique de création de structure parallèle** à `cloneStructureTree()`
n'existe : les trois seuls endroits qui poussent des niveaux sont la création
manuelle d'un niveau (`openStructureForm`) et les deux appelants de la
primitive, vérifiés nommément par leur ligne de `push`.

---

## 13. Critères de fin

| # | Critère | |
|---|---|---|
| 1 | équipement suggéré comme principal jamais affecté comme tel | ✔ FIXTPL2-03 |
| 2 | ressource archivée jamais réaffectée par un modèle | ✔ FIXTPL2-04/05/07 |
| 3 | personne et entreprise actives autorisées comme principaux | ✔ FIXTPL2-01/02 |
| 4 | equipment/person/company autorisés comme complémentaires s'ils sont actifs | ✔ FIXTPL2-06 |
| 5 | aucune référence ressource orpheline | ✔ FIXTPL2-08 |
| 6 | `ressourcesAbandonnees` comptabilise correctement | ✔ FIXTPL2-09 |
| 7 | modèle Structure seule dans un chantier existant fonctionne toujours | ✔ FIXTPL-06/07 hérités |
| 8 | modèle Structure seule pour CRÉER un chantier fonctionne | ✔ FIXTPL2-12 |
| 9 | chantier = structure, 0 intervention, `startDate`/`baselineEnd` nuls | ✔ FIXTPL2-12/13 |
| 10 | aucune option inutile dans le wizard sans tâche | ✔ FIXTPL2-11 |
| 11 | `wizard.data` périmé ne contamine jamais | ✔ FIXTPL2-13 |
| 12 | Undo / Redo en un seul geste | ✔ FIXTPL2-14 |
| 13 | `SCHEMA_VERSION` reste 14 | ✔ FREEZE-21102 |
| 14 | `STORE` reste `kanvix-product-8-3` | ✔ FREEZE-21102 |
| 15 | `cloneStructureTree` reste l'unique vérité de clonage | ✔ FREEZE-21102 |
| 16 | toutes les recettes V2.11.0.1 passent | ✔ 110 / 110 |
| 17 | `RESTE = 0` | ✔ 262 = 262 |
| 18 | aucune erreur JavaScript applicative | ✔ 0 |
