import { useState, useEffect, useCallback } from 'react'
import { Search, Ban, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import DateRangePicker from '../../components/patterns/DateRangePicker'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import SaleDetailModal from './SaleDetailModal'
import type { Sale } from '../../types'
import { fetchSales, voidSale } from '../../lib/services'
import { formatCLP, formatDateTime } from '../../lib/format'
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from '../../lib/constants'
import toast from 'react-hot-toast'

const filterInputClass =
  'h-7.5 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary transition-colors duration-(--duration-fast) hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)

  const loadSales = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchSales({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter || undefined,
      })
      setSales(result.data)
    } catch {
      setError('Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, statusFilter])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  const filtered = search ? sales.filter((s) => String(s.sale_number).includes(search)) : sales

  const columns: Column<Sale>[] = [
    {
      key: 'sale_number',
      header: 'N°',
      render: (r) => <span className="font-medium text-text-primary tabular-nums">#{r.sale_number}</span>,
      sortable: true,
    },
    {
      key: 'created_at',
      header: 'Fecha',
      render: (r) => <span className="tabular-nums">{formatDateTime(r.created_at)}</span>,
      sortable: true,
    },
    {
      key: 'payment_method',
      header: 'Pago',
      render: (r) => PAYMENT_METHOD_LABELS[r.payment_method],
    },
    {
      key: 'total',
      header: 'Total',
      render: (r) => <span className="font-medium tabular-nums">{formatCLP(r.total)}</span>,
      sortable: true,
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'Estado',
      render: (r) => (
        <Badge variant={r.status === 'completed' ? 'success' : 'danger'}>
          {SALE_STATUS_LABELS[r.status]}
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
              setSelectedSale(r)
            }}
            className="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
          >
            Ver
          </button>
          {r.status === 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setVoidTarget(r)
              }}
              className="text-text-muted hover:text-danger transition-colors"
              title="Anular"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const handleVoid = async () => {
    if (!voidTarget) return
    try {
      await voidSale(voidTarget.id)
      setSales((prev) =>
        prev.map((s) =>
          s.id === voidTarget.id ? { ...s, status: 'voided' as const } : s
        )
      )
      toast.success(`Venta #${voidTarget.sale_number} anulada`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular venta')
    } finally {
      setVoidTarget(null)
    }
  }

  if (loading && sales.length === 0) {
    return (
      <div>
        <PageHeader title="Ventas" />
        <TableSkeleton rows={8} cols={6} />
      </div>
    )
  }

  if (error && sales.length === 0) {
    return (
      <div>
        <PageHeader title="Ventas" />
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-text-secondary">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadSales} className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        description={`${filtered.length} ventas encontradas`}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="N° venta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${filterInputClass} pl-8 w-32`}
          />
        </div>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={filterInputClass}
        >
          <option value="">Todos los estados</option>
          <option value="completed">Completada</option>
          <option value="voided">Anulada</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        onRowClick={setSelectedSale}
        emptyTitle="No hay ventas"
        emptyDescription="Las ventas aparecerán aquí cuando se registren en el POS"
      />

      <SaleDetailModal
        open={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        sale={selectedSale}
      />

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={handleVoid}
        title="Anular venta"
        message={`¿Estás seguro de anular la venta #${voidTarget?.sale_number}? Esta acción restaurará el stock de los productos.`}
        confirmLabel="Anular venta"
      />
    </div>
  )
}
