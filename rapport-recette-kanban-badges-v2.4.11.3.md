# Kanvix V2.4.11.3 — Badges Kanban contextuels selon le statut d'exécution

Source : `public/poc/kanvix-next-gen-v2.4.11.2.html` → cible `public/poc/kanvix-next-gen-v2.4.11.3.html`.
Version **libellé + style du badge**. Aucun calcul d'incident modifié, aucun moteur métier touché.

## Verdict

**PASS.** Démarrer une tâche qui porte encore un sujet ouvert fait passer son badge de **À TRAITER** à **À SUIVRE** : le Kanban montre à la fois que la tâche avance et que le sujet doit continuer d'être suivi.

| Résultat | |
|---|---|
| Recette badges Kanban (`recette-kanban-badges-v2.4.11.3.mjs`) | **165 / 165** |
| Non-régressions (10 suites gelées) | **642 / 642** |
| **Total** | **807 / 807** |
| Erreurs console applicatives | **0** |

## 1. Logique de l'incident direct — inchangée

La détection n'a **pas** bougé d'une ligne :

```js
openIssue = app.issues.find(i => i.taskId === t.id && i.status !== "resolved" && !isFieldConfirmation(i))
```

`openIssue`, `isImpacted`, `kanbanImpactContext()`, `impactChainSources()`, `impactChainSet()`, `getCriticalImpacts()` et `isFieldConfirmation()` sont **byte-identiques** à la V2.4.11.2 (contrôle md5 fonction par fonction, §1).

## 2. Logique SOUS IMPACT — inchangée

```js
isImpacted = !openIssue && ctx.impacted.has(t.id) && !ctx.sources.has(t.id)
```

Une tâche sans incident propre, mais dans la chaîne de conséquences d'un incident ouvert en amont, affiche **SOUS IMPACT** — quel que soit son statut. Le style `.kanban-badge.impacted` est **strictement conservé** (§13, vérifié règle CSS à l'identique).

## 3. Mapping par statut

Un seul helper, qui **ne décide pas** si la tâche porte un incident : il **nomme** un incident direct déjà détecté (§3).

```js
function kanbanDirectIssueLabel(t) {
  if (t.status === "doing") return { cls: "follow",     text: "À suivre" };
  if (t.status === "done")  return { cls: "open-point", text: "Point ouvert" };
  return                           { cls: "attention",  text: "À traiter" };
}
```

| Statut | Colonne Kanban | Badge |
|---|---|---|
| `todo` | À faire | **À TRAITER** |
| `waiting` | À faire | **À TRAITER** |
| `late` | À faire | **À TRAITER** |
| `doing` | En cours | **À SUIVRE** |
| `done` | Terminée | **POINT OUVERT** |

La matrice est vérifiée directement sur le helper (KAN-CTX-G) : `['À traiter','À traiter','À traiter','À suivre','Point ouvert']`.

`kanbanBucket()` place déjà `todo` / `waiting` / `late` dans la colonne « À faire » : le libellé et la colonne restent donc toujours cohérents. **`kanbanBucket()`, `setTaskStatus()` et `kanbanDrop()` sont byte-identiques** (§2/§38).

### todo → À TRAITER

« Pose des 6 fenêtres » (incident « Fenêtres décalées ») et « Tache A source » affichent **À TRAITER** tant qu'elles ne sont pas démarrées (BADGE-01, BADGE-08, KAN-CTX-B).

Cas notable des données de démonstration : « Tableau électrique » a le statut interne **`waiting`** — elle apparaît bien dans « À faire » et porte **À TRAITER**, conformément à la matrice (KAN-CTX-A).

### doing → À SUIVRE

Le sujet existe toujours, mais le travail a commencé. C'est le défaut corrigé par cette version.

### done → POINT OUVERT

Cas historique volontairement discret : un sujet direct reste réellement non résolu sur une tâche terminée. **La tâche n'est pas rouverte**, reste non draggable et conserve toutes les protections V2.4.10.1 (KAN-CTX-D, §9).

## 4. Priorité de l'incident direct

Inchangée. Une tâche qui porte son propre incident **n'affiche jamais SOUS IMPACT en plus** : elle affiche À TRAITER ou À SUIVRE selon son statut. La condition `!openIssue` dans `isImpacted` rend le cumul structurellement impossible (§5).

**KAN-CTX-C** déroule le cycle complet sur une tâche à la fois impactée et démarrée :

| Étape | Badge de B (doing) |
|---|---|
| Conséquence seule | SOUS IMPACT |
| B reçoit son propre incident | **À SUIVRE** (SOUS IMPACT disparaît) |
| Incident propre de B résolu, incident amont toujours ouvert | **SOUS IMPACT** de nouveau |
| Tous les incidents résolus | **aucun badge** |

## 5. Comportement au drag réel (§30)

