# Recette Mode Chantier Kanvix V2.4.5

Audit en lecture seule. **Aucune ligne de `kanvix-next-gen-v2.4.5.html` n'a été modifiée.** L'Accueil V2.4.5 (gelé) a été rejoué en fin de recette : **149/149 PASS, 0 régression.**

## Verdict global

**PASS AVEC RÉSERVES**

Les cinq scénarios maîtres P0 (PM-F1 à PM-F5) passent intégralement, plus les deux P1 (PM-F6, PM-F7). Aucun blocker, aucune perte de données, aucune impasse de navigation, aucune erreur JavaScript applicative, aucun drawer utilisé pour la consultation d'une tâche, planning mobile toujours quittable, messagerie réellement utilisable, SAV photo → artisan fonctionnel de bout en bout, responsive 375–430 px propre.

La seule réserve est un finding **MINEUR** (MC-01) : le bouton « Voir dans le planning » du popup d'impact d'une reprise n'atteint pas le planning mobile (il s'appuie sur le moteur planning **Bureau**), sans créer d'impasse ni faire sortir du Mode Chantier — l'action équivalente reste disponible depuis le popup de la tâche. S'y ajoutent une friction UX mineure et un gap produit, tous deux documentés séparément ci-dessous.

Réponse à la question finale — « Si je donne ce téléphone à un conducteur de travaux sur le chantier, peut-il faire son travail sans que je lui explique où cliquer ? » : **OUI**, pour le cœur du métier (arriver, trouver, constater, photographier, signaler une reprise, prévenir, revenir).

## Scénarios maîtres

| Scénario | Priorité | Verdict | Étapes clés vérifiées |
|---|---|---|---|
| **PM-F1 — Arrivée sur chantier** | P0 | **PASS** (11/11) | Bureau → bouton Mode Chantier → driverMode=field, sidebar absente, shell immédiat, scrollY=0, barre basse [Chantier][Messages] ; sélecteur = chantiers actifs uniquement (archivé exclu) ; sélection Keravel mémorisée ; tâche = **popup** (jamais drawer) ; fermeture → retour chantier conservé |
| **PM-F2 — Contrôle + SAV** | P0 | **PASS** (13/13 + verdict) | Recherche « fenêtre » → tâche terminée + « Signaler une reprise » → formulaire (commentaire+photo+planification) → **reprise créée** (reworkOfTaskId), tâche d'origine **reste terminée**, **photo liée à la reprise**, successeur redirigé, impact planning affiché, replanification (moteur reflow existant), **« Prévenir Thomas »** → conversation Mode Chantier **pré-remplie + photo jointe**, envoi, retour chantier → reprise dans **« Reprises en cours »** |
| **PM-F3 — Planning terrain** | P0 | **PASS** (10/10) | Tâche → « Voir dans le planning » → **reste en Mode Chantier** (driverMode=field, fieldView=planning), **aucun Gantt / aucune sidebar**, tâche focalisée mise en avant, contexte **Dépend de / Puis** (jamais A→B→C→D→E), toggle **Aujourd'hui / Cette semaine** uniquement, clic tâche liée → popup, **← Chantier** + barre basse referment le planning (aucune impasse) |
| **PM-F4 — Communication** | P0 | **PASS** (8/8) | Messages = **vraie page** plein écran (pas un drawer) ; conversation plein écran (ids `fieldConv*`) ; envoi texte ; envoi **photo+texte** (photoId) ; retour Chantier → sélection conservée ; « + Nouveau » → destinataires = personnes de l'équipe |
| **PM-F5 — Boucle artisan** | P0 | **PASS** (4/4) | 2 onglets : Artisan « Je commence » → conducteur voit **En cours sans F5** ; « J'ai terminé » → **Terminée sans F5**, bascule dans **À contrôler** |
| **PM-F6 — Reprise & cycle de vie** | P1 | **PASS** (5/5) | Reprise ouverte comptée comme intervention ouverte → chantier **non prêt à clôturer** ; **jamais de clôture automatique** ; terminer la reprise → recalcul cohérent, lifecycle reste « active » |
| **PM-F7 — Conditions dégradées** | P1 | **PASS** (4/4) | 390 px sombre + météo indisponible + offline → Mode Chantier pleinement fonctionnel, **aucune valeur météo fictive**, 0 scroll horizontal, textes longs sans débordement |

## Résultats techniques

