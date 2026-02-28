import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800',
  secondary:
    'bg-surface-card text-text-secondary border border-border hover:bg-gray-50 active:bg-gray-100 hover:border-border-strong',
  ghost:
    'text-text-secondary hover:bg-gray-100 active:bg-gray-200',
  danger:
    'bg-danger text-white shadow-sm hover:bg-red-700 active:bg-red-800',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-7.5 px-2.5 text-xs gap-1',
  md: 'h-9 px-3.5 text-[13px] gap-1.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-all duration-(--duration-fast)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        'disabled:opacity-40 disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
)

Button.displayName = 'Button'
export default Button
