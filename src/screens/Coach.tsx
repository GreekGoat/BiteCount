import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUp,
  Check,
  CircleCheck,
  CircleX,
  ListPlus,
  Mic,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Square,
  SquarePen,
  TrendingUp,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../App'
import type { AiTurn, CoachResultData, CoachSuggestionData } from '../food/ai'
import { providerInfo } from '../food/ai-models'
import { buildCoachContext } from '../lib/coach'
import { addDays, dayKey, MEALS, mealForTime, type Meal } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { speechSupported, startDictation, type Dictation } from '../lib/speech'
import { entriesForDay, sumEntries, useAiSettings, usePlan, useStore, type CoachMessage } from '../lib/store'
import { fmt } from '../lib/units'
import { useViewport } from '../lib/viewport'
import { MealIcon } from '../ui/MealIcon'
import { Press, spring } from '../ui/motion'
import { AvatarButton, GlassButton } from '../ui/Nav'
import { Countdown } from '../ui/Countdown'
import { useToast } from '../ui/Toast'

/*
 * The coach. Tell it what you ate — one thing or the whole day — and it logs it
 * by meal. Ask what to eat next, or whether something fits, and it answers from
 * today's log and your plan.
 */

type LogItem = CoachResultData['log_items'][number]

const STARTERS: { icon: typeof Utensils; label: string; fill?: string; send?: string }[] = [
  { icon: ListPlus, label: 'Log everything I ate today', fill: 'Breakfast was ' },
  { icon: Utensils, label: 'What should I eat next?', send: 'Based on what I have eaten so far, what should I eat next to hit my numbers today?' },
  { icon: Scale, label: 'Should I eat…?', fill: 'Should I eat ' },
  { icon: TrendingUp, label: 'How am I doing today?', send: 'How am I doing today?' },
]

const round1 = (n: number) => Math.round(n * 10) / 10
const macrosOf = (item: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) => ({
  kcal: Math.max(0, Math.round(item.kcal)),
  p: Math.max(0, round1(item.protein_g)),
  c: Math.max(0, round1(item.carbs_g)),
  f: Math.max(0, round1(item.fat_g)),
})
const mealLabel = (meal: Meal) => MEALS.find((m) => m.id === meal)?.label ?? meal

