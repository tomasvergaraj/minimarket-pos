import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Truck, RefreshCw, AlertTriangle, Phone, Mail, MapPin } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../lib/services'
import type { Supplier, SupplierCreate } from '../../types'

function SupplierFormModal({
  open,
  onClose,
  onSave,
  supplier,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: SupplierCreate) => void
  supplier?: Supplier | null
  loading?: boolean
}) {
  const [form, setForm] = useState<SupplierCreate>({
    name: '',
    rut: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        rut: supplier.rut ?? '',
        contact_name: supplier.contact_name ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        notes: supplier.notes ?? '',
      })
    } else {
      setForm({ name: '', rut: '', contact_name: '', phone: '', email: '', address: '', notes: '' })
    }
  }, [supplier, open])

  const set = (field: keyof SupplierCreate) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      rut: form.rut?.trim() || null,
      contact_name: form.contact_name?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      notes: form.notes?.trim() || null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Nombre *" value={form.name} onChange={set('name')} required autoFocus placeholder="Ej: Distribuidora Norte S.A." />
          </div>
          <Input label="RUT" value={form.rut ?? ''} onChange={set('rut')} placeholder="76.123.456-7" />
          <Input label="Contacto" value={form.contact_name ?? ''} onChange={set('contact_name')} placeholder="Nombre del contacto" />
          <Input label="Teléfono" value={form.phone ?? ''} onChange={set('phone')} placeholder="+56 9 1234 5678" />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} placeholder="ventas@proveedor.cl" />
          <div className="col-span-2">
            <Input label="Dirección" value={form.address ?? ''} onChange={set('address')} placeholder="Av. Principal 123, Ciudad" />
          </div>
          <div className="col-span-2">
            <label className="block text-[13px] font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              value={form.notes ?? ''}
              onChange={set('notes')}
              placeholder="Condiciones de pago, tiempo de entrega..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-input text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{supplier ? 'Guardar' : 'Crear'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setSuppliers(await fetchSuppliers())
    } catch {
      setError('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: SupplierCreate) => {
    setFormLoading(true)
    try {
      if (editing) {
        await updateSupplier(editing.id, data)
        toast.success('Proveedor actualizado')
      } else {
        await createSupplier(data)
        toast.success('Proveedor creado')
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSupplier(deleteTarget.id)
      toast.success('Proveedor eliminado')
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description={`${suppliers.length} proveedor${suppliers.length !== 1 ? 'es' : ''} registrado${suppliers.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Button>
        }
      />

      {loading && suppliers.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text-muted text-sm">
          Cargando proveedores...
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

      {!loading && !error && suppliers.length === 0 && (
        <div className="flex flex-col items-center py-16 text-text-muted">
          <Truck className="w-10 h-10 mb-3" strokeWidth={1.5} />
          <p className="text-sm mb-4">No hay proveedores registrados</p>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="w-3.5 h-3.5" /> Agregar primer proveedor
          </Button>
        </div>
      )}

      {suppliers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-border rounded-xl p-4 group hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] text-text-primary truncate">{s.name}</p>
                  {s.rut && <p className="text-[12px] text-text-muted mt-0.5">RUT: {s.rut}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={() => { setEditing(s); setFormOpen(true) }}
                    className="p-1.5 text-text-muted hover:text-primary-600 transition rounded"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="p-1.5 text-text-muted hover:text-danger transition rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {s.contact_name && (
                  <p className="text-[12px] text-text-secondary truncate">{s.contact_name}</p>
                )}
                {s.phone && (
                  <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        supplier={editing}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar proveedor"
        message={`¿Eliminar "${deleteTarget?.name}"? Si tiene órdenes de compra asociadas, quedará desactivado.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
