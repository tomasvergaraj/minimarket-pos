export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDate(dateStr: string): string {
  // Backend stores UTC datetimes without timezone suffix — append "Z" so JS
  // parses them as UTC and converts to the computer's local timezone.
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  return new Date(normalized).toLocaleString("es-CL");
}
