# RAPPORT — KANVIX V2.12.2 — SIMPLIFICATION-R2/R3/R4

**Modèle utilisé pour cette mission : Claude Sonnet 5** (`claude-sonnet-5`), du début à la fin. Aucun sous-agent utilisé (audit et implémentation réalisés directement, sans analyse redondante).

---

## 1. Audit initial

### R2 — Structure de chantier
Lecture de `projectTabs()` : depuis V2.9.0, l'onglet **est déjà poussé sans aucune condition** (`a.push("Structure")`, en dehors du `if (app.settings.level !== "essential")` qui ne gate que Planning/Ressources/Historique). Un seul point d'affichage (`projectTabContent`), pas de variante mobile séparée. L'hypothèse de départ (« il faut peut-être encore masquer l'onglet ») était donc **déjà contredite par le code réel** — conforme à ce que documentait `KANVIX_PLAN_SIMPLIFICATION_V1_1.md` §2a. Seul point réellement à corriger : le texte d'accroche de l'état vide (`projectStructureTab()`, condition `!racines.length`), plus injonctif que nécessaire (« Structurez votre chantier » / « Organisez-le par bâtiment… »).

### R3 — Rôle de démonstration
Trois points d'entrée manuels identifiés par recherche exhaustive de `setRole(` dans le fichier :
1. `roleCard()` + bloc « Mode de démonstration » dans `renderMore()` (Réglages).
2. `<button onclick="setRole('artisan')">Voir comme artisan</button>` dans `renderUserMenu()` (popover profil).
3. `<button title="Vue conducteur" onclick="setRole('driver')">` dans `renderArtisan()` — l'autre sens du même bascule, à l'intérieur même de la conversation Artisan.

Aucun autre chemin d'entrée (pas de paramètre d'URL, pas de lien d'invitation réel — les invitations restent simulées par toast). `setRole()` elle-même reste nécessaire en interne et pour toutes les recettes automatisées (y compris celle-ci) qui exercent la vue Artisan.

### R4 — Opérations
Point de contrôle unique confirmé : `renderSites()` (dispatcheur `today`/`sites`/…/`operation` dans `render()`). `sitesModeSwitch()` est le contrôle UI, `renderOperationsList()`/`operationCard()`/`getOperationSummary()` le moteur (non touché). Un second chemin existait : `renderOperation()` (fiche détaillée d'UNE opération, `app.ui.page === "operation"`), atteignable uniquement via `selectOperation()` depuis la liste — donc lui aussi à garder cohérent si l'utilisateur bascule de niveau **pendant** qu'il consulte cette fiche (aucun garde n'existait nulle part dans Kanvix pour ce cas — première fois qu'une page est rendue conditionnelle au niveau alors qu'elle était déjà ouverte).

Code mort confirmé par lecture : dans `renderPlanning()`, `let advanced = app.settings.level !== "essential", expert = app.settings.level !== "essential"` — **littéralement la même expression** assignée aux deux variables. `advanced && !expert` vaut donc toujours `false`.

---

## 2. Fonctions modifiées

**8 fonctions existantes modifiées**, **0 fonction ajoutée**, **1 fonction supprimée** (`roleCard`, devenue orpheline) :

| Fonction | Lot | Nature du changement |
|---|---|---|
| `projectStructureTab` | R2 | Texte de l'état vide reformulé |
| `renderMore` | R3 | Bloc « Mode de démonstration » retiré, `.settings-grid` simplifié |
| `renderUserMenu` | R3 | Bouton « Voir comme artisan » retiré |
| `renderArtisan` | R3 | Bouton « Vue conducteur » retiré |
| `renderSites` | R4 | Garde `&& app.settings.level !== "essential"` sur l'accès Opérations |
| `sitesModeSwitch` | R4 | Retourne `""` en Essentiel |
| `renderOperation` | R4 | Garde en tête de fonction : retour vers Chantiers si Essentiel |
| `renderPlanning` | R4 | Ternaire mort `advanced && !expert` retiré |

Chaque changement est justifié au §1 ci-dessus et vérifié par une assertion dédiée (§5).

---

## 3. Matrice des tests

| Domaine | Assertions | Recette |
|---|---|---|
| Structure toujours accessible | STRUCT-01→10 | `recette-simplification-r2-r4-v2.12.2.mjs` |
| Rôle de démonstration retiré | ROLE-01→12 | idem |
| Opérations réservé Pilotage | OPS-01→07 | idem |
| Non-régression V2.12.1 (rejeu intégral) | 77 assertions | `recette-preparer-decalage-v2.12.1.mjs` |
| Parcours décalage sur le fichier V2.12.2 lui-même | DECAL-ON-V2122 | `recette-simplification-r2-r4-v2.12.2.mjs` |
| Contrôle différentiel de périmètre | FREEZE-2122 | idem |
| Responsive + clavier | NAV-RESP, NAV-KBD | idem |

