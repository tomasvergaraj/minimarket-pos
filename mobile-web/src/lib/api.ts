import axios from 'axios'
import type { StoredSession } from '../types'

const SESSION_KEY = 'pos_session'
const DEV_SERVER_PORT = '5175'

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

function resolveWindowOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:8001'
  if (window.location.port === DEV_SERVER_PORT) return 'http://localhost:8001'
  return window.location.origin
}

function getStoredServerUrl(): string | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('pos_server_url')
  return stored ? normalizeUrl(stored) : null
}

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return normalizeUrl(envUrl)

  const storedUrl = getStoredServerUrl()
  if (!storedUrl) return resolveWindowOrigin()

  try {
    const stored = new URL(storedUrl)
    const current = new URL(window.location.origin)
    const loopback = new Set(['localhost', '127.0.0.1'])
    if (stored.origin === current.origin) return resolveWindowOrigin()
    if (loopback.has(stored.hostname) && loopback.has(current.hostname)) return resolveWindowOrigin()
    return storedUrl
  } catch {
    return resolveWindowOrigin()
  }
}

const api = axios.create({
  baseURL: `${resolveBaseUrl()}/api`,
  timeout: 15000,
})

// ── Session helpers ──

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function setStoredSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ── Server URL helpers ──

export function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return normalizeUrl(envUrl)
  return getStoredServerUrl() ?? resolveWindowOrigin()
}

export function setServerUrl(url: string) {
  const normalized = normalizeUrl(url)
  localStorage.setItem('pos_server_url', normalized)
  api.defaults.baseURL = `${normalized}/api`
}

// ── Request interceptor: attach token ──

api.interceptors.request.use((config) => {
  const session = getStoredSession()
  if (session?.access_token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// ── Response interceptor: handle auth errors ──

let _isRefreshing = false
let _refreshQueue: Array<(token: string) => void> = []

function _redirectToLogin() {
  clearStoredSession()
  if (typeof window !== 'undefined') {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? ''
    const loginPath = `${base}/login`
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath
    }
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      return Promise.reject(new Error('No se pudo conectar al servidor'))
    }

    const status = error.response.status
    const detail = error.response.data?.detail
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (status === 401) {
      if (original?.url?.includes('/users/refresh') || original?.url?.includes('/users/logout')) {
        _redirectToLogin()
        return Promise.reject(new Error('Sesión expirada'))
      }

      const session = getStoredSession()
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
          const { data } = await api.post('/users/refresh', { refresh_token: session.refresh_token })
          const refreshData = data.data as { access_token: string; refresh_token: string; expires_in: number }
          const updated: StoredSession = {
            ...session,
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          }
          setStoredSession(updated)
          _refreshQueue.forEach((cb) => cb(refreshData.access_token))
          _refreshQueue = []
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${refreshData.access_token}`
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
      const msg = typeof detail === 'object' ? detail.message : 'Sesión expirada'
      return Promise.reject(new Error(msg))
    }

    if (detail) {
      const msg = typeof detail === 'object' ? detail.message : String(detail)
      return Promise.reject(new Error(msg))
    }

    return Promise.reject(new Error(`Error del servidor (${status})`))
  }
)

export default api
