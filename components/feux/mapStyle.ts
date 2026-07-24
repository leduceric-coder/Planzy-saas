// ── Feux France — styles de fond de carte (MapLibre, tuiles raster) ──────────
// OpenStreetMap par défaut (attribution obligatoire). Fond satellite ESRI
// activable en option (attribution obligatoire également).

import type { StyleSpecification } from 'maplibre-gl'

export type BaseLayer = 'osm' | 'satellite'

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'
export const SATELLITE_ATTRIBUTION =
  'Imagerie © Esri, Maxar, Earthstar Geographics, GIS User Community'

export function baseStyle(layer: BaseLayer): StyleSpecification {
  if (layer === 'satellite') {
    return {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: SATELLITE_ATTRIBUTION,
        },
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
    }
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  }
}
