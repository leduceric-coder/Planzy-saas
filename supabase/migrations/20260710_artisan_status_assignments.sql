-- LOT 41B/41C — Statuts artisan + rattachements explicites chantier/tâche
-- =============================================================================
-- ADDITIF & RÉTROCOMPATIBLE. NE MODIFIE AUCUNE POLICY RLS GLOBALE EXISTANTE
-- (projects/tasks/photos/documents/messages inchangées — ce sera le LOT 41D).
--
-- Contenu :
--   1. artisans.status ('active'|'suspended'|'archived') + backfill depuis
--      is_archived (conservé pour rétrocompat).
--   2. Clés uniques (id,org_id)/(id,project_id) pour FK composites de cohérence.
--   3. Tables de rattachement explicite : artisan_project_assignments,
--      artisan_task_assignments (cohérence org/chantier/tâche garantie par FK
--      composites — un rattachement tâche hors chantier est IMPOSSIBLE en base).
--   4. invitations.project_id + invitations.task_ids (périmètre d'invitation).
--   5. Fonctions helper (préparation LOT 41D) : rôle courant, artisan courant,
--      is_internal_role, is_artisan_active, can_access_project/task.
--   6. accept_invitation() étendue : VALIDE strictement le périmètre (chaque
--      task_id ∈ project_id de l'invitation ET même org, sinon
--      INVALID_INVITATION_SCOPE, aucun rattachement partiel) puis crée les
--      rattachements avec le project_id de l'INVITATION (jamais dérivé de la
--      tâche). Rétrocompatible : invitations sans périmètre = comportement inchangé.
--   7. RLS sur les NOUVELLES tables uniquement (org-scoped + écriture rôle interne).
--
-- Aucun DROP, aucun RENAME, aucune donnée supprimée.
-- =============================================================================

-- 1) Statut artisan -----------------------------------------------------------
alter table public.artisans
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='artisans_status_check' and conrelid='public.artisans'::regclass) then
    alter table public.artisans
      add constraint artisans_status_check check (status in ('active','suspended','archived'));
  end if;
end $$;

-- Backfill : les fiches déjà archivées deviennent status='archived' (source cible).
update public.artisans set status='archived' where is_archived = true and status <> 'archived';

-- 2) Clés uniques pour FK composites (id déjà unique → additif, sans réécriture) --
do $$
begin
  if not exists (select 1 from pg_constraint where conname='artisans_id_org_uk' and conrelid='public.artisans'::regclass) then
    alter table public.artisans add constraint artisans_id_org_uk unique (id, org_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='projects_id_org_uk' and conrelid='public.projects'::regclass) then
    alter table public.projects add constraint projects_id_org_uk unique (id, org_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='tasks_id_project_uk' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_id_project_uk unique (id, project_id);
  end if;
end $$;

-- 3) Table rattachement chantier ---------------------------------------------
create table if not exists public.artisan_project_assignments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  artisan_id  uuid not null,
  project_id  uuid not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  -- FK composites : garantissent artisan.org_id = org_id = project.org_id.
  constraint apa_artisan_fk foreign key (artisan_id, org_id) references public.artisans(id, org_id) on delete cascade,
  constraint apa_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade,
  constraint apa_unique unique (artisan_id, project_id)
);
create index if not exists idx_apa_artisan on public.artisan_project_assignments (artisan_id);
create index if not exists idx_apa_project on public.artisan_project_assignments (project_id);
create index if not exists idx_apa_org     on public.artisan_project_assignments (org_id);

-- Table rattachement tâche ----------------------------------------------------
create table if not exists public.artisan_task_assignments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  artisan_id  uuid not null,
  project_id  uuid not null,
  task_id     uuid not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  -- FK composites : org cohérent + tâche ∈ chantier (task hors chantier IMPOSSIBLE).
  constraint ata_artisan_fk foreign key (artisan_id, org_id)   references public.artisans(id, org_id) on delete cascade,
  constraint ata_project_fk foreign key (project_id, org_id)   references public.projects(id, org_id) on delete cascade,
  constraint ata_task_fk    foreign key (task_id, project_id)  references public.tasks(id, project_id) on delete cascade,
  constraint ata_unique unique (artisan_id, task_id)
);
create index if not exists idx_ata_artisan on public.artisan_task_assignments (artisan_id);
create index if not exists idx_ata_task    on public.artisan_task_assignments (task_id);
create index if not exists idx_ata_project on public.artisan_task_assignments (project_id);
create index if not exists idx_ata_org     on public.artisan_task_assignments (org_id);

