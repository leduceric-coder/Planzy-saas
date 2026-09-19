# KANVIX V2.12.0.1 — CONDITIONS DE DÉMARRAGE
## Fermer le contournement via l'éditeur universel

**Source** `public/poc/kanvix-next-gen-v2.12.0.html`
**Livrable** `public/poc/kanvix-next-gen-v2.12.0.1.html` — 31 441 lignes (+77)
**Recette dédiée** `recette-conditions-demarrage-v2.12.0.1.mjs` — **40 / 40**
**Captures** `recette-v2.12.0.1/` — 4 PNG + `resultats.json` (**40** enregistrés, **40** annoncés)
**Sweep historique** 59 recettes — **RESTE : 0**
**SCHEMA_VERSION** 15 (inchangé) · **STORE** `kanvix-product-8-3` (inchangé)
**Erreurs JavaScript applicatives** **0**, recette dédiée et sweep complet

Patch correctif. Aucune fonctionnalité produit nouvelle, aucune fonction
ajoutée, aucun octet de style ou de données modifié.

---

## 1 · Le bug, REPRODUIT avant d'être corrigé

La règle du round V2.12.0 est qu'une intervention ne passe jamais silencieusement
« À faire » → « En cours » lorsqu'elle porte une condition de démarrage
**bloquante** non satisfaite. Cinq chemins la respectaient. Un sixième la
contournait.

Le test **FIXPRQ-01** joue le scénario sur **V2.12.0**, par le **vrai formulaire** :
`openTaskEdit('k-windows')`, clic sur le **vrai** bouton « En cours » du segment
`.te-status-seg`, puis **vrai** `submit` de `#taskEditForm`.

| Mesure | V2.12.0 |
|---|---|
| L'intervention est-elle prête ? | `ready: false`, 1 condition bloquante « Livraison des fenêtres » |
| Modale « Conditions non confirmées » | **non ouverte** |
| Statut après soumission | **`doing`** |
| Historique « démarrée malgré … » | **absent** |

Le contournement est donc **mesuré**, pas supposé. Il porte sur la totalité du
parcours : la tâche démarre, et le fait métier n'est même pas tracé.

### Cause technique exacte

`submitTaskEdit()` confie le changement de statut au moteur central en mode
transactionnel :

```js
setTaskStatus(st.id, status, "manual-edit", { transactional: true, manual: true })
```

et `setTaskStatus()` ouvre sur :

```js
let silent = opts.transactional === true,
```

La garde V2.12.0 est posée sous `!silent` :

```js
if (status === "doing" && !silent && !opts.forcePrerequisites
    && !taskStartReadiness(id).ready) { … }
```

`transactional: true` ⇒ `silent === true` ⇒ **la garde n'est jamais atteinte par
ce chemin.**

Ce n'est pas un oubli de conception : `!silent` est là pour que le moteur
n'ouvre pas un **second** snapshot au milieu de la transaction de l'éditeur.
C'est exactement la même tension que V2.8.5.2 avait déjà rencontrée pour le
démarrage réel et les jours non ouvrés — et la même réponse s'imposait.

---

## 2 · La correction retenue

Un **pré-vol** dans `submitTaskEdit()`, posé **avant le snapshot**, **avant toute
mutation**, et **avant** la confirmation calendrier de V2.8.5.2 :

```js
let prqDemarrage = statusChanged && status === "doing" && before.status !== "done",
  prqBloquantes = prqDemarrage ? taskStartReadiness(st.id).blocking : [],
  prqSignature  = prqBloquantes.map((p) => p.id).join(","),
  prqOk = taskEditPrerequisiteAck
       && taskEditPrerequisiteAck.id === st.id
       && taskEditPrerequisiteAck.status === status
       && taskEditPrerequisiteAck.signature === prqSignature;
if (prqDemarrage && prqBloquantes.length && !prqOk) {
  askPrerequisiteStartConfirm(st.id, "manual-edit", {
    onPrerequisiteDecision: (forcees) => {
      taskEditPrerequisiteAck = { id: st.id, status, signature: prqSignature, forcees };
      submitTaskEdit();
    },
  });
  return;
}
```

