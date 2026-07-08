# Refonte de la barre latérale de navigation (desktop)

## Objectif
Rendre le menu latéral plus simple, lisible, cohérent et premium, sans refonte
hors périmètre ni nouveau design system parallèle.

## Architecture cible
```
Logo Kanvix                     ⟵ réduction de la sidebar
[ + Nouveau chantier   ⌄ ]      ⟵ split button (action + menu de créations)

PILOTAGE
  Vue d'ensemble   /
  Chantiers        /chantiers
  Planning         /planning
  Rapports         /rapports

COLLABORATION
  Équipe           /equipes
  Documents        /documents
  Messages         /messages

[ Avatar · Nom · Rôle · … ]     ⟵ bloc utilisateur + menu contextuel
```

## Source unique de vérité — `lib/navigation.ts`
Module **pur** (aucune dépendance React/JSX/icône, testable avec `node --test`) :
libellés, routes, sections, motifs d'état actif (parent + sous-routes), règle
d'accès admin, tons de badge. Les icônes sont résolues côté composant via une
table `NavId → LucideIcon`. Plus aucune condition d'état actif dispersée dans le
JSX.

## Correspondance des libellés
| Ancien | Nouveau |
|---|---|
| Tableau de bord | Vue d'ensemble |
| Équipes & terrain | Équipe |
| Documents & photos | Documents |
| Rapports & alertes | Rapports |
| Chantiers / Planning / Messages | inchangés |

## Administration
La section visible « Administration » est retirée de la nav principale. L'accès
« Membres & accès » (`/settings/team`) est déplacé dans le menu contextuel du
profil, conditionné au rôle (`owner` / `admin` — règle métier inchangée).

## Bouton « Nouveau chantier »
Split button : clic principal → `/chantiers/nouveau` ; chevron → menu des
créations réellement opérationnelles :
- Nouveau chantier → route `/chantiers/nouveau`
- Nouvelle tâche → modale `NouvelleTacheRapide`
- Ajouter un artisan → route `/equipes/nouveau-artisan`
- Nouveau rapport → modale `GenererRapportModal`

Accessibilité (clavier, Échap, clic extérieur, fermeture après sélection, focus)
fournie par la primitive `DropdownMenu` (Radix). En mode réduit : bouton carré
« + » avec tooltip ouvrant le même menu.

## Badges — tons sémantiques
Fini le rouge permanent. `navBadgeFor(id, alertCounts)` :
- **Chantiers** : réserves critiques → **rouge (critical)** ;
- **Planning** : tâches en retard + bloquées → **orange (attention)** ;
- **Messages** : messages reçus récemment → **bleu (info)**.
Aucun badge pour un simple total. Chaque badge porte un `aria-label` + `title`
explicite (ex. « 2 réserves critiques »).

## État actif
Fond `bg-primary/10`, coins arrondis, texte plus clair, icône en `text-primary`,
accent vertical discret au bord gauche, transition légère (`motion-reduce`
respecté). `aria-current="page"`. Le parent est actif sur ses sous-routes
(`/chantiers/[id]` → Chantiers ; `/equipes/nouveau-artisan` → Équipe ; les
documents d'un chantier vivent sous `/chantiers/[id]` → activent Chantiers).

## Mode réduit
Icônes seules + tooltips, logo compact, accent actif visible, badges lisibles
sans chevauchement. Préférence ouverte/réduite persistée en `localStorage`
(`planzy-sidebar-collapsed`), lue au montage → aucun mismatch d'hydratation SSR.

## Messages — fenêtre latérale
L'entrée **Messages** (section Collaboration) **rouvre la fenêtre latérale**
(`MessagesSideWindow`) et ne navigue pas vers la pleine page. Modélisé dans la
config par `action: 'open-messages'` (l'`href: '/messages'` reste renseigné pour
le matching d'état actif et le repli). Le clic déclenche `onOpenMessages`.

## Mobile
La navigation mobile dédiée (`/mobile`, `MobileArtisanView`) n'est pas touchée :
la refonte concerne la sidebar desktop. Aucune substitution de l'une par l'autre.

## Fichiers
- `lib/navigation.ts` (nouveau) — config + logique pures.
- `lib/navigation.test.ts` (nouveau) — tests `node --test`.
- `components/ui/dropdown-menu.tsx` (nouveau) — primitive shadcn/Radix.
- `components/layout/SidebarNewMenu.tsx` (nouveau) — bouton de création.
- `components/layout/SidebarUserMenu.tsx` (nouveau) — bloc utilisateur + menu.
- `components/layout/Sidebar.tsx` (réécrit).
- `app/(dashboard)/DashboardShell.tsx` (maj — prop obsolète retirée).
- `tsconfig.json` (`allowImportingTsExtensions` pour le test Node).

## Tests
- `node --test lib/navigation.test.ts` → 6/6 ✅
- `tsc --noEmit` → 0 erreur ✅
- `next build` → succès (23 routes, aucun lien mort) ✅
- `next lint` : indisponible (supprimé dans Next 16 ; aucune config ESLint).
