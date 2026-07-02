# Planzy — Dataset recommandé pour la démo

**Important :** Ces données sont à créer manuellement dans la base de démo.  
Ne pas créer automatiquement sans accord explicite.  
Ce document décrit ce qu'il FAUT AVOIR pour une démo crédible.

---

## Résumé du dataset idéal

| Élément | Quantité minimale | Quantité idéale |
|---------|-------------------|-----------------|
| Chantiers actifs | 3 | 5–6 |
| Artisans | 4 | 6–8 |
| Équipes | 2 | 3 |
| Tâches totales | 15 | 30–40 |
| Tâches cette semaine | 6 | 10 |
| Tâches en retard | 1 | 2–3 |
| Tâches bloquées | 1 | 2 |
| Réserves ouvertes | 2 | 4–5 |
| Réserves critiques | 1 | 2 |
| Photos | 5 | 10–15 |
| Documents | 3 | 6–8 |
| Messages | 5 | 10–15 |
| Rapports générés | 1 | 2–3 |

---

## Les 5 chantiers

### Chantier 1 — "Construction Villa Les Pins"
**Rôle dans la démo :** Chantier vedette, bien avancé, quelques alertes

| Champ | Valeur |
|-------|--------|
| Statut | Actif |
| Avancement | 65 % |
| Couleur | Bleu (#2563EB) |
| Dates | Démarré il y a 3 mois, fin dans 2 mois |
| Adresse | 12 avenue des Pins, 33000 Bordeaux |

**Tâches :**
- "Coulage dalle RDC" — statut: done
- "Montage charpente" — statut: in_progress, échéance: cette semaine
- "Pose fenêtres" — statut: blocked (attente livraison)
- "Électricité premier passage" — statut: todo, échéance: semaine prochaine
- "Plâtrerie RDC" — statut: todo, échéance: dans 3 semaines

**Réserves :**
- "Fissure mur nord" — priorité: high, statut: open
- "Humidité sous-sol" — priorité: critical, statut: assigned

**Photos :** 3 photos terrain liées aux réserves

**Documents :**
- "Plan façade.pdf"
- "Attestation RE2020.pdf"

---

### Chantier 2 — "Rénovation Appartement Rue de la Paix"
**Rôle dans la démo :** Chantier normal, avancement correct

| Champ | Valeur |
|-------|--------|
| Statut | Actif |
| Avancement | 40 % |
| Couleur | Vert (#22C55E) |
| Dates | Démarré il y a 6 semaines, fin dans 6 semaines |

**Tâches :**
- "Démolition cloisons" — statut: done
- "Pose revêtement sol" — statut: in_progress, échéance: aujourd'hui
- "Peinture chambres" — statut: todo, échéance: dans 2 semaines

**Réserves :** 1 réserve normale (statut: open)

---

### Chantier 3 — "Extension Garage Famille Moreau"
**Rôle dans la démo :** Chantier avec retard planning — visible sur Dashboard

| Champ | Valeur |
|-------|--------|
| Statut | Actif |
| Avancement | 20 % |
| Couleur | Orange (#F59E0B) |
| Dates | Aurait dû commencer il y a 2 semaines, en retard |

**Tâches :**
- "Terrassement" — statut: in_progress, end_date: **il y a 5 jours** ← retard visible
- "Fondations" — statut: todo, end_date: dans 3 jours

**Documents :** 1 permis de construire

---

### Chantier 4 — "Réhabilitation École Saint-Exupéry"
**Rôle dans la démo :** Chantier institutionnel avec réserve critique

| Champ | Valeur |
|-------|--------|
| Statut | Actif |
| Avancement | 55 % |
| Couleur | Rouge (#EF4444) |
| Dates | En cours |

**Tâches :**
- "Isolation toiture" — statut: done
- "Menuiseries extérieures" — statut: blocked ← conflit livraison
- "Peinture couloirs" — statut: todo

**Réserves :**
- "Infiltration fenêtre classe 3" — priorité: critical, statut: open ← visible dans rapports

**Photos :** 2 photos liées à la réserve (avec badge Réserve dans Documents)

---

### Chantier 5 — "Maison Individuelle Lotissement Les Charmes"
**Rôle dans la démo :** Chantier récent, peu avancé, pas d'alerte

| Champ | Valeur |
|-------|--------|
| Statut | Actif |
| Avancement | 10 % |
| Couleur | Violet (#8B5CF6) |
| Dates | Démarré la semaine dernière |

**Tâches :**
- "Terrassement" — statut: done
- "Implantation" — statut: in_progress

---

## Les artisans

| Nom | Métier | Statut cette semaine | Chantiers |
|-----|--------|---------------------|-----------|
| Marc Dupont | Maçon | Affecté | Villa Les Pins |
| Pierre Martin | Électricien | Multi-affecté ← conflit | Villa Les Pins + Réhabilitation École |
| Sébastien Blanc | Charpentier | Affecté | Villa Les Pins |
| Karim Benali | Plaquiste | Disponible | — |
| Thomas Leroy | Peintre | Affecté | Appartement Rue de la Paix |
| Julie Roux | Conductrice de travaux | Affecté | École Saint-Exupéry |

**Équipes :**
- "Équipe Gros Œuvre" : Marc Dupont + Karim Benali
- "Équipe Finitions" : Thomas Leroy + Julie Roux

---

## Les messages

Dans la fiche du chantier "Villa Les Pins" :
- Message de Marc : "La dalle est coulée, on attaque la charpente demain"
- Message de Sébastien : "Livraison charpente repoussée au jeudi, je préviens ?"
- Réponse conducteur : "Ok, préviens-moi dès que c'est livré"

---

## Les photos

| Photo | Chantier | Statut |
|-------|----------|--------|
| Photo fissure mur nord | Villa Les Pins | Lié à réserve "high" → badge Réserve |
| Photo humidité sous-sol | Villa Les Pins | Lié à réserve "critical" → badge Réserve |
| Photo coulage dalle | Villa Les Pins | Pas de réserve → Normal |
| Photo infiltration fenêtre | École Saint-Exupéry | Lié à réserve critique → badge Réserve |
| Photo revêtement sol | Appartement Rue de la Paix | Pas de réserve → Normal |

---

## Les rapports pré-générés

| Rapport | Chantier | Type | Période |
|---------|----------|------|---------|
| "Rapport semaine du 26 mai" | Villa Les Pins | Hebdo | Semaine passée |
| "Rapport Mai 2026" | Tous chantiers | Global | Mois passé |

---

## Notes d'implémentation

- Créer les données dans cet ordre : projets → artisans → équipes → tâches → réserves → photos → messages
- Générer les rapports depuis l'interface (bouton Générer)
- S'assurer que Pierre Martin a bien des tâches sur 2 chantiers la même semaine pour le conflit
- S'assurer que la tâche "Terrassement" du Chantier 3 a une end_date dans le passé
- Uploader les photos depuis la fiche chantier ou la page Documents
- Lier les photos aux réserves pour que les badges s'affichent correctement
