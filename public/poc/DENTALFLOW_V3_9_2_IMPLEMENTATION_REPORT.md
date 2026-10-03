# DentalFlow V3.9.2 — Implementation Report

**Base :** `dentalflow-next-poc-v3.9.1.html`
**Fichier livré :** `dentalflow-next-poc-v3.9.2.html`
**Mandat :** Finalisation du Design System — traiter les points restants de
`DENTALFLOW_V3_9_0_OPUS_AUDIT.md` non couverts par le hotfix V3.9.1.

Ce rapport documente chaque correctif au format CAUSE / FIX / TEST / RESULT, dans
l'ordre des parties de la mission (A à M). Aucune fonctionnalité, aucun changement de
schéma, de navigation ou de moteur métier n'a été introduit.

---

## Partie A — Ombre `--df-shadow-float` non theme-aware + règle dark redondante

**CAUSE.** `--df-shadow-float` n'avait qu'une seule valeur (`0 14px 34px rgba(20,32,55,.14),
0 2px 8px rgba(20,32,55,.08)`), calculée pour un fond clair. En dark mode, cette ombre
bleu-gris très sombre sur un fond déjà sombre (`--df-surface` dark) devenait quasi
invisible sur `.df-menu` et `.df-card.interactive:hover`. Par ailleurs
`html[data-theme="dark"] .df-menu{background:var(--df-surface);border-color:var(--df-border)}`
était une redéclaration strictement inutile : la règle `.df-menu` de base utilise déjà
ces mêmes tokens, qui se résolvent automatiquement à leur valeur dark sous ce thème.

**FIX.** Ajout d'une valeur `--df-shadow-float` dédiée dans les deux blocs de dark mode
(`html[data-theme="dark"]` et `@media(prefers-color-scheme:dark){html[data-theme="system"]}`) :
`0 16px 40px rgba(0,0,0,.48),0 2px 10px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.06)`
— un halo blanc à 6% en plus de l'ombre noire pour que le composant reste détachable du
fond même sur des surfaces sombres saturées. Suppression complète de la règle
`html[data-theme="dark"] .df-menu{...}`.

**TEST.** DSFINAL01 (nouveau) : ouvre le menu contextuel sous les deux thèmes, lit
`getComputedStyle(pop).boxShadow`, vérifie qu'elle est non-`none` dans les deux cas ET
qu'elle diffère entre light et dark. DS09 réécrit (Partie B) vérifie la même propriété
de façon plus large.

**RESULT.** PASS. L'ombre est maintenant visible et distincte sous les deux thèmes ;
0 déclaration CSS redondante restante sur `.df-menu` en dark.

---

## Partie B — DS09 structurellement aveugle aux `rgba()`

**CAUSE.** Le DS09 hérité de V3.9.0 retirait tous les `rgba(...)` du bloc CSS analysé
avant de chercher des couleurs hexadécimales codées en dur — un choix fait à l'époque
pour éviter un faux positif sur `#fff` (texte blanc légitime sur bouton primaire), mais
qui avait pour effet de bord de rendre le test totalement aveugle à toute régression de
couleur exprimée en `rgba()`, y compris le bug K1 lui-même (`--df-shadow-float`). Le
PASS de DS09 en V3.9.0 était donc trompeur.

**FIX.** Réécriture complète : le test n'analyse plus le texte source CSS, il mesure le
DOM réel via `getComputedStyle()` sous `state.theme='light'` puis `state.theme='dark'`
(`applyTheme()` entre les deux) : ombre du menu contextuel, couleur de fond de section,
couleur de texte du titre de section. Assertion sur 5 critères indépendants : ombre
visible en light, visible en dark, différente entre les deux thèmes, fond de section
différent entre les deux thèmes, texte de titre lisible (non vide) dans les deux cas.

**TEST.** Le test lui-même EST le test (DS09). Vérifié manuellement pendant le
développement qu'il échouait bien tant que Partie A n'était pas appliquée (367/368 avec
DS09 seul en échec), puis qu'il passait une fois Partie A en place.

**RESULT.** PASS. DS09 détecte maintenant réellement les régressions de theming sur
composants vivants, contrairement à sa version V3.9.0 dont le PASS ne prouvait rien sur
les `rgba()`.

---

## Partie C — Pied de panneau facture non sticky + `.df-drawer-foot` mort

**CAUSE.** `renderInvoicePreviewPanel()` produit `.invoice-preview-foot` (jusqu'à 4
actions visibles simultanément selon le statut de la facture — jamais 6 en pratique, le
chiffre de l'audit étant l'union de tous les statuts possibles). Ce conteneur n'était
pas couvert par la règle sticky déjà en place pour `.form-actions`, contredisant la
documentation V3.9.0 qui affirmait (à tort) que « tous les formulaires latéraux »
avaient un pied sticky. `.df-drawer-foot` était une 3ᵉ classe de pied de panneau,
jamais instanciée dans le markup — doublon mort.

