# RAPPORT — KANVIX V2.12.1 — « Préparer un décalage » (SIMPLIFICATION-R1)

**Modèle utilisé pour cette mission : Claude Sonnet 5** (`claude-sonnet-5`), du début à la fin, comme demandé.

**Version cible :** `kanvix-next-gen-v2.12.1.html`. Ce nom n'existait pas encore dans `public/poc/` — aucune écrasement, aucun choix de suffixe alternatif à justifier.

---

## 1. Limitation reproduite (avant toute modification)

Kanvix disposait déjà de **deux** mécanismes distincts liés à un décalage :

1. **`scenarioOptions(issueId)`** (V2.4.10.1/V2.4.10.2) — calcule deux scénarios de résolution (« Décaler la chaîne », « Maintenir le jalon ») pour un **incident**. Le code le dit lui-même : *« Scénarios réellement calculés — uniquement pour l'incident windows-delay. Tout autre incident renvoie [] »*. Reproduit sur V2.12.0.2 (DECAL-01) :
   `scenarioOptions('windows-delay').length === 2`, `scenarioOptions('t-slab-incident').length === 0`, `scenarioOptions('n-importe-quoi').length === 0`.
2. **`showWhatIf`/`startWhatIf`** — un simulateur « et si cette tâche prenait du retard ? » générique par tâche (+1/+2/+3 jours), mais qui navigue vers le Planning et n'offre ni aperçu contextualisé dans la fiche, ni distinction conflit nouveau/préexistant, ni contrôle d'état périmé, ni confirmation humaine explicite, ni transaction à une seule entrée d'historique.

Aucun des deux n'offrait, depuis la fiche d'une intervention quelconque, le parcours demandé : aperçu avant/après → blocages calculés → refus d'un état périmé → validation humaine → transaction unique. `taskShiftEligibility` (et tout le reste du nouveau parcours) n'existaient pas du tout sur V2.12.0.2 — confirmé par `typeof taskShiftEligibility === 'undefined'` et par l'absence du bouton dans la fiche tâche (DECAL-01).

## 2. Contrat fonctionnel retenu

- **Point d'entrée :** bouton « Préparer un décalage » dans le menu « … » de la fiche tâche (`openTask`), à côté de « Tester un décalage » — choix conservateur qui ne touche pas la logique Essentiel/Pilotage existante (le menu entier reste gated par `pilot && projectEditable`, inchangé).
- **Éligibilité :** ni « doing », ni « done », chantier éditable (ni clôturé ni archivé). Kanvix n'a **aucun** statut « annulée »/« archivée » au niveau de la tâche (seuls `todo/doing/done/waiting/late` existent, et `waiting`/`late` ne sont que des variantes de « pas commencée » — jamais réassignées par le moteur, uniquement des données de démo) : la correspondance retenue en découle directement. Sur intervention non éligible, le bouton reste visible mais **désactivé**, avec un `title` expliquant pourquoi (DECAL-02/03) ; sur une tâche terminée, il disparaît avec le reste du menu (DECAL-04) — cohérent avec le comportement déjà existant de « Modifier »/« Replanifier ».
- **Sens :** report strictement positif, 1 à 30 jours (`SHIFT_MIN_DAYS`/`SHIFT_MAX_DAYS`), validé côté formulaire ET côté moteur.
- **Deux modes, jamais plus :** « décaler uniquement cette intervention » / « décaler et propager aux tâches dépendantes ».
- **Panneau latéral** (`#drawer`), jamais de nouvelle page — deux étapes dans le même panneau : formulaire → aperçu.

## 3. Fonctions ajoutées

Aucune autre que celles-ci (14, vérifié par balayage `md5` de tout le fichier — FREEZE-2121) :

`taskShiftEligibility`, `shiftChainHasCycle`, `computeShiftChain`, `buildShiftFingerprint`, `evaluateShiftImpact`, `openPrepareShift`, `renderPrepareShiftForm`, `pickShiftPropagate`, `submitPrepareShiftForm`, `renderPrepareShiftPreview`, `toggleShiftConfirm`, `cancelPrepareShift`, `renderPrepareShiftError`, `applyPrepareShift`.

## 4. Fonctions modifiées

**Une seule fonction existante modifiée : `openTask()`** — ajout du bouton (et de son état désactivé/expliqué) dans le menu « … ». Rien d'autre dans son HTML n'a changé.

## 5. Fonctions explicitement gelées (réutilisées, jamais réécrites)

