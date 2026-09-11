# Kanvix V2.4.13.1 — Sauvegarde complète, restauration et continuité entre versions

Source : `public/poc/kanvix-next-gen-v2.4.13.html` → cible `public/poc/kanvix-next-gen-v2.4.13.1.html`.
L'historique métier V2.4.13 n'est pas touché : cette version ajoute un outil de continuité.

## Verdict

**PASS.** Le test déterminant a été exécuté pour de vrai, sur deux fichiers distincts : une V2.4.12.1 contenant 4 chantiers, un historique, un message, une photo et le niveau Pilotage a été sauvegardée, puis restaurée dans une V2.4.13.1 vierge — **sans perte, sans duplication, sans dérive de date**.

| Résultat | |
|---|---|
| Recette sauvegarde / continuité (`recette-backup-continuite-v2.4.13.1.mjs`) | **106 / 106** |
| Historique métier V2.4.13 | **106 / 106** |
| Timeline V2.4.12.1 | **90 / 90** |
| Historique contextualisé V2.4.12 | **106 / 106** |
| Chantiers — **FINDINGS : 0** | **48 / 48** |
| Badges Kanban | **165 / 165** |
| Autres non-régressions (8 suites) | **594 / 594** |
| **Total** | **1215 / 1215** |
| Erreurs console applicatives | **0** |

## 1. Cause de l'état vierge

Le POC persiste dans `localStorage` sous `STORE = "kanvix-product-8-3"`. Ce stockage est cloisonné **par origine**. En ouverture `file://`, deux fichiers HTML situés à des emplacements différents peuvent parfaitement disposer de zones de stockage distinctes.

Conclusion : **le nom de la clé ne garantit rien d'un fichier à l'autre**. Ouvrir une V2.4.13 fraîchement téléchargée à côté d'une V2.4.12.1 ne « perd » pas les données de cette dernière — la nouvelle copie ne les a simplement jamais vues.

C'est un problème de **transport**, pas de données. Il se résout par un fichier, pas par une astuce de clé.

## 2. Ce qui a été délibérément écarté

Conformément à la règle absolue du cahier des charges, **rien** de ce qui suit n'a été tenté :

- renommer `STORE` — inutile, le problème n'est pas le nom de la clé ;
- bumper `SCHEMA_VERSION` — aucune raison, les nouveaux champs sont optionnels ;
- balayer d'autres clés `localStorage` en espérant tomber sur un ancien état ;
- prétendre lire automatiquement le stockage d'une autre URL `file://` ;
- deviner ou reconstruire l'ancien état.

Un commentaire technique le documente dans le fichier, à l'endroit du moteur de sauvegarde, pour qu'une future évolution ne reparte pas sur cette fausse piste.

## 3. Format `kanvix-backup`

```js
{
  format: "kanvix-backup",
  backupVersion: 1,
  appVersion: "2.4.13.1",
  schemaVersion: 8,
  exportedAt: "2026-09-11T08:43:00.000Z",
  seededFor: "2026-09-11",
  state: { … }
}
```

Volontairement **distinct** de `kanvix-portable`, qui reste l'export métier. Les deux formats sont reconnaissables au premier champ lu, et un `kanvix-portable` déposé dans « Restaurer une sauvegarde » est **refusé explicitement** plutôt qu'importé en douce.

| | Exporter les données | Sauvegarder Kanvix |
|---|---|---|
| Format | `kanvix-portable` | `kanvix-backup` |
| Contenu | chantiers, tâches, modèles | **tout** l'état |
| Effet à la relecture | **intègre** dans l'existant (import intelligent) | **remplace** l'état |
| Historique inclus | non | **oui** |

## 4. Contenu de la sauvegarde

`settings` · `companyTemplates` · `projects` · `tasks` · `resources` · `issues` · `decisions` · `milestones` · `documents` · `photos` (avec leurs `dataUrl` réels) · `messages` · `history` · `seededFor` · et les préférences `ui` stables (niveau, apparence, rôle, mode conducteur, période, filtres planning, vue Gantt/Kanban).

## 5. Contenu exclu

Neutralisé à la construction, parce que le restaurer n'aurait aucun sens :

`undoStack = []` · `simulation = null` · `ui.selectedTask` · `ui.pendingTaskEdit` · `ui.pendingRework` · `ui.pendingImport` · `ui.ai.open`.

Les **préférences utilisateur utiles ne sont pas supprimées** — seul l'éphémère l'est.

**Aucune seconde clé `localStorage`** n'est créée (§48) : la sauvegarde est un fichier téléchargé, jamais une copie permanente de `app` qui doublerait le poids des photos et risquerait le quota. Vérifié par assertion.

