# Rapport — Kanvix V2.9.1 · Refactor UX « Structure compacte »

**Fichier livré** : `public/poc/kanvix-next-gen-v2.9.1.html` (28 584 lignes)
**Source** : `public/poc/kanvix-next-gen-v2.9.0.1.html` (27 925 lignes)
**Recette dédiée** : `recette-structure-compacte-v2.9.1.mjs` — **74 / 74 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.9.1/` — 10 captures + `resultats.json`
**Branche** : `claude/kanvix-next-gen-poc-im084x`

| Contrôle | Résultat |
|---|---|
| `SCHEMA_VERSION` | **13**, inchangé |
| `STORE` | **`kanvix-product-8-3`**, inchangé |
| `KANVIX_APP_BUILD` | inchangé |
| `migrateState()` | **byte-identique** — aucune migration ajoutée |
| `INITIAL_STATE.structureNodes` / `STRUCTURE_TYPES` | **byte-identiques** |
| Moteurs de V2.9.0.1 gelés | **103 comparés, 0 bougé** |
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** contre V2.9.0 **et** contre V2.9.1 |
| `recette-structure-ux-v2.9.0.1.mjs` | **58 / 58** contre V2.9.0.1 **et** contre V2.9.1 |
| 49 recettes historiques | **`RESTE : 0`** (262 contre 262) |

---

## 1. Le bug de navigation — cause exacte

### Ce que j'ai mesuré avant de toucher au code

Sur V2.9.0.1, un seul clic sur le chevron de « Bâtiment A » :

```
AVANT  : {page:"project", onglet:"Structure",   structureVisible:true,  scrollY:111}
APRÈS  : {page:"project", onglet:"Aujourd’hui", structureVisible:false, scrollY:37}
```

Le défaut n'est pas intermittent : il est **systématique**.

### La cause

`app.ui.projectInitialTab` est une consigne **à usage unique**. `renderProject()`
la lit, puis la remet à `null` :

```js
initial = app.ui.projectInitialTab && tabs.includes(app.ui.projectInitialTab)
  ? app.ui.projectInitialTab
  : tabs[0],
…
app.ui.projectInitialTab = null;          // ← consommée
```

Et l'onglet réellement affiché n'était mémorisé **nulle part** : `projectTab()`
se contentait de permuter la classe `active` et de remplacer `#projectContent`.

Donc tout re-rendu postérieur retombait sur `tabs[0]`, c'est-à-dire
« Aujourd'hui ». `toggleStructureNode()` appelait `renderPage()` — d'où l'éjection.

### Ce n'était pas le seul geste concerné

J'ai vérifié les autres actions Structure. **Les trois** éjectaient l'utilisateur :

| Action | V2.9.0.1 | V2.9.1 |
|---|---|---|
| Déplier / replier | Structure → **Aujourd'hui** | Structure → **Structure** |
| Archiver un niveau | Structure → **Aujourd'hui** | Structure → **Structure** |
| Supprimer un niveau | Structure → **Aujourd'hui** | Structure → **Structure** |

La consigne ne parlait que du repli. Corriger le seul repli aurait laissé
l'utilisateur éjecté dès qu'il archive un niveau — ce qui contredit l'esprit de
la demande. J'ai donc traité **la cause**, pas seulement son symptôme.

### Le correctif, en deux couches

**Couche 1 — le geste lui-même ne re-rend plus la page.** Conformément à la
préférence technique demandée, `toggleStructureNode()` n'appelle plus
`renderPage()` :

```js
function toggleStructureNode(nodeId) {
  let list = app.ui.collapsedStructure || [];
  app.ui.collapsedStructure = list.includes(nodeId)
    ? list.filter((x) => x !== nodeId) : [...list, nodeId];
  save();
  refreshStructureTree();        // ← rendu chirurgical
}
```

`refreshStructureTree()` remplace le contenu des conteneurs `[data-structure-tree]`
présents à l'écran, et **rien d'autre**. Chaque conteneur porte son contexte en
attribut (`project` + id de chantier, ou `node` + id de parent), ce qui lui permet
de se reconstruire seul. Aucune navigation, aucun `openProjectTab()`, aucun
`scrollTo`.

