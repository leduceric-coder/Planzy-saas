# DentalFlow V3.9.0 — Audit QA indépendant (Opus)

**Fichier audité :** `public/poc/dentalflow-next-poc-v3.9.0.html` (15 283 lignes)
**Base de comparaison :** `public/poc/dentalflow-next-poc-v3.8.8.html` (14 884 lignes)
**Documents confrontés :** `DENTALFLOW_V3_9_0_DESIGN_SYSTEM.md`, `..._IMPLEMENTATION_REPORT.md`,
`..._TEST_REPORT.md`, `..._CHANGELOG.md`
**Nature :** audit adversarial — vérification des affirmations contre le code, recherche de
défauts **non revendiqués**. Aucun fichier modifié, aucun commit.

## Méthode

1. Diff intégral V3.8.8 → V3.9.0 (`530` lignes de diff, `497` lignes `<`/`>`) — lu en entier,
   ce qui permet d'affirmer avec certitude ce qui a été touché et ce qui ne l'a pas été.
2. Comparaison octet-à-octet de 13 fonctions métier entre les deux versions.
3. `node --check` sur le script principal extrait (728 482 caractères).
4. **Exécution réelle** sous Chromium headless (Playwright, `/opt/pw-browsers/chromium`) :
   5 scripts d'instrumentation, `getComputedStyle`/`getBoundingClientRect` sur le DOM vivant,
   19 captures d'écran (1440 px et 390 px, light et dark), écoute `pageerror` +
   `console.error` sur ~25 interactions.
5. Comptage exact des occurrences de chaque classe `.df-*` dans le markup (parsing des
   attributs `class="..."`, pas de `grep` par sous-chaîne).

---

## 1. Incohérences visuelles restantes

### 🔴 V1 — BLOQUANT — Le menu `[…]` de la fiche commande est affiché en permanence

**Référence :** CSS ligne 748 (`.df-menu`) × markup ligne 5248 (`actionsBarHTML`)
**Sélecteur :** `.qv-actions-bar .row-menu-pop.df-menu[hidden]`

`.df-menu` déclare `display:flex`. Le popover est écrit
`<div class="row-menu-pop df-menu" data-row-menu-pop="…" hidden>`. Le fichier ne contient
**aucune règle auteur `[hidden]{display:none}`** (vérifié : seule `.hidden{display:none!important}`
existe, ligne 21, et c'est une *classe*). Une déclaration d'origine auteur l'emporte toujours
sur la feuille de style de l'agent utilisateur : `.df-menu{display:flex}` neutralise donc
`[hidden]{display:none}` de la feuille UA.

Mesures réelles (Chromium, fiche CMD-0213 ouverte, aucun clic préalable) :

```
hasHiddenAttr : true
display       : "flex"
rect          : { w:200, h:169, t:170, l:826 }   → rendu, visible
```

Après `document.body.click()` (le gestionnaire de fermeture au clic extérieur, ligne 6554,
repasse bien `hidden=true`) :

```
afterOutside : { hidden:true, display:"flex", h:169 }   → toujours affiché
```

**Conséquences :**
- Le menu s'ouvre tout seul à chaque ouverture de fiche et **ne peut jamais être fermé**.
- Il recouvre la première section (`overlapsCard: true`, popRect 170→339 × 826→1026 contre
  cardRect à partir de 180 × 400→1026) : la valeur du champ **Cabinet** est masquée
  (« Clinique Bell… » tronqué — visible sur les captures 1440 px light **et** dark, et 390 px).
- L'objectif §35 revendiqué (« les actions secondaires ne concurrencent plus l'action
  principale, elles sont regroupées dans un menu ») est **annulé** : les 4 actions
  secondaires sont plus visibles qu'en V3.8.8, et en superposition.
- Le défaut est spécifique à ce menu : les autres `.row-menu-pop` (congés ligne 6020, stock
  ligne 9807) n'ont pas la classe `.df-menu` et se comportent correctement.

**Pourquoi les 360 tests ne l'ont pas vu :** DS01 mesure des `height` de boutons, DS04 vérifie
`!!menuBtn.querySelector('svg')` et compte 5 iconbox. Aucun test de la suite n'interroge
`getComputedStyle(pop).display` ni la visibilité du popover.

### 🔴 V2 — BLOQUANT — Les libellés du menu débordent de leur ligne et se chevauchent

**Référence :** CSS ligne 267 (`.row-menu-pop button`) × ligne 749 (`.df-menu-item`)

`.row-menu-pop button{display:block;…;padding:9px 12px}` a une spécificité (0,1,1) et l'emporte
sur `.df-menu-item{display:flex;align-items:center;gap:10px;padding:0 10px}` (0,1,0). En
revanche `height:38px` de `.df-menu-item` n'a pas de concurrent et s'applique. Résultat : le
libellé passe sur deux lignes dans une boîte de hauteur fixe.

Mesures réelles sur les 4 items :

| Item | height | scrollHeight | débordement |
|---|---|---|---|
| Imprimer le bon | 38 | 38 | non |
| Reprise | 38 | 38 | non |
| **Bloquer la commande** | 38 | **43** | **oui (+5 px)** |
| **Annuler la commande** | 38 | **43** | **oui (+5 px)** |

