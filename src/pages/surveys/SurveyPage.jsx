import { useOutletContext } from 'react-router-dom'
import SurveyModule from '../../components/surveys/SurveyModule'
import { SURVEY_TYPES } from '../../config/surveyConfigs'
import Header from '../../components/layout/Header'

export default function SurveyPage({ surveyKey }) {
  const { setSidebarOpen } = useOutletContext() || {}
  const config = SURVEY_TYPES[surveyKey]
  if (!config) return <div className="p-6">Unknown survey type</div>

  return (
    <div className="flex flex-col h-full">
      <Header title={config.title} subtitle={config.subtitle} onMenuClick={() => setSidebarOpen?.(true)} />
      <div className="flex-1 overflow-hidden">
        <SurveyModule config={config} />
      </div>
    </div>
  )
}
