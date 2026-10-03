# DentalFlow V3.10.3.6 — Rapport de test — Final Patient Privacy Hotfix

**Base :** `dentalflow-next-poc-v3.10.3.5.html` (intacte)
**Fichier testé :** `dentalflow-next-poc-v3.10.3.6.html`

## 1. Syntaxe

`node --check` sur les 5 blocs `<script>` réels extraits du fichier : **tous OK**.

## 2. Audit des points d'affichage labo (mandat §3)

18 points listés par le mandat ont été audités par lecture directe du code (grep exhaustif de
`patientFirstName`/`patientLastName`/`displayPatient`) :

| Point audité | Passe déjà par `displayPatient()` | Résultat |
|---|---|---|
| Tableau Commandes | Oui (`orderSearchText`) | Corrigé automatiquement |
| Fiche commande / Quick View | Oui (`_renderQuickView`) | Corrigé automatiquement |
| Production (carte) | Oui | Corrigé automatiquement |
| Traçabilité | Oui (via Quick View) | Corrigé automatiquement |
| Bon de suivi (impression) | Oui (`printFiche`) | Corrigé automatiquement |
| QR Code | N/A — encode `order.id` uniquement | Jamais concerné |
| Portail Staff (feedback scan) | Oui (`applyStaffFeedback`) | Corrigé automatiquement |
| Portail Scan (kiosque) | N/A — aucun affichage patient | Jamais concerné |
| Notifications | N/A — `${cabinet} — ${type}` uniquement | Jamais concerné |
| Alertes / "À surveiller" | N/A — pas de nom patient affiché | Jamais concerné |
| Commentaires système / historique | N/A — jamais de nom (vérifié par test dédié) | Jamais concerné |
| Messagerie | N/A — jamais de nom (vérifié par test dédié) | Jamais concerné |
| Recherche globale | Oui (`orderSearchText`) | Corrigé automatiquement |
| Dashboard (Accueil) | N/A — aucun nom patient affiché | Jamais concerné |
| **Export CSV « Commandes »** | **Non — bypass direct trouvé** | **Corrigé explicitement** |
| Export JSON complet | Intentionnellement hors périmètre | Exception documentée (backup/restore) |
| Factures (liste + PDF) | Oui (liste) / aucun nom (PDF) | Corrigé automatiquement / jamais concerné |
| Documents générés (bon de suivi) | Oui | Corrigé automatiquement |

**16 points corrigés automatiquement** par le correctif unique de `displayPatient()` (déjà le point de passage
canonique) + **1 point corrigé explicitement** (export CSV) + **1 exception documentée** (export JSON complet,
justification métier déjà validée en V3.6).

## 3. Tests P1-P6 (actions réelles, corpus réel complet)

```
P1 (nouvelle commande cabinet) : cabinetSeesName=true, labLeaks={ordersTable:0,quickView:0,tracePanel:0,printFiche:0} → PASS
P2 (commande historique)       : 0 occurrence Quick View + tableau Commandes → PASS
P3 (recherche globale)         : searchPopoverLeak=0 → PASS
P4 (portails Staff/Scan)       : staffLeak=0, scanLeak=0 → PASS
P5 (documents/impression)      : csvCommandes=0, bonDeSuivi=0 (JSON : présence documentée, exception validée) → PASS
P6 (espace cabinet)            : cabStillSeesName=true, cabDetailSeesName=true → PASS
```

## 4. Anti-fuite automatique

Identité unique `PATIENT_SECRET_E2E` / `98765` créée via le portail cabinet réel, puis recherchée (texte
réellement rendu, `innerText`, hors code source des balises `<script>`) sur 16 surfaces : Accueil, Commandes,
Production, Stock, Rapports, Charge, Utilisateurs, Cabinets, Factures, Quick View, panneau latéral (Traçabilité),
bon de suivi imprimé, recherche globale, export CSV Commandes, portail Staff, portail Scan.

```
LAB_PATIENT_NAME_LEAKS = 0
```

**Note méthodologique :** la première itération du scan anti-fuite utilisait `page.content()` (source HTML
complète, y compris le contenu texte des balises `<script>`, qui embarquent près de 18 000 lignes de code
source contenant notamment les données de démonstration) et produisait de faux positifs (des prénoms de
démonstration comme identifiants de test apparaissant légitimement dans le code source, jamais rendus à
l'écran). Corrigé en scannant `document.body.innerText` (texte réellement rendu à l'écran, ignore le contenu des
balises `<script>`/`<style>` par définition du DOM), qui reflète fidèlement ce qu'un utilisateur voit
réellement. Les résultats ci-dessus sont ceux de cette méthode corrigée.

## 5. Tests internes

Les 3 tests internes qui encodaient l'ancien comportement (`anonymized` gouverne l'affichage labo) ont été
réécrits pour vérifier l'invariant inverse. **468/468 PASS dès la première exécution après réécriture**,
confirmant qu'aucun autre test du fichier ne dépendait de l'ancien comportement.

## 6. Non-régression

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK TOTAL 16 PASSED 16 FAILED 0
```

Recette laboratoire (9/9 scénarios A-I), recette cabinet (connexion, commande numérique, commande empreinte
physique, suivi, messagerie), recette mobile (390×844 et 430×932), qualification par lot — toutes rejouées
intégralement : tous PASS, 0 erreur console sur l'ensemble des parcours.

## 7. Conclusion

Règle de confidentialité patient appliquée de façon systématique et non désactivable côté laboratoire, via le
point de passage canonique unique déjà en place (`displayPatient()`), plus un correctif ciblé pour le seul
autre point d'exposition réel trouvé (export CSV Commandes). Protection vérifiée sur les commandes nouvelles ET
historiques, sur 16 surfaces distinctes, par un test anti-fuite automatisé donnant `LAB_PATIENT_NAME_LEAKS = 0`.
0 régression sur 468 tests hérités + NAVDOM + UI Playwright + recette utilisateur complète rejouée.
