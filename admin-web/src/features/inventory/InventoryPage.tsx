import { useState, useEffect, useCallback } from 'react'
import { Search, History, ArrowUpDown, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import KardexModal from './KardexModal'
import MovementModal from './MovementModal'
import type { Product, KardexEntry, KardexCreate } from '../../types'
import { fetchProducts, fetchKardex, createMovement } from '../../lib/services'
import { formatNumber } from '../../lib/format'
import toast from 'react-hot-toast'

const filterInputClass =
  'h-7.5 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary transition-colors duration-(--duration-fast) hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [kardexTarget, setKardexTarget] = useState<Product | null>(null)
  const [kardexEntries, setKardexEntries] = useState<KardexEntry[]>([])
  const [kardexLoading, setKardexLoading] = useState(false)
  const [movementTarget, setMovementTarget] = useState<Product | null>(null)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchProducts({ active_only: true })
      setProducts(result.data)
    } catch {
      setError('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!kardexTarget) {
      setKardexEntries([])
      return
    }
    setKardexLoading(true)
    fetchKardex(kardexTarget.id)
      .then(setKardexEntries)
      .catch(() => setKardexEntries([]))
      .finally(() => setKardexLoading(false))
  }, [kardexTarget])

  const filtered = search
    ? products.filter((p) => {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      })
    : products

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU', render: (r) => <span className="font-mono text-xs text-text-muted">{r.sku}</span>, sortable: true },
    { key: 'name', header: 'Producto', render: (r) => <span className="font-medium text-text-primary">{r.name}</span>, sortable: true },
    { key: 'category', header: 'Categoría', render: (r) => r.category || '—' },
    {
      key: 'stock',
      header: 'Stock',
      render: (r) => (
        <span className={`tabular-nums ${r.stock <= r.min_stock ? 'text-danger font-semibold' : 'font-medium'}`}>
          {formatNumber(r.stock)}
        </span>
      ),
      sortable: true,
      className: 'text-right',
    },
    {
      key: 'min_stock',
      header: 'Mínimo',
      render: (r) => <span className="tabular-nums">{formatNumber(r.min_stock)}</span>,
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (r) => {
        if (r.stock === 0) return <Badge variant="danger">Sin stock</Badge>
        if (r.stock <= r.min_stock) return <Badge variant="warning">Bajo</Badge>
        return <Badge variant="success">OK</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setKardexTarget(r)
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Ver kardex"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMovementTarget(r)
            }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Registrar movimiento"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  const handleMovement = async (data: KardexCreate) => {
    try {
      await createMovement(data)
      setProducts((prev) =>
        prev.map((p) =>
          p.id === data.product_id
            ? { ...p, stock: p.stock + data.quantity }
            : p
        )
      )
      toast.success('Movimiento registrado')
      setMovementTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar movimiento')
    }
  }

  if (loading && products.length === 0) {
    return (
      <div>
        <PageHeader title="Inventario" />
        <TableSkeleton rows={8} cols={6} />
      </div>
    )
  }

  if (error && products.length === 0) {
    return (
      <div>
        <PageHeader title="Inventario" />
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
        title="Inventario"
        description={`${products.filter((p) => p.stock <= p.min_stock).length} productos bajo stock mínimo`}
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${filterInputClass} w-full pl-8`}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        rowClassName={(r) => (r.stock <= r.min_stock ? 'bg-warning-light/40' : '')}
        emptyTitle="No hay productos en inventario"
      />

      <KardexModal
        open={!!kardexTarget}
        onClose={() => setKardexTarget(null)}
        productName={kardexTarget?.name || ''}
        entries={kardexLoading ? [] : kardexEntries}
      />

      {movementTarget && (
        <MovementModal
          open={!!movementTarget}
          onClose={() => setMovementTarget(null)}
          onSave={handleMovement}
          productId={movementTarget.id}
          productName={movementTarget.name}
        />
      )}
    </div>
  )
}
