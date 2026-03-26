import { useEffect, useState } from 'react'
import { AlertTriangle, KeyRound } from 'lucide-react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLicense } from '../../context/LicenseContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Button from '../ui/Button'

export default function AdminLayout() {
  const { user } = useAuth()
  const { blockingLicense } = useLicense()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!user || !blockingLicense || location.pathname === '/config') return
    navigate('/config', { replace: true })
  }, [blockingLicense, location.pathname, navigate, user])

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileOpen((o) => !o)} />

        {blockingLicense && (
          <div className="border-b border-amber-200 bg-amber-50/95">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-md bg-amber-100 p-2 text-amber-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Operación bloqueada por licencia
                  </p>
                  <p className="text-xs text-amber-800 truncate">
                    {blockingLicense.message}
                  </p>
                </div>
              </div>
              <Button size="sm" type="button" onClick={() => navigate('/config')}>
                <KeyRound className="w-3.5 h-3.5" /> Abrir licencia
              </Button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
