import { api } from './client'
import type { Order, OrderCreate } from '../types'

export interface OrderPatch {
  items?: { product_id: string; quantity: number }[]
  reference?: string | null
  notes?: string | null
}

export async function listOrders(params?: { status?: string; register_id?: string; limit?: number }): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/orders/', { params: { limit: 50, ...params } })
  return data
}

export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await api.post<Order>('/orders/', payload)
  return data
}

export async function updateOrder(orderId: string, patch: OrderPatch): Promise<Order> {
  const { data } = await api.patch<Order>(`/orders/${orderId}`, patch)
  return data
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const { data } = await api.post<Order>(`/orders/${orderId}/cancel`)
  return data
}
