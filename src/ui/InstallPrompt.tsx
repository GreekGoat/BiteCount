import { AnimatePresence, motion } from 'motion/react'
import { Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Press, spring } from './motion'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED = 'bitecount-install-dismissed'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Nudges people to install the app: the native prompt where it exists, instructions on iOS. */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED)) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS never fires that event, so show the Share → Add to Home Screen hint instead.
    const timer = isIos() ? setTimeout(() => setShowIosHint(true), 4000) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Private mode: it will just ask again next time.
    }
    setEvent(null)
    setShowIosHint(false)
  }

  const visible = !!event || showIosHint

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={spring}
          className="fixed inset-x-0 z-30 flex justify-center px-3"
          style={{ bottom: 'calc(max(10px, var(--sab) - 12px) + 74px)' }}
        >
          <div className="glass-thick rim flex w-full max-w-[440px] items-center gap-3 rounded-[26px] py-2.5 pr-1.5 pl-3">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-11 shrink-0 rounded-[11px]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-tight font-semibold">Keep BiteCount on your Home Screen</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[13px] text-ink-2">
                {event ? (
                  'Opens full screen and works offline.'
                ) : (
                  <>
                    Tap <Share size={13} className="inline shrink-0 text-tint" /> then Add to Home Screen.
                  </>
                )}
              </p>
            </div>
            {event && (
              <Press
                onTap={async () => {
                  await event.prompt()
                  await event.userChoice
                  dismiss()
                }}
                className="glass-tint min-h-[36px] shrink-0 rounded-full px-4 text-[15px] font-semibold"
              >
                Install
              </Press>
            )}
            <Press onTap={dismiss} aria-label="Dismiss" className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3">
              <span className="grid size-8 place-items-center rounded-full bg-fill">
                <X size={15} strokeWidth={2.4} />
              </span>
            </Press>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