Le débordement est visuellement confirmé sur les captures : « Bloquer la / commande » et
« Annuler la / commande » se télescopent. Par ailleurs `gap:10px` et `align-items:center` de
`.df-menu-item` sont morts (`display:block` gagne), donc l'alignement icône + libellé décrit
au §6 du Design System n'est pas celui obtenu.

### 🟠 V3 — MAJEUR — Hauteurs de boutons incohérentes dans une rangée retouchée par cette version

**Référence :** ligne 5013 et ligne 10017 (`report-toolbar`, bouton `#print-report`)

C'est précisément la rangée modifiée par V3.9.0 (remplacement de 🖨️ par `icon('print')`).
Mesures : `.segmented` = **42 px**, `#print-report` (`.ghost` + `style="height:38px"`) = **38 px**.
Écart de 4 px dans la même ligne, alors que §14 exige l'alignement des hauteurs. De plus 38 px
n'appartient à aucune taille de l'échelle `.df-btn` documentée (34 / 40 / 44).

### 🟡 V4 — Barre d'actions réduite à un bouton flottant sans étiquette

**Référence :** ligne 5248 + CSS ligne 851 (`.qv-actions-bar .row-menu{margin-left:auto}`)

Sur le cas le plus fréquent (commande active, non bloquée, non livrée), `primaryAction` est
vide et la barre ne contient que le déclencheur `[…]`, poussé à droite. On obtient une bande de
44 px avec un unique bouton carré détaché du reste, sans contexte. Le rapport d'implémentation
décrit ce `margin-left:auto` comme un *correctif* de débordement ; il produit ici un artefact
de mise en page. Constaté sur CMD-0213 (`barHeights` ne renvoie que `row-menu` + `row-menu-btn`).

### 🟡 V5 — Trois patrons d'empty state coexistent

`.watch-empty` (Accueil, présenté au §14 comme la référence), `<div class="empty">` (fiche
commande, lignes 5258 et 5272), et `.df-empty-state` **créé mais jamais instancié**
(0 usage). La généralisation annoncée au §14 n'a pas eu lieu ; l'écran pilote lui-même
(fiche commande) utilise le patron le plus ancien.

### 🟡 V6 — Deux niveaux de hiérarchie rendus avec la même classe (groupe Communication)

**Référence :** ligne 5279 (`communicationGroup`) et ligne 5272 (`commentsHTML`)

« Commentaires » est un sous-titre de groupe rendu avec `.df-info-item-label` (11 px, majuscules,
`--df-text-muted` — un label de champ). « Messages liés » utilise la **même classe**, mais à
l'intérieur d'un `.df-info-item`. Deux niveaux hiérarchiques différents, un seul style.

### 🟡 V7 — Doublons d'icônes : trois tracés identiques sous deux noms

Analyse des 43 entrées de `icon(kind)` (lignes 4515-4556) — trois valeurs `d` strictement
identiques portées par deux clés :

| Clés | Tracé |
|---|---|
| `bag` / `purchase` | `M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2` |
| `check` / `success` | `M5 13l4 4L19 7` |
| `truck` / `supplier` | `M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5…` |

§6 vise « jamais un second dessin pour la même notion ». C'est le miroir exact du problème :
deux noms pour le même dessin, ce qui rouvre l'ambiguïté que la normalisation devait fermer
(quel nom un futur écran doit-il appeler ?). Aucune des trois nouvelles clés n'est utilisée.

**Point positif vérifié :** la revendication « réutilise EXACTEMENT le tracé de l'icône de
navigation » est exacte — `paths.home`, `paths.order`, `paths.production` correspondent
caractère pour caractère aux `d` de `NAV_ITEMS.home/orders/production` (lignes 4675-4677).
`paths.planning` fusionne les deux `<path>` de `NAV_ITEMS.planning` en un seul `d`, ce qui est
visuellement équivalent.

---

## 2. Duplication de composants

### 🟠 D1 — MAJEUR — 45+ règles du Design System sont du code mort

Comptage exact des jetons de classe présents dans les attributs `class="…"` du fichier :

| Primitive | Usages markup | Documentée au §… |
|---|---|---|
| `.df-avatar` (+ `.xs .sm .md .lg`) | **0** | §29 |
| `.df-badge` (+ 6 variantes) | **0** | §15 |
| `.df-card` (+ `.soft .interactive .semantic-*`) | **0** | §11 |
| `.df-kpi` / `.df-kpi-value` / `.df-kpi-label` | **0** | §12 |
| `.df-empty-state` (+ 3 sous-classes) | **0** | §14 |
| `.df-table` (+ `.df-table-num .df-table-actions`) | **0** | §16 |
| `.df-field` (+ 4 sous-classes) | **0** | §13 |
| `.df-modal-title/-subtitle/-body/-foot`, `.df-modal-wide` | **0** | §11/§19-22 |
| `.df-drawer-head` / `.df-drawer-foot` | **0** | §12/§23-25 |
| `.df-btn-primary` / `-ghost` / `-danger` | **0** | §5 |
| `.df-section-actions` | **0** | §9 |

