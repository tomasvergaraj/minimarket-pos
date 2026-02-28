import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { KardexCreate } from '../../types'

interface MovementModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: KardexCreate) => void
  productId: string
  productName: string
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
  productId,
  productName,
  loading,
}: MovementModalProps) {
  const [type, setType] = useState('restock')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number(quantity)
    if (!qty) return
    onSave({
      product_id: productId,
      movement_type: type as KardexCreate['movement_type'],
      quantity: type === 'restock' ? Math.abs(qty) : -Math.abs(qty),
      notes: notes || null,
    })
    setType('restock')
    setQuantity('')
    setNotes('')
  }

  return (
    <Modal open={open} onClose={onClose} title={`Movimiento — ${productName}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo de movimiento"
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Input
          label="Cantidad"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          min={1}
          helper={type === 'restock' ? 'Se sumará al stock' : 'Se restará del stock'}
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
