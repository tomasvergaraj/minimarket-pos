import { useState } from 'react'
import toast from 'react-hot-toast'
import { Server, Wifi, WifiOff, LogOut, User, Printer, Landmark } from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { setServerUrl, getServerUrl } from '../lib/api'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSyncedCashSession } from '../hooks/useSyncedCashSession'
import api from '../lib/api'
import type { PrintPrefs } from '../types'

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

const PRINT_PREFS_KEY = 'pos_print_prefs'

function loadPrintPrefs(): PrintPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PRINT_PREFS_KEY) ?? '{}') as Partial<PrintPrefs>
    return { auto_print: stored.auto_print ?? false, store_name: stored.store_name ?? '' }
  } catch {
    return { auto_print: false, store_name: '' }
  }
}

export function savePrintPrefs(prefs: PrintPrefs) {
  localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(prefs))
}

export default function POSSettingsPage() {
  const { user, cashState, logout } = usePOSAuth()
  const isOnline = useOnlineStatus()
  const syncedSession = useSyncedCashSession()

  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl)
  const [testing, setTesting] = useState(false)
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null)

  const [printPrefs, setPrintPrefs] = useState<PrintPrefs>(loadPrintPrefs)

  const handleSaveUrl = () => {
    setServerUrl(serverUrlInput)
    toast.success('URL guardada. Recarga la página para aplicar.')
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionOk(null)
    try {
      await api.get('/health', { timeout: 5000 })
      setConnectionOk(true)
      toast.success('Conexión exitosa')
    } catch {
      try {
        await api.get('/users/me', { timeout: 5000 })
        setConnectionOk(true)
        toast.success('Conexión exitosa')
      } catch {
        setConnectionOk(false)
        toast.error('No se pudo conectar al servidor')
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSavePrintPrefs = () => {
    savePrintPrefs(printPrefs)
    toast.success('Preferencias de impresión guardadas')
  }

  return (
    <div className="p-4 space-y-4">
      {/* User info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <User size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-semibold">{user?.full_name ?? user?.username}</p>
          <p className="text-gray-500 text-xs capitalize">
            {user?.role === 'admin' ? 'Administrador' : 'Cajero'}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? 'En línea' : 'Sin conexión'}
        </div>
      </div>

      {/* Active cash session */}
      {cashState && syncedSession?.status === 'open' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-gray-900 font-medium">
            <Landmark size={16} className="text-green-600" />
            Sesión de caja activa
          </div>
          <p className="text-sm text-gray-700 font-semibold">{cashState.register.name}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Ventas</p>
              <p className="text-gray-900 font-medium">{syncedSession.total_sales_count}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total</p>
              <p className="text-gray-900 font-medium">
                {clp(syncedSession.total_cash_sales + syncedSession.total_card_sales + syncedSession.total_transfer_sales)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Abierta</p>
              <p className="text-gray-900 font-medium">
                {new Date(syncedSession.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Efectivo esperado</p>
              <p className="text-gray-900 font-medium">
                {clp(syncedSession.opening_amount + syncedSession.total_cash_sales)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Server URL */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-900 font-medium">
          <Server size={16} className="text-blue-600" />
          Servidor
        </div>
        <input
          type="url"
          value={serverUrlInput}
          onChange={(e) => setServerUrlInput(e.target.value)}
          placeholder="http://192.168.1.100:8001"
          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:border-blue-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {testing ? (
              <span className="animate-spin">⟳</span>
            ) : connectionOk === true ? (
              <Wifi size={16} className="text-green-600" />
            ) : connectionOk === false ? (
              <WifiOff size={16} className="text-red-500" />
            ) : (
              <Wifi size={16} />
            )}
            {testing ? 'Probando...' : 'Probar'}
          </button>
          <button
            onClick={handleSaveUrl}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Print preferences */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-900 font-medium">
          <Printer size={16} className="text-blue-600" />
          Impresión
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Nombre del local en boleta</label>
          <input
            type="text"
            value={printPrefs.store_name}
            onChange={(e) => setPrintPrefs({ ...printPrefs, store_name: e.target.value })}
            placeholder="Nexo POS"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700">Mostrar boleta al vender</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={printPrefs.auto_print}
              onChange={(e) => setPrintPrefs({ ...printPrefs, auto_print: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </div>
        </label>
        <button
          onClick={handleSavePrintPrefs}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
        >
          Guardar preferencias
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-2xl font-medium"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>

      <p className="text-center text-gray-400 text-xs">Nexo POS v1.0 · PWA</p>
    </div>
  )
}
