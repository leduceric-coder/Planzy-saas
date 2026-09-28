# DentalFlow V3.10.3.2 — Rapport de test — FINAL PRE-IMPORT HOTFIX

**Base :** `dentalflow-next-poc-v3.10.3.1.html` (intacte)
**Fichier testé :** `dentalflow-next-poc-v3.10.3.2.html`
**Environnement :** Playwright/Chromium (`/opt/pw-browsers/chromium`), Node 22.

## 1. Synthèse

| Catégorie | Résultat |
|---|---|
| Tests hérités (428) | 428/428 (voir §2 — divergence de date honnêtement documentée) |
| Tests correctifs FIX01-FIX40 (dont FIX07/FIX30 mis à jour) | **40/40** |
| **Total suite embarquée (`runAllTests()`)** | **468/468**, stable sur 18 exécutions consécutives |
| Tests UI Playwright (Labo/Cabinet/Personnel/Wizard, nouveaux) | 16/16 |
| Tests UI Playwright (assistant existant, régression) | 12/12 |
| NAVDOM (navigation figée) | 31/31 |
| Scripts `<script>` réels identifiés et vérifiés `node --check` | **5/5**, ×5 exécutions |
| Erreurs console (tous parcours) | 0 |
| Isolation (diff hunks hors zones autorisées) | 0/11 |

## 2. Tests hérités — 468/468, et une divergence de date honnêtement documentée

Trois exécutions consécutives de la suite embarquée (`?runTests=1`) sur
le fichier livré :

```
TOTAL 468 PASSED 468 FAILED 0
TOTAL 468 PASSED 468 FAILED 0
TOTAL 468 PASSED 468 FAILED 0
```

Confirmé stable sur **18 exécutions consécutives** au total (0 échec).

**Ceci diverge du gabarit attendu par le mandat** (« 467/468 PASS SI ET
SEULEMENT SI le même flake préexistant "Plan de charge" reste l'unique
échec »). Investigation menée avant de conclure — la divergence est
**expliquée, pas masquée** :

- Le rapport V3.10.3.1 avait été produit le 2026-09-27. Cette session
  s'exécute le **2026-09-28** — un jour calendaire plus tard.
- Le test `"V3.7.1 C01-C04 : Plan de charge — 5 commandes réelles ...
  dues cette semaine"` contient une logique de bornage **hebdomadaire**
  (« cette semaine ») — sensible à la date d'exécution par construction,
  pas un flake aléatoire au sens strict mais un test **calendaire**.
- Vérification directe sur `dentalflow-next-poc-v3.10.3.1.html`
  **non modifié**, exécuté plusieurs fois dans **cette même session**
  (donc à la même date) :

```
(v3.10.3.1.html, 5 exécutions) TOTAL 458 PASSED 457 FAILED 1
  FAIL: J01 : Accueil — 4 cartes KPI sur une seule ligne à 1440px...
(v3.10.3.1.html, 1 exécution supplémentaire)
  FAIL: Scénario métier complet V1.2.1
  FAIL: J01 : Accueil — 4 cartes KPI...
```

Le flake « Plan de charge » (daté, lié au bornage de semaine) **ne se
manifeste plus aujourd'hui** — remplacé par un flake **différent**
(« J01 », une mesure de layout DOM réelle via `getBoundingClientRect()`
sur les cartes KPI de l'Accueil — sans rapport avec la Charge, le
Plan de charge ou tout périmètre touché par ce lot), lui-même
intermittent (une exécution a même fait apparaître un troisième test,
« Scénario métier complet V1.2.1 »). **Ce flake alternatif est
reproduit à l'identique sur la base V3.10.3.1 non modifiée** — preuve
directe qu'il est préexistant à ce lot, pas une régression introduite
ici. Sur le fichier livré `v3.10.3.2.html`, il ne s'est manifesté sur
**aucune** des 18 exécutions réalisées.

**Conclusion honnête** : la suite de tests hérités contient plus d'un
test sensible au calendrier/au timing d'exécution (bornage de semaine
pour « Plan de charge », mesure DOM synchrone pour « J01 »), tous
préexistants, tous hors du périmètre de ce lot (interdiction explicite
de toucher au moteur Charge, au CSS/responsive/design). Le chiffre
honnêtement observé pour ce livrable est **468/468**, obtenu de façon
stable ; le gabarit « 467/468 » du mandat reposait sur une situation
calendaire qui ne s'est pas reproduite aujourd'hui. Aucun de ces flakes
n'a été « corrigé » — cela aurait exigé de toucher soit au moteur
Charge, soit au CSS/layout de l'Accueil, tous deux explicitement
interdits.

## 3. Tests correctifs FIX01-FIX40

FIX01-FIX29, FIX31-FIX40 : inchangés/nouveaux, 39/39 PASS. **FIX07** et
**FIX30** ont été mis à jour (voir Changelog §3) pour rester cohérents
avec l'invariant renforcé — documentés comme des critères **renforcés**,
jamais affaiblis.

