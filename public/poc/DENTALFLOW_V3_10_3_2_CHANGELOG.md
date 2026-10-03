# DentalFlow V3.10.3.2 — Changelog — FINAL PRE-IMPORT HOTFIX

**Base :** `dentalflow-next-poc-v3.10.3.1.html` (conservée intacte, jamais modifiée)
**Fichier livré :** `dentalflow-next-poc-v3.10.3.2.html`
**`schemaVersion` : 10, inchangé.**

Micro-correctif final avant dry-run d'import réel — aucun redesign, aucun
nouveau chantier fonctionnel. 6 points corrigés (A-F du mandat), diff
confiné à 11 hunks (voir rapport de test §7).

## 1. §3-4 (P0) — Invariant central de création de commande

**Défaut confirmé :** l'UI filtre correctement les prestations non
qualifiées via `serviceIsOrderable()` (V3.10.3.1), mais
`buildOrderFromInput()` — la seule fonction de construction canonique,
partagée Lab+Cabinet — acceptait encore un appel direct sur une
prestation résolue mais non commandable (`pricingMode=null`,
`pricingReviewRequired=true`, `active=false`) : elle construisait un
`priceSnapshot` STANDARD avec `pricingMode=null`, et le calcul du total
tombait dans la branche par défaut du ternaire PER_TOOTH
(`total=basePrice`) — un total était donc *calculé* pour une prestation
jamais vérifiée. L'ancien test FIX07 validait même ce comportement à
tort (voir §8 ci-dessous).

**Correctif :** `buildOrderFromInput()` retourne désormais `null`
immédiatement après résolution du service, **avant** tout effet de bord
métier (avant `ensureCabinetForName()`, qui peut créer un Cabinet ;
avant toute construction de `priceSnapshot`), dès que :

```
service existe ET serviceIsOrderable(service) === false
```

Si **aucun** service n'est résolu du tout (`service===null`), le
comportement historique est conservé à l'identique — ce refus ne vise
que « service trouvé mais non commandable », jamais l'ancien chemin
basé uniquement sur `type` (aucun scénario legacy cassé).

## 2. §5-6 — Appelants Lab et Cabinet

- `createOrder()` (Lab) : si `buildOrderFromInput()` retourne `null`,
  **aucun** effet de bord partiel — ni `state.orders`, ni
  `historyEvent`, ni `messages`, ni `documents`, ni `save()`, ni
  changement de vue/QuickView. Un `showToast()` explicite informe
  l'utilisateur (« Cette prestation doit être qualifiée avant de
  pouvoir être commandée. ») et la fonction retourne `null`.
- `createDentistOrderCore()` (Cabinet) : même garde — aucune mutation de
  `state.orders`, `cabinetPatients`, `ActivityEvent`/audit,
  `Conversation` ni notification. Retourne `null`.
- `createDentistOrder()` (wrapper) : si `createDentistOrderCore()`
  retourne `null`, le wrapper ne change **pas** de vue, ne réinitialise
  **pas** le brouillon (l'utilisateur peut corriger sa sélection) et
  n'affiche **aucun** faux message de succès.

## 3. §8 — FIX07 corrigé (et FIX30, conséquence nécessaire)

**FIX07** est mis à jour pour refléter l'invariant renforcé :
`buildOrderFromInput()` appelé avec une prestation résolue mais non
commandable retourne désormais `null` — aucun `priceSnapshot` ne doit
exister, puisqu'aucune commande ne doit exister. Ce n'est **pas** un
test affaibli : l'ancien critère validait précisément le défaut détecté
par l'audit.

**FIX30** (V3.10.3.1, §8 override) devait également être mis à jour :
son ancienne assertion (un `priceSnapshot` STANDARD existe, sans
override) supposait qu'une commande pouvait encore être construite pour
une prestation non qualifiée — ce n'est plus jamais le cas depuis le
correctif §3-4 ci-dessus. C'est une **conséquence directe et non
anticipée** de l'invariant renforcé (le mandat ne mentionnait que
FIX07) : sans cette mise à jour, FIX30 aurait levé une exception
(`Cannot read property 'priceSnapshot' of null`) puisque `order` vaut
désormais `null`. La garantie testée par FIX30 (« un override est
interdit sur une prestation non qualifiée ») reste intacte et devient
même une conséquence plus stricte du refus total de construction —
documentée ici en toute transparence plutôt que silencieusement
corrigée.

## 4. §9 (P1) — `pricingModeLabel()` défensif

**Défaut confirmé :** un ancien `Service` persisté avec
`pricingReviewRequired===undefined` ET `pricingMode===null` (jamais
migré, antérieur à V3.10.3.1) affichait encore « Forfait » par la
branche par défaut du ternaire précédent — alors que
`serviceIsOrderable()` l'excluait déjà correctement des sélecteurs.
Contradiction d'affichage.

