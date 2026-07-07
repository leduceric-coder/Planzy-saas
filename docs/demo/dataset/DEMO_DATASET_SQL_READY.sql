-- ============================================================
-- PLANZY — DEMO DATASET SQL READY
-- ============================================================
-- STATUT : PRÊT À EXÉCUTER — MAIS NON EXÉCUTÉ
--
-- Ce fichier est la version corrigée et validée de DEMO_DATASET_SQL_DRAFT.sql.
-- Il intègre toutes les corrections identifiées lors de la validation LOT 20.
--
-- RÈGLE ABSOLUE : Ne pas exécuter sans ordre explicite.
-- L'ordre explicite est : "Tu peux exécuter le dataset de démo maintenant."
--
-- Avant d'exécuter :
--   1. Remplacer :USER_ID par l'UUID réel du compte démo
--      → SELECT id FROM auth.users WHERE email = 'demo@planzy.app';
--   2. Confirmer que teams.type / teams.project_id / teams.description existent
--      → Lire DEMO_DATASET_EXECUTION_PLAN.md section 4
--   3. Vérifier l'absence de données DEMO existantes (section 0 ci-dessous)
--
-- Corrections apportées vs DRAFT :
--   [C1] artisans.is_archived = false ajouté explicitement (colonne confirmée)
--   [C2] documents.storage_path = NULL ajouté (colonne confirmée)
--   [C3] photos.storage_path = NULL ajouté (colonne confirmée)
--   [C4] Catégories documents : 'Plan' et 'Administratif' (casse corrigée vs app)
--   [C5] Messages : UUIDs fixes ajoutés pour idempotence
--   [C6] teams.type / project_id / description : inclus avec note de vérification
--   [C7] Avertissement message_type.decision : valide via migration 20260522
--   [C8] Bloc BEGIN/COMMIT pour atomicité
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 0 — Vérifications PRÉALABLES (READ ONLY)
-- Exécuter ces SELECT séparément avant le BEGIN/COMMIT
-- ────────────────────────────────────────────────────────────

-- 0.1 Trouver le USER_ID du compte démo
-- SELECT id, email FROM auth.users WHERE email = 'demo@planzy.app';

-- 0.2 Vérifier l'organisation démo
-- SELECT id, name, plan FROM public.organizations
--   WHERE id = '11111111-1111-1111-1111-111111111111';

-- 0.3 Vérifier le profil du compte démo
-- SELECT id, email, full_name, role, org_id FROM public.profiles
--   WHERE org_id = '11111111-1111-1111-1111-111111111111';

-- 0.4 Vérifier absence de données DEMO existantes
-- SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';
-- → Attendu : 0 (ou exécuter DEMO_DATASET_ROLLBACK.sql si > 0)

-- 0.5 Vérifier colonnes artisans.is_archived
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'artisans' AND column_name = 'is_archived';
-- → Attendu : 1 ligne (boolean, default false)

-- 0.6 Vérifier colonnes teams (incertaines)
-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'teams'
--   ORDER BY ordinal_position;
-- → Si 'type' présent : utiliser INSERT AVEC type/project_id/description (Variant B)
-- → Si 'type' absent  : utiliser INSERT SANS ces colonnes (Variant A — par défaut ci-dessous)

-- 0.7 Vérifier message_type.decision
-- SELECT enumlabel FROM pg_enum
--   JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--   WHERE pg_type.typname = 'message_type'
--   ORDER BY enumsortorder;
-- → Doit inclure 'decision' (ajouté par migration 20260522)

-- ────────────────────────────────────────────────────────────
-- DÉBUT DE TRANSACTION
-- ────────────────────────────────────────────────────────────

BEGIN;

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — PROJECTS (5)
-- Validé : toutes colonnes conformes au schema.sql
-- project_status : 'active' ✓ | 'paused' ✓ | 'completed' ✓ | 'archived' ✓
-- ────────────────────────────────────────────────────────────

INSERT INTO public.projects
  (id, org_id, name, description, address, status, start_date, end_date, progress, color, created_by)
