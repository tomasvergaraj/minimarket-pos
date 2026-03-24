import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  Copy,
  KeyRound,
  Save,
  Server,
  ShieldCheck,
} from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import type { StoreConfig } from '../../types'
import { useLicense } from '../../context/LicenseContext'
import {
  activateLicense,
  fetchConfig,
  updateConfig,
} from '../../lib/services'
import { getServerUrl, setServerUrl } from '../../lib/api'
import toast from 'react-hot-toast'

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('es-CL')
}

function statusTone(status: string, active: boolean): string {
  if (active && status === 'licensed') {
    return 'bg-success-light text-success border border-green-200'
  }
  if (active) {
    return 'bg-primary-50 text-primary-700 border border-primary-200'
  }
  return 'bg-danger-light text-danger border border-red-200'
}

export default function ConfigPage() {
  const [config, setConfig] = useState<StoreConfig>({ store_name: '', store_rut: '', store_address: '' })
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrlState] = useState(getServerUrl())
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [licenseDocument, setLicenseDocument] = useState('')
  const {
    licenseStatus,
    loadingLicense,
    refreshLicenseStatus,
    syncLicenseStatus,
    clearBlockingLicense,
  } = useLicense()

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (licenseStatus || loadingLicense) return
    refreshLicenseStatus().catch((err) => {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la licencia')
    })
  }, [licenseStatus, loadingLicense, refreshLicenseStatus])

  const set = (field: keyof StoreConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((c) => ({ ...c, [field]: e.target.value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateConfig(config)
      toast.success('Configuración guardada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveServerUrl = () => {
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) return
    setServerUrl(url)
    toast.success('URL del servidor guardada')
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiado`)
    } catch {
      toast.error(`No se pudo copiar ${label.toLowerCase()}`)
    }
  }

  const handleActivate = async () => {
    if (!licenseDocument.trim()) {
      toast.error('Pega primero el archivo de licencia')
      return
    }

    setActivatingLicense(true)
    try {
      const status = await activateLicense(licenseDocument)
      syncLicenseStatus(status)
      clearBlockingLicense()
      setLicenseDocument('')
      toast.success('Licencia activada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo activar la licencia')
    } finally {
      setActivatingLicense(false)
    }
  }

  const licenseSummary = useMemo(() => {
    if (!licenseStatus) return 'Cargando estado de licencia...'
    if (licenseStatus.status === 'trial') {
      return `Prueba activa con ${licenseStatus.trial_days_remaining ?? 0} días restantes`
    }
    if (licenseStatus.status === 'licensed') {
      return licenseStatus.customer_name
        ? `Licencia activa para ${licenseStatus.customer_name}`
        : 'Licencia activa'
    }
    return licenseStatus.message
  }, [licenseStatus])

  return (
    <div>
      <PageHeader title="Configuración" description="Datos de la tienda y licencia comercial" />

      <div className="max-w-5xl space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-surface-card rounded-lg border border-border p-5 space-y-4">
            <Input
              label="Nombre de la tienda"
              value={config.store_name}
              onChange={set('store_name')}
              required
            />
            <Input
              label="RUT"
              value={config.store_rut}
              onChange={set('store_rut')}
              placeholder="76.123.456-7"
            />
            <Input
              label="Dirección"
              value={config.store_address}
              onChange={set('store_address')}
              placeholder="Av. Principal 123, Santiago"
            />
          </div>

          <Button type="submit" loading={loading}>
            <Save className="w-4 h-4" /> Guardar cambios
          </Button>
        </form>

        <div className="bg-surface-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-text-muted" />
            <h3 className="text-[13px] font-semibold text-text-secondary">Servidor API</h3>
          </div>
          <p className="text-xs text-text-muted">
            URL del backend FastAPI. Útil en redes LAN para apuntar a otro servidor.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrlState(e.target.value)}
              placeholder="http://192.168.1.10:8001"
              className="flex-1 h-8 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <Button size="sm" variant="secondary" type="button" onClick={handleSaveServerUrl}>
              Guardar
            </Button>
          </div>
        </div>

        <div className="bg-surface-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-text-muted" />
                <h3 className="text-[13px] font-semibold text-text-secondary">Licencia Offline</h3>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Usa el código de activación para emitir una licencia firmada para este PC servidor.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusTone(licenseStatus?.status ?? 'loading', !!licenseStatus?.is_active)}`}>
              {loadingLicense ? 'Cargando...' : (licenseStatus?.status ?? 'sin-datos')}
            </span>
          </div>

          {licenseStatus && (
            <>
              <div className={`rounded-lg px-4 py-3 text-sm ${licenseStatus.is_active ? 'bg-primary-50 text-primary-700' : 'bg-danger-light text-danger'}`}>
                <p className="font-medium">{licenseSummary}</p>
                <p className="text-xs mt-1 opacity-90">{licenseStatus.message}</p>
              </div>

              {!licenseStatus.verification_ready && (
                <div className="rounded-lg px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Falta la clave pública de licencias</p>
                      <p className="text-xs mt-1">
                        Configura <code>LICENSE_PUBLIC_KEY_PATH</code> en el backend para poder validar licencias firmadas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Instalación</span>
                  </div>
                  <p className="text-sm font-mono break-all text-text-primary">{licenseStatus.installation_id}</p>
                  <p className="text-xs text-text-muted break-all">{licenseStatus.hardware_hash}</p>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Clock3 className="w-3.5 h-3.5" />
                    <span>Estado comercial</span>
                  </div>
                  <p className="text-sm text-text-primary">
                    {licenseStatus.status === 'trial'
                      ? `Prueba hasta ${formatDate(licenseStatus.trial_expires_at)}`
                      : `Licencia ${licenseStatus.license_type ?? 'perpetual'}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    Activada: {formatDate(licenseStatus.activated_at)} | Actualizaciones: {formatDate(licenseStatus.updates_until)}
                  </p>
                  <p className="text-xs text-text-muted">
                    Cajas activas: {licenseStatus.register_count}
                    {licenseStatus.max_registers != null ? ` / ${licenseStatus.max_registers}` : ' / sin límite'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-semibold text-text-secondary">Código de activación</h4>
                    <p className="text-xs text-text-muted">
                      Envíaselo al emisor de licencias para que te devuelva un archivo firmado.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => copyText(licenseStatus.request_code, 'Código de activación')}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={licenseStatus.request_payload_json}
                  rows={8}
                  className="w-full rounded-md border border-border bg-gray-50 px-3 py-2 text-xs font-mono text-text-secondary focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <h4 className="text-[13px] font-semibold text-text-secondary">Activar licencia</h4>
                  <p className="text-xs text-text-muted">
                    Pega el archivo JSON firmado que te entreguen después de comprar la licencia.
                  </p>
                </div>
                <textarea
                  value={licenseDocument}
                  onChange={(e) => setLicenseDocument(e.target.value)}
                  rows={8}
                  placeholder='{"payload": {...}, "signature": "..."}'
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={handleActivate} loading={activatingLicense}>
                    <ShieldCheck className="w-4 h-4" /> Activar licencia
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyText(licenseStatus.request_payload_json, 'Solicitud de activación')}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar solicitud
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
