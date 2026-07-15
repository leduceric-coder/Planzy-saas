-- ============================================================================
-- LOT 42A — VIEWER READ-ONLY (APPLIQUÉ le 2026-07-24 via MCP apply_migration).
-- Rend le rôle 'viewer' strictement en lecture seule : ajoute can_write_org()
-- (rôle != 'viewer') aux policies d'écriture des tables métier. Les rôles
-- internes et artisan sont inchangés (aucune restriction de scope artisan → 42E).
-- issues : ajout d'une policy SELECT org-wide pour préserver la lecture (la
-- policy ALL était l'unique chemin de lecture). invitations : déjà owner/admin.
-- Réversible : retirer le AND public.can_write_org() des policies + DROP FUNCTION.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_write_org()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select public.current_profile_role() is distinct from 'viewer' $$;
GRANT EXECUTE ON FUNCTION public.can_write_org() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_write_org() FROM anon, public;

-- projects
DROP POLICY IF EXISTS "Projets créables"   ON public.projects;
CREATE POLICY "Projets créables" ON public.projects FOR INSERT TO public
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());
DROP POLICY IF EXISTS "Projets modifiables" ON public.projects;
CREATE POLICY "Projets modifiables" ON public.projects FOR UPDATE TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- tasks (ALL)
DROP POLICY IF EXISTS "Tâches gérables" ON public.tasks;
CREATE POLICY "Tâches gérables" ON public.tasks FOR ALL TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org())
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- photos (artisan upload conservé : seul 'viewer' est exclu)
DROP POLICY IF EXISTS "Photos uploadables" ON public.photos;
CREATE POLICY "Photos uploadables" ON public.photos FOR INSERT TO public
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());
DROP POLICY IF EXISTS "Photos supprimables" ON public.photos;
CREATE POLICY "Photos supprimables" ON public.photos FOR DELETE TO public
  USING (((taken_by = auth.uid()) OR (org_id IN (select get_my_org_ids()))) AND public.can_write_org());

-- documents
DROP POLICY IF EXISTS "Documents uploadables" ON public.documents;
CREATE POLICY "Documents uploadables" ON public.documents FOR INSERT TO public
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());
DROP POLICY IF EXISTS "Documents supprimables" ON public.documents;
CREATE POLICY "Documents supprimables" ON public.documents FOR DELETE TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- messages (artisan envoi conservé : seul 'viewer' est exclu)
DROP POLICY IF EXISTS "Messages envoyables" ON public.messages;
CREATE POLICY "Messages envoyables" ON public.messages FOR INSERT TO public
  WITH CHECK (org_id IN (select get_my_org_ids()) AND sender_id = auth.uid() AND public.can_write_org());

-- teams / team_members
DROP POLICY IF EXISTS "Équipes gérables" ON public.teams;
CREATE POLICY "Équipes gérables" ON public.teams FOR ALL TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org())
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());
DROP POLICY IF EXISTS "Membres équipes gérables" ON public.team_members;
CREATE POLICY "Membres équipes gérables" ON public.team_members FOR ALL TO public
  USING (team_id IN (select teams.id from teams where teams.org_id IN (select get_my_org_ids())) AND public.can_write_org())
  WITH CHECK (team_id IN (select teams.id from teams where teams.org_id IN (select get_my_org_ids())) AND public.can_write_org());

-- reports
DROP POLICY IF EXISTS "Rapports créables" ON public.reports;
CREATE POLICY "Rapports créables" ON public.reports FOR INSERT TO public
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- artisans (couverture viewer ; scope 'manager+' réel = LOT 42E, non touché ici)
DROP POLICY IF EXISTS "Artisans gérables par manager+" ON public.artisans;
CREATE POLICY "Artisans gérables par manager+" ON public.artisans FOR ALL TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org())
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- issues (réserves) : la policy ALL était l'UNIQUE chemin de lecture. On AJOUTE
-- une policy SELECT org-wide (préserve la lecture viewer, OR des policies) puis
-- on restreint la policy d'écriture au non-viewer. Aucune lecture retirée.
DROP POLICY IF EXISTS "Réserves visibles" ON public.issues;
CREATE POLICY "Réserves visibles" ON public.issues FOR SELECT TO public
  USING (org_id IN (select get_my_org_ids()));
DROP POLICY IF EXISTS "Réserves gérables" ON public.issues;
CREATE POLICY "Réserves gérables" ON public.issues FOR ALL TO public
  USING (org_id IN (select get_my_org_ids()) AND public.can_write_org())
  WITH CHECK (org_id IN (select get_my_org_ids()) AND public.can_write_org());

-- invitations : INSERT/UPDATE déjà restreints à owner/admin (viewer déjà bloqué) → inchangé.

-- Vérification post-application (à lire avant COMMIT en exécution gated) :
--   -- simuler un viewer : doit échouer sur INSERT projects/tasks/etc.
--   -- simuler un owner/artisan : inchangé.

COMMIT;
