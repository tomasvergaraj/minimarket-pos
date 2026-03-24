import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LicenseProvider } from './context/LicenseContext'
import AdminLayout from './components/layout/AdminLayout'
import LoginPage from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ProductsPage from './features/products/ProductsPage'
import CategoriesPage from './features/categories/CategoriesPage'
import SalesPage from './features/sales/SalesPage'
import UsersPage from './features/users/UsersPage'
import InventoryPage from './features/inventory/InventoryPage'
import CashPage from './features/cash/CashPage'
import ReportsPage from './features/reports/ReportsPage'
import ConfigPage from './features/config/ConfigPage'
import SuppliersPage from './features/suppliers/SuppliersPage'
import PurchasesPage from './features/purchases/PurchasesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function LoginGuard() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <LoginPage />
}

function resolveRouterBase(): string | undefined {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '')
  if (!base || base === '/') return undefined
  return base
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LicenseProvider>
          <BrowserRouter basename={resolveRouterBase()}>
            <Routes>
              <Route path="/login" element={<LoginGuard />} />
              <Route element={<AdminLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/cash" element={<CashPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/config" element={<ConfigPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </LicenseProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '14px',
              borderRadius: '6px',
              padding: '8px 12px',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
