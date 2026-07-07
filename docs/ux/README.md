# Planzy — Documentation UX V2 (LOT 15.A)

Dossier d'audit UX et de direction design produit pour la refonte **Planzy V2**.
Produit au LOT 15.A. **Aucune modification de code applicatif** — uniquement de l'analyse et
de la spécification, fondées sur la lecture du code réel du dépôt.

## Objectif

Planzy V1 est fonctionnellement riche et techniquement solide, mais l'UX a grossi par accumulation
de lots : densité, redondances, nommage ambigu. La V2 vise à revenir à la promesse initiale —
**cockpit chantier simple, beau, lisible, efficace, Apple-like** — en **soustrayant et réorganisant**,
pas en ajoutant.

Cap : **80 % simplicité Apple · 15 % cockpit métier · 5 % effet waouh.**

## Documents

| Fichier | Contenu | Pour qui |
|---------|---------|----------|
| [`PLANZY_UX_V2_AUDIT.md`](./PLANZY_UX_V2_AUDIT.md) | Cartographie écran par écran, diagnostic transverse, table des 16 frictions priorisées, ce qu'on garde / simplifie | Décision produit, base de tout |
| [`PLANZY_DESIGN_DIRECTION_V2.md`](./PLANZY_DESIGN_DIRECTION_V2.md) | 7 principes, inspiration Gemini adaptée, architecture cible (nav 6 entrées), système d'alerte unifié, catalogue de cards, règles design, maquettes textuelles | Design & dev |
| [`PLANZY_ROADMAP_UX_V2.md`](./PLANZY_ROADMAP_UX_V2.md) | 10 parcours utilisateurs cibles, 9 lots (15.B → 15.J) séquencés, matrice modèle Claude, vigilances, GO/NO GO | Pilotage exécution |

## Ordre de lecture

1. **Audit** (le problème, fondé sur le code réel)
2. **Direction design** (la cible)
3. **Roadmap** (l'exécution)

## TL;DR — 5 problèmes majeurs

1. **Doublon de nommage** « Équipes » vs « Mon équipe » (même icône) — navigation déroutante.
2. **Double liste de tâches** sur le dashboard (et **triple** sur la fiche chantier).
3. **Fiche chantier** = scroll unique de 10+ sections (1027 lignes) — à passer en onglets.
4. **Modèle d'alerte non unifié** : 4 définitions divergentes de « ce qui ne va pas ».
5. **Planning** très puissant mais résolution cachée + toolbar trop dense.

## TL;DR — séquence recommandée

`15.B (quick wins) → 15.D (alertes) → 15.C (dashboard) → 15.E (planning) → 15.F (fiche chantier) →
15.G/H/I (ressources) → 15.J (polish design system)`

## Décisions produit à acter avant 15.B

- **Messages** dans la nav : contextuel (fiche chantier) ou footer discret ?
- **Validation documents** : a-t-on besoin d'un statut « à valider / validé » ?
- **Vue Terrain** (Équipes) : priorité haute ou V2+ ?

---
*Statut : LOT 15.A livré — à valider avant lancement de la refonte.*
