import { animate, AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { haptic } from '../lib/haptics'
import { useViewport } from '../lib/viewport'
import { litGlass, Press, sheetSpring } from './motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 'full' docks to the bottom at nearly full height; 'auto' floats, sized to its content. */
  size?: 'full' | 'auto'
  label?: string
}

const offscreen = () => (typeof window === 'undefined' ? 1000 : window.innerHeight + 40)

/**
 * An iOS 27 sheet on Liquid Glass. Full sheets dock to the bottom edge;
 * content-sized sheets float in from the edges. Pull down anywhere — the
 * handle, the header, or the content once it is scrolled to the top — to
 * dismiss, exactly as on iOS.
 */
export function Sheet({ open, onClose, children, size = 'full', label }: SheetProps) {
  const viewport = useViewport(open)
  const floating = size === 'auto'
  const panel = useRef<HTMLDivElement>(null)
  const y = useMotionValue(offscreen())
  // The page behind dims less as the sheet is pulled away.
  const dim = useTransform(y, (v) => Math.max(0, 1 - Math.max(0, v) / 500))

  usePullToDismiss(panel, y, onClose, open)

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
          <motion.div className="absolute inset-0" style={{ opacity: dim }}>
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
          </motion.div>
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`sheet-scope glass-thick rim absolute flex flex-col overflow-hidden ${
              floating ? 'inset-x-2 mx-auto max-w-[520px] rounded-[38px] bottom-[max(8px,calc(var(--sab)-26px))]' : 'inset-x-0 bottom-0 mx-auto max-w-[560px] rounded-t-[38px]'
            }`}
            style={{
              y,
              height: floating ? 'auto' : '100%',
              // 100% is the visible area, so the sheet always stops below the status bar.
              maxHeight: `calc(100% - var(--sat) - ${floating ? 18 : 10}px)`,
            }}
            initial={{ y: offscreen() }}
            animate={{ y: 0 }}
            // Leaving uses the quick iOS dismiss curve rather than a full spring settle.
            exit={{ y: offscreen(), transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] } }}
            transition={sheetSpring}
          >
            <div className="flex shrink-0 justify-center pt-[7px] pb-0.5" aria-hidden>
              <div className="h-[5px] w-9 rounded-full bg-ink-4" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/**
 * Follows a downward pull and dismisses past a threshold. Native touch
 * listeners decide on the very first move, so a pull at the top of the
 * content takes over before Safari starts its own overscroll.
 */
function usePullToDismiss(ref: RefObject<HTMLDivElement | null>, y: MotionValue<number>, onClose: () => void, active: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!active || !el) return

    let startX = 0
    let startY = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let state: 'idle' | 'deciding' | 'pulling' | 'ignored' = 'idle'
    let scroller: HTMLElement | null = null

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        state = 'ignored'
        return
      }
      const target = e.target as HTMLElement
      // Sliders, rulers and text fields keep their own gestures.
      if (target.closest('input[type="range"], textarea, [data-no-pull]')) {
        state = 'ignored'
        return
      }
      const t = e.touches[0]
      startX = t.clientX
      startY = lastY = t.clientY
      lastT = e.timeStamp
      velocity = 0
      scroller = target.closest<HTMLElement>('[data-sheet-scroll]')
      state = 'deciding'
    }

    const onMove = (e: TouchEvent) => {
      if (state === 'idle' || state === 'ignored') return
      const t = e.touches[0]
      if (state === 'deciding') {
        const dx = t.clientX - startX
        const dy = t.clientY - startY
        const atTop = !scroller || scroller.scrollTop <= 0
        if (dy > 0 && dy >= Math.abs(dx) && atTop) {
          state = 'pulling'
          startY = t.clientY
        } else {
          state = 'ignored'
          return
        }
      }
      e.preventDefault()
      y.set(Math.max(0, t.clientY - startY))
      const dt = e.timeStamp - lastT
      if (dt > 0) velocity = ((t.clientY - lastY) / dt) * 1000
      lastY = t.clientY
      lastT = e.timeStamp
    }

    const onEnd = () => {
      const wasPulling = state === 'pulling'
      state = 'idle'
      if (!wasPulling) return
      if (y.get() > 130 || (velocity > 650 && y.get() > 24)) {
        haptic()
        onClose()
      } else {
        animate(y, 0, { type: 'spring', stiffness: 500, damping: 42 })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, y, onClose, active])
}

interface SheetHeaderProps {
  title: ReactNode
  /** A second line under the title, e.g. the date being logged to. */
  subtitle?: ReactNode
  onClose?: () => void
  /** Confirm action: a tinted check button on the right. */
  onDone?: () => void
  doneLabel?: string
  doneDisabled?: boolean
  trailing?: ReactNode
}

/** X on the left, title in the middle, confirm on the right. */
export function SheetHeader({ title, subtitle, onClose, onDone, doneLabel = 'Done', doneDisabled, trailing }: SheetHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-1 pb-2">
      <div className="flex w-[88px] items-center">
        {onClose && (
          <Press onTap={onClose} aria-label="Close" scale={1.14} {...litGlass} className="glass rim grid size-11 place-items-center rounded-full text-ink">
            <X size={20} strokeWidth={2.3} />
          </Press>
        )}
      </div>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-[17px] leading-tight font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 flex justify-center">{subtitle}</div>}
      </div>
      <div className="flex w-[88px] items-center justify-end">
        {trailing}
        {onDone && (
          <Press onTap={onDone} disabled={doneDisabled} aria-label={doneLabel} scale={1.12} className="glass-tint grid size-11 place-items-center rounded-full disabled:opacity-35">
            <Check size={21} strokeWidth={2.8} />
          </Press>
        )}
      </div>
    </div>
  )
}
