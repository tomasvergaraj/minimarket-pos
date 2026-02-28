import clsx from 'clsx'

interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx('animate-pulse bg-gray-100 rounded', className)}
      aria-hidden="true"
    />
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface-card rounded-lg border border-border p-4 space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 rounded-sm" />
        ))}
      </div>
      <div className="border-t border-border" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-7 flex-1 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  )
}
