import type { ReactNode } from 'react'
import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'neutral'
}

const iconBgStyles = {
  indigo: 'bg-primary-50 text-primary-600',
  emerald: 'bg-success-light text-success',
  amber: 'bg-warning-light text-warning',
  red: 'bg-danger-light text-danger',
  neutral: 'bg-gray-50 text-text-muted',
}

export default function StatCard({ label, value, icon, color = 'indigo' }: StatCardProps) {
  return (
    <div className="bg-surface-card rounded-lg border border-border p-4 transition-shadow duration-(--duration-fast) hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-medium text-text-muted uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-semibold text-text-primary mt-1.5 tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            iconBgStyles[color]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
