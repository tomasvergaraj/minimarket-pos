import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import type { AuditLog } from '../../types'
import { fetchAuditLogs } from '../../lib/services'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  SALE_VOID: 'Anulación venta',
  PRICE_CHANGE: 'Cambio de precio',
  STOCK_ADJUSTMENT: 'Ajuste de stock',
  PRODUCT_CREATE: 'Producto creado',
  PRODUCT_DELETE: 'Producto eliminado',
  USER_CREATE: 'Usuario creado',
  USER_UPDATE: 'Usuario actualizado',
  USER_DEACTIVATE: 'Usuario desactivado',
  SESSION_OPEN: 'Apertura de caja',
  SESSION_CLOSE: 'Cierre de caja',
  PURCHASE_RECEIVE: 'Recepción de compra',
  EXPENSE_CREATE: 'Gasto registrado',
}

const ACTION_COLORS: Record<string, string> = {
  SALE_VOID: 'bg-red-100 text-red-700',
  PRICE_CHANGE: 'bg-amber-100 text-amber-700',
  STOCK_ADJUSTMENT: 'bg-blue-100 text-blue-700',
  PRODUCT_CREATE: 'bg-emerald-100 text-emerald-700',
  PRODUCT_DELETE: 'bg-red-100 text-red-700',
  USER_CREATE: 'bg-emerald-100 text-emerald-700',
  USER_UPDATE: 'bg-gray-100 text-gray-700',
  USER_DEACTIVATE: 'bg-red-100 text-red-700',
  SESSION_OPEN: 'bg-emerald-100 text-emerald-700',
  SESSION_CLOSE: 'bg-gray-100 text-gray-700',
  PURCHASE_RECEIVE: 'bg-blue-100 text-blue-700',
  EXPENSE_CREATE: 'bg-gray-100 text-gray-700',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

function fmtDatetime(iso: string) {
  const normalized = iso && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso) ? `${iso}Z` : iso
  return new Date(normalized).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function parseDetail(raw: string | null): string {
  if (!raw) return '—'
  try {
    const obj = JSON.parse(raw)
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
  } catch {
    return raw
  }
}

// ── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600'
  const label = ACTION_LABELS[action] ?? action
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(sevenDaysAgo())
  const [toDate, setToDate] = useState(today())
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [offset, setOffset] = useState(0)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        from_date: `${fromDate}T00:00:00`,
        to_date: `${toDate}T23:59:59`,
        limit: PAGE_SIZE,
        offset: off,
      }
      if (filterAction) params.action = filterAction
      if (filterEntity) params.entity_type = filterEntity
      const data = await fetchAuditLogs(params as any)
      setLogs(data)
      setOffset(off)
    } catch {
      // silently fail on filter change
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, filterAction, filterEntity])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        subtitle="Registro de cambios críticos: anulaciones, precios, usuarios"
        icon={<ClipboardList size={20} />}
        actions={
          <Button variant="secondary" size="sm" onClick={() => load(offset)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Desde</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Hasta</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Acción</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Todas</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Entidad</label>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Todas</option>
            {['sale', 'product', 'user', 'cash_session'].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            No hay registros de auditoría para el período seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left">
                  <th className="px-4 py-3 font-medium text-text-secondary">Fecha/Hora</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Usuario</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Acción</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Entidad</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface/50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-muted">
                      {fmtDatetime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {log.username ?? <span className="text-text-muted">sistema</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <span className="font-mono text-xs">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="ml-1 text-text-muted">#{log.entity_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-text-muted" title={parseDetail(log.detail)}>
                      {parseDetail(log.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-text-muted">
              Mostrando {offset + 1}–{offset + logs.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={logs.length < PAGE_SIZE}
                onClick={() => load(offset + PAGE_SIZE)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
