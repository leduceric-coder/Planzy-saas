-- ============================================================
-- PLANZY — DEMO DATASET SQL DRAFT
-- ============================================================
-- ATTENTION : NE PAS EXÉCUTER sans autorisation explicite.
-- Ce script est un DRAFT. Valider chaque section avant exécution.
-- ============================================================
--
-- Prérequis :
--   1. Remplacer :USER_ID par l'UUID du compte démo
--      (SELECT id FROM auth.users WHERE email = 'votre@email.demo')
--   2. Vérifier que la colonne `artisans.is_archived` existe :
--      SELECT column_name FROM information_schema.columns
--        WHERE table_name = 'artisans' AND column_name = 'is_archived';
--      Si absente, retirer les lignes `is_archived = false` ci-dessous.
--   3. Les colonnes `teams.type`, `teams.project_id`, `teams.description`
--      ne sont PAS dans le schema.sql de référence. Si présentes en base,
--      les ajouter manuellement aux INSERT teams.
--   4. Les URLs photos/documents sont des placeholders. Upload les fichiers
--      dans Supabase Storage et remplacer les URLs avant exécution.
--   5. Org cible : 11111111-1111-1111-1111-111111111111
--
-- Idempotence : ON CONFLICT (id) DO NOTHING sur toutes les tables.
-- Rollback    : voir DEMO_DATASET_ROLLBACK.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 0 — Vérification préalable (lecture seule)
-- ────────────────────────────────────────────────────────────
-- Exécuter séparément pour valider avant d'insérer :
--
-- SELECT id, full_name FROM auth.users WHERE email = ':USER_EMAIL';
-- SELECT COUNT(*) FROM public.profiles WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'artisans';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'teams';

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — PROJECTS (5)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.projects
  (id, org_id, name, description, address, status, start_date, end_date, progress, color, created_by)
