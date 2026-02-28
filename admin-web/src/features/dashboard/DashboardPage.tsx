import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Monitor,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import StatCard from '../../components/patterns/StatCard'
import TopProductsTable from './TopProductsTable'
import { TableSkeleton } from '../../components/ui/Skeleton'
import Skeleton from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'
import type { DashboardStats } from '../../types'
import { formatCLP, formatNumber } from '../../lib/format'
import { fetchDashboardStats } from '../../lib/services'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchDashboardStats()
      setStats(data)
    } catch {
      setError('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [loadStats])

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-card rounded-lg border border-border p-4">
              <Skeleton className="h-2.5 w-16 mb-3" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={5} cols={4} />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-text-secondary">{error || 'Sin datos'}</p>
          <Button variant="secondary" size="sm" onClick={loadStats} className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen del día"
        actions={
          <Button variant="ghost" size="sm" onClick={loadStats}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Ventas Hoy"
          value={formatNumber(stats.ventas_hoy)}
          icon={<ShoppingCart className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color="indigo"
        />
        <StatCard
          label="Ingresos Hoy"
          value={formatCLP(stats.ingresos_hoy)}
          icon={<DollarSign className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color="emerald"
        />
        <StatCard
          label="Ticket Promedio"
          value={formatCLP(stats.ticket_promedio)}
          icon={<TrendingUp className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color="indigo"
        />
        <StatCard
          label="Cajas Abiertas"
          value={stats.cajas_abiertas}
          icon={<Monitor className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color="neutral"
        />
        <StatCard
          label="Bajo Stock"
          value={stats.productos_bajo_stock}
          icon={<AlertTriangle className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color={stats.productos_bajo_stock > 0 ? 'amber' : 'neutral'}
        />
        <StatCard
          label="Anuladas"
          value={stats.ventas_anuladas}
          icon={<XCircle className="w-4.5 h-4.5" strokeWidth={1.5} />}
          color={stats.ventas_anuladas > 0 ? 'red' : 'neutral'}
        />
      </div>

      {/* Top Products */}
      <TopProductsTable products={stats.top_5_productos} />
    </div>
  )
}
