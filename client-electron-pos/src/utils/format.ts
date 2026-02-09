export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-CL");
}
