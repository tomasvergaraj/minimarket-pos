import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import type { Sale } from '../../types'
import { formatCLP, formatDateTime } from '../../lib/format'
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from '../../lib/constants'

interface SaleDetailModalProps {
  open: boolean
  onClose: () => void
  sale: Sale | null
}

export default function SaleDetailModal({ open, onClose, sale }: SaleDetailModalProps) {
  if (!sale) return null
  const netSubtotal = Math.max(sale.total - sale.tax_amount, 0)

  return (
    <Modal open={open} onClose={onClose} title={`Venta #${sale.sale_number}`} size="lg">
      <div className="space-y-4">
        {/* Header info */}
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <span className="text-text-muted">Fecha:</span>{' '}
            <span className="text-text-secondary">{formatDateTime(sale.created_at)}</span>
          </div>
          <div>
            <span className="text-text-muted">Estado:</span>{' '}
            <Badge variant={sale.status === 'completed' ? 'success' : 'danger'}>
              {SALE_STATUS_LABELS[sale.status]}
            </Badge>
          </div>
          <div>
            <span className="text-text-muted">Método de pago:</span>{' '}
            <span className="text-text-secondary">
              {PAYMENT_METHOD_LABELS[sale.payment_method]}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Total:</span>{' '}
            <span className="text-text-primary font-semibold tabular-nums">{formatCLP(sale.total)}</span>
          </div>
        </div>

        {/* Items */}
        <div>
          <h4 className="text-caption font-semibold text-text-muted uppercase tracking-wider mb-2">
            Detalle de productos
          </h4>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1.5 text-left text-caption text-text-muted font-medium">Producto</th>
                <th className="py-1.5 text-right text-caption text-text-muted font-medium">Cant.</th>
                <th className="py-1.5 text-right text-caption text-text-muted font-medium">P. Unit.</th>
                <th className="py-1.5 text-right text-caption text-text-muted font-medium">Total linea</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border/50 last:border-b-0">
                  <td className="py-2 text-text-secondary">
                    <span className="font-medium text-text-primary">{item.product_name}</span>
                    <span className="text-xs text-text-muted ml-1.5 font-mono">({item.product_sku})</span>
                  </td>
                  <td className="py-2 text-right text-text-secondary tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-right text-text-secondary tabular-nums">
                    {formatCLP(item.unit_price)}
                  </td>
                  <td className="py-2 text-right text-text-primary font-medium tabular-nums">
                    {formatCLP(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-border pt-3 space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span className="text-text-muted">Subtotal</span>
            <span className="tabular-nums">{formatCLP(netSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">IVA</span>
            <span className="tabular-nums">{formatCLP(sale.tax_amount)}</span>
          </div>
          <div className="flex justify-between font-semibold text-text-primary pt-1">
            <span>Total</span>
            <span className="tabular-nums">{formatCLP(sale.total)}</span>
          </div>
          {sale.payment_method === 'cash' && sale.change_amount > 0 && (
            <div className="flex justify-between text-text-muted">
              <span>Vuelto</span>
              <span className="tabular-nums">{formatCLP(sale.change_amount)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
