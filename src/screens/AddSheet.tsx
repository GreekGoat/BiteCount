import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Camera, ChevronRight, Clock, Loader2, Mic, Pencil, Plus, Search, Sparkles, Square, Sunrise, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiAnswer, AiResultData } from '../food/ai'
import { providerInfo } from '../food/ai-models'
import { DISH_KINDS, MAIN_INGREDIENTS, kindIsSavory, makeEstimatedFood } from '../food/archetype'
import { answerSummary, computeItem, portionGrams, portionLabel, type Answers, type Portion } from '../food/compute'
import { mentionsMeals, parseDay } from '../food/day'
import { FOODS, getFood } from '../food/db'
import { parseMeal, reparseFor, type ParsedItem } from '../food/parse'
import { QUESTIONS, withTypicalAnswers } from '../food/questions'
import { searchFoods, type SearchHit } from '../food/search'
import type { Food, FoodCat, Macros, QuestionKey } from '../food/types'
import { dayKey, dayPhrase, MEALS, mealForTime, type DayKey, type Meal } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { fileToCompressedBase64 } from '../lib/image'
import { speechSupported, startDictation, type Dictation } from '../lib/speech'
import { recentEntries, useAiSettings, useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { Button, Chip, OptionCard, Segmented, Stepper, TextInput } from '../ui/Controls'
import { DateChip } from '../ui/DateChip'
import { MealIcon } from '../ui/MealIcon'
import { Sheet, SheetHeader } from '../ui/Sheet'
import { AnimatedNumber, Press, spring } from '../ui/motion'
import { Countdown } from '../ui/Countdown'
import { useToast } from '../ui/Toast'

type ItemKind = 'db' | 'estimate' | 'ai' | 'manual'

interface DraftItem {
  uid: string
  kind: ItemKind
  /** Text the user typed for this item, kept for the estimate flow and AI. */
  raw: string
  food?: Food
  portion: Portion
  portionGiven: boolean
  portionDone: boolean
  answers: Answers
  skipped: boolean
  candidates: SearchHit[]
  needsFood: boolean
  estKind?: string
  estMain?: string
  asSide?: boolean
  /** For AI and manual items, the numbers come ready-made. */
  fixed?: { name: string; emoji: string; portion: string; macros: Macros }
  scale: number
  /** The meal the person said it was part of; unset means "use the sheet's meal". */
  meal?: Meal
}

type QKey = 'food' | 'kind' | 'main' | 'portion' | QuestionKey

const uid = () => Math.random().toString(36).slice(2)

/** A stage that scrolls on its own, inside the sheet's fixed frame. */
// data-sheet-scroll on every pane lets a pull at the top dismiss the sheet.
const SCROLL_PANE = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(20px,var(--sab))]'

const PLACEHOLDERS = [
  'breakfast 2 parathas and cha, lunch chicken biryani, dinner rice and dal',
  '2 rotis and a bowl of chicken curry',
  'cha with milk and 2 sugars',
  'grilled chicken breast 200g',
  'a plate of fried rice and chilli chicken',
]

function itemFromParsed(parsed: ParsedItem, asSide = false): DraftItem {
  return {
    uid: uid(),
    kind: parsed.hit ? 'db' : 'estimate',
    raw: parsed.raw,
    food: parsed.hit?.food,
    portion: parsed.portion,
    portionGiven: parsed.portionGiven && !!parsed.hit,
    portionDone: false,
    answers: { ...parsed.answers },
    skipped: false,
    candidates: parsed.candidates,
    needsFood: !parsed.hit || parsed.ambiguous,
    asSide,
    scale: 1,
  }
}

function itemMacros(item: DraftItem): Macros {
  if (item.fixed) {
    const { kcal, p, c, f } = item.fixed.macros
    const s = item.scale
    return { kcal: Math.round(kcal * s), p: Math.round(p * s * 10) / 10, c: Math.round(c * s * 10) / 10, f: Math.round(f * s * 10) / 10 }
  }
  if (!item.food) return { kcal: 0, p: 0, c: 0, f: 0 }
  return computeItem(item.food, item.portion, item.answers)
}

function itemName(item: DraftItem) {
  return item.fixed?.name ?? item.food?.name ?? item.raw
}

function itemEmoji(item: DraftItem) {
  return item.fixed?.emoji ?? item.food?.emoji ?? '🍽️'
}

function itemPortionText(item: DraftItem) {
  if (item.fixed) return item.scale === 1 ? item.fixed.portion : `${item.fixed.portion} × ${item.scale}`
  if (!item.food) return ''
  return [portionLabel(item.food, item.portion), ...answerSummary(item.answers)].join(' · ')
}

/** What still needs asking for this item, in order. */
function pending(item: DraftItem): QKey[] {
  if (item.fixed) return []
  if (item.needsFood) return ['food']
  if (item.kind === 'estimate') {
    if (!item.estKind) return ['kind']
    if (kindIsSavory(item.estKind) && !item.estMain) return ['main']
  }
  if (!item.food) return []
  const list: QKey[] = []
  if (!item.portionGiven && !item.portionDone) list.push('portion')
  if (!item.skipped && !item.asSide) {
    for (const key of item.food.questions) if (!(key in item.answers)) list.push(key)
  }
  return list
}

/** Offline read of the text: a whole day split by meal, or a single meal. */
function draftsFromText(input: string): DraftItem[] {
  if (!mentionsMeals(input)) return parseMeal(input).map((p) => itemFromParsed(p))
  return parseDay(input).flatMap((chunk) =>
    chunk.items.map((parsed) => {
      const item = itemFromParsed(parsed)
      item.meal = chunk.meal ?? undefined
      // A whole day is logged quickly: typical portions and no follow-ups for foods we know.
      if (!item.needsFood && item.food) {
        item.skipped = true
        item.portionDone = true
        item.answers = withTypicalAnswers(item.food, item.answers)
      }
      return item
    }),
  )
}

const mealLabel = (meal: Meal) => MEALS.find((m) => m.id === meal)?.label ?? meal

