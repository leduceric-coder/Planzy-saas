# PROTOCOLE DE TEST UTILISATEURS — R5.1 (Agenda + vocabulaire)

**À destination de l'animateur.** Ce document est autonome : il ne suppose aucune
connaissance technique. Il corrige et remplace `PROTOCOLE-TEST-UTILISATEURS-R5.md`
(version précédente, non exécutable en l'état — voir `RAPPORT-CORRECTIF-R5.1.md`
pour le détail des corrections). Ne rien improviser côté vocabulaire ou
présentation (règles de neutralité, §2).

Aucun résultat utilisateur n'existe encore à la date de rédaction de ce protocole.
Ce document ne contient que la MÉTHODE ; les résultats seront consignés dans la
grille de mesure (§5) au fur et à mesure des passations réelles.

---

## 1. Ce qu'on teste, ce qu'on ne teste pas

On teste deux choses indépendantes, sur un prototype JETABLE (aucune donnée réelle,
aucune conséquence sur un vrai chantier) :

1. **Une troisième façon d'afficher le Planning, « Agenda »** — une liste jour par
   jour, en plus du Gantt (frise) et du Kanban (colonnes par statut) déjà connus.
2. **Deux façons de nommer les boutons Gantt/Kanban** — soit les noms actuels, soit
   « Chronologie / Avancement ». Le nom « Agenda » ne change jamais.

**On ne teste PAS** : la barre du bas sur mobile, les onglets mobiles, le bouton
flottant « + ». Ce sont des sujets d'un prochain lot, pas de celui-ci.

**Aucune décision n'est prise à l'issue de ce test par l'animateur.** Les grilles de
décision (§8) donnent des SEUILS ; c'est l'équipe produit qui décide ensuite, sur la
base des résultats consignés, jamais l'animateur seul et jamais pendant la séance.

---

## 2. Règles de neutralité (à lire avant la première séance)

- Ne jamais dire « la nouvelle version », « la version améliorée », « ce qu'on va
  peut-être garder ». Dire seulement : « une autre façon d'afficher » / « un autre
  nom possible ».
- Ne jamais dire lequel des deux vocabulaires (actuel ou « Chronologie/Avancement »)
  est nouveau. Les présenter comme « la variante A » et « la variante B ».
- Ne jamais interrompre la personne pendant qu'elle cherche — chronométrer en
  silence, laisser 20 secondes de flottement avant de proposer un indice.
- Si la personne demande « c'est laquelle la bonne réponse ? », répondre : « il n'y
  a pas de bonne réponse, on regarde comment ça se passe naturellement ».
- Ne jamais montrer sa propre préférence par le ton de voix ou l'expression.

---

## 3. Matériel nécessaire

- Un ordinateur avec Chrome/Edge/Firefox à jour, ET un téléphone (ou un ordinateur
  avec la fenêtre du navigateur rétrécie à ~390 px de large) pour le scénario 6.
- **Le lanceur de séances**, ouvert localement :
  `public/poc/lanceur-test-utilisateurs-r5.1.html` (double-clic, ou glissé dans un
  onglet de navigateur).
- Ce document imprimé ou ouvert sur un second écran, avec la grille de mesure (§5).
- Un chronomètre (celui du téléphone suffit).

**Aucune connexion internet n'est nécessaire** : l'ensemble fonctionne entièrement
hors-ligne, aucune donnée n'est envoyée nulle part.

**Ne jamais ouvrir directement le fichier de test** (`…-r5.1-user-test.html`) en
tapant son adresse ou en le retrouvant dans un dossier. **Toujours passer par le
lanceur** (`lanceur-test-utilisateurs-r5.1.html`) : c'est lui qui applique la bonne
combinaison vue initiale / vocabulaire pour la personne testée (§7 du protocole
précédent, désormais automatisé — voir §6 ci-dessous).

---

## 4. Recrutement et échantillon

