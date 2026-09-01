# Recette Mode Chantier Kanvix V2.4.6 — Correction MC-01

Patch fonctionnel isolé sur `kanvix-next-gen-v2.4.6.html` (copie de v2.4.5). **Seul MC-01 a été corrigé** ; aucune autre partie du POC n'a été touchée.

## Verdict

**MODE CHANTIER KANVIX = VALIDÉ ET GELÉ**

- **MC-01 corrigé : OUI**
- **Tests Mode Chantier : 95 PASS / 0 FAIL**
- **Scénarios PM-F1 → PM-F7 : tous PASS**
- **Erreurs console applicatives : 0**
- **Recette Accueil (gelé) : 149 PASS / 0 FAIL** (rejouée sur v2.4.5 ET sur v2.4.6)
- **Régressions : aucune**

Critère de gel atteint : MC-01 = PASS, PM-F1→PM-F7 = PASS, 0 blocker, 0 major, **0 minor connu**, 0 erreur console, Accueil 149/149.

## Correction apportée (MC-01)

**Symptôme (V2.4.5)** : dans les popups affichés après création d'une reprise (« Reprise créée » / « Replanification appliquée »), le bouton « Voir dans le planning » s'appuyait sur le moteur Planning **Bureau** (`focusPlanningTask`). En Mode Chantier, `app.ui.page='planning'` est ignoré par `renderField`, `fieldView` restait `"site"` : l'utilisateur revenait à l'accueil chantier au lieu du planning mobile.

**Correctif** : un helper central unique, utilisé par les trois boutons « Voir dans le planning » des popups de reprise :

```js
function openReworkPlanning(taskId) {
  if (isFieldMode()) openFieldPlanning(taskId);
  else focusPlanningTask(taskId);
}
```

- **En Mode Chantier** → `openFieldPlanning(reworkId)` : `driverMode` reste `"field"`, `fieldView` devient `"planning"`, `fieldPlanningTaskId` = id de la reprise, planning mobile visible, reprise focalisée, aucun Gantt/sidebar, bouton « ← Chantier » fonctionnel.
- **Au Bureau** → `focusPlanningTask(reworkId)` : **comportement inchangé** (Planning Bureau).

**Périmètre exact du changement** : ajout de la fonction `openReworkPlanning` (à côté de `focusPlanningTask`) + remplacement de `focusPlanningTask('${pr.reworkId}')` par `openReworkPlanning('${pr.reworkId}')` sur les **3 boutons** des popups de reprise (`showReworkImpact` × 2 branches, `applyReworkReflow` × 1). Les 9 autres usages de `focusPlanningTask` (fiche tâche Bureau, popups décision, etc.) sont **inchangés**.

## Vérification MC-01 (nouveaux tests)

| Sous-test | Résultat |
|---|---|
| MC-01(a) — popup « Reprise créée » → planning mobile | PASS — `field=true`, `driverMode=field`, `fieldView=planning`, `fieldPlanningTaskId=<reworkId>`, reprise focalisée, 0 Gantt/sidebar, ← Chantier OK, retour sans impasse |
| MC-01(b) — popup « Replanification appliquée » → planning mobile | PASS — même résultat après application du reflow |
| MC-01(c) — BUREAU (non-régression) | PASS — « Voir dans le planning » ouvre toujours le Planning Bureau (`page=planning`, Gantt visible), `focusPlanningTask` inchangé |

Mesure MC-01(a) : `{field:true, driverMode:"field", fieldView:"planning", fieldPlanningTaskId:"rework-…", planningVisible:true, focusFocusedRework:"Reprise — Pose des 6 fenêtres", hasGantt:false, hasSidebar:false, backBtn:true}`.

**Capture** : `recette-mode-chantier-v246/MC-01-fixed-planning-mobile.png`.

## Non-régression Mode Chantier (PM-F1 → PM-F7)

Tous les scénarios maîtres de la recette V2.4.5 rejoués sur V2.4.6, **inchangés** :

| Scénario | Verdict |
|---|---|
| PM-F1 — Arrivée sur chantier | PASS |
| PM-F2 — Contrôle + SAV (photo→reprise→impact→message) | PASS |
| PM-F3 — Planning terrain | PASS |
| PM-F4 — Communication | PASS |
| PM-F5 — Boucle artisan (temps réel local) | PASS |
| PM-F6 — Reprise & cycle de vie | PASS |
| PM-F7 — Conditions dégradées (390 sombre, météo KO, offline, texte long) | PASS |

Sections techniques (navigation stable ±0 px, popup jamais drawer, responsive 375–430 sans scroll horizontal, safe-area, rôle dialog/Échap, sombre, états vides, chantier chargé, sortie/retour Bureau) : toutes PASS.

## Non-régression Accueil (gelé)

`recette-accueil-v2.4.5.mjs` rejoué : **149 PASS / 0 FAIL** — vérifié sur la baseline v2.4.5 **et** sur le fichier livré v2.4.6 (l'Accueil n'a subi aucune modification).

## Console

**0 erreur JavaScript applicative.** La seule ligne réseau observée (`ERR_TUNNEL_CONNECTION_FAILED`, section PM-F7) provient de la coupure réseau **volontairement simulée** (test offline) — comportement géré, sans exception non gérée.

## Chiffres clés

- **95 vérifications automatisées** (`recette-mode-chantier-v2.4.6.mjs`) : **95 PASS / 0 FAIL** (les 84 de V2.4.5 + 11 nouveaux checks MC-01 a/b/c).
- **0 BLOCKER · 0 MAJOR · 0 MINOR connu · 0 COSMETIC.** Le gap produit GP-01 (remontée d'incident terrain structurée) reste hors périmètre de ce patch, comme prévu.
- **Régressions : aucune** (Mode Chantier + Accueil).

## Livrables

1. `kanvix-next-gen-v2.4.6.html` — fichier complet.
2. `recette-mode-chantier-v2.4.6.mjs` — suite Playwright (95 vérifications).
3. `rapport-recette-mode-chantier-v2.4.6.md` — ce rapport.
4. `recette-mode-chantier-v246/MC-01-fixed-planning-mobile.png` + captures de référence.
