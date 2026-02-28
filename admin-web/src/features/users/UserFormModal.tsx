import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import type { User } from '../../types'

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  user?: User | null
  loading?: boolean
}

const roleOptions = [
  { value: 'cashier', label: 'Cajero' },
  { value: 'admin', label: 'Administrador' },
]

export default function UserFormModal({ open, onClose, onSave, user, loading }: UserFormModalProps) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    pin: '',
    role: 'cashier',
    is_active: true,
  })

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        full_name: user.full_name,
        pin: '',
        role: user.role,
        is_active: user.is_active,
      })
    } else {
      setForm({ username: '', full_name: '', pin: '', role: 'cashier', is_active: true })
    }
  }, [user, open])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
      alert('El PIN debe ser de 4 a 6 dígitos numéricos')
      return
    }
    const data: Record<string, unknown> = {
      username: form.username,
      full_name: form.full_name,
      role: form.role,
      is_active: form.is_active,
    }
    if (form.pin) data.pin = form.pin
    onSave(data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre de usuario"
          value={form.username}
          onChange={set('username')}
          required
        />
        <Input
          label="Nombre completo"
          value={form.full_name}
          onChange={set('full_name')}
          required
        />
        <Input
          label={isEdit ? 'Nuevo PIN (dejar vacío para mantener)' : 'PIN'}
          type="password"
          inputMode="numeric"
          value={form.pin}
          onChange={set('pin')}
          maxLength={6}
          required={!isEdit}
          helper="4-6 dígitos numéricos únicos"
        />
        <Select
          label="Rol"
          options={roleOptions}
          value={form.role}
          onChange={set('role')}
        />
        {isEdit && (
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-border"
            />
            <span className="text-text-secondary">Usuario activo</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
