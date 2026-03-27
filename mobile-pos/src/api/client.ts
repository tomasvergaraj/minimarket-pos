import axios from 'axios'
import { Storage } from '../utils/storage'
import type { AuthSession } from '../types'

const SESSION_KEY = 'auth_session'
const SERVER_URL_KEY = 'server_url'
const DEFAULT_URL = 'http://10.69.250.91:8001'  // cambiar por IP local del servidor

// ── Helpers de sesión ─────────────────────────────────────────────────────────

export function getSession(): AuthSession | null {
  return Storage.get<AuthSession>(SESSION_KEY)
}

export function setSession(session: AuthSession): void {
  Storage.set(SESSION_KEY, session)
}

export function clearSession(): void {
  Storage.remove(SESSION_KEY)
}

export function getServerUrl(): string {
  return Storage.get<string>(SERVER_URL_KEY) ?? DEFAULT_URL
}

export function setServerUrl(url: string): void {
  Storage.set(SERVER_URL_KEY, url.trim().replace(/\/$/, ''))
  api.defaults.baseURL = `${getServerUrl()}/api`
}

// ── Cliente Axios ─────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: `${getServerUrl()}/api`,
  timeout: 15000,
})

// Adjunta token JWT en cada request
api.interceptors.request.use((config) => {
  const session = getSession()
  if (session?.access_token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── Refresh token (mismo patrón que admin-web/src/lib/api.ts) ─────────────────

let _isRefreshing = false
let _refreshQueue: Array<(token: string) => void> = []

function _redirectToLogin() {
  clearSession()
  // authStore escucha el estado de sesión — solo limpiamos storage aquí
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      return Promise.reject(new Error('Sin conexión al servidor'))
    }

    const status = error.response.status
    const detail = error.response.data?.detail
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (status === 401) {
      if (original?.url?.includes('/users/refresh') || original?.url?.includes('/users/logout')) {
        _redirectToLogin()
        return Promise.reject(new Error('Sesión expirada'))
      }

      const session = getSession()
      if (!original._retry && session?.refresh_token) {
        if (_isRefreshing) {
          return new Promise((resolve) => {
            _refreshQueue.push((newToken) => {
              original.headers = original.headers ?? {}
              original.headers.Authorization = `Bearer ${newToken}`
              resolve(api(original))
            })
          })
        }

        original._retry = true
        _isRefreshing = true

        try {
          const { data } = await api.post('/users/refresh', {
            refresh_token: session.refresh_token,
          })
          const r = data.data as { access_token: string; refresh_token: string; expires_in: number }

          const updated: AuthSession = {
            ...session,
            access_token: r.access_token,
            refresh_token: r.refresh_token,
            expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
          }
          setSession(updated)

          _refreshQueue.forEach((cb) => cb(r.access_token))
          _refreshQueue = []

          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${r.access_token}`
          return api(original)
        } catch {
          _redirectToLogin()
          _refreshQueue = []
          return Promise.reject(new Error('Sesión expirada'))
        } finally {
          _isRefreshing = false
        }
      }

      _redirectToLogin()
      const msg = typeof detail === 'object' ? detail?.message : 'Sesión expirada'
      return Promise.reject(new Error(msg ?? 'Sesión expirada'))
    }

    if (detail) {
      const msg = typeof detail === 'object' ? detail.message : String(detail)
      return Promise.reject(new Error(msg))
    }

    return Promise.reject(new Error(`Error del servidor (${status})`))
  }
)

export default api
