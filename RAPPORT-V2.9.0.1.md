# Rapport — Kanvix V2.9.0.1 · Correctif UX ciblé Structure

**Fichier livré** : `public/poc/kanvix-next-gen-v2.9.0.1.html` (27 925 lignes)
**Source** : `public/poc/kanvix-next-gen-v2.9.0.html` (27 878 lignes)
**Recette dédiée** : `recette-structure-ux-v2.9.0.1.mjs` — **57 / 57 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.9.0.1/` — 6 captures + `resultats.json`, menu **ouvert** sur les cinq captures de menu
**Branche** : `claude/kanvix-next-gen-poc-im084x`

**Aucune évolution fonctionnelle.** Trois fonctions modifiées, aucune règle métier
touchée, **97 moteurs byte-identiques** à V2.9.0. `SCHEMA_VERSION` reste 13,
`STORE` reste `kanvix-product-8-3`, `KANVIX_APP_BUILD` reste inchangé.

---

## 1. Cause exacte de l'anomalie A — le menu « … » qui part ailleurs

Deux bugs distincts, dans la **même ligne** de `structureNodeMenu()` :

```js
`<div class="more-wrap"><button class="icon-btn" aria-label="Actions" …>…</button>`
```

### A1 — Le popover s'ancrait n'importe où : `more-wrap` n'existe pas

`.more-pop` est déclaré `position: absolute`. Un élément en position absolue se
place par rapport à son **premier ancêtre positionné**. Le composant Kanvix
fonctionne parce que `.more-menu` fournit précisément cet ancêtre :

```css
.more-menu { position: relative; display: inline-flex; }
```

Or `more-wrap` **n'apparaît dans aucune règle CSS du fichier** — j'ai vérifié :
zéro occurrence en feuille de style. Sans `position: relative`, le navigateur
remontait jusqu'au premier conteneur positionné trouvé plus haut dans la page, et
c'est **lui** qui servait de repère. D'où un menu ouvert à plusieurs centaines de
pixels de son bouton, d'autant plus visible que la ligne était basse dans la
liste — le décalage est proportionnel à la distance entre la ligne et ce
conteneur lointain.

Effet de bord du même défaut : le listener global de fermeture ne voyait pas ce
menu, puisqu'il teste `.more-menu` :

```js
document.addEventListener("click", (e) => {
  if (!e.target.closest(".more-menu")) closeDrawerMenu();
});
```

### A2 — Le bouton était un bouton natif : `icon-btn` seul ne sélectionne rien

La règle Kanvix est `.btn.icon-btn`, **pas** `.icon-btn`. Un élément portant
uniquement `class="icon-btn"` ne correspond à aucun sélecteur : il tombait donc
sur le rendu natif du navigateur — le petit carré gris signalé. S'y ajoutait le
caractère brut `…` au lieu de l'icône `icon("more")` utilisée partout ailleurs.

### Correctif

Retour au composant éprouvé, **à l'identique** de ceux de l'Opération, du
Chantier, de la Ressource et de la Tâche :

```js
`<div class="more-menu" onclick="event.stopPropagation()"><button class="btn more-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Actions du niveau" onclick="event.stopPropagation();toggleDrawerMenu(this)">${icon("more")}</button>` +
`<div class="more-pop" role="menu">` +
  … `role="menuitem"` sur les quatre actions, `.more-sep` avant l'action dangereuse …
