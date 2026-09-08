import { useState, useEffect, useCallback, useMemo } from 'react'
import { surveyApi } from '../../api/surveys'
import { workPackageApi } from '../../api/workpackages'
import StatusBadge from '../ui/StatusBadge'
import Pagination from '../ui/Pagination'
import SearchInput from '../ui/SearchInput'
import MultiSelect from '../ui/MultiSelect'
import { defectOptions } from '../../config/surveyConfigs'
import MapView from '../map/MapView'
import SurveyForm from './SurveyForm'
import SurveyDetail from './SurveyDetail'
import QRPanel from './QRPanel'
import { useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../utils/apiError'

const VIEW = { LIST: 'list', CREATE: 'create', EDIT: 'edit', DETAIL: 'detail', QR: 'qr' }

async function attachSavrTiangNos(items) {
  const missing = [...new Set(
    items.filter((r) => r.savr_id && !r.savr_tiang_no).map((r) => r.savr_id)
  )]
  if (!missing.length) return
  const lookups = await Promise.all(
    missing.map((id) =>
      surveyApi.get('savr', id).then((s) => [id, s.tiang_no || null]).catch(() => [id, null])
    )
  )
  const names = Object.fromEntries(lookups)
  for (const item of items) {
    if (item.savr_id && !item.savr_tiang_no) item.savr_tiang_no = names[item.savr_id] || null
  }
}

export default function SurveyModule({ config }) {
  const { hasRole, user } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id
  const [view, setView] = useState(VIEW.LIST)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    cycle: 1,
    qa_status: '',
    workpackage_id: '',
    updated_after: '',
    updated_before: '',
    defects: [],
    defects_match: 'any',
  })
  const defectChoices = useMemo(() => defectOptions(config), [config])
  const [packages, setPackages] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const canQA = hasRole('admin', 'qc_officer', 'manager')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Free-text search goes to the server (device_id + text columns) so a
      // device id like sub_0019 is found on any page, not just the loaded one.
      const params = { page, page_size: 25 }
      if (search.trim()) params.search = search.trim()
      if (filters.cycle) params.cycle = filters.cycle
      if (filters.qa_status) params.qa_status = filters.qa_status
      if (filters.updated_after) params.updated_after = filters.updated_after
      if (filters.updated_before) params.updated_before = filters.updated_before
      if (filters.workpackage_id) params.workpackage_id = filters.workpackage_id
      if (filters.defects?.length) {
        params.defects = filters.defects.join(',')
        params.defects_match = filters.defects_match || 'any'
      }
      if (userBaId) params.ba_id = userBaId

      const data = await surveyApi.list(config.endpoint, params)
      const items = data.items || []
      await attachSavrTiangNos(items)
      if (packages.length) {
        const names = Object.fromEntries(packages.map((p) => [p.id, p.package_name]))
        for (const item of items) {
          if (item.workpackage_id && !item.workpackage_name) {
            item.workpackage_name = names[item.workpackage_id] || null
          }
        }
      }
      const pagination = data.pagination || {
        total: data.total || 0,
        page: data.page || 1,
        total_pages: Math.ceil((data.total || 0) / 25),
        has_next: (data.page || 1) * 25 < (data.total || 0),
        has_previous: (data.page || 1) > 1,
      }
      setRecords(items)
      setPagination(pagination)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load records'))
    } finally {
      setLoading(false)
    }
  }, [config.endpoint, page, filters, search, userBaId, packages])

  useEffect(() => {
    const params = { page_size: 200 }
    if (userBaId) params.ba_id = userBaId
    workPackageApi.list(params).then(setPackages).catch(() => {})
  }, [userBaId])

  // Every survey table carries a `device_id` assigned by the DB trigger, so it
  // leads the table for all modules rather than being repeated in each config.
  const tableColumns = useMemo(() => {
    const cols = config.columns || []
    const withDevice = cols.some((col) => col.key === 'device_id')
      ? cols
      : [{ key: 'device_id', label: 'Device ID', type: 'code' }, ...cols]
    if (withDevice.some((col) => col.key === 'workpackage_name' || col.key === 'workpackage_id')) {
      return withDevice
    }
    const [first, ...rest] = withDevice
    return [first, { key: 'workpackage_name', label: 'Work Package' }, ...rest]
  }, [config.columns])

  // Search is applied server-side (see fetchRecords); this only orders the page.
  const visibleRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return tb - ta
    })
  }, [records])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleRowClick = async (record) => {
    setDetailLoading(true)
    setView(VIEW.DETAIL)
    try {
      const full = await surveyApi.get(config.endpoint, record.id)
      setSelectedRecord(full)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load record details'))
      setView(VIEW.LIST)
    } finally {
      setDetailLoading(false)
    }
  }

  const handlePointSelect = async (pointInfo) => {
    if (!pointInfo.record_id) return

    // Height clearance is stored against a pole: the map paints SAVR points,
    // so record_id here is the pole id, not an existing HC row.
    if (config.attachToPole) {
      const poleTable = config.mapTableName || 'tbl_savr'
      if (pointInfo.table_name && pointInfo.table_name !== poleTable) return
      setDetailLoading(true)
      setError('')
      try {
        const existing = await surveyApi.findBySavrId(config.endpoint, pointInfo.record_id, {
          cycle: filters.cycle,
          ba_id: userBaId,
        })
        if (existing) {
          const full = await surveyApi.get(config.endpoint, existing.id)
          setSelectedRecord(full)
          setView(VIEW.EDIT)
        } else {
          const pole = await surveyApi.get('savr', pointInfo.record_id)
          setSelectedRecord({
            savr_id: pole.id,
            savr_tiang_no: pole.tiang_no,
            ba_id: pole.ba_id,
            zone: pole.zone,
            workpackage_id: pole.workpackage_id,
            workpackage_name: pole.workpackage_name,
            cycle: filters.cycle || pole.cycle || 1,
            geometry: pole.geometry,
          })
          setView(VIEW.CREATE)
        }
      } catch (err) {
        setError(errorMessage(err, 'Failed to open height clearance for this pole'))
        setView(VIEW.LIST)
      } finally {
        setDetailLoading(false)
      }
      return
    }

    setDetailLoading(true)
    setView(VIEW.DETAIL)
    try {
      const full = await surveyApi.get(config.endpoint, pointInfo.record_id)
      setSelectedRecord(full)
    } catch {
      setError('Failed to load record details')
      setView(VIEW.LIST)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedRecord) return
    if (!confirm(`Delete this ${config.title} record?`)) return
    try {
      await surveyApi.delete(config.endpoint, selectedRecord.id)
      setView(VIEW.LIST)
      setSelectedRecord(null)
      fetchRecords()
    } catch (err) {
      setError('Failed to delete record')
    }
  }

  const handleQaAction = async (action) => {
    if (!selectedRecord) return
    const remarks = action === 'Reject' ? prompt('Enter rejection remarks:') : null
    try {
      await surveyApi.qaAction(config.endpoint, selectedRecord.id, action, remarks)
      const updated = await surveyApi.get(config.endpoint, selectedRecord.id)
      setSelectedRecord(updated)
      // Patch the list row in place so the table shows the new status without a
      // reload, then reconcile with the server (a qa_status filter may now
      // exclude this row entirely).
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      fetchRecords()
      return true
    } catch (err) {
      setError(`Failed to ${action.toLowerCase()} record`)
      return false
    }
  }

  const handleSaveComplete = () => {
    setView(VIEW.LIST)
    setSelectedRecord(null)
    fetchRecords()
  }

  if (detailLoading && view !== VIEW.DETAIL) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // ================================================================
  // RENDER: CREATE / EDIT
  // ================================================================
  if (view === VIEW.CREATE || view === VIEW.EDIT) {
    return (
      <SurveyForm
        config={config}
        record={selectedRecord}
        onSave={handleSaveComplete}
        onQaAction={canQA && view === VIEW.EDIT ? handleQaAction : null}
        onCancel={() => {
          setView(VIEW.LIST)
          setSelectedRecord(null)
        }}
      />
    )
  }

  // ================================================================
  // RENDER: DETAIL
  // ================================================================
  if (view === VIEW.DETAIL) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
        </div>
      )
    }
    return (
      <SurveyDetail
        config={config}
        record={selectedRecord}
        onEdit={() => setView(VIEW.EDIT)}
        onDelete={handleDelete}
        onQaAction={canQA ? handleQaAction : null}
        onPointSelect={handlePointSelect}
        onBack={() => {
          setView(VIEW.LIST)
          setSelectedRecord(null)
        }}
      />
    )
  }

  // ================================================================
  // RENDER: QR (Quality Records)
  // ================================================================
  if (view === VIEW.QR) {
    // Hand the panel the same filters the table is showing, plus the BA the
    // user is scoped to, so the workbook holds exactly these records.
    return (
      <QRPanel
        config={config}
        filters={{ ...filters, ba_id: userBaId || undefined }}
        onBack={() => setView(VIEW.LIST)}
      />
    )
  }

  // ================================================================
  // RENDER: LIST (default)
  // ================================================================
  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left: Table + Filters */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <SearchInput
              value={searchInput}
              onChange={(v) => {
                setSearchInput(v)
                setPage(1)
              }}
              onSearch={(v) => setSearch(v)}
              placeholder={`Search ${config.title} by Device ID, name…`}
              className="w-full sm:w-56"
            />

            {config.filters.map((filter) => (
              <div key={filter.name} className="filter-pill">
                <label>{filter.label}</label>
                {filter.type === 'select' ? (
                  <select
                    value={filters[filter.name] || ''}
                    onChange={(e) => {
                      setPage(1)
                      setFilters((prev) => ({ ...prev, [filter.name]: e.target.value }))
                    }}
                  >
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={filters[filter.name] || ''}
                    onChange={(e) => {
                      setPage(1)
                      setFilters((prev) => ({ ...prev, [filter.name]: e.target.value }))
                    }}
                    className="w-14"
                  />
                )}
              </div>
            ))}

            <div className="filter-pill">
              <label>Work Package</label>
              <select
                value={filters.workpackage_id || ''}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, workpackage_id: e.target.value }))
                }}
              >
                <option value="">All</option>
                {packages.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.package_name}{wp.has_geom ? '' : ' (no polygon)'}
                  </option>
                ))}
              </select>
            </div>

            {defectChoices.length > 0 && (
              <div className="filter-pill">
                <label>Defects</label>
                <MultiSelect
                  options={defectChoices}
                  value={filters.defects}
                  placeholder="Any"
                  onChange={(next) => {
                    setPage(1)
                    setFilters((prev) => ({ ...prev, defects: next }))
                  }}
                />
                {filters.defects.length > 1 && (
                  <select
                    value={filters.defects_match}
                    title="Match records with any of the chosen defects, or only those with all of them"
                    onChange={(e) => {
                      setPage(1)
                      setFilters((prev) => ({ ...prev, defects_match: e.target.value }))
                    }}
                  >
                    <option value="any">any</option>
                    <option value="all">all</option>
                  </select>
                )}
              </div>
            )}

            <div className="filter-pill">
              <label>From</label>
              <input
                type="date"
                value={filters.updated_after || ''}
                max={filters.updated_before || undefined}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, updated_after: e.target.value }))
                }}
              />
            </div>

            <div className="filter-pill">
              <label>To</label>
              <input
                type="date"
                value={filters.updated_before || ''}
                min={filters.updated_after || undefined}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, updated_before: e.target.value }))
                }}
              />
            </div>

            {(filters.updated_after || filters.updated_before) && (
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0"
                onClick={() => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, updated_after: '', updated_before: '' }))
                }}
              >
                Clear dates
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setView(VIEW.QR)}
              className="btn-secondary btn-sm flex items-center gap-1.5"
              title={`Generate the ${config.title} Quality Record workbook`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              QR
            </button>
            {!config.attachToPole && (
              <button
                onClick={() => setView(VIEW.CREATE)}
                className="btn-primary btn-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New {config.title}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M7 21h10a2 2 0 002-2v-5a9 9 0 10-18 0v5a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No {config.title} records found</p>
              {config.attachToPole ? (
                <p className="text-xs mt-2 max-w-xs text-center">
                  Click a pole on the map to add height clearance for that location.
                </p>
              ) : (
                <button onClick={() => setView(VIEW.CREATE)} className="btn-secondary btn-sm mt-3">
                  Create First Record
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col.key} className="table-th">
                      {col.label}
                    </th>
                  ))}
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick(record)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {tableColumns.map((col) => (
                      <td key={col.key} className="table-td">
                        {renderCell(col, record[col.key], record)}
                      </td>
                    ))}
                    <td className="table-td text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(record)
                        }}
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination && visibleRecords.length > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} />
        )}
      </div>

      {/* Right: Map */}
      <div className="lg:w-[480px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">{config.title} Map</h3>
            {config.attachToPole && (
              <p className="text-xs text-gray-400 mt-0.5">Click a pole to add or edit height clearance</p>
            )}
          </div>
          <span className="text-xs text-gray-400">{pagination?.total || 0} records</span>
        </div>
        <MapView
          surveyConfig={config}
          filters={filters}
          baId={userBaId}
          onPointSelect={handlePointSelect}
          onWorkpackageClick={(wpId) => {
            setPage(1)
            setFilters((prev) => ({ ...prev, workpackage_id: wpId || '' }))
          }}
          height={typeof window !== 'undefined' && window.innerHeight < 800 ? 400 : 550}
        />
      </div>
    </div>
  )
}