---

## 4. Résultats chiffrés

```
recette-simplification-r2-r4-v2.12.2.mjs
RÉSULTAT : 53 / 53
ERREURS CONSOLE APPLICATIVES : 0
```

Détail par famille : Structure 12/12 · Rôle de démonstration 13/13 · Opérations 9/9 · rejeu V2.12.1 (1 assertion agrégée + le sous-rejeu détaillé, voir §5) · parcours décalage sur V2.12.2 : 2/2 · FREEZE-2122 : 8/8 · responsive/clavier : 4/4 · 0 erreur console.

## 5. Résultats des recettes historiques

**Rejeu obligatoire — `recette-preparer-decalage-v2.12.1.mjs` contre V2.12.2 :**
```
RÉSULTAT : 77 / 77
ERREURS CONSOLE APPLICATIVES : 0
```
Cette recette pointe intrinsèquement son `CUR` sur `kanvix-next-gen-v2.12.1.html` (fichier non modifié par ce round). Pour couvrir explicitement le fichier V2.12.2 **lui-même**, le test `DECAL-ON-V2122` rejoue le geste complet (bouton → panneau → calcul → confirmation → application → Undo) directement sur `kanvix-next-gen-v2.12.2.html` : succès, dates et historique identiques à V2.12.1. FREEZE-2122 (§7) confirme par ailleurs que les 14 fonctions transactionnelles sont byte-identiques entre les deux fichiers — la garantie ne repose donc pas sur ce seul test manuel.

**Recettes historiques pertinentes rejouées** (choisies pour leur recoupement direct avec les zones touchées) :

- `recette-operations-v2.8.0.mjs` (CUR repointé sur V2.12.2, PREV inchangé = V2.7.1) : **70/71**. Le seul échec (`FREEZE-280`, liste de moteurs byte-identiques à V2.7.1) porte sur des fonctions **sans rapport avec ce round** (`setTaskStatus`, `getTodayDecisions`, `getTodayWarnings`, `openFieldTaskModal`, `renderProject`, `projectTabs`, `projectTabContent`, `confirmKanvixRestore`) — toutes légitimement modifiées entre V2.7.1 et V2.12.1, sur 30+ rounds intermédiaires antérieurs à ce lot. Aucune n'a été touchée par R2-R4. Les 70 autres assertions — dont le responsive, le thème sombre, l'import/export, la sauvegarde et le Mode Chantier des Opérations — passent toutes.
- `recette-structure-compacte-v2.9.1.mjs` (CUR repointé sur V2.12.2, PREV inchangé = V2.9.0.1) : **72/74**. Les 2 échecs sont directement et uniquement les fonctions que CE round modifie légitimement (`renderPlanning`, et la liste `renderOperation`/`sitesModeSwitch`/`renderSites`/`renderUserMenu` dans le contrôle de périmètre de cette ancienne recette, qui ne pouvait pas les connaître). Toutes les règles métier de la Structure (archivage, suppression, cycle, Undo, responsive 11 largeurs × 2 thèmes, y compris `STC-48` qui teste déjà littéralement « chantier sans structure reste utilisable ») passent sans exception.

Aucune assertion historique n'a été modifiée, affaiblie ou contournée. Chaque échec est nommément identifié et sa cause est une comparaison à une génération de code antérieure à ce round, jamais une régression introduite par R2-R4.

---

## 6. Comparaison de périmètre avec V2.12.1 (FREEZE-2122)

- **Fonctions ajoutées : 0.**
- **Fonctions supprimées : 1** (`roleCard`, rendue orpheline par le retrait du bloc « Mode de démonstration »).
- **Fonctions modifiées : 8**, exactement celles listées au §2 — balayage `md5` de **toutes** les fonctions du fichier, aucune autre différence trouvée (y compris `renderAIPanel`, vérifiée séparément par bloc indenté).
- **Fonctions transactionnelles V2.12.1** (les 14 de « Préparer un décalage ») + moteurs de calendrier/dépendances/propagation/ressources (`planReflow`, `applyReflowPlan`, `planScheduleChanges`, `evaluateDependencyConflicts`, `getResourceSchedulingConflicts`, `addBusinessDays`, `addWorkingDuration`, `nextWorkingTime`, `nonWorkingDaysInRange`) + Undo/Redo/communications (`snapshot`, `undo`, `redo`, `cloneHistoryState`, `restoreHistoryState`, `preserveCommunications`, `invalidateRedo`) + `setTaskStatus`, `scenarioOptions`, `showWhatIf`, messagerie, moteur Structure (`getProjectStructure`, `openStructureForm`, `toggleStructureArchive`) et `openTask()` : **53 fonctions comparées, 0 différence.**
- **Styles :** la feuille CSS a changé — c'est attendu, ce round retire volontairement une UI. Le changement est **borné exactement** aux 4 classes du sélecteur de rôle (`.role-card`, `.role-grid`, `.settings-grid`, `.settings-intro`), vérifié en comparant la présence de chaque classe avant/après (−2289 octets, aucune autre classe touchée).
- **Données/schéma :** `SCHEMA_VERSION` reste 15, `STORE` reste `kanvix-product-8-3`, `INITIAL_STATE` byte-identique.

