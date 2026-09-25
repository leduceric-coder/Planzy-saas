# PROTOCOLE DE TEST UTILISATEURS — PROTOTYPE R5 (Agenda + vocabulaire)

**À destination de l'animateur.** Ce document est autonome : il ne suppose aucune
connaissance technique. Il sert à faire passer le test, pas à le concevoir — ne
rien y improviser côté vocabulaire ou présentation (voir §2, règles de neutralité).

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
décision (§7) donnent des SEUILS ; c'est l'équipe produit qui décide ensuite, sur la
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
  avec la fenêtre du navigateur rétrécie à ~390 px de large) pour le scénario 5.
- Le fichier `public/poc/kanvix-next-gen-v2.12.2.1-r5-prototype.html` ouvert
  localement (double-clic, ou glissé dans un onglet de navigateur).
- Ce document imprimé ou ouvert sur un second écran, avec la grille de mesure (§5).
- Un chronomètre (celui du téléphone suffit).

**Aucune connexion internet n'est nécessaire** : le prototype fonctionne entièrement
hors-ligne, aucune donnée n'est envoyée nulle part.

---

## 4. Recrutement et échantillon

- **Minimum : 5 personnes. Idéal : 8.** Au-delà de 8, les nouveaux passages
  n'apportent en général plus d'observations inédites.
- Mélanger les profils si possible : au moins une personne qui utilise Kanvix
  régulièrement, et au moins une personne qui le découvre. Si un mélange de métiers
  (conducteur de travaux, artisan, gestion) est possible, le rechercher.
- Ne jamais tester avec quelqu'un qui a participé à la conception de l'Agenda ou du
  choix des mots — il ne pourrait plus être neutre sans le vouloir.

---

## 5. Grille de mesure (une par personne testée)

Dupliquer ce tableau pour chaque personne. Remplir en séance, pas de mémoire après.

```
Personne n° _____        Date : _____        Profil : _____
Ordre passé (voir §6) — Vocabulaire : A d'abord ☐ / B d'abord ☐
                         Vue initiale : Gantt d'abord ☐ / Agenda d'abord ☐
```

| Scénario | Réussi seul (sans indice) | Réussi avec indice | Échec | Temps (sec.) | Erreurs / hésitations observées |
|---|---|---|---|---|---|
| 1 — Retrouver une intervention un jour donné | ☐ | ☐ | ☐ | ____ | |
| 2 — Repérer une intervention de plusieurs jours | ☐ | ☐ | ☐ | ____ | |
| 3 — Ne pas oublier un jour d'une longue intervention | ☐ | ☐ | ☐ | ____ | |
| 4 — Comprendre un repère « Début / Suite / Fin » | ☐ | ☐ | ☐ | ____ | |
| 5 — Retrouver une intervention sur téléphone | ☐ | ☐ | ☐ | ____ | |

**Compréhension du vocabulaire (scénario 6, voir §6) :**

