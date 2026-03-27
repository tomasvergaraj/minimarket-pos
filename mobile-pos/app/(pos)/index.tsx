import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Modal, TextInput, Alert, ActivityIndicator,
  ScrollView, Keyboard, Image,
  Animated, Dimensions, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useCartStore, cartTotal, cartCount } from '../../src/stores/cartStore'
import { useCashStore } from '../../src/stores/cashStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useFavoritesStore } from '../../src/stores/favoritesStore'
import { searchProducts, getProductById } from '../../src/api/products'
import { createSale } from '../../src/api/sales'
import { getCashSession } from '../../src/api/cash'
import { searchCustomers, getLoyaltyConfig } from '../../src/api/customers'
import { clp } from '../../src/utils/currency'
import tw, { colors } from '../../src/utils/tw'
import OrdersModal from '../../src/components/pos/OrdersModal'
import type { LoyaltyConfig } from '../../src/api/customers'
import type { Customer, FavoriteSlot, Order, Product } from '../../src/types'

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]
const PANEL_WIDTH   = Math.min(Math.round(Dimensions.get('window').width * 0.9), 420)

type Method = 'cash' | 'card' | 'transfer' | 'mixed'

const METHODS: { key: Method; label: string; icon: string }[] = [
  { key: 'card',     label: 'Tarjeta',   icon: 'credit-card' },
  { key: 'cash',     label: 'Efectivo',  icon: 'dollar-sign' },
  { key: 'transfer', label: 'Transfer.', icon: 'send' },
  { key: 'mixed',    label: 'Mixto',     icon: 'layers' },
]

const SIZE_PRESETS = [4, 8, 12, 16, 20]
const HEADER_BUTTON_SIZE = 48
const INPUT_MIN_HEIGHT = 56
const ACTION_MIN_HEIGHT = 52
const FAVORITE_MIN_HEIGHT = 74

