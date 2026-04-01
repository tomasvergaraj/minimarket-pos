/**
 * Cache de productos en AsyncStorage.
 *
 * El catálogo completo se guarda como JSON bajo la clave `product_cache_v1`.
 * Al abrir sesión de caja se sincroniza con el servidor.
 * Si la API no responde, `searchProducts` lee de aquí.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Product } from '../types'

const CACHE_KEY    = 'product_cache_v1'
const CACHE_AT_KEY = 'product_cache_at'

// ── Escritura ─────────────────────────────────────────────────────────────────

export async function saveProductCache(products: Product[]): Promise<void> {
  const payload = JSON.stringify(products)
  await AsyncStorage.multiSet([
    [CACHE_KEY,    payload],
    [CACHE_AT_KEY, new Date().toISOString()],
  ])
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function getProductCache(): Promise<Product[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as Product[] } catch { return null }
}

export async function getCacheInfo(): Promise<{ count: number; at: Date } | null> {
  const [[, raw], [, at]] = await AsyncStorage.multiGet([CACHE_KEY, CACHE_AT_KEY])
  if (!raw || !at) return null
  try {
    const products = JSON.parse(raw) as Product[]
    return { count: products.length, at: new Date(at) }
  } catch { return null }
}

// ── Búsqueda offline ──────────────────────────────────────────────────────────

export async function searchOffline(query: string): Promise<Product[]> {
  const products = await getProductCache()
  if (!products) return []
  const q = query.toLowerCase().trim()
  return products
    .filter(
      (p) =>
        p.is_active !== false &&
        (p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode != null && p.barcode.toLowerCase().includes(q))),
    )
    .slice(0, 40)
}

export async function getByBarcodeOffline(barcode: string): Promise<Product | null> {
  const products = await getProductCache()
  if (!products) return null
  return products.find((p) => p.barcode === barcode && p.is_active !== false) ?? null
}

// ── Limpieza ──────────────────────────────────────────────────────────────────

export async function clearProductCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, CACHE_AT_KEY])
}