-- 4) Périmètre d'invitation (nullable → rétrocompat ; validation applicative) --
alter table public.invitations add column if not exists project_id uuid;
alter table public.invitations add column if not exists task_ids   uuid[];
do $$
begin
  if not exists (select 1 from pg_constraint where conname='invitations_project_id_fkey' and conrelid='public.invitations'::regclass) then
    alter table public.invitations
      add constraint invitations_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
  end if;
end $$;

-- 5) Fonctions helper (préparation LOT 41D — n'affectent AUCUNE policy ici) ----
create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public
as $$ select role::text from public.profiles where id = auth.uid() $$;

create or replace function public.current_artisan_id()
returns uuid language sql stable security definer set search_path = public
as $$ select artisan_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_internal_role()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_profile_role() in ('owner','admin','manager','site_supervisor') $$;

create or replace function public.is_artisan_active()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select a.status = 'active' from public.artisans a where a.id = public.current_artisan_id()),
    true  -- utilisateurs non-artisan : non concernés
  )
$$;

-- Accès chantier : rôle interne → org ; artisan → rattachement explicite actif
-- (project assignment, OU tâche assignée, OU équipe rattachée au chantier).
create or replace function public.can_access_project(p_project uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid; v_art uuid;
begin
  select org_id into v_org from public.projects where id = p_project;
  if v_org is null then return false; end if;
  if v_org not in (select public.get_my_org_ids()) then return false; end if;
  if public.is_internal_role() then return true; end if;
  v_art := public.current_artisan_id();
  if v_art is null then return false; end if;
  return exists (select 1 from public.artisan_project_assignments a
                 where a.artisan_id = v_art and a.project_id = p_project and a.is_active)
      or exists (select 1 from public.artisan_task_assignments a
                 where a.artisan_id = v_art and a.project_id = p_project and a.is_active)
      or exists (select 1 from public.tasks t where t.project_id = p_project and t.assigned_to = v_art)
      or exists (select 1 from public.team_members tm join public.teams te on te.id = tm.team_id
                 where tm.artisan_id = v_art and te.project_id = p_project);
end $$;

-- Accès tâche : rôle interne → org ; artisan → tâche rattachée / assignée / via chantier.
create or replace function public.can_access_task(p_task uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid; v_proj uuid; v_art uuid;
begin
  select org_id, project_id into v_org, v_proj from public.tasks where id = p_task;
  if v_org is null then return false; end if;
  if v_org not in (select public.get_my_org_ids()) then return false; end if;
  if public.is_internal_role() then return true; end if;
  v_art := public.current_artisan_id();
  if v_art is null then return false; end if;
  return exists (select 1 from public.artisan_task_assignments a
                 where a.artisan_id = v_art and a.task_id = p_task and a.is_active)
      or exists (select 1 from public.tasks t where t.id = p_task and t.assigned_to = v_art)
      or public.can_access_project(v_proj);
end $$;

-- 6) accept_invitation() étendue — crée les rattachements à l'acceptation.
--    RÉTROCOMPATIBLE : sans project_id/task_ids, comportement identique à avant.
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_inv        public.invitations%ROWTYPE;
  v_user_email text;
  v_user_id    uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('error','non_authentifié'); end if;

  select * into v_inv from public.invitations where token = p_token;
  if not found then return jsonb_build_object('error','invitation_introuvable'); end if;
  if v_inv.status = 'accepted' then return jsonb_build_object('error','déjà_acceptée'); end if;
  if v_inv.status in ('expired','revoked') then return jsonb_build_object('error', v_inv.status); end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    update public.invitations set status='expired' where id = v_inv.id;
    return jsonb_build_object('error','expired');
  end if;

  select email into v_user_email from public.profiles where id = v_user_id;
  if lower(v_user_email) != lower(v_inv.email) then
    return jsonb_build_object('error','email_mismatch','invited_email', v_inv.email);
  end if;

  update public.profiles set
    org_id = v_inv.org_id, role = v_inv.role, artisan_id = v_inv.artisan_id, updated_at = now()
  where id = v_user_id;

  if v_inv.artisan_id is not null then
    update public.artisans set user_id = v_user_id
    where id = v_inv.artisan_id and org_id = v_inv.org_id;

    -- ── Validation STRICTE du périmètre (aucune dérivation silencieuse) ──────
    -- Le chantier fourni doit appartenir à l'org de l'invitation.
    if v_inv.project_id is not null then
      if not exists (
        select 1 from public.projects p
        where p.id = v_inv.project_id and p.org_id = v_inv.org_id
      ) then
        raise exception 'INVALID_INVITATION_SCOPE' using errcode = '23514';
      end if;
    end if;

    -- Si des tâches sont fournies : chantier obligatoire, et CHAQUE tâche doit
    -- exister, appartenir EXACTEMENT à v_inv.project_id ET à v_inv.org_id.
    if v_inv.task_ids is not null and array_length(v_inv.task_ids, 1) is not null then
      if v_inv.project_id is null then
        raise exception 'INVALID_INVITATION_SCOPE' using errcode = '23514';
      end if;
      if (
        select count(*) from public.tasks t
        where t.id = any (v_inv.task_ids)
          and t.project_id = v_inv.project_id
          and t.org_id     = v_inv.org_id
      ) <> array_length(v_inv.task_ids, 1) then
        raise exception 'INVALID_INVITATION_SCOPE' using errcode = '23514';
      end if;
    end if;

    -- ── Rattachements (après validation → aucun rattachement partiel) ────────
    -- project_id = celui de L'INVITATION (jamais dérivé de la tâche).
    if v_inv.project_id is not null then
      insert into public.artisan_project_assignments (org_id, artisan_id, project_id, assigned_by)
      values (v_inv.org_id, v_inv.artisan_id, v_inv.project_id, v_inv.invited_by)
      on conflict (artisan_id, project_id) do nothing;
    end if;

    if v_inv.task_ids is not null and array_length(v_inv.task_ids, 1) is not null then
      insert into public.artisan_task_assignments (org_id, artisan_id, project_id, task_id, assigned_by)
      select v_inv.org_id, v_inv.artisan_id, v_inv.project_id, tid, v_inv.invited_by
      from unnest(v_inv.task_ids) as tid
      on conflict (artisan_id, task_id) do nothing;
    end if;
  end if;

  update public.invitations set status='accepted', accepted_by=v_user_id, accepted_at=now()
  where id = v_inv.id;

  return jsonb_build_object('success', true, 'role', v_inv.role::text, 'org_id', v_inv.org_id::text);
end $$;

-- 7) RLS sur les NOUVELLES tables uniquement ----------------------------------
alter table public.artisan_project_assignments enable row level security;
alter table public.artisan_task_assignments    enable row level security;

