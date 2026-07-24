import client from './client'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const surveyApi = {
  list: async (endpoint, params = {}) => {
    const { data } = await client.get(`/surveys/${endpoint}`, { params })
    return data
  },

  get: async (endpoint, id) => {
    const { data } = await client.get(`/surveys/${endpoint}/${id}`)
    return data
  },

  create: async (endpoint, payload) => {
    const { data } = await client.post(`/surveys/${endpoint}`, payload)
    return data
  },

  update: async (endpoint, id, payload) => {
    const { data } = await client.put(`/surveys/${endpoint}/${id}`, payload)
    return data
  },

  delete: async (endpoint, id) => {
    const { data } = await client.delete(`/surveys/${endpoint}/${id}`)
    return data
  },

  qaAction: async (endpoint, id, action, rejectRemarks = null) => {
    const { data } = await client.patch(`/surveys/${endpoint}/${id}/qa`, {
      action,
      reject_remarks: rejectRemarks,
    })
    return data
  },

  uploadImage: async (endpoint, id, file, imageType = 'general', imageLabel = null, cycle = null) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('image_type', imageType)
    if (imageLabel) formData.append('image_label', imageLabel)
    if (cycle) formData.append('cycle', cycle)
    const { data } = await client.post(
      `/surveys/${endpoint}/${id}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  dropPoint: async (latitude, longitude, tableName, baId = null) => {
    const params = { latitude, longitude, table_name: tableName }
    if (baId) params.ba_id = baId
    const { data } = await client.post('/tiles/survey/drop-point', null, { params })
    return data
  },

  tileUrl: (layer, z, x, y, params = {}) => {
    const base = `${API_URL}/tiles/${layer}/${z}/${x}/${y}.pbf`
    const query = new URLSearchParams(params).toString()
    return query ? `${base}?${query}` : base
  },

  dashboard: async (type) => {
    const { data } = await client.get(`/dashboard/${type}-counts`)
    return data
  },

  summary: async () => {
    const { data } = await client.get('/dashboard/summary')
    return data
  },
}
