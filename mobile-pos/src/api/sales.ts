import { api } from './client'
import type { Sale, SaleCreate } from '../types'

export async function createSale(payload: SaleCreate): Promise<Sale> {
  const { data } = await api.post<Sale>('/sales/', payload)
  return data
}
