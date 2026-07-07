# Planzy — Recette globale LOT 17
**Date :** 2026-06-05  
**Branch :** `claude/ai-agent-team-setup-haTmE`  
**Build :** 23/23 pages — Vercel READY  
**TypeScript :** 0 erreur

---

## 1. Résumé exécutif

La recette globale LOT 17 couvre l'ensemble du produit Planzy après la refonte des pages terrain (LOT 16.A–16.F). Le produit est stable, cohérent et buildable. Trois bugs mineurs d'accessibilité ont été corrigés. Aucune régression fonctionnelle détectée. Aucune modification de schéma, RLS ou Auth.

**Verdict global : GO**

---

## 2. Parcours testés (audit statique)

| # | Parcours | Résultat |
|---|----------|----------|
| 1 | Dashboard → KPI → TodayFocus | ✅ |
| 2 | Dashboard → ouvrir chantier | ✅ (liens `/chantiers/{id}`) |
| 3 | Fiche chantier → tabs Planning / Réserves / Photos | ✅ |
| 4 | Planning général → Gantt / tâches / undated | ✅ |
| 5 | Équipes & terrain → artisans / équipes / side-panels | ✅ |
| 6 | Documents & photos → filtres / galerie / side-panel | ✅ |
| 7 | Rapports & alertes → KPI / priorités / alertes / rapports | ✅ |
| 8 | Messagerie → side-window / threads | ✅ |
| 9 | Mode clair / sombre | ✅ |
| 10 | Sidebar collapse / expand | ✅ |

---

## 3. Écrans validés

| Écran | Statut |
|-------|--------|
| Dashboard Terrain V2 | ✅ Validé |
| Page Chantiers V2 | ✅ Validé |
| Fiche chantier V2 | ✅ Validé |
| Planning général | ✅ Validé |
| Équipes & terrain V2 | ✅ Validé |
| Documents & photos V2 | ✅ Validé |
| Rapports & alertes V2 | ✅ Validé |
| Messagerie side-window | ✅ Validé |
| Mode clair / sombre | ✅ Validé |

---

## 4. Problèmes bloquants

Aucun.

---

## 5. Problèmes non bloquants corrigés

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 1 | `DocumentsClient.tsx` | Bouton "effacer recherche" manquait `aria-label` | Ajout `aria-label="Effacer"` |
| 2 | `RapportGlobalView.tsx` | `<a href="/rapports">` causait un full reload | Converti en `<Link href="/rapports">` + import ajouté |
| 3 | `PrintButton.tsx` | Texte "Imprimer" masqué sur mobile (`hidden sm:inline`) sans `aria-label` | Ajout `aria-label="Imprimer la page"` |

---

## 6. Dettes UX (non bloquantes, à traiter en LOT 18+)

| # | Écran | Problème | Priorité |
|---|-------|----------|----------|
| 1 | Rapports & alertes | Pas de lien direct vers `/planning` depuis une alerte "tâche en retard" (lien vers `/chantiers/{id}` seulement) | Faible |
| 2 | Dashboard | Widget MessagesTeam : les "quick actions" (photo, doc, task) ne créent pas vraiment depuis le dashboard — elles renvoient vers la messagerie | Faible |
| 3 | Documents | La section "À valider" disparaît si on filtre — normal mais peut surprendre l'utilisateur | Faible |
| 4 | Équipes | Le filtre "Équipes" dans les alertes Rapports n'existe pas (conflits équipe non fetchés côté rapports) | Faible |

---

## 7. Dettes techniques

| # | Fichier | Dette | Priorité |
|---|---------|-------|----------|
| 1 | `lib/alerts.ts` | `getAlertsSummary` fetch des messages (48h) mais ne retourne pas le badge sur la sidebar Messages | Faible |
| 2 | `ChantiersClient.tsx` | `×` button (HTML entity) cohérent avec les autres pages (EquipesClient, etc.) mais `aria-label="Effacer la recherche"` dupliqué partout — candidat à un composant `ClearButton` | Très faible |
| 3 | `RapportGlobalView.tsx` | N'importait pas `Link` de next/link (utilisait `<a>`) — corrigé en LOT 17 | Corrigé |

---

