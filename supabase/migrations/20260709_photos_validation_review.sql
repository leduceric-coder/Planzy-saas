-- LOT 39 — Modèle de validation des photos (additif, rétrocompatible)
-- =============================================================================
-- v2 (après NO-GO sur la policy UPDATE large) : la validation/refus passe
-- désormais par une fonction RPC sécurisée `review_photo` (SECURITY DEFINER,
-- role-gated) au lieu d'une policy UPDATE org-wide. AUCUNE policy UPDATE n'est
-- créée : la RLS photos reste inchangée (SELECT/INSERT/DELETE existants).
--
-- Modèle existant (audité en lecture seule sur qmuo) :
--   • photos.task_id uuid NULL  → FK tasks(id) ON DELETE SET NULL  (DÉJÀ présent)
--   • photos.taken_by uuid NULL → FK profiles(id) ON DELETE SET NULL (auteur)
--   • profiles.role enum : owner|admin|manager|site_supervisor|artisan|viewer
--   • profiles.org_id : organisation de l'utilisateur
--   • RLS photos : SELECT/INSERT/DELETE org-scoped ; AUCUNE policy UPDATE.
--
-- Ajouts (aucune suppression, aucun renommage, aucune donnée effacée) :
--   1. Colonnes de validation.
--   2. Index.
--   3. Fonction RPC `review_photo` (seul chemin d'écriture des champs de review).
-- =============================================================================

-- 1) Colonnes de validation ---------------------------------------------------
alter table public.photos
  add column if not exists validation_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'photos_validation_status_check' and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_validation_status_check
      check (validation_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

alter table public.photos
  add column if not exists reviewed_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'photos_reviewed_by_fkey' and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_reviewed_by_fkey
      foreign key (reviewed_by) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.photos
  add column if not exists reviewed_at timestamptz;

alter table public.photos
  add column if not exists review_comment text;

-- 2) Index --------------------------------------------------------------------
create index if not exists idx_photos_task_id           on public.photos (task_id);
create index if not exists idx_photos_validation_status  on public.photos (validation_status);
create index if not exists idx_photos_project_validation on public.photos (project_id, validation_status);

-- 3) RPC sécurisée de validation / refus --------------------------------------
-- SECURITY DEFINER (contourne la RLS en interne) → aucune policy UPDATE large
-- nécessaire. La fonction est la SEULE voie d'écriture des champs de review et
-- ne touche QUE validation_status / reviewed_by / reviewed_at / review_comment.
-- Contrôles : authentifié, statut valide, photo existante, MÊME organisation
-- que l'utilisateur, rôle autorisé (owner/admin/manager/site_supervisor).
-- Les artisans/viewers sont refusés (donc ne valident jamais, y compris leurs
-- propres photos).
create or replace function public.review_photo(
  p_photo_id uuid,
  p_status   text,
  p_comment  text default null
)
returns public.photos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_photo public.photos;
  v_role  text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select * into v_photo from public.photos where id = p_photo_id;
  if not found then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Organisation + rôle de l'utilisateur courant, contraints à l'org de la photo.
  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid and p.org_id = v_photo.org_id;

  if v_role is null or v_role not in ('owner', 'admin', 'manager', 'site_supervisor') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  update public.photos
  set validation_status = p_status,
      reviewed_by       = v_uid,
      reviewed_at       = now(),
      review_comment    = p_comment
  where id = p_photo_id
  returning * into v_photo;

  return v_photo;
end;
$$;

-- Droits : uniquement les utilisateurs authentifiés. Jamais anon.
revoke all     on function public.review_photo(uuid, text, text) from public;
revoke all     on function public.review_photo(uuid, text, text) from anon;
grant  execute on function public.review_photo(uuid, text, text) to   authenticated;
