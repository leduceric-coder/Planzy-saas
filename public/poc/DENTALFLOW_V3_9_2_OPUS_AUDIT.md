# DentalFlow V3.9.2 — Audit QA indépendant (Opus)

**Fichier audité :** `public/poc/dentalflow-next-poc-v3.9.2.html` (15 657 lignes)
**Base de comparaison :** `public/poc/dentalflow-next-poc-v3.9.1.html` (15 394 lignes)
**Documents confrontés :** `DENTALFLOW_V3_9_2_CHANGELOG.md`,
`..._IMPLEMENTATION_REPORT.md`, `..._TEST_REPORT.md`, et l'audit de référence
`DENTALFLOW_V3_9_0_OPUS_AUDIT.md`
**Nature :** audit adversarial de troisième itération — chaque affirmation des livrables a
été revérifiée contre le fichier réel et, quand c'était possible, contre le DOM vivant.
Aucun fichier du dépôt modifié, hors création du présent document.

## Méthode

1. Diff intégral V3.9.1 → V3.9.2 : **411 lignes de diff, 357 lignes `<`/`>`** — lu en
   entier, ce qui permet d'affirmer avec certitude ce qui a été touché.
2. Extraction et comparaison octet-à-octet du corps des **13 fonctions métier** nommées
   par la mission, par appariement de accolades sur les deux fichiers.
3. `node --check` sur les **5 blocs `<script>`** extraits par regex.
4. **Exécution réelle sous Chromium headless** (Playwright 1.56.1,
   `/opt/pw-browsers/chromium`) : 9 scripts d'instrumentation, `getComputedStyle` /
   `getBoundingClientRect` / `Range.getBoundingClientRect` sur le DOM vivant, largeurs
   **1440 px et 390 px**, thèmes **light / dark / system (`prefers-color-scheme:dark`)`**,
   navigation clavier réelle (`page.keyboard.press`), écoute `pageerror` + `console.error`.
5. **Exécution de la suite persistée** (`?runTests=1`) — 5 fois sur V3.9.2, 4 fois sur
   V3.9.1 — pour mesurer le résultat réel et la stabilité.
6. **Test de mutation** : réinjection à chaud du bug K1 (valeur d'ombre light forcée en
   dark) pour vérifier que le DS09 réécrit n'est pas un test vide.
7. Contrôle d'isolation : état métier sérialisé avant/après la suite complète.
8. `git show --stat` pour vérifier que V3.9.1 n'a pas été touchée.

---

## 1. Vérification des 10 points du mandat

### ✅ 1 — `--df-shadow-float` genuinement theme-aware, règle dark redondante supprimée

Les deux blocs dark définissent une **vraie** valeur, différente de la valeur claire :

| Contexte | Valeur mesurée sur `document.documentElement` |
|---|---|
| `:root` (light) | `0 14px 34px rgba(20,32,55,.14),0 2px 8px rgba(20,32,55,.08)` |
| `html[data-theme="dark"]` | `0 16px 40px rgba(0,0,0,.48),0 2px 10px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.06)` |
| `@media(prefers-color-scheme:dark) html[data-theme="system"]` | idem (mesuré sous `colorScheme:'dark'`) ✅ |

Mesure sur le popover réellement ouvert (`.qv-actions-bar [data-row-menu]` cliqué) :

```
light  boxShadow : rgba(20,32,55,0.14) 0 14px 34px, rgba(20,32,55,0.08) 0 2px 8px
dark   boxShadow : rgba(0,0,0,0.48) 0 16px 40px, rgba(0,0,0,0.34) 0 2px 10px,
                   rgba(255,255,255,0.06) 0 0 0 1px      ← halo de séparation présent
system boxShadow : identique à dark                      ← les 3 modes couverts
```

La règle `html[data-theme="dark"] .df-menu{background:…;border-color:…}` est **absente**
du fichier (0 occurrence ; seul un commentaire documente sa suppression). K1 et K2 de
l'audit V3.9.0 sont réellement corrigés.

### ✅ 2 — DS09 est devenu un test qui peut échouer (démonstration par mutation)

Le corps de DS09 ne contient plus aucune regex sur le CSS source. Il ouvre la fiche
commande, ouvre le menu contextuel, lit `getComputedStyle(pop).boxShadow`,
`getComputedStyle(section).backgroundColor` et la couleur du titre, sous
`state.theme='light'` puis `'dark'`, et assemble 5 critères indépendants.

**Preuve que ce n'est pas un test vide** — j'ai réinjecté le bug K1 à chaud
(`html[data-theme="dark"],html[data-theme="system"]{--df-shadow-float:<valeur light> !important}`
via `addInitScript`) puis relancé la suite complète :

```
WITH SIMULATED K1 REGRESSION -> total 377  fails 2
  FAIL: DS09 : Theme token integrity  → dark.menuShadow == light.menuShadow
  FAIL: DSFINAL01 : shadow            → light === dark
