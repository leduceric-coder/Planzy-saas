# RAPPORT — KANVIX V2.12.3 — RETOUR PROSPECT R6

Deux lots distincts, conformément à la stratégie imposée :

| Lot | Livrable | Statut |
|---|---|---|
| **A — Entreprises multi-activités** | `public/poc/kanvix-next-gen-v2.12.3.html` (évolution directe de la V2.12.2.1) | Terminé · recette **157 / 157** |
| **B — Bilan des retards** | `public/poc/kanvix-next-gen-v2.12.3-bilan-retards-prototype.html` (**prototype séparé**, non fusionné au produit) | Terminé · recette **175 / 175** |

**0 erreur console applicative** sur les deux recettes. Moteurs protégés **byte-identiques** à la base certifiée (voir §4).

---

## 1. Constats préalables — à lire en premier

1. **La base certifiée n'était pas sur la branche de travail.** La branche désignée ne contenait qu'un ancien `kanvix-next-gen.html`. La V2.12.2.1 (commit `e261434`) et les fichiers R5.1 n'existent que sur la branche `claude/kanvix-next-gen-poc-im084x`. Aucune fusion n'a été faite : seul `kanvix-next-gen-v2.12.2.1.html` a été **copié** (SHA-256 vérifié identique à la source : `1c9f95039a65f6c5…`). Les fichiers R5.1 n'ont été ni utilisés, ni copiés, ni modifiés. La base copiée n'est pas modifiée (`git diff` vide).
2. **Le brief s'interrompt** au point 18 de §8.2 (« 18. zéro… ») et ne contient ni la suite ni les sections suivantes. J'ai interprété ce point comme « zéro erreur console » (vérifié, test `Z01`). Si des exigences figuraient dans la suite, elles n'ont pas été traitées.
3. **Le référentiel « métier des personnes » est un texte libre** (`jobTitle`), pas un catalogue. Le seul catalogue à identifiants stables du produit est le référentiel **lots / corps d'état** (`app.lots`, V2.6). C'est lui qui sert de catalogue partagé (voir §2.1).
4. **L'export métier (`kanvix-portable`) ne transporte aucune ressource** (chantiers, tâches, lots, opérations seulement). Les activités d'entreprise voyagent donc par la **sauvegarde complète**. Ce contrat de la V2.12.2.1 est conservé (voir §2.6 et §6).

---

## 2. LOT A — Entreprises multi-activités (V2.12.3)

### 2.1 Modèle de données

`resource.activityLotIds : string[]` — **identifiants stables** de lots du référentiel existant, jamais une chaîne libre.

- Une **personne** garde son métier unique `jobTitle` (libellé « Poste / métier » inchangé, non touché).
- Une **entreprise** affiche « **Activités / corps d'état** » (jamais « Métier »).
- **Un seul catalogue** : renommer « Plomberie » dans Réglages renomme l'activité partout ; un lot porté par une entreprise ne peut plus être supprimé (message dédié).
- Zéro, une ou plusieurs activités ; plafond de 20 par entreprise ; ordre conservé.
- `SCHEMA_VERSION` 15 → **16**.

### 2.2 Migration 15 → 16 (`migrateCompanyActivities`)

Défensive, sans perte, **idempotente** (2ᵉ et 3ᵉ passages strictement identiques, ressources et lots). Formes acceptées : tableau d'ids, tableau de noms, chaîne « A, b ; C », ancien champ unique ou multiple (`activity`, `activities`, `trade`, `metier`, `specialty`, `specialties`, `jobTitle` porté par une entreprise), objets `{name}`, doublons de casse/accents, valeurs vides, ids orphelins.

- Un nom inconnu **crée un lot** (rien n'est perdu) ; un nom déjà présent est rapproché (accents/casse ignorés, puis « métier indicatif » du lot s'il est sans ambiguïté).
- Les anciens champs sont **consommés** : une activité retirée par l'utilisateur ne peut pas revenir à la migration suivante.
- **Aucune inférence** : une entreprise sans activité reste `[]`. Les activités de démonstration ne sont **jamais recopiées** dans un état existant (le bloc historique « V4.6 » qui complète les ressources de démo a été explicitement exclu pour ce champ).
- Prouvé sur un **état authentique** : la vraie V2.12.2.1 est jouée, son état persistant est réinjecté dans V2.12.3 (test A18) et une **sauvegarde produite par la V2.12.2.1** est restaurée (test A10).

