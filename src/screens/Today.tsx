import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Droplets, Flame, Lightbulb, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNav } from '../App'
import { addDays, dayKey, fromKey, greeting, lastNDays, MEALS, relativeDayLabel, type DayKey } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { dayInsight } from '../lib/insights'
import { entriesForDay, usePlan, streakOf, sumEntries, useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { MacroBar, Ring } from '../ui/Ring'
import { Press, AnimatedNumber, spring } from '../ui/motion'
import { EntrySheet } from './EntrySheet'

export function Today() {
  const { openAdd } = useNav()
  const [date, setDate] = useState<DayKey>(dayKey())
  const [editing, setEditing] = useState<LogEntry | null>(null)

  const entries = useStore((s) => s.entries)
  const profile = useStore((s) => s.profile)
  const plan = usePlan()
  const water = useStore((s) => s.water[date] ?? 0)
  const waterGoal = useStore((s) => s.settings.waterGoal)
  const addWater = useStore((s) => s.addWater)
  const removeEntry = useStore((s) => s.removeEntry)

  const dayEntries = useMemo(() => entriesForDay(entries, date), [entries, date])
  const eaten = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const streak = useMemo(() => streakOf(entries), [entries])
  const insight = useMemo(() => dayInsight(eaten, plan, dayEntries.length), [eaten, plan, dayEntries.length])
  const days = useMemo(() => lastNDays(7), [])

  const left = plan.budget - eaten.kcal
  const over = left < 0

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{greeting()}</p>
          <h1 className="font-display truncate text-[27px] leading-tight font-extrabold tracking-tight">
            {profile.name.trim() ? profile.name.trim().split(' ')[0] : 'Welcome back'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {streak > 0 && (
            <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Flame size={15} className="text-brand-1" />
              <span className="tabular text-[13.5px] font-bold">{streak}</span>
              <span className="text-[12px] text-ink-3">day{streak > 1 ? 's' : ''}</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <DateStrip days={days} date={date} onPick={setDate} entries={entries} budget={plan.budget} />

      {/* Ring */}
      <section className="card relative overflow-hidden p-5">
        <div className="flex flex-col items-center">
          <Ring progress={plan.budget > 0 ? eaten.kcal / plan.budget : 0} over={over} size={230}>
            <div>
              <div className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{over ? 'over budget' : 'still to eat'}</div>
              <AnimatedNumber
                value={Math.abs(left)}
                className={`font-display block text-[52px] leading-none font-extrabold tracking-tight ${over ? 'text-warn' : ''}`}
              />
              <div className="tabular mt-1 text-[12.5px] text-ink-2">
                {fmt(eaten.kcal)} of {fmt(plan.budget)} kcal
              </div>
            </div>
          </Ring>

          <div className="mt-5 flex w-full gap-4">
            <MacroBar label="Protein" value={eaten.p} target={plan.protein} color="var(--protein)" />
            <MacroBar label="Carbs" value={eaten.c} target={plan.carbs} color="var(--carbs)" />
            <MacroBar label="Fat" value={eaten.f} target={plan.fat} color="var(--fat)" />
          </div>
        </div>
      </section>

      {/* Insight + water */}
      <section className="grid grid-cols-1 gap-3">
        <div className="card flex items-start gap-3 p-4">
          <span className="grad mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl text-white">
            <Lightbulb size={16} />
          </span>
          <p className="text-[14px] leading-relaxed text-ink-2">{insight.text}</p>
        </div>

        <div className="card flex items-center gap-4 p-4">
          <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line">
            <motion.div
              className="absolute inset-x-0 bottom-0 bg-[var(--water)]/35"
              animate={{ height: `${Math.min(100, (water / waterGoal) * 100)}%` }}
              transition={spring}
            />
            <Droplets size={20} className="relative text-[var(--water)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Water</div>
            <div className="tabular text-[15px] font-semibold">
              {(water / 1000).toFixed(2)} L <span className="text-[13px] font-normal text-ink-3">of {(waterGoal / 1000).toFixed(1)} L</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Press
              onTap={() => addWater(-250, date)}
              aria-label="Remove a glass of water"
              className="grid size-9 place-items-center rounded-full border border-line text-ink-2"
            >
              −
            </Press>
            <Press onTap={() => addWater(250, date)} aria-label="Add a glass of water" className="grad grid size-9 place-items-center rounded-full text-white">
              <Plus size={17} strokeWidth={2.8} />
            </Press>
          </div>
        </div>
      </section>

      {/* Meals */}
      <section className="space-y-3">
        {MEALS.map((meal) => {
          const items = dayEntries.filter((e) => e.meal === meal.id)
          const total = sumEntries(items).kcal
          return (
            <div key={meal.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
                <span className="text-[17px]">{meal.emoji}</span>
                <h2 className="font-display flex-1 text-[17px] font-bold tracking-tight">{meal.label}</h2>
                {total > 0 && <span className="tabular text-[13.5px] font-semibold text-ink-2">{fmt(total)} kcal</span>}
                <Press
                  onTap={() => openAdd(meal.id, date)}
                  aria-label={`Add to ${meal.label}`}
                  className="grid size-7 place-items-center rounded-full border border-line text-ink-2"
                >
                  <Plus size={15} strokeWidth={2.6} />
                </Press>
              </div>

              {items.length === 0 ? (
                <button onClick={() => openAdd(meal.id, date)} className="w-full px-4 pb-4 text-left text-[13.5px] text-ink-3">
                  Nothing here yet — tap to add
                </button>
              ) : (
                <ul className="px-2 pb-2">
                  <AnimatePresence initial={false}>
                    {items.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onOpen={() => setEditing(entry)}
                        onDelete={() => {
                          hapticSuccess()
                          removeEntry(entry.id)
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

/** One tap between dark and light. The three-way choice, including System, lives in You. */
function ThemeToggle() {
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <Press
      onTap={() => updateSettings({ theme: next })}
      aria-label={`Switch to ${next} mode`}
      className="glass grid size-9 place-items-center rounded-full text-ink-2"
    >
      <motion.span key={resolved} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} transition={spring}>
        {resolved === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </motion.span>
    </Press>
  )
}

function EntryRow({ entry, onOpen, onDelete }: { entry: LogEntry; onOpen: () => void; onDelete: () => void }) {
  const [dragging, setDragging] = useState(false)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
      transition={spring}
      className="relative overflow-hidden rounded-2xl"
    >
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center pr-5 text-danger"
        aria-hidden
        animate={{ opacity: dragging ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <Trash2 size={18} />
      </motion.div>
      <motion.button
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={{ left: 0.4, right: 0 }}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_, info) => {
          setDragging(false)
          if (info.offset.x < -95) onDelete()
        }}
        onClick={onOpen}
        className="relative flex w-full items-center gap-3 rounded-2xl bg-card-solid/70 px-2.5 py-2.5 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-[19px]">{entry.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{entry.name}</span>
          <span className="block truncate text-[12.5px] text-ink-3">{entry.portion}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-[15px] font-bold">{fmt(entry.kcal)}</span>
          <span className="block text-[11px] text-ink-3">kcal</span>
        </span>
      </motion.button>
    </motion.li>
  )
}

function DateStrip({
  days,
  date,
  onPick,
  entries,
  budget,
}: {
  days: DayKey[]
  date: DayKey
  onPick: (d: DayKey) => void
  entries: LogEntry[]
  budget: number
}) {
  const totals = useMemo(() => {
    const map = new Map<DayKey, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.kcal)
    return map
  }, [entries])

  const shift = (delta: number) => {
    haptic()
    onPick(addDays(date, delta))
  }

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <Press onTap={() => shift(-1)} aria-label="Previous day" className="grid size-7 place-items-center rounded-full text-ink-3">
          <ChevronLeft size={17} />
        </Press>
        <span className="text-[13.5px] font-semibold">{relativeDayLabel(date)}</span>
        <Press
          onTap={() => shift(1)}
          aria-label="Next day"
          disabled={date >= dayKey()}
          className="grid size-7 place-items-center rounded-full text-ink-3 disabled:opacity-30"
        >
          <ChevronRight size={17} />
        </Press>
      </div>
      <div className="flex justify-between gap-1">
        {days.map((day) => {
          const active = day === date
          const total = totals.get(day) ?? 0
          const pct = budget > 0 ? Math.min(1, total / budget) : 0
          return (
            <Press
              key={day}
              onTap={() => onPick(day)}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5"
              aria-label={relativeDayLabel(day)}
              aria-current={active ? 'date' : undefined}
            >
              {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-ink/8" transition={spring} />}
              <span className={`relative text-[10.5px] font-semibold ${active ? 'text-ink' : 'text-ink-3'}`}>
                {fromKey(day).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
              <span className={`tabular relative text-[14px] font-bold ${active ? 'text-ink' : 'text-ink-2'}`}>{fromKey(day).getDate()}</span>
              <span className="relative h-1 w-5 overflow-hidden rounded-full bg-line">
                <span className="grad block h-full rounded-full" style={{ width: `${pct * 100}%` }} />
              </span>
            </Press>
          )
        })}
      </div>
    </div>
  )
}
