import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '../types'
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
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('admin_user')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User
        if (parsed.role === 'admin') return parsed
      } catch {
        // corrupted data
      }
      localStorage.removeItem('admin_user')
    }
    return null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loginWithPin = useCallback(async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const loggedUser = await loginService(pin)

      if (loggedUser.role !== 'admin') {
        throw new Error('Acceso denegado: se requiere rol de administrador')
      }

      localStorage.setItem('admin_user', JSON.stringify(loggedUser))
      setUser(loggedUser)
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
    localStorage.removeItem('admin_user')
    setUser(null)
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
