# DentalFlow Next — Changelog V3.4.3

Hotfix d'audit final sur le moteur Stocks/Achats de la V3.4.2. Corrige uniquement les anomalies identifiées par un audit indépendant du code — aucune nouvelle fonctionnalité, aucune refonte.

## Corrigé (P0 — bloquant)

- **Migration V5→V6 potentiellement destructive** : la détection "cet article ressemble au seed de démo, donc tout le state est démo" (sentinelle `ZIR-HT-001 qty=45 min=12`) pouvait écraser les stocks réels d'un utilisateur. Supprimée. Chaque article legacy migre désormais fidèlement : `qty→OPENING exact`, `min→safetyStock exact`, `incoming→PO synthétique exact`, `capacity→capacity exact`. DEMO_ARTICLES ne sert plus qu'à compléter un champ réellement absent.
- **Proposition BLOCKED commandable** : `approveProposal()` refusait la validation de manière incomplète. Bloque désormais toute conversion en commande dès que `recommendedAction==='BLOCKED'` ou qu'une raison bloquante existe, avec retour explicite `{success:false, reason:'BLOCKED_PROPOSAL'}`.
- **Article sans fournisseur/tarif disparaissait silencieusement** : `computeNeeds()` retournait tôt (`if(!baseTariff)return`) sans jamais signaler le besoin. Il apparaît maintenant comme une proposition BLOCKED (`missing_supplier` / `missing_price`) visible dans Achats.
- **UI BLOCKED ambiguë** : le bouton "Commander" restait cliquable sur une proposition bloquée. Remplacé par un bouton désactivé "Résoudre le blocage" avec la raison affichée, sur la carte et dans le détail.
- **Réception fournisseur sans garde-fou métier** : `receivePurchaseOrder()` acceptait n'importe quelle quantité, y compris au-delà du reliquat commandé. Refuse désormais toute quantité supérieure au reliquat, non numérique, négative ou nulle — aucun stock artificiel créé.

## Corrigé (P1)

- **Faux positif du test WAIT→ORDER_NOW** : l'assertion `qtyAfter>=qtyBefore` masquait une régression de quantité. Fixture reconstruite avec des paramètres déterministes (indépendants de la migration) produisant strictement `5→9`, cohérent avec le texte du journal ("2 bridges … 4 disques" crée réellement 2 commandes).
- **Surcoût fournisseur codé en dur (`*9`)** : remplacé par une comparaison de coût rendu réel (`landedCost`) pour la quantité effectivement recommandée, chez le fournisseur préféré et chez l'alternatif.
- **`PP-002`→`CF-0042` codé en dur** : supprimé. Tout `PurchaseOrder` obtient son ID via `nextPOId()`.
- **Minimum de commande + urgence + alternatif** : l'action passait à `ORDER_NOW` sans déplacer réellement la ligne vers le fournisseur alternatif. `computeNeeds()` route désormais réellement le besoin vers un fournisseur alternatif viable ; sans alternative, la proposition reste `BLOCKED`.
- **Franco `null` traité comme "déjà atteint"** : `(missingForFreeShipping||0)<=0` confondait "pas de franco" avec "franco atteint". Un fournisseur sans seuil de franco ne déclenche plus jamais cette branche.

## Corrigé (P2)

- **`rejectedCount` comptait les erreurs, pas les lignes** : une ligne à 2 erreurs comptait pour 2 rejets. Compte désormais le nombre de lignes réellement rejetées.
- **Historique `ImportErrors` écrasé à chaque import** : passé en append-only, chaque erreur tagguée par `jobId`.
- **Plusieurs fournisseurs préférés actifs par article** : l'import de tarifs retire désormais `preferred` de l'ancien fournisseur préféré quand une nouvelle ligne préférée est importée.
- **`slowMovingStock()` utilisait `Date.now()`** au lieu de l'horloge métier `Clock.now()`, rendant le calcul dépendant de la date réelle de la machine plutôt que de la date de démonstration.

## Corrigé (Responsive)

- **Panneau Messages affichant Utilisateurs à ≤768px** : le smoke-test lisait `document.body.innerText` avant la fin de la transition d'ouverture du panneau. Corrigé pour lire directement le contenu du panneau (indépendant du timing d'animation).
- **Débordement horizontal en mode Scan à 390px** (437px de contenu) : le champ de saisie `.scan-cmd-input` n'avait pas `min-width:0`, l'empêchant de rétrécir dans son conteneur flex. Corrigé — responsive 16/16 (4 largeurs × 4 modes).

## Tests

35 tests unitaires isolés (24 conservés de la V3.4.2 + 11 nouveaux ciblant chaque anomalie), tous verts, état identique avant/après. Voir `DENTALFLOW_V3_4_3_TEST_REPORT.md`.

## Non touché (fonctionne, non modifié)

Architecture générale, persistance V6, reset natif, assistant d'import (structure), capture d'erreurs techniques — conformément à la consigne de ne pas refaire ce qui fonctionne déjà.
