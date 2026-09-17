# Rapport — Kanvix V2.8.4.1 · Commandes Undo / Redo persistantes

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.4.1.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.4.html`
**Recette dédiée** : `recette-undo-redo-ui-v2.8.4.1.mjs` — **38 / 38 PASS**, **0 erreur console**
**Captures** : `recette-v2.8.4.1/` (9 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## 1. Le problème UX de V2.8.4

Le moteur retenait **20 actions**, mais l'utilisateur ne découvrait Undo que par le toast — lequel
disparaît au bout de **4 secondes**. Passé ce délai, une fonctionnalité pleinement disponible
devenait invisible.

## 2. Trois niveaux, un seul moteur

| Niveau | Moyen | Rôle |
|---|---|---|
| 1 | **Toast** | raccourci **immédiat**, inchangé |
| 2 | **Boutons ↶ / ↷** | moyen **permanent** — la nouveauté |
| 3 | **Clavier** | moyen **expert**, gelé |

Les trois appellent **le même `undo()` et le même `redo()`** de V2.8.4. FREEZE-2841 le vérifie :
une seule définition de chacun, et les boutons les appellent directement.

## 3 → 5. Emplacement

Un composant commun, `historyControls()`, inséré en **cinq points** — jamais copié-collé :

| Point d'insertion | Pages couvertes |
|---|---|
| `header()` | Opérations, Chantiers, Ressources, Charge, Documents, Photos, Réglages, Impact |
| `.planning-header .actions` | Planning |
| `.op-head-actions` | fiche Opération |
| `.today-hero` | Aujourd'hui |
| ligne du lien retour | fiche Chantier |

L'ordre est toujours **historique → filet → actions de la page**. Sur le Planning :

```
[ ↶ ][ ↷ ] │ [ Exporter PDF ] [ + Tâche ]
```

Sur **mobile**, les commandes restent dans l'en-tête de page, en gabarit réduit (32px). La
navigation basse est **intacte** : rien n'y a été ajouté.

## 6. Mode Chantier — une absence structurelle

Les commandes n'y apparaissent pas, et **aucune règle CSS ne les masque**. `renderField()` remplace
la page entière et n'appelle aucun des cinq en-têtes porteurs : l'absence est **structurelle**.

> J'avais d'abord écrit `body.field-mode .history-controls { display: none }`. Vérification faite,
> la classe du Mode Chantier est `field-body` — la règle ne s'appliquait à rien. Plutôt que de la
> corriger, je l'ai **supprimée** : elle aurait laissé croire à un masquage volontaire là où le
> mécanisme est autre. **UIUR-30** mesure `0` commande et vérifie que le toast Annuler y reste
> pleinement fonctionnel.

## 7. États actif / inactif

`disabled` réel dès que la pile correspondante est vide : opacité 0,42, pas de hover trompeur, non
focusable. **Aucun badge** n'affiche la profondeur.

## 8 → 11. Libellés et invariants

Deux piles parallèles, **hors de `app`** :

```js
let undoLabels = [], redoLabels = [];
```

`pushHistory(stack, state, labels, label)` empile et dépile **état et libellé ensemble** — y compris
quand la limite fait partir le plus ancien. L'invariant
`undoHistory.length === undoLabels.length` (et son symétrique) est vérifié **aux 33 étapes** du
scénario UIUR-12.

**Aucune phrase n'est inventée** : `actionToast()` réutilise le texte déjà transmis comme libellé de
la transaction. Zéro point d'appel réécrit.

```js
if (undoableSinceToast && undoLabels.length)
  undoLabels[undoLabels.length - 1] = String(s);
