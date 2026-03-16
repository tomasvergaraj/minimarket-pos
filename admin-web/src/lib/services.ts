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
  AuthSession,
  LicenseStatus,
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
      is_pack: data.is_pack ?? false,
      units_contained: data.units_contained ?? 1,
      base_product_id: data.base_product_id ?? null,
      discount_price: data.discount_price ?? null,
      discount_ends_at: data.discount_ends_at ?? null,
      is_on_offer: data.discount_price != null,
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

interface FetchRegistersParams {
  includeInactive?: boolean
}

export async function fetchRegisters(
  params: FetchRegistersParams = {}
): Promise<CashRegister[]> {
  if (USE_MOCKS) {
    await delay(200)
    const result = [...mockRegisters]
    return params.includeInactive ? result : result.filter((register) => register.is_active)
  }
  const res = await api.get('/cash/registers', {
    params: {
      include_inactive: params.includeInactive ? true : undefined,
    },
  })
  return res.data.data ?? res.data
}

export async function createRegister(name: string): Promise<CashRegister> {
  if (USE_MOCKS) {
    await delay()
    const register: CashRegister = {
      id: `r-${Date.now()}`,
      name,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    mockRegisters.push(register)
    return register
  }
  const res = await api.post('/cash/registers', { name })
  return res.data.data ?? res.data
}

export async function updateRegister(
  id: string,
  data: { name?: string; is_active?: boolean }
): Promise<CashRegister> {
  if (USE_MOCKS) {
    await delay()
    const index = mockRegisters.findIndex((register) => register.id === id)
    if (index === -1) {
      throw new Error('Caja no encontrada')
    }

    mockRegisters[index] = {
      ...mockRegisters[index],
      ...data,
    }
    return mockRegisters[index]
  }
  const res = await api.put(`/cash/registers/${id}`, data)
  return res.data.data ?? res.data
}

export async function deleteRegister(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    const index = mockRegisters.findIndex((register) => register.id === id)
    if (index >= 0) {
      mockRegisters.splice(index, 1)
    }
    return
  }
  await api.delete(`/cash/registers/${id}`)
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

export async function loginWithPin(pin: string): Promise<AuthSession> {
  if (USE_MOCKS) {
    await delay()
    const user = pin === '1234' ? mockUsers[0] : pin === '0000' ? mockUsers[1] : null
    if (!user) throw new Error('PIN incorrecto')
    return {
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 60 * 60,
      user,
    }
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

// License

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  if (USE_MOCKS) {
    await delay(200)
    return {
      status: 'trial',
      message: 'Prueba activa: quedan 30 días',
      is_active: true,
      verification_ready: true,
      installation_id: 'mock-installation-id',
      hardware_hash: 'mock-hardware-hash',
      request_code: 'mock-request-code',
      request_payload_json: JSON.stringify(
        {
          version: 1,
          product: 'nexo-pos',
          installation_id: 'mock-installation-id',
          hardware_hash: 'mock-hardware-hash',
          store_name: 'Nexo Demo',
          store_rut: '76.123.456-7',
          generated_at: new Date().toISOString(),
        },
        null,
        2
      ),
      trial_started_at: new Date().toISOString(),
      trial_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      trial_days_remaining: 30,
      activated_at: null,
      license_id: null,
      customer_name: null,
      license_type: null,
      license_expires_at: null,
      updates_until: null,
      max_registers: 3,
      features: ['offline', 'sii'],
      register_count: 1,
      last_validation_error: null,
    }
  }
  const res = await api.get('/license/status')
  return res.data.data ?? res.data
}

export async function activateLicense(licenseDocument: string): Promise<LicenseStatus> {
  if (USE_MOCKS) {
    await delay(400)
    const status = await fetchLicenseStatus()
    return {
      ...status,
      status: 'licensed',
      message: 'Licencia activa para Cliente Demo',
      is_active: true,
      activated_at: new Date().toISOString(),
      license_id: 'LIC-DEMO-001',
      customer_name: 'Cliente Demo',
      license_type: 'perpetual',
      trial_days_remaining: null,
    }
  }
  const res = await api.post('/license/activate', { license_document: licenseDocument })
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
