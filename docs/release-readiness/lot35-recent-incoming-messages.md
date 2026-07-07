# LOT 35 — Messages « reçus récemment » (badge + contextualisation)

## Cause du faux compteur
`getAlertsSummary(supabase, orgId)` ne recevait **pas** l'utilisateur courant et la
requête messages ne filtrait pas l'expéditeur → `messagesRecent` comptait **tous**
les messages des 48 h, **y compris ceux envoyés par l'utilisateur**. D'où un badge
« 2 » alimenté par les 2 messages d'Eric.

## Règle finale (source de vérité unique — `lib/messages-activity.ts`)
Un message est **entrant récent** si :
- `created_at` dans **RECENT_WINDOW_MS = 48 h** ;
- **non émis par l'utilisateur courant** (`sender_id !== currentUserId`).

**`sender_id` NULL** (message système) → considéré **entrant** (non émis par
l'utilisateur) → compté. Documenté explicitement.

Filtrage organisation : messages restreints aux projets de l'org (`projectIds`) +
RLS. Aucun message d'une autre organisation ne peut être compté ou affiché.

## Fenêtre temporelle
**48 heures** (constante unique `RECENT_WINDOW_MS`). Toute autre surface la réutilise
(pas de valeur `48*3600*1000` dupliquée ailleurs).

## Source de vérité partagée
`lib/messages-activity.ts` (fonctions pures) :
- `isRecentIncoming(m, currentUserId, now)` ;
- `countRecentIncoming`, `recentIncomingByProject`, `latestIncomingByProject`.
Alimente : badge Sidebar (via `lib/alerts.ts`, serveur : `.or('sender_id.is.null,sender_id.neq.<uid>')` + fenêtre 48 h), `MessagesSideWindow` (client) et `MessagesView` (client).

## Compteur global
`messagesRecent` = **count exact** (PostgREST `count:'exact'`) des messages entrants
récents des projets de l'org, expéditeur ≠ utilisateur. Libellé honnête partout :
« N messages reçus récemment » (tooltip + aria-label du badge). **Jamais « non lu ».**

## Indicateurs par chantier (MessagesSideWindow)
Pour chaque conversation ayant des entrants récents : point orange sur l'avatar +
pastille « N récent(s) » + sous-texte « {auteur} : {extrait} · il y a … ». Les
conversations ne contenant que mes propres messages **n'ont pas** d'indicateur.

## Ordre de tri
1. conversations avec **entrant récent** (par date du dernier entrant, desc) ;
2. autres conversations avec activité (dernier message desc) ;
3. chantiers sans message ;
4. alphabétique.
→ À l'ouverture (sans sélection explicite ni deep-link), la conversation par défaut
est donc le chantier du **message entrant le plus récent**. Sélection par `projectId`,
jamais par `thread.id`.

## Alertes (lib/alerts.ts)
- Une alerte **par chantier** (dernier message entrant ; dédup par `project_id`) pour
  éviter l'avalanche.
- Titre : « Nouveau message reçu — {chantier} » (ou « — Général » si sans project_id).
- Corps : « {auteur} : {extrait} ».
- Lien : `/messages?project=<id>` (ou `/messages` pour Général).
- Aucune alerte pour un message envoyé par l'utilisateur.

## Cas de test — fonctions pures (sans dépendance)
| Scénario | Attendu |
|---|---|
| Eric envoie 2 messages | `countRecentIncoming(currentUser=Eric)` = **0** |
| Marie envoie 1 message (<48 h) | = **1** |
| Eric répond | reste **1** |
| Marie envoie dans un 2ᵉ chantier | = **2** ; `recentIncomingByProject` = 2 clés |
| message > 48 h | non compté |
| `sender_id` NULL (système) | compté (entrant) |
| autre organisation | jamais présent (filtré en amont) |
| `project.id` ≠ `thread.id` | regroupement par `project_id` uniquement |

## Message entrant de test [QA] — NON créé (procédure pour Eric)
L'organisation d'Eric ne compte **qu'un seul membre** (« Eric Leduc », owner).
Aucun 2ᵉ compte n'existe → **aucun message QA n'a été inséré** (interdit d'usurper
un expéditeur / d'imiter un sender via service_role). Pour valider le comportement
entrant, Eric doit disposer d'un 2ᵉ compte dans **sa** organisation :

1. **Inviter** un 2ᵉ compte dans son org (Équipes → inviter un artisan, avec une
   2ᵉ adresse email qu'il contrôle) et accepter l'invitation depuis ce compte.
2. **Se connecter** avec ce 2ᵉ compte, ouvrir un chantier (ex. un chantier `[QA]`)
   et envoyer : `[QA] Message entrant de validation LOT 35 — <date/heure>`.
3. **Revenir** sur le compte Eric et recharger : le badge « reçus récemment »
   augmente de 1, le chantier remonte en tête avec l'indicateur + auteur + extrait ;
   la réponse d'Eric **n'incrémente pas** le badge.

> Un simple 2ᵉ signup créerait sa PROPRE organisation (RLS) et ne verrait pas les
> chantiers d'Eric → il faut passer par l'**invitation** dans l'org d'Eric.
