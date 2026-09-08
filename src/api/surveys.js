import client from './client'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

/**
 * Survey endpoints are mounted at the API root — e.g. `/api/v1/substation`,
 * `/api/v1/feeder-pillar` — not under a `/surveys` prefix.
 *
 * Query params accepted by every list endpoint:
 *   page, page_size, ba_id, cycle, qa_status, created_by, workpackage_id,
 *   savr_id, updated_after, updated_before, search, defects, defects_match
 * `search` is a case-insensitive substring match on device_id (sub_0019,
 * savr_003, ...) and the record's other text columns. `defects` is a
 * comma-separated list of defect column names; `defects_match` is 'any'
 * (default) or 'all'. Anything else is ignored by the server.
 */
const LIST_PARAMS = [
  'page', 'page_size', 'ba_id', 'cycle', 'qa_status', 'created_by',
  'workpackage_id', 'savr_id', 'updated_after', 'updated_before', 'search',
  'defects', 'defects_match',
]
const MAX_PAGE_SIZE = 1000 // server rejects anything larger with a 422

function pickListParams(params) {
  const out = {}
  for (const key of LIST_PARAMS) {
    const val = params[key]
    if (val !== undefined && val !== null && val !== '') out[key] = val
  }
  if (out.page_size) out.page_size = Math.min(Number(out.page_size), MAX_PAGE_SIZE)
  return out
}

