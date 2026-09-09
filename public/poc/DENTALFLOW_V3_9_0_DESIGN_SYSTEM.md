# DentalFlow V3.9.0 — Design System

**Base :** `dentalflow-next-poc-v3.8.8.html` (conservée intacte)
**Fichier livré :** `dentalflow-next-poc-v3.9.0.html`
**Mandat :** Refonte graphique globale — cohérence visuelle, AUCUNE modification métier
**schemaVersion :** 10 (inchangé)

Ce document est la référence visuelle de DentalFlow. Il documente le système créé en
V3.9.0 et sert de base à la future version SaaS (§99 du mandat).

Principe directeur : **HARMONISER, pas RÉINVENTER**. Le Design System s'appuie sur les
tokens de thème déjà en place (`--surface-1`, `--accent`, `--success`, `--warning`,
`--danger`, `--violet`, `--border`...) — il ne les remplace jamais, il les organise et
les rend réutilisables sous un nom commun (`--df-*`). Tout composant qui consomme ces
tokens fonctionne automatiquement en light/dark/system sans dupliquer la logique de
thème.

---

## 1. Tokens

Section explicite dans le CSS : `/* ===== DENTALFLOW DESIGN SYSTEM V3.9 ===== */`.

### Surfaces
| Token | Valeur |
|---|---|
| `--df-bg` | `var(--bg-app)` |
| `--df-surface` | `var(--surface-1)` |
| `--df-surface-soft` | `var(--surface-2)` |
| `--df-surface-hover` | `var(--surface-hover)` |
| `--df-surface-selected` | `var(--surface-selected)` |

### Textes
`--df-text` (`--text-primary`), `--df-text-secondary` (`--text-secondary`),
`--df-text-muted` (`--text-tertiary`).

### Bordures
`--df-border` (`--border`), `--df-border-strong` (`--border-strong`).

### Couleurs sémantiques (§5 — sens unique)
| Token | Valeur | Sens |
|---|---|---|
| `--df-blue` | `var(--accent)` | Action / activité / production / sélection |
| `--df-green` | `var(--success)` | Réussi / prêt / livré / payé / valide |
| `--df-orange` | `var(--warning)` | Attention / bloqué / à surveiller |
| `--df-red` | `var(--danger)` | Retard / erreur / critique / destructif |
| `--df-purple` | `var(--violet)` | Communication / message |
| `--df-neutral` | `var(--neutral)` | Terminé neutre / archivé / secondaire |

### Surfaces sémantiques (fonds pastel)
`--df-blue-soft`, `--df-green-soft`, `--df-orange-soft`, `--df-red-soft`,
`--df-purple-soft`, `--df-neutral-soft` — valeurs `rgba()` alignées sur les teintes déjà
utilisées par `.pill`/`.stock-kpi-ico`/`.notification-icon` (aucune nouvelle palette
inventée), avec un jeu de valeurs plus contrastées sous `html[data-theme="dark"]` et
`system` (media `prefers-color-scheme:dark`).

### Rayons
`--df-radius-xs` (8px), `--df-radius-sm` (10px), `--df-radius-md` (14px),
`--df-radius-lg` (20px), `--df-radius-pill` (999px).

### Ombres
`--df-shadow-card` (`var(--shadow)`), `--df-shadow-float` (survol/popover),
`--df-shadow-overlay` (`var(--shadow-strong)`, modales/drawers).

### Espacements
`--df-space-1` (4px) à `--df-space-8` (40px), échelle ×2 progressive.

### Transitions
`--df-motion-fast` (140ms), `--df-motion-normal` (200ms), `--df-ease`
(`cubic-bezier(.22,.61,.36,1)` — identique à l'easing déjà utilisé par les animations
de modales V3.8.6).

---

## 2. Règle des couleurs (§5)

BLEU = action/navigation/production/sélection · VERT = réussi/prêt/payé · ORANGE =
attention/bloqué · ROUGE = retard/erreur/destructif · VIOLET = communication · GRIS =
terminé/archivé/secondaire.

**Corrections apportées en V3.9.0** pour aligner l'existant sur cette règle unique :

