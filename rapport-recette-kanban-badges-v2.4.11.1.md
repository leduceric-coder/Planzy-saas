# Kanvix V2.4.11.1 — Clarification des badges Kanban : « À TRAITER » vs « SOUS IMPACT »

Source : `public/poc/kanvix-next-gen-v2.4.11.html` → cible `public/poc/kanvix-next-gen-v2.4.11.1.html`.
Version **sémantique / UI**. Aucun moteur métier modifié, aucun statut modifié, aucun nouveau moteur.

## Verdict

**PASS.** Une carte Kanban distingue désormais la tâche qui **porte** le problème de la tâche qui **subit** ses conséquences — et le badge ne dépend plus du statut d'exécution : « En cours » + « SOUS IMPACT » est un état lisible et légitime.

| Résultat | |
|---|---|
| Recette badges Kanban (`recette-kanban-badges-v2.4.11.1.mjs`, BADGE-01→BADGE-18) | **84 / 84** |
| Non-régressions (10 suites gelées) | **642 / 642** |
| **Total** | **726 / 726** |
| Erreurs console applicatives | **0** |

Le diff complet V2.4.11 → V2.4.11.1 fait **61 lignes**, toutes dans `kanbanBoard()`, `kanbanCard()` et le bloc CSS `.kanban-badge`.

## 1. Définition « À TRAITER »

La tâche **porte elle-même** un incident opérationnel ouvert. Elle est la source directe d'un problème qui appelle une action ou une décision.

```js
openIssue = app.issues.find(
  (i) => i.taskId === t.id && i.status !== "resolved" && !isFieldConfirmation(i)
)
```

La définition du §3 est **strictement conservée**. Seule l'écriture change : l'exclusion `field-start` / `field-done` passe par le helper **déjà existant** `isFieldConfirmation()` au lieu d'un prédicat dupliqué en ligne — même sémantique, une source de vérité de moins à maintenir.

## 2. Définition « SOUS IMPACT »

La tâche **ne porte pas** l'incident source, mais appartient à la chaîne de conséquences d'un incident ouvert situé **en amont**.

```js
isImpacted = !openIssue && ctx.impacted.has(t.id) && !ctx.sources.has(t.id)
```

Soit exactement le §5 : appartient à `impactChainSet()`, n'appartient pas à `impactChainSources()`, et ne porte pas d'incident propre au sens du §3.

## 3. Source de calcul

**Aucun second moteur de dépendances n'a été écrit.** Le contexte réutilise les helpers existants, inchangés (vérifiés byte-identiques) :

```js
function kanbanImpactContext() {
  return { sources: impactChainSources(), impacted: impactChainSet() };
}
```

- `impactChainSources()` — tâches portant un incident non résolu.
- `impactChainSet()` — ces sources **plus** leurs conséquences aval, obtenues par `getCriticalImpacts()` (parcours de `task.deps`).

Ce sont les **mêmes ensembles** que ceux qui alimentent la couche « Chaîne d'impact » du Gantt : Kanban et Gantt lisent donc rigoureusement la même vérité.

**§9 respecté** : le contexte est calculé **une seule fois par rendu** dans `kanbanBoard()` puis transmis en troisième argument à `kanbanCard(t, readOnly, impactContext)` — jamais recalculé carte par carte. La signature reste rétro-compatible : sans troisième argument, `kanbanCard` retombe sur `kanbanImpactContext()`.

## 4. Absence de propriété persistante

**Aucun champ ajouté** : ni `task.isImpacted`, ni `task.impactStatus`, ni `task.attentionBadge`. Les deux badges sont **calculés au runtime** à chaque rendu.

- `SCHEMA_VERSION` inchangé : **8**
- `STORE` inchangé : **`kanvix-product-8-3`**
- Aucune migration, aucun `APP_VERSION` touché.

