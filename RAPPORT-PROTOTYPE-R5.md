# RAPPORT — KANVIX SIMPLIFICATION-R5 — PROTOTYPE EXPÉRIMENTAL « Agenda »

**Modèle utilisé pour cette mission : Claude Sonnet 5** (`claude-sonnet-5`),
exclusivement. Aucun sous-agent utilisé.

**Statut : prototype expérimental, non intégré au produit.** Aucune décision
produit n'est prise dans ce document — ni sur l'adoption d'Agenda comme vue par
défaut, ni sur le changement de vocabulaire Gantt/Kanban. `kanvix-next-gen-v2.12.2.1.html`
(le fichier certifié) n'a été ni modifié, ni écrasé : toutes les modifications de ce
lot vivent exclusivement dans un fichier séparé,
`public/poc/kanvix-next-gen-v2.12.2.1-r5-prototype.html`.

---

## 1. Ce qui a été construit

### 1.1 Troisième représentation du Planning : « Agenda »

Une liste des interventions **groupées par jour ouvré**, en plus du Gantt (frise) et
du Kanban (colonnes par statut) déjà existants. Accessible via un troisième bouton
dans le sélecteur de représentation du Planning, et via `setPlanningView('agenda')`.

**Le point que ce prototype corrige par rapport à une approche naïve (dont le
prototype Astra cité dans la mission)** : une intervention qui dure plusieurs jours
n'apparaît pas qu'à sa date de début. Elle est **répétée sur chacun des jours ouvrés
qu'elle occupe réellement**, avec un repère de position :

- **Début** sur son premier jour ouvré,
- **Suite** sur chaque jour intermédiaire,
- **Fin** sur son dernier jour ouvré.

Une intervention posée un seul jour ne porte aucun repère (rien à distinguer).

Le mot **« Suite »**, et non « En cours », a été choisi délibérément pour le jour
intermédiaire : le statut propre de la tâche peut lui-même valoir « En cours »
(pastille de droite), et les deux textes ne doivent jamais pouvoir se lire comme une
seule et même information redite deux fois sur la même ligne. Ce choix est un parti
pris de prototype, pas une décision définitive — il fait justement partie de ce que
le protocole de test utilisateurs (scénario 4) doit vérifier.

### 1.2 Test A/B de vocabulaire (non persistant)

Les deux premiers boutons de représentation peuvent afficher soit leur libellé
actuel (« Gantt » / « Kanban »), soit une variante « Chronologie » / « Avancement »,
selon le paramètre d'adresse `?r5Labels=plain`. Le libellé **« Agenda » ne varie
jamais** entre les deux variantes — seul son ajout est testé, pas son nom.

Cette bascule est **purement de présentation** : la valeur interne enregistrée
(`app.ui.planningView`) reste toujours `"gantt"` / `"kanban"` / `"agenda"`, jamais
`"chronologie"` ni `"avancement"` (recette LABELS-03). Le paramètre lui-même n'est
écrit nulle part dans `localStorage` (recette LABELS-04) : c'est un réglage d'URL
pur, jamais un champ d'état.

### 1.3 Mode de test « vue Planning initiale »

Le paramètre `?r5Initial=agenda|kanban|gantt` force, **une seule fois**, la vue
Planning affichée au premier chargement — pensé pour contre-balancer l'ordre de
présentation pendant les tests utilisateurs (protocole §7). Il est appliqué par une
simple affectation en mémoire juste après `let app = migrateState(load())`, **sans
toucher à `migrateState()` elle-même**. Conséquence directe, vérifiée
programmatiquement (recette INITIAL-03) : au **prochain** chargement sans le
paramètre, `migrateState()` — inchangée — renormalise `app.ui.planningView` vers
`"gantt"`/`"kanban"` comme elle le fait déjà en V2.12.2.1. La non-persistance de ce
mode de test repose donc sur un comportement **préexistant et non modifié**, pas sur
un mécanisme nouveau à faire confiance en plus.

---

## 2. Ce qui n'a pas changé (et comment c'est prouvé, pas seulement affirmé)

- **`planningTasks()` et `scale()`** — le filtrage (chantier/ressource/lot/structure)
  et la fenêtre de période (Jour/Semaine/Mois/Année) sont **réutilisés tels quels**
  par Agenda. Aucun second moteur de période ou de filtre n'a été créé.