Réellement instanciés : `.df-section` (6), `.df-info-item` (19), `.df-kpi-sub` (9),
`.df-btn` (5) + `.df-btn-secondary` (5) + `.df-btn-icon` (1), `.df-menu-item` (5),
`.df-iconbox` (2 sites, 6 rendus), `.df-info-grid` (3), `.df-section-head/-title` (2/2),
`.df-finance-grid/-cell` (1/1).

Ce n'est pas un bug fonctionnel, mais c'est une **surestimation du livrable** : six sections du
Design System (§13 formulaires, §15 badges, §16 tableaux, §28 empty states, §29 avatars, plus
la moitié de §11 et §19-25) documentent des composants qui n'ont jamais été rendus une seule
fois — donc jamais testés en conditions réelles, ni en light, ni en dark, ni en responsive.
La ligne du DoD « Design System central créé ✅ » est vraie au sens littéral, mais les 13 tests
DS ne couvrent aucune de ces primitives.

### 🟠 D2 — MAJEUR — Trois patrons de footer de side-window coexistent, dont un non couvert

- `.form-actions` — patron historique, rendu sticky par la règle ligne 848. ✅
- `.df-drawer-foot` — patron **créé par V3.9.0** (ligne 821), avec les mêmes déclarations
  `position:sticky;bottom:0;background;border-top` : **doublon fonctionnel exact** de la règle
  ligne 848, et **jamais utilisé**.
- `.invoice-preview-foot` (ligne 563, markup ligne 9397) — **non couvert par la règle sticky**
  (détail en §5 ci-dessous).

Le §12 du Design System annonce « un seul sélecteur CSS » ; il y en a trois, dont un mort.

### 🟡 D3 — `.df-modal-head-left` employé hors de toute modale

**Référence :** lignes 5252 (`financeSection`) et 5275 (`groupHead`)

La seule classe `.df-modal-*` survivante sert exclusivement de conteneur flex à l'intérieur
d'un `.df-section-head`, jamais dans un `.quick-card` ni un `.form-box`. Le nommage induit en
erreur ; `.df-section-head` aurait dû recevoir son propre helper.

### 🟡 D4 — `.df-menu` empilé sur `.row-menu-pop` sans arbitrage de cascade

Les deux classes déclarent `background`, `border`, `border-radius`, `box-shadow`, `min-width`,
`padding`, `z-index`. `.df-menu` (ligne 748) étant postérieure à `.row-menu-pop` (ligne 266),
elle gagne sur toutes — y compris `min-width` (150 → 200 px), `z-index` (20 → 120) et
`box-shadow` (`--shadow-strong` → `--df-shadow-float`, cf. §8 dark mode). C'est la cause
racine de V1 et V2 : la « normalisation visuelle » a été empilée sans vérifier ce qu'elle
écrasait ni ce qui l'écrasait.

---

## 3. Styles inline problématiques

Le mandat n'exige pas leur élimination. Ne sont listés que ceux qui **contredisent** un token
du Design System ou qui trahissent une pose sans réflexion.

### 🟠 S1 — MAJEUR — Un inline style contredit directement un token documenté

**Ligne 5275 :** `<div class="df-section-title" style="font-size:14px">`
contre **ligne 780 :** `.df-section-title{font-size:16px}`

Les cinq titres de groupe de la fiche commande annulent inline la taille du composant qu'ils
déclarent utiliser. Un modificateur (`.df-section-title.sm`) aurait été la réponse conforme.
C'est exactement le cas de figure que le §5 du mandat d'audit demande de signaler.

### 🟡 S2 — Deux autres contradictions de token

- **Ligne 5269 :** `style="white-space:pre-wrap;font-weight:600"` sur un `.df-info-item-value`
  qui déclare `font-weight:750` (ligne 804).
- **Ligne 5279 :** `style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px"`
  sur un `.df-info-item` — le composant est détourné en conteneur de layout par un inline style.

### 🟡 S3 — L'échelle d'espacement `--df-space-*` n'est utilisée nulle part

`--df-space-1` … `--df-space-8` sont définis (ligne 698) et **n'apparaissent dans aucune règle
ni aucun style inline**. Le nouveau markup pose à la place, en dur :
`margin-top:14px` × 6 (lignes 5252, 5276, 5277, 5278, 5279, 5280), `margin-top:10px` × 5,
`margin-top:8px` × 2, `margin-top:4px` × 2, `margin-top:2px`, `margin-bottom:8px` × 2,
`padding:14px 0`, `margin-top:8px;padding-top:8px;border-top:1px solid var(--df-border)`.
Les 6 `margin-top:14px` sur `.df-section` devraient être une règle
`.df-section + .df-section{margin-top:var(--df-space-4)}`.

### 🟡 S4 — Hauteur hors échelle posée inline sur les deux boutons retouchés

Lignes 5013 / 10017 (`#print-report`) et 6160 (`#open-charge-cal`) :
`style="…height:38px;padding:0 16px;display:inline-flex;align-items:center;gap:6px"`.
38 px n'est aucune des tailles `.df-btn` (34/40/44). Voir aussi V3.

