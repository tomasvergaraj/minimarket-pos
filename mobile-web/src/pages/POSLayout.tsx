import { useState, useEffect } from 'react'
import { NavLink, Navigate, useLocation, useOutlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePOSAuth } from '../context/POSAuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { queueCount } from '../lib/offlineQueue'
import { ShoppingCart, History, Landmark, Settings, Package, WifiOff } from 'lucide-react'

export default function POSLayout() {
  const { user } = usePOSAuth()
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(queueCount)

  // Refresh queue count whenever online status changes or component re-renders
  useEffect(() => {
    setPending(queueCount())
  }, [isOnline])

  const location = useLocation()
  const outlet = useOutlet()
  if (!user) return <Navigate to="/login" replace />

  const tabs = [
    { to: '/', label: 'Venta', icon: ShoppingCart, end: true, show: true },
    { to: '/sales', label: 'Historial', icon: History, end: false, show: true },
    { to: '/inventory', label: 'Inventario', icon: Package, end: false, show: user.role === 'admin' },
    { to: '/cash', label: 'Caja', icon: Landmark, end: false, show: true },
    { to: '/settings', label: 'Ajustes', icon: Settings, end: false, show: true },
  ].filter((t) => t.show)

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-white text-xs py-1.5 px-4 shrink-0">
          <WifiOff size={13} />
          <span>
            Sin conexión
            {pending > 0 ? ` · ${pending} venta${pending !== 1 ? 's' : ''} en cola` : ''}
          </span>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="absolute inset-0 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="flex border-t border-gray-200 bg-white shrink-0">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
