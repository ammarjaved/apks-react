import client from './client'

export const teamApi = {
  list: async (params = {}) => {
    const { data } = await client.get('/teams', { params })
    return Array.isArray(data) ? data : data.items || []
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
