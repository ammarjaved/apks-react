import client from './client'

/**
 * Patrol runs (`/api/v1/patroling`).
 *
 * The route is uploaded as a KML rather than pinned on the map, so create and
 * update are multipart: the same request carries the KML, the two odometer
 * photos and the form fields. Everything else is ordinary JSON.
 */

const FIELDS = [
  'cycle', 'wp_name', 'ba', 'zone', 'km',
  // Where the run began and ended, typed in as "lat, lng"; the map draws them
  // as the labelled Start / End markers on the route.
  'start_xy', 'end_xy',
  'reading_start', 'reading_end', 'vist_date', 'day_night', 'notice_given',
]

const LIST_PARAMS = [
  'page', 'page_size', 'cycle', 'wp_name', 'ba', 'zone',
  'qa_status', 'date_from', 'date_to', 'search',
]

function pick(params, allowed) {
  const out = {}
  for (const key of allowed) {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}

/**
 * Build the multipart body. Blank fields are dropped rather than sent empty:
 * the API treats a missing part as "leave this alone", which is what an
 * untouched input means on the edit form.
 */
function toFormData({ file, imageStart, imageEnd, ...fields }) {
  const body = new FormData()
  if (file) body.append('file', file)
  if (imageStart) body.append('image_reading_start', imageStart)
  if (imageEnd) body.append('image_reading_end', imageEnd)
  for (const [key, value] of Object.entries(pick(fields, FIELDS))) {
    body.append(key, value)
  }
  return body
}

export const patrolingApi = {
  list: async (params = {}) => {
    const { data } = await client.get('/patroling', { params: pick(params, LIST_PARAMS) })
    return data
  },

  /** One FeatureCollection of every route matching the same filters as the table. */
  geojson: async (params = {}) => {
    const { data } = await client.get('/patroling/geojson', {
      params: { ...pick(params, LIST_PARAMS), limit: params.limit || 500 },
    })
    return data
  },

  /** One run, including `geometry` (GeoJSON) and `bounds` to zoom to. */
  get: async (id) => {
    const { data } = await client.get(`/patroling/${id}`)
    return data
  },

  create: async (payload) => {
    const { data } = await client.post('/patroling', toFormData(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  update: async (id, payload) => {
    const { data } = await client.put(`/patroling/${id}`, toFormData(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  qaAction: async (id, action, rejectRemarks = null) => {
    const body = new FormData()
    body.append('action', action)
    if (rejectRemarks) body.append('reject_remarks', rejectRemarks)
    const { data } = await client.patch(`/patroling/${id}/qa`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/patroling/${id}`)
    return data
  },
}
