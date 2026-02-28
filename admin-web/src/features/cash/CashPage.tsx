import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import DateRangePicker from '../../components/patterns/DateRangePicker'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { TableSkeleton } from '../../components/ui/Skeleton'
import SessionDetailModal from './SessionDetailModal'
import type { CashRegister, CashSession } from '../../types'
import { fetchRegisters, createRegister, fetchSessions } from '../../lib/services'
import { formatCLP, formatDateTime } from '../../lib/format'
import toast from 'react-hot-toast'

const filterInputClass =
  'h-7.5 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary transition-colors duration-(--duration-fast) hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'

export default function CashPage() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [registerFilter, setRegisterFilter] = useState('')
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [newRegisterOpen, setNewRegisterOpen] = useState(false)
  const [newRegisterName, setNewRegisterName] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [regs, sess] = await Promise.all([
        fetchRegisters(),
        fetchSessions(),
      ])
      setRegisters(regs)
      setSessions(sess.data)
    } catch {
      setError('Error al cargar cajas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredSessions = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false
    if (registerFilter && s.register_id !== registerFilter) return false
    if (dateFrom && s.opened_at < dateFrom) return false
    if (dateTo && s.opened_at > dateTo + 'T23:59:59') return false
    return true
  })

  const getRegisterName = (id: string) => registers.find((r) => r.id === id)?.name || id

  const sessionColumns: Column<CashSession>[] = [
    {
      key: 'register',
      header: 'Caja',
      render: (r) => getRegisterName(r.register_id),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (r) => (
        <Badge variant={r.status === 'open' ? 'success' : 'default'}>
          {r.status === 'open' ? 'Abierta' : 'Cerrada'}
        </Badge>
      ),
    },
    {
      key: 'opened_at',
      header: 'Apertura',
      render: (r) => formatDateTime(r.opened_at),
      sortable: true,
    },
    {
      key: 'closed_at',
      header: 'Cierre',
      render: (r) => (r.closed_at ? formatDateTime(r.closed_at) : '—'),
    },
    {
      key: 'total_sales_count',
      header: 'Ventas',
      render: (r) => <span className="tabular-nums">{r.total_sales_count}</span>,
      className: 'text-right',
    },
    {
      key: 'total',
      header: 'Total Ventas',
      render: (r) => (
        <span className="tabular-nums font-medium">
          {formatCLP(r.total_cash_sales + r.total_card_sales)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'difference',
      header: 'Diferencia',
      render: (r) =>
        r.difference !== null ? (
          <span
            className={`tabular-nums ${
              r.difference > 0
                ? 'text-success'
                : r.difference < 0
                  ? 'text-danger'
                  : 'text-text-muted'
            }`}
          >
            {r.difference > 0 ? '+' : ''}
            {formatCLP(r.difference)}
          </span>
        ) : (
          '—'
        ),
      className: 'text-right',
    },
  ]

  const handleCreateRegister = async () => {
    if (!newRegisterName.trim()) return
    try {
      const reg = await createRegister(newRegisterName.trim())
      setRegisters((prev) => [...prev, reg])
      toast.success(`Caja "${reg.name}" creada`)
      setNewRegisterOpen(false)
      setNewRegisterName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear caja')
    }
  }

  if (loading && sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Cajas" />
        <TableSkeleton rows={6} cols={7} />
      </div>
    )
  }

  if (error && sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Cajas" />
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-text-secondary">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadData} className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Cajas"
        actions={
          <Button size="sm" onClick={() => setNewRegisterOpen(true)}>
            <Plus className="w-4 h-4" /> Nueva caja
          </Button>
        }
      />

      {/* Registers summary */}
      <div className="flex gap-3 mb-6">
        {registers.map((r) => (
          <div
            key={r.id}
            className="bg-surface-card rounded-lg border border-border px-4 py-3 min-w-35"
          >
            <p className="text-[13px] font-medium text-text-secondary">{r.name}</p>
            <Badge variant={r.is_active ? 'success' : 'default'} className="mt-1">
              {r.is_active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
        ))}
      </div>

      {/* Session filters */}
      <h2 className="text-[13px] font-semibold text-text-secondary mb-3">Historial de Sesiones</h2>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
        <select
          value={registerFilter}
          onChange={(e) => setRegisterFilter(e.target.value)}
          className={filterInputClass}
        >
          <option value="">Todas las cajas</option>
          {registers.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={filterInputClass}
        >
          <option value="">Todos los estados</option>
          <option value="open">Abierta</option>
          <option value="closed">Cerrada</option>
        </select>
      </div>

      <DataTable
        columns={sessionColumns}
        data={filteredSessions}
        keyField="id"
        onRowClick={setSelectedSession}
        emptyTitle="No hay sesiones"
        emptyDescription="Las sesiones aparecerán cuando se abran cajas en el POS"
      />

      <SessionDetailModal
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        registerName={selectedSession ? getRegisterName(selectedSession.register_id) : ''}
      />

      <Modal
        open={newRegisterOpen}
        onClose={() => setNewRegisterOpen(false)}
        title="Nueva Caja Registradora"
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateRegister()
          }}
          className="space-y-4"
        >
          <Input
            label="Nombre de la caja"
            value={newRegisterName}
            onChange={(e) => setNewRegisterName(e.target.value)}
            placeholder="Ej: Caja 3"
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setNewRegisterOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
