import { useRef } from 'react'
import { Printer, Receipt, X } from 'lucide-react'
import { generateReceiptHtml } from '../lib/receiptHtml'
import type { PrintPrefs, Sale } from '../types'

interface Props {
  sale: Sale
  prefs: PrintPrefs
  onClose(): void
}

export default function POSReceiptPreviewModal({ sale, prefs, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const html = generateReceiptHtml(sale, prefs, { showPrintButton: false })

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative flex max-h-[94vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
              <Receipt size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Vista previa</p>
              <p className="text-lg font-bold text-gray-900">Boleta #{sale.sale_number}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            aria-label="Cerrar vista previa"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-lg">
            <iframe
              ref={iframeRef}
              title={`Boleta ${sale.sale_number}`}
              srcDoc={html}
              className="h-[62vh] w-full border-0 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-200 px-4 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-600"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}
