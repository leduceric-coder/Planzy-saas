# LOT 32 — Résultats de recette dynamique finale

- **Branche** : `claude/kanvix-lot-27b-reprise-8qtjsn`
- **SHA testé** : `8d185ef5ec48476060d54c30bec95a833c539723`
- **Preview** : https://kanvix-saas-git-claude-kanvix-lo-76d15a-erics-projects-8e37d8e4.vercel.app
- **Base** : `qmuowzsfxsuqythghmtx` (Production = Preview = **partagée**)
- **Compte de test** : ________________  · **Org de test** : ________________
- **Date d'exécution** : ____________  · **Exécutant** : ____________

> ⚠️ Recette **navigateur = à exécuter par l'utilisateur** (application authentifiée +
> Preview protégée par Vercel SSO → non exécutable par l'agent). Tant que la ligne
> n'est pas exécutée, statut = **NON TESTÉ**. Ne jamais marquer PASS sans exécution
> réelle. Reporter erreurs console/réseau dans la section dédiée.

Statuts : **PASS** · **FAIL** · **BLOQUÉ** · **NON TESTÉ**. Criticité : 🔴 bloquant · 🟠 majeur · 🟡 mineur.

## Pré-vérifications statiques (read-only, hors navigateur — déjà faites par l'agent)

| Vérif. | Méthode | Résultat |
|---|---|---|
| Schéma riche présent sur `qmuo` (9 migrations) | SELECT information_schema/pg_catalog | ✅ tous objets présents |
| Buckets Storage `avatars/documents/photos` | SELECT storage.buckets | ✅ présents |
| RLS activée sur toutes les tables cœur | SELECT pg_tables | ✅ true |
| SECURITY DEFINER sans `search_path` | SELECT pg_proc | ✅ 0 |
| « 1 semaine = 5 jours ouvrés » | `lib/business-days.ts` (`BUSINESS_DAYS_PER_WEEK=5`, `durationToBusinessDays = value*5`) | ✅ conforme |
| Chemin de mutation tâche **unique** (TaskSidePanel) | Analyse `ChantierDetail.tsx` (LOT 29) : `EditTacheModal` tâches non déclenché ; édition = `onTaskClick → setSelectedTask → TaskSidePanel` | ✅ un seul chemin actif |
| `/api/debug-supabase` absent | routes `next build` | ✅ supprimé |
| TypeScript / build | `tsc --noEmit` / `next build` | ✅ 0 / exit 0 |

> Ces pré-vérifications **n'équivalent pas** à un test navigateur : elles réduisent le
> risque mais l'exécution réelle des flux reste requise ci-dessous.

## A. Authentification (Phase 3)
| ID | Scénario | Crit. | Attendu | Statut | Comm./Preuve |
|---|---|---|---|---|---|
| A1 | Connexion compte de test | 🔴 | Redirection Dashboard | NON TESTÉ | |
| A2 | Absence de boucle login/dashboard | 🔴 | Aucune boucle | NON TESTÉ | |
| A3 | Déconnexion | 🟠 | Retour login | NON TESTÉ | |
| A4 | Reconnexion + rechargement | 🔴 | Session conservée | NON TESTÉ | |
| A5 | Aucune erreur Auth (console/réseau) | 🔴 | Aucun 401/403 inattendu | NON TESTÉ | |
| A6 | Isolation inter-organisations | 🔴 | Aucun accès aux données d'une autre org | NON TESTÉ | |

## B. Dashboard (Phase 4)
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| B1 | Salutation + KPI + planning + à traiter + équipes + messages + photos | 🔴 | Tout s'affiche | NON TESTÉ | |
| B2 | Ouvrir une tâche → TaskSidePanel (sans quitter le dashboard) | 🔴 | Panneau local | NON TESTÉ | |
| B3 | Fermer / réouvrir la tâche | 🟠 | OK | NON TESTÉ | |
| B4 | Modifier une tâche `[QA]` + enregistrer | 🔴 | Sauvegarde OK | NON TESTÉ | |
| B5 | Rechargement → persistance | 🔴 | Modif persistée | NON TESTÉ | |
| B6 | Ouvrir la fiche chantier (volontaire) | 🟠 | Navigation OK | NON TESTÉ | |
| B7 | Nav Chantiers / Planning / Rapports | 🟠 | OK | NON TESTÉ | |
| B8 | Visite guidée | 🟡 | Se lance | NON TESTÉ | |

## C. Chantiers (Phase 5)
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| C1 | Liste + KPI + « À surveiller » | 🔴 | Chargent | NON TESTÉ | |
| C2 | Filtres Tous / En cours / À risque / Terminés / Avec réserves | 🟠 | Filtrage + compteurs | NON TESTÉ | |
| C3 | Recherche avec / sans résultat + réinitialisation | 🟠 | OK + EmptyState | NON TESTÉ | |
| C4 | Chantier sans photo / à risque / en pause / titre long | 🟡 | Rendus cohérents | NON TESTÉ | |
| C5 | Navigation vers une fiche | 🟠 | OK | NON TESTÉ | |
| C6 | Création chantier `[QA]` (org de test) | 🟠 | Création OK | NON TESTÉ | |

