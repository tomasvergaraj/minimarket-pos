import { useState } from 'react'
import { Package } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { KardexCreate, Product } from '../../types'

interface MovementModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: KardexCreate) => void
  product: Product
  loading?: boolean
}

const typeOptions = [
  { value: 'restock', label: 'Reposición' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'shrinkage', label: 'Merma' },
]

export default function MovementModal({
  open,
  onClose,
  onSave,
  product,
  loading,
}: MovementModalProps) {
  const [type, setType] = useState('restock')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const isPack = product.is_pack && product.units_contained > 1
  const units = isPack ? product.units_contained : 1
  const qty = parseInt(quantity) || 0
  const baseUnits = qty * units

  const helper = isPack
    ? qty > 0
      ? `${qty} pack${qty !== 1 ? 's' : ''} = ${baseUnits} unidades base (${type === 'shrinkage' ? 'se restarán' : 'se sumarán'})`
      : `1 pack = ${units} unidades base`
    : type === 'shrinkage'
    ? 'Se restará del stock'
    : 'Se sumará al stock'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = Math.abs(parseInt(quantity) || 0)
    if (!q) return
    onSave({
      product_id: product.id,
      movement_type: type as KardexCreate['movement_type'],
      quantity: q,
      notes: notes || null,
    })
    setType('restock')
    setQuantity('')
    setNotes('')
  }

  return (
    <Modal open={open} onClose={onClose} title={`Movimiento — ${product.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isPack && (
          <div className="flex items-start gap-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2.5 text-xs text-purple-800">
            <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-500" />
            <span>
              <strong>Pack ×{units}:</strong> el ajuste se aplica sobre el producto base.
              El stock del pack se recalcula automáticamente.
            </span>
          </div>
        )}
        <Select
          label="Tipo de movimiento"
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input
          label={isPack ? 'Cantidad (en packs)' : 'Cantidad'}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          min={1}
          helper={helper}
        />
        <Input
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo del movimiento..."
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
