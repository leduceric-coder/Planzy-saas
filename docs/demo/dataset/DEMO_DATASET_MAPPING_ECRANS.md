# Planzy — Mapping dataset ↔ écrans de démo

Ce document indique quelle donnée alimente quel écran,  
pour valider le dataset avant une démonstration.

---

## Écran 1 — Dashboard (`/`)

| Widget | Données requises | Source dataset |
|--------|-----------------|----------------|
| KPI "Chantiers actifs" | ≥ 3 projets `status = 'active'` | P1 + P2 + P3 + P4 + P5 → **5** |
| KPI "Tâches cette semaine" | Tâches avec `end_date` entre lundi et vendredi de la semaine courante | T1.2 (P1) + T2.2 (P2) + T3.2 (P3) → **3 min.** |
| KPI "Alertes" | Issues critiques ou high + tâches bloquées | I1.2 (critical) + I4.1 (critical) + T1.3 (blocked) + T4.2 (blocked) → **4** |
| Bloc "À surveiller" | Tâches bloquées ou en retard | T1.3 + T4.2 (bloquées) + T3.1 (retard) |
| Planning semaine (WeekByDay) | Tâches `in_progress` ou `todo` avec `end_date` cette semaine | T1.2, T2.2, T3.2 |
| Affectations équipes | Artisans avec tâches `in_progress` cette semaine | A1 (P1), A2 (P1+P4 → **conflit**), A3 (P1), A5 (P2), A6 (P4) |

**Points forts Dashboard :**
- Pierre Martin (A2) apparaît avec statut **Multi-affecté** (P1 + P4 même semaine)
- Au moins 1 alerte critique visible

---

## Écran 2 — Page Chantiers (`/chantiers`)

| Élément visuel | Données requises | Source dataset |
|---------------|-----------------|----------------|
| Carte avec barre progression 65 % | `projects.progress = 65` | P1 |
| Badge "à risque" ou couleur rouge | Tâche bloquée ou réserve ouverte | P1 (T1.3 bloquée + 2 issues), P4 (T4.2 + I4.1 critical) |
| 5 cartes actives | 5 projets `status = 'active'` | P1–P5 |
| Chantier avec retard (orange) | `progress` bas + tâche en retard | P3 (progress=20, T3.1 en retard) |

**Points forts Chantiers :**
- Spectre complet : P5 (10%) → P3 (20%) → P2 (40%) → P4 (55%) → P1 (65%)
- Contraste visuel immédiat entre chantiers sains et à risque

---

## Écran 3 — Fiche chantier (`/chantiers/[P1]`)

| Onglet / Zone | Données requises | Source dataset |
|--------------|-----------------|----------------|
| KPI avancement | `progress = 65` | P1 |
| Mini-Gantt | Tâches avec `start_date` et `end_date` | T1.1 → T1.5 (5 tâches) |
| Tâche bloquée visible | `status = 'blocked'` | T1.3 "Pose fenêtres" |
| Tâche en retard | `end_date < CURRENT_DATE` et non terminée | Aucune sur P1 — voir P3 pour ce cas |
| Onglet Messagerie | Thread + 3 messages | MT1 + M1 + M2 + M3 |
| Onglet Réserves | Issues ouvertes | I1.1 (high) + I1.2 (critical) |

**Points forts Fiche chantier :**
- Messagerie : 3 messages avec échange conducteur ↔ artisan
- Réserves : 2 niveaux de priorité (high + critical) visibles simultanément

---

## Écran 4 — Planning général (`/planning`)

| Élément visuel | Données requises | Source dataset |
|---------------|-----------------|----------------|
| Barres multi-chantiers | Tâches avec `start_date` et `end_date` sur ≥ 3 projets | P1 (5) + P2 (3) + P3 (2) + P4 (3) + P5 (2) |
| Tâche dans le passé | `end_date < CURRENT_DATE` | T3.1 "Terrassement Garage" (5 jours de retard) |
| Densité semaine courante | Tâches `in_progress` ou `todo` fin cette semaine | T1.2, T2.2, T3.2 |

**Points forts Planning :**
- La barre de T3.1 dépasse dans le passé → retard immédiatement visible
- 5 couleurs de projets distinctes

