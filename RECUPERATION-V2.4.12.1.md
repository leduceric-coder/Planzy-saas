# Récupérer les données de votre ancienne V2.4.12.1

## En une phrase

Le fichier V2.4.12.1 que je vous livre ici contient **un seul ajout** : un bouton
*« Exporter une sauvegarde complète »* dans Réglages. Il ne modifie **aucune**
donnée. Pour qu'il voie vos données, il doit **remplacer le fichier exact que
vous ouvriez jusqu'ici** — même dossier, même nom.

## Pourquoi cette précaution

Le POC enregistre tout dans le `localStorage` du navigateur. Or ce stockage est
cloisonné **par origine**. Deux fichiers HTML ouverts en `file://` depuis des
emplacements différents peuvent très bien ne pas partager la même zone de
stockage — et garder le même nom de clé interne n'y change rien.

Autrement dit : un fichier `v2.4.12.1-recovery.html` posé ailleurs ne verrait
**pas** vos données. C'est pourquoi il faut réutiliser **le chemin d'origine**.

Je ne peux pas savoir depuis ce conteneur où vous aviez enregistré votre copie
de V2.4.12.1 — c'est pour cela que cette étape vous revient, et c'est la seule.

## La procédure — 4 étapes

**1. Remplacez votre ancien fichier.**
Retrouvez le fichier `kanvix-next-gen-v2.4.12.1.html` que vous ouvriez
habituellement (souvent dans *Téléchargements*). Remplacez-le par celui que je
vous livre, **en gardant exactement le même nom et le même dossier**.

**2. Ouvrez-le et exportez.**
Ouvrez-le comme d'habitude — vos chantiers, votre historique et vos réglages
doivent réapparaître. Puis : **Réglages → Sauvegarde Kanvix → Exporter une
sauvegarde complète**. Un fichier `kanvix-backup-….json` est téléchargé.

**3. Ouvrez la V2.4.13.1.**
Un message discret en bas de l'écran vous signale que cette copie ne contient
pas encore de données.

**4. Restaurez.**
**Réglages → Sauvegarde Kanvix → Restaurer une sauvegarde**, choisissez le
fichier JSON, vérifiez le résumé affiché, puis **Restaurer**.

C'est tout. Aucune console, aucun copier-coller, aucune modification manuelle.

## Si vos données ne réapparaissent pas à l'étape 2

Cela veut dire que le fichier remplacé n'est pas celui qui portait le stockage
(dossier différent, copie renommée, autre navigateur, ou navigation privée).
Dans ce cas les données de cette session ne sont plus atteignables, et il n'y a
pas de moyen fiable de les retrouver — je préfère vous le dire plutôt que de
laisser croire à une récupération possible.

Vérifications utiles avant de conclure : même **navigateur** que d'habitude,
même **profil**, et pas de nettoyage de données de navigation entre-temps.

## Ce que contient exactement le fichier livré

Un seul bloc ajouté, **42 lignes de code**, strictement en lecture :

- aucun `save()`, aucun `localStorage.setItem`
- aucune migration, aucun changement de `STORE` ni de `SCHEMA_VERSION`
- aucun `resetApp()`, aucun re-rendu
- il se contente de cloner l'état en mémoire, de neutraliser l'éphémère
  (pile d'annulation, simulation en cours) et de télécharger un JSON

Une copie intacte du fichier d'origine est conservée sous
`kanvix-next-gen-v2.4.12.1.before-recovery.html` : vous pouvez revenir en
arrière à tout moment.

## Et pour la suite

Ce problème ne se reposera plus : la V2.4.13.1 intègre **Sauvegarder Kanvix** et
**Restaurer une sauvegarde**. Avant chaque changement de version, une sauvegarde
suffit à emporter l'intégralité de votre environnement — chantiers, tâches,
ressources, incidents, documents, photos, messages, historique et réglages.
