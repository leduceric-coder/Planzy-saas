# Rapport — Kanvix V2.8.3 · Onglet « Jalons » : refonte en frise

**Fichier livré** : `public/poc/kanvix-next-gen-v2.8.3.html`
**Source** : `public/poc/kanvix-next-gen-v2.8.2.html`
**Suite de recette** : `recette-frise-jalons-v2.8.3.mjs` — **42 / 42 PASS**, **0 erreur console applicative**
**Captures** : `recette-v2.8.3/` (13 captures + `resultats.json`)
**Branche** : `claude/kanvix-next-gen-poc-im084x`

---

## A. Résumé des choix UI/UX

L'image de référence a servi de cahier des charges de composition. Ce que j'en ai retenu, et
appliqué :

| Élément de la référence | Traduction dans Kanvix |
|---|---|
| Barre de filtres `Tous / Cette semaine / Ce mois` | segmented control Kanvix existant, filtre réel |
| Pastilles de chantiers en légende | **filtres cliquables** — la pastille s'éteint, les jalons disparaissent |
| Ligne de temps horizontale continue | rail de 2px, continu de la première à la dernière bulle |
| Segments pleins puis pointillés | **plein jusqu'au prochain jalon, pointillé ensuite** |
| Grosses bulles à icône | bulles de 38px, icône **pilotée par le statut**, anneau à la couleur du chantier |
| Date au-dessus de la bulle | date + écart relatif au-dessus, alignés sur la bulle |
| Trait vertical bulle → carte | trait de rappel, même axe, jusqu'au liseré de la carte |
| Liseré coloré en haut de carte | liseré de 3px, **même couleur que la bulle** |
| Pastille de statut dans la carte | `.op-badge` existant, 5 statuts métier |
| `N tâches associées` | **« N interventions d'ici là »**, comptées sur `getProjectTasks()` |
| Bandeau de 3 KPI | total + répartition, prochain jalon, chantier concerné |
| Bandeau « Bon à savoir » | conservé, et il explique la lecture plein / pointillé |

**Ce qui tue l'effet de vide**, concrètement : la frise ne s'arrête plus à trois cartes posées. La
page compte désormais quatre niveaux empilés — barre, frise, synthèse, aide — et la frise occupe
**99 % de la largeur utile** à 1440px, **98 %** à 900px.

**Trois écarts assumés avec la référence**, tous documentés :

1. **Le navigateur de mois (`Septembre 2025 ‹ ›`) n'a pas été repris.** Il fait double emploi avec
   le filtre « Ce mois » et introduit une pagination qui pourrait vider la frise sur les données de
   démonstration. Son emplacement porte l'**amplitude de dates affichée**, qui rend le même
   service. Dis-le si tu veux la pagination : c'est un ajout isolé.
