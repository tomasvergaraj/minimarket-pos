import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Clipboard, ShoppingCart, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { listOrders, createOrder, updateOrder, cancelOrder } from '../lib/services'
import type { Order, CartItem } from '../types'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

type Tab = 'open' | 'closed' | 'save'

interface Props {
  registerId: string
  cart: CartItem[]
  activeOrder: Order | null
  onClose: () => void
  onLoadOrder: (order: Order) => void
  onOrderSaved: (order: Order) => void
}

export default function POSOrdersModal({ registerId, cart, activeOrder, onClose, onLoadOrder, onOrderSaved }: Props) {
  const [tab, setTab] = useState<Tab>('open')
  const [openOrders, setOpenOrders] = useState<Order[]>([])
  const [closedOrders, setClosedOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState(activeOrder?.reference ?? '')
  const [notes, setNotes] = useState(activeOrder?.notes ?? '')

  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  useEffect(() => {
    fetchOrders()
    setTab('open')
    setReference(activeOrder?.reference ?? '')
    setNotes(activeOrder?.notes ?? '')
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const [open, closed] = await Promise.all([
        listOrders({ status: 'open', register_id: registerId }),
        listOrders({ status: 'closed', register_id: registerId, limit: 30 }),
      ])
      setOpenOrders(open)
      setClosedOrders(closed)
    } catch {
      toast.error('Error al cargar comandas')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (cart.length === 0) return
    setSaving(true)
    try {
      let saved: Order
      if (activeOrder) {
        saved = await updateOrder(activeOrder.id, {
          items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        })
        toast.success(`Comanda #${saved.order_number} actualizada`)
      } else {
        saved = await createOrder({
          register_id: registerId,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        })
        toast.success(`Comanda #${saved.order_number} guardada`)
      }
      onOrderSaved(saved)
      fetchOrders()
      setTab('open')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar comanda')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = (order: Order) => {
    if (!confirm(`¿Cancelar comanda #${order.order_number}${order.reference ? ` "${order.reference}"` : ''}?`)) return
    cancelOrder(order.id)
      .then(() => {
        toast.success(`Comanda #${order.order_number} cancelada`)
        if (activeOrder?.id === order.id) onOrderSaved({ ...order, status: 'cancelled' })
        fetchOrders()
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al cancelar'))
  }

  const handleLoad = (order: Order) => {
    if (cart.length > 0) {
      if (!confirm(`Esto reemplazará el carrito actual con ${order.items.length} producto(s). ¿Continuar?`)) return
    }
    onLoadOrder(order)
    onClose()
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'open',   label: `Abiertas (${openOrders.length})` },
    { key: 'closed', label: 'Pagadas' },
    { key: 'save',   label: activeOrder ? `Actualizar #${activeOrder.order_number}` : 'Guardar carrito' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <motion.div className="absolute inset-0 bg-black/50" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} />
      <motion.div
        className="relative bg-white rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl"
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Clipboard size={20} className="text-gray-700" />
            <span className="text-gray-900 font-bold text-lg">Comandas</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 text-gray-400 hover:text-gray-600">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 py-3 shrink-0 border-b border-gray-100">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                tab === key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Abiertas ── */}
        {tab === 'open' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading && (
              <div className="text-center text-gray-400 py-10 text-sm">Cargando...</div>
            )}
            {!loading && openOrders.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <Clipboard size={40} className="mx-auto text-gray-200" />
                <p className="text-gray-400 text-sm">Sin comandas abiertas</p>
                <button onClick={() => setTab('save')} className="text-blue-600 text-sm font-medium">
                  Guardar carrito como comanda →
                </button>
              </div>
            )}
            {openOrders.map((order) => {
              const isActive = activeOrder?.id === order.id
              const orderTotal = order.items.reduce((s, i) => s + i.subtotal, 0)
              const time = new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border-2 p-4 ${
                    order.kitchen_ready ? 'border-green-400' : isActive ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      order.kitchen_ready ? 'bg-green-100 text-green-700' : isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                    }`}>
                      #{order.order_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-gray-900 font-semibold text-sm truncate">
                          {order.reference || `Comanda #${order.order_number}`}
                        </p>
                        {order.kitchen_ready && (
                          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            <CheckCircle size={10} /> Listo
                          </span>
                        )}
                        {isActive && !order.kitchen_ready && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Activa</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {order.items.length} ítem{order.items.length !== 1 ? 's' : ''} · {time}
                      </p>
                      {order.notes && (
                        <p className="text-gray-500 text-xs mt-1 italic">{order.notes}</p>
                      )}
                    </div>
                    <p className="text-blue-600 font-bold text-base shrink-0">{clp(orderTotal)}</p>
                  </div>

                  {order.kitchen_ready && (
                    <div className="mt-2 px-3 py-1.5 bg-green-50 rounded-xl flex items-center gap-2">
                      <CheckCircle size={13} className="text-green-600 shrink-0" />
                      <p className="text-green-700 text-xs font-medium">Preparado — listo para entregar o cobrar</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleLoad(order)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-semibold border border-blue-200"
                    >
                      <ShoppingCart size={14} /> Cargar
                    </button>
                    <button
                      onClick={() => handleCancel(order)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold border border-red-200"
                    >
                      <XCircle size={14} /> Cancelar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tab: Pagadas ── */}
        {tab === 'closed' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading && <div className="text-center text-gray-400 py-10 text-sm">Cargando...</div>}
            {!loading && closedOrders.length === 0 && (
              <div className="text-center py-10">
                <CheckCircle size={40} className="mx-auto text-gray-200" />
                <p className="text-gray-400 text-sm mt-3">Sin comandas pagadas hoy</p>
              </div>
            )}
            {closedOrders.map((order) => {
              const orderTotal = order.items.reduce((s, i) => s + i.subtotal, 0)
              const date = new Date(order.created_at)
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                    #{order.order_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 font-semibold text-sm truncate">
                      {order.reference || `Comanda #${order.order_number}`}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {order.items.length} ítems ·{' '}
                      {date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}{' '}
                      {date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-gray-800 font-bold">{clp(orderTotal)}</p>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Pagada</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tab: Guardar / Actualizar ── */}
        {tab === 'save' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-10">
                <ShoppingCart size={40} className="mx-auto text-gray-200" />
                <p className="text-gray-400 text-sm mt-3">El carrito está vacío</p>
              </div>
            ) : (
              <>
                {/* Preview */}
                <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                  {cart.map((i) => (
                    <div key={i.product.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                      <span className="text-gray-800 flex-1 truncate">{i.product.name}</span>
                      <span className="text-gray-400 mx-3">×{i.quantity}</span>
                      <span className="text-gray-800 font-semibold">{clp(i.unit_price * i.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2.5 font-bold text-sm">
                    <span className="text-gray-700">Total</span>
                    <span className="text-blue-600 text-base">{clp(cartTotal)}</span>
                  </div>
                </div>

                {/* Reference */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Mesa 3, Auto, Pedido 5..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Sin cebolla, extra salsa..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold text-base"
                >
                  <Clipboard size={18} />
                  {saving
                    ? 'Guardando...'
                    : activeOrder
                    ? `Actualizar comanda #${activeOrder.order_number}`
                    : `Guardar comanda (${cart.length} ítem${cart.length !== 1 ? 's' : ''})`}
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
