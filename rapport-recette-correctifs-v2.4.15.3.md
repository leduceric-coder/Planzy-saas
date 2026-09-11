# Kanvix V2.4.15.3 — Correction du menu ••• de la carte chantier

Source de vérité : `kanvix-next-gen-v2.4.15.2.html`
Version livrée : `kanvix-next-gen-v2.4.15.3.html`

Retour utilisateur : « rendre le menu de la vignette (les 3 petits points) fonctionnel : Modifier, supprimer, archiver. »

---

## 1. Cause réelle du bug

Le menu ••• de la carte chantier (page **Chantiers**) semblait « ne rien faire » : le clic ouvrait bien techniquement le popover, mais celui-ci se dessinait **détaché du bouton**, ailleurs sur la page (dans le pire cas mesuré, à plus de 750px de distance) — invisible ou hors du champ de vision immédiat de l'utilisateur.

**Origine** : en V2.4.15.1, la règle
```css
.site-head-actions .site-menu { position: static; top: auto; right: auto; }
```
avait été ajoutée pour annuler un léger décalage hérité de l'ancien contexte (vignette en overlay). Mais `position: static` retire à `.more-menu` son rôle d'**ancre de positionnement** pour son enfant `.more-pop` (`position: absolute`) — celui-ci se positionnait alors par rapport au premier ancêtre positionné trouvé plus haut dans la page, sans rapport avec le bouton cliqué.

Un second problème, moins visible, s'est révélé pendant la correction : `.site-card` portait `overflow: hidden` (hérité de l'ancienne illustration 16:9) — dès qu'un chantier proposait 3 actions (Modifier/Clôturer/Supprimer, sur un chantier sans tâche), le popover, plus haut, dépassait légèrement le bas de la carte et se faisait couper.

## 2. Correction

```css
/* Ancrage restauré : .more-menu retrouve position:relative (hérité),
   seul le décalage top/right est neutralisé. */
.site-head-actions .site-menu {
  top: auto;
  right: auto;
}
/* overflow:hidden n'avait plus d'utilité (la vignette se rogne elle-même
   via .site-thumb) et coupait le popover. Remplacé par min-width:0
   explicite, qui rendait le même service pour le rétrécissement de la
   carte dans sa colonne de grille sur petit écran — sans recadrer le
   contenu qui dépasse verticalement. */
.site-card {
  min-width: 0;
  /* (overflow: hidden retiré) */
}
```

## 3. Vérification

- **Ancrage** : le popover démarre désormais toujours juste sous le bouton ••• et partage son bord droit, pour les 4 états de cycle de vie (actif, actif sans tâche, clôturé, archivé) — vérifié par mesure de proximité réelle (écart ≤ 12px verticalement, ≤ 4px horizontalement), plus par mesure `elementFromPoint` sur chaque bouton du menu pour prouver qu'il reçoit bien le clic.
- **Aucun recadrage** : le cas à 3 actions (Modifier/Clôturer/Supprimer) — le plus haut — est maintenant entièrement visible et cliquable, y compris le dernier item.
- **Actions par état** (moteur `projectCardMenu()` inchangé, vérifié byte-identique) :
  - Chantier **actif** : Modifier, Clôturer (+ Supprimer si aucune tâche).
  - Chantier **clôturé** : Réouvrir, Archiver.
  - Chantier **archivé** : Restaurer, Supprimer définitivement.
  
  « Archiver » apparaît donc bien dans ce menu — au moment du cycle de vie où il s'applique (un chantier se clôture avant de s'archiver ; ce n'était pas une régression, c'est le fonctionnement déjà en place, désormais correctement visible).
- **Clics réels** : « Modifier » ouvre effectivement l'édition, « Clôturer » ouvre effectivement la confirmation (vérifié par clic Playwright réel, pas un appel direct au moteur).
- **Régression mobile détectée puis corrigée** : `overflow:hidden` masquait un effet de bord (min-width automatique) qui, une fois retiré, laissait la carte déborder de 21px sur 390px de large. Corrigé avec `min-width:0` explicite — revérifié : 0 débordement.
- **Dark mode** : popover sans aplat blanc forcé.
- **Gel** : nombre de cartes, hauteurs (171px) et tailles de vignette (112×84) strictement identiques à V2.4.15.2.

## 4. Tests

Nouvelle suite `recette-correctifs-v2.4.15.3.mjs` : **21/21 tests passent** — ancrage et clic réel pour les 4 états de cycle de vie, cas à 3 actions sans recadrage, clics Modifier/Clôturer aboutissant réellement, dark mode, mobile 390px sans débordement, gel de la carte, console, byte-identité de 33 fonctions (dont `projectCardMenu`, `siteCard`, `toggleDrawerMenu` — toutes inchangées, correctif purement CSS).

Rejeu complet : `recette-correctifs-v2.4.15.1.mjs` (**111/111**), `recette-correctifs-v2.4.15.2.mjs` (**16/16**), `recette-harmonisation-ui-v2.4.15.mjs` (**105/105**), plus 21 autres suites actives — toutes vertes, seuls les 2 échecs déjà documentés (legacy Accueil, legacy Kanban) réapparaissent à l'identique.

## 5. Console

0 erreur JavaScript applicative.

## 6. STORE / SCHÉMA

`STORE = "kanvix-product-8-3"`, `SCHEMA_VERSION = 8` — inchangés.
