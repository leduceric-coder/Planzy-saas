# Kanvix V2.4.9 — Import intelligent / gestion des doublons

Source de vérité : `public/poc/kanvix-next-gen-v2.4.9.html` (copie intégrale de v2.4.8).
**L'import n'est plus une action immédiate : c'est un assistant.** Le fichier est lu, validé, normalisé et **analysé en mémoire** — aucune donnée métier n'est touchée tant que l'utilisateur n'a pas confirmé.

## Verdict

**PASS.** Le critère final est atteint : **importer deux fois le même fichier ne crée plus jamais `Résidence Keravel (importé)`**. L'utilisateur voit toujours, **avant** toute modification, ce qui est nouveau / déjà présent / fusionné / remplacé / ignoré / supprimé.

| Suite | Résultat |
|---|---|
| Import intelligent V2.4.9 (`recette-import-intelligent-v2.4.9.mjs`, IMP-01→IMP-18) | **59 / 59** |
| Accueil — gelé | **149 / 149** |
| Mode Chantier — gelé | **95 / 95** |
| Réglages — gelé | **63 / 63** |
| Édition des tâches — gelé | **58 / 58** |
| Planning — non-régression | **17 / 17** |
| **Total** | **441 / 441** |

**0 erreur JavaScript applicative.** Les seules lignes console sont les coupures météo/géo **volontairement simulées** et le `console.error` de rollback **provoqué par le test IMP-15** (vérification du rollback).

## 1. Moteur de détection des doublons

`analyzeKanvixImport(data)` classe chaque chantier importé sans jamais muter `app`. Le cœur est `findProjectImportMatch(importedProject)`, en **plusieurs niveaux** (jamais le nom seul).

## 2. Règles ID / nom+lieu

| Priorité | Règle | Résultat | `confidence` |
|---|---|---|---|
| 1 | `importedProject.id === existingProject.id` | doublon certain | `exact-id` |
| 2 | nom **normalisé** identique **ET** localisation **normalisée** identique | doublon très probable | `name-location` |
| 3 | nom identique mais lieu différent/absent | à trancher par l'utilisateur | `possible` |
| 4 | aucune correspondance | nouveau | — |

`normalizeImportText()` : trim + minuscules + suppression des accents (NFD) + ponctuation non significative + espaces multiples réduits. Ainsi `"Résidence Kéravel"`, `" RÉSIDENCE  keravel "` et `"RÉSIDENCE KERAVEL"` donnent tous `residence keravel` (vérifié IMP-09). Un faux positif (`Résidence Horizon — Brest` vs `— Rennes`) reste **« correspondance possible »**, jamais un doublon certain (IMP-10).

## 3. Nombre de stratégies

Quatre stratégies globales + un réglage ligne par ligne + un « appliquer à tous les doublons ».

- **A — Importer uniquement les nouveaux** (doublons/possibles ignorés).
- **B — Fusionner avec les chantiers existants** (défaut recommandé).
- **C — Remplacer les chantiers déjà présents** (uniquement ceux du fichier).
- **D — Remplacer tous les chantiers actuels** (destructif, confirmation dédiée).

Par doublon : **Fusionner / Remplacer / Ignorer / Importer comme nouveau**. Aucune stratégie n'est exécutée avant confirmation.

## 4. Définition — Fusion

Le chantier Kanvix existant **reste l'entité canonique** : son `id` est conservé (jamais de `import-xxx`). Métadonnées mises à jour depuis le fichier si non vides (nom, lieu, phase, `baselineEnd`, `summary`) ; **cycle de vie local préservé** (un chantier clôturé/archivé n'est jamais réactivé silencieusement). Tâches : correspondance par `id` (ou signature stricte nom+début+fin), mise à jour des champs planning importables, **statut terrain et propriétés locales préservés** ; les tâches locales absentes du fichier **sont conservées** ; les nouvelles sont ajoutées (IMP-04). Jalons correspondants mis à jour, nouveaux ajoutés.

