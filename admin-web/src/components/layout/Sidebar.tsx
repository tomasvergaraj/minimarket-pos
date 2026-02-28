import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Receipt,
  Warehouse,
  Landmark,
  Users,
  FileSpreadsheet,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Store,
} from 'lucide-react'
import clsx from 'clsx'

const iconMap = {
  LayoutDashboard,
  Package,
  Receipt,
  Warehouse,
  Landmark,
  Users,
  FileSpreadsheet,
  Settings,
} as const

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' as const },
  { path: '/products', label: 'Productos', icon: 'Package' as const },
  { path: '/sales', label: 'Ventas', icon: 'Receipt' as const },
  { path: '/inventory', label: 'Inventario', icon: 'Warehouse' as const },
  { path: '/cash', label: 'Cajas', icon: 'Landmark' as const },
  { path: '/users', label: 'Usuarios', icon: 'Users' as const },
  { path: '/reports', label: 'Reportes', icon: 'FileSpreadsheet' as const },
  { path: '/config', label: 'Configuración', icon: 'Settings' as const },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'bg-surface-sidebar h-screen flex flex-col shrink-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-15' : 'w-55'
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/6">
        <div className="w-8 h-8 rounded-md bg-primary-600 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[13px] font-semibold text-white leading-tight tracking-tight truncate">
              MiniMarket
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              Admin
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-px overflow-y-auto" role="navigation">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-all duration-(--duration-fast)',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-white/8 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/4'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-4 rounded-r-full bg-primary-400" />
                  )}
                  <Icon className="w-4.5 h-4.5 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-white/6">
        <button
          onClick={onToggle}
          className={clsx(
            'w-full flex items-center gap-2 rounded-md py-2 text-[12px] text-gray-500 hover:text-gray-300 hover:bg-white/4 transition-colors duration-(--duration-fast)',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
