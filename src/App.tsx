import { motion, useTransform } from 'motion/react'
import { ChartColumn, House, Plus, Sparkles, Target, type LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dayKey, type DayKey, type Meal } from './lib/date'
import { haptic, setHapticsEnabled } from './lib/haptics'
import { useStore } from './lib/store'
import { useViewport } from './lib/viewport'
import { AddSheet } from './screens/AddSheet'
import { Coach } from './screens/Coach'
import { Landing } from './screens/Landing'
import { Onboarding } from './screens/Onboarding'
import { PlanScreen } from './screens/PlanScreen'
import { Progress } from './screens/Progress'
import { Today } from './screens/Today'
import { YouSheet } from './screens/You'
import { ContextMenuProvider } from './ui/ContextMenu'
import { InstallPrompt } from './ui/InstallPrompt'
import { useLiquidTrack, useNearness, type LiquidTrack } from './ui/liquid'
import { ToastProvider } from './ui/Toast'
import { Wallpaper } from './ui/Wallpaper'

export type Tab = 'today' | 'coach' | 'progress' | 'plan'

interface AppNav {
  openAdd: (meal?: Meal, date?: DayKey) => void
  goTo: (tab: Tab) => void
  openYou: () => void
  /** The day Today is showing. Adding food from anywhere on Today lands on this day. */
  viewDate: DayKey
  setViewDate: (date: DayKey) => void
}

const NavContext = createContext<AppNav>({ openAdd: () => {}, goTo: () => {}, openYou: () => {}, viewDate: dayKey(), setViewDate: () => {} })
export const useNav = () => useContext(NavContext)

const THEME_COLOR = { light: '#f2f2f7', dark: '#000000' }

