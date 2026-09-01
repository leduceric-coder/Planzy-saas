# Recette Accueil Kanvix V2.4.4.1

Audit en lecture seule. Aucune ligne de `kanvix-next-gen-v2.4.4.1.html` n'a été modifiée pendant cette recette.

## Verdict global

**PASS AVEC RÉSERVES**

L'organisation générale validée (Attention → Aujourd'hui + Chantiers actifs → Cette semaine → À savoir) est intacte et n'a pas été touchée. L'alignement des colonnes (objet de la V2.4.4.1) est désormais **parfait** sur les six tailles desktop testées. La hiérarchie visuelle, la densité maîtrisée et la gestion réseau/météo sont solides. Aucune information métier fausse n'a été observée, aucun blocage de pilotage, 0 erreur console d'origine applicative.

Les réserves : un bug intermittent (F01) sur la mise à jour de la météo des chantiers, deux défauts de robustesse texte-long (F02, F03) et un manque d'accessibilité clavier localisé (F04) — aucun ne bloque le pilotage, aucun n'affiche d'information erronée, mais ils méritent correction avant une diffusion large.

## Résultats par thème

| Thème | Résultat |
|---|---|
| Desktop (1920→1081 px) | PASS — alignement pixel-parfait, hauteurs cohérentes ±1-2 px partout |
| Breakpoint 1080/1081/1079 px | PASS — bascule 2→1 colonne unifiée, aucun effet brutal observé |
| Tablette (900/768 px) | PASS — ordre vertical conforme, pas de scroll horizontal |
| Mobile Bureau (430/390 px) | PASS avec réserve cosmétique (F06 — bouton flottant "+") |
| Thème sombre | PASS — contrastes corrects, aucun texte invisible |
| Météo conducteur | PASS — non bloquante, dégradation gracieuse (refus/panne réseau) |
| Météo par chantier | **RÉSERVE (F01)** — mise à jour intermittente, parfois vide durablement |
| Interactions (popups, clics, navigation) | PASS |
| Temps réel (terrain + Kanban, 2 onglets) | PASS — aucun F5 nécessaire, aucune fausse confirmation |
| États extrêmes (vide / calme / chargé) | PASS — hauteur de page strictement stable (ratio mesuré 1.00) |
| Textes longs | **RÉSERVE (F02, F03)** — débordement/hauteur possibles en cas extrême |
| Accessibilité minimale | **RÉSERVE (F04, F05)** |
| Console | PASS — 0 erreur JS applicative |

## Findings

### F01 — [MAJOR] Météo "Chantiers actifs" : mise à jour intermittente, parfois durablement vide

**Contexte** : panneau "Chantiers actifs" de l'Accueil, badge météo `.acp-weather` ajouté à côté de la phase/localisation de chaque chantier.

**Étapes de reproduction** :
1. Ouvrir l'Accueil (`resetApp(); setDepth('pilot'); go('today');`), API météo/géocodage simulées avec succès (Open-Meteo + Géoplateforme).
2. Attendre 1 à 1,5 s.
3. Observer les 4 lignes "Chantiers actifs".