Les tests ne se contentent **pas** d'appeler `setTaskStatus()`. **KAN-CTX-A** et **KAN-CTX-B** dispatchent de vrais `DragEvent` porteurs d'un `DataTransfer` sur les handlers de l'application — `ondragstart` → `ondragover` → `ondrop` — exactement le chemin qu'emprunte un utilisateur.

Contrôles effectués : le `DataTransfer` porte bien `k-electric`, `task('k-electric').status` vaut réellement `doing` après le drop (donc `kanbanDrop` → `setTaskStatus` a été traversé), la carte se retrouve dans la colonne « En cours » et le badge est **À SUIVRE**.

| « Tableau électrique » | Colonne | Badge |
|---|---|---|
| Départ (`waiting`) | À faire | À TRAITER |
| Après drag réel vers En cours | **En cours** | **À SUIVRE** |
| Absents | — | À TRAITER, POINT OUVERT, SOUS IMPACT |

Capture `14-drag-reel-a-suivre.png`.

## 6. Retour En cours → À faire (§31)

Second drag réel, en sens inverse. `kanbanDrop` l'autorise (seule la colonne Terminée est verrouillée) :

| | Colonne | Badge |
|---|---|---|
| Retour | **À faire** | **À TRAITER** |

Plus aucun « À SUIVRE ». Le badge suit le statut dans les deux sens, sans état rémanent.

## 7. Design

| Badge | Traitement | Poids |
|---|---|---|
| **À TRAITER** | aplat ambré, sans contour — **design d'origine repris tel quel** (§10) | le plus actionnable |
| **À SUIVRE** | beige/ambre très pâle `#fdf4e6`, contour `#f0dcbc`, texte brun `#8a5a17` | même famille chaude, nettement plus discret |
| **SOUS IMPACT** | **inchangé depuis la V2.4.11.2** (§13) | information de contexte |
| **POINT OUVERT** | neutre ardoise (`--surface-subtle` / `--text-secondary` / `--border-light`), contouré | volontairement sans poids d'action |

« À SUIVRE » reste dans la famille chaude parce que **c'est le même sujet** que « À TRAITER » — seul son moment change. Le contour et la désaturation portent la différence de poids, et non un changement de famille chromatique qui aurait suggéré un autre problème.

**Vérifié automatiquement** (KAN-CTX-E) : les quatre badges sont **deux à deux distincts** en fond ou en texte, en clair **et** en sombre ; À TRAITER est plein (`border-width: 0px`) là où À SUIVRE est contouré (`1px`) — la hiérarchie d'action reste lisible **sans dépendre de la couleur**. Aucun rouge sur À SUIVRE, POINT OUVERT ni SOUS IMPACT.

## 8. Reprise

`REPRISE` conservé et cumulable avec les quatre libellés selon les données (§14). Le moteur SAV n'est pas touché ; la suite Mode Chantier passe 95/95.

## 9. Dark mode (§28)

Les quatre badges coexistent dans une même vue sombre et restent deux à deux distincts, sans effet fluo :

| Badge | Fond (sombre) | Texte (sombre) |
|---|---|---|
| À TRAITER | `srgb 0.91 0.64 0.30 / 0.2` | `rgb(164, 91, 18)` |
| À SUIVRE | `rgba(214, 158, 74, 0.13)` | `rgb(220, 179, 122)` |
| SOUS IMPACT | `rgba(139, 166, 201, 0.14)` | `rgb(169, 189, 214)` |
| POINT OUVERT | `rgb(20, 40, 58)` | `rgb(163, 179, 196)` |

Capture `17-quatre-libelles-dark.png`.

## 10. Responsive (§29)

Testé à **1920, 1440, 1280, 900, 768, 430 et 390 px**, sur une vue portant **les quatre types de badges simultanément** plus REPRISE (KAN-CTX-F) :

- les 4 types sont rendus à chaque largeur ;
- **0 badge en débordement** de sa carte ;
- **0 scroll horizontal de page**.

Capture `18-mobile-390-quatre.png`.

## 11. Absence de mutation et de persistance (§32/§33)

**KAN-CTX-G** photographie statuts, `deps`, dates, incidents, `impactChainSet()` et `impactChainSources()`, rend le Kanban trois fois, puis recompare : **strictement identique**.

Aucun champ ajouté : ni `attentionState`, ni `issueBadge`, ni `followState`, ni `impactBadge` (ni les anciens `isImpacted` / `impactStatus` / `attentionBadge`). `kanbanDirectIssueLabel()` est une fonction pure — elle lit `t.status` et ne l'écrit jamais.

`SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (**`kanvix-product-8-3`**), aucune migration (§39).

## 12. Tests

**165 assertions, 165 PASS.**

| Groupe | Objet | Résultat |
|---|---|---|
| BADGE-01 → BADGE-18 | socle V2.4.11.2 conservé, assertions de libellé adaptées (§34) | **PASS** |
| BADGE-19 / 20 / 21 | Tableau électrique démarré, conséquence pure démarrée, vocabulaire limité au Kanban | **PASS** |
| **KAN-CTX-A** | **drag RÉEL À faire → En cours → À SUIVRE, puis retour → À TRAITER (§30/§31)** | **PASS** |
| **KAN-CTX-B** | **« Pose des 6 fenêtres » : À TRAITER → À SUIVRE par drag réel (§19)** | **PASS** |
| **KAN-CTX-C** | **cycle complet SOUS IMPACT ↔ À SUIVRE ↔ aucun badge (§21-§24)** | **PASS** |
| **KAN-CTX-D** | **tâche terminée + incident ouvert → POINT OUVERT, non rouverte (§25/§9)** | **PASS** |
| **KAN-CTX-E** | **les 4 libellés coexistent et sont distincts, clair + sombre (§27/§28)** | **PASS** |
| **KAN-CTX-F** | **responsive 1920 → 390 avec les 4 badges (§29)** | **PASS** |
| **KAN-CTX-G** | **aucune mutation, aucune persistance, matrice du helper (§32/§33)** | **PASS** |

Correspondance avec les tests demandés : KAN-CTX-01 → KAN-CTX-A (départ) · 02 → KAN-CTX-A (drag) · 03 → KAN-CTX-B · 04 → BADGE-02 · 05 → BADGE-03 et KAN-CTX-C · 06 → KAN-CTX-C · 07 → KAN-CTX-C · 08 → KAN-CTX-C · 09 → KAN-CTX-D · 10 → BADGE-09.

## 13. Non-régressions

| Suite | Résultat |
|---|---|
| Accueil | **149 / 149** |
| Mode Chantier | **95 / 95** |
| Planning Bureau (dont PLAN-F1→F10) | **76 / 76** |
| Import intelligent | **75 / 75** |
| Réglages | **63 / 63** |
| Édition universelle des tâches | **58 / 58** |
| Recette UI / responsive V2.4.11 | **47 / 47** |
| Chantiers (audit) | **48 / 48** |
| ancien Planning | **17 / 17** |
| Résoudre — calendrier dynamique | **14 / 14** |
| **Total** | **642 / 642** |

L'audit Chantiers remonte toujours son unique constat **SITE-01 (MAJOR)** — historique global dans l'onglet Historique d'une fiche chantier — qui **préexiste** (baseline V2.4.10.2), reste hors périmètre et reste ouvert.

## 14. Périmètre interdit (§38)

**28 fonctions vérifiées byte-identiques** entre V2.4.11.2 et V2.4.11.3 : `setTaskStatus`, `kanbanDrop`, `kanbanBucket`, `planReflow`, `applyReflowPlan`, `impactChainSources`, `impactChainSet`, `getCriticalImpacts`, `isFieldConfirmation`, `kanbanImpactContext`, `kanbanBoard`, `gantt`, `renderProject`, `renderTeam`, `renderSites`, `resourceLoadBoard`, `scenarioOptions`, `applySimulation`, `evaluateScenario`, `analyzeKanvixImport`, `applyImportPlan`, `alignDemoDates`, `requestTaskScheduleMove`, `dropTask`, `confirmCloseProject`, `restoreProject`, `deleteProjectCascade`, `kanbanDepsHTML`.

**Aucun autre écran modifié** (§15) : Accueil, cockpit chantier et ses zones « À traiter », Mode Chantier, Gantt, Résoudre, Équipe. Le toggle « Chaîne d'impact » n'est pas touché et SOUS IMPACT en reste indépendant (§16, BADGE-06 : badges strictement identiques toggle OFF et ON).

## 15. Erreurs console

**0 erreur JavaScript applicative** sur la recette badges et les dix suites de non-régression. Les seules lignes réseau observées sont les appels météo/géo volontairement coupés par les tests.

## Critère final

| Colonne | Situation | Badge |
|---|---|---|
| À faire | incident direct | **À TRAITER** |
| En cours | incident direct | **À SUIVRE** |
| À faire | conséquence amont | **SOUS IMPACT** |
| En cours | conséquence amont | **SOUS IMPACT** |
| Terminée | incident direct exceptionnel encore ouvert | **POINT OUVERT** |
| toute colonne | aucun incident | **aucun badge** |

La colonne décrit l'**exécution**. Le badge décrit la **situation autour de la tâche**.

## Question finale

> « Quand je démarre une tâche qui possède encore un sujet ouvert, le Kanban me montre-t-il clairement qu'elle est désormais en cours et que le sujet doit simplement continuer à être suivi ? »

**OUI.** « Tableau électrique » glisse dans **En cours** et son badge devient **À SUIVRE** : la colonne dit que le travail a commencé, le badge dit que le créneau électricien reste à confirmer. Plus aucune formulation ne laisse croire que la tâche attend d'être prise en charge.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.11.3.html` — fichier complet.
2. `recette-kanban-badges-v2.4.11.3.mjs` — suite (165 vérifications).
3. `rapport-recette-kanban-badges-v2.4.11.3.md` — ce rapport.
4. Captures : `recette-kanban-badges-v2.4.11.3/` (01→18).
