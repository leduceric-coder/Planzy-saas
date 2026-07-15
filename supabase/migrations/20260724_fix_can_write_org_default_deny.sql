-- ============================================================================
-- LOT 42A-FIX1 — DEFAULT DENY sur can_write_org() (APPLIQUÉ via MCP apply_migration).
-- ============================================================================
-- Avant : `current_profile_role() is distinct from 'viewer'` → true pour un rôle
--         null / inconnu / sans profil (fail-open).
-- Après : allowlist explicite (default deny). true UNIQUEMENT pour un profil dont
--         le rôle ∈ {owner, admin, manager, site_supervisor, artisan}. false pour
--         viewer, null, rôle inconnu, absence de profil, anon.
-- artisan reste true volontairement (transitoire) ; scope artisan = LOT 42E.
-- Seule la fonction est modifiée — aucune policy touchée.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_write_org()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('owner','admin','manager','site_supervisor','artisan')
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_write_org() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_write_org() FROM anon, public;
