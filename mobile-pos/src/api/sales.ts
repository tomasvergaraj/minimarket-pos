import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api, getSession, getServerUrl } from './client'
import { Storage } from '../utils/storage'
import type { Sale, SaleCreate, PaginatedResponse } from '../types'

// ── Preferencia de boleta automática ─────────────────────────────────────────
export const RECEIPT_AUTO_KEY = 'receipt_auto'

export function getReceiptPref(): boolean {
  return Storage.get<boolean>(RECEIPT_AUTO_KEY) ?? true   // encendido por defecto
}

export function setReceiptPref(enabled: boolean): void {
  Storage.set(RECEIPT_AUTO_KEY, enabled)
}

export interface SalesParams {
  date_from?: string
  date_to?: string
  register_id?: string
  status?: 'completed' | 'voided'
  skip?: number
  limit?: number
}

export async function createSale(payload: SaleCreate): Promise<Sale> {
  const { data } = await api.post<Sale>('/sales/', payload)
  return data
}

export async function listSales(params?: SalesParams): Promise<PaginatedResponse<Sale>> {
  const { data } = await api.get<PaginatedResponse<Sale>>('/sales/', { params })
  return data
}

export async function getSale(saleId: string): Promise<Sale> {
  const { data } = await api.get<Sale>(`/sales/${saleId}`)
  return data
}

export async function voidSale(saleId: string): Promise<Sale> {
  const { data } = await api.post<Sale>(`/sales/${saleId}/void`)
  return data
}

export async function downloadReceipt(saleId: string, saleNumber: number): Promise<void> {
  const session = getSession()
  if (!session?.access_token) throw new Error('Sin sesión activa')
  const url = `${getServerUrl()}/api/sales/${saleId}/receipt.pdf`
  const dest = new File(Paths.cache, `boleta-${saleNumber}.pdf`)
  const file = await File.downloadFileAsync(url, dest, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Boleta #${saleNumber}`,
    })
  }
}