```

C'est le contre-exemple exact que l'ancien DS09 laissait passer. La correction de la
Partie B tient, et elle tient pour la bonne raison.

*Réserve mineure :* le critère `textReadableBothThemes` n'atteste pas d'une lisibilité
(aucun calcul de contraste) mais seulement que les deux couleurs sont non vides et
différentes. Le nom du critère est plus ambitieux que son contenu ; les 4 autres
critères, eux, sont réellement discriminants.

### ✅ 3 — Pied de facture sticky, patron canonique unique, `.df-drawer-foot` réellement mort

Sélecteur unique, étendu et non dupliqué :

```css
#side-panel-body .form-actions,#side-panel-body .invoice-preview-foot{
  position:sticky;bottom:0;background:var(--df-surface);padding-top:14px;
  margin-top:20px;border-top:1px solid var(--df-border);z-index:5}
```

`.df-drawer-foot` : **0 occurrence** dans tout le fichier (CSS, JS et markup) — la seule
correspondance textuelle est le commentaire qui en documente la suppression.

**Vérification en scroll réel** (le test DSFINAL02 ne le prouve pas, cf. §2-F4) — viewport
1440×520, les 3 factures du jeu de démo, `#side-panel-body` réellement défilable
(`scrollHeight 463 > clientHeight 443`) :

| Facture | Statut | Actions | `position` | top avant scroll | top après scroll | dans le panneau |
|---|---|---|---|---|---|---|
| FAC-JXXL9Y | DRAFT | 3 | sticky | 431 | **431** | ✅ |
| FAC-QMNUES | SENT | 4 | sticky | 431 | **431** | ✅ |
| FAC-PQX49C | PAID | 3 | sticky | 431 | **431** | ✅ |

Le pied ne bouge pas pendant que le corps défile : le collage est réel, pas seulement
déclaré. La correction du chiffre de l'audit (« 4 actions max, pas 6 ») est exacte : la
lecture de `renderInvoicePreviewPanel` donne 3 boutons en `DRAFT`, 4 en `ISSUED`/`SENT`,
3 en `PAID`.

### ✅ 4 — Typographie Quick View : corrigée, et la portée ne fuit pas

- `style="font-size:…"` sur `.df-section-title` : **0 occurrence**. Le markup porte
  `class="df-section-title sm"`, avec `.df-section-title.sm{font-size:14px}` ;
  `getComputedStyle` mesure **14 px** sur les 5 titres de groupe.
- `.df-subsection-title` distingue réellement les deux niveaux (mesures dark) :

| Élément | font-size | font-weight | color | text-transform |
|---|---|---|---|---|
| `.df-subsection-title` | **13 px** | 800 | `rgb(245,245,247)` | none |
| `.df-info-item-label` | 11 px | 800 | `rgb(161,161,166)` | **uppercase** |

  Deux styles nettement distincts — V6 de l'audit V3.9.0 est traité.
- **Portée de `.df-section+.df-section` — le point sensible.** Comptage exact des jetons
  de classe : le fichier ne contient que **6** `class="df-section"`. Cinq sont les groupes
  de la Quick View, la sixième est `financeSection` (Accueil) et elle est **seule** : elle
  n'a aucun frère `.df-section`, ni de `.qv-actions-bar`/`.quick-head` la précédant. La
  règle ne peut donc pas fuir. Vérifié aussi en rendu : les marges de `financeSection`
  restent celles de son `style="margin-top:14px"` d'origine, inchangées.
