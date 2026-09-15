import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Home, Plus, Target, User } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setHapticsEnabled } from './lib/haptics'
import { dayKey, type DayKey, type Meal } from './lib/date'
import { useStore } from './lib/store'
import { AddSheet } from './screens/AddSheet'
import { Landing } from './screens/Landing'
import { Onboarding } from './screens/Onboarding'
import { PlanScreen } from './screens/PlanScreen'
import { Progress } from './screens/Progress'
import { Profile } from './screens/Profile'
import { Today } from './screens/Today'
import { Aurora, Press, spring } from './ui/motion'
import { ToastProvider } from './ui/Toast'

type Tab = 'today' | 'plan' | 'progress' | 'you'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'plan', label: 'Plan', icon: Target },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'you', label: 'You', icon: User },
]

interface AppNav {
  openAdd: (meal?: Meal, date?: DayKey) => void
  goTo: (tab: Tab) => void
}

const NavContext = createContext<AppNav>({ openAdd: () => {}, goTo: () => {} })
export const useNav = () => useContext(NavContext)

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f4f3f8' : '#07070c')
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const haptics = useStore((s) => s.settings.haptics)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<Meal | undefined>()
  const [addDate, setAddDate] = useState<DayKey>(dayKey())

  useTheme()

  useEffect(() => setHapticsEnabled(haptics), [haptics])
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  const openAdd = useCallback((meal?: Meal, date?: DayKey) => {
    setAddMeal(meal)
    setAddDate(date ?? dayKey())
    setAddOpen(true)
  }, [])

  const goTo = useCallback((next: Tab) => {
    setTab(next)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <ToastProvider>
      <Aurora />
      <NavContext.Provider value={{ openAdd, goTo }}>
        {!onboarded ? (
          started ? (
            <Onboarding onDone={() => setTab('today')} />
          ) : (
            <Landing onStart={() => setStarted(true)} />
          )
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.main
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto w-full max-w-[520px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(104px+env(safe-area-inset-bottom))]"
              >
                {tab === 'today' && <Today />}
                {tab === 'plan' && <PlanScreen />}
                {tab === 'progress' && <Progress />}
                {tab === 'you' && <Profile />}
              </motion.main>
            </AnimatePresence>

            <TabBar tab={tab} onTab={goTo} onAdd={() => openAdd()} addOpen={addOpen} />
            <AddSheet open={addOpen} meal={addMeal} date={addDate} onClose={() => setAddOpen(false)} />
          </>
        )}
      </NavContext.Provider>
    </ToastProvider>
  )
}

function TabBar({ tab, onTab, onAdd, addOpen }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void; addOpen: boolean }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="glass relative flex w-full max-w-[420px] items-center justify-between gap-1 rounded-full p-1.5 shadow-xl">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => onTab(t.id)} />
        ))}

        <Press
          onTap={onAdd}
          aria-label="Add food"
          className="relative mx-1 grid size-[54px] shrink-0 place-items-center rounded-full"
        >
          <span className="grad absolute inset-0 rounded-full" />
          <span className="grad absolute inset-0 rounded-full blur-md" style={{ animation: 'pulse-glow 3.2s ease-in-out infinite' }} aria-hidden />
          <motion.span className="relative text-white" animate={{ rotate: addOpen ? 135 : 0 }} transition={spring}>
            <Plus size={26} strokeWidth={2.8} />
          </motion.span>
        </Press>

        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => onTab(t.id)} />
        ))}
      </div>
    </nav>
  )
}

function TabButton({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Home; active: boolean; onClick: () => void }) {
  return (
    <Press
      onTap={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative flex-1 rounded-full px-2 py-2"
    >
      {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-ink/8" transition={spring} />}
      <span className={`relative flex flex-col items-center gap-0.5 transition-colors ${active ? 'text-ink' : 'text-ink-3'}`}>
        <Icon size={19} strokeWidth={active ? 2.6 : 2.1} />
        <span className="text-[10.5px] font-semibold tracking-tight">{label}</span>
      </span>
    </Press>
  )
}
