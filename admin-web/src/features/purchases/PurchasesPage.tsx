import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, ShoppingCart, RefreshCw, AlertTriangle,
  CheckCircle, Clock, PackageCheck, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import {
  fetchPurchases,
  createPurchase,
  confirmPurchase,
  receivePurchase,
  deletePurchase,
  fetchSuppliers,
  fetchProducts,
} from '../../lib/services'
import type {
  PurchaseOrder,
  PurchaseOrderCreate,
  PurchaseOrderItemCreate,
  ReceivePurchaseOrderInput,
  Supplier,
  Product,
} from '../../types'

// ── Helpers ──

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  received: 'Recibida',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status === 'draft' && <Clock className="w-3 h-3" />}
      {status === 'confirmed' && <CheckCircle className="w-3 h-3" />}
      {status === 'received' && <PackageCheck className="w-3 h-3" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function fmtCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

// ── Create modal ──

interface DraftItem {
  product_id: string
  product_name: string
  quantity_ordered: number
  unit_cost: number
}

function CreatePurchaseModal({
  open,
  onClose,
  onCreated,
  suppliers,
  products,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  suppliers: Supplier[]
  products: Product[]
}) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setSupplierId('')
      setNotes('')
      setItems([])
      setProductSearch('')
    }
  }, [open])

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase()
    return (
      p.is_active &&
      !items.find((i) => i.product_id === p.id) &&
      (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q))
    )
  }).slice(0, 8)

  const addProduct = (p: Product) => {
    setItems((prev) => [
      ...prev,
      { product_id: p.id, product_name: p.name, quantity_ordered: 1, unit_cost: p.cost_price || 0 },
    ])
    setProductSearch('')
  }

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const updateItem = (idx: number, field: 'quantity_ordered' | 'unit_cost', value: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))

  const total = items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) { toast.error('Selecciona un proveedor'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setLoading(true)
    try {
      const payload: PurchaseOrderCreate = {
        supplier_id: supplierId,
        notes: notes.trim() || null,
        items: items.map((i): PurchaseOrderItemCreate => ({
          product_id: i.product_id,
          quantity_ordered: i.quantity_ordered,
          unit_cost: i.unit_cost,
        })),
      }
      await createPurchase(payload)
      toast.success('Orden de compra creada')
      onClose()
      onCreated()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al crear orden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Orden de Compra" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Proveedor *"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="Seleccionar proveedor"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Input label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones opcionales" />
        </div>

        {/* Product search */}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
            Agregar productos
          </label>
          <div className="relative">
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código..."
            />
            {productSearch && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-gray-50 transition"
                  >
                    <span className="font-medium text-text-primary">{p.name}</span>
                    <span className="text-text-muted text-caption">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 text-text-secondary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Producto</th>
                  <th className="text-center px-3 py-2 font-medium w-24">Cantidad</th>
                  <th className="text-center px-3 py-2 font-medium w-32">Costo unit.</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={item.product_id}>
                    <td className="px-3 py-2 font-medium text-text-primary">{item.product_name}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity_ordered}
                        onChange={(e) => updateItem(idx, 'quantity_ordered', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center px-2 py-1 border border-border rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.unit_cost}
                        onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full text-center px-2 py-1 border border-border rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      {fmtCLP(item.quantity_ordered * item.unit_cost)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-text-muted hover:text-danger transition rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-border">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold text-text-secondary text-[13px]">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-text-primary text-[14px]">{fmtCLP(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={!supplierId || items.length === 0}>
            Crear Orden
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Receive modal ──

function ReceiveModal({
  open,
  order,
  onClose,
  onReceived,
}: {
  open: boolean
  order: PurchaseOrder | null
  onClose: () => void
  onReceived: () => void
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (order) {
      const init: Record<string, number> = {}
      order.items.forEach((it) => { init[it.id] = it.quantity_ordered })
      setQuantities(init)
    }
  }, [order])

  const handleReceive = async () => {
    if (!order) return
    setLoading(true)
    try {
      const payload: ReceivePurchaseOrderInput = {
        items: order.items.map((it) => ({
          item_id: it.id,
          quantity_received: quantities[it.id] ?? 0,
        })),
      }
      await receivePurchase(order.id, payload)
      toast.success('Orden recibida — stock actualizado')
      onClose()
      onReceived()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al recibir orden')
    } finally {
      setLoading(false)
    }
  }

  if (!order) return null

  return (
    <Modal open={open} onClose={onClose} title={`Recibir OC #${order.order_number}`} size="md">
      <div className="space-y-4">
        <p className="text-[13px] text-text-secondary">
          Confirma las cantidades recibidas. El stock se actualizará automáticamente.
        </p>

        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-text-secondary">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Producto</th>
                <th className="text-center px-3 py-2 font-medium w-28">Pedido</th>
                <th className="text-center px-3 py-2 font-medium w-28">Recibido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-text-primary">{item.product_name}</p>
                    <p className="text-caption text-text-muted">{item.product_sku}</p>
                  </td>
                  <td className="px-3 py-2 text-center text-text-secondary">{item.quantity_ordered}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={item.quantity_ordered}
                      value={quantities[item.id] ?? item.quantity_ordered}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.id]: Math.min(item.quantity_ordered, Math.max(0, parseInt(e.target.value) || 0)),
                        }))
                      }
                      className="w-full text-center px-2 py-1 border border-border rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleReceive} loading={loading}>
            <PackageCheck className="w-3.5 h-3.5" /> Confirmar recepción
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Order row ──

function OrderRow({
  order,
  onConfirm,
  onReceive,
  onDelete,
}: {
  order: PurchaseOrder
  onConfirm: (id: string) => void
  onReceive: (order: PurchaseOrder) => void
  onDelete: (order: PurchaseOrder) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-t border-border hover:bg-gray-50/50 transition">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 text-text-muted hover:text-primary-600 transition">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span className="font-mono text-[13px] font-semibold text-text-primary">#{String(order.order_number).padStart(4, '0')}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-[13px] text-text-primary">{order.supplier_name ?? '—'}</td>
        <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
        <td className="px-4 py-3 text-[13px] text-text-secondary">{order.items.length} ítem{order.items.length !== 1 ? 's' : ''}</td>
        <td className="px-4 py-3 text-[13px] font-semibold text-text-primary text-right">{fmtCLP(order.total)}</td>
        <td className="px-4 py-3 text-[12px] text-text-muted">
          {new Date(order.created_at).toLocaleDateString('es-CL')}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 justify-end">
            {order.status === 'draft' && (
              <>
                <Button size="sm" variant="secondary" onClick={() => onConfirm(order.id)}>Confirmar</Button>
                <button
                  onClick={() => onDelete(order)}
                  className="p-1 text-text-muted hover:text-danger transition"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {order.status === 'confirmed' && (
              <Button size="sm" onClick={() => onReceive(order)}>
                <PackageCheck className="w-3 h-3" /> Recibir
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-gray-50/60">
          <td colSpan={7} className="px-8 py-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left pb-1 font-medium">Producto</th>
                  <th className="text-center pb-1 font-medium w-24">Pedido</th>
                  <th className="text-center pb-1 font-medium w-24">Recibido</th>
                  <th className="text-center pb-1 font-medium w-28">Costo unit.</th>
                  <th className="text-right pb-1 font-medium w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-1.5 text-text-primary font-medium">{it.product_name}</td>
                    <td className="py-1.5 text-center text-text-secondary">{it.quantity_ordered}</td>
                    <td className="py-1.5 text-center text-text-secondary">{it.quantity_received}</td>
                    <td className="py-1.5 text-center text-text-secondary">{fmtCLP(it.unit_cost)}</td>
                    <td className="py-1.5 text-right text-text-primary font-medium">{fmtCLP(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {order.notes && (
              <p className="mt-2 text-[12px] text-text-muted italic">Nota: {order.notes}</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ──

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [ordersData, suppliersData, productsData] = await Promise.all([
        fetchPurchases({ status: filterStatus || undefined }),
        fetchSuppliers(),
        fetchProducts({ active_only: true, limit: 500 }).then((r) => r.data),
      ])
      setOrders(ordersData)
      setSuppliers(suppliersData)
      setProducts(productsData)
    } catch {
      setError('Error al cargar órdenes de compra')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (id: string) => {
    try {
      await confirmPurchase(id)
      toast.success('Orden confirmada')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al confirmar')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePurchase(deleteTarget.id)
      toast.success('Orden eliminada')
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div>
      <PageHeader
        title="Órdenes de Compra"
        description={`${orders.length} orden${orders.length !== 1 ? 'es' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="confirmed">Confirmada</option>
              <option value="received">Recibida</option>
            </select>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Nueva OC
            </Button>
          </div>
        }
      />

      {loading && orders.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text-muted text-sm">
          Cargando órdenes...
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center py-16">
          <AlertTriangle className="w-8 h-8 text-danger mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center py-16 text-text-muted">
          <ShoppingCart className="w-10 h-10 mb-3" strokeWidth={1.5} />
          <p className="text-sm mb-4">No hay órdenes de compra</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Crear primera OC
          </Button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-text-secondary text-[12px]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">N°</th>
                <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Ítems</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onConfirm={handleConfirm}
                  onReceive={(o) => setReceiveOrder(o)}
                  onDelete={(o) => setDeleteTarget(o)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreatePurchaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        suppliers={suppliers}
        products={products}
      />

      <ReceiveModal
        open={!!receiveOrder}
        order={receiveOrder}
        onClose={() => setReceiveOrder(null)}
        onReceived={load}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar orden de compra"
        message={`¿Eliminar la OC #${String(deleteTarget?.order_number ?? '').padStart(4, '0')}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
