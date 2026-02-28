import api, { getServerUrl } from './api'
import {
  mockUsers,
  mockProducts,
  mockSales,
  mockRegisters,
  mockSessions,
  mockKardex,
  mockDashboardStats,
  mockConfig,
} from './mock-data'
import type {
  User,
  UserCreate,
  UserUpdate,
  Product,
  ProductCreate,
  ProductUpdate,
  Sale,
  CashRegister,
  CashSession,
  KardexEntry,
  KardexCreate,
  DashboardStats,
  StoreConfig,
  PaginationMeta,
} from '../types'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Dashboard ──

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCKS) {
    await delay(500)
    return mockDashboardStats
  }
  const res = await api.get('/dashboard/stats')
  return res.data.data
}

// ── Products ──

interface FetchProductsParams {
  search?: string
  category?: string
  active_only?: boolean
  skip?: number
  limit?: number
}

export async function fetchProducts(
  params: FetchProductsParams = {}
): Promise<{ data: Product[]; meta: PaginationMeta }> {
  if (USE_MOCKS) {
    await delay()
    let result = [...mockProducts]
    if (params.active_only !== false) result = result.filter((p) => p.is_active)
    if (params.search) {
      const q = params.search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode?.includes(q)
      )
    }
    if (params.category) result = result.filter((p) => p.category === params.category)
    return {
      data: result,
      meta: { total: result.length, skip: 0, limit: 50, has_more: false },
    }
  }
  const res = await api.get('/products/', { params })
  // Backend returns plain list[ProductOut], not {data, meta}
  const data: Product[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
  return {
    data,
    meta: res.data.meta ?? { total: data.length, skip: 0, limit: 50, has_more: false },
  }
}

export async function fetchCategories(): Promise<string[]> {
  if (USE_MOCKS) {
    await delay(200)
    return [...new Set(mockProducts.map((p) => p.category).filter(Boolean))] as string[]
  }
  const res = await api.get('/products/categories/list')
  return res.data.data ?? res.data
}

export async function createProduct(data: ProductCreate): Promise<Product> {
  if (USE_MOCKS) {
    await delay()
    const product: Product = {
      id: `p-${Date.now()}`,
      sku: data.sku,
      barcode: data.barcode ?? null,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      unit: data.unit ?? 'un',
      cost_price: data.cost_price ?? 0,
      sell_price: data.sell_price,
      tax_rate: data.tax_rate ?? 19,
      stock: data.stock ?? 0,
      min_stock: data.min_stock ?? 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return product
  }
  const res = await api.post('/products/', data)
  return res.data.data ?? res.data
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  if (USE_MOCKS) {
    await delay()
    const existing = mockProducts.find((p) => p.id === id)
    return { ...existing!, ...data, updated_at: new Date().toISOString() }
  }
  const res = await api.put(`/products/${id}`, data)
  return res.data.data ?? res.data
}

export async function deleteProduct(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    return
  }
  await api.delete(`/products/${id}`)
}

// ── Sales ──

interface FetchSalesParams {
  date_from?: string
  date_to?: string
  register_id?: string
  status?: string
  skip?: number
  limit?: number
}

export async function fetchSales(
  params: FetchSalesParams = {}
): Promise<{ data: Sale[]; meta: PaginationMeta }> {
  if (USE_MOCKS) {
    await delay()
    let result = [...mockSales]
    if (params.status) result = result.filter((s) => s.status === params.status)
    if (params.date_from) result = result.filter((s) => s.created_at >= params.date_from!)
    if (params.date_to) result = result.filter((s) => s.created_at <= params.date_to! + 'T23:59:59')
    return {
      data: result,
      meta: { total: result.length, skip: 0, limit: 50, has_more: false },
    }
  }
  const res = await api.get('/sales/', { params })
  return { data: res.data.data, meta: res.data.meta }
}

export async function fetchSale(id: string): Promise<Sale> {
  if (USE_MOCKS) {
    await delay(200)
    return mockSales.find((s) => s.id === id)!
  }
  const res = await api.get(`/sales/${id}`)
  return res.data.data ?? res.data
}

export async function voidSale(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    return
  }
  await api.post(`/sales/${id}/void`)
}

// ── Cash ──

export async function fetchRegisters(): Promise<CashRegister[]> {
  if (USE_MOCKS) {
    await delay(200)
    return [...mockRegisters]
  }
  const res = await api.get('/cash/registers')
  return res.data.data ?? res.data
}

