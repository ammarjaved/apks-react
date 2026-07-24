import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { surveyApi } from '../../api/surveys'

const TILE_BASE = import.meta.env.VITE_TILE_URL || '/api/v1/tiles'
const TILE_SERVER = 'http://localhost:8070/api/v1/tiles'

const QA_COLORS = {
  Accept: '#22c55e',
  Reject: '#ef4444',
  Pending: '#eab308',
  None: '#9ca3af',
}

const GLYPHS_URL = 'https://fonts.openmaptiles.org/fonts/{fontstack}/{range}.pbf'

function buildStyle(surveyTileUrl, baTileUrl, roadsTileUrl) {
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
        promoteId: 'point_id',
      },
      'ba-boundaries': {
        type: 'vector',
        tiles: [baTileUrl],
        tileSize: 512,
      },
      'roads': {
        type: 'vector',
        tiles: [roadsTileUrl],
        tileSize: 512,
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
      // Roads
      {
        id: 'survey-roads', type: 'line', source: 'roads', 'source-layer': 'roads',
        paint: { 'line-color': '#f59e0b', 'line-width': 1.5, 'line-opacity': 0.7 },
        layout: { visibility: 'none' },
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
  initialCenter = [101.55, 3.05],
  initialZoom = 10,
  height = 500,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const dropMarkerRef = useRef(null)
  const [baseStyle, setBaseStyle] = useState('satellite')
  const [layersVisible, setLayersVisible] = useState({ survey: true, ba: true, roads: false })
  const [legendOpen, setLegendOpen] = useState(true)

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
    if (surveyConfig?.tableName) params.table_name = surveyConfig.tableName
    if (filters.cycle) params.cycle = filters.cycle
    if (filters.qa_status) params.qa_status = filters.qa_status
    if (baId) params.ba_id = baId
    return `${TILE_SERVER}/survey/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  const getBaTileUrl = () => {
    const params = {}
    if (baId) params.ba_id = baId
    return `${TILE_SERVER}/ba/{z}/{x}/{y}.pbf${buildQueryString(params)}`
  }

  // ================================================================
  // Initialize map once — style includes ALL sources and layers
  // ================================================================
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    // Clear any leftover maplibre internals from StrictMode double-mount
    el.innerHTML = ''

    const style = buildStyle(
      getSurveyTileUrl(),
      getBaTileUrl(),
      `${TILE_SERVER}/roads/{z}/{x}/{y}.pbf`
    )

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
      if (dropMode || !e.features?.[0]) return
      handlePointClick(e, map)
    })

    map.on('mouseenter', 'survey-points', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'survey-points', () => { if (!dropMode) map.getCanvas().style.cursor = '' })

    return () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyConfig?.tableName, filters, baId])

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
    if (!map || !map.isStyleLoaded()) return
    const map2 = { survey: 'survey-points', ba: 'survey-ba', roads: 'survey-roads' }
    Object.entries(layersVisible).forEach(([k, visible]) => {
      const layerId = map2[k]
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
      }
      if (k === 'ba' && map.getLayer('survey-ba-fill')) {
        map.setLayoutProperty('survey-ba-fill', 'visibility', visible ? 'visible' : 'none')
      }
    })
  }, [layersVisible])

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
    const { point_id, qa_status, table_name } = feature.properties
    const coords = feature.geometry.coordinates

    const endpointMap = {
      'tbl_savr': 'savr', 'tbl_substation': 'substation', 'tbl_feeder_pillar': 'feeder-pillar',
      'tbl_link_box': 'link-box', 'tbl_cable_bridge': 'cable-bridge',
    }
    const endpoint = endpointMap[table_name] || ''

    const popupContent = document.createElement('div')
    popupContent.className = 'p-3'
    popupContent.innerHTML = `
      <div class="space-y-2 min-w-[200px]">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-500 uppercase">${table_name?.replace('tbl_', '') || 'Survey'}</span>
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
    try {
      if (endpoint && point_id) {
        const record = await surveyApi.get(endpoint, point_id)
        let summaryItems = []
        const labelMap = {
          tiang_no: 'Pole No', name: 'Name', feeder_involved: 'Feeder', area: 'Area',
          fl: 'FL', voltage: 'Voltage', size: 'Size', type: 'Type',
        }
        for (const [key, label] of Object.entries(labelMap)) {
          if (record[key]) summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">${label}</span><span class="text-gray-900 font-medium">${record[key]}</span></div>`)
        }
        if (record.total_defects != null) {
          summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">Defects</span><span class="font-medium ${record.total_defects > 0 ? 'text-orange-600' : 'text-green-600'}">${record.total_defects}</span></div>`)
        }
        const imgCount = (record.images?.length || 0) + Object.entries(record).filter(([k, v]) => k.includes('image') && v && typeof v === 'string').length
        if (imgCount > 0) summaryItems.push(`<div class="flex justify-between text-xs"><span class="text-gray-500">Images</span><span class="text-gray-900 font-medium">${imgCount}</span></div>`)

        loadingEl.outerHTML = `<div class="space-y-1.5">${summaryItems.join('')}</div>
          <button id="popup-view-${point_id}" class="btn-primary btn-sm w-full mt-3">View Full Details</button>`
      } else {
        loadingEl.outerHTML = `<p class="text-sm text-gray-500">ID: ${point_id?.substring(0, 8)}...</p>`
      }
    } catch {
      loadingEl.outerHTML = `<p class="text-sm text-red-400">Failed to load details</p>`
    }

    const btn = popupContent.querySelector(`#popup-view-${point_id}`)
    if (btn) {
      btn.addEventListener('click', () => {
        if (onPointSelect) onPointSelect({ point_id, qa_status, table_name, lng: coords[0], lat: coords[1] })
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
          { key: 'survey', label: `${surveyConfig?.title || 'Survey'} Points` },
          { key: 'ba', label: 'BA Boundaries' },
          { key: 'roads', label: 'Roads' },
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
