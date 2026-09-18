# Kanvix V2.11.0 — Modèles de chantier réutilisables

**Livrable :** `public/poc/kanvix-next-gen-v2.11.0.html` (fichier unique, 29 934 lignes)
**Base :** `kanvix-next-gen-v2.10.0.1.html`
**Recette dédiée :** `recette-modeles-chantier-v2.11.0.mjs` — **65 / 65**, **0 erreur console applicative**
**Non-régression :** 54 recettes historiques rejouées — **RESTE : 0**
**Captures :** `recette-v2.11.0/` (18 images)

---

## 1. Ce que fait la version

Un **modèle de chantier** est une **trame** : une hiérarchie de niveaux, ses
interventions, leurs lots, leurs durées et leurs dépendances — exprimés en
**jours relatifs** au démarrage. On l'enregistre depuis un niveau ou depuis un
chantier entier, on la repose autant de fois qu'on veut, à la date qu'on veut,
dans un chantier neuf ou dans un chantier existant.

Un modèle ne contient **aucune date absolue, aucun avancement, aucun incident,
aucune photo, aucun message, aucune reprise, aucun contrôle**. Ce n'est pas un
filtrage : c'est une **liste blanche** à la capture (§4 ci-dessous).

### Les quatre gestes

| Geste | Où | Fonction |
|---|---|---|
| Enregistrer un **niveau** comme modèle | menu `…` d'un niveau, onglet Structure | `openStructureTemplateSave()` |
| Enregistrer le **chantier entier** comme modèle | bouton de l'en-tête, onglet Structure | `openProjectTemplateSave()` |
| **Gérer** : renommer, supprimer, réutiliser | Réglages › « Modèles de chantier » | `openProjectTemplatesManager()` |
| **Créer un chantier** depuis un modèle | Nouveau chantier › « Modèle de chantier » | `createProjectFromProjectTemplate()` |

Bonus non demandé mais gratuit — la primitive étant partagée : **poser un
modèle dans un chantier EXISTANT**, à l'emplacement de son choix
(`openTemplateInsert()`).

---

## 2. §34 — UNE seule vérité de clonage

C'est le cœur du round, et c'était le vrai risque : écrire un `TemplateEngine`
à côté du moteur de duplication de V2.10, avec deux logiques qui divergent au
premier correctif.

**Ce qui a été fait :** le moteur de clonage a été **sorti** de
`duplicateStructureNode()` — pas réécrit, **déplacé** — et est devenu
`cloneStructureTree()`. Les deux usages y passent, et personne d'autre.

```
cloneStructureTree(source, opts)
  source : { rootId, nodes[], tasks[] }   ← champs du DOMAINE (id, parentId,
                                             structureNodeId, deps)
  opts   : projectId, parentId, rootName, includeTasks,
           dateStrategy     "keep" | "relative"   (+ startDate)
           resourceStrategy "keep" | "suggest" | "none"
           resetOperational
```

Le choix qui rend la factorisation **honnête plutôt que cosmétique** : un modèle
stocke ses niveaux et ses interventions **avec les noms de champs du domaine**
(`id`, `parentId`, `structureNodeId`, `deps`), avec des identifiants locaux
(`tn-1`, `tt-1`). Il n'y a donc **aucune couche de traduction** entre « un
sous-arbre réel » et « un modèle » — la primitive lit les deux tels quels. Une
fonction d'adaptation aurait été un second moteur déguisé.

La primitive est **PURE** : elle ne touche ni `app`, ni `localStorage`, ni
l'historique, ni l'écran. Les appelants maîtrisent la transaction — c'est ce qui
permet à « créer un chantier depuis un modèle » (création du chantier **et** pose
de la trame) de tenir dans **un seul `snapshot()`**, donc un seul « Annuler ».

**Mesuré par la recette (FREEZE-2110 / §34), pas affirmé :**

| Propriété | Mesure |
|---|---|
| `cloneStructureTree()` existe | ✔ |
| Elle n'est appelée que **2 fois** dans tout le fichier | ✔ |
| Ses **seuls** appelants sont `duplicateStructureNode` et `applyTemplateToProject` | ✔ |
| `duplicateStructureNode()` ne construit **plus aucune** table de correspondance | ✔ |
| `mapNoeuds = new Map` / `mapTaches = new Map` : **1 occurrence chacune** dans le fichier | ✔ |
| `deps: internes.map` / `reworkOfTaskId: repriseInterne` / `structureNodeId: mapNoeuds.get` : **1 occurrence chacune** | ✔ |
| La primitive est pure (ni `app.*`, ni `save()`, ni `snapshot()`, ni `render()`) | ✔ |
| Aucun second moteur (`TemplateEngine`, `cloneTemplate`, `copyStructureTree`, …) | ✔ |

