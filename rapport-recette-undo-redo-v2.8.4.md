# Rapport — Kanvix V2.8.4 · Undo / Redo global

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.4.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.3.2.html`
**Recette dédiée** : `recette-undo-redo-v2.8.4.mjs` — **62 / 62 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.4/` (7 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## 1. L'architecture de V2.8.3.2

| Élément | État avant |
|---|---|
| `app.undoStack` | pile runtime, **dans** l'état métier, donc **persistée** par `save()` |
| Profondeur | **5** |
| Redo | **inexistant** |
| `snapshot()` | 35 points d'appel |
| `actionToast()` | 51 points d'appel, **« Annuler » systématique** |
| Multi-onglets | `applyStorageSync()` **conservait** la pile locale |
| Import échoué | `app.undoStack.pop()` |

## 2. Audit des `snapshot()` — 35 points d'appel

Un point relevé au comptage brut était un **faux positif** : l'occurrence en ligne 13253 appartient
au **commentaire** de `createControlInstance()`, fonction volontairement pure (« ni snapshot() ni
save() — l'appelant décide »). Il y avait donc **34 transactions réelles**, pas 35.

Toutes ont été vérifiées comme posant leur snapshot **après validation et juste avant la mutation** —
aucun step fantôme. `openTaskForm` par exemple snapshote dans le gestionnaire de soumission, après
le contrôle des dates, jamais à l'ouverture du formulaire.

**Trois continuations** ne snapshotent pas et ne le doivent pas : `finishWizard`, `propagateNow`,
`finalizeTaskEdit` et `applyTaskEditReflow` poursuivent une transaction déjà ouverte par
`createBlankFromWizard` / `createTemplateFromWizard` / `createInProgressFromWizard` ou par
`submitTaskEdit`. C'est ce qui garantit **un geste = un step**.

## 3. Audit des `actionToast()` — 51 points d'appel

**17 d'entre eux affichaient « Annuler » sans qu'aucun snapshot n'ait été pris.** Avec un Undo
global, cliquer ce bouton aurait annulé **une action antérieure** — exactement le scénario interdit.

## 4. Mutations métier qui `save()` sans `snapshot()`

| Fonction | Classification | Traitement V2.8.4 |
|---|---|---|
| `openProjectEdit` | mutation métier | **snapshot ajouté** |
| `openCompanyTemplateForm` | mutation métier | **snapshot ajouté** |
| `openMilestoneForm` | mutation métier | **snapshot ajouté** |
| `openResourceForm` | mutation métier (2 branches) | **1 snapshot en tête** — même geste |
| `openIssueForm` | mutation métier | **snapshot ajouté** |
| `openDocumentForm` / `openDocumentEdit` | mutation métier | **snapshot ajouté** |
| `addFieldPhoto` / `openPhotoForm` | donnée locale | **snapshot ajouté** |
| `relaunchIssue` | **effet externe** | `toast()` + `invalidateRedo()` |
| `openInviteForm`, `resendInvite`, `cancelInvite` | **effet externe** | `toast()` + `invalidateRedo()` |
| `disableAccount` | **effet externe** | `toast()` + `invalidateRedo()` |
| `sendArtisanMessage`, `sendConversationMessage` | **effet externe** | aucun snapshot + `invalidateRedo()` |

**Résultat : 44 fonctions de transaction posent un snapshot, 46 `actionToast()` subsistent — et
chacun est adossé à un snapshot**, dans sa propre fonction ou dans la transaction ouverte par son
appelant. Les 5 actions externes utilisent `toast()`.

### La garantie est structurelle, pas déclarative

Plutôt que de reclasser 17 points d'appel à la main — et d'espérer ne pas m'être trompé — j'ai rendu
la règle **mécanique** :

```js
function snapshot()      { …; undoableSinceToast = true; }
function actionToast(s)  { t.innerHTML = undoableSinceToast ? `${s} · <button…>Annuler</button>` : s;
                           undoableSinceToast = false; … }
function toast(s)        { …; undoableSinceToast = false; … }
```

« Annuler » n'apparaît **que** si un snapshot a été pris depuis le dernier toast. Une action qui ne
snapshote pas ne peut donc **pas** hériter du bouton d'une action antérieure — et un futur point
d'appel qui oublierait de snapshoter ne pourra jamais afficher un faux « Annuler ». **UR-50** le
vérifie en enchaînant une action undoable A puis une action sans snapshot B.

## 5 → 8. Architecture session-locale, clone, piles

```js
const UNDO_LIMIT = 20;
let undoHistory = [], redoHistory = [], undoableSinceToast = false;
```

Les deux piles vivent **hors de `app`**. `app.undoStack` survit comme champ legacy pour
`INITIAL_STATE`, les migrations et les anciennes sauvegardes — **toujours vide**.
`app.redoStack` n'existe pas.

`cloneHistoryState()` s'appuie sur `structuredClone(app)` : **UR-09** mute ensuite tâches,
ressources additionnelles, dépendances, historique, jalons, contrôles, photos et lots, et vérifie
que le snapshot déjà pris est **strictement inchangé**.

## 9. Limite de 20

`pushHistory()` retire le **plus ancien** au-delà de 20. **UR-08** : 25 mutations → pile à 20.

## 10. Invalidation de la branche Redo

Deux chemins, tous deux vérifiés :
- **une nouvelle mutation** après un Undo — `snapshot()` vide `redoHistory` (**UR-07** : A, B, C,
  Undo, Undo, D → Redo sans effet) ;
- **une mutation non annulable** qui modifie tout de même `app` — `invalidateRedo()` (**UR-49**).

## 11 → 12. Undo et Redo

`undo()` empile l'état courant dans `redoHistory`, dépile `undoHistory`, restaure, `save()`,
`render()`. `redo()` est symétrique et **n'appelle jamais `snapshot()`**, qui viderait `redoHistory`
et rendrait tout second Redo impossible.

Undo/Redo **restaure des états** : aucun moteur n'est rejoué. C'est ce qui garantit les identifiants
stables (**UR-21**, **UR-27**, **UR-28**) et l'absence de doublon d'historique (**UR-42**).

## 13 → 15. Clavier

| Geste | Effet |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Maj+Z` / `Cmd+Maj+Z` | Redo |
| `Ctrl+Y` | Redo |

**Et jamais au détriment d'une saisie.** `isTextEditingTarget()` détecte `INPUT`, `TEXTAREA`,
`SELECT`, `isContentEditable` et `closest('[contenteditable]')`. Tant que la cible est éditable,
Kanvix **n'intercepte rien** : le navigateur garde son annulation de texte native, y compris dans
une sidewindow, un popup, le champ IA ou la palette. **UR-18 → UR-20** vérifient, pour les trois
types de champ, que l'état métier **et les deux piles** restent inchangés après `Ctrl+Z`.
`Escape`, `⌘K` et `Ctrl+J` sont intacts.

## 16. Toasts

| Moment | Toast |
|---|---|
| Mutation annulable | `Tâche modifiée · [Annuler]` |
| Après Undo | `Modification annulée · [Rétablir]` |
| Après Redo | `Modification rétablie · [Annuler]` |
| Action externe | texte seul, **aucun bouton** |

De vrais `<button type="button">`, donc atteignables au clavier (**UR-10**).

## 17 → 19. Couverture et effets externes

Couvert : opérations, chantiers (création, cycle de vie, suppression en cascade), tâches (création,
édition, suppression, statut, déplacement Planning, propagation, reprise), ressources,
indisponibilités, lots, modèles de contrôle, contrôles qualité, incidents, documents, photos,
jalons, import, scénario.

Non annulable : messages, invitations, relances, désactivation de compte. Aucun faux « Annuler »,
et `invalidateRedo()` dans les 7 cas.

## 20 → 21. Import et rollback

Import réussi = **un seul step** (**UR-39**). Import échoué : `applyImportNow()` prend un
**checkpoint des deux piles** avant `snapshot()` et les restaure intégralement au rollback.
**UR-40** prépare un historique avec une branche Redo vivante, déclenche un import invalide, et
vérifie que `app`, `undoHistory` **et** `redoHistory` sont strictement identiques — aucune branche
Redo perdue sur un import finalement annulé.

## 22 → 25. Sauvegarde, restauration, réinitialisation, stockage

- `buildKanvixBackup()` : `state.undoStack = []`, aucune pile Redo (**UR-43**).
- `confirmKanvixRestore()` : `clearUndoRedo()` — le monde métier vient d'être remplacé (**UR-46**).
- `resetApp()` : `clearUndoRedo()` (**UR-47**).
- `save()` : `data.undoStack = []` avant écriture (**UR-44**).

## 26. Migration d'une pile héritée

`migrateState()` force `value.undoStack = []`. **UR-03** injecte trois snapshots hérités dans
localStorage et vérifie qu'ils sont ignorés **sans aucune perte de donnée métier**.

## 27. Multi-onglets

`applyStorageSync()` conserve `settings` et `ui` comme avant, mais **vide les deux piles** : un Undo
local écraserait sinon la modification de l'autre onglet. **UR-48** le vérifie avec un historique et
une branche Redo vivants côté A. Aucun toast — le comportement est silencieux.

## 28 → 31. Historique, identifiants, qualité, Planning

- **UR-42** : l'événement d'historique disparaît à l'Undo et revient **à l'identique** au Redo.
- **UR-21 / UR-27 / UR-28** : `task-ur-21`, la reprise et `proj-ur-28` reviennent avec le **même
  identifiant**.
- **UR-37** : un contrôle qualité — statut, tentative, photo, `photoIds`, historique — revient comme
  **un seul bloc**.
- **UR-25 / UR-26** : le déplacement passe par `requestTaskScheduleMove()` inchangé ; quatre tâches
  décalées reviennent en **un** Undo.
- **UR-53** : déplacer une tâche sur sa position actuelle ne crée **aucun** step — la garde de no-op
  existante est conservée.

## 32. Tests UR-01 → UR-56

**62 / 62 PASS, 0 erreur console applicative.** Les 56 cas demandés sont couverts, plus six
assertions complémentaires (UR-14b sur `isFinal`, UR-50 bis sur l'enchaînement A/B, thème sombre,
et les trois volets de FREEZE-284).

## 33. Rejeux des baselines

| Suite | Base V2.8.3.2 | V2.8.4 | Écart |
|---|---|---|---|
| `recette-prochain-jalon-v2.8.3.2.mjs` | 27 / 27 | **26 / 27** | 1 — byte-identité |
| `recette-jalons-statuts-v2.8.3.1.mjs` | 29 / 29 | **28 / 29** | 1 — byte-identité |
| `recette-frise-jalons-v2.8.3.1.mjs` | 42 / 42 | **41 / 42** | 1 — byte-identité |
| `recette-operations-v2.8.0.mjs` | 71 / 71 | **70 / 71** | 1 — byte-identité |
| `recette-harmonisation-ux-v2.8.1.mjs` | 48 / 49 | 48 / 49 | **aucun** |
| `recette-correctifs-v2.7.1.mjs` | 43 / 45 | 43 / 45 | **aucun** |
| `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 | 68 / 73 | **aucun** |

Les quatre écarts portent sur **trois fonctions, toutes nommées dans la liste explicitement
autorisée** par le lot :

| Fonction | Pourquoi elle a bougé |
|---|---|
| `migrateState` | neutralisation de la pile héritée (PARTIE 22) |
| `openProjectEdit` | `snapshot()` ajouté — « CHANTIERS · modifier » (PARTIE 12) |
| `confirmKanvixRestore` | `clearUndoRedo()` après restauration (PARTIE 18) |

Aucune assertion **métier** de ces suites n'échoue. La logique des jalons, la frise, les opérations
et la qualité passent intégralement.

## 34. Non-régression historique

35 suites, chacune exécutée deux fois (V2.8.3.2 puis V2.8.4), copies isolées hors dépôt —
**0 fichier suivi par git modifié**. **25 nouveaux échecs**, de deux natures seulement :

| Nature | Nombre | Explication |
|---|---:|---|
| Byte-identité de `confirmKanvixRestore` | **6** | changement autorisé (PARTIE 18) |
| Assertions comptant `app.undoStack.length` | **19** | le champ n'est plus la pile runtime — c'est l'exigence même du lot |

### La preuve que le comportement est intact

Dans **chaque** suite concernée, l'assertion voisine qui vérifie la **restauration réelle** passe
toujours :

```
✓ [SITE-F9]     Undo restaure le chantier vide supprimé
✓ [PLAN-F3]     Undo restaure le nom
✓ [PLAN-F4]     Undo restaure exactement la source ET la chaîne après un drag
✓ [EDIT-01]     Undo restaure l'ancien nom
✓ [EDIT-02]     Undo restaure la source ET la chaîne
✓ [IMP-14]      Undo restaure exactement l'état métier précédent
✓ [P5]          Undo restaure le planning
✓ [P6]          Undo restaure le statut précédent
```

Ce sont exactement les mêmes scénarios : seul l'**endroit où l'on compte la pile** a changé.
`app.undoStack.length` vaut désormais 0 parce que la pile a déménagé — sur ordre du lot
(« NE PAS utiliser app.undoStack comme pile runtime réelle »). **Aucune recette historique n'a été
modifiée.**

**0 régression comportementale.**

## 35. Byte-identité

```json
FREEZE-284 : {"gelés":67,"bougés":[]}
```

**67 moteurs métier byte-identiques** : `setTaskStatus`, `submitControlAttempt`, `createRework`,
`requestTaskScheduleMove`, `requestGanttTaskMove`, `dropTask`, `planReflow`, `applyReflowPlan`,
`evaluateScenario`, `getProjectHealth`, `milestoneStatus`, `isUpcomingMilestone`,
`operationMilestoneStats`, `operationMilestonesTab`, `taskResourceIds`,
`getResourceSchedulingConflicts`, `resourceLoadBoard`, `buildImportPlan`, `applyImportPlan`,
`validateImportState`, `renderField`, tout le Planning, les Jalons, la Qualité, les Ressources, les
Lots, les Opérations, la Simulation et le Mode Chantier.

**Undo/Redo enveloppe les mutations existantes, il ne les remplace pas.**

**26 fonctions modifiées**, toutes dans la liste autorisée : `save`, `migrateState`,
`applyStorageSync`, `resetApp`, `snapshot`, `undo`, `actionToast`, `toast`, `applyImportNow`,
`confirmKanvixRestore`, les 9 mutations rendues annulables, les 5 actions externes et les 2 envois
de message.

**8 helpers ajoutés** : `cloneHistoryState`, `pushHistory`, `clearUndoRedo`, `invalidateRedo`,
`restoreHistoryState`, `redo`, `historyToast`, `isTextEditingTarget`.

`SCHEMA_VERSION` **12 → 12**, `STORE` inchangé, **aucune migration**.

## 36 → 38. Responsive, thème sombre, console

- **1440×900 et 390×844** : **UR-54** vérifie qu'à 390px le toast reste dans l'écran, que
  « Annuler » puis « Rétablir » fonctionnent et que rien ne déborde.
- **Thème sombre** : le bouton du toast contraste avec le fond (capture `05-dark-undo-toast.png`).
- **Console** : **0 erreur JavaScript applicative** sur l'ensemble de la recette.

## Préparation de la création graphique (PARTIE 28)

Rien n'a été développé sur ce point, conformément à la consigne. L'architecture le permet
néanmoins : une future création à la souris depuis le Planning n'aura qu'à appeler `snapshot()`
avant sa mutation, puis `actionToast(...)`. Le bouton « Annuler » apparaîtra automatiquement, le
step sera atomique, et aucune architecture nouvelle ne sera nécessaire.

---

## Réponse à la question finale

> *Kanvix possède-t-il désormais un Undo/Redo global, multi-niveaux et atomique, capable d'annuler
> puis rétablir les principales mutations métier, sans rejouer les moteurs, sans persister
> l'historique, sans voler Ctrl+Z aux formulaires, sans proposer de faux Undo sur des actions
> externes, et sans introduire de régression dans V2.8.3.2 ?*

**OUI**, et les dix critères sont vérifiés séparément :

1. `Ctrl/Cmd+Z` annule la dernière transaction — UR-13, UR-14.
2. `Ctrl/Cmd+Maj+Z` et `Ctrl+Y` la rétablissent — UR-15 à UR-17.
3. Undo/Redo restaure des états complets, sans rejouer aucun moteur — FREEZE-284, 67 moteurs gelés.
4. Une transaction complexe reste **un seul** Undo — UR-26, UR-29, UR-37, UR-39, UR-41.
5. Une nouvelle modification après Undo supprime la branche Redo — UR-07.
6. L'historique ne survit ni au rechargement, ni à la restauration, ni au reset, ni à la
   synchronisation — UR-45 à UR-48.
7. Les piles ne sont ni dans le backup, ni dans localStorage, ni dans les snapshots — UR-43, UR-44.
8. `Ctrl+Z` dans un champ texte reste l'annulation native — UR-18 à UR-20.
9. Une action externe ne propose jamais de faux « Annuler » — UR-50 à UR-52.
10. V2.8.3.2 reste intacte hors Undo/Redo — UR-56 et les rejeux de baselines.