function useAppearance() {
  const theme = useStore((s) => s.settings.theme)
  const glass = useStore((s) => s.settings.glass)
  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.glass = glass ?? 'clear'
  }, [glass])
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const haptics = useStore((s) => s.settings.haptics)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [youOpen, setYouOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<Meal | undefined>()
  const [addDate, setAddDate] = useState<DayKey>(dayKey())
  const [viewDate, setViewDate] = useState<DayKey>(dayKey())
  const scrollMemory = useRef<Partial<Record<Tab, number>>>({})

  useAppearance()
  useEffect(() => setHapticsEnabled(haptics), [haptics])
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  // Coming back to the app on a new day shows the new day.
  useEffect(() => {
    let last = dayKey()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = dayKey()
      if (now !== last) {
        setViewDate((current) => (current === last ? now : current))
        last = now
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const openAdd = useCallback((meal?: Meal, date?: DayKey) => {
    setAddMeal(meal)
    setAddDate(date ?? dayKey())
    setAddOpen(true)
  }, [])

  const goTo = useCallback(
    (next: Tab) => {
      if (next === tab) {
        // Tapping the current tab scrolls back to the top, as on iOS.
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      scrollMemory.current[tab] = window.scrollY
      setTab(next)
    },
    [tab],
  )

  // Each tab keeps its own scroll position.
  useLayoutEffect(() => {
    window.scrollTo(0, scrollMemory.current[tab] ?? 0)
  }, [tab])

  const openYou = useCallback(() => setYouOpen(true), [])

  return (
    <ToastProvider>
      <ContextMenuProvider>
      <Wallpaper />
      <NavContext.Provider value={{ openAdd, goTo, openYou, viewDate, setViewDate }}>
        {!onboarded ? (
          started ? (
            <Onboarding onDone={() => setTab('today')} />
          ) : (
            <Landing onStart={() => setStarted(true)} />
          )
        ) : (
          <>
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
              {tab === 'coach' ? (
                <Coach />
              ) : (
                <main className={`gutter mx-auto w-full max-w-[calc(592px+var(--sal)+var(--sar))] pt-[calc(var(--sat)+56px)] pb-[calc(var(--sab)+112px)] ${tab === 'today' ? '' : 'stagger'}`}>
                  {tab === 'today' && <Today />}
                  {tab === 'progress' && <Progress />}
                  {tab === 'plan' && <PlanScreen />}
                </main>
              )}
            </motion.div>

            <TabBar tab={tab} onTab={goTo} onAdd={() => openAdd(undefined, tab === 'today' ? viewDate : dayKey())} />
            <AddSheet open={addOpen} meal={addMeal} date={addDate} onClose={() => setAddOpen(false)} />
            <YouSheet open={youOpen} onClose={() => setYouOpen(false)} />
            {!addOpen && !youOpen && tab !== 'coach' && <InstallPrompt />}
          </>
        )}
      </NavContext.Provider>
      </ContextMenuProvider>
    </ToastProvider>
  )
}

/* ── Tab bar ─────────────────────────────────────────────────────────── */

type Slot = Tab | 'add'
const SLOTS: Slot[] = ['today', 'coach', 'add', 'progress', 'plan']
const ADD_SLOT = 2
const TABS: Record<Tab, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: House },
  coach: { label: 'Coach', icon: Sparkles },
  progress: { label: 'Progress', icon: ChartColumn },
  plan: { label: 'Plan', icon: Target },
}
const restable = (slot: number) => slot !== ADD_SLOT

/**
 * The iOS 27 tab bar: one floating glass capsule, always there. Tap a tab and
 * the lens glides over; press and hold and it lifts into a glass droplet you
 * can slide across the bar, magnifying each tab as it passes.
 */
function TabBar({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  // The keyboard covers the bar on iOS; slide it away so it never peeks out above it.
  const { keyboardOpen } = useViewport(true)
  const trackRef = useRef<HTMLDivElement>(null)

  const commit = (slot: number) => {
    if (slot === ADD_SLOT) {
      haptic(10)
      onAdd()
      return
    }
    haptic()
    onTab(SLOTS[slot] as Tab)
  }

  const track = useLiquidTrack(trackRef, { index: SLOTS.indexOf(tab), onCommit: commit, restable })
  const barScale = useTransform(track.press, (p) => 1 + p * 0.03)
  const lensX = useTransform(track.x, (v) => v - track.geometry.slotWidth.current / 2)
  const lensScale = useTransform(track.press, (p) => 1 + p * 0.22)

  return (
    <motion.nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
      style={{ paddingBottom: 'max(10px, calc(var(--sab) - 12px))', paddingLeft: 'calc(var(--sal) + 14px)', paddingRight: 'calc(var(--sar) + 14px)' }}
      animate={{ y: keyboardOpen ? 140 : 0, opacity: keyboardOpen ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      aria-label="Main"
    >
      <motion.div
        ref={trackRef}
        {...track.handlers}
        onPointerDown={(e) => {
          haptic(5)
          track.handlers.onPointerDown(e)
        }}
        style={{ scale: barScale, WebkitTouchCallout: 'none' }}
        className="glass rim pointer-events-auto flex h-[64px] w-full max-w-[440px] touch-none items-center rounded-full px-[5px] select-none"
      >
        <motion.span
          aria-hidden
          className={`pointer-events-none absolute top-[5px] left-0 h-[54px] rounded-full transition-[background,box-shadow] duration-200 ${track.pressed ? 'lens-lifted z-20' : 'bg-[var(--lens)]'}`}
          style={{ x: lensX, width: track.slotWidth, scaleX: track.scaleX, scaleY: track.scaleY, scale: lensScale }}
        />
        {SLOTS.map((slot, i) =>
          slot === 'add' ? (
            <AddSlot key="add" track={track} slot={i} onActivate={() => commit(i)} />
          ) : (
            <TabSlot
              key={slot}
              track={track}
              slot={i}
              label={TABS[slot].label}
              icon={TABS[slot].icon}
              active={tab === slot}
              lit={track.pressed ? track.hover === i : tab === slot}
              onActivate={() => commit(i)}
            />
          ),
        )}
      </motion.div>
    </motion.nav>
  )
}

function useMagnify(track: LiquidTrack, slot: number, amount: number) {
  const near = useNearness(track, slot)
  return useTransform([near, track.press], ([n, p]) => 1 + (p as number) * amount * (1 - (n as number)))
}

function TabSlot({
  track,
  slot,
  label,
  icon: Icon,
  active,
  lit,
  onActivate,
}: {
  track: LiquidTrack
  slot: number
  label: string
  icon: LucideIcon
  active: boolean
  lit: boolean
  onActivate: () => void
}) {
  const scale = useMagnify(track, slot, 0.26)
  return (
    <button
      data-slot
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      // Pointer taps are handled by the bar; this is for the keyboard and switch control.
      onClick={(e) => e.detail === 0 && onActivate()}
      className="relative h-[54px] min-w-0 flex-1 rounded-full"
    >
      <motion.span style={{ scale }} className={`flex flex-col items-center justify-center gap-[3px] transition-colors duration-150 ${lit ? 'text-tint' : 'text-ink'}`}>
        <Icon size={23} strokeWidth={lit ? 2.4 : 1.9} />
        <span className="text-[10px] leading-none font-semibold">{label}</span>
      </motion.span>
    </button>
  )
}

function AddSlot({ track, slot, onActivate }: { track: LiquidTrack; slot: number; onActivate: () => void }) {
  const scale = useMagnify(track, slot, 0.2)
  return (
    <button data-slot type="button" aria-label="Add food" onClick={(e) => e.detail === 0 && onActivate()} className="relative mx-1 grid h-[54px] w-[54px] shrink-0 place-items-center">
      <motion.span
        style={{ scale }}
        className="grad grid size-[50px] place-items-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(12,144,227,0.6),inset_0_1px_1px_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(0,0,0,0.12)]"
      >
        <Plus size={27} strokeWidth={2.6} />
      </motion.span>
    </button>
  )
}
