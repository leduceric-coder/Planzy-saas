# DentalFlow V3.9.3 — Implementation Report

**Base :** `dentalflow-next-poc-v3.9.2.html`
**Fichier livré :** `dentalflow-next-poc-v3.9.3.html`
**Mandat :** Remplacer l'organisation historique (navigation principale + accordéon
« Outils ») par l'architecture PRINCIPAL / GESTION / ADMINISTRATION, sans toucher au
métier.

## 1. Architecture retenue

### Avant (V3.5 → V3.9.2)

```js
const PRIMARY_NAV=['home','orders','production','messages'];
const TOOLS_NAV=['planning','stock','reports','invoices','cabinets','users'];
```
+ un bouton `nav-tools-toggle` repliable (`state.toolsOpen`), un sous-conteneur
`.nav-tools` avec `display:none` par défaut, un chevron animé.

### Après (V3.9.3)

```js
const NAV_GROUPS=[
  {id:'primary',label:'Principal',items:['home','orders','production','messages']},
  {id:'management',label:'Gestion',items:['planning','stock','invoices']},
  {id:'administration',label:'Administration',items:['reports','cabinets','users']}
];
```
`NAV_ITEMS` (labels/routes/SVG/badges) n'a **pas été touché dans son contenu** —
seul son regroupement change. `navItemHTML(k)` est réutilisée sans modification.
`renderNav()` a été réécrite pour itérer `NAV_GROUPS` et injecter, pour chaque
groupe, un conteneur `.nav-group` avec un `.nav-group-title` suivi des boutons
d'items — **une seule fonction `navHTML()` partagée**, appelée une fois pour
`#side-nav` et une fois pour `#mobile-side-nav`, exactement comme l'ancienne
implémentation (le principe « source canonique unique » énoncé dans les commentaires
V3.7 est repris à l'identique, pas seulement respecté par accident).

**CAUSE.** La mission fournit l'architecture cible explicitement (§5) — reprise
verbatim, sans ajustement.
**FIX.** Voir ci-dessus.
**TEST.** NAV01 vérifie que `NAV_GROUPS` contient exactement ces 3 groupes, ces
labels, et cet ordre d'items.
**RESULT.** PASS.

## 2. Suppression de l'accordéon (§3, §22, §26, §27)

**CAUSE.** Le concept UX « Outils » (bouton + chevron + sous-arborescence repliable)
ne doit plus exister à l'écran — remplacé par 3 groupes toujours visibles.

**FIX.**
- CSS : suppression complète du bloc `.nav-tools`/`.nav-tools.open`/`.nav-tools
  .side-item`/`.nav-tools-toggle .nav-tools-caret`/`.nav-tools-toggle.open
  .nav-tools-caret`/`.nav-tools-toggle.child-active`/`.nav-collapsed
  .nav-tools-caret` (11 lignes retirées, aucune règle laissée orpheline).
- JS : `toolsActive()` supprimée (plus aucun indicateur `child-active` à calculer,
  il n'y a plus de bouton à indiquer). Le bloc `renderNav()` qui construisait le
  bouton chevron + `<div class="nav-tools">` est remplacé par la boucle
  `NAV_GROUPS.map(...)` ci-dessus.
- Handler de clic global : la ligne `if(e.target.closest('#nav-tools-toggle')||
  e.target.closest('#mnav-tools-toggle')){state.toolsOpen=!state.toolsOpen;
  renderNav();return}` est supprimée (plus aucun élément à cibler).
- Handler de navigation (clic sur un item réel) : la ligne
  `if(TOOLS_NAV.includes(state.view))state.toolsOpen=true;` est supprimée — elle
  n'avait plus de sens sans accordéon à rouvrir.
- Listener du drawer mobile : `if(it&&!it.classList.contains('nav-tools-toggle'))
  closeMobileNav()` simplifié en `if(it)closeMobileNav()` — il n'existe plus de
  bouton `nav-tools-toggle` à exclure de la fermeture automatique.

**TEST.** NAV03 (sidebar desktop) et NAV08 (drawer mobile) vérifient tous deux
l'absence littérale du texte « Outils » dans le conteneur de navigation. NAV04
vérifie que les 10 liens apparaissent directement, dans l'ordre attendu, sans
wrapper intermédiaire.
**RESULT.** PASS — confirmé aussi par lecture du diff complet V3.9.2→V3.9.3 (aucune
référence résiduelle à `TOOLS_NAV`/`PRIMARY_NAV`/`toolsActive`/`nav-tools*` en dehors
d'un commentaire de compatibilité documentant `state.toolsOpen`, voir §7).

## 3. Titres de groupe, espacements, icônes (§9-11)

**CAUSE.** La maquette validée demande des titres de groupe discrets (11px, gras,
majuscules visuelles), un espacement resserré mais aéré entre groupes (22-28px) et à
l'intérieur d'un groupe (4-6px), et des icônes légèrement plus présentes (19-20px).

**FIX.**
```css
.nav-group-title{font-size:11px;line-height:1;color:#7c879c;font-weight:850;
  text-transform:uppercase;letter-spacing:.07em;margin:0 0 10px 12px}
.side-nav{display:flex;flex-direction:column;gap:24px}
.nav-group{display:flex;flex-direction:column;gap:5px}
.side-item svg{width:19px;height:19px;color:#51617f;flex:0 0 auto}
```
La marge gauche du titre (12px) est alignée sur le `padding-left` des boutons
d'item (`.side-item{padding:0 12px}`) — choix délibéré : aligner strictement sur le
début du *texte* des items (après icône 19px + gap 12px, soit ~43px) aurait produit
un titre visuellement détaché du bloc d'icônes qui le suit, ce qui n'était pas
l'esprit de la maquette. Documenté ici comme interprétation assumée du §10 plutôt
que laissé implicite.

**TEST.** NAV11 (géométrie) vérifie qu'aucun item ni badge ne déborde la sidebar.
Le script Playwright dédié mesure la largeur réelle de la barre active et la
position des items à 1440px et 1024px.
**RESULT.** PASS.

## 4. État actif — barre verticale (§12)

**CAUSE.** La maquette demande, en plus du fond bleu doux déjà existant, une barre
verticale bleue discrète (~3px) à gauche de l'item actif, sans provoquer de
décalage ni sortir de la zone sidebar.

**FIX.**
```css
.side-item.active::before{content:"";position:absolute;left:-8px;top:8px;
  bottom:8px;width:3px;border-radius:3px;background:var(--accent)}
```
`position:relative` existait déjà sur `.side-item`. `left:-8px` place la barre dans
la marge gauche du `.nav-block` (padding 20px en mode normal, 12px en mode réduit)
— jamais hors de la sidebar, vérifié par mesure `getBoundingClientRect()`. La
couleur utilise `var(--accent)`, déjà theme-aware (`#2563ff` en light, `#0A84FF` en
dark) — aucune règle dark-mode séparée n'a été nécessaire.

**TEST.** NAV05 (persisté) vérifie que la barre est visible (largeur ≠ 0,
`background-color` ≠ transparent) sur l'item actif et qu'un seul item est actif à
la fois lors d'un changement de vue. NAV12 revérifie la barre sous les 3 thèmes.
Le script Playwright dédié mesure `getComputedStyle(btn,'::before')` en conditions
réelles à 1440px et 1024px et confirme que l'item reste dans les limites de la
sidebar.
**RESULT.** PASS.

## 5. Sidebar réduite et drawer mobile (§19-23)

**CAUSE.** Le comportement de réduction existant doit être conservé ; en mode
réduit les titres de groupe doivent disparaître, les icônes et badges rester
visibles, et une séparation légère entre groupes doit subsister par l'espace (pas
par du texte). Le drawer mobile doit afficher directement les 3 groupes, sans clic
supplémentaire, et rester utilisable à 430/390/375px (scroll vertical, footer
visible, aucun débordement horizontal).

**FIX.** `.nav-collapsed .nav-group-title{display:none}` (remplace l'ancienne règle
`.nav-collapsed .nav-title{display:none}`). Le `gap:24px` de `.side-nav` fournit
la séparation par l'espace demandée sans qu'aucune règle supplémentaire ne soit
nécessaire — vérifié visuellement et par mesure (icônes toujours 10, tooltips
`title` conservés). Le drawer mobile réutilise la même fonction `navHTML()` — sa
structure (scroll vertical natif sur `.mobile-drawer-body{overflow-y:auto}`, pied
`#mobile-drawer-foot`) n'a pas été modifiée, seul son contenu change.

**TEST.** NAV07 (persisté) : sidebar réduite → titres cachés, 10 icônes, tooltips
présents. NAV08/NAV09 (persisté) : contenu du drawer + navigation + fermeture. Le
script Playwright dédié reproduit ces vérifications en conditions réelles à
430/390/375px, plus l'absence d'overflow horizontal et la visibilité du footer.
**RESULT.** PASS.

## 6. Badges et permissions (§14-16, §24-25)

**CAUSE.** Les badges métier (`side-planning-count`, `side-stock-count`, etc.) et
leurs calculs ne doivent subir aucune modification ; si la navigation filtrait déjà
par permission, ce filtrage devait être conservé à l'identique.

**ANALYSE.** Lecture de `navItemHTML()`/`renderNav()` en V3.9.2 : aucun filtrage par
permission n'existait — tous les items étaient (et restent) affichés à tout
utilisateur LAB connecté, quel que soit `userPermissions(currentUser())`. Le
réagencement en 3 groupes ne pouvait donc ni retirer ni ajouter d'accès.
`updateNotif()` (calcul des badges) n'a pas été touchée — les `badgeId` restent
strictement identiques dans `NAV_ITEMS`.

**FIX.** Aucun changement de logique nécessaire ; seule la position visuelle des
badges (héritée, `margin-left:auto`) a été conservée sans modification.

**TEST.** NAV06 (persisté) compare la valeur affichée sur les badges Charge et
Stock à la valeur calculée indépendamment par le moteur
(`stockSummaryV34().critical`, nombre de congés `pending`). NAV10 (persisté) compare
l'ensemble des liens visibles pour `U1` (Responsable labo) et `U3` (Prothésiste
CFAO, droits plus restreints) — identiques dans les deux cas, confirmant qu'aucun
accès n'a été élargi ni restreint par le nouveau regroupement.
**RESULT.** PASS.

## 7. Compatibilité état persisté (§4, §28)

**CAUSE.** Un ancien état localStorage peut contenir `state.toolsOpen` (booléen).
La mission interdit toute migration et tout changement de `schemaVersion`.

**FIX.** Aucune lecture de `state.toolsOpen` ne subsiste dans le code de rendu —
la propriété, si présente dans un état ancien, est simplement ignorée (elle reste
dans l'objet `state` mais n'influence plus rien). Un commentaire documente ce choix
à l'endroit de la définition de `NAV_GROUPS` : *« state.toolsOpen (V3.5→V3.9.2) peut
subsister dans un état persisté ancien — legacy/ignoré depuis V3.9.3, aucune
migration nécessaire, schemaVersion inchangé »*. `schemaVersion` reste `10`.

**TEST.** Vérifié par lecture directe : aucune occurrence de `state.toolsOpen` en
dehors de ce commentaire dans tout le fichier livré.
**RESULT.** PASS.

## 8. Non-modifié — vérification explicite (§45-47)

- **PWA Collaborateur / Portail Cabinet** : ni l'un ni l'autre n'utilisent la
  sidebar `#side-nav`/le drawer `#mobile-side-nav` (ils ont leur propre
  navigation). `renderDentistMode` et `renderStaffMode` sont vérifiées
  byte-identiques à V3.9.2 (2510 et 1534 caractères, respectivement) — aucune
  régression possible sur ces deux modes.
- **13 fonctions métier** : extraction et comparaison octet-à-octet contre V3.9.2,
  13/13 identiques (voir `DENTALFLOW_V3_9_3_TEST_REPORT.md` pour le détail).
- **`node --check`** : PASS sur les 5 blocs `<script>`, 0 erreur de syntaxe.
- **Console** : 0 erreur sur l'ensemble des scénarios testés (suite persistée,
  script Playwright dédié, 4 scripts hérités rejoués).

## 9. Définition de fait (Definition of Done, §50)

Tous les points de la checklist mandatée sont vérifiés : accordéon supprimé
visuellement, aucun accordéon résiduel dans le DOM ni dans le code, groupes
Principal/Gestion/Administration dans l'ordre exact demandé, Charge/Stock/Factures
en Gestion, Rapports/Cabinets/Utilisateurs en Administration, source canonique
unique desktop/mobile, routes et permissions inchangées, badges métier inchangés,
icônes légèrement agrandies, état actif amélioré avec barre bleue discrète,
espacements conformes aux fourchettes demandées, footer utilisateur conservé,
sidebar réduite fonctionnelle, drawer mobile fonctionnel, dark/system fonctionnels,
tests de navigation remplacés honnêtement (documentés, pas simplement supprimés),
autres tests non régressés, aucune fonction métier modifiée, `node --check` PASS,
console propre.
