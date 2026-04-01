import { api } from './client'
import { saveProductCache, searchOffline, getByBarcodeOffline } from '../db/productCache'
import type { Product } from '../types'

// ── Búsqueda con fallback offline ─────────────────────────────────────────────

/**
 * Busca productos en el servidor.
 * Si la llamada falla por red lanza `OfflineError` y devuelve resultados del caché local.
 * Propaga errores de autenticación (401/403) normalmente.
 */
export async function searchProducts(search: string): Promise<Product[]> {
  try {
    const { data } = await api.get<Product[]>('/products/', { params: { search, limit: 40 } })
    return data
  } catch (err: any) {
    // Fallback offline solo en errores de red (no en 4xx/5xx del servidor)
    if (!err?.response) {
      const offline = await searchOffline(search)
      if (offline.length > 0) return offline
    }
    throw err
  }
}

/**
 * Versión "sólo offline" para usar directamente cuando se sabe que no hay red.
 */
export async function searchProductsOffline(search: string): Promise<Product[]> {
  return searchOffline(search)
}

// ── Barcode con fallback offline ──────────────────────────────────────────────

export async function getByBarcode(barcode: string): Promise<Product> {
  try {
    const { data } = await api.get<Product>(`/products/barcode/${barcode}`)
    return data
  } catch (err: any) {
    if (!err?.response) {
      const cached = await getByBarcodeOffline(barcode)
      if (cached) return cached
    }
    throw err
  }
}

export async function getProductById(productId: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${productId}`)
  return data
}

// ── Listado completo (para sync del caché) ────────────────────────────────────

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

/**
 * Descarga el catálogo completo y lo guarda en caché local.
 * Llamar al abrir sesión de caja y al reconectar.
 * Devuelve el número de productos sincronizados.
 */
export async function syncProductCache(): Promise<number> {
  // Página de a 500 para cubrir catálogos grandes
  let all: Product[] = []
  let skip = 0
  const pageSize = 500

  while (true) {
    const page = await api.get<Product[]>('/products/', {
      params: { active_only: false, limit: pageSize, skip },
    })
    all = all.concat(page.data)
    if (page.data.length < pageSize) break
    skip += pageSize
  }

  await saveProductCache(all)
  return all.length
}

export async function updateProduct(
  productId: string,
  patch: Partial<Pick<Product, 'sell_price' | 'cost_price' | 'min_stock' | 'is_active'>>,
): Promise<Product> {
  const { data } = await api.put<Product>(`/products/${productId}`, patch)
  return data
}
