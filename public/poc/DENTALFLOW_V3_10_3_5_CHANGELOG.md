# DentalFlow V3.10.3.5 — Changelog — Correctif recette utilisateur (ISS-001)

**Base :** `dentalflow-next-poc-v3.10.3.4.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.5.html`

## Contexte

Ce correctif est né pendant la **recette utilisateur laboratoire** (mandat "DENTALFLOW V3.10.3.3 — RECETTE
UTILISATEUR LABORATOIRE"), qui autorise explicitement une correction pour "un défaut utilisateur reproductible
constaté pendant la recette". C'est le seul défaut fonctionnel réel remonté par les scénarios A-I, la recette
cabinet et la recette mobile (voir `DENTALFLOW_USER_RECIPE_ISSUES_V1.md`, ISS-001).

## Anomalie corrigée (ISS-001)

**Reproductible :** taper un texte dans la recherche globale du bandeau (`#search`) fait apparaître une popover
de résultats (`#search-popover`). Cliquer ensuite ailleurs sur la page — sans sélectionner de résultat ni
presser Échap — laissait cette popover ouverte indéfiniment, aucun gestionnaire "clic en dehors" n'existant pour
elle (seuls un clic sur un résultat ou la touche Échap la fermaient).

**Conséquence réelle, constatée pendant la recette :** la popover restée ouverte peut intercepter des clics
destinés à des éléments du bandeau situés dessous (ex. le bouton "Nouvelle commande" quand il est proche du
bandeau), gênant la suite du parcours utilisateur.

## Correctif appliqué (minimal, additif)

Une seule ligne ajoutée dans le gestionnaire de clic global existant (bloc de base, juste après la fermeture du
menu utilisateur `#user-menu` qui suit déjà exactement ce principe) :

```js
if(state.searchOpen&&!e.target.closest('#search')&&!e.target.closest('#search-popover'))closeSearchPopup();
```

Même schéma que la ligne équivalente pour `#user-menu`, juste au-dessus. Aucune autre ligne modifiée.

## Vérification empirique

- Test ciblé : taper "CMD" dans la recherche → popover ouverte → clic sur un titre de page ailleurs → **popover
  fermée** (`openAfterOutsideClick:false`), alors qu'elle restait ouverte avant correctif.
- Recette guidée laboratoire (scénarios A-I) rejouée intégralement sur le corpus réel complet : le contrôle
  dédié `popoverStillOpenAfterOutsideClick` passe de `true` (V3.10.3.4) à `false` (V3.10.3.5) ; les 9 scénarios
  restent PASS.
- Recette cabinet et recette mobile (390×844, 430×932) rejouées intégralement : inchangées, toujours PASS.
- Workflow de qualification par lot (V3.10.3.4) rejoué intégralement : inchangé, toujours PASS.
- **468/468 tests hérités**, ×3 exécutions consécutives — **0 régression**.
- NAVDOM 31/31, UI Playwright 16/16 — non régressés.
- `node --check` sur les 5 blocs `<script>` réels — tous OK.
- **0 erreur console** sur l'ensemble des parcours rejoués.

## Portée

Correctif d'un seul défaut UX/fonctionnel constaté pendant la recette. Aucun refactoring, aucune autre zone
touchée. `dentalflow-next-poc-v3.10.3.5.html` est la version finale livrée pour la recette utilisateur.
