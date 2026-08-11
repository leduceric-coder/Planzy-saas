-- ── LOT 42D — Durcissement de update_member_profile ──────────────────────────
--
-- La RPC reste l'AUTORITÉ finale sur les changements de rôle : l'UI et la route
-- API ne sont que des défenses en profondeur. Complète LOT 42D-P0, qui a retiré
-- aux rôles authenticated/anon le droit d'écrire profiles.role directement.
--
-- Ajouts par rapport à la version précédente :
--   1.  auth.uid() obligatoire                      -> non_authentifie
--   2.  caller existant et rattaché à une org       -> non_autorise
--   3.  cible existante                             -> member_not_found
--   4.  caller <> cible                             -> cannot_change_own_role
--   5.  même organisation                           -> non_autorise
--   6.  caller ∈ (owner, admin)                     -> non_autorise
--   7.  'owner' non attribuable, quel que soit le caller (le transfert de
--       propriété est un workflow distinct, hors de ce lot)
--                                                   -> cannot_assign_owner
--   8.  un owner n'est modifiable que par un owner  -> cannot_modify_owner
--   9.  un admin ne modifie pas un admin            -> cannot_modify_admin
--   10. seul un owner attribue 'admin'              -> only_owner_can_manage_admin
--   11. passage à 'artisan' : périmètre opérationnel requis (artisan lié, dans
--       l'org, avec au moins un rattachement chantier actif)
--                                                   -> artisan_scope_required
--
-- Conservé à l'identique : SECURITY DEFINER, search_path, contrôle d'org,
-- artisan_autre_org, artisan_deja_lie, protection du dernier owner, et la
-- synchronisation de artisans.user_id.
--
-- Sémantique inchangée de p_new_artisan_id : la valeur passée fait foi (NULL
-- délie l'artisan). C'est ce dont dépend « Détacher l'artisan » dans les
-- Réglages ; les appelants qui veulent préserver le lien doivent transmettre
-- l'artisan_id courant.
--
-- Les rattachements artisan_project_assignments / artisan_task_assignments ne
-- sont JAMAIS touchés ici : ils sont portés par artisan_id, pas par le profil.
-- Un changement de rôle ne peut donc pas les supprimer.

CREATE OR REPLACE FUNCTION public.update_member_profile(
  p_member_id uuid,
  p_new_role user_role,
  p_new_artisan_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id      uuid := auth.uid();
  v_caller_org     uuid;
  v_caller_role    text;
  v_member_org     uuid;
  v_member_role    text;
  v_old_artisan_id uuid;
  v_owner_count    int;
  v_artisan_linked uuid;
  v_scope_artisan  uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'non_authentifie');
  END IF;

  SELECT org_id, role::text INTO v_caller_org, v_caller_role
  FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_org IS NULL THEN
    RETURN jsonb_build_object('error', 'non_autorise');
  END IF;

  SELECT org_id, role::text, artisan_id
  INTO v_member_org, v_member_role, v_old_artisan_id
  FROM public.profiles WHERE id = p_member_id;
  IF v_member_role IS NULL THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;

  IF v_caller_id = p_member_id THEN
    RETURN jsonb_build_object('error', 'cannot_change_own_role');
  END IF;

  IF v_member_org IS DISTINCT FROM v_caller_org THEN
    RETURN jsonb_build_object('error', 'non_autorise');
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN jsonb_build_object('error', 'non_autorise');
  END IF;

  IF p_new_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'cannot_assign_owner');
  END IF;

  IF v_member_role = 'owner' AND v_caller_role <> 'owner' THEN
    RETURN jsonb_build_object('error', 'cannot_modify_owner');
  END IF;

  IF v_caller_role = 'admin' AND v_member_role = 'admin' THEN
    RETURN jsonb_build_object('error', 'cannot_modify_admin');
  END IF;

  IF v_caller_role = 'admin' AND p_new_role = 'admin' THEN
    RETURN jsonb_build_object('error', 'only_owner_can_manage_admin');
  END IF;

  IF v_member_role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM public.profiles
    WHERE org_id = v_caller_org AND role = 'owner' AND id <> p_member_id;
    IF v_owner_count = 0 THEN
      RETURN jsonb_build_object('error', 'dernier_owner');
    END IF;
  END IF;

  -- Passage à « artisan » : le périmètre opérationnel doit exister AVANT.
  -- Aucun rattachement n'est créé ici.
  IF p_new_role = 'artisan' THEN
    v_scope_artisan := COALESCE(p_new_artisan_id, v_old_artisan_id);
    IF v_scope_artisan IS NULL THEN
      RETURN jsonb_build_object('error', 'artisan_scope_required');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.artisans WHERE id = v_scope_artisan AND org_id = v_caller_org
    ) THEN
      RETURN jsonb_build_object('error', 'artisan_autre_org');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.artisan_project_assignments
      WHERE artisan_id = v_scope_artisan AND is_active = true
    ) THEN
      RETURN jsonb_build_object('error', 'artisan_scope_required');
    END IF;
  END IF;

  IF v_old_artisan_id IS NOT NULL AND v_old_artisan_id IS DISTINCT FROM p_new_artisan_id THEN
    UPDATE public.artisans SET user_id = NULL
    WHERE id = v_old_artisan_id AND user_id = p_member_id;
  END IF;

  IF p_new_artisan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.artisans WHERE id = p_new_artisan_id AND org_id = v_caller_org
    ) THEN
      RETURN jsonb_build_object('error', 'artisan_autre_org');
    END IF;
    SELECT user_id INTO v_artisan_linked FROM public.artisans WHERE id = p_new_artisan_id;
    IF v_artisan_linked IS NOT NULL AND v_artisan_linked <> p_member_id THEN
      RETURN jsonb_build_object('error', 'artisan_deja_lie');
    END IF;
    UPDATE public.artisans SET user_id = p_member_id WHERE id = p_new_artisan_id;
  END IF;

  UPDATE public.profiles
  SET role = p_new_role, artisan_id = p_new_artisan_id, updated_at = now()
  WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_role', v_member_role,
    'new_role', p_new_role::text
  );
END;
$function$;