**Correctif :** `pricingModeLabel(s)` n'affiche « Forfait »/« Par dent »
que pour un `pricingMode` **explicitement** qualifié (`FIXED`/
`PER_TOOTH`) ET `pricingReviewRequired!==true` ; tout autre cas
(y compris l'ancien `undefined`/`null` non migré) retombe sur
« À qualifier », jamais un défaut optimiste. La page Prestations
(badge orange) a été ajustée pour utiliser ce même résultat comme seule
source de vérité, afin de rester cohérente pour ce nouveau cas
défensif.

## 5. §10-12 — Réimport Personnel non destructif

**Défaut confirmé :** dans l'upsert Utilisateurs, `email:r.email||''`
et `assignedStageId:effStage||null` pouvaient **effacer** un email ou
un poste existant si la cellule/mapping source était vide sur un
réimport — contraire au principe « cellule vide = ne jamais effacer une
donnée existante », déjà appliqué partout ailleurs dans le moteur
d'import.

**Correctif :**
- **Email** — nouvel utilisateur : vide → `''`. Utilisateur existant :
  email source non vide → mis à jour ; vide/absent → `existing.email`
  préservé.
- **Poste de production** — nouvel utilisateur : absent/vide → `null`.
  Utilisateur existant : `assignedstageid` explicite non vide OU mapping
  POLE explicite vers un stage → mis à jour ; aucune valeur fournie →
  `existing.assignedStageId` préservé. Un mapping POLE réglé sur
  « Aucun » produit la même chaîne vide qu'une absence totale de
  colonne — **aucun des deux n'efface** un poste déjà connu (il
  n'existe pas encore de sémantique de CLEAR explicite dans ce lot,
  comme demandé).
- `roleId`/`permissions`/`scope`/`capacity` : logique V3.10.3.1
  **inchangée**.

## 6. §14 — Ordre conseillé de migration réelle

L'assistant affichait « Inventaire laboratoire » après « Commandes »,
et incluait Articles/Stocks dans le chemin principal — plus adapté à la
migration réelle du laboratoire depuis V3.10.3.1 (où Inventaire
laboratoire, upsert avec cellules vides non destructives, est devenu le
type recommandé face à Articles, création uniquement).

**Correctif :** l'ordre conseillé affiché devient :

```
Cabinets → Dentistes → Utilisateurs → Prestations → Fournisseurs →
Inventaire laboratoire → Tarifs fournisseurs → Commandes
```

Articles et Stocks restent **entièrement disponibles** dans l'assistant
(boutons cliquables, aucun blocage technique d'un autre ordre), mais
apparaissent désormais sous un second groupe explicite « Types
historiques/granulaires (autres cas d'usage) » plutôt que dans le
chemin principal — recommandation UX uniquement, comme demandé.

## 7. §16 — Comptage honnête des blocs `<script>`

Le rapport V3.10.3.1 annonçait « 4 blocs `<script>` », un chiffre
**inexact** — conséquence d'un script d'audit dont l'expression
régulière (`<script>(.*?)</script>`) ne reconnaissait que les balises
`<script>` SANS attribut, manquant donc silencieusement le plus gros
bloc du fichier (`<script id="dentalflow-v34-implementation">`,
893 743 caractères — la quasi-totalité du moteur d'import et de la
suite de tests). Ce bloc a bien été exécuté par le navigateur à chaque
campagne de test précédente (les résultats de tests eux-mêmes en
attestent), mais n'avait jamais été individuellement passé par
`node --check` à cause de cette régression d'outillage.

**Audit corrigé pour ce lot** (voir méthode et résultat exact au
rapport de test §6) : **5 balises `<script>` réelles** (une 6e
occurrence détectée par un grep naïf est une chaîne de caractères
littérale à l'intérieur du code vendor jsPDB, jamais une vraie balise
HTML — vérifiée et écartée), dont 3 bibliothèques vendor embarquées
(QR Code Generator, @zxing/library, jsPDF) et 2 blocs applicatifs
DentalFlow (script de base + IIFE d'implémentation). **Les 5 blocs**
sont désormais individuellement extraits et vérifiés par
`node --check`, sans exception.

## 8. Non-régressions — conservées intégralement

Aucun changement à : navigation, LAB/STAFF/CABINET switching, caméra,
production, QR, patient/anonymisation, `StockMovement`, `StockLot`
opérationnel, `PurchaseProposal`/`PurchaseOrder`, moteur Charge,
rapports, facturation, CSS/design, responsive, thèmes, schéma de
persistance. Tous les correctifs V3.10.3.1 sont conservés intégralement
: `pricingReviewRequired`, `serviceIsOrderable()`, fournisseurs
« vide ≠ zéro », `roleId`/permissions, `BLOCKED` avant `NO_ACTION`,
import Inventaire laboratoire, `sourceLotNumber`/`sourceLotDateRaw`,
`servicePriceOverrides` (portée non étendue, seule la garde déjà
existante — désormais renforcée en amont par §3-4 — s'applique),
`schemaVersion` 10.

## 9. Diff audit (§21 du mandat)

11 hunks au total, exclusivement dans les zones autorisées :
`buildOrderFromInput`, `createOrder`, `createDentistOrderCore`/wrapper,
`pricingModeLabel` (+ un ajustement d'1 ligne dans
`servicesTableInnerHTML`, conséquence directe et nécessaire du même
correctif défensif), `applyImportRows` (utilisateurs), texte/DOM de
recommandation du wizard, FIX07, FIX30 (conséquence documentée, voir
§3), FIX31-FIX40, tests. **Zéro** hunk CSS, navigation, caméra, patient,
moteur production, moteur achats, Charge, `StockLot`, schéma, ou tout
nouveau module. Détail complet au rapport de test §7.
