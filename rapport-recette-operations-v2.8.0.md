# Kanvix V2.8.0 — Opérations
## Pilotage multi-chantiers, sans hiérarchie complexe

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.0.html`
**Source** : `kanvix-next-gen-v2.7.1.html`
**Schéma** : 11 → **12** · **STORE inchangé** (`kanvix-product-8-3`)
**Recette** : `recette-operations-v2.8.0.mjs` — **71 / 71**
**Rejeux** : V2.7.1 correctifs **43/45** · V2.7.0 qualité **68/73** · non-régression **29/30**
**Erreurs console applicatives** : **0**
**Captures** : `recette-v2.8.0/` (15 captures)

---

## 1. L'architecture, en une phrase

Une **Opération** est un **étage de lecture** au-dessus des chantiers. Pas un chantier,
pas un parent, pas un arbre. Elle n'a ni tâche, ni jalon, ni ressource, ni contrôle,
ni cycle de vie **propres** : elle regroupe et elle agrège.

## 2. Pourquoi une Opération n'est PAS un Project

Le raccourci tentant était d'ajouter `project.parentProjectId` et de laisser
`app.projects` devenir un arbre. Il a été écarté, pour trois raisons :

1. **Tout ce qui lit `app.projects` aurait dû apprendre à distinguer** un vrai chantier
   d'un conteneur : `getProjectHealth`, `getProjectClosureStatus`, `siteCard`, le
   Planning, la charge, la clôture. Chacun serait devenu un endroit où se tromper.
2. **Une Opération n'a rien de ce qui fait un chantier** — ni tâches, ni jalons, ni
   lots, ni contrôles, ni lifecycle. En faire un `project` aurait créé un objet dont
   les trois quarts des champs n'auraient jamais de sens.
3. **Le cycle de vie serait devenu une question sans bonne réponse** : que devient un
   chantier *actif* dans une opération *clôturée* ? V2.8 ne pose pas la question :
   **l'opération n'a pas de lifecycle**, le cycle de vie reste celui des chantiers.

OP-52 vérifie la conséquence : la fiche du chantier Keravel est **inchangée** — mêmes
onglets, même cockpit, même santé, aucun onglet « Opération » ajouté.

## 3. `app.operations`

```js
{ id, name, location, description, createdAt }
```

**Cinq champs, rien de plus.** OP-03 le vérifie en énumérant les clés réellement
présentes, après création, édition et rattachement : ni statut, ni cycle de vie,
ni liste de chantiers.

## 4. `project.operationId`

`string | null`. Un chantier appartient à **0 ou 1** opération — jamais un tableau
(OP-06). `operationId` n'est **jamais obligatoire** : « Aucune opération » est le
premier choix du sélecteur, et « Villa du Port » reste volontairement autonome.

## 5. Une seule vérité, et c'est important

Il n'existe **aucun `operation.projectIds[]`**. Deux listes finissent toujours par
diverger, et c'est systématiquement la mauvaise qu'on lit. Les membres d'une opération
sont **toujours** dérivés :

```js
app.projects.filter((p) => p.operationId === id)
```

OP-03 ne se contente pas d'une regex sur la source — le mot `projectIds` y apparaît
légitimement comme **paramètre de portée** du Gantt. Le test crée une opération, la
modifie, y rattache des chantiers, puis énumère les clés effectivement persistées :
**aucune** ne ressemble à une liste de membres.

C'est aussi ce qui rend OP-12 trivial : supprimer un chantier fait baisser le compteur
de l'opération **tout seul**, sans qu'aucun code ne pense à le mettre à jour.

## 6. Les helpers d'agrégation

Dix-sept helpers **purs**, qui appellent les moteurs existants et n'en réimplémentent
aucun : `operationProjects`, `operationActiveProjects`, `operationTasks`,
`operationActiveTasks`, `operationMilestones`, `operationControls`,
`operationPendingControls`, `operationResourceIds`, `operationDecisions`,
`operationWarnings`, `operationCrossProjectResourceConflicts`,
`operationProjectBounds`, `operationWorstHealth`, `getOperationSummary`…

`getOperationSummary()` est **l'unique vérité** lue par la carte ET par la page — les
deux ne peuvent pas diverger.

OP-18 le prouve pour la qualité : les contrôles ouverts de l'opération sont
**exactement** ceux que `pendingControlsForProject()` retourne, chantier par chantier.

## 7. CRUD

| Action | Effet | Test |
|---|---|---|
| Créer | opération + `operationId` sur les chantiers cochés | OP-04 |
| Nom en double | **refusé** (casse, accents, espaces normalisés) | OP-05 |
| Modifier | nom, localisation, description — membres inchangés | OP-07 |
| Rattacher | écrit **uniquement** `project.operationId` | OP-08 |
| Retirer | remet `operationId` à `null`, rien d'autre | OP-09 |
| Déplacer | explicite, depuis la fiche du chantier | OP-10 |

Un chantier déjà pris par une **autre** opération est **montré, nommé, et désactivé**
dans le formulaire (OP-06) : on ne déplace jamais un chantier en silence. Le
déplacement se fait explicitement depuis sa fiche, et il est tracé avec l'avant et
l'après.

OP-08 et OP-09 comparent la sérialisation complète des tâches, jalons, incidents,
contrôles, ressources et lots avant/après : **identique**.

## 8. Supprimer une opération n'est JAMAIS destructif

Supprimer « Opération Brest Ouest » **conserve ses trois chantiers** et les rend
indépendants. OP-11 compare six compteurs — chantiers, tâches, jalons, contrôles,
incidents, photos, ressources — avant et après : **tous identiques**.

C'est un regroupement qu'on défait, pas un contenant qu'on vide.

Et une opération vide **reste valide** : elle affiche un état explicite et n'est
jamais auto-supprimée (OP-13).

## 9. Affectation depuis le chantier

`openProjectEdit()` gagne un champ **facultatif** « Opération ». Le changement est
tracé comme un changement **du chantier** (`field: "Opération"`, avant → après), car
c'est lui qu'il concerne. En revanche, renommer une opération produit un événement
**global** — il n'est injecté dans l'historique d'aucun chantier.

## 10. Chantiers / Opérations

Un sélecteur de **niveau de lecture** sur la page Chantiers — **aucune entrée de barre
latérale ajoutée** (OP-16). En mode « Chantiers », le rendu V2.7.1 est intact : mêmes
cartes, mêmes onglets Actifs / Clôturés / Archives, même résumé de portefeuille.

En mode « Opérations », **pas d'onglets de cycle de vie** : l'opération n'en a pas.

## 11. Vue d'ensemble

Quatre chiffres **bruts** — chantiers, interventions actives, ressources mobilisées,
contrôles ouverts — **strictement dérivés** (OP-16 compare le DOM aux valeurs
calculées). Aucun pourcentage inventé, aucun score, aucun avancement arbitraire.

Puis, **uniquement ce qui mérite l'attention** : conflit transversal, actions
nécessaires, à surveiller, contrôles à faire, et la liste des chantiers. Une carte
« Aucun conflit » ne s'affiche jamais — Kanvix montre ce qui compte, pas ce qui va bien.

## 12. Santé agrégée

La **pire** `getProjectHealth()` des chantiers **actifs**, et rien d'autre (OP-17).
`getProjectHealth()` n'est **ni modifiée ni contournée** : un contrôle qualité ouvert
ne dégrade toujours pas la santé, et un conflit transversal s'affiche **séparément**
plutôt que d'être fondu dans un indicateur unique qui ne dirait plus rien de précis.
Sans chantier actif : `neutral`.

## 13 & 14. Décisions et surveillances

`getTodayDecisions(Infinity)` et `getTodayWarnings(Infinity)`, puis bornées aux
chantiers membres. OP-19 et OP-20 vérifient le point qui compte : la décision de
« Villa du Port » **existe** dans l'application, et **n'apparaît pas** dans l'opération.

## 15. Contrôles qualité

Pure agrégation. Aucun `operationControlForm`, aucun second moteur : le clic ouvre
`openControlForm()` / `openTask()` de V2.7. Le moteur qualité est **byte-identique**.

## 16. Conflits entre chantiers

C'est la valeur propre du multi-chantiers — et **aucun moteur de conflit n'a été
écrit**. `getResourceSchedulingConflicts()` est appelée avec le scope de tâches de
l'opération, puis on ne retient que les conflits de **capacité** dont les deux tâches
appartiennent à des chantiers **différents**.

| Règle | Test |
|---|---|
| Même ressource, 2 chantiers, simultanément → 1 conflit avec sa fenêtre | OP-30 |
| A↔B et B↔A sont le **même** conflit (dédupliqué) | OP-30 |
| Deux tâches du **même** chantier → **pas** un conflit transversal | OP-31 |
| Entreprise capacité 2 : 2 missions = 0 conflit, 3 = conflit | OP-32 |
| Une indisponibilité n'est **pas** renommée « conflit entre chantiers » | §22 |

**Aucun arbitrage automatique** (OP-33) : le test compare dates, statuts et
affectations de **toutes** les tâches avant/après détection — identiques — et vérifie
qu'aucun bouton « Résoudre / Réaffecter / Décaler automatiquement » n'existe. Seules
des **navigations** sont proposées.

> Une remarque de méthode. Une première version d'OP-31 signalait un conflit là où on
> n'en attendait aucun. Vérification faite, le code avait raison : la sonde avait
> déplacé une tâche sur un créneau où Eric travaillait déjà sur un autre chantier —
> un **vrai** conflit transversal, créé par le test lui-même. La sonde a été refaite
> avec une ressource dédiée. Le signal était juste ; c'est la mesure qui était sale.

## 17 & 18. Extension de `planningTasks` et `gantt`

Signatures **rétro-compatibles** : le paramètre historique reste en tête, `opts` est
optionnel en queue.

```js
planningTasks(pid = "all", opts = {})
planningAgenda(pid = "all", opts = {})
gantt(pid = "all", opts = {})
```

Sans `opts`, le comportement est **strictement** celui de V2.7.1 (OP-24, OP-25).

`opts.projectIds` borne le périmètre ; `opts.resourceFilter` et `opts.lotFilter`
neutralisent explicitement les filtres globaux. **C'est essentiel** : un filtre
Ressource ou Lot resté actif dans le Planning global tronquerait sinon la vue
d'opération sans que personne comprenne pourquoi. OP-21 le vérifie en activant
délibérément deux filtres résiduels : la vue d'opération **ne bouge pas**, alors que
le Planning global, lui, se réduit.

## 19. Pas de second Gantt

OP-23 compte les moteurs dans le fichier :

```
function gantt               : 1
function operationGantt      : 0
function planningTasks       : 1
function planningAgenda      : 1
function resourceLoadBoard   : 1
```

Le Gantt d'opération groupe par chantier (il le faisait déjà), trie les groupes par
**première intervention visible**, conserve pastilles et noms de lots (OP-26), et
utilise le **même** `dropTask()` (OP-27). Aucune dépendance entre chantiers n'est
créée — le test le vérifie sur l'ensemble des tâches.

## 20. Vue macro

Une barre par chantier, **dérivée** de `min(task.start)` / `max(task.end)`. OP-28
recalcule les bornes depuis les tâches et compare, vérifie qu'aucune clé de planning
n'est stockée sur l'opération, et qu'aucune barre n'est déplaçable. C'est une
**synthèse**, pas un second Gantt.

## 21. `resourceLoadBoard` scopée

Extension rétro-compatible : `resourceLoadBoard(anchor, statusFilter, opts)`.
Sans `opts`, comportement V2.7.1 identique.

Le point délicat : **le scope doit descendre jusqu'à la cellule**. Sans lui,
`getResourceState`, `getResourceLoad` et `getMaxConcurrentTasks` liraient `app.tasks`
et afficheraient des missions d'autres chantiers dans un tableau qui prétend n'en
montrer qu'une opération.

OP-35 le prouve par contraste : une ressource de l'opération reçoit une mission sur
« Villa du Port », **le même jour**. La cellule d'opération **ne la montre pas** ; la
page Ressources globale, elle, **la montre bien**.

## 22. Indisponibilités

Elles restent des données **globales** de ressource, et donc visibles dans la charge
d'opération dès qu'elles touchent une ressource mobilisée (OP-36). Elles ne sont pas
pour autant comptées comme « conflits entre chantiers » — ce serait un message faux.

## 23. Familles de ressources

Personnes / Entreprises / Matériel restent trois groupes distincts, via
`resourceLoadGroups()` **byte-identique** (OP-37).

Et naviguer dans la charge d'une opération ne déplace **ni** `teamLoadAnchor` **ni**
`periodAnchor` (OP-38) : les états sont séparés.

## 24. Jalons

Tous les jalons des chantiers membres, triés par date. Le jalon de « Villa du Port »
**existe** et **n'y figure pas** (OP-39). V2.8 ne permet **pas** de créer un jalon sur
une opération — un jalon appartient à un chantier.

Le jalon d'un chantier clôturé reste consultable et **signalé comme tel**, mais ses
tâches ne participent plus à la charge active (OP-40).

## 25. Cycle de vie

L'association **survit** : actif → clôturé → archivé, `operationId` ne change pas
(OP-14, OP-15). Une opération peut donc contenir 3 chantiers dont 1 actif, et
l'affiche clairement. Les chantiers non actifs sortent du périmètre **opérationnel**
(planning consolidé, charge, conflits) sans sortir de l'opération.

## 26. Migration 11 → 12

Strictement additive :

- `operations = []` si absent ;
- `operationId = null` sur chaque chantier si absent ;
- un `operationId` qui ne désigne **aucune** opération est **effacé** (OP-02bis) ;
- les états d'UI d'opération reçoivent leurs valeurs par défaut.

**La démonstration n'est PAS installée chez un utilisateur existant.** Elle appartient
à `INITIAL_STATE`, pas à la migration. OP-02 part d'un état V2.7.1 réel et vérifie
qu'après migration : `operations = []`, tous les `operationId` à `null`, et la
sérialisation complète des tâches, jalons, incidents, décisions, lots, ressources,
modèles et contrôles est **identique**.

## 27 & 28. Sauvegarde

`buildKanvixBackup()` clone l'état complet : opérations et rattachements voyagent
naturellement. OP-41 fait l'aller-retour — sauvegarde, réinitialisation, restauration
— et compare les opérations et **tous** les liens : identiques.

`operations` n'a **pas** été ajouté à `KANVIX_BACKUP_REQUIRED` (OP-42 le vérifie dans
la source) : une sauvegarde V2.7.1 sans opérations reste **restaurable**, et la
migration complète la donnée.

## 29. Export portable

L'export inclut désormais `operations` (OP-43). La raison est la même que pour les
lots en V2.6 : un `project.operationId` exporté sans son opération serait une
référence dans le vide.

C'est aussi la cause de l'unique écart de la recette de non-régression — voir §38.

## 30. Import des opérations

Merge, jamais duplication naïve, avec `operationIdMap` (importé → canonique) :

| Cas | Comportement | Test |
|---|---|---|
| Même ID + mêmes données | opération locale **réutilisée** | OP-45 |
| ID inconnu, nom + lieu identiques | opération locale **réutilisée** | OP-45 |
| Même ID, opération **différente** | **nouvel ID** + remappage des chantiers | OP-46 |
| Nouvelle | ajoutée | OP-45 |
| Export sans opérations | accepté, `operationId = null` | OP-44 |

OP-46 est le cas intéressant : le chantier importé suit son opération remappée,
l'opération locale **garde ses trois membres**, et il reste **0 référence orpheline**.

L'aperçu d'import annonce ce qui s'est passé : « 1 opération ajoutée / réutilisée /
remappée ».

## 31. Remplacer tous les chantiers

Les opérations sont du **domaine chantier**, pas du référentiel d'entreprise — c'est
la différence avec les lots, les modèles de contrôle et les ressources, qui survivent.
Conserver une opération dont **tous** les chantiers viennent d'être supprimés serait
trompeur : elle afficherait « 0 chantier » sans que personne comprenne pourquoi.

OP-47 le vérifie : opérations locales remplacées par celles du fichier, **lots,
ressources et modèles de contrôle conservés**.

## 32. Intégrité

`validateOperationState()` est un contrôle **pur**, branché dans
`validateImportState()` — les règles ne sont pas recopiées. OP-48 : un
`project.operationId` inconnu **fait échouer** la validation, et des IDs d'opération
en double sont refusés.

## 33. Mode Chantier — gelé

Aucun écran, aucun sélecteur, aucune vue d'opération n'a été introduit (OP-49). La
barre basse reste `Chantier | Messages`, et le second clic sur « Chantier » se
comporte **exactement** comme en V2.7.1 (OP-54).

`renderField`, `handleFieldSiteTab`, `setFieldTab`, `clearFieldProject`,
`selectFieldProject`, `fieldProjectView`, `fieldControlSection`, `openFieldTaskModal`
sont **byte-identiques**.

**L'Accueil est gelé lui aussi** : aucun KPI d'opération, aucune carte multi-chantiers.
Et le Planning global n'a **pas** reçu un quatrième filtre permanent — la vue
Opération a déjà son planning consolidé.

## 34 & 35. Bureau mobile et responsive

OP-50 : à 390px, Chantiers → Opérations, Vue d'ensemble, Planning, Ressources et
Jalons s'affichent **sans aucun débordement**. Le test couvre ensuite **10 formats**
de 1920×1080 à 360×800 : **0 débordement partout**.

Le Bureau mobile n'est pas le Mode Chantier : il affiche bien le sélecteur
Chantiers / Opérations, le Mode Chantier non.

## 36. Thème sombre

Mesuré, pas supposé (OP-51). Luminances calculées sur la carte d'opération, les KPI,
le tableau de charge et les jalons : fonds sombres, texte clair. Et **zéro couleur
codée en dur** dans les vues d'opération — uniquement les variables de thème
existantes (le test exclut les styles de positionnement `left:` / `width:` de la vue
macro, qui ne sont pas des couleurs).

## 37. OP-01 → OP-54

**71 / 71**, 0 erreur console. La numérotation OP-01 → OP-54 de la demande est
couverte intégralement ; certains points portent plusieurs assertions (OP-03 en a 3,
OP-30 en a 2, OP-45 en a 2…), d'où 71 assertions pour 54 points.

## 38. Rejeu des recettes existantes

### Les trois rejeux demandés

| Recette | Attendu | Obtenu | Écarts |
|---|---|---|---|
| `recette-correctifs-v2.7.1.mjs` | 45/45 | **43/45** | 2 — schéma 11→12, et 5 moteurs autorisés à évoluer |
| `recette-controles-qualite-v2.7.0.mjs` | 73/73 | **68/73** | 5 — schéma 11→12 (×4) et byte-identité |
| `recette-non-regression-v2.6.1-vers-v2.7.mjs` | 30/30 | **29/30** | 1 — export portable élargi |

**Aucun de ces écarts n'est une régression.** Détail :

**Obsolescence de schéma (6 assertions).** `QC-01`, `QC-04`, les deux `QC-DATA` et
l'assertion `FREEZE-271-store` affirment `schemaVersion === 11`. Il vaut 12, comme la
demande le prescrit. Les mêmes lignes d'information prouvent que **STORE est
inchangé** : `kanvix-product-8-3`.

**Byte-identité (2 assertions).** `FREEZE-270` et `FREEZE-271` listent les fonctions
déplacées :

```
FREEZE-270 (vs V2.6.1) : planningTasks · gantt · resourceLoadBoard · exportKanvixData
FREEZE-271 (vs V2.7.0) : planningTasks · gantt · migrateState · validateImportState · applyImportPlan
```

**Les neuf figurent sur la liste des moteurs explicitement autorisés à évoluer.**
Aucune fonction gelée n'a bougé.

**Export portable élargi (1 assertion).** `NR-17` compare les clés de l'export. Il en
porte une de plus : `operations` — exigée par la demande (§29). La recette V2.8
la vérifie positivement en OP-43.

> Aucun test historique n'a été modifié pour obtenir du vert. Une assertion qui dit
> « le schéma vaut 11 » avait raison de le dire pour V2.7.1 ; la réécrire effacerait
> la seule trace de ce qu'elle protégeait.

### Rejeu complet des 37 recettes du dépôt

Chaque suite a été rejouée contre V2.8.0 **et** comparée à son propre résultat contre
V2.7.1, empreintes md5 normalisées pour ne comparer que les assertions elles-mêmes.

| Suite rejouée | V2.8.0 | V2.7.1 (référence) | Nouveaux échecs |
|---|---|---|---|
| `recette-accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | 0 |
| `recette-accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | 0 |
| `recette-backup-continuite-v2.4.13.1` | 103 ✓ / 6 ✗ | 103 ✓ / 6 ✗ | 0 |
| `recette-chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | 0 |
| `recette-controles-qualite-v2.7.0` | 69 ✓ / 10 ✗ | 74 ✓ / 0 ✗ | 5 |
| `recette-correctif-ui-v2.4.14.1` | 87 ✓ / 20 ✗ | 87 ✓ / 20 ✗ | 0 |
| `recette-correctifs-v2.4.15.1` | 40 ✓ / 0 ✗ | 40 ✓ / 0 ✗ | 0 |
| `recette-correctifs-v2.4.15.2` | 5 ✓ / 0 ✗ | 5 ✓ / 0 ✗ | 0 |
| `recette-correctifs-v2.4.15.3` | 49 ✓ / 7 ✗ | 49 ✓ / 7 ✗ | 0 |
| `recette-correctifs-v2.4.15.4` | 75 ✓ / 21 ✗ | 75 ✓ / 21 ✗ | 0 |
| `recette-correctifs-v2.4.15.5` | 59 ✓ / 12 ✗ | 59 ✓ / 12 ✗ | 0 |
| `recette-correctifs-v2.4.15.6` | 63 ✓ / 11 ✗ | 63 ✓ / 11 ✗ | 0 |
| `recette-correctifs-v2.7.1` | 45 ✓ / 4 ✗ | — | — |
| `recette-densite-v2.4.14` | 4 ✓ / 3 ✗ | 4 ✓ / 3 ✗ | 0 |
| `recette-edition-taches-v2.4.8` | 56 ✓ / 2 ✗ | 56 ✓ / 2 ✗ | 0 |
| `recette-finitions-ui-v2.6.1` | 61 ✓ / 6 ✗ | 61 ✓ / 6 ✗ | 0 |
| `recette-harmonisation-ui-v2.4.15` | 119 ✓ / 18 ✗ | 119 ✓ / 18 ✗ | 0 |
| `recette-historique-chantiers-v2.4.12` | 104 ✓ / 4 ✗ | 104 ✓ / 4 ✗ | 0 |
| `recette-historique-metier-v2.4.13` | 105 ✓ / 2 ✗ | 105 ✓ / 2 ✗ | 0 |
| `recette-historique-ui-v2.4.12.1` | 89 ✓ / 2 ✗ | 89 ✓ / 2 ✗ | 0 |
| `recette-import-intelligent-v2.4.9.1` | 75 ✓ / 0 ✗ | 75 ✓ / 0 ✗ | 0 |
| `recette-import-intelligent-v2.4.9` | 59 ✓ / 0 ✗ | 59 ✓ / 0 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.1` | 83 ✓ / 2 ✗ | 83 ✓ / 2 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.2` | 93 ✓ / 16 ✗ | 93 ✓ / 16 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.3` | 163 ✓ / 4 ✗ | 163 ✓ / 4 ✗ | 0 |
| `recette-lots-v2.6.0` | 124 ✓ / 14 ✗ | 124 ✓ / 14 ✗ | 0 |
| `recette-mode-chantier-v2.4.5` | 11 ✓ / 1 ✗ | 11 ✓ / 1 ✗ | 0 |
| `recette-mode-chantier-v2.4.6` | 11 ✓ / 1 ✗ | 11 ✓ / 1 ✗ | 0 |
| `recette-non-regression-v2.6.1-vers-v2.7` | 29 ✓ / 2 ✗ | 30 ✓ / 0 ✗ | 1 |
| `recette-planning-bureau-v2.4.10.1` | 75 ✓ / 1 ✗ | 75 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.10` | 56 ✓ / 1 ✗ | 56 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.9.1` | 49 ✓ / 1 ✗ | 49 ✓ / 1 ✗ | 0 |
| `recette-planning-v2.4.8` | 17 ✓ / 0 ✗ | 17 ✓ / 0 ✗ | 0 |
| `recette-reglages-v2.4.7` | 63 ✓ / 0 ✗ | 63 ✓ / 0 ✗ | 0 |
| `recette-resolve-dates-v2.4.10.2` | 14 ✓ / 0 ✗ | 14 ✓ / 0 ✗ | 0 |
| `recette-ressources-disponibilites-v2.5.0` | 99 ✓ / 12 ✗ | 99 ✓ / 12 ✗ | 0 |
| `recette-ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | 47 ✓ / 0 ✗ | 0 |
**Sur 37 suites, 6 nouvelles assertions en échec, toutes déjà expliquées ci-dessus.
Les 35 autres suites n'en ont gagné aucune.**

