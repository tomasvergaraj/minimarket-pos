import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X, RefreshCw, Settings, Users, Clock, LayoutGrid, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import type { Table, TableCreate, TableUpdate, TableStatus } from '../../types'
import {
  fetchTables,
  fetchTablesStatus,
  createTable,
  updateTable,
  deleteTable,
} from '../../lib/services'
import { formatCLP, parseUTC } from '../../lib/format'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_COLS = 7
const GRID_ROWS = 5

const STATUS_CONFIG = {
  free: { bg: 'bg-green-50 border-green-300', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'Libre' },
  occupied: { bg: 'bg-orange-50 border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'Ocupada' },
  bill_requested: { bg: 'bg-yellow-50 border-yellow-400', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500 animate-pulse', label: 'Cuenta pedida' },
}

// ── Presets ───────────────────────────────────────────────────────────────────

interface PresetTable { name: string; capacity: number; pos_x: number; pos_y: number }

interface Preset {
  id: string
  label: string
  description: string
  tables: PresetTable[]
}

const PRESETS: Preset[] = [
  {
    id: 'salon-pequeno',
    label: 'Salón pequeño',
    description: '4 mesas — 2 columnas × 2 filas',
    tables: [
      { name: 'Mesa 1', capacity: 4, pos_x: 0, pos_y: 0 },
      { name: 'Mesa 2', capacity: 4, pos_x: 1, pos_y: 0 },
      { name: 'Mesa 3', capacity: 4, pos_x: 0, pos_y: 1 },
      { name: 'Mesa 4', capacity: 4, pos_x: 1, pos_y: 1 },
    ],
  },
  {
    id: 'salon-mediano',
    label: 'Salón mediano',
    description: '8 mesas — 4 columnas × 2 filas',
    tables: [
      { name: 'Mesa 1', capacity: 4, pos_x: 0, pos_y: 0 },
      { name: 'Mesa 2', capacity: 4, pos_x: 1, pos_y: 0 },
      { name: 'Mesa 3', capacity: 4, pos_x: 2, pos_y: 0 },
      { name: 'Mesa 4', capacity: 4, pos_x: 3, pos_y: 0 },
      { name: 'Mesa 5', capacity: 4, pos_x: 0, pos_y: 1 },
      { name: 'Mesa 6', capacity: 4, pos_x: 1, pos_y: 1 },
      { name: 'Mesa 7', capacity: 4, pos_x: 2, pos_y: 1 },
      { name: 'Mesa 8', capacity: 4, pos_x: 3, pos_y: 1 },
    ],
  },
  {
    id: 'restaurante',
    label: 'Restaurante',
    description: '10 mesas — 5 columnas × 2 filas',
    tables: [
      { name: 'Mesa 1', capacity: 4, pos_x: 0, pos_y: 0 },
      { name: 'Mesa 2', capacity: 4, pos_x: 1, pos_y: 0 },
      { name: 'Mesa 3', capacity: 4, pos_x: 2, pos_y: 0 },
      { name: 'Mesa 4', capacity: 4, pos_x: 3, pos_y: 0 },
      { name: 'Mesa 5', capacity: 4, pos_x: 4, pos_y: 0 },
      { name: 'Mesa 6', capacity: 4, pos_x: 0, pos_y: 1 },
      { name: 'Mesa 7', capacity: 4, pos_x: 1, pos_y: 1 },
      { name: 'Mesa 8', capacity: 4, pos_x: 2, pos_y: 1 },
      { name: 'Mesa 9', capacity: 4, pos_x: 3, pos_y: 1 },
      { name: 'Mesa 10', capacity: 4, pos_x: 4, pos_y: 1 },
    ],
  },
  {
    id: 'barra-mesas',
    label: 'Barra + mesas',
    description: '4 mesas + 3 asientos de barra',
    tables: [
      { name: 'Mesa 1', capacity: 4, pos_x: 0, pos_y: 0 },
      { name: 'Mesa 2', capacity: 4, pos_x: 1, pos_y: 0 },
      { name: 'Mesa 3', capacity: 4, pos_x: 0, pos_y: 1 },
      { name: 'Mesa 4', capacity: 4, pos_x: 1, pos_y: 1 },
      { name: 'Barra 1', capacity: 2, pos_x: 3, pos_y: 0 },
      { name: 'Barra 2', capacity: 2, pos_x: 4, pos_y: 0 },
      { name: 'Barra 3', capacity: 2, pos_x: 5, pos_y: 0 },
    ],
  },
  {
    id: 'terraza',
    label: 'Terraza',
    description: '6 mesas — 2 columnas × 3 filas',
    tables: [
      { name: 'T1', capacity: 4, pos_x: 0, pos_y: 0 },
      { name: 'T2', capacity: 4, pos_x: 1, pos_y: 0 },
      { name: 'T3', capacity: 4, pos_x: 0, pos_y: 1 },
      { name: 'T4', capacity: 4, pos_x: 1, pos_y: 1 },
      { name: 'T5', capacity: 4, pos_x: 0, pos_y: 2 },
      { name: 'T6', capacity: 4, pos_x: 1, pos_y: 2 },
    ],
  },
  {
    id: 'delivery',
    label: 'Solo delivery',
    description: '3 puntos de entrega en fila',
    tables: [
      { name: 'Ventanilla 1', capacity: 1, pos_x: 0, pos_y: 0 },
      { name: 'Ventanilla 2', capacity: 1, pos_x: 1, pos_y: 0 },
      { name: 'Ventanilla 3', capacity: 1, pos_x: 2, pos_y: 0 },
    ],
  },
]

// ── Preset Mini-map ───────────────────────────────────────────────────────────

function PresetMiniMap({ tables }: { tables: PresetTable[] }) {
  const maxX = Math.max(...tables.map((t) => t.pos_x), 0)
  const maxY = Math.max(...tables.map((t) => t.pos_y), 0)
  const occupied = new Set(tables.map((t) => `${t.pos_x},${t.pos_y}`))

  return (
    <div
      className="grid gap-0.5 mx-auto"
      style={{
        gridTemplateColumns: `repeat(${maxX + 1}, 14px)`,
        gridTemplateRows: `repeat(${maxY + 1}, 14px)`,
      }}
    >
      {Array.from({ length: (maxY + 1) * (maxX + 1) }).map((_, i) => {
        const x = i % (maxX + 1)
        const y = Math.floor(i / (maxX + 1))
        const isOcc = occupied.has(`${x},${y}`)
        return (
          <div
            key={i}
            className={`rounded-sm ${isOcc ? 'bg-indigo-500' : 'bg-gray-100'}`}
          />
        )
      })}
    </div>
  )
}

// ── Preset Modal ──────────────────────────────────────────────────────────────

interface PresetModalProps {
  hasTables: boolean
  onApply: (preset: Preset) => Promise<void>
  onClose: () => void
}

function PresetModal({ hasTables, onApply, onClose }: PresetModalProps) {
  const [selected, setSelected] = useState<Preset | null>(null)
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    if (!selected) return
    setApplying(true)
    try {
      await onApply(selected)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-[14px] font-semibold">Presets de mapa de mesas</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Elige una disposición base y ajústala después</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        {hasTables && (
          <div className="mx-4 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-700">
            ⚠️ Aplicar un preset <strong>agrega</strong> las nuevas mesas a las existentes. Elimina las actuales manualmente si quieres empezar de cero.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelected(preset)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                selected?.id === preset.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-border hover:border-indigo-300 hover:bg-gray-50'
              }`}
            >
              <PresetMiniMap tables={preset.tables} />
              <div>
                <p className="text-[13px] font-semibold text-text-primary">{preset.label}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{preset.description}</p>
              </div>
              {selected?.id === preset.id && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Seleccionado</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleApply} disabled={!selected || applying}>
            <Sparkles size={13} className="mr-1" />
            {applying ? 'Aplicando...' : `Aplicar ${selected ? `"${selected.label}"` : 'preset'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Position Grid Picker ──────────────────────────────────────────────────────

interface GridPickerProps {
  selectedX: number
  selectedY: number
  occupiedCells: Set<string>   // "x,y" strings of OTHER tables
  onChange: (x: number, y: number) => void
}

function GridPicker({ selectedX, selectedY, occupiedCells, onChange }: GridPickerProps) {
  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        Posición en el mapa — haz clic para ubicar la mesa
      </p>
      <div
        className="grid gap-1 w-fit"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 36px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 36px)`,
        }}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
          const x = i % GRID_COLS
          const y = Math.floor(i / GRID_COLS)
          const isSelected = x === selectedX && y === selectedY
          const isOccupied = occupiedCells.has(`${x},${y}`)

          return (
            <button
              key={i}
              type="button"
              title={isOccupied ? 'Ocupado por otra mesa' : `Fila ${y + 1}, Col ${x + 1}`}
              disabled={isOccupied}
              onClick={() => onChange(x, y)}
              className={`w-9 h-9 rounded-md border-2 text-[9px] font-bold transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500 text-white scale-105 shadow-sm'
                  : isOccupied
                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-gray-300 hover:text-indigo-400 cursor-pointer'
              }`}
            >
              {isSelected ? '▣' : isOccupied ? '■' : ''}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-text-muted mt-1.5">
        Posición actual: fila {selectedY + 1}, columna {selectedX + 1}
      </p>
    </div>
  )
}

// ── Table Form Modal ──────────────────────────────────────────────────────────

interface FormProps {
  initial?: Table | null
  allTables: Table[]
  onSave: (data: TableCreate | TableUpdate) => Promise<void>
  onClose: () => void
  onDelete?: () => void
}

function TableFormModal({ initial, allTables, onSave, onClose, onDelete }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(initial?.capacity ?? 4)
  const [posX, setPosX] = useState(initial?.pos_x ?? 0)
  const [posY, setPosY] = useState(initial?.pos_y ?? 0)
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Cells occupied by OTHER tables
  const occupiedCells = new Set(
    allTables
      .filter((t) => t.id !== initial?.id)
      .map((t) => `${t.pos_x},${t.pos_y}`)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        capacity,
        pos_x: posX,
        pos_y: posY,
        ...(initial ? { is_active: isActive } : {}),
      })
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[14px] font-semibold">{initial ? 'Editar mesa' : 'Nueva mesa'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name + capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Nombre *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mesa 1, Barra A..."
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">
                <Users size={10} className="inline mr-1" />
                Capacidad
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                  className="w-9 h-9 rounded-lg border border-border hover:bg-gray-100 font-bold text-lg flex items-center justify-center transition-colors"
                >−</button>
                <span className="flex-1 text-center font-bold text-[18px] text-text-primary">{capacity}</span>
                <button
                  type="button"
                  onClick={() => setCapacity((c) => Math.min(50, c + 1))}
                  className="w-9 h-9 rounded-lg border border-border hover:bg-gray-100 font-bold text-lg flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>
          </div>

          {/* Position grid */}
          <GridPicker
            selectedX={posX}
            selectedY={posY}
            occupiedCells={occupiedCells}
            onChange={(x, y) => { setPosX(x); setPosY(y) }}
          />

          {/* Active toggle (edit only) */}
          {initial && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-[13px] text-text-secondary">Mesa activa</span>
            </label>
          )}

          {/* Delete confirm inline */}
          {confirmDelete ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-[12px] text-red-700 font-semibold mb-2">¿Eliminar esta mesa? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <Button variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                <Button variant="danger" type="button" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Eliminando...' : 'Confirmar eliminación'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              {initial && onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[12px] text-red-500 hover:text-red-700 hover:underline transition-colors"
                >
                  Eliminar mesa
                </button>
              )}
              <div className="flex-1" />
              <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Table Card ────────────────────────────────────────────────────────────────

function timeElapsed(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - parseUTC(dateStr).getTime()) / 1000))
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`
}

function TableCard({ table, onEdit }: { table: TableStatus; onEdit: () => void }) {
  const cfg = STATUS_CONFIG[table.status]

  return (
    <div className={`relative border-2 rounded-xl p-3 transition-colors ${cfg.bg}`} style={{ minHeight: 110 }}>
      <span className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
      <button
        onClick={onEdit}
        className="absolute bottom-2 right-2 p-1 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
        title="Editar"
      >
        <Settings size={11} />
      </button>

      <p className="font-bold text-[14px] text-gray-800 pr-4 leading-tight">{table.name}</p>
      <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 mb-2">
        <Users size={10} />
        <span>{table.capacity} pers.</span>
      </div>
      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.badge}`}>
        {cfg.label}
      </span>

      {table.status !== 'free' && table.opened_at && (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Clock size={9} />
            <span>{timeElapsed(table.opened_at)}</span>
          </div>
          {table.order_total !== null && (
            <p className="text-[11px] font-semibold text-gray-700">{formatCLP(table.order_total)}</p>
          )}
          {table.item_count > 0 && (
            <p className="text-[10px] text-gray-400">{table.item_count} ítem(s)</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const [statuses, setStatuses] = useState<TableStatus[]>([])
  const [allTables, setAllTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setStatuses(await fetchTablesStatus())
    } catch { /* silent */ }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statusData, allData] = await Promise.all([fetchTablesStatus(), fetchTables()])
      setStatuses(statusData)
      setAllTables(allData)
    } catch {
      toast.error('Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const id = setInterval(loadStatus, 15_000)
    return () => clearInterval(id)
  }, [loadStatus])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadStatus()
    setRefreshing(false)
  }

  const handleCreate = async (data: TableCreate | TableUpdate) => {
    await createTable(data as TableCreate)
    toast.success('Mesa creada')
    await loadAll()
  }

  const handleUpdate = async (data: TableCreate | TableUpdate) => {
    if (!editingTable) return
    await updateTable(editingTable.id, data as TableUpdate)
    toast.success('Mesa actualizada')
    setEditingTable(null)
    await loadAll()
  }

  const handleDelete = async () => {
    if (!editingTable) return
    await deleteTable(editingTable.id)
    toast.success('Mesa eliminada')
    setEditingTable(null)
    await loadAll()
  }

  const handleApplyPreset = async (preset: Preset) => {
    let created = 0
    for (const t of preset.tables) {
      await createTable(t)
      created++
    }
    toast.success(`Preset "${preset.label}" aplicado — ${created} mesas agregadas`)
    await loadAll()
  }

  // Grid dimensions
  const maxX = Math.max(...statuses.map((t) => t.pos_x), 2)
  const maxY = Math.max(...statuses.map((t) => t.pos_y), 1)

  const free = statuses.filter((t) => t.status === 'free').length
  const occupied = statuses.filter((t) => t.status === 'occupied').length
  const billReq = statuses.filter((t) => t.status === 'bill_requested').length

  return (
    <div className="p-6">
      <PageHeader
        title="Mesas"
        description="Mapa visual de mesas con estado en tiempo real"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-border hover:bg-gray-50 text-text-muted hover:text-text-primary transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Button variant="ghost" onClick={() => setShowPresets(true)}>
              <Sparkles size={14} className="mr-1" />
              Presets
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1" />
              Nueva mesa
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Libres', count: free, dot: 'bg-green-500' },
          { label: 'Ocupadas', count: occupied, dot: 'bg-orange-500' },
          { label: 'Cuenta pedida', count: billReq, dot: 'bg-yellow-500 animate-pulse' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-[13px] font-semibold text-text-primary">{s.count}</span>
            <span className="text-[11px] text-text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Grid map */}
      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(130px, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : statuses.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <LayoutGrid className="w-10 h-10 mx-auto text-gray-200 mb-3" />
          <p className="text-[14px] font-semibold text-text-primary mb-1">Sin mesas configuradas</p>
          <p className="text-[13px] text-text-muted mb-5">Usa un preset para comenzar rápido, o agrega mesas manualmente</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" onClick={() => setShowPresets(true)}>
              <Sparkles size={14} className="mr-1" />
              Elegir preset
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1" />
              Agregar mesa
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(maxX + 1, 8)}, minmax(130px, 160px))`,
            gridTemplateRows: `repeat(${maxY + 1}, auto)`,
          }}
        >
          {statuses.map((table) => {
            const tableData = allTables.find((t) => t.id === table.id) ?? null
            return (
              <div
                key={table.id}
                style={{ gridColumn: table.pos_x + 1, gridRow: table.pos_y + 1 }}
              >
                <TableCard table={table} onEdit={() => setEditingTable(tableData)} />
              </div>
            )
          })}
        </div>
      )}

      {/* Inactive tables */}
      {allTables.filter((t) => !t.is_active).length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Mesas inactivas</p>
          <div className="flex flex-wrap gap-2">
            {allTables.filter((t) => !t.is_active).map((t) => (
              <button
                key={t.id}
                onClick={() => setEditingTable(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-border rounded-lg text-[12px] text-text-muted hover:text-text-primary transition-colors"
              >
                <Settings size={11} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete all shortcut (only when tables exist and none occupied) */}
      {allTables.length > 0 && occupied === 0 && billReq === 0 && (
        <div className="mt-8 pt-5 border-t border-border flex items-center justify-between">
          <p className="text-[12px] text-text-muted">
            <strong>{allTables.length}</strong> mesa(s) configuradas
          </p>
          <button
            onClick={async () => {
              if (!confirm('¿Eliminar TODAS las mesas? Solo se puede si no hay comandas abiertas.')) return
              for (const t of allTables) {
                try { await deleteTable(t.id) } catch { /* skip occupied */ }
              }
              toast.success('Todas las mesas eliminadas')
              loadAll()
            }}
            className="flex items-center gap-1.5 text-[12px] text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={12} />
            Eliminar todas
          </button>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <TableFormModal
          allTables={allTables}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
      {editingTable && (
        <TableFormModal
          initial={editingTable}
          allTables={allTables}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setEditingTable(null)}
        />
      )}
      {showPresets && (
        <PresetModal
          hasTables={allTables.length > 0}
          onApply={handleApplyPreset}
          onClose={() => setShowPresets(false)}
        />
      )}
    </div>
  )
}