Trois propriétés, chacune mesurée :

1. **Aucune règle métier n'est recopiée.** L'éditeur *interroge*
   `taskStartReadiness()` et s'arrête là. Il ne mentionne ni
   `prerequisiteIsSatisfied`, ni `prerequisiteEffectiveStatus`, ni
   `taskTopPrerequisite`, ni `PREREQ_STATUS`, ni `PREREQ_PRIORITY`, et ne touche
   jamais `app.prerequisites`. Mesuré sur le source par FREEZE-21201.
2. **La modale est celle du produit.** `askPrerequisiteStartConfirm()` n'a
   toujours qu'**une** définition dans tout le fichier.
3. **Le fait métier reste écrit par le moteur.** L'éditeur *transmet* la
   décision ; il ne réécrit pas l'entrée d'historique.

### La reprise

`confirmPrerequisiteStart()` gagne une seule bifurcation — le même idiome que
`calendarConfirm({ onConfirm })` que le produit utilise déjà :

```js
if (d.opts && typeof d.opts.onPrerequisiteDecision === "function")
  return d.opts.onPrerequisiteDecision(forcees);
```

Quand l'appelant tient déjà une transaction — c'est le cas, et **le seul**, de
l'éditeur universel — la décision lui est **rendue** ; c'est lui qui appellera le
moteur, dans sa propre transaction. Partout ailleurs, aucune transaction n'est
ouverte et le parcours reste rigoureusement celui de V2.12.0.

### La transmission

```js
let statusOutcome = statusChanged
  ? setTaskStatus(st.id, status, "manual-edit", {
      transactional: true, manual: true,
      ...(prqForcees ? { forcePrerequisites: true, forcedPrerequisites: prqForcees } : {}),
    })
  : null;
```

Le bloc qui écrit « Intervention démarrée malgré N conditions non confirmées. »
dans `setTaskStatus()` n'est **pas** sous `!silent` : il se déclenche donc
normalement pour l'éditeur. **Aucune ligne de `setTaskStatus()` n'a été touchée.**

### L'acquittement

`taskEditPrerequisiteAck`, déclaré à côté de `taskEditConfirmAck`, avec la même
nature et la même durée de vie :

- **local au module**, jamais rangé dans `app` — donc jamais persisté, jamais
  sauvegardé, jamais exporté ;
- **consommé** à la validation, au même endroit et dans le même geste que
  l'accusé du calendrier ;
- **détruit avec le formulaire** — `clearTaskEditAck()` le remet à `null`, et
  cette fonction est appelée par `closeOverlay('drawer')` ;
- **signé** : il porte `taskId`, le statut demandé **et** les identifiants des
  conditions bloquantes acceptées. Un accord donné dans un contexte ne peut donc
  pas être rejoué dans un autre — si une condition est ajoutée, supprimée ou
  confirmée entre-temps, la signature change et la question est reposée.

---

## 3 · Pourquoi la garde centrale n'a pas été déplacée

Trois raisons, et la première suffit.

**Elle fait correctement son travail.** Cinq chemins sur six passent par elle et
sont protégés. Le sixième est une **exception transactionnelle**, pas une faille
de la garde.

**La déplacer casserait la transaction unique.** Si la garde s'exécutait aussi
en mode `silent`, elle ouvrirait sa modale au milieu de `submitTaskEdit()` —
c'est-à-dire soit après le `snapshot()` (et alors « Annuler » laisserait une
transaction orpheline), soit avant, mais en rendant la main à un appelant qui
croit être en train d'écrire. Le résultat serait deux snapshots, deux Undo, et un
éditeur dont on ne saurait plus dire à quel moment il a muté.

**Le produit a déjà tranché ce cas.** V2.8.5.2 a rencontré exactement ce
problème pour le démarrage réel et les jours non ouvrés, et a choisi le pré-vol
dans l'éditeur. Suivre cette architecture, c'est avoir **un** motif à comprendre
dans le fichier, au même endroit, plutôt que deux.

