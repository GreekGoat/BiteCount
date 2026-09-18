import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Camera, Check, ChevronRight, Clock, Loader2, Mic, Pencil, Plus, Search, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiAnswer, AiResultData } from '../food/ai'
import { providerInfo } from '../food/ai-models'
import { DISH_KINDS, MAIN_INGREDIENTS, kindIsSavory, makeEstimatedFood } from '../food/archetype'
import { answerSummary, computeItem, portionGrams, portionLabel, type Answers, type Portion } from '../food/compute'
import { FOODS, getFood } from '../food/db'
import { parseMeal, reparseFor, type ParsedItem } from '../food/parse'
import { QUESTIONS } from '../food/questions'
import { searchFoods, type SearchHit } from '../food/search'
import type { Food, FoodCat, Macros, QuestionKey } from '../food/types'
import { dayKey, MEALS, mealForTime, type DayKey, type Meal } from '../lib/date'
import { haptic, hapticSuccess } from '../lib/haptics'
import { fileToCompressedBase64 } from '../lib/image'
import { speechSupported, startDictation, type Dictation } from '../lib/speech'
import { recentEntries, useAiSettings, useStore, type LogEntry } from '../lib/store'
import { fmt } from '../lib/units'
import { Chip, OptionCard, Segmented, Stepper, TextInput } from '../ui/Controls'
import { Confetti } from '../ui/Confetti'
import { Sheet } from '../ui/Sheet'
import { AnimatedNumber, Press, spring } from '../ui/motion'
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
}

type QKey = 'food' | 'kind' | 'main' | 'portion' | QuestionKey

const uid = () => Math.random().toString(36).slice(2)

