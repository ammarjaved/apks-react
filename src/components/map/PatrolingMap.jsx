import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

/**
 * The patrol routes on a map.
 *
 * Unlike `MapView` this draws from a GeoJSON source rather than vector tiles:
 * a patrol run is a whole route, there are few of them per business area, and
 * the API already hands them over as one FeatureCollection. That also means the
 * selected route can be highlighted by filtering on its `id` with no tile round
 * trip — clicking a row in the table lights the route up immediately.
 */

const QA_COLORS = {
  Accept: '#22c55e',
  Reject: '#ef4444',
  Pending: '#eab308',
  None: '#9ca3af',
}

const LINE_COLOR = [
  'match', ['get', 'qa_status'],
  'Accept', QA_COLORS.Accept,
  'Reject', QA_COLORS.Reject,
  'Pending', QA_COLORS.Pending,
  QA_COLORS.None,
]

// Matches no feature — keeps the highlight layers empty until a row is picked.
const NO_ID = -1

// The labelled Start / End markers need a font, and this style carries no glyph
// source of its own. Note the path: the host serves the stacks at its root, and
// a wrong path answers 200 with an HTML error page rather than a 404 — MapLibre
// then fails to parse it ("Unimplemented type: 4") and drops the whole tile.
const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

// One of the stacks that server actually carries; "Noto Sans Regular" is not.
const LABEL_FONT = ['Open Sans Regular']

// Where the run began and ended, as typed into the form.
const ENDPOINT_COLORS = { start: '#16a34a', end: '#dc2626' }

const EMPTY = { type: 'FeatureCollection', features: [] }

