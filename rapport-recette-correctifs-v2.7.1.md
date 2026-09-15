# Kanvix V2.7.1 — Correctifs UX
## Mode Chantier + visibilité du contrôle qualité

**Fichier livré** : `public/poc/kanvix-next-gen-v2.7.1.html`
**Source** : `kanvix-next-gen-v2.7.0.html`
**Schéma** : **11 — INCHANGÉ** · **STORE inchangé** (`kanvix-product-8-3`) · **aucune migration**
**Recette** : `recette-correctifs-v2.7.1.mjs` — **45 / 45**
**Rejeux** : `recette-controles-qualite-v2.7.0.mjs` **73 / 73** · `recette-non-regression-v2.6.1-vers-v2.7.mjs` **30 / 30**
**Erreurs console applicatives** : **0**
**Captures** : `recette-v2.7.1/` (11 captures)

---

## En une phrase

V2.7.0 avait raison sur le fond et tort sur le moment : le contrôle existait,
mais personne ne le voyait naître. V2.7.1 ne change **aucune** règle — elle
choisit **quand** parler, et corrige un bouton qui semblait mort.

---

# PARTIE 1 — MODE CHANTIER

## 1. La cause exacte

`setFieldTab('site')` faisait trois choses :

```js
app.ui.fieldTab  = "site";
app.ui.fieldView = "site";
renderPage();
```

et n'en faisait **pas** une quatrième : elle ne touchait jamais
`app.ui.fieldProjectId`.

## 2. Pourquoi le bouton semblait KO

Parce qu'il faisait exactement ce qu'on lui demandait, et que ce n'était rien.

Un utilisateur déjà sur l'écran principal de **Résidence Keravel** cliquait
« Chantier ». Kanvix positionnait l'onglet sur `site` — il y était déjà —,
fermait la sous-vue Planning — il n'y en avait pas —, puis re-rendait l'écran
de Résidence Keravel. **Pixel pour pixel, le même écran.**

Du point de vue de l'utilisateur, il n'y a pas de différence entre « ce bouton
a réaffiché la même chose » et « ce bouton ne marche pas ». Le défaut n'était
pas dans le code : il était dans **l'absence de destination**.

## 3. Le nouveau comportement : remonter d'un niveau

Le bouton ne « va » plus à un endroit fixe — il **remonte d'un niveau depuis
là où l'on se trouve** :

| Où je suis | Clic « Chantier » | Test |
|---|---|---|
| Messages | → écran du chantier sélectionné | FIELD271-04 |
| Planning mobile | → écran du chantier sélectionné | FIELD271-03 |
| Écran principal d'un chantier | → **« Choisir un chantier »** | FIELD271-02 |
| « Choisir un chantier » | → on y est déjà, remontée en haut | FIELD271-05 |

La règle tient en une phrase : **on ne remonte que si l'on est déjà exactement
là où le bouton mène.** Partout ailleurs, il ramène au chantier sans jamais le
désélectionner.

### Ce qui n'a pas bougé

- `setFieldTab()` est **byte-identique** à V2.7.0 (FIELD271-GEL). Elle reste
  l'API **programmatique** : retour de conversation, fin d'un parcours de
  reprise, `setFieldTab('site')` dans les recettes historiques — tous ces
  appels reviennent au chantier **courant**, exactement comme avant. Seul le
  **bouton visible** a gagné une lecture contextuelle.
- `clearFieldProject()` est **byte-identique** : le bouton « Changer » du
  header reste le chemin explicite (FIELD271-06).
- Le bouton reste visuellement **actif** quand `fieldTab === "site"`, y compris
  quand il sert à remonter. Pas de chevron, pas de nouvelle icône (FIELD271-07).
- La barre basse ne bouge pas d'un pixel entre les états, à 390px (FIELD271-07).

## 4. Le test du second clic

C'est **précisément** le bug utilisateur, et il manquait à V2.7.0.

**FIELD271-02** ne se contente pas d'appeler la fonction : il **clique
réellement** sur le bouton de la barre basse, capture le contenu de l'écran
**avant**, et exige que le contenu **après** soit différent :

```
ok(after.pid === null && after.picker && after.body !== before, …)
```

Un test qui appellerait `handleFieldSiteTab()` en direct passerait sans jamais
prouver que le **bouton** est branché. Celui-ci le prouve.

**FIELD271-05** vérifie le pendant : un nouveau clic sur le sélecteur ne
produit **aucun** effet parasite — le DOM est identique.

