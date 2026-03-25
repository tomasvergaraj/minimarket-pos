import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import { TableSkeleton } from '../../components/ui/Skeleton'
import type { Expense, ExpenseCreate, ExpenseUpdate, ExpenseSummary } from '../../types'
import {
  fetchExpenses,
  fetchExpenseCategories,
  fetchExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../../lib/services'
import { formatCLP } from '../../lib/format'

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function metricColor(value: number) {
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-700'
}

// ── P&L Summary ──────────────────────────────────────────────────────────────

interface SummaryProps {
  dateFrom: string
  dateTo: string
  onChangeDates: (from: string, to: string) => void
}

function PLSummary({ dateFrom, dateTo, onChangeDates }: SummaryProps) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const data = await fetchExpenseSummary(dateFrom, dateTo)
      setSummary(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const cards = summary
    ? [
        { label: 'Ventas', value: summary.total_sales, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Costo productos (COGS)', value: summary.total_cogs, icon: BarChart2, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Utilidad bruta', value: summary.gross_profit, icon: TrendingUp, color: metricColor(summary.gross_profit), bg: summary.gross_profit >= 0 ? 'bg-green-50' : 'bg-red-50' },
        { label: 'Gastos operacionales', value: summary.total_expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Utilidad neta', value: summary.net_profit, icon: DollarSign, color: metricColor(summary.net_profit), bg: summary.net_profit >= 0 ? 'bg-green-50' : 'bg-red-50' },
      ]
    : []

  return (
    <div className="bg-white border border-border rounded-xl p-4 mb-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-[13px] font-semibold text-text-primary flex-1">Estado de Resultados</h2>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-text-secondary">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChangeDates(e.target.value, dateTo)}
            className="border border-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <label className="text-[11px] text-text-secondary">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChangeDates(dateFrom, e.target.value)}
            className="border border-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className={`${card.bg} rounded-lg p-3`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} className={card.color} />
                  <span className="text-[10px] text-text-secondary font-medium leading-tight">{card.label}</span>
                </div>
                <p className={`text-[14px] font-bold ${card.color}`}>{formatCLP(card.value)}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[12px] text-text-muted text-center py-2">Selecciona un rango de fechas para ver el resumen</p>
      )}

      {summary && summary.by_category.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Gastos por categoría</p>
          <div className="flex flex-wrap gap-2">
            {summary.by_category.map((cat) => (
              <span key={cat.category} className="inline-flex items-center gap-1.5 bg-gray-50 border border-border rounded-full px-2.5 py-1 text-[11px]">
                <span className="text-text-secondary">{cat.label}</span>
                <span className="font-semibold text-text-primary">{formatCLP(cat.total)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Expense Form Modal ────────────────────────────────────────────────────────

interface FormProps {
  initial?: Expense | null
  categories: { value: string; label: string }[]
  onSave: (data: ExpenseCreate | ExpenseUpdate) => Promise<void>
  onClose: () => void
}

function ExpenseFormModal({ initial, categories, onSave, onClose }: FormProps) {
  const [form, setForm] = useState({
    amount: initial ? String(initial.amount) : '',
    category: initial?.category ?? 'other',
    description: initial?.description ?? '',
    notes: initial?.notes ?? '',
    expense_date: initial?.expense_date ?? today(),
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0 || !form.description.trim()) return
    setSaving(true)
    try {
      await onSave({
        amount,
        category: form.category,
        description: form.description.trim(),
        notes: form.notes.trim() || undefined,
        expense_date: form.expense_date,
      })
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar gasto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[14px] font-semibold">{initial ? 'Editar gasto' : 'Nuevo gasto'}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Monto ($) *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Fecha *</label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Categoría *</label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Descripción *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ej: Pago arriendo mes de marzo"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-purple-100 text-purple-700',
  utilities: 'bg-blue-100 text-blue-700',
  salaries: 'bg-yellow-100 text-yellow-700',
  supplies: 'bg-orange-100 text-orange-700',
  maintenance: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-600',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState(firstOfMonth())
  const [filterDateTo, setFilterDateTo] = useState(today())
  const [filterCategory, setFilterCategory] = useState('')

  // Summary date range (same as filters by default)
  const [summaryFrom, setSummaryFrom] = useState(firstOfMonth())
  const [summaryTo, setSummaryTo] = useState(today())

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchExpenses({
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        category: filterCategory || undefined,
      })
      setExpenses(data)
    } catch {
      toast.error('Error al cargar gastos')
    } finally {
      setLoading(false)
    }
  }, [filterDateFrom, filterDateTo, filterCategory])

  useEffect(() => {
    fetchExpenseCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  const categoryLabel = (cat: string) =>
    categories.find((c) => c.value === cat)?.label ?? cat

  const handleCreate = async (data: ExpenseCreate | ExpenseUpdate) => {
    await createExpense(data as ExpenseCreate)
    toast.success('Gasto registrado')
    loadExpenses()
  }

  const handleUpdate = async (data: ExpenseCreate | ExpenseUpdate) => {
    if (!editingExpense) return
    await updateExpense(editingExpense.id, data as ExpenseUpdate)
    toast.success('Gasto actualizado')
    setEditingExpense(null)
    loadExpenses()
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteExpense(deleteConfirm.id)
      toast.success('Gasto eliminado')
      setDeleteConfirm(null)
      loadExpenses()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const totalFiltered = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Gastos"
        description="Registra y controla los gastos operacionales del local"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1" />
            Nuevo gasto
          </Button>
        }
      />

      <PLSummary
        dateFrom={summaryFrom}
        dateTo={summaryTo}
        onChangeDates={(from, to) => { setSummaryFrom(from); setSummaryTo(to) }}
      />

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Filtros</span>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-text-secondary">Desde</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <label className="text-[11px] text-text-secondary">Hasta</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-border rounded-lg px-2 py-1 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {expenses.length > 0 && (
          <span className="ml-auto text-[12px] font-semibold text-text-primary">
            Total: {formatCLP(totalFiltered)}
            <span className="text-text-muted font-normal ml-1">({expenses.length} registros)</span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-[13px]">
            No hay gastos registrados para el período seleccionado
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-surface-secondary">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Fecha</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Descripción</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Categoría</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Monto</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {expense.expense_date}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{expense.description}</p>
                    {expense.notes && (
                      <p className="text-[11px] text-text-muted mt-0.5">{expense.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS.other}`}>
                      {categoryLabel(expense.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary whitespace-nowrap">
                    {formatCLP(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingExpense(expense)}
                        className="p-1.5 rounded hover:bg-gray-100 text-text-muted hover:text-text-primary transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(expense)}
                        className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <ExpenseFormModal
          categories={categories}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingExpense && (
        <ExpenseFormModal
          initial={editingExpense}
          categories={categories}
          onSave={handleUpdate}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[14px] font-semibold text-text-primary mb-1">Eliminar gasto</h3>
            <p className="text-[13px] text-text-secondary mb-1">
              ¿Eliminar <strong>{deleteConfirm.description}</strong>?
            </p>
            <p className="text-[13px] font-semibold text-red-600 mb-4">{formatCLP(deleteConfirm.amount)}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
