# Kanvix V2.7.0 — Contrôles qualité
## Rapport de recette

**Fichier livré** : `public/poc/kanvix-next-gen-v2.7.0.html`
**Source** : `kanvix-next-gen-v2.6.1.html`
**Schéma** : 10 → **11** · **STORE inchangé** (`kanvix-product-8-3`)
**Recettes** : `recette-controles-qualite-v2.7.0.mjs` (**73 / 73**) · `recette-non-regression-v2.6.1-vers-v2.7.mjs` (**30 / 30**)
**Erreurs console applicatives** : **0**
**Captures** : `recette-v2.7.0/` (17 captures)

---

## 0. Document de cadrage

> **Point à signaler d'emblée.** Le document `KANVIX_recommandations_plan_developpement_IA(1).md`,
> que la demande cite comme cadre à prendre en compte, **n'est pas présent dans le dépôt**
> (`git ls-files | grep -i recommandation` → aucun résultat). Il n'a donc **pas pu** être lu
> ni appliqué. Ce qui suit est construit sur la demande elle-même et sur les invariants
> établis des versions précédentes. Si ce document existe, il reste à confronter à cette
> livraison — et c'est le seul point de cette mission qui n'a pas pu être honoré.

---

## 1. Ce que V2.7.0 apporte, en une phrase

Kanvix savait dire **« ce travail est terminé »**. Il sait désormais dire, séparément,
**« ce travail est contrôlé »** — et ce sont deux questions différentes.

**TRAVAIL TERMINÉ ≠ TRAVAIL CONTRÔLÉ.** Une intervention peut être *Terminée* pendant que
son contrôle reste *À contrôler* : c'est le comportement par défaut, et il est volontaire
(QC-21). Un modèle peut être déclaré **bloquant** — alors, et alors seulement, la fin de
l'intervention et la clôture du chantier sont réellement empêchées (QC-22, QC-45, QC-46).

---

## 2. Le principe qui gouverne tout le reste

> **Kanvix DÉTECTE, TRACE et PROPOSE. Il ne décide pas.**

Une non-conformité ne crée **aucun** incident, **aucune** reprise, **aucun** message,
ne déplace **aucune** date et ne rouvre **aucune** tâche. QC-41 le vérifie en comparant
l'état complet avant/après : nombre d'incidents, de décisions, de messages, de tâches,
de reprises, statut de la tâche, et la sérialisation de **toutes** les dates de **toutes**
les tâches. Ce qui suit une non-conformité est **proposé** — « Recontrôler plus tard » ou
« Créer une reprise » — et la reprise passe par `openReworkForm()`, le moteur existant
(QC-42), jamais par une seconde mécanique.

---

## 3. Modèle de données (schéma 11)

| Objet | Rôle | Durée de vie |
|---|---|---|
| `app.controlTemplates[]` | **Référentiel d'entreprise** : quoi vérifier | permanent |
| `app.controlInstances[]` | Le contrôle **réel** d'une intervention | vit et meurt avec l'intervention |
| `photo.controlId` | rattachement **facultatif** d'une photo existante | — |

**Un contrôle COPIE son modèle** à la création : `templateName`, `lotId`, `items`,
`photoRequired`, `blocking`. Renommer le modèle ensuite, changer ses points, sa photo ou
son caractère bloquant **ne réécrit aucun contrôle déjà créé** (QC-06). Un contrôle réalisé
il y a trois mois dit ce qui a été vérifié **à l'époque** — pas ce qu'on vérifierait aujourd'hui.

`attempts[]` conserve **toutes** les tentatives ; la racine porte le **dernier** résultat.
Une non-conformité suivie d'une remise en conformité laisse les **deux** traces (QC-37).

---

## 4. Migration 10 → 11 : strictement additive

**AUCUN contrôle rétroactif.** Une tâche historique qui correspond à un nouveau modèle ne
reçoit **pas** de contrôle. Le conducteur découvrirait sinon des dizaines de contrôles qu'il
n'a jamais demandés. QC-04 le prouve sur un état schéma 10 : 1 tâche correspond au motif,
2 modèles sont installés, **0 contrôle créé**. La migration est idempotente (QC-05).

