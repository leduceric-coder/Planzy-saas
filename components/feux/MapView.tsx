'use client'

// ── Feux France — carte MapLibre GL ──────────────────────────────────────────
// Rendu GeoJSON optimisé + clustering natif + carte de chaleur + marqueurs
// colorés par ancienneté, pulsation légère pour les détections récentes.
// Chargé dynamiquement (ssr:false) : MapLibre ne s'exécute que côté navigateur.

import { useEffect, useRef } from 'react'
import maplibregl, {
  type Map as MlMap,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FireDetection } from '@/lib/firms/types'
import { FRANCE_CENTER, FRANCE_DEFAULT_ZOOM } from '@/lib/firms/constants'
import { toFeatureCollection } from './geojson'
import { baseStyle, type BaseLayer } from './mapStyle'

export type DisplayMode = 'markers' | 'heatmap' | 'clusters'

export type FlyTarget = { longitude: number; latitude: number; zoom: number; nonce: number }

type Props = {
  detections: FireDetection[]
  displayMode: DisplayMode
  baseLayer: BaseLayer
  showDepartments: boolean
  reducedMotion: boolean
  flyTo: FlyTarget | null
  locateNonce: number
  onSelect: (d: FireDetection) => void
  onBoundsInfo?: (visibleCount: number) => void
}

const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
const DEPARTMENTS_URL =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson'

function styleWithGlyphs(base: StyleSpecification): StyleSpecification {
  return { ...base, glyphs: GLYPHS }
}

export default function MapView({
  detections,
  displayMode,
  baseLayer,
  showDepartments,
  reducedMotion,
  flyTo,
  locateNonce,
  onSelect,
  onBoundsInfo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const readyRef = useRef(false)
  const detectionsRef = useRef<Map<string, FireDetection>>(new Map())
  const dataRef = useRef(detections)
  const modeRef = useRef(displayMode)
  const rafRef = useRef<number | null>(null)

  // Synchronise les refs « miroir » hors rendu (utilisées dans les closures
  // MapLibre et l'animation de pulsation).
  useEffect(() => {
    dataRef.current = detections
    modeRef.current = displayMode
  })

  // ── Init map (une seule fois) ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleWithGlyphs(baseStyle(baseLayer)),
      center: [FRANCE_CENTER.longitude, FRANCE_CENTER.latitude],
      zoom: FRANCE_DEFAULT_ZOOM,
      attributionControl: { compact: true },
      maxZoom: 18,
    })
    mapRef.current = map
    // Référence exposée pour les tests end-to-end (projection lng/lat → pixels).
    ;(window as unknown as { __feuxMap?: MlMap }).__feuxMap = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      readyRef.current = true
      addFireLayers(map)
      updateData(map, dataRef.current)
      applyVisibility(map, modeRef.current)
      if (showDepartments) addDepartments(map)
      attachHandlers(map, onSelect, detectionsRef)
      emitVisibleCount(map, onBoundsInfo)
      startPulse()
    })

    map.on('moveend', () => emitVisibleCount(map, onBoundsInfo))

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Détections → source + table de correspondance (clic → fiche) ───────────
  useEffect(() => {
    detectionsRef.current = new Map(detections.map((d) => [d.id, d]))
    const map = mapRef.current
    if (!map || !readyRef.current) return
    updateData(map, detections)
    emitVisibleCount(map, onBoundsInfo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detections])

  // ── Mode d'affichage ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    applyVisibility(map, displayMode)
  }, [displayMode])

  // ── Changement de fond de carte ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    readyRef.current = false
    map.setStyle(styleWithGlyphs(baseStyle(baseLayer)))
    map.once('styledata', () => {
      addFireLayers(map)
      updateData(map, dataRef.current)
      applyVisibility(map, modeRef.current)
      if (showDepartments) addDepartments(map)
      attachHandlers(map, onSelect, detectionsRef)
      readyRef.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseLayer])

  // ── Limites départementales ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (showDepartments) addDepartments(map)
    else removeDepartments(map)
  }, [showDepartments])

  // ── FlyTo (recherche géographique) ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({
      center: [flyTo.longitude, flyTo.latitude],
      zoom: flyTo.zoom,
      duration: reducedMotion ? 0 : 1200,
    })
  }, [flyTo, reducedMotion])

  // ── Géolocalisation (bouton top bar) ───────────────────────────────────────
  useEffect(() => {
    if (!locateNonce) return
    const map = mapRef.current
    if (!map || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 9,
          duration: reducedMotion ? 0 : 1200,
        })
      },
      () => {
        /* refus / échec — silencieux, géoloc uniquement avec consentement */
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateNonce])

  // ── Pulsation des détections récentes (< 3 h) ──────────────────────────────
  function startPulse() {
    if (reducedMotion) return
    const animate = () => {
      const map = mapRef.current
      if (map && readyRef.current && map.getLayer('pulse') && modeRef.current === 'markers') {
        const t = (Date.now() % 2000) / 2000 // 0→1 sur 2 s
        const radius = 8 + t * 14
        const opacity = 0.45 * (1 - t)
        map.setPaintProperty('pulse', 'circle-radius', radius)
        map.setPaintProperty('pulse', 'circle-opacity', opacity)
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      role="application"
      aria-label="Carte des détections satellites de chaleur en France"
      data-testid="map-container"
    />
  )
}

// ── Sources & couches ────────────────────────────────────────────────────────

function addFireLayers(map: MlMap) {
  const empty = { type: 'FeatureCollection' as const, features: [] }

  if (!map.getSource('fires-flat')) {
    map.addSource('fires-flat', { type: 'geojson', data: empty })
  }
  if (!map.getSource('fires-clustered')) {
    map.addSource('fires-clustered', {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 12,
    })
  }

  // Carte de chaleur
  if (!map.getLayer('heat')) {
    map.addLayer({
      id: 'heat',
      type: 'heatmap',
      source: 'fires-flat',
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 12, 3],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 12, 12, 28],
        'heatmap-opacity': 0.75,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, 'rgba(253,219,105,0.6)',
          0.4, 'rgba(249,168,37,0.75)',
          0.6, 'rgba(245,124,0,0.85)',
          0.8, 'rgba(230,74,25,0.9)',
          1, 'rgba(198,40,40,0.95)',
        ],
      },
    })
  }

  // Pulsation (détections récentes) — sous les marqueurs
  if (!map.getLayer('pulse')) {
    map.addLayer({
      id: 'pulse',
      type: 'circle',
      source: 'fires-flat',
      filter: ['==', ['get', 'recent'], 1],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 10,
        'circle-color': '#ef4444',
        'circle-opacity': 0.35,
        'circle-blur': 0.3,
      },
    })
  }

  // Marqueurs colorés par ancienneté
  if (!map.getLayer('markers')) {
    map.addLayer({
      id: 'markers',
      type: 'circle',
      source: 'fires-flat',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.85)',
        'circle-opacity': 0.9,
      },
    })
  }

  // Clusters
  if (!map.getLayer('clusters')) {
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'fires-clustered',
      filter: ['has', 'point_count'],
      layout: { visibility: 'none' },
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#f59e0b', 10, '#f97316', 30, '#ef4444',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 30],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.8)',
      },
    })
  }
  if (!map.getLayer('cluster-count')) {
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'fires-clustered',
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Bold'],
        'text-size': 13,
      },
      paint: { 'text-color': '#1a1a1a' },
    })
  }
  if (!map.getLayer('unclustered')) {
    map.addLayer({
      id: 'unclustered',
      type: 'circle',
      source: 'fires-clustered',
      filter: ['!', ['has', 'point_count']],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.85)',
        'circle-opacity': 0.9,
      },
    })
  }
}