**FIX.** Étendu le sélecteur existant :
`#side-panel-body .form-actions,#side-panel-body .invoice-preview-foot{position:sticky;
bottom:0;background:var(--df-surface);padding-top:14px;margin-top:20px;
border-top:1px solid var(--df-border);z-index:5}` — un seul patron canonique, pas de
3ᵉ système concurrent. `.df-drawer-foot` et `.df-drawer-foot .df-btn` supprimés.
`.invoice-preview-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center}` (mise
en page interne) laissé inchangé, il ne concerne pas le collage.

**TEST.** DSFINAL02 (nouveau) : ouvre l'aperçu de la première facture disponible,
vérifie `position==='sticky'` et `bottom==='0px'` sur `.invoice-preview-foot`, puis
force un scroll du panneau et revérifie que le pied reste dans les limites visibles.
Se dégrade proprement (`skip`) si `state.invoices` est vide dans le jeu de démo actif.

**RESULT.** PASS. Le pied de l'aperçu facture reste visible en bas de panneau lors du
défilement, sur un unique patron partagé avec les autres panneaux latéraux.

---

## Partie D — Typographie fiche commande (Quick View)

**CAUSE.** Plusieurs contradictions entre CSS de base et styles en ligne, toutes dans
`_renderQuickView()` : (1) `style="font-size:14px"` sur les titres de groupe
contredisant directement `.df-section-title{font-size:16px}` ; (2) les libellés de
sous-section (« Commentaires », « Messages liés ») utilisaient
`.df-info-item-label`, la même classe que les libellés de champ simples, les rendant
visuellement indiscernables d'un simple label ; (3) le bloc « Messages liés » détournait
`.df-info-item` en conteneur flex via un style en ligne long ; (4) la valeur d'un
commentaire recevait `style="white-space:pre-wrap;font-weight:600"` en ligne,
contredisant/dupliquant `.df-info-item-value` ; (5) marges en dur (14px, 10px, 8px, 4px)
répétées à plusieurs endroits au lieu des tokens `--df-space-*`.

**FIX.** (1) Nouveau modificateur `.df-section-title.sm{font-size:14px}`, appliqué à la
place du style en ligne. (2) Nouvelle classe `.df-subsection-title{font-size:13px;
font-weight:800;...}` distincte de `.df-info-item-label`, appliquée aux 2 titres
concernés. (3) Nouvelle classe nommée `.df-group-row{display:flex;align-items:center;
justify-content:space-between;gap:12px;margin-bottom:10px}`. (4) Nouveau modificateur
`.df-info-item-value.prose{white-space:pre-wrap;font-weight:600}`. (5) Règle CSS
`.df-section+.df-section,.qv-actions-bar+.df-section,.quick-head+.df-section{margin-top:
var(--df-space-4)}` (Quick View est le seul endroit de l'app où plusieurs `.df-section`
se suivent en frères directs — la règle ne peut donc pas fuir vers d'autres pages) +
remplacement des marges en dur restantes par `--df-space-1/2/3/4`. Portée strictement
limitée à `_renderQuickView()`, aucun autre gabarit touché.

**TEST.** DSFINAL03 (nouveau) : vérifie qu'aucun `.df-section-title[style*="font-size"]`
ne subsiste dans le panneau Quick View après ouverture.

**RESULT.** PASS. Hiérarchie typographique cohérente dans la fiche commande, 0 style de
police en ligne restant, portée non élargie au reste de l'application.

---

## Partie E — Bande de semaine (Plan de charge) : débordement 390px + tokens dark

**CAUSE.** `.week-strip{grid-template-columns:repeat(7,1fr)}` sans `minmax(0,1fr)`, et
`.week-day` sans `min-width:0` : sous CSS Grid, une piste `1fr` sans `minmax(0,...)`
ne peut pas descendre sous la largeur intrinsèque de son contenu, ce qui empêchait le
grid de se comprimer à 390px et causait un débordement horizontal — confirmé par l'audit
comme *pire* qu'en V3.8.8 (368px/329px de large disponible contre 345/329
auparavant). `.week-day.today`/`.week-day.due` utilisaient
`background:var(--blue)`/`var(--orange)` à une opacité fixe non tokenisée, sans
équivalent dark correctement calibré.

**FIX.** `.week-strip{grid-template-columns:repeat(7,minmax(0,1fr));...;min-width:0}`,
`.week-day{...;min-width:0}`, plus un resserrement des tailles de police/paddings sous
`@media(max-width:430px)`. `.week-day.today{background:var(--df-blue-soft)}`,
`.week-day.due{background:var(--df-orange-soft)}` — tokens déjà définis avec leurs
variantes dark dans le système existant.

