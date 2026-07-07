# LOT 30 — Plan de bascule production (cutover)

## Scénario retenu : **C — base déjà au bon niveau**

Justification : la base cible présumée (`qmuo` / « planzy-saas ») porte **déjà** les
9 migrations (vérifié en lecture seule), les buckets Storage et la RLS. La bascule
est donc **code-only** ; aucune migration à jouer.

> ⚠️ Le scénario C n'est valide **que si** l'environnement Vercel *Production* de
> `kanvix-saas` pointe bien sur `qmuo` (et non `dkywi`). **Décision GO n°1**
> ci-dessous. Si Production pointe sur `dkywi` (léger), basculer vers le
> **Scénario B** (migrations + fenêtre de maintenance, cf. `migration-matrix.md`).

## Pré-requis (décisions nécessitant un GO utilisateur)

1. **GO n°1 — Confirmer la base de Production.** Dans Vercel → kanvix-saas →
   Settings → Environment Variables, vérifier que `NEXT_PUBLIC_SUPABASE_URL`
   (env **Production**) contient `qmuowzsfxsuqythghmtx`. Vérifier aussi si
   l'env **Preview** est identique (→ base partagée, cf. GO n°2).
2. **GO n°2 — Isolation Preview/Prod.** Si Preview = Production = `qmuo`, acter
   que la recette dynamique sur la Preview **écrit dans la base de production** →
   n'utiliser qu'une **org de test dédiée**, aucune action destructive sur les
   données réelles (17 projets / 102 tâches existants). Sinon, créer un projet
   Supabase de **staging** et y pointer un déploiement Preview dédié.
3. **GO n°3 — Backup vérifié** (cf. `rollback-plan.md`) : snapshot manuel daté
   pris et restaurable.

## Procédure (Scénario C)

1. **Vérifier la base** : exécuter `preflight-readonly.sql` sur le projet
   Production → blocs 1/2/4/5/6 conformes (tout à 1 / true / 0). **Ne pas** jouer
   les migrations.
2. **Backup** manuel daté (rollback-plan Niveau 2, méthode privilégiée).
3. **Recette dynamique** validée sur la Preview (`dynamic-qa-checklist.md`).
4. **Merge** `claude/kanvix-lot-27b-reprise-8qtjsn` → `main` **via commit de
   merge** (pas de squash — nécessaire au `git revert -m 1`). *(Action utilisateur ;
   aucun merge effectué par l'agent sans GO explicite.)*
5. **Déploiement** : Vercel déploie automatiquement `main` en Production.
6. **Smoke tests** immédiats (`smoke-test` ci-dessous) sur `kanvix-saas.vercel.app`.
7. **Surveillance** 30–60 min : logs Vercel (runtime errors), erreurs réseau,
   Supabase logs/advisors.
8. **Rollback** si besoin : Niveau 1 (Instant Rollback code). Base non concernée.

## Smoke tests post-déploiement (production, ~5 min, compte réel non destructif)

| # | Test | Attendu | Criticité |
|---|---|---|---|
| 1 | Charger `kanvix-saas.vercel.app` | Login **riche** (marque à jour), pas de 500 | 🔴 |
| 2 | Connexion compte existant | Redirection dashboard, pas de boucle login | 🔴 |
| 3 | Dashboard | KPI + sections chargent, pas d'écran blanc | 🔴 |
| 4 | Ouvrir un chantier | Fiche + onglets OK | 🔴 |
| 5 | Ouvrir une tâche (TaskSidePanel) | Panneau s'ouvre | 🟠 |
| 6 | Planning / Gantt | Rendu, pas d'erreur console bloquante | 🟠 |
| 7 | Rapports | KPI + alertes chargent | 🟠 |
| 8 | Photos (signed URLs) | Vignettes s'affichent | 🟠 |
| 9 | Console navigateur | Pas d'erreur rouge critique / hydratation | 🟠 |
| 10 | `/api/debug-supabase` | (voir reco endpoint) — présent en riche ; décider avant go-live | 🟡 |

## Fenêtre & communication
- Scénario C = bascule à faible risque, **sans fenêtre de maintenance** nécessaire
  (pas de migration). Prévoir néanmoins un créneau à faible trafic et une personne
  disponible 30–60 min pour surveiller / déclencher le rollback.
