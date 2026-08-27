# DentalFlow Next — V3.3.2 Fix Report

Base : `dentalflow-next-poc-v3.3.1.html` (non modifié)
Livrable : `dentalflow-next-poc-v3.3.2.html`

Sprint : **hotfix ciblé** — migration des profils collaborateurs.
**Résultat : toutes les vérifications OK · 0 erreur console.**

---

## Cause du bug

`load()` faisait `users: (s.users && s.users.length) ? s.users : clone(demoUsers)` :
un `localStorage` déjà présent sous la clé `dentalflow-next-mockup-state-v4`
(sauvegardé avant l'introduction de `assignedStageId` / `leaveAllowance` /
`leaveUsedYTD`) remplaçait intégralement `demoUsers` par ses anciens objets,
qui ne portaient pas ces champs. `getAssignedStage()` retournait alors `null`
pour tout le monde — d'où le message « Aucun poste… » pour Marc.

## Correction — migration de schéma (pas un changement de clé)

- **`migrateUsers(savedUsers)`** : pour chaque utilisateur sauvegardé, fusionne
  `{...defaults, ...saved}` (les valeurs personnalisées sont conservées ; une
  clé **absente** du profil sauvegardé est complétée depuis `demoUsers` —
  jamais via `||`, pour ne pas écraser un `assignedStageId: null` volontaire
  comme celui d'Eric/Sophie). Les profils de démonstration absents du
  `localStorage` (ex. ajoutés plus tard dans le code) sont ajoutés.
- **`SCHEMA_VERSION = 5`** stocké dans l'état persisté. `load()` déclenche la
  migration si `schemaVersion` est absent ou `< 5`, puis persiste une seule
  fois le résultat (`save()`), sans reset ni changement de `STORAGE_KEY`.
- `STORAGE_KEY` reste `dentalflow-next-mockup-state-v4` — aucune donnée
  utilisateur n'est perdue (conformément à la consigne : pas de simple
  bascule de clé qui masquerait le bug en supprimant les données).

## Validation des affectations de poste

- `getAssignedStageStatus(user)` → `'ok'` (poste actif), `'inactive'` (poste
  existant mais désactivé — affectation conservée, scan bloqué avec message
  dédié), `'none'` (aucune affectation ou identifiant orphelin).
- `validateUserStageAssignments()` (appelée après chargement) ne corrige que
  le cas sûr : un `assignedStageId` orphelin est réaligné sur la valeur de
  référence `demoUsers` **si celle-ci est elle-même valide** dans le flux
  courant. Jamais de repli arbitraire vers `STG-001` / Réception.

## `staffEligibleUsers()` — plus de fallback masquant

- Retourne désormais les collaborateurs ayant un `assignedStageId` renseigné
  (statut `'ok'` **ou** `'inactive'` — un poste désactivé doit rester
  sélectionnable pour afficher son message, pas disparaître silencieusement).
  Exclut uniquement les profils sans aucune affectation (Eric, Sophie, ou
  affectation orpheline non réparable).
- Si la liste est vide : écran « Erreur de configuration » explicite avec
  lien de retour — **jamais** un repli vers l'équipe entière.

*Note de correction en cours de développement* : la première version filtrait
sur `'ok'` uniquement, ce qui faisait disparaître un collaborateur du
sélecteur dès que son poste était désactivé — repéré et corrigé par le test
§ »poste désactivé« ci-dessous avant livraison.

## Congés — suppression du double comptage

- `getLeaveMetrics()` reste `used = leaveUsedYTD + leaveTaken(uid)` (pour que
  l'approbation d'une nouvelle demande continue à faire évoluer le compteur),
  mais les valeurs de référence `leaveUsedYTD` ont été recalées pour ne plus
  additionner deux fois les absences de démonstration déjà présentes dans
  `state.absences` :

| Collaborateur | Absence démo | Jours ouvrés | `leaveUsedYTD` avant | `leaveUsedYTD` après | Total affiché |
|---|---|---|---|---|---|
| Nora Benali | 27→31 août | 3 | 11 | **8** | 11 (inchangé) |
| Thomas Girard | 14→18 sept | 5 | 14 | **9** | 14 (inchangé) |
| Rachid Amrani | 24→25 août | 2 | 13 | **11** | 13 (inchangé) |
| Clara Vidal | 12→13 août | 2 | 3 | **1** | 3 (inchangé) |
| Karim Haddad | Formation (exclue) | — | 10 | 10 | 10 (inchangé) |

Les totaux affichés restent ceux prévus par le hotfix précédent — seule la
répartition baseline/absence a été corrigée pour éliminer le double comptage.

