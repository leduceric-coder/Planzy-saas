-- 2026-05-11 — Fix handle_new_user: auto-create an organization per new signup.
-- Previously the trigger inserted a profile with org_id = NULL, causing
-- "Impossible de charger votre organisation" on first dashboard load.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_slug   text;
  v_name   text;
BEGIN
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    'Mon espace'
  );

  v_slug := regexp_replace(
    lower(split_part(new.email, '@', 1)),
    '[^a-z0-9]', '-', 'g'
  ) || '-' || substr(new.id::text, 1, 8);

  INSERT INTO public.organizations (name, slug, plan, settings)
  VALUES (v_name, v_slug, 'free', '{}'::jsonb)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, email, full_name, role, org_id)
  VALUES (
    new.id,
    new.email,
    v_name,
    'owner',
    v_org_id
  );

  RETURN new;
END;
$$;