**Couche 2 — la cause racine.** L'onglet affiché est désormais mémorisé, rattaché
à son chantier :

```js
// dans projectTab()
app.ui.projectTabActive = app.ui.projectId + "|" + name;

// dans renderProject() — un SECOND recours, après la consigne explicite
memoTab = (app.ui.projectTabActive || "").split("|")[0] === app.ui.projectId
  ? (app.ui.projectTabActive || "").split("|").slice(1).join("|") : null,
initial = app.ui.projectInitialTab && tabs.includes(app.ui.projectInitialTab)
  ? app.ui.projectInitialTab
  : memoTab && tabs.includes(memoTab) ? memoTab : tabs[0],
```

L'ordre de priorité est préservé : **une consigne explicite gagne toujours**. Et
`selectProject()` oublie la mémoire dès qu'on change de chantier, pour qu'ouvrir
un autre chantier n'hérite jamais de l'onglet du précédent.

**`migrateState()` n'a pas été touchée.** Le champ se lit avec
`(app.ui.projectTabActive || "")` : il se comporte correctement lorsqu'il est
absent, donc aucune migration n'est nécessaire — et un moteur lourdement gelé
n'est pas modifié pour rien.

### La preuve

`STC-07` installe une sentinelle sur `window.scrollTo` **avant** le clic et
relève tous les appels. Résultat : `scrollCalls: []` — aucun appel, donc aucun
`scrollTo(0, 0)`. La position de défilement passe de 128 à 44 px : c'est le
navigateur qui **borne** le défilement parce que le document raccourcit de deux
lignes, pas un retour en haut de page. Déplier ensuite ne la fait pas remonter.

`STC-08` enchaîne quatre bascules et vérifie que lignes affichées, état replié et
`aria-expanded` reviennent à l'identique.

---

## 2. La vue compacte

### Ce qui remplace quoi

| V2.9.0.1 | V2.9.1 |
|---|---|
| `.sn-card` — grandes cartes empilées, **82 px** par niveau | `.snc-row` — lignes de grille, **44 px** par niveau |
| `.sn-tree` | `[data-structure-tree]`, rafraîchissable seul |
| Pas d'en-tête de colonnes | `Nom · Interventions · Ressources · Période · Responsable · Statut · Actions` |
| Pas de récapitulatif | `4 niveaux · 5 interventions · 5 ressources` |
| Pas de commande globale | `Tout développer` / `Tout replier` |
| « Sans structure · 2 interventions » | Les **deux interventions**, nommées et cliquables |

**Densité mesurée : −49 % par niveau** (82 → 44 px), sur les mêmes données.

### La hiérarchie

Chevron, pictogramme du type, nom, badge du type. Trois zones cliquables
**disjointes**, chacune avec `stopPropagation()` :

* le **chevron** replie et rien d'autre (`STC-14`) ;
* le **corps** ouvre la fiche du niveau (`STC-13`) ;
* le **« … »** n'ouvre que son menu (`STC-15`).

L'indentation est bornée à trois crans (42 px maximum), vérifié sur une
profondeur de 5 niveaux : aucun débordement horizontal (`STC-12`).

`STC-11` compare l'ordre et la profondeur affichés au parcours
`getStructureRoots()` → `getStructureChildren()` des moteurs existants :
**identiques**, élément par élément.

### Les pictogrammes de type

`sites` et `building` se ressemblent trop pour opposer un bâtiment et une zone.
Les cinq tracés sont donc écrits dans la couche de vue — comme les chevrons —
plutôt qu'ajoutés à `icon()`, **qui est gelée depuis V2.8.4.1** et qu'un simple
triangle de repli ne justifie pas de modifier.

| Type | Tracé |
|---|---|
| Bâtiment | un immeuble et ses ouvertures |
| Zone | des niveaux empilés |
| Phase | un jalon sur une frise |
| Sous-projet | un dossier |
| Autre | une étiquette neutre |