FREEZE-21201 le mesure : `setTaskStatus()` est **byte-identique** entre V2.12.0
et V2.12.0.1.

---

## 4 · Une seule transaction, un seul Undo

**FIXPRQ-14** joue le geste composé exigé par le §10 : modifier le nom,
l'intervenant, les dates **et** le statut, démarrer malgré une condition, puis
confirmer le repositionnement réel.

| | |
|---|---|
| Snapshots créés | **1** |
| Après Undo | nom, intervenant, dates **et** statut rendus ensemble ; `undoHistory` revenu à 0 |
| Conditions | inchangées de bout en bout |
| Après Redo | le geste entier rejoué, d'un seul coup |

Il n'existe **aucun** Undo propre aux conditions de démarrage.

`submitTaskEdit()` ne contient toujours qu'**un seul** appel à `snapshot()`, et
le fichier qu'**un seul** `setTaskStatus()` — mesuré.

### Rien n'est écrit entre les deux décisions

**FIXPRQ-08** mesure l'état **entre** la modale des conditions et la modale du
calendrier : statut, nom, intervenant, date, `undoHistory` et `app.history` sont
**identiques** à l'état initial. Il n'y a pas de snapshot intermédiaire.

---

## 5 · Les conditions ne sont jamais auto-confirmées

**FIXPRQ-10**, après « Démarrer quand même » **et** confirmation calendrier :

```
Livraison des fenêtres  → pending    confirmedDate: null
Accès zone façade       → confirmed  confirmedDate: 2026-08-15T16:30  (inchangée)
```

Rigoureusement l'état d'avant. Aucune condition ne devient `confirmed`, aucune
`confirmedDate` n'est renseignée automatiquement.

---

## 6 · L'historique du démarrage forcé est conservé

**FIXPRQ-11** — après le parcours complet depuis l'éditeur, `app.history`
contient exactement :

```
Intervention démarrée malgré 1 condition non confirmée.
Pose fenêtres — lot 2 · statut modifié manuellement : À faire → En cours
```

Une entrée, écrite par `setTaskStatus()`. Le nombre d'incidents est inchangé :
aucun incident artificiel n'est créé.

FREEZE-21201 mesure que le gabarit qui produit cette phrase
(`` `Intervention démarrée malgré ${…}` ``) n'existe qu'**une fois** dans tout le
fichier, qu'il est **dans `setTaskStatus()`**, et qu'il n'est **pas** dans
`submitTaskEdit()`. Une seule définition de l'événement métier.

---

## 7 · Annuler ne change rien, et ne fait rien perdre

**FIXPRQ-05 / FIXPRQ-06** :

| | |
|---|---|
| Statut, nom, conditions | strictement inchangés |
| `undoHistory`, `app.history`, `app.issues` | inchangés |
| Accusé mémorisé | **aucun** — `taskEditPrerequisiteAck === null` |
| Éditeur | toujours ouvert |
| Champ « nom » | **« Saisie à conserver »** — la saisie de l'utilisateur est là |
| Statut choisi | toujours « En cours », segment actif compris |

L'utilisateur ne perd pas son formulaire.

---

## 8 · L'ordre des deux décisions, et le parcours nominal

**FIXPRQ-07 / FIXPRQ-08 / FIXPRQ-09** — le parcours attendu par le §13 :

```
Éditeur
 → « Conditions non confirmées »        (décision 1)
 → « Démarrer quand même »
 → « Démarrer cette tâche maintenant ? » (décision 2, V2.8.5.1)
 → confirmation
 → UNE transaction finale
```

**FIXPRQ-12** — une condition **non bloquante** non satisfaite n'ouvre pas la
modale des conditions ; seule la question calendrier ordinaire se pose. La règle
de V2.12.0 est inchangée.

**FIXPRQ-13** — quand toutes les conditions bloquantes sont satisfaites,
V2.12.0.1 produit un résultat **identique caractère pour caractère** à V2.12.0 :
même modale, même statut, même nom, même repositionnement, même nombre de
snapshots, même historique. Comparaison faite en rejouant le scénario sur les
deux builds.

---

