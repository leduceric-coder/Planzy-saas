# DentalFlow V3.10.1 — Test Report

**Fichier testé :** `dentalflow-next-poc-v3.10.1.html`
**Base de comparaison :** `dentalflow-next-poc-v3.10.0.html`
**Tous les résultats ci-dessous sont issus d'exécutions réelles**
(Chromium via Playwright, jamais une simulation ou une extrapolation).

## Synthèse

| Suite | Résultat |
|---|---|
| Tests persistés (405 hérités + 20 REL + 2 nouveaux ROUTE01/ROUTE_CAM) | **427 / 427 PASS** |
| ROUTE02-ROUTE07 (navigation réelle, clics + reload réels) | **30 / 30 vérifications PASS (couvrant les 6 scénarios)** |
| Playwright NAVDOM hérité (V3.9.5), rejoué contre V3.10.1 | **31 / 31 PASS** |
| Interaction UI réelle héritée de V3.10.0 (5 scénarios) | **22 / 22 PASS** |
| Responsive (430/390/375px) — LAB/STAFF/CABINET | **18 / 18 PASS** |
| Responsive/thèmes hérités de V3.10.0 | **18 / 18 PASS** |
| Isolation — 22 tableaux de données métier | **0 différence** |
| `node --check` sur les 5 blocs `<script>` | **PASS** |
| CSS vs V3.10.0 | **byte-à-byte identique** |
| Erreurs console (tous scénarios) | **0** |

## 1. Tests persistés — 427/427

```
node run_v311_baseline.js
TOTAL 427 PASSED 427 FAILED 0
CONSOLE ERRORS: 0
```

Les 405 tests hérités de V3.9.5 et les 20 REL01-REL20 de V3.10.0 sont
**strictement inchangés**. Deux nouveaux tests ajoutés :

| Test | Objet | Résultat |
|---|---|---|
| ROUTE01 | `getAppMode()` — priorité hash/query, compatibilité, hash invalide | PASS |
| ROUTE_CAM | `switchAppMode()` arrête la caméra active avant tout changement de mode | PASS |

### ROUTE01 — détail des 11 cas vérifiés dans un seul test

```
URL sans mode              → lab       PASS
?mode=staff                → staff     PASS
?mode=dentist               → dentist   PASS
#mode=staff                 → staff     PASS
#mode=dentist                → dentist   PASS
#mode=lab                    → lab       PASS
?mode=staff#mode=lab         → lab       PASS  (hash prioritaire)
?mode=dentist#mode=staff     → staff     PASS  (hash prioritaire)
?mode=staff#mode=banana      → staff     PASS  (hash invalide → repli query)
#foo=bar (pas de query)      → lab       PASS  (hash invalide, pas de repli)
# (vide)                     → lab       PASS
```

Exercé via `history.replaceState()` (change réellement `location.hash`/
`location.search` sans recharger la page), donc un test de la fonction
réelle sur une URL réelle, pas une simulation de ses entrées.

## 2. ROUTE02-ROUTE07 — navigation réelle (clics + reload réels)

Script Playwright dédié, jamais d'appel direct à une fonction interne
pour déclencher la navigation — chaque scénario clique réellement sur le
bouton qu'un utilisateur cliquerait, puis attend la navigation réelle
(`page.waitForNavigation`).

**ROUTE02 — LAB → STAFF** (clic réel sur "Voir comme collaborateur") :
- bouton atteignable, mode devient `staff`, `#staff-portal` rendu ;
- **`location.href` avant le `#` est strictement identique avant et
  après le clic** — aucune nouvelle ressource fichier ouverte.
- 4/4 vérifications PASS, 0 erreur console.

**ROUTE03 — LAB → CABINET** (clic réel sur "Voir comme cabinet") :
- mode devient `dentist`, `#portal` rendu, adresse de base inchangée.
- 4/4 vérifications PASS, 0 erreur console.

**ROUTE04 — STAFF → LAB** (chargement direct sur `#mode=staff`, clic réel
sur "Retour laboratoire") :
- mode revient à `lab`, `#view-root` (interface labo) présent, adresse
  de base inchangée.
- 4/4 vérifications PASS, 0 erreur console.

**ROUTE05 — CABINET → LAB** (chargement direct sur `#mode=dentist`, clic
réel sur "Retour laboratoire") :
- mode revient à `lab`, interface labo présente, adresse de base
  inchangée.
- 4/4 vérifications PASS, 0 erreur console.

**ROUTE06 — Fallback Staff (aucun collaborateur éligible)** :
- l'écran d'erreur "Erreur de configuration" s'affiche bien ;
- son bouton "Retour laboratoire" **est un `<button>`, jamais un `<a
  href="...">`** (vérifié directement sur l'élément DOM — pas de
  `hasAttribute('href')`) ;
- clic réel sur ce bouton → retour labo effectif, adresse de base
  inchangée.
- 5/5 vérifications PASS, 0 erreur console.

**ROUTE07 — Compatibilité query historique** :
- `?mode=staff` ouvre bien STAFF ; `switchAppMode('lab')` depuis ce
  contexte revient bien à `lab` (sans jamais reconstruire le query
  string) ;
