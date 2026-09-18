import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { spring } from './motion'

type Tone = 'default' | 'error' | 'success'

interface ToastAction {
  label: string
  onAction: () => void
}

interface Toast {
  id: number
  message: string
  tone: Tone
  action?: ToastAction
}

type Push = (message: string, tone?: Tone, action?: ToastAction) => void

const ToastContext = createContext<Push>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback<Push>((message, tone = 'default', action) => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 6000 : 3600)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={spring}
              className="glass pointer-events-auto flex max-w-[min(92vw,420px)] items-center gap-3 rounded-2xl px-4 py-3 shadow-lg"
              role="status"
            >
              <span
                className="min-w-0 flex-1 text-[14px] leading-snug font-medium"
                style={{ color: toast.tone === 'error' ? 'var(--danger)' : toast.tone === 'success' ? 'var(--good)' : 'var(--ink)' }}
              >
                {toast.message}
              </span>
              {toast.action && (
                <button
                  onClick={() => {
                    haptic()
                    toast.action?.onAction()
                    setToasts((list) => list.filter((t) => t.id !== toast.id))
                  }}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] font-bold text-ink"
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
