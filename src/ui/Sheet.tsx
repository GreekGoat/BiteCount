import { AnimatePresence, motion, useDragControls, type DragControls } from 'motion/react'
import { Check, X } from 'lucide-react'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { useViewport } from '../lib/viewport'
import { Press, sheetSpring } from './motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 'full' docks to the bottom at nearly full height; 'auto' floats, sized to its content. */
  size?: 'full' | 'auto'
  label?: string
}

const DragContext = createContext<DragControls | null>(null)

/**
 * An iOS 27 sheet. Full sheets dock to the bottom edge; content-sized sheets
 * float in from the edges on thick glass. Either can be dragged down by its
 * header to dismiss.
 */
export function Sheet({ open, onClose, children, size = 'full', label }: SheetProps) {
  const viewport = useViewport(open)
  const drag = useDragControls()
  const floating = size === 'auto'

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
            tabIndex={-1}
            className="absolute inset-0 size-full"
            style={{ background: 'var(--dim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`sheet-scope absolute flex flex-col overflow-hidden ${
              floating
                ? 'glass-thick rim inset-x-2 mx-auto max-w-[520px] rounded-[36px] bottom-[max(8px,calc(var(--sab)-26px))]'
                : 'inset-x-0 bottom-0 mx-auto max-w-[560px] rounded-t-[36px] bg-bg shadow-[0_-10px_40px_rgba(0,0,0,0.18)]'
            }`}
            style={{
              height: floating ? 'auto' : '100%',
              // 100% is the visible area, so the sheet always stops below the status bar.
              maxHeight: `calc(100% - var(--sat) - ${floating ? 18 : 10}px)`,
            }}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={sheetSpring}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) {
                haptic()
                onClose()
              }
            }}
          >
            <div className="flex shrink-0 touch-none justify-center pt-[7px] pb-0.5" onPointerDown={(e) => drag.start(e)} aria-hidden>
              <div className="h-[5px] w-9 rounded-full bg-ink-4" />
            </div>
            <DragContext.Provider value={drag}>{children}</DragContext.Provider>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

interface SheetHeaderProps {
  title: ReactNode
  onClose?: () => void
  /** Confirm action: a tinted check button on the right. */
  onDone?: () => void
  doneLabel?: string
  doneDisabled?: boolean
  trailing?: ReactNode
}

/** X on the left, title in the middle, confirm on the right — and the handle to drag the sheet down. */
export function SheetHeader({ title, onClose, onDone, doneLabel = 'Done', doneDisabled, trailing }: SheetHeaderProps) {
  const drag = useContext(DragContext)
  return (
    <div className="flex shrink-0 touch-none items-center gap-2 px-4 pt-1 pb-2" onPointerDown={(e) => drag?.start(e)}>
      <div className="flex w-[88px] items-center">
        {onClose && (
          <Press onTap={onClose} aria-label="Close" scale={0.9} className="glass rim grid size-11 place-items-center rounded-full text-ink">
            <X size={20} strokeWidth={2.3} />
          </Press>
        )}
      </div>
      <div className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold">{title}</div>
      <div className="flex w-[88px] items-center justify-end">
        {trailing}
        {onDone && (
          <Press
            onTap={onDone}
            disabled={doneDisabled}
            aria-label={doneLabel}
            scale={0.9}
            className="glass-tint grid size-11 place-items-center rounded-full disabled:opacity-35"
          >
            <Check size={21} strokeWidth={2.8} />
          </Press>
        )}
      </div>
    </div>
  )
}
