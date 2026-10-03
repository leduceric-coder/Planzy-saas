# DentalFlow V3.12.1.1 — Rapport d'implémentation

Hotfix **strictement confiné au kit de test laboratoire**, avant la 2e séance de recette. Base :
`dentalflow-test-labo-v3.12.1.html` (copié puis modifié). Produit `dentalflow-next-poc-v3.12.1.html` :
**jamais lu en écriture** — MD5 identique avant/après (`32ce4e69419d6bfae7d191c001d56b37`), `git diff` vide.

## PROBLEMES_CORRIGES

### Problème 1 — Session Scan contaminée par des valeurs de démonstration

**Cause racine** : la baseline du kit héritait telle quelle, sans y repenser, les valeurs par défaut du
moteur de démonstration natif (`scanStation:'Réception'`, `scanTechnician:'Marc'`) — pertinentes pour le seed
de démo du produit (où `'Marc'` existe bel et bien dans `demoUsers`), mais jamais adaptées à ce kit qui
exclut délibérément tout le personnel de démonstration. Conséquence : au premier `?mode=scan`, le testeur
voyait un poste qui ne nécessite aucun scan (Réception) et un technicien absent du personnel réellement
importé.

**Correctif** :

- `resolveDefaultScanTechnician()` (nouvelle fonction, kit uniquement, portée globale du script de base —
  même portée que `renderScanMode`/`can`/`userPermissions`, jamais dans le bloc IIFE « implementation » qui
  ne serait pas visible depuis le tout premier rendu) : filtre `state.users` sur `active!==false` et
  `production.scan`, préfère le rôle `PRODUCTION`, tri stable par id, retourne `null` explicitement si aucun
  candidat — jamais de repli silencieux vers un nom codé en dur.
- `resolveDefaultScannableStage()` : filtre `stageDefs()` (postes actifs) sur `scannable!==false`, préfère la
  phase `PRODUCTION`, retourne le premier poste trouvé par le filtrage réel — jamais `'STG-002'` supposé comme
  vérité absolue.
- `eligibleScanTechnicians()` : même filtrage que le premier, retourne la liste complète triée par nom, utilisée
  pour peupler le nouveau sélecteur Technicien.
- Un script additif, exécuté à **chaque démarrage normal** (même garde `isRunTestsMode` que le correctif
  `demoUsers` hérité de V3.12.1 — jamais sous `?runTests=1`), relit `state.scanStation`/`scanTechnicianId` et
  les corrige via ces deux résolveurs si invalides (poste absent/non scannable, technicien absent/non
  habilité) — idempotent, ne touche à rien si le testeur a déjà choisi un autre poste/technicien pendant sa
  séance.
- `renderScanMode()` réécrite : le champ Technicien devient un `<select>` peuplé uniquement par
  `eligibleScanTechnicians()` (nom complet affiché, id réel stocké dans `state.scanTechnicianId`) — jamais un
  champ texte libre pouvant introduire un nom inexistant. Si la liste est vide, le message exact
  *« Aucun membre du personnel autorisé à scanner n'est disponible. »* s'affiche et bloque le scan. Si le
  poste choisi n'est pas scannable, le message exact *« Ce poste ne nécessite pas de scan. Choisissez un
  poste de production. »* s'affiche **à la place de la zone de capture caméra/photo/saisie manuelle** — ces
  deux cas sont donc visibles **avant** toute tentative de photographie/décodage QR, jamais découverts
  seulement après coup.
