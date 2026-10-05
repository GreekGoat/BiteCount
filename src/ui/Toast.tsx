import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
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

/** Glass banners that drop from under the Dynamic Island. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback<Push>((message, tone = 'default', action) => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list.slice(-1), { id, message, tone, action }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 6000 : tone === 'error' ? 5200 : 3400)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ paddingTop: 'calc(var(--sat) + 6px)' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.94 }}
              transition={spring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.8, bottom: 0.1 }}
              onDragEnd={(_, info) => info.offset.y < -24 && setToasts((list) => list.filter((t) => t.id !== toast.id))}
              className="glass-thick rim pointer-events-auto flex min-h-[52px] w-full max-w-[400px] items-center gap-2.5 rounded-[26px] py-2 pr-2 pl-4"
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              {toast.tone === 'success' && <CheckCircle2 size={20} className="shrink-0 text-good" />}
              {toast.tone === 'error' && <AlertCircle size={20} className="shrink-0 text-danger" />}
              <span className="min-w-0 flex-1 py-1 text-[15px] leading-snug font-medium text-ink">{toast.message}</span>
              {toast.action ? (
                <button
                  onClick={() => {
                    haptic()
                    toast.action?.onAction()
                    setToasts((list) => list.filter((t) => t.id !== toast.id))
                  }}
                  className="min-h-[36px] shrink-0 rounded-full bg-fill px-4 text-[15px] font-semibold text-tint"
                >
                  {toast.action.label}
                </button>
              ) : (
                <span className="w-2" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
