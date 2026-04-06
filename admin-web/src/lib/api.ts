import axios from 'axios'
import type { StoredAdminSession } from '../types'
import { emitLicenseError, isLicenseErrorCode, normalizeLicenseCode } from './license'

const ADMIN_SESSION_KEY = 'admin_session'
const DEV_SERVER_PORT = '5174'

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '')
}

function resolveAdminPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '')
  if (!base || base === '/') return normalizedPath
  return `${base}${normalizedPath}`
}

function resolveWindowOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:8001'

  const origin = window.location.origin
  if (window.location.port === DEV_SERVER_PORT) {
    return 'http://localhost:8001'
  }

  return origin
}

function getStoredServerUrl(): string | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem('admin_server_url')
  if (!stored) return null
  return normalizeUrl(stored)
}

function shouldPreferWindowOrigin(storedUrl: string | null): boolean {
  if (typeof window === 'undefined') return storedUrl == null
  if (window.location.port === DEV_SERVER_PORT) return false
  if (!storedUrl) return true

  try {
    const stored = new URL(storedUrl)
    const current = new URL(window.location.origin)
    const loopbackHosts = new Set(['localhost', '127.0.0.1'])

    if (stored.origin === current.origin) return true

    // When the admin is hosted by the backend, stale local loopback URLs
    // should not override the current server origin after a port change.
    if (loopbackHosts.has(stored.hostname) && loopbackHosts.has(current.hostname)) {
      return true
    }

    return false
  } catch {
    return true
  }
}

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return normalizeUrl(envUrl)

  const storedUrl = getStoredServerUrl()
  if (shouldPreferWindowOrigin(storedUrl)) {
    return resolveWindowOrigin()
  }

  return storedUrl ?? resolveWindowOrigin()
}

const api = axios.create({
  baseURL: `${resolveBaseUrl()}/api`,
  timeout: 15000,
})

export function getStoredAdminSession(): StoredAdminSession | null {
  const raw = localStorage.getItem(ADMIN_SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredAdminSession
  } catch {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    return null
  }
}

export function setStoredAdminSession(session: StoredAdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function clearStoredAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}


api.interceptors.request.use((config) => {
  const session = getStoredAdminSession()
  if (session?.access_token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Refresh token machinery
let _isRefreshing = false
let _refreshQueue: Array<(token: string) => void> = []

function _redirectToLogin() {
  clearStoredAdminSession()
  const loginPath = resolveAdminPath('/login')
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}

// Handle API errors globally.
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
      // If it's the refresh endpoint itself that 401'd, bail out entirely
      if (original?.url?.includes('/users/refresh') || original?.url?.includes('/users/logout')) {
        _redirectToLogin()
        return Promise.reject(new Error('Sesión expirada'))
      }

      const session = getStoredAdminSession()
      if (!original._retry && session?.refresh_token) {
        if (_isRefreshing) {
          // Queue until refresh resolves
          return new Promise((resolve, _reject) => {
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

          const updated = {
            ...session,
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          }
          setStoredAdminSession(updated)

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
      const code = typeof detail === 'object' ? normalizeLicenseCode(detail.code) : ''
      if (status === 403 && isLicenseErrorCode(code)) {
        emitLicenseError({ code, message: msg })
      }
      return Promise.reject(new Error(msg))
    }

    return Promise.reject(new Error(`Error del servidor (${status})`))
  }
)

export function setServerUrl(url: string) {
  const normalized = normalizeUrl(url)
  localStorage.setItem('admin_server_url', normalized)
  api.defaults.baseURL = `${resolveBaseUrl()}/api`
}

export function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return normalizeUrl(envUrl)

  const storedUrl = getStoredServerUrl()
  if (shouldPreferWindowOrigin(storedUrl)) {
    return resolveWindowOrigin()
  }

  return storedUrl ?? resolveWindowOrigin()
}

export default api
