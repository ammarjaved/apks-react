import client from './client'

// GET /teams accepts only: page, page_size, ba_id, is_active
const LIST_PARAMS = ['page', 'page_size', 'ba_id', 'is_active']
const MAX_PAGE_SIZE = 200 // server rejects anything larger with a 422

function pickParams(params) {
  const out = {}
  for (const key of LIST_PARAMS) {
    const val = params[key]
    if (val !== undefined && val !== null && val !== '') out[key] = val
  }
  if (out.page_size) out.page_size = Math.min(Number(out.page_size), MAX_PAGE_SIZE)
  return out
}

export const teamApi = {
  /** Returns the raw `{ items, pagination }` envelope. */
  listPaged: async (params = {}) => {
    const { data } = await client.get('/teams', { params: pickParams(params) })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  list: async (params = {}) => {
    const data = await teamApi.listPaged(params)
    return data.items || []
  },

  get: async (id) => {
    const { data } = await client.get(`/teams/${id}`)
    return data
  },

  create: async (payload) => {
    const { data } = await client.post('/teams', payload)
    return data
  },

  update: async (id, payload) => {
    const { data } = await client.put(`/teams/${id}`, payload)
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/teams/${id}`)
    return data
  },
}