export function AddSheet({ open, meal, date = dayKey(), onClose }: { open: boolean; meal?: Meal; date?: DayKey; onClose: () => void }) {
  const addEntries = useStore((s) => s.addEntries)
  const removeEntries = useStore((s) => s.removeEntries)
  const addWater = useStore((s) => s.addWater)
  const saveFood = useStore((s) => s.saveFood)
  const entries = useStore((s) => s.entries)
  const saved = useStore((s) => s.saved)
  const ai = useAiSettings()
  const toast = useToast()

  const [stage, setStage] = useState<'input' | 'questions' | 'review'>('input')
  const [text, setText] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [mealId, setMealId] = useState<Meal>(meal ?? mealForTime())
  // The day this lands on: the day you were looking at, changeable from the header.
  const [logDate, setLogDate] = useState<DayKey>(date)
  const [busy, setBusy] = useState(false)
  const [waitUntil, setWaitUntil] = useState<number | null>(null)
  const [aiState, setAiState] = useState<{ questions: AiResultData['questions']; answers: AiAnswer[]; note?: string } | null>(null)
  const [photo, setPhoto] = useState<{ data: string; mediaType: string; preview: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const aiReady = ai.ready
  const aiLabel = providerInfo(ai.provider).short
  const aiVision = providerInfo(ai.provider).vision

  // A clean slate every time it opens, and again once it has slid away, so a
  // half-finished session never reappears.
  useEffect(() => {
    const reset = () => {
      setStage('input')
      setText('')
      setItems([])
      setCursor(0)
      setAiState(null)
      setPhoto(null)
      setBusy(false)
      setWaitUntil(null)
      setMealId(meal ?? mealForTime())
      setLogDate(date)
    }
    if (open) {
      reset()
      return
    }
    const timer = setTimeout(reset, 400)
    return () => clearTimeout(timer)
  }, [open, meal, date])

  const total = useMemo(() => items.reduce((sum, item) => sum + itemMacros(item).kcal, 0), [items])

  const patchItem = (uidKey: string, patch: Partial<DraftItem>) =>
    setItems((list) => list.map((item) => (item.uid === uidKey ? { ...item, ...patch } : item)))

  const advance = (list: DraftItem[] = items, from = cursor) => {
    let i = from
    while (i < list.length && pending(list[i]).length === 0) i++
    if (i >= list.length) {
      setStage('review')
      setCursor(list.length)
    } else {
      setCursor(i)
      setStage('questions')
    }
  }

  const startLocal = (input: string) => {
    const drafts = draftsFromText(input)
    if (!drafts.length) {
      toast('I could not find any food in that. Try naming the dish.', 'error')
      return
    }
    // Append, so "Add something else" keeps what is already in the basket.
    const next = [...items, ...drafts]
    setItems(next)
    advance(next, items.length)
  }

  const runAi = async (req: { text: string; answers?: AiAnswer[]; skipQuestions?: boolean }) => {
    if (!aiReady) {
      toast(`Add your ${aiLabel} key in You → AI`, 'error')
      return
    }
    setBusy(true)
    try {
      const { estimateWithAi, macrosFromAiItem } = await import('../food/ai')
      const result = await estimateWithAi(
        { provider: ai.provider, key: ai.key, model: ai.model, proxyUrl: ai.proxyUrl },
        {
          text: req.text,
          image: photo ? { data: photo.data, mediaType: photo.mediaType } : undefined,
          answers: req.answers,
          skipQuestions: req.skipQuestions,
        },
        { onWait: (seconds) => setWaitUntil(Date.now() + seconds * 1000) },
      )
      if (result.status === 'need_info' && result.questions.length) {
        setAiState({ questions: result.questions, answers: req.answers ?? [], note: result.notes })
        setStage('input')
        haptic()
        return
      }
      const drafts: DraftItem[] = result.items.map((aiItem) => ({
        uid: uid(),
        kind: 'ai' as const,
        raw: aiItem.name,
        portion: { serving: -1, qty: 1, grams: aiItem.grams },
        portionGiven: true,
        portionDone: true,
        answers: {},
        skipped: true,
        candidates: [],
        needsFood: false,
        scale: 1,
        meal: aiItem.meal === 'unspecified' ? undefined : aiItem.meal,
        fixed: {
          name: aiItem.name,
          emoji: aiItem.emoji || '🍽️',
          portion: `${aiItem.portion}${aiItem.grams ? ` · ${Math.round(aiItem.grams)} g` : ''}`,
          macros: macrosFromAiItem(aiItem),
        },
      }))
      if (!drafts.length) {
        toast('No food found in that. Try describing it.', 'error')
        return
      }
      setItems([...items, ...drafts])
      setAiState(null)
      setStage('review')
      hapticSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Estimation failed'
      toast(message, 'error')
      if (text.trim()) startLocal(text)
    } finally {
      setBusy(false)
      setWaitUntil(null)
    }
  }

  const submit = () => {
    const input = text.trim()
    if (photo) {
      void runAi({ text: input })
      return
    }
    if (!input) return
    const drafts = draftsFromText(input)
    const unknown = drafts.filter((d) => d.kind === 'estimate').length
    if ((unknown > 0 || !drafts.length) && aiReady) {
      void runAi({ text: input })
      return
    }
    startLocal(input)
  }

  const addFixedItem = (fixed: NonNullable<DraftItem['fixed']>, kind: ItemKind = 'manual') => {
    const item: DraftItem = {
      uid: uid(),
      kind,
      raw: fixed.name,
      portion: { serving: -1, qty: 1, grams: 0 },
      portionGiven: true,
      portionDone: true,
      answers: {},
      skipped: true,
      candidates: [],
      needsFood: false,
      scale: 1,
      fixed,
    }
    setItems((list) => [...list, item])
    setStage('review')
    haptic()
  }

  const commit = () => {
    const logs: Omit<LogEntry, 'id' | 'createdAt'>[] = []
    let waterMl = 0
    for (const item of items) {
      const macros = itemMacros(item)
      if (item.food?.id === 'water') {
        waterMl += portionGrams(item.food, item.portion)
        continue
      }
      logs.push({
        date: logDate,
        meal: item.meal ?? mealId,
        name: itemName(item),
        emoji: itemEmoji(item),
        portion: itemPortionText(item),
        kcal: macros.kcal,
        p: macros.p,
        c: macros.c,
        f: macros.f,
        foodId: item.food?.id,
        source: item.kind === 'db' ? 'db' : item.kind === 'ai' ? 'ai' : item.kind === 'estimate' ? 'estimate' : 'quick',
      })
      if (item.kind === 'ai' || item.kind === 'estimate') {
        saveFood({ name: itemName(item), emoji: itemEmoji(item), portion: itemPortionText(item), macros })
      }
    }
    const added = logs.length ? addEntries(logs) : []
    if (waterMl) addWater(waterMl, logDate)
    hapticSuccess()
    const meals = new Set(logs.map((l) => l.meal)).size
    const when = logDate === dayKey() ? '' : ` to ${dayPhrase(logDate)}`
    const summary =
      logs.length > 1
        ? `${logs.length} items logged${when}${meals > 1 ? ` across ${meals} meals` : ''} · ${fmt(total)} kcal`
        : logs.length
          ? `${logs[0].name} logged${when} · ${fmt(total)} kcal`
          : 'Water logged'
    toast(summary, 'success', added.length ? { label: 'Undo', onAction: () => removeEntries(added.map((e) => e.id)) } : undefined)
    onClose()
  }

  const current = items[cursor]
  const title = stage === 'input' ? (aiState ? 'A few details' : 'Add Food') : stage === 'questions' ? 'A few details' : 'Review'

  return (
    <Sheet open={open} onClose={onClose} label="Add food">
      <SheetHeader
        title={title}
        subtitle={<DateChip value={logDate} onChange={setLogDate} />}
        onClose={onClose}
        trailing={
          items.length > 0 && (
            <div className="text-right leading-none">
              <AnimatedNumber value={total} className="font-rounded tabular block text-[19px] font-bold" />
              <span className="text-[11px] font-semibold text-ink-3">kcal</span>
            </div>
          )
        }
      />

      {/* Each stage owns its own scrolling, so the header above never moves. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {stage === 'input' && (
            <motion.div
              key="input"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {aiState ? (
                <div data-sheet-scroll className={SCROLL_PANE}>
                  <AiQuestions
                    state={aiState}
                    busy={busy}
                    label={aiLabel}
                    onSubmit={(answers) => void runAi({ text, answers })}
                    onSkip={() => void runAi({ text, answers: aiState.answers, skipQuestions: true })}
                  />
                </div>
              ) : (
                <InputStage
                  text={text}
                  setText={setText}
                  onSubmit={submit}
                  busy={busy}
                  waitUntil={waitUntil}
                  aiReady={aiReady}
                  aiLabel={aiLabel}
                  aiVision={aiVision}
                  photo={photo}
                  onPickPhoto={() => fileRef.current?.click()}
                  onClearPhoto={() => setPhoto(null)}
                  onQuickPick={(fixed) => addFixedItem(fixed, 'manual')}
                  recents={recentEntries(entries, 10)}
                  savedFoods={saved}
                  onAskAi={() => void runAi({ text })}
                />
              )}
            </motion.div>
          )}

          {stage === 'questions' && current && (
            <motion.div
              key={`q-${current.uid}-${pending(current)[0]}`}
              data-sheet-scroll className={SCROLL_PANE}
              initial={{ opacity: 0, x: 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -22 }}
              transition={{ duration: 0.2 }}
            >
              <QuestionStage
                item={current}
                index={cursor}
                count={items.length}
                onPatch={(patch) => patchItem(current.uid, patch)}
                onAddSides={(sides) => {
                  const sideItems: DraftItem[] = sides.map((side) => ({
                    uid: uid(),
                    kind: 'db',
                    raw: side.food.name,
                    food: side.food,
                    portion: side.portion,
                    portionGiven: false,
                    portionDone: false,
                    answers: {},
                    skipped: false,
                    candidates: [],
                    needsFood: false,
                    asSide: true,
                    scale: 1,
                    meal: current.meal,
                  }))
                  setItems((list) => [...list, ...sideItems])
                }}
                onNext={() => {
                  const list = items
                  if (pending(list[cursor]).length === 0) advance(list, cursor + 1)
                }}
                onSkip={() => {
                  const next = items.map((item, i) => (i === cursor ? { ...item, skipped: true, portionDone: true } : item))
                  setItems(next)
                  advance(next, cursor + 1)
                }}
                onRemove={() => {
                  const next = items.filter((_, i) => i !== cursor)
                  setItems(next)
                  if (!next.length) setStage('input')
                  else advance(next, cursor)
                }}
              />
            </motion.div>
          )}

          {stage === 'review' && (
            <motion.div
              key="review"
              data-sheet-scroll className={SCROLL_PANE}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ReviewStage
                items={items}
                mealId={mealId}
                setMeal={setMealId}
                onPatch={patchItem}
                onEdit={(uidKey) => {
                  const index = items.findIndex((i) => i.uid === uidKey)
                  if (index < 0) return
                  const next = items.map((item, i) => (i === index ? { ...item, skipped: false, portionDone: false, portionGiven: false } : item))
                  setItems(next)
                  setCursor(index)
                  setStage('questions')
                }}
                onRemove={(uidKey) => {
                  const next = items.filter((i) => i.uid !== uidKey)
                  setItems(next)
                  if (!next.length) setStage('input')
                }}
                onAddMore={() => {
                  setText('')
                  setPhoto(null)
                  setStage('input')
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Commit */}
      {stage === 'review' && items.length > 0 && (
        <div className="shrink-0 px-4 pt-2 pb-[max(14px,calc(var(--sab)-6px))]">
          <Button onTap={commit} className="w-full">
            Add {items.length > 1 ? `${items.length} items` : 'to log'} · {fmt(total)} kcal
          </Button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            setPhoto(await fileToCompressedBase64(file))
            haptic()
          } catch {
            toast('Could not read that photo', 'error')
          }
        }}
      />
    </Sheet>
  )
}

