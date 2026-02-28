import axios from 'axios'

function resolveBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl
  return localStorage.getItem('admin_server_url') || 'http://localhost:8000'
}

const api = axios.create({
  baseURL: `${resolveBaseUrl()}/api`,
  timeout: 15000,
})

// Inject admin role header
api.interceptors.request.use((config) => {
  const userJson = localStorage.getItem('admin_user')
  if (userJson) {
    try {
      const user = JSON.parse(userJson)
      if (user.role === 'admin') {
        config.headers['X-User-Role'] = 'admin'
      }
    } catch {
      // corrupted localStorage — ignore
    }
  }
  return config
})

// Handle API errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(new Error('No se pudo conectar al servidor'))
    }

    const status = error.response.status
    const detail = error.response.data?.detail

    // Session expired or forbidden — force logout
    if (status === 401 || status === 403) {
      const msg = typeof detail === 'object' ? detail.message : 'Sesión expirada'
      localStorage.removeItem('admin_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error(msg))
    }

    // Extract server error message
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
  return localStorage.getItem('admin_server_url') || 'http://localhost:8000'
}

export default api
