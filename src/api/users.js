import client from './client'

// GET /users accepts only: page, page_size, ba_id, is_active
const LIST_PARAMS = ['page', 'page_size', 'ba_id', 'is_active']
const MAX_PAGE_SIZE = 100 // server rejects anything larger with a 422

function pickParams(params) {
  const out = {}
  for (const key of LIST_PARAMS) {
    const val = params[key]
    if (val !== undefined && val !== null && val !== '') out[key] = val
  }
  if (out.page_size) out.page_size = Math.min(Number(out.page_size), MAX_PAGE_SIZE)
  return out
}

export const userApi = {
  /** Returns the raw `{ items, pagination }` envelope. */
  listPaged: async (params = {}) => {
    const { data } = await client.get('/users', { params: pickParams(params) })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  list: async (params = {}) => {
    const data = await userApi.listPaged(params)
    return data.items || []
  },

  get: async (id) => {
    const { data } = await client.get(`/users/${id}`)
    return data
  },

  create: async (payload) => {
    const { data } = await client.post('/users', payload)
    return data
  },

  update: async (id, payload) => {
    const { data } = await client.put(`/users/${id}`, payload)
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/users/${id}`)
    return data
  },

  /** The endpoint takes a bare JSON array of role names. */
  assignRoles: async (id, roleNames) => {
    const { data } = await client.post(`/users/${id}/roles`, roleNames)
    return data
  },

  listBAs: async () => {
    const { data } = await client.get('/users/bas')
    return Array.isArray(data) ? data : data.items || []
  },

  listRoles: async () => {
    const { data } = await client.get('/users/roles')
    return Array.isArray(data) ? data : data.items || []
  },
}
