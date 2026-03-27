import { create } from 'zustand'
import { Storage } from '../utils/storage'
import type { CashRegister, CashSession } from '../types'

export const CASH_STORAGE_KEYS = ['cash_session', 'cash_register']

interface CashStore {
  session: CashSession | null
  register: CashRegister | null
  /** Reads from in-memory Storage cache (call after Storage.hydrate) */
  hydrate: () => void
  setSession: (session: CashSession, register: CashRegister) => void
  /** Update session totals after a sale (keeps register intact) */
  updateSession: (session: CashSession) => void
  clearSession: () => void
}

export const useCashStore = create<CashStore>((set) => ({
  session: null,
  register: null,

  hydrate: () => {
    set({
      session: Storage.get<CashSession>('cash_session'),
      register: Storage.get<CashRegister>('cash_register'),
    })
  },

  setSession: (session, register) => {
    Storage.set('cash_session', session)
    Storage.set('cash_register', register)
    set({ session, register })
  },

  updateSession: (session) => {
    Storage.set('cash_session', session)
    set({ session })
  },

  clearSession: () => {
    Storage.remove('cash_session')
    Storage.remove('cash_register')
    set({ session: null, register: null })
  },
}))
