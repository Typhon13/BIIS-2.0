import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const bootstrapStarted = useRef(false)

  useEffect(() => {
    if (bootstrapStarted.current) return
    bootstrapStarted.current = true

    async function restoreSession() {
      try {
        const response = await authApi.refresh()
        setAccessToken(response.data.accessToken)
        setUser(response.data.user)
      } catch {
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  useEffect(() => {
    const timeoutMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES || 30)
    const timeoutMs = Math.max(timeoutMinutes, 1) * 60 * 1000
    let timer
    const resetTimer = () => {
      window.clearTimeout(timer)
      if (accessToken && user) {
        timer = window.setTimeout(async () => {
          await logout()
          window.dispatchEvent(new CustomEvent('biis-idle-logout'))
        }, timeoutMs)
      }
    }
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      window.clearTimeout(timer)
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer))
    }
  }, [accessToken, user])

  useEffect(() => {
    function handleRefreshedSession(event) {
      setAccessToken(event.detail?.accessToken || null)
      setUser(event.detail?.user || null)
    }

    function handleExpiredSession() {
      setAccessToken(null)
      setUser(null)
    }

    window.addEventListener('biis-auth-refreshed', handleRefreshedSession)
    window.addEventListener('biis-auth-expired', handleExpiredSession)
    return () => {
      window.removeEventListener('biis-auth-refreshed', handleRefreshedSession)
      window.removeEventListener('biis-auth-expired', handleExpiredSession)
    }
  }, [])

  async function login(identifier, password) {
    const response = await authApi.login({ identifier, password })

    setAccessToken(response.data.accessToken)
    setUser(response.data.user)

    return response.data.user
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }

  const value = useMemo(
    () => ({
      accessToken,
      user,
      isLoading,
      isAuthenticated: Boolean(accessToken && user),
      login,
      logout,
    }),
    [accessToken, user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}