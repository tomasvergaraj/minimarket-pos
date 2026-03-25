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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import PageHeader from '../../components/patterns/PageHeader'
import StatCard from '../../components/patterns/StatCard'
import { TableSkeleton } from '../../components/ui/Skeleton'
import Skeleton from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'
import type {
  DashboardStats,
  SalesTrendPoint,
  HourlyPoint,
  PaymentMethodPoint,
  TopProduct,
} from '../../types'
import { formatCLP, formatNumber } from '../../lib/format'
import {
  fetchDashboardStats,
  fetchSalesTrend,
  fetchHourlySales,
  fetchPaymentMethods,
  fetchTopProductsAnalytics,
} from '../../lib/services'

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#10b981',
  card: '#3b82f6',
  transfer: '#8b5cf6',
}
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

const DAYS_OPTIONS = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
]

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-lg border border-border p-4">
      <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function DaySelectorTabs({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-1">
      {DAYS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition ${
            value === opt.value
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-border text-text-secondary hover:border-indigo-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function clpFormatter(value: number) {
  return formatCLP(value)
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<SalesTrendPoint[]>([])
  const [hourly, setHourly] = useState<HourlyPoint[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trendDays, setTrendDays] = useState(7)
  const [topDays, setTopDays] = useState(30)

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

  const loadAnalytics = useCallback(async () => {
    try {
      const [trendData, hourlyData, pmData] = await Promise.all([
        fetchSalesTrend(trendDays),
        fetchHourlySales(trendDays),
        fetchPaymentMethods(trendDays),
      ])
      setTrend(trendData)
      setHourly(hourlyData)
      setPaymentMethods(pmData)
    } catch {
      // analytics are optional — fail silently
    }
  }, [trendDays])

  const loadTopProducts = useCallback(async () => {
    try {
      const data = await fetchTopProductsAnalytics(10, topDays)
      setTopProducts(data)
    } catch {
      // fail silently
    }
  }, [topDays])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [loadStats])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  useEffect(() => {
    loadTopProducts()
  }, [loadTopProducts])

  const handleRefresh = () => {
    setLoading(true)
    loadStats()
    loadAnalytics()
    loadTopProducts()
  }

  // ── Format trend dates for display ──
  const trendFormatted = trend.map((p) => ({
    ...p,
    label: new Date(p.date + 'T12:00:00').toLocaleDateString('es-CL', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  // ── Compact hourly: only show 6-23 to reduce noise ──
  const hourlyFiltered = hourly.filter((h) => h.hour >= 6)

  // ── Pie data ──
  const pieData = paymentMethods.filter((p) => p.total > 0)

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
          <Button variant="secondary" size="sm" onClick={handleRefresh} className="mt-4">
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
        description="Resumen operacional"
        actions={
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
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

      {/* Chart controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
          Análisis de ventas
        </span>
        <DaySelectorTabs value={trendDays} onChange={setTrendDays} />
      </div>

      {/* Charts row 1: trend + hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Tendencia de ingresos">
          {trendFormatted.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendFormatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [clpFormatter(Number(v)), 'Ingresos']} labelStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ventas por hora del día">
          {hourlyFiltered.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyFiltered} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [Number(v), 'Transacciones']} labelFormatter={(h) => `${h}:00 hrs`} labelStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2: payment methods pie + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Métodos de pago">
          {pieData.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="total"
                  nameKey="method"
                  cx="40%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [clpFormatter(Number(v)), PAYMENT_LABELS[String(name)] ?? String(name)]}
                  labelStyle={{ fontSize: 11 }}
                />
                <Legend
                  formatter={(value) => PAYMENT_LABELS[value] ?? value}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`Top productos — últimos ${topDays} días`}>
          <div className="flex items-center justify-end mb-2">
            <DaySelectorTabs value={topDays} onChange={setTopDays} />
          </div>
          {topProducts.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-6">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart
                layout="vertical"
                data={topProducts.slice(0, 8)}
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}`} />
                <YAxis
                  type="category"
                  dataKey="product_name"
                  width={90}
                  tick={{ fontSize: 9 }}
                  tickFormatter={(name: string) =>
                    name.length > 14 ? name.slice(0, 13) + '…' : name
                  }
                />
                <Tooltip formatter={(v) => [Number(v), 'Unidades']} labelStyle={{ fontSize: 11 }} />
                <Bar dataKey="quantity_sold" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