function updateData(map: MlMap, detections: FireDetection[]) {
  const fc = toFeatureCollection(detections)
  const flat = map.getSource('fires-flat') as GeoJSONSource | undefined
  const clustered = map.getSource('fires-clustered') as GeoJSONSource | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flat?.setData(fc as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clustered?.setData(fc as any)
}

function applyVisibility(map: MlMap, mode: DisplayMode) {
  const set = (id: string, v: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none')
  }
  set('heat', mode === 'heatmap')
  set('markers', mode === 'markers')
  set('pulse', mode === 'markers')
  set('clusters', mode === 'clusters')
  set('cluster-count', mode === 'clusters')
  set('unclustered', mode === 'clusters')
}

let handlersBound = false
function attachHandlers(
  map: MlMap,
  onSelect: (d: FireDetection) => void,
  lookup: React.RefObject<Map<string, FireDetection>>
) {
  // Re-bind après setStyle : MapLibre conserve les listeners sur l'instance,
  // donc on ne rebinde qu'une fois par instance.
  if (handlersBound && (map as unknown as { __feuxBound?: boolean }).__feuxBound) return
  ;(map as unknown as { __feuxBound?: boolean }).__feuxBound = true
  handlersBound = true

  const selectFeature = (f: MapGeoJSONFeature) => {
    const id = f.properties?.id as string | undefined
    if (!id) return
    const d = lookup.current?.get(id)
    if (d) onSelect(d)
  }

  map.on('click', 'markers', (e) => e.features?.[0] && selectFeature(e.features[0]))
  map.on('click', 'unclustered', (e) => e.features?.[0] && selectFeature(e.features[0]))

  map.on('click', 'clusters', (e) => {
    const feature = e.features?.[0]
    if (!feature) return
    const clusterId = feature.properties?.cluster_id
    const src = map.getSource('fires-clustered') as GeoJSONSource
    src.getClusterExpansionZoom(clusterId).then((zoom) => {
      const coords = (feature.geometry as unknown as { coordinates: [number, number] }).coordinates
      map.easeTo({ center: coords, zoom: Math.min(zoom, 14) })
    })
  })

  for (const layer of ['markers', 'unclustered', 'clusters']) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }
}

function addDepartments(map: MlMap) {
  if (map.getLayer('departements-line')) return
  fetch(DEPARTMENTS_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('dep HTTP'))))
    .then((geojson) => {
      if (!map || !map.getStyle()) return
      if (!map.getSource('departements')) {
        map.addSource('departements', { type: 'geojson', data: geojson })
      }
      if (!map.getLayer('departements-line')) {
        map.addLayer({
          id: 'departements-line',
          type: 'line',
          source: 'departements',
          paint: {
            'line-color': 'rgba(120,120,140,0.55)',
            'line-width': 0.8,
          },
        })
      }
    })
    .catch(() => {
      /* source indisponible — limites simplement non affichées */
    })
}

function removeDepartments(map: MlMap) {
  if (map.getLayer('departements-line')) map.removeLayer('departements-line')
  if (map.getSource('departements')) map.removeSource('departements')
}

function emitVisibleCount(map: MlMap, cb?: (n: number) => void) {
  if (!cb) return
  const src = map.getSource('fires-flat') as GeoJSONSource | undefined
  if (!src) return
  const bounds = map.getBounds()
  // Compte les features dans la vue via les données rendues.
  const feats = map.querySourceFeatures('fires-flat')
  const seen = new Set<string>()
  let n = 0
  for (const f of feats) {
    const id = f.properties?.id as string | undefined
    if (!id || seen.has(id)) continue
    const g = f.geometry as unknown as { coordinates?: [number, number] }
    if (!g.coordinates) continue
    if (bounds.contains(g.coordinates)) {
      seen.add(id)
      n++
    }
  }
  cb(n)
}