export default function PatrolingMap({
  data,
  selectedId = null,
  onSelect,
  initialCenter = [101.55, 3.05],
  initialZoom = 9,
  height = 420,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const [baseStyle, setBaseStyle] = useState('satellite')
  const [ready, setReady] = useState(false)

  // Registered once with the map, so the current handler is read through a ref.
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    el.innerHTML = ''

    const map = new maplibregl.Map({
      container: el,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true,
      style: {
        version: 8,
        glyphs: GLYPHS_URL,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri',
          },
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
          patrols: { type: 'geojson', data: EMPTY, promoteId: 'id' },
          // Derived from the runs rather than fetched: the two coordinates the
          // uploader typed, drawn on top of the route they belong to.
          endpoints: { type: 'geojson', data: EMPTY },
          // The same two points again, for the labels alone. Symbol layers need
          // glyphs, and a glyph server that cannot be reached fails the whole
          // tile it is preparing — sharing one source would take the dots down
          // with the text. On their own source the markers survive it.
          'endpoint-labels': { type: 'geojson', data: EMPTY },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'visible' } },
          { id: 'osm', type: 'raster', source: 'osm-tiles', layout: { visibility: 'none' } },
          // A KML may carry an area rather than a route; draw it under the lines.
          {
            id: 'patrol-fill', type: 'fill', source: 'patrols',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': LINE_COLOR, 'fill-opacity': 0.15 },
          },
          // Wide transparent casing so a thin route is still easy to click.
          {
            id: 'patrol-hit', type: 'line', source: 'patrols',
            paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 16 },
          },
          {
            id: 'patrol-lines', type: 'line', source: 'patrols',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': LINE_COLOR,
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 4],
              'line-opacity': 0.85,
            },
          },
          // The selected route: a halo plus the line redrawn on top, so it reads
          // clearly even where routes overlap.
          {
            id: 'patrol-halo', type: 'line', source: 'patrols',
            filter: ['==', ['get', 'id'], NO_ID],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 8, 14, 12], 'line-opacity': 0.9 },
          },
          {
            id: 'patrol-selected', type: 'line', source: 'patrols',
            filter: ['==', ['get', 'id'], NO_ID],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7], 'line-opacity': 1 },
          },
          // Points, for a KML that marks stops rather than a route.
          {
            id: 'patrol-points', type: 'circle', source: 'patrols',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 5, 'circle-color': LINE_COLOR,
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
            },
          },
          // Where the run began and ended, drawn over the route they belong to.
          {
            id: 'patrol-endpoint-dots', type: 'circle', source: 'endpoints',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7],
              'circle-color': ['match', ['get', 'kind'], 'start', ENDPOINT_COLORS.start, ENDPOINT_COLORS.end],
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
            },
          },
          {
            id: 'patrol-endpoint-labels', type: 'symbol', source: 'endpoint-labels',
            layout: {
              'text-field': ['get', 'label'],
              'text-font': LABEL_FONT,
              'text-size': 12,
              'text-offset': [0, -1.2],
              'text-anchor': 'bottom',
            },
            paint: {
              'text-color': ['match', ['get', 'kind'], 'start', ENDPOINT_COLORS.start, ENDPOINT_COLORS.end],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            },
          },
        ],
      },
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
    map.on('load', () => setReady(true))

    const clickable = ['patrol-hit', 'patrol-fill', 'patrol-points', 'patrol-endpoint-dots']
    const handleClick = (e) => {
      const id = e.features?.[0]?.properties?.id
      if (id != null) onSelectRef.current?.(Number(id))
    }
    clickable.forEach((layer) => {
      map.on('click', layer, handleClick)
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
    })

    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push new data in and frame it. Refitting only when the set of routes
  // changes keeps the map still while the user clicks through the table.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource('patrols')
    if (!source) return

    source.setData(data || EMPTY)
    const marks = endpointsOf(data)
    map.getSource('endpoints')?.setData(marks)
    map.getSource('endpoint-labels')?.setData(marks)

    // Frame the markers too: a coordinate typed a little off the route should
    // still be in view rather than sitting just outside it.
    const bounds = boundsOf({ features: [...(data?.features || []), ...marks.features] })
    if (bounds && !selectedId) map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready])

  // Highlight the selected route and zoom to it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const expr = ['==', ['get', 'id'], selectedId ?? NO_ID]
    for (const id of ['patrol-halo', 'patrol-selected']) {
      if (map.getLayer(id)) map.setFilter(id, expr)
    }
    if (selectedId == null) return

    const feature = (data?.features || []).find((f) => f.properties?.id === selectedId)
    const bounds = boundsOf(
      feature ? { features: [feature, ...endpointsOf({ features: [feature] }).features] } : null
    )
    if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 700 })
  }, [selectedId, data, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('satellite')) return
    map.setLayoutProperty('satellite', 'visibility', baseStyle === 'satellite' ? 'visible' : 'none')
    map.setLayoutProperty('osm', 'visibility', baseStyle === 'street' ? 'visible' : 'none')
  }, [baseStyle])

  const heightStyle = typeof height === 'string' ? height : `${height}px`
  const count = data?.features?.length || 0

  return (
    <div className="relative" style={{ height: heightStyle }}>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />

      <div className="absolute top-3 left-3 bg-white rounded-lg shadow-md p-1 flex gap-1 z-10">
        {['satellite', 'street'].map((style) => (
          <button
            key={style}
            onClick={() => setBaseStyle(style)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              baseStyle === style ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      <div className="absolute bottom-8 left-3 bg-white rounded-lg shadow-md px-3 py-2 z-10">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
          Routes ({count})
        </p>
        <div className="space-y-1">
          {[
            { label: 'Accepted', color: QA_COLORS.Accept },
            { label: 'Pending', color: QA_COLORS.Pending },
            { label: 'Rejected', color: QA_COLORS.Reject },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="inline-block w-4 h-1 rounded-full" style={{ background: item.color }} />
              <span className="text-xs text-gray-700">{item.label}</span>
            </div>
          ))}
          {[
            { label: 'Start', color: ENDPOINT_COLORS.start },
            { label: 'End', color: ENDPOINT_COLORS.end },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full border border-white"
                style={{ background: item.color }}
              />
              <span className="text-xs text-gray-700">{item.label} point</span>
            </div>
          ))}
        </div>
      </div>

      {count === 0 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none text-center">
          <span className="bg-white/90 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full shadow">
            No routes match these filters
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The Start / End markers for a set of runs, as their own FeatureCollection.
 *
 * `start_xy` and `end_xy` are typed into the form rather than read from the KML
 * — the file draws the route but not which end of it the patrol set off from.
 * The API hands them over already parsed as `start_point` / `end_point`
 * ([lng, lat]); a run carrying neither simply contributes no marker.
 */
function endpointsOf(collection) {
  const features = []
  for (const run of collection?.features || []) {
    const props = run?.properties || {}
    for (const [kind, label, key] of [
      ['start', 'Start', 'start_point'],
      ['end', 'End', 'end_point'],
    ]) {
      const point = props[key]
      if (!Array.isArray(point) || point.length !== 2) continue
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: { id: props.id, kind, label, qa_status: props.qa_status },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

/** LngLatBounds covering every coordinate in a FeatureCollection, or null. */
function boundsOf(collection) {
  const features = collection?.features || []
  if (features.length === 0) return null

  const bounds = new maplibregl.LngLatBounds()
  let extended = false
  const walk = (coords) => {
    if (typeof coords?.[0] === 'number') {
      bounds.extend(coords)
      extended = true
    } else if (Array.isArray(coords)) {
      coords.forEach(walk)
    }
  }
  features.forEach((f) => {
    if (f?.geometry?.type === 'GeometryCollection') {
      f.geometry.geometries?.forEach((g) => walk(g?.coordinates))
    } else {
      walk(f?.geometry?.coordinates)
    }
  })
  return extended ? bounds : null
}