- `processScanModeOrder()` réécrite : l'acteur du scan (`actorId` passé à `moveOrderToStage(...,
  {source:'SCAN', ...})`) est désormais **toujours** l'id réel choisi dans le sélecteur
  (`state.scanTechnicianId`) — plus aucune dépendance à `techIdByFirstName()` pour ce nouveau parcours (la
  fonction reste disponible ailleurs pour compatibilité historique, inchangée).
- Nouveau champ persistant `state.scanTechnicianId` (ajouté à `load()` et `serializableState()`, kit
  uniquement) pour que l'id réel du technicien survive à un F5/rechargement.

### Problème 2 — Session de recette sans les droits nécessaires

**Cause racine** : le compte connecté par défaut (Gaëtane DUIGOU, rôle `ADMINISTRATIF`) ne possède pas
nativement `production.manage`/`production.scan` (répartition de droits réelle et voulue pour ce rôle) —
limitation déjà documentée dans le README V3.12.1, mais bloquante pour une partie des scénarios de recette
sans préparation technique préalable par le testeur.

**Contraintes impératives respectées** : aucun employé réel transformé en Responsable, aucune permanence
ajoutée à `state.users`, aucun 14e utilisateur créé, mécanisme absent du produit.

**Correctif — `testSessionOverride`** (script additif, kit uniquement, placé après le bloc IIFE) :

```js
window.testSessionOverride = {
  enabled: true,
  mode: 'LAB_TEST',
  permissions: ['orders.view','orders.create','orders.edit','production.view','production.manage',
                'production.scan','stock.view','reports.view','cabinets.view']
};
```

La fonction `can(user, perm)` (moteur, portée globale) est enveloppée : elle retourne d'abord sa propre
réponse native (`userPermissions(user).includes(perm)`) ; si celle-ci est fausse, elle vérifie en complément
si `testSessionOverride.enabled` est vrai **et** si `user` est exactement l'utilisateur **actuellement
connecté** (`currentUser()`) **et** si le droit demandé figure dans la liste de l'override. Dans tous les
autres cas (y compris pour tout autre employé réel, même connecté temporairement), le comportement natif est
inchangé à l'identique.

Conséquences vérifiées :

- `state.users` et le tableau `permissions` de chaque utilisateur réel restent **strictement inchangés** (le
  mécanisme n'écrit jamais dans `state.users` — seule la fonction `can()` est augmentée en mémoire).
- Toutes les surfaces UI déjà gardées par `can(currentUser(), 'production.manage')` (glisser-déposer en
  Production, panneaux « Changer la localisation », bouton « Marquer comme livrée », etc.) se débloquent
  automatiquement, sans aucune duplication de garde-fou.
- `?runTests=1` : le script additif (comme celui hérité de V3.12.1) retourne immédiatement sans jamais
  définir `testSessionOverride` ni envelopper `can()` — la suite de tests interne du moteur s'exécute sur son
  seed natif, strictement inchangée.

**Règle d'attribution d'acteur** (ajoutée directement dans `moveOrderToStage()`, kit uniquement) : pour un
déplacement `MANUAL` sans acteur explicitement fourni par l'appelant (cas de toutes les interactions UI
existantes — glisser-déposer, panneaux de changement de localisation), si l'acteur résolu (`currentUser()`)
ne possède **pas nativement** `production.manage` (vérifié via `userPermissions()`, qui ignore l'override —
jamais `can()`), l'action n'est **jamais** attribuée fictivement à cet employé réel : le `LocationEvent`
porte `actorId:null, actorName:'Session test laboratoire'`. Un scan reste toujours attribué au technicien
réellement sélectionné dans la session Scan (acteur toujours explicite, jamais résolu via `currentUser()`) —
les deux notions ne sont jamais confondues.

## CLES_LOCALSTORAGE

Nouvelles clés dédiées, jamais partagées avec le kit V3.12.1 ni avec le produit :
`dentalflow-test-labo-v31211-state-v1` et `dentalflow-test-labo-v31211-cabinet-patients-v1`. Le fichier
V3.12.1.1 démarre donc systématiquement depuis sa propre baseline au premier lancement, quelle que soit la
présence d'un ancien localStorage V3.12.1 ou du produit sur le même navigateur (vérifié, voir TEST_REPORT).

## PERIMETRE_NON_TOUCHE

- `dentalflow-next-poc-v3.12.1.html` : jamais modifié.
- Les 10 commandes fictives (CMD-0205 à CMD-0214) : identifiants et répartition préservés à l'identique.
- Le questionnaire utilisateur (`v2.2.html`) : aucune dépendance technique avec les écrans modifiés par ce
  lot — laissé strictement inchangé.
- Aucune entité supplémentaire (cabinet, dentiste, utilisateur, prestation, fournisseur, article) n'a été
  ajoutée où que ce soit ; le stock reste strictement identique.

## Décision finale

**`READY_FOR_SECOND_LAB_TEST`**

Justification : les deux problèmes bloquants (session Scan contaminée par des valeurs de démonstration,
compte de recette sans droits suffisants) sont corrigés exclusivement dans le kit, vérifiés par des tests
ciblés ET par interaction navigateur réelle (clics véritables, jamais une assignation `.value=`) — voir
`DENTALFLOW_V3_12_1_1_TEST_REPORT.md` pour le détail complet des résultats. Le produit
`dentalflow-next-poc-v3.12.1.html` reste strictement inchangé (MD5 identique, `git diff` vide) tout au long de
ce travail. La non-régression complète du kit (suite interne 468/468 ×3, NAVDOM 31/31, UI CLICK 16/16,
CABUX01-10, DATA01-15, REC01-06, FLOW01-09, CABFLOW01-06, MIGFLOW01-05, SEL01-05, CABSEL01-02, CABTEETH01-02,
EDIT01-04, DATE01-04, QR01-03/05, confidentialité P1-P6) est confirmée sur le kit hotfixé lui-même, 0 erreur
console relevée sur l'ensemble des runs. Seule réserve inchangée depuis V3.12.1 : QR04 (caméra réelle sur
smartphone) reste à vérifier physiquement lors de la séance — voir README pour la procédure HTTPS privée.