## 6. Restauration atomique

```js
candidate = structuredClone(payload.state);
candidate.seededFor = payload.seededFor;
candidate = migrateState(candidate);      // migrations EXISTANTES
… revalidation …
app = candidate;                          // point de bascule unique
save();
```

L'état candidat est intégralement construit, migré **et revalidé** en dehors de `app`. Il n'y a **qu'une seule affectation et un seul `save()`**. En cas d'échec à n'importe quelle étape, `app` n'a jamais été touché.

Vérifié par six fichiers invalides successifs (§41-§43) : après chaque refus, l'empreinte métier complète — chantiers, tâches, ressources, incidents, décisions, jalons, documents, photos, messages, historique, réglages — est **strictement identique** à l'avant.

## 7. Validation

| Cas | Message utilisateur |
|---|---|
| JSON illisible | « Sauvegarde illisible. » |
| `format: "kanvix-portable"` | « Ce fichier est un export de données, pas une sauvegarde Kanvix complète. » |
| autre format | « Format de sauvegarde incompatible. » |
| `state` absent, `settings` absent, tableau manquant | « Sauvegarde incomplète. » |
| identifiants de chantiers en double | « Sauvegarde corrompue : chantiers en double. » |
| identifiants de tâches en double | « Sauvegarde corrompue : tâches en double. » |
| tâche référençant un chantier absent | « Sauvegarde corrompue : une tâche référence un chantier absent. » |
| annulation | « La restauration a été annulée. » |

Aucune erreur technique brute n'atteint l'utilisateur (§59).

## 8. Migration de schéma

Une sauvegarde plus ancienne repasse par **`migrateState()`**, le système de migration déjà en place — aucun second système n'a été écrit (§17).

**BACKUP-F9** fabrique une sauvegarde rétrogradée en `schemaVersion: 7`, sans `companyTemplates` et sans `resolutionPolicy` sur les incidents, puis la restaure : schéma réparé vers 8, **aucune perte** (mêmes nombres de chantiers, tâches et événements), champs manquants recréés par les migrations existantes.

## 9. `seededFor` et non-dérive des dates

`alignDemoDates(state, targetKey)` est idempotent : il calcule un delta depuis `state.seededFor`. En embarquant `seededFor` **dans la sauvegarde** et en le rétablissant **avant** `migrateState()`, le delta d'une restauration le même jour vaut exactement zéro.

**BACKUP-F10**, restauration le **même jour** — comparaison exhaustive :

| | Résultat |
|---|---|
| `tasks.start` / `tasks.end` | **identiques** |
| `milestones` | identiques |
| `documents`, `photos` | identiques |
| horodatages d'historique | identiques |
| `seededFor` | inchangé |

Restauration le **lendemain** (`?now=2026-09-12`) : `seededFor` passe à `2026-09-12` et le décalage mesuré sur la première tâche est de **+1 jour exactement** — un seul réalignement, jamais deux. L'historique, lui, n'est jamais réaligné.

## 10. Récupération V2.4.12.1

Le fichier `kanvix-next-gen-v2.4.12.1.html` a reçu **un seul ajout**, strictement en lecture : un bouton *« Exporter une sauvegarde complète »* produisant le même format `kanvix-backup` v1.

Vérification du bloc ajouté, hors commentaires — **42 lignes** — : aucun `save(`, aucun `setItem`, aucun `localStorage`, aucun `resetApp`, aucun `migrateState`, aucun `render(`. **BACKUP-F11** le confirme à l'exécution : la valeur brute de `localStorage` est **identique avant et après** l'export.

Une copie intacte est conservée : `kanvix-next-gen-v2.4.12.1.before-recovery.html`.

### Une réserve que je dois énoncer clairement

Je ne peux pas savoir, depuis ce conteneur, **où** vous aviez enregistré votre copie de V2.4.12.1. Le fichier patché ne verra vos données que s'il **remplace le fichier exact que vous ouvriez**, au même emplacement et sous le même nom — sinon son origine diffère et son `localStorage` est vide.

Je ne présente donc **pas** cette étape comme une récupération déjà effectuée : c'est une procédure, décrite dans `RECUPERATION-V2.4.12.1.md`, dont la seule action qui vous revient est de remplacer le bon fichier. Le document dit aussi, sans détour, quoi conclure si les données ne réapparaissent pas.

## 11. Test cross-file réel

**BACKUP-F11** n'est pas une simulation : il ouvre deux contextes navigateur distincts sur **deux fichiers `file://` différents**.

