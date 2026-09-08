import client from './client'

/**
 * Server-driven lookup values. These replace the option lists that used to be
 * hard-coded in the frontend, so QA statuses, survey types and image types stay
 * in sync with the backend.
 */

let enumsCache = null
let imageTypeCache = new Map()

export const lookupApi = {
  /**
   * `{ survey_types, qa_status, progress_status, log_operations, notification_types }`
   * — each an array of `{ value, label }`.
   */
  enums: async () => {
    if (enumsCache) return enumsCache
    const { data } = await client.get('/enums')
    enumsCache = data
    return data
  },

  qaStatuses: async () => (await lookupApi.enums()).qa_status || [],

  surveyTypes: async () => (await lookupApi.enums()).survey_types || [],

  /** All image types: `{ code, label, is_active }`. */
  imageTypes: async (params = {}) => {
    const { data } = await client.get('/image-types', { params })
    return Array.isArray(data) ? data : data.items || []
  },

  /** Image types valid for one survey table, e.g. `tbl_substation`. */
  imageTypesForSurvey: async (tableName) => {
    if (imageTypeCache.has(tableName)) return imageTypeCache.get(tableName)
    const { data } = await client.get(`/image-types/by-survey/${tableName}`)
    const list = Array.isArray(data) ? data : data.items || []
    imageTypeCache.set(tableName, list)
    return list
  },

  /** Business areas with full detail (paginated; page_size caps at 200). */
  listBA: async (params = {}) => {
    const query = { ...params }
    if (query.page_size) query.page_size = Math.min(Number(query.page_size), 200)
    const { data } = await client.get('/ba', { params: query })
    return Array.isArray(data) ? { items: data, pagination: null } : data
  },

  getBA: async (id) => {
    const { data } = await client.get(`/ba/${id}`)
    return data
  },

  /** Latest mobile app release: `{ version, apk_url, is_mandatory }`. */
  version: async () => {
    const { data } = await client.get('/version')
    return data
  },

  clearCache: () => {
    enumsCache = null
    imageTypeCache = new Map()
  },
}