Les contrôles naissent à trois moments explicites : au **démarrage** d'une intervention
(un contrôle peut devoir être fait *pendant* le travail — « avant fermeture des cloisons »),
**juste avant** son passage à terminé, ou d'un **ajout manuel**.

---

## 5. Le matching : une seule vérité, aucune inférence

`applicableControlTemplates(task)` — **actif** ∧ (**lot** universel ou identique) ∧
(**motif de nom** vide ou contenu dans le nom, accents et casse normalisés).

Il n'y a **ni regex utilisateur, ni classification, ni intelligence**. QC-14 le démontre
en changeant la **phase** et la **ressource** d'une intervention : aucun contrôle ne s'y
applique pour autant. Seuls le lot et le motif de nom comptent.

---

## 6. La garde : un seul endroit, zéro contournement

Les **quatre** chemins vers « terminé » — Kanban, fiche tâche, « J'ai terminé » artisan,
éditeur universel — passent **tous** par `setTaskStatus()`. QC-18 le vérifie deux fois :
les 4 écritures littérales de `status = "done"` du fichier visent une **décision**, jamais
une tâche ; et les 4 parcours nommés appellent bien le setter. **Une garde posée à cet
endroit unique ne peut pas être contournée.**

Quand elle refuse, **rien n'est écrit** — ni statut, ni historique, ni point d'annulation
(QC-22). La tâche reste exactement dans son état précédent.

### Ce que le blocage n'empêche PAS

| | |
|---|---|
| Démarrer l'intervention **suivante** | **autorisé** (QC-25) |
| Les **jalons** | **intouchés** (QC-26) |
| Une tâche **déjà terminée** | **jamais rouverte** (QC-27) |
| `getProjectHealth()` | **byte-identique à V2.6.1** (QC-50) |

Un contrôle en attente **ne dégrade jamais la santé d'un chantier**. C'est un fait vérifié
par empreinte md5, pas une intention.

### L'artisan ne contrôle pas

Un contrôle bloquant empêche son « J'ai terminé » avec **une explication seule** — aucun
bouton de contrôle ne lui est proposé (QC-24). Au conducteur, le même blocage propose
l'action utile : « Effectuer le contrôle » (QC-23). Ce n'est pas un mur, c'est un renvoi.

---

## 7. Un seul formulaire, bureau et chantier

`controlFormHTML()` et `submitControlAttempt()` existent **chacun en un seul exemplaire**
(QC-29) — aucune fonction `controlFormDesk` / `controlFormField`. Seule l'enveloppe change :
sidewindow au bureau, popup quasi plein écran en Mode Chantier.

**Règles de validation** (les mêmes des deux côtés) :

| Verdict | Exigence | Test |
|---|---|---|
| Conforme | **tous** les points cochés | QC-30 |
| Conforme / Non conforme | photo si `photoRequired` | QC-31, QC-32 |
| Non conforme | description de la non-conformité | QC-33 |
| Non applicable | **motif** obligatoire | QC-34 |

Écarter un contrôle est une décision tracée, jamais un clic anodin.

**Ergonomie terrain mesurée** : à 390 **et** 430px, chaque ligne de checklist et chaque
bouton de verdict mesure **exactement 44px**, sans débordement horizontal (QC-38).

---

## 8. Les photos : un seul moteur, aucun orphelin

La photo est créée par `addPhoto()` — la galerie unique du chantier — puis reçoit un
`controlId`. Le contrôle ne stocke que des `photoIds` : **aucune image n'est dupliquée**
dans l'objet contrôle (QC-35, vérifié en cherchant `base64` dans la sérialisation).

Une photo prise puis le formulaire **annulé** ne laisse **aucune photo orpheline** (QC-36) :
le brouillon n'est écrit qu'à la validation.

---

## 9. Trace : un seul journal

Un seul `app.history` (QC-40 : aucune clé `qualityHistory` / `controlHistory` / `auditLog`).
L'événement `quality-control` porte `eventType`, `projectId`, `taskId`, `taskName`,
`controlId`, `controlName`, `controlStatus`, `attemptNumber`, `author`, `date` (QC-39).

Les événements de **référentiel** (modèle créé, modifié, désactivé) restent **globaux** :
sans `projectId` ni `taskId`, ils n'apparaissent dans l'historique d'aucun chantier (QC-43) —
exactement la règle déjà appliquée aux lots.

