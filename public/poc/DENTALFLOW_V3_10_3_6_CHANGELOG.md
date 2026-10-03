# DentalFlow V3.10.3.6 — Changelog — Final Patient Privacy Hotfix

**Base :** `dentalflow-next-poc-v3.10.3.5.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.6.html`

## Contexte

Suite au constat ISS-002 de la recette utilisateur laboratoire (V3.10.3.5) : le nom réel du patient était
visible côté laboratoire par défaut (case « Anonymiser » non cochée par le cabinet). Ce mandat corrige ce
comportement pour appliquer la règle métier stricte : **le laboratoire ne voit jamais l'identité réelle du
patient, indépendamment de toute action ou oubli du dentiste.**

## Règle métier appliquée

- Le cabinet continue de saisir et de voir le nom/prénom réel du patient dans son propre espace.
- Le laboratoire ne voit **jamais** ce nom/prénom, dans **aucun** écran, quelle que soit la commande (nouvelle
  ou déjà existante avant ce correctif).
- Seule une référence patient pseudonymisée (`PAT-XXXXXX`, déjà existante et toujours générée) est visible côté
  laboratoire.

## Correctif principal (point d'entrée unique)

`displayPatient(order, context)` (fonction canonique unique déjà utilisée par tous les écrans labo — Commandes,
Quick View, Traçabilité, bon de suivi, portail Staff, recherche globale) ne lit plus **du tout** `order.anonymized`
pour un contexte différent de `'cabinet'` :

```js
function displayPatient(order,context){
  if(!order)return '';
  if(context==='cabinet'){
    const full=[order.patientFirstName,order.patientLastName].filter(Boolean).join(' ').trim();
    return full||order.patientRef;
  }
  return order.patientRef;
}
```