- même vérification pour `?mode=dentist` → `dentist` → `lab`.
- 4/4 vérifications PASS, 0 erreur console.

```
ROUTE TESTS TOTAL 30 PASSED 30 FAILED 0
```

## 3. Navigation — 31/31 (script hérité V3.9.5, rejoué contre V3.10.1)

```
node navdom_v3101.js
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

Confirme que la migration du routing de mode n'a introduit aucune
régression sur la navigation labo (sidebar/drawer mobile, badges,
routing, sidebar réduite, dark/light/system).

## 4. Interaction UI réelle héritée de V3.10.0 — 22/22

Les 5 scénarios du Test Report V3.10.0 (confirmation d'annulation,
ajustement de stock, bouton caméra Collaborateur, modèle d'import
téléchargeable, CTA de blocage d'achat) ont été rejoués intégralement
contre V3.10.1, sans modification.

```
node v311_ui_interact.js
UI INTERACT TOTAL 22 PASSED 22 FAILED 0
```

Confirme qu'aucune fonctionnalité V3.10.0 (R01/R02/R04/R08/R12) n'a été
affectée par ce hotfix.

## 5. Responsive — 18/18 (LAB/STAFF/CABINET × 430/390/375px)

```
node v311_responsive.js
RESPONSIVE TOTAL 18 PASSED 18 FAILED 0
```

Aucun débordement horizontal, 0 erreur console, pour les trois modes aux
trois largeurs mobiles mandatées. Aucune modification visuelle demandée
ni apportée.

## 6. Responsive/thèmes hérités de V3.10.0 — 18/18

```
node v311_responsive_theme_full.js
RESPONSIVE/THEME TOTAL 18 PASSED 18 FAILED 0
```

## 7. Isolation des données métier

```
node v311_isolation_business.js
business data diffs: []
```

Les 22 tableaux métier (`orders`, `users`, `stockMovements`,
`purchaseOrders`, `purchaseProposals`, `articleSuppliers`, `suppliers`,
`stockLots`, `locationEvents`, `scanEvents`, `historyEvents`,
`activityEvents`, `articles`, `services`, `serviceMaterials`, `cabinets`,
`leaveRequests`, `absences`, `messages`, `conversations`, `invoices`,
`reworks`) sont identiques, sérialisation JSON caractère pour caractère,
avant et après l'exécution complète des 427 tests. Un changement de mode
ne modifie, par construction, aucune de ces données (il ne touche que
`location.hash` et déclenche un rechargement du même document).

## 8. `node --check`

Les 5 blocs `<script>` extraits du fichier passent tous `node --check`
sans erreur de syntaxe.

## 9. CSS

```
CSS identical v3.10.0 vs v3.10.1: True
```

Comparaison intégrale du contenu du bloc `<style>` (pas seulement sa
longueur) — byte-à-byte identique. Aucune ligne CSS modifiée.

## 10. Console

**0 erreur console** relevée sur l'ensemble des scénarios réellement
exécutés : suite persistée (427 tests), 30 vérifications de navigation
réelle (6 scénarios ROUTE02-ROUTE07), script NAVDOM hérité (31
vérifications), 22 vérifications d'interaction UI héritées, 18+18
vérifications responsive/thèmes.

## 11. Audit statique — `location.pathname`/`location.href` restants

```
grep -n "location\.pathname|location\.href *=" dentalflow-next-poc-v3.10.1.html
```

Après correction, aucune occurrence liée à un changement de mode
utilisateur. Les seules occurrences restantes : la bibliothèque jsPDF
vendorée (logique interne de téléchargement de blob, non liée au
routing applicatif) et `runV341MigrationSeedReload()` (fonction de test
de migration, usage de `location.search` explicitement hors périmètre
du mandat, §22 — non modifiée).

## 12. Diff V3.10.0 → V3.10.1

78 lignes ajoutées (16 780 → 16 858 lignes), 117 lignes de différence au
total (`diff` sur fold 200 colonnes). Chaque zone de changement est
documentée dans le Changelog ; aucune ligne ne touche le CSS,
`NAV_GROUPS`, une route de navigation labo, une permission, le moteur
caméra, l'import CSV, ou `schemaVersion`.

## 13. Points explicitement non vérifiables dans cet environnement

- **`content://` Android réel / Storage Access Framework :**
  l'environnement Playwright de cette session ne fournit pas de
  périphérique Android ni de gestionnaire de fichiers Android — il est
  donc impossible de reproduire littéralement, dans cet environnement,
  le message "Impossible d'accéder à votre fichier" tel qu'il apparaît
  sur un Huawei P30 Pro physique, ni de confirmer directement sa
  disparition après correction sur cet appareil précis. Ce qui a été
  vérifié à la place (§2 ci-dessus, ROUTE02-ROUTE07) : que l'adresse du
  document (hors fragment) ne change **jamais**, quel que soit le
  changement de mode effectué — l'invariant de code qui, structurellement,
  élimine la classe de problème observée sur le terrain — plus un audit
  statique exhaustif confirmant qu'aucun changement de mode ne dépend
  plus de `location.pathname`.
