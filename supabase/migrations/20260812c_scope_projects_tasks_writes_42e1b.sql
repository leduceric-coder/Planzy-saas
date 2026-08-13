-- ── LOT 42E1B — Périmètre de sécurité sur les ÉCRITURES projects / tasks ─────
--
-- 42E1A a cloisonné la VISIBILITÉ. Voir une donnée ne donne pas le droit de la
-- modifier : un artisan voit 14 tâches de son chantier, il ne doit pouvoir
-- agir que sur les 3 qui lui sont réellement affectées, et seulement sur leur
-- avancement. Ce lot pose cette seconde frontière.
--
-- Règles :
--   projects  INSERT / UPDATE          -> rôles internes uniquement
--   projects  DELETE                   -> inchangé (aucune policy, donc refusé)
--   tasks     INSERT / DELETE          -> rôles internes uniquement
--   tasks     UPDATE                   -> interne, OU artisan actif sur une tâche
--                                         RÉELLEMENT affectée
--   colonnes  (artisan)                -> status et completed_at uniquement
--
-- « Réellement affectée » = artisan_task_assignments actif OU tasks.assigned_to.
-- Volontairement PAS can_access_task() : ce helper est plus large, il sert à la
-- visibilité (il inclut l'appartenance au chantier). L'utiliser comme droit
-- d'écriture donnerait à l'artisan la main sur toutes les tâches du chantier.
--
-- Deux frontières distinctes, car la RLS seule ne sait pas restreindre des
-- COLONNES :
--   * niveau ligne  -> policies RESTRICTIVE ci-dessous ;
--   * niveau colonne -> trigger BEFORE UPDATE enforce_artisan_task_columns.
--
-- Le guard est future-proof : il compare OLD et NEW en jsonb privés des seules
-- colonnes autorisées, et rejette toute autre différence. Une colonne ajoutée
-- plus tard sera donc interdite par défaut, sans modification de ce code.
--
-- ORDRE DES TRIGGERS — critique. PostgreSQL déclenche les BEFORE triggers par
-- ordre alphabétique de nom. « enforce_artisan_task_columns » précède
-- « tasks_updated_at » (e < t), ce qui est nécessaire et vérifié :
--   1. le guard compare un NEW qui provient encore de la requête utilisateur,
--      donc une tentative de fournir updated_at est bien rejetée ;
--   2. tasks_updated_at pose ensuite updated_at automatiquement.
-- Dans l'ordre inverse, updated_at différerait toujours et TOUTE écriture
-- artisan serait rejetée. Ordre prouvé par pg_trigger et par test.
--
-- completed_at est écrit par l'application (MobileArtisanView « Marquer
-- terminé »), par aucun trigger. Il est donc autorisé pour l'artisan sur sa
-- propre tâche : compromis minimal assumé, le risque se limite à une date
-- d'achèvement arbitraire sur une tâche dont il est déjà responsable.
--
-- Dépendance assumée : la policy UPDATE lit artisan_task_assignments ; la
-- policy ata_select autorise déjà l'artisan à voir ses propres rattachements.
--
-- Validé en transaction annulée avant application (impersonation RLS réelle,
-- rôle PostgreSQL authenticated) : 24 contrôles verts, dont l'absence de
-- régression pour owner/admin/manager/site_supervisor (UPDATE project, INSERT
-- task RETURNING, UPDATE multi-colonnes, DELETE task), viewer refusé partout,
-- et lecture 42E1A inchangée (1 projet / 14 tâches).
--
-- ROLLBACK :
--   DROP POLICY IF EXISTS projects_insert_internal_42e1b ON public.projects;
--   DROP POLICY IF EXISTS projects_update_internal_42e1b ON public.projects;
--   DROP POLICY IF EXISTS tasks_insert_internal_42e1b    ON public.tasks;
--   DROP POLICY IF EXISTS tasks_delete_internal_42e1b    ON public.tasks;
--   DROP POLICY IF EXISTS tasks_update_scope_42e1b       ON public.tasks;
--   DROP TRIGGER IF EXISTS enforce_artisan_task_columns  ON public.tasks;
--   DROP FUNCTION IF EXISTS public.enforce_artisan_task_columns();
-- (ne touche pas projects_select_scope_42e1a / tasks_select_scope_42e1a)

-- ── Guard colonnes ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_artisan_task_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
BEGIN
  -- Rôles non artisan : aucun changement de comportement.
  IF public.current_profile_role() IS DISTINCT FROM 'artisan' THEN
    RETURN new;
  END IF;

  -- Tout est interdit sauf les colonnes explicitement autorisées.
  v_old := to_jsonb(old) - 'status' - 'completed_at';
  v_new := to_jsonb(new) - 'status' - 'completed_at';

  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'artisan_task_columns_forbidden'
      USING ERRCODE = '42501',
            HINT = 'Un artisan ne peut modifier que l''avancement de sa tâche.';
  END IF;

  RETURN new;
END
$function$;

CREATE TRIGGER enforce_artisan_task_columns
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_artisan_task_columns();

-- ── projects : administration réservée aux internes ──────────────────────────
CREATE POLICY projects_insert_internal_42e1b ON public.projects
AS RESTRICTIVE FOR INSERT
WITH CHECK (public.is_internal_role());

CREATE POLICY projects_update_internal_42e1b ON public.projects
AS RESTRICTIVE FOR UPDATE
USING (public.is_internal_role())
WITH CHECK (public.is_internal_role());

-- ── tasks : création et suppression réservées aux internes ───────────────────
CREATE POLICY tasks_insert_internal_42e1b ON public.tasks
AS RESTRICTIVE FOR INSERT
WITH CHECK (public.is_internal_role());

CREATE POLICY tasks_delete_internal_42e1b ON public.tasks
AS RESTRICTIVE FOR DELETE
USING (public.is_internal_role());

-- ── tasks : modification limitée aux tâches réellement affectées ─────────────
CREATE POLICY tasks_update_scope_42e1b ON public.tasks
AS RESTRICTIVE FOR UPDATE
USING (
  public.is_internal_role()
  OR (
    public.current_profile_role() = 'artisan'
    AND public.is_artisan_active()
    AND (
      tasks.assigned_to = public.current_artisan_id()
      OR EXISTS (
        SELECT 1 FROM public.artisan_task_assignments x
        WHERE x.artisan_id = public.current_artisan_id()
          AND x.task_id = tasks.id
          AND x.is_active
      )
    )
  )
)
WITH CHECK (
  public.is_internal_role()
  OR (
    public.current_profile_role() = 'artisan'
    AND public.is_artisan_active()
    AND (
      tasks.assigned_to = public.current_artisan_id()
      OR EXISTS (
        SELECT 1 FROM public.artisan_task_assignments x
        WHERE x.artisan_id = public.current_artisan_id()
          AND x.task_id = tasks.id
          AND x.is_active
      )
    )
  )
);
