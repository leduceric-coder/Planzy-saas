# 🔥 Feux France — détections satellites de chaleur

Application web cartographique (route `/feux`) visualisant en **quasi-temps réel**
les détections satellites de feux actifs et anomalies thermiques en **France
métropolitaine et en Corse**, à partir de l'API officielle **NASA FIRMS**.

Elle est intégrée au monorepo Planzy mais **fonctionne de façon autonome** : la
page `/feux` et ses routes API sont **publiques** (aucune authentification, aucune
dépendance à Supabase) et tournent même sans base de données.

---

## ⚠️ Limites des détections satellites (à lire absolument)

Les points affichés sont des **détections satellitaires de chaleur**. Ils **ne
constituent pas une confirmation officielle d'incendie** et peuvent inclure des
sources de chaleur industrielles ou naturelles (torchères, feux agricoles,
surfaces très chaudes…).

Vocabulaire employé dans l'app : « détection satellite récente », « feu actif ou
anomalie thermique potentielle », « données en quasi-temps réel ».

> **En cas d'urgence ou de départ de feu observé, appelez le 18 ou le 112.**
> **Ne vous rendez pas sur les lieux signalés.**

Facteurs de latence / d'imprécision connus : délai de passage et de traitement
des satellites (NRT ≈ 30 min à 3 h), couverture nuageuse, résolution du pixel
(375 m VIIRS, 1 km MODIS), faux positifs thermiques.

---

## Fonctionnalités

- Carte interactive **MapLibre GL JS** (fond **OpenStreetMap** par défaut, fond
  **satellite Esri** activable), zoom / déplacement fluides.
- Marqueurs **colorés par ancienneté** (< 3 h rouge, 3–12 h orange, 12–24 h
  jaune-orangé, > 24 h gris), taille indicative selon la FRP (jamais la surface
  réelle), **pulsation légère** des détections récentes (désactivée si
  `prefers-reduced-motion`).
- **Clustering** natif + **carte de chaleur** + mode marqueurs.
- **Fiche de détection** (bottom sheet mobile / carte flottante desktop) : date &
  heure locales **Europe/Paris**, ancienneté, lat/lon, satellite/capteur,
  confiance, FRP, température de brillance, jour/nuit, liens « Google Maps » et
  « Copier les coordonnées ».
- **Filtres** repliables : période (3 h → 7 j), confiance (toutes / nominale+ /
  élevée), capteur (SNPP / NOAA-20 / NOAA-21 / MODIS), affichage, limites
  départementales.
- **Recherche géographique** via la **Base Adresse Nationale** (Géoplateforme,
  sans clé) : commune, code postal, département, adresse.
- **Géolocalisation** navigateur (avec consentement), **thème clair/sombre**.
- **Actualisation manuelle** + **auto toutes les 10 min** (sans rechargement),
  **cache serveur** 8 min, **repli sur le cache** en cas d'échec API.
- **Mode démonstration** automatique sans clé (données fictives clairement
  identifiées).
- Responsive (mobile / tablette / desktop), accessibilité (clavier, ARIA,
  contrastes, alternative non colorimétrique via libellés).

---

## Sources de données & attribution

| Source | Usage | Attribution obligatoire |
| --- | --- | --- |
| **NASA FIRMS** (VIIRS S-NPP / NOAA-20 / NOAA-21 NRT, MODIS NRT) | Détections thermiques | « Données : NASA FIRMS » |
| **OpenStreetMap** | Fond de carte par défaut | « © OpenStreetMap contributors » (affiché) |
| **Esri World Imagery** | Fond satellite optionnel | « Imagerie © Esri, Maxar, Earthstar Geographics » (affiché) |
| **Base Adresse Nationale** (api-adresse.data.gouv.fr) | Géocodage | « © BAN / IGN — data.gouv.fr » |
| **france-geojson** (Grégoire David) | Limites départementales (option) | Licence ODbL |

Les attributions cartographiques sont rendues par le contrôle d'attribution
MapLibre (coin bas-droit).

### Endpoint FIRMS utilisé

Interrogation **par zone** (area API), une requête par source :

```
https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{day_range}
```

- Ordre des coordonnées : **ouest, sud, est, nord** (min lon, min lat, max lon, max lat).
- Bounding box France : `-5.5, 41.0, 10.0, 51.5`.
- `day_range` : 1 à 10 jours (dérivé de la période demandée), puis filtrage fin
  côté serveur sur la fenêtre exacte (en minutes).
- Colonnes : VIIRS (`bright_ti4`, `bright_ti5`, `confidence` catégoriel `l/n/h`) ·
  MODIS (`brightness`, `bright_t31`, `confidence` numérique 0-100).

---

## Obtenir une clé NASA FIRMS

1. Aller sur <https://firms.modaps.eosdis.nasa.gov/api/map_key/>.
2. Renseigner une adresse e-mail : la **MAP_KEY** est envoyée gratuitement.
3. La placer dans `.env.local` (voir ci-dessous). **Ne jamais la committer.**

