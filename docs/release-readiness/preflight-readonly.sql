-- ============================================================================
-- LOT 30 — PREFLIGHT READ-ONLY (à exécuter manuellement)
-- ============================================================================
-- OBJET : vérifier l'état d'une base Supabase AVANT bascule vers la version riche.
-- SÉCURITÉ : 100% lecture seule (SELECT / information_schema / pg_catalog).
--            Aucune instruction DDL/DML. Ne modifie RIEN.
-- OÙ L'EXÉCUTER : Supabase Studio → SQL Editor du projet CIBLE (production).
--   Le projet cible doit correspondre à la valeur de NEXT_PUBLIC_SUPABASE_URL de
--   l'environnement Vercel *Production* de `kanvix-saas`.
--   (Presomption d'audit : projet `qmuowzsfxsuqythghmtx` / « planzy-saas ».)
-- LECTURE : chaque bloc renvoie un tableau étiqueté ; « present=1 » = OK.
-- ============================================================================

-- ── 0. Identité de la base (non sensible) ────────────────────────────────────
select current_database() as database,
       current_setting('server_version') as pg_version,
       now() as checked_at;

-- ── 1. Présence des objets de schéma riche (attendu : tous = 1) ──────────────
select
  (select count(*) from information_schema.tables  where table_schema='public' and table_name='invitations')                                   as t_invitations,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='artisan_id')          as c_profiles_artisan_id,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='tasks'    and column_name='completed_at')         as c_tasks_completed_at,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='messages' and column_name='linked_task_id')       as c_messages_linked_task_id,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='invitations' and column_name='email_send_count')  as c_invitations_email_tracking,
  (select count(*) from pg_proc where proname='accept_invitation')        as fn_accept_invitation,
  (select count(*) from pg_proc where proname='get_invitation_by_token')  as fn_get_invitation_by_token,
  (select count(*) from pg_proc where proname='update_member_profile')    as fn_update_member_profile,
  (select count(*) from pg_proc where proname='remove_member_from_org')   as fn_remove_member_from_org,
  (select count(*) from pg_proc where proname='update_member_role')       as fn_update_member_role,
  (select count(*) from pg_proc where proname='handle_new_user')          as fn_handle_new_user,
  (select count(*) from pg_proc where proname='get_my_org_ids')           as fn_get_my_org_ids,
  (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid
     where t.typname='message_type' and e.enumlabel='decision')           as enum_message_decision;

-- ── 2. Clés étrangères vers profiles (migration 20260514) — attendu : 1 ──────
select
  (select count(*) from information_schema.table_constraints where constraint_name='activity_logs_user_id_profiles_fkey') as fk_activity_logs_profiles,
  (select count(*) from information_schema.table_constraints where constraint_name='messages_sender_id_profiles_fkey')    as fk_messages_profiles,
  (select count(*) from information_schema.table_constraints where constraint_name='photos_taken_by_profiles_fkey')       as fk_photos_profiles;

-- ── 3. Lignes ORPHELINES (uniquement utile si la FK #20260514 N'EST PAS encore
--       posée : elle échouerait si l'un de ces compteurs est > 0). Attendu : 0.
select
  (select count(*) from public.activity_logs a where a.user_id   is not null and not exists (select 1 from public.profiles p where p.id=a.user_id))   as orphan_activity_logs,
  (select count(*) from public.messages      m where m.sender_id is not null and not exists (select 1 from public.profiles p where p.id=m.sender_id)) as orphan_messages,
  (select count(*) from public.photos        ph where ph.taken_by is not null and not exists (select 1 from public.profiles p where p.id=ph.taken_by)) as orphan_photos;

-- ── 4. RLS activée sur les tables cœur (attendu : rls_all_core = true) ───────
select bool_and(rowsecurity) as rls_all_core, count(*) as tables_checked
from pg_tables
where schemaname='public'
  and tablename in ('projects','tasks','issues','profiles','organizations',
                    'invitations','messages','artisans','photos','documents','activity_logs');

-- ── 5. Sécurité des fonctions SECURITY DEFINER (attendu : sans_searchpath = 0)
select count(*) filter (where p.prosecdef and p.proconfig is null) as secdef_sans_searchpath,
       count(*) filter (where p.prosecdef)                          as secdef_total
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public';

-- ── 6. Buckets Storage requis (attendu : photos=1, avatars=1, documents=1) ───
select
  (select count(*) from storage.buckets where id='photos')    as bucket_photos,
  (select count(*) from storage.buckets where id='avatars')   as bucket_avatars,
  (select count(*) from storage.buckets where id='documents') as bucket_documents,
  (select string_agg(name, ', ' order by name) from storage.buckets) as all_buckets;

-- ── 7. Volumétrie (sanity — repérer si base test vs production) ──────────────
select
  (select count(*) from public.organizations) as orgs,
  (select count(*) from public.profiles)      as profiles,
  (select count(*) from public.projects)      as projects,
  (select count(*) from public.tasks)         as tasks,
  (select count(*) from public.artisans)      as artisans,
  (select count(*) from public.invitations)   as invitations;

-- ── 8. Historique des migrations Supabase (peut être vide : migrations
--       appliquées « via MCP » en SQL brut, hors supabase_migrations). ────────
select version, name from supabase_migrations.schema_migrations order by version;

-- ============================================================================
-- INTERPRÉTATION
--   • Blocs 1,2,4,5,6 tout à 1/true/0 attendu → base au niveau RICHE, prête,
--     NE PAS rejouer les migrations (Scénario C).
--   • Un objet à 0 dans le bloc 1/2 → base au niveau LÉGER → appliquer les
--     migrations manquantes (voir migration-matrix.md), et vérifier le bloc 3
--     (orphelins) AVANT la migration 20260514.
--   • Bloc 7 volumétrie élevée → base de PRODUCTION avec données réelles :
--     ne PAS y faire de recette destructive (voir dynamic-qa-checklist.md).
-- ============================================================================