---

# PARTIE 2 — VISIBILITÉ DU CONTRÔLE QUALITÉ

## 5. Le processus réel de V2.7.0

Il était **correct**, et il l'est resté :

1. « Pose des 6 fenêtres », lot *Menuiseries extérieures* ;
2. le modèle `ctl-menuiseries-pose` s'applique (lot + motif `fenêtre`) ;
3. l'utilisateur clique **Terminer** ;
4. `setTaskStatus()` appelle `ensureTaskControlInstances()` : le contrôle naît ;
5. `blocking = false` → la tâche passe bien à **terminé**.

QUAL271-01 à QUAL271-03 rejouent cette chaîne et la confirment. **Rien de tout
cela n'a été modifié** : le bloc de garde de `setTaskStatus()` est
**byte-identique** à V2.7.0 (FREEZE-271).

## 6. Pourquoi il était invisible

À l'étape 6, Kanvix disait :

> Tâche mise à jour

C'est tout. Un contrôle venait d'apparaître dans la base et l'utilisateur
n'avait **aucun moyen de le savoir** : ni qu'il existait, ni qu'il restait à
faire, ni où le retrouver, ni s'il devait agir maintenant.

Le moteur était juste. Le **moment** était manqué.

## 7. Le nouveau retour de fin d'intervention

```
INTERVENTION TERMINÉE

✓ Pose des 6 fenêtres

1 contrôle qualité reste à effectuer.

  Contrôle pose menuiseries extérieures
  Menuiseries extérieures · Photo        [À contrôler]

              [ Plus tard ]  [ Contrôler maintenant ]
```

Le titre porte la bonne nouvelle, la phrase porte ce qui **reste**, la liste
nomme le contrôle. Deux issues, pas une : **Kanvix propose, il n'impose pas.**

`showPostCompletionQualityPrompt(taskId)` est de la **présentation pure**,
exécutée **après** une transition déjà réussie. Elle ne décide rien, ne crée
rien, ne mute rien.

## 8. Tâche sans contrôle applicable

**Aucun popup.** Le toast historique est conservé à l'identique (QUAL271-12).
V2.7.1 n'ajoute rien quand il n'y a rien à dire.

## 9. Un contrôle

Popup avec **« Contrôler maintenant »** (QUAL271-04, QUAL271-05).

## 10. Plusieurs contrôles

Pluriel correct, les deux contrôles listés, et l'action devient
**« Voir les contrôles »** (QUAL271-CAS3).

« Voir les contrôles » ouvre la fiche de **cette** intervention — jamais tous
les contrôles du chantier. Le test le vérifie explicitement : le tiroir affiche
bien « TÂCHE / Pose des 6 fenêtres » avec ses 2 lignes, et pas le contrôle de
« Cloisons étage 1 » qui appartient pourtant au même chantier.

## 11. « Plus tard » ne mute rien

QUAL271-06 mesure les deltas sur **six** collections : incidents, décisions,
messages, tâches, reprises, événements qualité. **Tous à zéro.** La tâche reste
*terminée*, le contrôle reste *à contrôler*, `attempts` reste vide.

Et le contrôle ne disparaît pas avec le popup — il reste visible :

- sur la **fiche tâche** (QUAL271-07) ;
- dans **Chantier › Aujourd'hui** (QUAL271-08) ;
- dans **Mode Chantier › À contrôler** (QUAL271-09).

## 12. « Contrôler maintenant » réutilise l'existant

QUAL271-10 vérifie que le formulaire ouvert porte **l'identifiant exact** du
contrôle créé (`form.dataset.control === cid`), avec ses 4 points et ses deux
verdicts. Aucun formulaire n'a été réécrit : QUAL271-11 compte **un seul**
`controlFormHTML()`, **un seul** `submitControlAttempt()`, **un seul**
`openControlForm()`, et **zéro** fonction parasite.

## 13. Mode Chantier

Le conducteur en Mode Chantier n'a **pas** d'action « Terminer » sur la popup
Tâche — la condition « si cette action est disponible dans son parcours » n'est
donc pas remplie, et rien n'a été ajouté là. Quand il termine via l'éditeur
universel, il reçoit le retour comme partout ailleurs.

`fieldTaskQualitySummary()` n'a **pas** été dupliqué : il est byte-identique.