```

Les quatre actions, leurs libellés, leur ordre et leurs handlers
(`openStructureForm`, `toggleStructureArchive`, `confirmDeleteStructure`,
`closeDrawerMenu`) sont **strictement inchangés**.

### Mesure, avant / après

| | V2.9.0 | V2.9.0.1 |
|---|---|---|
| Ancêtre de positionnement du popover | un conteneur de page | **son propre `.more-menu`** |
| Écart vertical bouton → menu | des centaines de pixels | **6 px** (la gouttière du composant) |
| Alignement à droite sur le bouton | non garanti | **0 px d'écart** |
| Rendu du déclencheur | carré natif du navigateur | **43 × 33, marge 8/13 px, rayon 8 px** |

Le déclencheur Structure est désormais **pixel pour pixel** celui d'une fiche
Ressource, d'une Tâche et d'une Opération — vérifié propriété par propriété
(fond, bordure, style de bordure, rayon, hauteur, largeur, marge intérieure,
couleur, taille de police), à 1600 px comme à 390 px.

> Note : le menu d'une **carte chantier** mesure 30 × 30. Ce n'est pas la norme
> générale mais une exception assumée et documentée dans le CSS
> (`.site-menu .more-trigger`), pour une pastille blanche translucide posée sur
> une photo. La norme du produit est bien 43 × 33.

---

## 2. Le retournement vertical — mesuré nécessaire, puis mesuré inoffensif

La consigne était claire : corriger d'abord l'ancrage, tester le dernier élément
d'une longue liste, et **n'ajouter un flip que s'il sort réellement du viewport**.

**J'ai mesuré, avant de décider.** Avec l'ancrage seul corrigé, sur une liste de
18 niveaux, le popover du dernier niveau dépassait le bas de la fenêtre de :

| Largeur | 1440×900 | 1280×800 | 430×900 | 390×844 | 360×740 |
|---|---|---|---|---|---|
| Débordement bas | **+165 px** | **+165 px** | **+168 px** | **+167 px** | **+169 px** |

Le flip était donc nécessaire, sur **toutes** les largeurs.

### Le mécanisme, minimal

Deux propriétés inversées sur le composant **existant** — pas un second
composant, pas un second moteur :

```css
.more-pop.drop-up { top: auto; bottom: calc(100% + 6px); }
.more-pop.drop-up.open { animation: morePopUp 0.14s ease; }
```

et cinq lignes dans `toggleDrawerMenu()`, **après** l'ouverture (avant, la
hauteur du popover vaut zéro) :

```js
pop.classList.remove("drop-up");
let r = btn.getBoundingClientRect(), h = pop.offsetHeight;
if (r.bottom + 6 + h > innerHeight && r.top - 6 - h > 0) pop.classList.add("drop-up");
```

### Oui, `toggleDrawerMenu()` a été modifié — et voici pourquoi c'était la bonne décision

La consigne autorisait cette modification « si nécessaire ET après tests de non-
régression sur les autres menus ». Les deux conditions sont remplies :

* **Nécessaire** : les mesures ci-dessus. La seule alternative aurait été un
  ouvreur propre à Structure — c'est-à-dire **un second moteur de menu**,
  explicitement interdit.
* **Inoffensif, et mesuré** : la classe n'est posée **que** si le menu déborde
  réellement. Pour les quatre menus existants, ouverts là où ils vivent, la
  mesure donne `dropUp: false` dans tous les cas — leur rendu est donc
  strictement celui de V2.9.0.

| Menu | Ouvert | `drop-up` | Écart au bouton | Alignement | Hors viewport | Actions |
|---|---|---|---|---|---|---|
| Chantier | ✅ | **false** | 6 px | 0 px | −307 px | 2 |
| Ressource | ✅ | **false** | 6 px | 0 px | −65 px | 4 |
| Tâche | ✅ | **false** | 6 px | 0 px | −43 px | 5 |
| Opération | ✅ | **false** | 6 px | 0 px | −63 px | 3 |

Et le mécanisme n'est pas un correctif déguisé réservé à Structure : dans une
fenêtre volontairement basse (560 px), le menu **Chantier** se retourne lui aussi
et reste dans le viewport, ancré à 6 px de son bouton. Le comportement est
générique, comme il doit l'être.

`closeDrawerMenu()` n'a **pas** été touchée — elle reste byte-identique, ce que la
recette vérifie explicitement. Une classe `drop-up` résiduelle sur un popover
fermé est invisible (`display: none`) et recalculée à chaque ouverture : aucune
raison de modifier la fermeture.

---

## 3. Fermeture du menu — rien n'a été réinventé

Aucune logique nouvelle. Les comportements Kanvix existants s'appliquent
désormais **enfin** au menu Structure, parce que le wrapper est redevenu un
`.more-menu` reconnu par les listeners globaux. Vérifié :

| Comportement | Résultat |
|---|---|
| Un seul `.more-pop` ouvert simultanément | ✅ |
| Ouvrir un second menu ferme le premier | ✅ (`aria-expanded` repasse à `false`) |
| Cliquer une action ferme le menu | ✅ |
| Cliquer ailleurs ferme le menu | ✅ (listener global existant) |
| `Échap` ferme le menu | ✅ (comportement existant, tous les `aria-expanded` à `false`) |

> Observation au passage, qui n'est **pas** un défaut : un popover ouvert
> recouvre les trois lignes situées en dessous de lui. C'est le comportement
> normal d'un popover, identique à celui des menus Opération, Chantier et
> Ressource. Ma première version de test cliquait sur un bouton ainsi recouvert,
> ce qui échouait à juste titre ; le test a été corrigé, pas le produit.

---

## 4. Cause exacte de l'anomalie B — « ← Structure » en bouton natif

```js
`<button class="back-link" onclick="closeStructureNode()">← Structure</button>`
```

`.back-link` ne pose que deux propriétés de disposition :

```css
.back-link { display: inline-block; margin-bottom: 6px; }
```

C'est `.link` qui retire le chrome natif du bouton et donne la couleur de lien.
Tous les autres retours du produit portent les **deux** classes :

```js
`<button class="link back-link" onclick="goOperations()">← Opérations</button>`      // Opération
`<button class="link project-back-link" onclick="go('sites')">← Chantiers</button>`  // Chantier
`<button class="link back-link" onclick="go('team')">← Équipe</button>`              // Ressource
```

Le retour Structure était le seul à ne porter que `back-link`. Un mot manquant.

### Correctif et vérification

`class="link back-link"`. Le rendu est désormais mesuré **identique** à celui de
« ← Chantiers » : même couleur, même bordure (`0px`), même fond (transparent),
même taille et graisse de police. `closeStructureNode()` est conservé à
l'identique, et un vrai clic referme bien la fiche pour revenir à l'arbre.

---

## 5. Mobile — 430 / 390 / 360

Sur les trois largeurs exigées, avec une liste longue et le menu du **dernier**
niveau ouvert :

| Largeur | Popup dans le viewport | Écart au bouton | Bouton | Chevauche le statut | Modal ? | Hauteur des actions | Débordement page |
|---|---|---|---|---|---|---|---|
| 430 | ✅ (−207 px) | 6 px | 43 × 33 | non | non | 38 px | −15 px |
| 390 | ✅ (−206 px) | 6 px | 43 × 33 | non | non | 38 px | −15 px |
| 360 | ✅ (−207 px) | 6 px | 43 × 33 | non | non | 38 px | −15 px |

Le menu s'ouvre vers le haut (autorisé par la consigne), reste un **petit
popover contextuel** — ni modal, ni sidewindow —, ses actions font 38 px de haut
donc restent confortablement touchables, et le bouton est exactement le
déclencheur standard du produit.

> J'avais d'abord écrit l'assertion « largeur ≤ 40 px ». Le bouton mesure 43 px.
> Plutôt que de desserrer le seuil, j'ai remplacé ce nombre inventé par la seule
> référence qui veut dire quelque chose : **le déclencheur standard du produit**.
> S'il est identique à celui d'une fiche Ressource, il est compact exactement
> comme lui — et n'a, par construction, rien d'un bouton carré natif.

---

## 6. Thème sombre

Le popover hérite intégralement des variables de thème : fond
`rgb(16, 32, 47)` (luminance 0,12), texte `rgb(238, 244, 249)` (luminance 0,95),
action dangereuse `rgb(242, 104, 109)`. **Aucune couleur codée en dur** dans la
carte Structure ni dans son menu (0 occurrence). L'ancrage est identique en
sombre — le correctif est structurel, pas cosmétique.

---

## 7. Responsive — 11 largeurs × 2 thèmes

22 combinaisons (1920, 1600, 1440, 1280, 1080, 1024, 900, 768, 430, 390, 360 ×
clair/sombre), liste longue, menu du dernier niveau ouvert :

* **Débordement horizontal de la page : −15 px partout** (aucun).
* **Popup hors viewport : jamais** (−44 à −54 px de marge selon la largeur).

---

## 8. Résultats des recettes

| Recette | Contre | Résultat |
|---|---|---|
| `recette-structure-ux-v2.9.0.1.mjs` | V2.9.0.1 | **57 / 57**, 0 erreur console |
| `recette-structure-projet-v2.9.0.mjs` | **V2.9.0** (natif) | **80 / 80**, 0 erreur console |
| `recette-structure-projet-v2.9.0.mjs` | **V2.9.0.1** | **80 / 80**, 0 erreur console |
| 49 recettes historiques | V2.9.0.1 | **`RESTE : 0`** |

La recette Structure de V2.9.0 passe **sans la moindre modification** contre le
build corrigé : le correctif ne touche à rien de ce qu'elle protège.

### Les recettes historiques

49 recettes rejouées contre V2.9.0.1, comparées assertion par assertion au
référentiel V2.9.0 :

```
ECHECS V2.9.0.1 : 262   |   ECHECS RÉF V2.9.0 : 262
RESTE : 0
```

Deux échecs sont apparus au premier passage, **exactement les deux attendus** :
les seules recettes du dépôt qui gèlent `toggleDrawerMenu()`.

| Recette | Assertion | Cause | Catégorie | Action |
|---|---|---|---|---|
| `recette-correctifs-v2.4.15.3.mjs` | ENGINES-1513 | `toggleDrawerMenu` a reçu le retournement vertical | **Contrat obsolète** | Sortie de la liste de gel, **remplacée par une exigence plus forte** (ci-dessous) |
| `recette-correctifs-v2.4.15.4.mjs` | ENGINES-1514 | idem | **Contrat obsolète** | idem |

**Aucune régression produit.** Et la re-baseline ne laisse pas un trou : à la
place du gel, chaque recette vérifie maintenant que la fonction ne diffère **que**
par le flip —

```js
const sansFlip = (src) => src
  .replace(/\/\* V2\.9\.0\.1[\s\S]*?\*\//g, '')
  .replace(/pop\.classList\.remove\("drop-up"\);/g, '')
  .replace(/let r = btn\.getBoundingClientRect\(\),[\s\S]*?pop\.classList\.add\("drop-up"\);/g, '')
  .replace(/\s+/g, ' ').trim();
```

Le bloc retiré, `toggleDrawerMenu()` redevient **byte-identique** à la fonction
telle qu'elle existe, inchangée, depuis V2.4.15.2 (empreinte normalisée
`beaed823`, identique en V2.4.15.2, V2.4.15.3, V2.9.0 et V2.9.0.1). Si une autre
ligne y était ajoutée un jour, cette assertion tomberait — ce que le simple
retrait du nom de la liste n'aurait pas permis.

Les deux recettes re-basées ont été rejouées **contre leur propre version
d'origine** : **52 / 0** et **87 / 0**, la nouvelle assertion incluse.

---

## 9. Liste exacte des fonctions modifiées

**Trois fonctions, aucune autre.** Vérifié par FREEZE-2901 :
`{"modifiées":["structureNodeMenu","renderStructureNode","toggleDrawerMenu"]}`.

| Fonction | Nature | Raison | Nécessaire au correctif ? |
|---|---|---|---|
| `structureNodeMenu()` | **Vue** | Anomalie A — composant standard, icône, accessibilité | Oui, c'est le défaut lui-même |
| `renderStructureNode()` | **Vue** | Anomalie B — la classe `link` du bouton retour | Oui, c'est le défaut lui-même |
| `toggleDrawerMenu()` | Moteur de menu partagé | Retournement vertical, **mesuré nécessaire** (débordement de 165 à 169 px) | Oui — l'alternative était un second moteur de menu, interdit |

**Aucune fonction métier n'a été modifiée.** Les trois ci-dessus sont deux
fonctions de rendu et un utilitaire d'interface. Il n'y a donc rien à justifier
au titre du § 13 de la consigne.

Côté CSS, trois ajouts, tous sur le composant existant : `.more-pop.drop-up`,
`.more-pop.drop-up.open` et l'animation `morePopUp`. Aucune règle propre à
Structure, aucune couleur nouvelle.

---

## 10. Contrôle de gel — ce qui n'a pas bougé

`FREEZE-2901` compare **97 fonctions** entre V2.9.0 et V2.9.0.1 : `bougés: []`.

* **Tout le moteur Structure et ses agrégations** — les 37 fonctions livrées en
  V2.9.0, de `structureNode()` à `getStructureStatus()`, `structureParentError()`,
  `structureNodeCard()`, `projectStructureTab()`, `structureSelect()`.
* **Le Planning** — `planningTasks()`, `gantt()`, `renderPlanning()`,
  `planningCreateRow()`, toute la création à la souris, le déplacement, la
  propagation, les jours non ouvrés.
* **Les données** — `migrateState()`, `save()`, tout le backup et l'import.
* **Le métier transverse** — `setTaskStatus()`, `taskResourceIds()`, les
  ressources, les contrôles qualité, les jalons, l'Opération, `openTask()`.
* **L'Undo/Redo** — les huit helpers, intacts.
* **Le reste du moteur de menu** — `closeDrawerMenu()`, `anyDrawerMenuOpen()`.

Vérifié également : un seul `toggleDrawerMenu()`, un seul `closeDrawerMenu()`,
aucun moteur de menu parallèle, **plus aucune trace de la classe `more-wrap`**,
`SCHEMA_VERSION = 13`, `STORE = "kanvix-product-8-3"`, `KANVIX_APP_BUILD`
inchangé, et `INITIAL_STATE.structureNodes` comme `STRUCTURE_TYPES`
byte-identiques.

---

## 11. Design de la liste Structure — intact

Rien n'a été touché : indentation hiérarchique, twisty déplier/replier, nom,
type, métadonnées, statut, responsable, dates, clic sur la ligne ouvrant la
fiche, sous-niveaux, bloc « Sans structure ». Le patch ne corrige que le
déclencheur `…`, le positionnement du menu et le bouton retour.

---

## 12. Captures — `recette-v2.9.0.1/`

| Fichier | Contenu | Menu ouvert |
|---|---|---|
| `01-structure-menu-first-desktop.png` | Premier niveau, desktop | ✅ |
| `02-structure-menu-last-desktop.png` | Dernier niveau d'une longue liste, **retourné vers le haut** | ✅ |
| `03-structure-menu-mobile-430.png` | Mobile 430 | ✅ |
| `04-structure-menu-mobile-390.png` | Mobile 390 | ✅ |
| `05-structure-menu-dark.png` | Thème sombre | ✅ |
| `06-structure-node-back-link.png` | Fiche de niveau, « ← Structure » en lien discret | — |

> Les deux captures mobiles étaient d'abord sorties **menu fermé** : ma
> comparaison au déclencheur standard ouvre une fiche Ressource, ce qui referme
> le menu avant la prise de vue. La capture est désormais prise juste après
> l'ouverture, avant toute autre manipulation, et l'ancrage est vérifiable à
> l'œil.

---

## 13. Critères de validation

| Critère | Résultat |
|---|---|
| Le `…` n'a plus l'apparence d'un bouton natif | ✅ identique au déclencheur standard, au pixel |
| Le menu apparaît à proximité de son bouton | ✅ **6 px**, aligné à droite à 0 px |
| Le dernier menu d'une longue liste reste visible | ✅ retourné, −47 à −54 px de marge |
| Aucune apparition du popup en bas de page | ✅ ancêtre de positionnement = son propre `.more-menu` |
| Mobile 430 / 390 / 360 | ✅ |
| Thème sombre | ✅ |
| « ← Structure » ressemble aux autres liens retour | ✅ rendu mesuré identique à « ← Chantiers » |
| Aucun moteur métier modifié inutilement | ✅ zéro fonction métier modifiée |
| Structure V2.9.0 toujours 80 / 80 | ✅ contre V2.9.0 **et** contre V2.9.0.1 |
| Aucune régression des menus existants | ✅ Chantier, Ressource, Tâche, Opération mesurés |
| 0 erreur JS applicative | ✅ |
