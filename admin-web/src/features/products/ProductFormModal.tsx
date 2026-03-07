import { useState, useEffect, useCallback } from 'react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { Product } from '../../types'
import { fetchProducts } from '../../lib/services'

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  product?: Product | null
  loading?: boolean
}

const unitOptions = [
  { value: 'un', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'lt', label: 'Litro' },
]

const categoryOptions = [
  { value: 'Bebidas', label: 'Bebidas' },
  { value: 'Lácteos', label: 'Lácteos' },
  { value: 'Panadería', label: 'Panadería' },
  { value: 'Snacks', label: 'Snacks' },
  { value: 'Limpieza', label: 'Limpieza' },
  { value: 'Otros', label: 'Otros' },
]

export default function ProductFormModal({
  open,
  onClose,
  onSave,
  product,
  loading,
}: ProductFormModalProps) {
  const isEdit = !!product
  const [form, setForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category: '',
    unit: 'un',
    cost_price: '',
    sell_price: '',
    tax_rate: '19',
    stock: '0',
    min_stock: '0',
    is_pack: false,
    units_contained: '1',
    base_product_id: '',
    base_product_name: '',
    discount_price: '',
    discount_ends_at: '',
  })
  const [baseSearch, setBaseSearch] = useState('')
  const [baseResults, setBaseResults] = useState<Product[]>([])

  useEffect(() => {
    setBaseSearch('')
    setBaseResults([])
    if (product) {
      setForm({
        sku: product.sku,
        barcode: product.barcode || '',
        name: product.name,
        description: product.description || '',
        category: product.category || '',
        unit: product.unit,
        cost_price: String(product.cost_price),
        sell_price: String(product.sell_price),
        tax_rate: String(product.tax_rate),
        stock: String(product.stock),
        min_stock: String(product.min_stock),
        is_pack: product.is_pack,
        units_contained: String(product.units_contained ?? 1),
        base_product_id: product.base_product_id ?? '',
        base_product_name: '',
        discount_price: product.discount_price != null ? String(product.discount_price) : '',
        discount_ends_at: product.discount_ends_at
          ? product.discount_ends_at.slice(0, 16)
          : '',
      })
    } else {
      setForm({
        sku: '',
        barcode: '',
        name: '',
        description: '',
        category: '',
        unit: 'un',
        cost_price: '',
        sell_price: '',
        tax_rate: '19',
        stock: '0',
        min_stock: '0',
        is_pack: false,
        units_contained: '1',
        base_product_id: '',
        base_product_name: '',
        discount_price: '',
        discount_ends_at: '',
      })
    }
  }, [product, open])

  const searchBaseProducts = useCallback(async (q: string) => {
    if (q.length < 2) { setBaseResults([]); return }
    try {
      const result = await fetchProducts({ search: q })
      // Exclude current product and other packs
      setBaseResults(result.data.filter((p) => p.id !== product?.id && !p.is_pack).slice(0, 8))
    } catch {}
  }, [product?.id])

  useEffect(() => {
    const t = setTimeout(() => searchBaseProducts(baseSearch), 300)
    return () => clearTimeout(t)
  }, [baseSearch, searchBaseProducts])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      sku: form.sku,
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      unit: form.unit,
      cost_price: Number(form.cost_price) || 0,
      sell_price: Number(form.sell_price),
      tax_rate: Number(form.tax_rate),
      ...(isEdit ? {} : { stock: form.is_pack ? 0 : Number(form.stock) || 0 }),
      min_stock: Number(form.min_stock) || 0,
      is_pack: form.is_pack,
      units_contained: form.is_pack ? Number(form.units_contained) || 1 : 1,
      base_product_id: form.is_pack && form.base_product_id ? form.base_product_id : null,
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      discount_ends_at: form.discount_ends_at || null,
    }
    onSave(data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU" value={form.sku} onChange={set('sku')} required />
          <Input label="Código de barras" value={form.barcode} onChange={set('barcode')} />
        </div>

        <Input label="Nombre" value={form.name} onChange={set('name')} required />
        <Input label="Descripción" value={form.description} onChange={set('description')} />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoría"
            options={categoryOptions}
            placeholder="Seleccionar"
            value={form.category}
            onChange={set('category')}
          />
          <Select
            label="Unidad"
            options={unitOptions}
            value={form.unit}
            onChange={set('unit')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Precio costo"
            type="number"
            value={form.cost_price}
            onChange={set('cost_price')}
          />
          <Input
            label="Precio venta"
            type="number"
            value={form.sell_price}
            onChange={set('sell_price')}
            required
          />
          <Input
            label="IVA %"
            type="number"
            value={form.tax_rate}
            onChange={set('tax_rate')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isEdit && (
            <Input
              label="Stock inicial"
              type="number"
              value={form.stock}
              onChange={set('stock')}
            />
          )}
          <Input
            label="Stock mínimo"
            type="number"
            value={form.min_stock}
            onChange={set('min_stock')}
          />
        </div>

        {/* Pack / Presentación */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Pack / Presentación</p>
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={form.is_pack}
              onChange={(e) => setForm((f) => ({ ...f, is_pack: e.target.checked, base_product_id: '', base_product_name: '' }))}
              className="w-4 h-4 accent-primary-500"
            />
            <span className="text-[13px] text-text-primary">Este producto es un pack/presentación agrupada</span>
          </label>
          {form.is_pack && (
            <div className="space-y-3 pl-6">
              <Input
                label="Unidades base contenidas"
                type="number"
                value={form.units_contained}
                onChange={set('units_contained')}
                placeholder="Ej: 6 para un six-pack"
              />
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1">
                  Producto base (cuyo stock se descuenta)
                </label>
                {form.base_product_id ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 h-9 px-3 text-[13px] rounded-md border border-border bg-gray-50 flex items-center text-text-primary">
                      {form.base_product_name || form.base_product_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, base_product_id: '', base_product_name: '' }))}
                      className="text-xs text-danger hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={baseSearch}
                      onChange={(e) => setBaseSearch(e.target.value)}
                      placeholder="Buscar producto unidad..."
                      className="w-full h-9 px-3 text-[13px] rounded-md border border-border focus:outline-none focus:border-primary-500"
                    />
                    {baseResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {baseResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({ ...f, base_product_id: p.id, base_product_name: p.name }))
                              setBaseSearch('')
                              setBaseResults([])
                            }}
                            className="w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 border-b border-border last:border-0"
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-text-muted text-xs">{p.sku}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-text-muted mt-1">
                  Al vender este pack se descuentan {form.units_contained || '?'} unidades del stock del producto base.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Oferta */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Oferta / Descuento</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio oferta"
              type="number"
              value={form.discount_price}
              onChange={set('discount_price')}
              placeholder="Dejar vacío si no hay oferta"
            />
            <Input
              label="Válido hasta (opcional)"
              type="datetime-local"
              value={form.discount_ends_at}
              onChange={set('discount_ends_at')}
              disabled={!form.discount_price}
            />
          </div>
          {form.discount_price && (
            <p className="text-xs text-amber-600 mt-1">
              {form.discount_ends_at
                ? `La oferta expira el ${new Date(form.discount_ends_at).toLocaleString('es-CL')}`
                : 'Sin fecha de expiración — la oferta estará activa indefinidamente'}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
