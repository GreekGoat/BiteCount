import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { sheetSpring } from './motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Sheet height as a share of the screen. */
  height?: string
  label?: string
}

export function Sheet({ open, onClose, children, height = '92dvh', label }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const { style } = document.body
    const previous = style.overflow
    style.overflow = 'hidden'
    return () => {
      style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            aria-label="Close"
            className="absolute inset-0 size-full bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[520px] flex-col overflow-hidden rounded-t-[30px] border border-line bg-bg-2/95 shadow-2xl backdrop-blur-2xl"
            style={{ height }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 650) {
                haptic()
                onClose()
              }
            }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1.5 w-11 rounded-full bg-ink-3/40" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