export function Coach() {
  const { openYou, goTo } = useNav()
  const ai = useAiSettings()
  const plan = usePlan()
  const coach = useStore((s) => s.coach)
  const entries = useStore((s) => s.entries)
  const addCoachMessage = useStore((s) => s.addCoachMessage)
  const removeCoachMessage = useStore((s) => s.removeCoachMessage)
  const updateCoachMessage = useStore((s) => s.updateCoachMessage)
  const clearCoach = useStore((s) => s.clearCoach)
  const addEntries = useStore((s) => s.addEntries)
  const toast = useToast()

  const today = dayKey()
  const messages = coach.date === today ? coach.messages : []
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [waitUntil, setWaitUntil] = useState<number | null>(null)
  const viewport = useViewport(true)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  const eaten = useMemo(() => sumEntries(entriesForDay(entries, today)), [entries, today])

  // Stay pinned to the newest message, including when the keyboard takes space away.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? 'smooth' : 'auto' })
  }, [messages.length, busy, viewport.height])

  // Yesterday's conversation does not carry over.
  useEffect(() => {
    if (coach.date !== today && coach.messages.length) clearCoach()
  }, [coach.date, coach.messages.length, today, clearCoach])

  const logItems = (items: LogItem[], unsure: Meal): string[] => {
    const created = addEntries(
      items.map((item) => ({
        date: item.day === 'yesterday' ? addDays(dayKey(), -1) : dayKey(),
        meal: item.meal === 'unspecified' ? unsure : item.meal,
        name: item.name,
        emoji: item.emoji || '🍽️',
        portion: `${item.portion}${item.grams ? ` · ${Math.round(item.grams)} g` : ''}`,
        ...macrosOf(item),
        source: 'ai' as const,
      })),
    )
    return created.map((e) => e.id)
  }

  const ask = async () => {
    const state = useStore.getState()
    const history: AiTurn[] = state.coach.messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))
    const context = buildCoachContext({ now: new Date(), profile: state.profile, plan, entries: state.entries })
    setBusy(true)
    try {
      const { askCoach } = await import('../food/ai')
      const result = await askCoach({ provider: ai.provider, key: ai.key, model: ai.model, proxyUrl: ai.proxyUrl }, history, context, {
        onWait: (seconds) => setWaitUntil(Date.now() + seconds * 1000),
      })
      const unsure = mealForTime()
      // Food they say they ate is logged straight away; the card offers undo.
      const logged = result.intent === 'log' && result.log_items.length ? logItems(result.log_items, unsure) : undefined
      addCoachMessage({ role: 'assistant', text: result.reply, result, logged, unsure })
      if (logged) hapticSuccess()
      else haptic()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      const hint = error && typeof error === 'object' && 'hint' in error ? (error as { hint?: string }).hint : undefined
      addCoachMessage({ role: 'assistant', text: hint ? `${message} ${hint}` : message, error: true })
    } finally {
      setBusy(false)
      setWaitUntil(null)
    }
  }

  const send = (raw: string) => {
    const message = raw.trim()
    if (!message || busy) return
    setText('')
    addCoachMessage({ role: 'user', text: message })
    if (!ai.ready) {
      addCoachMessage({
        role: 'assistant',
        text: 'I need an AI key to chat. Add your Groq key in You → AI, and I can log whole days and answer questions. The + button still logs food offline.',
        error: true,
      })
      return
    }
    void ask()
  }

  const retry = (failed: CoachMessage) => {
    removeCoachMessage(failed.id)
    if (ai.ready) void ask()
  }

  const keyboard = viewport.keyboardOpen
  const composerBottom = keyboard ? '8px' : 'calc(max(10px, var(--sab) - 12px) + 74px)'
  const knownModels = useStore((s) => s.settings.ai[ai.provider]?.models)
  const modelName = (knownModels?.length ? knownModels : providerInfo(ai.provider).fallbackModels).find((m) => m.id === ai.model)?.label ?? ai.model.split('/').pop()

  return (
    <div
      className="fixed inset-x-0 z-10 mx-auto max-w-[560px]"
      style={viewport.height ? { top: viewport.offsetTop, height: viewport.height } : { top: 0, bottom: 0 }}
    >
      {/* Conversation */}
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the coach"
        className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain px-4"
        style={{ paddingTop: 'calc(var(--sat) + 64px)', paddingBottom: `calc(${composerBottom} + 86px)` }}
      >
        <Snapshot eaten={eaten.kcal} budget={plan.budget} protein={eaten.p} proteinTarget={plan.protein} onTap={() => goTo('today')} />

        {messages.length === 0 && !busy ? (
          <Intro
            ready={ai.ready}
            onStarter={(starter) => {
              if (starter.send) send(starter.send)
              else if (starter.fill) {
                setText(starter.fill)
                requestAnimationFrame(() => {
                  const el = input.current
                  if (!el) return
                  el.focus()
                  el.setSelectionRange(el.value.length, el.value.length)
                })
              }
            }}
            onSetup={openYou}
          />
        ) : (
          <div className="mt-5 space-y-3">
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserBubble key={m.id} text={m.text} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  onRetry={() => retry(m)}
                  onUndo={() => {
                    useStore.getState().removeEntries(m.logged ?? [])
                    updateCoachMessage(m.id, { logged: [] })
                    toast('Removed from your log')
                  }}
                  onRelog={() => {
                    if (!m.result) return
                    updateCoachMessage(m.id, { logged: logItems(m.result.log_items, m.unsure ?? mealForTime()) })
                    hapticSuccess()
                  }}
                  onRemoveItem={(index) => {
                    const id = m.logged?.[index]
                    if (!id) return
                    useStore.getState().removeEntries([id])
                    updateCoachMessage(m.id, { logged: m.logged!.map((x, i) => (i === index ? '' : x)) })
                  }}
                  onMoveUnsure={(meal) => {
                    if (!m.result) return
                    const update = useStore.getState().updateEntry
                    m.result.log_items.forEach((item, i) => {
                      const id = m.logged?.[i]
                      if (item.meal === 'unspecified' && id) update(id, { meal })
                    })
                    updateCoachMessage(m.id, { unsure: meal })
                  }}
                  onPick={(index, suggestion) => {
                    const picked = { ...(m.picked ?? {}) }
                    if (picked[index]) {
                      useStore.getState().removeEntries([picked[index]])
                      delete picked[index]
                    } else {
                      const [entry] = addEntries([
                        {
                          date: dayKey(),
                          meal: suggestion.meal === 'unspecified' ? mealForTime() : suggestion.meal,
                          name: suggestion.name,
                          emoji: suggestion.emoji || '🍽️',
                          portion: suggestion.portion,
                          ...macrosOf(suggestion),
                          source: 'ai',
                        },
                      ])
                      picked[index] = entry.id
                      hapticSuccess()
                    }
                    updateCoachMessage(m.id, { picked })
                  }}
                />
              ),
            )}
            <AnimatePresence>
              {busy && (
                <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <div className="typing inline-flex h-[38px] items-center gap-1 rounded-[20px] rounded-bl-[6px] bg-surface px-4" aria-label="The coach is thinking">
                    <span className="size-2 rounded-full bg-ink-3" />
                    <span className="size-2 rounded-full bg-ink-3" />
                    <span className="size-2 rounded-full bg-ink-3" />
                  </div>
                  {waitUntil != null && (
                    <p className="mt-1.5 px-1 text-[13px] text-ink-3">
                      The free Groq plan allows a few big requests a minute. Trying again in <Countdown until={waitUntil} /> s.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Nav layer */}
      <header className="pointer-events-none absolute inset-x-0 top-0">
        <div className="edge-top absolute inset-x-0 top-0 h-[calc(var(--sat)+96px)]" aria-hidden />
        <div className="relative flex h-[52px] items-center gap-2 px-4" style={{ marginTop: 'var(--sat)' }}>
          <div className="pointer-events-auto w-[44px]">
            {messages.length > 0 && (
              <GlassButton
                label="New conversation"
                onTap={() => {
                  clearCoach()
                  toast('New conversation')
                }}
              >
                <SquarePen size={19} strokeWidth={2.2} />
              </GlassButton>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[17px] leading-tight font-semibold">Coach</div>
            {ai.ready && (
              <div className="truncate text-[12px] leading-tight text-ink-3">
                {providerInfo(ai.provider).short} · {modelName}
              </div>
            )}
          </div>
          <div className="pointer-events-auto flex w-[44px] justify-end">
            <AvatarButton onTap={openYou} />
          </div>
        </div>
      </header>

      {/* Composer */}
      <div className="absolute inset-x-0 px-3" style={{ bottom: composerBottom }}>
        <Composer inputRef={input} text={text} setText={setText} onSend={() => send(text)} busy={busy} />
      </div>
    </div>
  )
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function Snapshot({ eaten, budget, protein, proteinTarget, onTap }: { eaten: number; budget: number; protein: number; proteinTarget: number; onTap: () => void }) {
  const left = budget - eaten
  return (
    <Press onTap={onTap} scale={0.98} className="surface flex w-full items-stretch divide-x-[0.5px] divide-separator rounded-[20px] py-3 text-left" aria-label="Today so far. Opens Today.">
      <Stat label="Eaten" value={`${fmt(eaten)}`} unit="kcal" />
      <Stat label={left < 0 ? 'Over' : 'Left'} value={`${fmt(Math.abs(left))}`} unit="kcal" warn={left < 0} />
      <Stat label="Protein" value={`${Math.round(protein)}`} unit={`/ ${proteinTarget} g`} />
    </Press>
  )
}

function Stat({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <span className="min-w-0 flex-1 px-3.5">
      <span className="block text-[13px] font-semibold text-ink-3">{label}</span>
      <span className={`font-rounded tabular block truncate text-[20px] leading-tight font-semibold ${warn ? 'text-warn' : ''}`}>
        {value} <span className="text-[13px] font-medium text-ink-3">{unit}</span>
      </span>
    </span>
  )
}

function Intro({ ready, onStarter, onSetup }: { ready: boolean; onStarter: (s: (typeof STARTERS)[number]) => void; onSetup: () => void }) {
  return (
    <div className="pt-8">
      <div className="flex flex-col items-center text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="grad grid size-[68px] place-items-center rounded-[22px] text-white shadow-[0_10px_30px_-10px_rgba(12,144,227,0.6)]"
        >
          <Sparkles size={32} strokeWidth={2} />
        </motion.span>
        <h1 className="mt-4 text-[28px] leading-tight font-bold">Your food coach</h1>
        <p className="mt-2 max-w-[22rem] text-[17px] leading-snug text-ink-2">
          Tell me what you ate, even a whole day in one go, and I will log it by meal. Ask what to eat next, or whether something fits today.
        </p>
      </div>

      {ready ? (
        <div className="ios-list mt-7 overflow-hidden rounded-[24px] bg-surface" style={{ ['--sep-inset' as string]: '54px' }}>
          {STARTERS.map((starter, i) => (
            <motion.button
              key={starter.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => {
                haptic(5)
                onStarter(starter)
              }}
              className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left active:bg-fill"
            >
              <starter.icon size={22} className="shrink-0 text-tint" strokeWidth={2} />
              <span className="text-[17px]">{starter.label}</span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="surface mt-7 p-5 text-center">
          <p className="text-[15px] leading-snug text-ink-2">The coach runs on your AI key. Add your Groq key once, and it stays on this phone.</p>
          <Press onTap={onSetup} className="glass-tint mt-4 inline-flex min-h-[44px] items-center rounded-full px-5 text-[16px] font-semibold">
            Add a key
          </Press>
        </div>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className="flex justify-end">
      <p className="max-w-[82%] rounded-[20px] rounded-br-[6px] bg-tint-fill px-4 py-2.5 text-[17px] leading-[22px] whitespace-pre-wrap text-white">{text}</p>
    </motion.div>
  )
}

interface AssistantMessageProps {
  message: CoachMessage
  onRetry: () => void
  onUndo: () => void
  onRelog: () => void
  onRemoveItem: (index: number) => void
  onMoveUnsure: (meal: Meal) => void
  onPick: (index: number, suggestion: CoachSuggestionData) => void
}

function AssistantMessage({ message, onRetry, onUndo, onRelog, onRemoveItem, onMoveUnsure, onPick }: AssistantMessageProps) {
  const result = message.result
  const verdict = result?.verdict.decision !== 'none' ? result?.verdict : undefined

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-2">
      {verdict && <Verdict decision={verdict.decision} headline={verdict.headline} />}
      <div className="flex">
        <div className="max-w-[88%] rounded-[20px] rounded-bl-[6px] bg-surface px-4 py-2.5">
          <p className={`text-[17px] leading-[22px] whitespace-pre-wrap ${message.error ? 'text-ink-2' : ''}`}>{message.text}</p>
          {message.error && (
            <button onClick={onRetry} className="mt-2 flex min-h-[36px] items-center gap-1.5 text-[15px] font-semibold text-tint">
              <RotateCcw size={15} strokeWidth={2.4} /> Try again
            </button>
          )}
        </div>
      </div>

      {result && result.log_items.length > 0 && (
        <LogCard
          items={result.log_items}
          logged={message.logged}
          unsure={message.unsure ?? mealForTime()}
          onUndo={onUndo}
          onRelog={onRelog}
          onRemoveItem={onRemoveItem}
          onMoveUnsure={onMoveUnsure}
        />
      )}

      {result && result.suggestions.length > 0 && (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1">
          {result.suggestions.map((s, i) => (
            <SuggestionCard key={`${s.name}-${i}`} suggestion={s} picked={!!message.picked?.[i]} onPick={() => onPick(i, s)} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

function Verdict({ decision, headline }: { decision: 'yes' | 'smaller' | 'no' | 'none'; headline: string }) {
  const tone =
    decision === 'yes'
      ? { color: 'var(--good)', Icon: CircleCheck, fallback: 'Yes, it fits' }
      : decision === 'smaller'
        ? { color: 'var(--warn)', Icon: Scale, fallback: 'A smaller portion fits' }
        : { color: 'var(--danger)', Icon: CircleX, fallback: 'Not today' }
  return (
    <div
      className="inline-flex min-h-[34px] max-w-full items-start gap-1.5 rounded-[17px] px-3 py-[7px] text-[15px] leading-[20px] font-semibold"
      style={{ color: tone.color, background: `color-mix(in srgb, ${tone.color} 14%, transparent)` }}
    >
      <tone.Icon size={17} strokeWidth={2.4} className="mt-px shrink-0" />
      <span>{headline || tone.fallback}</span>
    </div>
  )
}

interface LogCardProps {
  items: LogItem[]
  logged?: string[]
  unsure: Meal
  onUndo: () => void
  onRelog: () => void
  onRemoveItem: (index: number) => void
  onMoveUnsure: (meal: Meal) => void
}

/** What the coach logged, grouped by meal, with undo. */
function LogCard({ items, logged, unsure, onUndo, onRelog, onRemoveItem, onMoveUnsure }: LogCardProps) {
  const isLogged = !!logged?.some(Boolean)
  const live = items.map((item, index) => ({ item, index, kept: !isLogged || !!logged?.[index] }))
  const total = live.filter((l) => l.kept).reduce((sum, l) => sum + macrosOf(l.item).kcal, 0)
  const hasUnsure = items.some((i) => i.meal === 'unspecified')
  const hasYesterday = items.some((i) => i.day === 'yesterday')

  const groups = MEALS.map((meal) => ({
    meal: meal.id,
    rows: live.filter(({ item }) => (item.meal === 'unspecified' ? unsure : item.meal) === meal.id),
  })).filter((g) => g.rows.length)

  return (
    <div className="surface overflow-hidden rounded-[22px]">
      {groups.map((group) => (
        <div key={group.meal} className="border-b-[0.5px] border-separator last:border-b-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <MealIcon meal={group.meal} size={22} />
            <span className="flex-1 text-[15px] font-semibold">{mealLabel(group.meal)}</span>
            <span className="tabular text-[13px] text-ink-3">
              {fmt(group.rows.filter((r) => r.kept).reduce((sum, r) => sum + macrosOf(r.item).kcal, 0))} kcal
            </span>
          </div>
          <ul>
            {group.rows.map(({ item, index, kept }) => {
              const m = macrosOf(item)
              return (
                <li key={index} className={`flex min-h-[48px] items-center gap-3 px-4 py-1.5 transition-opacity ${kept ? '' : 'opacity-40'}`}>
                  <span className="w-7 text-center text-[20px]" aria-hidden>
                    {item.emoji || '🍽️'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[16px] leading-tight ${kept ? '' : 'line-through'}`}>{item.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {item.portion}
                      {item.day === 'yesterday' ? ' · yesterday' : ''}
                    </span>
                  </span>
                  <span className="font-rounded tabular shrink-0 text-[16px] font-semibold">{fmt(m.kcal)}</span>
                  {isLogged && kept && (
                    <button onClick={() => onRemoveItem(index)} aria-label={`Remove ${item.name}`} className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-3 active:bg-fill">
                      <X size={16} strokeWidth={2.4} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {hasUnsure && isLogged && (
        <label className="flex min-h-[44px] items-center justify-between gap-3 border-t-[0.5px] border-separator px-4 text-[15px]">
          <span className="text-ink-2">No time given, so logged to</span>
          <select className="ios-select text-[15px]" value={unsure} onChange={(e) => onMoveUnsure(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3 border-t-[0.5px] border-separator bg-surface-2/60 px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="font-rounded tabular block text-[20px] leading-tight font-bold">{fmt(total)} kcal</span>
          <span className="block text-[13px] text-ink-3">
            {isLogged ? (hasYesterday ? 'Logged, including yesterday' : 'Logged to today') : 'Not in your log'}
          </span>
        </span>
        {isLogged ? (
          <button onClick={onUndo} className="min-h-[36px] rounded-full bg-fill px-4 text-[15px] font-semibold text-tint">
            Undo
          </button>
        ) : (
          <Press onTap={onRelog} className="glass-tint flex min-h-[36px] items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold">
            <Plus size={16} strokeWidth={2.8} /> Log all
          </Press>
        )}
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, picked, onPick }: { suggestion: CoachSuggestionData; picked: boolean; onPick: () => void }) {
  const m = macrosOf(suggestion)
  return (
    <div className="surface flex w-[236px] shrink-0 snap-start flex-col rounded-[22px] p-4">
      <div className="flex items-start gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-fill text-[21px]" aria-hidden>
          {suggestion.emoji || '🍽️'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-[16px] leading-tight font-semibold">{suggestion.name}</span>
          <span className="block truncate text-[13px] text-ink-3">{suggestion.portion}</span>
        </span>
      </div>
      {suggestion.why && <p className="mt-2.5 line-clamp-3 flex-1 text-[14px] leading-snug text-ink-2">{suggestion.why}</p>}
      <div className="mt-3 flex items-center gap-2">
        <span className="tabular min-w-0 flex-1 text-[13px] text-ink-3">
          <span className="font-rounded text-[17px] font-semibold text-ink">{fmt(m.kcal)}</span> kcal · {Math.round(m.p)} g protein
        </span>
        <Press
          onTap={onPick}
          scale={0.88}
          aria-label={picked ? `Remove ${suggestion.name} from your log` : `Log ${suggestion.name}`}
          className={`grid size-9 shrink-0 place-items-center rounded-full ${picked ? 'bg-tint text-white dark:text-black' : 'bg-fill text-tint'}`}
        >
          {picked ? <Check size={18} strokeWidth={3} /> : <Plus size={19} strokeWidth={2.6} />}
        </Press>
      </div>
    </div>
  )
}

/* ── Composer ────────────────────────────────────────────────────────── */

function Composer({
  inputRef,
  text,
  setText,
  onSend,
  busy,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  text: string
  setText: (t: string) => void
  onSend: () => void
  busy: boolean
}) {
  const [listening, setListening] = useState(false)
  const dictation = useRef<Dictation | null>(null)
  const before = useRef('')
  const canDictate = useMemo(() => speechSupported(), [])
  const toast = useToast()

  useEffect(() => () => dictation.current?.stop(), [])

  // Grow with the text, up to about six lines.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text, inputRef])

  const toggleDictation = () => {
    if (listening) {
      dictation.current?.stop()
      dictation.current = null
      setListening(false)
      return
    }
    before.current = text.trim()
    const started = startDictation({
      onText: (heard) => setText(before.current ? `${before.current} ${heard}` : heard),
      onEnd: () => {
        dictation.current = null
        setListening(false)
      },
      onError: (message) => {
        dictation.current = null
        setListening(false)
        toast(message, 'error')
      },
    })
    if (!started) return toast('Dictation is not available in this browser', 'error')
    dictation.current = started
    setListening(true)
    haptic()
  }

  const canSend = text.trim().length > 0 && !busy

  return (
    <div className="glass rim mx-auto flex max-w-[540px] items-end gap-1 rounded-[26px] py-[3px] pr-[3px] pl-4">
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canSend) {
              dictation.current?.stop()
              onSend()
            }
          }
        }}
        enterKeyHint="send"
        placeholder={listening ? 'Listening…' : 'What did you eat, or ask anything'}
        aria-label="Message the coach"
        className="max-h-[140px] min-h-[44px] flex-1 resize-none bg-transparent py-[11px] text-[17px] leading-[22px] outline-none"
      />
      {canDictate && !text.trim() && (
        <Press
          onTap={toggleDictation}
          aria-label={listening ? 'Stop dictation' : 'Dictate'}
          aria-pressed={listening}
          scale={0.88}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2"
        >
          <span className={`grid size-[38px] place-items-center rounded-full ${listening ? 'bg-danger text-white' : ''}`}>
            {listening ? <Square size={14} fill="currentColor" /> : <Mic size={21} />}
          </span>
        </Press>
      )}
      {(text.trim() || !canDictate) && (
        <Press
          onTap={() => {
            dictation.current?.stop()
            onSend()
          }}
          disabled={!canSend}
          aria-label="Send"
          scale={0.86}
          className="grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-35"
        >
          <span className="glass-tint grid size-[38px] place-items-center rounded-full">
            <ArrowUp size={21} strokeWidth={2.8} />
          </span>
        </Press>
      )}
    </div>
  )
}
