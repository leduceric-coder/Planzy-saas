-- ============================================================================
-- LOT 41E-FIX6 — BACKFILL CANDIDAT (NON APPLIQUÉ — REQUIERT GATE GO EXPLICITE)
-- ============================================================================
-- Objectif : peupler les tables de rattachement explicite à partir des
-- affectations « planning » existantes, avant le durcissement RLS (LOT 41D).
--
-- NE PAS exécuter sans GO utilisateur. Aucune suppression, aucun overwrite,
-- aucune modification de tasks/teams/RLS/Storage. Uniquement des INSERT
-- idempotents (ON CONFLICT DO NOTHING).
--
-- Estimation dry-run (toutes organisations, tâches non done/validated) :
--   • ~20 artisan_project_assignments créés
--   • ~18 artisan_task_assignments créés
--   • ~10 artisans concernés
-- (Chiffres indicatifs au 2026-07-13 ; relancer le dry-run avant application.)
--
-- Rollback : les lignes créées sont identifiables par assigned_by IS NULL et
-- created_at = l'horodatage du backfill ; suppression possible sans toucher aux
-- rattachements créés manuellement. Aucune donnée métier n'est modifiée.
-- ============================================================================

BEGIN;

-- 1) Rattachements chantier depuis les tâches assigned_to (non terminées).
INSERT INTO public.artisan_project_assignments (org_id, artisan_id, project_id)
SELECT DISTINCT t.org_id, t.assigned_to, t.project_id
FROM public.tasks t
WHERE t.assigned_to IS NOT NULL
  AND t.status NOT IN ('done', 'validated')
ON CONFLICT (artisan_id, project_id) DO NOTHING;

-- 2) Rattachements chantier depuis les tâches assigned_team (via membres).
INSERT INTO public.artisan_project_assignments (org_id, artisan_id, project_id)
SELECT DISTINCT t.org_id, tm.artisan_id, t.project_id
FROM public.tasks t
JOIN public.team_members tm ON tm.team_id = t.assigned_team
WHERE t.assigned_team IS NOT NULL
  AND t.status NOT IN ('done', 'validated')
ON CONFLICT (artisan_id, project_id) DO NOTHING;

-- 3) Rattachements chantier depuis team_members + teams.project_id.
INSERT INTO public.artisan_project_assignments (org_id, artisan_id, project_id)
SELECT DISTINCT te.org_id, tm.artisan_id, te.project_id
FROM public.team_members tm
JOIN public.teams te ON te.id = tm.team_id
WHERE te.project_id IS NOT NULL
ON CONFLICT (artisan_id, project_id) DO NOTHING;

-- 4) Rattachements tâche depuis assigned_to (non terminées).
INSERT INTO public.artisan_task_assignments (org_id, artisan_id, project_id, task_id)
SELECT DISTINCT t.org_id, t.assigned_to, t.project_id, t.id
FROM public.tasks t
WHERE t.assigned_to IS NOT NULL
  AND t.status NOT IN ('done', 'validated')
ON CONFLICT (artisan_id, task_id) DO NOTHING;

-- 5) Rattachements tâche depuis assigned_team (via membres).
INSERT INTO public.artisan_task_assignments (org_id, artisan_id, project_id, task_id)
SELECT DISTINCT t.org_id, tm.artisan_id, t.project_id, t.id
FROM public.tasks t
JOIN public.team_members tm ON tm.team_id = t.assigned_team
WHERE t.assigned_team IS NOT NULL
  AND t.status NOT IN ('done', 'validated')
ON CONFLICT (artisan_id, task_id) DO NOTHING;

-- Vérification (à lire avant COMMIT en exécution manuelle gated) :
--   SELECT count(*) FROM public.artisan_project_assignments;
--   SELECT count(*) FROM public.artisan_task_assignments;

COMMIT;
