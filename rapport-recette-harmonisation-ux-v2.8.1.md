# Rapport de recette — Kanvix V2.8.1 « Harmonisation UX »

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.1.html` (1 083 499 octets)
**Source** : `public/poc/kanvix-next-gen-v2.8.0.html`
**Suite de recette** : `recette-harmonisation-ux-v2.8.1.mjs` — **49 / 49 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.8.1/` (12 captures nommées + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## Synthèse exécutive

V2.8.1 est une version **strictement de présentation**. Cinq harmonisations, aucune règle métier
touchée, aucune donnée persistée nouvelle.

| Indicateur | Valeur |
|---|---|
| `STORE` | `kanvix-product-8-3` — **inchangé** |
| `SCHEMA_VERSION` | **12 → 12** — aucune migration |
| Moteurs métier gelés vérifiés byte-identiques | **75 / 75** |
| Recette V2.8.1 | **49 / 49** |
| Rejeu `recette-operations-v2.8.0.mjs` | **71 / 71** |
| Rejeu `recette-correctifs-v2.7.1.mjs` | 43 / 45 — **identique à la baseline V2.8.0** |
| Rejeu `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 — **identique à la baseline V2.8.0** |
| Balayage historique (35 suites × 2 exécutions) | **0 régression réelle** |
| Erreurs console applicatives | **0** |

---

## Les 23 points documentés

### Point 1 — Périmètre exact des cinq changements

`FREEZE-281-périmètre` énumère nominativement ce que V2.8.1 a touché :

```json
{
  "modifiées":  ["operationCardMenu","renderOperation","operationOverviewTab","attentionCard","pageToday"],
  "intactes":   ["operationCard"],
  "ajoutées":   ["operationAttentionGrid","operationProjectCard","getTodayPendingControls",
                 "openQualityControlsPopup","openTodayQualityControls"],
  "remplacées": ["operationProjectRow"]
}
```

Cinq fonctions modifiées, cinq ajoutées, une remplacée. Rien d'autre.

### Point 2 — `operationCard()` n'a PAS eu besoin d'être modifiée

C'est un résultat, pas un oubli. Le défaut d'espacement de la carte Opération ne venait pas de la
carte : il venait du **menu**. `operationCard()` est donc restée byte-identique, et c'est la preuve
que le correctif a été posé au bon endroit. Ma première version de `FREEZE-281` attendait
six fonctions modifiées ; je l'ai corrigée pour refléter la réalité mesurée, pas l'inverse.

### Point 3 — Changement 1 : le défaut réel de la carte Opération n'était pas la valeur du `gap`

**Mesure avant** : `4px` entre le badge de statut et le `•••`.

Le diagnostic. `operationCardMenu()` empruntait la classe `.site-menu`, conçue pour se poser **en
surimpression** sur la vignette d'une carte chantier :

```css
.site-menu { position: absolute; top: 8px; right: 8px; }
```

Absolument positionné, ce menu **sortait du flux flex** de `.op-card-head-actions`. Or un `gap` ne
s'applique jamais à un élément hors flux. **Augmenter le `gap` seul n'aurait strictement rien
changé** — les 4px observés étaient une marge résiduelle, pas le `gap`.

**Le correctif** : `operationCardMenu()` n'emprunte plus `.site-menu` et utilise `.more-menu`
(`position: relative`, dans le flux). Le `gap: 12px` posé sur `.op-card-head-actions` s'applique
alors réellement.

**Mesure après** : `{"gap":12,"cssGap":"12px","position":"relative","stillSiteMenu":false,"sameRow":true}`
— **12px**, cible haute de la fourchette 10–12px demandée, à 1440px comme à 390px, sans
chevauchement et sans débordement (`{"gap":12,"overlap":false,"overflow":-15}`).

Capture : `01-operation-card-gap.png`.

### Point 4 — Changement 2 : les 4 onglets de la fiche Opération deviennent un segmented control Kanvix

`renderOperation()` passe de `class="tabs op-tabs"` à `class="segment op-tabs"`. La preuve
d'harmonisation est comparative : le test lit le fond et le rayon du segmented control de référence
déjà présent dans le produit et exige l'égalité.

```json
{"isSegment":true,"role":"tablist","roles":["tab","tab","tab","tab"],"count":4,
 "bg":"rgb(241, 244, 248)","radius":"8px",
 "ref":{"bg":"rgb(241, 244, 248)","radius":"8px"},
 "activeBg":"rgb(23, 105, 255)","inactiveBorders":["0px","0px","0px"]}
```

Fond identique, rayon identique, aucune bordure résiduelle sur les onglets inactifs.

### Point 5 — Le moteur d'onglets `setOperationTab()` est inchangé

Le changement est purement présentationnel : `setOperationTab()` n'a pas été touchée, et les quatre
onglets continuent de mémoriser et restituer l'onglet courant.

```json
[{"asked":"Planning","stored":"Planning","selected":["Planning"],"active":1}, …]
```

Un seul `aria-selected="true"` à chaque fois, et la valeur stockée correspond à l'onglet demandé.
Le contenu suit : `{"board":true,"gantt":true,"back":true}`.

Capture : `02-operation-tabs-segmented.png`.

### Point 6 — Le segmented control ne déborde pas sur petit écran

Quatre onglets dans un segmented control tiennent mal à 390px. `.op-tabs` reçoit donc un
défilement **local** (`overflow-x: auto`, `scrollbar-width: none`) et `.op-tabs button` un
`white-space: nowrap; flex: 0 0 auto`.

```json
{"localScroll":true,"overflowX":"auto","allRendered":true,
 "labels":["Vue d’ensemble","Planning","Ressources","Jalons"],"bodyOverflow":-15}
```

Les quatre libellés restent rendus et lisibles, et le **corps de page ne déborde pas**
(`bodyOverflow: -15`) : le défilement est confiné au contrôle.

### Point 7 — Changement 3 : trois colonnes sur la Vue d'ensemble

`operationAttentionGrid(id, sum)` est une fonction **nouvelle**. `operationOverviewTab()` se
contente de l'insérer entre les KPI et la grille des chantiers.

```json
{"present":true,"titles":["Actions nécessaires · 2","À surveiller · 3","À contrôler · 1"],
 "cols":3,"kpisAbove":true,"kpiCount":4}
```

Et la vérification est **visuelle**, pas déclarative : `{"colonnesVisuelles":3}` compte les
positions horizontales distinctes des colonnes réellement rendues — trois abscisses différentes.

« Contrôles à faire » est bien renommé **« À contrôler »**.

Capture : `03-operation-overview-three-columns.png`.

### Point 8 — Les compteurs des trois colonnes viennent des moteurs, pas du DOM

```json
{"dom":[2,3,1],"derived":[2,3,1]}
```

Les nombres affichés dans les titres sont confrontés à ceux recalculés depuis les moteurs
d'agrégation. Égalité stricte sur les trois colonnes : l'affichage ne recompte rien pour son
propre compte.

### Point 9 — Chaque colonne plafonne à 3 items et propose un lien « Voir les N »

```json
{"totals":[8,9,7],"shown":[3,3,3],"more":[true,true,true],
 "moreLabels":["Voir les 8 actions","Voir les 9 surveillances","Voir les 7 contrôles"]}
```

Le lien affiche le **total réel**, pas le reste. La colonne qualité réutilise
`controlRowHTML(c, "desk")` — le rendu de ligne de contrôle existant, aucun rendu parallèle.

### Point 10 — L'état calme est une phrase, jamais un gros zéro

```json
{"cols":3,"titles":["Actions nécessaires","À surveiller","À contrôler"],
 "calm":["✓ Rien à traiter","✓ Tout est sous contrôle","✓ Tout est contrôlé"],"noBigZero":true}
```

Les trois colonnes restent présentes même vides — la grille ne se réorganise pas selon les données,
ce qui évite le saut de mise en page quand un compteur tombe à zéro.

### Point 11 — Les trois colonnes restent actionnables

```json
{"decision":true,"warning":true,"control":true,"decisionOpened":true,"controlForm":true}
```

Un clic sur une décision ouvre le scénario, un clic sur un contrôle ouvre le formulaire de
contrôle. À noter : `openDecision()` **délègue à `openScenarios()`** — ma première version du test
cherchait un drawer ou une modale et échouait pour cette raison. Le test a été corrigé, pas le
produit.

### Point 12 — `.op-section` a été volontairement conservée sur les colonnes

Les trois colonnes portent **les deux classes** : `class="op-section op-attention-col"`.

Ce n'est pas de la redondance. Ma première version n'utilisait que `.op-attention-col`, ce qui a
cassé la recette V2.8.0 : son sélecteur `.op-section .qc-row b` ne trouvait plus rien
(`qcRows: 0`). Conserver `.op-section` préserve le contrat de sélection des suites antérieures ;
`.op-attention-col` porte la mise en colonnes. C'est la raison pour laquelle le rejeu V2.8.0 est
à 71/71 et non à 70/71.

### Point 13 — Changement 4 : les chantiers deviennent des vignettes

`operationProjectCard(p)` **remplace** `operationProjectRow(p)`.

```json
{"n":3,"oldRows":0,"grid":true,"menus":0,"visuals":[true,true,true],"clickable":true}
```

`oldRows: 0` : aucune ligne de tableau ne subsiste. `menus: 0` : la vignette d'opération ne porte
**pas** de `•••`, conformément à la demande — la gestion du chantier reste sur la page Chantiers.

Captures : `04-operation-project-cards.png`, `05-…-900.png`, `06-…-390.png`.

### Point 14 — Les vignettes réutilisent le moteur visuel existant

```json
{"allHaveVisual":true,"sameAsEngine":true,"noNewArt":true,"noNetworkImage":true}
```

`projectVisual(p.id)` est appelé tel quel ; aucun visuel nouveau n'a été dessiné et aucune image
réseau n'est chargée. La comparaison a demandé une précaution : le SVG **sérialisé par le DOM**
diffère de la chaîne brute retournée par le moteur. Les deux côtés sont normalisés avant
comparaison — sans quoi le test aurait échoué sur une différence de sérialisation, pas de contenu.

### Point 15 — La vignette porte l'information utile au pilotage

```json
{"name":true,"phase":true,"location":true,"next":true,"nextLabel":true,
 "health":true,"healthLabel":"Risque","delay":true}
```

Nom, phase, localisation, prochaine échéance, santé et retard. La santé vient de
`getProjectHealth()`, moteur **gelé et byte-identique**. Cas limite vérifié : un chantier clôturé
affiche `{"badge":"Clôturé","expected":"Clôturé"}`.

### Point 16 — La vignette reste un point d'entrée vers la fiche chantier

```json
{"page":"project","projectId":"keravel",
 "tabs":["Aujourd’hui","À venir","Documents","Photos","Planning","Ressources","Historique"],
 "cockpit":true}
```

Le clic mène à la fiche chantier **inchangée** — mêmes sept onglets, même cockpit.

### Point 17 — Comportement responsive de la grille de vignettes

```json
[{"w":1440,"colonnes":3,"attendu":3,"over":-15},
 {"w":900,"colonnes":2,"attendu":2,"over":-15},
 {"w":390,"colonnes":1,"attendu":1,"over":-15}]
```

3 → 2 → 1 colonnes, **sans débordement horizontal** à aucun palier.

### Point 18 — Changement 5 : la troisième vignette « À CONTRÔLER » sur Aujourd'hui

```json
{"modifier":true,"titles":["À décider","À surveiller","À contrôler"],
 "kinds":["decide","watch","quality"],
 "subs":["1 critique","1 problème terrain","1 contrôle à effectuer"],
 "counts":["3","3","1"],"icons":[true,true,true],"emoji":false}
```

`attentionCard()` a gagné une nature **`quality`** réelle — pas un `decide` déguisé. La vignette a
son propre résumé et sa propre icône (icône du jeu existant, **aucun emoji**).

Capture : `07-today-three-attention-cards.png`.

### Point 19 — La rétro-compatibilité de `attentionCard()` est prouvée, pas affirmée

```json
{"qualityAdded":true,"decideIntact":true,"iconBranch":true}
```

Les branches `decide` et `watch` conservent **exactement** leurs résumés et leurs icônes d'avant.
L'extension est purement additive.

### Point 20 — `getTodayPendingControls()` n'invente aucune règle

```json
{"same":true,"usesEngine":true,"noDateFilter":true}
```

La fonction agrège `pendingControlsForProject()` sur les chantiers actifs et **trie** ; elle ne
filtre pas par date et ne redéfinit pas ce qu'est un contrôle en attente. Le tri place les non
conformes en tête :

```json
{"order":[["Contrôle non conforme","nonconform"],["Contrôle avant fermeture des cloisons","todo"]],
 "first":"nonconform","topLine":"Contrôle non conforme — Résidence Keravel","count":"2"}
```

Réactivité vérifiée : un contrôle soumis disparaît de la liste
(`{"before":["ctrl-k-cloisons-001"],"after":[],"count":"✓"}`). État calme :
`{"present":true,"calm":true,"title":"À contrôler","sub":"Tout est contrôlé","count":"✓"}`
(capture `10-today-quality-zero.png`).

### Point 21 — La chaîne popup → formulaire réutilise le moteur de contrôle unique

```json
{"open":true,"title":"À contrôler",
 "rows":["Contrôle avant fermeture des cloisons — Cloisons étage 1 · Résidence Keravel · À contrôler"]}
```
```json
{"modalClosed":true,"drawerOpen":true,"form":true,
 "control":"ctrl-k-cloisons-001","expected":"ctrl-k-cloisons-001",
 "items":4,"actions":["Non conforme","Conforme"]}
```

La modale se ferme, le drawer s'ouvre sur **le bon contrôle**, avec ses 4 items et ses deux issues.
Et l'unicité du moteur est comptée :

```json
{"submit":1,"openForm":1,"formHTML":1,"strays":0}
```

Une seule `submitControlAttempt`, une seule `openControlForm`, une seule `controlFormHTML`,
**zéro implémentation parallèle**. Captures `08-today-quality-popup.png`, `09-today-quality-form.png`.

### Point 22 — Les zones gelées le sont restées

**Le hero Aujourd'hui** n'a pas bougé : la bande de synthèse reste à deux natures,
`{"items":["⚠ 3 décisions","▣ 6 actions","◉ 3 surveillances"],"hasQuality":false}`.

**Le Mode Chantier** n'a pas hérité de la troisième vignette. C'est le point le plus délicat du
lot : la grille d'attention est partagée. La solution retenue est un **modificateur**, pas une
redéfinition —

```css
.attention-grid.today-attention-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
```

`.attention-grid` seule est intacte. Preuve :

```json
{"cards":2,"kinds":["decide","watch"],"titles":["Actions nécessaires","À surveiller"],
 "modifier":false,"baseRule":"1fr 1fr","todayRuleScoped":".attention-grid.today-attention-grid"}
```

Le Mode Chantier reste à **deux** vignettes, la règle de base reste `1fr 1fr`, et la règle à trois
colonnes est bien portée par le sélecteur composé. Le comportement V2.7.1 du bouton « Chantier »
est également rejoué : `{"before":"keravel","after":null,"picker":true,"control":1}`.

> Détail de méthode : ce test a d'abord été écrit à 390px, où la media query `≤1080px` force une
> colonne unique — il ne prouvait donc rien. Il lit désormais la **règle CSS de base** via
> `document.styleSheets`, indépendamment du viewport de mesure.

**Les 75 moteurs métier** gelés : `{"gelés":75,"bougés":[]}`.
**Le socle de données** : `{"store":"kanvix-product-8-3","schemaPrev":"12","schemaCur":"12"}`.

### Point 23 — Thème sombre et responsive global

```json
{"dark":true,"opCardDark":true,"colDark":true,"pcardDark":true,"pcardReadable":true,
 "tabsActiveContrast":true,"qualityDark":true,"qualityCountReadable":true,
 "popupDark":true,"popupRowReadable":true}
```

Colonnes, vignettes, segmented control actif, vignette qualité et popup : tous lisibles en sombre.
Captures `11-operation-dark.png`, `12-today-dark.png`.

```json
{"testés":9,"débordements":[]}
```

**Neuf formats de 1920 à 360px, zéro débordement horizontal.**

---

## Rejeux exigés

### `recette-operations-v2.8.0.mjs` → **71 / 71**, 0 erreur console

Attendu et obtenu. Le résultat le plus intéressant de ce rejeu est son propre gel :

```json
FREEZE-280        : {"gelés":80,"bougés":[]}
FREEZE-280-périmètre : {"modifiées":["planningTasks","planningAgenda","gantt","resourceLoadBoard",
                       "migrateState","openProjectEdit","renderSites","renderPage",
                       "exportKanvixData","validateImportState","applyImportPlan","nav"]}
FREEZE-280-store  : {"store":"kanvix-product-8-3","schemaPrev":"11","schemaCur":"12"}
```

Les **80** moteurs que V2.8.0 gelait le sont toujours en V2.8.1, et la liste des fonctions modifiées
depuis V2.7.1 est **exactement celle de V2.8.0** — V2.8.1 n'en a ajouté aucune.

> Honnêteté sur ce que ce gel ne couvre pas : la liste `FREEZE-280` n'inclut pas `attentionCard` ni
> `pageToday`, que V2.8.1 modifie légitimement. Leur protection est portée par `FREEZE-281`
> (point 19) et par la preuve de non-contagion au Mode Chantier (point 22), pas par ce rejeu.

### `recette-correctifs-v2.7.1.mjs` → **43 / 45** — écart nul vs baseline V2.8.0

Les deux mêmes échecs qu'en V2.8.0, et la comparaison est faite à l'identique : la suite a été
exécutée **deux fois**, contre V2.8.0 et contre V2.8.1. Le diff des verdicts est vide, et les
empreintes md5 des moteurs déplacés sont **rigoureusement les mêmes chaînes** :

```json
"bougés":["planningTasks (9fca181e → 270e87aa)","gantt (8358c4b3 → 15dee839)",
          "migrateState (41257ebe → cb3b4711)","validateImportState (54d7860f → 269ac1ea)",
          "applyImportPlan (a80e498f → a1e16b5a)"]
```

Ces cinq fonctions sont celles que V2.8.0 avait le droit d'étendre. Le second échec est
`SCHEMA_VERSION (11)` : la suite date de V2.7.1 et attend le schéma 11, le produit est en 12.
**Obsolescence de schéma, pas régression.**

### `recette-controles-qualite-v2.7.0.mjs` → **68 / 73** — écart nul vs baseline V2.8.0

Même protocole, même conclusion : diff des verdicts vide, empreintes identiques.

```json
"bougés":["planningTasks (9fca181e → 270e87aa)","gantt (8358c4b3 → 15dee839)",
          "resourceLoadBoard (7933acb2 → 1d030e68)","exportKanvixData (664dd9fb → c0ae1f8f)"]
```

Les 5 échecs (QC-01, QC-04, FREEZE-270, 2× QC-DATA) tiennent tous à l'attente `SCHEMA_VERSION = 11`
et à la migration `10 → 11` d'une suite écrite avant les opérations. **Aucun nouvel échec.**

---

## Balayage de non-régression historique — 35 suites × 2 exécutions

Chaque suite historique a été exécutée **deux fois** : contre V2.8.0 (baseline) et contre V2.8.1.
Seul le **delta** est retenu. Les copies de travail ont été isolées hors dépôt ; **0 fichier suivi
par git n'a été modifié**.

**32 suites sur 35 : diff de verdicts strictement vide.**

Trois suites diffèrent :

| Suite | Base | V2.8.1 | Nature |
|---|---|---|---|
| `recette-historique-ui-v2.4.12.1` | 2 ✗ | 2 ✗ | Faux diff : seul le texte d'un chrono change (1 ms → 3 ms). Verdicts identiques. |
| `recette-accueil-v2.4.5` | 0 ✗ | 8 ✗ | Obsolescence — voir ci-dessous |
| `recette-accueil-v2.4.4.1` | 18 ✗ | 26 ✗ | Obsolescence — voir ci-dessous |
| `recette-correctif-ui-v2.4.14.1` | 20 ✗ | 22 ✗ | Obsolescence — voir ci-dessous |

### Analyse des trois écarts : tous causés par le comptage en dur de **2** vignettes

Ces suites datent d'avant V2.8.1 et codent en dur le fait que la rangée d'attention d'Aujourd'hui
contient **deux** cartes. Le changement 5 en ajoute une troisième — **délibérément et sur demande
explicite**. Trois formes :

**1. `document.querySelectorAll('.attention-card').length === 2`**
`recette-accueil-v2.4.4.1`, checks `[mobile-bureau]` et `[empty]`. La substance de ces tests est
intacte :

```json
430px : {"hero":true,"fieldEntry":true,"attention":false,"today":true,"sites":true,"week":true}
390px : idem — et « pas de scroll horizontal » PASSE aux deux largeurs
vide  : {"heroPresent":true,"attentionPresent":false,"crashed":false,
         "todayText":"Aujourd’hui… Aucune intervention prévue aujourd’hui.",
         "sitesText":"Chantiers actifs… Aucun chantier actif."}
```

Tous les autres blocs sont présents, la page ne casse pas à vide, il n'y a pas de scroll
horizontal. **Seul le littéral `2` est faux.**

**2. `ACC-141-06` : `r.widths.length === 2 && |w0 - w1| <= 1`**
`recette-correctif-ui-v2.4.14.1`. La propriété protégée — l'égalité stricte des largeurs — est
**mieux** vérifiée qu'avant :

```json
{"cols":"427.656px 427.672px 427.656px","widths":[428,428,428]}
```

Trois colonnes rigoureusement égales. L'assertion ne tombe que sur `length === 2`.

**3. `right(À surveiller) = right(Chantiers actifs)`**
`recette-accueil-v2.4.5` et `recette-accueil-v2.4.4.1`. Ces tests vérifient que la rangée
d'attention s'aligne sur la largeur utile de la page en prenant « À surveiller » comme **dernière**
carte. Avec trois cartes, « À surveiller » est désormais **au milieu** ; la dernière est
« À contrôler ».

Ce point méritait une vérification indépendante, car il aurait pu masquer une vraie rupture
d'alignement. Sonde dédiée, bord droit de la **dernière** carte contre le bord droit de
« Chantiers actifs » :

| Largeur | Dernière carte (droite) | « Chantiers actifs » (droite) | Δ | Hauteurs égales |
|---|---|---|---|---|
| 1920 | 1853 | 1852 | 1 px | oui |
| 1600 | 1537 | 1536 | 1 px | oui |
| 1440 | 1382 | 1381 | 1 px | oui |
| 1366 | 1310 | 1309 | 1 px | oui |
| 1280 | 1227 | 1226 | 1 px | oui |

Δ = 1 px à chaque palier, soit exactement l'arrondi sous-pixel que ces suites tolèrent déjà
(`<= 1`) et qui leur faisait passer le test en V2.8.0. **L'alignement est intact** ; c'est le nom
de la dernière carte qui a changé. Et les hauteurs restent égales — les propres logs de la suite le
confirment : `hauteur À décider=À surveiller (90.75/90.75/90.75)`.

**Conclusion du balayage : 0 régression réelle.** Conformément à la règle permanente, aucune suite
historique n'a été modifiée pour forcer le vert.

---

## Défauts de test corrigés (et non maquillés)

Six tests que j'avais d'abord écrits étaient faux. Ils sont listés parce qu'un test qui passe pour
une mauvaise raison ne vaut rien.

| # | Test | Défaut | Correction |
|---|---|---|---|
| 1 | UX281-03 | Exigeait `position: static` sur le menu, alors que `.more-menu` est légitimement `relative` | Assertion portée sur « n'est plus `.site-menu` » + `gap` mesuré |
| 2 | UX281-14 | Cherchait un drawer/modale, alors que `openDecision()` délègue à `openScenarios()` | Assertion posée sur la cible réelle |
| 3 | UX281-16 | Comparait un SVG brut à un SVG sérialisé par le DOM | Normalisation des deux côtés |
| 4 | UX281-29 | Mesurait la grille à 390px, où la media query `≤1080px` force 1 colonne | Lecture de la règle CSS de base via `document.styleSheets` |
| 5 | UX281-30 | Dépendait d'un effet de bord d'UX281-29 (entrée en mode terrain) | Rendu autonome |
| 6 | FREEZE-281 | Attendait 6 fonctions modifiées ; `operationCard` n'avait pas besoin de changer | Périmètre aligné sur la mesure (voir point 2) |

---

## Ce que V2.8.1 ne fait pas

- Aucune migration, aucun champ persisté nouveau, `SCHEMA_VERSION` inchangé à 12
- Aucune règle métier touchée — 75 moteurs byte-identiques
- Aucune bibliothèque, aucun framework, aucun appel réseau ajouté
- Aucun fichier hors du HTML monolithique
- Aucune modification du hero Aujourd'hui ni du Mode Chantier