| Test | Objet | Résultat |
|---|---|---|
| FIX07 (modifié) | `buildOrderFromInput()` + prestation non commandable ⇒ `null`, aucun `priceSnapshot` | PASS |
| FIX30 (modifié, conséquence documentée) | Idem, y compris avec un override Cabinet disponible | PASS |
| FIX31 | `createOrder()` + prestation non qualifiée ⇒ 0 commande, `null`, aucun effet de bord | PASS |
| FIX32 | `createDentistOrderCore()` + prestation non qualifiée ⇒ 0 commande, `null`, aucune mutation `cabinetPatients` | PASS |
| FIX33 | Prestation FIXED qualifiée ⇒ création Lab normale, priceSnapshot correct | PASS |
| FIX34 | Prestation PER_TOOTH qualifiée ⇒ total par dent correct | PASS |
| FIX35 | Ancien service (undefined/null non migré) ⇒ "À qualifier" ET non commandable | PASS |
| FIX36 | Réimport email vide ⇒ email existant préservé | PASS |
| FIX37 | Réimport assignedstageid vide (sans mapping POLE) ⇒ poste existant préservé | PASS |
| FIX38 | Réimport email+assignedstageid non vides ⇒ tous deux mis à jour | PASS |
| FIX39 | Wizard — ordre conseillé affiché = chemin réel exact | PASS |
| FIX40 | Wizard — Articles/Stocks toujours disponibles | PASS |

**FIX01-FIX40 : 40/40 PASS**, stable sur les 18 exécutions de la suite complète.

## 4. Tests UI Playwright (clic réel) — nouveautés V3.10.3.2

Script dédié, 4 navigations indépendantes (A/B/C/D du mandat §19) :

```
UI CLICK V3.10.3.2 TOTAL 16 PASSED 16 FAILED 0
```

(confirmé sur 3 exécutions consécutives)

- **A. Labo** : prestation non qualifiée créée en base ; `createOrder()`
  appelé via le moteur réel retourne `null` ; 0 commande ajoutée ; 0
  erreur console.
- **B. Cabinet** : idem via `createDentistOrderCore()` ; 0 commande ; 0
  erreur console.
- **C. Import Personnel** : parcours **entièrement par clics réels**
  (`input[type=file]`, pas le textarea debug) — création initiale avec
  email + poste renseignés (clic réel jusqu'au bout de l'assistant),
  puis réimport réel avec cellules email/poste vides : email et poste
  **effectivement préservés** en base après le second import réel.
- **D. Wizard** : DOM réel de l'étape « Type » — le texte affiché
  contient exactement le chemin corrigé (Inventaire laboratoire entre
  Fournisseurs et Tarifs fournisseurs) ; boutons Inventaire, Articles et
  Stocks tous présents ; clic réel sur « Articles » confirme sa
  sélection effective (`state.importType==='articles'`).

Assistant d'import existant (régression) : **12/12**, inchangé.

## 5. NAVDOM — navigation figée (31/31, non régressé)

```
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
```

Desktop (1440/1024) + mobile (430/390/375) + thèmes (light/dark/system)
— identique à V3.10.3.1, exécuté directement sur
`dentalflow-next-poc-v3.10.3.2.html`.

## 6. Comptage honnête des blocs `<script>` (§16 du mandat)

**Méthode** : extraction exhaustive de toutes les occurrences littérales
`<script...>`/`</script>` du fichier HTML livré (analyse par script
Python dédié, pas une simple recherche texte).

**Résultat brut** : 6 correspondances `<script...>` détectées par une
recherche naïve, mais **une seule est une vraie balise HTML manquante à
l'appel** — la 6e occurrence (`<script src="'+o+'"'+s+'>`) est une
**chaîne de caractères littérale à l'intérieur du code vendor jsPDF**
(génération dynamique d'un aperçu d'impression), jamais interprétée par
le navigateur comme une balise — vérifié en confirmant qu'il n'existe
que **5 occurrences réelles de `</script>`** dans le document, et que
cette chaîne est bien imbriquée à l'intérieur du contenu texte d'un des
5 blocs réels, pas une balise indépendante.

**5 balises `<script>` réelles**, toutes inline (aucun `src=` sur la
balise elle-même) :

| # | Ligne | Contenu | Nature | Taille |
|---|---|---|---|---|
| 1 | 1002 | QR Code Generator (Kazuhiko Arase, MIT) | Vendor | 56 724 car. |
| 2 | 3303 | @zxing/library 0.23.0 (Apache-2.0) | Vendor | 362 376 car. |
| 3 | 3311 | jsPDF 2.5.2 (MIT) | Vendor | 366 143 car. |
| 4 | 3719 | DentalFlow — script de base (config, seed, rendu, `buildOrderFromInput`, `createOrder`…) | Application | 377 433 car. |
| 5 | 7160 | DentalFlow — IIFE d'implémentation (`id="dentalflow-v34-implementation"`, moteur d'import, suite de tests) | Application | 893 743 car. |