### 🟡 S5 — `.df-info-item.full` posé trois fois hors de tout `.df-info-grid`

Lignes 5207 (`reworksHTML`), 5246 (`blockCardHTML`), 5269 (`indicationsHTML`) : la classe
`.full` ne fait que `grid-column:1/-1` (ligne 803), sans effet en dehors d'un conteneur grid.
Trois déclarations mortes.

---

## 4. Dérives de couleurs

### 🟠 C1 — MAJEUR — Une modification CSS non déclarée, et sans effet

**Ligne 82 :** `.thread-item.active,.thread-item:hover{background:rgba(139,92,246,.06)}`
(V3.8.8 : `background:#f8fbff`)

Trois problèmes cumulés :

1. **Non documentée.** Le Changelog affirme « corrigé aux **deux** endroits où la règle était
   dupliquée » ; il y a trois modifications de couleur dans le diff (`.bubble.lab`,
   `.composer button`, `.thread-item`). Aucun des quatre documents ne mentionne `.thread-item`.
2. **Violet codé en dur** (`rgba(139,92,246,.06)`) au lieu de `var(--violet)`, alors que
   `--violet` vaut `#8b5cf6` en light mais `#a78bfa` en dark.
3. **Entièrement morte.** Trois règles postérieures l'écrasent : ligne 84
   (`.thread-item.active{background:var(--surface-soft)}`), ligne 86
   (`.thread-item:hover{background:var(--surface-hover)}`) et surtout ligne 332
   (`.thread-item.active{background:var(--surface-selected)}`).
   Mesure réelle, conversation sélectionnée : `.thread-item.active` = **`rgb(230,239,254)`**
   (bleu) en light, `rgb(31,38,55)` en dark. Le violet n'apparaît jamais.

Le comportement final est d'ailleurs *correct* au sens du §5 (bleu = sélection), ce qui rend la
modification d'autant plus gratuite et risquée.

### ✅ C2 — Les corrections « messages = violet » revendiquées sont réelles

Mesures réelles, panneau Messages ouvert avec conversation sélectionnée :
`.composer button` → `rgb(139,92,246)` = `var(--violet)` ✅.
La règle `.bubble.lab{background:var(--violet)}` est bien posée aux deux endroits (lignes 82 et
86, la seconde étant celle qui écrasait la première en V3.8.8). ✅

**Réserve de documentation :** le Design System décrit `.bubble.lab` comme « la bulle de message
côté laboratoire ». Le markup en produit deux instances de sens opposé :
`class="bubble ${m.authorType==='CABINET'?'lab':'cabinet'}"` (portail cabinet) et
`class="bubble ${m.authorType==='LAB'?'lab':'cabinet'}"` (application labo). `.lab` signifie en
réalité « message émis par moi ». Le rendu reste cohérent (violet = communication des deux
côtés), mais la description du §2 est inexacte.

### 🟡 C3 — Sémantique discutable de trois iconbox de la fiche commande

- `groupHead('clock','neutral','Traçabilité')` (ligne 5280) : gris = « terminé / archivé /
  secondaire » au §5. La traçabilité n'est ni terminée ni archivée.
- `groupHead('tooth','blue','Travail')` (ligne 5276) : bleu = « action / navigation /
  production / sélection ». Le contenu (dents, teinte, empreinte) est descriptif, pas une action.
- `financeSection` : iconbox **verte** (ligne 5252) pour une section qui agrège « CA en
  production » et « À facturer » — non encaissés, alors que §5 réserve le vert à
  « réussi / prêt / livré / payé ».

Aucune de ces trois n'est une faute nette, mais toutes trois échappent à la « règle unique »
revendiquée, et aucune n'est justifiée dans les documents.

---

## 5. Pop-ups et side-windows non conformes

### 🟠 P1 — MAJEUR — Une side-window à actions échappe au footer sticky

**Référence :** `renderInvoicePreviewPanel`, ligne 9379, markup ligne 9397

Ce panneau ne construit pas de `.form-actions` : il utilise
`<div class="invoice-preview-foot" style="margin-top:16px">` (CSS ligne 563 :
`display:flex;flex-wrap:wrap;gap:10px;align-items:center` — aucun `position:sticky`).
Il contient pourtant six actions réelles :

```
Modifier la sélection · Émettre la facture · Imprimer
Télécharger PDF · Envoyer au cabinet · Pointer
```

La règle ligne 848 (`#side-panel-body .form-actions{position:sticky;bottom:0;…}`) ne l'atteint
pas. Le Rapport d'implémentation et le Changelog affirment tous deux « sur **tous** les
formulaires latéraux de l'application » et « **appliqué à tous les formulaires** » (ligne DoD).
C'est faux pour l'aperçu de facture — la side-window la plus chargée en actions de l'application.

Le test DS03 ne le détecte pas : il n'ouvre que 6 panneaux (`newOrder`, `blockOrder`,
`addComment`, `stockForm`, `userForm`, `cabinetForm`) et ne vérifie que `width` et la présence
d'un `#side-panel-head`, jamais la présence ou le `position` d'un footer.

