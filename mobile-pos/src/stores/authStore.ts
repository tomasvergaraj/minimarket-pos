import { create } from 'zustand'
import { Storage } from '../utils/storage'
import { setSession, clearSession, getSession } from '../api/client'
import type { AuthSession, User } from '../types'

const STORAGE_KEYS = [
  'auth_session', 'server_url', 'cash_session', 'cash_register',
  'receipt_auto', 'printer_mac', 'printer_name', 'printer_auto', 'printer_store_name',
]

interface AuthState {
  session: AuthSession | null
  user: User | null
  isLoading: boolean

  /** Carga desde AsyncStorage → caché en memoria. Llamar una sola vez al arrancar. */
  hydrate: () => Promise<void>

  login: (session: AuthSession) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,

  async hydrate() {
    await Storage.hydrate(STORAGE_KEYS)
    const stored = getSession()
    set({ session: stored, user: stored?.user ?? null, isLoading: false })
  },

  login(session: AuthSession) {
    setSession(session)
    set({ session, user: session.user })
  },

  logout() {
    clearSession()
    set({ session: null, user: null })
  },
}))
