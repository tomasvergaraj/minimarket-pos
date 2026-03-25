import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CircleUser, LogOut, Package, TrendingDown, BarChart3, CheckCheck, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from '../../lib/services'
import type { Notification } from '../../types'

const TYPE_ICON: Record<string, React.ReactNode> = {
  stock_low: <Package className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />,
  cash_diff: <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />,
  slow_mover: <BarChart3 className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />,
  daily_summary: <BarChart3 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />,
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} d`
}

interface TopBarProps {
  onMenuClick?: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const loadCount = useCallback(async () => {
    try {
      const c = await fetchUnreadCount()
      setUnreadCount(c)
    } catch { /* silent */ }
  }, [])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications()
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.is_read).length)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  // Poll unread count every 60 s
  useEffect(() => {
    loadCount()
    const id = setInterval(loadCount, 60_000)
    return () => clearInterval(id)
  }, [loadCount])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (!open) loadNotifications()
    setOpen((o) => !o)
  }

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const handleMarkAll = async () => {
    await markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <header className="h-12 bg-surface-card border-b border-border flex items-center px-3 md:px-5 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-gray-100 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" strokeWidth={1.5} />
      </button>

      <div className="flex-1" />
      {/* Bell */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={handleOpen}
          className="relative p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-gray-100 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="w-4.5 h-4.5" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-text-primary">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-caption text-primary-600 hover:text-primary-800 font-medium transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {loading ? (
                <div className="py-8 text-center text-[12px] text-text-muted">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-text-muted">Sin notificaciones</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors ${
                      n.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    {TYPE_ICON[n.type] ?? <Bell className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug ${n.is_read ? 'text-text-secondary' : 'text-text-primary font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-caption text-text-muted mt-0.5 truncate">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border" />

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