---

## 10. Clôture de chantier

`getProjectClosureStatus()` expose désormais `openQualityControls` et
`blockingQualityControls`, et « prêt à clôturer » exige **zéro contrôle ouvert** (QC-44).

- Contrôle **non bloquant** → « Clôturer quand même » reste proposé.
- Contrôle **bloquant** → ce bouton **disparaît**, remplacé par « Voir les contrôles » (QC-45).

`confirmCloseProject()` porte sa **propre** garde : appelée directement, sans passer par le
popup, elle refuse quand même (QC-46). La sécurité métier ne dépend jamais du seul bouton visible.

---

## 11. Divulgation progressive : rien de plus dans la navigation

**Aucun onglet « Qualité ». Aucune entrée de barre latérale.** (QC-47, vérifié sur
`projectTabs()` et sur le DOM de la sidebar.) Le contrôle vit là où le travail se regarde :

| Où | Quoi |
|---|---|
| Réglages → Référentiel métier | « Contrôles qualité · N modèles actifs » — **niveau Pilotage seulement** (QC-48) |
| Fiche tâche | section « Contrôles qualité · N à faire » + « + Ajouter un contrôle » |
| Onglet Aujourd'hui | bloc **compact** « Contrôles à faire · N », **3 lignes au plus** + lien (QC-47) |
| Mode Chantier | « À contrôler » + résumé dans la popup Tâche |

La gestion des modèles est un **sidewindow**, pas une page — même grammaire que les lots,
et les classes de liste et de formulaire existantes sont **réutilisées telles quelles**.

---

## 12. Sauvegarde, import, suppression

| Situation | Comportement | Test |
|---|---|---|
| Sauvegarde Kanvix | emporte modèles **et** contrôles | QC-DATA |
| Sauvegarde **V2.6** (sans qualité) | **restaurable**, 2 modèles installés, **0 contrôle rétroactif** | QC-DATA |
| Export portable | **non élargi** — reste un export de planning | QC-DATA |
| « Remplacer tous les chantiers » | contrôles supprimés **et annoncés**, **modèles conservés** | QC-DATA |
| Supprimer un chantier / une tâche | contrôles emportés, **zéro orphelin**, modèles intacts | QC-DATA |

La frontière est la même que pour les lots : **le référentiel est une donnée d'entreprise,
les contrôles sont du contenu de chantier.**

`validateQualityState(S)` est un contrôle d'intégrité **pur** (QC-07 : aucune mutation), et
c'est la **seule** vérité consultée par `validateImportState()` — les règles ne sont pas recopiées.

---

## 13. Un défaut réel trouvé — et corrigé — pendant la recette

C'est le point le plus important de ce rapport.

**Symptôme.** Au rejeu des suites d'import (`recette-import-intelligent-v2.4.9` et `.1`),
**4 assertions échouaient** contre V2.7.0 et **0** contre V2.6.1 : IMP-04 (fusion de doublon)
et IMP-11 (remappage des dépendances).

**Diagnostic.** En branchant `validateQualityState()` dans `validateImportState()`, j'avais
rendu l'import **refusable à cause d'un orphelin qui lui préexistait**. Le scénario IMP-04
remplace les tâches d'un chantier avant d'importer ; le contrôle de démonstration pointait
alors vers une tâche disparue **avant** que l'import ne commence. L'import, parfaitement
légitime, était annulé et roulé en arrière.

**Ce n'était pas une obsolescence de test. C'était une régression que j'avais introduite.**

**Correction.** Un **balayage final** dans `applyImportPlan()` : tout contrôle dont la tâche
ou le chantier n'existe plus dans l'état produit est retiré et **compté dans les pertes
annoncées** ; toute photo pointant vers un contrôle disparu perd son `controlId`. Un import
est une transaction : l'état qu'il produit est intègre, sinon il n'est pas appliqué.

**Vérification.** Les deux suites repassent à **59 / 59** et **75 / 75** — exactement les
scores de la référence V2.6.1.

---

## 14. Rejeu de l'intégralité des recettes historiques

**34 suites** rejouées contre V2.7.0, **et** contre V2.6.1 pour toute suite présentant au
moins un échec — afin de séparer ce qui préexistait de ce que cette version a causé.
**Aucun fichier de recette historique n'a été modifié** (`git status` : 0 fichier suivi modifié).

