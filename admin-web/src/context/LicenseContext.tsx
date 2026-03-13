import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { fetchLicenseStatus } from '../lib/services'
import {
  LICENSE_ERROR_EVENT,
  getLicenseBlockFromStatus,
  readLicenseBlockDetail,
  type LicenseBlock,
} from '../lib/license'
import type { LicenseStatus } from '../types'

interface LicenseContextValue {
  licenseStatus: LicenseStatus | null
  loadingLicense: boolean
  blockingLicense: LicenseBlock | null
  refreshLicenseStatus: () => Promise<LicenseStatus | null>
  syncLicenseStatus: (status: LicenseStatus | null) => void
  clearBlockingLicense: () => void
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)
  const [loadingLicense, setLoadingLicense] = useState(false)
  const [blockingLicense, setBlockingLicense] = useState<LicenseBlock | null>(null)

  const syncLicenseStatus = (status: LicenseStatus | null) => {
    setLicenseStatus(status)
    setBlockingLicense(getLicenseBlockFromStatus(status))
  }

  const refreshLicenseStatus = async () => {
    if (!user) {
      syncLicenseStatus(null)
      return null
    }

    setLoadingLicense(true)
    try {
      const status = await fetchLicenseStatus()
      syncLicenseStatus(status)
      return status
    } finally {
      setLoadingLicense(false)
    }
  }

  const clearBlockingLicense = () => {
    setBlockingLicense(null)
  }

  useEffect(() => {
    if (!user) {
      syncLicenseStatus(null)
      return
    }

    let ignore = false

    setLoadingLicense(true)
    fetchLicenseStatus()
      .then((status) => {
        if (ignore) return
        syncLicenseStatus(status)
      })
      .catch(() => {
        if (ignore) return
      })
      .finally(() => {
        if (!ignore) setLoadingLicense(false)
      })

    return () => {
      ignore = true
    }
  }, [user])

  useEffect(() => {
    const handleLicenseError = (event: Event) => {
      const detail = readLicenseBlockDetail((event as CustomEvent).detail)
      if (detail) {
        setBlockingLicense(detail)
      }
    }

    window.addEventListener(LICENSE_ERROR_EVENT, handleLicenseError)
    return () => window.removeEventListener(LICENSE_ERROR_EVENT, handleLicenseError)
  }, [])

  return (
    <LicenseContext.Provider
      value={{
        licenseStatus,
        loadingLicense,
        blockingLicense,
        refreshLicenseStatus,
        syncLicenseStatus,
        clearBlockingLicense,
      }}
    >
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  const ctx = useContext(LicenseContext)
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider')
  return ctx
}