| Domaine | Résultat |
|---|---|
| Navigation Chantier↔Messages (20 bascules) | PASS — header/barre basse/largeur **stables à ±0 px** |
| Popup vs drawer (tous statuts) | PASS — consultation tâche = popup, **jamais** de drawer |
| Responsive 390/375/430/412/393 | PASS — **0 scroll horizontal** sur home/popup/planning/messages/conversation |
| Safe-area | PASS — `env(safe-area-inset-top)` sur `.field-header`, `env(safe-area-inset-bottom)` sur `.field-bottom` |
| Rôle/fermeture popup | PASS — `#modal role="dialog"`, bouton Fermer identifiable, Échap ferme |
| Thème sombre | PASS — titres/tâches/sections/pills lisibles, popup lisible |
| États vides (jour/reprise/message) | PASS — messages calmes, sections absentes proprement |
| Chantier chargé (20 tâches / 8 reprises) | PASS — 0 débordement, « À contrôler » plafonné à 8 sans recherche |
| Sortie Bureau ↔ retour | PASS — driverMode=office/field, **aucune donnée perdue**, chantier conservé |
| Temps réel local (multi-onglets) | PASS — actualisation sans F5, aucune fausse confirmation |
| Console | **0 erreur JavaScript applicative** |

## Findings

### MC-01 — [MINOR] « Voir dans le planning » du popup d'impact reprise n'atteint pas le planning mobile

**Scénario** : PM-F2, après création d'une reprise, dans le popup « Reprise créée » / « Replanification appliquée ».

**Étapes** : Mode Chantier → Keravel → tâche terminée → Signaler une reprise → créer → popup d'impact → cliquer **« Voir dans le planning »**.

**Observé** : le bouton s'appuie sur `focusPlanningTask()` (moteur planning **Bureau**), qui pose `app.ui.page='planning'`. En Mode Chantier, `renderField()` ignore `app.ui.page` et `app.ui.fieldView` reste `"site"` : l'utilisateur est **ramené à l'accueil chantier**, pas au planning. Mesure du test : `{field:true, page:'planning', fieldView:'site', planningVisible:false, chantierHomeVisible:true}`.

**Attendu** : ouvrir le **planning mobile** de la tâche, exactement comme le fait le bouton « Voir dans le planning » du **popup de tâche** (qui appelle correctement `openFieldPlanning()`, cf. PM-F3).