---

## Écran 5 — Équipes & terrain (`/equipes`)

| Élément visuel | Données requises | Source dataset |
|---------------|-----------------|----------------|
| Badge "Disponible" | Artisan sans tâche `in_progress` ou `todo` cette semaine | A4 Karim Benali |
| Badge "Affecté" | Artisan avec ≥ 1 tâche active | A1, A3, A5, A6 |
| Badge "Multi-affecté" | Artisan avec tâches sur ≥ 2 projets même semaine | A2 Pierre Martin (P1 + P4) |
| Équipes avec membres | `teams` + `team_members` | T1 (A1+A4), T2 (A5+A6) |
| Panneau latéral artisan | Tâches de la semaine pour l'artisan | A1 → T1.2 (montage charpente) |

**Points forts Équipes :**
- Pierre Martin → cas de conflit d'affectation très visible

---

## Écran 6 — Documents & photos (`/documents`)

| Widget / Zone | Données requises | Source dataset |
|--------------|-----------------|----------------|
| KPI "Photos récentes" | Photos dans les 7 derniers jours | PH1–PH5 (`taken_at = CURRENT_DATE`) |
| KPI "Réserves liées" | Photos avec `issue_id` non null | PH1 (I1.1), PH2 (I1.2), PH4 (I4.1) → **3** |
| Badge "Réserve" sur photo | `issue_id IS NOT NULL` | PH1, PH2, PH4 |
| Galerie photo | Au moins 5 photos | PH1–PH5 |
| Panneau prévisualisation | Clic sur photo → issue liée visible | PH2 → I1.2 (critical) |
| Liste documents | Docs filtrables par chantier | D1+D2 (P1), D3 (P3) |

**Points forts Documents :**
- 3 photos avec badge Réserve sur 5 → ratio élevé, fort impact visuel
- PH2 liée à une réserve `critical` → badge le plus urgent

---

## Écran 7 — Rapports & alertes (`/rapports`)

| Widget / Zone | Données requises | Source dataset |
|--------------|-----------------|----------------|
| KPI "Alertes critiques" | Issues `priority = 'critical'` + tâches bloquées | I1.2 + I4.1 + T1.3 + T4.2 → **4** |
| KPI "Réserves ouvertes" | Issues `status IN ('open','assigned','in_progress')` | I1.1 + I1.2 + I2.1 + I4.1 → **4** |
| KPI "Tâches en retard" | Tâches non terminées avec `end_date < CURRENT_DATE` | T3.1 → **1** |
| KPI "Chantiers à risque" | Projets avec ≥ 1 alerte | P1, P3, P4 → **3** |
| Section "À traiter en priorité" | Top 5 alertes triées par priorité | I1.2 (critical), I4.1 (critical), T1.3 (blocked), T4.2 (blocked), T3.1 (late) |
| Clic alerte → chantier | Navigation vers `/chantiers/[id]` | Test sur I4.1 → P4 |
| Historique rapports | Reports générés | R1 (weekly P1) + R2 (monthly global) |

**Points forts Rapports :**
- KPI immédiatement chargés, non nuls
- 2 alertes critiques visibles en haut de "À traiter"
- Historique avec 2 rapports distincts (hebdo + mensuel)

---

## Résumé de validation rapide

| Page | Critère minimum | Dataset fourni |
|------|----------------|----------------|
| Dashboard | ≥ 3 chantiers, ≥ 1 alerte, affectations visibles | ✓ 5 chantiers, 4 alertes, conflit visible |
| Chantiers | ≥ 1 badge rouge / à risque | ✓ P1 + P4 en rouge |
| Fiche chantier | Messagerie non vide + 1 tâche bloquée | ✓ 3 messages, T1.3 bloquée |
| Planning | ≥ 1 barre dans le passé | ✓ T3.1 (end_date = -5j) |
| Équipes | Badge Multi-affecté visible | ✓ Pierre Martin |
| Documents | ≥ 3 photos avec badge Réserve | ✓ PH1, PH2, PH4 |
| Rapports | Tous les KPI > 0 + 2 rapports historique | ✓ 4/4/1/3 + R1+R2 |
