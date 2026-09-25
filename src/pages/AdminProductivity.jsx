import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { productivityApi } from '../api/productivity'
import { userApi } from '../api/users'
import { lookupApi } from '../api/lookups'
import Header from '../components/layout/Header'
import SearchableSelect from '../components/ui/SearchableSelect'
import { TableCount } from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../utils/apiError'

// A date input needs a local YYYY-MM-DD; toISOString() would shift the day for
// anyone west of UTC.
function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AdminProductivity() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { user, hasRole } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id
  const canView = hasRole('admin', 'manager')

  // The window defaults to today; both pickers start there.
  const [from, setFrom] = useState(todayLocal())
  const [to, setTo] = useState(todayLocal())
  const [baId, setBaId] = useState(userBaId || '')
  const [asset, setAsset] = useState('')
  const [surveyorId, setSurveyorId] = useState('')
  const [qcId, setQcId] = useState('')

  const [bas, setBas] = useState([])
  const [users, setUsers] = useState([])
  const [assets, setAssets] = useState([])
  const [surveyors, setSurveyors] = useState([])
  const [qc, setQc] = useState([])
  const [totals, setTotals] = useState({ surveyed: 0, qc_done: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (userBaId) setBaId(userBaId)
  }, [userBaId])

  useEffect(() => {
    lookupApi.listBA({ page_size: 200 }).then((d) => setBas(d.items || [])).catch(() => {})
    // /users pages at 100; walk a few pages so the surveyor / QC dropdowns
    // cover the whole workforce rather than the first hundred.
    userApi.listPaged({ page_size: 100, page: 1 })
      .then(async (first) => {
        const all = [...(first.items || [])]
        const pages = first.pagination?.total_pages || 1
        for (let p = 2; p <= Math.min(pages, 10); p++) {
          const next = await userApi.listPaged({ page_size: 100, page: p })
          all.push(...(next.items || []))
        }
        setUsers(all)
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await productivityApi.summary({
        from_date: from || undefined,
        to_date: to || undefined,
        ba_id: baId || undefined,
        asset: asset || undefined,
        surveyor_id: surveyorId || undefined,
        qc_id: qcId || undefined,
      })
      setAssets(data.assets || [])
      setSurveyors(data.surveyors || [])
      setQc(data.qc || [])
      setTotals(data.totals || { surveyed: 0, qc_done: 0 })
    } catch (err) {
      setError(errorMessage(err, 'Failed to load productivity data.'))
    } finally {
      setLoading(false)
    }
  }, [from, to, baId, asset, surveyorId, qcId])

  useEffect(() => {
    if (canView) fetchData()
  }, [canView, fetchData])

  const userOptions = useMemo(
    () => users.map((u) => ({
      value: u.id,
      label: u.roles?.length ? `${u.name} (${u.roles.join(', ')})` : u.name,
    })),
    [users]
  )

  const assetOptions = useMemo(
    () => assets.map((a) => ({ value: a.key, label: a.label })),
    [assets]
  )

  const resetFilters = () => {
    setFrom(todayLocal())
    setTo(todayLocal())
    setBaId(userBaId || '')
    setAsset('')
    setSurveyorId('')
    setQcId('')
  }

  if (!canView) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Productivity" onMenuClick={() => setSidebarOpen?.(true)} />
        <div className="flex items-center justify-center h-full text-gray-400">You don't have permission to view this page.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f3f6f1]">
      <Header
        title="Productivity"
        subtitle="Records surveyed (updated by/at, first submissions by created by/at) and QC decisions (QC by/at)."
        onMenuClick={() => setSidebarOpen?.(true)}
        actions={
          <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="bg-transparent border-0 text-sm p-0 focus:outline-none focus:ring-0 w-[8.5rem]" />
            <span className="text-gray-400">–</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent border-0 text-sm p-0 focus:outline-none focus:ring-0 w-[8.5rem]" />
          </label>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4">
          {!userBaId && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs text-gray-500 whitespace-nowrap">Business Area</span>
              <select
                value={baId}
                onChange={(e) => setBaId(e.target.value)}
                className="border-0 text-sm font-medium text-gray-800 focus:outline-none focus:ring-0 p-0 bg-transparent max-w-[10rem]"
              >
                <option value="">All Business Areas</option>
                {bas.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.short_name || ba.business_area}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-500 whitespace-nowrap">Asset</span>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="border-0 text-sm font-medium text-gray-800 focus:outline-none focus:ring-0 p-0 bg-transparent max-w-[10rem]"
            >
              <option value="">All Assets</option>
              {assets.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-500 whitespace-nowrap">Surveyor</span>
            <SearchableSelect
              options={userOptions}
              value={surveyorId}
              onChange={setSurveyorId}
              placeholder="All Surveyors"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-gray-500 whitespace-nowrap">QC Officer</span>
            <SearchableSelect
              options={userOptions}
              value={qcId}
              onChange={setQcId}
              placeholder="All QC"
            />
          </div>
          <button type="button" onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-800 ml-auto">
            Reset
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-1">Total Done by Surveyors</p>
            <p className="text-3xl font-bold text-gray-900">{(totals.surveyed || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Records updated {from === to ? `on ${from}` : `between ${from || '…'} and ${to || '…'}`}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-1">Total Done by QC</p>
            <p className="text-3xl font-bold text-gray-900">{(totals.qc_done || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">QC decisions {from === to ? `on ${from}` : `between ${from || '…'} and ${to || '…'}`}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <UserTable
              title="Surveyors"
              subtitle="Counts by updated by/at (created by/at for first submissions)"
              rows={surveyors}
              assets={assets}
              noun="surveyors"
            />
            <UserTable
              title="QC Officers"
              subtitle="Counts by QC by / QC at"
              rows={qc}
              assets={assets}
              noun="QC officers"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function UserTable({ title, subtitle, rows, assets, noun }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <TableCount total={rows.length} noun={noun} />
      </div>
      <div className="overflow-x-auto mt-3">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th text-left whitespace-nowrap">Name</th>
              {assets.map((a) => (
                <th key={a.key} className="table-th text-right whitespace-nowrap">{a.label}</th>
              ))}
              <th className="table-th text-right whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={assets.length + 2} className="table-td text-center text-gray-400">No activity in this window</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.user_id} className="hover:bg-gray-50">
                <td className="table-td">
                  <p className="font-medium text-gray-900">{row.name}</p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </td>
                {assets.map((a) => (
                  <td key={a.key} className="table-td text-right text-sm text-gray-600">
                    {row.by_asset?.[a.key] || '—'}
                  </td>
                ))}
                <td className="table-td text-right text-sm font-semibold text-gray-900">{row.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
