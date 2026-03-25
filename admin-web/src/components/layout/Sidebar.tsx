import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tag,
  Receipt,
  Warehouse,
  Landmark,
  Users,
  FileSpreadsheet,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Truck,
  ShoppingCart,
  Percent,
  UserCheck,
  TrendingDown,
  LayoutGrid,
  CloudUpload,
  ClipboardList,
} from 'lucide-react'
import clsx from 'clsx'
import nexoIconUrl from '../../assets/nexo-icon.svg'

const iconMap = {
  LayoutDashboard,
  Package,
  Tag,
  Receipt,
  Warehouse,
  Landmark,
  Users,
  FileSpreadsheet,
  Settings,
  Truck,
  ShoppingCart,
  Percent,
  UserCheck,
  TrendingDown,
  LayoutGrid,
  CloudUpload,
  ClipboardList,
} as const

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' as const },
  { path: '/products', label: 'Productos', icon: 'Package' as const },
  { path: '/categories', label: 'Categorías', icon: 'Tag' as const },
  { path: '/sales', label: 'Ventas', icon: 'Receipt' as const },
  { path: '/inventory', label: 'Inventario', icon: 'Warehouse' as const },
  { path: '/cash', label: 'Cajas', icon: 'Landmark' as const },
  { path: '/users', label: 'Usuarios', icon: 'Users' as const },
  { path: '/reports', label: 'Reportes', icon: 'FileSpreadsheet' as const },
  { path: '/suppliers', label: 'Proveedores', icon: 'Truck' as const },
  { path: '/purchases', label: 'Compras', icon: 'ShoppingCart' as const },
  { path: '/promotions', label: 'Promociones', icon: 'Percent' as const },
  { path: '/customers', label: 'Clientes', icon: 'UserCheck' as const },
  { path: '/tables', label: 'Mesas', icon: 'LayoutGrid' as const },
  { path: '/expenses', label: 'Gastos', icon: 'TrendingDown' as const },
  { path: '/sync', label: 'Sync Cloud', icon: 'CloudUpload' as const },
  { path: '/audit', label: 'Auditoría', icon: 'ClipboardList' as const },
  { path: '/config', label: 'Configuración', icon: 'Settings' as const },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'bg-surface-sidebar h-screen flex flex-col shrink-0',
        // Mobile: fixed drawer, slides in/out
        'fixed inset-y-0 left-0 z-50',
        'md:relative md:z-auto md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        'transition-transform duration-200 ease-out',
        // Desktop width transition
        'md:transition-[width,transform]',
        // Width: always 64 on mobile, collapsed/expanded on desktop
        'w-64 md:w-55',
        collapsed && 'md:w-15',
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/6">
        <img src={nexoIconUrl} alt="Nexo" className="w-8 h-8 rounded-md shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[13px] font-semibold text-white leading-tight tracking-tight truncate">
              Nexo
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

      {/* Collapse toggle (desktop only) / Close button (mobile only) */}
      <div className="px-2 py-3 border-t border-white/6">
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="md:hidden w-full flex items-center gap-2 px-3 rounded-md py-2 text-[12px] text-gray-500 hover:text-gray-300 hover:bg-white/4 transition-colors"
          aria-label="Cerrar menú"
        >
          <ChevronsLeft className="w-4 h-4" />
          <span>Cerrar menú</span>
        </button>
        {/* Desktop collapse */}
        <button
          onClick={onToggle}
          className={clsx(
            'hidden md:flex w-full items-center gap-2 rounded-md py-2 text-[12px] text-gray-500 hover:text-gray-300 hover:bg-white/4 transition-colors duration-(--duration-fast)',
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
