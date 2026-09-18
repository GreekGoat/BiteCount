import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { useViewport } from '../lib/viewport'
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
  const viewport = useViewport(open)

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
        <div
          className="fixed inset-x-0 z-50"
          // Pinned to the visible area rather than the page, so the keyboard
          // cannot push the sheet up behind the status bar.
          style={viewport.height ? { top: viewport.offsetTop, height: viewport.height } : { top: 0, bottom: 0 }}
        >
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
            // 100% is the visible area, so the sheet always stops below the status bar.
            // --safe-top lets a device inset be simulated in testing.
            style={{ height, maxHeight: 'calc(100% - var(--safe-top, env(safe-area-inset-top)) - 10px)' }}
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