/* ── Stage: what did you eat ───────────────────────────────────────── */

interface InputStageProps {
  text: string
  setText: (v: string) => void
  onSubmit: () => void
  busy: boolean
  waitUntil: number | null
  aiReady: boolean
  photo: { preview: string } | null
  aiLabel: string
  aiVision: boolean
  onPickPhoto: () => void
  onClearPhoto: () => void
  onQuickPick: (fixed: NonNullable<DraftItem['fixed']>) => void
  recents: LogEntry[]
  savedFoods: { id: string; name: string; emoji: string; portion: string; macros: Macros }[]
  onAskAi: () => void
}

function InputStage({
  text,
  setText,
  onSubmit,
  busy,
  waitUntil,
  aiReady,
  aiLabel,
  aiVision,
  photo,
  onPickPhoto,
  onClearPhoto,
  onQuickPick,
  recents,
  savedFoods,
  onAskAi,
}: InputStageProps) {
  const [tab, setTab] = useState<'recent' | 'saved' | 'browse' | 'quick'>('recent')
  const [placeholder, setPlaceholder] = useState(0)
  const [listening, setListening] = useState(false)
  const dictation = useRef<Dictation | null>(null)
  const textBeforeDictation = useRef('')
  const canDictate = useMemo(() => speechSupported(), [])
  const toast = useToast()
  const wholeDay = useMemo(() => mentionsMeals(text), [text])

  useEffect(() => () => dictation.current?.stop(), [])

  const toggleDictation = () => {
    if (listening) {
      dictation.current?.stop()
      dictation.current = null
      setListening(false)
      return
    }
    textBeforeDictation.current = text.trim()
    const started = startDictation({
      onText: (heard) => {
        const prefix = textBeforeDictation.current ? `${textBeforeDictation.current} ` : ''
        setText(prefix + heard)
      },
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
    if (!started) {
      toast('Dictation is not available in this browser', 'error')
      return
    }
    dictation.current = started
    setListening(true)
    haptic()
  }
  const suggestions = useMemo(() => (text.trim().length >= 2 && !wholeDay ? searchFoods(text.split(/[,+]|\band\b/).pop() ?? text, 6) : []), [text, wholeDay])

  useEffect(() => {
    const id = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 3800)
    return () => clearInterval(id)
  }, [])

  return (
    // Pinned top block, then a list that takes whatever height is left. With the
    // keyboard up only the list shrinks; the input and tabs stay put.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4">
        <div className="surface rounded-[24px] p-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
            }}
            rows={3}
            enterKeyHint="go"
            aria-label="What did you eat?"
            placeholder={listening ? 'Listening…' : `e.g. ${PLACEHOLDERS[placeholder]}`}
            className="block w-full resize-none bg-transparent px-2.5 pt-2 text-[17px] leading-[22px] text-ink outline-none"
          />
          <div className="flex items-center gap-1 pt-1">
            {canDictate && (
              <Press
                onTap={toggleDictation}
                aria-label={listening ? 'Stop dictation' : 'Dictate what you ate'}
                aria-pressed={listening}
                scale={0.88}
                className={`grid size-11 place-items-center rounded-full ${listening ? 'bg-danger text-white' : 'text-tint'}`}
              >
                {listening ? <Square size={14} fill="currentColor" /> : <Mic size={21} />}
              </Press>
            )}
            <Press onTap={onPickPhoto} aria-label="Add a photo of the meal" scale={0.88} className="grid size-11 place-items-center rounded-full text-tint">
              <Camera size={21} />
            </Press>
            <span className="flex-1" />
            {aiReady && !!text.trim() && (
              <Press onTap={onAskAi} disabled={busy} aria-label={`Ask ${aiLabel}`} scale={0.88} className="grid size-11 place-items-center rounded-full bg-fill text-tint disabled:opacity-40">
                <Sparkles size={19} />
              </Press>
            )}
            <Button size="small" onTap={onSubmit} disabled={busy || (!text.trim() && !photo)} className="min-h-[40px]">
              {busy ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Working
                </>
              ) : (
                <>
                  Work it out <ArrowRight size={17} strokeWidth={2.6} />
                </>
              )}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {(wholeDay || waitUntil != null) && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 overflow-hidden px-2 pt-2 text-[13px] text-ink-3"
            >
              {waitUntil != null ? (
                <>
                  <Clock size={14} className="shrink-0" /> {aiLabel} is busy for a moment. Trying again in <Countdown until={waitUntil} /> s.
                </>
              ) : (
                <>
                  <Sunrise size={14} className="shrink-0 text-tint" /> Whole day: each item goes into the meal you named.
                </>
              )}
            </motion.p>
          )}
        </AnimatePresence>

        {photo && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 flex items-center gap-3 rounded-[18px] bg-surface p-2.5">
            <img src={photo.preview} alt="Your meal" className="size-16 rounded-[12px] object-cover" />
            <div className="flex-1 text-[15px] leading-snug text-ink-2">
              {!aiReady ? 'Add an AI key in You to use photos.' : aiVision ? `${aiLabel} will read the plate.` : `${aiLabel} cannot read photos. Switch to Gemini or Claude.`}
            </div>
            <Press onTap={onClearPhoto} aria-label="Remove photo" className="grid size-10 place-items-center rounded-full bg-fill text-ink-2">
              <X size={16} />
            </Press>
          </motion.div>
        )}

        {suggestions.length > 0 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5" aria-label="Matching foods">
            <span className="flex shrink-0 items-center text-ink-3" aria-hidden>
              <Search size={16} />
            </span>
            {suggestions.map((hit) => (
              <Chip
                key={hit.food.id}
                onClick={() => {
                  const parts = text.split(/([,+]|\band\b)/)
                  parts[parts.length - 1] = ` ${hit.food.name}`
                  setText(parts.join('').trimStart())
                }}
              >
                <span aria-hidden>{hit.food.emoji}</span> {hit.food.name}
              </Chip>
            ))}
          </div>
        )}

        <Segmented
          className="mt-4"
          label="Pick from"
          options={[
            { id: 'recent' as const, label: 'Recent' },
            { id: 'saved' as const, label: 'Mine' },
            { id: 'browse' as const, label: 'Browse' },
            { id: 'quick' as const, label: 'Quick' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div data-sheet-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(20px,var(--sab))]">
        {tab === 'recent' &&
          (recents.length ? (
            <PickList>
              {recents.map((entry) => (
                <PickRow
                  key={entry.id}
                  emoji={entry.emoji}
                  name={entry.name}
                  detail={entry.portion}
                  kcal={entry.kcal}
                  onPick={() => onQuickPick({ name: entry.name, emoji: entry.emoji, portion: entry.portion, macros: { kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f } })}
                />
              ))}
            </PickList>
          ) : (
            <Empty icon={<Clock size={18} />} text="Foods you log show up here for one-tap adding." />
          ))}

        {tab === 'saved' &&
          (savedFoods.length ? (
            <PickList>
              {savedFoods.map((food) => (
                <PickRow key={food.id} emoji={food.emoji} name={food.name} detail={food.portion} kcal={food.macros.kcal} onPick={() => onQuickPick(food)} />
              ))}
            </PickList>
          ) : (
            <Empty icon={<Sparkles size={18} />} text="Estimated dishes are saved here, so next time is one tap." />
          ))}

        {tab === 'browse' && <BrowseFoods onPick={(food) => setText(text.trim() ? `${text.trim()}, ${food.name}` : food.name)} />}

        {tab === 'quick' && <QuickAdd onAdd={onQuickPick} />}
      </div>
    </div>
  )
}