66 fonctions nommément comparées octet à octet à V2.12.0.2 (FREEZE-2121) — **toutes identiques** : `planReflow`, `applyReflowPlan`, `planScheduleChanges`, `reflowSuccessors`, `propagateDependencies`, `evaluateScenario`, `scenarioOptions`, `evaluateDependencyConflicts`, `findDependencyConflicts`, `getResourceSchedulingConflicts`, `getResourceConflicts`, `resourceUnavailabilityConflicts`, `getMaxConcurrentTasks`, `getResourceTasks`, `taskResourceIds`, `taskHasResource`, `nextWorkingTime`, `addWorkingDuration`, `addBusinessDays`, `nonWorkingDaysInRange`, `taskTouchesNonWorkingDay`, `calculateProjectEnd`, `calculateProjectDelay`, `workdayDelay`, `milestoneImpactNote`, `milestoneStatus`, `milestoneLinkedTask`, `getTaskSuccessors`, `getTaskPredecessors`, `taskCreatesCycle`, `getCriticalImpacts`, `showWhatIf`, `startWhatIf`, `autoFixSimulation`, `cancelSimulation`, `applySimulation`, `simulate`, `moveTask`, `openTaskEdit`, `submitTaskEdit`, `setTaskStatus`, `openTaskPrerequisites`, `confirmPrerequisiteStart`, `askPrerequisiteStartConfirm`, `snapshot`, `undo`, `redo`, `cloneHistoryState`, `restoreHistoryState`, `preserveCommunications`, `invalidateRedo`, `pushHistory`, `clearUndoRedo`, `sendConversationMessage`, `sendArtisanMessage`, `openConversation`, `addPhoto`, `addFieldPhoto`, `guardEditable`, `canEditProject`, `isProjectActive`, `isProjectArchived`, `save`, `resetApp`, `render`, `renderPage` (+ `renderAIPanel`, sensible à l'indentation contextuelle, comparé séparément par bloc — également identique).

Feuille de style **byte-identique** : le panneau réutilise exclusivement des classes déjà en production (`.drawer-section`, `.te-section`, `.te-h`, `.te-readonly`, `.te-note`, `.te-advanced`/`<details>`, `.seg`/`.seg-opt`, `.effect-summary`/`.effect`, `.prq-confirm-list`, `.cal-warn-days`, `.check-row`, `.form-error`, `.te-actionbar`). **Aucune classe CSS ajoutée.**

## 6. Choix de calendrier

Le décalage de la tâche **source** compose deux moteurs déjà en production, jamais réécrits :
`newStart = addBusinessDays(t.start, jours)` (déjà utilisé par `startWhatIf`) puis
`newEnd = addWorkingDuration(newStart, duration(t))` (déjà utilisé par `planReflow` pour préserver une durée en respectant les heures ouvrées 8h–18h). DECAL-27 prouve que ce calcul produit un résultat **rigoureusement identique** à la composition directe de ces deux fonctions existantes — aucun second moteur de calendrier n'a été écrit.

La **cascade** réutilise `planScheduleChanges`/`planReflow` sans aucune modification.

**Dette assumée et documentée, pas corrigée en silence :** comme partout ailleurs dans Kanvix (voir le commentaire du produit lui-même : *« un week-end et un férié ne sont pas des anomalies (…) il AVERTIT, le conducteur tranche »*), `nextWorkingTime`/`addWorkingDuration`/`addBusinessDays` sautent automatiquement les week-ends mais **pas** les jours fériés français — seule la fonction d'avertissement `nonWorkingDaysInRange` les connaît. « Préparer un décalage » suit exactement cette convention : un jour non ouvré touché est **signalé** (DECAL-25), jamais bloquant à lui seul (DECAL-26).

## 7. Règles de propagation

- Chaîne simple, éventail (un prédécesseur → plusieurs successeurs) : propagés correctement (DECAL-14, DECAL-15).
- **Prédécesseurs multiples — la limite réelle de `planReflow`, documentée honnêtement :** `planReflow` recalcule la position d'un successeur à partir du **seul** prédécesseur qu'il parcourt lors de la cascade — il ne connaît pas les autres prédécesseurs éventuels de ce successeur. Quand le prédécesseur décalé devient le plus contraignant, le résultat est correct par construction (DECAL-16). Mais si un **autre** prédécesseur (non déplacé) est plus tardif, `planReflow` produirait une date qui viole cette contrainte-là. **Ce lot ne réécrit pas `planReflow`** (hors périmètre, changerait un moteur utilisé ailleurs) : le contrôle de conflits de dépendances (nouveau vs préexistant, §8) **rattrape** ce cas et **refuse l'application** plutôt que d'écrire une date incohérente (DECAL-17, vérifié empiriquement, pas supposé).
- **Uniquement vers l'avenir :** vérifié sur l'ensemble des tâches touchées par une propagation (DECAL-18) — le sens du décalage étant toujours positif, `planReflow` (même sans `forwardOnly`) ne peut pas, dans ce contrat, reculer une tâche.
- **Intervention déjà commencée dans la chaîne :** bloque la propagation automatique (message explicite, arbitrage manuel requis) — jamais de déplacement silencieux (DECAL-19).
- **Intervention terminée dans la chaîne :** n'est PAS un blocage — la cascade s'arrête simplement là, comme `planReflow` le fait déjà ailleurs (DECAL-20).
- **Cycle de dépendances :** détecté explicitement (`shiftChainHasCycle`, DFS avec pile de chemin) avant tout appel à `planReflow` — immédiat (< 1 ms), aucune boucle infinie, aucune mutation partielle (DECAL-21/22).

## 8. Conflits — nouveaux vs préexistants

`evaluateDependencyConflicts` et `getResourceSchedulingConflicts` (inchangées) sont appelées deux fois : une fois sur `app.tasks` (avant), une fois sur une copie clonée avec les changements appliqués (après). Seuls les conflits **absents avant et présents après** sont comptés comme « nouveaux » et bloquent l'application (DECAL-33/34) ; les conflits déjà présents sont relevés séparément et **n'empêchent jamais** un décalage qui n'en est pas la cause (DECAL-32). Couvre capacité, indisponibilité de personne, d'équipement partagé et ressource complémentaire (DECAL-35/36).

## 9. Jalons

Reprend exactement la logique de `milestoneStatus()` (déjà en production) : un jalon lié à une tâche (`m.taskId`) n'est « menacé » que si **cette tâche précise** est dans la chaîne réellement déplacée et que sa nouvelle fin dépasse la date cible (DECAL-39) ; un jalon final n'est « menacé » que si la fin de chantier calculée **change réellement** en conséquence du décalage — pas à chaque décalage sur le chantier (DECAL-40 : décaler une tâche qui n'est pas sur le chemin critique ne menace rien ; DECAL-41 : décaler celle qui l'est, oui).

## 10. Contrôle d'état périmé

Une empreinte (`buildShiftFingerprint`) — jamais persistée, variable locale au module comme `taskEditConfirmAck` — capture tâches touchées (dates/statut/deps), ressources mobilisées, indisponibilités les concernant, jalons du chantier et calendrier. Juste avant l'application, l'empreinte est recalculée et comparée ; toute différence refuse l'application (tâche source changée : DECAL-43 ; dépendance : DECAL-44 ; tâche propagée : DECAL-45 ; ressource : DECAL-46 ; nouvelle indisponibilité : DECAL-47). Un changement **sans rapport** (un autre chantier) ne périme pas l'aperçu (DECAL-48) : l'empreinte n'est pas globale à toute l'application.

## 11. Transaction et rollback

Un seul `snapshot()` pour la tâche source **et** toute sa cascade (DECAL-55) ; toutes les mutations sont appliquées ensemble ; une seule entrée d'historique intelligible (même choix que `applySimulation()` pour ce type de transaction — pas le détail par tâche d'`applyReflowPlan`, qui reste inchangé et hors périmètre) (DECAL-56). Aucun message ni notification automatique (DECAL-57). Une erreur détectée **avant** l'écriture (blocage, périmé, cycle) n'ouvre **aucune** transaction — rien à annuler (DECAL-21/22, DECAL-60).