### 2.3 Interface

- **Sélecteur compact multiple** (motif WAI-ARIA « combobox éditable ») : recherche dans le catalogue, puces avec suppression individuelle (bouton ×, Retour arrière), prévention des doublons (accents/casse ignorés), navigation clavier complète, cibles tactiles ≥ 44 px (options) et ≥ 24 px (×), thèmes clair/sombre, 390 px.
- Saisir un nom absent du catalogue propose « **Ajouter « X »** ». Le lot n'est créé **qu'à l'enregistrement**, dans la **même transaction** Annuler/Rétablir que l'entreprise ; annuler le formulaire ne crée rien (test B02).
- Un texte tapé mais non validé n'est pas perdu à l'envoi (B03).
- Entrée dans ce champ ne soumet jamais le formulaire ; Échap ferme d'abord la liste, puis le tiroir (B01).

### 2.4 Affichage (surfaces compactes : 2 activités puis « +N »)

Carte d'équipe · carte d'équipe d'un chantier · ligne de ressource · archives · fiche (liste **complète**, jamais « +N ») · sélecteur d'intervenant principal · sélecteur de renforts · filtre de ressource du planning · palette de commandes. Le « +N » est un bouton (`aria-expanded`, `aria-label` listant les activités masquées) qui n'ouvre pas la fiche.

### 2.5 Recherche et filtre

