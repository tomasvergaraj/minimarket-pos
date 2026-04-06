import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeftRight,
  Banknote,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Landmark,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import { usePOSAuth } from '../context/POSAuthContext'
import { fetchRegisters, openCashSession, closeCashSession } from '../lib/services'
import { useSyncedCashSession } from '../hooks/useSyncedCashSession'

const QUICK_OPEN_AMOUNTS = [0, 5000, 10000, 20000, 50000]

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`
const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  cardClass,
  iconClass,
  valueClass = 'text-slate-900',
}: {
  icon: LucideIcon
  label: string
  value: string
  helper?: string
  cardClass: string
  iconClass: string
  valueClass?: string
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className={`mt-1.5 text-base font-semibold leading-tight ${valueClass}`}>{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        <div className="rounded-xl border border-white/70 bg-white/80 p-2 shadow-sm">
          <Icon size={16} className={iconClass} />
        </div>
      </div>
    </div>
  )
}

function QuickAmountChip({
  amount,
  active,
  onClick,
}: {
  amount: number
  active: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {amount === 0 ? 'Sin fondo' : clp(amount)}
    </motion.button>
  )
}

export default function POSCashPage() {
  const { cashState, setCashState, logout } = usePOSAuth()
  const syncedSession = useSyncedCashSession()
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [selectedRegId, setSelectedRegId] = useState('')
  const [openAmount, setOpenAmount] = useState('')
  const [physCount, setPhysCount] = useState('')
  const [showClose, setShowClose] = useState(false)

  const { data: registers = [] } = useQuery({
    queryKey: ['pos-registers'],
    queryFn: () => fetchRegisters(),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (selectedRegId || registers.length !== 1) return
    setSelectedRegId(registers[0].id)
  }, [registers, selectedRegId])

  const selectedRegister = registers.find((register) => register.id === selectedRegId) ?? null
  const openingAmountValue = parseFloat(openAmount) || 0
  const physicalCountValue = parseFloat(physCount) || 0

  const handleOpen = async () => {
    if (!selectedRegId) {
      toast.error('Selecciona una caja')
      return
    }

    setOpening(true)
    try {
      const session = await openCashSession({
        register_id: selectedRegId,
        opening_amount: openingAmountValue,
      })
      const register = registers.find((item) => item.id === selectedRegId)!
      setCashState({ session, register })
      toast.success(`Caja "${register.name}" abierta`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir caja')
    } finally {
      setOpening(false)
    }
  }

  const handleClose = async () => {
    if (!cashState) return

    setClosing(true)
    try {
      await closeCashSession(cashState.session.id, { closing_amount: physicalCountValue })
      setShowClose(false)
      setPhysCount('')
      toast.success('Caja cerrada correctamente')
      logout()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar caja')
    } finally {
      setClosing(false)
    }
  }

  if (cashState && syncedSession?.status === 'open') {
    const session = syncedSession
    const totalSold =
      session.total_cash_sales + session.total_card_sales + session.total_transfer_sales
    const expectedCash = session.opening_amount + session.total_cash_sales
    const difference = physCount.trim() === '' ? null : physicalCountValue - expectedCash
    const canClose = physCount.trim() !== '' && !closing

    const differenceClasses =
      difference === null
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : difference === 0
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : difference > 0
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-rose-200 bg-rose-50 text-rose-700'

    const differenceLabel =
      difference === null
        ? 'Ingresa el conteo final'
        : difference === 0
        ? 'Cuadra exacto'
        : difference > 0
        ? 'Sobrante'
        : 'Faltante'

    const paymentBreakdown = [
      {
        label: 'Efectivo',
        value: clp(session.total_cash_sales),
        helper: 'Disponible en caja',
        icon: Banknote,
        cardClass: 'border-emerald-100 bg-emerald-50/70',
        iconClass: 'text-emerald-600',
      },
      {
        label: 'Tarjeta',
        value: clp(session.total_card_sales),
        helper: 'Pagos con tarjeta',
        icon: CreditCard,
        cardClass: 'border-sky-100 bg-sky-50/70',
        iconClass: 'text-sky-600',
      },
      {
        label: 'Transferencia',
        value: clp(session.total_transfer_sales),
        helper: 'Pagos transferidos',
        icon: ArrowLeftRight,
        cardClass: 'border-violet-100 bg-violet-50/70',
        iconClass: 'text-violet-600',
      },
    ]

    return (
      <motion.div
        className="space-y-3 p-4 pb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                Sesion activa
              </span>
              <h1 className="mt-2 truncate text-lg font-semibold text-slate-950">{cashState.register.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                  <Clock3 size={12} />
                  Desde {formatTime(session.opened_at)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                  <Receipt size={12} />
                  {session.total_sales_count} venta{session.total_sales_count === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
              Efectivo esperado
            </p>
            <p className="mt-1.5 text-3xl font-semibold text-slate-950">{clp(expectedCash)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Fondo inicial</p>
                <p className="mt-1 font-medium text-slate-800">{clp(session.opening_amount)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Total vendido</p>
                <p className="mt-1 font-medium text-slate-800">{clp(totalSold)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Desglose del turno</p>
              <p className="text-xs text-slate-500">Resumen por medio de pago</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              Actualizado
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {paymentBreakdown.map((item) => (
              <MetricCard
                key={item.label}
                icon={item.icon}
                label={item.label}
                value={item.value}
                helper={item.helper}
                cardClass={item.cardClass}
                iconClass={item.iconClass}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            onClick={() => setShowClose((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Cerrar caja</p>
              <p className="text-xs text-slate-500">Registra el conteo final y la diferencia si existe</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              {showClose ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {showClose && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <MetricCard
                      icon={Banknote}
                      label="Esperado"
                      value={clp(expectedCash)}
                      helper="Caja teorica"
                      cardClass="border-emerald-100 bg-emerald-50/70"
                      iconClass="text-emerald-600"
                    />
                    <MetricCard
                      icon={Landmark}
                      label="Fondo inicial"
                      value={clp(session.opening_amount)}
                      helper="Monto de apertura"
                      cardClass="border-slate-200 bg-slate-50"
                      iconClass="text-slate-600"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-slate-700">Conteo fisico final</label>
                      <button
                        type="button"
                        onClick={() => setPhysCount(String(expectedCash))}
                        className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Usar esperado
                      </button>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={physCount}
                      onChange={(e) => setPhysCount(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-semibold text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </div>

                  <div className={`rounded-xl border p-3 ${differenceClasses}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em]">{differenceLabel}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {difference === null
                            ? 'Ingresa el monto real para habilitar el cierre.'
                            : difference === 0
                            ? 'La caja queda cuadrada.'
                            : 'Esta diferencia se guardara con el cierre.'}
                        </p>
                      </div>
                      <p className="text-xl font-semibold">
                        {difference === null ? clp(0) : clp(difference)}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    onClick={handleClose}
                    disabled={!canClose}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {closing ? 'Cerrando caja...' : 'Confirmar cierre'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-3 p-4 pb-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
            <Landmark size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
              Inicio de turno
            </span>
            <h1 className="mt-2 text-lg font-semibold text-slate-950">Abre tu caja y empieza a vender</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Elige una caja disponible y define el fondo inicial para comenzar el turno.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MetricCard
            icon={Landmark}
            label="Cajas activas"
            value={String(registers.length)}
            helper="Disponibles"
            cardClass="border-slate-200 bg-slate-50"
            iconClass="text-slate-600"
          />
          <MetricCard
            icon={Banknote}
            label="Fondo inicial"
            value={clp(openingAmountValue)}
            helper="Monto actual"
            cardClass="border-blue-100 bg-blue-50/70"
            iconClass="text-blue-600"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">Configura tu turno</p>
          <p className="text-xs text-slate-500">Los campos principales estan primero para que el flujo sea rapido.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Caja registradora</label>
            <select
              value={selectedRegId}
              onChange={(e) => setSelectedRegId(e.target.value)}
              disabled={registers.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <option value="">Seleccionar caja...</option>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.name}
                </option>
              ))}
            </select>
            {registers.length === 1 && selectedRegister && (
              <p className="mt-2 text-xs text-slate-500">
                Caja seleccionada automaticamente: {selectedRegister.name}
              </p>
            )}
            {registers.length === 0 && (
              <p className="mt-2 text-xs text-rose-600">
                No hay cajas activas disponibles para abrir un turno.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-700">Monto inicial en efectivo</label>
              <span className="text-xs text-slate-500">Opcional</span>
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={openAmount}
              onChange={(e) => setOpenAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-semibold text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_OPEN_AMOUNTS.map((amount) => (
                <QuickAmountChip
                  key={amount}
                  amount={amount}
                  active={openingAmountValue === amount && openAmount !== ''}
                  onClick={() => setOpenAmount(String(amount))}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white">
              <AlertCircle size={15} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {selectedRegister ? `Abriras ${selectedRegister.name}` : 'Selecciona una caja para continuar'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedRegister
                  ? `El turno comenzara con ${clp(openingAmountValue)} en efectivo.`
                  : 'Cuando abras la sesion podras registrar ventas y revisar el resumen del turno aqui mismo.'}
              </p>
            </div>
          </div>
        </div>

        <motion.button
          onClick={handleOpen}
          disabled={opening || !selectedRegId || registers.length === 0}
          whileTap={{ scale: 0.98 }}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {opening ? 'Abriendo caja...' : 'Abrir turno'}
        </motion.button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <Clock3 size={16} className="text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">Sugerencia</p>
            <p className="mt-1 text-xs text-slate-500">
              Un fondo inicial redondo suele hacer mas facil cuadrar el cierre al final del turno.
            </p>
          </div>
        </div>
      </div>

    </motion.div>
  )
}