## 12. Undo/Redo

Un seul `undo()` restaure les dates de la source **et** de toutes les tâches propagées en un seul geste ; un seul `redo()` les réapplique symétriquement (DECAL-58/59). `restoreHistoryState`/`preserveCommunications` (V2.12.0.2) ne sont pas modifiées.

## 13. Communications

Les garanties de V2.12.0.2 sont rejouées dans le contexte de **cette nouvelle transaction** : message envoyé après un décalage → conservé à l'Undo et au Redo (DECAL-61/62) ; message avec photo, après un décalage **propagé** → message et photo conservés, référence résolvable (DECAL-63) ; une photo terrain **non liée** à un message reste pleinement annulable dans sa **propre** transaction, sans affecter le décalage (DECAL-64).

## 14. Résultats de la recette dédiée

`recette-preparer-decalage-v2.12.1.mjs` — **77 / 77** assertions passées, 0 erreur console applicative.

```
RÉSULTAT : 77 / 77
ERREURS CONSOLE APPLICATIVES : 0
```

Couvre : disponibilité/interface, calcul simple, propagation (chaîne, éventail, prédécesseurs multiples, cycle, doing/done), calendriers, ressources, jalons, état périmé (5 déclencheurs distincts), validation, transaction/historique, communications, persistance, FREEZE-2121 (périmètre), responsive et clavier.