function renderCell(col, value, record) {
  if (col.key === 'savr_id') {
    const label = record?.savr_tiang_no
    if (label) return <span className="truncate block max-w-xs">{label}</span>
    if (value == null) return <span className="text-gray-300">—</span>
    if (typeof value === 'string' && value.length === 36 && value.includes('-')) {
      return <span className="truncate block max-w-xs font-mono text-xs">{value.substring(0, 8)}…</span>
    }
    return <span className="truncate block max-w-xs">{String(value)}</span>
  }

  if (value == null) return <span className="text-gray-300">—</span>

  switch (col.type) {
    case 'qa_status':
      return <StatusBadge status={value} />
    case 'badge':
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            value > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {String(value)}
        </span>
      )
    case 'datetime':
      return <span className="text-xs text-gray-500">{new Date(value).toLocaleDateString()}</span>
    case 'code':
      return <span className="font-mono text-xs text-gray-700 whitespace-nowrap">{String(value)}</span>
    default:
      // Truncate UUIDs for display
      if (typeof value === 'string' && value.length === 36 && value.includes('-')) {
        return <span className="truncate block max-w-xs font-mono text-xs">{value.substring(0, 8)}…</span>
      }
      return <span className="truncate block max-w-xs">{String(value)}</span>
  }
}