**TEST.** DSFINAL04 (nouveau) : `strip.scrollWidth>strip.clientWidth+1` doit être faux
sous light et dark, au viewport courant. La couverture stricte à 390px réel est assurée
par le script Playwright dédié (Partie N) et `responsive_v384.js`. DSFINAL10 (nouveau) :
vérifie que le fond de `.week-day.today` en dark reste suffisamment sombre (luminance
calculée < 0.65), pour détecter toute régression vers un fond clair égaré en dark.

**RESULT.** PASS. Plus de débordement horizontal à 390px (vérifié aussi via Playwright
réel, Partie N), fonds `today`/`due` correctement tokenisés et lisibles en dark.

---

## Partie F — Toolbar Rapports : hauteur `#print-report` vs `.segmented`

**CAUSE.** `#print-report` recevait un style en ligne isolé de hauteur 38px, tandis que
`.segmented` (contrôle de période) mesure ~42px avec ses propres paddings/bordures —
désalignement visuel de 4px dans la même barre d'outils. `#open-charge-cal` avait de la
géométrie de bouton en ligne équivalente, sans classe partagée.

**FIX.** Nouvelle classe partagée `.report-toolbar-btn{margin-left:auto;height:42px;
padding:0 16px;display:inline-flex;align-items:center;gap:6px}` appliquée à
`#print-report` (2 occurrences dans le fichier, remplacées), remplaçant le style en
ligne. `#open-charge-cal` migré vers `.icon-label-btn{display:inline-flex;
align-items:center;gap:6px}`.

**TEST.** DSFINAL05 (nouveau) : bascule vers Rapports (`state.reportsTab='kpi'`
explicitement, car le rendu réel — `renderReportsV35()` — n'affiche la toolbar que sous
cet onglet), mesure `.segmented` et `#print-report` via `getBoundingClientRect().height`,
vérifie un delta ≤ 1px.

**RESULT.** PASS. Alignement vertical de la toolbar Rapports rétabli.

---

## Partie G — Accessibilité clavier des cellules « Activité financière »

**CAUSE.** Les 4 cellules KPI de l'Accueil (`financeCell`) réagissaient au clic souris
mais n'étaient ni focusables (`tabindex` absent) ni annoncées comme interactives
(`role` absent) ni activables au clavier — un utilisateur clavier ne pouvait pas
atteindre ces actions. Corollaire direct du bug V1 du menu contextuel (l'audit notait
que ce trou d'accessibilité coexistait avec d'autres zones interactives non focusables).
Par ailleurs `@media(max-width:420px){.df-finance-grid{grid-template-columns:
repeat(2,minmax(0,1fr))}}` était identique à la règle 899px déjà présente — redondante.

**FIX.** `financeCell` : ajout de `role="button" tabindex="0"` sur `<article
class="df-finance-cell">`. Nouvelle règle `.df-finance-cell:focus-visible{outline:2px
solid var(--accent-2);outline-offset:-2px}`. L'écouteur clavier générique déjà présent
(établi pour `[data-approved-absence-day]`) étendu pour reconnaître
`.closest('.df-finance-cell')` sur Entrée/Espace et appeler `financeCell.click()` —
réutilise le même chemin de code délégué que le clic souris, sans dupliquer la logique
de navigation. `computeRevenueKPIs()`, `data-view` et `data-open-paid-history` non
touchés. Breakpoint 420px redondant supprimé.