- Page Équipe : **champ de recherche** (nom, activité, contact, métier) et **filtre « Activité »** (n'affiche que les activités réellement portées, avec leur effectif). Le filtre retourne les entreprises qui possèdent l'activité, **même si elles en ont plusieurs**. Un filtre devenu sans objet est ignoré au lieu de vider la liste.
- Palette (Ctrl+K) : l'entreprise est trouvée par chacune de ses activités.
- **Aucune affectation n'est bloquée** par une activité non concordante (test B06).

### 2.6 Persistance, import, export

| Circuit | Résultat |
|---|---|
| Rechargement | activités et lots créés à la volée conservés (A08) |
| Sauvegarde complète → restauration (deux contextes) | conservées (A09) |
| Sauvegarde **V2.12.2.1** → V2.12.3 | migrée en schéma 16, `[]` partout, aucune activité inventée (A10) |
| Export métier → import | contrat inchangé : pas de ressources ; les **lots** voyagent, sans doublon, et les activités existantes restent intactes (A10) |
| Undo / Redo | création + nouveau lot = **un seul** point d'annulation ; modification annulable (A20) |
| Modèles de chantier | non concernés — **preuve par le code, non par les données** (la démo ne contient aucun modèle) : l'analyse syntaxique des ~50 fonctions de modèles montre qu'elles ne manipulent que des identifiants (`resourceId`, `additionalResourceIds`, `responsibleResourceId`) ; aucune ne lit ni ne copie `jobTitle`, `companyName` ou `activityLotIds` |

### 2.7 Données de démonstration

- **« Ouest Fluides & Énergie »** (nouvelle) : Électricité · Plomberie · Sanitaire.
- **« Le Gall Électricité »** : Électricité (cas mono-activité).
- « Menuiserie Armor » et « Coloris Peinture » : **inchangées** (cas sans activité).
- Nouveau lot **« Sanitaire »** au catalogue de démo (les états existants ne le reçoivent pas ; il est créable depuis le sélecteur).

### 2.8 Correspondance avec les 20 tests demandés (§8.1)

| # | Exigence | Test | Assertions |
|---|---|---|---|
| 1 | Création, 1 activité | A01 | 4 |
| 2 | Création, 3 activités | A02 | 2 |
| 3 | Création, sans activité | A03 | 3 |
| 4 | Modification | A04 | 2 |
| 5 | Ajout | A05 | 2 |
| 6 | Suppression | A06 | 4 |
| 7 | Doublons | A07 | 6 |
| 8 | Rechargement | A08 | 3 |
| 9 | Sauvegarde / restauration | A09 | 7 |
| 10 | Export / réimport | A10 | 10 |
| 11 | Recherche par chaque activité | A11 | 8 |
| 12 | Filtre par activité | A12 | 6 |
| 13 | Affichage compact « +N » | A13 | 9 |
| 14 | Thème clair | A14 | 6 |
| 15 | Thème sombre | A15 | 6 |
| 16 | Smartphone | A16 | 7 |
| 17 | Métier unique des personnes | A17 | 7 |
| 18 | Migration d'une ancienne entreprise | A18 | 9 |
| 19 | Migration idempotente | A19 | 15 |
| 20 | Undo / Redo | A20 | 6 |
| — | Garde-fous (clavier/ARIA, atomicité, cycle de vie du lot, formulaires d'affectation, non-blocage) | B01–B06 | 25 |
| — | Moteurs protégés (empreintes + cas de décalage réel) | P01–P02 | 9 |
| — | Zéro erreur console | Z01 | 1 |
| | **Total** | | **157 / 157** |

---

## 3. LOT B — Prototype « Bilan des retards »

Fichier séparé, construit **à partir de la V2.12.3** ; il n'est **pas** fusionné au produit. Bandeau permanent « **Prototype — données de démonstration injectées … non calculées par le moteur de planification** ».

### 3.1 Principe d'isolement

- Fixtures **isolées et déterministes** (`DELAY_FIXTURES`). Seuls les **dérivés** (jours ouvrés, direct/hérité, indicateurs, conséquences) sont calculés, à partir de ces fixtures, en **lisant** le calendrier du produit (`isNonWorkingDate` : week-ends + jours fériés).
- Le bloc n'appelle **aucune** fonction du moteur transactionnel (`planReflow`, `applyReflowPlan`, `planScheduleChanges`, `snapshot`, `undo`…) et n'écrit jamais dans `app` (test C03 : tâches, chantiers, ressources, lots, jalons, incidents strictement identiques après usage complet ; **0 `snapshot()`**, historique Annuler/Rétablir intact).
- Stockage **isolé** (`kanvix-proto-bilan-retards-8-3`) : ouvert dans le même navigateur, le prototype ne lit ni n'écrase l'état de la V2.12.3 (C04). Aucun changement de schéma produit.
- Résultat indépendant de l'horloge (C07).

### 3.2 Règles métier (aucune conclusion automatique)

Six notions toujours distinguées : **intervenant associé** · **retard direct** · **retard hérité** · **cause déclarée** · **responsabilité déclarée** (manuelle) · **attribution à confirmer**. Terminologie factuelle, aucun terme accusatoire.

- Un retard **hérité ne porte jamais de responsabilité** et n'a pas d'attribution à valider ; il porte la cause de son **origine**.
- **Retard net** = dérive de la fin du chantier (fin projetée vs fin initiale), **jamais une somme**. Les jours hérités ne sont **jamais ajoutés** aux jours générés.
- 7 invariants de cohérence (`validateDelayFixture`) : un héritier ne peut pas hériter de plus de jours que son parent, doit dépendre de son parent, démarrer après lui, sans responsabilité ; un direct n'a pas de parent et a une cause ; etc. Chaque violation est détectée (C02) et affichée dans un bandeau d'erreur.

### 3.3 Fixtures (Résidence Keravel — second œuvre, septembre 2026, aucun férié)

11 interventions, 10 retards. Chiffres **recalculés indépendamment** par la recette (compteur de jours ouvrés propre).

| Intervention | Prévu | Révisé / réel | Retard | Nature | Cause | Associés | Responsable déclaré | Validation |
|---|---|---|---|---|---|---|---|---|
| Pose des cloisons | 7→11 sept. | 7→15 | +2 j | Direct | Approvisionnement | Mathieu | — | Sans responsable désigné |
| Pose des menuiseries ext. | 7→11 | 7→16 | +3 j | Direct | Erreur | Menuiserie Armor, Thomas Martin | **Menuiserie Armor** | **Confirmée** |
| Reprise des réseaux d'eau | 8→11 | 8→15 | +2 j | Direct | Aléa technique | Ouest Fluides, Marc | Ouest Fluides | **À confirmer** |
| Peinture des façades | 21→23 | 21→24 | +1 j | Direct | Météo | Coloris | — | Sans responsable désigné |
| Pose de la cuisine | 21→24 | 28 sept.→1ᵉʳ oct. | +5 j | Direct | Décision du client | Thomas Martin | — | Sans responsable désigné |
| **Passage des gaines et câbles** | 14→18 | 16→22 | +2 j | **Hérité** (cloisons) | — | **Le Gall Électricité** | **— (sans objet)** | — |
| Calfeutrement | 14→15 | 17→18 | +3 j | Hérité (menuiseries) | — | Thomas Martin | — | — |
| Pose des sanitaires | 14→16 | 16→18 | +2 j | Hérité (réseaux) | — | Ouest Fluides | — | — |
| Peinture des cloisons | 21→25 | 23→29 | +2 j | Hérité (gaines ← cloisons) | — | Coloris | — | — |
| Réception des travaux | 28 sept. | 2 oct. | +4 j | Hérité (cuisine) | — | Eric | — | — |

**Indicateurs** : fin prévue lun. 28 sept. · fin projetée ven. 2 oct. · **retard net 4 j ouvrés** · 10 interventions en retard sur 11 · **5 directs** (13 j générés) · **5 hérités** (13 j subis, non recomptés) · **1 confirmée** · **1 à confirmer** · 3 directs sans responsable désigné.

> **13 j générés ≠ 4 j nets ≠ 26 j.** Le retard net (4 j) n'est ni la somme des retards directs (13 j) ni celle de tous les retards (26 j) : la cuisine dérive de 5 j mais la réception n'en subit que 4, car 1 jour de marge existait. C'est précisément la démonstration anti double comptage.

**Le cas obligatoire** : le plaquiste finit avec **2 j de retard** ; l'électricien démarre **2 j plus tard** ; il **subit un retard hérité**. À l'écran, dans le panneau et dans le CSV, **Le Gall Électricité est associé, jamais responsable** (test B05). Autres distinctions montrées : *associé ≠ responsable* (Thomas associé mais non désigné pour les menuiseries ; Marc idem pour les réseaux ; Mathieu associé sans responsable désigné) et une **météo non attribuée** à la réception (« une autre cause »).

### 3.4 Écran

- **Accès** : bouton « Bilan des retards » dans l'**en-tête de la fiche chantier** (présent sur tous les chantiers et aux deux niveaux Essentiel/Pilotage). **Aucune entrée ajoutée à la barre latérale** ; « Chantiers » reste allumé. Un chantier sans données affiche un état vide explicite.
- **8 indicateurs** (§5.5), note anti double comptage, aide « Comment lire ce bilan » (`<details>`).
- **Filtres** : nature (Tous/Directs/Hérités), cause, entreprise, personne, attribution (confirmées / à confirmer / sans responsable désigné), réinitialisation, compteur `aria-live`. Le filtre *Cause* suit l'**origine** (un héritier porte la cause de sa racine). L'attribution ne concerne que les retards **directs**.
- **Tableau de 11 colonnes** (intervention, lot, dates initiales, dates révisées/réelles, jours ouvrés, nature, cause, intervenants associés, responsabilité déclarée, validation, conséquences) ; **sous 1366 px** (largeur minimale mesurée du tableau : ≈ 1090 px) il devient une **liste de cartes** avec une seule structure HTML et des rôles ARIA de tableau.
- **Panneau latéral** (9 sections dans l'ordre demandé) : historique des dates, origine du décalage (avec « Ouvrir l'origine » / « origine première »), cause, commentaire, intervenants associés, responsabilité déclarée, déclaration (auteur/date), statut de validation, conséquences sur les tâches dépendantes (« décalée par ce retard » / « par une autre cause » / « non décalée »). Informations avancées dans un `<details>` replié, avec l'**enregistrement cible** au format du modèle proposé.
- **Export CSV** du bilan **affiché** (filtres respectés) : UTF-8 avec BOM, séparateur `;`, 16 colonnes, échappement des guillemets/retours à la ligne, neutralisation des formules de tableur.
- **PDF** : impression du navigateur (`window.print`, même mécanisme que le planning) ; à l'impression, barre latérale/filtres/navigation masqués et tableau conservé. PDF paysage généré en recette. Aucun moteur PDF ajouté.

### 3.5 Correspondance avec les tests demandés (§8.2)

| # | Exigence | Test | Assertions |
|---|---|---|---|
| 1 | Indicateurs | B01 | 4 |
| 2 | Exactitude des totaux (référence indépendante) | B02 | 9 |
| 3 | Séparation direct / hérité | B03 | 4 |
| 4 | Absence de double comptage | B04 | 5 |
| 5 | Cas plaquiste / électricien | B05 | 9 |
| 6 | Associé ≠ responsable | B06 | 5 |
| 7 | Attribution confirmée | B07 | 3 |
| 8 | Attribution à confirmer | B08 | 3 |
| 9 | Filtres | B09 | 16 |
| 10 | État vide | B10 | 5 |
| 11 | Panneau de détail | B11 | 13 |
| 12 | Export CSV | B12 | 10 |
| 13 | Thème clair (contrastes ≥ 4,5) | B13 | 13 |
| 14 | Thème sombre (contrastes ≥ 4,5) | B14 | 13 |
| 15 | Smartphone 390 px | B15 | 9 |
| 16 | Aucun débordement (8 largeurs : 360 → 1920) | B16 | 8 |
| 17 | Navigation clavier | B17 | 10 |
| 18 | Zéro erreur console | Z01 | 1 |
| — | Accès, navigation, intégrité des données, stockage, moteurs, impression, déterminisme, Lot A conservé | C01–C08 | 36 |
| | **Total** | | **175 / 175** |

### 3.6 Modèle de données cible proposé (documentation — **non implémenté** dans le moteur)

`DelayEvent` — le panneau « Informations avancées » affiche l'enregistrement réel de chaque retard à ce format.

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | identifiant de l'événement |
| `projectId` | string | chantier |
| `taskId` | string | intervention concernée |
| `baseline` | `{start, end}` | dates de référence |
| `revised` | `{start, end}` | dates révisées ou réelles |
| `delayBusinessDays` | number | retard en jours ouvrés (calculé, jamais saisi) |
| `type` | `direct` \| `inherited` | nature |
| `parentEventId` | string \| null | événement causal parent (null si direct) |
| `causeCode` | enum \| null | `weather`, `absence`, `supply`, `client`, `access`, `error`, `breakdown`, `technical`, `other` (null si hérité) |
| `comment` | string | commentaire |
| `associatedResourceIds` | string[] | intervenants **affectés** (dérivés de l'intervention) |
| `declaredResponsibleIds` | string[] | responsables **désignés à la main** (toujours vide si hérité) |
| `validation` | `none` \| `pending` \| `confirmed` | statut de validation |
| `author` | string | auteur de la déclaration |
| `createdAt` / `validatedAt` | date | dates de déclaration / validation |
| `validatedBy` | string \| null | qui a validé |
| `attachments` | string[] | pièces justificatives |

Règles à graver dans le moteur le jour venu : un héritier n'a pas de cause propre, pas de responsable, et `delayBusinessDays ≤` celui de son parent ; les jours hérités ne s'ajoutent jamais aux jours générés ; le retard net se lit sur la fin du chantier.

**Décisions à valider avec le prospect** : (1) le retard net se mesure-t-il sur la réception, sur un jalon final, ou sur le dernier lot ? (2) qui est « habilité » à désigner puis à valider une responsabilité ? (3) faut-il un retard « mixte » (hérité **et** aggravé sur place) ? Il est aujourd'hui rangé en « direct » ; le prototype n'en montre pas. (4) une cause « externe » (météo, client) doit-elle porter un statut de validation propre ?

---

## 4. Moteurs et fonctions protégés — comparaison programmatique

Méthode : analyse syntaxique (acorn) de chaque fichier, empreinte MD5 **par fonction**.

| Comparaison | Résultat |
|---|---|
| Base V2.12.2.1 : 898 fonctions | référence |
| V2.12.3 : 930 fonctions (898 + 32 ajoutées, 0 supprimée) | **33 / 33 fonctions protégées byte-identiques** |
| Prototype : 955 fonctions (930 + 25 ajoutées, 0 supprimée) | **35 / 35 byte-identiques** (dont `isNonWorkingDate`, `frenchPublicHolidays`) |

Protégées vérifiées : `planReflow`, `applyReflowPlan`, `planScheduleChanges`, `addBusinessDays`, `addWorkingDuration`, `nextWorkingTime`, `nonWorkingDaysInRange`, `snapshot`, `undo`, `redo`, `cloneHistoryState`, `restoreHistoryState`, `preserveCommunications`, `invalidateRedo`, `pushHistory`, `clearUndoRedo`, `setTaskStatus`, `scenarioOptions`, `showWhatIf`, `getProjectStructure`, `openStructureForm`, `toggleStructureArchive`, `renderOperationsList`, `operationCard`, `getOperationSummary`, `selectOperation`, `buildKanvixBackup`, `confirmKanvixRestore`, `exportKanvixData`, `applyImportPlan`, `validateKanvixBackup`, `load`, `save`. Un **cas de décalage réel** (fin +2 j d'une tâche ayant des successeurs) produit un `planReflow` et un `planScheduleChanges` **strictement identiques** entre la base et V2.12.3 (P02). Les fonctions de rendu Agenda R5.1 ne sont pas présentes dans la base et ne sont pas concernées.

**Différences, toutes justifiées :**

- **V2.12.3 vs base (15 fonctions modifiées)** : `migrateState` (**seule modification d'une fonction « protégée »** : nécessaire — appel de la migration 15→16 et exclusion du champ du bloc historique V4.6), `renderTeam`, `teamCard`, `projectTeamCard`, `resourceRow`, `openResource`, `openResourceForm`, `mainResourceSelect`, `complementaryResourcePicker`, `resourceFilterOptions`, `commands`, `lotReferences`, `canDeleteLot`, `renderLotsManager`, `deleteLotPrompt` (affichage, formulaire, cycle de vie du lot).
- **Prototype vs V2.12.3 (3 fonctions)** : `renderProject` (bouton d'accès), `renderPage` (route interne `delays`), `nav` (« Chantiers » reste allumé). `migrateState` du prototype = celui de la V2.12.3.

---

## 5. Résultats de recette et défauts trouvés en cours de route

| Recette | Résultat | Erreurs console |
|---|---|---|
| Lot A — `recette-v2.12.3/recette-lot-a-v2.12.3.mjs` | **157 / 157** | 0 |
| Lot B — `recette-v2.12.3/recette-lot-b-v2.12.3.mjs` | **175 / 175** | 0 |

**Les recettes ne sont pas complaisantes** (test de mutation) : 5 défauts volontairement injectés dans des copies, **tous détectés** — Lot A : suppression de la garde « pas d'activité de démo injectée » (3 échecs), perte de `stopPropagation` sur « +N » (2 échecs) ; Lot B : électricien rendu « responsable » (7 échecs), retard net = somme des jours (6 échecs), filtre « sans responsable » incluant les hérités (1 échec).

**Défauts réels trouvés par la recette puis corrigés** (transparence) :

1. **Fuite d'un champ périmé** (`activityPickerCollect`) : le texte en attente était lu même tiroir fermé ; il n'est lu que si le tiroir est ouvert.
2. **Contrastes insuffisants** : `--text-tertiary` fait 3,65:1 en clair, et les variantes `-ink` (avertissement/succès/danger) **ne sont pas redéfinies en sombre** (≈ 3:1). Des jetons locaux par thème ont été introduits pour le bilan ; `.act-empty` (Lot A) corrigé. Tous les contrastes mesurés sont désormais ≥ 4,5:1 dans les deux thèmes.
3. **Mise en page** du tableau (mots coupés, étiquette « Hérité » en double, dates coupées) ; point de bascule tableau → cartes relevé de 1180 à **1365 px** après mesure.

Les échecs restants de la première exécution étaient des défauts **de mes tests** (sélecteurs ambigus, bouton « Réinitialiser » homonyme caché, mauvais `td`, message vide inexistant) — corrigés dans les tests, sans toucher aux assertions métier.

---

## 6. Limites et risques résiduels

- **Export métier sans ressources** (contrat V2.12.2.1 conservé) : les activités d'entreprise ne voyagent que par la sauvegarde complète. Un export métier « avec ressources » exigerait un moteur d'import de ressources qui n'existe pas — **décision produit à prendre**.
- Le catalogue de démo passe de 9 à **10 lots** (« Sanitaire ») : les compteurs de la liste des lots changent dans un état neuf. Les états existants ne reçoivent ni ce lot ni aucune activité.
- Les lots créés depuis le sélecteur ont la couleur `slate` et aucun « métier indicatif » : à personnaliser dans Réglages.
- Un lot **inactif** reste utilisable comme activité (jamais réactivé en silence) ; il s'affiche « (inactif) » dans le formulaire.
- La recherche par activité couvre les **entreprises** ; les personnes restent recherchées par nom/métier libre. Le filtre d'activité **exclut** volontairement personnes et matériel.
- **Chromium uniquement** (Playwright). Ni Firefox, ni Safari/iOS, ni vrai lecteur d'écran, ni vrai téléphone : le comportement tactile est émulé, l'accessibilité est vérifiée par attributs ARIA et ordre de tabulation.
- Le PDF passe par l'impression du navigateur ; pagination non testée au-delà de la génération d'un PDF A4 paysage.
- Les fixtures ont des dates **absolues** (septembre 2026) ; les statuts (terminé / en cours / à venir) sont déclarés, pas déduits de l'horloge.
- Le prototype a **sa propre clé de stockage** : il ne voit pas les données réelles de l'utilisateur, par conception.
- Commit `9a3fffc` : y figure encore, par erreur, le fichier `RAPPORT-V2.12.2.1-CERTIFICATION.md` copié de l'autre branche avec la base ; il contient un identifiant de modèle, contraire à la règle du dépôt. Il est **supprimé** dans le commit suivant, mais reste dans l'historique de `9a3fffc` : une réécriture d'historique nécessiterait un push forcé, non fait sans votre accord.

---

## 7. Livrables

| Fichier | Rôle |
|---|---|
| `public/poc/kanvix-next-gen-v2.12.3.html` | **Version produit** (Lot A) |
| `public/poc/kanvix-next-gen-v2.12.3-bilan-retards-prototype.html` | **Prototype** (Lot B) |
| `public/poc/kanvix-next-gen-v2.12.2.1.html` | Base certifiée (copie fidèle, non modifiée) |
| `RAPPORT-V2.12.3.md` | Ce rapport |
| `recette-v2.12.3/recette-lot-a-v2.12.3.mjs` · `recette-lot-b-v2.12.3.mjs` | Recettes rejouables |
| `recette-v2.12.3/lot-a/` · `lot-b/` | Résultats JSON, sorties brutes, diff de fonctions, captures (clair, sombre, 390 px), PDF |
| `recette-v2.12.3/lot-a-source/` · `lot-b-source/` | Code inséré et scripts de génération : V2.12.3 et le prototype se **reconstruisent** depuis la base (chaque ancre doit exister exactement une fois, sinon échec) |

**Rejouer** (dépendances hors dépôt : `playwright-core`, `acorn`) :

```bash
python3 recette-v2.12.3/lot-a-source/build_v2123.py      # base -> V2.12.3
python3 recette-v2.12.3/lot-b-source/build_proto.py      # V2.12.3 -> prototype
KVX_PW=<chemin>/playwright-core KVX_ACORN=<chemin>/acorn node recette-v2.12.3/recette-lot-a-v2.12.3.mjs
KVX_PW=<chemin>/playwright-core KVX_ACORN=<chemin>/acorn node recette-v2.12.3/recette-lot-b-v2.12.3.mjs
```

Aucun sous-agent n'a été utilisé. Aucun merge, aucun déploiement, aucune modification de `main`.
