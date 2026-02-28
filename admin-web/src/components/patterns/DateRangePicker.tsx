import { Calendar } from 'lucide-react'

interface DateRangePickerProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
}

const inputClass =
  'h-7.5 px-2 text-xs rounded-md border border-border bg-white text-text-secondary transition-colors duration-(--duration-fast) hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'

export default function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangePickerProps) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1 border border-border">
      <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" strokeWidth={1.5} />
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className={inputClass}
        aria-label="Fecha desde"
      />
      <span className="text-caption text-text-muted">—</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className={inputClass}
        aria-label="Fecha hasta"
      />
    </div>
  )
}
