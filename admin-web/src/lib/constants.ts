export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/products', label: 'Productos', icon: 'Package' },
  { path: '/sales', label: 'Ventas', icon: 'Receipt' },
  { path: '/inventory', label: 'Inventario', icon: 'Warehouse' },
  { path: '/cash', label: 'Cajas', icon: 'Landmark' },
  { path: '/users', label: 'Usuarios', icon: 'Users' },
  { path: '/reports', label: 'Reportes', icon: 'FileSpreadsheet' },
  { path: '/config', label: 'Configuración', icon: 'Settings' },
] as const

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mixed: 'Mixto',
}

export const SALE_STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  voided: 'Anulada',
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: 'Venta',
  restock: 'Reposición',
  adjustment: 'Ajuste',
  shrinkage: 'Merma',
}
