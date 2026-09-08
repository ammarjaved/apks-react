import client from './client'

/**
 * Survey cycles — a cycle scopes records to a BA + survey table + date window.
 * List params: page, page_size, ba_id, table_name, cycle, current
 */
export const cycleApi = {
  listPaged: async (params = {}) => {
    const { data } = await client.get('/cycles', { params })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  list: async (params = {}) => {
    const data = await cycleApi.listPaged(params)
    return data.items || []
  },

  get: async (id) => {
    const { data } = await client.get(`/cycles/${id}`)
    return data
  },

  create: async (payload) => {
    const { data } = await client.post('/cycles', payload)
    return data
  },

  update: async (id, payload) => {
    const { data } = await client.put(`/cycles/${id}`, payload)
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/cycles/${id}`)
    return data
  },

  /** Cycle numbers available for a survey table, newest first. */
  numbersFor: async (tableName, baId = null) => {
    const params = { table_name: tableName, page_size: 100 }
    if (baId) params.ba_id = baId
    const items = await cycleApi.list(params)
    return [...new Set(items.map((c) => c.cycle))].sort((a, b) => b - a)
  },
}
