import client from './client'

/**
 * Cross-survey image store. Images are keyed by `point_id` (the survey record
 * id) plus `table_name`.
 * List params: page, page_size, point_id, table_name, image_type, cycle
 */
export const imageApi = {
  listPaged: async (params = {}) => {
    const { data } = await client.get('/images', { params })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  list: async (params = {}) => {
    const data = await imageApi.listPaged(params)
    return data.items || []
  },

  get: async (id) => {
    const { data } = await client.get(`/images/${id}`)
    return data
  },

  /** Upload against any survey table without going through the survey route. */
  upload: async ({ file, pointId, tableName, imageType = 'other', imageLabel = null, cycle = null }) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('point_id', pointId)
    formData.append('table_name', tableName)
    formData.append('image_type', imageType)
    if (imageLabel) formData.append('image_label', imageLabel)
    if (cycle) formData.append('cycle', cycle)
    const { data } = await client.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  delete: async (id) => {
    const { data } = await client.delete(`/images/${id}`)
    return data
  },

  /** Move a stored photo to another slot by changing `image_type`. */
  updateType: async (id, imageType) => {
    const { data } = await client.patch(`/images/${id}`, { image_type: imageType })
    return data
  },
}