### Aucun chiffre n'est recalculé

`STC-25` → `STC-29` comparent, **ligne par ligne et cellule par cellule**, ce qui
est affiché à ce que renvoient les moteurs :

| Colonne | Source | Concordance |
|---|---|---|
| Interventions | `getStructureProgress()` | ✅ |
| Ressources | `getStructureResources()` | ✅ |
| Période | `getStructureDates()` | ✅ |
| Responsable | `resourceLabel(n.responsibleResourceId)` | ✅ |
| Statut — libellé **et** ton | `getStructureStatus()` | ✅ |

### « Tout développer / Tout replier »

Ne touche qu'à `app.ui.collapsedStructure`. `STC-10` vérifie qu'elle ne crée
**aucune** entrée d'annulation ni d'historique métier, et qu'elle ne fait pas
quitter l'onglet.

---

## 3. « Sans structure » — les interventions sont enfin visibles

Le bloc affiche désormais chaque intervention : nom, ressources mobilisées,
période, intervenant, statut. Le clic ouvre la tâche par `openTask()`.

Une ligne secondaire apparaît quand — et seulement quand — la tâche porte un
point d'attention ouvert, lu dans `app.issues` exactement comme le fait
`getStructureIssues()`. Jamais de remplissage décoratif.

**Aucune tâche n'est créée, déplacée ni dupliquée.** `STC-24` relève l'empreinte
`id:structureNodeId` de toutes les tâches avant et après l'affichage et vérifie
qu'elle est **identique** ; puis que chaque intervention listée a bien
`structureNodeId === null`.

---

## 4. La fiche d'un niveau

Le hero vertical devient une bande horizontale : identité à gauche (pictogramme,
nom, badge de statut, type · description · responsable), indicateurs à droite.
Les actions « Modifier » et « + Tâche » remontent dans la barre du haut — c'est
ce qui permet à la bande de tenir sur **une seule ligne**.

Aucun indicateur vide n'est affiché : une carte n'apparaît que si elle porte une
valeur (`STC-30`).

### Hauteur du cockpit, mesurée

| Largeur | V2.9.0.1 | V2.9.1 | Écart |
|---|---|---|---|
| 1920 / 1600 / 1440 | 111 px | **60 px** | **−46 %** |
| 1366 / 1280 / 1080 / 900 | 111 px | **88 px** | **−21 %** |
| 768 | 111 px | 114 px | **+3 %** |
| 430 | 166 px | **114 px** | **−31 %** |
| 390 | 166 px | **136 px** | **−18 %** |
| 360 | 199 px | **136 px** | **−32 %** |

**Le 768 est la seule largeur où la bande est plus haute**, de 3 px — et elle y
affiche strictement plus d'information (cinq indicateurs plus la prochaine étape,
contre trois éléments). Je le signale plutôt que de le passer sous silence.

Sous 1400 px, la bande ne rétrécit pas : elle **change de forme**. Les puces
cèdent la place à une ligne de méta dense qui porte exactement les mêmes faits.
Adapter, pas réduire.

### L'onglet Résumé

Les interventions passent en lignes compactes (**≤ 56 px**), ordonnées
chronologiquement, cliquables. Les sous-niveaux utilisent le **même** composant
compact que l'onglet Structure du chantier — un seul langage visuel pour la
hiérarchie.

Les indicateurs chiffrés ne sont plus répétés : ils sont déjà dans le cockpit.

---

## 5. Deux défauts trouvés par les tests, et corrigés

### Le grave : des colonnes purement et simplement coupées

Entre **769 et 1250 px**, la grille à sept pistes réclamait ~890 px alors que le
bloc n'en faisait plus que 833 à 1080 px et **653 à 900 px**. Le bloc portant
`overflow: hidden`, le résultat n'était pas un défilement : le **Statut** et les
**Actions** étaient invisibles. Vérifié à l'œil sur une capture à 900 px.

Correctif : deux paliers gradués.

