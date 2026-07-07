-- Fix PostgREST joins: activity_logs.user_id, messages.sender_id, photos.taken_by
-- Ces colonnes avaient uniquement des FK vers auth.users (cross-schema).
-- PostgREST ne peut pas résoudre les joins cross-schema → HTTP 400 sur tous les
-- appels utilisant profiles!user_id, profiles!sender_id, profiles!taken_by.
-- On ajoute des FK supplémentaires vers public.profiles pour débloquer ces joins.

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_profiles_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_taken_by_profiles_fkey
  FOREIGN KEY (taken_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