---

## Tests

### Ancien localStorage sans les nouveaux champs (§18)

localStorage seedé manuellement avec 4 utilisateurs legacy (Marc, Nora, Eric,
Sophie) **sans** `assignedStageId`/`leaveAllowance`/`leaveUsedYTD`, puis
rechargement de `?mode=staff`.

| Vérification | Résultat |
|---|---|
| Marc → `assignedStageId` | ✅ `STG-003` |
| Marc → poste affiché | ✅ Usinage |
| Marc → `leaveAllowance` / `leaveUsedYTD` | ✅ 25 / 8 |
| Nora → `assignedStageId` | ✅ `STG-004` (Céramique) |
| Total utilisateurs après migration | ✅ 15 (profils manquants réintégrés) |
| Eric → `assignedStageId` | ✅ reste `null` (pas de repli arbitraire) |
| Message rouge affiché pour Marc | ✅ absent |
| Champ de scan disponible | ✅ oui |
| `schemaVersion` persisté | ✅ `5` |

### État déjà migré — deuxième chargement (§19)

| Vérification | Résultat |
|---|---|
| `assignedStageId` de Marc identique | ✅ `STG-003` |
| Nombre d'utilisateurs identique | ✅ 15 (pas de duplication) |
| `schemaVersion` stable | ✅ `5` |

### Tous les profils (§10-11)

| Collaborateur | Poste attendu | Résultat |
|---|---|---|
| Marc Dubois | Usinage | ✅ |
| Nora Benali | Céramique | ✅ |
| Léna Fontaine | Contrôle qualité | ✅ |
| Thomas Girard | Design CAD | ✅ |
| Julie Moreau | Céramique | ✅ |
| Karim Haddad | Usinage | ✅ |
| Antoine Lopez | Réception | ✅ |
| Rachid Amrani | Contrôle qualité | ✅ |
| Clara Vidal | Réception | ✅ |
| Eric Leduc | *(aucun, volontaire)* | ✅ |
| Sophie Marchand | *(aucun, volontaire)* | ✅ |

`staffEligibleUsers()` : 13 collaborateurs affectés, **Eric et Sophie exclus**. ✅

### Poste désactivé (§6, régression détectée puis corrigée)

Désactivation d'« Usinage » (poste de Marc) sans modifier son profil :

| Vérification | Résultat |
|---|---|
| `getAssignedStageStatus(Marc)` | ✅ `'inactive'`, affectation conservée |
| Marc reste sélectionnable dans le picker | ✅ |
| Message affiché | ✅ « Votre poste habituel (Usinage) est actuellement désactivé. » |

### Reset démo (§20)

| Vérification | Résultat |
|---|---|
| Marc → Usinage | ✅ |
| Nora → Céramique | ✅ |
| Léna → Contrôle qualité | ✅ |
| Total utilisateurs | ✅ 15 |

### Congés — compteurs

| Collaborateur | Solde | Pris | En attente |
|---|---|---|---|
| Marc Dubois | 17 | 8 | 0 |
| Nora Benali | 14 | 11 | 0 |
| Thomas Girard | 11 | 14 | 0 |
| Rachid Amrani | 12 | 13 | 0 |
| Clara Vidal | 22 | 3 | 0 |
| Karim Haddad | 15 | 10 | 0 |

Aucun double comptage résiduel.

### Non-régression

Quick View centré (`qvOpen:true, sideOpen:false`), navigation + Outils,
garde de désactivation d'un poste occupé (refusé, 4 commandes concernées),
responsive mobile staff (**0 px** d'overflow horizontal en scan et congés à
390 px), portail cabinet (statut simplifié), dark mode : tous ✅.

**Erreurs console cumulées sur l'ensemble des scénarios : 0.**

---

## Definition of Done

| Critère | État |
|---|---|
| Marc affiche Usinage | ✅ |
| Nora affiche Céramique | ✅ |
| Aucun sélecteur de poste | ✅ |
| Le poste vient uniquement de `assignedStageId` | ✅ |
| Anciennes données localStorage migrées | ✅ |
| Nouveaux champs utilisateur complétés | ✅ |
| Eric/Sophie restent sans poste | ✅ |
| `staffEligibleUsers` ne masque plus les erreurs | ✅ |
| Compteurs de congés différents restaurés | ✅ |
| Refresh navigateur conserve les affectations | ✅ |
| Aucun reset obligatoire pour l'utilisateur | ✅ |
| Aucune erreur console | ✅ |
| Aucune régression | ✅ |
