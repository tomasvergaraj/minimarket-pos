import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloaded' | 'error'

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onUpdateAvailable(() => setState('available'))
    window.electronAPI.onDownloadProgress((p) => setProgress(p))
    window.electronAPI.onUpdateDownloaded(() => setState('downloaded'))
    window.electronAPI.onUpdateError((msg) => { setState('error'); setErrorMsg(msg) })
  }, [])

  if (state === 'idle') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-xs w-72">
      {state === 'available' && (
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Download className="w-4 h-4 shrink-0 text-blue-400" />
            <span>Descargando actualización... {progress > 0 ? `${progress}%` : ''}</span>
          </div>
          {progress > 0 && (
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div className="bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      {state === 'downloaded' && (
        <>
          <RefreshCw className="w-4 h-4 shrink-0 text-green-400" />
          <div className="flex-1">
            <p className="font-medium">Actualización lista</p>
            <p className="text-gray-400 text-xs">Se instalará al reiniciar</p>
          </div>
          <button
            onClick={() => window.electronAPI?.installUpdate()}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded transition"
          >
            Reiniciar
          </button>
        </>
      )}
      {state === 'error' && (
        <span className="text-red-400 text-xs">Error al actualizar: {errorMsg}</span>
      )}
    </div>
  )
}
