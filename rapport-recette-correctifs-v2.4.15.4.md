# Kanvix V2.4.15.4 — 5 correctifs UX ciblés

Source de vérité : `kanvix-next-gen-v2.4.15.3.html`
Version livrée : `kanvix-next-gen-v2.4.15.4.html`

Retour utilisateur (5 points) :
1. Planning : la 1ʳᵉ colonne doit être le jour/mois en cours (Semaine/Mois/Année) ; en Jour, ne pas montrer le passé mais l'heure en cours.
2. Kanban : le drag&drop vers une colonne courte échoue hors de sa zone visible ; ajouter un pop-up du nouvel état au dépôt.
3. Chantiers : mettre « Modèle d'entreprise » dans +Nouveau chantier.
4. Mode Chantier : le bouton « Chantier » en bas ne fonctionne pas.
5. Fiche tâche : « Signaler une reprise » reste visible même après une reprise déjà signalée.

---

## 1. Planning — la période courante démarre la vue

**Cause réelle** : `scrollPlanningToToday()` calait la vue Jour sur le début de journée (8h) quel que soit l'heure courante, et centrait « aujourd'hui » à mi-cellule (`todayIndex - 0.5`) en Semaine/Mois/Année au lieu d'en faire la première colonne. De plus, `setPeriod()` (changement d'onglet Jour/Semaine/Mois/Année) ne posait pas `planningNeedsCenter = true` : changer d'échelle ne redéclenchait donc aucun recentrage, laissant l'ancien défilement (calage calendaire Lundi/S1/Janvier) en place.

**Correctif** — `scrollPlanningToToday()` :
```js
wrap.scrollLeft = Math.max(0, cell * s.todayIndex);
```
(remplace le `? 0 :` figé sur 8h en vue Jour et le `- 0.5` de centrage en Semaine/Mois/Année) — et `setPeriod()` pose désormais `app.ui.planningNeedsCenter = true` avant de re-rendre.

**Vérifié** : en Jour à 9h15, le planning ouvre directement sur le créneau 9h (aucune heure passée affichée) ; en Semaine/Mois (fenêtre réduite à 1000px pour provoquer un réel débordement horizontal), la période courante démarre bien la vue ; cliquer sur l'onglet « Mois » depuis l'onglet « Jour » réaligne bien l'affichage (clic réel, pas un appel direct). Aucune modification du calage calendaire (Lundi de semaine, 1er du mois, janvier de l'année) ni de `getCurrentWeekRange`/`scale()` — uniquement la position de défilement initiale.

## 2. Kanban — zone de dépôt élargie + pop-up de statut

**Cause réelle** : `.kanban { align-items: start }` laissait chaque colonne se dimensionner à sa PROPRE hauteur de contenu. Une colonne avec peu de tâches (ex. « Terminé ») restait courte, alors que `ondragover`/`ondrop` sont posés sur `.kanban-col` (la section entière). Relâcher une tâche en bas d'une colonne longue tombait donc, à cette hauteur d'écran, hors de la zone DOM de la colonne courte — la souris atterrissait sur autre chose, et le dépôt était silencieusement ignoré.

**Correctif** :
```css
.kanban { align-items: stretch; }
```
Les 3 colonnes s'étirent désormais à la hauteur de la plus longue — la zone de dépôt d'une colonne courte couvre toute la hauteur du plateau, pas seulement ses propres cartes. `kanbanDrop`/`dropTask` (moteur métier) restent byte-identiques : correctif purement CSS.

**Pop-up du nouvel état** : `setTaskStatus()` affichait déjà un `actionToast()` avec Annuler réel (undo fonctionnel), mais avec un message générique (« Tâche mise à jour ») quel que soit l'appelant. Le paramètre `origin` existant (déjà valorisé `"kanban"` par `kanbanDrop`) est réutilisé pour personnaliser ce seul cas :
```js
actionToast(origin === "kanban" ? `Tâche déplacée · ${STATUS[status] || status}` : "Tâche mise à jour");
```
Les autres origines (édition, terrain, réconciliation…) gardent le message générique inchangé — vérifié explicitement.

