import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { patrolingApi } from '../api/patroling'
import { lookupApi } from '../api/lookups'
import Header from '../components/layout/Header'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import PatrolingMap from '../components/map/PatrolingMap'
import ImageLightbox from '../components/ui/ImageLightbox'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/apiError'

const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '')

const QA_BADGE = {
  Accept: 'bg-green-100 text-green-700',
  Reject: 'bg-red-100 text-red-700',
  Pending: 'bg-yellow-100 text-yellow-700',
}

// Runs belong to cycle 1 unless the uploader says otherwise, matching the API.
const DEFAULT_CYCLE = '1'

// Whether the run was walked in daylight or after dark; the API takes the same two.
const DAY_NIGHT = ['Day', 'Night']

function emptyForm() {
  return {
    cycle: DEFAULT_CYCLE, wp_name: '', ba: '', zone: '', km: '',
    start_xy: '', end_xy: '',
    reading_start: '', reading_end: '', vist_date: '', day_night: '',
    notice_given: '',
    file: null, imageStart: null, imageEnd: null,
  }
}

/** What the `ba` column stores and the dropdown shows: the BA's short name. */
function baName(ba) {
  return ba?.short_name || ba?.business_area || ba?.label || ''
}

export default function Patroling() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { user, hasRole } = useAuth()

  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [routes, setRoutes] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ qa_status: '', cycle: '', date_from: '', date_to: '' })

  const [bas, setBas] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const canReview = hasRole('admin', 'manager', 'qc_officer')
  const canDelete = hasRole('admin', 'manager')

  // Only an admin picks the business area — everyone else records their own, and
  // the API enforces that whatever the form sends.
  const isAdmin = !!user?.is_admin
  const ownBa = useMemo(
    () => bas.find((b) => b.id === user?.ba_id) || null,
    [bas, user?.ba_id]
  )
  // Falls back to the name on /auth/me so the field is filled before the BA list
  // has loaded.
  const selectedBa = form.ba || (isAdmin ? '' : baName(ownBa) || baName(user?.ba))
  // The zone is a property of the business area (`ba.ppb_zone`), not something
  // the uploader types — show the BA's zone and keep the row's own as a fallback
  // for a BA that is no longer in the list.
  const selectedZone = bas.find((b) => baName(b) === selectedBa)?.ppb_zone || form.zone || ''

  const patrolImages = useMemo(() => {
    if (!detail) return []
    return [
      ['Start reading', detail.image_reading_start],
      ['End reading', detail.image_reading_end],
    ]
      .filter(([, url]) => url)
      .map(([label, url]) => ({ url: imageUrl(url), label }))
  }, [detail])

  const query = { ...filters, search, page, page_size: 20 }

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const data = await patrolingApi.list(query)
      setRows(data.items || [])
      setPagination(data.pagination || null)
    } catch (err) {
      setListError(errorMessage(err, 'Failed to load patrol runs.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, page])

  // The map shows every run matching the filters, not just the current page —
  // paging through a table should not make routes vanish from the map.
  const fetchRoutes = useCallback(async () => {
    try {
      setRoutes(await patrolingApi.geojson({ ...filters, search }))
    } catch {
      setRoutes(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchRoutes() }, [fetchRoutes])
  useEffect(() => {
    lookupApi.listBA({ page_size: 200 }).then((d) => setBas(d.items || [])).catch(() => {})
  }, [])

  const selectRow = async (id) => {
    setSelectedId(id)
    setDetail(null)
    try {
      setDetail(await patrolingApi.get(id))
    } catch {
      /* the map still highlights it from the geojson already loaded */
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      ...emptyForm(),
      cycle: row.cycle || DEFAULT_CYCLE,
      wp_name: row.wp_name || '',
      ba: row.ba || '',
      zone: row.zone || '',
      km: row.km ?? '',
      start_xy: row.start_xy || '',
      end_xy: row.end_xy || '',
      reading_start: row.reading_start || '',
      reading_end: row.reading_end || '',
      vist_date: (row.vist_date || '').slice(0, 16),
      day_night: row.day_night || '',
      notice_given: row.notice_given ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!editing && !form.file) {
      setFormError('Upload the route KML — it is what the run is recorded from.')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, ba: selectedBa, zone: selectedZone }
      if (editing) await patrolingApi.update(editing.id, payload)
      else await patrolingApi.create(payload)
      setModalOpen(false)
      await Promise.all([fetchRows(), fetchRoutes()])
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save the patrol run.'))
    } finally {
      setSaving(false)
    }
  }

  const handleQa = async (row, action) => {
    const remarks = action === 'Reject' ? prompt('Reason for rejecting this run?') : null
    if (action === 'Reject' && remarks === null) return
    try {
      await patrolingApi.qaAction(row.id, action, remarks)
      await Promise.all([fetchRows(), fetchRoutes()])
      if (selectedId === row.id) selectRow(row.id)
    } catch (err) {
      setListError(errorMessage(err, 'Failed to update QA status.'))
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete patrol run #${row.id}? This cannot be undone.`)) return
    try {
      await patrolingApi.delete(row.id)
      if (selectedId === row.id) { setSelectedId(null); setDetail(null) }
      await Promise.all([fetchRows(), fetchRoutes()])
    } catch (err) {
      setListError(errorMessage(err, 'Failed to delete the patrol run.'))
    }
  }

  const setFilter = (key, value) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Patrolling"
        subtitle="Patrol routes uploaded as KML"
        onMenuClick={() => setSidebarOpen?.(true)}
        actions={
          <button onClick={openCreate} className="btn-primary btn-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload Route
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="card overflow-hidden">
          <PatrolingMap
            data={routes}
            selectedId={selectedId}
            onSelect={selectRow}
            height={420}
          />
        </div>

        {detail && (
          <div className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 flex-1">
                <Detail label="Work Package" value={detail.wp_name} />
                <Detail label="Business Area" value={detail.ba} />
                <Detail label="Zone" value={detail.zone} />
                <Detail label="Cycle" value={detail.cycle} />
                <Detail label="Patrol Date" value={formatDate(detail.vist_date)} />
                <Detail label="Day / Night" value={detail.day_night} />
                <Detail label="Distance" value={detail.km != null ? `${detail.km} km` : null} />
                <Detail label="Readings" value={[detail.reading_start, detail.reading_end].filter(Boolean).join(' → ')} />
                <Detail label="Notices Given" value={detail.notice_given} />
                <Detail label="Start Coordinate" value={detail.start_xy} />
                <Detail label="End Coordinate" value={detail.end_xy} />
              </div>
              <button onClick={() => { setSelectedId(null); setDetail(null); setLightboxIndex(null) }} className="btn-secondary btn-sm flex-shrink-0">
                Clear
              </button>
            </div>

            {(detail.image_reading_start || detail.image_reading_end) && (
              <div className="flex gap-3 mt-4">
                {patrolImages.map((img, idx) => (
                  <button
                    key={img.label}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="block text-left"
                  >
                    <img src={img.url} alt={img.label} className="h-24 w-32 object-cover rounded-lg border border-gray-200" />
                    <span className="text-xs text-gray-500">{img.label}</span>
                  </button>
                ))}
              </div>
            )}

            {detail.qa_status === 'Reject' && detail.reject_remarks && (
              <p className="mt-3 text-sm text-red-600">Rejected: {detail.reject_remarks}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSearch={(v) => { setPage(1); setSearch(v) }}
            placeholder="Search work package, BA, zone…"
            className="max-w-sm"
          />
          <select value={filters.qa_status} onChange={(e) => setFilter('qa_status', e.target.value)} className="input max-w-[10rem]">
            <option value="">All statuses</option>
            {['Pending', 'Accept', 'Reject'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" value={filters.cycle} onChange={(e) => setFilter('cycle', e.target.value)} placeholder="Cycle" className="input max-w-[7rem]" />
          <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} className="input max-w-[10rem]" />
          <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} className="input max-w-[10rem]" />
        </div>

        {listError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{listError}</div>
        )}

        {routes?.truncated && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 text-sm">
            The map is showing the {routes.features.length} most recent routes for these filters. Narrow the filters to see the rest.
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th">Patrol Date</th>
                      <th className="table-th">Day / Night</th>
                      <th className="table-th">Work Package</th>
                      <th className="table-th">BA / Zone</th>
                      <th className="table-th">Cycle</th>
                      <th className="table-th">KM</th>
                      <th className="table-th">Readings</th>
                      <th className="table-th">Notices</th>
                      <th className="table-th">Status</th>
                      <th className="table-th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => selectRow(row.id)}
                        className={`cursor-pointer ${selectedId === row.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="table-td font-medium">{formatDate(row.vist_date)}</td>
                        <td className="table-td">
                          {row.day_night ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.day_night === 'Night' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {row.day_night}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="table-td">{row.wp_name || '—'}</td>
                        <td className="table-td">{[row.ba, row.zone].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="table-td">{row.cycle || '—'}</td>
                        <td className="table-td">{row.km != null ? row.km : '—'}</td>
                        <td className="table-td">{[row.reading_start, row.reading_end].filter(Boolean).join(' → ') || '—'}</td>
                        <td className="table-td">{row.notice_given ?? '—'}</td>
                        <td className="table-td">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${QA_BADGE[row.qa_status] || 'bg-gray-100 text-gray-600'}`}>
                            {row.qa_status || 'Pending'}
                          </span>
                        </td>
                        <td className="table-td text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(row)} className="text-primary-600 hover:text-primary-700 text-xs font-medium mr-3">Edit</button>
                          {canReview && row.qa_status !== 'Accept' && (
                            <button onClick={() => handleQa(row, 'Accept')} className="text-green-600 hover:text-green-700 text-xs font-medium mr-3">Accept</button>
                          )}
                          {canReview && row.qa_status !== 'Reject' && (
                            <button onClick={() => handleQa(row, 'Reject')} className="text-orange-600 hover:text-orange-700 text-xs font-medium mr-3">Reject</button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(row)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="text-center text-gray-400 py-8">No patrol runs found.</p>}
              <Pagination pagination={pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Patrol Run #${editing.id}` : 'Upload Patrol Route'}
        size="lg"
      >
        {formError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{formError}</div>}

        <div className="space-y-4">
          <div>
            <label className="label">Route file (.kml / .kmz){!editing && ' *'}</label>
            <input
              type="file"
              accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              className="input py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {editing
                ? 'Leave empty to keep the route already on this run.'
                : 'The route drawn in Google Earth. Its length fills the KM field when you leave that blank.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Work Package</label>
              <input type="text" value={form.wp_name} onChange={(e) => setForm({ ...form, wp_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Business Area</label>
              <select
                value={selectedBa}
                onChange={(e) => setForm({ ...form, ba: e.target.value, zone: '' })}
                disabled={!isAdmin}
                className="input disabled:bg-gray-100 disabled:text-gray-500"
              >
                {isAdmin && <option value="">— Select BA —</option>}
                {bas.map((ba) => (
                  <option key={ba.id} value={baName(ba)}>{baName(ba)}</option>
                ))}
                {/* The user's own BA before the list arrives, or one since removed. */}
                {selectedBa && !bas.some((b) => baName(b) === selectedBa) && (
                  <option value={selectedBa}>{selectedBa}</option>
                )}
              </select>
              {!isAdmin && <p className="text-xs text-gray-500 mt-1">Your business area.</p>}
            </div>
            <div>
              <label className="label">Zone</label>
              <input
                type="text"
                value={selectedZone}
                readOnly
                placeholder="from the BA"
                className="input bg-gray-100 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Comes from the BA (ppb_zone).</p>
            </div>
            <div>
              <label className="label">Cycle</label>
              <input type="text" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Patrol Date</label>
              <input type="datetime-local" value={form.vist_date} onChange={(e) => setForm({ ...form, vist_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Day / Night</label>
              <select value={form.day_night} onChange={(e) => setForm({ ...form, day_night: e.target.value })} className="input">
                <option value="">— Select —</option>
                {DAY_NIGHT.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Distance (km)</label>
              <input type="number" step="0.001" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="from KML" className="input" />
            </div>
            <div>
              <label className="label">Coordinate Start</label>
              <input
                type="text"
                value={form.start_xy}
                onChange={(e) => setForm({ ...form, start_xy: e.target.value })}
                placeholder="lat, lng"
                className="input"
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Coordinate End</label>
              <input
                type="text"
                value={form.end_xy}
                onChange={(e) => setForm({ ...form, end_xy: e.target.value })}
                placeholder="lat, lng"
                className="input"
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Reading Start</label>
              <input type="text" value={form.reading_start} onChange={(e) => setForm({ ...form, reading_start: e.target.value })} className="input" maxLength={20} />
            </div>
            <div>
              <label className="label">Reading End</label>
              <input type="text" value={form.reading_end} onChange={(e) => setForm({ ...form, reading_end: e.target.value })} className="input" maxLength={20} />
            </div>
            <div>
              <label className="label">Notices Given</label>
              <input type="number" value={form.notice_given} onChange={(e) => setForm({ ...form, notice_given: e.target.value })} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start reading photo</label>
              <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageStart: e.target.files?.[0] || null })} className="input py-2" />
            </div>
            <div>
              <label className="label">End reading photo</label>
              <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageEnd: e.target.files?.[0] || null })} className="input py-2" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Upload Run'}
          </button>
        </div>
      </Modal>

      <ImageLightbox
        images={patrolImages}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || value === 0 ? value : '—'}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Stored image paths are `app/static/...`; the API serves them from `/static`. */
function imageUrl(stored) {
  if (!stored) return ''
  if (/^https?:\/\//.test(stored)) return stored
  return `${API_ORIGIN}/${stored.replace(/^\/?app\//, '')}`
}