- Les deux compléments du sélecteur (`.qv-actions-bar+.df-section`,
  `.quick-head+.df-section`) couvrent correctement les deux formes réelles de la fiche
  (barre d'actions présente, ou absente pour une commande annulée/livrée sans action).
  Mesuré : les 5 sections rendent **`margin-top:16px`** de façon uniforme, à 1440 px comme
  à 390 px — l'ancien comportement (5× `margin-top:14px` inline) est reproduit sans trou.

### ✅ 5 — Débordement 390 px corrigé (mesuré, pas seulement lu) et tokens dark corrects

CSS conforme : `.week-strip{grid-template-columns:repeat(7,minmax(0,1fr));…;min-width:0}`
et `.week-day{…;min-width:0}`.

**Mesure réelle en Chromium à 390×844, fiche commande ouverte :**

```
document.scrollWidth 375  <=  clientWidth 390     (pas de débordement de page)
.quick-card   scrollWidth 329  ==  clientWidth 329   (le défaut R4 de l'audit est corrigé)
.week-strip   scrollWidth 201  ==  clientWidth 201
gridTemplateColumns : 7 × 26.14px  (les pistes se compriment bien sous leur min-content)
```

Rappel de l'audit V3.9.0 : `.quick-card` mesurait `368 / 329`. On est à `329 / 329`. La
correction est réelle et vérifiée sur le navigateur, pas déduite du CSS.

Tokens jour, mesurés :

| | light | dark | system(dark) |
|---|---|---|---|
| `.week-day.today` | `rgba(37,99,255,.12)` | `rgba(10,132,255,.16)` | `rgba(10,132,255,.16)` ✅ |
| `.week-day.due` | `rgba(255,138,29,.16)` | `rgba(255,159,10,.16)` | `rgba(255,159,10,.16)` ✅ |

Plus aucun `#eef4ff` / `#fff6ea` codé en dur. Le défaut dark signalé en note du §7 de
l'audit V3.9.0 (« la cellule aujourd'hui reste sur fond clair en dark ») est corrigé.

*Un résidu subsiste dans ce même composant — voir 🟡 F1.*

### ✅ 6 — Toolbar Rapports alignée, mesuré en computed styles

```
1440 px : .segmented 42.0px | #print-report 42.0px | delta 0 | même top (161.5 / 161.5)
 390 px : .segmented 42.0px | #print-report 42.0px | delta 0
```

