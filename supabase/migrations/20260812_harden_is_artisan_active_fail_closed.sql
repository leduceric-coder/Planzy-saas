-- ── LOT 42E0 — is_artisan_active() en fail-closed ────────────────────────────
--
-- Défaut corrigé (identifié par l'audit 42E) : la fonction retournait `true`
-- lorsque l'artisan était introuvable ou que le profil n'avait pas d'artisan_id,
-- à cause du `coalesce(..., true)`. Une fonction nommée « is_artisan_active »
-- qui répond `true` en l'absence d'artisan est un piège : la première policy
-- qui s'y fiera accordera l'accès précisément dans les cas non déterminés.
--
-- Comportement cible :
--   artisan lié + status='active'      -> true
--   artisan lié + suspended|archived   -> false
--   profil sans artisan_id             -> false
--   artisan introuvable                -> false
--   utilisateur non authentifié        -> false
--
-- Périmètre strictement limité à cette fonction. Vérifié avant application :
-- aucune policy, fonction, vue ou contrainte ne référence is_artisan_active()
-- aujourd'hui — elle est dormante, préparée pour les policies scopées de 42E1+.
-- Le changement est donc sans effet fonctionnel immédiat, et met la sémantique
-- au propre AVANT que quoi que ce soit ne s'y appuie.
--
-- NON MODIFIÉ volontairement dans ce lot : can_write_org() contient toujours
-- 'artisan'. Plusieurs policies métier en dépendent encore ; l'en retirer avant
-- que 42E1..42E4 aient installé les policies scopées de remplacement casserait
-- des écritures légitimes. Ce retrait est prévu en 42E5.
--
-- Note : « artisan_id pointant vers un artisan inexistant » n'est pas
-- atteignable — profiles.artisan_id porte une FK vers artisans(id) avec
-- ON DELETE SET NULL, qui ramène ce cas à « profil sans artisan_id ».

CREATE OR REPLACE FUNCTION public.is_artisan_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select a.status = 'active'
      from public.artisans a
      where a.id = public.current_artisan_id()
    ),
    false
  );
$function$;
