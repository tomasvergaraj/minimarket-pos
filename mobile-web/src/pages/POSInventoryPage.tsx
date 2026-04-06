import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, X, AlertTriangle, Package, ChevronRight } from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchProducts, adjustStock, updateProduct } from '../lib/services'
import { useDebounce } from '../hooks/useDebounce'
import type { Product, KardexCreate } from '../types'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

type StockFilter = 'all' | 'low' | 'out'

interface AdjustModal {
  product: Product
  type: 'restock' | 'adjustment' | 'shrinkage'
  qty: string
  notes: string
  saving: boolean
}

export default function POSInventoryPage() {
  const { user } = usePOSAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [modal, setModal] = useState<AdjustModal | null>(null)
  const [editPriceId, setEditPriceId] = useState<string | null>(null)
  const [editPriceVal, setEditPriceVal] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pos-inventory', debouncedSearch],
    queryFn: () => fetchProducts({ search: debouncedSearch || undefined, active_only: false, limit: 200 }),
    staleTime: 30_000,
  })

  const allProducts = data?.data ?? []

  const products = allProducts.filter((p) => {
    if (stockFilter === 'out') return p.stock <= 0
    if (stockFilter === 'low') return p.stock > 0 && p.stock <= p.min_stock
    return true
  })

  const openAdjust = (product: Product) => {
    setModal({ product, type: 'restock', qty: '', notes: '', saving: false })
  }

  const closeModal = () => setModal(null)

  const handleAdjust = async () => {
    if (!modal) return
    const qty = parseInt(modal.qty)
    if (!qty || qty <= 0) { toast.error('Ingresa una cantidad válida'); return }

    setModal({ ...modal, saving: true })
    try {
      const data: KardexCreate = {
        product_id: modal.product.id,
        movement_type: modal.type,
        quantity: qty,
        notes: modal.notes || null,
      }
      await adjustStock(data)
      toast.success('Stock ajustado correctamente')
      qc.invalidateQueries({ queryKey: ['pos-inventory'] })
      closeModal()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ajustar stock')
      setModal({ ...modal, saving: false })
    }
  }

  const handleSavePrice = async (product: Product) => {
    const price = parseFloat(editPriceVal)
    if (!price || price <= 0) { toast.error('Precio inválido'); return }
    try {
      await updateProduct(product.id, { sell_price: price })
      toast.success('Precio actualizado')
      qc.invalidateQueries({ queryKey: ['pos-inventory'] })
      setEditPriceId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar precio')
    }
  }

  const stockLabel = (p: Product) => {
    if (p.stock <= 0) return { text: 'Sin stock', cls: 'text-red-600 bg-red-50' }
    if (p.stock <= p.min_stock) return { text: `Stock bajo (${p.stock})`, cls: 'text-amber-600 bg-amber-50' }
    return { text: `${p.stock} ${p.unit}`, cls: 'text-green-700 bg-green-50' }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 shrink-0 space-y-3">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Package size={18} className="text-blue-600" />
          Inventario
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stock filter */}
        <div className="flex gap-2">
          {([
            { key: 'all', label: 'Todos' },
            { key: 'low', label: 'Stock bajo' },
            { key: 'out', label: 'Sin stock' },
          ] as { key: StockFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStockFilter(key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                stockFilter === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 self-center">{products.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="text-center text-gray-400 py-10 text-sm">Cargando...</div>
        )}
        {!isLoading && products.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">Sin productos</div>
        )}
        {products.map((p) => {
          const sl = stockLabel(p)
          return (
            <div key={p.id} className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{p.name}</p>
                    {p.is_pack && (
                      <span className="shrink-0 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                        Pack ×{p.units_contained}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs">{p.sku}{p.category ? ` · ${p.category}` : ''}</p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sl.cls}`}>
                      {sl.text}
                    </span>
                    {p.stock <= p.min_stock && p.stock > 0 && (
                      <AlertTriangle size={12} className="text-amber-500" />
                    )}
                  </div>

                  {/* Price row */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {editPriceId === p.id && user?.role === 'admin' ? (
                      <>
                        <input
                          type="number"
                          value={editPriceVal}
                          onChange={(e) => setEditPriceVal(e.target.value)}
                          className="w-28 text-sm bg-gray-50 border border-blue-400 rounded-lg px-2 py-1 outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePrice(p)
                            if (e.key === 'Escape') setEditPriceId(null)
                          }}
                        />
                        <button onClick={() => handleSavePrice(p)} className="text-xs text-blue-600 font-medium">OK</button>
                        <button onClick={() => setEditPriceId(null)} className="text-xs text-gray-400">Cancelar</button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          if (user?.role !== 'admin') return
                          setEditPriceId(p.id)
                          setEditPriceVal(String(p.sell_price))
                        }}
                        className={`text-sm font-semibold text-gray-900 ${user?.role === 'admin' ? 'hover:text-blue-600' : ''}`}
                      >
                        {clp(p.sell_price)}
                      </button>
                    )}
                    {p.is_on_offer && p.discount_price != null && (
                      <span className="text-xs text-green-600 line-through">{clp(p.discount_price)}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openAdjust(p)}
                  className="shrink-0 flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl"
                >
                  Ajustar
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Adjust modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={closeModal}>
          <div
            className="w-full bg-white rounded-t-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 font-semibold">Ajustar stock</p>
                <p className="text-gray-500 text-xs">{modal.product.name}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2">
              {([
                { key: 'restock', label: 'Reposición' },
                { key: 'adjustment', label: 'Ajuste' },
                { key: 'shrinkage', label: 'Merma' },
              ] as { key: KardexCreate['movement_type']; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setModal({ ...modal, type: key })}
                  className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-colors ${
                    modal.type === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {modal.product.is_pack && (
              <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5">
                <Package size={14} className="text-purple-500 mt-0.5 shrink-0" />
                <div className="text-xs text-purple-800 leading-snug">
                  <span className="font-semibold">Pack ×{modal.product.units_contained}:</span>{' '}
                  el ajuste se aplica sobre el producto base.
                  {modal.qty && parseInt(modal.qty) > 0 && (
                    <span className="block mt-0.5 font-medium">
                      {parseInt(modal.qty)} pack{parseInt(modal.qty) !== 1 ? 's' : ''} ={' '}
                      {parseInt(modal.qty) * modal.product.units_contained} unidades base
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Cantidad{modal.product.is_pack ? ' en packs' : ''} ({modal.type === 'shrinkage' ? 'se restará' : 'se sumará'})
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={modal.qty}
                onChange={(e) => setModal({ ...modal, qty: e.target.value })}
                placeholder="0"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={modal.notes}
                onChange={(e) => setModal({ ...modal, notes: e.target.value })}
                placeholder="Motivo del ajuste..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdjust}
                disabled={modal.saving || !modal.qty}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold"
              >
                {modal.saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