**Vérifié** : mesure géométrique réelle (`elementFromPoint`) prouvant que le point où tombe une carte basse de « À faire » est désormais À L'INTÉRIEUR de la colonne « Terminé » (hors correctif, il en sortait) ; glisser-déposer réel (DragEvent + DataTransfer) vers « En cours » affiche « Tâche déplacée · En cours · Annuler » ; un changement de statut par un autre chemin garde « Tâche mise à jour · Annuler ».

## 3. Chantiers — « Modèle d'entreprise » dans +Nouveau chantier

**Constat** : les modèles d'entreprise (`app.companyTemplates`, créés depuis Réglages) étaient déjà techniquement inclus dans « Utiliser un modèle » (`allProjectTemplates()` les fusionne avec les 3 modèles génériques), mais noyés parmi eux sans point d'entrée dédié — d'où la demande explicite d'un accès direct.

**Correctif** — 4ᵉ choix ajouté à l'écran initial du wizard (« Partir de zéro / Utiliser un modèle / **Modèle d'entreprise** / Reprendre un chantier en cours »), routé vers la MÊME étape `template-select` avec une liste filtrée à `app.companyTemplates` (`wizardPickMode('company-template')`). Aucune duplication : même moteur (`allProjectTemplates`, `wizardPickTemplate`, `createTemplateFromWizard`), seule la liste affichée change. Si aucun modèle d'entreprise n'existe encore, un état vide explicite propose de basculer directement sur `openCompanyTemplateForm()` (déjà existant, inchangé) sans quitter le drawer.

**Vérifié** : 4 choix affichés ; liste vide + raccourci de création quand `app.companyTemplates` est vide ; le modèle créé apparaît aussitôt dans cette liste dédiée ET continue d'apparaître dans « Utiliser un modèle » (aucune régression du chemin générique).

## 4. Mode Chantier — le bouton « Chantier » de la barre du bas

**Cause réelle (diagnostiquée par test réel, pas supposée)** : `setFieldTab()` remettait `app.ui.fieldView` à `"site"` (sortie garantie de la sous-vue Planning, comme documenté dans le code), mais ne réinitialisait JAMAIS `app.ui.conversation` (ni `fieldComposing`/`fieldNoAccessId`). Scénario reproduit : ouvrir une conversation en Mode Chantier → taper « Chantier » (fonctionne, affiche bien le chantier) → taper « Messages » → l'ancienne conversation se rouvre AUTOMATIQUEMENT au lieu de la liste, car `app.ui.conversation` était resté renseigné. La barre du bas donnait ainsi l'impression de ne plus répondre, alors que le blocage réel était côté Messages, provoqué par une navigation Chantier/Messages incomplète.

**Correctif** — `setFieldTab()` applique désormais la même garantie de sortie côté Messages :
```js
app.ui.conversation = null;
app.ui.fieldComposing = false;
app.ui.fieldNoAccessId = null;
```

**Vérifié** (clics réels, viewport mobile 390×844) : conversation ouverte → tap « Chantier » → le chantier s'affiche ET la conversation est bien refermée en mémoire → tap « Messages » → la LISTE des conversations s'affiche, plus jamais bloquée sur l'ancienne.

## 5. Fiche tâche — masquage de « Signaler une reprise » déjà signalée

**Cause réelle** : les 3 points d'entrée du bouton (fiche Bureau `openTask`, liste « À contrôler » du Mode Chantier `fieldControlItems`, pop-up tâche du Mode Chantier `openFieldTaskModal`) ne testaient que `!t.reworkOfTaskId` — c'est-à-dire « cette tâche n'EST PAS elle-même une reprise ». Aucun des trois ne vérifiait la relation inverse : « une reprise existe-t-elle DÉJÀ pour cette tâche ? ». Une tâche originale terminée continuait donc de proposer indéfiniment « Signaler une reprise », même après qu'une reprise avait été créée pour elle (exactement le cas de la capture jointe).