| | Variante A (telle que présentée, sans dire laquelle) | Variante B |
|---|---|---|
| A su dire ce que fait le bouton, sans cliquer | ☐ oui / ☐ non | ☐ oui / ☐ non |
| Préférence spontanée exprimée (si une personne en exprime une sans qu'on lui demande, la noter ici) | | |

**Question de préférence globale posée en fin de séance (voir §6, question finale) :**

- Vue préférée pour retrouver « qui fait quoi aujourd'hui » : ☐ Gantt ☐ Kanban ☐ Agenda ☐ Pas de préférence
- Vocabulaire préféré : ☐ A ☐ B ☐ Pas de préférence
- Commentaire libre : _______________________________________________

**Confiance ressentie** (demander : *« Sur 5, à quel point vous êtes-vous senti(e)
à l'aise pour trouver l'information ? 1 = pas du tout, 5 = complètement »*) : ___ / 5

---

## 6. Déroulé de séance (scénarios exacts, à lire tels quels)

Durée totale estimée : 20 à 25 minutes par personne.

**Introduction (à dire telle quelle) :**
> « Je vais vous montrer un prototype d'essai de Kanvix. Ce n'est pas la version
> définitive, et vous ne pouvez rien casser — c'est un jeu de données de démonstration.
> Je vais vous demander de faire quelques recherches à voix haute, en me disant ce
> que vous voyez et ce que vous cherchez. Il n'y a pas de bonne ou de mauvaise
> réponse, c'est le prototype qu'on évalue, pas vous. »

### Scénario 1 — Retrouver une intervention un jour donné
**Configuration** : ouvrir le prototype avec la vue initiale tirée au sort (§7 — Gantt
ou Agenda selon la personne), période Semaine, semaine du 17 août.
**Consigne à dire** : *« Vous êtes conducteur de travaux. Dites-moi ce qui est prévu
le lundi 17 août sur le chantier Résidence Keravel. »*
**Réussite** = la personne identifie correctement au moins 2 interventions de ce jour
sur ce chantier, en moins de 60 secondes.

### Scénario 2 — Repérer une intervention de plusieurs jours
**Consigne à dire** : *« Il y a une intervention qui dure plusieurs jours. Laquelle,
et sur quels jours exactement ? »*
(Utiliser la tâche test « R5 — Chape 5 jours », visible du lundi 17 au vendredi 21.)
**Réussite** = la personne cite correctement le nom de la tâche ET les 5 jours
qu'elle occupe (pas seulement le premier jour).

### Scénario 3 — Ne pas oublier un jour d'une longue intervention (le test clé)
**Consigne à dire** : *« Sans regarder le jour de début, dites-moi si cette même
intervention a lieu le mercredi 19 août. »*
**Réussite** = la personne répond correctement « oui » en la retrouvant dans le
groupe du mercredi (preuve que la répétition jour par jour est effectivement
utilisée et comprise — c'est le point que le prototype Astra ratait).

### Scénario 4 — Comprendre un repère « Début / Suite / Fin »
**Consigne à dire** : *« Sur cette ligne du mercredi, il y a une petite étiquette à
côté du nom. Que pensez-vous qu'elle veuille dire ? »*
**Réussite** = la personne comprend sans aide que l'étiquette indique la position de
ce jour dans l'intervention (ni son premier ni son dernier jour), sans la confondre
avec le statut de la tâche (pastille « En cours », « À faire », etc. — cette
confusion possible est justement ce qu'on cherche à détecter).

### Scénario 5 — Retrouver une intervention sur téléphone
**Configuration** : rétrécir la fenêtre à ~390 px de large (ou utiliser un vrai
téléphone).
**Consigne à dire** : *« Vous êtes sur le chantier, sur votre téléphone. Retrouvez
ce qui est prévu demain. »*
**Réussite** = la personne trouve l'information en moins de 45 secondes, sans avoir
besoin de faire défiler horizontalement l'écran.

### Scénario 6 — Vocabulaire (comparaison A/B, sans dire lequel est lequel)
**Consigne à dire** : *« Regardez ces trois boutons en haut du Planning. Sans
cliquer, dites-moi ce que vous pensez que chacun affiche. »*
Montrer la variante assignée à la personne (voir §7 pour l'ordre). Noter dans la
grille si la personne devine juste SANS cliquer. Puis montrer l'autre variante et
reposer la même question.

**Question finale (à poser à voix haute, une fois les 6 scénarios terminés) :**
> « Pour retrouver "qui fait quoi et quand", quelle présentation avez-vous préférée :
> Gantt (la frise), Kanban (les colonnes) ou Agenda (la liste par jour) ? Et parmi
> les deux façons de nommer les boutons qu'on vient de voir, laquelle vous a semblé
> la plus claire ? »
Noter la réponse SANS relancer, même si la personne hésite.

---

## 7. Neutralité de l'ordre (contre-balancement)

Pour ne jamais favoriser une variante par l'ordre de présentation, répartir les
personnes testées en alternant strictement, dans l'ordre d'arrivée :

| N° personne | Vue initiale (Scénario 1) | Vocabulaire montré en premier (Scénario 6) |
|---|---|---|
| 1 | Gantt | Variante A (actuelle) |
| 2 | Agenda | Variante B (Chronologie/Avancement) |
| 3 | Gantt | Variante B (Chronologie/Avancement) |
| 4 | Agenda | Variante A (actuelle) |
| 5 | Gantt | Variante A (actuelle) |
| 6 | Agenda | Variante B (Chronologie/Avancement) |
| 7 | Gantt | Variante B (Chronologie/Avancement) |
| 8 | Agenda | Variante A (actuelle) |

Cette alternance est fixe et prévue à l'avance : ne pas la choisir en séance ni
selon le profil de la personne.

**Comment lancer chaque variante** (pour l'animateur, avant chaque séance) :
- Vue initiale Gantt : ouvrir le fichier normalement, sans rien ajouter à l'adresse.
- Vue initiale Agenda : ajouter `?r5Initial=agenda` à la fin de l'adresse du fichier.
- Vocabulaire A (actuel, Gantt/Kanban) : n'ajouter rien.
- Vocabulaire B (Chronologie/Avancement) : ajouter `?r5Labels=plain` à la fin de
  l'adresse (`?r5Initial=agenda&r5Labels=plain` si les deux sont combinés).

Ces réglages ne modifient rien de façon durable : fermer l'onglet et le rouvrir
sans paramètre suffit à revenir à l'état normal du prototype.

---

## 8. Grilles de décision (à remplir par l'équipe produit, APRÈS toutes les séances)

Ces grilles ne sont JAMAIS remplies par l'animateur pendant les séances. Elles sont
complétées une fois toutes les grilles de mesure (§5) rassemblées.

### Grille A — Agenda comme vue par défaut du Planning ?

| Critère | Seuil | Résultat observé | Atteint ? |
|---|---|---|---|
| Réussite scénario 1 (retrouver un jour donné) | ≥ 80 % des personnes, sans indice | ___ / ___ | ☐ |
| Réussite scénario 3 (jour intermédiaire d'une longue intervention) | ≥ 80 % des personnes | ___ / ___ | ☐ |
| Réussite scénario 5 (mobile) | ≥ 75 % des personnes, sans défilement horizontal | ___ / ___ | ☐ |
| Préférence globale (question finale) pour Agenda | ≥ 50 % des personnes | ___ / ___ | ☐ |

**Décision** : Agenda ne devient une proposition de vue par défaut que si **tous**
les seuils ci-dessus sont atteints. Si un seul seuil manque, l'option reste « vue
optionnelle, non par défaut » et le sujet est rouvert après correctifs.

### Grille B — Adoption du vocabulaire « Chronologie / Avancement » ?

| Critère | Seuil | Résultat observé | Atteint ? |
|---|---|---|---|
| Compréhension sans clic de la variante B (scénario 6) | ≥ 75 % des personnes | ___ / ___ | ☐ |
| Compréhension sans clic de la variante A (scénario 6, pour comparaison) | (informatif, pas de seuil) | ___ / ___ | — |
| Préférence exprimée pour B (question finale) | ≥ 50 % des personnes | ___ / ___ | ☐ |

**Décision** : le nouveau vocabulaire n'est adopté que si la variante B atteint son
seuil de compréhension ET est préférée par au moins la moitié des personnes. Si la
compréhension de B est correcte mais sans préférence marquée, ou l'inverse,
l'équipe produit peut envisager l'**option intermédiaire proposée dans la mission**
— nommer les boutons « Gantt · Chronologie » et « Kanban · Avancement » (les deux
mots côte à côte) — comme UNE option à tester à son tour, jamais comme un choix déjà
fait à partir de ce seul test.

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
