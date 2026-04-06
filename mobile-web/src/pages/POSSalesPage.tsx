import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { RefreshCw, ChevronDown, ChevronUp, XCircle, Banknote, CreditCard, ArrowLeftRight, User } from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchSales, voidSale } from '../lib/services'
import type { Sale } from '../types'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto',
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote size={13} />,
  card: <CreditCard size={13} />,
  transfer: <ArrowLeftRight size={13} />,
  mixed: <span className="text-xs font-bold">M</span>,
}

const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-green-100 text-green-700',
  card: 'bg-blue-100 text-blue-700',
  transfer: 'bg-purple-100 text-purple-700',
  mixed: 'bg-orange-100 text-orange-700',
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type StatusFilter = 'all' | 'completed' | 'voided'

export default function POSSalesPage() {
  const { user, cashState } = usePOSAuth()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const today = isoDate(new Date())
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pos-sales', dateFrom, dateTo, statusFilter, cashState?.session.id],
    queryFn: () => fetchSales({
      date_from: dateFrom,
      date_to: dateTo,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(cashState ? { register_id: cashState.register.id } : {}),
      limit: 100,
    }),
    staleTime: 30_000,
  })

  const sales = data?.data ?? []
  const completed = sales.filter((s) => s.status === 'completed')
  const totalCompleted = completed.reduce((sum, s) => sum + s.total, 0)

  const handleVoid = async (sale: Sale) => {
    if (user?.role !== 'admin') { toast.error('Solo administradores pueden anular'); return }
    if (!confirm(`¿Anular venta #${sale.sale_number}?`)) return
    setVoiding(sale.id)
    try {
      await voidSale(sale.id)
      toast.success(`Venta #${sale.sale_number} anulada`)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular')
    } finally {
      setVoiding(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold">Ventas</p>
            <p className="text-gray-500 text-xs">
              {completed.length} completadas · {clp(totalCompleted)}
            </p>
          </div>
          <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-gray-600">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Date range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-0.5">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-0.5">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setDateFrom(today); setDateTo(today) }}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 mb-0"
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2">
          {(['all', 'completed', 'voided'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                statusFilter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'completed' ? 'Completadas' : 'Anuladas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="text-center text-gray-400 py-10 text-sm">Cargando...</div>
        )}
        {!isLoading && sales.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">Sin ventas en este período</div>
        )}
        {sales.map((sale) => (
          <div key={sale.id} className={`border-b border-gray-100 ${sale.status === 'voided' ? 'opacity-50' : ''}`}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
              onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-900 font-medium text-sm">#{sale.sale_number}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${METHOD_COLOR[sale.payment_method] ?? 'bg-gray-100 text-gray-600'}`}>
                    {METHOD_ICON[sale.payment_method]}
                    {METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                  </span>
                  {sale.status === 'voided' && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Anulada</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  {new Date(sale.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}{sale.items.length} ítems
                  {sale.customer_name ? ` · ${sale.customer_name}` : ''}
                </p>
              </div>
              <span className="text-green-600 font-bold text-sm">{clp(sale.total)}</span>
              {expanded === sale.id
                ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                : <ChevronDown size={16} className="text-gray-400 shrink-0" />
              }
            </button>

            {expanded === sale.id && (
              <div className="px-4 pb-3 space-y-1.5 bg-gray-50">
                {/* Items */}
                {sale.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.product_name} <span className="text-gray-400">×{item.quantity}</span>
                    </span>
                    <span className="text-gray-700">{clp(item.subtotal)}</span>
                  </div>
                ))}

                <div className="border-t border-gray-200 pt-2 mt-1 space-y-1">
                  {/* Discount */}
                  {sale.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuento</span>
                      <span>-{clp(sale.discount_amount)}</span>
                    </div>
                  )}
                  {/* Points redeemed */}
                  {sale.points_redeemed > 0 && (
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Puntos canjeados ({sale.points_redeemed} pts)</span>
                      <span>-{clp(sale.points_redeemed)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>IVA</span>
                    <span>{clp(sale.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-sm">
                    <span className="text-gray-900">Total</span>
                    <span className="text-green-600">{clp(sale.total)}</span>
                  </div>

                  {/* Payment breakdown */}
                  <div className="pt-1 space-y-0.5">
                    {sale.cash_amount > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Banknote size={11} /> Efectivo</span>
                        <span>{clp(sale.cash_amount)}</span>
                      </div>
                    )}
                    {sale.card_amount > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><CreditCard size={11} /> Tarjeta</span>
                        <span>{clp(sale.card_amount)}</span>
                      </div>
                    )}
                    {sale.transfer_amount > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><ArrowLeftRight size={11} /> Transferencia</span>
                        <span>{clp(sale.transfer_amount)}</span>
                      </div>
                    )}
                    {sale.change_amount > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Vuelto</span>
                        <span>{clp(sale.change_amount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Customer + points */}
                  {sale.customer_name && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 pt-0.5">
                      <User size={11} />
                      {sale.customer_name}
                      {sale.points_earned > 0 && (
                        <span className="ml-1 text-purple-600">+{sale.points_earned} pts</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Void button */}
                {sale.status === 'completed' && user?.role === 'admin' && (
                  <button
                    onClick={() => handleVoid(sale)}
                    disabled={voiding === sale.id}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-600 text-sm font-medium disabled:opacity-50"
                  >
                    <XCircle size={15} />
                    {voiding === sale.id ? 'Anulando...' : 'Anular venta'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
