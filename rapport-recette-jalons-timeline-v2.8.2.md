# Rapport — Kanvix V2.8.2 · Onglet « Jalons » en timeline

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.2.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.1.html`
**Suite de recette** : `recette-jalons-timeline-v2.8.2.mjs` — **38 / 38 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.8.2/` (11 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

> **Note sur la référence visuelle** : l'image d'inspiration annoncée dans la demande n'est pas
> arrivée avec le message (aucune pièce jointe reçue). La refonte suit donc la description écrite —
> ligne temporelle, bulles / repères, carte compacte portant date, chantier, nom et « Voir ». Les
> captures livrées permettent de vérifier l'écart éventuel avec l'intention.

---

## A. Résumé

L'onglet Jalons affichait trois lignes pleine largeur de 73px : la date tout à gauche, le contenu
au centre, « Voir → » à 1 100px de là. L'information tenait, mais rien ne disait la chronologie, et
chaque ligne étirait trois mots sur toute la largeur de l'écran.

Il devient une **timeline**. Un rail continu porte une bulle par jalon ; sous chaque bulle, la date
et son écart relatif (« Dans 5 jours ») ; sous la date, une carte compacte avec la vignette du
chantier, son nom, le nom du jalon, ses étiquettes, sa santé et son lien. Sur mobile, le même rail
bascule à la verticale.

La logique de la refonte tient en une phrase : **le rendu change, la donnée ne bouge pas.**
`operationMilestones()` reste l'unique source et l'unique tri, `daysBetweenKeys()` l'unique calcul
d'écart de jours, `projectToneClass()` l'unique identité couleur, `getProjectSummary()` l'unique
santé de chantier. Une seule fonction a été réécrite — `operationMilestonesTab()` — et une seule
ajoutée — `milestoneRelativeLabel()`. **89 moteurs et rendus sont vérifiés byte-identiques.**

---

## B. Ce qui a changé

### 1. Étape d'analyse — où était rendu l'onglet

| Élément | Emplacement | Sort en V2.8.2 |
|---|---|---|
| `operationMilestones(id)` | moteur de données (filtre les chantiers membres, trie par date) | **intact, byte-identique** |
| `operationMilestonesTab(id)` | rendu de l'onglet | **réécrit** |
| CSS `.op-milestones` / `.op-milestone` | liste + ligne | **réécrits** (mêmes noms de classe) |
| media query `≤ 860px` | empilement de la ligne | **réécrite** en rail vertical |
| `app.milestones[]` | données de démo | **intactes** — mêmes 4 jalons, mêmes champs |

### 2. Le rail

La gouttière entre les jalons est portée par le **padding des jalons**, pas par un `column-gap`.
Ce détail est ce qui rend le rail continu : chaque segment court jusqu'aux bords de son propre
jalon et rejoint exactement celui du voisin, sans un pixel de dépassement. Mesure :

```
bulle 1 : x=221,2   segment 1 : 221,2 → 605,1
bulle 2 : x=614,1   segment 2 : 605,1 → 997,9
bulle 3 : x=1006,9  segment 3 : 997,9 → 1006,9
```

Jointures à **0,0px**, début exactement sur la première bulle, fin exactement sur la dernière.
Quand la grille passe à la ligne, chaque rangée obtient ainsi son propre rail — vérifié sur 8
jalons : 2 rangées, **0 segment débordant de la grille**.

### 3. La carte

Compacte, comme demandé. Elle réutilise **telles quelles** `.op-pc-thumb` et `.op-pc-foot`, les
règles de la vignette chantier de la Vue d'ensemble : même besoin, même mise en page, aucune règle
dupliquée — et les deux onglets d'une opération se ressemblent enfin.

Contenu : vignette du chantier · pastille de couleur + nom du chantier · **nom du jalon** ·
étiquettes (`Jalon final`, `Chantier clôturé`, `Date passée`) · badge de santé · `Voir →`.

### 4. Les états

| État | Bulle | Carte |
|---|---|---|
| Prochain jalon (premier non passé) | 12px, anneau teinté du chantier | date en accent |
| À venir | 10px, pleine, couleur du chantier | normale |
| Passé | 10px, **creuse** (fond + contour) | atténuée, étiquette « Date passée » |
| Chantier clôturé / archivé | creuse | atténuée, étiquette « Chantier clôturé » |

Un seul jalon porte l'accent, et c'est toujours le premier non passé — vérifié même avec 8 jalons.

### 5. Mobile

Le rail bascule à la verticale : colonne de date de 84px alignée à droite, trait dans la gouttière,
bulle sur le trait, carte à droite. Les trois bulles sont sur la même abscisse (x=112), chaque
segment rejoint le centre de la bulle suivante à **0px près**, et le dernier jalon n'en traîne
aucun.

---

## C. Vérifications

### Checklist demandée

- [x] **onglet Jalons OK** — 38/38, timeline rendue sur les trois formats, états passé / prochain /
      clôturé corrects, état vide conservé à l'identique
- [x] **responsive OK** — 3 colonnes à 1440px et à 900px, empilement vertical à 390px,
      **aucun débordement horizontal** à aucun palier
- [x] **autres onglets Opération OK** — Vue d'ensemble (4 KPI), Planning (13 éléments),
      Ressources (11 lignes de charge) rendent tous leur contenu ; 7 bascules d'onglet enchaînées
      laissent la timeline intacte
- [x] **pas de régression visible** — 35 suites historiques rejouées deux fois (baseline V2.8.1 vs
      V2.8.2) : **0 régression**

### Ce qui a été vérifié, et comment

| # | Point | Mesure |
|---|---|---|
| JAL282-01/02 | La timeline liste exactement ce que renvoie le moteur, dans son ordre | noms et dates DOM comparés un à un à `operationMilestones()` |
| JAL282-03 | Le sélecteur `.op-milestone` des recettes antérieures est préservé | 1 carte par jalon |
| JAL282-04 | Afficher la timeline n'écrit rien | `localStorage` identique avant/après, champs de jalon inchangés |
| JAL282-05 | Bulles alignées et régulièrement espacées | même `y`, pas de 393px constant |
| JAL282-06 | Rail continu | jointures `[0, 0]` |
| JAL282-07 | Rail borné aux bulles | début 221,2 = bulle 1 ; fin 1006,9 = bulle 3 |
| JAL282-08 | Le trait se distingue du fond | écart de luminance 0,054 |
| JAL282-09 | Rangée régulière | 3 cartes, même bord haut (333), même largeur (375) |
| JAL282-10 | Un seul « prochain » | 1 `is-next`, bulle la plus grosse, seule date colorée |
| JAL282-11 | Couleur issue du moteur unique | `ptone-blue/green/amber` = `projectToneClass()` |
| JAL282-12 | Les 4 informations demandées | date, chantier, nom, « Voir » |
| JAL282-13/14 | Écart relatif issu de `daysBetweenKeys()` | 5 formulations limites validées |
| JAL282-15 | Jalon passé lisible comme tel | opacité 0,72 vs 1 ; bulle creuse (contour 2px vs 0) |
| JAL282-16 | Chantier clôturé | étiquette conservée **dans la carte**, 0 badge redondant |
| JAL282-17/18/19 | Navigation inchangée | `onclick` comparé au calcul V2.8.1 ; clic, Entrée et Espace ouvrent la fiche |
| JAL282-20→23 | Responsive | 3/3/empilé, rail horizontal puis vertical, dates sur une ligne (19px) |
| JAL282-24/25 | Volume | 8 jalons → 2 rangées, 0 débordement, en-tête « Jalons · 8 » + amplitude |
| JAL282-26 | État vide | « Aucun jalon » à l'identique, aucun rail vide |
| JAL282-27/28 | Onglets voisins | 4 onglets répondent, 7 bascules enchaînées sans casse |
| JAL282-29 | Thème sombre | fond sombre, texte clair, rail et bulles visibles, **0 couleur en dur** |
| FREEZE-282 | Périmètre | **89 moteurs byte-identiques**, 1 réécrite, 1 ajoutée, 0 CSS morte |

### Rejeux des suites antérieures

| Suite | Résultat | Écart vs baseline V2.8.1 |
|---|---|---|
| `recette-operations-v2.8.0.mjs` | **71 / 71** | **aucun** |
| `recette-harmonisation-ux-v2.8.1.mjs` | 48 / 49 | **1 écart attendu** (voir ci-dessous) |
| `recette-correctifs-v2.7.1.mjs` | 43 / 45 | aucun |
| `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 | aucun |

Le rejeu de la suite Opérations est le résultat le plus significatif : **71/71 sans un seul écart**,
y compris OP-39 (qui compte les `.op-milestone`), OP-40 (qui lit leur texte pour y trouver
« Chantier clôturé »), OP-50 (débordement à 390px) et OP-51 (qui sonde le fond d'un `.op-milestone`
en thème sombre). C'est le bénéfice direct d'un choix fait avant d'écrire une ligne : **conserver
la classe `.op-milestone` sur la carte** plutôt que de renommer. Le contrat de sélection des
recettes antérieures est intact.

---

## D. Points de vigilance

**1. Un écart assumé sur la suite V2.8.1, et un seul.**
`FREEZE-281` gèle 75 fonctions, dont `operationMilestonesTab` — celle que ce lot a précisément pour
mission de réécrire.

```json
{"gelés":74,"bougés":["operationMilestonesTab (2264c708 → d6d436b9)"]}
```

74 sur 75 intactes, la seule qui bouge est celle qui devait bouger. Les 48 autres assertions de la
suite passent. **C'est de l'obsolescence de périmètre, pas une régression** — et la suite
historique n'a pas été modifiée pour forcer le vert.

**2. Trois défauts réels trouvés et corrigés pendant la mise au point.** Ils sont listés parce
qu'aucun des trois n'était visible à l'œil sur la première capture :

| Défaut | Diagnostic | Correction |
|---|---|---|
| Rail invisible | `--border-light` (#e8ecf2) se confond avec `--bg-app` (#eceff5) | le rail porte `--border`, le trait de séparation standard ; écart de luminance mesuré à 0,054 |
| 2 colonnes au lieu de 3 à 900px | `minmax(232px, …)` avait été calibré pour une variante `auto-fill` abandonnée ; 662px utiles n'en logent que 2 | retour à `minmax(212px, …)` — 3 colonnes à 900px comme à 1440px |
| Rail mobile interrompu | le segment s'arrêtait 6,8px avant la bulle suivante : il franchissait le padding (12px) mais pas l'offset de la bulle (8px) | `bottom: -20px` ; jonctions mesurées à 0px |

**3. Deux arbitrages de composition, tranchés sur mesure et non à l'œil.**
La vignette illustrée a d'abord été ramenée au ratio 500/116 pour « ne pas décorer » : à 900px la
colonne tombe à 208px et le recadrage `slice` réduisait l'illustration à une bande de 48px
illisible. Le ratio d'origine (500/170) a été rétabli. Dans l'autre sens, une variante `auto-fill`
tassait les trois jalons à gauche en laissant un tiers d'écran vide : `auto-fit` a été conservé.

**4. Une redondance supprimée.** Sur un chantier clôturé, l'étiquette « Chantier clôturé » et le
badge de santé « Clôturé » disaient la même chose. Le badge est supprimé dans ce cas précis —
l'étiquette, elle, est conservée car elle est le contrat d'OP-40.

**5. Ce que la timeline ne fait pas.** Elle ne permet toujours pas de **créer** un jalon depuis
l'opération : un jalon appartient à un chantier, et OP-39 vérifie explicitement cette absence. Rien
n'a été ajouté sur ce point.

**6. Le vide résiduel sous la timeline** avec 3 jalons seulement est le reflet de la donnée, pas de
la mise en page : la capture `06-jalons-timeline-dense.png` (8 jalons) montre le comportement à
volume réel. Aucun contenu n'a été inventé pour remplir l'écran.

---

## E. Balayage de non-régression historique

35 suites, chacune exécutée **deux fois** — contre V2.8.1 (baseline) puis contre V2.8.2 — seul le
delta étant retenu. Copies de travail isolées hors dépôt : **0 fichier suivi par git modifié**.

**32 suites sur 35 : diff de verdicts strictement vide.**

Les 3 suites qui diffèrent (`recette-accueil-v2.4.4.1`, `recette-accueil-v2.4.5`,
`recette-historique-chantiers-v2.4.12`) ne diffèrent que par le **texte d'un chronomètre**
(« rendu Accueil non bloqué (24ms) » → « (31ms) », « rendu fluide (4 ms) » → « (5 ms) »). Les
verdicts sont identiques et les compteurs d'échecs strictement égaux à ceux de la baseline.

**0 régression réelle.**