## 5. Définition — Remplacement (d'un doublon)

Le chantier canonique est conservé, mais son **planning** est remplacé par celui du fichier : les tâches sans équivalent importé sont supprimées **proprement** (données liées nettoyées), les jalons du chantier sont remplacés. Les **autres chantiers Kanvix ne sont pas touchés** (IMP-05 : `A B C` + import `A` ⇒ `A(import) B C`).

## 6. Définition — Remplacer tout

Vide le **domaine chantier** (chantiers, tâches, jalons, alertes, décisions, messages, documents, photos, historique) puis importe tout le fichier comme nouveau. **Conserve** réglages, `ui`, ressources/utilisateurs, apparence, niveau, rôle, modèles d'entreprise. Jamais `app = importedData`. Confirmation explicite « Remplacer tous les chantiers ? » avec comptes avant → après (IMP-06 : `A B C` + `A D` ⇒ `A D`, ressources et réglages conservés).

## 7. Gestion des tâches

`findTaskImportMatch(importedTask, existingTasks, consumed)` : `id` d'abord, sinon **signature stricte sûre** (nom normalisé + début + fin) — jamais le nom seul pour écraser. Tâche sans correspondance ⇒ ajoutée (id conservé sauf collision réelle avec un autre chantier). En fusion, les tâches locales absentes du fichier restent (IMP-04).

## 8. Remapping des dépendances

Un `taskIdMap` (id importé → id canonique final) est construit pendant l'application, puis une **passe 2** remappe toutes les `deps`, les `reworkOfTaskId` et les `milestone.taskId`. Les références vers une tâche non conservée sont supprimées. 0 référence `import-*` obsolète (IMP-11).

## 9. Données liées (aucune orpheline)

`issues`, `decisions`, `messages`, `photos`, `documents`, `history`, `milestones` sont traités avant toute suppression. En **fusion**, tout est préservé (IMP-12). En **remplacement**, les données d'une tâche qui survit (correspondance) restent rattachées ; pour une tâche réellement supprimée, les alertes/photos/messages/historique sont retirés (et signalés), les décisions vers une alerte disparue nettoyées, les **documents conservés au niveau chantier** (`taskId → null`), les jalons `taskId → null`. Aucun `issue.taskId` / `photo.taskId` / `message.taskId` / `milestone.taskId` ne pointe vers une tâche inexistante (IMP-18).

## 10. companyTemplates

Dédupliqués par `id` puis par **nom normalisé** : une seule occurrence conservée, **jamais** de `import-xxxx-tpl`. Réimporter le même fichier n'ajoute aucun modèle (IMP-13).

## 11. Transaction / rollback

Ordre : parse → validate → analyze → buildImportPlan → **aperçu** → **UN snapshot** → apply en mémoire → `validateImportState` → save → render → rapport. Une erreur entre l'application et la sauvegarde déclenche un **rollback complet** (restauration depuis un backup + retrait du snapshot) : jamais de demi-import (IMP-15).

## 12. Undo

Un import complet (fusion + nouveaux + remplacement) = **UN seul snapshot Undo**. « Annuler » restaure exactement l'état métier précédent, quelle que soit la stratégie (IMP-14, et bouton « Annuler l'import » dans le rapport).

## 13. Validation des références

`validateImportState()` vérifie : IDs chantiers/tâches uniques ; `projectId` des tâches valide ; `deps` valides ; `reworkOfTaskId` valide ; `milestone.projectId`/`taskId` valides ou null ; `issue`/`photo`/`message`/`document` valides ; décisions vers une alerte existante ; **aucune référence orpheline**. Exécuté sur le clone (aperçu) et sur `app` (application) — même moteur, mêmes règles.

## 14. Aperçu = application (même moteur)

