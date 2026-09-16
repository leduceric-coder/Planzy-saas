# Rapport — Kanvix V2.8.3.2 · Cohérence du bandeau « Prochain jalon »

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.3.2.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.3.1.html`
**Recette dédiée** : `recette-prochain-jalon-v2.8.3.2.mjs` — **27 / 27 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.3.2/` (7 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## 1. L'incohérence identifiée

V2.8.3.1 avait aligné la **frise** sur `milestoneStatus()`. Le **bandeau de synthèse**, lui, était
resté sur la date :

```js
next = list.find((m) => !m.date || date(m.date) >= now)
nextSiteCount = list.filter((m) => m.projectId === next.projectId && date(m.date) >= now).length
```

Conséquence : un jalon daté au 27 août dont la tâche associée était **terminée** affichait
« Atteint » sur sa carte, et restait annoncé « **Prochain jalon — 27 août** · 1 jalon à venir ».

**Deux définitions contradictoires de « à venir » cohabitaient dans la même page.**

---

## 2. La distinction : date future ≠ reste à traiter

Ce sont deux questions différentes, et V2.8.3.2 les sépare explicitement :

| Question | Qui y répond | Sur quoi |
|---|---|---|
| « Où sommes-nous dans le temps ? » | le **rail** de la frise | la **date** |
| « Que reste-t-il réellement à traiter ? » | le **bandeau de synthèse** | `milestoneStatus()` |

Un jalon futur déjà atteint **reste situé dans le futur** sur la chronologie — sa bulle est devant
nous, le trait qui y mène reste pointillé — mais il **cesse d'être une action à venir**.

---

## 3. Définition de « upcoming »

```js
function isUpcomingMilestone(m) {
  if (!m || !m.date) return false;
  let key = milestoneStatus(m).key;
  return key === "soon" || key === "risk";
}
```

Helper **pur** : il ne lit rien d'autre que le jalon, n'écrit nulle part, et délègue toute la vérité
métier à `milestoneStatus()`, qui reste **byte-identique**.

## 4. Statuts inclus

| `key` | Libellé | Pourquoi |
|---|---|---|
| `soon` | **À venir** | échéance devant nous, rien ne la menace |
| `risk` | **Menacé** | devant nous aussi — un jalon menacé reste à traiter, et plus encore que les autres |

## 5. Statuts exclus

| `key` | Libellé | Pourquoi |
|---|---|---|
| `done` | **Atteint** | déjà franchi : ce n'est plus une action |
| `past` | **Date passée** | la date est derrière nous |
| `late` | **Dépassé** | c'est un retard, pas une échéance à venir |
| `closed` | **Chantier clôturé / archivé** | le chantier ne tourne plus |

## 6. Jalons sans date

Un jalon sans date **ne peut pas être situé** dans la chronologie. Il n'est donc jamais retenu
comme prochain jalon — `m.date` est une condition nécessaire. Vérifié par **NEXT-11**, sans aucune
erreur JavaScript.

---

## 7. Sélection du prochain jalon

```js
next = list.find(isUpcomingMilestone)
```

`list` est **déjà triée** par `operationMilestones()` : le premier jalon restant à traiter est donc
le premier que `find` rencontre. **Aucun tri parallèle n'est recréé** — NEXT-13 le vérifie en
lisant le corps de la fonction (`.sort(` absent) autant qu'en observant le résultat.

## 8. Compteur par chantier

```js
nextSiteCount = list.filter((m) => m.projectId === next.projectId && isUpcomingMilestone(m)).length
```

Sur un chantier portant **1 atteint futur + 2 à venir + 1 date passée**, le compteur annonce
**« 2 jalons à venir »** — ni 3, ni 4 (NEXT-08).

## 9. Cas « aucun jalon restant »

Le sous-texte de repli devenait **faux**. « Tous les jalons affichés sont passés » ne tient plus
dès qu'un jalon **futur** est déjà atteint : il n'est pas passé, il est simplement fait.

Il devient : **« Aucun à venir · Aucun jalon restant à traiter »**, formulation vraie dans les deux
situations. La capture `04-aucun-jalon-restant.png` montre le cas exact : le jalon « Atteint futur »
du 23 août est bien **devant** sur la frise, et le bandeau dit pourtant, à juste titre, qu'il ne
reste rien à traiter.

> Note de rédaction : la tuile enchaîne « Aucun à venir » puis « Aucun jalon restant à traiter ».
> C'est un peu répétitif ; j'ai gardé les deux formulations telles que tu les as spécifiées plutôt
> que de trancher à ta place. Un mot et c'est ajusté.

## 10. Le rail temporel est volontairement inchangé

`operationMilestonesTab()` est **byte-identique**. Son calcul de `nextIdx`, des classes `seg-done` /
`seg-todo` et du repère `is-next` reste piloté **par la date**, comme le bandeau d'aide l'annonce à
l'utilisateur (« trait plein = derrière vous, pointillé = ce qui reste »).

La garantie est structurelle, pas seulement comportementale :

```json
{"railParDate":true,"railSansUpcoming":true}
```

`operationMilestonesTab()` contient toujours `date(m.date) >= now` et **n'appelle jamais**
`isUpcomingMilestone()`. Et **NEXT-14** compare, sur un scénario comportant un jalon futur déjà
atteint, les classes `seg-*` et `is-next` entre V2.8.3.1 et V2.8.3.2 : **strictement identiques**.

---

## 11. Tests NEXT-01 → NEXT-17

**27 / 27 PASS, 0 erreur console.** Chaque cas lit le bandeau **tel qu'affiché**, pas seulement la
valeur d'une fonction.

| # | Cas | Attendu | Obtenu |
|---|---|---|---|
| NEXT-01 | jalon futur, tâche liée terminée | « Aucun à venir » — pas prochain | ✓ |
| NEXT-02 | atteint (+5) puis à venir (+8) | prochain = **Étape B** | ✓ |
| NEXT-03 | menacé (+5) puis à venir (+8) | prochain = **Livraison** (menacé) | ✓ |
| NEXT-04 | dépassé | jamais prochain | ✓ |
| NEXT-05 | date passée | jamais prochain | ✓ |
| NEXT-06 | jalon futur sur chantier clôturé | jamais prochain | ✓ |
| NEXT-07 | mix passée / atteint / à venir / menacé | prochain = **C**, le premier restant | ✓ |
| NEXT-08 | 1 atteint futur + 2 à venir + 1 passée | **2 jalons à venir** | ✓ |
| NEXT-09 | Keravel atteint (+4), Terrasses à venir (+9) | chantier concerné = **Les Terrasses** | ✓ |
| NEXT-10 | aucun restant, dont 1 atteint **futur** | « Aucun jalon restant à traiter » | ✓ |
| NEXT-11 | jalon sans date | jamais prochain, **0 erreur JS** | ✓ |
| NEXT-12 | filtre chantier masquant A | prochain bascule sur **B** | ✓ |
| NEXT-13 | jalons +10, +3, +7 | prochain = **+3**, aucun tri recréé | ✓ |
| NEXT-14 | jalon futur atteint | rail **strictement identique** à V2.8.3.1 | ✓ |
| NEXT-15 | appels répétés | `app.milestones`, `app.projects`, `app.tasks` inchangés | ✓ |
| NEXT-16 | schéma | 12 | ✓ |
| NEXT-17 | magasin | `kanvix-product-8-3` | ✓ |

**NEXT-09 et NEXT-14 sont les deux cas décisifs.** NEXT-09 vérifie que la carte « Chantier
concerné » suit le prochain jalon **réel** et non le premier daté. NEXT-14 vérifie que la
correction sémantique **n'a pas fui** dans la chronologie.

---

## 12 → 14. Rejeux

| Suite | Résultat | Diff de verdicts vs V2.8.3.1 |
|---|---|---|
| `recette-jalons-statuts-v2.8.3.1.mjs` | **29 / 29** | **identique** |
| `recette-frise-jalons-v2.8.3.1.mjs` | **42 / 42** | **identique** |
| `recette-operations-v2.8.0.mjs` | **71 / 71** | **identique** |

**Aucune assertion n'est devenue obsolète**, comme attendu : ce lot ne change aucun statut de jalon,
seulement l'usage qu'en fait le bandeau. Les deux recettes de jalons ont été rejouées **sans la
moindre modification**.

## 15. Non-régression

| Suite | Résultat | Écart |
|---|---|---|
| `recette-harmonisation-ux-v2.8.1.mjs` | 48 / 49 | **aucun** |
| `recette-correctifs-v2.7.1.mjs` | 43 / 45 | **aucun** |
| `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 | **aucun** |

**Balayage historique** : 35 suites, chacune exécutée deux fois (V2.8.3.1 puis V2.8.3.2), copies de
travail isolées hors dépôt — **0 fichier suivi par git modifié**. **34 sur 35 : diff de verdicts
strictement vide.** La suite restante (`recette-accueil-v2.4.4.1`) ne diffère que par le texte d'un
chronomètre (« 37ms » → « 27ms »), verdicts identiques.

**0 régression réelle.**

## 16. Byte-identité

```json
FREEZE-2832 : {"gelés":73,"bougés":[]}
FREEZE-2832-périmètre : {"modifiées":["operationMilestoneStats"],"ajoutées":["isUpcomingMilestone"]}
FREEZE-2832-css : {"identique":true}
```

**73 moteurs et rendus byte-identiques**, dont `milestoneStatus`, `milestoneLinkedTask`,
`milestoneOpenTasks`, `milestoneRelativeLabel`, `operationMilestoneBar`, `operationMilestonesTab`,
`operationMilestones`, `visibleOperationMilestones`, `milestoneImpactNote`, `calculateProjectEnd`,
`getProjectTasks`, le Planning, les Ressources, la Vue d'ensemble, le Mode Chantier, la Qualité,
l'import, l'export, la sauvegarde et l'historique.

**Une seule fonction modifiée, un seul helper ajouté** — conforme à la cible.

**La feuille de style entière est byte-identique** : aucune règle CSS n'a été touchée.

### Vérification visuelle

À **1440px** et **390px**, comparaison V2.8.3.1 → V2.8.3.2 : colonnes, largeurs et bords hauts des
cartes, rail, bulles, **squelette DOM complet — classes comprises** — et débordement horizontal sont
**strictement identiques**. Contrairement à V2.8.3.1, aucune neutralisation n'a été nécessaire : ce
lot ne change aucune classe.

Sur les **données de démonstration**, le bandeau lui-même est inchangé au caractère près — aucun
jalon de démonstration n'était concerné par l'incohérence, qui n'apparaît qu'avec un jalon lié à une
tâche terminée. C'est précisément pourquoi elle avait échappé aux recettes précédentes.

## 17. Console

**0 erreur JavaScript applicative**, y compris sur NEXT-11 (jalon sans date) et sur les appels
directs `isUpcomingMilestone(null)` et `isUpcomingMilestone({ date: null })`.

---

## Réponse à la question finale

> *Le bandeau de synthèse utilise-t-il désormais la même vérité métier que les statuts des jalons,
> sans modifier la chronologie, la frise ni aucun autre moteur ?*

**OUI**, et les cinq critères sont vérifiés séparément :

1. Un jalon « Atteint » ne peut plus être présenté comme prochain jalon — NEXT-01, NEXT-02.
2. « N jalons à venir » ne compte que `soon` + `risk` — NEXT-08.
3. Un jalon futur déjà atteint reste dans le futur sur la chronologie mais cesse d'être une action
   à venir — NEXT-14 et la capture `04-aucun-jalon-restant.png`.
4. La frise temporelle est strictement inchangée — `operationMilestonesTab()` byte-identique, CSS
   byte-identique, squelette DOM identique.
5. Kanvix n'utilise plus deux définitions contradictoires de « à venir » — le bandeau et la frise
   passent tous deux par `milestoneStatus()`, chacun pour la question qui est la sienne.
