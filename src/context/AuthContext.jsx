import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      if (authApi.isAuthenticated()) {
        const stored = authApi.getStoredUser()
        if (stored) {
          setUser(stored)
        }
        try {
          const fresh = await authApi.me()
          setUser(fresh)
        } catch {
          authApi.logout()
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = useCallback(async (email, password) => {
    await authApi.login(email, password)
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const hasRole = useCallback((...roles) => {
    if (!user) return false
    const userRoles = user.roles || []
    return userRoles.some((r) => roles.includes(r)) || userRoles.includes('admin')
  }, [user])

  // TNB viewer: read-only, QA-accepted records only, no QR. The API enforces
  // the same; this only keeps the UI from offering what it would refuse.
  const isTnb = useMemo(() => {
    if (!user || user.is_admin) return false
    const userRoles = user.roles || []
    return userRoles.includes('tnb') && !userRoles.includes('admin')
  }, [user])

  const value = { user, loading, login, logout, hasRole, isTnb }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
