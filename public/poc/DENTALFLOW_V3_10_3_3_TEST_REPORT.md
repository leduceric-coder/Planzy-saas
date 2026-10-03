# DentalFlow V3.10.3.3 — Rapport de test — CORRECTIF BLOQUANT (persistance réelle)

**Base :** `dentalflow-next-poc-v3.10.3.2.html` (intacte)
**Fichier testé :** `dentalflow-next-poc-v3.10.3.3.html`

## 1. Reproduction de l'anomalie (avant correctif, sur V3.10.3.2 non modifiée)

Import réel persistant exécuté (126 cabinets, 91 dentistes, 13 utilisateurs, 353 prestations, 17
fournisseurs, 515 articles), suivi d'un rechargement de page réel (`page.reload()`, relecture de
`localStorage`) :

```
Avant reload : cabinets=131 dentists=97 services=359 servicePriceOverrides=1 suppliers=22
                articles=524 articleSuppliers=521 stockMovements=532 stockLots=1 purchaseProposals=5
Après reload : cabinets=96  dentists=97 services=359 servicePriceOverrides=0 suppliers=22
                articles=524 articleSuppliers=521 stockMovements=532 stockLots=1 purchaseProposals=5
```

35 cabinets et 1 servicePriceOverride disparus au rechargement — cause racine identifiée par lecture
directe du code (voir Changelog) : `save()` ne persistait qu'un sous-ensemble historique de l'état.

## 2. Correctif et re-vérification (sur V3.10.3.3)

Même scénario rejoué à l'identique sur le fichier corrigé :

```
Avant reload : cabinets=131 dentists=97 services=359 servicePriceOverrides=1 suppliers=22
                articles=524 articleSuppliers=521 stockMovements=532 stockLots=1 purchaseProposals=5
Après reload : cabinets=131 dentists=97 services=359 servicePriceOverrides=1 suppliers=22
                articles=524 articleSuppliers=521 stockMovements=532 stockLots=1 purchaseProposals=5
```

**Identiques sur tous les compteurs testés.** Seul `cabinetPatients` diffère (3→0 au premier
rechargement) — **comportement attendu, non lié au correctif** : ce sont les 3 entrées de démonstration
seedées en mémoire à chaque démarrage (jamais persistées par conception, `state.cabinetPatients` géré
par un mécanisme séparé `saveCabinetPatients()`/`loadCabinetPatients()`, intentionnellement indépendant
de `save()`/`load()` — voir l'architecture documentée dans le code, "séparation purement logique").
**Vérifié séparément avec un `cabinetPatient` réel** créé via `createDentistOrderCore()` : les données
(cabinet, prénom, nom) sont retrouvées à l'identique après rechargement — le mécanisme séparé
fonctionne correctement pour les données réelles, seul le seed de démonstration ne survit pas (par
conception, hors périmètre de ce correctif).

## 3. Test d'idempotence (passe 2, après rechargement)

```
[cabinets]     created=0 updated=0 skipped=126
[dentistes]    created=0 updated=0 skipped=91
[utilisateurs] created=0 updated=0 skipped=13
[prestations]  created=0 updated=0 skipped=353
[fournisseurs] created=0 updated=0 skipped=17
[inventaire]   created=0 updated=0 skipped=515
```

Snapshot strictement identique avant/après la passe 2. **Idempotence confirmée après un cycle complet
save → reload → réimport.**

## 4. Non-régression

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK TOTAL 16 PASSED 16 FAILED 0
```

`node --check` sur les 5 blocs `<script>` réels (3 vendor + 2 application) : tous OK. 0 erreur console
sur l'ensemble des parcours.

## 5. Diff audit

3 hunks (`load()`, `save()`, exposition `window.v34Save`) — voir Changelog §"Diff audit". Aucune autre
zone touchée.

## 6. Conclusion

Anomalie reproductible et bloquante confirmée par lecture directe du code (pas seulement par le
symptôme constaté), corrigée de façon minimale et additive (délégation vers une fonction déjà correcte
mais jamais appelée), vérifiée empiriquement sur le corpus réel complet, 0 régression sur 468 tests
hérités + NAVDOM + UI Playwright. La phase "Import test persistant + recette métier" peut reprendre sur
`dentalflow-next-poc-v3.10.3.3.html`.