2. **Les statuts ne sont pas `À venir / Planifié`** (qui ne sont qu'une reformulation de la
   distance à aujourd'hui) mais **cinq statuts métier** : `À venir`, `Menacé`, `Dépassé`,
   `Atteint`, `Chantier clôturé`. Aucun n'est inventé — voir section C.
3. **L'icône de bulle dit le statut, pas le type de chantier.** Un jalon menacé porte un
   triangle d'alerte, un jalon atteint une coche. Une icône qui répète la couleur du chantier
   n'apprend rien ; celle-ci se lit à trois mètres.

---

## B. Fichier final

`public/poc/kanvix-next-gen-v2.8.3.html` — fichier monolithique complet, livré tel quel.

**Périmètre du code.** `operationMilestonesTab()` est la **seule fonction réécrite**. Dix helpers
sont ajoutés (`milestoneScope`, `milestoneHiddenSites`, `setMilestoneScope`, `toggleMilestoneSite`,
`resetMilestoneFilters`, `visibleOperationMilestones`, `milestoneOpenTasks`, `milestoneStatus`,
`operationMilestoneBar`, `operationMilestoneStats`). **94 moteurs et rendus sont vérifiés
byte-identiques** à V2.8.2.

`STORE` inchangé, `SCHEMA_VERSION` **12 → 12**, **aucune migration**.

---

## C. Vérifications

### Checklist demandée

- [x] **desktop OK** — frise horizontale, 99 % de la largeur utile à 1440px, 98 % à 900px
- [x] **mobile OK** — frise verticale, date à gauche, bulle sur le rail, carte à droite, jonctions
      mesurées à **0px**, aucune date tronquée, aucun scroll horizontal
- [x] **autres onglets Opération OK** — Vue d'ensemble (4 KPI), Planning (13 éléments), Ressources
      (11 lignes) rendent leur contenu, y compris après aller-retour
- [x] **état vide OK** — **deux** états distincts désormais (voir plus bas)
- [x] **pas de régression visible** — 35 suites rejouées deux fois : **0 régression**

### Ce qui a été mesuré

| # | Point | Mesure |
|---|---|---|
| FRISE-01→03 | La frise affiche exactement le moteur, dans son ordre | noms et dates DOM comparés un à un ; 1 `.op-milestone` par jalon |
| FRISE-04 | Le rendu n'écrit rien ; filtrer n'écrit que dans `app.ui` | `localStorage` identique après rendu ; champs de jalon inchangés |
| FRISE-05 | Sauvegarde sans les clés de filtre | retombe sur « Tous », frise entière, **aucune migration** |
| FRISE-06 | Ligne continue | segments jointifs, bornés aux bulles extrêmes |
| FRISE-07 | Ligne franche | 2px, écart de luminance **0,413** avec le fond |
| FRISE-08 | Vraies bulles | 38px, icônées, centrées sur leur colonne, alignées |
| FRISE-09 | Date au-dessus de la bulle | vérifié sur chaque jalon |
| FRISE-10 | **Lien bulle → carte explicite** | trait de rappel sur le même axe (±1px), du bas de la bulle au liseré ≥ 3px |
| FRISE-11 | Rangée régulière | même bord haut, même largeur |
| FRISE-12 | Plein derrière / pointillé devant | `solid` avant le prochain jalon, `dashed` après |
| FRISE-13 | Les 5 informations demandées | date, chantier, titre, statut, « Voir » |
| FRISE-14 | **Statut recalculable depuis les seuls moteurs existants** | 4 statuts distincts observés, tous égaux au calcul de référence |
| FRISE-15 | « Menacé » = règle de `milestoneImpactNote()` | même `calculateProjectEnd()`, même comparaison |
| FRISE-16 | « N interventions d'ici là » | compté sur `getProjectTasks()`, comparé ligne à ligne |
| FRISE-17 | Bulle et liseré de même couleur | égalité stricte ; l'alerte prime sur la teinte du chantier |
| FRISE-18 | Chantier clôturé | « Chantier clôturé » dans la carte (contrat d'OP-40) |
| FRISE-19→22 | Filtres | défaut = tout ; `Cette semaine` via `getCurrentWeekRange()` ; légende filtrante ; remise à zéro |
| FRISE-23/24 | **Deux états vides** | vide de filtre ≠ vide de donnée |
| FRISE-25/26 | Synthèse | total = jalons affichés ; répartition totalisant exactement ; accord en nombre |
| FRISE-27 | Aucune création de jalon proposée | contrat d'OP-39 tenu par les nouveaux bandeaux |
| FRISE-28→31 | Responsive et volume | 99 %/98 % de couverture ; 8 jalons → 2 rangées, 0 débordement |
| FRISE-32/33 | Thème sombre | barre, frise, cartes, synthèse, aide ; **0 couleur en dur** |
| FRISE-34→37 | Navigation | cible du clic inchangée ; les filtres ne déclenchent pas la navigation du jalon |
| FREEZE-283 | Périmètre | **94 moteurs byte-identiques**, 1 réécrite, 10 ajoutées |

### Les cinq statuts, et d'où ils viennent

Aucun seuil arbitraire n'a été introduit. Chaque statut se déduit de moteurs déjà présents :

| Statut | Règle | Moteur réutilisé |
|---|---|---|
| `Chantier clôturé` / `archivé` | le chantier n'est plus actif | `isProjectActive` / `isProjectArchived` |
| `Atteint` | date passée, aucune intervention ouverte avant | `getProjectTasks` |
| `Dépassé` | date passée, au moins une intervention ouverte | `getProjectTasks` |
| `Menacé` | fin de chantier estimée au-delà de la date du jalon | `calculateProjectEnd` — **la règle même de `milestoneImpactNote()`** |
| `À venir` | tous les autres cas | — |

### Les deux états vides

La refonte a fait apparaître un cas qui n'existait pas : **filtrer jusqu'au vide**. Renvoyer
« Aucun jalon » alors que l'opération en compte trois aurait été faux.

- **Vide de donnée** — « Aucun jalon », texte de V2.8.1 **conservé à l'identique**, sans barre de
  filtres inutile ni frise vide.
- **Vide de filtre** — « Aucun jalon sur cette période », qui **rappelle combien de jalons existent**,
  garde la barre de filtres accessible et propose « Voir tous les jalons ».

### Rejeux des suites antérieures

| Suite | Résultat | Écart vs baseline V2.8.2 |
|---|---|---|
| `recette-operations-v2.8.0.mjs` | **71 / 71** | **aucun** |
| `recette-harmonisation-ux-v2.8.1.mjs` | 48 / 49 | aucun (écart V2.8.2 déjà documenté) |
| `recette-correctifs-v2.7.1.mjs` | 43 / 45 | aucun |
| `recette-controles-qualite-v2.7.0.mjs` | 68 / 73 | aucun |
| `recette-jalons-timeline-v2.8.2.mjs` | 18 PASS / 6 FAIL puis arrêt | **obsolescence assumée** — voir ci-dessous |

**`recette-operations-v2.8.0` à 71/71 après une refonte complète** est le résultat qui compte : elle
compte les `.op-milestone` (OP-39), lit leur texte pour y trouver « Chantier clôturé » (OP-40),
vérifie l'absence de débordement à 390px (OP-50) et sonde le fond d'une carte en thème sombre
(OP-51). Tout tient, parce que la classe `.op-milestone` est restée portée par la carte.

---

## D. Points de vigilance

**1. La recette V2.8.2 est volontairement périmée, et je ne l'ai pas retouchée.**
Tu as écrit : *« Le rendu actuel V2.8.2 n'est PAS la cible. Il doit être remplacé. »* Ses six échecs
et son arrêt portent tous sur des sélecteurs de la présentation remplacée :

| Assertion | Ce qu'elle mesurait | Pourquoi elle tombe |
|---|---|---|
| JAL282-12 | chantier dans `.op-ms-site small` | la frise le met directement dans `.op-ms-site` |
| JAL282-15 | étiquette « Date passée » | remplacée par un statut réel (`Dépassé` / `Atteint`) |
| JAL282-16 | « aucun badge sur un chantier clôturé » | « Chantier clôturé » EST désormais le badge de statut |
| JAL282-20 (×2) | rail de `height: 1px` | le rail est un `border-top` de 2px — épaissi précisément parce qu'il était « trop léger » |
| JAL282-22 | rail mobile sur `.op-ms-rail::before` | il est passé sur `.op-ms::after` |
| arrêt à JAL282-24 | `.op-h2` de l'ancien en-tête | remplacé par la barre de filtres |

Aucune ne signale un moteur cassé. La preuve inverse est double : `recette-operations-v2.8.0` à
71/71 et FREEZE-283 à 94 moteurs byte-identiques. La suite V2.8.3 la remplace avec 42 assertions
couvrant le même terrain plus la nouvelle composition.

**2. Trois défauts réels trouvés en cours de route, tous invisibles à l'œil.**

| Défaut | Diagnostic | Correction |
|---|---|---|
| Le trait « à venir » restait noyé dans le fond | `--border` (#dce2ea) ≈ `--bg-app` (#eceff5) — exactement le reproche « timeline trop légère » | les deux états passent sur des encres de texte ; écart de luminance porté à **0,413** |
| Le rail mobile s'arrêtait **2px** avant chaque bulle | il était tiré depuis la boîte du *rail*, dont la hauteur ne couvre pas le padding bas du jalon | ancré sur la boîte du **jalon**, dont le bas est exactement le haut du suivant — jonction exacte **par construction**, sans constante à calibrer ; mesuré à **0px** |
| `milestoneRelativeLabel()` n'était plus byte-identique | ma réécriture avait remplacé l'échappement `’` par le caractère littéral — zéro différence de comportement, mais le gel perdait son sens | forme d'origine restituée |

**3. Un état d'interface nouveau, et pourquoi il ne coûte rien.** Les filtres vivent dans
`app.ui.milestoneScope` et `app.ui.milestoneHiddenSites` — le sac d'état d'interface qui porte déjà
le filtre de charge des ressources. Ils sont **toujours lus avec une valeur par défaut** : FRISE-05
supprime les deux clés et vérifie que la frise s'affiche entière. Une sauvegarde antérieure se relit
donc telle quelle, **sans migration**, et `SCHEMA_VERSION` reste à 12.

**4. Ce que la frise ne fait toujours pas.** Elle ne permet pas de **créer** un jalon depuis
l'opération : un jalon appartient à un chantier, et OP-39 vérifie explicitement cette absence.
FRISE-27 contrôle que les nouveaux bandeaux ne l'ont pas réintroduite.

**5. Le passage à la ligne.** À 8 jalons, la frise rend 2 rangées, chacune avec son propre rail et
**0 segment débordant**. La rangée suivante démarre par un court segment avant sa première bulle,
qui se lit comme la continuation de la rangée précédente. C'est un choix, pas un artefact.

---

## E. Balayage de non-régression historique

35 suites, chacune exécutée **deux fois** — contre V2.8.2 puis contre V2.8.3 — seul le delta étant
retenu. Copies de travail isolées hors dépôt : **0 fichier suivi par git modifié**.

**32 suites sur 35 : diff de verdicts strictement vide.** Les 3 restantes
(`recette-accueil-v2.4.4.1`, `recette-accueil-v2.4.5`, `recette-historique-chantiers-v2.4.12`) ne
diffèrent que par le **texte d'un chronomètre** (« (27ms) » → « (25ms) », « 4 ms » → « 8 ms »), avec
des verdicts identiques et des compteurs d'échecs strictement égaux à la baseline.

**0 régression réelle.**