| Largeur | Colonnes |
|---|---|
| ≥ 1251 px | 7 colonnes |
| 901 – 1250 px | 5 colonnes — Interventions et Ressources rejoignent la ligne de méta |
| ≤ 900 px | ligne/carte compacte (la forme mobile) |

En-tête et lignes masquent les **mêmes** colonnes : ils ne peuvent pas se
désaligner. Balayage de **31 largeurs** de 320 à 1920 px : aucun débordement,
aucune colonne coupée.

> Le seuil mobile est à 900 px et non à 768 : entre les deux, mesure à l'appui,
> aucune disposition en colonnes ne tient sans rogner une information.

### Le visible : des noms réduits à « R.. »

À 390 px, entre l'indentation, le chevron, le pictogramme, le badge de type, le
statut et le « … », il ne restait plus rien pour le nom. Le badge de type
descend donc dans la ligne de méta — où il reste parfaitement lisible — et le
statut est borné à 112 px. « RDC », « Étage 1 », « Bâtiment A », « Extérieurs »
s'affichent maintenant **en entier** à 430 et 390 px.

### Trois autres défauts de mon propre code, corrigés en cours de route

* Le sélecteur `.snc-kpi-txt > span` attrapait **aussi** la valeur (elle aussi un
  `span` enfant direct) : les dates s'affichaient en capitales. Classe explicite.
* La bascule puces / ligne dense était déclarée **avant** la règle de base : à
  spécificité égale, la base l'emportait et les deux s'affichaient. Ordre corrigé.
* Une tentative de puces sur une seule ligne sous 1366 px les a rendues **plus
  larges**, donc plus enclines à passer à la ligne : mesurée contre-productive,
  retirée.

---

## 6. Les menus « … » de V2.9.0.1 — non régressés

J'avais d'abord réduit le déclencheur à 30 × 28 px pour resserrer la ligne.
`recette-structure-ux-v2.9.0.1.mjs` l'a immédiatement signalé : **c'était une
régression** du contrat posé au round précédent. L'override a été **retiré**, et
la colonne Actions élargie à 46 px pour accueillir la taille standard.

| Largeur | Déclencheur Structure | Déclencheur standard (fiche Ressource) | Identique |
|---|---|---|---|
| 1600 | 43 × 33, marge 8/13, rayon 8 | 43 × 33, marge 8/13, rayon 8 | ✅ |
| 900 | 43 × 33, marge 8/13, rayon 8 | idem | ✅ |
| 390 | 43 × 33, marge 8/13, rayon 8 | idem | ✅ |

Le composant est intégralement conservé : `.more-menu`, `.btn.more-trigger`,
`.more-pop`, `icon("more")`, `aria-haspopup`, `aria-expanded`, `role="menu"` /
`role="menuitem"`, fermeture au clic extérieur, fermeture par Échap, un seul menu
ouvert, retournement `.drop-up`. Les quatre actions et leurs handlers sont
inchangés.

`STC-16` → `STC-20` le vérifient dans la nouvelle vue, et `FREEZE-291` gèle
`toggleDrawerMenu()`, `closeDrawerMenu()`, `anyDrawerMenuOpen()` et
`structureNodeMenu()` **byte à byte**.

---

## 7. Fonctions modifiées — et pourquoi

**Sept fonctions, pas une de plus.** Le balayage de tout le fichier
(`FREEZE-291`) ne trouve aucune autre différence.

| Fonction | Nature | Raison |
|---|---|---|
| `projectTab()` | Vue | Mémorise l'onglet affiché — la cause racine du bug |
| `renderProject()` | Vue | Retombe sur l'onglet mémorisé avant `tabs[0]` |
| `selectProject()` | Navigation | Oublie la mémoire en changeant de chantier |
| `toggleStructureNode()` | Interface | Rendu chirurgical au lieu de `renderPage()` |
| `projectStructureTab()` | Vue | La vue compacte et le bloc « Sans structure » |
| `renderStructureNode()` | Vue | Le cockpit compact |
| `structureTabContent()` | Vue | Résumé et Sous-niveaux compacts |

