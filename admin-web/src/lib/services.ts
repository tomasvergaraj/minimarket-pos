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
  SalesTrendPoint,
  HourlyPoint,
  PaymentMethodPoint,
  TopProduct,
  StoreConfig,
  PaginationMeta,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  PurchaseOrder,
  PurchaseOrderCreate,
  PurchaseOrderUpdate,
  ReceivePurchaseOrderInput,
  Customer,
  CustomerCreate,
  CustomerUpdate,
  LoyaltyConfig,
  Notification,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  ExpenseSummary,
  Table,
  TableCreate,
  TableUpdate,
  TableStatus,
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

export async function fetchSalesTrend(days = 7): Promise<SalesTrendPoint[]> {
  const res = await api.get('/dashboard/analytics/sales-trend', { params: { days } })
  return res.data
}

export async function fetchHourlySales(days = 7): Promise<HourlyPoint[]> {
  const res = await api.get('/dashboard/analytics/hourly', { params: { days } })
  return res.data
}

export async function fetchPaymentMethods(days = 7): Promise<PaymentMethodPoint[]> {
  const res = await api.get('/dashboard/analytics/payment-methods', { params: { days } })
  return res.data
}

export async function fetchTopProductsAnalytics(limit = 10, days = 30): Promise<TopProduct[]> {
  const res = await api.get('/dashboard/analytics/top-products', { params: { limit, days } })
  return res.data
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
  // Use the categories table; fall back to extracting from products if the endpoint fails
  try {
    const res = await api.get('/categories/')
    const cats: { name: string }[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
    return cats.map((c) => c.name)
  } catch {
    // Fallback: extract distinct categories from the product list
    const res = await api.get('/products/', { params: { active_only: false, limit: 500 } })
    const products: { category: string | null }[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[]
  }
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
      image_url: null,
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

export async function uploadProductImage(productId: string, file: File): Promise<Product> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(`/products/${productId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data ?? res.data
}

export async function deleteProductImage(productId: string): Promise<Product> {
  const res = await api.delete(`/products/${productId}/image`)
  return res.data.data ?? res.data
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

// ── Suppliers ──

export async function fetchSuppliers(includeInactive = false): Promise<Supplier[]> {
  const res = await api.get('/suppliers/', { params: { include_inactive: includeInactive || undefined } })
  return Array.isArray(res.data) ? res.data : (res.data.data ?? [])
}

export async function createSupplier(data: SupplierCreate): Promise<Supplier> {
  const res = await api.post('/suppliers/', data)
  return res.data.data ?? res.data
}

export async function updateSupplier(id: string, data: SupplierUpdate): Promise<Supplier> {
  const res = await api.put(`/suppliers/${id}`, data)
  return res.data.data ?? res.data
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`)
}

// ── Purchases ──

export async function fetchPurchases(params: {
  supplier_id?: string
  status?: string
  skip?: number
  limit?: number
} = {}): Promise<PurchaseOrder[]> {
  const res = await api.get('/purchases/', { params })
  return Array.isArray(res.data) ? res.data : (res.data.data ?? [])
}

export async function fetchPurchase(id: string): Promise<PurchaseOrder> {
  const res = await api.get(`/purchases/${id}`)
  return res.data.data ?? res.data
}

export async function createPurchase(data: PurchaseOrderCreate): Promise<PurchaseOrder> {
  const res = await api.post('/purchases/', data)
  return res.data.data ?? res.data
}

export async function updatePurchase(id: string, data: PurchaseOrderUpdate): Promise<PurchaseOrder> {
  const res = await api.put(`/purchases/${id}`, data)
  return res.data.data ?? res.data
}

export async function confirmPurchase(id: string): Promise<PurchaseOrder> {
  const res = await api.post(`/purchases/${id}/confirm`)
  return res.data.data ?? res.data
}

export async function receivePurchase(id: string, data: ReceivePurchaseOrderInput): Promise<PurchaseOrder> {
  const res = await api.post(`/purchases/${id}/receive`, data)
  return res.data.data ?? res.data
}

export async function deletePurchase(id: string): Promise<void> {
  await api.delete(`/purchases/${id}`)
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

// ── Customers ──

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  const res = await api.get('/customers/', { params: search ? { search } : {} })
  return res.data
}

export async function createCustomer(data: CustomerCreate): Promise<Customer> {
  const res = await api.post('/customers/', data)
  return res.data
}

export async function updateCustomer(id: string, data: CustomerUpdate): Promise<Customer> {
  const res = await api.put(`/customers/${id}`, data)
  return res.data
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`)
}

export async function fetchCustomerHistory(id: string): Promise<Sale[]> {
  const res = await api.get(`/customers/${id}/history`)
  return res.data
}

export async function adjustCustomerPoints(id: string, delta: number): Promise<Customer> {
  const res = await api.post(`/customers/${id}/adjust-points`, null, { params: { delta } })
  return res.data
}

export async function fetchLoyaltyConfig(): Promise<LoyaltyConfig> {
  const res = await api.get('/customers/loyalty-config')
  return res.data
}

// ── Tables ──

export async function fetchTables(): Promise<Table[]> {
  const res = await api.get('/tables/')
  return res.data
}

export async function fetchTablesStatus(): Promise<TableStatus[]> {
  const res = await api.get('/tables/status')
  return res.data
}

export async function createTable(data: TableCreate): Promise<Table> {
  const res = await api.post('/tables/', data)
  return res.data
}

export async function updateTable(id: string, data: TableUpdate): Promise<Table> {
  const res = await api.put(`/tables/${id}`, data)
  return res.data
}

export async function deleteTable(id: string): Promise<void> {
  await api.delete(`/tables/${id}`)
}

// ── Expenses ──

export async function fetchExpenses(params: {
  date_from?: string
  date_to?: string
  category?: string
  skip?: number
  limit?: number
} = {}): Promise<Expense[]> {
  const res = await api.get('/expenses/', { params })
  return res.data
}

export async function fetchExpenseCategories(): Promise<{ value: string; label: string }[]> {
  const res = await api.get('/expenses/categories')
  return res.data
}

export async function fetchExpenseSummary(dateFrom: string, dateTo: string): Promise<ExpenseSummary> {
  const res = await api.get('/expenses/summary', { params: { date_from: dateFrom, date_to: dateTo } })
  return res.data
}

export async function createExpense(data: ExpenseCreate): Promise<Expense> {
  const res = await api.post('/expenses/', data)
  return res.data
}

export async function updateExpense(id: string, data: ExpenseUpdate): Promise<Expense> {
  const res = await api.put(`/expenses/${id}`, data)
  return res.data
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/expenses/${id}`)
}

// ── Notifications ──

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await api.get('/notifications/')
  return res.data
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get('/notifications/unread-count')
  return res.data.count
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}

// ── Cloud Sync ──

export async function fetchSyncStatus() {
  const res = await api.get('/sync/status')
  return res.data
}

export async function fetchSyncConfig() {
  const res = await api.get('/sync/config')
  return res.data
}

export async function updateSyncConfig(data: { supabase_url: string; supabase_key: string; branch_id: string }) {
  const res = await api.put('/sync/config', data)
  return res.data
}

export async function triggerSync(): Promise<{ message: string; log_id: number }> {
  const res = await api.post('/sync/trigger')
  return res.data
}

export async function loginWithPin(pin: string): Promise<AuthSession> {
  const res = await api.post<AuthSession>('/users/login/pin', { pin })
  return res.data
}

export async function logoutSession(refreshToken: string): Promise<void> {
  await api.post('/users/logout', { refresh_token: refreshToken })
}

export async function fetchAuditLogs(params?: {
  action?: string
  entity_type?: string
  from_date?: string
  to_date?: string
  limit?: number
  offset?: number
}) {
  const res = await api.get('/audit/', { params })
  return res.data
}
