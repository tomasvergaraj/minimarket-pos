import clsx from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
  info: 'bg-primary-50 text-primary-700',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-caption font-semibold leading-none tracking-wide uppercase',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