## 9 · Les cinq autres chemins n'ont pas bougé

**FIXPRQ-15** rejoue le même scénario sur les **deux builds** et compare :

| Chemin | V2.12.0 | V2.12.0.1 |
|---|---|---|
| Fiche tâche | modale « Conditions non confirmées », statut `todo` | identique |
| Kanban | modale, statut `todo` | identique |
| Mode Chantier (conducteur, 390 px) | bloc « 1 / 2 confirmées » + Confirmer / Bloqué / Gérer | identique |
| Artisan « Je commence » | modale, statut `todo` | identique |
| Appel ordinaire, tâche prête | aucune modale, statut `doing` | identique |

La comparaison porte sur la sérialisation complète des cinq relevés : elle est
égale. La garde centrale reste leur moteur.

---

## 10 · Fonctions réellement modifiées

Balayage md5 fonction par fonction de **tout le fichier** :

| Fonction | Ce qui change |
|---|---|
| `submitTaskEdit()` | le pré-vol des conditions, la consommation de l'accusé, la transmission de la décision au moteur |
| `confirmPrerequisiteStart()` | une bifurcation : rendre la décision à l'appelant qui tient une transaction |
| `clearTaskEditAck()` | remet aussi le nouvel accusé à `null` |

**Fonctions ajoutées : aucune.** Ce correctif n'introduit pas un moteur, pas même
un helper. La seule déclaration nouvelle est la variable de module
`taskEditPrerequisiteAck`.

`renderAIPanel` apparaît comme modifiée à l'extraction par accolades — c'est le
faux positif connu (elle contient des littéraux de gabarit) ; mesurée par bloc
borné à l'indentation, elle est **identique**.

**87 moteurs nommément gelés, tous byte-identiques** — dont `setTaskStatus()`,
`askPrerequisiteStartConfirm()`, `realStartPlan()`, `calendarConfirm()`, toute la
couche métier des conditions, `cloneStructureTree()`, `applyTemplateToProject()`,
`buildProjectTemplateRecord()`, `migrateState()`, `planReflow()`,
`ensureTaskControlInstances()`, `blockingControlsForTask()`, le Kanban, le
Backup, l'Import et l'Undo/Redo.

**Style et données** : feuille de style, `INITIAL_STATE`, `PREREQ_TYPES`,
`KANVIX_BACKUP_REQUIRED` et `KANVIX_APP_BUILD` **byte-identiques**.
**SCHEMA_VERSION reste 15. STORE reste `kanvix-product-8-3`.** Aucune migration.

Taille du correctif : **+77 lignes nettes** — 83 lignes ajoutées, 6 remplacées.

---

## 11 · Recette dédiée

`recette-conditions-demarrage-v2.12.0.1.mjs` — **40 / 40**, **0 erreur console**.

Le décompte affiché et `recette-v2.12.0.1/resultats.json` annoncent tous deux
**40**. L'assertion « zéro erreur console » est désormais posée **avant** la
ligne de résultat ; en V2.12.0 elle venait après, ce qui affichait 101 alors que
le fichier en enregistrait 102. **La même correction a été appliquée à la recette
V2.12.0**, qui annonce et enregistre maintenant **102** l'une comme l'autre.

| Famille | Contenu |
|---|---|
| FIXPRQ-01 | le bug reproduit sur V2.12.0, par le vrai formulaire |
| FIXPRQ-02 → 04 | la modale s'ouvre ; tâche, snapshots, historique, incidents, contrôles et conditions strictement inchangés pendant |
| FIXPRQ-05 → 06 | Annuler : rien écrit, aucun accord mémorisé, formulaire conservé |
| FIXPRQ-07 → 11 | l'enchaînement complet, rien entre les deux décisions, conditions intactes, historique du démarrage forcé, accusés consommés |
| FIXPRQ-12 | une condition non bloquante n'interrompt rien |
| FIXPRQ-13 | tout satisfait : comportement identique à V2.12.0, mesuré sur les deux builds |
| FIXPRQ-14 | une transaction, un Undo, un Redo |
| FIXPRQ-15 | les cinq autres chemins, comparés build à build |
| FIXPRQ-RESP | 20 combinaisons + conservation du minimum tactile |
| FREEZE-21201 | périmètre, architecture, données |

