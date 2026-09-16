# Rapport — Kanvix V2.8.3.1 · Sécurisation sémantique des statuts de jalons

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.3.1.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.3.html`
**Recette métier** : `recette-jalons-statuts-v2.8.3.1.mjs` — **29 / 29 PASS**, **0 erreur console**
**Recette de référence** : `recette-frise-jalons-v2.8.3.1.mjs` — **42 / 42 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.3.1/` (7 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## 1. Le problème métier

V2.8.3 appliquait à **tous** les jalons la règle de fin de chantier :

```js
if (m.date && calculateProjectEnd(m.projectId) > m.date) → « Menacé »
```

Cette règle est juste pour un jalon **final**. Elle est fausse pour tout le reste. Sur

```
Fondations   10 octobre
Hors d'eau   20 novembre
Livraison    15 janvier
```

la fin du chantier tombe naturellement après les deux premiers jalons : V2.8.3 déclarait donc
« Fondations » et « Hors d'eau » **menacés** alors que tout se déroulait normalement.

Le second défaut était symétrique. Un jalon passé sans intervention ouverte était déclaré
**« Atteint »** — une **inférence** présentée comme une certitude. Une intervention peut très bien
avoir été déplacée, ou n'avoir jamais existé : rien ne prouve que le jalon a été franchi.

Sur les données de démonstration elles-mêmes, le défaut était visible : le jalon « Contrôle fin de
second œuvre » de Résidence Keravel s'affichait **« Menacé »**. Il s'affiche désormais
**« À venir »**.

---

## 2. La distinction introduite : tâche liée / final / intermédiaire

Kanvix disposait déjà de tout ce qu'il fallait — `milestone.taskId` et `milestone.isFinal` — sans
jamais s'en servir pour interpréter un jalon. Les trois cas ne disent pourtant pas la même chose :

- **Jalon lié à une tâche** — la tâche est un **fait**. Son statut et ses dates permettent
  l'interprétation la plus précise, et elle prime sur toute estimation.
- **Jalon final** — c'est le seul pour lequel la fin estimée du chantier veut dire quelque chose.
  La règle historique de `milestoneImpactNote()` vit désormais **là, et seulement là**.
- **Jalon intermédiaire sans tâche** — Kanvix ne connaît que la date. Il le dit, au lieu de déduire.

---

## 3. La nouvelle table de décision

| Type de jalon | Situation | Statut | Tonalité |
|---|---|---|---|
| Chantier fermé | clôturé | **Chantier clôturé** | neutre |
| Chantier fermé | archivé | **Chantier archivé** | neutre |
| Lié à une tâche | tâche terminée | **Atteint** | succès |
| Lié à une tâche | date passée + tâche ouverte | **Dépassé** | danger |
| Lié à une tâche | futur + tâche finit après la cible | **Menacé** | avertissement |
| Lié à une tâche | sinon | **À venir** | neutre |
| Final | date passée + chantier actif | **Dépassé** | danger |
| Final | futur + fin de chantier > cible | **Menacé** | avertissement |
| Final | sinon | **À venir** | neutre |
| Intermédiaire sans tâche | date future | **À venir** | neutre |
| Intermédiaire sans tâche | date passée | **Date passée** | neutre |

L'ordre de décision est strictement celui du tableau : chantier fermé, puis tâche liée, puis jalon
final, puis jalon intermédiaire. **Aucune heuristique n'est mélangée à une autre.**

La garantie est structurelle, pas seulement comportementale, et elle est mesurée :

```json
{"plusDeDeduction":true,"finSousIsFinal":true,"tacheDAbord":true}
```

`milestoneStatus()` n'appelle **plus** `milestoneOpenTasks()`, et l'appel à
`calculateProjectEnd()` se situe **après** le test `m.isFinal === true` dans le corps de la
fonction. La règle de fin de chantier est donc **inaccessible** à un jalon intermédiaire — ce n'est
pas une convention, c'est le flot de contrôle.

---

## 4. Le statut « Date passée »

`key: "past"`, tonalité **neutre**, icône **calendrier nu** (`planning` — volontairement pas
`today`, qui porte une coche et suggérerait un achèvement).

« Date passée » dit **une seule chose** : la date cible est derrière nous. Ni atteint, ni dépassé,
ni échoué, ni conforme.

Le statut est **distinct de `done`** et ne doit jamais être fusionné avec lui. C'est vérifié :

```json
{"badges":["Atteint","Date passée"],"dots":["1 atteint","1 date passée"]}
```

---

## 5. « N interventions d'ici là » est maintenu, et devient indépendant

`milestoneOpenTasks()` est **byte-identique** et continue d'alimenter la ligne de volumétrie des
cartes. Ce qu'elle ne fait plus, c'est **décider** qu'un jalon est atteint.

Les deux notions sont désormais orthogonales, et la recette le prouve sur le même jalon :

```json
{"badge":"Date passée","meta":"2 interventions d’ici là"}
```

---

## 6. `milestoneImpactNote()` n'a pas été touchée

Elle est **byte-identique**, comme demandé. Ce lot ne corrige pas la règle : il corrige **à qui**
la frise l'applique.

---

## 7. Schéma et magasin

| | |
|---|---|
| `SCHEMA_VERSION` | **12 → 12** — aucune migration |
| `STORE` | `kanvix-product-8-3` — inchangé |
| Champs d'un jalon | `id`, `projectId`, `name`, `date`, `isFinal`, `taskId` — **aucun ajout** |

---

## 8. Les cas de test métier STAT-01 → STAT-18

**29 / 29 PASS, 0 erreur console.** Chaque cas lit le statut **rendu à l'écran**, pas seulement la
valeur retournée par la fonction.

| # | Cas | Attendu | Obtenu |
|---|---|---|---|
| STAT-01 | chantier clôturé | Chantier clôturé | ✓ |
| STAT-02 | chantier archivé | Chantier archivé | ✓ |
| STAT-03 | tâche liée terminée, date **future** | Atteint | ✓ |
| STAT-04 | tâche liée ouverte, date passée | Dépassé | ✓ |
| STAT-05 | futur, tâche finit après la cible | Menacé | ✓ |
| STAT-06 | futur, tâche finit avant la cible | À venir | ✓ |
| STAT-07 | final passé, chantier actif | Dépassé | ✓ |
| STAT-08 | final futur, fin de chantier au-delà | Menacé | ✓ |
| STAT-09 | final futur, fin de chantier en deçà | À venir | ✓ |
| STAT-10 | **intermédiaire futur** (fin de chantier 82 jours plus tard) | **À venir** | ✓ |
| STAT-11 | **intermédiaire passé** | **Date passée**, tonalité vide | ✓ |
| STAT-12 | `taskId` inexistant | Date passée, **0 erreur JS** | ✓ |
| STAT-13 | intermédiaire passé + 2 interventions ouvertes | Date passée **et** « 2 interventions d'ici là » | ✓ |
| STAT-14 | deux jalons, **même date, même chantier**, seul `isFinal` diffère | A = À venir, B = Menacé | ✓ |
| STAT-14b | `isFinal` **absent** (jalon historique) | À venir — jamais traité comme final | ✓ |
| STAT-15 | 1 puis 2 jalons `past` | « 1 date passée » puis « 2 dates passées » | ✓ |
| STAT-15b | `past` et `done` côte à côte | restent distincts dans la frise et la répartition | ✓ |
| STAT-16 | appels répétés aux moteurs | `app.milestones`, `app.projects`, `app.tasks` **strictement identiques** | ✓ |
| STAT-17 | schéma | 12 | ✓ |
| STAT-18 | magasin | `kanvix-product-8-3` | ✓ |

**STAT-10 et STAT-14 sont les deux cas décisifs.** STAT-10 place volontairement la fin du chantier
82 jours après un jalon intermédiaire : V2.8.3 l'aurait déclaré « Menacé ». STAT-14 isole la seule
variable qui compte en donnant aux deux jalons la même date et le même chantier.

---

## 9. Vérification visuelle : la frise validée n'a pas bougé

À **1440px** comme à **390px**, comparaison V2.8.3 → V2.8.3.1 :

| Mesure | 1440px | 390px |
|---|---|---|
| Colonnes | 3 = 3 | 1 = 1 |
| Largeur des cartes | 376/376/376 | 217/217/217 |
| Bord haut des cartes | identique | identique |
| Rail (épaisseur / style) | `2px / dashed` | `2px / dashed` |
| Bulles | 38×38 | 30×30 |
| Squelette DOM de composition | **identique** | **identique** |
| Débordement horizontal | −15 | −15 |
| Navigation basse | 1 = 1 | 1 = 1 |

Le squelette est la suite des balises et de leurs classes, **sans le texte**, en neutralisant les
quatre porteurs du statut — les classes `st-*`, la tonalité du badge, le dessin de l'icône dans la
bulle et les vignettes de répartition. Tout le reste de la frise correspond au caractère près.

**Les seules différences de rendu sont nommées explicitement**, et ce sont celles que le lot
poursuit :

```json
{"statutsV283":["Menacé","À venir","À venir"],  "statutsV2831":["À venir","À venir","À venir"],
 "repartitionV283":["2 à venir","1 menacé"],    "repartitionV2831":["3 à venir"]}
```

---

## 10. Rejeu de la recette frise V2.8.3 — deux assertions obsolètes, documentées

`recette-frise-jalons-v2.8.3.mjs` a été rejouée **sans être modifiée** : **40 / 42**.

### FRISE-14

- **Ancienne règle encodée dans le test** : `date passée → (interventions ouvertes ? Dépassé : Atteint)`,
  sinon `fin de chantier > cible → Menacé`.
- **Nouvelle règle** : arbre tâche → final → intermédiaire.
- **Pourquoi l'échec est attendu** : cette assertion **est** l'encodage de la règle que le lot
  corrige. Elle recalcule l'attendu avec l'ancien arbre, et diverge donc exactement sur les trois
  jalons visés :

| Jalon | V2.8.3 attendait | V2.8.3.1 rend |
|---|---|---|
| Coulage dalle R+2 (intermédiaire passé) | Atteint | **Date passée** |
| Contrôle fin de second œuvre (intermédiaire futur) | Menacé | **À venir** |
| Réception menuiseries (intermédiaire futur) | Menacé | **À venir** |

### FRISE-17

- **Assertion** : `col.every(bulle === liseré) && col.some(st-risk || st-late)`.
- **Ce qui tient** : la première moitié — **l'invariant de couleur est vérifié sur les 8 jalons**.
- **Ce qui tombe** : la seconde, une **précondition de scénario**. Le jeu de données de ce bloc
  n'engendre plus aucune alerte, précisément parce que les alertes de V2.8.3 étaient fausses.
- **Pourquoi l'échec est attendu** : l'invariant testé survit intact ; seule sa mise en situation
  devait changer.

**Aucun test métier réellement cassé.** Les 40 autres assertions passent, et le
`recette-operations-v2.8.0.mjs` reste à 71/71.

### La recette de référence

`recette-frise-jalons-v2.8.3.1.mjs` reprend la couverture de V2.8.3 en ne remplaçant **que** ces
deux assertions : FRISE-14 recalcule l'attendu avec le nouvel arbre (toujours depuis les seuls
moteurs existants, sans appeler `milestoneStatus()`), et FRISE-17 provoque désormais **deux alertes
légitimes** — un jalon final en dérive et un jalon lié à une tâche en retard. Le reste est repris au
caractère près.

