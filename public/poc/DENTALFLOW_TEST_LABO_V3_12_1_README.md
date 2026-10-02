# DentalFlow — Kit de test laboratoire V3.12.1 — README

## Quel fichier lancer

Ouvrir **`dentalflow-test-labo-v3.12.1.html`** dans un navigateur (double-clic, ou glisser-déposer dans une
fenêtre de navigateur). Aucune installation, aucune connexion internet requise.

**Dès la première ouverture**, la base de test préparée s'affiche **immédiatement** — aucune manipulation n'est
nécessaire : le corpus réellement importé (cabinets, dentistes, personnel, prestations, fournisseurs, stock) et
10 commandes fictives réparties dans le flux de fabrication.

Par défaut, le fichier s'ouvre en **mode Laboratoire** (vue complète : Accueil, Commandes, Production, Stock…).

## Comment choisir le rôle du testeur

Modifier l'adresse dans la barre du navigateur en ajoutant l'un de ces suffixes après
`dentalflow-test-labo-v3.12.1.html` :

| Rôle | Suffixe à ajouter | Usage |
|---|---|---|
| Laboratoire (par défaut) | *(aucun)* | Vue complète, tableau de production réorganisé par phases |
| Cabinet dentaire | `?mode=dentist` | Mes commandes / Nouvelle commande / Messages / Factures |
| Collaborateur (poste de production) | `?mode=staff` | Variante du poste terrain |
| Scan (kiosque, smartphone) | `?mode=scan` | Sur smartphone/tablette |

Exemple : `dentalflow-test-labo-v3.12.1.html?mode=dentist`

## Comment restaurer le jeu de données (entre deux testeurs)

1. Ouvrir `dentalflow-test-labo-v3.12.1.html?observer=1` (ajouter `?observer=1` à l'adresse).
2. Un bouton rouge **« Réinitialiser les données de test »** apparaît en bas à droite de l'écran — visible
   uniquement dans ce mode, jamais pendant une séance de test normale.
3. Cliquer dessus, confirmer.
4. La page se recharge et affiche « Données de test réinitialisées ».

Aucun outil de développement, aucune Console n'est nécessaire pour cette procédure.

## Quelles données sont fictives / réelles

- **Cabinets (126), dentistes (91), personnel (13), prestations (352), fournisseurs (19), stock (515
  articles) : données réellement importées** du laboratoire — aucune fixture historique de démonstration
  DentalFlow (`Cabinet Moderne`, `Dr. Morvan`, `Eric Leduc`…) n'apparaît nulle part dans ce kit.
  *Nota : 2 écarts mineurs par rapport aux totaux nominaux 353 prestations / 17 fournisseurs, diagnostiqués avec
  leur cause exacte (un doublon réel dans le fichier des prestations, une variante d'orthographe d'un
  fournisseur dans le fichier d'inventaire) et validés avec le laboratoire — voir
  `DENTALFLOW_V3_12_1_TEST_REPORT.md`.*
- **3 prestations déjà qualifiées** pour la séance : *Couronne Zircone stratifiée* (Forfait), *Elément de bridge
  Provisoire* (Par dent), *Wax Up / Cire d'analyse* (Forfait). Les autres prestations réelles restent
  volontairement « À qualifier ».
- **10 commandes fictives déjà présentes**, patients nommés « Fictif Démo 01 » à « Fictif Démo 10 » — noms
  **clairement fictifs**, visibles uniquement côté Cabinet (jamais côté Labo, voir confidentialité ci-dessous) :
  - 2 à l'étape Réception, 2 à Modélisation, 2 à Usinage, 2 à Finition 1, 1 à Finition 2, 1 à Expédition
    (« Prête à livrer », pas encore livrée).
  - Un Cabinet (« ANDRE-GUILLOU Fabienne ») porte 3 de ces commandes et une conversation de démonstration (2
    messages, sans nom de patient dans le texte) pour tester Mes commandes / Messages.
- **Le stock importé n'est pas affecté** par ces 10 commandes fictives — il correspond exactement au corpus réel.
- **Toute nouvelle commande créée par un testeur** doit utiliser un **nom de patient fictif** — jamais un nom de
  patient réel.
- Le laboratoire ne voit jamais l'identité réelle (ou fictive) du patient dans ses propres écrans (uniquement
  une référence, ex. `PAT-A1B2C3`) — seul l'espace Cabinet affiche l'identité complète. Comportement normal et
  voulu (règle de confidentialité maintenue depuis V3.10.3.6, revérifiée explicitement sur ce kit : 0 fuite sur
  16 surfaces).

## Ce qui a changé par rapport au kit V2

- Correctifs UX de l'Espace Cabinet : bouton « Nouveau message » (invisible sous 860px dans la version
  précédente), mise en page de la messagerie, formulaire « Nouveau message » — voir
  `DENTALFLOW_V3_12_1_CHANGELOG.md`.
- Nouveau modèle de production par phases (Réception / Production / Expédition) — tableau de production
  réorganisé visuellement, statut Cabinet simplifié (Reçue / En fabrication / Expédition / Livrée).
- Ce fichier contient **uniquement** les données réellement importées — plus aucune fixture historique de
  démonstration mélangée au corpus réel (contrairement au kit V2, qui mélangeait les deux).
- Clé de stockage **dédiée** à ce kit (`dentalflow-test-labo-v3121-state-v1`), indépendante de toute autre
  version de DentalFlow déjà utilisée sur le même ordinateur.
- `dentalflow-next-poc-v3.12.1.html` (l'application produit, sans le kit de test) **n'a pas été modifiée**.

## Que faire en cas de blocage

- **L'application semble figée ou affiche une erreur :** recharger simplement la page (F5) — aucune donnée
  n'est perdue (la séance en cours persiste).
- **Les données affichées ne correspondent plus à la baseline attendue :** appliquer la procédure de
  réinitialisation ci-dessus.
- **Un ancien DentalFlow (autre onglet, autre kit) était déjà ouvert sur cet ordinateur :** aucun risque — ce kit
  utilise une clé de stockage dédiée, jamais partagée.

## Fichiers du kit

| Fichier | Usage |
|---|---|
| `dentalflow-test-labo-v3.12.1.html` | Application à ouvrir pour la séance — autonome, charge la base de test automatiquement |
| `DENTALFLOW_V3_12_1_CHANGELOG.md` | Détail des correctifs UX Cabinet + construction du kit |
| `DENTALFLOW_V3_12_1_TEST_REPORT.md` | Preuve technique (CABUX01-10, DATA01-15, non-régression, confidentialité) |
| `DENTALFLOW_V3_12_1_IMPLEMENTATION_REPORT.md` | Rapport d'implémentation + décision finale |
| `dentalflow-questionnaire-utilisateur-v2.2.html` | Questionnaire écrit à remettre en fin de séance (inchangé) |