---

## 7. Captures produites

Dans `recette-v2.12.2/` :

1. `01-structure-vide-essentiel.png` — mobile 390 px clair, chantier « Les Terrasses » vidé de ses tâches, niveau Essentiel : onglet Structure accessible, nouveau texte d'accroche visible.
2. `02-reglages-essentiel-pilotage-conserve.png` — Réglages, 1440 px clair : « Niveau d'affichage » (Essentiel/Pilotage) intact, bloc « Mode de démonstration » absent.
3. `02c-popover-profil-sans-role-demo.png` (capture complémentaire) — popover profil, 1440 px clair : Essentiel/Pilotage présent, « Voir comme artisan » absent.
4. `03-chantiers-essentiel-sans-operations.png` — Chantiers, 1440 px clair, niveau Essentiel : aucun sélecteur Chantiers/Opérations.
5. `04-chantiers-pilotage-avec-operations.png` — Chantiers → Opérations, 1440 px clair, niveau Pilotage : sélecteur et liste fonctionnels.

Validation supplémentaire effectuée sans capture dédiée : 390 px sombre, 1440 px sombre (`NAV-RESP`, 4 combinaisons, 0 débordement horizontal), navigation clavier (focus atteignable sur l'action de l'état vide Structure, `Tab` fonctionnel).

## 8. Erreurs console

**0** erreur JavaScript applicative sur l'ensemble des deux recettes exécutées (dédiée + rejeu V2.12.1).

## 9. Limites restantes

- Le retour automatique vers Chantiers (`renderOperation`, R4) mute `app.ui.page` sans appeler `save()` explicitement — comportement volontairement identique au garde-fou préexistant « opération introuvable » (quelques lignes plus bas dans la même fonction), qui procède à l'identique. Auto-cohérent au pire cas (un rechargement immédiat re-déclenche la même garde).
- `app.ui.sitesMode` n'est jamais réinitialisé lors du passage en Essentiel : c'est un choix délibéré (« ne supprimer aucune préférence métier ») — au retour en Pilotage, l'utilisateur retrouve directement la LISTE des Opérations plutôt que la fiche exacte qu'il consultait avant sa bascule (si c'était une fiche). Cela reste conforme au critère d'acceptation (« l'accès réapparaît »), sans viser une restauration pixel-exacte de la profondeur de navigation.
- Le retrait de `roleCard()`/`.role-card`/`.role-grid` laisse `.role-emoji` présent dans deux règles CSS partagées avec `.settings-ico`/`.seg-ico`/`.settings-row-ico` (sélecteur multiple) : non retiré individuellement pour ne pas risquer une régression sur les icônes encore utilisées — cette classe est simplement un sélecteur mort sans élément à cibler, sans effet visuel ni fonctionnel.

## 10. Livrables

1. `public/poc/kanvix-next-gen-v2.12.2.html` — fichier complet.
2. `recette-simplification-r2-r4-v2.12.2.mjs` — recette dédiée (53/53).
3. `RAPPORT-V2.12.2-SIMPLIFICATION-R2-R4.md` — ce rapport.
4. `recette-v2.12.2/resultats.json` — résultats chiffrés.
5. `recette-v2.12.2/01-structure-vide-essentiel.png`, `02-reglages-essentiel-pilotage-conserve.png`, `02c-popover-profil-sans-role-demo.png`, `03-chantiers-essentiel-sans-operations.png`, `04-chantiers-pilotage-avec-operations.png` — captures de validation.

Aucun autre lot (R1 déjà livré en V2.12.1, R5/R6/R7) n'a été commencé ni modifié. Aucune fusion des parcours de décalage (`scenarioOptions`/`showWhatIf`/« Préparer un décalage ») n'a été entreprise.