**Résultat : 42 / 42, toute la frise verte, 0 erreur console.** Les cinq statuts y sont observés
simultanément : `Date passée`, `Chantier clôturé`, `Dépassé`, `À venir`, `Menacé`.

---

## 10 bis. Rejeu Opérations

`recette-operations-v2.8.0.mjs` → **71 / 71**, diff de verdicts **vide** contre la baseline V2.8.3.

---

## 11. Non-régression

| Suite | Résultat | Écart vs baseline V2.8.3 |
|---|---|---|
| `recette-operations-v2.8.0.mjs` | **71 / 71** | **aucun** |
| `recette-harmonisation-ux-v2.8.1.mjs` | 48 / 49 | **aucun** |
| `recette-correctifs-v2.7.1.mjs` | 43 / 45 | **aucun** |
| `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 | **aucun** |

**Balayage historique** : 35 suites, chacune exécutée deux fois (V2.8.3 puis V2.8.3.1), copies de
travail isolées hors dépôt — **0 fichier suivi par git modifié**. **33 sur 35 : diff de verdicts
strictement vide.** Les 2 restantes (`recette-accueil-v2.4.4.1`, `recette-accueil-v2.4.5`) ne
diffèrent que par le texte d'un chronomètre (« 23ms » → « 27ms »), verdicts identiques.

**0 régression réelle.**

---

## 12. Byte-identité

```json
FREEZE-2831 : {"gelés":70,"bougés":[]}
FREEZE-2831-périmètre : {"modifiées":["milestoneStatus","operationMilestoneStats","operationMilestonesTab"],
                         "ajoutées":["milestoneLinkedTask"]}
