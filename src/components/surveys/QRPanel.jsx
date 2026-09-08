import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { qrApi, isJobActive, QR_STATUS } from '../../api/qr'
import { useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../utils/apiError'
import { TableCount } from '../ui/Pagination'

const POLL_INTERVAL_MS = 3000
// Stop polling eventually so a job wedged in Processing does not keep hitting
// the API for the rest of the session.
const POLL_TIMEOUT_MS = 10 * 60 * 1000

// A QR is a signed-off deliverable: only QA-accepted records go in it, whatever
// the table happens to be filtered to. The server enforces the same.
const QA_ACCEPT = 'Accept'

const STATUS_STYLES = {
  [QR_STATUS.PENDING]: { class: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'Queued' },
  [QR_STATUS.PROCESSING]: { class: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse', label: 'Generating' },
  [QR_STATUS.READY]: { class: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'Ready' },
  [QR_STATUS.FAILED]: { class: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Failed' },
}

/**
 * Quality Record generation for one survey module.
 *
 * The user picks the header details, hits Generate, and the server queues a job.
 * While anything is still building the list polls, so the Download button turns
 * up on its own the moment the workbook exists.
 *
 * `filters` mirrors the module table's current filters — cycle, QA status, BA and
 * the From/To date range — so a generated QR holds exactly the rows the user was
 * looking at. Change the scope on the table; this panel only adds the header
 * details that are printed above the sheet.
 */
export default function QRPanel({ config, filters, onBack }) {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [supported, setSupported] = useState(null)
  const [form, setForm] = useState({ work_package: '', po_number: '' })

  const pollStartedAt = useRef(null)

  const moduleKey = config.key
  const setField = (name) => (event) =>
    setForm((prev) => ({ ...prev, [name]: event.target.value }))

  // Only offer generation for modules the server actually has a template for.
  useEffect(() => {
    let cancelled = false
    qrApi
      .modules()
      .then((modules) => {
        if (cancelled) return
        const match = modules.find((m) => m.key === moduleKey || m.slug === moduleKey)
        setSupported(match && match.template_available ? match : false)
      })
      .catch(() => !cancelled && setSupported(false))
    return () => {
      cancelled = true
    }
  }, [moduleKey])

  const fetchJobs = useCallback(async () => {
    try {
      const data = await qrApi.listJobs(moduleKey, { pageSize: 20 })
      setJobs(data.items || [])
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'Failed to load QR exports'))
    } finally {
      setLoading(false)
    }
  }, [moduleKey])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const hasActiveJob = useMemo(() => jobs.some(isJobActive), [jobs])

  useEffect(() => {
    if (!hasActiveJob) {
      pollStartedAt.current = null
      return undefined
    }
    if (pollStartedAt.current === null) pollStartedAt.current = Date.now()

    const timer = setInterval(() => {
      if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
        clearInterval(timer)
        return
      }
      fetchJobs()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [hasActiveJob, fetchJobs])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setNotice('')
    try {
      const job = await qrApi.generate(moduleKey, {
        ...filters,
        qa_status: QA_ACCEPT,
        // Non-admins are pinned to their own BA by the server anyway; sending it
        // keeps the job row descriptive for admins who filtered by BA.
        ba_id: user?.is_admin ? filters.ba_id : user?.ba_id,
        // The panel only contributes the printed header details.
        ...form,
      })
      setJobs((prev) => [job, ...prev])
      setNotice('Generating — the Download button appears when the file is ready.')
    } catch (err) {
      setError(errorMessage(err, 'Failed to start QR generation'))
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async (job) => {
    setDownloadingId(job.id)
    setError('')
    try {
      await qrApi.download(job)
    } catch (err) {
      setError(errorMessage(err, 'Download failed'))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (job) => {
    if (!confirm(`Delete ${job.file_name || 'this QR export'}?`)) return
    try {
      await qrApi.deleteJob(job.id)
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete QR export'))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary btn-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{config.title} — Quality Records</h2>
            <p className="text-xs text-gray-500">
              {supported
                ? `Excel sheets: ${supported.sheets.join(', ')}`
                : 'Generate the QR workbook for the records currently filtered'}
            </p>
          </div>
        </div>
        <button onClick={fetchJobs} className="btn-secondary btn-sm" disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="px-6 py-2 bg-red-50 text-red-700 text-sm">{error}</div>}
      {notice && <div className="px-6 py-2 bg-blue-50 text-blue-700 text-sm">{notice}</div>}

      {supported === false && (
        <div className="px-6 py-4 text-sm text-gray-500">
          No QR template is configured for {config.title}.
        </div>
      )}

      {supported && (
        <div className="p-6 space-y-6">
          {/* ── Generate ───────────────────────────────────────────────── */}
          <section className="card p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">New export</h3>
            <p className="text-xs text-gray-500 mb-4">
              Covers the QA-accepted records currently filtered on the {config.title}{' '}
              table: {describeFilters(filters)}. Adjust the cycle or From/To dates on
              the table to change what goes in — pending and rejected records are never
              exported.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="qr-wp">Work Package</label>
                <input
                  id="qr-wp"
                  className="input"
                  value={form.work_package}
                  onChange={setField('work_package')}
                  placeholder="e.g. WP-2026-01"
                />
              </div>
              <div>
                <label className="label" htmlFor="qr-po">PO Number</label>
                <input
                  id="qr-po"
                  className="input"
                  value={form.po_number}
                  onChange={setField('po_number')}
                  placeholder="e.g. PO-778899"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary btn-sm mt-4 flex items-center gap-1.5"
            >
              {generating ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Generate QR
            </button>
          </section>

          {/* ── Download table ─────────────────────────────────────────── */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Generated QRs</h3>
              {hasActiveJob && (
                <span className="text-xs text-blue-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Generating…
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                No QR generated for {config.title} yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th">File</th>
                      <th className="table-th">Scope</th>
                      <th className="table-th">Rows</th>
                      <th className="table-th">Size</th>
                      <th className="table-th">Requested</th>
                      <th className="table-th">Status</th>
                      <th className="table-th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job) => {
                      const style = STATUS_STYLES[job.status] || STATUS_STYLES[QR_STATUS.PENDING]
                      return (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="table-td">
                            <span className="font-mono text-xs">
                              {job.file_name || <span className="text-gray-300">—</span>}
                            </span>
                            {job.error_message && (
                              <p className="text-xs text-red-600 mt-1 max-w-md">{job.error_message}</p>
                            )}
                          </td>
                          <td className="table-td text-xs text-gray-500">{describeJob(job)}</td>
                          <td className="table-td">{job.is_ready ? job.row_count : '—'}</td>
                          <td className="table-td text-xs text-gray-500">{formatSize(job.file_size)}</td>
                          <td className="table-td text-xs text-gray-500">{formatTime(job.created_at)}</td>
                          <td className="table-td">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.class}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {style.label}
                            </span>
                          </td>
                          <td className="table-td text-right whitespace-nowrap">
                            {/* The whole point of the async flow: this only shows once the file exists. */}
                            {job.is_ready && (
                              <button
                                onClick={() => handleDownload(job)}
                                disabled={downloadingId === job.id}
                                className="btn-primary btn-sm inline-flex items-center gap-1.5 mr-2"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {downloadingId === job.id ? 'Downloading…' : 'Download'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(job)}
                              className="text-xs font-medium text-gray-400 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-gray-200">
                  <TableCount total={jobs.length} noun="records" />
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function describeFilters(filters = {}) {
  // QA status is deliberately not read off the table — the export is always
  // Accepted-only, so showing the table's Pending/Reject filter would mislead.
  const parts = ['QA accepted']
  if (filters.cycle) parts.push(`cycle ${filters.cycle}`)
  if (filters.updated_after) parts.push(`from ${filters.updated_after}`)
  if (filters.updated_before) parts.push(`to ${filters.updated_before}`)
  return parts.join(', ')
}

function describeJob(job) {
  const parts = []
  if (job.cycle) parts.push(`Cycle ${job.cycle}`)
  if (job.qa_status) parts.push(job.qa_status)
  const range = describeRange(job.updated_after, job.updated_before)
  if (range) parts.push(range)
  if (job.work_package) parts.push(job.work_package)
  return parts.length ? parts.join(' · ') : 'All records'
}

function describeRange(after, before) {
  const from = formatDate(after)
  const to = formatDate(before, { rollBackMidnight: true })
  if (from && to) return `${from} – ${to}`
  if (from) return `from ${from}`
  if (to) return `up to ${to}`
  return null
}

function formatDate(iso, { rollBackMidnight = false } = {}) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  // The server stores an upper bound picked as a bare date rolled to the next
  // midnight, so the chosen day is included. Step back to show the date the user
  // actually picked; a bound with a real time on it is shown as given.
  const isMidnight =
    date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
  if (rollBackMidnight && isMidnight) date.setDate(date.getDate() - 1)
  return date.toLocaleDateString()
}

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