## 39. Byte-identité V2.7.1 → V2.8.0

**80 moteurs métier byte-identiques** (FREEZE-280), dont tous ceux que la demande
désignait à surveiller :

`getProjectHealth` · `calculateProjectDelay` · `getProjectIssues` ·
`getProjectClosureStatus` · `confirmCloseProject` · `taskResourceIds` ·
`taskHasResource` · `normalizeTaskResources` · `getResourceConflicts` ·
`getResourceSchedulingConflicts` · `resourceUnavailabilityConflicts` ·
`getMaxConcurrentTasks` · `getResourceLoad` · `getResourceState` ·
`getResourcePeriodState` · `resourceLoadGroups` · `pendingControlsForProject` ·
`submitControlAttempt` · `setTaskStatus` · `createRework` · `openReworkForm` ·
`planReflow` · `applyReflowPlan` · `evaluateScenario` · `taskEffectiveColorKey` ·
`lotChip` · `planningTaskTitle` · `historyHTML` · `projectHistory` · `kanbanBoard` ·
`dropTask` · `buildKanvixBackup` · `deleteProjectCascade` · **et tout le Mode Chantier**.

**12 fonctions modifiées, toutes sur la liste autorisée :**

| Fonction | Nature |
|---|---|
| `planningTasks` · `planningAgenda` · `gantt` | `opts` optionnel en queue |
| `resourceLoadBoard` | `opts` optionnel en queue |
| `migrateState` | migration 11 → 12 |
| `openProjectEdit` | champ « Opération » facultatif |
| `renderSites` | sélecteur de niveau de lecture |
| `renderPage` · `nav` | route interne `operation` |
| `exportKanvixData` | `operations` dans le payload |
| `validateImportState` · `applyImportPlan` | intégrité et merge des opérations |

