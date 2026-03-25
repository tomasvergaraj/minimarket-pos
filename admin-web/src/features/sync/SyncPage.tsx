import { useState, useEffect, useCallback } from 'react'
import {
  Cloud, CloudOff, RefreshCw, CheckCircle, XCircle, Clock,
  Database, Settings, Play, Building2, AlertCircle, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/patterns/PageHeader'
import Button from '../../components/ui/Button'
import { formatDateTime } from '../../lib/format'
import { fetchSyncStatus, fetchSyncConfig, updateSyncConfig, triggerSync } from '../../lib/services'
import type { SyncStatus, SyncConfigOut, SyncLog } from '../../types'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function parseSyncDate(iso: string): Date {
  if (!iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(`${iso}Z`)
  }
  return new Date(iso)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return formatDateTime(iso)
}

function fmtDuration(log: SyncLog): string {
  if (!log.completed_at) return '—'
  const ms = parseSyncDate(log.completed_at).getTime() - parseSyncDate(log.started_at).getTime()
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function StatusBadge({ status }: { status: SyncLog['status'] }) {
  const map = {
    running: { icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: 'En curso', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
    success: { icon: <CheckCircle className="w-3 h-3" />,           label: 'Exitoso',  cls: 'text-green-700 bg-green-50 border-green-200' },
    error:   { icon: <XCircle className="w-3 h-3" />,               label: 'Error',    cls: 'text-red-700 bg-red-50 border-red-200' },
    skipped: { icon: <Clock className="w-3 h-3" />,                  label: 'Omitido',  cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  }
  const { icon, label, cls } = map[status] ?? map.skipped
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {icon}{label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Config form
// ──────────────────────────────────────────────────────────────────────────────

interface ConfigFormProps {
  initial: SyncConfigOut
  onSaved: () => void
}

function ConfigForm({ initial, onSaved }: ConfigFormProps) {
  const [url, setUrl] = useState(initial.supabase_url)
  const [key, setKey] = useState('')
  const [branchId, setBranchId] = useState(initial.branch_id)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: { preventDefault(): void }) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSyncConfig({ supabase_url: url, supabase_key: key || '(keep)', branch_id: branchId })
      toast.success('Configuración guardada')
      setKey('')
      onSaved()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-[11px] font-medium text-text-secondary mb-1">URL del proyecto Supabase</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://xxxx.supabase.co"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-text-secondary mb-1">
          API Key (anon / service_role)
          {initial.supabase_key_masked && (
            <span className="ml-1.5 text-text-muted font-normal">actual: {initial.supabase_key_masked}</span>
          )}
        </label>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Dejar vacío para mantener el actual"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div>
        <label className="flex items-center gap-1 text-[11px] font-medium text-text-secondary mb-1">
          <Building2 className="w-3 h-3" /> ID de Sucursal (branch_id)
        </label>
        <input
          type="text"
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          placeholder="ej: sucursal-central, local-2"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-[11px] text-text-muted mt-1">
          Identificador único de esta sucursal. Cada local debe tener un valor distinto para soporte multi-sucursal.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" loading={saving}>
          <Settings className="w-3.5 h-3.5" />
          Guardar configuración
        </Button>
      </div>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────

export default function SyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [config, setConfig] = useState<SyncConfigOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([fetchSyncStatus(), fetchSyncConfig()])
      setStatus(s)
      setConfig(c)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 15000)
    return () => clearInterval(id)
  }, [loadAll])

  async function handleTrigger() {
    setTriggering(true)
    try {
      const res = await triggerSync()
      toast.success(res.message)
      setTimeout(loadAll, 2000)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al iniciar sync')
    } finally {
      setTriggering(false)
    }
  }

  const configured = status?.configured ?? false
  const lastSync = status?.last_sync ?? null

  return (
    <div>
      <PageHeader
        title="Sincronización Cloud"
        description="Respaldo automático y soporte multi-sucursal con Supabase"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowConfig(v => !v)}>
              <Settings className="w-3.5 h-3.5" />
              Configurar
            </Button>
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={!configured}
              loading={triggering}
            >
              <Play className="w-3.5 h-3.5" />
              Sync ahora
            </Button>
          </>
        }
      />

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
          {configured
            ? <Cloud className="w-7 h-7 text-green-500 shrink-0 mt-0.5" />
            : <CloudOff className="w-7 h-7 text-gray-300 shrink-0 mt-0.5" />}
          <div>
            <p className="text-[11px] text-text-secondary">Supabase</p>
            <p className={`text-[13px] font-semibold ${configured ? 'text-green-700' : 'text-text-muted'}`}>
              {configured ? 'Configurado' : 'No configurado'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
          <Building2 className="w-7 h-7 text-indigo-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] text-text-secondary">Sucursal</p>
            <p className="text-[13px] font-semibold text-text-primary truncate">
              {status?.branch_id || 'default'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-7 h-7 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-text-secondary">Último sync</p>
            <p className="text-[13px] font-semibold text-text-primary">
              {lastSync ? fmtDate(lastSync.started_at) : 'Nunca'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 flex items-start gap-3">
          <Database className="w-7 h-7 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-text-secondary">Último sync</p>
            <p className="text-[13px] font-semibold text-text-primary">
              {lastSync ? `${lastSync.records_synced} registros` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && config && (
        <div className="bg-white border border-border rounded-xl p-5 mb-5">
          <h2 className="text-[13px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-text-muted" />
            Configuración de Supabase
          </h2>
          <ConfigForm initial={config} onSaved={loadAll} />
          <div className="mt-4 p-3 bg-gray-50 border border-border rounded-lg flex gap-2">
            <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-text-secondary mb-0.5">Acceso remoto al admin</p>
              <p className="text-[11px] text-text-muted">
                Para acceder desde fuera de la red local, usa un túnel como{' '}
                <code className="font-mono bg-gray-100 px-1 rounded">cloudflared tunnel</code> o configura nginx
                apuntando a <code className="font-mono bg-gray-100 px-1 rounded">localhost:8001</code>.
                El panel admin se sirve en <code className="font-mono bg-gray-100 px-1 rounded">/admin/</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync log table */}
      <div className="bg-white border border-border rounded-xl">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary">Historial de sincronizaciones</h2>
          <button onClick={loadAll} className="text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!status?.recent_logs.length ? (
          <div className="px-5 py-12 text-center">
            <Cloud className="w-9 h-9 mx-auto mb-3 text-gray-200" />
            <p className="text-[13px] text-text-muted">No hay sincronizaciones registradas</p>
            {!configured && (
              <p className="text-[11px] text-text-muted mt-1 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" /> Configura Supabase para comenzar
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-text-secondary border-b border-border bg-gray-50">
                  <th className="px-5 py-3 font-medium">Inicio</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Sucursal</th>
                  <th className="px-5 py-3 font-medium">Tablas</th>
                  <th className="px-5 py-3 font-medium">Registros</th>
                  <th className="px-5 py-3 font-medium">Duración</th>
                  <th className="px-5 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.recent_logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 text-text-primary whitespace-nowrap">{fmtDate(log.started_at)}</td>
                    <td className="px-5 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-5 py-3 text-text-secondary">{log.branch_id}</td>
                    <td className="px-5 py-3 text-text-primary">{log.tables_synced}</td>
                    <td className="px-5 py-3 text-text-primary">{log.records_synced}</td>
                    <td className="px-5 py-3 text-text-secondary">{fmtDuration(log)}</td>
                    <td className="px-5 py-3 text-red-600 text-[11px] max-w-xs truncate">
                      {log.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-sucursal info */}
      <div className="mt-4 p-4 bg-gray-50 border border-border rounded-xl flex gap-3">
        <Building2 className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-semibold text-text-secondary mb-0.5">Uso multi-sucursal</p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Cada sucursal debe tener un{' '}
            <code className="font-mono bg-white border border-border px-1 rounded">BRANCH_ID</code>{' '}
            único en su archivo <code className="font-mono bg-white border border-border px-1 rounded">.env</code>.
            Todos los registros se envían a Supabase con ese identificador, permitiendo consolidar datos
            de múltiples locales. El sync-worker en{' '}
            <code className="font-mono bg-white border border-border px-1 rounded">sync-worker/sync.py</code>{' '}
            puede correr como servicio Windows para sincronización automática cada 30 minutos.
          </p>
        </div>
      </div>
    </div>
  )
}