Tout contexte non-cabinet renvoie désormais **inconditionnellement** `order.patientRef`. Comme ce helper est déjà
le point de passage unique historique (§11 du mandat V3.6 d'origine), ce correctif protège automatiquement
**toutes les commandes existantes** (créées avant ce hotfix) dès leur premier affichage post-mise à jour — aucune
migration de données n'est nécessaire, seule la règle d'affichage change (la donnée `patientFirstName`/
`patientLastName` du cabinet n'est jamais détruite, conformément au §4 du mandat).

## Suppression de la case « Anonymiser »

Le champ `patientFieldsHTML()` (formulaire de commande, partagé labo + cabinet) n'affiche plus la case à cocher
« Anonymiser cette commande », remplacée par un texte informatif fixe :

> 🔒 L'identité du patient reste confidentielle et n'est pas transmise au laboratoire.

Le champ `order.anonymized` reste dans le modèle de données (compatibilité des commandes déjà persistées) mais
n'est plus jamais lu par `displayPatient()`.

## Autre point d'affichage corrigé : export CSV « Commandes »

Audit complet de tous les points listés au mandat (tableau Commandes, fiche, Quick View, Production,
Traçabilité, bons de suivi, QR, portails Staff/Scan, notifications, alertes, commentaires, messagerie,
recherche globale, historique, dashboard, export) : **un seul autre point exposait le nom réel**,
`exportCSV('commandes')` (bouton réel « CSV commandes »), qui mappait `state.orders` brut (donc
`patientFirstName`/`patientLastName` en clair dans le fichier téléchargé). Corrigé par une projection dédiée qui
remplace ces deux champs par `displayPatient(o,'lab')` :

```js
commandes:(state.orders||[]).map(o=>{const{patientFirstName,patientLastName,...rest}=o;return{...rest,patient:displayPatient(o,'lab')}})
```

## Exception documentée et volontairement conservée : Export JSON complet

`exportDentalFlowJSON()`/`serializableState()` (bouton « Export JSON complet », outil admin/backup re-importable)
continue d'inclure `patientFirstName`/`patientLastName` en clair. **Ce n'est pas un oubli** : c'est un export
technique complet de sauvegarde/migration, déjà documenté et testé comme tel depuis la V3.6 (voir commentaire de
code historique « ce n'est plus une fuite, exportDentalFlowJSON() reste un export complet admin/backup »), dont
le rôle explicite est de préserver l'intégralité des données (y compris celles appartenant au cabinet) pour une
restauration fidèle. Le mandat V3.10.3.6 prévoit lui-même cette exception (« sauf justification métier explicite
déjà prévue et validée ») et interdit par ailleurs de détruire la donnée cabinet (§4) — l'y toucher casserait le
test de round-trip existant (« Export JSON complet ré-importable ») sans bénéfice de confidentialité réel (cet
export n'est jamais consulté comme un document de travail par un utilisateur labo).

## Tests internes mis à jour

Trois tests internes du fichier encodaient l'ancien comportement (opt-in par `anonymized`) et ont été réécrits
pour vérifier l'invariant inverse, désormais correct :

1. `Identité patient V3.10.3.6 : le labo ne voit JAMAIS le nom réel (anonymized false ou true), le cabinet le
   voit toujours` (remplace l'ancien test V7).
2. `QR : payload = order.id uniquement toujours ; nom patient JAMAIS visible côté labo (fiche écran +
   impression), anonymized false ou true` (remplace l'ancien test V3.6).
3. `Recherche labo : ne trouve JAMAIS par le nom réel (anonymisée ou non), toujours par id/patientRef`
   + `N21 : recherche par nom patient réel — introuvable côté labo... trouvable par patientRef` (remplacent les
   anciens tests qui attendaient l'inverse).

## Vérification empirique — Tests P1 à P6 + anti-fuite automatique

Corpus réel complet importé, tests exécutés par actions réelles (Playwright, jamais d'appel direct de fonction
pour les vérifications de confidentialité) :

- **P1** (nouvelle commande cabinet, patient "CONFIDENTIALITE TEST") : PASS — cabinet voit le nom, labo :
  0 occurrence sur tableau Commandes / Quick View / panneau Traçabilité / bon de suivi imprimé.
- **P2** (commande historique, pré-existante au seed) : PASS — 0 occurrence sur Quick View et tableau Commandes.
- **P3** (recherche globale "CONFIDENTIALITE" depuis le labo) : PASS — 0 résultat révélant le nom.
- **P4** (portails Staff et Scan) : PASS — 0 occurrence.
- **P5** (documents/impression — CSV commandes, bon de suivi) : PASS — 0 occurrence. (Export JSON complet :
  présence du nom confirmée et documentée comme exception volontaire, voir plus haut.)
- **P6** (espace cabinet) : PASS — le cabinet retrouve et affiche toujours l'identité complète du patient.
- **Anti-fuite automatique** (identité unique `PATIENT_SECRET_E2E_98765`, balayage de 9 pages labo + Quick View
  + panneau latéral + bon de suivi + recherche globale + export CSV + portails Staff/Scan) :
  **`LAB_PATIENT_NAME_LEAKS = 0`**.

## Non-régression

```
TOTAL 468 PASSED 468 FAILED 0   (×3 exécutions consécutives)
NAVDOM PLAYWRIGHT TOTAL 31 PASSED 31 FAILED 0
UI CLICK TOTAL 16 PASSED 16 FAILED 0
```

Recette laboratoire (scénarios A-I), recette cabinet (connexion, commande numérique/physique, suivi,
messagerie), recette mobile (390×844, 430×932) et workflow de qualification par lot — tous rejoués intégralement
sur `dentalflow-next-poc-v3.10.3.6.html` : tous PASS, 0 erreur console.

## Portée

Aucun refactoring. Aucune modification hors périmètre confidentialité (ISS-003 — boutons du sélecteur de dents —
volontairement non touché, comme demandé). 5 hunks au total : `displayPatient()`, `patientFieldsHTML()`,
`exportCSV()`, et les 3 tests internes réécrits.
