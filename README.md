# Planzy — Plateforme de gestion de chantiers BTP

**Stack :** Next.js 15 · TypeScript · Tailwind CSS · Supabase · Vercel

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Appliquer le schéma Supabase
# → Aller dans Supabase Dashboard > SQL Editor
# → Coller et exécuter le contenu de supabase/schema.sql

# 4. Lancer le serveur de développement
npm run dev
# → http://localhost:3000
```

## Structure du projet

```
planzy-saas/
├── app/
│   ├── (auth)/           # Login, Signup
│   ├── (dashboard)/      # Dashboard, Planning, Chantiers, Messages...
│   ├── mobile/           # Expérience artisan mobile
│   └── api/              # Routes API Next.js
├── components/
│   ├── ui/               # Composants UI (Button, Card, Badge...)
│   ├── layout/           # Sidebar, Header, ThemeProvider
│   ├── dashboard/        # KpiCard, ProjectCard, ActivityFeed...
│   ├── planning/         # Gantt interactif
│   ├── chantiers/        # Fiche chantier, tâches
│   ├── messages/         # Chat WhatsApp-like
│   └── mobile/           # Interface artisan terrain
├── lib/
│   ├── supabase/         # Clients Supabase (server + client)
│   ├── types.ts          # Types TypeScript complets
│   └── utils.ts          # Utilitaires
├── middleware.ts          # Protection des routes (auth)
└── supabase/
    └── schema.sql        # Schéma PostgreSQL complet (20+ tables)
```

## Architecture

- **Auth :** Supabase Auth avec SSR (cookies sécurisés)
- **DB :** PostgreSQL avec Row Level Security sur toutes les tables
- **Rôles :** owner > admin > manager > site_supervisor > artisan > viewer
- **Multi-tenant :** isolation par `org_id` sur toutes les tables
- **Stockage :** Supabase Storage (photos, documents) — buckets privés
- **Realtime :** Supabase Realtime sur messages et tâches

## Déploiement Vercel

1. Importer ce repo sur [vercel.com/new](https://vercel.com/new)
2. Framework : **Next.js** (détecté automatiquement)
3. Ajouter les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (votre URL Vercel)
4. Déployer

## Fonctionnalités

### Desktop (conducteurs, chefs de chantier, direction)
- Dashboard global avec KPIs en temps réel
- Planning Gantt interactif (drag & drop, détection conflits)
- Fiches chantiers avec onglets (tâches, messages, photos, documents, matériaux, réserves, rapports)
- Sidewindow tâche pour consultation/modification rapide
- Gestion équipes & artisans avec vue charge
- Messagerie typée par projet/équipe
- Upload documents & photos avec classement par thème
- Suivi matériaux & livraisons
- Génération de rapports hebdomadaires

### Mobile (artisans terrain)
- Vue ultra-simplifiée : mes tâches aujourd'hui
- Messagerie conversationnelle WhatsApp-like
- Upload photo en un clic
- Signalement de problèmes
- Validation tâches terminées
- Messages typés (consigne, blocage, photo, livraison absente...)