VALUES
  (
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Construction Villa Les Pins',
    'DEMO_PLANZY_DATASET — Chantier vedette. Avancement 65 %, 2 réserves, 1 tâche bloquée.',
    '12 avenue des Pins, 33000 Bordeaux',
    'active',
    CURRENT_DATE - INTERVAL '3 months',
    CURRENT_DATE + INTERVAL '2 months',
    65,
    '#2563EB',
    ':USER_ID'::uuid
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
    40,
    '#22C55E',
    ':USER_ID'::uuid
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
    20,
    '#F59E0B',
    ':USER_ID'::uuid
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
    55,
    '#EF4444',
    ':USER_ID'::uuid
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
    10,
    '#8B5CF6',
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — ARTISANS (6)
-- Note : retirer `is_archived = false` si la colonne n'existe pas
-- ────────────────────────────────────────────────────────────

INSERT INTO public.artisans
  (id, org_id, full_name, trade, phone, email, color, notes)
VALUES
  (
    'b1b1b1b1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Marc Dupont', 'Maçon', '06 11 22 33 44', 'marc.dupont@demo.test',
    '#2563EB', 'DEMO_PLANZY_DATASET'
  ),
  (
    'b2b2b2b2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Pierre Martin', 'Électricien', '06 22 33 44 55', 'pierre.martin@demo.test',
    '#EF4444', 'DEMO_PLANZY_DATASET — Volontairement multi-affecté pour illustrer le conflit'
  ),
  (
    'b3b3b3b3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Sébastien Blanc', 'Charpentier', '06 33 44 55 66', 'sebastien.blanc@demo.test',
    '#F59E0B', 'DEMO_PLANZY_DATASET'
  ),
  (
    'b4b4b4b4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Karim Benali', 'Plaquiste', '06 44 55 66 77', 'karim.benali@demo.test',
    '#6B7280', 'DEMO_PLANZY_DATASET — Disponible cette semaine (sans tâche active)'
  ),
  (
    'b5b5b5b5-0005-0005-0005-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'Thomas Leroy', 'Peintre', '06 55 66 77 88', 'thomas.leroy@demo.test',
    '#22C55E', 'DEMO_PLANZY_DATASET'
  ),
  (
    'b6b6b6b6-0006-0006-0006-000000000006',
    '11111111-1111-1111-1111-111111111111',
    'Julie Roux', 'Conductrice de travaux', '06 66 77 88 99', 'julie.roux@demo.test',
    '#8B5CF6', 'DEMO_PLANZY_DATASET'
  )
ON CONFLICT (id) DO NOTHING;

-- Si la colonne is_archived existe, décommenter :
-- UPDATE public.artisans SET is_archived = false
--   WHERE id IN (
--     'b1b1b1b1-0001-0001-0001-000000000001',
--     'b2b2b2b2-0002-0002-0002-000000000002',
--     'b3b3b3b3-0003-0003-0003-000000000003',
--     'b4b4b4b4-0004-0004-0004-000000000004',
--     'b5b5b5b5-0005-0005-0005-000000000005',
--     'b6b6b6b6-0006-0006-0006-000000000006'
--   );

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — TEAMS (2)
-- Note : les colonnes type/project_id/description ne sont pas dans schema.sql
-- Ajouter si elles existent dans votre base
-- ────────────────────────────────────────────────────────────

INSERT INTO public.teams
  (id, org_id, name, color, lead_id)
VALUES
  (
    'c1c1c1c1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Équipe Gros Œuvre',
    '#2563EB',
    'b1b1b1b1-0001-0001-0001-000000000001'  -- Marc Dupont
  ),
  (
    'c2c2c2c2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Équipe Finitions',
    '#22C55E',
    'b5b5b5b5-0005-0005-0005-000000000005'  -- Thomas Leroy
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — TEAM_MEMBERS (4)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.team_members (team_id, artisan_id)
VALUES
  ('c1c1c1c1-0001-0001-0001-000000000001', 'b1b1b1b1-0001-0001-0001-000000000001'),  -- Gros Œuvre ← Marc
  ('c1c1c1c1-0001-0001-0001-000000000001', 'b4b4b4b4-0004-0004-0004-000000000004'),  -- Gros Œuvre ← Karim
  ('c2c2c2c2-0002-0002-0002-000000000002', 'b5b5b5b5-0005-0005-0005-000000000005'),  -- Finitions ← Thomas
  ('c2c2c2c2-0002-0002-0002-000000000002', 'b6b6b6b6-0006-0006-0006-000000000006')   -- Finitions ← Julie
ON CONFLICT (team_id, artisan_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 5 — TASKS (15)
-- Dates relatives à CURRENT_DATE pour que la démo soit toujours à jour
-- ────────────────────────────────────────────────────────────

-- P1 — Villa Les Pins (5 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd1a1d1a1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Coulage dalle RDC', 'done', 'high',
    CURRENT_DATE - INTERVAL '10 weeks',
    CURRENT_DATE - INTERVAL '8 weeks',
    'b1b1b1b1-0001-0001-0001-000000000001',  -- Marc
    'c1c1c1c1-0001-0001-0001-000000000001',  -- Gros Œuvre
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Montage charpente', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '4 days',
    'b3b3b3b3-0003-0003-0003-000000000003',  -- Sébastien
    NULL,
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000003',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Pose fenêtres', 'blocked', 'medium',
    CURRENT_DATE + INTERVAL '1 week',
    CURRENT_DATE + INTERVAL '2 weeks',
    NULL,
    NULL,
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000004',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Électricité premier passage', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '1 week',
    CURRENT_DATE + INTERVAL '2 weeks',
    'b2b2b2b2-0002-0002-0002-000000000002',  -- Pierre
    NULL,
    ':USER_ID'::uuid
  ),
  (
    'd1a1d1a1-0001-0001-0001-000000000005',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Plâtrerie RDC', 'todo', 'low',
    CURRENT_DATE + INTERVAL '3 weeks',
    CURRENT_DATE + INTERVAL '5 weeks',
    NULL,
    NULL,
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P2 — Appartement Rue de la Paix (3 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd2a2d2a2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Démolition cloisons', 'done', 'medium',
    CURRENT_DATE - INTERVAL '5 weeks',
    CURRENT_DATE - INTERVAL '4 weeks',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd2a2d2a2-0002-0002-0002-000000000002',
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Pose revêtement sol', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE,  -- Échéance : aujourd'hui
    'b5b5b5b5-0005-0005-0005-000000000005',  -- Thomas
    'c2c2c2c2-0002-0002-0002-000000000002',  -- Finitions
    ':USER_ID'::uuid
  ),
  (
    'd2a2d2a2-0002-0002-0002-000000000003',
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Peinture chambres', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '2 weeks',
    CURRENT_DATE + INTERVAL '3 weeks',
    'b5b5b5b5-0005-0005-0005-000000000005',
    NULL,
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P3 — Garage Famille Moreau (2 tâches — T3.1 est en RETARD)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd3a3d3a3-0003-0003-0003-000000000001',
    'a3a3a3a3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Terrassement', 'in_progress', 'high',
    CURRENT_DATE - INTERVAL '2 weeks',
    CURRENT_DATE - INTERVAL '5 days',  -- ← EN RETARD : end_date dans le passé, statut non terminé
    'b1b1b1b1-0001-0001-0001-000000000001',  -- Marc
    NULL,
    ':USER_ID'::uuid
  ),
  (
    'd3a3d3a3-0003-0003-0003-000000000002',
    'a3a3a3a3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Fondations', 'todo', 'high',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '3 days',
    NULL, NULL, ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P4 — École Saint-Exupéry (3 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd4a4d4a4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Isolation toiture', 'done', 'high',
    CURRENT_DATE - INTERVAL '6 weeks',
    CURRENT_DATE - INTERVAL '4 weeks',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd4a4d4a4-0004-0004-0004-000000000002',
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Menuiseries extérieures', 'blocked', 'high',
    CURRENT_DATE + INTERVAL '1 week',
    CURRENT_DATE + INTERVAL '2 weeks',
    'b2b2b2b2-0002-0002-0002-000000000002',  -- Pierre (multi-affecté)
    NULL,
    ':USER_ID'::uuid
  ),
  (
    'd4a4d4a4-0004-0004-0004-000000000003',
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'Peinture couloirs', 'todo', 'medium',
    CURRENT_DATE + INTERVAL '3 weeks',
    CURRENT_DATE + INTERVAL '5 weeks',
    'b6b6b6b6-0006-0006-0006-000000000006',  -- Julie
    'c2c2c2c2-0002-0002-0002-000000000002',  -- Finitions
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- P5 — Maison Lotissement Les Charmes (2 tâches)
INSERT INTO public.tasks
  (id, project_id, org_id, title, status, priority, start_date, end_date, assigned_to, assigned_team, created_by)
VALUES
  (
    'd5a5d5a5-0005-0005-0005-000000000001',
    'a5a5a5a5-0005-0005-0005-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'Terrassement', 'done', 'medium',
    CURRENT_DATE - INTERVAL '1 week',
    CURRENT_DATE - INTERVAL '2 days',
    NULL, NULL, ':USER_ID'::uuid
  ),
  (
    'd5a5d5a5-0005-0005-0005-000000000002',
    'a5a5a5a5-0005-0005-0005-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'Implantation', 'in_progress', 'medium',
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '3 days',
    NULL, NULL, ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 6 — ISSUES / RÉSERVES (4)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.issues
  (id, project_id, org_id, title, description, status, priority, reported_by, assigned_to)
VALUES
  (
    'e1a1e1a1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Fissure mur nord',
    'DEMO_PLANZY_DATASET — Fissure horizontale de 2 cm sur le mur nord du RDC.',
    'open', 'high',
    ':USER_ID'::uuid,
    'b1b1b1b1-0001-0001-0001-000000000001'
  ),
  (
    'e1a1e1a1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Humidité sous-sol',
    'DEMO_PLANZY_DATASET — Traces d''humidité sur 3 m² dans le sous-sol, origine non identifiée.',
    'assigned', 'critical',
    ':USER_ID'::uuid,
    'b1b1b1b1-0001-0001-0001-000000000001'
  ),
  (
    'e2a2e2a2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Revêtement décollé entrée',
    'DEMO_PLANZY_DATASET — Zone de 40 cm² décollée à l''entrée principale.',
    'open', 'medium',
    ':USER_ID'::uuid,
    NULL
  ),
  (
    'e4a4e4a4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Infiltration fenêtre classe 3',
    'DEMO_PLANZY_DATASET — Infiltration d''eau autour de la fenêtre de la classe 3 après pluie.',
    'open', 'critical',
    ':USER_ID'::uuid,
    'b6b6b6b6-0006-0006-0006-000000000006'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 7 — PHOTOS (5 — métadonnées uniquement)
-- IMPORTANT : url et thumbnail_url sont des placeholders.
-- Uploader les images dans Supabase Storage (bucket: photos)
-- et remplacer ces URLs avant exécution en production.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.photos
  (id, project_id, org_id, url, thumbnail_url, caption, theme, issue_id, taken_by, taken_at)
VALUES
  (
    'g1g1g1g1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/fissure-mur-nord.jpg',
    'https://placeholder.demo/photos/thumb/fissure-mur-nord.jpg',
    'Fissure mur nord — vue de face',
    'reserve',
    'e1a1e1a1-0001-0001-0001-000000000001',  -- Liée à réserve high
    ':USER_ID'::uuid,
    CURRENT_DATE
  ),
  (
    'g1g1g1g1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/humidite-sous-sol.jpg',
    'https://placeholder.demo/photos/thumb/humidite-sous-sol.jpg',
    'Humidité sous-sol — traces sur paroi',
    'reserve',
    'e1a1e1a1-0001-0001-0001-000000000002',  -- Liée à réserve critical
    ':USER_ID'::uuid,
    CURRENT_DATE
  ),
  (
    'g1g1g1g1-0001-0001-0001-000000000003',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/coulage-dalle.jpg',
    'https://placeholder.demo/photos/thumb/coulage-dalle.jpg',
    'Coulage dalle RDC terminé',
    'avancement',
    NULL,  -- Pas de réserve
    ':USER_ID'::uuid,
    CURRENT_DATE - INTERVAL '8 weeks'
  ),
  (
    'g4g4g4g4-0004-0004-0004-000000000001',
    'a4a4a4a4-0004-0004-0004-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/infiltration-fenetre-classe3.jpg',
    'https://placeholder.demo/photos/thumb/infiltration-fenetre-classe3.jpg',
    'Infiltration fenêtre classe 3 — traces sur appui',
    'reserve',
    'e4a4e4a4-0004-0004-0004-000000000001',  -- Liée à réserve critical
    ':USER_ID'::uuid,
    CURRENT_DATE - INTERVAL '3 days'
  ),
  (
    'g2g2g2g2-0002-0002-0002-000000000001',
    'a2a2a2a2-0002-0002-0002-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'https://placeholder.demo/photos/revetement-sol.jpg',
    'https://placeholder.demo/photos/thumb/revetement-sol.jpg',
    'Pose revêtement sol en cours',
    'avancement',
    NULL,
    ':USER_ID'::uuid,
    CURRENT_DATE
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 8 — DOCUMENTS (3 — métadonnées uniquement)
-- IMPORTANT : file_url est un placeholder.
-- Uploader dans Supabase Storage (bucket: documents) avant démo.
-- ────────────────────────────────────────────────────────────

INSERT INTO public.documents
  (id, project_id, org_id, name, file_url, file_type, file_size, category, uploaded_by)
VALUES
  (
    'h1h1h1h1-0001-0001-0001-000000000001',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Plan façade.pdf',
    'https://placeholder.demo/documents/plan-facade.pdf',
    'application/pdf',
    204800,  -- ~200 KB
    'plan',
    ':USER_ID'::uuid
  ),
  (
    'h1h1h1h1-0001-0001-0001-000000000002',
    'a1a1a1a1-0001-0001-0001-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Attestation RE2020.pdf',
    'https://placeholder.demo/documents/attestation-re2020.pdf',
    'application/pdf',
    102400,  -- ~100 KB
    'administratif',
    ':USER_ID'::uuid
  ),
  (
    'h3h3h3h3-0003-0003-0003-000000000001',
    'a3a3a3a3-0003-0003-0003-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Permis de construire.pdf',
    'https://placeholder.demo/documents/permis-construire-moreau.pdf',
    'application/pdf',
    512000,  -- ~500 KB
    'administratif',
    ':USER_ID'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 9 — MESSAGE_THREADS (1) + MESSAGES (3)
-- Chantier P1 — Villa Les Pins
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

INSERT INTO public.messages
  (org_id, project_id, thread_id, sender_id, content, type, created_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'La dalle est coulée, on attaque la charpente demain',
    'tache_terminee',
    CURRENT_DATE - INTERVAL '2 days'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'Livraison charpente repoussée au jeudi, je préviens ?',
    'livraison_absente',
    CURRENT_DATE - INTERVAL '1 day'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'a1a1a1a1-0001-0001-0001-000000000001',
    'f1f1f1f1-0001-0001-0001-000000000001',
    ':USER_ID'::uuid,
    'Ok, préviens-moi dès que c''est livré',
    'decision',
    CURRENT_DATE - INTERVAL '1 day' + INTERVAL '30 minutes'
  );
-- Note : les messages n'ont pas de ON CONFLICT car pas d'id fixe ici.
-- Si re-exécution, vérifier absence via :
-- SELECT COUNT(*) FROM messages WHERE thread_id = 'f1f1f1f1-0001-0001-0001-000000000001';
-- Alternativement, utiliser des UUIDs fixes sur les messages aussi.

-- ────────────────────────────────────────────────────────────
-- SECTION 10 — REPORTS (2)
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
      'tasks_done', 1,
      'tasks_in_progress', 2,
      'issues_open', 2,
      'generated_at', CURRENT_DATE - INTERVAL '1 week'
    ),
    ':USER_ID'::uuid,
    21
  ),
  (
    'i1i1i1i1-0001-0001-0001-000000000002',
    NULL,  -- Rapport global (tous chantiers)
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Rapport Mai 2026',
    'monthly',
    jsonb_build_object(
      'summary', 'Bilan mensuel — 5 chantiers actifs. 2 réserves critiques en cours.',
      'projects_active', 5,
      'tasks_done', 8,
      'issues_critical', 2,
      'generated_at', CURRENT_DATE - INTERVAL '5 days'
    ),
    ':USER_ID'::uuid,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
-- Vérification post-insertion (exécuter séparément) :
--
-- SELECT COUNT(*) FROM projects WHERE org_id = '11111111-1111-1111-1111-111111111111' AND name LIKE '[DEMO]%';
-- SELECT COUNT(*) FROM artisans WHERE org_id = '11111111-1111-1111-1111-111111111111' AND notes = 'DEMO_PLANZY_DATASET';
-- SELECT COUNT(*) FROM tasks WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- SELECT COUNT(*) FROM issues WHERE org_id = '11111111-1111-1111-1111-111111111111' AND title LIKE '[DEMO]%';
-- SELECT id, title, status, end_date FROM tasks WHERE status = 'in_progress' AND end_date < CURRENT_DATE;
-- → Doit retourner T3.1 "Terrassement"
-- ============================================================
