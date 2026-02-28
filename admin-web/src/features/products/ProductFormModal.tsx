import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { Product } from '../../types'

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
  })

  useEffect(() => {
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
      })
    }
  }, [product, open])

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
      ...(isEdit ? {} : { stock: Number(form.stock) || 0 }),
      min_stock: Number(form.min_stock) || 0,
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