Vérifié par **BADGE-07** (aucune de ces trois clés n'existe sur les tâches après un aller-retour de vues) et **BADGE-15** (rendre le Kanban deux fois ne mute aucune tâche : `JSON.stringify(app.tasks)` identique avant/après).

## 5. Comportement `todo`

Une tâche `todo` conséquence d'un incident amont affiche **SOUS IMPACT** (BADGE-02). Une tâche `todo` portant l'incident affiche **À TRAITER** (BADGE-01).

## 6. Comportement `doing`

**C'est le défaut corrigé.** Une tâche passée « À faire → En cours » **conserve SOUS IMPACT** et ne bascule **jamais** en À TRAITER du seul fait du changement de statut (BADGE-03).

Le statut n'entre pas dans le calcul du badge : les deux informations sont désormais orthogonales.

| | Statut | Contexte d'attention |
|---|---|---|
| Ce que fait la tâche | À faire / En cours / Terminée | — |
| Ce qui l'affecte | — | À TRAITER / SOUS IMPACT / rien |

Aucun blocage, aucune popup, aucune confirmation, aucun workflow d'arbitrage n'a été ajouté (§2) : une tâche sous impact se démarre exactement comme avant.

## 7. Comportement après résolution

Les deux ensembles étant recalculés à chaque rendu, la résolution de l'incident source fait **disparaître les deux badges d'un coup** (BADGE-04) :

- A ne porte plus À TRAITER ;
- A ne bascule pas en SOUS IMPACT ;
- B et C ne portent plus SOUS IMPACT.

## 8. Priorité de l'incident direct

**À TRAITER l'emporte toujours** (§6/§19). Une tâche qui est à la fois conséquence d'un incident amont **et** porteuse de son propre incident ouvert affiche **uniquement À TRAITER** — l'information la plus actionnable. La condition `!openIssue` dans le calcul de `isImpacted` rend le cumul structurellement impossible.

Vérifié par **BADGE-05** : incident sur A et sur B → A = À TRAITER, B = À TRAITER (jamais SOUS IMPACT en plus), C = SOUS IMPACT.

**Sur les données de démonstration**, ce cas se produit réellement et mérite d'être signalé : « Doublage murs extérieurs » (`k-lining`) est en aval de « Pose des 6 fenêtres », **mais porte aussi son propre incident terrain ouvert** (« Accès étage à dégager »). Elle affiche donc **À TRAITER**, et non SOUS IMPACT — c'est le comportement attendu du §19, pas une anomalie. Les conséquences pures de la chaîne Keravel sont **« Peinture étage 1 »** et **« Contrôle final »**, toutes deux en **SOUS IMPACT** (BADGE-18, capture `10-demo-keravel-deux-niveaux.png`).

**§18** : une tâche impactée par plusieurs incidents amont n'affiche **qu'une seule fois** SOUS IMPACT — jamais de compteur.

## 9. Indépendance du toggle « Chaîne d'impact »

Le badge **ne dépend pas** de `app.ui.impactChain`. Ce toggle pilote une couche analytique du **Gantt** ; être impactée est une propriété métier de la tâche.

**BADGE-06** capture l'intégralité des badges toggle OFF, active le toggle, recapture, et compare : **strictement identiques** (comparaison JSON exhaustive, pas un échantillon). `impactChainActive()` n'est appelé nulle part dans le chemin du Kanban.

## 10. SAV / Reprise

Le moteur SAV/Reprise n'est pas touché. Le badge **REPRISE** est conservé tel quel et reste **cumulable** avec le badge d'attention, dans les deux combinaisons (BADGE-10) :

- `REPRISE` + `À TRAITER`
- `REPRISE` + `SOUS IMPACT`

REPRISE reste affiché en premier. La suite Mode Chantier (95/95) et le parcours « Signaler une reprise » ne régressent pas.

## 11. Dark mode

Le badge possède une variante sombre désaturée dédiée. **BADGE-11** compare les couleurs calculées des quatre pastilles d'une même vue sombre :

| Badge | Fond (sombre) | Texte (sombre) |
|---|---|---|
| À TRAITER | `srgb 0.91 0.64 0.30 / 0.2` | `rgb(164, 91, 18)` |
| SOUS IMPACT | `rgba(139, 166, 201, 0.14)` | `rgb(169, 189, 214)` |
| REPRISE | `srgb 0.36 0.61 1 / 0.16` | `rgb(207, 225, 255)` |
| Badge chantier | `rgba(110, 168, 240, 0.13)` | `rgb(169, 205, 248)` |

Les quatre sont deux à deux distincts (fond **et** texte), sans effet fluo. Captures `07-dark-badges.png` et `11-demo-keravel-dark.png`.

## 12. Design du badge

- Libellé exact rendu : **`SOUS IMPACT`** (vérifié caractère pour caractère, BADGE-12).
- **Pas de rouge** : assertion automatique sur la couleur calculée en clair **et** en sombre.
- **Pas l'orange de À TRAITER** : fond et texte différents, vérifiés.
- **Pas le bleu accent de REPRISE** : `rgb(77, 95, 120)` ardoise contre `rgb(20, 86, 199)` accent.
- Le badge **À TRAITER conserve son design d'origine** — non redessiné (§11).
- Le terme **« À surveiller » n'est pas réutilisé** (§13, vérifié).
- L'identité chantier de la V2.4.11 (liseré, badge chantier, pastille) est **intacte** et reste distincte du nouveau badge (§14).

Traitement retenu : là où À TRAITER est une pastille **pleine** ambrée, SOUS IMPACT est une pastille **contourée** ardoise sur fond très clair — moins forte, lisible comme une information de contexte plutôt que comme une urgence supplémentaire.

## 13. Responsive

Testé à **1920, 1440, 1280, 900, 768, 430 et 390 px**, cartes portant simultanément REPRISE + SOUS IMPACT (BADGE-13) :

- **0 badge en débordement** de sa carte (mesure `getBoundingClientRect()` badge contre carte) ;
- **0 scroll horizontal de page** à toutes les largeurs ;
- les badges restent rendus à toutes les largeurs.

`.kanban-badges` conserve son `flex-wrap: wrap` : deux badges passent proprement à la ligne sur mobile. Capture `09-mobile-390.png`.

## 14. Accessibilité

**Le sens ne repose pas sur la seule couleur** (BADGE-14) :

- les libellés texte « À TRAITER » / « SOUS IMPACT » / « REPRISE » sont **toujours visibles**, jamais remplacés par un point ou une icône seule ;
- différenciation supplémentaire **non chromatique** : SOUS IMPACT est contouré (`border: 1px`), À TRAITER est plein (`border: 0`).

## 15. Résultats BADGE-01 → BADGE-18

| Test | Objet | Résultat |
|---|---|---|
| BADGE-01 | Incident direct → À TRAITER (seul) | **PASS** |
| BADGE-02 | Chaîne A→B→C, incident sur A : A=À TRAITER, B et C=SOUS IMPACT | **PASS** |
| BADGE-03 | B « À faire → En cours » : reste SOUS IMPACT, ne devient pas À TRAITER | **PASS** |
| BADGE-04 | Incident de A résolu : plus aucun badge sur A, B, C | **PASS** |
| BADGE-05 | B a son propre incident : B=À TRAITER, C reste SOUS IMPACT | **PASS** |
| BADGE-06 | Toggle « Chaîne d'impact » OFF/ON : badges strictement identiques | **PASS** |
| BADGE-07 | Kanban → Gantt → Kanban : recalcul correct, aucun état persisté | **PASS** |
| BADGE-08 | Filtre « Tous » → « Résidence Keravel » : même logique de badges | **PASS** |
| BADGE-09 | Tâche neutre : aucun badge d'attention | **PASS** |
| BADGE-10 | REPRISE + À TRAITER et REPRISE + SOUS IMPACT | **PASS** |
| BADGE-11 | Dark mode : les 4 pastilles restent différenciables, aucun rouge | **PASS** |
| BADGE-12 | Mode clair : libellés exacts, aucun rouge, « À surveiller » non réutilisé | **PASS** |
| BADGE-13 | Responsive 1920 → 390 : aucun débordement, aucun scroll | **PASS** |
| BADGE-14 | Accessibilité : texte toujours visible + différenciation non chromatique | **PASS** |
| BADGE-15 | Aucune mutation au rendu, 3 colonnes, SCHEMA_VERSION et STORE inchangés | **PASS** |
| BADGE-16 | Tâche terminée : colonne Terminée, non draggable (V2.4.10.1 préservé) | **PASS** |
| BADGE-17 | 0 erreur console applicative | **PASS** |
| BADGE-18 | Données de démo réelles : les deux niveaux coexistent, aucun cumul | **PASS** |

**84 assertions, 84 PASS.**

## 16. Non-régressions

Toutes les suites gelées ont été rejouées **contre `kanvix-next-gen-v2.4.11.1.html`** :

| Suite | Résultat |
|---|---|
| Recette UI / responsive V2.4.11 (UI-01→UI-19) | **47 / 47** |
| Planning Bureau (dont PLAN-F1→PLAN-F10) | **76 / 76** |
| Résoudre — calendrier dynamique | **14 / 14** |
| Accueil | **149 / 149** |
| Mode Chantier | **95 / 95** |
| Réglages | **63 / 63** |
| Édition universelle des tâches | **58 / 58** |
| Import intelligent | **75 / 75** |
| ancien Planning | **17 / 17** |
| Chantiers (audit) | **48 / 48** |
| **Total** | **642 / 642** |

L'audit Chantiers remonte toujours son unique constat **SITE-01 (MAJOR)** — historique global dans l'onglet Historique d'une fiche chantier. Ce constat **préexiste à la V2.4.11.1** (relevé sur la baseline V2.4.10.2) et n'est pas dans le périmètre de cette version ; il reste ouvert.

**Moteurs vérifiés byte-identiques** (§25) : `planReflow`, `applyReflowPlan`, `setTaskStatus`, `dropTask`, `kanbanDrop`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `getCriticalImpacts`, `kanbanBucket`, `impactChainSources`, `impactChainSet`, `alignDemoDates`, `analyzeKanvixImport`, `applyImportPlan`, `isFieldConfirmation`, `getTaskSuccessors`, `planningTasks`, `setPlanningView`, `toggleImpactChain`, `kanbanDepsHTML`, ainsi que `gantt`, `renderTeam`, `resourceLoadBoard` et `renderSites`.

Autrement dit : **Gantt (§21), Accueil (§22), Chantiers (§23) et Équipe (§24) n'ont reçu aucune modification** — le diff le démontre ligne à ligne.

Les statuts `todo` / `doing` / `done` / `waiting` / `late` sont inchangés, et le Kanban conserve **exactement 3 colonnes** — À faire / En cours / Terminée (BADGE-15). Aucune colonne « En attente ».

## 17. Erreurs console

**0 erreur JavaScript applicative** sur l'ensemble de la recette et des dix suites de non-régression. Les seules lignes réseau observées sont les appels météo/géo volontairement coupés par les tests.

## 18. Tâche terminée (§20)

Aucun comportement nouveau spécifique aux tâches `done` n'a été créé. Une tâche terminée reste non draggable et protégée par les garde-fous V2.4.10.1 (BADGE-16). La règle de badge s'y applique **comme partout ailleurs** : si elle reste dans la chaîne de conséquences d'un incident réellement ouvert, elle porte SOUS IMPACT ; dès que l'incident amont est résolu, le badge disparaît. C'est la continuité de la règle existante — une tâche terminée portant un incident ouvert affichait déjà À TRAITER en V2.4.11.

## Question finale

> « En regardant une carte Kanban, peut-on distinguer immédiatement une tâche qui porte le problème d'une tâche qui peut continuer à être exécutée mais reste affectée par ce problème ? »

**OUI.** « Pose des 6 fenêtres » porte une pastille ambrée pleine **À TRAITER** — il y a quelque chose à faire dessus. « Peinture étage 1 » et « Contrôle final » portent une pastille ardoise contourée **SOUS IMPACT** — elles peuvent avancer, elles subissent les conséquences. Et une tâche passée en « En cours » garde son SOUS IMPACT au lieu de réclamer à tort une prise en charge.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.11.1.html` — fichier complet.
2. `recette-kanban-badges-v2.4.11.1.mjs` — suite (84 vérifications, BADGE-01→BADGE-18).
3. `rapport-recette-kanban-badges-v2.4.11.1.md` — ce rapport.
4. Captures : `recette-kanban-badges-v2.4.11.1/` (01→11).
