import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-text-muted mb-4">
        {icon || <Inbox className="w-6 h-6" strokeWidth={1.5} />}
      </div>
      <p className="text-[13px] font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="text-xs text-text-muted mt-1 max-w-70">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
