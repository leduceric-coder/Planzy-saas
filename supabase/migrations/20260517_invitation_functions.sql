-- ═══════════════════════════════════════════════════════════════
-- Sprint Collaboration — Migration 2
-- Fonctions SECURITY DEFINER pour le flow d'invitation
-- Applied via MCP Supabase on 2026-05-17
-- ═══════════════════════════════════════════════════════════════

-- 1. Lire une invitation par token (accessible sans auth — anon key)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv  public.invitations%ROWTYPE;
  v_org_name text;
BEGIN
  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() AND v_inv.status = 'pending' THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_inv.id;
    v_inv.status := 'expired';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_inv.org_id;

  RETURN jsonb_build_object(
    'id',          v_inv.id,
    'email',       v_inv.email,
    'role',        v_inv.role::text,
    'org_id',      v_inv.org_id,
    'org_name',    coalesce(v_org_name, 'Organisation'),
    'artisan_id',  v_inv.artisan_id,
    'status',      v_inv.status,
    'expires_at',  v_inv.expires_at,
    'created_at',  v_inv.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 2. Accepter une invitation (nécessite auth, vérifie email)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv        public.invitations%ROWTYPE;
  v_user_email text;
  v_user_id    uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'non_authentifié');
  END IF;

  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invitation_introuvable'); END IF;
  IF v_inv.status = 'accepted'                   THEN RETURN jsonb_build_object('error', 'déjà_acceptée'); END IF;
  IF v_inv.status IN ('expired','revoked')        THEN RETURN jsonb_build_object('error', v_inv.status); END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
  IF lower(v_user_email) != lower(v_inv.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch', 'invited_email', v_inv.email);
  END IF;

  UPDATE public.profiles SET
    org_id     = v_inv.org_id,
    role       = v_inv.role,
    artisan_id = v_inv.artisan_id,
    updated_at = now()
  WHERE id = v_user_id;

  IF v_inv.artisan_id IS NOT NULL THEN
    UPDATE public.artisans SET user_id = v_user_id
    WHERE id = v_inv.artisan_id AND org_id = v_inv.org_id;
  END IF;

  UPDATE public.invitations SET
    status      = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'role', v_inv.role::text, 'org_id', v_inv.org_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- 3. Owner/admin peut changer le rôle d'un membre de son org
CREATE OR REPLACE FUNCTION public.update_member_role(p_member_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_org  uuid;
  v_member_org  uuid;
  v_caller_role text;
BEGIN
  SELECT org_id, role::text INTO v_caller_org, v_caller_role
  FROM public.profiles WHERE id = auth.uid();

  SELECT org_id INTO v_member_org FROM public.profiles WHERE id = p_member_id;

  IF v_caller_org IS NULL OR v_caller_org != v_member_org THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  IF v_caller_role NOT IN ('owner','admin') THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  IF v_caller_role = 'admin' AND p_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;

  UPDATE public.profiles SET role = p_role::public.user_role, updated_at = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, text) TO authenticated;
