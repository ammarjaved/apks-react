import client from './client'

/**
 * Admin productivity module — per-person work totals over a date window.
 *
 * Surveyor totals count records by updated_by/updated_at; QC totals count QA
 * decisions by qc_by/qc_at. The server defaults from_date/to_date to today.
 */
export const productivityApi = {
  summary: async (params = {}) => {
    const query = {}
    for (const key of ['from_date', 'to_date', 'ba_id', 'asset', 'surveyor_id', 'qc_id']) {
      if (params[key]) query[key] = params[key]
    }
    const { data } = await client.get('/productivity/summary', { params: query })
    return data.data || data
  },
}
