import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { ChevronRight, CopyPlus, Droplet, Flame, Plus, Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNav } from '../App'
import { addDays, dayKey, fromKey, lastNDays, MEALS, mealForTime, relativeDayLabel, type DayKey, type Meal } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { dayInsight } from '../lib/insights'
import { entriesForDay, streakOf, sumEntries, usePlan, useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { Stepper } from '../ui/Controls'
import { IconTile, Row, Section } from '../ui/List'
import { MealIcon } from '../ui/MealIcon'
import { AnimatedNumber, Press, spring } from '../ui/motion'
import { AvatarButton, LargeTitle, NavBar, ThemeButton } from '../ui/Nav'
import { MacroBar, Ring } from '../ui/Ring'
import { useToast } from '../ui/Toast'
import { EntrySheet } from './EntrySheet'

export function Today() {
  const { openAdd, goTo, openYou } = useNav()
  const [date, setDate] = useState<DayKey>(dayKey())
  const [editing, setEditing] = useState<LogEntry | null>(null)

  const entries = useStore((s) => s.entries)
  const plan = usePlan()
  const water = useStore((s) => s.water[date] ?? 0)
  const waterGoal = useStore((s) => s.settings.waterGoal)
  const addWater = useStore((s) => s.addWater)
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const toast = useToast()

  const dayEntries = useMemo(() => entriesForDay(entries, date), [entries, date])
  const eaten = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const streak = useMemo(() => streakOf(entries), [entries])
  const insight = useMemo(() => dayInsight(eaten, plan, dayEntries.length), [eaten, plan, dayEntries.length])

  const today = dayKey()
  const isToday = date === today
  const title = isToday ? 'Today' : relativeDayLabel(date).split(',')[0]
  const left = plan.budget - eaten.kcal
  const over = left < 0

  return (
    <>
      <NavBar
        title={title}
        leading={
          !isToday && (
            <Press onTap={() => setDate(today)} className="glass rim flex h-11 items-center rounded-full px-4 text-[15px] font-semibold text-tint">
              Today
            </Press>
          )
        }
        trailing={
          <>
            <ThemeButton />
            <AvatarButton onTap={openYou} />
          </>
        }
      />

      <LargeTitle
        kicker={fromKey(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        accessory={
          streak > 0 && (
            <span className="mb-1.5 flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3 text-[15px] font-semibold">
              <Flame size={16} className="text-[#ff9500]" fill="#ff9500" />
              <span className="tabular">{streak}</span>
              <span className="sr-only">day streak</span>
            </span>
          )
        }
      >
        {title}
      </LargeTitle>

      <WeekStrip date={date} onPick={setDate} entries={entries} budget={plan.budget} />

      {/* Summary */}
      <section className="surface mt-3 p-5">
        <div className="flex items-center gap-5">
          <Ring progress={plan.budget > 0 ? eaten.kcal / plan.budget : 0} over={over} size={148} stroke={16}>
            <div>
              <AnimatedNumber value={Math.abs(left)} className={`font-rounded block text-[34px] leading-none font-bold ${over ? 'text-warn' : ''}`} />
              <div className="mt-1 text-[13px] font-semibold text-ink-3">{over ? 'over' : 'left'}</div>
            </div>
          </Ring>
          <dl className="min-w-0 flex-1 space-y-3">
            <Figure label="Eaten" value={eaten.kcal} />
            <Figure label="Budget" value={plan.budget} />
          </dl>
        </div>
        <div className="mt-5 flex gap-4">
          <MacroBar label="Protein" value={eaten.p} target={plan.protein} color="var(--protein)" />
          <MacroBar label="Carbs" value={eaten.c} target={plan.carbs} color="var(--carbs)" />
          <MacroBar label="Fat" value={eaten.f} target={plan.fat} color="var(--fat)" />
        </div>
      </section>

      {/* Coach + water */}
      <Section className="mt-4" inset={58}>
        <Row
          icon={
            <IconTile color="var(--tint-fill)">
              <Sparkles size={17} strokeWidth={2.3} />
            </IconTile>
          }
          title="Ask the coach"
          subtitle={<span className="mt-0.5 block text-[15px] leading-snug text-ink-2">{insight.text}</span>}
          accessory="chevron"
          onTap={() => goTo('coach')}
        />
        <Row
          icon={
            <IconTile color="#0a84ff">
              <Droplet size={17} strokeWidth={2.3} fill="currentColor" />
            </IconTile>
          }
          title="Water"
          subtitle={
            <span className="tabular">
              {(water / 1000).toFixed(2)} of {(waterGoal / 1000).toFixed(1)} L
            </span>
          }
          accessory={<Stepper value={water} onChange={(v) => addWater(v - water, date)} step={250} min={0} max={8000} showValue={false} label="water" />}
        />
      </Section>

      <LogAgain date={date} />

      {/* Meals */}
      <div className="mt-6 space-y-6">
        {MEALS.map((meal) => {
          const items = dayEntries.filter((e) => e.meal === meal.id)
          const total = sumEntries(items).kcal
          return (
            <section key={meal.id}>
              <div className="mb-2 flex items-center gap-2.5 px-1">
                <MealIcon meal={meal.id} size={28} />
                <h2 className="flex-1 text-[22px] leading-tight font-bold">{meal.label}</h2>
                {total > 0 && <span className="tabular text-[15px] text-ink-3">{fmt(total)} kcal</span>}
                <Press
                  onTap={() => openAdd(meal.id, date)}
                  aria-label={`Add to ${meal.label}`}
                  scale={0.88}
                  className="-my-1 -mr-1 grid size-11 place-items-center rounded-full text-tint"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-fill">
                    <Plus size={19} strokeWidth={2.6} />
                  </span>
                </Press>
              </div>

              <div className="ios-list overflow-hidden rounded-[24px] bg-surface" style={{ ['--sep-inset' as string]: items.length ? '68px' : '58px' }}>
                {items.length === 0 ? (
                  <>
                    <Row
                      icon={
                        <span className="grid size-[30px] place-items-center text-tint">
                          <Plus size={20} strokeWidth={2.4} />
                        </span>
                      }
                      title={`Add ${meal.label.toLowerCase()}`}
                      action
                      onTap={() => openAdd(meal.id, date)}
                    />
                    <CopyYesterday date={date} meal={meal.id} label={meal.label} />
                  </>
                ) : (
                  <AnimatePresence initial={false}>
                    {items.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onOpen={() => setEditing(entry)}
                        onDelete={() => {
                          hapticSuccess()
                          removeEntry(entry.id)
                          toast(`${entry.name} deleted`, 'default', { label: 'Undo', onAction: () => restoreEntry(entry) })
                        }}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
      <dd className="font-rounded tabular text-[24px] leading-tight font-semibold">
        <AnimatedNumber value={value} />
        <span className="ml-1 text-[15px] font-medium text-ink-3">kcal</span>
      </dd>
    </div>
  )
}

/* ── Week strip ──────────────────────────────────────────────────────── */

/** A week of mini rings, as in Fitness. Swipe sideways for other weeks. */
function WeekStrip({ date, onPick, entries, budget }: { date: DayKey; onPick: (d: DayKey) => void; entries: LogEntry[]; budget: number }) {
  const today = dayKey()
  const [end, setEnd] = useState<DayKey>(today)
  const days = useMemo(() => lastNDays(7, end), [end])
  const totals = useMemo(() => {
    const map = new Map<DayKey, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.kcal)
    return map
  }, [entries])

  const page = (delta: number) => {
    const next = addDays(end, delta * 7)
    if (next > today) {
      if (end === today) return
      setEnd(today)
    } else setEnd(next)
    haptic()
  }

  return (
    <motion.div
      className="flex touch-pan-y justify-between gap-1"
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => {
        if (info.offset.x > 60) page(-1)
        else if (info.offset.x < -60) page(1)
      }}
    >
      {days.map((day) => {
        const active = day === date
        const total = totals.get(day) ?? 0
        const d = fromKey(day)
        return (
          <Press
            key={day}
            onTap={() => onPick(day)}
            scale={0.9}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1"
            aria-label={relativeDayLabel(day)}
            aria-current={active ? 'date' : undefined}
          >
            <span className={`text-[13px] font-semibold ${active ? 'text-tint' : 'text-ink-3'}`}>
              {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
            <span className="relative grid place-items-center">
              <Ring progress={budget > 0 ? total / budget : 0} over={total > budget} size={38} stroke={4.5} />
              <span
                className={`tabular absolute grid size-[24px] place-items-center rounded-full text-[13px] font-semibold ${
                  active ? 'bg-tint text-white dark:text-black' : day === today ? 'text-tint' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </span>
            </span>
          </Press>
        )
      })}
    </motion.div>
  )
}

/* ── Rows ────────────────────────────────────────────────────────────── */

const ACTION_WIDTH = 88

/** A logged item. Swipe left for Delete, or all the way to delete straight away. */
function EntryRow({ entry, onOpen, onDelete }: { entry: LogEntry; onOpen: () => void; onDelete: () => void }) {
  const x = useMotionValue(0)
  const reveal = useTransform(x, (v) => Math.max(0, -v))
  const [open, setOpen] = useState(false)
  const dragged = useRef(false)

  const settle = (to: number) => {
    animate(x, to, { type: 'spring', stiffness: 500, damping: 42 })
    setOpen(to !== 0)
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
      transition={spring}
      className="relative overflow-hidden"
    >
      <motion.button
        tabIndex={open ? 0 : -1}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden bg-danger text-[17px] font-semibold text-white"
        style={{ width: reveal }}
      >
        <span className="w-[88px] shrink-0 text-center">Delete</span>
      </motion.button>
      <motion.button
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={{ left: 0.7, right: 0.05 }}
        dragMomentum={false}
        style={{ x }}
        onDragStart={() => {
          dragged.current = true
        }}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 0)
          if (info.offset.x < -210) {
            animate(x, -window.innerWidth, { duration: 0.2 })
            onDelete()
          } else if (x.get() < -ACTION_WIDTH / 2) {
            haptic(6)
            settle(-ACTION_WIDTH)
          } else settle(0)
        }}
        onClick={() => {
          if (dragged.current) return
          if (open) settle(0)
          else onOpen()
        }}
        aria-label={`${entry.name}, ${entry.portion}, ${fmt(entry.kcal)} kilocalories. Opens details.`}
        className="relative flex min-h-[64px] w-full items-center gap-3 bg-surface px-4 py-2.5 text-left active:bg-surface-2"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-fill text-[21px]" aria-hidden>
          {entry.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] leading-[22px]">{entry.name}</span>
          <span className="block truncate text-[15px] leading-[20px] text-ink-3">{entry.portion}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="font-rounded tabular block text-[17px] leading-[22px] font-semibold">{fmt(entry.kcal)}</span>
          <span className="block text-[13px] leading-[18px] text-ink-3">kcal</span>
        </span>
      </motion.button>
    </motion.div>
  )
}

/** Things you log often, one tap away. */
function LogAgain({ date }: { date: DayKey }) {
  const entries = useStore((s) => s.entries)
  const addEntries = useStore((s) => s.addEntries)
  const removeEntries = useStore((s) => s.removeEntries)
  const toast = useToast()

  const favourites = useMemo(() => {
    const counts = new Map<string, { entry: LogEntry; count: number }>()
    for (const entry of entries) {
      const key = `${entry.name}|${entry.portion}`
      const found = counts.get(key)
      if (found) found.count++
      else counts.set(key, { entry, count: 1 })
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || b.entry.createdAt - a.entry.createdAt)
      .slice(0, 10)
      .map((c) => c.entry)
  }, [entries])

  if (favourites.length < 2) return null

  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-[22px] leading-tight font-bold">Log again</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {favourites.map((entry) => (
          <Press
            key={entry.id}
            scale={0.94}
            onTap={() => {
              const { id: _id, createdAt: _createdAt, ...rest } = entry
              const meal: Meal = mealForTime()
              const [added] = addEntries([{ ...rest, date, meal }])
              hapticSuccess()
              toast(`${entry.name} added to ${MEALS.find((m) => m.id === meal)?.label.toLowerCase()}`, 'success', {
                label: 'Undo',
                onAction: () => removeEntries([added.id]),
              })
            }}
            className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-surface py-2 pr-4 pl-3"
          >
            <span className="text-[18px] leading-none" aria-hidden>
              {entry.emoji}
            </span>
            <span className="max-w-[10rem] truncate text-[15px] font-medium">{entry.name}</span>
            <span className="tabular text-[13px] text-ink-3">{fmt(entry.kcal)}</span>
          </Press>
        ))}
      </div>
    </section>
  )
}

/** Yesterday's version of this meal, copied in one tap. */
function CopyYesterday({ date, meal, label }: { date: DayKey; meal: Meal; label: string }) {
  const entries = useStore((s) => s.entries)
  const addEntries = useStore((s) => s.addEntries)
  const removeEntries = useStore((s) => s.removeEntries)
  const toast = useToast()

  const yesterday = useMemo(() => entries.filter((e) => e.date === addDays(date, -1) && e.meal === meal), [entries, date, meal])
  if (!yesterday.length) return null
  const total = sumEntries(yesterday).kcal

  return (
    <Row
      icon={
        <span className="grid size-[30px] place-items-center text-tint">
          <CopyPlus size={19} strokeWidth={2.2} />
        </span>
      }
      title={`Same as yesterday`}
      action
      detail={<span className="tabular text-[15px]">{fmt(total)} kcal</span>}
      onTap={() => {
        const added = addEntries(yesterday.map(({ id: _id, createdAt: _createdAt, ...rest }) => ({ ...rest, date })))
        hapticSuccess()
        toast(`Yesterday's ${label.toLowerCase()} copied`, 'success', { label: 'Undo', onAction: () => removeEntries(added.map((e) => e.id)) })
      }}
      accessory={<ChevronRight size={18} className="text-ink-4" />}
    />
  )
}