- **`app.tasks` n'est jamais dupliqué** — une occurrence Agenda est une ligne
  d'affichage recalculée à chaque rendu, jamais une donnée stockée. Vérifié
  (recette AGENDA-16) : après de multiples changements de vue et de filtre,
  `app.tasks.length` est strictement identique avant/après.
  - `planningAgenda()` / `.mobile-agenda` — le repli mobile **déjà existant** sous
  le Gantt (qui ne liste, lui, qu'une ligne par tâche à sa date de début) n'a pas été
  touché et n'a pas servi de moteur pour la nouvelle vue Agenda. Les deux mécanismes
  restent strictement distincts (recette AGENDA-01b).
- **`migrateState()`** est **byte-identique** à V2.12.2.1 (recette FREEZE-R5).
- **INITIAL_STATE et SCHEMA_VERSION** sont inchangés — le jeu de données utilisé pour
  tester l'Agenda (§4) n'existe qu'en mémoire, injecté par la recette, jamais dans
  les données de démonstration livrées.

### Contrôle différentiel exhaustif contre V2.12.2.1

Une comparaison ligne à ligne (`diff -u`) entre le fichier certifié et le prototype
ne relève que **7 blocs de changement**, tous documentés ci-dessous — rien d'autre
ne diffère nulle part ailleurs dans les 31 900+ lignes du fichier :

| # | Nature | Contenu |
|---|---|---|
| 1 | Ajout pur | Bloc CSS `.agenda-view` / `.agenda-day` / `.agenda-day-head` / `.agenda-list` |
| 2 | Ajout pur | Lecture des paramètres `?r5Labels` / `?r5Initial` |
| 3 | Ajout pur | Bascule non persistante de la vue initiale (1 ligne, après `migrateState(load())`) |
| 4 | Ajout pur | 6 fonctions : `agendaWorkingDays`, `agendaMarker`, `agendaOccurrenceTime`, `agendaGroups`, `agendaOccurrenceRow`, `renderAgenda` |
| 5 | Modification | `renderPlanning()` — sélecteur à 3 boutons + variante de vocabulaire |
| 6 | Modification | `renderPlanning()` — aiguillage final (`agenda ? renderAgenda() : …`) + indice de défilement |
| 7 | Modification | `setPlanningView()` — accepte `"agenda"` comme 3ᵉ valeur |

Un balayage complémentaire par empreinte md5, fonction par fonction, confirme que
**69 moteurs gelés** — les 14 fonctions transactionnelles de « Préparer un
décalage », le calendrier (jours ouvrés/fériés), les dépendances et conflits de
ressources, Undo/Redo/communications, Structure, Opérations, Essentiel/Pilotage,
Gantt, Kanban, `planningTasks`/`scale`, et l'agenda mobile préexistant — restent
**byte-identiques**, et qu'**aucune fonction existante en dehors de `renderPlanning`
et `setPlanningView` n'a bougé**.

---

## 3. Non-régression

`FREEZE-R5` (§2) prouve que tous les moteurs listés sont byte-identiques à
V2.12.2.1 — leur comportement **ne peut donc pas avoir changé**. Sur cette base, la
recette effectue des **tests de fumée** ciblés (ouverture, un geste clé, une
vérification), et non un rejeu complet de la recette historique à 77 assertions :
c'est une validation proportionnée à un prototype expérimental, pas une nouvelle
certification. Chaque test de fumée est passé :

- Gantt et Kanban continuent de s'afficher normalement (NONREG-01/02).
- Le bouton « Préparer un décalage » reste proposé sur une tâche éligible en
  Pilotage (NONREG-03).
- L'onglet Structure d'un chantier reste proposé aux deux niveaux et s'ouvre
  normalement (NONREG-04).
- Le gating R4 (Opérations réservé au Pilotage) fonctionne à l'identique
  (NONREG-05).
- La bascule Essentiel/Pilotage fonctionne normalement (NONREG-06).
- Undo restaure correctement un changement de statut de tâche (NONREG-07).
- Sans aucun paramètre R5, la vue Planning initiale et le HTML du Gantt rendu par
  défaut sont **strictement identiques**, chargement pour chargement, entre
  V2.12.2.1 et le prototype (INITIAL-04).

---

## 4. Jeu de données de test (recette uniquement, jamais dans les données livrées)

9 tâches temporaires sont injectées par la recette dans `app.tasks`, au runtime,
puis retirées avec le contexte de test — **jamais** dans `INITIAL_STATE` (vérifié,
§2). Elles couvrent chacun des cas exigés :

- une intervention de 5 jours ouvrés consécutifs (Début/Suite×3/Fin),
- une intervention à cheval sur un week-end (sans ligne samedi/dimanche
  artificielle),
- une intervention commencée avant la période affichée,
- une intervention qui se termine pendant la période affichée,
- une intervention qui couvre entièrement la période affichée,
- plusieurs interventions courtes le même jour,
- une tâche portant une dépendance,
- deux tâches sur la même ressource qui se chevauchent (point d'attention visible),
- les cinq statuts (à faire / en cours / terminée / en attente / en retard).

Sur ≥ 2 chantiers, plusieurs ressources, un lot et un nœud de structure réels de la
démonstration existante — aucune clé étrangère inventée.

---

## 5. Résultats chiffrés (automatisés)

```
recette-prototype-r5-v2.12.2.1.mjs
RÉSULTAT : 64 / 64
ERREURS CONSOLE APPLICATIVES : 0
```

Décomposition :
- **AGENDA-\*** (17 assertions) — moteur de la vue Agenda : répétition multi-jours,
  week-end, bornes de période, statuts, filtres (×4), dépendance, conflit visible,
  ouverture de fiche, non-duplication.
- **LABELS-\*** (4 assertions) — vocabulaire par défaut, variante, valeur interne
  invariante, non-persistance.
- **INITIAL-\*** (7 assertions) — chaque valeur de `?r5Initial`, non-persistance,
  comportement par défaut identique à V2.12.2.1.
- **NONREG-\*** (7 assertions) — tests de fumée (§3).
- **FREEZE-R5** (7 assertions) — contrôle différentiel exhaustif (§2).
- **VISUEL-\* / INT-\*** (11 assertions) — 4 combinaisons largeur/thème sans
  débordement horizontal, lisibilité d'une intervention longue, absence de collision
  entre repère et statut, focus clavier, thème sombre + filtre + ouverture de fiche
  sans chevauchement de panneaux.
- **ERREURS-CONSOLE** (1 assertion) — 0 erreur applicative sur l'ensemble des
  scénarios (le bruit réseau `ERR_TUNNEL_CONNECTION_FAILED`, propre à
  l'environnement sandbox sans sortie HTTPS et déjà présent à l'identique sur le
  fichier de référence non modifié, est filtré selon la même convention que les
  recettes précédentes de ce lot).

Résultats détaillés (une ligne par assertion) : `recette-r5/resultats.json`.
Diff brute complète : `recette-r5/diff-v2.12.2.1-vs-prototype-r5.txt`.

---

## 6. Validation visuelle

4 combinaisons largeur/thème capturées (desktop 1440 px / mobile 390 px × clair /
sombre), sans débordement horizontal dans aucune. Plus 5 captures nommées : Agenda
desktop clair avec intervention multi-jours, Agenda desktop sombre, Agenda mobile
clair, variante Gantt/Kanban, variante Chronologie/Avancement.

**Limite connue, préexistante, hors périmètre de ce lot** : sur mobile (390 px), le
bouton flottant « + » peut recouvrir la dernière ligne visible d'une liste (Agenda
comme le repli `.mobile-agenda` déjà existant du Gantt — capture de comparaison
`/tmp/ref-mobile-gantt.png` à l'appui, prise sur le fichier de référence non
modifié). Ce comportement est **identique sur les deux fichiers** et concerne la
barre/bouton flottant mobile, explicitement exclus du périmètre de ce lot (« R6 »
selon la mission) — non corrigé ici, à traiter avec l'ensemble de l'ergonomie
mobile.

---

## 7. Ce qui reste entièrement à faire — aucun résultat inventé

**Aucun test utilisateur n'a été mené.** Ce rapport ne contient et ne prétend
contenir aucun résultat de préférence, de compréhension ou de réussite mesuré
auprès d'une personne réelle. Le protocole (`PROTOCOLE-TEST-UTILISATEURS-R5.md`)
est prêt à être exécuté par un animateur non technique, avec :

- 5 scénarios nommés et leurs consignes exactes,
- une grille de mesure à remplir en séance,
- des règles de contre-balancement de l'ordre de présentation,
- des règles de neutralité du langage envers les personnes testées,
- deux grilles de décision à seuils explicites (Agenda par défaut : ≥ 80 % de
  réussite scénarios 1 et 3, ≥ 75 % scénario 5, ≥ 50 % de préférence globale ;
  vocabulaire : ≥ 75 % de compréhension sans clic de la variante B, ≥ 50 % de
  préférence), à remplir par l'équipe produit **après** les séances, jamais par
  l'animateur pendant.

**Aucune décision n'est prise ici** sur :
- l'adoption d'Agenda comme vue par défaut du Planning,
- le changement de vocabulaire Gantt/Kanban vers Chronologie/Avancement,
- l'option intermédiaire évoquée dans la mission (« Gantt · Chronologie » /
  « Kanban · Avancement ») — mentionnée dans le protocole comme une option à
  tester à son tour, jamais comme un choix déjà fait.

---

## 8. Confirmation — périmètre gelé

- `public/poc/kanvix-next-gen-v2.12.2.1.html` n'a été ni modifié ni écrasé (vérifié
  par comparaison d'empreinte md5 avant/après ce lot).
- Aucun lot R2-R4 ni la certification V2.12.2.1 n'ont été remis en cause.
- Aucune fusion des parcours de décalage, aucune modification de schéma de données.

## 9. Livrables

1. `public/poc/kanvix-next-gen-v2.12.2.1-r5-prototype.html` — le prototype complet.
2. `recette-prototype-r5-v2.12.2.1.mjs` — recette (64/64 ; 0 erreur console).
3. `RAPPORT-PROTOTYPE-R5.md` — ce rapport.
4. `PROTOCOLE-TEST-UTILISATEURS-R5.md` — protocole prêt à l'emploi, non exécuté.
5. `recette-r5/resultats.json` — résultats chiffrés complets, assertion par
   assertion.
6. `recette-r5/diff-v2.12.2.1-vs-prototype-r5.txt` — diff brute complète (référence
   vs prototype).
7. `recette-r5/` — captures : 4 combinaisons largeur/thème + 5 captures nommées +
   1 capture du contrôle d'interaction thème sombre/filtre/fiche.
