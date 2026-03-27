import { api } from './client'
import type { Product } from '../types'

export async function searchProducts(search: string): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products/', { params: { search, limit: 40 } })
  return data
}

export async function getByBarcode(barcode: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/barcode/${barcode}`)
  return data
}

export async function getProductById(productId: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${productId}`)
  return data
}