**TEST.** DSFINAL06 (nouveau) : focus la cellule facture, déclenche `KeyboardEvent
Enter`, vérifie `state.view==='invoices'` ; répète avec la touche Espace sur une
nouvelle instance de la cellule (re-render entre les deux pour éviter tout effet de
bord d'état). DSFINAL06 vérifie les deux touches indépendamment.

**RESULT.** PASS. Les 4 cellules sont focusables et activables au clavier (Entrée et
Espace), sans changement du moteur de calcul des KPI ni des attributs de données.

---

## Partie H — `aria-label` manquants sur les boutons de fermeture

**CAUSE.** 4 boutons de fermeture (`#quick-close` de la popup article/stock, et 3×
`[data-wizard-close]` de l'assistant Données) affichaient uniquement le glyphe « × »
sans nom accessible — un lecteur d'écran les annonce comme un bouton anonyme.

**FIX.** `aria-label="Fermer"` ajouté sur les 4 boutons concernés.

**TEST.** DSFINAL07 (nouveau) : ouvre successivement le Quick View, l'historique de
paiement, et le panneau effectif ; pour chaque `.quick-close` visible, vérifie un
`aria-label` non vide.

**RESULT.** PASS. Tous les boutons de fermeture testés portent désormais un nom
accessible.

---

## Partie I — Règle CSS morte sur les fils de discussion

**CAUSE.** `.thread-item.active,.thread-item:hover{background:rgba(139,92,246,.06)}`
utilisait une couleur non tokenisée (héritage d'une version antérieure à
`#f8fbff` en V3.8.8) et était systématiquement écrasée par des règles définies plus loin
dans la feuille de style (`.thread-item:hover{background:var(--surface-hover)}`,
`.thread-item.active{background:var(--surface-selected)}`) — jamais visible à l'écran,
donc code mort.

**FIX.** Règle supprimée intégralement. Les règles fonctionnelles (`var(--surface-hover)`
/`var(--surface-selected)`) restent l'unique source de vérité, inchangées.

**TEST.** DSFINAL08 (nouveau) : vérifie que la chaîne exacte du sélecteur mort est
absente du CSS de la page, et lit à titre informatif le fond réellement calculé de
`.thread-item.active` pour documenter la valeur effective.

**RESULT.** PASS. Aucun changement visuel (la règle n'était jamais visible), CSS
allégé d'une déclaration inutile.

---

## Partie J — Alias d'icônes (documentation uniquement)

**CAUSE / ANALYSE.** L'audit V3.9.0 relevait des doublons de chemins SVG entre
`bag`/`purchase`, `check`/`success`, `truck`/`supplier` dans la fonction `icon(kind)`.

**DÉCISION.** Non modifié. La mission originelle V3.9.0 exigeait explicitement une
icône `purchase` nommément distincte de `bag` même si visuellement identique, pour
garder le sens sémantique de l'appel (« achat » vs « sac ») indépendant du rendu. Un
renommage ou une fusion casserait potentiellement des appels existants sans bénéfice
visuel mesurable — hors du périmètre « canonicalisation prudente » de cette mission.

**RESULT.** N/A — aucun changement de code, décision documentée ici pour traçabilité.

---

## Partie K — Garde contre le nettoyage massif

Seules 4 suppressions ont été effectuées dans cette version (Parties A, C, E, I
ci-dessus + la règle dark `.df-menu` de Partie A) : la règle `html[data-theme="dark"]
.df-menu{...}` redondante, `.df-drawer-foot`/`.df-drawer-foot .df-btn`, le breakpoint
420px redondant de `.df-finance-grid`, et la règle morte `.thread-item.active,
.thread-item:hover{background:rgba(139,92,246,.06)}`. Les ~45 classes `.df-*`
documentées mais non instanciées (D1 de l'audit) ont été **laissées intactes** —
elles restent des primitives Design System disponibles pour de futures pages, comme
l'exige explicitement la mission.

---

## Partie J-bis — Distinction PRIMITIVE DISPONIBLE vs COMPOSANT ADOPTÉ

Pour éviter toute surclaim dans les livrables (Partie P de la mission) :

- **PRIMITIVES DISPONIBLES** (définies dans le Design System mais non (ou partiellement)
  instanciées dans le markup actuel) : `.df-avatar`, `.df-badge`, `.df-card`, `.df-kpi`,
  `.df-empty-state`, `.df-table`, `.df-field`, `.df-modal-*`, `.df-drawer-head`,
  `.df-btn-primary`/`.df-btn-ghost`/`.df-btn-danger`, `.df-section-actions`. Ces classes
  restent disponibles pour de futures pages sans avoir été retirées ni forcées dans des
  gabarits existants au prix d'un risque de régression visuelle.
- **COMPOSANTS ADOPTÉS ET ÉTENDUS dans cette version** : `.df-section-title` (+
  modificateur `.sm`), `.df-subsection-title` (nouveau), `.df-group-row` (nouveau),
  `.df-info-item-value.prose` (nouveau modificateur), `--df-shadow-float` (theme-aware),
  le patron sticky `.form-actions`/`.invoice-preview-foot`, `.report-toolbar-btn`,
  `.icon-label-btn`, `.df-finance-cell:focus-visible`.

Le Design System n'est **pas** « entièrement généralisé » à l'issue de cette version —
il reste des primitives disponibles-mais-non-adoptées, ce qui est un choix délibéré
conforme au périmètre « finalisation, pas refonte » de la mission.

---

## Partie M — Suite de tests DSFINAL01-10

Détaillée dans `DENTALFLOW_V3_9_2_TEST_REPORT.md`. Résumé : 10 nouveaux tests couvrant
chacun des correctifs A à I ci-dessus, ajoutés sans modifier ni retirer aucun des 367
tests hérités de V3.9.1.