| Suite rejouée | V2.7.0 | V2.6.1 (référence) | Écarts |
|---|---|---|---|
| `recette-accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | 0 |
| `recette-accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | 0 |
| `recette-backup-continuite-v2.4.13.1` | 103 ✓ / 6 ✗ | 103 ✓ / 6 ✗ | 0 |
| `recette-chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | 0 |
| `recette-correctif-ui-v2.4.14.1` | 87 ✓ / 20 ✗ | 88 ✓ / 19 ✗ | 1 |
| `recette-correctifs-v2.4.15.1` | 40 ✓ / 0 ✗ | 40 ✓ / 0 ✗ | 0 |
| `recette-correctifs-v2.4.15.2` | 5 ✓ / 0 ✗ | identique (0 échec) | — |
| `recette-correctifs-v2.4.15.3` | 49 ✓ / 7 ✗ | 50 ✓ / 6 ✗ | 1 |
| `recette-correctifs-v2.4.15.4` | 75 ✓ / 21 ✗ | 76 ✓ / 20 ✗ | 1 |
| `recette-correctifs-v2.4.15.5` | 59 ✓ / 12 ✗ | 61 ✓ / 10 ✗ | 2 |
| `recette-correctifs-v2.4.15.6` | 63 ✓ / 11 ✗ | 65 ✓ / 9 ✗ | 2 |
| `recette-densite-v2.4.14` | 4 ✓ / 3 ✗ | 4 ✓ / 3 ✗ | 0 |
| `recette-edition-taches-v2.4.8` | 56 ✓ / 2 ✗ | 56 ✓ / 2 ✗ | 0 |
| `recette-finitions-ui-v2.6.1` | 61 ✓ / 6 ✗ | 64 ✓ / 0 ✗ | 3 |
| `recette-harmonisation-ui-v2.4.15` | 119 ✓ / 18 ✗ | 120 ✓ / 17 ✗ | 1 |
| `recette-historique-chantiers-v2.4.12` | 104 ✓ / 4 ✗ | 104 ✓ / 4 ✗ | 0 |
| `recette-historique-metier-v2.4.13` | 105 ✓ / 2 ✗ | 105 ✓ / 2 ✗ | 0 |
| `recette-historique-ui-v2.4.12.1` | 89 ✓ / 2 ✗ | 89 ✓ / 2 ✗ | 0 |
| `recette-import-intelligent-v2.4.9.1` | 75 ✓ / 0 ✗ | 75 ✓ / 0 ✗ | 0 |
| `recette-import-intelligent-v2.4.9` | 59 ✓ / 0 ✗ | 59 ✓ / 0 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.1` | 83 ✓ / 2 ✗ | 83 ✓ / 2 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.2` | 93 ✓ / 16 ✗ | 93 ✓ / 16 ✗ | 0 |
| `recette-kanban-badges-v2.4.11.3` | 163 ✓ / 4 ✗ | 163 ✓ / 4 ✗ | 0 |
| `recette-lots-v2.6.0` | 124 ✓ / 14 ✗ | 130 ✓ / 2 ✗ | 6 |
| `recette-mode-chantier-v2.4.5` | 11 ✓ / 1 ✗ | 84 ✓ / 0 ✗ | 1 |
| `recette-mode-chantier-v2.4.6` | 11 ✓ / 1 ✗ | 95 ✓ / 0 ✗ | 1 |
| `recette-planning-bureau-v2.4.10.1` | 75 ✓ / 1 ✗ | 75 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.10` | 56 ✓ / 1 ✗ | 56 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.9.1` | 49 ✓ / 1 ✗ | 49 ✓ / 1 ✗ | 0 |
| `recette-planning-v2.4.8` | 17 ✓ / 0 ✗ | identique (0 échec) | — |
| `recette-reglages-v2.4.7` | 63 ✓ / 0 ✗ | identique (0 échec) | — |
| `recette-resolve-dates-v2.4.10.2` | 14 ✓ / 0 ✗ | identique (0 échec) | — |
| `recette-ressources-disponibilites-v2.5.0` | 99 ✓ / 12 ✗ | 99 ✓ / 12 ✗ | 0 |
| `recette-ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | identique (0 échec) | — |