Le test principal passe par `openTaskEdit()`, les **vrais** champs de
`#taskEditForm` — `fill` sur le nom, `change` sur le `<select>` des ressources,
`click` sur le segment de statut — et le **vrai** `submit`. Aucun appel direct à
`setTaskStatus()` : c'est précisément ainsi que l'anomalie était passée.

---

## 12 · Responsive

**FIXPRQ-RESP** — 10 largeurs (1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430,
390) × clair / sombre, soit **20 combinaisons**, sur l'éditeur, la modale
« Conditions non confirmées » **et** son enchaînement vers la confirmation
calendrier.

Aucun défilement horizontal, aucun débordement de la modale, aucun bouton coupé.

**Minimum tactile.** Le §19 demande qu'il soit *conservé*. Il l'est : à 430 et
390 px, les actions de la modale mesurent **exactement** ce qu'elles mesuraient
en V2.12.0 — 36 px ouvertes depuis la fiche tâche, 38 px lorsque la side-window
de l'éditeur est ouverte dessous —, mesuré en rejouant le relevé sur les deux
builds. Ces boutons sont ceux de `.pop-actions .btn`, partagés par **toutes** les
modales de Kanvix ;
les porter à 44 px serait un changement de style global, donc un changement UX
non nécessaire (§25) qui romprait par ailleurs l'identité byte à byte de la
feuille. **Signalé ici comme caractéristique préexistante, hors périmètre de ce
correctif.** À l'intérieur de la side-window des conditions, les actions
respectent bien les 44 px (règle `@media (max-width: 620px)` de V2.12.0).

Captures : `01-editeur-conditions-light.png`, `02-enchainement-calendrier-light.png`,
`03-enchainement-390-light.png`, `04-enchainement-1440-dark.png`.

---

## 13 · Sweep historique

**59 recettes** rejouées contre `v2.12.0.1`.

| | |
|---|---|
| `ECHECS_REFERENCE_V2120` | **262** |
| `ECHECS_V21201` | **262** |
| **RESTE** | **0** |

Jeu d'échecs identique, ligne à ligne, à celui de V2.12.0. **Aucune dette
historique n'a été traitée dans ce round.**

La recette `recette-conditions-demarrage-v2.12.0.mjs`, qui devient historique,
est rejouée sur le build courant : **104 / 104**. Rejouée sur son propre build,
elle reste à **102 / 102**.

Erreurs JavaScript applicatives sur l'ensemble du sweep : **0** — 33 des 59
recettes publient explicitement leur compteur, et les 33 sont à zéro ; aucune des
26 autres n'en signale.

---

## 14 · Re-pointages — 9 recettes, une seule cause

`submitTaskEdit()` figurait dans les moteurs **gelés** et dans les **balayages de
périmètre** de neuf recettes. Le correctif la modifie — pour y poser le pré-vol
que la garde centrale ne pouvait pas atteindre. Le contrat que ces gels
mesuraient (« cette fonction ne bouge pas ») est donc réellement devenu obsolète,
et pour une raison **unique et nommée**.

| Recette | Contrat | Re-pointage |
|---|---|---|
| `conditions-demarrage-v2.12.0` | `FREEZE-2120` gel + balayage | `rebaseV21201 = ['submitTaskEdit']` ; `attenduesRoundsSuivants` reçoit les trois fonctions du correctif |
| `modeles-chantier-v2.11.0` | `FREEZE-2110` | `rebaseV21201` + `attenduesV21201` |
| `modeles-chantier-v2.11.0.1` | `FREEZE-2110`, `FREEZE-21101` | idem (2 balayages) |
| `modeles-chantier-v2.11.0.2` | + `FREEZE-21102` | idem (3 balayages) |
| `modeles-chantier-v2.11.0.3` | + `FREEZE-21103` | idem (4 balayages) |
| `structure-compacte-v2.9.1` | `FREEZE-291`, `STC-50` | idem |
| `structure-operationnelle-v2.10.0` | `FREEZE-2100`, `DUP-28` | idem |
| `structure-rework-v2.10.0.1` | `FREEZE-21001` | idem (gel `nommes`) |
| `structure-ux-v2.9.0.1` | `FREEZE-2901` | `submitTaskEdit` rejoint la liste `rebaseV291` existante |

