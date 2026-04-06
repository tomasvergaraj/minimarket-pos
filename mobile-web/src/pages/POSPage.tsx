import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ScanBarcode, X, Plus, Minus, Trash2,
  CreditCard, Banknote, ArrowLeftRight, ShoppingBag,
  ChevronDown, AlertCircle, UserCheck, Percent, WifiOff, Star, Clipboard, Landmark, Receipt,
} from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchProducts, getProductById, getProductByBarcode, createSale, searchCustomers, fetchLoyaltyConfig } from '../lib/services'
import POSOrdersModal from '../components/POSOrdersModal'
import POSReceiptPreviewModal from '../components/POSReceiptPreviewModal'
import SaleSuccessOverlay from '../components/SaleSuccessOverlay'
import { enqueue, queueCount } from '../lib/offlineQueue'
import { useDebounce } from '../hooks/useDebounce'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useFavorites, SIZE_PRESETS } from '../hooks/useFavorites'
import type { Product, CartItem, PaymentMethod, SaleCreate, Customer, LoyaltyConfig, Sale, FavoriteSlot, Order, PrintPrefs } from '../types'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const CART_KEY = 'pos_cart'
const PRINT_PREFS_KEY = 'pos_print_prefs'
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

function loadCart(): CartItem[] {
  try { return JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]') } catch { return [] }
}
function saveCart(cart: CartItem[]) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart))
}
function loadPrintPrefs(): PrintPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PRINT_PREFS_KEY) ?? '{}') as Partial<PrintPrefs>
    return { auto_print: stored.auto_print ?? false, store_name: stored.store_name ?? '' }
  } catch {
    return { auto_print: false, store_name: '' }
  }
}
function savePrintPrefs(prefs: PrintPrefs) {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs))
}
function getReceiptPrefs(): PrintPrefs {
  const prefs = loadPrintPrefs()
  return {
    ...prefs,
    auto_print: prefs.auto_print ?? false,
    store_name: prefs.store_name || 'Nexo POS',
  }
}

