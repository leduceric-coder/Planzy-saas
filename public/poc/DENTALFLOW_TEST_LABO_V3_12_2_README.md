# DentalFlow — Kit de test laboratoire V3.12.2 — README

## Quoi de neuf par rapport au kit V3.12.1.1

Quatre correctifs issus des retours de la 2e séance de recette, tous décrits en détail dans
`DENTALFLOW_V3_12_2_CHANGELOG.md` :

1. **Messagerie Laboratoire** : la side-window Messages est désormais large et responsive (plus de
   défilement horizontal, à aucune largeur).
2. **Fiche Article (Stock)** : les 6 indicateurs sont compacts, plus d'espace vide inutile.
3. **Bouton « Ajuster »** (fiche Article) : ferme désormais proprement la fiche avant d'ouvrir le
   formulaire d'ajustement — plus de superposition visuelle.
4. **Toolbar Stock** : « ＋ Nouvel article » / « Réceptionner ▾ » / « ⋯ » restent lisibles et accessibles à
   toutes les largeurs.
5. **Badge « À qualifier »** (Factures > Prestations) : tient désormais sur une seule ligne.
6. **Désactivation d'un compte utilisateur** (nouvelle fonction) : voir ci-dessous.

**Tout ce qui faisait le kit V3.12.1.1 est intégralement conservé** : corpus réellement importé (126
cabinets, 91 dentistes, 13 utilisateurs, 352 prestations, 19 fournisseurs, 515 articles), les 10 commandes
fictives (répartition 2/2/2/2/1/1), le contexte de session de recette (`testSessionOverride`, permet de
créer/déplacer des commandes sans préparation technique), et le correctif du mode Scan (poste et technicien
par défaut réels, jamais « Marc »/« Réception »).

## Nouvelle fonction — Désactiver un compte utilisateur

Le laboratoire peut désormais « retirer » un collaborateur qui quitte l'entreprise, **sans jamais supprimer**
son compte ni son historique :

1. Aller dans **Utilisateurs**, cliquer **Modifier** sur la personne concernée.
2. Cliquer **Désactiver le compte**.
3. Choisir un motif (Départ de l'entreprise / Fin de contrat / Autre — commentaire obligatoire si Autre).
4. Confirmer.

Le compte désactivé :

- n'apparaît plus dans la liste par défaut (filtre **Actifs**) — le retrouver via le filtre **Désactivés**
  ou **Tous** ;
- n'est plus proposé pour une nouvelle opération (Collaborateur, Scan…) ;
- **conserve tout son historique** (scans, déplacements, mouvements de stock passés) — son nom continue de
  s'afficher normalement sur les événements déjà enregistrés.

Un bouton **Réactiver** permet de revenir en arrière à tout moment, sans perte d'information.

**Limite volontaire** : impossible de désactiver le compte actuellement connecté (message explicite) — évite
de se retrouver bloqué en pleine séance.

## Quel fichier lancer

Ouvrir **`dentalflow-test-labo-v3.12.2.html`** dans un navigateur (double-clic, ou glisser-déposer). Aucune
installation, aucune connexion internet requise. Dès la première ouverture, la base de test s'affiche
immédiatement — exactement la même baseline que V3.12.1.1.

Ce kit utilise une clé de stockage **dédiée** (`dentalflow-test-labo-v3122-state-v1`), indépendante des kits
V3.12.1 et V3.12.1.1 — aucune interférence possible, même en ouvrant les trois kits sur le même ordinateur.

## Comment choisir le rôle du testeur

| Rôle | Suffixe à ajouter | Usage |
|---|---|---|
| Laboratoire (par défaut) | *(aucun)* | Vue complète |
| Cabinet dentaire | `?mode=dentist` | Mes commandes / Nouvelle commande / Messages / Factures |
| Collaborateur (poste de production) | `?mode=staff` | Variante du poste terrain |
| Scan (kiosque, smartphone) | `?mode=scan` | Sur smartphone/tablette |

## Comment restaurer le jeu de données (entre deux testeurs)

Identique à V3.12.1.1 : ouvrir `dentalflow-test-labo-v3.12.2.html?observer=1`, cliquer sur le bouton rouge
**« Réinitialiser les données de test »** en bas à droite, confirmer. Aucun compte n'est pré-désactivé dans
la baseline — la fonction de désactivation est disponible mais son usage reste entièrement à l'initiative du
testeur pendant sa séance.

## QR04 — Scan avec un smartphone réel

Rappel inchangé depuis V3.12.1 : seul un test réalisé sur un smartphone physique, caméra réellement
sollicitée, peut valider QR04. Voir `DENTALFLOW_TEST_LABO_V3_12_1_1_README.md` pour la procédure complète
(origine HTTPS privée, jamais d'hébergement public — ce kit contient des données réelles du laboratoire).

## ⚠️ Confidentialité — ce kit ne doit JAMAIS être publié

Ce kit contient des données réelles du laboratoire. Il ne doit **jamais** être commité dans Git, jamais
poussé sur un dépôt distant, jamais téléversé sur un service web. Il reste volontairement non suivi par Git.

## Fichiers du kit

| Fichier | Usage |
|---|---|
| `dentalflow-test-labo-v3.12.2.html` | Application à ouvrir pour la séance |
| `DENTALFLOW_TEST_LABO_V3_12_2_README.md` | Ce document |
| `DENTALFLOW_V3_12_2_CHANGELOG.md` | Détail technique des 4 correctifs |
| `DENTALFLOW_V3_12_2_TEST_REPORT.md` | Preuve technique (tests ciblés, non-régression) |
| `DENTALFLOW_V3_12_2_IMPLEMENTATION_REPORT.md` | Rapport d'implémentation + décision finale |
| Fichiers V3.12.1/V3.12.1.1 (changelog, test report, implementation report, README) | Toujours valides pour tout ce qui n'a pas changé ici |
| `dentalflow-questionnaire-utilisateur-v2.2.html` | Questionnaire écrit (inchangé) |
