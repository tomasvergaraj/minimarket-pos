import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AdminLayout() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-5 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
