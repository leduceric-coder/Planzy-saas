# LOT 30 — Plan de backup & rollback

## Hypothèse dominante (Scénario C)
La base cible (`qmuo`) porte **déjà** le schéma riche. La bascule est **code-only** :
aucune migration n'est jouée au moment du merge → **rien à annuler côté base**.
Le plan de rollback base ne devient réellement utile que si une migration devait
être appliquée (base cible léger `dkywi`, ou correctif futur).

## Niveau 1 — Rollback du CODE (rapide, sûr, sans perte)

| Étape | Action |
|---|---|
| Pré-requis | Noter l'ID du déploiement **Production actuel** (= `main` / `0d55946`) dans Vercel → kanvix-saas → Deployments (filtre *Production*). |
| Déclenchement | Sur Vercel, **Instant Rollback** vers ce déploiement (ou `Redeploy`). Alternative Git : `git revert -m 1 <sha_du_merge>` sur `main` puis push → redeploy auto. |
| Durée estimée | ~1–3 min (Instant Rollback) ; ~2–4 min (revert + build). |
| Vérifications post-rollback | `kanvix-saas.vercel.app` répond ; page login « Planzy » ; connexion OK ; dashboard léger OK ; aucune 500. |
| Pré-requis merge propre | Merger via **commit de merge** (pas de squash) pour permettre `git revert -m 1`. |

## Niveau 2 — Rollback de la BASE

> À déterminer/confirmer côté Supabase (dépend du plan) — **ne pas supposer** :
> - Sauvegardes automatiques quotidiennes (Free/Pro) ;
> - **PITR** (Point-in-Time Recovery) — Pro/add-on uniquement ;
> - Restauration vers un **projet séparé** ;
> - Export logique (`pg_dump`) manuel.

### Méthode privilégiée
1. **Avant** toute opération : prendre un **backup manuel daté** (Supabase Studio → Database → Backups, ou `pg_dump` complet). Noter l'horodatage exact.
2. En cas d'incident : restaurer via **PITR** au timestamp juste avant la bascule, **ou** restaurer le backup manuel.

### Méthode de secours
- Si PITR indisponible : restaurer le dernier **backup automatique** (perte = données créées depuis ce backup).
- Vérifier au préalable que le backup est **réellement restaurable** (test de restauration vers un projet jetable si possible).

### Données potentiellement perdues
- Scénario C (aucune migration jouée) : **aucune** — le rollback base n'est pas nécessaire.
- Si une migration additive avait été jouée puis annulée par `DROP` : perte des données de la colonne/table supprimée uniquement (invitations, tracking email, `completed_at`, `linked_task_id`).

## Rollback SQL ciblé par migration (si jamais appliqué à une base à annuler)

| Migration | Rollback | Verdict |
|---|---|---|
| 20260510 (RLS/seed) | Restaurer l'ancienne `get_my_org_ids` / policy `profiles` ; supprimer le seed `org 111…` | **Risqué** (touche la sécurité en prod) — préférer PITR |
| 20260511 (handle_new_user) | Restaurer l'ancienne fonction | **Risqué** (auth) — préférer PITR |
| 20260514 (FK profiles) | `ALTER TABLE … DROP CONSTRAINT …_profiles_fkey` | **Sûr** (sans perte) |
| 20260517 (artisan_id + invitations) | `DROP TABLE invitations` ; `ALTER TABLE profiles DROP COLUMN artisan_id` | **Perte** (invitations) |
| 20260517 (functions) | `DROP FUNCTION …` | **Sûr** |
| 20260520 (email tracking) | `ALTER TABLE invitations DROP COLUMN …` | **Perte** (tracking) |
| 20260520 (member functions) | `DROP FUNCTION …` | **Sûr** |
| 20260522 (decision + linked_task) | Colonne/index : DROP **sûr**. Valeur d'enum `'decision'` : **non annulable** proprement | **Impossible sans perte** (enum) |
| 20260524 (completed_at) | `ALTER TABLE tasks DROP COLUMN completed_at` | **Perte** (completed_at) |

> ⚠️ Aucun script de rollback destructif n'est généré automatiquement. Toute
> annulation base doit passer de préférence par **PITR / backup**, jamais par des
> DROP improvisés en production.

## Ordre de rollback recommandé en cas d'incident post-bascule
1. **Code d'abord** (Niveau 1) — rétablit instantanément la version légère stable.
2. Base **seulement si** un incident de données/schéma est avéré ET qu'une
   migration avait été jouée (rare en Scénario C) → PITR/backup.
