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

export interface ProductsParams {
  search?: string
  category?: string
  active_only?: boolean
  skip?: number
  limit?: number
}

export async function listProducts(params?: ProductsParams): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products/', {
    params: { active_only: false, limit: 200, ...params },
  })
  return data
}

export async function updateProduct(
  productId: string,
  patch: Partial<Pick<Product, 'sell_price' | 'cost_price' | 'min_stock' | 'is_active'>>,
): Promise<Product> {
  const { data } = await api.put<Product>(`/products/${productId}`, patch)
  return data
}