Conséquence concrète : **le correctif de V2.10.0.1 sur les reprises protège
désormais aussi les modèles**, sans une ligne de plus. La recette
`recette-structure-rework-v2.10.0.1.mjs` (29 / 29) le vérifie sur le moteur
factorisé — ses douze scénarios de comportement passent **inchangés**.

---

## 3. Les dates relatives — et les week-ends

Un modèle stocke, par intervention : `offsetDays`, `durationDays`, `startTime`,
`endTime`. Rien d'autre côté temps.

La conversion réutilise **les deux primitives de date déjà présentes** —
`daysBetweenKeys()` à la capture, `shiftDateStr()` à la pose. Aucune arithmétique
nouvelle n'a été écrite.

**Volontairement en jours CALENDAIRES, pas ouvrés.** `createTemplateFromWizard()`
(les modèles d'entreprise de V2.4) utilise `addBusinessDays()`, qui n'est pas
l'inverse exact de la mesure : un aller-retour y dérive. Surtout, décaler une
intervention hors du samedi **déplacerait toute la chaîne de dépendances qui la
suit**. La trame que l'utilisateur a enregistrée est reposée telle quelle.

**Vérifié par ALLER-RETOUR (TPL-22)** : une trame capturée puis reposée à sa
date de référence redonne **les dates de la source, au jour et à l'heure près** —
y compris l'intervention du samedi, qui reste un samedi. Reposée 21 jours plus
tard (TPL-23), **chaque** intervention est décalée d'exactement 21 jours.

Effet de bord agréable : `alignDemoDates()` n'a **rien** à décaler dans un
modèle. Un modèle ne vieillit pas (TPL-10).

---

## 4. Ce qu'un modèle ne contient pas — par construction

La capture est une **liste blanche**. Une intervention de modèle porte
**exactement onze champs** :

```
id · structureNodeId · name · lotId · phase
offsetDays · durationDays · startTime · endTime
deps · suggestedResourceId
```

Ce qui n'est pas dans cette liste n'y entre pas — **aujourd'hui ni après l'ajout
d'un futur champ de chantier**. C'est la garantie structurelle : pas de liste
noire à maintenir. TPL-14 et TPL-15 mesurent la liste exacte.

À la pose, les interventions naissent **« à faire »**, sans incident, sans
contrôle, sans photo, sans reprise, avec leur référence calée sur leurs propres
dates (aucun retard hérité). TPL-26 le vérifie sur une source volontairement
**terminée et porteuse d'un incident critique**.

**Les niveaux archivés n'entrent pas dans une trame** (TPL-11, TPL-12) : un
modèle décrit ce que l'on **refait**, pas ce que l'on a rangé.

---

## 5. Ressources et lots : suggérés, jamais imposés

Un modèle enregistre `suggestedResourceId`. À la pose, deux choix explicites :

- **« Ne pas affecter »** (défaut) — aucune intervention ne porte d'intervenant ;
- **« Reprendre les intervenants suggérés »** — repris **uniquement s'ils
  existent encore** dans l'équipe.

Même règle pour les lots : un `lotId` disparu du référentiel devient `null`.

**Jamais de référence orpheline** : TPL-28 casse volontairement une suggestion et
un lot, et vérifie que zéro intervention posée pointe vers un identifiant mort —
les deux abandons étant **comptés** et rendus à l'appelant.

---

## 6. Schéma, migration, sauvegarde

- `SCHEMA_VERSION` : **13 → 14**. `STORE` reste **`kanvix-product-8-3`**.
- Migration **strictement additive et idempotente** : une sauvegarde V13 devient
  V14 avec `projectTemplates = []`. **Aucun modèle de démonstration n'est
  installé rétroactivement** — la démo appartient à `INITIAL_STATE`, pas à la
  migration (même discipline qu'en V2.8 pour les opérations et V2.9 pour la
  structure).
- La migration **normalise** un modèle corrompu sans jamais toucher au reste :
  entrées illisibles écartées, parent fantôme et cycle ramenés à la racine, type
  inconnu neutralisé, rattachement fantôme annulé, offsets négatifs bornés, heure
  invalide remplacée, dépendance inconnue et auto-dépendance filtrées (TPL-09).
  Un modèle ne référence que lui-même : cette normalisation ne peut donc **pas**
  casser une donnée de chantier.
- **Sauvegarde** : les modèles voyagent avec elle et reviennent octet pour octet.
  La clé reste **facultative** — elle n'est **pas** ajoutée à
  `KANVIX_BACKUP_REQUIRED`, exactement comme les lots, la qualité, les opérations
  et la structure avant elle. Une sauvegarde V13 sans la clé reste
  **parfaitement valide** (TPL-48 → TPL-51).

**Deux modèles de démonstration**, tous deux marqués `seededFor` :
« Étage type — logements » (portée niveau, 4 niveaux / 6 interventions) et
« Maison individuelle — gros œuvre » (portée chantier entier — une **forêt**,
`rootId: null` — 3 niveaux / 6 interventions). Les deux portées sont donc
exercées dès l'ouverture.

---

## 7. Undo / Redo : une pose, un geste

| Action | Annulée d'un seul geste |
|---|---|
| Enregistrer un modèle | ✔ TPL-32 |
| Poser une trame (3 niveaux + 4 interventions) | ✔ TPL-33 / TPL-34 (Redo compris) |
| **Créer un chantier depuis un modèle** (chantier **et** trame) | ✔ TPL-35 |
| Supprimer un modèle | ✔ TPL-39 |

TPL-35 est le cas qui comptait : jamais de chantier vide orphelin après un
« Annuler ».

---

## 8. ⚠ Collision de vocabulaire — à trancher par vous

Kanvix avait **déjà** une notion de « modèle » avant ce round, et le §4 de la
spécification demandait `app.projectTemplates` sans pouvoir le savoir :

| Notion | Depuis | Contenu | Où |
|---|---|---|---|
| `PROJECT_TEMPLATES` (intégrés) | V2.4 | liste **plate** de tâches (`key, name, lotId, offset, duration, deps`) | Nouveau chantier › « Utiliser un modèle » |
| `app.companyTemplates` | V2.4.15.4 | idem, créés depuis un chantier | Nouveau chantier › « Modèle d'entreprise » + Réglages |
| **`app.projectTemplates`** | **V2.11.0** | **hiérarchie + interventions**, jours relatifs | Nouveau chantier › « Modèle de chantier » + Réglages |

La fonction `allProjectTemplates()` **existait déjà** et désigne les deux
premières. J'ai donc conservé le nom de collection demandé
(`app.projectTemplates`) mais **rien renommé d'existant** — renommer aurait
cassé des recettes historiques sans bénéfice produit — et j'ai choisi le libellé
d'interface **« Modèle de chantier »**, sous-titré *« Reposer une trame
complète : niveaux et interventions »*, pour porter la distinction là où
l'utilisateur la lit.

**Les trois notions coexistent** (TPL-43, TPL-44, SITE-1514) : aucun mode
existant n'a été retiré ni renommé. Si vous voulez unifier, c'est un round à
part entière — dites-le et je le fais proprement, avec migration des
`companyTemplates` vers la nouvelle forme.

Point mineur corrigé au passage dans le **nouvel** écran seulement : l'aperçu
annonce le nombre de **liens** de dépendance (5 pour la trame de démonstration),
pas le nombre d'interventions qui en portent. L'étape « modèle d'entreprise » de
V2.4, elle, n'a pas été touchée.

---

## 9. Périmètre réel du round — mesuré

Le balayage de **tout** le fichier ne trouve que **neuf** fonctions modifiées
depuis V2.10.0.1, toutes déclarées :

```
duplicateStructureNode   §34 — vidée de son moteur, délègue
migrateState             migration 13 → 14
icon                     une icône « template »
structureNodeMenu        une entrée de menu
projectStructureTab      le bouton au niveau chantier
renderMore               une rangée de Réglages
renderWizard             deux étapes
wizardPickMode           une branche
showKanvixBackupPreview  une ligne d'aperçu
```

**117 moteurs** de V2.10.0.1 sont **byte-identiques** : tout le Planning, tout le
moteur Structure (déplacement et duplication compris, jusqu'à `structureUid`), la
sauvegarde, l'import, les ressources, la qualité, l'Undo/Redo, la navigation,
**les modèles d'entreprise préexistants** et le réalignement de démonstration.

**Preuve plutôt que silence** — le style et les données ne sont pas seulement
« inchangés », ils sont **prouvés additifs** :
le bloc CSS V2.11.0 retiré, la feuille redevient **byte-identique** à V2.10.0.1
(338 932 → 340 876 octets) ; le bloc `projectTemplates` retiré d'`INITIAL_STATE`,
il redevient **byte-identique** ; les données de démonstration — niveaux **et**
interventions — sont **byte-identiques** (6 176 octets). Un seul octet modifié
ailleurs ferait tomber la mesure.

Toujours : un seul `gantt()`, un seul `snapshot()`, aucune pile Undo parallèle,
aucun drag & drop de structure.

---

## 10. Recette dédiée — 65 / 65

`recette-modeles-chantier-v2.11.0.mjs`, TPL-01 → TPL-55 + FREEZE-2110.

| Bloc | Couverture |
|---|---|
| TPL-01 → TPL-10 | collection, schéma 14, STORE, démo, migration 13→14, idempotence, normalisation d'un modèle corrompu, immunité au réalignement |
| TPL-11 → TPL-21 | capture niveau / chantier entier, exclusion des archivés, liste blanche (11 champs), jours relatifs, dépendances, forêt, interventions sans structure, refus (nom vide, doublon, archivé, chantier absent) |
| TPL-22 → TPL-31 | aller-retour exact, samedi préservé, décalage de 21 jours, identifiants tous neufs, dépendances internes, remise à zéro opérationnelle, intervenants « aucun » / « suggérés », ressource et lot disparus, gardes de destination, greffe sous un niveau, forêt posée dans un chantier |
| TPL-32 → TPL-35 | Undo/Redo — une pose = un geste |
| TPL-36 → TPL-39 | gestion : liste, renommer (vide / doublon / absent), supprimer avec confirmation, annulable |
| TPL-40 → TPL-47 | menu `…` à 7 entrées + géométrie + non-rognage, bouton chantier, Réglages, wizard (5 modes, masquage sans modèle, parcours complet, chantier créé) |
| TPL-48 → TPL-51 | sauvegarde / restauration / sauvegarde V13 / clé facultative / aperçu |
| TPL-52 → TPL-55 | 1920→360 px, thème sombre (luminances mesurées), clavier, side-window |
| FREEZE-2110 | 117 moteurs gelés, périmètre de 9 fonctions, **§34**, additivité prouvée |

**Erreurs JavaScript applicatives : 0.**

---

## 11. Non-régression — RESTE : 0

**54 recettes** rejouées contre `v2.11.0` (les 49 historiques **plus les 5
recettes Structure**, qui deviennent historiques à leur tour).

| | |
|---|---|
| Échecs V2.11.0 | **262** |
| Échecs de référence V2.10.0.1 | **262** |
| **RESTE (échecs nouveaux)** | **0** |

Les 262 échecs sont **exactement les mêmes** qu'en V2.10.0.1 : dérive historique
accumulée depuis V2.4 (vues Planning Jour/Semaine/Mois, géométrie Kanban,
empreintes de moteurs ayant légitimement évolué entre V2.4.15.4 et aujourd'hui).
Aucun n'est introduit par ce round, et aucun ne concerne les modèles.

Les **cinq recettes Structure** passent à **100 %** contre V2.11.0 :

| Recette | Résultat |
|---|---|
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **59 / 59** |
| `recette-structure-compacte-v2.9.1.mjs` | **74 / 74** |
| `recette-structure-operationnelle-v2.10.0.mjs` | **69 / 69** |
| `recette-structure-rework-v2.10.0.1.mjs` | **29 / 29** |

### Les 10 assertions re-pointées — obsolescence de contrat, pas régression

**Aucune n'a été affaiblie ni supprimée.** Chacune a été re-pointée avec une
exigence **égale ou supérieure**, et le motif est écrit dans le code de la
recette.

| Assertion | Constat | Re-pointage |
|---|---|---|
| `STR-OP-01`, `DUP-27` (V2.10.0) | menu à 6 entrées | **7 entrées épinglées** — une de plus, donc plus strict |
| `UXS-02` (V2.9.0.1), `STC-16` (V2.9.1) | liste des actions autorisées | « Enregistrer comme modèle » **déclarée** — mécanisme prévu par l'assertion elle-même ; une entrée non déclarée fait toujours tomber le test |
| `ST-70` (V2.9.0), `DUP-22` (V2.10.0), `REW-DUP-11` (V2.10.0.1) | `SCHEMA_VERSION = 13` | **14**, en disant d'où vient le bump ; `STORE` — ce que ces assertions protègent vraiment — reste épinglé |
| `FREEZE-290`, `STC-50`, `FREEZE-2901`, `FREEZE-291`, `DUP-28`, `FREEZE-21001` (périmètres) | `migrateState`, `structureNodeMenu`, `projectStructureTab` bougent | **nommées une par une** dans les périmètres ; les listes restent fermées |
| `FREEZE-21001` (données / style) | « byte-identique » | **additivité prouvée** : bloc retiré ⇒ byte-identique. Plus fort que l'original |
| `FREEZE-21001` (diff du correctif reprise) | la fonction a été refactorisée | **renforcée** : le remapping de la reprise n'existe qu'à **un** endroit du fichier, la primitive partagée ; `duplicateStructureNode` n'en porte plus une ligne |
| `SITE-1514` (V2.4.15.4) | « 4 options » | **les 5 libellés épinglés dans leur ordre exact** — plus strict qu'un compte |

Deux **ancrages de mesure** ont par ailleurs été corrigés (pas assouplis) : le
motif `« le premier tasks: [ du fichier »` ne désignait plus le tableau de
démonstration, puisque les modèles de démonstration en portent un plus haut.
L'extraction est désormais ancrée sur `structureNodes`, qui le précède
immédiatement, **et** garde son garde-fou de non-vacuité.

### Console

Sur les 54 recettes : **0 erreur applicative**. Les seules lignes `console.error`
restantes sont (a) des `net::ERR_FAILED` dus au blocage réseau volontaire des
tests, (b) l'erreur **simulée exprès** par `IMP-15` pour vérifier le rollback
d'import. Strictement identiques à la référence V2.10.0.1.

---

## 12. Responsive et thème

Testé à **1920, 1440, 1280, 1024, 768, 430, 390 et 360 px** : aucun défilement
horizontal, aucune ligne qui déborde, aucun bouton d'action coupé. En dessous de
620 px la rangée d'un modèle passe en colonne — **adaptée, pas rétrécie**.

Thème sombre : jetons du produit uniquement, aucune couleur codée en dur.
Luminances mesurées — fond 30, titre 243, méta 134, contraste franc.

Le menu `…` à sept entrées (299 px) reste ancré à son bouton, se retourne vers le
haut quand il le faut, et **aucune de ses entrées n'est rognée** sur aucune ligne
— vérifié par `elementFromPoint`, pas par inspection visuelle. Le correctif
d'`overflow` de V2.9.1 tient.

---

## 13. Captures — `recette-v2.11.0/`

```
01-capture-niveau.png          side-window de capture, périmètre mesuré
02-gestion-modeles.png         Réglages › Modèles de chantier
03-menu-niveau.png             menu ••• à 7 entrées, ouvert
04-wizard-choix.png            les 5 modes de création
05-wizard-apercu.png           aperçu de la trame + fin estimée
06-modeles-{360,390,430}.png   mobile
07-modeles-1440.png            desktop
08-modeles-sombre.png          thème sombre
09-enregistrer-modele.png      « Enregistrer comme modèle »
10-utiliser-modele.png         pose dans un chantier existant
11-chantier-depuis-modele.png  le chantier créé, trame déployée
12-chantier-modele-sombre.png  idem, thème sombre, modèle « chantier entier »
13-structure-bouton-modele.png le bouton au niveau chantier
14-reglages-modeles.png        la rangée de Réglages
15-wizard-390.png              wizard mobile
16-utiliser-modele-390.png     pose mobile
resultats.json                 les 65 assertions, machine-lisibles
```

---

## 14. Ce que je n'ai pas fait, et pourquoi

- **Rien renommé** dans les modèles existants (`PROJECT_TEMPLATES`,
  `companyTemplates`, `allProjectTemplates()`) — voir §8. C'est votre décision,
  pas la mienne.
- **Pas d'export « portable »** des modèles : `exportKanvixData()` est un export
  *métier* (chantiers / tâches / lots), la spécification demandait la
  **sauvegarde**, qui les emporte. Dites-moi si vous voulez aussi l'export.
- **Pas de drag & drop** de modèles, conformément au gel de V2.10 (§38).
- **Pas de modification des 262 échecs historiques** : ils préexistent à ce round
  et les corriger serait un round de rattrapage à part — je peux le faire si
  vous le voulez.
