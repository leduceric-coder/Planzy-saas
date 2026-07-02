# Planzy — Checklist d'exécution courte

**Script :** `DEMO_DATASET_SQL_READY.sql`  
**Via :** Supabase Studio → SQL Editor

---

## AVANT exécution

- [ ] **USER_ID confirmé**
  ```sql
  SELECT id, email FROM auth.users WHERE email = 'demo@planzy.app';
  ```
  → Copier l'UUID et remplacer `:USER_ID` dans `DEMO_DATASET_SQL_READY.sql`

- [ ] **ORG_ID confirmé**
  ```sql
  SELECT id, name FROM public.organizations WHERE id = '11111111-1111-1111-1111-111111111111';
  ```
  → Doit retourner "Planzy Test"

- [ ] **Profil démo rattaché à l'org avec rôle ≥ manager**
  ```sql
  SELECT id, role, org_id FROM public.profiles WHERE id = ':USER_ID';
  ```
  → `org_id` = `11111111-...`, `role` IN ('owner','admin','manager')

- [ ] **Aucune donnée DEMO existante**
  ```sql
  SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';
  ```
  → Attendu : 0 (sinon exécuter `DEMO_DATASET_ROLLBACK.sql` d'abord)

- [ ] **Colonnes teams vérifiées** (section 0.6 de `SQL_READY`)
  ```sql
  SELECT column_name FROM information_schema.columns
    WHERE table_name = 'teams' ORDER BY ordinal_position;
  ```
  → Si `type` absent : Variant A utilisé par défaut ✓
  → Si `type` présent : décommenter Variant B dans `SQL_READY`

- [ ] **Rollback prêt** — `DEMO_DATASET_ROLLBACK.sql` ouvert dans un onglet séparé

- [ ] **Aucun client réel** dans l'org `11111111-1111-1111-1111-111111111111`

---

## PENDANT exécution

Exécuter `DEMO_DATASET_SQL_READY.sql` depuis Supabase SQL Editor :

- [ ] Section 0 (vérifications) — exécutées séparément avant
- [ ] `BEGIN;` — démarrage transaction
- [ ] Section 1 : 5 projects → vérifier "5 rows affected"
- [ ] Section 2 : 6 artisans → vérifier "6 rows affected"
- [ ] Section 3 : 2 teams → vérifier "2 rows affected"
- [ ] Section 4 : 4 team_members → vérifier "4 rows affected"
- [ ] Section 5 : 15 tasks → vérifier "15 rows affected" (total des 5 blocs)
- [ ] Section 6 : 4 issues → vérifier "4 rows affected"
- [ ] Section 7 : 5 photos → vérifier "5 rows affected"
- [ ] Section 8 : 3 documents → vérifier "3 rows affected"
- [ ] Section 9 : 1 thread → vérifier "1 row affected"
- [ ] Section 10 : 3 messages → vérifier "3 rows affected"
- [ ] Section 11 : 2 reports → vérifier "2 rows affected"
- [ ] `COMMIT;` — validation de la transaction
- [ ] **Si erreur à une section** : ne pas continuer, vérifier le message d'erreur → le ROLLBACK automatique annule tout

---

## APRÈS exécution

### Vérifications base

- [ ] Compter les enregistrements (section 12 de `SQL_READY`)
  - projects : 5
  - artisans : 6
  - teams : 2
  - team_members : 4
  - tasks : 15
  - issues : 4
  - photos : 5
  - documents : 3
  - messages : 3
  - reports : 2

- [ ] Tâche en retard visible :
  ```sql
  SELECT title, status, end_date FROM public.tasks
    WHERE id = 'd3a3d3a3-0003-0003-0003-000000000001';
  ```
  → `status = 'in_progress'`, `end_date < CURRENT_DATE` ✓

- [ ] Conflit Pierre Martin :
  ```sql
  SELECT p.name FROM public.tasks t JOIN public.projects p ON t.project_id = p.id
    WHERE t.assigned_to = 'b2b2b2b2-0002-0002-0002-000000000002'
      AND t.status NOT IN ('done','validated');
  ```
  → Doit retourner 2 projets différents ✓

### Vérifications interface

- [ ] Ouvrir `/` Dashboard → KPI non nuls (≥ 4 alertes, 5 chantiers)
- [ ] Ouvrir `/chantiers` → 5 cartes, P1 et P4 en rouge/risque
- [ ] Ouvrir `/chantiers/[id-P1]` → onglet Messagerie → 3 messages visibles
- [ ] Ouvrir `/planning` → barre T3.1 dans le passé
- [ ] Ouvrir `/equipes` → Pierre Martin en badge Multi-affecté, Karim en Disponible
- [ ] Ouvrir `/documents` → KPI réserves = 3, photos avec badge Réserve
- [ ] Ouvrir `/rapports` → KPI critiques ≥ 2, historique = 2 rapports

### Test démo 5 min

- [ ] Scénario complet viable (voir `PLANZY_DEMO_SCENARIO_5_MIN.md`)
- [ ] Aucune page vide
- [ ] Messagerie non vide sur la fiche chantier vedette

---

## En cas de problème

| Problème | Solution |
|----------|---------|
| "column X does not exist" | Lire EXECUTION_PLAN.md section 5 — colonne incertaine |
| "violates foreign key constraint" | Vérifier que USER_ID est bien remplacé |
| "value ... does not exist in type" | Vérifier l'enum (section 6 de l'EXECUTION_PLAN) |
| "duplicate key value" | Données DEMO déjà en base — exécuter ROLLBACK d'abord |
| KPI = 0 sur Dashboard | Vérifier que le compte connecté a bien `org_id = '11111111-...'` |
| Photos brisées | Normal — URLs placeholder. Pour photos réelles : voir EXECUTION_PLAN section 9 |
| Équipes sans type | teams.type absent — Variant A utilisé, valeur `null` → affichage 'libre' |

---

## Rollback rapide

Si besoin de repartir de zéro :

```sql
-- Dans Supabase SQL Editor :
-- Coller le contenu de DEMO_DATASET_ROLLBACK.sql et exécuter
```

Vérification post-rollback :
```sql
SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';  -- → 0
SELECT COUNT(*) FROM public.artisans WHERE notes LIKE 'DEMO_PLANZY_DATASET%';  -- → 0
```
