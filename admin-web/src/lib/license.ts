import type { LicenseStatus } from '../types'

export interface LicenseBlock {
  code: string
  message: string
}

export const LICENSE_ERROR_EVENT = 'nexo:license-error'

export function normalizeLicenseCode(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/-/g, '_')
    .toUpperCase()
}

export function isLicenseErrorCode(value?: string | null): boolean {
  const code = normalizeLicenseCode(value)
  return (
    code === 'TRIAL_EXPIRED' ||
    code === 'CLOCK_TAMPERED' ||
    code === 'HARDWARE_MISMATCH' ||
    code.startsWith('LICENSE_')
  )
}

export function getLicenseBlockFromStatus(status: LicenseStatus | null): LicenseBlock | null {
  if (!status || status.is_active) return null

  return {
    code: normalizeLicenseCode(status.status),
    message: status.message,
  }
}

export function readLicenseBlockDetail(detail: unknown): LicenseBlock | null {
  if (!detail || typeof detail !== 'object') return null

  const value = detail as Record<string, unknown>
  const code = normalizeLicenseCode(typeof value.code === 'string' ? value.code : '')
  const message = typeof value.message === 'string' ? value.message.trim() : ''

  if (!message || !isLicenseErrorCode(code)) return null

  return { code, message }
}

export function emitLicenseError(detail: LicenseBlock) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LICENSE_ERROR_EVENT, { detail }))
}
