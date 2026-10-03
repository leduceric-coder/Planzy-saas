# DentalFlow Next — V3.3.1 Fix Report

Base : `dentalflow-next-poc-v3.3.html` (non modifié)
Livrable : `dentalflow-next-poc-v3.3.1.html`

Sprint : **hotfix ciblé** — UX collaborateur mobile, Quick View centré,
poste lié à l'identité, compteurs de congés, corrections finales.

**Résultat : toutes les vérifications OK · 0 erreur console.**

---

## 1. Quick View centré restauré (§2-4)

- `openQuickView(id)` n'appelle plus `openSidePanel('order', id)`. Il définit
  `state.quickOrderId`, ferme toute side-window ouverte, remplit `#quick-body`
  et ouvre `#quick-layer`.
- Le Quick View affiche désormais les signaux cumulés (EN RETARD + BLOQUÉE),
  « Localisation confirmée » vs « Prochaine étape prévue ».
- Depuis le Quick View : **Messages** et **Traçabilité** ferment le popup et
  ouvrent la side-window. **••• Plus** ouvre la side-window Actions.
- Une seule couche secondaire à la fois.

| Test (§39) | Résultat |
|---|---|
| Clic commande → Quick View centré ouvert, side-window fermée | ✅ `qvOpen:true, sideOpen:false` |
| Quick View → Messages : popup fermé, side ouverte | ✅ `qvOpen:false, sideOpen:true` |
| Quick View → Traçabilité : popup fermé, side ouverte | ✅ `qvOpen:false, sideOpen:true` |
| Aucune superposition | ✅ |

## 2. Poste lié à l'identité collaborateur (§8-15, §37)

- Ajout de `assignedStageId` sur les collaborateurs (13 avec poste ; Eric Leduc
  et Sophie Marchand restent administratifs, sans poste de scan).
- `scope` reste un libellé métier, **jamais** utilisé comme clé de poste.
- **Suppression du `<select id="staff-station">`** et de toute modification
  manuelle de `state.staffScanStation` depuis l'interface collaborateur.
- Le poste s'affiche en **chip lecture seule** : `Poste · Céramique`.
- `handleStaffScanSubmit()` dérive le poste de `me.assignedStageId` via
  `stageDefById()` — **aucun fallback arbitraire vers « Réception »**.
- Collaborateur sans poste (ou poste désactivé) : scan désactivé + message
  « Aucun poste de travail n'est associé à votre profil. »
- `staffEligibleUsers()` limite le sélecteur aux collaborateurs affectés.

| Test (§37) | Résultat |
|---|---|
| Nora Benali → poste affiché | ✅ « Poste · Céramique » |
| Aucun select de poste présent | ✅ |
| Scan CMD-0190 par Nora | ✅ `Céramique / Nora / U4` |
| Feedback compact | ✅ « ✓ CMD-0190 enregistrée · Céramique · Nora · 10:42 » |
| Marc Dubois → poste | ✅ « Poste · Usinage » |

## 3. Responsive mobile collaborateur (§5-7, §16-24, §36)