```

La garantie `undoableSinceToast` de V2.8.4 est donc **respectée** : un toast d'action externe ne
vient jamais nommer une transaction antérieure (**UIUR-18**).

Le libellé **voyage avec la transition** — ce qu'on annule est ce que Redo rétablira :

```
après A, B, C  → Annuler : Chantier modifié
1 Undo         → Annuler : Ressource modifiée · Rétablir : Chantier modifié
2 Undo         → Annuler : Tâche modifiée    · Rétablir : Ressource modifiée
```

Libellés de repli : **« Dernière modification »** pour Undo, **« Modification annulée »** pour Redo.
Jamais `undefined`, `null` ni `[object Object]`.

## 12 → 14. Limite, branche, invalidation

- **Limite 20** : `undoHistory` et `undoLabels` plafonnent ensemble (**UIUR-11**).
- **Nouvelle branche** : `snapshot()` vide `redoHistory` **et** `redoLabels` (**UIUR-10**).
- **`invalidateRedo()`** et **`clearUndoRedo()`** vident les piles de libellés correspondantes.
- **Import échoué** : le checkpoint couvre désormais les **quatre** piles — **UIUR-23** vérifie
  qu'elles sont strictement identiques avant/après, branche Redo comprise.

## 15. Reset, restauration, synchronisation

Après réinitialisation, restauration d'une sauvegarde ou adoption d'un état externe, les **quatre**
piles sont vides et **les deux boutons désactivés** (**UIUR-19 → UIUR-21**).

## 16. Persistance

Les libellés sont aussi éphémères que les états : ni dans `app`, ni dans `localStorage`, ni dans la
sauvegarde, ni dans l'export (**UIUR-34**, **UIUR-35**). `SCHEMA_VERSION` **12 → 12**, `STORE`
inchangé, aucune migration.

## 17. Accessibilité

`<button type="button">` avec `aria-label`, `title` dynamique, `disabled` réel et focus visible. Le
groupe porte `role="group"` et `aria-label="Historique des modifications"`. **UIUR-32** : le bouton
actif prend le focus et s'active à Entrée ; le bouton désactivé n'est ni focusable ni activable.

## 18 → 19. Responsive et thème sombre

**Dix formats de 1920 à 390px** : commandes présentes, **aucun débordement horizontal**
(**UIUR-29**). En sombre, le bouton actif est lisible et le désactivé s'en distingue nettement
(**UIUR-31**).

## 20. Tests UIUR-01 → UIUR-35

**38 / 38 PASS, 0 erreur console applicative.**

Deux cas méritent d'être cités.

**UIUR-14 — le test critique.** Plus de 4 secondes après une mutation, le toast a disparu ; le
bouton ↶ reste **actif** et annule bel et bien. Le toast n'est plus le seul chemin.

**UIUR-15 — le relais complet.** Trois actions dont tous les toasts ont expiré s'annulent une par
une, et les boutons **re-rendus** portent le bon libellé à chaque tour :

```json
["Annuler : Chantier modifié — Ctrl+Z",
 "Annuler : Ressource modifiée — Ctrl+Z",
 "Annuler : Tâche modifiée — Ctrl+Z"]   puis Undo désactivé
