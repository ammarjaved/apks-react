import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { surveyApi } from '../../api/surveys'

const TILE_SERVER = import.meta.env.VITE_TILE_URL || '/api/v1/tiles'

const QA_COLORS = {
  Accept: '#22c55e',
  Reject: '#ef4444',
  Pending: '#eab308',
  None: '#9ca3af',
}

const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

// Sentinel that matches no feature — used to keep the highlight layers empty.
const NO_POINT = '__none__'

// Substations double as a landmark on the other survey maps — a pole is located
// by the substation it feeds from — so they are offered as a context overlay.
// The colour is the Substation module's own (see surveyConfigs.js) so the two
// screens agree.
const SUBSTATION_TABLE = 'tbl_substation'
const SUBSTATION_COLOR = '#7c3aed'

// Poles are the reference for anything measured between them — height clearance
// most of all, where the surveyor has to see the two poles before dropping the
// pin between them. Offered as a context overlay on every map except SAVR's own.
// Colour is the SAVR module's (see surveyConfigs.js) so the two screens agree.
const SAVR_TABLE = 'tbl_savr'
const SAVR_COLOR = '#2563eb'

// Maps the tile layer's `table_name` onto the survey route slug.
const ENDPOINT_BY_TABLE = {
  tbl_savr: 'savr',
  tbl_substation: 'substation',
  tbl_feeder_pillar: 'feeder-pillar',
  tbl_link_box: 'link-box',
  tbl_cable_bridge: 'cable-bridge',
  tbl_ffw: 'ffw',
  tbl_height_clerance: 'height-clearance',
}

function buildStyle(surveyTileUrl, baTileUrl, wpTileUrl, substationTileUrl, savrTileUrl) {
  return {
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
      'survey-points': {
        type: 'vector',
        tiles: [surveyTileUrl],
        tileSize: 512,
        promoteId: 'geometry_id',
      },
      'ba-boundaries': {
        type: 'vector',
        tiles: [baTileUrl],
        tileSize: 512,
      },
      'workpackage-boundaries': {
        type: 'vector',
        tiles: [wpTileUrl],
        tileSize: 512,
      },
      // Same tile endpoint as `survey-points`, pinned to the substation table.
      'substation-points': {
        type: 'vector',
        tiles: [substationTileUrl],
        tileSize: 512,
        promoteId: 'geometry_id',
      },
      // Likewise, pinned to the pole table.
      'savr-points': {
        type: 'vector',
        tiles: [savrTileUrl],
        tileSize: 512,
        promoteId: 'geometry_id',
      },
    },
    layers: [
      // Base raster layer (satellite) — visible by default
      { id: 'satellite', type: 'raster', source: 'satellite-tiles', layout: { visibility: 'visible' } },
      { id: 'osm', type: 'raster', source: 'osm-tiles', layout: { visibility: 'none' } },
      // BA boundaries
      {
        id: 'survey-ba-fill', type: 'fill', source: 'ba-boundaries', 'source-layer': 'ba',
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.05 },
        layout: { visibility: 'visible' },
      },
      {
        id: 'survey-ba', type: 'line', source: 'ba-boundaries', 'source-layer': 'ba',
        paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-opacity': 0.6 },
        layout: { visibility: 'visible' },
      },
      {
        id: 'workpackage-fill', type: 'fill', source: 'workpackage-boundaries', 'source-layer': 'workpackage',
        paint: { 'fill-color': '#d97706', 'fill-opacity': 0.14 },
        layout: { visibility: 'visible' },
      },
      {
        id: 'workpackage-line', type: 'line', source: 'workpackage-boundaries', 'source-layer': 'workpackage',
        paint: { 'line-color': '#b45309', 'line-width': 1.5, 'line-opacity': 0.9 },
        layout: { visibility: 'visible' },
      },
      // Substation context overlay. Drawn below the survey points so it never
      // hides the layer the page is actually about; starts hidden and is
      // switched on by the layer toggle effect.
      {
        id: 'substation-points', type: 'circle', source: 'substation-points', 'source-layer': 'survey_points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 11],
          'circle-color': SUBSTATION_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
        layout: { visibility: 'none' },
      },
      // Pole context overlay, same rules as the substation one: below the survey
      // points, hidden until the layer toggle switches it on. Drawn a little
      // smaller so it reads as background rather than as the working set.
      {
        id: 'savr-points', type: 'circle', source: 'savr-points', 'source-layer': 'survey_points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 5, 16, 8],
          'circle-color': SAVR_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
        layout: { visibility: 'none' },
      },
      // Halo behind the selected point. `NO_POINT` keeps the layer empty until
      // a highlight id is supplied.
      {
        id: 'survey-point-halo', type: 'circle', source: 'survey-points', 'source-layer': 'survey_points',
        filter: ['==', ['get', 'geometry_id'], NO_POINT],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 14, 16, 22],
          'circle-color': '#2563eb',
          'circle-opacity': 0.25,
          'circle-stroke-color': '#2563eb',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.9,
        },
      },
      // Survey points
      {
        id: 'survey-points', type: 'circle', source: 'survey-points', 'source-layer': 'survey_points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 16, 10],
          'circle-color': [
            'match', ['get', 'qa_status'],
            'Accept', QA_COLORS.Accept,
            'Reject', QA_COLORS.Reject,
            'Pending', QA_COLORS.Pending,
            QA_COLORS.None,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
        layout: { visibility: 'visible' },
      },
      // The selected point redrawn on top, so it stays visible above its
      // neighbours regardless of tile draw order.
      {
        id: 'survey-point-selected', type: 'circle', source: 'survey-points', 'source-layer': 'survey_points',
        filter: ['==', ['get', 'geometry_id'], NO_POINT],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 11],
          'circle-color': [
            'match', ['get', 'qa_status'],
            'Accept', QA_COLORS.Accept,
            'Reject', QA_COLORS.Reject,
            'Pending', QA_COLORS.Pending,
            QA_COLORS.None,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-opacity': 1,
        },
      },
    ],
  }
}

