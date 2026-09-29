# RAPPORT — KANVIX V2.12.2.1 — CERTIFICATION

**Modèle utilisé pour cette mission : Claude Sonnet 5** (`claude-sonnet-5`), exclusivement. Aucun sous-agent utilisé.

Aucun lot fonctionnel commencé. Aucune décision produit R2-R4 modifiée. Deux insuffisances de VALIDATION corrigées.

---

## 1. Insuffisance n°1 — État Artisan historique

### Audit

`app = migrateState(load())` est le point d'entrée unique exécuté à l'ouverture du fichier, avant tout rendu. Aucune normalisation de `settings.role`/`ui.page` n'y existait. Un état persistant écrit sous V2.12.1 (ou antérieur) avec `settings.role: "artisan"` et `ui.page: "artisan"` — produit par `setRole('artisan')`, qui pose les DEUX champs (V2.12.1, lignes 31827-31828) — traversait donc la migration inchangé. Sans le sélecteur retiré en R3, l'utilisateur atterrissait dans la conversation Artisan sans aucune commande de retour visible.

Trois consommateurs de `migrateState()` identifiés et vérifiés : le chargement initial (`let app = migrateState(load())`), la restauration de sauvegarde (`confirmKanvixRestore()`, qui migre puis ADOPTE `candidate.settings`), et la synchronisation inter-onglets (`applyStorageSync()`, qui migre `incoming` mais **conserve délibérément** les `settings`/`ui` de l'onglet courant — donc jamais affecté par un rôle hérité d'un AUTRE onglet, par conception déjà en place). L'import (`applyImportPlan`) ne transporte aucune donnée `settings` : rien à y normaliser.

### Correctif

Deux lignes ajoutées dans `migrateState()`, juste après la ligne équivalente déjà existante (« le mode Expert est fusionné dans Pilotage ») :

```js
if (value.settings.role === "artisan") value.settings.role = "driver";
if (value.ui.page === "artisan") value.ui.page = "today";
```

Même convention que le précédent immédiat (`expert → pilot`) : un ancien état bascule silencieusement vers l'état sûr actuel, à la migration, sans toucher à la moindre donnée métier. `setRole()` et `renderArtisan()` ne sont pas touchées.

### Preuve

Recette `recette-corrective-v2.12.2.1.mjs`, assertions `ROLE-RECOVER-01` à `06` :

1. **ROLE-RECOVER-01** — l'état de test est produit en JOUANT RÉELLEMENT `setRole('artisan')` sur le VRAI fichier `kanvix-next-gen-v2.12.1.html` (pas une donnée reconstituée à la main) : `settings.role="artisan"`, `ui.page="artisan"` confirmés.
2. **ROLE-RECOVER-02/03** — ce localStorage est injecté (`page.addInitScript`, avant tout script de la page) dans un contexte neuf, puis `kanvix-next-gen-v2.12.2.1.html` est chargé pour de vrai. Résultat : `role="driver"`, `page="today"`, page DOM active `#today`, page « Bonjour » affichée, aucune trace de la conversation Artisan.
3. **ROLE-RECOVER-04** — projets (4), tâches (11), messages (2), photos (6) strictement identiques avant/après ; niveau, apparence, ressource artisan de référence et ressource conducteur de référence également strictement identiques (seuls `role`/`page` hérités sont corrigés).
4. **ROLE-RECOVER-05** — `setRole("artisan")` appelé dans une recette continue de rendre intégralement la conversation Artisan (mission, fil, composeur) : la vue elle-même n'est pas cassée, seule l'affordance UI historique est retirée.
5. **ROLE-RECOVER-06** — un état V2.12.1 déjà en rôle `driver` (le cas normal, très majoritaire) traverse la migration sans aucun changement de comportement — non-régression du chemin nominal.

---

## 2. Insuffisance n°2 — Rejeu réel de la recette V2.12.1

### Constat

La recette V2.12.2 lançait `recette-preparer-decalage-v2.12.1.mjs` **telle quelle**, avec son propre `CUR = 'kanvix-next-gen-v2.12.1.html'` : le résultat « 77/77 » attestait donc du comportement de V2.12.1, pas de V2.12.2.