### Les 18 écarts, un par un

**Aucun n'est une régression.** Ils se répartissent en trois familles.

#### A. Le périmètre annoncé (9 écarts, 6 suites)

`confirmCloseProject` (md5 `8a9af8a4 → e33d90da`) et `setTaskStatus` (`9bbb990c → f5d20ec8`)
changent d'empreinte. **C'est exactement le périmètre demandé** : la garde bloquante et la
matérialisation des contrôles. `setTaskStatus()` n'évolue que pour ces deux raisons —
FREEZE-270 le vérifie en cherchant toute autre logique ajoutée dans le bloc V2.7 : il n'y en a pas.

#### B. Obsolescence mécanique de tests de gel (9 écarts, 2 suites)

`recette-finitions-ui-v2.6.1` et `recette-lots-v2.6.0` contiennent des assertions de la forme
« SCHEMA_VERSION vaut 10 », « la sauvegarde s'annonce en version 2.6.0 », « ces N fonctions
sont byte-identiques à la version précédente ». Rejouées **sur une version postérieure**,
elles comparent V2.7.0 à V2.6.0 : le schéma vaut 11, et les fonctions du périmètre ont bougé.

La liste des fonctions « bougées » remontée par FREEZE-261 est d'ailleurs la **preuve** que
le périmètre est tenu :

```
setTaskStatus · validateImportState · applyImportPlan · migrateState · renderMore
```

Cinq fonctions, plus `confirmCloseProject` — et **rien d'autre**. FREEZE-270, écrit pour
cette version, vérifie que **56 moteurs métier protégés** sont byte-identiques à V2.6.1 :
`planningTasks`, `gantt`, `kanbanBoard`, `getResourceState`, `planReflow`, `applyReflowPlan`,
`evaluateScenario`, `openReworkForm`, `createRework`, `photoCaptureBlock`, `capturePhoto`,
`addPhoto`, `projectHistory`, `getProjectHealth`, tous les helpers de lots… **56 gelés, 0 bougé.**

> Je n'ai **pas** modifié ces suites historiques pour les faire passer. Une assertion qui dit
> « le schéma vaut 10 » a raison de le dire pour V2.6.1 ; la réécrire effacerait la seule
> trace de ce qu'elle protégeait.

#### C. Une évolution produit assumée (2 suites) — et ce que j'ai fait pour ne rien perdre

`recette-mode-chantier-v2.4.5` et `v2.4.6` s'arrêtent à leur étape **PM-F2**.

**Pourquoi.** La demande prescrit que `fieldControlSection` devienne « une liste des
ControlInstances (à contrôler + non conformes), état vide *Aucun contrôle qualité à réaliser.* ».
Jusqu'ici, cette section « À contrôler » listait les **tâches terminées** — elle confondait
*travail fini* et *travail vérifié*, ce que cette version corrige précisément. Les deux suites
cliquent un bouton « Signaler une reprise » **dans cette liste** ; il n'y est plus, et le
script s'interrompt là.

**Ce n'est pas une perte de fonctionnalité.** Le point d'entrée a changé de place, pas disparu :
il est sur la popup Tâche, en Mode Chantier comme au bureau (QC-49bis le vérifie).

**Mais c'est une perte de couverture**, et celle-là ne s'accepte pas. L'interruption laissait
plus de 70 assertions non exécutées — dont le scénario maître SAV, le plus précieux du dépôt.
J'ai donc **porté ce scénario en entier** dans la recette V2.7.0, par le nouveau chemin :
**QC-SAV-01 → SAV-14**. Popup, formulaire de reprise existant, aperçu photo, impact planning,
reprise créée, origine jamais rouverte, photo rattachée, successeur redirigé, replanification
par le moteur reflow sans déplacer une seule tâche terminée, « Prévenir » pré-rempli avec
photo jointe, reprise visible dans « Reprises en cours ».

**SAV-14 ferme la boucle** : tout ce parcours se déroule sans qu'aucun contrôle ne soit créé,
modifié ni validé, et sans un seul événement `quality-control`. La qualité ne s'invite jamais
d'elle-même dans un parcours de reprise.

---

## 15. La preuve la plus directe : sans contrôle, V2.7.0 = V2.6.1