QUAL271-09 fait le test demandé, sur une intervention qui **n'avait aucune
instance** : `doing` → `done` → retour au chantier, et la ligne apparaît bien
dans « À contrôler ».

## 14. Artisan

**L'artisan ne réalise toujours pas les contrôles.** Il n'a donc **aucun**
popup, **aucune** action « Contrôler maintenant », **aucune** checklist
(QUAL271-14) : il garde son retour simple et léger. Son écran n'est pas alourdi.

Avec un contrôle **bloquant**, le comportement est strictement celui de V2.7.0 :
refus, explication seule, un unique bouton « Compris » (QUAL271-15).

## 15. Kanban

Le glissé-déposé reçoit le même retour, et son toast « Tâche déplacée » ne
vient **pas** s'y superposer (QUAL271-16).

## 16. Fiche tâche

Le bouton « Terminer » réel de la fiche déclenche le retour (QUAL271-17).

## 17. Éditeur universel

C'est le cas délicat : `setTaskStatus()` y est appelée en mode
`{ transactional: true }`, et **ouvrir un popup au milieu d'une transaction est
un piège**.

Solution retenue — celle que la demande privilégie : le moteur **retourne** une
information exploitable plutôt que de devenir un écran.

```js
return { completed, taskId, pendingQualityIds };
```