### Méthode

`recette-corrective-v2.12.2.1.mjs` :
1. Lit le texte source de `recette-preparer-decalage-v2.12.1.mjs`.
2. Remplace **uniquement** la ligne `const CUR = 'kanvix-next-gen-v2.12.1.html';` par `const CUR = 'kanvix-next-gen-v2.12.2.1.html';` (vérifié : 1 seule ligne différente sur 1133).
3. Écrit cette copie dans un dossier temporaire, l'exécute avec `node` (process réel, séparé), et récupère l'intégralité de sa sortie standard.
4. Relaie **individuellement** chacune des 77 lignes d'assertion (`✓`/`✗ [SECTION] texte`) sous ses propres assertions `REJEU-<SECTION>` — jamais agrégées.
5. Supprime le dossier temporaire. **`recette-preparer-decalage-v2.12.1.mjs` n'a jamais été modifiée sur disque.**

### Résultat réel, non arrondi

```
Fichier réellement testé par le rejeu : kanvix-next-gen-v2.12.2.1.html
RÉSULTAT DU REJEU : 74 / 77
ERREURS CONSOLE APPLICATIVES (rejeu) : 0
```

**74 assertions comportementales passent** — l'intégralité du contrat « Préparer un décalage » (éligibilité, calcul, propagation, calendrier, conflits ressources/dépendances, jalons, état périmé, validation, transaction/historique, Undo/Redo, communications, responsive, clavier) sur `kanvix-next-gen-v2.12.2.1.html` lui-même.

**3 assertions échouent, exhaustivement isolées et non recomptées comme des régressions :**

| Assertion | Cause exacte | Origine |
|---|---|---|
| `DECAL-70` — migrateState() byte-identique | `migrateState()` a été modifiée **par cette certification elle-même** (§1) | V2.12.2.1 |
| `FREEZE-2121` — aucune autre fonction modifiée hors openTask() | 8 fonctions R2-R4 (`renderMore`, `renderUserMenu`, `renderArtisan`, `renderSites`, `sitesModeSwitch`, `renderOperation`, `renderPlanning`, `projectStructureTab`) + `migrateState` apparaissent en « hors périmètre » — la recette V2.12.1 ne pouvait pas les connaître | V2.12.2 + V2.12.2.1 |
| `FREEZE-2121` — feuille de style byte-identique | Retrait volontaire de `.role-card`/`.role-grid`/`.settings-grid`/`.settings-intro` (R3) | V2.12.2 |

L'assertion `DECAL-REJEU-ISOLATION` (recette corrective) vérifie **programmatiquement** — pas seulement par lecture — que l'ensemble « hors périmètre » retourné par le rejeu est **exactement égal** (ni plus, ni moins) à `{migrateState, renderOperation, sitesModeSwitch, renderSites, projectStructureTab, renderPlanning, renderMore, renderArtisan, renderUserMenu}`, et qu'aucune autre assertion, sur les 77, n'a échoué. **Zéro fonction inattendue, donc zéro régression cachée.**

**Aucune assertion n'a été supprimée, affaiblie, ni convertie en contrôle agrégé.** Les 77 résultats individuels figurent dans `recette-v2.12.2.1/resultats.json` (clé `results`, préfixe `REJEU-`) et dans `recette-v2.12.2.1/decal-rejeu-sortie-brute.txt` (sortie brute complète du process réellement exécuté).

---

## 3. Périmètre gelé — vérifié, pas seulement déclaré

`FREEZE-21221` (recette corrective) compare **tout** `kanvix-next-gen-v2.12.2.html` à **tout** `kanvix-next-gen-v2.12.2.1.html`, fonction par fonction (balayage `md5` exhaustif) :

