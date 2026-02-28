import { useState, useMemo, type ReactNode } from 'react'
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import EmptyState from '../ui/EmptyState'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
}

export default function DataTable<T>({
  columns,
  data,
  keyField,
  pageSize = 20,
  emptyTitle = 'Sin datos',
  emptyDescription,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      const av = col.render(a)
      const bv = col.render(b)
      const aStr = typeof av === 'string' || typeof av === 'number' ? av : ''
      const bStr = typeof bv === 'string' || typeof bv === 'number' ? bv : ''
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="animate-fade-in">
      <div className="overflow-x-auto bg-surface-card border border-border rounded-lg">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-2.5 text-left text-caption font-semibold text-text-muted uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none group hover:text-text-secondary',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={String(row[keyField])}
                className={clsx(
                  'border-b border-border/50 last:border-b-0',
                  'transition-colors duration-(--duration-fast)',
                  onRowClick
                    ? 'cursor-pointer hover:bg-primary-50/40'
                    : 'hover:bg-gray-50/60',
                  rowClassName?.(row)
                )}
                onClick={() => onRowClick?.(row)}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx('px-4 py-2.5 text-text-secondary', col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
          <span className="tabular-nums">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-(--duration-fast)"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 tabular-nums text-text-secondary font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-(--duration-fast)"
              aria-label="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