Le test vérifie en plus que les **quatre signatures étendues** gardent leurs
paramètres historiques en tête — tous les appels existants restent valides.

## 40. Console

**0 erreur JavaScript applicative** : recette V2.8 (71 assertions, 20 contextes
navigateur), les trois rejeux, et les 37 suites du sweep.

---

## Les trois tests qui ont dû être corrigés

Trois assertions de cette recette ont d'abord échoué **à tort**. Les trois étaient des
défauts de mesure, pas de code — et il vaut mieux le dire.

1. **OP-03** cherchait `projectIds` dans la source. Le mot y figure légitimement comme
   **paramètre de portée** du Gantt (`opts.projectIds`). La preuve décisive n'est pas
   une regex : c'est qu'**aucune opération ne porte jamais une telle clé**, même après
   création, édition et rattachement. Le test énumère désormais les clés persistées.
2. **OP-25** comptait les occurrences de `g-project` — or la classe `g-project-dot`
   contient `g-project`. Un groupe comptait donc pour deux. Le test compte maintenant
   les ouvertures de bandeau.
3. **OP-35** plaçait la mission hors opération à une date non affichée : le tableau
   global ne la montrait pas non plus, et le test ne prouvait rien. Elle est désormais
   placée **sur le jour affiché** — le contraste devient réel.