**Aucun moteur métier n'a été modifié.** Les trois premières relèvent de la
navigation d'interface, les quatre autres sont des vues. `renderProject()` et
`projectTab()` touchent au cadre de la fiche chantier parce que c'est **là** que
le défaut se trouvait : le corriger ailleurs aurait été traiter un symptôme.

### Fonctions ajoutées — 13, toutes de présentation

`structureTypeIcon`, `structureCollapsed`, `structureCompactRow`,
`structureCompactTree`, `refreshStructureTree`, `structureColHead`,
`structureCountsLine`, `structureAllExpanded`, `toggleAllStructure`,
`unstructuredTaskRow`, `taskStatusTone`, `structureUnstructuredBlock`,
`structureCompactCockpit`.

Chacune consomme les moteurs existants ; aucune ne refait un calcul métier.

### Fonction supprimée — 1

`structureNodeCard()`, remplacée par `structureCompactRow()`. `structureSummaryLine()`
est conservée à l'identique.

### CSS

**35 classes `.snc-*`** ajoutées, plus cinq constantes de tracés SVG
(`SNC_CHEVRON`, `SNC_CARET_DOWN`, `SNC_CARET_UP`, `SNC_TYPE_SHAPES`) et
`STRUCTURE_COLS`. Aucune couleur codée en dur : `STC-44` relève **0 occurrence**
dans toute la section Structure.

Les anciennes règles `.sn-card`, `.sn-tree`, `.sn-hero`, `.sn-stats`,
`.sn-task-list`, `.sn-unsorted` deviennent inutilisées. Je les ai **laissées en
place** : les retirer relèverait du refactoring général, explicitement exclu du
périmètre. Elles ne produisent plus aucun balisage.

---

## 8. Résultats STC-01 → STC-50

**74 assertions, 74 PASS, 0 erreur console.** (74 et non 50 : plusieurs points
du cahier des charges demandent plusieurs vérifications.)

| Bloc | Couverture | Résultat |
|---|---|---|
| STC-01 → STC-08 | Le bug : ouverture, repli, dépli, page, chantier, onglet, absence de `scrollTo(0,0)`, réversibilité | ✅ |
| STC-09 / STC-10 | Tout développer / Tout replier, sans Undo ni historique | ✅ |
| STC-11 → STC-15 | Hiérarchie, profondeur 5, zones cliquables disjointes | ✅ |
| STC-16 → STC-20 | Menus V2.9.0.1 : ancrage, viewport, `drop-up`, exclusivité, Échap | ✅ |
| STC-21 → STC-24 | « Sans structure » : compte, noms, clic, aucun `structureNodeId` modifié | ✅ |
| STC-25 → STC-29 | Chaque chiffre affiché = celui du moteur | ✅ |
| STC-30 → STC-35 | Fiche compacte, Résumé, Planning, Ressources, Sous-niveaux, `+ Tâche` | ✅ |
| STC-36 → STC-40 | Modification, sous-niveau, archive, garde-fous, Undo/Redo | ✅ |
| STC-41 → STC-46 | Mobile 430/390/360, sombre, 11 largeurs × 2 thèmes | ✅ |
| STC-47 | 0 erreur JS applicative | ✅ |
| STC-48 / STC-49 | Chantier sans structure, structure de 23 niveaux | ✅ |
| STC-50 / FREEZE-291 | Gel métier, périmètre, helpers ajoutés | ✅ |

### Responsive — 11 largeurs × 2 thèmes

1920, 1600, 1440, 1366, 1280, 1080, 900, 768, 430, 390, 360, en clair et en
sombre : **débordement horizontal de la page = −15 px partout** (aucun), et
**débordement interne des blocs = 0** partout. Balayage complémentaire de
31 largeurs (320 → 1920) : aucune colonne coupée.

Hauteur par niveau en mobile : **74 px** (cible annoncée 64–86 px).

### Thème sombre

Fond de bloc `rgb(16, 32, 47)` (luminance 0,12), texte `rgb(238, 244, 249)`
(luminance 0,95), connecteurs `rgb(29, 50, 68)`. **0 couleur codée en dur.**

