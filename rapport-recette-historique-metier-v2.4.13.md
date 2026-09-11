# Kanvix V2.4.13 — Historique métier structuré : transitions explicites + horodatage complet

Source : `public/poc/kanvix-next-gen-v2.4.12.1.html` → cible `public/poc/kanvix-next-gen-v2.4.13.html`.
La timeline V2.4.12.1 n'a **pas** été refaite : seules la qualité de la donnée et le rendu des événements de statut évoluent.

## Verdict

**PASS.** Trois événements successifs sur la même tâche racontent désormais une histoire lisible — « À faire → En cours », « En cours → À faire », « À faire → En cours » — au lieu de trois libellés qui se ressemblaient.

| Résultat | |
|---|---|
| Recette historique métier (`recette-historique-metier-v2.4.13.mjs`) | **106 / 106** |
| Timeline V2.4.12.1 (rejouée **sans modification**) | **90 / 90** |
| Historique contextualisé V2.4.12 (SITE-01) | **106 / 106** |
| Chantiers (SITE-F1→F10) — **FINDINGS : 0** | **48 / 48** |
| Badges Kanban V2.4.11.3 | **165 / 165** |
| Autres non-régressions (8 suites gelées) | **594 / 594** |
| **Total** | **1109 / 1109** |
| Erreurs console applicatives | **0** |

## 1. Cause de la répétition visuelle

La timeline affichait trois fois de suite « Tableau électrique · commencée » / « … passée « À faire » » parce que l'entrée d'historique ne portait **que** `text` : un libellé décrivant l'action, jamais l'état de départ. Impossible, en lisant deux lignes voisines, de savoir **d'où** venait la tâche.

Deuxième cause aggravante : `setTaskStatus()` n'avait **aucune garde no-op**. Réaffecter à une tâche le statut qu'elle avait déjà produisait une entrée complète (plus un snapshot Undo), ce qui gonflait la liste d'événements qui ne correspondaient à aucun changement réel.

## 2. Modèle d'événement `task-status`

```js
{
  date: historyNow(),          // "2026-09-11T08:43"
  eventType: "task-status",
  projectId: t.projectId,
  taskId: id,
  taskName: t.name,            // mémorisé : survit à la suppression de la tâche
  fromStatus: prevStatus,
  toStatus: status,
  origin,                      // task | kanban | manual-edit | field…
  manual, fromField,
  changes: [{ field: "Statut", from: "À faire", to: "En cours" }],
  text: "…",                   // LEGACY, conservé pour compatibilité
  author: fromField ? resourceLabel(t.resourceId) : "Eric",
}
```

`text` est conservé **à l'identique** (§3) : les anciens tests et anciennes vues continuent de fonctionner, mais il n'est plus la vérité du rendu pour un événement de statut.

`projectId` est posé **en plus** de `taskId` (§33) et `changes[]` duplique la transition dans la structure générique déjà comprise par la timeline (§2).

## 3. Champs ajoutés

`eventType` · `projectId` · `taskName` · `fromStatus` · `toStatus` · `origin` · `manual` · `fromField` · `changes[]`. Tous **optionnels** : une entrée antérieure qui ne les porte pas reste parfaitement valide, d'où l'absence de migration (§36).

## 4. Comportement no-op

```js
let prevStatus = t.status;
if (prevStatus === status) return;                        // ← V2.4.13
if (prevStatus === "done" && status !== "done") return;   // inchangé
if (!silent) snapshot();
```

La garde est posée **avant tout effet de bord** — avant `snapshot()`, avant la mutation, avant la réconciliation, avant l'historique, avant les notifications.

**STATUS-HIST-05** appelle trois fois `setTaskStatus(id, "doing")` sur une tâche déjà `doing`, par trois origines différentes, et mesure : **0** entrée d'historique, **0** snapshot Undo, **0** incident, **0** message, **0** statut modifié.

C'est la **seule** déduplication mise en place. Aucune fusion temporelle, aucune fusion par texte (§21) : une vraie séquence `todo → doing → todo → doing` reste intégralement auditable.

## 5. Les transitions

| Cas | Rendu | Test |
|---|---|---|
| `todo → doing` | **Tableau électrique** · `À faire` → `En cours` | STATUS-HIST-01/02 |
| `doing → todo` | **Tableau électrique** · `En cours` → `À faire` | STATUS-HIST-03 |
| `doing → done` | **Pose des 6 fenêtres** · `En cours` → `Terminée` | DESIGN |
| `doing → doing` | **rien** | STATUS-HIST-05 |
| `done → done` | **rien** | STATUS-HIST-06 |
| `done → todo` | **refusé**, tâche toujours terminée, aucune entrée | STATUS-HIST-06 |

