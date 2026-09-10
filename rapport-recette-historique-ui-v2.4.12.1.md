# Kanvix V2.4.12.1 — Timeline de l'Historique chantier + navigation réelle vers les tâches

Source : `public/poc/kanvix-next-gen-v2.4.12.html` → cible `public/poc/kanvix-next-gen-v2.4.12.1.html`.
Version **rendu uniquement**. Le moteur de rattachement V2.4.12 n'a pas été touché.

## Verdict

**PASS.** L'Historique est devenu un journal chronologique compact ; la main n'apparaît plus que sur un élément réellement cliquable, et « Voir la tâche → » ouvre bien la bonne tâche.

| Résultat | |
|---|---|
| Recette UI timeline (`recette-historique-ui-v2.4.12.1.mjs`) | **90 / 90** |
| Recette historique V2.4.12 (SITE-01) | **106 / 106** |
| Recette Chantiers (SITE-F1→F10) — **FINDINGS : 0** | **48 / 48** |
| Badges Kanban V2.4.11.3 | **165 / 165** |
| Autres non-régressions (8 suites gelées) | **594 / 594** |
| **Total** | **1003 / 1003** |
| Erreurs console applicatives | **0** |

## 1. Structure de la timeline

```
Historique                                          [ 6 événements ]
Toutes les modifications et événements liés à ce chantier
──────────────────────────────────────────────────────────────────
10 SEPT. 2026

  22:11  ●│  Tableau électrique · commencée
         │  Eric                              [ Voir la tâche → ]

  21:18  ●│  Pose des 6 fenêtres modifiée.
         │  Début      3 sept. → 5 sept.
         │  Ressource  Thomas → Mathieu
         │  Décalage validé avec le client.
         │  Eric                              [ Voir la tâche → ]
```

Trois zones sur desktop (§31) : **HEURE · RAIL · ÉVÉNEMENT** (`grid-template-columns: 46px 14px minmax(0,1fr)`). Le rail est un trait continu de 1 px en `--border-light`, coupé à mi-hauteur sur le dernier événement d'un groupe ; chaque événement porte une pastille de 8 px.

### Header (§8/§9)

