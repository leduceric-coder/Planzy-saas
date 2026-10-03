# DentalFlow Next — Changelog V3.4.2

Hotfix de correction finale sur le moteur Stocks/Achats introduit en V3.4.1. Cette version élimine tous les cas particuliers codés en dur identifiés dans l'audit, généralise le moteur pour qu'il se comporte identiquement pour tout article/scénario, et complète les fonctionnalités annoncées mais restées partielles (import CSV, reset, journal d'erreurs).

## Corrigé (bugs)

- **`knownDemand()` fabriquait une demande fictive pour `ART-ZIR-HT-001`** au lieu de la dériver des commandes réelles × nomenclature (BOM). Remplacé par un calcul générique, identique pour tout article, qui déduit les lignes déjà consommées via `consumptionKey`.
- **`projectedFrancoAt` était câblé sur le scénario de démo Ivoclar/Zircone.** Remplacé par une simulation générique (`computeProjectedFrancoAt`) qui projette, article par article, la date où le panier franchirait le seuil de franco.
- **Bug de migration V5→V6 avec perte de données réelles** : à l'ouverture de l'app après une mise à jour, l'ordre de démarrage appelait `renderNav()` (via `installOverrides()`) avant `ensureV34Model()`, ce qui déclenchait `rebuildLegacyStockView()` sur un état pas encore migré et écrasait le stock réel de l'utilisateur par les valeurs de démonstration. Corrigé en réordonnant le démarrage : la migration s'exécute avant tout rafraîchissement de la navigation.
- **Le libellé « Disponible » affichait en réalité le stock physique**, jamais le stock disponible (physique − réservé), aussi bien sur la carte article que dans la fenêtre de détail.
- **Réception fournisseur codée en dur** (`{'ART-ZIR-HT-001':8}`) quel que soit le bon de commande réceptionné. Remplacé par un formulaire de réception par ligne, pré-rempli avec le reliquat réel.

## Ajouté

- **Reset natif V6** (`resetDemoV6`) : reconstruit directement tous les stores V6 (articles, fournisseurs, tarifs, mouvements, commandes, propositions, journal, imports, réglages moteur) sans repasser par le modèle legacy V5.
- **`slowMovingStock()`** : règle canonique unique du stock dormant (couverture excessive OU absence de consommation récente), utilisée par le filtre « Dormants ».
- **Assistant d'import CSV réellement utilisable** : chargement de fichier `.csv` réel (en plus du collage texte, conservé en mode debug), mapping colonne → champ éditable avec détection automatique tolérante aux accents/casse, blocage si un champ obligatoire n'est pas associé, et deux nouveaux types importables : Commandes et Utilisateurs. L'import Commandes exclut structurellement toute donnée d'identité patient (seule une référence opaque est acceptable).
- **`ImportJob`/`ImportError` persistés** comme entités réelles de l'état, plus une entrée de Journal par import terminé.
- **Capture globale des erreurs techniques** (`window.onerror` / `unhandledrejection`) journalisée automatiquement, avec verrou anti-récursion et message assaini (pas d'identité patient, pas de trace complète).
- **Popup article à 6 indicateurs distincts** : Stock physique, Réservé, Disponible, En commande, Projeté, Couverture.

## Tests

24 tests unitaires isolés (contre 16 en V3.4.1), tous verts, état identique avant/après (`runAllTests()` ne laisse aucune trace résiduelle). Voir `DENTALFLOW_V3_4_2_TEST_REPORT.md`.

## Limitations connues (hors périmètre, préexistantes en V3.4.1)

- À largeur ≤ 768 px, le panneau « Messages » ouvert depuis le smoke-test peut afficher le panneau Utilisateurs à sa place (bug d'affichage préexistant, non lié au moteur Stocks/Achats).
- En mode Scan à 390 px de large, un léger débordement horizontal (437 px de contenu) persiste (bug préexistant en V3.4.1).

Ces deux points sont documentés dans le rapport d'implémentation ; ils ne sont pas des régressions de cette version.
