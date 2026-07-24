import client from './client'

export const userApi = {
  list: async (params = {}) => {
    const { data } = await client.get('/users', { params })
    return Array.isArray(data) ? data : data.items || []
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

  assignRoles: async (id, roleNames) => {
    const { data } = await client.post(`/users/${id}/roles`, { role_names: roleNames })
    return data
  },

  listBAs: async () => {
    const { data } = await client.get('/users/bas')
    return data
  },

  listRoles: async () => {
    const { data } = await client.get('/users/roles')
    return data
  },

  listTeams: async () => {
    const { data } = await client.get('/users/teams')
    return data
  },
}