### ✅ P2 — Le footer sticky fonctionne partout ailleurs

Vérification réelle sur `blockOrder` :
`{ position:"sticky", bottom:"0px", background:"rgb(255,255,255)", borderTopWidth:"1px" }`.
Capture confirmée (`03-sidepanel-1440-light.png`). Vérification statique du markup :
`.form-actions` présent dans `newOrder`, `stockForm`, `userForm`, `absenceForm`, `whatifForm`,
`cabinetForm`, `supplierForm`, `tariffForm`, `serviceForm`, `stockScan`, `blockOrder`,
`reworkForm`, `cancelForm`, `addComment`, `changeLocation` (2), `stockManual`,
`articleServices`, `serviceArticles`, `pointPayment` (2). ✅

### 🟡 P3 — `renderUserPermsPanel` est une side-window de pure consultation

Ligne 4894 : aucune action, aucun `.form-actions` — écran en lecture seule ouvert dans le
conteneur « side-window = action » (§23-25). Défaut pré-existant V3.8.8, non introduit ici,
mais non relevé non plus par l'audit du prior session qui déclare cette famille conforme.

### 🟡 P4 — Un `#quick-close` sur sept sans `aria-label`

Ligne 9858 (pop-up détail d'alerte / article) : `<button class="quick-close" id="quick-close">`
sans `aria-label="Fermer"`, contre six occurrences correctement étiquetées. Identique en
V3.8.8 — non introduit, mais le §19-22 annonce l'harmonisation du shell de pop-up et ce point
n'a pas été relevé.

### ✅ P5 — Structure des pop-ups `.quick-layer` cohérente

Les 9 écrivains de `#quick-body` produisent tous la même structure
`<div class="quick-head">…<button class="quick-close" id="quick-close">×</button></div>`.
Escape ferme bien la couche : `before=true`, `after=false`. ✅

---

## 6. Responsive (1440 px / 390 px, light et dark)

### ✅ R1 — Aucun débordement horizontal de page à 390 px

`document.documentElement.scrollWidth = 375` contre `clientWidth = 390`. ✅

### ✅ R2 — Grille « Activité financière » correcte à 390 px

4 cellules de 154 px, hauteur 70 px, texte non tronqué (`scrollWidth 122 <= clientWidth`),
valeurs `1480 € / 185 € / 370 € / 185 €` intégralement lisibles, alignement top identique à
1 px près. En dark : fond de grille `rgba(255,255,255,.14)` (= `--df-border`, technique du gap
1 px), cellules `#1F2637` (= `--surface-2`). ✅

### 🟡 R3 — Second breakpoint mort

**Ligne 191 :** `@media(max-width:420px){.df-finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`
duplique à l'identique la règle ligne 190 (`max-width:899px`). Règle sans effet. Le Rapport
d'implémentation présente « Tablette ≤899 px : 2×2. Mobile ≤420 px : 2×2 » comme deux
comportements ; c'est le même.

### 🟡 R4 — Débordement interne de `.quick-card` à 390 px — **pré-existant, aggravé**

| Version | `scrollWidth` | `clientWidth` | Élément fautif |
|---|---|---|---|
| V3.8.8 | 345 | 329 | `.week-day` (bande « Cette semaine ») |
| V3.9.0 | **368** | 329 | `.week-day` (idem) |

La cause est le composant `weekStripHTML()` de V3.8.x, **non touché** par cette version : ce
n'est donc pas une régression introduite. Mais la restructuration en 5 groupes a élargi le
conteneur de la bande, portant le débordement de 16 px à 39 px. Le §34 réorganisait précisément
cette zone : l'occasion de corriger n'a pas été prise, et le Test Report « Responsive 21/21 »
ne le mentionne pas.

### 🔴 R5 — Le menu permanent (V1) est plus nuisible à 390 px

Capture `06-quickview-390-light.png` : le popover de 200 × 169 px recouvre le champ **Patient**
et une partie du champ **Cabinet** sur une carte de 329 px de large, soit ~60 % de la largeur
utile, dès l'ouverture de la fiche et sans possibilité de fermeture.

---

## 7. Dark mode

Lecture intégrale du bloc CSS entre les marqueurs `DENTALFLOW DESIGN SYSTEM V3.9` (ligne 679)
et `FIN DENTALFLOW DESIGN SYSTEM V3.9` (ligne 855), puis vérification par `getComputedStyle`
sous `html[data-theme="dark"]`.

### 🟠 K1 — MAJEUR — `--df-shadow-float` est la seule ombre non dérivée d'un token de thème

**Ligne 697 :**
```css
--df-shadow-card:var(--shadow);
--df-shadow-float:0 14px 34px rgba(20,32,55,.14),0 2px 8px rgba(20,32,55,.08);  /* codé en dur */
--df-shadow-overlay:var(--shadow-strong);
```

Mesure sous `data-theme="dark"` : la valeur reste
`rgba(20,32,55,.14) 0 14px 34px, rgba(20,32,55,.08) 0 2px 8px` — un bleu-nuit à 14 % posé sur
un fond `#171D2B`, donc **une élévation invisible**. Consommateurs : `.df-menu` (ligne 748) et
`.df-card.interactive:hover` (ligne 770).

Effet concret : en dark, le menu `[…]` de la fiche commande n'a ni ombre ni séparation nette
d'avec le contenu qu'il recouvre (visible sur `10-quickview-1440-dark.png`), ce qui aggrave V1.

Cela contredit trois affirmations : DS §17 (« chaque primitive V3.9.0 lit les tokens `--df-*`,
eux-mêmes dérivés des tokens de thème »), DS §1 (« Ombres : `--df-shadow-float` (survol/popover) »
listé au même titre que les deux autres) et le Changelog (« tous dérivés des tokens de thème
existants »).

**Le test DS09 est construit de façon à ne pas pouvoir le voir.** Extrait ligne 14994 :

```js
const stripped = dsBlock.replace(/rgba?\([^)]*\)/g,'').replace(/#fff(fff)?\b/gi,'');
const hardcodedHexInCore = /#[0-9a-fA-F]{3,6}/.test(stripped);
```

Le test supprime **tous** les `rgba(...)` avant de chercher des couleurs codées en dur. Or les
seules valeurs light-only du bloc *sont* des `rgba()`. Le test ne peut structurellement
détecter que des hex, et il n'y en a aucun hors `#fff`. Son PASS n'apporte donc aucune garantie
sur ce qu'il prétend vérifier.

### 🟡 K2 — Règle dark redondante

**Ligne 840 :** `html[data-theme="dark"] .df-menu{background:var(--df-surface);border-color:var(--df-border)}`
— déclarations strictement identiques à celles de `.df-menu` (ligne 748). Règle morte.

### ✅ K3 — Le reste des primitives est correctement thématisé

Mesures sous `data-theme="dark"` :

| Élément | Valeur mesurée | Token attendu |
|---|---|---|
| `.df-iconbox.blue` fond | `rgba(10,132,255,.16)` | `--df-blue-soft` dark ✅ |
| `.df-iconbox.blue` couleur | `rgb(10,132,255)` | `--accent` dark ✅ |
| `.df-info-item` fond | `rgb(31,38,55)` | `--surface-2` ✅ |
| `.df-info-item` bordure | `rgba(255,255,255,.14)` | `--border` ✅ |
| `.df-section` fond | `rgb(23,29,43)` | `--surface-1` ✅ |
| `.df-menu` fond | `rgb(23,29,43)` | `--surface-1` ✅ |

Les surcharges `html[data-theme="dark"]` et `@media(prefers-color-scheme:dark) html[data-theme="system"]`
des `--df-*-soft` (lignes 700-701) sont bien présentes et couvrent les trois modes, `applyTheme()`
posant toujours `data-theme` (`light` | `dark` | `system`, ligne 4672). Les `#fff` de
`.df-btn-primary`, `.df-btn-danger` et `.df-avatar` sont du texte sur fond saturé — usage
volontaire et cohérent avec `.primary/.big-primary`. ✅

**Défaut pré-existant hors périmètre, signalé pour information :** la cellule « aujourd'hui » de
`weekStripHTML()` (`.week-day` sélectionnée) reste sur fond clair en dark
(`10-quickview-1440-dark.png`). Composant V3.8.x non touché.

---

## 8. Régressions fonctionnelles

### ✅ Aucune. Vérification par comparaison octet-à-octet.

| Fonction | V3.8.8 | V3.9.0 | Identique |
|---|---|---|---|
| `computeRevenueKPIs` | L4365 | L4589 | ✅ |
| `kpiCounts` | L4300 | L4492 | ✅ |
| `blockOrder` | L8643 | L8897 | ✅ |
| `moveOrderToStage` | L7908 | L8162 | ✅ |
| `orderStatusInfo` | L4001 | L4193 | ✅ |
| `filteredOrders` | L4314 | L4506 | ✅ |
| `notifColor` | L9217 | L9471 | ✅ |
| `userPermissions` | L3626 | L3818 | ✅ |
| `can` | L3631 | L3823 | ✅ |
| `isDentistMode` | L5257 | L5511 | ✅ |
| `renderDentistMode` | L5362 | L5616 | ✅ |
| `isStaffMode` | L5950 | L6204 | ✅ |
| `renderStaffMode` | L6027 | L6281 | ✅ |

`schemaVersion` : `10` dans les deux fichiers (ainsi que les jalons de migration `5` et `6`,
inchangés).

Le diff complet (497 lignes) ne touche que : deux lignes CSS de base (82, 86), le bloc CSS
Activité financière (178-191), le bloc Design System (678-855), l'objet `paths` de `icon()`,
`renderHome()`, la barre d'outils Rapports (×2), `_renderQuickView()`, le bouton calendrier de
Charge, et l'ajout des 13 tests DS. **Aucun moteur, aucune mutation d'état, aucune règle de
permission ou de workflow n'est atteint.**

`node --check` sur le script principal extrait (728 482 caractères) : **OK**.

**Point de vigilance sans impact :** `returnMoreHTML` (ligne 5253) vaut `''` depuis V3.8 et
n'est plus interpolé dans le template — variable morte, aucune donnée perdue.

**Correction de libellé, à noter comme amélioration :** `Messages (${msgCount})` devient
`${msgCount} non lu${msgCount>1?'s':''}`. `msgCount = unreadForOrderConversations(o.id)`
(ligne 5194) : le nouveau libellé est **plus exact** que l'ancien. Il produit toutefois
« 0 non lu » quand il n'y a rien à lire.

---

## 9. Console

### ✅ Zéro `pageerror`, zéro `console.error`

Scénarios couverts en session réelle : chargement (1440 px et 390 px) ; navigation sur les
vues Accueil / Commandes / Charge / Rapports ; ouverture de la fiche commande depuis une ligne
de tableau ; ouverture du menu `[…]` ; ouverture de la side-window « Bloquer la commande »
depuis ce menu ; **clic réel dans le `<textarea>`** ; Escape ; ouverture du panneau Messages ;
sélection d'une conversation ; bascule `data-theme` light ↔ dark (× 6) ; ouverture de la fiche
commande à 390 px. Aucune erreur remontée sur l'ensemble.

### ✅ Régression V3.8.8 « clic dans un textarea ferme le panneau » : toujours absente

Mesure : `panelStillOpenAfterTextareaClick = true` après `textarea.click()` réel (pas un
`dispatchEvent` synthétique) dans le panneau Bloquer ouvert depuis le nouveau menu `[…]`.

---

## 10. Accessibilité et interaction clavier

### ✅ A1 — Focus outline préservé

`button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}`
(ligne 86) toujours présente et non surchargée par le bloc Design System (aucune règle
`outline:none` ni `outline:0` ajoutée).

### ✅ A2 — Le déclencheur `[…]` est atteignable au clavier

`<button class="row-menu-btn df-btn-icon" data-row-menu="…" aria-label="Plus d'actions">` :
`tagName=BUTTON`, `tabIndex=0`, `aria-label` présent. Focus programmatique → `outline: 2px solid`. ✅

### ✅ A3 — Escape ferme les pop-ups `.quick-layer`

`before=true` → `after=false` après `keydown{key:'Escape'}`.

### 🟡 A4 — Les cellules « Activité financière » ne sont pas activables au clavier

**Ligne 5251 :** `<article class="df-finance-cell" data-view="invoices" title="…">` — élément
non focusable, sans `role="button"` ni `tabindex="0"`, alors que `cursor:pointer` et un
gestionnaire délégué le rendent cliquable. Ce n'est **pas une régression** (le `revKpi` de
V3.8.8 était déjà un `<article>` avec `style="cursor:pointer"`), mais le §30-31 réécrivait
intégralement ce markup et l'occasion de corriger n'a pas été saisie.

