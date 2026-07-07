/**
 * Résolution centralisée des images DEMO.
 *
 * Règle de priorité :
 *   1. URL réelle (non-placeholder) → retournée telle quelle
 *   2. placeholder.demo connu → asset local correspondant
 *   3. src null/undefined + caption correspondant → asset local
 *   4. placeholder.demo non mappé → null  (aucune requête réseau)
 *
 * Les vraies images uploadées restent toujours prioritaires.
 */

// ── Covers ──────────────────────────────────────────────────────────────────

const DEMO_COVERS: Record<string, string> = {
  'Villa Les Pins':                              '/demo/images/covers/cover-villa-les-pins.png',
  'Rénovation Appartement Rue de la Paix':       '/demo/images/covers/cover-renovation-appartement.png',
  'Extension Garage Famille Moreau':             '/demo/images/covers/cover-extension-garage.png',
  'Réhabilitation École Saint-Exupéry':          '/demo/images/covers/cover-ecole-saint-exupery.png',
  'Maison Individuelle Lotissement Les Charmes': '/demo/images/covers/cover-lotissement.png',
}

// ── Photos — mapping par nom de fichier (extrait de l'URL placeholder) ───────

const DEMO_PHOTO_BY_FILENAME: Record<string, string> = {
  // réserves
  'fissure-mur-nord':              '/demo/images/photos/reserves/fissure-mur-nord.png',
  'humidite-sous-sol':             '/demo/images/photos/reserves/humidite-sous-sol.png',
  'infiltration-fenetre-classe3':  '/demo/images/photos/reserves/infiltration-fenetre.png',
  'menuiserie-defaut':             '/demo/images/photos/reserves/menuiserie-defaut.png',
  'revetement-decolle':            '/demo/images/photos/reserves/revetement-decolle.png',
  // avancement
  'coulage-dalle':                 '/demo/images/photos/avancement/gros-oeuvre.png',
  'revetement-sol':                '/demo/images/photos/avancement/carrelage-sdb.png',
  'gros-oeuvre':                   '/demo/images/photos/avancement/gros-oeuvre.png',
  'montage-charpente':             '/demo/images/photos/avancement/montage-charpente.png',
  'peinture-couloir':              '/demo/images/photos/avancement/peinture-couloir.png',
  'pose-menuiseries':              '/demo/images/photos/avancement/pose-menuiseries.png',
  'carrelage-sdb':                 '/demo/images/photos/avancement/carrelage-sdb.png',
  // aliases — filenames alternatifs possibles selon la source du dataset
  'avancement-semaine-22':         '/demo/images/photos/avancement/gros-oeuvre.png',
  'avancement-chantier':           '/demo/images/photos/avancement/gros-oeuvre.png',
  'avancement-villa-les-pins':     '/demo/images/photos/avancement/gros-oeuvre.png',
  'semaine-22':                    '/demo/images/photos/avancement/gros-oeuvre.png',
}

// ── Photos — mapping par caption (fallback quand src est null) ───────────────

const DEMO_PHOTO_BY_CAPTION: Array<[RegExp, string]> = [
  [/fissure/i,                        '/demo/images/photos/reserves/fissure-mur-nord.png'],
  [/humidit/i,                        '/demo/images/photos/reserves/humidite-sous-sol.png'],
  [/infiltration/i,                   '/demo/images/photos/reserves/infiltration-fenetre.png'],
  [/menuiserie.*d[ée]faut|d[ée]faut.*pose/i, '/demo/images/photos/reserves/menuiserie-defaut.png'],
  [/rev[êe]tement.*d[ée]coll/i,       '/demo/images/photos/reserves/revetement-decolle.png'],
  [/avancement.*chantier|semaine\s*\d+/i, '/demo/images/photos/avancement/gros-oeuvre.png'],
  [/coulage|gros.oeuvre/i,            '/demo/images/photos/avancement/gros-oeuvre.png'],
  [/rev[êe]tement.*sol/i,             '/demo/images/photos/avancement/carrelage-sdb.png'],
  [/carrelage/i,                      '/demo/images/photos/avancement/carrelage-sdb.png'],
  [/charpente/i,                      '/demo/images/photos/avancement/montage-charpente.png'],
  [/peinture/i,                       '/demo/images/photos/avancement/peinture-couloir.png'],
  [/menuiserie/i,                     '/demo/images/photos/avancement/pose-menuiseries.png'],
]

// ── Helpers internes ─────────────────────────────────────────────────────────

function isPlaceholder(src: string): boolean {
  return src.includes('placeholder.demo')
}

function resolveByFilename(src: string): string | null {
  // Extrait le nom de fichier sans extension, qu'il soit dans /photos/ ou /photos/thumb/
  const filename = src.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  return DEMO_PHOTO_BY_FILENAME[filename] ?? null
}

function resolveByCaption(caption: string | null | undefined): string | null {
  if (!caption) return null
  for (const [pattern, path] of DEMO_PHOTO_BY_CAPTION) {
    if (pattern.test(caption)) return path
  }
  return null
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Résout une URL d'image DEMO.
 *
 * @param src      - URL brute (peut être null/undefined, placeholder.demo, ou réelle)
 * @param caption  - Légende de la photo (utilisée en fallback si src est null ou placeholder inconnu)
 * @returns        - URL locale /demo/..., URL réelle, ou null (déclenche le fallback propre)
 */
export function resolveDemoImageSrc(
  src: string | null | undefined,
  caption?: string | null,
): string | null {
  // 1. src valide non-placeholder → image réelle uploadée, prioritaire
  if (src && !isPlaceholder(src)) return src

  // 2. src est un placeholder.demo → essayer le mapping par nom de fichier
  if (src && isPlaceholder(src)) {
    const byFilename = resolveByFilename(src)
    if (byFilename) return byFilename
    // placeholder connu mais non mappé → essayer caption, puis null
    return resolveByCaption(caption)
  }

  // 3. src est null/undefined → essayer caption uniquement
  return resolveByCaption(caption)
}

/**
 * Retourne le cover local pour un projet [DEMO] sans image_url, ou null.
 */
export function getDemoCover(projectName: string): string | null {
  for (const [key, path] of Object.entries(DEMO_COVERS)) {
    if (projectName.includes(key)) return path
  }
  return null
}
