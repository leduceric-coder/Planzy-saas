# LOT 30 — Audit des migrations & environnements (lecture seule)

> Audit read-only. Aucune migration appliquée, aucune écriture, aucune modification
> de main / RLS / Storage. Branche `claude/kanvix-lot-27b-reprise-8qtjsn`
> HEAD `4e31b1efdcf68748f7fc4273a235710cf7d2c0a8`. main `0d55946…`.

## 1. Environnements

| Élément | Constat |
|---|---|
| Projet Vercel | `kanvix-saas` (`prj_L7RksiDCQL6dT0aZXT3ynMSjtdX0`) — sert **à la fois** main (`…git-main…`, domaine prod `kanvix-saas.vercel.app`) **et** la branche (`…git-claude…`). |
| Production (`kanvix-saas.vercel.app`) | Sert la version **légère « Planzy »** (login « Planzy », endpoint `/api/debug-supabase` **absent** → route `/login`). = `main` / `0d55946`. |
| Preview (branche) | Version **riche** (protégée par Vercel SSO). Fonctionne → utilise nécessairement une base au **schéma riche**. |
| Projets Supabase (org `ahikvswlwfqcqeqsdzck`, eu-west-1) | **`qmuowzsfxsuqythghmtx`** (« planzy-saas », créé 2026-05-12, PG17) et **`dkywiizxyyddkwhmgxab`** (créé 2026-03-18, PG17). |

### État réel des bases (vérifié en SELECT read-only)

| Objet riche | `qmuo` (planzy-saas) | `dkywi` |
|---|---|---|
| table `invitations` | ✅ | ❌ |
| `profiles.artisan_id` | ✅ | ❌ |
| `tasks.completed_at` | ✅ | ❌ |
| `messages.linked_task_id` | ✅ | ❌ |
| tracking email invitations | ✅ | ❌ |
| fn `accept_invitation` / `update_member_profile` / `remove_member_from_org` | ✅ | ❌ |
| enum `message_type='decision'` | ✅ | ❌ |
| FK `messages/activity_logs/photos → profiles` | ✅ | ❌ |
| `get_my_org_ids` / `handle_new_user` | ✅ | — |
| Buckets Storage | `avatars, documents, photos` ✅ | n/a |
| RLS sur toutes les tables cœur | ✅ (true) | n/a |
| SECURITY DEFINER sans `search_path` | **0** ✅ | n/a |
| Données | **vivant** : 6 orgs, 6 users, 17 projets, 102 tâches, 20 artisans, 8 invitations | tables `tasks`/`profiles` présentes, schéma léger |
| Seed migration (`org 111…` / `projet 222…`) | **ABSENT** (jamais joué — données réelles distinctes) | n/a |