**Impact réel** : faible. Aucune impasse (l'écran d'arrivée est l'accueil chantier, pleinement fonctionnel), aucune sortie du Mode Chantier (driverMode reste `field`), aucune donnée perdue ; et l'action équivalente est atteignable depuis le popup de la tâche. Le défaut est surtout un **libellé trompeur** sur un chemin secondaire → classé MINOR (borderline MAJOR pour l'aspect « interface trompeuse », rétrogradé car sans impasse et avec chemin alternatif).

**Capture** : `recette-mode-chantier/E-impact-planning.png` (le bouton concerné est visible dans le popup).

## Frictions UX (distinctes des bugs)

1. **Le formulaire « Signaler une reprise » est une sidewindow (drawer), pas un popup.** La consultation d'une tâche est bien un popup (règle §12 respectée), mais l'action SAV réutilise le drawer Bureau existant. C'est un choix de conception assumé (« les actions réutilisent les moteurs existants »), cohérent avec les recettes précédentes — signalé comme observation, pas comme bug. À noter tout de même : c'est le **seul** endroit du Mode Chantier où une sidewindow apparaît.
2. **« À contrôler » plafonne à 8 tâches terminées** hors recherche ; les tâches plus anciennes ne sont atteignables que via le champ de recherche. Comportement volontaire et raisonnable (évite la liste infinie, §14/§40), mais un chef cherchant une tâche terminée « il y a longtemps » doit savoir utiliser la recherche.
3. **Libellé « Bureau »** (bouton de sortie) : compréhensible pour un conducteur habitué au poste fixe, mais légèrement abstrait pour un primo-utilisateur (signifie « revenir à l'espace de travail complet / poste bureau »). Faible risque.

## Gaps produit (souhaitables, réellement absents, jamais prétendus par l'interface)

- **GP-01 — Remontée « incident terrain » structurée de l'artisan vers le conducteur.** L'artisan peut démarrer/terminer ses tâches (les signaux `field-start`/`field-done` remontent côté conducteur dans « À surveiller ») et échanger messages + photos ; mais il n'existe pas d'objet dédié « problème/incident signalé par l'artisan avec photo » distinct de la messagerie. L'interface ne prétend pas l'offrir → **gap produit**, pas un bug. La météo, conformément à la conception V2.4.4, reste purement informative et ne génère jamais issue/décision/replanification.

## Points forts

- **Le scénario maître SAV (PM-F2) fonctionne de bout en bout** : photo → reprise → chaîne de dépendances mise à jour (successeur redirigé) → tâche d'origine conservée terminée → impact planning → replanification → message pré-rempli avec photo → reprise visible dans « Reprises en cours ». C'est le cœur métier du Mode Chantier, et il est solide.
- **Le planning mobile ne s'échappe jamais du Mode Chantier** : sous-vue contextuelle (fieldView), aucun Gantt, aucune sidebar, dépendances présentées en « Dépend de / Puis » (jamais une fausse chaîne linéaire), toujours quittable via ← Chantier **et** la barre basse.
- **La messagerie est une vraie page plein écran** (jamais un drawer), conversation fieldConv dédiée, envoi texte et photo fonctionnels, retour sans perte de sélection.
- **Temps réel local fiable** : démarrage/fin artisan et bascule « À contrôler » reflétés sans rechargement.
- **Géométrie parfaitement stable** : header/barre basse/largeur à ±0 px après 20 bascules ; 0 scroll horizontal de 375 à 430 px sur tous les écrans.
- **Robustesse** : météo non bloquante et sans valeur fictive, offline OK, sombre lisible, safe-area gérée, popup avec rôle dialog + Échap, cycle de vie cohérent (jamais de clôture automatique).
- **Consultation = popup partout, action = moteurs existants** : aucune logique métier dupliquée, cohérent avec le reste de Kanvix.

## Recommandations (à NE PAS implémenter à ce stade)

1. **MC-01** : faire pointer le « Voir dans le planning » du popup d'impact reprise (`showReworkImpact`/`applyReworkReflow`) vers `openFieldPlanning(reworkId)` lorsque `isFieldMode()`, comme le popup de tâche — pour que le libellé tienne sa promesse.
2. Envisager un libellé plus explicite pour le bouton de sortie (« Bureau » → p. ex. « Quitter le chantier » / « ← Poste bureau ») si des tests terrain confirment l'ambiguïté.
3. Étudier un objet « signalement terrain » (GP-01) si le besoin métier d'une remontée d'incident artisan structurée (au-delà de la messagerie) se confirme.
4. Envisager un indice visuel dans « À contrôler » rappelant que la recherche donne accès aux tâches terminées plus anciennes (au-delà des 8 récentes).
5. Confirmer par un test terrain réel (vrai smartphone, PWA plein écran) le rendu safe-area en bas d'écran, la recette n'ayant pu le vérifier qu'au niveau CSS source.

## Tableau de synthèse

| Zone | 390px | 430px | Sombre | Interaction | Verdict |
|---|---|---|---|---|---|
| Home Chantier | PASS | PASS | PASS | PASS | **PASS** |
| Tâche (popup) | PASS | PASS | PASS | popup, jamais drawer | **PASS** |
| SAV / reprise | PASS | PASS | PASS | photo→reprise→impact→message | **PASS** |
| Photo | PASS | PASS | PASS | liée reprise + message | **PASS** |
| Planning | PASS | PASS | PASS | reste en Mode Chantier, MC-01 sur 1 bouton secondaire | **PASS avec réserve** |
| Messages | PASS | PASS | PASS | vraie page, pas de drawer | **PASS** |
| Conversation | PASS | PASS | PASS | plein écran, texte+photo | **PASS** |

## Chiffres clés

- **84 vérifications automatisées** (`recette-mode-chantier-v2.4.5.mjs`) : **84 PASS / 0 FAIL**. Le finding MC-01 est reproduit via une observation neutre (`note`, sans assertion — conformément à la consigne « ne pas coder un bug comme résultat attendu »).
- Scénarios maîtres : **PM-F1 à PM-F7 = PASS**.
- **0 BLOCKER · 0 MAJOR · 1 MINOR (MC-01) · 0 COSMETIC · 1 GAP PRODUIT (GP-01)** ; 3 frictions UX documentées.
- **0 erreur console applicative.** La seule ligne réseau observée (`ERR_TUNNEL_CONNECTION_FAILED`, section PM-F7) provient de la coupure réseau **volontairement simulée** (test offline) — comportement géré, sans exception non gérée.
- **Recette Accueil V2.4.5 rejouée : 149/149 PASS, 0 régression** (l'Accueil gelé n'a pas bougé).

## Limites de cet audit

- Le multi-onglets teste la **synchronisation locale** (BroadcastChannel/localStorage), pas deux appareils distants réels (conforme à la nature du POC).
- La photo caméra ne peut être déclenchée en environnement de test ; le retour caméra est simulé en injectant la dataURL exactement comme le fait le callback réel (`applyPhotoDraft`), et les **références métier** (photo liée à la reprise/au message) sont vérifiées.
- Le rendu safe-area/PWA plein écran est vérifié au niveau CSS source uniquement.
