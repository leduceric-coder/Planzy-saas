# LOT 30 — Checklist de recette dynamique (manuelle, 20–30 min)

> À exécuter sur la **Preview** :
> `https://kanvix-saas-git-claude-kanvix-lo-76d15a-erics-projects-8e37d8e4.vercel.app`
> Navigateur à **zoom 100 %** (puis 125 % / 150 % pour les lignes concernées).
>
> ⚠️ **Base probablement partagée avec la production** (cf. `production-cutover.md`,
> GO n°2). → **Créer/utiliser une organisation de TEST dédiée**. Ne PAS modifier ni
> supprimer les données réelles (17 projets / 102 tâches existants). Privilégier
> lecture + créations dans l'org de test.

Recommandation méthode : **Option 2 (recette manuelle guidée)** ici et maintenant.
Playwright (Option 1) seulement si une **base de staging isolée** est créée
(sinon risque d'écritures en prod) — et **ne pas installer Playwright ni de package
sans GO** (Chromium est déjà présent dans l'environnement, mais l'app est protégée
par Vercel SSO → l'automatisation nécessiterait un contournement d'auth + un compte
de test dédié).

Légende criticité : 🔴 bloquant · 🟠 majeur · 🟡 mineur.

## A. Authentification
| # | Action | Résultat attendu | Crit. | OK/KO | Commentaire |
|---|---|---|---|---|---|
| A1 | Accès non connecté à `/` | Redirection `/login` | 🔴 | ☐ | |
| A2 | Connexion | Redirection dashboard, pas de boucle | 🔴 | ☐ | |
| A3 | Déconnexion | Retour login | 🟠 | ☐ | |
| A4 | Récup. mot de passe (`/reset-password`) | Email envoyé / message clair | 🟡 | ☐ | |
| A5 | Accès à une org tierce | Refusé (RLS) | 🔴 | ☐ | |

## B. Dashboard
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| B1 | Chargement | KPI + planning + à traiter + équipes + photos | 🔴 | ☐ | |
| B2 | Ouvrir une tâche | TaskSidePanel local (sans quitter le dashboard) | 🔴 | ☐ | |
| B3 | Modifier une tâche (org test) | Sauvegarde OK | 🔴 | ☐ | |
| B4 | Rechargement après B3 | Modification persistée | 🔴 | ☐ | |
| B5 | Fermer TaskSidePanel | Ferme proprement | 🟠 | ☐ | |
| B6 | Lien vers une fiche chantier | Navigation OK | 🟠 | ☐ | |
| B7 | Liens Planning / Chantiers / Rapports | Naviguent | 🟠 | ☐ | |
| B8 | Largeur écran large (1920) | Contenu centré (max‑w 1440), pas étiré | 🟡 | ☐ | |

## C. Chantiers
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| C1 | Liste + KPI | Chargent | 🔴 | ☐ | |
| C2 | Filtres Tous/En cours/À risque/Terminés/Avec réserves | Filtrage correct + compteurs | 🟠 | ☐ | |
| C3 | Recherche | Filtre par nom/adresse | 🟠 | ☐ | |
| C4 | Aucun résultat | EmptyState + « Réinitialiser » | 🟡 | ☐ | |
| C5 | « Chantiers à surveiller » (max 3) + « Voir tous » | OK | 🟠 | ☐ | |
| C6 | Carte sans photo / terminé / à risque / en pause | Rendus cohérents | 🟡 | ☐ | |
| C7 | Nouveau chantier (org test) | Création OK | 🟠 | ☐ | |

## D. Fiche chantier
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| D1 | En-tête (statut, dates, progression, actions) | Lisible, compact | 🟠 | ☐ | |
| D2 | Onglets (Vue/Planning/Équipes/Photos/Messagerie/Réserves) | Naviguent, scroll mobile OK | 🟠 | ☐ | |
| D3 | Création de tâche (org test) | OK | 🔴 | ☐ | |
| D4 | Édition tâche = **TaskSidePanel uniquement** | Un seul chemin d'édition | 🔴 | ☐ | |
| D5 | Tâche sans date / durée jours / semaines | Gérées | 🟠 | ☐ | |
| D6 | Affectation artisan / équipe | OK | 🟠 | ☐ | |
| D7 | Création de réserve | OK | 🟠 | ☐ | |
| D8 | États vides (photos/docs/messages/réserves) | EmptyState clairs | 🟡 | ☐ | |

## E. Planning / Gantt (non-régression uniquement — ne pas refondre)
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| E1 | Jour / Semaine / Mois | Changent d'échelle | 🟠 | ☐ | |
| E2 | Flèches période + Aujourd'hui | Défilement visible (LOT 27M) | 🟠 | ☐ | |
| E3 | Groupes chantier repliables + focus | OK | 🟠 | ☐ | |
| E4 | Popover alertes + « Voir la tâche » | Ouvre TaskSidePanel | 🟠 | ☐ | |
| E5 | Drag & drop / resize | Persistés en base | 🔴 | ☐ | |
| E6 | Dépendances (flèches) | Cohérentes après déplacement | 🟠 | ☐ | |
| E7 | Vue ressources / occupation / double affectation | OK | 🟠 | ☐ | |
| E8 | « Codes du planning » (légende) | Popover OK | 🟡 | ☐ | |

## F. Rapports
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| F1 | KPI + « À traiter en priorité » (3) | Lisibles (densité comfortable) | 🟠 | ☐ | |
| F2 | Filtres + recherche alertes | OK | 🟠 | ☐ | |
| F3 | Clic alerte → chantier/tâche | Navigation | 🟠 | ☐ | |
| F4 | Rapport global / génération chantier | OK | 🟠 | ☐ | |
| F5 | Historique | Lignes lisibles | 🟡 | ☐ | |

## G. Équipes / Photos / Documents / Messagerie
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| G1 | Liste artisans / équipes | OK | 🟠 | ☐ | |
| G2 | Upload + affichage photo (signed URL) | OK | 🟠 | ☐ | |
| G3 | Validation photo | OK | 🟠 | ☐ | |
| G4 | Upload / ouverture document | OK | 🟡 | ☐ | |
| G5 | Envoi message + affichage conversation | OK | 🟠 | ☐ | |

## H. Responsive / Thèmes / A11y
| # | Action | Attendu | Crit. | OK/KO | Comm. |
|---|---|---|---|---|---|
| H1 | 1920 / 1440 / 1366 @100 % | Colonnes cohérentes, pas de scroll horizontal | 🟠 | ☐ | |
| H2 | Zoom 125 % / 150 % | Colonnes se réduisent, rien de coupé | 🟠 | ☐ | |
| H3 | Tablette / mobile | Onglets scrollables, KPI 2 col | 🟠 | ☐ | |
| H4 | Light / Dark | Contrastes OK | 🟠 | ☐ | |
| H5 | Navigation clavier + focus-visible + fermeture modale (Échap) | OK | 🟡 | ☐ | |
| H6 | Visite guidée | Se lance, cibles présentes | 🟡 | ☐ | |

**Bilan** : ____ 🔴 KO · ____ 🟠 KO · ____ 🟡 KO → GO/NO-GO recette : ______
