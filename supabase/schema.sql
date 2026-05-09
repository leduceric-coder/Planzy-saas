-- ═══════════════════════════════════════════════════════════════
-- PLANZY — Schéma Supabase V2
-- Plateforme de gestion de chantiers BTP — 20 tables
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─── ENUMS ────────────────────────────────────────────────────
create type public.user_role as enum ('owner','admin','manager','site_supervisor','artisan','viewer');
create type public.project_status as enum ('active','paused','completed','archived');
create type public.task_status as enum ('todo','in_progress','blocked','review','done','validated');
create type public.issue_status as enum ('open','assigned','in_progress','fixed','validated','rejected');
create type public.message_type as enum ('text','consigne','probleme','question','photo','livraison_absente','tache_terminee','validation_demandee');

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

-- ─── organizations ────────────────────────────────────────────
create table public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  logo_url text,
  plan text default 'free' check (plan in ('free','pro','team','enterprise')),
  settings jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.organizations enable row level security;
create policy "Org visible par ses membres" on public.organizations for select
  using (id in (select org_id from public.profiles where id = auth.uid()));
create policy "Org modifiable par owner/admin" on public.organizations for update
  using (id in (select org_id from public.profiles where id = auth.uid() and role in ('owner','admin')));

-- ─── profiles ─────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  role public.user_role default 'viewer',
  org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_profiles_org_id on public.profiles(org_id);
alter table public.profiles enable row level security;
create policy "Profil visible par les membres de la même org" on public.profiles for select
  using (auth.uid()=id or org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Profil modifiable par son propriétaire" on public.profiles for update using (auth.uid()=id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─── projects ─────────────────────────────────────────────────
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  address text,
  status public.project_status default 'active',
  start_date date,
  end_date date,
  budget numeric(12,2),
  progress integer default 0 check (progress between 0 and 100),
  color text default '#2563EB',
  image_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_projects_org_id on public.projects(org_id);
create index idx_projects_status on public.projects(status);
alter table public.projects enable row level security;
create policy "Projets visibles par l'org" on public.projects for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Projets créables par manager+" on public.projects for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));
create policy "Projets modifiables par manager+" on public.projects for update
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));
create trigger projects_updated_at before update on public.projects for each row execute function public.update_updated_at();

-- ─── project_members ──────────────────────────────────────────
create table public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.user_role default 'viewer',
  joined_at timestamptz default now(),
  unique(project_id,user_id)
);
alter table public.project_members enable row level security;
create policy "Membres visibles par l'org" on public.project_members for select
  using (project_id in (select id from public.projects where org_id in (select org_id from public.profiles where id=auth.uid())));

-- ─── artisans ─────────────────────────────────────────────────
create table public.artisans (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  full_name text not null,
  trade text not null,
  phone text, email text,
  user_id uuid references auth.users(id) on delete set null,
  avatar_url text,
  color text default '#2563EB',
  notes text,
  created_at timestamptz default now()
);
create index idx_artisans_org_id on public.artisans(org_id);
alter table public.artisans enable row level security;
create policy "Artisans visibles par l'org" on public.artisans for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Artisans gérables par manager+" on public.artisans for all
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));

-- ─── teams ────────────────────────────────────────────────────
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null, color text default '#7C3AED',
  lead_id uuid references public.artisans(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.teams enable row level security;
create policy "Équipes visibles par l'org" on public.teams for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Équipes gérables par manager+" on public.teams for all
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));

-- ─── team_members ─────────────────────────────────────────────
create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  artisan_id uuid references public.artisans(id) on delete cascade not null,
  joined_at timestamptz default now(),
  unique(team_id,artisan_id)
);
alter table public.team_members enable row level security;
create policy "Membres équipes visibles par l'org" on public.team_members for select
  using (team_id in (select id from public.teams where org_id in (select org_id from public.profiles where id=auth.uid())));

-- ─── tasks ────────────────────────────────────────────────────
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  title text not null, description text,
  status public.task_status default 'todo',
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  start_date date, end_date date,
  assigned_to uuid references public.artisans(id) on delete set null,
  assigned_team uuid references public.teams(id) on delete set null,
  estimated_hours numeric(6,2), actual_hours numeric(6,2),
  parent_task_id uuid references public.tasks(id) on delete set null,
  position integer default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index idx_tasks_project_id on public.tasks(project_id);
create index idx_tasks_org_id on public.tasks(org_id);
create index idx_tasks_assigned_to on public.tasks(assigned_to);
create index idx_tasks_end_date on public.tasks(end_date);
alter table public.tasks enable row level security;
create policy "Manager+ voient toutes les tâches" on public.tasks for select
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor','viewer')));
create policy "Artisans voient leurs tâches" on public.tasks for select
  using (exists (select 1 from public.profiles p join public.artisans a on a.user_id=p.id where p.id=auth.uid() and p.role='artisan' and a.id=tasks.assigned_to));
create policy "Tâches gérables par manager+" on public.tasks for all
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));
create policy "Artisans peuvent mettre à jour leurs tâches" on public.tasks for update
  using (exists (select 1 from public.profiles p join public.artisans a on a.user_id=p.id where p.id=auth.uid() and p.role='artisan' and a.id=tasks.assigned_to));
create trigger tasks_updated_at before update on public.tasks for each row execute function public.update_updated_at();