- **Minimum : 5 personnes. Idéal : 8.** Le lanceur prévoit exactement 8 combinaisons
  (« Personne 1 » à « Personne 8 ») ; au-delà de 8, reprendre la combinaison de la
  Personne 1, et ainsi de suite.
- Mélanger les profils si possible : au moins une personne qui utilise Kanvix
  régulièrement, et au moins une personne qui le découvre. Si un mélange de métiers
  (conducteur de travaux, artisan, gestion) est possible, le rechercher.
- Ne jamais tester avec quelqu'un qui a participé à la conception de l'Agenda ou du
  choix des mots — il ne pourrait plus être neutre sans le vouloir.

---

## 5. Grille de mesure (une par personne testée)

Dupliquer ce tableau pour chaque personne. Remplir en séance, pas de mémoire après.

```
Personne n° _____ (bouton du lanceur)      Date : _____      Profil : _____
Vue initiale attribuée : Gantt ☐ / Agenda ☐
Vocabulaire présenté en premier : Gantt/Kanban (A) ☐ / Chronologie/Avancement (B) ☐
```

**Vérifications AVANT de commencer (§6, étape 0) :**

| Vérification | OK |
|---|---|
| La séance a été ouverte via le bon bouton du lanceur (pas en ouvrant le fichier à la main) | ☐ |
| Le bandeau de période affiche bien « Semaine du 17 au 23 août » | ☐ |
| L'intervention « R5 — Chape 5 jours » est bien visible (Gantt, Kanban ou Agenda selon la vue initiale) | ☐ |