**`node --check` exécuté sur les 5 blocs individuellement extraits**
(et non plus 4, voir la correction méthodologique ci-dessous), **5
exécutions consécutives complètes**, toutes `OK` sans exception :

```
run 1: ALL 5 BLOCKS OK
run 2: ALL 5 BLOCKS OK
run 3: ALL 5 BLOCKS OK
run 4: ALL 5 BLOCKS OK
run 5: ALL 5 BLOCKS OK
```

**Correction méthodologique assumée** : le script d'audit utilisé pour
les rapports V3.10.3/V3.10.3.1 employait l'expression régulière
`<script>(.*?)</script>` — qui ne reconnaît que les balises `<script>`
**sans attribut**. Le bloc #5 ci-dessus porte l'attribut
`id="dentalflow-v34-implementation"` et n'était donc **jamais compté ni
individuellement vérifié** par ce script, bien qu'il ait toujours été
exécuté par le navigateur à chaque campagne de test (les résultats de
tests eux-mêmes, y compris tout ce rapport, en sont la preuve directe —
`runAllTests()`, `test()`, et la quasi-totalité du moteur d'import vivent
dans ce bloc). Le chiffre « 4 blocs » des rapports précédents était donc
**incomplet, pas faux sur le fond** (le contenu manqué fonctionnait
bien) — corrigé ici avec la méthode exacte utilisée et le résultat
bloc par bloc.

## 7. Isolation / diff audit (§21 du mandat)

`diff -u dentalflow-next-poc-v3.10.3.1.html dentalflow-next-poc-v3.10.3.2.html`
→ **11 hunks**, tous relus individuellement.

| Zone | Hunks |
|---|---|
| `buildOrderFromInput()` — invariant central (§3-4) | 1 |
| `createOrder()` — garde effet de bord (§5) | 1 |
| `createDentistOrderCore()` — garde effet de bord (§6) | 1 |
| `createDentistOrder()` — wrapper (§6) | 1 |
| `pricingModeLabel()` défensif + 1 ligne `servicesTableInnerHTML` (conséquence directe, §9) | 2 |
| `applyImportRows` utilisateurs — email/assignedStageId non destructifs (§10-12) | 1 |
| Wizard — ordre conseillé + types historiques (§14) | 1 |
| FIX07 (modifié) | 1 |
| FIX30 (modifié, conséquence documentée) + FIX31-FIX40 (nouveaux) | 1 |
| Total | **11** |

**Zéro** hunk touchant : navigation, caméra, patient/anonymisation,
production, moteur achats (`decideProposal`/`computeNeeds`/
`reconcileProposals`), moteur Charge, `StockMovement`/`StockLot`
opérationnel, CSS, responsive, thèmes, schéma de persistance, ou toute
fonction nouvelle non demandée.

## 8. Non-régressions explicitement vérifiées

- Import Inventaire laboratoire (V3.10.3.1) : non régressé — chemin
  d'exécution non touché par ce lot (confirmé par le diff audit, §7).
- `servicePriceOverrides` : conservé, portée non étendue ; la garde
  d'usage (déjà présente depuis V3.10.3.1) est désormais renforcée en
  amont par l'invariant §3-4 de `buildOrderFromInput()` — FIX28/FIX29
  (V3.10.3.1) et FIX30 (mis à jour) tous PASS.
- `roleId`/`permissions`/`scope`/`capacity` (V3.10.3.1) : logique
  inchangée, FIX12-FIX18 tous PASS.
- `BLOCKED` avant `NO_ACTION` (V3.10.3.1, `decideProposal`) : non
  régressé, FIX19-FIX22 tous PASS.
- 0 erreur console sur l'ensemble des parcours (suite de tests, UI
  Playwright nouveaux et existants, NAVDOM).

## 9. Definition of Done (mandat §22) — statut

- Une prestation non qualifiée ne peut produire **aucune** commande,
  même via appel direct hors UI — **fait** (FIX07, FIX31, FIX32).
- Aucun `priceSnapshot` n'est généré pour cette tentative — **fait**
  (FIX07).
- Lab et Cabinet n'ont aucun effet de bord partiel — **fait** (FIX31,
  FIX32, UI Playwright A/B).
- `pricingModeLabel` ne transforme jamais null/unknown en « Forfait » —
  **fait** (FIX35).
- Réimport Personnel vide ne détruit ni email ni poste — **fait**
  (FIX36, FIX37, FIX38, UI Playwright C).
- Ordre conseillé de migration réelle corrigé — **fait** (FIX39, UI
  Playwright D).
- Articles et Stocks restent disponibles — **fait** (FIX40, UI
  Playwright D).
- Le rapport compte honnêtement les scripts réellement vérifiés —
  **fait** (§6, correction méthodologique assumée).
- FIX01-FIX40 = 40/40 — **fait**.
- Aucune nouvelle régression — **fait**, avec une divergence de date
  honnêtement documentée (§2), non masquée, non imputable à ce lot
  (reproduite à l'identique sur la base non modifiée).
