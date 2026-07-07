-- Member management functions
-- update_member_profile: update role and artisan link for a member (owner/admin only)
-- remove_member_from_org: remove a member from the organization without deleting auth.users

CREATE OR REPLACE FUNCTION public.update_member_profile(
  p_member_id    uuid,
  p_new_role     public.user_role,
  p_new_artisan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org        uuid;
  v_caller_role       text;
  v_member_org        uuid;
  v_member_role       text;
  v_old_artisan_id    uuid;
  v_owner_count       int;
  v_artisan_linked    uuid;
BEGIN
  SELECT org_id, role::text INTO v_caller_org, v_caller_role
  FROM public.profiles WHERE id = auth.uid();

  SELECT org_id, role::text, artisan_id INTO v_member_org, v_member_role, v_old_artisan_id
  FROM public.profiles WHERE id = p_member_id;

  -- Authorization
  IF v_caller_org IS NULL OR v_caller_org != v_member_org THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  -- Only owner can promote to owner
  IF v_caller_role = 'admin' AND p_new_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'seul_owner_peut_promouvoir');
  END IF;
  -- Prevent last owner demotion
  IF v_member_role = 'owner' AND p_new_role != 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM public.profiles
    WHERE org_id = v_caller_org AND role = 'owner' AND id != p_member_id;
    IF v_owner_count = 0 THEN
      RETURN jsonb_build_object('error', 'dernier_owner');
    END IF;
  END IF;

  -- Release old artisan link if changing artisan
  IF v_old_artisan_id IS NOT NULL AND v_old_artisan_id IS DISTINCT FROM p_new_artisan_id THEN
    UPDATE public.artisans SET user_id = NULL
    WHERE id = v_old_artisan_id AND user_id = p_member_id;
  END IF;

  -- Validate and link new artisan
  IF p_new_artisan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.artisans WHERE id = p_new_artisan_id AND org_id = v_caller_org
    ) THEN
      RETURN jsonb_build_object('error', 'artisan_autre_org');
    END IF;
    SELECT user_id INTO v_artisan_linked FROM public.artisans WHERE id = p_new_artisan_id;
    IF v_artisan_linked IS NOT NULL AND v_artisan_linked != p_member_id THEN
      RETURN jsonb_build_object('error', 'artisan_deja_lie');
    END IF;
    UPDATE public.artisans SET user_id = p_member_id WHERE id = p_new_artisan_id;
  END IF;

  UPDATE public.profiles
  SET role = p_new_role, artisan_id = p_new_artisan_id, updated_at = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_profile(uuid, public.user_role, uuid) TO authenticated;


-- remove_member_from_org: remove a member (sets org_id = null, frees artisan link)
CREATE OR REPLACE FUNCTION public.remove_member_from_org(
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org     uuid;
  v_caller_role    text;
  v_member_org     uuid;
  v_member_role    text;
  v_old_artisan_id uuid;
  v_owner_count    int;
BEGIN
  SELECT org_id, role::text INTO v_caller_org, v_caller_role
  FROM public.profiles WHERE id = auth.uid();

  SELECT org_id, role::text, artisan_id INTO v_member_org, v_member_role, v_old_artisan_id
  FROM public.profiles WHERE id = p_member_id;

  IF v_caller_org IS NULL OR v_caller_org != v_member_org THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('error', 'non_autorisé');
  END IF;
  IF auth.uid() = p_member_id THEN
    RETURN jsonb_build_object('error', 'cannot_remove_self');
  END IF;
  IF v_member_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM public.profiles
    WHERE org_id = v_caller_org AND role = 'owner' AND id != p_member_id;
    IF v_owner_count = 0 THEN
      RETURN jsonb_build_object('error', 'dernier_owner');
    END IF;
  END IF;

  -- Free artisan link
  IF v_old_artisan_id IS NOT NULL THEN
    UPDATE public.artisans SET user_id = NULL
    WHERE id = v_old_artisan_id AND user_id = p_member_id;
  END IF;

  -- Remove from org: null org_id, reset role to viewer, clear artisan
  UPDATE public.profiles
  SET org_id = NULL, role = 'viewer', artisan_id = NULL, updated_at = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_member_from_org(uuid) TO authenticated;
