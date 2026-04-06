import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePOSAuth } from '../context/POSAuthContext'

const ICON_URL = `${import.meta.env.BASE_URL}nexo-icon-192.png`

export default function POSLoginPage() {
  const { loginWithPin, loading, error } = usePOSAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')

  const canSubmit = pin.length === 4 || pin.length === 6

  const handleSubmit = async (currentPin: string) => {
    if (!canSubmit && currentPin === pin) return
    try {
      await loginWithPin(currentPin)
      navigate('/', { replace: true })
    } catch {
      setPin('')
    }
  }

  const handleKey = (key: string) => {
    if (key === 'del') { setPin((p) => p.slice(0, -1)); return }
    if (key === 'ok') { void handleSubmit(pin); return }
    setPin((prev) => prev.length >= 6 ? prev : prev + key)
  }

  const keys = ['1','2','3','4','5','6','7','8','9','del','0','ok']

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-500 flex flex-col items-center justify-center px-6">
      <motion.div
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm"
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <motion.img
          src={ICON_URL}
          alt="Nexo"
          className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.1 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">Nexo POS</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Ingresa tu PIN</p>

        {/* PIN dots */}
        <div className="bg-gray-100 rounded-lg p-4 mb-5 flex items-center justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              animate={i < pin.length
                ? { scale: [1, 1.35, 1], backgroundColor: '#2563eb' }
                : { scale: 1, backgroundColor: '#d1d5db' }}
              transition={{ duration: 0.18 }}
              className="rounded-full"
              style={{ width: i < pin.length ? 16 : 12, height: i < pin.length ? 16 : 12 }}
            />
          ))}
        </div>

        {error && (
          <motion.p
            className="text-red-500 text-sm mb-4 text-center"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {keys.map((k, i) =>
            k === 'del' ? (
              <motion.button
                key={i}
                onPointerDown={() => handleKey('del')}
                whileTap={{ scale: 0.88 }}
                className="bg-gray-100 hover:bg-gray-200 py-4 rounded-lg flex items-center justify-center"
              >
                <Delete size={20} className="text-gray-600" />
              </motion.button>
            ) : k === 'ok' ? (
              <motion.button
                key={i}
                onPointerDown={() => handleKey('ok')}
                disabled={loading || !canSubmit}
                whileTap={{ scale: 0.92 }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg disabled:opacity-30"
              >
                {loading ? '...' : 'OK'}
              </motion.button>
            ) : (
              <motion.button
                key={i}
                onPointerDown={() => handleKey(k)}
                disabled={loading || pin.length >= 6}
                whileTap={{ scale: 0.88 }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xl font-semibold py-4 rounded-lg disabled:opacity-40"
              >
                {k}
              </motion.button>
            )
          )}
        </div>
      </motion.div>
    </div>
  )
}
