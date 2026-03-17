import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Tag, RefreshCw, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import api from '../../lib/api'

interface Category {
  id: string
  name: string
  color: string | null
  created_at: string
}

const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
]

function CategoryFormModal({
  open,
  onClose,
  onSave,
  category,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: { name: string; color: string | null }) => void
  category?: Category | null
  loading?: boolean
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)

  useEffect(() => {
    if (category) {
      setName(category.name)
      setColor(category.color)
    } else {
      setName('')
      setColor(null)
    }
  }, [category, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), color: color || null })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Editar Categoría' : 'Nueva Categoría'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder="Ej: Bebidas, Lácteos, Snacks..."
        />

        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-2">
            Color (opcional)
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(color === c ? null : c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#1e40af' : 'transparent',
                  boxShadow: color === c ? '0 0 0 2px white, 0 0 0 4px ' + c : undefined,
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setColor(null)}
              className={`text-xs px-2 py-1 rounded border transition ${
                !color ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-200 hover:border-gray-400'
              }`}
            >
              Sin color
            </button>
          </div>
        </div>

        {name && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color || '#94a3b8' }}
            />
            <span className="text-[13px] text-text-primary font-medium">{name}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{category ? 'Guardar' : 'Crear'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/categories/')
      setCategories(Array.isArray(res.data) ? res.data : (res.data.data ?? []))
    } catch {
      setError('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: { name: string; color: string | null }) => {
    setFormLoading(true)
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, data)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/categories/', data)
        toast.success('Categoría creada')
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
      await api.delete(`/categories/${deleteTarget.id}`)
      toast.success('Categoría eliminada')
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div>
      <PageHeader
        title="Categorías"
        description={`${categories.length} categorías registradas`}
        actions={
          <Button
            size="sm"
            onClick={() => { setEditing(null); setFormOpen(true) }}
          >
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Button>
        }
      />

      {loading && categories.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text-muted text-sm">
          Cargando categorías...
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

      {!loading && !error && categories.length === 0 && (
        <div className="flex flex-col items-center py-16 text-text-muted">
          <Tag className="w-10 h-10 mb-3" strokeWidth={1.5} />
          <p className="text-sm mb-4">No hay categorías creadas</p>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="w-3.5 h-3.5" /> Crear primera categoría
          </Button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white border border-border rounded-xl p-4 flex items-center gap-3 group hover:shadow-sm transition"
            >
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || '#94a3b8' }}
              />
              <span className="flex-1 font-medium text-[13px] text-text-primary truncate">{cat.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => { setEditing(cat); setFormOpen(true) }}
                  className="p-1 text-text-muted hover:text-primary-600 transition"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="p-1 text-text-muted hover:text-danger transition"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        category={editing}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message={`¿Eliminar "${deleteTarget?.name}"? Los productos en esta categoría quedarán sin categoría asignada.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}
