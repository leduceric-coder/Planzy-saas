# Kanvix V2.4.11.2 — Correction sémantique finale des badges Kanban

Source : `public/poc/kanvix-next-gen-v2.4.11.1.html` → cible `public/poc/kanvix-next-gen-v2.4.11.2.html`.
Version **vocabulaire uniquement**. Aucun calcul modifié, aucun moteur métier touché, aucun redesign.

## Verdict

**PASS.** Une tâche peut désormais être « En cours » sans qu'un badge laisse croire qu'elle attend encore d'être prise en charge.

| Résultat | |
|---|---|
| Recette badges Kanban (`recette-kanban-badges-v2.4.11.2.mjs`, BADGE-01→BADGE-21) | **101 / 101** |
| Non-régressions (10 suites gelées) | **642 / 642** |
| **Total** | **743 / 743** |
| Erreurs console applicatives | **0** |

## 1. Portée réelle de la modification

Le diff complet V2.4.11.1 → V2.4.11.2 contient **une seule chaîne rendue à l'écran** :

```diff
-              ? `<span class="kanban-badge attention">À traiter</span>`
+              ? `<span class="kanban-badge attention">Point ouvert</span>`
```

Les quatre autres lignes du diff sont des **commentaires** de `kanbanCard()` et du bloc CSS, mis au nouveau vocabulaire pour que le code reste cohérent avec ce qu'il affiche. Rien d'autre.

## 2. Nouvelle sémantique

| Badge | Définition | Inchangé depuis |
|---|---|---|
| **POINT OUVERT** | la tâche possède elle-même au moins un incident non résolu | calcul V2.4.11.1, libellé nouveau |
| **SOUS IMPACT** | la tâche ne porte pas l'incident source mais subit les conséquences d'un incident ouvert en amont | V2.4.11.1, strictement intact |
| **REPRISE** | tâche issue d'une reprise SAV | V2.2 |

Le principe est désormais explicite dans l'interface : **la colonne décrit l'exécution, le badge décrit le contexte.** Le badge ne répète ni ne contredit plus le statut.

## 3. Aucun calcul modifié (§1)

`openIssue`, `isImpacted`, `kanbanImpactContext()`, `impactChainSources()`, `impactChainSet()` et `getCriticalImpacts()` sont **byte-identiques** à la V2.4.11.1 (vérification md5 fonction par fonction) :

```js
openIssue  = app.issues.find(i => i.taskId === t.id && i.status !== "resolved" && !isFieldConfirmation(i))
isImpacted = !openIssue && ctx.impacted.has(t.id) && !ctx.sources.has(t.id)
```

La priorité de l'incident direct, l'exclusion des confirmations terrain, le calcul unique par rendu et l'indépendance du toggle « Chaîne d'impact » sont conservés tels quels.

## 4. Le libellé ne dépend jamais du statut (§3)

**Aucune branche conditionnelle sur `todo` / `doing` / `waiting` / `late` n'a été introduite.** Un incident direct non résolu produit **POINT OUVERT**, un point c'est tout — quel que soit le statut. Le même concept garde toujours le même nom, ce qui est précisément ce qui évite de recréer l'ambiguïté.

C'est vérifié en positif (BADGE-19 : le badge survit au passage en « En cours ») et en négatif (BADGE-21 : la chaîne « À traiter » est absente du HTML du tableau Kanban).

## 5. Les cinq cas de référence

| Cas | Situation | Rendu | Test |
|---|---|---|---|
| 1 | « Pose des 6 fenêtres », À faire, incident « Fenêtres décalées » | À faire + **POINT OUVERT** | BADGE-08, BADGE-18 |
| 2 | « Tableau électrique », En cours, incident « Créneau électricien à confirmer » | En cours + **POINT OUVERT** | **BADGE-19** |
| 3 | « Peinture étage 1 », À faire, conséquence pure de la chaîne Keravel | À faire + **SOUS IMPACT** | BADGE-18, BADGE-20 |
| 4 | Conséquence pure passée En cours | En cours + **SOUS IMPACT** | **BADGE-20** |
| 5 | Tâche sans incident, hors chaîne d'impact | **aucun badge** | BADGE-09 |

## 6. Test réel « Tableau électrique » (§8)

Sur les données de démonstration, incident confirmé : **« Créneau électricien à confirmer »** (`k-elec-slot`, statut `watching`).

| Étape | Colonne | Badge |
|---|---|---|
| État initial | À faire | POINT OUVERT |
| Après `setTaskStatus('k-electric', 'doing')` | **En cours** | **POINT OUVERT** |

Assertions : le badge est bien rendu `POINT OUVERT`, **aucun « À TRAITER » n'apparaît sur la carte démarrée** (interdiction du §8 vérifiée explicitement), et il n'y a pas de cumul avec SOUS IMPACT. Capture `12-tableau-electrique-en-cours.png`.

## 7. Autres écrans non touchés (§7)

**Aucun remplacement aveugle.** Les occurrences de « À traiter » qui désignent réellement une liste d'actions ou de décisions sont conservées :

- **Cockpit chantier** — la zone `<h2 class="zone-title">À traiter</h2>` de `renderProject()` est intacte, et BADGE-21 vérifie qu'elle s'affiche toujours.
- **Accueil** — se rend normalement, aucune formulation modifiée.
- Le seul autre « À traiter » du fichier est un commentaire interne (`getProjectSummary`), sans rendu.

