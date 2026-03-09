import axios from 'axios'

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

// Inject admin role header.
api.interceptors.request.use((config) => {
  const userJson = localStorage.getItem('admin_user')
  if (userJson) {
    try {
      const user = JSON.parse(userJson)
      if (user.role === 'admin') {
        config.headers['X-User-Role'] = 'admin'
      }
    } catch {
      // Ignore corrupted localStorage.
    }
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

    if (status === 401 || status === 403) {
      const msg = typeof detail === 'object' ? detail.message : 'Sesion expirada'
      const loginPath = resolveAdminPath('/login')
      localStorage.removeItem('admin_user')
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath
      }
      return Promise.reject(new Error(msg))
    }

    if (detail) {
      const msg = typeof detail === 'object' ? detail.message : String(detail)
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