**Les listes restent fermées** : une fonction non nommée fait toujours tomber le
test. Et le contrôle « les fonctions du round ont **réellement** changé » reste
strictement celui de la recette concernée : `attenduesV21201` est **tolérée par le
balayage seul**, jamais par la vérification de périmètre propre au round.

Le motif est écrit dans le code de chacune des neuf recettes.

Aucune assertion n'a été supprimée. Aucune n'a été affaiblie. Ce que
`submitTaskEdit()` cesse d'être vérifiée ici, elle l'est **plus finement** par
FREEZE-21201, qui la nomme, exige qu'elle ait réellement changé, et mesure ce
qu'elle contient — un seul `snapshot()`, aucune règle métier recopiée, aucune
réécriture du fait métier.

---

## 15 · Critères de fin (§26)

| Critère | État |
|---|---|
| le bug est reproduit sur V2.12.0 | ✅ FIXPRQ-01 |
| le bug est impossible sur V2.12.0.1 | ✅ FIXPRQ-02 |
| l'éditeur demande la décision avant toute mutation | ✅ FIXPRQ-03, FIXPRQ-04 |
| Annuler ne change rien | ✅ FIXPRQ-05 |
| Démarrer quand même fonctionne | ✅ FIXPRQ-09 |
| les confirmations calendrier continuent de fonctionner | ✅ FIXPRQ-08, FIXPRQ-13 |
| une seule transaction | ✅ FIXPRQ-14 |
| un seul Undo restaure le geste complet | ✅ FIXPRQ-14 |
| aucune condition auto-confirmée | ✅ FIXPRQ-10 |
| l'historique du démarrage forcé existe | ✅ FIXPRQ-11 |
| les autres chemins de démarrage sont inchangés | ✅ FIXPRQ-15 |
| recette dédiée 100 % verte | ✅ **40 / 40** |
| RESTE = 0 | ✅ |
| erreurs JS applicatives = 0 | ✅ |
| clair / sombre / mobile validés | ✅ 20 combinaisons |

---

## 16 · Défauts trouvés pendant le round

Deux, tous deux dans la recette, tous deux corrigés avant livraison.

1. **Une assertion mesurait de la prose.** `pasDHistoriqueRecopie` testait
   l'absence de la chaîne « démarrée malgré » dans `submitTaskEdit()` — et
   tombait sur **mon propre commentaire**, qui cite la phrase. Réécrite pour
   mesurer le **gabarit** qui produit le fait (`Intervention démarrée malgré ${`),
   son unicité dans le fichier et sa présence dans `setTaskStatus()` : strictement
   plus fort que la formulation d'origine.
2. **Une assertion inventait une exigence au lieu de la conserver.** J'exigeais
   44 px sur les boutons de la modale ; ils font 36 à 38 px, à l'identique sur les
   deux builds, parce que ce sont ceux de toutes les modales du produit. Le §19
   demande la *conservation* : l'assertion mesure désormais l'égalité entre
   V2.12.0 et V2.12.0.1, et le rapport documente ces hauteurs comme
   caractéristique préexistante hors périmètre.

---

## 17 · Livrables

| Fichier | |
|---|---|
| `public/poc/kanvix-next-gen-v2.12.0.1.html` | le POC complet, 31 441 lignes |
| `recette-conditions-demarrage-v2.12.0.1.mjs` | FIXPRQ-01 → FIXPRQ-15, FIXPRQ-RESP, FREEZE-21201 — **40 / 40** |
| `RAPPORT-V2.12.0.1-CONDITIONS-DEMARRAGE.md` | ce document |
| `recette-v2.12.0.1/` | 4 captures + `resultats.json` |
| 9 recettes historiques | re-pointées, motif dans le code |
