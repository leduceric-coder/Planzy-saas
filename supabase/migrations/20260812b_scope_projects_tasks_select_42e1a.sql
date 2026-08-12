-- ── LOT 42E1A — Périmètre de sécurité sur la VISIBILITÉ de projects/tasks ────
--
-- Première application réelle du périmètre : jusqu'ici toutes les policies
-- métier étaient `org_id IN get_my_org_ids()`, donc un artisan lisait
-- l'organisation entière. Ce lot restreint UNIQUEMENT le SELECT de projects et
-- tasks. Les écritures ne sont pas redéfinies ici — c'est l'objet de 42E1B.
--
-- Approche : deux policies AS RESTRICTIVE, aucune policy existante n'est
-- touchée. Les policies permissives en place continuent d'accorder le SELECT
-- au niveau organisation ; la policy restrictive ne peut qu'ajouter une
-- condition, jamais élargir un droit. C'est le levier le moins destructif :
-- en cas de problème, un simple DROP des deux policies restaure l'état exact.
--
-- Règle :
--   interne (owner/admin/manager/site_supervisor) -> organisation entière
--   viewer                                        -> organisation entière (lecture)
--   artisan actif                                 -> can_access_project / can_access_task
--   artisan suspendu / archivé / non lié          -> rien
--   rôle inconnu, profil absent, non authentifié  -> rien (fail-closed)
--
-- Vérifié en transaction annulée avant application, par impersonation RLS
-- réelle (rôle PostgreSQL `authenticated`, jamais service_role) :
--   * owner / admin / manager / site_supervisor / viewer : ensembles d'IDs
--     strictement identiques avant/après (empreintes md5 égales) ;
--   * artisan : ensemble visible == ensemble autorisé par les helpers,
--     différence nulle dans les deux sens (EXCEPT) — 1 projet, 14 tâches ;
--   * hors périmètre : 0 ligne ; suspendu / archivé / non lié : 0 ligne ;
--     cross-org : 0 ligne.
--
-- Effets indirects mesurés sur les écritures (aucune policy d'écriture
-- modifiée ; ces effets découlent de la sémantique RLS de PostgreSQL) :
--   * UPDATE d'une tâche dans le périmètre, avec ou sans RETURNING : OK ;
--   * UPDATE d'une tâche hors périmètre : 0 ligne, sans erreur — l'application
--     traite déjà ce cas (TaskSidePanel contrôle les lignes affectées) ;
--   * INSERT sans RETURNING : OK ;
--   * INSERT ... RETURNING par un artisan : refusé. Les helpers sont STABLE et
--     ne voient pas la ligne créée par l'instruction en cours, donc la policy
--     SELECT rejette la ligne retournée. Chemin non exercé par l'application :
--     les trois points de création de tâche n'utilisent pas `.select()`, et la
--     création est réservée aux rôles internes, pour lesquels la policy
--     court-circuite sur is_internal_role(). À traiter explicitement en 42E1B.
--
-- ROLLBACK :
--   DROP POLICY IF EXISTS projects_select_scope_42e1a ON public.projects;
--   DROP POLICY IF EXISTS tasks_select_scope_42e1a    ON public.tasks;

CREATE POLICY projects_select_scope_42e1a ON public.projects
AS RESTRICTIVE FOR SELECT
USING (
  public.is_internal_role()
  OR public.current_profile_role() = 'viewer'
  OR (
    public.current_profile_role() = 'artisan'
    AND public.is_artisan_active()
    AND public.can_access_project(id)
  )
);

CREATE POLICY tasks_select_scope_42e1a ON public.tasks
AS RESTRICTIVE FOR SELECT
USING (
  public.is_internal_role()
  OR public.current_profile_role() = 'viewer'
  OR (
    public.current_profile_role() = 'artisan'
    AND public.is_artisan_active()
    AND public.can_access_task(id)
  )
);
