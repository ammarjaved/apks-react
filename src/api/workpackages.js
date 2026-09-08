import client from './client'

/**
 * Work packages. List params: page, page_size, ba_id, zone, wp_status, search
 */
export const workPackageApi = {
  listPaged: async (params = {}) => {
    const { data } = await client.get('/workpackages', { params })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  list: async (params = {}) => {
    const data = await workPackageApi.listPaged(params)
    return data.items || []
  },

  get: async (id, includeGeom = false) => {
    const params = includeGeom ? { include_geom: true } : {}
    const { data } = await client.get(`/workpackages/${id}`, { params })
    return data
  },

  /**
   * Same spatial lookup drop-point runs, without writing a row.
   * `matched: false` is a valid 200 — the point is outside every package polygon.
   */
  atPoint: async (latitude, longitude) => {
    const { data } = await client.get('/workpackages/at-point', {
      params: { latitude, longitude },
    })
    return data
  },

  create: async (payload) => {
    const { data } = await client.post('/workpackages', payload)
    return data
  },

  update: async (id, payload) => {
    const { data } = await client.put(`/workpackages/${id}`, payload)
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/workpackages/${id}`)
    return data
  },
}
