import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { POSAuthProvider } from './context/POSAuthContext'
import POSLayout from './pages/POSLayout'
import POSLoginPage from './pages/POSLoginPage'
import POSPage from './pages/POSPage'
import POSCashPage from './pages/POSCashPage'
import POSSalesPage from './pages/POSSalesPage'
import POSSettingsPage from './pages/POSSettingsPage'
import POSInventoryPage from './pages/POSInventoryPage'
import POSCustomerDetailPage from './pages/POSCustomerDetailPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function resolveBase(): string | undefined {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '')
  if (!base || base === '/') return undefined
  return base
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <POSAuthProvider>
        <BrowserRouter basename={resolveBase()}>
          <Routes>
            <Route path="/login" element={<POSLoginPage />} />
            <Route path="/" element={<POSLayout />}>
              <Route index element={<POSPage />} />
              <Route path="cash" element={<POSCashPage />} />
              <Route path="sales" element={<POSSalesPage />} />
              <Route path="inventory" element={<POSInventoryPage />} />
              <Route path="customer/:id" element={<POSCustomerDetailPage />} />
              <Route path="settings" element={<POSSettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
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
      </POSAuthProvider>
    </QueryClientProvider>
  )
}