La clé reste **exclusivement côté serveur** : elle n'apparaît jamais dans les
requêtes du navigateur (le frontend n'appelle que `/api/firms`).

---

## Configuration

Copier `.env.example` en `.env.local` et renseigner :

```bash
# Clé serveur NASA FIRMS (absente = mode démonstration)
FIRMS_MAP_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Nom public de l'app
NEXT_PUBLIC_APP_NAME=Feux France
```

Variables **serveur** (jamais exposées) : `FIRMS_MAP_KEY`.
Variables **publiques** : `NEXT_PUBLIC_APP_NAME`.

---

## Lancer le projet

```bash
npm install
npm run dev           # http://localhost:3000/feux
```

> En développement local, la carte se charge normalement. Dans certains
> environnements CI/sandbox où le websocket HMR de `next dev` est indisponible,
> le chargement différé de la carte peut être bloqué : utilisez alors le build de
> production (`npm run build && npm run start`).

---

## Tests

```bash
npm run type-check    # TypeScript strict
npm run lint          # ESLint (flat config)
npm test              # Vitest — unitaires + intégration (64 tests)
npm run test:e2e      # Playwright — end-to-end (build prod + start automatiques)
```

- **Unitaires** (`lib/firms/*.test.ts`) : parsing CSV, validation Zod, conversion
  de dates UTC → Europe/Paris, classification ancienneté & confiance (VIIRS +
  MODIS), déduplication, identifiant stable, mode démo, validation des paramètres.
- **Intégration** (`app/api/firms/route.test.ts`) : route API avec FIRMS simulé,
  succès, réponse vide, erreur NASA (repli cache), clé absente (démo), cache
  actif, paramètres invalides.
- **End-to-end** (`e2e/feux.spec.ts`, desktop + mobile) : ouverture, carte, zoom,
  déplacement, marqueurs simulés, fiche de détection, changement de période,
  recherche géographique, thème, erreur API, affichage mobile.

Les tests **ne dépendent pas de l'API NASA réelle** : fixtures réalistes
(`lib/firms/__fixtures__/*.csv`) et réponses simulées (`e2e/fixtures.ts`).

Le navigateur Playwright pré-installé de l'environnement peut être ciblé via
`PW_CHROMIUM_PATH` (sinon Playwright utilise son propre navigateur).

---

## Fonctionnement du cache

- Cache **mémoire serveur** par clé de requête (sources + bbox arrondie + période),
  **TTL 8 min** (`CACHE_TTL_MS`).
- Requête servie depuis le cache si frais → **pas d'appel FIRMS** (ménage le quota).
- Échec API avec cache disponible → **dernières données conservées** + bandeau
  discret (`stale: true`), la carte n'est jamais vidée brutalement.
- Échec API sans cache → réponse vide + invitation à réessayer (pas de crash).
- Côté client : **auto-refresh 10 min** + bouton **Actualiser** manuel.

---

## Sécurité

- Aucune clé API dans le frontend ni dans le dépôt Git.
- `FIRMS_MAP_KEY` uniquement côté serveur, jamais renvoyée dans les réponses.
- Validation Zod des **paramètres entrants** (période, sources, bbox) et des
  **données externes**.
- **Bounding box bornée** (plage raisonnable + étendue max) contre les requêtes
  abusives, **timeout réseau** (12 s FIRMS / 8 s géocodage).
- Gestion d'erreurs sans divulgation de secret, **journalisation minimale** sans
  donnée personnelle.
- **Géolocalisation** uniquement navigateur, avec consentement.

---

## Déploiement Vercel

1. Importer le repo dans Vercel (framework Next.js détecté).
2. Ajouter les variables d'environnement du projet :
   - `FIRMS_MAP_KEY` → **Sensitive**, environnements Production + Preview.
   - `NEXT_PUBLIC_APP_NAME` → `Feux France`.
3. Déployer. La page publique est disponible sur `/feux`.
   Sans `FIRMS_MAP_KEY`, l'app se déploie quand même en **mode démonstration**.

Région recommandée : `cdg1` (Paris) — déjà définie dans `vercel.json`.

---

## Arborescence (module Feux France)

```
app/
  feux/page.tsx                 Page publique (metadata + FeuxApp)
  api/firms/route.ts            Proxy FIRMS : cache, validation, démo, repli
  api/firms/route.test.ts       Tests d'intégration de la route
  api/geocode/route.ts          Proxy Base Adresse Nationale
lib/firms/
  types.ts                      FireDetection & FirmsResponse
  constants.ts                  Sources, bbox France, quotas, TTL
  csv.ts                        Parseur CSV tolérant
  schema.ts                     Schémas Zod (VIIRS + MODIS)
  normalize.ts                  Dates UTC→ISO, confiance, ancienneté, id, dédup
  format.ts                     Fuseau Europe/Paris, libellés, couleurs
  params.ts                     Validation des query params
  fetch.ts                      Récupération multi-sources + cache
  demo.ts                       Mode démonstration (données fictives)
  __fixtures__/*.csv            Fixtures de test réalistes
  *.test.ts                     Tests unitaires
components/feux/
  FeuxApp.tsx                   Orchestrateur (état, layout, responsive)
  MapView.tsx                   Carte MapLibre (dynamique, ssr:false)
  TopBar.tsx / FilterPanel.tsx / DetailSheet.tsx / SearchBar.tsx
  Legend.tsx / Disclaimer.tsx
  useFirmsData.ts / useTheme.ts / useReducedMotion.ts
  mapStyle.ts / geojson.ts
e2e/
  feux.spec.ts                  Tests Playwright
  fixtures.ts                   Réponses API simulées
```

---

## Limites fonctionnelles connues

- Les **limites départementales** dépendent d'une source GeoJSON externe
  (GitHub) chargée à la volée ; en cas d'indisponibilité, elles ne s'affichent
  simplement pas (dégradation silencieuse).
- Le **cache serveur** est en mémoire de processus : il n'est pas partagé entre
  instances serverless (chaque instance a son propre cache court).
- Période **7 jours** soumise au quota FIRMS ; l'API area accepte jusqu'à 10 jours.
- Les données peuvent être **absentes** hors zone couverte ou en cas de forte
  couverture nuageuse.
