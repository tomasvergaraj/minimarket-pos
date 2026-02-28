import { LogOut, CircleUser } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const { user, logout } = useAuth()

  return (
    <header className="h-12 bg-surface-card border-b border-border flex items-center justify-end px-5 shrink-0 gap-3">
      <div className="flex items-center gap-2.5">
        <CircleUser className="w-4.5 h-4.5 text-text-muted" strokeWidth={1.5} />
        <span className="text-[13px] text-text-secondary font-medium">
          {user?.full_name}
        </span>
        <span className="text-caption bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
          {user?.role}
        </span>
      </div>

      <div className="w-px h-5 bg-border" />

      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-danger rounded-md px-2 py-1 transition-colors duration-(--duration-fast)"
        aria-label="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.5} />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  )
}
