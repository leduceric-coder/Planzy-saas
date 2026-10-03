# DentalFlow V3.8.7 — Rapport d'implémentation

**Fichier de base :** `dentalflow-next-poc-v3.8.6.html` (conservé, non modifié)
**Fichier livré :** `dentalflow-next-poc-v3.8.7.html`
**Mandat :** Correctif ciblé — Commentaires commande, empty-state Accueil, pulse Simulation,
calendrier Absences planifiées
**schemaVersion :** 10 (inchangé)

V3.8.6 possédait déjà `scenarioWeekMetrics()`, `whatIfImpact()` sur données réelles,
`whatIfCalendarHTML()`, le calendrier Simulation toujours visible groupé par mois, les statuts
hebdomadaires, les avatars, la distinction absence/demande/hypothèse, l'horizon 8 semaines, les
animations de pop-ups centrales et `prefers-reduced-motion`. **Aucun de ces éléments n'a été
réimplémenté ni son moteur de calcul modifié** — cette version est un correctif ciblé.

---

## Partie A — Commentaires de commande

Le parcours complet clic → saisie → validation → persistance → affichage immédiat → reload était
manquant. Implémenté sur le modèle exact de `blockOrder()`/`renderBlockOrderPanel()` (V3.8.6 Partie
D), réutilisant le panneau latéral existant et son animation existante — aucun nouveau système
d'animation créé.

- **Source de données** : append-only dans `state.historyEvents` (type `'Commentaire'`), **aucun**
  nouveau tableau `state.orderComments` créé.
  ```js
  { orderId, type:'Commentaire', at:Clock.iso(), actorId:actor.id, actor:actor.name, detail:text }
  ```
- `addOrderComment(orderId, text, actingUserId)` : refuse une commande inconnue
  (`ORDER_NOT_FOUND`), un utilisateur sans la permission `orders.edit` (`FORBIDDEN`), ou un
  commentaire vide (`COMMENT_REQUIRED`) — garde-fou **moteur**, pas seulement UI (le bouton
  « Ajouter » du panneau reste en complément désactivé tant que le textarea est vide).
- `orderComments(orderId)` : dérive la liste triée **plus récent en premier**, jamais un second
  état à synchroniser.
- **Jamais confondu avec `order.workInstructions`** : ce champ reste réservé aux indications de
  fabrication/prescription initiale ; `addOrderComment()` ne le touche jamais (vérifié : COM05).
- **Fiche commande** : nouveau bloc « Commentaires » toujours visible (jamais caché dans un menu
  secondaire), liste des commentaires + bouton « + Ajouter un commentaire ». Après validation :
  `save()` (implicite dans `addOrderComment`), fermeture animée du panneau, rafraîchissement de la
  fiche, affichage immédiat du commentaire, toast « Commentaire ajouté ».
- **Historique métier** : les commentaires n'apparaissent pas comme étapes de `orderTimeline()`
  (qui reste dédiée à la traçabilité de production) — ils restent dans leur bloc dédié, tout en
  demeurant disponibles dans `state.historyEvents` (donc dans le Journal/Audit si besoin).
- **Bug de frontière IIFE** : aucun cette fois — `addOrderComment()` n'est appelée que par son
  propre gestionnaire de soumission (déjà interne à l'IIFE) ; seule `orderComments()` (lue par
  `_renderQuickView`, hors IIFE) a nécessité une exposition `window.orderComments=orderComments`,
  suivant la convention déjà établie (`window.currentBlockEvent`, `window.unblockOrder`).

## Partie B — Accueil : empty-state « À surveiller »

`renderWatch()` retournait une chaîne vide quand `getAttentionOrders({limit:3}).length===0`,
laissant le container visuellement vide. Corrigé avec un état positif centré (horizontalement ET
verticalement, hauteur intelligemment utilisée — `min-height:260px`, `flex` centré) :

- Cercle vert pastel 88×88px, icône check 44×44px (réutilise `icon('check')`, agrandi par CSS).
- Titre « Tout est sous contrôle ! » (24px, poids 850).
- Sous-texte gris centré « Aucune commande critique n'est à signaler pour le moment. ».
- Header conservé à l'identique : « À surveiller » + « Tout voir (0) ».
- Dès qu'une commande redevient à surveiller (retard/blocage/scan attendu), l'empty-state disparaît
  immédiatement — aucune logique supplémentaire, `renderWatch()` est réévaluée à chaque `render()`.
- Dark mode : badge avec fond `rgba(48,209,88,.16)` cohérent avec les autres pastilles vertes de
  l'application (`.pill.green` dark override).

## Partie C — Simulation : pulse ciblé

**Aucune modification** de `whatIfCalendarHTML()`, `scenarioWeekMetrics()`, `weekLoadStatus()` ou
`weekChargeToDeliver()` — uniquement un effet visuel transitoire ajouté par-dessus.

- `snapshotScenarioMetrics()` : capture `{weeks:[{i,status}], days:Set<dayKey>}` avant une action
  sur le scénario (`simulatedDayKeysNow()` — uniquement demandes testées + hypothèses, **jamais**
  les absences déjà approuvées, qui ne bougent pas quand le scénario change).
- `pulseScenarioChanges(before)` : après re-rendu, recalcule l'état actuel et compare : seules les
  semaines dont le `status` a réellement changé reçoivent `.sim-week-pulse` (sur `.chg-week-label`,
  ciblée via `data-week-idx`), seuls les jours entrés/sortis du scénario reçoivent `.sim-day-pulse`
  (ciblés via `data-day-key`, ajouté sur chaque cellule jour ouvré).
