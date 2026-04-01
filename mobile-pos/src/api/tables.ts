import { api } from './client'

export interface TableStatus {
  id: string
  name: string
  capacity: number
  is_active: boolean
  status: 'free' | 'occupied' | 'bill_requested'
  order_id: string | null
  order_number: number | null
}

export async function fetchTableStatuses(): Promise<TableStatus[]> {
  const { data } = await api.get<TableStatus[]>('/tables/status')
  return data
}
