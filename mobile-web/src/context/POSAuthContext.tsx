import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { User, StoredSession, CashSession, CashRegister } from '../types'
import { getStoredSession, setStoredSession, clearStoredSession } from '../lib/api'
import { loginWithPin as loginService } from '../lib/services'

const POS_CASH_KEY = 'pos_cash_session'
const POS_REGISTER_KEY = 'pos_register'

export interface POSCashState {
  session: CashSession
  register: CashRegister
}

interface POSAuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  cashState: POSCashState | null
  loginWithPin: (pin: string) => Promise<void>
  logout: () => void
  setCashState: (state: POSCashState | null) => void
}

const POSAuthContext = createContext<POSAuthContextValue | null>(null)

function getStoredCashState(): POSCashState | null {
  try {
    const raw = localStorage.getItem(POS_CASH_KEY)
    const rawReg = localStorage.getItem(POS_REGISTER_KEY)
    if (!raw || !rawReg) return null
    return { session: JSON.parse(raw), register: JSON.parse(rawReg) }
  } catch {
    return null
  }
}

function saveStoredCashState(state: POSCashState | null) {
  if (!state) {
    localStorage.removeItem(POS_CASH_KEY)
    localStorage.removeItem(POS_REGISTER_KEY)
  } else {
    localStorage.setItem(POS_CASH_KEY, JSON.stringify(state.session))
    localStorage.setItem(POS_REGISTER_KEY, JSON.stringify(state.register))
  }
}

export function POSAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => {
    const saved = getStoredSession()
    if (!saved) return null
    if (Date.parse(saved.expires_at) <= Date.now()) {
      clearStoredSession()
      return null
    }
    return saved
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cashState, setCashStateInternal] = useState<POSCashState | null>(getStoredCashState)

  const user = session?.user ?? null

  const loginWithPin = useCallback(async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const authSession = await loginService(pin)
      const storedSession: StoredSession = {
        ...authSession,
        expires_at: new Date(Date.now() + authSession.expires_in * 1000).toISOString(),
      }
      setStoredSession(storedSession)
      setSession(storedSession)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PIN incorrecto'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    saveStoredCashState(null)
    setSession(null)
    setCashStateInternal(null)
    setError(null)
  }, [])

  const setCashState = useCallback((state: POSCashState | null) => {
    saveStoredCashState(state)
    setCashStateInternal(state)
  }, [])

  return (
    <POSAuthContext.Provider value={{ user, loading, error, cashState, loginWithPin, logout, setCashState }}>
      {children}
    </POSAuthContext.Provider>
  )
}

export function usePOSAuth() {
  const ctx = useContext(POSAuthContext)
  if (!ctx) throw new Error('usePOSAuth must be used within POSAuthProvider')
  return ctx
}
