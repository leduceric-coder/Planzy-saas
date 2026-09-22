# KANVIX — PLAN DE SIMPLIFICATION V1.1 (revue différentielle avec Astra)

**Méthode :** comparaison de `KANVIX_PLAN_SIMPLIFICATION_V1.md` avec `rapport-audit-kanvix-astra.md` et le code réel de `kanvix-astra-challenge-poc.html` (vérification directe des fonctions citées par le rapport : `astraBuildDelay`, `astraPrepareDelay`, `restoreHistoryState`, `renderPlanning`, `pageToday`, CSS `.astra-mobile-nav`). Astra précise elle-même n'avoir produit **aucune capture d'écran validée** (navigateur local indisponible, tests en jsdom sans mise en page) : toute conclusion "à tester" ci-dessous reste donc à confirmer visuellement, pas seulement fonctionnellement.

---

## 1 — Conclusions de la V1 confirmées

- **Les 4 destinations de navigation** (Aujourd'hui, Chantiers, Planning, Ressources/Équipe) restent le bon périmètre — Astra les conserve à l'identique, ne teste que le libellé "Équipe" vs "Ressources".
- **La fiche tâche comme pivot** n'est pas remise en cause — Astra y ajoute une action ("Préparer un décalage") sans la refondre.
- **Le niveau Essentiel/Pilotage doit rester un réglage persistant**, pas une pure révélation contextuelle — confirmé, voir §2.
- **Les options avancées doivent être repliées, jamais supprimées** — confirmé et mieux outillé qu'en V1 (voir §3, pattern `<details>`).
- **Mode Chantier et vue Artisan restent globalement corrects** dans leur cœur de fonctionnement — Astra les classe "CONSERVER"/"AMÉLIORER" marginal (sélection de mission, lieu, contact) et exclut explicitement ces deux écrans de ses nouveaux composants mobiles (`.artisan-body`, `.field-body` sont exclus de `.astra-mobile-nav`).
- **Undo/Redo doit garantir qu'une communication envoyée après coup n'est jamais effacée.** Ce point, absent de la V1, est déjà **livré et testé en production dans V2.12.0.2** avec une implémentation par **union** des messages (pas de perte possible, y compris sur un import qui vide la collection). Le correctif du POC Astra (`restoreHistoryState`) **remplace** la collection courante plutôt que de l'unir au snapshot : il expose le même risque de perte que celui déjà identifié et corrigé côté Kanvix. Aucune action requise, ne pas régresser vers cette version.

---

## 2 — Conclusions à corriger

### a) Structure de chantier
- **Ancienne conclusion (V1, lot R3) :** masquer l'onglet Structure tant qu'aucune tâche n'existe.
- **Nouvelle conclusion :** ne jamais la masquer. Un chantier peut légitimement être structuré (bâtiment/étage/zone/lot) **avant** toute intervention — c'est même l'usage recommandé sur un gros chantier.
- **Déclencheur :** matrice Astra, ligne "Structure hiérarchique → CONSERVER, Onglet Structure, y compris Essentiel" ; aucune garde par nombre de tâches dans le POC.
- **Conséquence :** le lot R3 est retiré tel quel. Il est remplacé par un geste plus léger et strictement non bloquant : reformuler l'état vide ("Organisez si besoin — utile sur les chantiers à plusieurs bâtiments ou lots") au lieu d'une injonction ("Créez mon premier niveau"), sans jamais conditionner l'affichage de l'onglet à quoi que ce soit.

### b) Doublons de réglages
- **Ancienne conclusion (V1, lot R1) :** un seul emplacement pour le niveau Essentiel/Pilotage et pour le rôle de démonstration.
- **Nouvelle conclusion :** à distinguer. Le **niveau d'affichage** dans le popover profil est un **raccourci contextuel volontaire** (changer de mode sans quitter son écran) ; Réglages reste l'**emplacement de référence**, seul capable de porter l'explication de ce que chaque niveau révèle — exactement ce que fait le texte Astra ("Essentiel : journée, agenda, conditions… Pilotage : dépendances, planning de référence, charge…"). Ce n'est pas une incohérence, c'est un doublon fonctionnel légitime, à condition que les deux surfaces restent synchronisées. En revanche, le **rôle de démonstration** ("Voir comme artisan") est un artefact de POC sans équivalent produit — Astra le confirme : *"Un sélecteur Artisan ne constitue pas une permission."*
- **Déclencheur :** rapport Astra §2 ("Ce qui existe / futur dans le brief") + système UX §E.
- **Conséquence :** le lot R1 est redéfini et son bénéfice revu fortement à la baisse — il retire uniquement le sélecteur de rôle de démonstration (qui disparaîtra de toute façon avec l'authentification réelle), pas le niveau d'affichage. Il quitte la tête de la hiérarchie de lots.

### c) Vue "Agenda"
- **Ancienne conclusion (V1) :** aucune vue Agenda n'existe ; proposition purement théorique, "à tester" sans base concrète.
- **Nouvelle conclusion :** elle existe et fonctionne dans le POC Astra — une liste triée par date de début, groupée par jour, posée comme vue par défaut à côté de Gantt (renommé "Chronologie") et Kanban (renommé "Avancement"). Mais elle a une **limite réelle qu'Astra documente elle-même** : le tri par date de début seule ne **répète pas** une intervention de plusieurs jours sur chacun des jours qu'elle occupe — elle n'apparaît qu'une fois, sous son jour de démarrage. Pour un conducteur qui veut savoir "qui est sur quel chantier aujourd'hui", une intervention commencée il y a trois jours et toujours en cours devient invisible dans l'Agenda du jour. Ce n'est donc pas un remplacement neutre du Gantt pour les interventions longues (fréquentes en second œuvre), seulement une lecture rapide adaptée aux interventions courtes.
- **Déclencheur :** code `renderPlanning`/`astraSetView` (tri `sort((a,b)=>a.start.localeCompare(b.start))`, aucune répétition multi-jours), signalé aussi par le rapport lui-même en annexe B.
- **Conséquence :** l'Agenda passe de "à tester en théorie" à "à tester en priorité, avec un jeu de données à interventions longues" — et ne doit **pas** devenir la vue par défaut avant validation sur ce cas précis, majoritaire dans le métier visé.

### d) Parcours retard / aléas
- **Ancienne conclusion (V1, Parcours 3) :** "déjà conforme, aucun changement requis" — le mécanisme d'arbitrage existant suffisait.
- **Nouvelle conclusion :** l'audit Astra révèle que ce mécanisme est en réalité **câblé en dur sur un seul scénario de démonstration** (`scenarioOptions` : *"Seul l'incident windows-delay dispose des scénarios spécialisés"*) — il ne se généralise pas à une intervention quelconque. Le POC Astra construit une **vraie généralisation transactionnelle**, vérifiée dans le code : aperçu avant/après sans écriture, blocages calculés avant d'autoriser l'application (jour non ouvré touché, conflit de ressource, tâche déjà commencée), refus explicite si l'état a changé depuis l'aperçu, validation humaine obligatoire (case à cocher), une seule transaction pour la tâche et sa cascade, aucun message envoyé automatiquement. C'est exactement la règle "présenter les conséquences avant validation" du brief — mais elle n'existait, avant Astra, que pour un cas de démonstration.
- **Déclencheur :** rapport Astra, tableau des défauts (`evaluateScenario`, `scenarioOptions`) + code `astraBuildDelay`/`astraPrepareDelay`/`astraApplyDelay`, qui réutilise `planReflow` et `evaluateScenario` existants sans créer de second moteur.
- **Conséquence :** ce parcours devient l'**axe prioritaire n°1** de simplification (voir §5), devant tous les lots de la V1.

### e) Bureau sur mobile (hors Mode Chantier)
- **Ancienne conclusion (V1) :** seuls Mode Chantier et vue Artisan concernent le mobile ; rien à examiner côté écrans Bureau.
- **Nouvelle conclusion :** un conducteur peut consulter les écrans Bureau (Planning, fiche chantier) sur téléphone sans être passé par Mode Chantier — un cas non traité par la V1. Le produit **a déjà** un repli de la barre latérale en barre basse sous 768 px (règle CSS existante) : ce n'est donc pas un manque total. Astra propose une **refonte** de cette barre (5 icônes, cibles 44 px) et replie les filtres avancés du Planning derrière des `<details>` sur mobile — un ajustement de ce qui existe, pas une fonction nouvelle. Astra elle-même n'a **aucune capture ni test tactile réel** pour cette proposition.
- **Déclencheur :** CSS original (`.sidebar` en position fixed/bottom sous 768 px) comparé à `.astra-mobile-nav`.
- **Conséquence :** un lot dédié et modeste ("Bureau mobile") rejoint la hiérarchie, positionné en test avant développement — pas de promesse de "navigation mobile ajoutée" là où une existe déjà.

---

## 3 — Apports d'Astra à conserver

- **Généralisation de "Préparer un décalage"** (§2d) — la meilleure idée du lot, à s'approprier telle quelle dans son principe (aperçu, blocages, refus d'état périmé, transaction unique).
- **Pattern `<details>`/`<summary>` natif** pour replier les blocs avancés (barre d'analyse Planning, filtres secondaires) — plus simple et plus accessible par défaut que le bouton "Analyse" personnalisé proposé en V1 ; à adopter en remplacement de cette proposition pour toute la classe C de la matrice V1.
- **Cibles tactiles systématiques à 44 px** sur tout nouvel élément mobile — principe à généraliser, pas seulement sur les écrans retouchés par Astra.
- **Combinaison niveau global + révélation locale** sur le Planning : au niveau Essentiel, les filtres de base (ressource, lot, structure, export PDF) restent atteignables via le `<details>` replié, sans changer de mode global ; seuls les trois outils d'analyse profonde (baseline, dépendances, chaîne d'impact) restent derrière le niveau Pilotage. C'est la meilleure réponse trouvée à la question "sélecteur global ou révélation contextuelle" : **les deux, avec une frontière précise** — le filtrage reste local, l'analyse profonde reste globale.

## 4 — Propositions d'Astra à rejeter ou tester

- **Accueil "décisions détaillées par défaut"** — À TESTER, pas à adopter tel quel : Astra chiffre elle-même la croissance du DOM initial (19→24 boutons) et signale un "risque de longueur sur mobile". Les trois cartes de synthèse actuelles (Décider/Surveiller/Contrôler) traitées symétriquement restent, à ce stade, un choix plus sûr qu'un traitement asymétrique (Décider développé, Surveiller/Contrôler repliés ensemble).
- **Vue Agenda par défaut** — REJETER comme *défaut immédiat* (voir §2c), CONSERVER comme option à tester.
- **Renommage Chronologie/Avancement** — inchangé de la V1 : à tester, sans risque technique nouveau (Astra l'implémente en simple surcouche de libellé).
- **Bottom-nav Bureau à 5 icônes** — À TESTER seulement ; aucune preuve visuelle ni tactile disponible.
- **Fusion des deux CTA de création identiques sur la fiche chantier** — signalée par Astra elle-même comme non résolue ("à tester"). Reste hors du lot de fusion des modèles (R4, inchangé) : à traiter séparément si confirmé à l'usage.

## 5 — Nouvelle hiérarchie des lots

1. **SIMPLIFICATION-R1 (nouveau, priorité maximale) — Généraliser "Préparer un décalage".** S'inspirer du POC Astra : aperçu transactionnel, blocages avant application, refus d'état périmé, une transaction, aucune notification automatique. Remplace l'arbitrage limité à un seul scénario démo.
2. **SIMPLIFICATION-R2 (ex-R3, allégé) — Structure jamais masquée**, seulement un texte d'état vide moins injonctif.
3. **SIMPLIFICATION-R3 (ex-R1, réduit) — Retirer uniquement le sélecteur de rôle de démonstration** ; garder le double emplacement du niveau d'affichage.
4. **SIMPLIFICATION-R4 (ex-R2) — Gater "Opérations" par le niveau**, inchangé.
5. **SIMPLIFICATION-R5 (nouveau, à tester avant développement) — Vue Agenda + vocabulaire Chronologie/Avancement**, validée d'abord sur des chantiers à interventions longues.
6. **SIMPLIFICATION-R6 (nouveau, à tester avant développement) — Bureau mobile** : refonte de la barre basse existante, `<details>` sur les filtres Planning, cibles 44 px.
7. **SIMPLIFICATION-R7 (ex-R4, inchangé, toujours le plus lourd) — Fusion des trois systèmes de modèle.**

---

## 6 — Recommandation finale consolidée

**Les cinq décisions produit désormais recommandées :**

1. **Généraliser la préparation de décalage** (aperçu/blocages/validation/transaction unique) — priorité absolue, dépasse en valeur tous les lots de la V1 réunis.
2. **Ne jamais masquer la Structure de chantier** ; alléger seulement son invitation, sans condition d'affichage.
3. **Garder le double emplacement Essentiel/Pilotage** (popover + Réglages) et **adopter le pattern `<details>` natif** pour tout repli avancé ; ne retirer que le sélecteur de rôle de démonstration, artefact de POC sans avenir produit.
4. **Tester réellement, avec rendu navigateur et utilisateurs**, avant toute décision : vue Agenda par défaut (sur chantiers à interventions longues), vocabulaire Chronologie/Avancement, et bottom-nav Bureau mobile — aucune de ces trois propositions n'a de validation visuelle, chez Astra comme chez nous.
5. **Conserver la fusion des trois systèmes de modèle comme plus gros chantier restant**, désormais en fin de hiérarchie plutôt qu'en tête : elle reste nécessaire, mais moins urgente que la généralisation du décalage.
