# Planzy — Plan d'exécution du dataset de démonstration

**Statut :** Plan approuvé — exécution conditionnée à un ordre explicite.  
**Script à exécuter :** `DEMO_DATASET_SQL_READY.sql`  
**Rollback :** `DEMO_DATASET_ROLLBACK.sql`

---

## 1. Préconditions obligatoires

Avant toute exécution, les conditions suivantes doivent être réunies :

| Condition | Vérification |
|-----------|-------------|
| Compte démo identifié | `SELECT id FROM auth.users WHERE email = 'demo@planzy.app'` |
| Organisation démo présente | `SELECT id FROM public.organizations WHERE id = '11111111-...'` |
| Profil démo rattaché à l'org | `SELECT org_id FROM public.profiles WHERE id = ':USER_ID'` |
| Rôle ≥ manager | `SELECT role FROM public.profiles WHERE id = ':USER_ID'` (owner/admin/manager) |
| Aucune donnée DEMO existante | `SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%'` → 0 |
| RLS Supabase : accès via service_role | Exécuter depuis Supabase Studio (SQL Editor) ou Supabase CLI avec service_role |

---

## 2. Compte démo recommandé

| Critère | Valeur recommandée |
|---------|-------------------|
| Email | `demo@planzy.app` |
| Mot de passe | À définir — stocker en lieu sûr |
| Rôle | `owner` ou `admin` dans l'org `11111111-1111-1111-1111-111111111111` |
| Données | Toujours réinitialisables via rollback |
| Usage | Démos commerciales uniquement — jamais de données réelles |

**Si le compte n'existe pas :**
1. Créer le compte via Supabase Auth → Authentication → Users → Invite user
2. Ou via l'interface d'inscription Planzy
3. Vérifier que le trigger `handle_new_user()` a créé le profil dans `profiles`
4. Vérifier que le profil a `org_id = '11111111-1111-1111-1111-111111111111'`
5. Mettre à jour le rôle si nécessaire : `UPDATE public.profiles SET role = 'owner' WHERE id = ':USER_ID'`

---

## 3. USER_ID / ORG_ID

| Variable | Valeur | Source |
|----------|--------|--------|
| `:USER_ID` | À déterminer | `SELECT id FROM auth.users WHERE email = 'demo@planzy.app'` |
| `ORG_ID` | `11111111-1111-1111-1111-111111111111` | Fixe — bootstrap migration |

**Remplacement dans le script :**
Chercher-remplacer `:USER_ID` par l'UUID réel dans `DEMO_DATASET_SQL_READY.sql` avant exécution.

---

## 4. Colonnes validées

| Table | Colonne | Statut | Source de vérification |
|-------|---------|--------|----------------------|
| `artisans` | `is_archived` | ✅ EXISTS — boolean, default false | `database.types.ts` ligne 71 |
| `documents` | `storage_path` | ✅ EXISTS — text nullable | `database.types.ts` ligne 191 |
| `photos` | `storage_path` | ✅ EXISTS — text nullable | `database.types.ts` ligne 573 |
| `messages` | type `decision` | ✅ VALIDE — ajouté par migration | `20260522_messages_decision_type_and_linked_task.sql` |
| `messages` | `linked_task_id` | ✅ EXISTS — nullable | migration 20260522 |
| `tasks` | `completed_at` | ✅ EXISTS — nullable | migration 20260524 |
| `profiles` | `artisan_id` | ✅ EXISTS — nullable | migration 20260517 |
| `projects` | toutes colonnes | ✅ Conformes | schema.sql |
| `tasks` | toutes colonnes | ✅ Conformes (y compris `assigned_team`) | database.types.ts ligne 870 |
| `issues` | toutes colonnes | ✅ Conformes | schema.sql + database.types.ts |
| `reports` | toutes colonnes | ✅ Conformes | schema.sql |
| `team_members` | toutes colonnes | ✅ Conformes | schema.sql |

---

## 5. Colonnes à vérifier manuellement avant exécution

| Table | Colonnes | Requête de vérification | Action si absent |
|-------|----------|------------------------|-----------------|
| `teams` | `type`, `project_id`, `description` | `SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' ORDER BY ordinal_position;` | Utiliser Variant A (déjà dans SQL_READY) |
| `artisans` | `is_archived` (double contrôle) | `SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'artisans' AND column_name = 'is_archived';` | Retirer is_archived du INSERT |

**Note sur `teams.type` :**
- `database.types.ts` ne liste pas ces colonnes
- Le code de `equipes/page.tsx` les requête (`select('... type, project_id, description ...')`)
- Si le code fonctionne en production, les colonnes existent — mais le fichier de types n'a pas été régénéré
- En cas de doute : utiliser Variant A (INSERT sans ces colonnes), l'application affichera `type ?? 'libre'`

---

## 6. Enums et valeurs validées

| Table.colonne | Valeurs dans le script | Conformité |
|---------------|----------------------|------------|
| `projects.status` | `'active'` | ✅ `project_status` enum |
| `tasks.status` | `'todo'`, `'in_progress'`, `'blocked'`, `'done'` | ✅ `task_status` enum |
| `issues.status` | `'open'`, `'assigned'` | ✅ `issue_status` enum |
| `issues.priority` | `'high'`, `'critical'`, `'medium'` | ✅ CHECK constraint |
| `tasks.priority` | `'low'`, `'medium'`, `'high'` | ✅ CHECK constraint |
| `messages.type` | `'tache_terminee'`, `'livraison_absente'`, `'decision'` | ✅ (decision via migration 20260522) |
| `message_threads.type` | `'project'` | ✅ CHECK constraint |
| `reports.type` | `'weekly'`, `'monthly'` | ✅ CHECK constraint |