const BROWSE_GROUPS: { id: string; label: string; emoji: string; cats: FoodCat[] }[] = [
  { id: 'meals', label: 'Curries & mains', emoji: '🍛', cats: ['curry', 'dal', 'protein'] },
  { id: 'staples', label: 'Rice & breads', emoji: '🍚', cats: ['rice', 'bread', 'noodles'] },
  { id: 'fast', label: 'Fast food', emoji: '🍔', cats: ['fastfood'] },
  { id: 'fresh', label: 'Fruit & veg', emoji: '🥗', cats: ['fruit', 'veg', 'salad', 'soup'] },
  { id: 'breakfast', label: 'Breakfast & eggs', emoji: '🍳', cats: ['breakfast', 'egg', 'dairy'] },
  { id: 'snacks', label: 'Snacks & sweets', emoji: '🍪', cats: ['snack', 'nuts', 'dessert'] },
  { id: 'drinks', label: 'Drinks', emoji: '🥤', cats: ['drink', 'hotdrink'] },
  { id: 'extras', label: 'Spreads & sauces', emoji: '🧈', cats: ['condiment'] },
]

/** Flick through the built-in database when you would rather tap than type. */
function BrowseFoods({ onPick }: { onPick: (food: Food) => void }) {
  const [group, setGroup] = useState(BROWSE_GROUPS[0].id)
  const foods = useMemo(() => {
    const cats = BROWSE_GROUPS.find((g) => g.id === group)?.cats ?? []
    return FOODS.filter((f) => cats.includes(f.cat)).sort((a, b) => a.name.localeCompare(b.name))
  }, [group])

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
        {BROWSE_GROUPS.map((g) => (
          <Chip key={g.id} active={g.id === group} onClick={() => setGroup(g.id)}>
            <span aria-hidden>{g.emoji}</span> {g.label}
          </Chip>
        ))}
      </div>
      <PickList>
        {foods.map((food) => {
          const macros = computeItem(food, { serving: food.def, qty: 1 })
          return (
            <PickRow
              key={food.id}
              emoji={food.emoji}
              name={food.name}
              detail={portionLabel(food, { serving: food.def, qty: 1 })}
              kcal={macros.kcal}
              onPick={() => onPick(food)}
            />
          )
        })}
      </PickList>
    </div>
  )
}