### 🟡 A5 — Le menu permanent (V1) casse la navigation clavier

Corollaire de V1 : le popover étant toujours rendu, ses quatre boutons sont dans l'ordre de
tabulation en permanence, même quand l'utilisateur n'a jamais ouvert le menu. Un utilisateur au
clavier traverse 4 actions destructives (dont « Annuler la commande ») avant d'atteindre le
contenu de la fiche.

---

## 11. Divergence LAB / CABINET / STAFF

### ✅ Aucune altération structurelle

`isDentistMode`, `renderDentistMode`, `isStaffMode`, `renderStaffMode` sont **byte-identiques**
à V3.8.8 (cf. §8). Aucune ligne du diff ne touche `#portal`, `#staff-portal`,
`renderStaffMode`, `renderDentistMode`, `isScanMode` ni la logique de routage de mode.

**Effets partagés (bénéfiques, conformes au mandat) :**
- `.form-actions` sticky (ligne 848) s'applique à tout `#side-panel-body`, donc aussi aux
  formulaires latéraux ouverts en mode collaborateur.
- `.bubble.lab{background:var(--violet)}` s'applique aussi au portail cabinet. Le markup y
  attribue `.lab` au message **du cabinet** (`m.authorType==='CABINET'?'lab':'cabinet'`), donc
  le violet colore la bulle du dentiste côté portail et celle du labo côté application. Le sens
  reste « communication » des deux côtés — cohérent, mais différent de la description du §2 du
  Design System (cf. C2).

