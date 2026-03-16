import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import DateRangePicker from '../../components/patterns/DateRangePicker'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { TableSkeleton } from '../../components/ui/Skeleton'
import SessionDetailModal from './SessionDetailModal'
import type { CashRegister, CashSession } from '../../types'
import {
  fetchRegisters,
  createRegister,
  updateRegister,
  deleteRegister,
  fetchSessions,
} from '../../lib/services'
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
  const [statusTarget, setStatusTarget] = useState<CashRegister | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CashRegister | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [regs, sess] = await Promise.all([
        fetchRegisters({ includeInactive: true }),
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

  const filteredSessions = sessions.filter((session) => {
    if (statusFilter && session.status !== statusFilter) return false
    if (registerFilter && session.register_id !== registerFilter) return false
    if (dateFrom && session.opened_at < dateFrom) return false
    if (dateTo && session.opened_at > dateTo + 'T23:59:59') return false
    return true
  })

  const sortedRegisters = [...registers].sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1
    }
    return a.name.localeCompare(b.name, 'es')
  })

  const activeRegisterCount = registers.filter((register) => register.is_active).length
  const getRegisterName = (id: string) => registers.find((register) => register.id === id)?.name || id

  const sessionColumns: Column<CashSession>[] = [
    {
      key: 'register',
      header: 'Caja',
      render: (row) => getRegisterName(row.register_id),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.status === 'open' ? 'success' : 'default'}>
          {row.status === 'open' ? 'Abierta' : 'Cerrada'}
        </Badge>
      ),
    },
    {
      key: 'opened_at',
      header: 'Apertura',
      render: (row) => formatDateTime(row.opened_at),
      sortable: true,
    },
    {
      key: 'closed_at',
      header: 'Cierre',
      render: (row) => (row.closed_at ? formatDateTime(row.closed_at) : '-'),
    },
    {
      key: 'total_sales_count',
      header: 'Ventas',
      render: (row) => <span className="tabular-nums">{row.total_sales_count}</span>,
      className: 'text-right',
    },
    {
      key: 'total',
      header: 'Total Ventas',
      render: (row) => (
        <span className="tabular-nums font-medium">
          {formatCLP(row.total_cash_sales + row.total_card_sales)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'difference',
      header: 'Diferencia',
      render: (row) =>
        row.difference !== null ? (
          <span
            className={`tabular-nums ${
              row.difference > 0
                ? 'text-success'
                : row.difference < 0
                  ? 'text-danger'
                  : 'text-text-muted'
            }`}
          >
            {row.difference > 0 ? '+' : ''}
            {formatCLP(row.difference)}
          </span>
        ) : (
          '-'
        ),
      className: 'text-right',
    },
  ]

  const handleCreateRegister = async () => {
    if (!newRegisterName.trim()) return
    try {
      const register = await createRegister(newRegisterName.trim())
      setRegisters((prev) => [...prev, register])
      toast.success(`Caja "${register.name}" creada`)
      setNewRegisterOpen(false)
      setNewRegisterName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear caja')
    }
  }

  const handleToggleStatus = async () => {
    if (!statusTarget) return

    setActionLoading(true)
    try {
      const updated = await updateRegister(statusTarget.id, {
        is_active: !statusTarget.is_active,
      })
      setRegisters((prev) =>
        prev.map((register) => (register.id === updated.id ? updated : register))
      )
      toast.success(
        updated.is_active
          ? `Caja "${updated.name}" activada`
          : `Caja "${updated.name}" desactivada`
      )
      setStatusTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar caja')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRegister = async () => {
    if (!deleteTarget) return

    setActionLoading(true)
    try {
      await deleteRegister(deleteTarget.id)
      setRegisters((prev) => prev.filter((register) => register.id !== deleteTarget.id))
      toast.success(`Caja "${deleteTarget.name}" eliminada`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar caja')
    } finally {
      setActionLoading(false)
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
        description={`${activeRegisterCount} activas / ${registers.length} registradas`}
        actions={
          <Button size="sm" onClick={() => setNewRegisterOpen(true)}>
            <Plus className="w-4 h-4" /> Nueva caja
          </Button>
        }
      />

      <div className="grid gap-3 mb-6 md:grid-cols-2 xl:grid-cols-3">
        {sortedRegisters.map((register) => (
          <div
            key={register.id}
            className="bg-surface-card rounded-lg border border-border px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-text-secondary">{register.name}</p>
                <Badge variant={register.is_active ? 'success' : 'default'} className="mt-1">
                  {register.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              <button
                onClick={() => setDeleteTarget(register)}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger-light hover:text-danger"
                title="Eliminar caja"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={register.is_active ? 'secondary' : 'primary'}
                onClick={() => setStatusTarget(register)}
              >
                {register.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-[13px] font-semibold text-text-secondary mb-3">Historial de sesiones</h2>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
        <select
          value={registerFilter}
          onChange={(event) => setRegisterFilter(event.target.value)}
          className={filterInputClass}
        >
          <option value="">Todas las cajas</option>
          {sortedRegisters.map((register) => (
            <option key={register.id} value={register.id}>
              {register.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
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
        emptyDescription="Las sesiones apareceran cuando se abran cajas en el POS"
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
        title="Nueva caja registradora"
        size="sm"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleCreateRegister()
          }}
          className="space-y-4"
        >
          <Input
            label="Nombre de la caja"
            value={newRegisterName}
            onChange={(event) => setNewRegisterName(event.target.value)}
            placeholder="Ej: Caja 3"
            required
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setNewRegisterOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => {
          if (!actionLoading) setStatusTarget(null)
        }}
        onConfirm={handleToggleStatus}
        title={statusTarget?.is_active ? 'Desactivar caja' : 'Activar caja'}
        message={
          statusTarget
            ? statusTarget.is_active
              ? `Estas seguro de desactivar "${statusTarget.name}"? Dejara de aparecer para seleccionar en el POS.`
              : `Quieres activar "${statusTarget.name}"? Volvera a estar disponible para abrir sesiones.`
            : ''
        }
        confirmLabel={statusTarget?.is_active ? 'Desactivar' : 'Activar'}
        loading={actionLoading}
        variant={statusTarget?.is_active ? 'danger' : 'primary'}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!actionLoading) setDeleteTarget(null)
        }}
        onConfirm={handleDeleteRegister}
        title="Eliminar caja"
        message={
          deleteTarget
            ? `Estas seguro de eliminar "${deleteTarget.name}"? Solo se puede borrar si no tiene sesiones, ventas ni comandas asociadas.`
            : ''
        }
        confirmLabel="Eliminar"
        loading={actionLoading}
      />
    </div>
  )
}
