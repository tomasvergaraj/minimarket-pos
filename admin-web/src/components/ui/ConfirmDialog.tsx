import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  variant?: 'danger' | 'primary'
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  loading = false,
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3">
        {variant === 'danger' && (
          <div className="w-9 h-9 rounded-lg bg-danger-light flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-danger" />
          </div>
        )}
        <p className="text-[13px] text-text-secondary leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
