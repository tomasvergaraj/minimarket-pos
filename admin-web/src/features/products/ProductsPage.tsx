import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Power, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import ProductFormModal from './ProductFormModal'
import type { Product } from '../../types'
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchCategories } from '../../lib/services'
import { formatCLP } from '../../lib/format'
import toast from 'react-hot-toast'

const filterInputClass =
  'h-7.5 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary transition-colors duration-(--duration-fast) hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchProducts({ search: search || undefined, category: categoryFilter || undefined })
      setProducts(result.data)
    } catch {
      setError('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  // Load categories independently so the dropdown doesn't collapse when a filter is active
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs text-text-muted">{r.sku}</span>, sortable: true },
    { key: 'name', header: 'Nombre', render: (r) => <span className="font-medium text-text-primary">{r.name}</span>, sortable: true },
    { key: 'category', header: 'Categoría', render: (r) => r.category || '—' },
    {
      key: 'sell_price',
      header: 'Precio',
      render: (r) => <span className="tabular-nums">{formatCLP(r.sell_price)}</span>,
      sortable: true,
      className: 'text-right',
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (r) => (
        <span className={`tabular-nums ${r.stock <= r.min_stock ? 'text-danger font-semibold' : ''}`}>
          {r.stock}
        </span>
      ),
      sortable: true,
      className: 'text-right',
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (r) => (
        <Badge variant={r.is_active ? 'success' : 'default'}>
          {r.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingProduct(r)
              setFormOpen(true)
            }}
            className="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
          >
            Editar
          </button>
          {r.is_active && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeactivateTarget(r)
              }}
              className="text-text-muted hover:text-danger transition-colors"
              title="Desactivar"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const handleSave = async (data: Record<string, unknown>) => {
    setFormLoading(true)
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data)
        toast.success('Producto actualizado')
      } else {
        await createProduct(data as never)
        toast.success('Producto creado')
      }
      setFormOpen(false)
      setEditingProduct(null)
      loadProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      await deleteProduct(deactivateTarget.id)
      toast.success('Producto desactivado')
      setDeactivateTarget(null)
      loadProducts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desactivar')
    }
  }

  if (loading && products.length === 0) {
    return (
      <div>
        <PageHeader title="Productos" />
        <TableSkeleton rows={8} cols={6} />
      </div>
    )
  }

  if (error && products.length === 0) {
    return (
      <div>
        <PageHeader title="Productos" />
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-text-secondary">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadProducts} className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        description={`${products.length} productos registrados`}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null)
              setFormOpen(true)
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${filterInputClass} w-full pl-8`}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={filterInputClass}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}

        </select>
      </div>

      <DataTable
        columns={columns}
        data={products}
        keyField="id"
        emptyTitle="No hay productos"
        emptyDescription="Crea tu primer producto para empezar"
      />

      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingProduct(null)
        }}
        onSave={handleSave}
        product={editingProduct}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Desactivar producto"
        message={`¿Estás seguro de desactivar "${deactivateTarget?.name}"? No aparecerá en el POS.`}
        confirmLabel="Desactivar"
      />
    </div>
  )
}
