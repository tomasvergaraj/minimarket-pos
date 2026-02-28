import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import type { CashSession } from '../../types'
import { formatCLP, formatDateTime } from '../../lib/format'

interface SessionDetailModalProps {
  open: boolean
  onClose: () => void
  session: CashSession | null
  registerName?: string
}

export default function SessionDetailModal({ open, onClose, session, registerName }: SessionDetailModalProps) {
  if (!session) return null

  return (
    <Modal open={open} onClose={onClose} title="Detalle de Sesión" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <span className="text-text-muted">Caja:</span>{' '}
            <span className="text-text-secondary font-medium">{registerName || session.register_id}</span>
          </div>
          <div>
            <span className="text-text-muted">Estado:</span>{' '}
            <Badge variant={session.status === 'open' ? 'success' : 'default'}>
              {session.status === 'open' ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
          <div>
            <span className="text-text-muted">Apertura:</span>{' '}
            <span className="text-text-secondary">{formatDateTime(session.opened_at)}</span>
          </div>
          <div>
            <span className="text-text-muted">Cierre:</span>{' '}
            <span className="text-text-secondary">
              {session.closed_at ? formatDateTime(session.closed_at) : '—'}
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-text-muted">Monto apertura</span>
            <span className="tabular-nums">{formatCLP(session.opening_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Ventas efectivo</span>
            <span className="tabular-nums">{formatCLP(session.total_cash_sales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Ventas tarjeta</span>
            <span className="tabular-nums">{formatCLP(session.total_card_sales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Total ventas</span>
            <span className="font-medium tabular-nums">{session.total_sales_count}</span>
          </div>

          {session.status === 'closed' && (
            <>
              <div className="border-t border-border pt-2 mt-2" />
              <div className="flex justify-between">
                <span className="text-text-muted">Monto cierre</span>
                <span className="tabular-nums">{formatCLP(session.closing_amount!)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Efectivo esperado</span>
                <span className="tabular-nums">{formatCLP(session.expected_cash!)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-text-secondary">Diferencia</span>
                <span
                  className={`tabular-nums ${
                    session.difference! > 0
                      ? 'text-success'
                      : session.difference! < 0
                        ? 'text-danger'
                        : ''
                  }`}
                >
                  {session.difference! > 0 ? '+' : ''}
                  {formatCLP(session.difference!)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
