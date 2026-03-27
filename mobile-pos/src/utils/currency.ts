/** Formatea un número como pesos chilenos: $1.250 */
export function clp(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CL')}`
}

/** Calcula IVA incluido en el precio (19% default) */
export function calcLineTax(lineTotal: number, taxRate: number): number {
  return Math.round((lineTotal * taxRate / (100 + taxRate)) * 100) / 100
}
