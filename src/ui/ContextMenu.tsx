import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../lib/haptics'

/*
 * The iOS long-press menu: hold a row, the row lifts a little, everything
 * else blurs back, and a glass menu of actions opens beside it.
 */

export interface MenuAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

interface MenuRequest {
  rect: DOMRect
  preview: ReactNode
  actions: MenuAction[]
}

const MenuContext = createContext<(request: MenuRequest) => void>(() => {})
export const useContextMenu = () => useContext(MenuContext)

const MENU_WIDTH = 250
const ROW = 50

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuRequest | null>(null)
  const open = useCallback((request: MenuRequest) => setMenu(request), [])
  const close = () => setMenu(null)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  // Below the row when it fits, otherwise above it.
  const place = (m: MenuRequest) => {
    const height = m.actions.length * ROW
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = m.rect.bottom + 10
    const top = below + height < vh - 24 ? below : Math.max(12, m.rect.top - 10 - height)
    const left = Math.min(Math.max(12, m.rect.left), vw - MENU_WIDTH - 12)
    return { top, left, fromTop: top >= m.rect.bottom }
  }

  return (
    <MenuContext.Provider value={open}>
      {children}
      {createPortal(
        <AnimatePresence>
          {menu && (
            <div className="fixed inset-0 z-[65]" role="presentation">
              <motion.button
                aria-label="Close menu"
                className="absolute inset-0 size-full bg-[var(--dim)] backdrop-blur-[14px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={close}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute"
                style={{ top: menu.rect.top, left: menu.rect.left, width: menu.rect.width, height: menu.rect.height }}
                initial={{ scale: 1 }}
                animate={{ scale: 1.03 }}
                exit={{ scale: 1, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                {menu.preview}
              </motion.div>
              {(() => {
                const p = place(menu)
                return (
                  <motion.div
                    role="menu"
                    className="glass-thick rim absolute overflow-hidden rounded-[22px]"
                    style={{ top: p.top, left: p.left, width: MENU_WIDTH, transformOrigin: p.fromTop ? '24px 0' : '24px 100%' }}
                    initial={{ opacity: 0, scale: 0.6, y: p.fromTop ? -10 : 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                  >
                    {menu.actions.map((action, i) => (
                      <button
                        key={action.label}
                        role="menuitem"
                        onClick={() => {
                          haptic()
                          setMenu(null)
                          // Let the menu start closing before the action changes the page.
                          setTimeout(action.onSelect, 60)
                        }}
                        className={`flex h-[50px] w-full items-center justify-between gap-3 px-4 text-left text-[17px] active:bg-fill ${
                          i > 0 ? 'border-t-[0.5px] border-separator' : ''
                        } ${action.destructive ? 'text-danger' : 'text-ink'}`}
                      >
                        {action.label}
                        <action.icon size={20} strokeWidth={2} />
                      </button>
                    ))}
                  </motion.div>
                )
              })()}
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </MenuContext.Provider>
  )
}

/**
 * Long-press detection that steps aside for scrolling and swiping: moving the
 * finger more than a few points cancels it. `fired` tells a click handler to
 * ignore the click that ends a long press.
 */
export function useLongPress(onLongPress: (el: HTMLElement) => void, delay = 430) {
  const timer = useRef<number | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }

  return {
    fired,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        fired.current = false
        origin.current = { x: e.clientX, y: e.clientY }
        const el = e.currentTarget
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          fired.current = true
          haptic(14)
          onLongPress(el)
        }, delay)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (!origin.current) return
        if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  }
}
