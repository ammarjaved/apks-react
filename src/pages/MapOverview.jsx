import { useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import MapView from '../components/map/MapView'
import Header from '../components/layout/Header'
import { VISIBLE_SURVEY_LIST, SURVEY_TYPES } from '../config/surveyConfigs'
import { useAuth } from '../context/AuthContext'

export default function MapOverview() {
  const { setSidebarOpen } = useOutletContext() || {}
  const navigate = useNavigate()
  const { user } = useAuth()
  const userBaId = user?.is_admin ? null : user?.ba_id
  const [selectedType, setSelectedType] = useState('all')
  const [filters, setFilters] = useState({ cycle: 1, qa_status: '' })

  const surveyConfig =
    selectedType === 'all'
      ? { title: 'All Surveys', tableName: null, color: '#3b82f6' }
      : SURVEY_TYPES[selectedType]

  const handlePointSelect = ({ table_name }) => {
    if (surveyConfig?.attachToPole && table_name === (surveyConfig.mapTableName || 'tbl_savr')) {
      navigate(`/${surveyConfig.key}`)
      return
    }
    const match = VISIBLE_SURVEY_LIST.find((s) => s.tableName === table_name)
    if (match) navigate(`/${match.key}`)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Map Overview" subtitle="All inspection points on interactive map" onMenuClick={() => setSidebarOpen?.(true)} />
      <div className="flex flex-col flex-1 p-4 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Survey Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Surveys</option>
            {VISIBLE_SURVEY_LIST.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Cycle:</label>
          <input
            type="number"
            value={filters.cycle}
            onChange={(e) => setFilters((prev) => ({ ...prev, cycle: e.target.value }))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-20 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">QA Status:</label>
          <select
            value={filters.qa_status}
            onChange={(e) => setFilters((prev) => ({ ...prev, qa_status: e.target.value }))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Accept">Accepted</option>
            <option value="Reject">Rejected</option>
          </select>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView
          surveyConfig={surveyConfig}
          filters={filters}
          baId={userBaId}
          onPointSelect={handlePointSelect}
          height={'100%'}
        />
      </div>
      </div>
    </div>
  )
}