**STATUS-HIST-04** enchaîne `todo → doing → todo → doing` et vérifie **3 événements exactement**, dans l'ordre, avec le même titre et trois transitions distinctes — la répétition devient lisible au lieu d'être confuse.

La transition est lue **uniquement** dans `h.fromStatus` / `h.toStatus`, jamais recalculée depuis `task.status` courant (§26) : l'historique montre l'état **au moment de l'action**.

### Manuel (§18)

`opts.manual` → `manual: true`, `fromField: false`. Affichage principal : la transition. Précision secondaire : « Statut modifié manuellement ». **Aucun faux « sur le terrain »** (assertion explicite).

### Terrain (§17)

Démarrage artisan réel → `fromField: true`, auteur = **la ressource**, jamais uniformisé en « Eric ». Précision secondaire « Confirmé sur le terrain », affichée **seulement** parce que la donnée porte `fromField === true`.

### Kanban (§19/§20)

**STATUS-HIST-07/08** effectuent de vrais `DragEvent` sur les handlers de l'application (`ondragstart` → `ondragover` → `ondrop`), sans jamais appeler `setTaskStatus` directement :

| Drag | Entrée produite |
|---|---|
| À faire → En cours | 1 entrée `À faire → En cours`, `origin: "kanban"` |
| En cours → À faire (retour) | 1 **nouvelle** entrée `En cours → À faire` |

Le retour n'est pas supprimé : c'est une vraie transition.

## 6. Horodatage : avant / après

| | Avant (V2.4.12.1) | Après (V2.4.13) |
|---|---|---|
| Valeur stockée | `"08:43"` | `"2026-09-11T08:43"` |
| Jour connu ? | **non** | **oui** |
| Groupe timeline | aucun en-tête possible | **11 SEPT. 2026** |

`historyNow()` = `localDateTime(getDemoNow())`. **Périmètre strict** : les **13** points d'écriture de `app.history` ont été migrés ; les dates des tâches, incidents, photos, chantiers et jalons ne sont pas touchées, et `fmtTime()` reste utilisé partout ailleurs (messages, commentaire terrain, libellés de différences) — vérifié par audit exhaustif.

**TIMESTAMP-01** contrôle la valeur exacte stockée (`"2026-09-11T08:43"`, jamais `"08:43"`) et vérifie qu'un autre point d'écriture — la résolution d'incident — est lui aussi complètement horodaté.

**TIMESTAMP-02/03** : plusieurs événements le 11 septembre → **un seul** groupe ; en ajoutant un événement daté du 10 → **deux** groupes distincts.

## 7. Anciennes données

**Aucune migration** (§9/§76). `SCHEMA_VERSION` reste **8**, `STORE` reste `kanvix-product-8-3`.

| Ancienne entrée | Rendu V2.4.13 |
|---|---|
| `date: "21:18"`, `text: "Tableau électrique · commencée"` | heure `21:18`, titre **inchangé**, **aucune transition** |
| `date: "hier"` | `hier` affiché tel quel, aucune exception |

**Aucune transition n'est reconstruite** par analyse de texte (§28/§29) : sans `fromStatus`, Kanvix préfère afficher le libellé d'origine plutôt qu'un « À faire → En cours » inventé sans preuve. Le titre legacy est également préservé : `historyEventTitle()` ne substitue le nom de la tâche **que** sur une entrée structurée.

**LEGACY** vérifie la cohabitation : 4 événements, **1 seule** transition (la nouvelle), et les entrées sans jour regroupées sous **« Date non précisée »** — jamais rattachées à une date inventée.

## 8. Tâche supprimée

`taskName`, `fromStatus` et `toStatus` étant copiés dans l'entrée, la ligne reste entièrement lisible :

> **Ancienne tâche** — `À faire` → `En cours`

et le bouton « Voir la tâche » **disparaît** naturellement puisque `task(h.taskId)` n'existe plus (§27, vérifié).

## 9. Autres événements — non transformés (§22)

| Événement | Conservé | Date complète | Rattaché |
|---|---|---|---|
| Incident résolu | oui, libellé intact | oui | keravel |
| Photo ajoutée | oui | oui | keravel |
| Reprise créée / signalée | oui, moteur SAV inchangé | oui | via `taskId` |
| Simulation appliquée | oui, moteur Résoudre inchangé | oui | keravel |
| Édition de tâche (`changes`) | oui, différences intactes | oui | via `taskName` |

