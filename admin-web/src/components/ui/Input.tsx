import { forwardRef, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full h-9 px-3 text-[13px] rounded-md border bg-white',
            'transition-colors duration-(--duration-fast)',
            'placeholder:text-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
            error
              ? 'border-danger text-danger'
              : 'border-border text-text-primary hover:border-border-strong',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {helper && !error && (
          <p className="text-xs text-text-muted">{helper}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
