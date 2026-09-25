import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { surveyApi } from '../api/surveys'
import { lookupApi } from '../api/lookups'
import { SURVEY_TYPES, VISIBLE_SURVEY_LIST } from '../config/surveyConfigs'
import Header from '../components/layout/Header'
import { useAuth } from '../context/AuthContext'

const ICONS = {
  utilitypole: 'M12 2L4 22h16L12 2zM12 2v6M8 14h8',
  building: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01',
  box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  bridge: 'M3 21V10a9 9 0 0118 0v11M3 10h18M3 16c2.5 0 2.5-2 6-2s3.5 2 6 2 3.5-2 6-2M7 10V4m10 6V4',
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
}

const ASSET_ORDER = ['substation', 'feeder_pillar', 'savr', 'ffw', 'link_box', 'cable_bridge']

const SLICE_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#a855f7', '#06b6d4']

const SAVR_GROUPS = [
  { key: 'talian', label: 'Talian (Cable)', prefixes: ['talian_'] },
  { key: 'tiang', label: 'Tiang (Pole)', prefixes: ['tiang_'] },
  { key: 'umbang', label: 'Umbang (Stay Wire)', prefixes: ['umbang_'] },
  { key: 'servis', label: 'Servis', prefixes: ['servis_'] },
  { key: 'ipc', label: 'IPC', prefixes: ['ipc_'] },
]

const COUNT_ENDPOINTS = {
  substation: 'substation',
  savr: 'savr',
  feeder_pillar: 'feeder-pillar',
  link_box: 'link-box',
  cable_bridge: 'cable-bridge',
}

const HIDDEN_DEFECT_COLS = new Set(['talian_joint_conn', 'ba'])

const RANK_COLORS = ['#16a34a', '#22c55e', '#84cc16', '#eab308', '#f97316']