| Étape | Vérification |
|---|---|
| A — V2.4.12.1 | 4 chantiers, 11 tâches, historique, message, photo `dataUrl`, Pilotage, apparence sombre, tâche marqueur |
| A — export | bouton présent dans Réglages · `localStorage` **inchangé** · format `kanvix-backup` v1, `appVersion: "2.4.12.1"` |
| B — V2.4.13.1, contexte neuf | `KANVIX_HAD_PERSISTED_STATE === false` · bannière de continuité affichée · **la tâche marqueur de A est absente** — preuve directe que les deux fichiers ne partagent pas le stockage |
| B — restauration | la sauvegarde legacy est reconnue, prévisualisée, puis appliquée |
| B — après | tâche marqueur **présente** · historique intégralement récupéré · Pilotage + apparence sombre conservés · message et photo (`dataUrl`, 114 octets) récupérés · statut métier `doing` conservé · mêmes chantiers, mêmes tâches |

## 12. Historique restauré

**BACKUP-F2** : 15+ événements mêlant legacy heure-seule, transitions `task-status` structurées, incident résolu et entrée à date illisible. Après sauvegarde → `resetApp()` → restauration : **même nombre, même ordre, mêmes dates, mêmes `fromStatus`/`toStatus`, mêmes `taskId`/`projectId`/`taskName`** — comparaison JSON exhaustive.

## 13. Photos, messages, réglages

- **Photos** (§39) : `dataUrl` réel comparé caractère pour caractère — identique.
- **Messages** (§40) : texte, `read`/`unread` et `photoId` restaurés à l'identique.
- **Pilotage** (§38) : niveau `pilot` restauré, **onglet Historique visible** après restauration, préférence d'apparence conservée.

## 14. Message de continuité — non bloquant

§25 demandait un message **non bloquant**. Ma première implémentation était une modal au démarrage : elle masquait l'application et s'interposait devant tous les autres parcours. **Quatre suites gelées l'ont immédiatement révélé** (Planning Bureau, Édition, Résoudre, et les deux suites Historique) — le défaut était réel, pas un artefact de test.

Corrigé : c'est désormais une **bannière discrète** en bas d'écran, hors de `#modal`, sans overlay ni capture de focus, avec deux actions — *Continuer avec la démonstration* / *Restaurer une sauvegarde*. Les quatre suites sont repassées au vert sans qu'aucune assertion ne soit touchée.

Conditions d'affichage : `location.protocol === "file:"` **et** aucun état jamais enregistré par ce fichier. `hasPersistedKanvixState()` lit `localStorage` **avant** toute migration, de sorte qu'un `INITIAL_STATE` de démonstration n'est jamais pris pour une ancienne sauvegarde (§24).

**Aucun message sur une démo hébergée** (§26/§62) : vérifié sur `http://localhost`, y compris après rechargement — le stockage même-origine continue de fonctionner exactement comme avant.

## 15. Import intelligent et export métier intacts

**BACKUP-F12** : `exportKanvixData()` produit toujours `format: "kanvix-portable"`, **sans historique** — il n'est pas devenu une sauvegarde complète. Les moteurs `analyzeKanvixImport`, `buildImportPlan`, `applyImportPlan`, `findProjectImportMatch` et `validateImportState` sont tous présents et intacts, et la suite Import intelligent passe **75/75**.

Seuls les **sous-titres** des deux lignes métier ont été précisés (§23), pour que la différence saute aux yeux dans Réglages.

## 16. Interface

```
Données & démonstration
  Modèle d’entreprise
  Importer des données      Ajouter des chantiers et des tâches depuis un fichier d’export.
  Exporter les données      Télécharger vos chantiers et vos tâches (export métier).
  ─────────────────────────
  Sauvegarde Kanvix
  Sauvegarder Kanvix        Télécharger une copie complète de vos données et réglages.
  Restaurer une sauvegarde  Remplacer l’état actuel par une sauvegarde Kanvix.
  ─────────────────────────
  Réinitialiser la démonstration
```

`resetApp()` reste la réinitialisation volontaire de la démonstration, distincte de la restauration (§60).

La modal de restauration affiche la date de sauvegarde, la version d'origine, un résumé chiffré du contenu, l'avertissement de remplacement, et un lien discret **« Sauvegarder d'abord l'état actuel »** (§15).

## 17. Accessibilité, dark, responsive

- Toutes les lignes de Réglages sont de vrais `<button>` : focus clavier vérifié sur « Restaurer une sauvegarde ».
- L'`<input type="file">` porte un `aria-label`.
- Dark mode : le résumé de sauvegarde n'est pas un aplat blanc, contraste vérifié.
- Responsive **1920 / 1440 / 900 / 430 / 390** : workflow utilisable, boutons présents, aucun débordement, aucun scroll horizontal.