export default function MapView({
  surveyConfig,
  onPointSelect,
  dropMode = false,
  onMapClick,
  filters = {},
  baId = null,
  /** Geometry id of the record to highlight (the tile's `geometry_id`). */
  highlightGeometryId = null,
  /** `[lng, lat]` of the highlighted record, used as a fallback marker. */
  highlightCoords = null,
  onWorkpackageClick,
  initialCenter = [101.55, 3.05],
  initialZoom = 10,
  height = 500,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const dropMarkerRef = useRef(null)
  const highlightMarkerRef = useRef(null)
  const baIdRef = useRef(baId)
  const filtersRef = useRef(filters)
  const dropModeRef = useRef(dropMode)
  const onWorkpackageClickRef = useRef(onWorkpackageClick)
  const onPointSelectRef = useRef(onPointSelect)
  const surveyConfigRef = useRef(surveyConfig)
  const [baseStyle, setBaseStyle] = useState('satellite')
  // Offered on every single-type survey map except the Substation map itself,
  // where it would just duplicate the main layer. On by default for SAVR, which
  // is where a surveyor actually needs the substation as a reference.
  const showSubstationLayer =
    Boolean(surveyConfig?.tableName) && surveyConfig.tableName !== SUBSTATION_TABLE
  // Same idea for poles, on every map but SAVR's own. On by default where the
  // record is defined in terms of poles — height clearance spans two of them, so
  // the surveyor cannot place the pin without seeing them.
  const showSavrLayer =
    Boolean(surveyConfig?.tableName) && surveyConfig.tableName !== SAVR_TABLE
  const [layersVisible, setLayersVisible] = useState({
    survey: true,
    ba: true,
    wp: true,
    substation: surveyConfig?.tableName === SAVR_TABLE,
    savr: Boolean(surveyConfig?.savrIdFrom) || surveyConfig?.tableName === 'tbl_ffw',
  })
  const [legendOpen, setLegendOpen] = useState(true)

  // The map's click handler is registered once, so props it depends on are read
  // through refs to avoid a stale closure on the first render.
  useEffect(() => {
    baIdRef.current = baId
  }, [baId])

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    dropModeRef.current = dropMode
  }, [dropMode])

  useEffect(() => {
    onWorkpackageClickRef.current = onWorkpackageClick
  }, [onWorkpackageClick])

  useEffect(() => {
    onPointSelectRef.current = onPointSelect
  }, [onPointSelect])

  useEffect(() => {
    surveyConfigRef.current = surveyConfig
  }, [surveyConfig])

  // Build tile URLs
  const buildQueryString = (params) => {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.append(k, v)
    })
    const qs = sp.toString()
    return qs ? `?${qs}` : ''
  }

  const getSurveyTileUrl = () => {
    const params = {}
    // Height clearance (and similar) paint parent poles instead of their own pins.
    const tileTable = surveyConfig?.mapTableName || surveyConfig?.tableName
    if (tileTable) params.table_name = tileTable
    if (filters.cycle) params.cycle = filters.cycle
    if (baId) params.ba_id = baId
    // QA / date filters apply to the survey table itself. Pole tiles are SAVR
    // rows, so those filters would hide poles that simply have no HC yet.
    if (!surveyConfig?.mapTableName) {
      if (filters.qa_status) params.qa_status = filters.qa_status
      if (filters.updated_after) params.updated_after = filters.updated_after
      if (filters.updated_before) params.updated_before = filters.updated_before
    }
    return `${TILE_SERVER}/survey/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  const getBaTileUrl = () => {
    const params = {}
    if (baId) params.ba_id = baId
    return `${TILE_SERVER}/ba/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  // The overlay is a landmark, not the working set, so it carries only the BA
  // scope — the page's cycle / QA filters would blank most substations out.
  const getSubstationTileUrl = () => {
    const params = { table_name: SUBSTATION_TABLE }
    if (baId) params.ba_id = baId
    return `${TILE_SERVER}/survey/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  // Landmark scope again: BA only, so the page's cycle / QA filters do not blank
  // out the poles the surveyor is trying to line the pin up with.
  const getSavrTileUrl = () => {
    const params = { table_name: SAVR_TABLE }
    if (baId) params.ba_id = baId
    return `${TILE_SERVER}/survey/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  const getWpTileUrl = () => {
    const params = {}
    if (baId) params.ba_id = baId
    if (filters.workpackage_id) params.workpackage_id = filters.workpackage_id
    return `${TILE_SERVER}/workpackage/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  // ================================================================
  // Initialize map once — style includes ALL sources and layers
  // ================================================================
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    // Clear any leftover maplibre internals from StrictMode double-mount
    el.innerHTML = ''

    const style = buildStyle(getSurveyTileUrl(), getBaTileUrl(), getWpTileUrl(), getSubstationTileUrl(), getSavrTileUrl())

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true,
      hash: false,
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

    // Point click handler
    map.on('click', 'survey-points', (e) => {
      if (dropModeRef.current || !e.features?.[0]) return
      handlePointClick(e, map)
    })

    map.on('mouseenter', 'survey-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'survey-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = ''
    })

    map.on('click', 'substation-points', (e) => {
      if (dropModeRef.current || !e.features?.[0]) return
      // A survey point sitting on top of a substation wins the click.
      const hits = map.queryRenderedFeatures(e.point, { layers: ['survey-points'] })
      if (hits.length) return
      handlePointClick(e, map)
    })
    map.on('mouseenter', 'substation-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'substation-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = ''
    })

    map.on('click', 'savr-points', (e) => {
      if (dropModeRef.current || !e.features?.[0]) return
      // The layer the page is about wins the click.
      const hits = map.queryRenderedFeatures(e.point, { layers: ['survey-points'] })
      if (hits.length) return
      handlePointClick(e, map)
    })
    map.on('mouseenter', 'savr-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'savr-points', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = ''
    })

    map.on('click', 'workpackage-fill', (e) => {
      if (dropModeRef.current || !e.features?.[0]) return
      const layers = ['survey-points']
      if (map.getLayer('substation-points')) layers.push('substation-points')
      if (map.getLayer('savr-points')) layers.push('savr-points')
      const hits = map.queryRenderedFeatures(e.point, { layers })
      if (hits.length) return
      handleWorkpackageClick(e, map)
    })
    map.on('mouseenter', 'workpackage-fill', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'workpackage-fill', () => {
      if (!dropModeRef.current) map.getCanvas().style.cursor = ''
    })

    return () => {
      highlightMarkerRef.current = null
      dropMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ================================================================
  // Update survey tile source when filters change
  // ================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.getSource('survey-points')) {
      map.getSource('survey-points').setTiles([getSurveyTileUrl()])
    }
    if (map.getSource('ba-boundaries')) {
      map.getSource('ba-boundaries').setTiles([getBaTileUrl()])
    }
    if (map.getSource('workpackage-boundaries')) {
      map.getSource('workpackage-boundaries').setTiles([getWpTileUrl()])
    }
    if (map.getSource('substation-points')) {
      map.getSource('substation-points').setTiles([getSubstationTileUrl()])
    }
    if (map.getSource('savr-points')) {
      map.getSource('savr-points').setTiles([getSavrTileUrl()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyConfig?.tableName, surveyConfig?.mapTableName, filters, baId])

  // ================================================================
  // Auto-center map on the BA boundary.
  // The API exposes no bounds endpoint, so the extent is derived from the BA
  // vector tiles once they have rendered. Fits at most once per baId; if no
  // boundary is in view the initial center/zoom is kept.
  //
  // Skipped when a specific point is being highlighted (the detail map) or
  // while dropping a pin — both want to stay where they were put.
  // ================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || dropMode || highlightGeometryId || highlightCoords) return

    let done = false

    const fitToBa = () => {
      if (done) return
      const features = map.querySourceFeatures('ba-boundaries', { sourceLayer: 'ba' })
      const wanted = baIdRef.current
      const matching = wanted ? features.filter((f) => f.properties?.id === wanted) : features
      if (matching.length === 0) return

      const bounds = new maplibregl.LngLatBounds()
      let extended = false
      const walk = (coords) => {
        if (typeof coords[0] === 'number') {
          bounds.extend(coords)
          extended = true
        } else {
          coords.forEach(walk)
        }
      }
      matching.forEach((f) => f.geometry?.coordinates && walk(f.geometry.coordinates))
      if (!extended) return

      done = true
      map.off('idle', fitToBa)
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 800 })
    }

    map.on('idle', fitToBa)
    return () => {
      done = true
      map.off('idle', fitToBa)
    }
  }, [baId, dropMode, highlightGeometryId, highlightCoords])

  // ================================================================
  // Highlight the selected point and centre the map on it.
  //
  // The tile feature may not exist yet (a record created moments ago is not in
  // a cached tile), so a marker is dropped at the known coordinates as well.
  // ================================================================
  // Depend on the coordinates as primitives — callers usually pass a fresh
  // array literal, which would otherwise re-run this on every render.
  const highlightLng = highlightCoords?.[0] ?? null
  const highlightLat = highlightCoords?.[1] ?? null

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyFilter = () => {
      const expr = ['==', ['get', 'geometry_id'], highlightGeometryId || NO_POINT]
      for (const id of ['survey-point-halo', 'survey-point-selected']) {
        if (map.getLayer(id)) map.setFilter(id, expr)
      }
    }

    if (map.isStyleLoaded()) applyFilter()
    else map.once('load', applyFilter)

    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.remove()
      highlightMarkerRef.current = null
    }
    if (highlightLng == null || highlightLat == null) {
      return () => map.off('load', applyFilter)
    }

    const center = [highlightLng, highlightLat]
    map.easeTo({ center, zoom: Math.max(map.getZoom(), 17), duration: 600 })

    // A record created moments ago may not be in a cached tile yet. Once the
    // tiles settle, drop a marker only if the point really isn't rendered —
    // otherwise the highlighted circle already marks the spot.
    const addFallbackMarker = () => {
      const rendered = map.querySourceFeatures('survey-points', {
        sourceLayer: 'survey_points',
        filter: ['==', ['get', 'geometry_id'], highlightGeometryId || NO_POINT],
      })
      if (rendered.length > 0) {
        if (highlightMarkerRef.current) {
          highlightMarkerRef.current.remove()
          highlightMarkerRef.current = null
        }
        return
      }
      if (!highlightMarkerRef.current) {
        highlightMarkerRef.current = new maplibregl.Marker({
          color: surveyConfig?.color || '#2563eb',
        })
          .setLngLat(center)
          .addTo(map)
      }
    }

    map.on('idle', addFallbackMarker)
    return () => {
      map.off('load', applyFilter)
      map.off('idle', addFallbackMarker)
    }
  }, [highlightGeometryId, highlightLng, highlightLat, surveyConfig?.color])

  // ================================================================
  // Toggle base layer
  // ================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('satellite')) return
    map.setLayoutProperty('satellite', 'visibility', baseStyle === 'satellite' ? 'visible' : 'none')
    map.setLayoutProperty('osm', 'visibility', baseStyle === 'street' ? 'visible' : 'none')
  }, [baseStyle])

  // ================================================================
  // Toggle overlay layers
  // ================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const map2 = { survey: 'survey-points', ba: 'survey-ba', wp: 'workpackage-line', substation: 'substation-points', savr: 'savr-points' }
      Object.entries(layersVisible).forEach(([k, on]) => {
        let visible = on
        if (k === 'substation') visible = on && showSubstationLayer
        if (k === 'savr') visible = on && showSavrLayer
        const layerId = map2[k]
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
        }
        if (k === 'ba' && map.getLayer('survey-ba-fill')) {
          map.setLayoutProperty('survey-ba-fill', 'visibility', visible ? 'visible' : 'none')
        }
        if (k === 'wp' && map.getLayer('workpackage-fill')) {
          map.setLayoutProperty('workpackage-fill', 'visibility', visible ? 'visible' : 'none')
        }
      })
    }

    // Wait for the style when it is not up yet, instead of giving up.
    //
    // This effect runs on mount, before the style has loaded, and its deps only
    // change when someone touches a toggle — so bailing out here meant the
    // initial state was never applied at all. It went unnoticed because the
    // layers that default to ON are also declared `visibility: 'visible'` in the
    // style. The two overlays are declared hidden and switched on from here, so
    // they were the ones that stayed invisible until a toggle was clicked.
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
    return () => map.off('load', apply)
  }, [layersVisible, showSubstationLayer, showSavrLayer])

  // ================================================================
  // Drop mode
  // ================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleClick = (e) => {
      if (!dropMode) return
      const { lng, lat } = e.lngLat
      if (dropMarkerRef.current) dropMarkerRef.current.remove()
      const marker = new maplibregl.Marker({ color: surveyConfig?.color || '#2563eb', scale: 1.2 })
        .setLngLat([lng, lat])
        .addTo(map)
      dropMarkerRef.current = marker
      if (onMapClick) onMapClick({ lng, lat })
    }

    map.on('click', handleClick)
    map.getCanvas().style.cursor = dropMode ? 'crosshair' : ''
    return () => {
      map.off('click', handleClick)
      map.getCanvas().style.cursor = ''
    }
  }, [dropMode, onMapClick, surveyConfig])

  // ================================================================
  // Point click — fetch details, show popup
  // ================================================================
  async function handlePointClick(e, map) {
    const feature = e.features?.[0]
    if (!feature) return
    // `geometry_id` on the tile is the *geometry* id, not the survey record id.
    const { geometry_id: geometryId, qa_status, table_name } = feature.properties
    const coords = feature.geometry.coordinates

    const endpoint = ENDPOINT_BY_TABLE[table_name] || ''

    const popupContent = document.createElement('div')
    popupContent.className = 'p-3'
    popupContent.innerHTML = `
      <div class="space-y-2 min-w-[200px]">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-500 uppercase">${
            surveyConfigRef.current?.attachToPole && table_name === (surveyConfigRef.current?.mapTableName || 'tbl_savr')
              ? 'Pole'
              : (table_name?.replace('tbl_', '') || 'Survey')
          }</span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${QA_COLORS[qa_status] || '#3b82f6'}"></span>
            <span class="text-xs text-gray-600">${qa_status || 'Unknown'}</span>
          </span>
        </div>
        <div id="popup-loading" class="text-sm text-gray-400">Loading details...</div>
      </div>
    `

    const popup = new maplibregl.Popup({ maxWidth: '320px', offset: 10 })
      .setLngLat(coords)
      .setDOMContent(popupContent)
      .addTo(map)

    const loadingEl = popupContent.querySelector('#popup-loading')
    let record = null
    try {
      if (endpoint && geometryId) {
        record = await surveyApi.findByGeometryId(endpoint, geometryId, {
          ba_id: baIdRef.current,
          cycle: filtersRef.current?.cycle,
        })
        if (!record) {
          loadingEl.outerHTML = `<p class="text-sm text-gray-500">No survey record has been filled in for this point yet.</p>`
          return
        }
        let summaryItems = []
        const labelMap = {
          tiang_no: 'Pole No', name: 'Name',
          // FFW is the only type carrying a house number, so the key is absent
          // elsewhere and the row simply does not appear.
          house_no: 'House No',
          ...(endpoint === 'feeder-pillar' ? {} : { feeder_involved: 'Feeder' }),
          area: 'PE Name/Street Name',
          fl: 'FL', voltage: 'Voltage', size: 'Size', type: 'Type',
        }
        for (const [key, label] of Object.entries(labelMap)) {
          if (record[key]) summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">${label}</span><span class="text-gray-900 font-medium">${record[key]}</span></div>`)
        }
        if (record.total_defects != null) {
          summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">Defects</span><span class="font-medium ${record.total_defects > 0 ? 'text-orange-600' : 'text-green-600'}">${record.total_defects}</span></div>`)
        }
        const imgCount = record.images?.length || 0
        if (imgCount > 0) summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">Images</span><span class="text-gray-900 font-medium">${imgCount}</span></div>`)

        // The host page opens records of its own type (SurveyModule) or routes
        // by table (Map Overview); a context-layer point belongs to neither, so
        // it gets the summary without a button that would 404.
        // Height clearance paints SAVR poles: clicking a pole opens the HC form.
        const cfg = surveyConfigRef.current
        const poleTable = cfg?.mapTableName || 'tbl_savr'
        const attachToThisPole = Boolean(cfg?.attachToPole) && table_name === poleTable
        const ownsRecord = !cfg?.tableName || cfg.tableName === table_name || attachToThisPole
        const canOpen = ownsRecord && onPointSelectRef.current
        const actionLabel = attachToThisPole ? 'Open Height Clearance' : 'View Full Details'
        loadingEl.outerHTML = `<div class="space-y-1.5">${summaryItems.join('')}</div>` + (canOpen
          ? `<button id="popup-view-${record.id}" class="btn-primary btn-sm w-full mt-3">${actionLabel}</button>`
          : ownsRecord
            ? ''
            : `<p class="text-xs text-gray-400 mt-3">Open the Substation module to edit this record.</p>`)
      } else {
        loadingEl.outerHTML = `<p class="text-sm text-gray-500">ID: ${geometryId?.substring(0, 8)}...</p>`
      }
    } catch {
      loadingEl.outerHTML = `<p class="text-sm text-red-400">Failed to load details</p>`
    }

    const btn = record && popupContent.querySelector(`#popup-view-${record.id}`)
    if (btn) {
      btn.addEventListener('click', () => {
        if (onPointSelectRef.current) {
          onPointSelectRef.current({
            record_id: record.id,
            geometry_id: geometryId,
            qa_status,
            table_name,
            lng: coords[0],
            lat: coords[1],
          })
        }
        popup.remove()
      })
    }
  }

  function handleWorkpackageClick(e, map) {
    const feature = e.features?.[0]
    if (!feature) return
    const { id, package_name, ba_short_name, zone, wp_status } = feature.properties || {}
    const coords = e.lngLat
    const popupContent = document.createElement('div')
    popupContent.className = 'p-3'
    const rows = [
      ['Package', package_name || id?.substring(0, 8)],
      ba_short_name ? ['BA', ba_short_name] : null,
      zone ? ['Zone', zone] : null,
      wp_status ? ['Status', wp_status] : null,
    ].filter(Boolean)
    popupContent.innerHTML = `
      <div class="space-y-1.5 min-w-[180px]">
        <p class="text-xs font-semibold text-amber-700 uppercase">Work Package</p>
        ${rows.map(([label, val]) => `<div class="flex justify-between text-xs gap-3"><span class="text-gray-500">${label}</span><span class="text-gray-900 font-medium">${val}</span></div>`).join('')}
        ${id && onWorkpackageClickRef.current ? `<button id="wp-filter-${id}" class="btn-primary btn-sm w-full mt-2">Show records in package</button>` : ''}
      </div>
    `
    const popup = new maplibregl.Popup({ maxWidth: '280px', offset: 8 })
      .setLngLat(coords)
      .setDOMContent(popupContent)
      .addTo(map)
    const btn = id && popupContent.querySelector(`#wp-filter-${id}`)
    if (btn) {
      btn.addEventListener('click', () => {
        onWorkpackageClickRef.current?.(id)
        popup.remove()
      })
    }
  }

  const heightStyle = typeof height === 'string' ? height : `${height}px`

  return (
    <div className="relative h-full" style={{ height: heightStyle }}>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />

      {/* Base layer switcher */}
      <div className="absolute top-3 left-3 bg-white rounded-lg shadow-md p-1 flex gap-1 z-10">
        <button onClick={() => setBaseStyle('satellite')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${baseStyle === 'satellite' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          Satellite
        </button>
        <button onClick={() => setBaseStyle('street')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${baseStyle === 'street' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          Street
        </button>
      </div>

      {/* Layer toggles */}
      <div className="absolute top-3 right-14 bg-white rounded-lg shadow-md p-3 z-10 space-y-1.5 min-w-[140px]">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Layers</p>
        {[
          { key: 'survey', label: surveyConfig?.mapLayerLabel || `${surveyConfig?.title || 'Survey'} Points` },
          { key: 'ba', label: 'BA Boundaries' },
          { key: 'wp', label: 'Work Packages' },
          ...(showSubstationLayer ? [{ key: 'substation', label: 'Substations' }] : []),
          ...(showSavrLayer ? [{ key: 'savr', label: 'Poles (reference)' }] : []),
        ].map((layer) => (
          <label key={layer.key} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={layersVisible[layer.key]}
              onChange={(e) => setLayersVisible((prev) => ({ ...prev, [layer.key]: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-xs text-gray-700">{layer.label}</span>
          </label>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-3 bg-white rounded-lg shadow-md p-3 z-10">
        <button onClick={() => setLegendOpen(!legendOpen)}
          className="flex items-center justify-between w-full gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase">Legend</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${legendOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {legendOpen && (
          <div className="space-y-1.5 mt-2">
            {[
              { label: 'Accepted', color: QA_COLORS.Accept },
              { label: 'Pending', color: QA_COLORS.Pending },
              { label: 'Rejected', color: QA_COLORS.Reject },
              { label: 'Unsurveyed', color: QA_COLORS.None },
              ...(showSavrLayer && layersVisible.savr
                ? [{ label: 'Pole (reference)', color: SAVR_COLOR }]
                : []),
              ...(showSubstationLayer && layersVisible.substation
                ? [{ label: 'Substation', color: SUBSTATION_COLOR }]
                : []),
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                <span className="text-xs text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drop mode indicator */}
      {dropMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
            Click on the map to set location
          </div>
        </div>
      )}
    </div>
  )
}