function QuickAdd({ onAdd }: { onAdd: (fixed: NonNullable<DraftItem['fixed']>) => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')

  const valid = name.trim().length > 0 && Number(kcal) > 0

  return (
    <div className="space-y-3">
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="What was it?" aria-label="Food name" />
      <div className="grid grid-cols-4 gap-2">
        <TextInput value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder="kcal" aria-label="Calories" className="text-center" />
        <TextInput value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" placeholder="P" aria-label="Protein grams" className="text-center" />
        <TextInput value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" placeholder="C" aria-label="Carb grams" className="text-center" />
        <TextInput value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" placeholder="F" aria-label="Fat grams" className="text-center" />
      </div>
      <Button
        kind="gray"
        className="w-full"
        disabled={!valid}
        onTap={() =>
          onAdd({
            name: name.trim(),
            emoji: '🍽️',
            portion: 'Quick add',
            macros: { kcal: Math.round(Number(kcal) || 0), p: Number(p) || 0, c: Number(c) || 0, f: Number(f) || 0 },
          })
        }
      >
        Add straight to the log
      </Button>
    </div>
  )
}

/* ── Stage: follow-up questions ────────────────────────────────────── */

interface QuestionStageProps {
  item: DraftItem
  index: number
  count: number
  onPatch: (patch: Partial<DraftItem>) => void
  onAddSides: (sides: { food: Food; name: string; portion: Portion }[]) => void
  onNext: () => void
  onSkip: () => void
  onRemove: () => void
}

function QuestionStage({ item, index, count, onPatch, onAddSides, onNext, onSkip, onRemove }: QuestionStageProps) {
  const queue = pending(item)
  const key = queue[0]
  const macros = itemMacros(item)

  useEffect(() => {
    if (!key) onNext()
    // Runs when the last question for this item is answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!key) return null

  return (
    <div>
      {count > 1 && (
        <p className="mb-2 px-1 text-[13px] font-semibold text-ink-3">
          Item {index + 1} of {count}
          {item.meal ? ` · ${mealLabel(item.meal)}` : ''}
        </p>
      )}

      {/* Item header - tap to pick a different food */}
      <Press onTap={() => onPatch({ needsFood: true })} scale={0.98} aria-label={`Change ${itemName(item)}`} className="surface mb-4 flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-fill text-[22px]" aria-hidden>
          {itemEmoji(item)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[17px] font-semibold">{itemName(item)}</span>
            <Pencil size={13} className="shrink-0 text-ink-3" />
          </div>
          <div className="truncate text-[15px] text-ink-3">{itemPortionText(item) || item.raw}</div>
        </div>
        <div className="shrink-0 text-right">
          <AnimatedNumber value={macros.kcal} className="font-rounded tabular block text-[19px] leading-none font-bold" />
          <span className="text-[12px] text-ink-3">kcal</span>
        </div>
      </Press>

      {/* Answered so far */}
      {(Object.keys(item.answers).length > 0 || item.portionDone) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {item.portionDone && item.food && (
            <Chip onClick={() => onPatch({ portionDone: false, portionGiven: false })} active>
              {portionLabel(item.food, item.portion)} <Pencil size={12} />
            </Chip>
          )}
          {(Object.keys(item.answers) as QuestionKey[]).map((answered) => {
            const q = QUESTIONS[answered]
            const value = item.answers[answered]
            const labels = (Array.isArray(value) ? value : [value])
              .map((id) => q.options.find((o) => o.id === id)?.label)
              .filter(Boolean)
              .join(', ')
            if (!labels) return null
            return (
              <Chip
                key={answered}
                active
                onClick={() => {
                  const next = { ...item.answers }
                  delete next[answered]
                  onPatch({ answers: next, skipped: false })
                }}
              >
                {labels} <Pencil size={12} />
              </Chip>
            )
          })}
        </div>
      )}

      {key === 'food' && <FoodPicker item={item} onPatch={onPatch} />}
      {key === 'kind' && (
        <QuestionBlock title="What kind of dish is it?" subtitle={`I do not know "${item.raw}" yet. This gets us close.`}>
          <div className="space-y-2">
            {DISH_KINDS.map((kind) => (
              <OptionCard
                key={kind.id}
                label={kind.label}
                emoji={kind.emoji}
                selected={item.estKind === kind.id}
                onSelect={() => {
                  const food = makeEstimatedFood(item.raw, kind.id)
                  onPatch({ estKind: kind.id, food: kindIsSavory(kind.id) ? undefined : food, portion: { serving: food.def, qty: 1 } })
                }}
              />
            ))}
          </div>
        </QuestionBlock>
      )}
      {key === 'main' && (
        <QuestionBlock title="What is mostly in it?">
          <div className="grid grid-cols-2 gap-2">
            {MAIN_INGREDIENTS.map((main) => (
              <OptionCard
                key={main.id}
                label={main.label}
                emoji={main.emoji}
                selected={item.estMain === main.id}
                onSelect={() => {
                  const food = makeEstimatedFood(item.raw, item.estKind!, main.id)
                  onPatch({ estMain: main.id, food, portion: { serving: food.def, qty: 1 } })
                }}
              />
            ))}
          </div>
        </QuestionBlock>
      )}
      {key === 'portion' && item.food && <PortionPicker item={item} onPatch={onPatch} />}
      {key !== 'food' && key !== 'kind' && key !== 'main' && key !== 'portion' && item.food && (
        <QuestionBlock title={QUESTIONS[key].title} subtitle={QUESTIONS[key].subtitle}>
          <MultiOrSingle questionKey={key} item={item} onPatch={onPatch} onAddSides={onAddSides} />
        </QuestionBlock>
      )}

      <div className="mt-5 flex gap-2">
        <Button kind="gray" size="medium" onTap={onRemove}>
          Remove
        </Button>
        <Button kind="gray" size="medium" onTap={onSkip} className="flex-1">
          Skip the rest <ChevronRight size={17} />
        </Button>
      </div>
    </div>
  )
}

function QuestionBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-1 text-[22px] leading-tight font-bold">{title}</h3>
      {subtitle && <p className="mt-1 mb-3 px-1 text-[15px] leading-snug text-ink-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

function MultiOrSingle({
  questionKey,
  item,
  onPatch,
  onAddSides,
}: {
  questionKey: QuestionKey
  item: DraftItem
  onPatch: (patch: Partial<DraftItem>) => void
  onAddSides: QuestionStageProps['onAddSides']
}) {
  const question = QUESTIONS[questionKey]
  const [picked, setPicked] = useState<string[]>([])

  if (!question.multi) {
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <OptionCard
            key={option.id}
            label={option.label}
            hint={option.hint}
            emoji={option.emoji}
            selected={item.answers[questionKey] === option.id}
            onSelect={() => onPatch({ answers: { ...item.answers, [questionKey]: option.id } })}
          />
        ))}
      </div>
    )
  }

  const confirm = () => {
    if (questionKey === 'sides') {
      const sides = picked
        .map((id) => question.options.find((o) => o.id === id)?.addFood)
        .filter(Boolean)
        .map((add) => {
          const food = getFood(add!.id)!
          return { food, name: food.name, portion: { serving: add!.serving ?? food.def, qty: add!.qty ?? 1 } }
        })
      onAddSides(sides)
      onPatch({ answers: { ...item.answers, sides: picked } })
    } else {
      onPatch({ answers: { ...item.answers, [questionKey]: picked } })
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {question.options.map((option) => (
          <OptionCard
            key={option.id}
            multi
            label={option.label}
            hint={option.hint}
            emoji={option.emoji}
            selected={picked.includes(option.id)}
            onSelect={() => setPicked((list) => (list.includes(option.id) ? list.filter((id) => id !== option.id) : [...list, option.id]))}
          />
        ))}
      </div>
      <div className="sticky bottom-0 -mx-1 mt-3 px-1 pt-3 pb-1">
        <Button onTap={confirm} className="w-full">
          {picked.length ? `Add ${picked.length}` : 'Nothing extra'}
        </Button>
      </div>
    </div>
  )
}

function FoodPicker({ item, onPatch }: { item: DraftItem; onPatch: (patch: Partial<DraftItem>) => void }) {
  const [query, setQuery] = useState(item.raw)
  const results = useMemo(() => (query.trim() ? searchFoods(query, 8) : item.candidates), [query, item.candidates])

  return (
    <QuestionBlock title="Which one was it?" subtitle={`You typed "${item.raw}".`}>
      <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" aria-label="Search foods" className="mb-3" />
      <div className="space-y-2">
        {results.slice(0, 6).map((hit) => (
          <OptionCard
            key={hit.food.id}
            label={hit.food.name}
            hint={hit.food.servings[hit.food.def].label}
            emoji={hit.food.emoji}
            selected={item.food?.id === hit.food.id}
            onSelect={() => {
              const reparsed = reparseFor(
                { raw: item.raw, query: item.raw, hit: null, candidates: [], ambiguous: false, portion: item.portion, portionGiven: false, answers: {} },
                hit.food,
              )
              onPatch({ food: hit.food, kind: 'db', needsFood: false, portion: reparsed.portion, portionGiven: reparsed.portionGiven, answers: reparsed.answers })
            }}
          />
        ))}
        <OptionCard
          label="None of these. Estimate it."
          hint="I will ask what kind of dish it is"
          icon={<Sparkles size={20} />}
          selected={false}
          onSelect={() => onPatch({ needsFood: false, food: undefined, kind: 'estimate' })}
        />
      </div>
    </QuestionBlock>
  )
}

function PortionPicker({ item, onPatch }: { item: DraftItem; onPatch: (patch: Partial<DraftItem>) => void }) {
  const food = item.food!
  const [custom, setCustom] = useState(false)
  const [grams, setGrams] = useState(() => portionGrams(food, item.portion) || food.servings[food.def].g)
  const unit = food.liquid ? 'ml' : 'g'

  return (
    <QuestionBlock title="How much was it?">
      {!custom ? (
        <>
          <div className="space-y-2">
            {food.servings.map((serving, i) => (
              <OptionCard
                key={serving.label}
                label={serving.label}
                hint={`${serving.g} ${unit}`}
                selected={item.portion.serving === i}
                onSelect={() => onPatch({ portion: { serving: i, qty: item.portion.qty || 1 }, portionDone: true })}
              />
            ))}
          </div>
          <div className="surface mt-3 flex min-h-[52px] items-center justify-between gap-3 rounded-[20px] px-4">
            <span className="text-[17px]">How many?</span>
            <Stepper
              value={item.portion.qty || 1}
              onChange={(qty) => onPatch({ portion: { ...item.portion, qty }, portionDone: item.portion.serving >= 0 })}
              step={0.5}
              min={0.5}
              max={20}
              format={(v) => `× ${v}`}
              label="servings"
            />
          </div>
          <button onClick={() => setCustom(true)} className="mt-2 min-h-[44px] w-full text-center text-[17px] text-tint">
            Enter an exact weight
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TextInput
              autoFocus
              inputMode="numeric"
              aria-label={`Weight in ${unit}`}
              value={String(grams)}
              onChange={(e) => setGrams(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="text-center text-[20px] font-semibold"
            />
            <span className="text-[17px] text-ink-3">{unit}</span>
          </div>
          <Button onTap={() => onPatch({ portion: { serving: -1, qty: 1, grams }, portionDone: true })} className="w-full">
            Use {grams} {unit}
          </Button>
          <button onClick={() => setCustom(false)} className="min-h-[44px] w-full text-center text-[17px] text-tint">
            Back to portions
          </button>
        </div>
      )}
    </QuestionBlock>
  )
}

/* ── Stage: review ─────────────────────────────────────────────────── */

function ReviewStage({
  items,
  mealId,
  setMeal,
  onPatch,
  onEdit,
  onRemove,
  onAddMore,
}: {
  items: DraftItem[]
  mealId: Meal
  setMeal: (m: Meal) => void
  onPatch: (uid: string, patch: Partial<DraftItem>) => void
  onEdit: (uid: string) => void
  onRemove: (uid: string) => void
  onAddMore: () => void
}) {
  const totals = items.reduce(
    (acc, item) => {
      const m = itemMacros(item)
      return { kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  // A whole day arrives with meals attached; group by them. A single meal uses the picker.
  const byMeal = items.some((i) => i.meal)

  const row = (item: DraftItem) => (
    <ReviewRow
      key={item.uid}
      item={item}
      showMeal={byMeal}
      fallbackMeal={mealId}
      onMeal={(meal) => onPatch(item.uid, { meal })}
      onScale={(scale) => onPatch(item.uid, { scale })}
      onEdit={() => onEdit(item.uid)}
      onRemove={() => onRemove(item.uid)}
    />
  )

  return (
    <div>
      {!byMeal && <Segmented label="Meal" options={MEALS.map((m) => ({ id: m.id, label: m.label }))} value={mealId} onChange={setMeal} />}

      {byMeal ? (
        <div className="space-y-5">
          {MEALS.map((meal) => {
            const group = items.filter((i) => i.meal === meal.id)
            if (!group.length) return null
            return (
              <section key={meal.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <MealIcon meal={meal.id} size={24} />
                  <h3 className="flex-1 text-[20px] leading-tight font-bold">{meal.label}</h3>
                  <span className="tabular text-[15px] text-ink-3">{fmt(group.reduce((s, i) => s + itemMacros(i).kcal, 0))} kcal</span>
                </div>
                <ReviewList>{group.map(row)}</ReviewList>
              </section>
            )
          })}
          {items.some((i) => !i.meal) && (
            <section>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h3 className="flex-1 text-[20px] leading-tight font-bold">No time given</h3>
                <select className="ios-select min-h-[44px] text-[15px]" value={mealId} onChange={(e) => setMeal(e.target.value as Meal)} aria-label="Meal for items with no time">
                  {MEALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      Log to {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <ReviewList>{items.filter((i) => !i.meal).map(row)}</ReviewList>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <ReviewList>{items.map(row)}</ReviewList>
        </div>
      )}

      <button onClick={onAddMore} className="surface mt-3 flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[17px] text-tint active:bg-fill">
        <Plus size={20} strokeWidth={2.4} /> Add something else
      </button>

      <div className="tabular mt-4 flex items-baseline justify-between px-1 text-[15px]">
        <span className="text-ink-3">Total</span>
        <span>
          <span className="font-rounded text-[20px] font-bold text-ink">{fmt(totals.kcal)} kcal</span>
          <span className="text-ink-3">
            {' '}
            · {Math.round(totals.p)} P · {Math.round(totals.c)} C · {Math.round(totals.f)} F
          </span>
        </span>
      </div>
    </div>
  )
}

function ReviewList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="surface ios-list overflow-hidden" style={{ ['--sep-inset' as string]: '68px' }}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  )
}

function ReviewRow({
  item,
  showMeal,
  fallbackMeal,
  onMeal,
  onScale,
  onEdit,
  onRemove,
}: {
  item: DraftItem
  showMeal: boolean
  fallbackMeal: Meal
  onMeal: (meal: Meal) => void
  onScale: (scale: number) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const macros = itemMacros(item)
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={spring}
      className="overflow-hidden px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-fill text-[21px]" aria-hidden>
          {itemEmoji(item)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] leading-[22px]">{itemName(item)}</div>
          <div className="truncate text-[15px] leading-[20px] text-ink-3">{itemPortionText(item)}</div>
        </div>
        <span className="font-rounded tabular shrink-0 text-[17px] font-semibold">{fmt(macros.kcal)}</span>
        <button onClick={onRemove} aria-label={`Remove ${itemName(item)}`} className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 active:bg-fill">
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-[52px]">
        {showMeal ? (
          <span className="min-w-0 flex-1">
            <select className="ios-select min-h-[44px] max-w-full text-[15px]" value={item.meal ?? fallbackMeal} onChange={(e) => onMeal(e.target.value as Meal)} aria-label={`Meal for ${itemName(item)}`}>
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span className="tabular min-w-0 flex-1 truncate text-[13px] text-ink-3">
            {macros.p} P · {macros.c} C · {macros.f} F
          </span>
        )}
        {item.fixed ? (
          <Stepper value={item.scale} onChange={onScale} step={0.25} min={0.25} max={6} format={(v) => `×${v}`} label="portion" />
        ) : (
          <Button kind="gray" size="small" onTap={onEdit}>
            <Pencil size={14} /> Adjust
          </Button>
        )}
      </div>
    </motion.li>
  )
}

/* ── AI follow-up questions ────────────────────────────────────────── */

function AiQuestions({
  state,
  busy,
  label,
  onSubmit,
  onSkip,
}: {
  state: { questions: AiResultData['questions']; answers: AiAnswer[]; note?: string }
  busy: boolean
  label: string
  onSubmit: (answers: AiAnswer[]) => void
  onSkip: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Record<string, string>>({})

  const all = state.questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? custom[q.id] ?? '' }))
  const ready = all.every((a) => a.answer.trim().length > 0)

  return (
    <div>
      <p className="mb-4 flex items-center gap-2 px-1 text-[15px] text-ink-2">
        <Sparkles size={16} className="shrink-0 text-tint" /> {label} needs a couple of details to get this close.
      </p>

      <div className="space-y-6">
        {state.questions.map((q) => (
          <div key={q.id}>
            <h3 className="px-1 text-[20px] leading-tight font-bold">{q.question}</h3>
            <div className="mt-2 space-y-2">
              {q.options.map((option) => (
                <OptionCard
                  key={option}
                  label={option}
                  selected={answers[q.id] === option}
                  onSelect={() => {
                    setAnswers((a) => ({ ...a, [q.id]: option }))
                    setCustom((c) => ({ ...c, [q.id]: '' }))
                  }}
                />
              ))}
              <TextInput
                placeholder="Or say it in your own words"
                aria-label={`${q.question} In your own words`}
                value={custom[q.id] ?? ''}
                onChange={(e) => {
                  setCustom((c) => ({ ...c, [q.id]: e.target.value }))
                  setAnswers((a) => ({ ...a, [q.id]: '' }))
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <Button kind="gray" onTap={onSkip} disabled={busy}>
          Just estimate
        </Button>
        <Button onTap={() => onSubmit([...state.answers, ...all])} disabled={!ready || busy} className="flex-1">
          {busy && <Loader2 size={18} className="animate-spin" />} Done
        </Button>
      </div>
    </div>
  )
}

/* ── Small pieces ──────────────────────────────────────────────────── */

function PickList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="surface ios-list overflow-hidden" style={{ ['--sep-inset' as string]: '64px' }}>
      {children}
    </ul>
  )
}

function PickRow({ emoji, name, detail, kcal, onPick }: { emoji: string; name: string; detail: string; kcal: number; onPick: () => void }) {
  return (
    <li>
      <button
        onClick={() => {
          haptic(5)
          onPick()
        }}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-fill"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-fill text-[19px]" aria-hidden>
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] leading-[22px]">{name}</span>
          <span className="block truncate text-[13px] leading-[18px] text-ink-3">{detail}</span>
        </span>
        <span className="tabular shrink-0 text-[15px] text-ink-3">{fmt(kcal)}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-tint">
          <Plus size={16} strokeWidth={2.6} />
        </span>
      </button>
    </li>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[15px] leading-snug text-ink-3">
      <span className="grid size-11 place-items-center rounded-full bg-fill">{icon}</span>
      {text}
    </div>
  )
}