### Performance

Structure de **23 niveaux** sur 4 de profondeur : rendu en 333 ms, deux bascules
complètes « tout replier / tout développer » en 433 ms, aucun débordement,
onglet conservé.

---

## 9. Non-régression

### Recettes Structure

| Recette | Contre sa version | Contre V2.9.1 |
|---|---|---|
| `recette-structure-projet-v2.9.0.mjs` | **80 / 80** | **80 / 80** |
| `recette-structure-ux-v2.9.0.1.mjs` | **58 / 58** | **58 / 58** |

### Les 49 recettes historiques

```
ECHECS V2.9.1 : 262   |   ECHECS RÉF V2.9.0.1 : 262
RESTE : 0
```

**Aucune régression historique.** Le total est identique au référentiel, à
l'assertion près. Planning, Undo/Redo, création à la souris, drag & drop, jours
non ouvrés, Ressources V2.5+, Opérations : tout est passé, rien n'a bougé.

### Re-baselines — sélecteurs uniquement, valables pour les DEUX versions

Aucune assertion **métier** n'a été modifiée. Cinq sélecteurs de présentation
sont devenus obsolètes ; chacun accepte désormais les deux écritures, ce qui les
rend valables contre l'ancien build comme contre le nouveau — et les maintient
exactement aussi sévères.

| Recette | Sélecteur | Avant | Après |
|---|---|---|---|
| `structure-projet-v2.9.0` | Bouton « + Tâche » d'une fiche | `.sn-hero-actions .btn.primary` | `… \|\| .snc-top-actions .btn.primary` |
| `structure-projet-v2.9.0` | Compte de niveaux (×2) | `.sn-card` | `.sn-card, .snc-row[data-structure-node]` |
| `structure-projet-v2.9.0` | Fond d'une carte | `.sn-card` | `.sn-card, .snc-block` |
| `structure-projet-v2.9.0` | Couleur du nom | `.sn-head b` | `.sn-head b, .snc-open b` |
| `structure-ux-v2.9.0.1` | Arbre visible | `.sn-tree` | `.sn-tree, [data-structure-tree]` |
| `structure-ux-v2.9.0.1` | Badge de statut | `.sn-status` | `.sn-status, .snc-status` |

Une seule re-baseline de **gel** : `FREEZE-2901` de la recette V2.9.0.1 gelait
`toggleStructureNode`, `projectStructureTab` et `structureTabContent`, que ce
refactor réécrit délibérément. Ces trois-là en sortent — **et rien d'autre** :
les 93 autres moteurs y restent vérifiés byte à byte, et une **assertion
compensatoire plus forte** a été ajoutée, qui vérifie que `toggleDrawerMenu()`,
`closeDrawerMenu()` et `structureNodeMenu()` sont byte-identiques à V2.9.0.1
dans le build testé. Le gel n'est pas allégé : il est déplacé et renforcé.

### Un faux positif écarté, prouvé et non ignoré

`renderAIPanel()` apparaît « modifiée » à l'extraction par accolades — ses
littéraux gabarits en contiennent. Vérifiée par une **seconde méthode
indépendante**, un découpage à l'indentation : 46 lignes contre 46, **identiques
ligne à ligne**. Elle n'est pas exclue du contrôle, elle est contrôlée autrement.

---

## 10. Comparaison avec « Proposition A »

### Ce qui est repris fidèlement

* Bloc « Structure » avec pictogramme, titre, récapitulatif `N niveaux ·
  N interventions · N ressources` et commande « Tout développer ».
* En-tête de colonnes `NOM · INTERVENTIONS · RESSOURCES · PÉRIODE · RESPONSABLE ·
  STATUT` en petites capitales grises.
* Lignes compactes : chevron, pictogramme du type, nom, badge du type.
* Responsable en pastille + nom, « — » quand il n'y en a pas.
* Badges de statut doux, menu « … » standard à droite.
* Bloc « Sans structure » avec son compteur, sa mention rassurante et ses
  interventions en lignes.