```

## 21. Rejeu de la recette V2.8.4

**61 / 62.** L'unique écart est `FREEZE-284`, qui gèle deux fonctions que ce lot devait
nécessairement toucher :

| Fonction | Pourquoi |
|---|---|
| `pageToday` | reçoit `historyControls()` dans son hero |
| `icon` | reçoit les deux glyphes SVG `undo` et `redo` |

**Les 61 autres assertions passent — soit la totalité des comportements Undo/Redo UR-01 → UR-56.**
Conformément à la PARTIE 26, la recette historique **n'a pas été modifiée** : l'assertion équivalente
vit dans `FREEZE-2841`, qui gèle 61 fonctions et déclare `pageToday`, `icon`, `header`,
`renderOperation` et `renderProject` comme autorisées.

## 22. Baselines

| Suite | V2.8.4 | V2.8.4.1 | Écart |
|---|---|---|---|
| `recette-jalons-statuts-v2.8.3.1.mjs` | 28 / 29 | 28 / 29 | **aucun** |
| `recette-frise-jalons-v2.8.3.1.mjs` | 41 / 42 | 41 / 42 | **aucun** |
| `recette-operations-v2.8.0.mjs` | 70 / 71 | 70 / 71 | **aucun** |
| `recette-prochain-jalon-v2.8.3.2.mjs` | 26 / 27 | 25 / 27 | 1 — feuille de style |

Le seul écart supplémentaire est l'assertion « la feuille de style entière est BYTE-IDENTIQUE », que
j'avais écrite pour V2.8.3.2 — un lot purement sémantique. V2.8.4.1 ajoute légitimement le CSS des
deux boutons. **La frise elle-même est intacte** : les assertions de composition (squelette DOM,
dimensions, synthèse) passent toutes.

**Aucun écart métier.**

## 23. Non-régression historique

35 suites, chacune exécutée deux fois (V2.8.4 puis V2.8.4.1), copies isolées hors dépôt —
**0 fichier suivi par git modifié**.

**0 nouvel échec.** Les compteurs d'échecs sont **identiques suite par suite**, et les rares
différences de texte portent sur des chronomètres ou sur la valeur mesurée d'assertions **déjà
rouges** avant ce lot.

### Un point de vigilance traité en cours de route

Ma première implantation plaçait les commandes de la fiche Chantier dans la ligne de badge du
cockpit. Résultat mesuré : **442px → 451px** de hauteur de cockpit. L'assertion `CHT-141-03`
(cible ≤ 430px) était **déjà rouge** avant ce lot, donc ce n'était pas une régression au sens strict
— mais aggraver une métrique déjà hors cible n'est pas acceptable.

Les commandes ont été déplacées sur la **ligne du lien retour**, quasi vide. Mesure après
correction :

```
V2.8.4   : cockpit 394px, 0 commande
V2.8.4.1 : cockpit 394px, 1 groupe de commandes
```

**Pas un pixel de hauteur gagné**, et `recette-correctif-ui-v2.4.14.1` repasse à verdicts
strictement identiques.

## 24. Byte-identité

```json
FREEZE-2841 : {"gelés":61,"bougés":[]}
FREEZE-2841-périmètre : {"modifiées":["snapshot","undo","redo","pushHistory","clearUndoRedo",
  "invalidateRedo","actionToast","historyToast","applyImportNow","header","icon","render"],
  "ajoutées":["historyControls","refreshHistoryControls","historyControlsState","historyLabelFor"]}
```

**61 fonctions byte-identiques**, dont `cloneHistoryState()`, `restoreHistoryState()`,
`isTextEditingTarget()`, `save()`, `migrateState()`, `applyStorageSync()`, `resetApp()`,
`buildKanvixBackup()`, `confirmKanvixRestore()`, et **tous** les moteurs métier : Planning, Jalons,
Qualité, Ressources, Conflits, Opérations, Simulation, Reflow, Reprise, Mode Chantier.

Les fonctions modifiées le sont **uniquement** pour synchroniser les libellés et rafraîchir l'UI.
Quatre helpers d'exposition ajoutés, plus les trois en-têtes de page porteurs (`pageToday`,
`renderOperation`, `renderProject`).

```json
FREEZE-2841-runtime : {"labels":true,"pasDansApp":true,"unSeulMoteur":true,"boutonsAppellent":true}
```

## 25. Console

**0 erreur JavaScript applicative.**

---

## Réponse à la question finale

> *Kanvix propose-t-il désormais un Undo/Redo classique et permanent, avec deux commandes ↶ / ↷
> permettant de remonter et redescendre plusieurs actions successives, tout en conservant les toasts
> immédiats, les raccourcis clavier et le moteur atomique V2.8.4, sans alourdir l'interface ni
> introduire un second moteur ?*

**OUI**, et les dix critères sont vérifiés séparément :

1. Le toast n'est plus le seul moyen visuel — UIUR-01, UIUR-24.
2. Bien après l'expiration du toast, Undo reste accessible — **UIUR-14**.
3. Plusieurs clics ↶ remontent les actions — UIUR-08, UIUR-15.
4. Plusieurs clics ↷ les restaurent — UIUR-08.
5. Les boutons indiquent la disponibilité par un `disabled` réel — UIUR-02, UIUR-03.
6. L'infobulle nomme l'action concernée — UIUR-04, UIUR-06, UIUR-09.
7. Toast, toolbar et clavier passent par le même moteur — FREEZE-2841, `unSeulMoteur`.
8. Aucune vérité métier parallèle : les libellés ne sont que des textes de toast réutilisés.
9. Deux boutons au gabarit des boutons secondaires, sans badge ni barre nouvelle.
10. V2.8.4 reste intacte : 61 fonctions gelées, 61 / 62 de sa recette, 0 nouvel échec au balayage.
