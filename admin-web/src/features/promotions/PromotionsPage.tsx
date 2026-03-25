import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Tag, RefreshCw, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import api from '../../lib/api'

// ── Types ──

type PromoType = 'percentage_discount' | 'fixed_discount' | 'buy_n_get_m' | 'min_quantity'

interface Promotion {
  id: string
  name: string
  promo_type: PromoType
  product_id: string | null
  category_name: string | null
  discount_pct: number | null
  discount_amount: number | null
  buy_qty: number | null
  get_qty: number | null
  min_qty: number | null
  special_price: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
}

// ── Labels ──

const TYPE_LABELS: Record<PromoType, string> = {
  percentage_discount: '% Descuento',
  fixed_discount: '$ Descuento fijo',
  buy_n_get_m: 'Lleva N paga M',
  min_quantity: 'Precio por cantidad',
}

const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as PromoType[]).map((v) => ({
  value: v,
  label: TYPE_LABELS[v],
}))

function promoSummary(p: Promotion): string {
  if (p.promo_type === 'percentage_discount') return `${p.discount_pct ?? 0}% de descuento`
  if (p.promo_type === 'fixed_discount') return `$${(p.discount_amount ?? 0).toLocaleString('es-CL')} de descuento`
  if (p.promo_type === 'buy_n_get_m') return `Lleva ${p.buy_qty ?? 0} paga ${(p.buy_qty ?? 0) - (p.get_qty ?? 0)}`
  if (p.promo_type === 'min_quantity') return `Desde ${p.min_qty ?? 0} unidades → $${(p.special_price ?? 0).toLocaleString('es-CL')}/u`
  return '—'
}

function promoScope(p: Promotion): string {
  if (p.product_id) return 'Producto específico'
  if (p.category_name) return `Cat: ${p.category_name}`
  return 'Todos los productos'
}

function isCurrentlyActive(p: Promotion): boolean {
  if (!p.is_active) return false
  const now = new Date()
  if (p.starts_at && new Date(p.starts_at) > now) return false
  if (p.ends_at && new Date(p.ends_at) < now) return false
  return true
}

// ── Form ──

type FormData = {
  name: string
  promo_type: PromoType
  scope: 'all' | 'category' | 'product'
  category_name: string
  product_id: string
  discount_pct: string
  discount_amount: string
  buy_qty: string
  get_qty: string
  min_qty: string
  special_price: string
  starts_at: string
  ends_at: string
}

function emptyForm(): FormData {
  return {
    name: '',
    promo_type: 'percentage_discount',
    scope: 'all',
    category_name: '',
    product_id: '',
    discount_pct: '',
    discount_amount: '',
    buy_qty: '3',
    get_qty: '1',
    min_qty: '6',
    special_price: '',
    starts_at: '',
    ends_at: '',
  }
}

function formFromPromo(p: Promotion): FormData {
  return {
    name: p.name,
    promo_type: p.promo_type,
    scope: p.product_id ? 'product' : p.category_name ? 'category' : 'all',
    category_name: p.category_name ?? '',
    product_id: p.product_id ?? '',
    discount_pct: p.discount_pct != null ? String(p.discount_pct) : '',
    discount_amount: p.discount_amount != null ? String(p.discount_amount) : '',
    buy_qty: p.buy_qty != null ? String(p.buy_qty) : '3',
    get_qty: p.get_qty != null ? String(p.get_qty) : '1',
    min_qty: p.min_qty != null ? String(p.min_qty) : '6',
    special_price: p.special_price != null ? String(p.special_price) : '',
    starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '',
    ends_at: p.ends_at ? p.ends_at.slice(0, 16) : '',
  }
}

