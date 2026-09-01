# Recette Accueil Kanvix V2.4.5 — Stabilisation finale

## Verdict

**ACCUEIL KANVIX = VALIDÉ ET GELÉ**

Toutes les conditions du critère de gel sont réunies : 0 blocker, 0 major, 0 erreur console applicative, alignements toujours parfaits, F01 à F06 résolus, aucune régression détectée sur l'ensemble de la suite historique (V2.4/V2.4.1/V2.4.2/V2.4.3/V2.4.4/V2.4.4.1).

## Chiffres clés

- **149 vérifications automatisées** dans `recette-accueil-v2.4.5.mjs` : **149 PASS / 0 FAIL**.
- **30/30 cycles** `resetApp()`+`setDepth('pilot')`+`go('today')` affichent la météo dans les 4 lignes "Chantiers actifs" (F01), plus 10/10 navigations Accueil↔Chantiers et une salve de rendus rapides — tous PASS.
- **0 erreur console d'origine applicative.** Les 2 lignes "Failed to load resource" observées proviennent uniquement (a) d'une section de test qui n'a pas besoin de mocker la météo et (b) de la sandbox de test bloquant un accès réseau réel non simulé — comportement identique à celui déjà documenté dans les recettes précédentes, sans lien avec le code Kanvix.
- **Suite de non-régression historique** (26 scripts issus des versions V2.4 → V2.4.4.1) rejouée à l'identique sur V2.4.5 : mêmes résultats exacts qu'auparavant, aucune nouvelle régression. Les quelques échecs préexistants restent les exceptions déjà documentées (redesigns intentionnels antérieurs : cockpit V2.4.3, sous-vue Planning du Mode Chantier V2.4.2, renommage "Cette semaine").

## Corrections apportées

| Finding | Corrigé | Détail |
|---|---|---|
| **F01** — Météo "Chantiers actifs" intermittente | **OUI** | `ensureProjectWeather()` ne fait plus que l'orchestration réseau (dédoublonnée par `projectWeatherInFlight`) ; `activeProjectsPanel()`/`fieldProjectView()` réappliquent désormais directement l'état déjà connu (`projectWeatherHTML()`) à **chaque rendu**, sans attendre le `.then()` du premier appel — même principe que la météo conducteur, qui n'a jamais eu ce problème. |
| **F02** — Débordement texte long "Chantiers actifs" | **OUI** | `min-width: 0` ajouté à `.acp-row` (élément de grille) ; `.acp-body b` tronqué avec ellipsis. Testé avec nom + localisation >100 caractères chacun : 0 débordement, hauteur inchangée. |
| **F03** — Hauteur de ligne "Aujourd'hui" avec nom de tâche long | **OUI** | Nom de tâche tronqué sur une seule ligne (`white-space:nowrap; text-overflow:ellipsis; min-width:0`), nom complet via `title`. **Complément appliqué au-delà de la demande initiale** : le même correctif a été étendu au nom de chantier (`.tp-body small`) sur cette même ligne, qui présentait exactement le même risque de débordement de hauteur — repéré lors de la vérification visuelle, corrigé pour une cohérence complète. Testé à 150 caractères : ±0px d'écart. |
| **F04** — Accessibilité clavier "Aujourd'hui" | **OUI** | `.tp-row` reste un `<article>` (design conservé) mais gagne `role="button"`, `tabindex="0"`, un `aria-label` explicite ("Tâche X — Chantier — Statut") et une gestion clavier dédiée (`taskRowKeydown`) : Entrée et Espace ouvrent la tâche, sans double déclenchement (vérifié par compteur d'appels). |
| **F05** — Sémantique des popups | **OUI** | `#modal` porte désormais `role="dialog"`, `aria-modal="true"` et `aria-labelledby="modalTitle"` ; les popups Accueil ("À décider", "À surveiller", jour de la semaine) donnent cet id à leur titre. Échap continue de fermer normalement. |
| **F06** — Bouton flottant "+" en Mobile Bureau | **OUI** | Masqué uniquement sur l'Accueil (`body.page-today .add { display:none }`), via une classe posée dans `renderPage()`. Toujours visible et fonctionnel sur les autres pages (Chantiers, Planning…). |
| **Friction UX — triple répétition** | **OUI** | `todayInsight()` ne répète plus le nombre de décisions (déjà visible 2 fois) ni "Tout est sous contrôle" (déjà dit par les cartes calmes) ; seule reste la confirmation terrain, seule information réellement transverse et nouvelle. Sans elle, le bandeau "À savoir" ne s'affiche simplement pas — comportement voulu et testé (cas normal, cas calme, cas terrain). |

## Non-régression

- Hero, cartes attention, `.attention-grid`/`.today-main-grid` (alignement, breakpoint 1080px), "Cette semaine" (une carte, 5 cellules) : **strictement inchangés**, aucune ligne CSS de ces blocs touchée.
- Densité (calme/normal/chargé) : hauteur de l'Accueil toujours parfaitement stable.
- Popups, clics tâches (tous statuts), clic jour semaine, thème sombre, responsive (1920→390px), données vides : tous PASS, identiques à V2.4.4.1.
- Temps réel (artisan "Je commence"/"J'ai terminé", drag Kanban) : Accueil actualisé sans F5, aucune fausse confirmation terrain — inchangé.
- Suite historique complète (V2.4 → V2.4.4.1, 26 scripts) : rejouée, aucun écart avec les résultats déjà documentés.

## Erreurs console

**0 erreur JavaScript applicative.** Les deux lignes réseau observées (`ERR_TUNNEL_CONNECTION_FAILED`, `ERR_FAILED`) sont exclusivement liées à l'environnement de test (sandbox bloquant un accès réseau réel non simulé dans une section de test multi-onglets, et une panne réseau volontairement simulée ailleurs) — comportement géré (`console.warn`), jamais une exception non gérée.

## Limites

- Le mécanisme exact qui causait l'intermittence de F01 n'avait pas été isolé avec certitude lors de la recette précédente ; la correction (découplage donnée/DOM + dédoublonnage des requêtes en vol) traite directement le symptôme documenté et est validée par 30 cycles + 10 navigations + rendus rapides, tous à 100 %.
- L'accessibilité reste un contrôle ciblé (clavier, rôles ARIA de base), pas un audit WCAG exhaustif.

## Livrables

1. `kanvix-next-gen-v2.4.5.html` — fichier complet.
2. `recette-accueil-v2.4.5.mjs` — suite de tests Playwright (149 vérifications).
3. `rapport-recette-accueil-v2.4.5.md` — ce rapport.
4. Captures de confirmation dans `recette-accueil/` (`v245-F01-fixed-*`, `v245-F02-fixed-*`, `v245-F03-fixed-*`, `v245-F04-fixed-*`, `v245-F06-fixed-*`, `v245-a-savoir-cas-terrain.png`).
