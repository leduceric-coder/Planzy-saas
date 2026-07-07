# Planzy — Plan du dataset de démonstration

**Statut :** Documentation de référence — NE PAS EXÉCUTER sans autorisation explicite.  
**Script SQL :** `DEMO_DATASET_SQL_DRAFT.sql`  
**Mapping écrans :** `DEMO_DATASET_MAPPING_ECRANS.md`  
**Checklist post-création :** `DEMO_DATASET_CHECKLIST.md`

---

## Objectif

Alimenter l'environnement de démo Planzy avec un dataset réaliste qui :
- Rend chaque page non-vide et crédible
- Illustre les cas d'usage terrain (retards, réserves critiques, conflits d'affectation)
- Reste cohérent avec le scénario de démo 5–7 minutes (voir `PLANZY_DEMO_SCENARIO_5_MIN.md`)

---

## Organisation cible

| Champ | Valeur |
|-------|--------|
| `org_id` | `11111111-1111-1111-1111-111111111111` |
| Nom | Planzy Test |

Toutes les entités créées appartiennent à cette organisation.  
Tout enregistrement de démo est préfixé `[DEMO]` dans son nom ou titre.

---

## Entités à créer

| Table | Quantité | Description |
|-------|----------|-------------|
| `projects` | 5 | 5 chantiers actifs avec avancements variés |
| `artisans` | 6 | Profils terrain avec métiers distincts |
| `teams` | 2 | Groupes d'artisans |
| `team_members` | 4 | Associations artisan ↔ équipe |
| `tasks` | 15 | Tâches par chantier : done, in_progress, blocked, todo |
| `issues` | 4 | Réserves : high × 2, critical × 2 |
| `photos` | 5 | Métadonnées only — URLs placeholder (upload manuel requis) |
| `documents` | 3 | Métadonnées only — URLs placeholder (upload manuel requis) |
| `message_threads` | 1 | Thread chantier "Villa Les Pins" |
| `messages` | 3 | Échanges terrain dans le thread |
| `reports` | 2 | Rapports pré-générés (weekly + monthly) |

---

## Les 5 chantiers

| ID court | Nom | Statut | Avancement | Couleur | Rôle dans la démo |
|----------|-----|--------|------------|---------|-------------------|
| P1 | [DEMO] Construction Villa Les Pins | active | 65 % | `#2563EB` | Chantier vedette, tâche bloquée, 2 réserves |
| P2 | [DEMO] Rénovation Appartement Rue de la Paix | active | 40 % | `#22C55E` | Chantier normal, tâche due aujourd'hui |
| P3 | [DEMO] Extension Garage Famille Moreau | active | 20 % | `#F59E0B` | Chantier en retard visible sur Dashboard |
| P4 | [DEMO] Réhabilitation École Saint-Exupéry | active | 55 % | `#EF4444` | Réserve critique visible dans Rapports |
| P5 | [DEMO] Maison Individuelle Lotissement Les Charmes | active | 10 % | `#8B5CF6` | Nouveau chantier, peu d'activité |

---

## Les 6 artisans

| ID court | Nom | Métier | Couleur | Rôle dans la démo |
|----------|-----|--------|---------|-------------------|
| A1 | Marc Dupont | Maçon | `#2563EB` | Affecté P1 |
| A2 | Pierre Martin | Électricien | `#EF4444` | Multi-affecté P1 + P4 → conflit visible |
| A3 | Sébastien Blanc | Charpentier | `#F59E0B` | Affecté P1 |
| A4 | Karim Benali | Plaquiste | `#6B7280` | Disponible (sans tâche cette semaine) |
| A5 | Thomas Leroy | Peintre | `#22C55E` | Affecté P2 |
| A6 | Julie Roux | Conductrice de travaux | `#8B5CF6` | Affectée P4 |

---

## Les 2 équipes

| ID court | Nom | Membres | Lead |
|----------|-----|---------|------|
| T1 | [DEMO] Équipe Gros Œuvre | Marc Dupont (A1), Karim Benali (A4) | Marc Dupont |
| T2 | [DEMO] Équipe Finitions | Thomas Leroy (A5), Julie Roux (A6) | Thomas Leroy |

---

## Alertes générées automatiquement par le SQL

Après l'insertion, la page `/rapports` affichera :

| Type | Source | Chantier |
|------|---------|---------|
| `critical_issue` | "Humidité sous-sol" (P1) | Villa Les Pins |
| `critical_issue` | "Infiltration fenêtre classe 3" (P4) | École Saint-Exupéry |
| `high_issue` | "Fissure mur nord" (P1) | Villa Les Pins |
| `blocked_task` | "Pose fenêtres" (P1) | Villa Les Pins |
| `blocked_task` | "Menuiseries extérieures" (P4) | École Saint-Exupéry |
| `late_task` | "Terrassement" (P3) — end_date dans le passé | Garage Moreau |

→ KPI Rapports attendu : **2 critiques**, **4+ réserves**, **1 retard**, **3 chantiers à risque**

---

## Ordre de création recommandé

```
1. projects (5)
2. artisans (6)
3. teams (2)
4. team_members (4)
5. tasks (15) — after projects + artisans + teams
6. issues (4) — after projects
7. photos (5, metadata only) — after projects + issues
8. documents (3, metadata only) — after projects
9. message_threads (1) — after projects
10. messages (3) — after message_threads
11. reports (2) — after projects
```

---

## Prérequis avant exécution

1. **Vérifier que le compte démo existe** : au moins 1 profil dans `profiles` avec `org_id = '11111111-...'`
2. **Récupérer le `user_id` du compte démo** : remplacer `:USER_ID` dans le SQL draft
3. **Vérifier la colonne `artisans.is_archived`** : absente du `schema.sql` de référence — vérifier avec `SELECT column_name FROM information_schema.columns WHERE table_name = 'artisans'`
4. **Ne pas uploader de vrais fichiers** : les URLs photos/documents sont des placeholders — remplacer par de vrais chemins Storage après upload manuel

---

## Idempotence

Le script utilise des UUIDs fixes et des `ON CONFLICT (id) DO NOTHING`.  
Il peut être réexécuté sans dupliquer les données.

---

## Rollback

Voir `DEMO_DATASET_ROLLBACK.sql` — supprime tous les enregistrements dont le nom contient `[DEMO]`.
