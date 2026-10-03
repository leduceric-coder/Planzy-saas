# DentalFlow Next — V3.3 Test Report

Fichier testé : `dentalflow-next-poc-v3.3.html`
Méthode : Playwright (Chromium headless) + revue de code. `localStorage` vidé
avant chaque scénario. Date de démo : `Clock.demoDate = 2026-08-21 10:42`.

**Résultat global : 24 / 24 vérifications OK · 0 erreur console** sur toutes les
vues et tous les modes.

---

## P0 — Vie privée patient (§58)

| Vérification | Attendu | Résultat |
|---|---|---|
| Aucun `patientFirst`/`patientLast` dans localStorage | absent | ✅ |
| Toutes les références patient opaques (`PAT-XXXXXX`) | oui | ✅ |
| Le modèle `order` ne contient plus de champ nominatif | oui | ✅ |
| `createOrder` génère un id opaque `CMD-0205` | oui | ✅ |
| `createOrder` génère une réf. opaque `PAT-…` | oui | ✅ |
| QR encode uniquement l'`orderId` (aucun PAT/nom) | oui | ✅ |
| Portail cabinet : référence opaque, pas de nom | oui | ✅ (capture) |

## P0 — Historique de scan immuable (§59)

| Vérification | Attendu | Résultat |
|---|---|---|
| Scan `CMD-0143` = « Usinage » (Marc, 10:42) | figé | ✅ |
| Renommage Usinage → Fraisage : `stageLabelAtScan` inchangé | « Usinage » | ✅ |
| Localisation confirmée suit l'`id` du poste | « Fraisage » | ✅ |
| Désactivation du poste : historique inchangé | « Usinage » | ✅ |

## P0 — Source de vérité de la localisation (§60)

| Vérification | Attendu | Résultat |
|---|---|---|
| `CMD-0190` sans scan | « Localisation non confirmée » | ✅ |
| Après scan Réception / Marc | poste + technicien confirmés | ✅ |
| Aucune autre action ne modifie la localisation confirmée | — | ✅ (drag & drop retiré) |

## P1 — Statuts état + flags (§61)

| Vérification | Attendu | Résultat |
|---|---|---|
| `CMD-0143` : retard **et** blocage simultanés | oui | ✅ |
| Signaux cumulés (≥ 2) | oui | ✅ |
| Une seule carte « À surveiller » pour la commande | oui | ✅ |
| KPI En retard +1 · KPI Bloquées +1 | oui | ✅ |
| Donut : somme des catégories = total | oui | ✅ |

## P1 — Horloge unique (§62)

| Vérification | Attendu | Résultat |
|---|---|---|
| Changement de `Clock.demoDate` → nouveau scan daté via `Clock.now()` | 2026-09-15 08:30 | ✅ |
| Messages / audit / création / congés utilisent `Clock` | oui | ✅ (revue) |

## P1 — Navigation (§63)

| Vérification | Attendu | Résultat |
|---|---|---|
| Nav principale = Accueil / Commandes / Production / Messages | oui | ✅ |
| Groupe « Outils » = Plan de charge / Stocks / Rapports / Utilisateurs | oui | ✅ |
| Aucune perte de fonctionnalité | oui | ✅ |
| Pas de drag & drop du menu | supprimé | ✅ |

## P1 — Portail cabinet (§64)

| Vérification | Attendu | Résultat |
|---|---|---|
| Statut simplifié (Reçue/Fabrication/Contrôle/Prête/Livrée) | oui | ✅ |
| Référence patient opaque affichée | oui | ✅ |
| Aucun technicien / heure de scan / poste interne visible | oui | ✅ (capture) |
| 3 dates de livraison (Au plus tôt / Recommandée / Confort) | oui | ✅ |

## P1 — Mode collaborateur (§65)

| Vérification | Attendu | Résultat |
|---|---|---|
| Ouvre directement l'écran Scan | oui | ✅ |
| « Mes congés » accessible en secondaire | oui | ✅ |
| Placeholder de scan = `CMD-0190` (plus d'id nominatif) | oui | ✅ |

## P2 — Cleanup

| Vérification | Attendu | Résultat |
|---|---|---|
| Emails de démo sans marque Planzy | `@dentalflow-demo.fr` | ✅ |
| Pièces jointes : 2 Mo/fichier, 5 max/conversation, erreur claire | oui | ✅ (revue) |

## Non-régression (§66)

Vues et modes parcourus sans erreur console : Accueil, Commandes, Production
(dont bloc « Sans localisation confirmée »), Plan de charge, Stocks, Rapports,
Utilisateurs, Quick View, Traçabilité, Messages, Portail cabinet, Mode
collaborateur, Mode Scan, QR, Impression fiche, **dark mode**.

- Erreurs console cumulées sur l'ensemble des parcours : **0**.
- Light / Dark / System dark : cohérents (composants nouveaux vérifiés).

---

## Scénario de démonstration (§73) — déroulé validé

1. Responsable ouvre l'Accueil → KPI, à surveiller, flux. ✅
2. Recherche `CMD-0190` → Quick View : réf. `PAT-…`, localisation **non
   confirmée**. ✅
3. Marc scanne `CMD-0190` au poste Réception (mode Scan). ✅
4. Quick View recalculée : Réception · Marc · heure. ✅
5. Réception renommé « Arrivées » → Production affiche « Arrivées », mais
   l'historique du scan reste « Réception ». ✅
6. Le cabinet voit « Reçue / Fabrication / Livraison estimée » — jamais Marc,
   Réception, ni l'heure de scan. ✅

## Limites connues (POC)

- Une commande confirmée à un poste ensuite **désactivé** reste localisée à ce
  poste (label lisible via l'`id`) mais n'apparaît plus dans une colonne active
  du tableau Production. Comportement acceptable pour la démo ; le toast prévient
  lors de la désactivation.
- Pièces jointes toujours stockées en DataURL (IndexedDB = P2 non retenu pour ne
  pas déstabiliser le POC).
