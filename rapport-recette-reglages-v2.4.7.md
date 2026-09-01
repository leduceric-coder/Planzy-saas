# Recette Réglages Kanvix V2.4.7 — Refonte de la page « Plus » → « Réglages »

Refonte UX/UI de la seule page « Plus » (fonction `renderMore`) sur `kanvix-next-gen-v2.4.7.html`. **Aucun moteur métier modifié**, **Accueil et Mode Chantier gelés non touchés**.

## Verdict

**PASS** — page Réglages livrée au niveau qualitatif de l'Accueil V2.4.5 et du Mode Chantier V2.4.6.

- **Tests Réglages : 63 PASS / 0 FAIL**
- **Accueil (gelé) : 149 PASS / 0 FAIL** (rejoué sur v2.4.7)
- **Mode Chantier (gelé) : 95 PASS / 0 FAIL** (rejoué sur v2.4.7)
- **0 erreur console applicative**

Réponse au critère final « Qu'est-ce que je peux régler ici ? » : la quantité d'information affichée, l'apparence, le rôle simulé de la démonstration, et les données de la démonstration — **rien d'autre**.

## 1. Nouvelle structure

Abandon de l'ancienne disposition en deux colonnes « panneau d'administration ». La page est désormais **une seule colonne centrée**, plafonnée à **820 px** (mesuré 820 px à 1440), composée de **3 cartes verticales** :