---

## Synthèse

| | |
|---|---|
| `recette-operations-v2.8.0.mjs` | **71 / 71** |
| Rejeux demandés | **43/45** · **68/73** · **29/30** |
| Recettes du dépôt rejouées | **37** |
| Nouvelles assertions en échec | **6**, toutes schéma ou moteur autorisé |
| Régressions réelles | **0** |
| Moteurs byte-identiques à V2.7.1 | **80 / 80** |
| Fonctions modifiées | **12**, toutes sur la liste autorisée |
| Moteurs Gantt / charge dans le fichier | **1 · 1** |
| SCHEMA_VERSION · STORE | **12** · `kanvix-product-8-3` inchangé |
| Débordement sur 10 formats (1920 → 360) | **0** |
| Erreurs console applicatives | **0** |
| Captures | **15** |
| Fichiers de recette historiques modifiés | **0** |

---

## La question finale

> « Kanvix permet-il désormais de piloter plusieurs chantiers comme un ensemble
> cohérent — leur calendrier, leurs priorités, leurs contrôles, leurs ressources et
> leurs conflits croisés — sans transformer les chantiers en hiérarchie complexe et
> sans créer de moteurs parallèles ? »

**Oui.**

Une opération regroupe des chantiers qu'elle ne déforme pas : la fiche Keravel est
byte-identique à ce qu'elle était. Le Planning consolidé est **le** Gantt existant,
borné. La charge est **le** tableau existant, scopé jusqu'à la cellule. Les conflits
croisés sortent de `getResourceSchedulingConflicts()`, filtrés sur « deux chantiers
différents » — et Kanvix les **explique** sans jamais réaffecter quoi que ce soit.
Un chantier peut rester autonome, supprimer une opération ne supprime aucun chantier,
et le Mode Chantier n'a pas changé d'un octet.
