# Planzy — Checklist dataset de démonstration

**À utiliser** : avant et après l'exécution du script `DEMO_DATASET_SQL_DRAFT.sql`

---

## Avant exécution

### Prérequis techniques

- [ ] Identifier l'UUID du compte démo :
  ```sql
  SELECT id, email FROM auth.users WHERE email = 'votre@email.demo';
  ```
- [ ] Remplacer **toutes** les occurrences de `:USER_ID` dans `DEMO_DATASET_SQL_DRAFT.sql`
- [ ] Vérifier que l'organisation démo existe :
  ```sql
  SELECT id, name FROM public.organizations WHERE id = '11111111-1111-1111-1111-111111111111';
  ```
- [ ] Vérifier l'existence de la colonne `artisans.is_archived` :
  ```sql
  SELECT column_name FROM information_schema.columns
    WHERE table_name = 'artisans' AND column_name = 'is_archived';
  ```
  → Si vide : retirer les lignes UPDATE commentées dans le script.
- [ ] Vérifier les colonnes de la table `teams` (certaines peuvent ne pas exister) :
  ```sql
  SELECT column_name FROM information_schema.columns WHERE table_name = 'teams';
  ```
- [ ] Vérifier qu'il n'y a pas déjà des données `[DEMO]` en base (exécution antérieure) :
  ```sql
  SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';
  ```
  → Si > 0 : soit exécuter le rollback d'abord, soit laisser (ON CONFLICT DO NOTHING)

### Prérequis photos et documents

- [ ] Uploader 5 photos dans Supabase Storage (bucket `photos`) pour remplacer les URLs placeholder
- [ ] Uploader 3 documents dans Supabase Storage (bucket `documents`) pour remplacer les URLs placeholder
- [ ] Remplacer les URLs `https://placeholder.demo/...` dans le script avant exécution
  (ou uploader manuellement depuis l'interface après l'insertion des métadonnées)

---

## Après exécution — Validation en base

### Comptages attendus

```sql
SELECT COUNT(*) FROM public.projects WHERE org_id = '11111111-1111-1111-1111-111111111111' AND name LIKE '[DEMO]%';
-- Attendu : 5
```

```sql
SELECT COUNT(*) FROM public.artisans WHERE org_id = '11111111-1111-1111-1111-111111111111' AND notes LIKE 'DEMO_PLANZY_DATASET%';
-- Attendu : 6
```

```sql
SELECT COUNT(*) FROM public.teams WHERE org_id = '11111111-1111-1111-1111-111111111111' AND name LIKE '[DEMO]%';
-- Attendu : 2
```

```sql
SELECT COUNT(*) FROM public.team_members
  WHERE team_id IN ('c1c1c1c1-0001-0001-0001-000000000001', 'c2c2c2c2-0002-0002-0002-000000000002');
-- Attendu : 4
```

```sql
SELECT COUNT(*) FROM public.tasks WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Attendu : ≥ 15 (peut inclure des tâches pré-existantes)
```

```sql
SELECT COUNT(*) FROM public.issues WHERE title LIKE '[DEMO]%';
-- Attendu : 4
```

```sql
SELECT COUNT(*) FROM public.photos WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Attendu : ≥ 5
```

```sql
SELECT COUNT(*) FROM public.documents WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- Attendu : ≥ 3
```

```sql
SELECT COUNT(*) FROM public.reports WHERE title LIKE '[DEMO]%';
-- Attendu : 2
```

### Vérifications métier critiques

- [ ] La tâche "Terrassement" P3 est bien en retard :
  ```sql
  SELECT id, title, status, end_date FROM public.tasks
    WHERE id = 'd3a3d3a3-0003-0003-0003-000000000001';
  -- end_date doit être < CURRENT_DATE, status = 'in_progress'
  ```

- [ ] Pierre Martin est affecté sur 2 projets simultanément :
  ```sql
  SELECT t.title, p.name FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.assigned_to = 'b2b2b2b2-0002-0002-0002-000000000002'
      AND t.status NOT IN ('done', 'validated');
  -- Doit retourner tâches sur P1 ET P4
  ```

- [ ] Les réserves critiques sont visibles :
  ```sql
  SELECT title, priority, status FROM public.issues
    WHERE priority = 'critical' AND org_id = '11111111-1111-1111-1111-111111111111';
  -- Attendu : I1.2 "Humidité sous-sol" + I4.1 "Infiltration fenêtre classe 3"
  ```

- [ ] Les photos liées aux réserves ont bien `issue_id` non null :
  ```sql
  SELECT id, caption, issue_id FROM public.photos
    WHERE issue_id IS NOT NULL AND org_id = '11111111-1111-1111-1111-111111111111';
  -- Attendu : 3 photos (PH1, PH2, PH4)
  ```

- [ ] Le thread de messagerie P1 a bien 3 messages :
  ```sql
  SELECT COUNT(*) FROM public.messages
    WHERE thread_id = 'f1f1f1f1-0001-0001-0001-000000000001';
  -- Attendu : 3
  ```

---

## Validation par écran

| Page | Test rapide | Résultat attendu |
|------|-------------|-----------------|
| `/` Dashboard | KPI chantiers actifs | 5 |
| `/` Dashboard | KPI alertes | ≥ 4 |
| `/chantiers` | Nombre de cartes | 5 |
| `/chantiers` | Badge rouge/risque | P1 + P4 |
| `/chantiers/[P1]` | Messagerie non vide | 3 messages |
| `/chantiers/[P1]` | Tâche bloquée visible | "Pose fenêtres" |
| `/planning` | Barre dans le passé | T3.1 Terrassement |
| `/equipes` | Badge Multi-affecté | Pierre Martin |
| `/equipes` | Badge Disponible | Karim Benali |
| `/documents` | KPI réserves liées | 3 |
| `/documents` | Photos avec badge | PH1, PH2, PH4 |
| `/rapports` | KPI alertes critiques | ≥ 2 |
| `/rapports` | Historique rapports | 2 entrées |

---

## Si un écran est vide après exécution

1. Vérifier que `:USER_ID` a bien été remplacé (sinon FK viole RLS ou contrainte)
2. Vérifier que le compte connecté a bien `org_id = '11111111-1111-1111-1111-111111111111'` dans `profiles`
3. Vérifier les logs Supabase pour des erreurs d'insertion silencieuses (ON CONFLICT masque les duplicates mais pas les erreurs de type)
4. Relire la section "Vérification post-insertion" en bas de `DEMO_DATASET_SQL_DRAFT.sql`