- **Messages = violet** (§38, §67) : `.bubble.lab` (bulle de message côté laboratoire)
  et `.composer button` (envoyer) passent de bleu (`--accent`) à violet (`--violet`).
  Auparavant les messages utilisaient la même couleur que la navigation/production,
  contredisant §5. Le centre de notifications utilisait déjà correctement violet pour
  la catégorie `messages` (`notifColor()`, hérité, vérifié conforme — aucun changement
  nécessaire).
- Les autres invariants (retard=rouge, bloqué=orange, prêt/livré=vert,
  annulé=gris, production=bleu) étaient déjà conformes depuis V3.8.2/V3.8.3
  (`.ovs-*`, `.pill`) — vérifiés, non modifiés.

---

## 3. Iconographie (§6)

`icon(kind)` (base script, déjà l'architecture en place depuis V3.7+) est enrichi de
27 nouvelles entrées, chacune réutilisant EXACTEMENT le tracé SVG de l'icône de
navigation correspondante quand elle existe (`NAV_ITEMS`) — jamais un second dessin
pour la même notion :

`home, order, production, planning, purchase, invoice, report, cabinet, user, search,
filter, edit, archive, delete, download, upload, print, money, comment, location,
supplier, settings, more, close, chevron, blocked, success`.

Deux usages d'emoji fonctionnel remplacés par `icon()` (§6 : « interdit emoji comme
pictogramme fonctionnel ») : le bouton « Imprimer / PDF » de Rapports (🖨️→`icon('print')`)
et « Vue calendrier » de Charge (📅→`icon('calendar')`). Les symboles typographiques
courts déjà en place (✓/✕/⚠ comme marque de validation inline, pas comme bouton
d'action) sont conservés — ce ne sont pas des pictogrammes fonctionnels au sens du
mandat, et les toucher représenterait un risque de régression sans bénéfice visuel réel
(convention déjà établie, cohérente).

---

## 4. Composant Icon Box (§7)

`.df-iconbox` — squircle, fond pastel, icône colorée, sans effet cartoon.

Variantes couleur : `.blue .green .orange .red .purple .neutral`.
Tailles : `.sm` (32px), `.md` (44px), `.lg` (56px).

---

## 5. Boutons (§13-14)

`.df-btn` + `.df-btn-primary` (bleu), `.df-btn-secondary` (surface douce + bordure),
`.df-btn-ghost` (transparent + bordure), `.df-btn-danger` (rouge), `.df-btn-icon`
(carré, icône seule). Tailles `.sm` (34px), `.normal` (40px), `.lg` (44px).

**Important — coexistence assumée avec les classes historiques** (`.primary`,
`.secondary`, `.ghost`, `.big-primary`) : ces classes sont utilisées par des centaines
d'appels à travers tout le fichier et restent inchangées (renommage global refusé —
risque de régression sans bénéfice visuel, elles sont déjà visuellement cohérentes
entre elles au sein de chaque ligne d'actions). `.df-btn-*` est la nomenclature pour
tout **nouveau** composant introduit par V3.9.0 (barre d'actions de la fiche commande,
cellules Activité financière, menus …).

Quand plus de 2 actions secondaires existent sur une ligne (§14) : menu `[…]`.

---

## 6. Menus contextuels [...] (§14, §69)

Réutilise le mécanisme existant `.row-menu`/`.row-menu-btn`/`.row-menu-pop` +
`data-row-menu`/`data-row-menu-pop` (établi V3.8.3 Partie D, un seul popover ouvert à la
fois, fermeture au clic extérieur) — **aucun second système créé**. `.df-menu`/
`.df-menu-item`/`.df-menu-item-danger` normalisent visuellement le contenu (icône +
libellé, variante rouge pour les actions destructives) et sont ajoutés en complément de
`.row-menu-pop` sur les nouveaux menus (ex. actions secondaires de la fiche commande).

---

## 7. Badges (§15)

`.df-badge` + variantes `.blue .green .orange .red .purple .neutral` — équivalent
visuel de `.pill` (conservé tel quel, des centaines d'usages existants, non renommé)
pour tout nouveau markup.

---

## 8. Cartes (§11)

`.df-card` (+ `.soft`, `.interactive`, `.semantic-{blue,green,orange,red,purple}`).
Hover translaté uniquement si `.interactive` — jamais sur un élément non cliquable.

---

## 9. Sections (§10)

`.df-section` / `.df-section-head` / `.df-section-title` / `.df-section-subtitle` /
`.df-section-actions`. Utilisé pour l'Activité financière Accueil et les 5 groupes de
la fiche commande (voir Implementation Report).

---

## 10. KPI (§12)

`.df-kpi` (icônebox + valeur + libellé + sous-texte) en format `.summary` (compact,
vertical) — les 4 KPI opérationnels Accueil (`.hkpi.has-icon`, Proposition 2 validée)
et les 4 KPI Factures (`.invoice-kpis`, corrigés V3.8.8) restent leurs composants
propres, déjà conformes au langage visuel de référence — non réécrits (§103 :
« quand un élément V3.8.8 est déjà très bon, le conserver »).

---

## 11. Pop-ups = consultation (§19-22)

Shell existant conservé à l'identique : `.quick-layer`/`.quick-card` (centre),
`.form-modal`/`.form-box`. `.df-modal-head`/`.df-modal-title`/`.df-modal-subtitle`/
`.df-modal-body`/`.df-modal-foot` normalisent la structure interne. `.df-info-grid`/
`.df-info-item` remplacent les accumulations de `.mini-card` sans structure pour les
informations groupées par bloc logique (utilisé dans la fiche commande restructurée).

---

## 12. Side-window = action (§23-25)

Shell existant conservé : `#side-layer`/`.side-panel`/`#side-panel-head`/
`#side-panel-body`. **Footer d'action constant** : `#side-panel-body .form-actions`
devient `position:sticky;bottom:0` avec fond + bordure supérieure — Annuler/Enregistrer
restent atteignables sans scroller jusqu'en bas, sur **tous** les formulaires latéraux
de l'application (un seul sélecteur CSS, aucun gestionnaire touché).

---

## 13. Formulaires (§27)

`.df-field`/`.df-field-label`/`.df-field-help`/`.df-field-error`. Hauteur input 42px,
textarea min 90px — alignés sur les champs déjà utilisés dans `.side-form`.

---

## 14. Empty states (§28)

Référence : `.watch-empty` (Accueil, « Tout est sous contrôle ! », introduit V3.8.7,
déjà conforme au patron demandé). `.df-empty-state` généralise ce patron (iconbox +
titre + description + action optionnelle) pour tout nouveau composant.

---

## 15. Avatars (§29)

`.df-avatar` (tailles `.xs .sm .md .lg`) — normalise uniquement taille/forme, réutilise
`userColor()`/`userInitials()` existants, aucune nouvelle logique de couleur.

---

## 16. Tableaux (§16)

`.df-table` — en-tête sobre (12px, texte secondaire, majuscules légères), lignes
hauteur confortable, colonnes numériques alignées à droite. `.orders-table` (existant,
utilisé par Commandes/Factures/Rapports/Stock) reste la table principale de l'app,
déjà conforme (hiérarchie, hover léger, `.ovs-*` pour l'état de ligne) — non réécrite.

---

## 17. Responsive & Dark mode (§71-72)

Aucune règle `!important`, aucun second thème bricolé — chaque primitive V3.9.0 lit les
tokens `--df-*`, eux-mêmes dérivés des tokens de thème déjà commutés par
`html[data-theme]`/`prefers-color-scheme`. Vérifié PASS sur les 7 largeurs (1440 →
375px) et les 3 modes de thème (light/dark/system) — voir Test Report.

---

## 18. Ce qui n'a PAS été touché

Aucun changement à : `state` métier, `schemaVersion`, moteurs Stocks/Achats/Production,
calculs KPI/CA, Facturation, pointage, traçabilité, QR, scan, règles de congés,
simulation, capacité, permissions, notifications (logique), workflow commande,
confidentialité patient, logique portail cabinet/PWA collaborateur, persistance,
migrations, import/export, `historyEvents`.
