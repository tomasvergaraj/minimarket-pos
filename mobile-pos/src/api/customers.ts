import { api } from './client'
import type { Customer, Sale } from '../types'

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

export async function getCustomer(customerId: string): Promise<Customer> {
  const { data } = await api.get<Customer>(`/customers/${customerId}`)
  return data
}

export async function getCustomerHistory(customerId: string, limit = 20): Promise<Sale[]> {
  const { data } = await api.get<Sale[]>(`/customers/${customerId}/history`, { params: { limit } })
  return data
}

export async function adjustCustomerPoints(customerId: string, delta: number): Promise<Customer> {
  const { data } = await api.post<Customer>(`/customers/${customerId}/adjust-points`, null, {
    params: { delta },
  })
  return data
}