1. **Expérience Kanvix** (Niveau d'affichage + Apparence)
2. **Mode de démonstration** (Voir Kanvix comme : Conducteur / Artisan)
3. **Données & démonstration** (Modèle d'entreprise, Importer, Exporter, + réinitialiser séparé)

Chaque `.settings-section` : fond surface, bordure 1 px subtile, radius 16 px, ombre légère (`--shadow-xs`), padding 24 px, gap 20 px entre cartes.

## 2. Modifications de vocabulaire (interne → utilisateur)

| Avant | Après |
|---|---|
| Titre « Plus » | **« Réglages »** |
| « Accès contextuel et réglages » | **« Personnalisez votre expérience Kanvix. »** |
| Badge « Niveau essential » (haut droite) | **supprimé** |
| « Profondeur » | **« Niveau d'affichage »** |
| « Exporter les données JSON » | **« Exporter les données »** |
| « Importer » | **« Importer des données »** |
| « Créer un modèle d'entreprise » | **« Modèle d'entreprise »** |

Les mots internes « Plus », « Profondeur », « Niveau essential », « Outils contextuels » sont **absents de l'interface rendue** (vérifié par test C). Ils ne subsistent que dans deux commentaires de code (documentation développeur), jamais affichés.

## 3. Niveau d'affichage

Contrôle segmenté sobre (`Essentiel` / `Pilotage`) : surface neutre, sélection sur fond bleu très léger (`--accent-soft`), bordure accent, coche ✓, texte bleu — plus de gros bouton bleu plein. **Description dynamique** sous le contrôle :
- Essentiel → « Kanvix affiche uniquement ce qui demande votre attention. »
- Pilotage → « Kanvix affiche davantage d'informations, d'indicateurs et de contexte. »

Logique métier `setDepth('essential'|'pilot')` **inchangée**.

## 4. Apparence

Contrôle segmenté `☀️ Clair` / `🌙 Sombre` / `⚙️ Système`, même design sobre. Réutilise `setAppearance()` (+ `renderPage()` pour rafraîchir la sélection affichée). Mode système et dark mode existants conservés intégralement.

## 5. Mode de démonstration

Carte séparée, texte explicite : « Testez Kanvix avec les différentes expériences utilisateur. Il s'agit d'une **simulation de rôle** pour la démonstration — votre compte n'est pas modifié. » Deux **cartes rôle** (👷 Conducteur / 🔧 Artisan) avec description + coche ✓ sur l'actif. `setRole()` **inchangé**.

## 6. Données & démonstration

Trois **lignes de réglage** pleinement cliquables (icône + titre + sous-titre + chevron ›) au lieu de boutons en vrac : Modèle d'entreprise → `openCompanyTemplateForm()`, Importer des données → `openKanvixImport()`, Exporter les données → `exportKanvixData()`. Puis, **séparé visuellement** (séparateur), la ligne destructive **Réinitialiser la démonstration** en rouge discret (pas de gros bouton rouge). Le clic ouvre une **confirmation explicite** (`confirmResetDemo`) avant tout appel à `resetApp()` — jamais de réinitialisation sans confirmation.

## 7. Suppression des « Outils contextuels » de cette page

Ressources / Documents / Photos / Impact **retirés de la page Réglages** (ce ne sont pas des réglages). **Fonctions et accès intacts ailleurs** : `renderResources`/`renderDocuments`/`renderPhotos`/`renderImpact` toujours définies, `go('resources'|'documents'|'photos'|'impact')` rendent toujours leur page, et la palette de commandes conserve leurs entrées (vérifié par test J).

## 8. Responsive

- Desktop : colonne centrale ≤ 840 px (820 mesuré).
- 1440 / 1280 / 900 / 768 / 430 / 390 px : **0 scroll horizontal**, contrôles segmentés ne débordent jamais (retour à la ligne propre).
- ≤ 620 px : cartes rôle empilées verticalement, padding de carte réduit.

## 9. Thème sombre

Aucune couleur codée en dur — uniquement les variables existantes. Cartes (fond `rgb(16,32,47)`), titres/sous-titres lisibles, sélection segmentée visible (`--accent-soft`), action destructive rouge contrastée (`--danger-ink`). Vérifié par test Q.

## 10. Accessibilité

Tous les contrôles sont des `<button>` natifs (segments, cartes rôle, lignes de données) → accessibles clavier, focus visible (règle `[role="button"]:focus-visible` déjà héritée + boutons natifs). Groupes `role="radiogroup"` (niveau / apparence / rôle) avec `aria-checked` sur chaque option ; activation Entrée/Espace fonctionnelle (vérifié).

## 11. Tests Réglages — PASS/FAIL

**63 PASS / 0 FAIL** (`recette-reglages-v2.4.7.mjs`) couvrant A→R : titre/sous-titre, vocabulaire absent, 3 cartes, niveau + description dynamique, apparence, rôles, absence des outils contextuels + fonctions intactes, modèle/import/export câblés, réinitialisation avec confirmation (annuler conserve / confirmer restaure), responsive 6 largeurs sans scroll horizontal, dark mode, accessibilité.

## 12. Accueil : 149/149

`recette-accueil-v2.4.5.mjs` rejoué sur v2.4.7 : **149 PASS / 0 FAIL**. Aucune ligne Accueil modifiée.

## 13. Mode Chantier : 95/95

`recette-mode-chantier-v2.4.6.mjs` rejoué sur v2.4.7 : **95 PASS / 0 FAIL**. Aucun comportement Mode Chantier modifié.

## 14. Erreurs console

**0 erreur JavaScript applicative.** La seule ligne réseau observée (`ERR_FAILED` / `ERR_TUNNEL_CONNECTION_FAILED`) provient de la coupure météo **volontairement simulée** dans les tests — comportement géré, sans exception.

## 15. Limites

- Le bouton « Importer des données » ouvre le sélecteur de fichier **natif de l'OS** (comportement du moteur `openKanvixImport` inchangé) : non testable en headless au-delà de la vérification du câblage + création d'un `<input type=file .json>` (vérifiée).
- Le clic « Artisan » (comme précédemment) bascule vers l'expérience Artisan (simulation de rôle) et quitte donc la page Réglages — comportement `setRole` existant, volontairement conservé.
- Périmètre limité aux mots visibles : les termes internes subsistent uniquement dans des commentaires de code (non affichés).

## Test visuel « 3 secondes » & « aucune formation »

- « Est-ce que je comprends que cette page sert à personnaliser Kanvix ? » → **OUI** (titre « Réglages » + sous-titre + 3 cartes hiérarchisées).
- « Est-ce que je distingue les préférences personnelles des fonctions de démonstration ? » → **OUI** (carte « Expérience Kanvix » vs cartes « Mode de démonstration » et « Données & démonstration » explicitement étiquetées démonstration).

## Livrables

1. `kanvix-next-gen-v2.4.7.html` — fichier complet.
2. `recette-reglages-v2.4.7.mjs` — suite Playwright (63 vérifications).
3. `rapport-recette-reglages-v2.4.7.md` — ce rapport.
4. Captures : `recette-reglages/` (desktop clair, desktop sombre, mobile 390, confirmation réinitialisation).