**Réserve sur les tests :** DS07 et DS08, censés couvrir le portail Cabinet et la PWA
Collaborateur, se réduisent à `typeof isDentistMode === 'function'` et
`typeof isStaffMode === 'function' && typeof renderStaffMode === 'function'`. Ils ne rendent
aucun écran, ne mesurent aucune géométrie et ne peuvent détecter aucune régression visuelle.
Ils ne constituent pas une preuve de conformité de ces deux modes. (La conformité est ici
établie autrement, par l'identité octet-à-octet du diff.)

---

## 12. Fiabilité des tests revendiqués

Trois des treize nouveaux tests DS ne peuvent pas échouer sur le défaut qu'ils prétendent
couvrir :

| Test | Ce qu'il prétend | Ce qu'il vérifie réellement |
|---|---|---|
| **DS09** | « aucune couleur codée en dur incompatible dark » | Supprime tous les `rgba()` avant de tester → ne peut voir que des hex. Le seul défaut réel (`--df-shadow-float`, K1) est un `rgba()`. |
| **DS05** | « messages = violet » | Injecte un `<div class="bubble lab">` **synthétique** dans `document.body` et lit sa couleur. Ne prouve pas que le composant est rendu, ni qu'il est visible. |
| **DS07/DS08** | portail Cabinet / PWA Collaborateur conformes | `typeof f === 'function'`. Aucun rendu, aucune mesure. |

Ajouter que **aucun** des 360 tests ne vérifie la visibilité (`display`) d'un popover, ce qui
explique que V1 et V2 — les deux défauts bloquants — soient passés.

---

## Synthèse

| Sévérité | Nombre | Références |
|---|---|---|
| 🔴 Bloquant | 3 | V1, V2, R5 (corollaire de V1) |
| 🟠 Majeur | 6 | V3, D1, D2, S1, C1, P1, K1 |
| 🟡 Mineur / cosmétique | 17 | V4-V7, D3-D4, S2-S5, C3, P3-P4, R3-R4, K2, A4-A5 |
| ✅ Conforme et vérifié | — | métier, console, clavier, sticky footer, dark mode (hors K1), responsive de page, LAB/CABINET/STAFF |

---

## VERDICT: FIX REQUIRED

Le socle est sain — **zéro régression métier**, diff parfaitement contenu, `schemaVersion`
inchangé, zéro erreur console, correctif V3.8.8 intact, dark mode des primitives correct. Mais
la fonctionnalité phare de la version (§35, le menu `[…]` de la fiche commande) est **cassée à
l'affichage** et n'a jamais pu fonctionner comme décrit, sur les deux thèmes et les deux
largeurs testées.

**À corriger, par ordre de priorité :**

1. **[BLOQUANT — V1]** Rétablir le masquage du popover. Ajouter
   `.row-menu-pop[hidden],.df-menu[hidden]{display:none}` (ou retirer `display:flex` de
   `.df-menu` et le porter sur `.df-menu:not([hidden])`). Sans cela le menu `[…]` de la fiche
   commande est ouvert en permanence, ne peut jamais être fermé, et masque le champ **Cabinet**
   à 1440 px comme le champ **Patient** à 390 px.
   *Réf. : CSS ligne 748 × markup ligne 5248.*

2. **[BLOQUANT — V2]** Résoudre le conflit de cascade `.row-menu-pop button` (ligne 267,
   spécificité 0-1-1) vs `.df-menu-item` (ligne 749, 0-1-0). Soit remonter la spécificité
   (`.row-menu-pop .df-menu-item`), soit remplacer `height:38px` par `min-height:38px`. En
   l'état, « Bloquer la commande » et « Annuler la commande » débordent de 5 px et leurs
   libellés se chevauchent.

3. **[MAJEUR — K1]** Dériver `--df-shadow-float` d'un token de thème (ligne 697) : le popover
   et `.df-card.interactive:hover` n'ont aucune élévation visible en dark. **Et corriger le test
   DS09** (ligne 14994), qui strippe les `rgba()` et ne peut donc pas détecter ce type de défaut
   — son PASS ne garantit rien.

4. **[MAJEUR — P1]** Étendre le footer sticky à `renderInvoicePreviewPanel` (ligne 9397) :
   `.invoice-preview-foot` n'est pas `.form-actions` et ses six actions (« Émettre la facture »,
   « Envoyer au cabinet », « Pointer »…) ne sont pas ancrées. Corriger en conséquence
   l'affirmation « sur **tous** les formulaires latéraux » dans le Rapport d'implémentation et
   le Changelog. Supprimer au passage `.df-drawer-foot` (ligne 821), doublon exact et inutilisé
   de la règle ligne 848.

5. **[MAJEUR — C1 + S1]** Deux incohérences de documentation/token à trancher :
   (a) la modification non déclarée de `.thread-item` (ligne 82) est morte — l'écraser
   définitivement ou la retirer, et l'ajouter au Changelog si elle est conservée ;
   (b) supprimer `style="font-size:14px"` (ligne 5275) qui contredit `.df-section-title`
   (ligne 780) et introduire un vrai modificateur de taille.

**Recommandé, non bloquant :** aligner la hauteur de `#print-report` sur `.segmented` (V3, écart
mesuré 38 px vs 42 px) ; supprimer les ~45 règles `.df-*` jamais instanciées ou les instancier
(D1) ; supprimer le breakpoint mort ligne 191 (R3) et la règle dark redondante ligne 840 (K2) ;
dédupliquer les trois paires d'icônes au tracé identique (V7) ; corriger le débordement
pré-existant de `.week-day` à 390 px, aggravé de 16 à 39 px par la restructuration (R4).

---

*Audit réalisé sans modification d'aucun fichier du dépôt, hors création du présent document.
Captures d'écran et scripts d'instrumentation conservés dans le répertoire de travail temporaire
de la session.*
