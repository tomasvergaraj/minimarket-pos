import { useState, useEffect } from 'react'
import { Save, Server } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import type { StoreConfig } from '../../types'
import { fetchConfig, updateConfig } from '../../lib/services'
import { getServerUrl, setServerUrl } from '../../lib/api'
import toast from 'react-hot-toast'

export default function ConfigPage() {
  const [config, setConfig] = useState<StoreConfig>({ store_name: '', store_rut: '', store_address: '' })
  const [loading, setLoading] = useState(false)
  const [serverUrl, setServerUrlState] = useState(getServerUrl())

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => {})
  }, [])

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

  return (
    <div>
      <PageHeader title="Configuración" description="Datos de la tienda" />

      <div className="max-w-lg space-y-6">
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

        {/* Server URL */}
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
              placeholder="http://192.168.1.10:8000"
              className="flex-1 h-8 px-2.5 text-[13px] rounded-md border border-border bg-white text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <Button size="sm" variant="secondary" type="button" onClick={handleSaveServerUrl}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
