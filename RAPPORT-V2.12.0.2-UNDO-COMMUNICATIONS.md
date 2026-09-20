# KANVIX V2.12.0.2 — UNDO / REDO ET COMMUNICATIONS

**Source** `public/poc/kanvix-next-gen-v2.12.0.1.html`
**Livrable** `public/poc/kanvix-next-gen-v2.12.0.2.html` — 31 498 lignes (+56)
**Recette dédiée** `recette-undo-communications-v2.12.0.2.mjs` — **40 / 40**
**Résultats** `recette-v2.12.0.2/resultats.json` — **40** enregistrés, **40** annoncés
**Sweep historique** 60 recettes — **RESTE : 0**
**SCHEMA_VERSION** 15 (inchangé) · **STORE** `kanvix-product-8-3` (inchangé)
**Erreurs JavaScript applicatives** **0**, recette dédiée et sweep complet

Patch de sécurité fonctionnelle. **Une** fonction modifiée, **un** helper pur
ajouté, **aucune** modification d'interface, **aucune** donnée persistée
nouvelle.

---

## 1 · Le défaut, REPRODUIT avant d'être corrigé

Le scénario signalé par Astra, joué par le **workflow produit réel** —
`openConversation()` puis `sendConversationMessage()`, avec le vrai champ du
composer et le vrai brouillon photo :