**Correctif** — nouvel helper, pure lecture, aucune donnée nouvelle :
```js
function hasReworkSignaled(id) {
  return app.tasks.some((t) => t.reworkOfTaskId === id);
}
```
appliqué en garde supplémentaire aux 3 points d'entrée. Dans la fiche Bureau, quand le bouton disparaît, le reste de la zone d'action (menu ···) reste disponible — seul le bouton de reprise est retiré, comme demandé (« il faudrait plutôt le supprimer »).

**Vérifié** : avant toute reprise, le bouton est proposé (référence) ; dès qu'une reprise est créée pour la tâche, il disparaît dans les 3 emplacements (fiche Bureau, « À contrôler », pop-up Mode Chantier).

## 6. Tests

Nouvelle suite `recette-correctifs-v2.4.15.4.mjs` : **42/42 tests passent** — anchoring Planning (Jour/Semaine/Mois/Année + changement d'onglet réel), géométrie et fonctionnel du drag&drop Kanban + pop-up de statut, wizard « Modèle d'entreprise » (liste filtrée, état vide, non-régression du générique), navigation Mode Chantier (conversation refermée par la barre du bas), masquage du bouton de reprise aux 3 emplacements, gel visuel de la page Chantiers, 0 erreur console, byte-identité de 36 moteurs non concernés par ce round.

**Note technique** : l'extraction par accolades (`extractFn`) utilisée pour la byte-identité, héritée telle quelle des suites précédentes, se laissait piéger par un paramètre par défaut objet/tableau dans une signature (ex. `setTaskStatus(id, status, origin = "task", opts = {})`) : la première `{` rencontrée était celle du défaut `{}`, tronquant l'extraction avant même le vrai corps de la fonction — un faux « identique » silencieux resté invisible tant qu'aucune fonction de ce type n'avait besoin d'être suivie comme modifiée. Corrigé dans la nouvelle suite (saut de la liste de paramètres, aware des parenthèses, avant de chercher l'accolade du corps) ; les suites `.1/.2/.3` sont laissées telles quelles (archives historiques).

Rejeu complet des **28 suites historiques**, chacune repointée sur `kanvix-next-gen-v2.4.15.4.html` (au lieu de son fichier d'origine figé) avec ses captures redirigées vers un dossier de travail — aucun fichier suivi par git n'a donc été touché par ce rejeu :

- **24 suites entièrement vertes**, dont `recette-correctifs-v2.4.15.1.mjs` (111/111), `.2.mjs` (16/16), `.3.mjs` (21/21) et `recette-harmonisation-ui-v2.4.15.mjs` (105/105).
- **2 échecs déjà documentés, sans lien avec ce round** (réapparaissent à l'identique) : `recette-accueil-v2.4.4.1.mjs` (legacy pré-V2.4.5, 105/18) et `recette-kanban-badges-v2.4.11.2.mjs` (legacy pré-V2.4.11.3, libellés de badges devenus obsolètes).
- **2 divergences supplémentaires identifiées lors de ce rejeu, vérifiées comme PRÉ-EXISTANTES** (reproduites à l'identique en repointant les mêmes suites sur `kanvix-next-gen-v2.4.15.3.html`, donc antérieures à ce round — issues de la refonte du cockpit en V2.4.15) : `recette-correctif-ui-v2.4.14.1.mjs` (73/3, écarts de taille de vignette/hauteur de cockpit) et `recette-densite-v2.4.14.mjs` (interrompue sur un sélecteur de cockpit qui n'existe plus).
- **1 divergence NOUVELLE, intentionnelle et attendue** (absente contre V2.4.15.3, apparue uniquement contre V2.4.15.4) : `recette-chantiers-v2.4.10.2.mjs` (47/1) — l'assertion « + Chantier ouvre un sidewindow avec **3** possibilités » est mécaniquement obsolète depuis l'ajout demandé du 4ᵉ choix « Modèle d'entreprise » (§3). Suite legacy laissée telle quelle (archive historique) : la nouvelle suite active `recette-correctifs-v2.4.15.4.mjs` vérifie explicitement les 4 choix et la non-régression du chemin générique.

## 7. Console

0 erreur JavaScript applicative.

## 8. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"`, `SCHEMA_VERSION = 8` — inchangés.
