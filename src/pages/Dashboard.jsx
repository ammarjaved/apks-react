import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { surveyApi } from '../api/surveys'
import { SURVEY_LIST } from '../config/surveyConfigs'
import Header from '../components/layout/Header'

const ICONS = {
  utilitypole: 'M12 2L4 22h16L12 2zM12 2v6M8 14h8',
  building: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01',
  box: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  bridge: 'M3 21V10a9 9 0 0118 0v11M3 10h18M3 16c2.5 0 2.5-2 6-2s3.5 2 6 2 3.5-2 6-2M7 10V4m10 6V4',
}

export default function Dashboard() {
  const { setSidebarOpen } = useOutletContext() || {}
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await surveyApi.summary()
        setSummary(data)
      } catch (err) {
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const perType = summary?.per_type || {}

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Overview of all inspection surveys" onMenuClick={() => setSidebarOpen?.(true)} />
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Records', value: summary.total_records || 0, color: 'bg-primary-50 text-primary-700' },
              { label: 'Pending QA', value: summary.pending_qa || 0, color: 'bg-yellow-50 text-yellow-700' },
              { label: 'Accepted', value: summary.accepted || 0, color: 'bg-green-50 text-green-700' },
              { label: 'Rejected', value: summary.rejected || 0, color: 'bg-red-50 text-red-700' },
            ].map((card) => (
              <div key={card.label} className={`card p-5 ${card.color}`}>
                <p className="text-sm opacity-75">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Survey type cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SURVEY_LIST.map((survey) => {
            const count = perType[survey.key] || perType[survey.key.replace(/_/g, '-')] || {}
            return (
              <Link
                key={survey.key}
                to={`/${survey.key}`}
                className="card p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${survey.color}15` }}
                  >
                    <svg
                      className="w-5 h-5"
                      style={{ color: survey.color }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[survey.icon] || ICONS.box} />
                    </svg>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                <p className="text-xs text-gray-500 mb-3">{survey.subtitle}</p>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex flex-col">
                    <span className="text-gray-400">Total</span>
                    <span className="font-semibold text-gray-700 text-base">{count.total || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Pending</span>
                    <span className="font-semibold text-yellow-600 text-base">{count.pending || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Accepted</span>
                    <span className="font-semibold text-green-600 text-base">{count.accepted || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Rejected</span>
                    <span className="font-semibold text-red-600 text-base">{count.rejected || 0}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
