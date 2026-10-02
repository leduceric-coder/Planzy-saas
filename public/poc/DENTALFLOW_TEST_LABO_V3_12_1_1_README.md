# DentalFlow — Kit de test laboratoire V3.12.1.1 — README

## Pourquoi un nouveau kit (V3.12.1.1) ?

Hotfix ciblé, **uniquement sur le kit de test**, avant la 2e séance de recette laboratoire. Corrige deux
problèmes bloquants découverts après la livraison du kit V3.12.1 :

1. Le mode Scan (`?mode=scan`) démarrait par défaut sur un poste non scannable (Réception) avec un
   technicien fictif (« Marc ») absent du personnel réellement importé.
2. Le compte connecté par défaut (Gaëtane DUIGOU, rôle ADMINISTRATIF) ne pouvait pas déplacer une commande en
   Production, bloquant une partie des scénarios de la séance.

`dentalflow-next-poc-v3.12.1.html` (le produit) **n'a pas été modifié** — MD5 strictement identique avant et
après ce lot. Tous les correctifs ci-dessous existent **uniquement** dans ce kit.

## Quel fichier lancer

Ouvrir **`dentalflow-test-labo-v3.12.1.1.html`** dans un navigateur (double-clic, ou glisser-déposer dans une
fenêtre de navigateur). Aucune installation, aucune connexion internet requise.

**Dès la première ouverture**, la base de test préparée s'affiche immédiatement : le corpus réellement
importé (cabinets, dentistes, personnel, prestations, fournisseurs, stock) et 10 commandes fictives réparties
dans le flux de fabrication — exactement la même base que le kit V3.12.1, avec les deux correctifs ci-dessous.

Par défaut, le fichier s'ouvre en **mode Laboratoire** (vue complète : Accueil, Commandes, Production, Stock…).

Ce kit utilise une clé de stockage **dédiée** (`dentalflow-test-labo-v31211-state-v1`), indépendante de celle
du kit V3.12.1 (`dentalflow-test-labo-v3121-state-v1`) — ouvrir les deux kits sur le même ordinateur, y
compris dans le même navigateur, ne provoque aucune interférence.

## Correctif 1 — Mode Scan : poste et technicien par défaut réels

Au premier affichage de `?mode=scan`, **avant tout scan**, l'écran indique désormais :

- **Poste : Modélisation** (premier poste de production réellement scannable — jamais Réception, qui ne
  nécessite aucun scan).