- Animation bornée à **3 itérations** (~0.5s chacune, ~1.5s total) — jamais `infinite` — puis
  nettoyage explicite de la classe par `setTimeout` (jamais un état visuel permanent).
- `@media (prefers-reduced-motion: reduce)` désactive l'animation CSS ; `reducedMotionActive()`
  (déjà existante depuis V3.8.6 Partie J) fait que `pulseScenarioChanges()` n'ajoute même aucune
  classe dans ce mode — le changement de couleur/bordure (déjà porté par `sim-real`/`sim-hyp`/
  `sim-planned` et la couleur du point de semaine) reste seul suffisant.
- Câblé sur les 4 points d'entrée qui modifient le scénario : tester/retirer une demande
  (`data-whatif-req`), supprimer une hypothèse (`data-whatif-remove`), réinitialiser
  (`#whatif-reset`), ajouter/modifier une hypothèse (`submitWhatifForm`).
- Retrait complet du scénario : si plus aucune simulation n'est active, le calendrier repasse à son
  état vide (« Aucune absence simulée ») — les cellules disparaissant avec lui, aucun pulse de
  sortie n'est alors possible ; comportement explicitement accepté par le mandat (§27, « ne pas
  complexifier le DOM inutilement »).

## Partie D — Absences planifiées : calendrier réutilisé

`renderPlanning()` affichait « Absences planifiées » sous forme de liste (`.abs-list`/`.abs-row`).
Remplacé par le même langage visuel que le calendrier Simulation, sans dupliquer de moteur.

- **`approvedAbsences()`** : source canonique unique des absences réellement validées —
  `state.absences` (déjà la source que `approveLeave()` alimente à chaque approbation, id
  `'AB-'+requestId`) **plus** tout `leaveRequests.status==='approved'` qui ne serait pas déjà
  représenté par une absence canonique (déduplication stricte par `userId`+`from`+`to` — cas réel
  du jeu de démo : `L3` duplique exactement `A1`, dédupliqué correctement, vérifié par ABS06-dedup).
  Jamais de demande `pending`, jamais d'hypothèse.
- **`leaveCalendarHTML({mode, weeks, leaves, showWeekStatus, animate})`** : renderer unique extrait
  de l'ancien `whatIfCalendarHTML()`, qui devient un thin wrapper
  `leaveCalendarHTML({mode:'simulation', leaves:simLeaves, showWeekStatus:true, animate:true})` —
  comportement V3.8.6 strictement identique (mêmes classes CSS, mêmes chaînes, vérifié par la
  suite de 313 tests hérités qui passe sans modification).
  - `mode:'approved'` (Absences planifiées) : uniquement `approvedAbsences()`, pas de légende
    (réservée au mode simulation), pas de statut de semaine (`showWeekStatus:false` — aucun point
    coloré), pas de `data-week-idx`/`data-day-key` (`animate:false` — aucun pulse automatique,
    conforme au mandat).
- **Design** : titre « Absences planifiées » + sous-titre « Congés et absences validés sur les 8
  prochaines semaines. », mois en majuscules (« SEPTEMBRE 2026 »), bordure + fond pastel + avatars
  (jusqu'à 3 puis « +N », réutilise `userColor()`/`userInitials()`) sur chaque jour concerné,
  tooltip au survol/clic identique au calendrier Simulation (« Nom / Absence planifiée /
  DD mois→DD mois »).
- **État vide** : « Aucune absence planifiée sur les 8 prochaines semaines. » si aucune absence
  validée dans l'horizon.
- **Nettoyage** : `.abs-list`/`.abs-row` (CSS) et `deleteAbsence()` + son gestionnaire de clic
  supprimés — devenus inutilisés une fois l'affichage liste retiré (permission explicite du
  mandat, §44). Le bouton « + Absence » (création) est conservé à l'identique.

## Partie E — Cohérence Charge (vérification, pas de changement moteur)

- **Horizon identique** : `leaveCalendarHTML()` utilise par défaut `weeks||planningWeeks(8)` —
  exactement la même fonction que la Projection et la Simulation (vérifié par ABS05, lecture du
  code source).
- **Pas de double déduction** : `netWeekCapacity(week)` intègre déjà `capacityLostInWeek()` sur
  `state.absences` — les absences approuvées sont donc **déjà** dans la capacité de base. Le
  scénario (`whatIfLeaves()`) n'ajoute jamais `state.absences` — uniquement les demandes pending
  testées et les hypothèses. Vérifié : sans scénario actif,
  `netWeekCapacity(week) === netWeekCapacity(week, whatIfLeaves())` (ABS06/ABS06b).

## Non-régression

- Les 317 tests V3.8.6 (incluant les 20 ajoutés en V3.8.6) sont conservés **sans modification** et
  passent tous.
- 18 nouveaux tests V3.8.7 ajoutés (COM01-05, HOME01-03, PULSE01-05, ABS01-06) — suite totale :
  **335/335 PASS**.
- `node --check` PASS sur les 5 blocs `<script>`.
- Responsive : 21/21 (7 largeurs × 3 modes). Thèmes : 18/18 (light/dark/system × 6 vues).
  Isolation : export JSON avant/après la suite complète identique octet pour octet.
- Zéro erreur console sur l'ensemble des scénarios testés.