VALUES
  (
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Construction Villa Les Pins',
    'DEMO_PLANZY_DATASET — Chantier vedette. Avancement 65%, 2 réserves, 1 tâche bloquée.',
    '12 avenue des Pins, 33000 Bordeaux',
    'active',
    CURRENT_DATE - INTERVAL '3 months',
    CURRENT_DATE + INTERVAL '2 months',
    65, '#2563EB', ':USER_ID'::uuid
  ),
  (
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Rénovation Appartement Rue de la Paix',
    'DEMO_PLANZY_DATASET — Chantier normal, avancement correct.',
    '15 rue de la Paix, 75002 Paris',
    'active',
    CURRENT_DATE - INTERVAL '6 weeks',
    CURRENT_DATE + INTERVAL '6 weeks',
    40, '#22C55E', ':USER_ID'::uuid
  ),
  (
    'a3a3a3a3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Extension Garage Famille Moreau',
    'DEMO_PLANZY_DATASET — Chantier en retard, tâche dépassée visible sur Dashboard.',
    '8 impasse des Rosiers, 69003 Lyon',
    'active',
    CURRENT_DATE - INTERVAL '3 weeks',
    CURRENT_DATE + INTERVAL '5 weeks',
    20, '#F59E0B', ':USER_ID'::uuid
  ),
  (
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Réhabilitation École Saint-Exupéry',
    'DEMO_PLANZY_DATASET — Chantier institutionnel, réserve critique.',
    '3 rue Antoine de Saint-Exupéry, 31000 Toulouse',
    'active',
    CURRENT_DATE - INTERVAL '2 months',
    CURRENT_DATE + INTERVAL '1 month',
    55, '#EF4444', ':USER_ID'::uuid
  ),
  (
    'a5a5a5a5-0005-0005-0005-000000000005',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Maison Individuelle Lotissement Les Charmes',
    'DEMO_PLANZY_DATASET — Nouveau chantier, peu d''activité.',
    '22 allée des Charmes, 44000 Nantes',
    'active',
    CURRENT_DATE - INTERVAL '1 week',
    CURRENT_DATE + INTERVAL '4 months',
    10, '#8B5CF6', ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — ARTISANS (6)
-- [C1] is_archived = false inclus explicitement
-- Colonne confirmée dans database.types.ts (boolean, optional insert → default false)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.artisans
  (id, org_id, full_name, trade, phone, email, color, notes, is_archived)
VALUES
  (
    'b1b1b1b1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Marc Dupont', 'Maçon', '06 11 22 33 44', 'marc.dupont@demo.test',
    '#2563EB', 'DEMO_PLANZY_DATASET', false
  ),
  (
    'b2b2b2b2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Pierre Martin', 'Électricien', '06 22 33 44 55', 'pierre.martin@demo.test',
    '#EF4444', 'DEMO_PLANZY_DATASET — Multi-affecté pour illustrer le conflit', false
  ),
  (
    'b3b3b3b3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Sébastien Blanc', 'Charpentier', '06 33 44 55 66', 'sebastien.blanc@demo.test',
    '#F59E0B', 'DEMO_PLANZY_DATASET', false
  ),
  (
    'b4b4b4b4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Karim Benali', 'Plaquiste', '06 44 55 66 77', 'karim.benali@demo.test',
    '#6B7280', 'DEMO_PLANZY_DATASET — Disponible cette semaine', false
  ),
  (
    'b5b5b5b5-0005-0005-0005-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'Thomas Leroy', 'Peintre', '06 55 66 77 88', 'thomas.leroy@demo.test',
    '#22C55E', 'DEMO_PLANZY_DATASET', false
  ),
  (
    'b6b6b6b6-0006-0006-0006-000000000006',
    '11111111-1111-1111-1111-111111111111',
    'Julie Roux', 'Conductrice de travaux', '06 66 77 88 99', 'julie.roux@demo.test',
    '#8B5CF6', 'DEMO_PLANZY_DATASET', false
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — TEAMS (2)
-- [C6] VARIANT A (défaut) : colonnes schema.sql uniquement
--      → Utiliser si teams.type n'existe pas (vérification section 0.6)
-- [C6] VARIANT B (commenté) : avec type/project_id/description
--      → Décommenter si les colonnes existent en base
-- ────────────────────────────────────────────────────────────

-- VARIANT A — Colonnes confirmées (schema.sql + database.types.ts)
INSERT INTO public.teams
  (id, org_id, name, color, lead_id)
VALUES
  (
    'c1c1c1c1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Équipe Gros Œuvre',
    '#2563EB',
    'b1b1b1b1-0001-0001-0001-000000000001'
  ),
  (
    'c2c2c2c2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Équipe Finitions',
    '#22C55E',
    'b5b5b5b5-0005-0005-0005-000000000005'
  )
ON CONFLICT (id) DO NOTHING;

-- VARIANT B — Si teams.type / project_id / description existent (vérifier section 0.6)
-- Remplacer les 2 inserts ci-dessus par :
--
-- INSERT INTO public.teams
--   (id, org_id, name, color, lead_id, type, project_id, description)
-- VALUES
--   (
--     'c1c1c1c1-0001-0001-0001-000000000001',
--     '11111111-1111-1111-1111-111111111111',
--     '[DEMO] Équipe Gros Œuvre', '#2563EB',
--     'b1b1b1b1-0001-0001-0001-000000000001',
--     'metier', NULL, 'DEMO_PLANZY_DATASET'
--   ),
--   (
--     'c2c2c2c2-0002-0002-0002-000000000002',
--     '11111111-1111-1111-1111-111111111111',
--     '[DEMO] Équipe Finitions', '#22C55E',
--     'b5b5b5b5-0005-0005-0005-000000000005',
--     'metier', NULL, 'DEMO_PLANZY_DATASET'
--   )
-- ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — TEAM_MEMBERS (4)
-- Clé unique (team_id, artisan_id) — ON CONFLICT géré
-- ────────────────────────────────────────────────────────────

INSERT INTO public.team_members (team_id, artisan_id)
VALUES
  ('c1c1c1c1-0001-0001-0001-000000000001', 'b1b1b1b1-0001-0001-0001-000000000001'),
  ('c1c1c1c1-0001-0001-0001-000000000001', 'b4b4b4b4-0004-0004-0004-000000000004'),
  ('c2c2c2c2-0002-0002-0002-000000000002', 'b5b5b5b5-0005-0005-0005-000000000005'),
  ('c2c2c2c2-0002-0002-0002-000000000002', 'b6b6b6b6-0006-0006-0006-000000000006')
ON CONFLICT (team_id, artisan_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 5 — TASKS (15)
-- task_status : todo ✓ | in_progress ✓ | blocked ✓ | done ✓
-- priority    : low ✓ | medium ✓ | high ✓ | critical ✓
-- assigned_team → FK vers teams.id (nullable) ✓
-- assigned_to   → FK vers artisans.id (nullable) ✓
-- ────────────────────────────────────────────────────────────

-- P1 — Villa Les Pins (5 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd1a1d1a1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Coulage dalle RDC', 'done', 'high',
    CURRENT_DATE - INTERVAL '10 weeks', CURRENT_DATE - INTERVAL '8 weeks',
    'b1b1b1b1-0001-0001-0001-000000000001', 'c1c1c1c1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Montage charpente', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days',
    'b3b3b3b3-0003-0003-0003-000000000003', NULL,
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000003',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Pose fenêtres', 'blocked', 'medium',
    CURRENT_DATE + INTERVAL '1 week', CURRENT_DATE + INTERVAL '2 weeks',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000004',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Électricité premier passage', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '1 week', CURRENT_DATE + INTERVAL '2 weeks',
    'b2b2b2b2-0002-0002-0002-000000000002', NULL,
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000005',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Plâtrerie RDC', 'todo', 'low',
    CURRENT_DATE + INTERVAL '3 weeks', CURRENT_DATE + INTERVAL '5 weeks',
    NULL, NULL, ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P2 — Appartement Rue de la Paix (3 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd2a2d2a2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
    'Démolition cloisons', 'done', 'medium',
    CURRENT_DATE - INTERVAL '5 weeks', CURRENT_DATE - INTERVAL '4 weeks',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd2a2d2a2-0002-0002-0002-000000000002',
    'a2a2a2a2-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
    'Pose revêtement sol', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE,
    'b5b5b5b5-0005-0005-0005-000000000005', 'c2c2c2c2-0002-0002-0002-000000000002',
    ':USER_ID'::uuid
  ),
  (
    'd2a2d2a2-0002-0002-0002-000000000003',
    'a2a2a2a2-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
    'Peinture chambres', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '2 weeks', CURRENT_DATE + INTERVAL '3 weeks',
    'b5b5b5b5-0005-0005-0005-000000000005', NULL,
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P3 — Garage Moreau (2 tâches — T3.1 EN RETARD)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd3a3d3a3-0003-0003-0003-000000000001',
    'a3a3a3a3-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111',
    'Terrassement', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '2 weeks',
    CURRENT_DATE - INTERVAL '5 days',    -- ← EN RETARD : end_date passé, statut non terminé
    'b1b1b1b1-0001-0001-0001-000000000001', NULL,
    ':USER_ID'::uuid
  ),
  (
    'd3a3d3a3-0003-0003-0003-000000000002',
    'a3a3a3a3-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111',
    'Fondations', 'todo', 'high',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days',
    NULL, NULL, ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P4 — École Saint-Exupéry (3 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd4a4d4a4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111',
    'Isolation toiture', 'done', 'high',
    CURRENT_DATE - INTERVAL '6 weeks', CURRENT_DATE - INTERVAL '4 weeks',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd4a4d4a4-0004-0004-0004-000000000002',
    'a4a4a4a4-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111',
    'Menuiseries extérieures', 'blocked', 'high',
    CURRENT_DATE + INTERVAL '1 week', CURRENT_DATE + INTERVAL '2 weeks',
    'b2b2b2b2-0002-0002-0002-000000000002', NULL,    -- Pierre (multi-affecté P1+P4)
    ':USER_ID'::uuid
  ),
  (
    'd4a4d4a4-0004-0004-0004-000000000003',
    'a4a4a4a4-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111',
    'Peinture couloirs', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '3 weeks', CURRENT_DATE + INTERVAL '5 weeks',
    'b6b6b6b6-0006-0006-0006-000000000006', 'c2c2c2c2-0002-0002-0002-000000000002',
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P5 — Maison Lotissement Les Charmes (2 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd5a5d5a5-0005-0005-0005-000000000001',
    'a5a5a5a5-0005-0005-0005-000000000005', '11111111-1111-1111-1111-111111111111',
    'Terrassement', 'done', 'medium',
    CURRENT_DATE - INTERVAL '1 week', CURRENT_DATE - INTERVAL '2 days',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd5a5d5a5-0005-0005-0005-000000000002',
    'a5a5a5a5-0005-0005-0005-000000000005', '11111111-1111-1111-1111-111111111111',
    'Implantation', 'in_progress', 'medium',
    CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days',
    NULL, NULL, ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 6 — ISSUES / RÉSERVES (4)
-- issue_status : open ✓ | assigned ✓
-- priority     : high ✓ | critical ✓ | medium ✓
-- assigned_to  → FK vers artisans.id (nullable) ✓
-- reported_by  → FK vers auth.users(id) (nullable) ✓
-- ────────────────────────────────────────────────────────────

INSERT INTO public.issues
  (id, project_id, org_id, title, description, status, priority, reported_by, assigned_to)
VALUES
  (
    'e1a1e1a1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    '[DEMO] Fissure mur nord',
    'DEMO_PLANZY_DATASET — Fissure horizontale de 2 cm sur le mur nord du RDC.',
    'open', 'high',
    ':USER_ID'::uuid, 'b1b1b1b1-0001-0001-0001-000000000001'
  ),
  (
    'e1a1e1a1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    '[DEMO] Humidité sous-sol',
    'DEMO_PLANZY_DATASET — Traces d''humidité sur 3 m² dans le sous-sol.',
    'assigned', 'critical',
    ':USER_ID'::uuid, 'b1b1b1b1-0001-0001-0001-000000000001'
  ),
  (
    'e2a2e2a2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
    '[DEMO] Revêtement décollé entrée',
    'DEMO_PLANZY_DATASET — Zone de 40 cm² décollée à l''entrée principale.',
    'open', 'medium',
    ':USER_ID'::uuid, NULL
  ),
  (
    'e4a4e4a4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111',
    '[DEMO] Infiltration fenêtre classe 3',
    'DEMO_PLANZY_DATASET — Infiltration d''eau autour de la fenêtre de la classe 3.',
    'open', 'critical',
    ':USER_ID'::uuid, 'b6b6b6b6-0006-0006-0006-000000000006'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 7 — PHOTOS (5)
-- [C3] storage_path = NULL ajouté (colonne confirmée dans database.types.ts)
-- url (NOT NULL requis) → placeholder conservé ; photos ne s'afficheront pas
-- Pour affichage réel : uploader dans bucket 'photos' et remplacer storage_path + url
-- ────────────────────────────────────────────────────────────

INSERT INTO public.photos
  (id, project_id, org_id, url, thumbnail_url, caption, theme, issue_id, taken_by, taken_at, storage_path)
VALUES
  (
    'g1g1g1g1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/fissure-mur-nord.jpg',
    'https://placeholder.demo/photos/thumb/fissure-mur-nord.jpg',
    'Fissure mur nord — vue de face', 'reserve',
    'e1a1e1a1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid, CURRENT_DATE, NULL
  ),
  (
    'g1g1g1g1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/humidite-sous-sol.jpg',
    'https://placeholder.demo/photos/thumb/humidite-sous-sol.jpg',
    'Humidité sous-sol — traces sur paroi', 'reserve',
    'e1a1e1a1-0001-0001-0001-000000000002',
    ':USER_ID'::uuid, CURRENT_DATE, NULL
  ),
  (
    'g1g1g1g1-0001-0001-0001-000000000003',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/coulage-dalle.jpg',
    'https://placeholder.demo/photos/thumb/coulage-dalle.jpg',
    'Coulage dalle RDC terminé', 'avancement',
    NULL, ':USER_ID'::uuid, CURRENT_DATE - INTERVAL '8 weeks', NULL
  ),
  (
    'g4g4g4g4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004', '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/infiltration-fenetre-classe3.jpg',
    'https://placeholder.demo/photos/thumb/infiltration-fenetre-classe3.jpg',
    'Infiltration fenêtre classe 3 — traces sur appui', 'reserve',
    'e4a4e4a4-0004-0004-0004-000000000001',
    ':USER_ID'::uuid, CURRENT_DATE - INTERVAL '3 days', NULL
  ),
  (
    'g2g2g2g2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002', '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/revetement-sol.jpg',
    'https://placeholder.demo/photos/thumb/revetement-sol.jpg',
    'Pose revêtement sol en cours', 'avancement',
    NULL, ':USER_ID'::uuid, CURRENT_DATE, NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 8 — DOCUMENTS (3)
-- [C2] storage_path = NULL ajouté (colonne confirmée dans database.types.ts)
-- [C4] Catégories : 'Plan' et 'Administratif' (casse conforme à DocumentsClient)
--      → if (doc.category === 'Plan') déclenche l'icône plan dans l'UI
-- file_url NOT NULL requis → placeholder conservé
-- Pour affichage réel : uploader dans bucket 'documents' et remplacer storage_path + file_url
-- ────────────────────────────────────────────────────────────

INSERT INTO public.documents
  (id, project_id, org_id, name, file_url, file_type, file_size, category, uploaded_by, storage_path)
VALUES
  (
    'h1h1h1h1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Plan façade.pdf',
    'https://placeholder.demo/documents/plan-facade.pdf',
    'application/pdf', 204800,
    'Plan',                        -- [C4] Majuscule pour correspondre au check UI
    ':USER_ID'::uuid, NULL
  ),
  (
    'h1h1h1h1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111',
    'Attestation RE2020.pdf',
    'https://placeholder.demo/documents/attestation-re2020.pdf',
    'application/pdf', 102400,
    'Administratif',               -- [C4] Majuscule
    ':USER_ID'::uuid, NULL
  ),
  (
    'h3h3h3h3-0003-0003-0003-000000000001',
    'a3a3a3a3-0003-0003-0003-000000000003', '11111111-1111-1111-1111-111111111111',
    'Permis de construire.pdf',
    'https://placeholder.demo/documents/permis-construire-moreau.pdf',
    'application/pdf', 512000,
    'Administratif',
    ':USER_ID'::uuid, NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 9 — MESSAGE_THREADS (1)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.message_threads
  (id, org_id, project_id, title, type, created_by)
VALUES
  (
    'f1f1f1f1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'Discussion — Villa Les Pins',
    'project',
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 10 — MESSAGES (3)
-- [C5] UUIDs fixes ajoutés pour idempotence
-- [C7] message_type 'decision' valide — ajouté par migration 20260522
--      NB : database.types.ts ne le liste pas (types non régénérés après migration)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.messages
  (id, org_id, project_id, thread_id, sender_id, content, type, created_at)
VALUES
  (
    'm1m1m1m1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'La dalle est coulée, on attaque la charpente demain',
    'tache_terminee',
    CURRENT_DATE - INTERVAL '2 days'
  ),
  (
    'm1m1m1m1-0001-0001-0001-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'Livraison charpente repoussée au jeudi, je préviens ?',
    'livraison_absente',
    CURRENT_DATE - INTERVAL '1 day'
  ),
  (
    'm1m1m1m1-0001-0001-0001-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'Ok, préviens-moi dès que c''est livré',
    'decision',
    CURRENT_DATE - INTERVAL '1 day' + INTERVAL '30 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 11 — REPORTS (2)
-- report.type : weekly ✓ | monthly ✓
-- project_id nullable ✓ (rapport global = NULL)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.reports
  (id, project_id, org_id, title, type, content, generated_by, week_number)
VALUES
  (
    'i1i1i1i1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Rapport semaine du 26 mai',
    'weekly',
    jsonb_build_object(
      'summary', 'Semaine productive. Charpente lancée, attente livraison fenêtres.',
      'tasks_done', 1, 'tasks_in_progress', 2, 'issues_open', 2,
      'generated_at', (CURRENT_DATE - INTERVAL '1 week')::text
    ),
    ':USER_ID'::uuid, 21
  ),
  (
    'i1i1i1i1-0001-0001-0001-000000000002',
    NULL,
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Rapport Mai 2026',
    'monthly',
    jsonb_build_object(
      'summary', 'Bilan mensuel — 5 chantiers actifs. 2 réserves critiques en cours.',
      'projects_active', 5, 'tasks_done', 8, 'issues_critical', 2,
      'generated_at', (CURRENT_DATE - INTERVAL '5 days')::text
    ),
    ':USER_ID'::uuid, NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- FIN DE TRANSACTION
-- ────────────────────────────────────────────────────────────

COMMIT;

-- ============================================================
-- SECTION 12 — Vérifications POST-INSERTION (READ ONLY)
-- Exécuter ces SELECT séparément après le COMMIT
-- ============================================================

-- SELECT COUNT(*) FROM public.projects WHERE name LIKE '[DEMO]%';
-- → Attendu : 5

-- SELECT COUNT(*) FROM public.artisans WHERE notes LIKE 'DEMO_PLANZY_DATASET%';
-- → Attendu : 6

-- SELECT COUNT(*) FROM public.teams WHERE name LIKE '[DEMO]%';
-- → Attendu : 2

-- SELECT COUNT(*) FROM public.team_members WHERE team_id IN (
--   'c1c1c1c1-0001-0001-0001-000000000001',
--   'c2c2c2c2-0002-0002-0002-000000000002');
-- → Attendu : 4

-- SELECT COUNT(*) FROM public.tasks WHERE project_id IN (
--   'a1a1a1a1-0001-0001-0001-000000000001',
--   'a2a2a2a2-0002-0002-0002-000000000002',
--   'a3a3a3a3-0003-0003-0003-000000000003',
--   'a4a4a4a4-0004-0004-0004-000000000004',
--   'a5a5a5a5-0005-0005-0005-000000000005');
-- → Attendu : 15

-- SELECT COUNT(*) FROM public.issues WHERE title LIKE '[DEMO]%';
-- → Attendu : 4

-- SELECT COUNT(*) FROM public.photos WHERE id LIKE 'g%';
-- → Attendu : 5

-- SELECT COUNT(*) FROM public.documents WHERE id LIKE 'h%';
-- → Attendu : 3

-- SELECT COUNT(*) FROM public.messages WHERE thread_id = 'f1f1f1f1-0001-0001-0001-000000000001';
-- → Attendu : 3

-- SELECT COUNT(*) FROM public.reports WHERE title LIKE '[DEMO]%';
-- → Attendu : 2

-- Vérification tâche en retard (critique pour Dashboard + Rapports) :
-- SELECT id, title, status, end_date FROM public.tasks
--   WHERE id = 'd3a3d3a3-0003-0003-0003-000000000001';
-- → end_date doit être < CURRENT_DATE, status = 'in_progress'

-- Vérification conflit d'affectation Pierre Martin (critique pour Équipes) :
-- SELECT t.title, p.name FROM public.tasks t
--   JOIN public.projects p ON t.project_id = p.id
--   WHERE t.assigned_to = 'b2b2b2b2-0002-0002-0002-000000000002'
--     AND t.status NOT IN ('done', 'validated');
-- → Doit retourner tâches sur P1 ET P4

-- Vérification réserves critiques (critique pour Rapports) :
-- SELECT title, priority, status FROM public.issues
--   WHERE priority = 'critical' AND org_id = '11111111-1111-1111-1111-111111111111';
-- → Attendu : 2 lignes (Humidité sous-sol + Infiltration fenêtre)
-- ============================================================
