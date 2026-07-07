-- ═══════════════════════════════════════════════════════════════
-- Sprint Collaboration — Migration 1
-- 1. profiles.artisan_id   → lien profil ↔ artisan
-- 2. public.invitations    → table des invitations
-- Applied via MCP Supabase on 2026-05-17
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS artisan_id uuid
  REFERENCES public.artisans(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.invitations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  role         public.user_role NOT NULL DEFAULT 'artisan',
  artisan_id   uuid        REFERENCES public.artisans(id) ON DELETE SET NULL,
  token        text        UNIQUE NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','accepted','expired','revoked')),
  invited_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_id  ON public.invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email    ON public.invitations(email);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invitations visibles par owner/admin"
  ON public.invitations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner','admin','manager')
  ));

CREATE POLICY "Invitations créables par owner/admin"
  ON public.invitations FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Invitations modifiables par owner/admin"
  ON public.invitations FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner','admin')
  ));