`recette-non-regression-v2.6.1-vers-v2.7.mjs` n'écrit **aucune valeur attendue en dur**.
Elle exécute la **même** sonde sur les **deux** fichiers et compare. La version précédente
est la référence ; un écart est un écart, même plausible.

**30 sondes, 30 identiques**, dont : barres du Gantt et leurs classes de couleur, colonnes
et cartes du Kanban, filtre par lot (10 valeurs), couleur effective des 11 tâches, cycle
démarrer/terminer avec son historique, dépendances et successeurs, moteur de reprise,
plan de décalage en cascade, état et conflits des 10 ressources, charge par familles, santé
et retard des 4 chantiers, cockpits, clôture, décisions du jour, référentiel de lots, export
portable, Mode Chantier, débordement horizontal sur **6 formats** (1920 → 360), thème sombre.

Et la preuve directe (**NR-24**) : **modèles et contrôles vidés, l'onglet Aujourd'hui et la
fiche Tâche de V2.7.0 rendent le texte STRICTEMENT identique à V2.6.1.** Quand il n'y a rien
à contrôler, la qualité n'ajoute rien.

**NR-25** nomme l'unique différence restante : dès qu'un modèle **s'applique réellement**,
la fiche propose « + Ajouter un contrôle ». C'est le seul ajout, et il est voulu.

> **Note de méthode.** Ce test a d'abord *passé pour de mauvaises raisons*. La sonde écrivait
> `window.app?.controlInstances` — or `app` est un `let` de portée script : il n'existe pas
> sur `window`. La neutralisation ne se faisait donc jamais. Corrigé, le test a d'abord
> **échoué**, ce qui a permis de l'écrire correctement. Un test vert qui ne teste rien est
> pire qu'un test rouge.

---

## 16. Démonstration : ce qui n'a pas été touché

Deux modèles, **tous deux non bloquants** : « Contrôle avant fermeture des cloisons »
(lot Plâtrerie, motif *cloison*, 4 points, photo obligatoire) et « Contrôle pose menuiseries
extérieures » (lot Menuiseries extérieures, motif *fenêtre*, 4 points, photo obligatoire).
**Un seul** contrôle en attente, sur `k-cloisons` (QC-02, QC-03).

**Aucun statut, aucune date, aucune ressource, aucune dépendance, aucun incident, aucune
décision, aucun retard et aucun jalon de la démonstration n'a été modifié** — NR-01 à NR-16
le vérifient en comparant à V2.6.1.

`alignDemoDates()` traite les dates de qualité, tentatives imbriquées comprises, et
`completedAt` a été ajouté aux champs de date — **une seule translation**, comme pour tout le reste.

---

## 17. Synthèse

| | |
|---|---|
| Recette contrôles qualité (QC-01 → QC-50 + QC-SAV-01 → 14 + gel + données) | **73 / 73** |
| Non-régression comparative V2.6.1 → V2.7.0 | **30 / 30** |
| Suites historiques rejouées | **34** |
| Écarts vs V2.6.1 | **18**, tous expliqués, **0 régression** |
| Régression réellement introduite | **1**, trouvée et corrigée (§13) |
| Moteurs métier byte-identiques à V2.6.1 | **56 / 56** |
| `getProjectHealth()` | **byte-identique** |
| Erreurs console applicatives | **0** |
| Cibles tactiles à 390 / 430px | **44px** |
| Onglets ajoutés · entrées de menu ajoutées | **0 · 0** |
| Contrôles créés rétroactivement par la migration | **0** |
| STORE | **inchangé** |
| Fichiers de recette historiques modifiés | **0** |

---

## 18. Ce qui reste ouvert

1. **Le document de cadrage** `KANVIX_recommandations_plan_developpement_IA(1).md` est absent
   du dépôt (§0). C'est le seul point de la demande qui n'a pas pu être honoré.
2. **Les suites `recette-mode-chantier-v2.4.5` et `v2.4.6` s'arrêtent à PM-F2** tant qu'elles
   entrent par l'ancienne liste. Leur scénario maître est rejoué intégralement en QC-SAV,
   mais si vous voulez restaurer ces suites elles-mêmes, il faut les réécrire pour entrer par
   la popup Tâche — une décision de produit, pas de recette, et je ne l'ai pas prise seul.
