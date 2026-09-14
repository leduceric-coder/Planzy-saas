# Kanvix V2.4.15.5 — Planning : échelles ancrées sur « maintenant » + nom de chantier

Source de vérité : `kanvix-next-gen-v2.4.15.4.html`
Version livrée : `kanvix-next-gen-v2.4.15.5.html`

Retour utilisateur (page Planning) :
1. Vue **Jour** : le tableau ne démarre pas à l'heure en cours (montre le passé à l'ouverture).
2. Vue **Mois** : ne démarre pas sur la période en cours ; ajouter le **numéro de semaine (base annuelle)**.
3. Vue **Année** : le tableau doit **démarrer par le mois en cours**.
4. **Décalage / rognage du nom de chantier** (« nce Keravel » au lieu de « Résidence Keravel »).
5. Mettre le **nom des chantiers en plus gros** pour les différencier des tâches.

---

## 1. Cause réelle (diagnostic)

Le correctif V2.4.15.4 recentrait le Planning **par défilement** (`scrollLeft = cellule × index du jour`). Or, en vues **Mois** et **Année**, tout le tableau **tient à l'écran** : il n'y a rien à faire défiler, donc la période courante ne pouvait pas devenir la 1ʳᵉ colonne (elle restait au milieu — septembre au centre en vue Année). Le défilement ne pouvait pas résoudre la demande.

La vraie cause : les **plages elles-mêmes** étaient **calées sur le calendrier** (08h fixe, lundi de la semaine, 1er du mois, janvier de l'année), ce qui reléguait systématiquement le présent au milieu ou hors champ.

Le rognage du nom de chantier venait d'un autre défaut : le bandeau `.g-project` était en pleine largeur avec `position:sticky; left:0` — **inefficace sur un élément pleine largeur** (il n'y a pas de dépassement à retenir). Le nom, aligné à gauche, défilait donc hors champ dès qu'on faisait défiler le Gantt (visible en vue Année).

## 2. Correctifs

### a) `scale()` — toutes les échelles démarrent sur la période EN COURS

Les 4 plages sont désormais des **fenêtres glissantes** dont la 1ʳᵉ colonne = maintenant, tournées vers l'avant :

| Vue | Avant | Après |
|---|---|---|
| **Jour** | 08h–18h fixe | démarre à l'**heure pleine en cours** (aucun créneau passé) ; hors horaires (avant 08h / après 18h) → repli sur la journée entière (jamais vide) |
| **Semaine** | lundi → dimanche | **7 jours à partir d'aujourd'hui** (1ʳᵉ colonne = jour courant) |
| **Mois** | S1…S5 du mois calendaire | **6 semaines à partir de la semaine en cours** ; libellé = **n° de semaine ISO annuel** (`S38 · 14`) au lieu d'un rang mensuel (`S1`) |
| **Année** | janv. → déc. | **12 mois glissants à partir du mois en cours** (`sept. 2026 → août 2027`) |

Le marqueur `AUJOURD'HUI` se pose donc sur la **1ʳᵉ colonne** (`todayIndex = 0`) dans chaque vue « aujourd'hui ». `pos()`, le glisser-déposer (`dropTask`) et les filtres sont **inchangés** (byte-identiques) : ils dérivent tous de `start`/`dates`/`end` fournis par `scale()`. Le libellé de période de la vue Année reflète la fenêtre glissante (« sept. 2026 – août 2027 »).

### b) Nom de chantier — épinglé (plus jamais rogné) + plus gros

Le nom (`.g-project button`) et l'état (`.project-health`) sont désormais **épinglés séparément** — nom à gauche (`sticky; left`), état au vrai bord droit (`sticky; right`) — et le bandeau épouse la **largeur réelle des lignes** (`min-width: calc(var(--task-col) + var(--cols) × 94px)`) pour que l'aplat couvre toute la rangée et que l'état reste collé à droite, même en défilement. Le nom passe de **13px/700 à 15px/800** : nettement plus gros que les libellés de tâche (13px), pour les différencier au premier coup d'œil.

## 3. Vérification (Playwright, temps réel figé à 10:15 le 14/09/2026)

- **Jour** : 1ʳᵉ colonne `10h`, marqueur AUJOURD'HUI dessus, fenêtre à `…T10:00` (08h/09h masqués). Après 18h : repli sur la journée entière 08h–18h.
- **Mois** : 1ʳᵉ colonne = semaine en cours, libellé `S38 · 14` (semaine ISO 38), format `S<n°> · <quantième>` sur toutes les colonnes.
- **Année** : 1ʳᵉ colonne `sept.`, dernière `août`, nav « sept. 2026 – août 2027 », aucun défilement résiduel.
- **Semaine** : 1ʳᵉ colonne = lundi 14 (aujourd'hui).
- **Nom** : en vue Année **défilée à fond**, le nom reste épinglé à gauche (écart 15px, entièrement lisible), l'état reste collé à droite (15px du bord). Nom = 15px/800 > tâche 13px.
- **Navigation** : `←`/`→` avancent/reculent la fenêtre pour chaque échelle ; `←` revient exactement au départ ; « Aujourd'hui » recadre la période courante en 1ʳᵉ colonne partout.
- **Non-régression** : Kanban du Planning (3 colonnes, cartes), glisser-déposer Gantt — inchangés et fonctionnels.

## 4. Tests

Nouvelle suite `recette-correctifs-v2.4.15.5.mjs` : **30/30**. Byte-identité de 36 moteurs métier / rendu (dont `gantt`, `kanbanCard`, `kanbanBoard`, `pos`, `dropTask`, `getCurrentWeekRange` — tous inchangés) ; seuls `scale()` et `renderPlanning()` ont changé côté JS (le reste est CSS).

Rejeu complet des suites historiques (repointées sur ce fichier, captures redirigées vers un dossier de travail — aucun fichier suivi par git touché). Point d'attention de ce round : les vues **Semaine** et **Mois** changeant d'ancrage (jour/semaine en cours au lieu de lundi/S1 calendaire), certaines assertions de suites Planning **legacy** qui encodaient l'ancien calage calendaire deviennent mécaniquement obsolètes — elles sont laissées telles quelles (archives) et couvertes par la nouvelle suite active `recette-correctifs-v2.4.15.5.mjs`. Les échecs legacy déjà documentés aux rounds précédents (Accueil pré-V2.4.5, Kanban pré-V2.4.11.3, densité/cockpit pré-V2.4.15) réapparaissent à l'identique, sans lien avec ce round.

## 5. Console

0 erreur JavaScript applicative.

## 6. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"`, `SCHEMA_VERSION = 8` — inchangés.
