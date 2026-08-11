-- ── LOT 42D-P0 — Verrouillage des colonnes sensibles de public.profiles ──────
--
-- P0 fermé par cette migration (reproduit et prouvé avant application) :
--   La policy « Profil modifiable par son propriétaire » autorise
--   UPDATE ... USING (auth.uid() = id) sans restriction de colonne, et les rôles
--   `authenticated` / `anon` disposaient d'un privilège UPDATE au niveau TABLE
--   sur profiles (les 10 colonnes). Conséquences démontrées :
--     1. auto-promotion : un viewer pouvait exécuter
--        `update profiles set role='owner' where id = auth.uid()`,
--        faisant passer can_write_org() de false à true → LOT 42A contourné ;
--     2. évasion d'organisation : le même utilisateur pouvait exécuter
--        `update profiles set org_id='<autre org>'` et lire/écrire les données
--        d'un autre client (fuite cross-tenant).
--
-- Stratégie : retirer le privilège UPDATE au niveau TABLE, puis ne réaccorder
-- que les colonnes self-service légitimes. Les mutations sensibles (role,
-- org_id, artisan_id) restent possibles uniquement via les fonctions
-- SECURITY DEFINER existantes (update_member_profile, remove_member_from_org,
-- accept_invitation), toutes détenues par `postgres` — propriétaire de la table —
-- et donc insensibles à ces privilèges.
--
-- Colonnes self-service : issues d'un audit exhaustif du dépôt. Les seules
-- écritures directes sur profiles sont, dans components/settings/SettingsClient :
--   .update({ full_name, phone })  et  .update({ avatar_url }).
-- `updated_at` n'est PAS accordé : il est renseigné par le trigger BEFORE UPDATE
-- `profiles_updated_at`, et les colonnes écrites par un trigger ne sont pas
-- soumises aux privilèges colonne de l'appelant (vérifié en test transactionnel).
--
-- Hors périmètre volontaire : SELECT inchangé ; INSERT/DELETE non modifiés
-- (aucune policy INSERT/DELETE n'existe sur profiles, la RLS les refuse déjà) ;
-- aucune policy modifiée ; aucun trigger ajouté.

-- 1. Retrait du privilège UPDATE au niveau TABLE.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

-- 2. Réattribution des seules colonnes self-service. `anon` ne reçoit rien.
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;
