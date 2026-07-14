-- ============================================================================
-- LOT 42 — P0 VIEWER READ-ONLY (CANDIDAT RLS — NON APPLIQUÉ — REQUIERT GATE GO)
-- ============================================================================
-- Problème (P0) : toutes les policies d'écriture des tables métier sont
-- org-wide SANS contrôle de rôle :
--   org_id IN (select get_my_org_ids())
-- => un compte 'viewer' peut créer/modifier chantiers, tâches, photos,
--    documents, messages, rapports, équipes au niveau BASE. L'UI ne masque ces
--    actions que sur la page Équipes (canManage) ; partout ailleurs elles sont
--    visibles. Les mutations étant client-side (mutationClient), la RLS est le
--    SEUL point d'application réel : une correction UI seule serait cosmétique.
--
-- Correction MINIMALE et SÛRE (ce candidat) : rendre 'viewer' strictement en
-- lecture seule, sans changer le comportement des rôles internes ni artisan.
-- On ajoute `public.can_write_org()` (rôle courant != 'viewer') à chaque policy
-- d'écriture. Aucune restriction de périmètre artisan ici (=> LOT 42E).
--
-- NE PAS exécuter sans GO. Réversible : redéfinir les policies sans le AND, ou
-- DROP FUNCTION can_write_org(). Aucune donnée modifiée.
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

-- Vérification post-application (à lire avant COMMIT en exécution gated) :
--   -- simuler un viewer : doit échouer sur INSERT projects/tasks/etc.
--   -- simuler un owner/artisan : inchangé.

COMMIT;
