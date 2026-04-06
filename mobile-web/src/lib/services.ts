import api from './api'
import type {
  AuthSession,
  Product,
  ProductUpdate,
  Sale,
  CashRegister,
  CashSession,
  PaginationMeta,
  SaleCreate,
  OpenSessionInput,
  CloseSessionInput,
  Customer,
  LoyaltyConfig,
  KardexCreate,
  StoreConfig,
  Order,
  OrderCreate,
  OrderPatch,
} from '../types'

// ── Auth ──

export async function loginWithPin(pin: string): Promise<AuthSession> {
  const res = await api.post('/users/login/pin', { pin })
  return res.data.data ?? res.data
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
  const res = await api.get('/products/', { params })
  // Backend returns plain list, not {data, meta}
  const data: Product[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
  return {
    data,
    meta: res.data.meta ?? { total: data.length, skip: 0, limit: params.limit ?? 50, has_more: false },
  }
}

export async function getProductById(id: string): Promise<Product> {
  const res = await api.get(`/products/${id}`)
  return res.data.data ?? res.data
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const res = await api.get(`/products/barcode/${barcode}`)
    return res.data.data ?? res.data
  } catch {
    return null
  }
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  const res = await api.put(`/products/${id}`, data)
  return res.data.data ?? res.data
}

// ── Kardex / Stock ──

export async function adjustStock(data: KardexCreate): Promise<void> {
  await api.post('/kardex/', data)
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
  const res = await api.get('/sales/', { params })
  return { data: res.data.data, meta: res.data.meta }
}

export async function voidSale(id: string): Promise<void> {
  await api.post(`/sales/${id}/void`)
}

export async function createSale(data: SaleCreate): Promise<Sale> {
  const res = await api.post('/sales/', data)
  return res.data.data ?? res.data
}

// ── Cash ──

export async function fetchRegisters(): Promise<CashRegister[]> {
  const res = await api.get('/cash/registers')
  return res.data.data ?? res.data
}

export async function fetchActiveSession(registerId?: string): Promise<CashSession | null> {
  try {
    const res = await api.get('/cash/sessions/active')
    const sessions: CashSession[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
    if (registerId) {
      return sessions.find((session) => session.register_id === registerId) ?? null
    }
    return sessions[0] ?? null
  } catch {
    return null
  }
}

export async function fetchCashSession(id: string): Promise<CashSession> {
  const res = await api.get(`/cash/sessions/${id}`)
  return res.data.data ?? res.data
}

export async function openCashSession(data: OpenSessionInput): Promise<CashSession> {
  const res = await api.post('/cash/sessions/open', data)
  return res.data.data ?? res.data
}

export async function closeCashSession(id: string, data: CloseSessionInput): Promise<CashSession> {
  const res = await api.post(`/cash/sessions/${id}/close`, data)
  return res.data.data ?? res.data
}

// ── Customers ──

export async function searchCustomers(query: string): Promise<Customer[]> {
  const res = await api.get('/customers/', { params: { search: query, limit: 10 } })
  return Array.isArray(res.data) ? res.data : (res.data.data ?? [])
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const res = await api.get(`/customers/${id}`)
  return res.data.data ?? res.data
}

export async function fetchCustomerHistory(id: string): Promise<Sale[]> {
  const res = await api.get(`/customers/${id}/history`, { params: { limit: 30 } })
  return Array.isArray(res.data) ? res.data : (res.data.data ?? [])
}

export async function adjustCustomerPoints(id: string, delta: number): Promise<Customer> {
  const res = await api.post(`/customers/${id}/adjust-points`, null, { params: { delta } })
  return res.data.data ?? res.data
}

export async function fetchLoyaltyConfig(): Promise<LoyaltyConfig> {
  const res = await api.get('/customers/loyalty-config')
  return res.data.data ?? res.data
}

// ── Comandas ──

export async function listOrders(params?: { status?: string; register_id?: string; limit?: number }): Promise<Order[]> {
  const res = await api.get('/orders/', { params: { limit: 50, ...params } })
  return Array.isArray(res.data) ? res.data : (res.data.data ?? [])
}

export async function createOrder(payload: OrderCreate): Promise<Order> {
  const res = await api.post('/orders/', payload)
  return res.data.data ?? res.data
}

export async function updateOrder(orderId: string, patch: OrderPatch): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}`, patch)
  return res.data.data ?? res.data
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/cancel`)
  return res.data.data ?? res.data
}

// ── Config ──

export async function fetchStoreConfig(): Promise<StoreConfig> {
  const res = await api.get('/config')
  return res.data.data ?? res.data
}
