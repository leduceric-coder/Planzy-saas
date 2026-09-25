# RAPPORT — KANVIX CORRECTIVE R5.1 — Rendre le prototype Agenda réellement testable

**Modèle utilisé pour cette mission : Claude Sonnet 5** (`claude-sonnet-5`),
exclusivement. Aucun sous-agent utilisé.

**Statut : prototype expérimental, non intégré au produit.** Aucune décision
produit n'est prise dans ce document. Ce lot corrige le **dispositif de test
utilisateur** du prototype R5 — il ne rouvre aucune décision R5 (Agenda, choix de
vocabulaire) et ne commence ni R6 ni R7.

---

## 1. Les six défauts corrigés

| # | Défaut relevé | Correction apportée |
|---|---|---|
| 1 | Les 9 tâches R5 n'existaient que dans la recette Playwright, invisibles à l'ouverture normale | Nouveau fichier `…-r5.1-user-test.html`, qui les amorce lui-même à l'ouverture |
| 2 | Le protocole demandait de retrouver « R5 — Chape 5 jours », absente d'un fichier ouvrable | Résolu par le point 1 |
| 3 | `?now=2026-08-17T09:00:00` manquant des instructions testeur | L'horloge est désormais **figée par défaut** dans `…-r5.1-user-test.html`, sans dépendre d'un paramètre à ne pas oublier |
| 4 | Le déroulé ne précisait pas quand passer en Agenda avant les scénarios qui en dépendent | `PROTOCOLE-TEST-UTILISATEURS-R5.1.md` ajoute une transition explicite obligatoire après le scénario 1 |
| 5 | La préférence finale incluait Kanban sans garantir son usage réel | Nouveau scénario 5 (« Retrouver une carte dans Kanban ») + contrôle des 3 vues avant la question finale |
| 6 | `agendaWorkingDays()` limitée à une garde de 400 itérations, pouvant masquer une tâche très longue | Fonction réécrite : calcul sur l'intersection tâche∩fenêtre, coût constant, jamais proportionnel à la durée de la tâche |

Un **septième défaut, non listé dans la mission mais découvert pendant la
validation visuelle**, a été corrigé dans le même esprit (voir §6).

---

## 2. Fichiers créés (aucun fichier existant modifié)

Conformément au périmètre strict, **aucun** fichier livré précédemment n'a été
modifié ni écrasé : `kanvix-next-gen-v2.12.2.1.html`,
`kanvix-next-gen-v2.12.2.1-r5-prototype.html`, les recettes et rapports R2-R5 sont
restés intacts (preuve en §7). Six fichiers complets, nouveaux, ont été créés :

1. `public/poc/kanvix-next-gen-v2.12.2.1-r5.1-prototype.html`
2. `public/poc/kanvix-next-gen-v2.12.2.1-r5.1-user-test.html`
3. `public/poc/lanceur-test-utilisateurs-r5.1.html`
4. `PROTOCOLE-TEST-UTILISATEURS-R5.1.md`
5. `recette-corrective-r5.1.mjs`
6. `RAPPORT-CORRECTIF-R5.1.md` (ce document)

---

## 3. Fonctions ajoutées ou modifiées

### 3.1 `kanvix-next-gen-v2.12.2.1-r5.1-prototype.html` (contre `kanvix-next-gen-v2.12.2.1-r5-prototype.html`)

- **3 fonctions ajoutées** : `agendaTaskBounds`, `agendaFirstWorkingDay`,
  `agendaLastWorkingDay` — bornes réelles d'une tâche et recherche de son premier/
  dernier jour ouvré, chacune en **coût constant** (recherche bornée à 7
  itérations, jamais proportionnelle à la durée de la tâche).
