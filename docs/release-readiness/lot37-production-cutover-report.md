# LOT 37 — Rapport final de bascule production (code-only)

**Date :** 2026-07-07
**Autorisation :** GO explicite utilisateur — « Option 1 : procéder sans backup DB, dérogation explicitement autorisée » avec 10 mesures compensatoires.
**Nature :** merge `--no-ff` code-only, **zéro migration**, **zéro modification DB / RLS / Storage / variable Vercel**.

---

## 1. SHA & états git confirmés

| Élément | Valeur |
|---|---|
| Ancien `main` (cible rollback) | `0d55946` |
| Branche release (préservée) | `claude/kanvix-lot-27b-reprise-8qtjsn` → `836d7cf` |
| Commit de merge (`--no-ff`, no squash) | **`1d8ea8c`** — « release: deploy rich Kanvix application » |
| `origin/main` actuel | `1d8ea8c` |

- Merge réalisé **sans squash** et **sans force push** → `git revert -m 1 1d8ea8c` reste possible.
- `0d55946` est un ancêtre direct de la branche release → merge propre, **aucun conflit**.
- Branche release **conservée** (non supprimée).

## 2. Déploiement Vercel

| Élément | Valeur |
|---|---|
| Projet | `kanvix-saas` (`prj_L7RksiDCQL6dT0aZXT3ynMSjtdX0`, team `team_lLM0tNFENCDeXGjxgED4R5sv`) |
| Déploiement production | `dpl_25oNJr4GozbZcrEL1rxQqPXs1QBw` — target=production, commit `1d8ea8c`, state=**READY** |
| Alias | `kanvix-saas.vercel.app` (aliasError=null) |
| Déploiement rollback prêt | `dpl_H5ryk9oSdHQYQgAjfLVT4KazZTNg` (ancien `0d55946`, production READY) |

## 3. Smoke tests read-only exécutés par l'agent (aucune écriture de données)

| # | Test | Résultat | Statut |
|---|---|---|---|
| 1 | `kanvix-saas.vercel.app/login` | HTTP 200, marque **riche** Kanvix (`<title>Kanvix — Gestion de chantiers BTP</title>`, brand `kanvix-icon-blue`/`kanvix-wordmark-dark`, footer « Kanvix — Plateforme BTP professionnelle ») | ✅ |
| 2 | Script anti-flash thème (LOT 36) présent en prod | `light=(t==='light')||(t!=='dark'&&!matchMedia(dark).matches)` → défaut **Système** confirmé live | ✅ |
| 3 | `/api/debug-supabase` (LOT 31) | Fichier **absent du dépôt** ; en prod la requête est interceptée par le middleware → redirigée `/login` (x-matched-path=/login). Aucune donnée Supabase exposée. | ✅ |
| 4 | Erreurs runtime Vercel (2 h) | 1 seul groupe : `AuthApiError: Invalid Refresh Token` (route `/middleware`, code `refresh_token_not_found`, count=4). **Bénin / attendu** : session expirée → refresh échoué → redirection login. Pas un 500, pas une régression du merge. | ✅ |
| 5 | Logs 5xx production (2 h) | **Aucun log 5xx.** | ✅ |

**Bascule confirmée** : la production servait auparavant « Planzy » (schéma léger) ; elle sert désormais le build riche « Kanvix ». Aucune anomalie bloquante Auth / Supabase / RLS / Storage / 401 / 403 / 500 observée → **aucun rollback déclenché**.

## 4. Tags de release

Le proxy git de cet environnement **bloque le push des tags (HTTP 403)** — comportement documenté du proxy, non contournable. Les tags existent donc **localement uniquement** (ancrage documentaire) :

- `pre-kanvix-rich-production-20260707-180936Z` — état pré-bascule (sur ancien `main`).
- `kanvix-rich-production-20260707-2011Z` — sur le commit de merge `1d8ea8c`.

> Action utilisateur possible : recréer/pousser ces tags depuis un poste sans proxy, ou via l'UI GitHub Releases, en pointant sur `1d8ea8c` et `0d55946`.

## 5. Mesures compensatoires (dérogation backup DB)

- **Aucun backup DB automatisé n'existait** : org Supabase `ahikvswlwfqcqeqsdzck` en **plan FREE** → pas de PITR ni de snapshot automatique. Dérogation **explicitement autorisée** par l'utilisateur.
- Bascule **code-only** : aucune migration jouée, `qmuo` portait déjà les 9 migrations, buckets et RLS (vérifié en lecture seule aux LOT 30/31).
- **Les fichiers Storage** (buckets `photos` / `documents` / `avatars`) **ne sont pas couverts par un backup** — à noter en cas de restauration.
- Rollback code disponible à tout instant : Vercel Instant Rollback → `dpl_H5ryk9oSdHQYQgAjfLVT4KazZTNg` (`0d55946`). La base n'étant pas modifiée, le rollback code est sans risque de désynchronisation schéma.

## 6. Tests interactifs restant à la charge de l'utilisateur

L'agent **ne peut pas s'authentifier** contre l'application (SSO / auth). Les tests suivants, à faire une fois connecté avec un compte réel (sans créer/modifier de données lors de la passe read-only), restent à valider côté utilisateur :

- [ ] Connexion → redirection dashboard (pas de boucle login)
- [ ] Dashboard (KPI + sections chargent, pas d'écran blanc)
- [ ] Liste Chantiers + ouverture d'une fiche + onglets
- [ ] Planning / Gantt (rendu, flèches période — **sans drag-and-drop**)
- [ ] Ouvrir une tâche (TaskSidePanel) **sans modification**
- [ ] Ouvrir une **photo** (URL signée) et un **document** (LOT 33)
- [ ] Ouvrir la **messagerie** (fenêtre latérale) **sans envoi**, vérifier le badge « reçus récemment » (LOT 34/35)
- [ ] Bascule de thème Système / Clair / Sombre (LOT 36)

Après cette validation read-only : écrire les tests d'écriture (envoi message, etc.) uniquement si tout est vert.

---

## Verdict

**GO PRODUCTION confirmé.** Bascule code-only réussie, build riche Kanvix en production, aucune anomalie bloquante détectée sur les vérifications automatisables. Rollback code prêt. Branche release et ancien déploiement conservés.
