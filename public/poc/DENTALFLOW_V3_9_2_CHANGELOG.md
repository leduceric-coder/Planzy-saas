# DentalFlow V3.9.2 — Changelog

**Base :** `dentalflow-next-poc-v3.9.1.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.2.html`
**Mandat :** Finalisation du Design System — traitement des points restants de
`DENTALFLOW_V3_9_0_OPUS_AUDIT.md` (hors ceux déjà corrigés en V3.9.1)
**schemaVersion :** 10 (inchangé)

Cette version est une **finalisation**, pas une nouvelle refonte : aucune fonctionnalité
ajoutée, aucun changement de schéma, de navigation, de workflow ou de moteur métier.
Les 13 fonctions métier citées par la mission restent **strictement identiques
(byte-à-byte)** à V3.9.1. Aucune suppression massive de classes Design System — seules
les 4 suppressions explicitement demandées ont été faites.

## Corrigé

- **`--df-shadow-float` invisible en dark mode (K1 de l'audit).** Le token n'avait qu'une
  valeur claire (`rgba(20,32,55,...)`), quasi invisible sur fond sombre. Ajout d'une
  valeur dédiée dans `html[data-theme="dark"]` et le bloc `prefers-color-scheme:dark` /
  `data-theme="system"`, avec un halo blanc à 6% pour rester lisible sur les fonds
  sombres saturés. Supprimé en même temps la règle
  `html[data-theme="dark"] .df-menu{background:...;border-color:...}`, strictement
  redondante avec la règle `.df-menu` de base qui utilise déjà ces mêmes tokens (K2).
- **DS09 structurellement aveugle aux couleurs `rgba()` (Partie B).** L'ancien test
  supprimait tous les `rgba(...)` de son analyse avant de chercher des couleurs
  codées en dur — il n'aurait donc jamais pu détecter le bug K1 ci-dessus. Réécrit pour
  mesurer le DOM réel (`getComputedStyle`) sous les deux thèmes et vérifier que
  l'ombre du menu est visible et diffère bien entre light et dark, que les surfaces de
  section diffèrent, et que le texte reste lisible dans les deux cas.
- **Pied de panneau facture non sticky (D2/P1 de l'audit).** `.invoice-preview-foot`
  (jusqu'à 4 actions réelles selon le statut) n'était pas couvert par le patron sticky
  déjà en place pour `.form-actions`. Étendu le même sélecteur
  (`#side-panel-body .form-actions,#side-panel-body .invoice-preview-foot`) au lieu de
  créer un 3ᵉ système concurrent. Supprimé `.df-drawer-foot` (dupliqué, jamais
  instancié dans le markup).
- **Contradictions de typographie dans la fiche commande (S1-S5 de l'audit).** Le
  `style="font-size:14px"` en ligne sur `.df-section-title` (16px par défaut)
  contredisait directement la règle de base — remplacé par un modificateur explicite
  `.df-section-title.sm`. Les libellés de sous-section (« Commentaires », « Messages
  liés ») utilisaient la même classe que les libellés de champ (`.df-info-item-label`)
  — remplacés par une classe dédiée `.df-subsection-title` pour distinguer visuellement
  les deux niveaux hiérarchiques. Les marges en dur (14px, 10px, 8px, 4px) remplacées
  par les tokens `--df-space-*`. Le conteneur flex en ligne du bloc « Messages liés »
  remplacé par une classe `.df-group-row` nommée. La valeur de commentaire en
  `pre-wrap`/`font-weight:600` en ligne remplacée par un modificateur `.prose`. Portée
  strictement limitée à la fiche commande, aucun nettoyage global du fichier.
- **Bande de semaine (Plan de charge) qui déborde à 390px, pire qu'en V3.8.8 (R3/R4).**
  `.week-strip` utilisait `repeat(7,1fr)` sans `minmax(0,1fr)` ni `min-width:0` sur les
  cellules, ce qui empêchait le grid de se comprimer sous sa largeur de contenu.
  Corrigé avec `minmax(0,1fr)` + `min-width:0` sur `.week-strip` et `.week-day`, plus un
  resserrement des tailles de police/paddings sous 430px. `.week-day.today`/`.week-day.due`
  utilisaient des couleurs de fond claires en dur (`--blue`/`--orange` à faible opacité
  non tokenisée) — remplacées par `--df-blue-soft`/`--df-orange-soft`, correctement
  définis en dark mode.
- **Toolbar Rapports désalignée de 4px (V3 de l'audit).** `#print-report` (38px) ne
  correspondait pas à la hauteur de `.segmented` (~42px). Harmonisé via une classe
  partagée `.report-toolbar-btn` (42px, mêmes paddings/flex) au lieu d'un style en
  ligne isolé. `#open-charge-cal` migré vers une classe partagée `.icon-label-btn`
  plutôt que de la géométrie de bouton en ligne.
- **Cellules « Activité financière » non accessibles au clavier (A4/A5 de l'audit).**
  Les 4 cellules de l'Accueil n'étaient ni focusables ni activables sans souris.
  Ajouté `role="button"`, `tabindex="0"`, un style `:focus-visible`, et étendu
  l'écouteur clavier générique existant (déjà utilisé pour les jours d'absence
  approuvés) pour déclencher `.click()` sur Entrée/Espace — sans toucher à
  `computeRevenueKPIs()` ni aux attributs `data-view`/`data-open-paid-history`.
  Supprimé au passage la règle de breakpoint 420px pour `.df-finance-grid`, identique
  à celle de 899px déjà présente.
- **Boutons de fermeture sans `aria-label` (P3/P4 de l'audit).** 4 boutons
  `.quick-close`/`#quick-close` (popup article/stock, 3 étapes de l'assistant Données)
  n'avaient pas de nom accessible — ajouté `aria-label="Fermer"` sur chacun.
- **Règle CSS morte sur les fils de discussion (C1 de l'audit).**
  `.thread-item.active,.thread-item:hover{background:rgba(139,92,246,.06)}` n'était
  jamais visible (toujours écrasée par les règles `var(--surface-hover)`/
  `var(--surface-selected)` définies plus loin) et utilisait une couleur non tokenisée.
  Supprimée — les règles fonctionnelles existantes restent l'unique source de vérité.

## Non traité (documentation uniquement, hors périmètre de cette finalisation)

- **Alias d'icônes (`bag`/`purchase`, `check`/`success`, `truck`/`supplier`, D3/D4 de
  l'audit).** Ces doublons sont intentionnels : la V3.9.0 exigeait explicitement une
  icône `purchase` nommément distincte même si visuellement identique à `bag`, pour
  garder le sens sémantique de l'appel indépendant du rendu visuel. Non modifié — un
  changement risquerait de casser des appels existants sans bénéfice visible.
- **~45 classes `.df-*` documentées mais jamais instanciées (D1 de l'audit).**
  Explicitement laissées en l'état — la mission interdit toute suppression massive du
  Design System ; ce sont des primitives disponibles pour de futures pages, pas du code
  mort à supprimer aveuglément.

## Non-régression

- **377/377 tests persistés PASS** (367 hérités de V3.9.1, intégralement conservés sans
  modification, + 10 nouveaux : DSFINAL01-DSFINAL10 couvrant l'ombre dark, le footer
  facture sticky, la typographie Quick View, le débordement de la bande de semaine, la
  hauteur toolbar Rapports, l'accessibilité clavier finance, les `aria-label` de
  fermeture, la règle morte thread, le rejeu de la garde menu DSMENU01, et le contraste
  Quick View en dark).
- **Playwright réel (Partie N) : 210/210 vérifications PASS** sur 7 pages (Accueil,
  Commandes, Quick View, Rapports, Factures, Messages, Charge) × 7 largeurs (1440,
  1366, 1024, 768, 430, 390, 375) × 3 thèmes (light/dark/system), interactions réelles
  (clic, focus, Entrée/Espace, Escape, ouverture/fermeture panneaux) — 0 erreur console.
- **Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite
  complète.**
- **13 fonctions métier vérifiées byte-identiques à V3.9.1** :
  `computeRevenueKPIs`, `kpiCounts`, `blockOrder`, `moveOrderToStage`,
  `orderStatusInfo`, `filteredOrders`, `notifColor`, `userPermissions`, `can`,
  `isDentistMode`, `renderDentistMode`, `isStaffMode`, `renderStaffMode`.
- **Garde du hotfix V3.9.1 reconfirmée intacte** : `.df-menu:not([hidden]){display:flex}`,
  `.row-menu-pop .df-menu-item` (spécificité 0-2-0), `min-height:38px`, test DSMENU01 —
  aucune régression.
- `node --check` PASS sur les 5 blocs `<script>`.
- Zéro erreur console sur l'ensemble des scénarios testés (light, dark, system).
