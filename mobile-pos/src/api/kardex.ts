import { api } from './client'

export type KardexMovementType = 'restock' | 'adjustment' | 'shrinkage'

export interface KardexCreate {
  product_id: string
  movement_type: KardexMovementType
  quantity: number
  notes?: string
}

export interface KardexOut {
  id: string
  product_id: string
  movement_type: string
  quantity: number
  stock_before: number
  stock_after: number
  notes?: string | null
  created_at: string
}

export async function adjustStock(payload: KardexCreate): Promise<KardexOut> {
  const { data } = await api.post<KardexOut>('/kardex/', payload)
  return data
}