Icône Kanvix discrète (`icon("today")`, tracé — pas d'emoji, pas de bibliothèque), titre **Historique**, sous-titre « Toutes les modifications et événements liés à ce chantier », et à droite un compteur. Ce compteur vaut exactement **`projectHistory(projectId).length`**, jamais `app.history.length` — vérifié par assertion.

### Filtre « Tout » — **omis** (§10)

Aucun filtrage par type ne peut être fait proprement sur les données actuelles sans inventer une taxonomie. Conformément au §10, **aucun contrôle décoratif n'a été ajouté** : priorité à une timeline propre et fiable.

## 2. Regroupement par date — et une limite réelle des données

`historyStamp(h)` lit `h.date` **sans jamais la modifier** et en extrait ce qui est réellement présent :

| Format rencontré | Groupe | Heure affichée |
|---|---|---|
| `"2026-09-10T18:00"` (horodatage complet) | **10 sept. 2026** | `18:00` |
| `"22:11"` (heure seule) | pas de jour connu | `22:11` |
| `"hier"` (illisible) | pas de jour connu | `hier` (valeur brute) |

**Point important à connaître :** les moteurs Kanvix écrivent aujourd'hui `date: fmtTime(getDemoNow())`, c'est-à-dire **une heure seule, sans jour** — vérifié sur les 14 points d'écriture de `app.history`. Le jour n'est donc **pas dérivable** de la donnée existante.

Deux options s'offraient : afficher une date déduite de « aujourd'hui » — ce qui **inventerait** une information potentiellement fausse (§15) — ou n'afficher aucun en-tête de journée quand la donnée n'en porte pas. **La seconde a été retenue.** Concrètement :

- **Toutes les entrées sans jour** (cas des données actuelles) → aucun en-tête de date, timeline d'heures pure et propre.
- **Entrées datées** → un groupe par journée, libellé `10 sept. 2026`, jours les plus récents en premier.
- **Mélange daté / non daté** → les non datées forment un groupe étiqueté **« Date non précisée »** (§7), pour ne jamais laisser croire qu'elles appartiennent au jour précédent.

Aucun événement n'est jamais perdu, et **aucune exception JS** sur une date illisible (HIST-UI-07).

> **Réserve produit.** Pour que le regroupement par journée soit visible sur les données de production, il faudra que les moteurs écrivent un horodatage complet (`localDateTime(getDemoNow())` plutôt que `fmtTime(...)`). Cela touche `setTaskStatus`, `applyReflowPlan` et une dizaine d'autres points d'écriture, tous **explicitement interdits** en V2.4.12.1 (§73) — c'est donc une évolution à part entière, à décider séparément. Le rendu actuel est déjà prêt à l'accueillir : le jour s'affichera automatiquement dès que la donnée le portera.

## 3. Densité avant / après — mesurée

Même jeu de 10 événements, même viewport (1440×1000), mesure DOM réelle :

| | V2.4.12 | V2.4.12.1 |
|---|---|---|
| Hauteur moyenne par événement | **77 px** | **59 px** |
| Hauteur totale des 10 événements | **855 px** | **648 px** |
| Gain | — | **−24 %** |

59 px pour un événement simple, dans la fourchette visée de 64–82 px (§12) et sans devenir illisible — assertion explicite `59 ≥ 50 && ≤ 110`. Les événements portant `changes` et `comment` restent naturellement plus hauts, comme prévu.

## 4. Classes CSS créées

`.history-panel` · `.history-header` · `.history-header-icon` · `.history-header-text` · `.history-count` · `.history-list` · `.history-day` · `.history-day-label` · `.history-day-events` · `.history-event` · `.history-time` · `.history-rail` · `.history-dot` · `.history-event-body` · `.history-event-title` · `.history-event-detail` · `.history-changes` · `.history-change` · `.history-event-foot` · `.history-event-meta` · `.history-task-link` · `.history-empty`, plus les tonalités `.tone-start` / `.tone-done` / `.tone-warn` / `.tone-neutral`.

Surface légère (§13) : bordure 1 px, `--radius-md`, **aucune ombre** sur les événements.

## 5. `.row` supprimé de l'historique — et conservé ailleurs

`historyHTML()` ne génère plus **aucun** `<div class="row">`. La règle générique `.row { cursor: pointer }` n'a **pas** été touchée (§75) : elle sert de ligne réellement cliquable sur d'autres écrans. Vérifié à deux niveaux — la règle existe toujours dans la feuille de style **et** un élément `.row` vivant injecté hors historique calcule bien `cursor: pointer`.

## 6. `cursor: default` — la fausse affordance est levée

| Élément | Curseur |
|---|---|
| `.history-event` (fond) | **default** |
| `.history-event-body` | **default** |
| `.history-event-title` | **default** |
| `.history-task-link` | **pointer** |

Aucun hover ne modifie la surface de l'événement (§35, vérifié par comparaison de `backgroundColor` avant/après `mouseover`). **HIST-UI-16** balaie chaque nœud de chaque événement : aucun `onclick`, `role="button"`, `tabindex` ou `cursor: pointer` en dehors des boutons ; les seuls éléments focusables du panneau sont les boutons « Voir la tâche ».

## 7. « Voir la tâche → »

Vrai `<button type="button">` appelant `openTask(id)` — aucun nouveau drawer, aucun nouveau chemin (§38).

| Situation | Rendu |
|---|---|
| `taskId` valide | **Voir la tâche →** |
| `taskId` absent, `sourceTaskId` valide | **Voir la tâche source →** (§23) |
| `taskId` présent mais tâche **supprimée** | **aucun bouton** (§22) |
| `projectId` seul (incident, simulation, photo sans tâche) | **aucun bouton** (§24) |

**HIST-UI-04** clique réellement sur le bouton de deux événements distincts et vérifie le titre du drawer ouvert : « Tableau électrique » puis « Pose des 6 fenêtres » — la bonne tâche à chaque fois.

**Retour (§39/§54)** : après fermeture du drawer, `app.ui.page` vaut toujours `project`, l'onglet **Historique** reste actif, et la timeline est intacte. Aucune navigation vers Planning.

**Clavier (§36/§37)** : le bouton reçoit le focus natif, **Entrée** et **Espace** l'activent tous deux et ouvrent la bonne tâche. Aucun `div onclick`.

## 8. `changes` et `comment`

Les différences passent d'une liste `<ul class="ta-changes">` à un `<dl class="history-changes">` compact à deux colonnes (§16) :

```
Début      3 sept. → 5 sept.
Ressource  Thomas → Mathieu
```

Le commentaire est conservé sous les différences dans une zone secondaire (§17), et l'auteur est affiché tel quel — `Eric`, `Kanvix`, ressource terrain — **jamais réinventé** (§18).

## 9. Pastilles — présentation seule

`historyEventTone(h)` choisit une couleur parmi bleu (évolution) / vert (résolution) / ambre (attention) / gris (neutre). Cette lecture du texte est **tolérée par le §28 pour le seul choix d'une icône**, avec repli systématique sur `neutral`.

**Elle ne rattache rien, ne filtre rien, ne modifie rien** : `historyProjectId()` reste l'unique vérité de rattachement (§26). Aucun `h.eventType` ni `h.tone` n'est persisté (§27, vérifié).

## 10. Dark mode

Timeline construite sur les variables existantes. Vérifié en sombre : rail, pastilles, cartes, heure, auteur, bouton, différences, commentaire et libellé de journée — tous rendus et lisibles, **aucun aplat blanc forcé** (assertion sur le RGB du fond des événements).

## 11. Responsive

| Largeur | Rail / colonne heure | Débordement | Scroll horizontal |
|---|---|---|---|
| 1920 · 1440 · 1280 · 900 · 768 | 3 zones, rail visible | 0 | 0 |
| 430 · 390 | **heure au-dessus, rail masqué** (§33) | 0 | 0 |

À 640 px et moins, l'événement passe en une colonne : pas de colonne gauche coûteuse sur petit écran.

## 12. Volumes

| Cas | Résultat |
|---|---|
| **0** événement | zone légère, « Aucune modification récente. », compteur `0 événement`, jamais rempli avec d'autres chantiers (§43) |
| **1** événement | même structure timeline, compteur au singulier (§44) |
| **50** événements | tous rendus, scan rapide des heures et titres (§45) |
| **1000** entrées / 30 chantiers | filtrage exact conservé, rendu en **2 ms** (§46) |

## 13. Résultats HIST-UI-01 → 16

| Test | Objet | Résultat |
|---|---|---|
| HIST-UI-01 | Timeline en place, aucun `.row` générique, compteur = `projectHistory().length` | **PASS** |
| HIST-UI-02 | `cursor: default` partout sauf sur le bouton ; `.row` intact ailleurs | **PASS** |
| HIST-UI-03 | Vrai `<button type="button">`, « Voir la tâche source » pour `sourceTaskId` | **PASS** |
| HIST-UI-04 | Clic réel → **la bonne tâche** (2 tâches testées) | **PASS** |
| HIST-UI-05 | Retour : page `project`, onglet Historique actif, timeline intacte | **PASS** |
| HIST-UI-06 | `projectId` seul → aucun faux bouton | **PASS** |
| HIST-UI-07 | `taskId` supprimé → visible, sans bouton, sans erreur ; date illisible préservée | **PASS** |
| HIST-UI-08 | 5 événements du même jour → une seule date de groupe | **PASS** |
| HIST-UI-09 | Deux jours → deux groupes, ordre chronologique strict | **PASS** |
| HIST-UI-10 | `changes` + `comment` conservés, auteur intact, plus de `.ta-changes` | **PASS** |
| HIST-UI-11 | Entrée globale toujours absente de la fiche chantier | **PASS** |
| HIST-UI-12 | Aucune fuite Keravel ↔ Villa ; fiche tâche sans historique global | **PASS** |
| HIST-UI-13 | Dark mode : tout lisible, aucun aplat blanc | **PASS** |
| HIST-UI-14 | 1920 → 390 px : 0 débordement, 0 scroll | **PASS** |
| HIST-UI-15 | Focus clavier, Entrée **et** Espace ouvrent la bonne tâche | **PASS** |
| HIST-UI-16 | Aucun élément non interactif faussement actionnable | **PASS** |

Plus : **HIST-DENSITY** (mesure avant/après), **HIST-VOLUME** (1/50/1000), **HIST-PURE** (aucun effet de bord), **HIST-EMPTY**. **90 assertions, 90 PASS.**

## 14. SITE-01 toujours fermé

`historyProjectId()` et `projectHistory()` sont **byte-identiques** à la V2.4.12 (§40), `projectTabContent` appelle toujours `historyHTML({ projectId: id })` (§41) et `openTask` toujours `taskActivity(id)` seul (§42) — ces trois fonctions sont elles aussi byte-identiques.

La recette Chantiers rejouée **sans modification** confirme : `48 passed, 0 failed`, **FINDINGS (0)**.

### Note de transparence sur la recette historique V2.4.12

Rejouée telle quelle contre V2.4.12.1, cette suite remontait **12 échecs** — tous, sans exception, sur des assertions qui **comptaient le markup `class="row"`** ou interrogeaient `.section .row`. Aucune assertion d'isolation, de rattachement ou de périmètre n'a échoué. Ces sélecteurs devaient nécessairement changer, puisque le §1 et le §75 imposent précisément que l'historique n'utilise plus `.row`.

La suite a donc reçu une **migration de sélecteurs**, sans qu'aucune assertion ne change de sens : le comptage d'entrées est désormais **agnostique du markup** (`class="row"` **ou** `class="history-event"`). Conséquence vérifiable : la suite passe **106 / 106 contre V2.4.12 comme contre V2.4.12.1**, et reste donc un garde-fou valable pour les deux fichiers.

## 15. Non-régressions

| Suite | Résultat |
|---|---|
| Recette historique V2.4.12 | **106 / 106** |
| Badges Kanban V2.4.11.3 | **165 / 165** |
| Accueil | **149 / 149** |
| Mode Chantier | **95 / 95** |
| Planning Bureau (dont PLAN-F1→F10) | **76 / 76** |
| Import intelligent | **75 / 75** |
| Réglages | **63 / 63** |
| Édition universelle des tâches | **58 / 58** |
| Chantiers (audit) | **48 / 48** |
| Recette UI / responsive V2.4.11 | **47 / 47** |
| ancien Planning | **17 / 17** |
| Résoudre — calendrier dynamique | **14 / 14** |

**28 fonctions vérifiées byte-identiques** (§73) : `historyProjectId`, `projectHistory`, `taskActivity`, `openTask`, `projectTabContent`, `openProjectTab`, `planReflow`, `applyReflowPlan`, `setTaskStatus`, `kanbanDrop`, `dropTask`, `requestTaskScheduleMove`, `scenarioOptions`, `evaluateScenario`, `applySimulation`, `setIssueStatus`, `kanbanCard`, `kanbanBoard`, `gantt`, `renderProject`, `renderTeam`, `renderSites`, `resourceLoadBoard`, `analyzeKanvixImport`, `applyImportPlan`, `confirmCloseProject`, `restoreProject`, `deleteProjectCascade`.

`SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (**`kanvix-product-8-3`**), aucune migration (§74). Règle CSS `.row` inchangée.

## 16. Erreurs console

**0 erreur JavaScript applicative** sur la recette UI et l'ensemble des suites rejouées.

## Question finale

> « En regardant l'Historique, puis-je parcourir rapidement la vie du chantier et comprendre immédiatement quels éléments me permettent réellement d'ouvrir une tâche ? »

**OUI.** Les heures s'alignent en colonne, le rail donne la chronologie d'un coup d'œil, et **24 % de hauteur en moins** par événement laisse voir bien plus d'histoire à l'écran. Ce qui est cliquable se voit : une seule pastille bleue « Voir la tâche → », et rien d'autre ne prend la main.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.12.1.html` — fichier complet.
2. `recette-historique-ui-v2.4.12.1.mjs` — suite (90 vérifications, HIST-UI-01→16 + densité, volumes, pureté, état vide).
3. `rapport-recette-historique-ui-v2.4.12.1.md` — ce rapport.
4. Captures : `recette-historique-ui-v2.4.12.1/` (01→07).
5. `recette-historique-chantiers-v2.4.12.mjs` — sélecteurs rendus agnostiques du markup, valable sur V2.4.12 **et** V2.4.12.1.
