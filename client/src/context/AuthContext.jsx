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