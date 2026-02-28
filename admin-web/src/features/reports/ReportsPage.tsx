import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import PageHeader from '../../components/patterns/PageHeader'
import DateRangePicker from '../../components/patterns/DateRangePicker'
import Button from '../../components/ui/Button'
import { downloadReport } from '../../lib/services'
import toast from 'react-hot-toast'

export default function ReportsPage() {
  const [salesDateFrom, setSalesDateFrom] = useState('')
  const [salesDateTo, setSalesDateTo] = useState('')
  const [loadingSales, setLoadingSales] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)

  const handleDownload = async (
    type: 'sales' | 'inventory',
    setLoading: (v: boolean) => void,
    params?: { date_from?: string; date_to?: string }
  ) => {
    setLoading(true)
    try {
      const blob = await downloadReport(type, params)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${type}_report.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('Reporte descargado')
    } catch {
      toast.error('Error al descargar reporte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Reportes" description="Exporta datos en formato Excel" />

      <div className="space-y-4 max-w-xl">
        {/* Sales Report */}
        <div className="bg-surface-card rounded-lg border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-text-primary">Reporte de Ventas</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Exporta todas las ventas con detalle de productos, montos e IVA.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <DateRangePicker
                  dateFrom={salesDateFrom}
                  dateTo={salesDateTo}
                  onDateFromChange={setSalesDateFrom}
                  onDateToChange={setSalesDateTo}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    handleDownload('sales', setLoadingSales, {
                      date_from: salesDateFrom || undefined,
                      date_to: salesDateTo || undefined,
                    })
                  }
                  loading={loadingSales}
                >
                  <Download className="w-4 h-4" /> Descargar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Report */}
        <div className="bg-surface-card rounded-lg border border-border p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-text-primary">Reporte de Inventario</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Exporta el inventario actual con stock, precios y estado de cada producto.
              </p>
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => handleDownload('inventory', setLoadingInventory)}
                  loading={loadingInventory}
                >
                  <Download className="w-4 h-4" /> Descargar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