export async function createRegister(name: string): Promise<CashRegister> {
  if (USE_MOCKS) {
    await delay()
    return {
      id: `r-${Date.now()}`,
      name,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  }
  const res = await api.post('/cash/registers', { name })
  return res.data.data ?? res.data
}

interface FetchSessionsParams {
  register_id?: string
  status?: string
  date_from?: string
  date_to?: string
  skip?: number
  limit?: number
}

export async function fetchSessions(
  params: FetchSessionsParams = {}
): Promise<{ data: CashSession[]; meta: PaginationMeta }> {
  if (USE_MOCKS) {
    await delay()
    let result = [...mockSessions]
    if (params.status) result = result.filter((s) => s.status === params.status)
    if (params.register_id) result = result.filter((s) => s.register_id === params.register_id)
    if (params.date_from) result = result.filter((s) => s.opened_at >= params.date_from!)
    if (params.date_to) result = result.filter((s) => s.opened_at <= params.date_to! + 'T23:59:59')
    return {
      data: result,
      meta: { total: result.length, skip: 0, limit: 50, has_more: false },
    }
  }
  const res = await api.get('/cash/sessions', { params })
  return { data: res.data.data, meta: res.data.meta }
}

// ── Users ──

export async function fetchUsers(): Promise<User[]> {
  if (USE_MOCKS) {
    await delay()
    return [...mockUsers]
  }
  const res = await api.get('/users/')
  return res.data.data ?? res.data
}

export async function createUser(data: UserCreate): Promise<User> {
  if (USE_MOCKS) {
    await delay()
    return {
      id: `u-${Date.now()}`,
      username: data.username,
      full_name: data.full_name,
      role: data.role,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  }
  const res = await api.post('/users/', data)
  return res.data.data ?? res.data
}

export async function updateUser(id: string, data: UserUpdate): Promise<User> {
  if (USE_MOCKS) {
    await delay()
    const existing = mockUsers.find((u) => u.id === id)
    return { ...existing!, ...data }
  }
  const res = await api.put(`/users/${id}`, data)
  return res.data.data ?? res.data
}

// ── Auth ──

export async function loginWithPin(pin: string): Promise<User> {
  if (USE_MOCKS) {
    await delay()
    if (pin === '1234') return mockUsers[0]
    if (pin === '0000') return mockUsers[1]
    throw new Error('PIN incorrecto')
  }
  const res = await api.post('/users/login/pin', { pin })
  return res.data.data ?? res.data
}

// ── Inventory / Kardex ──

export async function fetchKardex(productId: string): Promise<KardexEntry[]> {
  if (USE_MOCKS) {
    await delay(200)
    return mockKardex.filter((k) => k.product_id === productId)
  }
  const res = await api.get(`/kardex/product/${productId}`)
  return res.data.data ?? res.data
}

export async function createMovement(data: KardexCreate): Promise<KardexEntry> {
  if (USE_MOCKS) {
    await delay()
    return {
      id: `k-${Date.now()}`,
      product_id: data.product_id,
      movement_type: data.movement_type,
      quantity: data.quantity,
      stock_before: 0,
      stock_after: data.quantity,
      reference_id: null,
      notes: data.notes ?? null,
      user_id: data.user_id ?? null,
      created_at: new Date().toISOString(),
    }
  }
  const res = await api.post('/kardex/', data)
  return res.data.data ?? res.data
}

// ── Config ──

export async function fetchConfig(): Promise<StoreConfig> {
  if (USE_MOCKS) {
    await delay(200)
    return { ...mockConfig }
  }
  const res = await api.get('/config')
  return res.data.data ?? res.data
}

export async function updateConfig(data: StoreConfig): Promise<StoreConfig> {
  if (USE_MOCKS) {
    await delay()
    return { ...data }
  }
  const res = await api.put('/config', data)
  return res.data.data ?? res.data
}

// ── Reports ──

export async function downloadReport(
  type: 'sales' | 'inventory',
  params?: { date_from?: string; date_to?: string }
): Promise<Blob> {
  if (USE_MOCKS) {
    await delay(1000)
    return new Blob(['mock report'], { type: 'application/octet-stream' })
  }
  const queryParams = new URLSearchParams()
  if (params?.date_from) queryParams.set('date_from', params.date_from)
  if (params?.date_to) queryParams.set('date_to', params.date_to)

  const url = `${getServerUrl()}/api/reports/${type}.xlsx${queryParams.toString() ? '?' + queryParams : ''}`
  const res = await api.get(url, { responseType: 'blob' })
  return new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