const PLACEHOLDERS = [
  '2 rotis and a bowl of chicken curry',
  'chicken biryani, restaurant plate',
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

export function AddSheet({ open, meal, date = dayKey(), onClose }: { open: boolean; meal?: Meal; date?: DayKey; onClose: () => void }) {
  const addEntries = useStore((s) => s.addEntries)
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
  const [busy, setBusy] = useState(false)
  const [celebrate, setCelebrate] = useState(0)
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
      setMealId(meal ?? mealForTime())
    }
    if (open) {
      reset()
      return
    }
    const timer = setTimeout(reset, 400)
    return () => clearTimeout(timer)
  }, [open, meal])

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
    const parsed = parseMeal(input)
    if (!parsed.length) return
    // Append, so "Add something else" keeps what is already in the basket.
    const next = [...items, ...parsed.map((p) => itemFromParsed(p))]
    setItems(next)
    advance(next, items.length)
  }

  const runAi = async (req: { text: string; answers?: AiAnswer[]; skipQuestions?: boolean }) => {
    if (!aiReady) {
      toast(`Add your ${aiLabel} API key in You → AI estimation`, 'error')
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
      const hint = error && typeof error === 'object' && 'hint' in error ? (error as { hint?: string }).hint : undefined
      toast(hint ? `${message} ${hint}` : message, 'error')
      if (text.trim()) {
        startLocal(text)
        toast('Falling back to the offline estimate', 'default')
      }
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    const input = text.trim()
    if (photo) {
      void runAi({ text: input })
      return
    }
    if (!input) return
    const parsed = parseMeal(input)
    const unknown = parsed.filter((p) => !p.hit).length
    if (unknown > 0 && aiReady) {
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
        date,
        meal: mealId,
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
    if (logs.length) addEntries(logs)
    if (waterMl) addWater(waterMl, date)
    hapticSuccess()
    setCelebrate((c) => c + 1)
    setTimeout(onClose, 420)
  }

  const current = items[cursor]

  return (
    <Sheet open={open} onClose={onClose} label="Add food">
      {celebrate > 0 && <Confetti key={celebrate} />}

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-5 pt-1 pb-3">
        <h2 className="font-display flex-1 text-[21px] font-bold tracking-tight">
          {stage === 'input' ? (aiState ? 'A few quick questions' : 'What did you eat?') : stage === 'questions' ? 'A few details' : 'Ready to log'}
        </h2>
        {items.length > 0 && (
          <div className="text-right">
            <AnimatedNumber value={total} className="tabular font-display text-[21px] leading-none font-extrabold" />
            <div className="text-[10.5px] text-ink-3">kcal</div>
          </div>
        )}
        <Press onTap={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full border border-line text-ink-2">
          <X size={16} />
        </Press>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {stage === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {aiState ? (
                <AiQuestions
                  state={aiState}
                  busy={busy}
                  label={aiLabel}
                  onSubmit={(answers) => void runAi({ text, answers })}
                  onSkip={() => void runAi({ text, answers: aiState.answers, skipQuestions: true })}
                />
              ) : (
                <InputStage
                  text={text}
                  setText={setText}
                  onSubmit={submit}
                  busy={busy}
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
            <motion.div key={`q-${current.uid}-${pending(current)[0]}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
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
            <motion.div key="review" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ReviewStage
                items={items}
                mealId={mealId}
                setMeal={setMealId}
                onScale={(uidKey, scale) => patchItem(uidKey, { scale })}
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

      {/* Footer action */}
      {stage === 'review' && items.length > 0 && (
        <div className="shrink-0 border-t border-line bg-bg-2/80 px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <Press onTap={commit} className="grad w-full rounded-2xl py-3.5 text-[17px] font-bold text-white shadow-lg">
            <span className="flex items-center justify-center gap-2">
              <Check size={19} strokeWidth={3} /> Add {items.length > 1 ? `${items.length} items` : 'to log'} · {fmt(total)} kcal
            </span>
          </Press>
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

function InputStage({ text, setText, onSubmit, busy, aiReady, aiLabel, aiVision, photo, onPickPhoto, onClearPhoto, onQuickPick, recents, savedFoods, onAskAi }: InputStageProps) {
  const [tab, setTab] = useState<'recent' | 'saved' | 'browse' | 'quick'>('recent')
  const [placeholder, setPlaceholder] = useState(0)
  const [listening, setListening] = useState(false)
  const dictation = useRef<Dictation | null>(null)
  const textBeforeDictation = useRef('')
  const canDictate = useMemo(() => speechSupported(), [])
  const toast = useToast()

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
  const suggestions = useMemo(() => (text.trim().length >= 2 ? searchFoods(text.split(/[,+]|\band\b/).pop() ?? text, 6) : []), [text])

  useEffect(() => {
    const id = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 3800)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div className="relative">
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
          rows={2}
          placeholder={listening ? 'Listening…' : `e.g. ${PLACEHOLDERS[placeholder]}`}
          className="w-full resize-none rounded-2xl border border-line bg-card p-4 pr-[104px] text-[16px] leading-snug text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          {canDictate && (
            <Press
              onTap={toggleDictation}
              aria-label={listening ? 'Stop dictation' : 'Dictate what you ate'}
              aria-pressed={listening}
              className={`relative grid size-9 place-items-center rounded-xl border ${
                listening ? 'border-transparent text-white' : 'border-line bg-card text-ink-2'
              }`}
            >
              {listening && (
                <>
                  <span className="grad absolute inset-0 rounded-xl" />
                  <span className="grad absolute inset-0 rounded-xl blur-md" style={{ animation: 'pulse-glow 1.4s ease-in-out infinite' }} aria-hidden />
                </>
              )}
              <span className="relative">{listening ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}</span>
            </Press>
          )}
          <Press
            onTap={onPickPhoto}
            aria-label="Add a photo of the meal"
            className="grid size-9 place-items-center rounded-xl border border-line bg-card text-ink-2"
          >
            <Camera size={17} />
          </Press>
        </div>
      </div>

      {photo && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
          <img src={photo.preview} alt="Your meal" className="size-16 rounded-xl object-cover" />
          <div className="flex-1 text-[13px] text-ink-2">
            Photo ready.{' '}
            {!aiReady
              ? 'Add an API key in You → AI estimation to use photos.'
              : aiVision
                ? `${aiLabel} will read the plate.`
                : `${aiLabel} cannot read photos — switch to Gemini or Claude.`}
          </div>
          <Press onTap={onClearPhoto} aria-label="Remove photo" className="grid size-8 place-items-center rounded-full border border-line text-ink-3">
            <X size={15} />
          </Press>
        </motion.div>
      )}

      <div className="mt-3 flex gap-2">
        <Press
          onTap={onSubmit}
          disabled={busy || (!text.trim() && !photo)}
          className="grad flex-1 rounded-2xl py-3.5 text-[16px] font-bold text-white shadow-lg disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Working it out
              </>
            ) : (
              <>
                Work it out <ArrowRight size={18} strokeWidth={2.6} />
              </>
            )}
          </span>
        </Press>
        {aiReady && !!text.trim() && (
          <Press
            onTap={onAskAi}
            disabled={busy}
            aria-label={`Ask ${aiLabel}`}
            className="grid w-14 place-items-center rounded-2xl border border-line bg-card text-brand disabled:opacity-40"
          >
            <Sparkles size={19} />
          </Press>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <SectionLabel icon={<Search size={13} />}>Matches</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((hit) => (
              <Chip
                key={hit.food.id}
                onClick={() => {
                  const parts = text.split(/([,+]|\band\b)/)
                  parts[parts.length - 1] = ` ${hit.food.name}`
                  setText(parts.join('').trimStart())
                }}
              >
                {hit.food.emoji} {hit.food.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <Segmented
          options={[
            { id: 'recent' as const, label: 'Recent' },
            { id: 'saved' as const, label: 'Mine' },
            { id: 'browse' as const, label: 'Browse' },
            { id: 'quick' as const, label: 'Quick' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div className="mt-3">
          {tab === 'recent' &&
            (recents.length ? (
              <ul className="space-y-2">
                {recents.map((entry) => (
                  <li key={entry.id}>
                    <PickRow
                      emoji={entry.emoji}
                      name={entry.name}
                      detail={entry.portion}
                      kcal={entry.kcal}
                      onPick={() =>
                        onQuickPick({ name: entry.name, emoji: entry.emoji, portion: entry.portion, macros: { kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f } })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={<Clock size={17} />} text="Foods you log will show up here for one-tap adding." />
            ))}

          {tab === 'saved' &&
            (savedFoods.length ? (
              <ul className="space-y-2">
                {savedFoods.map((food) => (
                  <li key={food.id}>
                    <PickRow emoji={food.emoji} name={food.name} detail={food.portion} kcal={food.macros.kcal} onPick={() => onQuickPick(food)} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={<Sparkles size={17} />} text="Estimated dishes get saved here so the next time is one tap." />
            ))}

          {tab === 'browse' && <BrowseFoods onPick={(food) => setText(text.trim() ? `${text.trim()}, ${food.name}` : food.name)} />}

          {tab === 'quick' && <QuickAdd onAdd={onQuickPick} />}
        </div>
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
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
        {BROWSE_GROUPS.map((g) => (
          <Chip key={g.id} active={g.id === group} onClick={() => setGroup(g.id)}>
            {g.emoji} {g.label}
          </Chip>
        ))}
      </div>
      <ul className="space-y-2">
        {foods.map((food) => {
          const macros = computeItem(food, { serving: food.def, qty: 1 })
          return (
            <li key={food.id}>
              <PickRow
                emoji={food.emoji}
                name={food.name}
                detail={portionLabel(food, { serving: food.def, qty: 1 })}
                kcal={macros.kcal}
                onPick={() => onPick(food)}
              />
            </li>
          )
        })}
      </ul>
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
      <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="What was it?" />
      <div className="grid grid-cols-4 gap-2">
        <TextInput value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder="kcal" className="text-center" />
        <TextInput value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" placeholder="P" className="text-center" />
        <TextInput value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" placeholder="C" className="text-center" />
        <TextInput value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" placeholder="F" className="text-center" />
      </div>
      <Press
        onTap={() =>
          onAdd({
            name: name.trim(),
            emoji: '🍽️',
            portion: 'Quick add',
            macros: { kcal: Math.round(Number(kcal) || 0), p: Number(p) || 0, c: Number(c) || 0, f: Number(f) || 0 },
          })
        }
        disabled={!valid}
        className="w-full rounded-2xl border border-line bg-card py-3 text-[15px] font-semibold disabled:opacity-40"
      >
        Add straight to the log
      </Press>
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
      {/* Item header - tap to pick a different food */}
      <Press
        onTap={() => onPatch({ needsFood: true })}
        aria-label={`Change ${itemName(item)}`}
        className="card mb-4 flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line text-[21px]">{itemEmoji(item)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-bold">{itemName(item)}</span>
            <Pencil size={12} className="shrink-0 text-ink-3" />
          </div>
          <div className="truncate text-[12.5px] text-ink-3">{itemPortionText(item) || item.raw}</div>
        </div>
        <div className="shrink-0 text-right">
          <AnimatedNumber value={macros.kcal} className="tabular block text-[17px] leading-none font-extrabold" />
          <span className="text-[10.5px] text-ink-3">kcal</span>
        </div>
      </Press>

      {count > 1 && (
        <div className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
          Item {index + 1} of {count}
        </div>
      )}

      {/* Answered so far */}
      {(Object.keys(item.answers).length > 0 || item.portionDone) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {item.portionDone && item.food && (
            <Chip onClick={() => onPatch({ portionDone: false, portionGiven: false })} active>
              {portionLabel(item.food, item.portion)} <Pencil size={11} className="ml-1 inline" />
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
                {labels} <Pencil size={11} className="ml-1 inline" />
              </Chip>
            )
          })}
        </div>
      )}

      {key === 'food' && <FoodPicker item={item} onPatch={onPatch} />}
      {key === 'kind' && (
        <QuestionBlock title="What kind of dish is it?" subtitle={`I do not know "${item.raw}" yet — this gets us close.`}>
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
          <MultiOrSingle
            questionKey={key}
            item={item}
            onPatch={onPatch}
            onAddSides={onAddSides}
          />
        </QuestionBlock>
      )}

      <div className="mt-5 flex gap-2">
        <Press onTap={onRemove} className="rounded-2xl border border-line px-4 py-3 text-[14px] font-semibold text-ink-3">
          Remove
        </Press>
        <Press onTap={onSkip} className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14.5px] font-semibold text-ink-2">
          <span className="flex items-center justify-center gap-1.5">
            Skip the rest <ChevronRight size={16} />
          </span>
        </Press>
      </div>
    </div>
  )
}

function QuestionBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[19px] font-bold tracking-tight">{title}</h3>
      {subtitle && <p className="mt-1 mb-3 text-[13.5px] text-ink-3">{subtitle}</p>}
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
      <div className="sticky bottom-0 -mx-1 mt-3 bg-gradient-to-t from-bg-2 via-bg-2/95 to-transparent px-1 pt-3 pb-1">
        <Press onTap={confirm} className="grad w-full rounded-2xl py-3 text-[15px] font-bold text-white shadow-lg">
          {picked.length ? `Add ${picked.length}` : 'Nothing extra'}
        </Press>
      </div>
    </div>
  )
}

function FoodPicker({ item, onPatch }: { item: DraftItem; onPatch: (patch: Partial<DraftItem>) => void }) {
  const [query, setQuery] = useState(item.raw)
  const results = useMemo(() => (query.trim() ? searchFoods(query, 8) : item.candidates), [query, item.candidates])

  return (
    <QuestionBlock title="Which one was it?" subtitle={`You typed "${item.raw}".`}>
      <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" className="mb-3" />
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
          label="None of these — estimate it"
          hint="I will ask what kind of dish it is"
          emoji="✨"
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
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3">
            <span className="text-[14px] font-semibold text-ink-2">How many?</span>
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
          <button onClick={() => setCustom(true)} className="mt-3 w-full text-center text-[13.5px] font-semibold text-brand">
            Enter exact weight instead
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TextInput
              autoFocus
              inputMode="numeric"
              value={String(grams)}
              onChange={(e) => setGrams(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="text-center text-[19px] font-bold"
            />
            <span className="text-[15px] font-semibold text-ink-3">{unit}</span>
          </div>
          <Press
            onTap={() => onPatch({ portion: { serving: -1, qty: 1, grams }, portionDone: true })}
            className="grad w-full rounded-2xl py-3 text-[15px] font-bold text-white"
          >
            Use {grams} {unit}
          </Press>
          <button onClick={() => setCustom(false)} className="w-full text-center text-[13.5px] font-semibold text-ink-3">
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
  onScale,
  onEdit,
  onRemove,
  onAddMore,
}: {
  items: DraftItem[]
  mealId: Meal
  setMeal: (m: Meal) => void
  onScale: (uid: string, scale: number) => void
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

  return (
    <div>
      <Segmented options={MEALS.map((m) => ({ id: m.id, label: m.label }))} value={mealId} onChange={setMeal} />

      <ul className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const macros = itemMacros(item)
            return (
              <motion.li
                key={item.uid}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={spring}
                className="card p-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-[19px]">{itemEmoji(item)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{itemName(item)}</div>
                    <div className="truncate text-[12.5px] text-ink-3">{itemPortionText(item)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="tabular block text-[15px] font-extrabold">{fmt(macros.kcal)}</span>
                    <span className="text-[10.5px] text-ink-3">kcal</span>
                  </div>
                  <Press onTap={() => onRemove(item.uid)} aria-label="Remove" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink-3">
                    <X size={14} />
                  </Press>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="tabular text-[12px] text-ink-3">
                    {macros.p} P · {macros.c} C · {macros.f} F
                  </span>
                  {item.fixed ? (
                    <Stepper value={item.scale} onChange={(v) => onScale(item.uid, v)} step={0.25} min={0.25} max={6} format={(v) => `×${v}`} label="portion" />
                  ) : (
                    <Chip onClick={() => onEdit(item.uid)}>
                      <Pencil size={12} className="mr-1 inline" /> Adjust
                    </Chip>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <Press onTap={onAddMore} className="mt-3 w-full rounded-2xl border border-dashed border-line-strong py-3 text-[14.5px] font-semibold text-ink-2">
        <span className="flex items-center justify-center gap-1.5">
          <Plus size={16} /> Add something else
        </span>
      </Press>

      <div className="tabular mt-4 flex justify-between rounded-2xl border border-line bg-card p-4 text-[13.5px]">
        <span className="font-semibold text-ink-2">Meal total</span>
        <span>
          <span className="font-extrabold text-ink">{fmt(totals.kcal)} kcal</span>
          <span className="text-ink-3">
            {' '}
            · {Math.round(totals.p)}P {Math.round(totals.c)}C {Math.round(totals.f)}F
          </span>
        </span>
      </div>
    </div>
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
      <p className="mb-4 flex items-center gap-2 text-[13.5px] text-ink-2">
        <Sparkles size={15} className="text-brand" /> {label} needs a couple of details to get this close.
      </p>

      <div className="space-y-5">
        {state.questions.map((q) => (
          <div key={q.id}>
            <h3 className="font-display text-[17px] font-bold tracking-tight">{q.question}</h3>
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

      <div className="mt-5 flex gap-2">
        <Press onTap={onSkip} disabled={busy} className="rounded-2xl border border-line bg-card px-4 py-3 text-[14.5px] font-semibold text-ink-2">
          Just estimate
        </Press>
        <Press
          onTap={() => onSubmit([...state.answers, ...all])}
          disabled={!ready || busy}
          className="grad flex-1 rounded-2xl py-3 text-[16px] font-bold text-white disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />} Done
          </span>
        </Press>
      </div>
    </div>
  )
}

/* ── Small pieces ──────────────────────────────────────────────────── */

function PickRow({ emoji, name, detail, kcal, onPick }: { emoji: string; name: string; detail: string; kcal: number; onPick: () => void }) {
  return (
    <Press onTap={onPick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-[17px]">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{name}</span>
        <span className="block truncate text-[12px] text-ink-3">{detail}</span>
      </span>
      <span className="tabular shrink-0 text-[13.5px] font-bold">{fmt(kcal)}</span>
      <Plus size={16} className="shrink-0 text-ink-3" />
    </Press>
  )
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
      {icon}
      {children}
    </div>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-[13.5px] text-ink-3">
      <span className="shrink-0">{icon}</span>
      {text}
    </div>
  )
}