L'éditeur transporte cette information jusqu'à sa finalisation, par **les deux
chemins possibles** : `finalizeTaskEdit()` (immédiat) et `applyTaskEditReflow()`
(après aperçu d'impact). Le retour s'affiche **après** la transaction, jamais
pendant. QUAL271-18 le vérifie, `app.ui.pendingTaskEdit` bien remis à `null`.

Les anciens sites d'appel ne sont pas cassés : ils ignorent simplement la valeur
de retour.

## 18. Le bloquant est inchangé

QUAL271-13 : refus, popup « Contrôle qualité requis », bouton « Effectuer le
contrôle » — et **jamais** « Intervention terminée ». Le refus ne retourne
aucun succès, donc le retour de post-completion **ne peut pas** être déclenché
à tort.

Le bloc de garde lui-même est **byte-identique** (md5 `482bdea6ca` des deux
côtés).

## 19. Aucune duplication de moteur

QUAL271-11 et QUAL271-19 : un seul formulaire, un seul moteur de soumission,
et toujours **un seul ControlInstance par (intervention, modèle)**.

## 20. Un seul retour à la fois

QUAL271-20 : quand le popup s'affiche, **aucun** toast générique ne l'accompagne.

Et `setTaskStatus()` ne propose plus la clôture de chantier par-dessus : si le
retour qualité est affiché, la proposition liée au jalon final est **reportée**.
Elle serait de toute façon refusée — un contrôle ouvert interdit « prêt à
clôturer » — et elle aurait **écrasé** le message que l'utilisateur vient
d'ouvrir. Elle revient d'elle-même depuis l'onglet Aujourd'hui.

---

# PARTIE 3 — NON-RÉGRESSION

## 21. Les deux recettes V2.7.0, rejouées telles quelles

| Recette | Attendu | Obtenu |
|---|---|---|
| `recette-controles-qualite-v2.7.0.mjs` | 73 / 73 | **73 / 73** |
| `recette-non-regression-v2.6.1-vers-v2.7.mjs` | 30 / 30 | **30 / 30** |

Aucune de ces deux suites n'a été modifiée : seule la version cible a été
pointée sur `v2.7.1`. Le fichier `NR-24` reste la preuve la plus forte —
modèles et contrôles vidés, V2.7.1 rend le même texte que V2.6.1.

## 22. Périmètre réellement modifié, nommé et borné

**64 moteurs métier et rendus byte-identiques à V2.7.0** (FREEZE-271), dont la
totalité du moteur qualité : `applicableControlTemplates`,
`createControlInstance`, `ensureTaskControlInstances`, `controlsForTask`,
`pendingControlsForTask`, `blockingControlsForTask`, `submitControlAttempt`,
`controlIsCleared`, `validateQualityState`, `controlFormHTML`,
`openControlForm`, `showBlockingControlNotice`, `fieldControlSection`,
`fieldTaskQualitySummary`, `openReworkForm`, `createRework`,
`getProjectClosureStatus`, `confirmCloseProject`, `planningTasks`, `planReflow`,
`evaluateScenario`, `gantt`, `kanbanBoard`, `migrateState`, `setFieldTab`,
`clearFieldProject`…

**5 fonctions modifiées, 3 ajoutées — rien de plus :**

| Fonction | Nature du changement |
|---|---|
| `setTaskStatus` | retourne `{completed, taskId, pendingQualityIds}` ; affiche le retour qualité à la place du toast ; reporte la proposition de clôture. **Garde qualité byte-identique.** |
| `submitTaskEdit` | capture le retour du moteur et le transporte |
| `finalizeTaskEdit` | affiche le retour après finalisation |
| `applyTaskEditReflow` | idem, après aperçu d'impact |
| `renderField` | **une seule chaîne** : `setFieldTab('site')` → `handleFieldSiteTab()` |
| `handleFieldSiteTab` | *ajoutée* |
| `showPostCompletionQualityPrompt` | *ajoutée* |
| `openTaskControls` | *ajoutée* |

Sur `renderField`, la recette va plus loin qu'une empreinte : elle **renormalise**
la fonction V2.7.1 en rebranchant le gestionnaire sur `setFieldTab('site')`, et
vérifie qu'elle redevient **byte-identique** à V2.7.0. Aucun balisage, aucune
icône, aucun libellé, aucune classe n'a changé dans la barre basse.

## 23. Rejeu complet des 36 recettes du dépôt

Chaque suite a été rejouée contre V2.7.1 **et** comparée à son propre résultat
contre V2.7.0. Aucun fichier de recette historique n'a été modifié.

| Suite rejouée | V2.7.1 | V2.7.0 (référence) | Nouveaux échecs |
|---|---|---|---|
| `recette-accueil-v2.4.4.1` | 105 ✓ / 18 ✗ | 105 ✓ / 18 ✗ | 0 |
| `recette-accueil-v2.4.5` | 149 ✓ / 0 ✗ | 149 ✓ / 0 ✗ | 0 |
| `recette-backup-continuite-v2.4.13.1` | 103 ✓ / 6 ✗ | 103 ✓ / 6 ✗ | 0 |
| `recette-chantiers-v2.4.10.2` | 47 ✓ / 1 ✗ | 47 ✓ / 1 ✗ | 0 |
| `recette-controles-qualite-v2.7.0` | 74 ✓ / 0 ✗ | — | — |
| `recette-correctif-ui-v2.4.14.1` | 87 ✓ / 20 ✗ | 87 ✓ / 20 ✗ | 0 |
| `recette-correctifs-v2.4.15.1` | 40 ✓ / 0 ✗ | 40 ✓ / 0 ✗ | 0 |
| `recette-correctifs-v2.4.15.2` | 5 ✓ / 0 ✗ | 5 ✓ / 0 ✗ | 0 |
| `recette-correctifs-v2.4.15.3` | 49 ✓ / 7 ✗ | 49 ✓ / 7 ✗ | 0 |
| `recette-correctifs-v2.4.15.4` | 75 ✓ / 21 ✗ | 75 ✓ / 21 ✗ | 0 |
| `recette-correctifs-v2.4.15.5` | 59 ✓ / 12 ✗ | 59 ✓ / 12 ✗ | 0 |
| `recette-correctifs-v2.4.15.6` | 63 ✓ / 11 ✗ | 63 ✓ / 11 ✗ | 0 |
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
| `recette-non-regression-v2.6.1-vers-v2.7` | 30 ✓ / 0 ✗ | — | — |
| `recette-planning-bureau-v2.4.10.1` | 75 ✓ / 1 ✗ | 75 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.10` | 56 ✓ / 1 ✗ | 56 ✓ / 1 ✗ | 0 |
| `recette-planning-bureau-v2.4.9.1` | 49 ✓ / 1 ✗ | 49 ✓ / 1 ✗ | 0 |
| `recette-planning-v2.4.8` | 17 ✓ / 0 ✗ | 17 ✓ / 0 ✗ | 0 |
| `recette-reglages-v2.4.7` | 63 ✓ / 0 ✗ | 63 ✓ / 0 ✗ | 0 |
| `recette-resolve-dates-v2.4.10.2` | 14 ✓ / 0 ✗ | 14 ✓ / 0 ✗ | 0 |
| `recette-ressources-disponibilites-v2.5.0` | 99 ✓ / 12 ✗ | 99 ✓ / 12 ✗ | 0 |
| `recette-ui-responsive-v2.4.11` | 47 ✓ / 0 ✗ | 47 ✓ / 0 ✗ | 0 |
**Un seul écart sur les 36 suites**, et c'est une empreinte :

```
recette-correctifs-v2.4.15.5 · setTaskStatus : 9bbb990c → f034621c
recette-correctifs-v2.4.15.6 · setTaskStatus : 9bbb990c → f034621c
```

Ces deux suites gèlent l'empreinte de `setTaskStatus` contre V2.4.15.4. Elle
avait **déjà** changé en V2.7.0 (`9bbb990c → f5d20ec8`) ; V2.7.1 la déplace de
nouveau (`→ f034621c`). **Le même test échouait déjà, pour la même raison.**
Aucune assertion nouvelle n'est tombée, nulle part.

---

# PARTIE 4 — RESPONSIVE, THÈME, CONSOLE

## 24. Responsive

À **430×932**, **390×844** et **360×800**, mesuré sur cinq écrans successifs —
chantier, sélecteur, messages, popup de fin d'intervention, formulaire de
contrôle — le débordement horizontal est **nul partout** (valeur mesurée : −15px,
soit la largeur de l'ascenseur vertical).

Les cibles tactiles du formulaire de contrôle restent à **44px** exactement.

## 25. Thème sombre

Mesuré, pas supposé (DARK271) :

| Élément | Couleur en sombre | Luminance |
|---|---|---|
| Fond du popup | `rgb(16, 32, 47)` | 0,12 — sombre |
| Titre | `rgb(238, 244, 249)` | 0,95 — clair |
| Phrase « reste à effectuer » | `rgb(163, 179, 196)` | 0,69 — lisible |
| Ligne de contrôle | `rgb(20, 40, 58)` | 0,14 |

Et **zéro couleur codée en dur** dans le balisage du popup : il n'utilise que
les variables de thème existantes.

## 26. Console

**0 erreur JavaScript applicative**, sur la recette V2.7.1 (45 assertions,
7 contextes navigateur) comme sur les deux rejeux V2.7.0.

---

## Un mot sur deux tests qui passaient pour de mauvaises raisons

Deux assertions de cette recette ont dû être corrigées avant d'être crédibles,
et il vaut mieux le dire que le taire.

1. **QUAL271-20** (« aucun toast en doublon ») échouait — à juste titre : le
   toast mesuré venait de la transition *précédente* (`doing`), qui vit 4
   secondes. Le toast est désormais remis à zéro juste avant la transition
   observée, et l'assertion exige qu'il reste vide.

2. **L'assertion sur le STORE** passait, mais sur `undefined === undefined` :
   elle cherchait `const STORE`, alors que `STORE` est déclaré dans une liste.
   Elle ne vérifiait donc rien. Elle exige maintenant la valeur littérale
   `kanvix-product-8-3`.

Un test vert qui ne teste rien est pire qu'un test rouge.

---

## Synthèse

| | |
|---|---|
| Recette V2.7.1 (FIELD271 + QUAL271 + gel + responsive + sombre) | **45 / 45** |
| `recette-controles-qualite-v2.7.0.mjs` rejouée | **73 / 73** |
| `recette-non-regression-v2.6.1-vers-v2.7.mjs` rejouée | **30 / 30** |
| Recettes du dépôt rejouées | **36** |
| Nouvelles assertions en échec | **0** |
| Moteurs byte-identiques à V2.7.0 | **64 / 64** |
| Garde qualité de `setTaskStatus()` | **byte-identique** |
| Fonctions modifiées · ajoutées | **5 · 3** |
| SCHEMA_VERSION · STORE | **11 · `kanvix-product-8-3`** — inchangés |
| Migration | **aucune** |
| Erreurs console applicatives | **0** |
| Débordement à 430 / 390 / 360px | **0** |
| Instance de démonstration ajoutée | **0** (le test crée dynamiquement) |

---

## La question finale

> « V2.7.1 rend-elle enfin le processus qualité visible et compréhensible au
> moment exact où il devient pertinent, tout en corrigeant la navigation du
> Mode Chantier, sans toucher aux règles métier V2.7.0 ? »

**Oui.**

Le bouton « Chantier » remonte d'un niveau et ne peut plus passer pour inactif —
prouvé par un clic réel, pas par un appel de fonction. Terminer une intervention
qui porte un contrôle dit maintenant, immédiatement, ce qui est fini et ce qui
reste, avec deux issues claires. Et les 64 moteurs métier de V2.7.0, garde
qualité comprise, sont byte-identiques.
