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
          className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4"
        >
          <div className="glass flex w-full max-w-[420px] items-center gap-3 rounded-2xl p-3 shadow-xl">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-tight font-bold">Keep BiteCount on your home screen</p>
              <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-2">
                {event ? (
                  'Opens full screen and works offline.'
                ) : (
                  <>
                    Tap <Share size={12} className="inline shrink-0" /> then Add to Home Screen.
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
                className="grad shrink-0 rounded-full px-4 py-2 text-[13.5px] font-bold text-white"
              >
                Install
              </Press>
            )}
            <Press onTap={dismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-3">
              <X size={15} />
            </Press>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