## D. Fiche chantier (Phase 6) — sur chantier `[QA]`
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| D1 | En-tête / statut / adresse / progression / dates / KPI | 🟠 | Lisibles | NON TESTÉ | |
| D2 | Navigation entre les 6 onglets | 🟠 | OK, scroll mobile propre | NON TESTÉ | |
| D3 | Créer tâche `[QA]` avec dates | 🔴 | OK | NON TESTÉ | |
| D4 | Créer tâche `[QA]` sans date | 🔴 | Persistée (pas de perte) | NON TESTÉ | |
| D5 | Durée en jours | 🟠 | OK | NON TESTÉ | |
| D6 | Durée en semaines (1 sem = 5 j ouvrés) | 🟠 | end_date cohérente | NON TESTÉ | |
| D7 | Affectation artisan | 🔴 | Persistée | NON TESTÉ | |
| D8 | Affectation équipe | 🔴 | Persistée | NON TESTÉ | |
| D9 | Modif via TaskSidePanel (chemin unique) | 🔴 | 1 seul chemin | NON TESTÉ | |
| D10 | Rechargement → persistance | 🔴 | OK | NON TESTÉ | |
| D11 | Créer réserve `[QA]` + affichage + ouverture | 🟠 | OK | NON TESTÉ | |
| D12 | Activité récente / états vides | 🟡 | OK | NON TESTÉ | |

## E. Planning / Gantt (Phase 7) — non-régression, tâches `[QA]`
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| E1 | Vues Jour / Semaine / Mois | 🟠 | Changent d'échelle | NON TESTÉ | |
| E2 | Vue tâches / Vue ressources | 🟠 | OK | NON TESTÉ | |
| E3 | Filtres stricts | 🟠 | OK | NON TESTÉ | |
| E4 | Groupes repliables + mode focus | 🟠 | OK | NON TESTÉ | |
| E5 | Navigation temporelle G/D + Aujourd'hui | 🟠 | Défilement visible | NON TESTÉ | |
| E6 | Badge Aujourd'hui sous colonnes sticky | 🟡 | Masquage naturel | NON TESTÉ | |
| E7 | Popover alertes → « Voir la tâche » → TaskSidePanel | 🟠 | OK | NON TESTÉ | |
| E8 | Drag & drop tâche `[QA]` + rechargement | 🔴 | Persisté | NON TESTÉ | |
| E9 | Resize tâche `[QA]` + rechargement | 🔴 | Durée persistée | NON TESTÉ | |
| E10 | Dépendances / tâches sans date / surcharge / double affectation / occupation | 🟠 | Cohérents | NON TESTÉ | |

## F. Storage (Phase 8) — chantier `[QA]`
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| F1 | Upload photo `[QA]` + affichage + rechargement | 🔴 | Persistée (signed URL) | NON TESTÉ | |
| F2 | Validation photo (si dispo) | 🟠 | OK | NON TESTÉ | |
| F3 | Upload document `[QA]` + ouverture + rechargement | 🟠 | OK | NON TESTÉ | |
| F4 | Aucun 401/403/500 sur les signed URLs | 🔴 | Aucun | NON TESTÉ | |

## G. Messagerie (Phase 9) — chantier `[QA]`
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| G1 | Envoi message `[QA]` + affichage immédiat | 🟠 | OK | NON TESTÉ | |
| G2 | Rechargement → persistance | 🟠 | OK | NON TESTÉ | |
| G3 | Compteur non lu (si présent) + rendu mobile | 🟡 | OK | NON TESTÉ | |

## H. Responsive / Dark mode (Phase 10)
| ID | Scénario | Crit. | Attendu | Statut | Comm. |
|---|---|---|---|---|---|
| H1 | 1920 / 1440 / 1366 @100 % | 🟠 | Colonnes cohérentes, pas de scroll horizontal | NON TESTÉ | |
| H2 | Zoom 125 % / 150 % | 🟠 | Colonnes réduites, rien de coupé/masqué | NON TESTÉ | |
| H3 | Tablette / mobile (onglets, KPI, TaskSidePanel, modales) | 🟠 | Utilisables | NON TESTÉ | |
| H4 | Light / Dark (8 pages) | 🟠 | Aucune régression | NON TESTÉ | |
| H5 | Aucun texte métier microscopique (<12px) | 🟡 | Conforme | NON TESTÉ | |

## Erreurs console / réseau (Phase 11)
| Heure | Page | Type (Next/React/Supabase/Auth/RLS/Storage/4xx/5xx/hydratation) | Détail | Repro ? |
|---|---|---|---|---|
| | | | | |

## Données `[QA]` créées (à nettoyer)
| Type | Nom / ID | Créé le | Nettoyé ? |
|---|---|---|---|
| chantier | | | ☐ |
| tâche(s) | | | ☐ |
| réserve | | | ☐ |
| photo | | | ☐ |
| document | | | ☐ |
| message | | | ☐ |

## Bilan
- PASS : ____ · FAIL : ____ · BLOQUÉ : ____ · NON TESTÉ : ____
- FAIL bloquants ouverts (A1–A6, B2/B4/B5, D3/D4/D7/D8/D9/D10, E8/E9, F1/F4) : ____
- **Verdict recette** : ☐ GO · ☐ NO-GO — commentaire : ______________________
