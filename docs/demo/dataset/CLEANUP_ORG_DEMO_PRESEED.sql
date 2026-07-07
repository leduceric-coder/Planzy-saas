-- ============================================================
-- PLANZY — NETTOYAGE PRÉ-DATASET DÉMO
-- ============================================================
-- ATTENTION : NE PAS EXÉCUTER sans autorisation explicite.
--
-- Org cible     : 6da6a801-254c-4ce8-8859-344e0988c011
-- Projet test   : b347b60e-3dd4-4c2f-8df2-aa99a4772ef9 (Chantier test1)
-- Tâche test    : 1b0daa4b-3a3e-4714-a5d8-328524159d68 (Fondations — todo)
-- Artisan test  : René Dupont — Maçon (ciblé par full_name + org_id)
--
-- Dépendances vérifiées le 2026-06-05 :
--   tasks liées au projet  : 1  → supprimée explicitement (section 1)
--   issues                 : 0
--   photos                 : 0
--   documents              : 0
--   reports                : 0
--   activity_logs          : 0
--   message_threads        : 0
--   project_members        : 0
--   tasks assignées artisan: 1  → la même tâche (section 1)
--   teams lead_id artisan  : 0
--   team_members artisan   : 0
--   issues assigned artisan: 0
--
-- Résultat attendu : org vide de toute donnée non-DEMO
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 0 — Vérification finale avant suppression (READ ONLY)
-- Exécuter séparément pour confirmer l'état avant de lancer BEGIN
-- ────────────────────────────────────────────────────────────

-- SELECT id, name FROM public.projects WHERE org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- → Attendu : 1 ligne — Chantier test1

-- SELECT id, full_name FROM public.artisans WHERE org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- → Attendu : 1 ligne — René Dupont

-- SELECT id, title, status FROM public.tasks WHERE project_id = 'b347b60e-3dd4-4c2f-8df2-aa99a4772ef9';
-- → Attendu : 1 ligne — Fondations / todo

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — Suppression (atomique)
-- Ordre : tâche → projet (cascade vide) → artisan
-- ────────────────────────────────────────────────────────────

BEGIN;

-- 1.1 Supprimer la tâche Fondations (UUID exact)
DELETE FROM public.tasks
WHERE id = '1b0daa4b-3a3e-4714-a5d8-328524159d68'
  AND project_id = 'b347b60e-3dd4-4c2f-8df2-aa99a4772ef9'
  AND org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- Sécurité : WHERE triple (id + project_id + org_id)
-- Attendu : 1 row deleted

-- 1.2 Supprimer le projet Chantier test1 (UUID exact)
-- Les cascades sont désormais vides (tâche supprimée en 1.1)
DELETE FROM public.projects
WHERE id = 'b347b60e-3dd4-4c2f-8df2-aa99a4772ef9'
  AND org_id = '6da6a801-254c-4ce8-8859-344e0988c011'
  AND name = 'Chantier test1';
-- Sécurité : WHERE triple (id + org_id + name)
-- Attendu : 1 row deleted

-- 1.3 Supprimer l'artisan René Dupont
DELETE FROM public.artisans
WHERE full_name = 'René Dupont'
  AND org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- Sécurité : WHERE double (full_name + org_id)
-- Attendu : 1 row deleted

COMMIT;

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — Vérifications post-nettoyage (READ ONLY)
-- ────────────────────────────────────────────────────────────

-- SELECT COUNT(*) FROM public.projects  WHERE org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- → Attendu : 0

-- SELECT COUNT(*) FROM public.artisans  WHERE org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- → Attendu : 0

-- SELECT COUNT(*) FROM public.tasks     WHERE org_id = '6da6a801-254c-4ce8-8859-344e0988c011';
-- → Attendu : 0

-- ============================================================
-- FIN DU SCRIPT DE NETTOYAGE
-- Dataset [DEMO] prêt à être injecté une fois ce script validé.
-- ============================================================
