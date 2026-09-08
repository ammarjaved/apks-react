import client from './client'

/**
 * QR (Quality Record) exports.
 *
 * Generating a workbook is asynchronous: `generate` queues a job and returns
 * immediately, the server fills the Excel template in the background, and the
 * job flips to `is_ready`. The Download button only appears at that point.
 *
 * Module keys match the survey config keys (`savr`, `feeder_pillar`, …); the
 * server also accepts the hyphenated endpoint slugs.
 */

const STATUS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
}

export const QR_STATUS = STATUS

/** True while the server is still working on this job. */
export function isJobActive(job) {
  return job?.status === STATUS.PENDING || job?.status === STATUS.PROCESSING
}

// /qr/modules is static for the lifetime of the deployment, so fetch it once and
// share the promise between every module page that asks.
let modulesPromise = null

export const qrApi = {
  modules: async () => {
    if (!modulesPromise) {
      modulesPromise = client
        .get('/qr/modules')
        .then(({ data }) => data.modules || [])
        .catch((err) => {
          modulesPromise = null // let the next caller retry
          throw err
        })
    }
    return modulesPromise
  },

  /**
   * Queue a workbook for `moduleKey` using the module page's current filters.
   * Returns the created job (status `Pending`).
   */
  generate: async (moduleKey, filters = {}) => {
    const payload = {}
    for (const key of [
      'ba_id', 'cycle', 'qa_status', 'updated_after', 'updated_before',
      'zone', 'work_package', 'po_number',
    ]) {
      const value = filters[key]
      if (value !== undefined && value !== null && value !== '') payload[key] = value
    }
    if (payload.cycle) payload.cycle = Number(payload.cycle)
    const { data } = await client.post(`/qr/${moduleKey}/generate`, payload)
    return data
  },

  listJobs: async (moduleKey, { page = 1, pageSize = 20 } = {}) => {
    const params = { page, page_size: pageSize }
    if (moduleKey) params.module = moduleKey
    const { data } = await client.get('/qr/jobs', { params })
    return data
  },

  getJob: async (jobId) => {
    const { data } = await client.get(`/qr/jobs/${jobId}`)
    return data
  },

  deleteJob: async (jobId) => {
    const { data } = await client.delete(`/qr/jobs/${jobId}`)
    return data
  },

  /**
   * Fetch the workbook and hand it to the browser as a save.
   *
   * The endpoint is authenticated, so a plain <a href> would 401 — the file has
   * to come through the axios client that carries the bearer token.
   */
  download: async (job) => {
    const response = await client.get(`/qr/jobs/${job.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = job.file_name || `${job.module}_qr.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke on the next tick — Safari cancels the download if the URL dies
    // while the click is still being handled.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}
