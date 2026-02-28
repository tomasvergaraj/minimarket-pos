import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DataTable, { type Column } from '../../components/patterns/DataTable'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import UserFormModal from './UserFormModal'
import type { User } from '../../types'
import { fetchUsers, createUser, updateUser } from '../../lib/services'
import { formatDate } from '../../lib/format'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchUsers()
      setUsers(result)
    } catch {
      setError('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const columns: Column<User>[] = [
    { key: 'username', header: 'Usuario', render: (r) => <span className="font-medium text-text-primary">{r.username}</span>, sortable: true },
    { key: 'full_name', header: 'Nombre', render: (r) => r.full_name, sortable: true },
    {
      key: 'role',
      header: 'Rol',
      render: (r) => (
        <Badge variant={r.role === 'admin' ? 'info' : 'default'}>
          {r.role === 'admin' ? 'Admin' : 'Cajero'}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (r) => (
        <Badge variant={r.is_active ? 'success' : 'default'}>
          {r.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Creado',
      render: (r) => formatDate(r.created_at),
      sortable: true,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditingUser(r)
            setFormOpen(true)
          }}
          className="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
        >
          Editar
        </button>
      ),
    },
  ]

  const handleSave = async (data: Record<string, unknown>) => {
    setFormLoading(true)
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, data)
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)))
        toast.success('Usuario actualizado')
      } else {
        const created = await createUser(data as never)
        setUsers((prev) => [created, ...prev])
        toast.success('Usuario creado')
      }
      setFormOpen(false)
      setEditingUser(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  if (loading && users.length === 0) {
    return (
      <div>
        <PageHeader title="Usuarios" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    )
  }

  if (error && users.length === 0) {
    return (
      <div>
        <PageHeader title="Usuarios" />
        <div className="flex flex-col items-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] text-text-secondary">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadUsers} className="mt-4">
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description={`${users.length} usuarios registrados`}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingUser(null)
              setFormOpen(true)
            }}
          >
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        keyField="id"
        emptyTitle="No hay usuarios"
      />

      <UserFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingUser(null)
        }}
        onSave={handleSave}
        user={editingUser}
        loading={formLoading}
      />
    </div>
  )
}