Pour une entrée d'édition, le titre devient le **nom de la tâche** et les différences s'affichent dessous (§24) — plus de « Pose des 6 fenêtres modifiée. » qui répétait l'information.

## 10. Design de la transition

```
Tableau électrique
[ À faire ]  →  [ En cours ]
Eric                                   [ Voir la tâche → ]
```

L'état de **départ** reste neutre (surface sourde, texte secondaire) ; seul l'état d'**arrivée** est affirmé (§12). Couleurs sobres (§13) : À faire neutre, En cours bleu Kanvix, Terminée vert, En attente / En retard ambre.

**DESIGN** vérifie en mode sombre que les trois statuts d'arrivée coexistent, sont **deux à deux distincts**, gardent un contraste suffisant, et que le chip de départ reste bien différent du chip d'arrivée.

## 11. Responsive et densité

| Largeur | Événements | Hauteur moyenne | Débordement | Scroll |
|---|---|---|---|---|
| 1920 · 1440 · 1280 | 3 | **85 px** | 0 | 0 |
| 900 · 768 | 3 | 85 px | 0 | 0 |
| 430 · 390 | 3 | 106 px | 0 | 0 |

La transition ajoute une ligne compacte : on passe de ~59 px à ~85 px pour un événement de statut, toujours loin des grosses cartes d'avant la V2.4.12.1. Les pastilles passent à la ligne proprement sur mobile grâce au `flex-wrap`.

## 12. Acquis V2.4.12.1 préservés

`cursor: default` sur l'événement **et sur les pastilles de statut** ; seul « Voir la tâche → » prend la main ; le clic ouvre la bonne tâche ; le retour laisse l'onglet Historique actif et intact. **La suite V2.4.12.1 passe 90/90 sans qu'une seule assertion ait dû être adaptée** (§66).

## 13. Isolation — SITE-01 toujours fermé

`historyProjectId()` et `projectHistory()` sont **byte-identiques** (§32). Testé sur les nouveaux événements structurés : Keravel ne voit pas Villa, Villa ne voit pas Keravel, l'entrée globale n'apparaît nulle part, et les deux historiques diffèrent. La recette Chantiers rejouée **sans modification** confirme : `48 passed, 0 failed`, **FINDINGS (0)**.

## 14. Périmètre technique — ce qui a bougé, précisément

**28 fonctions sur 33 vérifiées byte-identiques**, dont `kanbanDrop`, `kanbanBucket`, `planReflow`, `dropTask`, `scenarioOptions`, `evaluateScenario`, `historyProjectId`, `projectHistory`, `historyStamp`, `historyGroups`, `kanbanCard`, `gantt`, `renderProject`, `renderTeam`, `renderSites`, `analyzeKanvixImport`, `applyImportPlan`, le cycle de vie chantier, `taskActivity`, `openTask` et `projectTabContent`.

**`setTaskStatus`** est modifié, dans les trois limites autorisées par le §72 : garde `prevStatus === status`, enrichissement de l'entrée d'historique, horodatage complet. Aucune autre règle métier n'a bougé — la protection `done` terminal est inchangée et reste posée après la garde no-op.

**Cinq autres fonctions** diffèrent, et il faut être précis : leur **seule** différence est le champ `date` de l'entrée d'historique qu'elles écrivent, conformément au §35 (« standardiser le timestamp des nouvelles entrées dans tous les `app.history.unshift(...)` »). Diff réel :

| Fonction | Différence, ligne à ligne |
|---|---|
| `applyReflowPlan` | `date: fmtTime(...)` → `date: historyNow()` |
| `applySimulation` | `date: fmtTime(...)` → `date: historyNow()` |
| `reconcileAfterTaskStatusChange` | `date: fmtTime(...)` → `date: historyNow()` |
| `setIssueStatus` | `date: fmtTime(...)` → `date: historyNow()` |
| `requestTaskScheduleMove` | `date: historyNow()` **+** `projectId` **+** `taskName` |

Aucune logique métier ne s'y trouve modifiée : ni calcul, ni condition, ni mutation, ni ordre d'opérations. Ces cinq fonctions figurent dans la liste « interdit de modifier » du §72 ; la modification se limite strictement à ce que le §35 demande, et elle est signalée ici pour que vous puissiez la valider ou demander son retrait.

**`app.history` reste la collection unique** (§73) : aucun `taskHistory[]`, `projectHistory[]` ni `auditLog[]` — vérifié.

