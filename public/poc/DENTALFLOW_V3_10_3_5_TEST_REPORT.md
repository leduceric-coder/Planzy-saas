# DentalFlow V3.10.3.5 — Rapport de test — Correctif recette utilisateur (ISS-001)

**Base :** `dentalflow-next-poc-v3.10.3.4.html` (intacte)
**Fichier testé :** `dentalflow-next-poc-v3.10.3.5.html`

## 1. Syntaxe

`node --check` sur les 5 blocs `<script>` réels extraits du fichier : **tous OK**.

## 2. Test ciblé de la correction

```
Avant correctif (v3.10.3.4) : popoverOpenAfterType=true, popoverStillOpenAfterOutsideClick=true
Après correctif (v3.10.3.5) : popoverOpenAfterType=true, popoverStillOpenAfterOutsideClick=false
```

## 3. Recette guidée laboratoire (scénarios A-I) — rejouée intégralement

Corpus réel complet réimporté, 9 scénarios exécutés de bout en bout par clics réels :

- A (Accueil) PASS — vérification dédiée popover : `popoverStillOpenAfterOutsideClick:false` (corrigé)
- B (Cabinet) PASS — recherche <30s, fiche ouverte, coordonnées correctes
- C (Commande numérique) PASS — 12 clics, commande créée, tarif figé
- D (Empreinte physique) PASS — réception confirmée via le vrai bouton, suivi débloqué
- E (Production) PASS — bon de suivi imprimé, localisation changée via le vrai contrôle, commentaire réel
  enregistré (vérifié via `orderComments()`)
- F (QR/collaborateur) PASS — portails Staff et Scan sans fuite de navigation admin (vérifié par visibilité
  réelle, pas seulement présence DOM)
- G (Livraison) PASS — commande livrée via le vrai bouton "Marquer comme livrée"
- H (Stock) PASS — CUMP (81€) jamais utilisé comme prix fournisseur (`supplierUnitPrices:[null]`)
- I (Personnel/absence) PASS — 1 PRODUCTION, 1 ADMINISTRATIF, 1 LECTURE réels identifiés, absence réelle créée

0 erreur console, 0 anomalie supplémentaire détectée sur cette relecture.

## 4. Recette cabinet dentaire — rejouée intégralement

- Connexion portail (`?mode=dentist`), aucune fuite de navigation labo.
- Commande créée non anonymisée → nom patient réel visible côté labo (constat ISS-002, non technique).
- Commande créée anonymisée (empreinte physique) → seule la référence opaque visible côté labo — mécanisme
  d'anonymisation confirmé fonctionnel.
- Suivi commande, messagerie : PASS.
- 0 erreur console.

## 5. Recette mobile (390×844, 430×932) — rejouée intégralement

Menu (tiroir), tableaux → cartes, production → accordéon, Quick View plein écran adapté, formulaire (types de
champs adaptés : date/fichier/radio/checkbox), sélecteur de dents adapté à l'écran, portails Staff/Scan adaptés
— tous PASS, aucun défilement horizontal détecté, 0 erreur console.

## 6. Qualification par lot (V3.10.3.4) — rejouée intégralement

Filtre, sélection, mode, confirmation, application, annulation, persistance après reload — tous PASS, inchangé.

## 7. Non-régression

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK TOTAL 16 PASSED 16 FAILED 0
```

## 8. Conclusion

Le seul défaut fonctionnel réel remonté par l'ensemble de la recette utilisateur (ISS-001) est corrigé, vérifié
par un test ciblé et par la relecture intégrale de tous les scénarios de recette (labo, cabinet, mobile) sur le
corpus réel complet. 0 régression sur 468 tests hérités + NAVDOM + UI Playwright.
`dentalflow-next-poc-v3.10.3.5.html` est la version finale de la recette utilisateur laboratoire.
