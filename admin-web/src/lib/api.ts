import axios from 'axios'
import type { StoredAdminSession } from '../types'
import { emitLicenseError, isLicenseErrorCode, normalizeLicenseCode } from './license'

const ADMIN_SESSION_KEY = 'admin_session'

function resolveAdminPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '')
  if (!base || base === '/') return normalizedPath
  return `${base}${normalizedPath}`
}

function resolveWindowOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:8000'

  const origin = window.location.origin
  if (window.location.port === '5174') {
    return 'http://localhost:8000'
  }

  return origin
}

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  return localStorage.getItem('admin_server_url') || resolveWindowOrigin()
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

// Handle API errors globally.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(new Error('No se pudo conectar al servidor'))
    }

    const status = error.response.status
    const detail = error.response.data?.detail

    if (status === 401) {
      const msg = typeof detail === 'object' ? detail.message : 'Sesion expirada'
      const loginPath = resolveAdminPath('/login')
      clearStoredAdminSession()
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath
      }
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
  localStorage.setItem('admin_server_url', url)
  api.defaults.baseURL = `${url}/api`
}

export function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  return localStorage.getItem('admin_server_url') || resolveWindowOrigin()
}

export default api
