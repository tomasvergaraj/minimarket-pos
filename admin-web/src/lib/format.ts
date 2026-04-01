const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
})

export function formatCLP(amount: number): string {
  return clpFormatter.format(Math.round(amount))
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CL').format(n)
}

// Backend emits naive UTC datetimes (no timezone suffix).
// Appending 'Z' ensures the browser treats them as UTC, then converts to local time.
export function parseUTC(iso: string): Date {
  if (iso && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + 'Z')
  }
  return new Date(iso)
}

export function formatDate(iso: string): string {
  return parseUTC(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return parseUTC(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  return parseUTC(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