function PromotionFormModal({
  open, onClose, onSave, promotion, loading, categories, products,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Promotion, 'id' | 'created_at'>) => void
  promotion?: Promotion | null
  loading?: boolean
  categories: Category[]
  products: Product[]
}) {
  const [form, setForm] = useState<FormData>(emptyForm)

  useEffect(() => {
    setForm(promotion ? formFromPromo(promotion) : emptyForm())
  }, [promotion, open])

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      promo_type: form.promo_type,
      product_id: form.scope === 'product' ? form.product_id || null : null,
      category_name: form.scope === 'category' ? form.category_name || null : null,
      discount_pct: form.promo_type === 'percentage_discount' ? parseFloat(form.discount_pct) || null : null,
      discount_amount: form.promo_type === 'fixed_discount' ? parseFloat(form.discount_amount) || null : null,
      buy_qty: form.promo_type === 'buy_n_get_m' ? parseInt(form.buy_qty) || null : null,
      get_qty: form.promo_type === 'buy_n_get_m' ? parseInt(form.get_qty) || null : null,
      min_qty: form.promo_type === 'min_quantity' ? parseInt(form.min_qty) || null : null,
      special_price: form.promo_type === 'min_quantity' ? parseFloat(form.special_price) || null : null,
      is_active: true,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={promotion ? 'Editar Promoción' : 'Nueva Promoción'} size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Nombre *" value={form.name} onChange={set('name')} required autoFocus placeholder="Ej: Descuento Viernes" />

        <Select
          label="Tipo de promoción *"
          value={form.promo_type}
          onChange={set('promo_type')}
          options={TYPE_OPTIONS}
        />

        {/* Scope */}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Aplica a</label>
          <div className="flex gap-2">
            {(['all', 'category', 'product'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, scope: s }))}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  form.scope === s
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-text-secondary border-border hover:border-border-strong'
                }`}
              >
                {s === 'all' ? 'Todos los productos' : s === 'category' ? 'Categoría' : 'Producto específico'}
              </button>
            ))}
          </div>
        </div>

        {form.scope === 'category' && (
          <Select
            label="Categoría"
            value={form.category_name}
            onChange={set('category_name')}
            placeholder="Seleccionar categoría"
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
          />
        )}
        {form.scope === 'product' && (
          <Select
            label="Producto"
            value={form.product_id}
            onChange={set('product_id')}
            placeholder="Seleccionar producto"
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
          />
        )}

        {/* Type-specific params */}
        {form.promo_type === 'percentage_discount' && (
          <Input label="% de descuento *" type="number" min={0.1} max={100} step={0.1}
            value={form.discount_pct} onChange={set('discount_pct')} placeholder="Ej: 20" required />
        )}
        {form.promo_type === 'fixed_discount' && (
          <Input label="Monto a descontar ($) *" type="number" min={1} step={1}
            value={form.discount_amount} onChange={set('discount_amount')} placeholder="Ej: 500" required />
        )}
        {form.promo_type === 'buy_n_get_m' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Compra (N)" type="number" min={2} step={1}
              value={form.buy_qty} onChange={set('buy_qty')} placeholder="3" required />
            <Input label="Unidades gratis (M)" type="number" min={1} step={1}
              value={form.get_qty} onChange={set('get_qty')} placeholder="1" required />
            <div className="col-span-2 text-xs text-text-muted bg-blue-50 rounded-lg p-2">
              {parseInt(form.buy_qty) > 0 && parseInt(form.get_qty) > 0 &&
                `"Lleva ${form.buy_qty} paga ${parseInt(form.buy_qty) - parseInt(form.get_qty)}" — precio efectivo por unidad: ${Math.round(100 * (parseInt(form.buy_qty) - parseInt(form.get_qty)) / parseInt(form.buy_qty))}% del precio normal`}
            </div>
          </div>
        )}
        {form.promo_type === 'min_quantity' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad mínima" type="number" min={2} step={1}
              value={form.min_qty} onChange={set('min_qty')} placeholder="6" required />
            <Input label="Precio especial por unidad ($)" type="number" min={0} step={1}
              value={form.special_price} onChange={set('special_price')} placeholder="Ej: 990" required />
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio (opcional)" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} />
          <Input label="Fin (opcional)" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{promotion ? 'Guardar' : 'Crear'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main page ──

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [promoRes, catRes, prodRes] = await Promise.all([
        api.get('/promotions/'),
        api.get('/categories/'),
        api.get('/products/', { params: { active_only: true, limit: 500 } }),
      ])
      setPromotions(Array.isArray(promoRes.data) ? promoRes.data : (promoRes.data.data ?? []))
      setCategories(Array.isArray(catRes.data) ? catRes.data : (catRes.data.data ?? []))
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.data ?? []))
    } catch {
      setError('Error al cargar promociones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Omit<Promotion, 'id' | 'created_at'>) => {
    setFormLoading(true)
    try {
      if (editing) {
        await api.put(`/promotions/${editing.id}`, data)
        toast.success('Promoción actualizada')
      } else {
        await api.post('/promotions/', data)
        toast.success('Promoción creada')
      }
      setFormOpen(false)
      setEditing(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  const toggleActive = async (p: Promotion) => {
    try {
      await api.put(`/promotions/${p.id}`, { is_active: !p.is_active })
      toast.success(p.is_active ? 'Promoción desactivada' : 'Promoción activada')
      load()
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/promotions/${deleteTarget.id}`)
      toast.success('Promoción eliminada')
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar')
    }
  }

  const active = promotions.filter(isCurrentlyActive)
  const inactive = promotions.filter((p) => !isCurrentlyActive(p))

  return (
    <div>
      <PageHeader
        title="Promociones"
        description={`${active.length} activa${active.length !== 1 ? 's' : ''} · ${inactive.length} inactiva${inactive.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Button>
        }
      />

      {loading && promotions.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text-muted text-sm">
          Cargando promociones...
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center py-16">
          <AlertTriangle className="w-8 h-8 text-danger mb-3" strokeWidth={1.5} />
          <p className="text-sm text-text-secondary mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /> Reintentar</Button>
        </div>
      )}

      {!loading && !error && promotions.length === 0 && (
        <div className="flex flex-col items-center py-16 text-text-muted">
          <Tag className="w-10 h-10 mb-3" strokeWidth={1.5} />
          <p className="text-sm mb-4">No hay promociones configuradas</p>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="w-3.5 h-3.5" /> Crear primera promoción
          </Button>
        </div>
      )}

      {promotions.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-text-secondary text-[12px]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Condición</th>
                <th className="text-left px-4 py-3 font-medium">Aplica a</th>
                <th className="text-left px-4 py-3 font-medium">Vigencia</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promotions.map((p) => {
                const active = isCurrentlyActive(p)
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{TYPE_LABELS[p.promo_type]}</td>
                    <td className="px-4 py-3 text-text-secondary">{promoSummary(p)}</td>
                    <td className="px-4 py-3 text-text-muted text-[12px]">{promoScope(p)}</td>
                    <td className="px-4 py-3 text-[12px] text-text-muted">
                      {p.starts_at || p.ends_at ? (
                        <span>
                          {p.starts_at ? new Date(p.starts_at).toLocaleDateString('es-CL') : '∞'}
                          {' → '}
                          {p.ends_at ? new Date(p.ends_at).toLocaleDateString('es-CL') : '∞'}
                        </span>
                      ) : 'Sin límite'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(p)} title={active ? 'Desactivar' : 'Activar'}>
                        {active
                          ? <ToggleRight className="w-6 h-6 text-green-500 mx-auto" />
                          : <ToggleLeft className="w-6 h-6 text-gray-400 mx-auto" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => { setEditing(p); setFormOpen(true) }}
                          className="p-1.5 text-text-muted hover:text-primary-600 transition rounded"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 text-text-muted hover:text-danger transition rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PromotionFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        promotion={editing}
        loading={formLoading}
        categories={categories}
        products={products}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar promoción"
        message={`¿Eliminar la promoción "${deleteTarget?.name}"?`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