1. une transaction métier ordinaire (renommage d'une tâche) → le produit prend
   son snapshot ;
2. **après** cette transaction, deux communications réelles sont émises, dont
   une avec photo jointe ;
3. l'utilisateur annule la transaction.

| Mesure après Undo | V2.12.0.1 |
|---|---|
| Message sans photo | **effacé** |
| Message avec photo | **effacé** |
| Photo jointe au message | **effacée** |
| Tâche | correctement restaurée |

Le défaut est **mesuré** (UNDOCOM-01), pas supposé : une opération de planning
supprimait des communications émises ensuite.

### Cause technique exacte

`cloneHistoryState()` fait `structuredClone(app)` : le snapshot emporte donc
`app.messages` et `app.photos` dans leur état **d'alors**. Et
`restoreHistoryState()` réinstallait l'état **en entier** :

```js
function restoreHistoryState(state) {
  app = state;          // ← app.messages et app.photos reviennent à leur état d'alors
  app.undoStack = [];
  save();
  render();
}
```

Tout ce qui avait été ajouté à ces deux collections depuis la prise du snapshot
était donc perdu — y compris ce qui ne relevait pas du tout de la transaction
annulée.

### Le cas du Redo, mesuré lui aussi

Le scénario « transaction → Undo → message → Redo » (§11) ne perdait **déjà
pas** de message en V2.12.0.1 — mais pour une autre raison : les deux points
d'envoi appellent `invalidateRedo()`, qui coupe la branche Redo. `redo()` rend
alors `false` et ne restaure rien.

**Ce contrat n'a pas été touché** (§16). UNDOCOM-10 le mesure sur les deux
builds et constate un comportement rigoureusement identique. Le correctif ne le
remplace pas : il fait simplement que la préservation ne repose plus sur ce seul
rempart. La règle est désormais vraie par construction dans les deux sens,
parce qu'elle est posée au point de restauration commun.

---

## 2 · La correction

Une règle, posée une fois, à l'endroit **unique** où un état est réinstallé.

```js
function restoreHistoryState(state) {
  app = preserveCommunications(state, app.messages, app.photos);
  app.undoStack = [];
  save();
  render();
}
```

`undo()` et `redo()` passent tous les deux par là : **la symétrie est acquise
par construction**, il n'y a rien à dupliquer dans l'un ni dans l'autre. Les
deux fonctions sont **byte-identiques** à V2.12.0.1, et ne mentionnent ni
messages, ni photos, ni le helper — mesuré (UNDOCOM-20).

### Le helper — pur, et une UNION

```js
function preserveCommunications(state, messagesCourants, photosCourantes) {
  if (!state || !Array.isArray(state.messages) || !Array.isArray(messagesCourants))
    return state;
  let messages = state.messages,
    vus = new Set(messages.map((m) => m && m.id)),
    apparus = messagesCourants.filter((m) => m && !vus.has(m.id));
  if (!apparus.length) return state;
  let photos = Array.isArray(state.photos) ? state.photos : [],
    connues = new Set(photos.map((p) => p.id)),
    rattachees = [];
  apparus = structuredClone(apparus);
  apparus.forEach((m) => {
    if (!m.photoId || connues.has(m.photoId)) return;
    let ph = (photosCourantes || []).find((p) => p.id === m.photoId);
    if (!ph) return;
    connues.add(m.photoId);
    rattachees.push(structuredClone(ph));
  });
  state.messages = messages.concat(apparus);
  if (rattachees.length) state.photos = photos.concat(rattachees);
  return state;
}
```

Il ne lit ni n'écrit `app` : il reçoit les collections courantes et rend l'état
à installer. Mesuré, commentaires retirés avant le test (UNDOCOM-19).

---

## 3 · La règle, énoncée précisément

### Messages

**Ce qui est apparu depuis le snapshot est AJOUTÉ à ce que l'état restauré
contient déjà.** Une union, identifiée par `id`, jamais un remplacement.

La doctrine n'est pas inventée pour ce round : le produit l'énonce déjà à
chaque point d'envoi — *« un message envoyé est une communication : il n'est
jamais rappelé par un Undo local »*. V2.12.0.2 la rend vraie.

**Seule l'EXISTENCE d'un message est sanctuarisée, pas son contenu.** Un message
présent des deux côtés garde la version du **snapshot** : son contenu appartient
au domaine transactionnel. UNDOCOM-12ter le mesure sur le drapeau `read`.

### Photos rattachées à un message

Les photos que les messages **ajoutés** référencent par `photoId` sont
réinjectées, et elles seules. Une photo déjà présente dans l'état restauré n'est
jamais ajoutée une seconde fois : **aucun doublon d'identifiant, aucune
référence cassée** (UNDOCOM-04 → 07).

### Photos NON rattachées à un message

**Elles restent pleinement annulables.** C'est le point que le correctif se
refuse à déborder : la galerie photo ne devient pas un domaine hors-Undo.

UNDOCOM-12 le mesure sur le geste réel : `snapshot()` puis `addPhoto()`. Après
Undo, la photo **disparaît**, l'entrée d'historique **disparaît**, et aucune
référence cassée ne subsiste.

### Brouillons

Un brouillon de composer n'est pas dans `app.messages` : il n'est donc **pas**
concerné (§14, UNDOCOM-14).

---

## 4 · Le piège que le sweep a révélé

La première implémentation suivait à la lettre le pseudo-code du cadrage :
`state.messages = currentMessages`. Elle passait les treize premiers tests —
et **cassait IMP-22**, une assertion de `recette-import-intelligent-v2.4.9.1` :

> « Undo restaure exactement projets / tâches / jalons / alertes / décisions /
> photos / messages / documents / historique »

Cause : un import « remplacer les chantiers » **vide** `app.messages`. Au moment
de l'Undo, la collection courante est vide — et un remplacement par la
collection courante rendait **zéro** message au lieu des deux que le snapshot
contenait. Mesuré :

| | V2.12.0.1 | première implémentation | livrée |
|---|---|---|---|
| messages après Undo d'un remplacement total | 2 | **0** | 2 |

La règle correcte est celle que le §2 du cadrage énonce — « les messages envoyés
après le snapshot sont conservés » —, c'est-à-dire une **union**, et non le
remplacement que suggérait le pseudo-code du §6. Le correctif a été repris en
conséquence, et le cas a rejoint la recette sous **UNDOCOM-12bis**, mesuré sur
les deux builds.

C'est une assertion historique qui a attrapé l'erreur, et elle n'a pas été
re-pointée : elle est **verte** sur V2.12.0.2 comme elle l'était sur V2.12.0.1.

---

## 5 · Conséquence assumée : le message d'information d'`addPhoto()`

`addPhoto()` pose, quand `notify` est vrai et qu'une tâche est rattachée, un
message d'information « Photo terrain ajoutée. ». Ce message est enregistré dans
`app.messages` : c'est donc une communication au sens de la règle.

| Après l'Undo d'un ajout de photo terrain | V2.12.0.1 | V2.12.0.2 |
|---|---|---|
| La photo | disparaît | **disparaît** |
| L'entrée d'historique | disparaît | **disparaît** |
| Le message « Photo terrain ajoutée. » | disparaît | **reste** |

C'est **le seul changement de comportement du round en dehors du défaut
corrigé**. Il découle directement de la doctrine que le produit énonce
lui-même, il ne laisse **aucune référence cassée** (ce message ne porte pas de
`photoId`), et il est **mesuré et nommé** dans la recette plutôt que découvert
plus tard. Aucune recette historique ne le contredit : le sweep est à RESTE 0.

---

## 6 · Undo et Redo continuent de faire leur travail

UNDOCOM-17 / UNDOCOM-18, sur une transaction qui touche nom, dates,
intervenant et historique, avec une communication émise après :

| | |
|---|---|
| Undo | nom, début, intervenant restaurés ; entrée d'historique de la transaction retirée |
| Redo | tout rétabli à l'identique |
| Communication | conservée dans les deux sens |

**Aucune entrée d'historique artificielle** n'est créée par la préservation
(§15, UNDOCOM-16) : envoyer un message n'écrit rien dans `app.history`, et le
correctif n'invente aucun événement « message préservé ».

---

## 7 · Résultats UNDOCOM-01 → 23

| Test | Objet | État |
|---|---|---|
| UNDOCOM-01 | défaut reproduit sur V2.12.0.1 | ✅ |
| UNDOCOM-02 | transaction → message → Undo : message conservé | ✅ |
| UNDOCOM-03 | idem avec photo jointe | ✅ |
| UNDOCOM-04 | la photo liée est conservée | ✅ |
| UNDOCOM-05 | `message.photoId` reste résolvable | ✅ |
| UNDOCOM-06 | aucun message dupliqué | ✅ |
| UNDOCOM-07 | aucune photo dupliquée | ✅ |
| UNDOCOM-08 | messages antérieurs au snapshot présents | ✅ |
| UNDOCOM-09 | trois messages postérieurs survivent, total exact | ✅ |
| UNDOCOM-10 | transaction → Undo → message → Redo | ✅ (et identique à V2.12.0.1) |
| UNDOCOM-11 | photo liée conservée après Redo | ✅ |
| UNDOCOM-12 | photo non liée : comportement historique | ✅ |
| UNDOCOM-12bis | union, et non remplacement | ✅ |
| UNDOCOM-12ter | seule l'existence est sanctuarisée | ✅ |
| UNDOCOM-13 | messagerie conducteur ↔ artisan | ✅ |
| UNDOCOM-14 | `taskId` conservé · brouillon non sanctuarisé | ✅ |
| UNDOCOM-15 | `projectId` conservé | ✅ |
| UNDOCOM-16 | aucune entrée `app.history` artificielle | ✅ |
| UNDOCOM-17 | Undo restaure toujours la tâche | ✅ |
| UNDOCOM-18 | Redo restaure toujours la tâche | ✅ |
| UNDOCOM-19 | un seul `restoreHistoryState()`, helper pur | ✅ |
| UNDOCOM-20 | aucune logique de fusion dans `undo()` / `redo()` | ✅ |
| UNDOCOM-21 | `SCHEMA_VERSION === 15` | ✅ |
| UNDOCOM-22 | STORE inchangé, migration et backup gelés | ✅ |
| UNDOCOM-23 | 0 erreur JS applicative | ✅ |

**40 assertions, 40 vertes.** Le décompte affiché et `resultats.json`
annoncent tous deux **40**.

Les messages passent par le **workflow produit réel** dans tous les tests :
`openConversation()` + `sendConversationMessage()` côté bureau, et le vrai
`submit` du composer `.chat-compose` côté artisan. Aucun test ne pousse
directement dans `app.messages`.

---

## 8 · FREEZE-21202 — le périmètre, mesuré

| | |
|---|---|
| Fonctions **modifiées** | `restoreHistoryState()` — et elle seule |
| Fonctions **ajoutées** | `preserveCommunications()` — et elle seule |
| Moteurs gelés vérifiés | **85**, tous byte-identiques |

Byte-identiques, nommément : `snapshot()`, `undo()`, `redo()`,
`cloneHistoryState()`, `pushHistory()`, `clearUndoRedo()`, `invalidateRedo()`,
`historyToast()`, `actionToast()` — tout l'Undo/Redo hors restauration ; les
deux points d'envoi de messages, `openConversation()`, `conversationMessages()`,
`artisanMessageBubbles()`, `renderArtisan()` ; `addPhoto()`, `addFieldPhoto()`,
`capturePhoto()`, `viewPhoto()` ; le Planning, les Tâches, les Conditions de
démarrage, la Structure, les Modèles, les Ressources, la Qualité, le Kanban, la
Sauvegarde et l'Import/Export.

`renderAIPanel` apparaît comme modifiée à l'extraction par accolades — faux
positif connu (littéraux de gabarit) ; mesurée par bloc borné à l'indentation,
elle est **identique**.

---

## 9 · Preuve qu'aucune interface n'a changé

Mesuré sur le fichier, pas affirmé :

| | |
|---|---|
| Feuille de style `<style id="kanvix-css">` | **byte-identique** |
| Balisage `<body>` … `<script>` | **byte-identique** |
| `INITIAL_STATE` | **byte-identique** |
| `KANVIX_APP_BUILD` | inchangé |

Aucun bouton, aucun toast, aucune side-window, aucun écran mobile, aucun jeton
de thème sombre n'a bougé : le diff est entièrement contenu dans la zone
Undo/Redo du script.

---

## 10 · Schéma et stockage

| | |
|---|---|
| `SCHEMA_VERSION` | **15**, inchangé |
| `STORE` | **`kanvix-product-8-3`**, inchangé |
| Migration | aucune |
| `migrateState()`, `buildKanvixBackup()`, `validateKanvixBackup()`, `confirmKanvixRestore()` | **byte-identiques** |
| Collection ou champ persistant nouveau | **aucun** — la règle ne s'appuie sur aucun marqueur en base |

---

## 11 · Sweep historique

**60 recettes** rejouées contre `v2.12.0.2`.

| | |
|---|---|
| `ECHECS_REFERENCE_V21201` | **262** |
| `ECHECS_V21202` | **262** |
| **RESTE** | **0** |

Jeu d'échecs identique, ligne à ligne, à celui de V2.12.0.1. **Aucune dette
historique n'a été traitée dans ce round.**

Les recettes dédiées des rounds précédents, devenues historiques, sont rejouées
sur le build courant : `conditions-demarrage-v2.12.0` → **104 / 104**,
`conditions-demarrage-v2.12.0.1` → **40 / 40**.

Erreurs JavaScript applicatives sur l'ensemble du sweep : **0** — 34 des 60
recettes publient explicitement leur compteur, et les 34 sont à zéro ; aucune
des 26 autres n'en signale.

---

## 12 · Re-pointages — 14 recettes, une seule cause

`restoreHistoryState()` figurait dans les moteurs **gelés** et dans les
**balayages de périmètre** de quatorze recettes. Le correctif la modifie, pour
une raison **unique et nommée**.

| Recette | Contrat | Re-pointage |
|---|---|---|
| `conditions-demarrage-v2.12.0` | `FREEZE-2120` gel + balayage | `rebaseV21202` ; `attenduesRoundsSuivants` reçoit `restoreHistoryState` |
| `conditions-demarrage-v2.12.0.1` | `FREEZE-21201` gel + balayage + « aucune fonction ajoutée » | `rebaseV21202` ; `attenduesRoundsSuivants` reçoit les deux fonctions, **sans relâcher** les deux contrôles propres à ce round |
| `modeles-chantier-v2.11.0` / `.1` / `.2` / `.3` | `FREEZE-2110`, `21101`, `21102`, `21103` | `rebaseV21202` + `attenduesV21202` (1 à 4 balayages selon la recette) |
| `structure-compacte-v2.9.1` | `FREEZE-291`, `STC-50` | idem |
| `structure-operationnelle-v2.10.0` | `FREEZE-2100`, `DUP-28` | idem |
| `structure-rework-v2.10.0.1` | `FREEZE-21001` | idem (gel `nommes`) |
| `structure-ux-v2.9.0.1` | `FREEZE-2901` | `rebaseV21202` |
| `structure-projet-v2.9.0` | `FREEZE-290` | `rebaseV21202` |
| `planning-calendrier-realite-v2.8.5.1` | `FREEZE-2851` | `rebaseV21202` |
| `planning-draw-create-v2.8.5` | `FREEZE-285` | `rebaseV21202` |
| `planning-edition-v2.8.5.2` | `FREEZE-2852` | `rebaseV21202` |

**Les listes restent fermées** : une fonction non nommée fait toujours tomber le
test. Et les contrôles « les fonctions du round ont réellement changé » et
« ce round n'a ajouté aucune fonction » restent strictement ceux de chaque
recette : `attenduesV21202` est tolérée **par le balayage seul**.

**`recette-import-intelligent-v2.4.9.1` n'a PAS été re-pointée.** Son assertion
IMP-22 a attrapé une erreur réelle dans la première implémentation ; c'est le
correctif qui a été repris, pas le test. Elle est verte sur les deux builds.

Aucune assertion n'a été supprimée. Aucune n'a été affaiblie. Ce que
`restoreHistoryState()` cesse d'être vérifiée dans ces quatorze recettes, elle
l'est **plus finement** par FREEZE-21202, qui la nomme, exige qu'elle ait
réellement changé, et mesure ce qu'elle contient.

Le motif est écrit dans le code de chacune des quatorze recettes.

---

## 13 · Défaut trouvé dans la recette, corrigé avant livraison

Une assertion mesurait de la prose. `helperPur` testait l'absence de `app` dans
le texte du helper — et tombait sur **mon propre commentaire**, qui mentionne
« app.messages » dans une phrase. Réécrite pour retirer les commentaires avant
le test : elle mesure désormais le **code**, ce qui est strictement plus fort.

---

## 14 · Livrables

| Fichier | |
|---|---|
| `public/poc/kanvix-next-gen-v2.12.0.2.html` | le POC complet, 31 498 lignes |
| `recette-undo-communications-v2.12.0.2.mjs` | UNDOCOM-01 → 23 + FREEZE-21202 — **40 / 40** |
| `RAPPORT-V2.12.0.2-UNDO-COMMUNICATIONS.md` | ce document |
| `recette-v2.12.0.2/resultats.json` | 40 résultats, 0 erreur console |
| 14 recettes historiques | re-pointées, motif dans le code |