---

## 7. Ordre d'exécution et dépendances FK

```
SECTION 0  — Vérifications préalables (SELECT)
SECTION 1  — projects          → FK: organizations ✓ (existante)
SECTION 2  — artisans          → FK: organizations ✓
SECTION 3  — teams             → FK: organizations ✓, artisans ✓ (lead_id)
SECTION 4  — team_members      → FK: teams ✓, artisans ✓
SECTION 5  — tasks (x15)       → FK: projects ✓, organizations ✓, artisans ✓, teams ✓
SECTION 6  — issues            → FK: projects ✓, organizations ✓, artisans ✓
SECTION 7  — photos            → FK: projects ✓, organizations ✓, issues ✓
SECTION 8  — documents         → FK: projects ✓, organizations ✓
SECTION 9  — message_threads   → FK: projects ✓, organizations ✓
SECTION 10 — messages          → FK: message_threads ✓, projects ✓
SECTION 11 — reports           → FK: projects ✓ (nullable), organizations ✓
SECTION 12 — Vérifications post-insertion (SELECT)
```

Toutes les FK sont satisfaites dans cet ordre. L'organisation et les profils sont pré-existants.

---

## 8. Atomicité et idempotence

- **Transaction** : `BEGIN; ... COMMIT;` — en cas d'erreur sur une section, tout est annulé
- **Idempotence** : `ON CONFLICT (id) DO NOTHING` sur toutes les tables sauf `team_members`
  - `team_members` : `ON CONFLICT (team_id, artisan_id) DO NOTHING`
  - Le script peut être réexécuté sans dupliquer les données
- **Exception** : si `BEGIN` réussit mais `COMMIT` échoue → base propre (rollback automatique)

---

## 9. Limitation photos/documents : URLs placeholder

**Comportement attendu avec les URLs placeholder :**

Les pages `/documents` et `/rapports/[id]` tentent de générer des URLs signées depuis `storage_path`.  
Comme `storage_path = NULL`, l'app tombe en fallback sur `file_url` / `url` directement.  
Les URLs `https://placeholder.demo/...` ne pointeront pas vers des images réelles → images cassées.

**Impact sur la démo :**
- KPI et badges "Réserve" s'afficheront correctement (données en base)
- Les galeries photos montreront les vignettes mais avec images brisées
- Les documents listeront les fichiers mais sans prévisualisation

**Pour une démo avec photos réelles (optionnel) :**
1. Uploader 5 images dans Supabase Storage → bucket `photos`
2. Uploader 3 PDFs dans Supabase Storage → bucket `documents`
3. Remplacer les URLs et `storage_path` dans le script avant exécution
4. Format storage_path : `org_id/filename.ext` (convention Planzy)

---

## 10. Plan rollback

En cas de problème après insertion, exécuter `DEMO_DATASET_ROLLBACK.sql` section par section.

**Ordre de suppression (FK inverse) :**
```
1. reports           (aucun enfant FK)
2. messages          (par UUIDs fixes + fallback thread_id)
3. message_threads
4. documents
5. photos
6. issues            (photos.issue_id SET NULL → pas de blocage)
7. tasks             (task_dependencies CASCADE automatique)
8. team_members
9. teams
10. artisans
11. projects
```

**Garanties du rollback :**
- Seuls les enregistrements avec UUIDs fixes `[a-i,m]` sont supprimés
- L'organisation et les profils ne sont pas touchés
- Les données pré-existantes (hors DEMO) ne sont pas affectées

---

## 11. Critères GO / NO GO avant exécution

| Critère | GO | NO GO |
|---------|-----|-------|
| USER_ID remplacé dans le script | ✅ | ❌ Arrêt |
| Compte démo existe avec bon org_id | ✅ | ❌ Créer le compte d'abord |
| Rôle ≥ manager | ✅ | ❌ Mettre à jour le rôle |
| Aucune donnée `[DEMO]` existante | ✅ | ❌ Exécuter rollback d'abord |
| teams.type vérifié | ✅ (variant choisi) | ❌ Vérifier manuellement |
| Exécution depuis SQL Editor Supabase | ✅ | ❌ (RLS peut bloquer les inserts depuis client JS) |

**Recommandation d'exécution :** Supabase Studio → SQL Editor → coller le contenu complet → Run.

---

## 12. Résumé des fichiers

| Fichier | Rôle | À exécuter ? |
|---------|------|--------------|
| `DEMO_DATASET_SQL_READY.sql` | Script corrigé + atomique | Sur ordre explicite uniquement |
| `DEMO_DATASET_ROLLBACK.sql` | Suppression ciblée [DEMO] | Sur ordre explicite uniquement |
| `DEMO_DATASET_SQL_DRAFT.sql` | Version brouillon (archivé) | Non — utiliser SQL_READY |
| `DEMO_DATASET_PLAN.md` | Vue d'ensemble | Documentation |
| `DEMO_DATASET_MAPPING_ECRANS.md` | Données ↔ écrans | Documentation |
| `DEMO_DATASET_CHECKLIST.md` | Validation post-insertion | Documentation |
| `DEMO_DATASET_EXECUTION_PLAN.md` | Ce fichier | Documentation |
| `DEMO_DATASET_EXECUTION_CHECKLIST.md` | Checklist courte | Documentation |
