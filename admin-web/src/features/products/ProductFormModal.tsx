import { useState, useEffect, useRef, useCallback } from 'react'
import { ImageOff, Trash2, Upload } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { Product } from '../../types'
import { fetchProducts } from '../../lib/services'
import api, { getServerUrl } from '../../lib/api'

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>, imageFile?: File | null) => void
  product?: Product | null
  loading?: boolean
}

const unitOptions = [
  { value: 'un', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'lt', label: 'Litro' },
]

/** Normalize a text segment: remove accents, keep only alphanum, uppercase */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Build a SKU from category + product name + a stable 4-digit suffix.
 * Format: CAT-NAMEPART-NNNN
 * - CAT: first 3 chars of the first word of the category (or "GEN" if empty)
 * - NAMEPART: first 3 chars of each word in the name, max 2 words (6 chars total)
 * - NNNN: caller-supplied suffix (kept stable across name/category edits)
 * Example: "Bebidas y Jugos" + "Coca Cola" + "0042" → "BEB-COCCOL-0042"
 */
function buildSku(name: string, category: string, suffix: string): string {
  const catWords = normalize(category).split(/\s+/).filter(Boolean)
  const catPart = catWords.length > 0 ? catWords[0].slice(0, 3) : 'GEN'

  const nameWords = normalize(name).split(/\s+/).filter(Boolean)
  const namePart = nameWords.slice(0, 2).map((w) => w.slice(0, 3)).join('')

  return namePart ? `${catPart}-${namePart}-${suffix}` : `${catPart}-${suffix}`
}

function newSuffix(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

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
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false)
  // Stable 4-digit suffix for this form session — avoids regenerating on every keystroke
  const skuSuffixRef = useRef(newSuffix())
  const [baseSearch, setBaseSearch] = useState('')
  const [baseResults, setBaseResults] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Load categories from backend
  useEffect(() => {
    api.get('/categories/')
      .then((res) => {
        const raw: { name: string }[] = Array.isArray(res.data) ? res.data : (res.data.data ?? [])
        setCategories(raw.map((c) => c.name))
      })
      .catch(() => {
        // fallback: load from products if categories endpoint is not ready
        fetchProducts().then((result) => {
          const cats = [...new Set(result.data.map((p) => p.category).filter(Boolean))] as string[]
          setCategories(cats)
        }).catch(() => {})
      })
  }, [open])

  useEffect(() => {
    setBaseSearch('')
    setBaseResults([])
    setSkuManuallyEdited(false)
    setImageFile(null)
    setImagePreview(null)
    if (!product) skuSuffixRef.current = newSuffix()  // fresh suffix for each new product
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

  // Auto-generate SKU when name or category changes (new product only, not manually edited)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setForm((f) => ({
      ...f,
      name: newName,
      sku: !isEdit && !skuManuallyEdited ? buildSku(newName, f.category, skuSuffixRef.current) : f.sku,
    }))
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value
    setForm((f) => ({
      ...f,
      category: newCat,
      sku: !isEdit && !skuManuallyEdited && f.name ? buildSku(f.name, newCat, skuSuffixRef.current) : f.sku,
    }))
  }

  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSkuManuallyEdited(true)
    setForm((f) => ({ ...f, sku: e.target.value }))
  }

  const searchBaseProducts = useCallback(async (q: string) => {
    if (q.length < 2) { setBaseResults([]); return }
    try {
      const result = await fetchProducts({ search: q })
      setBaseResults(result.data.filter((p) => p.id !== product?.id && !p.is_pack).slice(0, 8))
    } catch {}
  }, [product?.id])

  useEffect(() => {
    const t = setTimeout(() => searchBaseProducts(baseSearch), 300)
    return () => clearTimeout(t)
  }, [baseSearch, searchBaseProducts])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setImagePreview(url)
    } else {
      setImagePreview(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const taxRate = Number(form.tax_rate)
    const data = {
      sku: form.sku,
      barcode: form.barcode || null,
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      unit: form.unit,
      cost_price: Number(form.cost_price) || 0,
      sell_price: Number(form.sell_price),
      tax_rate: taxRate,
      ...(isEdit ? {} : { stock: form.is_pack ? 0 : Number(form.stock) || 0 }),
      min_stock: Number(form.min_stock) || 0,
      is_pack: form.is_pack,
      units_contained: form.is_pack ? Number(form.units_contained) || 1 : 1,
      base_product_id: form.is_pack && form.base_product_id ? form.base_product_id : null,
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      discount_ends_at: form.discount_ends_at || null,
    }
    onSave(data, imageFile)
  }

  const categoryOptions = [
    ...categories.map((c) => ({ value: c, label: c })),
  ]

  const taxRateNum = Number(form.tax_rate)
  const taxRateWarning = form.tax_rate !== '' && taxRateNum >= 0 && taxRateNum < 1
    ? '⚠ Parece un decimal (ej: 0.19). Para IVA estándar chileno ingresa 19'
    : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="SKU"
              value={form.sku}
              onChange={handleSkuChange}
              required
              placeholder="Auto-generado desde el nombre"
            />
            {!isEdit && !skuManuallyEdited && form.name && (
              <p className="text-xs text-text-muted mt-0.5">
                Auto-generado — puedes editarlo libremente
              </p>
            )}
          </div>
          <Input label="Código de barras" value={form.barcode} onChange={set('barcode')} />
        </div>

        <Input
          label="Nombre"
          value={form.name}
          onChange={handleNameChange}
          required
        />
        <Input label="Descripción" value={form.description} onChange={set('description')} />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoría"
            options={categoryOptions}
            placeholder="Seleccionar"
            value={form.category}
            onChange={handleCategoryChange}
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
          <div>
            <Input
              label="IVA % (19 = estándar)"
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.tax_rate}
              onChange={set('tax_rate')}
              placeholder="19"
            />
            {taxRateWarning && (
              <p className="text-xs text-amber-600 mt-0.5">{taxRateWarning}</p>
            )}
          </div>
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
                : 'Sin fecha de expiración — la oferta aplicará SIEMPRE. Configura una fecha si es temporal.'}
            </p>
          )}
        </div>

        {/* Imagen del producto */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Imagen del producto</p>
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="w-20 h-20 rounded-xl border border-border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : product?.image_url ? (
                <img
                  src={`${getServerUrl()}${product.image_url}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <ImageOff className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                {imageFile ? 'Cambiar imagen' : product?.image_url ? 'Reemplazar imagen' : 'Subir imagen'}
              </Button>
              {imageFile && (
                <p className="text-xs text-text-muted truncate max-w-50">{imageFile.name}</p>
              )}
              {!imageFile && product?.image_url && (
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                    // Signal deletion via a sentinel File object name
                    const emptyFile = new File([], '__delete__')
                    setImageFile(emptyFile)
                  }}
                  className="flex items-center gap-1 text-xs text-danger hover:underline"
                >
                  <Trash2 className="w-3 h-3" /> Eliminar imagen
                </button>
              )}
              <p className="text-xs text-text-muted">JPEG, PNG, WebP o GIF. Se muestra en la tabla de productos y en el POS.</p>
            </div>
          </div>
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