Le bouton ne porte plus **aucun** style en ligne (`getAttribute('style') === null`), sa
géométrie vient de `.report-toolbar-btn`. La cascade est correcte : `.ghost{height:38px}`
est déclarée ligne 82, `.report-toolbar-btn{height:42px}` ligne 95 — même spécificité,
la seconde gagne par ordre de source. Les 3 autres règles `.ghost` du fichier sont soit
plus restrictives (`.staff-header-actions .ghost`), soit hors périmètre (feuille
d'impression), et ne perturbent pas le résultat. `.report-toolbar` ne déborde pas
(`scrollWidth == clientWidth` aux deux largeurs).

`#open-charge-cal` : migré vers `.icon-label-btn`, déclarations strictement équivalentes
à l'ancien style en ligne (`display:inline-flex;align-items:center;gap:6px`) — hauteur
mesurée 38 px, inchangée, conforme à la justification du rapport (pas de contrôle voisin
à aligner dans cette rangée).

### ✅ 7 — Cellules finance accessibles au clavier, `computeRevenueKPIs` intacte

Markup : `<article class="df-finance-cell" role="button" tabindex="0" …>` sur les **4**
cellules (3 × `data-view="invoices"`, 1 × `data-open-paid-history`), toutes les 4 avec
`extraAttrs` correctement passé.

**Navigation clavier réelle** (`page.keyboard.press`, pas un `dispatchEvent` synthétique) :

```
Tab ×15 depuis body        → activeElement = .df-finance-cell,
                             outline 2px solid  (la règle :focus-visible s'applique)
Enter sur cellule facture  → state.view === 'invoices'      ✅
Espace sur cellule facture → state.view === 'invoices'      ✅
Enter sur cellule "Réglé"  → #quick-layer.open === true     ✅ (popup historique)
```

Le gestionnaire ajouté est bien gardé (`if(e.key!=='Enter'&&e.key!==' ')return`), placé
après le `return` du cas `[data-approved-absence-day]` (aucun conflit possible entre les
deux familles), et se contente d'un `.click()` qui retraverse le délégué existant : aucune
logique de navigation dupliquée.

**`computeRevenueKPIs` : byte-identique.** Extraction par appariement d'accolades sur les
deux fichiers → `len 1216 / 1216`, chaînes strictement égales.

### ✅ 8 — `aria-label` ajoutés sans casser le reste

Exactement **4** boutons modifiés, confirmé par diff V3.9.1 → V3.9.2 :
1 × `#quick-close` de la popup article/stock, 3 × `[data-wizard-close]` (Données : accueil,
export, import). Après correction, **13 / 13** des `.quick-close` du fichier portent
`aria-label="Fermer"` :

```
1 data-ddetail-close · 1 data-dinvoice-close · 3 data-wizard-close
7 id="quick-close"   · 1 id="tooth-picker-close"      → tous étiquetés
```

Aucun `data-*`, `id` ni gestionnaire de clic n'a été déplacé ou modifié sur ces boutons.
Fermeture des popups revérifiée en session réelle : `#quick-layer` s'ouvre et se ferme
normalement, 0 erreur console.

### ✅ 9 — Règle CSS morte supprimée, règles fonctionnelles intactes

`.thread-item.active,.thread-item:hover{background:rgba(139,92,246,.06)}` : **absente**.
Les règles fonctionnelles sont toutes présentes et inchangées :

```css
.thread-item:hover{background:var(--surface-hover)}
.thread-item.active{background:var(--surface-selected)}
.thread-item.active,html[data-theme="dark"] .thread-item:hover{background:var(--surface-soft)}
```

Mesure vivante d'un fil sélectionné : `rgb(230,239,254)` — identique à la valeur relevée
dans l'audit V3.9.0. Aucun changement visuel, comme annoncé.

### ✅ 10 — Le hotfix V3.9.1 n'est pas régressé

Présents et inchangés dans V3.9.2 :

```css
.df-menu:not([hidden]){display:flex}
.row-menu-pop .df-menu-item{display:flex;align-items:center;gap:10px;min-height:38px;…}
```

`DSMENU01` : présent (3 occurrences textuelles), rejoué par `DSFINAL09`. Vérification
comportementale en session réelle sur la fiche commande :

| Phase | `hidden` | `display` | hauteur |
|---|---|---|---|
| à l'ouverture de la fiche | true | **none** | 0 |
| après clic sur `[…]` | false | flex | 175.98 |
| après clic extérieur | true | **none** | 0 |

Et le défaut V2 (chevauchement des libellés) reste corrigé : aucun des 4 items ne déborde
(`scrollHeight <= clientHeight+1`), « Bloquer la commande » / « Annuler la commande »
occupent 40.7 px grâce à `min-height`, à 1440 px comme à 390 px.

---

## 2. Défauts relevés

Aucun défaut P0/P1. Les points ci-dessous sont tous des résidus cosmétiques ou des
imprécisions de documentation/test.

### 🟡 F1 — Résidu visuel dans la bande de semaine à 390 px : le libellé « Échéance » déborde de sa case

Le débordement **de conteneur** visé par l'audit (R4) est bien corrigé
(`.quick-card` 329/329). Il reste un débordement **de texte** à l'intérieur d'une case,
mesuré au `Range` sur le DOM vivant à 390 px :

| Enfant | boîte | texte rendu | dépassement | débord à droite de la case |
|---|---|---|---|---|
| `.wd-tag` « **Échéance** » | 19.5 px | **46.3 px** | +26.8 px | **+23.8 px** |
| `.wd-tag` « Auj. » | 19.5 px | 17.9 px | — | — |
| `.wd-n` « Sam » | 19.5 px | 23.6 px | +4.1 px | +1.2 px |

« Échéance » est un mot insécable de 8 px de fonte dans une case de 19.5 px de contenu,
sans `overflow`/`hyphens`/troncature : il empiète d'environ 24 px sur la case du jour
suivant. `scrollWidth 50 / clientWidth 24` sur cette cellule le confirme.

**Impact :** cosmétique, visible sur la fiche commande à 390 px quand l'échéance tombe
dans la semaine courante. Aucun débordement de page, de carte ou de grille ; aucune
donnée inaccessible.
**Pourquoi DSFINAL04 ne le voit pas :** il ne mesure que `scrollWidth` de `.quick-card` et
`.week-strip`, jamais celui de `.week-day`. Ajouter
`[...document.querySelectorAll('.week-day')].every(d=>d.scrollWidth<=d.clientWidth+1)`
suffirait à le couvrir.
**Piste :** raccourcir le libellé (« Éch. ») ou ajouter `overflow:hidden;text-overflow:clip`
sur `.wd-tag` sous 430 px.

### 🟡 F2 — DSFINAL07 ne teste aucun des 4 boutons qu'il est censé couvrir

Le test s'appelle « **toutes** les fermetures `.quick-close` portent un `aria-label` non
vide » et le Rapport d'implémentation (§215-217) annonce « pour chaque `.quick-close`
visible, vérifie un `aria-label` non vide ». En réalité il n'ouvre que trois écrans —
Quick View commande, historique de paiement, effectif — et **les trois portaient déjà un
`aria-label` en V3.9.1** (vérifié : 6 des 7 `id="quick-close"` étaient déjà étiquetés).
Les 4 boutons réellement corrigés (popup article/stock + 3 étapes de l'assistant Données)
ne sont ouverts par aucun de ces trois chemins.

Conséquence : **le test passerait toujours si la correction de la Partie H était annulée.**
Il contient de surcroît une ligne morte,
`const staticCheck=[...document.querySelectorAll('.quick-close')].every(()=>true)` —
toujours `true`, jamais utilisée dans `pass`.

C'est exactement le motif que la réécriture de DS09 était censée éliminer. **La correction
elle-même est réelle** (13/13 vérifiés à la source) ; c'est la preuve qui manque.

### 🟡 F3 — DSFINAL08 : le nom promet plus que l'assertion

`test('DSFINAL08 : thread actif — background = surface-selected, jamais l'ancien rgba
violet mort')` retourne `{pass:noDeadRule}` : seule l'absence de la chaîne du sélecteur
mort est vérifiée. `activeColor` est mesuré (`rgb(230,239,254)`) mais jamais comparé à
`var(--surface-selected)`. Le premier membre du nom n'est pas testé.

### 🟡 F4 — DSFINAL02 : la partie « après scroll » est vide au viewport du harnais

Au viewport de la suite (1440×900), `#side-panel-body` mesure
`scrollHeight 723 === clientHeight 723` : il **ne défile pas**. Le `body.scrollTop =
body.scrollHeight` du test est donc un no-op et `visibleAfterScroll` est vrai par
construction. Seuls `position:sticky` et `bottom:0px` sont réellement prouvés par ce test.
(J'ai vérifié le collage réel indépendamment à 1440×520 — cf. §1-3 — donc le **produit**
est bon ; c'est la couverture qui est plus faible qu'annoncée. Un viewport court dans le
test suffirait.)

### 🟡 F5 — Les livrables se contredisent sur « aucun test hérité modifié »

- Changelog, ligne 91 : « 367 hérités de V3.9.1, **intégralement conservés sans
  modification** ».
- Implementation Report, ligne 298 : « ajoutés **sans modifier ni retirer aucun** des 367
  tests hérités de V3.9.1 ».
- Test Report, ligne 23 : « 360 hérités de V3.9.0, **tous conservés sans aucune
  modification de leur code** ».

C'est faux : **DS09 a été entièrement réécrit** (~12 lignes remplacées par ~30) — ce que
les trois mêmes documents décrivent par ailleurs en détail et à juste titre. Il s'agit
d'une incohérence interne de rédaction, pas d'une dissimulation, mais la formulation
« 367 hérités conservés sans modification » est inexacte telle qu'écrite. Le décompte
correct est : 366 conservés à l'identique + 1 réécrit + 10 nouveaux = 377.

### 🟡 F6 — La liste « PRIMITIVES DISPONIBLES » range `.df-modal-*` parmi les non instanciées

Implementation Report, Partie J-bis : `.df-modal-*` figure dans les primitives « non (ou
partiellement) instanciées ». Comptage exact des jetons de classe du markup :
`class="df-modal-head-left"` apparaît **2 fois** (`groupHead` de la Quick View et
`financeSection` de l'Accueil). La classe est donc bel et bien adoptée — et adoptée
**hors de toute modale**, ce qui était précisément le défaut D3 de l'audit V3.9.0. Ce
point n'est ni corrigé (choix défendable dans une finalisation) ni correctement documenté
(il est classé du mauvais côté de la distinction que la Partie J-bis crée exprès pour
éviter les surclaims).

Le reste de la distinction tient : `.df-avatar`, `.df-badge`, `.df-card`, `.df-kpi`,
`.df-empty-state`, `.df-table`, `.df-field`, `.df-drawer-head`, `.df-btn-primary/-ghost/
-danger`, `.df-section-actions` sont bien à **0** usage markup, comme annoncé, et
`.df-drawer-foot` a été retirée du lot plutôt que laissée en doublon. La formule « le
Design System n'est **pas** entièrement généralisé » est honnête et bienvenue.

### 🟡 F7 — Styles en ligne réintroduits ou laissés dans les zones retouchées

La Partie D revendique « 0 style de police en ligne restant » (vrai) et le remplacement
des marges en dur par les tokens (vrai **dans la Quick View**). Restent, dans le périmètre
touché :

- `<div class="df-subsection-title" style="margin-bottom:0">` (bloc « Messages liés ») —
  un style en ligne neutralisant le `margin-bottom:8px` de la classe qui vient d'être
  créée pour supprimer les styles en ligne. Un modificateur (`.df-subsection-title.flush`)
  aurait été cohérent avec la démarche.
- `<div class="invoice-preview-foot" style="margin-top:16px">` — écrase le `margin-top:20px`
  du patron sticky partagé qui vient d'être étendu à ce conteneur (sans conséquence sur le
  collage, mais le « patron canonique unique » n'est pas tout à fait unique en pratique).
- `<section class="df-section" style="margin-top:14px">` sur `financeSection` (Accueil) —
  non tokenisé, cohérent avec la portée annoncée mais laisse deux échelles d'espacement
  côte à côte pour la même primitive (14 px Accueil / 16 px Quick View).

### 🟡 F8 — La tokenisation des marges n'est pas iso-pixel

`--df-space-1..4` valent `4 / 8 / 12 / 16 px`. Les remplacements ne sont donc neutres que
pour deux d'entre eux :

| Avant | Après | Delta |
|---|---|---|
| `margin-top:14px` (×5 sections + QR) | `--df-space-4` = 16px | **+2 px** |
| `margin-top:10px` (×2) | `--df-space-3` = 12px | **+2 px** |
| `margin-top:8px` | `--df-space-2` = 8px | 0 |
| `margin-top:4px` | `--df-space-1` = 4px | 0 |

Changement voulu et sans danger, mais le mot « remplacées par les tokens » du Changelog
laisse entendre une refactorisation à rendu identique, ce qu'elle n'est pas tout à fait.

### 🟡 F9 — Commentaire CSS inexact sur `.df-finance-cell:focus-visible`

```css
/* … focus visible déjà hérité de la règle globale button:focus-visible. */
.df-finance-cell:focus-visible{outline:2px solid var(--accent-2);outline-offset:-2px}
```

Un `<article role="button">` n'est pas un `<button>` : la règle globale
`button:focus-visible,input:focus-visible,…` ne le sélectionne pas. La règle ajoutée n'est
donc **pas** un renfort d'un style déjà hérité, elle est la **seule** source de l'anneau de
focus sur ces cellules (mesuré : `outline 2px solid` au Tab réel — donc le code est bon,
c'est le commentaire qui est trompeur pour un futur mainteneur tenté de la supprimer).

### 🟡 F10 — Information : test hérité instable, pré-existant

Le test « Scénario métier complet V1.2.1 » a échoué **1 fois sur 4** exécutions de
**V3.9.1** (`qtyAfter:null`, `moved:false`) et **0 fois sur 5** exécutions de V3.9.2. Il
s'agit d'un flake hérité, indépendant de cette version (aucune des lignes du diff ne le
touche), mais il mérite d'être connu : le « 377/377 » revendiqué repose sur une suite qui
contient au moins un test non déterministe.

---

## 3. Confirmé propre (contrôles au-delà des 10 points)

### ✅ C1 — Zéro régression métier : 13/13 fonctions byte-identiques

Extraction par appariement d'accolades sur les deux fichiers, comparaison de chaînes :

| Fonction | V3.9.1 | V3.9.2 | Longueur | Identique |
|---|---|---|---|---|
| `computeRevenueKPIs` | L4611 | L4691 | 1216 | ✅ |
| `kpiCounts` | L4514 | L4594 | 254 | ✅ |
| `blockOrder` | L8919 | L9006 | 821 | ✅ |
| `moveOrderToStage` | L8184 | L8271 | 52 | ✅ |
| `orderStatusInfo` | L4215 | L4295 | 67 | ✅ |
| `filteredOrders` | L4528 | L4608 | 326 | ✅ |
| `notifColor` | L9493 | L9580 | 197 | ✅ |
| `userPermissions` | L3840 | L3920 | 166 | ✅ |
| `can` | L3845 | L3925 | 68 | ✅ |
| `isDentistMode` | L5533 | L5614 | 93 | ✅ |
| `renderDentistMode` | L5638 | L5719 | 2510 | ✅ |
| `isStaffMode` | L6226 | L6307 | 89 | ✅ |
| `renderStaffMode` | L6303 | L6384 | 1534 | ✅ |

La revendication « 13/13 IDENTICAL » du Test Report est exacte, longueurs comprises.

### ✅ C2 — Le diff est parfaitement contenu

357 lignes `<`/`>`, lues intégralement. Les seules modifications JS sont :
`financeCell` (2 attributs a11y), `#print-report` (×2, style en ligne → classe),
`#open-charge-cal` (style en ligne → classe), 8 fragments de template de `_renderQuickView`
(classes/tokens), le gestionnaire `keydown` (branche `.df-finance-cell` ajoutée après un
`return`), 4 `aria-label`, la réécriture de DS09 et l'ajout de DSFINAL01-10.
**Aucun moteur, aucune mutation d'état, aucune règle de permission ou de workflow n'est
atteint.** `schemaVersion` = 10 dans les deux fichiers.

### ✅ C3 — `node --check` : 5/5 blocs `<script>` OK

Extraction par regex `<script[^>]*>(.*?)</script>`, écriture en fichiers temporaires,
`node --check` sur chacun : aucune erreur de syntaxe.

### ✅ C4 — Suite persistée : 377/377, reproductible

5 exécutions indépendantes en contexte Chromium neuf : **377 tests, 0 échec** à chaque
fois. Les 12 tests clés (DS09, DSMENU01, DSFINAL01-10) retournent tous `pass:true` avec
des valeurs mesurées cohérentes avec mes propres relevés (`segH:42, btnH:42, delta:0` ;
`position:"sticky", bottom:"0px"` ; `offenders:0` ; `navigatedOnEnter/Space:true` ;
`bg:"rgba(10,132,255,0.16)", readable:true` ; DSFINAL09 `checked:9`, tous `display:"none"`).

### ✅ C5 — Isolation d'état réelle

Protocole : chargement normal → snapshot des 17 collections métier ; rechargement →
snapshot identique (base déterministe confirmée) ; rechargement en `?runTests=1` →
snapshot après les 377 tests.

```
baseline stable across reload : true
state identical after full suite : true   (39 702 == 39 702 caractères)
theme après suite : "system"  (restauré)   data-theme : "system"
```

Les manipulations agressives des nouveaux tests (`state.theme` basculé 6 fois,
`openQuickView`/`closeQuickView`, `renderSidePanel`, `state.view` déplacé) ne laissent
**aucune** mutation durable sur les données. `state.view` finit sur `planning` — mais
c'est déjà le cas en V3.9.1, donc pré-existant et non imputable.

### ✅ C6 — Console : zéro erreur

`pageerror` et `console.error` écoutés sur l'ensemble des scénarios : chargement
1440/390, thèmes light/dark/system, ouverture/fermeture de la fiche commande, ouverture et
fermeture du menu `[…]`, ouverture de l'aperçu facture sur les 3 factures avec scroll,
navigation Accueil/Commandes/Rapports/Charge, `Tab` ×15, `Enter`/`Espace` sur les
cellules finance, ouverture du panneau Messages, suite complète de 377 tests.
**0 erreur relevée.**

### ✅ C7 — V3.9.1 non modifiée

`git show --stat 231a49b` : le commit V3.9.2 est **purement additif** (4 fichiers, 16 224
insertions, 0 suppression). `dentalflow-next-poc-v3.9.1.html` n'apparaît dans aucun commit
postérieur à `555f089`. La base de comparaison est intacte, comme annoncé.

### ✅ C8 — Aucun nouveau conflit de cascade introduit

- `.report-toolbar-btn` (ligne 95) vs `.ghost` (ligne 82) : même spécificité, la seconde
  déclaration gagne — comportement voulu, vérifié par mesure (42 px).
- `.df-section-title.sm` : aucune règle `.sm` nue dans le fichier, aucun risque de
  collision avec `.df-btn.sm` / `.df-iconbox.sm` (toutes composées).
- `.df-info-item-value.prose` : la seule règle `.prose` du fichier est celle-ci ; aucun
  `.prose` générique préexistant.
- `.df-group-row` posée sur `.df-info-item` : déclarations disjointes sauf `margin-bottom`,
  déclarée plus loin donc gagnante — conforme à l'intention.
- La suppression du breakpoint `@media(max-width:420px){.df-finance-grid{…}}` est sans
  effet (il dupliquait à l'identique la règle `≤899px`), R3 de l'audit V3.9.0 traité.

---

## Synthèse

| Sévérité | Nombre | Références |
|---|---|---|
| 🔴 Bloquant | **0** | — |
| 🟠 Majeur | **0** | — |
| 🟡 Mineur / cosmétique / documentation | 10 | F1 (débord texte 390 px), F2-F4 (couverture de 3 tests inférieure à leur nom), F5-F6 (imprécisions des livrables), F7-F9 (résidus de style et commentaire), F10 (flake hérité) |
| ✅ Conforme et vérifié | — | 10/10 points du mandat, métier, console, isolation, clavier, sticky réel, dark/system, responsive 390 px, hotfix menu, `node --check`, intégrité de la base V3.9.1 |

Les 10 points du mandat sont **tous** vérifiés conformes, et pour huit d'entre eux la
vérification a été faite sur le DOM vivant plutôt que sur le CSS source. Les huit défauts
de l'audit V3.9.0 restant à traiter (V3, D2, S1-S3, C1, P1/P4, K1/K2, R3, A4/A5, plus la
note dark sur `.week-day`) sont réellement corrigés dans le fichier, pas seulement dans la
documentation. Le test de mutation démontre que la correction la plus subtile — la
réécriture de DS09 — a effectivement rendu la suite capable de détecter le bug qu'elle
laissait passer.

Les réserves portent sur trois tests dont le nom est plus large que l'assertion
(DSFINAL02/07/08), sur deux formulations inexactes des livrables (F5 « aucun test
modifié », F6 `.df-modal-*`), et sur un résidu visuel de 24 px sur un libellé à 390 px.
Aucune de ces réserves ne remet en cause une correction : dans les trois cas de tests
faibles, j'ai vérifié le comportement du produit par une autre voie et il est correct.

**Recommandations, non bloquantes :**
1. Renforcer DSFINAL07 (ouvrir la popup article et les 3 étapes de l'assistant Données)
   et DSFINAL08 (assertion sur `activeColor`), exécuter DSFINAL02 à viewport court.
2. Ajouter la mesure `.week-day.scrollWidth` à DSFINAL04 et traiter F1
   (`overflow:hidden` ou libellé « Éch. » sous 430 px).
3. Corriger la phrase « 367 tests hérités conservés sans modification » (F5) et reclasser
   `.df-modal-head-left` en composant adopté (F6).
4. Corriger le commentaire de `.df-finance-cell:focus-visible` (F9), qui invite à
   supprimer une règle indispensable.

---

## VERDICT: PASS

Aucun défaut P0/P1, aucune régression métier (13/13 fonctions byte-identiques, état
sérialisé strictement identique avant/après la suite complète, `schemaVersion` inchangé),
aucun bug responsive bloquant (`.quick-card` passe de 368/329 à **329/329** à 390 px),
aucun bug dark mode majeur (l'ombre du popover est visible et distincte sous
`dark` **et** `system`, tokens `week-day` correctement thématisés), aucun défaut de
modale/side-window (le pied de l'aperçu facture est réellement collé sous scroll réel,
sur le patron canonique unique, et `.df-drawer-foot` a bien disparu du fichier), et le
correctif de menu V3.9.1 est intact et vérifié en interaction réelle.

Les revendications de test tiennent à la vérification indépendante : 377/377 reproduits
5 fois, `node --check` 5/5, zéro erreur console, et — preuve la plus forte — la
réinjection à chaud du bug K1 fait bien **échouer** DS09 et DSFINAL01, ce que l'ancien
DS09 n'aurait pas fait.

Les 10 points relevés sont des P2 : un résidu visuel de libellé à 390 px, trois tests dont
la portée est inférieure à leur intitulé (sans que le produit soit en défaut, vérifié
séparément), deux imprécisions rédactionnelles dans les livrables et quatre résidus
cosmétiques. Conformément au mandat, ils sont documentés mais ne bloquent pas.

---

*Audit réalisé sans modification d'aucun fichier du dépôt, hors création du présent
document. Scripts d'instrumentation Playwright (9 passes) conservés dans le répertoire de
travail temporaire de la session.*