* Cockpit de niveau en bande horizontale : identité à gauche, indicateurs
  « À traiter / À contrôler / Période / Interventions / Prochaine étape » à droite.

### Écarts volontaires, et pourquoi

1. **L'image est un montage.** Son fil d'Ariane (`Chantiers › Résidence Keravel ›
   Bâtiment A › Structure`) et son cockpit sont ceux d'une **fiche de niveau**,
   tandis que sa liste contient « Bâtiment A » **et** « Extérieurs », donc toutes
   les racines du chantier — ce qui est l'**onglet Structure du chantier**. Les
   deux écrans n'en font qu'un sur la maquette. Le cahier des charges écrit, lui,
   est sans ambiguïté : la liste compacte au § 3 (onglet du chantier), le cockpit
   au § 7 (fiche de niveau). J'ai suivi le texte, et appliqué à **chacun des deux
   écrans** le langage visuel de l'image.

2. **Le récapitulatif indique « 5 interventions », l'image « 4 ».** L'image est
   incohérente avec ses propres lignes (4 + 1 = 5). Le chiffre affiché est celui
   des données réelles.

3. **Le hero du chantier (« Résidence Keravel », À traiter, Prochaine étape) est
   inchangé.** L'image le compacte aussi, mais le § 7 ne demande de compacter que
   la fiche d'un **niveau**, et le § « ne pas réinventer » proscrit d'élargir le
   périmètre.

4. **Les connecteurs sont un rail vertical discret**, pas des `├──` / `└──`.
   Même lecture, moins de bruit — l'image les dessine très pâles.

5. **Les noms des interventions « sans structure » sont les vrais.** L'image
   affiche « Fenêtres décalées » (qui est un point d'attention) et « Contrôle fin
   de second œuvre » (qui est un jalon). Le bloc liste les tâches réellement
   sans niveau, comme le § 6 l'exige.

---

## 11. Erreurs console

**0 erreur JavaScript applicative**, sur la recette dédiée comme sur les 49
recettes historiques rejouées.

---

## 12. Fichiers livrés

| Fichier | État |
|---|---|
| `public/poc/kanvix-next-gen-v2.9.1.html` | **Nouveau** — fichier intégral |
| `recette-structure-compacte-v2.9.1.mjs` | **Nouveau** — 74 assertions |
| `recette-v2.9.1/` | **Nouveau** — 10 captures + `resultats.json` |
| `RAPPORT-STRUCTURE-COMPACTE-V2.9.1.md` | **Nouveau** — ce document |
| `recette-structure-projet-v2.9.0.mjs` | **Modifiée** — 4 sélecteurs, valables pour les deux versions |
| `recette-structure-ux-v2.9.0.1.mjs` | **Modifiée** — 2 sélecteurs + re-baseline de gel documentée |

---

## 13. Critères d'acceptation

| # | Critère | Résultat |
|---|---|---|
| 1 | L'aspect visuel est celui de la Proposition A | ✅ écarts documentés au § 10 |
| 2 | Structure beaucoup plus compacte | ✅ **−49 %** par niveau |
| 3 | Hiérarchie comprise immédiatement | ✅ chevron, pictogrammes distincts, rail, indentation bornée |
| 4 | Déplier/replier ne quitte JAMAIS Structure | ✅ et archiver/supprimer non plus |
| 5 | « Sans structure » montre les interventions par leur nom | ✅ sans toucher un seul `structureNodeId` |
| 6 | Fiches de niveau plus denses | ✅ **−46 %** en desktop large |
| 7 | Les menus « … » de V2.9.0.1 restent parfaits | ✅ taille standard restaurée après détection |
| 8 | Desktop/mobile, clair/sombre cohérents | ✅ 11 largeurs × 2 thèmes, plus 31 largeurs balayées |
| 9 | Aucun moteur métier dupliqué | ✅ 103 moteurs gelés, 0 bougé |
| 10 | Aucune fonctionnalité régressée | ✅ `RESTE : 0` sur 49 recettes |