// ── Inline discount editor ──────────────────────────────────────────────────
function DiscountEditor({
  item, onApply, onClose,
}: { item: CartItem; onApply: (price: number) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'pct' | 'fixed'>('pct')
  const [val, setVal] = useState('')
  const base = item.product.is_on_offer && item.product.discount_price
    ? item.product.discount_price : item.product.sell_price
  const preview = (() => {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) return base
    return mode === 'pct' ? Math.round(base * (1 - n / 100)) : Math.round(base - n)
  })()
  const valid = preview >= 0 && preview <= base && val !== ''

  return (
    <div className="mt-1 bg-blue-50 border border-blue-200 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <button onClick={() => setMode('pct')}
          className={`text-xs px-2 py-0.5 rounded ${mode === 'pct' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-300'}`}>%</button>
        <button onClick={() => setMode('fixed')}
          className={`text-xs px-2 py-0.5 rounded ${mode === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-300'}`}>$</button>
        <input autoFocus type="number" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder={mode === 'pct' ? '% descuento' : '$ a descontar'}
          className="flex-1 text-xs border rounded px-2 py-0.5 focus:outline-none focus:border-blue-500" min="0" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-blue-700">{clp(base)} → <strong>{clp(preview)}</strong></span>
        <div className="flex gap-1">
          <button onClick={onClose} className="text-xs text-gray-500 px-2 py-0.5">Cancelar</button>
          <button onClick={() => { if (valid) { onApply(preview); onClose() } }} disabled={!valid}
            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-2 py-0.5 rounded">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customer search modal ───────────────────────────────────────────────────
function CustomerModal({
  onSelect, onClose,
}: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 350)
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['customer-search', dq],
    queryFn: () => searchCustomers(dq),
    enabled: dq.length >= 2,
    staleTime: 30_000,
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div className="absolute inset-0 bg-black/50" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
      <motion.div
        className="relative bg-white rounded-t-2xl max-h-[70vh] flex flex-col shadow-2xl"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-gray-900 font-semibold">Buscar cliente</span>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, RUT o teléfono..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isFetching && <p className="text-center text-gray-400 text-sm py-4">Buscando...</p>}
          {!isFetching && dq.length >= 2 && results.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">Sin resultados</p>
          )}
          {dq.length < 2 && <p className="text-center text-gray-400 text-sm py-4">Escribe al menos 2 caracteres</p>}
          {results.map((c) => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="w-full text-left flex items-center justify-between py-3 border-b border-gray-100 hover:bg-gray-50">
              <div>
                <p className="text-gray-900 font-medium text-sm">{c.name}</p>
                <p className="text-gray-400 text-xs">{c.rut ?? c.phone ?? c.email ?? '—'}</p>
              </div>
              <span className="text-blue-600 text-xs font-medium">{c.points_balance} pts</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function POSPage() {
  const { user, cashState, setCashState } = usePOSAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const pendingCount = queueCount()

  const [search, setSearch] = useState('')
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('card')
  const [cashInput, setCashInput] = useState('')
  const [mixedCash, setMixedCash] = useState('')
  const [mixedCard, setMixedCard] = useState('')
  const [mixedTransfer, setMixedTransfer] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [discountKey, setDiscountKey] = useState<string | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [lastSale, setLastSale] = useState<Sale>(null as unknown as Sale)
  const [receiptOnSale, setReceiptOnSale] = useState(() => loadPrintPrefs().auto_print)
  const [receiptPreviewSale, setReceiptPreviewSale] = useState<Sale | null>(null)

  // Comandas
  const [showOrders, setShowOrders] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  // Sale success overlay
  const [successOverlay, setSuccessOverlay] = useState<{ total: number; change: number } | null>(null)

  // Favorites
  const { slots, gridSize, setSlot, clearSlot, setGridSize } = useFavorites()
  const [favEditMode, setFavEditMode] = useState(false)
  const [favAssigning, setFavAssigning] = useState<number | null>(null)
  const [favSearch, setFavSearch] = useState('')
  const [favResults, setFavResults] = useState<Product[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const debouncedSearch = useDebounce(search, 350)

  // Persist cart in sessionStorage
  useEffect(() => { saveCart(cart) }, [cart])
  useEffect(() => {
    if (checkoutOpen) setReceiptOnSale(loadPrintPrefs().auto_print)
  }, [checkoutOpen])

  // Load loyalty config once
  useEffect(() => {
    fetchLoyaltyConfig().then(setLoyaltyConfig).catch(() => {})
  }, [])

  const { data: productsData, isFetching } = useQuery({
    queryKey: ['pos-products', debouncedSearch],
    queryFn: () => fetchProducts({ search: debouncedSearch, active_only: true, limit: 30 }),
    enabled: true,
    staleTime: 30_000,
  })

  const products = productsData?.data ?? []
  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // Points discount
  const maxRedeemable = customer
    ? Math.min(customer.points_balance, Math.floor(cartTotal / (loyaltyConfig?.point_value ?? 10)))
    : 0
  const pointsDiscount = pointsToRedeem * (loyaltyConfig?.point_value ?? 10)
  const finalTotal = Math.max(0, cartTotal - pointsDiscount)

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) { toast.error('Sin stock disponible'); return }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Stock máximo: ${product.stock}`)
          return prev
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      const price = product.is_on_offer && product.discount_price ? product.discount_price : product.sell_price
      if (product.stock <= product.min_stock) {
        toast(`Stock bajo: quedan ${product.stock}`, { icon: '⚠️', duration: 2000 })
      }
      return [...prev, { product, quantity: 1, unit_price: price, discount_pct: 0 }]
    })
    toast.success(product.name, { duration: 800, position: 'bottom-center' })
  }, [])

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i
        const next = Math.max(0, i.quantity + delta)
        if (delta > 0 && next > i.product.stock) { toast.error(`Stock máximo: ${i.product.stock}`); return i }
        return { ...i, quantity: next }
      }).filter((i) => i.quantity > 0)
    )
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const applyDiscount = useCallback((productId: string, newPrice: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i
      const base = i.product.is_on_offer && i.product.discount_price ? i.product.discount_price : i.product.sell_price
      const pct = Math.round((1 - newPrice / base) * 100)
      return { ...i, unit_price: newPrice, discount_pct: pct }
    }))
  }, [])

  // ── Barcode scanner ─────────────────────────────────────────────────────
  const startScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) videoRef.current.srcObject = stream
      setScanning(true)
      if (!('BarcodeDetector' in window)) {
        toast.error('Escáner no soportado'); stream.getTracks().forEach((t) => t.stop()); setScanning(false); return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] })
      scannerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            stopScan(stream)
            const product = await getProductByBarcode(codes[0].rawValue as string)
            if (product) addToCart(product)
            else toast.error('Producto no encontrado')
          }
        } catch { /* ignore */ }
      }, 300)
    } catch { toast.error('No se pudo acceder a la cámara'); setScanning(false) }
  }

  const stopScan = (stream?: MediaStream) => {
    if (scannerRef.current) clearInterval(scannerRef.current)
    const s = stream ?? (videoRef.current?.srcObject as MediaStream | null)
    s?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  useEffect(() => () => { stopScan() }, [])

  // ── Favorites ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (favSearch.trim().length < 2) { setFavResults([]); return }
    const t = setTimeout(() => {
      fetchProducts({ search: favSearch.trim(), active_only: true, limit: 8 })
        .then((r) => setFavResults(r.data))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [favSearch])

  const handleFavTap = async (fav: FavoriteSlot) => {
    try {
      const product = await getProductById(fav.product_id)
      addToCart(product)
    } catch {
      toast.error(`${fav.product_name}: producto no disponible`, { duration: 3000 })
    }
  }

  // ── Load order into cart ────────────────────────────────────────────────
  const handleLoadOrder = (order: Order) => {
    const newCart: CartItem[] = order.items.map((item) => ({
      product: {
        id: item.product_id, name: item.product_name, sku: item.product_sku,
        sell_price: item.unit_price, stock: 999, min_stock: 0,
        is_on_offer: false, discount_price: null, is_active: true,
        // minimal fields not needed for cart display:
        barcode: null, description: null, category: null, unit: 'un',
        cost_price: 0, tax_rate: 0, is_pack: false, units_contained: 1,
        base_product_id: null, discount_ends_at: null, image_url: null,
        created_at: '', updated_at: '',
      },
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_pct: 0,
    }))
    setCart(newCart)
    saveCart(newCart)
    setActiveOrder(order)
  }

  // ── Checkout ────────────────────────────────────────────────────────────
  const mxCash = parseFloat(mixedCash) || 0
  const mxCard = parseFloat(mixedCard) || 0
  const mxTransfer = parseFloat(mixedTransfer) || 0
  const mixedTotal = mxCash + mxCard + mxTransfer
  const mixedRemaining = Math.max(0, finalTotal - mixedTotal)
  const cashInputNum = parseFloat(cashInput) || 0
  const change =
    payMethod === 'cash'
      ? Math.max(0, cashInputNum - finalTotal)
      : payMethod === 'mixed'
      ? Math.max(0, mixedTotal - finalTotal)
      : 0
  const cashShort = payMethod === 'cash' && cashInputNum > 0 && cashInputNum < finalTotal

  const canConfirm =
    !confirming &&
    (payMethod === 'card' || payMethod === 'transfer' ||
     (payMethod === 'cash' && cashInputNum >= finalTotal) ||
     (payMethod === 'mixed' && mixedTotal >= finalTotal))

  const handleConfirm = async () => {
    if (!cashState) { navigate('/cash'); return }
    if (cart.length === 0) return
    if (payMethod === 'cash' && cashInputNum < finalTotal) { toast.error('Monto insuficiente'); return }
    if (payMethod === 'mixed' && mixedTotal < finalTotal) { toast.error(`Faltan ${clp(mixedRemaining)} para cubrir el total`); return }

    const savedPrintPrefs = getReceiptPrefs()
    const nextPrintPrefs = {
      auto_print: receiptOnSale,
      store_name: savedPrintPrefs.store_name,
    }
    savePrintPrefs(nextPrintPrefs)

    const saleData: SaleCreate = {
      cash_session_id: cashState.session.id,
      register_id: cashState.register.id,
      items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity, unit_price_override: i.unit_price })),
      payment_method: payMethod,
      cash_amount: payMethod === 'cash' ? cashInputNum : payMethod === 'mixed' ? mxCash : 0,
      card_amount: payMethod === 'card' ? finalTotal : payMethod === 'mixed' ? mxCard : 0,
      transfer_amount: payMethod === 'transfer' ? finalTotal : payMethod === 'mixed' ? mxTransfer : 0,
      customer_id: customer?.id,
      points_to_redeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      emit_receipt: receiptOnSale,
    }

    setConfirming(true)
    try {
      let sale: Sale
      if (!isOnline) {
        enqueue(saleData)
        sale = null as unknown as Sale
      } else {
        sale = await createSale(saleData)
      }
      setCart([])
      saveCart([])
      setCheckoutOpen(false)
      setCartOpen(false)
      const saleChange = change
      setCashInput('')
      setPayMethod('card')
      setMixedCash('')
      setMixedCard('')
      setMixedTransfer('')
      setCustomer(null)
      setActiveOrder(null)
      setPointsToRedeem(0)
      setReceiptOnSale(loadPrintPrefs().auto_print)
      setSuccessOverlay({ total: finalTotal, change: saleChange })
      if (sale) {
        if (cashState) {
          setCashState({
            session: {
              ...cashState.session,
              total_cash_sales: cashState.session.total_cash_sales + Math.max(0, sale.cash_amount - sale.change_amount),
              total_card_sales: cashState.session.total_card_sales + sale.card_amount,
              total_transfer_sales: cashState.session.total_transfer_sales + sale.transfer_amount,
              total_sales_count: cashState.session.total_sales_count + 1,
            },
            register: cashState.register,
          })
        }
        void queryClient.invalidateQueries({ queryKey: ['pos-sales'] })
        void queryClient.invalidateQueries({ queryKey: ['pos-cash-session', cashState?.session.id] })
        setLastSale(sale)
        if (nextPrintPrefs.auto_print) setReceiptPreviewSale(sale)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar venta')
    } finally {
      setConfirming(false)
    }
  }

  // Guard
  if (!cashState || cashState.session.status !== 'open') {
    return (
      <motion.div
        className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center bg-gray-50"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <AlertCircle size={48} className="text-amber-500" />
        <h2 className="text-gray-900 text-lg font-semibold">Sin sesión de caja</h2>
        <p className="text-gray-500 text-sm">Debes abrir una caja antes de registrar ventas.</p>
        <motion.button
          onClick={() => navigate('/cash')}
          whileTap={{ scale: 0.94 }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
        >
          Ir a Caja
        </motion.button>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 border-b border-amber-300 shrink-0">
          <WifiOff size={14} className="text-amber-600" />
          <span className="text-amber-700 text-xs font-medium">
            Sin conexión — las ventas se guardarán en cola
            {pendingCount > 0 && ` (${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''})`}
          </span>
        </div>
      )}

      {/* Customer banner */}
      {customer && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 border-b border-blue-200 shrink-0">
          <span className="text-blue-700 text-xs font-medium">{customer.name} · {customer.points_balance} pts</span>
          <button onClick={() => { setCustomer(null); setPointsToRedeem(0) }} className="shrink-0">
            <X size={14} className="text-blue-500" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              className="min-w-0 flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm outline-none"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSearchResultsOpen(e.target.value.trim().length > 0)
              }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setSearchResultsOpen(false) }} className="shrink-0" aria-label="Limpiar búsqueda">
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
          <motion.button
            onClick={() => setShowCustomerModal(true)}
            aria-label="Seleccionar cliente"
            whileTap={{ scale: 0.88 }}
            className={`relative flex w-11 h-11 shrink-0 items-center justify-center rounded-xl border ${
              customer ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <UserCheck size={20} className={customer ? 'text-blue-600' : 'text-gray-600'} />
          </motion.button>
          <motion.button
            onClick={startScan}
            aria-label="Escanear producto"
            whileTap={{ scale: 0.88 }}
            className="flex w-11 h-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 hover:bg-gray-200"
          >
            <ScanBarcode size={20} className="text-gray-600" />
          </motion.button>
          <motion.button
            onClick={() => setShowOrders(true)}
            aria-label="Ver comandas"
            whileTap={{ scale: 0.88 }}
            className={`relative flex w-11 h-11 shrink-0 items-center justify-center rounded-xl border ${
              activeOrder ? 'bg-amber-100 border-amber-300' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Clipboard size={20} className={activeOrder ? 'text-amber-600' : 'text-gray-600'} />
            {activeOrder && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                !
              </span>
            )}
          </motion.button>
          <motion.button
            onClick={() => setCartOpen(true)}
            aria-label="Abrir carrito"
            whileTap={{ scale: 0.88 }}
            className="relative flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700"
          >
            <ShoppingBag size={20} className="text-white" />
            <AnimatePresence mode="popLayout">
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Search results — flat list */}
      {searchResultsOpen ? (
        <div className="flex-1 overflow-y-auto bg-white">
          {(!debouncedSearch || isFetching) && products.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">Buscando...</div>
          )}
          {!isFetching && debouncedSearch && products.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">Sin resultados para "{debouncedSearch}"</div>
          )}
          {products.map((p) => {
            const price = p.is_on_offer && p.discount_price ? p.discount_price : p.sell_price
            const inCart = cart.find((i) => i.product.id === p.id)
            const noStock = p.stock <= 0
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (noStock) return
                  addToCart(p)
                  setSearch('')
                  setSearchResultsOpen(false)
                }}
                disabled={noStock}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left active:bg-blue-50 ${noStock ? 'opacity-40' : 'hover:bg-gray-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{p.name}</p>
                  <p className="text-gray-400 text-xs">{p.sku}{p.category ? ` · ${p.category}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-blue-600 font-bold text-sm">{clp(price)}</p>
                  {noStock
                    ? <p className="text-xs text-red-500">Sin stock</p>
                    : p.min_stock && p.stock <= p.min_stock
                    ? <p className="text-xs text-amber-500">Quedan {p.stock}</p>
                    : <p className="text-xs text-gray-300">{p.stock} u.</p>}
                  {p.is_on_offer && p.discount_price && (
                    <p className="text-xs text-gray-300 line-through">{clp(p.sell_price)}</p>
                  )}
                </div>
                {inCart && (
                  <span className="shrink-0 bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                    {inCart.quantity}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        /* Favorites grid */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-amber-400" fill="currentColor" />
              <span className="text-sm text-gray-500 font-medium">Favoritos ({gridSize} slots)</span>
            </div>
            <button
              onClick={() => { setFavEditMode((v) => !v); setFavAssigning(null); setFavSearch(''); setFavResults([]) }}
              className={`text-sm font-semibold ${favEditMode ? 'text-green-600' : 'text-blue-600'}`}
            >
              {favEditMode ? 'Listo' : 'Editar'}
            </button>
          </div>

          {/* Grid size presets */}
          {favEditMode && (
            <div className="flex items-center gap-2 flex-wrap px-1">
              <span className="text-xs text-gray-400">Slots:</span>
              {SIZE_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setGridSize(n)}
                  className={`w-9 h-7 rounded-xl border text-xs font-semibold transition-colors ${
                    gridSize === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Assignment search panel */}
          {favAssigning !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2">
              <p className="text-blue-700 text-xs font-medium">Buscar producto para slot {favAssigning + 1}:</p>
              <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={favSearch}
                  onChange={(e) => setFavSearch(e.target.value)}
                  placeholder="Nombre o código..."
                  className="flex-1 text-sm text-gray-900 outline-none bg-transparent"
                />
                {favSearch && (
                  <button onClick={() => setFavSearch('')}><X size={13} className="text-gray-400" /></button>
                )}
              </div>

              {favSearch.length >= 2 && favResults.length === 0 && (
                <p className="text-xs text-gray-400 px-1">Sin resultados</p>
              )}
              {favSearch.length < 2 && (
                <p className="text-xs text-gray-400 px-1">Escribe al menos 2 caracteres</p>
              )}
              <div>
                {favResults.map((p) => {
                  const price = p.is_on_offer && p.discount_price ? p.discount_price : p.sell_price
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSlot(favAssigning!, { product_id: p.id, product_name: p.name, sell_price: price })
                        setFavAssigning(null); setFavSearch(''); setFavResults([])
                      }}
                      className="w-full flex items-center justify-between py-2.5 px-1 border-t border-blue-100 first:border-0 hover:bg-blue-100/60 rounded text-left"
                    >
                      <span className="text-sm text-gray-900 flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-bold text-blue-600 ml-3 shrink-0">{clp(price)}</span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => { setFavAssigning(null); setFavSearch(''); setFavResults([]) }}
                className="text-xs text-gray-400 hover:text-gray-600 pt-1"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Slots grid */}
          <div className="grid grid-cols-4 gap-2">
            {slots.map((fav, i) => (
              <button
                key={i}
                onClick={() => {
                  if (favEditMode) {
                    if (fav) clearSlot(i)
                    else { setFavAssigning(i); setFavSearch(''); setFavResults([]) }
                  } else if (fav) {
                    handleFavTap(fav)
                  }
                }}
                className={`relative rounded-2xl p-2 border-2 min-h-18 flex flex-col justify-center items-start transition active:scale-95 ${
                  fav
                    ? favEditMode
                      ? 'bg-red-50 border-red-300'
                      : 'bg-amber-50 border-amber-300 hover:border-amber-400 hover:shadow-sm'
                    : favEditMode
                    ? 'bg-blue-50 border-blue-200 border-dashed'
                    : 'bg-gray-50 border-gray-200 border-dashed'
                }`}
              >
                {fav ? (
                  <>
                    {favEditMode && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <X size={9} className="text-white" />
                      </div>
                    )}
                    <p className="text-xs font-semibold text-gray-800 leading-tight text-left line-clamp-2 w-full pr-1">
                      {fav.product_name}
                    </p>
                    <p className="text-xs font-bold text-blue-600 mt-1">{clp(fav.sell_price)}</p>
                  </>
                ) : (
                  favEditMode && (
                    <div className="w-full flex items-center justify-center">
                      <Plus size={20} className="text-blue-300" />
                    </div>
                  )
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.div
            className="px-3 pb-2 shrink-0"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <motion.button
              onClick={() => setCartOpen(true)}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-between bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-3 font-medium"
            >
              <span>{cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}</span>
              <span>{clp(cartTotal)}</span>
              <ChevronDown size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last sale receipt prompt */}
      {lastSale && false && (
        <div className="fixed inset-x-0 bottom-16 px-4 z-30">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between">
            <span className="text-gray-700 text-sm">Venta #{lastSale.sale_number} · {clp(lastSale.total)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setReceiptPreviewSale(lastSale)}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"
              >
                Boleta
              </button>
              <button onClick={() => {}} className="text-xs text-gray-400"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {receiptPreviewSale && (
        <POSReceiptPreviewModal
          sale={receiptPreviewSale}
          prefs={getReceiptPrefs()}
          onClose={() => setReceiptPreviewSale(null)}
        />
      )}

      {/* Barcode scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <span className="text-white font-medium">Escanear código</span>
            <button onClick={() => stopScan()}><X size={24} className="text-gray-300" /></button>
          </div>
          <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
          <p className="text-center text-gray-300 text-sm py-3 bg-black/80">Apunta al código de barras</p>
        </div>
      )}

      {/* Comandas modal */}
      {showOrders && cashState && (
        <POSOrdersModal
          registerId={cashState.register.id}
          cart={cart}
          activeOrder={activeOrder}
          onClose={() => setShowOrders(false)}
          onLoadOrder={handleLoadOrder}
          onOrderSaved={(order) => {
            if (order.status === 'cancelled' && activeOrder?.id === order.id) {
              setActiveOrder(null)
            } else {
              setActiveOrder(order)
            }
          }}
        />
      )}

      {/* Customer modal */}
      {showCustomerModal && (
        <CustomerModal
          onSelect={(c) => { setCustomer(c); setPointsToRedeem(0); setShowCustomerModal(false) }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* Cart sheet */}
      <AnimatePresence>
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCartOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-gray-900 font-semibold">Carrito ({cartCount})</span>
              <button onClick={() => setCartOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
              {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Carrito vacío</p>}
              <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3 py-2 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-medium truncate">{item.product.name}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-400 text-xs">{clp(item.unit_price)} c/u</p>
                        {item.discount_pct > 0 && (
                          <span className="text-xs text-green-600 font-medium">-{item.discount_pct}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(user?.role === 'admin') && (
                        <button onClick={() => setDiscountKey(discountKey === item.product.id ? null : item.product.id)}
                          className={`w-6 h-6 rounded flex items-center justify-center ${discountKey === item.product.id ? 'bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          <Percent size={12} className="text-blue-600" />
                        </button>
                      )}
                      <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">
                        <Minus size={14} className="text-gray-700" />
                      </button>
                      <span className="text-gray-900 w-5 text-center font-medium text-sm">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200">
                        <Plus size={14} className="text-gray-700" />
                      </button>
                      <button onClick={() => removeItem(item.product.id)} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-100">
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                    <span className="text-blue-600 font-semibold text-sm w-20 text-right">
                      {clp(item.unit_price * item.quantity)}
                    </span>
                  </div>
                  {discountKey === item.product.id && (
                    <DiscountEditor item={item}
                      onApply={(p) => applyDiscount(item.product.id, p)}
                      onClose={() => setDiscountKey(null)} />
                  )}
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
            {cart.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 space-y-3">
                <div className="flex justify-between text-gray-900 font-bold text-lg">
                  <span>Total</span>
                  <span className="text-blue-600">{clp(cartTotal)}</span>
                </div>
                <motion.button
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true) }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-base"
                >
                  Cobrar
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Checkout modal */}
      <AnimatePresence>
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={() => setCheckoutOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 shrink-0">
              <div>
                <p className="text-sm font-medium text-gray-500">Cobrar</p>
                <p className="text-3xl font-bold text-gray-900">{clp(finalTotal)}</p>
                <p className="text-gray-400 text-xs">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</p>
              </div>
              <button onClick={() => setCheckoutOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-4">
              <div className="text-center">
                {pointsDiscount > 0 && (
                  <p className="mb-1 text-sm font-medium text-emerald-600">Descuento puntos: -{clp(pointsDiscount)}</p>
                )}
                <p className="text-sm text-gray-500">Total a cobrar</p>
                <p className="text-4xl font-bold text-gray-900">{clp(finalTotal)}</p>
              </div>

              {/* Customer loyalty */}
              {customer && loyaltyConfig && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-amber-900">{customer.name}</p>
                      <p className="mt-1 text-xs text-amber-700">
                        Disponibles: {customer.points_balance} pts = {clp(customer.points_balance * loyaltyConfig.point_value)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">{customer.points_balance} pts</span>
                  </div>
                  {maxRedeemable > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number" inputMode="numeric" min={0} max={maxRedeemable}
                        value={pointsToRedeem || ''}
                        onChange={(e) => setPointsToRedeem(Math.min(maxRedeemable, parseInt(e.target.value) || 0))}
                        placeholder="0 pts"
                        className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-4 py-3 text-center text-lg font-bold text-gray-900 outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => setPointsToRedeem(maxRedeemable)}
                        className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-amber-900"
                      >
                        Máx ({maxRedeemable})
                      </button>
                      <button
                        onClick={() => setPointsToRedeem(0)}
                        className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-500"
                      >
                        Limpiar
                      </button>
                      {pointsToRedeem > 0 && (
                        <span className="text-green-600 text-xs font-bold">−{clp(pointsDiscount)}</span>
                      )}
                    </div>
                  )}
                  {pointsToRedeem > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-2">
                      <span className="text-sm font-medium text-emerald-600">Total con descuento</span>
                      <span className="text-base font-bold text-emerald-600">{clp(finalTotal)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment method tabs */}
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'card',     label: 'Tarjeta',  icon: CreditCard },
                    { id: 'cash',     label: 'Efectivo', icon: Banknote },
                    { id: 'transfer', label: 'Transfer.', icon: Landmark },
                    { id: 'mixed',    label: 'Mixto',    icon: ArrowLeftRight },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setPayMethod(id)}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 transition ${
                        payMethod === id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Efectivo ── */}
              {payMethod === 'cash' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-500">Monto efectivo</p>
                    <button
                      onClick={() => setCashInput(String(finalTotal))}
                      className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
                    >
                      Monto exacto
                    </button>
                  </div>
                  <input
                    type="number" inputMode="numeric"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className={`w-full rounded-2xl border-[1.5px] px-4 py-4 text-center text-3xl font-bold text-gray-900 outline-none ${
                      cashShort ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashInput(String(amount))}
                        className="rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-200"
                      >
                        {clp(amount)}
                      </button>
                    ))}
                  </div>
                  {cashShort && (
                    <p className="text-xs font-medium text-red-500">Faltan {clp(finalTotal - cashInputNum)}</p>
                  )}
                </div>
              )}

              {/* ── Tarjeta ── */}
              {payMethod === 'card' && (
                <div className="rounded-2xl bg-gray-100 px-4 py-5 text-center">
                  <CreditCard size={26} className="mx-auto text-blue-600" />
                  <p className="mt-3 text-4xl font-bold text-blue-600">{clp(finalTotal)}</p>
                  <p className="mt-2 text-sm text-gray-500">Confirma el pago antes de continuar</p>
                </div>
              )}

              {/* ── Transferencia ── */}
              {payMethod === 'transfer' && (
                <div className="rounded-2xl bg-gray-100 px-4 py-5 text-center">
                  <Landmark size={26} className="mx-auto text-blue-600" />
                  <p className="mt-3 text-4xl font-bold text-blue-600">{clp(finalTotal)}</p>
                  <p className="mt-2 text-sm text-gray-500">Confirma la transferencia antes de continuar</p>
                </div>
              )}

              {/* ── Mixto ── */}
              {payMethod === 'mixed' && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Distribución del pago</p>

                  {/* Efectivo */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-500">Monto efectivo</p>
                      <button
                        onClick={() => setMixedCash(String(Math.max(finalTotal - mxCard - mxTransfer, 0)))}
                        className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
                      >
                        Resto: {clp(Math.max(finalTotal - mxCard - mxTransfer, 0))}
                      </button>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={mixedCash}
                      onChange={(e) => setMixedCash(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border-[1.5px] border-gray-200 px-4 py-4 text-center text-3xl font-bold text-gray-900 outline-none focus:border-blue-500"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {QUICK_AMOUNTS.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setMixedCash(String(mxCash + amount))}
                          className="rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-200"
                        >
                          {clp(amount)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tarjeta */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-500">Monto tarjeta</p>
                      <button
                        onClick={() => setMixedCard(String(Math.max(finalTotal - mxCash - mxTransfer, 0)))}
                        className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
                      >
                        Resto: {clp(Math.max(finalTotal - mxCash - mxTransfer, 0))}
                      </button>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={mixedCard}
                      onChange={(e) => setMixedCard(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border-[1.5px] border-gray-200 px-4 py-4 text-center text-3xl font-bold text-gray-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Transferencia */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-500">Monto transferencia</p>
                      <button
                        onClick={() => setMixedTransfer(String(Math.max(finalTotal - mxCash - mxCard, 0)))}
                        className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
                      >
                        Resto: {clp(Math.max(finalTotal - mxCash - mxCard, 0))}
                      </button>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={mixedTransfer}
                      onChange={(e) => setMixedTransfer(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border-[1.5px] border-gray-200 px-4 py-4 text-center text-3xl font-bold text-gray-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Summary */}
                  <div className={`flex items-center justify-between rounded-2xl px-4 py-4 ${
                    mixedRemaining > 0
                      ? 'bg-amber-50'
                      : 'bg-emerald-50'
                  }`}>
                    <span className={`text-sm font-semibold ${mixedRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {mixedRemaining > 0 ? `Falta ${clp(mixedRemaining)}` : 'Cubierto'}
                    </span>
                    <span className={`text-lg font-bold ${mixedRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {clp(mixedTotal)} / {clp(finalTotal)}
                    </span>
                  </div>
                </div>
              )}

              {(payMethod === 'cash' || payMethod === 'mixed') && change > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-4">
                  <span className="text-base text-emerald-600">Vuelto</span>
                  <span className="text-3xl font-bold text-emerald-600">{clp(change)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setReceiptOnSale((value) => !value)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                  receiptOnSale
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Receipt size={18} className={receiptOnSale ? 'text-blue-600' : 'text-gray-400'} />
                  <div>
                    <p className={`text-sm font-semibold ${receiptOnSale ? 'text-blue-600' : 'text-gray-500'}`}>Emitir boleta</p>
                    <p className="text-xs text-gray-400">Mostrar preview al confirmar</p>
                  </div>
                </div>
                <div className={`relative h-6 w-11 rounded-full transition-colors ${receiptOnSale ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${receiptOnSale ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            {/* Confirm button */}
            <div className="px-4 pb-5 pt-3 border-t border-gray-200 shrink-0">
              <motion.button
                onClick={handleConfirm}
                disabled={!canConfirm}
                whileTap={{ scale: 0.97 }}
                className="w-full rounded-2xl bg-green-700 py-4 text-lg font-bold text-white transition hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {confirming ? 'Procesando...' : 'Confirmar Pago'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Sale success overlay */}
      <SaleSuccessOverlay
        visible={!!successOverlay}
        total={successOverlay?.total ?? 0}
        change={successOverlay?.change ?? 0}
        onDismiss={() => setSuccessOverlay(null)}
      />
    </div>
  )
}
