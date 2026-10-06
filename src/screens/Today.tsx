import { animate, AnimatePresence, motion, useMotionValue, useScroll, useTransform, type Variants } from 'motion/react'
import { BookmarkPlus, ChevronRight, CopyPlus, Droplet, Flame, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../App'
import { addDays, dayKey, dayPhrase, fromKey, MEALS, mealForTime, relativeDayLabel, type DayKey, type Meal } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { dayInsight } from '../lib/insights'
import { entriesForDay, streakOf, sumEntries, usePlan, useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { useContextMenu, useLongPress } from '../ui/ContextMenu'
import { Row } from '../ui/List'
import { MealIcon } from '../ui/MealIcon'
import { AnimatedNumber, Press } from '../ui/motion'
import { AvatarButton, LargeTitle, NavBar, ThemeButton } from '../ui/Nav'
import { MacroBar, Ring } from '../ui/Ring'
import { useToast } from '../ui/Toast'
import { EntrySheet } from './EntrySheet'

/** Monday of the week a day falls in. */
function weekStart(key: DayKey): DayKey {
  const d = fromKey(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dayKey(d)
}

/** Width of an element, kept current. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

// Enter on a spring; leave quickly, so the old day never lingers under the new one.
const slide: Variants = {
  enter: (dir: number) => ({ x: dir * 64, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { x: { type: 'spring', stiffness: 420, damping: 40, restDelta: 0.5 } as const, opacity: { duration: 0.2 } } },
  exit: (dir: number) => ({ x: dir * -64, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
}

export function Today() {
  const { openAdd, goTo, openYou, viewDate: date, setViewDate } = useNav()
  const [dir, setDir] = useState(1)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  // Cards rise in when the screen appears, not again on every change of day.
  const firstPaint = useRef(true)
  useEffect(() => {
    firstPaint.current = false
  }, [])

  const entries = useStore((s) => s.entries)
  const plan = usePlan()
  const streak = useMemo(() => streakOf(entries), [entries])
  const totals = useMemo(() => {
    const map = new Map<DayKey, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.kcal)
    return map
  }, [entries])

  const today = dayKey()
  const isToday = date === today
  const title = isToday ? 'Today' : relativeDayLabel(date).split(',')[0]

  /** Changes the day, sliding the content the way the gesture went. */
  const goToDay = (next: DayKey) => {
    const clamped = next > today ? today : next
    if (clamped === date) return
    setDir(clamped > date ? 1 : -1)
    setViewDate(clamped)
  }

  return (
    <>
      <NavBar
        title={title}
        leading={
          !isToday && (
            <Press onTap={() => goToDay(today)} scale={1.08} className="glass rim flex h-11 items-center rounded-full px-4 text-[15px] font-semibold text-tint">
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
            <span className="surface mb-1.5 flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[15px] font-semibold">
              <Flame size={16} className="text-[#ff9500]" fill="#ff9500" />
              <span className="tabular">{streak}</span>
              <span className="sr-only">day streak</span>
            </span>
          )
        }
      >
        {title}
      </LargeTitle>

      <WeekStrip date={date} onPick={goToDay} totals={totals} budget={plan.budget} />

      <div className="relative mt-3">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={date}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <DayView
              rise={firstPaint.current}
              date={date}
              onSwipeDay={(delta) => goToDay(addDays(date, delta))}
              onAdd={(meal) => openAdd(meal, date)}
              onCoach={() => goTo('coach')}
              onEdit={setEditing}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </>
  )
}

/* ── One day ─────────────────────────────────────────────────────────── */

function DayView({
  rise,
  date,
  onSwipeDay,
  onAdd,
  onCoach,
  onEdit,
}: {
  rise: boolean
  date: DayKey
  onSwipeDay: (delta: number) => void
  onAdd: (meal: Meal) => void
  onCoach: () => void
  onEdit: (entry: LogEntry) => void
}) {
  const entries = useStore((s) => s.entries)
  const plan = usePlan()
  const removeEntry = useStore((s) => s.removeEntry)
  const restoreEntry = useStore((s) => s.restoreEntry)
  const toast = useToast()

  const dayEntries = useMemo(() => entriesForDay(entries, date), [entries, date])
  const eaten = useMemo(() => sumEntries(dayEntries), [dayEntries])
  const insight = useMemo(() => dayInsight(eaten, plan, dayEntries.length), [eaten, plan, dayEntries.length])
  const nowMeal = date === dayKey() ? mealForTime() : null

  const remove = (entry: LogEntry) => {
    hapticSuccess()
    removeEntry(entry.id)
    toast(`${entry.name} deleted`, 'default', { label: 'Undo', onAction: () => restoreEntry(entry) })
  }

  return (
    <div className={`space-y-3 ${rise ? '' : '[&_.rise]:animate-none'}`}>
      <Hero eaten={eaten} plan={plan} onSwipe={onSwipeDay} canGoForward={date < dayKey()} />

      <div className="grid grid-cols-2 gap-3">
        <CoachTile text={insight.text} onTap={onCoach} />
        <WaterTile date={date} />
      </div>

      <LogAgain date={date} />

      <div className="space-y-3 pt-3">
        {MEALS.map((meal, i) => {
          const items = dayEntries.filter((e) => e.meal === meal.id)
          const total = sumEntries(items).kcal
          return (
            <section key={meal.id} className="surface rise overflow-hidden" style={{ ['--i' as string]: i + 2 }}>
              <div className="flex items-center gap-2.5 py-2 pr-2 pl-4">
                <MealIcon meal={meal.id} size={30} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <h2 className="truncate text-[20px] leading-tight font-bold">{meal.label}</h2>
                  {nowMeal === meal.id && <span className="shrink-0 rounded-full bg-tint-soft px-2 py-0.5 text-[12px] font-semibold text-tint">Now</span>}
                </span>
                {total > 0 && <span className="tabular shrink-0 text-[15px] whitespace-nowrap text-ink-3">{fmt(total)} kcal</span>}
                <Press onTap={() => onAdd(meal.id)} aria-label={`Add to ${meal.label}`} scale={0.86} className="grid size-11 place-items-center rounded-full text-tint">
                  <span className="grid size-9 place-items-center rounded-full bg-fill">
                    <Plus size={19} strokeWidth={2.6} />
                  </span>
                </Press>
              </div>

              <div className="ios-list" style={{ ['--sep-inset' as string]: items.length ? '68px' : '58px' }}>
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
                      onTap={() => onAdd(meal.id)}
                    />
                    <CopyYesterday date={date} meal={meal.id} label={meal.label} />
                  </>
                ) : (
                  <AnimatePresence initial={false}>
                    {items.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onOpen={() => onEdit(entry)} onDelete={() => remove(entry)} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** The day at a glance. Swipe it sideways to move between days. */
function Hero({ eaten, plan, onSwipe, canGoForward }: { eaten: { kcal: number; p: number; c: number; f: number }; plan: ReturnType<typeof usePlan>; onSwipe: (delta: number) => void; canGoForward: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const left = plan.budget - eaten.kcal
  const over = left < 0
  const ring = Math.round(Math.min(156, Math.max(118, (width - 40) * 0.46)))
  // A gentle settle as the card scrolls under the bar.
  const { scrollY } = useScroll()
  const scale = useTransform(scrollY, [0, 260], [1, 0.965])

  return (
    <motion.section
      ref={ref}
      className="surface rise relative touch-pan-y overflow-hidden p-5"
      style={{ scale, ['--i' as string]: 0 }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: canGoForward ? 0.35 : 0.08, right: 0.35 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -56 || info.velocity.x < -500) {
          if (canGoForward) onSwipe(1)
        } else if (info.offset.x > 56 || info.velocity.x > 500) onSwipe(-1)
      }}
      aria-label={`${fmt(Math.abs(left))} kilocalories ${over ? 'over budget' : 'left'}. Swipe for other days.`}
    >
      {/* A soft light behind the ring, warm when over budget. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-16 size-72 rounded-full opacity-70"
        style={{ background: `radial-gradient(closest-side, ${over ? 'rgba(255,149,0,0.28)' : 'rgba(15,179,122,0.24)'}, transparent)` }}
      />
      <div className="relative flex items-center gap-5">
        <Ring progress={plan.budget > 0 ? eaten.kcal / plan.budget : 0} over={over} size={ring} stroke={16}>
          <div>
            <AnimatedNumber value={Math.abs(left)} className={`font-rounded block text-[34px] leading-none font-bold ${over ? 'text-warn' : ''}`} />
            <div className="mt-1 text-[13px] font-semibold text-ink-3">{over ? 'kcal over' : 'kcal left'}</div>
          </div>
        </Ring>
        <dl className="min-w-0 flex-1 space-y-3">
          <Figure label="Eaten" value={eaten.kcal} />
          <Figure label="Budget" value={plan.budget} />
        </dl>
      </div>
      <div className="relative mt-5 flex gap-4">
        <MacroBar label="Protein" value={eaten.p} target={plan.protein} color="var(--protein)" />
        <MacroBar label="Carbs" value={eaten.c} target={plan.carbs} color="var(--carbs)" />
        <MacroBar label="Fat" value={eaten.f} target={plan.fat} color="var(--fat)" />
      </div>
    </motion.section>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
      <dd className="font-rounded tabular truncate text-[24px] leading-tight font-semibold">
        <AnimatedNumber value={value} />
        <span className="ml-1 text-[15px] font-medium text-ink-3">kcal</span>
      </dd>
    </div>
  )
}

function CoachTile({ text, onTap }: { text: string; onTap: () => void }) {
  return (
    <Press onTap={onTap} scale={0.97} className="surface rise flex min-h-[164px] flex-col p-4 text-left" style={{ ['--i' as string]: 1 }} aria-label={`Ask the coach. ${text}`}>
      <span className="flex items-center gap-2">
        <span className="grad grid size-8 place-items-center rounded-[10px] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]">
          <Sparkles size={17} strokeWidth={2.3} />
        </span>
        <span className="flex-1 text-[15px] font-semibold">Coach</span>
        <ChevronRight size={17} className="text-ink-4" />
      </span>
      <span className="mt-2.5 line-clamp-4 text-[15px] leading-[20px] text-ink-2">{text}</span>
    </Press>
  )
}

/** Water, as a glass that fills. The wave only moves sideways, on the compositor. */
function WaterTile({ date }: { date: DayKey }) {
  const water = useStore((s) => s.water[date] ?? 0)
  const goal = useStore((s) => s.settings.waterGoal)
  const addWater = useStore((s) => s.addWater)
  const pct = Math.min(1, goal > 0 ? water / goal : 0)

  const bump = (ml: number) => {
    haptic(ml > 0 ? 8 : 5)
    addWater(ml, date)
  }

  return (
    <section className="surface rise relative flex min-h-[164px] flex-col overflow-hidden p-4" style={{ ['--i' as string]: 1 }} aria-label={`Water, ${(water / 1000).toFixed(2)} of ${(goal / 1000).toFixed(1)} litres`}>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ y: `${(1 - pct) * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        <svg className="wave absolute -top-[10px] left-0 h-[12px] w-[200%]" viewBox="0 0 200 12" preserveAspectRatio="none">
          <path d="M0 6 Q 12.5 0 25 6 T 50 6 T 75 6 T 100 6 T 125 6 T 150 6 T 175 6 T 200 6 V 12 H 0 Z" fill="color-mix(in srgb, var(--water) 26%, transparent)" />
        </svg>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--water) 26%, transparent), color-mix(in srgb, var(--water) 36%, transparent))' }} />
      </motion.div>

      <span className="relative flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-[10px] bg-[#0a84ff] text-white">
          <Droplet size={16} strokeWidth={2.4} fill="currentColor" />
        </span>
        <span className="text-[15px] font-semibold">Water</span>
      </span>
      <span className="relative mt-2">
        <span className="font-rounded tabular text-[26px] leading-none font-bold">{(water / 1000).toFixed(2)}</span>
        <span className="text-[15px] font-semibold text-ink-3"> L</span>
        <span className="block text-[13px] text-ink-3">of {(goal / 1000).toFixed(1)} L</span>
      </span>
      <span className="relative mt-auto flex h-[34px] items-center self-start rounded-full bg-fill">
        <button aria-label="Remove a glass of water" onClick={() => bump(-250)} disabled={water <= 0} className="grid h-11 w-11 place-items-center text-ink active:opacity-40 disabled:opacity-30">
          <span className="text-[22px] leading-none">−</span>
        </button>
        <span className="h-[18px] w-[0.5px] bg-separator" aria-hidden />
        <button aria-label="Add a glass of water" onClick={() => bump(250)} className="grid h-11 w-11 place-items-center text-ink active:opacity-40">
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </span>
    </section>
  )
}

/* ── Week strip ──────────────────────────────────────────────────────── */

/**
 * A calendar week of mini rings, as in Fitness. Swipe left for the next week
 * and right for the one before; the new week slides in from the side the
 * finger moved toward, and the selected day moves with it.
 */
function WeekStrip({ date, onPick, totals, budget }: { date: DayKey; onPick: (d: DayKey) => void; totals: Map<DayKey, number>; budget: number }) {
  const today = dayKey()
  const [anchor, setAnchor] = useState(() => weekStart(date))
  const [ref, width] = useWidth<HTMLDivElement>()
  const x = useMotionValue(0)
  const settling = useRef(false)
  const dragged = useRef(false)
  const canNext = addDays(anchor, 7) <= today

  const page = (dir: 1 | -1, moveSelection = true) => {
    if (settling.current) return
    if (dir === 1 && !canNext) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
      return
    }
    settling.current = true
    haptic()
    animate(x, -dir * width, { type: 'spring', stiffness: 360, damping: 40, restDelta: 0.5 }).then(() => {
      setAnchor((a) => addDays(a, dir * 7))
      if (moveSelection) onPick(addDays(date, dir * 7))
    })
  }

  // After the pages shift, put the track back without a visible jump.
  useLayoutEffect(() => {
    if (!settling.current) return
    x.set(0)
    settling.current = false
  }, [anchor, x])

  // Follow the selected day when it moves to another week some other way.
  useEffect(() => {
    if (settling.current) return
    const target = weekStart(date)
    if (target === anchor) return
    if (target === addDays(anchor, 7) && width) page(1, false)
    else if (target === addDays(anchor, -7) && width) page(-1, false)
    else setAnchor(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const weeks = [-1, 0, 1].map((offset) => addDays(anchor, offset * 7))

  return (
    <div ref={ref} data-pager className="-mx-1 overflow-hidden">
      {width > 0 && (
        <motion.div
          className="flex touch-pan-y"
          style={{ x, width: width * 3, marginLeft: -width }}
          drag="x"
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={{ left: canNext ? -width : 0, right: width }}
          dragElastic={0.12}
          onDragStart={() => {
            dragged.current = true
          }}
          onDragEnd={(_, info) => {
            setTimeout(() => (dragged.current = false), 0)
            if (info.offset.x < -width * 0.18 || info.velocity.x < -380) page(1)
            else if (info.offset.x > width * 0.18 || info.velocity.x > 380) page(-1)
            else animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
          }}
        >
          {weeks.map((start) => (
            <div key={start} className="flex shrink-0 justify-between px-1" style={{ width }}>
              {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((day) => {
                const future = day > today
                const active = day === date
                const total = totals.get(day) ?? 0
                const d = fromKey(day)
                return (
                  <Press
                    key={day}
                    onTap={() => !dragged.current && !future && onPick(day)}
                    disabled={future}
                    scale={0.9}
                    className="flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1 disabled:opacity-35"
                    aria-label={relativeDayLabel(day)}
                    aria-current={active ? 'date' : undefined}
                  >
                    <span className={`text-[13px] font-semibold ${day === today ? 'text-tint' : 'text-ink-3'}`}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    <span className="relative grid place-items-center">
                      <Ring progress={future || budget <= 0 ? 0 : total / budget} over={total > budget} size={38} stroke={4.5} />
                      <span
                        className={`tabular absolute grid size-[25px] place-items-center rounded-full text-[13px] font-semibold transition-colors ${
                          active ? 'bg-tint text-white dark:text-black' : day === today ? 'text-tint' : 'text-ink'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </span>
                  </Press>
                )
              })}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

/* ── Rows ────────────────────────────────────────────────────────────── */

const ACTION_WIDTH = 88

/** How a logged item looks; shared by the row and its long-press preview. */
function EntryFace({ entry }: { entry: LogEntry }) {
  return (
    <>
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
    </>
  )
}

/** A logged item. Swipe left for Delete (or all the way), hold for more. */
function EntryRow({ entry, onOpen, onDelete }: { entry: LogEntry; onOpen: () => void; onDelete: () => void }) {
  const x = useMotionValue(0)
  const reveal = useTransform(x, (v) => Math.max(0, -v))
  const [open, setOpen] = useState(false)
  const dragged = useRef(false)
  const openMenu = useContextMenu()
  const addEntries = useStore((s) => s.addEntries)
  const removeEntries = useStore((s) => s.removeEntries)
  const saveFood = useStore((s) => s.saveFood)
  const toast = useToast()

  const longPress = useLongPress((el) => {
    openMenu({
      rect: el.getBoundingClientRect(),
      preview: (
        <div className="glass-thick flex size-full items-center gap-3 rounded-[20px] px-4">
          <EntryFace entry={entry} />
        </div>
      ),
      actions: [
        { label: 'Edit', icon: Pencil, onSelect: onOpen },
        {
          label: 'Log again',
          icon: CopyPlus,
          onSelect: () => {
            const { id: _id, createdAt: _c, ...rest } = entry
            const added = addEntries([rest])
            hapticSuccess()
            toast(`${entry.name} logged again`, 'success', { label: 'Undo', onAction: () => removeEntries(added.map((e) => e.id)) })
          },
        },
        {
          label: 'Save to My Foods',
          icon: BookmarkPlus,
          onSelect: () => {
            saveFood({ name: entry.name, emoji: entry.emoji, portion: entry.portion, macros: { kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f } })
            toast('Saved to My Foods', 'success')
          },
        },
        { label: 'Delete', icon: Trash2, destructive: true, onSelect: onDelete },
      ],
    })
  })

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
        {...longPress.handlers}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={{ left: 0.7, right: 0.05 }}
        dragMomentum={false}
        style={{ x, WebkitTouchCallout: 'none' }}
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
          if (dragged.current || longPress.fired.current) return
          if (open) settle(0)
          else onOpen()
        }}
        aria-label={`${entry.name}, ${entry.portion}, ${fmt(entry.kcal)} kilocalories. Opens details; hold for more.`}
        className="relative flex min-h-[64px] w-full touch-pan-y items-center gap-3 px-4 py-2.5 text-left transition-colors select-none active:bg-fill"
      >
        <EntryFace entry={entry} />
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
    <section className="rise pt-3" style={{ ['--i' as string]: 2 }}>
      <h2 className="mb-2 px-1 text-[20px] leading-tight font-bold">Log again</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        {favourites.map((entry) => (
          <Press
            key={entry.id}
            scale={0.94}
            onTap={() => {
              const { id: _id, createdAt: _createdAt, ...rest } = entry
              const meal: Meal = date === dayKey() ? mealForTime() : entry.meal
              const [added] = addEntries([{ ...rest, date, meal }])
              hapticSuccess()
              toast(`${entry.name} added to ${MEALS.find((m) => m.id === meal)?.label.toLowerCase()}${date === dayKey() ? '' : `, ${dayPhrase(date)}`}`, 'success', {
                label: 'Undo',
                onAction: () => removeEntries([added.id]),
              })
            }}
            className="surface flex min-h-[44px] shrink-0 items-center gap-2 rounded-full py-2 pr-4 pl-3"
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
      title="Same as the day before"
      action
      detail={<span className="tabular text-[15px]">{fmt(total)} kcal</span>}
      onTap={() => {
        const added = addEntries(yesterday.map(({ id: _id, createdAt: _createdAt, ...rest }) => ({ ...rest, date })))
        hapticSuccess()
        toast(`${label} copied from the day before`, 'success', { label: 'Undo', onAction: () => removeEntries(added.map((e) => e.id)) })
      }}
      accessory={<ChevronRight size={18} className="text-ink-4" />}
    />
  )
}