export default function Dashboard() {
  const { setSidebarOpen } = useOutletContext() || {}
  const { user } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id

  const [overview, setOverview] = useState(null)
  const [bas, setBas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [baId, setBaId] = useState(userBaId || '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    lookupApi.listBA({ page_size: 200 }).then((d) => setBas(d.items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (userBaId) setBaId(userBaId)
  }, [userBaId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const params = {
        ba_id: baId || undefined,
        updated_after: from || undefined,
        updated_before: to || undefined,
      }
      try {
        const data = await surveyApi.overview(params)
        if (!cancelled) setOverview(normalizeOverview(data))
      } catch {
        try {
          const data = await loadFallback(params, bas)
          if (!cancelled) setOverview(data)
        } catch {
          if (!cancelled) setError('Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [baId, from, to, bas])

  const assets = useMemo(() => {
    const byKey = Object.fromEntries((overview?.assets || []).map((a) => [a.key, a]))
    return ASSET_ORDER.map((key) => {
      const survey = SURVEY_TYPES[key]
      const stats = byKey[key] || emptyAsset(key, survey?.title)
      return { ...stats, survey }
    }).filter((a) => a.survey && VISIBLE_SURVEY_LIST.some((s) => s.key === a.key))
  }, [overview])

  const totals = overview?.totals || emptyTotals()
  const breakdown = overview?.breakdown || {}
  const hotspots = overview?.hotspots || []
  const deltas = overview?.deltas || {}

  return (
    <div className="flex flex-col h-full bg-[#f3f6f1]">
      <Header
        title="Inspection Overview"
        subtitle="Real-time summary of key assets and defect insights."
        onMenuClick={() => setSidebarOpen?.(true)}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <span className="text-xs text-gray-500 whitespace-nowrap">Business Area</span>
              <select
                value={baId}
                disabled={!!userBaId}
                onChange={(e) => setBaId(e.target.value)}
                className="bg-transparent border-0 text-sm font-medium text-gray-800 focus:outline-none focus:ring-0 p-0 max-w-[10rem]"
              >
                {!userBaId && <option value="">All Business Area</option>}
                {bas.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.short_name || ba.business_area || ba.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="bg-transparent border-0 text-sm p-0 focus:outline-none focus:ring-0 w-[8.5rem]" />
              <span className="text-gray-400">–</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent border-0 text-sm p-0 focus:outline-none focus:ring-0 w-[8.5rem]" />
              {(from || to) && (
                <button type="button" onClick={() => { setFrom(''); setTo('') }} className="text-xs text-gray-500 hover:text-gray-800">
                  Clear
                </button>
              )}
            </label>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}

        {loading && !overview ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {assets.map((asset) => (
                <AssetCard key={asset.key} asset={asset} />
              ))}
            </div>

            <QcStatusCard assets={assets} totals={totals} />

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Defect Breakdown By Asset</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <DefectBreakdownCard
                    key={asset.key}
                    asset={asset}
                    detail={breakdown[asset.key]}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2 card p-5 overflow-hidden relative">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Overall Performance</h2>
                <div className="flex items-center gap-4 mb-4">
                  <Gauge value={totals.performance} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{pct(totals.performance)}</p>
                    <p className="text-xs text-gray-500 mb-2">Overall Performance</p>
                    <PerformanceBadge value={totals.performance} />
                  </div>
                </div>
                <LandscapeMark />
                <div className="space-y-3 relative">
                  <MetricRow icon="check" label="Total Surveyed" value={fmt(totals.surveyed)} delta={deltas.surveyed} invert={false} spark={assets.map((a) => a.surveyed)} />
                  <MetricRow icon="alert" label="Total Defects" value={fmt(totals.defects)} delta={deltas.defects} invert spark={assets.map((a) => a.defects)} />
                  <MetricRow icon="rate" label="Defect Rate" value={pct(totals.defect_rate)} delta={deltas.defect_rate} invert spark={assets.map((a) => a.defect_rate * 100)} />
                  <MetricRow icon="closed" label="Closed Defects" value={fmt(totals.accepted)} delta={deltas.accepted} invert={false} spark={assets.map((a) => a.accepted)} />
                </div>
              </div>

              <div className="xl:col-span-3 card px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Top Defect Hotspot (by location)
                  </h2>
                  <Link to="/map" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                    View All Locations
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                {hotspots.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No defect hotspots in this range.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {hotspots.map((spot, i) => (
                      <div key={spot.location} className="flex items-center gap-2 bg-[#f3f6f1] rounded-full pl-1 pr-4 py-1">
                        <span
                          className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center"
                          style={{ backgroundColor: RANK_COLORS[i] || '#94a3b8' }}
                        >
                          {spot.rank}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 leading-tight">{spot.location}</p>
                          <p className="text-[11px] text-gray-500">{spot.defects} Defects</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * QC progress per asset: how many records a QC officer has accepted (QC done),
 * how many are still waiting (not QC), and how many were rejected.
 */
function QcStatusCard({ assets, totals }) {
  const pctOf = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—')
  const rows = assets.map((a) => ({
    key: a.key,
    label: a.label,
    color: a.survey?.color,
    surveyed: a.surveyed || 0,
    accepted: a.accepted || 0,
    pending: a.pending || 0,
    rejected: a.rejected || 0,
  }))
  const total = {
    surveyed: totals.surveyed || 0,
    accepted: totals.accepted || 0,
    pending: totals.pending || 0,
    rejected: totals.rejected || 0,
  }
  const cell = 'px-3 py-2 text-right tabular-nums'
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900">QC Status By Asset</h2>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500" />QC Done <strong className="text-gray-900">{fmt(total.accepted)}</strong></span>
          <span className="flex items-center gap-1.5 text-gray-600"><i className="w-2.5 h-2.5 rounded-full bg-amber-400" />Not QC <strong className="text-gray-900">{fmt(total.pending)}</strong></span>
          <span className="flex items-center gap-1.5 text-gray-600"><i className="w-2.5 h-2.5 rounded-full bg-red-500" />Rejected <strong className="text-gray-900">{fmt(total.rejected)}</strong></span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
              <th className="px-3 py-2 text-left font-semibold">Asset</th>
              <th className={`${cell} font-semibold`}>Total</th>
              <th className={`${cell} font-semibold text-emerald-700`}>QC Done</th>
              <th className={`${cell} font-semibold text-amber-700`}>Not QC</th>
              <th className={`${cell} font-semibold text-red-700`}>Rejected</th>
              <th className="px-3 py-2 text-left font-semibold w-[32%] min-w-[10rem]">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2">
                  <Link to={`/${r.key}`} className="flex items-center gap-2 text-gray-800 hover:text-emerald-700">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || '#94a3b8' }} />
                    {r.label}
                  </Link>
                </td>
                <td className={cell}>{fmt(r.surveyed)}</td>
                <td className={`${cell} text-emerald-700`}>{fmt(r.accepted)} <span className="text-[11px] text-gray-400">{pctOf(r.accepted, r.surveyed)}</span></td>
                <td className={`${cell} text-amber-700`}>{fmt(r.pending)}</td>
                <td className={`${cell} text-red-700`}>{fmt(r.rejected)}</td>
                <td className="px-3 py-2"><QcBar surveyed={r.surveyed} accepted={r.accepted} pending={r.pending} rejected={r.rejected} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold text-gray-900">
              <td className="px-3 py-2">All Assets</td>
              <td className={cell}>{fmt(total.surveyed)}</td>
              <td className={`${cell} text-emerald-700`}>{fmt(total.accepted)} <span className="text-[11px] text-gray-400 font-normal">{pctOf(total.accepted, total.surveyed)}</span></td>
              <td className={`${cell} text-amber-700`}>{fmt(total.pending)}</td>
              <td className={`${cell} text-red-700`}>{fmt(total.rejected)}</td>
              <td className="px-3 py-2"><QcBar {...total} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function QcBar({ surveyed, accepted, pending, rejected }) {
  if (!surveyed) return <div className="h-2 rounded-full bg-gray-100" />
  const w = (n) => `${(n / surveyed) * 100}%`
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex" title={`${accepted} QC done · ${pending} not QC · ${rejected} rejected`}>
      <span className="h-full bg-emerald-500" style={{ width: w(accepted) }} />
      <span className="h-full bg-amber-400" style={{ width: w(pending) }} />
      <span className="h-full bg-red-500" style={{ width: w(rejected) }} />
    </div>
  )
}

function AssetCard({ asset }) {
  const survey = asset.survey
  const color = survey.color
  return (
    <Link to={`/${survey.key}`} className="card p-4 hover:shadow-md transition-shadow group flex flex-col min-h-[168px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[survey.icon] || ICONS.box} />
          </svg>
        </span>
        <span className="text-sm font-medium text-gray-700 truncate">{asset.label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 leading-none mb-3">{asset.surveyed}</p>
      <div className="flex justify-between text-[11px] text-gray-500 mb-2">
        <span>Total Surveyed <strong className="text-gray-800">{asset.surveyed}</strong></span>
        <span>Total Defect <strong className="text-gray-800">{asset.defects}</strong></span>
      </div>
      <div className="mt-auto">
        <Sparkline values={asset.trend?.length ? asset.trend : [0, asset.defective, asset.surveyed]} color={color} />
        <p className="text-[11px] text-gray-500 mt-1">
          Defect Rate <span className="font-semibold text-gray-800">{pct(asset.defect_rate)}</span>
        </p>
      </div>
    </Link>
  )
}

function DefectBreakdownCard({ asset, detail }) {
  const [showItems, setShowItems] = useState(false)
  const survey = asset.survey
  const color = survey?.color || '#16a34a'
  const items = (detail?.items || []).filter((item) => item.count > 0)
  const components = (detail?.components || []).filter((item) => item.count > 0)
  const isSavr = asset.key === 'savr' && components.length > 0
  const useBars = isSavr && !showItems
  const source = useBars ? components : items
  const slices = collapseSlices(source, 5)
  const findings = asset.findings ?? source.reduce((sum, item) => sum + item.count, 0)
  const most = source[0]
  const rate = asset.defect_rate || 0
  const itemsPer = asset.items_per_asset ?? (asset.surveyed ? findings / asset.surveyed : 0)

  return (
    <div className="card p-4 flex flex-col min-h-[320px]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
            <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[survey?.icon] || ICONS.box} />
            </svg>
          </span>
          <span className="text-sm font-semibold text-gray-900 truncate">{asset.label}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${rateBadgeClass(rate)}`}>
          {pct(rate)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-3 text-center">
        <Stat label="Surveyed" value={fmt(asset.surveyed)} />
        <Stat label="Defective" value={fmt(asset.defective)} />
        <Stat label="Findings" value={fmt(findings)} />
        <Stat label="Items / Asset" value={Number(itemsPer).toFixed(2)} />
      </div>

      <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">
        {useBars ? 'Defect by component (level 1)' : 'Defect by inspection item'}
      </p>

      {slices.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No defects recorded.</p>
      ) : useBars ? (
        <BarList slices={slices} total={findings} />
      ) : (
        <div className="flex items-center gap-3">
          <Donut
            slices={slices.map((slice, i) => ({ ...slice, color: slice.color || SLICE_COLORS[i % SLICE_COLORS.length] }))}
            total={findings}
            caption="Total Findings"
            size={112}
          />
          <ul className="flex-1 min-w-0 space-y-1">
            {slices.map((slice, i) => (
              <li key={slice.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color || SLICE_COLORS[i % SLICE_COLORS.length] }} />
                  <span className="truncate text-gray-700">{slice.label}</span>
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{fmt(slice.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isSavr && (
        <button
          type="button"
          onClick={() => setShowItems((open) => !open)}
          className="mt-2 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 text-right"
        >
          {showItems ? 'View component summary →' : 'View component breakdown →'}
        </button>
      )}

      <div className="mt-auto pt-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: `${color}14` }}>
          <span className="text-amber-500 flex-shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 21h8v-1H8v1zm4-19l.75 1.5L14.5 5l-1.5.75L12 7.5l-.75-1.75L9.5 5l1.75-1.5L12 2zM6 8l.6 1.2L8 10l-1.4.6L6 12l-.6-1.4L4 10l1.4-.8L6 8zm12 0l.6 1.2L20 10l-1.4.6L18 12l-.6-1.4L16 10l1.4-.8L18 8zM7 13c0 2.76 2.24 5 5 5s5-2.24 5-5H7z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              {useBars ? 'Most Common Component' : 'Most Common Defect'}
            </p>
            <p className="text-xs font-semibold text-gray-900 truncate">
              {most ? `${most.label} · ${fmt(most.count)} findings` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
      <p className="text-sm font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  )
}

function BarList({ slices, total }) {
  const max = Math.max(...slices.map((s) => s.value), 1)
  return (
    <div className="space-y-1.5">
      {slices.map((slice, i) => {
        const color = slice.color || SLICE_COLORS[i % SLICE_COLORS.length]
        const share = total ? (slice.value / total) * 100 : 0
        return (
          <div key={slice.key}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-gray-700 truncate pr-2">{slice.label}</span>
              <span className="text-gray-900 font-semibold tabular-nums whitespace-nowrap">
                {fmt(slice.value)} <span className="text-gray-400 font-normal">{share.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(slice.value / max) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function collapseSlices(items, limit = 5) {
  const ranked = [...items].sort((a, b) => b.count - a.count)
  if (ranked.length <= limit) {
    return ranked.map((item) => ({ key: item.key, label: item.label, value: item.count }))
  }
  const head = ranked.slice(0, limit - 1)
  const rest = ranked.slice(limit - 1)
  return [
    ...head.map((item) => ({ key: item.key, label: item.label, value: item.count })),
    { key: '_others', label: `Others (${rest.length} items)`, value: rest.reduce((sum, item) => sum + item.count, 0) },
  ]
}

function rateBadgeClass(rate) {
  if (rate < 0.1) return 'bg-emerald-100 text-emerald-700'
  if (rate < 0.13) return 'bg-orange-100 text-orange-700'
  return 'bg-violet-100 text-violet-700'
}

function MetricRow({ icon, label, value, delta, invert, spark }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
        <MetricIcon name={icon} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
      <Sparkline values={spark} color="#34d399" width={72} height={22} />
      <DeltaBadge delta={delta} invert={invert} />
    </div>
  )
}

function MetricIcon({ name }) {
  const d = {
    check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    alert: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    rate: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z',
    closed: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d[name]} />
    </svg>
  )
}

function Sparkline({ values = [], color, width = 140, height = 36 }) {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length < 2) return <div style={{ height }} />
  const max = Math.max(...nums, 1)
  const min = Math.min(...nums, 0)
  const span = max - min || 1
  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * width
    const y = height - ((v - min) / span) * (height - 6) - 3
    return `${x},${y}`
  })
  const line = `M${pts.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity="0.16" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Donut({ slices, total, caption = 'Total Findings', size = 96 }) {
  const r = size * 0.31
  const c = 2 * Math.PI * r
  const cx = size / 2
  const sum = slices.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      {sum > 0 && slices.filter((s) => s.value > 0).map((slice) => {
        const len = (slice.value / sum) * c
        const el = (
          <circle
            key={slice.key}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={slice.color}
            strokeWidth="10"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )
        offset += len
        return el
      })}
      <text x={cx} y={cx - 2} textAnchor="middle" fontSize={size > 100 ? 16 : 14} fontWeight="700" fill="#111827">{fmt(total)}</text>
      <text x={cx} y={cx + 12} textAnchor="middle" fontSize="7" fill="#9ca3af">{caption}</text>
    </svg>
  )
}

function Gauge({ value = 0 }) {
  const pctVal = Math.min(1, Math.max(0, value))
  const r = 42
  const c = 2 * Math.PI * r
  const len = pctVal * c
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" className="flex-shrink-0">
      <circle cx="56" cy="56" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth="10"
        strokeDasharray={`${len} ${c - len}`}
        strokeLinecap="round"
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111827">{Math.round(pctVal * 100)}%</text>
      <text x="56" y="68" textAnchor="middle" fontSize="8" fill="#6b7280">Score</text>
    </svg>
  )
}

function PerformanceBadge({ value }) {
  const label = value >= 0.75 ? 'Good' : value >= 0.5 ? 'Fair' : 'Needs attention'
  const cls = value >= 0.75
    ? 'bg-emerald-100 text-emerald-700'
    : value >= 0.5
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>
}

function DeltaBadge({ delta, invert }) {
  if (delta == null || Number.isNaN(delta)) {
    return <span className="text-[10px] text-gray-400 w-16 text-right">vs last period</span>
  }
  const down = delta < 0
  const good = invert ? down : !down
  return (
    <span className={`text-[10px] font-medium w-20 text-right ${good ? 'text-emerald-600' : 'text-orange-600'}`}>
      {down ? '↓' : '↑'} {Math.abs(Math.round(delta * 100))}% vs last
    </span>
  )
}

function LandscapeMark() {
  return (
    <svg className="absolute right-3 top-14 w-28 h-16 opacity-40 pointer-events-none" viewBox="0 0 120 70" fill="none">
      <path d="M0 50 C20 40 30 55 50 48 C70 40 80 30 120 42 L120 70 L0 70 Z" fill="#bbf7d0" />
      <path d="M72 38 L75 18 L78 38 Z" fill="#86efac" />
      <path d="M90 40 L93 22 L96 40 Z" fill="#4ade80" />
      <circle cx="30" cy="28" r="8" fill="#86efac" />
      <circle cx="48" cy="32" r="6" fill="#4ade80" />
    </svg>
  )
}

function pct(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`
}

function fmt(value) {
  return Number(value || 0).toLocaleString()
}

function emptyAsset(key, label) {
  return { key, label: label || key, surveyed: 0, defects: 0, accepted: 0, pending: 0, rejected: 0, defective: 0, defect_rate: 0, trend: [] }
}

function emptyTotals() {
  return { surveyed: 0, defects: 0, accepted: 0, pending: 0, rejected: 0, defective: 0, defect_rate: 0, performance: 0 }
}

function normalizeOverview(data) {
  if (!data) return null
  return {
    assets: data.assets || [],
    breakdown: data.breakdown || {},
    hotspots: data.hotspots || [],
    totals: data.totals || emptyTotals(),
    deltas: data.deltas || {},
  }
}

function defectLabelMap(survey) {
  const sections = survey?.sections || (survey?.wizardSteps || []).flatMap((step) => step.sections || [])
  const map = {}
  for (const section of sections) {
    for (const field of section.fields || []) {
      if (field.hidden || field.name?.endsWith('_desc')) continue
      if (['gate_locked', 'is_surveyed', 'main_line', 'main_line_service', 'comply'].includes(field.name)) continue
      if (field.type === 'checkbox' || field.type === 'select') map[field.name] = field.label
    }
  }
  return map
}

function savrComponentsFromItems(items) {
  const used = new Set()
  const grouped = SAVR_GROUPS.map((group) => {
    const count = items
      .filter((item) => group.prefixes.some((prefix) => item.key.startsWith(prefix)))
      .reduce((sum, item) => {
        used.add(item.key)
        return sum + item.count
      }, 0)
    return { key: group.key, label: group.label, count }
  })
  const leftover = items.filter((item) => !used.has(item.key))
  grouped.push({
    key: 'others',
    label: leftover.length ? `Others (${leftover.length} components)` : 'Others',
    count: leftover.reduce((sum, item) => sum + item.count, 0),
  })
  grouped.sort((a, b) => b.count - a.count)
  return grouped
}

function bucketColumn(key) {
  const k = key.toLowerCase()
  if (k === 'ba' || k.startsWith('total')) return null
  if (HIDDEN_DEFECT_COLS.has(k)) return null
  return 'item'
}

async function loadFallback(params, bas) {
  const summary = await surveyApi.summary()
  const baLabel = params.ba_id
    ? (bas.find((b) => b.id === params.ba_id)?.short_name
      || bas.find((b) => b.id === params.ba_id)?.business_area
      || bas.find((b) => b.id === params.ba_id)?.label)
    : null

  const assets = []
  const breakdown = {}
  const hotspotMap = {}

  for (const key of ASSET_ORDER) {
    const survey = SURVEY_TYPES[key]
    const surveyed = summary?.[survey?.tableName?.replace('tbl_', '')] ?? 0
    const endpoint = COUNT_ENDPOINTS[key]
    const labels = defectLabelMap(survey)
    let rows = []
    if (endpoint) {
      try {
        rows = await surveyApi.dashboard(endpoint)
      } catch {
        rows = []
      }
    }
    if (baLabel) {
      rows = rows.filter((r) => String(r.ba || '').toLowerCase() === String(baLabel).toLowerCase())
    }

    const counts = {}
    let defects = 0
    const trend = []
    for (const row of rows) {
      let rowDefects = 0
      let rowTotal = 0
      for (const [col, val] of Object.entries(row)) {
        const n = Number(val) || 0
        if (bucketColumn(col)) {
          counts[col] = (counts[col] || 0) + n
          rowDefects += n
        } else if (col.startsWith('total')) {
          rowTotal += n
        }
      }
      defects += rowDefects
      trend.push(rowTotal || rowDefects)
      const loc = row.ba || 'Unnamed'
      hotspotMap[loc] = (hotspotMap[loc] || 0) + rowDefects
    }

    const items = Object.entries(counts)
      .map(([itemKey, count]) => ({
        key: itemKey,
        label: labels[itemKey] || itemKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count)

    const defective = Math.min(surveyed, defects)
    assets.push({
      key,
      label: survey?.title || key,
      surveyed,
      defects,
      findings: defects,
      accepted: 0,
      defective,
      defect_rate: surveyed ? defective / surveyed : 0,
      items_per_asset: surveyed ? defects / surveyed : 0,
      trend,
      chart: key === 'savr' ? 'components' : 'items',
    })
    breakdown[key] = {
      items,
      components: key === 'savr' ? savrComponentsFromItems(items) : null,
    }
  }

  const surveyed = assets.reduce((s, a) => s + a.surveyed, 0)
  const defects = assets.reduce((s, a) => s + a.defects, 0)
  const defective = assets.reduce((s, a) => s + a.defective, 0)
  const defect_rate = surveyed ? defective / surveyed : 0

  const hotspots = Object.entries(hotspotMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count], i) => ({ rank: i + 1, location, defects: count }))

  return {
    assets,
    breakdown,
    hotspots,
    totals: {
      surveyed,
      defects,
      accepted: 0,
      defective,
      defect_rate,
      performance: Math.max(0, 1 - defect_rate),
    },
    deltas: {},
  }
}