`applyImportPlan(plan, S)` s'exécute sur un **clone** pour l'aperçu (aucune mutation de `app`) puis sur `app` à l'application, produisant le **même résumé chiffré**. L'aperçu final affiche : chantiers nouveaux/fusionnés/remplacés/ignorés, tâches ajoutées/mises à jour/supprimées, « 0 référence invalide », et un **avertissement `⚠ Certaines données seront supprimées`** listant le détail avant validation (§28).

## 15. Design & accessibilité

Assistant sobre aligné sur Réglages V2.4.7 : cartes, lignes, badges, contrôles segmentés (jamais un tableau façon Excel). Statuts avec **icône + texte** (pas seulement couleur) : ✓ Nouveau (vert), ⚠ Déjà présent (orange), ? Correspondance possible (bleu), ⛔ remplacement destructif (rouge). Sélecteurs d'action = `<select>` natifs étiquetés, `role="radiogroup"` sur les stratégies, focus visible. Mobile 375/390/430 : stratégies empilées, **0 scroll horizontal**, barre d'action collante (IMP-16). Thème sombre lisible sur toutes les étapes (IMP-17).

## 16. Erreurs & fichier vide

Fichier non-Kanvix ⇒ popup « Ce fichier n'est pas un export Kanvix valide. », aucune modification, aucun snapshot (§39). Fichier à 0 chantier ⇒ « Ce fichier ne contient aucun chantier à importer. », `app` intact (§40).

## 17. Périmètre & schéma

- **Aucun autre moteur touché** : édition universelle des tâches, reflow, Gantt, Kanban, Mode Chantier, Accueil, Réglages inchangés. L'import est le seul périmètre.
- `analyzeKanvixImport` / plan restent **temporaires en mémoire** (`importWizard`) — rien n'est stocké dans `app`.
- `SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (`kanvix-product-8-3`) — aucune migration.
- Diff v2.4.8 → v2.4.9 **strictement confiné** au remplacement de l'ancien `importKanvixFile`/`openKanvixImport` par le moteur d'analyse + le plan/apply transactionnel + l'assistant UI + le bloc CSS `.imp-*`.

## 18. Tests IMP-01 → IMP-18

Tous **PASS** : IMP-01 sans doublon · IMP-02 même fichier ×2 (aucun doublon, aucun `(importé)`, aucun modèle dupliqué) · IMP-03 nouveaux uniquement · IMP-04 fusion · IMP-05 remplacer doublon · IMP-06 remplacer tout · IMP-07 importer comme nouveau (copie) · IMP-08 match ID · IMP-09 match nom+lieu · IMP-10 faux positif · IMP-11 deps remappées · IMP-12 données liées préservées · IMP-13 modèles dédupliqués · IMP-14 undo · IMP-15 rollback · IMP-16 mobile · IMP-17 dark · IMP-18 0 référence orpheline.

## 19. Régressions

Accueil 149/149 · Mode Chantier 95/95 · Réglages 63/63 · Édition des tâches 58/58 · Planning 17/17. **Zones gelées intactes.**

## 20. Erreurs console

**0 erreur applicative.** `net::ERR_FAILED` / `ERR_TUNNEL_CONNECTION_FAILED` = coupure météo/géo simulée ; le `console.error` « import annulé (rollback) » d'IMP-15 est **provoqué par le test** pour vérifier le rollback.

## Critère final

Importer deux fois le même fichier Kanvix ⇒ **jamais** de `Résidence Keravel (importé)`. Avant toute modification, l'utilisateur voit ce qui est **nouveau / déjà présent / fusionné / remplacé / ignoré / supprimé**. ✓

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.9.html` — fichier complet.
2. `recette-import-intelligent-v2.4.9.mjs` — suite (59 vérifications, IMP-01→IMP-18).
3. `rapport-recette-import-intelligent-v2.4.9.md` — ce rapport.
4. Captures : `recette-import/` (analyse clair, aperçu final, confirmation « remplacer tout », mobile 390, sombre).
