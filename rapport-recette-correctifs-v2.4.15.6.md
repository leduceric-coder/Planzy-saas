# Kanvix V2.4.15.6 — Vue Jour hors horaires, retour arrière, menu au-dessus, colonnes Année

Source de vérité : `kanvix-next-gen-v2.4.15.5.html`
Version livrée : `kanvix-next-gen-v2.4.15.6.html`

Retour utilisateur :
1. Le **planning à la journée ne démarre pas à l'heure en cours**.
2. La **flèche de retour `←`** doit permettre de voir les tâches passées (à vérifier).
3. La **fenêtre paramètres passe sous le planning** — elle doit toujours passer au-dessus.
4. En **vue Année**, élargir au besoin la largeur des colonnes pour afficher le nom des tâches.

---

## 1. Vue Jour — démarrer à l'heure en cours, même hors 08h–18h

**Cause réelle** : en V2.4.15.5, les créneaux de la vue Jour étaient comptés **depuis 08h**, et la fenêtre retombait sur la journée entière dès que l'heure courante sortait de la plage 08h–18h. En consultant le planning **le soir** (cas de la capture), on repartait donc de 08h — tout le passé réaffiché, et aucun repère AUJOURD'HUI.

**Correctif** : les créneaux d'½ heure sont désormais comptés **depuis minuit** (0…47). La fenêtre démarre à l'heure pleine en cours quelle que soit l'heure, et s'étend au moins jusqu'à 18h (au-delà, à partir de l'heure courante, bornée à minuit) :

| Heure réelle | Avant (V2.4.15.5) | Après (V2.4.15.6) |
|---|---|---|
| 10h15 | 10h → 18h ✔ | 10h → 18h ✔ |
| 14h45 | 14h → 18h ✔ | 14h → 18h ✔ |
| **19h30** | **08h → 18h ✘ (tout le passé)** | **19h → 22h ✔** |
| **23h20** | **08h → 18h ✘** | **23h → minuit ✔** |
| 06h10 | 08h → 18h ✔ | 08h → 18h ✔ (journée de travail complète) |

## 2. Flèche `←` — accès aux tâches passées (vérifié)

**Vérification** : `←` recule bien la fenêtre en **Semaine**, **Mois** et **Année** (périodes passées consultables) — testé et confirmé.

**Lacune corrigée** : en vue Jour, comme la fenêtre démarre « à partir de maintenant », les heures **déjà écoulées de la journée en cours** n'étaient atteignables par aucun geste (`←` sautait directement à la veille). Désormais, en vue Jour :
- un **1ᵉʳ `←`** rouvre le **début de la journée en cours** (08h → 18h) — les tâches déjà passées aujourd'hui réapparaissent (mesuré : 2 → 6 lignes) ;
- un **2ᵉ `←`** passe à la veille ;
- **« Aujourd'hui »** revient à la vue « à partir de maintenant ».

L'état est mémorisé **par date** (`app.ui.planningDayFull`), donc il s'annule de lui-même dès qu'on change de jour — aucun résidu.

## 3. Menu paramètres — toujours au-dessus du planning

**Cause réelle** : `.sidebar` est en `position: sticky`, ce qui crée **toujours un contexte d'empilement**. Sans `z-index`, la barre latérale restait au niveau 0, tandis que les en-têtes collants du Gantt (`z-index: 6/7`) et le bandeau chantier (`5`) se peignaient au-dessus d'elle. Le `z-index: 80` du menu profil, **enfermé dans ce contexte**, ne pouvait donc jamais passer devant le planning — d'où le menu « sous » le tableau.

**Correctif** : `.sidebar { z-index: 20 }` — au-dessus du contenu (Gantt ≤ 9), mais **sous** les surcouches : modale (30), tiroir (30), toast (60), palette ⌘K (70), panneau IA (90). Vérifié par `elementFromPoint` sur 3 points du menu surplombant le planning : c'est bien le menu qui reçoit le clic, et la hiérarchie modale/tiroir/toast reste respectée.

## 4. Vue Année — colonnes élargies pour les noms de tâches

**Cause réelle** : en vue Année une tâche d'un mois tient dans **une seule colonne de 94px**, trop étroite pour son libellé (« Doublage mu… »).

**Correctif** : la largeur mini de colonne devient une variable (`--col-min`, 94px par défaut). En vue Année seulement, `gantt()` calcule la largeur **juste nécessaire** : largeur estimée du libellé (≈6,3px/caractère à 11px/600 + marges) **divisée par le nombre de colonnes couvertes** par la tâche — une tâche longue étalée sur plusieurs mois n'élargit donc rien — puis bornée à 190px pour que le tableau reste navigable.

**Mesuré** : `--col-min` = 182px, **0 nom tronqué** sur les 11 barres (« Doublage murs extérieurs » compris). Jour / Semaine / Mois conservent 94px — l'élargissement est strictement contextuel.

## 5. Tests

Nouvelle suite `recette-correctifs-v2.4.15.6.mjs` : **28/28**. Byte-identité de 40 moteurs / rendus non concernés (dont `pos`, `dropTask`, `kanbanBoard`, `planningTasks`, `renderPlanning`, `setPeriod`, `renderUserMenu`) ; seuls `scale`, `shiftPlanning`, `planningToday` et `gantt` changent. Acquis V2.4.15.5 revérifiés (Semaine sur le jour courant, Mois en n° ISO, nom de chantier épinglé et agrandi).

Rejeu complet des suites historiques : _(complété après le sweep)_.

## 6. Console

0 erreur JavaScript applicative.

## 7. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"`, `SCHEMA_VERSION = 8` — inchangés.
