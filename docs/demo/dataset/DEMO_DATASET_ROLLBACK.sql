-- ============================================================
-- PLANZY — DEMO DATASET ROLLBACK
-- ============================================================
-- Ce script supprime UNIQUEMENT les données de démo insérées
-- par DEMO_DATASET_SQL_DRAFT.sql.
--
-- Ciblage : par UUIDs fixes ou par préfixe [DEMO] / tag DEMO_PLANZY_DATASET
-- Ordre   : respecter les contraintes FK (supprimer les enfants avant les parents)
--
-- ATTENTION : NE PAS EXÉCUTER sans autorisation explicite.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Vérification avant rollback (lecture seule)
-- ────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';
-- SELECT COUNT(*) FROM public.artisans WHERE notes LIKE 'DEMO_PLANZY_DATASET%';
-- SELECT COUNT(*) FROM public.teams WHERE name LIKE '[DEMO]%';
-- SELECT COUNT(*) FROM public.issues WHERE title LIKE '[DEMO]%';
-- SELECT COUNT(*) FROM public.reports WHERE title LIKE '[DEMO]%';

-- ────────────────────────────────────────────────────────────
-- 1. Reports
-- ────────────────────────────────────────────────────────────
DELETE FROM public.reports
WHERE id IN (
  'b9b9b9b9-0001-0001-0001-000000000001',
  'b9b9b9b9-0001-0001-0001-000000000002'
);

-- ────────────────────────────────────────────────────────────
-- 2. Messages (du thread démo)
-- UUIDs fixes issus de DEMO_DATASET_SQL_READY.sql [C5]
-- Fallback : suppression par thread_id si UUIDs non utilisés
-- ────────────────────────────────────────────────────────────
DELETE FROM public.messages
WHERE id IN (
  'a5a5a5a5-0001-0001-0001-000000000001',
  'a5a5a5a5-0001-0001-0001-000000000002',
  'a5a5a5a5-0001-0001-0001-000000000003'
);
-- Fallback si messages insérés depuis DRAFT (sans UUID fixe) :
-- DELETE FROM public.messages WHERE thread_id = 'f1f1f1f1-0001-0001-0001-000000000001';

-- ────────────────────────────────────────────────────────────
-- 3. Message threads
-- ────────────────────────────────────────────────────────────
DELETE FROM public.message_threads
WHERE id = 'f1f1f1f1-0001-0001-0001-000000000001';

-- ────────────────────────────────────────────────────────────
-- 4. Documents
-- ────────────────────────────────────────────────────────────
DELETE FROM public.documents
WHERE id IN (
  'd8d8d8d8-0001-0001-0001-000000000001',
  'd8d8d8d8-0001-0001-0001-000000000002',
  'd8d8d8d8-0003-0003-0003-000000000001'
);

-- ────────────────────────────────────────────────────────────
-- 5. Photos
-- ────────────────────────────────────────────────────────────
DELETE FROM public.photos
WHERE id IN (
  'f7f7f7f7-0001-0001-0001-000000000001',
  'f7f7f7f7-0001-0001-0001-000000000002',
  'f7f7f7f7-0001-0001-0001-000000000003',
  'f4f4f4f4-0004-0004-0004-000000000001',
  'f2f2f2f2-0002-0002-0002-000000000001'
);

-- ────────────────────────────────────────────────────────────
-- 6. Issues
-- ────────────────────────────────────────────────────────────
DELETE FROM public.issues
WHERE id IN (
  'e1a1e1a1-0001-0001-0001-000000000001',
  'e1a1e1a1-0001-0001-0001-000000000002',
  'e2a2e2a2-0002-0002-0002-000000000001',
  'e4a4e4a4-0004-0004-0004-000000000001'
);

-- ────────────────────────────────────────────────────────────
-- 7. Tasks (toutes les tâches des 5 projets démo)
-- ────────────────────────────────────────────────────────────
DELETE FROM public.tasks
WHERE project_id IN (
  'a1a1a1a1-0001-0001-0001-000000000001',
  'a2a2a2a2-0002-0002-0002-000000000002',
  'a3a3a3a3-0003-0003-0003-000000000003',
  'a4a4a4a4-0004-0004-0004-000000000004',
  'a5a5a5a5-0005-0005-0005-000000000005'
);

-- ────────────────────────────────────────────────────────────
-- 8. Team members
-- ────────────────────────────────────────────────────────────
DELETE FROM public.team_members
WHERE team_id IN (
  'c1c1c1c1-0001-0001-0001-000000000001',
  'c2c2c2c2-0002-0002-0002-000000000002'
);

-- ────────────────────────────────────────────────────────────
-- 9. Teams
-- ────────────────────────────────────────────────────────────
DELETE FROM public.teams
WHERE id IN (
  'c1c1c1c1-0001-0001-0001-000000000001',
  'c2c2c2c2-0002-0002-0002-000000000002'
);

-- ────────────────────────────────────────────────────────────
-- 10. Artisans
-- ────────────────────────────────────────────────────────────
DELETE FROM public.artisans
WHERE id IN (
  'b1b1b1b1-0001-0001-0001-000000000001',
  'b2b2b2b2-0002-0002-0002-000000000002',
  'b3b3b3b3-0003-0003-0003-000000000003',
  'b4b4b4b4-0004-0004-0004-000000000004',
  'b5b5b5b5-0005-0005-0005-000000000005',
  'b6b6b6b6-0006-0006-0006-000000000006'
);

-- ────────────────────────────────────────────────────────────
-- 11. Projects (en dernier — parent de tout)
-- ────────────────────────────────────────────────────────────
DELETE FROM public.projects
WHERE id IN (
  'a1a1a1a1-0001-0001-0001-000000000001',
  'a2a2a2a2-0002-0002-0002-000000000002',
  'a3a3a3a3-0003-0003-0003-000000000003',
  'a4a4a4a4-0004-0004-0004-000000000004',
  'a5a5a5a5-0005-0005-0005-000000000005'
);

-- ============================================================
-- Vérification post-rollback
-- ============================================================
-- SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';  -- Attendu : 0
-- SELECT COUNT(*) FROM public.artisans WHERE notes LIKE 'DEMO_PLANZY_DATASET%';  -- Attendu : 0
-- SELECT COUNT(*) FROM public.teams WHERE name LIKE '[DEMO]%';  -- Attendu : 0
-- SELECT COUNT(*) FROM public.issues WHERE title LIKE '[DEMO]%';  -- Attendu : 0
-- SELECT COUNT(*) FROM public.reports WHERE title LIKE '[DEMO]%';  -- Attendu : 0
-- ============================================================
