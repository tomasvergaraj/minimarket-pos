import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { StoredAdminSession, User } from '../types'
import {
  clearStoredAdminSession,
  getStoredAdminSession,
  setStoredAdminSession,
} from '../lib/api'
import { loginWithPin as loginService } from '../lib/services'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  loginWithPin: (pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredAdminSession | null>(() => {
    const saved = getStoredAdminSession()
    if (!saved) return null
    if (saved.user.role !== 'admin' || Date.parse(saved.expires_at) <= Date.now()) {
      clearStoredAdminSession()
      return null
    }
    return saved
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const user = session?.user ?? null

  const loginWithPin = useCallback(async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const authSession = await loginService(pin)
      const loggedUser = authSession.user

      if (loggedUser.role !== 'admin') {
        throw new Error('Acceso denegado: se requiere rol de administrador')
      }

      const storedSession: StoredAdminSession = {
        ...authSession,
        expires_at: new Date(Date.now() + authSession.expires_in * 1000).toISOString(),
      }
      setStoredAdminSession(storedSession)
      setSession(storedSession)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al iniciar sesión'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearStoredAdminSession()
    setSession(null)
    setError(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