export const surveyApi = {
  list: async (endpoint, params = {}) => {
    const { data } = await client.get(`/${endpoint}`, { params: pickListParams(params) })
    return data
  },

  get: async (endpoint, id) => {
    const { data } = await client.get(`/${endpoint}/${id}`)
    return data
  },

  create: async (endpoint, payload) => {
    const { data } = await client.post(`/${endpoint}`, payload)
    return data
  },

  update: async (endpoint, id, payload) => {
    const { data } = await client.put(`/${endpoint}/${id}`, payload)
    return data
  },

  delete: async (endpoint, id) => {
    const { data } = await client.delete(`/${endpoint}/${id}`)
    return data
  },

  qaAction: async (endpoint, id, action, rejectRemarks = null) => {
    const { data } = await client.patch(`/${endpoint}/${id}/qa`, {
      action,
      reject_remarks: rejectRemarks,
    })
    return data
  },

  uploadImage: async (endpoint, id, file, imageType = 'other', imageLabel = null, cycle = null) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('image_type', imageType)
    if (imageLabel) formData.append('image_label', imageLabel)
    if (cycle) formData.append('cycle', cycle)
    const { data } = await client.post(
      `/${endpoint}/${id}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  listImages: async (endpoint, id) => {
    const { data } = await client.get(`/${endpoint}/${id}/images`)
    return Array.isArray(data) ? data : data.items || []
  },

  /**
   * Map tiles publish the *geometry* id as `geometry_id`, but survey records are
   * fetched by their own id. There is no server-side lookup by geometry_id, so
   * page through the list and match locally. Results are cached per endpoint.
   */
  findByGeometryId: async (endpoint, geometryId, params = {}) => {
    const pageSize = 200
    for (let page = 1; page <= 25; page++) {
      const data = await surveyApi.list(endpoint, { ...params, page, page_size: pageSize })
      const items = data.items || []
      const match = items.find((r) => r.geometry_id === geometryId)
      if (match) return match
      if (!data.pagination?.has_next) break
    }
    return null
  },

  /**
   * Child surveys (height clearance / FFW) hang off a parent pole.
   * List is newest-first, so the first hit is the current cycle's latest row.
   *
   * Arus is NOT one of these. A leakage reading is not a survey, has no row in
   * any list endpoint and no qa_status of its own — use `arusApi` below.
   */
  findBySavrId: async (endpoint, savrId, params = {}) => {
    const data = await surveyApi.list(endpoint, {
      ...params,
      savr_id: savrId,
      page: 1,
      page_size: 50,
    })
    const items = data.items || []
    return items[0] || null
  },

  tileUrl: (layer, z, x, y, params = {}) => {
    const clean = {}
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    }
    const base = `${API_URL}/tiles/${layer}/${z}/${x}/${y}.pbf`
    const query = new URLSearchParams(clean).toString()
    return query ? `${base}?${query}` : base
  },

    dashboard: async (type) => {
    const { data } = await client.get(`/dashboard/${type}-counts`)
    return data.data || []
  },

  summary: async () => {
    const { data } = await client.get('/dashboard/summary')
    return data.data || {}
  },

  overview: async (params = {}) => {
    const query = {}
    for (const key of ['ba_id', 'updated_after', 'updated_before']) {
      if (params[key]) query[key] = params[key]
    }
    const { data } = await client.get('/dashboard/overview', { params: query })
    return data.data || data
  },
}

/**
 * Leakage-current readings on a pole (tbl_arus).
 *
 * Child rows of a SAVR record, not a survey type: no geometry, no cycle, no QA
 * status of their own — a reading inherits all of that from its pole. There is
 * no `/arus` collection and no `/geometry/arus`; both return 404. Every route is
 * nested under the pole or a single reading.
 *
 * `GET /savr/{id}` already embeds `arus`, `arus_count` and `arus_leaking_count`,
 * so loading a pole form needs no call from here — `list` is for refreshing the
 * set on its own, e.g. to show `inherited_qa_status`.
 */
export const arusApi = {
  list: async (savrId) => {
    const { data } = await client.get(`/savr/${savrId}/arus`)
    return data
  },

  add: async (savrId, { reading = null, leakage_current = false } = {}) => {
    const { data } = await client.post(`/savr/${savrId}/arus`, { reading, leakage_current })
    return data
  },

  /**
   * Save the pole's whole set of readings in one call — how the form saves.
   *
   * The server reconciles BY ID: an item carrying a known `id` is updated in
   * place, one without an `id` is added, and any reading the pole has that is
   * absent from `items` is soft-deleted.
   *
   * **Send the `id` of every row the user kept.** `survey_images` points at arus
   * rows by id with no foreign key behind it, so a row that arrives without its
   * id is created as a different row and the photos already attached to the old
   * one are orphaned — still on the server, attached to nothing, and beyond
   * reach of the app. Dropping ids and resending everything as new is the one
   * way to lose evidence here, and it fails silently.
   *
   * `{ items: [] }` clears every reading. One bad id fails the whole call with
   * 400 and changes nothing, so the form cannot end up half-saved.
   *
   * Returns the reconciled set plus `updated` / `added` / `removed` counts.
   */
  replace: async (savrId, items) => {
    const { data } = await client.put(`/savr/${savrId}/arus`, {
      items: items.map((row) => ({
        // Only send `id` when there is one — `id: null` would be a new row too,
        // but being explicit keeps the payload honest about intent.
        ...(row.id ? { id: row.id } : {}),
        reading: row.reading ?? null,
        leakage_current: Boolean(row.leakage_current),
      })),
    })
    return data
  },

  update: async (arusId, { reading = null, leakage_current = false } = {}) => {
    const { data } = await client.put(`/arus/${arusId}`, { reading, leakage_current })
    return data
  },

  remove: async (arusId) => {
    const { data } = await client.delete(`/arus/${arusId}`)
    return data
  },

  /** Photos belong to a reading, so `arusId` here — never the pole's id. */
  uploadImage: async (arusId, file, imageType = 'eqp_reading') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('image_type', imageType)
    const { data } = await client.post(`/arus/${arusId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  listImages: async (arusId) => {
    const { data } = await client.get(`/arus/${arusId}/images`)
    return data.images || []
  },

  /**
   * Photos for a set of readings, shaped for the form:
   *   { [arusId]: { [image_type]: { id, url } } }
   *
   * Uses the per-reading route rather than `GET /images?point_ids=`: a server
   * that predates `point_ids` would ignore it and answer with every tbl_arus
   * photo instead of the ones asked for. A pole holds a handful of readings, so
   * the requests are small and go out together.
   *
   * Keeps the first photo per slot — a slot shows one image, and a re-upload
   * leaves the older row behind until it is deleted.
   */
  imagesFor: async (arusIds) => {
    const ids = [...new Set((arusIds || []).filter(Boolean))]
    if (ids.length === 0) return {}
    const results = await Promise.all(ids.map((id) =>
      arusApi.listImages(id).then((images) => [id, images]).catch(() => [id, []])
    ))
    const out = {}
    for (const [id, images] of results) {
      const slot = (out[id] = {})
      for (const img of images) {
        if (!slot[img.image_type]) slot[img.image_type] = { id: img.id, url: img.image_url }
      }
    }
    return out
  },
}

/**
 * The two ends of a height-clearance span.
 *
 * A span runs between two assets, and either end may be a pole, link box, cable
 * bridge or feeder pillar — so the reference is polymorphic: an id is meaningless
 * without the type that says which table to look it up in. `from_id`/`from_type`
 * and `to_id`/`to_type` must always travel together; the API rejects one without
 * the other.
 */
export const assetLinkApi = {
  /** Assets near a coordinate, nearest first — the list behind the From / To pickers. */
  nearby: async ({ latitude, longitude, radiusM = 500, limit = 50, assetType } = {}) => {
    if (latitude == null || longitude == null) return []
    const params = { latitude, longitude, radius_m: radiusM, limit }
    if (assetType) params.asset_type = assetType
    const { data } = await client.get('/height-clearance/nearby-assets', { params })
    return data.items || []
  },

  /**
   * Both ends resolved, with the distance between them.
   *
   * Used to label a stored selection: an asset already chosen may sit outside the
   * search radius, so the picker would otherwise show a blank for a value that is
   * perfectly valid. Also reports `exists: false` for an asset since deleted —
   * nothing enforces a polymorphic reference, so that really happens.
   */
  span: async (heightClearanceId) => {
    const { data } = await client.get(`/height-clearance/${heightClearanceId}/span`)
    return data
  },
}

/**
 * Geometry points are created before the survey record and referenced by
 * `geometry_id`. Each survey type has its own geometry collection, and the
 * endpoint slug matches the survey slug (e.g. `feeder-pillar`).
 */
export const geometryApi = {
  create: async (endpoint, latitude, longitude, baId = null, extra = {}) => {
    const params = { latitude, longitude }
    if (baId) params.ba_id = baId
    if (extra.cycle) params.cycle = extra.cycle
    if (extra.workpackageId) params.workpackage_id = extra.workpackageId
    if (extra.savrId) params.savr_id = extra.savrId
    const { data } = await client.post(`/geometry/${endpoint}`, null, { params })
    return data
  },

  get: async (endpoint, geometryId) => {
    const { data } = await client.get(`/geometry/${endpoint}/${geometryId}`)
    return data
  },

  update: async (endpoint, geometryId, latitude, longitude) => {
    const params = { latitude, longitude }
    const { data } = await client.put(`/geometry/${endpoint}/${geometryId}`, null, { params })
    return data
  },

  delete: async (endpoint, geometryId) => {
    const { data } = await client.delete(`/geometry/${endpoint}/${geometryId}`)
    return data
  },

  list: async (endpoint, params = {}) => {
    const { data } = await client.get(`/geometry/${endpoint}`, { params })
    return data
  },

  /**
   * Geometry-only drop. Prefer POST /geometry/{type}, which creates the survey
   * row in the same transaction and persists the work package. If you use this
   * route, send workpackage_id back with the survey create — this call cannot
   * store it.
   */
  dropPoint: async (latitude, longitude, tableName, baId = null) => {
    const params = { latitude, longitude, table_name: tableName }
    if (baId) params.ba_id = baId
    const { data } = await client.post('/tiles/survey/drop-point', null, { params })
    return data
  },
}