grant select, insert, update, delete on public.artisan_project_assignments to authenticated;
grant select, insert, update, delete on public.artisan_task_assignments    to authenticated;

-- Lecture : membres de l'org ; un artisan ne voit que SES rattachements.
-- Écriture : rôles internes (owner/admin/manager/site_supervisor) de l'org.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='artisan_project_assignments' and policyname='apa_select') then
    create policy "apa_select" on public.artisan_project_assignments for select
      using (org_id in (select public.get_my_org_ids())
             and (public.is_internal_role() or artisan_id = public.current_artisan_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='artisan_project_assignments' and policyname='apa_write') then
    create policy "apa_write" on public.artisan_project_assignments for all
      using (org_id in (select public.get_my_org_ids()) and public.is_internal_role())
      with check (org_id in (select public.get_my_org_ids()) and public.is_internal_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='artisan_task_assignments' and policyname='ata_select') then
    create policy "ata_select" on public.artisan_task_assignments for select
      using (org_id in (select public.get_my_org_ids())
             and (public.is_internal_role() or artisan_id = public.current_artisan_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='artisan_task_assignments' and policyname='ata_write') then
    create policy "ata_write" on public.artisan_task_assignments for all
      using (org_id in (select public.get_my_org_ids()) and public.is_internal_role())
      with check (org_id in (select public.get_my_org_ids()) and public.is_internal_role());
  end if;
end $$;