**Résultat observé** : dans une fraction significative des essais (répétés plusieurs dizaines de fois lors du diagnostic), les badges météo restent **vides indéfiniment** — alors que le réseau simulé répond correctement (confirmé : le géocodage et l'appel Open-Meteo aboutissent, et `weatherService.getWeatherForLocation()` appelé directement retourne toujours la bonne donnée). Le problème se situe uniquement dans le pont entre la résolution de la promesse et la mise à jour du DOM (`ensureProjectWeather` → `updateProjectWeatherBadge`), pas dans la couche météo elle-même. Fait notable : le widget météo du **conducteur** (`#userWeatherWidget`, en haut à droite du Hero) est nettement plus fiable dans les mêmes conditions — seule la voie "météo par chantier" est concernée.

**Résultat attendu** : chaque ligne "Chantiers actifs" affiche sa météo dès que la donnée est disponible, de façon fiable à 100 %.

**Hypothèse de mécanisme** (non confirmée avec certitude, audit en lecture seule) : `resetApp()` + `setDepth()` + `go('today')` déclenchent plusieurs rendus synchrones de l'Accueil avant qu'aucune requête réseau n'ait eu le temps d'aboutir. Chaque rendu régénère des `<span class="acp-weather">` neufs et vides, et appelle `ensureProjectWeather` pour chaque chantier — mais l'anti-rappel de 60 s (`projectWeatherLastAttempt`) ne laisse que le **tout premier** appel s'enregistrer sur un `.then()`. Rien ne réapplique un `projectWeatherState[pid]` déjà connu aux nouveaux nœuds DOM produits par les rendus suivants ; si le timing fait que la mise à jour arrive avant le dernier rendu, elle est écrasée, sinon elle s'applique correctement — d'où l'intermittence.

**Important** : reproduit uniquement via Playwright/CDP (tests automatisés). Une fenêtre de navigateur réelle ne redimensionne jamais via l'équivalent CDP de `setViewportSize` — il n'a pas été possible, dans le cadre de cet audit en lecture seule, de confirmer si un utilisateur réel (sans aucun outil d'automatisation) peut également déclencher ce comportement. **Une vérification manuelle dans un vrai navigateur est recommandée avant priorisation.**

**Capture** : `recette-accueil/A-desktop-1600x900-clair.png` (badge absent) vs `recette-accueil/C-desktop-1600x900-sombre.png` (badge présent) — même scénario, deux résultats différents, illustrant l'intermittence.

---

### F02 — [MINOR] "Chantiers actifs" : débordement horizontal possible avec un nom/localisation très longs

**Contexte** : ligne `.acp-row` du panneau "Chantiers actifs", élément d'une grille CSS (`.acp-list { display:grid }`).

**Étapes de reproduction** :
1. Renommer un chantier avec un nom très long (ex. "Résidence Les Hauts de Keravel Bâtiment C Tranche 3 Programme Neuf") et une localisation très longue.
2. Ouvrir l'Accueil à 1440 px de large.

**Résultat observé** : la page entière déborde horizontalement de ~19 px ; **toutes** les lignes "Chantiers actifs" (pas seulement celle au nom long) s'élargissent au-delà du viewport, car elles partagent la même colonne de grille.

**Résultat attendu** : le texte est tronqué avec une ellipse (`…`), comme c'est déjà correctement le cas pour les cartes "À décider"/"À surveiller".

**Cause identifiée avec certitude** : `.acp-row` (élément de `display:grid`) n'a pas de `min-width: 0`. Sans cette règle, la piste de grille s'élargit pour accueillir le contenu non contraint au lieu de forcer la troncature — exactement le problème que le code documente et corrige déjà explicitement sur `.attention-card` (commentaire présent dans le CSS à cet effet), mais qui n'a pas été répliqué sur `.acp-row`.

**Capture** : `recette-accueil/long-text.png`

---

### F03 — [MINOR] "Aujourd'hui" : la hauteur de ligne peut varier si le nom de tâche est très long

**Contexte** : ligne `.tp-row` du panneau "Aujourd'hui".

**Étapes de reproduction** :
1. Renommer une tâche avec un nom très long (~130 caractères).
2. Ouvrir l'Accueil.

**Résultat observé** : le nom passe à la ligne (pas de débordement de page, contrairement à F02), mais la ligne concernée passe de 91 px à 111 px, alors que les trois autres lignes restent à 91 px — dépasse la tolérance ±2 px fixée par l'harmonisation V2.4.4.

**Résultat attendu** : soit une troncature à une ligne (comme "Chantiers actifs" le ferait s'il n'avait pas le bug F02), soit une hauteur de ligne assumée comme variable si le retour à la ligne est voulu.

**Capture** : mesures brutes consignées dans `recette-accueil/resultats.json` (section `long-text`).

---

### F04 — [MINOR — Accessibilité] Lignes "Aujourd'hui" non accessibles au clavier

**Contexte** : panneau "Aujourd'hui", lignes cliquables ouvrant le détail d'une tâche.

**Résultat observé** : `.tp-row` est un `<article onclick=...>`, sans `tabindex`, sans `role="button"`, sans gestion clavier (Entrée/Espace). Il est donc **impossible d'atteindre ou d'activer une ligne "Aujourd'hui" au clavier** (touche Tab). C'est une incohérence par rapport aux trois autres familles de cartes cliquables de l'Accueil, qui sont toutes de vrais `<button>` nativement accessibles :
- `.attention-card` (À décider / À surveiller) → `<button>` ✓
- `.acp-row` (Chantiers actifs) → `<button>` ✓
- `.wp-day` (Cette semaine) → `<button>` ✓
- `.tp-row` (Aujourd'hui) → `<article>` ✗

**Résultat attendu** : les quatre familles de cartes cliquables de l'Accueil devraient être accessibles au clavier de façon homogène.

---

### F05 — [COSMETIC — Accessibilité] Popup `#modal` sans rôle sémantique

**Résultat observé** : les popups "À décider"/"À surveiller"/jour de la semaine (`#modal`) n'ont pas d'attribut `role="dialog"` ni `aria-modal="true"`, contrairement à la palette de commandes (`#cmd`) qui les possède déjà dans le même fichier. La fermeture au clavier (Échap) fonctionne correctement malgré cela.

---

### F06 — [COSMETIC] Bouton flottant "+" chevauchant la barre d'onglets en Mobile Bureau

**Contexte** : Accueil, 390 px de large (Mobile Bureau, pas Mode Chantier).

**Résultat observé** : le bouton rond bleu "+" (`.add`, élément persistant du shell applicatif, visible en dessous de 720 px sur toutes les pages) chevauche visuellement à la fois une ligne "Aujourd'hui" et la barre d'onglets basse (Aujourd'hui/Chantiers/Planning/Équipe/Messagerie). Il n'a pas d'action définie propre à l'Accueil (contexte de lecture, pas de création).

**Remarque** : cet élément est un composant transverse du shell (présent sur `sites`, `planning`, etc. bien avant la V2.4.4), pas quelque chose d'introduit par V2.4.4 ou V2.4.4.1. Signalé car directement visible dans le périmètre audité.

**Capture** : `recette-accueil/E-mobile-390px.png`

---

## Frictions UX (distinctes des bugs)

1. **Triple répétition du même chiffre.** Dans le scénario testé (3 décisions), le nombre "3" apparaît successivement : dans le résumé du Hero (`⚠ 3 décisions`), dans le gros compteur de la carte "À décider", et dans le bandeau "À savoir" ("3 décisions en attente peuvent encore impacter le planning"). Trois zones distinctes de l'écran répètent la même information sans angle différent — cela va à l'encontre du principe produit énoncé ("Kanvix ne doit pas montrer tout ce qu'il sait, doit montrer ce qui mérite l'attention"), qui est par ailleurs bien respecté partout ailleurs sur l'écran.
2. **"À savoir" a un contenu à variabilité limitée.** Sur les trois scénarios testés (calme / normal / chargé), le texte de la bannière recoupe toujours une information déjà visible : soit le nombre de décisions (déjà sur la carte "À décider"), soit "Tout est sous contrôle" (déjà sur les deux cartes en état calme). Sa valeur ajoutée réelle, telle qu'implémentée actuellement (`todayInsight()`), est donc limitée à un troisième cas ("confirmations terrain aujourd'hui") qui n'a pas pu être déclenché facilement en test.
3. **Le bouton flottant "+"** (F06) n'a pas de rôle clair sur un écran de consultation comme l'Accueil — voir aussi F06.

## Points forts

- **Alignement pixel-parfait** entre les cartes "À décider"/"À surveiller" et les panneaux "Aujourd'hui"/"Chantiers actifs" sur les six résolutions desktop testées (1920 → 1081 px) — l'objectif de la V2.4.4.1 est pleinement atteint, sans aucune tolérance nécessaire (écart mesuré : 0 px).
- **Densité maîtrisée de façon vérifiable** : la hauteur totale de l'Accueil est restée **strictement identique** (ratio mesuré 1,00) entre un jour calme (0 décision), normal (3/6/3) et très chargé (10 décisions/12 actions/8 surveillances/8 chantiers) — la promesse "la structure ne doit jamais exploser" est confirmée par la mesure, pas seulement par le design.
- **État calme convaincant** : le "✓" apaisé remplace bien un zéro rouge/orange anxiogène, à la fois visuellement et dans le DOM.
- **Météo non bloquante en toutes circonstances** : temps de rendu de l'Accueil mesuré à 28-31 ms quel que soit l'état de la géolocalisation ; refus de géolocalisation, panne réseau totale et cache figé sont tous gérés sans plantage et sans donnée fictive affichée.
- **Temps réel fiable** : une confirmation terrain artisan ("Je commence"/"J'ai terminé") ou un déplacement Kanban se répercutent sur l'Accueil d'un autre onglet sans rechargement, et le Kanban ne crée jamais de fausse "confirmation terrain".
- **Réutilisation cohérente des moteurs existants** : le clic sur une décision depuis le popup ouvre bien l'assistant "RÉSOUDRE" déjà en place (aucune logique dupliquée).
- **Thème sombre solide** : tous les textes restent lisibles, les teintes rouge/orange/vert restent distinctes, la carte "Cette semaine" et la météo s'intègrent proprement.
- **Hiérarchie visuelle conforme à l'intention** : le test du regard "3 secondes" confirme l'ordre voulu (Bonjour → À décider/À surveiller → Aujourd'hui/Chantiers → Cette semaine → À savoir) ; aucun élément secondaire (météo, semaine) ne domine visuellement un élément métier principal.
- **Stabilité visuelle réelle** : 10 allers-retours Accueil↔Chantiers, 10 allers-retours Accueil↔Planning et 5 ouvertures/fermetures de popup consécutives ne produisent aucun déplacement de contenu mesurable (±1 px) ni popup fantôme.

## Recommandations (à ne pas implémenter à ce stade)

1. Fiabiliser la mise à jour asynchrone des badges météo "Chantiers actifs" (F01) : faire en sorte qu'un `projectWeatherState[pid]` déjà connu soit immédiatement réappliqué au DOM courant à chaque rendu, plutôt que de dépendre uniquement du `.then()` du tout premier appel.
2. Ajouter `min-width: 0` à `.acp-row` (F02), en miroir de la correction déjà appliquée à `.attention-card` pour le même problème.
3. Homogénéiser l'accessibilité clavier des lignes "Aujourd'hui" (F04) avec les trois autres familles de cartes cliquables (bouton natif ou `tabindex` + `role="button"` + gestion Entrée/Espace).
4. Revoir la redondance Hero / cartes attention / "À savoir" (friction UX n°1) pour qu'un même chiffre n'apparaisse pas à trois endroits sans apport d'information supplémentaire.
5. Vérifier le comportement du bouton flottant "+" sur l'Accueil Mobile Bureau (F06), qui chevauche visuellement la barre d'onglets et n'a pas d'action définie dans ce contexte.

## Synthèse

| Zone | Desktop | Tablette | Mobile | Sombre | Interaction |
|---|---|---|---|---|---|
| Hero (date, météo conducteur) | PASS | PASS | PASS | PASS | PASS |
| À décider | PASS | PASS | PASS | PASS | PASS |
| À surveiller | PASS | PASS | PASS | PASS | PASS |
| Aujourd'hui | PASS (F03 en cas extrême) | PASS | PASS | PASS | PASS (F04 clavier) |
| Chantiers actifs | F01, F02 | PASS | PASS | PASS | PASS |
| Cette semaine | PASS | PASS | PASS | PASS | PASS |
| À savoir | PASS (friction UX) | PASS | PASS | PASS | n/a |

## Chiffres clés

- **123 vérifications automatisées** exécutées (`recette-accueil-v2.4.4.1.mjs`) : **118 PASS / 5 FAIL** — les 5 échecs correspondent exactement à F01 (1 assertion), F02 (2 assertions), F03 (1 assertion) et F04 (1 assertion) ; aucun échec non expliqué.
- **0 erreur console d'origine applicative** (`console.error` du code Kanvix). Les seules lignes de type "Failed to load resource" observées proviennent soit de pannes réseau **volontairement simulées** (scénario "météo indisponible", comportement attendu et documenté par le code lui-même via `console.warn`), soit de tentatives réseau réelles bloquées par le bac à sable de test lui-même sur des sections ne simulant pas la météo — un artefact d'environnement de test, sans rapport avec le code de l'application.
- **6 tailles desktop** testées : alignement à 0 px d'écart partout.
- **3 jeux de données** testés (calme/normal/chargé) : hauteur de l'Accueil rigoureusement constante.

## Limites de cet audit

- F01 a été caractérisé de façon approfondie (dizaines de répétitions, isolation de plusieurs variables) mais son mécanisme interne exact n'a pas pu être confirmé avec certitude sans modifier le fichier (hors périmètre de cette recette). Sa manifestation dans un navigateur réel (hors automatisation Playwright) reste à vérifier.
- L'accessibilité n'a fait l'objet que d'un contrôle minimal ciblé (focus clavier, rôle natif des éléments cliquables), pas d'un audit WCAG complet.
- Les captures météo (I, A, C...) reflètent l'état obtenu au moment de la capture ; F01 étant intermittent, une capture répétée peut occasionnellement différer de celles fournies.
