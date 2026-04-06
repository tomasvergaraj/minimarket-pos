import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import type { KardexEntry } from '../../types'
import { formatDateTime } from '../../lib/format'
import { MOVEMENT_TYPE_LABELS } from '../../lib/constants'

interface KardexModalProps {
  open: boolean
  onClose: () => void
  productName: string
  entries: KardexEntry[]
}

const movementVariant: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  restock: 'success',
  sale: 'info',
  adjustment: 'warning',
  shrinkage: 'danger',
}

export default function KardexModal({ open, onClose, productName, entries }: KardexModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Kardex — ${productName}`} size="lg">
      {entries.length === 0 ? (
        <p className="text-[13px] text-text-muted text-center py-8">Sin movimientos registrados</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1.5 pr-4 text-left text-caption text-text-muted font-medium">Fecha</th>
              <th className="py-1.5 pr-4 text-left text-caption text-text-muted font-medium">Tipo</th>
              <th className="py-1.5 pr-4 text-right text-caption text-text-muted font-medium">Cant.</th>
              <th className="py-1.5 pr-4 text-right text-caption text-text-muted font-medium">Antes</th>
              <th className="py-1.5 pr-4 text-right text-caption text-text-muted font-medium">Después</th>
              <th className="py-1.5 text-left text-caption text-text-muted font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/50 last:border-b-0">
                <td className="py-2 pr-4 text-text-secondary text-xs tabular-nums whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="py-2 pr-4">
                  <Badge variant={movementVariant[e.movement_type] || 'default'}>
                    {MOVEMENT_TYPE_LABELS[e.movement_type]}
                  </Badge>
                </td>
                <td className={`py-2 pr-4 text-right font-semibold tabular-nums ${e.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                  {e.quantity > 0 ? '+' : ''}{e.quantity}
                </td>
                <td className="py-2 pr-4 text-right text-text-muted tabular-nums">{e.stock_before}</td>
                <td className="py-2 pr-4 text-right text-text-primary font-medium tabular-nums">{e.stock_after}</td>
                <td className="py-2 text-text-muted text-xs">
                  {e.notes
                    ? (() => {
                        const m = e.notes.match(/^(\[Pack:[^\]]+\])\s*(.*)$/)
                        if (m) return (
                          <span className="flex flex-col gap-0.5">
                            <span className="inline-block bg-purple-100 text-purple-700 text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit">{m[1]}</span>
                            {m[2] && <span>{m[2]}</span>}
                          </span>
                        )
                        return e.notes
                      })()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