**Conclusion environnements** : `qmuo` porte **déjà le schéma riche complet** (les 9 migrations y sont **déjà appliquées** — cohérent avec les commentaires « Applied via MCP » dans les fichiers) + buckets + RLS + fonctions sécurisées. C'est la base qu'utilise la Preview riche. `dkywi` est une base **ancienne/légère** (probablement l'origine projectai-saas), non alignée.

## 2. Relation Preview / Production / Supabase — point de décision

- Preview et Production sont sur **le même projet Vercel**. Si `NEXT_PUBLIC_SUPABASE_URL` n'est **pas** différencié par environnement (défaut Vercel), **les deux pointent sur la même base `qmuo`** → relation **B (base partagée)**.
- La valeur exacte de `NEXT_PUBLIC_SUPABASE_URL` de l'environnement **Production** n'est pas lisible sans exposer un secret.

**➡️ DÉCISION REQUISE (GO utilisateur)** — Classer la relation :
- **A** — Preview et Production sur des bases séparées.
- **B** — même base (probable ici). ⚠️ Risque : la recette Preview écrit dans la base de production.
- **C** — indéterminable côté Production sans vérifier l'env Vercel.

Verdict provisoire : **B/C** — forte présomption que Production **et** Preview utilisent `qmuo`. À **confirmer** en lisant, dans Vercel → kanvix-saas → Settings → Environment Variables, la valeur de `NEXT_PUBLIC_SUPABASE_URL` pour l'environnement **Production** (doit contenir `qmuo…` et **non** `dkywi…`).

## 3. Inventaire des 9 migrations

Toutes dans `supabase/migrations/`. **Toutes déjà présentes sur `qmuo`** (vérifié).

| # | Fichier | Objets | Type |
|---|---|---|---|
| 1 | `20260510_fix_rls_and_seed.sql` | `SET search_path` sur 3 fn ; REVOKE/GRANT EXECUTE ; DROP policy Storage « Avatars publics » ; `CREATE OR REPLACE get_my_org_ids` ; recrée policy `profiles` (anti-récursion) ; seed org/projet démo (gardé, UUID fixes) | **RLS/sécurité critique + seed** |
| 2 | `20260511_fix_handle_new_user_auto_org.sql` | `CREATE OR REPLACE handle_new_user` (crée une org par signup) | **Auth critique** |
| 3 | `20260514_fix_fk_profiles_joins.sql` | 3 FK `activity_logs.user_id` / `messages.sender_id` / `photos.taken_by` → `profiles` (ON DELETE SET NULL) | Additif (joins PostgREST) |
| 4 | `20260517_add_artisan_id_invitations.sql` | `profiles.artisan_id` ; table `invitations` + index + RLS + 3 policies | Additif |
| 5 | `20260517_invitation_functions.sql` | `get_invitation_by_token` (GRANT **anon**), `accept_invitation`, `update_member_role` (SECURITY DEFINER) | Additif / sécurité |
| 6 | `20260520_invitation_email_tracking.sql` | 5 colonnes nullables sur `invitations` | Additif |
| 7 | `20260520_member_management_functions.sql` | `update_member_profile`, `remove_member_from_org` (SECURITY DEFINER) | Additif |
| 8 | `20260522_messages_decision_type_and_linked_task.sql` | `ALTER TYPE message_type ADD VALUE 'decision'` ; `messages.linked_task_id` ; index | Additif (enum **irréversible**) |
| 9 | `20260524_tasks_completed_at.sql` | `tasks.completed_at` + index partiel | Additif |

Voir `migration-matrix.md` pour la matrice de compatibilité et l'idempotence détaillées.

## 4. Audit sécurité RLS (Phase 5)

- ✅ **Toutes** les fonctions SECURITY DEFINER ont `SET search_path` (vérifié : 0 sans, sur `qmuo`) → pas de détournement de `search_path`.
- ✅ `handle_new_user` : EXECUTE **révoqué** de anon/authenticated/public (n'est appelée que par le trigger).
- ✅ `get_my_org_ids`, `is_org_admin` : révoqués de anon/public, accordés à authenticated. `get_my_org_ids` est SECURITY DEFINER `STABLE` lisant `profiles` → casse la récursion RLS de la policy `profiles`.
- ✅ Policies multi-org : filtrage systématique `org_id IN (get_my_org_ids())` / sous-requête `profiles WHERE id = auth.uid()`. `accept_invitation` vérifie l'égalité d'email ; `update_member_role` / `update_member_profile` / `remove_member_from_org` vérifient org + rôle appelant + protègent le dernier owner.
- 🟡 **`get_invitation_by_token` accordé à `anon`** : expose `email`, `org_name`, `role`, `status` d'une invitation **à quiconque détient le token** (secret porteur). Attendu pour le flux d'acceptation, mais à connaître (fuite limitée à la connaissance du token).
- 🟡 `20260510` **DROP** la policy Storage « Avatars publics storage » → **durcit** l'accès (pas d'ouverture). Aucune création de bucket dans les migrations ; les buckets `avatars/documents/photos` existent déjà sur `qmuo`.
- Aucune récursion RLS résiduelle détectée dans le SQL lu.

**Aucune anomalie de sévérité haute.** Deux points « à connaître » (anon sur invitation par token ; endpoint debug — cf. rapport).