| Scénario | Réussi seul (sans indice) | Réussi avec indice | Échec | Temps (sec.) | Erreurs / hésitations observées |
|---|---|---|---|---|---|
| 1 — Retrouver une intervention un jour donné (vue initiale attribuée) | ☐ | ☐ | ☐ | ____ | |
| 2 — Repérer une intervention de plusieurs jours (en Agenda) | ☐ | ☐ | ☐ | ____ | |
| 3 — Ne pas oublier un jour d'une longue intervention (en Agenda) | ☐ | ☐ | ☐ | ____ | |
| 4 — Comprendre un repère « Début / Suite / Fin » (en Agenda) | ☐ | ☐ | ☐ | ____ | |
| 5 — Retrouver une carte dans Kanban (garantit l'usage réel de Kanban) | ☐ | ☐ | ☐ | ____ | |
| 6 — Retrouver une intervention Agenda sur téléphone | ☐ | ☐ | ☐ | ____ | |

**Compréhension du vocabulaire (scénario 7, voir §6) :**

| | Variante A (telle que présentée, sans dire laquelle) | Variante B |
|---|---|---|
| A su dire ce que fait le bouton, sans cliquer | ☐ oui / ☐ non | ☐ oui / ☐ non |
| Préférence spontanée exprimée (si une personne en exprime une sans qu'on lui demande, la noter ici) | | |

**Avant la question de préférence finale, confirmer que les TROIS vues ont
effectivement été manipulées pendant la séance :**

| Vue | Manipulée pendant la séance | 
|---|---|
| Gantt | ☐ |
| Kanban | ☐ (scénario 5) |
| Agenda | ☐ (scénarios 2 à 4 et 6) |

Si l'une des trois cases n'est pas cochée, **ne pas poser la question de préférence
globale incluant cette vue** — revenir dessus brièvement avant de la poser.

**Question de préférence globale posée en fin de séance (voir §6, question finale) :**

- Vue préférée pour retrouver « qui fait quoi aujourd'hui » : ☐ Gantt ☐ Kanban ☐ Agenda ☐ Pas de préférence
- Vocabulaire préféré : ☐ A ☐ B ☐ Pas de préférence
- Commentaire libre : _______________________________________________

**Confiance ressentie** (demander : *« Sur 5, à quel point vous êtes-vous senti(e)
à l'aise pour trouver l'information ? 1 = pas du tout, 5 = complètement »*) : ___ / 5

---

## 6. Déroulé de séance (scénarios exacts, à lire tels quels)

Durée totale estimée : 25 à 30 minutes par personne.

**Introduction (à dire telle quelle) :**
> « Je vais vous montrer un prototype d'essai de Kanvix. Ce n'est pas la version
> définitive, et vous ne pouvez rien casser — c'est un jeu de données de démonstration,
> complètement isolé du vrai produit. Je vais vous demander de faire quelques
> recherches à voix haute, en me disant ce que vous voyez et ce que vous cherchez.
> Il n'y a pas de bonne ou de mauvaise réponse, c'est le prototype qu'on évalue, pas
> vous. »

### Étape 0 — Démarrage (avant tout scénario)
1. Ouvrir `lanceur-test-utilisateurs-r5.1.html`.
2. Cliquer sur le bouton correspondant à la personne testée (« Personne 1 » pour la
   première personne, etc. — voir la répartition figée au §7).
3. **Vérifier** (grille §5) : le bandeau de période affiche « Semaine du 17 au 23
   août », et l'intervention « R5 — Chape 5 jours » est visible.
4. Si l'une de ces deux vérifications échoue, **ne pas commencer la séance** : fermer
   l'onglet, relancer depuis le lanceur, et signaler l'anomalie plutôt que de
   continuer avec un état incorrect.

### Scénario 1 — Retrouver une intervention un jour donné
**Vue** : celle attribuée par le lanceur (Gantt ou Agenda selon la personne — ne pas
changer de vue avant ce scénario).
**Consigne à dire** : *« Vous êtes conducteur de travaux. Dites-moi ce qui est prévu
le lundi 17 août sur le chantier Résidence Keravel. »*
**Réussite** = la personne identifie correctement au moins 2 interventions de ce jour
sur ce chantier, en moins de 60 secondes.

**Transition obligatoire vers l'Agenda (à dire, uniquement si la vue initiale de
cette personne était Gantt) :**
> « Je vais maintenant vous montrer une autre façon d'afficher le Planning. Pouvez-
> vous cliquer sur le bouton "Agenda", en haut ? »
Attendre que la vue Agenda soit bien affichée avant de poursuivre. Si la vue
initiale était déjà Agenda, passer directement au scénario 2.

### Scénario 2 — Repérer une intervention de plusieurs jours (vue Agenda)
**Consigne à dire** : *« Il y a une intervention qui dure plusieurs jours. Laquelle,
et sur quels jours exactement ? »*
(Utiliser la tâche test « R5 — Chape 5 jours », visible du lundi 17 au vendredi 21.)
**Réussite** = la personne cite correctement le nom de la tâche ET les 5 jours
qu'elle occupe (pas seulement le premier jour).

### Scénario 3 — Ne pas oublier un jour d'une longue intervention (le test clé, vue Agenda)
**Consigne à dire** : *« Sans regarder le jour de début, dites-moi si cette même
intervention a lieu le mercredi 19 août. »*
**Réussite** = la personne répond correctement « oui » en la retrouvant dans le
groupe du mercredi (preuve que la répétition jour par jour est effectivement
utilisée et comprise — c'est le point que le prototype Astra ratait).

### Scénario 4 — Comprendre un repère « Début / Suite / Fin » (vue Agenda)
**Consigne à dire** : *« Sur cette ligne du mercredi, il y a une petite étiquette à
côté du nom. Que pensez-vous qu'elle veuille dire ? »*
**Réussite** = la personne comprend sans aide que l'étiquette indique la position de
ce jour dans l'intervention (ni son premier ni son dernier jour), sans la confondre
avec le statut de la tâche (pastille « En cours », « À faire », etc. — cette
confusion possible est justement ce qu'on cherche à détecter).

### Scénario 5 — Retrouver une carte dans Kanban
**Pourquoi ce scénario** : la question de préférence finale (étape suivante) compare
Gantt, Kanban ET Agenda — une personne qui n'aurait jamais cliqué sur Kanban ne
pourrait pas donner un avis réel dessus. Ce scénario garantit un usage effectif.
**Consigne à dire** : *« Cliquez maintenant sur le bouton "Kanban". Retrouvez la
carte de l'intervention "R5 — Chape 5 jours", et dites-moi dans quelle colonne elle
se trouve. »*
**Réussite** = la personne clique effectivement sur Kanban, trouve la carte, et
nomme correctement sa colonne de statut.

### Scénario 6 — Retrouver une intervention Agenda sur téléphone
**Configuration** : rétrécir la fenêtre à ~390 px de large (ou utiliser un vrai
téléphone — recharger la même adresse générée par le lanceur).
**Consigne à dire** : *« Vous êtes sur le chantier, sur votre téléphone. Repassez en
vue Agenda, et retrouvez ce qui est prévu demain. »*
**Réussite** = la personne retourne en Agenda et trouve l'information en moins de 45
secondes, sans avoir besoin de faire défiler horizontalement l'écran.

### Scénario 7 — Vocabulaire (comparaison A/B, sans dire lequel est lequel)
**Consigne à dire** : *« Regardez ces trois boutons en haut du Planning. Sans
cliquer, dites-moi ce que vous pensez que chacun affiche. »*
La variante déjà affichée (assignée par le lanceur, voir §7) est la première
montrée. Noter dans la grille si la personne devine juste SANS cliquer.

**Pour montrer la seconde variante**, recharger la même adresse en changeant
uniquement `r5Labels` dans la barre d'adresse (`current` ↔ `plain`) — ou revenir au
lanceur et cliquer sur le bouton d'une personne dont le vocabulaire de départ est
l'autre variante, en réappliquant `r5Initial` si besoin pour rester sur la même vue.
Poser la même question sur cette seconde variante.

**Question finale (à poser à voix haute, une fois les 7 scénarios terminés) :**
> « Pour retrouver "qui fait quoi et quand", quelle présentation avez-vous préférée :
> Gantt (la frise), Kanban (les colonnes) ou Agenda (la liste par jour) ? Et parmi
> les deux façons de nommer les boutons qu'on vient de voir, laquelle vous a semblé
> la plus claire ? »
Noter la réponse SANS relancer, même si la personne hésite. **Vérifier d'abord**
(grille §5) que Gantt, Kanban et Agenda ont bien tous les trois été manipulés
pendant la séance.

---

## 7. Répartition et lanceur (contre-balancement)

La répartition n'est plus choisie manuellement par l'animateur : elle est **fixée
dans le lanceur** (`lanceur-test-utilisateurs-r5.1.html`), un bouton par personne,
dans cet ordre :

| Bouton du lanceur | Vue initiale (Scénario 1) | Vocabulaire montré en premier (Scénario 7) |
|---|---|---|
| Personne 1 | Gantt | Gantt/Kanban (actuel) |
| Personne 2 | Agenda | Chronologie/Avancement |
| Personne 3 | Gantt | Chronologie/Avancement |
| Personne 4 | Agenda | Gantt/Kanban (actuel) |
| Personne 5 | Gantt | Gantt/Kanban (actuel) |
| Personne 6 | Agenda | Chronologie/Avancement |
| Personne 7 | Gantt | Chronologie/Avancement |
| Personne 8 | Agenda | Gantt/Kanban (actuel) |

**L'animateur n'a rien à régler manuellement** : cliquer sur le bon bouton suffit.
L'horloge de démonstration est également figée automatiquement par le lanceur
(lundi 17 août 2026, 09:00) — inutile de la vérifier au-delà de l'étape 0.

Ces réglages ne modifient rien de façon durable : fermer l'onglet suffit à revenir à
un état neutre pour la séance suivante (le fichier de test repart de lui-même d'un
état propre à chaque ouverture, y compris en cas de rechargement accidentel).

---

## 8. Grilles de décision (à remplir par l'équipe produit, APRÈS toutes les séances)

Ces grilles ne sont JAMAIS remplies par l'animateur pendant les séances. Elles sont
complétées une fois toutes les grilles de mesure (§5) rassemblées.

### Grille A — Agenda comme vue par défaut du Planning ?

| Critère | Seuil | Résultat observé | Atteint ? |
|---|---|---|---|
| Réussite scénario 1 (retrouver un jour donné) | ≥ 80 % des personnes, sans indice | ___ / ___ | ☐ |
| Réussite scénario 3 (jour intermédiaire d'une longue intervention) | ≥ 80 % des personnes | ___ / ___ | ☐ |
| Réussite scénario 6 (mobile) | ≥ 75 % des personnes, sans défilement horizontal | ___ / ___ | ☐ |
| Préférence globale (question finale) pour Agenda | ≥ 50 % des personnes | ___ / ___ | ☐ |

**Décision** : Agenda ne devient une proposition de vue par défaut que si **tous**
les seuils ci-dessus sont atteints. Si un seul seuil manque, l'option reste « vue
optionnelle, non par défaut » et le sujet est rouvert après correctifs.

### Grille B — Adoption du vocabulaire « Chronologie / Avancement » ?

| Critère | Seuil | Résultat observé | Atteint ? |
|---|---|---|---|
| Compréhension sans clic de la variante B (scénario 7) | ≥ 75 % des personnes | ___ / ___ | ☐ |
| Compréhension sans clic de la variante A (scénario 7, pour comparaison) | (informatif, pas de seuil) | ___ / ___ | — |
| Préférence exprimée pour B (question finale) | ≥ 50 % des personnes | ___ / ___ | ☐ |

**Décision** : le nouveau vocabulaire n'est adopté que si la variante B atteint son
seuil de compréhension ET est préférée par au moins la moitié des personnes. Si la
compréhension de B est correcte mais sans préférence marquée, ou l'inverse,
l'équipe produit peut envisager l'**option intermédiaire proposée dans la mission**
— nommer les boutons « Gantt · Chronologie » et « Kanban · Avancement » (les deux
mots côte à côte) — comme UNE option à tester à son tour, jamais comme un choix déjà
fait.

**Dans tous les cas** : ces grilles produisent une recommandation à discuter en
équipe, jamais une décision automatique. Le nom « Agenda » lui-même n'est, à aucun
moment de ce protocole, remis en question — seul son AJOUT en tant que troisième vue
est testé.

---

## 9. Après les séances

1. Rassembler toutes les grilles de mesure (§5) remplies.
2. Calculer les taux de réussite/préférence des grilles A et B (§8).
3. Consigner mot pour mot les commentaires libres marquants (verbatims), sans les
   reformuler.
4. Transmettre l'ensemble (grilles + verbatims) à l'équipe produit — jamais une
   synthèse orale seule, pour que rien ne soit perdu ou interprété deux fois.

---

## 10. Ce que ce protocole corrige par rapport à la version R5 initiale

Pour mémoire (détail complet dans `RAPPORT-CORRECTIF-R5.1.md`) : la version R5 du
protocole demandait de retrouver une tâche (« R5 — Chape 5 jours ») qui n'existait
que dans la recette automatisée, pas dans un fichier ouvrable normalement ; ne
précisait pas la date de démonstration à utiliser ; ne prévoyait pas explicitement
le passage en Agenda avant les scénarios qui en dépendaient ; et pouvait aboutir à
une question de préférence sur Kanban sans que la personne l'ait jamais utilisé. Les
étapes 0, la transition obligatoire après le scénario 1, le scénario 5 (Kanban), et
le contrôle des trois vues avant la question finale (§5) corrigent ces quatre
points.
