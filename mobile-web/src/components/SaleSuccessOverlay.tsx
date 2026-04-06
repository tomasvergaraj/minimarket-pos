import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

interface SaleSuccessOverlayProps {
  visible: boolean
  total: number
  change: number
  onDismiss: () => void
}

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`

export default function SaleSuccessOverlay({ visible, total, change, onDismiss }: SaleSuccessOverlayProps) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onDismiss, 2400)
    return () => clearTimeout(t)
  }, [visible, onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-4 left-4 right-4 z-100 pointer-events-auto"
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          onClick={onDismiss}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-green-100 px-4 py-3 flex items-center gap-3">
            {/* Animated check */}
            <motion.div
              className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.08 }}
            >
              <motion.svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <motion.path
                  d="M5 11.5L9 15.5L17 7"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, delay: 0.18, ease: 'easeOut' }}
                />
              </motion.svg>
            </motion.div>

            {/* Info */}
            <motion.div
              className="flex-1 min-w-0"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12, duration: 0.22 }}
            >
              <p className="text-xs text-gray-500 font-medium">Venta registrada</p>
              <p className="text-green-600 font-bold text-lg leading-tight">{clp(total)}</p>
              {change > 0 && (
                <p className="text-xs text-gray-400">Vuelto: <span className="font-semibold text-gray-600">{clp(change)}</span></p>
              )}
            </motion.div>

            <CheckCircle size={16} className="text-green-300 shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