## 15. Résultats du sweep historique

Comparaison directe contre la référence courante (V2.12.0.2) faite par FREEZE-2121 elle-même (§5). En complément, deux recettes historiques ont été rejouées avec `kanvix-next-gen-v2.12.1.html` en `CUR` (leur `PREV` d'origine conservé) :

- `recette-undo-communications-v2.12.0.2.mjs` : **37/40** — les 3 échecs sont uniquement les trois assertions de périmètre FREEZE-21202 qui comparaient à la génération V2.12.0.1 (elles attendaient *seulement* le patch V2.12.0.2 ; V2.12.1 y ajoute légitimement `openTask` + les 14 fonctions du présent lot). **Toutes les 37 assertions comportementales — Undo/Redo, communications, schéma — passent sans exception.**
- `recette-conditions-demarrage-v2.12.0.1.mjs` : **37/40** — même cause exacte (périmètre FREEZE-21201 comparé à V2.12.0). La garde de démarrage, l'éditeur universel, le responsive et le tactile restent tous conformes.

**RESTE : 0** — aucun échec dont la cause n'est pas nommément identifiée et justifiée par l'ajout légitime de ce lot ; aucune assertion affaiblie, aucun test historique modifié.

## 16. Validation navigateur

Playwright / Chromium, parcours **réel** (clic bouton → panneau → saisie → calcul → case à cocher → application), pas de test DOM substitué à une preuve visuelle :

- 6 largeurs (1920 → 390 px) × clair/sombre = 12 combinaisons : **aucun débordement horizontal, aucun débordement du panneau** (FIXDECAL-RESP).
- Contrôles nouvellement dimensionnés par ce lot (boutons segmentés, boutons d'action) : hauteur tactile ≥ 36 px sur mobile — la case à cocher réutilise `.check-row` tel quel (déjà utilisée ailleurs dans Kanvix), sa hauteur n'est pas soumise à un seuil inventé par ce lot.
- Focus initial sur le champ « jours » à l'ouverture (comme `openTaskEdit`) (FIXDECAL-KBD).
- Captures réellement produites : `recette-v2.12.1/01-apercu-390-light.png`, `02-apercu-1440-dark.png` (état bloqué, thème sombre desktop), `03-apercu-succes-1440-light.png` (état applicable, thème clair desktop).
- 0 erreur console applicative sur l'ensemble de la recette.

## 17. Limites restantes

- Les jours fériés français ne sont pas exclus du calcul automatique (seulement avertis) — convention déjà en vigueur dans tout Kanvix, non spécifique à ce lot (§6).
- `planReflow` ne garantit pas seul le respect de la fin maximale de **tous** les prédécesseurs d'un nœud à plusieurs entrées ; c'est le contrôle de conflits de dépendances qui refuse l'application dans ce cas (§7). Une amélioration future pourrait faire calculer ce maximum directement à `planReflow`, mais cela toucherait un moteur partagé par d'autres parcours (glisser-déposer, éditeur) — explicitement hors périmètre de ce lot.
- « Préparer un décalage » ne propose pas d'arbitrage manuel intégré pour une tâche « en cours » rencontrée dans la chaîne (contrairement à `evaluateScenario`) : le contrat de ce lot limite volontairement l'UI à deux choix (§2) ; l'arbitrage reste à faire par un autre parcours existant (éditeur, Kanban).
- Le lot ne modifie ni ne fusionne `scenarioOptions`/`openScenarios` (arbitrage incident windows-delay) ni `showWhatIf`/`startWhatIf` (simulateur avec navigation Planning) : les trois parcours coexistent. Une convergence éventuelle est une décision produit distincte, hors mandat de ce round.

## 18. Livrables

1. `public/poc/kanvix-next-gen-v2.12.1.html` — fichier complet.
2. `recette-preparer-decalage-v2.12.1.mjs` — recette dédiée (77/77).
3. `RAPPORT-V2.12.1-PREPARER-DECALAGE.md` — ce rapport.
4. `recette-v2.12.1/resultats.json` — résultats chiffrés + 3 captures d'écran réelles.

Aucun autre lot de simplification (Structure, Agenda, Essentiel/Pilotage, mobile, fusion des modèles) n'a été commencé ni modifié.
