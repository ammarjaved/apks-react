import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MapOverview from './pages/MapOverview'
import Patroling from './pages/Patroling'
import AdminUsers from './pages/AdminUsers'
import AdminTeams from './pages/AdminTeams'
import AdminProductivity from './pages/AdminProductivity'
import SurveyPage from './pages/surveys/SurveyPage'
import { VISIBLE_SURVEY_LIST } from './config/surveyConfigs'

export default function App() {
  return (
    <AuthProvider>
      {/*
        HashRouter keeps every route after the `#`, so the browser never asks
        the web server for /login or /substation. That means deep links and
        refreshes work on a plain static host with no rewrite rules.
      */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />

            <Route path="/map" element={<MapOverview />} />

            <Route path="/patroling" element={<Patroling />} />

            <Route path="/users" element={<AdminUsers />} />

            <Route path="/teams" element={<AdminTeams />} />

            <Route path="/productivity" element={<AdminProductivity />} />

            {VISIBLE_SURVEY_LIST.map((survey) => (
              <Route
                key={survey.key}
                path={`/${survey.key}`}
                element={<SurveyPage key={survey.key} surveyKey={survey.key} />}
              />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