## 18. Résultats

| Test | Objet | Résultat |
|---|---|---|
| BACKUP-F1 | Round-trip complet : 13 clés métier comparées | **PASS** |
| BACKUP-F2 | Historique legacy + structuré : ordre, dates, transitions | **PASS** |
| BACKUP-F3 | Niveau Pilotage, onglet Historique, apparence | **PASS** |
| BACKUP-F4 | Photo `dataUrl` identique | **PASS** |
| BACKUP-F5 | Messages : texte, read/unread, photoId | **PASS** |
| BACKUP-F6 | JSON invalide → « Sauvegarde illisible », état intact | **PASS** |
| BACKUP-F7 | `kanvix-portable` refusé explicitement | **PASS** |
| BACKUP-F8 | 4 sauvegardes incomplètes/corrompues refusées, état intact | **PASS** |
| BACKUP-F9 | Schéma 7 → migrations existantes, aucune perte | **PASS** |
| BACKUP-F10 | Dates : aucune dérive le même jour, +1 exactement le lendemain | **PASS** |
| BACKUP-F11 | **Continuité cross-file réelle V2.4.12.1 → V2.4.13.1** | **PASS** |
| BACKUP-F12 | Import intelligent et export métier inchangés | **PASS** |
| HTTP | Démo hébergée : aucun message, stockage inchangé | **PASS** |
| UI | Réglages, clavier, dark, responsive 1920→390 | **PASS** |
| ANNULATION | « Annuler » laisse l'état strictement intact | **PASS** |
| PURETE | `buildKanvixBackup()` ne mute rien, aucune 2ᵉ clé | **PASS** |
| SCHEMA | `STORE` et `SCHEMA_VERSION` inchangés | **PASS** |

**106 assertions, 106 PASS.**

## 19. Non-régressions

Historique métier **106/106** · Timeline **90/90** · Historique contextualisé **106/106** · Chantiers **48/48** (0 finding) · Badges Kanban **165/165** · Accueil **149/149** · Mode Chantier **95/95** · Planning Bureau **76/76** (PLAN-F 30 assertions) · Import **75/75** · Réglages **63/63** · Édition **58/58** · UI responsive **47/47** · ancien Planning **17/17** · Résoudre **14/14**.

**Une assertion de la suite Réglages a été ajustée** : elle figeait le sous-titre exact de « Exporter les données », que le §23 demandait justement de préciser. L'assertion vérifie désormais que la ligne existe, télécharge bien quelque chose et reste une action métier — sans figer la formulation. Elle passe **63/63 sur V2.4.7 comme sur V2.4.13.1**.

`STORE` inchangé (`kanvix-product-8-3`), `SCHEMA_VERSION` inchangé (**8**), aucune migration ajoutée. L'historique métier V2.4.13, la timeline, le rattachement chantier, le Planning, le Kanban et le cycle de vie ne sont pas touchés.

## 20. Erreurs console

**0 erreur JavaScript applicative** sur la recette de sauvegarde et l'ensemble des suites rejouées.

## Procédure utilisateur — 4 étapes

1. **Remplacez** votre ancien `kanvix-next-gen-v2.4.12.1.html` par celui livré ici, **au même emplacement et sous le même nom**.
2. Ouvrez-le → **Réglages → Exporter une sauvegarde complète**.
3. Ouvrez **V2.4.13.1**.
4. **Réglages → Restaurer une sauvegarde** → choisissez le JSON → **Restaurer**.

Détails et cas d'échec dans `RECUPERATION-V2.4.12.1.md`.

## Question finale

> « Puis-je désormais passer d'un fichier Kanvix à une version plus récente sans perdre l'historique ni aucune autre donnée du POC ? »

**OUI.** Deux clics avant, deux clics après. Le test cross-file l'a exécuté pour de vrai : chantiers, tâches, ressources, incidents, documents, photos, messages, historique complet avec ses transitions, et niveau Pilotage — tout est arrivé de l'autre côté, sans dérive de date ni erreur console.

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.13.1.html` — fichier complet.
2. `recette-backup-continuite-v2.4.13.1.mjs` — suite (106 vérifications).
3. `rapport-recette-backup-continuite-v2.4.13.1.md` — ce rapport.
4. `RECUPERATION-V2.4.12.1.md` — procédure de récupération.
5. `public/poc/kanvix-next-gen-v2.4.12.1.html` — patché, lecture seule.
6. `public/poc/kanvix-next-gen-v2.4.12.1.before-recovery.html` — copie intacte.
7. Captures : `recette-backup-v2.4.13.1/` (01→06).
