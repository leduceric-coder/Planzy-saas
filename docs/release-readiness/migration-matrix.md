# LOT 30 — Matrice de compatibilité des migrations

Contexte : production actuelle = `main` (`0d55946`, version **légère**). Base cible
présumée = `qmuo` (schéma **riche déjà appliqué**). « Avant déploiement » = base
pendant que le code léger tourne encore ; « Après » = code riche.

Légende idempotence : ✅ rejouable sans erreur · ⚠️ échoue si rejouée · seed = gardé.

| # | Migration | Classe | Compatible AVANT (code léger) | Compatible APRÈS (code riche) | Idempotente | Réversible | Déjà sur `qmuo` | Risque si (ré)appliquée |
|---|---|---|---|---|---|---|---|---|
| 1 | `20260510_fix_rls_and_seed` | RLS/sécurité + seed | ✅ (fix récursion, signatures stables) | ✅ requise | ✅ (DROP IF EXISTS / CREATE OR REPLACE / ON CONFLICT / gardes) | Partiel (policies re-créables ; seed non supprimable proprement) | ✅ | Faible — recrée policies/fn à l'identique ; insèrerait l'org démo `111…` (ON CONFLICT DO NOTHING) |
| 2 | `20260511_handle_new_user_auto_org` | Auth critique | ✅ (le code léger tolère `org_id` renseigné) | ✅ requise | ✅ (CREATE OR REPLACE) | ✅ (réécrire l'ancienne version) | ✅ | Faible — remplace la fn trigger à l'identique |
| 3 | `20260514_fix_fk_profiles_joins` | Additif (FK) | ✅ (FK satisfaites : sender/user/taken_by ∈ profiles) | ✅ requise (joins PostgREST) | ⚠️ **NON** (`ADD CONSTRAINT` sans IF NOT EXISTS) | ✅ (DROP CONSTRAINT, sans perte) | ✅ | **Moyen** — 2ᵉ passage = erreur « already exists » ; 1ʳᵉ appli échoue s'il existe des lignes orphelines |
| 4 | `20260517_add_artisan_id_invitations` | Additif | ✅ | ✅ | ⚠️ Partiel (col/table/index IF NOT EXISTS ✅ ; `CREATE POLICY` ⚠️) | ✅ (DROP TABLE/COLUMN → perte des invitations) | ✅ | Faible — rejeu échoue sur les policies déjà créées |
| 5 | `20260517_invitation_functions` | Additif / sécurité | ✅ | ✅ | ✅ (CREATE OR REPLACE) | ✅ (DROP FUNCTION) | ✅ | Faible ; `anon` sur `get_invitation_by_token` (par design) |
| 6 | `20260520_invitation_email_tracking` | Additif | ✅ | ✅ | ✅ (ADD COLUMN IF NOT EXISTS) | ✅ (DROP COLUMN → perte tracking) | ✅ | Nul |
| 7 | `20260520_member_management_functions` | Additif | ✅ | ✅ | ✅ (CREATE OR REPLACE) | ✅ (DROP FUNCTION) | ✅ | Nul |
| 8 | `20260522_messages_decision_type_and_linked_task` | Additif (enum) | ✅ | ✅ | ✅ (ADD VALUE IF NOT EXISTS ; PG12+ accepte en transaction) | ❌ **Enum non réversible** ; colonne/index réversibles | ✅ | Faible ; l'ajout d'une valeur d'enum ne peut être annulé proprement |
| 9 | `20260524_tasks_completed_at` | Additif | ✅ | ✅ | ✅ (ADD COLUMN IF NOT EXISTS) | ✅ (DROP COLUMN → perte) | ✅ | Nul |

## Synthèse

- **Aucune migration destructive** (pas de DROP COLUMN/TABLE, pas de rename, pas de NOT NULL sans défaut — `email_send_count` a `DEFAULT 0`).
- **Aucune incompatibilité** avec le code léger de production (schéma **sur-ensemble**).
- Points d'attention à la (ré)application : **#3** non idempotente (FK sans `IF NOT EXISTS`) et sensible aux lignes orphelines ; **#4/#8** partiellement non idempotentes (policies / enum).
- **Sur `qmuo`, les 9 sont déjà appliquées** → à la bascule, **ne rien rejouer** (Scénario C). La matrice « avant/après » ne sert qu'au cas où la base cible réelle serait `dkywi` (léger) — auquel cas il faudrait appliquer les 9 dans l'ordre chronologique, avec les précautions ci-dessus.

## Ordre conseillé (uniquement si la base cible est vierge/légère, ex. `dkywi`)
Chronologique strict : 20260510 → 20260511 → 20260514 → 20260517(add) → 20260517(functions) → 20260520(email) → 20260520(member) → 20260522 → 20260524.
Prérequis #3 : vérifier l'absence de lignes orphelines (voir `preflight-readonly.sql`, section FK).
