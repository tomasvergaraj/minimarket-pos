import { api } from './client'

export type BusinessType = 'minimarket' | 'restaurant' | 'foodtruck' | 'cafeteria' | 'botilleria' | 'farmacia' | 'otro'

export interface StoreConfig {
  store_name: string
  business_type: BusinessType
}

export async function fetchStoreConfig(): Promise<StoreConfig> {
  const { data } = await api.get<StoreConfig>('/config')
  return data
}

export function orderLabel(businessType: string) {
  if (businessType === 'restaurant' || businessType === 'cafeteria' || businessType === 'foodtruck') {
    return { order: 'Comanda', orders: 'Comandas', ref: 'Mesa / Referencia' }
  }
  if (businessType === 'botilleria') {
    return { order: 'Pedido', orders: 'Pedidos', ref: 'Referencia' }
  }
  return { order: 'Comanda', orders: 'Comandas', ref: 'Referencia' }
}
