import { useState, useEffect } from 'react'
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useCartStore, cartTotal } from '../../stores/cartStore'
import { useCashStore } from '../../stores/cashStore'
import { listOrders, createOrder, updateOrder, cancelOrder } from '../../api/orders'
import { clp } from '../../utils/currency'
import tw, { colors } from '../../utils/tw'
import type { Order } from '../../types'

/** Parse server UTC datetime */
function parseServerDate(s: string): Date {
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z')
}

interface Props {
  visible: boolean
  activeOrder: Order | null
  onClose: () => void
  onLoadOrder: (order: Order) => void
  onOrderSaved: (order: Order) => void
}

type Tab = 'open' | 'closed' | 'save'

export default function OrdersModal({ visible, activeOrder, onClose, onLoadOrder, onOrderSaved }: Props) {
  const { session, register } = useCashStore()
  const items = useCartStore((s) => s.items)
  const total = useCartStore(cartTotal)

  const [tab, setTab]             = useState<Tab>('open')
  const [openOrders, setOpenOrders]   = useState<Order[]>([])
  const [closedOrders, setClosedOrders] = useState<Order[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes]         = useState('')

  useEffect(() => {
    if (visible) {
      fetchOrders()
      setTab('open')
      // Pre-fill reference/notes if activeOrder
      if (activeOrder) {
        setReference(activeOrder.reference ?? '')
        setNotes(activeOrder.notes ?? '')
      } else {
        setReference('')
        setNotes('')
      }
    }
  }, [visible])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const [open, closed] = await Promise.all([
        listOrders({ status: 'open', register_id: register?.id }),
        listOrders({ status: 'closed', register_id: register?.id, limit: 30 }),
      ])
      setOpenOrders(open)
      setClosedOrders(closed)
    } catch {}
    setLoading(false)
  }

  // ── Save / update comanda ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session || items.length === 0) return
    setSaving(true)
    try {
      let saved: Order
      if (activeOrder) {
        // Update existing open order
        saved = await updateOrder(activeOrder.id, {
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        })
        Alert.alert('Comanda actualizada', `Comanda #${saved.order_number} guardada`)
      } else {
        saved = await createOrder({
          register_id: session.register_id,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        })
        Alert.alert('Comanda guardada', `Comanda #${saved.order_number} creada`)
      }
      onOrderSaved(saved)
      fetchOrders()
      setTab('open')
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo guardar la comanda')
    } finally {
      setSaving(false)
    }
  }

  // ── Cancel order ─────────────────────────────────────────────────────────
  const handleCancel = (order: Order) => {
    Alert.alert(
      `Cancelar comanda #${order.order_number}`,
      order.reference ? `"${order.reference}" — ¿Confirmar cancelación?` : '¿Confirmar cancelación?',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar comanda', style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder(order.id)
              fetchOrders()
              // If cancelled order was the active one, notify parent
              if (activeOrder?.id === order.id) {
                onOrderSaved({ ...order, status: 'cancelled' })
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo cancelar')
            }
          },
        },
      ],
    )
  }

  // ── Load order into cart ─────────────────────────────────────────────────
  const handleLoad = (order: Order) => {
    Alert.alert(
      `Cargar comanda #${order.order_number}`,
      items.length > 0
        ? 'Esto reemplazará el carrito actual. ¿Continuar?'
        : `Cargar ${order.items.length} producto(s) al carrito`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cargar', onPress: () => { onLoadOrder(order); onClose() } },
      ],
    )
  }

  // ── Render open order card ───────────────────────────────────────────────
  const renderOpenOrder = ({ item: order }: { item: Order }) => {
    const createdAt  = parseServerDate(order.created_at)
    const timeStr    = createdAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const orderTotal = order.items.reduce((s, i) => s + i.subtotal, 0)
    const isActive   = activeOrder?.id === order.id

    return (
      <View style={[
        tw`bg-white rounded-xl px-4 py-3 mb-2`,
        { elevation: 1, borderWidth: 1.5, borderColor: isActive ? colors.primary : colors.gray200 },
      ]}>
        <View style={tw`flex-row items-center`}>
          <View style={[
            tw`w-9 h-9 rounded-full items-center justify-center mr-3`,
            { backgroundColor: isActive ? colors.primary : `${colors.primary}18` },
          ]}>
            <Text style={[tw`font-bold text-xs`, { color: isActive ? '#fff' : colors.primary }]}>
              #{order.order_number}
            </Text>
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`font-semibold text-gray-800`} numberOfLines={1}>
              {order.reference || `Comanda #${order.order_number}`}
            </Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>
              {order.items.length} ítem{order.items.length !== 1 ? 's' : ''} · {timeStr}
            </Text>
          </View>
          <Text style={[tw`font-bold mr-3`, { color: colors.primary }]}>{clp(orderTotal)}</Text>
        </View>
        {isActive && (
          <View style={[tw`mt-2 px-2 py-1 rounded-lg`, { backgroundColor: `${colors.primary}10` }]}>
            <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>Comanda activa — puedes actualizarla desde "Guardar"</Text>
          </View>
        )}
        <View style={[tw`flex-row mt-2`, { gap: 6 }]}>
          <TouchableOpacity
            onPress={() => handleLoad(order)}
            style={[tw`flex-1 flex-row items-center justify-center py-2 rounded-lg gap-1`, { backgroundColor: `${colors.primary}18` }]}
          >
            <Feather name="shopping-cart" size={13} color={colors.primary} />
            <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>Cargar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleCancel(order)}
            style={[tw`flex-1 flex-row items-center justify-center py-2 rounded-lg gap-1`, { backgroundColor: '#fef2f2' }]}
          >
            <Feather name="x" size={13} color={colors.red600} />
            <Text style={[tw`text-xs font-semibold`, { color: colors.red600 }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Render closed order card ─────────────────────────────────────────────
  const renderClosedOrder = ({ item: order }: { item: Order }) => {
    const createdAt  = parseServerDate(order.created_at)
    const dateStr    = createdAt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
    const timeStr    = createdAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const orderTotal = order.items.reduce((s, i) => s + i.subtotal, 0)

    return (
      <View style={[tw`bg-white rounded-xl px-4 py-3 mb-2`, { elevation: 1, borderWidth: 1, borderColor: colors.gray200 }]}>
        <View style={tw`flex-row items-center`}>
          <View style={[tw`w-9 h-9 rounded-full items-center justify-center mr-3`, { backgroundColor: colors.gray100 }]}>
            <Text style={[tw`font-bold text-xs`, { color: colors.gray500 }]}>#{order.order_number}</Text>
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`font-semibold text-gray-700`} numberOfLines={1}>
              {order.reference || `Comanda #${order.order_number}`}
            </Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.gray400 }]}>
              {order.items.length} ítems · {dateStr} {timeStr}
            </Text>
          </View>
          <View style={tw`items-end`}>
            <Text style={[tw`font-bold`, { color: colors.gray800 }]}>{clp(orderTotal)}</Text>
            <View style={[tw`px-2 py-0.5 rounded-full mt-0.5`, { backgroundColor: '#dcfce7' }]}>
              <Text style={[tw`text-xs font-semibold`, { color: colors.green600 }]}>Pagada</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'open',   label: `Abiertas (${openOrders.length})` },
    { key: 'closed', label: 'Pagadas' },
    { key: 'save',   label: activeOrder ? 'Actualizar' : 'Guardar carrito' },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={[tw`bg-white`, { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }]}>

          {/* Header */}
          <View style={[tw`flex-row items-center justify-between px-5 pt-5 pb-3`, { borderBottomWidth: 1, borderBottomColor: colors.gray200 }]}>
            <View style={tw`flex-row items-center gap-2`}>
              <Feather name="clipboard" size={18} color={colors.gray800} />
              <Text style={tw`text-xl font-bold text-gray-800`}>Comandas</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.gray400} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[tw`flex-row px-4 pt-3 pb-2`, { gap: 6 }]}>
            {TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setTab(key)}
                style={[
                  tw`py-2 px-3 rounded-xl items-center border`,
                  { flex: 1 },
                  tab === key
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { borderColor: colors.gray200 },
                ]}
              >
                <Text style={[tw`font-semibold text-xs`, { color: tab === key ? '#fff' : colors.gray500 }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab: Abiertas ─────────────────────────────────────────── */}
          {tab === 'open' && (
            loading ? (
              <View style={tw`items-center py-12`}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : openOrders.length === 0 ? (
              <View style={tw`items-center py-12 px-5`}>
                <Feather name="clipboard" size={40} color={colors.gray200} />
                <Text style={[tw`mt-3 font-semibold`, { color: colors.gray400 }]}>Sin comandas abiertas</Text>
                <TouchableOpacity onPress={() => setTab('save')} style={tw`mt-4`}>
                  <Text style={[tw`text-sm font-semibold`, { color: colors.primary }]}>
                    Guardar carrito como comanda →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={openOrders}
                keyExtractor={(o) => o.id}
                contentContainerStyle={tw`px-4 py-2 pb-8`}
                renderItem={renderOpenOrder}
              />
            )
          )}

          {/* ── Tab: Pagadas ──────────────────────────────────────────── */}
          {tab === 'closed' && (
            loading ? (
              <View style={tw`items-center py-12`}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : closedOrders.length === 0 ? (
              <View style={tw`items-center py-12 px-5`}>
                <Feather name="check-circle" size={40} color={colors.gray200} />
                <Text style={[tw`mt-3 font-semibold`, { color: colors.gray400 }]}>Sin comandas pagadas hoy</Text>
              </View>
            ) : (
              <FlatList
                data={closedOrders}
                keyExtractor={(o) => o.id}
                contentContainerStyle={tw`px-4 py-2 pb-8`}
                renderItem={renderClosedOrder}
              />
            )
          )}

          {/* ── Tab: Guardar / Actualizar ─────────────────────────────── */}
          {tab === 'save' && (
            <ScrollView contentContainerStyle={tw`px-5 py-3 pb-10`} keyboardShouldPersistTaps="handled">
              {items.length === 0 ? (
                <View style={tw`items-center py-10`}>
                  <Feather name="shopping-cart" size={40} color={colors.gray200} />
                  <Text style={[tw`mt-3`, { color: colors.gray400 }]}>El carrito está vacío</Text>
                </View>
              ) : (
                <>
                  {/* Preview items */}
                  {items.map((i) => (
                    <View key={i.product.id} style={[tw`flex-row items-center py-2`, { borderBottomWidth: 1, borderBottomColor: colors.gray100 }]}>
                      <Text style={tw`flex-1 text-sm text-gray-700`} numberOfLines={1}>{i.product.name}</Text>
                      <Text style={[tw`text-sm font-semibold mr-3`, { color: colors.gray500 }]}>×{i.quantity}</Text>
                      <Text style={[tw`text-sm font-bold`, { color: colors.gray800 }]}>{clp(i.subtotal)}</Text>
                    </View>
                  ))}
                  <View style={[tw`flex-row justify-between py-2 mb-4`, { borderBottomWidth: 2, borderBottomColor: colors.gray200 }]}>
                    <Text style={tw`font-bold text-gray-700`}>Total</Text>
                    <Text style={[tw`font-bold text-lg`, { color: colors.primary }]}>{clp(total)}</Text>
                  </View>

                  {/* Reference */}
                  <Text style={[tw`text-sm font-semibold mb-1`, { color: colors.gray500 }]}>Referencia (opcional)</Text>
                  <TextInput
                    value={reference}
                    onChangeText={setReference}
                    placeholder="Ej: Mesa 3, Auto, Pedido 5..."
                    style={[tw`border rounded-xl px-4 py-3 text-gray-800 mb-3`, { borderWidth: 1, borderColor: colors.gray200 }]}
                  />

                  {/* Notes */}
                  <Text style={[tw`text-sm font-semibold mb-1`, { color: colors.gray500 }]}>Notas (opcional)</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Sin cebolla, extra salsa..."
                    multiline
                    numberOfLines={2}
                    style={[tw`border rounded-xl px-4 py-3 text-gray-800 mb-4`, { borderWidth: 1, borderColor: colors.gray200, textAlignVertical: 'top' }]}
                  />

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={[tw`py-4 rounded-xl items-center flex-row justify-center gap-2`, { backgroundColor: saving ? colors.gray200 : colors.primary }]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name={activeOrder ? 'refresh-cw' : 'clipboard'} size={16} color="#fff" />
                        <Text style={tw`text-white font-bold`}>
                          {activeOrder ? `Actualizar comanda #${activeOrder.order_number}` : `Guardar comanda (${items.length} ítem${items.length !== 1 ? 's' : ''})`}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  )
}