- **5 fonctions modifiées** : `agendaWorkingDays` (parcourt désormais
  l'intersection tâche∩fenêtre, plus la tâche entière avec une garde à 400),
  `agendaMarker`, `agendaOccurrenceTime`, `agendaGroups`, `agendaOccurrenceRow`
  (adaptées à la nouvelle signature, comportement observable inchangé pour toute
  tâche « normale »).
- **0 fonction supprimée.**
- `renderPlanning()`, `setPlanningView()`, `renderAgenda()` et tout le reste du
  fichier restent **byte-identiques** à R5.

### 3.2 `kanvix-next-gen-v2.12.2.1-r5.1-user-test.html` (contre le prototype R5.1 ci-dessus)

- **0 fonction modifiée, 0 ajoutée, 0 supprimée** — vérifié par balayage md5
  exhaustif de toutes les fonctions nommées des deux fichiers (§7, FREEZE-C).
- Trois changements **hors fonction**, au niveau du script : la clé `STORE`
  (dédiée, isolée du produit), la valeur par défaut de `NOW_OVERRIDE` (horloge
  figée), et un bloc d'amorçage des 9 fixtures R5 exécuté une fois par
  chargement, idempotent.

### 3.3 `lanceur-test-utilisateurs-r5.1.html`

Fichier HTML/CSS/JS autonome, nouveau, sans dépendance à Kanvix : 8 boutons
générant chacun l'URL de la bonne combinaison vue initiale / vocabulaire, avec
horloge figée systématique.

---

## 4. Résultats chiffrés

```
recette-corrective-r5.1.mjs
RÉSULTAT : 60 / 60
ERREURS CONSOLE APPLICATIVES : 0
```

Décomposition :
- **AGENDA-\*** (13 assertions) — moteur Agenda revérifié sur r5.1-prototype.html
  après le correctif : répétition multi-jours, week-end, bornes de période,
  statuts, filtre, ouverture de fiche, non-duplication. Comportement identique à
  R5 pour toute tâche « normale ».
- **TRESLONGUE-\*** (4 assertions) — preuve du correctif (§5).
- **LABELS-\* / INITIAL-\*** (5 assertions) — vocabulaire et vue initiale,
  inchangés.
- **NONREG-\*** (6 assertions) — tests de fumée (Gantt, Kanban, décalage,
  Structure, Opérations/Pilotage, Undo).
- **USERTEST-\*** (10 assertions) — fixtures visibles sans Playwright, tâche
  demandée présente, horloge figée, stockage isolé, semaine correcte, 3 vues
  fonctionnelles, non-duplication après rechargements, état déterministe,
  isolation prouvée face à la référence certifiée, absence de bannière parasite.
- **LANCEUR-\*** (5 assertions) — 8 boutons, combinaisons et horloge correctes,
  navigation réelle vérifiée par un clic.
- **FREEZE-A/B/C** (10 assertions) — trois contrôles différentiels exhaustifs
  (§7).
- **VISUEL** (3 assertions) — aucun débordement horizontal (desktop clair/sombre,
  mobile clair).
- **PROTECTION** (2 assertions) — empreintes md5 des deux fichiers protégés,
  strictement identiques avant/après l'exécution complète de la recette.
- **ERREURS-CONSOLE** (1 assertion) — 0 erreur applicative sur l'ensemble des
  scénarios (bruit réseau sandbox préexistant filtré, comme dans les recettes
  précédentes de ce lot).

Résultats détaillés (une ligne par assertion) : `recette-r5.1/resultats.json`.

---

## 5. Preuve du correctif « tâche très longue »

Avec une tâche commencée le **2024-01-01** et finissant le **2027-01-01** (donc
active pendant la semaine affichée du 17 août 2026, mais commencée plus de 950
jours avant cette fenêtre) :

| Fichier testé | Occurrences visibles dans l'Agenda (semaine du 17 août 2026) |
|---|---|
| `kanvix-next-gen-v2.12.2.1-r5-prototype.html` (R5 original, **non corrigé**) | **0** — la tâche est invisible (bug confirmé) |
| `kanvix-next-gen-v2.12.2.1-r5.1-prototype.html` (corrigé) | **5** — un jour ouvré par jour de la semaine, marqués « Suite » |

Avec un début encore plus ancien (**2016-01-01**, 10 ans avant la fenêtre), le
résultat reste identique (5 occurrences) : le correctif ne dépend jamais de la
distance entre le début réel de la tâche et la fenêtre affichée — la recherche des
repères Début/Fin est bornée à 7 itérations, la construction des occurrences visibles
est bornée à la largeur de la fenêtre elle-même (jamais à la durée de la tâche).

---

## 6. Défaut supplémentaire trouvé et corrigé (validation visuelle)

En capturant `kanvix-next-gen-v2.12.2.1-r5.1-user-test.html` telle qu'un vrai
testeur la verrait (ouverture directe, aucune assistance Playwright), la bannière
produit existante « Cette copie de Kanvix ne contient pas encore de données
enregistrées » (préexistante, non liée à R5 — `maybeShowKanvixContinuityNotice()`)
s'affichait **devant chaque participant, à chaque séance** : le réinitialisation
systématique du stockage de test (exigée par la mission, §5) laissait
`KANVIX_HAD_PERSISTED_STATE` à `false`, condition d'affichage de cette bannière.

**Correctif** : une ligne (`KANVIX_HAD_PERSISTED_STATE = true;`), ajoutée au tout
début du bloc d'amorçage des fixtures — exacte, car à ce stade l'état de test
contient bel et bien des données déjà enregistrées. La fonction
`maybeShowKanvixContinuityNotice()` elle-même, et sa condition d'affichage, ne sont
**pas modifiées**. Reproduit et vérifié (capture avant/après, assertion
`USERTEST-04b`).

---

## 7. Contrôle différentiel exhaustif — trois comparaisons

### FREEZE-A — Référence certifiée ↔ `r5.1-prototype.html`

Diff brute (`diff -u`) : **7 blocs de changement**, identique au nombre déjà établi
pour R5 (le correctif ne touche que l'intérieur des fonctions Agenda déjà
comptabilisées, sans ajouter de nouveau point de divergence). Balayage md5 par
fonction : **9 fonctions ajoutées** (les 6 de R5 + les 3 nouvelles utilitaires),
**2 fonctions modifiées** (`renderPlanning`, `setPlanningView`, héritées de R5),
**0 supprimée**, **69 moteurs gelés byte-identiques** (décalage, calendrier,
dépendances/ressources, Undo/Redo/communications, Structure, Opérations,
Essentiel/Pilotage, Gantt, Kanban…). `migrateState()`, `INITIAL_STATE` et
`SCHEMA_VERSION` strictement inchangés.

### FREEZE-B — `r5-prototype.html` (original) ↔ `r5.1-prototype.html`

Diff brute : **5 blocs**, tous à l'intérieur du bloc de fonctions Agenda. Balayage
md5 par fonction : **5 fonctions modifiées** (`agendaWorkingDays`, `agendaMarker`,
`agendaOccurrenceTime`, `agendaGroups`, `agendaOccurrenceRow`), **3 ajoutées**
(`agendaTaskBounds`, `agendaFirstWorkingDay`, `agendaLastWorkingDay`), **0
supprimée**, et surtout **aucune autre fonction** — `renderPlanning`,
`setPlanningView`, `renderAgenda` compris — n'a bougé d'un octet entre R5 et R5.1.

### FREEZE-C — `r5.1-prototype.html` ↔ `r5.1-user-test.html`

Diff brute : **3 blocs**. Balayage md5 par fonction : **0 différence** — pas une
seule fonction nommée ne diffère entre les deux fichiers. Le fichier de test
reprend donc EXACTEMENT le même moteur ; seuls trois réglages hors fonction
changent (clé de stockage, horloge par défaut, amorçage des fixtures).

---

## 8. Preuve d'isolation du stockage

Dans un **même contexte navigateur** (même profil de stockage, tel qu'observé
localement sous `file://`) :
1. `r5.1-user-test.html` est ouvert, un statut de tâche y est modifié.
2. La **référence certifiée** (`kanvix-next-gen-v2.12.2.1.html`) est ouverte
   ENSUITE, dans le même contexte.
3. Elle affiche `STORE = "kanvix-product-8-3"` (son propre stockage normal), ses 11
   tâches de démonstration habituelles, et **aucune trace** d'une tâche `r5-*` ou
   du STORE de test.

Cette preuve est programmatique (assertion `USERTEST-09`), pas seulement déclarée.

---

## 9. Preuve que les fixtures sont visibles sans Playwright

La section USERTEST-\* de la recette ouvre `r5.1-user-test.html` avec `page.goto()`
seul — **aucun `page.evaluate()` de préparation d'état** n'est utilisé avant les
assertions (contrairement aux autres sections de cette recette, qui testent le
moteur Agenda en isolation via injection). Les 9 fixtures, dont « R5 — Chape 5
jours », la semaine du 17 au 23 août, et l'horloge figée sont lues telles que le
fichier les produit lui-même — exactement ce qu'un testeur verrait.

---

## 10. Validation visuelle

3 captures desktop/mobile × clair/sombre pour le moteur Agenda R5.1, 1 capture du
lanceur, 2 captures de séances réelles (Gantt/Kanban, puis Chronologie/Avancement)
— toutes sans débordement horizontal, sans bannière parasite (§6).

**Limite connue, préexistante, non corrigée dans ce lot** (comme en R5) : sur
mobile (390 px), le bouton flottant « + » peut recouvrir la dernière ligne visible
d'une liste — comportement identique sur tous les fichiers Kanvix, hors périmètre
explicite de ce lot (bottom-nav mobile, bouton flottant — territoire R6). Documenté,
non corrigé silencieusement.

---

## 11. Ce qui n'a pas été fait — aucun résultat inventé

**Aucun test utilisateur réel n'a été mené** par ce lot. Aucune ligne de ce rapport,
de la recette ou du protocole ne prétend le contraire. Le protocole corrigé
(`PROTOCOLE-TEST-UTILISATEURS-R5.1.md`) est prêt à l'emploi, non exécuté.

**Aucune décision produit n'est prise** : ni sur l'adoption d'Agenda comme vue par
défaut, ni sur le changement de vocabulaire Gantt/Kanban. Les grilles de décision à
seuils (protocole §8) restent à remplir par l'équipe produit après de vraies
séances, jamais par ce lot.

---

## 12. Confirmation — fichiers protégés intacts

Empreintes md5, capturées avant le premier test et revérifiées après le dernier de
cette recette :

| Fichier | Empreinte (avant = après) |
|---|---|
| `kanvix-next-gen-v2.12.2.1.html` | `84a438663acc59703cd31f5bd50ecd81` |
| `kanvix-next-gen-v2.12.2.1-r5-prototype.html` | `dbc1784369661093d13da871f53dcbd8` |

Aucun des deux fichiers protégés, ni les recettes/rapports déjà livrés (R2-R5),
n'a été modifié par ce lot. Aucun lot R6/R7 n'a été commencé.

## 13. Livrables

1. `public/poc/kanvix-next-gen-v2.12.2.1-r5.1-prototype.html`
2. `public/poc/kanvix-next-gen-v2.12.2.1-r5.1-user-test.html`
3. `public/poc/lanceur-test-utilisateurs-r5.1.html`
4. `PROTOCOLE-TEST-UTILISATEURS-R5.1.md`
5. `recette-corrective-r5.1.mjs` (60/60 ; 0 erreur console)
6. `RAPPORT-CORRECTIF-R5.1.md` (ce rapport)
7. `recette-r5.1/resultats.json`
8. `recette-r5.1/` — captures : Agenda R5.1 desktop clair/sombre, Agenda R5.1
   mobile clair, lanceur, séance Gantt/Kanban, séance Chronologie/Avancement.