- **Technicien : Coralie BASTIER** (premier membre du personnel réellement importé, habilité à scanner,
  trié de façon stable — jamais « Marc », qui n'existe pas dans le personnel importé de ce laboratoire).

Ces deux valeurs sont calculées à chaque démarrage à partir de l'état réel (aucune valeur figée) : si la
configuration des postes ou le personnel change, le poste/technicien par défaut s'adapte automatiquement.

**Le technicien est désormais un menu déroulant** (plus un champ de texte libre) : il ne propose que les
membres du personnel réellement actifs et habilités à scanner (droit « Scanner les commandes »), affichés par
leur nom complet. Impossible de scanner avec un nom qui n'existe pas dans l'équipe.

- **Si aucun technicien habilité n'est disponible**, le message suivant s'affiche et le scan est bloqué :
  *« Aucun membre du personnel autorisé à scanner n'est disponible. »*
- **Si le poste choisi ne nécessite pas de scan** (Réception), le message suivant s'affiche **avant même de
  proposer l'appareil photo ou la caméra**, et aucune tentative de scan n'est possible :
  *« Ce poste ne nécessite pas de scan. Choisissez un poste de production. »*

## Correctif 2 — Séance de recette sans préparation technique

Le compte connecté par défaut (Gaëtane DUIGOU) peut désormais, **sans aucune manipulation technique
préalable** : créer une commande, la consulter, la déplacer manuellement en Production (Réception →
Modélisation → Usinage, etc.), consulter le Stock, utiliser la messagerie, et les autres fonctions nécessaires
à la séance.

**Ce que ce correctif NE fait PAS** (lire attentivement) :

- Il ne transforme **aucun employé réel importé** en Responsable — le rôle et les droits stockés de Gaëtane
  DUIGOU, Coralie BASTIER, et de tout autre membre du personnel réel **restent strictement inchangés**
  (vérifiable à tout moment via l'écran Personnel → Droits).
- Il ne crée **aucun 14e utilisateur** — le personnel reste exactement les 13 personnes réellement importées.
- Ce mécanisme (`testSessionOverride`) **n'existe que dans ce fichier de kit** — il est absent du fichier
  produit `dentalflow-next-poc-v3.12.1.html`, qui n'a jamais été modifié.

**Attribution des actions** : si un déplacement manuel de commande en Production est effectué par la session
de recette (c'est-à-dire sans qu'un acteur réel n'ait été explicitement sélectionné), la traçabilité
(historique, traçabilité de la commande) indique explicitement **« Session test laboratoire »** — jamais le
nom d'un employé réel qui n'a pas réalisé l'action. À l'inverse, un scan dans `?mode=scan` est **toujours**
attribué au technicien réellement choisi dans le menu déroulant (ex. Coralie BASTIER) — jamais à « Session
test laboratoire ».

## Comment choisir le rôle du testeur

Modifier l'adresse dans la barre du navigateur en ajoutant l'un de ces suffixes après
`dentalflow-test-labo-v3.12.1.1.html` :

| Rôle | Suffixe à ajouter | Usage |
|---|---|---|
| Laboratoire (par défaut) | *(aucun)* | Vue complète, tableau de production réorganisé par phases |
| Cabinet dentaire | `?mode=dentist` | Mes commandes / Nouvelle commande / Messages / Factures |
| Collaborateur (poste de production) | `?mode=staff` | Variante du poste terrain |
| Scan (kiosque, smartphone) | `?mode=scan` | Sur smartphone/tablette |

Exemple : `dentalflow-test-labo-v3.12.1.1.html?mode=dentist`

## Comment restaurer le jeu de données (entre deux testeurs)

1. Ouvrir `dentalflow-test-labo-v3.12.1.1.html?observer=1` (ajouter `?observer=1` à l'adresse).
2. Un bouton rouge **« Réinitialiser les données de test »** apparaît en bas à droite de l'écran — visible
   uniquement dans ce mode, jamais pendant une séance de test normale.
3. Cliquer dessus, confirmer.
4. La page se recharge et affiche « Données de test réinitialisées ».

Aucun outil de développement, aucune Console n'est nécessaire pour cette procédure. Ce bouton restaure
également le poste/technicien de scan par défaut (Modélisation / Coralie BASTIER) si un testeur précédent les
avait changés pendant sa séance.

## Quelles données sont fictives / réelles

Identique au kit V3.12.1 (voir `DENTALFLOW_V3_12_1_TEST_REPORT.md` pour le détail complet des 2 écarts
mineurs diagnostiqués services/fournisseurs) :

- **Cabinets (126), dentistes (91), personnel (13), prestations (352), fournisseurs (19), stock (515
  articles)** : données réellement importées du laboratoire.
- **10 commandes fictives déjà présentes**, patients nommés « Fictif Démo 01 » à « Fictif Démo 10 » — noms
  clairement fictifs, visibles uniquement côté Cabinet (jamais côté Labo).
- **Précision technique importante** (voir `DENTALFLOW_V3_12_1_1_TEST_REPORT.md`, section correction) : ces
  identités fictives peuvent exister dans l'état technique interne de l'application (`state.orders`), en plus
  du store Cabinet dédié — aucun écran côté Laboratoire ne les affiche jamais (0 fuite vérifiée sur 16+
  surfaces), seul l'espace du Cabinet propriétaire de la commande les affiche. Ce mécanisme reste un garde-fou
  applicatif, pas une garantie d'isolation serveur de niveau production.
- Le stock importé n'est pas affecté par ces 10 commandes fictives.
- Toute nouvelle commande créée par un testeur doit utiliser un **nom de patient fictif**.

## QR04 — Scan avec un smartphone réel (caméra)

**Rappel de politique** (inchangée depuis V3.12.1) : un test réalisé uniquement sur ordinateur (caméra non
sollicitée, simulation via saisie manuelle ou photo) **ne peut jamais être rapporté comme une validation sur
smartphone réel**. QR04 reste `HARDWARE_REAL_SCAN_NOT_VERIFIED` tant qu'un test physique n'a pas eu lieu.

Pour vérifier QR04 lors de cette 2e séance, sur un smartphone réel :

1. **Origine `file://`** : la plupart des navigateurs mobiles refusent l'accès à la caméra pour une page
   ouverte en `file://` (comportement du navigateur, pas un bug de l'application — le kit affiche d'ailleurs
   explicitement ce message et propose « Prendre une photo » ou la saisie manuelle en repli).
2. **Préférer une origine HTTPS** pour tester la caméra live : utiliser un environnement **privé, contrôlé et
   temporaire** (ex. serveur local sur le réseau du laboratoire, jamais un hébergement public).
   ⚠️ **Ce kit contient des données réelles du laboratoire — ne jamais le publier sur un service web public,
   ne jamais l'héberger sur un serveur accessible depuis internet.**
3. Ouvrir le mode Scan directement (`?mode=scan`) sur le smartphone.
4. Accorder l'accès à la caméra lorsque le navigateur le demande.
5. Vérifier/choisir le poste et le technicien affichés (modifiables via « Changer de poste »).
6. Scanner un QR appartenant à l'une des 10 commandes fictives (visible depuis la fiche commande côté Labo,
   bouton « Imprimer la fiche »).
7. Confirmer que la localisation est bien enregistrée avec le bon poste et le bon technicien.

## Que faire en cas de blocage

- **L'application semble figée ou affiche une erreur :** recharger simplement la page (F5) — aucune donnée
  n'est perdue (la séance en cours persiste, y compris le poste/technicien de scan choisi).
- **Les données affichées ne correspondent plus à la baseline attendue :** appliquer la procédure de
  réinitialisation ci-dessus.
- **Un ancien DentalFlow (kit V3.12.1, autre onglet) était déjà ouvert sur cet ordinateur :** aucun risque —
  ce kit utilise une clé de stockage dédiée, jamais partagée avec le kit V3.12.1 ni avec le produit.

## ⚠️ Confidentialité — ce kit ne doit JAMAIS être publié

Ce kit contient des données réelles du laboratoire (cabinets, dentistes, personnel, stock). Il ne doit
**jamais** être commité dans Git, jamais poussé sur un dépôt distant, jamais téléversé sur un service web,
quel qu'il soit. Il reste volontairement non suivi par Git — comportement attendu, identique aux kits
précédents (V1, V2, V3.12.1) de ce projet.

## Fichiers du kit

| Fichier | Usage |
|---|---|
| `dentalflow-test-labo-v3.12.1.1.html` | Application à ouvrir pour la séance — autonome, charge la base de test automatiquement |
| `DENTALFLOW_TEST_LABO_V3_12_1_1_README.md` | Ce document |
| `DENTALFLOW_V3_12_1_1_TEST_REPORT.md` | Preuve technique du hotfix (tests ciblés, non-régression, confidentialité) |
| `DENTALFLOW_V3_12_1_1_IMPLEMENTATION_REPORT.md` | Rapport d'implémentation + décision finale |
| `DENTALFLOW_V3_12_1_CHANGELOG.md`, `DENTALFLOW_V3_12_1_TEST_REPORT.md`, `DENTALFLOW_V3_12_1_IMPLEMENTATION_REPORT.md` | Documentation du lot V3.12.1 précédent (toujours valide pour tout ce qui n'a pas changé ici) |
| `dentalflow-questionnaire-utilisateur-v2.2.html` | Questionnaire écrit à remettre en fin de séance (inchangé) |