- **1 seule fonction modifiée : `migrateState`.** 0 ajoutée, 0 supprimée.
- **57 moteurs gelés vérifiés byte-identiques**, dont les 14 fonctions transactionnelles de « Préparer un décalage », `planReflow`/`applyReflowPlan`/`planScheduleChanges`, le calendrier (`addBusinessDays`/`addWorkingDuration`/`nextWorkingTime`/`nonWorkingDaysInRange`), Undo/Redo/communications (`snapshot`/`undo`/`redo`/`cloneHistoryState`/`restoreHistoryState`/`preserveCommunications`/`invalidateRedo`), `setTaskStatus`, `scenarioOptions`/`showWhatIf`, la messagerie, le moteur Structure (`getProjectStructure`/`openStructureForm`/`toggleStructureArchive`) et le moteur Opérations (`renderOperationsList`/`operationCard`/`getOperationSummary`/`selectOperation`).
- Feuille de style **byte-identique** entre V2.12.2 et V2.12.2.1 (cette certification ne change rien de visible).
- `INITIAL_STATE` et `SCHEMA_VERSION` (15) **inchangés**.

Aucun lot R5/R6/R7 commencé. Aucune fusion des parcours de décalage entreprise.

---

## 4. Résultats chiffrés consolidés

```
recette-corrective-v2.12.2.1.mjs
RÉSULTAT : 95 / 98
ERREURS CONSOLE APPLICATIVES : 0
```

Décomposition :
- **21 assertions propres à cette certification** (ROLE-RECOVER-01→06, DECAL-REJEU × 5, DECAL-REJEU-ISOLATION × 4, FREEZE-21221 × 5, + contrôle console) : **21/21**.
- **77 assertions relayées individuellement du rejeu réel contre V2.12.2.1** : **74/77**, les 3 différences précisément isolées ci-dessus (§2), aucune régression réelle.

**0 erreur console applicative** sur l'ensemble (certification + rejeu).

---

## 5. Fichier réellement testé par chaque recette

| Recette | Fichier réellement chargé (`CUR`) |
|---|---|
| `recette-corrective-v2.12.2.1.mjs` (elle-même) | `kanvix-next-gen-v2.12.2.1.html` |
| Copie temporaire du rejeu (générée puis effacée) | `kanvix-next-gen-v2.12.2.1.html` |
| `recette-preparer-decalage-v2.12.1.mjs` (originale, non modifiée, non exécutée par ce round) | `kanvix-next-gen-v2.12.1.html` (référence historique intacte) |

---

## 6. Limites restantes

- La correction ne couvre que `settings.role`/`ui.page`. Aucun autre champ de `settings`/`ui` n'a jamais porté de sélecteur de rôle de démonstration (vérifié à l'audit, §1).
- `applyStorageSync()` migre l'état entrant mais écrase toujours `settings`/`ui` par ceux de l'onglet courant (comportement pré-existant, non modifié) : la normalisation y agit par construction mais n'est jamais le facteur déterminant de ce chemin.
- Les 3 échecs isolés (§2) resteront affichés à chaque futur rejeu de `recette-preparer-decalage-v2.12.1.mjs` tant que cette recette historique n'est pas elle-même mise à jour pour connaître les changements R2-R4/V2.12.2.1 — non fait ici, conformément à l'interdiction explicite de modifier la recette originale.

## 7. Livrables

1. `public/poc/kanvix-next-gen-v2.12.2.1.html` — fichier complet.
2. `recette-corrective-v2.12.2.1.mjs` — recette corrective (95/98 ; dont 74/77 assertions réellement relayées du rejeu V2.12.1, 3 différences isolées et expliquées, 0 régression).
3. `RAPPORT-V2.12.2.1-CERTIFICATION.md` — ce rapport.
4. `recette-v2.12.2.1/resultats.json` — résultats chiffrés complets (y compris le détail du rejeu).
5. `recette-v2.12.2.1/decal-rejeu-sortie-brute.txt` — sortie brute intégrale du rejeu réel contre V2.12.2.1.
6. `recette-v2.12.2.1/decal-v21221/` — captures produites pendant le rejeu réel sur V2.12.2.1 (panneau « Préparer un décalage », 390 px clair et 1440 px sombre).