`renderProject`, `renderTeam`, `renderSites`, `gantt` et `resourceLoadBoard` sont **byte-identiques**.

## 8. Résultats BADGE-01 → BADGE-21

| Test | Objet | Résultat |
|---|---|---|
| BADGE-01 | Incident direct → POINT OUVERT (seul) | **PASS** |
| BADGE-02 | Chaîne A→B→C : A=POINT OUVERT, B et C=SOUS IMPACT | **PASS** |
| BADGE-03 | B « À faire → En cours » : reste SOUS IMPACT | **PASS** |
| BADGE-04 | Incident résolu : plus aucun badge sur A, B, C | **PASS** |
| BADGE-05 | Incident propre sur B : B=POINT OUVERT, C reste SOUS IMPACT | **PASS** |
| BADGE-06 | Toggle « Chaîne d'impact » OFF/ON : badges strictement identiques | **PASS** |
| BADGE-07 | Kanban → Gantt → Kanban : recalcul correct, aucun état persisté | **PASS** |
| BADGE-08 | Filtre chantier : même logique de badges | **PASS** |
| BADGE-09 | Tâche neutre : aucun badge | **PASS** |
| BADGE-10 | REPRISE + POINT OUVERT et REPRISE + SOUS IMPACT | **PASS** |
| BADGE-11 | Dark mode : 4 pastilles différenciables, aucun rouge | **PASS** |
| BADGE-12 | Mode clair : libellés exacts, aucun rouge, « À surveiller » non réutilisé | **PASS** |
| BADGE-13 | Responsive 1920 → 390 : aucun débordement, aucun scroll | **PASS** |
| BADGE-14 | Accessibilité : texte visible + différenciation non chromatique | **PASS** |
| BADGE-15 | Aucune mutation au rendu, 3 colonnes, SCHEMA_VERSION et STORE inchangés | **PASS** |
| BADGE-16 | Tâche terminée : non draggable, garde-fous V2.4.10.1 préservés | **PASS** |
| BADGE-17 | 0 erreur console applicative | **PASS** |
| BADGE-18 | Démo réelle : les deux niveaux coexistent, aucun cumul | **PASS** |
| **BADGE-19** | **« Tableau électrique » En cours → POINT OUVERT, jamais À TRAITER (§8)** | **PASS** |
| **BADGE-20** | **Conséquence pure En cours → SOUS IMPACT (§10/§11)** | **PASS** |
| **BADGE-21** | **0 badge « À TRAITER » dans le Kanban, cockpit chantier préservé (§13/§7)** | **PASS** |

**101 assertions, 101 PASS.** Tous les tests de la V2.4.11.1 ont été conservés (SOUS IMPACT, incident direct, impact aval, reprise, dark mode, responsive, toggle, filtre, absence de persistance) ; seules les assertions de libellé Kanban passent de « À TRAITER » à « POINT OUVERT » (§14).

## 9. Non-régressions (§15)

Toutes les suites rejouées **contre `kanvix-next-gen-v2.4.11.2.html`** :

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

## 10. Périmètre interdit (§16)

**Byte-identiques** entre V2.4.11.1 et V2.4.11.2 : `setTaskStatus`, `kanbanDrop`, `kanbanBucket`, `planReflow`, `applyReflowPlan`, `impactChainSources`, `impactChainSet`, `getCriticalImpacts`, `kanbanImpactContext`, `kanbanBoard`, `gantt`, `renderProject`, `renderTeam`, `renderSites`, `resourceLoadBoard`, `analyzeKanvixImport`, `applyImportPlan`, `applySimulation`, `evaluateScenario`, `scenarioOptions`, `alignDemoDates`, `requestTaskScheduleMove`, `dropTask`, `isFieldConfirmation`.

Les règles CSS `.kanban-badge.attention` et `.kanban-badge.impacted` sont **inchangées** : POINT OUVERT conserve exactement le design de l'ancien badge (§6), et reste visuellement plus actionnable que SOUS IMPACT.

`SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (**`kanvix-product-8-3`**), aucune migration, aucune propriété persistée.

## Critère final

| Combinaison | Signification |
|---|---|
| À faire + POINT OUVERT | tâche non démarrée avec un sujet non résolu |
| En cours + POINT OUVERT | tâche démarrée, sujet toujours non résolu |
| À faire + SOUS IMPACT | tâche affectée par un problème amont |
| En cours + SOUS IMPACT | tâche en exécution malgré un problème amont |

**Aucun badge « À TRAITER » ne subsiste dans les cartes Kanban** (BADGE-21, vérifié sur le HTML du tableau).

## Question finale

> « Une tâche peut-elle maintenant être en cours sans qu'un badge donne l'impression qu'elle attend encore d'être prise en charge ? »

**OUI.** « Tableau électrique » est en colonne **En cours** et porte **POINT OUVERT** : la colonne dit qu'elle avance, le badge dit qu'un sujet reste à trancher. Les deux informations ne se contredisent plus.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.11.2.html` — fichier complet.
2. `recette-kanban-badges-v2.4.11.2.mjs` — suite (101 vérifications, BADGE-01→BADGE-21).
3. `rapport-recette-kanban-badges-v2.4.11.2.md` — ce rapport.
4. Captures : `recette-kanban-badges-v2.4.11.2/` (01→13).
