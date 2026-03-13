import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Delete } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import nexoIconUrl from '../../assets/nexo-icon.svg'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const { loginWithPin, loading, error } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const handleDigit = (d: string) => {
    if (pin.length < 6) setPin((prev) => prev + d)
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
  }

  const handleSubmit = async () => {
    if (pin.length < 4) return
    try {
      await loginWithPin(pin)
      navigate('/', { replace: true })
    } catch {
      setPin('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Backspace') {
      handleDelete()
    } else if (/^\d$/.test(e.key)) {
      handleDigit(e.key)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-xs animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src={nexoIconUrl} alt="Nexo" className="w-14 h-14 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">
            Nexo Admin
          </h1>
          <p className="text-[13px] text-text-muted mt-1">
            Ingrese su PIN de administrador
          </p>
        </div>

        <div className="bg-surface-card rounded-lg border border-border p-6">
          {/* PIN Display */}
          <div className="flex justify-center gap-2 mb-6" aria-label="PIN ingresado">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'w-10 h-10 rounded-md flex items-center justify-center transition-all duration-(--duration-fast)',
                  i < pin.length
                    ? 'bg-primary-600 scale-105'
                    : 'bg-gray-100 border border-border'
                )}
              >
                {i < pin.length && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-[13px] text-danger bg-danger-light border border-red-100 rounded-md px-3 py-2 mb-4 animate-slide-up">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Numpad */}
          <div
            className="grid grid-cols-3 gap-1.5 mb-5"
            onKeyDown={handleKeyDown}
            tabIndex={0}
            ref={containerRef as React.RefObject<HTMLDivElement>}
            role="group"
            aria-label="Teclado numérico"
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((d, i) =>
              d === '' ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => (d === 'del' ? handleDelete() : handleDigit(d))}
                  disabled={loading}
                  className={clsx(
                    'h-11 rounded-md font-medium transition-all duration-(--duration-fast)',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500',
                    'disabled:opacity-40 disabled:pointer-events-none',
                    d === 'del'
                      ? 'bg-transparent text-text-muted hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center'
                      : 'bg-gray-50 border border-border text-text-primary text-base hover:bg-gray-100 active:bg-gray-200 active:scale-95'
                  )}
                >
                  {d === 'del' ? <Delete className="w-4.5 h-4.5" strokeWidth={1.5} /> : d}
                </button>
              )
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className={clsx(
              'w-full h-10 rounded-md font-medium text-[13px] flex items-center justify-center gap-2',
              'bg-primary-600 text-white shadow-sm',
              'hover:bg-primary-700 active:bg-primary-800',
              'transition-all duration-(--duration-fast)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
              'disabled:opacity-40 disabled:pointer-events-none'
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Ingresar'
            )}
          </button>
        </div>

        <p className="text-caption text-text-muted text-center mt-5">
          Nexo
        </p>
      </div>
    </div>
  )
}
