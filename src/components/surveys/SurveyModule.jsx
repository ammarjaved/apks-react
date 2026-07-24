import { useState, useEffect, useCallback } from 'react'
import { surveyApi } from '../../api/surveys'
import StatusBadge from '../ui/StatusBadge'
import Pagination from '../ui/Pagination'
import MapView from '../map/MapView'
import SurveyForm from './SurveyForm'
import SurveyDetail from './SurveyDetail'
import { useAuth } from '../../context/AuthContext'

const VIEW = { LIST: 'list', CREATE: 'create', EDIT: 'edit', DETAIL: 'detail' }

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
    date_from: '',
    date_to: '',
  })
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const canQA = hasRole('admin', 'qc_officer', 'manager')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, page_size: 25 }
      if (filters.cycle) params.cycle = filters.cycle
      if (filters.qa_status) params.qa_status = filters.qa_status
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to

      const data = await surveyApi.list(config.endpoint, params)
      const items = data.items || []
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
      setError(err.response?.data?.detail || 'Failed to load records')
    } finally {
      setLoading(false)
    }
  }, [config.endpoint, page, filters])

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
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map(e => e.msg).join('; ') : (typeof detail === 'string' ? detail : 'Failed to load record details')
      setError(msg)
      setView(VIEW.LIST)
    } finally {
      setDetailLoading(false)
    }
  }

  const handlePointSelect = async (pointInfo) => {
    if (!pointInfo.point_id) return
    setDetailLoading(true)
    setView(VIEW.DETAIL)
    try {
      const full = await surveyApi.get(config.endpoint, pointInfo.point_id)
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
    } catch (err) {
      setError(`Failed to ${action.toLowerCase()} record`)
    }
  }

  const handleSaveComplete = () => {
    setView(VIEW.LIST)
    setSelectedRecord(null)
    fetchRecords()
  }

  // ================================================================
  // RENDER: CREATE / EDIT
  // ================================================================
  if (view === VIEW.CREATE || view === VIEW.EDIT) {
    return (
      <SurveyForm
        config={config}
        record={view === VIEW.EDIT ? selectedRecord : null}
        onSave={handleSaveComplete}
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
        onBack={() => {
          setView(VIEW.LIST)
          setSelectedRecord(null)
        }}
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
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 flex-wrap">
            {config.filters.map((filter) => (
              <div key={filter.name} className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
                  {filter.label}
                </label>
                {filter.type === 'select' ? (
                  <select
                    value={filters[filter.name] || ''}
                    onChange={(e) => {
                      setPage(1)
                      setFilters((prev) => ({ ...prev, [filter.name]: e.target.value }))
                    }}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-16 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                )}
              </div>
            ))}

            {/* Date range filter — labeled "Visit Date" for all types */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Visit Date</label>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, date_to: e.target.value }))
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <button
            onClick={() => setView(VIEW.CREATE)}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New {config.title}
          </button>
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
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M7 21h10a2 2 0 002-2v-5a9 9 0 10-18 0v5a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No {config.title} records found</p>
              <button onClick={() => setView(VIEW.CREATE)} className="btn-secondary btn-sm mt-3">
                Create First Record
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {config.columns.map((col) => (
                    <th key={col.key} className="table-th">
                      {col.label}
                    </th>
                  ))}
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick(record)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {config.columns.map((col) => (
                      <td key={col.key} className="table-td">
                        {renderCell(col, record[col.key])}
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

        {pagination && records.length > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} />
        )}
      </div>

      {/* Right: Map */}
      <div className="lg:w-[480px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{config.title} Map</h3>
          <span className="text-xs text-gray-400">{pagination?.total || 0} records</span>
        </div>
        <MapView
          surveyConfig={config}
          filters={filters}
          baId={userBaId}
          onPointSelect={handlePointSelect}
          height={typeof window !== 'undefined' && window.innerHeight < 800 ? 400 : 550}
        />
      </div>
    </div>
  )
}

function renderCell(col, value) {
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
          {value}
        </span>
      )
    case 'datetime':
      return <span className="text-xs text-gray-500">{new Date(value).toLocaleDateString()}</span>
    default:
      return <span className="truncate block max-w-xs">{String(value)}</span>
  }
}
