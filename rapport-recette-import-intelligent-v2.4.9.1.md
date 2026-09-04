# Kanvix V2.4.9.1 — Sécurisation finale « Remplacer tous les chantiers »

Source de vérité : `public/poc/kanvix-next-gen-v2.4.9.1.html` (copie intégrale de v2.4.9).
**Périmètre strict** : uniquement l'aperçu/confirmation de la stratégie la plus destructive de l'assistant d'import. L'import lui-même (détection des doublons, normalisation, fusion, matching des tâches, dépendances) **n'est pas refondu**.

## Verdict

**PASS.** « Remplacer tous les chantiers » ne supprime plus **aucune** photo, message, document, alerte, décision ou entrée d'historique **sans l'annoncer avant la confirmation**. Flux respecté : **aperçu complet → validation → confirmation → transaction → undo**.

| Suite | Résultat |
|---|---|
| Import intelligent V2.4.9.1 (`recette-import-intelligent-v2.4.9.1.mjs`, IMP-01→IMP-22) | **75 / 75** |
| Accueil — gelé | **149 / 149** |
| Mode Chantier — gelé | **95 / 95** |
| Réglages — gelé | **63 / 63** |
| Édition des tâches — gelé | **58 / 58** |
| Planning — non-régression | **17 / 17** |
| **Total** | **457 / 457** |

**0 erreur JavaScript applicative.** Les seules lignes console sont la coupure météo/géo simulée et le `console.error` de rollback **provoqué par le test IMP-15**.

## 1. Les trois défauts corrigés

| # | Défaut V2.4.9 | Correctif V2.4.9.1 |
|---|---|---|
| 1 | « Remplacer tout » n'affichait pas les données terrain supprimées | `confirmReplaceAll()` refondu : aperçu exhaustif avec le **même moteur** que l'application |
| 2 | Documents supprimés (`S.documents = []`) mais **jamais comptés** (`sum.dropped.documents`) | Comptés **avant** le vidage, dans la branche `replaceAll` |
| 3 | Historique compté mais **non affiché** ; décisions ni comptées ni affichées | `sum.dropped` étendu avec `decisions` ; `impDroppedLines()` affiche désormais **toutes** les catégories |

## 2. Résumé `dropped` complété

`sum.dropped` contient désormais : `issues`, `decisions`, `photos`, `messages`, `documents`, `history`. La branche `replaceAll` **compte chaque catégorie AVANT de vider** quoi que ce soit :

```
sum.dropped.issues    += S.issues.length;
sum.dropped.decisions += S.decisions.length;
sum.dropped.photos    += S.photos.length;
sum.dropped.messages  += S.messages.length;
sum.dropped.documents += S.documents.length;
sum.dropped.history   += S.history.length;
// … puis seulement S.projects = []; S.tasks = []; …
```

Le chemin « remplacer un doublon » compte lui aussi les décisions supprimées (cohérence de l'aperçu standard).

## 3. `impDroppedLines()` exhaustif

Affiche, avec pluriels français corrects et **lignes à zéro masquées** :
`N anciennes tâches · N alertes · N décisions · N photos · N messages · N documents · N entrées d'historique`.

## 4. Confirmation « Remplacer tout » de niveau aperçu

`confirmReplaceAll()` calcule `plan`, `clone`, `sum` (via `applyImportPlan(plan, clone)`) **et** `valid = validateImportState(clone)`. La popup affiche :

- **Avant → après** : chantiers / tâches / jalons ;
- **⚠ Données locales supprimées** : liste exhaustive (si applicable) ;
- **✓ 0 référence invalide** — ou, si le clone est invalide, **⛔ N références invalides** (3 premières erreurs) ;
- « Vos réglages, vos ressources et votre compte sont conservés. »

## 5. Verrou si clone invalide (§6)

Si `validateImportState(clone).ok === false`, le bouton destructif **n'est pas proposé** : la popup affiche « L'import ne peut pas être appliqué car le fichier produirait un état Kanvix invalide. » + les 3 premières erreurs, et **seul « Retour »** est disponible. `app` reste strictement inchangé (IMP-20).

## 6. Confirmation unique (§7)

Cette popup **est** la confirmation explicite : pas de seconde confirmation ajoutée. Bouton destructif rouge/discret (`.btn.danger`), inchangé visuellement.

## 7. Aperçu == application (§8)

Les chiffres proviennent de `applyImportPlan(plan, clone)` ; le **même moteur** s'exécute ensuite sur `app`. Un résumé transitoire `lastImportSum` (jamais persisté, jamais dans `app` ni `STORE`) permet de vérifier l'égalité : preview `sum` === application `sum` (IMP-21, égalité JSON exacte).

## 8. Undo (§13)

Un « Remplacer tout » réussi = **un seul snapshot**. Undo restaure exactement projets / tâches / jalons / alertes / décisions / photos / messages / documents / historique — **aucune perte** (IMP-22, égalité JSON de l'état métier complet).

## 9. Tests IMP-19 → IMP-22

- **IMP-19** — aperçu exhaustif : état préparé (3 projets, 4 tâches, 2 alertes, 2 décisions, 3 photos, 4 messages, 5 documents, 6 historique) ; la popup annonce précisément **2 alertes / 2 décisions / 3 photos / 4 messages / 5 documents / 6 entrées d'historique**, et **aucune donnée n'est modifiée** avant confirmation.
- **IMP-20** — clone invalide : bouton destructif **absent**, message d'invalidité affiché, seul « Retour », `app` inchangé.
- **IMP-21** — aperçu == application : résumé preview === résumé appliqué (mêmes chiffres), 0 orpheline, état final = chantiers du fichier.
- **IMP-22** — Undo après « remplacer tout » : restauration exacte de tout l'état métier.

## 10. Non-régression

IMP-01 → IMP-18 rejoués : **PASS** (total import **75/75** avec les nouveaux). Accueil 149 · Mode Chantier 95 · Réglages 63 · Édition 58 · Planning 17. **Aucune régression.**

## 11. Périmètre & interdits respectés

**Aucune** modification de : détection des doublons, `normalizeImportText`, règles de fusion, matching des tâches, dépendances, édition universelle, Planning, Accueil, Mode Chantier, Réglages. `SCHEMA_VERSION` inchangé (**8**), `STORE` inchangé (`kanvix-product-8-3`). Diff v2.4.9 → v2.4.9.1 **strictement confiné** à : `sum.dropped` (+`decisions`), comptage de la branche `replaceAll`, comptage des décisions du chemin « remplacer doublon », `impDroppedLines()`, `confirmReplaceAll()`, et le résumé transitoire `lastImportSum`.

## Critère final

« Remplacer tous les chantiers » — l'action la plus destructive de l'assistant — annonce désormais **avant** la confirmation chaque catégorie de données locales supprimée (photos, messages, documents, alertes, décisions, historique), refuse de s'appliquer si l'état résultant serait invalide, garantit aperçu == application, et reste **entièrement annulable** en un seul Undo. ✓

## Livrables

1. `public/poc/kanvix-next-gen-v2.4.9.1.html` — fichier complet.
2. `recette-import-intelligent-v2.4.9.1.mjs` — suite (75 vérifications, IMP-01→IMP-22).
3. `rapport-recette-import-intelligent-v2.4.9.1.md` — ce rapport.
4. Captures : `recette-import-v2491/` (confirmation « remplacer tout » détaillée + captures import héritées).