Breakpoint dédié `max-width: 520px`, appliqué **uniquement** au mode staff
(le desktop Pilot n'est pas touché).

- Header sur 3 lignes : marque / sélecteur pleine largeur / actions en 2 colonnes.
- Carte Scanner : `width:100%`, marges 12-14 px, padding et rayon réduits.
- Champ de scan : `display:grid; grid-template-columns:minmax(0,1fr)` →
  **le bouton Scanner passe sous le champ**, jamais coupé.
- Placeholder raccourci : « Scanner ou saisir CMD-0190 ».
- « Connecté : … » supprimé de la carte (redondant avec le header).
- Derniers scans : nom du collaborateur retiré de chaque ligne, **3 scans max**
  visibles sur smartphone.
- Calendrier : `repeat(7,minmax(0,1fr))`, gap 4 px, cellules `min-width:0`,
  `min-height:44px`, padding 4 px.
- Navigation mois : « ‹ Préc. » / « Suiv. › » sur une seule ligne.

### Mesures Playwright — `scrollWidth − clientWidth`

| Résolution | Scan | Congés | Bouton Scanner | Sélecteur | Calendrier |
|---|---|---|---|---|---|
| 390 × 844 | **0** | **0** | 363 / 390 ✅ | 376 / 390 ✅ | 363 / 390 ✅ |
| 430 × 932 | **0** | **0** | 403 / 430 ✅ | 416 / 430 ✅ | 403 / 430 ✅ |
| 480 × 900 | **0** | **0** | 453 / 480 ✅ | 466 / 480 ✅ | 453 / 480 ✅ |
| 768 × 1024 | **0** | **0** | 557 / 768 ✅ | 504 / 768 ✅ | 731 / 768 ✅ |

Boutons Préc./Suiv. : hauteur 38 px à toutes les résolutions (aucun retour
à la ligne). Aucun élément hors écran, aucun scroll horizontal.

## 4. Compteurs de congés par collaborateur (§25-30, §38)

- Ajout de `leaveAllowance` / `leaveUsedYTD` par utilisateur (valeurs de démo).
- `getLeaveMetrics(userId)` → `{allowance, used, pending, remaining}`.
  `pending` calculé en jours ouvrés depuis `state.leaveRequests` (`status ===
  'pending'`) et **non déduit** du solde tant qu'il n'est pas approuvé.
- 3 cartes compactes : **Solde / Pris / En attente** (pas de gros KPI).
- Absences de démo variées ajoutées (Clara, Rachid) sans saturer le calendrier.

| Collaborateur | Solde | Pris | En attente | Jours bleus | Demandes |
|---|---|---|---|---|---|
| Nora Benali | 11 j | 14 j | 0 j | 5 | 1 |
| Marc Dubois | 17 j | 8 j | 0 j | 0 | 0 |
| Julie Moreau | 18 j | 7 j | **3 j** | 0 | 1 |
| Thomas Girard | 6 j | 19 j | 0 j | 0 | 0 |
| Clara Vidal | 20 j | 5 j | 0 j | 2 | 0 |

Le changement de collaborateur met à jour immédiatement : poste, derniers
scans, 3 compteurs, calendrier personnel (jours bleus liés à `me.id`) et
demandes affichées. Les absences des autres restent en orange « Équipe absente ».

## 5. Désactivation d'un poste occupé (§31, §40)

- `ordersLocatedAtStage(stageId)` : commandes encore en atelier dont le dernier
  scan confirmé pointe ce poste.
- Désactivation **refusée** si au moins une commande y est localisée :
  « Impossible de désactiver ce poste : 4 commandes y sont actuellement
  localisées. » Garde supplémentaire si des collaborateurs y sont affectés.
- **Aucune commande n'est jamais déplacée automatiquement.**

| Test (§40) | Résultat |
|---|---|
| Désactiver « Usinage » (4 commandes localisées) | ✅ refusé, poste toujours actif |
| Désactiver un poste vide | ✅ désactivation possible |
| Historique après opérations | ✅ inchangé (`stageLabelAtScan = "Usinage"`) |

## 6. Commandes terminées de démonstration (§32)

4 commandes livrées ajoutées (CMD-0130 → CMD-0133) avec scans cohérents,
échéances passées, cabinet et référence patient opaque.

- Filtre « Terminées » : **4 lignes** (non vide).
- Donut : `active 13 / ready 3 / blocked 3 / completed 4` — somme = total ✅.
- Les commandes livrées ne polluent pas le tableau Production (elles ont quitté
  le laboratoire) mais conservent leur historique de scans.
- `statusInfo` accepte désormais la clé `completed` → pastille « Livrée ».

## 7. Horloge et microcopy (§33-34)

- `Clock.now()` / `Clock.iso()` utilisés pour tout « maintenant » fonctionnel :
  accueil, audit, plan de charge, calendriers, échéances, effectif, congés.
- `baseNow` conservé **uniquement** comme ancre de génération des données seed,
  explicitement documenté en commentaire.
- Microcopy technique nettoyée :
  - « Action · création locale POC » → « Renseignez les informations du travail. »
  - « Résumé read-only… side-window Traçabilité » → « L'historique complet des
    scans est disponible via « Traçabilité ». »
  - « Lecture seule · » → « Historique des scans · »
  - « Documents hors scope V3 » → « Aucun document. »
  - « Messages disponibles dans la side-window unique » → « … depuis la commande. »

## 8. Hors scope respecté (§1, §35)

- ❌ Cloche Alertes **non réintroduite** (vérifié : `#notif-btn` absent).
- ❌ Comportement « Tout voir » **inchangé**.
- Navigation, mode sombre, portail cabinet, Plan de charge, Stocks, Messages,
  stage IDs, immutabilité des scans et référence patient opaque : conservés.

## 9. Non-régression (§41)

Parcours sans erreur console : Accueil, Commandes (dont filtre Terminées),
Production, Messages, Outils, Plan de charge, Stocks, Rapports, Utilisateurs,
Quick View, Scan collaborateur, Congés collaborateur, Portail cabinet, Light,
Dark.

**Erreurs console cumulées : 0.**

---

## Definition of Done

| Critère | État |
|---|---|
| Quick View centré restauré | ✅ |
| Aucune cloche Alertes ajoutée | ✅ |
| Comportement « Tout voir » inchangé | ✅ |
| Staff réellement mobile-first | ✅ |
| Aucun overflow horizontal | ✅ (0 px à 390/430/480/768) |
| Bouton Scanner jamais coupé | ✅ |
| Poste non modifiable | ✅ |
| Poste dérivé du collaborateur | ✅ |
| `assignedStageId` utilisé | ✅ |
| Aucun fallback arbitraire « Réception » | ✅ |
| Compteurs congés différents par collaborateur | ✅ |
| Calendrier change selon collaborateur | ✅ |
| Derniers scans changent selon collaborateur | ✅ |
| Stage occupé impossible à désactiver | ✅ |
| Commandes terminées présentes en démo | ✅ |
| Microcopy technique nettoyée | ✅ |
| Horloge cohérente | ✅ |
| Aucune erreur console | ✅ |
