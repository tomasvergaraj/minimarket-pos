import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export default function PageHeader({ title, description, subtitle, icon, actions }: PageHeaderProps) {
  const text = subtitle ?? description

  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-muted">{icon}</span>}
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">{title}</h1>
        </div>
        {text && (
          <p className="text-[13px] text-text-muted mt-0.5">{text}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