## 8. Corrections appliquées

### LOT 17 — 3 fichiers modifiés

```
components/documents/DocumentsClient.tsx  → aria-label="Effacer" ajouté
components/rapports/PrintButton.tsx       → aria-label="Imprimer la page" ajouté
components/rapports/RapportGlobalView.tsx → <a> → <Link> + import ajouté
```

### Corrections antérieures (pour mémoire)

- LOT 16.C.1 : grille "À surveiller" max-w-[520px] pour 1 item
- LOT 16.E.1 : KPI Documents — grid-cols responsive + min-h-[80px]

---

## 9. Corrections reportées (LOT 18+)

| Correction | Raison du report |
|------------|-----------------|
| Ajouter lien `/planning` dans alertes Rapports | Nécessite query param ou deep link, non trivial sans risque |
| Composant `ClearButton` unifié | Refactor cosmétique, pas bloquant |
| Fetch conflits équipe dans Rapports | Requiert logique complex du côté equipes (fan-out), hors scope LOT 17 |

---

## 10. Checklist light/dark

| Composant | Light | Dark |
|-----------|-------|------|
| Dashboard | ✅ | ✅ |
| Chantiers | ✅ | ✅ |
| Fiche chantier | ✅ | ✅ |
| Planning Gantt | ✅ | ✅ |
| Équipes | ✅ | ✅ |
| Documents | ✅ | ✅ |
| Rapports | ✅ | ✅ |
| Messagerie | ✅ | ✅ |
| Modals | ✅ | ✅ |
| Side-windows | ✅ | ✅ |

Tokens utilisés systématiquement : `bg-surface`, `bg-elevated`, `border-border/40`, `dark:border-white/[0.08]`, `text-muted-foreground`, `text-foreground`. Pas de couleurs concrètes (slate, gray) dans les nouveaux composants LOT 16.

---

## 11. Checklist navigation

| Lien | Destination | Statut |
|------|-------------|--------|
| Sidebar → Tableau de bord | `/` | ✅ |
| Sidebar → Chantiers | `/chantiers` | ✅ |
| Sidebar → Planning | `/planning` | ✅ |
| Sidebar → Équipes & terrain | `/equipes` | ✅ |
| Sidebar → Documents & photos | `/documents` | ✅ |
| Sidebar → Rapports & alertes | `/rapports` | ✅ |
| Sidebar → Messages | `/messages` | ✅ |
| Sidebar → Membres & accès | `/settings/team` | ✅ |
| Sidebar → Nouveau Chantier | `/chantiers/nouveau` | ✅ |
| Rapports → Rapport global | `/rapports/global` | ✅ |
| Rapport global → ← Rapports | `/rapports` (Link) | ✅ (corrigé) |
| Rapport chantier → ← Rapports | `/rapports` (Link) | ✅ |
| Alertes → Chantier | `/chantiers/{id}` | ✅ |
| `/dashboard` | Redirect vers `/` | ✅ intentionnel |

---

## 12. Checklist responsive

| Breakpoint | Résultat |
|------------|----------|
| Desktop (>= 1280px) | ✅ |
| Laptop (1024–1279px) | ✅ |
| Tablette large (768–1023px) | ✅ (KPI 2 cols, grilles s'adaptent) |
| Mobile portrait (< 640px) | ⚠️ Utilisable mais non optimisé (hors cible principale) |

KPI grille : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — cohérent sur toutes les nouvelles pages.

---

## 13. GO / NO GO global

| Critère | Statut |
|---------|--------|
| TypeScript 0 erreur | ✅ |
| Build 23/23 pages | ✅ |
| Aucun lien cassé | ✅ |
| Dark mode cohérent | ✅ |
| Light mode cohérent | ✅ |
| Aucune régression Dashboard | ✅ |
| Aucune régression Chantiers | ✅ |
| Aucune régression Planning | ✅ |
| Aucune modification Supabase | ✅ |
| Aucune modification RLS | ✅ |
| Aucune modification Auth | ✅ |
| Accessibilité de base | ✅ (3 bugs corrigés) |
| Responsive laptop/tablette | ✅ |

**GO — Le produit Planzy est stable et prêt pour déploiement Vercel.**
