import { motion } from 'motion/react'
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
import { InstallPrompt } from './ui/InstallPrompt'
import { liquidSpring, Press } from './ui/motion'
import { ToastProvider } from './ui/Toast'

export type Tab = 'today' | 'coach' | 'progress' | 'plan'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: House },
  { id: 'coach', label: 'Coach', icon: Sparkles },
  { id: 'progress', label: 'Progress', icon: ChartColumn },
  { id: 'plan', label: 'Plan', icon: Target },
]

interface AppNav {
  openAdd: (meal?: Meal, date?: DayKey) => void
  goTo: (tab: Tab) => void
  openYou: () => void
}

const NavContext = createContext<AppNav>({ openAdd: () => {}, goTo: () => {}, openYou: () => {} })
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
  const scrollMemory = useRef<Partial<Record<Tab, number>>>({})

  useAppearance()
  useEffect(() => setHapticsEnabled(haptics), [haptics])
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

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
      <NavContext.Provider value={{ openAdd, goTo, openYou }}>
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
                <main className="mx-auto w-full max-w-[560px] px-4 pt-[calc(var(--sat)+56px)] pb-[calc(var(--sab)+112px)]">
                  {tab === 'today' && <Today />}
                  {tab === 'progress' && <Progress />}
                  {tab === 'plan' && <PlanScreen />}
                </main>
              )}
            </motion.div>

            <TabBar tab={tab} onTab={goTo} onAdd={() => openAdd()} />
            <AddSheet open={addOpen} meal={addMeal} date={addDate} onClose={() => setAddOpen(false)} />
            <YouSheet open={youOpen} onClose={() => setYouOpen(false)} />
            {!addOpen && !youOpen && tab !== 'coach' && <InstallPrompt />}
          </>
        )}
      </NavContext.Provider>
    </ToastProvider>
  )
}

/** The iOS 27 tab bar: one floating glass capsule, always there, with a liquid lens under the current tab. */
function TabBar({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  // The keyboard covers the bar on iOS; slide it away so it never peeks out above it.
  const { keyboardOpen } = useViewport(true)

  return (
    <motion.nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-[14px]"
      style={{ paddingBottom: 'max(10px, calc(var(--sab) - 12px))' }}
      animate={{ y: keyboardOpen ? 140 : 0, opacity: keyboardOpen ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      aria-label="Main"
    >
      <div className="glass rim pointer-events-auto flex h-[64px] w-full max-w-[440px] items-center gap-0.5 rounded-full px-[5px]">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => onTab(t.id)} />
        ))}

        <Press
          onTap={() => {
            haptic(10)
            onAdd()
          }}
          haptics={false}
          aria-label="Add food"
          scale={0.88}
          className="grad mx-1 grid size-[52px] shrink-0 place-items-center rounded-full text-white shadow-[0_6px_18px_-4px_rgba(12,144,227,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]"
        >
          <Plus size={27} strokeWidth={2.6} />
        </Press>

        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => onTab(t.id)} />
        ))}
      </div>
    </motion.nav>
  )
}

function TabButton({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  return (
    <Press onTap={onClick} scale={0.9} aria-label={label} aria-current={active ? 'page' : undefined} className="relative h-[54px] min-w-0 flex-1 rounded-full">
      {active && <motion.span layoutId="tab-lens" className="absolute inset-0 rounded-full bg-fill" transition={liquidSpring} />}
      <span className={`relative flex flex-col items-center justify-center gap-[3px] transition-colors duration-200 ${active ? 'text-tint' : 'text-ink'}`}>
        <Icon size={23} strokeWidth={active ? 2.4 : 1.9} />
        <span className="text-[10px] leading-none font-semibold">{label}</span>
      </span>
    </Press>
  )
}