```

**70 moteurs et rendus byte-identiques**, dont `milestoneImpactNote`, `calculateProjectEnd`,
`getProjectTasks`, `milestoneOpenTasks`, `operationMilestones`, `visibleOperationMilestones`,
`operationMilestoneBar`, `isProjectActive`, `isProjectArchived`, toute la frise, tout le Planning,
les Ressources, la Vue d'ensemble, le Mode Chantier, la Qualité, l'import, l'export et la
sauvegarde.

**Trois fonctions modifiées, une ajoutée** — conforme à la cible :

| Fonction | Nature du changement |
|---|---|
| `milestoneStatus()` | refonte de l'arbre de décision |
| `operationMilestoneStats()` | une ligne : prise en charge du statut `past` dans la répartition |
| `operationMilestonesTab()` | une ligne : `past` rejoint `late` et `done` dans les jalons estompés |
| `milestoneLinkedTask()` | **ajoutée** — helper pur, deux lignes, résout `m.taskId` ou rend `null` |

La modification d'`operationMilestonesTab()` relève de la « nécessité stricte de supporter `past` »
explicitement prévue.

---

## 13. Responsive · 14. Thème sombre · 15. Console

- **Responsive** : mesuré ci-dessus à 1440px et 390px — composition strictement identique à V2.8.3,
  aucun débordement horizontal, navigation basse intacte.
- **Thème sombre** : capture `07-frise-dark.png`. Le nouveau statut emprunte `--border` et
  `--text-tertiary`, qui portent déjà leurs variantes sombres — aucune couleur codée en dur.
- **Console** : **0 erreur JavaScript applicative** sur les deux recettes, y compris sur le cas
  STAT-12 du `taskId` qui ne pointe nulle part.

---

## Réponse à la question finale

> *Kanvix distingue-t-il désormais un jalon réellement atteint, un jalon réellement menacé, un jalon
> final en dérive et une simple date intermédiaire passée, sans transformer une estimation en
> certitude métier et sans modifier la frise validée ?*

**OUI**, et les cinq critères sont vérifiés séparément :

1. Un jalon intermédiaire n'est **jamais** déclaré « Menacé » à cause de la fin du chantier —
   STAT-10, STAT-14, et la garantie structurelle du flot de contrôle.
2. Un jalon passé sans preuve d'achèvement n'est **jamais** déclaré « Atteint » — STAT-11,
   « Date passée » neutre.
3. Une tâche associée donne l'interprétation la plus précise — STAT-03 à STAT-06.
4. La règle de fin de chantier reste valable pour les jalons **finaux** — STAT-07 à STAT-09.
5. V2.8.3.1 est visuellement indiscernable de V2.8.3, à l'exception du libellé et de la tonalité du
   statut là où sa signification était fausse — section 9.