-- ─── task_dependencies ────────────────────────────────────────
create table public.task_dependencies (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  depends_on_task_id uuid references public.tasks(id) on delete cascade not null,
  type text default 'finish_to_start' check (type in ('finish_to_start','start_to_start')),
  unique(task_id,depends_on_task_id)
);
alter table public.task_dependencies enable row level security;
create policy "Dépendances visibles par l'org" on public.task_dependencies for select
  using (task_id in (select id from public.tasks where org_id in (select org_id from public.profiles where id=auth.uid())));

-- ─── message_threads ──────────────────────────────────────────
create table public.message_threads (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  title text, type text default 'project' check (type in ('project','team','direct','broadcast')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.message_threads enable row level security;
create policy "Threads visibles par l'org" on public.message_threads for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));

-- ─── messages ─────────────────────────────────────────────────
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  thread_id uuid references public.message_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) not null,
  content text not null,
  type public.message_type default 'text',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index idx_messages_thread_id on public.messages(thread_id);
create index idx_messages_created_at on public.messages(created_at desc);
alter table public.messages enable row level security;
create policy "Messages visibles par l'org" on public.messages for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Messages envoyables par les membres" on public.messages for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid()) and sender_id=auth.uid());

-- ─── issues ───────────────────────────────────────────────────
create table public.issues (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  title text not null, description text,
  status public.issue_status default 'open',
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  reported_by uuid references auth.users(id),
  assigned_to uuid references public.artisans(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index idx_issues_project_id on public.issues(project_id);
alter table public.issues enable row level security;
create policy "Réserves visibles et gérables par l'org" on public.issues for all
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create trigger issues_updated_at before update on public.issues for each row execute function public.update_updated_at();

-- ─── documents ────────────────────────────────────────────────
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null, file_url text not null,
  file_type text, file_size bigint, category text,
  task_id uuid references public.tasks(id) on delete set null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.documents enable row level security;
create policy "Documents visibles par l'org" on public.documents for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Documents uploadables" on public.documents for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Documents supprimables par manager+" on public.documents for delete
  using (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));

-- ─── photos ───────────────────────────────────────────────────
create table public.photos (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  url text not null, thumbnail_url text, caption text, theme text,
  task_id uuid references public.tasks(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  taken_by uuid references auth.users(id),
  taken_at timestamptz default now(), created_at timestamptz default now()
);
alter table public.photos enable row level security;
create policy "Photos visibles par l'org" on public.photos for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Photos uploadables" on public.photos for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Photos supprimables" on public.photos for delete
  using (taken_by=auth.uid() or org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager')));

-- ─── materials ────────────────────────────────────────────────
create table public.materials (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null, quantity numeric(10,2) default 0, unit text default 'unité',
  status text default 'pending' check (status in ('pending','ordered','delivered','delayed','cancelled')),
  task_id uuid references public.tasks(id) on delete set null,
  expected_delivery date, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.materials enable row level security;
create policy "Matériaux gérables par l'org" on public.materials for all
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create trigger materials_updated_at before update on public.materials for each row execute function public.update_updated_at();

-- ─── deliveries ───────────────────────────────────────────────
create table public.deliveries (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  material_id uuid references public.materials(id) on delete set null,
  supplier text not null, scheduled_date date not null, actual_date date,
  status text default 'scheduled' check (status in ('scheduled','delivered','delayed','cancelled')),
  notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.deliveries enable row level security;
create policy "Livraisons gérables par l'org" on public.deliveries for all
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create trigger deliveries_updated_at before update on public.deliveries for each row execute function public.update_updated_at();

-- ─── reports ──────────────────────────────────────────────────
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade not null,
  title text not null, type text default 'weekly' check (type in ('weekly','monthly','incident','handover')),
  content jsonb default '{}', generated_by uuid references auth.users(id),
  week_number integer, created_at timestamptz default now()
);
alter table public.reports enable row level security;
create policy "Rapports visibles par l'org" on public.reports for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Rapports créables par manager+" on public.reports for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid() and role in ('owner','admin','manager','site_supervisor')));

-- ─── notifications ────────────────────────────────────────────
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null, body text not null, type text,
  read boolean default false, link text,
  created_at timestamptz default now()
);
create index idx_notifications_user_id on public.notifications(user_id);
alter table public.notifications enable row level security;
create policy "Notifications pour leur destinataire" on public.notifications for all using (auth.uid()=user_id);

-- ─── activity_logs ────────────────────────────────────────────
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references auth.users(id),
  action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index idx_logs_org_id on public.activity_logs(org_id);
alter table public.activity_logs enable row level security;
create policy "Logs visibles par l'org" on public.activity_logs for select
  using (org_id in (select org_id from public.profiles where id=auth.uid()));
create policy "Logs créables par les membres" on public.activity_logs for insert
  with check (org_id in (select org_id from public.profiles where id=auth.uid()));

-- ─── STORAGE ──────────────────────────────────────────────────
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('photos','photos',false,10485760,array['image/jpeg','image/png','image/webp','image/heic']),
  ('documents','documents',false,52428800,array['application/pdf','image/jpeg','image/png']),
  ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy "Photos uploadables" on storage.objects for insert with check (bucket_id='photos' and auth.role()='authenticated');
create policy "Photos visibles" on storage.objects for select using (bucket_id='photos' and auth.role()='authenticated');
create policy "Documents uploadables" on storage.objects for insert with check (bucket_id='documents' and auth.role()='authenticated');
create policy "Documents visibles" on storage.objects for select using (bucket_id='documents' and auth.role()='authenticated');
create policy "Avatars publics" on storage.objects for select using (bucket_id='avatars');
create policy "Avatars uploadables" on storage.objects for insert with check (bucket_id='avatars' and auth.uid()::text=(storage.foldername(name))[1]);
