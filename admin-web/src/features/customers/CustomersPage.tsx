import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Search, Edit2, Trash2, Gift, ChevronDown, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import type { Customer, CustomerCreate, CustomerUpdate, Sale } from '../../types'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerHistory,
  adjustCustomerPoints,
} from '../../lib/services'
import { formatCLP } from '../../lib/format'

// ── Customer Form Modal ──────────────────────────────────────────────────────

interface FormProps {
  initial?: Customer | null
  onSave: (data: CustomerCreate | CustomerUpdate) => Promise<void>
  onClose: () => void
}

function CustomerFormModal({ initial, onSave, onClose }: FormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    rut: initial?.rut ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        rut: form.rut.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      })
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[14px] font-semibold">{initial ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Nombre *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">RUT</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.rut}
                onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Teléfono</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving} className="flex-1">
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Points Adjust Modal ──────────────────────────────────────────────────────

function PointsModal({ customer, onSave, onClose }: { customer: Customer; onSave: (delta: number) => Promise<void>; onClose: () => void }) {
  const [delta, setDelta] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(delta, 10)
    if (isNaN(n) || n === 0) return
    setSaving(true)
    try {
      await onSave(n)
      onClose()
    } catch {
      toast.error('Error al ajustar puntos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[14px] font-semibold">Ajustar puntos — {customer.name}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-[12px] text-text-secondary">Balance actual: <strong>{customer.points_balance} pts</strong></p>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">
              Delta (positivo = sumar, negativo = restar)
            </label>
            <input
              type="number"
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving} className="flex-1">
              {saving ? 'Guardando…' : 'Aplicar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({ customerId }: { customerId: string }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomerHistory(customerId)
      .then(setSales)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading) return <tr><td colSpan={6} className="px-4 py-3 text-[12px] text-text-muted text-center">Cargando historial…</td></tr>
  if (!sales.length) return <tr><td colSpan={6} className="px-4 py-3 text-[12px] text-text-muted text-center">Sin compras registradas</td></tr>

  return (
    <>
      {sales.map((s) => (
        <tr key={s.id} className="bg-gray-50 border-b border-border">
          <td className="pl-10 py-2 text-[11px] text-text-secondary">#{s.sale_number}</td>
          <td className="px-4 py-2 text-[11px] text-text-secondary">
            {new Date(s.created_at).toLocaleDateString('es-CL')}
          </td>
          <td className="px-4 py-2 text-[11px]">{formatCLP(s.total)}</td>
          <td className="px-4 py-2 text-[11px] capitalize">{s.payment_method}</td>
          <td className="px-4 py-2 text-[11px] text-emerald-600">+{(s as Sale & { points_earned?: number }).points_earned ?? 0} pts</td>
          <td />
        </tr>
      ))}
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formCustomer, setFormCustomer] = useState<Customer | null | false>(false) // false = closed
  const [pointsCustomer, setPointsCustomer] = useState<Customer | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      setCustomers(await fetchCustomers(q))
    } catch {
      toast.error('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search.trim() || undefined)
  }

  const handleSave = async (data: CustomerCreate | CustomerUpdate) => {
    if (formCustomer) {
      await updateCustomer(formCustomer.id, data as CustomerUpdate)
      toast.success('Cliente actualizado')
    } else {
      await createCustomer(data as CustomerCreate)
      toast.success('Cliente creado')
    }
    await load(search.trim() || undefined)
  }

  const handleDelete = async (c: Customer) => {
    try {
      await deleteCustomer(c.id)
      toast.success('Cliente eliminado')
      setDeleteConfirm(null)
      await load(search.trim() || undefined)
    } catch {
      toast.error('Error al eliminar cliente')
    }
  }

  const handleAdjustPoints = async (delta: number) => {
    if (!pointsCustomer) return
    await adjustCustomerPoints(pointsCustomer.id, delta)
    toast.success('Puntos actualizados')
    await load(search.trim() || undefined)
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Registro de clientes y programa de puntos"
        actions={
          <Button variant="primary" size="sm" onClick={() => setFormCustomer(null)}>
            <UserPlus size={14} /> Nuevo cliente
          </Button>
        }
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Nombre, RUT o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">Buscar</Button>
      </form>

      {/* Table */}
      <div className="bg-surface-card rounded-xl border border-border overflow-hidden overflow-x-auto">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-text-secondary text-[11px] uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-6" />
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">RUT / Teléfono</th>
                <th className="text-right px-4 py-3">Puntos</th>
                <th className="text-right px-4 py-3">Compras</th>
                <th className="text-right px-4 py-3 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-text-muted text-[13px]">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <>
                    <tr
                      key={c.id}
                      className="border-b border-border hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <td className="px-4 py-3 text-text-muted">
                        {expandedId === c.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{c.rut ?? '—'}</div>
                        <div className="text-[11px]">{c.phone ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          <Gift size={10} /> {c.points_balance} pts
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium">{formatCLP(c.total_purchases)}</div>
                        <div className="text-[11px] text-text-muted">{c.visit_count} visitas</div>
                      </td>
                      <td className="px-4 py-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
                            title="Ajustar puntos"
                            onClick={() => setPointsCustomer(c)}
                          >
                            <Gift size={13} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                            onClick={() => setFormCustomer(c)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                            onClick={() => setDeleteConfirm(c)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && <HistoryRow key={`history-${c.id}`} customerId={c.id} />}
                  </>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {formCustomer !== false && (
        <CustomerFormModal
          initial={formCustomer}
          onSave={handleSave}
          onClose={() => setFormCustomer(false)}
        />
      )}

      {pointsCustomer && (
        <PointsModal
          customer={pointsCustomer}
          onSave={handleAdjustPoints}
          onClose={() => setPointsCustomer(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5 text-center">
            <p className="text-[14px] font-semibold mb-1">¿Eliminar cliente?</p>
            <p className="text-[12px] text-text-secondary mb-4">{deleteConfirm.name}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancelar</Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(deleteConfirm)} className="flex-1">Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