export default function POSScreen() {
  // ── Stores ────────────────────────────────────────────────────────────────
  const { session: cashSession, register, updateSession } = useCashStore()
  const items      = useCartStore((s) => s.items)
  const addItem    = useCartStore((s) => s.addItem)
  const updateQty  = useCartStore((s) => s.updateQty)
  const updatePrice = useCartStore((s) => s.updatePrice)
  const clear      = useCartStore((s) => s.clear)
  const total      = useCartStore(cartTotal)
  const count      = useCartStore(cartCount)
  const { user, logout } = useAuthStore()
  const { slots, loaded: favsLoaded, load: loadFavs, setSlot, clearSlot, gridSize, setGridSize } = useFavoritesStore()

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery]         = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults]     = useState<Product[]>([])
  const [searching, setSearching] = useState(false)

  // ── Favorites edit ────────────────────────────────────────────────────────
  const [favEditMode, setFavEditMode]   = useState(false)
  const [favAssigning, setFavAssigning] = useState<number | null>(null)
  const [favSearch, setFavSearch]       = useState('')
  const [favResults, setFavResults]     = useState<Product[]>([])

  // ── Cart panel ────────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current
  const [showCart, setShowCart] = useState(false)

  // ── Discount editor ───────────────────────────────────────────────────────
  const [discountOpenId, setDiscountOpenId] = useState<string | null>(null)
  const [discountMode, setDiscountMode]     = useState<'pct' | 'fixed'>('pct')
  const [discountValue, setDiscountValue]   = useState('')

  // ── Active order ──────────────────────────────────────────────────────────
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [showOrders, setShowOrders]   = useState(false)

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [showPay, setShowPay]         = useState(false)
  const [method, setMethod]           = useState<Method>('card')
  const [cashAmt, setCashAmt]         = useState('')
  const [cardAmt, setCardAmt]         = useState('')
  const [transferAmt, setTransferAmt] = useState('')
  const [paying, setPaying]           = useState(false)

  // ── Customer / loyalty ────────────────────────────────────────────────────
  const [loyaltyConfig, setLoyaltyConfig]         = useState<LoyaltyConfig>({ points_per_thousand: 1, point_value: 1 })
  const [selectedCustomer, setSelectedCustomer]   = useState<Customer | null>(null)
  const [customerQuery, setCustomerQuery]         = useState('')
  const [customerResults, setCustomerResults]     = useState<Customer[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [pointsToRedeem, setPointsToRedeem]       = useState(0)

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!favsLoaded) loadFavs()
    getLoyaltyConfig().then(setLoyaltyConfig).catch(() => {})
  }, [])

  // ── Search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debounced.trim().length < 2) { setResults([]); return }
    setSearching(true)
    searchProducts(debounced.trim())
      .then(setResults).catch(() => setResults([]))
      .finally(() => setSearching(false))
  }, [debounced])

  // ── Fav assign search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (favSearch.trim().length < 2) { setFavResults([]); return }
    const t = setTimeout(() => {
      searchProducts(favSearch.trim()).then((r) => setFavResults(r.slice(0, 8))).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [favSearch])

  // ── Customer search debounce ──────────────────────────────────────────────
  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomerResults([]); return }
    const t = setTimeout(() => {
      setCustomerSearching(true)
      searchCustomers(customerQuery.trim())
        .then(setCustomerResults).catch(() => setCustomerResults([]))
        .finally(() => setCustomerSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery])

  const isSearchMode = query.trim().length >= 2

  // ── Cart panel animation ──────────────────────────────────────────────────
  const openCart = () => {
    setShowCart(true)
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
  }
  const closeCart = () => {
    Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => setShowCart(false))
  }

  // ── Favorites tap with stock validation ───────────────────────────────────
  const handleFavTap = async (fav: FavoriteSlot) => {
    try {
      const product = await getProductById(fav.product_id)
      handleAddProduct(product)
    } catch {
      Alert.alert('Producto no disponible', `No se pudo obtener ${fav.product_name}. Puede que haya sido eliminado.`, [
        { text: 'OK' },
        { text: 'Quitar del favorito', onPress: () => clearSlot(fav.slot) },
      ])
    }
  }

  // ── Add product (with stock validation feedback) ──────────────────────────
  const handleAddProduct = (product: Product) => {
    const result = addItem(product)
    if (result === 'no_stock') {
      Alert.alert('Sin stock', `${product.name} no tiene stock disponible`)
      return
    }
    if (result === 'exceed_stock') {
      Alert.alert('Stock insuficiente', `Solo hay ${product.stock} unidad${product.stock !== 1 ? 'es' : ''} de ${product.name}`)
      return
    }
    setQuery('')
    setResults([])
    Keyboard.dismiss()
    if (result === 'low_stock') {
      const reserved = items.find((i) => i.product.id === product.id)?.quantity ?? 0
      const remaining = product.stock - reserved - 1
      Alert.alert('Stock bajo', `Solo quedan ${remaining} unidad${remaining !== 1 ? 'es' : ''} de ${product.name}`)
    }
  }

  // ── Discount ──────────────────────────────────────────────────────────────
  const getDiscountPreview = (item: typeof items[0]) => {
    const orig = item.product.is_on_offer && item.product.discount_price != null
      ? item.product.discount_price : item.product.sell_price
    const n = parseFloat(discountValue)
    if (isNaN(n) || n < 0) return orig
    if (discountMode === 'pct') return Math.round(orig * (1 - n / 100))
    return Math.round(orig - n)
  }

  const handleApplyDiscount = (item: typeof items[0]) => {
    const newPrice = getDiscountPreview(item)
    const orig = item.product.sell_price
    if (newPrice < 0 || newPrice > orig) return
    updatePrice(item.product.id, newPrice)
    setDiscountOpenId(null)
    setDiscountValue('')
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Salir del sistema?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login') } },
    ])
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  const loyaltyDiscount = Math.min(pointsToRedeem * loyaltyConfig.point_value, total)
  const effectiveTotal  = total - loyaltyDiscount
  const cashNum     = parseInt(cashAmt)     || 0
  const cardNum     = parseInt(cardAmt)     || 0
  const transferNum = parseInt(transferAmt) || 0
  const mixedSum    = cashNum + cardNum + transferNum
  const change      = method === 'cash' ? Math.max(cashNum - effectiveTotal, 0) : method === 'mixed' ? Math.max(mixedSum - effectiveTotal, 0) : 0
  const canPay =
    (method === 'cash' && cashNum >= effectiveTotal) ||
    method === 'card' ||
    method === 'transfer' ||
    (method === 'mixed' && mixedSum >= effectiveTotal)

  const resetPay = () => {
    setMethod('card'); setCashAmt(''); setCardAmt(''); setTransferAmt('')
    setSelectedCustomer(null); setCustomerQuery(''); setCustomerResults([])
    setPointsToRedeem(0)
  }

  // ── Order callbacks ───────────────────────────────────────────────────────
  const handleLoadOrder = (order: Order) => {
    clear()
    for (const oi of order.items) {
      const product: Product = {
        id: oi.product_id, sku: oi.product_sku, name: oi.product_name,
        sell_price: oi.unit_price, cost_price: 0, tax_rate: 19,
        stock: 9999, min_stock: 0, is_active: true, is_pack: false, units_contained: 1,
      }
      for (let k = 0; k < oi.quantity; k++) addItem(product)
    }
    setActiveOrder(order)
  }

  const handleOrderSaved = (order: Order) => {
    if (order.status === 'cancelled') {
      if (activeOrder?.id === order.id) { setActiveOrder(null); clear() }
    } else {
      setActiveOrder(order)
      clear()
    }
    setShowOrders(false)
  }

  // ── Pay ───────────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!cashSession || items.length === 0 || !canPay) return
    setPaying(true)
    try {
      const sale = await createSale({
        cash_session_id: cashSession.id,
        register_id:     cashSession.register_id,
        seller_id:       user?.id,
        items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity, unit_price_override: i.unit_price })),
        payment_method:  method,
        cash_amount:     method === 'card' || method === 'transfer' ? 0 : cashNum,
        card_amount:     method === 'cash' || method === 'transfer' ? 0 : method === 'card' ? effectiveTotal : cardNum,
        transfer_amount: method === 'transfer' ? effectiveTotal : method === 'mixed' ? transferNum : 0,
        ...(activeOrder ? { order_ids: [activeOrder.id] } : {}),
        ...(selectedCustomer ? { customer_id: selectedCustomer.id, points_to_redeem: pointsToRedeem } : {}),
      })
      try { const fresh = await getCashSession(cashSession.id); updateSession(fresh) } catch {}
      clear()
      setActiveOrder(null)
      setShowPay(false)
      resetPay()
      const lines: string[] = []
      if (change > 0) lines.push(`Vuelto: ${clp(change)}`)
      if (sale.points_earned > 0) lines.push(`+${sale.points_earned} puntos ganados`)
      if (pointsToRedeem > 0) lines.push(`${pointsToRedeem} puntos canjeados`)
      Alert.alert('Venta completada', lines.length > 0 ? lines.join('\n') : '✓ Registrada correctamente')
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Intenta nuevamente')
    } finally {
      setPaying(false)
    }
  }

  // ── No session guard ──────────────────────────────────────────────────────
  if (!cashSession) {
    return (
      <SafeAreaView style={tw`flex-1 bg-gray-50`}>
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <Image source={require('../../assets/icon.png')} style={{ width: 86, height: 86, borderRadius: 20, opacity: 0.4 }} />
          <Text style={tw`text-3xl font-bold text-gray-800 mt-5 mb-3`}>Sin sesión de caja</Text>
          <Text style={[tw`text-center mb-8`, { color: colors.gray500, fontSize: 17, lineHeight: 24 }]}>
            Abre una sesión de caja para comenzar a vender.
          </Text>
          <TouchableOpacity
            style={[tw`px-8 rounded-2xl items-center justify-center`, { backgroundColor: colors.primary, minHeight: 58 }]}
            onPress={() => router.push('/(pos)/cash')}
          >
            <Text style={[tw`text-white font-bold`, { fontSize: 18 }]}>Ir a Caja</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Favorites grid ────────────────────────────────────────────────────────
  const favoritesSection = (
    <View style={tw`mb-4`}>
      {/* Header */}
      <View style={[tw`flex-row items-center justify-between mb-3`, { paddingHorizontal: 2 }]}>
        <View style={tw`flex-row items-center gap-2`}>
          <Feather name="star" size={16} color="#f59e0b" />
          <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 15 }]}>
            Favoritos ({gridSize} slots)
          </Text>
        </View>
        <TouchableOpacity onPress={() => { setFavEditMode((v) => !v); setFavAssigning(null) }}>
          <Text style={[tw`font-semibold`, { color: favEditMode ? colors.green600 : colors.primary, fontSize: 15 }]}>
            {favEditMode ? 'Listo' : 'Editar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grid size presets (edit mode) */}
      {favEditMode && (
        <View style={[tw`flex-row items-center mb-3 flex-wrap`, { gap: 8 }]}>
          <Text style={[tw`text-sm`, { color: colors.gray500, fontSize: 14 }]}>Slots:</Text>
          {SIZE_PRESETS.map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setGridSize(n)}
              style={[
                tw`px-3 rounded-xl border items-center justify-center`,
                { minHeight: 40 },
                gridSize === n
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.gray200 },
              ]}
            >
              <Text style={[tw`font-semibold`, { color: gridSize === n ? '#fff' : colors.gray500, fontSize: 14 }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Assign search */}
      {favAssigning !== null && (
        <View style={[tw`bg-white rounded-2xl p-4 mb-3 border`, { borderColor: colors.primary }]}>
          <Text style={[tw`mb-2`, { color: colors.gray500, fontSize: 14 }]}>
            Buscar producto para favorito {favAssigning + 1}:
          </Text>
          <TextInput
            value={favSearch}
            onChangeText={setFavSearch}
            placeholder="Nombre o código..."
            autoFocus
            style={[tw`border rounded-xl px-4 py-3 text-gray-800`, { borderColor: colors.gray200, borderWidth: 1, fontSize: 16, minHeight: INPUT_MIN_HEIGHT }]}
          />
          {favResults.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => {
                setSlot(favAssigning, { product_id: p.id, product_name: p.name, sell_price: p.sell_price })
                setFavAssigning(null); setFavSearch(''); setFavResults([])
              }}
              style={[tw`flex-row items-center justify-between py-3`, { borderTopWidth: 1, borderTopColor: colors.gray100 }]}
            >
              <Text style={[tw`text-gray-800 flex-1`, { fontSize: 16 }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[tw`font-semibold ml-2`, { color: colors.primary, fontSize: 14 }]}>{clp(p.sell_price)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setFavAssigning(null); setFavSearch(''); setFavResults([]) }} style={tw`mt-3`}>
            <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14 }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Grid 4 cols */}
      <View style={[tw`flex-row flex-wrap`, { gap: 8 }]}>
        {slots.map((fav, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              if (favEditMode) {
                if (fav) clearSlot(i)
                else { setFavAssigning(i); setFavSearch(''); setFavResults([]) }
              } else if (fav) {
                handleFavTap(fav)
              }
            }}
            style={[
              { width: '23%', minHeight: FAVORITE_MIN_HEIGHT, borderRadius: 16, padding: 8, justifyContent: 'center', alignItems: 'flex-start', borderWidth: 1.5 },
              fav
                ? favEditMode
                  ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                  : { backgroundColor: '#fefce8', borderColor: '#fde68a' }
                : favEditMode
                  ? { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderStyle: 'dashed' }
                  : { backgroundColor: colors.gray50, borderColor: colors.gray200, borderStyle: 'dashed' },
            ]}
            activeOpacity={0.7}
          >
            {fav ? (
              <>
                {favEditMode && (
                  <View style={{ position: 'absolute', top: 4, right: 4 }}>
                    <Feather name="x" size={12} color={colors.red600} />
                  </View>
                )}
                <Text style={[tw`font-semibold`, { fontSize: 12, color: colors.gray800, lineHeight: 16 }]} numberOfLines={2}>
                  {fav.product_name}
                </Text>
                <Text style={[tw`font-bold mt-1`, { fontSize: 12, color: colors.primary }]}>{clp(fav.sell_price)}</Text>
              </>
            ) : (
              <View style={tw`w-full items-center`}>
                {favEditMode && <Feather name="plus" size={22} color="#93c5fd" />}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  // ── Cart item renderer (used in sliding panel) ────────────────────────────
  const renderCartItem = ({ item }: { item: typeof items[0] }) => {
    const isDiscountOpen = discountOpenId === item.product.id
    const origPrice = item.product.is_on_offer && item.product.discount_price != null
      ? item.product.discount_price : item.product.sell_price
    const previewPrice = isDiscountOpen ? getDiscountPreview(item) : item.unit_price
    const hasDiscount  = item.unit_price < origPrice
    const realStock    = item.product.stock < 9999
    const remaining    = realStock ? item.product.stock - item.quantity : null
    const isOutOfStock = realStock && item.product.stock <= 0
    const isLowStock   = realStock && remaining !== null && remaining <= (item.product.min_stock ?? 0)

    return (
      <View style={[tw`bg-white rounded-xl mb-2`, {
        elevation: 1,
        borderWidth: isOutOfStock ? 1.5 : 0,
        borderColor: colors.red600,
      }]}>
        <View style={[tw`px-4 py-4 flex-row items-center`, isDiscountOpen ? { borderBottomWidth: 1, borderBottomColor: colors.gray100 } : {}]}>
          <View style={tw`flex-1`}>
            <Text style={[tw`font-semibold text-gray-800`, { fontSize: 16, lineHeight: 21 }]} numberOfLines={1}>{item.product.name}</Text>
            <View style={[tw`flex-row items-center mt-1 flex-wrap`, { gap: 8 }]}>
              <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14 }]}>{clp(item.unit_price)} c/u</Text>
              {hasDiscount && (
                <View style={[tw`px-2 py-1 rounded-lg`, { backgroundColor: colors.red100 }]}>
                  <Text style={[tw`font-semibold`, { color: colors.red600, fontSize: 12 }]}>
                    -{Math.round((1 - item.unit_price / origPrice) * 100)}%
                  </Text>
                </View>
              )}
              {isOutOfStock && (
                <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-lg`, { backgroundColor: colors.red100 }]}>
                  <Feather name="alert-triangle" size={11} color={colors.red600} />
                  <Text style={[tw`font-semibold`, { color: colors.red600, fontSize: 12 }]}>Sin stock</Text>
                </View>
              )}
              {!isOutOfStock && isLowStock && remaining !== null && (
                <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-lg`, { backgroundColor: '#fef3c7' }]}>
                  <Feather name="alert-triangle" size={11} color="#d97706" />
                  <Text style={[tw`font-semibold`, { color: '#d97706', fontSize: 12 }]}>Solo quedan {remaining}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Discount button */}
          <TouchableOpacity
            onPress={() => {
              if (isDiscountOpen) { setDiscountOpenId(null); setDiscountValue('') }
              else { setDiscountOpenId(item.product.id); setDiscountMode('pct'); setDiscountValue('') }
            }}
            style={[tw`rounded-xl items-center justify-center mr-2`, { backgroundColor: isDiscountOpen ? `${colors.primary}18` : colors.gray100, width: 40, height: 40 }]}
          >
            <Feather name="percent" size={16} color={isDiscountOpen ? colors.primary : colors.gray400} />
          </TouchableOpacity>

          {/* Qty controls */}
          <View style={[tw`flex-row items-center`, { gap: 6 }]}>
            <TouchableOpacity
              onPress={() => updateQty(item.product.id, item.quantity - 1)}
              style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.gray100, width: 38, height: 38 }]}
            >
              <Feather name="minus" size={16} color={colors.gray500} />
            </TouchableOpacity>
            <Text style={[tw`font-bold text-gray-800 text-center`, { width: 28, fontSize: 18 }]}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => {
                const ok = updateQty(item.product.id, item.quantity + 1)
                if (!ok) Alert.alert('Stock insuficiente', `Solo hay ${item.product.stock} unidad${item.product.stock !== 1 ? 'es' : ''} de ${item.product.name}`)
              }}
              style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.primary, width: 38, height: 38 }]}
            >
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[tw`font-bold text-gray-800`, { width: 76, textAlign: 'right', fontSize: 16 }]}>
            {clp(item.subtotal)}
          </Text>
        </View>

        {/* Inline discount editor */}
        {isDiscountOpen && (
          <View style={[tw`px-4 py-4`, { backgroundColor: `${colors.primary}08` }]}>
            <View style={[tw`flex-row mb-3 flex-wrap`, { gap: 8 }]}>
              {(['pct', 'fixed'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => { setDiscountMode(m); setDiscountValue('') }}
                  style={[
                    tw`px-4 rounded-xl border items-center justify-center`,
                    { minHeight: 42 },
                    discountMode === m
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: '#fff', borderColor: colors.gray200 },
                  ]}
                >
                  <Text style={[tw`font-semibold`, { color: discountMode === m ? '#fff' : colors.gray500, fontSize: 14 }]}>
                    {m === 'pct' ? '% Porcentaje' : '$ Monto fijo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={tw`flex-row items-center gap-2`}>
              <TextInput
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountMode === 'pct' ? '% descuento' : '$ a descontar'}
                keyboardType="numeric"
                autoFocus
                style={[tw`flex-1 border rounded-xl px-4 py-3 text-gray-800`, { borderWidth: 1, borderColor: colors.gray200, backgroundColor: '#fff', fontSize: 16, minHeight: ACTION_MIN_HEIGHT }]}
              />
              <Text style={[tw`text-sm`, { color: colors.gray500, fontSize: 15 }]}>
                {clp(origPrice)} → <Text style={{ color: previewPrice <= origPrice ? colors.primary : colors.red600, fontWeight: '700' }}>{clp(previewPrice)}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => handleApplyDiscount(item)}
                disabled={previewPrice < 0 || previewPrice > origPrice || discountValue === ''}
                style={[tw`px-4 rounded-xl items-center justify-center`, { backgroundColor: (previewPrice >= 0 && previewPrice <= origPrice && discountValue !== '') ? colors.primary : colors.gray200, minHeight: ACTION_MIN_HEIGHT }]}
              >
                <Feather name="check" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setDiscountOpenId(null); setDiscountValue('') }}
                style={[tw`px-3 rounded-xl items-center justify-center`, { backgroundColor: colors.gray100, minHeight: ACTION_MIN_HEIGHT }]}
              >
                <Feather name="x" size={18} color={colors.gray500} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[tw`bg-white px-4 py-3 flex-row items-center`, { borderBottomWidth: 1, borderBottomColor: colors.gray200, gap: 10 }]}>
        <Image source={require('../../assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 8 }} />
        <View style={tw`flex-1`}>
          <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 17 }]}>{register?.name ?? 'Caja'}</Text>
          {activeOrder && (
            <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14 }]} numberOfLines={1}>
              Comanda #{activeOrder.order_number}{activeOrder.reference ? ` · ${activeOrder.reference}` : ''}
            </Text>
          )}
        </View>
        {/* Orders */}
        <TouchableOpacity
          onPress={() => setShowOrders(true)}
          style={[tw`rounded-xl items-center justify-center`, { backgroundColor: activeOrder ? `${colors.primary}18` : colors.gray100, width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE }]}
        >
          <Feather name="clipboard" size={20} color={activeOrder ? colors.primary : colors.gray500} />
        </TouchableOpacity>
        {/* Cart toggle with badge */}
        <TouchableOpacity
          onPress={openCart}
          style={[tw`rounded-xl items-center justify-center`, { backgroundColor: count > 0 ? `${colors.primary}18` : colors.gray100, width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE }]}
        >
          <View>
            <Feather name="shopping-cart" size={20} color={count > 0 ? colors.primary : colors.gray500} />
            {count > 0 && (
              <View style={{
                position: 'absolute', top: -6, right: -6,
                backgroundColor: colors.primary, borderRadius: 10,
                minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[tw`rounded-xl items-center justify-center`, { backgroundColor: colors.gray100, width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE }]}
        >
          <Feather name="log-out" size={20} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <View style={[tw`bg-white px-4 py-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
        <View style={[tw`flex-row items-center rounded-2xl px-4`, { backgroundColor: colors.gray100, gap: 10, minHeight: INPUT_MIN_HEIGHT }]}>
          <Feather name="search" size={18} color={colors.gray400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar producto, SKU o código..."
            returnKeyType="search"
            style={[tw`flex-1 text-gray-800`, { fontSize: 17 }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]) }} style={tw`p-1`}>
              <Feather name="x" size={18} color={colors.gray400} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      {/* ── Main content ────────────────────────────────────────────── */}
      <View style={tw`flex-1`}>
        {/* Favorites + cart strip — always visible */}
        <ScrollView contentContainerStyle={tw`p-4 pb-6`} keyboardShouldPersistTaps="handled">
          {favoritesSection}
          {items.length === 0 && (
            <View style={tw`items-center py-10`}>
              <Feather name="shopping-cart" size={40} color={colors.gray200} />
              <Text style={[tw`font-semibold mt-3`, { color: colors.gray400, fontSize: 17 }]}>Carrito vacío</Text>
              <Text style={[tw`mt-2 text-center`, { color: colors.gray400, fontSize: 16, lineHeight: 22 }]}>
                Busca un producto o toca un favorito
              </Text>
            </View>
          )}
          {items.length > 0 && (
            <TouchableOpacity
              onPress={openCart}
              style={[tw`flex-row items-center justify-between rounded-2xl px-5 py-4`, { backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: `${colors.primary}30` }]}
            >
              <View style={tw`flex-row items-center gap-3`}>
                <Feather name="shopping-cart" size={18} color={colors.primary} />
                <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>
                  {count} ítem{count !== 1 ? 's' : ''} en el carrito
                </Text>
              </View>
              <View style={tw`flex-row items-center gap-2`}>
                <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 18 }]}>{clp(total)}</Text>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Search results overlay — floats on top of favorites */}
        {isSearchMode && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 20, backgroundColor: '#f9fafb' }]}>
            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={tw`px-4 pt-3 pb-6`}
              ListEmptyComponent={
                !searching ? (
                  <View style={tw`items-center py-16`}>
                    <Feather name="search" size={40} color={colors.gray200} />
                    <Text style={[tw`mt-3`, { color: colors.gray400, fontSize: 16 }]}>Sin resultados para "{debounced}"</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const price    = item.is_on_offer && item.discount_price != null ? item.discount_price : item.sell_price
                const inCart   = items.find((i) => i.product.id === item.id)
                const cartQty  = inCart?.quantity ?? 0
                const remaining = item.stock - cartQty
                const noStock  = item.stock <= 0
                const lowStock = !noStock && remaining <= (item.min_stock ?? 0)
                return (
                  <TouchableOpacity
                    onPress={() => handleAddProduct(item)}
                    activeOpacity={noStock ? 1 : 0.7}
                    style={[
                      tw`bg-white rounded-2xl px-5 py-4 mb-3 flex-row items-center`,
                      { elevation: 1 },
                      noStock ? { borderWidth: 1, borderColor: colors.red600, opacity: 0.7 } :
                      inCart  ? { borderWidth: 1.5, borderColor: colors.primary } : {},
                    ]}
                  >
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-semibold text-gray-800`, { fontSize: 17, lineHeight: 22 }]} numberOfLines={1}>{item.name}</Text>
                      <View style={[tw`flex-row items-center mt-1 flex-wrap`, { gap: 8 }]}>
                        <Text style={{ color: colors.gray400, fontSize: 13 }}>SKU: {item.sku}</Text>
                        {noStock ? (
                          <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-lg`, { backgroundColor: colors.red100 }]}>
                            <Feather name="alert-triangle" size={11} color={colors.red600} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red600 }}>Sin stock</Text>
                          </View>
                        ) : lowStock ? (
                          <View style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-lg`, { backgroundColor: '#fef3c7' }]}>
                            <Feather name="alert-triangle" size={11} color="#d97706" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#d97706' }}>Solo quedan {remaining}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: colors.gray400, fontSize: 13 }}>Stock: {item.stock}</Text>
                        )}
                      </View>
                    </View>
                    <View style={tw`items-end mr-3`}>
                      <Text style={[tw`font-bold`, { color: item.is_on_offer ? colors.red600 : colors.gray800, fontSize: 20 }]}>{clp(price)}</Text>
                      {item.is_on_offer && item.discount_price != null && (
                        <Text style={{ color: colors.gray400, textDecorationLine: 'line-through', fontSize: 13 }}>{clp(item.sell_price)}</Text>
                      )}
                    </View>
                    <View style={[tw`rounded-full items-center justify-center`, {
                      backgroundColor: noStock ? colors.gray100 : inCart ? colors.primary : colors.gray100,
                      width: 46, height: 46,
                    }]}>
                      <Feather name={noStock ? 'x' : 'plus'} size={20} color={noStock ? colors.gray400 : inCart ? '#fff' : colors.gray500} />
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        )}
      </View>

      {/* ── Cart sliding panel ──────────────────────────────────────── */}
      {showCart && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)', zIndex: 10 }]}
            onPress={closeCart}
            activeOpacity={1}
          />
          {/* Panel */}
          <Animated.View style={[
            StyleSheet.absoluteFill,
            {
              left: undefined,
              right: 0,
              width: PANEL_WIDTH,
              zIndex: 11,
              backgroundColor: '#f9fafb',
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 18,
              elevation: 18,
              borderTopLeftRadius: 20,
              borderBottomLeftRadius: 20,
              transform: [{ translateX: slideAnim }],
              overflow: 'hidden',
            },
          ]}>
            {/* Panel header */}
            <View style={[tw`bg-white flex-row items-center justify-between px-5 py-4`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
              <View style={tw`flex-row items-center gap-3`}>
                <View style={[tw`w-11 h-11 rounded-full items-center justify-center`, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="shopping-cart" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Carrito</Text>
                  {count > 0 && (
                    <Text style={{ fontSize: 14, color: colors.gray400, marginTop: 2 }}>
                      {count} ítem{count !== 1 ? 's' : ''} · {clp(total)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={closeCart}
                style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
              >
                <Feather name="x" size={18} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={tw`flex-1 items-center justify-center`}>
                <Feather name="shopping-cart" size={40} color={colors.gray200} />
                <Text style={[tw`mt-3 font-semibold`, { color: colors.gray400 }]}>Carrito vacío</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(i) => i.product.id}
                contentContainerStyle={tw`px-4 py-3 pb-3`}
                keyboardShouldPersistTaps="handled"
                renderItem={renderCartItem}
              />
            )}

            {/* Panel footer */}
            {items.length > 0 && (
              <View style={[tw`bg-white px-5 py-4`, { borderTopWidth: 1, borderTopColor: colors.gray200 }]}>
                {activeOrder && (
                  <View style={[tw`flex-row items-center gap-2 mb-3 px-3 py-2 rounded-xl`, { backgroundColor: `${colors.primary}10` }]}>
                    <Feather name="clipboard" size={14} color={colors.primary} />
                    <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 14 }]}>
                      Comanda #{activeOrder.order_number}{activeOrder.reference ? ` · ${activeOrder.reference}` : ''}
                    </Text>
                  </View>
                )}
                <View style={tw`flex-row items-center justify-between mb-3`}>
                  <Text style={{ color: colors.gray500, fontSize: 16 }}>{count} ítem{count !== 1 ? 's' : ''}</Text>
                  <Text style={[tw`font-bold`, { color: colors.primary, fontSize: 32 }]}>{clp(total)}</Text>
                </View>
                <View style={[tw`flex-row`, { gap: 8 }]}>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Vaciar carrito', '¿Eliminar todos los productos?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Vaciar', style: 'destructive', onPress: () => { clear(); setActiveOrder(null) } },
                    ])}
                    style={[tw`rounded-2xl items-center justify-center border`, { flex: 1, borderColor: colors.gray200, minHeight: 56 }]}
                  >
                    <Feather name="trash-2" size={20} color={colors.gray400} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { closeCart(); setTimeout(() => setShowPay(true), 250) }}
                    style={[tw`rounded-2xl items-center flex-row justify-center`, { flex: 3, backgroundColor: colors.primary, gap: 8, minHeight: 56 }]}
                  >
                    <Feather name="credit-card" size={20} color="#fff" />
                    <Text style={[tw`font-bold text-white`, { fontSize: 18 }]}>
                      Cobrar {clp(loyaltyDiscount > 0 ? effectiveTotal : total)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* ── Orders Modal ────────────────────────────────────────────── */}
      <OrdersModal
        visible={showOrders}
        activeOrder={activeOrder}
        onClose={() => setShowOrders(false)}
        onLoadOrder={handleLoadOrder}
        onOrderSaved={handleOrderSaved}
      />

      {/* ── Payment Modal ───────────────────────────────────────────── */}
      <Modal
        visible={showPay}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowPay(false); resetPay() }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={[tw`bg-white px-5 pt-6`, { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }]}>
            {/* Header */}
            <View style={[tw`flex-row items-center justify-between mb-4`, { gap: 8 }]}>
              <View>
                <Text style={tw`text-2xl font-bold text-gray-800`}>Cobrar {clp(effectiveTotal)}</Text>
                {loyaltyDiscount > 0 && (
                  <Text style={[tw`font-semibold`, { color: colors.green600, fontSize: 14, marginTop: 4 }]}>
                    Descuento puntos: −{clp(loyaltyDiscount)} (original {clp(total)})
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setShowPay(false); resetPay() }}
                style={[tw`rounded-full items-center justify-center`, { width: 44, height: 44, backgroundColor: colors.gray100 }]}
              >
                <Feather name="x" size={20} color={colors.gray400} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* Customer search */}
              <View style={[tw`mb-4 rounded-xl border`, { borderColor: selectedCustomer ? colors.primary : colors.gray200 }]}>
                {selectedCustomer ? (
                  <View style={[tw`px-4 py-4 flex-row items-center`, { backgroundColor: `${colors.primary}08`, borderRadius: 12 }]}>
                    <View style={[tw`w-11 h-11 rounded-full items-center justify-center mr-3`, { backgroundColor: `${colors.primary}20` }]}>
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-semibold`, { color: colors.gray800, fontSize: 16 }]}>{selectedCustomer.name}</Text>
                      <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14, marginTop: 2 }]}>
                        {selectedCustomer.points_balance} pts · {selectedCustomer.rut ?? selectedCustomer.phone ?? ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setSelectedCustomer(null); setPointsToRedeem(0); setCustomerQuery('') }}
                      style={[tw`rounded-full items-center justify-center`, { width: 36, height: 36 }]}
                    >
                      <Feather name="x" size={18} color={colors.gray400} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[tw`flex-row items-center px-4 rounded-xl`, { backgroundColor: colors.gray50, gap: 10, minHeight: INPUT_MIN_HEIGHT }]}>
                    <Feather name="user" size={17} color={colors.gray400} />
                    <TextInput
                      value={customerQuery}
                      onChangeText={setCustomerQuery}
                      placeholder="Buscar cliente (nombre, RUT, teléfono)…"
                      style={[tw`flex-1 text-gray-800`, { fontSize: 16 }]}
                    />
                    {customerSearching && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>
                )}
                {!selectedCustomer && customerResults.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.gray100 }}>
                    {customerResults.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => { setSelectedCustomer(c); setCustomerQuery(''); setCustomerResults([]); setPointsToRedeem(0) }}
                        style={[tw`px-4 py-4 flex-row items-center`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}
                      >
                        <View style={tw`flex-1`}>
                          <Text style={[tw`font-semibold text-gray-800`, { fontSize: 16 }]}>{c.name}</Text>
                          <Text style={[tw`text-sm`, { color: colors.gray400, fontSize: 14, marginTop: 2 }]}>{c.rut ?? c.phone ?? '—'} · {c.points_balance} pts</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={colors.gray400} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Points redemption */}
              {selectedCustomer && selectedCustomer.points_balance > 0 && (
                <View style={[tw`mb-4 rounded-2xl px-4 py-4`, { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde68a' }]}>
                  <View style={tw`flex-row items-center justify-between mb-2`}>
                    <View style={tw`flex-row items-center gap-2`}>
                      <Feather name="star" size={15} color="#d97706" />
                      <Text style={[tw`font-semibold`, { color: '#92400e', fontSize: 16 }]}>Canjear puntos</Text>
                    </View>
                    <Text style={[tw`text-sm`, { color: '#92400e', fontSize: 13 }]}>
                      Disponibles: {selectedCustomer.points_balance} pts = {clp(selectedCustomer.points_balance * loyaltyConfig.point_value)}
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-2`}>
                    <TextInput
                      value={pointsToRedeem > 0 ? String(pointsToRedeem) : ''}
                      onChangeText={(v) => setPointsToRedeem(Math.min(parseInt(v) || 0, selectedCustomer.points_balance))}
                      placeholder="0 pts"
                      keyboardType="numeric"
                      style={[tw`border rounded-xl px-4 py-3 font-bold text-gray-800 text-center`, { borderColor: '#fde68a', borderWidth: 1, flex: 1, backgroundColor: '#fff', fontSize: 18, minHeight: ACTION_MIN_HEIGHT }]}
                    />
                    <TouchableOpacity onPress={() => setPointsToRedeem(selectedCustomer.points_balance)}
                      style={[tw`px-4 rounded-xl items-center justify-center`, { backgroundColor: '#fde68a', minHeight: ACTION_MIN_HEIGHT }]}>
                      <Text style={[tw`font-semibold`, { color: '#92400e', fontSize: 14 }]}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPointsToRedeem(0)}
                      style={[tw`px-4 rounded-xl items-center justify-center`, { backgroundColor: '#fff', minHeight: ACTION_MIN_HEIGHT }]}>
                      <Text style={[tw`font-semibold`, { color: colors.gray500, fontSize: 14 }]}>Limpiar</Text>
                    </TouchableOpacity>
                  </View>
                  {loyaltyDiscount > 0 && (
                    <Text style={[tw`font-semibold mt-3`, { color: colors.green600, fontSize: 14 }]}>
                      Descuento: −{clp(loyaltyDiscount)} → Total: {clp(effectiveTotal)}
                    </Text>
                  )}
                </View>
              )}

              {/* Method selector */}
              <View style={[tw`flex-row flex-wrap mb-4`, { gap: 8 }]}>
                {METHODS.map(({ key, label, icon }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setMethod(key)}
                    style={[
                      tw`flex-row items-center gap-2 px-4 rounded-2xl border`,
                      { flex: 1, minWidth: '45%', justifyContent: 'center', minHeight: ACTION_MIN_HEIGHT },
                      method === key
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { borderColor: colors.gray200 },
                    ]}
                  >
                    <Feather name={icon as any} size={18} color={method === key ? '#fff' : colors.gray400} />
                    <Text style={[tw`font-semibold`, { color: method === key ? '#fff' : colors.gray500, fontSize: 16 }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Efectivo */}
              {(method === 'cash' || method === 'mixed') && (
                <View style={tw`mb-3`}>
                  <Text style={[tw`font-semibold mb-2`, { color: colors.gray500, fontSize: 16 }]}>Monto efectivo</Text>
                  <TextInput
                    value={cashAmt} onChangeText={setCashAmt} placeholder="0"
                    keyboardType="numeric" autoFocus={method === 'cash'}
                    style={[tw`border rounded-2xl px-4 py-4 font-bold text-gray-800 text-center mb-3`, { borderWidth: 1.5, borderColor: cashNum >= (method === 'cash' ? effectiveTotal : 1) ? colors.primary : colors.gray200, fontSize: 28, minHeight: 60 }]}
                  />
                  <View style={[tw`flex-row flex-wrap mb-3`, { gap: 8 }]}>
                    {QUICK_AMOUNTS.map((a) => (
                      <TouchableOpacity key={a} onPress={() => setCashAmt(String(method === 'cash' ? a : cashNum + a))}
                        style={[tw`rounded-xl items-center justify-center`, { backgroundColor: colors.gray100, flex: 1, minWidth: '30%', minHeight: ACTION_MIN_HEIGHT }]}>
                        <Text style={[tw`font-semibold`, { color: colors.gray800, fontSize: 16 }]}>{clp(a)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {method === 'cash' && (
                    <TouchableOpacity onPress={() => setCashAmt(String(effectiveTotal))}
                      style={[tw`rounded-2xl items-center justify-center`, { backgroundColor: `${colors.primary}18`, minHeight: ACTION_MIN_HEIGHT }]}>
                      <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>Monto exacto: {clp(effectiveTotal)}</Text>
                    </TouchableOpacity>
                  )}
                  {method === 'mixed' && (
                    <TouchableOpacity onPress={() => setCashAmt(String(Math.max(effectiveTotal - cardNum - transferNum, 0)))}
                      style={[tw`rounded-2xl items-center justify-center`, { backgroundColor: `${colors.primary}18`, minHeight: ACTION_MIN_HEIGHT }]}>
                      <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>Resto: {clp(Math.max(effectiveTotal - cardNum - transferNum, 0))}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Tarjeta pura */}
              {method === 'card' && (
                <View style={[tw`rounded-2xl px-4 py-5 mb-3 items-center`, { backgroundColor: colors.gray100 }]}>
                  <Feather name="credit-card" size={26} color={colors.primary} />
                  <Text style={[tw`font-bold mt-3`, { color: colors.primary, fontSize: 32 }]}>{clp(effectiveTotal)}</Text>
                  <Text style={[tw`mt-2`, { color: colors.gray400, fontSize: 15 }]}>Confirma el pago antes de continuar</Text>
                </View>
              )}

              {/* Tarjeta mixto */}
              {method === 'mixed' && (
                <View style={tw`mb-3`}>
                  <Text style={[tw`font-semibold mb-2`, { color: colors.gray500, fontSize: 16 }]}>Monto tarjeta</Text>
                  <TextInput value={cardAmt} onChangeText={setCardAmt} placeholder="0" keyboardType="numeric"
                    style={[tw`border rounded-2xl px-4 py-4 font-bold text-gray-800 text-center mb-3`, { borderWidth: 1.5, borderColor: colors.gray200, fontSize: 28, minHeight: 60 }]} />
                  <TouchableOpacity onPress={() => setCardAmt(String(Math.max(effectiveTotal - cashNum - transferNum, 0)))}
                    style={[tw`rounded-2xl items-center justify-center`, { backgroundColor: `${colors.primary}18`, minHeight: ACTION_MIN_HEIGHT }]}>
                    <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>Resto: {clp(Math.max(effectiveTotal - cashNum - transferNum, 0))}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Transferencia pura */}
              {method === 'transfer' && (
                <View style={[tw`rounded-2xl px-4 py-5 mb-3 items-center`, { backgroundColor: colors.gray100 }]}>
                  <Feather name="send" size={26} color={colors.primary} />
                  <Text style={[tw`font-bold mt-3`, { color: colors.primary, fontSize: 32 }]}>{clp(effectiveTotal)}</Text>
                  <Text style={[tw`mt-2`, { color: colors.gray400, fontSize: 15 }]}>Confirma la transferencia antes de continuar</Text>
                </View>
              )}

              {/* Transferencia mixto */}
              {method === 'mixed' && (
                <View style={tw`mb-3`}>
                  <Text style={[tw`font-semibold mb-2`, { color: colors.gray500, fontSize: 16 }]}>Monto transferencia</Text>
                  <TextInput value={transferAmt} onChangeText={setTransferAmt} placeholder="0" keyboardType="numeric"
                    style={[tw`border rounded-2xl px-4 py-4 font-bold text-gray-800 text-center mb-3`, { borderWidth: 1.5, borderColor: colors.gray200, fontSize: 28, minHeight: 60 }]} />
                  <TouchableOpacity onPress={() => setTransferAmt(String(Math.max(effectiveTotal - cashNum - cardNum, 0)))}
                    style={[tw`rounded-2xl items-center justify-center`, { backgroundColor: `${colors.primary}18`, minHeight: ACTION_MIN_HEIGHT }]}>
                    <Text style={[tw`font-semibold`, { color: colors.primary, fontSize: 16 }]}>Resto: {clp(Math.max(effectiveTotal - cashNum - cardNum, 0))}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Mixto total */}
              {method === 'mixed' && mixedSum > 0 && (
                <View style={[tw`rounded-2xl px-4 py-4 mb-3 flex-row justify-between items-center`, { backgroundColor: mixedSum >= effectiveTotal ? '#ecfdf5' : '#fff7ed' }]}>
                  <Text style={{ color: mixedSum >= effectiveTotal ? colors.green600 : '#d97706', fontWeight: '600', fontSize: 16 }}>
                    {mixedSum >= effectiveTotal ? 'Cubierto ✓' : `Falta ${clp(effectiveTotal - mixedSum)}`}
                  </Text>
                  <Text style={{ color: mixedSum >= effectiveTotal ? colors.green600 : '#d97706', fontWeight: '700', fontSize: 17 }}>
                    {clp(mixedSum)} / {clp(effectiveTotal)}
                  </Text>
                </View>
              )}

              {/* Vuelto */}
              {(method === 'cash' || method === 'mixed') && change > 0 && (
                <View style={[tw`rounded-2xl px-4 py-4 mb-3 flex-row justify-between items-center`, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={{ color: colors.green600, fontSize: 16 }}>Vuelto</Text>
                  <Text style={[tw`font-bold`, { color: colors.green600, fontSize: 32 }]}>{clp(change)}</Text>
                </View>
              )}

              {/* Confirm */}
              <TouchableOpacity
                onPress={handlePay}
                disabled={paying || !canPay}
                style={[tw`rounded-2xl items-center flex-row justify-center mb-8`, { backgroundColor: paying || !canPay ? colors.gray200 : colors.green700, gap: 8, minHeight: 60 }]}
              >
                {paying ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="check-circle" size={20} color={canPay ? '#fff' : colors.gray400} />
                    <Text style={[tw`font-bold`, { color: canPay ? '#fff' : colors.gray400, fontSize: 18 }]}>Confirmar Pago</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}