## 15. Résultats de tests

| Test | Objet | Résultat |
|---|---|---|
| STATUS-HIST-01 | Entrée structurée complète (7 champs vérifiés) | **PASS** |
| STATUS-HIST-02 | Rendu « Tableau électrique » + `À faire → En cours` | **PASS** |
| STATUS-HIST-03 | `En cours → À faire` | **PASS** |
| STATUS-HIST-04 | 3 transitions, aucune fusion | **PASS** |
| STATUS-HIST-05 | No-op strict : 0 historique / 0 undo / 0 incident / 0 message | **PASS** |
| STATUS-HIST-06 | `done → done` et `done → todo` : rien, tâche toujours terminée | **PASS** |
| STATUS-HIST-07 | Drag Kanban RÉEL → 1 entrée structurée, `origin: kanban` | **PASS** |
| STATUS-HIST-08 | Drag retour → nouvelle entrée `En cours → À faire` | **PASS** |
| STATUS-HIST-09 | Édition manuelle : transition exacte, aucun faux « terrain » | **PASS** |
| STATUS-HIST-10 | Terrain : auteur = ressource, « Confirmé sur le terrain » | **PASS** |
| TIMESTAMP-01 | `"2026-09-11T08:43"` stocké, tous points d'écriture migrés | **PASS** |
| TIMESTAMP-02 | Plusieurs heures → un seul groupe « 11 sept. 2026 » | **PASS** |
| TIMESTAMP-03 | Deux journées → deux groupes | **PASS** |
| TIMESTAMP-04 | Anciennes entrées `"21:18"` / `"hier"` visibles, sans exception | **PASS** |
| LEGACY | Aucune transition reconstruite, titre legacy préservé, cohabitation | **PASS** |
| TASK-DELETED | Transition lisible, pas de bouton mort | **PASS** |
| AUTRES | Incident, photo, simulation, changes : conservés + date complète | **PASS** |
| REPRISE | Parcours SAV intact, dates complètes | **PASS** |
| ORDRE | Plus récent en haut, aucun tri par nom / type / statut | **PASS** |
| DESIGN | Dark mode, 3 statuts distincts, contraste, départ neutre | **PASS** |
| RESPONSIVE | 1920 → 390 : 0 débordement, 0 scroll, timeline compacte | **PASS** |
| NAVIGATION | `cursor: default`, bonne tâche ouverte, retour intact | **PASS** |
| ISOLATION | Aucune fuite, SITE-01 fermé | **PASS** |
| SCHEMA | SCHEMA_VERSION 8, STORE inchangé, collection unique | **PASS** |
| COMPARATIF | V2.4.12.1 vs V2.4.13 sur la même séquence (§65) | **PASS** |

**106 assertions, 106 PASS.**

## 16. Comparatif §65 — mesuré sur les deux fichiers

| V2.4.12.1 | V2.4.13 |
|---|---|
| Tableau électrique · commencée | **Tableau électrique** — `À faire → En cours` |
| Tableau électrique · passée « À faire » | **Tableau électrique** — `En cours → À faire` |
| Tableau électrique · commencée | **Tableau électrique** — `À faire → En cours` |

3 événements des deux côtés : **rien n'a été supprimé**, tout est devenu lisible.

## 17. Non-régressions

Timeline V2.4.12.1 **90/90** · Historique V2.4.12 **106/106** · Chantiers **48/48** (0 finding) · Badges Kanban **165/165** · Accueil **149/149** · Mode Chantier **95/95** · Planning Bureau **76/76** · Import **75/75** · Réglages **63/63** · Édition **58/58** · UI responsive **47/47** · ancien Planning **17/17** · Résoudre **14/14**.

## 18. Erreurs console

**0 erreur JavaScript applicative** sur la recette métier et l'ensemble des suites rejouées.

## Question finale

> « En regardant trois événements successifs de la même tâche, comprend-on immédiatement quelle était sa situation avant chaque action et ce qu'elle est devenue ensuite ? »

**OUI.** Chaque ligne porte le nom de la tâche puis `état avant → état après`. En lisant de haut en bas : la tâche a été démarrée, remise à faire, puis redémarrée — trois faits distincts, tous conservés, tous datés au jour et à l'heure.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.13.html` — fichier complet.
2. `recette-historique-metier-v2.4.13.mjs` — suite (106 vérifications).
3. `rapport-recette-historique-metier-v2.4.13.md` — ce rapport.
4. Captures : `recette-historique-metier-v2.4.13/` (01→07).
