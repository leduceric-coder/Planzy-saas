# DentalFlow V3.9.0 — Changelog

**Base :** V3.8.8 (conservée intacte) · **schemaVersion :** 10 (inchangé)

Refonte graphique globale (Design System) — aucune fonctionnalité métier ajoutée,
supprimée ou modifiée. Voir `DENTALFLOW_V3_9_0_DESIGN_SYSTEM.md` pour la référence
visuelle complète et `DENTALFLOW_V3_9_0_IMPLEMENTATION_REPORT.md` pour le détail
page par page.

## Ajouté

- **Design System central** (`--df-*`) : tokens de surfaces, textes, bordures,
  couleurs sémantiques (+ fonds pastel), rayons, ombres, espacements, transitions —
  tous dérivés des tokens de thème existants (fonctionne automatiquement en
  light/dark/system).
- **Primitives visuelles** : `.df-iconbox`, `.df-avatar`, `.df-btn-*`, `.df-menu`/
  `.df-menu-item`, `.df-badge`, `.df-card`, `.df-section`, `.df-kpi`, `.df-empty-state`,
  `.df-info-grid`/`.df-info-item`, `.df-modal-*`, `.df-drawer-*`, `.df-table`,
  `.df-field-*`.
- **27 icônes** ajoutées à `icon(kind)`, réutilisant les tracés de navigation existants
  quand ils existent.
- **Accueil — Activité financière** : la ligne CA/À facturer/Facturé/Réglé devient une
  section explicite avec iconbox et fond commun, appartenant visuellement à la page
  (au lieu d'une rangée détachée). Mêmes valeurs, mêmes clics.
- **Fiche commande — 5 groupes** : Commande / Travail / Production / Communication /
  Traçabilité, avec une action principale mise en avant et les actions secondaires
  (Bloquer/Annuler/Reprise/Imprimer) regroupées dans un menu `[…]`.
- **Side-window — footer d'action constant** : Annuler/Enregistrer restent visibles
  sans scroller, sur tous les formulaires latéraux de l'application.

## Corrigé

- **Couleur des messages** : la bulle de message laboratoire et le bouton d'envoi
  utilisaient le bleu (couleur de navigation/production) au lieu du violet
  (couleur de communication, §5/§38 du Design System) — corrigé aux deux endroits où
  la règle était dupliquée dans le CSS.
- **2 icônes emoji** (🖨️ Imprimer/PDF, 📅 Vue calendrier) remplacées par `icon()`.
- Débordement du menu `[…]` de la fiche commande hors de la carte quand aucune action
  principale n'était affichée — corrigé pendant les tests (voir Test Report).

## Non-régression

- 360/360 tests persistés PASS (347 hérités de V3.8.8 + 13 nouveaux Design System),
  dont les 347 tests V3.8.8 conservés sans aucune modification de leur code (à
  l'exception d'un ajustement de markup pour COM02, comportement du test inchangé).
- 4 scripts Playwright hérités de V3.8.8 (interaction réelle DOM) rejoués à l'identique
  contre V3.9.0 : 0 échec, 0 erreur console.
- Responsive 21/21, thèmes 18/18, isolation JSON identique avant/après suite complète.
- Zéro erreur console sur l'ensemble des scénarios testés.
- Aucun changement de `state` métier, `schemaVersion`, moteurs Stocks/Achats/
  Production, calculs KPI/CA, Facturation, pointage, traçabilité, QR, scan, congés,
  simulation, capacité, permissions, notifications, workflow commande, confidentialité
  patient, portail cabinet, PWA collaborateur, persistance, migrations, import/export.
