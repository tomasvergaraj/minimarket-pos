import type { TopProduct } from '../../types'
import { formatCLP } from '../../lib/format'

interface TopProductsTableProps {
  products: TopProduct[]
}

export default function TopProductsTable({ products }: TopProductsTableProps) {
  return (
    <div className="bg-surface-card rounded-lg border border-border animate-slide-up">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[13px] font-semibold text-text-primary">Top 5 Productos del Día</h3>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-caption font-semibold text-text-muted uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-2 text-left text-caption font-semibold text-text-muted uppercase tracking-wider">Producto</th>
            <th className="px-4 py-2 text-right text-caption font-semibold text-text-muted uppercase tracking-wider">Vendidos</th>
            <th className="px-4 py-2 text-right text-caption font-semibold text-text-muted uppercase tracking-wider">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.product_id} className="border-b border-border/50 last:border-b-0 hover:bg-gray-50/60 transition-colors duration-(--duration-fast)">
              <td className="px-4 py-2.5 text-text-muted tabular-nums">{i + 1}</td>
              <td className="px-4 py-2.5 text-text-primary font-medium">{p.product_name}</td>
              <td className="px-4 py-2.5 text-right text-text-secondary tabular-nums">{p.quantity_sold}</td>
              <td className="px-4 py-2.5 text-right text-text-secondary tabular-nums font-medium">{formatCLP(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
