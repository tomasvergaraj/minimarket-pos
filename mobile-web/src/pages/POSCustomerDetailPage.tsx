import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, User, Phone, Mail, Star, ShoppingBag, Plus, Minus } from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchCustomer, fetchCustomerHistory, adjustCustomerPoints } from '../lib/services'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto',
}

export default function POSCustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = usePOSAuth()
  const qc = useQueryClient()

  const [adjusting, setAdjusting] = useState(false)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustDir, setAdjustDir] = useState<'+' | '-'>('+')
  const [saving, setSaving] = useState(false)

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['pos-customer', id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['pos-customer-history', id],
    queryFn: () => fetchCustomerHistory(id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  const handleAdjustPoints = async () => {
    const delta = parseInt(adjustDelta)
    if (!delta || delta <= 0) { toast.error('Ingresa una cantidad válida'); return }
    const finalDelta = adjustDir === '-' ? -delta : delta
    setSaving(true)
    try {
      await adjustCustomerPoints(id!, finalDelta)
      toast.success(`Puntos ${adjustDir === '+' ? 'sumados' : 'restados'}: ${delta}`)
      qc.invalidateQueries({ queryKey: ['pos-customer', id] })
      setAdjusting(false)
      setAdjustDelta('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ajustar puntos')
    } finally {
      setSaving(false)
    }
  }

  if (loadingCustomer) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <p className="text-gray-900 font-semibold">Cliente</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Cargando...
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <p className="text-gray-900 font-semibold">Cliente</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Cliente no encontrado
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <p className="text-gray-900 font-semibold flex-1">Detalle de cliente</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Customer card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <User size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-semibold text-base">{customer.name}</p>
              {customer.rut && <p className="text-gray-400 text-xs">{customer.rut}</p>}
            </div>
          </div>

          {(customer.phone || customer.email) && (
            <div className="space-y-1">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  {customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail size={14} className="text-gray-400 shrink-0" />
                  {customer.email}
                </div>
              )}
            </div>
          )}

          {customer.notes && (
            <p className="text-xs text-gray-500 italic">{customer.notes}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-gray-400 text-xs">Visitas</p>
            <p className="text-gray-900 font-bold text-lg">{customer.visit_count}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-gray-400 text-xs">Compras</p>
            <p className="text-gray-900 font-bold text-lg">{clp(customer.total_purchases)}</p>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-3 text-center">
            <p className="text-purple-500 text-xs">Puntos</p>
            <p className="text-purple-700 font-bold text-lg">{customer.points_balance}</p>
          </div>
        </div>

        {/* Points adjustment (admin only) */}
        {user?.role === 'admin' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setAdjusting(!adjusting)}
              className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50"
            >
              <Star size={15} className="text-purple-500" />
              <span className="text-sm font-medium flex-1 text-left">Ajustar puntos manualmente</span>
              <span className="text-gray-400 text-xs">{adjusting ? '▲' : '▼'}</span>
            </button>
            {adjusting && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdjustDir('+')}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      adjustDir === '+' ? 'bg-green-600 text-white border-green-600' : 'text-gray-600 border-gray-200'
                    }`}
                  >
                    <Plus size={14} /> Sumar
                  </button>
                  <button
                    onClick={() => setAdjustDir('-')}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      adjustDir === '-' ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-200'
                    }`}
                  >
                    <Minus size={14} /> Restar
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="Cantidad de puntos"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAdjustPoints}
                  disabled={saving || !adjustDelta}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
                >
                  {saving ? 'Guardando...' : 'Confirmar ajuste'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sales history */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <ShoppingBag size={15} className="text-blue-500" />
            <p className="text-gray-900 font-medium text-sm">Historial de compras</p>
          </div>
          {loadingHistory && (
            <div className="text-center text-gray-400 py-6 text-sm">Cargando...</div>
          )}
          {!loadingHistory && history.length === 0 && (
            <div className="text-center text-gray-400 py-6 text-sm">Sin compras registradas</div>
          )}
          {history.map((sale) => (
            <div key={sale.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium">#{sale.sale_number}</p>
                <p className="text-xs text-gray-400">
                  {new Date(sale.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' · '}{METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                  {' · '}{sale.items.length} ítems
                </p>
                {sale.points_earned > 0 && (
                  <p className="text-xs text-purple-600">+{sale.points_earned} puntos</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">{clp(sale.total)}</p>
                {sale.status === 'voided' && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Anulada</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
