import { api } from './client'
import type { Customer } from '../types'

export interface LoyaltyConfig {
  points_per_thousand: number
  point_value: number
}

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  const { data } = await api.get<Customer[]>('/customers/search', { params: { q, limit } })
  return data
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const { data } = await api.get<LoyaltyConfig>('/customers/loyalty-config')
  return data
}
