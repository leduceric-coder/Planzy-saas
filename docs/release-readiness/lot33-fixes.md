# LOT 33 — Corrections des 3 bugs bloquants de recette

## Causes racines

| Bug | Cause racine | Correctif |
|---|---|---|
| A — Photos non ouvrables (fiche) | La page serveur `chantiers/[id]` récupérait les photos **sans générer d'URL signée**. Pour un upload réel, `photos.url` contient un **chemin nu** (= `storage_path`, ex. `<proj>/617….png`). Rendu tel quel dans `<img src>`, il est résolu **relativement** à `/chantiers/[id]/` → `GET /chantiers/[id]/617….png` → **404**. | Signer `storage_path` (bucket privé `photos`) côté serveur, remplacer `url` par l'URL signée. Photos DEMO (`storage_path` null, `url` http) inchangées. |
| B — Documents non ouvrables (fiche) | Idem : `documents.file_url` = chemin nu pour les uploads → `<a href>` relatif → 404. | Signer `storage_path` (bucket `documents`), `<a>` ouvert seulement si URL absolue, sinon état « Indisponible » non cliquable. |
| C1 — Chantiers manquants (messagerie) | `MessagesView` construisait la liste depuis **`threads`** (chantiers ayant déjà une conversation) → un chantier accessible **sans thread** n'apparaissait pas. | Sourcer la liste depuis **`projects`** (tous les chantiers accessibles), sélection par `projectId`, messages indexés par `project_id` (thread optionnel). Chantiers sans message affichés avec « Aucun message ». |
| C2 — Alerte non contextualisée | L'item d'alerte message : `title:'Nouveau message'`, `link:'/messages'` générique. | `title` = « Nouveau message — {chantier} », `body` = chantier + extrait, `link` = `/messages?project={id}`. `MessagesView` gère le deep-link `?project=`. |

## Logique de signed URL (`lib/storage.ts`)

- `signStoragePaths(supabase, bucket, paths, ttl=3600)` → `Map<storage_path, signedUrl>` (bucket privé, jamais public). Généré **au rendu serveur** (frais à chaque visite), **jamais persisté** en base.
- `resolveStorageUrl(storagePath, signedMap, fallbackUrl)` — **fonction pure** :
  1. `storagePath` + URL signée dispo → URL signée ;
  2. sinon `fallbackUrl` **absolue** (http/https) → conservée (démo) ;
  3. sinon `null` (jamais un chemin nu / filename → jamais de 404 relatif).

### Comportement
- **Anciennes données** (démo, `url`/`file_url` http, `storage_path` null) → URL http conservée. Photos DEMO placeholder/caption → résolues côté client (`resolveDemoImageSrc`) inchangé.
- **Nouvelles données** (upload, `storage_path` set) → URL signée fraîche.
- **URL expirée** (TTL 1h dépassé, page ouverte longtemps) → régénérée au prochain rendu serveur (navigation/refresh). Photo : `onError` → état « Indisponible ». Document : lien absent → « Indisponible ». Aucun 404 en navigation d'app.

### Cas de test — `resolveStorageUrl` (fonction pure, sans dépendance)
| storagePath | signedMap | fallbackUrl | Attendu |
|---|---|---|---|
| `p/x.png` | `{p/x.png: https://qmuo…/signed}` | `p/x.png` | `https://qmuo…/signed` |
| `p/x.png` (dossier) | contient la clé | `null` | URL signée |
| `null` | `{}` | `https://host/a.png` | `https://host/a.png` (démo) |
| `x.png` (filename seul) | `{}` (échec) | `x.png` | `null` (jamais le filename) |
| `p/é à.png` (accents/espaces) | contient la clé | — | URL signée (clé exacte) |
| `null`/`undefined` | `{}` | `null` | `null` |

> Invariant vérifié : `resolveStorageUrl` ne renvoie **jamais** une valeur non-absolue → aucune URL construite sous `/chantiers/[id]/`.

## Messagerie — liste & non-lus

- **Liste** : `conversations` = 1 par chantier accessible (`projects`) ∪ threads sans chantier actif (directs / projets non actifs). Aucune donnée d'une autre org (les `projects`/`threads`/`messages` sont déjà filtrés `org_id` par la page serveur + RLS).
- **Regroupement** : messages filtrés par `project_id` (ou `thread_id` pour les directs). Tri par activité récente, puis alphabétique.
- **« Non-lus »** : ⚠️ **aucun modèle de lecture en base** (pas de `read_at` / table de reçus ; l'ancien code avait `hasUnread = false // future`). Implémenter un vrai non-lu par chantier exigerait un **changement de schéma** (interdit ici). → Indicateur pragmatique : **messages des dernières 48 h non émis par l'utilisateur**, par chantier — **même sémantique** que le badge de navigation (`getAlertsSummary.messagesRecent`). Le badge global reste la somme des messages récents accessibles. Un vrai suivi lu/non-lu est à traiter dans un lot dédié avec GO schéma.
- **Navigation contextualisée** : `/messages?project={id}` préselectionne la conversation (deep-link lu au montage). L'alerte pointe désormais dessus.

## Tests
- **Automatisés** : aucune infrastructure de test dans le repo (pas de `test` script ni vitest/jest/playwright). Conformément au brief, **aucun framework installé sans GO**. Fonction pure `resolveStorageUrl` fournie + cas documentés ci-dessus.
- **Manuels** : voir `dynamic-qa-checklist.md` §F (Storage) + §G (Messagerie), et la recette du brief LOT 33 (points 1–34) à exécuter sur un chantier `[QA]`.
