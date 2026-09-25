import { NavLink, useNavigate } from 'react-router-dom'
import { VISIBLE_SURVEY_LIST } from '../../config/surveyConfigs'
import { useAuth } from '../../context/AuthContext'

const ICONS = {
  utilitypole: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L4 22h16L12 2zM12 2v6M8 14h8" />
  ),
  building: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  ),
  box: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
  ),
  link: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  ),
  bridge: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V10a9 9 0 0118 0v11M3 10h18M3 16c2.5 0 2.5-2 6-2s3.5 2 6 2 3.5-2 6-2M7 10V4m10 6V4" />
  ),
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
  ),
  ruler: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20L20 4M8 16l1-1M11 13l1-1M14 10l1-1M7 19l2 2M17 9l2 2" />
  ),
  route: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19a2 2 0 100-4 2 2 0 000 4zm16-10a2 2 0 100-4 2 2 0 000 4zM6 17c6 0 4-10 10-10" />
  ),
}

const navItemClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-gray-600 hover:bg-gray-100'
  }`

export default function Sidebar({ open, onClose }) {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const canManageUsers = hasRole('admin', 'manager')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-40 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-200">
          <img src={`${import.meta.env.BASE_URL}main-logo.ico`} alt="APKS" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          <div>
            <p className="font-bold text-gray-900 leading-none">APKS</p>
            <p className="text-xs text-gray-500">Inspection System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavLink
            to="/"
            end
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Overview
          </NavLink>

          <div className="pt-3 pb-1 px-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inspections</p>
          </div>

          {VISIBLE_SURVEY_LIST.map((survey) => (
            <NavLink key={survey.key} to={`/${survey.key}`} className={navItemClass} onClick={() => onClose?.()}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {ICONS[survey.icon] || ICONS.box}
              </svg>
              <div className="flex-1 min-w-0">
                <p className="truncate">{survey.title}</p>
              </div>
            </NavLink>
          ))}

          {/*
            Patrolling is field work like the inspections above, but it is not a
            survey module — its records are whole routes uploaded as KML, so it
            has its own page rather than a SURVEY_LIST entry.
          */}
          <NavLink to="/patroling" className={navItemClass} onClick={() => onClose?.()}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {ICONS.route}
            </svg>
            <div className="flex-1 min-w-0">
              <p className="truncate">Patrolling</p>
            </div>
          </NavLink>

          <div className="pt-3 pb-1 px-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Map</p>
          </div>

          <NavLink to="/map" className={navItemClass} onClick={() => onClose?.()}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map Overview
          </NavLink>

          {canManageUsers && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              </div>

              <NavLink to="/users" className={navItemClass}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                User Management
              </NavLink>

              <NavLink to="/productivity" className={navItemClass} onClick={() => onClose?.()}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Productivity
              </NavLink>

              {hasRole('admin') && (
                <NavLink to="/teams" className={navItemClass} onClick={() => onClose?.()}>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.5-1.34" />
                  </svg>
                  Team Management
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{user?.roles?.join(', ')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full btn-sm">
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
