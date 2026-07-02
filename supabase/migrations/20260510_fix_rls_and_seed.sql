-- 2026-05-10 — Bootstrap fixes applied via MCP after Vercel deploy went green.
-- Documents in-DB changes so they are reproducible if the database is reset.

-- ─── 1. Security: lock down SECURITY DEFINER functions ─────────────────────────
ALTER FUNCTION public.get_my_org_ids() SET search_path = 'public';
ALTER FUNCTION public.is_org_admin(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_updated_at() SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_my_org_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

-- ─── 2. Storage: remove broad listing policy on public avatars bucket ──────────
DROP POLICY IF EXISTS "Avatars publics storage" ON storage.objects;

-- ─── 3. Fix broken get_my_org_ids referring to nonexistent organization_members
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() AND org_id IS NOT NULL;
$$;

-- ─── 4. Fix infinite recursion in profiles SELECT policy ───────────────────────
-- The old policy did SELECT FROM profiles inside its own USING clause, which
-- triggered RLS recursion. Replaced with a call to the SECURITY DEFINER helper.
DROP POLICY IF EXISTS "Profil visible meme org" ON public.profiles;
CREATE POLICY "Profil visible meme org" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR org_id IN (SELECT public.get_my_org_ids())
  );

-- ─── 5. Bootstrap data ─────────────────────────────────────────────────────────
-- Default organization. ID is stable so migration is idempotent.
INSERT INTO public.organizations (id, name, slug, plan, settings)
VALUES ('11111111-1111-1111-1111-111111111111', 'Planzy Test', 'planzy-test', 'pro', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Backfill any auth.users that are missing a profile (trigger may have been
-- created after the first signups).
INSERT INTO public.profiles (id, email, full_name, role, org_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'owner'::user_role,
  '11111111-1111-1111-1111-111111111111'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Demo project + artisans + team + tasks + issue + document + thread + message
-- so the dashboard is not empty after first login.
DO $$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_owner uuid;
  v_project uuid := '22222222-2222-2222-2222-222222222222';
  v_thread uuid := '33333333-3333-3333-3333-333333333333';
  v_artisan_macon uuid;
  v_artisan_elec uuid;
  v_artisan_plomb uuid;
  v_team uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = v_project) THEN
    RETURN;
  END IF;

  SELECT id INTO v_owner FROM public.profiles WHERE org_id = v_org AND role = 'owner' LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.projects (id, org_id, name, description, address, status, start_date, end_date, progress, color, created_by)
  VALUES (
    v_project, v_org,
    'Rénovation Maison Dupont',
    'Rénovation complète d''une maison individuelle de 120m² — gros œuvre, électricité, plomberie.',
    '42 rue des Lilas, 75015 Paris',
    'active', CURRENT_DATE - 30, CURRENT_DATE + 60, 35, '#2563EB', v_owner
  );

  v_artisan_macon := gen_random_uuid();
  v_artisan_elec := gen_random_uuid();
  v_artisan_plomb := gen_random_uuid();
  v_team := gen_random_uuid();

  INSERT INTO public.artisans (id, org_id, full_name, trade, phone, email, color) VALUES
    (v_artisan_macon, v_org, 'Pierre Martin', 'Maçon', '+33 6 12 34 56 78', 'pierre@martin-btp.fr', '#F97316'),
    (v_artisan_elec, v_org, 'Sophie Bernard', 'Électricien', '+33 6 23 45 67 89', 'sophie@bernard-elec.fr', '#EAB308'),
    (v_artisan_plomb, v_org, 'Karim Hamidi', 'Plombier', '+33 6 34 56 78 90', 'karim@hamidi-plomb.fr', '#06B6D4');

  INSERT INTO public.teams (id, org_id, name, color, lead_id) VALUES
    (v_team, v_org, 'Équipe Gros Œuvre', '#7C3AED', v_artisan_macon);

  INSERT INTO public.team_members (team_id, artisan_id) VALUES
    (v_team, v_artisan_macon), (v_team, v_artisan_plomb);

  INSERT INTO public.tasks (project_id, org_id, title, description, status, priority, start_date, end_date, assigned_to, position, created_by) VALUES
    (v_project, v_org, 'Démolition cloisons', 'Casser les cloisons non porteuses du salon', 'done', 'high', CURRENT_DATE - 25, CURRENT_DATE - 20, v_artisan_macon, 1, v_owner),
    (v_project, v_org, 'Coulage chape', 'Préparation et coulage de la chape salon-cuisine', 'in_progress', 'high', CURRENT_DATE - 5, CURRENT_DATE + 2, v_artisan_macon, 2, v_owner),
    (v_project, v_org, 'Tirage gaines électriques', 'Passage des gaines pour les nouveaux circuits', 'todo', 'medium', CURRENT_DATE + 3, CURRENT_DATE + 8, v_artisan_elec, 3, v_owner),
    (v_project, v_org, 'Installation tableau électrique', 'Pose et raccordement du nouveau tableau', 'todo', 'high', CURRENT_DATE + 9, CURRENT_DATE + 12, v_artisan_elec, 4, v_owner),
    (v_project, v_org, 'Plomberie cuisine', 'Arrivées et évacuations pour cuisine refaite', 'blocked', 'high', CURRENT_DATE - 3, CURRENT_DATE + 5, v_artisan_plomb, 5, v_owner);

  INSERT INTO public.issues (project_id, org_id, title, description, status, priority, reported_by) VALUES
    (v_project, v_org, 'Fuite découverte sous évier', 'Une fuite a été détectée derrière l''ancien évier lors de la dépose.', 'open', 'high', v_owner);

  INSERT INTO public.documents (project_id, org_id, name, file_url, file_type, category, uploaded_by) VALUES
    (v_project, v_org, 'Devis initial — Dupont.pdf', 'https://example.com/devis-dupont.pdf', 'application/pdf', 'Devis', v_owner);

  INSERT INTO public.message_threads (id, org_id, project_id, title, type, created_by)
  VALUES (v_thread, v_org, v_project, 'Chantier Dupont — Coordination', 'project', v_owner);

  INSERT INTO public.messages (org_id, project_id, thread_id, sender_id, content, type) VALUES
    (v_org, v_project, v_thread, v_owner, 'Bienvenue sur le chantier ! Merci de mettre à jour vos tâches chaque soir.', 'consigne');

  INSERT INTO public.activity_logs (org_id, project_id, user_id, action, entity_type) VALUES
    (v_org, v_project, v_owner, 'project_created', 'project'),
    (v_org, v_project, v_owner, 'tasks_created', 'task');
END $$;
